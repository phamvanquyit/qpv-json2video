import { createCanvas } from '@napi-rs/canvas';
import { paintCaption, parseSrt, distributeWordTimings, wrapWords } from './caption.painter';
import { CaptionElement } from '../../types';

const SAMPLE_SRT = `1
00:00:00,000 --> 00:00:02,000
Hello World!

2
00:00:02,500 --> 00:00:05,000
This is the second caption

3
00:00:06,000 --> 00:00:08,500
Third line here`;

const SINGLE_SRT = `1
00:00:00,000 --> 00:00:03,000
Only caption`;

// Helpers
const canvasW = 640;
const canvasH = 480;

function createCtx() {
  return createCanvas(canvasW, canvasH).getContext('2d');
}

function makeCaptionElement(overrides: Partial<CaptionElement> = {}): CaptionElement {
  return {
    type: 'caption',
    srtContent: SAMPLE_SRT,
    position: 'bottom-center',
    zIndex: 10,
    ...overrides,
  };
}

// ==================== paintCaption ====================

describe('paintCaption', () => {
  // Basic rendering at various times
  it.each([0, 1, 3, 7, 10])('should render without throwing at t=%ss', (t) => {
    const ctx = createCtx();
    expect(() => paintCaption(ctx, makeCaptionElement(), canvasW, canvasH, t)).not.toThrow();
  });

  it('should render nothing during gap (2.0–2.5s)', () => {
    const ctx = createCtx();
    expect(() => paintCaption(ctx, makeCaptionElement(), canvasW, canvasH, 2.25)).not.toThrow();
  });

  // Edge cases
  it.each(['', '   \n\n  '])('should handle edge-case srtContent: "%s"', (content) => {
    const ctx = createCtx();
    expect(() => paintCaption(ctx, makeCaptionElement({ srtContent: content }), canvasW, canvasH, 1)).not.toThrow();
  });

  it('should handle malformed SRT (no timestamps)', () => {
    const ctx = createCtx();
    expect(() => paintCaption(ctx, makeCaptionElement({ srtContent: '1\nNo timestamp\nText' }), canvasW, canvasH, 1)).not.toThrow();
  });

  it('should handle single caption', () => {
    const ctx = createCtx();
    expect(() => paintCaption(ctx, makeCaptionElement({ srtContent: SINGLE_SRT }), canvasW, canvasH, 1)).not.toThrow();
  });

  // Style options
  it.each([
    { fontSize: 72 },
    { color: '#FFFF00' },
    { strokeColor: '#FF0000', strokeWidth: 6 },
    { strokeWidth: 0 },
    { backgroundColor: 'rgba(255,0,0,0.5)' },
    { backgroundColor: '' },
    { maxWidth: '50%' },
    { borderRadius: 20 },
    { borderRadius: 0 },
    { offsetX: 20, offsetY: -80 },
    { start: 1 },
    { opacity: 0.5 },
    { opacity: 0 },
  ])('should render with style override: %o', (override) => {
    const ctx = createCtx();
    expect(() => paintCaption(ctx, makeCaptionElement(override), canvasW, canvasH, 1)).not.toThrow();
  });

  // Positions
  it.each([
    'center', 'top-left', 'top-center', 'top-right',
    'left', 'right', 'bottom-left', 'bottom-center', 'bottom-right',
  ] as const)('should render at position=%s', (position) => {
    const ctx = createCtx();
    expect(() => paintCaption(ctx, makeCaptionElement({ position }), canvasW, canvasH, 1)).not.toThrow();
  });

  // Text alignment
  it.each(['left', 'center', 'right'] as const)('should render with textAlign=%s', (textAlign) => {
    const ctx = createCtx();
    expect(() => paintCaption(ctx, makeCaptionElement({ textAlign }), canvasW, canvasH, 1)).not.toThrow();
  });

  // SRT format variants
  it('should parse SRT with dot separator', () => {
    const ctx = createCtx();
    expect(() => paintCaption(ctx, makeCaptionElement({
      srtContent: '1\n00:00:00.000 --> 00:00:02.000\nDot separator',
    }), canvasW, canvasH, 1)).not.toThrow();
  });

  it('should handle multi-line caption text', () => {
    const ctx = createCtx();
    expect(() => paintCaption(ctx, makeCaptionElement({
      srtContent: '1\n00:00:00,000 --> 00:00:05,000\nLine one\ncontinues here',
    }), canvasW, canvasH, 1)).not.toThrow();
  });

  it('should handle unicode in SRT', () => {
    const ctx = createCtx();
    expect(() => paintCaption(ctx, makeCaptionElement({
      srtContent: '1\n00:00:00,000 --> 00:00:03,000\nXin chào 🎬🎥\n\n2\n00:00:03,000 --> 00:00:06,000\n日本語テスト',
    }), canvasW, canvasH, 1)).not.toThrow();
  });

  // Combined full style
  it('should render with all options combined', () => {
    const ctx = createCtx();
    const element = makeCaptionElement({
      fontFamily: 'Arial', fontSize: 42, color: '#FFFF00',
      strokeColor: '#000000', strokeWidth: 3,
      backgroundColor: 'rgba(0,0,0,0.8)', maxWidth: '80%',
      lineHeight: 1.5, textAlign: 'center', borderRadius: 16,
      position: 'bottom-center', offsetX: 0, offsetY: -40,
    });
    expect(() => paintCaption(ctx, element, canvasW, canvasH, 1)).not.toThrow();
  });
});

// ==================== paintCaption — wordHighlight ====================

describe('paintCaption — wordHighlight', () => {
  function makeHighlightElement(overrides: Partial<CaptionElement> = {}): CaptionElement {
    return makeCaptionElement({ wordHighlight: true, ...overrides });
  }

  it('should render with wordHighlight=true', () => {
    const ctx = createCtx();
    expect(() => paintCaption(ctx, makeHighlightElement(), canvasW, canvasH, 1)).not.toThrow();
  });

  it.each([0, 0.5, 1.0, 1.5, 1.9, 2.25])('should render at t=%ss', (t) => {
    const ctx = createCtx();
    expect(() => paintCaption(ctx, makeHighlightElement(), canvasW, canvasH, t)).not.toThrow();
  });

  // Highlight styles
  it.each([
    { highlightStyle: 'color' as const, highlightColor: '#FF0000' },
    { highlightStyle: 'background' as const, highlightBgColor: 'rgba(255,0,0,0.4)' },
    { highlightStyle: 'scale' as const, highlightScale: 1.3 },
  ])('should render with highlightStyle=$highlightStyle', (opts) => {
    const ctx = createCtx();
    expect(() => paintCaption(ctx, makeHighlightElement(opts), canvasW, canvasH, 1)).not.toThrow();
  });

  // Edge cases
  it('should handle single word caption', () => {
    const ctx = createCtx();
    expect(() => paintCaption(ctx, makeHighlightElement({
      srtContent: '1\n00:00:00,000 --> 00:00:02,000\nHello',
    }), canvasW, canvasH, 1)).not.toThrow();
  });

  it('should handle empty SRT', () => {
    const ctx = createCtx();
    expect(() => paintCaption(ctx, makeHighlightElement({ srtContent: '' }), canvasW, canvasH, 1)).not.toThrow();
  });

  it('should handle long wrapping sentence', () => {
    const ctx = createCtx();
    expect(() => paintCaption(ctx, makeHighlightElement({
      srtContent: '1\n00:00:00,000 --> 00:00:05,000\nThis is a very long sentence that should wrap across multiple lines',
      maxWidth: '50%',
    }), canvasW, canvasH, 2)).not.toThrow();
  });

  it('should handle unicode words', () => {
    const ctx = createCtx();
    expect(() => paintCaption(ctx, makeHighlightElement({
      srtContent: '1\n00:00:00,000 --> 00:00:04,000\nXin chào thế giới',
    }), canvasW, canvasH, 2)).not.toThrow();
  });

  it.each(['left', 'center', 'right'] as const)('should work with textAlign=%s', (textAlign) => {
    const ctx = createCtx();
    expect(() => paintCaption(ctx, makeHighlightElement({ textAlign }), canvasW, canvasH, 1)).not.toThrow();
  });

  it('should render with all highlight options combined', () => {
    const ctx = createCtx();
    expect(() => paintCaption(ctx, makeHighlightElement({
      highlightStyle: 'background', highlightColor: '#FFFF00',
      highlightBgColor: 'rgba(255,255,0,0.3)', highlightScale: 1.2,
      fontSize: 48, color: '#FFFFFF', strokeColor: '#000000', strokeWidth: 3,
      backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 16,
      position: 'bottom-center', textAlign: 'center',
    }), canvasW, canvasH, 1)).not.toThrow();
  });
});

// ==================== paintCaption — displayMode='word' (CapCut style) ====================

describe('paintCaption — displayMode=word', () => {
  function makeWordElement(overrides: Partial<CaptionElement> = {}): CaptionElement {
    return makeCaptionElement({ displayMode: 'word', ...overrides });
  }

  it('should render with displayMode=word', () => {
    const ctx = createCtx();
    expect(() => paintCaption(ctx, makeWordElement(), canvasW, canvasH, 1)).not.toThrow();
  });

  it.each([0, 0.5, 1.0, 1.5, 1.9, 2.25, 3, 7])('should render at t=%ss', (t) => {
    const ctx = createCtx();
    expect(() => paintCaption(ctx, makeWordElement(), canvasW, canvasH, t)).not.toThrow();
  });

  // Highlight styles affect the word color in word-by-word mode
  it.each([
    { highlightStyle: 'color' as const, highlightColor: '#FF0000' },
    { highlightStyle: 'background' as const, highlightBgColor: 'rgba(255,0,0,0.4)' },
    { highlightStyle: 'scale' as const },
  ])('should render with highlightStyle=$highlightStyle', (opts) => {
    const ctx = createCtx();
    expect(() => paintCaption(ctx, makeWordElement(opts), canvasW, canvasH, 1)).not.toThrow();
  });

  // Edge cases
  it('should handle single word caption', () => {
    const ctx = createCtx();
    expect(() => paintCaption(ctx, makeWordElement({
      srtContent: '1\n00:00:00,000 --> 00:00:02,000\nHello',
    }), canvasW, canvasH, 1)).not.toThrow();
  });

  it('should handle empty SRT', () => {
    const ctx = createCtx();
    expect(() => paintCaption(ctx, makeWordElement({ srtContent: '' }), canvasW, canvasH, 1)).not.toThrow();
  });

  it('should handle unicode words', () => {
    const ctx = createCtx();
    expect(() => paintCaption(ctx, makeWordElement({
      srtContent: '1\n00:00:00,000 --> 00:00:04,000\nXin chào thế giới',
    }), canvasW, canvasH, 2)).not.toThrow();
  });

  it.each(
    ['top-left', 'top-center', 'center', 'bottom-center', 'bottom-right'] as const
  )('should work at position=%s', (position) => {
    const ctx = createCtx();
    expect(() => paintCaption(ctx, makeWordElement({ position }), canvasW, canvasH, 1)).not.toThrow();
  });

  it('should render with all options combined', () => {
    const ctx = createCtx();
    expect(() => paintCaption(ctx, makeWordElement({
      highlightStyle: 'background', highlightColor: '#FFFF00',
      highlightBgColor: 'rgba(255,255,0,0.3)',
      fontSize: 64, color: '#FFFFFF', strokeColor: '#000000', strokeWidth: 3,
      backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 16,
      position: 'center', textAlign: 'center',
    }), canvasW, canvasH, 1)).not.toThrow();
  });

  it('should not throw when time is between SRT entries (gap)', () => {
    const ctx = createCtx();
    expect(() => paintCaption(ctx, makeWordElement(), canvasW, canvasH, 2.25)).not.toThrow();
  });
});

// ==================== parseSrt ====================

describe('parseSrt', () => {
  it('should parse standard SRT content', () => {
    const entries = parseSrt(SAMPLE_SRT);
    expect(entries).toHaveLength(3);
    expect(entries[0]).toEqual({ startMs: 0, endMs: 2000, text: 'Hello World!' });
    expect(entries[1]).toEqual({ startMs: 2500, endMs: 5000, text: 'This is the second caption' });
    expect(entries[2]).toEqual({ startMs: 6000, endMs: 8500, text: 'Third line here' });
  });

  it('should parse SRT with dot separator', () => {
    const entries = parseSrt('1\n00:00:01.500 --> 00:00:03.000\nDot test');
    expect(entries).toEqual([{ startMs: 1500, endMs: 3000, text: 'Dot test' }]);
  });

  it('should skip malformed blocks', () => {
    const entries = parseSrt('1\nno timestamp\ntext\n\n2\n00:00:00,000 --> 00:00:01,000\nOK');
    expect(entries).toHaveLength(1);
    expect(entries[0].text).toBe('OK');
  });

  it('should return empty for empty/whitespace input', () => {
    expect(parseSrt('')).toEqual([]);
    expect(parseSrt('  \n\n  ')).toEqual([]);
  });

  it('should join multi-line text with spaces', () => {
    const entries = parseSrt('1\n00:00:00,000 --> 00:00:02,000\nLine one\ncontinues here');
    expect(entries[0].text).toBe('Line one continues here');
  });
});

// ==================== distributeWordTimings ====================

describe('distributeWordTimings', () => {
  it('should distribute proportionally by character count', () => {
    const timings = distributeWordTimings({ startMs: 0, endMs: 2000, text: 'Hello World!' });
    expect(timings).toHaveLength(2);
    expect(timings[0].word).toBe('Hello');
    expect(timings[0].startMs).toBe(0);
    expect(timings[1].word).toBe('World!');
    expect(timings[1].endMs).toBe(2000);
  });

  it('should handle single word', () => {
    const timings = distributeWordTimings({ startMs: 1000, endMs: 3000, text: 'Hello' });
    expect(timings).toEqual([{ word: 'Hello', startMs: 1000, endMs: 3000 }]);
  });

  it('should handle empty text', () => {
    expect(distributeWordTimings({ startMs: 0, endMs: 1000, text: '' })).toHaveLength(0);
  });

  it('should cover full time range without gaps', () => {
    const timings = distributeWordTimings({ startMs: 500, endMs: 5500, text: 'A BB CCC DDDD' });
    expect(timings).toHaveLength(4);
    expect(timings[0].startMs).toBe(500);
    expect(timings[3].endMs).toBe(5500);
    for (let i = 1; i < timings.length; i++) {
      expect(timings[i].startMs).toBe(timings[i - 1].endMs);
    }
  });

  it('should give longer words more time', () => {
    const timings = distributeWordTimings({ startMs: 0, endMs: 10000, text: 'I wonderful' });
    const shortDur = timings[0].endMs - timings[0].startMs;
    const longDur = timings[1].endMs - timings[1].startMs;
    expect(longDur).toBeGreaterThan(shortDur);
  });
});

// ==================== wrapWords ====================

describe('wrapWords', () => {
  function createWrapCtx() {
    const ctx = createCanvas(640, 480).getContext('2d');
    ctx.font = '700 32px "sans-serif"';
    return ctx;
  }

  it('should put all words on one line if they fit', () => {
    expect(wrapWords(createWrapCtx(), ['Hi', 'there'], 9999)).toEqual([[0, 1]]);
  });

  it('should wrap to multiple lines', () => {
    const words = 'This is a very long sentence that wraps'.split(' ');
    const result = wrapWords(createWrapCtx(), words, 200);
    expect(result.length).toBeGreaterThan(1);
    expect(result.flat()).toEqual(words.map((_, i) => i));
  });

  it('should handle single word', () => {
    expect(wrapWords(createWrapCtx(), ['Hello'], 9999)).toEqual([[0]]);
  });

  it('should handle empty words array', () => {
    expect(wrapWords(createWrapCtx(), [], 9999)).toEqual([[]]);
  });
});
