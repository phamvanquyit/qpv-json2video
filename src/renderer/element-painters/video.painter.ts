import { Image, loadImage as canvasLoadImage } from '@napi-rs/canvas';
import type { SKRSContext2D as CanvasRenderingContext2D } from '@napi-rs/canvas';
import { spawn } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
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
    // Extract frames vào temp dir, tránh tạo thư mục trong source assets
    const hash = crypto.createHash('md5').update(videoPath).digest('hex').slice(0, 12);
    this.framesDir = path.join(os.tmpdir(), 'json2video-frames', `frames_${hash}`);
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
 *
 * Phase 7: Hỗ trợ crop, reverse, freeze frame, speed ramping
 */
export async function paintVideoFrame(
  ctx: CanvasRenderingContext2D,
  element: VideoElement,
  canvasWidth: number,
  canvasHeight: number,
  extractor: VideoFrameExtractor,
  frameIndex: number
): Promise<void> {
  const {
    width, height, position = 'center', fit = 'cover',
    offsetX = 0, offsetY = 0, borderRadius = 0, loop = false,
    opacity = 1, trimStart = 0, speed = 1,
    // Phase 7 fields
    crop, reverse = false, freezeAt, freezeDuration, speedCurve,
  } = element;

  const totalFrames = extractor.getTotalFrames();
  if (totalFrames === 0) return;

  const fps = extractor['fps'];
  let actualFrameIndex: number;

  if (freezeAt !== undefined) {
    // === Freeze frame: luôn hiển thị frame tại freezeAt ===
    actualFrameIndex = Math.round(freezeAt * fps) + 1;
  } else if (speedCurve && speedCurve.length >= 2) {
    // === Speed ramping: tích phân speed curve để tính source time ===
    // Thời gian thực (real time) trong element = frameIndex / fps
    const realTime = (frameIndex - 1) / fps;
    const sourceTime = integrateSpeedCurve(speedCurve, realTime);
    actualFrameIndex = Math.round(sourceTime * fps) + 1 + Math.round(trimStart * fps);
  } else {
    // === Constant speed (legacy behavior) ===
    const speedAdjustedFrame = Math.round(frameIndex * speed);
    actualFrameIndex = speedAdjustedFrame + Math.round(trimStart * fps);

    if (loop && speedAdjustedFrame > totalFrames) {
      actualFrameIndex = ((speedAdjustedFrame - 1) % totalFrames) + 1 + Math.round(trimStart * fps);
    } else if (speedAdjustedFrame > totalFrames) {
      actualFrameIndex = totalFrames; // Freeze last frame
    }
  }

  // === Reverse: đảo ngược frame index ===
  if (reverse) {
    actualFrameIndex = totalFrames - Math.min(actualFrameIndex, totalFrames) + 1;
  }

  // Clamp frame index
  actualFrameIndex = Math.max(1, Math.min(actualFrameIndex, totalFrames));

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

    // Apply opacity
    if (opacity < 1) {
      ctx.globalAlpha = opacity;
    }

    if (crop) {
      // === Crop mode: vẽ chỉ vùng crop từ source frame ===
      // Source rect = crop region, dest rect = element position
      ctx.drawImage(
        img,
        crop.x, crop.y, crop.width, crop.height, // source (crop region)
        pos.x, pos.y, width, height               // destination
      );
    } else {
      // Fit mode (legacy)
      const drawParams = calculateFitDraw(img.width, img.height, width, height, fit);
      ctx.drawImage(img, drawParams.sx, drawParams.sy, drawParams.sw, drawParams.sh, pos.x, pos.y, width, height);
    }

    ctx.restore();
  } catch {
    // Skip frame nếu load lỗi
  }
}

/**
 * Tích phân speed curve để tính source time từ real time.
 *
 * Speed curve định nghĩa tốc độ tại từng thời điểm:
 * - time=0, speed=1 → phát bình thường
 * - time=1, speed=0.3 → slow motion
 * - time=3, speed=2 → fast forward
 *
 * Source time = ∫₀ᵗ speed(t) dt
 * Dùng trapezoidal integration giữa các điểm.
 */
function integrateSpeedCurve(curve: { time: number; speed: number }[], realTime: number): number {
  // Sort curve by time (safety)
  const sorted = [...curve].sort((a, b) => a.time - b.time);

  let sourceTime = 0;
  let prevTime = sorted[0].time;
  let prevSpeed = sorted[0].speed;

  // Nếu realTime < first point, dùng speed của first point
  if (realTime <= prevTime) {
    return realTime * prevSpeed;
  }

  // Integrate from start đến min(realTime, lastPoint)
  for (let i = 1; i < sorted.length; i++) {
    const pt = sorted[i];

    if (realTime <= pt.time) {
      // realTime nằm giữa prev và pt → interpolate speed + tích phân partial
      const dt = realTime - prevTime;
      const t = dt / (pt.time - prevTime);
      const speedAtRealTime = prevSpeed + (pt.speed - prevSpeed) * t;
      sourceTime += dt * (prevSpeed + speedAtRealTime) / 2; // trapezoidal
      return sourceTime;
    }

    // Tích phân full segment (trapezoidal: average of 2 speeds × dt)
    const dt = pt.time - prevTime;
    sourceTime += dt * (prevSpeed + pt.speed) / 2;

    prevTime = pt.time;
    prevSpeed = pt.speed;
  }

  // realTime > last curve point → continue with last speed
  const remaining = realTime - prevTime;
  sourceTime += remaining * prevSpeed;

  return sourceTime;
}

