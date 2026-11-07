# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""AgentCheckpointManager 工具回执 API 单测(commit 2)。

回执 = 跨进程续跑的唯一凭证。这些用例钉住三件事:
1. 纯内存 manager **不是**耐久后端,不允许假装回执可跨进程(`receipts_durable()` False)。
2. 没有耐久后端时 `record_tool_receipt` 返回 False,且不改内存 —— 调用方据此 fail-closed。
3. redis / PG 两条耐久路径都做 rev CAS;rev 不匹配时不得覆盖。
"""

from __future__ import annotations

import json

import app.services.agent_checkpoint as agent_checkpoint_module
from app.services.agent_checkpoint import (
    AgentCheckpointManager,
    AgentLoopCheckpoint,
    _receipts_rev,
)


def _manager(**kwargs) -> AgentCheckpointManager:
    kwargs.setdefault("redis_url", None)
    return AgentCheckpointManager(**kwargs)


def _receipt(state: str = "settled_ok") -> dict:
    return {
        "state": state,
        "scope": "fs_write",
        "mutating": True,
        "args_digest": "digest-1",
        "attempt_seq": 1,
        "result_message": {"role": "tool", "content": "ok"},
        "result_digest": "rd",
        "ledger_id": "agent:s:c1:1",
        "attempted_at": 1.0,
        "settled_at": 2.0,
        "resolution": None,
    }


class _Cursor:
    def __init__(self, rows: list | None = None, rowcount: int = 0):
        self._rows = rows or []
        self.rowcount = rowcount

    async def fetchone(self):
        return self._rows[0] if self._rows else None


class _ReceiptConn:
    """PG 连接 fake:DDL/UPDATE 返回指定 rowcount,SELECT 返回注入行。"""

    def __init__(self, row: tuple | None, *, update_rowcount: int = 1):
        self._row = row
        self._update_rowcount = update_rowcount
        self.executed: list[tuple[str, tuple]] = []

    async def execute(self, sql: str, *params):
        self.executed.append((sql, params))
        if sql.startswith("SELECT"):
            return _Cursor([self._row] if self._row is not None else [])
        if sql.startswith("UPDATE agent_checkpoints"):
            return _Cursor(rowcount=self._update_rowcount)
        return _Cursor()

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False


class _Pool:
    def __init__(self, conn: _ReceiptConn):
        self._conn = conn
        self.closed = False

    def connection(self):
        return self._conn

    async def close(self):
        self.closed = True


class _FakeRedis:
    def __init__(self, payload: dict, *, ttl: int = 120):
        self.data = {f"agent_ckpt:{payload['checkpoint_id']}": json.dumps(payload)}
        self.ttl_value = ttl
        self.set_calls: list[tuple[str, str, int | None]] = []

    async def get(self, key: str):
        return self.data.get(key)

    async def ttl(self, key: str):
        return self.ttl_value

    async def set(self, key: str, value: str, ex: int | None = None):
        self.set_calls.append((key, value, ex))
        self.data[key] = value


def _pg_row(payload: dict) -> tuple:
    return (
        payload["checkpoint_id"],
        payload["session_id"],
        payload["status"],
        payload["iteration"],
        payload,
        payload["created_at"],
        payload["expires_at"],
    )


def _payload(checkpoint_id: str = "cp-1", *, rev: int = 0) -> dict:
    return {
        "checkpoint_id": checkpoint_id,
        "session_id": "s1",
        "iteration": 3,
        "messages": [{"role": "assistant", "content": "calling tools"}],
        "tool_state": {"resume_receipts": {"v": 1, "rev": rev, "calls": {}}},
        "status": "running",
        "created_at": 1.0,
        "expires_at": 9999999999.0,
        "metadata": {},
    }


async def test_memory_manager_is_not_durable():
    mgr = _manager()
    assert await mgr.receipts_durable() is False


async def test_memory_only_receipt_write_is_rejected_and_does_not_fake_state():
    mgr = _manager()
    cid = await mgr.save_checkpoint(
        session_id="s1", iteration=1, messages=[], tool_state={}, status="running"
    )
    applied = await mgr.record_tool_receipt(cid, "c1", _receipt(), expected_rev=0)
    assert applied is False
    cp = await mgr.load_checkpoint(cid)
    assert cp is not None
    assert "resume_receipts" not in cp.tool_state


async def test_pg_receipt_write_applies_with_rev_cas(monkeypatch):
    monkeypatch.setattr(agent_checkpoint_module, "_PSYCOPG_AVAILABLE", True)
    payload = _payload()
    conn = _ReceiptConn(_pg_row(payload), update_rowcount=1)
    mgr = _manager(db_url="postgresql://fake")
    mgr._pool = _Pool(conn)
    # 内存副本也必须存在,写入成功后同步
    cp = AgentLoopCheckpoint.from_dict(payload)
    mgr._checkpoints[cp.checkpoint_id] = cp
    mgr._session_index[cp.session_id] = cp.checkpoint_id

    applied = await mgr.record_tool_receipt(cp.checkpoint_id, "c1", _receipt(), expected_rev=0)
    assert applied is True
    assert _receipts_rev(cp.tool_state) == 1
    assert cp.tool_state["resume_receipts"]["calls"]["c1"]["state"] == "settled_ok"
    update = [e for e in conn.executed if e[0].startswith("UPDATE agent_checkpoints")]
    assert len(update) == 1
    assert update[0][1][2] == 0  # CAS 期望 rev
    assert "resume_receipts" in json.loads(update[0][1][0])["tool_state"]


async def test_pg_receipt_write_rejects_stale_rev(monkeypatch):
    monkeypatch.setattr(agent_checkpoint_module, "_PSYCOPG_AVAILABLE", True)
    payload = _payload(rev=2)
    conn = _ReceiptConn(_pg_row(payload), update_rowcount=1)
    mgr = _manager(db_url="postgresql://fake")
    mgr._pool = _Pool(conn)

    applied = await mgr.record_tool_receipt("cp-1", "c1", _receipt(), expected_rev=0)
    assert applied is False
    assert not any(e[0].startswith("UPDATE") for e in conn.executed)


async def test_pg_receipt_write_rejects_rowcount_zero(monkeypatch):
    monkeypatch.setattr(agent_checkpoint_module, "_PSYCOPG_AVAILABLE", True)
    payload = _payload()
    conn = _ReceiptConn(_pg_row(payload), update_rowcount=0)
    mgr = _manager(db_url="postgresql://fake")
    mgr._pool = _Pool(conn)

    applied = await mgr.record_tool_receipt("cp-1", "c1", _receipt(), expected_rev=0)
    assert applied is False


async def test_redis_receipt_write_preserves_ttl():
    payload = _payload()
    fake = _FakeRedis(payload, ttl=120)
    mgr = _manager(redis_url="redis://fake")
    mgr._redis = fake
    mgr._use_redis = True
    cp = AgentLoopCheckpoint.from_dict(payload)
    mgr._checkpoints[cp.checkpoint_id] = cp

    applied = await mgr.record_tool_receipt(cp.checkpoint_id, "c1", _receipt(), expected_rev=0)
    assert applied is True
    assert _receipts_rev(cp.tool_state) == 1
    # 写回保留原 TTL,不重置成 manager 默认值
    receipt_sets = [c for c in fake.set_calls if c[0] == f"agent_ckpt:{cp.checkpoint_id}"]
    assert receipt_sets[-1][2] == 120


async def test_redis_receipt_write_rejects_stale_rev():
    payload = _payload(rev=5)
    fake = _FakeRedis(payload)
    mgr = _manager(redis_url="redis://fake")
    mgr._redis = fake
    mgr._use_redis = True
    applied = await mgr.record_tool_receipt("cp-1", "c1", _receipt(), expected_rev=0)
    assert applied is False
    assert fake.set_calls == []
