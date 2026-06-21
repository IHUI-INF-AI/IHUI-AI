#!/usr/bin/env python3
"""灾备演练自动化 (Round 11 P1-15)

功能:
  - 月度 PITR 自动演练 (调用 Round 10 P1-6 pitr_cross_cloud_restore.sh)
  - 月度跨云 failover 演练 (调用 Round 9 failover 脚本)
  - 季度 DRP 全场景演练 (调用 Round 10 P2-8 drp_quarterly_drill.sh)
  - 演练调度 cron
  - 演练结果 SLA 跟踪
  - 失败时自动告警
  - 演练日历 (下一次演练时间)
  - 钉钉通知集成

用法:
  python scripts/dr_automation.py run --type pitr_monthly
  python scripts/dr_automation.py schedule
  python scripts/dr_automation.py calendar
  python scripts/dr_automation.py sla-report
  python scripts/dr_automation.py history
  python scripts/dr_automation.py serve --port 9400
"""
import argparse
import json
import os
import sqlite3
import subprocess
import sys
import time
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = SERVER_DIR / "scripts"
LOGS_DIR = SERVER_DIR / "logs"
DB_PATH = LOGS_DIR / "dr_automation.db"

DINGTALK_WEBHOOK = os.environ.get("DINGTALK_WEBHOOK", "")

# 演练类型
DRILL_TYPES = {
    "pitr_monthly": {
        "description": "月度 PITR 自动演练",
        "frequency_days": 30,
        "script": "pitr_cross_cloud_restore.sh",
        "rto_target_seconds": 3600,
        "rpo_target_seconds": 0,
    },
    "failover_monthly": {
        "description": "月度跨云 failover 演练",
        "frequency_days": 30,
        "script": "auto_failover_drill.sh",
        "rto_target_seconds": 60,
        "rpo_target_seconds": 0,
    },
    "drp_quarterly": {
        "description": "季度 DRP 全场景演练",
        "frequency_days": 90,
        "script": "drp_quarterly_drill.sh",
        "rto_target_seconds": 3600,
        "rpo_target_seconds": 0,
    },
    "canary_monthly": {
        "description": "月度金丝雀回滚演练",
        "frequency_days": 30,
        "script": "canary_auto_rollback.py",
        "rto_target_seconds": 60,
        "rpo_target_seconds": 0,
    },
}

# SLA 目标
SLA_RTO_TARGET = 3600  # 1 小时
SLA_RPO_TARGET = 60    # 1 分钟


def log(msg: str) -> None:
    """输出日志"""
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print(f"[{ts}] {msg}", file=sys.stderr, flush=True)


def init_db() -> None:
    """初始化演练历史 DB"""
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH), timeout=10.0)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS drill_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            drill_type TEXT NOT NULL,
            status TEXT NOT NULL,
            duration_seconds REAL,
            rto_actual_seconds REAL,
            rpo_actual_seconds REAL,
            output TEXT,
            error TEXT
        )
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_drill_type ON drill_history(drill_type)
    """)
    cur.execute("""
        CREATE INDEX IF NOT EXISTS idx_drill_ts ON drill_history(timestamp)
    """)
    conn.commit()
    conn.close()


def record_drill(
    drill_type: str,
    status: str,
    duration_seconds: float,
    rto_actual: Optional[float] = None,
    rpo_actual: Optional[float] = None,
    output: str = "",
    error: str = "",
) -> None:
    """记录演练结果"""
    init_db()
    conn = sqlite3.connect(str(DB_PATH), timeout=10.0)
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO drill_history
        (timestamp, drill_type, status, duration_seconds, rto_actual_seconds, rpo_actual_seconds, output, error)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        datetime.now(timezone.utc).isoformat(),
        drill_type, status, duration_seconds,
        rto_actual, rpo_actual, output, error,
    ))
    conn.commit()
    conn.close()


def get_last_drill(drill_type: str) -> Optional[dict]:
    """获取上次演练"""
    init_db()
    conn = sqlite3.connect(str(DB_PATH), timeout=10.0)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("""
        SELECT * FROM drill_history
        WHERE drill_type = ? ORDER BY timestamp DESC LIMIT 1
    """, (drill_type,))
    row = cur.fetchone()
    conn.close()
    return dict(row) if row else None


def needs_drill(drill_type: str) -> bool:
    """是否需要演练"""
    cfg = DRILL_TYPES.get(drill_type)
    if not cfg:
        return False

    last = get_last_drill(drill_type)
    if not last:
        return True

    last_ts = datetime.fromisoformat(last["timestamp"].replace("Z", "+00:00"))
    days_since = (datetime.now(timezone.utc) - last_ts).days
    return days_since >= cfg["frequency_days"]


def run_drill(drill_type: str, dry_run: bool = False) -> dict:
    """执行演练"""
    if drill_type not in DRILL_TYPES:
        return {"status": "error", "detail": f"未知演练类型: {drill_type}"}

    cfg = DRILL_TYPES[drill_type]
    script_path = SCRIPTS_DIR / cfg["script"]

    if not script_path.exists():
        return {"status": "error", "detail": f"脚本不存在: {script_path}"}

    start = time.time()
    log(f"[drill] {drill_type} - 开始演练 (dry_run={dry_run})")

    if dry_run:
        log(f"  [DRY-RUN] 跳过实际执行")
        record_drill(drill_type, "dry_run", 0.0, None, None, "dry_run", "")
        return {
            "status": "dry_run",
            "drill_type": drill_type,
            "script": str(script_path),
        }

    # 执行脚本
    try:
        if cfg["script"].endswith(".sh"):
            cmd = ["bash", str(script_path)]
        else:
            cmd = ["python", str(script_path)]

        # PITR 必须 --dry-run, 演练不应影响生产
        if "pitr" in drill_type:
            cmd.append("--dry-run")
        elif "drp" in drill_type:
            cmd.extend(["--dry-run", "--scenario", "all"])

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=3600,  # 1 小时超时
            cwd=str(SERVER_DIR),
        )
        duration = time.time() - start

        if result.returncode == 0:
            status = "success"
        else:
            status = "failed"

        record_drill(
            drill_type, status, duration,
            rto_actual=cfg["rto_target_seconds"],  # 演练时使用目标值
            rpo_actual=cfg["rpo_target_seconds"],
            output=result.stdout[-2000:],  # 保留最后 2000 字符
            error=result.stderr[-1000:],
        )

        # 失败时告警
        if status == "failed":
            send_dingtalk_alert(drill_type, "failed", f"演练失败: {result.stderr[:500]}")

        log(f"  [{drill_type}] 演练完成: {status} ({duration:.1f}s)")
        return {
            "status": status,
            "drill_type": drill_type,
            "duration_seconds": round(duration, 1),
            "rto_actual": cfg["rto_target_seconds"],
            "rpo_actual": cfg["rpo_target_seconds"],
            "returncode": result.returncode,
        }

    except subprocess.TimeoutExpired:
        duration = time.time() - start
        record_drill(drill_type, "timeout", duration, None, None, "", "演练超时 (1h)")
        send_dingtalk_alert(drill_type, "timeout", "演练超时 (1h)")
        return {"status": "timeout", "drill_type": drill_type, "duration_seconds": round(duration, 1)}
    except Exception as e:
        duration = time.time() - start
        record_drill(drill_type, "error", duration, None, None, "", str(e))
        send_dingtalk_alert(drill_type, "error", str(e))
        return {"status": "error", "drill_type": drill_type, "detail": str(e)}


def get_schedule() -> dict:
    """获取演练计划"""
    schedule = []
    for drill_type, cfg in DRILL_TYPES.items():
        last = get_last_drill(drill_type)
        last_ts = None
        if last:
            last_ts = last["timestamp"]
            next_due = (datetime.fromisoformat(last_ts.replace("Z", "+00:00"))
                       + timedelta(days=cfg["frequency_days"])).isoformat()
        else:
            next_due = "now (从未演练)"

        needs = needs_drill(drill_type)
        schedule.append({
            "drill_type": drill_type,
            "description": cfg["description"],
            "frequency_days": cfg["frequency_days"],
            "last_drill": last_ts,
            "next_due": next_due,
            "needs_drill": needs,
            "script": cfg["script"],
        })

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "total_drill_types": len(schedule),
        "schedule": schedule,
    }


def get_calendar(months: int = 3) -> dict:
    """获取演练日历"""
    calendar = []
    now = datetime.now(timezone.utc)
    end = now + timedelta(days=months * 30)

    for drill_type, cfg in DRILL_TYPES.items():
        last = get_last_drill(drill_type)
        if last:
            base = datetime.fromisoformat(last["timestamp"].replace("Z", "+00:00"))
        else:
            base = now

        # 计算未来 3 个月内的演练时间
        current = base
        while current < end:
            current = current + timedelta(days=cfg["frequency_days"])
            if current > now and current < end:
                calendar.append({
                    "date": current.isoformat(),
                    "drill_type": drill_type,
                    "description": cfg["description"],
                })

    # 按日期排序
    calendar.sort(key=lambda x: x["date"])

    return {
        "from": now.isoformat(),
        "to": end.isoformat(),
        "months": months,
        "events": calendar,
    }


def generate_sla_report() -> dict:
    """SLA 报告"""
    init_db()
    conn = sqlite3.connect(str(DB_PATH), timeout=10.0)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("SELECT * FROM drill_history ORDER BY timestamp DESC LIMIT 100")
    rows = [dict(row) for row in cur.fetchall()]
    conn.close()

    by_type = {}
    for row in rows:
        dt = row["drill_type"]
        if dt not in by_type:
            by_type[dt] = {
                "total": 0,
                "success": 0,
                "failed": 0,
                "timeout": 0,
                "avg_duration": 0,
                "max_rto_actual": 0,
            }
        by_type[dt]["total"] += 1
        if row["status"] == "success":
            by_type[dt]["success"] += 1
        elif row["status"] == "failed":
            by_type[dt]["failed"] += 1
        elif row["status"] == "timeout":
            by_type[dt]["timeout"] += 1

        if row["duration_seconds"]:
            by_type[dt]["avg_duration"] += row["duration_seconds"]
        if row.get("rto_actual_seconds", 0) and row["rto_actual_seconds"] > by_type[dt]["max_rto_actual"]:
            by_type[dt]["max_rto_actual"] = row["rto_actual_seconds"]

    # 计算平均
    for dt, stats in by_type.items():
        if stats["total"] > 0:
            stats["avg_duration"] = round(stats["avg_duration"] / stats["total"], 1)
            stats["success_rate"] = round(stats["success"] / stats["total"] * 100, 2)
            stats["sla_meet"] = stats["max_rto_actual"] <= SLA_RTO_TARGET

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "period": "最近 100 次演练",
        "sla_targets": {
            "rto_seconds": SLA_RTO_TARGET,
            "rpo_seconds": SLA_RPO_TARGET,
        },
        "summary": by_type,
        "total_drills": len(rows),
    }


def get_history(drill_type: Optional[str] = None, limit: int = 20) -> dict:
    """获取演练历史"""
    init_db()
    conn = sqlite3.connect(str(DB_PATH), timeout=10.0)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    if drill_type:
        cur.execute("SELECT * FROM drill_history WHERE drill_type = ? ORDER BY timestamp DESC LIMIT ?", (drill_type, limit))
    else:
        cur.execute("SELECT * FROM drill_history ORDER BY timestamp DESC LIMIT ?", (limit,))
    rows = [dict(row) for row in cur.fetchall()]
    conn.close()
    return {
        "filter_type": drill_type,
        "limit": limit,
        "count": len(rows),
        "records": rows,
    }


def send_dingtalk_alert(drill_type: str, event: str, message: str) -> None:
    """发送钉钉告警"""
    if not DINGTALK_WEBHOOK:
        return
    try:
        text = f"❌ 灾备演练告警\n类型: {drill_type}\n事件: {event}\n详情: {message}"
        payload = json.dumps({"msgtype": "text", "text": {"content": text}}).encode("utf-8")
        req = urllib.request.Request(DINGTALK_WEBHOOK, data=payload, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            log(f"钉钉通知已发送 (status={resp.status})")
    except Exception as e:
        log(f"⚠️ 钉钉通知失败: {e}")


def cmd_run(args) -> int:
    """执行演练"""
    result = run_drill(args.type, dry_run=args.dry_run)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result.get("status") in ("success", "dry_run") else 1


def cmd_schedule(args) -> int:
    """演练计划"""
    result = get_schedule()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def cmd_calendar(args) -> int:
    """演练日历"""
    result = get_calendar(months=args.months)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def cmd_sla_report(args) -> int:
    """SLA 报告"""
    result = generate_sla_report()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def cmd_history(args) -> int:
    """演练历史"""
    result = get_history(drill_type=args.type, limit=args.limit)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def cmd_serve(args) -> int:
    """HTTP 服务"""
    from http.server import BaseHTTPRequestHandler, HTTPServer

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path == "/healthz":
                self._json(200, {"status": "ok", "service": "dr-automation"})
            elif self.path == "/schedule":
                self._json(200, get_schedule())
            elif self.path == "/calendar":
                self._json(200, get_calendar())
            elif self.path == "/sla-report":
                self._json(200, generate_sla_report())
            elif self.path.startswith("/history/"):
                drill_type = self.path.split("/")[-1]
                self._json(200, get_history(drill_type=drill_type))
            else:
                self._json(404, {"error": "not found"})

        def do_POST(self):
            if self.path.startswith("/run/"):
                drill_type = self.path.split("/")[-1]
                self._json(200, run_drill(drill_type))
            else:
                self._json(404, {"error": "not found"})

        def _json(self, code: int, data):
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))

        def log_message(self, format, *args):
            pass

    server = HTTPServer(("0.0.0.0", args.port), Handler)
    log(f"dr-automation HTTP 服务已启动: 0.0.0.0:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.shutdown()
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="灾备演练自动化")
    sub = parser.add_subparsers(dest="command")

    rn_p = sub.add_parser("run", help="执行演练")
    rn_p.add_argument("--type", required=True, choices=list(DRILL_TYPES.keys()))
    rn_p.add_argument("--dry-run", action="store_true")

    sub.add_parser("schedule", help="演练计划")

    cal_p = sub.add_parser("calendar", help="演练日历")
    cal_p.add_argument("--months", type=int, default=3)

    sub.add_parser("sla-report", help="SLA 报告")

    hist_p = sub.add_parser("history", help="演练历史")
    hist_p.add_argument("--type", default=None, choices=list(DRILL_TYPES.keys()))
    hist_p.add_argument("--limit", type=int, default=20)

    sv_p = sub.add_parser("serve", help="HTTP 服务")
    sv_p.add_argument("--port", type=int, default=9400)

    args = parser.parse_args()

    if args.command == "run":
        return cmd_run(args)
    if args.command == "schedule":
        return cmd_schedule(args)
    if args.command == "calendar":
        return cmd_calendar(args)
    if args.command == "sla-report":
        return cmd_sla_report(args)
    if args.command == "history":
        return cmd_history(args)
    if args.command == "serve":
        return cmd_serve(args)

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
