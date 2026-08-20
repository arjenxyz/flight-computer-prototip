import type {
  AircraftState,
  AttitudeState,
  FlightPhase,
  FlightPlan,
  LoadedRoutePayload,
  NavState,
  RangeNm,
  DisplayMode,
  RouteMeta,
  ToWaypointInfo,
  Waypoint,
} from "../types/navigation";
import { DEMO_ROUTE } from "./demoRoute";
import {
  bearingDeg,
  computeTrackAndGs,
  destinationPoint,
  distanceNm,
  headingDiff,
  normalizeHeading,
} from "./navMath";

const TICK_HZ = 10;
const DT = 1 / TICK_HZ;
const CAPTURE_NM = 3.0;
const TURN_RATE = 4;
const MAX_BANK = 28;

function defaultAttitude(elevationFt = 0): AttitudeState {
  return {
    pitch: 0,
    roll: 0,
    altitudeFt: elevationFt,
    verticalSpeedFpm: 0,
  };
}

function buildAircraftAt(
  position: { lat: number; lon: number },
  heading: number,
  tas: number,
  flightLevel: number,
  wind: { direction: number; speed: number },
  attitude: AttitudeState,
  phase: FlightPhase,
): AircraftState {
  const { track, groundSpeed } = computeTrackAndGs(
    heading,
    tas,
    wind.direction,
    wind.speed,
  );
  return {
    position: { ...position },
    heading,
    track,
    selectedHeading: heading,
    groundSpeed,
    tas,
    flightLevel,
    wind: { ...wind },
    attitude,
    phase,
  };
}

function demoPayload(): LoadedRoutePayload {
  return {
    from: {
      icao: "DEMO",
      name: "Demo Origin",
      lat: DEMO_ROUTE.startPosition.lat,
      lon: DEMO_ROUTE.startPosition.lon,
      elevationFt: 0,
    },
    to: {
      icao: "DEMO",
      name: "Demo Destination",
      lat: DEMO_ROUTE.waypoints[DEMO_ROUTE.waypoints.length - 1].position.lat,
      lon: DEMO_ROUTE.waypoints[DEMO_ROUTE.waypoints.length - 1].position.lon,
      elevationFt: 0,
    },
    waypoints: DEMO_ROUTE.waypoints.map((w) => ({
      ident: w.ident,
      position: { ...w.position },
    })),
    distanceNm: 175,
    cruiseAltFt: DEMO_ROUTE.flightLevel * 100,
    routeNotes: "Built-in en-route demo",
    source: "Demo",
  };
}

function payloadToMeta(p: LoadedRoutePayload): RouteMeta {
  return {
    from: p.from,
    to: p.to,
    distanceNm: p.distanceNm,
    cruiseAltFt: p.cruiseAltFt,
    routeNotes: p.routeNotes,
    source: p.source,
  };
}

function buildPlan(waypoints: Waypoint[]): FlightPlan {
  return {
    waypoints: waypoints.map((w) => ({
      ident: w.ident,
      position: { ...w.position },
    })),
    activeIndex: 0,
  };
}

function computeToWaypoint(
  aircraft: AircraftState,
  plan: FlightPlan,
): ToWaypointInfo | null {
  if (plan.activeIndex >= plan.waypoints.length) return null;
  const wpt = plan.waypoints[plan.activeIndex];
  const d = distanceNm(aircraft.position, wpt.position);
  const eteSeconds =
    aircraft.groundSpeed > 5 ? (d / aircraft.groundSpeed) * 3600 : Infinity;
  return {
    ident: wpt.ident,
    distanceNm: d,
    eteSeconds,
    bearing: bearingDeg(aircraft.position, wpt.position),
  };
}

/** Fraction [0,1] of total route distance flown */
function routeProgress(
  pos: { lat: number; lon: number },
  plan: FlightPlan,
  totalDist: number,
): number {
  if (plan.waypoints.length < 2 || totalDist < 1) return 0;
  let flown = 0;
  for (let i = 0; i < plan.activeIndex; i++) {
    flown += distanceNm(
      plan.waypoints[i].position,
      plan.waypoints[i + 1].position,
    );
  }
  if (plan.activeIndex < plan.waypoints.length) {
    flown += distanceNm(
      plan.waypoints[plan.activeIndex].position,
      pos,
    );
  }
  return Math.min(1, Math.max(0, flown / totalDist));
}

function phaseFromProgress(p: number): FlightPhase {
  if (p < 0.03) return "PARKED";
  if (p < 0.06) return "TAXI";
  if (p < 0.10) return "TAKEOFF";
  if (p < 0.22) return "CLIMB";
  if (p < 0.78) return "CRUISE";
  if (p < 0.92) return "DESCENT";
  if (p < 0.98) return "APPROACH";
  return "LANDING";
}

function targetAltitudeFt(
  progress: number,
  depElev: number,
  arrElev: number,
  cruiseAlt: number,
): number {
  if (progress < 0.06) return depElev;
  if (progress < 0.22) {
    const t = (progress - 0.06) / 0.16;
    return depElev + t * (cruiseAlt - depElev);
  }
  if (progress < 0.78) return cruiseAlt;
  if (progress < 0.98) {
    const t = (progress - 0.78) / 0.2;
    return cruiseAlt + t * (arrElev + 1500 - cruiseAlt);
  }
  const t = (progress - 0.98) / 0.02;
  return arrElev + 1500 + t * (arrElev - (arrElev + 1500));
}

function phaseTas(phase: FlightPhase, cruiseTas: number): number {
  switch (phase) {
    case "PARKED":
      return 0;
    case "TAXI":
      return 18;
    case "TAKEOFF":
      return 145;
    case "CLIMB":
      return cruiseTas * 0.88;
    case "CRUISE":
      return cruiseTas;
    case "DESCENT":
      return cruiseTas * 0.92;
    case "APPROACH":
      return 155;
    case "LANDING":
      return 130;
    default:
      return cruiseTas;
  }
}

function targetPitch(phase: FlightPhase): number {
  switch (phase) {
    case "PARKED":
    case "TAXI":
      return 0;
    case "TAKEOFF":
      return 12;
    case "CLIMB":
      return 14;
    case "CRUISE":
      return 2.5;
    case "DESCENT":
      return -3;
    case "APPROACH":
      return -2.5;
    case "LANDING":
      return 4;
    default:
      return 0;
  }
}

interface SimContext {
  route: LoadedRoutePayload;
  totalDistNm: number;
  cruiseTas: number;
  phoneControl: boolean;
}

function createStateFromRoute(route: LoadedRoutePayload): NavState {
  const plan = buildPlan(route.waypoints);
  const depPos = { lat: route.from.lat, lon: route.from.lon };
  const firstWpt = route.waypoints[0]?.position ?? { lat: route.to.lat, lon: route.to.lon };
  const heading = bearingDeg(depPos, firstWpt);
  const aircraft = buildAircraftAt(
    { lat: route.from.lat, lon: route.from.lon },
    heading,
    0,
    Math.round(route.cruiseAltFt / 100),
    DEMO_ROUTE.wind,
    defaultAttitude(route.from.elevationFt),
    "PARKED",
  );
  return {
    aircraft,
    flightPlan: plan,
    toWaypoint: computeToWaypoint(aircraft, plan),
    routeMeta: payloadToMeta(route),
    routeLoad: { loading: false, error: null, lastLoadedAt: Date.now() },
    phoneLink: { enabled: false, connected: false, lastUpdateMs: null },
    displayMode: "ROSE_NAV",
    rangeNm: route.distanceNm > 400 ? 160 : route.distanceNm > 150 ? 80 : 40,
    simRunning: true,
    simElapsedSec: 0,
  };
}

export function createInitialNavState(): NavState {
  return createStateFromRoute(demoPayload());
}

function advanceAircraft(
  aircraft: AircraftState,
  plan: FlightPlan,
  ctx: SimContext,
  dt: number,
): { aircraft: AircraftState; plan: FlightPlan } {
  let activeIndex = plan.activeIndex;
  let heading = aircraft.heading;

  const progress = routeProgress(aircraft.position, plan, ctx.totalDistNm);
  const phase = phaseFromProgress(progress);

  const targetAlt = targetAltitudeFt(
    progress,
    ctx.route.from.elevationFt,
    ctx.route.to.elevationFt,
    ctx.route.cruiseAltFt,
  );

  const alt = aircraft.attitude.altitudeFt;
  const altErr = targetAlt - alt;
  const vsTarget = altErr * 0.8; // simple altitude hold → VS
  const vsFpm = aircraft.attitude.verticalSpeedFpm + (vsTarget - aircraft.attitude.verticalSpeedFpm) * 0.15;

  const cruiseTas = ctx.cruiseTas;
  const tas = phaseTas(phase, cruiseTas);

  // Autopilot heading to active waypoint (unless phone drives heading)
  let bankTarget = 0;
  if (
    !ctx.phoneControl &&
    phase !== "PARKED" &&
    phase !== "TAXI" &&
    activeIndex < plan.waypoints.length
  ) {
    const desired = bearingDeg(
      aircraft.position,
      plan.waypoints[activeIndex].position,
    );
    const err = headingDiff(heading, desired);
    const maxTurn = TURN_RATE * dt;
    const turn = Math.max(-maxTurn, Math.min(maxTurn, err));
    heading = normalizeHeading(heading + turn);
    bankTarget = Math.max(-MAX_BANK, Math.min(MAX_BANK, err * 0.55));
  } else if (ctx.phoneControl) {
    bankTarget = aircraft.attitude.roll;
  }

  let roll = aircraft.attitude.roll;
  let pitch = aircraft.attitude.pitch;
  if (!ctx.phoneControl) {
    roll = aircraft.attitude.roll + (bankTarget - aircraft.attitude.roll) * 0.12;
    const pitchTarget = targetPitch(phase);
    pitch = aircraft.attitude.pitch + (pitchTarget - aircraft.attitude.pitch) * 0.1;
  }

  const { track, groundSpeed } = computeTrackAndGs(
    heading,
    tas,
    aircraft.wind.direction,
    aircraft.wind.speed,
  );

  let position = aircraft.position;
  if (tas > 5 && phase !== "PARKED") {
    const distTick = (groundSpeed * dt) / 3600;
    position = destinationPoint(aircraft.position, distTick, track);
  }

  const altitudeFt = alt + (vsFpm * dt) / 60;
  const flightLevel = Math.max(0, Math.round(altitudeFt / 100));

  let nextAircraft: AircraftState = {
    ...aircraft,
    position,
    heading,
    track,
    selectedHeading: Math.round(heading),
    groundSpeed,
    tas,
    flightLevel,
    phase,
    attitude: {
      pitch,
      roll,
      altitudeFt,
      verticalSpeedFpm: vsFpm,
    },
  };

  let nextPlan = plan;
  if (activeIndex < plan.waypoints.length && phase !== "PARKED" && phase !== "TAXI") {
    const dist = distanceNm(position, plan.waypoints[activeIndex].position);
    if (dist < CAPTURE_NM) {
      activeIndex += 1;
      nextPlan = { ...plan, activeIndex };
    }
  }

  // Loop: restart at departure after landing
  if (progress >= 0.995 && phase === "LANDING") {
    return {
      aircraft: createStateFromRoute(ctx.route).aircraft,
      plan: buildPlan(ctx.route.waypoints),
    };
  }

  return { aircraft: nextAircraft, plan: nextPlan };
}

export type SimListener = (state: NavState) => void;

export class FlightSimEngine {
  private state: NavState;
  private route: LoadedRoutePayload;
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<SimListener>();

  constructor() {
    this.route = demoPayload();
    this.state = createInitialNavState();
  }

  private ctx(): SimContext {
    return {
      route: this.route,
      totalDistNm: Math.max(this.route.distanceNm, 10),
      cruiseTas: DEMO_ROUTE.tas,
      phoneControl: this.state.phoneLink.enabled && this.state.phoneLink.connected,
    };
  }

  getState(): NavState {
    return this.state;
  }

  onUpdate(listener: SimListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const l of this.listeners) l(this.state);
  }

  private tick(): void {
    if (!this.state.simRunning) return;
    const { aircraft, plan } = advanceAircraft(
      this.state.aircraft,
      this.state.flightPlan,
      this.ctx(),
      DT,
    );
    this.state = {
      ...this.state,
      aircraft,
      flightPlan: plan,
      toWaypoint: computeToWaypoint(aircraft, plan),
      simElapsedSec: this.state.simElapsedSec + DT,
    };
    this.emit();
  }

  loadRoute(payload: LoadedRoutePayload): void {
    this.route = payload;
    const wasRunning = this.state.simRunning;
    const mode = this.state.displayMode;
    const phoneLink = this.state.phoneLink;
    this.state = {
      ...createStateFromRoute(payload),
      displayMode: mode,
      simRunning: wasRunning,
      phoneLink,
      routeLoad: {
        loading: false,
        error: null,
        lastLoadedAt: Date.now(),
      },
    };
    this.emit();
  }

  setRouteLoading(loading: boolean, error: string | null = null): void {
    this.state = {
      ...this.state,
      routeLoad: {
        ...this.state.routeLoad,
        loading,
        error,
      },
    };
    this.emit();
  }

  start(): void {
    if (this.timer) return;
    this.state = { ...this.state, simRunning: true };
    this.timer = setInterval(() => this.tick(), 1000 / TICK_HZ);
    this.emit();
  }

  pause(): void {
    this.state = { ...this.state, simRunning: false };
    this.emit();
  }

  resume(): void {
    this.state = { ...this.state, simRunning: true };
    this.emit();
  }

  togglePlayPause(): void {
    if (this.state.simRunning) this.pause();
    else this.resume();
  }

  reset(): void {
    const mode = this.state.displayMode;
    const range = this.state.rangeNm;
    const wasRunning = this.state.simRunning;
    this.state = {
      ...createStateFromRoute(this.route),
      displayMode: mode,
      rangeNm: range,
      simRunning: wasRunning,
    };
    this.emit();
  }

  setDisplayMode(mode: DisplayMode): void {
    this.state = { ...this.state, displayMode: mode };
    this.emit();
  }

  setRange(rangeNm: RangeNm): void {
    this.state = { ...this.state, rangeNm };
    this.emit();
  }

  cycleRange(direction: 1 | -1): void {
    const options: RangeNm[] = [10, 20, 40, 80, 160, 320];
    const idx = options.indexOf(this.state.rangeNm);
    const next = options[(idx + direction + options.length) % options.length];
    this.setRange(next);
  }

  setPhoneEnabled(enabled: boolean): void {
    this.state = {
      ...this.state,
      phoneLink: { ...this.state.phoneLink, enabled },
    };
    this.emit();
  }

  setPhoneConnected(connected: boolean): void {
    this.state = {
      ...this.state,
      phoneLink: { ...this.state.phoneLink, connected },
    };
    this.emit();
  }

  applyPhoneAttitude(pitch: number, roll: number, heading?: number | null): void {
    if (!this.state.phoneLink.enabled) return;
    const attitude = {
      ...this.state.aircraft.attitude,
      pitch: Math.max(-40, Math.min(40, pitch)),
      roll: Math.max(-60, Math.min(60, roll)),
    };
    let aircraft = { ...this.state.aircraft, attitude };
    if (typeof heading === "number" && Number.isFinite(heading)) {
      aircraft = {
        ...aircraft,
        heading: ((heading % 360) + 360) % 360,
        selectedHeading: Math.round(((heading % 360) + 360) % 360),
      };
    }
    // Derive a rough VS from pitch while phone-flying
    const vsFromPitch = pitch * 120;
    aircraft.attitude = {
      ...aircraft.attitude,
      verticalSpeedFpm:
        aircraft.attitude.verticalSpeedFpm * 0.7 + vsFromPitch * 0.3,
    };
    this.state = {
      ...this.state,
      aircraft,
      phoneLink: {
        ...this.state.phoneLink,
        connected: true,
        lastUpdateMs: Date.now(),
      },
    };
    this.emit();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
