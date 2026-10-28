# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""批 54:压缩保留区逐组预算 + 图片预算测试(compaction_retention.py)。

pytest 同步测试;消息构造与 agent_loop_v2._messages 的 OpenAI 风格一致。
"""

from __future__ import annotations

from typing import Any

from app.core.compaction_retention import (
    MAX_RETAINED_AGENT_MESSAGE_TOKENS,
    RETAINED_MESSAGE_TOKEN_BUDGET,
    estimate_group_tokens,
    group_messages,
    select_retained_history,
    truncate_retained_messages,
)

BIG_IMAGE = "data:image/png;base64," + "A" * 2000


def _user(text: str) -> dict[str, Any]:
    return {"role": "user", "content": text}


def _assistant_with_tools(call_ids: list[str]) -> dict[str, Any]:
    return {
        "role": "assistant",
        "content": None,
        "tool_calls": [
            {
                "id": cid,
                "type": "function",
                "function": {"name": "t", "arguments": "{}"},
            }
            for cid in call_ids
        ],
    }


def _tool(cid: str, out: str = "ok") -> dict[str, Any]:
    return {"role": "tool", "tool_call_id": cid, "content": out}


def _turn(idx: int, text_len: int = 200) -> list[dict[str, Any]]:
    """一轮: assistant(tool_calls) → tool(配对组,不可拆散) + 前导 user。"""
    return [
        _user(f"q{idx} " * max(1, text_len // 4)),
        _assistant_with_tools([f"c{idx}"]),
        _tool(f"c{idx}", "r" * text_len),
    ]


def _pair_turn(idx: int, text_len: int = 200) -> list[dict[str, Any]]:
    """一轮: 仅配对组(assistant+tool),用于精确控制组数。"""
    return [
        _assistant_with_tools([f"c{idx}"]),
        _tool(f"c{idx}", "r" * text_len),
    ]


def test_group_messages_pairs_assistant_with_tools() -> None:
    msgs = [
        _user("hi"),
        _assistant_with_tools(["c1", "c2"]),
        _tool("c1"),
        _tool("c2"),
        _user("next"),
    ]
    groups = group_messages(msgs)
    assert len(groups) == 3
    # assistant 与两条 tool 回复同组
    assert [m["role"] for m in groups[1]] == ["assistant", "tool", "tool"]


def test_budget_retains_all_when_roomy() -> None:
    msgs: list[dict[str, Any]] = []
    for i in range(3):
        msgs.extend(_turn(i, text_len=100))
    retained, stats = truncate_retained_messages(msgs)
    assert stats["groups_total"] == 6  # 3 组(每组3条,user/配对组)
    assert stats["groups_retained"] == 6
    assert retained == msgs


def test_tight_budget_drops_oldest_groups_whole() -> None:
    msgs: list[dict[str, Any]] = []
    for i in range(4):
        msgs.extend(_pair_turn(i, text_len=400))
    # 每配对组实测 ~217 token(纯配对组,user 已剥离);预算只够最新 1 组(217*2=434>400)
    retained, stats = truncate_retained_messages(
        msgs, max_tokens=400, image_budget=True
    )
    assert stats["groups_retained"] == 1
    assert stats["groups_total"] == 4
    # 保留的是最新的组(q3),不拆组:assistant 与 tool 同在
    roles = [m["role"] for m in retained]
    assert roles == ["assistant", "tool"]
    assert retained[1]["content"].startswith("r")


def test_image_budget_disabled_evicts_image_group() -> None:
    # 图片以字符串 content 内嵌 base64 形态存在(现有估算器对 vision list 的
    # image_url 不计费,仅字符串路径经 _estimate_text_with_image_placeholders
    # 计 IMAGE_TOKEN_PLACEHOLDER——故用字符串形态测开关差异)
    img_group: list[dict[str, Any]] = [
        _user("看这张图 " + BIG_IMAGE),
        {"role": "assistant", "content": "收到"},
    ]
    msgs: list[dict[str, Any]] = []
    for i in range(2):
        msgs.extend(_pair_turn(i, text_len=150))
    msgs.extend(img_group)
    msgs.extend(_pair_turn(9, text_len=150))

    # 实测:配对组(text_len=150)≈92 token/组;图片 user(Disabled)≈9、
    # (Enabled)≈1209;纯 assistant「收到」≈6。
    # Disabled + 预算 350:从新到旧 92+92+6+9=199 全部 5 组保留(含图片)。
    retained_off, stats_off = truncate_retained_messages(msgs, max_tokens=350, image_budget=False)
    assert stats_off["groups_retained"] == 5
    assert any(BIG_IMAGE in str(m.get("content")) for m in retained_off)

    # Enabled + 同预算:从新到旧累加 92(最新组)+6(「收到」)后剩余 252,
    # 图片 user 组(1209)装不下 → 该组及更旧全部淘汰,仅保留 2 组。
    retained_on, stats_on = truncate_retained_messages(msgs, max_tokens=350, image_budget=True)
    assert all(BIG_IMAGE not in str(m.get("content")) for m in retained_on)
    assert stats_on["groups_retained"] == 2
    assert stats_off["images_charged"] == 0 and stats_on["images_charged"] == 1


def test_oversized_agent_message_truncated() -> None:
    long_text = "长" * 20_000
    msgs = [_user("go"), {"role": "assistant", "content": long_text}]
    retained, stats = truncate_retained_messages(
        msgs, max_tokens=RETAINED_MESSAGE_TOKEN_BUDGET
    )
    assert stats["truncated_messages"] == 1
    trunc_content = retained[1]["content"]
    assert len(trunc_content) < len(long_text)
    # 截断后 assistant 消息不超上限(近似)
    assert len(trunc_content) <= MAX_RETAINED_AGENT_MESSAGE_TOKENS * 3 + 210


def test_select_retained_history_with_and_without_summary() -> None:
    msgs = _turn(0, text_len=100)
    pure = select_retained_history(msgs)
    assert pure == msgs
    with_summary = select_retained_history(msgs, summary="要点 A/B/C")
    assert with_summary[0]["role"] == "user"
    assert "[历史已压缩摘要]" in with_summary[0]["content"]
    assert with_summary[1:] == msgs
    # dict 形态摘要
    d = select_retained_history(msgs, summary={"text": "D"})
    assert "D" in d[0]["content"]


def test_empty_and_malformed_inputs() -> None:
    retained, stats = truncate_retained_messages([])
    assert retained == [] and stats["groups_total"] == 0
    # 非 dict/缺 role 不崩
    weird: list[dict[str, Any]] = [
        {"role": "user", "content": "ok"},
        {"content": "no-role"},  # type: ignore[dict-item]
        "raw-string",  # type: ignore[list-item]
    ]
    r2, s2 = truncate_retained_messages(weird)  # type: ignore[arg-type]
    assert isinstance(r2, list) and s2["groups_total"] >= 1


def test_estimate_group_tokens_image_switch() -> None:
    group = [{"role": "assistant", "content": f"前文 {BIG_IMAGE} 后文"}]
    with_img = estimate_group_tokens(group, charge_images=True)
    without_img = estimate_group_tokens(group, charge_images=False)
    assert with_img > without_img


def test_tool_reply_never_split_from_assistant() -> None:
    msgs = [_assistant_with_tools(["x1"]), _tool("x1", "y" * 3000)]
    retained, stats = truncate_retained_messages(msgs, max_tokens=2000)
    # 预算不够整组 → 该组整体淘汰,绝不出现 assistant 无 tool 的残组
    if stats["groups_retained"] == 0:
        assert retained == []
    else:
        assert [m["role"] for m in retained] == ["assistant", "tool"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
