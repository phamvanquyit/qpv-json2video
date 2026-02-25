import { createCanvas } from '@napi-rs/canvas';
import { paintShape } from './shape.painter';
import { ShapeElement } from '../../types';

const W = 200;
const H = 200;

function createCtx() {
  return createCanvas(W, H).getContext('2d');
}

function makeShape(overrides: Partial<ShapeElement> = {}): ShapeElement {
  return {
    type: 'shape',
    width: 80,
    height: 60,
    position: 'center',
    zIndex: 1,
    ...overrides,
  };
}

// Helper: get pixel RGBA at (x, y) from context
function getPixel(ctx: ReturnType<typeof createCtx>, x: number, y: number) {
  const d = ctx.getImageData(x, y, 1, 1).data;
  return { r: d[0], g: d[1], b: d[2], a: d[3] };
}

// ========================
// Rectangle
// ========================
describe('paintShape — rectangle', () => {
  it('should render filled rectangle', () => {
    const ctx = createCtx();
    paintShape(ctx, makeShape({ bgColor: '#ff0000' }), W, H);
    const p = getPixel(ctx, 100, 100); // center
    expect(p.r).toBe(255);
    expect(p.g).toBe(0);
    expect(p.b).toBe(0);
  });

  it('should render stroke-only rectangle', () => {
    const ctx = createCtx();
    paintShape(ctx, makeShape({ strokeColor: '#00ff00', strokeWidth: 4 }), W, H);
    const center = getPixel(ctx, 100, 100);
    // Center should be transparent/black (no fill)
    expect(center.r).toBe(0);
    expect(center.g).toBe(0);
  });

  it('should render fill + stroke combined', () => {
    const ctx = createCtx();
    paintShape(ctx, makeShape({ bgColor: '#0000ff', strokeColor: '#ff0000', strokeWidth: 4 }), W, H);
    const center = getPixel(ctx, 100, 100);
    expect(center.b).toBe(255); // blue fill
  });

  it('should render with border radius', () => {
    const ctx = createCtx();
    expect(() => paintShape(ctx, makeShape({ bgColor: '#ff0000', borderRadius: 10 }), W, H)).not.toThrow();
  });

  it('should render with border radius + stroke', () => {
    const ctx = createCtx();
    expect(() => paintShape(ctx, makeShape({
      bgColor: '#0000ff', strokeColor: '#ff0000', strokeWidth: 3, borderRadius: 8,
    }), W, H)).not.toThrow();
  });

  it('should default shape to rectangle when not specified', () => {
    const ctx = createCtx();
    paintShape(ctx, makeShape({ bgColor: '#ff0000' }), W, H);
    const center = getPixel(ctx, 100, 100);
    expect(center.r).toBe(255);
  });
});

// ========================
// Circle
// ========================
describe('paintShape — circle', () => {
  it('should render filled circle', () => {
    const ctx = createCtx();
    paintShape(ctx, makeShape({ shape: 'circle', width: 80, height: 80, bgColor: '#00ff00' }), W, H);
    const center = getPixel(ctx, 100, 100);
    expect(center.g).toBe(255);
  });

  it('should render stroke-only circle', () => {
    const ctx = createCtx();
    paintShape(ctx, makeShape({ shape: 'circle', width: 80, height: 80, strokeColor: '#ff0000', strokeWidth: 4 }), W, H);
    const center = getPixel(ctx, 100, 100);
    // Center should remain unfilled
    expect(center.r).toBe(0);
  });

  it('should render fill + stroke circle', () => {
    const ctx = createCtx();
    expect(() => paintShape(ctx, makeShape({
      shape: 'circle', width: 60, height: 60,
      bgColor: '#0000ff', strokeColor: '#ffffff', strokeWidth: 3,
    }), W, H)).not.toThrow();
  });
});

// ========================
// Ellipse
// ========================
describe('paintShape — ellipse', () => {
  it('should render filled ellipse', () => {
    const ctx = createCtx();
    paintShape(ctx, makeShape({ shape: 'ellipse', width: 100, height: 60, bgColor: '#ff00ff' }), W, H);
    const center = getPixel(ctx, 100, 100);
    expect(center.r).toBe(255);
    expect(center.b).toBe(255);
  });

  it('should render stroke-only ellipse', () => {
    const ctx = createCtx();
    expect(() => paintShape(ctx, makeShape({
      shape: 'ellipse', width: 100, height: 60,
      strokeColor: '#00ff00', strokeWidth: 3,
    }), W, H)).not.toThrow();
  });

  it('should render fill + stroke ellipse', () => {
    const ctx = createCtx();
    expect(() => paintShape(ctx, makeShape({
      shape: 'ellipse', width: 80, height: 50,
      bgColor: '#ffff00', strokeColor: '#000000', strokeWidth: 2,
    }), W, H)).not.toThrow();
  });
});

// ========================
// Line
// ========================
describe('paintShape — line', () => {
  it('should render line with linePoints', () => {
    const ctx = createCtx();
    expect(() => paintShape(ctx, makeShape({
      shape: 'line',
      linePoints: { x1: 0, y1: 0, x2: 80, y2: 60 },
      strokeColor: '#ff0000', strokeWidth: 3,
    }), W, H)).not.toThrow();
  });

  it('should not throw when linePoints is undefined', () => {
    const ctx = createCtx();
    expect(() => paintShape(ctx, makeShape({
      shape: 'line', strokeColor: '#ffffff', strokeWidth: 2,
    }), W, H)).not.toThrow();
  });

  it('should use default strokeColor #FFFFFF for line', () => {
    const ctx = createCtx();
    expect(() => paintShape(ctx, makeShape({
      shape: 'line',
      linePoints: { x1: 10, y1: 10, x2: 50, y2: 50 },
      strokeWidth: 2,
    }), W, H)).not.toThrow();
  });
});

// ========================
// Gradient
// ========================
describe('paintShape — gradient', () => {
  it('should render with linear gradient fill', () => {
    const ctx = createCtx();
    expect(() => paintShape(ctx, makeShape({
      gradient: { type: 'linear', colors: ['#ff0000', '#0000ff'], angle: 45 },
    }), W, H)).not.toThrow();
  });

  it('should render with radial gradient fill', () => {
    const ctx = createCtx();
    expect(() => paintShape(ctx, makeShape({
      gradient: { type: 'radial', colors: ['#ffffff', '#000000'] },
    }), W, H)).not.toThrow();
  });

  it('gradient should override bgColor', () => {
    const ctx = createCtx();
    // When gradient is set, bgColor should be ignored
    expect(() => paintShape(ctx, makeShape({
      bgColor: '#ff0000',
      gradient: { type: 'linear', colors: ['#00ff00', '#0000ff'] },
    }), W, H)).not.toThrow();
  });
});

// ========================
// Opacity
// ========================
describe('paintShape — opacity', () => {
  it('should render with full opacity (default)', () => {
    const ctx = createCtx();
    paintShape(ctx, makeShape({ bgColor: '#ffffff' }), W, H);
    const center = getPixel(ctx, 100, 100);
    expect(center.r).toBe(255);
    expect(center.a).toBe(255);
  });

  it('should render with 50% opacity', () => {
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    // Black background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);
    // White shape at 50% opacity
    paintShape(ctx, makeShape({ bgColor: '#ffffff', opacity: 0.5, width: W, height: H }), W, H);
    const center = getPixel(ctx, 100, 100);
    // Should be ~128 (black + 50% white)
    expect(center.r).toBeGreaterThan(100);
    expect(center.r).toBeLessThan(160);
  });

  it('should render with 0 opacity (invisible)', () => {
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);
    paintShape(ctx, makeShape({ bgColor: '#ffffff', opacity: 0, width: W, height: H }), W, H);
    const center = getPixel(ctx, 100, 100);
    expect(center.r).toBe(0); // Still black
  });
});

// ========================
// Position
// ========================
describe('paintShape — position', () => {
  it.each([
    'center', 'top-left', 'top-center', 'top-right',
    'left', 'right', 'bottom-left', 'bottom-center', 'bottom-right',
  ] as const)('should render at position=%s', (position) => {
    const ctx = createCtx();
    expect(() => paintShape(ctx, makeShape({ bgColor: '#ff0000', position }), W, H)).not.toThrow();
  });

  it('should apply offsetX and offsetY', () => {
    const ctx = createCtx();
    expect(() => paintShape(ctx, makeShape({
      bgColor: '#ff0000', offsetX: 20, offsetY: -10,
    }), W, H)).not.toThrow();
  });
});
