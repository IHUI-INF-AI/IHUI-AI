#!/usr/bin/env python3
"""定时任务监控器

功能: 监控 crontab 任务执行状态, 检测任务是否按时执行
用法:
  python scripts/cron_monitor.py check     # 检查任务执行状态
  python scripts/cron_monitor.py list      # 列出所有监控任务
  python scripts/cron_monitor.py report    # 生成监控报告
"""
import os
import sys
import json
import subprocess
from pathlib import Path
from datetime import datetime, timezone, timedelta

SERVER_DIR = Path(__file__).resolve().parent.parent
LOG_DIR = SERVER_DIR / "logs"
CRON_LOG_DIR = LOG_DIR
STATE_FILE = LOG_DIR / "cron_monitor_state.json"
REPORT_FILE = LOG_DIR / f"cron_monitor_report_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.json"

# 监控任务定义: {name: (cron_pattern, log_pattern, max_age_minutes, severity)}
MONITORED_TASKS = {
    "cron_pg_slow_query": ("0 * * * *", "pg_slow_query_cron_", 120, "warning"),
    "cron_pg_security_audit": ("0 2 * * *", "pg_security_cron_", 1500, "critical"),
    "vault_key_rotation": ("0 3 * * *", "vault_key_rotation_", 1500, "critical"),
    "backup_pg_encrypted": ("0 1 * * *", "backup_pg", 1500, "critical"),
    "pitr_production_drill": ("0 4 * * 6", "pitr_", 10080, "warning"),
}


def log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}")


def load_state() -> dict:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    return {"last_runs": {}, "check_history": []}


def save_state(state: dict) -> None:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")


def find_latest_log(log_pattern: str) -> Path | None:
    """查找最新的匹配日志文件"""
    if not CRON_LOG_DIR.exists():
        return None
    candidates = sorted(
        CRON_LOG_DIR.glob(f"*{log_pattern}*"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    return candidates[0] if candidates else None


def check_task_status(task_name: str, log_pattern: str, max_age_minutes: int) -> dict:
    """检查单个任务状态"""
    latest_log = find_latest_log(log_pattern)
    now = datetime.now(timezone.utc)

    if not latest_log:
        return {
            "name": task_name,
            "status": "missing",
            "latest_log": None,
            "last_run": None,
            "age_minutes": None,
            "max_age_minutes": max_age_minutes,
            "healthy": False,
            "message": "未找到任何日志",
        }

    mtime = datetime.fromtimestamp(latest_log.stat().st_mtime, tz=timezone.utc)
    age_minutes = (now - mtime).total_seconds() / 60

    if age_minutes <= max_age_minutes:
        return {
            "name": task_name,
            "status": "healthy",
            "latest_log": str(latest_log),
            "last_run": mtime.isoformat(),
            "age_minutes": int(age_minutes),
            "max_age_minutes": max_age_minutes,
            "healthy": True,
            "message": f"正常运行 ({int(age_minutes)} 分钟前)",
        }
    return {
        "name": task_name,
        "status": "overdue",
        "latest_log": str(latest_log),
        "last_run": mtime.isoformat(),
        "age_minutes": int(age_minutes),
        "max_age_minutes": max_age_minutes,
        "healthy": False,
        "message": f"超期 {int(age_minutes - max_age_minutes)} 分钟",
    }


def cmd_check() -> int:
    """检查所有任务状态"""
    log("开始检查定时任务状态...")
    state = load_state()
    results = []
    unhealthy = 0

    for task_name, (_pattern, log_pattern, max_age, _severity) in MONITORED_TASKS.items():
        result = check_task_status(task_name, log_pattern, max_age)
        results.append(result)
        state["last_runs"][task_name] = result["last_run"]
        if not result["healthy"]:
            unhealthy += 1
        status_icon = "✅" if result["healthy"] else "❌"
        log(f"  {status_icon} {task_name}: {result['message']}")

    state["check_history"].append({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "unhealthy_count": unhealthy,
    })
    state["check_history"] = state["check_history"][-100:]
    save_state(state)

    if unhealthy > 0:
        log(f"❌ {unhealthy} 个任务异常")
        return 1
    log(f"✅ 全部 {len(MONITORED_TASKS)} 个任务正常")
    return 0


def cmd_list() -> int:
    """列出所有监控任务"""
    log("监控任务清单:")
    for name, (pattern, log_pattern, max_age, severity) in MONITORED_TASKS.items():
        log(f"  - {name}")
        log(f"    crontab: {pattern}")
        log(f"    日志匹配: {log_pattern}")
        log(f"    最大间隔: {max_age} 分钟")
        log(f"    严重级别: {severity}")
    return 0


def cmd_report() -> int:
    """生成监控报告"""
    log("生成监控报告...")
    state = load_state()
    results = []
    for task_name, (_pattern, log_pattern, max_age, severity) in MONITORED_TASKS.items():
        result = check_task_status(task_name, log_pattern, max_age)
        result["severity"] = severity
        results.append(result)

    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "operation": "cron_monitor_report",
        "total_tasks": len(MONITORED_TASKS),
        "healthy_count": sum(1 for r in results if r["healthy"]),
        "unhealthy_count": sum(1 for r in results if not r["healthy"]),
        "tasks": results,
        "check_history_count": len(state.get("check_history", [])),
    }

    REPORT_FILE.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    log(f"✅ 报告已生成: {REPORT_FILE}")
    log(f"  健康: {report['healthy_count']}/{report['total_tasks']}")
    return 0


def main() -> int:
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        print(__doc__)
        return 0

    cmd = sys.argv[1].lower()
    commands = {
        "check": cmd_check,
        "list": cmd_list,
        "report": cmd_report,
    }
    if cmd not in commands:
        print(f"未知命令: {cmd}")
        print(__doc__)
        return 1
    return commands[cmd]()


if __name__ == "__main__":
    sys.exit(main())
