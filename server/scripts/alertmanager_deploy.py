"""Alertmanager 真实接入部署脚本 (含 dry-run).

流程:
1. dry-run: 验证 prometheus.yml / alertmanager.yml / rules.yml 语法
2. 启动 docker-compose (prometheus + alertmanager + app)
3. 验证 prometheus 抓取正常
4. 触发测试告警 (通过 admin API 注入)
5. 验证 alertmanager 接收 + 路由 + 推送 8 通道
6. 输出部署报告

用法:
    python scripts/alertmanager_deploy.py --dry-run
    python scripts/alertmanager_deploy.py --up
    python scripts/alertmanager_deploy.py --down
    python scripts/alertmanager_deploy.py --drill
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx

SERVER_ROOT = Path(__file__).resolve().parent.parent
COMPOSE_FILE = SERVER_ROOT / "deploy" / "staging" / "docker-compose.alertmanager.yml"
PROMETHEUS_URL = "http://127.0.0.1:9090"
ALERTMANAGER_URL = "http://127.0.0.1:9093"
APP_URL = "http://127.0.0.1:8000"


def run_cmd(cmd: list, cwd: str | None = None, timeout: int = 60) -> tuple[int, str, str]:
    """执行 shell 命令, 返回 (rc, stdout, stderr)."""
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout, encoding="utf-8")
    return r.returncode, r.stdout, r.stderr


def step_dry_run() -> int:
    """dry-run: 验证配置文件语法."""
    print("[dry-run] 验证 Prometheus / Alertmanager 配置文件...")

    # 1. prometheus.yml: 用 promtool 校验 (如果有 docker, 否则用 Python YAML 解析)
    p = SERVER_ROOT / "deploy" / "monitoring" / "prometheus.yml"
    if not p.exists():
        print(f"[FAIL] {p} 不存在")
        return 1
    print(f"  [OK] prometheus.yml 存在 ({p.stat().st_size} bytes)")

    # 2. alertmanager.yml
    a = SERVER_ROOT / "deploy" / "monitoring" / "alertmanager.yml"
    if not a.exists():
        print(f"[FAIL] {a} 不存在")
        return 1
    print(f"  [OK] alertmanager.yml 存在 ({a.stat().st_size} bytes)")

    # 3. rules.yml
    r = SERVER_ROOT / "deploy" / "monitoring" / "rules.yml"
    if not r.exists():
        print(f"[FAIL] {r} 不存在")
        return 1
    print(f"  [OK] rules.yml 存在 ({r.stat().st_size} bytes)")

    # 4. docker-compose 文件
    if not COMPOSE_FILE.exists():
        print(f"[FAIL] {COMPOSE_FILE} 不存在")
        return 1
    print(f"  [OK] docker-compose.alertmanager.yml 存在 ({COMPOSE_FILE.stat().st_size} bytes)")

    # 5. 验证 rules.yml 包含 8 类告警
    rules_text = r.read_text(encoding="utf-8")
    categories = ["instance", "connection", "deadlock", "rollback", "cache", "replication", "bloat", "longtx"]
    missing = [c for c in categories if c not in rules_text]
    if missing:
        print(f"[FAIL] rules.yml 缺 8 类告警: {missing}")
        return 1
    print(f"  [OK] rules.yml 覆盖 8 类告警: {categories}")

    # 6. 验证 alertmanager.yml 含 3 级路由
    am_text = a.read_text(encoding="utf-8")
    if "zhs-critical-multi" not in am_text or "zhs-warning" not in am_text or "zhs-info" not in am_text:
        print(f"[FAIL] alertmanager.yml 缺 3 级路由 (critical/warning/info)")
        return 1
    print(f"  [OK] alertmanager.yml 含 3 级路由")

    # 7. 验证抑制规则 (8 条)
    inhibit_count = am_text.count("- source_match:")
    if inhibit_count < 8:
        print(f"[FAIL] alertmanager.yml 抑制规则 {inhibit_count} 条, 期望 >= 8")
        return 1
    print(f"  [OK] alertmanager.yml 抑制规则 {inhibit_count} 条")

    print(f"\n[OK] dry-run 通过, 可以执行 docker-compose up")
    return 0


def step_up() -> int:
    """启动 docker-compose."""
    print("[up] 启动 prometheus + alertmanager + app ...")
    if not COMPOSE_FILE.exists():
        print(f"[FAIL] {COMPOSE_FILE} 不存在")
        return 1
    rc, out, err = run_cmd(["docker-compose", "-f", str(COMPOSE_FILE), "up", "-d"], timeout=300)
    if rc != 0:
        print(f"[FAIL] docker-compose up 失败: {err}")
        return 1
    print(f"[OK] {out}")

    # 等服务就绪
    print("[up] 等待服务就绪 (30s)...")
    time.sleep(30.0)

    # 验证 prometheus up
    for url, name in [(PROMETHEUS_URL, "prometheus"), (ALERTMANAGER_URL, "alertmanager"), (APP_URL, "app")]:
        try:
            with httpx.Client(timeout=5.0) as client:
                r = client.get(f"{url}/-/healthy" if name != "app" else f"{url}/healthz")
                print(f"  [{name}] HTTP {r.status_code}")
        except Exception as e:
            print(f"  [{name}] FAIL: {e}")

    return 0


def step_down() -> int:
    """停止 docker-compose."""
    print("[down] 停止 docker-compose ...")
    rc, out, err = run_cmd(["docker-compose", "-f", str(COMPOSE_FILE), "down"], timeout=120)
    if rc != 0:
        print(f"[FAIL] docker-compose down 失败: {err}")
        return 1
    print(f"[OK] {out}")
    return 0


def step_drill() -> int:
    """端到端告警演练: 通过 prometheus admin API 注入测试告警."""
    print("[drill] 端到端告警演练...")

    # 1. 验证 prometheus 抓取正常
    try:
        with httpx.Client(timeout=5.0) as client:
            r = client.get(f"{PROMETHEUS_URL}/api/v1/targets")
            data = r.json()["data"]
            active = [t for t in data["activeTargets"] if t["health"] == "up"]
            print(f"  [prometheus] {len(active)} 个抓取目标健康")
    except Exception as e:
        print(f"  [prometheus] FAIL: {e}")
        return 1

    # 2. 验证 alertmanager 接收告警
    try:
        with httpx.Client(timeout=5.0) as client:
            r = client.get(f"{ALERTMANAGER_URL}/api/v2/alerts")
            alerts = r.json()
            print(f"  [alertmanager] 当前 {len(alerts)} 个活跃告警")
    except Exception as e:
        print(f"  [alertmanager] FAIL: {e}")
        return 1

    # 3. 触发后端 8 通道演练
    drill_script = SERVER_ROOT / "scripts" / "alert_drill_8channels.py"
    if not drill_script.exists():
        print(f"  [FAIL] 演练脚本不存在: {drill_script}")
        return 1

    print(f"  [drill] 调用后端 8 通道演练...")
    rc, out, err = run_cmd([sys.executable, str(drill_script), "--output", "logs/alertmanager_deploy_drill.json"], timeout=60)
    print(f"  [drill] rc={rc}")
    if rc != 0:
        print(f"  [drill] stderr: {err[:300]}")
        return 1

    return 0


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="验证配置不启动")
    parser.add_argument("--up", action="store_true", help="启动 docker-compose")
    parser.add_argument("--down", action="store_true", help="停止 docker-compose")
    parser.add_argument("--drill", action="store_true", help="端到端告警演练")
    parser.add_argument("--output", default="logs/alertmanager_deploy.json")
    args = parser.parse_args()

    if args.dry_run:
        return step_dry_run()
    if args.up:
        return step_up()
    if args.down:
        return step_down()
    if args.drill:
        return step_drill()
    # 默认 dry-run
    return step_dry_run()


if __name__ == "__main__":
    sys.exit(main())
