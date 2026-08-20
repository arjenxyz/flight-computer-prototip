import { useNav } from "../store/navState";

function formatEte(seconds: number): string {
  if (!Number.isFinite(seconds)) return "--:--";
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatWindArrow(windDir: number, heading: number): string {
  // Relative wind direction for a simple arrow glyph
  let rel = windDir - heading;
  while (rel < 0) rel += 360;
  while (rel >= 360) rel -= 360;
  // 8-way arrow
  const idx = Math.round(rel / 45) % 8;
  return ["↓", "↙", "←", "↖", "↑", "↗", "→", "↘"][idx];
}

export function DataReadout() {
  const { state } = useNav();
  const { aircraft, toWaypoint } = state;
  const wind = aircraft.wind;

  return (
    <div className="data-readout">
      <div className="readout-left">
        <div className="readout-row">
          <span className="label">GS</span>
          <span className="value green">{Math.round(aircraft.groundSpeed)}</span>
        </div>
        <div className="readout-row">
          <span className="label">TAS</span>
          <span className="value green">{Math.round(aircraft.tas)}</span>
        </div>
        <div className="readout-row wind">
          <span className="value cyan">
            {String(Math.round(wind.direction)).padStart(3, "0")}°/{wind.speed}
          </span>
          <span className="wind-arrow" aria-hidden>
            {formatWindArrow(wind.direction, aircraft.heading)}
          </span>
        </div>
        <div className="readout-row">
          <span className="label">PHONE</span>
          <span className={state.phoneLink.connected ? "value green" : "value amber"}>
            {state.phoneLink.enabled
              ? state.phoneLink.connected
                ? "LIVE"
                : "WAIT"
              : "OFF"}
          </span>
        </div>
        <div className="readout-row">
          <span className="label">PHASE</span>
          <span className="value amber">{aircraft.phase}</span>
        </div>
        <div className="readout-row">
          <span className="label">FL</span>
          <span className="value">{aircraft.flightLevel}</span>
        </div>
      </div>

      <div className="readout-right">
        {toWaypoint ? (
          <>
            <div className="readout-row">
              <span className="value white large">{toWaypoint.ident}</span>
            </div>
            <div className="readout-row">
              <span className="label">DIST</span>
              <span className="value green">
                {toWaypoint.distanceNm.toFixed(1)}
              </span>
              <span className="unit">NM</span>
            </div>
            <div className="readout-row">
              <span className="label">UTC</span>
              <span className="value green">{formatEte(toWaypoint.eteSeconds)}</span>
            </div>
            <div className="readout-row">
              <span className="label">TRK</span>
              <span className="value green">
                {String(Math.round(aircraft.track)).padStart(3, "0")}°
              </span>
            </div>
          </>
        ) : (
          <div className="readout-row">
            <span className="value amber">NO TO WPT</span>
          </div>
        )}
      </div>
    </div>
  );
}
