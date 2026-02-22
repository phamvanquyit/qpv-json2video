import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CanvasRenderer } from './renderer/canvas-renderer';
import { FFmpegEncoder } from './renderer/ffmpeg-encoder';
import { RenderOptions, RenderResult, Scene, Track, VideoConfig } from './types';

/**
 * Generate video từ JSON config (multi-track format)
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

    // 1. Initialize renderer
    renderer = new CanvasRenderer(config, fps, options?.cacheDir);

    // 2. Preload tất cả assets
    onProgress?.(5);
    await renderer.preloadAssets();

    // 3. Setup FFmpeg encoder
    const videoOnlyPath = path.join(outputDir, `${nanoId}_video.mp4`);
    const finalOutputPath = path.join(outputDir, `${nanoId}.mp4`);

    const encoder = new FFmpegEncoder(config, fps);
    encoder.startEncoding(videoOnlyPath);

    // 4. Render từng frame → pipe vào FFmpeg
    const totalFrames = renderer.getTotalFrames();

    let lastLoggedProgress = -1;

    for (let i = 0; i < totalFrames; i++) {
      const frameBuffer = await renderer.renderFrame(i);
      await encoder.writeFrame(frameBuffer);

      // Progress: 10% - 80% cho frame rendering
      const renderProgress = 10 + Math.floor((i / totalFrames) * 70);
      if (renderProgress > lastLoggedProgress) {
        onProgress?.(renderProgress);
        lastLoggedProgress = renderProgress;
      }
    }

    // 5. Kết thúc encoding
    await encoder.finishEncoding();
    onProgress?.(85);

    // 6. Mix audio
    const outputPath = await encoder.mixAudio(videoOnlyPath, finalOutputPath, renderer.getAssetLoader());
    onProgress?.(95);

    // 7. Read file to buffer
    const buffer = fs.readFileSync(outputPath);

    // Cleanup temp file
    try {
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
    } catch {
      // ignore cleanup errors
    }

    onProgress?.(100);

    return {
      success: true,
      message: 'Video đã được render thành công',
      buffer,
      fileName: `${fileName}.mp4`,
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
 * Generate video và lưu trực tiếp ra file
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
  const result = await json2video(videoConfig, options);

  // Ensure output directory exists
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, result.buffer);

  return result;
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
