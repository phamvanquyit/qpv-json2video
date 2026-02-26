import { Image, loadImage as canvasLoadImage } from '@napi-rs/canvas';
import type { SKRSContext2D as CanvasRenderingContext2D } from '@napi-rs/canvas';
import { ImageElement } from '../../types';
import { AssetLoader } from '../asset-loader';
import { computePosition, calculateFitDraw, roundRectPath, getEasingFunction } from '../utils';
import gifFrames from 'gif-frames';

/**
 * OPTIMIZATION: Cache decoded Image objects per URL
 * Tránh decode image từ buffer mỗi frame (rất tốn CPU)
 * Image object là native C++ object, decode 1 lần dùng mãi
 */
const imageCache = new Map<string, Image>();

/**
 * GIF frame data với timing info
 */
interface GifFrame {
  image: Image;
  delay: number; // delay in seconds
}

/**
 * Cache GIF frames per URL
 * Mỗi GIF được extract 1 lần, cache tất cả frames
 */
const gifCache = new Map<string, { frames: GifFrame[]; totalDuration: number }>();

/**
 * Check if URL is a GIF
 */
function isGifUrl(url: string): boolean {
  const lowered = url.toLowerCase();
  return lowered.endsWith('.gif') || lowered.includes('.gif?');
}

/**
 * Extract tất cả frames từ GIF file
 * Trả về array of frames với delay info
 */
async function extractGifFrames(buffer: Buffer): Promise<{ frames: GifFrame[]; totalDuration: number }> {
  const frames: GifFrame[] = [];
  let totalDuration = 0;

  try {
    const frameDataArray = await gifFrames({
      url: buffer,
      frames: 'all',
      outputType: 'png',
      cumulative: true, // layer frames for delta GIFs
    });

    for (const frameData of frameDataArray) {
      // Get frame image as buffer
      const imageStream = frameData.getImage();
      const chunks: Buffer[] = [];

      await new Promise<void>((resolve, reject) => {
        imageStream.on('data', (chunk: Buffer) => chunks.push(chunk));
        imageStream.on('end', () => resolve());
        imageStream.on('error', reject);
      });

      const frameBuffer = Buffer.concat(chunks);
      const image = await canvasLoadImage(frameBuffer);

      // delay is in centiseconds (1/100 of a second), convert to seconds
      // frameInfo.delay: delay before next frame (in 1/100th of a second)
      const delayCs = frameData.frameInfo?.delay ?? 10; // default 10cs = 100ms
      const delaySec = delayCs / 100;

      frames.push({ image, delay: delaySec });
      totalDuration += delaySec;
    }
  } catch {
    // Fallback: if gif-frames fails, return empty (will use static image fallback)
    return { frames: [], totalDuration: 0 };
  }

  return { frames, totalDuration };
}

/**
 * Get current GIF frame based on time (looping animation)
 */
function getCurrentGifFrame(gifData: { frames: GifFrame[]; totalDuration: number }, timeInElement: number): Image | null {
  if (gifData.frames.length === 0) return null;

  // Loop the animation
  const loopedTime = timeInElement % gifData.totalDuration;

  let accumulated = 0;
  for (const frame of gifData.frames) {
    accumulated += frame.delay;
    if (loopedTime < accumulated) {
      return frame.image;
    }
  }

  // Fallback to last frame
  return gifData.frames[gifData.frames.length - 1].image;
}

/**
 * Vẽ image element lên canvas
 * Hỗ trợ: static images + animated GIFs + Ken Burns effect
 *
 * OPTIMIZATION: Decode image 1 lần, cache Image object, reuse cho mọi frame
 *
 * @param timeInElement - Thời gian element đã hiển thị (giây) - dùng cho GIF animation + Ken Burns
 * @param elementDuration - Tổng thời lượng element hiển thị (giây) - dùng cho Ken Burns progress
 */
export async function paintImage(
  ctx: CanvasRenderingContext2D,
  element: ImageElement,
  canvasWidth: number,
  canvasHeight: number,
  assetLoader: AssetLoader,
  timeInElement = 0,
  elementDuration = 0
): Promise<void> {
  const { url, width, height, position = 'center', fit = 'cover', offsetX = 0, offsetY = 0, borderRadius = 0, opacity = 1, kenBurns } = element;

  try {
    let img: Image | null = null;

    // Check if it's a GIF
    if (isGifUrl(url)) {
      // Try to get cached GIF frames
      let gifData = gifCache.get(url);

      if (!gifData) {
        // Extract GIF frames
        const imgBuffer = await assetLoader.loadImage(url);
        gifData = await extractGifFrames(imgBuffer);

        if (gifData.frames.length > 0) {
          gifCache.set(url, gifData);
        } else {
          // Fallback: treat as static image
          img = await canvasLoadImage(imgBuffer);
          imageCache.set(url, img);
        }
      }

      if (gifData && gifData.frames.length > 0) {
        img = getCurrentGifFrame(gifData, timeInElement);
      }
    }

    // Static image (non-GIF or GIF fallback)
    if (!img) {
      img = imageCache.get(url) ?? null;
      if (!img) {
        const imgBuffer = await assetLoader.loadImage(url);
        img = await canvasLoadImage(imgBuffer);
        imageCache.set(url, img);
      }
    }

    const pos = computePosition(position, canvasWidth, canvasHeight, width, height, offsetX, offsetY);

    ctx.save();

    // Border radius clip
    if (borderRadius > 0) {
      roundRectPath(ctx, pos.x, pos.y, width, height, borderRadius);
      ctx.clip();
    }

    // Apply opacity
    if (opacity < 1) {
      ctx.globalAlpha = opacity;
    }

    if (kenBurns && elementDuration > 0) {
      // === Ken Burns effect: smooth continuous pan+zoom ===
      paintKenBurns(ctx, img, pos.x, pos.y, width, height, kenBurns, timeInElement, elementDuration);
    } else {
      // Standard fit mode
      const drawParams = calculateFitDraw(img.width, img.height, width, height, fit);
      ctx.drawImage(img, drawParams.sx, drawParams.sy, drawParams.sw, drawParams.sh, pos.x, pos.y, width, height);
    }

    ctx.restore();
  } catch {
    // Nếu load image lỗi, vẽ placeholder
    ctx.save();
    ctx.fillStyle = '#333333';
    const pos = computePosition(position, canvasWidth, canvasHeight, width, height, offsetX, offsetY);
    ctx.fillRect(pos.x, pos.y, width, height);

    ctx.fillStyle = '#666666';
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Image Error', pos.x + width / 2, pos.y + height / 2);
    ctx.restore();
  }
}

/**
 * Ken Burns effect — smooth continuous pan+zoom on static image
 *
 * Logic:
 * 1. Tính progress (0→1) dựa trên timeInElement / elementDuration
 * 2. Interpolate position (startX→endX, startY→endY) với easing
 * 3. Interpolate zoom (startZoom→endZoom) với easing
 * 4. Tính source rect: zoom xác định kích thước crop, position xác định tâm crop
 * 5. Vẽ crop region → destination element
 */
function paintKenBurns(
  ctx: CanvasRenderingContext2D,
  img: Image,
  destX: number,
  destY: number,
  destW: number,
  destH: number,
  config: import('../../types').KenBurnsConfig,
  timeInElement: number,
  elementDuration: number
): void {
  const {
    startX = 50, startY = 50, startZoom = 1.2,
    endX = 50, endY = 50, endZoom = 1.0,
    easing = 'easeInOut',
  } = config;

  // Progress 0→1 with easing
  const rawProgress = Math.max(0, Math.min(1, timeInElement / elementDuration));
  const easingFn = getEasingFunction(easing);
  const progress = easingFn(rawProgress);

  // Interpolate zoom and position
  const currentZoom = startZoom + (endZoom - startZoom) * progress;
  const currentX = startX + (endX - startX) * progress;  // 0-100%
  const currentY = startY + (endY - startY) * progress;  // 0-100%

  // Calculate source crop region
  // Zoom > 1 means we see less of the image (crop in), zoom < 1 would see more
  const cropW = img.width / currentZoom;
  const cropH = img.height / currentZoom;

  // Pan position: currentX/Y (0-100%) determines where the center of view is
  // Map 0% → crop starts at left edge, 100% → crop ends at right edge
  const maxOffsetX = img.width - cropW;
  const maxOffsetY = img.height - cropH;
  const sx = (currentX / 100) * maxOffsetX;
  const sy = (currentY / 100) * maxOffsetY;

  ctx.drawImage(
    img,
    sx, sy, cropW, cropH,         // source (dynamic crop based on pan+zoom)
    destX, destY, destW, destH     // destination (element area)
  );
}

/**
 * Clear image cache (gọi khi cleanup)
 */
export function clearImageCache(): void {
  imageCache.clear();
  gifCache.clear();
}

