import { createCanvas } from '@napi-rs/canvas';
import type { SKRSContext2D as CanvasRenderingContext2D } from '@napi-rs/canvas';
import { ComputedPosition, ElementAnimation, PositionType } from '../types';

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
 * Tính opacity thực tế của element dựa trên base opacity + animation
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

  const elStart = elementStart ?? 0;
  const elDuration = elementDuration ?? (sceneDuration - elStart);
  const timeInElement = currentTime - elStart;
  const elEnd = elStart + elDuration;
  const timeToEnd = elEnd - currentTime;

  let animOpacity = 1;

  switch (animation.type) {
    case 'fadeIn': {
      const dur = animation.fadeInDuration ?? 0.5;
      if (timeInElement < dur) {
        animOpacity = timeInElement / dur;
      }
      break;
    }
    case 'fadeOut': {
      const dur = animation.fadeOutDuration ?? 0.5;
      if (timeToEnd < dur) {
        animOpacity = timeToEnd / dur;
      }
      break;
    }
    case 'fadeInOut': {
      const fadeInDur = animation.fadeInDuration ?? 0.5;
      const fadeOutDur = animation.fadeOutDuration ?? 0.5;
      if (timeInElement < fadeInDur) {
        animOpacity = timeInElement / fadeInDur;
      } else if (timeToEnd < fadeOutDur) {
        animOpacity = timeToEnd / fadeOutDur;
      }
      break;
    }
  }

  return Math.max(0, Math.min(1, opacity * animOpacity));
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
