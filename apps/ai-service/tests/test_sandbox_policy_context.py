# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""模型可见文件沙箱策略块单测(对齐 DSH `dsh-sandbox-policy`)。"""

from __future__ import annotations

from app.core.sandbox_policy_context import (
    SANDBOX_POLICY_CLOSE,
    SANDBOX_POLICY_OPEN,
    inject_sandbox_policy_context,
    render_sandbox_policy_context,
)
from app.services.agent_loop_v2 import AgentLoopV2


def test_read_only_policy_text() -> None:
    block = render_sandbox_policy_context("plan", "/repo", ())
    assert block.startswith(SANDBOX_POLICY_OPEN)
    assert block.endswith(SANDBOX_POLICY_CLOSE)
    assert "只读" in block
    assert "/repo" not in block


def test_workspace_write_names_workspace_and_extra_roots() -> None:
    block = render_sandbox_policy_context(
        "acceptEdits", "/repo", ("/repo/.git", "/tmp/shared")
    )
    assert "工作区写入" in block
    assert '"/repo"' in block
    assert '"/repo/.git"' in block
    assert '"/tmp/shared"' in block


def test_bypass_permissions_is_danger_full_access() -> None:
    block = render_sandbox_policy_context("bypassPermissions", "/repo")
    assert "完全访问" in block
    assert "工作区写入" not in block


def test_no_workspace_renders_nothing() -> None:
    assert render_sandbox_policy_context("default", None) == ""
    assert render_sandbox_policy_context("default", "   ") == ""


def test_inject_into_system_and_idempotent() -> None:
    messages: list[dict[str, object]] = [
        {"role": "system", "content": "你是助手"},
        {"role": "user", "content": "hi"},
    ]
    block = render_sandbox_policy_context("default", "/repo")
    assert inject_sandbox_policy_context(messages, block) is True
    assert block in str(messages[0]["content"])
    assert inject_sandbox_policy_context(messages, block) is False
    assert str(messages[0]["content"]).count(SANDBOX_POLICY_OPEN) == 1


def test_inject_replaces_stale_policy_block() -> None:
    old = render_sandbox_policy_context("plan", "/repo")
    new = render_sandbox_policy_context("acceptEdits", "/repo2")
    messages: list[dict[str, object]] = [
        {"role": "system", "content": f"规则\n\n{old}"},
        {"role": "user", "content": "hi"},
    ]
    assert inject_sandbox_policy_context(messages, new) is True
    content = str(messages[0]["content"])
    assert "规则" in content
    assert new in content
    assert old not in content
    assert content.count(SANDBOX_POLICY_OPEN) == 1


def test_agent_loop_method_injects_current_policy() -> None:
    async def _llm(messages, tools):
        return {"content": "ok", "tool_calls": None}

    loop = AgentLoopV2(
        _llm,
        [],
        workspace="/repo",
        permission_mode="plan",
        enable_checkpoint=False,
        enable_memory=False,
        approval_enabled=False,
    )
    messages: list[dict[str, object]] = [{"role": "system", "content": "你是助手"}]
    loop._inject_sandbox_policy_context(messages)  # noqa: SLF001 - 直接验证接线
    assert "只读" in str(messages[0]["content"])
    assert SANDBOX_POLICY_OPEN in str(messages[0]["content"])
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
