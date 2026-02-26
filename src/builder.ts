/**
 * Config Builder API — fluent builder pattern cho qpv-json2video
 *
 * Thay vì viết raw JSON config:
 * ```ts
 * const config = {
 *   width: 1080, height: 1920,
 *   tracks: [{ type: 'video', scenes: [{ duration: 5, ... }] }]
 * };
 * ```
 *
 * Dùng builder dễ đọc hơn:
 * ```ts
 * const scene = new SceneBuilder(5)
 *   .bgColor('#1a1a2e')
 *   .addText('Hello', { fontSize: 72 });
 *
 * const track = new TrackBuilder('video')
 *   .addScene(scene);
 *
 * const config = new VideoBuilder(1080, 1920)
 *   .addTrack(track)
 *   .build();
 * ```
 */

import type {
  AnimationType,
  AudioConfig,
  BlendMode,
  CaptionDisplayMode,
  CaptionElement,
  ColorOverlayConfig,
  CounterConfig,
  ElementAnimation,
  ElementBase,
  EasingType,
  FilterConfig,
  GlowConfig,
  GradientConfig,
  ImageElement,
  Keyframe,
  KenBurnsConfig,
  RichTextSegment,
  Scene,
  SceneElement,
  SceneTransition,
  ShadowConfig,
  ShapeElement,
  ShapeType,
  SpeedCurvePoint,
  SvgElement,
  TextBackgroundShape,
  TextElement,
  Track,
  TransitionType,
  VideoCropConfig,
  VideoConfig,
  VideoElement,
  VignetteConfig,
  WaveformElement,
  WaveformStyle,
  WordHighlightStyle,
} from './types';

// ──────────────────────────────────────────────
// Shared types cho element options
// ──────────────────────────────────────────────

/**
 * Common options cho tất cả elements (trừ type)
 * Partial of ElementBase — không bắt buộc gì cả
 */
export type ElementOptions = Partial<Omit<ElementBase, 'animation' | 'keyframes' | 'shadow' | 'filters' | 'blendMode'>> & {
  animation?: ElementAnimation | AnimationType;
  keyframes?: Keyframe[];
  shadow?: ShadowConfig;
  filters?: FilterConfig;
  blendMode?: BlendMode;
};

/** Options riêng cho TextElement (ngoài ElementBase) */
export type TextOptions = ElementOptions & {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string | number;
  color?: string;
  bgColor?: string;
  maxWidth?: number | string;
  textAlign?: 'left' | 'center' | 'right';
  strokeColor?: string;
  strokeWidth?: number;
  lineHeight?: number;
  padding?: number;
  glow?: GlowConfig;
  gradient?: GradientConfig;
  richText?: RichTextSegment[];
  bgShape?: TextBackgroundShape;
  counter?: CounterConfig;
};

/** Options riêng cho ImageElement */
export type ImageOptions = ElementOptions & {
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill';
  kenBurns?: KenBurnsConfig;
};

/** Options riêng cho VideoElement */
export type VideoOptions = ElementOptions & {
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill';
  loop?: boolean;
  volume?: number;
  trimStart?: number;
  speed?: number;
  crop?: VideoCropConfig;
  reverse?: boolean;
  freezeAt?: number;
  freezeDuration?: number;
  speedCurve?: SpeedCurvePoint[];
};

/** Options riêng cho ShapeElement */
export type ShapeOptions = ElementOptions & {
  shape?: ShapeType;
  width?: number;
  height?: number;
  bgColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  gradient?: GradientConfig;
  linePoints?: { x1: number; y1: number; x2: number; y2: number };
};

/** Options riêng cho CaptionElement */
export type CaptionOptions = ElementOptions & {
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  strokeColor?: string;
  strokeWidth?: number;
  backgroundColor?: string;
  maxWidth?: string;
  lineHeight?: number;
  textAlign?: 'left' | 'center' | 'right';
  displayMode?: CaptionDisplayMode;
  wordHighlight?: boolean;
  highlightColor?: string;
  highlightBgColor?: string;
  highlightStyle?: WordHighlightStyle;
  highlightScale?: number;
};

/** Options riêng cho SvgElement */
export type SvgOptions = ElementOptions & {
  svgContent?: string;
  url?: string;
  width?: number;
  height?: number;
  fit?: 'cover' | 'contain' | 'fill';
  fillColor?: string;
};

/** Options riêng cho WaveformElement */
export type WaveformOptions = ElementOptions & {
  width?: number;
  height?: number;
  style?: WaveformStyle;
  color?: string;
  secondaryColor?: string;
  barCount?: number;
  barWidth?: number;
  barGap?: number;
  barRadius?: number;
  lineWidth?: number;
  sensitivity?: number;
  smoothing?: number;
  mirror?: boolean;
  gradient?: GradientConfig;
};

// ──────────────────────────────────────────────
// Helper: normalize animation shorthand
// ──────────────────────────────────────────────

function normalizeAnimation(
  anim: ElementAnimation | AnimationType | undefined,
): ElementAnimation | undefined {
  if (!anim) return undefined;
  if (typeof anim === 'string') return { type: anim };
  return anim;
}

// ──────────────────────────────────────────────
// SceneBuilder
// ──────────────────────────────────────────────

/**
 * Builder cho Scene — tạo scene với fluent API
 *
 * @example
 * ```ts
 * const scene = new SceneBuilder(5)
 *   .bgColor('#1a1a2e')
 *   .transition('fade', 0.5)
 *   .addText('Hello World', {
 *     fontSize: 72,
 *     color: '#FFFFFF',
 *     position: 'center',
 *     animation: 'fadeIn',
 *   })
 *   .addImage('https://example.com/photo.jpg', {
 *     width: 400,
 *     height: 400,
 *     position: 'top-center',
 *   });
 * ```
 */
export class SceneBuilder {
  private _duration: number;
  private _title?: string;
  private _bgColor?: string;
  private _bgGradient?: { colors: string[]; angle?: number };
  private _elements: SceneElement[] = [];
  private _audio?: AudioConfig | AudioConfig[];
  private _transition?: SceneTransition;
  private _vignette?: VignetteConfig;
  private _colorOverlay?: ColorOverlayConfig;

  constructor(duration: number) {
    this._duration = duration;
  }

  /** Đặt title cho scene */
  title(title: string): this {
    this._title = title;
    return this;
  }

  /** Đặt background color */
  bgColor(color: string): this {
    this._bgColor = color;
    return this;
  }

  /** Đặt background gradient (thay thế bgColor) */
  bgGradient(colors: string[], angle?: number): this {
    this._bgGradient = { colors, angle };
    return this;
  }

  /** Đặt transition vào scene */
  transition(type: TransitionType, duration: number): this {
    this._transition = { type, duration };
    return this;
  }

  /** Đặt vignette effect */
  vignette(config: VignetteConfig): this {
    this._vignette = config;
    return this;
  }

  /** Đặt color overlay */
  colorOverlay(config: ColorOverlayConfig): this {
    this._colorOverlay = config;
    return this;
  }

  /** Thêm audio (gọi nhiều lần để mix nhiều audio tracks) */
  addAudio(config: AudioConfig): this {
    if (!this._audio) {
      this._audio = config;
    } else if (Array.isArray(this._audio)) {
      this._audio.push(config);
    } else {
      this._audio = [this._audio, config];
    }
    return this;
  }

  // ── Element adders ──

  /** Thêm text element */
  addText(text: string, options: TextOptions = {}): this {
    const { animation, ...rest } = options;
    const element: TextElement = {
      type: 'text',
      text,
      position: 'center',
      zIndex: this._elements.length + 1,
      ...rest,
      animation: normalizeAnimation(animation),
    };
    this._elements.push(element);
    return this;
  }

  /** Thêm image element */
  addImage(url: string, options: ImageOptions = {}): this {
    const { animation, ...rest } = options;
    const element: ImageElement = {
      type: 'image',
      url,
      width: rest.width ?? 400,
      height: rest.height ?? 400,
      position: 'center',
      zIndex: this._elements.length + 1,
      ...rest,
      animation: normalizeAnimation(animation),
    };
    this._elements.push(element);
    return this;
  }

  /** Thêm video element */
  addVideo(url: string, options: VideoOptions = {}): this {
    const { animation, ...rest } = options;
    const element: VideoElement = {
      type: 'video',
      url,
      width: rest.width ?? 1080,
      height: rest.height ?? 1920,
      position: 'center',
      zIndex: this._elements.length + 1,
      ...rest,
      animation: normalizeAnimation(animation),
    };
    this._elements.push(element);
    return this;
  }

  /** Thêm shape element */
  addShape(options: ShapeOptions = {}): this {
    const { animation, ...rest } = options;
    const element: ShapeElement = {
      type: 'shape',
      width: rest.width ?? 200,
      height: rest.height ?? 200,
      position: 'center',
      zIndex: this._elements.length + 1,
      ...rest,
      animation: normalizeAnimation(animation),
    };
    this._elements.push(element);
    return this;
  }

  /** Thêm caption (subtitle) element */
  addCaption(srtContent: string, options: CaptionOptions = {}): this {
    const { animation, ...rest } = options;
    const element: CaptionElement = {
      type: 'caption',
      srtContent,
      position: 'bottom-center',
      zIndex: this._elements.length + 1,
      ...rest,
      animation: normalizeAnimation(animation),
    };
    this._elements.push(element);
    return this;
  }

  /** Thêm element raw (bất kỳ SceneElement nào) */
  addElement(element: SceneElement): this {
    this._elements.push(element);
    return this;
  }

  /** Thêm SVG element (inline hoặc URL) */
  addSvg(options: SvgOptions = {}): this {
    const { animation, ...rest } = options;
    const element: SvgElement = {
      type: 'svg',
      width: rest.width ?? 200,
      height: rest.height ?? 200,
      position: 'center',
      zIndex: this._elements.length + 1,
      ...rest,
      animation: normalizeAnimation(animation),
    };
    this._elements.push(element);
    return this;
  }

  /** Thêm waveform element (audio visualization) */
  addWaveform(audioUrl: string, options: WaveformOptions = {}): this {
    const { animation, ...rest } = options;
    const element: WaveformElement = {
      type: 'waveform',
      audioUrl,
      width: rest.width ?? 800,
      height: rest.height ?? 200,
      position: 'center',
      zIndex: this._elements.length + 1,
      ...rest,
      animation: normalizeAnimation(animation),
    };
    this._elements.push(element);
    return this;
  }

  /** Build ra Scene object */
  build(): Scene {
    const scene: Scene = {
      duration: this._duration,
    };

    if (this._title) scene.title = this._title;
    if (this._bgColor) scene.bgColor = this._bgColor;
    if (this._bgGradient) scene.bgGradient = this._bgGradient;
    if (this._elements.length > 0) scene.elements = this._elements;
    if (this._audio) scene.audio = this._audio;
    if (this._transition) scene.transition = this._transition;
    if (this._vignette) scene.vignette = this._vignette;
    if (this._colorOverlay) scene.colorOverlay = this._colorOverlay;

    return scene;
  }
}

// ──────────────────────────────────────────────
// TrackBuilder
// ──────────────────────────────────────────────

/**
 * Builder cho Track — tạo track với fluent API
 *
 * @example
 * ```ts
 * const track = new TrackBuilder('video')
 *   .zIndex(1)
 *   .addScene(new SceneBuilder(5).bgColor('#000').addText('Hello'))
 *   .addScene(new SceneBuilder(3).bgColor('#111').addText('World'));
 * ```
 */
export class TrackBuilder {
  private _type: 'video' | 'audio';
  private _zIndex?: number;
  private _start?: number;
  private _scenes: Scene[] = [];

  constructor(type: 'video' | 'audio' = 'video') {
    this._type = type;
  }

  /** Đặt zIndex cho track (cao hơn = vẽ đè lên) */
  zIndex(value: number): this {
    this._zIndex = value;
    return this;
  }

  /** Đặt thời điểm bắt đầu track trên timeline tổng (giây) */
  start(value: number): this {
    this._start = value;
    return this;
  }

  /** Thêm scene vào track (từ SceneBuilder hoặc raw Scene object) */
  addScene(scene: SceneBuilder | Scene): this {
    if (scene instanceof SceneBuilder) {
      this._scenes.push(scene.build());
    } else {
      this._scenes.push(scene);
    }
    return this;
  }

  /** Build ra Track object */
  build(): Track {
    const track: Track = {
      type: this._type,
      scenes: this._scenes,
    };

    if (this._zIndex !== undefined) track.zIndex = this._zIndex;
    if (this._start !== undefined) track.start = this._start;

    return track;
  }
}

// ──────────────────────────────────────────────
// VideoBuilder
// ──────────────────────────────────────────────

/**
 * Builder chính — tạo VideoConfig
 *
 * @example
 * ```ts
 * const config = new VideoBuilder(1080, 1920)
 *   .fps(30)
 *   .addTrack(
 *     new TrackBuilder('video')
 *       .addScene(
 *         new SceneBuilder(5)
 *           .bgColor('#1a1a2e')
 *           .addText('Hello', { fontSize: 72, animation: 'fadeIn' })
 *       )
 *   )
 *   .build();
 *
 * // Render video
 * const result = await json2video(config);
 * ```
 */
export class VideoBuilder {
  private _width: number;
  private _height: number;
  private _fps?: number;
  private _tracks: Track[] = [];

  constructor(width: number, height: number) {
    this._width = width;
    this._height = height;
  }

  /** Đặt FPS (frames per second), mặc định theo engine */
  fps(value: number): this {
    this._fps = value;
    return this;
  }

  /** Thêm track (từ TrackBuilder hoặc raw Track object) */
  addTrack(track: TrackBuilder | Track): this {
    if (track instanceof TrackBuilder) {
      this._tracks.push(track.build());
    } else {
      this._tracks.push(track);
    }
    return this;
  }

  /** Build ra VideoConfig object (dùng làm input cho json2video) */
  build(): VideoConfig {
    if (this._tracks.length === 0) {
      throw new Error('VideoBuilder: cần ít nhất 1 track. Gọi .addTrack() trước .build()');
    }

    const config: VideoConfig = {
      width: this._width,
      height: this._height,
      tracks: this._tracks,
    };

    if (this._fps !== undefined) config.fps = this._fps;

    return config;
  }
}
