# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D77/G-106 第①格(2026-10-20):对话流业务表单的应答**真的落库**,而不是只活在被 pop 的 dict 里。

判据对着现状写:待决项在工具循环结算时无条件 `pop`,一 pop 就没有任何留存证据。
本文件判的是结算闸门之后的那一条持久行 —— 五条都断"库里的行",不断返回值:
① approve 落库且带 values;② reject 落库且 values 为 NULL(不是空对象、不是空串);
③ 同 request_id 重复应答不产生第二行(幂等由主键 + ON CONFLICT 兜,不是靠内存判断);
④ 越权:别人的 session 写不进去,且**一行都没产生**(与"Event 仍未置位 + 待决项仍在册"
   成对,并留正向对照 —— 只断状态码会放过"先写了再回一句拒绝"的写法);
⑤ 整条流程跑两遍,行数不变。

测试隔离(AGENTS §5):全程不碰生产 PostgreSQL(8810)。autouse 夹具先把
`app.core.db_pool.get_shared_pool` 换成"不可用"实现(任何漏网路径当场报错),再把
被测模块拿到的池换成只认主键唯一性的替身 —— 替身**自己不会去重**,它只按
`ON CONFLICT (request_id) DO NOTHING` 的语义回"有行/无行",所以③判的是 SQL 里那条
子句在不在,而不是替身的实现有多配合。
"""

from __future__ import annotations

import asyncio
import json
from contextlib import asynccontextmanager
from typing import Any

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient

from app.core import db_pool
from app.routers import llm as llm_mod
from app.services import form_responses
from app.services.mcp_server import BUSINESS_FORM_KINDS

_OWNER_A = "11111111-1111-1111-1111-111111111111"
_OWNER_B = "22222222-2222-2222-2222-222222222222"
_SESSION = "sess-persist-1"
# 与 _INSERT_SQL 的占位符顺序逐位对齐(替身按位置还原成行,列名写在这里是为了
# 断言时能点名"哪一列没写进去",而不是靠下标猜)。
_ROW_COLUMNS = ("request_id", "session_id", "kind", "action", "values", "reject_reason")


def _a_real_kind() -> str:
    assert BUSINESS_FORM_KINDS, "表单种类清单为空 ⇒ 判据无从成立(不得当成通过)"
    return sorted(BUSINESS_FORM_KINDS)[0]


class _FakeTable:
    """只认主键唯一性的替身:重复 request_id ⇒ 无行返回(DO NOTHING 的语义)。"""

    def __init__(self) -> None:
        self.rows: list[dict[str, Any]] = []
        self.calls: list[str] = []

    def insert(self, sql: str, args: tuple[Any, ...]) -> bool:
        assert "INSERT INTO chat_form_responses" in sql, f"写入的不是目标表: {sql}"
        assert "ON CONFLICT (request_id) DO NOTHING" in sql, (
            f"缺少主键幂等子句 ⇒ 去重落在了内存而不是存储层: {sql}"
        )
        assert "RETURNING" in sql, f"缺少 RETURNING ⇒ 无法分辨写入与幂等命中: {sql}"
        assert "$5::jsonb" in sql, f"values 未经 ::jsonb 转型(共享池不注册 codec): {sql}"
        self.calls.append(sql)
        request_id = args[0]
        if any(row["request_id"] == request_id for row in self.rows):
            return False
        # 列名与参数逐位配对,长度不等即替身失真 ⇒ 用 strict 让结构性问题当场暴露
        self.rows.append(dict(zip(_ROW_COLUMNS, args, strict=True)))
        return True

    def count(self) -> int:
        return len(self.rows)

    async def fetchrow(self, sql: str, *args: Any) -> dict[str, Any] | None:
        """asyncpg 替身:写入成功 ⇒ 回一行(DO NOTHING 命中 ⇒ 回 None)。"""
        if self.insert(sql, args):
            return {"request_id": args[0]}
        return None


class _FakePool:
    def __init__(self, table: _FakeTable) -> None:
        self._table = table

    def acquire(self) -> Any:
        table = self._table

        @asynccontextmanager
        async def _ctx() -> Any:
            yield table

        return _ctx()


@pytest.fixture()
def table() -> _FakeTable:
    return _FakeTable()


@pytest.fixture(autouse=True)
def _clean_pending_registry() -> Any:
    """待决项登记表逐用例进出清零:用例留下的格子会把下一次运行的判定顶偏。"""
    yield
    llm_mod._form_sessions.pop(_SESSION, None)


@pytest.fixture(autouse=True)
def _isolate_db(monkeypatch: pytest.MonkeyPatch, table: _FakeTable) -> None:
    """先焊死真实连接通道,再换替身(用例体内不存在"补丁之前已发生的真实写")。"""

    async def _unavailable() -> Any:
        raise AssertionError("D77 落库用例禁止连接共享 PostgreSQL(8810)")

    monkeypatch.setattr(db_pool, "get_shared_pool", _unavailable)

    fake_pool = _FakePool(table)

    async def _fake_get_shared_pool() -> Any:
        return fake_pool

    monkeypatch.setattr(form_responses, "get_shared_pool", _fake_get_shared_pool)


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


def _pending(request_id: str, *, owner: str | None) -> asyncio.Event:
    ev = asyncio.Event()
    llm_mod._form_sessions.setdefault(_SESSION, {})[request_id] = {
        "event": ev,
        "action": None,
        "values": None,
        "reject_reason": None,
        "user_id": owner,
        "kind": _a_real_kind(),
    }
    return ev


def _settle(client: Any, request_id: str, body: dict[str, Any], uid: str | None) -> dict[str, Any]:
    headers = {"x-test-uid": uid} if uid else {}
    resp = client.post(
        f"/llm/complete/stream/{_SESSION}/form-response", json=body, headers=headers
    )
    return dict(resp.json())


def test_approve_persists_row_with_values(client: Any, table: _FakeTable) -> None:
    rid = "req-approve-1"
    ev = _pending(rid, owner=_OWNER_A)
    out = _settle(client, rid, {"request_id": rid, "action": "approve", "values": {"to": "a@b.c"}}, _OWNER_A)

    assert out["ok"] is True and out["persistState"] == "written"
    assert table.count() == 1
    row = table.rows[0]
    assert row["request_id"] == rid and row["session_id"] == _SESSION
    assert row["action"] == "approve" and row["reject_reason"] is None
    assert json.loads(str(row["values"])) == {"to": "a@b.c"}
    assert row["kind"] == _a_real_kind()
    assert ev.is_set() is True


def test_reject_persists_row_with_null_values(client: Any, table: _FakeTable) -> None:
    rid = "req-reject-1"
    _pending(rid, owner=_OWNER_A)
    out = _settle(
        client,
        rid,
        {"request_id": rid, "action": "reject", "reject_reason": "收件人写错了"},
        _OWNER_A,
    )

    assert out["ok"] is True and out["persistState"] == "written"
    assert table.count() == 1
    row = table.rows[0]
    # 整字段为 NULL,不是 '{}' / 'null' / 空串:空对象会诱导下游建一条空记录
    assert row["values"] is None
    assert row["action"] == "reject" and row["reject_reason"] == "收件人写错了"


def test_same_request_id_does_not_create_second_row(client: Any, table: _FakeTable) -> None:
    rid = "req-dup-1"
    _pending(rid, owner=_OWNER_A)
    body = {"request_id": rid, "action": "approve", "values": {"subject": "x"}}

    first = _settle(client, rid, body, _OWNER_A)
    second = _settle(client, rid, body, _OWNER_A)

    assert first["persistState"] == "written"
    assert second["persistState"] == "duplicate"
    assert second["persisted"] is True
    assert table.count() == 1


def test_foreign_owner_writes_no_row(client: Any, table: _FakeTable) -> None:
    rid = "req-foreign-1"
    ev = _pending(rid, owner=_OWNER_A)
    body = {"request_id": rid, "action": "approve", "values": {"subject": "别表的表单"}}

    out = _settle(client, rid, body, _OWNER_B)

    assert out["ok"] is False
    assert table.count() == 0 and table.calls == []  # 副作用没发生:一条 SQL 都没发出去
    assert ev.is_set() is False  # 也没被结算
    assert rid in llm_mod._form_sessions.get(_SESSION, {})  # 待决项仍在册

    # 正向对照:同一个 requestId 由归属者来答 ⇒ 必然落一行(证明上面那条空不是替身坏了)
    ok = _settle(client, rid, body, _OWNER_A)
    assert ok["ok"] is True and table.count() == 1


def test_flow_twice_keeps_row_count_stable(client: Any, table: _FakeTable) -> None:
    for round_no in (1, 2):
        rid = f"req-round-{round_no}"
        _pending(rid, owner=_OWNER_A)
        out = _settle(client, rid, {"request_id": rid, "action": "reject", "reject_reason": "不"}, _OWNER_A)
        assert out["ok"] is True, f"第 {round_no} 轮未结算: {out}"
        assert table.count() == round_no
    assert table.count() == 2


def test_write_failure_is_visible_not_swallowed(
    client: Any, table: _FakeTable, monkeypatch: pytest.MonkeyPatch
) -> None:
    rid = "req-db-down-1"
    ev = _pending(rid, owner=_OWNER_A)

    async def _boom() -> Any:
        raise RuntimeError("pg down")

    monkeypatch.setattr(form_responses, "get_shared_pool", _boom)
    out = _settle(client, rid, {"request_id": rid, "action": "approve", "values": {"a": "b"}}, _OWNER_A)

    # 落库失败**不**改写结算结果(否则前端会把已生效的应答标成失败并重发),
    # 但必须显影:ok 仍是 True,persisted/persistState/error 三者把失败说清楚。
    assert out["ok"] is True
    assert out["persisted"] is False and out["persistState"] == "failed"
    assert "pg down" in str(out.get("persistError"))
    assert table.count() == 0
    assert ev.is_set() is True
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
