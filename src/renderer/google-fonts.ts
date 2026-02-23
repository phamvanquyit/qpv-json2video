import axios from 'axios';
import { GlobalFonts } from '@napi-rs/canvas';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Google Fonts loader
 * Tự động download .ttf từ Google Fonts API dựa trên font name
 */

// User-Agent đơn giản → Google Fonts trả về .ttf (TrueType) thay vì .woff2 hay .eot
const TTF_USER_AGENT = 'Wget/1.0';

interface ParsedFontFace {
  family: string;
  weight: string;
  style: string;
  url: string;
}

/**
 * Download và register Google Font
 * @param fontName - Tên font trên Google Fonts (e.g. "Roboto", "Inter", "Noto Sans")
 * @param cacheDir - Thư mục cache font files
 */
export async function loadGoogleFont(fontName: string, cacheDir?: string): Promise<void> {
  const fontsDir = cacheDir || path.join(os.tmpdir(), 'json2video-fonts');

  if (!fs.existsSync(fontsDir)) {
    fs.mkdirSync(fontsDir, { recursive: true });
  }

  // Encode tên font cho URL
  const encodedName = encodeURIComponent(fontName);

  // Request tất cả weights (100-900) + italic
  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodedName}:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,700`;

  try {
    // Fetch CSS từ Google Fonts (dùng User-Agent cũ để nhận .ttf)
    const response = await axios.get(cssUrl, {
      headers: { 'User-Agent': TTF_USER_AGENT },
      timeout: 30000,
    });

    const css = response.data as string;
    const fontFaces = parseCss(css, fontName);

    if (fontFaces.length === 0) {
      console.warn(`[json2video] Google Font "${fontName}" không tìm thấy font faces`);
      return;
    }

    // OPTIMIZATION: Download font faces song song (independent files)
    await Promise.all(fontFaces.map(face => downloadAndRegister(face, fontsDir)));
  } catch (error: any) {
    // Nếu request tất cả weights fail, thử chỉ weight 400 và 700
    try {
      const fallbackUrl = `https://fonts.googleapis.com/css2?family=${encodedName}:wght@400;700`;
      const response = await axios.get(fallbackUrl, {
        headers: { 'User-Agent': TTF_USER_AGENT },
        timeout: 30000,
      });

      const css = response.data as string;
      const fontFaces = parseCss(css, fontName);

      await Promise.all(fontFaces.map(face => downloadAndRegister(face, fontsDir)));
    } catch {
      console.warn(`[json2video] Không thể load Google Font "${fontName}": ${error.message}`);
    }
  }
}

/**
 * Parse CSS từ Google Fonts API → danh sách font faces
 */
function parseCss(css: string, fontName: string): ParsedFontFace[] {
  const faces: ParsedFontFace[] = [];

  // Match mỗi @font-face block
  const blocks = css.match(/@font-face\s*\{[^}]+\}/g);
  if (!blocks) return faces;

  for (const block of blocks) {
    // Extract font-weight
    const weightMatch = block.match(/font-weight:\s*(\d+)/);
    const weight = weightMatch ? weightMatch[1] : '400';

    // Extract font-style
    const styleMatch = block.match(/font-style:\s*(\w+)/);
    const style = styleMatch ? styleMatch[1] : 'normal';

    // Extract URL từ src: url(...)
    const urlMatch = block.match(/src:\s*url\(([^)]+)\)/);
    if (!urlMatch) continue;

    let url = urlMatch[1];
    // Remove quotes if present
    url = url.replace(/['"]/g, '').trim();

    faces.push({
      family: fontName,
      weight,
      style,
      url,
    });
  }

  return faces;
}

/**
 * Download font file và register với node-canvas
 */
async function downloadAndRegister(face: ParsedFontFace, fontsDir: string): Promise<void> {
  const hash = crypto.createHash('md5').update(face.url).digest('hex');
  // Luôn dùng .ttf vì UA cũ → Google trả về TrueType
  const localPath = path.join(fontsDir, `${face.family}_${face.weight}_${face.style}_${hash}.ttf`);

  // Download nếu chưa có
  if (!fs.existsSync(localPath)) {
    try {
      const response = await axios.get(face.url, {
        responseType: 'arraybuffer',
        timeout: 30000,
      });
      fs.writeFileSync(localPath, Buffer.from(response.data));
    } catch {
      return; // Skip nếu download fail
    }
  }

  // Register với @napi-rs/canvas GlobalFonts
  try {
    GlobalFonts.registerFromPath(localPath, face.family);
  } catch {
    // Có thể đã register rồi, ignore
  }
}
