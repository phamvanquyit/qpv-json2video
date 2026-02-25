import type { SKRSContext2D as CanvasRenderingContext2D } from '@napi-rs/canvas';
import { ShapeElement } from '../../types';
import { computePosition, roundRectPath, createGradient } from '../utils';

/**
 * Vẽ shape element (rectangle, circle, ellipse, line) lên canvas
 * Hỗ trợ:
 * - Filled shapes (có bgColor hoặc gradient)
 * - Stroke-only shapes (có strokeColor, không bgColor)
 * - Cả hai (bgColor + strokeColor)
 * - Border radius (cho rectangle)
 * - Gradient fill (thay thế bgColor khi được set)
 * - Circle: width = đường kính
 * - Ellipse: width = chiều rộng, height = chiều cao
 * - Line: dùng linePoints { x1, y1, x2, y2 }
 */
export function paintShape(
  ctx: CanvasRenderingContext2D,
  element: ShapeElement,
  canvasWidth: number,
  canvasHeight: number
): void {
  const {
    shape = 'rectangle',
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
    linePoints,
  } = element;

  ctx.save();

  // Apply opacity
  if (opacity < 1) {
    ctx.globalAlpha = opacity;
  }

  // Determine fill style: gradient > bgColor
  const pos = computePosition(position, canvasWidth, canvasHeight, width, height, offsetX, offsetY);
  const fillStyle = gradient
    ? createGradient(ctx, gradient, pos.x, pos.y, width, height)
    : bgColor || null;

  switch (shape) {
    case 'circle':
      paintCircle(ctx, pos.x, pos.y, width, height, fillStyle as string, strokeColor, strokeWidth);
      break;

    case 'ellipse':
      paintEllipse(ctx, pos.x, pos.y, width, height, fillStyle as string, strokeColor, strokeWidth);
      break;

    case 'line':
      paintLine(ctx, pos.x, pos.y, linePoints, strokeColor || '#FFFFFF', strokeWidth);
      break;

    case 'rectangle':
    default:
      paintRectangle(ctx, pos.x, pos.y, width, height, fillStyle as string, strokeColor, strokeWidth, borderRadius);
      break;
  }

  ctx.restore();
}

/**
 * Vẽ rectangle (với hoặc không có border radius)
 */
function paintRectangle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  fillStyle: string | null,
  strokeColor: string | undefined,
  strokeWidth: number,
  borderRadius: number
): void {
  if (borderRadius > 0) {
    if (fillStyle) {
      roundRectPath(ctx, x, y, width, height, borderRadius);
      ctx.fillStyle = fillStyle;
      ctx.fill();
    }

    if (strokeColor) {
      const halfStroke = strokeWidth / 2;
      roundRectPath(ctx, x + halfStroke, y + halfStroke, width - strokeWidth, height - strokeWidth, Math.max(0, borderRadius - halfStroke));
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.stroke();
    }
  } else {
    if (fillStyle) {
      ctx.fillStyle = fillStyle;
      ctx.fillRect(x, y, width, height);
    }

    if (strokeColor) {
      const halfStroke = strokeWidth / 2;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.strokeRect(x + halfStroke, y + halfStroke, width - strokeWidth, height - strokeWidth);
    }
  }
}

/**
 * Vẽ circle
 * width = đường kính (dùng như diameter)
 * Tâm = (x + width/2, y + height/2)
 */
function paintCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  fillStyle: string | null,
  strokeColor: string | undefined,
  strokeWidth: number
): void {
  const radius = Math.min(width, height) / 2;
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.closePath();

  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }

  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  }
}

/**
 * Vẽ ellipse
 * width = chiều rộng ellipse
 * height = chiều cao ellipse
 */
function paintEllipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  fillStyle: string | null,
  strokeColor: string | undefined,
  strokeWidth: number
): void {
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const radiusX = width / 2;
  const radiusY = height / 2;

  ctx.beginPath();
  ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.closePath();

  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }

  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  }
}

/**
 * Vẽ line
 * linePoints: { x1, y1, x2, y2 } tương đối so với vị trí element
 */
function paintLine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  linePoints: { x1: number; y1: number; x2: number; y2: number } | undefined,
  strokeColor: string,
  strokeWidth: number
): void {
  if (!linePoints) {
    return;
  }

  const { x1, y1, x2, y2 } = linePoints;

  ctx.beginPath();
  ctx.moveTo(x + x1, y + y1);
  ctx.lineTo(x + x2, y + y2);
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';
  ctx.stroke();
}
