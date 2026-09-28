# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。


"""`/api/relay` 面的属主绑定(G-250 收尾时现读新暴露的一格)。

这个模块此前**一个身份依赖都没挂**:不是"取了身份没用"(那把 ast 尺子看得见),而是
**根本不取** ⇒ 尺子结构上判不到它。三条按 id 寻址的端点因此是全站可读/可写的:

  · `GET /relay/summary/{thread_id}` —— 凭 id 读别人的接力摘要(内容是对话的目标、
    已完成步骤、关键决定、未完成事项);
  · `POST /relay/summary` —— 凭 id 往别人的线程上**写**摘要;
  · `POST /relay/continue/{thread_id}` —— 凭 id 对别人的会话做摘要并派生新线程。

`GET /relay/summaries`(跨线程整表列出)刻意**不在本批**收:真过滤要 store 层加属主
参数(与 `list_threads(owner_user_id=…)` 同形),响应侧筛会让 `total` 与集合分叉 ——
登记见台账 G-250 那条的更新。

隔离(§5 测试隔离铁律):SQLite 一律落 tmp_path,不碰 data/、不碰生产 PG/Redis;不起 LLM
(`refine` 默认 False,确定性路径)。
"""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.routers import relay as relay_router
from app.services.session_store import SessionStore, UserMessageItem, thread_owner


def _store(tmp_path) -> SessionStore:
    return SessionStore(str(tmp_path / "relay.db"))


def _owned_thread(store: SessionStore, owner: str, text: str = "要把项目跑起来") -> str:
    """建一条属于 owner 的线程并写入一条 item —— 接力摘要要有料才可能生成成功。"""
    thread = store.create_thread(title=f"{owner} 的会话", user_id=owner)
    turn = store.start_turn(thread.thread_id, metadata={"model": "m"})
    store.append_item(turn.turn_id, UserMessageItem(content=text), thread_id=thread.thread_id)
    return thread.thread_id


def _detail(exc: HTTPException) -> str:
    assert isinstance(exc.detail, str)
    return exc.detail


# ---------------------------------------------------------------------------
# 1. 别人的与"不存在"同形:同状态码、同模板,只差回显的 id
# ---------------------------------------------------------------------------


def test_foreign_thread_is_indistinguishable_from_missing(tmp_path) -> None:
    store = _store(tmp_path)
    alice_tid = _owned_thread(store, "alice")

    with pytest.raises(HTTPException) as foreign:
        relay_router.get_relay_summary(alice_tid, "bob", store)
    with pytest.raises(HTTPException) as missing:
        relay_router.get_relay_summary("tid-does-not-exist", "bob", store)

    assert foreign.value.status_code == missing.value.status_code == 404
    # 两条 detail 去掉回显 id 后必须逐字相同,否则端点就是"这个 id 存不存在"的预言机
    assert _detail(foreign.value).replace(alice_tid, "<id>") == _detail(missing.value).replace(
        "tid-does-not-exist", "<id>"
    )


# ---------------------------------------------------------------------------
# 2. 读口:同属主仍可读(正向对照,防止"收紧"变成"整条路走不通")
# ---------------------------------------------------------------------------


def test_owner_can_still_read_and_write(tmp_path) -> None:
    store = _store(tmp_path)
    alice_tid = _owned_thread(store, "alice")

    created = relay_router.create_relay_summary(
        relay_router._CreateSummaryBody(thread_id=alice_tid), "alice", store
    )
    assert created["code"] == 0
    fetched = relay_router.get_relay_summary(alice_tid, "alice", store)
    assert fetched["data"]["thread_id"] == alice_tid


# ---------------------------------------------------------------------------
# 3. 越权用例必须断言"副作用没发生"(只断言 404 会放过"先写了再抛")
# ---------------------------------------------------------------------------


def test_foreign_write_has_no_side_effect(tmp_path) -> None:
    store = _store(tmp_path)
    alice_tid = _owned_thread(store, "alice")

    with pytest.raises(HTTPException) as exc:
        relay_router.create_relay_summary(
            relay_router._CreateSummaryBody(thread_id=alice_tid), "bob", store
        )
    assert exc.value.status_code == 404
    assert store.get_relay_summary(alice_tid) is None, "被拒之前已经把摘要写到了别人的线程上"


def test_foreign_continue_creates_no_thread(tmp_path) -> None:
    store = _store(tmp_path)
    alice_tid = _owned_thread(store, "alice")

    def ids() -> set[str]:
        return {row.thread_id for row in store.list_threads(limit=200).threads}

    before = ids()
    with pytest.raises(HTTPException) as exc:
        relay_router.continue_thread(alice_tid, "bob", store)
    assert exc.value.status_code == 404
    assert ids() == before, "被拒之后仍然派生出了新线程"


def test_continue_inherits_caller_ownership(tmp_path) -> None:
    store = _store(tmp_path)
    alice_tid = _owned_thread(store, "alice")

    before = {row.thread_id for row in store.list_threads(limit=200).threads}
    relay_router.continue_thread(alice_tid, "alice", store)
    after = {row.thread_id for row in store.list_threads(limit=200).threads}
    created = after - before
    assert len(created) == 1, f"应恰好派生一条新线程,实得 {sorted(created)}"
    new_id = created.pop()
    assert thread_owner(store.get_thread(new_id)) == "alice"
    # 别人读不到派生出的那条(属主过滤在只读口同样生效)
    with pytest.raises(HTTPException):
        relay_router.get_relay_summary(new_id, "bob", store)
