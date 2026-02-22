import { CanvasRenderingContext2D, createCanvas } from 'canvas';
import { ComputedPosition, ElementAnimation, PositionType } from '../types';

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
 * Normalize font weight string -> number
 */
export function normalizeFontWeight(weight: string | number): number {
  const fontWeightMap: Record<string, number> = {
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

  if (typeof weight === 'number') {
    return Math.min(Math.max(weight, 100), 900);
  }

  if (/^\d+$/.test(weight)) {
    return Math.min(Math.max(parseInt(weight, 10), 100), 900);
  }

  return fontWeightMap[weight.toLowerCase().trim()] || 400;
}

/**
 * Wrap text để fit trong maxWidth (dùng canvas measureText)
 */
export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
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

  return lines.length > 0 ? lines : [''];
}

/**
 * Measure text dimensions (width, height) với word wrap
 */
export function measureTextBlock(
  text: string,
  fontSize: number,
  fontFamily: string,
  fontWeight: number,
  maxWidth: number,
  lineHeight: number
): { width: number; height: number; lines: string[] } {
  // Tạo canvas ẩn để measure text
  const measureCanvas = createCanvas(1, 1);
  const ctx = measureCanvas.getContext('2d');

  ctx.font = `${fontWeight} ${fontSize}px "${fontFamily}"`;

  const lines = wrapText(ctx, text, maxWidth);
  const lineHeightPx = fontSize * lineHeight;

  let maxLineWidth = 0;
  for (const line of lines) {
    const metrics = ctx.measureText(line);
    maxLineWidth = Math.max(maxLineWidth, metrics.width);
  }

  return {
    width: Math.ceil(maxLineWidth),
    height: Math.ceil(lines.length * lineHeightPx),
    lines,
  };
}
