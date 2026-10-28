# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""控制帧 `resume_goal`(2026-10-28 立)的验收用例。

D141 正本(§1.1 目标族)原判 `resume_goal` **真缺**,否证命令是
`git grep -inE "resumeGoal|resume_goal|恢复目标|continueGoal"` → 0 命中。
本用例钉住「补上之后」的判据,每条都有**正向对照**(AGENTS §5:只留越权那一侧,
门就可能只是把功能改坏了):

  ① **帧面真能指名调、且必须回报结果**:paused 的目标经帧面迁到 active,
     目标文本逐字保留(恢复不换目标),并且**下行帧真的投给了该会话的活跃监听者**
     —— 只测响应体证不出"别的端不刷新即见"(D152 同一型)。
  ② **越权**:B 对 A 的会话调帧 ⇒ 断言**库没写入且没发帧**(不是只看状态码)。
  ③ **同形回包**:"没这条会话"与"不是你的"两个包**键集合与取值完全相同** ——
     端点因此不可能被当成存在性预言机(AGENTS §5)。
  ④ **未鉴权通道对写面一律拒绝**:principal 为 None ⇒ 拒绝且无副作用。
  ⑤ **差额必须可见**:没有目标 / 目标已结束 / 本来就是 active 三种情形,
     各自回**确定的 reason 码**;尤其"本来就是 active"必须回
     `already_active` 而**不是谎报"已恢复"**(把静默失败包装成成功态是本仓最高频失效型)。
  ⑥ **一份实现**:端点 `action:"resume"` 与帧面入口共用同一份服务 ——
     端点恢复之后,帧面读到的状态必须是 active(两处实现漂移是同族风险)。
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
from app.services.session_store import SessionStore

# ---------------------------------------------------------------------------
# 夹具
# ---------------------------------------------------------------------------


@pytest.fixture()
def store(tmp_path: Any) -> SessionStore:
    s = SessionStore(str(tmp_path / "d141-resume-goal.db"))
    yield s
    s.close()


def _make_thread(s: SessionStore, *, conversation_id: str, user_id: str) -> str:
    """建一条引擎线程行:metadata 带 conversationId(帧面就按它定位)。"""
    thread = s.create_thread(
        title="d141-resume",
        metadata={"conversationId": conversation_id, "sessionId": conversation_id},
        user_id=user_id,
    )
    return thread.thread_id


def _request_as(user_id: str | None) -> SimpleNamespace:
    """伪造承载层已写好 `request.state.user_id` 的 Request。

    principal 的来源必须是**令牌主体**,所以这里直接把中间件该注入的那一位摆出来
    —— 端点/帧面读的是 request.state,不是 body(AGENTS §5)。
    """
    state = SimpleNamespace()
    if user_id is not None:
        state.user_id = user_id
    return SimpleNamespace(state=state)


async def _frame_once(
    s: SessionStore, session_id: str, *, caller: str | None
) -> dict[str, Any]:
    """把帧面入口的存储依赖换成夹具那份 store(函数内 import,patch 模块属性即可)。"""
    original = sessions_router.get_session_store
    sessions_router.get_session_store = lambda: s  # type: ignore[assignment]
    try:
        return await llm_router.post_session_goal_resume(
            _request_as(caller), session_id, None
        )
    finally:
        sessions_router.get_session_store = original


async def _endpoint_once(
    s: SessionStore, session_id: str, body: dict[str, Any], *, caller: str | None
) -> dict[str, Any]:
    original = sessions_router.get_session_store
    sessions_router.get_session_store = lambda: s  # type: ignore[assignment]
    try:
        return await llm_router.post_session_goal(_request_as(caller), session_id, body)
    finally:
        sessions_router.get_session_store = original


def call_frame(
    s: SessionStore, session_id: str, *, caller: str | None
) -> dict[str, Any]:
    """在**独立线程**里跑一次帧面入口(本仓 pytest 装配里已有事件循环在跑)。"""
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        return pool.submit(
            asyncio.run, _frame_once(s, session_id, caller=caller)
        ).result()


def call_endpoint(
    s: SessionStore, session_id: str, body: dict[str, Any], *, caller: str | None
) -> dict[str, Any]:
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        return pool.submit(
            asyncio.run, _endpoint_once(s, session_id, body, caller=caller)
        ).result()


def _seed_paused(s: SessionStore, thread_id: str, objective: str = "把报告写完") -> None:
    s.set_thread_goal_state(
        thread_id, {"status": "paused", "objective": objective, "updatedAt": 1000.0}
    )


# ---------------------------------------------------------------------------
# ① 帧面真能指名调 + 必须回报结果
# ---------------------------------------------------------------------------


def test_frame_resumes_paused_goal_and_broadcasts(store: SessionStore) -> None:
    conversation = "conv-resume"
    thread_id = _make_thread(store, conversation_id=conversation, user_id="user-a")
    _seed_paused(store, thread_id)

    queue = agent_events.register_goal_listener(conversation)
    try:
        result = call_frame(store, conversation, caller="user-a")
    finally:
        agent_events.unregister_goal_listener(conversation, queue)

    assert result["ok"] is True
    assert result["accepted"] is True
    assert result["resumed"] is True
    assert result["status"] == "active"
    assert result["sessionId"] == conversation

    # 主副本真的落到 active,目标文本逐字保留(恢复不换目标)
    stored = store.get_thread_goal_state(thread_id)
    assert stored is not None
    assert stored["status"] == "active"
    assert stored["objective"] == "把报告写完"

    # 下行帧真进了这条流的队列(别的端不刷新即见的可证形态)
    drained = agent_events.drain_goal_updates(queue)
    assert len(drained) == 1
    frame = drained[0]
    assert frame["type"] == agent_events.SSE_GOAL_UPDATED == "goal_updated"
    assert frame["sessionId"] == conversation
    assert frame["status"] == "active"
    assert frame["objective"] == "把报告写完"


# ---------------------------------------------------------------------------
# ② 越权:断言副作用没发生
# ---------------------------------------------------------------------------


def test_foreign_caller_resumes_nothing_and_emits_no_frame(store: SessionStore) -> None:
    conversation = "conv-victim"
    thread_id = _make_thread(store, conversation_id=conversation, user_id="user-a")
    _seed_paused(store, thread_id)

    queue = agent_events.register_goal_listener(conversation)
    try:
        result = call_frame(store, conversation, caller="user-b")
    finally:
        agent_events.unregister_goal_listener(conversation, queue)

    assert result["ok"] is False
    assert result["accepted"] is False
    assert result["resumed"] is False
    # 副作用没发生:库里那份仍是 paused,且**没发帧**
    stored = store.get_thread_goal_state(thread_id)
    assert stored is not None and stored["status"] == "paused"
    assert agent_events.drain_goal_updates(queue) == []


# ---------------------------------------------------------------------------
# ③ 同形回包:「没这条会话」与「不是你的」逐字同形
# ---------------------------------------------------------------------------


def test_missing_session_and_foreign_session_reply_identically(store: SessionStore) -> None:
    conversation = "conv-owned-by-a"
    _make_thread(store, conversation_id=conversation, user_id="user-a")

    foreign = call_frame(store, conversation, caller="user-b")
    missing = call_frame(store, "conv-does-not-exist", caller="user-b")

    # 键集合完全相同(差异字段一律不许出现 —— 差异本身就是可枚举的信息)
    assert set(foreign.keys()) == set(missing.keys()) == {
        "ok",
        "accepted",
        "resumed",
        "sessionId",
    }
    assert "reason" not in foreign
    # 除「回显调用方自己给的 sessionId」外,逐字同形
    assert {k: v for k, v in foreign.items() if k != "sessionId"} == {
        k: v for k, v in missing.items() if k != "sessionId"
    }


# ---------------------------------------------------------------------------
# ④ 未鉴权通道对写面一律拒绝
# ---------------------------------------------------------------------------


def test_unauthenticated_channel_is_rejected_without_side_effect(
    store: SessionStore,
) -> None:
    conversation = "conv-unauth"
    thread_id = _make_thread(store, conversation_id=conversation, user_id="user-a")
    _seed_paused(store, thread_id)

    result = call_frame(store, conversation, caller=None)

    assert result["ok"] is False
    assert result["accepted"] is False
    assert result["resumed"] is False
    stored = store.get_thread_goal_state(thread_id)
    assert stored is not None and stored["status"] == "paused"


# ---------------------------------------------------------------------------
# ⑤ 差额必须可见:三种"没恢复"各回确定 reason 码
# ---------------------------------------------------------------------------


def test_no_goal_reports_no_goal_reason(store: SessionStore) -> None:
    conversation = "conv-nogoal"
    _make_thread(store, conversation_id=conversation, user_id="user-a")

    result = call_frame(store, conversation, caller="user-a")

    assert result["ok"] is True
    assert result["accepted"] is False
    assert result["resumed"] is False
    assert result["reason"] == "no_goal"


def test_terminal_goal_cannot_be_resumed(store: SessionStore) -> None:
    conversation = "conv-done"
    thread_id = _make_thread(store, conversation_id=conversation, user_id="user-a")
    store.set_thread_goal_state(
        thread_id, {"status": "done", "objective": "已完成", "updatedAt": 1000.0}
    )

    result = call_frame(store, conversation, caller="user-a")

    assert result["accepted"] is False
    assert result["resumed"] is False
    assert result["reason"] == "terminal"
    # 终态不得被"恢复"成 active
    stored = store.get_thread_goal_state(thread_id)
    assert stored is not None and stored["status"] == "done"


def test_already_active_does_not_claim_resumed(store: SessionStore) -> None:
    conversation = "conv-active"
    thread_id = _make_thread(store, conversation_id=conversation, user_id="user-a")
    store.set_thread_goal_state(
        thread_id, {"status": "active", "objective": "在跑", "updatedAt": 1000.0}
    )

    result = call_frame(store, conversation, caller="user-a")

    # 关键:已经在 active 时**不许谎报"已恢复"**(resumed 必须是 false)
    assert result["resumed"] is False
    assert result["accepted"] is False
    assert result["reason"] == "already_active"
    assert result["status"] == "active"


@pytest.mark.parametrize("status", ["blocked", "usageLimited", "budgetLimited"])
def test_gate_blocked_goals_are_resumable(store: SessionStore, status: str) -> None:
    """被闸门挡住(不是终态)的目标同样可恢复 —— 闸门会重新判定。"""
    conversation = f"conv-{status}"
    thread_id = _make_thread(store, conversation_id=conversation, user_id="user-a")
    store.set_thread_goal_state(
        thread_id, {"status": status, "objective": "继续", "updatedAt": 1000.0}
    )

    result = call_frame(store, conversation, caller="user-a")

    assert result["accepted"] is True
    assert result["resumed"] is True
    stored = store.get_thread_goal_state(thread_id)
    assert stored is not None and stored["status"] == "active"


# ---------------------------------------------------------------------------
# ⑥ 一份实现:端点 action:"resume" 与帧面入口共用同一份服务
# ---------------------------------------------------------------------------


def test_endpoint_resume_and_frame_share_one_implementation(store: SessionStore) -> None:
    conversation = "conv-shared"
    thread_id = _make_thread(store, conversation_id=conversation, user_id="user-a")
    _seed_paused(store, thread_id)

    endpoint_result = call_endpoint(
        store, conversation, {"action": "resume"}, caller="user-a"
    )
    assert endpoint_result["accepted"] is True
    assert endpoint_result["status"] == "active"

    # 端点恢复之后,帧面读到的权威状态必须也是 active(不是两份各自为政的状态)
    stored = store.get_thread_goal_state(thread_id)
    assert stored is not None and stored["status"] == "active"

    # 帧面再调一次 ⇒ 幂等,且**不谎报"已恢复"**
    again = call_frame(store, conversation, caller="user-a")
    assert again["resumed"] is False
    assert again["reason"] == "already_active"


def test_endpoint_resume_rejects_foreign_caller_without_side_effect(
    store: SessionStore,
) -> None:
    """端点侧的 resume 分支同样守「认证不等于授权」(共用实现的连带收益)。"""
    conversation = "conv-shared-victim"
    thread_id = _make_thread(store, conversation_id=conversation, user_id="user-a")
    _seed_paused(store, thread_id)

    result = call_endpoint(
        store, conversation, {"action": "resume"}, caller="user-b"
    )

    assert result["accepted"] is False
    stored = store.get_thread_goal_state(thread_id)
    assert stored is not None and stored["status"] == "paused"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
