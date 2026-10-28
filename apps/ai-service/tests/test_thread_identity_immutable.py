# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""线程身份不可被客户端可写通道改动(2026-09-27 批 60 / G-249)。

threads 表没有 user_id 列,属主与角色只存在 `threads.metadata` 这块 **客户端可整写**
的 JSON 里。批 59 把"谁在调用"收进令牌主体之后,这条链的最后一格敞口是"被操作记录的
属主本身可被改写":

  · `thread/metadata` 的 merge=False 整写会把 `userId`/`roleId` 一起冲掉 ⇒ 重启恢复出
    的线程**无属主** ⇒ 按 `_principal_allows` ② 的"无从对账"语义,任何已登录连接都能
    接着用它对话;
  · 反方向更糟:`body.metadata` 里塞 `userId:"<victim>"` 就把线程**认领成别人的** ——
    它会出现在受害者的 thread.list 里,而真正的创建者反而碰不到它。

两条都在实现前实测过(VULNERABLE),判据不空转的对照 = 把本文件复制到
`.ihui-agent/tmp/b59/ctl/`(修复前的 HEAD 归档)里跑,必须红。

隔离(§5 测试隔离铁律):SQLite 一律落在 pytest 的 tmp_path,不碰 data/sessions.db、
不碰生产 PG(8810)/ Redis(8811);不派生任何服务。
"""

from __future__ import annotations

from typing import Any

from app.routers import sessions as sessions_router
from app.services.agent_engine import (
    THREAD_NOT_FOUND,
    AgentEngine,
)
from app.services.session_store import (
    IDENTITY_METADATA_KEYS,
    SessionStore,
    UserMessageItem,
)

# ---------------------------------------------------------------------------
# 夹具
# ---------------------------------------------------------------------------


async def _factory(spec: dict[str, Any], host_tools: list[Any]) -> Any:
    class _Loop:
        def __init__(self) -> None:
            self.spec = spec

        async def run(self, messages: list[Any]) -> Any:
            raise AssertionError("本文件不跑主循环")

    return _Loop()


def _engine_with(store: SessionStore) -> AgentEngine:
    return AgentEngine(loop_factory=_factory, store=store)


async def _rpc(
    engine: AgentEngine,
    method: str,
    params: dict[str, Any],
    *,
    principal: str | None = None,
    rid: int = 1,
) -> dict[str, Any]:
    payload: dict[str, Any] = {"jsonrpc": "2.0", "id": rid, "method": method, "params": dict(params)}
    if principal is not None:
        payload["params"]["userId"] = principal
    response = await engine.handle_message(payload)
    assert response is not None
    return response


async def _start(engine: AgentEngine, principal: str | None) -> str:
    response = await _rpc(engine, "thread.start", {"model": "m"}, principal=principal)
    assert "result" in response, response
    return str(response["result"]["threadId"])


# ---------------------------------------------------------------------------
# 1. 存储层:create_thread 的身份只能从显式入参进来
# ---------------------------------------------------------------------------


def test_create_thread_strips_client_supplied_identity(tmp_path) -> None:
    store = SessionStore(str(tmp_path / "create.db"))
    thread = store.create_thread(
        title="t", metadata={"biz": "order", "userId": "victim", "roleId": 9}
    )
    for key in IDENTITY_METADATA_KEYS:
        assert key not in thread.metadata, f"调用方自带的身份键 {key} 被原样落库了"
    assert store.get_thread(thread.thread_id).metadata["biz"] == "order"
    # 业务键照旧可写 —— 本票收的是身份,不是把 metadata 变成只读
    assert store.get_thread(thread.thread_id).metadata == {"biz": "order"}


def test_create_thread_writes_identity_only_from_explicit_args(tmp_path) -> None:
    store = SessionStore(str(tmp_path / "create2.db"))
    thread = store.create_thread(
        title="t", metadata={"userId": "victim"}, user_id="alice", role_id=3
    )
    stored = store.get_thread(thread.thread_id).metadata
    assert stored["userId"] == "alice" and stored["roleId"] == 3


def test_identity_absent_is_omitted_not_nulled(tmp_path) -> None:
    """未绑定属主时**不落键**:缺席比 null 更难被下游读成一个真实身份。"""
    store = SessionStore(str(tmp_path / "create3.db"))
    thread = store.create_thread(title="t", metadata={})
    stored = store.get_thread(thread.thread_id).metadata
    assert "userId" not in stored and "roleId" not in stored


# ---------------------------------------------------------------------------
# 2. 存储层:update_thread_metadata 两种 merge 模式都改不动身份
# ---------------------------------------------------------------------------


def test_update_metadata_cannot_wipe_or_forge_identity(tmp_path) -> None:
    store = SessionStore(str(tmp_path / "upd.db"))
    thread = store.create_thread(
        title="t", metadata={"biz": "a"}, user_id="alice", role_id=1
    )
    # ① 整写:业务键换掉,身份键留着(clearable 语义只对业务键成立)
    out = store.update_thread_metadata(thread.thread_id, {"biz": "b"}, merge=False)
    assert out == {"biz": "b", "userId": "alice", "roleId": 1}, out
    # ② 深合并里塞伪造值
    out2 = store.update_thread_metadata(thread.thread_id, {"userId": "victim"})
    assert out2 is not None and out2["userId"] == "alice", out2
    # ③ 显式清除(patch 值为 None = codex ClearableField 删键)也删不掉身份
    out3 = store.update_thread_metadata(thread.thread_id, {"userId": None, "biz": None})
    assert out3 is not None and out3.get("userId") == "alice", out3
    assert "biz" not in out3, "业务键的清除语义被本票改坏了"
    assert store.get_thread(thread.thread_id).metadata == out3


# ---------------------------------------------------------------------------
# 3. 引擎层:thread/metadata 整写后,重启恢复仍带属主、外来调用被拒
#    (G-249 票面要求的正是这条回归)
# ---------------------------------------------------------------------------


async def test_merge_false_patch_keeps_owner_across_restart(tmp_path) -> None:
    store = SessionStore(str(tmp_path / "restart.db"))
    engine = _engine_with(store)
    tid = await _start(engine, "alice")
    assert store.get_thread(tid).metadata["userId"] == "alice"

    response = await _rpc(
        engine,
        "thread.metadata",
        {"threadId": tid, "patch": {"biz": "order"}, "merge": False},
        principal="alice",
    )
    assert "error" not in response, response
    assert response["result"]["metadata"] == {"biz": "order", "userId": "alice"}
    assert store.get_thread(tid).metadata == {"biz": "order", "userId": "alice"}

    engine._threads.clear()  # 进程重启:内存线程全丢,只剩库里的 metadata
    foreign = await _rpc(
        engine, "thread.state", {"threadId": tid}, principal="bob"
    )
    assert foreign["error"]["code"] == THREAD_NOT_FOUND, foreign
    mine = await _rpc(engine, "thread.state", {"threadId": tid}, principal="alice")
    assert "error" not in mine, mine
    assert engine._threads[tid].user_id == "alice"


async def test_patch_cannot_claim_another_users_thread(tmp_path) -> None:
    """alice 把线程"转赠"给 bob ⇒ 身份键按引擎盖章的值盖回。"""
    store = SessionStore(str(tmp_path / "forge.db"))
    engine = _engine_with(store)
    tid = await _start(engine, "alice")
    response = await _rpc(
        engine,
        "thread.metadata",
        {"threadId": tid, "patch": {"userId": "bob", "roleId": 7}},
        principal="alice",
    )
    # thread.start 的角色是 0 ⇒ 引擎侧"未落键",伪造的 7 一并被摘掉(见
    # _identity_of 的"缺席比 null 更难被读成真实身份")
    assert response["result"]["metadata"] == {"userId": "alice"}, response["result"]
    assert store.get_thread(tid).metadata == {"userId": "alice"}
    engine._threads.clear()
    # bob 仍然拿不到这条(伪造没生效)
    assert (
        await _rpc(engine, "thread.state", {"threadId": tid}, principal="bob")
    )["error"]["code"] == THREAD_NOT_FOUND


async def test_unowned_thread_patch_still_fully_replaces(tmp_path) -> None:
    """正向对照(防"把修复做成把功能改坏"):无属主线程的 merge=False 行为一字未变。"""
    store = SessionStore(str(tmp_path / "unowned.db"))
    engine = _engine_with(store)
    tid = await _start(engine, None)  # 未鉴权通道:无身份可绑
    first = await _rpc(
        engine, "thread.metadata", {"threadId": tid, "patch": {"a": 1, "b": 2}}, principal=None
    )
    assert first["result"]["metadata"] == {"a": 1, "b": 2}
    second = await _rpc(
        engine,
        "thread.metadata",
        {"threadId": tid, "patch": {"only": True}, "merge": False},
        principal=None,
    )
    assert second["result"]["metadata"] == {"only": True}, second["result"]
    assert store.get_thread(tid).metadata == {"only": True}


# ---------------------------------------------------------------------------
# 4. 承载层:POST /sessions/threads 必须把令牌主体写进去
# ---------------------------------------------------------------------------


def test_http_create_thread_binds_principal(tmp_path) -> None:
    store = SessionStore(str(tmp_path / "http.db"))
    body = sessions_router.CreateThreadRequest(
        title="t", metadata={"userId": "victim", "biz": "x"}
    )
    out = sessions_router.create_thread(body, user_id="alice", store=store)
    metadata = out["data"]["metadata"]
    assert metadata["userId"] == "alice", "自报身份写进了别人的名字"
    assert metadata["biz"] == "x"


# ---------------------------------------------------------------------------
# 5. 派生面:fork / relay 的新线程继承来源属主(不得新造无属主线程)
# ---------------------------------------------------------------------------


def _thread_with_one_item(store: SessionStore) -> str:
    thread = store.create_thread(title="src", metadata={}, user_id="alice", role_id=2)
    turn = store.start_turn(thread.thread_id, metadata={"model": "m"})
    item = store.append_item(
        turn.turn_id, UserMessageItem(content="hello"), thread_id=thread.thread_id
    )
    assert item.seq > 0
    return thread.thread_id


def test_fork_inherits_owner(tmp_path) -> None:
    store = SessionStore(str(tmp_path / "fork.db"))
    source_id = _thread_with_one_item(store)
    forked = store.fork(source_id, at_response_id=1)
    metadata = store.get_thread(forked.thread_id).metadata
    assert metadata.get("userId") == "alice", "fork 出来的线程没有属主"
    assert metadata.get("roleId") == 2


def test_relay_continue_inherits_owner(tmp_path) -> None:
    from app.routers import relay as relay_router

    store = SessionStore(str(tmp_path / "relay.db"))
    source_id = _thread_with_one_item(store)
    before = {t.thread_id for t in store.list_threads(limit=100).threads}
    out = relay_router.continue_thread(source_id, user_id="alice", store=store)
    assert "error" not in str(out)[:80].lower(), out
    new_ids = [t.thread_id for t in store.list_threads(limit=100).threads if t.thread_id not in before]
    assert len(new_ids) == 1, new_ids
    metadata = store.get_thread(new_ids[0]).metadata
    assert metadata.get("userId") == "alice", "「继续上次会话」新造了一条无属主线程"


def test_relay_continue_rejects_foreign_principal_without_side_effect(tmp_path) -> None:
    """身份只能从承载层显式入参进来:别人的 principal 不得借「继续上次」读到或派生他人的线程。

    断言的是"没建出新线程",不是只断错误码 —— 先改了再抛 403 的写法在本仓同样判红。
    """
    from app.routers import relay as relay_router

    store = SessionStore(str(tmp_path / "relay.db"))
    source_id = _thread_with_one_item(store)
    before = {t.thread_id for t in store.list_threads(limit=100).threads}
    try:
        out = relay_router.continue_thread(source_id, user_id="mallory", store=store)
    except Exception as exc:  # 拒绝口径允许 403/404 同形,但不得新建任何东西
        out = exc
    assert not isinstance(out, dict) or "error" in str(out)[:80].lower(), out
    after = {t.thread_id for t in store.list_threads(limit=100).threads}
    assert after == before, f"越权调用仍然派生了新线程:{after - before}"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
