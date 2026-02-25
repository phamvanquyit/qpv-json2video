declare module 'gif-frames' {
  import { Readable } from 'stream';

  interface GifFrameInfo {
    x: number;
    y: number;
    width: number;
    height: number;
    has_local_palette: boolean;
    palette_offset: number;
    palette_size: number;
    data_offset: number;
    data_length: number;
    transparent_index: number;
    interlaced: boolean;
    delay: number;
    disposal: number;
  }

  interface GifFrameData {
    getImage(): Readable;
    frameIndex: number;
    frameInfo: GifFrameInfo;
  }

  interface GifFramesOptions {
    url: string | Buffer;
    frames: 'all' | number | number[];
    outputType?: 'jpg' | 'png' | 'gif' | 'canvas';
    quality?: number;
    cumulative?: boolean;
  }

  function gifFrames(options: GifFramesOptions): Promise<GifFrameData[]>;

  export = gifFrames;
}
