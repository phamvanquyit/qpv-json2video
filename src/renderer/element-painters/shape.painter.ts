import type { SKRSContext2D as CanvasRenderingContext2D } from '@napi-rs/canvas';
import { ShapeElement } from '../../types';
import { computePosition, roundRectPath, createGradient } from '../utils';

/**
 * Vẽ shape element (rectangle) lên canvas
 * Hỗ trợ:
 * - Filled rectangle (có bgColor hoặc gradient)
 * - Stroke-only rectangle (có strokeColor, không bgColor) → dùng làm khung ảnh
 * - Cả hai (bgColor + strokeColor)
 * - Border radius
 * - Gradient fill (thay thế bgColor khi được set)
 */
export function paintShape(
  ctx: CanvasRenderingContext2D,
  element: ShapeElement,
  canvasWidth: number,
  canvasHeight: number
): void {
  const {
    width,
    height,
    position = 'center',
    bgColor,
    strokeColor,
    strokeWidth = 2,
    borderRadius = 0,
    offsetX = 0,
    offsetY = 0,
    opacity = 1,
    gradient,
  } = element;

  const pos = computePosition(position, canvasWidth, canvasHeight, width, height, offsetX, offsetY);

  ctx.save();

  // Apply opacity
  if (opacity < 1) {
    ctx.globalAlpha = opacity;
  }

  // Determine fill style: gradient > bgColor
  const fillStyle = gradient
    ? createGradient(ctx, gradient, pos.x, pos.y, width, height)
    : bgColor || null;

  if (borderRadius > 0) {
    // Rounded rectangle
    if (fillStyle) {
      roundRectPath(ctx, pos.x, pos.y, width, height, borderRadius);
      ctx.fillStyle = fillStyle as string;
      ctx.fill();
    }

    if (strokeColor) {
      // Stroke vẽ ở giữa đường viền → inset nửa strokeWidth để không bị tràn ra ngoài
      const halfStroke = strokeWidth / 2;
      roundRectPath(ctx, pos.x + halfStroke, pos.y + halfStroke, width - strokeWidth, height - strokeWidth, Math.max(0, borderRadius - halfStroke));
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.stroke();
    }
  } else {
    // Regular rectangle
    if (fillStyle) {
      ctx.fillStyle = fillStyle as string;
      ctx.fillRect(pos.x, pos.y, width, height);
    }

    if (strokeColor) {
      const halfStroke = strokeWidth / 2;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.strokeRect(pos.x + halfStroke, pos.y + halfStroke, width - strokeWidth, height - strokeWidth);
    }
  }

  ctx.restore();
}
