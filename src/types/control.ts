/** Phone → desktop control payloads (FCC protocol) */

export type SmoothingLevel = "low" | "medium" | "high";

export interface PhoneControlData {
  pitch_target: number;
  roll_target: number;
  heading_target?: number | null;
  timestamp: number;
  smoothing: SmoothingLevel;
  sensitivity: number;
  hdg_hold: boolean;
}

export type FccCommand =
  | { command: "LOAD_ROUTE"; dep: string; arr: string }
  | { command: "SET_MODE"; mode: string }
  | { command: "SET_RANGE"; rangeNm: number }
  | { command: "PAUSE" }
  | { command: "RESET" }
  | { command: "HDG_HOLD"; enabled?: boolean }
  | { command: "ENGAGE_FLY"; enabled: boolean }
  | { command: "REQUEST_TELEMETRY" };

export type PhoneToDesktop =
  | { type: "CONTROL"; data: PhoneControlData }
  | {
      type: "COMMAND";
      command: FccCommand["command"];
      dep?: string;
      arr?: string;
      mode?: string;
      rangeNm?: number;
      enabled?: boolean;
    }
  | { type: "HELLO"; role: string };
