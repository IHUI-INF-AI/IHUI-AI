#!/usr/bin/env python3
"""Terraform State 远程化 - 状态迁移 + 锁管理

功能:
  - 迁移 local state 到 OSS
  - 验证 state 完整性
  - 管理 state 锁 (force-unlock)
  - 备份 state 到本地
  - 比对 state 差异

用法:
  # 初始化 OSS backend
  python scripts/tfstate_migrate.py init --cloud aliyun

  # 迁移 state (local -> OSS)
  python scripts/tfstate_migrate.py migrate --cloud aliyun

  # 验证 state 完整性
  python scripts/tfstate_migrate.py verify --cloud aliyun

  # 备份 state 到本地
  python scripts/tfstate_migrate.py backup --cloud aliyun

  # 强制解锁 (生产慎用)
  python scripts/tfstate_migrate.py unlock --cloud aliyun --lock-id <LOCK_ID>

  # 列出 state 列表
  python scripts/tfstate_migrate.py list
"""
import os
import sys
import json
import shutil
import hashlib
import argparse
import subprocess
from pathlib import Path
from datetime import datetime, timezone

SERVER_DIR = Path(__file__).resolve().parent.parent
TERRAFORM_DIR = SERVER_DIR / "terraform"
BACKUP_DIR = SERVER_DIR / "logs" / "tfstate_backup"
BACKUP_DIR.mkdir(parents=True, exist_ok=True)

STATE_BUCKET = "zhs-tfstate"
STATE_PATHS = {
    "aliyun": "aliyun/prod/terraform.tfstate",
    "huawei": "huawei/prod/terraform.tfstate",
    "aws":    "aws/prod/terraform.tfstate",
    "cross-cloud": "cross-cloud/prod/terraform.tfstate",
}


def log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}", file=sys.stderr, flush=True)


def find_state_file(cloud: str) -> Path:
    """查找 local state 文件"""
    tf_dir = TERRAFORM_DIR / cloud
    return tf_dir / "terraform.tfstate"


def compute_md5(path: Path) -> str:
    """计算文件 MD5"""
    if not path.exists():
        return ""
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def run_terraform(tf_dir: Path, args: list[str]) -> dict:
    """运行 terraform 命令"""
    cmd = ["terraform"] + args
    log(f"  $ {' '.join(cmd)} (cwd={tf_dir})")
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300,
            cwd=str(tf_dir),
        )
        return {
            "rc": result.returncode,
            "stdout": result.stdout,
            "stderr": result.stderr,
        }
    except subprocess.TimeoutExpired:
        return {"rc": -1, "stdout": "", "stderr": "timeout"}
    except FileNotFoundError:
        return {"rc": -1, "stdout": "", "stderr": "terraform not found"}


def cmd_init(args) -> int:
    """初始化 OSS backend"""
    log(f"初始化 OSS backend: {args.cloud}")
    if args.cloud not in STATE_PATHS:
        log(f"❌ 未知云: {args.cloud}")
        return 1

    tf_dir = TERRAFORM_DIR / args.cloud
    if not tf_dir.exists():
        log(f"❌ 目录不存在: {tf_dir}")
        return 1

    # 切换 backend: 注释 local, 取消注释 oss
    # 此处仅打印提示
    log(f"  请确认 {tf_dir} 的 backend 配置已切换到 oss 块")
    log(f"  然后执行: cd {tf_dir} && terraform init -migrate-state")
    return 0


def cmd_migrate(args) -> int:
    """迁移 local state 到 OSS"""
    if args.cloud not in STATE_PATHS:
        log(f"❌ 未知云: {args.cloud}")
        return 1

    tf_dir = TERRAFORM_DIR / args.cloud
    state_file = find_state_file(args.cloud)

    if not state_file.exists():
        log(f"❌ local state 不存在: {state_file}")
        return 1

    # 备份当前 state
    backup_path = BACKUP_DIR / f"{args.cloud}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.tfstate"
    shutil.copy(state_file, backup_path)
    log(f"  备份: {backup_path} (md5: {compute_md5(state_file)})")

    # 执行迁移
    result = run_terraform(tf_dir, ["init", "-migrate-state", "-force-copy"])
    if result["rc"] != 0:
        log(f"❌ 迁移失败: {result['stderr']}")
        return 1

    log(f"✅ 迁移完成: {args.cloud} -> OSS")
    return 0


def cmd_verify(args) -> int:
    """验证 state 完整性"""
    if args.cloud not in STATE_PATHS:
        log(f"❌ 未知云: {args.cloud}")
        return 1

    tf_dir = TERRAFORM_DIR / args.cloud
    state_file = find_state_file(args.cloud)

    if not state_file.exists():
        log(f"❌ local state 不存在: {state_file}")
        return 1

    # 解析 state JSON
    try:
        with open(state_file, "r", encoding="utf-8") as f:
            state = json.load(f)
    except json.JSONDecodeError as e:
        log(f"❌ state JSON 解析失败: {e}")
        return 1

    # 验证必要字段
    required = ["version", "terraform_version", "serial", "lineage", "outputs", "resources"]
    for r in required:
        if r not in state:
            log(f"❌ state 缺少字段: {r}")
            return 1

    log(f"✅ state 完整性验证通过")
    log(f"  version: {state['version']}")
    log(f"  terraform_version: {state['terraform_version']}")
    log(f"  serial: {state['serial']}")
    log(f"  resources: {len(state.get('resources', []))}")
    log(f"  outputs: {len(state.get('outputs', {}))}")
    log(f"  size: {state_file.stat().st_size} bytes")
    log(f"  md5: {compute_md5(state_file)}")

    return 0


def cmd_backup(args) -> int:
    """备份 state 到本地"""
    if args.cloud not in STATE_PATHS:
        log(f"❌ 未知云: {args.cloud}")
        return 1

    state_file = find_state_file(args.cloud)
    if not state_file.exists():
        log(f"❌ local state 不存在: {state_file}")
        return 1

    backup_path = BACKUP_DIR / f"{args.cloud}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.tfstate"
    shutil.copy(state_file, backup_path)
    log(f"✅ 备份完成: {backup_path}")
    log(f"  size: {backup_path.stat().st_size} bytes")
    log(f"  md5: {compute_md5(backup_path)}")
    return 0


def cmd_unlock(args) -> int:
    """强制解锁"""
    log(f"⚠️ 强制解锁: {args.cloud} lock_id={args.lock_id}")
    tf_dir = TERRAFORM_DIR / args.cloud
    if not args.force:
        log("  (需添加 --force 确认)")
        return 1

    result = run_terraform(tf_dir, ["force-unlock", args.lock_id])
    if result["rc"] != 0:
        log(f"❌ 解锁失败: {result['stderr']}")
        return 1

    log("✅ 解锁成功")
    return 0


def cmd_list(args) -> int:
    """列出所有 state"""
    log("本地 state 文件列表:")
    for cloud in STATE_PATHS:
        state_file = find_state_file(cloud)
        if state_file.exists():
            size = state_file.stat().st_size
            md5 = compute_md5(state_file)
            log(f"  {cloud:15s} {size:>10} bytes  {md5}  {state_file}")
        else:
            log(f"  {cloud:15s} (无 local state)")

    log("")
    log("OSS 远程 state 路径 (需 ossutil):")
    for cloud, key in STATE_PATHS.items():
        log(f"  oss://{STATE_BUCKET}/{key}")

    log("")
    log("备份文件:")
    for f in sorted(BACKUP_DIR.glob("*.tfstate")):
        log(f"  {f.name} ({f.stat().st_size} bytes)")

    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Terraform State 远程化管理")
    sub = parser.add_subparsers(dest="command")

    init_p = sub.add_parser("init", help="初始化 backend")
    init_p.add_argument("--cloud", required=True, choices=list(STATE_PATHS.keys()))

    mig_p = sub.add_parser("migrate", help="迁移 state")
    mig_p.add_argument("--cloud", required=True, choices=list(STATE_PATHS.keys()))

    ver_p = sub.add_parser("verify", help="验证 state")
    ver_p.add_argument("--cloud", required=True, choices=list(STATE_PATHS.keys()))

    bk_p = sub.add_parser("backup", help="备份 state")
    bk_p.add_argument("--cloud", required=True, choices=list(STATE_PATHS.keys()))

    unl_p = sub.add_parser("unlock", help="强制解锁")
    unl_p.add_argument("--cloud", required=True, choices=list(STATE_PATHS.keys()))
    unl_p.add_argument("--lock-id", required=True)
    unl_p.add_argument("--force", action="store_true")

    sub.add_parser("list", help="列出所有 state")

    args = parser.parse_args()

    if args.command == "init":
        return cmd_init(args)
    if args.command == "migrate":
        return cmd_migrate(args)
    if args.command == "verify":
        return cmd_verify(args)
    if args.command == "backup":
        return cmd_backup(args)
    if args.command == "unlock":
        return cmd_unlock(args)
    if args.command == "list":
        return cmd_list(args)

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
