#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
凭证轮换检查清单执行器
========================

作用: 自动化执行 docs/KEY_ROTATION_RUNBOOK.md 中定义的轮换检查步骤
       提供交互式 checklist 工具, 确保每一步都被执行和记录

主要功能:
  1. list      - 列出所有待轮换项 (按优先级 P0/P1/P2/P3)
  2. show      - 显示某项的详细步骤
  3. check     - 标记某项为已完成
  4. uncheck   - 取消某项的完成标记
  5. status    - 查看整体进度
  6. verify    - 验证关键轮换项是否完成 (P0 必做)
  7. reset     - 重置所有完成标记
  8. report    - 生成审计报告

状态持久化: server/scripts/.rotation_state.json

关联文档:
  - docs/KEY_ROTATION_RUNBOOK.md
  - docs/PRODUCTION_CREDENTIALS.md
  - docs/PRODUCTION_INFRASTRUCTURE.md

使用方法:
  python server/scripts/credential_rotation_checklist.py list
  python server/scripts/credential_rotation_checklist.py show P0-1
  python server/scripts/credential_rotation_checklist.py check P0-1 --note "完成于 2026-06-25"
  python server/scripts/credential_rotation_checklist.py verify
  python server/scripts/credential_rotation_checklist.py status
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


# ============= 轮换项定义 =============

ROTATION_ITEMS = {
    # ============ P0 阻塞封版 ============
    "P0-1": {
        "priority": "P0",
        "name": "JKS 证书密码轮换 (jwt.jks / program.aizhs.top.jks)",
        "block_release": True,
        "runbook_section": "§1",
        "estimated_time": "30 分钟",
        "verify_command": "keytool -list -keystore ssl/program.aizhs.top.jks -storepass <NEW_PASS>",
        "rollback": "从 .bak 还原 keystore",
    },
    "P0-2": {
        "priority": "P0",
        "name": "智谱 GLM API Key 轮换",
        "block_release": True,
        "runbook_section": "§2",
        "estimated_time": "10 分钟",
        "verify_command": "curl -X POST https://open.bigmodel.cn/api/paas/v4/chat/completions -H 'Authorization: Bearer <NEW_KEY>' -d '{\"model\":\"glm-4-flash\",\"messages\":[{\"role\":\"user\",\"content\":\"ping\"}]}'",
        "rollback": "回滚 .env.production 旧 Key",
    },

    # ============ P1 30 天内 ============
    "P1-1": {
        "priority": "P1",
        "name": "MySQL 数据库密码轮换 (root + Raindrop_L)",
        "block_release": False,
        "deadline_days": 30,
        "runbook_section": "§3",
        "estimated_time": "15 分钟 (短暂中断)",
        "verify_command": "mysql -h <HOST> -u Raindrop_L -p<NEW_PASS> -e 'SHOW DATABASES;'",
        "rollback": "ALTER USER ... IDENTIFIED BY '<OLD_PASS>';",
    },
    "P1-2": {
        "priority": "P1",
        "name": "微信小程序 AppSecret 轮换",
        "block_release": False,
        "deadline_days": 30,
        "runbook_section": "§4.1",
        "estimated_time": "5 分钟",
        "verify_command": "curl -X GET 'https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=<APPID>&secret=<NEW_SECRET>'",
        "rollback": "微信公众平台 → 重置回原 Secret",
    },
    "P1-3": {
        "priority": "P1",
        "name": "微信支付 APIv3 Key 轮换",
        "block_release": False,
        "deadline_days": 30,
        "runbook_section": "§4.2",
        "estimated_time": "5 分钟",
        "verify_command": "微信支付商户平台 → 账户中心 → API 安全",
        "rollback": "回滚 .env.production 旧 Key",
    },
    "P1-4": {
        "priority": "P1",
        "name": "支付宝应用公钥轮换 (可选升级为公钥证书模式)",
        "block_release": False,
        "deadline_days": 30,
        "runbook_section": "§5.4",
        "estimated_time": "20 分钟",
        "verify_command": "支付宝开放平台 → 我的应用 → 接口加密方式",
        "rollback": "回滚 .env.production 旧公钥",
    },

    # ============ P2 90 天内 ============
    "P2-1": {
        "priority": "P2",
        "name": "17 个 AI 厂商 API Key 轮换",
        "block_release": False,
        "deadline_days": 90,
        "runbook_section": "§6",
        "estimated_time": "1-2 小时 (按厂商逐个)",
        "verify_command": "见 §6.2 各厂商 curl 验证",
        "rollback": "回滚 .env.production 旧 Key",
    },
    "P2-2": {
        "priority": "P2",
        "name": "Redis 密码轮换",
        "block_release": False,
        "deadline_days": 90,
        "runbook_section": "§7",
        "estimated_time": "5 分钟 (短暂中断)",
        "verify_command": "redis-cli -a <NEW_PASS> ping",
        "rollback": "回滚 redis.conf + .env.production",
    },
    "P2-3": {
        "priority": "P2",
        "name": "MinIO Access/Secret Key 轮换",
        "block_release": False,
        "deadline_days": 90,
        "runbook_section": "§8",
        "estimated_time": "10 分钟",
        "verify_command": "mc ls myminio/ (使用新凭据)",
        "rollback": "mc admin user remove myminio <NEW_USER>  (保留旧用户 7 天)",
    },
    "P2-4": {
        "priority": "P2",
        "name": "Coze OAuth 私钥轮换",
        "block_release": False,
        "deadline_days": 90,
        "runbook_section": "§9",
        "estimated_time": "15 分钟",
        "verify_command": "curl -X POST https://api.coze.cn/api/permission/oauth2/token -d 'client_id=<CLIENT_ID>' -d 'grant_type=client_credentials'",
        "rollback": "Coze 控制台 → 恢复旧公钥",
    },

    # ============ P3 任意时间 ============
    "P3-1": {
        "priority": "P3",
        "name": "钉钉 / 飞书 / 企微 Webhook Secret 轮换",
        "block_release": False,
        "runbook_section": "§10",
        "estimated_time": "15 分钟",
        "verify_command": "curl -X POST <WEBHOOK_URL> -d '{\"msgtype\":\"text\",\"text\":{\"content\":\"test\"}}'",
        "rollback": "回滚 .env.production 旧 Secret",
    },
    "P3-2": {
        "priority": "P3",
        "name": "SMTP 邮箱密码轮换",
        "block_release": False,
        "runbook_section": "§10 扩展",
        "estimated_time": "10 分钟",
        "verify_command": "smtplib 发送测试邮件",
        "rollback": "回滚 .env.production 旧密码",
    },
    "P3-3": {
        "priority": "P3",
        "name": "PagerDuty / Slack / Teams 路由密钥轮换",
        "block_release": False,
        "runbook_section": "§10 扩展",
        "estimated_time": "10 分钟",
        "verify_command": "各平台测试事件发送",
        "rollback": "回滚 .env.production 旧密钥",
    },
}

# 优先级排序
PRIORITY_ORDER = ["P0", "P1", "P2", "P3"]
PRIORITY_COLORS = {
    "P0": "\033[0;41;1;37m",  # 红色背景白字
    "P1": "\033[1;33m",        # 黄色
    "P2": "\033[0;33m",        # 暗黄
    "P3": "\033[0;32m",        # 绿色
}
NC = "\033[0m"


# ============= 状态持久化 =============

STATE_FILE = Path("server/scripts/.rotation_state.json")


def load_state() -> dict:
    if not STATE_FILE.exists():
        return {"items": {}, "last_updated": None}
    try:
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return {"items": {}, "last_updated": None}


def save_state(state: dict) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    state["last_updated"] = datetime.now(timezone.utc).isoformat()
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2, ensure_ascii=False)


# ============= 命令实现 =============

def cmd_list(args) -> int:
    """列出所有轮换项"""
    state = load_state()
    items_state = state.get("items", {})

    print(f"\n{'ID':<8} {'P':<4} {'状态':<6} {'名称':<50} {'耗时':<15} {'封版阻塞'}")
    print("-" * 110)
    for priority in PRIORITY_ORDER:
        for item_id, item in ROTATION_ITEMS.items():
            if item["priority"] != priority:
                continue
            record = items_state.get(item_id, {})
            if record.get("done"):
                status = f"\033[0;32m✓\033[0m"
            else:
                status = f"\033[0;31m✗\033[0m"
            block = "⚠️ 是" if item.get("block_release") else "否"
            color = PRIORITY_COLORS.get(priority, "")
            print(f"{color}{item_id:<8} {priority:<4}{NC} {status:<6} {item['name']:<50} {item.get('estimated_time', '?'):<15} {block}")
    print()
    return 0


def cmd_show(args) -> int:
    """显示单个轮换项的详细步骤"""
    item_id = args.item_id.upper()
    if item_id not in ROTATION_ITEMS:
        print(f"错误: 未知轮换项: {item_id}")
        print(f"可用: {', '.join(ROTATION_ITEMS.keys())}")
        return 1

    item = ROTATION_ITEMS[item_id]
    state = load_state()
    record = state.get("items", {}).get(item_id, {})

    print(f"\n{'=' * 80}")
    color = PRIORITY_COLORS.get(item["priority"], "")
    print(f"{color}{item_id} - {item['name']}{NC}")
    print(f"{'=' * 80}")
    print(f"  优先级:      {item['priority']}")
    print(f"  阻塞封版:    {'是 ⚠️' if item.get('block_release') else '否'}")
    if "deadline_days" in item:
        print(f"  截止天数:    {item['deadline_days']} 天")
    print(f"  预计耗时:    {item.get('estimated_time', '?')}")
    print(f"  Runbook 章节: {item.get('runbook_section', '?')}")
    print()
    print(f"  验证命令:")
    print(f"    {item.get('verify_command', '(无)')}")
    print()
    print(f"  回滚方法:")
    print(f"    {item.get('rollback', '(无)')}")
    print()

    if record.get("done"):
        print(f"  \033[0;32m✓ 已完成\033[0m")
        print(f"    完成时间: {record.get('done_at', '?')}")
        print(f"    操作人:   {record.get('operator', '?')}")
        if record.get("note"):
            print(f"    备注:     {record['note']}")
    else:
        print(f"  \033[0;31m✗ 未完成\033[0m")
    print()
    return 0


def cmd_check(args) -> int:
    """标记轮换项为已完成"""
    item_id = args.item_id.upper()
    if item_id not in ROTATION_ITEMS:
        print(f"错误: 未知轮换项: {item_id}")
        return 1

    state = load_state()
    state.setdefault("items", {})[item_id] = {
        "done": True,
        "done_at": datetime.now(timezone.utc).isoformat(),
        "operator": os.getenv("USER", "unknown"),
        "note": args.note or "",
    }
    save_state(state)

    item = ROTATION_ITEMS[item_id]
    print(f"\033[0;32m✓\033[0m {item_id} ({item['name']}) 标记为已完成")
    if args.note:
        print(f"  备注: {args.note}")
    return 0


def cmd_uncheck(args) -> int:
    """取消轮换项的完成标记"""
    item_id = args.item_id.upper()
    if item_id not in ROTATION_ITEMS:
        print(f"错误: 未知轮换项: {item_id}")
        return 1

    state = load_state()
    if item_id in state.get("items", {}):
        del state["items"][item_id]
        save_state(state)
        print(f"\033[0;33m⚠\033[0m {item_id} 已取消完成标记")
    else:
        print(f"{item_id} 本来就未完成")
    return 0


def cmd_status(args) -> int:
    """查看整体进度"""
    state = load_state()
    items_state = state.get("items", {})

    total = len(ROTATION_ITEMS)
    done = sum(1 for r in items_state.values() if r.get("done"))
    pending = total - done

    print(f"\n{'=' * 60}")
    print(f"  凭证轮换总体进度")
    print(f"{'=' * 60}")
    print(f"  总计:     {total}")
    print(f"  已完成:   \033[0;32m{done}\033[0m")
    print(f"  待完成:   \033[1;33m{pending}\033[0m")
    print(f"  完成率:   {done * 100 // total if total else 0}%")
    print()

    # 按优先级
    for priority in PRIORITY_ORDER:
        items_in_p = [(iid, it) for iid, it in ROTATION_ITEMS.items() if it["priority"] == priority]
        if not items_in_p:
            continue
        done_p = sum(1 for iid, _ in items_in_p if items_state.get(iid, {}).get("done"))
        color = PRIORITY_COLORS.get(priority, "")
        print(f"  {color}{priority}\033[0m: {done_p}/{len(items_in_p)}", end="")
        if priority == "P0" and done_p < len(items_in_p):
            not_done = [iid for iid, _ in items_in_p if not items_state.get(iid, {}).get("done")]
            print(f"  ⚠️ 阻塞封版: {', '.join(not_done)}")
        else:
            print()

    print()
    print(f"  上次更新: {state.get('last_updated', '从未')}")
    return 0


def cmd_verify(args) -> int:
    """验证 P0 项是否全部完成 (封版前必跑)"""
    state = load_state()
    items_state = state.get("items", {})

    p0_items = [(iid, it) for iid, it in ROTATION_ITEMS.items() if it["priority"] == "P0"]
    p0_done = [(iid, it) for iid, it in p0_items if items_state.get(iid, {}).get("done")]
    p0_pending = [(iid, it) for iid, it in p0_items if not items_state.get(iid, {}).get("done")]

    print(f"\n{'=' * 60}")
    print(f"  P0 阻塞项验证")
    print(f"{'=' * 60}")
    print(f"  P0 总计: {len(p0_items)}")
    print(f"  已完成:  \033[0;32m{len(p0_done)}\033[0m")
    print(f"  待完成:  \033[1;33m{len(p0_pending)}\033[0m")
    print()

    if p0_pending:
        print(f"  \033[0;41;1;37m⚠️ 封版阻塞\033[0m  以下 P0 项未完成:")
        for iid, it in p0_pending:
            print(f"    - {iid}: {it['name']}")
        print()
        print(f"  请执行 docs/KEY_ROTATION_RUNBOOK.md §1-§2 后再封版")
        return 1
    else:
        print(f"  \033[0;32m✓ 所有 P0 阻塞项已完成, 可以封版\033[0m")
        return 0


def cmd_reset(args) -> int:
    """重置所有完成标记"""
    if not args.yes:
        confirm = input("确认重置所有完成标记? [y/N]: ")
        if confirm.lower() != "y":
            print("已取消")
            return 0
    save_state({"items": {}, "last_updated": datetime.now(timezone.utc).isoformat()})
    print("\033[0;33m⚠\033[0m 已重置所有完成标记")
    return 0


def cmd_report(args) -> int:
    """生成审计报告"""
    state = load_state()
    items_state = state.get("items", {})

    report_path = Path(args.output) if args.output else Path(f"server/scripts/rotation_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md")

    lines = [
        "# 凭证轮换审计报告",
        "",
        f"**生成时间**: {datetime.now(timezone.utc).isoformat()}",
        f"**总项数**: {len(ROTATION_ITEMS)}",
        f"**已完成**: {sum(1 for r in items_state.values() if r.get('done'))}",
        f"**待完成**: {sum(1 for r in ROTATION_ITEMS.values() if not items_state.get(  [k for k,v in ROTATION_ITEMS.items() if v == r][0]  , {}).get('done'))}",
        "",
        "## 详细清单",
        "",
        "| ID | 优先级 | 名称 | 状态 | 完成时间 | 操作人 | 备注 |",
        "|---|---|---|---|---|---|---|",
    ]

    for priority in PRIORITY_ORDER:
        for item_id, item in ROTATION_ITEMS.items():
            if item["priority"] != priority:
                continue
            record = items_state.get(item_id, {})
            status = "✅" if record.get("done") else "❌"
            done_at = record.get("done_at", "-")
            operator = record.get("operator", "-")
            note = record.get("note", "-") or "-"
            lines.append(f"| {item_id} | {priority} | {item['name']} | {status} | {done_at} | {operator} | {note} |")

    lines.extend([
        "",
        "## 审计签字",
        "",
        "| 角色 | 姓名 | 签字 | 日期 |",
        "|---|---|---|---|",
        "| Owner | | | |",
        "| 运维 A | | | |",
        "| 运维 B | | | |",
        "",
        f"*本报告由 credential_rotation_checklist.py 自动生成*",
    ])

    report_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"\033[0;32m✓\033[0m 报告已生成: {report_path}")
    return 0


# ============= 主入口 =============

def main() -> int:
    parser = argparse.ArgumentParser(
        description="凭证轮换检查清单执行器",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    subparsers.add_parser("list", help="列出所有轮换项")
    subparsers.add_parser("status", help="查看整体进度")
    subparsers.add_parser("verify", help="验证 P0 项是否全部完成")
    subparsers.add_parser("reset", help="重置所有完成标记")

    p_show = subparsers.add_parser("show", help="显示某项的详细步骤")
    p_show.add_argument("item_id", help="轮换项 ID (如 P0-1)")

    p_check = subparsers.add_parser("check", help="标记某项为已完成")
    p_check.add_argument("item_id", help="轮换项 ID")
    p_check.add_argument("--note", help="备注 (如: 完成于 2026-06-25)")

    p_uncheck = subparsers.add_parser("uncheck", help="取消某项的完成标记")
    p_uncheck.add_argument("item_id", help="轮换项 ID")

    p_report = subparsers.add_parser("report", help="生成审计报告")
    p_report.add_argument("--output", "-o", help="输出文件路径")

    p_reset = subparsers.add_parser("reset_all", help="重置 (内部用)")
    p_reset.add_argument("--yes", action="store_true", help="跳过确认")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 1

    # Windows 下颜色兼容
    if sys.platform == "win32":
        os.system("color")

    handlers = {
        "list": cmd_list,
        "show": cmd_show,
        "check": cmd_check,
        "uncheck": cmd_uncheck,
        "status": cmd_status,
        "verify": cmd_verify,
        "reset": cmd_reset,
        "report": cmd_report,
        "reset_all": cmd_reset,
    }

    try:
        return handlers[args.command](args)
    except KeyboardInterrupt:
        print("\n用户中断")
        return 130
    except Exception as e:
        print(f"未预期异常: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
