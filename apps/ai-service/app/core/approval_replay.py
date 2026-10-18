# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D1047 A 档·主对话流半 —— 待决审批重放的**取数侧**判据唯一出口。

病灶(D131 取证①,``tests/test_d131_pending_approval_resume.py``):主对话流
(``app/routers/llm.py`` 的 ``_sse``)帧不带 ``id:`` 行,重连 = 重新起一次 run,
"审批已下发但用户还没点"的弹窗在断线窗口里丢。

与 agent 任务流侧(``agent_loop_v2.pending_approval_replays``,2026-10-13 先行
交付)成对:那一半显式查 ``_approval_registry``,本函数显式查主对话流的
``_approval_sessions``。判据逐字同族(精确相等、fail-closed):

① 仍待决 = decision 未写入 ∧ 唤醒事件未置(已决条目重放 = 二次弹窗 = 副作用);
② 属主精确相等:条目须登记 ``owner_user_id`` 且 == 调用者主体;请求者无可证明
   身份(None)只能拿到属主同为 None 的条目 —— 与审批结算判据同向;
   **现读生产条目没有 owner 键**(llm.py:4514 的条目只登记 event/decision/scope/
   reason/argv/tool_name/net_fact),本判据对这种形态一律判"不重放" —— 这是有意的
   惰性闸:接线补丁(把 owner 等展示字段补进条目)落地之前,本函数对现读面
   **恒返回空**,已落代码零行为、可回滚;
③ 旧形态/畸形条目(非 dict、event 缺失或非 Event)跳过,不冒充判过。

**接线侧不在本模块**(llm.py 属禁碰面,且重放答复会唤醒孤儿生成器继续执行 ——
僵尸 run,须与 sse_contract 同批先立续传锚点;接线 diff 文字随 D1047 票报告交付)。
本模块只给事实,不给授权结论:身份只能从承载层显式入参进来(AGENTS §5 同纪律)。

纯内存 + 纯函数,不连 PostgreSQL / Redis,不 import 任何会触发建池的模块路径。
"""

from __future__ import annotations

import asyncio
from typing import Any

#: 重放载荷必须携带的展示字段(接线侧把帧组装成 {"type": "tool-approval", **payload,
#: "replay": True},与 agents.py:1512 的任务流重放帧同形)。字段缺席 ⇒ 条目判
#: "不可重放" —— 宁可丢弹窗(与今天的现状同态)也不发一个前端没法弹的半截帧。
_REPLAY_FIELDS: tuple[str, ...] = (
    "tool_name",
    "tool_call_id",
    "args_preview",
    "danger_level",
)


def chat_pending_approval_replays(
    entries: dict[str, Any] | None, owner_user_id: str | None
) -> list[dict[str, Any]]:
    """主对话流(``_approval_sessions``)仍待决条目的重放载荷(只读快照)。

    Args:
        entries: ``_approval_sessions[session_id]`` 那一格(``{approval_id: 条目}``)。
            传 None / 空 dict 是合法调用(旧会话已收口 ⇒ 恒空)。
        owner_user_id: 调用者主体(JWT 派生)。None 只能拿到属主同为 None 的条目。

    Returns:
        重放载荷列表(每项含 approval_id / tool_name / tool_call_id / args_preview /
        danger_level / created_at / owner_user_id)。调用方负责包上 ``type:
        "tool-approval"`` 帧形与 ``replay: True`` 标记(与任务流 agents.py 同形)。
    """
    if not entries:
        return []
    payloads: list[dict[str, Any]] = []
    for approval_id, entry in entries.items():
        if not isinstance(entry, dict):
            # 历史形态/畸形条目:不参与(与 list_pending_approvals 跳过二元组同口径)
            continue
        event = entry.get("event")
        if not isinstance(event, asyncio.Event):
            # 没有可判"仍待决"的唤醒位 ⇒ fail-closed,跳过
            continue
        if entry.get("decision") is not None or event.is_set():
            # 已决/已唤醒:重放即二次弹窗(副作用),不重放
            continue
        if entry.get("owner_user_id") != owner_user_id:
            # 属主精确相等(②):现读生产条目无 owner 键 ⇒ .get() 得 None,
            # 仅当调用者也无身份时才可能相等;即便如此,下方展示字段闸(接线
            # 补丁未落 ⇒ 字段缺席)仍会把这一档挡住 —— 双闸,接线前恒惰性。
            continue
        if any(entry.get(f) is None for f in _REPLAY_FIELDS):
            # 展示字段不全(条目扩展补丁未落地)⇒ 不发半截帧
            continue
        payloads.append(
            {
                "approval_id": approval_id,
                "tool_name": entry["tool_name"],
                "tool_call_id": entry["tool_call_id"],
                "args_preview": entry["args_preview"],
                "danger_level": entry["danger_level"],
                "created_at": entry.get("created_at"),
                "owner_user_id": entry.get("owner_user_id"),
            }
        )
    return payloads
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
