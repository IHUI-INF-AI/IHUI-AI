# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""WorkBuddy 成长任务一键自动驾驶(固定流程,零对话式探索)。

一条命令跑完「扫描 → 只对 verified 条目执行 desktop 链 → 领奖 → 终态表」:

    cd apps/ai-service
    .venv/Scripts/python.exe scripts/wb_autopilot.py                 # 默认 account 20
    .venv/Scripts/python.exe scripts/wb_autopilot.py --dry-run       # 只出计划,零出站
    .venv/Scripts/python.exe scripts/wb_autopilot.py --account-id 20 --owner 30763d9f-a4c4-4f0c-84c3-16d6b8a67c35

纪律(与 docs/WORKBUDDY_TASKS.md §12/§13 一致):
- 只执行动作表里 ``kind=desktop_expert`` 且 ``verified=true`` 的条目,其余任务只登记不执行;
- ``ok`` 判据 = 回读 progress 真前进(受理回执不算),复用 ``run_desktop_expert_task``;
- ``expert_actual_use.requestId`` 必须来自真实 chat 的服务端 SSE id —— 本脚本必然产生真实对话,
  不伪造任何上报;
- ``--dry-run`` 全程零写侧出站。
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path
from typing import Any

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services import workbuddy_direct_api as wda  # noqa: E402

WEB_BASE = "https://www.workbuddy.cn"
CHAT_BASE = "https://copilot.tencent.com"
DEFAULT_ACCOUNT_ID = 20
DEFAULT_OWNER = "30763d9f-a4c4-4f0c-84c3-16d6b8a67c35"
MARKET_SCAN_PAGES = 20
MARKET_PAGE_SIZE = 50


def _load_action_table() -> dict[str, Any]:
    """runner 需要原始 dict 条目(含 kind/expert_id/verified 元数据),直接读 JSON。

    执行器侧的 ``load_action_table`` 会把条目转成 ``ActionStep`` 对象,丢掉
    desktop_expert 元数据,故本脚本不经过它。
    """
    path = Path(__file__).resolve().parents[1] / "app" / "services" / "workbuddy_direct_actions.json"
    raw = json.loads(path.read_text(encoding="utf-8"))
    return raw if isinstance(raw, dict) else {}


def _verified_desktop_entries(table: dict[str, Any]) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for code, steps in table.items():
        if code == "__fallback__" or not isinstance(steps, list):
            continue
        for step in steps:
            if not isinstance(step, dict):
                continue
            if step.get("kind") == "desktop_expert" and step.get("verified") is True:
                entries.append({"task_code": code, **{k: v for k, v in step.items() if k not in ("kind",)}})
                break
    return entries


def _growth_headers(token: str, uid: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "X-User-Id": uid,
        "x-user-id": uid,
        "X-Domain": "copilot.tencent.com",
        "X-Product": "WorkBuddy",
        "User-Agent": "WorkBuddy/5.5.6",
        "Accept": "application/json",
    }


def _web_claim_headers(token: str, uid: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json",
        "Origin": WEB_BASE,
        "Referer": f"{WEB_BASE}/profile/growth-center",
        "x-client-platform": "web",
        "User-Agent": "WorkBuddy/5.5.6 WorkBuddy/5.5.6 CLI/2.137.1",
        "X-User-Id": uid,
    }


async def _read_tasks(client: httpx.AsyncClient, token: str, uid: str) -> dict[str, dict[str, Any]]:
    """现读成长任务全表(判「已领」= accept_status=='claimed',无 claimed 字段)。"""
    r = await client.get(f"{WEB_BASE}/v2/activity/growth/tasks", headers=_growth_headers(token, uid))
    r.raise_for_status()
    snapshot = wda.parse_task_snapshot(r.json())
    return snapshot or {}


async def _claim(client: httpx.AsyncClient, token: str, uid: str, task_code: str) -> dict[str, Any]:
    r = await client.post(
        f"{WEB_BASE}/activity/growth/tasks/{task_code}/claim", headers=_web_claim_headers(token, uid)
    )
    try:
        return {"status": r.status_code, "body": r.json()}
    except ValueError:
        return {"status": r.status_code, "body": {"raw": r.text[:200]}}


async def _resolve_expert(
    client: httpx.AsyncClient, token: str, uid: str, entry: dict[str, Any]
) -> dict[str, Any] | None:
    """按市场真实记录解析专家(keyword 优先,回退按 expert_id 扫页)。"""
    expert_id = str(entry.get("expert_id") or "")
    keyword = entry.get("market_keyword") or entry.get("display_name_zh")
    candidates: list[dict[str, Any]] = []
    if keyword:
        candidates = await wda.fetch_market_experts(client, token, uid, keyword=str(keyword), page_size=MARKET_PAGE_SIZE)
    hit = next((e for e in candidates if e.get("expert_id") == expert_id), None)
    if hit:
        return hit
    for page in range(1, MARKET_SCAN_PAGES + 1):
        rows = await wda.fetch_market_experts(client, token, uid, page=page, page_size=MARKET_PAGE_SIZE)
        if not rows:
            break
        hit = next((e for e in rows if e.get("expert_id") == expert_id), None)
        if hit:
            return hit
    return None


def _plan_line(entry: dict[str, Any], snap: dict[str, Any]) -> str:
    prog = snap.get("progress") or {}
    return (
        f"{entry['task_code']:34s} accept={str(snap.get('accept_status')):12s} "
        f"progress={prog.get('current')}/{prog.get('target')}"
    )


async def run(account_id: int, owner: str, *, dry_run: bool = False, claim: bool = True) -> int:
    from app.services import checkin_store

    acc = await checkin_store.get_decrypted_jwt(account_id, owner)
    token = acc["jwt"]
    device_map = acc.get("device_map") or {}
    if isinstance(device_map, str):
        device_map = json.loads(device_map)
    uid = str(device_map.get("uid") or "")
    nickname = str(device_map.get("nickname") or "user")
    if not uid:
        print("❌ 无法从 device_map 解析 uid,终止(fail-closed)")
        return 2

    entries = _verified_desktop_entries(_load_action_table())
    async with httpx.AsyncClient(timeout=60) as client:
        snapshot = await _read_tasks(client, token, uid)

        print(f"账号 account_id={account_id} uid=…{uid[-6:]}  动作表 verified desktop 条目 = {len(entries)}")
        print("=" * 78)
        plan: list[dict[str, Any]] = []
        for entry in entries:
            code = entry["task_code"]
            snap = snapshot.get(code)
            if snap is None:
                print(f"○ {code:34s} 不在当前任务列表(跳过)")
                continue
            prog = snap.get("progress") or {}
            cur, tgt = prog.get("current"), prog.get("target")
            if snap.get("accept_status") == "claimed":
                print(f"✓ {_plan_line(entry, snap)}  已 claimed(不重复)")
                continue
            if cur is not None and tgt and float(cur) >= float(tgt):
                plan.append({"entry": entry, "snap": snap, "action": "claim-only"})
                print(f"● {_plan_line(entry, snap)}  已达标待领奖")
                continue
            plan.append({"entry": entry, "snap": snap, "action": "run+claim"})
            print(f"→ {_plan_line(entry, snap)}  计划: desktop 链 + 领奖")
        print("=" * 78)

        if dry_run:
            print(f"DRY-RUN:计划 {len(plan)} 项,零出站(未执行)。")
            return 0

        total_credit = 0
        ok_count = 0
        for item in plan:
            entry = item["entry"]
            code = entry["task_code"]
            if item["action"] == "claim-only":
                if not claim:
                    continue
                receipt = await _claim(client, token, uid, code)
                print(f"[claim] {code} -> {receipt['status']}")
                continue
            expert = await _resolve_expert(client, token, uid, entry)
            if expert is None:
                print(f"✗ {code} 市场找不到 expert_id={entry.get('expert_id')}(未判定,跳过)")
                continue
            result = await wda.run_desktop_expert_task(
                client, token, uid, nickname, expert, read_tasks=lambda: _read_tasks(client, token, uid), task_code=code
            )
            mark = "★" if result.ok else "✗"
            print(f"[{mark}] {code} reason={result.reason} error={result.error[:60]}")
            if result.ok:
                ok_count += 1
                after_snap = (result.after or {}).get(code) or {}
                prog = after_snap.get("progress") or {}
                if claim and prog.get("current") is not None and prog.get("target") and float(prog["current"]) >= float(
                    prog["target"]
                ):
                    receipt = await _claim(client, token, uid, code)
                    body = receipt.get("body") or {}
                    data = body.get("data") if isinstance(body, dict) else {}
                    credit = (data or {}).get("credit") if isinstance(data, dict) else None
                    if isinstance(credit, (int, float)):
                        total_credit += int(credit)
                    print(f"    [claim] -> {receipt['status']} credit={credit}")

        final = await _read_tasks(client, token, uid)
        claimed = sum(1 for s in final.values() if s.get("accept_status") == "claimed")
        undone = [c for c, s in final.items() if s.get("accept_status") != "claimed"]
        print("=" * 78)
        print(f"终态:verified 链成功 {ok_count} 项 | 领奖 credit +{total_credit} | 任务表 {claimed}/{len(final)} claimed")
        if undone:
            for c in sorted(undone):
                s = final[c]
                prog = s.get("progress") or {}
                print(f"  未完成: {c:34s} accept={s.get('accept_status')} progress={prog.get('current')}/{prog.get('target')}")
        return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="WorkBuddy 成长任务一键自动驾驶")
    ap.add_argument("--account-id", type=int, default=DEFAULT_ACCOUNT_ID)
    ap.add_argument("--owner", default=DEFAULT_OWNER)
    ap.add_argument("--dry-run", action="store_true", help="只出计划,零写侧出站")
    ap.add_argument("--no-claim", dest="claim", action="store_false", help="只执行不领奖")
    args = ap.parse_args()
    return asyncio.run(run(args.account_id, args.owner, dry_run=args.dry_run, claim=args.claim))


if __name__ == "__main__":
    raise SystemExit(main())
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
