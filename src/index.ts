// Main API
export { json2video, json2videoFile, detectPlatform, getOptimalEncoder } from './json2video';

// Platform types
export type { EncoderConfig, PlatformType } from './renderer/platform';

// Types
export type {
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
  TextElement,
  Track,
  VideoConfig,
  VideoElement,
  WordHighlightStyle,
} from './types';
