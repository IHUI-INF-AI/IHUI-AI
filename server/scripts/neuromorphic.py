#!/usr/bin/env python3
"""
P2-50 神经形态计算监控
脉冲神经网络 + 神经形态芯片监控
"""
import json
import os
import sqlite3
import threading
import time
import uuid
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse, parse_qs

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "logs", "neuromorphic.db")
HTTP_PORT = 10300

CHIP_TYPES = ["loihi", "truenorth", "akida", "spinnaker", "dynap"]
NEURON_MODELS = ["lif", "izhikevich", "hodgkin_huxley", "adaptive_lif", "srnn"]
LEARNING_RULES = ["stdp", "stdp_triplet", "hebbian", "anti_hebbian", "bcm"]


def _now() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _init_db() -> None:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS neuromorphic_chips (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            chip_id TEXT NOT NULL UNIQUE,
            chip_type TEXT NOT NULL,
            core_count INTEGER DEFAULT 0,
            neuron_count INTEGER DEFAULT 0,
            synapse_count INTEGER DEFAULT 0,
            temperature_c REAL DEFAULT 25.0,
            power_mw REAL DEFAULT 0,
            status TEXT DEFAULT 'active'
        );
        CREATE TABLE IF NOT EXISTS spike_events (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            chip_id TEXT NOT NULL,
            neuron_id TEXT,
            spike_time_us INTEGER,
            voltage_mv REAL,
            core_id INTEGER
        );
        CREATE TABLE IF NOT EXISTS snn_networks (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            network_name TEXT NOT NULL,
            chip_id TEXT,
            neuron_model TEXT,
            learning_rule TEXT,
            layer_count INTEGER DEFAULT 1,
            accuracy REAL DEFAULT 0,
            status TEXT DEFAULT 'active'
        );
        CREATE TABLE IF NOT EXISTS chip_metrics (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            chip_id TEXT NOT NULL,
            spikes_per_second REAL DEFAULT 0,
            avg_latency_us REAL DEFAULT 0,
            power_consumption_mw REAL DEFAULT 0,
            temperature_c REAL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS learning_progress (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            network_id TEXT NOT NULL,
            epoch INTEGER,
            accuracy REAL,
            loss REAL,
            spike_count INTEGER
        );
    """)
    conn.close()


_init_db()
_conn_lock = threading.Lock()


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def register_chip(chip_id: str, chip_type: str, cores: int = 128,
                   neurons: int = 0, synapses: int = 0) -> str:
    """注册神经形态芯片"""
    if chip_type not in CHIP_TYPES:
        chip_type = "loihi"
    cid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO neuromorphic_chips
            (id,timestamp,chip_id,chip_type,core_count,neuron_count,synapse_count,temperature_c,power_mw,status)
            VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (cid, _now(), chip_id, chip_type, cores, neurons, synapses, 25.0, 0, "active"))
    return cid


def record_spike(chip_id: str, neuron_id: str, voltage: float = 20.0,
                  core_id: int = 0) -> str:
    """记录脉冲事件"""
    sid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO spike_events
            (id,timestamp,chip_id,neuron_id,spike_time_us,voltage_mv,core_id)
            VALUES (?,?,?,?,?,?,?)""",
            (sid, _now(), chip_id, neuron_id, int(time.time() * 1_000_000), voltage, core_id))
    return sid


def create_network(network_name: str, chip_id: str = "",
                    neuron_model: str = "lif",
                    learning_rule: str = "stdp",
                    layers: int = 1) -> str:
    """创建 SNN 网络"""
    if neuron_model not in NEURON_MODELS:
        neuron_model = "lif"
    if learning_rule not in LEARNING_RULES:
        learning_rule = "stdp"
    nid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO snn_networks
            (id,timestamp,network_name,chip_id,neuron_model,learning_rule,layer_count,accuracy,status)
            VALUES (?,?,?,?,?,?,?,?,?)""",
            (nid, _now(), network_name, chip_id, neuron_model,
             learning_rule, layers, 0, "active"))
    return nid


def record_chip_metric(chip_id: str, spikes_per_sec: float = 0,
                         latency_us: float = 0, power_mw: float = 0,
                         temperature: float = 25.0) -> str:
    """记录芯片指标"""
    mid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO chip_metrics
            (id,timestamp,chip_id,spikes_per_second,avg_latency_us,power_consumption_mw,temperature_c)
            VALUES (?,?,?,?,?,?,?)""",
            (mid, _now(), chip_id, spikes_per_sec, latency_us, power_mw, temperature))
        c.execute("""UPDATE neuromorphic_chips SET power_mw=?, temperature_c=?
            WHERE chip_id=?""", (power_mw, temperature, chip_id))
    return mid


def record_learning(network_id: str, epoch: int, accuracy: float,
                     loss: float, spike_count: int) -> str:
    """记录学习进度"""
    lid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO learning_progress
            (id,timestamp,network_id,epoch,accuracy,loss,spike_count)
            VALUES (?,?,?,?,?,?,?)""",
            (lid, _now(), network_id, epoch, accuracy, loss, spike_count))
        c.execute("""UPDATE snn_networks SET accuracy=? WHERE id=?""",
                   (accuracy, network_id))
    return lid


def get_neuromorphic_report() -> Dict:
    """神经形态报告"""
    with _conn() as c:
        chips = c.execute("""SELECT COUNT(*) as c FROM neuromorphic_chips""").fetchone()["c"]
        active = c.execute("""SELECT COUNT(*) as c FROM neuromorphic_chips WHERE status='active'""").fetchone()["c"]
        spikes = c.execute("""SELECT COUNT(*) as c FROM spike_events""").fetchone()["c"]
        networks = c.execute("""SELECT COUNT(*) as c FROM snn_networks""").fetchone()["c"]
        total_neurons = c.execute("""SELECT SUM(neuron_count) as s FROM neuromorphic_chips""").fetchone()["s"] or 0
        avg_power = c.execute("""SELECT AVG(power_consumption_mw) as a FROM chip_metrics""").fetchone()["a"] or 0
    return {
        "total_chips": chips,
        "active_chips": active,
        "total_spikes": spikes,
        "total_networks": networks,
        "total_neurons": total_neurons,
        "avg_power_mw": avg_power,
    }


class _Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def _send(self, code: int, data: Any) -> None:
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        u = urlparse(self.path)
        if u.path == "/api/health":
            self._send(200, {"status": "ok", "port": HTTP_PORT})
        elif u.path == "/api/report":
            self._send(200, get_neuromorphic_report())
        else:
            self._send(404, {"error": "not found"})

    def do_POST(self) -> None:
        u = urlparse(self.path)
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        try:
            data = json.loads(raw)
        except Exception:
            data = {}
        if u.path == "/api/chip":
            cid = register_chip(
                data.get("chip_id", "chip-" + uuid.uuid4().hex[:6]),
                data.get("chip_type", "loihi"),
                data.get("cores", 128),
                data.get("neurons", 0),
                data.get("synapses", 0),
            )
            self._send(200, {"chip_id": cid})
        elif u.path == "/api/spike":
            sid = record_spike(
                data.get("chip_id", ""),
                data.get("neuron_id", "n1"),
                data.get("voltage", 20.0),
                data.get("core_id", 0),
            )
            self._send(200, {"spike_id": sid})
        elif u.path == "/api/network":
            nid = create_network(
                data.get("network_name", "net-" + uuid.uuid4().hex[:6]),
                data.get("chip_id", ""),
                data.get("neuron_model", "lif"),
                data.get("learning_rule", "stdp"),
                data.get("layers", 1),
            )
            self._send(200, {"network_id": nid})
        elif u.path == "/api/metric":
            mid = record_chip_metric(
                data.get("chip_id", ""),
                data.get("spikes_per_sec", 0),
                data.get("latency_us", 0),
                data.get("power_mw", 0),
                data.get("temperature", 25.0),
            )
            self._send(200, {"metric_id": mid})
        elif u.path == "/api/learning":
            lid = record_learning(
                data.get("network_id", ""),
                data.get("epoch", 0),
                data.get("accuracy", 0),
                data.get("loss", 0),
                data.get("spike_count", 0),
            )
            self._send(200, {"learning_id": lid})
        else:
            self._send(404, {"error": "not found"})


def start_server() -> None:
    s = HTTPServer(("0.0.0.0", HTTP_PORT), _Handler)
    t = threading.Thread(target=s.serve_forever, daemon=True)
    t.start()


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(description="P2-50 神经形态计算监控")
    p.add_argument("--serve", action="store_true")
    a = p.parse_args()
    if a.serve:
        start_server()
        print(f"神经形态 HTTP 服务已启动: {HTTP_PORT}")
        while True:
            time.sleep(60)
    else:
        print(json.dumps(get_neuromorphic_report(), ensure_ascii=False, indent=2))
