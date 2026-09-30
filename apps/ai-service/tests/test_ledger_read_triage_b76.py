# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# -*- coding: utf-8 -*-

"""b76-03 票2(G-998088):不可信读取的三态分离(missing / invalid / unreadable)。

四支判别:valid / missing / invalid / unreadable —— **"文件缺失表示离线,
JSON/schema 损坏表示观测不可信,两者不能再折叠成同一个 null"**。
验收草案三条:
① 给读取函数喂三种输入(不存在 / 坏载荷 / 读不出),断言返回三个互不相同的
   判别值,且②③都不许被算作①;
② "等待某状态"的读取侧(goal-state 端点)在②③下立即抛错并点名 session;
③ 分支表同时列出 missing / invalid / unreadable(常量见
   goal_verification.LEDGER_READ_*,由 grep 验收另测)。
"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi import FastAPI, Request
from httpx import ASGITransport, AsyncClient

from app.routers import goal_verification
from app.routers.goal_verification import (
    LEDGER_READ_INVALID,
    LEDGER_READ_MISSING,
    LEDGER_READ_UNREADABLE,
    LEDGER_READ_VALID,
    classify_ledger_read,
)
from app.services.goal_round_state import (
    NOT_FOUND,
    SESSION_KEY_PREFIX,
    STATE_METADATA_KEY,
    CheckpointGoalRoundStore,
    GoalRoundRead,
    GoalRoundState,
    WriteReceipt,
)
from tests.test_goal_verify_loop import criteria, machine_evidence


class FakeCheckpoint:
    """`AgentLoopCheckpoint` 的最小形状(本层只读 metadata)。"""

    def __init__(self, checkpoint_id: str, session_id: str, metadata: dict[str, Any]) -> None:
        self.checkpoint_id = checkpoint_id
        self.session_id = session_id
        self.metadata = metadata


class RecordingSink:
    """替身 checkpoint 出口:rows 可随意摆放,用来造"存在但损坏"。"""

    def __init__(self) -> None:
        self.rows: dict[str, FakeCheckpoint] = {}
        self.saves = 0

    async def load_latest_by_session(self, session_id: str) -> FakeCheckpoint | None:
        return self.rows.get(session_id)

    async def save_checkpoint(
        self,
        session_id: str,
        iteration: int,
        messages: list[dict[str, Any]],
        tool_state: dict[str, Any],
        status: str = "running",
        metadata: dict[str, Any] | None = None,
        owner_user_id: str | None = None,
    ) -> str:
        self.saves += 1
        cid = f"ckpt-{self.saves}"
        self.rows[session_id] = FakeCheckpoint(cid, session_id, dict(metadata or {}))
        return cid

    async def delete_checkpoint(self, checkpoint_id: str) -> bool:
        for key, row in list(self.rows.items()):
            if row.checkpoint_id == checkpoint_id:
                del self.rows[key]
                return True
        return False


class ErroringSink(RecordingSink):
    """读取通道本身故障(权限/IO 错)的那一档:load 一律抛。"""

    async def load_latest_by_session(self, session_id: str) -> FakeCheckpoint | None:
        raise PermissionError(f"deny {session_id}")


def _state(session: str = "s-1", **over: Any) -> GoalRoundState:
    base: dict[str, Any] = {
        "session_id": session,
        "owner_user_id": "user-a",
        "rounds": 1,
        "consecutive_failures": 1,
        "stagnation": 0,
        "last_unmet": ("tsc",),
        "last_status": "not_achieved",
        "blocked": False,
        "blocked_reason": "",
        "tokens_spent": 100,
        "token_budget": 1000,
        "updated_at": 1234.0,
    }
    base.update(over)
    return GoalRoundState(**base)


class StaticStore:
    """固定返回一份 GoalRoundRead 的账本替身(等-侧端点只用到 read/describe)。"""

    name = "static"

    def __init__(self, read: GoalRoundRead) -> None:
        self._read = read
        self.reads = 0

    def describe(self) -> WriteReceipt:
        return WriteReceipt(storage=self.name, durable=True, reason=None)

    async def read(self, session_id: str) -> GoalRoundRead:
        self.reads += 1
        return self._read

    async def write(self, state: GoalRoundState) -> WriteReceipt:
        return self.describe()

    async def clear(self, session_id: str) -> bool:
        return False


# ==================== ① 读取函数的三种输入 ⇒ 三个互不相同的判别值 ====================


@pytest.mark.asyncio
async def test_reading_distinguishes_missing_invalid_unreadable() -> None:
    """①不存在 ⇒ missing;②存在但载荷损坏 ⇒ invalid;③存在但读不出 ⇒ unreadable。"""
    # ① 文件不存在(权威层没有这条账)⇒ missing
    missing_store = CheckpointGoalRoundStore(RecordingSink())
    read_missing = await missing_store.read("no-such-session")
    # ② 文件存在但内容不合 schema(账在、观测不可信)⇒ invalid
    sink = RecordingSink()
    key = f"{SESSION_KEY_PREFIX}s-broken"
    sink.rows[key] = FakeCheckpoint("c1", key, {STATE_METADATA_KEY: {"v": 1, "rounds": "many"}})
    read_invalid = await CheckpointGoalRoundStore(sink).read("s-broken")
    # ③ 文件存在且合法但读不出来(权限/IO 错)⇒ unreadable
    read_unreadable = await CheckpointGoalRoundStore(ErroringSink()).read("s-denied")

    assert classify_ledger_read(read_missing) == LEDGER_READ_MISSING
    assert classify_ledger_read(read_invalid) == LEDGER_READ_INVALID
    assert classify_ledger_read(read_unreadable) == LEDGER_READ_UNREADABLE
    # 三个判别值互不相同,且②③都不许被算作①
    values = {
        classify_ledger_read(read_missing),
        classify_ledger_read(read_invalid),
        classify_ledger_read(read_unreadable),
    }
    assert len(values) == 3
    # 正向对照:写到一半的真账读回来 ⇒ valid
    ok_sink = RecordingSink()
    ok_store = CheckpointGoalRoundStore(ok_sink)
    await ok_store.write(_state("s-ok"))
    assert classify_ledger_read(await ok_store.read("s-ok")) == LEDGER_READ_VALID
    # 四支判别连 valid 一起互不相同
    assert len(values | {LEDGER_READ_VALID}) == 4


def test_classifier_never_folds_missing_into_the_other_two() -> None:
    """纯构造面:NOT_FOUND(missing)与两档 unreadable 形状的判别永不折叠。"""
    assert classify_ledger_read(NOT_FOUND) == LEDGER_READ_MISSING
    invalid = GoalRoundRead(
        found=False, state=None, unreadable=True, reason="账本载荷形状不认识"
    )
    unreadable = GoalRoundRead(
        found=False, state=None, unreadable=True, reason="读取失败: OSError"
    )
    assert classify_ledger_read(invalid) == LEDGER_READ_INVALID
    assert classify_ledger_read(unreadable) == LEDGER_READ_UNREADABLE
    assert classify_ledger_read(invalid) != classify_ledger_read(NOT_FOUND)
    assert classify_ledger_read(unreadable) != classify_ledger_read(NOT_FOUND)
    valid = GoalRoundRead(found=True, state=None, unreadable=False, reason=None)
    assert classify_ledger_read(valid) == LEDGER_READ_VALID


# ==================== ② 等待侧:②③立即抛错并点名,①正常返回 ====================


@pytest.mark.asyncio
async def test_wait_side_raises_immediately_on_invalid_and_unreadable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """轮询侧读到 invalid/unreadable ⇒ 502 立即抛错点名 session,绝不冒充未命中。"""
    session = "s-poll-broken"
    broken = GoalRoundRead(
        found=False, state=None, unreadable=True, reason="账本载荷形状不认识"
    )
    denied = GoalRoundRead(
        found=False, state=None, unreadable=True, reason="读取失败: PermissionError"
    )
    app = FastAPI()
    app.include_router(goal_verification.router)

    @app.middleware("http")
    async def _inject_principal(request: Request, call_next: Any) -> Any:
        request.state.user_id = "user-a"
        return await call_next(request)

    async def _get(store: StaticStore, *, expect_status: int | None) -> dict[str, Any]:
        monkeypatch.setattr(goal_verification, "get_store", lambda: store)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://t") as client:
            res = await client.get("/api/agent/goal-state", params={"session_id": session})
        if expect_status is not None:
            assert res.status_code == expect_status, res.text
        return res.json()

    # ② 损坏:502,detail 点名 session 与档位
    body = await _get(StaticStore(broken), expect_status=502)
    assert "invalid" in body["detail"]
    assert session in body["detail"]
    # ③ 读不出:502,detail 点名 session 与档位
    body = await _get(StaticStore(denied), expect_status=502)
    assert "unreadable" in body["detail"]
    assert session in body["detail"]
    # ① 确实没账:正常 200,read_state=missing —— 轮询方据此才能区分"没发生"与"不可信"
    body = await _get(StaticStore(NOT_FOUND), expect_status=200)
    assert body["read_state"] == LEDGER_READ_MISSING
    assert body["found"] is False and body["unreadable"] is False


@pytest.mark.asyncio
async def test_wait_side_valid_read_reports_valid_state(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """读到合法账 ⇒ 200 且 read_state=valid(四支判别的正向档)。"""
    store = CheckpointGoalRoundStore(RecordingSink())
    await store.write(_state("s-valid"))
    monkeypatch.setattr(goal_verification, "get_store", lambda: store)
    app = FastAPI()
    app.include_router(goal_verification.router)

    @app.middleware("http")
    async def _inject_principal(request: Request, call_next: Any) -> Any:
        request.state.user_id = "user-a"
        return await call_next(request)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://t") as client:
        res = await client.get("/api/agent/goal-state", params={"session_id": "s-valid"})
    assert res.status_code == 200, res.text
    assert res.json()["read_state"] == LEDGER_READ_VALID


# ==================== ③ 调用侧(goal-verify)暴露四支判别,不折桶 ====================


@pytest.mark.asyncio
async def test_goal_verify_exposes_ledger_read_state(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """带 session 校验遇到坏账本:不中断判定(既有 escalate 语义),但响应必须
    带上 ledger_read_state=invalid,调用方看得见"这本账不可信",而不是只能从
    ledger_unreadable 的二值里猜。"""
    session = "s-verify-broken"
    broken = GoalRoundRead(
        found=False, state=None, unreadable=True, reason="账本载荷形状不认识"
    )
    store = StaticStore(broken)
    monkeypatch.setattr(goal_verification, "get_store", lambda: store)
    payload = {
        "criteria": criteria("tsc"),
        "evidence": [machine_evidence("tsc", met=False)],
        "session_id": session,
    }
    transport = ASGITransport(
        app=_app_with_principal()
    )
    async with AsyncClient(transport=transport, base_url="http://t") as client:
        res = await client.post("/api/agent/goal-verify", json=payload)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["ledger_read_state"] == LEDGER_READ_INVALID
    assert body["ledger_unreadable"] is True
    # 既有语义不回退:不可信账本必须上报人(escalate),不得安静续跑
    assert body["escalate"] is True
    assert body["consecutive_failures"] == 1  # 低估值:账读不出,不是"真的第一轮"


def _app_with_principal() -> FastAPI:
    app = FastAPI()
    app.include_router(goal_verification.router)

    @app.middleware("http")
    async def _inject_principal(request: Request, call_next: Any) -> Any:
        request.state.user_id = "user-a"
        return await call_next(request)

    return app
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
