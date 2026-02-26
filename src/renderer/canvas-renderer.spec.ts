import { CanvasRenderer } from './canvas-renderer';
import { VideoConfig, Scene } from '../types';

/** Helper: wrap scenes into single video track */
function singleTrackConfig(width: number, height: number, scenes: Scene[], fps = 10): VideoConfig {
  return {
    width, height, fps,
    tracks: [{ type: 'video', zIndex: 0, start: 0, scenes }],
  };
}

describe('CanvasRenderer', () => {
  const basicConfig = singleTrackConfig(320, 240, [{ duration: 2, bgColor: '#ff0000' }]);

  // ========================
  // getTotalFrames
  // ========================

  describe('getTotalFrames', () => {
    it('should compute from single scene', () => {
      const renderer = new CanvasRenderer(basicConfig, 10);
      expect(renderer.getTotalFrames()).toBe(20); // 2s * 10fps
      renderer.cleanup();
    });

    it('should sum multiple scenes', () => {
      const config = singleTrackConfig(320, 240, [{ duration: 2 }, { duration: 3 }, { duration: 1 }]);
      const renderer = new CanvasRenderer(config, 10);
      expect(renderer.getTotalFrames()).toBe(60); // (2+3+1)*10
      renderer.cleanup();
    });

    it('should ceil fractional duration', () => {
      const config = singleTrackConfig(320, 240, [{ duration: 1.5 }]);
      const renderer = new CanvasRenderer(config, 10);
      expect(renderer.getTotalFrames()).toBe(15);
      renderer.cleanup();
    });

    it('should handle very short duration', () => {
      const config = singleTrackConfig(320, 240, [{ duration: 0.1 }]);
      const renderer = new CanvasRenderer(config, 10);
      expect(renderer.getTotalFrames()).toBe(1);
      renderer.cleanup();
    });

    it('should handle many scenes', () => {
      const config = singleTrackConfig(320, 240, Array(20).fill(null).map(() => ({ duration: 0.5 })));
      const renderer = new CanvasRenderer(config, 10);
      expect(renderer.getTotalFrames()).toBe(100);
      renderer.cleanup();
    });
  });

  // ========================
  // renderFrame
  // ========================

  describe('renderFrame', () => {
    it('should return RGBA buffer with correct size', async () => {
      const renderer = new CanvasRenderer(basicConfig, 10);
      const frame = await renderer.renderFrame(0);
      expect(Buffer.isBuffer(frame)).toBe(true);
      expect(frame.length).toBe(320 * 240 * 4); // RGBA
      renderer.cleanup();
    });

    it('should return buffer for last valid frame', async () => {
      const renderer = new CanvasRenderer(basicConfig, 10);
      const frame = await renderer.renderFrame(renderer.getTotalFrames() - 1);
      expect(frame.length).toBe(320 * 240 * 4);
      renderer.cleanup();
    });

    it('should return black frame for out-of-range index', async () => {
      const renderer = new CanvasRenderer(basicConfig, 10);
      const frame = await renderer.renderFrame(999);
      expect(Buffer.isBuffer(frame)).toBe(true);
      expect(frame.length).toBe(320 * 240 * 4);
      renderer.cleanup();
    });

    it('should produce consistent frames for same index', async () => {
      const renderer = new CanvasRenderer(basicConfig, 10);
      const frame1 = await renderer.renderFrame(5);
      const frame2 = await renderer.renderFrame(5);
      expect(frame1.equals(frame2)).toBe(true);
      renderer.cleanup();
    });

    it('should produce different frames for different scenes', async () => {
      const config = singleTrackConfig(4, 4, [
        { duration: 1, bgColor: '#ff0000' },
        { duration: 1, bgColor: '#00ff00' },
      ]);
      const renderer = new CanvasRenderer(config, 10);
      const frame0 = await renderer.renderFrame(0);   // scene 0: red
      const frame15 = await renderer.renderFrame(15);  // scene 1: green
      expect(frame0.equals(frame15)).toBe(false);
      renderer.cleanup();
    });

    it('should use black background by default', async () => {
      const config = singleTrackConfig(2, 2, [{ duration: 1 }]);
      const renderer = new CanvasRenderer(config, 10);
      const frame = await renderer.renderFrame(0);
      // RGBA black = [0,0,0,255]
      expect(frame[0]).toBe(0);   // R
      expect(frame[1]).toBe(0);   // G
      expect(frame[2]).toBe(0);   // B
      expect(frame[3]).toBe(255); // A
      renderer.cleanup();
    });
  });

  // ========================
  // renderFrame with elements
  // ========================

  describe('renderFrame with elements', () => {
    it('should render text element', async () => {
      const config = singleTrackConfig(320, 240, [{
        duration: 1, bgColor: '#000',
        elements: [{ type: 'text', text: 'Hello', fontSize: 24, color: '#FFF', position: 'center', zIndex: 1 }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      expect(Buffer.isBuffer(await renderer.renderFrame(0))).toBe(true);
      renderer.cleanup();
    });

    it('should render caption element', async () => {
      const config = singleTrackConfig(320, 240, [{
        duration: 3, bgColor: '#000',
        elements: [{
          type: 'caption', srtContent: '1\n00:00:00,000 --> 00:00:02,000\nTest caption',
          position: 'bottom-center', zIndex: 1,
        }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      expect(Buffer.isBuffer(await renderer.renderFrame(5))).toBe(true);
      renderer.cleanup();
    });

    it('should sort elements by zIndex', async () => {
      const config = singleTrackConfig(320, 240, [{
        duration: 1, bgColor: '#000',
        elements: [
          { type: 'text', text: 'Z=10', fontSize: 24, color: '#FF0000', position: 'center', zIndex: 10 },
          { type: 'text', text: 'Z=1', fontSize: 24, color: '#00FF00', position: 'center', zIndex: 1 },
        ],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      expect(Buffer.isBuffer(await renderer.renderFrame(0))).toBe(true);
      renderer.cleanup();
    });

    it('should respect element start time', async () => {
      const config = singleTrackConfig(320, 240, [{
        duration: 3, bgColor: '#000',
        elements: [{ type: 'text', text: 'Late', fontSize: 24, color: '#FFF', position: 'center', zIndex: 1, start: 2 }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      const earlyFrame = await renderer.renderFrame(5);  // 0.5s — not visible
      const lateFrame = await renderer.renderFrame(25);   // 2.5s — visible
      expect(Buffer.isBuffer(earlyFrame)).toBe(true);
      expect(Buffer.isBuffer(lateFrame)).toBe(true);
      renderer.cleanup();
    });

    it('should render multiple text at different positions', async () => {
      const config = singleTrackConfig(320, 240, [{
        duration: 1, bgColor: '#111',
        elements: [
          { type: 'text', text: 'TL', fontSize: 16, color: '#FFF', position: 'top-left', zIndex: 1 },
          { type: 'text', text: 'C', fontSize: 16, color: '#FFF', position: 'center', zIndex: 2 },
          { type: 'text', text: 'BR', fontSize: 16, color: '#FFF', position: 'bottom-right', zIndex: 3 },
        ],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      expect(Buffer.isBuffer(await renderer.renderFrame(0))).toBe(true);
      renderer.cleanup();
    });
  });

  // ========================
  // Empty scenes
  // ========================

  describe('empty scenes', () => {
    it('should render scene without elements', async () => {
      const config = singleTrackConfig(320, 240, [{ duration: 1, bgColor: '#333' }]);
      const renderer = new CanvasRenderer(config, 10);
      expect(Buffer.isBuffer(await renderer.renderFrame(0))).toBe(true);
      renderer.cleanup();
    });

    it('should render scene with empty elements array', async () => {
      const config = singleTrackConfig(320, 240, [{ duration: 1, elements: [] }]);
      const renderer = new CanvasRenderer(config, 10);
      expect(Buffer.isBuffer(await renderer.renderFrame(0))).toBe(true);
      renderer.cleanup();
    });
  });

  // ========================
  // preloadAssets
  // ========================

  describe('preloadAssets', () => {
    it('should not throw for text-only scenes', async () => {
      const config = singleTrackConfig(320, 240, [{
        duration: 1,
        elements: [{ type: 'text', text: 'No assets', fontSize: 20, color: '#FFF', position: 'center', zIndex: 1 }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      await expect(renderer.preloadAssets()).resolves.toBeUndefined();
      renderer.cleanup();
    });

    it('should not throw for scenes with no elements', async () => {
      const renderer = new CanvasRenderer(basicConfig, 10);
      await expect(renderer.preloadAssets()).resolves.toBeUndefined();
      renderer.cleanup();
    });

    it('should not throw for caption-only scenes', async () => {
      const config = singleTrackConfig(320, 240, [{
        duration: 1,
        elements: [{
          type: 'caption', srtContent: '1\n00:00:00,000 --> 00:00:01,000\nTest',
          position: 'center', zIndex: 1,
        }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      await expect(renderer.preloadAssets()).resolves.toBeUndefined();
      renderer.cleanup();
    });
  });

  // ========================
  // getAssetLoader & cleanup
  // ========================

  describe('getAssetLoader & cleanup', () => {
    it('should return asset loader instance', () => {
      const renderer = new CanvasRenderer(basicConfig, 10);
      expect(renderer.getAssetLoader()).toBeDefined();
      renderer.cleanup();
    });

    it('should not throw on cleanup or double cleanup', () => {
      const renderer = new CanvasRenderer(basicConfig, 10);
      expect(() => renderer.cleanup()).not.toThrow();
      expect(() => renderer.cleanup()).not.toThrow();
    });
  });

  // ========================
  // Edge cases
  // ========================

  describe('edge cases', () => {
    it('should handle 1x1 pixel canvas', async () => {
      const config = singleTrackConfig(1, 1, [{ duration: 1 }], 1);
      const renderer = new CanvasRenderer(config, 1);
      expect((await renderer.renderFrame(0)).length).toBe(4);
      renderer.cleanup();
    });

    it('should handle large canvas (1920x1080)', async () => {
      const config = singleTrackConfig(1920, 1080, [{ duration: 1 }], 1);
      const renderer = new CanvasRenderer(config, 1);
      expect((await renderer.renderFrame(0)).length).toBe(1920 * 1080 * 4);
      renderer.cleanup();
    });

    it('should handle 1 fps', async () => {
      const config = singleTrackConfig(10, 10, [{ duration: 3 }], 1);
      const renderer = new CanvasRenderer(config, 1);
      expect(renderer.getTotalFrames()).toBe(3);
      renderer.cleanup();
    });
  });

  // ========================
  // Multi-track
  // ========================

  describe('multi-track', () => {
    it('should compute getTotalFrames across tracks', () => {
      const config: VideoConfig = {
        width: 320, height: 240,
        tracks: [
          { type: 'video', zIndex: 0, start: 0, scenes: [{ duration: 2 }] },
          { type: 'video', zIndex: 1, start: 1, scenes: [{ duration: 3 }] },
        ],
      };
      const renderer = new CanvasRenderer(config, 10);
      expect(renderer.getTotalFrames()).toBe(40); // max(2, 1+3) = 4s → 40
      renderer.cleanup();
    });

    it('should include audio track duration in getTotalFrames', () => {
      const config: VideoConfig = {
        width: 320, height: 240,
        tracks: [
          { type: 'video', zIndex: 0, scenes: [{ duration: 2 }] },
          { type: 'audio', start: 0, scenes: [{ duration: 5 }] },
        ],
      };
      const renderer = new CanvasRenderer(config, 10);
      expect(renderer.getTotalFrames()).toBe(50); // max(2, 5) = 5s → 50
      renderer.cleanup();
    });

    it('should render overlapping tracks', async () => {
      const config: VideoConfig = {
        width: 4, height: 4,
        tracks: [
          { type: 'video', zIndex: 0, start: 0, scenes: [{ duration: 2, bgColor: '#ff0000' }] },
          {
            type: 'video', zIndex: 1, start: 0,
            scenes: [{
              duration: 2,
              elements: [{ type: 'text', text: 'Hi', fontSize: 8, color: '#FFF', position: 'center', zIndex: 0 }],
            }],
          },
        ],
      };
      const renderer = new CanvasRenderer(config, 10);
      expect(Buffer.isBuffer(await renderer.renderFrame(5))).toBe(true);
      renderer.cleanup();
    });

    it('should not render track before its start time', async () => {
      const config: VideoConfig = {
        width: 4, height: 4,
        tracks: [
          { type: 'video', zIndex: 0, start: 0, scenes: [{ duration: 3, bgColor: '#ff0000' }] },
          { type: 'video', zIndex: 1, start: 2, scenes: [{ duration: 1, bgColor: '#00ff00' }] },
        ],
      };
      const renderer = new CanvasRenderer(config, 10);
      const earlyFrame = await renderer.renderFrame(5);  // 0.5s — only track 0
      const lateFrame = await renderer.renderFrame(25);   // 2.5s — both tracks
      expect(earlyFrame.equals(lateFrame)).toBe(false);
      renderer.cleanup();
    });

    it('should not overwrite background when overlay has no bgColor', async () => {
      const config: VideoConfig = {
        width: 4, height: 4,
        tracks: [
          { type: 'video', zIndex: 0, start: 0, scenes: [{ duration: 1, bgColor: '#ff0000' }] },
          { type: 'video', zIndex: 1, start: 0, scenes: [{ duration: 1, elements: [] }] },
        ],
      };
      const renderer = new CanvasRenderer(config, 10);
      const frame = await renderer.renderFrame(0);
      // Should still be red from track 0
      expect(frame[0]).toBe(255); // R
      expect(frame[1]).toBe(0);   // G
      expect(frame[2]).toBe(0);   // B
      expect(frame[3]).toBe(255); // A
      renderer.cleanup();
    });

    it('should handle scene transition fade', async () => {
      const config: VideoConfig = {
        width: 4, height: 4,
        tracks: [{
          type: 'video', zIndex: 0,
          scenes: [
            { duration: 1, bgColor: '#ff0000' },
            { duration: 1, bgColor: '#00ff00', transition: { type: 'fade', duration: 0.5 } },
          ],
        }],
      };
      const renderer = new CanvasRenderer(config, 10);
      expect(Buffer.isBuffer(await renderer.renderFrame(10))).toBe(true);
      renderer.cleanup();
    });

    it('should render elements with opacity', async () => {
      const config: VideoConfig = {
        width: 4, height: 4,
        tracks: [{
          type: 'video', zIndex: 0,
          scenes: [{
            duration: 2, bgColor: '#000',
            elements: [{ type: 'text', text: 'Transparent', position: 'center', zIndex: 1, opacity: 0.5 }],
          }],
        }],
      };
      const renderer = new CanvasRenderer(config, 10);
      expect(Buffer.isBuffer(await renderer.renderFrame(0))).toBe(true);
      renderer.cleanup();
    });

    it('should render elements with animation', async () => {
      const config: VideoConfig = {
        width: 4, height: 4,
        tracks: [{
          type: 'video', zIndex: 0,
          scenes: [{
            duration: 2, bgColor: '#000',
            elements: [{
              type: 'text', text: 'Fade In', position: 'center', zIndex: 1,
              animation: { type: 'fadeIn', fadeInDuration: 0.5 },
            }],
          }],
        }],
      };
      const renderer = new CanvasRenderer(config, 10);
      expect(Buffer.isBuffer(await renderer.renderFrame(2))).toBe(true); // t=0.2s mid-fade
      renderer.cleanup();
    });

    it('should handle audio-only track (no visual rendering)', async () => {
      const config: VideoConfig = {
        width: 4, height: 4,
        tracks: [
          { type: 'video', zIndex: 0, scenes: [{ duration: 1, bgColor: '#000' }] },
          { type: 'audio', start: 0, scenes: [{ duration: 1 }] },
        ],
      };
      const renderer = new CanvasRenderer(config, 10);
      expect(Buffer.isBuffer(await renderer.renderFrame(0))).toBe(true);
      renderer.cleanup();
    });
  });

  // ========================
  // Shape element
  // ========================

  describe('shape element', () => {
    it('should render filled rectangle (bgColor only)', async () => {
      const config = singleTrackConfig(100, 100, [{
        duration: 1, bgColor: '#000',
        elements: [{
          type: 'shape' as const, width: 50, height: 30, bgColor: '#ff0000',
          position: 'center' as const, zIndex: 1,
        }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      const frame = await renderer.renderFrame(0);
      expect(Buffer.isBuffer(frame)).toBe(true);
      // Check center pixel — should be red
      const cx = 50, cy = 50;
      const idx = (cy * 100 + cx) * 4;
      expect(frame[idx]).toBe(255);     // R
      expect(frame[idx + 1]).toBe(0);   // G
      expect(frame[idx + 2]).toBe(0);   // B
      renderer.cleanup();
    });

    it('should render stroke-only rectangle (photo frame)', async () => {
      const config = singleTrackConfig(100, 100, [{
        duration: 1, bgColor: '#000',
        elements: [{
          type: 'shape' as const, width: 80, height: 60, strokeColor: '#00ff00', strokeWidth: 4,
          position: 'center' as const, zIndex: 1,
        }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      const frame = await renderer.renderFrame(0);
      expect(Buffer.isBuffer(frame)).toBe(true);
      // Center should remain black (no fill)
      const cx = 50, cy = 50;
      const idx = (cy * 100 + cx) * 4;
      expect(frame[idx]).toBe(0);       // R — still black
      expect(frame[idx + 1]).toBe(0);   // G
      expect(frame[idx + 2]).toBe(0);   // B
      renderer.cleanup();
    });

    it('should render shape with bgColor + strokeColor combined', async () => {
      const config = singleTrackConfig(100, 100, [{
        duration: 1, bgColor: '#000',
        elements: [{
          type: 'shape' as const, width: 60, height: 40,
          bgColor: '#0000ff', strokeColor: '#ffffff', strokeWidth: 2,
          position: 'center' as const, zIndex: 1,
        }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      const frame = await renderer.renderFrame(0);
      expect(Buffer.isBuffer(frame)).toBe(true);
      // Center should be blue (fill)
      const cx = 50, cy = 50;
      const idx = (cy * 100 + cx) * 4;
      expect(frame[idx]).toBe(0);       // R
      expect(frame[idx + 1]).toBe(0);   // G
      expect(frame[idx + 2]).toBe(255); // B — blue fill
      renderer.cleanup();
    });

    it('should render shape with border radius', async () => {
      const config = singleTrackConfig(100, 100, [{
        duration: 1, bgColor: '#000',
        elements: [{
          type: 'shape' as const, width: 50, height: 50, bgColor: '#ff00ff',
          borderRadius: 10, position: 'center' as const, zIndex: 1,
        }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      const frame = await renderer.renderFrame(0);
      expect(Buffer.isBuffer(frame)).toBe(true);
      renderer.cleanup();
    });

    it('should render shape with opacity', async () => {
      const config = singleTrackConfig(10, 10, [{
        duration: 1, bgColor: '#000',
        elements: [{
          type: 'shape' as const, width: 10, height: 10, bgColor: '#ffffff',
          opacity: 0.5, position: 'center' as const, zIndex: 1,
        }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      const frame = await renderer.renderFrame(0);
      expect(Buffer.isBuffer(frame)).toBe(true);
      // With 50% opacity white on black, pixel should be ~128
      const idx = (5 * 10 + 5) * 4;
      expect(frame[idx]).toBeGreaterThan(100);
      expect(frame[idx]).toBeLessThan(160);
      renderer.cleanup();
    });
  });

  // ========================
  // Scene bgGradient
  // ========================

  describe('bgGradient', () => {
    it('should render scene with bgGradient', async () => {
      const config = singleTrackConfig(4, 4, [{
        duration: 1,
        bgGradient: { colors: ['#ff0000', '#0000ff'], angle: 0 },
      }]);
      const renderer = new CanvasRenderer(config, 10);
      const frame = await renderer.renderFrame(0);
      expect(Buffer.isBuffer(frame)).toBe(true);
      expect(frame.length).toBe(4 * 4 * 4);
      renderer.cleanup();
    });

    it('bgGradient should override bgColor', async () => {
      const config = singleTrackConfig(4, 4, [{
        duration: 1,
        bgColor: '#00ff00',
        bgGradient: { colors: ['#ff0000', '#0000ff'] },
      }]);
      const renderer = new CanvasRenderer(config, 10);
      const frame = await renderer.renderFrame(0);
      // Should NOT be green (bgGradient overrides bgColor)
      // Check that at least some pixel is not pure green
      const hasNonGreen = frame[0] !== 0 || frame[2] !== 0;
      expect(hasNonGreen).toBe(true);
      renderer.cleanup();
    });

    it('bgGradient with 3 colors', async () => {
      const config = singleTrackConfig(10, 10, [{
        duration: 1,
        bgGradient: { colors: ['#ff0000', '#00ff00', '#0000ff'], angle: 90 },
      }]);
      const renderer = new CanvasRenderer(config, 10);
      expect(Buffer.isBuffer(await renderer.renderFrame(0))).toBe(true);
      renderer.cleanup();
    });
  });

  // ========================
  // Element duration (partial visibility)
  // ========================

  describe('element duration', () => {
    it('should show element only during its duration', async () => {
      const config = singleTrackConfig(4, 4, [{
        duration: 3, bgColor: '#000',
        elements: [{
          type: 'text', text: 'Brief', fontSize: 8, color: '#FFF',
          position: 'center', zIndex: 1, start: 1, duration: 1,
        }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      // At t=0.5s (before element start=1s) — frame 5
      const before = await renderer.renderFrame(5);
      // At t=1.5s (during element) — frame 15
      const during = await renderer.renderFrame(15);
      // At t=2.5s (after element end=2s) — frame 25
      const after = await renderer.renderFrame(25);
      // before and after should be same (just black), during should differ
      expect(before.equals(after)).toBe(true);
      expect(before.equals(during)).toBe(false);
      renderer.cleanup();
    });
  });

  // ========================
  // Element shadow
  // ========================

  describe('element shadow', () => {
    it('should render text element with shadow', async () => {
      const config = singleTrackConfig(20, 20, [{
        duration: 1, bgColor: '#000',
        elements: [{
          type: 'text', text: 'S', fontSize: 10, color: '#FFF',
          position: 'center', zIndex: 1,
          shadow: { color: 'rgba(255,0,0,0.8)', blur: 5, offsetX: 2, offsetY: 2 },
        }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      expect(Buffer.isBuffer(await renderer.renderFrame(0))).toBe(true);
      renderer.cleanup();
    });

    it('should render shape element with shadow', async () => {
      const config = singleTrackConfig(50, 50, [{
        duration: 1, bgColor: '#000',
        elements: [{
          type: 'shape' as const, width: 30, height: 30, bgColor: '#ff0000',
          position: 'center' as const, zIndex: 1,
          shadow: { color: '#000000', blur: 10, offsetX: 5, offsetY: 5 },
        }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      expect(Buffer.isBuffer(await renderer.renderFrame(0))).toBe(true);
      renderer.cleanup();
    });
  });

  // ========================
  // Scale / Rotation
  // ========================

  describe('scale and rotation', () => {
    it('should render element with scale', async () => {
      const config = singleTrackConfig(20, 20, [{
        duration: 1, bgColor: '#000',
        elements: [{
          type: 'text', text: 'X', fontSize: 8, color: '#FFF',
          position: 'center', zIndex: 1, scale: 2,
        }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      expect(Buffer.isBuffer(await renderer.renderFrame(0))).toBe(true);
      renderer.cleanup();
    });

    it('should render element with rotation', async () => {
      const config = singleTrackConfig(20, 20, [{
        duration: 1, bgColor: '#000',
        elements: [{
          type: 'text', text: 'R', fontSize: 8, color: '#FFF',
          position: 'center', zIndex: 1, rotation: 45,
        }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      expect(Buffer.isBuffer(await renderer.renderFrame(0))).toBe(true);
      renderer.cleanup();
    });

    it('should render element with scale + rotation combined', async () => {
      const config = singleTrackConfig(20, 20, [{
        duration: 1, bgColor: '#000',
        elements: [{
          type: 'text', text: 'SR', fontSize: 8, color: '#FFF',
          position: 'center', zIndex: 1, scale: 1.5, rotation: 90,
        }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      expect(Buffer.isBuffer(await renderer.renderFrame(0))).toBe(true);
      renderer.cleanup();
    });
  });

  // ========================
  // Phase 5: Filters & Effects
  // ========================

  describe('filters (Phase 5)', () => {
    it('should render element with blur filter', async () => {
      const config = singleTrackConfig(20, 20, [{
        duration: 1, bgColor: '#000',
        elements: [{
          type: 'shape' as const, width: 10, height: 10, bgColor: '#ff0000',
          position: 'center' as const, zIndex: 1,
          filters: { blur: 2 },
        }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      expect(Buffer.isBuffer(await renderer.renderFrame(0))).toBe(true);
      renderer.cleanup();
    });

    it('should render element with brightness filter', async () => {
      const config = singleTrackConfig(10, 10, [{
        duration: 1, bgColor: '#000',
        elements: [{
          type: 'shape' as const, width: 10, height: 10, bgColor: '#808080',
          position: 'center' as const, zIndex: 1,
          filters: { brightness: 1.5 },
        }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      const frame = await renderer.renderFrame(0);
      expect(Buffer.isBuffer(frame)).toBe(true);
      renderer.cleanup();
    });

    it('should render element with grayscale filter', async () => {
      const config = singleTrackConfig(10, 10, [{
        duration: 1, bgColor: '#000',
        elements: [{
          type: 'shape' as const, width: 10, height: 10, bgColor: '#ff0000',
          position: 'center' as const, zIndex: 1,
          filters: { grayscale: 1 },
        }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      expect(Buffer.isBuffer(await renderer.renderFrame(0))).toBe(true);
      renderer.cleanup();
    });

    it('should render element with combined filters', async () => {
      const config = singleTrackConfig(10, 10, [{
        duration: 1, bgColor: '#000',
        elements: [{
          type: 'shape' as const, width: 10, height: 10, bgColor: '#ff0000',
          position: 'center' as const, zIndex: 1,
          filters: { blur: 1, brightness: 1.2, contrast: 1.3, saturate: 0.5 },
        }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      expect(Buffer.isBuffer(await renderer.renderFrame(0))).toBe(true);
      renderer.cleanup();
    });

    it('should render text element with sepia filter', async () => {
      const config = singleTrackConfig(50, 20, [{
        duration: 1, bgColor: '#000',
        elements: [{
          type: 'text', text: 'Sepia', fontSize: 10, color: '#FFF',
          position: 'center', zIndex: 1,
          filters: { sepia: 0.8 },
        }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      expect(Buffer.isBuffer(await renderer.renderFrame(0))).toBe(true);
      renderer.cleanup();
    });

    it('should render element with filters + shadow combined', async () => {
      const config = singleTrackConfig(20, 20, [{
        duration: 1, bgColor: '#000',
        elements: [{
          type: 'shape' as const, width: 10, height: 10, bgColor: '#0000ff',
          position: 'center' as const, zIndex: 1,
          filters: { blur: 1 },
          shadow: { color: '#ff0000', blur: 5, offsetX: 2, offsetY: 2 },
        }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      expect(Buffer.isBuffer(await renderer.renderFrame(0))).toBe(true);
      renderer.cleanup();
    });

    it('should render element with filters + scale/rotation', async () => {
      const config = singleTrackConfig(20, 20, [{
        duration: 1, bgColor: '#000',
        elements: [{
          type: 'shape' as const, width: 8, height: 8, bgColor: '#00ff00',
          position: 'center' as const, zIndex: 1, scale: 1.5, rotation: 45,
          filters: { hueRotate: 180, invert: 0.5 },
        }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      expect(Buffer.isBuffer(await renderer.renderFrame(0))).toBe(true);
      renderer.cleanup();
    });

    it('should handle empty filters object (no-op)', async () => {
      const config = singleTrackConfig(10, 10, [{
        duration: 1, bgColor: '#ff0000',
        elements: [{
          type: 'shape' as const, width: 10, height: 10, bgColor: '#00ff00',
          position: 'center' as const, zIndex: 1,
          filters: {},
        }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      expect(Buffer.isBuffer(await renderer.renderFrame(0))).toBe(true);
      renderer.cleanup();
    });
  });

  // ========================
  // Phase 5: Blend Modes
  // ========================

  describe('blend modes (Phase 5)', () => {
    it('should render element with screen blend mode', async () => {
      const config = singleTrackConfig(10, 10, [{
        duration: 1, bgColor: '#ff0000',
        elements: [{
          type: 'shape' as const, width: 10, height: 10, bgColor: '#00ff00',
          position: 'center' as const, zIndex: 1,
          blendMode: 'screen' as const,
        }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      const frame = await renderer.renderFrame(0);
      expect(Buffer.isBuffer(frame)).toBe(true);
      // Screen blend: brighter result
      const idx = (5 * 10 + 5) * 4;
      expect(frame[idx] + frame[idx + 1]).toBeGreaterThan(200);
      renderer.cleanup();
    });

    it('should render element with multiply blend mode', async () => {
      const config = singleTrackConfig(10, 10, [{
        duration: 1, bgColor: '#ffffff',
        elements: [{
          type: 'shape' as const, width: 10, height: 10, bgColor: '#808080',
          position: 'center' as const, zIndex: 1,
          blendMode: 'multiply' as const,
        }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      expect(Buffer.isBuffer(await renderer.renderFrame(0))).toBe(true);
      renderer.cleanup();
    });

    it('should render element with filters + blend mode combined', async () => {
      const config = singleTrackConfig(10, 10, [{
        duration: 1, bgColor: '#ff0000',
        elements: [{
          type: 'shape' as const, width: 10, height: 10, bgColor: '#00ff00',
          position: 'center' as const, zIndex: 1,
          filters: { brightness: 1.5 },
          blendMode: 'overlay' as const,
        }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      expect(Buffer.isBuffer(await renderer.renderFrame(0))).toBe(true);
      renderer.cleanup();
    });
  });

  // ========================
  // Phase 5: Vignette
  // ========================

  describe('vignette (Phase 5)', () => {
    it('should render scene with vignette', async () => {
      const config = singleTrackConfig(20, 20, [{
        duration: 1, bgColor: '#ffffff',
        vignette: { intensity: 0.7, size: 0.4 },
      }]);
      const renderer = new CanvasRenderer(config, 10);
      const frame = await renderer.renderFrame(0);
      expect(Buffer.isBuffer(frame)).toBe(true);
      // Center should be brighter than corners
      const center = (10 * 20 + 10) * 4;
      const corner = 0; // top-left pixel
      expect(frame[center]).toBeGreaterThanOrEqual(frame[corner]);
      renderer.cleanup();
    });

    it('should render vignette with custom color', async () => {
      const config = singleTrackConfig(10, 10, [{
        duration: 1, bgColor: '#ffffff',
        vignette: { intensity: 0.8, size: 0.3, color: '#000000' },
      }]);
      const renderer = new CanvasRenderer(config, 10);
      expect(Buffer.isBuffer(await renderer.renderFrame(0))).toBe(true);
      renderer.cleanup();
    });

    it('should render vignette with elements', async () => {
      const config = singleTrackConfig(20, 20, [{
        duration: 1, bgColor: '#000',
        vignette: { intensity: 0.5 },
        elements: [{
          type: 'text', text: 'V', fontSize: 8, color: '#FFF',
          position: 'center', zIndex: 1,
        }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      expect(Buffer.isBuffer(await renderer.renderFrame(0))).toBe(true);
      renderer.cleanup();
    });
  });

  // ========================
  // Phase 5: Color Overlay
  // ========================

  describe('colorOverlay (Phase 5)', () => {
    it('should render scene with color overlay', async () => {
      const config = singleTrackConfig(10, 10, [{
        duration: 1, bgColor: '#ffffff',
        colorOverlay: { color: 'rgba(255,0,0,0.5)' },
      }]);
      const renderer = new CanvasRenderer(config, 10);
      const frame = await renderer.renderFrame(0);
      expect(Buffer.isBuffer(frame)).toBe(true);
      // Center pixel should have red tint
      const idx = (5 * 10 + 5) * 4;
      expect(frame[idx]).toBeGreaterThan(200); // R
      renderer.cleanup();
    });

    it('should render color overlay with blend mode', async () => {
      const config = singleTrackConfig(10, 10, [{
        duration: 1, bgColor: '#ff0000',
        colorOverlay: { color: 'rgba(0,0,255,0.5)', blendMode: 'screen' as const },
      }]);
      const renderer = new CanvasRenderer(config, 10);
      expect(Buffer.isBuffer(await renderer.renderFrame(0))).toBe(true);
      renderer.cleanup();
    });

    it('should render vignette + colorOverlay combined', async () => {
      const config = singleTrackConfig(20, 20, [{
        duration: 1, bgColor: '#ffffff',
        vignette: { intensity: 0.5, size: 0.5 },
        colorOverlay: { color: 'rgba(255,200,0,0.2)' },
      }]);
      const renderer = new CanvasRenderer(config, 10);
      expect(Buffer.isBuffer(await renderer.renderFrame(0))).toBe(true);
      renderer.cleanup();
    });
  });

  // ========================
  // Phase 8: Mask (Clipping)
  // ========================

  describe('mask — shape mask', () => {
    it('should render shape element with circle mask', async () => {
      const config = singleTrackConfig(100, 100, [{
        duration: 1, bgColor: '#000',
        elements: [{
          type: 'shape' as const, width: 100, height: 100, bgColor: '#ff0000',
          position: 'center' as const, zIndex: 1,
          mask: { type: 'shape' as const, shape: 'circle' as const, radius: 30 },
        }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      const frame = await renderer.renderFrame(0);
      expect(Buffer.isBuffer(frame)).toBe(true);
      // Center should be red (inside mask)
      const cIdx = (50 * 100 + 50) * 4;
      expect(frame[cIdx]).toBe(255);     // R
      expect(frame[cIdx + 1]).toBe(0);   // G
      expect(frame[cIdx + 2]).toBe(0);   // B
      // Corner should be black (outside mask)
      const cornerIdx = 0; // top-left pixel
      expect(frame[cornerIdx]).toBe(0);     // R
      expect(frame[cornerIdx + 1]).toBe(0); // G
      expect(frame[cornerIdx + 2]).toBe(0); // B
      renderer.cleanup();
    });

    it('should render shape element with star mask', async () => {
      const config = singleTrackConfig(100, 100, [{
        duration: 1, bgColor: '#000',
        elements: [{
          type: 'shape' as const, width: 100, height: 100, bgColor: '#00ff00',
          position: 'center' as const, zIndex: 1,
          mask: { type: 'shape' as const, shape: 'star' as const, radius: 40, points: 5, innerRadius: 0.4 },
        }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      const frame = await renderer.renderFrame(0);
      expect(Buffer.isBuffer(frame)).toBe(true);
      // Center should be green (inside mask)
      const cIdx = (50 * 100 + 50) * 4;
      expect(frame[cIdx + 1]).toBe(255); // G
      renderer.cleanup();
    });

    it('should render shape element with rect mask (borderRadius)', async () => {
      const config = singleTrackConfig(100, 100, [{
        duration: 1, bgColor: '#000',
        elements: [{
          type: 'shape' as const, width: 100, height: 100, bgColor: '#0000ff',
          position: 'center' as const, zIndex: 1,
          mask: { type: 'shape' as const, shape: 'rect' as const, width: 80, height: 60, borderRadius: 10 },
        }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      const frame = await renderer.renderFrame(0);
      expect(Buffer.isBuffer(frame)).toBe(true);
      // Center pixel should be blue (inside rect mask)
      const cIdx = (50 * 100 + 50) * 4;
      expect(frame[cIdx + 2]).toBe(255); // B
      renderer.cleanup();
    });

    it('should render shape element with polygon mask (hexagon)', async () => {
      const config = singleTrackConfig(100, 100, [{
        duration: 1, bgColor: '#000',
        elements: [{
          type: 'shape' as const, width: 100, height: 100, bgColor: '#ff00ff',
          position: 'center' as const, zIndex: 1,
          mask: { type: 'shape' as const, shape: 'polygon' as const, radius: 40, numSides: 6 },
        }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      const frame = await renderer.renderFrame(0);
      expect(Buffer.isBuffer(frame)).toBe(true);
      // Center should have magenta
      const cIdx = (50 * 100 + 50) * 4;
      expect(frame[cIdx]).toBe(255);     // R
      expect(frame[cIdx + 2]).toBe(255); // B
      renderer.cleanup();
    });

    it('should render shape element with ellipse mask', async () => {
      const config = singleTrackConfig(100, 100, [{
        duration: 1, bgColor: '#000',
        elements: [{
          type: 'shape' as const, width: 100, height: 100, bgColor: '#ffff00',
          position: 'center' as const, zIndex: 1,
          mask: { type: 'shape' as const, shape: 'ellipse' as const, width: 80, height: 40 },
        }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      const frame = await renderer.renderFrame(0);
      expect(Buffer.isBuffer(frame)).toBe(true);
      // Center should be yellow (inside mask)
      const cIdx = (50 * 100 + 50) * 4;
      expect(frame[cIdx]).toBe(255);     // R
      expect(frame[cIdx + 1]).toBe(255); // G
      expect(frame[cIdx + 2]).toBe(0);   // B
      renderer.cleanup();
    });

    it('should render shape element with triangle mask (polygon 3 sides)', async () => {
      const config = singleTrackConfig(100, 100, [{
        duration: 1, bgColor: '#000',
        elements: [{
          type: 'shape' as const, width: 100, height: 100, bgColor: '#ffffff',
          position: 'center' as const, zIndex: 1,
          mask: { type: 'shape' as const, shape: 'polygon' as const, radius: 30, numSides: 3 },
        }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      const frame = await renderer.renderFrame(0);
      expect(Buffer.isBuffer(frame)).toBe(true);
      renderer.cleanup();
    });
  });

  describe('mask — text mask', () => {
    it('should render shape element with text mask', async () => {
      const config = singleTrackConfig(200, 100, [{
        duration: 1, bgColor: '#000',
        elements: [{
          type: 'shape' as const, width: 200, height: 100, bgColor: '#ff0000',
          position: 'center' as const, zIndex: 1,
          mask: { type: 'text' as const, text: 'HI', fontSize: 80, fontWeight: 'bold' },
        }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      const frame = await renderer.renderFrame(0);
      expect(Buffer.isBuffer(frame)).toBe(true);
      // Some pixels should be red (inside text mask), corners should be black
      const cornerIdx = 0;
      expect(frame[cornerIdx]).toBe(0); // top-left should be black
      renderer.cleanup();
    });

    it('should render text mask with strokeWidth', async () => {
      const config = singleTrackConfig(200, 100, [{
        duration: 1, bgColor: '#000',
        elements: [{
          type: 'shape' as const, width: 200, height: 100, bgColor: '#00ff00',
          position: 'center' as const, zIndex: 1,
          mask: { type: 'text' as const, text: 'X', fontSize: 80, strokeWidth: 10 },
        }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      const frame = await renderer.renderFrame(0);
      expect(Buffer.isBuffer(frame)).toBe(true);
      renderer.cleanup();
    });

    it('should render text mask with letterSpacing', async () => {
      const config = singleTrackConfig(300, 100, [{
        duration: 1, bgColor: '#000',
        elements: [{
          type: 'shape' as const, width: 300, height: 100, bgColor: '#0000ff',
          position: 'center' as const, zIndex: 1,
          mask: { type: 'text' as const, text: 'ABC', fontSize: 60, letterSpacing: 10 },
        }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      expect(Buffer.isBuffer(await renderer.renderFrame(0))).toBe(true);
      renderer.cleanup();
    });
  });

  describe('mask — inverted', () => {
    it('should render inverted shape mask (circle hole)', async () => {
      const config = singleTrackConfig(100, 100, [{
        duration: 1, bgColor: '#000',
        elements: [{
          type: 'shape' as const, width: 100, height: 100, bgColor: '#ff0000',
          position: 'center' as const, zIndex: 1,
          mask: { type: 'shape' as const, shape: 'circle' as const, radius: 30, invert: true },
        }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      const frame = await renderer.renderFrame(0);
      expect(Buffer.isBuffer(frame)).toBe(true);
      // Center should be BLACK (inverted — hole in mask)
      const cIdx = (50 * 100 + 50) * 4;
      expect(frame[cIdx]).toBe(0);       // R — black (hole)
      expect(frame[cIdx + 1]).toBe(0);   // G
      expect(frame[cIdx + 2]).toBe(0);   // B
      renderer.cleanup();
    });
  });

  describe('mask — combined with other features', () => {
    it('should render mask + opacity', async () => {
      const config = singleTrackConfig(100, 100, [{
        duration: 1, bgColor: '#000',
        elements: [{
          type: 'shape' as const, width: 100, height: 100, bgColor: '#ffffff',
          position: 'center' as const, zIndex: 1,
          opacity: 0.5,
          mask: { type: 'shape' as const, shape: 'circle' as const, radius: 40 },
        }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      const frame = await renderer.renderFrame(0);
      expect(Buffer.isBuffer(frame)).toBe(true);
      // Center should be grayish (opacity 0.5 white on black, with canvas alpha premultiplication)
      const cIdx = (50 * 100 + 50) * 4;
      expect(frame[cIdx]).toBeGreaterThan(40);
      expect(frame[cIdx]).toBeLessThan(180);
      renderer.cleanup();
    });

    it('should render mask + animation', async () => {
      const config = singleTrackConfig(100, 100, [{
        duration: 2, bgColor: '#000',
        elements: [{
          type: 'shape' as const, width: 100, height: 100, bgColor: '#ff0000',
          position: 'center' as const, zIndex: 1,
          animation: { type: 'fadeIn' as const, fadeInDuration: 1 },
          mask: { type: 'shape' as const, shape: 'circle' as const, radius: 40 },
        }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      expect(Buffer.isBuffer(await renderer.renderFrame(5))).toBe(true); // mid-fade
      expect(Buffer.isBuffer(await renderer.renderFrame(15))).toBe(true); // fully visible
      renderer.cleanup();
    });

    it('should render mask + filters', async () => {
      const config = singleTrackConfig(100, 100, [{
        duration: 1, bgColor: '#000',
        elements: [{
          type: 'shape' as const, width: 100, height: 100, bgColor: '#ff0000',
          position: 'center' as const, zIndex: 1,
          filters: { blur: 2, brightness: 1.2 },
          mask: { type: 'shape' as const, shape: 'star' as const, radius: 40 },
        }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      expect(Buffer.isBuffer(await renderer.renderFrame(0))).toBe(true);
      renderer.cleanup();
    });

    it('should render mask + blend mode', async () => {
      const config = singleTrackConfig(100, 100, [{
        duration: 1, bgColor: '#0000ff',
        elements: [{
          type: 'shape' as const, width: 100, height: 100, bgColor: '#ff0000',
          position: 'center' as const, zIndex: 1,
          blendMode: 'screen' as const,
          mask: { type: 'shape' as const, shape: 'circle' as const, radius: 40 },
        }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      expect(Buffer.isBuffer(await renderer.renderFrame(0))).toBe(true);
      renderer.cleanup();
    });

    it('should render mask + shadow', async () => {
      const config = singleTrackConfig(100, 100, [{
        duration: 1, bgColor: '#000',
        elements: [{
          type: 'shape' as const, width: 80, height: 80, bgColor: '#ff0000',
          position: 'center' as const, zIndex: 1,
          shadow: { color: '#ffffff', blur: 5, offsetX: 3, offsetY: 3 },
          mask: { type: 'shape' as const, shape: 'circle' as const, radius: 35 },
        }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      expect(Buffer.isBuffer(await renderer.renderFrame(0))).toBe(true);
      renderer.cleanup();
    });

    it('should render mask + scale/rotation', async () => {
      const config = singleTrackConfig(100, 100, [{
        duration: 1, bgColor: '#000',
        elements: [{
          type: 'shape' as const, width: 60, height: 60, bgColor: '#00ff00',
          position: 'center' as const, zIndex: 1,
          scale: 1.5, rotation: 45,
          mask: { type: 'shape' as const, shape: 'polygon' as const, radius: 25, numSides: 6 },
        }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      expect(Buffer.isBuffer(await renderer.renderFrame(0))).toBe(true);
      renderer.cleanup();
    });

    it('should render mask with offsetX/offsetY', async () => {
      const config = singleTrackConfig(100, 100, [{
        duration: 1, bgColor: '#000',
        elements: [{
          type: 'shape' as const, width: 100, height: 100, bgColor: '#ff0000',
          position: 'center' as const, zIndex: 1,
          mask: { type: 'shape' as const, shape: 'circle' as const, radius: 30, offsetX: 20, offsetY: -10 },
        }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      const frame = await renderer.renderFrame(0);
      expect(Buffer.isBuffer(frame)).toBe(true);
      renderer.cleanup();
    });

    it('should render text element with mask', async () => {
      const config = singleTrackConfig(200, 100, [{
        duration: 1, bgColor: '#000',
        elements: [{
          type: 'text', text: 'HELLO WORLD', fontSize: 24, color: '#ffffff',
          position: 'center', zIndex: 1,
          mask: { type: 'shape' as const, shape: 'circle' as const, radius: 40 },
        }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      expect(Buffer.isBuffer(await renderer.renderFrame(0))).toBe(true);
      renderer.cleanup();
    });

    it('should render mask + keyframes animation', async () => {
      const config = singleTrackConfig(100, 100, [{
        duration: 2, bgColor: '#000',
        elements: [{
          type: 'shape' as const, width: 100, height: 100, bgColor: '#ff0000',
          position: 'center' as const, zIndex: 1,
          keyframes: [
            { time: 0, opacity: 0, scale: 0.5 },
            { time: 1, opacity: 1, scale: 1.0 },
          ],
          mask: { type: 'shape' as const, shape: 'circle' as const, radius: 40 },
        }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      expect(Buffer.isBuffer(await renderer.renderFrame(5))).toBe(true);
      expect(Buffer.isBuffer(await renderer.renderFrame(15))).toBe(true);
      renderer.cleanup();
    });

    it('should render mask + all features combined', async () => {
      const config = singleTrackConfig(100, 100, [{
        duration: 2, bgColor: '#0000ff',
        elements: [{
          type: 'shape' as const, width: 80, height: 80, bgColor: '#ff0000',
          position: 'center' as const, zIndex: 1,
          opacity: 0.8,
          scale: 1.2,
          rotation: 15,
          filters: { brightness: 1.1 },
          blendMode: 'screen' as const,
          shadow: { color: '#000000', blur: 5, offsetX: 2, offsetY: 2 },
          animation: { type: 'fadeIn' as const, fadeInDuration: 0.5 },
          mask: { type: 'shape' as const, shape: 'star' as const, radius: 30, points: 5 },
        }],
      }]);
      const renderer = new CanvasRenderer(config, 10);
      expect(Buffer.isBuffer(await renderer.renderFrame(2))).toBe(true);
      expect(Buffer.isBuffer(await renderer.renderFrame(15))).toBe(true);
      renderer.cleanup();
    });
  });
});
