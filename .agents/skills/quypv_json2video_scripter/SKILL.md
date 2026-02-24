---
name: qpv-json2video Video Scripter
description: Generate professional video scripts in JSON format for the qpv-json2video library. Supports multi-track timeline, text/image/video/caption elements, animations, transitions, audio mixing, word-level karaoke highlighting, drop shadows, glow effects, gradients, and video speed control.
---

# qpv-json2video Video Scripter

## Overview

This skill enables you to write video scripts as JSON configurations for the `qpv-json2video` library. The library renders videos using `@napi-rs/canvas` (Skia) and `FFmpeg` from a declarative JSON structure.

## When to Use This Skill

- User asks you to **create a video**, **video script**, or **video JSON**
- User wants to **generate a video ad**, **social media reel**, **product demo**, **explainer video**, etc.
- User provides a script/narration and wants it turned into a video configuration
- User wants to **edit or modify** an existing JSON video config

## Core Concepts

### 1. Multi-Track Timeline

The video is composed of **tracks** that play on a timeline. Each track has:

- `type`: `"video"` (renders visuals) or `"audio"` (sound only)
- `zIndex`: Higher values render on top of lower values
- `start`: When the track starts on the global timeline (seconds)
- `scenes`: Array of scenes that play **sequentially** within the track

**Think of tracks as layers in a video editor:**

```
Track 3 (z:3) — Captions (on top of everything)
Track 2 (z:2) — Text overlays, titles
Track 1 (z:1) — Logo watermark, product images
Track 0 (z:0) — Background video/images (bottom layer)
Audio track   — Background music
```

### 2. Scenes

Each track contains scenes that play one after another. Scenes have:

- `duration`: How long in seconds
- `bgColor`: Background color (only visible if no full-screen element covers it)
- `bgGradient`: Gradient background (replaces bgColor when set)
- `elements`: Visual elements to display
- `audio`: Scene-level audio
- `transition`: Transition from previous scene (fade, slide, wipe, zoom)

### 3. Elements

5 element types available:

- **text** — Styled text with Google Fonts, stroke, background
- **image** — Remote images with fit modes and border radius
- **video** — Video clips with trim, loop, opacity
- **caption** — SRT subtitles with optional word-level karaoke highlighting
- **shape** — Rectangles with fill, stroke (borders/frames), border radius

### 4. Element Timing Within Scene

Each element has `start` and `duration` relative to its scene:

- `start: 0` → appears when scene begins
- `start: 2` → appears 2 seconds into the scene
- `duration: 3` → visible for 3 seconds
- If `duration` omitted → stays visible for rest of scene

## Step-by-Step Workflow

When the user asks you to create a video script, follow these steps:

### Step 1: Gather Requirements

Ask or determine:

- **Video purpose**: ad, explainer, social media reel, presentation?
- **Aspect ratio**: 9:16 (vertical/mobile), 16:9 (horizontal), 1:1 (square)?
- **Duration**: Total video length?
- **Content**: What text, images, videos, narration?
- **Style**: Colors, fonts, mood?
- **Audio**: Background music? Narration?

### Step 2: Plan the Structure

Design the track layout:

```
Track 0 (z:0) — Background layer (video/solid colors)
Track 1 (z:1) — Product/content layer (images, video clips)
Track 2 (z:2) — Text overlay layer (titles, CTAs, prices)
Track 3 (z:3) — Caption/subtitle layer
Audio track   — Background music
```

### Step 3: Write the JSON

Follow this template structure:

```json
{
  "width": 1080,
  "height": 1920,
  "fps": 30,
  "tracks": [
    // Track 0: Background
    // Track 1: Content
    // Track 2: Text overlays
    // Track 3: Captions
    // Audio track
  ]
}
```

### Step 4: Review & Validate

Check:

- [ ] All durations are consistent across tracks
- [ ] zIndex layers are ordered correctly
- [ ] SRT timestamps align with scene durations
- [ ] URLs are valid (or marked as placeholders)
- [ ] Required fields are present for each element type
- [ ] Animations enhance rather than distract
- [ ] Total track durations match (especially background vs overlay tracks)

## JSON Schema Quick Reference

### VideoConfig (Root)

```json
{
  "width": 1080, // Required: video width in pixels
  "height": 1920, // Required: video height in pixels
  "fps": 30, // Optional: frames per second (default: 30)
  "tracks": [] // Required: array of Track objects
}
```

### Common Resolutions

| Aspect Ratio | Resolution  | Use Case               |
| ------------ | ----------- | ---------------------- |
| 9:16         | 1080 × 1920 | TikTok, Reels, Shorts  |
| 16:9         | 1920 × 1080 | YouTube, presentations |
| 1:1          | 1080 × 1080 | Instagram posts        |
| 4:5          | 1080 × 1350 | Instagram feed         |

### Track

```json
{
  "type": "video", // Required: "video" or "audio"
  "zIndex": 0, // Optional: layer order (default: 0)
  "start": 0, // Optional: start time on timeline in seconds (default: 0)
  "scenes": [] // Required: array of Scene objects
}
```

### Scene

```json
{
  "duration": 5, // Required: seconds
  "bgColor": "#000000", // Optional: default "#000000"
  "bgGradient": {
    // Optional: gradient background (replaces bgColor)
    "colors": ["#1a1a2e", "#16213e", "#0f3460"], // At least 2 colors
    "angle": 135 // Degrees: 0=left→right, 90=top→bottom, default: 0
  },
  "elements": [], // Optional: visual elements
  "audio": {}, // Optional: AudioConfig
  "transition": { "type": "fade", "duration": 0.8 } // Optional: transition from previous scene
}
```

**TransitionType values:**

| Type           | Description                                         |
| -------------- | --------------------------------------------------- |
| `"fade"`       | Standard crossfade (default)                        |
| `"slideLeft"`  | New scene slides in from right, old slides out left |
| `"slideRight"` | New scene slides in from left                       |
| `"slideUp"`    | New scene slides in from bottom                     |
| `"slideDown"`  | New scene slides in from top                        |
| `"wipeLeft"`   | New scene reveals from right to left                |
| `"wipeRight"`  | New scene reveals from left to right                |
| `"wipeUp"`     | New scene reveals from bottom to top                |
| `"wipeDown"`   | New scene reveals from top to bottom                |
| `"zoomIn"`     | New scene zooms in from small to full               |
| `"zoomOut"`    | New scene zooms out from large to full              |

### Base Element Properties (shared by all elements)

```json
{
  "position": "center", // Required: see PositionType
  "zIndex": 1, // Required: draw order within scene
  "offsetX": 0, // Optional: horizontal offset (px)
  "offsetY": 0, // Optional: vertical offset (px)
  "opacity": 1, // Optional: 0–1
  "scale": 1, // Optional: scale factor (1.5 = 150%)
  "rotation": 0, // Optional: rotation in degrees (45 = 45° clockwise)
  "borderRadius": 0, // Optional: corner radius (px)
  "start": 0, // Optional: start time within scene (s)
  "duration": null, // Optional: display duration (s), null = full scene
  "animation": {
    // Optional
    "type": "fadeIn", // See AnimationType table below
    "fadeInDuration": 0.5, // Duration for "in" animations (s)
    "fadeOutDuration": 0.5 // Duration for "out" animations (s)
  },
  "shadow": {
    // Optional: drop shadow for any element
    "color": "rgba(0,0,0,0.5)", // Shadow color
    "blur": 15, // Shadow blur radius (px)
    "offsetX": 5, // Horizontal offset (px)
    "offsetY": 5 // Vertical offset (px)
  }
}
```

**AnimationType values:**

| Type               | Category  | Description                        |
| ------------------ | --------- | ---------------------------------- |
| `"fadeIn"`         | Fade      | Fade in from transparent           |
| `"fadeOut"`        | Fade      | Fade out to transparent            |
| `"fadeInOut"`      | Fade      | Fade in at start, fade out at end  |
| `"slideInLeft"`    | Slide     | Slide in from left edge            |
| `"slideInRight"`   | Slide     | Slide in from right edge           |
| `"slideInTop"`     | Slide     | Slide in from top edge             |
| `"slideInBottom"`  | Slide     | Slide in from bottom edge          |
| `"slideOutLeft"`   | Slide     | Slide out to left edge             |
| `"slideOutRight"`  | Slide     | Slide out to right edge            |
| `"slideOutTop"`    | Slide     | Slide out to top edge              |
| `"slideOutBottom"` | Slide     | Slide out to bottom edge           |
| `"zoomIn"`         | Zoom      | Scale from 0 to 1 with fade        |
| `"zoomOut"`        | Zoom      | Scale from 1 to 0 with fade        |
| `"bounce"`         | Motion    | Drop from above with bounce easing |
| `"pop"`            | Motion    | Scale 0→1.2→1 (overshoot pop-in)   |
| `"shake"`          | Motion    | Horizontal shake with decay        |
| `"typewriter"`     | Text-only | Reveal text character by character |

**PositionType values:**
`"top-left"`, `"top-center"`, `"top-right"`, `"left"`, `"center"`, `"right"`, `"bottom-left"`, `"bottom-center"`, `"bottom-right"`

### Text Element

```json
{
  "type": "text",
  "text": "Hello World", // Required
  "fontFamily": "Orbitron", // Optional: auto Google Fonts (default: "sans-serif")
  "fontSize": 48, // Optional: default 48
  "fontWeight": "bold", // Optional: "bold", 700, "normal" (default: 400)
  "color": "#FFFFFF", // Optional: default "#FFFFFF"
  "bgColor": "rgba(0,0,0,0.5)", // Optional: text box background
  "maxWidth": "80%", // Optional: number or "80%" (default: 90% canvas)
  "textAlign": "center", // Optional: "left", "center", "right" (default: "left")
  "strokeColor": "#000000", // Optional: text outline color
  "strokeWidth": 3, // Optional: outline thickness (default: 0)
  "lineHeight": 1.3, // Optional: default 1.3
  "padding": 10, // Optional: padding inside bgColor box (default: 10)
  "glow": {
    // Optional: neon glow effect
    "color": "#00FF88", // Glow color
    "blur": 15 // Glow radius (px)
  },
  "gradient": {
    // Optional: gradient fill (replaces solid color)
    "type": "linear", // "linear" or "radial"
    "colors": ["#FF6B6B", "#4ECDC4"], // At least 2 colors
    "angle": 0 // Degrees (linear only)
  },
  "position": "center",
  "zIndex": 1
}
```

### Image Element

```json
{
  "type": "image",
  "url": "https://example.com/photo.jpg", // Required: http/https URL
  "width": 400, // Required: display width (px)
  "height": 400, // Required: display height (px)
  "fit": "cover", // Optional: "cover", "contain", "fill" (default: "cover")
  "position": "center",
  "zIndex": 1
}
```

### Video Element

```json
{
  "type": "video",
  "url": "https://example.com/clip.mp4", // Required: http/https URL
  "width": 1080, // Required: display width (px)
  "height": 1920, // Required: display height (px)
  "fit": "cover", // Optional: "cover", "contain", "fill" (default: "cover")
  "trimStart": 0, // Optional: skip first N seconds (default: 0)
  "loop": false, // Optional: loop video (default: false)
  "volume": 0.5, // Optional: audio volume
  "speed": 1, // Optional: playback speed (0.5=slow-mo, 2=fast-forward, default: 1)
  "position": "center",
  "zIndex": 0
}
```

### Shape Element (Rectangles, Frames)

```json
{
  "type": "shape",
  "width": 500, // Required: width (px)
  "height": 300, // Required: height (px)
  "bgColor": "#ff0000", // Optional: fill color (default: transparent)
  "strokeColor": "#ffffff", // Optional: border color (default: none)
  "strokeWidth": 4, // Optional: border thickness (default: 2)
  "borderRadius": 20, // Optional: rounded corners (default: 0)
  "gradient": {
    // Optional: gradient fill (replaces bgColor)
    "type": "linear", // "linear" or "radial"
    "colors": ["#667eea", "#764ba2"], // At least 2 colors
    "angle": 135 // Degrees (linear only)
  },
  "position": "center",
  "zIndex": 1
}
```

**Use cases:**

- **Photo frame (stroke-only):** Set `strokeColor` without `bgColor` → transparent inside, visible border
- **Colored box:** Set `bgColor` only → filled rectangle
- **Gradient box:** Set `gradient` → gradient-filled rectangle (overrides bgColor)
- **Framed box:** Set both `bgColor` + `strokeColor` → filled with border
- **Decorative overlay:** Semi-transparent `bgColor: "rgba(0,0,0,0.5)"` for dimming background

### Caption Element (SRT Subtitles)

```json
{
  "type": "caption",
  "srtContent": "1\n00:00:00,000 --> 00:00:03,000\nHello world!\n\n2\n00:00:03,500 --> 00:00:06,000\nWelcome!",
  "fontFamily": "Exo 2", // Optional: default "sans-serif"
  "fontSize": 38, // Optional: default 52
  "color": "#FFFFFF", // Optional: default "#FFFFFF"
  "strokeColor": "#000000", // Optional: default "#000000"
  "strokeWidth": 4, // Optional: default 4
  "backgroundColor": "rgba(0,0,0,0.6)", // Optional: caption box background
  "maxWidth": "85%", // Optional: default "90%"
  "lineHeight": 1.5, // Optional: default 1.3
  "textAlign": "center", // Optional: default "left"
  "borderRadius": 12, // Optional
  "position": "bottom-center",
  "zIndex": 10,
  "offsetY": -80,

  // Display mode
  "displayMode": "sentence", // Optional: "sentence" (default) or "word"
  // "sentence" — shows full subtitle text (standard subtitles)
  // "word" — shows one word at a time with pop-in animation (CapCut-style)

  // Word-level highlight (karaoke) — only used when displayMode="sentence"
  "wordHighlight": true, // Optional: default false
  "highlightStyle": "color", // Optional: "color", "background", "scale"
  "highlightColor": "#FFD700", // Optional: default "#FFD700"
  "highlightBgColor": "rgba(255,215,0,0.3)", // Optional: for "background" style
  "highlightScale": 1.15 // Optional: for "scale" style
}
```

**Display Modes:**

| Mode       | Description                                    | Best For                        |
| ---------- | ---------------------------------------------- | ------------------------------- |
| `sentence` | Shows full subtitle text (default)             | Standard subtitles, narration   |
| `word`     | Shows one word at a time with pop-in animation | CapCut-style, impactful reveals |

> 💡 When `displayMode: "word"`, the `highlightColor` and `highlightStyle` options control how the single word appears. The `wordHighlight` option is ignored in word mode.

**SRT Format:**

```

<sequence_number>
<HH:MM:SS,mmm> --> <HH:MM:SS,mmm>
<subtitle_text>

<sequence_number>
<HH:MM:SS,mmm> --> <HH:MM:SS,mmm>
<subtitle_text>

```

> ⚠️ In JSON, use `\n` for newlines in `srtContent`. Each subtitle block is separated by `\n\n`.

### Audio Config (in scene.audio)

```json
{
  "url": "https://example.com/bgm.mp3", // Required: http/https URL
  "volume": 0.3, // Optional: default 1
  "loop": true, // Optional: default false
  "start": 0, // Optional: start offset (s)
  "duration": null, // Optional: trim duration (s)
  "fadeIn": 2.0, // Optional: fade in duration (s)
  "fadeOut": 3.0 // Optional: fade out duration (s)
}
```

## Design Best Practices

### Typography

- Use **Google Fonts** for professional look (just set `fontFamily`, engine auto-downloads)
- Good font pairings:
  - Headlines: `"Orbitron"`, `"Montserrat"`, `"Poppins"`, `"Bebas Neue"`, `"Oswald"`
  - Body/Captions: `"Exo 2"`, `"Open Sans"`, `"Roboto"`, `"Inter"`, `"Nunito"`
- Use `strokeColor` + `strokeWidth` for text readability over busy backgrounds
- Set `maxWidth: "80%"` to prevent text from touching edges

### Colors & Gradients

- Use semi-transparent backgrounds: `"rgba(0,0,0,0.5)"` for text readability
- Highlight colors for karaoke: `"#FFD700"` (gold), `"#FF6B35"` (orange), `"#00E5FF"` (cyan)
- Dark backgrounds: `"#0a0a1a"`, `"#1a1a2e"`, `"#16213e"`
- Use `bgGradient` on scenes for premium backgrounds: `{ "colors": ["#0f0c29", "#302b63", "#24243e"], "angle": 135 }`
- Use `gradient` on text for eye-catching titles: `{ "type": "linear", "colors": ["#FF6B6B", "#4ECDC4"] }`
- Use `gradient` on shapes for modern UI elements

### Shadows & Glow

- Use `shadow` on text for readability: `{ "color": "rgba(0,0,0,0.6)", "blur": 10, "offsetX": 0, "offsetY": 4 }`
- Use `shadow` on images/shapes for depth: `{ "color": "rgba(0,0,0,0.5)", "blur": 20, "offsetX": 0, "offsetY": 10 }`
- Use `glow` on text for neon effects: `{ "color": "#00FF88", "blur": 20 }` — great with dark backgrounds
- Combine `glow` + `gradient` on text for premium visual effects

### Animations

- Use `fadeIn` on scene-opening titles (0.8–1.5s)
- Use `fadeOut` on closing elements (0.5–1s)
- Use `fadeInOut` for elements that appear mid-scene
- Use `slideInBottom` for titles appearing from below (energetic feel)
- Use `slideInLeft`/`slideInRight` for side-entering content
- Use `zoomIn` for impactful reveals (hero text, product images)
- Use `pop` for attention-grabbing elements (prices, badges, CTAs)
- Use `bounce` for playful, fun elements
- Use `shake` sparingly for emphasis/alert moments
- Use `typewriter` for narration text or quote reveals
- Don't animate everything — reserve for emphasis
- `scale: 1.5` + `rotation: -5` creates dynamic tilted-zoom effects

### Transitions

- Use `fade` transitions between scenes: `{ "type": "fade", "duration": 0.5–1.0 }`
- Use `slideLeft`/`slideRight` for sequential content (product features)
- Use `slideUp` for scroll-like content flow
- Use `zoomIn` for dramatic scene changes
- Use `wipeLeft` for cinematic reveals
- Not every scene needs a transition — use for mood/topic changes

### Audio

- Background music volume: `0.1–0.3` (don't overpower narration)
- Use `fadeIn: 1–2` and `fadeOut: 2–3` for smooth audio transitions
- `loop: true` for BGM shorter than video

### Layout & Timing

- Logo watermark: `position: "top-right"`, `opacity: 0.4`, small size
- Captions: `position: "bottom-center"`, `offsetY: -80` (above safe area)
- Minimum text display time: **2 seconds** (readability)
- Call-to-action: place in final scene with `animation: fadeIn`

### Track Organization Pattern

Always organize tracks by visual layer:

```
Track 0 (zIndex: 0) — Background (full-screen video/color)
Track 1 (zIndex: 1) — Content layer (product images, video clips)
Track 2 (zIndex: 2) — Text overlays (titles, prices, CTAs)
Track 3 (zIndex: 3) — Captions/subtitles (always on top)
Audio track          — Background music
```

## SRT Content Generation Guide

When generating `srtContent` for captions:

1. **Calculate timing** — Each word takes ~0.3–0.5 seconds to read
2. **Break into chunks** — 5–10 words per subtitle block
3. **Leave gaps** — 0.2–0.5s between blocks for readability
4. **Match scene duration** — SRT timestamps must fit within the caption element's scene duration
5. **Word highlight timing** — When `wordHighlight: true`, words are auto-distributed proportionally by character count within each subtitle block's time range

**Example: Generate SRT from a script**

Script: "Discover the all-new product. Premium materials. Stunning design. Available now for just $9.99."

```
1
00:00:00,500 --> 00:00:03,000
Discover the all-new product

2
00:00:03,500 --> 00:00:05,500
Premium materials

3
00:00:06,000 --> 00:00:08,000
Stunning design

4
00:00:08,500 --> 00:00:11,000
Available now for just $9.99
```

In JSON: `"1\n00:00:00,500 --> 00:00:03,000\nDiscover the all-new product\n\n2\n00:00:03,500 --> 00:00:05,500\nPremium materials\n\n3\n00:00:06,000 --> 00:00:08,000\nStunning design\n\n4\n00:00:08,500 --> 00:00:11,000\nAvailable now for just $9.99"`

## Duration Consistency Rules

**CRITICAL: All video tracks must have matching total durations to avoid rendering issues.**

### How to Calculate Track Duration

Track total duration = sum of all scene durations in that track

Example:

```
Track 0: Scene(5s) + Scene(5s) = 10s total ✅
Track 1: Scene(10s) = 10s total ✅
Track 2: Scene(3s) + Scene(4s) + Scene(3s) = 10s total ✅
Caption track: Scene(10s) = 10s total ✅
Audio track: Scene(10s) with audio duration matching = 10s ✅
```

### Track `start` Offset

If a track has `start: 2`, it begins 2 seconds into the global timeline. Its content duration still needs to fit within the overall video.

## Common Video Templates

### 1. Product Ad (TikTok/Reels)

- Resolution: 1080×1920 (9:16)
- Duration: 15–30s
- Structure: Hook (3s) → Features (10–15s) → CTA (5s)
- Tracks: bg video + product images + text overlays + captions + music

### 2. Text-Only Explainer

- Resolution: 1080×1920 or 1920×1080
- Duration: 30–60s
- Structure: Multiple scenes with text appearing/disappearing
- Tracks: solid bg colors + text overlays + captions + music

### 3. Image Slideshow

- Resolution: Any
- Duration: Variable
- Structure: Each scene shows an image with text overlay
- Tracks: bg color + images + text titles + music

### 4. Motivational/Quote Video

- Resolution: 1080×1920
- Duration: 10–30s
- Structure: Dark bg + quote text with animation
- Tracks: bg video/color + quote text + author attribution + music

## Output Format

When generating a video script, output the complete JSON wrapped in a ```json code block. Include comments explaining each track's purpose before the JSON.

Always provide the JSON that can be directly used with:

```typescript
import { json2videoFile } from "qpv-json2video";

await json2videoFile(config, "./output.mp4", {
  onProgress: (p) => console.log(`${p}%`),
});
```

## Examples

See the `examples/` directory for complete, production-ready JSON configurations:

- `examples/product_ad.json` — TikTok-style product advertisement
- `examples/text_explainer.json` — Text-only explainer video
- `examples/quote_video.json` — Motivational quote video
