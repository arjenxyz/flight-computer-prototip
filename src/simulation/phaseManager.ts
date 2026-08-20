import type { FlightPhase } from "../types/navigation";

/** Fraction [0,1] → flight phase */
export function phaseFromProgress(p: number): FlightPhase {
  if (p < 0.03) return "PARKED";
  if (p < 0.06) return "TAXI";
  if (p < 0.1) return "TAKEOFF";
  if (p < 0.22) return "CLIMB";
  if (p < 0.78) return "CRUISE";
  if (p < 0.92) return "DESCENT";
  if (p < 0.98) return "APPROACH";
  return "LANDING";
}

export function targetAltitudeFt(
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

export function phaseTasTarget(phase: FlightPhase, cruiseTas: number): number {
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

export function targetPitch(phase: FlightPhase): number {
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

/** Max |VS| fpm used when chasing target altitude (autopilot path). */
export function maxVsForPhase(phase: FlightPhase): number {
  switch (phase) {
    case "PARKED":
    case "TAXI":
      return 0;
    case "TAKEOFF":
      return 2500;
    case "CLIMB":
      return 2200;
    case "CRUISE":
      return 800;
    case "DESCENT":
      return 2000;
    case "APPROACH":
      return 1200;
    case "LANDING":
      return 700;
    default:
      return 1500;
  }
}

const TAS_RATE_KT_PER_SEC = 5;

/** Approach target TAS at max 5 kt/s. */
export function approachTas(current: number, target: number, dt: number): number {
  const maxDelta = TAS_RATE_KT_PER_SEC * dt;
  const err = target - current;
  if (Math.abs(err) <= maxDelta) return target;
  return current + Math.sign(err) * maxDelta;
}

/** Smooth VS toward a desired value with acceleration limit. */
export function approachVs(
  current: number,
  desired: number,
  dt: number,
  accelFpmPerSec = 1200,
): number {
  const maxDelta = accelFpmPerSec * dt;
  const err = desired - current;
  if (Math.abs(err) <= maxDelta) return desired;
  return current + Math.sign(err) * maxDelta;
}
