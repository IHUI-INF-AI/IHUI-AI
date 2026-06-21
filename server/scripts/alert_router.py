#!/usr/bin/env python3
"""多渠道告警路由规则

策略:
- critical → 全部 4 渠道 (钉钉/企业微信/飞书/邮件)
- warning  → 钉钉 + 飞书 (快速通知)
- info     → 邮件 (异步记录)
- 自定义规则: 支持按 source / tag / keyword 路由

用法:
  python scripts/alert_router.py --level critical --title "..." --content "..." --source pg_backup
  python scripts/alert_router.py --level warning --title "..." --content "..." --tags "db,performance"
  python scripts/alert_router.py --list-rules
  python scripts/alert_router.py --test --level warning
"""
import os
import sys
import json
import argparse
import subprocess
from pathlib import Path
from datetime import datetime, timezone

SERVER_DIR = Path(__file__).resolve().parent.parent
LOG_DIR = SERVER_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
ROUTER_LOG = LOG_DIR / f"alert_router_{datetime.now(timezone.utc).strftime('%Y%m%d')}.log"

# 默认路由规则
DEFAULT_RULES = {
    "critical": ["dingtalk", "wechat", "feishu", "email"],
    "warning": ["dingtalk", "feishu"],
    "info": ["email"],
}

# 自定义路由规则: source -> {level -> channels}
SOURCE_RULES = {
    "pg_backup": {"critical": ["dingtalk", "email"], "warning": ["dingtalk"], "info": []},
    "pg_slow_query": {"warning": ["dingtalk", "feishu"], "info": ["email"]},
    "vault_rotation": {"critical": ["dingtalk", "wechat", "feishu", "email"]},
    "deploy": {"critical": ["dingtalk", "wechat"], "warning": ["dingtalk"]},
    "security_audit": {"critical": ["dingtalk", "wechat", "feishu", "email"]},
    "pitr_drill": {"critical": ["dingtalk"], "warning": ["dingtalk"]},
}

# 标签路由: tags -> 额外渠道
TAG_RULES = {
    "db": ["dingtalk"],
    "performance": ["dingtalk", "feishu"],
    "security": ["dingtalk", "wechat", "email"],
    "business": ["dingtalk", "wechat"],
    "infra": ["dingtalk", "feishu", "email"],
}

# 关键词路由: keyword -> 升级告警级别
KEYWORD_RULES = {
    "down": "critical",
    "outage": "critical",
    "failover": "critical",
    "deadlock": "warning",
    "slow": "warning",
}

LEVEL_PRIORITY = {"info": 0, "warning": 1, "critical": 2}


def log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    with open(ROUTER_LOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def upgrade_level(level: str, content: str) -> str:
    """根据关键词升级告警级别"""
    content_lower = content.lower()
    for kw, target in KEYWORD_RULES.items():
        if kw in content_lower:
            if LEVEL_PRIORITY.get(target, 0) > LEVEL_PRIORITY.get(level, 0):
                log(f"  关键词 '{kw}' 升级告警级别: {level} -> {target}")
                return target
    return level


def resolve_channels(level: str, source: str | None, tags: list[str] | None) -> list[str]:
    """根据规则解析最终渠道"""
    channels = set()

    # 1. 基础级别路由
    channels.update(DEFAULT_RULES.get(level, []))

    # 2. 源特定规则覆盖
    if source and source in SOURCE_RULES:
        source_channels = SOURCE_RULES[source].get(level, [])
        channels.update(source_channels)
        log(f"  源 {source} 规则: {source_channels}")

    # 3. 标签路由 (追加)
    if tags:
        for tag in tags:
            tag_channels = TAG_RULES.get(tag, [])
            channels.update(tag_channels)
            log(f"  标签 {tag} 渠道: {tag_channels}")

    return sorted(channels)


def dispatch_alert(level: str, title: str, content: str, channels: list[str], source: str | None, tags: list[str] | None, dry_run: bool) -> dict:
    """分发告警到各渠道 (调用 multi_channel_notify.py)"""
    notify_script = SERVER_DIR / "scripts" / "multi_channel_notify.py"
    results = {}
    for channel in channels:
        if dry_run:
            results[channel] = {
                "status": "dry_run",
                "level": level,
                "title": title,
                "channel": channel,
            }
            continue
        try:
            proc = subprocess.run(
                [
                    sys.executable, str(notify_script),
                    "--channel", channel,
                    "--title", title,
                    "--content", content,
                    "--level", level,
                ],
                capture_output=True,
                text=True,
                encoding="utf-8",
                cwd=str(SERVER_DIR),
                timeout=15,
            )
            results[channel] = {
                "status": "sent" if proc.returncode == 0 else "failed",
                "exit_code": proc.returncode,
            }
        except subprocess.TimeoutExpired:
            results[channel] = {"status": "timeout"}
        except Exception as e:
            results[channel] = {"status": "error", "error": str(e)}
    return {
        "level": level,
        "title": title,
        "source": source,
        "tags": tags or [],
        "channels": channels,
        "results": results,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def cmd_send(args) -> int:
    """发送告警"""
    level = args.level
    title = args.title
    content = args.content
    source = args.source
    tags = args.tags.split(",") if args.tags else []

    log(f"原始告警: level={level}, title={title}, source={source}, tags={tags}")

    # 关键词升级
    level = upgrade_level(level, content)
    log(f"最终级别: {level}")

    # 解析渠道
    channels = resolve_channels(level, source, tags)
    log(f"目标渠道: {channels}")

    if not channels:
        log("⚠️  无可用渠道, 跳过发送")
        result = {
            "level": level,
            "status": "skipped",
            "reason": "无匹配渠道",
        }
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0

    # 分发
    result = dispatch_alert(level, title, content, channels, source, tags, args.dry_run)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def cmd_list_rules(args) -> int:
    """列出所有路由规则"""
    rules = {
        "default_level_rules": DEFAULT_RULES,
        "source_rules": SOURCE_RULES,
        "tag_rules": TAG_RULES,
        "keyword_rules": KEYWORD_RULES,
    }
    print(json.dumps(rules, ensure_ascii=False, indent=2))
    return 0


def cmd_test(args) -> int:
    """测试路由解析"""
    tags = args.tags.split(",") if args.tags else []
    channels = resolve_channels(args.level, args.source, tags)
    result = {
        "level": args.level,
        "source": args.source,
        "tags": tags,
        "resolved_channels": channels,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="多渠道告警路由规则")
    sub = parser.add_subparsers(dest="command")

    send_p = sub.add_parser("send", help="发送告警 (会自动路由)")
    send_p.add_argument("--level", required=True, choices=["info", "warning", "critical"])
    send_p.add_argument("--title", required=True)
    send_p.add_argument("--content", required=True)
    send_p.add_argument("--source", help="告警源标识")
    send_p.add_argument("--tags", help="告警标签 (逗号分隔)")
    send_p.add_argument("--dry-run", action="store_true")

    sub.add_parser("list-rules", help="列出所有路由规则")

    test_p = sub.add_parser("test", help="测试路由解析")
    test_p.add_argument("--level", default="warning")
    test_p.add_argument("--source", default=None)
    test_p.add_argument("--tags", default=None)

    args = parser.parse_args()

    if args.command == "send":
        return cmd_send(args)
    if args.command == "list-rules":
        return cmd_list_rules(args)
    if args.command == "test":
        return cmd_test(args)

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
