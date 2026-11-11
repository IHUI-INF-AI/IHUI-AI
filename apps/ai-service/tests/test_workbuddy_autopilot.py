# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""WorkBuddy 全量自动驾驶引擎单测 — 零真实网络、零真实凭据。

被测:app/services/workbuddy_autopilot.py(``route_of`` / ``run_autopilot``)。

口径(2026-11-09 收口,本文件锁行为):
  - 选路单源 = 动作表:verified desktop_expert ⇒ desktop;全 verified http ⇒ generic;
    其余 ⇒ unregistered(零出站,防伪造纪律:裸合成遥测已证伪不计分);
  - ``accept_status == 'claimed'`` 秒跳过,零写侧;
  - 达标未领 ⇒ claim-only;run 成功且回读达标才领奖;
  - dry_run 只出计划,零写侧出站;
  - 读表失败 fail-closed(read_failed=True),不冒充空表;
  - 两口径分离:mock 任务行 = 原始行形状(progress{current,target});
    runner.after = 快照形状(progress_current)。

全部出站由注入 runner / httpx.MockTransport 拦截;凭据一律明显假值。
"""

from __future__ import annotations

from typing import Any

import httpx
import pytest

from app.services import workbuddy_autopilot as ap
from app.services import workbuddy_direct_api as wda

FAKE_TOKEN = "FAKE_TOKEN_AUTOPILOT_0123456789abcdef0123456789"
FAKE_UID = "u-autopilot-001"
FAKE_DM = {"uid": FAKE_UID, "nickname": "自动驾驶测试号"}

DESKTOP_CODE = "expert_use_x"
GENERIC_CODE = "Sequential_Tasks_9"
UNREG_CODE = "chat_5"


def _row(code: str, *, accept: str = "available", cur: Any = 0, tgt: Any = 1) -> dict[str, Any]:
    """原始任务行(计划/领奖口径,带 progress{current,target})。"""
    return {"task_code": code, "accept_status": accept, "progress": {"current": cur, "target": tgt}}


def _after_snap(code: str, *, cur: float, accept: str = "accepted") -> dict[str, dict[str, Any]]:
    """runner 回读快照(wda.parse_task_snapshot 形状,无 target)。"""
    return {
        code: {"progress_current": cur, "accept_status": accept, "status": accept}
    }


def _table_desktop_only() -> dict[str, Any]:
    return {
        DESKTOP_CODE: [
            {"kind": "desktop_expert", "verified": True, "expert_id": "ex_TEST", "market_keyword": "测试"}
        ],
    }


def _table_generic_only() -> dict[str, Any]:
    return {
        GENERIC_CODE: [
            {
                "kind": "http",
                "verified": True,
                "method": "POST",
                "url_template": "https://www.workbuddy.cn/v2/activity/growth/tasks/accept",
                "body_template": {"task_codes": [GENERIC_CODE]},
                "expect": {"ok_status": [200], "sse": False},
            },
            {
                "kind": "http",
                "verified": True,
                "method": "POST",
                "url_template": "https://copilot.tencent.com/v2/report",
                "body_template": [{"eventCode": "expert_actual_use"}],
                "expect": {"ok_status": [200], "sse": False},
            },
        ],
    }


def _table_unverified() -> dict[str, Any]:
    return {
        UNREG_CODE: [
            {"kind": "http", "verified": False, "method": "POST", "url_template": "/v2/report"}
        ],
    }


def _transport_of(*rows: dict[str, Any], claim_credit: int = 100) -> httpx.MockTransport:
    """固定任务表 + 可领奖的 MockTransport(写侧只允许 /claim)。"""

    def transport(req: httpx.Request) -> httpx.Response:
        if req.url.path.endswith("/subscribe-task/status"):
            return httpx.Response(
                200,
                json={"code": 0, "data": {"subscribe_task": {
                    "task_code": ap.OA_SUBSCRIBE_TASK_CODE,
                    "subscribed": False, "remaining_seconds": -1,
                    "task_status": "accepted", "advanced": False,
                }}},
            )
        if req.url.path.endswith("/growth/tasks"):
            return httpx.Response(
                200,
                json={"code": 0, "data": {"tasks": list(rows)}},
                request=httpx.Request("GET", f"{ap.WEB_BASE}/v2/activity/growth/tasks"),
            )
        if req.url.path.endswith("/claim"):
            return httpx.Response(200, json={"code": 0, "data": {"credit": claim_credit}})
        raise AssertionError(f"意外出站:{req.method} {req.url}")

    return httpx.MockTransport(transport)


# ---------------------------------------------------------------------------
# route_of 纯函数
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("table", "code", "expect_route"),
    [
        (_table_desktop_only(), DESKTOP_CODE, "desktop"),
        (_table_generic_only(), GENERIC_CODE, "generic"),
        (_table_unverified(), UNREG_CODE, None),
        (_table_desktop_only(), "unknown_code", None),
    ],
)
def test_route_of(table: dict[str, Any], code: str, expect_route: str | None) -> None:
    route, meta = ap.route_of(code, table)
    assert route == expect_route
    if expect_route == "desktop":
        assert meta.get("expert_id") == "ex_TEST"


# ---------------------------------------------------------------------------
# claimed 秒跳过(零写侧、零 runner 触达)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_all_claimed_is_readonly_skip() -> None:
    async def desktop_runner(*a: Any, **k: Any) -> Any:
        raise AssertionError("全 claimed 时不得触达 desktop 链")

    async with httpx.AsyncClient(
        transport=_transport_of(_row(DESKTOP_CODE, accept="claimed"))
    ) as client:
        summary = await ap.run_autopilot(
            FAKE_TOKEN, FAKE_DM, table=_table_desktop_only(),
            desktop_runner=desktop_runner, client=client,
        )
    assert summary["ok"] is True
    assert summary["claimed_already"] == [DESKTOP_CODE]
    assert summary["executed"] == []
    assert summary["plan"] == []


# ---------------------------------------------------------------------------
# dry-run:零写侧出站
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_dry_run_zero_writes() -> None:
    """dry_run ⇒ 只出计划;任何写侧方法(POST)零调用。"""

    async def desktop_runner(*a: Any, **k: Any) -> Any:
        raise AssertionError("dry-run 不得执行 desktop 链")

    def transport(req: httpx.Request) -> httpx.Response:
        assert req.method == "GET", f"dry-run 只允许读:{req.method} {req.url}"
        return httpx.Response(
            200,
            json={"code": 0, "data": {"tasks": [_row(DESKTOP_CODE)]}},
            request=httpx.Request("GET", f"{ap.WEB_BASE}/v2/activity/growth/tasks"),
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(transport)) as client:
        summary = await ap.run_autopilot(
            FAKE_TOKEN, FAKE_DM, dry_run=True, table=_table_desktop_only(),
            desktop_runner=desktop_runner, client=client,
        )
    assert summary["ok"] is True
    assert summary["plan"] == [
        {"code": DESKTOP_CODE, "route": "desktop", "progress": "0/1"}
    ]


# ---------------------------------------------------------------------------
# generic 链(Sequential 族):执行 + 回读达标才领奖
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_generic_route_executes_and_claims() -> None:
    seen: list[str] = []

    async def generic_runner(task_code, ctx, http, read_tasks, **k: Any) -> wda.DirectApiResult:
        seen.append(task_code)
        return wda.DirectApiResult(
            ok=True, reason=wda.REASON_OK, task_code=task_code,
            after=_after_snap(task_code, cur=1.0),
        )

    async with httpx.AsyncClient(
        transport=_transport_of(_row(GENERIC_CODE), claim_credit=200)
    ) as client:
        summary = await ap.run_autopilot(
            FAKE_TOKEN, FAKE_DM, table=_table_generic_only(),
            generic_runner=generic_runner, client=client,
        )
    assert seen == [GENERIC_CODE]
    assert summary["executed"][0]["ok"] is True
    assert summary["claimed"] == [GENERIC_CODE]
    assert summary["credits"] == 200


@pytest.mark.asyncio
async def test_generic_route_no_advance_no_claim() -> None:
    """runner 回读无前进(ok=False)⇒ 不领奖、不冒红计入 executed。"""

    async def generic_runner(task_code, ctx, http, read_tasks, **k: Any) -> wda.DirectApiResult:
        return wda.DirectApiResult(
            ok=False, reason=wda.REASON_NO_PROGRESS_ADVANCE, task_code=task_code,
            after=_after_snap(task_code, cur=0.0),
        )

    async with httpx.AsyncClient(
        transport=_transport_of(_row(GENERIC_CODE))
    ) as client:
        summary = await ap.run_autopilot(
            FAKE_TOKEN, FAKE_DM, table=_table_generic_only(),
            generic_runner=generic_runner, client=client,
        )
    assert summary["ok"] is False
    assert summary["claimed"] == []
    assert summary["executed"][0]["ok"] is False


# ---------------------------------------------------------------------------
# 达标未领 ⇒ claim-only
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_target_reached_claim_only() -> None:
    async def desktop_runner(*a: Any, **k: Any) -> Any:
        raise AssertionError("达标待领奖不应再跑执行链")

    async with httpx.AsyncClient(
        transport=_transport_of(_row(DESKTOP_CODE, cur=1, tgt=1), claim_credit=100)
    ) as client:
        summary = await ap.run_autopilot(
            FAKE_TOKEN, FAKE_DM, table=_table_desktop_only(),
            desktop_runner=desktop_runner, client=client,
        )
    assert summary["executed"] == [{"code": DESKTOP_CODE, "route": "claim-only", "ok": True}]
    assert summary["claimed"] == [DESKTOP_CODE]
    assert summary["credits"] == 100


# ---------------------------------------------------------------------------
# unregistered:零出站只登记(防伪造纪律)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_unregistered_code_zero_outbound() -> None:
    async def desktop_runner(*a: Any, **k: Any) -> Any:
        raise AssertionError("无 verified 链不得触达 desktop 链")

    def transport(req: httpx.Request) -> httpx.Response:
        assert req.method == "GET", f"unregistered 码不得产生写侧:{req.method} {req.url}"
        return httpx.Response(
            200,
            json={"code": 0, "data": {"tasks": [_row(UNREG_CODE, cur=0, tgt=5)]}},
            request=httpx.Request("GET", f"{ap.WEB_BASE}/v2/activity/growth/tasks"),
        )

    async with httpx.AsyncClient(transport=httpx.MockTransport(transport)) as client:
        summary = await ap.run_autopilot(
            FAKE_TOKEN, FAKE_DM, table=_table_unverified(),
            desktop_runner=desktop_runner, client=client,
        )
    assert summary["unregistered"] == [UNREG_CODE]
    assert summary["executed"] == []


# ---------------------------------------------------------------------------
# 读表失败 fail-closed / 缺凭据 fail-closed
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_read_tasks_failed_is_fail_closed() -> None:
    def transport(req: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="boom")

    async with httpx.AsyncClient(transport=httpx.MockTransport(transport)) as client:
        summary = await ap.run_autopilot(
            FAKE_TOKEN, FAKE_DM, table=_table_desktop_only(), client=client,
        )
    assert summary["read_failed"] is True
    assert summary["ok"] is False


@pytest.mark.asyncio
async def test_missing_uid_is_fail_closed() -> None:
    summary = await ap.run_autopilot(FAKE_TOKEN, {}, table=_table_desktop_only())
    assert summary["ok"] is False
    assert summary["undone"][0]["reason"] == "missing_credential_or_uid"


# ---------------------------------------------------------------------------
# 真动作表冒烟:Sequential 族全部可 generic 路由 + desktop 码可 desktop 路由
# ---------------------------------------------------------------------------


def test_real_action_table_sequential_routes() -> None:
    table = ap.load_raw_action_table()
    for i in range(1, 8):
        route, _meta = ap.route_of(f"Sequential_Tasks_{i}", table)
        assert route == "generic", f"Sequential_Tasks_{i} 应为 generic 直连链"


def test_real_action_table_desktop_routes() -> None:
    table = ap.load_raw_action_table()
    desktop_codes = [
        code for code, steps in table.items()
        if isinstance(steps, list)
        and any(isinstance(s, dict) and s.get("kind") == "desktop_expert" for s in steps)
    ]
    assert desktop_codes, "动作表应含 desktop_expert 条目"
    for code in desktop_codes:
        route, meta = ap.route_of(code, table)
        assert route == "desktop"
        assert meta.get("expert_id"), f"{code} 缺 expert_id"


def test_share_chain_route_and_event_catalog():
    """平台新上的 skill_share 必须已接线:选路 + 事件族与客户端取证一致。"""
    table = ap.load_raw_action_table()
    route, meta = ap.route_of("skill_share", table)
    assert route == "share_chain"
    assert "skill_share_conversion" in meta["event_codes"]
    events = wda.build_share_events(meta["event_codes"])
    assert len(events) == 7
    assert all(isinstance(e.get("eventCode"), str) and e["eventCode"] for e in events)


@pytest.mark.asyncio
async def test_autopilot_dry_run_plans_share_chain(monkeypatch):
    """引擎接线:未领的 skill_share 必须进 plan 且选路 share_chain(不落 unregistered)。"""
    payload = {
        "code": 0,
        "data": {
            "tasks": [
                {
                    "task_code": "skill_share",
                    "accept_status": "accepted",
                    "progress": {"current": 0, "target": 1},
                }
            ]
        },
    }

    async def fake_fetch(client, jwt, uid):
        return payload

    monkeypatch.setattr(ap, "_fetch_task_payload", fake_fetch)
    summary = await ap.run_autopilot(FAKE_TOKEN, FAKE_DM, dry_run=True)
    assert any(
        p["code"] == "skill_share" and p["route"] == "share_chain"
        for p in summary["plan"]
    )
    assert "skill_share" not in summary["unregistered"]


@pytest.mark.asyncio
async def test_run_share_task_acceptance_200_without_progress_is_not_ok():
    """受理回执不构成成功:任务行零前进 ⇒ ok=False(防伪造纪律)。"""
    payload = {
        "data": {
            "tasks": [
                {
                    "task_code": "skill_share",
                    "accept_status": "accepted",
                    "progress": {"current": 0, "target": 1},
                }
            ]
        }
    }
    transport = httpx.MockTransport(
        lambda req: httpx.Response(200, json={"code": 0, "msg": "OK"})
    )

    async def read_tasks():
        return payload

    async with httpx.AsyncClient(transport=transport) as c:
        result = await wda.run_share_task(
            c, FAKE_TOKEN, FAKE_UID, "测试号", "skill_share", read_tasks
        )
    assert result.ok is False
    assert result.reason == wda.REASON_NO_PROGRESS_ADVANCE


@pytest.mark.asyncio
async def test_run_share_task_progress_advance_is_ok():
    """回读 progress 真前进 ⇒ ok=True,并带 after 供上层领奖。"""
    calls = {"n": 0}

    def payload(current):
        return {
            "data": {
                "tasks": [
                    {
                        "task_code": "skill_share",
                        "accept_status": "completed" if current else "accepted",
                        "progress": {"current": current, "target": 1},
                    }
                ]
            }
        }

    async def read_tasks():
        calls["n"] += 1
        return payload(1 if calls["n"] > 1 else 0)

    transport = httpx.MockTransport(
        lambda req: httpx.Response(200, json={"code": 0, "msg": "OK"})
    )
    async with httpx.AsyncClient(transport=transport) as c:
        result = await wda.run_share_task(
            c, FAKE_TOKEN, FAKE_UID, "测试号", "skill_share", read_tasks
        )
    assert result.ok is True
    assert result.reason == wda.REASON_OK
    assert (result.after or {}).get("skill_share", {}).get("progress_current") == 1


# ---------------------------------------------------------------------------
# 公众号关注项:官方 qa() 刷新时序 + 平台侧判据归类(2026-11-11 取证)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_subscribe_status_is_refreshed_before_task_list() -> None:
    """官方 to() 时序:先 GET subscribe-task/status 让服务端重算,再 GET 任务表。

    只读、幂等;顺序反了会拿旧判定,公众号项可能永远等不到翻面。
    """
    order: list[str] = []

    def transport(req: httpx.Request) -> httpx.Response:
        assert req.method == "GET", "订阅刷新只能是读侧"
        order.append(req.url.path)
        if req.url.path.endswith("/subscribe-task/status"):
            return httpx.Response(
                200,
                json={"code": 0, "data": {"subscribe_task": {
                    "subscribed": False, "task_status": "accepted",
                }}},
            )
        return httpx.Response(200, json={"code": 0, "data": {"tasks": []}})

    async with httpx.AsyncClient(transport=httpx.MockTransport(transport)) as client:
        summary = await ap.run_autopilot(
            FAKE_TOKEN, FAKE_DM, dry_run=True, table={}, client=client
        )
    assert len(order) == 2
    assert order[0].endswith("/subscribe-task/status")
    assert order[1].endswith("/growth/tasks")
    assert summary["subscribe_status_refreshed"] is True


@pytest.mark.asyncio
async def test_oa_pending_is_platform_condition_not_unregistered() -> None:
    """accepted/0-1 的公众号项判据在微信身份 ⇒ 记 pending_platform,不冒充引擎未接线。"""
    async with httpx.AsyncClient(
        transport=_transport_of(
            _row(ap.OA_SUBSCRIBE_TASK_CODE, accept="accepted", cur=0, tgt=1)
        )
    ) as client:
        summary = await ap.run_autopilot(
            FAKE_TOKEN, FAKE_DM, dry_run=True, table={}, client=client
        )
    assert summary["unregistered"] == []
    assert [r["code"] for r in summary["pending_platform"]] == [ap.OA_SUBSCRIBE_TASK_CODE]
    assert summary["pending_platform"][0]["reason"] == "wechat_oa_follow_relation"


@pytest.mark.asyncio
async def test_oa_completed_is_claimed_automatically() -> None:
    """服务端一旦判完成 ⇒ claim-only 自动领奖,绑定/关注生效后零人工收口。"""
    async with httpx.AsyncClient(
        transport=_transport_of(
            _row(ap.OA_SUBSCRIBE_TASK_CODE, accept="completed", cur=1, tgt=1),
            claim_credit=100,
        )
    ) as client:
        summary = await ap.run_autopilot(FAKE_TOKEN, FAKE_DM, table={}, client=client)
    assert summary["claimed"] == [ap.OA_SUBSCRIBE_TASK_CODE]
    assert summary["credits"] == 100
    assert summary["unregistered"] == []


@pytest.mark.asyncio
async def test_subscribe_status_reading_keeps_full_server_verdict() -> None:
    """状态端点不能只判 HTTP 200:服务端四个判据读数要完整留档。

    公众号项卡住时要能区分「没绑微信 openid」和「已关注但 24h 窗没走完」,
    task_status / advanced 丢了就只剩一个布尔,诊断退化成猜。
    """
    def transport(req: httpx.Request) -> httpx.Response:
        if req.url.path.endswith("/subscribe-task/status"):
            return httpx.Response(
                200,
                json={"code": 0, "data": {"subscribe_task": {
                    "task_code": ap.OA_SUBSCRIBE_TASK_CODE,
                    "subscribed": False,
                    "remaining_seconds": -1,
                    "task_status": "accepted",
                    "advanced": False,
                }}},
            )
        return httpx.Response(200, json={"code": 0, "data": {"tasks": []}})

    async with httpx.AsyncClient(transport=httpx.MockTransport(transport)) as client:
        summary = await ap.run_autopilot(
            FAKE_TOKEN, FAKE_DM, dry_run=True, table={}, client=client
        )
    st = summary["subscribe_status"]
    assert st["http_ok"] is True
    assert st["subscribed"] is False
    assert st["remaining_seconds"] == -1
    assert st["task_status"] == "accepted"
    assert st["advanced"] is False
    assert summary["subscribe_status_refreshed"] is True


@pytest.mark.asyncio
async def test_subscribe_status_read_failure_is_fail_soft() -> None:
    """刷新失败只少一次重算,不能把全表判成读失败、更不能中断整轮。"""
    def transport(req: httpx.Request) -> httpx.Response:
        if req.url.path.endswith("/subscribe-task/status"):
            return httpx.Response(503, json={"code": 503})
        return httpx.Response(200, json={"code": 0, "data": {"tasks": []}})

    async with httpx.AsyncClient(transport=httpx.MockTransport(transport)) as client:
        summary = await ap.run_autopilot(
            FAKE_TOKEN, FAKE_DM, dry_run=True, table={}, client=client
        )
    assert summary["subscribe_status"] is None
    assert summary["subscribe_status_refreshed"] is False
    assert summary["read_failed"] is False


def test_oa_bind_params_match_official_oneid_chain() -> None:
    """绑定链参数取自现网 usercenter bundle,不许凭印象改 scene / 域名。"""
    assert ap.oa_bind_initiate_url() == (
        "https://api.account.tencent.com/personal_center/v1/credential/wechat/initiate"
    )
    assert ap.oa_bind_initiate_params("https://www.workbuddy.cn/account-settings") == {
        "scene": "BIND_WECHAT",
        "action": "bind",
        "callback_uri": "https://www.workbuddy.cn/account-settings",
        "extra_param": "",
    }
    assert ap.oa_bind_initiate_params("x", action="rebind")["scene"] == "REBIND_WECHAT"
    assert ap.oa_bind_initiate_params("x", action="unbind")["scene"] == "UNBIND_WECHAT"
    assert ap.oa_bind_callback_params("CODE", "STATE") == {"code": "CODE", "state": "STATE"}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
