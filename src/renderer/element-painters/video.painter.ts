import { CanvasRenderingContext2D, loadImage as canvasLoadImage } from 'canvas';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { VideoElement } from '../../types';
import { computePosition } from '../utils';

/**
 * VideoFrameExtractor - Dùng FFmpeg để extract frames từ video source
 */
export class VideoFrameExtractor {
  private framesDir: string;
  private extracted = false;
  private fps: number;
  private totalFrames = 0;

  constructor(
    private readonly videoPath: string,
    private readonly targetFps: number
  ) {
    this.fps = targetFps;
    this.framesDir = path.join(path.dirname(videoPath), `frames_${path.basename(videoPath, path.extname(videoPath))}`);
  }

  /**
   * Extract tất cả frames từ video → PNG files
   * Dùng FFmpeg để decode, output dưới dạng frame_%06d.png
   */
  extractFrames(): void {
    if (this.extracted) return;

    if (!fs.existsSync(this.framesDir)) {
      fs.mkdirSync(this.framesDir, { recursive: true });
    }

    const outputPattern = path.join(this.framesDir, 'frame_%06d.png');

    execSync(`ffmpeg -y -i "${this.videoPath}" -vf "fps=${this.fps}" -q:v 2 "${outputPattern}"`, { stdio: 'pipe', timeout: 300000 });

    // Đếm số frames
    const files = fs.readdirSync(this.framesDir).filter((f) => f.startsWith('frame_'));
    this.totalFrames = files.length;
    this.extracted = true;
  }

  /**
   * Lấy frame tại index (1-indexed như FFmpeg output)
   */
  getFramePath(frameIndex: number): string | null {
    const idx = Math.max(1, Math.min(frameIndex, this.totalFrames));
    const framePath = path.join(this.framesDir, `frame_${String(idx).padStart(6, '0')}.png`);
    return fs.existsSync(framePath) ? framePath : null;
  }

  getTotalFrames(): number {
    return this.totalFrames;
  }

  /**
   * Cleanup extracted frames
   */
  cleanup(): void {
    if (fs.existsSync(this.framesDir)) {
      fs.rmSync(this.framesDir, { recursive: true, force: true });
    }
  }
}

/**
 * Vẽ video element frame lên canvas
 * @param frameIndex - Frame index trong video source (bắt đầu từ 1)
 */
export async function paintVideoFrame(
  ctx: CanvasRenderingContext2D,
  element: VideoElement,
  canvasWidth: number,
  canvasHeight: number,
  extractor: VideoFrameExtractor,
  frameIndex: number
): Promise<void> {
  const { width, height, position = 'center', fit = 'cover', offsetX = 0, offsetY = 0, borderRadius = 0, loop = false, opacity = 1, trimStart = 0 } = element;

  // Handle loop + trimStart: offset frame index
  let actualFrameIndex = frameIndex + Math.round(trimStart * extractor['fps']);
  const totalFrames = extractor.getTotalFrames();

  if (totalFrames === 0) return;

  if (loop && frameIndex > totalFrames) {
    actualFrameIndex = ((frameIndex - 1) % totalFrames) + 1;
  } else if (frameIndex > totalFrames) {
    actualFrameIndex = totalFrames; // Freeze last frame
  }

  const framePath = extractor.getFramePath(actualFrameIndex);
  if (!framePath) return;

  try {
    const img = await canvasLoadImage(framePath);
    const pos = computePosition(position, canvasWidth, canvasHeight, width, height, offsetX, offsetY);

    ctx.save();

    if (borderRadius > 0) {
      ctx.beginPath();
      roundRectPath(ctx, pos.x, pos.y, width, height, borderRadius);
      ctx.clip();
    }

    // Fit mode
    const drawParams = calculateFitDraw(img.width, img.height, width, height, fit);

    // Apply opacity
    if (opacity < 1) {
      ctx.globalAlpha = opacity;
    }

    ctx.drawImage(img, drawParams.sx, drawParams.sy, drawParams.sw, drawParams.sh, pos.x, pos.y, width, height);

    ctx.restore();
  } catch {
    // Skip frame nếu load lỗi
  }
}

function calculateFitDraw(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
  fit: 'cover' | 'contain' | 'fill'
): { sx: number; sy: number; sw: number; sh: number } {
  if (fit === 'fill') {
    return { sx: 0, sy: 0, sw: srcW, sh: srcH };
  }

  const srcRatio = srcW / srcH;
  const dstRatio = dstW / dstH;

  if (fit === 'cover') {
    if (srcRatio > dstRatio) {
      const sw = srcH * dstRatio;
      return { sx: (srcW - sw) / 2, sy: 0, sw, sh: srcH };
    } else {
      const sh = srcW / dstRatio;
      return { sx: 0, sy: (srcH - sh) / 2, sw: srcW, sh };
    }
  }

  return { sx: 0, sy: 0, sw: srcW, sh: srcH };
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
