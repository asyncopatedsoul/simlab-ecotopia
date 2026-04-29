import { fitToLongEdge } from './resize';

const DEFAULT_MAX_LONG_EDGE_PX = 1600;
const DEFAULT_JPEG_QUALITY = 0.85;

/**
 * Source frame interface — covers HTMLVideoElement, ImageBitmap, and any
 * other CanvasImageSource. Test seam: the unit tests provide a fake.
 */
export type FrameSource =
  | HTMLVideoElement
  | HTMLImageElement
  | ImageBitmap
  | OffscreenCanvas
  | HTMLCanvasElement;

export type FrameSourceDimensions = { width: number; height: number };

export type CaptureFrameOptions = {
  maxLongEdgePx?: number;
  jpegQuality?: number;
};

/**
 * Draw a frame source onto an offscreen canvas at the resize-fitted size,
 * encode as JPEG, return the Blob plus final dimensions.
 *
 * EXIF stripping is enforced by construction here: the canvas re-encode
 * path produces a fresh JPEG that contains only the SOI/SOF/DQT/DHT/SOS/EOI
 * segments — no APP1 (EXIF) segment can survive a canvas round-trip.
 */
export async function captureFrameToJpeg(
  source: FrameSource,
  dims: FrameSourceDimensions,
  options: CaptureFrameOptions = {},
): Promise<{ blob: Blob; width: number; height: number }> {
  const maxLongEdge = options.maxLongEdgePx ?? DEFAULT_MAX_LONG_EDGE_PX;
  const quality = options.jpegQuality ?? DEFAULT_JPEG_QUALITY;
  const { width, height } = fitToLongEdge(dims.width, dims.height, maxLongEdge);

  const canvas = makeCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to acquire 2D canvas context');
  ctx.drawImage(source as CanvasImageSource, 0, 0, width, height);

  const blob = await canvasToJpeg(canvas, quality);
  return { blob, width, height };
}

function makeCanvas(width: number, height: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  return c;
}

function canvasToJpeg(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  quality: number,
): Promise<Blob> {
  if ('convertToBlob' in canvas) {
    return canvas.convertToBlob({ type: 'image/jpeg', quality });
  }
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))),
      'image/jpeg',
      quality,
    );
  });
}

/**
 * Pull dimensions off a frame source. Different APIs surface different
 * fields (HTMLVideoElement.videoWidth/Height vs. ImageBitmap.width/height).
 */
export function readSourceDimensions(source: FrameSource): FrameSourceDimensions {
  if ('videoWidth' in source) {
    return { width: source.videoWidth, height: source.videoHeight };
  }
  return { width: source.width, height: source.height };
}
