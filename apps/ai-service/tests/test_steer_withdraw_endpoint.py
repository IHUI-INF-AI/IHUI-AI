# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""差距③(2026-10-30):steer 撤回端点三态测试。

判据:
① queuedAt 命中未消费条目 ⇒ withdrawn 且条目出队;
② 竞态不猜:条目已被 drain 注入 ⇒ already_injected(凭 _steer_consumed_at 留痕);
③ 未命中 ⇒ not_found(不冒充撤回成功);session 不在册 ⇒ 404(与 post_steer 闸门同语义);
   queuedAt 缺失/空 ⇒ 422。
④ drain 登记与收口清理的账本闭环。
"""

from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient

from app.routers import llm

BASE = "/api/llm/complete/stream"


@pytest.fixture
def steer_session():
    """建一个在册 session,用完即清(不污染进程级注册表)。"""
    session_id = f"w-{uuid.uuid4()}"
    llm._steer_sessions[session_id] = []
    try:
        yield session_id
    finally:
        llm._steer_sessions.pop(session_id, None)
        llm._steer_consumed_at.pop(session_id, None)


class TestWithdrawEndpoint:
    async def test_withdraw_removes_unconsumed_item(self, client: AsyncClient, steer_session):
        llm._steer_sessions[steer_session] = [
            {"text": "先别动那个文件", "queuedAt": "2026-10-30T08:00:00+00:00", "kind": "guide"},
            {"text": "换第二个方案", "queuedAt": "2026-10-30T08:00:01+00:00", "kind": "guide"},
        ]
        r = await client.post(
            f"{BASE}/{steer_session}/steer/withdraw",
            json={"queuedAt": "2026-10-30T08:00:00+00:00"},
        )
        assert r.status_code == 200
        assert r.json() == {"ok": True, "status": "withdrawn"}
        assert [i["queuedAt"] for i in llm._steer_sessions[steer_session]] == [
            "2026-10-30T08:00:01+00:00"
        ]

    async def test_already_injected_after_drain(self, client: AsyncClient, steer_session):
        llm._steer_sessions[steer_session] = [
            {"text": "已被吸收", "queuedAt": "q1", "kind": "guide"}
        ]
        consumed = llm._drain_inlineable_steers(steer_session)
        assert len(consumed) == 1
        r = await client.post(
            f"{BASE}/{steer_session}/steer/withdraw", json={"queuedAt": "q1"}
        )
        assert r.status_code == 200
        assert r.json() == {"ok": True, "status": "already_injected"}

    async def test_not_found_does_not_claim_success(self, client: AsyncClient, steer_session):
        r = await client.post(
            f"{BASE}/{steer_session}/steer/withdraw", json={"queuedAt": "从没入队过"}
        )
        assert r.status_code == 200
        assert r.json() == {"ok": True, "status": "not_found"}

    async def test_unknown_session_is_404(self, client: AsyncClient):
        r = await client.post(
            f"{BASE}/sess-does-not-exist-{uuid.uuid4()}/steer/withdraw",
            json={"queuedAt": "q1"},
        )
        assert r.status_code == 404
        assert r.json() == {"ok": False, "error": "session not found or expired"}

    async def test_missing_queued_at_is_422(self, client: AsyncClient, steer_session):
        r = await client.post(f"{BASE}/{steer_session}/steer/withdraw", json={})
        assert r.status_code == 422
        assert r.json() == {"ok": False, "error": "queuedAt required"}
        r2 = await client.post(
            f"{BASE}/{steer_session}/steer/withdraw", json={"queuedAt": "  "}
        )
        assert r2.status_code == 422


class TestDrainLedger:
    def test_drain_registers_consumed_queued_at(self):
        session_id = f"ledger-{uuid.uuid4()}"
        llm._steer_sessions[session_id] = [
            {"text": "a", "queuedAt": "q1", "kind": "guide"},
            {"text": "b", "queuedAt": "q2", "kind": "guide"},
            {"text": "c", "queuedAt": "q3", "kind": "control"},
        ]
        try:
            consumed = llm._drain_inlineable_steers(session_id)
            assert [i["queuedAt"] for i in consumed] == ["q1", "q2"]
            assert llm._steer_consumed_at[session_id] == {"q1", "q2"}
            # control 条目及其后的都留在队列,不算已消费
            assert llm._steer_sessions[session_id][0]["queuedAt"] == "q3"
            assert "q3" not in llm._steer_consumed_at[session_id]
        finally:
            llm._steer_sessions.pop(session_id, None)
            llm._steer_consumed_at.pop(session_id, None)

    def test_report_dropped_clears_whole_bucket(self):
        session_id = f"drop-{uuid.uuid4()}"
        llm._steer_sessions[session_id] = [{"text": "c", "queuedAt": "q3", "kind": "control"}]
        llm._steer_consumed_at[session_id] = {"q1"}
        frames = llm._report_dropped_steers(session_id)
        assert [f["phase"] for f in frames] == ["dropped"]
        assert session_id not in llm._steer_sessions
        assert session_id not in llm._steer_consumed_at
