/**
 * Compute target capture dimensions given a source frame and a max long-edge
 * cap. Preserves aspect ratio; never upscales.
 */
export function fitToLongEdge(
  sourceWidth: number,
  sourceHeight: number,
  maxLongEdgePx: number,
): { width: number; height: number } {
  if (sourceWidth <= 0 || sourceHeight <= 0 || maxLongEdgePx <= 0) {
    throw new Error('fitToLongEdge: invalid input dimensions');
  }
  const longEdge = Math.max(sourceWidth, sourceHeight);
  if (longEdge <= maxLongEdgePx) {
    return { width: Math.round(sourceWidth), height: Math.round(sourceHeight) };
  }
  const scale = maxLongEdgePx / longEdge;
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}
