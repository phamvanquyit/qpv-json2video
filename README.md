# qpv-json2video

Generate video from JSON config using `node-canvas` and `FFmpeg`.

## Features

- 🎬 **Multi-track timeline** — Nhiều video/audio tracks chồng lên nhau
- 🎨 **4 element types** — Text, Image, Video, Caption (SRT)
- 🔀 **Scene transitions** — Fade giữa các scenes
- ✨ **Animation** — fadeIn, fadeOut, fadeInOut
- 🌫️ **Opacity** — Điều chỉnh độ trong suốt
- 📍 **Positioning** — 9 preset positions + custom x/y + offset
- ✂️ **Video trim** — Cắt video từ giây bất kỳ
- 🔤 **Google Fonts** — Auto detect & download font từ tên fontFamily
- 🎵 **Audio mixing** — Mix nhiều audio tracks, fade in/out, volume, loop
- 🔤 **Word-level highlight** — Karaoke-style highlight từng từ trong caption (color / background / scale)

## Requirements

- **Node.js** >= 18
- **FFmpeg** in `PATH`
- System deps for `canvas`:
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

### `json2video(config, options?)`

Render video, trả về `Buffer`.

### `json2videoFile(config, outputPath, options?)`

Render video và lưu ra file.

**RenderOptions:**

| Option       | Type                         | Description                             |
| ------------ | ---------------------------- | --------------------------------------- |
| `cacheDir`   | `string`                     | Thư mục cache assets (mặc định: tmpdir) |
| `onProgress` | `(progress: number) => void` | Callback progress 0-100                 |
| `outputDir`  | `string`                     | Thư mục output tạm                      |

**RenderResult:**

| Field      | Type      | Description          |
| ---------- | --------- | -------------------- |
| `success`  | `boolean` | Thành công hay không |
| `message`  | `string`  | Thông báo kết quả    |
| `buffer`   | `Buffer`  | MP4 video buffer     |
| `fileName` | `string`  | Tên file generated   |

---

## JSON Schema

### VideoConfig (root)

```json
{
  "width": 1080,
  "height": 1920,
  "fps": 30,
  "tracks": [...]
}
```

| Field    | Type      | Required | Default | Description           |
| -------- | --------- | -------- | ------- | --------------------- |
| `width`  | `number`  | ✅       |         | Chiều rộng video (px) |
| `height` | `number`  | ✅       |         | Chiều cao video (px)  |
| `fps`    | `number`  |          | 30      | Frames per second     |
| `tracks` | `Track[]` | ✅       |         | Danh sách tracks      |

### Track

```json
{
  "type": "video",
  "zIndex": 0,
  "start": 0,
  "scenes": [...]
}
```

| Field    | Type                 | Required | Default | Description                                           |
| -------- | -------------------- | -------- | ------- | ----------------------------------------------------- |
| `type`   | `"video" \| "audio"` | ✅       |         | `video` = render hình ảnh, `audio` = chỉ mix âm thanh |
| `zIndex` | `number`             |          | 0       | Track nào zIndex cao hơn → vẽ đè lên                  |
| `start`  | `number`             |          | 0       | Thời điểm track bắt đầu trên timeline (giây)          |
| `scenes` | `Scene[]`            | ✅       |         | Scenes nối tiếp nhau trong track                      |

**Timeline:**

```
Time (s):       0    1    2    3    4    5    6    7    8
                |----|----|----|----|----|----|----|----|

Track 0 (z:0)  [==== Scene 1 ====][==== Scene 2 ====]
                start: 0

Track 1 (z:1)            [=== Scene 1 ===]
                          start: 2

Track audio    [♪♪♪♪♪♪♪♪♪♪♪♪ BGM ♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪♪]
                start: 0
```

### Scene

```json
{
  "duration": 5,
  "bgColor": "#1a1a2e",
  "elements": [...],
  "audio": {...},
  "transition": { "type": "fade", "duration": 0.5 }
}
```

| Field        | Type              | Required | Default     | Description                              |
| ------------ | ----------------- | -------- | ----------- | ---------------------------------------- |
| `duration`   | `number`          | ✅       |             | Thời lượng scene (giây)                  |
| `bgColor`    | `string`          |          | `"#000000"` | Màu nền                                  |
| `elements`   | `SceneElement[]`  |          | `[]`        | Visual elements trong scene              |
| `audio`      | `AudioConfig`     |          |             | Audio đính kèm scene                     |
| `transition` | `SceneTransition` |          |             | Transition vào scene (áp dụng đầu scene) |

**SceneTransition:**

| Field      | Type     | Description                  |
| ---------- | -------- | ---------------------------- |
| `type`     | `"fade"` | Loại transition              |
| `duration` | `number` | Thời lượng transition (giây) |

---

## Element Types

Tất cả elements đều có chung **base properties**:

### Base Properties (chung cho mọi element)

| Field          | Type               | Default        | Description                          |
| -------------- | ------------------ | -------------- | ------------------------------------ |
| `position`     | `PositionType`     | _(bắt buộc)_   | Vị trí preset (xem bảng bên dưới)    |
| `zIndex`       | `number`           | _(bắt buộc)_   | Thứ tự vẽ trong scene                |
| `offsetX`      | `number`           | 0              | Offset X từ position (px)            |
| `offsetY`      | `number`           | 0              | Offset Y từ position (px)            |
| `opacity`      | `number`           | 1              | Độ trong suốt (0-1)                  |
| `borderRadius` | `number`           |                | Bo góc (px)                          |
| `start`        | `number`           | 0              | Thời điểm bắt đầu trong scene (giây) |
| `duration`     | `number`           | scene duration | Thời lượng hiển thị (giây)           |
| `animation`    | `ElementAnimation` |                | Animation effect                     |

**PositionType:** `center` `top-left` `top-center` `top-right` `left` `right` `bottom-left` `bottom-center` `bottom-right`

```
 top-left      top-center      top-right
    ┌──────────────┬──────────────┐
    │              │              │
    │    left      │   center     │    right
    │              │              │
    ├──────────────┼──────────────┤
    │              │              │
    │ bottom-left  │bottom-center │ bottom-right
    └──────────────┴──────────────┘

 Dùng offsetX/offsetY để tinh chỉnh:
   { "position": "top-right", "offsetX": -20, "offsetY": 20 }
```

**ElementAnimation:**

| Field             | Type                                   | Default | Description         |
| ----------------- | -------------------------------------- | ------- | ------------------- |
| `type`            | `"fadeIn" \| "fadeOut" \| "fadeInOut"` |         | Loại animation      |
| `fadeInDuration`  | `number`                               | 0.5     | Thời lượng fade in  |
| `fadeOutDuration` | `number`                               | 0.5     | Thời lượng fade out |

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

| Field         | Type               | Default        | Description                               |
| ------------- | ------------------ | -------------- | ----------------------------------------- |
| `type`        | `"text"`           | _(bắt buộc)_   |                                           |
| `text`        | `string`           | _(bắt buộc)_   | Nội dung text                             |
| `fontFamily`  | `string`           | `"sans-serif"` | Tên font. Google Fonts auto download      |
| `fontSize`    | `number`           | 48             | Cỡ chữ (px)                               |
| `fontWeight`  | `string \| number` | 400            | `"bold"`, `700`, `"normal"`, ...          |
| `color`       | `string`           | `"#FFFFFF"`    | Màu chữ                                   |
| `bgColor`     | `string`           |                | Màu nền (hỗ trợ rgba)                     |
| `maxWidth`    | `number \| string` | 90% canvas     | Chiều rộng tối đa. VD: `500` hoặc `"80%"` |
| `textAlign`   | `string`           | `"left"`       | `"left"` `"center"` `"right"`             |
| `strokeColor` | `string`           |                | Màu viền chữ                              |
| `strokeWidth` | `number`           | 0              | Độ dày viền (px)                          |
| `lineHeight`  | `number`           | 1.3            | Hệ số line height                         |
| `padding`     | `number`           | 10             | Padding cho bgColor (px)                  |

> **Google Fonts:** Chỉ cần set `fontFamily: "Orbitron"` — engine tự detect & download font từ Google Fonts. Không cần config gì thêm.

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

| Field    | Type      | Default      | Description                    |
| -------- | --------- | ------------ | ------------------------------ |
| `type`   | `"image"` | _(bắt buộc)_ |                                |
| `url`    | `string`  | _(bắt buộc)_ | URL ảnh (http/https)           |
| `width`  | `number`  | _(bắt buộc)_ | Chiều rộng (px)                |
| `height` | `number`  | _(bắt buộc)_ | Chiều cao (px)                 |
| `fit`    | `string`  | `"cover"`    | `"cover"` `"contain"` `"fill"` |

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
| `type`      | `"video"` | _(bắt buộc)_ |                                |
| `url`       | `string`  | _(bắt buộc)_ | URL video (http/https)         |
| `width`     | `number`  | _(bắt buộc)_ | Chiều rộng (px)                |
| `height`    | `number`  | _(bắt buộc)_ | Chiều cao (px)                 |
| `fit`       | `string`  | `"cover"`    | `"cover"` `"contain"` `"fill"` |
| `trimStart` | `number`  | 0            | Skip N giây đầu video          |
| `loop`      | `boolean` | false        | Lặp video                      |
| `volume`    | `number`  |              | Volume âm thanh video          |

---

### Caption Element (SRT Subtitle)

```json
{
  "type": "caption",
  "srtContent": "1\n00:00:00,000 --> 00:00:03,000\nXin chào!\n\n2\n00:00:03,500 --> 00:00:06,000\nĐây là caption.",
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

| Field             | Type        | Default        | Description                    |
| ----------------- | ----------- | -------------- | ------------------------------ |
| `type`            | `"caption"` | _(bắt buộc)_   |                                |
| `srtContent`      | `string`    | _(bắt buộc)_   | Nội dung SRT (subtitle format) |
| `fontFamily`      | `string`    | `"sans-serif"` | Google Fonts auto download     |
| `fontSize`        | `number`    | 52             | Cỡ chữ (px)                    |
| `color`           | `string`    | `"#FFFFFF"`    | Màu chữ                        |
| `strokeColor`     | `string`    | `"#000000"`    | Màu viền chữ                   |
| `strokeWidth`     | `number`    | 4              | Độ dày viền (px)               |
| `backgroundColor` | `string`    |                | Màu nền caption box            |
| `maxWidth`        | `string`    | `"90%"`        | Chiều rộng tối đa              |
| `lineHeight`      | `number`    | 1.3            | Hệ số line height              |
| `textAlign`       | `string`    | `"left"`       | `"left"` `"center"` `"right"`  |
| `borderRadius`    | `number`    |                | Bo góc cho background box      |

#### Word-level Highlight (Karaoke-style)

Bật `wordHighlight: true` để highlight từng từ theo timeline, giống hiệu ứng karaoke:

```json
{
  "type": "caption",
  "srtContent": "1\n00:00:00,000 --> 00:00:03,000\nXin chào thế giới",
  "wordHighlight": true,
  "highlightStyle": "color",
  "highlightColor": "#FFD700",
  "color": "#FFFFFF",
  "fontSize": 52,
  "position": "bottom-center",
  "zIndex": 10
}
```

Timing từng từ được **tự động phân bổ proportional** theo character count:

```
SRT Entry: "Xin chào thế giới" (0ms → 3000ms, tổng 16 chars)
  Word 1: "Xin"    → 0ms ~ 562ms      (3/16)
  Word 2: "chào"   → 562ms ~ 1312ms   (4/16)
  Word 3: "thế"    → 1312ms ~ 1875ms  (3/16)  ← active tại t=1.5s
  Word 4: "giới"   → 1875ms ~ 3000ms  (4/16)
```

| Field              | Type                                     | Default                 | Description                            |
| ------------------ | ---------------------------------------- | ----------------------- | -------------------------------------- |
| `wordHighlight`    | `boolean`                                | `false`                 | Bật word-level highlight               |
| `highlightColor`   | `string`                                 | `"#FFD700"` (vàng)      | Màu highlight cho từ đang active       |
| `highlightBgColor` | `string`                                 | `"rgba(255,215,0,0.3)"` | Nền highlight (cho style `background`) |
| `highlightStyle`   | `"color"` \| `"background"` \| `"scale"` | `"color"`               | Kiểu hiệu ứng highlight                |
| `highlightScale`   | `number`                                 | `1.15`                  | Tỉ lệ phóng to (cho style `scale`)     |

**3 kiểu highlight:**

| Style        | Mô tả                                              |
| ------------ | -------------------------------------------------- |
| `color`      | Đổi màu chữ sang `highlightColor` (mặc định)       |
| `background` | Thêm nền `highlightBgColor` phía sau + đổi màu chữ |
| `scale`      | Phóng to từ active theo `highlightScale` + đổi màu |

---

### Audio Config

Audio được đặt trong `scene.audio`:

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

| Field      | Type      | Default      | Description              |
| ---------- | --------- | ------------ | ------------------------ |
| `url`      | `string`  | _(bắt buộc)_ | URL audio (http/https)   |
| `volume`   | `number`  | 1            | Volume multiplier        |
| `loop`     | `boolean` | false        | Lặp audio                |
| `start`    | `number`  | 0            | Start offset (giây)      |
| `duration` | `number`  |              | Trim duration (giây)     |
| `fadeIn`   | `number`  | 0            | Fade in duration (giây)  |
| `fadeOut`  | `number`  | 0            | Fade out duration (giây) |

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
              "text": "MUA NGAY — 199K",
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
              "srtContent": "1\n00:00:00,500 --> 00:00:03,500\nSản phẩm mới\n\n2\n00:00:04,000 --> 00:00:07,000\nThiết kế cao cấp",
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

## Testing

```bash
yarn test                # Unit tests
node test.js             # Integration test
node test-product.js     # Product review video (30s)
```

## Build

```bash
yarn build
```

## How It Works

1. **Validate** — Check input, normalize tracks
2. **Preload** — Download images, videos, audio từ URLs → local cache. Auto detect Google Fonts từ fontFamily
3. **Render** — Duyệt từng frame, sort video tracks theo zIndex, vẽ bgColor + elements, apply opacity/animation/transition
4. **Encode** — Pipe raw BGRA frames → FFmpeg → MP4 (libx264)
5. **Mix Audio** — FFmpeg mix audio tracks (volume, fade, loop)
6. **Output** — Return `Buffer` MP4

## License

MIT
