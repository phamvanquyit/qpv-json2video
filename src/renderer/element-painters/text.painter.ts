import { CanvasRenderingContext2D } from 'canvas';
import { TextElement } from '../../types';
import { computePosition, measureTextBlock, normalizeFontWeight, wrapText } from '../utils';

/**
 * Vẽ text element lên canvas
 */
export function paintText(
  ctx: CanvasRenderingContext2D,
  element: TextElement,
  canvasWidth: number,
  canvasHeight: number,
  currentTime: number,
  sceneDuration: number
): void {
  const {
    text,
    fontFamily = 'sans-serif',
    fontSize = 48,
    fontWeight = 400,
    color = '#FFFFFF',
    bgColor,
    position = 'center',
    textAlign = 'center',
    strokeColor = '#000000',
    strokeWidth = 0,
    lineHeight = 1.3,
    padding = 10,
    maxWidth,
    offsetX = 0,
    offsetY = 0,
    borderRadius = 0,
    opacity = 1,
  } = element;

  const weight = normalizeFontWeight(fontWeight);
  ctx.font = `${weight} ${fontSize}px "${fontFamily}"`;

  // Tính maxWidth thực tế
  let effectiveMaxWidth: number;
  if (typeof maxWidth === 'number') {
    effectiveMaxWidth = maxWidth;
  } else if (typeof maxWidth === 'string' && maxWidth.endsWith('%')) {
    effectiveMaxWidth = (parseFloat(maxWidth) / 100) * canvasWidth;
  } else {
    effectiveMaxWidth = canvasWidth * 0.9;
  }

  // Trừ padding
  const innerMaxWidth = effectiveMaxWidth - padding * 2;

  // Word wrap
  const textBlock = measureTextBlock(text, fontSize, fontFamily, weight, innerMaxWidth, lineHeight);

  const blockWidth = textBlock.width + padding * 2;
  const blockHeight = textBlock.height + padding * 2;

  // Vị trí
  const pos = computePosition(position, canvasWidth, canvasHeight, blockWidth, blockHeight, offsetX, offsetY);

  // Vẽ background nếu có
  if (bgColor && bgColor !== 'transparent') {
    ctx.save();
    ctx.fillStyle = bgColor;
    if (borderRadius > 0) {
      roundRect(ctx, pos.x, pos.y, blockWidth, blockHeight, borderRadius);
      ctx.fill();
    } else {
      ctx.fillRect(pos.x, pos.y, blockWidth, blockHeight);
    }
    ctx.restore();
  }

  // Vẽ text
  ctx.save();
  ctx.font = `${weight} ${fontSize}px "${fontFamily}"`;
  ctx.textBaseline = 'top';

  // Apply opacity
  if (opacity < 1) {
    ctx.globalAlpha = opacity;
  }

  const lineHeightPx = fontSize * lineHeight;
  const lines = wrapText(ctx, text, innerMaxWidth);

  for (let i = 0; i < lines.length; i++) {
    let lineX = pos.x + padding;
    const lineY = pos.y + padding + i * lineHeightPx;

    // Text align — center/right trong block width thực tế
    if (textAlign === 'center') {
      const lineWidth = ctx.measureText(lines[i]).width;
      lineX = pos.x + padding + (textBlock.width - lineWidth) / 2;
    } else if (textAlign === 'right') {
      const lineWidth = ctx.measureText(lines[i]).width;
      lineX = pos.x + padding + (textBlock.width - lineWidth);
    }

    // Stroke (outline)
    if (strokeWidth > 0) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth * 2;
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.strokeText(lines[i], lineX, lineY);
    }

    // Fill text
    ctx.fillStyle = color;
    ctx.fillText(lines[i], lineX, lineY);
  }

  ctx.restore();
}

/**
 * Vẽ rounded rectangle
 */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
