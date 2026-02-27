# Drop Shadow

Available on **all element types** via the `shadow` property.

## Example

```json
{
  "shadow": {
    "color": "rgba(0,0,0,0.6)",
    "blur": 20,
    "offsetX": 0,
    "offsetY": 10
  }
}
```

## Properties

| Field     | Type     | Description                             |
| --------- | -------- | --------------------------------------- |
| `color`   | `string` | Shadow color (e.g. `"rgba(0,0,0,0.5)"`) |
| `blur`    | `number` | Blur radius (px)                        |
| `offsetX` | `number` | Horizontal offset (px)                  |
| `offsetY` | `number` | Vertical offset (px)                    |

## More Examples

**Subtle card shadow:**

```json
{
  "shadow": {
    "color": "rgba(0,0,0,0.3)",
    "blur": 10,
    "offsetX": 0,
    "offsetY": 4
  }
}
```

**Strong drop shadow:**

```json
{
  "shadow": {
    "color": "rgba(0,0,0,0.8)",
    "blur": 30,
    "offsetX": 5,
    "offsetY": 15
  }
}
```

**Colored glow shadow:**

```json
{
  "shadow": {
    "color": "rgba(78,205,196,0.6)",
    "blur": 25,
    "offsetX": 0,
    "offsetY": 0
  }
}
```
