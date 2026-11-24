# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""B3-07 四层请求元数据契约。"""

from __future__ import annotations

import asyncio

from app.services import request_metadata as rm


def _payload(**overrides):
    base = {
        "workspace": {"file_count": 12, "languages": ["ts", "py"], "data_policy": "local"},
        "business": {"id": "biz-1", "product": "ihui", "version": "1.0.0", "stage": "dev"},
        "context": {
            "request_id": "req-1",
            "session_id": "sess-1",
            "task_id": "task-1",
            "request_set_id": "set-1",
            "machine_id": "machine-1",
            "client_type": "cli",
            "source_session_id": "src-1",
        },
        "user": {"user_id": "user-1"},
    }
    base.update(overrides)
    return base


def test_valid_four_layers_round_trip():
    meta, reason = rm.validate_chat_metadata(_payload())
    assert reason is None
    assert meta is not None
    row = rm.metadata_row(meta)
    assert row[0] == "req-1"
    assert row[1] == "sess-1"
    assert row[4] == "src-1"
    assert row[5] == "user-1"
    assert row[8] == 12
    assert row[9] == ["ts", "py"]
    assert row[14] == "biz-1"


def test_missing_layer_is_rejected_with_reason():
    meta, reason = rm.validate_chat_metadata(_payload(context=None))
    assert meta is None
    assert reason is not None and reason.startswith("metadata-invalid:context")


def test_extra_field_in_layer_is_rejected():
    payload = _payload()
    payload["context"]["unknown_field"] = "x"
    meta, reason = rm.validate_chat_metadata(payload)
    assert meta is None
    assert reason is not None and "context" in reason


def test_identifiers_are_required():
    payload = _payload(context={"session_id": "s"})
    meta, reason = rm.validate_chat_metadata(payload)
    assert meta is None and reason is not None
    payload = _payload(user={})
    meta, reason = rm.validate_chat_metadata(payload)
    assert meta is None and reason is not None


def test_legacy_byok_aliases_are_tolerated():
    payload = _payload(userId="legacy-user", byokMode=True)
    meta, reason = rm.validate_chat_metadata(payload)
    assert reason is None and meta is not None
    assert meta.legacy_user_id == "legacy-user"
    assert meta.byok_mode is True


class _Conn:
    def __init__(self):
        self.executed = []

    async def execute(self, sql, *args):
        self.executed.append((sql, args))


class _Ctx:
    def __init__(self, conn):
        self.conn = conn

    async def __aenter__(self):
        return self.conn

    async def __aexit__(self, *exc):
        return None


class _Pool:
    def __init__(self, conn):
        self.conn = conn

    def acquire(self):
        return _Ctx(self.conn)


def test_record_writes_one_row(monkeypatch):
    conn = _Conn()
    monkeypatch.setattr(rm, "get_shared_pool", lambda: asyncio.sleep(0, result=_Pool(conn)))
    result = asyncio.run(rm.record_chat_metadata(rm.validate_chat_metadata(_payload())[0]))
    assert result["recorded"] is True
    assert len(conn.executed) == 2
    assert "CREATE TABLE IF NOT EXISTS" in conn.executed[0][0]
    assert conn.executed[1][1][0] == "req-1"


def test_record_failure_is_reported_not_raised(monkeypatch):
    async def boom():
        raise RuntimeError("db down")

    monkeypatch.setattr(rm, "get_shared_pool", boom)
    result = asyncio.run(rm.record_chat_metadata(rm.validate_chat_metadata(_payload())[0]))
    assert result["recorded"] is False
    assert result["reason"] == "tracking-db-unavailable"
    assert result["exceptionType"] == "RuntimeError"


def test_raw_metadata_absent_is_unjudged():
    result = asyncio.run(rm.record_raw_metadata(None))
    assert result == {"recorded": False, "reason": "metadata-absent"}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
