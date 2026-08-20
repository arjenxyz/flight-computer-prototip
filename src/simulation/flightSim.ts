import type {
  AircraftState,
  AttitudeState,
  FlightPlan,
  LoadedRoutePayload,
  NavState,
  RangeNm,
  DisplayMode,
  RouteMeta,
  ToWaypointInfo,
  Waypoint,
  LatLon,
} from "../types/navigation";
import type { PhoneControlData, SmoothingLevel } from "../types/control";
import { DEMO_ROUTE } from "./demoRoute";
import {
  bearingDeg,
  computeTrackAndGs,
  destinationPoint,
  distanceNm,
  headingDiff,
  normalizeHeading,
} from "./navMath";
import { AttitudeFilter } from "./filters";
import {
  approachTas,
  approachVs,
  maxVsForPhase,
  phaseFromProgress,
  phaseTasTarget,
  targetAltitudeFt,
  targetPitch,
} from "./phaseManager";

const TICK_HZ = 25;
const DT = 1 / TICK_HZ;
const CAPTURE_NM = 3.0;
const MAX_BANK = 30;
const HDG_CAPTURE_DEG = 2;
const TRAIL_INTERVAL_SEC = 0.5;
const TRAIL_MAX = 60;
const G_MS2 = 9.81;
const KT_TO_MS = 0.514444;
const MAX_TURN_RAD = 0.1;

function defaultAttitude(elevationFt = 0): AttitudeState {
  return {
    pitch: 0,
    roll: 0,
    altitudeFt: elevationFt,
    verticalSpeedFpm: 0,
  };
}

function buildAircraftAt(
  position: LatLon,
  heading: number,
  tas: number,
  flightLevel: number,
  wind: { direction: number; speed: number },
  attitude: AttitudeState,
  phase: ReturnType<typeof phaseFromProgress>,
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

function routeProgress(
  pos: LatLon,
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
    flown += distanceNm(plan.waypoints[plan.activeIndex].position, pos);
  }
  return Math.min(1, Math.max(0, flown / totalDist));
}

function bankToTurnRateDegPerSec(bankDeg: number, tasKt: number): number {
  const speed = Math.max(tasKt, 60) * KT_TO_MS;
  const bankRad = (bankDeg * Math.PI) / 180;
  let turnRad = (G_MS2 * Math.tan(bankRad)) / speed;
  turnRad = Math.max(-MAX_TURN_RAD, Math.min(MAX_TURN_RAD, turnRad));
  return (turnRad * 180) / Math.PI;
}

interface SimContext {
  route: LoadedRoutePayload;
  totalDistNm: number;
  cruiseTas: number;
  phoneEngaged: boolean;
}

function createStateFromRoute(route: LoadedRoutePayload): NavState {
  const plan = buildPlan(route.waypoints);
  const depPos = { lat: route.from.lat, lon: route.from.lon };
  const firstWpt =
    route.waypoints[0]?.position ?? { lat: route.to.lat, lon: route.to.lon };
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
    phoneLink: {
      enabled: false,
      connected: false,
      engaged: false,
      lastUpdateMs: null,
    },
    displayMode: "ROSE_NAV",
    rangeNm: route.distanceNm > 400 ? 160 : route.distanceNm > 150 ? 80 : 40,
    simRunning: true,
    simElapsedSec: 0,
    trail: [{ ...aircraft.position }],
    hdgHold: false,
    hdgHoldTarget: null,
    wptCapturePulse: false,
  };
}

export function createInitialNavState(): NavState {
  return createStateFromRoute(demoPayload());
}

export type SimListener = (state: NavState) => void;

export class FlightSimEngine {
  private state: NavState;
  private route: LoadedRoutePayload;
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<SimListener>();
  private attitudeFilter = new AttitudeFilter();
  private lastControl: PhoneControlData | null = null;
  private trailAcc = 0;
  private smoothing: SmoothingLevel = "medium";

  constructor() {
    this.route = demoPayload();
    this.state = createInitialNavState();
  }

  private ctx(): SimContext {
    return {
      route: this.route,
      totalDistNm: Math.max(this.route.distanceNm, 10),
      cruiseTas: DEMO_ROUTE.tas,
      phoneEngaged:
        this.state.phoneLink.enabled &&
        this.state.phoneLink.connected &&
        this.state.phoneLink.engaged,
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

  private pushTrail(pos: LatLon, dt: number): LatLon[] {
    this.trailAcc += dt;
    let trail = this.state.trail;
    if (this.trailAcc >= TRAIL_INTERVAL_SEC) {
      this.trailAcc = 0;
      trail = [...trail, { ...pos }];
      if (trail.length > TRAIL_MAX) trail = trail.slice(trail.length - TRAIL_MAX);
    }
    return trail;
  }

  private tick(): void {
    if (!this.state.simRunning) return;

    const ctx = this.ctx();
    const { aircraft: prevAc, flightPlan: plan } = this.state;
    let activeIndex = plan.activeIndex;
    let heading = prevAc.heading;
    let pitch = prevAc.attitude.pitch;
    let roll = prevAc.attitude.roll;
    let tas = prevAc.tas;
    let vsFpm = prevAc.attitude.verticalSpeedFpm;
    let altitudeFt = prevAc.attitude.altitudeFt;
    let wptCapturePulse = false;

    const progress = routeProgress(prevAc.position, plan, ctx.totalDistNm);
    const phase = phaseFromProgress(progress);

    if (ctx.phoneEngaged && this.lastControl) {
      const ctrl = this.lastControl;
      const filtered = this.attitudeFilter.process(
        ctrl.pitch_target,
        ctrl.roll_target,
        ctrl.heading_target ?? null,
        ctrl.smoothing ?? this.smoothing,
        DT,
      );
      this.smoothing = ctrl.smoothing ?? this.smoothing;

      pitch = Math.max(-40, Math.min(40, filtered.pitch));

      let targetBank: number;
      if (this.state.hdgHold && this.state.hdgHoldTarget != null) {
        const err = headingDiff(heading, this.state.hdgHoldTarget);
        if (Math.abs(err) < HDG_CAPTURE_DEG) {
          targetBank = 0;
          heading = this.state.hdgHoldTarget;
        } else {
          targetBank = Math.max(-MAX_BANK, Math.min(MAX_BANK, err * 0.35));
        }
      } else {
        targetBank = Math.max(-MAX_BANK, Math.min(MAX_BANK, filtered.roll));
      }

      roll = roll + (targetBank - roll) * 0.25;
      const captured =
        this.state.hdgHold &&
        this.state.hdgHoldTarget != null &&
        Math.abs(headingDiff(heading, this.state.hdgHoldTarget)) < HDG_CAPTURE_DEG;
      if (!captured) {
        const turnRate = bankToTurnRateDegPerSec(roll, Math.max(tas, 80));
        heading = normalizeHeading(heading + turnRate * DT);
      }

      const pitchRad = (pitch * Math.PI) / 180;
      const vsFromPitch = Math.max(
        -6000,
        Math.min(6000, tas * Math.sin(pitchRad) * 101.268),
      );
      vsFpm = approachVs(vsFpm, vsFromPitch, DT);
      altitudeFt = altitudeFt + (vsFpm * DT) / 60;

      const tasTarget = phaseTasTarget(phase, ctx.cruiseTas);
      tas = approachTas(tas, tasTarget, DT);
    } else {
      const targetAlt = targetAltitudeFt(
        progress,
        ctx.route.from.elevationFt,
        ctx.route.to.elevationFt,
        ctx.route.cruiseAltFt,
      );
      const altErr = targetAlt - altitudeFt;
      const maxVs = maxVsForPhase(phase);
      let vsDesired = Math.max(-maxVs, Math.min(maxVs, altErr * 0.8));
      if (phase === "PARKED" || phase === "TAXI") vsDesired = 0;
      vsFpm = approachVs(vsFpm, vsDesired, DT);
      altitudeFt = altitudeFt + (vsFpm * DT) / 60;

      const tasTarget = phaseTasTarget(phase, ctx.cruiseTas);
      tas = approachTas(tas, tasTarget, DT);

      let bankTarget = 0;
      if (this.state.hdgHold && this.state.hdgHoldTarget != null) {
        const err = headingDiff(heading, this.state.hdgHoldTarget);
        if (Math.abs(err) < HDG_CAPTURE_DEG) {
          bankTarget = 0;
          heading = this.state.hdgHoldTarget;
        } else {
          bankTarget = Math.max(-MAX_BANK, Math.min(MAX_BANK, err * 0.35));
          const turnRate = bankToTurnRateDegPerSec(bankTarget, Math.max(tas, 80));
          heading = normalizeHeading(heading + turnRate * DT);
        }
      } else if (
        phase !== "PARKED" &&
        phase !== "TAXI" &&
        activeIndex < plan.waypoints.length
      ) {
        const desired = bearingDeg(
          prevAc.position,
          plan.waypoints[activeIndex].position,
        );
        const err = headingDiff(heading, desired);
        bankTarget = Math.max(-MAX_BANK, Math.min(MAX_BANK, err * 0.55));
        const turnRate = bankToTurnRateDegPerSec(bankTarget, Math.max(tas, 80));
        const maxTurn = Math.abs(turnRate) * DT;
        const step = Math.max(-maxTurn, Math.min(maxTurn, err));
        heading = normalizeHeading(heading + step);
      }

      roll = roll + (bankTarget - roll) * 0.15;
      const pitchTarget = targetPitch(phase);
      pitch = pitch + (pitchTarget - pitch) * 0.08;
    }

    const { track, groundSpeed } = computeTrackAndGs(
      heading,
      tas,
      prevAc.wind.direction,
      prevAc.wind.speed,
    );

    let position = prevAc.position;
    if (tas > 5 && phase !== "PARKED") {
      const distTick = (groundSpeed * DT) / 3600;
      position = destinationPoint(prevAc.position, distTick, track);
    }

    const flightLevel = Math.max(0, Math.round(altitudeFt / 100));

    let nextPlan = plan;
    if (
      activeIndex < plan.waypoints.length &&
      phase !== "PARKED" &&
      phase !== "TAXI"
    ) {
      const dist = distanceNm(position, plan.waypoints[activeIndex].position);
      if (dist < CAPTURE_NM) {
        activeIndex += 1;
        nextPlan = { ...plan, activeIndex };
        wptCapturePulse = true;
      }
    }

    if (progress >= 0.995 && phase === "LANDING") {
      const restarted = createStateFromRoute(this.route);
      this.state = {
        ...restarted,
        displayMode: this.state.displayMode,
        rangeNm: this.state.rangeNm,
        simRunning: this.state.simRunning,
        phoneLink: this.state.phoneLink,
        hdgHold: false,
        hdgHoldTarget: null,
      };
      this.attitudeFilter.reset();
      this.lastControl = null;
      this.trailAcc = 0;
      this.emit();
      return;
    }

    const nextAircraft: AircraftState = {
      ...prevAc,
      position,
      heading,
      track,
      selectedHeading: this.state.hdgHoldTarget ?? Math.round(heading),
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

    const trail = this.pushTrail(position, DT);

    this.state = {
      ...this.state,
      aircraft: nextAircraft,
      flightPlan: nextPlan,
      toWaypoint: computeToWaypoint(nextAircraft, nextPlan),
      simElapsedSec: this.state.simElapsedSec + DT,
      trail,
      wptCapturePulse,
    };
    this.emit();
  }

  loadRoute(payload: LoadedRoutePayload): void {
    this.route = payload;
    const wasRunning = this.state.simRunning;
    const mode = this.state.displayMode;
    const phoneLink = this.state.phoneLink;
    this.attitudeFilter.reset();
    this.lastControl = null;
    this.trailAcc = 0;
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
      hdgHold: false,
      hdgHoldTarget: null,
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

  setPaused(): void {
    this.togglePlayPause();
  }

  reset(): void {
    const mode = this.state.displayMode;
    const range = this.state.rangeNm;
    const wasRunning = this.state.simRunning;
    const phoneLink = this.state.phoneLink;
    this.attitudeFilter.reset();
    this.lastControl = null;
    this.trailAcc = 0;
    this.state = {
      ...createStateFromRoute(this.route),
      displayMode: mode,
      rangeNm: range,
      simRunning: wasRunning,
      phoneLink: { ...phoneLink, engaged: false },
      hdgHold: false,
      hdgHoldTarget: null,
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

  setPhoneEngaged(engaged: boolean): void {
    if (!engaged) {
      this.lastControl = null;
      this.attitudeFilter.reset();
    }
    this.state = {
      ...this.state,
      phoneLink: { ...this.state.phoneLink, engaged, enabled: true },
    };
    this.emit();
  }

  setHdgHold(enabled: boolean, target?: number | null): void {
    if (enabled) {
      const t =
        typeof target === "number" && Number.isFinite(target)
          ? normalizeHeading(target)
          : normalizeHeading(this.state.aircraft.heading);
      this.state = {
        ...this.state,
        hdgHold: true,
        hdgHoldTarget: t,
        aircraft: {
          ...this.state.aircraft,
          selectedHeading: Math.round(t),
        },
      };
    } else {
      this.state = {
        ...this.state,
        hdgHold: false,
        hdgHoldTarget: null,
      };
    }
    this.emit();
  }

  applyPhoneControl(data: PhoneControlData): void {
    if (!this.state.phoneLink.enabled) return;
    this.lastControl = data;
    this.smoothing = data.smoothing;

    if (data.hdg_hold && !this.state.hdgHold) {
      const t = normalizeHeading(this.state.aircraft.heading);
      this.state = {
        ...this.state,
        hdgHold: true,
        hdgHoldTarget: t,
        aircraft: {
          ...this.state.aircraft,
          selectedHeading: Math.round(t),
        },
      };
    } else if (!data.hdg_hold && this.state.hdgHold) {
      this.state = {
        ...this.state,
        hdgHold: false,
        hdgHoldTarget: null,
      };
    }

    this.state = {
      ...this.state,
      phoneLink: {
        ...this.state.phoneLink,
        connected: true,
        engaged: true,
        lastUpdateMs: Date.now(),
      },
    };
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
