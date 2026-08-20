/** Extended navigation & attitude types */

export type DisplayMode = "ROSE_NAV" | "ARC" | "PLAN";

export type RangeNm = 10 | 20 | 40 | 80 | 160 | 320;

export const RANGE_OPTIONS: RangeNm[] = [10, 20, 40, 80, 160, 320];

export type FlightPhase =
  | "PARKED"
  | "TAXI"
  | "TAKEOFF"
  | "CLIMB"
  | "CRUISE"
  | "DESCENT"
  | "APPROACH"
  | "LANDING";

export interface LatLon {
  lat: number;
  lon: number;
}

export interface Waypoint {
  ident: string;
  position: LatLon;
}

export interface FlightPlan {
  waypoints: Waypoint[];
  activeIndex: number;
}

export interface Wind {
  direction: number;
  speed: number;
}

export interface AttitudeState {
  /** Degrees, nose up positive */
  pitch: number;
  /** Degrees, right wing down positive */
  roll: number;
  /** Feet MSL */
  altitudeFt: number;
  /** Feet per minute, positive = climb */
  verticalSpeedFpm: number;
}

export interface AirportInfo {
  icao: string;
  name: string;
  lat: number;
  lon: number;
  elevationFt: number;
}

export interface RouteMeta {
  from: AirportInfo;
  to: AirportInfo;
  distanceNm: number;
  cruiseAltFt: number;
  routeNotes: string;
  source: string;
}

export interface AircraftState {
  position: LatLon;
  heading: number;
  track: number;
  selectedHeading: number;
  groundSpeed: number;
  tas: number;
  flightLevel: number;
  wind: Wind;
  attitude: AttitudeState;
  phase: FlightPhase;
}

export interface ToWaypointInfo {
  ident: string;
  distanceNm: number;
  eteSeconds: number;
  bearing: number;
}

export interface RouteLoadState {
  loading: boolean;
  error: string | null;
  lastLoadedAt: number | null;
}

export interface PhoneLinkState {
  enabled: boolean;
  connected: boolean;
  engaged: boolean;
  lastUpdateMs: number | null;
}

export interface NavState {
  aircraft: AircraftState;
  flightPlan: FlightPlan;
  toWaypoint: ToWaypointInfo | null;
  routeMeta: RouteMeta | null;
  routeLoad: RouteLoadState;
  phoneLink: PhoneLinkState;
  displayMode: DisplayMode;
  rangeNm: RangeNm;
  simRunning: boolean;
  simElapsedSec: number;
  /** Last ~30s of positions for ND trail (sampled ~2 Hz) */
  trail: LatLon[];
  hdgHold: boolean;
  hdgHoldTarget: number | null;
  /** Pulsed true for one tick when a waypoint is captured */
  wptCapturePulse: boolean;
}

export interface LoadedRoutePayload {
  from: AirportInfo;
  to: AirportInfo;
  waypoints: Waypoint[];
  distanceNm: number;
  cruiseAltFt: number;
  routeNotes: string;
  source: string;
}

export interface DemoRouteConfig {
  waypoints: Waypoint[];
  startPosition: LatLon;
  startHeading: number;
  tas: number;
  flightLevel: number;
  wind: Wind;
  selectedHeading: number;
}
