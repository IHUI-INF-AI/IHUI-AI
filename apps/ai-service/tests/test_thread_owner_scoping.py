# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""线程的只读面与销毁面按属主过滤(2026-09-27 批 61 / G-250)。

批 59 收的是"结算侧"(谁能结哪条待决请求),批 60 收的是"身份写侧"(属主改不动)。
本票收剩下的那一半:**按 id 直接读/删/归档线程的入口,过去完全不看属主**。

两组面,同一个形状 —— `authenticate` / `get_current_user_id` 只回答"你是谁",
不回答"这条能不能给你动":

  · 引擎 JSON-RPC 面(这些走 store,不经 `_require_thread`,所以批 51 的咽喉点覆盖不到):
    `thread.search` / `thread.items.list` / `thread.turns.list` / `thread.read` /
    `thread.delete` / `thread.archive`;
  · HTTP 面 `app/routers/sessions.py`:13 个端点**全部** `Depends(get_current_user_id)`
    而**一次都没用过**那个身份(本轮现读,不是票面原先写的"只有一条 list")。

处置口径(三条,逐条有用例钉住):
  ① **与"不存在"同形** —— 陌生 id 与别人的 id 给同一个结论,不得把端点做成存在性预言机;
  ② **未发出副作用** —— 删/归档/开 turn 的越权尝试必须断言"库里那行没动",
     只断言错误码会放过"先改了再抛 404"(本仓 §5 的取证口径);
  ③ **无身份通道行为不变** —— principal=None(未鉴权/dev 通道、不经 HTTP 直调引擎)
     维持改动前的全量语义,这是"无从对账"不是"允许看别人的"。

隔离:私有 SQLite 落 tmp_path,不碰 data/sessions.db、不碰生产 PG(8810)/Redis(8811)。
"""

from __future__ import annotations

from typing import Any

import pytest
from fastapi import HTTPException

from app.routers import sessions as sessions_router
from app.services.agent_engine import THREAD_NOT_FOUND, AgentEngine
from app.services.session_store import SessionStore, UserMessageItem


async def _factory(spec: dict[str, Any], host_tools: list[Any]) -> Any:
    class _Loop:
        def __init__(self) -> None:
            self.spec = spec

        async def run(self, messages: list[Any]) -> Any:
            raise AssertionError("本文件不跑主循环")

    return _Loop()


def _store(tmp_path) -> SessionStore:
    return SessionStore(str(tmp_path / "scope.db"))


def _thread_with_content(store: SessionStore, owner: str, text: str) -> str:
    """建一条属于 owner 的线程,并写入一条含 text 的 item(搜索/列表都要有料)。"""
    thread = store.create_thread(title=f"t-{owner}", metadata={}, user_id=owner)
    turn = store.start_turn(thread.thread_id, metadata={"model": "m"})
    store.append_item(turn.turn_id, UserMessageItem(content=text), thread_id=thread.thread_id)
    return thread.thread_id


async def _rpc(
    engine: AgentEngine, method: str, params: dict[str, Any], *, principal: str | None = None
) -> dict[str, Any]:
    payload: dict[str, Any] = {"jsonrpc": "2.0", "id": 1, "method": method, "params": dict(params)}
    if principal is not None:
        payload["params"]["userId"] = principal
    response = await engine.handle_message(payload)
    assert response is not None
    return response


# ---------------------------------------------------------------------------
# 1. thread.read:陌生连接与"线程不存在"同码同形
# ---------------------------------------------------------------------------


async def test_thread_read_foreign_is_indistinguishable_from_missing(tmp_path) -> None:
    store = _store(tmp_path)
    engine = AgentEngine(loop_factory=_factory, store=store)
    alice_tid = _thread_with_content(store, "alice", "机密报价")

    foreign = await _rpc(engine, "thread.read", {"threadId": alice_tid}, principal="bob")
    missing = await _rpc(engine, "thread.read", {"threadId": "thr_nope"}, principal="bob")
    assert foreign["error"]["code"] == THREAD_NOT_FOUND, foreign
    # 同形:同码 + 同一句模板(报文里只回显调用者自己交上来的 id,不掺任何别人的信息)
    assert foreign["error"]["message"].startswith("线程不存在")
    assert missing["error"]["message"].startswith("线程不存在")
    assert "t-alice" not in str(foreign["error"]) and "alpha" not in str(foreign["error"])
    mine = await _rpc(engine, "thread.read", {"threadId": alice_tid}, principal="alice")
    assert mine["result"]["preview"] == "机密报价"


# ---------------------------------------------------------------------------
# 2/3. items.list / turns.list:非属主拿到空集,且与"没这条线程"同形
# ---------------------------------------------------------------------------


async def test_items_list_scoped(tmp_path) -> None:
    store = _store(tmp_path)
    engine = AgentEngine(loop_factory=_factory, store=store)
    alice_tid = _thread_with_content(store, "alice", "alpha")

    foreign = await _rpc(engine, "thread.items.list", {"threadId": alice_tid}, principal="bob")
    missing = await _rpc(engine, "thread.items.list", {"threadId": "thr_nope"}, principal="bob")
    assert foreign["result"]["items"] == []
    # 同形:两个结论的**键集**一致、payload 一致(只有回显的调用者自交 id 不同)
    assert set(foreign["result"]) == set(missing["result"])
    assert foreign["result"]["items"] == missing["result"]["items"]
    mine = await _rpc(engine, "thread.items.list", {"threadId": alice_tid}, principal="alice")
    assert len(mine["result"]["items"]) == 1


async def test_turns_list_scoped(tmp_path) -> None:
    store = _store(tmp_path)
    engine = AgentEngine(loop_factory=_factory, store=store)
    alice_tid = _thread_with_content(store, "alice", "alpha")

    foreign = await _rpc(engine, "thread.turns.list", {"threadId": alice_tid}, principal="bob")
    assert foreign["result"]["turns"] == []
    mine = await _rpc(engine, "thread.turns.list", {"threadId": alice_tid}, principal="alice")
    assert len(mine["result"]["turns"]) == 1


# ---------------------------------------------------------------------------
# 4. thread.search:属主过滤必须写在 SQL 里(不是响应侧筛)
# ---------------------------------------------------------------------------


async def test_search_does_not_cross_users(tmp_path) -> None:
    store = _store(tmp_path)
    engine = AgentEngine(loop_factory=_factory, store=store)
    alice_tid = _thread_with_content(store, "alice", "alice-secret-phrase")
    bob_tid = _thread_with_content(store, "bob", "bob-secret-phrase")

    as_bob = await _rpc(engine, "thread.search", {"query": "secret"}, principal="bob")
    hits = as_bob["result"]["hits"]
    assert {h["threadId"] for h in hits} == {bob_tid}, hits
    as_alice = await _rpc(engine, "thread.search", {"query": "secret"}, principal="alice")
    assert {h["threadId"] for h in as_alice["result"]["hits"]} == {alice_tid}
    # 点名别人的 threadId 也拿不到内容(同"没命中")
    named = await _rpc(
        engine, "thread.search", {"query": "alice", "threadId": alice_tid}, principal="bob"
    )
    assert named["result"]["hits"] == []


# ---------------------------------------------------------------------------
# 5/6. delete / archive:越权必须"未发出写"
# ---------------------------------------------------------------------------


async def test_delete_foreign_is_refused_and_row_survives(tmp_path) -> None:
    store = _store(tmp_path)
    engine = AgentEngine(loop_factory=_factory, store=store)
    alice_tid = _thread_with_content(store, "alice", "keep me")

    gone = await _rpc(engine, "thread.delete", {"threadId": alice_tid}, principal="bob")
    assert gone["result"]["deleted"] is False, gone["result"]
    assert store.get_thread(alice_tid) is not None, "别人的删除把 alice 的行删掉了"
    assert store.list_items(alice_tid), "级联删除在越权尝试里发生了"

    deleted = await _rpc(engine, "thread.delete", {"threadId": alice_tid}, principal="alice")
    assert deleted["result"]["deleted"] is True
    assert store.get_thread(alice_tid) is None


async def test_archive_foreign_is_refused_and_flag_untouched(tmp_path) -> None:
    store = _store(tmp_path)
    engine = AgentEngine(loop_factory=_factory, store=store)
    alice_tid = _thread_with_content(store, "alice", "alpha")

    foreign = await _rpc(
        engine, "thread.archive", {"threadId": alice_tid, "archived": True}, principal="bob"
    )
    assert foreign["error"]["code"] == THREAD_NOT_FOUND, foreign
    assert store.get_thread(alice_tid).archived is False, "别人的归档改了 alice 的行"
    ok = await _rpc(
        engine, "thread.archive", {"threadId": alice_tid, "archived": True}, principal="alice"
    )
    assert ok["result"]["updated"] is True
    # G-815919:归档后该行退出业务读路径,标记走恢复面专用读(include_archived)
    assert store.get_thread(alice_tid, include_archived=True).archived is True


# ---------------------------------------------------------------------------
# 7. 反向对照:无身份通道(principal=None)与改动前逐字相同
# ---------------------------------------------------------------------------


async def test_unauthenticated_channel_still_sees_everything(tmp_path) -> None:
    store = _store(tmp_path)
    engine = AgentEngine(loop_factory=_factory, store=store)
    alice_tid = _thread_with_content(store, "alice", "alpha")
    bob_tid = _thread_with_content(store, "bob", "alpha")

    read = await _rpc(engine, "thread.read", {"threadId": alice_tid})
    assert "error" not in read, read
    hits = (await _rpc(engine, "thread.search", {"query": "alpha"}))["result"]["hits"]
    assert {alice_tid, bob_tid} <= {h["threadId"] for h in hits}


# ---------------------------------------------------------------------------
# 8-12. HTTP /api/sessions:取到身份又丢掉 == 没鉴权
# ---------------------------------------------------------------------------


def _tid_of(data: dict[str, Any]) -> str:
    # 本 router 直接 `model_dump(mode="json")`,键是 **snake_case**(与引擎面的 camelCase
    # 不是一套);夹具按各自面的真形写,不得两边都猜。
    return str(data["data"]["thread_id"])


def test_http_get_thread_scoped(tmp_path) -> None:
    store = _store(tmp_path)
    alice_tid = _thread_with_content(store, "alice", "alpha")

    with pytest.raises(HTTPException) as foreign:
        sessions_router.get_thread(alice_tid, user_id="bob", store=store)
    with pytest.raises(HTTPException) as missing:
        sessions_router.get_thread("thr_nope", user_id="bob", store=store)
    assert foreign.value.status_code == 404 and missing.value.status_code == 404
    # 同形:详情句式与"不存在"一致,且不回显别人的标题/内容
    assert foreign.value.detail.startswith("thread 不存在")
    assert "alpha" not in str(foreign.value.detail) and "t-alice" not in str(foreign.value.detail)
    body = sessions_router.get_thread(alice_tid, user_id="alice", store=store)
    assert _tid_of(body) == alice_tid


def test_http_list_threads_scoped(tmp_path) -> None:
    store = _store(tmp_path)
    _thread_with_content(store, "alice", "alpha")
    bob_tid = _thread_with_content(store, "bob", "beta")

    data = sessions_router.list_threads(limit=50, offset=0, include_archived=False, user_id="bob", store=store)[
        "data"
    ]
    assert [t["thread_id"] for t in data["threads"]] == [bob_tid]
    assert data["total"] == len(data["threads"]), "total 说的必须是过滤后的那批"


def test_http_write_surface_scoped(tmp_path) -> None:
    """开 turn / 追加 item / 结束 turn 三条写路径,越权必须"未发出写"。"""
    store = _store(tmp_path)
    alice_tid = _thread_with_content(store, "alice", "alpha")
    alice_turn = store.list_turns(alice_tid)[0]

    with pytest.raises(HTTPException) as e1:
        sessions_router.start_turn(
            alice_tid, sessions_router.CreateTurnRequest(), user_id="bob", store=store
        )
    assert e1.value.status_code == 404
    assert len(store.list_turns(alice_tid)) == 1, "bob 在 alice 的线程上开了 turn"

    with pytest.raises(HTTPException) as e2:
        sessions_router.append_item(
            alice_turn.turn_id,
            sessions_router.AppendItemRequest(
                item={"item_type": "user_message", "content": "injected"}
            ),
            user_id="bob",
            store=store,
        )
    assert e2.value.status_code == 404
    assert all("injected" not in str(getattr(i, "content", "")) for i in store.list_items(alice_tid))

    with pytest.raises(HTTPException) as e3:
        sessions_router.end_turn(
            alice_turn.turn_id,
            sessions_router.EndTurnRequest(status="completed"),
            user_id="bob",
            store=store,
        )
    assert e3.value.status_code == 404
    assert store.get_turn(alice_turn.turn_id).status == "running", "bob 结束了 alice 的 turn"


def test_http_read_items_and_turns_scoped(tmp_path) -> None:
    store = _store(tmp_path)
    alice_tid = _thread_with_content(store, "alice", "alpha")

    with pytest.raises(HTTPException) as e:
        sessions_router.list_items(
            alice_tid, after_seq=None, upto_seq=None, kind=None, user_id="bob", store=store
        )
    assert e.value.status_code == 404
    turns = sessions_router.list_turns(alice_tid, status=None, user_id="bob", store=store)["data"]
    assert turns["turns"] == [] and turns["total"] == 0
    mine = sessions_router.list_items(
        alice_tid, after_seq=None, upto_seq=None, kind=None, user_id="alice", store=store
    )["data"]
    assert len(mine["items"]) == 1


def test_http_mutation_endpoints_scoped(tmp_path) -> None:
    """resume / fork / rollback / compact 四条变更路径同一条闸。"""
    store = _store(tmp_path)
    alice_tid = _thread_with_content(store, "alice", "alpha")
    alice_turn = store.list_turns(alice_tid)[0]
    for name, call in (
        ("resume_thread", lambda uid: sessions_router.resume_thread(alice_tid, user_id=uid, store=store)),
        (
            "fork_thread",
            lambda uid: sessions_router.fork_thread(
                alice_tid,
                sessions_router.ForkRequest(at_response_id=1),
                user_id=uid,
                store=store,
            ),
        ),
        (
            "rollback_thread",
            lambda uid: sessions_router.rollback_thread(
                alice_tid,
                sessions_router.RollbackRequest(to_turn_id=alice_turn.turn_id),
                user_id=uid,
                store=store,
            ),
        ),
        (
            "compact_thread",
            lambda uid: sessions_router.compact_thread(
                alice_tid,
                sessions_router.CompactRequest(summary="边界摘要"),
                user_id=uid,
                store=store,
            ),
        ),
    ):
        before_threads = len(store.list_threads(limit=500, owner_user_id="alice").threads)
        before_items = len(store.list_items(alice_tid))
        with pytest.raises(HTTPException) as exc:
            call("bob")
        assert exc.value.status_code == 404, name
        assert (
            len(store.list_threads(limit=500, owner_user_id="alice").threads) == before_threads
        ), f"{name} 新造了线程"
        assert len(store.list_items(alice_tid)) == before_items, f"{name} 写进了 alice 的线程"
    # 属主本人四条都还能跑(正向对照,防"把功能改坏")
    assert "data" in sessions_router.resume_thread(alice_tid, user_id="alice", store=store)
    assert (
        "data"
        in sessions_router.compact_thread(
            alice_tid, sessions_router.CompactRequest(summary="s"), user_id="alice", store=store
        )
    )


def test_http_search_scoped(tmp_path) -> None:
    store = _store(tmp_path)
    _thread_with_content(store, "alice", "cross-user-phrase")
    bob_tid = _thread_with_content(store, "bob", "cross-user-phrase")

    data = sessions_router.search_sessions(
        q="cross-user-phrase", thread_id=None, limit=50, user_id="bob", store=store
    )["data"]
    assert {h["thread_id"] for h in data["hits"]} == {bob_tid}
    assert data["total"] == len(data["hits"])
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
