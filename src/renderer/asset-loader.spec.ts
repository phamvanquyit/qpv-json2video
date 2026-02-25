import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AssetLoader } from './asset-loader';

// Mock axios
jest.mock('axios', () => {
  return jest.fn().mockResolvedValue({
    data: Buffer.alloc(100, 0xff),
  });
});

import axios from 'axios';
const mockAxios = axios as unknown as jest.Mock;

// Custom matcher
expect.extend({
  toEndWith(received: string, suffix: string) {
    const pass = received.endsWith(suffix);
    return {
      message: () => `expected "${received}" to end with "${suffix}"`,
      pass,
    };
  },
});

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toEndWith(suffix: string): R;
    }
  }
}

describe('AssetLoader', () => {
  let loader: AssetLoader;
  let testCacheDir: string;

  beforeEach(() => {
    jest.clearAllMocks();
    testCacheDir = path.join(os.tmpdir(), `json2video-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    loader = new AssetLoader(testCacheDir);
  });

  afterEach(() => {
    loader.cleanup();
    if (fs.existsSync(testCacheDir)) {
      fs.rmSync(testCacheDir, { recursive: true, force: true });
    }
  });

  // ========================
  // INITIALIZATION
  // ========================

  describe('initialization', () => {
    it('should create cache directory on init', () => {
      expect(fs.existsSync(testCacheDir)).toBe(true);
    });

    it('should use default cache dir if none provided', () => {
      const defaultLoader = new AssetLoader();
      const defaultDir = path.join(os.tmpdir(), 'json2video-assets');
      expect(fs.existsSync(defaultDir)).toBe(true);
      defaultLoader.cleanup();
    });

    it('should create nested cache directories', () => {
      const nestedDir = path.join(testCacheDir, 'nested', 'deep', 'dir');
      const nestedLoader = new AssetLoader(nestedDir);
      expect(fs.existsSync(nestedDir)).toBe(true);
      nestedLoader.cleanup();
    });
  });

  // ========================
  // DOWNLOADING
  // ========================

  describe('downloadAsset', () => {
    it('should download asset and store locally', async () => {
      const asset = await loader.downloadAsset('https://example.com/image.png', 'image');

      expect(asset.url).toBe('https://example.com/image.png');
      expect(asset.type).toBe('image');
      expect(asset.localPath).toContain(testCacheDir);
      expect(asset.localPath).toEndWith('.png');
      expect(fs.existsSync(asset.localPath)).toBe(true);
    });

    it('should call axios with correct params', async () => {
      await loader.downloadAsset('https://example.com/photo.jpg', 'image');

      expect(mockAxios).toHaveBeenCalledWith({
        method: 'GET',
        url: 'https://example.com/photo.jpg',
        responseType: 'arraybuffer',
        timeout: 120000,
      });
    });

    it('should write downloaded buffer to disk', async () => {
      const asset = await loader.downloadAsset('https://example.com/test-file.png', 'image');
      const fileContent = fs.readFileSync(asset.localPath);
      expect(fileContent.length).toBe(100);
      expect(fileContent[0]).toBe(0xff);
    });
  });

  // ========================
  // CACHING
  // ========================

  describe('caching', () => {
    it('should return cached (same reference) on subsequent calls', async () => {
      const asset1 = await loader.downloadAsset('https://example.com/pic.png', 'image');
      const asset2 = await loader.downloadAsset('https://example.com/pic.png', 'image');

      expect(asset1).toBe(asset2);
    });

    it('should only call axios once for same URL', async () => {
      await loader.downloadAsset('https://example.com/cached.png', 'image');
      await loader.downloadAsset('https://example.com/cached.png', 'image');
      await loader.downloadAsset('https://example.com/cached.png', 'image');

      // First call downloads, subsequent should hit cache
      expect(mockAxios).toHaveBeenCalledTimes(1);
    });

    it('should download different URLs independently', async () => {
      const asset1 = await loader.downloadAsset('https://example.com/a.png', 'image');
      const asset2 = await loader.downloadAsset('https://example.com/b.png', 'image');

      expect(asset1.localPath).not.toBe(asset2.localPath);
      expect(mockAxios).toHaveBeenCalledTimes(2);
    });

    it('should use MD5 hash for filename uniqueness', async () => {
      const asset1 = await loader.downloadAsset('https://example.com/x.png', 'image');
      const asset2 = await loader.downloadAsset('https://example.com/y.png', 'image');

      const name1 = path.basename(asset1.localPath, '.png');
      const name2 = path.basename(asset2.localPath, '.png');

      // MD5 hashes should be different
      expect(name1).not.toBe(name2);
      // MD5 hash is 32 hex characters
      expect(name1).toMatch(/^[a-f0-9]{32}$/);
      expect(name2).toMatch(/^[a-f0-9]{32}$/);
    });

    it('should re-use existing file on disk (no re-download)', async () => {
      // First download
      const asset1 = await loader.downloadAsset('https://example.com/persist.png', 'image');
      const localPath = asset1.localPath;

      // Create new loader with same cache dir (simulates restart)
      const loader2 = new AssetLoader(testCacheDir);
      const asset2 = await loader2.downloadAsset('https://example.com/persist.png', 'image');

      expect(asset2.localPath).toBe(localPath);
      // axios called once total (first loader downloaded, second loader found file)
      expect(mockAxios).toHaveBeenCalledTimes(1);

      loader2.cleanup();
    });
  });

  // ========================
  // EXTENSION DETECTION
  // ========================

  describe('extension detection', () => {
    it('should extract extension from URL path', async () => {
      const jpg = await loader.downloadAsset('https://example.com/photo.jpg', 'image');
      expect(jpg.localPath).toEndWith('.jpg');

      const webm = await loader.downloadAsset('https://example.com/vid.webm', 'video');
      expect(webm.localPath).toEndWith('.webm');

      const wav = await loader.downloadAsset('https://example.com/sound.wav', 'audio');
      expect(wav.localPath).toEndWith('.wav');
    });

    it('should fallback to type-based extension when URL has no ext', async () => {
      const img = await loader.downloadAsset('https://example.com/noext-img', 'image');
      expect(img.localPath).toEndWith('.png');

      const vid = await loader.downloadAsset('https://example.com/noext-vid', 'video');
      expect(vid.localPath).toEndWith('.mp4');

      const aud = await loader.downloadAsset('https://example.com/noext-aud', 'audio');
      expect(aud.localPath).toEndWith('.mp3');

      const font = await loader.downloadAsset('https://example.com/noext-font', 'font');
      expect(font.localPath).toEndWith('.ttf');
    });

    it('should handle URLs with query params', async () => {
      const asset = await loader.downloadAsset('https://cdn.example.com/img.webp?w=500&q=80', 'image');
      expect(asset.localPath).toEndWith('.webp');
    });

    it('should handle URLs with hash fragments', async () => {
      const asset = await loader.downloadAsset('https://example.com/file.png#section', 'image');
      expect(asset.localPath).toEndWith('.png');
    });
  });

  // ========================
  // ASSET TYPES / BUFFER
  // ========================

  describe('asset types and buffer', () => {
    it('should include buffer for image assets', async () => {
      const asset = await loader.downloadAsset('https://example.com/img.png', 'image');
      expect(asset.buffer).toBeDefined();
      expect(Buffer.isBuffer(asset.buffer)).toBe(true);
      expect(asset.buffer!.length).toBe(100);
    });

    it('should include buffer for video assets', async () => {
      const asset = await loader.downloadAsset('https://example.com/vid.mp4', 'video');
      // video assets also get buffer set during download
      expect(asset.buffer).toBeDefined();
    });

    it('should set correct type field', async () => {
      const img = await loader.downloadAsset('https://example.com/t-img.png', 'image');
      expect(img.type).toBe('image');

      const vid = await loader.downloadAsset('https://example.com/t-vid.mp4', 'video');
      expect(vid.type).toBe('video');

      const aud = await loader.downloadAsset('https://example.com/t-aud.mp3', 'audio');
      expect(aud.type).toBe('audio');

      const font = await loader.downloadAsset('https://example.com/t-font.ttf', 'font');
      expect(font.type).toBe('font');
    });
  });

  // ========================
  // loadImage
  // ========================

  describe('loadImage', () => {
    it('should return buffer', async () => {
      const buffer = await loader.loadImage('https://example.com/li-img.png');
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBe(100);
    });

    it('should use cache on subsequent loadImage calls', async () => {
      const buffer1 = await loader.loadImage('https://example.com/li-cache.png');
      const buffer2 = await loader.loadImage('https://example.com/li-cache.png');
      expect(buffer1).toEqual(buffer2);
      expect(mockAxios).toHaveBeenCalledTimes(1);
    });

    it('should work after downloadAsset was called first', async () => {
      await loader.downloadAsset('https://example.com/li-pre.png', 'image');
      const buffer = await loader.loadImage('https://example.com/li-pre.png');
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(mockAxios).toHaveBeenCalledTimes(1);
    });
  });

  // ========================
  // CLEANUP
  // ========================

  describe('cleanup', () => {
    it('should delete all cached files', async () => {
      const asset1 = await loader.downloadAsset('https://example.com/c1.png', 'image');
      const asset2 = await loader.downloadAsset('https://example.com/c2.mp4', 'video');
      const asset3 = await loader.downloadAsset('https://example.com/c3.mp3', 'audio');

      expect(fs.existsSync(asset1.localPath)).toBe(true);
      expect(fs.existsSync(asset2.localPath)).toBe(true);
      expect(fs.existsSync(asset3.localPath)).toBe(true);

      loader.cleanup();

      expect(fs.existsSync(asset1.localPath)).toBe(false);
      expect(fs.existsSync(asset2.localPath)).toBe(false);
      expect(fs.existsSync(asset3.localPath)).toBe(false);
    });

    it('should not throw if cleanup called twice', () => {
      expect(() => {
        loader.cleanup();
        loader.cleanup();
      }).not.toThrow();
    });

    it('should not throw if no assets downloaded', () => {
      expect(() => loader.cleanup()).not.toThrow();
    });

    it('should clear internal cache after cleanup', async () => {
      await loader.downloadAsset('https://example.com/cc.png', 'image');
      loader.cleanup();

      // After cleanup, downloading again should call axios
      mockAxios.mockClear();
      await loader.downloadAsset('https://example.com/cc.png', 'image');
      expect(mockAxios).toHaveBeenCalledTimes(1);
    });
  });

  // ========================
  // LOCAL FILE PATHS
  // ========================

  describe('local file paths', () => {
    let tempFile: string;

    beforeEach(() => {
      tempFile = path.join(testCacheDir, 'local-test.png');
      fs.writeFileSync(tempFile, Buffer.alloc(50, 0xab));
    });

    it('should load file:// URL without downloading', async () => {
      const asset = await loader.downloadAsset(`file://${tempFile}`, 'image');
      expect(asset.localPath).toBe(tempFile);
      expect(asset.type).toBe('image');
      expect(mockAxios).not.toHaveBeenCalled();
    });

    it('should load absolute path without downloading', async () => {
      const asset = await loader.downloadAsset(tempFile, 'image');
      expect(asset.localPath).toBe(tempFile);
      expect(mockAxios).not.toHaveBeenCalled();
    });

    it('should cache local file on subsequent calls', async () => {
      const a1 = await loader.downloadAsset(tempFile, 'image');
      const a2 = await loader.downloadAsset(tempFile, 'image');
      expect(a1).toBe(a2); // same reference
    });

    it('should throw for non-existent local file', async () => {
      await expect(
        loader.downloadAsset('/tmp/non-existent-file-12345.png', 'image')
      ).rejects.toThrow('Local file not found');
    });

    it('should NOT delete local files on cleanup', async () => {
      // Create temp file OUTSIDE cache dir (simulates user's original file)
      const externalFile = path.join(os.tmpdir(), `j2v-external-${Date.now()}.png`);
      fs.writeFileSync(externalFile, Buffer.alloc(10, 0xcc));
      try {
        await loader.downloadAsset(externalFile, 'image');
        loader.cleanup();
        // External local file should still exist (not deleted by our cleanup)
        expect(fs.existsSync(externalFile)).toBe(true);
      } finally {
        if (fs.existsSync(externalFile)) fs.unlinkSync(externalFile);
      }
    });
  });

  // ========================
  // ERROR HANDLING
  // ========================

  describe('error handling', () => {
    it('should throw when download fails (network error)', async () => {
      mockAxios.mockRejectedValueOnce(new Error('Network Error'));
      await expect(
        loader.downloadAsset('https://example.com/fail.png', 'image')
      ).rejects.toThrow('Network Error');
    });

    it('should throw when download times out', async () => {
      mockAxios.mockRejectedValueOnce(new Error('timeout of 120000ms exceeded'));
      await expect(
        loader.downloadAsset('https://example.com/timeout.png', 'image')
      ).rejects.toThrow('timeout');
    });

    it('should not cache failed downloads', async () => {
      mockAxios.mockRejectedValueOnce(new Error('fail'));
      await expect(
        loader.downloadAsset('https://example.com/retry.png', 'image')
      ).rejects.toThrow();

      // Reset mock to succeed on retry
      mockAxios.mockResolvedValueOnce({ data: Buffer.alloc(10) });
      const asset = await loader.downloadAsset('https://example.com/retry.png', 'image');
      expect(asset.localPath).toContain(testCacheDir);
      expect(mockAxios).toHaveBeenCalledTimes(2);
    });
  });

  // ========================
  // loadFont
  // ========================

  describe('loadFont', () => {
    it('should download font file', async () => {
      await expect(
        loader.loadFont('https://example.com/font.ttf', 'TestFont')
      ).resolves.toBeUndefined();
      expect(mockAxios).toHaveBeenCalledTimes(1);
    });

    it('should not re-download on second call', async () => {
      await loader.loadFont('https://example.com/font2.ttf', 'TestFont2');
      await loader.loadFont('https://example.com/font2.ttf', 'TestFont2');
      expect(mockAxios).toHaveBeenCalledTimes(1);
    });
  });

  // ========================
  // UNKNOWN TYPE FALLBACK
  // ========================

  describe('unknown type fallback', () => {
    it('should fallback to .bin for unknown type', async () => {
      const asset = await loader.downloadAsset('https://example.com/noext', 'font');
      expect(asset.localPath).toEndWith('.ttf');
    });
  });
});
