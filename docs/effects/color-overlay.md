# Color Overlay

Semi-transparent color layer over entire scene, rendered after all elements and vignette.

## Properties

| Field       | Type        | Default    | Description                |
| ----------- | ----------- | ---------- | -------------------------- |
| `color`     | `string`    | _required_ | Color with alpha           |
| `blendMode` | `BlendMode` | `"normal"` | Blend mode for the overlay |

## Example

```json
{
  "colorOverlay": {
    "color": "rgba(255,100,0,0.2)",
    "blendMode": "normal"
  }
}
```

## Presets

**Warm tint:**

```json
{ "colorOverlay": { "color": "rgba(255,165,0,0.15)" } }
```

**Cool blue:**

```json
{ "colorOverlay": { "color": "rgba(0,100,255,0.1)" } }
```

**Dramatic dark:**

```json
{ "colorOverlay": { "color": "rgba(0,0,0,0.3)", "blendMode": "multiply" } }
```

**Duotone effect:**

```json
{ "colorOverlay": { "color": "rgba(168,85,247,0.25)", "blendMode": "screen" } }
```
