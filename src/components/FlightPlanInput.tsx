import { useState, useCallback } from "react";
import { useNav } from "../store/navState";

const AIRCRAFT_TYPES = [
  { id: "A320", label: "A320" },
  { id: "B738", label: "B737-800" },
  { id: "AT72", label: "ATR-72" },
];

export function FlightPlanInput() {
  const { state, loadRoute, routeLoading, routeError } = useNav();
  const [from, setFrom] = useState("LTFM");
  const [to, setTo] = useState("LHBP");
  const [apiKey, setApiKey] = useState("");
  const [aircraft, setAircraft] = useState("A320");

  const handleLoad = useCallback(() => {
    loadRoute(from, to, apiKey || undefined);
  }, [from, to, apiKey, loadRoute]);

  const meta = state.routeMeta;

  return (
    <div className="flight-plan-input">
      <span className="panel-title">FLIGHT PLAN</span>
      <div className="fp-row">
        <label className="fp-field">
          <span>DEP</span>
          <input
            className="fp-input"
            value={from}
            onChange={(e) => setFrom(e.target.value.toUpperCase())}
            maxLength={4}
            placeholder="ICAO"
          />
        </label>
        <span className="fp-arrow">→</span>
        <label className="fp-field">
          <span>ARR</span>
          <input
            className="fp-input"
            value={to}
            onChange={(e) => setTo(e.target.value.toUpperCase())}
            maxLength={4}
            placeholder="ICAO"
          />
        </label>
        <label className="fp-field">
          <span>ACFT</span>
          <select
            className="efis-select"
            value={aircraft}
            onChange={(e) => setAircraft(e.target.value)}
          >
            {AIRCRAFT_TYPES.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="efis-btn primary"
          onClick={handleLoad}
          disabled={routeLoading || from.length < 3 || to.length < 3}
        >
          {routeLoading ? "LOADING…" : "LOAD ROUTE"}
        </button>
      </div>

      <div className="fp-row secondary">
        <label className="fp-field wide">
          <span>FPD API KEY (opsiyonel)</span>
          <input
            className="fp-input wide"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="flightplandatabase.com — rota üretici"
          />
        </label>
      </div>

      {routeError && <p className="fp-error">{routeError}</p>}

      {meta && !routeError && (
        <div className="fp-meta">
          <span>
            {meta.from.icao} ({meta.from.name}) → {meta.to.icao} ({meta.to.name})
          </span>
          <span>{meta.distanceNm.toFixed(0)} NM · FL{Math.round(meta.cruiseAltFt / 100)}</span>
          <span className="fp-source">Kaynak: {meta.source}</span>
          {meta.routeNotes && (
            <span className="fp-notes">{meta.routeNotes}</span>
          )}
        </div>
      )}

      <p className="fp-hint">
        Rotalar Flight Plan Database üzerinden alınır (simülasyon amaçlı). API anahtarı
        olmadan mevcut paylaşılan rotalar veya great-circle yedek kullanılır.
      </p>
    </div>
  );
}
