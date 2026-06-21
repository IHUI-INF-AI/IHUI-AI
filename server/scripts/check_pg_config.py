"""PostgreSQL 配置预检 (dry-run, 不连真 PG).

验证:
- ENV=production 模式下, 期望 DB1_URL/DB2_URL 配置正确
- 包含正确的 PG 协议 (postgresql+psycopg2)
- 端口非默认 3306 (MySQL)
- 不含 MySQL/MariaDB 关键字
- 可选: 尝试连接 PG (带 timeout=2s), 失败不报错, 仅报告

用法:
    python scripts/check_pg_config.py
    ENV=production python scripts/check_pg_config.py --connect
"""
from __future__ import annotations

import argparse
import os
import re
import socket
import sys
from pathlib import Path

SERVER_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(SERVER_ROOT))


def check_url(label: str, url: str, errs: list[str]) -> None:
    if not url:
        errs.append(f"{label}: 未配置")
        return
    # 检查 PG 协议
    if not url.startswith("postgresql") and not url.startswith("postgres"):
        errs.append(f"{label}: 不是 PostgreSQL URL: {url[:50]}")
        return
    # 禁止 MySQL 端口
    m = re.search(r":(\d+)/", url)
    if m and m.group(1) == "3306":
        errs.append(f"{label}: 端口 3306 是 MySQL 默认端口")
    # 禁止 MySQL/MariaDB 关键字
    for bad in ("mysql", "mariadb", "pymysql", "aiomysql"):
        if bad in url.lower():
            errs.append(f"{label}: URL 含 MySQL 残留关键字 '{bad}'")
    # 检查用户名/密码非空
    m = re.search(r"://([^:]+):([^@]+)@", url)
    if not m:
        errs.append(f"{label}: URL 缺少 user:password@host 格式")
    else:
        user, pwd = m.group(1), m.group(2)
        if not user or not pwd:
            errs.append(f"{label}: user/password 不能为空")
    print(f"  [{label}] {url}")


def try_connect(url: str, timeout: float = 2.0) -> tuple[bool, str]:
    """尝试 TCP 连通性检查, 不真发 PG 协议."""
    m = re.search(r"@([^:]+):(\d+)", url)
    if not m:
        return False, "无法解析 host:port"
    host, port = m.group(1), int(m.group(2))
    try:
        s = socket.create_connection((host, port), timeout=timeout)
        s.close()
        return True, f"{host}:{port} TCP OK"
    except Exception as e:
        return False, f"{host}:{port} 不可达: {type(e).__name__}: {e}"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--connect", action="store_true",
                        help="尝试 TCP 连通性 (不连 PG 协议)")
    args = parser.parse_args()

    env = os.getenv("ENV", "dev").lower()
    print(f"[precheck] ENV = {env}")

    errs: list[str] = []

    print("[precheck] 1) 数据库 URL 配置")
    db1 = os.getenv("DB1_URL", "")
    db2 = os.getenv("DB2_URL", "")
    check_url("DB1_URL", db1, errs)
    check_url("DB2_URL", db2, errs)

    print("\n[precheck] 2) 多租户 / 业务配置")
    mt = os.getenv("MULTI_TENANT_ENABLED", "false").lower()
    if env == "production" and mt == "true":
        print(f"  [INFO] 多租户模式开启, schema 路由生效")
    elif env == "production" and mt != "true":
        print(f"  [INFO] 单租户模式 (MULTI_TENANT_ENABLED={mt})")

    strict = os.getenv("ZHS_TENANT_STRICT", "0")
    if strict == "1":
        print(f"  [INFO] 严格租户检查开启 (X-Tenant-Id header 必填)")

    print("\n[precheck] 3) 告警通道配置 (告警 8 通道)")
    alert_vars = [
        "DINGTALK_WEBHOOK", "WECHAT_WORK_WEBHOOK", "FEISHU_WEBHOOK",
        "SLACK_WEBHOOK", "TEAMS_WEBHOOK", "GENERIC_WEBHOOK_URL",
        "PAGERDUTY_ROUTING_KEY", "SMTP_HOST", "ALERT_EMAIL_TO",
    ]
    configured = 0
    for v in alert_vars:
        if os.getenv(v):
            configured += 1
            print(f"  [OK]  {v}")
        else:
            print(f"  [---] {v} (未配置)")
    if configured < 1:
        errs.append(f"生产环境应至少配置 1 个告警通道, 当前 0 个")

    if args.connect and db1:
        print("\n[precheck] 4) DB1 TCP 连通性")
        ok, msg = try_connect(db1)
        print(f"  [{'OK' if ok else 'WARN'}] {msg}")
        if not ok and env == "production":
            errs.append(f"生产环境 DB1 不可达: {msg}")

    print()
    if errs:
        print(f"[FAIL] {len(errs)} 个问题:")
        for e in errs:
            print(f"  - {e}")
        return 1
    print("[OK] PostgreSQL 配置预检通过")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
