import { Image, loadImage as canvasLoadImage } from '@napi-rs/canvas';
import type { SKRSContext2D as CanvasRenderingContext2D } from '@napi-rs/canvas';
import { SvgElement } from '../../types';
import { AssetLoader } from '../asset-loader';
import { computePosition, calculateFitDraw, roundRectPath } from '../utils';

/**
 * Cache decoded SVG Image objects per content hash / URL
 * SVG decode khá nhanh nhưng cache vẫn tránh decode lặp mỗi frame
 */
const svgImageCache = new Map<string, Image>();

/**
 * Tạo cache key cho SVG element
 */
function getSvgCacheKey(element: SvgElement): string {
  if (element.svgContent) {
    // Dùng fillColor trong key vì content thay đổi khi fillColor thay đổi
    return `inline:${element.fillColor ?? ''}:${element.svgContent}`;
  }
  return `url:${element.fillColor ?? ''}:${element.url}`;
}

/**
 * Apply fillColor override cho SVG string
 * Replace fill="..." attributes và fill:... CSS properties
 */
function applySvgFillColor(svgContent: string, fillColor: string): string {
  // Replace fill="color" và fill='color' attributes
  // (nhưng không replace fill="none" / fill='none' / fill="url(...)" )
  let result = svgContent.replace(
    /fill=["'](?!none|url\()([^"']*)["']/gi,
    `fill="${fillColor}"`
  );

  // Replace fill:color trong style attributes
  result = result.replace(
    /fill:\s*(?!none|url\()([^;}"']+)/gi,
    `fill:${fillColor}`
  );

  return result;
}

/**
 * Inject/override width và height attribute vào root <svg> tag.
 * Đảm bảo Skia rasterize SVG ở đúng target resolution.
 *
 * Nếu SVG có viewBox="0 0 24 24" mà không có width/height,
 * Skia sẽ render ở 24×24px rồi scale lên → mờ.
 */
function ensureSvgSize(svgContent: string, width: number, height: number): string {
  // Replace hoặc inject width attribute
  if (/\<svg[^>]*\swidth\s*=/i.test(svgContent)) {
    svgContent = svgContent.replace(
      /(<svg[^>]*\s)width\s*=\s*["'][^"']*["']/i,
      `$1width="${width}"`
    );
  } else {
    svgContent = svgContent.replace(/(<svg)/i, `$1 width="${width}"`);
  }

  // Replace hoặc inject height attribute
  if (/\<svg[^>]*\sheight\s*=/i.test(svgContent)) {
    svgContent = svgContent.replace(
      /(<svg[^>]*\s)height\s*=\s*["'][^"']*["']/i,
      `$1height="${height}"`
    );
  } else {
    svgContent = svgContent.replace(/(<svg)/i, `$1 height="${height}"`);
  }

  return svgContent;
}

/**
 * Vẽ SVG element lên canvas
 *
 * @napi-rs/canvas (Skia) hỗ trợ render SVG trực tiếp qua loadImage(buffer).
 * Chúng ta chỉ cần convert SVG string → Buffer → Image → drawImage.
 *
 * Hỗ trợ:
 * - Inline SVG (svgContent)
 * - URL tới file .svg (url)
 * - fillColor override
 * - Fit modes (cover, contain, fill)
 * - Border radius, opacity
 */
export async function paintSvg(
  ctx: CanvasRenderingContext2D,
  element: SvgElement,
  canvasWidth: number,
  canvasHeight: number,
  assetLoader: AssetLoader
): Promise<void> {
  const {
    svgContent, url, width, height,
    position = 'center', fit = 'contain',
    offsetX = 0, offsetY = 0,
    borderRadius = 0, opacity = 1,
    fillColor,
  } = element;

  try {
    const cacheKey = getSvgCacheKey(element);
    let img = svgImageCache.get(cacheKey) ?? null;

    if (!img) {
      let svgString: string | null = null;

      if (svgContent) {
        // Inline SVG
        svgString = svgContent;
      } else if (url) {
        // Load SVG from URL
        const buffer = await assetLoader.loadImage(url);
        svgString = buffer.toString('utf-8');
      }

      if (!svgString) return;

      // Apply fillColor override if specified
      if (fillColor) {
        svgString = applySvgFillColor(svgString, fillColor);
      }

      // Inject width/height vào SVG tag để Skia rasterize ở đúng resolution
      // Nếu không, SVG viewBox="0 0 24 24" sẽ rasterize ở 24x24px rồi scale lên → mờ
      svgString = ensureSvgSize(svgString, width, height);

      // Convert SVG string → Buffer → Image
      const svgBuffer = Buffer.from(svgString, 'utf-8');
      img = await canvasLoadImage(svgBuffer);

      // Cache the decoded image
      svgImageCache.set(cacheKey, img);
    }

    const pos = computePosition(position, canvasWidth, canvasHeight, width, height, offsetX, offsetY);

    ctx.save();

    // Border radius clip
    if (borderRadius > 0) {
      roundRectPath(ctx, pos.x, pos.y, width, height, borderRadius);
      ctx.clip();
    }

    // Apply opacity
    if (opacity < 1) {
      ctx.globalAlpha = opacity;
    }

    // Fit mode
    const drawParams = calculateFitDraw(img.width, img.height, width, height, fit);
    ctx.drawImage(img, drawParams.sx, drawParams.sy, drawParams.sw, drawParams.sh, pos.x, pos.y, width, height);

    ctx.restore();
  } catch {
    // Nếu SVG load lỗi, vẽ placeholder
    ctx.save();
    ctx.fillStyle = '#222244';
    const pos = computePosition(position, canvasWidth, canvasHeight, width, height, offsetX, offsetY);
    ctx.fillRect(pos.x, pos.y, width, height);

    ctx.fillStyle = '#666688';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SVG Error', pos.x + width / 2, pos.y + height / 2);
    ctx.restore();
  }
}

/**
 * Clear SVG cache (gọi khi cleanup)
 */
export function clearSvgCache(): void {
  svgImageCache.clear();
}
