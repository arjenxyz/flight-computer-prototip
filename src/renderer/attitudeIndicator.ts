import { EFIS } from "./colors";
import { toRad } from "../simulation/navMath";
import type { AttitudeState } from "../types/navigation";

const SKY = "#1a3a5c";
const GROUND = "#3d2817";
const HORIZON_LINE = "#ffffff";

/**
 * EFIS-style artificial horizon (attitude indicator).
 */
export function renderAttitudeIndicator(
  ctx: CanvasRenderingContext2D,
  attitude: AttitudeState,
  width: number,
  height: number,
): void {
  const cx = width / 2;
  const cy = height / 2;
  const pitchPxPerDeg = 4.2;
  const roll = attitude.roll;
  const pitch = attitude.pitch;

  ctx.fillStyle = EFIS.background;
  ctx.fillRect(0, 0, width, height);

  // Sky / ground hemisphere — rotate by roll, offset by pitch
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(toRad(-roll));
  ctx.translate(0, pitch * pitchPxPerDeg);

  const r = width * 1.4;
  ctx.fillStyle = SKY;
  ctx.beginPath();
  ctx.arc(0, 0, r, Math.PI, 0);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = GROUND;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI);
  ctx.closePath();
  ctx.fill();

  // Horizon line
  ctx.strokeStyle = HORIZON_LINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r, 0);
  ctx.lineTo(r, 0);
  ctx.stroke();

  // Pitch ladder (every 5°, major every 10°)
  ctx.strokeStyle = EFIS.white;
  ctx.fillStyle = EFIS.white;
  ctx.font = "10px 'Roboto Mono', 'Consolas', monospace";
  ctx.textAlign = "center";
  ctx.lineWidth = 1;

  for (let p = -30; p <= 30; p += 5) {
    if (p === 0) continue;
    const y = -p * pitchPxPerDeg;
    const isMajor = p % 10 === 0;
    const half = isMajor ? 55 : 28;
    ctx.beginPath();
    ctx.moveTo(-half, y);
    ctx.lineTo(half, y);
    ctx.stroke();
    if (isMajor) {
      ctx.fillText(String(Math.abs(p)), -half - 14, y + 4);
      ctx.fillText(String(Math.abs(p)), half + 14, y + 4);
    }
  }

  ctx.restore();

  // Fixed aircraft reference (yellow wings + center dot)
  ctx.save();
  ctx.strokeStyle = EFIS.yellow;
  ctx.fillStyle = EFIS.yellow;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(cx - 70, cy);
  ctx.lineTo(cx - 18, cy);
  ctx.moveTo(cx + 18, cy);
  ctx.lineTo(cx + 70, cy);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fill();

  // Center pitch pointer
  ctx.beginPath();
  ctx.moveTo(cx, cy - 10);
  ctx.lineTo(cx - 6, cy - 2);
  ctx.lineTo(cx + 6, cy - 2);
  ctx.closePath();
  ctx.fill();

  ctx.restore();

  // Roll scale arc at top
  drawRollScale(ctx, cx, cy, roll, width);

  // Digital readouts
  drawAttitudeReadouts(ctx, attitude, width, height);
}

function drawRollScale(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  roll: number,
  width: number,
): void {
  const arcR = width * 0.38;
  const arcY = cy - 20;

  ctx.save();
  ctx.strokeStyle = EFIS.white;
  ctx.fillStyle = EFIS.white;
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.arc(cx, arcY + arcR, arcR, Math.PI + toRad(30), -toRad(30));
  ctx.stroke();

  for (const deg of [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60]) {
    const a = toRad(deg - 90);
    const inner = arcR - (deg % 30 === 0 ? 12 : 6);
    const x1 = cx + arcR * Math.cos(a);
    const y1 = arcY + arcR + arcR * Math.sin(a);
    const x2 = cx + inner * Math.cos(a);
    const y2 = arcY + arcR + inner * Math.sin(a);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // Roll pointer (triangle at top, rotates with roll)
  ctx.translate(cx, arcY + arcR - arcR);
  ctx.rotate(toRad(roll));
  ctx.fillStyle = EFIS.yellow;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-8, 14);
  ctx.lineTo(8, 14);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawAttitudeReadouts(
  ctx: CanvasRenderingContext2D,
  attitude: AttitudeState,
  width: number,
  height: number,
): void {
  ctx.font = "bold 14px 'Roboto Mono', 'Consolas', monospace";
  ctx.textBaseline = "top";

  // ALT
  ctx.textAlign = "left";
  ctx.fillStyle = EFIS.green;
  ctx.fillText("ALT", 12, 12);
  ctx.font = "bold 20px 'Roboto Mono', 'Consolas', monospace";
  ctx.fillText(formatAlt(attitude.altitudeFt), 12, 28);

  // VS
  ctx.font = "bold 12px 'Roboto Mono', 'Consolas', monospace";
  ctx.fillStyle = attitude.verticalSpeedFpm >= 0 ? EFIS.green : EFIS.amber;
  const vsSign = attitude.verticalSpeedFpm >= 0 ? "+" : "";
  ctx.fillText(
    `VS ${vsSign}${Math.round(attitude.verticalSpeedFpm)}`,
    12,
    54,
  );

  // Pitch / Roll digital
  ctx.textAlign = "right";
  ctx.fillStyle = EFIS.white;
  ctx.font = "bold 12px 'Roboto Mono', 'Consolas', monospace";
  ctx.fillText(`P ${attitude.pitch.toFixed(1)}°`, width - 12, 12);
  ctx.fillText(`R ${attitude.roll.toFixed(1)}°`, width - 12, 28);

  // Bottom label
  ctx.textAlign = "center";
  ctx.fillStyle = EFIS.dimWhite;
  ctx.font = "10px 'Roboto Mono', 'Consolas', monospace";
  ctx.fillText("ATT", width / 2, height - 18);
}

function formatAlt(ft: number): string {
  if (ft >= 18000) {
    return `FL${Math.round(ft / 100)}`;
  }
  return `${Math.round(ft)}`;
}
