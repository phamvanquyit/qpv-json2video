import { ChildProcess, spawn } from 'child_process';
import * as fs from 'fs';
import { AudioConfig, VideoConfig } from '../types';
import { AssetLoader } from './asset-loader';

/**
 * FFmpegEncoder - Pipe raw frames từ Canvas vào FFmpeg để encode thành MP4
 * Sau đó mix audio tracks vào video
 */
export class FFmpegEncoder {
  private ffmpegProcess: ChildProcess | null = null;

  constructor(
    private readonly config: VideoConfig,
    private readonly fps: number
  ) {}

  /**
   * Tạo FFmpeg process nhận raw video frames qua stdin pipe
   * Output: video-only MP4 (chưa có audio)
   */
  startEncoding(outputPath: string): void {
    const args = [
      '-y', // Overwrite output
      // Input: raw video từ stdin
      '-f',
      'rawvideo',
      '-pix_fmt',
      'bgra', // node-canvas toBuffer('raw') output BGRA
      '-s',
      `${this.config.width}x${this.config.height}`,
      '-r',
      String(this.fps),
      '-i',
      'pipe:0', // stdin

      // Encoding settings
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-crf',
      '23',
      '-pix_fmt',
      'yuv420p', // Compatibility
      '-movflags',
      '+faststart', // Web optimization

      // Output
      outputPath,
    ];

    this.ffmpegProcess = spawn('ffmpeg', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Handle errors
    this.ffmpegProcess.stderr?.on('data', () => {
      // FFmpeg logs to stderr even for normal output, suppress
    });
  }

  /**
   * Ghi 1 frame (raw BGRA buffer) vào FFmpeg stdin
   */
  writeFrame(frameBuffer: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ffmpegProcess?.stdin) {
        reject(new Error('FFmpeg process not started'));
        return;
      }

      const canWrite = this.ffmpegProcess.stdin.write(frameBuffer);
      if (canWrite) {
        resolve();
      } else {
        // Backpressure: đợi drain event
        this.ffmpegProcess.stdin.once('drain', resolve);
      }
    });
  }

  /**
   * Kết thúc encoding (đóng stdin, đợi FFmpeg hoàn thành)
   */
  finishEncoding(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ffmpegProcess) {
        resolve();
        return;
      }

      this.ffmpegProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg exited with code ${code}`));
        }
      });

      this.ffmpegProcess.on('error', reject);

      this.ffmpegProcess.stdin?.end();
    });
  }

  /**
   * Mix audio vào video đã render (từ tất cả tracks)
   * Input: video-only MP4 + audio files
   * Output: final MP4 với audio
   */
  async mixAudio(videoOnlyPath: string, finalOutputPath: string, assetLoader: AssetLoader): Promise<string> {
    const audioInputs = await this.collectAudioInputs(assetLoader);

    if (audioInputs.length === 0) {
      // Không có audio → rename video-only thành final
      fs.renameSync(videoOnlyPath, finalOutputPath);
      return finalOutputPath;
    }

    const args: string[] = ['-y'];

    // Input 0: video
    args.push('-i', videoOnlyPath);

    // Input 1..N: audio files
    for (const audio of audioInputs) {
      args.push('-i', audio.localPath);
    }

    // Build filter complex để mix audio
    const filterParts: string[] = [];
    const audioLabels: string[] = [];

    for (let i = 0; i < audioInputs.length; i++) {
      const audio = audioInputs[i];
      const inputIdx = i + 1; // Input 0 là video
      const label = `a${i}`;

      // Delay audio theo start time (ms), adjust volume
      const delayMs = Math.round((audio.start || 0) * 1000);
      const volume = audio.volume ?? 1;
      const fadeIn = audio.fadeIn || 0;
      const fadeOut = audio.fadeOut || 0;

      let filter = `[${inputIdx}:a]`;

      // Trim duration nếu có
      if (audio.duration) {
        filter += `atrim=0:${audio.duration},asetpts=PTS-STARTPTS,`;
      }

      filter += `adelay=${delayMs}|${delayMs},volume=${volume}`;

      // Loop nếu cần
      if (audio.loop) {
        // aloop: loop -1 lần (vô tận), size = 2 giây samples
        filter =
          `[${inputIdx}:a]aloop=loop=-1:size=${this.fps * 2 * 44100}` +
          `,atrim=0:${this.getTotalDuration()}` +
          `,adelay=${delayMs}|${delayMs},volume=${volume}`;
      }

      // Fade in/out
      if (fadeIn > 0) {
        filter += `,afade=t=in:st=0:d=${fadeIn}`;
      }
      if (fadeOut > 0) {
        const audioDur = audio.duration || this.getTotalDuration();
        const fadeOutStart = Math.max(0, audioDur - fadeOut);
        filter += `,afade=t=out:st=${fadeOutStart}:d=${fadeOut}`;
      }

      filter += `[${label}]`;
      filterParts.push(filter);
      audioLabels.push(`[${label}]`);
    }

    // Mix tất cả audio lại
    const mixFilter = `${audioLabels.join('')}amix=inputs=${audioInputs.length}:dropout_transition=0[aout]`;
    filterParts.push(mixFilter);

    args.push('-filter_complex', filterParts.join(';'));
    args.push('-map', '0:v', '-map', '[aout]');
    args.push('-c:v', 'copy'); // Copy video stream (không re-encode)
    args.push('-c:a', 'aac', '-b:a', '192k');
    args.push('-shortest'); // Kết thúc khi stream ngắn nhất xong
    args.push(finalOutputPath);

    return new Promise((resolve, reject) => {
      const proc = spawn('ffmpeg', args, { stdio: 'pipe' });

      proc.on('close', (code) => {
        // Cleanup video-only file
        if (fs.existsSync(videoOnlyPath)) {
          fs.unlinkSync(videoOnlyPath);
        }

        if (code === 0) {
          resolve(finalOutputPath);
        } else {
          reject(new Error(`FFmpeg audio mix exited with code ${code}`));
        }
      });

      proc.on('error', reject);
    });
  }

  /**
   * Thu thập tất cả audio inputs từ tracks
   */
  private async collectAudioInputs(assetLoader: AssetLoader): Promise<Array<AudioConfig & { localPath: string }>> {
    const audioInputs: Array<AudioConfig & { localPath: string }> = [];

    for (const track of this.config.tracks) {
      const trackStart = track.start || 0;
      let sceneStartInTrack = 0;

      for (const scene of track.scenes) {
        if (scene.audio?.url) {
          const asset = await assetLoader.downloadAsset(scene.audio.url, 'audio');
          audioInputs.push({
            ...scene.audio,
            start: trackStart + sceneStartInTrack + (scene.audio.start || 0),
            localPath: asset.localPath,
          });
        }
        sceneStartInTrack += scene.duration;
      }
    }

    return audioInputs;
  }

  /**
   * Tổng thời lượng video (giây)
   */
  private getTotalDuration(): number {
    return this.config.tracks.reduce((maxEnd, track) => {
      const trackStart = track.start || 0;
      const trackDuration = track.scenes.reduce((sum, s) => sum + s.duration, 0);
      return Math.max(maxEnd, trackStart + trackDuration);
    }, 0);
  }
}
