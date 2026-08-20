import { EFIS } from "./colors";
import { toRad } from "../simulation/navMath";

/**
 * Draw compass rose ticks and labels.
 * @param roseHeading - heading at the top of the rose (aircraft heading for heading-up;
 *   0 for north-up PLAN). Labels show absolute headings.
 * @param arcMode - if true, only draw the forward ~90° sector ticks
 */
export function drawCompassRose(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  roseHeading: number,
  arcMode: boolean,
): void {
  ctx.save();
  ctx.strokeStyle = EFIS.white;
  ctx.fillStyle = EFIS.white;
  ctx.lineWidth = 1.5;
  ctx.font = "12px 'Roboto Mono', 'Consolas', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let hdg = 0; hdg < 360; hdg += 5) {
    // Angle on screen: absolute heading relative to roseHeading at top
    let rel = hdg - roseHeading;
    while (rel > 180) rel -= 360;
    while (rel < -180) rel += 360;

    if (arcMode && Math.abs(rel) > 50) continue;

    const angle = toRad(rel); // 0 = up
    const isMajor = hdg % 30 === 0;
    const isCardinal = hdg % 90 === 0;
    const tickLen = isCardinal ? 18 : isMajor ? 12 : 6;

    const outerR = radius;
    const innerR = radius - tickLen;
    const x1 = cx + outerR * Math.sin(angle);
    const y1 = cy - outerR * Math.cos(angle);
    const x2 = cx + innerR * Math.sin(angle);
    const y2 = cy - innerR * Math.cos(angle);

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    if (isMajor) {
      const labelR = radius - 30;
      const lx = cx + labelR * Math.sin(angle);
      const ly = cy - labelR * Math.cos(angle);
      const label =
        hdg === 0
          ? "N"
          : hdg === 90
            ? "E"
            : hdg === 180
              ? "S"
              : hdg === 270
                ? "W"
                : String(Math.round(hdg / 10));
      ctx.fillText(label, lx, ly);
    }
  }

  // Outer circle (or arc)
  ctx.beginPath();
  if (arcMode) {
    const start = toRad(-50);
    const end = toRad(50);
    // Canvas arcs: 0 = east, clockwise; convert our "from up" angles
    ctx.arc(cx, cy, radius, start - Math.PI / 2, end - Math.PI / 2);
  } else {
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  }
  ctx.stroke();

  ctx.restore();
}

/** Fixed yellow lubber line at 12 o'clock */
export function drawLubberLine(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
): void {
  ctx.save();
  ctx.strokeStyle = EFIS.yellow;
  ctx.fillStyle = EFIS.yellow;
  ctx.lineWidth = 2;

  // Triangle pointing down at top of rose
  const tipY = cy - radius + 2;
  ctx.beginPath();
  ctx.moveTo(cx, tipY);
  ctx.lineTo(cx - 8, tipY - 14);
  ctx.lineTo(cx + 8, tipY - 14);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

/** Blue selected-heading bug on the rose */
export function drawHeadingBug(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  aircraftHeading: number,
  selectedHeading: number,
  arcMode: boolean,
): void {
  let rel = selectedHeading - aircraftHeading;
  while (rel > 180) rel -= 360;
  while (rel < -180) rel += 360;

  if (arcMode && Math.abs(rel) > 50) {
    // Off-scale: draw small arrow at arc edge
    const edge = rel > 0 ? 50 : -50;
    const angle = toRad(edge);
    const x = cx + (radius + 10) * Math.sin(angle);
    const y = cy - (radius + 10) * Math.cos(angle);
    ctx.save();
    ctx.fillStyle = EFIS.blue;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  const angle = toRad(rel);
  const bx = cx + radius * Math.sin(angle);
  const by = cy - radius * Math.cos(angle);

  ctx.save();
  ctx.fillStyle = EFIS.blue;
  ctx.translate(bx, by);
  ctx.rotate(angle);
  // Bug: small triangle pointing inward
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-7, -12);
  ctx.lineTo(7, -12);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Green track diamond on the rose */
export function drawTrackDiamond(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  aircraftHeading: number,
  track: number,
  arcMode: boolean,
): void {
  let rel = track - aircraftHeading;
  while (rel > 180) rel -= 360;
  while (rel < -180) rel += 360;
  if (arcMode && Math.abs(rel) > 50) return;

  const angle = toRad(rel);
  const r = radius - 8;
  const x = cx + r * Math.sin(angle);
  const y = cy - r * Math.cos(angle);

  ctx.save();
  ctx.fillStyle = EFIS.green;
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(5, 0);
  ctx.lineTo(0, 6);
  ctx.lineTo(-5, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
