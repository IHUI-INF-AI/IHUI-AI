# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""安全强化第 26 批:langgraph 线程归属持久化。

缺陷(第 16 批头注已如实登记的遗留项):
  第 16 批的归属账只住在进程内存(`canvas_graph._canvas_owner_registry`),而线程
  图状态住在 LangGraph saver 表里。进程重启后归属账清空、图注册表也清空,但
  `GET /{thread_id}/state` 的 graphState 仍可从 saver 读出 —— 任何人拿到 threadId
  就能读走他人整段对话与工具结果。

修法:
  · 新增 `langgraph_thread_owners`(thread_id 主键,user_id uuid),归属的持久真相源;
  · 执行类入口(canvas/run、stream、interrupt、resume)首次接触时登记,走
    `ON CONFLICT ... DO UPDATE ... RETURNING` 的原子 UPSERT + 读回,不做"先查后写";
  · 读取类入口(state、history)只比对、不登记 —— 读一次就取得归属,等于把线程送给
    猜中 id 的人;
  · 只有 uuid 形态的主体可归属:system-worker、dev-anonymous 都不是 uuid,既不取得
    归属也不参与比对(`user_id` 列的 uuid 类型是第二道防线)。

用例:
  A 主体规范化:uuid 通过(大小写归一),system-worker / dev-anonymous / 空 ⇒ None。
  B 读取类不登记;执行类首次接触登记;已登记不被覆盖。
  C 重启(内存账清空)后持久账仍生效:他人 404,属主放行。
  D 系统身份不取得归属,也不参与比对(内部调用不被误伤)。
  E DB 不可用 ⇒ 按未登记处理(不拒、不崩)。
  F 超长 thread_id ⇒ 404(DB 列宽 100,不让它打到 SQL)。
  G 持久层 SQL 形态:冲突时空更新 + RETURNING 读回既有归属。
"""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.routers import langgraph as lg
from app.services import thread_owner_store as tos

_ALICE = "11111111-1111-4111-8111-111111111111"
_BOB = "22222222-2222-4222-8222-222222222222"


@pytest.fixture(autouse=True)
def owner_store_stub(monkeypatch):
    """归属持久账的内存替身:单测不连 DB(§5 测试隔离铁律)。"""
    store: dict[str, str] = {}

    async def _load(thread_id: str) -> str | None:
        return store.get(thread_id)

    async def _claim(thread_id: str, user_id: str) -> str | None:
        return store.setdefault(thread_id, user_id)

    monkeypatch.setattr(lg, "load_thread_owner", _load)
    monkeypatch.setattr(lg, "claim_thread_owner", _claim)
    return store


# ---------------------------------------------------------------------------
# A:主体规范化
# ---------------------------------------------------------------------------


def test_normalize_principal_accepts_uuid_only():
    assert lg._normalize_principal(_ALICE) == _ALICE
    # JWT 里的 uuid 可能带大写:统一到标准小写形态后再比对,否则大小写差异 = 误拒
    assert lg._normalize_principal(_ALICE.upper()) == _ALICE
    for raw in ("system-worker", "dev-anonymous", "", None):
        assert lg._normalize_principal(raw) is None


# ---------------------------------------------------------------------------
# B:读取不登记 / 执行登记 / 不覆盖
# ---------------------------------------------------------------------------


async def test_read_does_not_claim(owner_store_stub):
    await lg._assert_thread_access("t-read-only", _BOB, claim=False)
    assert owner_store_stub == {}


async def test_execute_claims_on_first_contact(owner_store_stub):
    await lg._assert_thread_access("t-exec", _ALICE, claim=True)
    assert owner_store_stub["t-exec"] == _ALICE


async def test_claim_does_not_overwrite_existing_owner(owner_store_stub):
    owner_store_stub["t-owned"] = _ALICE
    with pytest.raises(HTTPException) as exc:
        await lg._assert_thread_access("t-owned", _BOB, claim=True)
    assert exc.value.status_code == 404
    assert owner_store_stub["t-owned"] == _ALICE


# ---------------------------------------------------------------------------
# C:重启后持久账仍生效
# ---------------------------------------------------------------------------


async def test_persistent_owner_survives_memory_reset(owner_store_stub):
    """内存 canvas 账为空(= 进程刚重启),持久账仍在 ⇒ 他人仍 404、属主放行。"""
    owner_store_stub["t-restart"] = _ALICE
    with pytest.raises(HTTPException):
        await lg._assert_thread_access("t-restart", _BOB, claim=False)
    with pytest.raises(HTTPException):
        await lg._assert_thread_access("t-restart", _BOB, claim=True)
    await lg._assert_thread_access("t-restart", _ALICE, claim=False)


# ---------------------------------------------------------------------------
# D:系统身份
# ---------------------------------------------------------------------------


async def test_system_principal_never_claims(owner_store_stub):
    await lg._assert_thread_access("t-sys", "system-worker", claim=True)
    assert owner_store_stub == {}
    # 也不参与比对:内部系统调用读已归属线程不被误伤(射程声明,不是漏洞)
    owner_store_stub["t-sys-owned"] = _ALICE
    await lg._assert_thread_access("t-sys-owned", "system-worker", claim=False)


# ---------------------------------------------------------------------------
# E/F:失效方向与入参边界
# ---------------------------------------------------------------------------


async def test_store_failure_is_treated_as_unregistered(monkeypatch):
    async def _boom(*_a, **_k):
        raise RuntimeError("db down")

    monkeypatch.setattr(lg, "load_thread_owner", _boom)
    monkeypatch.setattr(lg, "claim_thread_owner", _boom)
    await lg._assert_thread_access("t-db-down", _ALICE, claim=True)  # 不抛


async def test_overlong_thread_id_is_404():
    with pytest.raises(HTTPException) as exc:
        await lg._assert_thread_access("x" * 101, _ALICE, claim=False)
    assert exc.value.status_code == 404


# ---------------------------------------------------------------------------
# G:持久层 SQL 形态(不连库,替身连接)
# ---------------------------------------------------------------------------


class _FakeConn:
    def __init__(self, row: dict[str, object] | None):
        self.row = row
        self.calls: list[tuple[str, tuple[object, ...]]] = []

    async def fetchrow(self, sql: str, *args: object):
        self.calls.append((sql, args))
        return self.row


class _FakeAcquire:
    def __init__(self, conn: _FakeConn):
        self._conn = conn

    async def __aenter__(self) -> _FakeConn:
        return self._conn

    async def __aexit__(self, *_exc: object) -> bool:
        return False


class _FakePool:
    def __init__(self, conn: _FakeConn):
        self._conn = conn

    def acquire(self) -> _FakeAcquire:
        return _FakeAcquire(self._conn)


def _patch_pool(monkeypatch, conn: _FakeConn) -> None:
    async def _pool() -> _FakePool:
        return _FakePool(conn)

    monkeypatch.setattr(tos, "get_shared_pool", _pool)


async def test_claim_sql_returns_existing_owner_on_conflict(monkeypatch):
    conn = _FakeConn({"user_id": _ALICE})
    _patch_pool(monkeypatch, conn)
    got = await tos.claim_thread_owner("t-sql", _BOB)
    # 并发首次接触:后到者读回先到者的归属(调用方据此拒绝),而不是把自己写成主人
    assert got == _ALICE
    sql, args = conn.calls[0]
    assert "ON CONFLICT" in sql and "RETURNING user_id" in sql
    assert args == ("t-sql", _BOB)


async def test_load_returns_none_when_absent(monkeypatch):
    conn = _FakeConn(None)
    _patch_pool(monkeypatch, conn)
    assert await tos.load_thread_owner("t-none") is None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
