import { NavProvider } from "./store/navState";
import { AttitudeCanvas } from "./components/AttitudeCanvas";
import { NDCanvas } from "./components/NDCanvas";
import { DataReadout } from "./components/DataReadout";
import { PhoneLinkPanel } from "./components/PhoneLinkPanel";
import "./App.css";

/** Desktop = EFIS displays only. FCC is on the phone. */
function App() {
  return (
    <NavProvider>
      <div className="app-shell display-station">
        <header className="app-header">
          <h1>EFIS</h1>
          <span className="subtitle">ATT · ND — managed by FCC (phone)</span>
        </header>

        <PhoneLinkPanel />

        <main className="cockpit-stage">
          <AttitudeCanvas />
          <div className="nd-panel">
            <DataReadout />
            <NDCanvas />
          </div>
        </main>
      </div>
    </NavProvider>
  );
}

export default App;
