# TODO — qpv-json2video Roadmap

> So sánh với CapCut / Remotion / professional video editors.
> Mục tiêu: trở thành **core rendering engine** đầy đủ tính năng.

---

## ✅ Đã có (Current)

- Multi-track timeline (zIndex, start offset)
- 5 element types: Text, Image, Video, Caption, Shape (rect/circle/ellipse/line)
- 17 animations (fade, slide, zoom, bounce, pop, shake, typewriter)
- 11 scene transitions (fade, slide, wipe, zoom)
- Drop shadow, Glow, Gradient fill
- Video speed control, Element scale/rotation
- SRT captions: word highlight (karaoke) + word-by-word display
- Audio mixing (multi-track, volume, fade, loop, trim)
- Google Fonts auto-download
- GPU encoding (VideoToolbox / NVENC / VAAPI / QSV)
- Local file support (file://, ./, absolute path)

---

## Phase 4 — Keyframe Animation & Easing 🎯 (HIGH PRIORITY)

> CapCut cho phép keyframe BẤT KỲ property nào tại thời điểm cụ thể.
> Hiện tại thư viện chỉ có preset animations (fadeIn, slideIn, ...).
> Đây là tính năng **quan trọng nhất** còn thiếu để trở thành core engine.

- [ ] **Keyframe system** — animate bất kỳ property nào theo thời gian
  ```json
  {
    "type": "text",
    "text": "Hello",
    "keyframes": [
      { "time": 0, "x": 0, "y": 0, "opacity": 0, "scale": 0.5 },
      { "time": 0.5, "opacity": 1, "scale": 1 },
      { "time": 2, "x": 500, "y": -200, "rotation": 360 },
      { "time": 3, "opacity": 0 }
    ]
  }
  ```
- [ ] **Easing functions** — linear, easeIn, easeOut, easeInOut, cubicBezier, spring, bounceOut, elasticOut
  ```json
  { "time": 1, "scale": 1.5, "easing": "easeOutBack" }
  ```
- [ ] **Motion path** — animate element theo đường bezier curve
  ```json
  {
    "motionPath": [
      { "x": 0, "y": 0 },
      { "cx": 200, "cy": -100, "x": 400, "y": 0 }
    ]
  }
  ```
- [ ] Giữ backward-compatible: `animation` preset vẫn hoạt động, `keyframes` override khi có

---

## Phase 5 — Visual Filters & Effects 🎨

> CapCut có hàng trăm filters/effects. Thư viện cần ít nhất các filters cơ bản.

### 5.1 — CSS-style Filters (trên mỗi element)

- [ ] `blur` — Gaussian blur (px)
- [ ] `brightness` — Độ sáng (0–2, mặc định 1)
- [ ] `contrast` — Độ tương phản (0–2)
- [ ] `saturate` — Độ bão hòa (0–2)
- [ ] `grayscale` — Xám hóa (0–1)
- [ ] `sepia` — Hiệu ứng sepia (0–1)
- [ ] `hueRotate` — Xoay màu (0–360°)
- [ ] `invert` — Đảo ngược màu (0–1)

```json
{
  "type": "image",
  "url": "...",
  "filters": {
    "blur": 3,
    "brightness": 1.2,
    "contrast": 1.1,
    "saturate": 0.8,
    "grayscale": 0
  }
}
```

> **Note:** `@napi-rs/canvas` (Skia) hỗ trợ `ctx.filter` giống CSS.
> Nếu Skia không đủ, có thể dùng pixel manipulation hoặc FFmpeg filters.

### 5.2 — Blend Modes

- [ ] Blend mode trên mỗi element: normal, multiply, screen, overlay, darken, lighten, color-dodge, color-burn, hard-light, soft-light, difference, exclusion
  ```json
  { "blendMode": "screen" }
  ```
  > Dùng `ctx.globalCompositeOperation` — Canvas 2D đã hỗ trợ sẵn.

### 5.3 — Vignette & Color Overlay

- [ ] **Vignette** — darkened edges
- [ ] **Color overlay** — phủ màu semi-transparent lên scene
- [ ] **Duotone** — map shadows/highlights sang 2 màu

---

## Phase 6 — Advanced Text 🔤

> CapCut có text animation rất phong phú, text on path, 3D text, etc.

- [ ] **Letter-by-letter animation** — mỗi chữ cái animate riêng (stagger delay)
  ```json
  { "animation": { "type": "fadeIn", "mode": "letter", "stagger": 0.05 } }
  ```
- [ ] **Text on path / Curved text** — text theo đường cong bezier
  ```json
  {
    "textPath": {
      "type": "arc",
      "radius": 300,
      "startAngle": -30,
      "endAngle": 30
    }
  }
  ```
- [ ] **Rich text / Multi-style** — từng phần text có style khác nhau
  ```json
  {
    "type": "text",
    "richText": [
      { "text": "SALE ", "color": "#FF0000", "fontSize": 72 },
      {
        "text": "50% OFF",
        "color": "#FFD700",
        "fontSize": 96,
        "fontWeight": "bold"
      }
    ]
  }
  ```
- [ ] **Text background shape** — bg hình pill, speech bubble, banner ribbon
- [ ] **Counter/Timer animation** — số đếm lên/xuống (countdown, price reveal)
  ```json
  {
    "type": "text",
    "counter": { "from": 0, "to": 1000, "duration": 2, "prefix": "$" }
  }
  ```

---

## Phase 7 — Advanced Video & Media 🎥

### 7.1 — Video Processing

- [ ] **Video crop** — crop vùng hiển thị từ source video
  ```json
  { "crop": { "x": 100, "y": 0, "width": 800, "height": 800 } }
  ```
- [ ] **Video reverse** — phát ngược
- [ ] **Freeze frame** — dừng tại frame cụ thể
  ```json
  { "freezeAt": 3.5, "freezeDuration": 2 }
  ```
- [ ] **Speed ramping** — tốc độ thay đổi trong clip (không chỉ constant speed)
  ```json
  {
    "speedCurve": [
      { "time": 0, "speed": 1 },
      { "time": 1, "speed": 0.3 },
      { "time": 3, "speed": 2 }
    ]
  }
  ```
- [ ] **Picture-in-Picture** layout helpers — preset PiP positions/sizes

### 7.2 — Image Enhancements

- [ ] **Ken Burns effect** — slow pan/zoom trên ảnh tĩnh (đã có zoomIn animation, nhưng cần smooth continuous pan+zoom)
- [ ] **Image sequence** — load folder ảnh thành animation
- [ ] **SVG rendering** — render SVG elements trực tiếp

---

## Phase 8 — Masks & Clipping ✂️

> CapCut có masking rất mạnh — đây là feature quan trọng cho compositing chuyên nghiệp.

- [ ] **Shape mask** — clip element theo shape (rect, circle, polygon, star)
  ```json
  { "mask": { "type": "circle", "radius": 200 } }
  ```
- [ ] **Image mask** — dùng ảnh grayscale làm mask (alpha channel)
  ```json
  { "mask": { "type": "image", "url": "mask.png" } }
  ```
- [ ] **Text mask** — text làm mask cho video/image (video play inside text)
  ```json
  { "mask": { "type": "text", "text": "HELLO", "fontSize": 200 } }
  ```
- [ ] **Animated mask** — mask thay đổi theo keyframes (reveal effects)

---

## Phase 9 — Particle Effects & Overlays ✨

> Tạo hiệu ứng visually impressive mà CapCut hay dùng.

- [ ] **Confetti** — rơi từ trên xuống
- [ ] **Snow / Rain** — particles rơi
- [ ] **Sparkle / Glitter** — lấp lánh ngẫu nhiên
- [ ] **Fire / Smoke** — particle simulation đơn giản
- [ ] **Light leaks / Lens flare** — overlay ánh sáng
- [ ] **Bokeh** — circles mờ nền

```json
{
  "type": "particle",
  "effect": "confetti",
  "density": 50,
  "speed": 1,
  "colors": ["#FF6B6B", "#4ECDC4", "#FFD93D"],
  "position": "full",
  "zIndex": 5
}
```

---

## Phase 10 — Audio Enhancements 🔊

- [ ] **Audio waveform visualization** — vẽ waveform/spectrum animated
  ```json
  { "type": "waveform", "audioUrl": "...", "style": "bars", "color": "#4ECDC4" }
  ```
- [ ] **Audio ducking** — tự động giảm nhạc nền khi có voice
- [ ] **Beat detection** — detect beats để sync animations
  ```json
  { "beatSync": true, "beatAction": "flash" }
  ```
- [ ] **Pitch shift** — thay đổi pitch
- [ ] **Reverb / Echo** — audio effects qua FFmpeg filters

---

## Phase 11 — Export & Performance ⚡

### 11.1 — Export Options

- [ ] **Multiple formats** — WebM, GIF (animated), MOV, image sequence (PNG/JPEG frames)
- [ ] **Resolution presets** — 720p, 1080p, 2K, 4K, custom
- [ ] **Quality presets** — low (fast), medium, high (slow)
- [ ] **Aspect ratio presets** — 9:16 (Reels), 16:9 (YouTube), 1:1 (Instagram), 4:5

### 11.2 — Performance

- [ ] **Preview mode** — render thấp resolution (1/2 hoặc 1/4) để xem nhanh trước khi render full
  ```json
  { "preview": true, "previewScale": 0.5 }
  ```
- [ ] **Incremental render** — chỉ render lại scenes đã thay đổi
- [ ] **Multi-core rendering** — chia frames cho nhiều worker threads
- [ ] **Streaming output** — render ra stream (WebSocket, HTTP chunk)
- [ ] **Render queue** — queue nhiều videos, render tuần tự/parallel

### 11.3 — Developer Experience

- [ ] **JSON schema validation** — validate config trước khi render (ajv/zod), error messages thân thiện
- [ ] **Config builder API** — fluent API thay cho raw JSON
  ```ts
  const config = new VideoBuilder(1080, 1920)
    .addTrack((track) =>
      track.addScene((scene) =>
        scene
          .duration(5)
          .bgColor("#1a1a2e")
          .addText("Hello", { fontSize: 72, animation: "fadeIn" }),
      ),
    )
    .build();
  ```
- [ ] **Template system** — predefined templates (product ad, story, promo, etc.)
- [ ] **Plugin system** — custom element types, custom painters, custom transitions

---

## Phase 12 — Advanced Compositing 🎬

- [ ] **Chroma key (Green screen)** — remove background color từ video
  ```json
  { "chromaKey": { "color": "#00FF00", "tolerance": 0.3 } }
  ```
- [ ] **Background removal (ML)** — AI-based background removal (dùng ONNX/TF.js)
- [ ] **3D transforms** — perspective, rotateX, rotateY (fake 3D flip/tilt)
  ```json
  { "transform3d": { "perspective": 800, "rotateY": 30 } }
  ```
- [ ] **Camera shake** — simulated camera movement
- [ ] **Split screen** — preset grid layouts (2x1, 2x2, 3x3)
  ```json
  { "layout": "split-2x2", "sources": ["url1", "url2", "url3", "url4"] }
  ```

---

## Priority Matrix

| Phase  | Feature                    | Impact | Effort    | Priority |
| ------ | -------------------------- | ------ | --------- | -------- |
| **4**  | Keyframe + Easing          | 🔥🔥🔥 | Medium    | 🟥 P0    |
| **5**  | Filters (blur, brightness) | 🔥🔥   | Low       | 🟧 P1    |
| **5**  | Blend modes                | 🔥     | Low       | 🟧 P1    |
| **6**  | Letter-by-letter animation | 🔥🔥   | Medium    | 🟧 P1    |
| **7**  | Video crop                 | 🔥🔥   | Low       | 🟧 P1    |
| **7**  | Speed ramping              | 🔥     | Medium    | 🟨 P2    |
| **8**  | Shape/Image mask           | 🔥🔥   | Medium    | 🟨 P2    |
| **9**  | Particle effects           | 🔥     | High      | 🟨 P2    |
| **6**  | Rich text (multi-style)    | 🔥🔥   | Medium    | 🟨 P2    |
| **6**  | Counter animation          | 🔥     | Low       | 🟨 P2    |
| **11** | Preview mode               | 🔥🔥   | Low       | 🟧 P1    |
| **11** | Multi-core rendering       | 🔥     | High      | 🟨 P2    |
| **11** | Config builder API         | 🔥🔥   | Medium    | 🟧 P1    |
| **11** | Multiple export formats    | 🔥     | Medium    | 🟨 P2    |
| **10** | Audio waveform             | 🔥     | Medium    | 🟩 P3    |
| **12** | Chroma key                 | 🔥     | High      | 🟩 P3    |
| **12** | 3D transforms              | 🔥     | High      | 🟩 P3    |
| **6**  | Text on path               | 🔥     | Medium    | 🟩 P3    |
| **8**  | Text mask                  | 🔥     | Medium    | 🟩 P3    |
| **12** | Background removal (ML)    | 🔥     | Very High | 🟩 P3    |

---

## Suggested Implementation Order

1. **Phase 4** — Keyframe + Easing _(nền tảng cho mọi animation phức tạp)_
2. **Phase 5.1 + 5.2** — Filters + Blend modes _(low effort, high visual impact)_
3. **Phase 11.3** — Config builder API + JSON validation _(DX improvement)_
4. **Phase 6** — Letter animation + Rich text _(text-heavy use cases)_
5. **Phase 7.1** — Video crop + Speed ramping _(video editing basics)_
6. **Phase 8** — Masking _(compositing chuyên nghiệp)_
7. **Phase 11.1 + 11.2** — Export options + Preview mode
8. **Phase 9** — Particle effects
9. **Phase 10** — Audio enhancements
10. **Phase 12** — Advanced compositing
