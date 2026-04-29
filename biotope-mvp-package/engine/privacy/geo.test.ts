import { describe, expect, it } from 'vitest';
import { haversineMeters, obscureCoords } from './geo';

describe('obscureCoords', () => {
  it('snaps coordinates to a grid (idempotent under repeated obscuring)', () => {
    const a = obscureCoords(49.28273, -123.12074);
    const b = obscureCoords(a.lat, a.lng);
    expect(b).toEqual(a);
  });

  it('produces lat precision <=120m everywhere', () => {
    const samples = [
      [0.000001, 0.000001],
      [49.28273, -123.12074],
      [60.0, 30.0],
      [-33.8688, 151.2093],
      [85.0, 90.0],
    ] as const;
    for (const [lat, lng] of samples) {
      const obs = obscureCoords(lat, lng);
      const latError = haversineMeters({ lat, lng: obs.lng }, { lat: obs.lat, lng: obs.lng });
      expect(latError).toBeLessThanOrEqual(120);
    }
  });

  it('keeps total positional error in the ~100m band at populated latitudes', () => {
    const samples = [
      [0.0001, 0.0001],
      [25.7617, -80.1918],
      [49.28273, -123.12074],
      [60.0, 30.0],
    ] as const;
    for (const [lat, lng] of samples) {
      const obs = obscureCoords(lat, lng);
      const error = haversineMeters({ lat, lng }, obs);
      expect(error).toBeLessThanOrEqual(120);
    }
  });

  it('collapses many nearby inputs onto a small set of grid cells', () => {
    const center = { lat: 49.28273, lng: -123.12074 };
    const cells = new Set<string>();
    for (let dLat = -0.0004; dLat <= 0.0004; dLat += 0.0001) {
      for (let dLng = -0.0004; dLng <= 0.0004; dLng += 0.0001) {
        const obs = obscureCoords(center.lat + dLat, center.lng + dLng);
        cells.add(`${obs.lat},${obs.lng}`);
      }
    }
    // 81 inputs across an ~89m × ~89m square should collapse to a handful of cells.
    expect(cells.size).toBeLessThanOrEqual(6);
  });
});
