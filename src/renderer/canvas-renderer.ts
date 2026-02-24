import { Canvas, createCanvas } from '@napi-rs/canvas';
import type { SKRSContext2D as CanvasRenderingContext2D } from '@napi-rs/canvas';
import { Scene, SceneElement, Track, VideoConfig, VideoElement } from '../types';
import { AssetLoader } from './asset-loader';
import { paintCaption, clearCaptionCaches } from './element-painters/caption.painter';
import { clearImageCache, paintImage } from './element-painters/image.painter';
import { paintShape } from './element-painters/shape.painter';
import { paintText } from './element-painters/text.painter';
import { paintVideoFrame, VideoFrameExtractor } from './element-painters/video.painter';
import { loadGoogleFont } from './google-fonts';
import {
  computeElementAnimation, computeSceneTransition,
  isElementVisible, clearMeasureCache,
  createGradient,
  ElementAnimationState,
} from './utils';

/**
 * CanvasRenderer - Core rendering engine (Optimized)
 * Vẽ từng frame video bằng node-canvas dựa trên VideoConfig
 * Hỗ trợ multi-track: composite nhiều video tracks theo zIndex
 *
 * Optimizations:
 * - Reuse canvas + context across frames (tránh tạo mới mỗi frame)
 * - Parallel asset preloading
 * - Pre-sort video tracks (tránh sort mỗi frame)
 * - Cache sorted elements per scene
 */
export class CanvasRenderer {
  private assetLoader: AssetLoader;
  private videoExtractors = new Map<string, VideoFrameExtractor>();

  // === OPTIMIZATION: Reuse canvas & context ===
  private canvas: Canvas;
  private ctx: CanvasRenderingContext2D;

  // === OPTIMIZATION: Pre-sorted video tracks (sort 1 lần, dùng lại mọi frame) ===
  private sortedVideoTracks: Track[] = [];
  private _preloadDone = false;

  // === OPTIMIZATION: Cache sorted elements per scene ===
  private sortedElementsCache = new Map<Scene, SceneElement[]>();

  // === OPTIMIZATION: Pre-computed scene time ranges per track ===
  // sceneTimeRanges[track] = [0, 5, 10, 15, ...] — cumulative start times
  // Dùng binary search thay vì linear scan mỗi frame
  private sceneTimeRanges = new Map<Track, number[]>();

  constructor(
    private readonly config: VideoConfig,
    private readonly fps: number,
    cacheDir?: string
  ) {
    this.assetLoader = new AssetLoader(cacheDir);

    // Tạo canvas 1 lần, reuse cho tất cả frames
    this.canvas = createCanvas(this.config.width, this.config.height);
    this.ctx = this.canvas.getContext('2d');
  }

  /**
   * Tính tổng số frames của video
   * = max(track.start + sum(scene.durations)) across all tracks
   */
  getTotalFrames(): number {
    let maxEndTime = 0;
    for (const track of this.config.tracks) {
      const trackStart = track.start || 0;
      const trackDuration = track.scenes.reduce((sum, s) => sum + s.duration, 0);
      const trackEnd = trackStart + trackDuration;
      maxEndTime = Math.max(maxEndTime, trackEnd);
    }

    return Math.ceil(maxEndTime * this.fps);
  }

  /**
   * Pre-load tất cả assets (images + video frames + audio) trước khi render
   * OPTIMIZATION: Download assets song song (parallel) thay vì tuần tự
   */
  async preloadAssets(): Promise<void> {
    const downloadPromises: Promise<void>[] = [];
    const videoElements: VideoElement[] = [];

    // Collect tất cả assets cần download
    for (const track of this.config.tracks) {
      for (const scene of track.scenes) {
        if (scene.elements) {
          for (const element of scene.elements) {
            switch (element.type) {
              case 'image':
                // Download images song song
                downloadPromises.push(
                  this.assetLoader.downloadAsset(element.url, 'image').then(() => undefined)
                );
                break;
              case 'video':
                // Collect video elements (cần xử lý tuần tự vì FFmpeg extract)
                videoElements.push(element);
                break;
            }
          }
        }

        // Download audio assets song song
        if (scene.audio?.url) {
          downloadPromises.push(
            this.assetLoader.downloadAsset(scene.audio.url, 'audio').then(() => undefined)
          );
        }
      }
    }

    // Download images + audio song song
    await Promise.all(downloadPromises);

    // Extract video frames (tuần tự vì mỗi cái dùng nhiều CPU)
    for (const element of videoElements) {
      await this.prepareVideoExtractor(element);
    }

    // Auto-detect và load Google Fonts từ elements
    await this.preloadGoogleFonts();

    // === PRE-COMPUTE: Sort video tracks 1 lần ===
    this.sortedVideoTracks = this.config.tracks
      .filter(t => t.type === 'video')
      .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
    this._preloadDone = true;

    // === PRE-COMPUTE: Sort elements per scene ===
    for (const track of this.config.tracks) {
      for (const scene of track.scenes) {
        if (scene.elements && scene.elements.length > 0) {
          const sorted = [...scene.elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
          this.sortedElementsCache.set(scene, sorted);
        }
      }
    }

    // === PRE-COMPUTE: Scene cumulative time ranges per track ===
    // Cho phép binary search O(log n) thay vì linear scan O(n) mỗi frame
    for (const track of this.config.tracks) {
      const startTimes: number[] = [];
      let cumulative = 0;
      for (const scene of track.scenes) {
        startTimes.push(cumulative);
        cumulative += scene.duration;
      }
      this.sceneTimeRanges.set(track, startTimes);
    }
  }

  /**
   * System fonts — không cần download
   */
  private static SYSTEM_FONTS = new Set([
    'sans-serif', 'serif', 'monospace', 'cursive', 'fantasy',
    'arial', 'helvetica', 'times new roman', 'times', 'courier',
    'courier new', 'verdana', 'georgia', 'palatino', 'garamond',
    'comic sans ms', 'impact', 'lucida console', 'tahoma', 'trebuchet ms',
  ]);

  /**
   * Scan tất cả elements → tìm fontFamily → auto-download từ Google Fonts
   */
  private async preloadGoogleFonts(): Promise<void> {
    const fontNames = new Set<string>();

    const scanScenes = (scenes: Scene[]) => {
      for (const scene of scenes) {
        if (!scene.elements) continue;
        for (const el of scene.elements) {
          if ((el.type === 'text' || el.type === 'caption') && el.fontFamily) {
            const name = el.fontFamily.trim();
            if (!CanvasRenderer.SYSTEM_FONTS.has(name.toLowerCase())) {
              fontNames.add(name);
            }
          }
        }
      }
    };

    // Scan tracks
    for (const track of this.config.tracks) {
      scanScenes(track.scenes);
    }

    // Download fonts song song
    const fontPromises = Array.from(fontNames).map(name =>
      loadGoogleFont(name, this.assetLoader['cacheDir'])
    );
    await Promise.all(fontPromises);
  }

  /**
   * Chuẩn bị VideoFrameExtractor cho video element
   */
  private async prepareVideoExtractor(element: VideoElement): Promise<void> {
    if (this.videoExtractors.has(element.url)) return;

    const asset = await this.assetLoader.downloadAsset(element.url, 'video');
    const extractor = new VideoFrameExtractor(asset.localPath, this.fps);
    await extractor.extractFrames();
    this.videoExtractors.set(element.url, extractor);
  }

  /**
   * Render 1 frame tại frameIndex (0-indexed)
   * Multi-track: composite tất cả video tracks theo zIndex
   * Returns: Buffer (raw RGBA pixels)
   *
   * OPTIMIZATION:
   * - Reuse canvas (không tạo mới mỗi frame)
   * - Dùng pre-sorted video tracks + elements
   * - Binary search cho scene lookup
   */
  async renderFrame(frameIndex: number): Promise<Buffer> {
    const ctx = this.ctx;
    const canvasW = this.config.width;
    const canvasH = this.config.height;

    // Thời gian hiện tại trên timeline (giây)
    const currentTime = frameIndex / this.fps;

    // Lazy init: nếu preloadAssets() chưa được gọi, tính sortedVideoTracks
    if (!this._preloadDone) {
      this.sortedVideoTracks = this.config.tracks
        .filter(t => t.type === 'video')
        .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
      this._preloadDone = true;
    }

    // Dùng pre-sorted video tracks (đã sort 1 lần ở preloadAssets)
    const videoTracks = this.sortedVideoTracks;

    // Clear canvas
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvasW, canvasH);

    let hasRenderedAnyTrack = false;

    for (const track of videoTracks) {
      const trackStart = track.start || 0;
      const timeInTrack = currentTime - trackStart;

      // Track chưa bắt đầu
      if (timeInTrack < 0) continue;

      // Tìm scene active trong track (binary search)
      const { scene, sceneTimeOffset } = this.getSceneInTrackAtTime(track, timeInTrack);
      if (!scene) continue; // Track đã kết thúc

      // Vẽ background cho scene (gradient hoặc solid color)
      if (!hasRenderedAnyTrack) {
        if (scene.bgGradient && scene.bgGradient.colors.length >= 2) {
          ctx.fillStyle = createGradient(ctx, { type: 'linear', colors: scene.bgGradient.colors, angle: scene.bgGradient.angle }, 0, 0, canvasW, canvasH) as unknown as string;
        } else {
          ctx.fillStyle = scene.bgColor || '#000000';
        }
        ctx.fillRect(0, 0, canvasW, canvasH);
        hasRenderedAnyTrack = true;
      } else if (scene.bgGradient && scene.bgGradient.colors.length >= 2) {
        ctx.fillStyle = createGradient(ctx, { type: 'linear', colors: scene.bgGradient.colors, angle: scene.bgGradient.angle }, 0, 0, canvasW, canvasH) as unknown as string;
        ctx.fillRect(0, 0, canvasW, canvasH);
      } else if (scene.bgColor) {
        ctx.fillStyle = scene.bgColor;
        ctx.fillRect(0, 0, canvasW, canvasH);
      }

      // Scene transition state
      const transState = computeSceneTransition(scene.transition, sceneTimeOffset, canvasW, canvasH);
      const hasSceneTransform = transState.opacity < 1 || transState.translateX !== 0 ||
        transState.translateY !== 0 || transState.scale !== 1;

      if (hasSceneTransform) {
        ctx.save();
        ctx.globalAlpha = transState.opacity;
        if (transState.translateX !== 0 || transState.translateY !== 0) {
          ctx.translate(transState.translateX, transState.translateY);
        }
        if (transState.scale !== 1) {
          const cx = canvasW / 2;
          const cy = canvasH / 2;
          ctx.translate(cx, cy);
          ctx.scale(transState.scale, transState.scale);
          ctx.translate(-cx, -cy);
        }
      }

      // Vẽ elements
      const sceneFrameOffset = Math.floor(sceneTimeOffset * this.fps);

      // Dùng cached sorted elements, hoặc tính lazy nếu chưa có
      let sortedElements = this.sortedElementsCache.get(scene);
      if (!sortedElements && scene.elements && scene.elements.length > 0) {
        sortedElements = [...scene.elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
        this.sortedElementsCache.set(scene, sortedElements);
      }

      if (sortedElements && sortedElements.length > 0) {
        for (const element of sortedElements) {
          if (!isElementVisible(sceneTimeOffset, element.start, element.duration, scene.duration)) {
            continue;
          }

          // Compute full animation state
          const animState = computeElementAnimation(
            element.animation, sceneTimeOffset,
            element.start, element.duration, scene.duration,
            canvasW, canvasH
          );

          // Compute effective opacity: base * animation * scene transition
          const baseOpacity = element.opacity ?? 1;
          const sceneAlpha = hasSceneTransform ? transState.opacity : 1;
          const effectiveOpacity = baseOpacity * animState.opacity * sceneAlpha;

          if (effectiveOpacity <= 0) continue;

          // Check if we need canvas transform
          const needsTransform = animState.translateX !== 0 || animState.translateY !== 0 ||
            animState.scale !== 1 || (element.scale && element.scale !== 1) ||
            (element.rotation && element.rotation !== 0);

          if (needsTransform) {
            ctx.save();

            // Apply animation translate
            if (animState.translateX !== 0 || animState.translateY !== 0) {
              ctx.translate(animState.translateX, animState.translateY);
            }

            // Apply element scale + animation scale at canvas center
            const elScale = (element.scale ?? 1) * animState.scale;
            const elRotation = element.rotation ?? 0;

            if (elScale !== 1 || elRotation !== 0) {
              // Scale/rotate around canvas center for simplicity
              const cx = canvasW / 2;
              const cy = canvasH / 2;
              ctx.translate(cx, cy);
              if (elScale !== 1) ctx.scale(elScale, elScale);
              if (elRotation !== 0) ctx.rotate((elRotation * Math.PI) / 180);
              ctx.translate(-cx, -cy);
            }
          }

          // Apply drop shadow nếu element có shadow config
          const shadow = element.shadow;
          if (shadow) {
            if (!needsTransform) ctx.save();
            ctx.shadowColor = shadow.color;
            ctx.shadowBlur = shadow.blur;
            ctx.shadowOffsetX = shadow.offsetX;
            ctx.shadowOffsetY = shadow.offsetY;
          }

          // Set opacity (without scene alpha double-counting if scene transform is active)
          ctx.globalAlpha = hasSceneTransform
            ? baseOpacity * animState.opacity  // scene alpha already applied via ctx.save
            : effectiveOpacity;

          await this.paintElement(ctx, element, sceneTimeOffset, scene.duration, sceneFrameOffset, animState);

          if (needsTransform || shadow) {
            ctx.restore();
          }

          // Restore alpha
          ctx.globalAlpha = 1;
        }
      }

      if (hasSceneTransform) {
        ctx.restore();
      }

      // Restore global alpha after scene
      ctx.globalAlpha = 1;
    }

    // OPTIMIZATION: canvas.data() trả về raw RGBA buffer trực tiếp từ Skia
    // Không cần encode/copy như toBuffer('raw') của node-canvas
    return Buffer.from(this.canvas.data());
  }

  /**
   * Vẽ 1 element lên canvas
   */
  private async paintElement(
    ctx: CanvasRenderingContext2D,
    element: SceneElement,
    currentTime: number,
    sceneDuration: number,
    sceneFrameOffset: number,
    animState?: ElementAnimationState
  ): Promise<void> {
    switch (element.type) {
      case 'text':
        paintText(ctx, element, this.config.width, this.config.height, currentTime, sceneDuration, animState);
        break;

      case 'image':
        await paintImage(ctx, element, this.config.width, this.config.height, this.assetLoader);
        break;

      case 'video': {
        const extractor = this.videoExtractors.get(element.url);
        if (extractor) {
          const elementStartFrame = Math.round((element.start || 0) * this.fps);
          const videoFrameIndex = sceneFrameOffset - elementStartFrame + 1;

          if (videoFrameIndex >= 1) {
            await paintVideoFrame(ctx, element, this.config.width, this.config.height, extractor, videoFrameIndex);
          }
        }
        break;
      }

      case 'caption':
        paintCaption(ctx, element, this.config.width, this.config.height, currentTime);
        break;

      case 'shape':
        paintShape(ctx, element, this.config.width, this.config.height);
        break;
    }
  }

  /**
   * Tìm scene active trong 1 track tại thời điểm timeInTrack (giây)
   * OPTIMIZATION: Dùng pre-computed sceneTimeRanges + binary search O(log n)
   */
  private getSceneInTrackAtTime(
    track: Track,
    timeInTrack: number
  ): { scene: Scene | null; sceneTimeOffset: number } {
    const startTimes = this.sceneTimeRanges.get(track);

    if (startTimes && startTimes.length > 0) {
      // Binary search: tìm scene cuối cùng có startTime <= timeInTrack
      let lo = 0;
      let hi = startTimes.length - 1;
      let result = -1;

      while (lo <= hi) {
        const mid = (lo + hi) >>> 1;
        if (startTimes[mid] <= timeInTrack) {
          result = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }

      if (result >= 0 && result < track.scenes.length) {
        const scene = track.scenes[result];
        const sceneStart = startTimes[result];
        const sceneEnd = sceneStart + scene.duration;

        if (timeInTrack < sceneEnd) {
          return {
            scene,
            sceneTimeOffset: timeInTrack - sceneStart,
          };
        }
      }

      return { scene: null, sceneTimeOffset: 0 };
    }

    // Fallback: linear scan (nếu sceneTimeRanges chưa được tính)
    let accumulatedTime = 0;

    for (const scene of track.scenes) {
      if (timeInTrack < accumulatedTime + scene.duration) {
        return {
          scene,
          sceneTimeOffset: timeInTrack - accumulatedTime,
        };
      }
      accumulatedTime += scene.duration;
    }

    return { scene: null, sceneTimeOffset: 0 };
  }


  /**
   * Lấy asset loader (để FFmpeg encoder lấy audio paths)
   */
  getAssetLoader(): AssetLoader {
    return this.assetLoader;
  }

  /**
   * Cleanup tất cả resources
   */
  cleanup(): void {
    this.assetLoader.cleanup();
    for (const extractor of this.videoExtractors.values()) {
      extractor.cleanup();
    }
    this.videoExtractors.clear();
    this.sortedElementsCache.clear();
    this.sceneTimeRanges.clear();
    clearImageCache();
    // OPTIMIZATION: Clear module-level caches để tránh memory leak trên long-running server
    clearCaptionCaches();
    clearMeasureCache();
  }
}
