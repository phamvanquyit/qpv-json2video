import { z } from 'zod/v4';

// ============================================================
// Enum / literal union schemas
// ============================================================

export const PositionTypeSchema = z.enum([
  'center',
  'top-left', 'top-center', 'top-right',
  'left', 'right',
  'bottom-left', 'bottom-center', 'bottom-right',
]);

export const AnimationTypeSchema = z.enum([
  'fadeIn', 'fadeOut', 'fadeInOut',
  'slideInLeft', 'slideInRight', 'slideInTop', 'slideInBottom',
  'slideOutLeft', 'slideOutRight', 'slideOutTop', 'slideOutBottom',
  'zoomIn', 'zoomOut',
  'bounce', 'pop', 'shake',
  'typewriter',
]);

export const EasingTypeSchema = z.enum([
  'linear',
  'easeIn', 'easeOut', 'easeInOut',
  'easeInCubic', 'easeOutCubic', 'easeInOutCubic',
  'easeInBack', 'easeOutBack', 'easeInOutBack',
  'easeOutBounce',
  'easeOutElastic',
  'spring',
]);

export const TransitionTypeSchema = z.enum([
  'fade',
  'slideLeft', 'slideRight', 'slideUp', 'slideDown',
  'wipeLeft', 'wipeRight', 'wipeUp', 'wipeDown',
  'zoomIn', 'zoomOut',
]);

export const BlendModeSchema = z.enum([
  'normal',
  'multiply', 'screen', 'overlay',
  'darken', 'lighten',
  'color-dodge', 'color-burn',
  'hard-light', 'soft-light',
  'difference', 'exclusion',
]);

export const ShapeTypeSchema = z.enum([
  'rectangle', 'circle', 'ellipse', 'line',
]);

export const WordHighlightStyleSchema = z.enum([
  'color', 'background', 'scale',
]);

export const CaptionDisplayModeSchema = z.enum([
  'sentence', 'word',
]);

export const TextBackgroundShapeSchema = z.enum([
  'rectangle', 'pill', 'banner', 'speech-bubble',
]);

export const WaveformStyleSchema = z.enum([
  'bars', 'line', 'mirror', 'circle',
]);

// ============================================================
// Sub-object schemas
// ============================================================

export const ElementAnimationSchema = z.object({
  type: AnimationTypeSchema,
  fadeInDuration: z.number().positive().optional(),
  fadeOutDuration: z.number().positive().optional(),
});

export const KeyframeSchema = z.object({
  time: z.number().min(0),
  easing: EasingTypeSchema.optional(),
  opacity: z.number().min(0).max(1).optional(),
  scale: z.number().optional(),
  rotation: z.number().optional(),
  offsetX: z.number().optional(),
  offsetY: z.number().optional(),
});

export const ShadowConfigSchema = z.object({
  color: z.string(),
  blur: z.number().min(0),
  offsetX: z.number(),
  offsetY: z.number(),
});

export const GlowConfigSchema = z.object({
  color: z.string(),
  blur: z.number().min(0),
});

export const GradientConfigSchema = z.object({
  type: z.enum(['linear', 'radial']),
  colors: z.array(z.string()).min(2),
  angle: z.number().optional(),
});

export const FilterConfigSchema = z.object({
  blur: z.number().min(0).optional(),
  brightness: z.number().min(0).max(2).optional(),
  contrast: z.number().min(0).max(2).optional(),
  saturate: z.number().min(0).max(2).optional(),
  grayscale: z.number().min(0).max(1).optional(),
  sepia: z.number().min(0).max(1).optional(),
  hueRotate: z.number().min(0).max(360).optional(),
  invert: z.number().min(0).max(1).optional(),
});

export const VignetteConfigSchema = z.object({
  intensity: z.number().min(0).max(1).optional(),
  size: z.number().min(0).max(1).optional(),
  color: z.string().optional(),
});

export const ColorOverlayConfigSchema = z.object({
  color: z.string(),
  blendMode: BlendModeSchema.optional(),
});

export const SceneTransitionSchema = z.object({
  type: TransitionTypeSchema,
  duration: z.number().positive(),
});

export const RichTextSegmentSchema = z.object({
  text: z.string(),
  color: z.string().optional(),
  fontSize: z.number().positive().optional(),
  fontWeight: z.union([z.string(), z.number()]).optional(),
  fontFamily: z.string().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  bgColor: z.string().optional(),
  strokeColor: z.string().optional(),
  strokeWidth: z.number().min(0).optional(),
});

export const CounterConfigSchema = z.object({
  from: z.number(),
  to: z.number(),
  duration: z.number().positive().optional(),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
  decimals: z.number().int().min(0).optional(),
  thousandSep: z.boolean().optional(),
  easing: EasingTypeSchema.optional(),
});

export const AudioConfigSchema = z.object({
  url: z.string().min(1),
  start: z.number().min(0).optional(),
  volume: z.number().min(0).optional(),
  loop: z.boolean().optional(),
  duration: z.number().positive().optional(),
  trimStart: z.number().min(0).optional(),
  trimEnd: z.number().min(0).optional(),
  fadeIn: z.number().min(0).optional(),
  fadeOut: z.number().min(0).optional(),
});

export const ChromaKeyConfigSchema = z.object({
  color: z.string(),
  tolerance: z.number().min(0).max(1).optional(),
  softness: z.number().min(0).max(1).optional(),
});

// ============================================================
// Mask schemas
// ============================================================

export const MaskShapeTypeSchema = z.enum([
  'rect', 'circle', 'ellipse', 'star', 'polygon',
]);

export const ShapeMaskConfigSchema = z.object({
  type: z.literal('shape'),
  shape: MaskShapeTypeSchema,
  radius: z.number().positive().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  borderRadius: z.number().min(0).optional(),
  points: z.number().int().min(3).optional(),
  innerRadius: z.number().min(0).max(1).optional(),
  numSides: z.number().int().min(3).optional(),
  offsetX: z.number().optional(),
  offsetY: z.number().optional(),
  invert: z.boolean().optional(),
});

export const TextMaskConfigSchema = z.object({
  type: z.literal('text'),
  text: z.string().min(1),
  fontSize: z.number().positive(),
  fontFamily: z.string().optional(),
  fontWeight: z.union([z.string(), z.number()]).optional(),
  textAlign: z.enum(['left', 'center', 'right']).optional(),
  offsetX: z.number().optional(),
  offsetY: z.number().optional(),
  invert: z.boolean().optional(),
  letterSpacing: z.number().optional(),
  strokeWidth: z.number().min(0).optional(),
});

export const MaskConfigSchema = z.discriminatedUnion('type', [
  ShapeMaskConfigSchema,
  TextMaskConfigSchema,
]);

// ============================================================
// Element Base schema (shared props)
// ============================================================

const ElementBaseSchema = z.object({
  position: PositionTypeSchema.optional().default('center'),
  zIndex: z.coerce.number().optional().default(0),
  borderRadius: z.number().min(0).optional(),
  start: z.number().min(0).optional(),
  duration: z.number().positive().optional(),
  offsetX: z.number().optional(),
  offsetY: z.number().optional(),
  opacity: z.number().min(0).max(1).optional(),
  scale: z.number().optional(),
  rotation: z.number().optional(),
  animation: ElementAnimationSchema.optional(),
  keyframes: z.array(KeyframeSchema).optional(),
  shadow: ShadowConfigSchema.optional(),
  filters: FilterConfigSchema.optional(),
  blendMode: BlendModeSchema.optional(),
  mask: MaskConfigSchema.optional(),
});

// ============================================================
// Element type schemas
// ============================================================

export const TextElementSchema = ElementBaseSchema.extend({
  type: z.literal('text'),
  text: z.string(),
  fontFamily: z.string().optional(),
  fontSize: z.number().positive().optional(),
  fontWeight: z.union([z.string(), z.number()]).optional(),
  color: z.string().optional(),
  bgColor: z.string().optional(),
  maxWidth: z.union([z.number().positive(), z.string()]).optional(),
  textAlign: z.enum(['left', 'center', 'right']).optional(),
  strokeColor: z.string().optional(),
  strokeWidth: z.number().min(0).optional(),
  lineHeight: z.number().positive().optional(),
  padding: z.number().min(0).optional(),
  glow: GlowConfigSchema.optional(),
  gradient: GradientConfigSchema.optional(),
  richText: z.array(RichTextSegmentSchema).min(1).optional(),
  bgShape: TextBackgroundShapeSchema.optional(),
  counter: CounterConfigSchema.optional(),
});

export const ImageElementSchema = ElementBaseSchema.extend({
  type: z.literal('image'),
  url: z.string().min(1),
  width: z.coerce.number().positive(),
  height: z.coerce.number().positive(),
  fit: z.enum(['cover', 'contain', 'fill']).optional(),
  kenBurns: z.object({
    startX: z.number().min(0).max(100).optional(),
    startY: z.number().min(0).max(100).optional(),
    startZoom: z.number().positive().optional(),
    endX: z.number().min(0).max(100).optional(),
    endY: z.number().min(0).max(100).optional(),
    endZoom: z.number().positive().optional(),
    easing: EasingTypeSchema.optional(),
  }).optional(),
});

export const VideoElementSchema = ElementBaseSchema.extend({
  type: z.literal('video'),
  url: z.string().min(1),
  width: z.coerce.number().positive(),
  height: z.coerce.number().positive(),
  fit: z.enum(['cover', 'contain', 'fill']).optional(),
  loop: z.boolean().optional(),
  volume: z.number().min(0).optional(),
  trimStart: z.number().min(0).optional(),
  speed: z.number().positive().optional(),
  // Phase 7: Video Processing
  crop: z.object({
    x: z.number().min(0),
    y: z.number().min(0),
    width: z.number().positive(),
    height: z.number().positive(),
  }).optional(),
  reverse: z.boolean().optional(),
  freezeAt: z.number().min(0).optional(),
  freezeDuration: z.number().positive().optional(),
  speedCurve: z.array(z.object({
    time: z.number().min(0),
    speed: z.number().positive(),
  })).min(2).optional(),
  chromaKey: ChromaKeyConfigSchema.optional(),
});

export const ShapeElementSchema = ElementBaseSchema.extend({
  type: z.literal('shape'),
  shape: ShapeTypeSchema.optional(),
  width: z.coerce.number().positive(),
  height: z.coerce.number().positive(),
  bgColor: z.string().optional(),
  strokeColor: z.string().optional(),
  strokeWidth: z.number().min(0).optional(),
  gradient: GradientConfigSchema.optional(),
  linePoints: z.object({
    x1: z.number(),
    y1: z.number(),
    x2: z.number(),
    y2: z.number(),
  }).optional(),
});

export const CaptionElementSchema = ElementBaseSchema.extend({
  type: z.literal('caption'),
  srtContent: z.string().min(1),
  fontFamily: z.string().optional(),
  fontSize: z.number().positive().optional(),
  color: z.string().optional(),
  strokeColor: z.string().optional(),
  strokeWidth: z.number().min(0).optional(),
  backgroundColor: z.string().optional(),
  maxWidth: z.string().optional(),
  lineHeight: z.number().positive().optional(),
  textAlign: z.enum(['left', 'center', 'right']).optional(),
  displayMode: CaptionDisplayModeSchema.optional(),
  wordHighlight: z.boolean().optional(),
  highlightColor: z.string().optional(),
  highlightBgColor: z.string().optional(),
  highlightStyle: WordHighlightStyleSchema.optional(),
  highlightScale: z.number().positive().optional(),
});

export const SvgElementSchema = ElementBaseSchema.extend({
  type: z.literal('svg'),
  svgContent: z.string().optional(),
  url: z.string().min(1).optional(),
  width: z.coerce.number().positive(),
  height: z.coerce.number().positive(),
  fit: z.enum(['cover', 'contain', 'fill']).optional(),
  fillColor: z.string().optional(),
}).refine(
  (data) => data.svgContent || data.url,
  { message: 'SVG element phải có svgContent hoặc url' }
);

export const WaveformElementSchema = ElementBaseSchema.extend({
  type: z.literal('waveform'),
  audioUrl: z.string().min(1),
  width: z.coerce.number().positive(),
  height: z.coerce.number().positive(),
  style: WaveformStyleSchema.optional(),
  color: z.string().optional(),
  secondaryColor: z.string().optional(),
  barCount: z.number().int().min(2).max(512).optional(),
  barWidth: z.number().positive().optional(),
  barGap: z.number().min(0).optional(),
  barRadius: z.number().min(0).optional(),
  lineWidth: z.number().positive().optional(),
  sensitivity: z.number().positive().optional(),
  smoothing: z.number().min(0).max(1).optional(),
  mirror: z.boolean().optional(),
  gradient: GradientConfigSchema.optional(),
});

export const TimerFormatSchema = z.enum([
  'hh:mm:ss:SSS', 'hh:mm:ss', 'mm:ss:SSS', 'mm:ss', 'ss:SSS', 'ss',
]);

export const TimerElementSchema = ElementBaseSchema.extend({
  type: z.literal('timer'),
  format: TimerFormatSchema.optional(),
  fontFamily: z.string().optional(),
  fontSize: z.number().positive().optional(),
  fontWeight: z.union([z.string(), z.number()]).optional(),
  color: z.string().optional(),
  bgColor: z.string().optional(),
  textAlign: z.enum(['left', 'center', 'right']).optional(),
  strokeColor: z.string().optional(),
  strokeWidth: z.number().min(0).optional(),
  padding: z.number().min(0).optional(),
  glow: GlowConfigSchema.optional(),
  gradient: GradientConfigSchema.optional(),
  separatorColor: z.string().optional(),
  countDown: z.boolean().optional(),
  maxDuration: z.number().positive().optional(),
});

export const SceneElementSchema = z.discriminatedUnion('type', [
  TextElementSchema,
  ImageElementSchema,
  VideoElementSchema,
  ShapeElementSchema,
  CaptionElementSchema,
  SvgElementSchema as any, // refine() changes type, cast for discriminatedUnion
  WaveformElementSchema,
  TimerElementSchema,
]);

// ============================================================
// Scene schema
// ============================================================

export const SceneSchema = z.object({
  title: z.string().optional(),
  duration: z.coerce.number().positive(),
  bgColor: z.string().optional(),
  bgGradient: z.object({
    colors: z.array(z.string()).min(2),
    angle: z.number().optional(),
  }).optional(),
  elements: z.array(SceneElementSchema).optional(),
  audio: z.union([AudioConfigSchema, z.array(AudioConfigSchema)]).optional(),
  transition: SceneTransitionSchema.optional(),
  vignette: VignetteConfigSchema.optional(),
  colorOverlay: ColorOverlayConfigSchema.optional(),
});

// ============================================================
// Track schema
// ============================================================

export const TrackSchema = z.object({
  type: z.enum(['video', 'audio']).optional().default('video'),
  zIndex: z.coerce.number().optional(),
  start: z.coerce.number().min(0).optional(),
  scenes: z.array(SceneSchema).min(1),
});

// ============================================================
// VideoConfig schema (root)
// ============================================================

export const VideoConfigSchema = z.object({
  width: z.coerce.number().positive(),
  height: z.coerce.number().positive(),
  fps: z.coerce.number().positive().optional(),
  tracks: z.array(TrackSchema).min(1),
});

/**
 * Legacy format: scenes[] thay vì tracks[]
 * Auto-convert → single track khi validate
 */
export const VideoConfigLegacySchema = z.object({
  width: z.coerce.number().positive(),
  height: z.coerce.number().positive(),
  fps: z.coerce.number().positive().optional(),
  scenes: z.array(SceneSchema).min(1),
});

/**
 * Combined schema: chấp nhận cả tracks[] hoặc scenes[] (legacy)
 */
export const VideoConfigInputSchema = z.union([
  VideoConfigSchema,
  VideoConfigLegacySchema,
]);

// ============================================================
// Validation result
// ============================================================

export interface ValidationError {
  /** Đường dẫn đến field lỗi, ví dụ "tracks[0].scenes[1].elements[2].url" */
  path: string;
  /** Mô tả lỗi */
  message: string;
  /** Giá trị đã nhận */
  received?: unknown;
}

export interface ValidationResult {
  success: boolean;
  errors: ValidationError[];
}

/**
 * Validate VideoConfig input trước khi render.
 * Trả về ValidationResult với danh sách lỗi chi tiết.
 *
 * @example
 * ```ts
 * const result = validateConfig(myConfig);
 * if (!result.success) {
 *   result.errors.forEach(e => console.error(`${e.path}: ${e.message}`));
 * }
 * ```
 */
export function validateConfig(input: unknown): ValidationResult {
  const result = VideoConfigInputSchema.safeParse(input);

  if (result.success) {
    return { success: true, errors: [] };
  }

  // Helper: extract detailed errors from a ZodError
  const extractErrors = (issues: typeof result.error.issues): ValidationError[] =>
    issues.map((issue) => {
      const pathStr = issue.path
        .map(p => typeof p === 'number' ? `[${p}]` : p)
        .join('.')
        .replace(/\.\[/g, '[');

      return {
        path: pathStr || '(root)',
        message: issue.message,
        received: (issue as any).received ?? (issue as any).input,
      };
    });

  let errors = extractErrors(result.error.issues);

  // Khi z.union fail cả 2 variants, Zod chỉ trả "Invalid input" ở root.
  // Fallback: validate riêng từng schema variant để lấy errors chi tiết.
  const hasOnlyGenericErrors = errors.length > 0 && errors.every(e => e.path === '(root)');

  if (hasOnlyGenericErrors && input && typeof input === 'object') {
    const obj = input as Record<string, unknown>;

    // Chọn schema phù hợp dựa trên field có mặt
    const specificSchema = obj.tracks ? VideoConfigSchema : VideoConfigLegacySchema;
    const specificResult = specificSchema.safeParse(input);

    if (!specificResult.success) {
      const detailedErrors = extractErrors(specificResult.error.issues);
      // Nếu có errors chi tiết hơn → dùng chúng
      if (detailedErrors.length > 0) {
        errors = detailedErrors;
      }
    }

    // Nếu vẫn chỉ có generic errors (ví dụ input null / thiếu cả tracks & scenes),
    // tạo error message rõ ràng hơn
    if (errors.length > 0 && errors.every(e => e.path === '(root)')) {
      if (!obj.width && !obj.height) {
        errors = [{ path: '(root)', message: 'Config phải là object có width, height, và tracks[] (hoặc scenes[])' }];
      } else if (!obj.tracks && !obj.scenes) {
        errors = [{ path: '(root)', message: 'Config phải có tracks[] hoặc scenes[]' }];
      }
    }
  } else if (hasOnlyGenericErrors && (!input || typeof input !== 'object')) {
    errors = [{ path: '(root)', message: `Config phải là một object, nhận được: ${input === null ? 'null' : typeof input}` }];
  }

  return { success: false, errors };
}

/**
 * Validate VideoConfig và throw error nếu không hợp lệ.
 * Error message chứa tất cả validation errors, dễ đọc.
 *
 * @throws Error với danh sách lỗi chi tiết
 *
 * @example
 * ```ts
 * // Sẽ throw nếu config không hợp lệ
 * assertValidConfig(myConfig);
 * ```
 */
export function assertValidConfig(input: unknown): void {
  const result = validateConfig(input);

  if (!result.success) {
    const lines = result.errors.map((e, i) =>
      `  ${i + 1}. [${e.path}] ${e.message}`
    );
    throw new Error(
      `❌ Video config không hợp lệ (${result.errors.length} lỗi):\n${lines.join('\n')}`
    );
  }
}
