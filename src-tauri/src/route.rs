use crate::route_types::{AirportDto, LatLonDto, LoadedRouteDto, WaypointDto};
use serde::Deserialize;
use std::f64::consts::PI;

const EARTH_RADIUS_NM: f64 = 3440.065;
const FPD_BASE: &str = "https://api.flightplandatabase.com";

/// Embedded fallback airports (major hubs — used when API unavailable).
fn fallback_airport(icao: &str) -> Option<AirportDto> {
    let table: &[(&str, &str, f64, f64, f64)] = &[
        ("LTFM", "Istanbul Airport", 41.275278, 28.751944, 325.0),
        ("LTBA", "Istanbul Ataturk", 40.976111, 28.814167, 163.0),
        ("LHBP", "Budapest Ferenc Liszt", 47.436944, 19.255556, 495.0),
        ("EDDF", "Frankfurt Main", 50.026421, 8.543125, 364.0),
        ("EGLL", "London Heathrow", 51.470556, -0.461941, 83.0),
        ("LFPG", "Paris Charles de Gaulle", 49.009722, 2.547778, 392.0),
        ("LEMD", "Madrid Barajas", 40.493556, -3.566764, 2000.0),
        ("LIRF", "Rome Fiumicino", 41.800278, 12.238889, 15.0),
        ("EDDM", "Munich", 48.353783, 11.786086, 1487.0),
        ("LOWW", "Vienna", 48.110278, 16.569722, 600.0),
        ("LSZH", "Zurich", 47.464722, 8.549167, 1416.0),
        ("EBBR", "Brussels", 50.901389, 4.484444, 184.0),
        ("EHAM", "Amsterdam Schiphol", 52.308613, 4.763889, -11.0),
        ("LGAV", "Athens Eleftherios Venizelos", 37.936389, 23.944444, 308.0),
        ("LTAI", "Antalya", 36.898731, 30.800461, 177.0),
        ("LTAC", "Ankara Esenboga", 40.128082, 32.995083, 3125.0),
        ("LTFE", "Milas Bodrum", 37.250617, 27.664317, 21.0),
        ("LTFJ", "Istanbul Sabiha Gokcen", 40.898553, 29.309219, 312.0),
        ("KJFK", "New York JFK", 40.639801, -73.778900, 13.0),
        ("KLAX", "Los Angeles Intl", 33.942536, -118.408075, 125.0),
        ("OMDB", "Dubai Intl", 25.252778, 55.364444, 62.0),
        ("OTHH", "Doha Hamad", 25.273056, 51.608056, 13.0),
        ("UUEE", "Moscow Sheremetyevo", 55.972642, 37.414589, 622.0),
        ("UUDD", "Moscow Domodedovo", 55.408611, 37.906111, 588.0),
    ];
    let key = icao.to_uppercase();
    table
        .iter()
        .find(|(code, _, _, _, _)| *code == key.as_str())
        .map(|(_, name, lat, lon, elev)| AirportDto {
            icao: key,
            name: (*name).to_string(),
            lat: *lat,
            lon: *lon,
            elevation_ft: *elev,
        })
}

fn normalize_icao(s: &str) -> String {
    s.trim().to_uppercase()
}

fn to_rad(deg: f64) -> f64 {
    deg * PI / 180.0
}

fn to_deg(rad: f64) -> f64 {
    rad * 180.0 / PI
}

fn normalize_heading(deg: f64) -> f64 {
    let mut h = deg % 360.0;
    if h < 0.0 {
        h += 360.0;
    }
    h
}

fn distance_nm(a: (f64, f64), b: (f64, f64)) -> f64 {
    let (lat1, lon1) = (to_rad(a.0), to_rad(a.1));
    let (lat2, lon2) = (to_rad(b.0), to_rad(b.1));
    let dlat = lat2 - lat1;
    let dlon = lon2 - lon1;
    let h = (dlat / 2.0).sin().powi(2)
        + lat1.cos() * lat2.cos() * (dlon / 2.0).sin().powi(2);
    2.0 * EARTH_RADIUS_NM * h.sqrt().asin()
}

fn bearing_deg(from: (f64, f64), to: (f64, f64)) -> f64 {
    let (lat1, lon1) = (to_rad(from.0), to_rad(from.1));
    let (lat2, lon2) = (to_rad(to.0), to_rad(to.1));
    let dlon = lon2 - lon1;
    let y = dlon.sin() * lat2.cos();
    let x = lat1.cos() * lat2.sin() - lat1.sin() * lat2.cos() * dlon.cos();
    normalize_heading(to_deg(y.atan2(x)))
}

fn destination(from: (f64, f64), dist_nm: f64, brg: f64) -> (f64, f64) {
    let d = dist_nm / EARTH_RADIUS_NM;
    let brg_r = to_rad(brg);
    let lat1 = to_rad(from.0);
    let lon1 = to_rad(from.1);
    let lat2 = (lat1.sin() * d.cos() + lat1.cos() * d.sin() * brg_r.cos()).asin();
    let lon2 = lon1
        + (brg_r.sin() * d.sin() * lat1.cos()).atan2(d.cos() - lat1.sin() * lat2.sin());
    (to_deg(lat2), to_deg(lon2))
}

fn generate_great_circle_route(from: &AirportDto, to: &AirportDto) -> LoadedRouteDto {
    let total = distance_nm((from.lat, from.lon), (to.lat, to.lon));
    let segments = ((total / 40.0).ceil() as usize).clamp(4, 24);
    let mut waypoints = Vec::with_capacity(segments + 1);

    for i in 0..=segments {
        let frac = i as f64 / segments as f64;
        let dist = total * frac;
        let brg = bearing_deg((from.lat, from.lon), (to.lat, to.lon));
        let (lat, lon) = destination((from.lat, from.lon), dist, brg);
        let ident = if i == 0 {
            from.icao.clone()
        } else if i == segments {
            to.icao.clone()
        } else {
            format!("W{:02}", i)
        };
        waypoints.push(WaypointDto {
            ident,
            position: LatLonDto { lat, lon },
        });
    }

    let cruise = if total > 300.0 {
        37000.0
    } else if total > 150.0 {
        35000.0
    } else if total > 50.0 {
        28000.0
    } else {
        18000.0
    };

    LoadedRouteDto {
        from: from.clone(),
        to: to.clone(),
        waypoints,
        distance_nm: total,
        cruise_alt_ft: cruise,
        route_notes: "Great-circle fallback (airway database unavailable)".to_string(),
        source: "Fallback GC".to_string(),
    }
}

#[derive(Debug, Deserialize)]
struct FpdAirport {
    #[serde(rename = "ICAO")]
    icao: String,
    name: String,
    lat: f64,
    lon: f64,
    elevation: f64,
}

#[derive(Debug, Deserialize)]
struct FpdSearchPlan {
    id: u64,
    #[serde(rename = "fromICAO")]
    from_icao: Option<String>,
    #[serde(rename = "toICAO")]
    to_icao: Option<String>,
    #[serde(rename = "maxAltitude")]
    max_altitude: f64,
    distance: f64,
    popularity: f64,
    downloads: f64,
}

#[derive(Debug, Deserialize)]
struct FpdRouteNode {
    ident: String,
    lat: f64,
    lon: f64,
    #[serde(rename = "type")]
    node_type: String,
}

#[derive(Debug, Deserialize)]
struct FpdRoute {
    nodes: Vec<FpdRouteNode>,
}

#[derive(Debug, Deserialize)]
struct FpdPlan {
    id: u64,
    #[serde(rename = "fromICAO")]
    from_icao: Option<String>,
    #[serde(rename = "toICAO")]
    to_icao: Option<String>,
    #[serde(rename = "fromName")]
    from_name: Option<String>,
    #[serde(rename = "toName")]
    to_name: Option<String>,
    #[serde(rename = "maxAltitude")]
    max_altitude: f64,
    distance: f64,
    notes: Option<String>,
    route: Option<FpdRoute>,
}

#[derive(Debug, Deserialize)]
struct FpdGeneratePlan {
    id: u64,
    distance: f64,
    #[serde(rename = "maxAltitude")]
    max_altitude: f64,
    notes: Option<String>,
}

async fn http_get(client: &reqwest::Client, url: &str, api_key: Option<&str>) -> Result<String, String> {
    let mut req = client
        .get(url)
        .header("Accept", "application/json")
        .header("X-Units", "AVIATION");
    if let Some(key) = api_key {
        req = req.basic_auth(key, Some(""));
    }
    let resp = req
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("HTTP {} for {url}", resp.status()));
    }
    resp.text()
        .await
        .map_err(|e| format!("Read error: {e}"))
}

async fn fetch_airport_fpd(
    client: &reqwest::Client,
    icao: &str,
    api_key: Option<&str>,
) -> Option<AirportDto> {
    let url = format!("{FPD_BASE}/nav/airport/{icao}");
    let body = http_get(client, &url, api_key).await.ok()?;
    let parsed: FpdAirport = serde_json::from_str(&body).ok()?;
    Some(AirportDto {
        icao: parsed.icao,
        name: parsed.name,
        lat: parsed.lat,
        lon: parsed.lon,
        elevation_ft: parsed.elevation,
    })
}

async fn resolve_airport(
    client: &reqwest::Client,
    icao: &str,
    api_key: Option<&str>,
) -> Result<AirportDto, String> {
    if let Some(a) = fetch_airport_fpd(client, icao, api_key).await {
        return Ok(a);
    }
    fallback_airport(icao).ok_or_else(|| format!("Unknown airport: {icao}"))
}

async fn search_plan_id(
    client: &reqwest::Client,
    from: &str,
    to: &str,
    api_key: Option<&str>,
) -> Option<u64> {
    let url = format!(
        "{FPD_BASE}/search/plans?fromICAO={from}&toICAO={to}&sort=popularity&limit=5"
    );
    let body = http_get(client, &url, api_key).await.ok()?;
    let plans: Vec<FpdSearchPlan> = serde_json::from_str(&body).ok()?;
    plans
        .into_iter()
        .max_by(|a, b| {
            a.popularity
                .partial_cmp(&b.popularity)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then(
                    a.downloads
                        .partial_cmp(&b.downloads)
                        .unwrap_or(std::cmp::Ordering::Equal),
                )
        })
        .map(|p| p.id)
}

async fn fetch_plan(
    client: &reqwest::Client,
    id: u64,
    api_key: Option<&str>,
) -> Option<FpdPlan> {
    let url = format!("{FPD_BASE}/plan/{id}");
    let body = http_get(client, &url, api_key).await.ok()?;
    serde_json::from_str(&body).ok()
}

async fn generate_plan(
    client: &reqwest::Client,
    from: &str,
    to: &str,
    api_key: &str,
) -> Option<FpdGeneratePlan> {
    let url = format!("{FPD_BASE}/auto/generate");
    let resp = client
        .post(&url)
        .header("Content-Type", "application/json")
        .header("X-Units", "AVIATION")
        .basic_auth(api_key, Some(""))
        .json(&serde_json::json!({
            "fromICAO": from,
            "toICAO": to,
            "useNAT": true,
            "usePACOT": false,
            "useAWYLO": true,
            "useAWYHI": true,
            "cruiseAlt": 35000,
            "cruiseSpeed": 420
        }))
        .send()
        .await
        .ok()?;
    if !resp.status().is_success() {
        return None;
    }
    let body = resp.text().await.ok()?;
    serde_json::from_str(&body).ok()
}

fn plan_to_route(
    plan: FpdPlan,
    from: AirportDto,
    to: AirportDto,
    source: &str,
) -> Option<LoadedRouteDto> {
    let route = plan.route?;
    if route.nodes.len() < 2 {
        return None;
    }
    let waypoints: Vec<WaypointDto> = route
        .nodes
        .iter()
        .map(|n| WaypointDto {
            ident: n.ident.clone(),
            position: LatLonDto {
                lat: n.lat,
                lon: n.lon,
            },
        })
        .collect();

    let cruise = if plan.max_altitude > 1000.0 {
        plan.max_altitude
    } else {
        35000.0
    };

    Some(LoadedRouteDto {
        from,
        to,
        waypoints,
        distance_nm: plan.distance,
        cruise_alt_ft: cruise,
        route_notes: plan.notes.unwrap_or_default(),
        source: source.to_string(),
    })
}

#[tauri::command]
pub async fn lookup_airport(icao: String) -> Result<AirportDto, String> {
    let icao = normalize_icao(&icao);
    if icao.len() < 3 || icao.len() > 4 {
        return Err("ICAO must be 3–4 characters".to_string());
    }
    let client = reqwest::Client::builder()
        .user_agent("NavigationDisplayPrototype/0.1")
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;
    resolve_airport(&client, &icao, None).await
}

#[tauri::command]
pub async fn fetch_flight_route(
    from_icao: String,
    to_icao: String,
    api_key: Option<String>,
) -> Result<LoadedRouteDto, String> {
    let from_code = normalize_icao(&from_icao);
    let to_code = normalize_icao(&to_icao);
    if from_code.len() < 3 || to_code.len() > 4 || to_code.len() < 3 || to_code.len() > 4 {
        return Err("Enter valid ICAO codes (3–4 chars) for DEP and ARR".to_string());
    }
    if from_code == to_code {
        return Err("Departure and arrival must differ".to_string());
    }

    let client = reqwest::Client::builder()
        .user_agent("NavigationDisplayPrototype/0.1")
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?;

    let key_ref = api_key.as_deref().filter(|k| !k.is_empty());

    let from = resolve_airport(&client, &from_code, key_ref).await?;
    let to = resolve_airport(&client, &to_code, key_ref).await?;

    // 1) Try auto/generate if API key provided
    if let Some(key) = key_ref {
        if let Some(gen) = generate_plan(&client, &from_code, &to_code, key).await {
            if let Some(full) = fetch_plan(&client, gen.id, Some(key)).await {
                if let Some(route) = plan_to_route(full, from.clone(), to.clone(), "FPD Generator") {
                    return Ok(route);
                }
            }
        }
    }

    // 2) Search existing community / generated plans
    if let Some(plan_id) = search_plan_id(&client, &from_code, &to_code, key_ref).await {
        if let Some(plan) = fetch_plan(&client, plan_id, key_ref).await {
            if let Some(route) = plan_to_route(plan, from.clone(), to.clone(), "Flight Plan Database") {
                return Ok(route);
            }
        }
    }

    // 3) Great-circle fallback
    Ok(generate_great_circle_route(&from, &to))
}
