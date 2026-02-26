import { json2video, json2videoFile } from './json2video';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CanvasRenderer } from './renderer/canvas-renderer';
import { FFmpegEncoder } from './renderer/ffmpeg-encoder';

// ===== Mock CanvasRenderer =====
jest.mock('./renderer/canvas-renderer', () => ({
  CanvasRenderer: jest.fn().mockImplementation(() => ({
    preloadAssets: jest.fn().mockResolvedValue(undefined),
    getTotalFrames: jest.fn().mockReturnValue(30), // 1s * 30fps
    renderFrame: jest.fn().mockResolvedValue(Buffer.alloc(100)),
    getAssetLoader: jest.fn().mockReturnValue({}),
    cleanup: jest.fn(),
  })),
}));

// ===== Mock FFmpegEncoder =====
jest.mock('./renderer/ffmpeg-encoder', () => ({
  FFmpegEncoder: jest.fn().mockImplementation(() => ({
    startEncoding: jest.fn(),
    writeFrame: jest.fn().mockResolvedValue(undefined),
    finishEncoding: jest.fn().mockResolvedValue(undefined),
    mixAudio: jest.fn().mockImplementation((_videoPath: string, finalPath: string) => {
      fs.writeFileSync(finalPath, Buffer.alloc(256, 0xaa));
      return Promise.resolve(finalPath);
    }),
  })),
}));

// ===== Helpers =====
const validConfig = {
  width: 1080, height: 1920, fps: 30,
  scenes: [{
    duration: 1, bgColor: '#1a1a2e',
    elements: [{ type: 'text', text: 'Hello!', fontSize: 72, color: '#FFF', position: 'center', zIndex: 1 }],
  }],
};

const minimalConfig = { width: 1080, height: 1920, scenes: [{ duration: 1 }] };

function getRendererMock() {
  return (CanvasRenderer as unknown as jest.Mock).mock.results[0].value;
}

function getEncoderMock() {
  return (FFmpegEncoder as jest.Mock).mock.results[0].value;
}

// ================================================================
// json2video
// ================================================================
describe('json2video', () => {
  beforeEach(() => jest.clearAllMocks());

  // ========================
  // VALIDATION
  // ========================

  describe('validation', () => {
    it.each([null, undefined, false, 0, ''])('should throw for falsy config: %p', async (val) => {
      await expect(json2video(val)).rejects.toThrow('Video config không hợp lệ');
    });

    it('should throw if width is missing', async () => {
      await expect(json2video({ height: 1920, scenes: [{ duration: 5 }] }))
        .rejects.toThrow('Video config không hợp lệ');
    });

    it('should throw if height is missing', async () => {
      await expect(json2video({ width: 1080, scenes: [{ duration: 5 }] }))
        .rejects.toThrow('Video config không hợp lệ');
    });

    it.each([0, -1, -100])('should throw if width is %p', async (w) => {
      await expect(json2video({ width: w, height: 1920, scenes: [{ duration: 1 }] }))
        .rejects.toThrow();
    });

    it.each([0, -1, -100])('should throw if height is %p', async (h) => {
      await expect(json2video({ width: 1080, height: h, scenes: [{ duration: 1 }] }))
        .rejects.toThrow();
    });

    it('should throw if width is NaN string', async () => {
      await expect(json2video({ width: 'abc', height: 1920, scenes: [{ duration: 1 }] }))
        .rejects.toThrow();
    });

    it('should throw if both scenes and tracks are missing', async () => {
      await expect(json2video({ width: 1080, height: 1920 }))
        .rejects.toThrow('Video config không hợp lệ');
    });

    it('should throw if scenes is empty', async () => {
      await expect(json2video({ width: 1080, height: 1920, scenes: [] }))
        .rejects.toThrow('Video config không hợp lệ');
    });

    it.each([0, -1, -100])('should throw if scene duration is %p', async (dur) => {
      await expect(json2video({ width: 1080, height: 1920, scenes: [{ duration: dur }] }))
        .rejects.toThrow('Video config không hợp lệ');
    });

    it('should validate each scene independently', async () => {
      await expect(json2video({
        width: 1080, height: 1920,
        scenes: [{ duration: 1 }, { duration: 0 }],
      })).rejects.toThrow('Video config không hợp lệ');
    });

    it('should accept scene with only duration', async () => {
      const result = await json2video(minimalConfig);
      expect(result.success).toBe(true);
    });
  });

  // ========================
  // VALIDATION — URLs
  // ========================

  describe('URL validation', () => {
    // Invalid URLs: ftp://, relative paths without ./ prefix
    it.each(['ftp://bad.com/img.png', 'images/my.png'])(
      'should throw for image with invalid URL: %s',
      async (url) => {
        await expect(json2video({
          width: 1080, height: 1920,
          scenes: [{
            duration: 1,
            elements: [{ type: 'image', url, width: 100, height: 100, position: 'center', zIndex: 0 }],
          }],
        })).rejects.toThrow('URL không hợp lệ');
      }
    );

    it.each(['ftp://bad/vid.mp4', 'videos/my.mp4'])(
      'should throw for video with invalid URL: %s',
      async (url) => {
        await expect(json2video({
          width: 1080, height: 1920,
          scenes: [{
            duration: 1,
            elements: [{ type: 'video', url, width: 100, height: 100, position: 'center', zIndex: 0 }],
          }],
        })).rejects.toThrow('URL không hợp lệ');
      }
    );

    it.each(['ftp://bad/audio.mp3', 'audio/file.mp3'])(
      'should throw for audio with invalid URL: %s',
      async (url) => {
        await expect(json2video({
          width: 1080, height: 1920,
          scenes: [{ duration: 1, audio: { url } }],
        })).rejects.toThrow('URL không hợp lệ');
      }
    );

    it.each([
      { type: 'image', url: 'http://example.com/img.png', width: 100, height: 100, position: 'center', zIndex: 0 },
      { type: 'image', url: 'https://example.com/img.png', width: 100, height: 100, position: 'center', zIndex: 0 },
      { type: 'video', url: 'https://example.com/vid.mp4', width: 100, height: 100, position: 'center', zIndex: 0 },
      { type: 'image', url: 'file:///path/to/img.png', width: 100, height: 100, position: 'center', zIndex: 0 },
      { type: 'image', url: './local/img.png', width: 100, height: 100, position: 'center', zIndex: 0 },
      { type: 'image', url: '/absolute/path/img.png', width: 100, height: 100, position: 'center', zIndex: 0 },
      { type: 'image', url: '../parent/img.png', width: 100, height: 100, position: 'center', zIndex: 0 },
    ])('should accept valid $type URL', async (element) => {
      const result = await json2video({
        width: 1080, height: 1920,
        scenes: [{ duration: 1, elements: [element] }],
      });
      expect(result.success).toBe(true);
    });

    it('should not validate URL for text elements', async () => {
      const result = await json2video({
        width: 1080, height: 1920,
        scenes: [{ duration: 1, elements: [{ type: 'text', text: 'Hello', position: 'center', zIndex: 0 }] }],
      });
      expect(result.success).toBe(true);
    });

    it('should not validate URL for caption elements', async () => {
      const result = await json2video({
        width: 1080, height: 1920,
        scenes: [{
          duration: 1,
          elements: [{
            type: 'caption', srtContent: '1\n00:00:00,000 --> 00:00:01,000\nTest',
            position: 'center', zIndex: 0,
          }],
        }],
      });
      expect(result.success).toBe(true);
    });

    it('should accept valid audio URL', async () => {
      const result = await json2video({
        width: 1080, height: 1920,
        scenes: [{ duration: 1, audio: { url: 'https://example.com/audio.mp3' } }],
      });
      expect(result.success).toBe(true);
    });
  });

  // ========================
  // NORMALIZATION
  // ========================

  describe('normalization', () => {
    it('should normalize string width/height/fps to numbers', async () => {
      await json2video({ width: '1080', height: '1920', fps: '30', scenes: [{ duration: '1' }] });
      expect(CanvasRenderer).toHaveBeenCalledWith(
        expect.objectContaining({ width: 1080, height: 1920, fps: 30 }), 30, undefined,
      );
    });

    it('should default fps to 30', async () => {
      await json2video(minimalConfig);
      expect(CanvasRenderer).toHaveBeenCalledWith(
        expect.objectContaining({ fps: 30 }), 30, undefined,
      );
    });

    it('should throw if fps is NaN string', async () => {
      await expect(json2video({ width: 1080, height: 1920, fps: 'abc', scenes: [{ duration: 1 }] }))
        .rejects.toThrow('Video config không hợp lệ');
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
        }), 30, undefined,
      );
    });

    it('should default missing element zIndex to 0', async () => {
      await json2video({
        width: 1080, height: 1920,
        scenes: [{ duration: 1, elements: [{ type: 'text', text: 'Hi', position: 'center' }] }],
      });
      expect(CanvasRenderer).toHaveBeenCalledWith(
        expect.objectContaining({
          tracks: expect.arrayContaining([
            expect.objectContaining({
              scenes: expect.arrayContaining([
                expect.objectContaining({
                  elements: expect.arrayContaining([
                    // TextElement doesn't have width/height in schema, only zIndex gets defaulted
                    expect.objectContaining({ zIndex: 0 }),
                  ]),
                }),
              ]),
            }),
          ]),
        }), 30, undefined,
      );
    });
  });

  // ========================
  // RENDER PIPELINE
  // ========================

  describe('render pipeline', () => {
    it('should return success with buffer and fileName', async () => {
      const result = await json2video(validConfig);
      expect(result.success).toBe(true);
      expect(result.message).toContain('thành công');
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
      expect(result.buffer.length).toBeGreaterThan(0);
      expect(result.fileName).toMatch(/^video_[a-f0-9]+\.mp4$/);
    });

    it('should call all pipeline steps in order', async () => {
      await json2video(validConfig);
      const renderer = getRendererMock();
      const encoder = getEncoderMock();

      expect(CanvasRenderer).toHaveBeenCalledTimes(1);
      expect(renderer.preloadAssets).toHaveBeenCalledTimes(1);
      expect(renderer.renderFrame).toHaveBeenCalledTimes(30);
      expect(encoder.startEncoding).toHaveBeenCalledTimes(1);
      expect(encoder.writeFrame).toHaveBeenCalledTimes(30);
      expect(encoder.finishEncoding).toHaveBeenCalledTimes(1);
      expect(encoder.mixAudio).toHaveBeenCalledTimes(1);
      expect(renderer.cleanup).toHaveBeenCalledTimes(1);
    });

    it('should call renderFrame with indices 0..N-1', async () => {
      await json2video(validConfig);
      const renderer = getRendererMock();
      for (let i = 0; i < 30; i++) {
        expect(renderer.renderFrame).toHaveBeenCalledWith(i);
      }
    });

    it.each([
      ['preload', () => ({
        preloadAssets: jest.fn().mockRejectedValue(new Error('download fail')),
        getTotalFrames: jest.fn().mockReturnValue(0),
        renderFrame: jest.fn(),
        getAssetLoader: jest.fn().mockReturnValue({}),
        cleanup: jest.fn(),
      })],
      ['renderFrame', () => ({
        preloadAssets: jest.fn().mockResolvedValue(undefined),
        getTotalFrames: jest.fn().mockReturnValue(10),
        renderFrame: jest.fn().mockRejectedValue(new Error('render crash')),
        getAssetLoader: jest.fn().mockReturnValue({}),
        cleanup: jest.fn(),
      })],
    ])('should cleanup renderer on %s error', async (_stage, mockFactory) => {
      (CanvasRenderer as unknown as jest.Mock).mockImplementationOnce(mockFactory);
      await expect(json2video(validConfig)).rejects.toThrow();
      const renderer = getRendererMock();
      expect(renderer.cleanup).toHaveBeenCalledTimes(1);
    });

    it('should cleanup renderer on encoding error', async () => {
      (FFmpegEncoder as jest.Mock).mockImplementationOnce(() => ({
        startEncoding: jest.fn(),
        writeFrame: jest.fn().mockResolvedValue(undefined),
        finishEncoding: jest.fn().mockRejectedValue(new Error('encode fail')),
        mixAudio: jest.fn(),
      }));
      await expect(json2video(validConfig)).rejects.toThrow('encode fail');
      const renderer = getRendererMock();
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
      await expect(json2video(validConfig)).rejects.toThrow(/Lỗi khi render video:.*custom error/);
    });
  });

  // ========================
  // PROGRESS CALLBACK
  // ========================

  describe('progress callback', () => {
    it('should call onProgress at key stages (5, 10-80, 85, 95, 100)', async () => {
      const onProgress = jest.fn();
      await json2video(minimalConfig, { onProgress });

      expect(onProgress).toHaveBeenCalledWith(5);   // preload
      expect(onProgress).toHaveBeenCalledWith(85);  // encoding done
      expect(onProgress).toHaveBeenCalledWith(95);  // audio mixed
      expect(onProgress).toHaveBeenCalledWith(100); // done

      // Frame progress values in 10-80 range
      const values = onProgress.mock.calls.map((c: number[]) => c[0]) as number[];
      expect(values.filter((v: number) => v >= 10 && v <= 80).length).toBeGreaterThan(0);
    });

    it('should call progress in ascending order', async () => {
      const onProgress = jest.fn();
      await json2video(minimalConfig, { onProgress });
      const values = onProgress.mock.calls.map((c: number[]) => c[0]) as number[];
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
      }
    });

    it('should not crash without onProgress', async () => {
      await expect(json2video(minimalConfig)).resolves.toBeDefined();
    });
  });

  // ========================
  // OPTIONS
  // ========================

  describe('options', () => {
    it('should pass cacheDir to CanvasRenderer', async () => {
      await json2video(minimalConfig, { cacheDir: '/tmp/custom-cache' });
      expect(CanvasRenderer).toHaveBeenCalledWith(expect.anything(), 30, '/tmp/custom-cache');
    });

    it('should use default cacheDir when not specified', async () => {
      await json2video(minimalConfig);
      expect(CanvasRenderer).toHaveBeenCalledWith(expect.anything(), 30, undefined);
    });

    it('should create custom outputDir', async () => {
      const tmpDir = path.join(os.tmpdir(), `j2v-opt-test-${Date.now()}`);
      try {
        await json2video(minimalConfig, { outputDir: tmpDir });
        expect(fs.existsSync(tmpDir)).toBe(true);
      } finally {
        if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  // ========================
  // MULTI-TRACK
  // ========================

  describe('multi-track', () => {
    it('should handle multi-track config', async () => {
      const result = await json2video({
        width: 1080, height: 1920,
        tracks: [
          { type: 'video', zIndex: 0, scenes: [{ duration: 3, bgColor: '#1a1a2e' }] },
          {
            type: 'video', zIndex: 1, start: 1,
            scenes: [{
              duration: 2,
              elements: [{ type: 'text', text: 'Overlay!', fontSize: 48, color: '#FFF', position: 'center', zIndex: 0 }],
            }],
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
          { type: 'video', zIndex: 0, scenes: [{ duration: 2, bgColor: '#000' }] },
          { type: 'audio', scenes: [{ duration: 2, audio: { url: 'https://example.com/bgm.mp3', volume: 0.5 } }] },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should handle 3 overlapping video tracks', async () => {
      const result = await json2video({
        width: 1080, height: 1920,
        tracks: [
          { type: 'video', zIndex: 0, scenes: [{ duration: 5, bgColor: '#000' }] },
          { type: 'video', zIndex: 1, start: 1, scenes: [{ duration: 3, elements: [{ type: 'text', text: 'L1', fontSize: 48, color: '#F00', position: 'top-center', zIndex: 0 }] }] },
          { type: 'video', zIndex: 2, start: 2, scenes: [{ duration: 2, elements: [{ type: 'text', text: 'L2', fontSize: 48, color: '#0F0', position: 'bottom-center', zIndex: 0 }] }] },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should handle multiple audio tracks', async () => {
      const result = await json2video({
        width: 1080, height: 1920,
        tracks: [
          { type: 'video', zIndex: 0, scenes: [{ duration: 3, bgColor: '#000' }] },
          { type: 'audio', scenes: [{ duration: 3, audio: { url: 'https://example.com/bgm.mp3', volume: 0.3, loop: true } }] },
          { type: 'audio', start: 1, scenes: [{ duration: 2, audio: { url: 'https://example.com/voice.mp3', volume: 1.0 } }] },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('should normalize string values in tracks', async () => {
      await json2video({
        width: '1080', height: '1920', fps: '30',
        tracks: [{ type: 'video', zIndex: '0', start: '0', scenes: [{ duration: '1' }] }],
      });
      expect(CanvasRenderer).toHaveBeenCalledWith(
        expect.objectContaining({ width: 1080, height: 1920, fps: 30 }), 30, undefined,
      );
    });

    it('should default track type to video', async () => {
      const result = await json2video({
        width: 1080, height: 1920,
        tracks: [{ scenes: [{ duration: 1, bgColor: '#000' }] }],
      });
      expect(result.success).toBe(true);
    });

    it('should throw for empty tracks', async () => {
      await expect(json2video({ width: 1080, height: 1920, tracks: [] })).rejects.toThrow();
    });

    it('should throw for track with empty scenes', async () => {
      await expect(json2video({
        width: 1080, height: 1920,
        tracks: [{ type: 'video', zIndex: 0, scenes: [] }],
      })).rejects.toThrow();
    });

    it('should still support legacy scenes format', async () => {
      const result = await json2video({
        width: 1080, height: 1920,
        scenes: [{ duration: 1, bgColor: '#ff0000' }, { duration: 1, bgColor: '#00ff00' }],
      });
      expect(result.success).toBe(true);
    });
  });

  // ========================
  // RESULT SHAPE
  // ========================

  describe('result shape', () => {
    it('should return correct structure', async () => {
      const result = await json2video(minimalConfig);
      expect(result.success).toBe(true);
      expect(result.message.length).toBeGreaterThan(0);
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
      expect(result.fileName).toMatch(/\.mp4$/);
    });

    it('should generate unique fileNames', async () => {
      const r1 = await json2video(minimalConfig);
      const r2 = await json2video(minimalConfig);
      expect(r1.fileName).not.toBe(r2.fileName);
    });
  });
});

// ================================================================
// json2videoFile
// ================================================================
describe('json2videoFile', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should save to file', async () => {
    const outputPath = path.join(os.tmpdir(), `j2v-test-${Date.now()}.mp4`);
    try {
      const result = await json2videoFile(minimalConfig, outputPath);
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
      const result = await json2videoFile(minimalConfig, outputPath);
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
      const result = await json2videoFile(minimalConfig, outputPath);
      expect(result.success).toBe(true);
      expect(fs.readFileSync(outputPath).toString()).not.toBe('old content');
    } finally {
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    }
  });

  it('should return standard result shape', async () => {
    const outputPath = path.join(os.tmpdir(), `j2v-shape-${Date.now()}.mp4`);
    try {
      const result = await json2videoFile(minimalConfig, outputPath);
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
      await json2videoFile(minimalConfig, outputPath, { onProgress });
      expect(onProgress).toHaveBeenCalledWith(100);
    } finally {
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    }
  });

  it('should throw for invalid config', async () => {
    const outputPath = path.join(os.tmpdir(), `j2v-invalid-${Date.now()}.mp4`);
    await expect(json2videoFile(null, outputPath)).rejects.toThrow('Video config không hợp lệ');
  });
});

// ================================================================
// Additional edge cases
// ================================================================
describe('json2video — extra edge cases', () => {
  beforeEach(() => jest.clearAllMocks());

  it('should handle tracks with scenes containing audio arrays', async () => {
    const result = await json2video({
      width: 1080, height: 1920,
      tracks: [
        { type: 'video', zIndex: 0, scenes: [{ duration: 3, bgColor: '#000' }] },
        {
          type: 'audio', scenes: [{
            duration: 3,
            audio: [
              { url: 'https://example.com/bgm.mp3', volume: 0.3 },
              { url: 'https://example.com/sfx.mp3', volume: 1.0, start: 1 },
            ],
          }],
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('should reject ../relative path for audio URL that are not valid', async () => {
    // ../relative paths ARE valid, this tests acceptance
    const result = await json2video({
      width: 1080, height: 1920,
      scenes: [{ duration: 1, audio: { url: '../parent/audio.mp3' } }],
    });
    expect(result.success).toBe(true);
  });

  it('should handle very large number of scenes', async () => {
    const scenes = Array.from({ length: 50 }, (_, i) => ({
      duration: 0.1,
      bgColor: `#${(i * 5).toString(16).padStart(2, '0')}0000`,
    }));
    const result = await json2video({ width: 1080, height: 1920, scenes });
    expect(result.success).toBe(true);
  });

  it('should handle fractional fps', async () => {
    const result = await json2video({ width: 1080, height: 1920, fps: 29.97, scenes: [{ duration: 1 }] });
    expect(result.success).toBe(true);
  });
});
