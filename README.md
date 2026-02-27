# qpv-json2video

Generate videos from JSON configuration using `@napi-rs/canvas` (Skia) and `FFmpeg`.

[![GitHub](https://img.shields.io/badge/GitHub-qpv--json2video-blue?logo=github)](https://github.com/phamvanquyit/qpv-json2video)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **Multi-track timeline** — overlay multiple video/audio tracks with zIndex ordering
- **8 element types** — Text, Image, Video, Caption, Shape, SVG, Waveform, Timer
- **17 animations** — fadeIn, slideIn, zoomIn, bounce, pop, shake, typewriter, etc.
- **11 scene transitions** — fade, slide, wipe, zoom (all directions)
- **Drop shadow** — configurable shadow on any element
- **Glow effect** — neon glow on text elements
- **Gradient fill** — linear/radial gradients on text, shapes, and scene backgrounds
- **Video speed control** — slow-mo (0.5x) to fast-forward (2x+)
- **Element transform** — scale and rotation on any element
- **Visual filters** — CSS-style filters (blur, brightness, contrast, saturate, grayscale, sepia, hueRotate, invert)
- **Blend modes** — 12 blend modes (multiply, screen, overlay, darken, lighten, etc.)
- **Vignette** — darkened edges effect on scenes
- **Color overlay** — semi-transparent color tinting on scenes with optional blend mode
- **Positioning** — 9 preset positions + custom offset
- **Google Fonts** — auto-download by font name
- **Audio mixing** — multiple audio tracks per scene with volume, fade, loop, trim
- **Word-level highlight** — karaoke-style word highlighting in captions
- **Word-by-word display** — CapCut-style one-word-at-a-time captions with pop-in animation
- **Local file support** — load assets from `file://`, `./relative`, or absolute paths
- **GPU encoding** — auto-detect hardware encoder (VideoToolbox / NVENC / VAAPI / QSV)
- **Audio waveform visualization** — animated bars, line, mirror, and circle styles from audio data
- **Timer display** — real-time running clock (hh:mm:ss:SSS) with countdown support
- **Chroma key (green screen)** — remove background color from video elements
- **Mask** — shape and text masks for creative clipping effects

## Requirements

- **Node.js** >= 18
- **FFmpeg** in `PATH`
- System dependencies for `@napi-rs/canvas`:
  - macOS: `brew install pkg-config cairo pango libpng jpeg giflib librsvg pixman`
  - Ubuntu: `sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev`

## Installation

```bash
yarn add qpv-json2video
```

## Quick Start

```ts
import { json2videoFile } from "qpv-json2video";

await json2videoFile(
  {
    width: 1080,
    height: 1920,
    fps: 30,
    tracks: [
      {
        type: "video",
        zIndex: 0,
        scenes: [
          {
            duration: 5,
            bgColor: "#1a1a2e",
            elements: [
              {
                type: "text",
                text: "Hello World!",
                fontSize: 72,
                fontFamily: "Orbitron",
                color: "#FFFFFF",
                position: "center",
                zIndex: 1,
                animation: { type: "fadeIn", fadeInDuration: 1 },
              },
            ],
          },
        ],
      },
    ],
  },
  "./output.mp4",
  { onProgress: (p) => console.log(`${p}%`) },
);
```

## API

### `json2video(config, options?): Promise<RenderResult>`

Render video and return buffer.

### `json2videoFile(config, outputPath, options?): Promise<RenderResult>`

Render video and save to file.

### RenderOptions

| Field        | Type                         | Default       | Description               |
| ------------ | ---------------------------- | ------------- | ------------------------- |
| `cacheDir`   | `string`                     | `os.tmpdir()` | Directory to cache assets |
| `onProgress` | `(progress: number) => void` |               | Progress callback (0–100) |
| `outputDir`  | `string`                     | `os.tmpdir()` | Temp output directory     |

### RenderResult

| Field      | Type      | Description                                           |
| ---------- | --------- | ----------------------------------------------------- |
| `success`  | `boolean` | Whether rendering succeeded                           |
| `message`  | `string`  | Result message                                        |
| `buffer`   | `Buffer`  | MP4 buffer (`json2video`) or empty (`json2videoFile`) |
| `fileName` | `string`  | Generated filename                                    |
| `filePath` | `string?` | Output file path (only for `json2videoFile`)          |

## Examples

The [`examples/`](https://github.com/phamvanquyit/qpv-json2video/tree/master/examples) directory contains ready-to-use JSON configs demonstrating every feature:

| #   | File                           | Description                                                             |
| --- | ------------------------------ | ----------------------------------------------------------------------- |
| 01  | `01_basic_text.json`           | Basic text rendering with fonts and styles                              |
| 02  | `02_animations.json`           | All animation types (fade, slide, zoom, bounce, pop, shake, typewriter) |
| 03  | `03_transitions.json`          | Scene transitions (fade, slide, wipe, zoom)                             |
| 04  | `04_shapes.json`               | Shape elements (rectangle, circle, ellipse, line)                       |
| 05  | `05_shadow_glow_gradient.json` | Drop shadow, glow effect, gradient fill                                 |
| 06  | `06_keyframes.json`            | Keyframe-based animations                                               |
| 07  | `07_transform_timing.json`     | Transform (scale, rotation) and element timing                          |
| 08  | `08_filters.json`              | Visual filters (blur, brightness, contrast, etc.)                       |
| 09  | `09_blend_modes.json`          | Blend modes (multiply, screen, overlay, etc.)                           |
| 10  | `10_vignette_overlay.json`     | Vignette and color overlay effects                                      |
| 11  | `11_images.json`               | Image elements with various fits and styles                             |
| 12  | `12_captions.json`             | SRT captions with word highlight and word-by-word display               |
| 13  | `13_multi_track.json`          | Multi-track timeline with zIndex ordering                               |
| 14  | `14_rich_text.json`            | Rich text styling features                                              |
| 15  | `15_text_bg_shapes.json`       | Text with background shapes                                             |
| 16  | `16_counter_animation.json`    | Counter/number animation effects                                        |
| 17  | `17_video_processing.json`     | Video element with speed control and trimming                           |
| 18  | `18_ken_burns.json`            | Ken Burns (pan & zoom) effect                                           |
| 19  | `19_svg_rendering.json`        | SVG element rendering                                                   |
| 20  | `20_waveform.json`             | Audio waveform visualization (bars, line, mirror, circle)               |
| 21  | `21_chroma_key.json`           | Chroma key (green screen) removal                                       |
| 22  | `22_masks.json`                | Shape and text masks                                                    |
| 23  | `23_timer.json`                | Timer display (hh:mm:ss:SSS, countdown, separator color)                |

## Documentation

📖 **Full documentation:** 👉 [**docs/**](https://github.com/phamvanquyit/qpv-json2video/tree/master/docs)

| Category            | Docs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Getting Started** | [Installation, API, Quick Start](https://github.com/phamvanquyit/qpv-json2video/blob/master/docs/getting-started.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Schema**          | [VideoConfig, Track, Scene](https://github.com/phamvanquyit/qpv-json2video/blob/master/docs/schema.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Elements**        | [Text](https://github.com/phamvanquyit/qpv-json2video/blob/master/docs/elements/text.md) · [Image](https://github.com/phamvanquyit/qpv-json2video/blob/master/docs/elements/image.md) · [Video](https://github.com/phamvanquyit/qpv-json2video/blob/master/docs/elements/video.md) · [Shape](https://github.com/phamvanquyit/qpv-json2video/blob/master/docs/elements/shape.md) · [Caption](https://github.com/phamvanquyit/qpv-json2video/blob/master/docs/elements/caption.md) · [SVG](https://github.com/phamvanquyit/qpv-json2video/blob/master/docs/elements/svg.md) · [Waveform](https://github.com/phamvanquyit/qpv-json2video/blob/master/docs/elements/waveform.md) · [Timer](https://github.com/phamvanquyit/qpv-json2video/blob/master/docs/elements/timer.md)                               |
| **Effects**         | [Shadow](https://github.com/phamvanquyit/qpv-json2video/blob/master/docs/effects/shadow.md) · [Filters](https://github.com/phamvanquyit/qpv-json2video/blob/master/docs/effects/filters.md) · [Blend Modes](https://github.com/phamvanquyit/qpv-json2video/blob/master/docs/effects/blend-modes.md) · [Gradient](https://github.com/phamvanquyit/qpv-json2video/blob/master/docs/effects/gradient.md) · [Glow](https://github.com/phamvanquyit/qpv-json2video/blob/master/docs/effects/glow.md) · [Vignette](https://github.com/phamvanquyit/qpv-json2video/blob/master/docs/effects/vignette.md) · [Color Overlay](https://github.com/phamvanquyit/qpv-json2video/blob/master/docs/effects/color-overlay.md) · [Mask](https://github.com/phamvanquyit/qpv-json2video/blob/master/docs/effects/mask.md) |
| **Motion**          | [Animations](https://github.com/phamvanquyit/qpv-json2video/blob/master/docs/animations.md) · [Transitions](https://github.com/phamvanquyit/qpv-json2video/blob/master/docs/transitions.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Audio**           | [Audio mixing, fade, loop, trim](https://github.com/phamvanquyit/qpv-json2video/blob/master/docs/audio.md)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

## License

MIT
