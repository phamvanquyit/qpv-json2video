import { createCanvas } from 'canvas';
import { paintText } from './text.painter';
import { TextElement } from '../../types';

describe('paintText', () => {
  const canvasW = 640;
  const canvasH = 480;

  function createCtx() {
    const canvas = createCanvas(canvasW, canvasH);
    return canvas.getContext('2d');
  }

  function makeTextElement(overrides: Partial<TextElement> = {}): TextElement {
    return {
      type: 'text',
      text: 'Hello World',
      position: 'center',
      zIndex: 1,
      ...overrides,
    };
  }

  // --- basic rendering ---
  it('should render without throwing', () => {
    const ctx = createCtx();
    expect(() => paintText(ctx, makeTextElement(), canvasW, canvasH, 0, 5)).not.toThrow();
  });

  // --- font options ---
  it('should render with custom fontSize', () => {
    const ctx = createCtx();
    expect(() =>
      paintText(ctx, makeTextElement({ fontSize: 96 }), canvasW, canvasH, 0, 5)
    ).not.toThrow();
  });

  it('should render with custom fontFamily', () => {
    const ctx = createCtx();
    expect(() =>
      paintText(ctx, makeTextElement({ fontFamily: 'Arial' }), canvasW, canvasH, 0, 5)
    ).not.toThrow();
  });

  it('should render with string fontWeight', () => {
    const ctx = createCtx();
    expect(() =>
      paintText(ctx, makeTextElement({ fontWeight: 'bold' }), canvasW, canvasH, 0, 5)
    ).not.toThrow();
  });

  it('should render with number fontWeight', () => {
    const ctx = createCtx();
    expect(() =>
      paintText(ctx, makeTextElement({ fontWeight: 700 }), canvasW, canvasH, 0, 5)
    ).not.toThrow();
  });

  // --- colors ---
  it('should render with custom color', () => {
    const ctx = createCtx();
    expect(() =>
      paintText(ctx, makeTextElement({ color: '#FF0000' }), canvasW, canvasH, 0, 5)
    ).not.toThrow();
  });

  it('should render with bgColor', () => {
    const ctx = createCtx();
    expect(() =>
      paintText(ctx, makeTextElement({ bgColor: 'rgba(0,0,0,0.5)' }), canvasW, canvasH, 0, 5)
    ).not.toThrow();
  });

  it('should render with transparent bgColor', () => {
    const ctx = createCtx();
    expect(() =>
      paintText(ctx, makeTextElement({ bgColor: 'transparent' }), canvasW, canvasH, 0, 5)
    ).not.toThrow();
  });

  // --- stroke ---
  it('should render with stroke', () => {
    const ctx = createCtx();
    expect(() =>
      paintText(ctx, makeTextElement({ strokeColor: '#000', strokeWidth: 3 }), canvasW, canvasH, 0, 5)
    ).not.toThrow();
  });

  it('should render with zero strokeWidth', () => {
    const ctx = createCtx();
    expect(() =>
      paintText(ctx, makeTextElement({ strokeWidth: 0 }), canvasW, canvasH, 0, 5)
    ).not.toThrow();
  });

  // --- text alignment ---
  it.each(['left', 'center', 'right'] as const)('should render with textAlign=%s', (align) => {
    const ctx = createCtx();
    expect(() =>
      paintText(ctx, makeTextElement({ textAlign: align }), canvasW, canvasH, 0, 5)
    ).not.toThrow();
  });

  // --- positions ---
  it.each([
    'center', 'top-left', 'top-center', 'top-right',
    'left', 'right', 'bottom-left', 'bottom-center', 'bottom-right',
  ] as const)('should render at position=%s', (position) => {
    const ctx = createCtx();
    expect(() =>
      paintText(ctx, makeTextElement({ position }), canvasW, canvasH, 0, 5)
    ).not.toThrow();
  });

  // --- maxWidth ---
  it('should render with numeric maxWidth', () => {
    const ctx = createCtx();
    expect(() =>
      paintText(ctx, makeTextElement({ maxWidth: 300 }), canvasW, canvasH, 0, 5)
    ).not.toThrow();
  });

  it('should render with percentage maxWidth', () => {
    const ctx = createCtx();
    expect(() =>
      paintText(ctx, makeTextElement({ maxWidth: '80%' }), canvasW, canvasH, 0, 5)
    ).not.toThrow();
  });

  // --- border radius ---
  it('should render with borderRadius', () => {
    const ctx = createCtx();
    expect(() =>
      paintText(ctx, makeTextElement({ bgColor: '#333', borderRadius: 12 }), canvasW, canvasH, 0, 5)
    ).not.toThrow();
  });

  // --- offsets ---
  it('should render with offsets', () => {
    const ctx = createCtx();
    expect(() =>
      paintText(ctx, makeTextElement({ offsetX: 50, offsetY: -30 }), canvasW, canvasH, 0, 5)
    ).not.toThrow();
  });

  // --- opacity ---
  it('should render with opacity < 1', () => {
    const ctx = createCtx();
    expect(() =>
      paintText(ctx, makeTextElement({ opacity: 0.5 }), canvasW, canvasH, 0, 5)
    ).not.toThrow();
  });

  it('should render with opacity = 0', () => {
    const ctx = createCtx();
    expect(() =>
      paintText(ctx, makeTextElement({ opacity: 0 }), canvasW, canvasH, 0, 5)
    ).not.toThrow();
  });

  it('should set globalAlpha when opacity < 1', () => {
    const ctx = createCtx();
    const saveSpy = jest.spyOn(ctx, 'save');
    paintText(ctx, makeTextElement({ opacity: 0.3 }), canvasW, canvasH, 0, 5);
    expect(saveSpy).toHaveBeenCalled();
    // After restore, globalAlpha should be back to 1
    expect(ctx.globalAlpha).toBe(1);
  });

  // --- offsetX / offsetY ---
  it('should render with offsetX and offsetY', () => {
    const ctx = createCtx();
    expect(() =>
      paintText(ctx, makeTextElement({ offsetX: 100, offsetY: 200 }), canvasW, canvasH, 0, 5)
    ).not.toThrow();
  });

  it('should render with only offsetX', () => {
    const ctx = createCtx();
    expect(() =>
      paintText(ctx, makeTextElement({ offsetX: 50 }), canvasW, canvasH, 0, 5)
    ).not.toThrow();
  });

  it('should render with only offsetY', () => {
    const ctx = createCtx();
    expect(() =>
      paintText(ctx, makeTextElement({ offsetY: 300 }), canvasW, canvasH, 0, 5)
    ).not.toThrow();
  });

  // --- animation ---
  it('should render with fadeIn animation', () => {
    const ctx = createCtx();
    expect(() =>
      paintText(ctx, makeTextElement({
        animation: { type: 'fadeIn', fadeInDuration: 0.5 },
      }), canvasW, canvasH, 0.25, 5)
    ).not.toThrow();
  });

  it('should render with fadeOut animation', () => {
    const ctx = createCtx();
    expect(() =>
      paintText(ctx, makeTextElement({
        animation: { type: 'fadeOut', fadeOutDuration: 0.5 },
      }), canvasW, canvasH, 4.5, 5)
    ).not.toThrow();
  });

  it('should render with fadeInOut animation', () => {
    const ctx = createCtx();
    expect(() =>
      paintText(ctx, makeTextElement({
        animation: { type: 'fadeInOut', fadeInDuration: 0.5, fadeOutDuration: 0.5 },
      }), canvasW, canvasH, 2.5, 5)
    ).not.toThrow();
  });

  // --- combined ---
  it('should render with all new features combined', () => {
    const ctx = createCtx();
    const element = makeTextElement({
      text: 'Full featured',
      offsetX: 100,
      offsetY: 200,
      opacity: 0.8,
      animation: { type: 'fadeInOut', fadeInDuration: 0.5, fadeOutDuration: 0.5 },
      bgColor: '#333',
      borderRadius: 12,
      strokeColor: '#FF0000',
      strokeWidth: 2,
    });
    expect(() => paintText(ctx, element, canvasW, canvasH, 2.5, 5)).not.toThrow();
  });

  // --- long text ---
  it('should render very long text', () => {
    const ctx = createCtx();
    const longText = Array(50).fill('word').join(' ');
    expect(() =>
      paintText(ctx, makeTextElement({ text: longText, maxWidth: 200 }), canvasW, canvasH, 0, 5)
    ).not.toThrow();
  });

  // --- empty text ---
  it('should handle empty text', () => {
    const ctx = createCtx();
    expect(() =>
      paintText(ctx, makeTextElement({ text: '' }), canvasW, canvasH, 0, 5)
    ).not.toThrow();
  });

  // --- unicode ---
  it('should handle unicode text', () => {
    const ctx = createCtx();
    expect(() =>
      paintText(ctx, makeTextElement({ text: 'Xin chào 🎬 Thế giới' }), canvasW, canvasH, 0, 5)
    ).not.toThrow();
  });

  // --- full styled ---
  it('should render with all style options combined', () => {
    const ctx = createCtx();
    const element = makeTextElement({
      text: 'Full styled text',
      fontFamily: 'Arial',
      fontSize: 36,
      fontWeight: 'bold',
      color: '#FFFF00',
      bgColor: 'rgba(0,0,0,0.7)',
      strokeColor: '#000',
      strokeWidth: 2,
      textAlign: 'center',
      maxWidth: '70%',
      lineHeight: 1.5,
      padding: 20,
      borderRadius: 16,
      offsetX: 10,
      offsetY: -10,
      position: 'bottom-center',
    });
    expect(() => paintText(ctx, element, canvasW, canvasH, 1.5, 5)).not.toThrow();
  });
});
