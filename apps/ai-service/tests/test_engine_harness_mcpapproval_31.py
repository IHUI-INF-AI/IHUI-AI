# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core/mcp_tool_approval.py 第三十一批测试(对标 Codex mcp_tool_call.rs 审批语义)。

from app.core.mcp_tool_approval import (
    MCP_TOOL_APPROVAL_ACCEPT,
    MCP_TOOL_APPROVAL_ACCEPT_AND_REMEMBER,
    MCP_TOOL_APPROVAL_ACCEPT_FOR_SESSION,
    AppToolApproval,
    ApprovalScope,
    McpToolApprovalCache,
    McpToolApprovalKey,
    McpToolApprovalPromptOptions,
    ToolAnnotations,
    requires_mcp_tool_approval,
    requires_mcp_tool_approval_for_mode,
)


class TestRequiresApproval:
    def test_none_annotations_conservative(self):
        # 全未知 → 未知 destructive || 未知 open_world → 需批
        assert requires_mcp_tool_approval(None) is True
        assert requires_mcp_tool_approval(ToolAnnotations()) is True

    def test_destructive_true_always_requires(self):
        ann = ToolAnnotations(read_only_hint=True, destructive_hint=True)
        assert requires_mcp_tool_approval(ann) is True

    def test_read_only_true_skips(self):
        ann = ToolAnnotations(read_only_hint=True, destructive_hint=False, open_world_hint=True)
        assert requires_mcp_tool_approval(ann) is False

    def test_unknown_destructive_requires_even_if_open_world_false(self):
        ann = ToolAnnotations(read_only_hint=False, destructive_hint=None, open_world_hint=False)
        assert requires_mcp_tool_approval(ann) is True

    def test_known_safe_pair_skips(self):
        ann = ToolAnnotations(read_only_hint=False, destructive_hint=False, open_world_hint=False)
        assert requires_mcp_tool_approval(ann) is False

    def test_mode_prompt_always_requires(self):
        ann = ToolAnnotations(read_only_hint=True)
        assert requires_mcp_tool_approval_for_mode(ann, AppToolApproval.PROMPT) is True

    def test_mode_approve_never_requires(self):
        ann = ToolAnnotations(destructive_hint=True)
        assert requires_mcp_tool_approval_for_mode(ann, AppToolApproval.APPROVE) is False

    def test_mode_writes_only_read_only_skips(self):
        ro = ToolAnnotations(read_only_hint=True)
        rw = ToolAnnotations(read_only_hint=False)
        unk = ToolAnnotations()
        assert requires_mcp_tool_approval_for_mode(ro, AppToolApproval.WRITES) is False
        assert requires_mcp_tool_approval_for_mode(rw, AppToolApproval.WRITES) is True
        assert requires_mcp_tool_approval_for_mode(unk, AppToolApproval.WRITES) is True

    def test_mode_auto_delegates(self):
        ann = ToolAnnotations(read_only_hint=True)
        assert requires_mcp_tool_approval_for_mode(ann, AppToolApproval.AUTO) is False
        assert requires_mcp_tool_approval_for_mode(None, AppToolApproval.AUTO) is True


class TestApprovalKeyAndCache:
    def test_key_dimensions(self):
        a = McpToolApprovalKey(server="s1", tool_name="t")
        b = McpToolApprovalKey(server="s1", tool_name="t", plugin_id="p")
        c = McpToolApprovalKey(server="s2", tool_name="t")
        assert len({a, b, c}) == 3

    def test_cache_scope_precedence(self):
        cache = McpToolApprovalCache()
        key = McpToolApprovalKey(server="s", tool_name="t")
        assert cache.lookup(key) is ApprovalScope.ONCE
        cache.remember(key, ApprovalScope.SESSION)
        assert cache.lookup(key) is ApprovalScope.SESSION
        cache.remember(key, ApprovalScope.PERSISTENT)
        assert cache.lookup(key) is ApprovalScope.PERSISTENT
        # 持久授予不被会话授予覆盖
        cache.remember(key, ApprovalScope.SESSION)
        assert cache.lookup(key) is ApprovalScope.PERSISTENT

    def test_once_grant_revokes(self):
        cache = McpToolApprovalCache()
        key = McpToolApprovalKey(server="s", tool_name="t")
        cache.remember(key, ApprovalScope.SESSION)
        cache.remember(key, ApprovalScope.ONCE)  # 用户显式"仅本次"→清除授予
        assert cache.lookup(key) is ApprovalScope.ONCE

    def test_clear_session_keeps_persistent(self):
        cache = McpToolApprovalCache()
        k1 = McpToolApprovalKey(server="s", tool_name="t1")
        k2 = McpToolApprovalKey(server="s", tool_name="t2")
        cache.remember(k1, ApprovalScope.SESSION)
        cache.remember(k2, ApprovalScope.PERSISTENT)
        cache.clear_session()
        assert cache.lookup(k1) is ApprovalScope.ONCE
        assert cache.lookup(k2) is ApprovalScope.PERSISTENT


class TestPromptOptions:
    def test_persistent_gated_by_elicitation(self):
        opts = McpToolApprovalPromptOptions.build(True, True, False)
        assert opts.allow_session_remember is True
        assert opts.allow_persistent_approval is False
        opts2 = McpToolApprovalPromptOptions.build(True, True, True)
        assert opts2.allow_persistent_approval is True

    def test_constants_match_codex(self):
        assert MCP_TOOL_APPROVAL_ACCEPT == "Allow"
        assert MCP_TOOL_APPROVAL_ACCEPT_FOR_SESSION == "Allow for this session"
        assert MCP_TOOL_APPROVAL_ACCEPT_AND_REMEMBER == "Allow and don't ask me again"
