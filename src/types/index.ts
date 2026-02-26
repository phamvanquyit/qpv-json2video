/**
 * Position types cho elements
 */
export type PositionType =
  | 'center'
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'left'
  | 'right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

/**
 * Animation type cho elements
 *
 * Fade: fadeIn, fadeOut, fadeInOut
 * Slide: slideInLeft, slideInRight, slideInTop, slideInBottom,
 *        slideOutLeft, slideOutRight, slideOutTop, slideOutBottom
 * Zoom: zoomIn, zoomOut
 * Motion: bounce, pop, shake
 * Text-only: typewriter
 */
export type AnimationType =
  | 'fadeIn' | 'fadeOut' | 'fadeInOut'
  | 'slideInLeft' | 'slideInRight' | 'slideInTop' | 'slideInBottom'
  | 'slideOutLeft' | 'slideOutRight' | 'slideOutTop' | 'slideOutBottom'
  | 'zoomIn' | 'zoomOut'
  | 'bounce' | 'pop' | 'shake'
  | 'typewriter';

export interface ElementAnimation {
  /** Loại animation */
  type: AnimationType;
  /** Thời lượng animation vào (giây), mặc định 0.5 */
  fadeInDuration?: number;
  /** Thời lượng animation ra (giây), mặc định 0.5 */
  fadeOutDuration?: number;
}

/**
 * Easing function type
 * Dùng cho keyframe animation và preset animations
 */
export type EasingType =
  | 'linear'
  | 'easeIn' | 'easeOut' | 'easeInOut'
  | 'easeInCubic' | 'easeOutCubic' | 'easeInOutCubic'
  | 'easeInBack' | 'easeOutBack' | 'easeInOutBack'
  | 'easeOutBounce'
  | 'easeOutElastic'
  | 'spring';

/**
 * Keyframe — define một trạng thái tại thời điểm cụ thể.
 * Hệ thống sẽ interpolate giữa các keyframes.
 *
 * @example
 * ```json
 * { "time": 0, "opacity": 0, "scale": 0.5, "easing": "easeOutBack" }
 * { "time": 0.5, "opacity": 1, "scale": 1 }
 * { "time": 2, "offsetX": 200, "rotation": 360 }
 * ```
 */
export interface Keyframe {
  /** Thời điểm trong element timeline (giây), tính từ element start */
  time: number;
  /** Easing function cho transition TỪ keyframe trước TỚI keyframe này. Mặc định 'easeOutCubic' */
  easing?: EasingType;

  // --- Animatable properties ---
  /** Opacity 0-1 */
  opacity?: number;
  /** Scale factor */
  scale?: number;
  /** Rotation degrees */
  rotation?: number;
  /** X offset từ position gốc (px) */
  offsetX?: number;
  /** Y offset từ position gốc (px) */
  offsetY?: number;
}

/**
 * Shadow config cho elements
 */
export interface ShadowConfig {
  /** Màu shadow, ví dụ '#000000' hoặc 'rgba(0,0,0,0.5)' */
  color: string;
  /** Độ mờ shadow (px), mặc định 10 */
  blur: number;
  /** Offset X (px), mặc định 0 */
  offsetX: number;
  /** Offset Y (px), mặc định 0 */
  offsetY: number;
}

/**
 * Glow config cho text elements (hiệu ứng neon)
 */
export interface GlowConfig {
  /** Màu glow, ví dụ '#00FF88' */
  color: string;
  /** Độ mờ glow (px), mặc định 10 */
  blur: number;
}

/**
 * Gradient config cho fill
 */
export interface GradientConfig {
  /** Loại gradient */
  type: 'linear' | 'radial';
  /** Danh sách màu, ít nhất 2. Ví dụ: ['#FF0000', '#0000FF'] */
  colors: string[];
  /** Góc gradient (degrees), chỉ dùng cho linear. 0 = trái→phải, 90 = trên→dưới. Mặc định 0 */
  angle?: number;
}

/**
 * CSS-style visual filters cho elements
 * Dùng ctx.filter (Skia CSS filter support)
 *
 * @example
 * ```json
 * { "blur": 3, "brightness": 1.2, "contrast": 1.1, "grayscale": 0.5 }
 * ```
 */
export interface FilterConfig {
  /** Gaussian blur (px), mặc định 0 (không blur) */
  blur?: number;
  /** Độ sáng (0–2), mặc định 1. 0 = đen, 2 = sáng gấp đôi */
  brightness?: number;
  /** Độ tương phản (0–2), mặc định 1 */
  contrast?: number;
  /** Độ bão hòa (0–2), mặc định 1. 0 = xám hoàn toàn */
  saturate?: number;
  /** Xám hóa (0–1), mặc định 0. 1 = hoàn toàn xám */
  grayscale?: number;
  /** Hiệu ứng sepia (0–1), mặc định 0. 1 = sepia hoàn toàn */
  sepia?: number;
  /** Xoay màu (0–360°), mặc định 0 */
  hueRotate?: number;
  /** Đảo ngược màu (0–1), mặc định 0. 1 = đảo hoàn toàn */
  invert?: number;
}

/**
 * Blend mode cho element — dùng ctx.globalCompositeOperation
 * Maps trực tiếp sang Canvas 2D composite operations
 */
export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion';

/**
 * Vignette config — darkened edges on scene
 */
export interface VignetteConfig {
  /** Cường độ tối (0–1), mặc định 0.5 */
  intensity?: number;
  /** Kích thước vùng sáng ở giữa (0–1), mặc định 0.5. 0 = tối toàn bộ, 1 = không tối */
  size?: number;
  /** Màu vignette, mặc định '#000000' */
  color?: string;
}

/**
 * Color overlay — phủ màu semi-transparent lên scene
 */
export interface ColorOverlayConfig {
  /** Màu overlay, ví dụ 'rgba(255,0,0,0.3)' hoặc '#FF000050' */
  color: string;
  /** Blend mode cho overlay, mặc định 'normal' */
  blendMode?: BlendMode;
}

/**
 * Transition giữa các scenes
 *
 * fade: standard crossfade
 * slide: scene mới trượt vào từ 1 hướng
 * wipe: scene mới xuất hiện dần từ 1 hướng (clip mask)
 * zoom: scene cũ zoom in/out rồi biến mất
 */
export type TransitionType =
  | 'fade'
  | 'slideLeft' | 'slideRight' | 'slideUp' | 'slideDown'
  | 'wipeLeft' | 'wipeRight' | 'wipeUp' | 'wipeDown'
  | 'zoomIn' | 'zoomOut';

export interface SceneTransition {
  /** Loại transition */
  type: TransitionType;
  /** Thời lượng transition (giây) */
  duration: number;
}

/**
 * Base interface cho tất cả elements
 */
export interface ElementBase {
  position: PositionType;
  zIndex: number;
  borderRadius?: number;
  /** Thời điểm bắt đầu (giây) của element trong scene, mặc định 0 */
  start?: number;
  /** Thời lượng hiển thị (giây), mặc định = duration của scene */
  duration?: number;
  /** Offset X từ position (px) */
  offsetX?: number;
  /** Offset Y từ position (px) */
  offsetY?: number;
  /** Opacity 0-1, mặc định 1 */
  opacity?: number;
  /** Scale factor, mặc định 1. Ví dụ: 1.5 = phóng to 150% */
  scale?: number;
  /** Góc xoay (degrees), mặc định 0. Ví dụ: 45 = xoay 45° theo chiều kim đồng hồ */
  rotation?: number;
  /** Animation cho element (preset) */
  animation?: ElementAnimation;
  /**
   * Keyframe animation — animate bất kỳ property nào theo thời gian.
   * Khi có keyframes, sẽ OVERRIDE animation preset.
   * Thời gian trong keyframe tính từ element start.
   *
   * @example
   * ```json
   * "keyframes": [
   *   { "time": 0, "opacity": 0, "scale": 0.5 },
   *   { "time": 0.5, "opacity": 1, "scale": 1, "easing": "easeOutBack" },
   *   { "time": 3, "offsetX": 200, "rotation": 45 }
   * ]
   * ```
   */
  keyframes?: Keyframe[];
  /** Drop shadow cho element */
  shadow?: ShadowConfig;
  /** CSS-style visual filters (blur, brightness, contrast, saturate, grayscale, sepia, hueRotate, invert) */
  filters?: FilterConfig;
  /** Blend mode — cách element composite lên canvas. Mặc định 'normal' (source-over) */
  blendMode?: BlendMode;
}

/**
 * Rich text segment — mỗi segment có style riêng
 * Dùng trong richText array để tạo multi-style text
 */
export interface RichTextSegment {
  /** Nội dung text của segment */
  text: string;
  /** Màu text, mặc định kế thừa từ element */
  color?: string;
  /** Font size, mặc định kế thừa từ element */
  fontSize?: number;
  /** Font weight: 'bold', 700, 'normal', etc. Mặc định kế thừa từ element */
  fontWeight?: string | number;
  /** Font family, mặc định kế thừa từ element */
  fontFamily?: string;
  /** Italic, mặc định false */
  italic?: boolean;
  /** Underline, mặc định false */
  underline?: boolean;
  /** Màu nền cho segment (highlight), mặc định không có */
  bgColor?: string;
  /** Stroke color cho segment */
  strokeColor?: string;
  /** Stroke width cho segment */
  strokeWidth?: number;
}

/**
 * Text background shape type
 * - 'rectangle': hình chữ nhật (mặc định, giống bgColor hiện tại)
 * - 'pill': bo tròn 2 đầu (border-radius = height/2)
 * - 'banner': ribbon banner với mép cắt chéo
 * - 'speech-bubble': speech bubble với tail ở dưới
 */
export type TextBackgroundShape = 'rectangle' | 'pill' | 'banner' | 'speech-bubble';

/**
 * Counter/Timer config — hiệu ứng đếm số
 */
export interface CounterConfig {
  /** Số bắt đầu */
  from: number;
  /** Số kết thúc */
  to: number;
  /** Thời lượng đếm (giây), mặc định = element duration */
  duration?: number;
  /** Prefix hiển thị trước số, ví dụ '$' */
  prefix?: string;
  /** Suffix hiển thị sau số, ví dụ '%' hoặc 'K' */
  suffix?: string;
  /** Số chữ số thập phân, mặc định 0 */
  decimals?: number;
  /** Dùng separator (dấu phẩy) cho hàng nghìn, mặc định true */
  thousandSep?: boolean;
  /** Easing cho animation đếm, mặc định 'easeOutCubic' */
  easing?: EasingType;
}

/**
 * Text element
 */
export interface TextElement extends ElementBase {
  type: 'text';
  text: string;
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
  /** Glow effect (neon) — vẽ text nhiều lần với shadowBlur tăng dần */
  glow?: GlowConfig;
  /** Gradient fill cho text — thay thế solid color */
  gradient?: GradientConfig;

  // === Phase 6: Advanced Text ===

  /**
   * Rich text — mảng segments, mỗi segment có style riêng.
   * Khi có richText, field `text` sẽ bị bỏ qua.
   * @example
   * ```json
   * "richText": [
   *   { "text": "SALE ", "color": "#FF0000", "fontSize": 72 },
   *   { "text": "50% OFF", "color": "#FFD700", "fontSize": 96, "fontWeight": "bold" }
   * ]
   * ```
   */
  richText?: RichTextSegment[];

  /**
   * Background shape cho text box.
   * Mặc định 'rectangle' (giống bgColor hiện tại).
   */
  bgShape?: TextBackgroundShape;

  /**
   * Counter/timer animation — hiệu ứng đếm số.
   * Khi có counter, field `text` sẽ được override bằng giá trị đang đếm.
   * @example
   * ```json
   * "counter": { "from": 0, "to": 1000, "duration": 2, "prefix": "$" }
   * ```
   */
  counter?: CounterConfig;
}

/**
 * Image element
 */
export interface ImageElement extends ElementBase {
  type: 'image';
  url: string;
  width: number;
  height: number;
  fit?: 'cover' | 'contain' | 'fill';

  // === Phase 7: Image Enhancements ===

  /** Ken Burns effect — slow continuous pan+zoom trên ảnh tĩnh */
  kenBurns?: KenBurnsConfig;
}

/**
 * Ken Burns config — smooth continuous pan+zoom on static image
 * Tạo chuyển động camera mượt mà trên ảnh tĩnh
 *
 * @example
 * ```json
 * {
 *   "startX": 0, "startY": 0, "startZoom": 1.3,
 *   "endX": 100, "endY": 50, "endZoom": 1.0,
 *   "easing": "easeInOut"
 * }
 * ```
 */
export interface KenBurnsConfig {
  /** Vị trí X bắt đầu (% of image width, 0-100). 0 = trái, 50 = giữa, 100 = phải. Mặc định 50 */
  startX?: number;
  /** Vị trí Y bắt đầu (% of image height, 0-100). 0 = trên, 50 = giữa, 100 = dưới. Mặc định 50 */
  startY?: number;
  /** Zoom level bắt đầu. 1 = 100%, 1.5 = 150%. Mặc định 1.2 */
  startZoom?: number;
  /** Vị trí X kết thúc (% of image width, 0-100). Mặc định 50 */
  endX?: number;
  /** Vị trí Y kết thúc (% of image height, 0-100). Mặc định 50 */
  endY?: number;
  /** Zoom level kết thúc. Mặc định 1.0 */
  endZoom?: number;
  /** Easing function cho animation. Mặc định 'easeInOut' */
  easing?: EasingType;
}

/**
 * Video crop config — crop vùng hiển thị từ source video
 *
 * @example
 * ```json
 * { "x": 100, "y": 0, "width": 800, "height": 800 }
 * ```
 */
export interface VideoCropConfig {
  /** Tọa độ X bắt đầu crop (px) */
  x: number;
  /** Tọa độ Y bắt đầu crop (px) */
  y: number;
  /** Chiều rộng vùng crop (px) */
  width: number;
  /** Chiều cao vùng crop (px) */
  height: number;
}

/**
 * Speed curve point — định nghĩa tốc độ tại thời điểm cụ thể
 * Dùng cho speed ramping (tốc độ thay đổi trong clip)
 *
 * @example
 * ```json
 * [
 *   { "time": 0, "speed": 1 },
 *   { "time": 1, "speed": 0.3 },
 *   { "time": 3, "speed": 2 }
 * ]
 * ```
 */
export interface SpeedCurvePoint {
  /** Thời điểm trong clip (giây) */
  time: number;
  /** Tốc độ tại thời điểm này. 0.5 = slow-mo, 2 = fast forward */
  speed: number;
}

/**
 * Video element
 */
export interface VideoElement extends ElementBase {
  type: 'video';
  url: string;
  width: number;
  height: number;
  fit?: 'cover' | 'contain' | 'fill';
  loop?: boolean;
  volume?: number;
  /** Bắt đầu chạy video từ giây thứ N (trim đầu), mặc định 0 */
  trimStart?: number;
  /** Tốc độ phát video (constant). 0.5 = slow-mo, 2 = fast forward, mặc định 1 */
  speed?: number;

  // === Phase 7: Advanced Video Processing ===

  /** Crop vùng hiển thị từ source video (pixel coordinates) */
  crop?: VideoCropConfig;
  /** Phát video ngược, mặc định false */
  reverse?: boolean;
  /**
   * Freeze frame — dừng tại thời điểm cụ thể trong source video (giây).
   * Video sẽ hiển thị frame tại freezeAt trong suốt freezeDuration.
   */
  freezeAt?: number;
  /** Thời lượng freeze frame (giây). Chỉ có tác dụng khi có freezeAt. Mặc định = element duration */
  freezeDuration?: number;
  /**
   * Speed ramping — tốc độ thay đổi theo thời gian.
   * Khi có speedCurve, field `speed` sẽ bị bỏ qua.
   * Hệ thống interpolate linear giữa các điểm.
   *
   * @example
   * ```json
   * "speedCurve": [
   *   { "time": 0, "speed": 1 },
   *   { "time": 1, "speed": 0.3 },
   *   { "time": 3, "speed": 2 }
   * ]
   * ```
   */
  speedCurve?: SpeedCurvePoint[];
}

/**
 * Shape types
 */
export type ShapeType = 'rectangle' | 'circle' | 'ellipse' | 'line';

/**
 * Shape element (rectangle, circle, ellipse, line)
 */
export interface ShapeElement extends ElementBase {
  type: 'shape';
  /** Loại shape, mặc định 'rectangle' */
  shape?: ShapeType;
  /** Chiều rộng (px) — dùng cho rectangle/ellipse, hoặc đường kính cho circle */
  width: number;
  /** Chiều cao (px) — dùng cho rectangle/ellipse, hoặc đường kính cho circle */
  height: number;
  /** Màu nền, mặc định transparent */
  bgColor?: string;
  /** Màu viền (stroke), mặc định không có viền */
  strokeColor?: string;
  /** Độ dày viền (px), mặc định 2 */
  strokeWidth?: number;
  /** Gradient fill — thay thế bgColor khi được set */
  gradient?: GradientConfig;
  /**
   * Tọa độ đường line (chỉ dùng khi shape='line')
   * x1,y1 → x2,y2 tương đối so với vị trí element
   */
  linePoints?: { x1: number; y1: number; x2: number; y2: number };
}

/**
 * Word highlight style cho caption
 */
export type WordHighlightStyle = 'color' | 'background' | 'scale';

/**
 * Caption display mode
 * - 'sentence': hiển thị cả câu (mặc định)
 * - 'word': hiển thị từng từ một (giống CapCut)
 */
export type CaptionDisplayMode = 'sentence' | 'word';

/**
 * Caption element (subtitle)
 */
export interface CaptionElement extends ElementBase {
  type: 'caption';
  srtContent: string;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  strokeColor?: string;
  strokeWidth?: number;
  backgroundColor?: string;
  maxWidth?: string;
  lineHeight?: number;
  textAlign?: 'left' | 'center' | 'right';
  /** Chế độ hiển thị: 'sentence' (cả câu, mặc định) hoặc 'word' (từng từ một kiểu CapCut) */
  displayMode?: CaptionDisplayMode;
  /** Bật word-level highlight (karaoke-style), mặc định false. Chỉ dùng khi displayMode='sentence' */
  wordHighlight?: boolean;
  /** Màu highlight cho từ đang active, mặc định '#FFD700' (vàng) */
  highlightColor?: string;
  /** Màu nền highlight cho từ đang active (dùng khi highlightStyle='background') */
  highlightBgColor?: string;
  /** Kiểu highlight: 'color' (đổi màu), 'background' (thêm nền), 'scale' (phóng to), mặc định 'color' */
  highlightStyle?: WordHighlightStyle;
  /** Tỉ lệ phóng to cho từ active khi highlightStyle='scale', mặc định 1.15 */
  highlightScale?: number;
}

/**
 * Waveform visualization style
 * - 'bars': vertical bars (equalizer-style, mặc định)
 * - 'line': continuous smooth line
 * - 'mirror': mirrored bars (top + bottom, centered)
 * - 'circle': circular waveform (bars from center)
 */
export type WaveformStyle = 'bars' | 'line' | 'mirror' | 'circle';

/**
 * Waveform element — visualize audio waveform/spectrum animated
 * 
 * Hệ thống sẽ extract audio data từ audioUrl (dùng FFmpeg),
 * rồi render animated waveform theo style đã chọn.
 *
 * @example
 * ```json
 * {
 *   "type": "waveform",
 *   "audioUrl": "https://example.com/music.mp3",
 *   "style": "bars",
 *   "color": "#4ECDC4",
 *   "width": 800,
 *   "height": 200,
 *   "position": "bottom-center"
 * }
 * ```
 */
export interface WaveformElement extends ElementBase {
  type: 'waveform';
  /** URL tới audio file (http/https, file://, hoặc relative path) */
  audioUrl: string;
  /** Chiều rộng hiển thị (px) */
  width: number;
  /** Chiều cao hiển thị (px) */
  height: number;
  /** Kiểu waveform, mặc định 'bars' */
  style?: WaveformStyle;
  /** Màu chính của waveform, mặc định '#4ECDC4' */
  color?: string;
  /** Màu phụ (dùng cho fill area trong style 'line'), mặc định không có */
  secondaryColor?: string;
  /** Số thanh bar (cho style 'bars', 'mirror', 'circle'), mặc định 64 */
  barCount?: number;
  /** Chiều rộng mỗi bar (px), mặc định tự tính dựa trên width và barCount */
  barWidth?: number;
  /** Khoảng cách giữa các bar (px), mặc định 2 */
  barGap?: number;
  /** Border radius cho mỗi bar (px), mặc định 2 */
  barRadius?: number;
  /** Độ dày đường line (cho style 'line'), mặc định 2 */
  lineWidth?: number;
  /** Độ nhạy (amplifier), mặc định 1. Giá trị > 1 tăng biên độ, < 1 giảm biên độ */
  sensitivity?: number;
  /** Smoothing factor (0-1), mặc định 0.3. Cao = mượt mà hơn */
  smoothing?: number;
  /** Mirror mode (dùng cho style 'bars' → tự đổi thành 'mirror'), mặc định false */
  mirror?: boolean;
  /** Gradient cho waveform (thay thế solid color) */
  gradient?: GradientConfig;
}

export type SceneElement = TextElement | ImageElement | VideoElement | CaptionElement | ShapeElement | SvgElement | WaveformElement;

/**
 * SVG element — render SVG trực tiếp lên canvas
 *
 * Hỗ trợ 2 cách:
 * 1. Inline SVG string (svgContent)
 * 2. URL tới file .svg (url)
 *
 * @example
 * ```json
 * {
 *   "type": "svg",
 *   "svgContent": "<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><circle cx='100' cy='100' r='80' fill='red'/></svg>",
 *   "width": 200,
 *   "height": 200,
 *   "position": "center"
 * }
 * ```
 *
 * @example
 * ```json
 * {
 *   "type": "svg",
 *   "url": "https://example.com/icon.svg",
 *   "width": 300,
 *   "height": 300,
 *   "position": "center"
 * }
 * ```
 */
export interface SvgElement extends ElementBase {
  type: 'svg';
  /** Inline SVG string. Khi có svgContent, field `url` sẽ bị bỏ qua */
  svgContent?: string;
  /** URL tới file SVG (http/https). Dùng khi không có svgContent */
  url?: string;
  /** Chiều rộng hiển thị (px) */
  width: number;
  /** Chiều cao hiển thị (px) */
  height: number;
  /** Fit mode cho SVG, mặc định 'contain' (giữ tỷ lệ, không crop) */
  fit?: 'cover' | 'contain' | 'fill';
  /**
   * Override màu fill chính của SVG.
   * Hệ thống sẽ replace `fill="..."` và `fill:...` trong SVG string.
   * Hữu ích khi dùng SVG icon và muốn đổi màu.
   */
  fillColor?: string;
}

/**
 * Audio config
 */
export interface AudioConfig {
  url: string;
  /** Thời điểm bắt đầu audio trong scene (giây), mặc định 0 */
  start?: number;
  volume?: number;
  loop?: boolean;
  /** Thời lượng phát audio (giây), mặc định = toàn bộ file */
  duration?: number;
  /** Cắt audio từ vị trí này trong file gốc (giây), mặc định 0 */
  trimStart?: number;
  /** Cắt audio đến vị trí này trong file gốc (giây), mặc định = hết file */
  trimEnd?: number;
  /** Thời lượng fade in (giây), mặc định 0 */
  fadeIn?: number;
  /** Thời lượng fade out (giây), mặc định 0 */
  fadeOut?: number;
}


/**
 * Scene config
 */
export interface Scene {
  title?: string;
  duration: number;
  bgColor?: string;
  /** Gradient background — thay thế bgColor khi được set */
  bgGradient?: { colors: string[]; angle?: number };
  elements?: SceneElement[];
  /** Audio cho scene: single hoặc array để mix nhiều tracks (nhạc nền + sound effect) */
  audio?: AudioConfig | AudioConfig[];
  /** Transition vào scene (áp dụng ở đầu scene) */
  transition?: SceneTransition;
  /** Vignette — darkened edges cho scene */
  vignette?: VignetteConfig;
  /** Color overlay — phủ màu semi-transparent lên scene */
  colorOverlay?: ColorOverlayConfig;
}

/**
 * Track config - một "lane" trên timeline
 */
export interface Track {
  /** video = render visual, audio = chỉ mix audio */
  type: 'video' | 'audio';
  /** Track video nào có zIndex cao hơn → vẽ đè lên track thấp hơn */
  zIndex?: number;
  /** Thời điểm track bắt đầu trên timeline tổng (giây), mặc định 0 */
  start?: number;
  /** Scenes nối tiếp nhau trong track (giữ nguyên cấu trúc cũ) */
  scenes: Scene[];
}

/**
 * Video config (input chính) — multi-track format
 */
export interface VideoConfig {
  width: number;
  height: number;
  fps?: number;
  tracks: Track[];
}

/**
 * Asset đã được cache local
 */
export interface CachedAsset {
  url: string;
  localPath: string;
  type: 'image' | 'video' | 'audio' | 'font';
  buffer?: Buffer;
}

/**
 * Thông tin vị trí tính toán (pixel)
 */
export interface ComputedPosition {
  x: number;
  y: number;
}

/**
 * Render result
 */
export interface RenderResult {
  success: boolean;
  message: string;
  buffer: Buffer;
  fileName: string;
  /** Đường dẫn file output (chỉ có khi dùng json2videoFile) */
  filePath?: string;
}

/**
 * Render options
 */
export interface RenderOptions {
  /** Thư mục cache assets, mặc định: os.tmpdir()/json2video-assets */
  cacheDir?: string;
  /** Callback progress (0-100) */
  onProgress?: (progress: number) => void;
  /** Thư mục lưu file output tạm, mặc định: os.tmpdir()/json2video-output */
  outputDir?: string;
}
