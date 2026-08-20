import type { LoadedRoutePayload } from "../types/navigation";

export interface FetchRouteOptions {
  fromIcao: string;
  toIcao: string;
  /** Optional FlightPlanDatabase API key for route generator */
  apiKey?: string;
}

/** Fetch a real-world route via Tauri backend (FlightPlanDatabase + fallbacks). */
export async function fetchFlightRoute(
  options: FetchRouteOptions,
): Promise<LoadedRoutePayload> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<LoadedRoutePayload>("fetch_flight_route", {
    fromIcao: options.fromIcao.trim().toUpperCase(),
    toIcao: options.toIcao.trim().toUpperCase(),
    apiKey: options.apiKey?.trim() || null,
  });
}

/** Look up airport info only. */
export async function lookupAirport(icao: string) {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<LoadedRoutePayload["from"]>("lookup_airport", {
    icao: icao.trim().toUpperCase(),
  });
}
