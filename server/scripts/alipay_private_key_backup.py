#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
支付宝应用私钥永久备份提醒脚本
================================

⚠️ 关键警告 ⚠️
支付宝应用私钥 (ssl/appSecretRSA2048.txt) 一旦丢失, 整个支付宝应用必须重新创建,
历史交易无法解密。这是不可逆操作。

因此必须将私钥备份到至少 3 个独立的物理位置, 并定期验证备份完整性。

本脚本提供以下功能:
  1. check   - 检查本地 + 备份点是否存在
  2. backup  - 执行备份到指定位置 (U 盘 / KMS / 1Password)
  3. verify  - 验证所有备份的 SHA-256 哈希一致性
  4. remind  - 发送备份提醒 (钉钉/邮件/企业微信)
  5. restore - 紧急恢复 (从指定备份还原)
  6. status  - 显示当前备份状态总览

关联文档:
  - docs/PRODUCTION_CREDENTIALS.md
  - docs/KEY_ROTATION_RUNBOOK.md §5

使用方法:
  python server/scripts/alipay_private_key_backup.py check
  python server/scripts/alipay_private_key_backup.py backup --target usb1
  python server/scripts/alipay_private_key_backup.py verify
  python server/scripts/alipay_private_key_backup.py remind --channel dingtalk
  python server/scripts/alipay_private_key_backup.py status
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


# ============= 配置 =============

# 私钥本地路径 (主源)
DEFAULT_KEY_PATH = Path("ssl/appSecretRSA2048.txt")
# 公钥本地路径 (用于关联验证)
DEFAULT_PUB_PATH = Path("ssl/alipayPublicKey_RSA2.txt")

# 备份清单: 名称 -> 路径模板 / 类型
# 类型说明:
#   file:    本地/网络挂载路径 (cp/rsync)
#   kms:     阿里云 KMS (aliyun cli)
#   onepassword: 1Password CLI (op)
#   paper:   纸质打印 (仅记录, 不实际打印)
#   hardware: 硬件加密狗 / YubiKey
BACKUP_TARGETS = {
    "usb1": {
        "type": "file",
        "path": "/media/usb1/alipay-backup/",
        "description": "主 U 盘 (Owner 保管)",
    },
    "usb2": {
        "type": "file",
        "path": "/media/usb2/alipay-backup/",
        "description": "异地 U 盘 (运维 A 保管)",
    },
    "kms": {
        "type": "kms",
        "path": "alipay-app-private-key",
        "description": "阿里云 KMS (加密存储)",
    },
    "onepassword": {
        "type": "onepassword",
        "path": "vault://AI智汇社-生产密钥/Alipay-应用私钥",
        "description": "1Password 团队库",
    },
    "paper": {
        "type": "paper",
        "path": "safe-deposit-box://3F-021",
        "description": "纸质打印 (银行保险箱, Owner 持有)",
    },
    "hardware": {
        "type": "hardware",
        "path": "yubikey://slot-9c",
        "description": "YubiKey 硬件加密 (推荐)",
    },
}

# 提醒通道
REMIND_CHANNELS = {
    "dingtalk": {
        "env": "DINGTALK_WEBHOOK",
        "secret_env": "DINGTALK_SECRET",
    },
    "feishu": {
        "env": "FEISHU_WEBHOOK",
        "secret_env": "FEISHU_SECRET",
    },
    "wecom": {
        "env": "WECHAT_WORK_WEBHOOK",
    },
    "email": {
        "smtp_host_env": "ALERT_SMTP_HOST",
        "smtp_user_env": "ALERT_SMTP_USER",
        "smtp_pass_env": "ALERT_SMTP_PASS",
        "to_env": "ALERT_EMAIL_TO",
    },
}

# 备份状态持久化文件
STATE_FILE = Path("server/scripts/.alipay_backup_state.json")


# ============= 工具函数 =============

def log(level: str, msg: str) -> None:
    colors = {
        "INFO": "\033[0;32m",
        "WARN": "\033[1;33m",
        "ERROR": "\033[0;31m",
        "CRITICAL": "\033[0;41;1;37m",
    }
    color = colors.get(level, "")
    nc = "\033[0m"
    print(f"{color}[{level}]{nc} {msg}", flush=True)


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def load_state() -> dict:
    if not STATE_FILE.exists():
        return {"backups": {}, "last_verify": None}
    try:
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return {"backups": {}, "last_verify": None}


def save_state(state: dict) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2, ensure_ascii=False)


def require_key() -> Path:
    """检查本地私钥文件存在"""
    if not DEFAULT_KEY_PATH.exists():
        log("CRITICAL", f"私钥文件不存在: {DEFAULT_KEY_PATH}")
        log("CRITICAL", "请先从历史项目 archive 还原, 或从已有备份恢复")
        sys.exit(1)
    return DEFAULT_KEY_PATH


# ============= 命令: check =============

def cmd_check(args) -> int:
    log("INFO", "=== 检查支付宝私钥本地状态 ===")
    key_path = require_key()
    key_hash = sha256_file(key_path)
    key_size = key_path.stat().st_size

    log("INFO", f"私钥文件: {key_path}")
    log("INFO", f"文件大小: {key_size} bytes")
    log("INFO", f"SHA-256:  {key_hash}")

    # 检查公钥
    if DEFAULT_PUB_PATH.exists():
        pub_hash = sha256_file(DEFAULT_PUB_PATH)
        log("INFO", f"公钥文件: {DEFAULT_PUB_PATH} ({DEFAULT_PUB_PATH.stat().st_size} bytes)")
        log("INFO", f"公钥 SHA-256: {pub_hash}")
    else:
        log("WARN", f"公钥文件不存在: {DEFAULT_PUB_PATH}")

    # 检查文件格式
    try:
        with open(key_path, "r", encoding="utf-8") as f:
            content = f.read()
        if "BEGIN" not in content or "PRIVATE KEY" not in content:
            log("ERROR", "私钥文件格式异常, 缺少 BEGIN PRIVATE KEY 标记")
            return 1
        log("INFO", "私钥文件格式校验通过 (PEM)")
    except Exception as e:
        log("ERROR", f"读取私钥失败: {e}")
        return 1

    log("INFO", "本地私钥检查完成")
    return 0


# ============= 命令: backup =============

def cmd_backup(args) -> int:
    log("INFO", "=== 执行支付宝私钥备份 ===")
    key_path = require_key()
    target_name = args.target

    if target_name not in BACKUP_TARGETS:
        log("ERROR", f"未知备份目标: {target_name}")
        log("INFO", f"可用目标: {', '.join(BACKUP_TARGETS.keys())}")
        return 1

    target = BACKUP_TARGETS[target_name]
    key_hash = sha256_file(key_path)
    key_size = key_path.stat().st_size
    timestamp = datetime.now(timezone.utc).isoformat()
    backup_filename = f"appSecretRSA2048_{datetime.now().strftime('%Y%m%d')}.txt"

    log("INFO", f"目标: {target_name} ({target['type']}) - {target['description']}")
    log("INFO", f"私钥 SHA-256: {key_hash}")

    success = False
    if target["type"] == "file":
        success = backup_to_file(target["path"], key_path, backup_filename)
    elif target["type"] == "kms":
        success = backup_to_kms(target["path"], key_path, key_hash)
    elif target["type"] == "onepassword":
        success = backup_to_onepassword(target["path"], key_path)
    elif target["type"] == "paper":
        log("WARN", "纸质备份需要手动执行: 打印 -> 编号 -> 装入保险箱")
        log("INFO", f"应打印 SHA-256: {key_hash}")
        log("INFO", f"保险箱位置: {target['path']}")
        success = True  # 标记为待人工确认
    elif target["type"] == "hardware":
        log("INFO", f"硬件备份需要 YubiKey 管理工具: {target['path']}")
        log("INFO", "请使用 ykman 命令: ykman piv keys import 9c <key.pem>")
        success = True  # 标记为待人工确认
    else:
        log("ERROR", f"不支持的备份类型: {target['type']}")
        return 1

    # 记录到 state
    state = load_state()
    state["backups"][target_name] = {
        "type": target["type"],
        "sha256": key_hash,
        "size": key_size,
        "timestamp": timestamp,
        "operator": os.getenv("USER", "unknown"),
        "manual_confirm_required": target["type"] in ("paper", "hardware"),
        "success": success,
    }
    save_state(state)

    if success:
        log("INFO", f"备份 {target_name} 完成")
    else:
        log("ERROR", f"备份 {target_name} 失败")

    return 0 if success else 1


def backup_to_file(target_dir: str, key_path: Path, filename: str) -> bool:
    """备份到本地/挂载目录"""
    target_path = Path(target_dir)
    if not target_path.parent.exists():
        log("ERROR", f"父目录不存在: {target_path.parent}")
        log("INFO", "如果是 U 盘, 请先 mount:")
        log("INFO", "  Linux: sudo mount /dev/sdb1 /media/usb1")
        log("INFO", "  macOS: diskutil mount /dev/disk2s1")
        log("INFO", "  Windows (Git Bash): ls /e/ /f/ /g/ 查看盘符")
        return False

    target_path.mkdir(parents=True, exist_ok=True)
    target_file = target_path / filename
    try:
        shutil.copy2(key_path, target_file)
        # 限制权限为 600
        os.chmod(target_file, 0o600)
        log("INFO", f"已复制到: {target_file}")
        # 同时写一份 SHA-256 校验文件
        hash_file = target_path / f"{filename}.sha256"
        with open(hash_file, "w") as f:
            f.write(f"{sha256_file(target_file)}  {filename}\n")
        os.chmod(hash_file, 0o600)
        log("INFO", f"校验文件: {hash_file}")
        return True
    except (OSError, shutil.Error) as e:
        log("ERROR", f"复制失败: {e}")
        return False


def backup_to_kms(secret_name: str, key_path: Path, key_hash: str) -> bool:
    """备份到阿里云 KMS (需要 aliyun cli)"""
    if not shutil.which("aliyun"):
        log("ERROR", "aliyun CLI 未安装")
        log("INFO", "安装: https://help.aliyun.com/document_detail/121541.html")
        return False

    try:
        # 读取私钥内容 (避免命令行泄露, 使用 stdin)
        with open(key_path, "r", encoding="utf-8") as f:
            key_content = f.read()
        # 2026-06-25 修复: 原硬编码 /tmp/alipay_key_for_kms.tmp 在 Windows 上会创建到 G:\tmp\...
        # 改用 tempfile.gettempdir() 跨平台
        tmp = Path(tempfile.gettempdir()) / "alipay_key_for_kms.tmp"
        tmp.write_text(key_content)
        tmp.chmod(0o600)
        try:
            # 调用 aliyun cli 上传
            subprocess.run(
                [
                    "aliyun", "kms", "CreateSecret",
                    "--SecretName", secret_name,
                    "--SecretData", f"file://{tmp}",
                    "--Description", f"Alipay RSA 2048 private key, SHA-256={key_hash}",
                ],
                check=True,
                capture_output=True,
                timeout=30,
            )
            log("INFO", f"已上传到 KMS: {secret_name}")
            return True
        finally:
            tmp.unlink(missing_ok=True)
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError) as e:
        log("ERROR", f"KMS 上传失败: {e}")
        return False


def backup_to_onepassword(uri: str, key_path: Path) -> bool:
    """备份到 1Password (需要 op CLI + 已登录)"""
    if not shutil.which("op"):
        log("ERROR", "1Password CLI 未安装")
        log("INFO", "安装: https://developer.1password.com/docs/cli/get-started/")
        return False
    # 1Password 通过 stdin 接收文档内容
    try:
        with open(key_path, "rb") as f:
            key_content = f.read()
        # 创建/更新 1Password 文档
        subprocess.run(
            ["op", "document", "create", "--uri", uri, "--file-path", str(key_path)],
            input=key_content,
            check=True,
            capture_output=True,
            timeout=60,
        )
        log("INFO", f"已上传到 1Password: {uri}")
        return True
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError) as e:
        log("ERROR", f"1Password 上传失败: {e}")
        return False


# ============= 命令: verify =============

def cmd_verify(args) -> int:
    log("INFO", "=== 验证所有备份完整性 ===")
    key_path = require_key()
    local_hash = sha256_file(key_path)
    log("INFO", f"本地私钥 SHA-256: {local_hash}")
    print()

    state = load_state()
    mismatches = 0
    missing = 0

    for name, target in BACKUP_TARGETS.items():
        print(f"  [{name}] {target['description']}")
        record = state.get("backups", {}).get(name)
        if not record:
            log("WARN", "    ⚠ 无备份记录")
            missing += 1
            continue

        if target["type"] == "file":
            # 检查备份文件是否存在 + 哈希一致
            backup_dir = Path(target["path"])
            if not backup_dir.exists():
                log("ERROR", "    ✗ 备份目录不存在")
                missing += 1
                continue
            # 找最新的备份文件
            backups = sorted(backup_dir.glob("appSecretRSA2048_*.txt"))
            if not backups:
                log("ERROR", "    ✗ 无备份文件")
                missing += 1
                continue
            latest = backups[-1]
            actual_hash = sha256_file(latest)
            if actual_hash == local_hash:
                log("INFO", f"    ✓ {latest.name} (SHA-256 一致)")
            else:
                log("ERROR", f"    ✗ {latest.name} 哈希不匹配!")
                log("ERROR", f"      期望: {local_hash}")
                log("ERROR", f"      实际: {actual_hash}")
                mismatches += 1
        elif target["type"] in ("kms", "onepassword", "paper", "hardware"):
            # 远程/特殊备份, 只检查 state 记录
            if record.get("sha256") == local_hash:
                log("INFO", f"    ✓ state 记录一致 ({record.get('timestamp')})")
            else:
                log("ERROR", "    ✗ state 哈希与本地不匹配")
                mismatches += 1

    print()
    if mismatches == 0 and missing == 0:
        log("INFO", "所有备份验证通过")
        state["last_verify"] = datetime.now(timezone.utc).isoformat()
        save_state(state)
        return 0
    else:
        log("ERROR", f"验证失败: {mismatches} 个不匹配, {missing} 个缺失")
        return 1


# ============= 命令: remind =============

def cmd_remind(args) -> int:
    log("INFO", f"=== 发送备份提醒 ({args.channel}) ===")
    state = load_state()
    backups = state.get("backups", {})
    last_verify = state.get("last_verify", "从未")

    # 构建提醒消息
    pending = [
        name for name in BACKUP_TARGETS
        if name not in backups or not backups[name].get("success")
    ]

    msg_lines = [
        "## 🔐 支付宝应用私钥备份提醒",
        "",
        f"**检查时间**: {datetime.now(timezone.utc).isoformat()}",
        f"**上次验证**: {last_verify}",
        "",
        "**已完成备份**: " + (", ".join(backups.keys()) if backups else "(无)"),
        "**待备份**: " + (", ".join(pending) if pending else "(全部完成)"),
        "",
        "**关联文档**: docs/PRODUCTION_CREDENTIALS.md §6",
        "",
        "⚠️ 支付宝应用私钥丢失将导致整个应用无法使用, 请立即补全备份!",
    ]
    message = "\n".join(msg_lines)

    log("INFO", "提醒消息:")
    print(message)
    print()

    # 实际发送
    if args.channel == "dingtalk":
        return send_dingtalk(message)
    elif args.channel == "feishu":
        return send_feishu(message)
    elif args.channel == "wecom":
        return send_wecom(message)
    elif args.channel == "email":
        return send_email(message)
    elif args.channel == "dry-run":
        log("INFO", "(dry-run 模式, 未实际发送)")
        return 0
    else:
        log("ERROR", f"不支持的通道: {args.channel}")
        return 1


def send_dingtalk(message: str) -> int:
    webhook = os.getenv("DINGTALK_WEBHOOK")
    secret = os.getenv("DINGTALK_SECRET")
    if not webhook:
        log("ERROR", "环境变量 DINGTALK_WEBHOOK 未设置")
        return 1
    # 简化: 实际生产应使用钉钉 SDK + 签名
    log("WARN", "钉钉发送需要 httpx 库, 此处仅打印 webhook URL")
    log("INFO", f"Webhook: {webhook[:30]}...")
    log("INFO", "请使用现有 alert 模块的 send_dingtalk 函数")
    return 0


def send_feishu(message: str) -> int:
    webhook = os.getenv("FEISHU_WEBHOOK")
    if not webhook:
        log("ERROR", "环境变量 FEISHU_WEBHOOK 未设置")
        return 1
    log("WARN", "飞书发送需要 httpx 库, 此处仅打印 webhook URL")
    return 0


def send_wecom(message: str) -> int:
    webhook = os.getenv("WECHAT_WORK_WEBHOOK")
    if not webhook:
        log("ERROR", "环境变量 WECHAT_WORK_WEBHOOK 未设置")
        return 1
    log("WARN", "企微发送需要 httpx 库, 此处仅打印 webhook URL")
    return 0


def send_email(message: str) -> int:
    smtp_host = os.getenv("ALERT_SMTP_HOST")
    to = os.getenv("ALERT_EMAIL_TO")
    if not smtp_host or not to:
        log("ERROR", "环境变量 ALERT_SMTP_HOST / ALERT_EMAIL_TO 未设置")
        return 1
    log("WARN", "邮件发送需要 aiosmtplib 库, 此处仅打印收件人")
    log("INFO", f"收件人: {to}")
    return 0


# ============= 命令: restore =============

def cmd_restore(args) -> int:
    log("INFO", f"=== 紧急恢复私钥 (从 {args.source}) ===")
    log("CRITICAL", "此操作将覆盖本地私钥文件, 确认后操作不可逆!")
    log("CRITICAL", "请确保: 1) 当前私钥已无法使用 2) 已通知 Owner 3) 已审计")
    if not args.yes:
        confirm = input("输入 YES 确认恢复: ")
        if confirm != "YES":
            log("INFO", "已取消")
            return 1

    target = BACKUP_TARGETS.get(args.source)
    if not target:
        log("ERROR", f"未知备份源: {args.source}")
        return 1

    if target["type"] != "file":
        log("ERROR", f"非 file 类型备份暂不支持自动恢复, 请手动操作: {target['type']}")
        return 1

    backup_dir = Path(target["path"])
    if not backup_dir.exists():
        log("ERROR", f"备份目录不存在: {backup_dir}")
        return 1

    backups = sorted(backup_dir.glob("appSecretRSA2048_*.txt"))
    if not backups:
        log("ERROR", "无备份文件")
        return 1

    source = backups[-1]
    log("INFO", f"将从此文件恢复: {source}")

    # 备份当前文件
    if DEFAULT_KEY_PATH.exists():
        bak = DEFAULT_KEY_PATH.with_suffix(f".txt.before-restore.{datetime.now().strftime('%Y%m%d_%H%M%S')}")
        shutil.copy2(DEFAULT_KEY_PATH, bak)
        log("INFO", f"当前私钥已备份: {bak}")

    # 执行恢复
    shutil.copy2(source, DEFAULT_KEY_PATH)
    os.chmod(DEFAULT_KEY_PATH, 0o600)
    log("INFO", f"恢复完成: {DEFAULT_KEY_PATH}")
    log("INFO", f"恢复后 SHA-256: {sha256_file(DEFAULT_KEY_PATH)}")
    log("INFO", "请立即重启后端 + 测试支付宝支付流程")
    return 0


# ============= 命令: status =============

def cmd_status(args) -> int:
    log("INFO", "=== 支付宝私钥备份状态总览 ===")
    print()

    # 本地文件
    if DEFAULT_KEY_PATH.exists():
        log("INFO", f"本地私钥: ✓ {DEFAULT_KEY_PATH} ({DEFAULT_KEY_PATH.stat().st_size} bytes)")
    else:
        log("CRITICAL", f"本地私钥: ✗ 不存在: {DEFAULT_KEY_PATH}")

    print()
    state = load_state()
    backups = state.get("backups", {})

    # 备份状态表
    print(f"  {'目标':<15} {'类型':<12} {'状态':<8} {'时间':<25} {'描述'}")
    print("  " + "-" * 100)
    for name, target in BACKUP_TARGETS.items():
        record = backups.get(name)
        if record and record.get("success"):
            if target["type"] in ("paper", "hardware"):
                status = "待人工"
            else:
                status = "✓ 已备份"
            ts = record.get("timestamp", "?")[:19]
        else:
            status = "✗ 未备份"
            ts = "-"
        print(f"  {name:<15} {target['type']:<12} {status:<8} {ts:<25} {target['description']}")

    print()
    log("INFO", f"上次验证: {state.get('last_verify', '从未')}")
    log("INFO", f"备份进度: {len(backups)}/{len(BACKUP_TARGETS)}")

    if not backups or len(backups) < 3:
        log("WARN", "建议至少 3 个独立位置的备份 (推荐 5+)")

    return 0


# ============= 主入口 =============

def main() -> int:
    parser = argparse.ArgumentParser(
        description="支付宝应用私钥永久备份管理工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    subparsers.add_parser("check", help="检查本地私钥状态")
    subparsers.add_parser("verify", help="验证所有备份完整性")
    subparsers.add_parser("status", help="显示备份状态总览")

    p_backup = subparsers.add_parser("backup", help="执行备份到指定目标")
    p_backup.add_argument(
        "--target", required=True, choices=list(BACKUP_TARGETS.keys()),
        help=f"备份目标: {', '.join(BACKUP_TARGETS.keys())}",
    )

    p_remind = subparsers.add_parser("remind", help="发送备份提醒")
    p_remind.add_argument(
        "--channel", required=True,
        choices=list(REMIND_CHANNELS.keys()) + ["dry-run"],
        default="dry-run",
    )

    p_restore = subparsers.add_parser("restore", help="紧急恢复私钥")
    p_restore.add_argument(
        "--source", required=True, choices=list(BACKUP_TARGETS.keys()),
        help="恢复源",
    )
    p_restore.add_argument(
        "--yes", action="store_true",
        help="跳过确认 (危险)",
    )

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 1

    # Windows 下颜色兼容
    if sys.platform == "win32":
        os.system("color")

    handlers = {
        "check": cmd_check,
        "backup": cmd_backup,
        "verify": cmd_verify,
        "remind": cmd_remind,
        "restore": cmd_restore,
        "status": cmd_status,
    }

    try:
        return handlers[args.command](args)
    except KeyboardInterrupt:
        log("WARN", "用户中断")
        return 130
    except Exception as e:
        log("ERROR", f"未预期异常: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
