"""生产 .env 配置检查脚本 (P1 封版).

部署后跑一次, 验收 .env 是否含本封版必需的 3 个配置项:
  1. NOTIFY_RECIPIENT_UUID  (站内信 admin 收件方, 多副本必须一致)
  2. NOTIFY_MAX             (站内信容量上限)
  3. CELERY_BROKER_URL      (对账任务调度)

使用:
  python scripts/deploy_notify_env_check.py                 # 检查默认 .env
  python scripts/deploy_notify_env_check.py --env .env.production
  python scripts/deploy_notify_env_check.py --strict        # 任何缺失即失败

退出码:
  0 = 全部齐全
  1 = 缺配置 (WARN, 仅打印)
  2 = 缺配置 (STRICT 模式, 需运维修复)
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path


def check_env(env_path: Path) -> tuple[list[str], list[str]]:
    """读取 .env 文件, 返回 (缺失项, 已存在项)."""
    if not env_path.exists():
        return (["<env 文件不存在>"], [])

    parsed: dict[str, str] = {}
    for line in env_path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        k, v = line.split("=", 1)
        parsed[k.strip()] = v.strip()

    required = {
        "NOTIFY_RECIPIENT_UUID": "00000000-0000-0000-0000-000000000001",
        "NOTIFY_MAX": "1000",
        "CELERY_BROKER_URL": "redis://",
    }
    missing: list[str] = []
    present: list[str] = []
    for key, expected_hint in required.items():
        v = parsed.get(key) or os.environ.get(key)
        if not v:
            missing.append(f"{key} (建议值含 '{expected_hint}')")
        else:
            present.append(f"{key}={v}")

    return missing, present


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--env", default=".env", help=".env 文件路径 (默认: .env)")
    ap.add_argument("--strict", action="store_true", help="缺配置即返回非零")
    args = ap.parse_args()

    env_path = Path(args.env)
    print(f"=== .env 配置检查 (P1 封版) ===")
    print(f"env 文件: {env_path.absolute()}")
    print()

    missing, present = check_env(env_path)

    print("[OK] 已配置:")
    for p in present:
        print(f"  - {p}")
    if not present:
        print("  (无)")

    print()
    if missing:
        print("[FAIL] 缺失:")
        for m in missing:
            print(f"  - {m}")
        print()
        print("修复: 在 .env 末尾追加以下行 (按需修改):")
        print()
        print("  NOTIFY_RECIPIENT_UUID=00000000-0000-0000-0000-000000000001")
        print("  NOTIFY_MAX=1000")
        print("  CELERY_BROKER_URL=redis://127.0.0.1:6379/0")
        return 2 if args.strict else 1
    print("[OK] 所有必需项已配置")
    return 0


if __name__ == "__main__":
    sys.exit(main())
