#!/usr/bin/env python3
"""
P2-52 脑机接口监控
EEG/EMG 信号采集 + 神经反馈 + 实时解码
"""
import json
import math
import os
import random
import sqlite3
import threading
import time
import uuid
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse, parse_qs

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "logs", "bci_monitor.db")
HTTP_PORT = 10320

SIGNAL_TYPES = ["eeg", "emg", "eog", "ecog", "fnirs"]
DEVICE_STATUSES = ["connected", "disconnected", "calibrating", "error"]
DECODER_TYPES = ["motor", "speech", "visual", "emotion", "attention"]
BANDS = ["delta", "theta", "alpha", "beta", "gamma"]


def _now() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _init_db() -> None:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS devices (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            device_id TEXT NOT NULL UNIQUE,
            signal_type TEXT NOT NULL,
            channel_count INTEGER DEFAULT 1,
            sample_rate_hz INTEGER DEFAULT 256,
            status TEXT DEFAULT 'connected',
            battery_pct REAL DEFAULT 100,
            subject_id TEXT
        );
        CREATE TABLE IF NOT EXISTS signal_samples (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            device_id TEXT NOT NULL,
            channel_id INTEGER,
            amplitude_uv REAL,
            frequency_hz REAL,
            band TEXT
        );
        CREATE TABLE IF NOT EXISTS decoders (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            decoder_name TEXT NOT NULL,
            decoder_type TEXT NOT NULL,
            model_path TEXT,
            accuracy REAL DEFAULT 0,
            latency_ms REAL DEFAULT 0,
            enabled INTEGER DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS decoding_events (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            device_id TEXT NOT NULL,
            decoder_id TEXT,
            intent TEXT,
            confidence REAL,
            latency_ms REAL
        );
        CREATE TABLE IF NOT EXISTS neurofeedback (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            subject_id TEXT NOT NULL,
            band TEXT NOT NULL,
            target_value REAL,
            actual_value REAL,
            score REAL
        );
        CREATE TABLE IF NOT EXISTS session_summary (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            subject_id TEXT NOT NULL,
            session_start TEXT,
            session_end TEXT,
            duration_seconds INTEGER DEFAULT 0,
            event_count INTEGER DEFAULT 0,
            avg_attention REAL
        );
    """)
    conn.close()


_init_db()
_conn_lock = threading.Lock()


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def register_device(device_id: str, signal_type: str, channels: int = 64,
                      sample_rate: int = 256, subject_id: str = "") -> str:
    """注册 BCI 设备"""
    if signal_type not in SIGNAL_TYPES:
        signal_type = "eeg"
    did = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO devices
            (id,timestamp,device_id,signal_type,channel_count,sample_rate_hz,status,battery_pct,subject_id)
            VALUES (?,?,?,?,?,?,?,?,?)""",
            (did, _now(), device_id, signal_type, channels, sample_rate,
             "connected", 100.0, subject_id))
    return did


def record_sample(device_id: str, channel_id: int, amplitude_uv: float = 0.0,
                   frequency_hz: float = 0.0, band: str = "alpha") -> str:
    """记录信号样本"""
    if band not in BANDS:
        band = "alpha"
    sid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO signal_samples
            (id,timestamp,device_id,channel_id,amplitude_uv,frequency_hz,band)
            VALUES (?,?,?,?,?,?,?)""",
            (sid, _now(), device_id, channel_id, amplitude_uv, frequency_hz, band))
    return sid


def generate_random_sample(device_id: str) -> Dict:
    """生成随机样本 (模拟)"""
    band = random.choice(BANDS)
    freq_ranges = {"delta": (0.5, 4), "theta": (4, 8), "alpha": (8, 13),
                    "beta": (13, 30), "gamma": (30, 100)}
    f_range = freq_ranges[band]
    freq = random.uniform(*f_range)
    amp = random.uniform(1.0, 50.0)
    record_sample(device_id, random.randint(0, 63), amp, freq, band)
    return {"band": band, "freq": freq, "amp": amp}


def create_decoder(decoder_name: str, decoder_type: str,
                    model_path: str = "", accuracy: float = 0.0,
                    latency_ms: float = 0.0) -> str:
    """创建解码器"""
    if decoder_type not in DECODER_TYPES:
        decoder_type = "motor"
    did = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO decoders
            (id,timestamp,decoder_name,decoder_type,model_path,accuracy,latency_ms,enabled)
            VALUES (?,?,?,?,?,?,?,?)""",
            (did, _now(), decoder_name, decoder_type, model_path,
             accuracy, latency_ms, 1))
    return did


def record_decoding(device_id: str, decoder_id: str, intent: str = "",
                     confidence: float = 0.0, latency_ms: float = 0.0) -> str:
    """记录解码事件"""
    eid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO decoding_events
            (id,timestamp,device_id,decoder_id,intent,confidence,latency_ms)
            VALUES (?,?,?,?,?,?,?)""",
            (eid, _now(), device_id, decoder_id, intent, confidence, latency_ms))
    return eid


def record_feedback(subject_id: str, band: str, target: float, actual: float) -> str:
    """记录神经反馈"""
    if band not in BANDS:
        band = "alpha"
    score = max(0.0, 1.0 - abs(target - actual) / max(1, abs(target)))
    fid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO neurofeedback
            (id,timestamp,subject_id,band,target_value,actual_value,score)
            VALUES (?,?,?,?,?,?,?)""",
            (fid, _now(), subject_id, band, target, actual, score))
    return fid


def start_session(subject_id: str) -> str:
    """开始会话"""
    sid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO session_summary
            (id,timestamp,subject_id,session_start,session_end,duration_seconds,event_count,avg_attention)
            VALUES (?,?,?,?,?,?,?,?)""",
            (sid, _now(), subject_id, _now(), "", 0, 0, 0))
    return sid


def end_session(session_id: str, event_count: int, avg_attention: float) -> bool:
    """结束会话"""
    with _conn() as c:
        session = c.execute("""SELECT session_start FROM session_summary WHERE id=?""",
                             (session_id,)).fetchone()
    duration = 0
    if session and session["session_start"]:
        try:
            start = datetime.fromisoformat(session["session_start"].replace("Z", ""))
            duration = int((datetime.utcnow() - start).total_seconds())
        except Exception:
            duration = 0
    with _conn_lock, _conn() as c:
        c.execute("""UPDATE session_summary SET session_end=?, duration_seconds=?,
            event_count=?, avg_attention=? WHERE id=?""",
            (_now(), duration, event_count, avg_attention, session_id))
        return c.total_changes > 0


def get_bci_report() -> Dict:
    """BCI 报告"""
    with _conn() as c:
        devices = c.execute("""SELECT COUNT(*) as c FROM devices""").fetchone()["c"]
        connected = c.execute("""SELECT COUNT(*) as c FROM devices WHERE status='connected'""").fetchone()["c"]
        samples = c.execute("""SELECT COUNT(*) as c FROM signal_samples""").fetchone()["c"]
        decoders = c.execute("""SELECT COUNT(*) as c FROM decoders WHERE enabled=1""").fetchone()["c"]
        events = c.execute("""SELECT COUNT(*) as c FROM decoding_events""").fetchone()["c"]
        sessions = c.execute("""SELECT COUNT(*) as c FROM session_summary""").fetchone()["c"]
    return {
        "total_devices": devices,
        "connected_devices": connected,
        "total_samples": samples,
        "active_decoders": decoders,
        "decoding_events": events,
        "total_sessions": sessions,
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
            self._send(200, get_bci_report())
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
        if u.path == "/api/device":
            did = register_device(
                data.get("device_id", "dev-" + uuid.uuid4().hex[:6]),
                data.get("signal_type", "eeg"),
                data.get("channels", 64),
                data.get("sample_rate", 256),
                data.get("subject_id", ""),
            )
            self._send(200, {"device_id": did})
        elif u.path == "/api/sample":
            sid = record_sample(
                data.get("device_id", ""),
                data.get("channel_id", 0),
                data.get("amplitude_uv", 0.0),
                data.get("frequency_hz", 0.0),
                data.get("band", "alpha"),
            )
            self._send(200, {"sample_id": sid})
        elif u.path == "/api/sample/random":
            result = generate_random_sample(data.get("device_id", ""))
            self._send(200, result)
        elif u.path == "/api/decoder":
            did = create_decoder(
                data.get("decoder_name", "dec-" + uuid.uuid4().hex[:6]),
                data.get("decoder_type", "motor"),
                data.get("model_path", ""),
                data.get("accuracy", 0.0),
                data.get("latency_ms", 0.0),
            )
            self._send(200, {"decoder_id": did})
        elif u.path == "/api/decoding":
            eid = record_decoding(
                data.get("device_id", ""),
                data.get("decoder_id", ""),
                data.get("intent", ""),
                data.get("confidence", 0.0),
                data.get("latency_ms", 0.0),
            )
            self._send(200, {"event_id": eid})
        elif u.path == "/api/feedback":
            fid = record_feedback(
                data.get("subject_id", ""),
                data.get("band", "alpha"),
                data.get("target", 10.0),
                data.get("actual", 10.0),
            )
            self._send(200, {"feedback_id": fid})
        elif u.path == "/api/session/start":
            sid = start_session(data.get("subject_id", "default"))
            self._send(200, {"session_id": sid})
        elif u.path == "/api/session/end":
            ok = end_session(
                data.get("session_id", ""),
                data.get("event_count", 0),
                data.get("avg_attention", 0.0),
            )
            self._send(200, {"ok": ok})
        else:
            self._send(404, {"error": "not found"})


def start_server() -> None:
    s = HTTPServer(("0.0.0.0", HTTP_PORT), _Handler)
    t = threading.Thread(target=s.serve_forever, daemon=True)
    t.start()


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(description="P2-52 脑机接口监控")
    p.add_argument("--serve", action="store_true")
    a = p.parse_args()
    if a.serve:
        start_server()
        print(f"BCI HTTP 服务已启动: {HTTP_PORT}")
        while True:
            time.sleep(60)
    else:
        print(json.dumps(get_bci_report(), ensure_ascii=False, indent=2))
