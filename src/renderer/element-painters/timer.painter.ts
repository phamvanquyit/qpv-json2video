import type { SKRSContext2D as CanvasRenderingContext2D } from '@napi-rs/canvas';
import { TimerElement, TimerFormat } from '../../types';
import { computePosition, buildFontString, normalizeFontWeight, roundRectPath, createGradient, ElementAnimationState } from '../utils';

// ==================== TIMER FORMATTING ====================

/**
 * Pad number với leading zeros
 */
function pad(value: number, digits: number): string {
  return String(value).padStart(digits, '0');
}

/**
 * Format thời gian (giây) theo format string
 * Hỗ trợ: hh:mm:ss:SSS, hh:mm:ss, mm:ss:SSS, mm:ss, ss:SSS, ss
 */
function formatTime(totalSeconds: number, format: TimerFormat): string {
  // Clamp to non-negative
  const t = Math.max(0, totalSeconds);

  const hours = Math.floor(t / 3600);
  const minutes = Math.floor((t % 3600) / 60);
  const seconds = Math.floor(t % 60);
  const milliseconds = Math.floor((t % 1) * 1000);

  switch (format) {
    case 'hh:mm:ss:SSS':
      return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)}:${pad(milliseconds, 3)}`;
    case 'hh:mm:ss':
      return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)}`;
    case 'mm:ss:SSS':
      return `${pad(minutes + hours * 60, 2)}:${pad(seconds, 2)}:${pad(milliseconds, 3)}`;
    case 'mm:ss':
      return `${pad(minutes + hours * 60, 2)}:${pad(seconds, 2)}`;
    case 'ss:SSS':
      return `${pad(Math.floor(t), 2)}:${pad(milliseconds, 3)}`;
    case 'ss':
      return pad(Math.floor(t), 2);
    default:
      return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)}:${pad(milliseconds, 3)}`;
  }
}

// ==================== MAIN PAINT FUNCTION ====================

/**
 * Vẽ timer element lên canvas
 * Timer luôn đếm từ 0, tính từ element start time.
 * Hỗ trợ: glow, gradient fill, separator color, countDown
 */
export function paintTimer(
  ctx: CanvasRenderingContext2D,
  element: TimerElement,
  canvasWidth: number,
  canvasHeight: number,
  currentTime: number,
  sceneDuration: number,
  fps: number,
  animState?: ElementAnimationState
): void {
  const {
    format = 'hh:mm:ss:SSS',
    fontFamily = 'monospace',
    fontSize = 48,
    fontWeight = 700,
    color = '#FFFFFF',
    bgColor,
    position = 'center',
    textAlign = 'center',
    strokeColor = '#000000',
    strokeWidth = 0,
    padding = 10,
    offsetX = 0,
    offsetY = 0,
    borderRadius = 0,
    opacity = 1,
    glow,
    gradient,
    separatorColor,
    countDown = false,
    maxDuration,
  } = element;

  // Timer luôn đếm từ 0, tính từ khi element xuất hiện
  // Cộng thêm 1 frame duration (1/fps) để hiển thị thời gian tại CUỐI frame hiện tại
  // → frame cuối (7.967s) sẽ hiện 8.0s đúng với scene duration
  const elStart = element.start ?? 0;
  const frameDuration = 1 / fps;
  const elapsed = Math.max(0, currentTime - elStart + frameDuration);

  // Tính timer value
  let timerValue: number;
  if (countDown) {
    // Đếm ngược: từ maxDuration xuống 0
    const total = maxDuration ?? element.duration ?? sceneDuration;
    timerValue = Math.max(0, total - elapsed);
  } else {
    // Đếm xuôi: từ 0 lên
    timerValue = elapsed;
  }

  const text = formatTime(timerValue, format);

  const weight = normalizeFontWeight(fontWeight);
  ctx.font = buildFontString(weight, fontSize, fontFamily);

  // Measure text
  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const blockWidth = textWidth + padding * 2;
  const blockHeight = fontSize + padding * 2;

  // Vị trí
  const pos = computePosition(position, canvasWidth, canvasHeight, blockWidth, blockHeight, offsetX, offsetY);

  // Background
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

  // Vẽ text
  ctx.save();
  ctx.textBaseline = 'middle';

  if (opacity < 1) {
    ctx.globalAlpha = opacity;
  }

  // Gradient fill
  const gradientFill = gradient
    ? createGradient(ctx, gradient, pos.x, pos.y, blockWidth, blockHeight)
    : null;

  let lineX = pos.x + padding;
  const lineY = pos.y + padding + fontSize / 2;

  // Text align
  if (textAlign === 'center') {
    lineX = pos.x + padding + (textWidth - metrics.width) / 2;
  } else if (textAlign === 'right') {
    lineX = pos.x + padding + (textWidth - metrics.width);
  }

  // Glow effect
  if (glow) {
    ctx.save();
    ctx.shadowColor = glow.color;
    ctx.fillStyle = glow.color;
    const passes = [glow.blur * 0.3, glow.blur * 0.6, glow.blur];
    for (const blur of passes) {
      ctx.shadowBlur = blur;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.fillText(text, lineX, lineY);
    }
    ctx.restore();
  }

  // Stroke (outline)
  if (strokeWidth > 0) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth * 2;
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeText(text, lineX, lineY);
  }

  // Fill text — với separator color nếu có
  if (separatorColor) {
    // Render từng phần: số và dấu : riêng biệt
    const parts = text.split(/(:)/);
    let cursorX = lineX;
    for (const part of parts) {
      if (part === ':') {
        ctx.fillStyle = separatorColor;
      } else {
        ctx.fillStyle = gradientFill ? (gradientFill as unknown as string) : color;
      }
      ctx.fillText(part, cursorX, lineY);
      cursorX += ctx.measureText(part).width;
    }
  } else {
    ctx.fillStyle = gradientFill ? (gradientFill as unknown as string) : color;
    ctx.fillText(text, lineX, lineY);
  }

  ctx.restore();
}
