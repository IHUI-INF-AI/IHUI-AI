# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""WorkBuddy 成长任务一键自动驾驶(CLI 薄壳;核心逻辑单源在服务层)。

一条命令跑完「扫描 → 全量选路(desktop 链 / generic 直连链 / 领奖)→ 终态表」:

    cd apps/ai-service
    .venv/Scripts/python.exe scripts/wb_autopilot.py                 # 默认 account 20
    .venv/Scripts/python.exe scripts/wb_autopilot.py --dry-run       # 只出计划,零出站
    .venv/Scripts/python.exe scripts/wb_autopilot.py --account-id 20 --owner 30763d9f-a4c4-4f0c-84c3-16d6b8a67c35

选路与纪律(单源见 ``app/services/workbuddy_autopilot.py`` 模块 docstring):
- verified desktop_expert 条目 ⇒ desktop 链;全 verified http 链(Sequential 族等)⇒
  通用直连执行器;无 verified 链 ⇒ 只登记,零出站(防伪造纪律不删);
- ``ok`` 判据 = 回读 progress 真前进(受理回执不算);
- ``accept_status == 'claimed'`` 秒跳过 ⇒ 全表 claimed 时等价一次只读扫表,可复跑;
- 调度器 ``checkin_scheduler._workbuddy_task_sweep`` 每轮自动执行同一引擎(无人值守)。
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services import workbuddy_autopilot as ap  # noqa: E402

DEFAULT_ACCOUNT_ID = 20
DEFAULT_OWNER = "30763d9f-a4c4-4f0c-84c3-16d6b8a67c35"


def _print_summary(s: dict) -> None:
    print(f"账号任务表 {s['total_tasks']} 条 | claimed_already {len(s['claimed_already'])} | "
          f"unregistered(零出站登记) {len(s['unregistered'])}")
    for item in s.get("plan", []):
        print(f"  [plan] {item['code']:34s} route={item['route']:12s} progress={item['progress']}")
    for item in s["executed"]:
        mark = "★" if item.get("ok") else "✗"
        print(f"  [{mark}] {item['code']:34s} route={item.get('route')} reason={item.get('reason')} {item.get('error', '')}")
    for u in s["undone"]:
        print(f"  [未完成] {u.get('code')}: {u.get('reason')} {u.get('error', '')}")
    print(f"终态: 执行 {len(s['executed'])} 项 | 领奖 {len(s['claimed'])} 项 credit +{s['credits']}"
          f"{' | DRY-RUN 零出站' if s['dry_run'] else ''}")


async def run(account_id: int, owner: str, *, dry_run: bool = False, claim: bool = True) -> int:
    from app.services import checkin_store

    acc = await checkin_store.get_decrypted_jwt(account_id, owner)
    token = acc["jwt"]
    device_map = acc.get("device_map") or {}
    if isinstance(device_map, str):
        device_map = json.loads(device_map)
    summary = await ap.run_autopilot(token, device_map, dry_run=dry_run, claim=claim)
    _print_summary(summary)
    return 0 if summary["ok"] else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="WorkBuddy 成长任务一键自动驾驶(全量选路)")
    parser.add_argument("--account-id", type=int, default=DEFAULT_ACCOUNT_ID)
    parser.add_argument("--owner", default=DEFAULT_OWNER)
    parser.add_argument("--dry-run", action="store_true", help="只出计划,零写侧出站")
    parser.add_argument("--no-claim", dest="claim", action="store_false", help="只执行不领奖")
    args = parser.parse_args()
    return asyncio.run(run(args.account_id, args.owner, dry_run=args.dry_run, claim=args.claim))


if __name__ == "__main__":
    raise SystemExit(main())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
