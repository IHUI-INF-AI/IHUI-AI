# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""结构元数契约（ConfigStructContract，229 struct / 11 角色域） —— 统一工程规范 R62（结构元数契约·serde with-N-elements）。

取证（codex.exe 26.1111.2228.0，365MB Rust PE，strings 逐字 + ``struct variant X::Y with N element``
机器反推，见 R58 ``families.out`` / 本轮 ``docs/engineering/round11-reverse/R61-*.md``）：逐字 struct 名与
元素数表由机器从二进制抽取，模块内表与单测双重钉死。本仓归属过滤：该族在本仓 app/core 零命中或仅异层别名。

一轴超越：229 个 codex struct 的逐字元素数（serde `with N elements` 硬断言）+ 11 类结构角色域（Params/Response/Notification/Toml/…）+ 可执行反查。元素数取自身 serde 生成元信息，非人工推断；角色域由结构名后缀确定性归类，与元素数正交。本仓归属过滤：本域结构名在 app/core 零命中；22 个多元素数冲突结构已排除。

诚实边界：229 个 struct 名与元素数逐字确证（单值一致）；角色域分类是本仓后缀归类非对照原生判据；各 struct 的具体字段名因 camelCase 连体串不可可靠切分，已另立 disasm 开放轴。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "ConfigStructContract", "ConfigStructContractError", "CONFIG_STRUCT_CONTRACT_ELEMENTS", "CONFIG_STRUCT_CONTRACT_DOMAIN", "config_struct_contract_names", "expected_config_struct_contract_element_count",
    "ensure_config_struct_contract", "config_struct_contract_domain", "config_struct_contract_domain_members", "is_config_struct_contract", "validate_config_struct_contract",
]

# 逐字 struct 名 → 元素数（serde 硬断言）（来自 ``with N element`` 声明，漂移由 pytest 钉死）。
CONFIG_STRUCT_CONTRACT_ELEMENTS: Final[dict[str, int]] = {
    "ActivePermissionProfile": 2,
    "AdditionalFileSystemPermissions": 4,
    "AdditionalPermissionProfile": 2,
    "AgentRoleToml": 3,
    "AnnouncementTipRaw": 7,
    "AppBranding": 6,
    "AppConfig": 9,
    "AppInfo": 15,
    "AppLinkConfig": 2,
    "AppMetadata": 11,
    "AppRequirementToml": 2,
    "AppScreenshot": 3,
    "AppSummary": 5,
    "AppTemplateSummary": 9,
    "AppToolConfig": 2,
    "AppToolRequirementToml": 2,
    "AppToolResultSourceRequirementToml": 2,
    "AppToolSummary": 6,
    "Append": 4,
    "ApplicationNetworkRequirements": 2,
    "ApplicationRequirements": 2,
    "ApplicationRequirementsToml": 2,
    "ApplicationStorageRequirements": 2,
    "ApplyPatchApprovalParams": 5,
    "ApplyPatchApprovalRequestEvent": 6,
    "ApprovalMessages": 7,
    "AppsDefaultConfig": 5,
    "AppsInstalledParams": 2,
    "AppsListParams": 4,
    "AppsListResponse": 2,
    "AppsReadParams": 3,
    "AppsReadResponse": 2,
    "AsyncCompactionConfigToml": 2,
    "AutoReviewRequirementsToml": 2,
    "AutoReviewToml": 5,
    "AwsSigV4Config": 8,
    "BatchApp": 7,
    "BatchAppToolSummary": 6,
    "BedrockSettingsParams": 3,
    "BoardPermissions": 3,
    "BodySecretSubstitutionConfig": 3,
    "BrowserUseConfig": 3,
    "BrowserUseConfigToml": 3,
    "BrowserUseOriginPolicy": 7,
    "BrowserUseOriginPolicyConfig": 4,
    "BrowserUseOriginPolicyConfigToml": 4,
    "BrowserUseOriginPolicyToml": 7,
    "BrowserUseRequirementsToml": 7,
    "CatalogBudgetAllocation": 3,
    "CatalogSnapshot": 8,
    "ChannelPermissions": 4,
    "CloudConfigBundle": 2,
    "CloudConfigBundleCacheFile": 2,
    "CloudConfigBundleCacheSignedPayload": 6,
    "CloudConfigFragment": 3,
    "CodeModeConfigToml": 6,
    "CodeModeHostConfigToml": 2,
    "CodexAppsServerInfoDiskCache": 2,
    "CodexAppsToolsDiskCache": 4,
    "CommandExecutionRequestApprovalParams": 16,
    "ComputerUseConfig": 3,
    "ComputerUseConfigToml": 3,
    "ComputerUseRequirementsToml": 5,
    "ComputerUseWindowsConfig": 2,
    "ComputerUseWindowsConfigToml": 2,
    "ComputerUseWindowsExeConfig": 4,
    "ComputerUseWindowsExeConfigToml": 4,
    "ComputerUseWindowsExeRequirementToml": 4,
    "ComputerUseWindowsRequirementsToml": 2,
    "ConfigBatchWriteParams": 4,
    "ConfigEdit": 3,
    "ConfigLayer": 4,
    "ConfigLayerMetadata": 2,
    "ConfigProfile": 30,
    "ConfigReadParams": 2,
    "ConfigReadResponse": 3,
    "ConfigRequirements": 34,
    "ConfigRequirementsReadResponse": 2,
    "ConfigRequirementsToml": 46,
    "ConfigServerInput": 2,
    "ConfigToml": 106,
    "ConfigValueWriteParams": 5,
    "ConfigWarningNotification": 4,
    "ConfigWriteResponse": 4,
    "ConfiguredHookMatcherGroup": 2,
    "ConfiguredUpdater": 2,
    "CreateGoalRequest": 2,
    "CurrentTimeReminderConfigToml": 5,
    "CustomGatewaySettingsParams": 4,
    "DeliveredManagedLayers": 2,
    "DeliveredTomlFragment": 3,
    "DirectoryApp": 12,
    "EffectiveConfig": 2,
    "EnvironmentConfigLayer": 3,
    "EnvironmentConfigLayerStack": 2,
    "EnvironmentConfigReadParams": 3,
    "EnvironmentConfigReadResponse": 5,
    "EnvironmentToml": 10,
    "EnvironmentsToml": 3,
    "ExecApprovalRequestEvent": 17,
    "ExecCommandApprovalParams": 7,
    "ExecEnvPolicy": 5,
    "ExecServerNetworkPolicyRequest": 3,
    "ExperimentalFeature": 7,
    "ExperimentalFeatureListParams": 3,
    "ExperimentalFeatureListResponse": 2,
    "ExternalAgentConfigDetectParams": 6,
    "ExternalAgentConfigDetectResponse": 2,
    "ExternalAgentConfigImportCompletedNotification": 2,
    "ExternalAgentConfigImportFailureRecord": 7,
    "ExternalAgentConfigImportHistoryRecordParams": 2,
    "ExternalAgentConfigImportHistoryRecordSuccessParams": 5,
    "ExternalAgentConfigImportHistoryRecordTypeResultParams": 3,
    "ExternalAgentConfigImportItemTypeFailure": 7,
    "ExternalAgentConfigImportItemTypeSuccess": 5,
    "ExternalAgentConfigImportParams": 4,
    "ExternalAgentConfigImportProgressNotification": 2,
    "ExternalAgentConfigImportSuccessRecord": 5,
    "ExternalAgentConfigImportTypeResult": 3,
    "ExternalAgentConfigMigrationItem": 4,
    "ExternalConfigMigrationPrompts": 4,
    "FileChangeRequestApprovalParams": 6,
    "GcpSettingsParams": 4,
    "GhostSnapshotToml": 3,
    "GranularApprovalConfig": 5,
    "GuardianApprovalReview": 4,
    "GuardianAssessmentEvent": 14,
    "GuardianAssessmentPayload": 4,
    "GuardianElasticSectionConfigToml": 3,
    "GuardianRetainedOmissions": 2,
    "GuardianV2ConfigToml": 19,
    "GuardianV2ReviewScopeConfigToml": 2,
    "GuardianV2TranscriptConfigToml": 7,
    "GuardianWarningNotification": 2,
    "InstalledApp": 4,
    "ItemGuardianApprovalReviewCompletedNotification": 9,
    "ItemGuardianApprovalReviewStartedNotification": 7,
    "LegacyManagedConfigToml": 3,
    "LegacyPermissionProfile": 2,
    "ManagedHooksRequirements": 16,
    "MarketplaceAllowedSourceToml": 5,
    "MarketplaceRequirementsToml": 2,
    "McpAppUi": 2,
    "McpToolCallAppContext": 5,
    "MemoriesToml": 15,
    "MultiAgentV2ConfigToml": 21,
    "NetworkApprovalContext": 2,
    "NetworkHeaderInjectionToml": 4,
    "NetworkMitmHookToml": 9,
    "NetworkMitmTomlUnchecked": 3,
    "NetworkPolicyAmendment": 2,
    "NetworkPolicyDecisionNotification": 12,
    "NetworkPolicyRequestParams": 2,
    "NetworkProxyConfigToml": 14,
    "NetworkToml": 13,
    "NewThreadModelDefaultsToml": 3,
    "NonPrefixedMcpToolNamesConfigToml": 2,
    "OrchestratorToml": 2,
    "OtelConfigToml": 11,
    "OtelRequirementsToml": 11,
    "OtelTlsConfig": 3,
    "PatchApplyBeginEvent": 4,
    "PatchApplyEndEvent": 7,
    "PatchApplyUpdatedEvent": 2,
    "PermissionDeniedDetails": 2,
    "PermissionMessages": 9,
    "PermissionProfileListParams": 3,
    "PermissionProfileListResponse": 2,
    "PermissionProfileSummary": 3,
    "PermissionProfileToml": 5,
    "PermissionRequestDecisionWire": 5,
    "PermissionRequestHookSpecificOutputWire": 2,
    "PermissionSelectors": 2,
    "PermissionsRequestApprovalParams": 8,
    "PermissionsRequestApprovalResponse": 3,
    "PluginAppConfig": 2,
    "PreviousTurnSettings": 4,
    "RawFileSystemSandboxPolicy": 3,
    "RawFilesystemRequirementsToml": 6,
    "RawMarketplaceManifestPluginPolicy": 3,
    "RawMcpServerConfig": 30,
    "RawNetworkRequirementsToml": 15,
    "RealtimeAudioToml": 3,
    "RealtimeToml": 4,
    "RemoteAppTemplateResponse": 9,
    "RemoteMcpServerConfig": 2,
    "RemoteMessageBoardConfigToml": 3,
    "RemoteNetworkProxyLaunchConfig": 5,
    "RemotePluginCatalogDiskCache": 3,
    "RemoteSandboxConfigToml": 2,
    "RemovedAppsMcpPathOverrideConfigToml": 2,
    "RequestHeaderToml": 2,
    "RequestPermissionProfile": 2,
    "RequestPermissionsArgs": 3,
    "RequestPermissionsEvent": 7,
    "RequirementsExecPolicyPrefixRuleToml": 4,
    "RolloutBudgetConfigToml": 6,
    "RuntimeAgentInstancesConfigToml": 2,
    "ShellEnvironmentPolicyTomlRaw": 7,
    "SkillConfig": 3,
    "SkillPolicy": 2,
    "SkillsConfigWriteParams": 3,
    "SleepToolConfigToml": 2,
    "ThemeSettings": 30,
    "ThreadApproveGuardianDeniedActionParams": 2,
    "ThreadGoal": 8,
    "ThreadGoalClearParams": 2,
    "ThreadGoalSetParams": 5,
    "ThreadGoalUpdatedEvent": 3,
    "ThreadGoalUpdatedNotification": 3,
    "ThreadPrepareApprovedPlanParams": 3,
    "ThreadRealtimeAppendAudioParams": 2,
    "ThreadRealtimeAppendSpeechParams": 2,
    "ThreadRealtimeAppendTextParams": 3,
    "ThreadSectionAppearance": 2,
    "ThreadSettings": 15,
    "ThreadSettingsAppliedEvent": 2,
    "ThreadSettingsSnapshot": 15,
    "ThreadSettingsUpdateParams": 15,
    "ThreadSettingsUpdatedNotification": 2,
    "ToolRegistryConfigToml": 2,
    "ToolsToml": 4,
    "TruncationPolicyConfig": 2,
    "TuiApprovalKeymap": 8,
    "TurnSettingsUpdateParams": 8,
    "WebSearchToolConfig": 3,
    "WindowsRequirementsToml": 3,
    "WindowsSandboxProvisioningSettings": 2,
    "WindowsToml": 2,

}

# 本仓语义归类（非对照原生判据）：每个 variant 归入一个协议面域。
CONFIG_STRUCT_CONTRACT_DOMAIN: Final[dict[str, str]] = {
    "ActivePermissionProfile": "descriptor",
    "AdditionalFileSystemPermissions": "domain_object",
    "AdditionalPermissionProfile": "descriptor",
    "AgentRoleToml": "config_toml",
    "AnnouncementTipRaw": "domain_object",
    "AppBranding": "domain_object",
    "AppConfig": "schema_config",
    "AppInfo": "descriptor",
    "AppLinkConfig": "schema_config",
    "AppMetadata": "descriptor",
    "AppRequirementToml": "config_toml",
    "AppScreenshot": "domain_object",
    "AppSummary": "descriptor",
    "AppTemplateSummary": "descriptor",
    "AppToolConfig": "schema_config",
    "AppToolRequirementToml": "config_toml",
    "AppToolResultSourceRequirementToml": "config_toml",
    "AppToolSummary": "descriptor",
    "Append": "domain_object",
    "ApplicationNetworkRequirements": "capability",
    "ApplicationRequirements": "capability",
    "ApplicationRequirementsToml": "config_toml",
    "ApplicationStorageRequirements": "capability",
    "ApplyPatchApprovalParams": "request_params",
    "ApplyPatchApprovalRequestEvent": "notification",
    "ApprovalMessages": "domain_object",
    "AppsDefaultConfig": "schema_config",
    "AppsInstalledParams": "request_params",
    "AppsListParams": "request_params",
    "AppsListResponse": "response",
    "AppsReadParams": "request_params",
    "AppsReadResponse": "response",
    "AsyncCompactionConfigToml": "config_toml",
    "AutoReviewRequirementsToml": "config_toml",
    "AutoReviewToml": "config_toml",
    "AwsSigV4Config": "schema_config",
    "BatchApp": "domain_object",
    "BatchAppToolSummary": "descriptor",
    "BedrockSettingsParams": "request_params",
    "BoardPermissions": "domain_object",
    "BodySecretSubstitutionConfig": "schema_config",
    "BrowserUseConfig": "schema_config",
    "BrowserUseConfigToml": "config_toml",
    "BrowserUseOriginPolicy": "capability",
    "BrowserUseOriginPolicyConfig": "schema_config",
    "BrowserUseOriginPolicyConfigToml": "config_toml",
    "BrowserUseOriginPolicyToml": "config_toml",
    "BrowserUseRequirementsToml": "config_toml",
    "CatalogBudgetAllocation": "domain_object",
    "CatalogSnapshot": "domain_object",
    "ChannelPermissions": "domain_object",
    "CloudConfigBundle": "domain_object",
    "CloudConfigBundleCacheFile": "domain_object",
    "CloudConfigBundleCacheSignedPayload": "content",
    "CloudConfigFragment": "domain_object",
    "CodeModeConfigToml": "config_toml",
    "CodeModeHostConfigToml": "config_toml",
    "CodexAppsServerInfoDiskCache": "domain_object",
    "CodexAppsToolsDiskCache": "domain_object",
    "CommandExecutionRequestApprovalParams": "request_params",
    "ComputerUseConfig": "schema_config",
    "ComputerUseConfigToml": "config_toml",
    "ComputerUseRequirementsToml": "config_toml",
    "ComputerUseWindowsConfig": "schema_config",
    "ComputerUseWindowsConfigToml": "config_toml",
    "ComputerUseWindowsExeConfig": "schema_config",
    "ComputerUseWindowsExeConfigToml": "config_toml",
    "ComputerUseWindowsExeRequirementToml": "config_toml",
    "ComputerUseWindowsRequirementsToml": "config_toml",
    "ConfigBatchWriteParams": "request_params",
    "ConfigEdit": "domain_object",
    "ConfigLayer": "domain_object",
    "ConfigLayerMetadata": "descriptor",
    "ConfigProfile": "descriptor",
    "ConfigReadParams": "request_params",
    "ConfigReadResponse": "response",
    "ConfigRequirements": "capability",
    "ConfigRequirementsReadResponse": "response",
    "ConfigRequirementsToml": "config_toml",
    "ConfigServerInput": "domain_object",
    "ConfigToml": "config_toml",
    "ConfigValueWriteParams": "request_params",
    "ConfigWarningNotification": "notification",
    "ConfigWriteResponse": "response",
    "ConfiguredHookMatcherGroup": "domain_object",
    "ConfiguredUpdater": "domain_object",
    "CreateGoalRequest": "request",
    "CurrentTimeReminderConfigToml": "config_toml",
    "CustomGatewaySettingsParams": "request_params",
    "DeliveredManagedLayers": "domain_object",
    "DeliveredTomlFragment": "domain_object",
    "DirectoryApp": "domain_object",
    "EffectiveConfig": "schema_config",
    "EnvironmentConfigLayer": "domain_object",
    "EnvironmentConfigLayerStack": "domain_object",
    "EnvironmentConfigReadParams": "request_params",
    "EnvironmentConfigReadResponse": "response",
    "EnvironmentToml": "config_toml",
    "EnvironmentsToml": "config_toml",
    "ExecApprovalRequestEvent": "notification",
    "ExecCommandApprovalParams": "request_params",
    "ExecEnvPolicy": "capability",
    "ExecServerNetworkPolicyRequest": "request",
    "ExperimentalFeature": "domain_object",
    "ExperimentalFeatureListParams": "request_params",
    "ExperimentalFeatureListResponse": "response",
    "ExternalAgentConfigDetectParams": "request_params",
    "ExternalAgentConfigDetectResponse": "response",
    "ExternalAgentConfigImportCompletedNotification": "notification",
    "ExternalAgentConfigImportFailureRecord": "descriptor",
    "ExternalAgentConfigImportHistoryRecordParams": "request_params",
    "ExternalAgentConfigImportHistoryRecordSuccessParams": "request_params",
    "ExternalAgentConfigImportHistoryRecordTypeResultParams": "request_params",
    "ExternalAgentConfigImportItemTypeFailure": "error",
    "ExternalAgentConfigImportItemTypeSuccess": "domain_object",
    "ExternalAgentConfigImportParams": "request_params",
    "ExternalAgentConfigImportProgressNotification": "notification",
    "ExternalAgentConfigImportSuccessRecord": "descriptor",
    "ExternalAgentConfigImportTypeResult": "response",
    "ExternalAgentConfigMigrationItem": "content",
    "ExternalConfigMigrationPrompts": "domain_object",
    "FileChangeRequestApprovalParams": "request_params",
    "GcpSettingsParams": "request_params",
    "GhostSnapshotToml": "config_toml",
    "GranularApprovalConfig": "schema_config",
    "GuardianApprovalReview": "domain_object",
    "GuardianAssessmentEvent": "notification",
    "GuardianAssessmentPayload": "content",
    "GuardianElasticSectionConfigToml": "config_toml",
    "GuardianRetainedOmissions": "domain_object",
    "GuardianV2ConfigToml": "config_toml",
    "GuardianV2ReviewScopeConfigToml": "config_toml",
    "GuardianV2TranscriptConfigToml": "config_toml",
    "GuardianWarningNotification": "notification",
    "InstalledApp": "domain_object",
    "ItemGuardianApprovalReviewCompletedNotification": "notification",
    "ItemGuardianApprovalReviewStartedNotification": "notification",
    "LegacyManagedConfigToml": "config_toml",
    "LegacyPermissionProfile": "descriptor",
    "ManagedHooksRequirements": "capability",
    "MarketplaceAllowedSourceToml": "config_toml",
    "MarketplaceRequirementsToml": "config_toml",
    "McpAppUi": "domain_object",
    "McpToolCallAppContext": "domain_object",
    "MemoriesToml": "config_toml",
    "MultiAgentV2ConfigToml": "config_toml",
    "NetworkApprovalContext": "domain_object",
    "NetworkHeaderInjectionToml": "config_toml",
    "NetworkMitmHookToml": "config_toml",
    "NetworkMitmTomlUnchecked": "domain_object",
    "NetworkPolicyAmendment": "domain_object",
    "NetworkPolicyDecisionNotification": "notification",
    "NetworkPolicyRequestParams": "request_params",
    "NetworkProxyConfigToml": "config_toml",
    "NetworkToml": "config_toml",
    "NewThreadModelDefaultsToml": "config_toml",
    "NonPrefixedMcpToolNamesConfigToml": "config_toml",
    "OrchestratorToml": "config_toml",
    "OtelConfigToml": "config_toml",
    "OtelRequirementsToml": "config_toml",
    "OtelTlsConfig": "schema_config",
    "PatchApplyBeginEvent": "notification",
    "PatchApplyEndEvent": "notification",
    "PatchApplyUpdatedEvent": "notification",
    "PermissionDeniedDetails": "domain_object",
    "PermissionMessages": "domain_object",
    "PermissionProfileListParams": "request_params",
    "PermissionProfileListResponse": "response",
    "PermissionProfileSummary": "descriptor",
    "PermissionProfileToml": "config_toml",
    "PermissionRequestDecisionWire": "domain_object",
    "PermissionRequestHookSpecificOutputWire": "domain_object",
    "PermissionSelectors": "domain_object",
    "PermissionsRequestApprovalParams": "request_params",
    "PermissionsRequestApprovalResponse": "response",
    "PluginAppConfig": "schema_config",
    "PreviousTurnSettings": "schema_config",
    "RawFileSystemSandboxPolicy": "capability",
    "RawFilesystemRequirementsToml": "config_toml",
    "RawMarketplaceManifestPluginPolicy": "capability",
    "RawMcpServerConfig": "schema_config",
    "RawNetworkRequirementsToml": "config_toml",
    "RealtimeAudioToml": "config_toml",
    "RealtimeToml": "config_toml",
    "RemoteAppTemplateResponse": "response",
    "RemoteMcpServerConfig": "schema_config",
    "RemoteMessageBoardConfigToml": "config_toml",
    "RemoteNetworkProxyLaunchConfig": "schema_config",
    "RemotePluginCatalogDiskCache": "domain_object",
    "RemoteSandboxConfigToml": "config_toml",
    "RemovedAppsMcpPathOverrideConfigToml": "config_toml",
    "RequestHeaderToml": "config_toml",
    "RequestPermissionProfile": "descriptor",
    "RequestPermissionsArgs": "request_params",
    "RequestPermissionsEvent": "notification",
    "RequirementsExecPolicyPrefixRuleToml": "config_toml",
    "RolloutBudgetConfigToml": "config_toml",
    "RuntimeAgentInstancesConfigToml": "config_toml",
    "ShellEnvironmentPolicyTomlRaw": "domain_object",
    "SkillConfig": "schema_config",
    "SkillPolicy": "capability",
    "SkillsConfigWriteParams": "request_params",
    "SleepToolConfigToml": "config_toml",
    "ThemeSettings": "schema_config",
    "ThreadApproveGuardianDeniedActionParams": "request_params",
    "ThreadGoal": "domain_object",
    "ThreadGoalClearParams": "request_params",
    "ThreadGoalSetParams": "request_params",
    "ThreadGoalUpdatedEvent": "notification",
    "ThreadGoalUpdatedNotification": "notification",
    "ThreadPrepareApprovedPlanParams": "request_params",
    "ThreadRealtimeAppendAudioParams": "request_params",
    "ThreadRealtimeAppendSpeechParams": "request_params",
    "ThreadRealtimeAppendTextParams": "request_params",
    "ThreadSectionAppearance": "domain_object",
    "ThreadSettings": "schema_config",
    "ThreadSettingsAppliedEvent": "notification",
    "ThreadSettingsSnapshot": "domain_object",
    "ThreadSettingsUpdateParams": "request_params",
    "ThreadSettingsUpdatedNotification": "notification",
    "ToolRegistryConfigToml": "config_toml",
    "ToolsToml": "config_toml",
    "TruncationPolicyConfig": "schema_config",
    "TuiApprovalKeymap": "domain_object",
    "TurnSettingsUpdateParams": "request_params",
    "WebSearchToolConfig": "schema_config",
    "WindowsRequirementsToml": "config_toml",
    "WindowsSandboxProvisioningSettings": "schema_config",
    "WindowsToml": "config_toml",

}

_CLOSED_SET: Final[frozenset[str]] = frozenset(CONFIG_STRUCT_CONTRACT_ELEMENTS)


class ConfigStructContract(StrEnum):
    """对照协议面 variant（逐字登记，真相源）。"""

    ACTIVE_PERMISSION_PROFILE = "ActivePermissionProfile"
    ADDITIONAL_FILE_SYSTEM_PERMISSIONS = "AdditionalFileSystemPermissions"
    ADDITIONAL_PERMISSION_PROFILE = "AdditionalPermissionProfile"
    AGENT_ROLE_TOML = "AgentRoleToml"
    ANNOUNCEMENT_TIP_RAW = "AnnouncementTipRaw"
    APP_BRANDING = "AppBranding"
    APP_CONFIG = "AppConfig"
    APP_INFO = "AppInfo"
    APP_LINK_CONFIG = "AppLinkConfig"
    APP_METADATA = "AppMetadata"
    APP_REQUIREMENT_TOML = "AppRequirementToml"
    APP_SCREENSHOT = "AppScreenshot"
    APP_SUMMARY = "AppSummary"
    APP_TEMPLATE_SUMMARY = "AppTemplateSummary"
    APP_TOOL_CONFIG = "AppToolConfig"
    APP_TOOL_REQUIREMENT_TOML = "AppToolRequirementToml"
    APP_TOOL_RESULT_SOURCE_REQUIREMENT_TOML = "AppToolResultSourceRequirementToml"
    APP_TOOL_SUMMARY = "AppToolSummary"
    APPEND = "Append"
    APPLICATION_NETWORK_REQUIREMENTS = "ApplicationNetworkRequirements"
    APPLICATION_REQUIREMENTS = "ApplicationRequirements"
    APPLICATION_REQUIREMENTS_TOML = "ApplicationRequirementsToml"
    APPLICATION_STORAGE_REQUIREMENTS = "ApplicationStorageRequirements"
    APPLY_PATCH_APPROVAL_PARAMS = "ApplyPatchApprovalParams"
    APPLY_PATCH_APPROVAL_REQUEST_EVENT = "ApplyPatchApprovalRequestEvent"
    APPROVAL_MESSAGES = "ApprovalMessages"
    APPS_DEFAULT_CONFIG = "AppsDefaultConfig"
    APPS_INSTALLED_PARAMS = "AppsInstalledParams"
    APPS_LIST_PARAMS = "AppsListParams"
    APPS_LIST_RESPONSE = "AppsListResponse"
    APPS_READ_PARAMS = "AppsReadParams"
    APPS_READ_RESPONSE = "AppsReadResponse"
    ASYNC_COMPACTION_CONFIG_TOML = "AsyncCompactionConfigToml"
    AUTO_REVIEW_REQUIREMENTS_TOML = "AutoReviewRequirementsToml"
    AUTO_REVIEW_TOML = "AutoReviewToml"
    AWS_SIG_V4_CONFIG = "AwsSigV4Config"
    BATCH_APP = "BatchApp"
    BATCH_APP_TOOL_SUMMARY = "BatchAppToolSummary"
    BEDROCK_SETTINGS_PARAMS = "BedrockSettingsParams"
    BOARD_PERMISSIONS = "BoardPermissions"
    BODY_SECRET_SUBSTITUTION_CONFIG = "BodySecretSubstitutionConfig"
    BROWSER_USE_CONFIG = "BrowserUseConfig"
    BROWSER_USE_CONFIG_TOML = "BrowserUseConfigToml"
    BROWSER_USE_ORIGIN_POLICY = "BrowserUseOriginPolicy"
    BROWSER_USE_ORIGIN_POLICY_CONFIG = "BrowserUseOriginPolicyConfig"
    BROWSER_USE_ORIGIN_POLICY_CONFIG_TOML = "BrowserUseOriginPolicyConfigToml"
    BROWSER_USE_ORIGIN_POLICY_TOML = "BrowserUseOriginPolicyToml"
    BROWSER_USE_REQUIREMENTS_TOML = "BrowserUseRequirementsToml"
    CATALOG_BUDGET_ALLOCATION = "CatalogBudgetAllocation"
    CATALOG_SNAPSHOT = "CatalogSnapshot"
    CHANNEL_PERMISSIONS = "ChannelPermissions"
    CLOUD_CONFIG_BUNDLE = "CloudConfigBundle"
    CLOUD_CONFIG_BUNDLE_CACHE_FILE = "CloudConfigBundleCacheFile"
    CLOUD_CONFIG_BUNDLE_CACHE_SIGNED_PAYLOAD = "CloudConfigBundleCacheSignedPayload"
    CLOUD_CONFIG_FRAGMENT = "CloudConfigFragment"
    CODE_MODE_CONFIG_TOML = "CodeModeConfigToml"
    CODE_MODE_HOST_CONFIG_TOML = "CodeModeHostConfigToml"
    CODEX_APPS_SERVER_INFO_DISK_CACHE = "CodexAppsServerInfoDiskCache"
    CODEX_APPS_TOOLS_DISK_CACHE = "CodexAppsToolsDiskCache"
    COMMAND_EXECUTION_REQUEST_APPROVAL_PARAMS = "CommandExecutionRequestApprovalParams"
    COMPUTER_USE_CONFIG = "ComputerUseConfig"
    COMPUTER_USE_CONFIG_TOML = "ComputerUseConfigToml"
    COMPUTER_USE_REQUIREMENTS_TOML = "ComputerUseRequirementsToml"
    COMPUTER_USE_WINDOWS_CONFIG = "ComputerUseWindowsConfig"
    COMPUTER_USE_WINDOWS_CONFIG_TOML = "ComputerUseWindowsConfigToml"
    COMPUTER_USE_WINDOWS_EXE_CONFIG = "ComputerUseWindowsExeConfig"
    COMPUTER_USE_WINDOWS_EXE_CONFIG_TOML = "ComputerUseWindowsExeConfigToml"
    COMPUTER_USE_WINDOWS_EXE_REQUIREMENT_TOML = "ComputerUseWindowsExeRequirementToml"
    COMPUTER_USE_WINDOWS_REQUIREMENTS_TOML = "ComputerUseWindowsRequirementsToml"
    CONFIG_BATCH_WRITE_PARAMS = "ConfigBatchWriteParams"
    CONFIG_EDIT = "ConfigEdit"
    CONFIG_LAYER = "ConfigLayer"
    CONFIG_LAYER_METADATA = "ConfigLayerMetadata"
    CONFIG_PROFILE = "ConfigProfile"
    CONFIG_READ_PARAMS = "ConfigReadParams"
    CONFIG_READ_RESPONSE = "ConfigReadResponse"
    CONFIG_REQUIREMENTS = "ConfigRequirements"
    CONFIG_REQUIREMENTS_READ_RESPONSE = "ConfigRequirementsReadResponse"
    CONFIG_REQUIREMENTS_TOML = "ConfigRequirementsToml"
    CONFIG_SERVER_INPUT = "ConfigServerInput"
    CONFIG_TOML = "ConfigToml"
    CONFIG_VALUE_WRITE_PARAMS = "ConfigValueWriteParams"
    CONFIG_WARNING_NOTIFICATION = "ConfigWarningNotification"
    CONFIG_WRITE_RESPONSE = "ConfigWriteResponse"
    CONFIGURED_HOOK_MATCHER_GROUP = "ConfiguredHookMatcherGroup"
    CONFIGURED_UPDATER = "ConfiguredUpdater"
    CREATE_GOAL_REQUEST = "CreateGoalRequest"
    CURRENT_TIME_REMINDER_CONFIG_TOML = "CurrentTimeReminderConfigToml"
    CUSTOM_GATEWAY_SETTINGS_PARAMS = "CustomGatewaySettingsParams"
    DELIVERED_MANAGED_LAYERS = "DeliveredManagedLayers"
    DELIVERED_TOML_FRAGMENT = "DeliveredTomlFragment"
    DIRECTORY_APP = "DirectoryApp"
    EFFECTIVE_CONFIG = "EffectiveConfig"
    ENVIRONMENT_CONFIG_LAYER = "EnvironmentConfigLayer"
    ENVIRONMENT_CONFIG_LAYER_STACK = "EnvironmentConfigLayerStack"
    ENVIRONMENT_CONFIG_READ_PARAMS = "EnvironmentConfigReadParams"
    ENVIRONMENT_CONFIG_READ_RESPONSE = "EnvironmentConfigReadResponse"
    ENVIRONMENT_TOML = "EnvironmentToml"
    ENVIRONMENTS_TOML = "EnvironmentsToml"
    EXEC_APPROVAL_REQUEST_EVENT = "ExecApprovalRequestEvent"
    EXEC_COMMAND_APPROVAL_PARAMS = "ExecCommandApprovalParams"
    EXEC_ENV_POLICY = "ExecEnvPolicy"
    EXEC_SERVER_NETWORK_POLICY_REQUEST = "ExecServerNetworkPolicyRequest"
    EXPERIMENTAL_FEATURE = "ExperimentalFeature"
    EXPERIMENTAL_FEATURE_LIST_PARAMS = "ExperimentalFeatureListParams"
    EXPERIMENTAL_FEATURE_LIST_RESPONSE = "ExperimentalFeatureListResponse"
    EXTERNAL_AGENT_CONFIG_DETECT_PARAMS = "ExternalAgentConfigDetectParams"
    EXTERNAL_AGENT_CONFIG_DETECT_RESPONSE = "ExternalAgentConfigDetectResponse"
    EXTERNAL_AGENT_CONFIG_IMPORT_COMPLETED_NOTIFICATION = "ExternalAgentConfigImportCompletedNotification"
    EXTERNAL_AGENT_CONFIG_IMPORT_FAILURE_RECORD = "ExternalAgentConfigImportFailureRecord"
    EXTERNAL_AGENT_CONFIG_IMPORT_HISTORY_RECORD_PARAMS = "ExternalAgentConfigImportHistoryRecordParams"
    EXTERNAL_AGENT_CONFIG_IMPORT_HISTORY_RECORD_SUCCESS_PARAMS = "ExternalAgentConfigImportHistoryRecordSuccessParams"
    EXTERNAL_AGENT_CONFIG_IMPORT_HISTORY_RECORD_TYPE_RESULT_PARAMS = "ExternalAgentConfigImportHistoryRecordTypeResultParams"
    EXTERNAL_AGENT_CONFIG_IMPORT_ITEM_TYPE_FAILURE = "ExternalAgentConfigImportItemTypeFailure"
    EXTERNAL_AGENT_CONFIG_IMPORT_ITEM_TYPE_SUCCESS = "ExternalAgentConfigImportItemTypeSuccess"
    EXTERNAL_AGENT_CONFIG_IMPORT_PARAMS = "ExternalAgentConfigImportParams"
    EXTERNAL_AGENT_CONFIG_IMPORT_PROGRESS_NOTIFICATION = "ExternalAgentConfigImportProgressNotification"
    EXTERNAL_AGENT_CONFIG_IMPORT_SUCCESS_RECORD = "ExternalAgentConfigImportSuccessRecord"
    EXTERNAL_AGENT_CONFIG_IMPORT_TYPE_RESULT = "ExternalAgentConfigImportTypeResult"
    EXTERNAL_AGENT_CONFIG_MIGRATION_ITEM = "ExternalAgentConfigMigrationItem"
    EXTERNAL_CONFIG_MIGRATION_PROMPTS = "ExternalConfigMigrationPrompts"
    FILE_CHANGE_REQUEST_APPROVAL_PARAMS = "FileChangeRequestApprovalParams"
    GCP_SETTINGS_PARAMS = "GcpSettingsParams"
    GHOST_SNAPSHOT_TOML = "GhostSnapshotToml"
    GRANULAR_APPROVAL_CONFIG = "GranularApprovalConfig"
    GUARDIAN_APPROVAL_REVIEW = "GuardianApprovalReview"
    GUARDIAN_ASSESSMENT_EVENT = "GuardianAssessmentEvent"
    GUARDIAN_ASSESSMENT_PAYLOAD = "GuardianAssessmentPayload"
    GUARDIAN_ELASTIC_SECTION_CONFIG_TOML = "GuardianElasticSectionConfigToml"
    GUARDIAN_RETAINED_OMISSIONS = "GuardianRetainedOmissions"
    GUARDIAN_V2_CONFIG_TOML = "GuardianV2ConfigToml"
    GUARDIAN_V2_REVIEW_SCOPE_CONFIG_TOML = "GuardianV2ReviewScopeConfigToml"
    GUARDIAN_V2_TRANSCRIPT_CONFIG_TOML = "GuardianV2TranscriptConfigToml"
    GUARDIAN_WARNING_NOTIFICATION = "GuardianWarningNotification"
    INSTALLED_APP = "InstalledApp"
    ITEM_GUARDIAN_APPROVAL_REVIEW_COMPLETED_NOTIFICATION = "ItemGuardianApprovalReviewCompletedNotification"
    ITEM_GUARDIAN_APPROVAL_REVIEW_STARTED_NOTIFICATION = "ItemGuardianApprovalReviewStartedNotification"
    LEGACY_MANAGED_CONFIG_TOML = "LegacyManagedConfigToml"
    LEGACY_PERMISSION_PROFILE = "LegacyPermissionProfile"
    MANAGED_HOOKS_REQUIREMENTS = "ManagedHooksRequirements"
    MARKETPLACE_ALLOWED_SOURCE_TOML = "MarketplaceAllowedSourceToml"
    MARKETPLACE_REQUIREMENTS_TOML = "MarketplaceRequirementsToml"
    MCP_APP_UI = "McpAppUi"
    MCP_TOOL_CALL_APP_CONTEXT = "McpToolCallAppContext"
    MEMORIES_TOML = "MemoriesToml"
    MULTI_AGENT_V2_CONFIG_TOML = "MultiAgentV2ConfigToml"
    NETWORK_APPROVAL_CONTEXT = "NetworkApprovalContext"
    NETWORK_HEADER_INJECTION_TOML = "NetworkHeaderInjectionToml"
    NETWORK_MITM_HOOK_TOML = "NetworkMitmHookToml"
    NETWORK_MITM_TOML_UNCHECKED = "NetworkMitmTomlUnchecked"
    NETWORK_POLICY_AMENDMENT = "NetworkPolicyAmendment"
    NETWORK_POLICY_DECISION_NOTIFICATION = "NetworkPolicyDecisionNotification"
    NETWORK_POLICY_REQUEST_PARAMS = "NetworkPolicyRequestParams"
    NETWORK_PROXY_CONFIG_TOML = "NetworkProxyConfigToml"
    NETWORK_TOML = "NetworkToml"
    NEW_THREAD_MODEL_DEFAULTS_TOML = "NewThreadModelDefaultsToml"
    NON_PREFIXED_MCP_TOOL_NAMES_CONFIG_TOML = "NonPrefixedMcpToolNamesConfigToml"
    ORCHESTRATOR_TOML = "OrchestratorToml"
    OTEL_CONFIG_TOML = "OtelConfigToml"
    OTEL_REQUIREMENTS_TOML = "OtelRequirementsToml"
    OTEL_TLS_CONFIG = "OtelTlsConfig"
    PATCH_APPLY_BEGIN_EVENT = "PatchApplyBeginEvent"
    PATCH_APPLY_END_EVENT = "PatchApplyEndEvent"
    PATCH_APPLY_UPDATED_EVENT = "PatchApplyUpdatedEvent"
    PERMISSION_DENIED_DETAILS = "PermissionDeniedDetails"
    PERMISSION_MESSAGES = "PermissionMessages"
    PERMISSION_PROFILE_LIST_PARAMS = "PermissionProfileListParams"
    PERMISSION_PROFILE_LIST_RESPONSE = "PermissionProfileListResponse"
    PERMISSION_PROFILE_SUMMARY = "PermissionProfileSummary"
    PERMISSION_PROFILE_TOML = "PermissionProfileToml"
    PERMISSION_REQUEST_DECISION_WIRE = "PermissionRequestDecisionWire"
    PERMISSION_REQUEST_HOOK_SPECIFIC_OUTPUT_WIRE = "PermissionRequestHookSpecificOutputWire"
    PERMISSION_SELECTORS = "PermissionSelectors"
    PERMISSIONS_REQUEST_APPROVAL_PARAMS = "PermissionsRequestApprovalParams"
    PERMISSIONS_REQUEST_APPROVAL_RESPONSE = "PermissionsRequestApprovalResponse"
    PLUGIN_APP_CONFIG = "PluginAppConfig"
    PREVIOUS_TURN_SETTINGS = "PreviousTurnSettings"
    RAW_FILE_SYSTEM_SANDBOX_POLICY = "RawFileSystemSandboxPolicy"
    RAW_FILESYSTEM_REQUIREMENTS_TOML = "RawFilesystemRequirementsToml"
    RAW_MARKETPLACE_MANIFEST_PLUGIN_POLICY = "RawMarketplaceManifestPluginPolicy"
    RAW_MCP_SERVER_CONFIG = "RawMcpServerConfig"
    RAW_NETWORK_REQUIREMENTS_TOML = "RawNetworkRequirementsToml"
    REALTIME_AUDIO_TOML = "RealtimeAudioToml"
    REALTIME_TOML = "RealtimeToml"
    REMOTE_APP_TEMPLATE_RESPONSE = "RemoteAppTemplateResponse"
    REMOTE_MCP_SERVER_CONFIG = "RemoteMcpServerConfig"
    REMOTE_MESSAGE_BOARD_CONFIG_TOML = "RemoteMessageBoardConfigToml"
    REMOTE_NETWORK_PROXY_LAUNCH_CONFIG = "RemoteNetworkProxyLaunchConfig"
    REMOTE_PLUGIN_CATALOG_DISK_CACHE = "RemotePluginCatalogDiskCache"
    REMOTE_SANDBOX_CONFIG_TOML = "RemoteSandboxConfigToml"
    REMOVED_APPS_MCP_PATH_OVERRIDE_CONFIG_TOML = "RemovedAppsMcpPathOverrideConfigToml"
    REQUEST_HEADER_TOML = "RequestHeaderToml"
    REQUEST_PERMISSION_PROFILE = "RequestPermissionProfile"
    REQUEST_PERMISSIONS_ARGS = "RequestPermissionsArgs"
    REQUEST_PERMISSIONS_EVENT = "RequestPermissionsEvent"
    REQUIREMENTS_EXEC_POLICY_PREFIX_RULE_TOML = "RequirementsExecPolicyPrefixRuleToml"
    ROLLOUT_BUDGET_CONFIG_TOML = "RolloutBudgetConfigToml"
    RUNTIME_AGENT_INSTANCES_CONFIG_TOML = "RuntimeAgentInstancesConfigToml"
    SHELL_ENVIRONMENT_POLICY_TOML_RAW = "ShellEnvironmentPolicyTomlRaw"
    SKILL_CONFIG = "SkillConfig"
    SKILL_POLICY = "SkillPolicy"
    SKILLS_CONFIG_WRITE_PARAMS = "SkillsConfigWriteParams"
    SLEEP_TOOL_CONFIG_TOML = "SleepToolConfigToml"
    THEME_SETTINGS = "ThemeSettings"
    THREAD_APPROVE_GUARDIAN_DENIED_ACTION_PARAMS = "ThreadApproveGuardianDeniedActionParams"
    THREAD_GOAL = "ThreadGoal"
    THREAD_GOAL_CLEAR_PARAMS = "ThreadGoalClearParams"
    THREAD_GOAL_SET_PARAMS = "ThreadGoalSetParams"
    THREAD_GOAL_UPDATED_EVENT = "ThreadGoalUpdatedEvent"
    THREAD_GOAL_UPDATED_NOTIFICATION = "ThreadGoalUpdatedNotification"
    THREAD_PREPARE_APPROVED_PLAN_PARAMS = "ThreadPrepareApprovedPlanParams"
    THREAD_REALTIME_APPEND_AUDIO_PARAMS = "ThreadRealtimeAppendAudioParams"
    THREAD_REALTIME_APPEND_SPEECH_PARAMS = "ThreadRealtimeAppendSpeechParams"
    THREAD_REALTIME_APPEND_TEXT_PARAMS = "ThreadRealtimeAppendTextParams"
    THREAD_SECTION_APPEARANCE = "ThreadSectionAppearance"
    THREAD_SETTINGS = "ThreadSettings"
    THREAD_SETTINGS_APPLIED_EVENT = "ThreadSettingsAppliedEvent"
    THREAD_SETTINGS_SNAPSHOT = "ThreadSettingsSnapshot"
    THREAD_SETTINGS_UPDATE_PARAMS = "ThreadSettingsUpdateParams"
    THREAD_SETTINGS_UPDATED_NOTIFICATION = "ThreadSettingsUpdatedNotification"
    TOOL_REGISTRY_CONFIG_TOML = "ToolRegistryConfigToml"
    TOOLS_TOML = "ToolsToml"
    TRUNCATION_POLICY_CONFIG = "TruncationPolicyConfig"
    TUI_APPROVAL_KEYMAP = "TuiApprovalKeymap"
    TURN_SETTINGS_UPDATE_PARAMS = "TurnSettingsUpdateParams"
    WEB_SEARCH_TOOL_CONFIG = "WebSearchToolConfig"
    WINDOWS_REQUIREMENTS_TOML = "WindowsRequirementsToml"
    WINDOWS_SANDBOX_PROVISIONING_SETTINGS = "WindowsSandboxProvisioningSettings"
    WINDOWS_TOML = "WindowsToml"



class ConfigStructContractError(ValueError):
    """未登记的协议面 variant（封闭集/元素数/归类判据点名）。"""


def config_struct_contract_names() -> list[str]:
    """返回逐字 variant 名列表副本（顺序稳定，调用方改不动真相源）。"""
    return list(CONFIG_STRUCT_CONTRACT_ELEMENTS)


def expected_config_struct_contract_element_count(name: str) -> int:
    """该 variant 的逐字元素数（未登记抛错）。"""
    if not isinstance(name, str) or name not in _CLOSED_SET:
        raise ConfigStructContractError(f"未登记的 variant: {name!r} —— 先在 app/core/config_struct_contract.py 的 CONFIG_STRUCT_CONTRACT_ELEMENTS 登记")
    return CONFIG_STRUCT_CONTRACT_ELEMENTS[name]


def ensure_config_struct_contract(value: str) -> str:
    """值域闭合：登记过原样放行，未登记抛 :class:`ConfigStructContractError`。"""
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise ConfigStructContractError(f"未登记的 variant: {value!r} —— 先在 app/core/config_struct_contract.py 的 ConfigStructContract 登记后再产出")
    return value


def config_struct_contract_domain(value: str) -> str:
    """归类到协议面域（登记外抛错）。"""
    ensure_config_struct_contract(value)
    return CONFIG_STRUCT_CONTRACT_DOMAIN[value]


def config_struct_contract_domain_members(domain: str) -> tuple[str, ...]:
    """反查某域下的全部逐字 variant 名（元组副本，调用方改不动真相源）。"""
    if domain not in set(CONFIG_STRUCT_CONTRACT_DOMAIN.values()):
        raise ConfigStructContractError(f"未登记的域: {domain!r} —— 合法域: {sorted(set(CONFIG_STRUCT_CONTRACT_DOMAIN.values()))!r}")
    return tuple(nm for nm, dom in CONFIG_STRUCT_CONTRACT_DOMAIN.items() if dom == domain)


def is_config_struct_contract(value: str) -> bool:
    """封闭集成员判定（不改值、不抛错）。"""
    return isinstance(value, str) and value in _CLOSED_SET


def validate_config_struct_contract(name: str, element_count: int) -> str:
    """一致性守门：variant 名与元素数须同时匹配逐字表，否则抛错点名。"""
    ensure_config_struct_contract(name)
    expected = expected_config_struct_contract_element_count(name)
    if element_count != expected:
        raise ConfigStructContractError(f"{name!r} 的 struct 元素数应为 {expected}，实得 {element_count!r}")
    return name
