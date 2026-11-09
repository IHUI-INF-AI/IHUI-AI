# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""WorkBuddy 成长任务**全量自动驾驶引擎**(服务层单源,CLI 与调度器共用)。

2026-11-09 收口(回应「为什么没有固定流程一键完成」):
此前自动化分散在「六族巡检(growth 族只 accept/claim)+ desktop 链专用脚本」两层,
真行为项(desktop_expert / Sequential 族)不在服务端巡检射程内,只能靠 AI 会话手动跑。
本模块把**全量选路**下沉为服务层单源:

    扫任务全表 → 每条未 claimed 任务自动选路 → 执行 → 回读裁决 → 领奖 → 终态表

选路判据(单源 = 动作表 ``workbuddy_direct_actions.json``):
- 存在 ``kind=desktop_expert`` 且 ``verified=true`` 的条目 ⇒ desktop 链
  (市场取真实 version → 真实 chat 拿服务端 requestId → summon+actual_use 上报);
- 全部步骤为 ``kind=http`` 且 ``verified=true`` ⇒ 通用直连执行器 ``execute_task_code``
  (Sequential 族等;步骤受理回执不构成成功);
- 其余 ⇒ 只登记 ``unregistered``,**零出站**(防伪造纪律:裸合成遥测已证伪不计分,
  2026-11-05 账号 3559/3564 实证,不得再打)。

成功判据与直连执行器一致:``ok`` 只来自回读 ``progress`` 真前进
(``_progress_advanced``),领奖回执/HTTP 200 一律不算完成。

**两口径分离**(2026-11-09 契约修正):
- runner 判据口径 = ``wda.parse_task_snapshot`` 快照形状
  ``{code: {progress_current, accept_status, status}}``(无 target,供 _progress_advanced);
- 计划/领奖口径 = 原始任务行 ``{code: {accept_status, current, target}}``(有 target,
  供「达标待领奖」判定)。同一次 GET 产两份,绝不混用形状。

幂等:``accept_status == 'claimed'`` 的任务秒跳过,零写侧;全表 claimed 时本轮
等价于一次只读扫表,可被调度器按任意频率安全复跑。

入口:
- CLI:      ``scripts/wb_autopilot.py``(薄壳)
- 调度器:   ``checkin_scheduler._workbuddy_task_sweep`` 每轮对 workbuddy 账号自动执行
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Awaitable, Callable

import httpx

from app.services import workbuddy_direct_api as wda

WEB_BASE = "https://www.workbuddy.cn"
MARKET_SCAN_PAGES = 20
MARKET_PAGE_SIZE = 50
DEFAULT_TIMEOUT = 60.0

ActionTableLoader = Callable[[], dict[str, Any]]
DesktopRunner = Callable[..., Awaitable[wda.DirectApiResult]]
GenericRunner = Callable[..., Awaitable[wda.DirectApiResult]]

_ACTION_TABLE_PATH = Path(__file__).resolve().parent / "workbuddy_direct_actions.json"


def load_raw_action_table(path: str | Path = _ACTION_TABLE_PATH) -> dict[str, Any]:
    """读动作表原始 JSON(保留 kind/expert_id/verified 元数据;执行器侧转换会丢元数据)。"""
    raw = json.loads(Path(path).read_text(encoding="utf-8"))
    return raw if isinstance(raw, dict) else {}


def route_of(code: str, table: dict[str, Any]) -> tuple[str | None, dict[str, Any]]:
    """纯函数选路:返回 (route, meta)。route ∈ {'desktop','generic',None}。

    - desktop: 存在 verified desktop_expert 条目(meta 含 expert_id/market_keyword);
    - generic: 全部步骤 kind=http 且 verified=true(Sequential 族等);
    - None:    无 verified 链 ⇒ 只登记不执行(防伪造,零出站)。
    """
    steps = table.get(code)
    if not isinstance(steps, list) or not steps:
        return None, {}
    for step in steps:
        if isinstance(step, dict) and step.get("kind") == "desktop_expert" and step.get("verified") is True:
            meta = {k: v for k, v in step.items() if k not in ("kind",)}
            return "desktop", meta
    if all(
        isinstance(s, dict) and s.get("kind", "http") == "http" and s.get("verified") is True
        for s in steps
    ):
        return "generic", {}
    return None, {}


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


async def _fetch_task_payload(
    client: httpx.AsyncClient, token: str, uid: str
) -> Any | None:
    """现读成长任务全表原始 payload;失败返回 None(fail-closed,不冒充空表)。"""
    try:
        r = await client.get(f"{WEB_BASE}/v2/activity/growth/tasks", headers=_growth_headers(token, uid))
        r.raise_for_status()
    except Exception:  # noqa: BLE001 — 读失败 ⇒ None,由调用方收敛为未判定
        return None
    try:
        return r.json()
    except ValueError:
        return None


def _snapshot_of(payload: Any) -> dict[str, dict[str, Any]] | None:
    """runner 判据口径快照(wda.parse_task_snapshot 形状,供 _progress_advanced)。"""
    return wda.parse_task_snapshot(payload)


def _rows_of(payload: Any) -> dict[str, dict[str, Any]]:
    """计划/领奖口径原始行:{code: {accept_status, current, target}}。

    复用 ``wda._task_rows`` 的多 envelope 取行逻辑(同包单源,不复制判据)。
    """
    rows: dict[str, dict[str, Any]] = {}
    for row in wda._task_rows(payload):
        code = row.get("task_code") or row.get("code")
        if not isinstance(code, str) or not code:
            continue
        prog = row.get("progress")
        current = target = None
        if isinstance(prog, dict):
            current, target = prog.get("current"), prog.get("target")
        elif isinstance(prog, (int, float)) and not isinstance(prog, bool):
            current = prog
        rows[code] = {"accept_status": row.get("accept_status"), "current": current, "target": target}
    return rows


def _num(value: Any) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float, str)):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _target_reached(row: dict[str, Any]) -> bool:
    """达标判定:current/target 均在且 current >= target(取不到 target ⇒ False,不猜)。"""
    cur, tgt = _num(row.get("current")), _num(row.get("target"))
    return cur is not None and tgt is not None and tgt > 0 and cur >= tgt


async def claim_task(
    client: httpx.AsyncClient, token: str, uid: str, task_code: str
) -> dict[str, Any]:
    """领奖(WEB 域端点);返回 {status, credit} 结构化回执,不抛异常。"""
    try:
        r = await client.post(
            f"{WEB_BASE}/activity/growth/tasks/{task_code}/claim", headers=_web_claim_headers(token, uid)
        )
    except Exception as exc:  # noqa: BLE001 — 单条领奖异常不中断整轮
        return {"status": None, "credit": None, "error": str(exc)[:120]}
    try:
        body = r.json()
    except ValueError:
        return {"status": r.status_code, "credit": None}
    data = body.get("data") if isinstance(body, dict) else None
    credit = data.get("credit") if isinstance(data, dict) else None
    return {"status": r.status_code, "credit": credit if isinstance(credit, (int, float)) else None}


async def resolve_expert(
    client: httpx.AsyncClient,
    token: str,
    uid: str,
    entry: dict[str, Any],
) -> dict[str, Any] | None:
    """按市场真实记录解析专家(keyword 优先,回退按 expert_id 全页扫描)。"""
    expert_id = str(entry.get("expert_id") or "")
    keyword = entry.get("market_keyword") or entry.get("display_name_zh")
    if keyword:
        candidates = await wda.fetch_market_experts(
            client, token, uid, keyword=str(keyword), page_size=MARKET_PAGE_SIZE
        )
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


def _prog_of(row: dict[str, Any]) -> str:
    return f"{row.get('current')}/{row.get('target')}"


async def run_autopilot(
    jwt: str,
    device_map: dict[str, Any],
    *,
    dry_run: bool = False,
    claim: bool = True,
    timeout: float = DEFAULT_TIMEOUT,
    client: httpx.AsyncClient | None = None,
    table: dict[str, Any] | None = None,
    desktop_runner: DesktopRunner | None = None,
    generic_runner: GenericRunner | None = None,
) -> dict[str, Any]:
    """全量自动驾驶一轮。返回结构化终态,零异常上抛(单任务失败不中断整轮)。

    desktop_runner / generic_runner 仅供测试注入;缺省分别用
    ``wda.run_desktop_expert_task`` / ``wda.execute_task_code``。
    """
    desktop_runner = desktop_runner or wda.run_desktop_expert_task

    async def _generic(task_code: str, ctx: dict[str, Any], http: httpx.AsyncClient, read_tasks) -> Any:
        if generic_runner is not None:
            return await generic_runner(task_code, ctx, http, read_tasks)
        return await wda.execute_task_code(task_code, ctx, http, read_tasks)

    dm = device_map or {}
    uid = str(dm.get("uid") or "")
    nickname = str(dm.get("nickname") or "user")
    summary: dict[str, Any] = {
        "ok": False,
        "dry_run": dry_run,
        "total_tasks": 0,
        "claimed_already": [],
        "plan": [],
        "executed": [],
        "claimed": [],
        "credits": 0,
        "undone": [],
        "unregistered": [],
        "read_failed": False,
    }
    if not jwt or not uid:
        summary["undone"].append({"code": "__account__", "reason": "missing_credential_or_uid"})
        return summary

    table = table if table is not None else load_raw_action_table()
    own_client = client is None
    try:
        if own_client:
            client = httpx.AsyncClient(timeout=timeout)
            await client.__aenter__()
        assert client is not None
        payload = await _fetch_task_payload(client, jwt, uid)
        if payload is None:
            summary["read_failed"] = True
            summary["undone"].append({"code": "__all__", "reason": "read_tasks_failed"})
            return summary
        rows = _rows_of(payload)
        summary["total_tasks"] = len(rows)

        plan: list[tuple[str, dict[str, Any], str, dict[str, Any]]] = []
        for code in sorted(rows):
            row = rows[code]
            if row.get("accept_status") == "claimed":
                summary["claimed_already"].append(code)
                continue
            route, meta = route_of(code, table)
            if route is None:
                summary["unregistered"].append(code)
                continue
            action = "claim-only" if _target_reached(row) else "run"
            plan.append((code, row, action if action == "claim-only" else route, meta))

        if dry_run:
            summary["plan"] = [
                {"code": c, "route": r, "progress": _prog_of(s)} for c, s, r, _m in plan
            ]
            summary["ok"] = True
            return summary

        for code, _row, route, meta in plan:
            if route == "claim-only":
                if claim:
                    receipt = await claim_task(client, jwt, uid, code)
                    ok_claim = receipt.get("status") == 200
                    if ok_claim:
                        summary["claimed"].append(code)
                        summary["credits"] += int(receipt.get("credit") or 0)
                    else:
                        summary["undone"].append(
                            {"code": code, "reason": "claim-failed", "status": receipt.get("status")}
                        )
                    summary["executed"].append({"code": code, "route": "claim-only", "ok": ok_claim})
                continue
            if route == "desktop":
                expert = await resolve_expert(client, jwt, uid, meta)
                if expert is None:
                    summary["undone"].append({"code": code, "reason": "expert_not_found"})
                    continue

                async def _read_tasks() -> Any:
                    fresh = await _fetch_task_payload(client, jwt, uid)
                    return _snapshot_of(fresh) if fresh is not None else None

                result = await desktop_runner(
                    client, jwt, uid, nickname, expert,
                    read_tasks=_read_tasks,
                    task_code=code,
                )
            else:  # generic
                ctx = wda.build_context(jwt, dm, task_code=code)

                async def _read_tasks() -> Any:
                    fresh = await _fetch_task_payload(client, jwt, uid)
                    return _snapshot_of(fresh) if fresh is not None else None

                result = await _generic(code, ctx, client, _read_tasks)
            ok = bool(result.ok)
            summary["executed"].append(
                {"code": code, "route": route, "ok": ok, "reason": str(result.reason), "error": str(result.error)[:120]}
            )
            if ok and claim:
                # 领奖判定用 runner 回读快照(after 口径) + 计划行 target(current >= target)
                after = (getattr(result, "after", None) or {}).get(code) or {}
                cur_after = _num(after.get("progress_current"))
                tgt_plan = _num(_row.get("target"))
                if cur_after is not None and tgt_plan is not None and tgt_plan > 0 and cur_after >= tgt_plan:
                    receipt = await claim_task(client, jwt, uid, code)
                    if receipt.get("status") == 200:
                        summary["claimed"].append(code)
                        summary["credits"] += int(receipt.get("credit") or 0)
                    else:
                        summary["undone"].append(
                            {"code": code, "reason": "claim-failed", "status": receipt.get("status")}
                        )
        summary["ok"] = not summary["read_failed"] and not any(
            e.get("ok") is False for e in summary["executed"]
        )
        return summary
    except Exception as exc:  # noqa: BLE001 — 整轮兜底:结构化收敛,不抛到调度器
        summary["undone"].append({"code": "__all__", "reason": "exception", "error": str(exc)[:160]})
        return summary
    finally:
        if own_client and client is not None:
            await client.aclose()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
