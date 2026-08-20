use futures_util::{SinkExt, StreamExt};
use serde::Serialize;
use std::collections::HashSet;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::{broadcast, Mutex};
use tokio_tungstenite::{accept_async, tungstenite::Message};

pub const PHONE_WS_PORT: u16 = 8765;

struct Hub {
    phones: HashSet<SocketAddr>,
    desktops: HashSet<SocketAddr>,
}

impl Hub {
    fn new() -> Self {
        Self {
            phones: HashSet::new(),
            desktops: HashSet::new(),
        }
    }
}

/// Start the phone↔desktop WebSocket bridge on 0.0.0.0:8765
pub async fn start_phone_bridge() {
    let addr = SocketAddr::from(([0, 0, 0, 0], PHONE_WS_PORT));
    let listener = match TcpListener::bind(addr).await {
        Ok(l) => l,
        Err(e) => {
            eprintln!("[phone-bridge] bind failed on {addr}: {e}");
            return;
        }
    };
    eprintln!("[phone-bridge] listening on ws://0.0.0.0:{PHONE_WS_PORT}");

    let (tx, _) = broadcast::channel::<String>(128);
    let hub = Arc::new(Mutex::new(Hub::new()));

    loop {
        let Ok((stream, peer)) = listener.accept().await else {
            continue;
        };
        let tx = tx.clone();
        let hub = Arc::clone(&hub);
        tokio::spawn(handle_connection(stream, peer, tx, hub));
    }
}

async fn handle_connection(
    stream: TcpStream,
    peer: SocketAddr,
    tx: broadcast::Sender<String>,
    hub: Arc<Mutex<Hub>>,
) {
    let ws = match accept_async(stream).await {
        Ok(ws) => ws,
        Err(e) => {
            eprintln!("[phone-bridge] handshake failed {peer}: {e}");
            return;
        }
    };

    let (mut write, mut read) = ws.split();
    let mut rx = tx.subscribe();

    let send_task = async {
        while let Ok(msg) = rx.recv().await {
            if write.send(Message::Text(msg.into())).await.is_err() {
                break;
            }
        }
    };

    let recv_task = async {
        while let Some(Ok(msg)) = read.next().await {
            let Message::Text(text) = msg else { continue };
            let text_str = text.to_string();

            // Track role from hello; forward everything else to all peers
            if let Ok(serde_json::Value::Object(map)) = serde_json::from_str::<serde_json::Value>(&text_str) {
                if map.get("type").and_then(|v| v.as_str()) == Some("hello") {
                    let role = map
                        .get("role")
                        .and_then(|v| v.as_str())
                        .unwrap_or("unknown")
                        .to_string();
                    {
                        let mut h = hub.lock().await;
                        if role == "phone" {
                            h.phones.insert(peer);
                        } else {
                            h.desktops.insert(peer);
                        }
                    }
                    broadcast_status(&tx, &hub).await;
                    continue;
                }
            }

            let _ = tx.send(text_str);
        }
    };

    tokio::select! {
        _ = send_task => {},
        _ = recv_task => {},
    }

    {
        let mut h = hub.lock().await;
        h.phones.remove(&peer);
        h.desktops.remove(&peer);
    }
    broadcast_status(&tx, &hub).await;
}

async fn broadcast_status(tx: &broadcast::Sender<String>, hub: &Arc<Mutex<Hub>>) {
    let h = hub.lock().await;
    let status = serde_json::json!({
        "type": "status",
        "phoneConnected": !h.phones.is_empty(),
        "clients": h.phones.len() + h.desktops.len(),
    });
    let _ = tx.send(status.to_string());
}

#[tauri::command]
pub fn get_phone_link_info() -> Result<PhoneLinkInfo, String> {
    let ips = local_ipv4_addrs();
    Ok(PhoneLinkInfo {
        ws_port: PHONE_WS_PORT,
        http_port: 1420,
        addresses: ips,
    })
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PhoneLinkInfo {
    pub ws_port: u16,
    pub http_port: u16,
    pub addresses: Vec<String>,
}

fn local_ipv4_addrs() -> Vec<String> {
    let mut out = Vec::new();
    if let Ok(ifaces) = local_ip_address::list_afinet_netifas() {
        for (_name, ip) in ifaces {
            if let std::net::IpAddr::V4(v4) = ip {
                if !v4.is_loopback() && !v4.is_link_local() {
                    out.push(v4.to_string());
                }
            }
        }
    }
    out.sort();
    out.dedup();
    out
}
