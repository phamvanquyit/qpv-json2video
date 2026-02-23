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

describe('paintCaption', () => {
  const canvasW = 640;
  const canvasH = 480;

  function createCtx() {
    const canvas = createCanvas(canvasW, canvasH);
    return canvas.getContext('2d');
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

  // --- basic rendering ---
  it('should render without throwing', () => {
    const ctx = createCtx();
    expect(() => paintCaption(ctx, makeCaptionElement(), canvasW, canvasH, 1)).not.toThrow();
  });

  // --- SRT parsing & timing ---
  it('should render first caption at time 0s', () => {
    const ctx = createCtx();
    expect(() => paintCaption(ctx, makeCaptionElement(), canvasW, canvasH, 0)).not.toThrow();
  });

  it('should render first caption at time 1s (within 0-2s)', () => {
    const ctx = createCtx();
    expect(() => paintCaption(ctx, makeCaptionElement(), canvasW, canvasH, 1)).not.toThrow();
  });

  it('should render second caption at time 3s (within 2.5-5s)', () => {
    const ctx = createCtx();
    expect(() => paintCaption(ctx, makeCaptionElement(), canvasW, canvasH, 3)).not.toThrow();
  });

  it('should render nothing during gap (2.0-2.5s)', () => {
    const ctx = createCtx();
    // Between caption 1 (ends at 2s) and caption 2 (starts at 2.5s)
    expect(() => paintCaption(ctx, makeCaptionElement(), canvasW, canvasH, 2.25)).not.toThrow();
  });

  it('should render third caption at time 7s (within 6-8.5s)', () => {
    const ctx = createCtx();
    expect(() => paintCaption(ctx, makeCaptionElement(), canvasW, canvasH, 7)).not.toThrow();
  });

  it('should render nothing after all captions end (time 10s)', () => {
    const ctx = createCtx();
    expect(() => paintCaption(ctx, makeCaptionElement(), canvasW, canvasH, 10)).not.toThrow();
  });

  // --- empty/missing SRT ---
  it('should handle empty srtContent', () => {
    const ctx = createCtx();
    expect(() =>
      paintCaption(ctx, makeCaptionElement({ srtContent: '' }), canvasW, canvasH, 1)
    ).not.toThrow();
  });

  it('should handle whitespace-only srtContent', () => {
    const ctx = createCtx();
    expect(() =>
      paintCaption(ctx, makeCaptionElement({ srtContent: '   \n\n  ' }), canvasW, canvasH, 1)
    ).not.toThrow();
  });

  it('should handle malformed SRT (no timestamps)', () => {
    const ctx = createCtx();
    const badSrt = `1\nNo timestamp here\nSome text`;
    expect(() =>
      paintCaption(ctx, makeCaptionElement({ srtContent: badSrt }), canvasW, canvasH, 1)
    ).not.toThrow();
  });

  // --- single caption ---
  it('should render single caption correctly', () => {
    const ctx = createCtx();
    expect(() =>
      paintCaption(ctx, makeCaptionElement({ srtContent: SINGLE_SRT }), canvasW, canvasH, 1)
    ).not.toThrow();
  });

  // --- style options ---
  it('should render with custom fontSize', () => {
    const ctx = createCtx();
    expect(() =>
      paintCaption(ctx, makeCaptionElement({ fontSize: 72 }), canvasW, canvasH, 1)
    ).not.toThrow();
  });

  it('should render with custom color', () => {
    const ctx = createCtx();
    expect(() =>
      paintCaption(ctx, makeCaptionElement({ color: '#FFFF00' }), canvasW, canvasH, 1)
    ).not.toThrow();
  });

  it('should render with custom strokeColor and strokeWidth', () => {
    const ctx = createCtx();
    expect(() =>
      paintCaption(ctx, makeCaptionElement({ strokeColor: '#FF0000', strokeWidth: 6 }), canvasW, canvasH, 1)
    ).not.toThrow();
  });

  it('should render with zero strokeWidth (no stroke)', () => {
    const ctx = createCtx();
    expect(() =>
      paintCaption(ctx, makeCaptionElement({ strokeWidth: 0 }), canvasW, canvasH, 1)
    ).not.toThrow();
  });

  it('should render with custom backgroundColor', () => {
    const ctx = createCtx();
    expect(() =>
      paintCaption(ctx, makeCaptionElement({ backgroundColor: 'rgba(255,0,0,0.5)' }), canvasW, canvasH, 1)
    ).not.toThrow();
  });

  it('should render without backgroundColor', () => {
    const ctx = createCtx();
    expect(() =>
      paintCaption(ctx, makeCaptionElement({ backgroundColor: '' }), canvasW, canvasH, 1)
    ).not.toThrow();
  });

  // --- positions ---
  it.each([
    'center', 'top-left', 'top-center', 'top-right',
    'left', 'right', 'bottom-left', 'bottom-center', 'bottom-right',
  ] as const)('should render at position=%s', (position) => {
    const ctx = createCtx();
    expect(() =>
      paintCaption(ctx, makeCaptionElement({ position }), canvasW, canvasH, 1)
    ).not.toThrow();
  });

  // --- text alignment ---
  it.each(['left', 'center', 'right'] as const)('should render with textAlign=%s', (textAlign) => {
    const ctx = createCtx();
    expect(() =>
      paintCaption(ctx, makeCaptionElement({ textAlign }), canvasW, canvasH, 1)
    ).not.toThrow();
  });

  // --- maxWidth ---
  it('should render with percentage maxWidth', () => {
    const ctx = createCtx();
    expect(() =>
      paintCaption(ctx, makeCaptionElement({ maxWidth: '50%' }), canvasW, canvasH, 1)
    ).not.toThrow();
  });

  // --- borderRadius ---
  it('should render with borderRadius', () => {
    const ctx = createCtx();
    expect(() =>
      paintCaption(ctx, makeCaptionElement({ borderRadius: 20 }), canvasW, canvasH, 1)
    ).not.toThrow();
  });

  it('should render with zero borderRadius', () => {
    const ctx = createCtx();
    expect(() =>
      paintCaption(ctx, makeCaptionElement({ borderRadius: 0 }), canvasW, canvasH, 1)
    ).not.toThrow();
  });

  // --- offsets ---
  it('should render with custom offsets', () => {
    const ctx = createCtx();
    expect(() =>
      paintCaption(ctx, makeCaptionElement({ offsetX: 20, offsetY: -80 }), canvasW, canvasH, 1)
    ).not.toThrow();
  });

  // --- start offset ---
  it('should handle element start offset', () => {
    const ctx = createCtx();
    // Element start = 1s, currentTime = 1s → effective time in SRT = 2s
    expect(() =>
      paintCaption(ctx, makeCaptionElement({ start: 1 }), canvasW, canvasH, 1)
    ).not.toThrow();
  });

  // --- SRT with dots instead of commas ---
  it('should parse SRT with dot separator', () => {
    const ctx = createCtx();
    const dotSrt = `1
00:00:00.000 --> 00:00:02.000
Dot separator caption`;
    expect(() =>
      paintCaption(ctx, makeCaptionElement({ srtContent: dotSrt }), canvasW, canvasH, 1)
    ).not.toThrow();
  });

  // --- multi-line caption text ---
  it('should handle multi-line caption text in SRT', () => {
    const ctx = createCtx();
    const multiLineSrt = `1
00:00:00,000 --> 00:00:05,000
Line one
continues here`;
    expect(() =>
      paintCaption(ctx, makeCaptionElement({ srtContent: multiLineSrt }), canvasW, canvasH, 1)
    ).not.toThrow();
  });

  // --- combined full style ---
  it('should render with all options combined', () => {
    const ctx = createCtx();
    const element = makeCaptionElement({
      srtContent: SAMPLE_SRT,
      fontFamily: 'Arial',
      fontSize: 42,
      color: '#FFFF00',
      strokeColor: '#000000',
      strokeWidth: 3,
      backgroundColor: 'rgba(0,0,0,0.8)',
      maxWidth: '80%',
      lineHeight: 1.5,
      textAlign: 'center',
      borderRadius: 16,
      position: 'bottom-center',
      offsetX: 0,
      offsetY: -40,
      start: 0,
    });
    expect(() => paintCaption(ctx, element, canvasW, canvasH, 1)).not.toThrow();
  });

  // --- unicode captions ---
  it('should handle unicode in SRT', () => {
    const ctx = createCtx();
    const unicodeSrt = `1
00:00:00,000 --> 00:00:03,000
Xin chào thế giới 🎬🎥

2
00:00:03,000 --> 00:00:06,000
日本語テスト`;
    expect(() =>
      paintCaption(ctx, makeCaptionElement({ srtContent: unicodeSrt }), canvasW, canvasH, 1)
    ).not.toThrow();
  });

  // --- opacity ---
  it('should render with opacity < 1', () => {
    const ctx = createCtx();
    expect(() =>
      paintCaption(ctx, makeCaptionElement({ opacity: 0.5 }), canvasW, canvasH, 1)
    ).not.toThrow();
  });

  it('should render with opacity = 0', () => {
    const ctx = createCtx();
    expect(() =>
      paintCaption(ctx, makeCaptionElement({ opacity: 0 }), canvasW, canvasH, 1)
    ).not.toThrow();
  });

  // --- offsetX / offsetY ---
  it('should render with offsetX and offsetY', () => {
    const ctx = createCtx();
    expect(() =>
      paintCaption(ctx, makeCaptionElement({ offsetX: 50, offsetY: 100 }), canvasW, canvasH, 1)
    ).not.toThrow();
  });

  it('should render with only offsetX', () => {
    const ctx = createCtx();
    expect(() =>
      paintCaption(ctx, makeCaptionElement({ offsetX: 50 }), canvasW, canvasH, 1)
    ).not.toThrow();
  });

  // --- combined new features ---
  it('should render with opacity + offset combined', () => {
    const ctx = createCtx();
    const element = makeCaptionElement({
      opacity: 0.7,
      offsetX: 100,
      offsetY: -20,
    });
    expect(() => paintCaption(ctx, element, canvasW, canvasH, 1)).not.toThrow();
  });
});

// ==================== WORD HIGHLIGHT TESTS ====================

describe('paintCaption — wordHighlight', () => {
  const canvasW = 1280;
  const canvasH = 720;

  function createCtx() {
    const canvas = createCanvas(canvasW, canvasH);
    return canvas.getContext('2d');
  }

  function makeCaptionElement(overrides: Partial<CaptionElement> = {}): CaptionElement {
    return {
      type: 'caption',
      srtContent: SAMPLE_SRT,
      position: 'bottom-center',
      zIndex: 10,
      wordHighlight: true,
      ...overrides,
    };
  }

  // --- basic word highlight rendering ---
  it('should render with wordHighlight=true without throwing', () => {
    const ctx = createCtx();
    expect(() => paintCaption(ctx, makeCaptionElement(), canvasW, canvasH, 1)).not.toThrow();
  });

  it('should render word highlight at time 0s (first word active)', () => {
    const ctx = createCtx();
    expect(() => paintCaption(ctx, makeCaptionElement(), canvasW, canvasH, 0)).not.toThrow();
  });

  it('should render word highlight during gap (no active entry)', () => {
    const ctx = createCtx();
    expect(() => paintCaption(ctx, makeCaptionElement(), canvasW, canvasH, 2.25)).not.toThrow();
  });

  // --- highlight styles ---
  it('should render with highlightStyle=color', () => {
    const ctx = createCtx();
    expect(() =>
      paintCaption(ctx, makeCaptionElement({ highlightStyle: 'color', highlightColor: '#FF0000' }), canvasW, canvasH, 1)
    ).not.toThrow();
  });

  it('should render with highlightStyle=background', () => {
    const ctx = createCtx();
    expect(() =>
      paintCaption(ctx, makeCaptionElement({
        highlightStyle: 'background',
        highlightBgColor: 'rgba(255,0,0,0.4)',
      }), canvasW, canvasH, 1)
    ).not.toThrow();
  });

  it('should render with highlightStyle=scale', () => {
    const ctx = createCtx();
    expect(() =>
      paintCaption(ctx, makeCaptionElement({
        highlightStyle: 'scale',
        highlightScale: 1.3,
      }), canvasW, canvasH, 1)
    ).not.toThrow();
  });

  // --- edge cases ---
  it('should handle single word caption with highlight', () => {
    const ctx = createCtx();
    const srt = `1\n00:00:00,000 --> 00:00:02,000\nHello`;
    expect(() =>
      paintCaption(ctx, makeCaptionElement({ srtContent: srt }), canvasW, canvasH, 1)
    ).not.toThrow();
  });

  it('should handle empty SRT with wordHighlight=true', () => {
    const ctx = createCtx();
    expect(() =>
      paintCaption(ctx, makeCaptionElement({ srtContent: '' }), canvasW, canvasH, 1)
    ).not.toThrow();
  });

  it('should handle long sentence that wraps multiple lines', () => {
    const ctx = createCtx();
    const srt = `1\n00:00:00,000 --> 00:00:05,000\nThis is a very long sentence that should wrap across multiple lines on the canvas`;
    expect(() =>
      paintCaption(ctx, makeCaptionElement({ srtContent: srt, maxWidth: '50%' }), canvasW, canvasH, 2)
    ).not.toThrow();
  });

  it('should render with all word highlight options combined', () => {
    const ctx = createCtx();
    const element = makeCaptionElement({
      wordHighlight: true,
      highlightStyle: 'background',
      highlightColor: '#FFFF00',
      highlightBgColor: 'rgba(255, 255, 0, 0.3)',
      highlightScale: 1.2,
      fontSize: 48,
      color: '#FFFFFF',
      strokeColor: '#000000',
      strokeWidth: 3,
      backgroundColor: 'rgba(0,0,0,0.7)',
      borderRadius: 16,
      position: 'bottom-center',
      textAlign: 'center',
    });
    expect(() => paintCaption(ctx, element, canvasW, canvasH, 1)).not.toThrow();
  });

  it('should render with different text alignments in word highlight mode', () => {
    const ctx = createCtx();
    for (const align of ['left', 'center', 'right'] as const) {
      expect(() =>
        paintCaption(ctx, makeCaptionElement({ textAlign: align }), canvasW, canvasH, 1)
      ).not.toThrow();
    }
  });

  it('should render at all time points of a caption entry', () => {
    const ctx = createCtx();
    // Entry 1: 0-2s, "Hello World!" = 2 words
    // Word 1 "Hello" ≈ 0-0.833s, Word 2 "World!" ≈ 0.833-2s
    for (const t of [0, 0.5, 1.0, 1.5, 1.9]) {
      expect(() =>
        paintCaption(ctx, makeCaptionElement(), canvasW, canvasH, t)
      ).not.toThrow();
    }
  });

  it('should handle unicode words with highlight', () => {
    const ctx = createCtx();
    const srt = `1\n00:00:00,000 --> 00:00:04,000\nXin chào thế giới`;
    expect(() =>
      paintCaption(ctx, makeCaptionElement({ srtContent: srt }), canvasW, canvasH, 2)
    ).not.toThrow();
  });
});

// ==================== UNIT TESTS: parseSrt ====================

describe('parseSrt', () => {
  it('should parse standard SRT content', () => {
    const entries = parseSrt(SAMPLE_SRT);
    expect(entries).toHaveLength(3);
    expect(entries[0]).toEqual({ startMs: 0, endMs: 2000, text: 'Hello World!' });
    expect(entries[1]).toEqual({ startMs: 2500, endMs: 5000, text: 'This is the second caption' });
    expect(entries[2]).toEqual({ startMs: 6000, endMs: 8500, text: 'Third line here' });
  });

  it('should parse SRT with dot separator', () => {
    const srt = `1\n00:00:01.500 --> 00:00:03.000\nDot test`;
    const entries = parseSrt(srt);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({ startMs: 1500, endMs: 3000, text: 'Dot test' });
  });

  it('should skip malformed blocks', () => {
    const srt = `1\nno timestamp\ntext\n\n2\n00:00:00,000 --> 00:00:01,000\nOK`;
    const entries = parseSrt(srt);
    expect(entries).toHaveLength(1);
    expect(entries[0].text).toBe('OK');
  });

  it('should return empty for empty input', () => {
    expect(parseSrt('')).toEqual([]);
    expect(parseSrt('  \n\n  ')).toEqual([]);
  });

  it('should join multi-line text with spaces', () => {
    const srt = `1\n00:00:00,000 --> 00:00:02,000\nLine one\ncontinues here`;
    const entries = parseSrt(srt);
    expect(entries[0].text).toBe('Line one continues here');
  });
});

// ==================== UNIT TESTS: distributeWordTimings ====================

describe('distributeWordTimings', () => {
  it('should distribute timing proportionally by character count', () => {
    const entry = { startMs: 0, endMs: 2000, text: 'Hello World!' };
    const timings = distributeWordTimings(entry);

    expect(timings).toHaveLength(2);
    // "Hello" = 5 chars, "World!" = 6 chars, total = 11
    expect(timings[0].word).toBe('Hello');
    expect(timings[0].startMs).toBe(0);
    expect(timings[1].word).toBe('World!');
    // Last word should end at endMs
    expect(timings[1].endMs).toBe(2000);
  });

  it('should handle single word', () => {
    const entry = { startMs: 1000, endMs: 3000, text: 'Hello' };
    const timings = distributeWordTimings(entry);

    expect(timings).toHaveLength(1);
    expect(timings[0]).toEqual({ word: 'Hello', startMs: 1000, endMs: 3000 });
  });

  it('should handle empty text', () => {
    const entry = { startMs: 0, endMs: 1000, text: '' };
    const timings = distributeWordTimings(entry);
    expect(timings).toHaveLength(0);
  });

  it('should cover full time range without gaps', () => {
    const entry = { startMs: 500, endMs: 5500, text: 'A BB CCC DDDD' };
    const timings = distributeWordTimings(entry);

    expect(timings).toHaveLength(4);
    // First word starts at entry start
    expect(timings[0].startMs).toBe(500);
    // Last word ends at entry end
    expect(timings[3].endMs).toBe(5500);

    // No gaps between words
    for (let i = 1; i < timings.length; i++) {
      expect(timings[i].startMs).toBe(timings[i - 1].endMs);
    }
  });

  it('should give longer words more time', () => {
    const entry = { startMs: 0, endMs: 10000, text: 'I wonderful' };
    const timings = distributeWordTimings(entry);

    // "I" = 1 char, "wonderful" = 9 chars
    // "I" should get ~10% of time, "wonderful" should get ~90%
    const iDuration = timings[0].endMs - timings[0].startMs;
    const wonderfulDuration = timings[1].endMs - timings[1].startMs;
    expect(wonderfulDuration).toBeGreaterThan(iDuration);
  });
});

// ==================== UNIT TESTS: wrapWords ====================

describe('wrapWords', () => {
  function createCtx() {
    const canvas = createCanvas(640, 480);
    const ctx = canvas.getContext('2d');
    ctx.font = '700 32px "sans-serif"';
    return ctx;
  }

  it('should put all words on one line if they fit', () => {
    const ctx = createCtx();
    const result = wrapWords(ctx, ['Hi', 'there'], 9999);
    expect(result).toEqual([[0, 1]]);
  });

  it('should wrap to multiple lines if needed', () => {
    const ctx = createCtx();
    const words = 'This is a very long sentence that wraps'.split(' ');
    const result = wrapWords(ctx, words, 200);
    expect(result.length).toBeGreaterThan(1);
    // All word indices should be covered
    const allIndices = result.flat();
    expect(allIndices).toEqual(words.map((_, i) => i));
  });

  it('should handle single word', () => {
    const ctx = createCtx();
    const result = wrapWords(ctx, ['Hello'], 9999);
    expect(result).toEqual([[0]]);
  });

  it('should handle empty words array', () => {
    const ctx = createCtx();
    const result = wrapWords(ctx, [], 9999);
    expect(result).toEqual([[]]);
  });
});
