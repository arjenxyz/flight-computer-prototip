import type { NavState } from "../types/navigation";
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

export interface RenderSize {
  width: number;
  height: number;
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

  // Outer usable radius (leave margin for lubber / labels)
  const radius = Math.min(width, height) * 0.42;

  // Clear
  ctx.fillStyle = EFIS.background;
  ctx.fillRect(0, 0, width, height);

  const aircraft = state.aircraft;
  // Heading-up: rose rotates with aircraft heading; PLAN: north-up
  const upHeading = planMode ? 0 : aircraft.heading;
  const pixelsPerNm = radius / state.rangeNm;

  // Clip for ARC mode (forward sector)
  if (arcMode) {
    ctx.save();
    ctx.beginPath();
    // Sector from -50° to +50° plus bottom half cut
    const start = -Math.PI / 2 - (55 * Math.PI) / 180;
    const end = -Math.PI / 2 + (55 * Math.PI) / 180;
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius + 20, start, end);
    ctx.closePath();
    ctx.clip();
  }

  // 1. Range rings
  drawRangeRings(ctx, cx, cy, radius, state.rangeNm, arcMode);

  // 2. Compass rose
  drawCompassRose(ctx, cx, cy, radius, upHeading, arcMode);

  // 3. Flight plan
  drawFlightPlan(
    ctx,
    state.flightPlan,
    aircraft.position,
    upHeading,
    pixelsPerNm,
    cx,
    cy,
  );

  if (arcMode) {
    ctx.restore();
  }

  // 4. Heading bug & track diamond (on rose, relative to aircraft heading in heading-up)
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
    // PLAN: north-up, aircraft rotated by heading, no lubber
    drawAircraftSymbolRotated(ctx, cx, cy, aircraft.heading);
    // Still show a north reference triangle at top
    drawLubberLine(ctx, cx, cy, radius);
  }

  // 5. Mode / range annunciations
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

  // Bottom-left: mode
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillText(modeLabel, 16, height - 16);

  // Bottom-right: range
  ctx.textAlign = "right";
  ctx.fillStyle = EFIS.blue;
  ctx.fillText(String(state.rangeNm), width - 16, height - 16);

  // Top-center: heading digital readout (heading-up modes)
  if (state.displayMode !== "PLAN") {
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = EFIS.yellow;
    ctx.font = "bold 18px 'Roboto Mono', 'Consolas', monospace";
    const hdg = Math.round(state.aircraft.heading) % 360;
    ctx.fillText(String(hdg).padStart(3, "0"), width / 2, 10);
  }

  ctx.restore();
}
