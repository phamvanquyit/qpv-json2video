import { computeKeyframeState, getEasingFunction, KeyframeAnimationState } from './utils';
import { EasingType, Keyframe } from '../types';

describe('getEasingFunction', () => {
  it('returns a function for all easing types', () => {
    const types: EasingType[] = [
      'linear', 'easeIn', 'easeOut', 'easeInOut',
      'easeInCubic', 'easeOutCubic', 'easeInOutCubic',
      'easeInBack', 'easeOutBack', 'easeInOutBack',
      'easeOutBounce', 'easeOutElastic', 'spring',
    ];
    for (const type of types) {
      const fn = getEasingFunction(type);
      expect(typeof fn).toBe('function');
      expect(fn(0)).toBeCloseTo(0, 2);
      expect(fn(1)).toBeCloseTo(1, 1);
    }
  });

  it('returns easeOutCubic for undefined', () => {
    const fn = getEasingFunction(undefined);
    expect(fn(0.5)).toBeCloseTo(0.875, 2);
  });

  it('easeOutBack overshoots past 1', () => {
    const fn = getEasingFunction('easeOutBack');
    // Should overshoot around t=0.5-0.7
    const val = fn(0.7);
    expect(val).toBeGreaterThan(1);
  });

  it('easeOutBounce bounces', () => {
    const fn = getEasingFunction('easeOutBounce');
    expect(fn(0.3)).toBeLessThan(fn(0.5));
    expect(fn(1)).toBeCloseTo(1, 5);
  });

  it('easeOutElastic oscillates', () => {
    const fn = getEasingFunction('easeOutElastic');
    expect(fn(0)).toBe(0);
    expect(fn(1)).toBe(1);
    // Should overshoot past 1 at some point
    const midVal = fn(0.1);
    expect(midVal).not.toBeCloseTo(0.1, 0);
  });

  it('spring oscillates and settles', () => {
    const fn = getEasingFunction('spring');
    expect(fn(0)).toBeCloseTo(0, 1);
    expect(fn(1)).toBeCloseTo(1, 1);
  });

  it('easeInOut is symmetric', () => {
    const fn = getEasingFunction('easeInOut');
    expect(fn(0.5)).toBeCloseTo(0.5, 2);
    // easeInOut: f(0.25) + f(0.75) ≈ 1
    expect(fn(0.25) + fn(0.75)).toBeCloseTo(1, 1);
  });
});

describe('computeKeyframeState', () => {
  // Helper
  function kfState(keyframes: Keyframe[], currentTime: number, elementStart = 0): KeyframeAnimationState {
    return computeKeyframeState(keyframes, currentTime, elementStart);
  }

  describe('empty / edge cases', () => {
    it('returns defaults for empty keyframes', () => {
      const state = kfState([], 1);
      expect(state.opacity).toBe(1);
      expect(state.scale).toBe(1);
      expect(state.translateX).toBe(0);
      expect(state.translateY).toBe(0);
    });

    it('returns defaults for null-ish keyframes', () => {
      const state = computeKeyframeState(null as any, 0.5, 0);
      expect(state.opacity).toBe(1);
    });
  });

  describe('single keyframe', () => {
    it('holds value at keyframe time', () => {
      const state = kfState([{ time: 0, opacity: 0.5, scale: 2 }], 0);
      expect(state.opacity).toBe(0.5);
      expect(state.scale).toBe(2);
    });

    it('holds value before keyframe', () => {
      const state = kfState([{ time: 1, opacity: 0 }], 0);
      expect(state.opacity).toBe(0);
    });

    it('holds value after keyframe', () => {
      const state = kfState([{ time: 0, opacity: 0.3, scale: 1.5 }], 5);
      expect(state.opacity).toBe(0.3);
      expect(state.scale).toBe(1.5);
    });
  });

  describe('two keyframes — interpolation', () => {
    it('fades opacity from 0 to 1 (linear)', () => {
      const kfs: Keyframe[] = [
        { time: 0, opacity: 0 },
        { time: 1, opacity: 1, easing: 'linear' },
      ];

      expect(kfState(kfs, 0).opacity).toBeCloseTo(0);
      expect(kfState(kfs, 0.5).opacity).toBeCloseTo(0.5);
      expect(kfState(kfs, 1).opacity).toBeCloseTo(1);
    });

    it('interpolates scale (linear)', () => {
      const kfs: Keyframe[] = [
        { time: 0, scale: 0 },
        { time: 2, scale: 2, easing: 'linear' },
      ];

      expect(kfState(kfs, 1).scale).toBeCloseTo(1);
    });

    it('interpolates rotation (linear)', () => {
      const kfs: Keyframe[] = [
        { time: 0, rotation: 0 },
        { time: 1, rotation: 360, easing: 'linear' },
      ];

      expect(kfState(kfs, 0.5).rotationOverride).toBeCloseTo(180);
    });

    it('interpolates offsetX (linear)', () => {
      const kfs: Keyframe[] = [
        { time: 0, offsetX: 0 },
        { time: 1, offsetX: 100, easing: 'linear' },
      ];

      expect(kfState(kfs, 0.5).offsetXOverride).toBeCloseTo(50);
    });

    it('interpolates offsetY (linear)', () => {
      const kfs: Keyframe[] = [
        { time: 0, offsetY: -100 },
        { time: 2, offsetY: 100, easing: 'linear' },
      ];

      expect(kfState(kfs, 1).offsetYOverride).toBeCloseTo(0);
    });
  });

  describe('easing functions', () => {
    it('easeOutBack overshoots scale', () => {
      const kfs: Keyframe[] = [
        { time: 0, scale: 0 },
        { time: 1, scale: 1, easing: 'easeOutBack' },
      ];

      // At around t=0.7, easeOutBack should overshoot past 1
      const state = kfState(kfs, 0.7);
      expect(state.scale).toBeGreaterThan(1);
    });

    it('easeOutCubic (default) decelerates', () => {
      const kfs: Keyframe[] = [
        { time: 0, opacity: 0 },
        { time: 1, opacity: 1 }, // default easing = easeOutCubic
      ];

      // easeOutCubic at t=0.5 ≈ 0.875
      const state = kfState(kfs, 0.5);
      expect(state.opacity).toBeGreaterThan(0.8);
    });
  });

  describe('three keyframes', () => {
    it('interpolates through 3 stages (linear)', () => {
      const kfs: Keyframe[] = [
        { time: 0, opacity: 0, scale: 0.5 },
        { time: 1, opacity: 1, scale: 1, easing: 'linear' },
        { time: 2, opacity: 0, scale: 2, easing: 'linear' },
      ];

      // t=0: start
      expect(kfState(kfs, 0).opacity).toBe(0);
      expect(kfState(kfs, 0).scale).toBe(0.5);

      // t=0.5: between kf0 and kf1
      expect(kfState(kfs, 0.5).opacity).toBeCloseTo(0.5);
      expect(kfState(kfs, 0.5).scale).toBeCloseTo(0.75);

      // t=1: at kf1
      expect(kfState(kfs, 1).opacity).toBeCloseTo(1);
      expect(kfState(kfs, 1).scale).toBeCloseTo(1);

      // t=1.5: between kf1 and kf2
      expect(kfState(kfs, 1.5).opacity).toBeCloseTo(0.5);
      expect(kfState(kfs, 1.5).scale).toBeCloseTo(1.5);

      // t=2: at kf2
      expect(kfState(kfs, 2).opacity).toBeCloseTo(0);
      expect(kfState(kfs, 2).scale).toBeCloseTo(2);
    });
  });

  describe('elementStart offset', () => {
    it('shifts keyframe timeline by elementStart', () => {
      const kfs: Keyframe[] = [
        { time: 0, opacity: 0 },
        { time: 1, opacity: 1, easing: 'linear' },
      ];

      // Element starts at 2s, so at currentTime=2.5, timeInElement=0.5
      const state = kfState(kfs, 2.5, 2);
      expect(state.opacity).toBeCloseTo(0.5);
    });
  });

  describe('partial properties', () => {
    it('holds value when only first keyframe defines a property', () => {
      const kfs: Keyframe[] = [
        { time: 0, opacity: 0.5, scale: 2 },
        { time: 1, opacity: 1, easing: 'linear' },
        // scale not defined in kf1 → should hold 2
      ];

      const state = kfState(kfs, 0.5);
      expect(state.scale).toBe(2);
      // opacity should interpolate
      expect(state.opacity).toBeCloseTo(0.75);
    });

    it('interpolates from default when only next keyframe defines a property', () => {
      const kfs: Keyframe[] = [
        { time: 0, opacity: 0 },
        { time: 1, scale: 2, easing: 'linear' }, // scale undefined at t=0, but defined at t=1
      ];

      // scale default is 1; at t=0.5 should be 1.5
      const state = kfState(kfs, 0.5);
      expect(state.scale).toBeCloseTo(1.5);
    });

    it('does not set offsetXOverride when offsetX never defined', () => {
      const kfs: Keyframe[] = [
        { time: 0, opacity: 0 },
        { time: 1, opacity: 1, easing: 'linear' },
      ];

      const state = kfState(kfs, 0.5);
      expect(state.offsetXOverride).toBeUndefined();
      expect(state.offsetYOverride).toBeUndefined();
      expect(state.rotationOverride).toBeUndefined();
    });
  });

  describe('unsorted keyframes', () => {
    it('sorts by time automatically', () => {
      const kfs: Keyframe[] = [
        { time: 2, opacity: 0, easing: 'linear' },
        { time: 0, opacity: 0 },
        { time: 1, opacity: 1, easing: 'linear' },
      ];

      // Should be same as sorted: t=0 → 0, t=1 → 1, t=2 → 0
      expect(kfState(kfs, 0.5).opacity).toBeCloseTo(0.5);
      expect(kfState(kfs, 1.5).opacity).toBeCloseTo(0.5);
    });
  });

  describe('multi-property animation', () => {
    it('animates opacity + scale + offsetX + offsetY + rotation simultaneously', () => {
      const kfs: Keyframe[] = [
        { time: 0, opacity: 0, scale: 0.5, offsetX: -100, offsetY: -50, rotation: 0 },
        { time: 2, opacity: 1, scale: 1.5, offsetX: 100, offsetY: 50, rotation: 180, easing: 'linear' },
      ];

      const state = kfState(kfs, 1);
      expect(state.opacity).toBeCloseTo(0.5);
      expect(state.scale).toBeCloseTo(1);
      expect(state.offsetXOverride).toBeCloseTo(0);
      expect(state.offsetYOverride).toBeCloseTo(0);
      expect(state.rotationOverride).toBeCloseTo(90);
    });
  });

  describe('clamp opacity', () => {
    it('clamps opacity to [0, 1]', () => {
      const kfs: Keyframe[] = [
        { time: 0, opacity: -0.5 },
        { time: 1, opacity: 2, easing: 'linear' },
      ];

      expect(kfState(kfs, 0).opacity).toBe(0);
      expect(kfState(kfs, 1).opacity).toBe(1);
    });
  });
});
