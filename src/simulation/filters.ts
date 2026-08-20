import type { SmoothingLevel } from "../types/control";
import { headingDiff, normalizeHeading } from "./navMath";

export function smoothingAlpha(level: SmoothingLevel): number {
  switch (level) {
    case "low":
      return 0.55;
    case "high":
      return 0.12;
    case "medium":
    default:
      return 0.28;
  }
}

export function rateLimit(
  newVal: number,
  prevVal: number,
  maxRateDegPerSec: number,
  dt: number,
): number {
  const maxChange = maxRateDegPerSec * dt;
  return Math.max(prevVal - maxChange, Math.min(prevVal + maxChange, newVal));
}

export function lowPass(newVal: number, prevVal: number, alpha: number): number {
  return prevVal + alpha * (newVal - prevVal);
}

/** Low-pass on circular heading (degrees). */
export function lowPassHeading(
  newHdg: number,
  prevHdg: number,
  alpha: number,
): number {
  const d = headingDiff(prevHdg, newHdg);
  return normalizeHeading(prevHdg + alpha * d);
}

export class AttitudeFilter {
  private pitch = 0;
  private roll = 0;
  private heading: number | null = null;
  private headingHistory: number[] = [];
  private initialized = false;

  reset(): void {
    this.pitch = 0;
    this.roll = 0;
    this.heading = null;
    this.headingHistory = [];
    this.initialized = false;
  }

  process(
    pitchIn: number,
    rollIn: number,
    headingIn: number | null | undefined,
    smoothing: SmoothingLevel,
    dt: number,
  ): { pitch: number; roll: number; heading: number | null } {
    const alpha = smoothingAlpha(smoothing);
    const maxRate = smoothing === "high" ? 18 : smoothing === "low" ? 45 : 30;

    if (!this.initialized) {
      this.pitch = pitchIn;
      this.roll = rollIn;
      this.heading = typeof headingIn === "number" ? headingIn : null;
      this.initialized = true;
      return { pitch: this.pitch, roll: this.roll, heading: this.heading };
    }

    let pitch = rateLimit(pitchIn, this.pitch, maxRate, dt);
    let roll = rateLimit(rollIn, this.roll, maxRate, dt);
    pitch = lowPass(pitch, this.pitch, alpha);
    roll = lowPass(roll, this.roll, alpha);

    let heading: number | null = this.heading;
    if (typeof headingIn === "number" && Number.isFinite(headingIn)) {
      const med = this.medianHeading(headingIn);
      if (this.heading == null) {
        heading = med;
      } else {
        heading = lowPassHeading(med, this.heading, alpha * 0.85);
      }
    }

    this.pitch = pitch;
    this.roll = roll;
    this.heading = heading;
    return { pitch, roll, heading };
  }

  private medianHeading(value: number): number {
    this.headingHistory.push(normalizeHeading(value));
    if (this.headingHistory.length > 5) this.headingHistory.shift();
    const base = this.headingHistory[0];
    const unwrapped = this.headingHistory.map((h) => base + headingDiff(base, h));
    const sorted = [...unwrapped].sort((a, b) => a - b);
    return normalizeHeading(sorted[Math.floor(sorted.length / 2)]);
  }
}
