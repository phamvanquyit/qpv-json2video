// Main API
export { json2video, json2videoFile, detectPlatform, getOptimalEncoder } from './json2video';

// Platform types
export type { EncoderConfig, PlatformType } from './renderer/platform';

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
  PositionType,
  RenderOptions,
  RenderResult,
  Scene,
  SceneElement,
  SceneTransition,
  ShapeElement,
  TextElement,
  Track,
  TransitionType,
  VideoConfig,
  VideoElement,
  WordHighlightStyle,
} from './types';
