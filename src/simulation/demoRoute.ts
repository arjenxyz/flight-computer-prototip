import type { DemoRouteConfig } from "../types/navigation";
import { destinationPoint } from "./navMath";

/**
 * Generic en-route demo route over Central Europe.
 * Starts near N47°30' E019°00', proceeds roughly eastbound.
 */
const START = { lat: 47.5, lon: 19.0 };

export const DEMO_ROUTE: DemoRouteConfig = {
  startPosition: START,
  startHeading: 90,
  selectedHeading: 90,
  tas: 250,
  flightLevel: 350,
  wind: {
    direction: 270, // from the west
    speed: 25,
  },
  waypoints: [
    { ident: "WPT1", position: destinationPoint(START, 25, 90) },
    { ident: "WPT2", position: destinationPoint(START, 55, 85) },
    { ident: "WPT3", position: destinationPoint(START, 90, 95) },
    { ident: "WPT4", position: destinationPoint(START, 130, 88) },
    { ident: "WPT5", position: destinationPoint(START, 175, 92) },
  ],
};
