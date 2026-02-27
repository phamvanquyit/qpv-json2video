# SVG Element

Render SVG directly on the canvas. Supports inline SVG string or loading from URL.

## Example

**Inline SVG:**

```json
{
  "type": "svg",
  "svgContent": "<svg viewBox='0 0 100 100'><circle cx='50' cy='50' r='40' fill='red'/></svg>",
  "width": 200,
  "height": 200,
  "position": "center",
  "zIndex": 1
}
```

**SVG from URL:**

```json
{
  "type": "svg",
  "url": "https://example.com/icon.svg",
  "width": 300,
  "height": 300,
  "position": "center",
  "zIndex": 1,
  "fillColor": "#4ECDC4"
}
```

> **Note:** Either `svgContent` or `url` must be provided. When both are set, `svgContent` takes priority.

## Properties

| Field        | Type     | Default      | Description                                           |
| ------------ | -------- | ------------ | ----------------------------------------------------- |
| `svgContent` | `string` |              | Inline SVG markup string                              |
| `url`        | `string` |              | URL to SVG file (http/https)                          |
| `width`      | `number` | **required** | Display width (px)                                    |
| `height`     | `number` | **required** | Display height (px)                                   |
| `fit`        | `string` | `"contain"`  | `"cover"` `"contain"` `"fill"`                        |
| `fillColor`  | `string` |              | Override SVG fill color (useful for recoloring icons) |

## More Examples

**Icon with color override:**

```json
{
  "type": "svg",
  "url": "https://example.com/icon.svg",
  "width": 100,
  "height": 100,
  "fillColor": "#FFD700",
  "position": "top-left",
  "zIndex": 2,
  "offsetX": 40,
  "offsetY": 40,
  "animation": { "type": "fadeIn", "fadeInDuration": 0.5 }
}
```

**Inline decorative SVG:**

```json
{
  "type": "svg",
  "svgContent": "<svg viewBox='0 0 200 200'><polygon points='100,10 40,198 190,78 10,78 160,198' fill='#FFD700' opacity='0.5'/></svg>",
  "width": 300,
  "height": 300,
  "position": "center",
  "zIndex": 0,
  "opacity": 0.3
}
```
