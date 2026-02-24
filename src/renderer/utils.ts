import { createCanvas } from '@napi-rs/canvas';
import type { SKRSContext2D as CanvasRenderingContext2D } from '@napi-rs/canvas';
import { ComputedPosition, ElementAnimation, GradientConfig, PositionType, SceneTransition } from '../types';

/**
 * UNICODE FALLBACK: @napi-rs/canvas (Skia) không tự động fallback font
 * như node-canvas (Pango). Cần thêm fallback fonts hỗ trợ Vietnamese/Unicode + Emoji.
 * "Apple Color Emoji" → macOS emoji, "Segoe UI Emoji" → Windows emoji
 * "Arial Unicode MS" → macOS full Unicode, "Arial" → Windows/Linux, sans-serif → final fallback
 */
const FONT_FALLBACK = ', "Arial Unicode MS", "Apple Color Emoji", "Segoe UI Emoji", Arial, sans-serif';

/**
 * Build CSS font string với automatic Unicode fallback
 * @example buildFontString(700, 48, 'Orbitron')
 * → '700 48px "Orbitron", "Arial Unicode MS", Arial, sans-serif'
 */
export function buildFontString(weight: number | string, fontSize: number, fontFamily: string): string {
  return `${weight} ${fontSize}px "${fontFamily}"${FONT_FALLBACK}`;
}

/**
 * Tính toán vị trí x, y cho element dựa trên position type
 */
export function computePosition(
  position: PositionType,
  canvasWidth: number,
  canvasHeight: number,
  elementWidth: number,
  elementHeight: number,
  offsetX = 0,
  offsetY = 0
): ComputedPosition {
  let x = 0;
  let y = 0;

  switch (position) {
    case 'center':
      x = (canvasWidth - elementWidth) / 2;
      y = (canvasHeight - elementHeight) / 2;
      break;
    case 'top-left':
      x = 0;
      y = 0;
      break;
    case 'top-center':
      x = (canvasWidth - elementWidth) / 2;
      y = 0;
      break;
    case 'top-right':
      x = canvasWidth - elementWidth;
      y = 0;
      break;
    case 'left':
      x = 0;
      y = (canvasHeight - elementHeight) / 2;
      break;
    case 'right':
      x = canvasWidth - elementWidth;
      y = (canvasHeight - elementHeight) / 2;
      break;
    case 'bottom-left':
      x = 0;
      y = canvasHeight - elementHeight;
      break;
    case 'bottom-center':
      x = (canvasWidth - elementWidth) / 2;
      y = canvasHeight - elementHeight;
      break;
    case 'bottom-right':
      x = canvasWidth - elementWidth;
      y = canvasHeight - elementHeight;
      break;
  }

  return {
    x: x + offsetX,
    y: y + offsetY,
  };
}

/**
 * Animation state cho 1 element tại thời điểm cụ thể.
 * Tất cả animations đều trả về state này.
 */
export interface ElementAnimationState {
  /** Opacity 0-1 */
  opacity: number;
  /** Translation X offset (px) — dùng cho slide animations */
  translateX: number;
  /** Translation Y offset (px) — dùng cho slide animations */
  translateY: number;
  /** Scale factor — dùng cho zoom/pop/bounce */
  scale: number;
}

// ==================== EASING FUNCTIONS ====================

/** Linear interpolation */
function easeLinear(t: number): number {
  return t;
}

/** Ease out cubic — decelerate */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Ease out back — overshoot rồi về */
function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/** Ease out bounce — nẩy */
function easeOutBounce(t: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) {
    return n1 * t * t;
  } else if (t < 2 / d1) {
    return n1 * (t -= 1.5 / d1) * t + 0.75;
  } else if (t < 2.5 / d1) {
    return n1 * (t -= 2.25 / d1) * t + 0.9375;
  } else {
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  }
}

/**
 * Tính animation state cho element — phiên bản đầy đủ.
 * Trả về opacity, translateX, translateY, scale.
 *
 * @param animation - Animation config
 * @param currentTime - Thời gian hiện tại trong scene (giây)
 * @param elementStart - Thời điểm element bắt đầu trong scene
 * @param elementDuration - Thời lượng hiển thị của element
 * @param sceneDuration - Tổng thời lượng scene
 * @param canvasWidth - Canvas width (px) — dùng cho slide distance
 * @param canvasHeight - Canvas height (px)
 */
export function computeElementAnimation(
  animation: ElementAnimation | undefined,
  currentTime: number,
  elementStart: number | undefined,
  elementDuration: number | undefined,
  sceneDuration: number,
  canvasWidth: number,
  canvasHeight: number
): ElementAnimationState {
  const state: ElementAnimationState = {
    opacity: 1,
    translateX: 0,
    translateY: 0,
    scale: 1,
  };

  if (!animation) return state;

  const elStart = elementStart ?? 0;
  const elDuration = elementDuration ?? (sceneDuration - elStart);
  const timeInElement = currentTime - elStart;
  const elEnd = elStart + elDuration;
  const timeToEnd = elEnd - currentTime;

  const inDur = animation.fadeInDuration ?? 0.5;
  const outDur = animation.fadeOutDuration ?? 0.5;

  switch (animation.type) {
    // ==================== FADE ====================
    case 'fadeIn': {
      if (timeInElement < inDur) {
        state.opacity = timeInElement / inDur;
      }
      break;
    }
    case 'fadeOut': {
      if (timeToEnd < outDur) {
        state.opacity = timeToEnd / outDur;
      }
      break;
    }
    case 'fadeInOut': {
      if (timeInElement < inDur) {
        state.opacity = timeInElement / inDur;
      } else if (timeToEnd < outDur) {
        state.opacity = timeToEnd / outDur;
      }
      break;
    }

    // ==================== SLIDE IN ====================
    case 'slideInLeft': {
      if (timeInElement < inDur) {
        const progress = easeOutCubic(timeInElement / inDur);
        state.translateX = -canvasWidth * (1 - progress);
        state.opacity = progress;
      }
      break;
    }
    case 'slideInRight': {
      if (timeInElement < inDur) {
        const progress = easeOutCubic(timeInElement / inDur);
        state.translateX = canvasWidth * (1 - progress);
        state.opacity = progress;
      }
      break;
    }
    case 'slideInTop': {
      if (timeInElement < inDur) {
        const progress = easeOutCubic(timeInElement / inDur);
        state.translateY = -canvasHeight * (1 - progress);
        state.opacity = progress;
      }
      break;
    }
    case 'slideInBottom': {
      if (timeInElement < inDur) {
        const progress = easeOutCubic(timeInElement / inDur);
        state.translateY = canvasHeight * (1 - progress);
        state.opacity = progress;
      }
      break;
    }

    // ==================== SLIDE OUT ====================
    case 'slideOutLeft': {
      if (timeToEnd < outDur) {
        const progress = easeOutCubic(1 - timeToEnd / outDur);
        state.translateX = -canvasWidth * progress;
        state.opacity = 1 - progress;
      }
      break;
    }
    case 'slideOutRight': {
      if (timeToEnd < outDur) {
        const progress = easeOutCubic(1 - timeToEnd / outDur);
        state.translateX = canvasWidth * progress;
        state.opacity = 1 - progress;
      }
      break;
    }
    case 'slideOutTop': {
      if (timeToEnd < outDur) {
        const progress = easeOutCubic(1 - timeToEnd / outDur);
        state.translateY = -canvasHeight * progress;
        state.opacity = 1 - progress;
      }
      break;
    }
    case 'slideOutBottom': {
      if (timeToEnd < outDur) {
        const progress = easeOutCubic(1 - timeToEnd / outDur);
        state.translateY = canvasHeight * progress;
        state.opacity = 1 - progress;
      }
      break;
    }

    // ==================== ZOOM ====================
    case 'zoomIn': {
      if (timeInElement < inDur) {
        const progress = easeOutCubic(timeInElement / inDur);
        state.scale = progress;
        state.opacity = progress;
      }
      break;
    }
    case 'zoomOut': {
      if (timeToEnd < outDur) {
        const progress = easeOutCubic(timeToEnd / outDur);
        state.scale = progress;
        state.opacity = progress;
      }
      break;
    }

    // ==================== MOTION ====================
    case 'bounce': {
      if (timeInElement < inDur) {
        const progress = easeOutBounce(timeInElement / inDur);
        // Rơi từ trên xuống, bounce tại vị trí cuối
        state.translateY = -canvasHeight * 0.3 * (1 - progress);
        state.opacity = Math.min(1, timeInElement / (inDur * 0.3));
      }
      break;
    }
    case 'pop': {
      if (timeInElement < inDur) {
        const progress = easeOutBack(timeInElement / inDur);
        // Scale từ 0 → overshoot ~1.2 → 1
        state.scale = progress;
        state.opacity = Math.min(1, timeInElement / (inDur * 0.3));
      }
      break;
    }
    case 'shake': {
      if (timeInElement < inDur) {
        // Shake: rung x qua lại, biên độ giảm dần
        const progress = timeInElement / inDur;
        const amplitude = 10 * (1 - progress); // biên độ giảm dần
        const frequency = 12; // ~12 lần rung trong duration
        state.translateX = amplitude * Math.sin(progress * frequency * Math.PI * 2);
      }
      break;
    }
    case 'typewriter': {
      // Typewriter — chỉ ảnh hưởng opacity/progress. Logic cắt text ở paintText.
      // Ở đây chỉ return progress (0→1) qua scale field (hack — sẽ được paintText sử dụng)
      if (timeInElement < inDur) {
        state.scale = timeInElement / inDur; // progress 0→1
      }
      // opacity luôn = 1 cho typewriter
      break;
    }
  }

  // Clamp opacity
  state.opacity = Math.max(0, Math.min(1, state.opacity));

  return state;
}

/**
 * Tính opacity thực tế của element dựa trên base opacity + animation.
 * Backward-compatible wrapper — dùng computeElementAnimation bên trong.
 * @param baseOpacity - Opacity gốc (0-1), mặc định 1
 * @param animation - Animation config
 * @param currentTime - Thời gian hiện tại trong scene (giây)
 * @param elementStart - Thời điểm element bắt đầu trong scene
 * @param elementDuration - Thời lượng hiển thị của element
 * @param sceneDuration - Tổng thời lượng scene
 */
export function computeElementOpacity(
  baseOpacity: number | undefined,
  animation: ElementAnimation | undefined,
  currentTime: number,
  elementStart: number | undefined,
  elementDuration: number | undefined,
  sceneDuration: number
): number {
  const opacity = baseOpacity ?? 1;
  if (!animation) return opacity;

  // Dùng computeElementAnimation để tính opacity từ animation
  const state = computeElementAnimation(
    animation, currentTime, elementStart, elementDuration, sceneDuration,
    1080, 1920 // default canvas size — chỉ cần cho slide distance, opacity không phụ thuộc
  );

  return Math.max(0, Math.min(1, opacity * state.opacity));
}

/**
 * Tính scene transition state.
 * Trả về tương tự ElementAnimationState để renderer áp dụng.
 */
export function computeSceneTransition(
  transition: SceneTransition | undefined,
  sceneTimeOffset: number,
  canvasWidth: number,
  canvasHeight: number
): ElementAnimationState {
  const state: ElementAnimationState = {
    opacity: 1,
    translateX: 0,
    translateY: 0,
    scale: 1,
  };

  if (!transition) return state;

  const { type, duration } = transition;
  if (sceneTimeOffset >= duration) return state;

  const progress = sceneTimeOffset / duration; // 0→1
  const eased = easeOutCubic(progress);

  switch (type) {
    case 'fade':
      state.opacity = progress;
      break;

    // Slide: scene mới trượt vào
    case 'slideLeft':
      state.translateX = canvasWidth * (1 - eased);
      break;
    case 'slideRight':
      state.translateX = -canvasWidth * (1 - eased);
      break;
    case 'slideUp':
      state.translateY = canvasHeight * (1 - eased);
      break;
    case 'slideDown':
      state.translateY = -canvasHeight * (1 - eased);
      break;

    // Wipe: clip mask di chuyển
    case 'wipeLeft':
      // Progress 0→1: clip từ phải sang trái
      // Dùng opacity thay vì actual clip vì canvas clip complex
      // Thực tế: reveal bằng cách vẽ scene mới chỉ phần đã wipe
      state.opacity = eased;
      state.translateX = canvasWidth * 0.1 * (1 - eased); // subtle shift
      break;
    case 'wipeRight':
      state.opacity = eased;
      state.translateX = -canvasWidth * 0.1 * (1 - eased);
      break;
    case 'wipeUp':
      state.opacity = eased;
      state.translateY = canvasHeight * 0.1 * (1 - eased);
      break;
    case 'wipeDown':
      state.opacity = eased;
      state.translateY = -canvasHeight * 0.1 * (1 - eased);
      break;

    // Zoom
    case 'zoomIn':
      state.scale = 0.5 + 0.5 * eased; // zoom từ 50% → 100%
      state.opacity = eased;
      break;
    case 'zoomOut':
      state.scale = 1.5 - 0.5 * eased; // zoom từ 150% → 100%
      state.opacity = eased;
      break;
  }

  return state;
}

/**
 * Kiểm tra element có visible ở thời điểm hiện tại không
 */
export function isElementVisible(currentTime: number, elementStart = 0, elementDuration?: number, sceneDuration?: number): boolean {
  const relativeTime = currentTime - elementStart;

  if (relativeTime < 0) return false;

  const effectiveDuration = elementDuration ?? sceneDuration;
  if (effectiveDuration !== undefined && relativeTime > effectiveDuration) {
    return false;
  }

  return true;
}

/**
 * Font weight name → number mapping (hoisted to module-level to avoid re-creation)
 */
const FONT_WEIGHT_MAP: Record<string, number> = {
  thin: 100,
  ultralight: 100,
  extralight: 200,
  light: 300,
  regular: 400,
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
  black: 900,
  heavy: 900,
};

/**
 * Normalize font weight string -> number
 */
export function normalizeFontWeight(weight: string | number): number {
  if (typeof weight === 'number') {
    return Math.min(Math.max(weight, 100), 900);
  }

  if (/^\d+$/.test(weight)) {
    return Math.min(Math.max(parseInt(weight, 10), 100), 900);
  }

  return FONT_WEIGHT_MAP[weight.toLowerCase().trim()] || 400;
}

/**
 * Wrap text để fit trong maxWidth (dùng canvas measureText)
 * Xử lý explicit \n trước, rồi word-wrap từng paragraph
 */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  // Split theo explicit newlines trước
  const paragraphs = text.split('\n');
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    // Paragraph rỗng → giữ dòng trống
    if (!paragraph.trim()) {
      lines.push('');
      continue;
    }

    const words = paragraph.split(' ');
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines.length > 0 ? lines : [''];
}

/**
 * Measure text dimensions (width, height) với word wrap
 *
 * OPTIMIZATION: Reuse 1 canvas singleton cho tất cả text measurement
 * Thay vì tạo createCanvas(1,1) mỗi lần gọi (tốn memory + GC)
 */
let measureCtx: CanvasRenderingContext2D | null = null;

export function measureTextBlock(
  text: string,
  fontSize: number,
  fontFamily: string,
  fontWeight: number,
  maxWidth: number,
  lineHeight: number
): { width: number; height: number; lines: string[] } {
  // Lazy-init measurement context (1 lần duy nhất)
  if (!measureCtx) {
    const measureCanvas = createCanvas(1, 1);
    measureCtx = measureCanvas.getContext('2d');
  }

  measureCtx.font = buildFontString(fontWeight, fontSize, fontFamily);

  const lines = wrapText(measureCtx, text, maxWidth);
  const lineHeightPx = fontSize * lineHeight;

  let maxLineWidth = 0;
  for (const line of lines) {
    const metrics = measureCtx.measureText(line);
    maxLineWidth = Math.max(maxLineWidth, metrics.width);
  }

  return {
    width: Math.ceil(maxLineWidth),
    // Dòng cuối chỉ cao fontSize (không cần lineHeight spacing phía dưới)
    // Trước: lines.length * lineHeightPx → padding bottom lớn hơn top
    // Sau:  (lines - 1) * lineHeightPx + fontSize → padding đều
    height: Math.ceil(lines.length === 1 ? fontSize : (lines.length - 1) * lineHeightPx + fontSize),
    lines,
  };
}

/**
 * Clear measurement context cache (gọi khi cleanup để tránh memory leak)
 */
export function clearMeasureCache(): void {
  measureCtx = null;
}

/**
 * Vẽ rounded rectangle path (shared utility)
 * Bao gồm beginPath + closePath
 */
export function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
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

/**
 * Tính source rect cho fit mode (cover/contain/fill) — shared utility
 */
export function calculateFitDraw(
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

  // Contain: sử dụng toàn bộ source
  return { sx: 0, sy: 0, sw: srcW, sh: srcH };
}

/**
 * Tạo CanvasGradient từ GradientConfig
 * @param ctx - Canvas context
 * @param config - Gradient config
 * @param x - Top-left X
 * @param y - Top-left Y
 * @param w - Width
 * @param h - Height
 */
/** Inferred gradient type from @napi-rs/canvas (CanvasGradient is not exported) */
type NativeGradient = ReturnType<CanvasRenderingContext2D['createLinearGradient']>;

export function createGradient(
  ctx: CanvasRenderingContext2D,
  config: GradientConfig,
  x: number,
  y: number,
  w: number,
  h: number
): NativeGradient {
  let gradient: NativeGradient;

  if (config.type === 'radial') {
    // Radial: từ tâm ra ngoài
    const cx = x + w / 2;
    const cy = y + h / 2;
    const radius = Math.sqrt(w * w + h * h) / 2;
    gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  } else {
    // Linear: theo góc (degrees)
    const angle = (config.angle ?? 0) * Math.PI / 180;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const halfDiag = Math.sqrt(w * w + h * h) / 2;
    const x0 = cx - halfDiag * Math.cos(angle);
    const y0 = cy - halfDiag * Math.sin(angle);
    const x1 = cx + halfDiag * Math.cos(angle);
    const y1 = cy + halfDiag * Math.sin(angle);
    gradient = ctx.createLinearGradient(x0, y0, x1, y1);
  }

  // Phân bố color stops đều
  const colors = config.colors;
  for (let i = 0; i < colors.length; i++) {
    gradient.addColorStop(i / (colors.length - 1), colors[i]);
  }

  return gradient;
}
