# qpv-json2video

Generate videos from JSON configuration using `@napi-rs/canvas` (Skia) and `FFmpeg`.

## Features

- **Multi-track timeline** — overlay multiple video/audio tracks with zIndex ordering
- **5 element types** — Text, Image, Video, Caption (SRT subtitles), Shape (rectangles/frames)
- **Scene transitions** — fade between scenes
- **Animations** — fadeIn, fadeOut, fadeInOut on any element
- **Positioning** — 9 preset positions + custom offset
- **Google Fonts** — auto-download by font name
- **Audio mixing** — multiple audio tracks with volume, fade, loop
- **Word-level highlight** — karaoke-style word highlighting in captions
- **Word-by-word display** — CapCut-style one-word-at-a-time captions with pop-in animation
- **GPU encoding** — auto-detect hardware encoder (VideoToolbox / NVENC / VAAPI / QSV)

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

---

## JSON Schema

### VideoConfig (root)

| Field    | Type      | Required | Default | Description       |
| -------- | --------- | -------- | ------- | ----------------- |
| `width`  | `number`  | ✅       |         | Video width (px)  |
| `height` | `number`  | ✅       |         | Video height (px) |
| `fps`    | `number`  |          | `30`    | Frames per second |
| `tracks` | `Track[]` | ✅       |         | Array of tracks   |

### Track

| Field    | Type                   | Required | Default | Description                                       |
| -------- | ---------------------- | -------- | ------- | ------------------------------------------------- |
| `type`   | `"video"` \| `"audio"` | ✅       |         | `video` renders visuals, `audio` mixes sound only |
| `zIndex` | `number`               |          | `0`     | Higher zIndex draws on top                        |
| `start`  | `number`               |          | `0`     | Start time on the global timeline (seconds)       |
| `scenes` | `Scene[]`              | ✅       |         | Scenes played sequentially within track           |

**Timeline diagram:**

```
Time (s):     0    1    2    3    4    5    6    7    8
              |----|----|----|----|----|----|----|----|

Track 0 (z:0) [==== Scene 1 ====][==== Scene 2 ====]
              start: 0

Track 1 (z:1)          [=== Scene 1 ===]
                        start: 2

Track audio   [♪♪♪♪♪♪♪♪♪♪♪♪ BGM ♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪]
              start: 0
```

### Scene

| Field        | Type              | Required | Default     | Description                    |
| ------------ | ----------------- | -------- | ----------- | ------------------------------ |
| `duration`   | `number`          | ✅       |             | Duration in seconds            |
| `bgColor`    | `string`          |          | `"#000000"` | Background color               |
| `elements`   | `SceneElement[]`  |          | `[]`        | Visual elements                |
| `audio`      | `AudioConfig`     |          |             | Scene audio                    |
| `transition` | `SceneTransition` |          |             | Transition from previous scene |

**SceneTransition:**

| Field      | Type     | Description               |
| ---------- | -------- | ------------------------- |
| `type`     | `"fade"` | Transition type           |
| `duration` | `number` | Transition duration (sec) |

---

## Element Types

### Base Properties (shared by all elements)

| Field          | Type               | Default        | Description                       |
| -------------- | ------------------ | -------------- | --------------------------------- |
| `position`     | `PositionType`     | **required**   | Preset position                   |
| `zIndex`       | `number`           | **required**   | Draw order within scene           |
| `offsetX`      | `number`           | `0`            | Horizontal offset from position   |
| `offsetY`      | `number`           | `0`            | Vertical offset from position     |
| `opacity`      | `number`           | `1`            | Opacity (0–1)                     |
| `borderRadius` | `number`           |                | Corner radius (px)                |
| `start`        | `number`           | `0`            | Start time within scene (seconds) |
| `duration`     | `number`           | scene duration | Display duration (seconds)        |
| `animation`    | `ElementAnimation` |                | Animation effect                  |

**PositionType values:**

```
 top-left      top-center      top-right
    ┌──────────────┬──────────────┐
    │              │              │
    │    left       center        right
    │              │              │
    ├──────────────┼──────────────┤
    │              │              │
    │ bottom-left  bottom-center  bottom-right
    └──────────────┴──────────────┘
```

**ElementAnimation:**

| Field             | Type                                       | Default | Description           |
| ----------------- | ------------------------------------------ | ------- | --------------------- |
| `type`            | `"fadeIn"` \| `"fadeOut"` \| `"fadeInOut"` |         | Animation type        |
| `fadeInDuration`  | `number`                                   | `0.5`   | Fade in duration (s)  |
| `fadeOutDuration` | `number`                                   | `0.5`   | Fade out duration (s) |

---

### Text Element

```json
{
  "type": "text",
  "text": "Hello World",
  "fontFamily": "Orbitron",
  "fontSize": 48,
  "fontWeight": "bold",
  "color": "#FFFFFF",
  "bgColor": "rgba(0,0,0,0.5)",
  "maxWidth": "80%",
  "textAlign": "center",
  "strokeColor": "#000000",
  "strokeWidth": 3,
  "lineHeight": 1.3,
  "padding": 10,
  "position": "center",
  "zIndex": 1
}
```

| Field         | Type               | Default        | Description                              |
| ------------- | ------------------ | -------------- | ---------------------------------------- |
| `text`        | `string`           | **required**   | Text content                             |
| `fontFamily`  | `string`           | `"sans-serif"` | Font name (Google Fonts auto-downloaded) |
| `fontSize`    | `number`           | `48`           | Font size (px)                           |
| `fontWeight`  | `string \| number` | `400`          | `"bold"`, `700`, `"normal"`, etc.        |
| `color`       | `string`           | `"#FFFFFF"`    | Text color                               |
| `bgColor`     | `string`           |                | Background color (supports rgba)         |
| `maxWidth`    | `number \| string` | 90% of canvas  | Max width. e.g. `500` or `"80%"`         |
| `textAlign`   | `string`           | `"left"`       | `"left"` `"center"` `"right"`            |
| `strokeColor` | `string`           | `"#000000"`    | Text outline color                       |
| `strokeWidth` | `number`           | `0`            | Outline thickness (px)                   |
| `lineHeight`  | `number`           | `1.3`          | Line height multiplier                   |
| `padding`     | `number`           | `10`           | Padding inside bgColor box (px)          |

> **Google Fonts:** Just set `fontFamily: "Orbitron"` — the engine auto-detects and downloads the font from Google Fonts.

---

### Image Element

```json
{
  "type": "image",
  "url": "https://example.com/photo.jpg",
  "width": 400,
  "height": 400,
  "fit": "cover",
  "position": "top-right",
  "zIndex": 1,
  "opacity": 0.5,
  "borderRadius": 50
}
```

| Field    | Type     | Default      | Description                    |
| -------- | -------- | ------------ | ------------------------------ |
| `url`    | `string` | **required** | Image URL (http/https)         |
| `width`  | `number` | **required** | Display width (px)             |
| `height` | `number` | **required** | Display height (px)            |
| `fit`    | `string` | `"cover"`    | `"cover"` `"contain"` `"fill"` |

---

### Video Element

```json
{
  "type": "video",
  "url": "https://example.com/bg.mp4",
  "width": 1080,
  "height": 1920,
  "fit": "cover",
  "trimStart": 2,
  "loop": false,
  "volume": 0.5,
  "position": "center",
  "zIndex": 0,
  "opacity": 0.4
}
```

| Field       | Type      | Default      | Description                    |
| ----------- | --------- | ------------ | ------------------------------ |
| `url`       | `string`  | **required** | Video URL (http/https)         |
| `width`     | `number`  | **required** | Display width (px)             |
| `height`    | `number`  | **required** | Display height (px)            |
| `fit`       | `string`  | `"cover"`    | `"cover"` `"contain"` `"fill"` |
| `trimStart` | `number`  | `0`          | Skip first N seconds           |
| `loop`      | `boolean` | `false`      | Loop video                     |
| `volume`    | `number`  |              | Audio volume of video element  |

---

### Shape Element (Rectangles, Frames)

```json
{
  "type": "shape",
  "width": 500,
  "height": 300,
  "bgColor": "#ff0000",
  "strokeColor": "#ffffff",
  "strokeWidth": 4,
  "borderRadius": 20,
  "position": "center",
  "zIndex": 1
}
```

| Field         | Type     | Default      | Description                |
| ------------- | -------- | ------------ | -------------------------- |
| `width`       | `number` | **required** | Width (px)                 |
| `height`      | `number` | **required** | Height (px)                |
| `bgColor`     | `string` | transparent  | Fill color (supports rgba) |
| `strokeColor` | `string` |              | Border color               |
| `strokeWidth` | `number` | `2`          | Border thickness (px)      |

**Use cases:**

- **Photo frame:** `strokeColor` only → transparent inside, visible border
- **Colored box:** `bgColor` only → filled rectangle
- **Framed box:** both `bgColor` + `strokeColor` → filled with border
- **Dimming overlay:** `bgColor: "rgba(0,0,0,0.5)"` → semi-transparent overlay

---

### Caption Element (SRT Subtitle)

```json
{
  "type": "caption",
  "srtContent": "1\n00:00:00,000 --> 00:00:03,000\nHello world!\n\n2\n00:00:03,500 --> 00:00:06,000\nThis is a caption.",
  "fontFamily": "Exo 2",
  "fontSize": 38,
  "color": "#FFFFFF",
  "strokeColor": "#000000",
  "strokeWidth": 4,
  "backgroundColor": "rgba(0,0,0,0.6)",
  "maxWidth": "85%",
  "lineHeight": 1.5,
  "textAlign": "center",
  "borderRadius": 12,
  "position": "bottom-center",
  "zIndex": 10,
  "offsetY": -80
}
```

| Field             | Type     | Default        | Description                             |
| ----------------- | -------- | -------------- | --------------------------------------- |
| `srtContent`      | `string` | **required**   | SRT subtitle content                    |
| `fontFamily`      | `string` | `"sans-serif"` | Font (auto Google Fonts)                |
| `fontSize`        | `number` | `52`           | Font size (px)                          |
| `color`           | `string` | `"#FFFFFF"`    | Text color                              |
| `strokeColor`     | `string` | `"#000000"`    | Outline color                           |
| `strokeWidth`     | `number` | `4`            | Outline thickness (px)                  |
| `backgroundColor` | `string` |                | Caption box background                  |
| `maxWidth`        | `string` | `"90%"`        | Max width                               |
| `lineHeight`      | `number` | `1.3`          | Line height multiplier                  |
| `textAlign`       | `string` | `"left"`       | `"left"` `"center"` `"right"`           |
| `displayMode`     | `string` | `"sentence"`   | `"sentence"` or `"word"` (CapCut-style) |

#### Word-level Highlight (Karaoke)

Enable `wordHighlight: true` to highlight each word based on timing:

```json
{
  "type": "caption",
  "srtContent": "1\n00:00:00,000 --> 00:00:03,000\nHello beautiful world",
  "wordHighlight": true,
  "highlightStyle": "color",
  "highlightColor": "#FFD700",
  "fontSize": 52,
  "position": "bottom-center",
  "zIndex": 10
}
```

Word timing is auto-distributed proportionally by character count.

| Field              | Type                                     | Default                 | Description                                     |
| ------------------ | ---------------------------------------- | ----------------------- | ----------------------------------------------- |
| `wordHighlight`    | `boolean`                                | `false`                 | Enable word highlight                           |
| `highlightColor`   | `string`                                 | `"#FFD700"`             | Active word color                               |
| `highlightBgColor` | `string`                                 | `"rgba(255,215,0,0.3)"` | Active word background (for `background` style) |
| `highlightStyle`   | `"color"` \| `"background"` \| `"scale"` | `"color"`               | Highlight effect type                           |
| `highlightScale`   | `number`                                 | `1.15`                  | Scale factor (for `scale` style)                |

**Highlight styles:**

| Style        | Effect                                    |
| ------------ | ----------------------------------------- |
| `color`      | Change text color (default)               |
| `background` | Add background behind word + change color |
| `scale`      | Scale up active word + change color       |

#### Word-by-word Display (CapCut style)

Set `displayMode: "word"` to show one word at a time with a pop-in animation:

```json
{
  "type": "caption",
  "srtContent": "1\n00:00:00,000 --> 00:00:03,000\nHello beautiful world",
  "displayMode": "word",
  "highlightColor": "#FFD700",
  "fontSize": 64,
  "position": "center",
  "zIndex": 10
}
```

Each word appears individually with a smooth scale pop-in effect (ease-out-back). Word timing is auto-distributed proportionally by character count.

| Display Mode | Description                                   |
| ------------ | --------------------------------------------- |
| `sentence`   | Show full subtitle text (default)             |
| `word`       | Show one word at a time with pop-in animation |

---

### Audio Config

Placed in `scene.audio`:

```json
{
  "duration": 30,
  "audio": {
    "url": "https://example.com/bgm.mp3",
    "volume": 0.3,
    "loop": true,
    "fadeIn": 2.0,
    "fadeOut": 3.0
  }
}
```

| Field      | Type      | Default      | Description                 |
| ---------- | --------- | ------------ | --------------------------- |
| `url`      | `string`  | **required** | Audio URL (http/https)      |
| `volume`   | `number`  | `1`          | Volume multiplier           |
| `loop`     | `boolean` | `false`      | Loop audio                  |
| `start`    | `number`  | `0`          | Start offset (seconds)      |
| `duration` | `number`  |              | Trim duration (seconds)     |
| `fadeIn`   | `number`  | `0`          | Fade in duration (seconds)  |
| `fadeOut`  | `number`  | `0`          | Fade out duration (seconds) |

---

## Full Example

```json
{
  "width": 1080,
  "height": 1920,
  "fps": 30,
  "tracks": [
    {
      "type": "video",
      "zIndex": 0,
      "scenes": [
        {
          "duration": 5,
          "bgColor": "#0a0a1a",
          "elements": [
            {
              "type": "video",
              "url": "https://example.com/bg.mp4",
              "width": 1080,
              "height": 1920,
              "position": "center",
              "zIndex": 0,
              "fit": "cover",
              "trimStart": 2,
              "opacity": 0.4
            }
          ]
        },
        {
          "duration": 5,
          "bgColor": "#0a0a1a",
          "transition": { "type": "fade", "duration": 0.8 }
        }
      ]
    },
    {
      "type": "video",
      "zIndex": 1,
      "scenes": [
        {
          "duration": 10,
          "elements": [
            {
              "type": "image",
              "url": "https://example.com/logo.png",
              "width": 100,
              "height": 100,
              "position": "top-right",
              "zIndex": 0,
              "opacity": 0.4,
              "offsetX": -24,
              "offsetY": 24,
              "borderRadius": 50
            }
          ]
        }
      ]
    },
    {
      "type": "video",
      "zIndex": 2,
      "scenes": [
        {
          "duration": 5,
          "elements": [
            {
              "type": "text",
              "text": "PRODUCT NAME",
              "fontFamily": "Orbitron",
              "fontSize": 72,
              "fontWeight": "bold",
              "color": "#FFFFFF",
              "position": "center",
              "zIndex": 1,
              "animation": { "type": "fadeIn", "fadeInDuration": 1.2 }
            }
          ]
        },
        {
          "duration": 5,
          "transition": { "type": "fade", "duration": 0.5 },
          "elements": [
            {
              "type": "text",
              "text": "BUY NOW — $9.99",
              "fontFamily": "Orbitron",
              "fontSize": 64,
              "color": "#FF6B35",
              "bgColor": "rgba(0,0,0,0.6)",
              "position": "center",
              "zIndex": 1,
              "padding": 24,
              "borderRadius": 16,
              "animation": {
                "type": "fadeInOut",
                "fadeInDuration": 1,
                "fadeOutDuration": 1
              }
            }
          ]
        }
      ]
    },
    {
      "type": "video",
      "zIndex": 3,
      "scenes": [
        {
          "duration": 10,
          "elements": [
            {
              "type": "caption",
              "srtContent": "1\n00:00:00,500 --> 00:00:03,500\nNew product\n\n2\n00:00:04,000 --> 00:00:07,000\nPremium design",
              "fontSize": 38,
              "fontFamily": "Exo 2",
              "color": "#FFFFFF",
              "strokeColor": "#000000",
              "strokeWidth": 4,
              "backgroundColor": "rgba(0,0,0,0.6)",
              "maxWidth": "85%",
              "textAlign": "center",
              "borderRadius": 12,
              "position": "bottom-center",
              "zIndex": 10,
              "offsetY": -80,
              "wordHighlight": true,
              "highlightStyle": "color",
              "highlightColor": "#FFD700"
            }
          ]
        }
      ]
    },
    {
      "type": "audio",
      "scenes": [
        {
          "duration": 10,
          "audio": {
            "url": "https://example.com/bgm.mp3",
            "volume": 0.15,
            "fadeIn": 2,
            "fadeOut": 3
          }
        }
      ]
    }
  ]
}
```

## License

MIT
