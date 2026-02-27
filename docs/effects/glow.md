# Glow Effect

Neon-style glow rendered by drawing text multiple times with increasing blur. Available on **text elements** only.

## Properties

| Field   | Type     | Default | Description                   |
| ------- | -------- | ------- | ----------------------------- |
| `color` | `string` |         | Glow color (e.g. `"#00FF88"`) |
| `blur`  | `number` | `10`    | Glow blur radius (px)         |

## Examples

**Cyan glow:**

```json
{ "glow": { "color": "#4ECDC4", "blur": 25 } }
```

**Green neon:**

```json
{ "glow": { "color": "#00FF88", "blur": 20 } }
```

**Red warning glow:**

```json
{ "glow": { "color": "#FF0000", "blur": 30 } }
```

## Full Example

```json
{
  "type": "text",
  "text": "NEON",
  "fontFamily": "Orbitron",
  "fontSize": 96,
  "color": "#4ECDC4",
  "glow": { "color": "#4ECDC4", "blur": 30 },
  "position": "center",
  "zIndex": 1
}
```
