import { EFIS } from "./colors";
import { headingDiff, toRad } from "../simulation/navMath";

/**
 * Draw wind arrow near top-right of ND (direction FROM, EFIS convention).
 */
export function drawWindArrow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  windFromDeg: number,
  windSpeedKt: number,
  upHeading: number,
): void {
  if (windSpeedKt < 1) return;

  const rel = headingDiff(upHeading, windFromDeg);
  const ang = toRad(rel - 90);
  const ox = cx + radius * 0.72;
  const oy = cy - radius * 0.72;
  const len = 18 + Math.min(22, windSpeedKt * 0.35);

  ctx.save();
  ctx.translate(ox, oy);
  ctx.rotate(ang);
  ctx.strokeStyle = EFIS.white;
  ctx.fillStyle = EFIS.white;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -len / 2);
  ctx.lineTo(0, len / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, len / 2);
  ctx.lineTo(-5, len / 2 - 9);
  ctx.lineTo(5, len / 2 - 9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.font = "bold 11px 'Roboto Mono', 'Consolas', monospace";
  ctx.fillStyle = EFIS.white;
  ctx.textAlign = "center";
  ctx.fillText(
    `${String(Math.round(windFromDeg)).padStart(3, "0")}/${Math.round(windSpeedKt)}`,
    ox,
    oy + 28,
  );
  ctx.restore();
}
