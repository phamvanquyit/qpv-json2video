// Main API
export { json2video, json2videoFile, detectPlatform, getOptimalEncoder } from './json2video';

// Builder API
export { VideoBuilder, TrackBuilder, SceneBuilder } from './builder';
export type {
  ElementOptions,
  TextOptions,
  ImageOptions,
  VideoOptions,
  ShapeOptions,
  CaptionOptions,
  SvgOptions,
  WaveformOptions,
} from './builder';

// Platform types
export type { EncoderConfig, PlatformType } from './renderer/platform';

// Schema validation
export {
  validateConfig,
  assertValidConfig,
  VideoConfigSchema,
  VideoConfigInputSchema,
} from './schema';
export type { ValidationError, ValidationResult } from './schema';

// Types
export type {
  AnimationType,
  AudioConfig,
  CachedAsset,
  CaptionElement,
  ComputedPosition,
  ElementAnimation,
  ElementBase,
  ImageElement,
  KenBurnsConfig,
  MaskConfig,
  MaskShapeType,
  ShapeMaskConfig,
  TextMaskConfig,
  PositionType,
  RenderOptions,
  RenderResult,
  Scene,
  SceneElement,
  SceneTransition,
  ShapeElement,
  SpeedCurvePoint,
  SvgElement,
  TextElement,
  Track,
  TransitionType,
  VideoCropConfig,
  VideoConfig,
  VideoElement,
  WaveformElement,
  WaveformStyle,
  WordHighlightStyle,
} from './types';
