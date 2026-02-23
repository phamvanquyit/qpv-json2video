import { CanvasRenderingContext2D } from 'canvas';
import { CaptionElement, WordHighlightStyle } from '../../types';
import { computePosition } from '../utils';

interface SrtEntry {
  startMs: number;
  endMs: number;
  text: string;
}

/** Một từ đã được phân bổ timing */
interface WordTiming {
  word: string;
  startMs: number;
  endMs: number;
}

/**
 * OPTIMIZATION: Cache parsed SRT results per content string
 * Tránh parse regex mỗi frame (rất tốn cho video 420 frames)
 */
const srtParseCache = new Map<string, SrtEntry[]>();

/**
 * OPTIMIZATION: Cache word timings per SRT entry (by startMs+endMs key)
 */
const wordTimingCache = new Map<string, WordTiming[]>();

/**
 * OPTIMIZATION: Cache word wrap layout per content
 * Key: font+words+maxWidth → { lineWordIndices, lineWidths, maxLineWidth, wordWidths }
 * Tránh gọi measureText cho mọi từ mỗi frame (khi caption text không đổi)
 */
interface WordWrapLayout {
  lineWordIndices: number[][];
  lineWidths: number[];
  maxLineWidth: number;
  wordWidths: number[];
  spaceWidth: number;
}
const wordWrapLayoutCache = new Map<string, WordWrapLayout>();

/**
 * Parse SRT content thành mảng entries
 * OPTIMIZATION: Cache result per content string
 */
function parseSrt(content: string): SrtEntry[] {
  // Check cache
  const cached = srtParseCache.get(content);
  if (cached) return cached;

  const entries: SrtEntry[] = [];
  const blocks = content.trim().split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue;

    // Line 2: timestamp (00:00:01,000 --> 00:00:04,000)
    const timeMatch = lines[1].match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);

    if (!timeMatch) continue;

    const startMs =
      parseInt(timeMatch[1]) * 3600000 + parseInt(timeMatch[2]) * 60000 + parseInt(timeMatch[3]) * 1000 + parseInt(timeMatch[4]);

    const endMs =
      parseInt(timeMatch[5]) * 3600000 + parseInt(timeMatch[6]) * 60000 + parseInt(timeMatch[7]) * 1000 + parseInt(timeMatch[8]);

    // Line 3+: text
    const text = lines.slice(2).join(' ').trim();

    entries.push({ startMs, endMs, text });
  }

  // Cache result
  srtParseCache.set(content, entries);
  return entries;
}

/**
 * Phân bổ timing cho từng từ trong 1 SRT entry.
 * Dùng proportional theo character count (từ dài → thời gian nhiều hơn).
 * OPTIMIZATION: Cache result per entry key
 */
function distributeWordTimings(entry: SrtEntry): WordTiming[] {
  // Cache key phải bao gồm text, vì nhiều SRT entries có cùng timing nhưng text khác
  const cacheKey = `${entry.startMs}-${entry.endMs}-${entry.text}`;
  const cached = wordTimingCache.get(cacheKey);
  if (cached) return cached;

  const words = entry.text.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return [];

  const totalChars = words.reduce((sum, w) => sum + w.length, 0);
  const totalDuration = entry.endMs - entry.startMs;

  const timings: WordTiming[] = [];
  let currentMs = entry.startMs;

  for (let i = 0; i < words.length; i++) {
    const proportion = words[i].length / totalChars;
    const wordDuration = i === words.length - 1
      ? (entry.endMs - currentMs) // last word takes remaining time
      : Math.round(totalDuration * proportion);

    timings.push({
      word: words[i],
      startMs: currentMs,
      endMs: currentMs + wordDuration,
    });
    currentMs += wordDuration;
  }

  // Cache result
  wordTimingCache.set(cacheKey, timings);
  return timings;
}

/**
 * Word-wrap cho mảng words, trả về mảng lines — mỗi line là mảng word indices.
 * Dùng để biết word nào nằm trên dòng nào.
 */
function wrapWords(
  ctx: CanvasRenderingContext2D,
  words: string[],
  maxWidth: number
): number[][] {
  const lines: number[][] = [];
  let currentLine: number[] = [];
  let currentWidth = 0;
  const spaceWidth = ctx.measureText(' ').width;

  for (let i = 0; i < words.length; i++) {
    const wordWidth = ctx.measureText(words[i]).width;
    const neededWidth = currentLine.length > 0 ? spaceWidth + wordWidth : wordWidth;

    if (currentWidth + neededWidth > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = [i];
      currentWidth = wordWidth;
    } else {
      currentLine.push(i);
      currentWidth += neededWidth;
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [[]];
}

/**
 * OPTIMIZATION: Word-wrap dùng pre-computed word widths
 * Tránh gọi ctx.measureText() — dùng cho cached layout path
 */
function wrapWordsWithWidths(
  wordWidths: number[],
  spaceWidth: number,
  maxWidth: number
): number[][] {
  const lines: number[][] = [];
  let currentLine: number[] = [];
  let currentWidth = 0;

  for (let i = 0; i < wordWidths.length; i++) {
    const ww = wordWidths[i];
    const neededWidth = currentLine.length > 0 ? spaceWidth + ww : ww;

    if (currentWidth + neededWidth > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = [i];
      currentWidth = ww;
    } else {
      currentLine.push(i);
      currentWidth += neededWidth;
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [[]];
}

/**
 * Vẽ caption element lên canvas — hỗ trợ word-level highlight
 */
export function paintCaption(
  ctx: CanvasRenderingContext2D,
  element: CaptionElement,
  canvasWidth: number,
  canvasHeight: number,
  currentTime: number // giây, tương đối so với scene
): void {
  const {
    srtContent,
    fontFamily = 'sans-serif',
    fontSize = 52,
    color = '#FFFFFF',
    strokeColor = '#000000',
    strokeWidth = 4,
    backgroundColor = 'rgba(0, 0, 0, 0.8)',
    position = 'bottom-center',
    maxWidth = '90%',
    lineHeight = 1.3,
    textAlign = 'center',
    offsetX = 0,
    offsetY = -60,
    borderRadius = 12,
    start = 0,
    opacity = 1,
    // Word highlight options
    wordHighlight = false,
    highlightColor = '#FFD700',
    highlightBgColor = 'rgba(255, 215, 0, 0.3)',
    highlightStyle = 'color' as WordHighlightStyle,
    highlightScale = 1.15,
  } = element;

  if (!srtContent?.trim()) return;

  const entries = parseSrt(srtContent);
  const currentTimeMs = (currentTime + start) * 1000;

  // Tìm caption đang active
  const activeEntry = entries.find((e) => currentTimeMs >= e.startMs && currentTimeMs <= e.endMs);

  if (!activeEntry) return;

  // Tính maxWidth
  let effectiveMaxWidth: number;
  if (typeof maxWidth === 'string' && maxWidth.endsWith('%')) {
    effectiveMaxWidth = (parseFloat(maxWidth) / 100) * canvasWidth;
  } else {
    effectiveMaxWidth = canvasWidth * 0.9;
  }

  const padding = 16;
  const innerMaxWidth = effectiveMaxWidth - padding * 2;

  ctx.save();

  // Apply opacity
  if (opacity < 1) {
    ctx.globalAlpha = opacity;
  }

  if (!wordHighlight) {
    // ===== LEGACY MODE: vẽ cả câu (không highlight từ) =====
    paintSentenceMode(ctx, activeEntry.text, {
      fontFamily, fontSize, color, strokeColor, strokeWidth,
      backgroundColor, position, textAlign, offsetX, offsetY,
      borderRadius, padding, innerMaxWidth, canvasWidth, canvasHeight, lineHeight,
    });
  } else {
    // ===== WORD HIGHLIGHT MODE =====
    const wordTimings = distributeWordTimings(activeEntry);
    paintWordHighlightMode(ctx, wordTimings, currentTimeMs, {
      fontFamily, fontSize, color, strokeColor, strokeWidth,
      backgroundColor, position, textAlign, offsetX, offsetY,
      borderRadius, padding, innerMaxWidth, canvasWidth, canvasHeight, lineHeight,
      highlightColor, highlightBgColor, highlightStyle, highlightScale,
    });
  }

  ctx.restore();
}

/** Shared paint options */
interface PaintOptions {
  fontFamily: string;
  fontSize: number;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  backgroundColor: string;
  position: string;
  textAlign: string;
  offsetX: number;
  offsetY: number;
  borderRadius: number;
  padding: number;
  innerMaxWidth: number;
  canvasWidth: number;
  canvasHeight: number;
  lineHeight: number;
}

interface WordHighlightOptions extends PaintOptions {
  highlightColor: string;
  highlightBgColor: string;
  highlightStyle: WordHighlightStyle;
  highlightScale: number;
}

// ==================== SENTENCE MODE (legacy, giữ nguyên) ====================

function paintSentenceMode(
  ctx: CanvasRenderingContext2D,
  text: string,
  opts: PaintOptions
): void {
  ctx.font = `700 ${opts.fontSize}px "${opts.fontFamily}"`;
  ctx.textBaseline = 'top';

  const lines = wrapTextSimple(ctx, text, opts.innerMaxWidth);
  const lineHeightPx = opts.fontSize * opts.lineHeight;

  let maxLineWidth = 0;
  for (const line of lines) {
    maxLineWidth = Math.max(maxLineWidth, ctx.measureText(line).width);
  }

  const blockWidth = maxLineWidth + opts.padding * 2;
  const textBlockHeight = lines.length === 1 ? opts.fontSize : (lines.length - 1) * lineHeightPx + opts.fontSize;
  const blockHeight = textBlockHeight + opts.padding * 2;

  const pos = computePosition(
    opts.position as any, opts.canvasWidth, opts.canvasHeight,
    blockWidth, blockHeight, opts.offsetX, opts.offsetY
  );

  // Background
  drawBackground(ctx, pos.x, pos.y, blockWidth, blockHeight, opts.backgroundColor, opts.borderRadius);

  // Text
  for (let i = 0; i < lines.length; i++) {
    let lineX = pos.x + opts.padding;
    const lineY = pos.y + opts.padding + i * lineHeightPx;

    if (opts.textAlign === 'center') {
      const lw = ctx.measureText(lines[i]).width;
      lineX = pos.x + opts.padding + (maxLineWidth - lw) / 2;
    } else if (opts.textAlign === 'right') {
      const lw = ctx.measureText(lines[i]).width;
      lineX = pos.x + opts.padding + (maxLineWidth - lw);
    }

    drawTextWithStroke(ctx, lines[i], lineX, lineY, opts.color, opts.strokeColor, opts.strokeWidth);
  }
}

// ==================== WORD HIGHLIGHT MODE ====================

function paintWordHighlightMode(
  ctx: CanvasRenderingContext2D,
  wordTimings: WordTiming[],
  currentTimeMs: number,
  opts: WordHighlightOptions
): void {
  const words = wordTimings.map(w => w.word);

  ctx.font = `700 ${opts.fontSize}px "${opts.fontFamily}"`;
  ctx.textBaseline = 'top';

  // OPTIMIZATION: Cache word wrap layout per font+words+maxWidth
  // Vì text không đổi giữa các frame cùng 1 caption entry
  const layoutKey = `${opts.fontSize}|${opts.fontFamily}|${words.join(' ')}|${opts.innerMaxWidth}`;
  let layout = wordWrapLayoutCache.get(layoutKey);

  if (!layout) {
    const spaceWidth = ctx.measureText(' ').width;
    const wordWidths = words.map(w => ctx.measureText(w).width);

    // Word wrap → lines of word indices (dùng pre-computed widths)
    const lineWordIndices = wrapWordsWithWidths(wordWidths, spaceWidth, opts.innerMaxWidth);

    // Tính kích thước từng line
    const lineWidths: number[] = [];
    for (const lineIndices of lineWordIndices) {
      let w = 0;
      for (let j = 0; j < lineIndices.length; j++) {
        if (j > 0) w += spaceWidth;
        w += wordWidths[lineIndices[j]];
      }
      lineWidths.push(w);
    }

    layout = {
      lineWordIndices,
      lineWidths,
      maxLineWidth: Math.max(...lineWidths, 0),
      wordWidths,
      spaceWidth,
    };
    wordWrapLayoutCache.set(layoutKey, layout);
  }

  const { lineWordIndices, lineWidths, maxLineWidth, wordWidths, spaceWidth } = layout;
  const lineHeightPx = opts.fontSize * opts.lineHeight;

  const blockWidth = maxLineWidth + opts.padding * 2;
  const textBlockHeight = lineWordIndices.length === 1 ? opts.fontSize : (lineWordIndices.length - 1) * lineHeightPx + opts.fontSize;
  const blockHeight = textBlockHeight + opts.padding * 2;

  const pos = computePosition(
    opts.position as any, opts.canvasWidth, opts.canvasHeight,
    blockWidth, blockHeight, opts.offsetX, opts.offsetY
  );

  // Background
  drawBackground(ctx, pos.x, pos.y, blockWidth, blockHeight, opts.backgroundColor, opts.borderRadius);

  // Tìm active word index
  const activeWordIndex = wordTimings.findIndex(
    w => currentTimeMs >= w.startMs && currentTimeMs < w.endMs
  );

  // Vẽ từng line, từng word
  for (let lineIdx = 0; lineIdx < lineWordIndices.length; lineIdx++) {
    const lineIndices = lineWordIndices[lineIdx];
    const lineY = pos.y + opts.padding + lineIdx * lineHeightPx;
    const lineW = lineWidths[lineIdx];

    // Tính startX theo textAlign
    let startX: number;
    if (opts.textAlign === 'center') {
      startX = pos.x + opts.padding + (maxLineWidth - lineW) / 2;
    } else if (opts.textAlign === 'right') {
      startX = pos.x + opts.padding + (maxLineWidth - lineW);
    } else {
      startX = pos.x + opts.padding;
    }

    let cursorX = startX;

    for (let j = 0; j < lineIndices.length; j++) {
      const wordIdx = lineIndices[j];
      const word = words[wordIdx];
      const isActive = wordIdx === activeWordIndex;

      if (j > 0) cursorX += spaceWidth;

      // OPTIMIZATION: Dùng pre-computed wordWidth thay vì measureText lại
      const wordWidth = wordWidths[wordIdx];

      if (isActive) {
        drawHighlightedWord(ctx, word, cursorX, lineY, wordWidth, opts);
      } else {
        drawTextWithStroke(ctx, word, cursorX, lineY, opts.color, opts.strokeColor, opts.strokeWidth);
      }

      cursorX += wordWidth;
    }
  }
}

/**
 * Vẽ 1 từ được highlight
 */
function drawHighlightedWord(
  ctx: CanvasRenderingContext2D,
  word: string,
  x: number,
  y: number,
  wordWidth: number,
  opts: WordHighlightOptions
): void {
  const style = opts.highlightStyle;

  if (style === 'background') {
    // Vẽ background highlight cho từ
    const hPad = 4;
    const vPad = 2;
    ctx.fillStyle = opts.highlightBgColor;
    roundRect(ctx, x - hPad, y - vPad, wordWidth + hPad * 2, opts.fontSize + vPad * 2, 6);
    ctx.fill();

    // Vẽ text bằng highlightColor
    drawTextWithStroke(ctx, word, x, y, opts.highlightColor, opts.strokeColor, opts.strokeWidth);
  } else if (style === 'scale') {
    // Phóng to từ active
    const scale = opts.highlightScale;
    const centerX = x + wordWidth / 2;
    const centerY = y + (opts.fontSize * opts.lineHeight) / 2;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(scale, scale);
    ctx.translate(-centerX, -centerY);

    drawTextWithStroke(ctx, word, x, y, opts.highlightColor, opts.strokeColor, opts.strokeWidth);
    ctx.restore();
  } else {
    // style === 'color' (default) — đơn giản đổi màu
    drawTextWithStroke(ctx, word, x, y, opts.highlightColor, opts.strokeColor, opts.strokeWidth);
  }
}

// ==================== SHARED HELPERS ====================

/** Text wrap đơn giản (dùng cho sentence mode) */
function wrapTextSimple(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [''];
}

/** Vẽ text + stroke outline */
function drawTextWithStroke(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fillColor: string,
  strokeColor: string,
  strokeWidth: number
): void {
  if (strokeWidth > 0) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth * 2;
    ctx.lineJoin = 'round';
    ctx.strokeText(text, x, y);
  }

  ctx.fillStyle = fillColor;
  ctx.fillText(text, x, y);
}

/** Vẽ background rounded rect */
function drawBackground(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  bgColor: string,
  borderRadius: number
): void {
  if (!bgColor) return;

  ctx.fillStyle = bgColor;
  if (borderRadius > 0) {
    roundRect(ctx, x, y, w, h, borderRadius);
    ctx.fill();
  } else {
    ctx.fillRect(x, y, w, h);
  }
}

/** Rounded rect path */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Export for testing
export { parseSrt, distributeWordTimings, wrapWords };
