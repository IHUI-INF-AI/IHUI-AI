"""AIS-041 回归:流会话 steer / withdraw / reorder / tool-result 的属主闸门。

修前这四个端点只按 session_id 取进程级全局 dict,完全不看调用主体 —— 知道或猜到
session_id 的任意登录用户都能:① 往他人流里注入引导文本;② 撤回他人尚未注入的
引导;③ 重排他人队列;④ 伪造工具执行结果唤醒他人 tool loop。

本文件钉住的判据:
- 属主由**注册时**落下的主体决定(steer 走 `_steer_session_owners`,delegate 走
  entry 内的 `owner_user_id`),端点侧只从承载层取调用方(`_resolve_owner_uuid`);
- 属主不匹配与"会话不存在"回**逐字节同一**回包,端点不能当存在性探针;
- 拒绝路径**零副作用**:不入队、不出队、不重排、不写结果、不置 Event;
- 旧条目无属主时 fail-closed:调用方带主体即拒绝,不把"无主"解释成"公共"。
"""

from __future__ import annotations

import asyncio
import inspect
import uuid

import pytest
from httpx import AsyncClient

from app.routers import llm

BASE = "/api/llm/complete/stream"
OWNER = "11111111-1111-1111-1111-111111111111"
STRANGER = "22222222-2222-2222-2222-222222222222"


@pytest.fixture
def owner_headers():
    """以已验签主体身份发请求。

    JWT 中间件在"Bearer 存在但密钥为空/auth 关闭"的测试态下不走验签路径,因此这里用
    测试专用头 + 下方 middleware 把主体写进 `request.state.user_id`(与生产同一来源,
    只是本文件不测验签本身)。
    """
    return {"x-test-owner": OWNER}


@pytest.fixture(autouse=True)
def _clean_registries():
    """进程级注册表逐例清理,防跨用例污染。"""
    for bucket in (
        llm._steer_sessions,
        llm._steer_consumed_at,
        llm._steer_session_owners,
        llm._delegate_sessions,
    ):
        bucket.clear()
    yield
    for bucket in (
        llm._steer_sessions,
        llm._steer_consumed_at,
        llm._steer_session_owners,
        llm._delegate_sessions,
    ):
        bucket.clear()


@pytest.fixture
def owned_session():
    """注册一条属主为 OWNER 的 steer 会话。"""
    sid = f"s-{uuid.uuid4()}"
    llm._steer_sessions[sid] = []
    llm._steer_session_owners[sid] = OWNER
    return sid


def _as(monkeypatch: pytest.MonkeyPatch, user_id: str | None) -> None:
    """把"承载层主体"钉成指定值(等价于生产里 JWT 中间件注入的那一格)。

    直接改 `_resolve_owner_uuid` 的输入来源是刻意的:被测的是**端点闸门**,不是验签。
    """
    original = llm._resolve_owner_uuid

    def _resolve(request):  # noqa: ANN001 - 与生产同签名
        del request
        return user_id

    monkeypatch.setattr(llm, "_resolve_owner_uuid", _resolve)
    assert original is not _resolve


class TestSteerOwnerGate:
    async def test_stranger_cannot_steer_into_other_stream(
        self, client: AsyncClient, owned_session, monkeypatch
    ):
        """越权注入:404(与不存在同形),且队列零变化。"""
        _as(monkeypatch, STRANGER)
        resp = await client.post(f"{BASE}/{owned_session}/steer", json={"text": "帮我删库"})
        assert resp.status_code == 404
        assert resp.json() == {"ok": False, "error": "session not found or expired"}
        assert llm._steer_sessions[owned_session] == []

    async def test_owner_can_steer(self, client: AsyncClient, owned_session, monkeypatch):
        _as(monkeypatch, OWNER)
        resp = await client.post(f"{BASE}/{owned_session}/steer", json={"text": "换个思路"})
        assert resp.status_code == 200
        assert resp.json()["queued"] == 1
        assert llm._steer_sessions[owned_session][0]["text"] == "换个思路"

    async def test_legacy_session_without_owner_fails_closed(
        self, client: AsyncClient, monkeypatch
    ):
        """旧会话没落属主:调用方带主体即拒绝,不把无主当公共。"""
        sid = f"legacy-{uuid.uuid4()}"
        llm._steer_sessions[sid] = []
        _as(monkeypatch, OWNER)
        resp = await client.post(f"{BASE}/{sid}/steer", json={"text": "注入"})
        assert resp.status_code == 404
        assert llm._steer_sessions[sid] == []

    async def test_mismatch_and_unknown_are_indistinguishable(
        self, client: AsyncClient, owned_session, monkeypatch
    ):
        """存在但非属主 vs 根本不存在 ⇒ 状态码与响应体逐字节相同。"""
        _as(monkeypatch, STRANGER)
        mismatch = await client.post(f"{BASE}/{owned_session}/steer", json={"text": "x"})
        unknown = await client.post(f"{BASE}/no-such-{uuid.uuid4()}/steer", json={"text": "x"})
        assert mismatch.status_code == unknown.status_code == 404
        assert mismatch.json() == unknown.json()


class TestWithdrawOwnerGate:
    async def test_stranger_cannot_withdraw(self, client: AsyncClient, owned_session, monkeypatch):
        """知道 queuedAt 也不能撤回他人引导:404 + 条目仍在。"""
        llm._steer_sessions[owned_session] = [{"text": "保留", "queuedAt": "q1", "kind": "guide"}]
        _as(monkeypatch, STRANGER)
        resp = await client.post(f"{BASE}/{owned_session}/steer/withdraw", json={"queuedAt": "q1"})
        assert resp.status_code == 404
        assert [i["queuedAt"] for i in llm._steer_sessions[owned_session]] == ["q1"]

    async def test_owner_can_withdraw(self, client: AsyncClient, owned_session, monkeypatch):
        llm._steer_sessions[owned_session] = [{"text": "撤回我", "queuedAt": "q1", "kind": "guide"}]
        _as(monkeypatch, OWNER)
        resp = await client.post(f"{BASE}/{owned_session}/steer/withdraw", json={"queuedAt": "q1"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "withdrawn"
        assert llm._steer_sessions[owned_session] == []


class TestReorderOwnerGate:
    async def test_stranger_cannot_reorder(self, client: AsyncClient, owned_session, monkeypatch):
        """越权重排:404,且队列顺序零变化。"""
        llm._steer_sessions[owned_session] = [
            {"text": "a", "queuedAt": "q1", "kind": "guide"},
            {"text": "b", "queuedAt": "q2", "kind": "guide"},
        ]
        _as(monkeypatch, STRANGER)
        resp = await client.post(
            f"{BASE}/{owned_session}/steer/reorder", json={"order": ["q2", "q1"]}
        )
        assert resp.status_code == 404
        assert [i["queuedAt"] for i in llm._steer_sessions[owned_session]] == ["q1", "q2"]

    async def test_owner_can_reorder(self, client: AsyncClient, owned_session, monkeypatch):
        llm._steer_sessions[owned_session] = [
            {"text": "a", "queuedAt": "q1", "kind": "guide"},
            {"text": "b", "queuedAt": "q2", "kind": "guide"},
        ]
        _as(monkeypatch, OWNER)
        resp = await client.post(
            f"{BASE}/{owned_session}/steer/reorder", json={"order": ["q2", "q1"]}
        )
        assert resp.status_code == 200
        assert [i["queuedAt"] for i in llm._steer_sessions[owned_session]] == ["q2", "q1"]


class TestToolResultOwnerGate:
    async def test_stranger_cannot_forge_tool_result(self, client: AsyncClient, monkeypatch):
        """越权伪造工具结果:回包与"会话不存在"同形,且不写结果、不置 Event。"""
        sid = f"d-{uuid.uuid4()}"
        event = asyncio.Event()
        llm._delegate_sessions[sid] = {
            "owner_user_id": OWNER,
            "pending_call_1": event,
        }
        _as(monkeypatch, STRANGER)
        resp = await client.post(
            f"{BASE}/{sid}/tool-result",
            json={"tool_call_id": "call_1", "result": {"forged": True}},
        )
        assert resp.status_code == 200
        assert resp.json() == {"ok": False, "error": "session not found or expired"}
        assert "result_call_1" not in llm._delegate_sessions[sid]
        assert event.is_set() is False

    async def test_owner_can_deliver_tool_result(self, client: AsyncClient, monkeypatch):
        sid = f"d-{uuid.uuid4()}"
        event = asyncio.Event()
        llm._delegate_sessions[sid] = {
            "owner_user_id": OWNER,
            "pending_call_1": event,
        }
        _as(monkeypatch, OWNER)
        resp = await client.post(
            f"{BASE}/{sid}/tool-result",
            json={"tool_call_id": "call_1", "result": {"ok": 1}},
        )
        assert resp.status_code == 200
        assert resp.json() == {"ok": True}
        assert llm._delegate_sessions[sid]["result_call_1"] == {
            "result": {"ok": 1},
            "error": None,
        }
        assert event.is_set() is True

    async def test_legacy_delegate_entry_fails_closed(self, client: AsyncClient, monkeypatch):
        """旧条目(无 owner_user_id):调用方带主体即拒绝。"""
        sid = f"d-legacy-{uuid.uuid4()}"
        event = asyncio.Event()
        llm._delegate_sessions[sid] = {"pending_call_1": event}
        _as(monkeypatch, OWNER)
        resp = await client.post(
            f"{BASE}/{sid}/tool-result",
            json={"tool_call_id": "call_1", "result": {}},
        )
        assert resp.json() == {"ok": False, "error": "session not found or expired"}
        assert "result_call_1" not in llm._delegate_sessions[sid]
        assert event.is_set() is False


class TestOwnerRegistryLifecycle:
    async def test_owner_cleared_with_session(self):
        """属主桶与队列同生命周期:收口时一起摘,不留悬垂主体。"""
        sid = f"s-{uuid.uuid4()}"
        llm._steer_sessions[sid] = [{"text": "x", "queuedAt": "q", "kind": "guide"}]
        llm._steer_session_owners[sid] = OWNER
        llm._report_dropped_steers(sid)
        assert sid not in llm._steer_sessions
        assert sid not in llm._steer_session_owners


class TestRegistrationWritesOwner:
    """注册点必须落主体 —— 闸门再严,注册不落就是"人人都是无主旧会话"。

    这里断言源码里的注册写法而不是跑完整流:完整流要真调上游模型,不是本票的验面;
    形状断言钉的是"注册处那一行不许丢",与上面的端点行为断言互补。
    """

    def test_steer_registration_records_owner(self):
        source = inspect.getsource(llm.complete_stream)
        assert "_steer_sessions[session_id] = []" in source
        assert "_steer_session_owners[session_id] = owner_uuid" in source

    def test_delegate_registration_records_owner(self):
        source = inspect.getsource(llm.complete_stream)
        assert '_delegate_session["owner_user_id"] = owner_uuid' in source
