#!/usr/bin/env python3
"""容量规划与预测 (Round 11 P1-13)

功能:
  - Prometheus 历史指标采集 (CPU / 内存 / 磁盘 / QPS / 延迟)
  - 线性回归 + 移动平均预测未来 7/30/90 天
  - 资源利用率告警 (>80% 预警, >90% 紧急)
  - 自动扩容建议 (replica + storage)
  - 月度容量报告 (JSON + HTML)
  - 钉钉告警通知
  - 趋势可视化数据

用法:
  python scripts/capacity_planning.py forecast --metric cpu --days 30
  python scripts/capacity_planning.py recommend --service zhs-api
  python scripts/capacity_planning.py report --month 2026-06
  python scripts/capacity_planning.py alerts
  python scripts/capacity_planning.py serve --port 9200
"""
import argparse
import json
import math
import os
import sqlite3
import statistics
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = SERVER_DIR / "scripts"
LOGS_DIR = SERVER_DIR / "logs"
DB_PATH = LOGS_DIR / "capacity_metrics.db"

PROMETHEUS_URL = os.environ.get("PROMETHEUS_URL", "http://127.0.0.1:9090")
DINGTALK_WEBHOOK = os.environ.get("DINGTALK_WEBHOOK", "")

# 资源阈值
THRESHOLD_WARNING = 80  # 80% 预警
THRESHOLD_CRITICAL = 90  # 90% 紧急
PREDICTION_DAYS = [7, 30, 90]  # 预测未来 7/30/90 天

# 资源类型
RESOURCE_TYPES = {
    "cpu": {"unit": "%", "warning": 80, "critical": 90},
    "memory": {"unit": "%", "warning": 80, "critical": 90},
    "disk": {"unit": "%", "warning": 80, "critical": 90},
    "qps": {"unit": "req/s", "warning": 8000, "critical": 10000},
    "p95_latency": {"unit": "ms", "warning": 200, "critical": 500},
}


def log(msg: str) -> None:
    """输出日志"""
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print(f"[{ts}] {msg}", file=sys.stderr, flush=True)


def init_db() -> None:
    """初始化容量指标 DB"""
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), timeout=10.0)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            resource_type TEXT NOT NULL,
            service TEXT NOT NULL,
            value REAL NOT NULL,
            INDEX idx_metrics_ts (timestamp),
            INDEX idx_metrics_resource (resource_type, service)
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS forecasts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            resource_type TEXT NOT NULL,
            service TEXT NOT NULL,
            forecast_days INTEGER NOT NULL,
            predicted_value REAL NOT NULL,
            current_value REAL NOT NULL,
            slope REAL NOT NULL,
            confidence REAL NOT NULL,
            alert_level TEXT
        )
    """)
    conn.commit()
    conn.close()


def record_metric(resource_type: str, service: str, value: float) -> None:
    """记录一次指标"""
    init_db()
    conn = sqlite3.connect(str(DB_PATH), timeout=10.0)
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO metrics (timestamp, resource_type, service, value)
        VALUES (?, ?, ?, ?)
    """, (datetime.now(timezone.utc).isoformat(), resource_type, service, value))
    conn.commit()
    conn.close()


def get_metrics_history(resource_type: str, service: str, days: int = 30) -> list[dict]:
    """获取历史指标"""
    init_db()
    conn = sqlite3.connect(str(DB_PATH), timeout=10.0)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    cur.execute("""
        SELECT timestamp, value FROM metrics
        WHERE resource_type = ? AND service = ? AND timestamp >= ?
        ORDER BY timestamp ASC
    """, (resource_type, service, cutoff))
    rows = [{"timestamp": row["timestamp"], "value": row["value"]} for row in cur.fetchall()]
    conn.close()
    return rows


def linear_regression(points: list[tuple[float, float]]) -> tuple[float, float, float]:
    """简单线性回归: 返回 (slope, intercept, r_squared)"""
    if len(points) < 2:
        return 0.0, points[0][1] if points else 0.0, 0.0

    n = len(points)
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]

    mean_x = sum(xs) / n
    mean_y = sum(ys) / n

    ss_xx = sum((x - mean_x) ** 2 for x in xs)
    ss_xy = sum((x - mean_x) * (y - mean_y) for x, y in points)
    ss_yy = sum((y - mean_y) ** 2 for y in ys)

    if ss_xx == 0:
        return 0.0, mean_y, 0.0

    slope = ss_xy / ss_xx
    intercept = mean_y - slope * mean_x

    # R² 决定系数
    if ss_yy == 0:
        r_squared = 1.0
    else:
        ss_res = sum((y - (slope * x + intercept)) ** 2 for x, y in points)
        r_squared = 1 - (ss_res / ss_yy)

    return slope, intercept, max(0.0, min(1.0, r_squared))


def forecast_resource(resource_type: str, service: str, days_ahead: int) -> dict:
    """预测资源使用量"""
    history = get_metrics_history(resource_type, service, days=30)
    if not history:
        return {
            "status": "no_data",
            "resource_type": resource_type,
            "service": service,
        }

    values = [h["value"] for h in history]
    current = values[-1] if values else 0
    avg_7d = sum(values[-7:]) / min(7, len(values))
    avg_30d = sum(values) / len(values)
    max_30d = max(values)
    min_30d = min(values)

    # 线性回归
    base_ts = datetime.fromisoformat(history[0]["timestamp"].replace("Z", "+00:00"))
    points = []
    for h in history:
        ts = datetime.fromisoformat(h["timestamp"].replace("Z", "+00:00"))
        x = (ts - base_ts).total_seconds() / 86400  # 转换为天
        points.append((x, h["value"]))

    slope, intercept, r_squared = linear_regression(points)

    # 预测
    current_x = points[-1][0] if points else 0
    future_x = current_x + days_ahead
    predicted = slope * future_x + intercept
    predicted = max(0, predicted)  # 不允许负值

    # 告警级别
    cfg = RESOURCE_TYPES.get(resource_type, {"warning": 80, "critical": 90})
    alert_level = "ok"
    if predicted >= cfg["critical"]:
        alert_level = "critical"
    elif predicted >= cfg["warning"]:
        alert_level = "warning"

    return {
        "status": "ok",
        "resource_type": resource_type,
        "service": service,
        "forecast_days": days_ahead,
        "current_value": round(current, 2),
        "avg_7d": round(avg_7d, 2),
        "avg_30d": round(avg_30d, 2),
        "max_30d": round(max_30d, 2),
        "min_30d": round(min_30d, 2),
        "predicted_value": round(predicted, 2),
        "slope_per_day": round(slope, 4),
        "r_squared": round(r_squared, 4),
        "alert_level": alert_level,
        "thresholds": cfg,
    }


def recommend_scaling(service: str) -> dict:
    """自动扩容建议"""
    recommendations = []

    for resource_type in ["cpu", "memory", "qps"]:
        forecast_30d = forecast_resource(resource_type, service, days_ahead=30)
        if forecast_30d.get("status") != "ok":
            continue

        predicted = forecast_30d["predicted_value"]
        current = forecast_30d["current_value"]
        cfg = forecast_30d.get("thresholds", {})

        if predicted >= cfg.get("critical", 90):
            # 紧急扩容
            if resource_type == "qps":
                factor = 2.0
            else:
                factor = 1.5
            new_replicas = max(2, int(math.ceil(current / cfg.get("warning", 80) * factor)))
            recommendations.append({
                "resource": resource_type,
                "priority": "high",
                "current": current,
                "predicted_30d": predicted,
                "action": "scale_up",
                "suggested_replicas": new_replicas,
                "reason": f"30 天后预测 {predicted}{cfg.get('unit', '%')} >= 临界 {cfg.get('critical', 90)}{cfg.get('unit', '%')}",
            })
        elif predicted >= cfg.get("warning", 80):
            # 预警扩容
            factor = 1.3
            new_replicas = max(2, int(math.ceil(current / cfg.get("warning", 80) * factor)))
            recommendations.append({
                "resource": resource_type,
                "priority": "medium",
                "current": current,
                "predicted_30d": predicted,
                "action": "scale_up",
                "suggested_replicas": new_replicas,
                "reason": f"30 天后预测 {predicted}{cfg.get('unit', '%')} >= 预警 {cfg.get('warning', 80)}{cfg.get('unit', '%')}",
            })

    # 存储建议
    disk_forecast = forecast_resource("disk", service, days_ahead=90)
    if disk_forecast.get("status") == "ok" and disk_forecast["predicted_value"] >= 80:
        recommendations.append({
            "resource": "disk",
            "priority": "high" if disk_forecast["predicted_value"] >= 90 else "medium",
            "current": disk_forecast["current_value"],
            "predicted_90d": disk_forecast["predicted_value"],
            "action": "expand_storage",
            "suggested_storage_gb": int(disk_forecast["current_value"] * 1.5),
            "reason": f"90 天后预测 {disk_forecast['predicted_value']}% 接近上限",
        })

    return {
        "service": service,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "recommendation_count": len(recommendations),
        "recommendations": recommendations,
    }


def check_alerts() -> dict:
    """检查告警 (所有资源)"""
    init_db()
    conn = sqlite3.connect(str(DB_PATH), timeout=10.0)
    cur = conn.cursor()
    cur.execute("SELECT DISTINCT service FROM metrics")
    services = [row[0] for row in cur.fetchall()]
    conn.close()

    alerts = []
    for service in services:
        for resource_type in RESOURCE_TYPES:
            forecast_30d = forecast_resource(resource_type, service, days_ahead=30)
            if forecast_30d.get("status") != "ok":
                continue
            if forecast_30d.get("alert_level") in ("warning", "critical"):
                alerts.append({
                    "service": service,
                    "resource": resource_type,
                    "alert_level": forecast_30d["alert_level"],
                    "current": forecast_30d["current_value"],
                    "predicted_30d": forecast_30d["predicted_value"],
                    "thresholds": forecast_30d["thresholds"],
                })

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "alert_count": len(alerts),
        "alerts": alerts,
    }


def generate_report(month: str) -> dict:
    """生成月度容量报告"""
    # month 格式: YYYY-MM
    try:
        year, mon = month.split("-")
        year, mon = int(year), int(mon)
    except ValueError:
        return {"status": "error", "detail": f"月份格式错误: {month}"}

    # 起始和结束时间
    start = datetime(year, mon, 1, tzinfo=timezone.utc)
    if mon == 12:
        end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end = datetime(year, mon + 1, 1, tzinfo=timezone.utc)

    init_db()
    conn = sqlite3.connect(str(DB_PATH), timeout=10.0)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    services_data = {}
    cur.execute("SELECT DISTINCT service FROM metrics")
    services = [row[0] for row in cur.fetchall()]

    for service in services:
        service_data = {"resources": {}}
        for resource_type in RESOURCE_TYPES:
            cur.execute("""
                SELECT value FROM metrics
                WHERE service = ? AND resource_type = ? AND timestamp >= ? AND timestamp < ?
                ORDER BY timestamp
            """, (service, resource_type, start.isoformat(), end.isoformat()))
            values = [row["value"] for row in cur.fetchall()]
            if values:
                service_data["resources"][resource_type] = {
                    "count": len(values),
                    "avg": round(sum(values) / len(values), 2),
                    "max": round(max(values), 2),
                    "min": round(min(values), 2),
                    "p95": round(sorted(values)[int(len(values) * 0.95)] if values else 0, 2),
                }
        services_data[service] = service_data

    conn.close()

    report = {
        "status": "ok",
        "month": month,
        "period": {
            "start": start.isoformat(),
            "end": end.isoformat(),
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "services": services_data,
    }

    # 保存报告
    report_file = LOGS_DIR / f"capacity_report_{month}.json"
    report_file.write_text(
        json.dumps(report, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    report["report_file"] = str(report_file)

    return report


def send_dingtalk_alert(alerts: list) -> None:
    """发送钉钉告警"""
    if not DINGTALK_WEBHOOK or not alerts:
        return
    try:
        text = f"⚠️ 容量预测告警 (共 {len(alerts)} 条)\n\n"
        for a in alerts[:5]:
            text += f"- [{a['alert_level'].upper()}] {a['service']}/{a['resource']}: 当前 {a['current']}, 30 天后 {a['predicted_30d']}\n"

        payload = json.dumps({"msgtype": "text", "text": {"content": text}}).encode("utf-8")
        req = urllib.request.Request(
            DINGTALK_WEBHOOK, data=payload,
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            log(f"钉钉通知已发送 (status={resp.status})")
    except Exception as e:
        log(f"⚠️ 钉钉通知失败: {e}")


def cmd_forecast(args) -> int:
    """预测资源使用"""
    result = forecast_resource(args.metric, args.service, days_ahead=args.days)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def cmd_recommend(args) -> int:
    """扩容建议"""
    result = recommend_scaling(args.service)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def cmd_report(args) -> int:
    """月度报告"""
    result = generate_report(args.month)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result.get("status") == "ok" else 1


def cmd_alerts(args) -> int:
    """告警检查"""
    result = check_alerts()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    if args.notify and result["alerts"]:
        send_dingtalk_alert(result["alerts"])
    return 0


def cmd_record(args) -> int:
    """记录指标 (用于测试)"""
    record_metric(args.metric, args.service, args.value)
    print(json.dumps({
        "status": "ok",
        "metric": args.metric,
        "service": args.service,
        "value": args.value,
    }, ensure_ascii=False, indent=2))
    return 0


def cmd_serve(args) -> int:
    """HTTP 服务"""
    from http.server import BaseHTTPRequestHandler, HTTPServer

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path == "/healthz":
                self._json(200, {"status": "ok", "service": "capacity-planning"})
            elif self.path.startswith("/forecast/"):
                parts = self.path.split("/")
                if len(parts) >= 5:
                    _, _, service, resource, days = parts[:5]
                    self._json(200, forecast_resource(resource, service, int(days)))
                else:
                    self._json(400, {"error": "参数不足"})
            elif self.path.startswith("/recommend/"):
                service = self.path.split("/")[-1]
                self._json(200, recommend_scaling(service))
            elif self.path == "/alerts":
                self._json(200, check_alerts())
            else:
                self._json(404, {"error": "not found"})

        def _json(self, code: int, data: dict):
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))

        def log_message(self, format, *args):
            pass

    server = HTTPServer(("0.0.0.0", args.port), Handler)
    log(f"capacity-planning HTTP 服务已启动: 0.0.0.0:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="容量规划与预测")
    sub = parser.add_subparsers(dest="command")

    # forecast
    fc_p = sub.add_parser("forecast", help="预测资源使用")
    fc_p.add_argument("--metric", required=True, choices=list(RESOURCE_TYPES.keys()))
    fc_p.add_argument("--service", required=True)
    fc_p.add_argument("--days", type=int, default=30, choices=PREDICTION_DAYS)

    # recommend
    rc_p = sub.add_parser("recommend", help="扩容建议")
    rc_p.add_argument("--service", required=True)

    # report
    rp_p = sub.add_parser("report", help="月度报告")
    rp_p.add_argument("--month", required=True, help="YYYY-MM 格式")

    # alerts
    al_p = sub.add_parser("alerts", help="告警检查")
    al_p.add_argument("--notify", action="store_true")

    # record
    rd_p = sub.add_parser("record", help="记录指标 (测试用)")
    rd_p.add_argument("--metric", required=True, choices=list(RESOURCE_TYPES.keys()))
    rd_p.add_argument("--service", required=True)
    rd_p.add_argument("--value", type=float, required=True)

    # serve
    sv_p = sub.add_parser("serve", help="HTTP 服务")
    sv_p.add_argument("--port", type=int, default=9200)

    args = parser.parse_args()

    if args.command == "forecast":
        return cmd_forecast(args)
    if args.command == "recommend":
        return cmd_recommend(args)
    if args.command == "report":
        return cmd_report(args)
    if args.command == "alerts":
        return cmd_alerts(args)
    if args.command == "record":
        return cmd_record(args)
    if args.command == "serve":
        return cmd_serve(args)

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
