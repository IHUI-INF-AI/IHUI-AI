# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core/mcp_tool_approval.py
"""MCP 工具审批判定与审批缓存(2026-09-19 第三十一批,对标 Codex mcp_tool_call.rs)。

两个可移植内核:

1. **注解 × 模式审批判定**(requires_mcp_tool_approval_for_mode 逐行移植):

   - ``auto``:按 MCP 注解保守推断——destructiveHint=True 必批;
     read_onlyHint=True 免批;**注解缺省时按最坏情况处理**
     (未知 destructive || 未知 open_world → 需批),绝不因元数据缺失放行;
   - ``prompt``:恒需批;
   - ``writes``:仅 read_onlyHint=True 的工具免批;
   - ``approve``:策略已批准,恒免批(上层已批)。

2. **审批缓存键与作用域**(McpToolApprovalKey / 审批选项):

   - 键 = (server, tool_name, plugin_id, connector_id, link_id),
     任一维度不同即不同审批对象;
   - 三个用户选项文案与语义对应 Codex 原文:Allow(本次)/
     Allow for this session(会话内)/ Allow and don't ask me again
     (持久,受 allow_persistent_approval 门控);
   - 缓存判定:持久 > 会话 > 无;会话缓存随实例生命周期(引擎内即线程)。

判定为"需要审批"后是否真的弹窗,由调用方叠加 approval_policy 与
strict_auto_review(本模块保持纯函数,与 Codex 分层一致)。
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class AppToolApproval(StrEnum):
    """工具审批模式(对标 AppToolApproval)。"""

    AUTO = "auto"
    PROMPT = "prompt"
    WRITES = "writes"
    APPROVE = "approve"


@dataclass(frozen=True)
class ToolAnnotations:
    """MCP 工具注解(缺省 None = 未知,按保守语义处理)。"""

    read_only_hint: bool | None = None
    destructive_hint: bool | None = None
    open_world_hint: bool | None = None


# 审批选项文案(Codex 常量原文)
MCP_TOOL_APPROVAL_QUESTION_ID_PREFIX = "mcp_tool_call_approval"
MCP_TOOL_APPROVAL_ACCEPT = "Allow"
MCP_TOOL_APPROVAL_ACCEPT_FOR_SESSION = "Allow for this session"
MCP_TOOL_APPROVAL_ACCEPT_AND_REMEMBER = "Allow and don't ask me again"
MCP_TOOL_APPROVAL_CANCEL = "Cancel"


def requires_mcp_tool_approval(annotations: ToolAnnotations | None) -> bool:
    """auto 模式下的注解推断(逐行对应 requires_mcp_tool_approval)。"""
    if annotations is None:
        # 全未知:destructive 缺省按 True、open_world 缺省按 True → 需批
        return True
    if annotations.destructive_hint is True:
        return True
    read_only = annotations.read_only_hint is True
    if read_only:
        return False
    destructive_unknown_or_true = annotations.destructive_hint is not False
    open_world_unknown_or_true = annotations.open_world_hint is not False
    return destructive_unknown_or_true or open_world_unknown_or_true


def requires_mcp_tool_approval_for_mode(
    annotations: ToolAnnotations | None,
    approval_mode: AppToolApproval,
) -> bool:
    """模式 × 注解 → 是否需要审批(逐行对应 requires_mcp_tool_approval_for_mode)。"""
    if approval_mode is AppToolApproval.AUTO:
        return requires_mcp_tool_approval(annotations)
    if approval_mode is AppToolApproval.PROMPT:
        return True
    if approval_mode is AppToolApproval.WRITES:
        return not (annotations is not None and annotations.read_only_hint is True)
    # APPROVE:上层已批
    return False


@dataclass(frozen=True)
class McpToolApprovalKey:
    """审批缓存键(对标 McpToolApprovalKey,任一维度不同即不同对象)。"""

    server: str
    tool_name: str
    plugin_id: str | None = None
    connector_id: str | None = None
    link_id: str | None = None


class ApprovalScope(StrEnum):
    ONCE = "once"
    SESSION = "session"
    PERSISTENT = "persistent"


@dataclass(frozen=True)
class McpToolApprovalPromptOptions:
    """审批弹窗选项可用性(对标 McpToolApprovalPromptOptions)。"""

    allow_session_remember: bool = True
    allow_persistent_approval: bool = False

    @classmethod
    def build(
        cls,
        allow_session_remember: bool,
        allow_persistent_approval: bool,
        tool_call_elicitation_enabled: bool,
    ) -> McpToolApprovalPromptOptions:
        """持久选项受 elicitation 能力门控(Codex 同款 && 语义)。"""
        return cls(
            allow_session_remember=allow_session_remember,
            allow_persistent_approval=tool_call_elicitation_enabled and allow_persistent_approval,
        )


class McpToolApprovalCache:
    """会话内审批缓存:持久授予 > 会话授予 > 未授予。"""

    def __init__(self) -> None:
        self._session_grants: dict[McpToolApprovalKey, ApprovalScope] = {}
        self._persistent_grants: set[McpToolApprovalKey] = set()

    def lookup(self, key: McpToolApprovalKey) -> ApprovalScope:
        if key in self._persistent_grants:
            return ApprovalScope.PERSISTENT
        scope = self._session_grants.get(key)
        return scope if scope is not None else ApprovalScope.ONCE

    def remember(self, key: McpToolApprovalKey, scope: ApprovalScope) -> None:
        if scope is ApprovalScope.ONCE:
            self._session_grants.pop(key, None)
            self._persistent_grants.discard(key)
            return
        if scope is ApprovalScope.PERSISTENT:
            self._persistent_grants.add(key)
            self._session_grants.pop(key, None)
            return
        if key not in self._persistent_grants:
            self._session_grants[key] = ApprovalScope.SESSION

    def clear_session(self) -> None:
        """清会话级授予(持久授予跨会话保留)。"""
        self._session_grants.clear()

    def clear_all(self) -> None:
        self._session_grants.clear()
        self._persistent_grants.clear()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
