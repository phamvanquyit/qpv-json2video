import type { SKRSContext2D as CanvasRenderingContext2D } from '@napi-rs/canvas';
import { TextElement } from '../../types';
import { computePosition, buildFontString, measureTextBlock, normalizeFontWeight, roundRectPath, createGradient, ElementAnimationState } from '../utils';

/**
 * Vẽ text element lên canvas
 * Hỗ trợ: glow (neon effect), gradient fill, shadow (via canvas-renderer)
 * @param animState - Optional animation state (dùng cho typewriter effect)
 */
export function paintText(
  ctx: CanvasRenderingContext2D,
  element: TextElement,
  canvasWidth: number,
  canvasHeight: number,
  currentTime: number,
  sceneDuration: number,
  animState?: ElementAnimationState
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
    glow,
    gradient,
  } = element;

  const weight = normalizeFontWeight(fontWeight);
  ctx.font = buildFontString(weight, fontSize, fontFamily);

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
      roundRectPath(ctx, pos.x, pos.y, blockWidth, blockHeight, borderRadius);
      ctx.fill();
    } else {
      ctx.fillRect(pos.x, pos.y, blockWidth, blockHeight);
    }
    ctx.restore();
  }

  // Typewriter: tính số ký tự visible
  const isTypewriter = element.animation?.type === 'typewriter' && animState;
  let visibleChars = Infinity;
  if (isTypewriter) {
    const totalChars = text.length;
    visibleChars = Math.floor(animState.scale * totalChars); // scale = progress 0→1
  }

  // Vẽ text
  ctx.save();
  // ctx.font đã được set ở trên, không cần set lại
  // Dùng 'middle' baseline → text luôn centered trong line slot
  // Tránh vấn đề padding không đều với 'top' baseline
  ctx.textBaseline = 'middle';

  // Apply opacity
  if (opacity < 1) {
    ctx.globalAlpha = opacity;
  }

  // Prepare gradient fillStyle nếu có
  const gradientFill = gradient
    ? createGradient(ctx, gradient, pos.x, pos.y, blockWidth, blockHeight)
    : null;

  const lineHeightPx = fontSize * lineHeight;
  // OPTIMIZATION: Dùng lines từ measureTextBlock (đã wrapText bên trong)
  // Tránh gọi wrapText lần thứ 2 → tiết kiệm measureText calls
  const lines = textBlock.lines;

  let charsSoFar = 0;
  for (let i = 0; i < lines.length; i++) {
    let lineText = lines[i];

    // Typewriter: cắt text theo số ký tự visible
    if (isTypewriter) {
      if (charsSoFar >= visibleChars) break; // hết ký tự visible
      const remaining = visibleChars - charsSoFar;
      if (remaining < lineText.length) {
        lineText = lineText.substring(0, remaining);
      }
      charsSoFar += lines[i].length;
    }

    let lineX = pos.x + padding;
    // Vẽ text tại tâm dọc của mỗi line slot
    const lineY = pos.y + padding + i * lineHeightPx + fontSize / 2;

    // Text align — center/right trong block width thực tế
    if (textAlign === 'center') {
      const lineWidth = ctx.measureText(lines[i]).width;
      lineX = pos.x + padding + (textBlock.width - lineWidth) / 2;
    } else if (textAlign === 'right') {
      const lineWidth = ctx.measureText(lines[i]).width;
      lineX = pos.x + padding + (textBlock.width - lineWidth);
    }

    // Glow effect: vẽ text nhiều lần với shadowBlur tăng dần (neon)
    if (glow) {
      ctx.save();
      ctx.shadowColor = glow.color;
      ctx.fillStyle = glow.color;
      // Vẽ 3 lớp glow với blur tăng dần cho hiệu ứng neon mượt
      const passes = [glow.blur * 0.3, glow.blur * 0.6, glow.blur];
      for (const blur of passes) {
        ctx.shadowBlur = blur;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.fillText(lineText, lineX, lineY);
      }
      ctx.restore();
    }

    // Stroke (outline)
    if (strokeWidth > 0) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth * 2;
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.strokeText(lineText, lineX, lineY);
    }

    // Fill text — gradient hoặc solid color
    ctx.fillStyle = gradientFill ? (gradientFill as unknown as string) : color;
    ctx.fillText(lineText, lineX, lineY);
  }

  ctx.restore();
}
