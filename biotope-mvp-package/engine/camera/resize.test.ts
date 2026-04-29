import { describe, expect, it } from 'vitest';
import { fitToLongEdge } from './resize';

describe('fitToLongEdge', () => {
  it('returns the source dimensions unchanged when the long edge already fits', () => {
    expect(fitToLongEdge(800, 600, 1600)).toEqual({ width: 800, height: 600 });
    expect(fitToLongEdge(1600, 900, 1600)).toEqual({ width: 1600, height: 900 });
  });

  it('scales down to fit the long edge while preserving aspect ratio', () => {
    expect(fitToLongEdge(3200, 2400, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitToLongEdge(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
  });

  it('handles portrait orientation', () => {
    expect(fitToLongEdge(2400, 3200, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it('rounds to integer pixels', () => {
    const out = fitToLongEdge(1280, 720, 1600);
    expect(Number.isInteger(out.width)).toBe(true);
    expect(Number.isInteger(out.height)).toBe(true);
  });

  it('never returns 0 even for extreme aspect ratios', () => {
    const { width, height } = fitToLongEdge(10000, 1, 1600);
    expect(width).toBe(1600);
    expect(height).toBeGreaterThanOrEqual(1);
  });

  it('rejects invalid input', () => {
    expect(() => fitToLongEdge(0, 600, 1600)).toThrow();
    expect(() => fitToLongEdge(800, 0, 1600)).toThrow();
    expect(() => fitToLongEdge(800, 600, 0)).toThrow();
  });
});
