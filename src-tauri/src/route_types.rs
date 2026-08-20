use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AirportDto {
    pub icao: String,
    pub name: String,
    pub lat: f64,
    pub lon: f64,
    pub elevation_ft: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WaypointDto {
    pub ident: String,
    pub position: LatLonDto,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LatLonDto {
    pub lat: f64,
    pub lon: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadedRouteDto {
    pub from: AirportDto,
    pub to: AirportDto,
    pub waypoints: Vec<WaypointDto>,
    pub distance_nm: f64,
    pub cruise_alt_ft: f64,
    pub route_notes: String,
    pub source: String,
}
