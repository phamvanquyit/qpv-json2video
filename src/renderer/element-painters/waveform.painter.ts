import type { SKRSContext2D as CanvasRenderingContext2D } from '@napi-rs/canvas';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { WaveformElement } from '../../types';
import { computePosition } from '../utils';
import { AssetLoader } from '../asset-loader';

/**
 * Audio waveform data extracted from audio file via FFmpeg.
 * Cached per audioUrl to avoid re-extraction.
 */
interface WaveformData {
  /** Normalized amplitude samples (0-1), evenly distributed over audio duration */
  samples: Float32Array;
  /** Audio duration in seconds */
  duration: number;
}

/**
 * Cache waveform data per audioUrl — extract 1 lần, dùng lại mọi frame
 */
const waveformCache = new Map<string, WaveformData>();

/**
 * Clear waveform cache (gọi khi cleanup)
 */
export function clearWaveformCache(): void {
  waveformCache.clear();
}

/**
 * Extract audio waveform data using FFmpeg.
 * Uses astats filter to get per-frame peak levels, then normalizes to 0-1 range.
 * 
 * @param audioLocalPath - Local path to audio file
 * @param sampleCount - Number of samples to extract (determines detail level)
 * @returns WaveformData with normalized samples
 */
function extractWaveformData(audioLocalPath: string, sampleCount: number = 256): WaveformData {
  // Get audio duration
  const durationStr = execSync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioLocalPath}"`,
    { timeout: 10000, encoding: 'utf-8' }
  ).trim();
  const duration = parseFloat(durationStr);

  if (isNaN(duration) || duration <= 0) {
    return { samples: new Float32Array(sampleCount).fill(0.5), duration: 1 };
  }

  // Use FFmpeg to extract raw PCM samples, then downsample
  // Extract as s16le mono → read raw bytes → compute amplitudes
  const rawPcmPath = audioLocalPath + '.pcm';
  try {
    // Convert to raw PCM: mono, 16-bit signed, sample rate adjusted for our desired samples
    // We want ~sampleCount samples across the entire duration
    // Use a sample rate that gives us roughly sampleCount * samplesPerChunk total samples
    const samplesPerChunk = 256;
    const targetSampleRate = Math.max(100, Math.ceil((sampleCount * samplesPerChunk) / duration));

    execSync(
      `ffmpeg -y -i "${audioLocalPath}" -ac 1 -ar ${targetSampleRate} -f s16le -acodec pcm_s16le "${rawPcmPath}" 2>/dev/null`,
      { timeout: 30000 }
    );

    const rawData = fs.readFileSync(rawPcmPath);
    const totalSamples = rawData.length / 2; // 16-bit = 2 bytes per sample

    if (totalSamples === 0) {
      return { samples: new Float32Array(sampleCount).fill(0.5), duration };
    }

    // Downsample: divide raw samples into sampleCount buckets, take RMS of each
    const samplesPerBucket = Math.max(1, Math.floor(totalSamples / sampleCount));
    const result = new Float32Array(sampleCount);
    let maxAmplitude = 0;

    for (let i = 0; i < sampleCount; i++) {
      const startIdx = Math.floor(i * totalSamples / sampleCount);
      const endIdx = Math.min(startIdx + samplesPerBucket, totalSamples);

      let sumSquares = 0;
      let count = 0;

      for (let j = startIdx; j < endIdx; j++) {
        const sample = rawData.readInt16LE(j * 2);
        sumSquares += sample * sample;
        count++;
      }

      const rms = count > 0 ? Math.sqrt(sumSquares / count) : 0;
      result[i] = rms;
      maxAmplitude = Math.max(maxAmplitude, rms);
    }

    // Normalize to 0-1
    if (maxAmplitude > 0) {
      for (let i = 0; i < sampleCount; i++) {
        result[i] = result[i] / maxAmplitude;
      }
    }

    return { samples: result, duration };
  } finally {
    // Cleanup temp file
    try {
      if (fs.existsSync(rawPcmPath)) fs.unlinkSync(rawPcmPath);
    } catch { /* ignore */ }
  }
}

/**
 * Get or extract waveform data for an audio URL.
 * Uses cache to avoid re-extraction.
 */
async function getWaveformData(
  audioUrl: string,
  assetLoader: AssetLoader,
  barCount: number
): Promise<WaveformData> {
  const cacheKey = `${audioUrl}:${barCount}`;
  if (waveformCache.has(cacheKey)) {
    return waveformCache.get(cacheKey)!;
  }

  // Download audio file
  const asset = await assetLoader.downloadAsset(audioUrl, 'audio');
  const data = extractWaveformData(asset.localPath, barCount);
  waveformCache.set(cacheKey, data);
  return data;
}

/**
 * Vẽ waveform element lên canvas.
 * 
 * Styles:
 * - 'bars': vertical bars (equalizer-style)
 * - 'line': continuous line waveform
 * - 'mirror': mirrored bars (top + bottom, centered)
 * - 'circle': circular waveform (bars emanating from center)
 * 
 * @param ctx - Canvas 2D context
 * @param element - WaveformElement config
 * @param canvasWidth - Canvas width (px)
 * @param canvasHeight - Canvas height (px)
 * @param assetLoader - Asset loader for downloading audio
 * @param timeInElement - Current time within element (seconds)
 * @param elementDuration - Total element duration (seconds)
 */
export async function paintWaveform(
  ctx: CanvasRenderingContext2D,
  element: WaveformElement,
  canvasWidth: number,
  canvasHeight: number,
  assetLoader: AssetLoader,
  timeInElement: number,
  elementDuration: number,
): Promise<void> {
  const {
    width,
    height,
    position = 'center',
    offsetX = 0,
    offsetY = 0,
    opacity = 1,
    audioUrl,
    style = 'bars',
    color = '#4ECDC4',
    secondaryColor,
    barCount = 64,
    barWidth,
    barGap = 2,
    barRadius = 2,
    lineWidth = 2,
    sensitivity = 1,
    smoothing = 0.3,
    mirror = false,
    gradient: gradientConfig,
  } = element;

  // Get waveform data
  const waveformData = await getWaveformData(audioUrl, assetLoader, barCount);

  ctx.save();

  if (opacity < 1) {
    ctx.globalAlpha = opacity;
  }

  const pos = computePosition(position, canvasWidth, canvasHeight, width, height, offsetX, offsetY);

  // Calculate current playback position in the audio
  const audioDuration = waveformData.duration;
  const audioProgress = Math.min(timeInElement / audioDuration, 1);

  // Apply sensitivity and get visible range of samples
  const samples = waveformData.samples;

  // Create gradient fill if configured
  let fillStyle: string | any = color;
  if (gradientConfig && gradientConfig.colors.length >= 2) {
    const grad = ctx.createLinearGradient(pos.x, pos.y + height, pos.x, pos.y);
    const colors = gradientConfig.colors;
    for (let i = 0; i < colors.length; i++) {
      grad.addColorStop(i / (colors.length - 1), colors[i]);
    }
    fillStyle = grad as unknown as string;
  }

  switch (style) {
    case 'bars':
      paintBars(ctx, pos.x, pos.y, width, height, samples, audioProgress, audioDuration,
        elementDuration, fillStyle, barCount, barWidth, barGap, barRadius, sensitivity, smoothing, false);
      break;

    case 'mirror':
      paintBars(ctx, pos.x, pos.y, width, height, samples, audioProgress, audioDuration,
        elementDuration, fillStyle, barCount, barWidth, barGap, barRadius, sensitivity, smoothing, true);
      break;

    case 'line':
      paintLine(ctx, pos.x, pos.y, width, height, samples, audioProgress, audioDuration,
        elementDuration, fillStyle, secondaryColor, lineWidth, sensitivity, smoothing);
      break;

    case 'circle':
      paintCircle(ctx, pos.x, pos.y, width, height, samples, audioProgress, audioDuration,
        elementDuration, fillStyle, barCount, sensitivity, smoothing);
      break;
  }

  ctx.restore();
}

/**
 * Compute amplitude for a bar/sample at current time.
 * Simulates animation by using the waveform data + time-based modulation.
 */
function getAnimatedAmplitude(
  samples: Float32Array,
  barIndex: number,
  totalBars: number,
  audioProgress: number,
  audioDuration: number,
  elementDuration: number,
  sensitivity: number,
  smoothing: number,
): number {
  // Map bar index to sample index based on current audio playback progress
  // Show a "window" of the waveform centered on current playback position
  const windowSize = Math.max(1, Math.floor(samples.length * 0.15)); // 15% of total samples visible
  const centerSampleIdx = Math.floor(audioProgress * samples.length);

  // Map bar to sample within the visible window
  const sampleOffset = (barIndex / totalBars - 0.5) * windowSize;
  let sampleIdx = Math.floor(centerSampleIdx + sampleOffset);
  sampleIdx = Math.max(0, Math.min(samples.length - 1, sampleIdx));

  // Get base amplitude with smoothing (average nearby samples)
  let amplitude = 0;
  const smoothRange = Math.max(1, Math.floor(smoothing * 5));
  let smoothCount = 0;

  for (let s = -smoothRange; s <= smoothRange; s++) {
    const idx = Math.max(0, Math.min(samples.length - 1, sampleIdx + s));
    amplitude += samples[idx];
    smoothCount++;
  }
  amplitude /= smoothCount;

  // Apply sensitivity
  amplitude = Math.min(1, amplitude * sensitivity);

  // Add subtle time-based animation to make it feel alive
  const time = audioProgress * audioDuration;
  const wobble = Math.sin(time * 8 + barIndex * 0.5) * 0.08 +
                 Math.sin(time * 13 + barIndex * 0.3) * 0.05;
  amplitude = Math.max(0.02, Math.min(1, amplitude + wobble));

  return amplitude;
}

/**
 * Paint "bars" style waveform (equalizer-style vertical bars)
 */
function paintBars(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  samples: Float32Array,
  audioProgress: number,
  audioDuration: number,
  elementDuration: number,
  fillStyle: string | any,
  barCount: number,
  barWidthOverride: number | undefined,
  barGap: number,
  barRadius: number,
  sensitivity: number,
  smoothing: number,
  isMirror: boolean,
): void {
  const totalGap = barGap * (barCount - 1);
  const computedBarWidth = barWidthOverride || Math.max(1, (w - totalGap) / barCount);

  ctx.fillStyle = fillStyle as string;

  for (let i = 0; i < barCount; i++) {
    const amplitude = getAnimatedAmplitude(
      samples, i, barCount, audioProgress, audioDuration, elementDuration, sensitivity, smoothing
    );

    const barX = x + i * (computedBarWidth + barGap);

    if (isMirror) {
      // Mirror: bars extend from center both up and down
      const barH = (h / 2) * amplitude;
      const centerY = y + h / 2;

      // Top half
      drawRoundedBar(ctx, barX, centerY - barH, computedBarWidth, barH, barRadius);
      // Bottom half  
      drawRoundedBar(ctx, barX, centerY, computedBarWidth, barH, barRadius);
    } else {
      // Normal: bars grow from bottom up
      const barH = h * amplitude;
      const barY = y + h - barH;
      drawRoundedBar(ctx, barX, barY, computedBarWidth, barH, barRadius);
    }
  }
}

/**
 * Draw a single rounded bar
 */
function drawRoundedBar(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  radius: number,
): void {
  if (h <= 0 || w <= 0) return;

  const r = Math.min(radius, w / 2, h / 2);

  if (r <= 0) {
    ctx.fillRect(x, y, w, h);
    return;
  }

  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
  ctx.fill();
}

/**
 * Paint "line" style waveform (continuous smooth line)
 */
function paintLine(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  samples: Float32Array,
  audioProgress: number,
  audioDuration: number,
  elementDuration: number,
  strokeStyle: string | any,
  fillBelowColor: string | undefined,
  lineW: number,
  sensitivity: number,
  smoothing: number,
): void {
  const pointCount = Math.min(samples.length, Math.floor(w / 2));
  const points: { px: number; py: number }[] = [];

  for (let i = 0; i < pointCount; i++) {
    const amplitude = getAnimatedAmplitude(
      samples, i, pointCount, audioProgress, audioDuration, elementDuration, sensitivity, smoothing
    );

    const px = x + (i / (pointCount - 1)) * w;
    const py = y + h - amplitude * h;
    points.push({ px, py });
  }

  if (points.length < 2) return;

  // Draw filled area below line
  if (fillBelowColor) {
    ctx.beginPath();
    ctx.moveTo(points[0].px, y + h);
    for (const pt of points) {
      ctx.lineTo(pt.px, pt.py);
    }
    ctx.lineTo(points[points.length - 1].px, y + h);
    ctx.closePath();
    ctx.fillStyle = fillBelowColor;
    ctx.fill();
  }

  // Draw the line with smooth curves (quadratic Bézier)
  ctx.beginPath();
  ctx.moveTo(points[0].px, points[0].py);

  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    const midX = (current.px + next.px) / 2;
    const midY = (current.py + next.py) / 2;
    ctx.quadraticCurveTo(current.px, current.py, midX, midY);
  }

  // Last point
  const last = points[points.length - 1];
  ctx.lineTo(last.px, last.py);

  ctx.strokeStyle = strokeStyle as string;
  ctx.lineWidth = lineW;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

/**
 * Paint "circle" style waveform (bars emanating from center in a circle)
 */
function paintCircle(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  samples: Float32Array,
  audioProgress: number,
  audioDuration: number,
  elementDuration: number,
  fillStyle: string | any,
  barCount: number,
  sensitivity: number,
  smoothing: number,
): void {
  const centerX = x + w / 2;
  const centerY = y + h / 2;
  const innerRadius = Math.min(w, h) * 0.2;
  const maxBarLength = Math.min(w, h) * 0.3;

  ctx.fillStyle = fillStyle as string;

  for (let i = 0; i < barCount; i++) {
    const amplitude = getAnimatedAmplitude(
      samples, i, barCount, audioProgress, audioDuration, elementDuration, sensitivity, smoothing
    );

    const angle = (i / barCount) * Math.PI * 2 - Math.PI / 2;
    const barLength = maxBarLength * amplitude;

    const x1 = centerX + Math.cos(angle) * innerRadius;
    const y1 = centerY + Math.sin(angle) * innerRadius;
    const x2 = centerX + Math.cos(angle) * (innerRadius + barLength);
    const y2 = centerY + Math.sin(angle) * (innerRadius + barLength);

    const barW = Math.max(1, (2 * Math.PI * innerRadius) / barCount * 0.6);

    ctx.save();
    ctx.translate(x1, y1);
    ctx.rotate(angle);
    ctx.fillRect(0, -barW / 2, barLength, barW);
    ctx.restore();
  }
}
