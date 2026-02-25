import axios from 'axios';
import { GlobalFonts } from '@napi-rs/canvas';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CachedAsset } from '../types';

/**
 * AssetLoader - Download và cache assets (images, videos, audio, fonts) vào local
 */
export class AssetLoader {
  private cache = new Map<string, CachedAsset>();
  private cacheDir: string;

  constructor(cacheDir?: string) {
    this.cacheDir = cacheDir || path.join(os.tmpdir(), 'json2video-assets');
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Download file từ URL về local, trả về local path
   * Hỗ trợ: http/https URLs, file:// URLs, và relative paths (./path)
   */
  async downloadAsset(url: string, type: CachedAsset['type']): Promise<CachedAsset> {
    // Check cache
    if (this.cache.has(url)) {
      return this.cache.get(url)!;
    }

    // Detect local file paths
    const localFilePath = this.resolveLocalPath(url);
    if (localFilePath) {
      return this.loadLocalFile(url, localFilePath, type);
    }

    const hash = crypto.createHash('md5').update(url).digest('hex');
    const ext = this.getExtension(url, type);
    const localPath = path.join(this.cacheDir, `${hash}${ext}`);

    // Check file đã download trước đó
    if (fs.existsSync(localPath)) {
      // OPTIMIZATION: Không đọc buffer eager cho images
      // loadImage() sẽ đọc lazy khi cần, tránh giữ buffer dư thừa trong cache
      const asset: CachedAsset = { url, localPath, type };
      this.cache.set(url, asset);
      return asset;
    }

    // Download
    try {
      const response = await axios({
        method: 'GET',
        url,
        responseType: 'arraybuffer',
        timeout: 120000, // 2 phút timeout
      });

      const buffer = Buffer.from(response.data);
      fs.writeFileSync(localPath, buffer);

      const asset: CachedAsset = { url, localPath, type, buffer };
      this.cache.set(url, asset);

      return asset;
    } catch (err: any) {
      // Wrap error với URL chi tiết để dễ debug
      const status = err?.response?.status;
      const statusText = err?.response?.statusText;
      const code = err?.code; // ECONNREFUSED, ENOTFOUND, ETIMEDOUT, etc.
      let detail = `Failed to download ${type}: ${url}`;
      if (status) {
        detail += ` — HTTP ${status} ${statusText || ''}`;
      } else if (code) {
        detail += ` — ${code}`;
      }
      if (err?.message && !err.message.includes(url)) {
        detail += ` (${err.message})`;
      }
      throw new Error(detail);
    }
  }

  /**
   * Resolve local file path từ URL
   * Trả về absolute path nếu là local file, null nếu là remote URL
   */
  private resolveLocalPath(url: string): string | null {
    // file:// protocol
    if (url.startsWith('file://')) {
      return url.replace('file://', '');
    }

    // Relative path: ./path hoặc ../path
    if (url.startsWith('./') || url.startsWith('../')) {
      return path.resolve(process.cwd(), url);
    }

    // Absolute path (Unix/Windows)
    if (url.startsWith('/') || /^[A-Za-z]:\\/.test(url)) {
      return url;
    }

    return null;
  }

  /**
   * Load local file thay vì download
   */
  private async loadLocalFile(originalUrl: string, filePath: string, type: CachedAsset['type']): Promise<CachedAsset> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Local file not found: ${filePath}`);
    }

    // Sử dụng file trực tiếp (không copy vào cache)
    const asset: CachedAsset = { url: originalUrl, localPath: filePath, type };
    this.cache.set(originalUrl, asset);
    return asset;
  }

  /**
   * Download image và trả về buffer (dùng cho canvas)
   */
  async loadImage(url: string): Promise<Buffer> {
    const asset = await this.downloadAsset(url, 'image');
    if (asset.buffer) {
      const buf = asset.buffer;
      // OPTIMIZATION: Clear buffer sau khi sử dụng — image.painter cache decoded Image riêng
      // Tránh giữ image buffer dư thừa trong memory
      asset.buffer = undefined;
      return buf;
    }
    return fs.readFileSync(asset.localPath);
  }

  /**
   * Download font và register với @napi-rs/canvas GlobalFonts
   */
  async loadFont(url: string, family: string, _weight?: number | string, _style?: string): Promise<void> {
    const asset = await this.downloadAsset(url, 'font');
    try {
      GlobalFonts.registerFromPath(asset.localPath, family);
    } catch {
      // Font may already be registered, ignore
    }
  }

  /**
   * Get extension từ URL
   */
  private getExtension(url: string, type: CachedAsset['type']): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const ext = path.extname(pathname);
      if (ext) return ext;
    } catch {
      // ignore
    }

    // Fallback theo type
    switch (type) {
      case 'image':
        return '.png';
      case 'video':
        return '.mp4';
      case 'audio':
        return '.mp3';
      case 'font':
        return '.ttf';
      default:
        return '.bin';
    }
  }

  /**
   * Xóa tất cả assets đã cache
   */
  cleanup(): void {
    for (const asset of this.cache.values()) {
      // Chỉ xóa files nằm trong cache dir (downloaded files)
      // KHÔNG xóa local files gốc của user
      if (asset.localPath.startsWith(this.cacheDir) && fs.existsSync(asset.localPath)) {
        try {
          fs.unlinkSync(asset.localPath);
        } catch {
          // ignore
        }
      }
    }
    this.cache.clear();
  }
}
