import { createCanvas } from '@napi-rs/canvas';
import { paintText } from './text.painter';
import { TextElement } from '../../types';

describe('paintText', () => {
  const canvasW = 640;
  const canvasH = 480;

  function createCtx() {
    return createCanvas(canvasW, canvasH).getContext('2d');
  }

  function makeTextElement(overrides: Partial<TextElement> = {}): TextElement {
    return { type: 'text', text: 'Hello World', position: 'center', zIndex: 1, ...overrides };
  }

  // Basic rendering
  it('should render without throwing', () => {
    const ctx = createCtx();
    expect(() => paintText(ctx, makeTextElement(), canvasW, canvasH, 0, 5)).not.toThrow();
  });

  // Style options — merged into it.each
  it.each([
    { fontSize: 96 },
    { fontFamily: 'Arial' },
    { fontWeight: 'bold' as const },
    { fontWeight: 700 },
    { color: '#FF0000' },
    { bgColor: 'rgba(0,0,0,0.5)' },
    { bgColor: 'transparent' },
    { strokeColor: '#000', strokeWidth: 3 },
    { strokeWidth: 0 },
    { maxWidth: 300 },
    { maxWidth: '80%' },
    { bgColor: '#333', borderRadius: 12 },
    { offsetX: 50, offsetY: -30 },
    { opacity: 0.5 },
    { opacity: 0 },
    { padding: 20 },
    { lineHeight: 1.5 },
  ])('should render with style override: %o', (override) => {
    const ctx = createCtx();
    expect(() => paintText(ctx, makeTextElement(override), canvasW, canvasH, 0, 5)).not.toThrow();
  });

  // Text alignment
  it.each(['left', 'center', 'right'] as const)('should render with textAlign=%s', (align) => {
    const ctx = createCtx();
    expect(() => paintText(ctx, makeTextElement({ textAlign: align }), canvasW, canvasH, 0, 5)).not.toThrow();
  });

  // Positions
  it.each([
    'center', 'top-left', 'top-center', 'top-right',
    'left', 'right', 'bottom-left', 'bottom-center', 'bottom-right',
  ] as const)('should render at position=%s', (position) => {
    const ctx = createCtx();
    expect(() => paintText(ctx, makeTextElement({ position }), canvasW, canvasH, 0, 5)).not.toThrow();
  });

  // Opacity behavior
  it('should set globalAlpha when opacity < 1', () => {
    const ctx = createCtx();
    const saveSpy = jest.spyOn(ctx, 'save');
    paintText(ctx, makeTextElement({ opacity: 0.3 }), canvasW, canvasH, 0, 5);
    expect(saveSpy).toHaveBeenCalled();
    expect(ctx.globalAlpha).toBe(1); // restored
  });

  // Animations
  it.each([
    { animation: { type: 'fadeIn' as const, fadeInDuration: 0.5 }, time: 0.25 },
    { animation: { type: 'fadeOut' as const, fadeOutDuration: 0.5 }, time: 4.5 },
    { animation: { type: 'fadeInOut' as const, fadeInDuration: 0.5, fadeOutDuration: 0.5 }, time: 2.5 },
  ])('should render with $animation.type animation', ({ animation, time }) => {
    const ctx = createCtx();
    expect(() => paintText(ctx, makeTextElement({ animation }), canvasW, canvasH, time, 5)).not.toThrow();
  });

  // Edge cases
  it('should handle empty text', () => {
    const ctx = createCtx();
    expect(() => paintText(ctx, makeTextElement({ text: '' }), canvasW, canvasH, 0, 5)).not.toThrow();
  });

  it('should handle very long text', () => {
    const ctx = createCtx();
    const longText = Array(50).fill('word').join(' ');
    expect(() => paintText(ctx, makeTextElement({ text: longText, maxWidth: 200 }), canvasW, canvasH, 0, 5)).not.toThrow();
  });

  it('should handle unicode text', () => {
    const ctx = createCtx();
    expect(() => paintText(ctx, makeTextElement({ text: 'Xin chào 🎬 Thế giới' }), canvasW, canvasH, 0, 5)).not.toThrow();
  });

  // Full combined
  it('should render with all options combined', () => {
    const ctx = createCtx();
    const element = makeTextElement({
      text: 'Full styled', fontFamily: 'Arial', fontSize: 36, fontWeight: 'bold',
      color: '#FFFF00', bgColor: 'rgba(0,0,0,0.7)', strokeColor: '#000', strokeWidth: 2,
      textAlign: 'center', maxWidth: '70%', lineHeight: 1.5, padding: 20,
      borderRadius: 16, offsetX: 10, offsetY: -10, position: 'bottom-center',
      opacity: 0.8, animation: { type: 'fadeInOut', fadeInDuration: 0.5, fadeOutDuration: 0.5 },
    });
    expect(() => paintText(ctx, element, canvasW, canvasH, 2.5, 5)).not.toThrow();
  });
});
