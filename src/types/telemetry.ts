import type { FlightPhase } from "./navigation";

/** Desktop → phone telemetry */

export interface TelemetryData {
  alt: number;
  vs: number;
  gs: number;
  tas: number;
  hdg: number;
  track: number;
  pitch: number;
  roll: number;
  phase: FlightPhase;
  to_wpt: string | null;
  to_dist: number | null;
  to_ete: string | null;
  wind_dir: number;
  wind_spd: number;
  displayMode?: string;
  rangeNm?: number;
  simRunning?: boolean;
  hdgHold?: boolean;
  wptCapture?: boolean;
}

export type DesktopToPhone =
  | { type: "TELEMETRY"; data: TelemetryData }
  | {
      type: "STATUS";
      status: "CONNECTED" | "ERROR" | "LOADING" | "READY";
      message?: string;
    }
  | {
      type: "ROUTE_LOADED";
      summary: string;
      rangeNm: number;
      waypoints?: { ident: string }[];
    }
  | { type: "ERROR"; message: string }
  | { type: "HELLO"; role: string };
