# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""agents_md_state 测试(2026-09-20 第五十六批)。

覆盖:渲染模板逐字断言、REPLACEMENT/REMOVAL 通知字面、fragment dict 角色、
AgentsMdState 状态机五分支(首次注入/无变化/变更→REPLACEMENT/删除→REMOVAL/
首次空→None)、reset 后重注入。
"""

from __future__ import annotations

from app.core.agents_md_state import (
    AGENTS_MD_BODY_CLOSE,
    AGENTS_MD_BODY_OPEN,
    AGENTS_MD_OPEN_TAG,
    REMOVAL_NOTICE,
    REPLACEMENT_NOTICE,
    AgentsMdState,
    build_agents_md_fragment,
    build_agents_md_removal_fragment,
    build_agents_md_replacement_fragment,
    is_agents_md_fragment,
    render_agents_md_body,
)

# 逐字对齐 codex 源字面(防止回归漂移)。
_EXPECTED_REPLACEMENT = (
    "These AGENTS.md instructions replace all previously provided AGENTS.md instructions."
)
_EXPECTED_REMOVAL = "The previously provided AGENTS.md instructions no longer apply."


def test_replacement_notice_constant() -> None:
    assert REPLACEMENT_NOTICE == _EXPECTED_REPLACEMENT


def test_removal_notice_constant() -> None:
    assert REMOVAL_NOTICE == _EXPECTED_REMOVAL


def test_render_body_with_directory_exact() -> None:
    out = render_agents_md_body("/repo/workspace", "project rules")
    assert out == (
        "# AGENTS.md instructions for /repo/workspace\n\n"
        "<INSTRUCTIONS>\nproject rules\n</INSTRUCTIONS>"
    )


def test_render_body_without_directory_exact() -> None:
    out = render_agents_md_body(None, "Developer context")
    assert out == (
        "# AGENTS.md instructions\n\n<INSTRUCTIONS>\nDeveloper context\n</INSTRUCTIONS>"
    )


def test_render_body_empty_directory_omits_suffix() -> None:
    # 空串目录与 None 语义一致:不出 " for " 后缀。
    assert render_agents_md_body("", "x") == render_agents_md_body(None, "x")


def test_render_body_preserves_multiline_text() -> None:
    text = "line one\nline two\n"
    out = render_agents_md_body("dir", text)
    assert out == (
        "# AGENTS.md instructions for dir\n\n"
        "<INSTRUCTIONS>\nline one\nline two\n\n</INSTRUCTIONS>"
    )


def test_render_body_open_and_close_markers() -> None:
    out = render_agents_md_body(None, "body")
    assert out.startswith(AGENTS_MD_OPEN_TAG)
    assert AGENTS_MD_BODY_OPEN in out
    assert out.endswith(AGENTS_MD_BODY_CLOSE)


def test_build_fragment_role_and_shape() -> None:
    frag = build_agents_md_fragment("/repo", "rules")
    assert frag["type"] == "message"
    assert frag["role"] == "user"
    assert frag["content"][0]["type"] == "input_text"
    assert frag["content"][0]["text"] == render_agents_md_body("/repo", "rules")


def test_build_replacement_fragment_includes_notice_and_directory() -> None:
    frag = build_agents_md_replacement_fragment("/repo", "updated policy")
    text = frag["content"][0]["text"]
    assert text.startswith(f"{AGENTS_MD_OPEN_TAG} for /repo")
    assert text.startswith(f"# AGENTS.md instructions for /repo\n\n<INSTRUCTIONS>\n{REPLACEMENT_NOTICE}\n\nupdated policy\n</INSTRUCTIONS>")
    # 正文以 REPLACEMENT_NOTICE + 双换行开头(对齐 codex format!)。
    inner = text.split("<INSTRUCTIONS>\n", 1)[1].rsplit(f"\n{AGENTS_MD_BODY_CLOSE}", 1)[0]
    assert inner.startswith(f"{REPLACEMENT_NOTICE}\n\n")


def test_build_removal_fragment_exact() -> None:
    frag = build_agents_md_removal_fragment()
    text = frag["content"][0]["text"]
    assert text == render_agents_md_body(None, REMOVAL_NOTICE)
    assert REMOVAL_NOTICE in text
    # 删除通知不带目录后缀。
    assert " for " not in text.split("<INSTRUCTIONS>")[0]


def test_is_agents_md_fragment_detects() -> None:
    assert is_agents_md_fragment(render_agents_md_body("/d", "x"))
    assert is_agents_md_fragment("  # AGENTS.md instructions for d\n\n<INSTRUCTIONS>")
    assert not is_agents_md_fragment("regular user message")


def test_maybe_first_injection_returns_normal_fragment() -> None:
    state = AgentsMdState()
    frag = state.maybe_fragment("/repo", "rules")
    assert frag is not None
    assert frag["role"] == "user"
    text = frag["content"][0]["text"]
    # 首次注入不含 REPLACEMENT/REMOVAL 通知。
    assert REPLACEMENT_NOTICE not in text
    assert REMOVAL_NOTICE not in text
    assert text == render_agents_md_body("/repo", "rules")


def test_maybe_no_change_returns_none() -> None:
    state = AgentsMdState()
    assert state.maybe_fragment("/repo", "rules") is not None
    # 完全相同 → 不重复注入。
    assert state.maybe_fragment("/repo", "rules") is None


def test_maybe_change_returns_replacement() -> None:
    state = AgentsMdState()
    state.maybe_fragment("/repo", "v1")
    frag = state.maybe_fragment("/repo", "v2")
    assert frag is not None
    text = frag["content"][0]["text"]
    assert REPLACEMENT_NOTICE in text
    assert "v2" in text
    assert "v1" not in text.split("<INSTRUCTIONS>")[1]


def test_maybe_deletion_returns_removal() -> None:
    state = AgentsMdState()
    state.maybe_fragment("/repo", "rules")
    frag = state.maybe_fragment("/repo", None)
    assert frag is not None
    text = frag["content"][0]["text"]
    assert REMOVAL_NOTICE in text
    # 删除后无内容、无目录后缀。
    assert "rules" not in text
    assert " for " not in text.split("<INSTRUCTIONS>")[0]


def test_maybe_first_empty_returns_none() -> None:
    state = AgentsMdState()
    assert state.maybe_fragment(None, None) is None
    assert state.maybe_fragment("/repo", "") is None


def test_maybe_directory_change_triggers_replacement() -> None:
    state = AgentsMdState()
    state.maybe_fragment("/repo", "rules")
    frag = state.maybe_fragment("/other", "rules")
    # 目录变化也视为内容变更 → REPLACEMENT。
    assert frag is not None
    assert REPLACEMENT_NOTICE in frag["content"][0]["text"]


def test_reset_reinject_after_removal() -> None:
    state = AgentsMdState()
    state.maybe_fragment("/repo", "rules")
    # 删除。
    assert state.maybe_fragment("/repo", None) is not None
    # reset 后记忆清空,重新注入(同内容也应产出普通片段)。
    state.reset()
    frag = state.maybe_fragment("/repo", "rules")
    assert frag is not None
    assert REPLACEMENT_NOTICE not in frag["content"][0]["text"]


def test_reset_reinject_after_noop_reset() -> None:
    state = AgentsMdState()
    state.maybe_fragment("/repo", "rules")
    state.reset()
    # 重置后再给相同内容 → 视为首次注入(普通片段,非 None)。
    frag = state.maybe_fragment("/repo", "rules")
    assert frag is not None
    assert REMOVAL_NOTICE not in frag["content"][0]["text"]


def test_snapshot_reflects_current_state() -> None:
    state = AgentsMdState()
    state.maybe_fragment("/repo", "rules")
    snap = state.snapshot()
    assert snap == {"directory": "/repo", "text": "rules"}
    state.maybe_fragment("/repo", None)
    assert state.snapshot() == {"directory": None, "text": None}


def test_id_constant() -> None:
    assert AgentsMdState.ID == "agents_md"
