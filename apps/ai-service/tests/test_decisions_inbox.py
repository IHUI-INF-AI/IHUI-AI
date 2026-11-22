# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D193 决策收件箱(2026-09-30 用户拍板,小切口)路由与访问器测试。

隔离策略(§5b 测试隔离铁律):全部数据源 monkeypatch,不连任何真实库/Redis/LLM ——
工具审批经 `agent_loop_v2.list_pending_approvals` 的替身;引擎待决表经
`monkeypatch.setattr(engine_router, "ENGINE", 假单例)`(test_agent_engine_router.py
同款);身份经 `app.dependency_overrides[get_current_user_id]`。GET 路径零副作用。

覆盖:① 只见自己的待决策(属主过滤 owner_scoped_allows 语义);② 无属主记录对
带身份调用者不可见(fail-closed);③ 摘要合成(工具名 + 参数预览);④ 引擎侧
permissions/elicitation 快照与已结算/形态漂移跳过;⑤ 未鉴权 401(不新增免鉴权面);
⑥ list_pending_approvals 真实现(待决可见 / 已结算隐藏 / 历史二元组跳过)。
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.jwt_auth import get_current_user_id
from app.routers import decisions as decisions_router
from app.routers import engine as engine_router
from app.services import agent_loop_v2 as alv2

# =============================================================================
# fixtures(独立最小 app;身份可变)
# =============================================================================


def _mk_app(uid: str) -> FastAPI:
    app = FastAPI()
    app.include_router(decisions_router.router, prefix="/api")

    async def _fake_current_user_id() -> str:
        return uid

    app.dependency_overrides[get_current_user_id] = _fake_current_user_id
    return app


@pytest.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=_mk_app("alice")), base_url="http://test") as c:
        yield c


def _approval_item(owner: str | None, **overrides: Any) -> dict[str, Any]:
    item = {
        "id": f"appr_{owner or 'anon'}",
        "owner_user_id": owner,
        "thread_id": f"thr_{owner or 'anon'}",
        "tool_name": "run_command",
        "args_preview": '{"cmd": "git push"}',
        "created_at": "2026-09-30T08:00:00Z",
    }
    item.update(overrides)
    return item


# =============================================================================
# GET /api/agent/decisions/pending —— 工具审批来源
# =============================================================================


@pytest.mark.asyncio
async def test_only_own_approvals_visible(client, monkeypatch):
    """属主过滤:alice 只看到自己的待决审批;bob 的与无属主的一律不可见。"""
    monkeypatch.setattr(
        alv2,
        "list_pending_approvals",
        lambda: [
            _approval_item("alice"),
            _approval_item("bob"),
            _approval_item(None),  # 无属主 = 无从对账,对带身份调用者不可见(fail-closed)
        ],
    )
    monkeypatch.setattr(engine_router, "ENGINE", SimpleNamespace())
    res = await client.get("/api/agent/decisions/pending")
    assert res.status_code == 200
    body = res.json()
    assert body["code"] == 0
    assert body["data"]["total"] == 1
    (item,) = body["data"]["items"]
    assert item["id"] == "appr_alice"
    assert item["threadId"] == "thr_alice"
    assert item["type"] == "tool_approval"
    assert item["summary"] == 'run_command: {"cmd": "git push"}'
    assert item["createdAt"] == "2026-09-30T08:00:00Z"


@pytest.mark.asyncio
async def test_summary_falls_back_to_tool_name_only(client, monkeypatch):
    """参数预览缺席时摘要只落工具名;两者都空则为空串(前端落类型标签)。"""
    monkeypatch.setattr(
        alv2,
        "list_pending_approvals",
        lambda: [
            _approval_item("alice", args_preview=None),
            _approval_item("alice", id="appr_empty", tool_name="", args_preview=""),
        ],
    )
    monkeypatch.setattr(engine_router, "ENGINE", SimpleNamespace())
    res = await client.get("/api/agent/decisions/pending")
    items = res.json()["data"]["items"]
    assert [i["summary"] for i in items] == ["run_command", ""]


@pytest.mark.asyncio
async def test_settled_approvals_not_listed(client, monkeypatch):
    """list_pending_approvals 的契约:已结算条目不进快照 ⇒ 端点自然不含(纵深验证)。"""
    monkeypatch.setattr(alv2, "list_pending_approvals", lambda: [])
    monkeypatch.setattr(engine_router, "ENGINE", SimpleNamespace())
    res = await client.get("/api/agent/decisions/pending")
    assert res.json()["data"] == {"items": [], "total": 0}


# =============================================================================
# 引擎侧待决(permissions / elicitation)—— 鸭子读取,取不到即跳过
# =============================================================================


class _FakeFuture:
    def __init__(self, done: bool) -> None:
        self._done = done

    def done(self) -> bool:
        return self._done


def _engine(uid: str | None, thr: str, done: bool = False) -> SimpleNamespace:
    return SimpleNamespace(user_id=uid, thread_id=thr, future=_FakeFuture(done))


@pytest.mark.asyncio
async def test_engine_permissions_and_elicitation_visible(client, monkeypatch):
    """request_permissions / request_user_input 待决记录按带主记录聚合;已结算跳过。"""
    fake_engine = SimpleNamespace(
        _permission_requests={
            "req_mine": _engine("alice", "thr_a"),
            "req_foreign": _engine("bob", "thr_b"),
            "req_settled": _engine("alice", "thr_c", done=True),
        },
        _elicitation_requests={
            "eli_mine": _engine("alice", "thr_a"),
        },
    )
    monkeypatch.setattr(alv2, "list_pending_approvals", lambda: [])
    monkeypatch.setattr(engine_router, "ENGINE", fake_engine)
    res = await client.get("/api/agent/decisions/pending")
    items = res.json()["data"]["items"]
    assert sorted((i["id"], i["type"], i["threadId"]) for i in items) == [
        ("eli_mine", "elicitation", "thr_a"),
        ("req_mine", "permissions", "thr_a"),
    ]
    # 引擎待决记录不带问题文本/时间戳(他人暂存面不可加字段)⇒ 空摘要 + null createdAt
    assert all(i["summary"] == "" and i["createdAt"] is None for i in items)


@pytest.mark.asyncio
async def test_engine_malformed_table_skipped(client, monkeypatch):
    """引擎形态漂了(属性不再是 dict)⇒ 该来源跳过(少显示),端点不炸。"""
    fake_engine = SimpleNamespace(_permission_requests=None, _elicitation_requests="oops")
    monkeypatch.setattr(alv2, "list_pending_approvals", lambda: [])
    monkeypatch.setattr(engine_router, "ENGINE", fake_engine)
    res = await client.get("/api/agent/decisions/pending")
    assert res.status_code == 200
    assert res.json()["data"]["total"] == 0


# =============================================================================
# 鉴权面:不新增免鉴权
# =============================================================================


@pytest.mark.asyncio
async def test_unauthenticated_rejected():
    """无身份请求必须 401:端点身份只从承载层 Depends 进来(§5 纪律)。"""
    app = FastAPI()
    app.include_router(decisions_router.router, prefix="/api")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        res = await c.get("/api/agent/decisions/pending")
    assert res.status_code == 401


# =============================================================================
# list_pending_approvals 真实现(同进程直调;不建线程,零网络)
# =============================================================================


def test_list_pending_approvals_filters_settled_and_legacy():
    """待决 entry 可见;已写决策/事件已置的隐藏;历史二元组(无属主)跳过。"""
    alv2._approval_registry.clear()
    try:
        pending = alv2._ApprovalEntry(
            event=asyncio.Event(),
            decision=None,
            owner_user_id="alice",
            thread_id="thr_a",
            tool_name="run_command",
            args_preview="x",
            created_at="2026-09-30T08:00:00Z",
        )
        settled = alv2._ApprovalEntry(
            event=asyncio.Event(), decision="approve", owner_user_id="alice"
        )
        settled.event.set()
        legacy = (asyncio.Event(), None)  # 兼容形态:无属主无展示字段
        alv2._approval_registry.update(
            {"appr_p": pending, "appr_s": settled, "appr_l": legacy}
        )
        snaps = alv2.list_pending_approvals()
        assert len(snaps) == 1
        assert snaps[0]["id"] == "appr_p"
        assert snaps[0]["owner_user_id"] == "alice"
        assert snaps[0]["tool_name"] == "run_command"
        assert snaps[0]["created_at"] == "2026-09-30T08:00:00Z"
    finally:
        alv2._approval_registry.clear()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
