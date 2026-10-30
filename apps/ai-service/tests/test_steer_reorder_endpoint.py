# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""差距③遗留最后一项(2026-10-30):steer 队列重排端点测试(Qoder mutateQueue 语义)。

判据:
① order 精确覆盖未消费条目 ⇒ 重排生效,回报 {ok, queued, orderApplied};
② 多/少/未知 id/重复 ⇒ 422,队列原样不动(不猜);
③ 竞态豁免:order 含已被 drain 的条目(凭 _steer_consumed_at 留痕)⇒ 该条目出校验,
   只重排未消费条目,orderApplied 回报实际生效结果;
④ 闸门抄 withdraw:session 不在册 ⇒ 404;order 缺失/非字符串数组 ⇒ 422。
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
    session_id = f"r-{uuid.uuid4()}"
    llm._steer_sessions[session_id] = []
    try:
        yield session_id
    finally:
        llm._steer_sessions.pop(session_id, None)
        llm._steer_consumed_at.pop(session_id, None)


class TestReorderEndpoint:
    async def test_exact_cover_reorders_queue(self, client: AsyncClient, steer_session):
        llm._steer_sessions[steer_session] = [
            {"text": "a", "queuedAt": "q1", "kind": "guide"},
            {"text": "b", "queuedAt": "q2", "kind": "guide"},
            {"text": "c", "queuedAt": "q3", "kind": "control"},
        ]
        r = await client.post(
            f"{BASE}/{steer_session}/steer/reorder",
            json={"order": ["q3", "q1", "q2"]},
        )
        assert r.status_code == 200
        assert r.json() == {"ok": True, "queued": 3, "orderApplied": ["q3", "q1", "q2"]}
        assert [i["queuedAt"] for i in llm._steer_sessions[steer_session]] == [
            "q3",
            "q1",
            "q2",
        ]
        # 重排只动位置,条目本体(含 kind/text)随条目一起走
        assert llm._steer_sessions[steer_session][0]["kind"] == "control"

    async def test_missing_or_extra_or_unknown_or_duplicate_is_422(
        self, client: AsyncClient, steer_session
    ):
        original = [
            {"text": "a", "queuedAt": "q1", "kind": "guide"},
            {"text": "b", "queuedAt": "q2", "kind": "guide"},
        ]
        llm._steer_sessions[steer_session] = [dict(i) for i in original]
        for bad in (["q1"], ["q1", "q2", "q9"], ["q1", "q1"], ["q2"]):
            r = await client.post(
                f"{BASE}/{steer_session}/steer/reorder", json={"order": bad}
            )
            assert r.status_code == 422, bad
            assert r.json() == {
                "ok": False,
                "error": "order must exactly cover all pending queue entries",
            }
        # 422 各次都不动队列(不猜、不部分生效)
        assert [i["queuedAt"] for i in llm._steer_sessions[steer_session]] == ["q1", "q2"]

    async def test_race_exemption_skips_drained_entries(
        self, client: AsyncClient, steer_session
    ):
        """客户端视图滞后:q1 已被 drain 注入,order 仍带着它 ⇒ 豁免出校验,
        只重排未消费条目,orderApplied 回报实际生效结果。"""
        llm._steer_sessions[steer_session] = [
            {"text": "q1", "queuedAt": "q1", "kind": "guide"},
            {"text": "q2", "queuedAt": "q2", "kind": "control"},  # 吸收在它面前停
            {"text": "q3", "queuedAt": "q3", "kind": "guide"},
        ]
        consumed = llm._drain_inlineable_steers(steer_session)
        assert [i["queuedAt"] for i in consumed] == ["q1"]
        r = await client.post(
            f"{BASE}/{steer_session}/steer/reorder",
            json={"order": ["q1", "q3", "q2"]},
        )
        assert r.status_code == 200
        assert r.json() == {"ok": True, "queued": 2, "orderApplied": ["q3", "q2"]}
        assert [i["queuedAt"] for i in llm._steer_sessions[steer_session]] == ["q3", "q2"]

    async def test_all_entries_drained_order_fully_exempted(
        self, client: AsyncClient, steer_session
    ):
        llm._steer_sessions[steer_session] = [{"text": "q1", "queuedAt": "q1", "kind": "guide"}]
        assert llm._drain_inlineable_steers(steer_session)
        r = await client.post(
            f"{BASE}/{steer_session}/steer/reorder", json={"order": ["q1"]}
        )
        assert r.status_code == 200
        assert r.json() == {"ok": True, "queued": 0, "orderApplied": []}

    async def test_unknown_session_is_404(self, client: AsyncClient):
        r = await client.post(
            f"{BASE}/sess-does-not-exist-{uuid.uuid4()}/steer/reorder",
            json={"order": ["q1"]},
        )
        assert r.status_code == 404
        assert r.json() == {"ok": False, "error": "session not found or expired"}

    async def test_bad_order_shape_is_422(self, client: AsyncClient, steer_session):
        for bad_body in ({}, {"order": "q1"}, {"order": [123]}, {"order": ["  "]}):
            r = await client.post(
                f"{BASE}/{steer_session}/steer/reorder", json=bad_body
            )
            assert r.status_code == 422, bad_body
            assert r.json() == {
                "ok": False,
                "error": "order must be a list of queuedAt strings",
            }

    async def test_empty_queue_empty_order_is_noop_ok(
        self, client: AsyncClient, steer_session
    ):
        r = await client.post(f"{BASE}/{steer_session}/steer/reorder", json={"order": []})
        assert r.status_code == 200
        assert r.json() == {"ok": True, "queued": 0, "orderApplied": []}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
