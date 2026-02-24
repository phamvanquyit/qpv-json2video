import { Image, loadImage as canvasLoadImage } from '@napi-rs/canvas';
import type { SKRSContext2D as CanvasRenderingContext2D } from '@napi-rs/canvas';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { VideoElement } from '../../types';
import { computePosition, calculateFitDraw, roundRectPath } from '../utils';

/**
 * VideoFrameExtractor - Dùng FFmpeg để extract frames từ video source
 *
 * OPTIMIZATION:
 * - JPEG format: ~200KB per frame thay vì 6MB (BMP) → giảm disk I/O 30x
 * - Cache decoded Image per frame (LRU-style)
 * - Pre-read buffer cache: đọc file → buffer 1 lần, tránh disk seek lặp
 */
export class VideoFrameExtractor {
  private framesDir: string;
  private extracted = false;
  private fps: number;
  private totalFrames = 0;

  // OPTIMIZATION: Cache decoded Image objects per frame index
  private frameImageCache = new Map<number, Image>();
  private static MAX_CACHE_SIZE = 90; // JPEG decode nhanh, cache 3 giây

  // OPTIMIZATION: Pre-read file buffer cache
  // Tránh disk read lặp khi LRU evict rồi load lại
  private frameBufferCache = new Map<number, Buffer>();
  private static MAX_BUFFER_CACHE_SIZE = 120;

  constructor(
    private readonly videoPath: string,
    private readonly targetFps: number
  ) {
    this.fps = targetFps;
    this.framesDir = path.join(path.dirname(videoPath), `frames_${path.basename(videoPath, path.extname(videoPath))}`);
  }

  /**
   * Extract tất cả frames từ video → JPEG files
   *
   * OPTIMIZATION: JPEG thay vì PNG/BMP
   * - PNG: lossless compression, slow encode+decode, ~2-4MB/frame
   * - BMP: uncompressed, fast decode, ~6MB/frame (disk I/O bottleneck)
   * - JPEG q:v 2: lossy nhưng quality rất cao, ~200KB/frame, fast decode
   *   → Giảm disk I/O 30x so với BMP, phù hợp cho video frames
   */
  async extractFrames(): Promise<void> {
    if (this.extracted) return;

    if (!fs.existsSync(this.framesDir)) {
      fs.mkdirSync(this.framesDir, { recursive: true });
    }

    // JPEG quality 2 — chất lượng cao, file size nhỏ
    const outputPattern = path.join(this.framesDir, 'frame_%06d.jpg');

    // OPTIMIZATION: Dùng spawn (async) thay vì execSync để không block event loop
    await new Promise<void>((resolve, reject) => {
      const proc = spawn('ffmpeg', [
        '-y', '-i', this.videoPath,
        '-vf', `fps=${this.fps}`,
        '-q:v', '2',
        outputPattern,
      ], { stdio: 'pipe' });

      const timeout = setTimeout(() => {
        proc.kill('SIGKILL');
        reject(new Error('FFmpeg frame extraction timeout (300s)'));
      }, 300000);

      proc.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg frame extraction exited with code ${code}`));
      });

      proc.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    // Đếm số frames (chỉ đếm files bắt đầu bằng 'frame_')
    this.totalFrames = fs.readdirSync(this.framesDir).reduce(
      (count, f) => count + (f.startsWith('frame_') ? 1 : 0), 0
    );
    this.extracted = true;
  }

  /**
   * Lấy frame path tại index (1-indexed)
   */
  getFramePath(frameIndex: number): string | null {
    const idx = Math.max(1, Math.min(frameIndex, this.totalFrames));
    if (idx < 1 || idx > this.totalFrames) return null;
    // Không cần existsSync — nếu đã extract thì frame files tồn tại
    return path.join(this.framesDir, `frame_${String(idx).padStart(6, '0')}.jpg`);
  }

  /**
   * OPTIMIZATION: Load frame Image từ cache → buffer cache → disk
   * Multi-layer cache: Image objects > Buffer pre-read > disk
   */
  async getFrameImage(frameIndex: number): Promise<Image | null> {
    const idx = Math.max(1, Math.min(frameIndex, this.totalFrames));

    // Layer 1: Check decoded Image cache
    const cachedImg = this.frameImageCache.get(idx);
    if (cachedImg) return cachedImg;

    try {
      // Layer 2: Check buffer cache (đã đọc từ disk)
      let buffer = this.frameBufferCache.get(idx);

      if (!buffer) {
        // Layer 3: Read from disk
        const framePath = this.getFramePath(idx);
        if (!framePath) return null;
        buffer = fs.readFileSync(framePath);

        // Cache buffer (LRU eviction)
        if (this.frameBufferCache.size >= VideoFrameExtractor.MAX_BUFFER_CACHE_SIZE) {
          const firstKey = this.frameBufferCache.keys().next().value;
          if (firstKey !== undefined) this.frameBufferCache.delete(firstKey);
        }
        this.frameBufferCache.set(idx, buffer);
      }

      // Decode Image từ buffer
      const img = await canvasLoadImage(buffer);

      // Cache Image (LRU eviction)
      if (this.frameImageCache.size >= VideoFrameExtractor.MAX_CACHE_SIZE) {
        const firstKey = this.frameImageCache.keys().next().value;
        if (firstKey !== undefined) this.frameImageCache.delete(firstKey);
      }
      this.frameImageCache.set(idx, img);

      return img;
    } catch {
      return null;
    }
  }

  getTotalFrames(): number {
    return this.totalFrames;
  }

  /**
   * Cleanup extracted frames
   */
  cleanup(): void {
    this.frameImageCache.clear();
    this.frameBufferCache.clear();
    if (fs.existsSync(this.framesDir)) {
      fs.rmSync(this.framesDir, { recursive: true, force: true });
    }
  }
}

/**
 * Vẽ video element frame lên canvas
 * @param frameIndex - Frame index trong video source (bắt đầu từ 1)
 *
 * OPTIMIZATION: Sử dụng cached Image từ VideoFrameExtractor
 */
export async function paintVideoFrame(
  ctx: CanvasRenderingContext2D,
  element: VideoElement,
  canvasWidth: number,
  canvasHeight: number,
  extractor: VideoFrameExtractor,
  frameIndex: number
): Promise<void> {
  const { width, height, position = 'center', fit = 'cover', offsetX = 0, offsetY = 0, borderRadius = 0, loop = false, opacity = 1, trimStart = 0, speed = 1 } = element;

  // Handle speed: multiply frame index to change playback rate
  // speed=2 → skip every other frame (fast forward)
  // speed=0.5 → repeat frames (slow motion)
  const speedAdjustedFrame = Math.round(frameIndex * speed);

  // Handle loop + trimStart: offset frame index
  let actualFrameIndex = speedAdjustedFrame + Math.round(trimStart * extractor['fps']);
  const totalFrames = extractor.getTotalFrames();

  if (totalFrames === 0) return;

  if (loop && speedAdjustedFrame > totalFrames) {
    actualFrameIndex = ((speedAdjustedFrame - 1) % totalFrames) + 1 + Math.round(trimStart * extractor['fps']);
  } else if (speedAdjustedFrame > totalFrames) {
    actualFrameIndex = totalFrames; // Freeze last frame
  }

  // OPTIMIZATION: Dùng cached Image thay vì load từ disk mỗi frame
  const img = await extractor.getFrameImage(actualFrameIndex);
  if (!img) return;

  try {
    const pos = computePosition(position, canvasWidth, canvasHeight, width, height, offsetX, offsetY);

    ctx.save();

    if (borderRadius > 0) {
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

