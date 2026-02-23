import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CanvasRenderer } from './renderer/canvas-renderer';
import { FFmpegEncoder } from './renderer/ffmpeg-encoder';
import { detectPlatform, getOptimalEncoder } from './renderer/platform';
import { RenderOptions, RenderResult, Scene, Track, VideoConfig } from './types';

// Re-export platform utilities for external use
export { detectPlatform, getOptimalEncoder } from './renderer/platform';
export type { EncoderConfig, PlatformType } from './renderer/platform';

/**
 * Generate video từ JSON config (multi-track format)
 *
 * Tự động detect OS và sử dụng GPU encoder nếu available:
 * - macOS: h264_videotoolbox (Apple GPU)
 * - Linux: h264_nvenc (NVIDIA) / h264_vaapi (Intel/AMD)
 * - Windows: h264_nvenc / h264_qsv
 * - Fallback: libx264 (CPU)
 *
 * @param videoConfig - Video configuration (JSON)
 * @param options - Render options
 * @returns RenderResult với buffer video MP4
 *
 * @example
 * ```ts
 * const result = await json2video({
 *   width: 1080, height: 1920, fps: 30,
 *   tracks: [
 *     { type: 'video', zIndex: 0, scenes: [{ duration: 5, bgColor: '#1a1a2e', elements: [...] }] },
 *     { type: 'video', zIndex: 1, start: 2, scenes: [{ duration: 3, elements: [...] }] },
 *     { type: 'audio', scenes: [{ duration: 10, audio: { url: 'https://...' } }] },
 *   ],
 * });
 * ```
 */
export async function json2video(videoConfig: any, options?: RenderOptions): Promise<RenderResult> {
  return _renderVideo(videoConfig, options);
}

/**
 * Generate video và lưu trực tiếp ra file
 * OPTIMIZATION: Render trực tiếp ra outputPath, không qua buffer trung gian
 *
 * @param videoConfig - Video configuration (JSON)
 * @param outputPath - Đường dẫn file output (.mp4)
 * @param options - Render options
 *
 * @example
 * ```ts
 * await json2videoFile(
 *   { width: 1080, height: 1920, tracks: [...] },
 *   './output.mp4'
 * );
 * ```
 */
export async function json2videoFile(videoConfig: any, outputPath: string, options?: RenderOptions): Promise<RenderResult> {
  // Ensure output directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return _renderVideo(videoConfig, options, outputPath);
}

/**
 * Core render pipeline — shared by json2video and json2videoFile
 *
 * OPTIMIZATIONS:
 * - Pipeline rendering: render frame N+1 while FFmpeg encodes frame N
 * - Direct file output: json2videoFile skips read-to-buffer-then-write
 * - Pre-computed frame size for progress calculation
 */
async function _renderVideo(videoConfig: any, options?: RenderOptions, directOutputPath?: string): Promise<RenderResult> {
  let renderer: CanvasRenderer | null = null;
  const onProgress = options?.onProgress;
  const outputDir = options?.outputDir || path.join(os.tmpdir(), 'json2video-output');

  try {
    // Validate
    if (!videoConfig) {
      throw new Error('videoConfig không được để trống');
    }

    if (!videoConfig.width || !videoConfig.height) {
      throw new Error('videoConfig phải có đủ width và height');
    }

    if (!videoConfig.tracks && !videoConfig.scenes) {
      throw new Error('videoConfig phải có tracks[]');
    }

    // Normalize config
    const config = normalizeConfig(videoConfig);

    validateVideoConfig(config);

    const fps = config.fps || 30;
    const nanoId = crypto.randomBytes(8).toString('hex');
    const fileName = `video_${nanoId}`;

    // Ensure output dir exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // === RENDER PIPELINE ===

    // Log platform & encoder info
    const platform = detectPlatform();
    const encoderInfo = getOptimalEncoder();
    console.log(`[json2video] Platform: ${platform}`);
    console.log(`[json2video] Encoder: ${encoderInfo.description}`);
    console.log(`[json2video] GPU Accelerated: ${encoderInfo.isHardwareAccelerated ? '✅ YES' : '❌ NO (CPU)'}`);

    // 1. Initialize renderer
    renderer = new CanvasRenderer(config, fps, options?.cacheDir);

    // 2. Preload tất cả assets
    onProgress?.(5);
    await renderer.preloadAssets();

    // 3. Setup FFmpeg encoder (auto-detect GPU)
    const videoOnlyPath = path.join(outputDir, `${nanoId}_video.mp4`);
    // Nếu có directOutputPath → dùng luôn, không cần temp file rồi copy
    const finalOutputPath = directOutputPath || path.join(outputDir, `${nanoId}.mp4`);

    const encoder = new FFmpegEncoder(config, fps);
    encoder.startEncoding(videoOnlyPath);

    // 4. PIPELINE RENDER: Render frame N+1 while FFmpeg encodes frame N
    //    Overlap compute (canvas render) với I/O (FFmpeg stdin write)
    const totalFrames = renderer.getTotalFrames();
    let lastLoggedProgress = -1;
    let pendingWrite: Promise<void> | null = null;

    for (let i = 0; i < totalFrames; i++) {
      const frameBuffer = await renderer.renderFrame(i);

      // Đợi write trước đó hoàn thành (nếu có) trước khi write tiếp
      // Trong lúc đợi, FFmpeg đang encode frame trước → overlap I/O
      if (pendingWrite) await pendingWrite;

      // Fire-and-forget write (không await ngay) → cho phép render frame tiếp
      pendingWrite = encoder.writeFrame(frameBuffer);

      // Progress: 10% - 80% cho frame rendering
      const renderProgress = 10 + Math.floor((i / totalFrames) * 70);
      if (renderProgress > lastLoggedProgress) {
        onProgress?.(renderProgress);
        lastLoggedProgress = renderProgress;
      }
    }

    // Đợi write cuối cùng
    if (pendingWrite) await pendingWrite;

    // 5. Kết thúc encoding
    await encoder.finishEncoding();
    onProgress?.(85);

    // 6. Mix audio
    const outputPath = await encoder.mixAudio(videoOnlyPath, finalOutputPath, renderer.getAssetLoader());
    onProgress?.(95);

    // 7. OPTIMIZATION: Chỉ đọc buffer khi cần (json2video)
    // json2videoFile đã ghi trực tiếp ra disk → không cần đọc lại
    let buffer: Buffer;
    if (directOutputPath) {
      // File đã ở disk → trả buffer rỗng, caller dùng filePath
      buffer = Buffer.alloc(0);
    } else {
      buffer = fs.readFileSync(outputPath);
      try {
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
      } catch {
        // ignore cleanup errors
      }
    }

    onProgress?.(100);

    return {
      success: true,
      message: 'Video đã được render thành công',
      buffer,
      fileName: `${fileName}.mp4`,
      ...(directOutputPath ? { filePath: directOutputPath } : {}),
    };
  } catch (error: any) {
    throw new Error(`Lỗi khi render video: ${error.message}`);
  } finally {
    // Cleanup
    if (renderer) {
      renderer.cleanup();
    }
  }
}

/**
 * Normalize scenes array
 */
function normalizeScenes(scenes: any[]): Scene[] {
  return scenes.map((scene: any) => ({
    ...scene,
    duration: Number(scene.duration),
    elements: scene.elements
      ? scene.elements.map((el: any) => ({
          ...el,
          width: Number(el.width || 0),
          height: Number(el.height || 0),
          zIndex: Number(el.zIndex || 0),
        }))
      : [],
  }));
}

/**
 * Normalize config: ensure tracks are properly typed
 * Internal: auto-convert scenes[] → tracks[] nếu cần
 */
function normalizeConfig(videoConfig: any): VideoConfig {
  let tracks: any[];

  if (videoConfig.tracks) {
    tracks = videoConfig.tracks.map((track: any) => ({
      ...track,
      type: track.type || 'video',
      zIndex: Number(track.zIndex || 0),
      start: Number(track.start || 0),
      scenes: normalizeScenes(track.scenes || []),
    }));
  } else if (videoConfig.scenes) {
    // Auto-convert legacy scenes → single video track
    tracks = [
      {
        type: 'video',
        zIndex: 0,
        start: 0,
        scenes: normalizeScenes(videoConfig.scenes),
      },
    ];
  } else {
    tracks = [];
  }

  return {
    width: Number(videoConfig.width),
    height: Number(videoConfig.height),
    fps: Number(videoConfig.fps) || 30,
    tracks,
  };
}

/**
 * Validate video config
 */
function validateVideoConfig(config: VideoConfig): void {
  if (!config.width || !config.height) {
    throw new Error('Video config phải có width và height');
  }

  if (config.tracks.length === 0) {
    throw new Error('Video config phải có ít nhất một track');
  }

  // Validate mỗi track
  config.tracks.forEach((track, trackIdx) => {
    if (!track.scenes || track.scenes.length === 0) {
      throw new Error(`Track ${trackIdx} phải có ít nhất một scene`);
    }

    track.scenes.forEach((scene, sceneIdx) => {
      if (!scene.duration || scene.duration <= 0) {
        throw new Error(`Scene ${sceneIdx} trong track ${trackIdx} phải có duration > 0`);
      }

      if (scene.elements) {
        scene.elements.forEach((element, elIdx) => {
          if (element.type === 'image' || element.type === 'video') {
            if (element.url && !element.url.startsWith('http://') && !element.url.startsWith('https://')) {
              throw new Error(`Element ${elIdx} trong scene ${sceneIdx}: URL phải bắt đầu bằng http:// hoặc https://`);
            }
          }
        });
      }

      if (scene.audio?.url) {
        if (!scene.audio.url.startsWith('http://') && !scene.audio.url.startsWith('https://')) {
          throw new Error(`Scene ${sceneIdx}: Audio URL phải bắt đầu bằng http:// hoặc https://`);
        }
      }
    });
  });
}
