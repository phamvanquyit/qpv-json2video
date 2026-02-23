import { Image, loadImage as canvasLoadImage } from '@napi-rs/canvas';
import type { SKRSContext2D as CanvasRenderingContext2D } from '@napi-rs/canvas';
import { ImageElement } from '../../types';
import { AssetLoader } from '../asset-loader';
import { computePosition, calculateFitDraw, roundRectPath } from '../utils';

/**
 * OPTIMIZATION: Cache decoded Image objects per URL
 * Tránh decode image từ buffer mỗi frame (rất tốn CPU)
 * Image object là native C++ object, decode 1 lần dùng mãi
 */
const imageCache = new Map<string, Image>();

/**
 * Vẽ image element lên canvas
 *
 * OPTIMIZATION: Decode image 1 lần, cache Image object, reuse cho mọi frame
 */
export async function paintImage(
  ctx: CanvasRenderingContext2D,
  element: ImageElement,
  canvasWidth: number,
  canvasHeight: number,
  assetLoader: AssetLoader
): Promise<void> {
  const { url, width, height, position = 'center', fit = 'cover', offsetX = 0, offsetY = 0, borderRadius = 0, opacity = 1 } = element;

  try {
    // OPTIMIZATION: Check Image cache trước, tránh decode lặp
    let img = imageCache.get(url);
    if (!img) {
      const imgBuffer = await assetLoader.loadImage(url);
      img = await canvasLoadImage(imgBuffer);
      imageCache.set(url, img);
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

    // Tính toán vị trí draw dựa trên fit mode
    const drawParams = calculateFitDraw(img.width, img.height, width, height, fit);

    ctx.drawImage(img, drawParams.sx, drawParams.sy, drawParams.sw, drawParams.sh, pos.x, pos.y, width, height);

    ctx.restore();
  } catch (error) {
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
 * Clear image cache (gọi khi cleanup)
 */
export function clearImageCache(): void {
  imageCache.clear();
}

