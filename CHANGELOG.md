# Changelog

## [1.1.2] - 2026-03-03

- Fix lỗi `Cannot find module 'zod/v4'` khi dùng Zod v3
- Tương thích cả Zod v3 (≥ 3.20) và Zod v4
- Chuyển `zod` sang `peerDependencies` — user tự quản lý version

## [1.1.0] - 2026-02-27

- Thêm element **Timer** (`type: 'timer'`): đếm tiến/lùi thời gian
  - Format: `hh:mm:ss:SSS`, `hh:mm:ss`, `mm:ss`, `ss`, ...
  - Hỗ trợ `countDown`, `separatorColor`, `glow`, `gradient`

## [1.0.5] - 2026-02-26

- Thêm **Chroma key** cho video (`chromaKey: { color, tolerance, softness }`)
- Thêm **Mask** cho mọi element (shape mask, text mask, `invert`)

## [1.0.4] - 2026-02-24

- Thêm element: **SVG**, **Waveform**, **Caption** (subtitle SRT)
- Shape: thêm `circle`, `ellipse`, `line`
- Hỗ trợ ảnh **GIF** động
- Audio: nhận mảng `AudioConfig[]` (multi audio per scene)
- Video: `reverse`, `freezeAt`, `speedCurve`, `crop`
- Text: `richText`, `counter`, `bgShape` (pill, banner, speech-bubble)
- Keyframe animation

## [1.0.3] - 2026-02-23

- Hỗ trợ **multi-track** (`tracks[]`), vẫn tương thích `scenes[]` cũ
- Thêm `validateConfig()` và `assertValidConfig()`
- Builder API: `VideoBuilder`, `TrackBuilder`, `SceneBuilder`
- Text: `glow`, `gradient`
- Chuyển canvas từ `node-canvas` sang `@napi-rs/canvas` (Skia, nhanh hơn, không cần system deps)

## [1.0.0] - 2026-02-23

- Release đầu tiên
- Element: `text`, `image`, `video`
- Animation, transition, easing cơ bản
- Scene: `bgColor`, `bgGradient`, `audio`, `vignette`, `colorOverlay`
- Encode H.264 với GPU acceleration (Apple Silicon, NVIDIA)
