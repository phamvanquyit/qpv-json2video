import { computeElementOpacity, computePosition, isElementVisible, measureTextBlock, normalizeFontWeight, wrapText } from './utils';
import { createCanvas } from 'canvas';

// ============================================================
// computePosition
// ============================================================
describe('computePosition', () => {
  const canvasW = 1080;
  const canvasH = 1920;
  const elW = 200;
  const elH = 100;

  // --- 9 position types ---
  it('center: should center both axes', () => {
    const pos = computePosition('center', canvasW, canvasH, elW, elH);
    expect(pos.x).toBe(440);
    expect(pos.y).toBe(910);
  });

  it('top-left: should be at origin', () => {
    const pos = computePosition('top-left', canvasW, canvasH, elW, elH);
    expect(pos.x).toBe(0);
    expect(pos.y).toBe(0);
  });

  it('top-center: should center X, Y=0', () => {
    const pos = computePosition('top-center', canvasW, canvasH, elW, elH);
    expect(pos.x).toBe(440);
    expect(pos.y).toBe(0);
  });

  it('top-right: should align right, Y=0', () => {
    const pos = computePosition('top-right', canvasW, canvasH, elW, elH);
    expect(pos.x).toBe(880);
    expect(pos.y).toBe(0);
  });

  it('left: should be X=0, center Y', () => {
    const pos = computePosition('left', canvasW, canvasH, elW, elH);
    expect(pos.x).toBe(0);
    expect(pos.y).toBe(910);
  });

  it('right: should align right, center Y', () => {
    const pos = computePosition('right', canvasW, canvasH, elW, elH);
    expect(pos.x).toBe(880);
    expect(pos.y).toBe(910);
  });

  it('bottom-left: should be X=0, Y at bottom', () => {
    const pos = computePosition('bottom-left', canvasW, canvasH, elW, elH);
    expect(pos.x).toBe(0);
    expect(pos.y).toBe(1820);
  });

  it('bottom-center: should center X, Y at bottom', () => {
    const pos = computePosition('bottom-center', canvasW, canvasH, elW, elH);
    expect(pos.x).toBe(440);
    expect(pos.y).toBe(1820);
  });

  it('bottom-right: should align right and bottom', () => {
    const pos = computePosition('bottom-right', canvasW, canvasH, elW, elH);
    expect(pos.x).toBe(880);
    expect(pos.y).toBe(1820);
  });

  // --- offset ---
  it('should apply positive offsets', () => {
    const pos = computePosition('center', canvasW, canvasH, elW, elH, 10, 20);
    expect(pos.x).toBe(450);
    expect(pos.y).toBe(930);
  });

  it('should apply negative offsets', () => {
    const pos = computePosition('center', canvasW, canvasH, elW, elH, -50, -100);
    expect(pos.x).toBe(390);
    expect(pos.y).toBe(810);
  });

  it('should default offsets to 0', () => {
    const pos1 = computePosition('center', canvasW, canvasH, elW, elH);
    const pos2 = computePosition('center', canvasW, canvasH, elW, elH, 0, 0);
    expect(pos1).toEqual(pos2);
  });

  // --- edge cases ---
  it('should handle element same size as canvas', () => {
    const pos = computePosition('center', 1080, 1920, 1080, 1920);
    expect(pos.x).toBe(0);
    expect(pos.y).toBe(0);
  });

  it('should handle element larger than canvas', () => {
    const pos = computePosition('center', 100, 100, 200, 200);
    expect(pos.x).toBe(-50);
    expect(pos.y).toBe(-50);
  });

  it('should handle zero-size element', () => {
    const pos = computePosition('center', 1080, 1920, 0, 0);
    expect(pos.x).toBe(540);
    expect(pos.y).toBe(960);
  });

  it('should combine offset with all positions', () => {
    const positions = [
      'center', 'top-left', 'top-center', 'top-right',
      'left', 'right', 'bottom-left', 'bottom-center', 'bottom-right',
    ] as const;

    for (const position of positions) {
      const withoutOffset = computePosition(position, canvasW, canvasH, elW, elH, 0, 0);
      const withOffset = computePosition(position, canvasW, canvasH, elW, elH, 100, 200);
      expect(withOffset.x).toBe(withoutOffset.x + 100);
      expect(withOffset.y).toBe(withoutOffset.y + 200);
    }
  });
});

// ============================================================
// computeElementOpacity
// ============================================================
describe('computeElementOpacity', () => {
  it('should return 1 when no animation and no base opacity', () => {
    expect(computeElementOpacity(undefined, undefined, 0, 0, 5, 5)).toBe(1);
  });

  it('should return base opacity when no animation', () => {
    expect(computeElementOpacity(0.5, undefined, 0, 0, 5, 5)).toBe(0.5);
  });

  // --- fadeIn ---
  it('fadeIn: should be 0 at start', () => {
    const anim = { type: 'fadeIn' as const, fadeInDuration: 1.0 };
    expect(computeElementOpacity(1, anim, 0, 0, 5, 5)).toBe(0);
  });

  it('fadeIn: should be 0.5 at half fade', () => {
    const anim = { type: 'fadeIn' as const, fadeInDuration: 1.0 };
    expect(computeElementOpacity(1, anim, 0.5, 0, 5, 5)).toBeCloseTo(0.5);
  });

  it('fadeIn: should be 1 after fade', () => {
    const anim = { type: 'fadeIn' as const, fadeInDuration: 1.0 };
    expect(computeElementOpacity(1, anim, 1.5, 0, 5, 5)).toBe(1);
  });

  it('fadeIn: should multiply with base opacity', () => {
    const anim = { type: 'fadeIn' as const, fadeInDuration: 1.0 };
    expect(computeElementOpacity(0.5, anim, 0.5, 0, 5, 5)).toBeCloseTo(0.25);
  });

  // --- fadeOut ---
  it('fadeOut: should be 1 at start', () => {
    const anim = { type: 'fadeOut' as const, fadeOutDuration: 1.0 };
    expect(computeElementOpacity(1, anim, 0, 0, 5, 5)).toBe(1);
  });

  it('fadeOut: should be 0.5 at half before end', () => {
    const anim = { type: 'fadeOut' as const, fadeOutDuration: 1.0 };
    expect(computeElementOpacity(1, anim, 4.5, 0, 5, 5)).toBeCloseTo(0.5);
  });

  it('fadeOut: should be 0 at end', () => {
    const anim = { type: 'fadeOut' as const, fadeOutDuration: 1.0 };
    expect(computeElementOpacity(1, anim, 5, 0, 5, 5)).toBe(0);
  });

  // --- fadeInOut ---
  it('fadeInOut: should fade in at start', () => {
    const anim = { type: 'fadeInOut' as const, fadeInDuration: 1, fadeOutDuration: 1 };
    expect(computeElementOpacity(1, anim, 0.5, 0, 5, 5)).toBeCloseTo(0.5);
  });

  it('fadeInOut: should be 1 in middle', () => {
    const anim = { type: 'fadeInOut' as const, fadeInDuration: 1, fadeOutDuration: 1 };
    expect(computeElementOpacity(1, anim, 2.5, 0, 5, 5)).toBe(1);
  });

  it('fadeInOut: should fade out at end', () => {
    const anim = { type: 'fadeInOut' as const, fadeInDuration: 1, fadeOutDuration: 1 };
    expect(computeElementOpacity(1, anim, 4.5, 0, 5, 5)).toBeCloseTo(0.5);
  });

  // --- with element start ---
  it('should handle element start offset', () => {
    const anim = { type: 'fadeIn' as const, fadeInDuration: 1.0 };
    expect(computeElementOpacity(1, anim, 2, 2, 3, 5)).toBe(0);
    expect(computeElementOpacity(1, anim, 2.5, 2, 3, 5)).toBeCloseTo(0.5);
    expect(computeElementOpacity(1, anim, 3.5, 2, 3, 5)).toBe(1);
  });

  it('should use default 0.5s fade duration', () => {
    const anim = { type: 'fadeIn' as const };
    expect(computeElementOpacity(1, anim, 0.25, 0, 5, 5)).toBeCloseTo(0.5);
  });

  it('should clamp to 0-1 range', () => {
    const anim = { type: 'fadeIn' as const, fadeInDuration: 1.0 };
    const result = computeElementOpacity(1, anim, -1, 0, 5, 5);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(1);
  });
});

// ============================================================
// isElementVisible
// ============================================================
describe('isElementVisible', () => {
  it('should be visible at time 0 with default start', () => {
    expect(isElementVisible(0, 0, 5, 10)).toBe(true);
  });

  it('should NOT be visible before element start', () => {
    expect(isElementVisible(0.5, 1, 5, 10)).toBe(false);
  });

  it('should NOT be visible after element duration', () => {
    expect(isElementVisible(6, 0, 5, 10)).toBe(false);
  });

  it('should use scene duration when element duration undefined', () => {
    expect(isElementVisible(5, 0, undefined, 10)).toBe(true);
    expect(isElementVisible(11, 0, undefined, 10)).toBe(false);
  });

  it('should be always visible when both durations undefined', () => {
    expect(isElementVisible(0, 0, undefined, undefined)).toBe(true);
    expect(isElementVisible(999, 0, undefined, undefined)).toBe(true);
  });

  it('should be visible exactly at element end (inclusive)', () => {
    expect(isElementVisible(5, 0, 5)).toBe(true);
  });

  it('should NOT be visible just past end', () => {
    expect(isElementVisible(5.01, 0, 5)).toBe(false);
  });

  it('should handle start offset', () => {
    expect(isElementVisible(1, 2, 3)).toBe(false);
    expect(isElementVisible(2, 2, 3)).toBe(true);
    expect(isElementVisible(5, 2, 3)).toBe(true);
    expect(isElementVisible(5.1, 2, 3)).toBe(false);
  });

  it('should handle negative currentTime', () => {
    expect(isElementVisible(-1, 0, 5)).toBe(false);
  });
});

// ============================================================
// normalizeFontWeight
// ============================================================
describe('normalizeFontWeight', () => {
  it('should return number weights as-is', () => {
    expect(normalizeFontWeight(400)).toBe(400);
    expect(normalizeFontWeight(700)).toBe(700);
  });

  it('should clamp out-of-range numbers', () => {
    expect(normalizeFontWeight(0)).toBe(100);
    expect(normalizeFontWeight(9999)).toBe(900);
  });

  it('should parse numeric strings', () => {
    expect(normalizeFontWeight('400')).toBe(400);
    expect(normalizeFontWeight('700')).toBe(700);
  });

  it('should map named weights', () => {
    expect(normalizeFontWeight('bold')).toBe(700);
    expect(normalizeFontWeight('normal')).toBe(400);
    expect(normalizeFontWeight('thin')).toBe(100);
  });

  it('should be case-insensitive', () => {
    expect(normalizeFontWeight('Bold')).toBe(700);
    expect(normalizeFontWeight('BOLD')).toBe(700);
  });

  it('should default unknown to 400', () => {
    expect(normalizeFontWeight('unknown')).toBe(400);
    expect(normalizeFontWeight('')).toBe(400);
  });
});

// ============================================================
// wrapText
// ============================================================
describe('wrapText', () => {
  let ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>;

  beforeEach(() => {
    const canvas = createCanvas(500, 500);
    ctx = canvas.getContext('2d');
    ctx.font = '24px sans-serif';
  });

  it('should return single line for short text', () => {
    expect(wrapText(ctx, 'Hi', 1000)).toEqual(['Hi']);
  });

  it('should wrap long text', () => {
    const text = 'This is a very long sentence that should wrap into multiple lines when rendered';
    const lines = wrapText(ctx, text, 200);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(' ')).toBe(text);
  });

  it('should return [""] for empty string', () => {
    expect(wrapText(ctx, '', 200)).toEqual(['']);
  });

  it('should preserve word order', () => {
    const text = 'alpha beta gamma delta';
    const lines = wrapText(ctx, text, 150);
    expect(lines.join(' ')).toBe(text);
  });
});

// ============================================================
// measureTextBlock
// ============================================================
describe('measureTextBlock', () => {
  it('should return positive dimensions', () => {
    const result = measureTextBlock('Hello', 24, 'sans-serif', 400, 500, 1.3);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it('should wrap text when maxWidth is small', () => {
    const result = measureTextBlock('This is a long sentence', 24, 'sans-serif', 400, 50, 1.3);
    expect(result.lines.length).toBeGreaterThan(1);
  });

  it('should calculate correct height', () => {
    const result = measureTextBlock('Hi', 24, 'sans-serif', 400, 500, 1.3);
    expect(result.height).toBe(Math.ceil(24 * 1.3));
  });

  it('should respect different font sizes', () => {
    const small = measureTextBlock('Hello', 12, 'sans-serif', 400, 500, 1.3);
    const large = measureTextBlock('Hello', 48, 'sans-serif', 400, 500, 1.3);
    expect(large.width).toBeGreaterThan(small.width);
  });
});
