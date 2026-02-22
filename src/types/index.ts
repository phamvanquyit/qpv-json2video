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
 */
export interface ElementAnimation {
  /** Loại animation */
  type: 'fadeIn' | 'fadeOut' | 'fadeInOut';
  /** Thời lượng fade in (giây) */
  fadeInDuration?: number;
  /** Thời lượng fade out (giây) */
  fadeOutDuration?: number;
}

/**
 * Transition giữa các scenes
 */
export interface SceneTransition {
  /** Loại transition */
  type: 'fade';
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
  /** Animation cho element */
  animation?: ElementAnimation;
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
}

/**
 * Word highlight style cho caption
 */
export type WordHighlightStyle = 'color' | 'background' | 'scale';

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
  /** Bật word-level highlight (karaoke-style), mặc định false */
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

export type SceneElement = TextElement | ImageElement | VideoElement | CaptionElement;

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
