import { CanvasRenderingContext2D, loadImage as canvasLoadImage } from 'canvas';
import { ImageElement } from '../../types';
import { AssetLoader } from '../asset-loader';
import { computePosition } from '../utils';

/**
 * Vẽ image element lên canvas
 */
export async function paintImage(
  ctx: CanvasRenderingContext2D,
  element: ImageElement,
  canvasWidth: number,
  canvasHeight: number,
  assetLoader: AssetLoader
): Promise<void> {
  const { url, width, height, position = 'center', fit = 'cover', offsetX = 0, offsetY = 0, borderRadius = 0, opacity = 1 } = element;

  try {
    const imgBuffer = await assetLoader.loadImage(url);
    const img = await canvasLoadImage(imgBuffer);

    const pos = computePosition(position, canvasWidth, canvasHeight, width, height, offsetX, offsetY);

    ctx.save();

    // Border radius clip
    if (borderRadius > 0) {
      ctx.beginPath();
      roundRectPath(ctx, pos.x, pos.y, width, height, borderRadius);
      ctx.clip();
    }

    // Apply opacity
    if (opacity < 1) {
      ctx.globalAlpha = opacity;
    }

    // Tính toán vị trí draw dựa trên fit mode
    const drawParams = calculateFitDraw(img.width, img.height, width, height, fit);

    ctx.drawImage(img, drawParams.sx, drawParams.sy, drawParams.sw, drawParams.sh, pos.x, pos.y, width, height);

    ctx.restore();
  } catch (error) {
    // Nếu load image lỗi, vẽ placeholder
    ctx.save();
    ctx.fillStyle = '#333333';
    const pos = computePosition(position, canvasWidth, canvasHeight, width, height, offsetX, offsetY);
    ctx.fillRect(pos.x, pos.y, width, height);

    ctx.fillStyle = '#666666';
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Image Error', pos.x + width / 2, pos.y + height / 2);
    ctx.restore();
  }
}

/**
 * Tính source rect cho fit mode (cover/contain/fill)
 */
function calculateFitDraw(
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
    // Cover: crop source để fill toàn bộ destination
    if (srcRatio > dstRatio) {
      // Source rộng hơn → crop width
      const sw = srcH * dstRatio;
      return { sx: (srcW - sw) / 2, sy: 0, sw, sh: srcH };
    } else {
      // Source cao hơn → crop height
      const sh = srcW / dstRatio;
      return { sx: 0, sy: (srcH - sh) / 2, sw: srcW, sh };
    }
  }

  // Contain: sử dụng toàn bộ source
  return { sx: 0, sy: 0, sw: srcW, sh: srcH };
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
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
