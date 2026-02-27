# Getting Started

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

## Validation

### `validateConfig(config): ValidationResult`

Validate config before rendering. Returns detailed error list.

```ts
import { validateConfig } from "qpv-json2video";

const result = validateConfig(myConfig);
if (!result.success) {
  result.errors.forEach((e) => console.error(`${e.path}: ${e.message}`));
}
```

### `assertValidConfig(config): void`

Validate and **throw** if invalid. Error message includes all validation errors.

```ts
import { assertValidConfig } from "qpv-json2video";

assertValidConfig(myConfig); // throws if invalid
```

### ValidationResult

| Field     | Type                | Description          |
| --------- | ------------------- | -------------------- |
| `success` | `boolean`           | Whether config valid |
| `errors`  | `ValidationError[]` | List of errors       |

### ValidationError

| Field     | Type     | Description                                                      |
| --------- | -------- | ---------------------------------------------------------------- |
| `path`    | `string` | Path to invalid field (e.g. `"tracks[0].scenes[1].elements[2]"`) |
| `message` | `string` | Error description                                                |

---

## Builder API

Fluent builder API for constructing video configs programmatically.

```ts
import { VideoBuilder } from "qpv-json2video";

const config = new VideoBuilder(1080, 1920)
  .addTrack((track) =>
    track.addScene((scene) =>
      scene
        .duration(5)
        .bgColor("#1a1a2e")
        .addText("Hello!", { fontSize: 72, position: "center" }),
    ),
  )
  .build();
```

### Available Builders

| Builder        | Description                  |
| -------------- | ---------------------------- |
| `VideoBuilder` | Root builder (width, height) |
| `TrackBuilder` | Add scenes to a track        |
| `SceneBuilder` | Add elements, audio, effects |

---

## Platform Utilities

### `detectPlatform(): PlatformType`

Detect current platform (`"macos"`, `"linux"`, `"windows"`).

### `getOptimalEncoder(): EncoderConfig`

Auto-detect best available video encoder:

| Platform | GPU Encoder                 | Fallback  |
| -------- | --------------------------- | --------- |
| macOS    | `h264_videotoolbox`         | `libx264` |
| Linux    | `h264_nvenc` / `h264_vaapi` | `libx264` |
| Windows  | `h264_nvenc` / `h264_qsv`   | `libx264` |

```ts
import { detectPlatform, getOptimalEncoder } from "qpv-json2video";

console.log(detectPlatform()); // "macos"
const encoder = getOptimalEncoder();
console.log(encoder.description); // "Apple VideoToolbox (GPU)"
console.log(encoder.isHardwareAccelerated); // true
```

---

## Asset URL Support

All elements that accept a `url` field (image, video, audio) support these formats:

| Format        | Example                              |
| ------------- | ------------------------------------ |
| HTTPS         | `https://example.com/video.mp4`      |
| HTTP          | `http://example.com/image.jpg`       |
| File protocol | `file:///Users/me/assets/bg.mp4`     |
| Relative path | `./assets/logo.png`                  |
| Absolute path | `/Users/me/project/assets/music.mp3` |
