export { createCameraService, type CreateCameraServiceOptions } from './cameraService';
export { fitToLongEdge } from './resize';
export { photoStoragePath, savePhoto } from './savePhoto';
export {
  captureFrameToJpeg,
  readSourceDimensions,
  type FrameSource,
  type FrameSourceDimensions,
  type CaptureFrameOptions,
} from './captureFrame';
export type {
  CameraService,
  CameraSession,
  CaptureOptions,
  CapturedPhoto,
  StartSessionRequest,
} from './types';
