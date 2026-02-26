import type { SKRSContext2D as CanvasRenderingContext2D } from '@napi-rs/canvas';
import { TextElement, RichTextSegment, CounterConfig, TextBackgroundShape } from '../../types';
import { computePosition, buildFontString, measureTextBlock, normalizeFontWeight, roundRectPath, createGradient, ElementAnimationState, getEasingFunction } from '../utils';

/**
 * Text segment với color info (dùng cho multi-color text via <color> tags)
 */
interface ColoredSegment {
  text: string;
  color: string | null; // null = dùng default color
}

/**
 * Parse text với color tags thành segments
 * Ví dụ: "Hello <color=#FF0000>World</color>!" → [{text: "Hello ", color: null}, {text: "World", color: "#FF0000"}, {text: "!", color: null}]
 */
function parseColorTags(text: string): ColoredSegment[] {
  const segments: ColoredSegment[] = [];
  const regex = /<color=(#[0-9A-Fa-f]{3,8}|[a-zA-Z]+)>(.*?)<\/color>/g;

  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Text trước tag
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), color: null });
    }

    // Text trong tag với color
    segments.push({ text: match[2], color: match[1] });

    lastIndex = match.index + match[0].length;
  }

  // Text còn lại sau tag cuối
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), color: null });
  }

  // Nếu không có tag, trả về toàn bộ text
  if (segments.length === 0) {
    segments.push({ text, color: null });
  }

  return segments;
}

/**
 * Check if text contains color tags
 */
function hasColorTags(text: string): boolean {
  return /<color=[^>]+>.*?<\/color>/i.test(text);
}

/**
 * Get plain text (without tags) for measurement
 */
function stripColorTags(text: string): string {
  return text.replace(/<color=[^>]+>(.*?)<\/color>/gi, '$1');
}

// ==================== COUNTER ANIMATION ====================

/**
 * Format number với thousands separator
 */
function formatNumber(value: number, decimals: number, thousandSep: boolean): string {
  const fixed = value.toFixed(decimals);
  if (!thousandSep) return fixed;

  const [intPart, decPart] = fixed.split('.');
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decPart !== undefined ? `${formatted}.${decPart}` : formatted;
}

/**
 * Tính giá trị counter tại thời điểm hiện tại
 */
function computeCounterValue(
  counter: CounterConfig,
  currentTime: number,
  elementStart: number,
  sceneDuration: number,
  elementDuration?: number
): string {
  const { from, to, prefix = '', suffix = '', decimals = 0, thousandSep = true, easing } = counter;

  const elStart = elementStart ?? 0;
  const timeInElement = currentTime - elStart;
  const counterDuration = counter.duration ?? elementDuration ?? (sceneDuration - elStart);

  if (timeInElement <= 0) {
    return `${prefix}${formatNumber(from, decimals, thousandSep)}${suffix}`;
  }

  if (timeInElement >= counterDuration) {
    return `${prefix}${formatNumber(to, decimals, thousandSep)}${suffix}`;
  }

  const rawProgress = timeInElement / counterDuration;
  const easingFn = getEasingFunction(easing ?? 'easeOutCubic');
  const progress = easingFn(Math.max(0, Math.min(1, rawProgress)));

  const value = from + (to - from) * progress;
  return `${prefix}${formatNumber(value, decimals, thousandSep)}${suffix}`;
}

// ==================== RICH TEXT ====================

/**
 * Thông tin đã tính toán cho 1 word trong rich text
 */
interface RichWord {
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: number;
  color: string;
  italic: boolean;
  underline: boolean;
  bgColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  width: number; // measured width
}

/**
 * Measure 1 rich word
 */
function measureRichWord(
  ctx: CanvasRenderingContext2D,
  word: RichWord
): number {
  ctx.font = buildFontString(word.fontWeight, word.fontSize, word.fontFamily);
  return ctx.measureText(word.text).width;
}

/**
 * Resolve rich text segments thành flat array of rich words
 * Mỗi segment text được split thành words, kế thừa style
 */
function resolveRichWords(
  ctx: CanvasRenderingContext2D,
  segments: RichTextSegment[],
  defaults: { fontSize: number; fontFamily: string; fontWeight: number; color: string }
): RichWord[] {
  const words: RichWord[] = [];

  for (const seg of segments) {
    const fontSize = seg.fontSize ?? defaults.fontSize;
    const fontFamily = seg.fontFamily ?? defaults.fontFamily;
    const fontWeight = normalizeFontWeight(seg.fontWeight ?? defaults.fontWeight);
    const color = seg.color ?? defaults.color;
    const italic = seg.italic ?? false;
    const underline = seg.underline ?? false;
    const bgColor = seg.bgColor;
    const strokeColor = seg.strokeColor;
    const strokeWidth = seg.strokeWidth;

    // Split text thành words (giữ spaces ở cuối nếu có)
    // Xử lý case: segment text = "SALE " — trailing space
    const parts = seg.text.split(/(\s+)/);
    for (const part of parts) {
      if (part.length === 0) continue;
      const word: RichWord = {
        text: part,
        fontSize,
        fontFamily,
        fontWeight,
        color,
        italic,
        underline,
        bgColor,
        strokeColor,
        strokeWidth,
        width: 0,
      };
      ctx.font = buildFontString(fontWeight, fontSize, fontFamily);
      word.width = ctx.measureText(part).width;
      words.push(word);
    }
  }

  return words;
}

/**
 * Word-wrap rich words thành lines
 * Trả về indices groups
 */
function wrapRichWords(words: RichWord[], maxWidth: number): number[][] {
  const lines: number[][] = [];
  let currentLine: number[] = [];
  let currentWidth = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    // Space-only words don't start new lines
    if (word.text.trim().length === 0) {
      if (currentLine.length > 0) {
        currentWidth += word.width;
        currentLine.push(i);
      }
      continue;
    }

    if (currentWidth + word.width > maxWidth && currentLine.length > 0) {
      // Remove trailing spaces from previous line
      while (currentLine.length > 0 && words[currentLine[currentLine.length - 1]].text.trim().length === 0) {
        currentLine.pop();
      }
      lines.push(currentLine);
      currentLine = [i];
      currentWidth = word.width;
    } else {
      currentLine.push(i);
      currentWidth += word.width;
    }
  }

  if (currentLine.length > 0) {
    // Remove trailing spaces
    while (currentLine.length > 0 && words[currentLine[currentLine.length - 1]].text.trim().length === 0) {
      currentLine.pop();
    }
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [[]];
}

// ==================== BACKGROUND SHAPES ====================

/**
 * Vẽ background shape cho text box
 */
function drawBackgroundShape(
  ctx: CanvasRenderingContext2D,
  shape: TextBackgroundShape,
  bgColor: string,
  x: number,
  y: number,
  w: number,
  h: number,
  borderRadius: number
): void {
  ctx.save();
  ctx.fillStyle = bgColor;

  switch (shape) {
    case 'pill': {
      // Pill shape: borderRadius = height/2
      const r = h / 2;
      roundRectPath(ctx, x, y, w, h, r);
      ctx.fill();
      break;
    }

    case 'banner': {
      // Banner/ribbon shape: hình chữ nhật với V-cut ở 2 bên
      const cutDepth = Math.min(h * 0.2, 15); // V-cut depth
      ctx.beginPath();
      ctx.moveTo(x + cutDepth, y);
      ctx.lineTo(x + w - cutDepth, y);
      ctx.lineTo(x + w, y + h * 0.15);
      ctx.lineTo(x + w, y + h * 0.85);
      ctx.lineTo(x + w - cutDepth, y + h);
      ctx.lineTo(x + cutDepth, y + h);
      ctx.lineTo(x, y + h * 0.85);
      ctx.lineTo(x, y + h * 0.15);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'speech-bubble': {
      // Speech bubble: rounded rect + triangle tail phía dưới
      const tailWidth = Math.min(w * 0.15, 30);
      const tailHeight = Math.min(h * 0.3, 20);
      const r = Math.min(borderRadius || 12, h / 3);
      const bubbleH = h - tailHeight;

      // Rounded rect (body)
      roundRectPath(ctx, x, y, w, bubbleH, r);
      ctx.fill();

      // Triangle tail (center bottom)
      const tailCenterX = x + w / 2;
      ctx.beginPath();
      ctx.moveTo(tailCenterX - tailWidth / 2, y + bubbleH - 1);
      ctx.lineTo(tailCenterX, y + h);
      ctx.lineTo(tailCenterX + tailWidth / 2, y + bubbleH - 1);
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 'rectangle':
    default: {
      if (borderRadius > 0) {
        roundRectPath(ctx, x, y, w, h, borderRadius);
        ctx.fill();
      } else {
        ctx.fillRect(x, y, w, h);
      }
      break;
    }
  }

  ctx.restore();
}

// ==================== MAIN PAINT FUNCTION ====================

/**
 * Vẽ text element lên canvas
 * Hỗ trợ: glow (neon effect), gradient fill, shadow (via canvas-renderer), multi-color text,
 * rich text (multi-style), text background shapes (pill, banner, speech-bubble), counter animation
 * @param animState - Optional animation state (dùng cho typewriter effect)
 */
export function paintText(
  ctx: CanvasRenderingContext2D,
  element: TextElement,
  canvasWidth: number,
  canvasHeight: number,
  currentTime: number,
  sceneDuration: number,
  animState?: ElementAnimationState
): void {
  const {
    fontFamily = 'sans-serif',
    fontSize = 48,
    fontWeight = 400,
    color = '#FFFFFF',
    bgColor,
    position = 'center',
    textAlign = 'center',
    strokeColor = '#000000',
    strokeWidth = 0,
    lineHeight = 1.3,
    padding = 10,
    maxWidth,
    offsetX = 0,
    offsetY = 0,
    borderRadius = 0,
    opacity = 1,
    glow,
    gradient,
    richText,
    bgShape,
    counter,
  } = element;

  // === COUNTER: override text ===
  let text = element.text;
  if (counter) {
    text = computeCounterValue(counter, currentTime, element.start ?? 0, sceneDuration, element.duration);
  }

  // === RICH TEXT MODE ===
  if (richText && richText.length > 0 && !counter) {
    paintRichText(ctx, element, richText, canvasWidth, canvasHeight, currentTime, sceneDuration, animState);
    return;
  }

  const weight = normalizeFontWeight(fontWeight);
  ctx.font = buildFontString(weight, fontSize, fontFamily);

  // Check for multi-color text (legacy <color> tags)
  const isMultiColor = hasColorTags(text);
  const plainText = isMultiColor ? stripColorTags(text) : text;
  const colorSegments = isMultiColor ? parseColorTags(text) : null;

  // Tính maxWidth thực tế
  let effectiveMaxWidth: number;
  if (typeof maxWidth === 'number') {
    effectiveMaxWidth = maxWidth;
  } else if (typeof maxWidth === 'string' && maxWidth.endsWith('%')) {
    effectiveMaxWidth = (parseFloat(maxWidth) / 100) * canvasWidth;
  } else {
    effectiveMaxWidth = canvasWidth * 0.9;
  }

  // Trừ padding
  const innerMaxWidth = effectiveMaxWidth - padding * 2;

  // Word wrap (dùng plain text để tính layout)
  const textBlock = measureTextBlock(plainText, fontSize, fontFamily, weight, innerMaxWidth, lineHeight);

  const blockWidth = textBlock.width + padding * 2;
  const blockHeight = textBlock.height + padding * 2;

  // Vị trí
  const pos = computePosition(position, canvasWidth, canvasHeight, blockWidth, blockHeight, offsetX, offsetY);

  // Vẽ background nếu có
  if (bgColor && bgColor !== 'transparent') {
    const shape = bgShape ?? 'rectangle';
    drawBackgroundShape(ctx, shape, bgColor, pos.x, pos.y, blockWidth, blockHeight, borderRadius);
  }

  // Typewriter: tính số ký tự visible (dùng plainText length)
  const isTypewriter = element.animation?.type === 'typewriter' && animState;
  let visibleChars = Infinity;
  if (isTypewriter) {
    const totalChars = plainText.length;
    visibleChars = Math.floor(animState.scale * totalChars); // scale = progress 0→1
  }

  // Vẽ text
  ctx.save();
  // Dùng 'middle' baseline → text luôn centered trong line slot
  ctx.textBaseline = 'middle';

  // Apply opacity
  if (opacity < 1) {
    ctx.globalAlpha = opacity;
  }

  // Prepare gradient fillStyle nếu có
  const gradientFill = gradient
    ? createGradient(ctx, gradient, pos.x, pos.y, blockWidth, blockHeight)
    : null;

  const lineHeightPx = fontSize * lineHeight;
  const lines = textBlock.lines;

  let charsSoFar = 0;
  let plainTextOffset = 0;

  for (let i = 0; i < lines.length; i++) {
    let lineText = lines[i];
    const originalLineLength = lineText.length;

    // Typewriter: cắt text theo số ký tự visible
    if (isTypewriter) {
      if (charsSoFar >= visibleChars) break;
      const remaining = visibleChars - charsSoFar;
      if (remaining < lineText.length) {
        lineText = lineText.substring(0, remaining);
      }
      charsSoFar += lines[i].length;
    }

    let lineX = pos.x + padding;
    const lineY = pos.y + padding + i * lineHeightPx + fontSize / 2;

    // Text align
    if (textAlign === 'center') {
      const lineWidth = ctx.measureText(lines[i]).width;
      lineX = pos.x + padding + (textBlock.width - lineWidth) / 2;
    } else if (textAlign === 'right') {
      const lineWidth = ctx.measureText(lines[i]).width;
      lineX = pos.x + padding + (textBlock.width - lineWidth);
    }

    // Glow effect
    if (glow) {
      ctx.save();
      ctx.shadowColor = glow.color;
      ctx.fillStyle = glow.color;
      const passes = [glow.blur * 0.3, glow.blur * 0.6, glow.blur];
      for (const blur of passes) {
        ctx.shadowBlur = blur;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.fillText(lineText, lineX, lineY);
      }
      ctx.restore();
    }

    // Stroke (outline)
    if (strokeWidth > 0) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth * 2;
      ctx.lineJoin = 'round';
      ctx.miterLimit = 2;
      ctx.strokeText(lineText, lineX, lineY);
    }

    // Fill text
    if (isMultiColor && colorSegments) {
      renderColoredLine(ctx, lineText, lineX, lineY, plainTextOffset, colorSegments, color, gradientFill as string | null);
    } else {
      ctx.fillStyle = gradientFill ? (gradientFill as unknown as string) : color;
      ctx.fillText(lineText, lineX, lineY);
    }

    // Update plain text offset for next line
    plainTextOffset += originalLineLength;
    if (i < lines.length - 1) {
      const nextChar = plainText[plainTextOffset];
      if (nextChar === '\n') {
        plainTextOffset++;
      } else if (nextChar === ' ') {
        plainTextOffset++;
      }
    }
  }

  ctx.restore();
}

// ==================== RICH TEXT PAINT ====================

/**
 * Vẽ rich text (mỗi segment có style riêng) lên canvas
 */
function paintRichText(
  ctx: CanvasRenderingContext2D,
  element: TextElement,
  segments: RichTextSegment[],
  canvasWidth: number,
  canvasHeight: number,
  currentTime: number,
  sceneDuration: number,
  animState?: ElementAnimationState
): void {
  const {
    fontSize = 48,
    fontFamily = 'sans-serif',
    fontWeight = 400,
    color = '#FFFFFF',
    bgColor,
    position = 'center',
    textAlign = 'center',
    lineHeight = 1.3,
    padding = 10,
    maxWidth,
    offsetX = 0,
    offsetY = 0,
    borderRadius = 0,
    opacity = 1,
    bgShape,
  } = element;

  const weight = normalizeFontWeight(fontWeight);

  // Resolve segments thành rich words
  const richWords = resolveRichWords(ctx, segments, { fontSize, fontFamily, fontWeight: weight, color });

  // Tính maxWidth
  let effectiveMaxWidth: number;
  if (typeof maxWidth === 'number') {
    effectiveMaxWidth = maxWidth;
  } else if (typeof maxWidth === 'string' && maxWidth.endsWith('%')) {
    effectiveMaxWidth = (parseFloat(maxWidth) / 100) * canvasWidth;
  } else {
    effectiveMaxWidth = canvasWidth * 0.9;
  }

  const innerMaxWidth = effectiveMaxWidth - padding * 2;

  // Word wrap
  const lineIndices = wrapRichWords(richWords, innerMaxWidth);

  // Dùng max fontSize trong tất cả segments để tính lineHeight
  let maxFontSize = fontSize;
  for (const seg of segments) {
    if (seg.fontSize && seg.fontSize > maxFontSize) maxFontSize = seg.fontSize;
  }
  const lineHeightPx = maxFontSize * lineHeight;

  // Tính kích thước mỗi line
  const lineWidths: number[] = [];
  let maxLineWidth = 0;
  for (const lineIdx of lineIndices) {
    let w = 0;
    for (const wi of lineIdx) {
      w += richWords[wi].width;
    }
    lineWidths.push(w);
    maxLineWidth = Math.max(maxLineWidth, w);
  }

  const blockWidth = maxLineWidth + padding * 2;
  const textBlockHeight = lineIndices.length === 1 ? maxFontSize : (lineIndices.length - 1) * lineHeightPx + maxFontSize;
  const blockHeight = textBlockHeight + padding * 2;

  // Vị trí
  const pos = computePosition(position, canvasWidth, canvasHeight, blockWidth, blockHeight, offsetX, offsetY);

  // Background
  if (bgColor && bgColor !== 'transparent') {
    const shape = bgShape ?? 'rectangle';
    drawBackgroundShape(ctx, shape, bgColor, pos.x, pos.y, blockWidth, blockHeight, borderRadius);
  }

  // Vẽ text
  ctx.save();
  ctx.textBaseline = 'middle';

  if (opacity < 1) {
    ctx.globalAlpha = opacity;
  }

  for (let lineIdx = 0; lineIdx < lineIndices.length; lineIdx++) {
    const wordIndices = lineIndices[lineIdx];
    const lineW = lineWidths[lineIdx];
    const lineY = pos.y + padding + lineIdx * lineHeightPx + maxFontSize / 2;

    // Text align
    let startX: number;
    if (textAlign === 'center') {
      startX = pos.x + padding + (maxLineWidth - lineW) / 2;
    } else if (textAlign === 'right') {
      startX = pos.x + padding + (maxLineWidth - lineW);
    } else {
      startX = pos.x + padding;
    }

    let cursorX = startX;

    for (const wi of wordIndices) {
      const word = richWords[wi];

      // Set font cho word
      ctx.font = buildFontString(word.fontWeight, word.fontSize, word.fontFamily);

      // Segment background highlight
      if (word.bgColor && word.text.trim().length > 0) {
        ctx.save();
        ctx.fillStyle = word.bgColor;
        const hPad = 2;
        const vPad = 2;
        ctx.fillRect(cursorX - hPad, lineY - word.fontSize / 2 - vPad, word.width + hPad * 2, word.fontSize + vPad * 2);
        ctx.restore();
      }

      // Stroke per-segment
      const segStrokeWidth = word.strokeWidth ?? element.strokeWidth ?? 0;
      const segStrokeColor = word.strokeColor ?? element.strokeColor ?? '#000000';
      if (segStrokeWidth > 0) {
        ctx.strokeStyle = segStrokeColor;
        ctx.lineWidth = segStrokeWidth * 2;
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.strokeText(word.text, cursorX, lineY);
      }

      // Fill
      ctx.fillStyle = word.color;
      ctx.fillText(word.text, cursorX, lineY);

      // Underline
      if (word.underline && word.text.trim().length > 0) {
        ctx.save();
        ctx.strokeStyle = word.color;
        ctx.lineWidth = Math.max(1, word.fontSize * 0.05);
        const underlineY = lineY + word.fontSize / 2 + 2;
        ctx.beginPath();
        ctx.moveTo(cursorX, underlineY);
        ctx.lineTo(cursorX + word.width, underlineY);
        ctx.stroke();
        ctx.restore();
      }

      cursorX += word.width;
    }
  }

  ctx.restore();
}

// ==================== LEGACY COLOR TAG RENDERING ====================

/**
 * Render một dòng text với multi-color segments (legacy <color> tags)
 */
function renderColoredLine(
  ctx: CanvasRenderingContext2D,
  lineText: string,
  startX: number,
  y: number,
  plainTextOffset: number,
  segments: ColoredSegment[],
  defaultColor: string,
  gradientFill: string | null
): void {
  let currentX = startX;
  let lineCharIndex = 0;

  // Build a map of plain text index → color
  let globalIndex = 0;
  const colorMap: (string | null)[] = [];
  for (const seg of segments) {
    for (let i = 0; i < seg.text.length; i++) {
      colorMap[globalIndex++] = seg.color;
    }
  }

  // Group consecutive characters with same color
  let currentColor = colorMap[plainTextOffset + lineCharIndex] ?? null;
  let currentSegment = '';

  for (let i = 0; i < lineText.length; i++) {
    const charColor = colorMap[plainTextOffset + i] ?? null;

    if (charColor === currentColor) {
      currentSegment += lineText[i];
    } else {
      // Render previous segment
      if (currentSegment) {
        ctx.fillStyle = currentColor ?? (gradientFill || defaultColor);
        ctx.fillText(currentSegment, currentX, y);
        currentX += ctx.measureText(currentSegment).width;
      }
      // Start new segment
      currentColor = charColor;
      currentSegment = lineText[i];
    }
  }

  // Render last segment
  if (currentSegment) {
    ctx.fillStyle = currentColor ?? (gradientFill || defaultColor);
    ctx.fillText(currentSegment, currentX, y);
  }
}
