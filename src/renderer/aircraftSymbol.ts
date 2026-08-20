import { EFIS } from "./colors";
import { toRad } from "../simulation/navMath";

/**
 * Yellow fixed aircraft symbol at center (ROSE / ARC — heading-up).
 */
export function drawAircraftSymbolFixed(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
): void {
  ctx.save();
  ctx.strokeStyle = EFIS.yellow;
  ctx.fillStyle = EFIS.yellow;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";

  // Classic ND planform: triangle nose + wing bar + tail
  ctx.beginPath();
  ctx.moveTo(cx, cy - 14);
  ctx.lineTo(cx - 5, cy + 4);
  ctx.lineTo(cx + 5, cy + 4);
  ctx.closePath();
  ctx.fill();

  // Wings
  ctx.beginPath();
  ctx.moveTo(cx - 18, cy);
  ctx.lineTo(cx + 18, cy);
  ctx.stroke();

  // Tail
  ctx.beginPath();
  ctx.moveTo(cx - 7, cy + 10);
  ctx.lineTo(cx + 7, cy + 10);
  ctx.stroke();

  ctx.restore();
}

/**
 * Aircraft symbol rotated by heading (PLAN mode — north-up).
 * heading 0 = nose points up (north).
 */
export function drawAircraftSymbolRotated(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  heading: number,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(toRad(heading));
  ctx.translate(-cx, -cy);
  drawAircraftSymbolFixed(ctx, cx, cy);
  ctx.restore();
}
