import { CanvasRenderer } from './canvas-renderer';
import { VideoConfig, Scene } from '../types';

/** Helper: wrap scenes into single video track */
function singleTrackConfig(width: number, height: number, scenes: Scene[], fps?: number): VideoConfig {
  return {
    width, height,
    fps: fps || 10,
    tracks: [{ type: 'video', zIndex: 0, start: 0, scenes }],
  };
}

describe('CanvasRenderer', () => {
  const basicConfig = singleTrackConfig(320, 240, [
    { duration: 2, bgColor: '#ff0000' },
  ]);

  // ========================
  // getTotalFrames
  // ========================

  describe('getTotalFrames', () => {
    it('should compute for single scene', () => {
      const renderer = new CanvasRenderer(basicConfig, 10);
      expect(renderer.getTotalFrames()).toBe(20); // 2s * 10fps
      renderer.cleanup();
    });

    it('should compute for multiple scenes', () => {
      const config = singleTrackConfig(320, 240, [{ duration: 2 }, { duration: 3 }, { duration: 1 }], 10);
      const renderer = new CanvasRenderer(config, 10);
      expect(renderer.getTotalFrames()).toBe(60); // (2+3+1)*10
      renderer.cleanup();
    });

    it('should handle fractional duration (ceil)', () => {
      const config = singleTrackConfig(320, 240, [{ duration: 1.5 }], 10);
      const renderer = new CanvasRenderer(config, 10);
      expect(renderer.getTotalFrames()).toBe(15); // ceil(1.5*10) = 15
      renderer.cleanup();
    });

    it('should handle very short duration', () => {
      const config = singleTrackConfig(320, 240, [{ duration: 0.1 }], 10);
      const renderer = new CanvasRenderer(config, 10);
      expect(renderer.getTotalFrames()).toBe(1); // ceil(0.1*10) = 1
      renderer.cleanup();
    });

    it('should handle high fps', () => {
      const config = singleTrackConfig(320, 240, [{ duration: 1 }], 10);
      const renderer = new CanvasRenderer(config, 60);
      expect(renderer.getTotalFrames()).toBe(60);
      renderer.cleanup();
    });

    it('should handle many scenes', () => {
      const config = singleTrackConfig(320, 240, Array(20).fill(null).map(() => ({ duration: 0.5 })));
      const renderer = new CanvasRenderer(config, 10);
      expect(renderer.getTotalFrames()).toBe(100); // 20 * ceil(0.5*10) = 20*5 = 100
      renderer.cleanup();
    });
  });

  // ========================
  // renderFrame
  // ========================

  describe('renderFrame', () => {
    it('should return raw BGRA buffer', async () => {
      const renderer = new CanvasRenderer(basicConfig, 10);
      const frameBuffer = await renderer.renderFrame(0);

      expect(Buffer.isBuffer(frameBuffer)).toBe(true);
      expect(frameBuffer.length).toBe(320 * 240 * 4); // BGRA
      renderer.cleanup();
    });

    it('should return buffer for last valid frame', async () => {
      const renderer = new CanvasRenderer(basicConfig, 10);
      const lastFrame = renderer.getTotalFrames() - 1;
      const frameBuffer = await renderer.renderFrame(lastFrame);

      expect(Buffer.isBuffer(frameBuffer)).toBe(true);
      expect(frameBuffer.length).toBe(320 * 240 * 4);
      renderer.cleanup();
    });

    it('should return black frame for out-of-range index', async () => {
      const renderer = new CanvasRenderer(basicConfig, 10);
      const frameBuffer = await renderer.renderFrame(999);

      expect(Buffer.isBuffer(frameBuffer)).toBe(true);
      expect(frameBuffer.length).toBe(320 * 240 * 4);
      renderer.cleanup();
    });

    it('should handle frame index 0', async () => {
      const renderer = new CanvasRenderer(basicConfig, 10);
      const frameBuffer = await renderer.renderFrame(0);
      expect(Buffer.isBuffer(frameBuffer)).toBe(true);
      renderer.cleanup();
    });

    it('should produce different backgrounds for different scenes', async () => {
      const config = singleTrackConfig(4, 4, [
          { duration: 1, bgColor: '#ff0000' },
          { duration: 1, bgColor: '#00ff00' },
        ], 10);
      const renderer = new CanvasRenderer(config, 10);

      const frame0 = await renderer.renderFrame(0);   // scene 0
      const frame15 = await renderer.renderFrame(15);  // scene 1

      // Different scenes should produce different pixel data
      expect(frame0.equals(frame15)).toBe(false);
      renderer.cleanup();
    });

    it('should use black background by default', async () => {
      const config = singleTrackConfig(2, 2, [{ duration: 1 }], 10);
      const renderer = new CanvasRenderer(config, 10);
      const frame = await renderer.renderFrame(0);

      // BGRA black = [0,0,0,255] per pixel
      // canvas toBuffer('raw') = BGRA
      expect(frame[0]).toBe(0);   // B
      expect(frame[1]).toBe(0);   // G
      expect(frame[2]).toBe(0);   // R
      expect(frame[3]).toBe(255); // A
      renderer.cleanup();
    });

    it('should produce consistent frames for same index', async () => {
      const renderer = new CanvasRenderer(basicConfig, 10);
      const frame1 = await renderer.renderFrame(5);
      const frame2 = await renderer.renderFrame(5);

      expect(frame1.equals(frame2)).toBe(true);
      renderer.cleanup();
    });
  });

  // ========================
  // renderFrame with elements
  // ========================

  describe('renderFrame with elements', () => {
    it('should render text element', async () => {
      const config = singleTrackConfig(320, 240, [{
          duration: 1, bgColor: '#000000',
          elements: [
            { type: 'text', text: 'Hello', fontSize: 24, color: '#FFFFFF', position: 'center', zIndex: 1 },
          ],
        }], 10);
      const renderer = new CanvasRenderer(config, 10);
      const frame = await renderer.renderFrame(0);
      expect(Buffer.isBuffer(frame)).toBe(true);
      renderer.cleanup();
    });

    it('should render caption element', async () => {
      const config = singleTrackConfig(320, 240, [{
          duration: 3, bgColor: '#000000',
          elements: [
            {
              type: 'caption',
              srtContent: `1\n00:00:00,000 --> 00:00:02,000\nTest caption`,
              position: 'bottom-center', zIndex: 1,
            },
          ],
        }], 10);
      const renderer = new CanvasRenderer(config, 10);
      const frame = await renderer.renderFrame(5); // at 0.5s
      expect(Buffer.isBuffer(frame)).toBe(true);
      renderer.cleanup();
    });

    it('should sort elements by zIndex (lower first)', async () => {
      const config = singleTrackConfig(320, 240, [{
          duration: 1, bgColor: '#000',
          elements: [
            { type: 'text', text: 'Z=10', fontSize: 24, color: '#FF0000', position: 'center', zIndex: 10 },
            { type: 'text', text: 'Z=1', fontSize: 24, color: '#00FF00', position: 'center', zIndex: 1 },
            { type: 'text', text: 'Z=5', fontSize: 24, color: '#0000FF', position: 'center', zIndex: 5 },
          ],
        }], 10);
      const renderer = new CanvasRenderer(config, 10);
      const frame = await renderer.renderFrame(0);
      expect(Buffer.isBuffer(frame)).toBe(true);
      renderer.cleanup();
    });

    it('should handle elements with default zIndex (0)', async () => {
      const config = singleTrackConfig(320, 240, [{
          duration: 1,
          elements: [
            { type: 'text', text: 'A', fontSize: 20, color: '#FFF', position: 'center', zIndex: 0 },
            { type: 'text', text: 'B', fontSize: 20, color: '#FFF', position: 'top-left', zIndex: 0 },
          ],
        }], 10);
      const renderer = new CanvasRenderer(config, 10);
      const frame = await renderer.renderFrame(0);
      expect(Buffer.isBuffer(frame)).toBe(true);
      renderer.cleanup();
    });

    it('should respect element start time', async () => {
      const config = singleTrackConfig(320, 240, [{
          duration: 3, bgColor: '#000',
          elements: [
            { type: 'text', text: 'Late', fontSize: 24, color: '#FFF', position: 'center', zIndex: 1, start: 2 },
          ],
        }], 10);
      const renderer = new CanvasRenderer(config, 10);

      // Frame 5 = 0.5s → text not visible (starts at 2s)
      const earlyFrame = await renderer.renderFrame(5);
      // Frame 25 = 2.5s → text visible
      const lateFrame = await renderer.renderFrame(25);

      expect(Buffer.isBuffer(earlyFrame)).toBe(true);
      expect(Buffer.isBuffer(lateFrame)).toBe(true);
      renderer.cleanup();
    });

    it('should respect element duration', async () => {
      const config = singleTrackConfig(320, 240, [{
          duration: 5, bgColor: '#000',
          elements: [
            { type: 'text', text: 'Brief', fontSize: 24, color: '#FFF', position: 'center', zIndex: 1, start: 0, duration: 1 },
          ],
        }], 10);
      const renderer = new CanvasRenderer(config, 10);
      const frame = await renderer.renderFrame(0);
      expect(Buffer.isBuffer(frame)).toBe(true);
      renderer.cleanup();
    });

    it('should render multiple text elements at different positions', async () => {
      const config = singleTrackConfig(320, 240, [{
          duration: 1, bgColor: '#111',
          elements: [
            { type: 'text', text: 'TL', fontSize: 16, color: '#FFF', position: 'top-left', zIndex: 1 },
            { type: 'text', text: 'TR', fontSize: 16, color: '#FFF', position: 'top-right', zIndex: 2 },
            { type: 'text', text: 'BL', fontSize: 16, color: '#FFF', position: 'bottom-left', zIndex: 3 },
            { type: 'text', text: 'BR', fontSize: 16, color: '#FFF', position: 'bottom-right', zIndex: 4 },
            { type: 'text', text: 'C', fontSize: 16, color: '#FFF', position: 'center', zIndex: 5 },
          ],
        }], 10);
      const renderer = new CanvasRenderer(config, 10);
      const frame = await renderer.renderFrame(0);
      expect(Buffer.isBuffer(frame)).toBe(true);
      renderer.cleanup();
    });
  });

  // ========================
  // Multi-scene
  // ========================

  describe('multi-scene', () => {
    it('should handle two scenes', async () => {
      const config = singleTrackConfig(320, 240, [
          { duration: 1, bgColor: '#ff0000' },
          { duration: 1, bgColor: '#00ff00' },
        ], 10);
      const renderer = new CanvasRenderer(config, 10);

      const frame5 = await renderer.renderFrame(5);   // scene 0
      const frame15 = await renderer.renderFrame(15);  // scene 1

      expect(Buffer.isBuffer(frame5)).toBe(true);
      expect(Buffer.isBuffer(frame15)).toBe(true);
      renderer.cleanup();
    });

    it('should transition at exact boundary', async () => {
      const config = singleTrackConfig(4, 4, [
          { duration: 1, bgColor: '#ff0000' },
          { duration: 1, bgColor: '#00ff00' },
        ], 10);
      const renderer = new CanvasRenderer(config, 10);

      const lastOfScene0 = await renderer.renderFrame(9);   // last frame of scene 0
      const firstOfScene1 = await renderer.renderFrame(10);  // first frame of scene 1

      expect(lastOfScene0.equals(firstOfScene1)).toBe(false);
      renderer.cleanup();
    });

    it('should handle 10 scenes', async () => {
      const config = singleTrackConfig(320, 240, Array(10).fill(null).map((_, i) => ({
          duration: 0.5,
          bgColor: `#${(i * 28).toString(16).padStart(2, '0')}0000`,
        })), 10);
      const renderer = new CanvasRenderer(config, 10);
      expect(renderer.getTotalFrames()).toBe(50);

      const frame = await renderer.renderFrame(25);
      expect(Buffer.isBuffer(frame)).toBe(true);
      renderer.cleanup();
    });
  });

  // ========================
  // Scene without elements
  // ========================

  describe('empty scenes', () => {
    it('should render scene without elements', async () => {
      const config = singleTrackConfig(320, 240, [{ duration: 1, bgColor: '#333333' }], 10);
      const renderer = new CanvasRenderer(config, 10);
      const frame = await renderer.renderFrame(0);
      expect(Buffer.isBuffer(frame)).toBe(true);
      renderer.cleanup();
    });

    it('should render scene with empty elements array', async () => {
      const config = singleTrackConfig(320, 240, [{ duration: 1, elements: [] }], 10);
      const renderer = new CanvasRenderer(config, 10);
      const frame = await renderer.renderFrame(0);
      expect(Buffer.isBuffer(frame)).toBe(true);
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
          elements: [
            { type: 'text', text: 'No assets', fontSize: 20, color: '#FFF', position: 'center', zIndex: 1 },
          ],
        }], 10);
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
            type: 'caption',
            srtContent: '1\n00:00:00,000 --> 00:00:01,000\nTest',
            position: 'center', zIndex: 1,
          }],
        }], 10);
      const renderer = new CanvasRenderer(config, 10);
      await expect(renderer.preloadAssets()).resolves.toBeUndefined();
      renderer.cleanup();
    });
  });

  // ========================
  // getAssetLoader / cleanup
  // ========================

  describe('getAssetLoader & cleanup', () => {
    it('should return asset loader instance', () => {
      const renderer = new CanvasRenderer(basicConfig, 10);
      expect(renderer.getAssetLoader()).toBeDefined();
      renderer.cleanup();
    });

    it('should not throw on cleanup', () => {
      const renderer = new CanvasRenderer(basicConfig, 10);
      expect(() => renderer.cleanup()).not.toThrow();
    });

    it('should not throw on double cleanup', () => {
      const renderer = new CanvasRenderer(basicConfig, 10);
      renderer.cleanup();
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
      const frame = await renderer.renderFrame(0);
      expect(frame.length).toBe(4); // 1x1 BGRA
      renderer.cleanup();
    });

    it('should handle large canvas', async () => {
      const config = singleTrackConfig(1920, 1080, [{ duration: 1 }], 1);
      const renderer = new CanvasRenderer(config, 1);
      const frame = await renderer.renderFrame(0);
      expect(frame.length).toBe(1920 * 1080 * 4);
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
    it('should compute getTotalFrames from tracks', () => {
      const config: VideoConfig = {
        width: 320, height: 240,
        tracks: [
          { type: 'video', zIndex: 0, start: 0, scenes: [{ duration: 2 }] },
          { type: 'video', zIndex: 1, start: 1, scenes: [{ duration: 3 }] },
        ],
      };
      const renderer = new CanvasRenderer(config, 10);
      // Track 0: 0+2=2s, Track 1: 1+3=4s → max=4s → 4*10=40 frames
      expect(renderer.getTotalFrames()).toBe(40);
      renderer.cleanup();
    });

    it('should compute getTotalFrames including audio tracks', () => {
      const config: VideoConfig = {
        width: 320, height: 240,
        tracks: [
          { type: 'video', zIndex: 0, scenes: [{ duration: 2 }] },
          { type: 'audio', start: 0, scenes: [{ duration: 5 }] },
        ],
      };
      const renderer = new CanvasRenderer(config, 10);
      // max(2, 5) = 5s → 50 frames
      expect(renderer.getTotalFrames()).toBe(50);
      renderer.cleanup();
    });

    it('should render frame with single video track', async () => {
      const config: VideoConfig = {
        width: 4, height: 4,
        tracks: [
          {
            type: 'video', zIndex: 0, start: 0,
            scenes: [{ duration: 1, bgColor: '#ff0000' }],
          },
        ],
      };
      const renderer = new CanvasRenderer(config, 10);
      const frame = await renderer.renderFrame(0);
      expect(Buffer.isBuffer(frame)).toBe(true);
      expect(frame.length).toBe(4 * 4 * 4); // BGRA
      renderer.cleanup();
    });

    it('should render frame with two overlapping video tracks', async () => {
      const config: VideoConfig = {
        width: 4, height: 4,
        tracks: [
          {
            type: 'video', zIndex: 0, start: 0,
            scenes: [{ duration: 2, bgColor: '#ff0000' }],
          },
          {
            type: 'video', zIndex: 1, start: 0,
            scenes: [{
              duration: 2,
              elements: [
                { type: 'text', text: 'Hi', fontSize: 8, color: '#FFF', position: 'center', zIndex: 0 },
              ],
            }],
          },
        ],
      };
      const renderer = new CanvasRenderer(config, 10);
      const frame = await renderer.renderFrame(5);
      expect(Buffer.isBuffer(frame)).toBe(true);
      renderer.cleanup();
    });

    it('should not render overlay track before its start time', async () => {
      const config: VideoConfig = {
        width: 4, height: 4,
        tracks: [
          {
            type: 'video', zIndex: 0, start: 0,
            scenes: [{ duration: 3, bgColor: '#ff0000' }],
          },
          {
            type: 'video', zIndex: 1, start: 2,
            scenes: [{ duration: 1, bgColor: '#00ff00' }],
          },
        ],
      };
      const renderer = new CanvasRenderer(config, 10);

      // At frame 5 (0.5s), only track 0 is active
      const earlyFrame = await renderer.renderFrame(5);
      // At frame 25 (2.5s), both tracks are active
      const lateFrame = await renderer.renderFrame(25);

      expect(Buffer.isBuffer(earlyFrame)).toBe(true);
      expect(Buffer.isBuffer(lateFrame)).toBe(true);
      // They should differ because late frame has overlay bgColor
      expect(earlyFrame.equals(lateFrame)).toBe(false);
      renderer.cleanup();
    });

    it('should render overlay track without bgColor as transparent', async () => {
      const config: VideoConfig = {
        width: 4, height: 4,
        tracks: [
          {
            type: 'video', zIndex: 0, start: 0,
            scenes: [{ duration: 1, bgColor: '#ff0000' }],
          },
          {
            type: 'video', zIndex: 1, start: 0,
            scenes: [{
              duration: 1,
              // no bgColor → transparent, should show track 0's red bg through
              elements: [],
            }],
          },
        ],
      };
      const renderer = new CanvasRenderer(config, 10);
      const frame = await renderer.renderFrame(0);

      // bg should still be red (from track 0), not overwritten
      expect(frame[0]).toBe(0);   // B
      expect(frame[1]).toBe(0);   // G
      expect(frame[2]).toBe(255); // R
      expect(frame[3]).toBe(255); // A
      renderer.cleanup();
    });

    it('should handle track with multiple scenes', async () => {
      const config: VideoConfig = {
        width: 4, height: 4,
        tracks: [
          {
            type: 'video', zIndex: 0, start: 0,
            scenes: [
              { duration: 1, bgColor: '#ff0000' },
              { duration: 1, bgColor: '#00ff00' },
            ],
          },
        ],
      };
      const renderer = new CanvasRenderer(config, 10);
      expect(renderer.getTotalFrames()).toBe(20);

      const frame0 = await renderer.renderFrame(0);   // scene 0: red
      const frame15 = await renderer.renderFrame(15);  // scene 1: green

      expect(frame0.equals(frame15)).toBe(false);
      renderer.cleanup();
    });

    it('should handle audio-only track (no visual rendering)', async () => {
      const config: VideoConfig = {
        width: 4, height: 4,
        tracks: [
          {
            type: 'video', zIndex: 0,
            scenes: [{ duration: 1, bgColor: '#000' }],
          },
          {
            type: 'audio', start: 0,
            scenes: [{ duration: 1 }],
          },
        ],
      };
      const renderer = new CanvasRenderer(config, 10);
      const frame = await renderer.renderFrame(0);
      expect(Buffer.isBuffer(frame)).toBe(true);
      renderer.cleanup();
    });

    it('should render track with scene transition', async () => {
      const config: VideoConfig = {
        width: 4, height: 4,
        tracks: [
          {
            type: 'video', zIndex: 0,
            scenes: [
              { duration: 1, bgColor: '#ff0000' },
              { duration: 1, bgColor: '#00ff00', transition: { type: 'fade', duration: 0.5 } },
            ],
          },
        ],
      };
      const renderer = new CanvasRenderer(config, 10);
      // Frame at start of scene 2 (t=1.0s) should be in fade transition
      const frame = await renderer.renderFrame(10);
      expect(Buffer.isBuffer(frame)).toBe(true);
      renderer.cleanup();
    });

    it('should render elements with opacity', async () => {
      const config: VideoConfig = {
        width: 4, height: 4,
        tracks: [
          {
            type: 'video', zIndex: 0,
            scenes: [
              {
                duration: 2, bgColor: '#000',
                elements: [
                  {
                    type: 'text',
                    text: 'Transparent',
                    position: 'center',
                    zIndex: 1,
                    opacity: 0.5,
                  },
                ],
              },
            ],
          },
        ],
      };
      const renderer = new CanvasRenderer(config, 10);
      const frame = await renderer.renderFrame(0);
      expect(Buffer.isBuffer(frame)).toBe(true);
      renderer.cleanup();
    });

    it('should render elements with animation', async () => {
      const config: VideoConfig = {
        width: 4, height: 4,
        tracks: [
          {
            type: 'video', zIndex: 0,
            scenes: [
              {
                duration: 2, bgColor: '#000',
                elements: [
                  {
                    type: 'text',
                    text: 'Fade In',
                    position: 'center',
                    zIndex: 1,
                    animation: { type: 'fadeIn', fadeInDuration: 0.5 },
                  },
                ],
              },
            ],
          },
        ],
      };
      const renderer = new CanvasRenderer(config, 10);
      const frame = await renderer.renderFrame(2); // t=0.2s, mid-fade
      expect(Buffer.isBuffer(frame)).toBe(true);
      renderer.cleanup();
    });

    it('should render elements with custom x/y', async () => {
      const config: VideoConfig = {
        width: 100, height: 100,
        tracks: [
          {
            type: 'video', zIndex: 0,
            scenes: [
              {
                duration: 1, bgColor: '#000',
                elements: [
                  {
                    type: 'text',
                    text: 'Custom',
                    position: 'center',
                    zIndex: 1,
                    offsetX: 10,
                    offsetY: 20,
                  },
                ],
              },
            ],
          },
        ],
      };
      const renderer = new CanvasRenderer(config, 10);
      const frame = await renderer.renderFrame(0);
      expect(Buffer.isBuffer(frame)).toBe(true);
      renderer.cleanup();
    });

    it('should handle tracks with start offset', async () => {
      const config: VideoConfig = {
        width: 4, height: 4,
        tracks: [
          {
            type: 'video', zIndex: 0,
            scenes: [{ duration: 3, bgColor: '#000' }],
          },
          {
            type: 'video', zIndex: 1, start: 1,
            scenes: [
              {
                duration: 2, bgColor: undefined,
                elements: [
                  { type: 'text', text: 'Delayed', position: 'center', zIndex: 1 },
                ],
              },
            ],
          },
        ],
      };
      const renderer = new CanvasRenderer(config, 10);
      // Before track 1 starts
      const frame0 = await renderer.renderFrame(0);
      // After track 1 starts
      const frame15 = await renderer.renderFrame(15);
      expect(Buffer.isBuffer(frame0)).toBe(true);
      expect(Buffer.isBuffer(frame15)).toBe(true);
      renderer.cleanup();
    });
  });
});
