import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { DisplayMode, NavState, RangeNm } from "../types/navigation";
import type { PhoneControlData } from "../types/control";
import { FlightSimEngine, createInitialNavState } from "../simulation/flightSim";
import { fetchFlightRoute } from "../services/routeService";

interface NavContextValue {
  state: NavState;
  routeLoading: boolean;
  routeError: string | null;
  setDisplayMode: (mode: DisplayMode) => void;
  setRange: (range: RangeNm) => void;
  cycleRange: (direction: 1 | -1) => void;
  togglePlayPause: () => void;
  reset: () => void;
  loadRoute: (
    from: string,
    to: string,
    apiKey?: string,
  ) => Promise<{
    summary: string;
    rangeNm: number;
  }>;
  setPhoneEnabled: (enabled: boolean) => void;
  setPhoneConnected: (connected: boolean) => void;
  setPhoneEngaged: (engaged: boolean) => void;
  applyPhoneControl: (data: PhoneControlData) => void;
  setHdgHold: (enabled: boolean, target?: number | null) => void;
}

const NavContext = createContext<NavContextValue | null>(null);

export function NavProvider({ children }: { children: ReactNode }) {
  const engineRef = useRef<FlightSimEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new FlightSimEngine();
  }

  const [state, setState] = useState<NavState>(() => createInitialNavState());

  useEffect(() => {
    const engine = engineRef.current!;
    const unsub = engine.onUpdate(setState);
    engine.start();
    return () => {
      unsub();
      engine.stop();
    };
  }, []);

  const setDisplayMode = useCallback((mode: DisplayMode) => {
    engineRef.current?.setDisplayMode(mode);
  }, []);

  const setRange = useCallback((range: RangeNm) => {
    engineRef.current?.setRange(range);
  }, []);

  const cycleRange = useCallback((direction: 1 | -1) => {
    engineRef.current?.cycleRange(direction);
  }, []);

  const togglePlayPause = useCallback(() => {
    engineRef.current?.togglePlayPause();
  }, []);

  const reset = useCallback(() => {
    engineRef.current?.reset();
  }, []);

  const setPhoneEnabled = useCallback((enabled: boolean) => {
    engineRef.current?.setPhoneEnabled(enabled);
  }, []);

  const setPhoneConnected = useCallback((connected: boolean) => {
    engineRef.current?.setPhoneConnected(connected);
  }, []);

  const setPhoneEngaged = useCallback((engaged: boolean) => {
    engineRef.current?.setPhoneEngaged(engaged);
  }, []);

  const applyPhoneControl = useCallback((data: PhoneControlData) => {
    engineRef.current?.applyPhoneControl(data);
  }, []);

  const setHdgHold = useCallback((enabled: boolean, target?: number | null) => {
    engineRef.current?.setHdgHold(enabled, target);
  }, []);

  const loadRoute = useCallback(
    async (from: string, to: string, apiKey?: string) => {
      const engine = engineRef.current!;
      engine.setRouteLoading(true, null);
      try {
        const payload = await fetchFlightRoute({
          fromIcao: from,
          toIcao: to,
          apiKey,
        });
        engine.loadRoute(payload);
        return {
          summary: `${payload.from.icao} → ${payload.to.icao} · ${payload.distanceNm.toFixed(0)} NM · ${payload.source}`,
          rangeNm: engine.getState().rangeNm,
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        engine.setRouteLoading(false, msg);
        throw e instanceof Error ? e : new Error(msg);
      }
    },
    [],
  );

  const value = useMemo(
    () => ({
      state,
      routeLoading: state.routeLoad.loading,
      routeError: state.routeLoad.error,
      setDisplayMode,
      setRange,
      cycleRange,
      togglePlayPause,
      reset,
      loadRoute,
      setPhoneEnabled,
      setPhoneConnected,
      setPhoneEngaged,
      applyPhoneControl,
      setHdgHold,
    }),
    [
      state,
      setDisplayMode,
      setRange,
      cycleRange,
      togglePlayPause,
      reset,
      loadRoute,
      setPhoneEnabled,
      setPhoneConnected,
      setPhoneEngaged,
      applyPhoneControl,
      setHdgHold,
    ],
  );

  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav(): NavContextValue {
  const ctx = useContext(NavContext);
  if (!ctx) throw new Error("useNav must be used within NavProvider");
  return ctx;
}
