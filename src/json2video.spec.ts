import { json2video, json2videoFile } from './json2video';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CanvasRenderer } from './renderer/canvas-renderer';
import { FFmpegEncoder } from './renderer/ffmpeg-encoder';

// ===== Mock CanvasRenderer =====
jest.mock('./renderer/canvas-renderer', () => {
  return {
    CanvasRenderer: jest.fn().mockImplementation(() => ({
      preloadAssets: jest.fn().mockResolvedValue(undefined),
      getTotalFrames: jest.fn().mockReturnValue(30), // 1s * 30fps
      renderFrame: jest.fn().mockResolvedValue(Buffer.alloc(100)),
      getAssetLoader: jest.fn().mockReturnValue({}),
      cleanup: jest.fn(),
    })),
  };
});

// ===== Mock FFmpegEncoder =====
jest.mock('./renderer/ffmpeg-encoder', () => {
  return {
    FFmpegEncoder: jest.fn().mockImplementation(() => ({
      startEncoding: jest.fn(),
      writeFrame: jest.fn().mockResolvedValue(undefined),
      finishEncoding: jest.fn().mockResolvedValue(undefined),
      mixAudio: jest.fn().mockImplementation((_videoPath: string, finalPath: string) => {
        fs.writeFileSync(finalPath, Buffer.alloc(256, 0xaa));
        return Promise.resolve(finalPath);
      }),
    })),
  };
});

describe('json2video', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ========================
  // VALIDATION - null / undefined / empty
  // ========================

  describe('validation - missing config', () => {
    it('should throw if videoConfig is null', async () => {
      await expect(json2video(null)).rejects.toThrow('videoConfig không được để trống');
    });

    it('should throw if videoConfig is undefined', async () => {
      await expect(json2video(undefined)).rejects.toThrow('videoConfig không được để trống');
    });

    it('should throw if videoConfig is false', async () => {
      await expect(json2video(false)).rejects.toThrow('videoConfig không được để trống');
    });

    it('should throw if videoConfig is 0', async () => {
      await expect(json2video(0)).rejects.toThrow('videoConfig không được để trống');
    });

    it('should throw if videoConfig is empty string', async () => {
      await expect(json2video('')).rejects.toThrow('videoConfig không được để trống');
    });
  });

  // ========================
  // VALIDATION - missing fields
  // ========================

  describe('validation - missing fields', () => {
    it('should throw if width is missing', async () => {
      await expect(json2video({ height: 1920, scenes: [{ duration: 5 }] })).rejects.toThrow(
        'width và height'
      );
    });

    it('should throw if height is missing', async () => {
      await expect(json2video({ width: 1080, scenes: [{ duration: 5 }] })).rejects.toThrow(
        'width và height'
      );
    });

    it('should throw if scenes/tracks is missing', async () => {
      await expect(json2video({ width: 1080, height: 1920 })).rejects.toThrow(
        'tracks[]'
      );
    });

    it('should throw if width is 0', async () => {
      await expect(json2video({ width: 0, height: 1920, scenes: [{ duration: 1 }] })).rejects.toThrow();
    });

    it('should throw if height is 0', async () => {
      await expect(json2video({ width: 1080, height: 0, scenes: [{ duration: 1 }] })).rejects.toThrow();
    });
  });

  // ========================
  // VALIDATION - scenes
  // ========================

  describe('validation - scenes', () => {
    it('should throw if scenes is empty array', async () => {
      await expect(json2video({ width: 1080, height: 1920, scenes: [] })).rejects.toThrow(
        'ít nhất một scene'
      );
    });

    it('should throw if scene duration is 0', async () => {
      await expect(json2video({ width: 1080, height: 1920, scenes: [{ duration: 0 }] })).rejects.toThrow('duration > 0');
    });

    it('should throw if scene duration is negative', async () => {
      await expect(json2video({ width: 1080, height: 1920, scenes: [{ duration: -1 }] })).rejects.toThrow('duration > 0');
    });

    it('should throw if scene duration is -100', async () => {
      await expect(json2video({ width: 1080, height: 1920, scenes: [{ duration: -100 }] })).rejects.toThrow('duration > 0');
    });

    it('should accept scene with only duration', async () => {
      const result = await json2video({ width: 1080, height: 1920, scenes: [{ duration: 1 }] });
      expect(result.success).toBe(true);
    });

    it('should validate each scene independently', async () => {
      // First scene OK, second has duration 0
      await expect(json2video({
        width: 1080, height: 1920,
        scenes: [{ duration: 1 }, { duration: 0 }],
      })).rejects.toThrow('duration > 0');
    });
  });

  // ========================
  // VALIDATION - element URLs
  // ========================

  describe('validation - element URLs', () => {
    it('should throw for image with ftp:// URL', async () => {
      await expect(json2video({
        width: 1080, height: 1920,
        scenes: [{
          duration: 5,
          elements: [{ type: 'image', url: 'ftp://bad.com/img.png', width: 100, height: 100, position: 'center', zIndex: 0 }],
        }],
      })).rejects.toThrow('URL phải bắt đầu bằng http://');
    });

    it('should throw for image with local path', async () => {
      await expect(json2video({
        width: 1080, height: 1920,
        scenes: [{
          duration: 5,
          elements: [{ type: 'image', url: '/local/img.png', width: 100, height: 100, position: 'center', zIndex: 0 }],
        }],
      })).rejects.toThrow('URL phải bắt đầu bằng http://');
    });

    it('should throw for video with ftp:// URL', async () => {
      await expect(json2video({
        width: 1080, height: 1920,
        scenes: [{
          duration: 5,
          elements: [{ type: 'video', url: 'ftp://bad/vid.mp4', width: 100, height: 100, position: 'center', zIndex: 0 }],
        }],
      })).rejects.toThrow('URL phải bắt đầu bằng http://');
    });

    it('should throw for video with relative path', async () => {
      await expect(json2video({
        width: 1080, height: 1920,
        scenes: [{
          duration: 5,
          elements: [{ type: 'video', url: 'videos/my.mp4', width: 100, height: 100, position: 'center', zIndex: 0 }],
        }],
      })).rejects.toThrow('URL phải bắt đầu bằng http://');
    });

    it('should accept http:// image URL', async () => {
      const result = await json2video({
        width: 1080, height: 1920,
        scenes: [{
          duration: 1,
          elements: [{ type: 'image', url: 'http://example.com/img.png', width: 100, height: 100, position: 'center', zIndex: 0 }],
        }],
      });
      expect(result.success).toBe(true);
    });

    it('should accept https:// image URL', async () => {
      const result = await json2video({
        width: 1080, height: 1920,
        scenes: [{
          duration: 1,
          elements: [{ type: 'image', url: 'https://example.com/img.png', width: 100, height: 100, position: 'center', zIndex: 0 }],
        }],
      });
      expect(result.success).toBe(true);
    });

    it('should accept https:// video URL', async () => {
      const result = await json2video({
        width: 1080, height: 1920,
        scenes: [{
          duration: 1,
          elements: [{ type: 'video', url: 'https://example.com/vid.mp4', width: 100, height: 100, position: 'center', zIndex: 0 }],
        }],
      });
      expect(result.success).toBe(true);
    });

    it('should NOT validate URL for text elements', async () => {
      const result = await json2video({
        width: 1080, height: 1920,
        scenes: [{
          duration: 1,
          elements: [{ type: 'text', text: 'Hello', position: 'center', zIndex: 0 }],
        }],
      });
      expect(result.success).toBe(true);
    });

    it('should NOT validate URL for caption elements', async () => {
      const result = await json2video({
        width: 1080, height: 1920,
        scenes: [{
          duration: 1,
          elements: [{
            type: 'caption',
            srtContent: '1\n00:00:00,000 --> 00:00:01,000\nTest',
            position: 'center', zIndex: 0,
          }],
        }],
      });
      expect(result.success).toBe(true);
    });
  });

  // ========================
  // VALIDATION - audio URLs
  // ========================

  describe('validation - audio URLs', () => {
    it('should throw for audio with file:// URL', async () => {
      await expect(json2video({
        width: 1080, height: 1920,
        scenes: [{ duration: 5, audio: { url: 'file:///bad/audio.mp3' } }],
      })).rejects.toThrow('Audio URL phải bắt đầu bằng http://');
    });

    it('should throw for audio with relative path', async () => {
      await expect(json2video({
        width: 1080, height: 1920,
        scenes: [{ duration: 5, audio: { url: 'audio/file.mp3' } }],
      })).rejects.toThrow('Audio URL phải bắt đầu bằng http://');
    });

    it('should accept https:// audio URL', async () => {
      const result = await json2video({
        width: 1080, height: 1920,
        scenes: [{ duration: 1, audio: { url: 'https://example.com/audio.mp3' } }],
      });
      expect(result.success).toBe(true);
    });

    it('should accept scene without audio', async () => {
      const result = await json2video({
        width: 1080, height: 1920,
        scenes: [{ duration: 1 }],
      });
      expect(result.success).toBe(true);
    });
  });

  // ========================
  // NORMALIZATION
  // ========================

  describe('normalization', () => {
    it('should normalize string width/height/fps', async () => {
      await json2video({ width: '1080', height: '1920', fps: '30', scenes: [{ duration: '1' }] });

      expect(CanvasRenderer).toHaveBeenCalledWith(
        expect.objectContaining({ width: 1080, height: 1920, fps: 30 }),
        30, undefined
      );
    });

    it('should default fps to 30 if not provided', async () => {
      await json2video({ width: 1080, height: 1920, scenes: [{ duration: 1 }] });

      expect(CanvasRenderer).toHaveBeenCalledWith(
        expect.objectContaining({ fps: 30 }),
        30, undefined
      );
    });

    it('should default fps to 30 if NaN', async () => {
      await json2video({ width: 1080, height: 1920, fps: 'abc', scenes: [{ duration: 1 }] });

      expect(CanvasRenderer).toHaveBeenCalledWith(
        expect.objectContaining({ fps: 30 }),
        30, undefined
      );
    });

    it('should normalize element width/height/zIndex', async () => {
      await json2video({
        width: 1080, height: 1920,
        scenes: [{
          duration: 1,
          elements: [{ type: 'text', text: 'Hi', width: '200', height: '100', zIndex: '5', position: 'center' }],
        }],
      });

      expect(CanvasRenderer).toHaveBeenCalledWith(
        expect.objectContaining({
          tracks: expect.arrayContaining([
            expect.objectContaining({
              scenes: expect.arrayContaining([
                expect.objectContaining({
                  elements: expect.arrayContaining([
                    expect.objectContaining({ width: 200, height: 100, zIndex: 5 }),
                  ]),
                }),
              ]),
            }),
          ]),
        }),
        30, undefined
      );
    });

    it('should default missing element width/height/zIndex to 0', async () => {
      await json2video({
        width: 1080, height: 1920,
        scenes: [{
          duration: 1,
          elements: [{ type: 'text', text: 'Hi', position: 'center' }],
        }],
      });

      expect(CanvasRenderer).toHaveBeenCalledWith(
        expect.objectContaining({
          tracks: expect.arrayContaining([
            expect.objectContaining({
              scenes: expect.arrayContaining([
                expect.objectContaining({
                  elements: expect.arrayContaining([
                    expect.objectContaining({ width: 0, height: 0, zIndex: 0 }),
                  ]),
                }),
              ]),
            }),
          ]),
        }),
        30, undefined
      );
    });

    it('should handle scene with empty elements array', async () => {
      const result = await json2video({
        width: 1080, height: 1920,
        scenes: [{ duration: 1, elements: [] }],
      });
      expect(result.success).toBe(true);
    });
  });

  // ========================
  // RENDER PIPELINE
  // ========================

  describe('render pipeline', () => {
    const validConfig = {
      width: 1080, height: 1920, fps: 30,
      scenes: [{
        duration: 1, bgColor: '#1a1a2e',
        elements: [{ type: 'text', text: 'Hello!', fontSize: 72, color: '#FFF', position: 'center', zIndex: 1 }],
      }],
    };

    it('should return success result with buffer', async () => {
      const result = await json2video(validConfig);

      expect(result.success).toBe(true);
      expect(result.message).toContain('thành công');
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
      expect(result.buffer.length).toBeGreaterThan(0);
      expect(result.fileName).toMatch(/^video_[a-f0-9]+\.mp4$/);
    });

    it('should create CanvasRenderer once', async () => {
      await json2video(validConfig);
      expect(CanvasRenderer).toHaveBeenCalledTimes(1);
    });

    it('should call preloadAssets', async () => {
      await json2video(validConfig);
      const renderer = (CanvasRenderer as unknown as jest.Mock).mock.results[0].value;
      expect(renderer.preloadAssets).toHaveBeenCalledTimes(1);
    });

    it('should render every frame', async () => {
      await json2video(validConfig);
      const renderer = (CanvasRenderer as unknown as jest.Mock).mock.results[0].value;
      expect(renderer.renderFrame).toHaveBeenCalledTimes(30);
    });

    it('should call renderFrame with correct indices (0 to N-1)', async () => {
      await json2video(validConfig);
      const renderer = (CanvasRenderer as unknown as jest.Mock).mock.results[0].value;
      for (let i = 0; i < 30; i++) {
        expect(renderer.renderFrame).toHaveBeenCalledWith(i);
      }
    });

    it('should start FFmpeg encoder', async () => {
      await json2video(validConfig);
      const encoder = (FFmpegEncoder as jest.Mock).mock.results[0].value;
      expect(encoder.startEncoding).toHaveBeenCalledTimes(1);
    });

    it('should write every frame to encoder', async () => {
      await json2video(validConfig);
      const encoder = (FFmpegEncoder as jest.Mock).mock.results[0].value;
      expect(encoder.writeFrame).toHaveBeenCalledTimes(30);
    });

    it('should finish encoding', async () => {
      await json2video(validConfig);
      const encoder = (FFmpegEncoder as jest.Mock).mock.results[0].value;
      expect(encoder.finishEncoding).toHaveBeenCalledTimes(1);
    });

    it('should mix audio', async () => {
      await json2video(validConfig);
      const encoder = (FFmpegEncoder as jest.Mock).mock.results[0].value;
      expect(encoder.mixAudio).toHaveBeenCalledTimes(1);
    });

    it('should cleanup renderer after success', async () => {
      await json2video(validConfig);
      const renderer = (CanvasRenderer as unknown as jest.Mock).mock.results[0].value;
      expect(renderer.cleanup).toHaveBeenCalledTimes(1);
    });

    it('should cleanup renderer even on preload error', async () => {
      (CanvasRenderer as unknown as jest.Mock).mockImplementationOnce(() => ({
        preloadAssets: jest.fn().mockRejectedValue(new Error('download fail')),
        getTotalFrames: jest.fn().mockReturnValue(0),
        renderFrame: jest.fn(),
        getAssetLoader: jest.fn().mockReturnValue({}),
        cleanup: jest.fn(),
      }));

      await expect(json2video(validConfig)).rejects.toThrow('download fail');
      const renderer = (CanvasRenderer as unknown as jest.Mock).mock.results[0].value;
      expect(renderer.cleanup).toHaveBeenCalledTimes(1);
    });

    it('should cleanup renderer even on renderFrame error', async () => {
      (CanvasRenderer as unknown as jest.Mock).mockImplementationOnce(() => ({
        preloadAssets: jest.fn().mockResolvedValue(undefined),
        getTotalFrames: jest.fn().mockReturnValue(10),
        renderFrame: jest.fn().mockRejectedValue(new Error('render crash')),
        getAssetLoader: jest.fn().mockReturnValue({}),
        cleanup: jest.fn(),
      }));

      await expect(json2video(validConfig)).rejects.toThrow('render crash');
      const renderer = (CanvasRenderer as unknown as jest.Mock).mock.results[0].value;
      expect(renderer.cleanup).toHaveBeenCalledTimes(1);
    });

    it('should cleanup renderer even on encoding error', async () => {
      (FFmpegEncoder as jest.Mock).mockImplementationOnce(() => ({
        startEncoding: jest.fn(),
        writeFrame: jest.fn().mockResolvedValue(undefined),
        finishEncoding: jest.fn().mockRejectedValue(new Error('encode fail')),
        mixAudio: jest.fn(),
      }));

      await expect(json2video(validConfig)).rejects.toThrow('encode fail');
      const renderer = (CanvasRenderer as unknown as jest.Mock).mock.results[0].value;
      expect(renderer.cleanup).toHaveBeenCalledTimes(1);
    });

    it('should wrap error message', async () => {
      (CanvasRenderer as unknown as jest.Mock).mockImplementationOnce(() => ({
        preloadAssets: jest.fn().mockRejectedValue(new Error('custom error')),
        getTotalFrames: jest.fn().mockReturnValue(0),
        renderFrame: jest.fn(),
        getAssetLoader: jest.fn().mockReturnValue({}),
        cleanup: jest.fn(),
      }));

      await expect(json2video(validConfig)).rejects.toThrow('Lỗi khi render video: custom error');
    });
  });

  // ========================
  // PROGRESS CALLBACK
  // ========================

  describe('progress callback', () => {
    const config = { width: 1080, height: 1920, scenes: [{ duration: 1 }] };

    it('should call onProgress at key stages', async () => {
      const onProgress = jest.fn();
      await json2video(config, { onProgress });

      expect(onProgress).toHaveBeenCalledWith(5);   // preload
      expect(onProgress).toHaveBeenCalledWith(85);  // encoding done
      expect(onProgress).toHaveBeenCalledWith(95);  // audio mixed
      expect(onProgress).toHaveBeenCalledWith(100); // done
    });

    it('should call onProgress during frame rendering (10-80 range)', async () => {
      const onProgress = jest.fn();
      await json2video(config, { onProgress });

      const progressValues = onProgress.mock.calls.map((c: number[]) => c[0]) as number[];

      // Should have values between 10 and 80
      const frameProgress = progressValues.filter((v: number) => v >= 10 && v <= 80);
      expect(frameProgress.length).toBeGreaterThan(0);
    });

    it('should call progress in ascending order', async () => {
      const onProgress = jest.fn();
      await json2video(config, { onProgress });

      const values = onProgress.mock.calls.map((c: number[]) => c[0]) as number[];
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
      }
    });

    it('should not crash if onProgress is not provided', async () => {
      await expect(json2video(config)).resolves.toBeDefined();
    });

    it('should not crash if onProgress throws', async () => {
      const onProgress = jest.fn().mockImplementation(() => {
        throw new Error('ui crash');
      });

      // Since onProgress is called as onProgress?.(), a throw would propagate
      await expect(json2video(config, { onProgress })).rejects.toThrow();
    });
  });

  // ========================
  // OPTIONS
  // ========================

  describe('options', () => {
    const config = { width: 1080, height: 1920, scenes: [{ duration: 1 }] };

    it('should pass cacheDir to CanvasRenderer', async () => {
      await json2video(config, { cacheDir: '/tmp/custom-cache' });

      expect(CanvasRenderer).toHaveBeenCalledWith(
        expect.anything(), 30, '/tmp/custom-cache'
      );
    });

    it('should use default cacheDir (undefined) when not specified', async () => {
      await json2video(config);

      expect(CanvasRenderer).toHaveBeenCalledWith(
        expect.anything(), 30, undefined
      );
    });

    it('should use custom outputDir', async () => {
      const tmpDir = path.join(os.tmpdir(), `j2v-opt-test-${Date.now()}`);
      try {
        await json2video(config, { outputDir: tmpDir });
        // outputDir should have been created
        expect(fs.existsSync(tmpDir)).toBe(true);
      } finally {
        if (fs.existsSync(tmpDir)) {
          fs.rmSync(tmpDir, { recursive: true, force: true });
        }
      }
    });
  });

  // ========================
  // MULTIPLE SCENES
  // ========================

  describe('multiple scenes', () => {
    it('should handle 2 scenes', async () => {
      const result = await json2video({
        width: 1080, height: 1920,
        scenes: [
          { duration: 1, bgColor: '#ff0000' },
          { duration: 2, bgColor: '#00ff00' },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should handle 5 scenes', async () => {
      const result = await json2video({
        width: 1080, height: 1920,
        scenes: [
          { duration: 1 }, { duration: 1 }, { duration: 1 }, { duration: 1 }, { duration: 1 },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should handle scene with various element types', async () => {
      const result = await json2video({
        width: 1080, height: 1920,
        scenes: [{
          duration: 1,
          elements: [
            { type: 'text', text: 'Title', position: 'top-center', zIndex: 1 },
            { type: 'image', url: 'https://example.com/img.png', width: 200, height: 200, position: 'center', zIndex: 0 },
            { type: 'video', url: 'https://example.com/vid.mp4', width: 1080, height: 1920, position: 'center', zIndex: -1 },
          ],
        }],
      });
      expect(result.success).toBe(true);
    });

    it('should handle scene with audio', async () => {
      const result = await json2video({
        width: 1080, height: 1920,
        scenes: [{
          duration: 1,
          audio: { url: 'https://example.com/audio.mp3', volume: 0.5 },
        }],
      });
      expect(result.success).toBe(true);
    });

    it('should handle global audioTracks', async () => {
      const result = await json2video({
        width: 1080, height: 1920,
        scenes: [{ duration: 1 }],
        audioTracks: [
          { url: 'https://example.com/bgm.mp3', volume: 0.3, loop: true },
        ],
      });
      expect(result.success).toBe(true);
    });
  });

  // ========================
  // MULTI-TRACK
  // ========================

  describe('multi-track', () => {
    it('should handle basic multi-track config', async () => {
      const result = await json2video({
        width: 1080, height: 1920,
        tracks: [
          {
            type: 'video',
            zIndex: 0,
            start: 0,
            scenes: [
              { duration: 3, bgColor: '#1a1a2e' },
            ],
          },
          {
            type: 'video',
            zIndex: 1,
            start: 1,
            scenes: [
              {
                duration: 2,
                elements: [
                  { type: 'text', text: 'Overlay!', fontSize: 48, color: '#FFF', position: 'center', zIndex: 0 },
                ],
              },
            ],
          },
        ],
      });
      expect(result.success).toBe(true);
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
    });

    it('should handle video + audio tracks', async () => {
      const result = await json2video({
        width: 1080, height: 1920,
        tracks: [
          {
            type: 'video',
            zIndex: 0,
            scenes: [{ duration: 2, bgColor: '#000' }],
          },
          {
            type: 'audio',
            scenes: [
              { duration: 2, audio: { url: 'https://example.com/bgm.mp3', volume: 0.5 } },
            ],
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should handle track with start offset', async () => {
      const result = await json2video({
        width: 1080, height: 1920,
        tracks: [
          {
            type: 'video',
            zIndex: 0,
            start: 0,
            scenes: [{ duration: 5, bgColor: '#000' }],
          },
          {
            type: 'video',
            zIndex: 1,
            start: 2,
            scenes: [
              {
                duration: 2,
                elements: [
                  { type: 'text', text: 'Delayed', fontSize: 36, color: '#FF0', position: 'center', zIndex: 0 },
                ],
              },
            ],
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should still work with legacy scenes format (backward compat)', async () => {
      const result = await json2video({
        width: 1080, height: 1920,
        scenes: [
          { duration: 1, bgColor: '#ff0000' },
          { duration: 1, bgColor: '#00ff00' },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should throw for empty tracks array', async () => {
      await expect(json2video({
        width: 1080, height: 1920,
        tracks: [],
      })).rejects.toThrow();
    });

    it('should throw for track with empty scenes', async () => {
      await expect(json2video({
        width: 1080, height: 1920,
        tracks: [
          { type: 'video', zIndex: 0, scenes: [] },
        ],
      })).rejects.toThrow();
    });

    it('should throw for track with scene duration 0', async () => {
      await expect(json2video({
        width: 1080, height: 1920,
        tracks: [
          { type: 'video', zIndex: 0, scenes: [{ duration: 0 }] },
        ],
      })).rejects.toThrow('duration > 0');
    });

    it('should handle 3 video tracks overlapping', async () => {
      const result = await json2video({
        width: 1080, height: 1920,
        tracks: [
          {
            type: 'video', zIndex: 0,
            scenes: [{ duration: 5, bgColor: '#000' }],
          },
          {
            type: 'video', zIndex: 1, start: 1,
            scenes: [{
              duration: 3,
              elements: [{ type: 'text', text: 'Layer 1', fontSize: 48, color: '#F00', position: 'top-center', zIndex: 0 }],
            }],
          },
          {
            type: 'video', zIndex: 2, start: 2,
            scenes: [{
              duration: 2,
              elements: [{ type: 'text', text: 'Layer 2', fontSize: 48, color: '#0F0', position: 'bottom-center', zIndex: 0 }],
            }],
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should handle multiple audio tracks', async () => {
      const result = await json2video({
        width: 1080, height: 1920,
        tracks: [
          {
            type: 'video', zIndex: 0,
            scenes: [{ duration: 3, bgColor: '#000' }],
          },
          {
            type: 'audio', start: 0,
            scenes: [{ duration: 3, audio: { url: 'https://example.com/bgm.mp3', volume: 0.3, loop: true } }],
          },
          {
            type: 'audio', start: 1,
            scenes: [{ duration: 2, audio: { url: 'https://example.com/voice.mp3', volume: 1.0 } }],
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should handle track with multiple scenes', async () => {
      const result = await json2video({
        width: 1080, height: 1920,
        tracks: [
          {
            type: 'video', zIndex: 0,
            scenes: [
              { duration: 2, bgColor: '#ff0000' },
              { duration: 2, bgColor: '#00ff00' },
              { duration: 1, bgColor: '#0000ff' },
            ],
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should normalize string values in tracks', async () => {
      await json2video({
        width: '1080', height: '1920', fps: '30',
        tracks: [
          {
            type: 'video', zIndex: '0', start: '0',
            scenes: [{ duration: '1' }],
          },
        ],
      });

      expect(CanvasRenderer).toHaveBeenCalledWith(
        expect.objectContaining({ width: 1080, height: 1920, fps: 30 }),
        30, undefined
      );
    });

    it('should default track type to video', async () => {
      const result = await json2video({
        width: 1080, height: 1920,
        tracks: [
          { scenes: [{ duration: 1, bgColor: '#000' }] },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should pass options through with tracks', async () => {
      const onProgress = jest.fn();
      await json2video({
        width: 1080, height: 1920,
        tracks: [
          { type: 'video', zIndex: 0, scenes: [{ duration: 1 }] },
        ],
      }, { onProgress });

      expect(onProgress).toHaveBeenCalledWith(100);
    });
  });

  // ========================
  // RESULT SHAPE
  // ========================

  describe('result shape', () => {
    const config = { width: 1080, height: 1920, scenes: [{ duration: 1 }] };

    it('should have success = true', async () => {
      const result = await json2video(config);
      expect(result.success).toBe(true);
    });

    it('should have non-empty message', async () => {
      const result = await json2video(config);
      expect(result.message.length).toBeGreaterThan(0);
    });

    it('should have Buffer', async () => {
      const result = await json2video(config);
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
    });

    it('should have fileName ending in .mp4', async () => {
      const result = await json2video(config);
      expect(result.fileName).toMatch(/\.mp4$/);
    });

    it('should have unique fileNames on multiple calls', async () => {
      const r1 = await json2video(config);
      const r2 = await json2video(config);
      expect(r1.fileName).not.toBe(r2.fileName);
    });
  });
});

// ========================
// json2videoFile
// ========================

describe('json2videoFile', () => {
  const config = { width: 1080, height: 1920, scenes: [{ duration: 1 }] };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should save buffer to file', async () => {
    const outputPath = path.join(os.tmpdir(), `j2v-test-${Date.now()}.mp4`);
    try {
      const result = await json2videoFile(config, outputPath);
      expect(result.success).toBe(true);
      expect(fs.existsSync(outputPath)).toBe(true);
      expect(fs.readFileSync(outputPath).length).toBeGreaterThan(0);
    } finally {
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    }
  });

  it('should create parent directories', async () => {
    const dir = path.join(os.tmpdir(), `j2v-nested-${Date.now()}`);
    const outputPath = path.join(dir, 'a', 'b', 'output.mp4');
    try {
      const result = await json2videoFile(config, outputPath);
      expect(result.success).toBe(true);
      expect(fs.existsSync(outputPath)).toBe(true);
    } finally {
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('should overwrite existing file', async () => {
    const outputPath = path.join(os.tmpdir(), `j2v-overwrite-${Date.now()}.mp4`);
    try {
      fs.writeFileSync(outputPath, 'old content');
      const result = await json2videoFile(config, outputPath);
      expect(result.success).toBe(true);
      const content = fs.readFileSync(outputPath);
      expect(content.toString()).not.toBe('old content');
    } finally {
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    }
  });

  it('should return same result as json2video', async () => {
    const outputPath = path.join(os.tmpdir(), `j2v-compare-${Date.now()}.mp4`);
    try {
      const result = await json2videoFile(config, outputPath);
      expect(result.success).toBe(true);
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
      expect(result.fileName).toMatch(/\.mp4$/);
    } finally {
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    }
  });

  it('should pass options through', async () => {
    const outputPath = path.join(os.tmpdir(), `j2v-opts-${Date.now()}.mp4`);
    const onProgress = jest.fn();
    try {
      await json2videoFile(config, outputPath, { onProgress });
      expect(onProgress).toHaveBeenCalledWith(100);
    } finally {
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    }
  });

  it('should throw for invalid config (validation still works)', async () => {
    const outputPath = path.join(os.tmpdir(), `j2v-invalid-${Date.now()}.mp4`);
    await expect(json2videoFile(null, outputPath)).rejects.toThrow('videoConfig không được để trống');
  });
});
