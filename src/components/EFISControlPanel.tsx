import { useNav } from "../store/navState";
import type { DisplayMode } from "../types/navigation";
import { RANGE_OPTIONS } from "../types/navigation";

const MODES: { id: DisplayMode; label: string }[] = [
  { id: "ROSE_NAV", label: "ROSE NAV" },
  { id: "ARC", label: "ARC" },
  { id: "PLAN", label: "PLAN" },
];

export function EFISControlPanel() {
  const {
    state,
    setDisplayMode,
    setRange,
    cycleRange,
    togglePlayPause,
    reset,
  } = useNav();

  return (
    <div className="efis-panel">
      <div className="panel-section">
        <span className="panel-title">MODE</span>
        <div className="button-row">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={
                state.displayMode === m.id ? "efis-btn active" : "efis-btn"
              }
              onClick={() => setDisplayMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="panel-section">
        <span className="panel-title">RANGE</span>
        <div className="button-row">
          <button
            type="button"
            className="efis-btn"
            onClick={() => cycleRange(-1)}
            aria-label="Decrease range"
          >
            −
          </button>
          <select
            className="efis-select"
            value={state.rangeNm}
            onChange={(e) =>
              setRange(Number(e.target.value) as (typeof RANGE_OPTIONS)[number])
            }
          >
            {RANGE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r} NM
              </option>
            ))}
          </select>
          <button
            type="button"
            className="efis-btn"
            onClick={() => cycleRange(1)}
            aria-label="Increase range"
          >
            +
          </button>
        </div>
      </div>

      <div className="panel-section">
        <span className="panel-title">DEMO</span>
        <div className="button-row">
          <button type="button" className="efis-btn" onClick={togglePlayPause}>
            {state.simRunning ? "PAUSE" : "PLAY"}
          </button>
          <button type="button" className="efis-btn" onClick={reset}>
            RESET
          </button>
        </div>
      </div>

      <div className="panel-meta">
        <span>
          HDG {String(Math.round(state.aircraft.heading)).padStart(3, "0")}°
        </span>
        <span>{state.aircraft.phase}</span>
        <span>
          ALT {Math.round(state.aircraft.attitude.altitudeFt)} ft
        </span>
        <span>T+{state.simElapsedSec.toFixed(0)}s</span>
      </div>
    </div>
  );
}
