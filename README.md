# EFIS Navigation Display — Desktop Prototype

English below · Türkçe üstte

---

## Türkçe

Stipendium Hungaricum mülakatında havacılık / avionics ilgisini göstermek için hazırlanmış **gerçeğe yakın bir EFIS Navigation Display (ND)** masaüstü prototipi.

Gerçek yolcu uçaklarında (Airbus A320 / Boeing 737 sınıfı) pilotun önündeki **PFD (Attitude Indicator)** ve **Navigation Display (ND)** çiftini taklit eder.

### Özellikler

| Özellik | Açıklama |
|---------|----------|
| **Attitude Indicator** | Yapay ufuk: pitch/roll, gökyüzü-zemin, pitch ladder, dijital ALT/VS |
| **ROSE NAV** | 360° pusula, heading-up en-route görünüm |
| **ARC** | İleri ~90° sektör, taktik navigasyon |
| **PLAN** | True north-up rota inceleme |
| **Gerçek rota** | DEP/ARR ICAO → Flight Plan Database (airway rotaları) |
| **Uçuş fazları** | PARKED → TAXI → TAKEOFF → CLIMB → CRUISE → DESCENT → APPROACH → LANDING |
| Menzil | 10 / 20 / 40 / 80 / 160 / 320 NM |
| Simülasyon | Canlı pitch/bank/altitude, waypoint sequencing, rüzgar drift |
| EFIS renkleri | Beyaz skala, yeşil uçuş planı, sarı uçak/lubber, mavi HDG bug |
| **Phone as Aircraft** | Telefon jiroskopu → canlı pitch/roll (Wi‑Fi) |

### Rota yükleme

1. Üst panelde **DEP** ve **ARR** ICAO kodlarını girin (ör. `LTFM` → `LHBP`).
2. **LOAD ROUTE** ile rotayı çekin.
3. Veri kaynağı sırası:
   - **Flight Plan Database** — paylaşılmış gerçek simülasyon rotaları (airway/fix)
   - **FPD API Key** (opsiyonel) — [flightplandatabase.com](https://flightplandatabase.com) hesabından otomatik rota üretici
   - **Fallback GC** — API erişilemezse great-circle yedek rota

> Simülasyon amaçlıdır; gerçek operasyonel navigasyon için kullanılmaz.

## FCC (telefon) + EFIS ekranları (masaüstü)

| Cihaz | Rol |
|-------|-----|
| **Telefon → FCC** | https://flight-prototip.vercel.app/phone.html — FMS, EFIS, FLY |
| **Masaüstü → EFIS** | `npm run tauri dev` — ATT + ND |

1. Masaüstünde `npm run tauri dev`
2. **FCC URL** kopyala (PeerJS link: `…/phone.html?peer=…`)
3. Telefonda aç → CONNECT → LOAD RTE → ENGAGE · FLY

> FCC Vercel’de HTTPS; masaüstü ile bağlantı PeerJS (WebRTC) üzerinden — aynı Wi‑Fi şart değil.

### Çalıştırma

**Gereksinimler:** Node.js 18+, Rust (rustup), Windows’ta MSVC Build Tools

```bash
npm install
npm run tauri dev
```

Üretim derlemesi:

```bash
npm run tauri build
```

### Mülakatta vurgulanacak noktalar

1. **EFIS ND nedir?** — FMS uçuş planı, heading/track, menzil ve navaid bilgisinin birleştirildiği navigasyon ekranı.
2. **Mod farkları** — ROSE (360°), ARC (ileri sektör), PLAN (north-up). Pilot görevine göre seçilir.
3. **Renk disiplini** — Airbus/Boeing EFIS paleti: yeşil = rota, sarı = uçak/referans, mavi = seçili değer, beyaz = skala.
4. **Koordinat sistemi** — WGS-84 lat/lon → haversine mesafe/bearing → heading-up ekran projeksiyonu.
5. **Mimari** — Simülasyon motoru (10 Hz) → nav state → Canvas renderer; UI kontrol paneli state’i günceller.
6. **Gerçek sistemlerde** — ARINC 429/664 veri yolları, FMS entegrasyonu, DO-178C yazılım güvencesi (bu prototip eğitim amaçlıdır, sertifikalı yazılım değildir).

### Mimari

```
FlightSimEngine (10 Hz)
        │
        ▼
   NavStateStore ──► DataReadout (GS/TAS/Wind/TO WPT)
        │
        ▼
   NDCanvas / renderND
   (range rings → compass → flight plan → aircraft → annunciations)
```

### Genişletme fikirleri

- ROSE VOR / ROSE ILS (LOC–GS iğneleri)
- ARINC 424 nav database
- Gerçek ADS-B veya flight recorder replay
- PFD + ND birlikte multi-display

---

## English

Desktop prototype of an **EFIS Navigation Display** for demonstrating aerospace / avionics interest (e.g. Stipendium Hungaricum interview).

It approximates the **PFD attitude indicator** and **ND** on transport-category aircraft: pitch/roll horizon, heading-up ROSE/ARC modes, north-up PLAN, real route loading from ICAO pairs, flight phases, and live telemetry.

### Route loading

Enter DEP/ARR ICAO codes and click **LOAD ROUTE**. Routes are fetched via the Flight Plan Database API (Tauri backend, no browser CORS). Optional FPD API key enables the route generator for fresh airway-based plans.

### Run

```bash
npm install
npm run tauri dev
```

### Interview talking points

1. What an EFIS ND shows and why modes exist (ROSE / ARC / PLAN)
2. EFIS color conventions and why they matter for pilot scan
3. Lat/lon → screen projection with heading-up rotation
4. Separation of simulation, state, and rendering layers
5. How real systems differ (avionics buses, FMS, certification)

### Tech stack

- **Tauri 2** — lightweight native desktop shell
- **React + TypeScript + Vite** — UI
- **HTML Canvas 2D** — 60 fps EFIS symbology

### License / disclaimer

Educational prototype only. Not flight software. Not for operational use.
