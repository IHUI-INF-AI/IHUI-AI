#!/usr/bin/env python3
"""pgBouncer 连接串切换工具

功能: 将应用数据库连接从直连 PostgreSQL (5432) 切换到 pgBouncer (6432)
用法:
  python scripts/switch_pgbouncer_connection.py check    # 检查 pgBouncer 可用性
  python scripts/switch_pgbouncer_connection.py switch   # 切换到 pgBouncer
  python scripts/switch_pgbouncer_connection.py revert   # 回滚到直连
  python scripts/switch_pgbouncer_connection.py status   # 查看当前状态
"""
import os
import sys
import json
import socket
import subprocess
from pathlib import Path
from datetime import datetime, timezone

SERVER_DIR = Path(__file__).resolve().parent.parent
CONFIG_FILE = SERVER_DIR / "app" / "config.py"
ENV_FILE = SERVER_DIR / ".env"
STATE_FILE = SERVER_DIR / "logs" / "pgbouncer_switch_state.json"
LOG_DIR = SERVER_DIR / "logs"

PG_DIRECT_PORT = 5432
PG_BOUNCER_PORT = 6432


def log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}")


def check_port(host: str, port: int, timeout: float = 2.0) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except (socket.timeout, ConnectionRefusedError, OSError):
        return False


def load_state() -> dict:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    return {}


def save_state(state: dict) -> None:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")


def get_current_config() -> dict:
    """从 .env 文件读取当前 PG 配置"""
    config = {"PG_HOST": "127.0.0.1", "PG_PORT": "5432"}
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("PG_HOST="):
                config["PG_HOST"] = line.split("=", 1)[1]
            elif line.startswith("PG_PORT="):
                config["PG_PORT"] = line.split("=", 1)[1]
    return config


def cmd_check() -> int:
    """检查 pgBouncer 可用性"""
    log("检查 pgBouncer 可用性...")
    host = "127.0.0.1"

    log(f"  检查 pgBouncer 端口 {host}:{PG_BOUNCER_PORT}...")
    if check_port(host, PG_BOUNCER_PORT):
        log(f"  ✅ pgBouncer 可达 ({host}:{PG_BOUNCER_PORT})")
    else:
        log(f"  ❌ pgBouncer 不可达 ({host}:{PG_BOUNCER_PORT})")
        log("  请先启动 pgBouncer: docker compose up -d pgbouncer")
        return 1

    log(f"  检查 PostgreSQL 直连端口 {host}:{PG_DIRECT_PORT}...")
    if check_port(host, PG_DIRECT_PORT):
        log(f"  ✅ PostgreSQL 直连可达 ({host}:{PG_DIRECT_PORT})")
    else:
        log(f"  ⚠️  PostgreSQL 直连不可达 ({host}:{PG_DIRECT_PORT})")

    current = get_current_config()
    log(f"  当前配置: PG_HOST={current['PG_HOST']}, PG_PORT={current['PG_PORT']}")
    log("")
    log("✅ pgBouncer 检查完成, 可以执行 switch")
    return 0


def cmd_switch() -> int:
    """切换到 pgBouncer"""
    log("切换数据库连接到 pgBouncer...")

    if not check_port("127.0.0.1", PG_BOUNCER_PORT):
        log("❌ pgBouncer 不可达, 请先执行 check")
        return 1

    current = get_current_config()
    if str(current.get("PG_PORT")) == str(PG_BOUNCER_PORT):
        log("ℹ️  已处于 pgBouncer 模式, 无需切换")
        return 0

    save_state({
        "previous": current,
        "current": {"PG_HOST": current["PG_HOST"], "PG_PORT": str(PG_BOUNCER_PORT)},
        "switched_at": datetime.now(timezone.utc).isoformat(),
    })

    if ENV_FILE.exists():
        content = ENV_FILE.read_text(encoding="utf-8")
        if "PG_PORT=" in content:
            content = content.replace(
                f"PG_PORT={current['PG_PORT']}",
                f"PG_PORT={PG_BOUNCER_PORT}",
            )
        else:
            content += f"\nPG_PORT={PG_BOUNCER_PORT}\n"
        ENV_FILE.write_text(content, encoding="utf-8")
        log(f"✅ .env 已更新: PG_PORT={current['PG_PORT']} → {PG_BOUNCER_PORT}")
    else:
        ENV_FILE.write_text(f"PG_HOST={current['PG_HOST']}\nPG_PORT={PG_BOUNCER_PORT}\n", encoding="utf-8")
        log(f"✅ .env 已创建: PG_PORT={PG_BOUNCER_PORT}")

    log("")
    log("切换完成, 请重启应用:")
    log("  docker compose restart api")
    log("")
    log("回滚命令:")
    log("  python scripts/switch_pgbouncer_connection.py revert")
    return 0


def cmd_revert() -> int:
    """回滚到直连 PostgreSQL"""
    log("回滚到 PostgreSQL 直连...")
    state = load_state()
    if not state:
        log("❌ 无切换状态, 无法回滚")
        return 1

    previous = state.get("previous", {})
    prev_port = previous.get("PG_PORT", str(PG_DIRECT_PORT))
    prev_host = previous.get("PG_HOST", "127.0.0.1")

    if ENV_FILE.exists():
        content = ENV_FILE.read_text(encoding="utf-8")
        current = get_current_config()
        if "PG_PORT=" in content:
            content = content.replace(
                f"PG_PORT={current['PG_PORT']}",
                f"PG_PORT={prev_port}",
            )
        if "PG_HOST=" in content:
            content = content.replace(
                f"PG_HOST={current['PG_HOST']}",
                f"PG_HOST={prev_host}",
            )
        ENV_FILE.write_text(content, encoding="utf-8")

    log(f"✅ 已回滚: PG_HOST={prev_host}, PG_PORT={prev_port}")
    STATE_FILE.unlink(missing_ok=True)
    log("")
    log("回滚完成, 请重启应用:")
    log("  docker compose restart api")
    return 0


def cmd_status() -> int:
    """查看当前状态"""
    log("当前 pgBouncer 切换状态:")
    current = get_current_config()
    log(f"  当前配置: PG_HOST={current['PG_HOST']}, PG_PORT={current['PG_PORT']}")

    if str(current["PG_PORT"]) == str(PG_BOUNCER_PORT):
        log("  模式: pgBouncer (连接池)")
    else:
        log("  模式: 直连 PostgreSQL")

    state = load_state()
    if state:
        log(f"  切换时间: {state.get('switched_at', 'unknown')}")
        prev = state.get("previous", {})
        log(f"  原始配置: PG_HOST={prev.get('PG_HOST')}, PG_PORT={prev.get('PG_PORT')}")
    else:
        log("  切换状态: 无 (未切换或已回滚)")
    return 0


def main() -> int:
    if len(sys.argv) < 2 or sys.argv[1] in ("-h", "--help"):
        print(__doc__)
        return 0

    cmd = sys.argv[1].lower()
    commands = {
        "check": cmd_check,
        "switch": cmd_switch,
        "revert": cmd_revert,
        "status": cmd_status,
    }
    if cmd not in commands:
        print(f"未知命令: {cmd}")
        print(__doc__)
        return 1
    return commands[cmd]()


if __name__ == "__main__":
    sys.exit(main())
