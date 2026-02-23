import { execSync } from 'child_process';
import * as os from 'os';

/**
 * Platform detection & optimal encoder selection
 * Tự động detect OS và chọn encoder tối ưu nhất (GPU > CPU)
 */

export type PlatformType = 'macos' | 'linux' | 'windows' | 'unknown';

export interface EncoderConfig {
  /** FFmpeg encoder name */
  encoder: string;
  /** Extra FFmpeg args cho encoder */
  encoderArgs: string[];
  /** Pixel format cho encoder */
  pixelFormat: string;
  /** Mô tả encoder */
  description: string;
  /** Có dùng hardware acceleration không */
  isHardwareAccelerated: boolean;
}

/**
 * Detect platform hiện tại
 */
export function detectPlatform(): PlatformType {
  const platform = os.platform();
  switch (platform) {
    case 'darwin':
      return 'macos';
    case 'linux':
      return 'linux';
    case 'win32':
      return 'windows';
    default:
      return 'unknown';
  }
}

/**
 * OPTIMIZATION: Cache FFmpeg encoder list (chỉ fetch 1 lần)
 */
let cachedEncodersList: string | null = null;

/**
 * Kiểm tra FFmpeg encoder có available không
 * OPTIMIZATION: Dùng cached encoder list thay vì gọi ffmpeg mỗi lần
 */
function isEncoderAvailable(encoderName: string): boolean {
  try {
    if (cachedEncodersList === null) {
      cachedEncodersList = execSync(`ffmpeg -encoders 2>/dev/null`, {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 5000,
      }).toString();
    }
    return cachedEncodersList.includes(encoderName);
  } catch {
    return false;
  }
}

/**
 * OPTIMIZATION: Cache FFmpeg hwaccel methods (chỉ fetch 1 lần)
 */
let cachedHwAccels: string[] | null = null;

/**
 * Kiểm tra FFmpeg hardware acceleration methods
 */
function getHwAccelMethods(): string[] {
  if (cachedHwAccels !== null) return cachedHwAccels;
  try {
    const output = execSync(`ffmpeg -hwaccels 2>/dev/null`, {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000,
    }).toString();
    cachedHwAccels = output
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && line !== 'Hardware acceleration methods:');
    return cachedHwAccels;
  } catch {
    cachedHwAccels = [];
    return cachedHwAccels;
  }
}

/**
 * Chọn encoder tối ưu nhất dựa trên platform
 * Ưu tiên: GPU encoder > CPU encoder
 */
export function selectOptimalEncoder(): EncoderConfig {
  const platform = detectPlatform();
  const hwAccels = getHwAccelMethods();

  // === macOS: VideoToolbox (Apple Silicon / Intel GPU) ===
  if (platform === 'macos') {
    if (hwAccels.includes('videotoolbox') && isEncoderAvailable('h264_videotoolbox')) {
      return {
        encoder: 'h264_videotoolbox',
        encoderArgs: [
          '-c:v', 'h264_videotoolbox',
          // Realtime = false → cho phép encode chậm hơn nhưng chất lượng cao hơn
          '-realtime', '0',
          // Bitrate trung bình cho chất lượng tốt
          '-b:v', '8M',
          // Profile high cho chất lượng cao
          '-profile:v', 'high',
          // Allow B-frames cho compression tốt hơn
          '-bf', '3',
        ],
        pixelFormat: 'nv12', // VideoToolbox prefer NV12
        description: 'macOS VideoToolbox GPU Encoder (H.264)',
        isHardwareAccelerated: true,
      };
    }
  }

  // === Linux: NVIDIA NVENC > VAAPI > CPU ===
  if (platform === 'linux') {
    // Try NVENC first (NVIDIA GPU)
    if (hwAccels.includes('cuda') && isEncoderAvailable('h264_nvenc')) {
      return {
        encoder: 'h264_nvenc',
        encoderArgs: [
          '-c:v', 'h264_nvenc',
          '-preset', 'p4', // balanced quality/speed
          '-b:v', '8M',
          '-profile:v', 'high',
          '-bf', '3',
        ],
        pixelFormat: 'yuv420p',
        description: 'Linux NVIDIA NVENC GPU Encoder (H.264)',
        isHardwareAccelerated: true,
      };
    }

    // Try VAAPI (Intel/AMD GPU)
    if (hwAccels.includes('vaapi') && isEncoderAvailable('h264_vaapi')) {
      return {
        encoder: 'h264_vaapi',
        encoderArgs: [
          '-c:v', 'h264_vaapi',
          '-b:v', '8M',
          '-profile:v', '100', // high profile
        ],
        pixelFormat: 'nv12',
        description: 'Linux VAAPI GPU Encoder (H.264)',
        isHardwareAccelerated: true,
      };
    }
  }

  // === Windows: NVENC > QSV > CPU ===
  if (platform === 'windows') {
    // NVIDIA NVENC
    if (isEncoderAvailable('h264_nvenc')) {
      return {
        encoder: 'h264_nvenc',
        encoderArgs: [
          '-c:v', 'h264_nvenc',
          '-preset', 'p4',
          '-b:v', '8M',
          '-profile:v', 'high',
        ],
        pixelFormat: 'yuv420p',
        description: 'Windows NVIDIA NVENC GPU Encoder (H.264)',
        isHardwareAccelerated: true,
      };
    }

    // Intel Quick Sync Video
    if (isEncoderAvailable('h264_qsv')) {
      return {
        encoder: 'h264_qsv',
        encoderArgs: [
          '-c:v', 'h264_qsv',
          '-preset', 'medium',
          '-b:v', '8M',
          '-profile:v', 'high',
        ],
        pixelFormat: 'nv12',
        description: 'Windows Intel QSV GPU Encoder (H.264)',
        isHardwareAccelerated: true,
      };
    }
  }

  // === Fallback: Software encoding (mọi platform) ===
  return {
    encoder: 'libx264',
    encoderArgs: [
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '23',
    ],
    pixelFormat: 'yuv420p',
    description: 'Software Encoder libx264 (CPU)',
    isHardwareAccelerated: false,
  };
}

/**
 * Cache encoder config (chỉ detect 1 lần)
 */
let cachedConfig: EncoderConfig | null = null;

export function getOptimalEncoder(): EncoderConfig {
  if (!cachedConfig) {
    cachedConfig = selectOptimalEncoder();
  }
  return cachedConfig;
}

/**
 * Reset cache (for testing)
 */
export function resetEncoderCache(): void {
  cachedConfig = null;
  cachedEncodersList = null;
  cachedHwAccels = null;
}
