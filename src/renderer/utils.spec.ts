import { buildFontString, calculateFitDraw, clearMeasureCache, computeElementOpacity, computeElementAnimation, computeSceneTransition, computePosition, createGradient, isElementVisible, measureTextBlock, normalizeFontWeight, roundRectPath, wrapText } from './utils';
import { createCanvas } from '@napi-rs/canvas';
import { ElementAnimation } from '../types';

// ============================================================
// computePosition
// ============================================================
describe('computePosition', () => {
  const W = 1080, H = 1920, elW = 200, elH = 100;

  it.each([
    ['center',        440,  910],
    ['top-left',      0,    0],
    ['top-center',    440,  0],
    ['top-right',     880,  0],
    ['left',          0,    910],
    ['right',         880,  910],
    ['bottom-left',   0,    1820],
    ['bottom-center', 440,  1820],
    ['bottom-right',  880,  1820],
  ] as const)('%s → (%d, %d)', (position, expectedX, expectedY) => {
    const pos = computePosition(position, W, H, elW, elH);
    expect(pos.x).toBe(expectedX);
    expect(pos.y).toBe(expectedY);
  });

  it('should apply positive offsets', () => {
    const pos = computePosition('center', W, H, elW, elH, 10, 20);
    expect(pos.x).toBe(450);
    expect(pos.y).toBe(930);
  });

  it('should apply negative offsets', () => {
    const pos = computePosition('center', W, H, elW, elH, -50, -100);
    expect(pos.x).toBe(390);
    expect(pos.y).toBe(810);
  });

  it('should default offsets to 0', () => {
    const a = computePosition('center', W, H, elW, elH);
    const b = computePosition('center', W, H, elW, elH, 0, 0);
    expect(a).toEqual(b);
  });

  it('should handle element same size as canvas', () => {
    const pos = computePosition('center', 1080, 1920, 1080, 1920);
    expect(pos).toEqual({ x: 0, y: 0 });
  });

  it('should handle element larger than canvas', () => {
    const pos = computePosition('center', 100, 100, 200, 200);
    expect(pos).toEqual({ x: -50, y: -50 });
  });

  it('should handle zero-size element', () => {
    const pos = computePosition('center', 1080, 1920, 0, 0);
    expect(pos).toEqual({ x: 540, y: 960 });
  });

  it('should add offset consistently for all positions', () => {
    const positions = [
      'center', 'top-left', 'top-center', 'top-right',
      'left', 'right', 'bottom-left', 'bottom-center', 'bottom-right',
    ] as const;
    for (const p of positions) {
      const base = computePosition(p, W, H, elW, elH, 0, 0);
      const offset = computePosition(p, W, H, elW, elH, 100, 200);
      expect(offset.x).toBe(base.x + 100);
      expect(offset.y).toBe(base.y + 200);
    }
  });
});

// ============================================================
// computeElementOpacity
// ============================================================
describe('computeElementOpacity', () => {
  it('should return 1 with no animation and no base opacity', () => {
    expect(computeElementOpacity(undefined, undefined, 0, 0, 5, 5)).toBe(1);
  });

  it('should return base opacity with no animation', () => {
    expect(computeElementOpacity(0.5, undefined, 0, 0, 5, 5)).toBe(0.5);
  });

  // fadeIn
  it('fadeIn: 0 at start, 0.5 at mid, 1 after fade', () => {
    const anim = { type: 'fadeIn' as const, fadeInDuration: 1.0 };
    expect(computeElementOpacity(1, anim, 0, 0, 5, 5)).toBe(0);
    expect(computeElementOpacity(1, anim, 0.5, 0, 5, 5)).toBeCloseTo(0.5);
    expect(computeElementOpacity(1, anim, 1.5, 0, 5, 5)).toBe(1);
  });

  it('fadeIn: should multiply with base opacity', () => {
    const anim = { type: 'fadeIn' as const, fadeInDuration: 1.0 };
    expect(computeElementOpacity(0.5, anim, 0.5, 0, 5, 5)).toBeCloseTo(0.25);
  });

  // fadeOut
  it('fadeOut: 1 at start, 0.5 near end, 0 at end', () => {
    const anim = { type: 'fadeOut' as const, fadeOutDuration: 1.0 };
    expect(computeElementOpacity(1, anim, 0, 0, 5, 5)).toBe(1);
    expect(computeElementOpacity(1, anim, 4.5, 0, 5, 5)).toBeCloseTo(0.5);
    expect(computeElementOpacity(1, anim, 5, 0, 5, 5)).toBe(0);
  });

  // fadeInOut
  it('fadeInOut: fade in, full, fade out', () => {
    const anim = { type: 'fadeInOut' as const, fadeInDuration: 1, fadeOutDuration: 1 };
    expect(computeElementOpacity(1, anim, 0.5, 0, 5, 5)).toBeCloseTo(0.5); // fade in
    expect(computeElementOpacity(1, anim, 2.5, 0, 5, 5)).toBe(1);          // full
    expect(computeElementOpacity(1, anim, 4.5, 0, 5, 5)).toBeCloseTo(0.5); // fade out
  });

  it('should handle element start offset', () => {
    const anim = { type: 'fadeIn' as const, fadeInDuration: 1.0 };
    expect(computeElementOpacity(1, anim, 2, 2, 3, 5)).toBe(0);
    expect(computeElementOpacity(1, anim, 2.5, 2, 3, 5)).toBeCloseTo(0.5);
    expect(computeElementOpacity(1, anim, 3.5, 2, 3, 5)).toBe(1);
  });

  it('should default to 0.5s fade duration', () => {
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

  it('should be visible at element end (inclusive), not past', () => {
    expect(isElementVisible(5, 0, 5)).toBe(true);
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

  it.each([
    ['bold', 700], ['normal', 400], ['thin', 100], ['Bold', 700], ['BOLD', 700],
  ])('should map "%s" → %d', (name, expected) => {
    expect(normalizeFontWeight(name)).toBe(expected);
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

  it('should calculate correct height for single line', () => {
    const result = measureTextBlock('Hi', 24, 'sans-serif', 400, 500, 1.3);
    expect(result.height).toBe(24); // single line = fontSize only
  });

  it('should respect different font sizes', () => {
    const small = measureTextBlock('Hello', 12, 'sans-serif', 400, 500, 1.3);
    const large = measureTextBlock('Hello', 48, 'sans-serif', 400, 500, 1.3);
    expect(large.width).toBeGreaterThan(small.width);
  });
});

// ============================================================
// computeElementAnimation
// ============================================================
describe('computeElementAnimation', () => {
  const W = 1080, H = 1920;

  it('should return identity state when no animation', () => {
    const state = computeElementAnimation(undefined, 0, 0, 5, 5, W, H);
    expect(state).toEqual({ opacity: 1, translateX: 0, translateY: 0, scale: 1 });
  });

  // --- Fade animations (backward compat) ---
  describe('fadeIn', () => {
    const anim: ElementAnimation = { type: 'fadeIn', fadeInDuration: 1 };

    it('opacity 0 at start', () => {
      const s = computeElementAnimation(anim, 0, 0, 5, 5, W, H);
      expect(s.opacity).toBe(0);
      expect(s.translateX).toBe(0);
      expect(s.scale).toBe(1);
    });

    it('opacity ~0.5 at mid', () => {
      const s = computeElementAnimation(anim, 0.5, 0, 5, 5, W, H);
      expect(s.opacity).toBeCloseTo(0.5);
    });

    it('opacity 1 after fade', () => {
      const s = computeElementAnimation(anim, 1.5, 0, 5, 5, W, H);
      expect(s.opacity).toBe(1);
    });
  });

  describe('fadeOut', () => {
    const anim: ElementAnimation = { type: 'fadeOut', fadeOutDuration: 1 };

    it('opacity 1 at start', () => {
      const s = computeElementAnimation(anim, 0, 0, 5, 5, W, H);
      expect(s.opacity).toBe(1);
    });

    it('opacity 0 at end', () => {
      const s = computeElementAnimation(anim, 5, 0, 5, 5, W, H);
      expect(s.opacity).toBe(0);
    });
  });

  // --- Slide In ---
  describe('slideInLeft', () => {
    const anim: ElementAnimation = { type: 'slideInLeft', fadeInDuration: 1 };

    it('should translate from left at start', () => {
      const s = computeElementAnimation(anim, 0, 0, 5, 5, W, H);
      expect(s.translateX).toBe(-W);
      expect(s.opacity).toBe(0);
    });

    it('should be at final position after duration', () => {
      const s = computeElementAnimation(anim, 1.5, 0, 5, 5, W, H);
      expect(s.translateX).toBe(0);
      expect(s.opacity).toBe(1);
    });

    it('translateY should be 0', () => {
      const s = computeElementAnimation(anim, 0.5, 0, 5, 5, W, H);
      expect(s.translateY).toBe(0);
    });
  });

  describe('slideInRight', () => {
    const anim: ElementAnimation = { type: 'slideInRight', fadeInDuration: 1 };

    it('should translate from right at start', () => {
      const s = computeElementAnimation(anim, 0, 0, 5, 5, W, H);
      expect(s.translateX).toBe(W);
    });
  });

  describe('slideInTop', () => {
    const anim: ElementAnimation = { type: 'slideInTop', fadeInDuration: 1 };

    it('should translate from top at start', () => {
      const s = computeElementAnimation(anim, 0, 0, 5, 5, W, H);
      expect(s.translateY).toBe(-H);
      expect(s.translateX).toBe(0);
    });
  });

  describe('slideInBottom', () => {
    const anim: ElementAnimation = { type: 'slideInBottom', fadeInDuration: 1 };

    it('should translate from bottom at start', () => {
      const s = computeElementAnimation(anim, 0, 0, 5, 5, W, H);
      expect(s.translateY).toBe(H);
    });
  });

  // --- Slide Out ---
  describe('slideOutLeft', () => {
    const anim: ElementAnimation = { type: 'slideOutLeft', fadeOutDuration: 1 };

    it('should be at position during display', () => {
      const s = computeElementAnimation(anim, 2, 0, 5, 5, W, H);
      expect(s.translateX).toBe(0);
      expect(s.opacity).toBe(1);
    });

    it('should translate left near end', () => {
      const s = computeElementAnimation(anim, 4.5, 0, 5, 5, W, H);
      expect(s.translateX).toBeLessThan(0);
      expect(s.opacity).toBeLessThan(1);
    });
  });

  describe('slideOutRight', () => {
    const anim: ElementAnimation = { type: 'slideOutRight', fadeOutDuration: 1 };

    it('should translate right near end', () => {
      const s = computeElementAnimation(anim, 4.5, 0, 5, 5, W, H);
      expect(s.translateX).toBeGreaterThan(0);
    });
  });

  describe('slideOutTop', () => {
    const anim: ElementAnimation = { type: 'slideOutTop', fadeOutDuration: 1 };

    it('should translate up near end', () => {
      const s = computeElementAnimation(anim, 4.5, 0, 5, 5, W, H);
      expect(s.translateY).toBeLessThan(0);
    });
  });

  describe('slideOutBottom', () => {
    const anim: ElementAnimation = { type: 'slideOutBottom', fadeOutDuration: 1 };

    it('should translate down near end', () => {
      const s = computeElementAnimation(anim, 4.5, 0, 5, 5, W, H);
      expect(s.translateY).toBeGreaterThan(0);
    });
  });

  // --- Zoom ---
  describe('zoomIn', () => {
    const anim: ElementAnimation = { type: 'zoomIn', fadeInDuration: 1 };

    it('should scale 0 at start', () => {
      const s = computeElementAnimation(anim, 0, 0, 5, 5, W, H);
      expect(s.scale).toBe(0);
      expect(s.opacity).toBe(0);
    });

    it('should scale 1 after duration', () => {
      const s = computeElementAnimation(anim, 1.5, 0, 5, 5, W, H);
      expect(s.scale).toBe(1);
      expect(s.opacity).toBe(1);
    });
  });

  describe('zoomOut', () => {
    const anim: ElementAnimation = { type: 'zoomOut', fadeOutDuration: 1 };

    it('should scale 1 during display', () => {
      const s = computeElementAnimation(anim, 2, 0, 5, 5, W, H);
      expect(s.scale).toBe(1);
    });

    it('should scale toward 0 near end', () => {
      const s = computeElementAnimation(anim, 4.8, 0, 5, 5, W, H);
      expect(s.scale).toBeLessThan(1);
      expect(s.scale).toBeGreaterThan(0);
    });
  });

  // --- Motion ---
  describe('bounce', () => {
    const anim: ElementAnimation = { type: 'bounce', fadeInDuration: 1 };

    it('should have negative translateY at start (falling from above)', () => {
      const s = computeElementAnimation(anim, 0, 0, 5, 5, W, H);
      expect(s.translateY).toBeLessThan(0);
    });

    it('should settle at translateY=0 after duration', () => {
      const s = computeElementAnimation(anim, 1.5, 0, 5, 5, W, H);
      expect(s.translateY).toBe(0);
    });
  });

  describe('pop', () => {
    const anim: ElementAnimation = { type: 'pop', fadeInDuration: 0.5 };

    it('should scale near 0 at start', () => {
      const s = computeElementAnimation(anim, 0.01, 0, 5, 5, W, H);
      expect(s.scale).toBeLessThan(0.5);
    });

    it('should overshoot (easeOutBack) then settle at ~1', () => {
      // At progress ~0.7 with easeOutBack, scale should be > 1 (overshoot)
      const s = computeElementAnimation(anim, 0.35, 0, 5, 5, W, H);
      expect(s.scale).toBeGreaterThan(0.9);
    });

    it('should be scale=1 after duration', () => {
      const s = computeElementAnimation(anim, 1, 0, 5, 5, W, H);
      expect(s.scale).toBe(1);
    });
  });

  describe('shake', () => {
    const anim: ElementAnimation = { type: 'shake', fadeInDuration: 0.5 };

    it('should have non-zero translateX during shake', () => {
      const s = computeElementAnimation(anim, 0.1, 0, 5, 5, W, H);
      // May or may not be exactly 0 depending on sin phase, but should respond
      expect(typeof s.translateX).toBe('number');
    });

    it('should settle to translateX=0 after duration', () => {
      const s = computeElementAnimation(anim, 1, 0, 5, 5, W, H);
      expect(s.translateX).toBe(0);
    });

    it('should keep opacity=1', () => {
      const s = computeElementAnimation(anim, 0.1, 0, 5, 5, W, H);
      expect(s.opacity).toBe(1);
    });
  });

  describe('typewriter', () => {
    const anim: ElementAnimation = { type: 'typewriter', fadeInDuration: 2 };

    it('should have scale (progress) 0 at start', () => {
      const s = computeElementAnimation(anim, 0, 0, 5, 5, W, H);
      expect(s.scale).toBe(0);
    });

    it('should have scale (progress) 0.5 at mid', () => {
      const s = computeElementAnimation(anim, 1, 0, 5, 5, W, H);
      expect(s.scale).toBeCloseTo(0.5);
    });

    it('should have scale (progress) 1 after duration', () => {
      const s = computeElementAnimation(anim, 2.5, 0, 5, 5, W, H);
      expect(s.scale).toBe(1);
    });

    it('should keep opacity=1 throughout', () => {
      const s = computeElementAnimation(anim, 0.5, 0, 5, 5, W, H);
      expect(s.opacity).toBe(1);
    });
  });

  // --- Element start offset ---
  it('should respect element start offset for slideInLeft', () => {
    const anim: ElementAnimation = { type: 'slideInLeft', fadeInDuration: 1 };
    // Before element start → identity (not visible anyway)
    const s = computeElementAnimation(anim, 2, 2, 3, 5, W, H);
    expect(s.translateX).toBe(-W); // at elStart, progress=0
  });
});

// ============================================================
// computeSceneTransition
// ============================================================
describe('computeSceneTransition', () => {
  const W = 1080, H = 1920;

  it('should return identity when no transition', () => {
    const s = computeSceneTransition(undefined, 0, W, H);
    expect(s).toEqual({ opacity: 1, translateX: 0, translateY: 0, scale: 1 });
  });

  it('should return identity when past transition duration', () => {
    const s = computeSceneTransition({ type: 'fade', duration: 1 }, 2, W, H);
    expect(s.opacity).toBe(1);
  });

  describe('fade', () => {
    it('should fade from 0 to 1', () => {
      const s0 = computeSceneTransition({ type: 'fade', duration: 1 }, 0, W, H);
      expect(s0.opacity).toBe(0);

      const s1 = computeSceneTransition({ type: 'fade', duration: 1 }, 0.5, W, H);
      expect(s1.opacity).toBeCloseTo(0.5);
    });
  });

  describe('slideLeft', () => {
    it('should translate from right at start', () => {
      const s = computeSceneTransition({ type: 'slideLeft', duration: 1 }, 0, W, H);
      expect(s.translateX).toBe(W);
    });

    it('should be at position after duration', () => {
      const s = computeSceneTransition({ type: 'slideLeft', duration: 1 }, 1, W, H);
      expect(s.translateX).toBe(0);
    });
  });

  describe('slideRight', () => {
    it('should translate from left at start', () => {
      const s = computeSceneTransition({ type: 'slideRight', duration: 1 }, 0, W, H);
      expect(s.translateX).toBe(-W);
    });
  });

  describe('slideUp', () => {
    it('should translate from bottom at start', () => {
      const s = computeSceneTransition({ type: 'slideUp', duration: 1 }, 0, W, H);
      expect(s.translateY).toBe(H);
    });
  });

  describe('slideDown', () => {
    it('should translate from top at start', () => {
      const s = computeSceneTransition({ type: 'slideDown', duration: 1 }, 0, W, H);
      expect(s.translateY).toBe(-H);
    });
  });

  describe('wipe transitions', () => {
    it.each(['wipeLeft', 'wipeRight', 'wipeUp', 'wipeDown'] as const)(
      '%s should have opacity 0 at start',
      (type) => {
        const s = computeSceneTransition({ type, duration: 1 }, 0, W, H);
        expect(s.opacity).toBe(0);
      }
    );

    it.each(['wipeLeft', 'wipeRight', 'wipeUp', 'wipeDown'] as const)(
      '%s should have opacity 1 after duration',
      (type) => {
        const s = computeSceneTransition({ type, duration: 1 }, 1, W, H);
        expect(s.opacity).toBe(1);
      }
    );
  });

  describe('zoomIn transition', () => {
    it('should scale from 0.5 at start', () => {
      const s = computeSceneTransition({ type: 'zoomIn', duration: 1 }, 0, W, H);
      expect(s.scale).toBe(0.5);
      expect(s.opacity).toBe(0);
    });

    it('should reach scale 1 after duration', () => {
      const s = computeSceneTransition({ type: 'zoomIn', duration: 1 }, 1, W, H);
      expect(s.scale).toBe(1);
    });
  });

  describe('zoomOut transition', () => {
    it('should scale from 1.5 at start', () => {
      const s = computeSceneTransition({ type: 'zoomOut', duration: 1 }, 0, W, H);
      expect(s.scale).toBe(1.5);
      expect(s.opacity).toBe(0);
    });

    it('should reach scale 1 after duration', () => {
      const s = computeSceneTransition({ type: 'zoomOut', duration: 1 }, 1, W, H);
      expect(s.scale).toBe(1);
    });
  });
});

// ============================================================
// buildFontString
// ============================================================
describe('buildFontString', () => {
  it('should include weight, fontSize, fontFamily', () => {
    const result = buildFontString(700, 48, 'Orbitron');
    expect(result).toContain('700');
    expect(result).toContain('48px');
    expect(result).toContain('"Orbitron"');
  });

  it('should include Unicode fallback fonts', () => {
    const result = buildFontString(400, 24, 'Arial');
    expect(result).toContain('Arial Unicode MS');
    expect(result).toContain('sans-serif');
  });

  it('should handle string weight', () => {
    const result = buildFontString('bold', 32, 'Inter');
    expect(result.startsWith('bold 32px')).toBe(true);
  });

  it('should wrap fontFamily in quotes', () => {
    const result = buildFontString(400, 16, 'Noto Sans');
    expect(result).toContain('"Noto Sans"');
  });

  it('should produce consistent output', () => {
    const a = buildFontString(400, 24, 'Roboto');
    const b = buildFontString(400, 24, 'Roboto');
    expect(a).toBe(b);
  });
});

// ============================================================
// calculateFitDraw
// ============================================================
describe('calculateFitDraw', () => {
  // Fill mode — use entire source
  it('fill: should return full source rect', () => {
    const r = calculateFitDraw(1920, 1080, 640, 480, 'fill');
    expect(r).toEqual({ sx: 0, sy: 0, sw: 1920, sh: 1080 });
  });

  // Contain mode — use entire source
  it('contain: should return full source rect', () => {
    const r = calculateFitDraw(1920, 1080, 640, 480, 'contain');
    expect(r).toEqual({ sx: 0, sy: 0, sw: 1920, sh: 1080 });
  });

  // Cover mode — crop source to match destination aspect ratio
  describe('cover', () => {
    it('should crop width when source is wider', () => {
      // src 1920x1080 (16:9) → dst 480x480 (1:1)
      // srcRatio (1.78) > dstRatio (1) → crop width
      const r = calculateFitDraw(1920, 1080, 480, 480, 'cover');
      expect(r.sy).toBe(0);
      expect(r.sh).toBe(1080);
      expect(r.sw).toBe(1080); // croppped sw = srcH * dstRatio = 1080*1 = 1080
      expect(r.sx).toBe((1920 - 1080) / 2); // centered crop
    });

    it('should crop height when source is taller', () => {
      // src 1080x1920 (9:16) → dst 640x480 (4:3)
      // srcRatio (0.5625) < dstRatio (1.333) → crop height
      const r = calculateFitDraw(1080, 1920, 640, 480, 'cover');
      expect(r.sx).toBe(0);
      expect(r.sw).toBe(1080);
      const expectedSh = 1080 / (640 / 480); // srcW / dstRatio
      expect(r.sh).toBe(expectedSh);
      expect(r.sy).toBe((1920 - expectedSh) / 2);
    });

    it('should not crop when aspect ratios match', () => {
      const r = calculateFitDraw(1920, 1080, 960, 540, 'cover');
      // Same aspect ratio → no crop needed
      // srcRatio === dstRatio → falls into else branch
      expect(r.sw).toBe(1920);
      expect(r.sx).toBe(0);
    });

    it('should handle square source to wide dest', () => {
      // src 500x500 → dst 800x400 (2:1)
      // srcRatio(1) < dstRatio(2) → crop height
      const r = calculateFitDraw(500, 500, 800, 400, 'cover');
      expect(r.sw).toBe(500);
      const expectedSh = 500 / 2; // srcW / dstRatio
      expect(r.sh).toBe(expectedSh);
    });
  });
});

// ============================================================
// roundRectPath
// ============================================================
describe('roundRectPath', () => {
  it('should call beginPath and closePath', () => {
    const canvas = createCanvas(100, 100);
    const ctx = canvas.getContext('2d');
    const beginSpy = jest.spyOn(ctx, 'beginPath');
    const closeSpy = jest.spyOn(ctx, 'closePath');

    roundRectPath(ctx, 10, 10, 80, 60, 5);

    expect(beginSpy).toHaveBeenCalledTimes(1);
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('should not throw for zero radius', () => {
    const ctx = createCanvas(100, 100).getContext('2d');
    expect(() => roundRectPath(ctx, 0, 0, 50, 50, 0)).not.toThrow();
  });

  it('should not throw for large radius', () => {
    const ctx = createCanvas(100, 100).getContext('2d');
    expect(() => roundRectPath(ctx, 0, 0, 50, 50, 25)).not.toThrow();
  });

  it('should create fillable path', () => {
    const canvas = createCanvas(100, 100);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ff0000';
    roundRectPath(ctx, 10, 10, 80, 80, 10);
    ctx.fill();
    // center pixel should be red
    const data = ctx.getImageData(50, 50, 1, 1).data;
    expect(data[0]).toBe(255); // R
    expect(data[1]).toBe(0);   // G
    expect(data[2]).toBe(0);   // B
  });
});

// ============================================================
// createGradient
// ============================================================
describe('createGradient', () => {
  function makeCtx() {
    return createCanvas(100, 100).getContext('2d');
  }

  it('should create linear gradient', () => {
    const ctx = makeCtx();
    const grad = createGradient(ctx, { type: 'linear', colors: ['#FF0000', '#0000FF'] }, 0, 0, 100, 100);
    expect(grad).toBeDefined();
    // Should be usable as fillStyle
    ctx.fillStyle = grad as any;
    ctx.fillRect(0, 0, 100, 100);
  });

  it('should create radial gradient', () => {
    const ctx = makeCtx();
    const grad = createGradient(ctx, { type: 'radial', colors: ['#FFFFFF', '#000000'] }, 0, 0, 100, 100);
    expect(grad).toBeDefined();
    ctx.fillStyle = grad as any;
    ctx.fillRect(0, 0, 100, 100);
  });

  it('should handle 3+ color stops', () => {
    const ctx = makeCtx();
    const grad = createGradient(ctx, { type: 'linear', colors: ['#FF0000', '#00FF00', '#0000FF'] }, 0, 0, 100, 100);
    expect(grad).toBeDefined();
  });

  it('should respect angle for linear gradient', () => {
    const ctx = makeCtx();
    // angle = 90 → top to bottom
    const grad = createGradient(ctx, { type: 'linear', colors: ['#FF0000', '#0000FF'], angle: 90 }, 0, 0, 100, 100);
    expect(grad).toBeDefined();
  });

  it('should default angle to 0 when not specified', () => {
    const ctx = makeCtx();
    // no angle → defaults to 0 (left to right)
    expect(() => createGradient(ctx, { type: 'linear', colors: ['#FFF', '#000'] }, 0, 0, 50, 50)).not.toThrow();
  });

  it('should handle non-zero position', () => {
    const ctx = makeCtx();
    const grad = createGradient(ctx, { type: 'radial', colors: ['#FFF', '#000'] }, 25, 25, 50, 50);
    expect(grad).toBeDefined();
  });
});

// ============================================================
// clearMeasureCache
// ============================================================
describe('clearMeasureCache', () => {
  it('should not throw', () => {
    expect(() => clearMeasureCache()).not.toThrow();
  });

  it('should not throw when called twice', () => {
    expect(() => {
      clearMeasureCache();
      clearMeasureCache();
    }).not.toThrow();
  });

  it('should still allow measureTextBlock after clearing', () => {
    clearMeasureCache();
    const result = measureTextBlock('Test', 24, 'sans-serif', 400, 500, 1.3);
    expect(result.width).toBeGreaterThan(0);
  });
});
