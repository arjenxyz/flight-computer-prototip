import { useCallback, useEffect, useRef, useState } from "react";
import { useNav } from "../store/navState";
import type { DisplayMode, RangeNm } from "../types/navigation";
import type { TelemetryData } from "../types/telemetry";
import { DesktopFccPeer, FCC_HOST } from "../services/fccPeer";

function formatEte(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds)) return null;
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Desktop ↔ FCC bridge via PeerJS (works with Vercel HTTPS). */
export function PhoneLinkPanel() {
  const {
    state,
    setPhoneEnabled,
    setPhoneConnected,
    setPhoneEngaged,
    applyPhoneControl,
    setHdgHold,
    loadRoute,
    setDisplayMode,
    setRange,
    togglePlayPause,
    reset,
  } = useNav();

  const [peerId, setPeerId] = useState<string | null>(null);
  const [fccUrl, setFccUrl] = useState<string>("");
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  const peerRef = useRef<DesktopFccPeer | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const lastWptPulse = useRef(false);

  const buildTelemetry = useCallback((): TelemetryData => {
    const s = stateRef.current;
    return {
      alt: s.aircraft.attitude.altitudeFt,
      vs: s.aircraft.attitude.verticalSpeedFpm,
      gs: s.aircraft.groundSpeed,
      tas: s.aircraft.tas,
      hdg: s.aircraft.heading,
      track: s.aircraft.track,
      pitch: s.aircraft.attitude.pitch,
      roll: s.aircraft.attitude.roll,
      phase: s.aircraft.phase,
      to_wpt: s.toWaypoint?.ident ?? null,
      to_dist: s.toWaypoint?.distanceNm ?? null,
      to_ete: formatEte(s.toWaypoint?.eteSeconds),
      wind_dir: s.aircraft.wind.direction,
      wind_spd: s.aircraft.wind.speed,
      displayMode: s.displayMode,
      rangeNm: s.rangeNm,
      simRunning: s.simRunning,
      hdgHold: s.hdgHold,
      wptCapture: s.wptCapturePulse,
    };
  }, []);

  const pushTelemetry = useCallback(() => {
    peerRef.current?.send({ type: "TELEMETRY", data: buildTelemetry() });
  }, [buildTelemetry]);

  useEffect(() => {
    setPhoneEnabled(true);
  }, [setPhoneEnabled]);

  useEffect(() => {
    if (state.wptCapturePulse && !lastWptPulse.current) {
      pushTelemetry();
    }
    lastWptPulse.current = state.wptCapturePulse;
  }, [state.wptCapturePulse, pushTelemetry]);

  useEffect(() => {
    const handleCommand = async (msg: {
      command?: string;
      dep?: string;
      arr?: string;
      mode?: string;
      rangeNm?: number;
      enabled?: boolean;
    }) => {
      switch (msg.command) {
        case "LOAD_ROUTE": {
          if (!msg.dep || !msg.arr) {
            peerRef.current?.send({
              type: "ERROR",
              message: "DEP/ARR required",
            });
            return;
          }
          peerRef.current?.send({ type: "STATUS", status: "LOADING" });
          try {
            const result = await loadRoute(msg.dep, msg.arr);
            peerRef.current?.send({
              type: "ROUTE_LOADED",
              summary: result.summary,
              rangeNm: result.rangeNm,
            });
            peerRef.current?.send({ type: "STATUS", status: "READY" });
            pushTelemetry();
          } catch (e) {
            peerRef.current?.send({
              type: "ERROR",
              message: e instanceof Error ? e.message : String(e),
            });
          }
          break;
        }
        case "SET_MODE":
          if (msg.mode) setDisplayMode(msg.mode as DisplayMode);
          pushTelemetry();
          break;
        case "SET_RANGE":
          if (msg.rangeNm) setRange(msg.rangeNm as RangeNm);
          pushTelemetry();
          break;
        case "PAUSE":
          togglePlayPause();
          pushTelemetry();
          break;
        case "RESET":
          reset();
          pushTelemetry();
          break;
        case "HDG_HOLD": {
          const on = msg.enabled !== false;
          if (msg.enabled === false) setHdgHold(false);
          else setHdgHold(on);
          pushTelemetry();
          break;
        }
        case "ENGAGE_FLY":
          setPhoneEngaged(msg.enabled !== false);
          setPhoneConnected(true);
          pushTelemetry();
          break;
        case "REQUEST_TELEMETRY":
          pushTelemetry();
          break;
        default:
          break;
      }
    };

    const bridge = new DesktopFccPeer(
      (msg) => {
        if (msg.type === "CONTROL") {
          setPhoneConnected(true);
          applyPhoneControl(msg.data);
        } else if (msg.type === "COMMAND") {
          void handleCommand(msg);
        } else if (msg.type === "HELLO" || msg.type === "hello") {
          setPhoneConnected(true);
          pushTelemetry();
        }
      },
      (s) => {
        setPeerId(s.peerId);
        setBridgeError(s.error ?? null);
        setPhoneConnected(s.connected);
        if (s.peerId) {
          setFccUrl(
            `${FCC_HOST}/phone.html?peer=${encodeURIComponent(s.peerId)}`,
          );
        }
      },
    );
    peerRef.current = bridge;
    bridge.start();

    const telemetryTimer = setInterval(pushTelemetry, 400);

    return () => {
      clearInterval(telemetryTimer);
      bridge.stop();
      peerRef.current = null;
    };
  }, [
    applyPhoneControl,
    loadRoute,
    pushTelemetry,
    reset,
    setDisplayMode,
    setHdgHold,
    setPhoneConnected,
    setPhoneEngaged,
    setRange,
    togglePlayPause,
  ]);

  const copyUrl = useCallback(async () => {
    if (!fccUrl) return;
    try {
      await navigator.clipboard.writeText(fccUrl);
    } catch {
      /* ignore */
    }
  }, [fccUrl]);

  return (
    <div className="phone-link-panel display-bridge">
      <div className="bridge-left">
        <span className="panel-title">DISPLAY · FCC LINK</span>
        <span
          className={
            state.phoneLink.connected ? "phone-status ok" : "phone-status"
          }
        >
          {state.phoneLink.connected
            ? state.phoneLink.engaged
              ? "FCC FLY"
              : "FCC ONLINE"
            : peerId
              ? "FCC WAITING…"
              : "PEER…"}
        </span>
      </div>
      <div className="bridge-right">
        <button
          type="button"
          className="efis-btn primary"
          onClick={copyUrl}
          disabled={!fccUrl}
        >
          FCC URL
        </button>
      </div>
      {fccUrl && <p className="phone-url">{fccUrl}</p>}
      {bridgeError && <p className="fp-error">{bridgeError}</p>}
      {!peerId && !bridgeError && (
        <p className="fp-hint">PeerJS oturumu açılıyor…</p>
      )}
    </div>
  );
}
