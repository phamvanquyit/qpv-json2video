# Visual Filters

CSS-style filters applied to individual elements via `ctx.filter`. All filter properties are optional and can be combined.

## Example

```json
{
  "filters": {
    "blur": 3,
    "brightness": 1.2,
    "contrast": 1.1,
    "saturate": 0.8,
    "grayscale": 0.5,
    "sepia": 0,
    "hueRotate": 45,
    "invert": 0
  }
}
```

## Properties

| Field        | Type     | Default | Range | Description                |
| ------------ | -------- | ------- | ----- | -------------------------- |
| `blur`       | `number` | `0`     | 0+    | Gaussian blur radius (px)  |
| `brightness` | `number` | `1`     | 0–2   | Brightness (0=black, 2=2x) |
| `contrast`   | `number` | `1`     | 0–2   | Contrast level             |
| `saturate`   | `number` | `1`     | 0–2   | Color saturation (0=gray)  |
| `grayscale`  | `number` | `0`     | 0–1   | Grayscale amount           |
| `sepia`      | `number` | `0`     | 0–1   | Sepia tone amount          |
| `hueRotate`  | `number` | `0`     | 0–360 | Hue rotation (degrees)     |
| `invert`     | `number` | `0`     | 0–1   | Color inversion amount     |

> Filters can be combined — e.g. `{ "blur": 2, "brightness": 1.3, "sepia": 0.5 }` applies all three.

## Common Presets

**Cinematic warm:**

```json
{
  "filters": {
    "brightness": 1.1,
    "contrast": 1.2,
    "saturate": 0.9,
    "sepia": 0.15
  }
}
```

**Black & white:**

```json
{ "filters": { "grayscale": 1, "contrast": 1.3 } }
```

**Vintage:**

```json
{ "filters": { "sepia": 0.6, "contrast": 1.1, "brightness": 0.9 } }
```

**Frosted glass:**

```json
{ "filters": { "blur": 8, "brightness": 1.1 } }
```

**Night vision:**

```json
{
  "filters": {
    "hueRotate": 120,
    "brightness": 1.5,
    "contrast": 1.4,
    "saturate": 2
  }
}
```
