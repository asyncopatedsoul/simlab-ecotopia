import { requestPermission } from '@engine/privacy';
import type { BlobStore } from '@engine/storage';
import { captureFrameToJpeg, readSourceDimensions, type FrameSource } from './captureFrame';
import { savePhoto } from './savePhoto';
import type {
  CameraService,
  CameraSession,
  CapturedPhoto,
  StartSessionRequest,
} from './types';

export type CreateCameraServiceOptions = {
  blobs: BlobStore;
  /**
   * Override the device clock (test seam). Returns epoch milliseconds and
   * is used to name photo files.
   */
  now?: () => number;
  /**
   * Override the MediaDevices source (test seam). In production we use
   * `navigator.mediaDevices`. In jsdom we inject a fake.
   */
  mediaDevices?: Pick<MediaDevices, 'getUserMedia'>;
  /**
   * Override how the captured frame source is built from the stream — tests
   * inject a synthetic FrameSource since jsdom has no real <video>.
   */
  frameSourceFromStream?: (stream: MediaStream) => Promise<FrameSource>;
};

export function createCameraService(opts: CreateCameraServiceOptions): CameraService {
  const blobs = opts.blobs;
  const now = opts.now ?? (() => Date.now());

  function getMediaDevices(): Pick<MediaDevices, 'getUserMedia'> {
    if (opts.mediaDevices) return opts.mediaDevices;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      throw new Error('MediaDevices unavailable on this platform');
    }
    return navigator.mediaDevices;
  }

  async function defaultFrameSource(stream: MediaStream): Promise<FrameSource> {
    if (typeof document === 'undefined') {
      throw new Error('Cannot build a default frame source outside the DOM');
    }
    const video = document.createElement('video');
    video.srcObject = stream;
    video.playsInline = true;
    video.muted = true;
    await video.play();
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      // Wait a tick for metadata.
      await new Promise<void>((resolve) => {
        const handler = () => {
          video.removeEventListener('loadedmetadata', handler);
          resolve();
        };
        video.addEventListener('loadedmetadata', handler);
      });
    }
    return video;
  }

  return {
    async startSession(req: StartSessionRequest): Promise<CameraSession | null> {
      const result = await requestPermission({
        kind: 'camera',
        scenarioId: req.scenarioId,
        stepId: req.stepId,
        copy: req.copy,
      });
      if (result !== 'granted') return null;

      const facing = req.options?.facingMode ?? 'environment';
      const stream = await getMediaDevices().getUserMedia({
        video: { facingMode: facing },
      });

      let closed = false;
      const session: CameraSession = {
        stream,
        async capture(): Promise<CapturedPhoto> {
          if (closed) throw new Error('CameraSession is closed');
          const frameSourceFactory = opts.frameSourceFromStream ?? defaultFrameSource;
          const source = await frameSourceFactory(stream);
          const dims = readSourceDimensions(source);
          const { blob, width, height } = await captureFrameToJpeg(source, dims, {
            ...(req.options?.maxLongEdgePx != null
              ? { maxLongEdgePx: req.options.maxLongEdgePx }
              : {}),
            ...(req.options?.jpegQuality != null
              ? { jpegQuality: req.options.jpegQuality }
              : {}),
          });
          const capturedAt = now();
          const path = await savePhoto(blobs, req.scenarioId, blob, capturedAt);
          return { path, blob, width, height, capturedAt };
        },
        close() {
          if (closed) return;
          closed = true;
          for (const track of stream.getTracks()) track.stop();
        },
      };
      return session;
    },
    async read(path) {
      return blobs.get(path);
    },
    async delete(path) {
      await blobs.delete(path);
    },
  };
}
