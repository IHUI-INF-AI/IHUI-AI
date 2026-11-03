# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D77 残余收口(2026-10-23):表单应答状态的**读端点**(GET .../form-response)。

判据对着读通道的四条断言写:
① approve 回显(valueFields/valueCount/rejectReason/decidedAt 逐字段,且 SQL 带
   request_id+session_id **复合谓词**);② reject 回显(values NULL ⇒ valueFields 空、
   rejectReason 在);③ 越权 / 无 thread 映射 / 无身份 ⇒ 与"不存在"**同形**回包,且
   **一行 SQL 都不发出**(替身表的 calls 为空是判据,不是装饰);
④ 别的 session 的 request_id ⇒ not_found 同形(复合谓词在 SQL 层就落成查不到);
⑤ 库不可达 ⇒ **可分辨**的 unavailable,不冒充 not-found;⑥ 列表模式按会话过滤。

隔离(AGENTS §5):全程不碰生产 PostgreSQL。autouse 先把
`app.core.db_pool.get_shared_pool` 换成"当场报错"实现(任何漏网路径立现),再把
被测模块拿到的池换成只认 SELECT 的替身;假 store 换掉
`routers.sessions.get_session_store` —— 端点在函数体内**调用时** import,补丁必然生效。
"""

from __future__ import annotations

import json
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from app.core import db_pool
from app.routers import llm as llm_mod
from app.routers import sessions as sessions_mod
from app.services import form_responses
from app.services.mcp_server import BUSINESS_FORM_KINDS

_OWNER_A = "11111111-1111-1111-1111-111111111111"
_OWNER_B = "22222222-2222-2222-2222-222222222222"
_SESSION = "sess-read-1"
_OTHER_SESSION = "sess-read-other"
_NOT_FOUND_SHAPE = {"ok": False, "error": "form request not found or expired"}
_DECIDED = datetime(2026, 10, 20, 7, 0, 0, tzinfo=UTC)


def _a_real_kind() -> str:
    assert BUSINESS_FORM_KINDS, "表单种类清单为空 ⇒ 判据无从成立(不得当成通过)"
    return sorted(BUSINESS_FORM_KINDS)[0]


def _row(
    request_id: str,
    session_id: str,
    *,
    action: str,
    values: str | None,
    reject_reason: str | None,
) -> dict[str, Any]:
    """按**库会回的样子**造行:共享池未注册 jsonb codec,values 读回来是 str。"""
    return {
        "request_id": request_id,
        "session_id": session_id,
        "kind": _a_real_kind(),
        "action": action,
        "values": values,
        "reject_reason": reject_reason,
        "decided_at": _DECIDED,
    }


class _FakeTable:
    """只认 SELECT 的读替身:按 (request_id, session_id) 复合谓词过滤,并记录每条 SQL。"""

    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows
        self.calls: list[tuple[str, tuple[Any, ...]]] = []

    async def fetchrow(self, sql: str, *args: Any) -> dict[str, Any] | None:
        assert sql.lstrip().upper().startswith("SELECT"), f"读端点发出了非 SELECT: {sql}"
        assert "chat_form_responses" in sql, f"读的不是目标表: {sql}"
        assert "request_id" in sql and "session_id" in sql, (
            f"单条查询缺 request_id+session_id 复合谓词(只按主键查=存在性探针): {sql}"
        )
        self.calls.append((sql, args))
        request_id, session_id = args
        for row in self.rows:
            if row["request_id"] == request_id and row["session_id"] == session_id:
                return dict(row)
        return None

    async def fetch(self, sql: str, *args: Any) -> list[dict[str, Any]]:
        assert sql.lstrip().upper().startswith("SELECT"), f"读端点发出了非 SELECT: {sql}"
        assert "chat_form_responses" in sql, f"读的不是目标表: {sql}"
        assert "session_id" in sql, f"列表查询缺 session_id 谓词: {sql}"
        self.calls.append((sql, args))
        (session_id,) = args
        return [dict(r) for r in self.rows if r["session_id"] == session_id]


class _FakePool:
    def __init__(self, table: _FakeTable) -> None:
        self._table = table

    def acquire(self) -> Any:
        table = self._table

        @asynccontextmanager
        async def _ctx() -> Any:
            yield table

        return _ctx()


class _FakeStore:
    """假 session store:只提供 resolve/get_thread 两个读面,thread 用 metadata.userId 记属主。"""

    def __init__(self) -> None:
        self.mappings: dict[str, str] = {}
        self.threads: dict[str, Any] = {}

    def resolve_thread_id_for_conversation(self, session_id: str) -> str | None:
        return self.mappings.get(session_id)

    def get_thread(self, thread_id: str) -> Any:
        return self.threads.get(thread_id)


@pytest.fixture()
def table() -> _FakeTable:
    return _FakeTable(
        [
            _row(
                "req-read-approve",
                _SESSION,
                action="approve",
                values=json.dumps({"to": "a@b.c", "subject": "周报"}, ensure_ascii=False),
                reject_reason=None,
            ),
            _row(
                "req-read-reject",
                _SESSION,
                action="reject",
                values=None,
                reject_reason="收件人写错了",
            ),
            # 同库另一会话的行:属主同为 OWNER_A 也**不该**被借道读到(复合谓词判它 not_found)
            _row(
                "req-read-foreign-session",
                _OTHER_SESSION,
                action="approve",
                values=json.dumps({"secret": "别的会话的答案"}),
                reject_reason=None,
            ),
        ]
    )


@pytest.fixture(autouse=True)
def _isolate_db(monkeypatch: pytest.MonkeyPatch, table: _FakeTable) -> None:
    """先焊死真实连接通道,再换替身(用例体内不存在"补丁之前已发生的真实读")。"""

    async def _unavailable() -> Any:
        raise AssertionError("D77 读用例禁止连接共享 PostgreSQL(8810)")

    monkeypatch.setattr(db_pool, "get_shared_pool", _unavailable)

    fake_pool = _FakePool(table)

    async def _fake_get_shared_pool() -> Any:
        return fake_pool

    monkeypatch.setattr(form_responses, "get_shared_pool", _fake_get_shared_pool)


@pytest.fixture(autouse=True)
def store(monkeypatch: pytest.MonkeyPatch) -> _FakeStore:
    """autouse:默认 _SESSION 映射到一条属于 OWNER_A 的 thread(鉴权链的正路在位)。

    不 autouse 的用例体拿到的是**真 store** —— 正路用例会被"无映射"误拒,
    而拒绝用例只是碰巧通过(判的不是归属比对)。
    """
    fake = _FakeStore()
    fake.mappings[_SESSION] = "thread-read-1"
    fake.threads["thread-read-1"] = SimpleNamespace(metadata={"userId": _OWNER_A})
    monkeypatch.setattr(sessions_mod, "get_session_store", lambda: fake)
    return fake


@pytest.fixture()
def client() -> Any:
    app = FastAPI()
    app.include_router(llm_mod.router)

    @app.middleware("http")
    async def _inject_identity(request: Request, call_next):  # type: ignore[no-untyped-def]
        uid = request.headers.get("x-test-uid")
        if uid:
            request.state.user_id = uid
        return await call_next(request)

    with TestClient(app) as c:
        yield c


def _get(client: Any, uid: str | None, request_id: str | None = None) -> dict[str, Any]:
    headers = {"x-test-uid": uid} if uid else {}
    params = {"request_id": request_id} if request_id is not None else None
    resp = client.get(
        f"/llm/complete/stream/{_SESSION}/form-response", headers=headers, params=params
    )
    return dict(resp.json())


def test_approve_echoes_values_and_metadata(client: Any, table: _FakeTable) -> None:
    out = _get(client, _OWNER_A, "req-read-approve")

    assert out["ok"] is True
    assert out["requestId"] == "req-read-approve" and out["sessionId"] == _SESSION
    assert out["action"] == "approve"
    assert out["valueCount"] == 2
    assert {f["name"] for f in out["valueFields"]} == {"to", "subject"}
    assert out["rejectReason"] is None
    assert out["decidedAt"] == _DECIDED.isoformat()
    # 真发出了 SQL,且是带复合谓词的 SELECT
    assert len(table.calls) == 1
    sql, args = table.calls[0]
    assert args == ("req-read-approve", _SESSION)
    assert "request_id" in sql and "session_id" in sql


def test_reject_echoes_empty_valuefields_with_reason(client: Any, table: _FakeTable) -> None:
    out = _get(client, _OWNER_A, "req-read-reject")

    assert out["ok"] is True and out["action"] == "reject"
    # values 列为 NULL ⇒ 空预览,不是 [{}] 也不是把 None 序列化进回包
    assert out["valueFields"] == [] and out["valueCount"] == 0
    assert out["rejectReason"] == "收件人写错了"


def test_value_preview_is_truncated(client: Any, table: _FakeTable) -> None:
    table.rows.append(
        _row(
            "req-read-long",
            _SESSION,
            action="approve",
            values=json.dumps({"body": "长" * 300}),
            reject_reason=None,
        )
    )
    out = _get(client, _OWNER_A, "req-read-long")

    assert out["ok"] is True
    assert len(out["valueFields"][0]["preview"]) == 120  # 预览截断,不整份回放用户输入


def test_foreign_caller_rejected_same_shape_and_zero_sql(
    client: Any, table: _FakeTable, store: _FakeStore
) -> None:
    out = _get(client, _OWNER_B, "req-read-approve")

    # 与"不存在"逐字段同形(连 requestId 都在)—— 端点不是存在性探针
    assert out == {**_NOT_FOUND_SHAPE, "requestId": "req-read-approve"}
    assert table.calls == []  # 越权路径结构上一行 SQL 都不发出

    # 正向对照:同一条 requestId 由属主来读 ⇒ 必然回显(证明上面不是替身坏了)
    ok = _get(client, _OWNER_A, "req-read-approve")
    assert ok["ok"] is True and len(table.calls) == 1


def test_no_thread_mapping_rejected_zero_sql(client: Any, table: _FakeTable, store: _FakeStore) -> None:
    store.mappings.pop(_SESSION)
    out = _get(client, _OWNER_A, "req-read-approve")

    assert out == {**_NOT_FOUND_SHAPE, "requestId": "req-read-approve"}
    assert table.calls == []


def test_no_identity_rejected_zero_sql(client: Any, table: _FakeTable) -> None:
    out = _get(client, None, "req-read-approve")

    assert out == {**_NOT_FOUND_SHAPE, "requestId": "req-read-approve"}
    assert table.calls == []


def test_thread_without_owner_rejected_zero_sql(client: Any, table: _FakeTable, store: _FakeStore) -> None:
    # 无属主的行(未鉴权通道建的)对**带身份**的调用者不放开:owner_scoped_allows 的严格格
    store.threads["thread-read-1"] = SimpleNamespace(metadata={})
    out = _get(client, _OWNER_A, "req-read-approve")

    assert out == {**_NOT_FOUND_SHAPE, "requestId": "req-read-approve"}
    assert table.calls == []


def test_request_id_from_other_session_is_not_found(client: Any, table: _FakeTable) -> None:
    # 属主正确、requestId 真实存在,但它属于**别的 session** ⇒ 复合谓词落成 not_found,
    # 回包与"这条不存在"逐字段同形(不泄露"它存在于别处")
    out = _get(client, _OWNER_A, "req-read-foreign-session")

    assert out == {**_NOT_FOUND_SHAPE, "requestId": "req-read-foreign-session"}


def test_db_unavailable_is_distinguishable(
    client: Any, table: _FakeTable, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _boom() -> Any:
        raise RuntimeError("pg down")

    monkeypatch.setattr(form_responses, "get_shared_pool", _boom)
    out = _get(client, _OWNER_A, "req-read-approve")

    assert out == {"ok": False, "error": "form response store unavailable"}
    # 可分辨判据:与 not-found 的 error 文本不同(调用方可据此重试),但不含任何行级信息
    assert out["error"] != _NOT_FOUND_SHAPE["error"]
    assert "pg down" not in json.dumps(out)


def test_list_mode_returns_own_session_rows_only(client: Any, table: _FakeTable) -> None:
    out = _get(client, _OWNER_A)

    assert out["ok"] is True and out["sessionId"] == _SESSION
    assert out["count"] == 2
    assert {r["requestId"] for r in out["responses"]} == {"req-read-approve", "req-read-reject"}
    assert "req-read-foreign-session" not in {r["requestId"] for r in out["responses"]}
    assert table.calls[0][1] == (_SESSION,)  # 列表查询只按 session_id 取参


def test_list_mode_foreign_caller_rejected(client: Any, table: _FakeTable) -> None:
    out = _get(client, _OWNER_B)

    assert out == {**_NOT_FOUND_SHAPE, "requestId": ""}
    assert table.calls == []
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
