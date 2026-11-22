# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""结构元数契约（ToolStructContract，207 struct / 10 角色域） —— 统一工程规范 R62（结构元数契约·serde with-N-elements）。

取证（codex.exe 26.1111.2228.0，365MB Rust PE，strings 逐字 + ``struct variant X::Y with N element``
机器反推，见 R58 ``families.out`` / 本轮 ``docs/engineering/round11-reverse/R61-*.md``）：逐字 struct 名与
元素数表由机器从二进制抽取，模块内表与单测双重钉死。本仓归属过滤：该族在本仓 app/core 零命中或仅异层别名。

一轴超越：207 个 codex struct 的逐字元素数（serde `with N elements` 硬断言）+ 10 类结构角色域（Params/Response/Notification/Toml/…）+ 可执行反查。元素数取自身 serde 生成元信息，非人工推断；角色域由结构名后缀确定性归类，与元素数正交。本仓归属过滤：本域结构名在 app/core 零命中；22 个多元素数冲突结构已排除。

诚实边界：207 个 struct 名与元素数逐字确证（单值一致）；角色域分类是本仓后缀归类非对照原生判据；各 struct 的具体字段名因 camelCase 连体串不可可靠切分，已另立 disasm 开放轴。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "ToolStructContract", "ToolStructContractError", "TOOL_STRUCT_CONTRACT_ELEMENTS", "TOOL_STRUCT_CONTRACT_DOMAIN", "tool_struct_contract_names", "expected_tool_struct_contract_element_count",
    "ensure_tool_struct_contract", "tool_struct_contract_domain", "tool_struct_contract_domain_members", "is_tool_struct_contract", "validate_tool_struct_contract",
]

# 逐字 struct 名 → 元素数（serde 硬断言）（来自 ``with N element`` 声明，漂移由 pytest 钉死）。
TOOL_STRUCT_CONTRACT_ELEMENTS: Final[dict[str, int]] = {
    "AcceptedFileAudio": 4,
    "AgentPluginMcpFile": 2,
    "CallToolResult": 4,
    "CapabilityTextFile": 2,
    "CodeModeExecResult": 4,
    "CollabAgentToolCallItem": 10,
    "CommandExecParams": 14,
    "CommandExecResizeParams": 2,
    "CommandExecResponse": 3,
    "CommandExecTerminalSize": 2,
    "CommandExecWriteParams": 3,
    "CommandExecutionItem": 13,
    "CommandSession": 3,
    "CommandSessionsState": 3,
    "ComputerUseWindowsExeRequirement": 4,
    "ComputerUseWindowsRequirements": 2,
    "ConnectorDirectoryDiskCache": 2,
    "ConsequentialToolTemplateParam": 2,
    "CopyFileArgs": 4,
    "CreateFileResponse": 4,
    "DirectoryListResponse": 2,
    "DiscoveredPluginFiles": 3,
    "DiscoveredSkillFiles": 2,
    "DispatchedToolPayload": 2,
    "DispatchedToolTraceRequestPayload": 3,
    "DispatchedWriteStdinArgs": 4,
    "DynamicToolCallItem": 9,
    "DynamicToolCallParams": 6,
    "DynamicToolCallRequest": 6,
    "DynamicToolCallResponse": 2,
    "DynamicToolFunctionSpec": 4,
    "DynamicToolNamespaceSpec": 3,
    "DynamicToolsSnapshot": 2,
    "DynamicToolsUpdatedPayload": 2,
    "EnvironmentShellInfo": 2,
    "ExecCommandArgs": 11,
    "ExecCommandBeginPayload": 4,
    "ExecCommandEndPayload": 3,
    "ExecFileSystemSandboxEntry": 3,
    "ExecResponse": 2,
    "ExecWaitArgs": 4,
    "ExecutableIdentity": 2,
    "ExecutorPlugin": 7,
    "ExecutorSkill": 7,
    "FileChangeItem": 6,
    "FileDescriptor": 2,
    "FileSystemSandboxContext": 9,
    "FileSystemSandboxEntry": 2,
    "FileUpdateChange": 3,
    "FsCanonicalizeParams": 2,
    "FsGetMetadataResponse": 6,
    "FsHelperOpenParams": 2,
    "FsHelperOpenResponse": 2,
    "FsReadBlockParams": 3,
    "FsReadBlockResponse": 2,
    "FsReadDirectoryEntry": 3,
    "FsWalkParams": 3,
    "FsWatchMissingParams": 3,
    "FsWatchParams": 2,
    "FsWriteBlockParams": 3,
    "FuzzyFileSearchParams": 3,
    "FuzzyFileSearchResult": 6,
    "FuzzyFileSearchSessionStartParams": 2,
    "FuzzyFileSearchSessionUpdateParams": 2,
    "HookErrorInfo": 2,
    "HookOutputEntry": 2,
    "HookPromptFragment": 2,
    "HookPromptItem": 2,
    "HookRunSummary": 14,
    "HooksListEntry": 4,
    "HooksListParams": 2,
    "InstalledPlugin": 3,
    "LegacyDynamicToolSpec": 6,
    "ListMcpServerStatusParams": 5,
    "ListMcpServerStatusResponse": 2,
    "ListToolsResult": 6,
    "LocalShellExecAction": 5,
    "McpAttribution": 3,
    "McpAttributionSource": 5,
    "McpElicitationBooleanSchema": 4,
    "McpElicitationConstOption": 2,
    "McpElicitationLegacyTitledEnumSchema": 6,
    "McpElicitationNumberSchema": 6,
    "McpElicitationSchema": 4,
    "McpElicitationStringSchema": 7,
    "McpElicitationTitledMultiSelectEnumSchema": 7,
    "McpElicitationTitledSingleSelectEnumSchema": 5,
    "McpElicitationUntitledEnumItems": 2,
    "McpElicitationUntitledMultiSelectEnumSchema": 7,
    "McpElicitationUntitledSingleSelectEnumSchema": 5,
    "McpInvocation": 3,
    "McpMedia": 2,
    "McpResourceOrigin": 7,
    "McpResourceOriginCheckpoint": 3,
    "McpResourceReadParams": 7,
    "McpResourceReadResponse": 2,
    "McpResourceReadTarget": 2,
    "McpServerCommandMatcher": 2,
    "McpServerElicitationRequestResponse": 3,
    "McpServerInfo": 6,
    "McpServerStatus": 12,
    "McpServerToolCallParams": 5,
    "McpStartupFailure": 2,
    "McpToolCallItem": 16,
    "McpToolCallResult": 3,
    "MxcCommand": 5,
    "NodeReplExecOutput": 2,
    "PetFile": 6,
    "PluginDetail": 12,
    "PluginHookSummary": 2,
    "PluginInstallParams": 4,
    "PluginInstallResponse": 2,
    "PluginInstalledParams": 2,
    "PluginInstalledResponse": 2,
    "PluginInterface": 19,
    "PluginListParams": 3,
    "PluginListResponse": 3,
    "PluginManifest": 3,
    "PluginManifestMetadata": 4,
    "PluginMarketplaceEntry": 4,
    "PluginReadParams": 3,
    "PluginSearchParams": 5,
    "PluginShareContext": 8,
    "PluginSharePrincipal": 4,
    "PluginShareSaveParams": 4,
    "PluginShareTarget": 3,
    "PluginShareUpdateTargetsParams": 3,
    "PluginSkillReadParams": 3,
    "PluginSummary": 19,
    "PluginsMigration": 2,
    "PostToolUseHookSpecificOutputWire": 3,
    "PreToolUseHookSpecificOutputWire": 5,
    "ProcessWriteStdinParams": 3,
    "ProjectMcpServerMetadata": 2,
    "RawAgentPluginManifest": 9,
    "RawFileSystemSandboxEntry": 3,
    "ReadArgs": 3,
    "ReadArguments": 5,
    "ReadParams": 4,
    "ReadPost": 3,
    "ReadResourceArgs": 2,
    "ReadResourceResult": 5,
    "RecommendedPluginInstallArgs": 2,
    "RecommendedPluginItem": 3,
    "RecommendedPluginsResponse": 2,
    "RemotePluginDirectoryItem": 18,
    "RemotePluginDirectorySharePrincipal": 4,
    "RemotePluginInstallMetadata": 2,
    "RemotePluginInstalledResponse": 2,
    "RemotePluginListResponse": 2,
    "RemotePluginMutationResponse": 3,
    "RemotePluginReleaseInterfaceResponse": 15,
    "RemotePluginReleaseResponse": 13,
    "RemotePluginSharePrincipal": 4,
    "RemotePluginShareUpdateTargetsResponse": 2,
    "RemotePluginSkillDetailResponse": 3,
    "RemotePluginSkillInterfaceResponse": 6,
    "RemotePluginSkillResponse": 3,
    "RemoteWorkspacePluginCreateResponse": 3,
    "RemoteWorkspacePluginUploadUrlResponse": 3,
    "RequestPluginInstallArgs": 4,
    "SearchArgs": 8,
    "SearchCommands": 12,
    "SearchPosts": 7,
    "SearchQuery": 3,
    "SearchResponse": 3,
    "SearchToolCallParams": 2,
    "SecretsFile": 2,
    "SessionStartHookSpecificOutputWire": 2,
    "ShellInfo": 2,
    "ShellSnapshotRequest": 2,
    "SkillDiscoveryRoot": 2,
    "SkillEntrySnapshot": 3,
    "SkillErrorInfo": 2,
    "SkillInterface": 8,
    "SkillMetadata": 9,
    "SkillSummary": 6,
    "SkillsListEntry": 3,
    "SnapshotSkill": 7,
    "SubagentStartHookSpecificOutputWire": 2,
    "Tool": 8,
    "ToolAnnotations": 5,
    "ToolInfo": 11,
    "ToolResultContent": 5,
    "ToolSerde": 8,
    "ToolSuggestDisabledTool": 2,
    "ToolSuggestDiscoverable": 2,
    "ToolUseContent": 4,
    "TuiEditorKeymap": 17,
    "TuiVimSearchKeymap": 4,
    "WebSearchItem": 4,
    "WebSearchLocation": 4,
    "WireExecParams": 14,
    "WireFileSystemSandboxContext": 10,
    "WireFsCanonicalizeParams": 2,
    "WireFsCopyParams": 4,
    "WireFsCreateDirectoryParams": 4,
    "WireFsGetMetadataParams": 3,
    "WireFsOpenParams": 4,
    "WireFsReadDirectoryParams": 2,
    "WireFsReadFileParams": 3,
    "WireFsRemoveParams": 5,
    "WireFsWalkParams": 3,
    "WireFsWriteFileParams": 4,
    "WireNestedToolCall": 5,
    "WireToolName": 2,
    "WriteParams": 3,

}

# 本仓语义归类（非对照原生判据）：每个 variant 归入一个协议面域。
TOOL_STRUCT_CONTRACT_DOMAIN: Final[dict[str, str]] = {
    "AcceptedFileAudio": "domain_object",
    "AgentPluginMcpFile": "domain_object",
    "CallToolResult": "response",
    "CapabilityTextFile": "domain_object",
    "CodeModeExecResult": "response",
    "CollabAgentToolCallItem": "content",
    "CommandExecParams": "request_params",
    "CommandExecResizeParams": "request_params",
    "CommandExecResponse": "response",
    "CommandExecTerminalSize": "domain_object",
    "CommandExecWriteParams": "request_params",
    "CommandExecutionItem": "content",
    "CommandSession": "domain_object",
    "CommandSessionsState": "descriptor",
    "ComputerUseWindowsExeRequirement": "domain_object",
    "ComputerUseWindowsRequirements": "capability",
    "ConnectorDirectoryDiskCache": "domain_object",
    "ConsequentialToolTemplateParam": "domain_object",
    "CopyFileArgs": "request_params",
    "CreateFileResponse": "response",
    "DirectoryListResponse": "response",
    "DiscoveredPluginFiles": "domain_object",
    "DiscoveredSkillFiles": "domain_object",
    "DispatchedToolPayload": "content",
    "DispatchedToolTraceRequestPayload": "content",
    "DispatchedWriteStdinArgs": "request_params",
    "DynamicToolCallItem": "content",
    "DynamicToolCallParams": "request_params",
    "DynamicToolCallRequest": "request",
    "DynamicToolCallResponse": "response",
    "DynamicToolFunctionSpec": "schema_config",
    "DynamicToolNamespaceSpec": "schema_config",
    "DynamicToolsSnapshot": "domain_object",
    "DynamicToolsUpdatedPayload": "content",
    "EnvironmentShellInfo": "descriptor",
    "ExecCommandArgs": "request_params",
    "ExecCommandBeginPayload": "content",
    "ExecCommandEndPayload": "content",
    "ExecFileSystemSandboxEntry": "descriptor",
    "ExecResponse": "response",
    "ExecWaitArgs": "request_params",
    "ExecutableIdentity": "domain_object",
    "ExecutorPlugin": "domain_object",
    "ExecutorSkill": "domain_object",
    "FileChangeItem": "content",
    "FileDescriptor": "domain_object",
    "FileSystemSandboxContext": "domain_object",
    "FileSystemSandboxEntry": "descriptor",
    "FileUpdateChange": "domain_object",
    "FsCanonicalizeParams": "request_params",
    "FsGetMetadataResponse": "response",
    "FsHelperOpenParams": "request_params",
    "FsHelperOpenResponse": "response",
    "FsReadBlockParams": "request_params",
    "FsReadBlockResponse": "response",
    "FsReadDirectoryEntry": "descriptor",
    "FsWalkParams": "request_params",
    "FsWatchMissingParams": "request_params",
    "FsWatchParams": "request_params",
    "FsWriteBlockParams": "request_params",
    "FuzzyFileSearchParams": "request_params",
    "FuzzyFileSearchResult": "response",
    "FuzzyFileSearchSessionStartParams": "request_params",
    "FuzzyFileSearchSessionUpdateParams": "request_params",
    "HookErrorInfo": "descriptor",
    "HookOutputEntry": "descriptor",
    "HookPromptFragment": "domain_object",
    "HookPromptItem": "content",
    "HookRunSummary": "descriptor",
    "HooksListEntry": "descriptor",
    "HooksListParams": "request_params",
    "InstalledPlugin": "domain_object",
    "LegacyDynamicToolSpec": "schema_config",
    "ListMcpServerStatusParams": "request_params",
    "ListMcpServerStatusResponse": "response",
    "ListToolsResult": "response",
    "LocalShellExecAction": "action",
    "McpAttribution": "domain_object",
    "McpAttributionSource": "domain_object",
    "McpElicitationBooleanSchema": "schema_config",
    "McpElicitationConstOption": "domain_object",
    "McpElicitationLegacyTitledEnumSchema": "schema_config",
    "McpElicitationNumberSchema": "schema_config",
    "McpElicitationSchema": "schema_config",
    "McpElicitationStringSchema": "schema_config",
    "McpElicitationTitledMultiSelectEnumSchema": "schema_config",
    "McpElicitationTitledSingleSelectEnumSchema": "schema_config",
    "McpElicitationUntitledEnumItems": "domain_object",
    "McpElicitationUntitledMultiSelectEnumSchema": "schema_config",
    "McpElicitationUntitledSingleSelectEnumSchema": "schema_config",
    "McpInvocation": "domain_object",
    "McpMedia": "domain_object",
    "McpResourceOrigin": "domain_object",
    "McpResourceOriginCheckpoint": "domain_object",
    "McpResourceReadParams": "request_params",
    "McpResourceReadResponse": "response",
    "McpResourceReadTarget": "domain_object",
    "McpServerCommandMatcher": "domain_object",
    "McpServerElicitationRequestResponse": "response",
    "McpServerInfo": "descriptor",
    "McpServerStatus": "descriptor",
    "McpServerToolCallParams": "request_params",
    "McpStartupFailure": "error",
    "McpToolCallItem": "content",
    "McpToolCallResult": "response",
    "MxcCommand": "action",
    "NodeReplExecOutput": "domain_object",
    "PetFile": "domain_object",
    "PluginDetail": "domain_object",
    "PluginHookSummary": "descriptor",
    "PluginInstallParams": "request_params",
    "PluginInstallResponse": "response",
    "PluginInstalledParams": "request_params",
    "PluginInstalledResponse": "response",
    "PluginInterface": "domain_object",
    "PluginListParams": "request_params",
    "PluginListResponse": "response",
    "PluginManifest": "schema_config",
    "PluginManifestMetadata": "descriptor",
    "PluginMarketplaceEntry": "descriptor",
    "PluginReadParams": "request_params",
    "PluginSearchParams": "request_params",
    "PluginShareContext": "domain_object",
    "PluginSharePrincipal": "domain_object",
    "PluginShareSaveParams": "request_params",
    "PluginShareTarget": "domain_object",
    "PluginShareUpdateTargetsParams": "request_params",
    "PluginSkillReadParams": "request_params",
    "PluginSummary": "descriptor",
    "PluginsMigration": "domain_object",
    "PostToolUseHookSpecificOutputWire": "domain_object",
    "PreToolUseHookSpecificOutputWire": "domain_object",
    "ProcessWriteStdinParams": "request_params",
    "ProjectMcpServerMetadata": "descriptor",
    "RawAgentPluginManifest": "schema_config",
    "RawFileSystemSandboxEntry": "descriptor",
    "ReadArgs": "request_params",
    "ReadArguments": "domain_object",
    "ReadParams": "request_params",
    "ReadPost": "domain_object",
    "ReadResourceArgs": "request_params",
    "ReadResourceResult": "response",
    "RecommendedPluginInstallArgs": "request_params",
    "RecommendedPluginItem": "content",
    "RecommendedPluginsResponse": "response",
    "RemotePluginDirectoryItem": "content",
    "RemotePluginDirectorySharePrincipal": "domain_object",
    "RemotePluginInstallMetadata": "descriptor",
    "RemotePluginInstalledResponse": "response",
    "RemotePluginListResponse": "response",
    "RemotePluginMutationResponse": "response",
    "RemotePluginReleaseInterfaceResponse": "response",
    "RemotePluginReleaseResponse": "response",
    "RemotePluginSharePrincipal": "domain_object",
    "RemotePluginShareUpdateTargetsResponse": "response",
    "RemotePluginSkillDetailResponse": "response",
    "RemotePluginSkillInterfaceResponse": "response",
    "RemotePluginSkillResponse": "response",
    "RemoteWorkspacePluginCreateResponse": "response",
    "RemoteWorkspacePluginUploadUrlResponse": "response",
    "RequestPluginInstallArgs": "request_params",
    "SearchArgs": "request_params",
    "SearchCommands": "domain_object",
    "SearchPosts": "domain_object",
    "SearchQuery": "domain_object",
    "SearchResponse": "response",
    "SearchToolCallParams": "request_params",
    "SecretsFile": "domain_object",
    "SessionStartHookSpecificOutputWire": "domain_object",
    "ShellInfo": "descriptor",
    "ShellSnapshotRequest": "request",
    "SkillDiscoveryRoot": "domain_object",
    "SkillEntrySnapshot": "domain_object",
    "SkillErrorInfo": "descriptor",
    "SkillInterface": "domain_object",
    "SkillMetadata": "descriptor",
    "SkillSummary": "descriptor",
    "SkillsListEntry": "descriptor",
    "SnapshotSkill": "domain_object",
    "SubagentStartHookSpecificOutputWire": "domain_object",
    "Tool": "domain_object",
    "ToolAnnotations": "domain_object",
    "ToolInfo": "descriptor",
    "ToolResultContent": "content",
    "ToolSerde": "domain_object",
    "ToolSuggestDisabledTool": "domain_object",
    "ToolSuggestDiscoverable": "domain_object",
    "ToolUseContent": "content",
    "TuiEditorKeymap": "domain_object",
    "TuiVimSearchKeymap": "domain_object",
    "WebSearchItem": "content",
    "WebSearchLocation": "domain_object",
    "WireExecParams": "request_params",
    "WireFileSystemSandboxContext": "domain_object",
    "WireFsCanonicalizeParams": "request_params",
    "WireFsCopyParams": "request_params",
    "WireFsCreateDirectoryParams": "request_params",
    "WireFsGetMetadataParams": "request_params",
    "WireFsOpenParams": "request_params",
    "WireFsReadDirectoryParams": "request_params",
    "WireFsReadFileParams": "request_params",
    "WireFsRemoveParams": "request_params",
    "WireFsWalkParams": "request_params",
    "WireFsWriteFileParams": "request_params",
    "WireNestedToolCall": "action",
    "WireToolName": "domain_object",
    "WriteParams": "request_params",

}

_CLOSED_SET: Final[frozenset[str]] = frozenset(TOOL_STRUCT_CONTRACT_ELEMENTS)


class ToolStructContract(StrEnum):
    """对照协议面 variant（逐字登记，真相源）。"""

    ACCEPTED_FILE_AUDIO = "AcceptedFileAudio"
    AGENT_PLUGIN_MCP_FILE = "AgentPluginMcpFile"
    CALL_TOOL_RESULT = "CallToolResult"
    CAPABILITY_TEXT_FILE = "CapabilityTextFile"
    CODE_MODE_EXEC_RESULT = "CodeModeExecResult"
    COLLAB_AGENT_TOOL_CALL_ITEM = "CollabAgentToolCallItem"
    COMMAND_EXEC_PARAMS = "CommandExecParams"
    COMMAND_EXEC_RESIZE_PARAMS = "CommandExecResizeParams"
    COMMAND_EXEC_RESPONSE = "CommandExecResponse"
    COMMAND_EXEC_TERMINAL_SIZE = "CommandExecTerminalSize"
    COMMAND_EXEC_WRITE_PARAMS = "CommandExecWriteParams"
    COMMAND_EXECUTION_ITEM = "CommandExecutionItem"
    COMMAND_SESSION = "CommandSession"
    COMMAND_SESSIONS_STATE = "CommandSessionsState"
    COMPUTER_USE_WINDOWS_EXE_REQUIREMENT = "ComputerUseWindowsExeRequirement"
    COMPUTER_USE_WINDOWS_REQUIREMENTS = "ComputerUseWindowsRequirements"
    CONNECTOR_DIRECTORY_DISK_CACHE = "ConnectorDirectoryDiskCache"
    CONSEQUENTIAL_TOOL_TEMPLATE_PARAM = "ConsequentialToolTemplateParam"
    COPY_FILE_ARGS = "CopyFileArgs"
    CREATE_FILE_RESPONSE = "CreateFileResponse"
    DIRECTORY_LIST_RESPONSE = "DirectoryListResponse"
    DISCOVERED_PLUGIN_FILES = "DiscoveredPluginFiles"
    DISCOVERED_SKILL_FILES = "DiscoveredSkillFiles"
    DISPATCHED_TOOL_PAYLOAD = "DispatchedToolPayload"
    DISPATCHED_TOOL_TRACE_REQUEST_PAYLOAD = "DispatchedToolTraceRequestPayload"
    DISPATCHED_WRITE_STDIN_ARGS = "DispatchedWriteStdinArgs"
    DYNAMIC_TOOL_CALL_ITEM = "DynamicToolCallItem"
    DYNAMIC_TOOL_CALL_PARAMS = "DynamicToolCallParams"
    DYNAMIC_TOOL_CALL_REQUEST = "DynamicToolCallRequest"
    DYNAMIC_TOOL_CALL_RESPONSE = "DynamicToolCallResponse"
    DYNAMIC_TOOL_FUNCTION_SPEC = "DynamicToolFunctionSpec"
    DYNAMIC_TOOL_NAMESPACE_SPEC = "DynamicToolNamespaceSpec"
    DYNAMIC_TOOLS_SNAPSHOT = "DynamicToolsSnapshot"
    DYNAMIC_TOOLS_UPDATED_PAYLOAD = "DynamicToolsUpdatedPayload"
    ENVIRONMENT_SHELL_INFO = "EnvironmentShellInfo"
    EXEC_COMMAND_ARGS = "ExecCommandArgs"
    EXEC_COMMAND_BEGIN_PAYLOAD = "ExecCommandBeginPayload"
    EXEC_COMMAND_END_PAYLOAD = "ExecCommandEndPayload"
    EXEC_FILE_SYSTEM_SANDBOX_ENTRY = "ExecFileSystemSandboxEntry"
    EXEC_RESPONSE = "ExecResponse"
    EXEC_WAIT_ARGS = "ExecWaitArgs"
    EXECUTABLE_IDENTITY = "ExecutableIdentity"
    EXECUTOR_PLUGIN = "ExecutorPlugin"
    EXECUTOR_SKILL = "ExecutorSkill"
    FILE_CHANGE_ITEM = "FileChangeItem"
    FILE_DESCRIPTOR = "FileDescriptor"
    FILE_SYSTEM_SANDBOX_CONTEXT = "FileSystemSandboxContext"
    FILE_SYSTEM_SANDBOX_ENTRY = "FileSystemSandboxEntry"
    FILE_UPDATE_CHANGE = "FileUpdateChange"
    FS_CANONICALIZE_PARAMS = "FsCanonicalizeParams"
    FS_GET_METADATA_RESPONSE = "FsGetMetadataResponse"
    FS_HELPER_OPEN_PARAMS = "FsHelperOpenParams"
    FS_HELPER_OPEN_RESPONSE = "FsHelperOpenResponse"
    FS_READ_BLOCK_PARAMS = "FsReadBlockParams"
    FS_READ_BLOCK_RESPONSE = "FsReadBlockResponse"
    FS_READ_DIRECTORY_ENTRY = "FsReadDirectoryEntry"
    FS_WALK_PARAMS = "FsWalkParams"
    FS_WATCH_MISSING_PARAMS = "FsWatchMissingParams"
    FS_WATCH_PARAMS = "FsWatchParams"
    FS_WRITE_BLOCK_PARAMS = "FsWriteBlockParams"
    FUZZY_FILE_SEARCH_PARAMS = "FuzzyFileSearchParams"
    FUZZY_FILE_SEARCH_RESULT = "FuzzyFileSearchResult"
    FUZZY_FILE_SEARCH_SESSION_START_PARAMS = "FuzzyFileSearchSessionStartParams"
    FUZZY_FILE_SEARCH_SESSION_UPDATE_PARAMS = "FuzzyFileSearchSessionUpdateParams"
    HOOK_ERROR_INFO = "HookErrorInfo"
    HOOK_OUTPUT_ENTRY = "HookOutputEntry"
    HOOK_PROMPT_FRAGMENT = "HookPromptFragment"
    HOOK_PROMPT_ITEM = "HookPromptItem"
    HOOK_RUN_SUMMARY = "HookRunSummary"
    HOOKS_LIST_ENTRY = "HooksListEntry"
    HOOKS_LIST_PARAMS = "HooksListParams"
    INSTALLED_PLUGIN = "InstalledPlugin"
    LEGACY_DYNAMIC_TOOL_SPEC = "LegacyDynamicToolSpec"
    LIST_MCP_SERVER_STATUS_PARAMS = "ListMcpServerStatusParams"
    LIST_MCP_SERVER_STATUS_RESPONSE = "ListMcpServerStatusResponse"
    LIST_TOOLS_RESULT = "ListToolsResult"
    LOCAL_SHELL_EXEC_ACTION = "LocalShellExecAction"
    MCP_ATTRIBUTION = "McpAttribution"
    MCP_ATTRIBUTION_SOURCE = "McpAttributionSource"
    MCP_ELICITATION_BOOLEAN_SCHEMA = "McpElicitationBooleanSchema"
    MCP_ELICITATION_CONST_OPTION = "McpElicitationConstOption"
    MCP_ELICITATION_LEGACY_TITLED_ENUM_SCHEMA = "McpElicitationLegacyTitledEnumSchema"
    MCP_ELICITATION_NUMBER_SCHEMA = "McpElicitationNumberSchema"
    MCP_ELICITATION_SCHEMA = "McpElicitationSchema"
    MCP_ELICITATION_STRING_SCHEMA = "McpElicitationStringSchema"
    MCP_ELICITATION_TITLED_MULTI_SELECT_ENUM_SCHEMA = "McpElicitationTitledMultiSelectEnumSchema"
    MCP_ELICITATION_TITLED_SINGLE_SELECT_ENUM_SCHEMA = "McpElicitationTitledSingleSelectEnumSchema"
    MCP_ELICITATION_UNTITLED_ENUM_ITEMS = "McpElicitationUntitledEnumItems"
    MCP_ELICITATION_UNTITLED_MULTI_SELECT_ENUM_SCHEMA = "McpElicitationUntitledMultiSelectEnumSchema"
    MCP_ELICITATION_UNTITLED_SINGLE_SELECT_ENUM_SCHEMA = "McpElicitationUntitledSingleSelectEnumSchema"
    MCP_INVOCATION = "McpInvocation"
    MCP_MEDIA = "McpMedia"
    MCP_RESOURCE_ORIGIN = "McpResourceOrigin"
    MCP_RESOURCE_ORIGIN_CHECKPOINT = "McpResourceOriginCheckpoint"
    MCP_RESOURCE_READ_PARAMS = "McpResourceReadParams"
    MCP_RESOURCE_READ_RESPONSE = "McpResourceReadResponse"
    MCP_RESOURCE_READ_TARGET = "McpResourceReadTarget"
    MCP_SERVER_COMMAND_MATCHER = "McpServerCommandMatcher"
    MCP_SERVER_ELICITATION_REQUEST_RESPONSE = "McpServerElicitationRequestResponse"
    MCP_SERVER_INFO = "McpServerInfo"
    MCP_SERVER_STATUS = "McpServerStatus"
    MCP_SERVER_TOOL_CALL_PARAMS = "McpServerToolCallParams"
    MCP_STARTUP_FAILURE = "McpStartupFailure"
    MCP_TOOL_CALL_ITEM = "McpToolCallItem"
    MCP_TOOL_CALL_RESULT = "McpToolCallResult"
    MXC_COMMAND = "MxcCommand"
    NODE_REPL_EXEC_OUTPUT = "NodeReplExecOutput"
    PET_FILE = "PetFile"
    PLUGIN_DETAIL = "PluginDetail"
    PLUGIN_HOOK_SUMMARY = "PluginHookSummary"
    PLUGIN_INSTALL_PARAMS = "PluginInstallParams"
    PLUGIN_INSTALL_RESPONSE = "PluginInstallResponse"
    PLUGIN_INSTALLED_PARAMS = "PluginInstalledParams"
    PLUGIN_INSTALLED_RESPONSE = "PluginInstalledResponse"
    PLUGIN_INTERFACE = "PluginInterface"
    PLUGIN_LIST_PARAMS = "PluginListParams"
    PLUGIN_LIST_RESPONSE = "PluginListResponse"
    PLUGIN_MANIFEST = "PluginManifest"
    PLUGIN_MANIFEST_METADATA = "PluginManifestMetadata"
    PLUGIN_MARKETPLACE_ENTRY = "PluginMarketplaceEntry"
    PLUGIN_READ_PARAMS = "PluginReadParams"
    PLUGIN_SEARCH_PARAMS = "PluginSearchParams"
    PLUGIN_SHARE_CONTEXT = "PluginShareContext"
    PLUGIN_SHARE_PRINCIPAL = "PluginSharePrincipal"
    PLUGIN_SHARE_SAVE_PARAMS = "PluginShareSaveParams"
    PLUGIN_SHARE_TARGET = "PluginShareTarget"
    PLUGIN_SHARE_UPDATE_TARGETS_PARAMS = "PluginShareUpdateTargetsParams"
    PLUGIN_SKILL_READ_PARAMS = "PluginSkillReadParams"
    PLUGIN_SUMMARY = "PluginSummary"
    PLUGINS_MIGRATION = "PluginsMigration"
    POST_TOOL_USE_HOOK_SPECIFIC_OUTPUT_WIRE = "PostToolUseHookSpecificOutputWire"
    PRE_TOOL_USE_HOOK_SPECIFIC_OUTPUT_WIRE = "PreToolUseHookSpecificOutputWire"
    PROCESS_WRITE_STDIN_PARAMS = "ProcessWriteStdinParams"
    PROJECT_MCP_SERVER_METADATA = "ProjectMcpServerMetadata"
    RAW_AGENT_PLUGIN_MANIFEST = "RawAgentPluginManifest"
    RAW_FILE_SYSTEM_SANDBOX_ENTRY = "RawFileSystemSandboxEntry"
    READ_ARGS = "ReadArgs"
    READ_ARGUMENTS = "ReadArguments"
    READ_PARAMS = "ReadParams"
    READ_POST = "ReadPost"
    READ_RESOURCE_ARGS = "ReadResourceArgs"
    READ_RESOURCE_RESULT = "ReadResourceResult"
    RECOMMENDED_PLUGIN_INSTALL_ARGS = "RecommendedPluginInstallArgs"
    RECOMMENDED_PLUGIN_ITEM = "RecommendedPluginItem"
    RECOMMENDED_PLUGINS_RESPONSE = "RecommendedPluginsResponse"
    REMOTE_PLUGIN_DIRECTORY_ITEM = "RemotePluginDirectoryItem"
    REMOTE_PLUGIN_DIRECTORY_SHARE_PRINCIPAL = "RemotePluginDirectorySharePrincipal"
    REMOTE_PLUGIN_INSTALL_METADATA = "RemotePluginInstallMetadata"
    REMOTE_PLUGIN_INSTALLED_RESPONSE = "RemotePluginInstalledResponse"
    REMOTE_PLUGIN_LIST_RESPONSE = "RemotePluginListResponse"
    REMOTE_PLUGIN_MUTATION_RESPONSE = "RemotePluginMutationResponse"
    REMOTE_PLUGIN_RELEASE_INTERFACE_RESPONSE = "RemotePluginReleaseInterfaceResponse"
    REMOTE_PLUGIN_RELEASE_RESPONSE = "RemotePluginReleaseResponse"
    REMOTE_PLUGIN_SHARE_PRINCIPAL = "RemotePluginSharePrincipal"
    REMOTE_PLUGIN_SHARE_UPDATE_TARGETS_RESPONSE = "RemotePluginShareUpdateTargetsResponse"
    REMOTE_PLUGIN_SKILL_DETAIL_RESPONSE = "RemotePluginSkillDetailResponse"
    REMOTE_PLUGIN_SKILL_INTERFACE_RESPONSE = "RemotePluginSkillInterfaceResponse"
    REMOTE_PLUGIN_SKILL_RESPONSE = "RemotePluginSkillResponse"
    REMOTE_WORKSPACE_PLUGIN_CREATE_RESPONSE = "RemoteWorkspacePluginCreateResponse"
    REMOTE_WORKSPACE_PLUGIN_UPLOAD_URL_RESPONSE = "RemoteWorkspacePluginUploadUrlResponse"
    REQUEST_PLUGIN_INSTALL_ARGS = "RequestPluginInstallArgs"
    SEARCH_ARGS = "SearchArgs"
    SEARCH_COMMANDS = "SearchCommands"
    SEARCH_POSTS = "SearchPosts"
    SEARCH_QUERY = "SearchQuery"
    SEARCH_RESPONSE = "SearchResponse"
    SEARCH_TOOL_CALL_PARAMS = "SearchToolCallParams"
    SECRETS_FILE = "SecretsFile"
    SESSION_START_HOOK_SPECIFIC_OUTPUT_WIRE = "SessionStartHookSpecificOutputWire"
    SHELL_INFO = "ShellInfo"
    SHELL_SNAPSHOT_REQUEST = "ShellSnapshotRequest"
    SKILL_DISCOVERY_ROOT = "SkillDiscoveryRoot"
    SKILL_ENTRY_SNAPSHOT = "SkillEntrySnapshot"
    SKILL_ERROR_INFO = "SkillErrorInfo"
    SKILL_INTERFACE = "SkillInterface"
    SKILL_METADATA = "SkillMetadata"
    SKILL_SUMMARY = "SkillSummary"
    SKILLS_LIST_ENTRY = "SkillsListEntry"
    SNAPSHOT_SKILL = "SnapshotSkill"
    SUBAGENT_START_HOOK_SPECIFIC_OUTPUT_WIRE = "SubagentStartHookSpecificOutputWire"
    TOOL = "Tool"
    TOOL_ANNOTATIONS = "ToolAnnotations"
    TOOL_INFO = "ToolInfo"
    TOOL_RESULT_CONTENT = "ToolResultContent"
    TOOL_SERDE = "ToolSerde"
    TOOL_SUGGEST_DISABLED_TOOL = "ToolSuggestDisabledTool"
    TOOL_SUGGEST_DISCOVERABLE = "ToolSuggestDiscoverable"
    TOOL_USE_CONTENT = "ToolUseContent"
    TUI_EDITOR_KEYMAP = "TuiEditorKeymap"
    TUI_VIM_SEARCH_KEYMAP = "TuiVimSearchKeymap"
    WEB_SEARCH_ITEM = "WebSearchItem"
    WEB_SEARCH_LOCATION = "WebSearchLocation"
    WIRE_EXEC_PARAMS = "WireExecParams"
    WIRE_FILE_SYSTEM_SANDBOX_CONTEXT = "WireFileSystemSandboxContext"
    WIRE_FS_CANONICALIZE_PARAMS = "WireFsCanonicalizeParams"
    WIRE_FS_COPY_PARAMS = "WireFsCopyParams"
    WIRE_FS_CREATE_DIRECTORY_PARAMS = "WireFsCreateDirectoryParams"
    WIRE_FS_GET_METADATA_PARAMS = "WireFsGetMetadataParams"
    WIRE_FS_OPEN_PARAMS = "WireFsOpenParams"
    WIRE_FS_READ_DIRECTORY_PARAMS = "WireFsReadDirectoryParams"
    WIRE_FS_READ_FILE_PARAMS = "WireFsReadFileParams"
    WIRE_FS_REMOVE_PARAMS = "WireFsRemoveParams"
    WIRE_FS_WALK_PARAMS = "WireFsWalkParams"
    WIRE_FS_WRITE_FILE_PARAMS = "WireFsWriteFileParams"
    WIRE_NESTED_TOOL_CALL = "WireNestedToolCall"
    WIRE_TOOL_NAME = "WireToolName"
    WRITE_PARAMS = "WriteParams"



class ToolStructContractError(ValueError):
    """未登记的协议面 variant（封闭集/元素数/归类判据点名）。"""


def tool_struct_contract_names() -> list[str]:
    """返回逐字 variant 名列表副本（顺序稳定，调用方改不动真相源）。"""
    return list(TOOL_STRUCT_CONTRACT_ELEMENTS)


def expected_tool_struct_contract_element_count(name: str) -> int:
    """该 variant 的逐字元素数（未登记抛错）。"""
    if not isinstance(name, str) or name not in _CLOSED_SET:
        raise ToolStructContractError(f"未登记的 variant: {name!r} —— 先在 app/core/tool_struct_contract.py 的 TOOL_STRUCT_CONTRACT_ELEMENTS 登记")
    return TOOL_STRUCT_CONTRACT_ELEMENTS[name]


def ensure_tool_struct_contract(value: str) -> str:
    """值域闭合：登记过原样放行，未登记抛 :class:`ToolStructContractError`。"""
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise ToolStructContractError(f"未登记的 variant: {value!r} —— 先在 app/core/tool_struct_contract.py 的 ToolStructContract 登记后再产出")
    return value


def tool_struct_contract_domain(value: str) -> str:
    """归类到协议面域（登记外抛错）。"""
    ensure_tool_struct_contract(value)
    return TOOL_STRUCT_CONTRACT_DOMAIN[value]


def tool_struct_contract_domain_members(domain: str) -> tuple[str, ...]:
    """反查某域下的全部逐字 variant 名（元组副本，调用方改不动真相源）。"""
    if domain not in set(TOOL_STRUCT_CONTRACT_DOMAIN.values()):
        raise ToolStructContractError(f"未登记的域: {domain!r} —— 合法域: {sorted(set(TOOL_STRUCT_CONTRACT_DOMAIN.values()))!r}")
    return tuple(nm for nm, dom in TOOL_STRUCT_CONTRACT_DOMAIN.items() if dom == domain)


def is_tool_struct_contract(value: str) -> bool:
    """封闭集成员判定（不改值、不抛错）。"""
    return isinstance(value, str) and value in _CLOSED_SET


def validate_tool_struct_contract(name: str, element_count: int) -> str:
    """一致性守门：variant 名与元素数须同时匹配逐字表，否则抛错点名。"""
    ensure_tool_struct_contract(name)
    expected = expected_tool_struct_contract_element_count(name)
    if element_count != expected:
        raise ToolStructContractError(f"{name!r} 的 struct 元素数应为 {expected}，实得 {element_count!r}")
    return name
