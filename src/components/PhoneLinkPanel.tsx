import { useCallback, useEffect, useRef, useState } from "react";
import { useNav } from "../store/navState";
import type { DisplayMode, RangeNm } from "../types/navigation";
import { DesktopFccPeer, FCC_HOST } from "../services/fccPeer";

/** Desktop ↔ FCC bridge via PeerJS (works with Vercel HTTPS). */
export function PhoneLinkPanel() {
  const {
    state,
    setPhoneEnabled,
    setPhoneConnected,
    applyPhoneAttitude,
    loadRoute,
    setDisplayMode,
    setRange,
    cycleRange,
    togglePlayPause,
    reset,
  } = useNav();

  const [peerId, setPeerId] = useState<string | null>(null);
  const [fccUrl, setFccUrl] = useState<string>("");
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  const peerRef = useRef<DesktopFccPeer | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  const pushTelemetry = useCallback(() => {
    const s = stateRef.current;
    peerRef.current?.send({
      type: "telemetry",
      phase: s.aircraft.phase,
      altitudeFt: s.aircraft.attitude.altitudeFt,
      vsFpm: s.aircraft.attitude.verticalSpeedFpm,
      gs: s.aircraft.groundSpeed,
      heading: s.aircraft.heading,
      pitch: s.aircraft.attitude.pitch,
      roll: s.aircraft.attitude.roll,
      toIdent: s.toWaypoint?.ident ?? null,
      toDistNm: s.toWaypoint?.distanceNm ?? null,
      displayMode: s.displayMode,
      rangeNm: s.rangeNm,
    });
  }, []);

  useEffect(() => {
    setPhoneEnabled(true);
  }, [setPhoneEnabled]);

  useEffect(() => {
    const handleCommand = async (msg: {
      action?: string;
      from?: string;
      to?: string;
      mode?: DisplayMode;
      rangeNm?: RangeNm;
    }) => {
      switch (msg.action) {
        case "loadRoute": {
          if (!msg.from || !msg.to) {
            peerRef.current?.send({
              type: "routeResult",
              ok: false,
              error: "DEP/ARR required",
            });
            return;
          }
          try {
            const result = await loadRoute(msg.from, msg.to);
            peerRef.current?.send({
              type: "routeResult",
              ok: true,
              summary: result.summary,
              rangeNm: result.rangeNm,
            });
            pushTelemetry();
          } catch (e) {
            peerRef.current?.send({
              type: "routeResult",
              ok: false,
              error: e instanceof Error ? e.message : String(e),
            });
          }
          break;
        }
        case "setMode":
          if (msg.mode) setDisplayMode(msg.mode);
          pushTelemetry();
          break;
        case "setRange":
          if (msg.rangeNm) setRange(msg.rangeNm);
          pushTelemetry();
          break;
        case "cycleRange":
          cycleRange(1);
          pushTelemetry();
          break;
        case "togglePlay":
          togglePlayPause();
          pushTelemetry();
          break;
        case "reset":
          reset();
          pushTelemetry();
          break;
        case "enablePhoneControl":
          setPhoneEnabled(true);
          setPhoneConnected(true);
          break;
        case "requestTelemetry":
          pushTelemetry();
          break;
        default:
          break;
      }
    };

    const bridge = new DesktopFccPeer(
      (msg) => {
        if (msg.type === "attitude") {
          setPhoneConnected(true);
          applyPhoneAttitude(msg.pitch, msg.roll, msg.heading ?? null);
        } else if (msg.type === "command") {
          void handleCommand(msg as {
            action?: string;
            from?: string;
            to?: string;
            mode?: DisplayMode;
            rangeNm?: RangeNm;
          });
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
    applyPhoneAttitude,
    cycleRange,
    loadRoute,
    pushTelemetry,
    reset,
    setDisplayMode,
    setPhoneConnected,
    setPhoneEnabled,
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
            ? "FCC ONLINE"
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
