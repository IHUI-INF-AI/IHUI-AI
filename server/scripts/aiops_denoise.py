#!/usr/bin/env python3
"""
AI 驱动的告警降噪 2.0
P1-24: 误报率训练, 自适应阈值, 告警自动合并, 告警语义理解
"""
import json
import math
import os
import sqlite3
import threading
import time
import uuid
from collections import defaultdict
from datetime import timedelta
from app.utils.datetime_helper import utcnow
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse, parse_qs

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "logs", "aiops_denoise.db")
HTTP_PORT = 10040

ALERT_SEVERITIES = ["critical", "warning", "info"]
FEEDBACK_TYPES = ["true_positive", "false_positive", "ack", "silence"]
NOISE_CATEGORIES = ["flapping", "duplicate", "stale", "low_value", "known_issue"]
SEMANTIC_KEYWORDS = {
    "outage": ["down", "outage", "offline", "unavailable", "crash"],
    "performance": ["slow", "latency", "timeout", "degraded"],
    "capacity": ["full", "exhausted", "limit", "quota", "threshold"],
    "security": ["breach", "unauthorized", "attack", "intrusion", "vulnerability"],
    "data": ["corrupt", "loss", "inconsistent", "missing"],
}


def _now() -> str:
    return utcnow().isoformat() + "Z"


def _init_db() -> None:
    db_dir = os.path.dirname(DB_PATH)
    os.makedirs(db_dir, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS alert_history (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            alert_name TEXT NOT NULL,
            severity TEXT,
            service TEXT,
            labels TEXT,
            message TEXT,
            fingerprint TEXT,
            status TEXT DEFAULT 'firing'
        );
        CREATE TABLE IF NOT EXISTS alert_feedback (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            alert_id TEXT,
            feedback_type TEXT,
            user TEXT,
            comment TEXT
        );
        CREATE TABLE IF NOT EXISTS noise_patterns (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            pattern_type TEXT,
            alert_name TEXT,
            false_positive_rate REAL,
            suggestion TEXT
        );
        CREATE TABLE IF NOT EXISTS adaptive_thresholds (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            metric_name TEXT NOT NULL,
            current_value REAL,
            adaptive_value REAL,
            baseline_value REAL,
            confidence REAL
        );
        CREATE TABLE IF NOT EXISTS alert_groups (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            group_key TEXT NOT NULL,
            alert_count INTEGER,
            representative_id TEXT,
            merged_ids TEXT
        );
        CREATE TABLE IF NOT EXISTS alert_semantics (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            alert_id TEXT,
            category TEXT,
            keywords_matched TEXT,
            semantic_score REAL
        );
        CREATE INDEX IF NOT EXISTS idx_alert_history_ts ON alert_history(timestamp);
        CREATE INDEX IF NOT EXISTS idx_alert_history_name ON alert_history(alert_name);
    """)
    conn.close()


_init_db()
_conn_lock = threading.Lock()


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def compute_fingerprint(alert_name: str, labels: Dict[str, str]) -> str:
    """计算告警指纹"""
    sorted_labels = json.dumps(labels, sort_keys=True, ensure_ascii=False)
    import hashlib
    h = hashlib.md5(f"{alert_name}|{sorted_labels}".encode("utf-8")).hexdigest()
    return h[:16]


def record_alert(alert_name: str, severity: str, service: str,
                  labels: Dict[str, str], message: str = "") -> str:
    """记录告警"""
    if severity not in ALERT_SEVERITIES:
        severity = "warning"
    fp = compute_fingerprint(alert_name, labels)
    aid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO alert_history
            (id,timestamp,alert_name,severity,service,labels,message,fingerprint,status)
            VALUES (?,?,?,?,?,?,?,?,?)""",
            (aid, _now(), alert_name, severity, service,
             json.dumps(labels, ensure_ascii=False), message, fp, "firing"))
    return aid


def record_feedback(alert_id: str, feedback_type: str,
                     user: str = "", comment: str = "") -> str:
    """记录告警反馈"""
    if feedback_type not in FEEDBACK_TYPES:
        feedback_type = "ack"
    fid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO alert_feedback
            (id,timestamp,alert_id,feedback_type,user,comment)
            VALUES (?,?,?,?,?,?)""",
            (fid, _now(), alert_id, feedback_type, user, comment))
    return fid


def calc_false_positive_rate(alert_name: str, window_days: int = 30) -> float:
    """计算误报率"""
    since = (utcnow() - timedelta(days=window_days)).isoformat() + "Z"
    with _conn_lock, _conn() as c:
        total = c.execute("""SELECT COUNT(*) as cnt FROM alert_history
            WHERE alert_name = ? AND timestamp >= ?""",
            (alert_name, since)).fetchone()["cnt"]
        if total == 0:
            return 0.0
        fp = c.execute("""SELECT COUNT(*) as cnt FROM alert_feedback f
            JOIN alert_history a ON f.alert_id = a.id
            WHERE a.alert_name = ? AND f.feedback_type = 'false_positive'
            AND f.timestamp >= ?""", (alert_name, since)).fetchone()["cnt"]
    return round(fp / total, 4)


def train_noise_pattern(alert_name: str) -> Dict[str, Any]:
    """训练噪声模式"""
    fp_rate = calc_false_positive_rate(alert_name)
    pattern_type = "low_noise" if fp_rate < 0.1 else "medium_noise" if fp_rate < 0.4 else "high_noise"
    if fp_rate >= 0.7:
        suggestion = "建议禁用此告警, 误报率过高"
    elif fp_rate >= 0.4:
        suggestion = "建议调整阈值或抑制规则"
    elif fp_rate >= 0.1:
        suggestion = "建议增加确认机制"
    else:
        suggestion = "告警质量良好, 保持现状"
    pid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO noise_patterns
            (id,timestamp,pattern_type,alert_name,false_positive_rate,suggestion)
            VALUES (?,?,?,?,?,?)""",
            (pid, _now(), pattern_type, alert_name, fp_rate, suggestion))
    return {
        "alert_name": alert_name,
        "pattern_type": pattern_type,
        "false_positive_rate": fp_rate,
        "suggestion": suggestion,
    }


def adaptive_threshold(metric_name: str, baseline_value: float,
                        current_value: float, std_dev: float = 0.0,
                        sensitivity: float = 1.5) -> Dict[str, Any]:
    """自适应阈值"""
    if std_dev <= 0:
        confidence = 0.5
        adaptive = baseline_value * (1 + 0.1 * sensitivity)
    else:
        confidence = min(1.0, abs(current_value - baseline_value) / (3 * std_dev))
        adaptive = baseline_value + sensitivity * std_dev
    tid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO adaptive_thresholds
            (id,timestamp,metric_name,current_value,adaptive_value,
             baseline_value,confidence)
            VALUES (?,?,?,?,?,?,?)""",
            (tid, _now(), metric_name, current_value, adaptive,
             baseline_value, round(confidence, 4)))
    return {
        "metric_name": metric_name,
        "baseline": baseline_value,
        "current": current_value,
        "adaptive_threshold": round(adaptive, 2),
        "confidence": round(confidence, 4),
        "exceeds": current_value > adaptive,
    }


def merge_alerts(alerts: List[Dict[str, Any]]) -> Dict[str, Any]:
    """告警自动合并"""
    if not alerts:
        return {"merged": False}
    groups: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
    for a in alerts:
        key = a.get("fingerprint") or compute_fingerprint(
            a.get("alert_name", ""), a.get("labels", {}))
        groups[key].append(a)
    result_groups = []
    for key, items in groups.items():
        if len(items) > 1:
            rep = items[0]
            merged = [it["id"] for it in items]
            gid = str(uuid.uuid4())
            with _conn_lock, _conn() as c:
                c.execute("""INSERT INTO alert_groups
                    (id,timestamp,group_key,alert_count,representative_id,merged_ids)
                    VALUES (?,?,?,?,?,?)""",
                    (gid, _now(), key, len(items), rep["id"],
                     json.dumps(merged)))
            result_groups.append({
                "group_key": key,
                "count": len(items),
                "representative_id": rep["id"],
                "merged_ids": merged,
            })
    return {
        "merged": len(result_groups) > 0,
        "groups": result_groups,
        "original_count": len(alerts),
        "merged_count": sum(g["count"] for g in result_groups),
    }


def analyze_semantic(alert_id: str, message: str,
                      alert_name: str = "") -> Dict[str, Any]:
    """告警语义分析"""
    text = (message + " " + alert_name).lower()
    matched_keywords: Dict[str, List[str]] = {}
    for category, keywords in SEMANTIC_KEYWORDS.items():
        for kw in keywords:
            if kw in text:
                matched_keywords.setdefault(category, []).append(kw)
    if not matched_keywords:
        category = "general"
        score = 0.0
    else:
        category = max(matched_keywords, key=lambda k: len(matched_keywords[k]))
        score = min(1.0, sum(len(v) for v in matched_keywords.values()) / 5.0)
    sid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO alert_semantics
            (id,timestamp,alert_id,category,keywords_matched,semantic_score)
            VALUES (?,?,?,?,?,?)""",
            (sid, _now(), alert_id, category,
             json.dumps(matched_keywords, ensure_ascii=False), score))
    return {
        "alert_id": alert_id,
        "category": category,
        "keywords_matched": matched_keywords,
        "semantic_score": round(score, 4),
    }


def detect_flapping(alert_name: str, window_minutes: int = 30,
                     min_flips: int = 5) -> bool:
    """检测抖动告警"""
    since = (utcnow() - timedelta(minutes=window_minutes)).isoformat() + "Z"
    with _conn_lock, _conn() as c:
        rows = c.execute("""SELECT status, timestamp FROM alert_history
            WHERE alert_name = ? AND timestamp >= ?
            ORDER BY timestamp ASC""", (alert_name, since)).fetchall()
    if len(rows) < min_flips:
        return False
    flips = 0
    for i in range(1, len(rows)):
        if rows[i]["status"] != rows[i-1]["status"]:
            flips += 1
    return flips >= min_flips


def get_denoise_stats(hours: int = 24) -> Dict[str, Any]:
    """降噪统计"""
    since = (utcnow() - timedelta(hours=hours)).isoformat() + "Z"
    with _conn_lock, _conn() as c:
        total = c.execute("""SELECT COUNT(*) as cnt FROM alert_history
            WHERE timestamp >= ?""", (since,)).fetchone()["cnt"]
        feedback_cnt = c.execute("""SELECT COUNT(*) as cnt FROM alert_feedback
            WHERE timestamp >= ?""", (since,)).fetchone()["cnt"]
        fp_cnt = c.execute("""SELECT COUNT(*) as cnt FROM alert_feedback
            WHERE feedback_type = 'false_positive' AND timestamp >= ?""",
            (since,)).fetchone()["cnt"]
        tp_cnt = c.execute("""SELECT COUNT(*) as cnt FROM alert_feedback
            WHERE feedback_type = 'true_positive' AND timestamp >= ?""",
            (since,)).fetchone()["cnt"]
        merged = c.execute("""SELECT COALESCE(SUM(alert_count), 0) as total FROM alert_groups
            WHERE timestamp >= ?""", (since,)).fetchone()["total"]
    return {
        "window_hours": hours,
        "total_alerts": total,
        "total_feedback": feedback_cnt,
        "false_positive": fp_cnt,
        "true_positive": tp_cnt,
        "merged_alerts": merged or 0,
        "denoise_ratio": round((fp_cnt + (merged or 0)) / total, 4) if total else 0.0,
    }


def list_noise_patterns(limit: int = 50) -> List[Dict[str, Any]]:
    """列出噪声模式"""
    with _conn_lock, _conn() as c:
        rows = c.execute("""SELECT alert_name, pattern_type, false_positive_rate,
            suggestion, MAX(timestamp) as last_seen
            FROM noise_patterns GROUP BY alert_name
            ORDER BY false_positive_rate DESC LIMIT ?""", (limit,)).fetchall()
    return [dict(r) for r in rows]


def _send_dingtalk(title: str, content: str) -> None:
    """发送钉钉告警 (Stub)"""
    log_dir = os.path.join(os.path.dirname(__file__), "..", "logs", "mock_webhook")
    os.makedirs(log_dir, exist_ok=True)
    with open(os.path.join(log_dir, "dingtalk.jsonl"), "a", encoding="utf-8") as f:
        f.write(json.dumps({
            "timestamp": _now(), "title": title, "content": content,
            "source": "aiops_denoise",
        }, ensure_ascii=False) + "\n")


class _Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args): pass

    def _json(self, code: int, payload: Any) -> None:
        body = json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        u = urlparse(self.path)
        path = u.path
        if path == "/health":
            self._json(200, {"status": "ok", "service": "aiops_denoise"})
        elif path == "/api/denoise/stats":
            self._json(200, get_denoise_stats())
        elif path == "/api/noise/patterns":
            self._json(200, {"patterns": list_noise_patterns()})
        else:
            self._json(404, {"error": "not_found"})

    def do_POST(self) -> None:
        u = urlparse(self.path)
        path = u.path
        length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(length).decode("utf-8") if length else "{}"
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            data = {}
        if path == "/api/alert/record":
            aid = record_alert(
                alert_name=data.get("alert_name", ""),
                severity=data.get("severity", "warning"),
                service=data.get("service", ""),
                labels=data.get("labels", {}),
                message=data.get("message", ""),
            )
            self._json(201, {"id": aid})
        elif path == "/api/alert/feedback":
            fid = record_feedback(
                alert_id=data.get("alert_id", ""),
                feedback_type=data.get("feedback_type", "ack"),
                user=data.get("user", ""),
                comment=data.get("comment", ""),
            )
            self._json(201, {"id": fid})
        elif path == "/api/noise/train":
            result = train_noise_pattern(data.get("alert_name", ""))
            self._json(200, result)
        elif path == "/api/threshold/adaptive":
            result = adaptive_threshold(
                metric_name=data.get("metric_name", ""),
                baseline_value=data.get("baseline_value", 100.0),
                current_value=data.get("current_value", 0.0),
                std_dev=data.get("std_dev", 0.0),
                sensitivity=data.get("sensitivity", 1.5),
            )
            self._json(200, result)
        elif path == "/api/alert/merge":
            result = merge_alerts(data.get("alerts", []))
            self._json(200, result)
        elif path == "/api/alert/semantic":
            result = analyze_semantic(
                alert_id=data.get("alert_id", ""),
                message=data.get("message", ""),
                alert_name=data.get("alert_name", ""),
            )
            self._json(200, result)
        elif path == "/api/alert/flapping":
            is_flapping = detect_flapping(
                alert_name=data.get("alert_name", ""),
                window_minutes=data.get("window_minutes", 30),
            )
            self._json(200, {"flapping": is_flapping})
        else:
            self._json(404, {"error": "not_found"})


def serve() -> None:
    srv = HTTPServer(("0.0.0.0", HTTP_PORT), _Handler)
    print(f"AIOps Denoise service on :{HTTP_PORT}")
    srv.serve_forever()


def cmd_serve(_args: List[str]) -> None:
    serve()


def cmd_record(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: record <name> <severity> [service] [labels_json] [message]")
        return
    labels = json.loads(args[3]) if len(args) > 3 else {}
    msg = args[4] if len(args) > 4 else ""
    aid = record_alert(args[0], args[1], args[2] if len(args) > 2 else "", labels, msg)
    print(json.dumps({"id": aid}, ensure_ascii=False))


def cmd_feedback(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: feedback <alert_id> <feedback_type> [user] [comment]")
        return
    user = args[2] if len(args) > 2 else ""
    comment = args[3] if len(args) > 3 else ""
    fid = record_feedback(args[0], args[1], user, comment)
    print(json.dumps({"id": fid}, ensure_ascii=False))


def cmd_train(args: List[str]) -> None:
    if not args:
        print("usage: train <alert_name>")
        return
    result = train_noise_pattern(args[0])
    print(json.dumps(result, ensure_ascii=False, indent=2))


def cmd_fp_rate(args: List[str]) -> None:
    if not args:
        print("usage: fp-rate <alert_name> [window_days]")
        return
    days = int(args[1]) if len(args) > 1 else 30
    print(json.dumps({"alert_name": args[0],
                       "false_positive_rate": calc_false_positive_rate(args[0], days)},
                      ensure_ascii=False))


def cmd_threshold(args: List[str]) -> None:
    if len(args) < 3:
        print("usage: threshold <metric> <baseline> <current> [std_dev] [sensitivity]")
        return
    std = float(args[3]) if len(args) > 3 else 0.0
    sens = float(args[4]) if len(args) > 4 else 1.5
    result = adaptive_threshold(args[0], float(args[1]), float(args[2]), std, sens)
    print(json.dumps(result, ensure_ascii=False, indent=2))


def cmd_merge(args: List[str]) -> None:
    if not args:
        print("usage: merge <alerts_json>")
        return
    alerts = json.loads(args[0])
    result = merge_alerts(alerts)
    print(json.dumps(result, ensure_ascii=False, indent=2))


def cmd_semantic(args: List[str]) -> None:
    if len(args) < 2:
        print("usage: semantic <alert_id> <message> [alert_name]")
        return
    name = args[2] if len(args) > 2 else ""
    result = analyze_semantic(args[0], args[1], name)
    print(json.dumps(result, ensure_ascii=False, indent=2))


def cmd_flapping(args: List[str]) -> None:
    if not args:
        print("usage: flapping <alert_name> [window_minutes]")
        return
    minutes = int(args[1]) if len(args) > 1 else 30
    print(json.dumps({"flapping": detect_flapping(args[0], minutes)}, ensure_ascii=False))


def cmd_stats(args: List[str]) -> None:
    hours = int(args[0]) if args else 24
    print(json.dumps(get_denoise_stats(hours), ensure_ascii=False, indent=2))


def cmd_patterns(_args: List[str]) -> None:
    print(json.dumps(list_noise_patterns(), ensure_ascii=False, indent=2))


def cmd_fingerprint(args: List[str]) -> None:
    if not args:
        print("usage: fingerprint <alert_name> [labels_json]")
        return
    labels = json.loads(args[1]) if len(args) > 1 else {}
    print(compute_fingerprint(args[0], labels))


def main() -> None:
    import sys
    cmds = {
        "serve": cmd_serve, "record": cmd_record, "feedback": cmd_feedback,
        "train": cmd_train, "fp-rate": cmd_fp_rate, "threshold": cmd_threshold,
        "merge": cmd_merge, "semantic": cmd_semantic, "flapping": cmd_flapping,
        "stats": cmd_stats, "patterns": cmd_patterns, "fingerprint": cmd_fingerprint,
    }
    cmd = sys.argv[1] if len(sys.argv) > 1 else "serve"
    if cmd not in cmds:
        print(f"usage: {list(cmds.keys())}")
        sys.exit(1)
    cmds[cmd](sys.argv[2:])


if __name__ == "__main__":
    main()
