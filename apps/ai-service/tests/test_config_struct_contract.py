# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R62 pytest: config_struct_contract struct arity contract.

Covers verbatim table, domain classification, reverse lookup, consistency gate,
reverse-mutation guards. Watermark by build.py.
"""

from __future__ import annotations

import pytest

from app.core.config_struct_contract import (
    CONFIG_STRUCT_CONTRACT_DOMAIN,
    CONFIG_STRUCT_CONTRACT_ELEMENTS,
    ConfigStructContract,
    ConfigStructContractError,
    config_struct_contract_domain,
    config_struct_contract_domain_members,
    config_struct_contract_names,
    ensure_config_struct_contract,
    expected_config_struct_contract_element_count,
    is_config_struct_contract,
    validate_config_struct_contract,
)


class TestVerbatimTable:
    def test_table_exact(self) -> None:
        assert CONFIG_STRUCT_CONTRACT_ELEMENTS == {"ActivePermissionProfile": 2, "AdditionalFileSystemPermissions": 4, "AdditionalPermissionProfile": 2, "AgentRoleToml": 3, "AnnouncementTipRaw": 7, "AppBranding": 6, "AppConfig": 9, "AppInfo": 15, "AppLinkConfig": 2, "AppMetadata": 11, "AppRequirementToml": 2, "AppScreenshot": 3, "AppSummary": 5, "AppTemplateSummary": 9, "AppToolConfig": 2, "AppToolRequirementToml": 2, "AppToolResultSourceRequirementToml": 2, "AppToolSummary": 6, "Append": 4, "ApplicationNetworkRequirements": 2, "ApplicationRequirements": 2, "ApplicationRequirementsToml": 2, "ApplicationStorageRequirements": 2, "ApplyPatchApprovalParams": 5, "ApplyPatchApprovalRequestEvent": 6, "ApprovalMessages": 7, "AppsDefaultConfig": 5, "AppsInstalledParams": 2, "AppsListParams": 4, "AppsListResponse": 2, "AppsReadParams": 3, "AppsReadResponse": 2, "AsyncCompactionConfigToml": 2, "AutoReviewRequirementsToml": 2, "AutoReviewToml": 5, "AwsSigV4Config": 8, "BatchApp": 7, "BatchAppToolSummary": 6, "BedrockSettingsParams": 3, "BoardPermissions": 3, "BodySecretSubstitutionConfig": 3, "BrowserUseConfig": 3, "BrowserUseConfigToml": 3, "BrowserUseOriginPolicy": 7, "BrowserUseOriginPolicyConfig": 4, "BrowserUseOriginPolicyConfigToml": 4, "BrowserUseOriginPolicyToml": 7, "BrowserUseRequirementsToml": 7, "CatalogBudgetAllocation": 3, "CatalogSnapshot": 8, "ChannelPermissions": 4, "CloudConfigBundle": 2, "CloudConfigBundleCacheFile": 2, "CloudConfigBundleCacheSignedPayload": 6, "CloudConfigFragment": 3, "CodeModeConfigToml": 6, "CodeModeHostConfigToml": 2, "CodexAppsServerInfoDiskCache": 2, "CodexAppsToolsDiskCache": 4, "CommandExecutionRequestApprovalParams": 16, "ComputerUseConfig": 3, "ComputerUseConfigToml": 3, "ComputerUseRequirementsToml": 5, "ComputerUseWindowsConfig": 2, "ComputerUseWindowsConfigToml": 2, "ComputerUseWindowsExeConfig": 4, "ComputerUseWindowsExeConfigToml": 4, "ComputerUseWindowsExeRequirementToml": 4, "ComputerUseWindowsRequirementsToml": 2, "ConfigBatchWriteParams": 4, "ConfigEdit": 3, "ConfigLayer": 4, "ConfigLayerMetadata": 2, "ConfigProfile": 30, "ConfigReadParams": 2, "ConfigReadResponse": 3, "ConfigRequirements": 34, "ConfigRequirementsReadResponse": 2, "ConfigRequirementsToml": 46, "ConfigServerInput": 2, "ConfigToml": 106, "ConfigValueWriteParams": 5, "ConfigWarningNotification": 4, "ConfigWriteResponse": 4, "ConfiguredHookMatcherGroup": 2, "ConfiguredUpdater": 2, "CreateGoalRequest": 2, "CurrentTimeReminderConfigToml": 5, "CustomGatewaySettingsParams": 4, "DeliveredManagedLayers": 2, "DeliveredTomlFragment": 3, "DirectoryApp": 12, "EffectiveConfig": 2, "EnvironmentConfigLayer": 3, "EnvironmentConfigLayerStack": 2, "EnvironmentConfigReadParams": 3, "EnvironmentConfigReadResponse": 5, "EnvironmentToml": 10, "EnvironmentsToml": 3, "ExecApprovalRequestEvent": 17, "ExecCommandApprovalParams": 7, "ExecEnvPolicy": 5, "ExecServerNetworkPolicyRequest": 3, "ExperimentalFeature": 7, "ExperimentalFeatureListParams": 3, "ExperimentalFeatureListResponse": 2, "ExternalAgentConfigDetectParams": 6, "ExternalAgentConfigDetectResponse": 2, "ExternalAgentConfigImportCompletedNotification": 2, "ExternalAgentConfigImportFailureRecord": 7, "ExternalAgentConfigImportHistoryRecordParams": 2, "ExternalAgentConfigImportHistoryRecordSuccessParams": 5, "ExternalAgentConfigImportHistoryRecordTypeResultParams": 3, "ExternalAgentConfigImportItemTypeFailure": 7, "ExternalAgentConfigImportItemTypeSuccess": 5, "ExternalAgentConfigImportParams": 4, "ExternalAgentConfigImportProgressNotification": 2, "ExternalAgentConfigImportSuccessRecord": 5, "ExternalAgentConfigImportTypeResult": 3, "ExternalAgentConfigMigrationItem": 4, "ExternalConfigMigrationPrompts": 4, "FileChangeRequestApprovalParams": 6, "GcpSettingsParams": 4, "GhostSnapshotToml": 3, "GranularApprovalConfig": 5, "GuardianApprovalReview": 4, "GuardianAssessmentEvent": 14, "GuardianAssessmentPayload": 4, "GuardianElasticSectionConfigToml": 3, "GuardianRetainedOmissions": 2, "GuardianV2ConfigToml": 19, "GuardianV2ReviewScopeConfigToml": 2, "GuardianV2TranscriptConfigToml": 7, "GuardianWarningNotification": 2, "InstalledApp": 4, "ItemGuardianApprovalReviewCompletedNotification": 9, "ItemGuardianApprovalReviewStartedNotification": 7, "LegacyManagedConfigToml": 3, "LegacyPermissionProfile": 2, "ManagedHooksRequirements": 16, "MarketplaceAllowedSourceToml": 5, "MarketplaceRequirementsToml": 2, "McpAppUi": 2, "McpToolCallAppContext": 5, "MemoriesToml": 15, "MultiAgentV2ConfigToml": 21, "NetworkApprovalContext": 2, "NetworkHeaderInjectionToml": 4, "NetworkMitmHookToml": 9, "NetworkMitmTomlUnchecked": 3, "NetworkPolicyAmendment": 2, "NetworkPolicyDecisionNotification": 12, "NetworkPolicyRequestParams": 2, "NetworkProxyConfigToml": 14, "NetworkToml": 13, "NewThreadModelDefaultsToml": 3, "NonPrefixedMcpToolNamesConfigToml": 2, "OrchestratorToml": 2, "OtelConfigToml": 11, "OtelRequirementsToml": 11, "OtelTlsConfig": 3, "PatchApplyBeginEvent": 4, "PatchApplyEndEvent": 7, "PatchApplyUpdatedEvent": 2, "PermissionDeniedDetails": 2, "PermissionMessages": 9, "PermissionProfileListParams": 3, "PermissionProfileListResponse": 2, "PermissionProfileSummary": 3, "PermissionProfileToml": 5, "PermissionRequestDecisionWire": 5, "PermissionRequestHookSpecificOutputWire": 2, "PermissionSelectors": 2, "PermissionsRequestApprovalParams": 8, "PermissionsRequestApprovalResponse": 3, "PluginAppConfig": 2, "PreviousTurnSettings": 4, "RawFileSystemSandboxPolicy": 3, "RawFilesystemRequirementsToml": 6, "RawMarketplaceManifestPluginPolicy": 3, "RawMcpServerConfig": 30, "RawNetworkRequirementsToml": 15, "RealtimeAudioToml": 3, "RealtimeToml": 4, "RemoteAppTemplateResponse": 9, "RemoteMcpServerConfig": 2, "RemoteMessageBoardConfigToml": 3, "RemoteNetworkProxyLaunchConfig": 5, "RemotePluginCatalogDiskCache": 3, "RemoteSandboxConfigToml": 2, "RemovedAppsMcpPathOverrideConfigToml": 2, "RequestHeaderToml": 2, "RequestPermissionProfile": 2, "RequestPermissionsArgs": 3, "RequestPermissionsEvent": 7, "RequirementsExecPolicyPrefixRuleToml": 4, "RolloutBudgetConfigToml": 6, "RuntimeAgentInstancesConfigToml": 2, "ShellEnvironmentPolicyTomlRaw": 7, "SkillConfig": 3, "SkillPolicy": 2, "SkillsConfigWriteParams": 3, "SleepToolConfigToml": 2, "ThemeSettings": 30, "ThreadApproveGuardianDeniedActionParams": 2, "ThreadGoal": 8, "ThreadGoalClearParams": 2, "ThreadGoalSetParams": 5, "ThreadGoalUpdatedEvent": 3, "ThreadGoalUpdatedNotification": 3, "ThreadPrepareApprovedPlanParams": 3, "ThreadRealtimeAppendAudioParams": 2, "ThreadRealtimeAppendSpeechParams": 2, "ThreadRealtimeAppendTextParams": 3, "ThreadSectionAppearance": 2, "ThreadSettings": 15, "ThreadSettingsAppliedEvent": 2, "ThreadSettingsSnapshot": 15, "ThreadSettingsUpdateParams": 15, "ThreadSettingsUpdatedNotification": 2, "ToolRegistryConfigToml": 2, "ToolsToml": 4, "TruncationPolicyConfig": 2, "TuiApprovalKeymap": 8, "TurnSettingsUpdateParams": 8, "WebSearchToolConfig": 3, "WindowsRequirementsToml": 3, "WindowsSandboxProvisioningSettings": 2, "WindowsToml": 2}

    def test_closed_set_cardinality(self) -> None:
        assert len(ConfigStructContract) == len(CONFIG_STRUCT_CONTRACT_ELEMENTS) == 229

    def test_enum_values_match_table(self) -> None:
        assert {m.value for m in ConfigStructContract} == set(CONFIG_STRUCT_CONTRACT_ELEMENTS)

    def test_all_counts_positive_int(self) -> None:
        assert all(isinstance(c, int) and c >= 1 for c in CONFIG_STRUCT_CONTRACT_ELEMENTS.values())


class TestDomainClassification:
    def test_domain_covers_all(self) -> None:
        assert set(CONFIG_STRUCT_CONTRACT_DOMAIN) == set(CONFIG_STRUCT_CONTRACT_ELEMENTS)

    @pytest.mark.parametrize("name,expected", [('ApplicationNetworkRequirements', 'capability'), ('AgentRoleToml', 'config_toml'), ('CloudConfigBundleCacheSignedPayload', 'content'), ('ActivePermissionProfile', 'descriptor'), ('AdditionalFileSystemPermissions', 'domain_object'), ('ExternalAgentConfigImportItemTypeFailure', 'error'), ('ApplyPatchApprovalRequestEvent', 'notification'), ('CreateGoalRequest', 'request'), ('ApplyPatchApprovalParams', 'request_params'), ('AppsListResponse', 'response'), ('AppConfig', 'schema_config')])
    def test_domain(self, name, expected) -> None:
        assert config_struct_contract_domain(name) == expected

    def test_domain_rejects_unregistered(self) -> None:
        with pytest.raises(ConfigStructContractError):
            config_struct_contract_domain("bogus")

    def test_domain_members_partition(self) -> None:
        seen = []
        for domain in set(CONFIG_STRUCT_CONTRACT_DOMAIN.values()):
            seen.extend(config_struct_contract_domain_members(domain))
        assert sorted(seen) == sorted(CONFIG_STRUCT_CONTRACT_ELEMENTS)
        assert len(seen) == len(set(seen))

    def test_domain_members_rejects_unknown_domain(self) -> None:
        with pytest.raises(ConfigStructContractError):
            config_struct_contract_domain_members("bogus_domain")


class TestMembershipAndCopy:
    def test_is_fn_true_for_all(self) -> None:
        assert all(is_config_struct_contract(nm) for nm in CONFIG_STRUCT_CONTRACT_ELEMENTS)

    def test_is_fn_false_case_sensitive(self) -> None:
        first = "ActivePermissionProfile"
        assert first in CONFIG_STRUCT_CONTRACT_ELEMENTS
        assert not is_config_struct_contract(first.lower())
        assert not is_config_struct_contract("bogus")

    def test_names_returns_copy(self) -> None:
        a = config_struct_contract_names()
        a.append("bogus")
        assert "bogus" not in CONFIG_STRUCT_CONTRACT_ELEMENTS
        assert set(config_struct_contract_names()) == set(CONFIG_STRUCT_CONTRACT_ELEMENTS)

    def test_members_returns_immutable(self) -> None:
        domain = next(iter(set(CONFIG_STRUCT_CONTRACT_DOMAIN.values())))
        assert isinstance(config_struct_contract_domain_members(domain), tuple)


class TestConsistencyGate:
    @pytest.mark.parametrize("name,count", CONFIG_STRUCT_CONTRACT_ELEMENTS.items())
    def test_validate_ok(self, name, count) -> None:
        assert validate_config_struct_contract(name, count) == name

    @pytest.mark.parametrize("name,count", CONFIG_STRUCT_CONTRACT_ELEMENTS.items())
    def test_validate_rejects_wrong_count(self, name, count) -> None:
        with pytest.raises(ConfigStructContractError, match="元素数应为"):
            validate_config_struct_contract(name, count + 1)

    def test_ensure_rejects_unregistered(self) -> None:
        with pytest.raises(ConfigStructContractError):
            ensure_config_struct_contract("bogus")

    def test_count_rejects_unregistered(self) -> None:
        with pytest.raises(ConfigStructContractError):
            expected_config_struct_contract_element_count("bogus")


class TestReverseMutation:
    def test_verbatim_wire_names_case_sensitive(self) -> None:
        for nm in ("ActivePermissionProfile", "AdditionalFileSystemPermissions"):
            assert nm in CONFIG_STRUCT_CONTRACT_ELEMENTS
            assert nm.lower() not in CONFIG_STRUCT_CONTRACT_ELEMENTS

    def test_element_counts_pinned(self) -> None:
        assert set(CONFIG_STRUCT_CONTRACT_ELEMENTS.values()) == {2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 19, 21, 30, 34, 46, 106}
