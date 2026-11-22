# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R62 pytest: tool_struct_contract struct arity contract.

Covers verbatim table, domain classification, reverse lookup, consistency gate,
reverse-mutation guards. Watermark by build.py.
"""

from __future__ import annotations

import pytest

from app.core.tool_struct_contract import (
    TOOL_STRUCT_CONTRACT_DOMAIN,
    TOOL_STRUCT_CONTRACT_ELEMENTS,
    ToolStructContract,
    ToolStructContractError,
    ensure_tool_struct_contract,
    expected_tool_struct_contract_element_count,
    is_tool_struct_contract,
    tool_struct_contract_domain,
    tool_struct_contract_domain_members,
    tool_struct_contract_names,
    validate_tool_struct_contract,
)


class TestVerbatimTable:
    def test_table_exact(self) -> None:
        assert TOOL_STRUCT_CONTRACT_ELEMENTS == {"AcceptedFileAudio": 4, "AgentPluginMcpFile": 2, "CallToolResult": 4, "CapabilityTextFile": 2, "CodeModeExecResult": 4, "CollabAgentToolCallItem": 10, "CommandExecParams": 14, "CommandExecResizeParams": 2, "CommandExecResponse": 3, "CommandExecTerminalSize": 2, "CommandExecWriteParams": 3, "CommandExecutionItem": 13, "CommandSession": 3, "CommandSessionsState": 3, "ComputerUseWindowsExeRequirement": 4, "ComputerUseWindowsRequirements": 2, "ConnectorDirectoryDiskCache": 2, "ConsequentialToolTemplateParam": 2, "CopyFileArgs": 4, "CreateFileResponse": 4, "DirectoryListResponse": 2, "DiscoveredPluginFiles": 3, "DiscoveredSkillFiles": 2, "DispatchedToolPayload": 2, "DispatchedToolTraceRequestPayload": 3, "DispatchedWriteStdinArgs": 4, "DynamicToolCallItem": 9, "DynamicToolCallParams": 6, "DynamicToolCallRequest": 6, "DynamicToolCallResponse": 2, "DynamicToolFunctionSpec": 4, "DynamicToolNamespaceSpec": 3, "DynamicToolsSnapshot": 2, "DynamicToolsUpdatedPayload": 2, "EnvironmentShellInfo": 2, "ExecCommandArgs": 11, "ExecCommandBeginPayload": 4, "ExecCommandEndPayload": 3, "ExecFileSystemSandboxEntry": 3, "ExecResponse": 2, "ExecWaitArgs": 4, "ExecutableIdentity": 2, "ExecutorPlugin": 7, "ExecutorSkill": 7, "FileChangeItem": 6, "FileDescriptor": 2, "FileSystemSandboxContext": 9, "FileSystemSandboxEntry": 2, "FileUpdateChange": 3, "FsCanonicalizeParams": 2, "FsGetMetadataResponse": 6, "FsHelperOpenParams": 2, "FsHelperOpenResponse": 2, "FsReadBlockParams": 3, "FsReadBlockResponse": 2, "FsReadDirectoryEntry": 3, "FsWalkParams": 3, "FsWatchMissingParams": 3, "FsWatchParams": 2, "FsWriteBlockParams": 3, "FuzzyFileSearchParams": 3, "FuzzyFileSearchResult": 6, "FuzzyFileSearchSessionStartParams": 2, "FuzzyFileSearchSessionUpdateParams": 2, "HookErrorInfo": 2, "HookOutputEntry": 2, "HookPromptFragment": 2, "HookPromptItem": 2, "HookRunSummary": 14, "HooksListEntry": 4, "HooksListParams": 2, "InstalledPlugin": 3, "LegacyDynamicToolSpec": 6, "ListMcpServerStatusParams": 5, "ListMcpServerStatusResponse": 2, "ListToolsResult": 6, "LocalShellExecAction": 5, "McpAttribution": 3, "McpAttributionSource": 5, "McpElicitationBooleanSchema": 4, "McpElicitationConstOption": 2, "McpElicitationLegacyTitledEnumSchema": 6, "McpElicitationNumberSchema": 6, "McpElicitationSchema": 4, "McpElicitationStringSchema": 7, "McpElicitationTitledMultiSelectEnumSchema": 7, "McpElicitationTitledSingleSelectEnumSchema": 5, "McpElicitationUntitledEnumItems": 2, "McpElicitationUntitledMultiSelectEnumSchema": 7, "McpElicitationUntitledSingleSelectEnumSchema": 5, "McpInvocation": 3, "McpMedia": 2, "McpResourceOrigin": 7, "McpResourceOriginCheckpoint": 3, "McpResourceReadParams": 7, "McpResourceReadResponse": 2, "McpResourceReadTarget": 2, "McpServerCommandMatcher": 2, "McpServerElicitationRequestResponse": 3, "McpServerInfo": 6, "McpServerStatus": 12, "McpServerToolCallParams": 5, "McpStartupFailure": 2, "McpToolCallItem": 16, "McpToolCallResult": 3, "MxcCommand": 5, "NodeReplExecOutput": 2, "PetFile": 6, "PluginDetail": 12, "PluginHookSummary": 2, "PluginInstallParams": 4, "PluginInstallResponse": 2, "PluginInstalledParams": 2, "PluginInstalledResponse": 2, "PluginInterface": 19, "PluginListParams": 3, "PluginListResponse": 3, "PluginManifest": 3, "PluginManifestMetadata": 4, "PluginMarketplaceEntry": 4, "PluginReadParams": 3, "PluginSearchParams": 5, "PluginShareContext": 8, "PluginSharePrincipal": 4, "PluginShareSaveParams": 4, "PluginShareTarget": 3, "PluginShareUpdateTargetsParams": 3, "PluginSkillReadParams": 3, "PluginSummary": 19, "PluginsMigration": 2, "PostToolUseHookSpecificOutputWire": 3, "PreToolUseHookSpecificOutputWire": 5, "ProcessWriteStdinParams": 3, "ProjectMcpServerMetadata": 2, "RawAgentPluginManifest": 9, "RawFileSystemSandboxEntry": 3, "ReadArgs": 3, "ReadArguments": 5, "ReadParams": 4, "ReadPost": 3, "ReadResourceArgs": 2, "ReadResourceResult": 5, "RecommendedPluginInstallArgs": 2, "RecommendedPluginItem": 3, "RecommendedPluginsResponse": 2, "RemotePluginDirectoryItem": 18, "RemotePluginDirectorySharePrincipal": 4, "RemotePluginInstallMetadata": 2, "RemotePluginInstalledResponse": 2, "RemotePluginListResponse": 2, "RemotePluginMutationResponse": 3, "RemotePluginReleaseInterfaceResponse": 15, "RemotePluginReleaseResponse": 13, "RemotePluginSharePrincipal": 4, "RemotePluginShareUpdateTargetsResponse": 2, "RemotePluginSkillDetailResponse": 3, "RemotePluginSkillInterfaceResponse": 6, "RemotePluginSkillResponse": 3, "RemoteWorkspacePluginCreateResponse": 3, "RemoteWorkspacePluginUploadUrlResponse": 3, "RequestPluginInstallArgs": 4, "SearchArgs": 8, "SearchCommands": 12, "SearchPosts": 7, "SearchQuery": 3, "SearchResponse": 3, "SearchToolCallParams": 2, "SecretsFile": 2, "SessionStartHookSpecificOutputWire": 2, "ShellInfo": 2, "ShellSnapshotRequest": 2, "SkillDiscoveryRoot": 2, "SkillEntrySnapshot": 3, "SkillErrorInfo": 2, "SkillInterface": 8, "SkillMetadata": 9, "SkillSummary": 6, "SkillsListEntry": 3, "SnapshotSkill": 7, "SubagentStartHookSpecificOutputWire": 2, "Tool": 8, "ToolAnnotations": 5, "ToolInfo": 11, "ToolResultContent": 5, "ToolSerde": 8, "ToolSuggestDisabledTool": 2, "ToolSuggestDiscoverable": 2, "ToolUseContent": 4, "TuiEditorKeymap": 17, "TuiVimSearchKeymap": 4, "WebSearchItem": 4, "WebSearchLocation": 4, "WireExecParams": 14, "WireFileSystemSandboxContext": 10, "WireFsCanonicalizeParams": 2, "WireFsCopyParams": 4, "WireFsCreateDirectoryParams": 4, "WireFsGetMetadataParams": 3, "WireFsOpenParams": 4, "WireFsReadDirectoryParams": 2, "WireFsReadFileParams": 3, "WireFsRemoveParams": 5, "WireFsWalkParams": 3, "WireFsWriteFileParams": 4, "WireNestedToolCall": 5, "WireToolName": 2, "WriteParams": 3}

    def test_closed_set_cardinality(self) -> None:
        assert len(ToolStructContract) == len(TOOL_STRUCT_CONTRACT_ELEMENTS) == 207

    def test_enum_values_match_table(self) -> None:
        assert {m.value for m in ToolStructContract} == set(TOOL_STRUCT_CONTRACT_ELEMENTS)

    def test_all_counts_positive_int(self) -> None:
        assert all(isinstance(c, int) and c >= 1 for c in TOOL_STRUCT_CONTRACT_ELEMENTS.values())


class TestDomainClassification:
    def test_domain_covers_all(self) -> None:
        assert set(TOOL_STRUCT_CONTRACT_DOMAIN) == set(TOOL_STRUCT_CONTRACT_ELEMENTS)

    @pytest.mark.parametrize("name,expected", [('LocalShellExecAction', 'action'), ('ComputerUseWindowsRequirements', 'capability'), ('CollabAgentToolCallItem', 'content'), ('CommandSessionsState', 'descriptor'), ('AcceptedFileAudio', 'domain_object'), ('McpStartupFailure', 'error'), ('DynamicToolCallRequest', 'request'), ('CommandExecParams', 'request_params'), ('CallToolResult', 'response'), ('DynamicToolFunctionSpec', 'schema_config')])
    def test_domain(self, name, expected) -> None:
        assert tool_struct_contract_domain(name) == expected

    def test_domain_rejects_unregistered(self) -> None:
        with pytest.raises(ToolStructContractError):
            tool_struct_contract_domain("bogus")

    def test_domain_members_partition(self) -> None:
        seen = []
        for domain in set(TOOL_STRUCT_CONTRACT_DOMAIN.values()):
            seen.extend(tool_struct_contract_domain_members(domain))
        assert sorted(seen) == sorted(TOOL_STRUCT_CONTRACT_ELEMENTS)
        assert len(seen) == len(set(seen))

    def test_domain_members_rejects_unknown_domain(self) -> None:
        with pytest.raises(ToolStructContractError):
            tool_struct_contract_domain_members("bogus_domain")


class TestMembershipAndCopy:
    def test_is_fn_true_for_all(self) -> None:
        assert all(is_tool_struct_contract(nm) for nm in TOOL_STRUCT_CONTRACT_ELEMENTS)

    def test_is_fn_false_case_sensitive(self) -> None:
        first = "AcceptedFileAudio"
        assert first in TOOL_STRUCT_CONTRACT_ELEMENTS
        assert not is_tool_struct_contract(first.lower())
        assert not is_tool_struct_contract("bogus")

    def test_names_returns_copy(self) -> None:
        a = tool_struct_contract_names()
        a.append("bogus")
        assert "bogus" not in TOOL_STRUCT_CONTRACT_ELEMENTS
        assert set(tool_struct_contract_names()) == set(TOOL_STRUCT_CONTRACT_ELEMENTS)

    def test_members_returns_immutable(self) -> None:
        domain = next(iter(set(TOOL_STRUCT_CONTRACT_DOMAIN.values())))
        assert isinstance(tool_struct_contract_domain_members(domain), tuple)


class TestConsistencyGate:
    @pytest.mark.parametrize("name,count", TOOL_STRUCT_CONTRACT_ELEMENTS.items())
    def test_validate_ok(self, name, count) -> None:
        assert validate_tool_struct_contract(name, count) == name

    @pytest.mark.parametrize("name,count", TOOL_STRUCT_CONTRACT_ELEMENTS.items())
    def test_validate_rejects_wrong_count(self, name, count) -> None:
        with pytest.raises(ToolStructContractError, match="元素数应为"):
            validate_tool_struct_contract(name, count + 1)

    def test_ensure_rejects_unregistered(self) -> None:
        with pytest.raises(ToolStructContractError):
            ensure_tool_struct_contract("bogus")

    def test_count_rejects_unregistered(self) -> None:
        with pytest.raises(ToolStructContractError):
            expected_tool_struct_contract_element_count("bogus")


class TestReverseMutation:
    def test_verbatim_wire_names_case_sensitive(self) -> None:
        for nm in ("AcceptedFileAudio", "AgentPluginMcpFile"):
            assert nm in TOOL_STRUCT_CONTRACT_ELEMENTS
            assert nm.lower() not in TOOL_STRUCT_CONTRACT_ELEMENTS

    def test_element_counts_pinned(self) -> None:
        assert set(TOOL_STRUCT_CONTRACT_ELEMENTS.values()) == {2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19}
