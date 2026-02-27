# Vignette

Darkened edges effect applied to entire scene, rendered after all elements.

## Properties

| Field       | Type     | Default     | Description                          |
| ----------- | -------- | ----------- | ------------------------------------ |
| `intensity` | `number` | `0.5`       | Edge darkness (0=none, 1=fully dark) |
| `size`      | `number` | `0.5`       | Bright center area (0=small, 1=full) |
| `color`     | `string` | `"#000000"` | Vignette color                       |

## Example

```json
{
  "vignette": {
    "intensity": 0.6,
    "size": 0.4,
    "color": "#000000"
  }
}
```

## Presets

**Subtle vignette:**

```json
{ "vignette": { "intensity": 0.3, "size": 0.6 } }
```

**Strong cinematic:**

```json
{ "vignette": { "intensity": 0.8, "size": 0.3 } }
```

**Warm tint:**

```json
{ "vignette": { "intensity": 0.5, "size": 0.4, "color": "#1a0500" } }
```
