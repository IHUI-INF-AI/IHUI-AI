# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D1047 A 档·主对话流半 —— 取数侧判据(``app/core/approval_replay.py``)的钉子。

与任务流侧的 ``test_d1047_pending_approval_replay.py`` 成对,判据逐字同族:
① 仍待决(decision 未写 ∧ 事件未置)且属主精确相等 ⇒ 重放,载荷字段齐全;
② 已决/已唤醒 ⇒ 不重放(二次弹窗=副作用);
③ 属主不等 ⇒ 不重放(fail-closed);**现读生产条目形态(无 owner 键)⇒ 恒空**
   —— 惰性闸:接线补丁把 owner/展示字段补进条目之前,本函数对 llm.py 现读面
   零行为(已落代码可回滚);
④ 请求者无身份(None)只能拿到属主同为 None 的条目;
⑤ 旧形态(非 dict / event 缺失或非 Event)跳过;entries 为空/None ⇒ 恒空;
⑥ 展示字段不全(tool_call_id/args_preview/danger_level 缺席)⇒ 不发半截帧。

测试隔离(AGENTS §5):全程纯内存,不连 PostgreSQL / Redis,不 import 任何会
触发建池的模块路径(被测模块是 core 下纯函数,不依赖 llm.py)。
"""

from __future__ import annotations

import asyncio

from app.core.approval_replay import chat_pending_approval_replays


def _entry(
    *,
    owner: str | None = "user-A",
    decision: str | None = None,
    set_event: bool = False,
    with_fields: bool = True,
) -> dict[str, object]:
    ev = asyncio.Event()
    if set_event:
        ev.set()
    entry: dict[str, object] = {
        "event": ev,
        "decision": decision,
        "scope": None,
        "reason": None,
        "argv": None,
        "tool_name": "run_command",
        "net_fact": None,
    }
    if with_fields:
        # 接线补丁(条目扩展)落地后的形态:补记属主与重放所需展示字段
        entry.update(
            {
                "owner_user_id": owner,
                "tool_call_id": "call_000000000001",
                "args_preview": '{"cmd": "ls"}',
                "danger_level": "high",
                "created_at": "2026-10-18T00:00:00Z",
            }
        )
    return entry


def _registry() -> dict[str, object]:
    return {}


def test_pending_same_owner_is_replayable() -> None:
    """① 命中:待决 + 同属主 ⇒ 重放载荷字段齐全(与任务流重放载荷同族)。"""
    reg = _registry()
    reg["appr_aaa000000001"] = _entry()
    reg["appr_bbb000000002"] = _entry()
    out = chat_pending_approval_replays(reg, "user-A")
    assert [p["approval_id"] for p in out] == [
        "appr_aaa000000001",
        "appr_bbb000000002",
    ]
    first = out[0]
    assert first["tool_name"] == "run_command"
    assert first["tool_call_id"] == "call_000000000001"
    assert first["args_preview"] == '{"cmd": "ls"}'
    assert first["danger_level"] == "high"
    assert first["created_at"] == "2026-10-18T00:00:00Z"
    assert first["owner_user_id"] == "user-A"


def test_decided_or_settled_is_not_replayed() -> None:
    """② 已决(decision 写入)或已唤醒(事件置位)⇒ 不重放,防二次弹窗。"""
    reg = _registry()
    reg["appr_dec000000001"] = _entry(decision="approve")
    reg["appr_set000000002"] = _entry(set_event=True)
    assert chat_pending_approval_replays(reg, "user-A") == []


def test_cross_owner_is_excluded() -> None:
    """③ 跨属主不重放(不串门)。"""
    reg = _registry()
    reg["appr_owr000000001"] = _entry(owner="user-B")
    assert chat_pending_approval_replays(reg, "user-A") == []


def test_current_production_shape_is_inert() -> None:
    """③ 补(惰性闸):现读 llm.py 条目形态(无 owner 键、无展示字段)⇒ 恒空。

    接线补丁未落地之前,本函数对生产面必须零行为 —— 带身份调用者被属主闸挡住;
    无身份调用者虽过属主闸,但被展示字段闸挡住。双闸任何一路都能独立挡住。
    """
    reg = _registry()
    reg["appr_cur000000001"] = _entry(with_fields=False)
    # 带身份:属主闸挡住
    assert chat_pending_approval_replays(reg, "user-A") == []
    # 无身份:展示字段闸挡住(条目里 tool_call_id/args_preview/danger_level 全缺席)
    assert chat_pending_approval_replays(reg, None) == []


def test_identity_less_caller_sees_only_identity_less_entries() -> None:
    """④ fail-closed:无身份调用者只拿到属主同为 None 的条目(与结算判据同向)。"""
    reg = _registry()
    reg["appr_anon00000001"] = _entry(owner=None)
    reg["appr_own00000002"] = _entry(owner="user-A")
    out = chat_pending_approval_replays(reg, None)
    assert [p["approval_id"] for p in out] == ["appr_anon00000001"]


def test_none_or_empty_entries_return_empty() -> None:
    """⑤ 补:entries 为 None / 空 dict(旧会话已收口)⇒ 恒空,不炸不猜。"""
    assert chat_pending_approval_replays(None, "user-A") == []
    assert chat_pending_approval_replays({}, "user-A") == []


def test_legacy_or_malformed_entries_are_skipped() -> None:
    """⑤ 历史二元组/畸形条目不参与重放;同表里的健康条目不受牵连。"""
    ev = asyncio.Event()
    reg = _registry()
    reg["appr_old00000001"] = (ev, None)  # 历史二元组形态
    reg["appr_bad00000002"] = {"decision": None}  # 有 decision 无 event
    reg["appr_ok000000003"] = _entry()
    out = chat_pending_approval_replays(reg, "user-A")
    assert [p["approval_id"] for p in out] == ["appr_ok000000003"]


def test_incomplete_display_fields_are_not_replayed() -> None:
    """⑥ 展示字段任一缺席 ⇒ 不发半截帧(前端没法弹的帧宁可不发,与现状同态)。"""
    reg = _registry()
    entry = _entry()
    entry["args_preview"] = None  # 单字段缺席
    reg["appr_hlf000000001"] = entry
    assert chat_pending_approval_replays(reg, "user-A") == []
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
