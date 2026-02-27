# Timer Element

Hiển thị bộ đếm thời gian chạy (running clock) trên video. Timer luôn đếm từ 0, tính từ khi element xuất hiện.

## Cách hoạt động

- Timer **luôn đếm từ 0** khi element xuất hiện
- Dùng `start` và `duration` (từ ElementBase) để config khi nào timer xuất hiện/biến mất
- Hỗ trợ đếm **xuôi** (mặc định) và **ngược** (countdown)

## Properties

| Property         | Type             | Default        | Description                                                               |
| ---------------- | ---------------- | -------------- | ------------------------------------------------------------------------- |
| `type`           | `'timer'`        | **(bắt buộc)** | Loại element                                                              |
| `format`         | `TimerFormat`    | `hh:mm:ss:SSS` | Format hiển thị                                                           |
| `fontFamily`     | `string`         | `monospace`    | Font family (hỗ trợ Google Fonts auto-download)                           |
| `fontSize`       | `number`         | `48`           | Font size (px)                                                            |
| `fontWeight`     | `string/number`  | `700`          | Font weight (bold mặc định cho timer)                                     |
| `color`          | `string`         | `#FFFFFF`      | Màu text                                                                  |
| `bgColor`        | `string`         | —              | Màu nền (transparent nếu không set)                                       |
| `textAlign`      | `string`         | `center`       | Text align: `left`, `center`, `right`                                     |
| `strokeColor`    | `string`         | `#000000`      | Màu stroke (outline)                                                      |
| `strokeWidth`    | `number`         | `0`            | Độ dày stroke (px)                                                        |
| `padding`        | `number`         | `10`           | Padding (px)                                                              |
| `glow`           | `GlowConfig`     | —              | Hiệu ứng glow (neon)                                                      |
| `gradient`       | `GradientConfig` | —              | Gradient fill cho text                                                    |
| `separatorColor` | `string`         | = `color`      | Màu riêng cho dấu `:` (separator)                                         |
| `countDown`      | `boolean`        | `false`        | Đếm ngược (từ `maxDuration` xuống 0)                                      |
| `maxDuration`    | `number`         | —              | Thời lượng tối đa cho countdown (giây). Mặc định = element/scene duration |

**Kế thừa từ ElementBase:** `position`, `zIndex`, `start`, `duration`, `offsetX`, `offsetY`, `opacity`, `scale`, `rotation`, `animation`, `keyframes`, `shadow`, `filters`, `blendMode`, `mask`, `borderRadius`

## TimerFormat

| Format         | Ví dụ          | Mô tả                       |
| -------------- | -------------- | --------------------------- |
| `hh:mm:ss:SSS` | `00:01:23:456` | Giờ:Phút:Giây:Mili (đầy đủ) |
| `hh:mm:ss`     | `00:01:23`     | Giờ:Phút:Giây               |
| `mm:ss:SSS`    | `01:23:456`    | Phút:Giây:Mili              |
| `mm:ss`        | `01:23`        | Phút:Giây                   |
| `ss:SSS`       | `83:456`       | Giây:Mili                   |
| `ss`           | `83`           | Chỉ giây                    |

## Ví dụ

### Timer cơ bản

```json
{
  "type": "timer",
  "format": "hh:mm:ss:SSS",
  "fontSize": 64,
  "color": "#00FF88",
  "position": "top-right",
  "offsetX": -30,
  "offsetY": 30
}
```

### Timer với glow + separator color

```json
{
  "type": "timer",
  "format": "mm:ss:SSS",
  "fontSize": 72,
  "fontWeight": "bold",
  "color": "#4ECDC4",
  "separatorColor": "#FFFFFF30",
  "position": "center",
  "glow": {
    "color": "#4ECDC4",
    "blur": 12
  }
}
```

### Timer với background

```json
{
  "type": "timer",
  "format": "mm:ss",
  "fontSize": 96,
  "color": "#FFD700",
  "separatorColor": "#FFD70050",
  "bgColor": "rgba(255,255,255,0.06)",
  "borderRadius": 16,
  "padding": 20,
  "position": "center"
}
```

### Countdown timer

```json
{
  "type": "timer",
  "format": "ss:SSS",
  "fontSize": 72,
  "color": "#FF4444",
  "countDown": true,
  "maxDuration": 10,
  "position": "center",
  "glow": {
    "color": "#FF4444",
    "blur": 15
  }
}
```

### Timer xuất hiện muộn (start: 3s)

```json
{
  "type": "timer",
  "format": "ss:SSS",
  "fontSize": 72,
  "color": "#FF6B6B",
  "position": "center",
  "start": 3
}
```

Timer bắt đầu hiện ở giây thứ 3 của scene, và đếm từ `00:000`.

### Timer với Google Fonts

```json
{
  "type": "timer",
  "format": "hh:mm:ss:SSS",
  "fontSize": 64,
  "fontFamily": "Orbitron",
  "color": "#00FF88",
  "position": "center"
}
```

### Builder API

```ts
const scene = new SceneBuilder(10).bgColor("#0a0a0a").addTimer({
  format: "mm:ss:SSS",
  fontSize: 72,
  color: "#4ECDC4",
  separatorColor: "#FFFFFF30",
  position: "top-right",
  offsetX: -30,
  offsetY: 30,
  glow: { color: "#4ECDC4", blur: 10 },
});
```
