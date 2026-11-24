# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D152(2026-09-29 立,用户拍板「服务化,但存会话元数据、不建新表」)的验收用例。

四条对应票面验收判据,每条都有**正向对照**(AGENTS §5:只留越权那一侧,门就可能只是
把功能改坏了):

  ① A 端 set 之后,**另一端读的是同一份服务端主副本** —— 断言 get_thread_goal_state
     拿回刚写的状态,且 `publish_goal_update` 真把帧投给了该会话的活跃监听者
     (票面验收①"不刷新即见"的可证形态:帧确实进了队列,不是只在响应里)。
  ② 越权:B 对 A 的会话调 goal 端点 ⇒ 断言**库没写入且没发帧**(不是只看 401/403)。
     本仓越权用例的口径是"副作用没发生";先改了再抛 403 与"没写"在状态码上同形。
  ③ **本票真正的安全点**:客户端一次 `thread/metadata`(merge=False)整写**既抹不掉
     也改不动** goalState —— 与身份键同一条判序(`carry_goal_keys`)。正反都要:
     整写不带 goal ⇒ 库里那份逐字存活;整写塞入假 goal ⇒ 服务端那份赢。
  ④ 创建面:`POST /sessions/threads` 的 body.metadata 自带 goalState ⇒ 建不出来
     (与 scrub_identity_keys 同族;否则"这台浏览器声称的状态"就成了主副本)。
"""

from __future__ import annotations

import asyncio
import concurrent.futures
from types import SimpleNamespace
from typing import Any

import pytest

from app.routers import llm as llm_router
from app.routers import sessions as sessions_router
from app.services import agent_events
from app.services.session_store import (
    GOAL_METADATA_KEYS,
    GOAL_STATUSES,
    SessionStore,
    carry_goal_keys,
    scrub_goal_keys,
)

# ---------------------------------------------------------------------------
# 夹具
# ---------------------------------------------------------------------------


@pytest.fixture()
def store(tmp_path: Any) -> SessionStore:
    s = SessionStore(str(tmp_path / "goal-d152.db"))
    yield s
    s.close()


def _make_thread(s: SessionStore, *, conversation_id: str, user_id: str) -> str:
    """建一条引擎线程行:metadata 带 conversationId(goal 端点就按它定位)。"""
    thread = s.create_thread(
        title="d152",
        metadata={"conversationId": conversation_id, "sessionId": conversation_id},
        user_id=user_id,
    )
    return thread.thread_id


def _request_as(user_id: str | None) -> SimpleNamespace:
    """伪造承载层已经写好 `request.state.user_id` 的 Request。

    刻意不经 HTTP:principal 的来源必须是**令牌主体**,所以这里直接把中间件该注入的
    那一位摆出来 —— 端点读的是 request.state,不是 body(AGENTS §5)。
    """
    state = SimpleNamespace()
    if user_id is not None:
        state.user_id = user_id
    return SimpleNamespace(state=state)


async def _goal_endpoint_once(
    s: SessionStore, session_id: str, body: dict[str, Any], *, caller: str | None
) -> dict[str, Any]:
    """把端点的存储依赖换成夹具那份 store(函数内 import,所以 patch 模块属性即可)。"""
    original = sessions_router.get_session_store
    sessions_router.get_session_store = lambda: s  # type: ignore[assignment]
    try:
        return await llm_router.post_session_goal(_request_as(caller), session_id, body)
    finally:
        sessions_router.get_session_store = original


def call_goal(
    s: SessionStore, session_id: str, body: dict[str, Any], *, caller: str | None
) -> dict[str, Any]:
    """在**独立线程**里跑一次端点。

    为什么不用裸 `asyncio.run`:本仓 pytest 装配里已有事件循环在跑(实测
    `RuntimeError: asyncio.run() cannot be called from a running event loop`),
    而把用例整体改成 async 要引入 pytest-asyncio 的循环作用域;端点是纯函数式
    awaitable,新线程自起循环是最小侵入,且**不改被测代码**。
    """
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        return pool.submit(
            asyncio.run, _goal_endpoint_once(s, session_id, body, caller=caller)
        ).result()


# ---------------------------------------------------------------------------
# ① 服务端主副本 + 下行帧投递
# ---------------------------------------------------------------------------


def test_goal_written_server_side_and_broadcast_to_live_stream(store: SessionStore) -> None:
    conversation = "conv-a"
    thread_id = _make_thread(store, conversation_id=conversation, user_id="user-a")

    queue = agent_events.register_goal_listener(conversation)
    try:
        result = call_goal(
            store,
            conversation,
            {"action": "set", "objective": "把报告写完", "elapsed_ms": 1200},
            caller="user-a",
        )
    finally:
        agent_events.unregister_goal_listener(conversation, queue)

    assert result["ok"] is True and result["accepted"] is True
    assert result["status"] == "active"
    assert result["sessionId"] == conversation

    # 主副本落在会话元数据里(零新表零迁移),且形状是服务端算出来的那一份
    stored = store.get_thread_goal_state(thread_id)
    assert stored is not None
    assert stored["status"] == "active"
    assert stored["objective"] == "把报告写完"
    assert stored["elapsedMs"] == 1200

    # 下行帧:**B 端不刷新即见**的可证形态 —— 帧真进了这条流的队列
    drained = agent_events.drain_goal_updates(queue)
    assert len(drained) == 1
    frame = drained[0]
    assert frame["type"] == agent_events.SSE_GOAL_UPDATED == "goal_updated"
    # 载荷必须自带 sessionId(不带前端只能猜,猜错表现为"点了没反应且不报错")
    assert frame["sessionId"] == conversation
    assert frame["status"] == "active"


def test_pause_resume_clear_round_trip(store: SessionStore) -> None:
    conversation = "conv-states"
    thread_id = _make_thread(store, conversation_id=conversation, user_id="user-a")

    def call(body: dict[str, Any]) -> dict[str, Any]:
        return call_goal(store, conversation, body, caller="user-a")

    assert call({"action": "set", "objective": "目标"})["status"] == "active"
    assert call({"action": "pause"})["status"] == "paused"
    # pause 保留 objective(状态变了但目标没换)
    stored = store.get_thread_goal_state(thread_id)
    assert stored is not None and stored["objective"] == "目标"
    assert call({"action": "resume"})["status"] == "active"
    assert call({"action": "clear"})["status"] == "cleared"
    # 清除 = 整键消失(不是写一个 status:'cleared' 的残行),所以"没目标"与
    # "目标处于某档"在库里可分辨;cleared 只是**线格式**的第七个判别值。
    assert store.get_thread_goal_state(thread_id) is None


# ---------------------------------------------------------------------------
# ② 越权:断言副作用没发生
# ---------------------------------------------------------------------------


def test_foreign_caller_writes_nothing_and_emits_no_frame(store: SessionStore) -> None:
    conversation = "conv-victim"
    thread_id = _make_thread(store, conversation_id=conversation, user_id="user-a")
    store.set_thread_goal_state(thread_id, {"status": "active", "objective": "A 的目标"})

    queue = agent_events.register_goal_listener(conversation)
    try:
        result = call_goal(
            store,
            conversation,
            {"action": "set", "objective": "B 想改别人的会话"},
            caller="user-b",
        )
    finally:
        agent_events.unregister_goal_listener(conversation, queue)

    # 同形回包:"没这条会话"与"不是你的"**键集与判定形状逐字一样**(否则端点就是
    # 存在性预言机)。sessionId 是请求自带的路径参数,两边都回显,不构成差异。
    not_found = call_goal(
        store, "conv-does-not-exist", {"action": "set", "objective": "x"}, caller="user-b"
    )
    assert set(result.keys()) == set(not_found.keys()) == {"ok", "accepted", "sessionId"}
    assert result["ok"] is False and result["accepted"] is False
    assert not_found["ok"] is False and not_found["accepted"] is False

    # **副作用没发生**:库里那份仍是 A 的原文,且没有任何帧被投进这条流的队列
    after = store.get_thread_goal_state(thread_id)
    assert after is not None
    assert after["objective"] == "A 的目标" and after["status"] == "active"
    assert agent_events.drain_goal_updates(queue) == []


def test_unauthenticated_caller_is_rejected_on_write(store: SessionStore) -> None:
    """写面不走 dev 回退:principal 为 None 一律同形拒绝。

    与 `agent_engine._principal_allows` 的方向差是刻意的 —— 那里问的是"内存里已经
    建起来、无人可证明身份的线程要不要继续跑",这里问的是"能不能替这个会话改状态"。
    """
    conversation = "conv-anon"
    thread_id = _make_thread(store, conversation_id=conversation, user_id="user-a")
    result = call_goal(store, conversation, {"action": "set", "objective": "x"}, caller=None)
    assert result["ok"] is False
    assert store.get_thread_goal_state(thread_id) is None


def test_body_reported_user_id_is_ignored(store: SessionStore) -> None:
    """body 里自报 userId 不得参与归属判定(它是"可认领他人会话"的入口)。"""
    conversation = "conv-spoof"
    thread_id = _make_thread(store, conversation_id=conversation, user_id="user-a")
    result = call_goal(
        store,
        conversation,
        {"action": "set", "objective": "x", "userId": "user-a"},
        caller="user-b",
    )
    assert result["accepted"] is False
    assert store.get_thread_goal_state(thread_id) is None


# ---------------------------------------------------------------------------
# ③ 客户端整写 metadata 抹不掉 goalState(本票真正的安全点)
# ---------------------------------------------------------------------------


def test_client_full_write_cannot_wipe_or_replace_goal_state(store: SessionStore) -> None:
    thread_id = _make_thread(store, conversation_id="conv-merge", user_id="user-a")
    authoritative = {"status": "blocked", "objective": "被阻塞的真目标"}
    store.set_thread_goal_state(thread_id, authoritative)

    # 情形一:客户端整写**不带** goalState ⇒ 库里那份逐字存活(旧实测:这一写会把
    # 主副本整行抹掉,于是"换浏览器就看不见目标"从服务端开始分叉)。
    wiped = store.update_thread_metadata(thread_id, {"business": "only"}, merge=False)
    assert wiped is not None
    assert wiped["goalState"] == authoritative

    # 情形二:客户端整写**塞入**假 goalState ⇒ 服务端那份赢,自报值不得覆盖主副本。
    forged = store.update_thread_metadata(
        thread_id,
        {"goalState": {"status": "done", "objective": "客户端自称完成"}},
        merge=False,
    )
    assert forged is not None
    assert forged["goalState"] == authoritative

    # merge=True 同判(两条通道都经过同一个咽喉点)
    merged = store.update_thread_metadata(thread_id, {"goalState": {"status": "done"}}, merge=True)
    assert merged is not None and merged["goalState"] == authoritative


def test_goal_state_absent_in_db_is_not_claimable_by_client(store: SessionStore) -> None:
    """库里没有 goal 时,客户端自报值被**删掉**而不是收下 —— 与 carry_identity_keys
    的判序同形:"没有目标"与"目标是攻击者选的那个人"必须区分开。"""
    thread_id = _make_thread(store, conversation_id="conv-none", user_id="user-a")
    result = store.update_thread_metadata(
        thread_id, {"goalState": {"status": "active", "objective": "伪造"}}, merge=False
    )
    assert result is not None
    assert "goalState" not in result


def test_carry_and_scrub_helpers_match_the_identity_family() -> None:
    current = {"goalState": {"status": "paused", "objective": "t"}}
    assert carry_goal_keys(current, {"goalState": {"status": "done"}}) == current
    assert carry_goal_keys({}, {"goalState": {"status": "done"}, "other": 1}) == {"other": 1}
    assert scrub_goal_keys({"goalState": {"status": "active"}, "x": 1}) == {"x": 1}
    # goalState 是独立通道:不得混进身份键族
    assert set(GOAL_METADATA_KEYS).isdisjoint({"userId", "roleId"})


def test_create_thread_strips_client_supplied_goal_state(store: SessionStore) -> None:
    """建会话时自带 goalState 一律剥掉(否则"这台浏览器声称的状态"就成了主副本)。"""
    thread = store.create_thread(
        metadata={"conversationId": "conv-c", "goalState": {"status": "done", "objective": "自称"}},
        user_id="user-a",
    )
    assert "goalState" not in thread.metadata
    assert store.get_thread_goal_state(thread.thread_id) is None


# ---------------------------------------------------------------------------
# ④ 六态是封闭集,且未知动作不得落库
# ---------------------------------------------------------------------------


def test_goal_statuses_are_the_six_agreed_states() -> None:
    assert set(GOAL_STATUSES) == {
        "active",
        "paused",
        "blocked",
        "done",
        "usageLimited",
        "budgetLimited",
    }


def test_goal_unknown_action_writes_nothing(store: SessionStore) -> None:
    """未知 action ⇒ 同形拒绝,且**不写库**(不得把"没认出来的动作"落成某种状态)。"""
    conversation = "conv-bad-action"
    thread_id = _make_thread(store, conversation_id=conversation, user_id="user-a")
    result = call_goal(
        store, conversation, {"action": "complete", "objective": "x"}, caller="user-a"
    )
    assert result["accepted"] is False
    assert store.get_thread_goal_state(thread_id) is None


def test_goal_set_without_objective_writes_nothing(store: SessionStore) -> None:
    """set 却没目标文本 ⇒ 同形拒绝(不接受"状态在、目标空"这种半成品主副本)。"""
    conversation = "conv-no-objective"
    thread_id = _make_thread(store, conversation_id=conversation, user_id="user-a")
    result = call_goal(store, conversation, {"action": "set"}, caller="user-a")
    assert result["accepted"] is False
    assert store.get_thread_goal_state(thread_id) is None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
