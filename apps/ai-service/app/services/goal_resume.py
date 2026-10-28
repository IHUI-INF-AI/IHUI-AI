# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""会话目标「恢复」面 —— 控制帧 `resume_goal` 的共用服务实现(2026-10-28 立)。

## 这一帧补的是什么

D141 正本(§1.1 目标族)把 `resume_goal` 判成**真缺**,否证命令是
`git grep -inE "resumeGoal|resume_goal|恢复目标|continueGoal"` → 0 命中。
但同一张表的 `set_goal` / `get_goal` / `clear_goal` 三行判「等价」,锚点正是
D152 那条 `POST /llm/sessions/{id}/goal` —— 而**那条端点的 `action` 集合里本来
就有 `"resume"`**(2026-09-29 立,见 `app/routers/llm.py` `post_session_goal`)。

所以本帧要补的不是「能不能恢复」这一能力,而是:

1. **一个以帧名命名的显式入口** —— 宿主/agent 能指名调 `resume_goal` 并拿到回执,
   而不是靠猜 `action` 字符串;竞品原帧即 `request({type:"resume_goal"})`。
2. **一份可复用的实现** —— 端点与帧面共用同一个函数,避免「两处实现漂移」。
   端点的 `action:"resume"` 分支改为调本模块 ⇒ 状态机、归属判定、广播三件事
   只有一份实现,改一处即可。
3. **一条把差额讲清楚的口径** —— 「恢复了几条 / 为什么没恢复」必须可见;
   只回一句「已恢复」等于把静默失败包装成成功态(前端两条纪律)。

## 归属口径(AGENTS §5「认证不等于授权」)

* principal **只取承载层显式传入的令牌主体**,body 里自报的 userId 一律不读 ——
  读了就是「可认领他人会话」的入口。
* 「没这条会话」与「不是你的」**同形回包**:不写库、不广播、不给任何可枚举差异。
* 未鉴权通道(principal 为 None)对**写面**一律拒绝:这一面是「能不能替这个会话
  改状态」,没有 dev 回退可言。

## 状态机

`goalState.status` 六档(`GOAL_STATUSES`):active / paused / blocked / done /
usageLimited / budgetLimited。

* `paused` —— 宿主显式暂停,恢复它正是本帧的主语义;
* `blocked` / `usageLimited` / `budgetLimited` —— 被闸门挡住(引擎自评或额度),
  目标本身还想继续,恢复动作同样成立(闸门会重新判定);
* `active` —— 已经是 active,幂等无变化(回报 `already_active`,不谎报「已恢复」);
* `done` —— 终态,不可恢复(回报 `terminal`)。
"""

from __future__ import annotations

import logging
import time
from typing import Any

logger = logging.getLogger(__name__)

# 可由本帧恢复的来源状态集合。
# - paused:宿主显式暂停,恢复是本帧主语义;
# - blocked:引擎自评判定目标被挡住,闸门放开后仍可继续;
# - usageLimited / budgetLimited:额度闸门,不是目标的终态。
RESUMABLE_GOAL_STATUSES: tuple[str, ...] = (
    "paused",
    "blocked",
    "usageLimited",
    "budgetLimited",
)

# 终态:目标已完成,恢复无意义。
TERMINAL_GOAL_STATUSES: tuple[str, ...] = ("done",)


def _rejected(session_id: str) -> dict[str, Any]:
    """同形拒绝包。

    刻意**不带任何「为什么被拒」的差异字段** —— 差异本身就是可枚举的信息,
    「没这条会话」与「不是你的」必须同形(存在性预言机禁令,AGENTS §5)。
    """
    return {"ok": False, "accepted": False, "resumed": False, "sessionId": session_id}


def resume_goal(
    session_id: str,
    principal_uuid: str | None,
    *,
    store: Any = None,
    now: float | None = None,
    elapsed_ms: Any = None,
    token_usage: Any = None,
) -> dict[str, Any]:
    """把一个会话的目标从「被暂停/被闸门挡住」恢复到 active。

    Args:
        session_id: 会话 id(conversationId)。经 `resolve_thread_id_for_conversation`
            定位到引擎线程行 —— goal 主副本落在 `threads.metadata.goalState`,
            键是 thread_id,客户端手里只有 conversationId。
        principal_uuid: 承载层派生的令牌主体(JWT)。**None = 未鉴权通道 ⇒ 一律拒绝**。
        store: 会话存储(默认取全局 store;测试可注入替身)。
        now: 写入时刻(unix 秒);None 取当前时间。
        elapsed_ms / token_usage: 可选的计数器覆盖(与端点 `action:"resume"` 同族口径);
            形状不合法(int 以外 / 负数 / bool)一律忽略并沿用既有值,不静默改写。

    Returns:
        成功: `{"ok": True, "accepted": True, "resumed": True, "status": "active",
        "objective": str, "sessionId": str}`
        有结论但未恢复: `{"ok": True, "accepted": False, "resumed": False,
        "status": <当前档>, "reason": <码>, "sessionId": str}`
        同形拒绝(不存在 / 非属主 / 未鉴权): `{"ok": False, "accepted": False,
        "resumed": False, "sessionId": str}`
    """
    if not session_id or not isinstance(session_id, str):
        return _rejected(session_id)
    # 未鉴权通道对写面一律拒绝(没有 dev 回退)。
    if not isinstance(principal_uuid, str) or not principal_uuid:
        return _rejected(session_id)

    if store is None:
        from ..routers.sessions import get_session_store

        store = get_session_store()

    thread_id = store.resolve_thread_id_for_conversation(session_id)
    if not thread_id:
        return _rejected(session_id)

    from .session_store import owner_scoped_allows, thread_owner

    thread = store.get_thread(thread_id)
    if thread is None:
        return _rejected(session_id)
    if not owner_scoped_allows(principal_uuid, thread_owner(thread)):
        # 别人的会话:**不写库、不广播**,只留一行服务端日志(不给调用方任何差异)。
        logger.warning(
            "resume_goal 越权尝试(session=%s, caller=%s)已拒绝:未写入、未广播",
            session_id,
            principal_uuid,
        )
        return _rejected(session_id)

    existing = store.get_thread_goal_state(thread_id) or {}
    status = str(existing.get("status") or "")
    objective = str(existing.get("objective") or "")

    if not status:
        # 这条会话归你,但它没有目标 —— 不是「恢复失败」,是「没有可恢复的东西」。
        return {
            "ok": True,
            "accepted": False,
            "resumed": False,
            "status": "",
            "reason": "no_goal",
            "sessionId": session_id,
        }

    if status in TERMINAL_GOAL_STATUSES:
        return {
            "ok": True,
            "accepted": False,
            "resumed": False,
            "status": status,
            "reason": "terminal",
            "sessionId": session_id,
        }

    if status == "active":
        # 幂等:已经是 active,没有发生状态迁移。**不谎报「已恢复」**。
        return {
            "ok": True,
            "accepted": False,
            "resumed": False,
            "status": status,
            "reason": "already_active",
            "objective": objective,
            "sessionId": session_id,
        }

    if status not in RESUMABLE_GOAL_STATUSES:
        # 状态不在六档内(理论上不会发生):同形于「不可恢复」,不猜。
        return {
            "ok": True,
            "accepted": False,
            "resumed": False,
            "status": status,
            "reason": "not_resumable",
            "sessionId": session_id,
        }

    if not objective:
        # 有状态但没有目标文本 ⇒ 恢复出来也是个空目标,拒绝(不静默补默认)。
        return {
            "ok": True,
            "accepted": False,
            "resumed": False,
            "status": status,
            "reason": "no_objective",
            "sessionId": session_id,
        }

    from .session_store import normalize_goal_state

    stamp = time.time() if now is None else float(now)
    candidate: dict[str, Any] = {
        "status": "active",
        # 恢复**不换目标**:状态变了但目标文本逐字保留(与 pause/resume 同族口径)。
        "objective": objective,
        "updatedAt": stamp,
    }
    for key in ("elapsedMs", "tokenUsage"):
        value = existing.get(key)
        if isinstance(value, int) and not isinstance(value, bool) and value >= 0:
            candidate[key] = value
    # 端点 `action:"resume"` 允许随请求带计数器;形状不合法就沿用既有值(不静默改写)。
    for key, override in (("elapsedMs", elapsed_ms), ("tokenUsage", token_usage)):
        if isinstance(override, int) and not isinstance(override, bool) and override >= 0:
            candidate[key] = override

    new_state = normalize_goal_state(candidate)
    if new_state is None:
        return {
            "ok": True,
            "accepted": False,
            "resumed": False,
            "status": status,
            "reason": "not_resumable",
            "sessionId": session_id,
        }

    # 唯一合法写口。返回 None = 线程行没了(与「不存在」同形)。
    if store.set_thread_goal_state(thread_id, new_state) is None:
        return _rejected(session_id)

    from .agent_events import SSE_GOAL_UPDATED, publish_goal_update

    payload: dict[str, Any] = {
        "type": SSE_GOAL_UPDATED,
        "sessionId": session_id,
        "status": "active",
        "objective": new_state.get("objective", ""),
        "updatedAt": new_state.get("updatedAt", stamp),
    }
    for key in ("elapsedMs", "tokenUsage"):
        if new_state.get(key) is not None:
            payload[key] = new_state[key]
    # 推进该会话当前所有活跃流(别的端不刷新即见)。返回 0 不是失败:主副本已落库,
    # 下一次流首会带出当前目标 —— 所以刻意不因 0 投递而改判 accepted。
    publish_goal_update(session_id, payload)

    logger.info(
        "resume_goal 生效(session=%s, thread=%s):%s -> active",
        session_id,
        thread_id,
        status,
    )
    return {
        "ok": True,
        "accepted": True,
        "resumed": True,
        "status": "active",
        "objective": new_state.get("objective", ""),
        "sessionId": session_id,
        "threadId": thread_id,
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
