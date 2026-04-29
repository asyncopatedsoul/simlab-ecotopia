/**
 * Snap a (lat, lng) pair to a grid such that the resulting precision is at
 * worst ~100m in either axis at any latitude.
 *
 * Latitude: 1° ≈ 111,111m, so a 0.001° step ≈ 111m.
 *
 * Longitude: 1° ≈ 111,111m * cos(lat). At the equator that's ~111m for a 0.001°
 * step, but at lat 60° it's only ~56m — too precise. We compensate by widening
 * the longitude step by 1/cos(lat).
 *
 * Coordinates are clamped against `cos(lat) ~ 0` near the poles to avoid
 * division blowup; pole values are obscured to a single longitude bin.
 */
const LAT_STEP_DEG = 0.001;
const MIN_COS_LAT = 0.01;

export function obscureCoords(lat: number, lng: number): { lat: number; lng: number } {
  const snappedLat = Math.round(lat / LAT_STEP_DEG) * LAT_STEP_DEG;
  const cosSnap = Math.max(Math.cos((snappedLat * Math.PI) / 180), MIN_COS_LAT);
  const lngStep = LAT_STEP_DEG / cosSnap;
  return {
    lat: roundTo6(snappedLat),
    lng: roundTo6(Math.round(lng / lngStep) * lngStep),
  };
}

function roundTo6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

/**
 * Approximate horizontal distance between two coordinates, in meters.
 * Used by tests and by the quota observer to verify obscuring precision.
 */
export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
