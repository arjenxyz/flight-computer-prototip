import type { LatLon, NavState } from "../types/navigation";
import { destinationPoint, projectToScreen } from "../simulation/navMath";
import { EFIS } from "./colors";
import {
  drawCompassRose,
  drawHeadingBug,
  drawLubberLine,
  drawTrackDiamond,
} from "./compassRose";
import {
  drawAircraftSymbolFixed,
  drawAircraftSymbolRotated,
} from "./aircraftSymbol";
import { drawFlightPlan, drawRangeRings } from "./flightPlan";
import { drawWindArrow } from "./windArrow";

export interface RenderSize {
  width: number;
  height: number;
}

function gsColor(gs: number): string {
  if (gs > 400) return EFIS.amber;
  if (gs >= 200) return EFIS.green;
  return EFIS.yellow;
}

function drawTrail(
  ctx: CanvasRenderingContext2D,
  trail: LatLon[],
  aircraftPos: LatLon,
  upHeading: number,
  pixelsPerNm: number,
  cx: number,
  cy: number,
): void {
  if (trail.length < 2) return;
  ctx.save();
  for (let i = 0; i < trail.length; i++) {
    const p = projectToScreen(
      trail[i],
      aircraftPos,
      upHeading,
      pixelsPerNm,
      cx,
      cy,
    );
    const t = i / Math.max(1, trail.length - 1);
    const r = 1.2 + t * 1.8;
    ctx.fillStyle = `rgba(0, 255, 255, ${0.15 + t * 0.55})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** 1-minute look-ahead speed vector along track. */
function drawSpeedVector(
  ctx: CanvasRenderingContext2D,
  aircraftPos: LatLon,
  track: number,
  gs: number,
  upHeading: number,
  pixelsPerNm: number,
  cx: number,
  cy: number,
): void {
  if (gs < 5) return;
  const lookAheadNm = gs / 60;
  const end = destinationPoint(aircraftPos, lookAheadNm, track);
  const p = projectToScreen(end, aircraftPos, upHeading, pixelsPerNm, cx, cy);

  ctx.save();
  ctx.strokeStyle = EFIS.green;
  ctx.fillStyle = EFIS.green;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();

  const ang = Math.atan2(p.y - cy, p.x - cx);
  ctx.translate(p.x, p.y);
  ctx.rotate(ang);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-8, -4);
  ctx.lineTo(-8, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Full ND frame render — call once per animation frame with latest NavState.
 */
export function renderND(
  ctx: CanvasRenderingContext2D,
  state: NavState,
  size: RenderSize,
): void {
  const { width, height } = size;
  const cx = width / 2;
  const cy = height / 2;
  const mode = state.displayMode;
  const arcMode = mode === "ARC";
  const planMode = mode === "PLAN";

  const radius = Math.min(width, height) * 0.42;

  ctx.fillStyle = EFIS.background;
  ctx.fillRect(0, 0, width, height);

  const aircraft = state.aircraft;
  const upHeading = planMode ? 0 : aircraft.heading;
  const pixelsPerNm = radius / state.rangeNm;

  if (arcMode) {
    ctx.save();
    ctx.beginPath();
    const start = -Math.PI / 2 - (55 * Math.PI) / 180;
    const end = -Math.PI / 2 + (55 * Math.PI) / 180;
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius + 20, start, end);
    ctx.closePath();
    ctx.clip();
  }

  drawRangeRings(ctx, cx, cy, radius, state.rangeNm, arcMode);
  drawCompassRose(ctx, cx, cy, radius, upHeading, arcMode);

  drawTrail(
    ctx,
    state.trail ?? [],
    aircraft.position,
    upHeading,
    pixelsPerNm,
    cx,
    cy,
  );

  drawFlightPlan(
    ctx,
    state.flightPlan,
    aircraft.position,
    upHeading,
    pixelsPerNm,
    cx,
    cy,
  );

  if (!planMode) {
    drawSpeedVector(
      ctx,
      aircraft.position,
      aircraft.track,
      aircraft.groundSpeed,
      upHeading,
      pixelsPerNm,
      cx,
      cy,
    );
  }

  if (arcMode) {
    ctx.restore();
  }

  if (!planMode) {
    drawHeadingBug(
      ctx,
      cx,
      cy,
      radius,
      aircraft.heading,
      aircraft.selectedHeading,
      arcMode,
    );
    drawTrackDiamond(
      ctx,
      cx,
      cy,
      radius,
      aircraft.heading,
      aircraft.track,
      arcMode,
    );
    drawLubberLine(ctx, cx, cy, radius);
    drawAircraftSymbolFixed(ctx, cx, cy);
  } else {
    drawAircraftSymbolRotated(ctx, cx, cy, aircraft.heading);
    drawLubberLine(ctx, cx, cy, radius);
  }

  drawWindArrow(
    ctx,
    cx,
    cy,
    radius,
    aircraft.wind.direction,
    aircraft.wind.speed,
    upHeading,
  );

  drawAnnunciations(ctx, state, width, height);
}

function drawAnnunciations(
  ctx: CanvasRenderingContext2D,
  state: NavState,
  width: number,
  height: number,
): void {
  ctx.save();
  ctx.font = "bold 14px 'Roboto Mono', 'Consolas', monospace";
  ctx.fillStyle = EFIS.white;

  const modeLabel =
    state.displayMode === "ROSE_NAV"
      ? "ROSE"
      : state.displayMode === "ARC"
        ? "ARC"
        : "PLAN";

  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText(modeLabel, 16, height - 16);

  const gs = Math.round(state.aircraft.groundSpeed);
  ctx.fillStyle = gsColor(state.aircraft.groundSpeed);
  ctx.font = "bold 13px 'Roboto Mono', 'Consolas', monospace";
  ctx.fillText(`GS ${gs}`, 16, height - 34);

  if (state.hdgHold) {
    ctx.fillStyle = EFIS.cyan;
    ctx.fillText("HDG HOLD", 16, height - 52);
  }

  ctx.textAlign = "right";
  ctx.fillStyle = EFIS.blue;
  ctx.font = "bold 14px 'Roboto Mono', 'Consolas', monospace";
  ctx.fillText(String(state.rangeNm), width - 16, height - 16);

  if (state.displayMode !== "PLAN") {
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = EFIS.yellow;
    ctx.font = "bold 18px 'Roboto Mono', 'Consolas', monospace";
    const hdg = Math.round(state.aircraft.heading) % 360;
    ctx.fillText(String(hdg).padStart(3, "0"), width / 2, 10);

    ctx.font = "bold 12px 'Roboto Mono', 'Consolas', monospace";
    ctx.fillStyle = EFIS.green;
    const trk = Math.round(state.aircraft.track) % 360;
    ctx.fillText(`TRK ${String(trk).padStart(3, "0")}`, width / 2, 32);
  }

  ctx.restore();
}
