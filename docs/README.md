# qpv-json2video — Documentation

Complete JSON schema reference and detailed API documentation.

> 📦 **Install:** `yarn add qpv-json2video`
>
> 🚀 **Quick Start & Examples:** See [README.md](../README.md)

---

## Rendering Pipeline

```mermaid
flowchart LR
    A["📄 JSON Config"] --> B["🔍 Parse & Validate"]
    B --> C["📥 Download Assets"]
    C --> D["🎨 Render Frames"]
    D --> E["🎬 Encode Video"]
    E --> F["🔊 Mix Audio"]
    F --> G["📦 Output MP4"]
```

## Config Hierarchy

```mermaid
flowchart TD
    VC["VideoConfig"] --> |width, height, fps| T["Track[]"]
    T --> |type, zIndex, start| S["Scene[]"]
    S --> |duration, bgColor| E["Element[]"]
    S --> |optional| AU["Audio[]"]
    S --> |optional| TR["Transition"]
    S --> |optional| VG["Vignette"]
    S --> |optional| CO["Color Overlay"]
    E --> TEXT["Text"]
    E --> IMG["Image"]
    E --> VID["Video"]
    E --> SHP["Shape"]
    E --> CAP["Caption"]
    E --> SVG_EL["SVG"]
    E --> WAV["Waveform"]

    style VC fill:#4ECDC4,color:#000
    style T fill:#45B7D1,color:#000
    style S fill:#96CEB4,color:#000
    style E fill:#FFEAA7,color:#000
    style AU fill:#DDA0DD,color:#000
```

---

## 📚 Documentation Index

### Schema

| Doc                                     | Description                              |
| --------------------------------------- | ---------------------------------------- |
| [Getting Started](./getting-started.md) | Installation, Quick Start, API reference |
| [Schema](./schema.md)                   | VideoConfig, Track, Scene structure      |
| [Transitions](./transitions.md)         | 11 scene transition types                |
| [Animations](./animations.md)           | 17 animation types                       |
| [Audio](./audio.md)                     | Audio mixing, fade, loop, trim           |

### Element Types

| Doc                                | Description                                                    |
| ---------------------------------- | -------------------------------------------------------------- |
| [Text](./elements/text.md)         | Text, Google Fonts, stroke, glow, gradient, richText, counter  |
| [Image](./elements/image.md)       | Image display, fit modes, Ken Burns effect                     |
| [Video](./elements/video.md)       | Video, speed, chroma key, crop, freeze, reverse, speed ramping |
| [Shape](./elements/shape.md)       | Rectangle, circle, ellipse, line                               |
| [Caption](./elements/caption.md)   | SRT subtitles, word highlight, word-by-word display            |
| [SVG](./elements/svg.md)           | SVG rendering (inline or URL), fill color override             |
| [Waveform](./elements/waveform.md) | Audio waveform visualization (bars, line, mirror, circle)      |

### Effects & Styling

| Doc                                         | Description                  |
| ------------------------------------------- | ---------------------------- |
| [Shadow](./effects/shadow.md)               | Drop shadow on any element   |
| [Filters](./effects/filters.md)             | CSS-style visual filters     |
| [Blend Modes](./effects/blend-modes.md)     | 12 compositing blend modes   |
| [Gradient](./effects/gradient.md)           | Linear/radial gradient fill  |
| [Glow](./effects/glow.md)                   | Neon glow effect (text)      |
| [Vignette](./effects/vignette.md)           | Darkened edges effect        |
| [Color Overlay](./effects/color-overlay.md) | Semi-transparent color layer |
| [Mask](./effects/mask.md)                   | Shape and text masks         |

---

## Element Types Overview

```mermaid
classDiagram
    class BaseElement {
        +position: PositionType
        +zIndex: number
        +opacity: number
        +scale: number
        +rotation: number
        +animation: ElementAnimation
        +keyframes: Keyframe[]
        +shadow: ShadowConfig
        +filters: FilterConfig
        +blendMode: BlendMode
        +mask: MaskConfig
    }

    class TextElement {
        +type: text
        +text: string
        +fontFamily: string
        +fontSize: number
        +glow: GlowConfig
        +gradient: GradientConfig
        +richText: RichTextSegment[]
        +bgShape: TextBackgroundShape
        +counter: CounterConfig
    }

    class ImageElement {
        +type: image
        +url: string
        +width: number
        +height: number
        +fit: string
        +kenBurns: KenBurnsConfig
    }

    class VideoElement {
        +type: video
        +url: string
        +speed: number
        +chromaKey: ChromaKeyConfig
        +crop: VideoCropConfig
        +reverse: boolean
        +freezeAt: number
        +speedCurve: SpeedCurvePoint[]
    }

    class ShapeElement {
        +type: shape
        +shape: ShapeType
        +bgColor: string
        +gradient: GradientConfig
    }

    class CaptionElement {
        +type: caption
        +srtContent: string
        +displayMode: string
        +wordHighlight: boolean
    }

    class SVGElement {
        +type: svg
        +svgContent: string
        +url: string
        +fillColor: string
    }

    class WaveformElement {
        +type: waveform
        +audioUrl: string
        +style: WaveformStyle
    }

    BaseElement <|-- TextElement
    BaseElement <|-- ImageElement
    BaseElement <|-- VideoElement
    BaseElement <|-- ShapeElement
    BaseElement <|-- CaptionElement
    BaseElement <|-- SVGElement
    BaseElement <|-- WaveformElement
```

## Scene Compositing Order

```mermaid
flowchart TD
    BG["1. Draw Background"] --> EL["2. Draw Elements (sorted by zIndex)"]
    EL --> |for each| PROC["Apply: position → scale → rotation → filters → blendMode → mask"]
    PROC --> SHADOW["Draw shadow"]
    SHADOW --> DRAW["Draw element content"]
    DRAW --> ANIM["Apply animation"]
    ANIM --> NEXT{"More elements?"}
    NEXT --> |Yes| EL
    NEXT --> |No| VIG["3. Apply Vignette"]
    VIG --> OVR["4. Apply Color Overlay"]
    OVR --> FRAME["5. Frame → FFmpeg"]

    style BG fill:#1a1a2e,color:#fff
    style FRAME fill:#4ECDC4,color:#000
```
