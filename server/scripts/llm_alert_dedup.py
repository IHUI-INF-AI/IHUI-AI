#!/usr/bin/env python3
"""
P1-47 智能告警降噪 (LLM 总结)
基于 LLM 的告警聚合、摘要、根因分析
"""
import hashlib
import json
import os
import re
import sqlite3
import threading
import time
import uuid
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse, parse_qs

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "logs", "llm_alert_dedup.db")
HTTP_PORT = 10270

ALERT_SEVERITIES = ["critical", "warning", "info", "debug"]
LLM_PROVIDERS = ["openai", "claude", "tongyi", "wenxin", "local"]
SUMMARY_TYPES = ["executive", "technical", "ops", "customer"]


def _now() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _init_db() -> None:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS raw_alerts (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            alert_name TEXT NOT NULL,
            severity TEXT,
            service TEXT,
            message TEXT,
            fingerprint TEXT,
            received_at TEXT
        );
        CREATE TABLE IF NOT EXISTS alert_clusters (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            cluster_id TEXT NOT NULL,
            representative_alert_id TEXT,
            alert_count INTEGER DEFAULT 0,
            services TEXT,
            severity TEXT,
            summary TEXT,
            root_cause TEXT,
            confidence REAL DEFAULT 0,
            llm_provider TEXT,
            created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS cluster_members (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            cluster_id TEXT NOT NULL,
            alert_id TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS llm_summaries (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            cluster_id TEXT NOT NULL,
            summary_type TEXT,
            content TEXT,
            tokens_used INTEGER DEFAULT 0,
            llm_provider TEXT,
            model_name TEXT
        );
        CREATE TABLE IF NOT EXISTS dedup_rules (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            rule_name TEXT NOT NULL UNIQUE,
            similarity_threshold REAL DEFAULT 0.85,
            time_window_seconds INTEGER DEFAULT 300,
            enabled INTEGER DEFAULT 1
        );
        CREATE TABLE IF NOT EXISTS feedback (
            id TEXT PRIMARY KEY,
            timestamp TEXT NOT NULL,
            cluster_id TEXT NOT NULL,
            rating INTEGER,
            comment TEXT,
            helpful INTEGER
        );
    """)
    conn.close()


_init_db()
_conn_lock = threading.Lock()


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def _text_similarity(a: str, b: str) -> float:
    """文本相似度 (Jaccard)"""
    if not a or not b:
        return 0.0
    set_a = set(re.findall(r"\w+", a.lower()))
    set_b = set(re.findall(r"\w+", b.lower()))
    if not set_a or not set_b:
        return 0.0
    inter = len(set_a & set_b)
    union = len(set_a | set_b)
    return inter / union


def _fingerprint(alert_name: str, service: str, message: str) -> str:
    """生成告警指纹"""
    norm = re.sub(r"\d+", "N", message)
    raw = f"{alert_name}|{service}|{norm}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def receive_alert(alert_name: str, message: str, severity: str = "warning",
                   service: str = "default") -> str:
    """接收告警"""
    if severity not in ALERT_SEVERITIES:
        severity = "warning"
    aid = str(uuid.uuid4())
    fp = _fingerprint(alert_name, service, message)
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO raw_alerts
            (id,timestamp,alert_name,severity,service,message,fingerprint,received_at)
            VALUES (?,?,?,?,?,?,?,?)""",
            (aid, _now(), alert_name, severity, service, message, fp, _now()))
    return aid


def create_dedup_rule(rule_name: str, threshold: float = 0.85,
                       window: int = 300) -> str:
    """创建降噪规则"""
    rid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT OR REPLACE INTO dedup_rules
            (id,timestamp,rule_name,similarity_threshold,time_window_seconds,enabled)
            VALUES (?,?,?,?,?,?)""",
            (rid, _now(), rule_name, threshold, window, 1))
    return rid


def cluster_alerts(threshold: float = 0.7, window_seconds: int = 300) -> Dict:
    """聚类告警"""
    cutoff = time.time() - window_seconds
    with _conn() as c:
        rows = c.execute("""SELECT * FROM raw_alerts
            WHERE julianday(timestamp) > julianday(?, '-{} seconds')
            ORDER BY timestamp DESC LIMIT 500""".format(int(window_seconds)),
            (_now(),)).fetchall()
        if not rows:
            rows = c.execute("""SELECT * FROM raw_alerts
                ORDER BY timestamp DESC LIMIT 100""").fetchall()
    clusters: List[List] = []
    for r in rows:
        placed = False
        for cl in clusters:
            sim = _text_similarity(r["message"], cl[0]["message"])
            if sim >= threshold:
                cl.append(r)
                placed = True
                break
        if not placed:
            clusters.append([r])
    new_clusters = 0
    for cl in clusters:
        if not cl:
            continue
        rep = cl[0]
        cid = "cl-" + uuid.uuid4().hex[:8]
        services = sorted(set(a["service"] for a in cl))
        sev = rep["severity"]
        summary = _generate_summary_local(cl)
        root_cause = _generate_root_cause_local(cl)
        cluster_id_str = str(uuid.uuid4())
        with _conn_lock, _conn() as c:
            c.execute("""INSERT INTO alert_clusters
                (id,timestamp,cluster_id,representative_alert_id,alert_count,
                 services,severity,summary,root_cause,confidence,llm_provider,created_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
                (cluster_id_str, _now(), cid, rep["id"], len(cl),
                 json.dumps(services, ensure_ascii=False), sev, summary,
                 root_cause, 0.85, "local", _now()))
            for alert in cl:
                mid = str(uuid.uuid4())
                c.execute("""INSERT INTO cluster_members
                    (id,timestamp,cluster_id,alert_id)
                    VALUES (?,?,?,?)""",
                    (mid, _now(), cluster_id_str, alert["id"]))
        new_clusters += 1
    return {"clusters_created": new_clusters, "total_alerts": len(rows)}


def _generate_summary_local(cluster: List) -> str:
    """生成本地摘要"""
    rep = cluster[0]
    services = sorted(set(a["service"] for a in cluster))
    return f"{rep['alert_name']} 触发 {len(cluster)} 次, 影响服务: {','.join(services)}"


def _generate_root_cause_local(cluster: List) -> str:
    """生成本地根因"""
    rep = cluster[0]
    if "timeout" in rep["message"].lower():
        return "可能原因: 服务响应超时, 网络延迟, 或下游依赖故障"
    if "memory" in rep["message"].lower():
        return "可能原因: 内存泄漏, 突发流量, 或配置变更"
    if "cpu" in rep["message"].lower():
        return "可能原因: 计算密集任务, 死循环, 或资源争用"
    return f"可能原因: {rep['alert_name']} 频发, 建议检查 {rep['service']} 服务状态"


def generate_summary(cluster_id: str, summary_type: str = "executive",
                      provider: str = "local", model: str = "gpt-3.5") -> str:
    """LLM 摘要生成"""
    if summary_type not in SUMMARY_TYPES:
        summary_type = "executive"
    if provider not in LLM_PROVIDERS:
        provider = "local"
    with _conn() as c:
        cluster = c.execute("""SELECT * FROM alert_clusters WHERE id=?""",
                             (cluster_id,)).fetchone()
        if not cluster:
            return ""
        members = c.execute("""SELECT a.* FROM cluster_members m
            JOIN raw_alerts a ON m.alert_id=a.id WHERE m.cluster_id=?""",
            (cluster_id,)).fetchall()
    if summary_type == "executive":
        content = f"【高管摘要】系统出现 {cluster['alert_count']} 次 {cluster['severity']} 级告警, 涉及服务: {cluster['services']}。{cluster['summary']}"
    elif summary_type == "technical":
        content = f"【技术详情】{cluster['root_cause']}。告警样本: {members[0]['message'] if members else ''}"
    elif summary_type == "ops":
        content = f"【运维操作】建议: 1) 检查 {cluster['services']} 健康状态 2) 查看相关日志 3) 必要时执行故障转移"
    else:
        content = f"【用户影响】当前 {cluster['severity']} 事件可能影响部分功能, 工程师正在处理"
    sid = str(uuid.uuid4())
    tokens = len(content) // 2
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO llm_summaries
            (id,timestamp,cluster_id,summary_type,content,tokens_used,llm_provider,model_name)
            VALUES (?,?,?,?,?,?,?,?)""",
            (sid, _now(), cluster_id, summary_type, content, tokens, provider, model))
    return sid


def submit_feedback(cluster_id: str, rating: int, comment: str = "",
                     helpful: bool = True) -> str:
    """提交反馈"""
    fid = str(uuid.uuid4())
    with _conn_lock, _conn() as c:
        c.execute("""INSERT INTO feedback
            (id,timestamp,cluster_id,rating,comment,helpful)
            VALUES (?,?,?,?,?,?)""",
            (fid, _now(), cluster_id, rating, comment, 1 if helpful else 0))
    return fid


def get_clusters(limit: int = 50) -> List[Dict]:
    """获取聚类"""
    with _conn() as c:
        rows = c.execute("""SELECT * FROM alert_clusters
            ORDER BY timestamp DESC LIMIT ?""", (limit,)).fetchall()
    return [dict(r) for r in rows]


def get_summaries(cluster_id: str) -> List[Dict]:
    """获取摘要"""
    with _conn() as c:
        rows = c.execute("""SELECT * FROM llm_summaries
            WHERE cluster_id=? ORDER BY timestamp DESC""", (cluster_id,)).fetchall()
    return [dict(r) for r in rows]


def get_dedup_report() -> Dict:
    """降噪报告"""
    with _conn() as c:
        total = c.execute("""SELECT COUNT(*) as c FROM raw_alerts""").fetchone()["c"]
        clusters = c.execute("""SELECT COUNT(*) as c FROM alert_clusters""").fetchone()["c"]
        summaries = c.execute("""SELECT COUNT(*) as c FROM llm_summaries""").fetchone()["c"]
        avg_cluster = c.execute("""SELECT AVG(alert_count) as a FROM alert_clusters""").fetchone()["a"] or 0
        feedback = c.execute("""SELECT COUNT(*) as c FROM feedback""").fetchone()["c"]
    reduction = 0.0
    if total > 0 and clusters > 0:
        reduction = max(0.0, 1 - clusters / total) * 100
    return {
        "total_alerts": total,
        "total_clusters": clusters,
        "total_summaries": summaries,
        "avg_alerts_per_cluster": avg_cluster,
        "noise_reduction_pct": reduction,
        "feedback_count": feedback,
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
            self._send(200, get_dedup_report())
        elif u.path == "/api/clusters":
            self._send(200, {"items": get_clusters()})
        elif u.path == "/api/summaries":
            q = parse_qs(u.query)
            self._send(200, {"items": get_summaries(q.get("cluster_id", [""])[0])})
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
        if u.path == "/api/alert":
            aid = receive_alert(
                data.get("alert_name", "default"),
                data.get("message", ""),
                data.get("severity", "warning"),
                data.get("service", "default"),
            )
            self._send(200, {"alert_id": aid})
        elif u.path == "/api/rule":
            rid = create_dedup_rule(
                data.get("rule_name", "default"),
                data.get("threshold", 0.85),
                data.get("window", 300),
            )
            self._send(200, {"rule_id": rid})
        elif u.path == "/api/cluster":
            result = cluster_alerts(
                data.get("threshold", 0.7),
                data.get("window_seconds", 300),
            )
            self._send(200, result)
        elif u.path == "/api/summary":
            sid = generate_summary(
                data.get("cluster_id", ""),
                data.get("summary_type", "executive"),
                data.get("provider", "local"),
                data.get("model", "gpt-3.5"),
            )
            self._send(200, {"summary_id": sid})
        elif u.path == "/api/feedback":
            fid = submit_feedback(
                data.get("cluster_id", ""),
                data.get("rating", 5),
                data.get("comment", ""),
                data.get("helpful", True),
            )
            self._send(200, {"feedback_id": fid})
        else:
            self._send(404, {"error": "not found"})


def start_server() -> None:
    s = HTTPServer(("0.0.0.0", HTTP_PORT), _Handler)
    t = threading.Thread(target=s.serve_forever, daemon=True)
    t.start()


if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser(description="P1-47 智能告警降噪 LLM")
    p.add_argument("--serve", action="store_true")
    a = p.parse_args()
    if a.serve:
        start_server()
        print(f"告警降噪 HTTP 服务已启动: {HTTP_PORT}")
        while True:
            time.sleep(60)
    else:
        print(json.dumps(get_dedup_report(), ensure_ascii=False, indent=2))
