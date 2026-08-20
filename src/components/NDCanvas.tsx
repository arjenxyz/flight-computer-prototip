import { useEffect, useRef } from "react";
import { useNav } from "../store/navState";
import { renderND } from "../renderer/ndRenderer";

const SIZE = 720;

export function NDCanvas() {
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
      renderND(ctx, stateRef.current, { width: SIZE, height: SIZE });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="nd-frame">
      <canvas
        ref={canvasRef}
        width={SIZE}
        height={SIZE}
        className="nd-canvas"
        aria-label="Navigation Display"
      />
    </div>
  );
}
