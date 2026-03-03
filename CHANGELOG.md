# Changelog

All notable changes to `qpv-json2video` will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.1] - 2026-03-03

### Fixed

- **Zod compatibility**: Changed import from `'zod/v4'` (Zod v4 only sub-path) to `'zod'` to support both Zod v3 and v4
- Users no longer get `Cannot find module 'zod/v4'` error when using Zod v3

### Changed

- Moved `zod` from `dependencies` to `peerDependencies` — users manage their own Zod version
- `peerDependencies`: `zod >= 3.20.0` (supports Zod v3.20+ and Zod v4.x)

---

## [1.1.0] - 2026-02-27

### Added

- **Timer element** (`type: 'timer'`): Animated countdown/countup timer rendered on canvas
  - Formats: `hh:mm:ss:SSS`, `hh:mm:ss`, `mm:ss:SSS`, `mm:ss`, `ss:SSS`, `ss`
  - Count up (`countDown: false`) or count down (`countDown: true`)
  - `maxDuration` for countdown reference duration
  - `separatorColor` to style `:` separators independently
  - `glow`, `gradient`, `strokeColor`, `bgColor`, `padding` support
- **`TimerElement`** and **`TimerFormat`** types exported from main index
- **`TimerOptions`** available in `SceneBuilder.addTimer()` via Builder API
- `TimerElementSchema` and `TimerFormatSchema` exported from schema module
- Comprehensive timer examples added to `examples/`

### Changed

- `SceneElementSchema` now includes `TimerElementSchema` in the discriminated union
- `SceneElement` union type now includes `TimerElement`

---

## [1.0.5] - 2026-02-26

### Added

- **Chroma key** support for video elements (`chromaKey: { color, tolerance, softness }`) — green/blue screen removal
- **Mask system**: Apply shape or text masks to any element
  - `ShapeMaskConfig`: rect, circle, ellipse, star, polygon masks
  - `TextMaskConfig`: use text as a reveal mask
  - `invert` option to invert mask area
- New examples for chroma key and masking use cases
- `MaskConfig`, `MaskShapeType`, `ShapeMaskConfig`, `TextMaskConfig` types exported from index

### Fixed

- GitHub and license badges added to README
- Mask feature documented in README

---

## [1.0.4] - 2026-02-24

### Added

- **Circle and Ellipse shapes** in `ShapeElement`
- **Line shape** with `linePoints: { x1, y1, x2, y2 }` configuration
- **GIF animation** support for image elements (animated GIFs rendered frame-by-frame)
- **Multi-track audio**: scene `audio` field now accepts a single `AudioConfig` or an array `AudioConfig[]`
- **SVG element** (`type: 'svg'`): render inline SVG or SVG from URL with `fillColor` support
- **Waveform element** (`type: 'waveform'`): audio waveform visualizer
  - Styles: `bars`, `line`, `mirror`, `circle`
  - `barCount`, `barWidth`, `barGap`, `barRadius`, `sensitivity`, `smoothing`, `mirror`, `gradient`
- **Caption element** (`type: 'caption'`): SRT-based subtitle rendering
  - `displayMode`: `sentence` or `word`
  - Word highlight: `highlightColor`, `highlightBgColor`, `highlightStyle`, `highlightScale`
- **Text background shapes**: `bgShape` — `rectangle`, `pill`, `banner`, `speech-bubble`
- **Counter animation** in text elements: `counter: { from, to, duration, prefix, suffix, decimals, thousandSep, easing }`
- **Rich text segments**: `richText: [{ text, color, fontSize, fontWeight, italic, underline, ... }]`
- **Keyframe animation**: `keyframes: [{ time, easing, opacity, scale, rotation, offsetX, offsetY }]`
- **Video processing** features:
  - `reverse`: play video in reverse
  - `freezeAt` / `freezeDuration`: freeze a frame
  - `speedCurve`: variable playback speed over time
  - `crop`: crop video region

### Changed

- `ShapeTypeSchema` expanded to include `circle`, `ellipse`, `line`
- Builder API `SceneBuilder` updated with `addSvg()`, `addWaveform()`, `addCaption()` methods

---

## [1.0.3] - 2026-02-23

### Added

- **Multi-track support**: `VideoConfig.tracks[]` replaces single `scenes[]`
  - Each track has `type` (`video` | `audio`), `zIndex`, `start` offset
  - Legacy `scenes[]` format still supported (auto-converted to single track)
- **`validateConfig(input)`**: validate config and return detailed error list
- **`assertValidConfig(input)`**: validate and throw on failure with readable messages
- **`VideoConfigInputSchema`**: accepts both new (`tracks[]`) and legacy (`scenes[]`) formats
- **Builder API**: `VideoBuilder`, `TrackBuilder`, `SceneBuilder` — fluent API for building configs programmatically
- **`SceneBuilder.addText()`**, **`addImage()`**, **`addVideo()`**, **`addShape()`**
- **Shape element** (`type: 'shape'`): rectangle with fill/stroke/gradient
- **Text glow**: `glow: { color, blur }`
- **Text gradient**: `gradient: { type, colors, angle }`
- **Animations expanded**: `bounce`, `pop`, `shake`, `typewriter`, slide-out variants
- **Easing types**: `easeInBack`, `easeOutBack`, `easeInOutBack`, `easeOutBounce`, `easeOutElastic`, `spring`
- **Transitions expanded**: `wipeLeft`, `wipeRight`, `wipeUp`, `wipeDown`, `zoomIn`, `zoomOut`
- **`publish.sh`** script for automated versioning and npm publishing

### Changed

- Migrated canvas engine from `node-canvas` to `@napi-rs/canvas` (Skia-based, faster, no system deps)
- Significant rendering performance improvements:
  - Canvas reuse across frames
  - Parallel asset loading
  - Asset caching (images, fonts)
  - Pre-computed scene time ranges with binary search O(log n)

---

## [1.0.0] - 2026-02-23 _(initial release)_

### Added

- Core rendering engine: JSON config → MP4 video via FFmpeg
- Element types: `text`, `image`, `video`
- Animations: `fadeIn`, `fadeOut`, `fadeInOut`, `slideInLeft`, `slideInRight`, `slideInTop`, `slideInBottom`, `zoomIn`, `zoomOut`
- Easing types: `linear`, `easeIn`, `easeOut`, `easeInOut`, cubic variants
- Transitions: `fade`, `slideLeft`, `slideRight`, `slideUp`, `slideDown`
- Scene-level: `bgColor`, `bgGradient`, `audio`, `vignette`, `colorOverlay`
- Element-level: `position`, `offsetX/Y`, `opacity`, `scale`, `rotation`, `shadow`, `filters`, `blendMode`, `borderRadius`
- Image: `fit` (cover/contain/fill), Ken Burns effect (`kenBurns`)
- Video: `loop`, `volume`, `trimStart`, `speed`
- Audio: `url`, `start`, `volume`, `loop`, `duration`, `trimStart`, `trimEnd`, `fadeIn`, `fadeOut`
- Platform detection: Apple Silicon (VideoToolbox), NVIDIA (NVENC), CPU fallback
- `json2video()` (returns buffer) and `json2videoFile()` (writes to file) APIs
- TypeScript types and JSDoc throughout
- `zod` schema validation

---

[1.1.1]: https://github.com/phamvanquyit/qpv-json2video/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/phamvanquyit/qpv-json2video/compare/v1.0.5...v1.1.0
[1.0.5]: https://github.com/phamvanquyit/qpv-json2video/compare/v1.0.4...v1.0.5
[1.0.4]: https://github.com/phamvanquyit/qpv-json2video/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/phamvanquyit/qpv-json2video/compare/v1.0.0...v1.0.3
[1.0.0]: https://github.com/phamvanquyit/qpv-json2video/releases/tag/v1.0.0
