import type { LatLon } from "../types/navigation";

const EARTH_RADIUS_NM = 3440.065; // mean Earth radius in nautical miles
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export function toRad(deg: number): number {
  return deg * DEG2RAD;
}

export function toDeg(rad: number): number {
  return rad * RAD2DEG;
}

/** Normalize angle to [0, 360) */
export function normalizeHeading(deg: number): number {
  let h = deg % 360;
  if (h < 0) h += 360;
  return h;
}

/** Shortest signed angular difference (b - a), range (-180, 180] */
export function headingDiff(from: number, to: number): number {
  let d = normalizeHeading(to) - normalizeHeading(from);
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

/** Great-circle distance in nautical miles (haversine) */
export function distanceNm(a: LatLon, b: LatLon): number {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δφ = toRad(b.lat - a.lat);
  const Δλ = toRad(b.lon - a.lon);

  const h =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial great-circle bearing from a → b, degrees true [0, 360) */
export function bearingDeg(a: LatLon, b: LatLon): number {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δλ = toRad(b.lon - a.lon);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return normalizeHeading(toDeg(Math.atan2(y, x)));
}

/**
 * Destination point given start, distance (NM), and bearing (deg).
 * Spherical Earth approximation — adequate for ND prototype ranges.
 */
export function destinationPoint(
  start: LatLon,
  distanceNmValue: number,
  bearing: number,
): LatLon {
  const δ = distanceNmValue / EARTH_RADIUS_NM;
  const θ = toRad(bearing);
  const φ1 = toRad(start.lat);
  const λ1 = toRad(start.lon);

  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ),
  );
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2),
    );

  return { lat: toDeg(φ2), lon: toDeg(λ2) };
}

/**
 * Compute ground track and ground speed from TAS, heading, and wind.
 * Wind direction is the direction the wind is coming FROM.
 */
export function computeTrackAndGs(
  heading: number,
  tas: number,
  windDir: number,
  windSpeed: number,
): { track: number; groundSpeed: number } {
  // Wind vector (direction TO, i.e. opposite of FROM)
  const windTo = normalizeHeading(windDir + 180);
  const wx = windSpeed * Math.sin(toRad(windTo));
  const wy = windSpeed * Math.cos(toRad(windTo));

  // Air vector
  const ax = tas * Math.sin(toRad(heading));
  const ay = tas * Math.cos(toRad(heading));

  const gx = ax + wx;
  const gy = ay + wy;

  const groundSpeed = Math.sqrt(gx * gx + gy * gy);
  const track = normalizeHeading(toDeg(Math.atan2(gx, gy)));

  return { track, groundSpeed };
}

export interface ScreenPoint {
  x: number;
  y: number;
}

/**
 * Project a lat/lon onto the ND screen.
 * - Orientation: `upHeading` is the heading that points toward screen top
 *   (aircraft heading for ROSE/ARC, 0 for PLAN north-up).
 * - Aircraft is at screen center (cx, cy).
 * - `pixelsPerNm` scales distance to pixels (outer radius / rangeNm).
 */
export function projectToScreen(
  point: LatLon,
  aircraft: LatLon,
  upHeading: number,
  pixelsPerNm: number,
  cx: number,
  cy: number,
): ScreenPoint {
  const dist = distanceNm(aircraft, point);
  const brg = bearingDeg(aircraft, point);
  // Relative angle from "up" direction; screen Y grows downward
  const rel = toRad(headingDiff(upHeading, brg));

  return {
    x: cx + dist * pixelsPerNm * Math.sin(rel),
    y: cy - dist * pixelsPerNm * Math.cos(rel),
  };
}

/** Convert a compass angle (deg, relative to screen-up) to canvas radians for drawing ticks */
export function compassAngleToCanvas(degFromUp: number): number {
  // Canvas 0 is east; we want 0 from-up at top → subtract 90°
  return toRad(degFromUp - 90);
}
