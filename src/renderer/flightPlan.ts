import type { FlightPlan, LatLon } from "../types/navigation";
import { projectToScreen } from "../simulation/navMath";
import { EFIS } from "./colors";

/**
 * Draw flight plan line and waypoint symbols.
 */
export function drawFlightPlan(
  ctx: CanvasRenderingContext2D,
  plan: FlightPlan,
  aircraftPos: LatLon,
  upHeading: number,
  pixelsPerNm: number,
  cx: number,
  cy: number,
): void {
  if (plan.waypoints.length === 0) return;

  const pts = plan.waypoints.map((w) =>
    projectToScreen(w.position, aircraftPos, upHeading, pixelsPerNm, cx, cy),
  );

  // Route line (green)
  ctx.save();
  ctx.strokeStyle = EFIS.green;
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.beginPath();
  pts.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.stroke();

  // Dashed line from aircraft to active TO waypoint
  if (plan.activeIndex < pts.length) {
    const to = pts[plan.activeIndex];
    ctx.strokeStyle = EFIS.white;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Waypoint symbols
  ctx.font = "11px 'Roboto Mono', 'Consolas', monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";

  plan.waypoints.forEach((wpt, i) => {
    const p = pts[i];
    const isActive = i === plan.activeIndex;
    const isPassed = i < plan.activeIndex;

    if (isPassed) {
      ctx.fillStyle = EFIS.gray;
      ctx.strokeStyle = EFIS.gray;
    } else if (isActive) {
      ctx.fillStyle = EFIS.white;
      ctx.strokeStyle = EFIS.white;
    } else {
      ctx.fillStyle = EFIS.green;
      ctx.strokeStyle = EFIS.green;
    }

    // Star / diamond waypoint symbol
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 7);
    ctx.lineTo(p.x + 5, p.y);
    ctx.lineTo(p.x, p.y + 7);
    ctx.lineTo(p.x - 5, p.y);
    ctx.closePath();
    ctx.stroke();
    if (isActive) ctx.fill();

    ctx.fillText(wpt.ident, p.x + 8, p.y - 4);
  });

  ctx.restore();
}

/** Concentric range rings with NM labels */
export function drawRangeRings(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  rangeNm: number,
  arcMode: boolean,
): void {
  ctx.save();
  ctx.strokeStyle = EFIS.dimWhite;
  ctx.fillStyle = EFIS.blue;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.font = "11px 'Roboto Mono', 'Consolas', monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  const rings = 4;
  for (let i = 1; i <= rings; i++) {
    const r = (radius * i) / rings;
    const nm = (rangeNm * i) / rings;

    ctx.beginPath();
    if (arcMode) {
      const start = -Math.PI / 2 - (50 * Math.PI) / 180;
      const end = -Math.PI / 2 + (50 * Math.PI) / 180;
      ctx.arc(cx, cy, r, start, end);
    } else {
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
    }
    ctx.stroke();

    // Label on the right side of the ring
    if (!arcMode || i === rings) {
      const labelX = arcMode ? cx + r * Math.sin((40 * Math.PI) / 180) : cx + r + 4;
      const labelY = arcMode
        ? cy - r * Math.cos((40 * Math.PI) / 180)
        : cy;
      ctx.setLineDash([]);
      ctx.fillText(String(Math.round(nm)), labelX, labelY);
      ctx.setLineDash([4, 4]);
    }
  }

  ctx.restore();
}
