import { useEffect, useRef } from "react";
import { useNav } from "../store/navState";
import { renderAttitudeIndicator } from "../renderer/attitudeIndicator";

const W = 380;
const H = 380;

export function AttitudeCanvas() {
  const { state } = useNav();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    const frame = () => {
      renderAttitudeIndicator(
        ctx,
        stateRef.current.aircraft.attitude,
        W,
        H,
      );
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="display-frame attitude-frame">
      <span className="display-label">ATTITUDE</span>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="efis-canvas"
        aria-label="Artificial Horizon"
      />
    </div>
  );
}
