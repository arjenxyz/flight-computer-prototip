import { Peer, type DataConnection } from "peerjs";
import type { PhoneControlData } from "../types/control";
import type { DesktopToPhone, TelemetryData } from "../types/telemetry";

export type FccInbound =
  | { type: "CONTROL"; data: PhoneControlData }
  | {
      type: "COMMAND";
      command: string;
      dep?: string;
      arr?: string;
      mode?: string;
      rangeNm?: number;
      enabled?: boolean;
    }
  | { type: "HELLO"; role: string }
  /** @deprecated legacy — ignored after protocol break */
  | { type: "attitude"; pitch: number; roll: number; heading?: number | null }
  | {
      type: "command";
      action: string;
      from?: string;
      to?: string;
      mode?: string;
      rangeNm?: number;
    }
  | { type: "hello"; role: string };

export type FccOutbound =
  | DesktopToPhone
  | { type: "TELEMETRY"; data: TelemetryData };

type Handler = (msg: FccInbound) => void;

const FCC_HOST = "https://flight-prototip.vercel.app";

/**
 * Desktop PeerJS host — FCC phone connects with ?peer=<thisId>
 */
export class DesktopFccPeer {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  private onMessage: Handler;
  private onStatus: (s: {
    peerId: string | null;
    connected: boolean;
    error?: string;
  }) => void;

  constructor(
    onMessage: Handler,
    onStatus: (s: {
      peerId: string | null;
      connected: boolean;
      error?: string;
    }) => void,
  ) {
    this.onMessage = onMessage;
    this.onStatus = onStatus;
  }

  start(): void {
    this.stop();
    const peer = new Peer({ debug: 0 });
    this.peer = peer;

    peer.on("open", (id) => {
      this.onStatus({ peerId: id, connected: false });
    });

    peer.on("connection", (conn) => {
      this.bindConn(conn);
    });

    peer.on("error", (err) => {
      this.onStatus({
        peerId: peer.id ?? null,
        connected: false,
        error: String(err),
      });
    });
  }

  private bindConn(conn: DataConnection): void {
    this.conn?.close();
    this.conn = conn;
    conn.on("open", () => {
      this.onStatus({ peerId: this.peer?.id ?? null, connected: true });
      this.send({ type: "HELLO", role: "desktop" });
      this.send({ type: "STATUS", status: "CONNECTED" });
    });
    conn.on("data", (data) => {
      try {
        const msg =
          typeof data === "string" ? JSON.parse(data) : (data as FccInbound);
        this.onMessage(msg);
      } catch {
        /* ignore */
      }
    });
    conn.on("close", () => {
      this.conn = null;
      this.onStatus({ peerId: this.peer?.id ?? null, connected: false });
    });
  }

  send(obj: FccOutbound | Record<string, unknown>): void {
    if (this.conn?.open) {
      this.conn.send(obj);
    }
  }

  fccUrl(): string | null {
    const id = this.peer?.id;
    if (!id) return null;
    return `${FCC_HOST}/phone.html?peer=${encodeURIComponent(id)}`;
  }

  stop(): void {
    this.conn?.close();
    this.conn = null;
    this.peer?.destroy();
    this.peer = null;
  }
}

export { FCC_HOST };
