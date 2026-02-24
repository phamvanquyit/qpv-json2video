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
  /** Animation cho element */
  animation?: ElementAnimation;
  /** Drop shadow cho element */
  shadow?: ShadowConfig;
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
  /** Tốc độ phát video. 0.5 = slow-mo, 2 = fast forward, mặc định 1 */
  speed?: number;
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

export type SceneElement = TextElement | ImageElement | VideoElement | CaptionElement | ShapeElement;

/**
 * Audio config
 */
export interface AudioConfig {
  url: string;
  start?: number;
  volume?: number;
  loop?: boolean;
  duration?: number;
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
  audio?: AudioConfig;
  /** Transition vào scene (áp dụng ở đầu scene) */
  transition?: SceneTransition;
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
