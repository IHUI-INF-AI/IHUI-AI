# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""WorkBuddy 公众号任务「绑定生效 → 关注满 24h → 自动领奖」离线仿真。

用途:真人微信绑定/关注动作尚未发生时,先把**绑定生效之后**的服务端读数注入
真实引擎 ``workbuddy_autopilot.run_autopilot``,验证整条自动领奖闭环,并给出
全池模拟终态。

纪律(不可放宽):
- 全部出站由 ``httpx.MockTransport`` 拦截,**零真实写请求、零真实凭据**;
- 不伪造 ``wechatOpenId`` / ``mpOpenId``、不上报关注事件、不调用 OneID 绑定端点;
- 仿真改变的是注入的响应体,**不是服务端账号数据**;真机取基线只允许 GET;
- 跑的是生产引擎同一份代码,不是照抄结果的打印脚本。

四阶段状态机(每个未完成账号各跑一遍):
  1. ``current``       未绑定:subscribed=false / 0-1 / pending_platform
  2. ``bound_waiting`` 已绑定但关注未满 24h:subscribed=true / 0-1 / 仍不领奖
  3. ``matured``       关注满 24h:服务端判 completed / 1-1 ⇒ 引擎 claim-only ⇒ +100
  4. ``claimed``       下一轮巡检:全表 claimed ⇒ 幂等,零写、零重复加分
"""

from __future__ import annotations

import copy
from typing import Any

import httpx

from app.services import workbuddy_autopilot as ap

OA_CODE = ap.OA_SUBSCRIBE_TASK_CODE
SIM_TOKEN = "SIM_TOKEN_NO_REAL_CREDENTIAL"
SIM_CREDIT = 100

# 真机 2026-11-11 只读拉到的 18 条非公众号任务码(用于 --offline 内置基线)。
OFFLINE_TASK_CODES = (
    "Buddy_App", "Expert_lighthouse", "Expert_team_use_3", "Library_read",
    "RichMeow_Chat", "WorkBuddy_Valorant", "automation_1", "chat_5",
    "expert_5", "expert_use_bowangwang", "expert_use_douyinyin",
    "expert_use_maidehao", "expert_use_shangjia_xuanchuan", "first_buddy",
    "playbook_prompt", "skill_1", "skill_share", "template_5",
)

PHASE_ORDER = ("current", "bound_waiting", "matured", "claimed")
PHASE_LABELS = {
    "current": "现状(未绑定)",
    "bound_waiting": "已绑定·关注未满24h",
    "matured": "关注满24h·服务端判completed",
    "claimed": "下一轮巡检(幂等)",
}
# 服务端 GET /v2/activity/growth/subscribe-task/status 的判据读数。
PHASE_STATUS: dict[str, dict[str, Any]] = {
    "current": {"subscribed": False, "remaining_seconds": -1, "task_status": "accepted", "advanced": False},
    "bound_waiting": {"subscribed": True, "remaining_seconds": 3600, "task_status": "accepted", "advanced": False},
    "matured": {"subscribed": True, "remaining_seconds": 0, "task_status": "completed", "advanced": True},
    "claimed": {"subscribed": True, "remaining_seconds": 0, "task_status": "completed", "advanced": True},
}
# 同一阶段里任务表公众号行的 (accept_status, progress.current)。
PHASE_ROW: dict[str, tuple[str, int]] = {
    "current": ("accepted", 0),
    "bound_waiting": ("accepted", 0),
    "matured": ("completed", 1),
    "claimed": ("claimed", 1),
}


def _resp(body: dict[str, Any], status: int = 200) -> httpx.Response:
    return httpx.Response(status, json=body)


def build_offline_baseline(
    uid: str, nickname: str, *, oa_claimed: bool = False
) -> dict[str, Any]:
    """构造离线基线(真机任务表形状),供 ``--offline`` 与单测使用。"""
    rows: list[dict[str, Any]] = [
        {
            "task_code": code,
            "accept_status": "claimed",
            "progress": {"current": 1, "target": 1},
            "reward_credit": SIM_CREDIT,
        }
        for code in OFFLINE_TASK_CODES
    ]
    rows.append(
        {
            "task_code": OA_CODE,
            "title": "关注「腾讯 WorkBuddy」官方公众号",
            "accept_status": "claimed" if oa_claimed else "accepted",
            "progress": {"current": 1 if oa_claimed else 0, "target": 1},
            "reward_credit": SIM_CREDIT,
        }
    )
    st = dict(PHASE_STATUS["claimed" if oa_claimed else "current"])
    st["task_code"] = OA_CODE
    return {
        "uid": uid,
        "nickname": nickname,
        "source": "offline",
        "payload": {"code": 0, "msg": "OK", "data": {"tasks": rows}},
        "status": {"code": 0, "msg": "OK", "data": {"subscribe_task": st}},
    }


def _oa_row_of(payload: dict[str, Any]) -> dict[str, Any] | None:
    rows = (payload.get("data") or {}).get("tasks") or []
    if not isinstance(rows, list):
        return None
    return next(
        (r for r in rows if isinstance(r, dict) and (r.get("task_code") or r.get("code")) == OA_CODE),
        None,
    )


class SimulatedGrowthServer:
    """把「微信绑定 + 关注满 24h」之后的服务端读数挂到 MockTransport。"""

    def __init__(self, baseline: dict[str, Any], phase: str):
        if phase not in PHASE_ORDER:
            raise ValueError(f"unknown simulation phase: {phase}")
        self.baseline = baseline
        self.phase = phase
        self.already_done = (_oa_row_of(baseline.get("payload") or {}) or {}).get(
            "accept_status"
        ) == "claimed"
        # 基线里已经 19/19 的账号不伪造「未完成」,任何阶段都保持 claimed。
        self.effective_phase = "claimed" if self.already_done else phase
        self.requests: list[dict[str, str]] = []
        self.credit_granted = 0
        self._claimed = False

    def status_body(self) -> dict[str, Any]:
        st = dict(PHASE_STATUS[self.effective_phase])
        st["task_code"] = OA_CODE
        return {"code": 0, "msg": "OK", "data": {"subscribe_task": st}}

    def tasks_body(self) -> dict[str, Any]:
        payload = copy.deepcopy(self.baseline.get("payload") or {})
        row = _oa_row_of(payload)
        if row is not None:
            status, current = PHASE_ROW[self.effective_phase]
            row["accept_status"] = status
            row["progress"] = {"current": current, "target": 1}
        return payload

    def handler(self, request: httpx.Request) -> httpx.Response:
        path = request.url.path
        self.requests.append({"method": request.method, "path": path})

        if request.method == "GET" and path == ap.SUBSCRIBE_TASK_STATUS_PATH:
            return _resp(self.status_body())
        if request.method == "GET" and path == "/v2/activity/growth/tasks":
            return _resp(self.tasks_body())
        if (
            request.method == "POST"
            and path.startswith("/activity/growth/tasks/")
            and path.endswith("/claim")
        ):
            code = path.split("/")[-2]
            # 与真机一致:未达标 / 重复领奖一律 400,不白送积分。
            if code != OA_CODE or self.effective_phase != "matured" or self._claimed:
                return _resp({"code": 40001, "msg": "task not completed / already_claimed"}, 400)
            self._claimed = True
            self.credit_granted += SIM_CREDIT
            return _resp({"code": 0, "msg": "OK", "data": {"credit": SIM_CREDIT}})
        return _resp({"code": 40401, "msg": "not found"}, 404)

    def client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(transport=httpx.MockTransport(self.handler), timeout=10)


def _stage_of(
    phase: str, server: SimulatedGrowthServer, summary: dict[str, Any]
) -> dict[str, Any]:
    done = len(summary.get("claimed_already") or []) + len(summary.get("claimed") or [])
    writes = [r for r in server.requests if r["method"] != "GET"]
    return {
        "phase": phase,
        "label": PHASE_LABELS[phase],
        "server_status": server.status_body()["data"]["subscribe_task"],
        "subscribe_status": summary.get("subscribe_status"),
        "total_tasks": summary.get("total_tasks"),
        "done": done,
        "claimed": list(summary.get("claimed") or []),
        "credits": summary.get("credits"),
        "pending_platform": list(summary.get("pending_platform") or []),
        "unregistered": list(summary.get("unregistered") or []),
        "engine_ok": summary.get("ok"),
        "read_failed": summary.get("read_failed"),
        "requests": list(server.requests),
        "write_requests": writes,
    }


async def simulate_account(baseline: dict[str, Any]) -> dict[str, Any]:
    """用真实引擎把一个账号从现状跑到模拟完成,返回逐阶段结构化终态。"""
    row = _oa_row_of(baseline.get("payload") or {}) or {}
    already_done = row.get("accept_status") == "claimed"
    phases = ("claimed",) if already_done else PHASE_ORDER
    stages: list[dict[str, Any]] = []
    for phase in phases:
        server = SimulatedGrowthServer(baseline, phase)
        async with server.client() as client:
            # 现状阶段强制 dry_run:连 mock 的写侧都不碰。
            summary = await ap.run_autopilot(
                SIM_TOKEN,
                {"uid": baseline["uid"], "nickname": baseline.get("nickname") or baseline["uid"][:8]},
                table={},
                client=client,
                dry_run=(phase == "current"),
            )
        stages.append(_stage_of(phase, server, summary))
    total = stages[-1]["total_tasks"]
    return {
        "uid": baseline["uid"],
        "nickname": baseline.get("nickname") or baseline["uid"][:8],
        "source": baseline.get("source") or "unknown",
        "already_done": already_done,
        "total_tasks": total,
        "before_done": stages[0]["done"],
        "after_done": stages[-1]["done"],
        "sim_credits": sum(int(s["credits"] or 0) for s in stages),
        "stages": stages,
    }


async def simulate_pool(baselines: list[dict[str, Any]]) -> dict[str, Any]:
    """全池仿真;顺序执行即可,全部请求都在各自 MockTransport 内闭环。"""
    accounts = [await simulate_account(b) for b in baselines]
    all_requests = [r for a in accounts for s in a["stages"] for r in s["requests"]]
    writes = [r for a in accounts for s in a["stages"] for r in s["write_requests"]]
    return {
        "accounts": accounts,
        "totals": {
            "accounts": len(accounts),
            "before_full": sum(1 for a in accounts if a["before_done"] == a["total_tasks"]),
            "after_full": sum(1 for a in accounts if a["after_done"] == a["total_tasks"]),
            "sim_credits": sum(a["sim_credits"] for a in accounts),
            "mock_write_requests": len(writes),  # 全部被 MockTransport 拦下
            "real_write_requests": 0,  # 仿真不触网
            "oneid_or_bind_calls": sum(
                1 for r in all_requests if r["path"].startswith(("/personal_center/", "/authz/"))
            ),
            "claim_paths": sorted({r["path"] for r in writes}),
        },
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
