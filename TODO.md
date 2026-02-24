# TODO — qpv-json2video Roadmap

So sánh với CapCut, các tính năng còn thiếu được chia thành từng task cụ thể.

---

## Phase 1 — Nền tảng Animation & Transform ✅ DONE

### 1.1 Element Transform Properties

Thêm các property vào `ElementBase` để hỗ trợ transform cơ bản.

- [x] **Scale property** — Thêm `scale?: number` vào `ElementBase`. Giá trị mặc định `1`. Render bằng cách nhân width/height với scale trước khi vẽ lên canvas. Ví dụ: `scale: 1.5` = phóng to 150%.
- [x] **Rotation property** — Thêm `rotation?: number` vào `ElementBase`. Đơn vị: degrees. Render bằng `ctx.rotate()` quanh tâm element. Ví dụ: `rotation: 45` = xoay 45°.

### 1.2 Animation Types

Hiện chỉ có `fadeIn`, `fadeOut`, `fadeInOut`. Cần thêm từng loại animation sau:

- [x] **slideInLeft** — Element trượt vào từ bên trái canvas. Di chuyển từ `x = -elementWidth` đến vị trí cuối trong `fadeInDuration`.
- [x] **slideInRight** — Element trượt vào từ bên phải canvas. Di chuyển từ `x = canvasWidth` đến vị trí cuối.
- [x] **slideInTop** — Element trượt vào từ trên canvas. Di chuyển từ `y = -elementHeight` đến vị trí cuối.
- [x] **slideInBottom** — Element trượt vào từ dưới canvas. Di chuyển từ `y = canvasHeight` đến vị trí cuối.
- [x] **slideOutLeft** — Element trượt ra bên trái canvas khi kết thúc.
- [x] **slideOutRight** — Element trượt ra bên phải canvas khi kết thúc.
- [x] **slideOutTop** — Element trượt lên trên ra khỏi canvas khi kết thúc.
- [x] **slideOutBottom** — Element trượt xuống dưới ra khỏi canvas khi kết thúc.
- [x] **zoomIn** — Element phóng to từ `scale: 0` đến `scale: 1` trong `fadeInDuration`. Kết hợp với fade opacity.
- [x] **zoomOut** — Element thu nhỏ từ `scale: 1` về `scale: 0` trong `fadeOutDuration`. Kết hợp với fade opacity.
- [x] **bounce** — Element rơi vào từ trên và nẩy 2-3 lần trước khi dừng. Sử dụng easing function kiểu bounce (cubic bezier).
- [x] **pop** — Element scale từ `0 → 1.2 → 1` (overshoot rồi về lại) trong `fadeInDuration`. Tạo cảm giác "bật" ra.
- [x] **shake** — Element rung nhẹ (translate x ±5px vài lần) trong `fadeInDuration`. Dùng cho emphasis/alert.
- [x] **typewriter** — Chỉ áp dụng cho `TextElement`. Hiện chữ từng ký tự một, mỗi ký tự xuất hiện sau ~50ms. Text được crop dần dần.

### 1.3 Transition Types

Hiện chỉ có `fade`. Cần thêm từng loại transition giữa các scene:

- [x] **slideLeft** — Scene mới trượt vào từ phải, scene cũ trượt ra trái. Trong `duration` giây, cả 2 scene di chuyển đồng thời.
- [x] **slideRight** — Scene mới trượt vào từ trái, scene cũ trượt ra phải.
- [x] **slideUp** — Scene mới trượt vào từ dưới, scene cũ trượt lên trên.
- [x] **slideDown** — Scene mới trượt vào từ trên, scene cũ trượt xuống dưới.
- [x] **wipeLeft** — Scene mới dần xuất hiện từ phải sang trái (clip mask di chuyển). Scene cũ bị "lau" đi.
- [x] **wipeRight** — Scene mới dần xuất hiện từ trái sang phải.
- [x] **wipeUp** — Scene mới dần xuất hiện từ dưới lên trên.
- [x] **wipeDown** — Scene mới dần xuất hiện từ trên xuống dưới.
- [x] **zoomIn transition** — Scene cũ zoom to lên rồi biến mất, scene mới xuất hiện. Scale từ `1 → 2` + fade out, scene mới fade in.
- [x] **zoomOut transition** — Scene cũ zoom nhỏ lại rồi biến mất, scene mới xuất hiện. Scale từ `1 → 0.5` + fade out.

---

## Phase 2 — Visual Effects

### 2.2 Shadow & Glow ✅ DONE

- [x] **Drop shadow cho element** — Thêm `shadow?: { color: string, blur: number, offsetX: number, offsetY: number }` vào `ElementBase`. Render bằng `ctx.shadowColor/shadowBlur`. Hoạt động với tất cả element types.
- [x] **Text glow effect** — Thêm `glow?: { color: string, blur: number }` vào `TextElement`. Render bằng cách vẽ text nhiều lần với `shadowBlur` tăng dần. Tạo hiệu ứng neon.

### 2.3 Gradient ✅ DONE

- [x] **Gradient fill cho Shape** — Thêm `gradient?: { type: 'linear' | 'radial', colors: string[], angle?: number }` vào `ShapeElement`. Thay thế `bgColor` bằng gradient fill khi được set.
- [x] **Gradient fill cho Text** — Thêm `gradient` tương tự vào `TextElement`. Fill chữ bằng gradient thay vì solid color. Render bằng `createLinearGradient` rồi dùng làm `fillStyle`.
- [x] **Gradient background cho Scene** — Thêm `bgGradient?: { colors: string[], angle?: number }` vào `Scene`. Fill background bằng gradient thay vì solid `bgColor`.

### 2.4 Video Speed Control ✅ DONE

- [x] **Video speed property** — Thêm `speed?: number` vào `VideoElement` (default 1). `0.5` = slow-mo, `2` = fast forward. Cần điều chỉnh frame extraction rate trong FFmpeg: thay đổi PTS (presentation timestamp). Cũng ảnh hưởng đến audio pitch nếu video có âm thanh.

---

## Phase 3 — Advanced Features

### 3.1 More Element Types

- [ ] **Circle shape** — Thêm `shape: 'rectangle' | 'circle' | 'ellipse'` vào `ShapeElement`. Hiện chỉ vẽ rectangle. Circle = `arc()`, Ellipse = `ellipse()`.
- [ ] **Line shape** — Thêm subtype `line` cho shape. Properties: `x1, y1, x2, y2, color, width`. Vẽ đường thẳng giữa 2 điểm.
- [ ] **GIF / Animated sticker** — Hỗ trợ URL `.gif` trong `ImageElement`. Cần parse GIF thành từng frame, render frame đúng theo timing. Dùng thư viện như `gif-frames` hoặc parse manual.

### 3.6 Text Enhancements

- [ ] **Multi-color text** — Hỗ trợ rich text đơn giản: `"Hello <color=#FF0000>World</color>"`. Parse HTML-like tags rồi vẽ từng segment với màu riêng.

---

## Phase 4 — Quality of Life

### 4.1 Developer Experience

- [ ] **Preview mode (fast render)** — Render ở resolution thấp (360p) và fps thấp (10fps) để preview nhanh. Thêm option `preview?: boolean` vào `RenderOptions`.
- [ ] **Validation with helpful errors** — Validate JSON config trước khi render. Báo lỗi rõ ràng: "Track 0 duration is 10s but Track 1 is 8s", "Image URL returns 404", etc.
- [ ] **Local file support** — Hỗ trợ `url: "file:///path/to/file.mp4"` hoặc `url: "./local.jpg"` thay vì chỉ http/https. Detect scheme rồi copy/symlink thay vì download.

### 4.2 Audio Enhancements

- [ ] **Audio trim end** — Thêm `trimEnd?: number` vào `AudioConfig`. Cắt audio tại thời điểm cụ thể (giây). Hiện chỉ có `start` + `duration`.
- [ ] **Multiple audio per scene** — Cho phép `audio?: AudioConfig | AudioConfig[]` trong Scene. Mix nhiều audio track trong 1 scene (ví dụ: nhạc nền + sound effect).
- [ ] **Audio volume keyframes** — Thêm `volumeKeyframes?: Array<{ time: number, volume: number }>` vào `AudioConfig`. Cho phép volume thay đổi theo thời gian (duck khi có narration, tăng khi hết).

---

> **Ghi chú**: Task được sắp xếp theo thứ tự ưu tiên trong mỗi phase. Phase 1 nên làm trước vì tạo ra giá trị lớn nhất với effort thấp nhất.
