# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Serde struct catalog of the Codex binary (R77).

Every serde `expecting` message in `.rdata` of the form `struct <Name> with <N> element(s)` was
enumerated: **3186** templates covering **1436 distinct struct names**.  A name appears once per
crate copy / monomorphization, so 632 names carry more than one copy and **22** of them were printed with
*different* arities (the same struct name compiled twice with a different field count — e.g.
`Helper` at 2, 4 and 5).

This is the catalog the reconstruction rounds reference: R75 recovered field names for 277 of these
structs, and every one of those must be a member here.  Names and arities are read straight out of
the template text — no disassembly, no segmentation — so this table cannot be wrong in the same
way a segmentation can.
"""

from __future__ import annotations

from collections.abc import Mapping
from types import MappingProxyType
from typing import Final

TEMPLATE_TOTAL: Final[int] = 3186
STRUCT_COUNT: Final[int] = 1436
SINGLE_ARITY_COUNT: Final[int] = 1414
VARIANT_ARITY_COUNT: Final[int] = 22
MULTI_COPY_COUNT: Final[int] = 632

#: name -> arity, for the 1414 structs printed with exactly one arity.
STRUCT_ARITY: Final[Mapping[str, int]] = MappingProxyType({
    'AcceptedFileAudio': 4, 'AccountEntry': 11, 'AccountLoginCompletedNotification': 4, 'AccountOAuthProvenance': 2, 'AccountProfile': 3, 'AccountRateLimitsUpdatedNotification': 1,
    'AccountSecuritySetupAction': 2, 'AccountSecuritySetupNotice': 5, 'AccountSessionsSwitchParams': 3, 'AccountTokenUsageDailyBucket': 2, 'AccountTokenUsageSummary': 5, 'AccountUpdatedNotification': 2,
    'AccountUserAuthClaims': 2, 'AccountUserClaims': 1, 'ActivePermissionProfile': 2, 'ActiveUsersSummary': 3, 'AddAdHocNoteArgs': 2, 'AdditionalContextEntry': 3,
    'AdditionalFileSystemPermissions': 4, 'AdditionalNetworkPermissions': 1, 'AdditionalPermissionProfile': 2, 'AdditionalRateLimitDetails': 3, 'AgentIdentityAuthRecord': 8, 'AgentIdentityJwtClaims': 11,
    'AgentMessageContentDeltaEvent': 4, 'AgentMessageDeltaNotification': 4, 'AgentMessageDisplay': 4, 'AgentMessageEvent': 6, 'AgentMessageInvocationArgs': 1, 'AgentMessageItem': 7,
    'AgentMessageModeration': 2, 'AgentPluginMcpFile': 2, 'AgentReasoningEvent': 1, 'AgentReasoningRawContentEvent': 1, 'AgentRoleToml': 3, 'AgentsMdSnapshot': 2,
    'AnalyticsConfigToml': 1, 'AnimationSpec': 4, 'AnnotatedResponseItem': 2, 'Annotations': 3, 'AnnouncementTipDocument': 1, 'AnnouncementTipRaw': 7,
    'ApiKeyResponseCost': 2, 'ApiKeyTurnCost': 8, 'ApiKeyTurnCostsResponse': 1, 'ApiTokenMetadata': 3, 'AppBranding': 6, 'AppConfig': 9,
    'AppInfo': 15, 'AppLinkConfig': 2, 'AppListUpdatedNotification': 1, 'AppMetadata': 11, 'AppRequirementToml': 2, 'AppReview': 1,
    'AppScreenshot': 3, 'AppSummary': 5, 'AppTemplateSummary': 9, 'AppToolConfig': 2, 'AppToolRequirementToml': 2, 'AppToolResultSourceRequirementToml': 2,
    'AppToolSummary': 6, 'Append': 4, 'ApplicationNetworkRequirements': 2, 'ApplicationRequirements': 2, 'ApplicationRequirementsToml': 2, 'ApplicationStorageRequirements': 2,
    'ApplyPatchApprovalParams': 5, 'ApplyPatchApprovalRequestEvent': 6, 'ApplyPatchApprovalResponse': 1, 'ApprovalMessages': 7, 'AppsDefaultConfig': 5, 'AppsInstalledParams': 2,
    'AppsInstalledResponse': 1, 'AppsListParams': 4, 'AppsListResponse': 2, 'AppsReadParams': 3, 'AppsReadResponse': 2, 'ArchiveArguments': 2,
    'ArgumentInfo': 2, 'AssistantTurn': 1, 'AsyncCompactionConfigToml': 2, 'AsyncQuestionReply': 3, 'AsyncUserInputQuestion': 2, 'AttachmentThreadsCursor': 4,
    'AttestationGenerateResponse': 1, 'AudioContent': 4, 'AudioControls': 2, 'AudioDevice': 3, 'AudioDeviceSelection': 3, 'AudioState': 2,
    'AuthDotJson': 8, 'AuthRecoveryEvent': 2, 'AuthRecoveryNotification': 4, 'AutoReviewMessages': 5, 'AutoReviewRequirements': 2, 'AutoReviewRequirementsToml': 2,
    'AutoReviewToml': 5, 'AwsAuthRefreshConfig': 3, 'AwsSigV4Config': 8, 'BackendBanner': 10, 'BackendBannerCta': 2, 'BarrierArgs': 3,
    'BaseInstructions': 2, 'BatchApp': 7, 'BatchAppToolSummary': 6, 'BedrockAccessKeysAuth': 3, 'BedrockApiKeyAuth': 2, 'BedrockAwsProfile': 2,
    'BedrockCheckGovCloudRequirementsResponse': 2, 'BedrockDiscoverResponse': 2, 'BedrockEnvironmentCredential': 2, 'BedrockSettingsParams': 3, 'Block': 3, 'BoardNotification': 3,
    'BoardPermissions': 3, 'BodySecretReplacement': 2, 'BodySecretSubstitutionConfig': 3, 'BooleanSchema': 4, 'BrowserUseConfig': 3, 'BrowserUseConfigToml': 3,
    'BrowserUseExtensionRequirements': 1, 'BrowserUseExtensionRequirementsToml': 1, 'BrowserUseOriginPolicy': 7, 'BrowserUseOriginPolicyConfig': 4, 'BrowserUseOriginPolicyConfigToml': 4, 'BrowserUseOriginPolicyToml': 7,
    'BrowserUseRequirements': 7, 'BrowserUseRequirementsToml': 7, 'ByteRange': 2, 'CallToolResult': 4, 'Caller': 2, 'CancelLoginAccountParams': 1,
    'CancelLoginAccountResponse': 1, 'CancelledNotificationParam': 3, 'CapSids': 4, 'CapabilityLocation': 3, 'CapabilityRootDiscoverRequest': 3, 'CapabilityRootDiscovery': 7,
    'CapabilityRootsDiscoverParams': 1, 'CapabilityRootsDiscoverResponse': 1, 'CapabilityTextFile': 2, 'CatalogBudgetAllocation': 3, 'CatalogSnapshot': 8, 'CatalogUsage': 2,
    'ChannelPermissions': 4, 'ChannelSummary': 7, 'ChatGptAccountEntry': 3, 'ChatGptAccountInfo': 7, 'ChatgptAuthTokensRefreshParams': 2, 'ChatgptAuthTokensRefreshResponse': 3,
    'ChatgptThreadTurnCosts': 2, 'ChatgptTokenMetadata': 5, 'ChatgptTurnCost': 4, 'CheckoutInputs': 5, 'ClaimsForValidation': 5, 'ClickOperation': 2,
    'ClientActiveUsersCount': 2, 'ClientCapabilities': 5, 'ClientInfo': 3, 'ClientWorkspaceUsageCount': 11, 'CloseAgentArgs': 1, 'CloudConfigBundle': 2,
    'CloudConfigBundleCacheFile': 2, 'CloudConfigBundleCacheSignedPayload': 6, 'CloudConfigFragment': 3, 'CloudConfigTomlBundle': 1, 'CloudRequirementsFragment': 3, 'CloudRequirementsTomlBundle': 1,
    'CloudToml': 1, 'CodeEnvironment': 4, 'CodeModeConfigToml': 6, 'CodeModeExecResult': 4, 'CodeModeHostConfigToml': 2, 'CodeSuccessResp': 3,
    'CodexAppsServerInfoDiskCache': 2, 'CodexAppsToolsDiskCache': 4, 'CodexPackageManifest': 1, 'CodexWorkspaceMessage': 5, 'CollabAgentInteractionBeginEvent': 5, 'CollabAgentInteractionEndEvent': 8,
    'CollabAgentRef': 3, 'CollabAgentSpawnBeginEvent': 6, 'CollabAgentSpawnEndEvent': 10, 'CollabAgentState': 2, 'CollabAgentStatusEntry': 4, 'CollabAgentToolCallItem': 10,
    'CollabCloseBeginEvent': 4, 'CollabCloseEndEvent': 7, 'CollabResumeBeginEvent': 6, 'CollabResumeEndEvent': 7, 'CollabWaitingBeginEvent': 5, 'CollabWaitingEndEvent': 5,
    'CollaborationMode': 2, 'CollaborationModeListResponse': 1, 'CollaborationModeMask': 4, 'CollaborationModeMessages': 2, 'Color': 4, 'CommandExecOutputDeltaNotification': 4,
    'CommandExecParams': 14, 'CommandExecResizeParams': 2, 'CommandExecResponse': 3, 'CommandExecTerminalSize': 2, 'CommandExecTerminateParams': 1, 'CommandExecWriteParams': 3,
    'CommandExecutionItem': 13, 'CommandExecutionOutputDeltaNotification': 4, 'CommandExecutionRequestApprovalParams': 16, 'CommandExecutionRequestApprovalResponse': 1, 'CommandMigration': 1, 'CommandSession': 3,
    'CommandSessionsState': 3, 'CompactedItemWire': 13, 'CompactionResumeMetadata': 6, 'CompleteResult': 3, 'CompletionContext': 1, 'CompletionInfo': 3,
    'ComputerUseConfig': 3, 'ComputerUseConfigToml': 3, 'ComputerUseMacosConfig': 1, 'ComputerUseMacosConfigToml': 1, 'ComputerUseMacosRequirements': 1, 'ComputerUseMacosRequirementsToml': 1,
    'ComputerUseRequirements': 5, 'ComputerUseRequirementsToml': 5, 'ComputerUseWindowsConfig': 2, 'ComputerUseWindowsConfigToml': 2, 'ComputerUseWindowsExeConfig': 4, 'ComputerUseWindowsExeConfigToml': 4,
    'ComputerUseWindowsExeRequirement': 4, 'ComputerUseWindowsExeRequirementToml': 4, 'ComputerUseWindowsRequirements': 2, 'ComputerUseWindowsRequirementsToml': 2, 'ConfigBatchWriteParams': 4, 'ConfigEdit': 3,
    'ConfigLayer': 4, 'ConfigLayerMetadata': 2, 'ConfigProfile': 30, 'ConfigReadParams': 2, 'ConfigReadResponse': 3, 'ConfigRequirements': 34,
    'ConfigRequirementsReadResponse': 2, 'ConfigRequirementsToml': 46, 'ConfigServerInput': 2, 'ConfigToml': 106, 'ConfigValueWriteParams': 5, 'ConfigWarningNotification': 4,
    'ConfigWriteResponse': 4, 'ConfigurationReasoning': 1, 'ConfiguredHookMatcherGroup': 2, 'ConfiguredSettings': 1, 'ConfiguredUpdater': 2, 'ConnectorDirectoryDiskCache': 2,
    'ConnectorMetadata': 9, 'ConsentRecord': 8, 'ConsequentialToolMessageTemplate': 5, 'ConsequentialToolMessageTemplatesFile': 2, 'ConsequentialToolTemplateParam': 2, 'ConstTitle': 2,
    'ConsumeAccountRateLimitResetCreditParams': 2, 'ConsumeAccountRateLimitResetCreditResponse': 1, 'ConsumeRateLimitResetCreditResponse': 2, 'ConsumptionUsageGroup': 9, 'Context': 7, 'ContextCompactedNotification': 2,
    'ContextCompactionItem': 1, 'ContextId': 2, 'ContextManagementConfigToml': 1, 'CopyFileArgs': 4, 'CreateChannel': 3, 'CreateFileResponse': 4,
    'CreateGoalRequest': 2, 'CredentialExportConfig': 3, 'CredentialFrame': 4, 'CreditStatusDetails': 5, 'CreditUsageEventBySurface': 4, 'CreditUsageEventsResponse': 1,
    'CreditsSnapshot': 3, 'CuratedPluginsBackupArchiveResponse': 1, 'CurrentTimeReadParams': 1, 'CurrentTimeReadResponse': 1, 'CurrentTimeReminderConfigToml': 5, 'CurrentUserCreditUsageDatum': 2,
    'CurrentUserCreditUsageResponse': 5, 'CurrentUserCreditUsageSeries': 3, 'CustomGatewaySettingsParams': 4, 'DailyProductSurfaceUsage': 6, 'DailyProductSurfaceUsageResponse': 5, 'DailySkillUsageMetricsResponse': 3,
    'DailySkillUsageOverview': 2, 'DailyWorkspaceUsageCount': 5, 'DailyWorkspaceUsageCountResponse': 5, 'DeliveredManagedLayers': 2, 'DeliveredTomlFragment': 3, 'DeprecationNoticeEvent': 2,
    'DeprecationNoticeNotification': 2, 'DesktopInstallation': 2, 'DetectedExternalAgentSessionConnectorRecord': 2, 'DirectRegistrationResponse': 4, 'DirectoryApp': 12, 'DirectoryListResponse': 2,
    'DiscoverResult': 7, 'DiscoverV2CapabilitiesRequest': 2, 'DiscoverV2CapabilitiesResponse': 3, 'DiscoveredPluginFiles': 3, 'DiscoveredSkillFiles': 2, 'DispatchedToolPayload': 2,
    'DispatchedToolTraceRequestPayload': 3, 'DispatchedWriteStdinArgs': 4, 'DownloadLinkResponse': 6, 'DynamicToolCallItem': 9, 'DynamicToolCallParams': 6, 'DynamicToolCallRequest': 6,
    'DynamicToolCallResponse': 2, 'DynamicToolCallResponseEvent': 10, 'DynamicToolFunctionSpec': 4, 'DynamicToolNamespaceSpec': 3, 'DynamicToolsSnapshot': 2, 'DynamicToolsUpdatedPayload': 2,
    'EffectiveConfig': 2, 'ElicitResult': 3, 'ElicitationAbandonedEvent': 2, 'ElicitationCapability': 2, 'ElicitationRequestEvent': 4, 'ElicitationSchemaWire': 6,
    'EllipticCurveKeyParameters': 4, 'EmaResourceMetadata': 3, 'EmbeddedResource': 3, 'EnrollRemoteServerResponse': 4, 'EnteredReviewModeEvent': 4, 'EnteredReviewModeItem': 3,
    'EnvironmentAddParams': 6, 'EnvironmentConfigLayer': 3, 'EnvironmentConfigLayerStack': 2, 'EnvironmentConfigReadParams': 3, 'EnvironmentConfigReadResponse': 5, 'EnvironmentConnectionEvent': 1,
    'EnvironmentConnectionNotification': 2, 'EnvironmentInfo': 10, 'EnvironmentInfoParams': 1, 'EnvironmentInfoResponse': 2, 'EnvironmentRegistryConnectResponse': 6, 'EnvironmentRegistryHarnessKeyValidationResponse': 1,
    'EnvironmentRegistryRegistrationResponse': 4, 'EnvironmentShellInfo': 2, 'EnvironmentSkillsParams': 1, 'EnvironmentSnapshot': 5, 'EnvironmentStatus': 1, 'EnvironmentStatusParams': 1,
    'EnvironmentToml': 10, 'EnvironmentsSnapshot': 7, 'EnvironmentsToml': 3, 'Error': 6, 'ErrorData': 3, 'ErrorDetail': 1,
    'ErrorEnvelope': 1, 'ErrorEvent': 3, 'ErrorNotification': 4, 'ErrorPayload': 3, 'ExchangeResp': 1, 'ExchangeResponse': 5,
    'ExchangedTokens': 3, 'ExecApprovalRequestEvent': 17, 'ExecClosedNotification': 2, 'ExecCommandApprovalParams': 7, 'ExecCommandApprovalResponse': 1, 'ExecCommandArgs': 11,
    'ExecCommandBeginEvent': 11, 'ExecCommandBeginPayload': 4, 'ExecCommandEndEvent': 15, 'ExecCommandEndPayload': 3, 'ExecCommandOutputDeltaEvent': 3, 'ExecEnvPolicy': 5,
    'ExecExitedNotification': 4, 'ExecFileSystemSandboxEntry': 3, 'ExecOutputDeltaNotification': 4, 'ExecResponse': 2, 'ExecServerNetworkPolicyRequest': 3, 'ExecWaitArgs': 4,
    'ExecutableIdentity': 2, 'ExecutorPlugin': 7, 'ExecutorSkill': 7, 'ExitPayload': 2, 'ExitedReviewModeEvent': 3, 'ExitedReviewModeItem': 2,
    'ExperimentalFeature': 7, 'ExperimentalFeatureEnablementSetParams': 1, 'ExperimentalFeatureListParams': 3, 'ExperimentalFeatureListResponse': 2, 'ExportedCredentials': 4, 'ExternalAgentConfigDetectParams': 6,
    'ExternalAgentConfigDetectResponse': 2, 'ExternalAgentConfigImportCompletedNotification': 2, 'ExternalAgentConfigImportFailureRecord': 7, 'ExternalAgentConfigImportHistoryRecordParams': 2, 'ExternalAgentConfigImportHistoryRecordSuccessParams': 5, 'ExternalAgentConfigImportHistoryRecordTypeResultParams': 3,
    'ExternalAgentConfigImportItemTypeFailure': 7, 'ExternalAgentConfigImportItemTypeSuccess': 5, 'ExternalAgentConfigImportParams': 4, 'ExternalAgentConfigImportProgressNotification': 2, 'ExternalAgentConfigImportResponse': 1, 'ExternalAgentConfigImportSuccessRecord': 5,
    'ExternalAgentConfigImportTypeResult': 3, 'ExternalAgentConfigMigrationItem': 4, 'ExternalAgentDetectedConnectorCandidate': 3, 'ExternalConfigMigrationPrompts': 4, 'ExternalPullRequestResponse': 4, 'Failure': 2,
    'FallbackTokenEntry': 9, 'FeatureToggleToml': 1, 'FeedbackConfigToml': 1, 'FeedbackRequirements': 1, 'FeedbackSaveResponse': 3, 'FeedbackUploadParams': 6,
    'FeedbackUploadResponse': 2, 'FileChangeItem': 6, 'FileChangeOutputDeltaNotification': 4, 'FileChangePatchUpdatedNotification': 4, 'FileChangeRequestApprovalParams': 6, 'FileChangeRequestApprovalResponse': 1,
    'FileDescriptor': 2, 'FileSystemSandboxContext': 9, 'FileSystemSandboxEntry': 2, 'FileUpdateChange': 3, 'FinanceOperation': 3, 'FindOperation': 2,
    'FollowupTaskArgs': 2, 'FontStyle': 1, 'ForkArguments': 1, 'FormElicitationCapability': 1, 'FrameSpec': 4, 'FsCanonicalizeParams': 2,
    'FsCanonicalizeResponse': 1, 'FsChangedNotification': 2, 'FsCloseParams': 1, 'FsGetMetadataResponse': 6, 'FsHelperOpenParams': 2, 'FsHelperOpenResponse': 2,
    'FsMissingChangedNotification': 1, 'FsOpenResponse': 1, 'FsReadBlockParams': 3, 'FsReadBlockResponse': 2, 'FsReadDirectoryEntry': 3, 'FsReadDirectoryResponse': 1,
    'FsReadFileResponse': 1, 'FsUnwatchParams': 1, 'FsWalkParams': 3, 'FsWatchMissingParams': 3, 'FsWatchMissingResponse': 1, 'FsWatchParams': 2,
    'FsWriteBlockParams': 3, 'FunctionCallOutputItem': 4, 'FuzzyFileSearchParams': 3, 'FuzzyFileSearchResult': 6, 'FuzzyFileSearchSessionCompletedNotification': 1, 'FuzzyFileSearchSessionStartParams': 2,
    'FuzzyFileSearchSessionStopParams': 1, 'FuzzyFileSearchSessionUpdateParams': 2, 'FuzzyFileSearchSessionUpdatedNotification': 3, 'GatewayOAuthChangedNotification': 5, 'GatewayOAuthLoginParams': 2, 'GatewayOAuthLoginResponse': 1,
    'GatewayOAuthPrompt': 3, 'GatewayOAuthReadParams': 1, 'GatewayOAuthReadResponse': 6, 'GatewayOAuthSettings': 9, 'GcpSettingsParams': 4, 'GcpSetupParams': 3,
    'GeneratedRecap': 2, 'GeneratedThreadTitle': 1, 'GetAccountRateLimitsResponse': 6, 'GetAccountResponse': 4, 'GetAccountSecuritySetupResponse': 1, 'GetAccountTokenUsageParams': 1,
    'GetAccountTokenUsageResponse': 3, 'GetAppsResponse': 1, 'GetAuthStatusParams': 2, 'GetChannels': 4, 'GetPromptResult': 4, 'GetTaskResponse': 1,
    'GetWorkspaceMessagesResponse': 2, 'GhPullRequestApiItem': 3, 'GhPullRequestView': 3, 'GhRepoParent': 1, 'GhRepoView': 2, 'GhostSnapshotToml': 3,
    'GifOptions': 2, 'GitDiffToRemoteParams': 1, 'GitHubGitRefObject': 1, 'GitHubGitRefSummary': 1, 'GitHubRepositorySummary': 1, 'GitInfo': 3,
    'GitPullRequest': 16, 'GithubResponse': 1, 'GoalsToml': 1, 'GranularApprovalConfig': 5, 'GuardianApprovalReview': 4, 'GuardianAssessmentEvent': 14,
    'GuardianAssessmentPayload': 4, 'GuardianElasticSectionConfigToml': 3, 'GuardianRetainedOmissions': 2, 'GuardianV2ConfigToml': 19, 'GuardianV2ReviewScopeConfigToml': 2, 'GuardianV2TranscriptConfigToml': 7,
    'GuardianV3ConfigToml': 1, 'GuardianWarningNotification': 2, 'Header': 10, 'HistoryCursor': 4, 'HistoryEntry': 3, 'HistoryPosition': 3,
    'HomebrewCaskInfo': 1, 'HookCompletedEvent': 2, 'HookCompletedNotification': 3, 'HookErrorInfo': 2, 'HookMigration': 1, 'HookOutputEntry': 2,
    'HookPromptFragment': 2, 'HookPromptItem': 2, 'HookRunSummary': 14, 'HookStartedEvent': 2, 'HookStartedNotification': 3, 'HooksListEntry': 4,
    'HooksListParams': 2, 'HooksListResponse': 1, 'HostHello': 2, 'HttpHeader': 3, 'HttpRequestBodyDeltaNotification': 5, 'HttpRequestParams': 8,
    'HttpRequestResponse': 3, 'Icon': 4, 'IdJagClaims': 10, 'IdJagResponse': 7, 'IdeContext': 2, 'ImageContent': 4,
    'ImageData': 2, 'ImageGenerationBeginEvent': 1, 'ImageGenerationInputImage': 2, 'ImageGenerationItem': 5, 'ImageResponse': 5, 'ImageViewItem': 2,
    'ImagegenArgs': 5, 'Implementation': 6, 'ImportedExternalAgentSessionLedger': 2, 'ImportedExternalAgentSessionRecord': 7, 'InAppBrowserRequirements': 1, 'InAppBrowserRequirementsToml': 1,
    'InitializeCapabilities': 7, 'InitializeParams': 2, 'InitializeResult': 5, 'InstallationRecord': 5, 'InstallationsArgs': 3, 'InstalledApp': 4,
    'InstalledMarketplaceMetadata': 5, 'InstalledPlugin': 3, 'IntegerSchema': 6, 'InterAgentCommunication': 8, 'InterAgentCommunicationMetadataPayload': 1, 'InterruptAcknowledgement': 1,
    'InterruptAgentArgs': 1, 'InterruptedTurn': 5, 'ItemCompletedEvent': 6, 'ItemCompletedNotification': 5, 'ItemGuardianApprovalReviewCompletedNotification': 9, 'ItemGuardianApprovalReviewStartedNotification': 7,
    'ItemStartedEvent': 4, 'ItemStartedNotification': 4, 'JSONRPCError': 2, 'JSONRPCErrorError': 3, 'JSONRPCNotification': 2, 'JSONRPCRequest': 4,
    'JSONRPCResponse': 2, 'JsonSchema': 15, 'JwkSet': 1, 'JwtClaims': 4, 'LegacyDynamicToolSpec': 6, 'LegacyEnumSchema': 6,
    'LegacyManagedConfigToml': 3, 'LegacyOutput': 3, 'LegacyPermissionProfile': 2, 'ListAgentsArgs': 1, 'ListMcpServerStatusParams': 5, 'ListMcpServerStatusResponse': 2,
    'ListPromptsResult': 6, 'ListRemoteControlClientsResponse': 2, 'ListResourceTemplatesResult': 6, 'ListResourcesResult': 6, 'ListRootsResult': 2, 'ListThreads': 6,
    'ListToolsResult': 6, 'LocalShellExecAction': 5, 'LoggingMessageNotificationParam': 4, 'ManagedDeveloperInstructionsSnapshot': 1, 'ManagedHooksRequirements': 16, 'Manifest': 3,
    'MarketplaceAddParams': 3, 'MarketplaceAddResponse': 3, 'MarketplaceAllowedSourceToml': 5, 'MarketplaceInterface': 1, 'MarketplaceLoadErrorInfo': 2, 'MarketplaceNameMismatch': 2,
    'MarketplaceRemoveParams': 1, 'MarketplaceRemoveResponse': 2, 'MarketplaceRequirementsToml': 2, 'MarketplaceUpgradeErrorInfo': 2, 'MarketplaceUpgradeParams': 1, 'MarketplaceUpgradeResponse': 3,
    'MatchPattern': 6, 'McpAppUi': 2, 'McpAttribution': 3, 'McpAttributionSource': 5, 'McpElicitationBooleanSchema': 4, 'McpElicitationConstOption': 2,
    'McpElicitationLegacyTitledEnumSchema': 6, 'McpElicitationNumberSchema': 6, 'McpElicitationSchema': 4, 'McpElicitationStringSchema': 7, 'McpElicitationTitledEnumItems': 1, 'McpElicitationTitledMultiSelectEnumSchema': 7,
    'McpElicitationTitledSingleSelectEnumSchema': 5, 'McpElicitationUntitledEnumItems': 2, 'McpElicitationUntitledMultiSelectEnumSchema': 7, 'McpElicitationUntitledSingleSelectEnumSchema': 5, 'McpEnterpriseManagedAuthConfig': 1, 'McpInvocation': 3,
    'McpMedia': 2, 'McpResourceOrigin': 7, 'McpResourceOriginCheckpoint': 3, 'McpResourceReadParams': 7, 'McpResourceReadResponse': 2, 'McpResourceReadTarget': 2,
    'McpServerCommandMatcher': 2, 'McpServerElicitationRequestResponse': 3, 'McpServerEventNotification': 2, 'McpServerEventStreamNotification': 2, 'McpServerEventStreamStartParams': 6, 'McpServerEventStreamStopParams': 1,
    'McpServerIdpOAuthConfig': 4, 'McpServerInfo': 6, 'McpServerMigration': 1, 'McpServerOauthLoginCompletedNotification': 5, 'McpServerOauthLoginParams': 5, 'McpServerOauthLoginResponse': 2,
    'McpServerStatus': 12, 'McpServerStatusUpdatedNotification': 5, 'McpServerToolCallParams': 5, 'McpStartupCompleteEvent': 3, 'McpStartupFailure': 2, 'McpStartupUpdateEvent': 2,
    'McpToolCallAppContext': 5, 'McpToolCallBeginEvent': 11, 'McpToolCallEndEvent': 13, 'McpToolCallError': 1, 'McpToolCallItem': 16, 'McpToolCallProgressNotification': 4,
    'McpToolCallResult': 3, 'MemoriesToml': 15, 'MemoryCitation': 2, 'MemoryCitationEntry': 4, 'MemoryStatusParams': 1, 'MisalignmentErrorDetails': 4,
    'MisalignmentSteer': 1, 'MockExperimentalMethodParams': 1, 'Model': 19, 'ModelAccessPrograms': 1, 'ModelActivitySummary': 4, 'ModelAvailabilityNux': 1,
    'ModelHint': 1, 'ModelInfoUpgrade': 3, 'ModelListParams': 4, 'ModelListResponse': 2, 'ModelMessages': 14, 'ModelPreferences': 4,
    'ModelProviderAuthInfo': 5, 'ModelProviderAwsAuthInfo': 4, 'ModelProviderCapabilities': 3, 'ModelProviderConfigWriteParams': 1, 'ModelProviderConfigWriteResponse': 1, 'ModelProviderInfo': 24,
    'ModelProviderListResponse': 3, 'ModelProviderSummary': 5, 'ModelRerouteEvent': 3, 'ModelReroutedNotification': 5, 'ModelSafetyBufferingUpdatedNotification': 7, 'ModelServiceTier': 3,
    'ModelTokenBudgetConfig': 7, 'ModelUpgradeInfo': 5, 'ModelUsage': 13, 'ModelVerificationEvent': 1, 'ModelVerificationNotification': 3, 'ModelsCacheEntry': 5,
    'ModelsRequirements': 1, 'ModelsRequirementsToml': 1, 'ModelsResponse': 1, 'MultiAgentMessages': 2, 'MultiAgentModeMessages': 3, 'MultiAgentModeState': 2,
    'MultiAgentRoleMessages': 2, 'MultiAgentV2ConfigToml': 21, 'MxcCommand': 5, 'Network': 2, 'NetworkApprovalContext': 2, 'NetworkHeaderInjectionToml': 4,
    'NetworkMitmHookToml': 9, 'NetworkMitmTomlUnchecked': 3, 'NetworkPermissions': 1, 'NetworkPolicyAmendment': 2, 'NetworkPolicyDecisionNotification': 12, 'NetworkPolicyRequestParams': 2,
    'NetworkPolicyRequestResponse': 1, 'NetworkProxyAuditMetadata': 9, 'NetworkProxyConfigToml': 14, 'NetworkRequirements': 14, 'NetworkToml': 13, 'NewThreadModelDefaults': 3,
    'NewThreadModelDefaultsToml': 3, 'NodeReplExecOutput': 2, 'NoiseChannelPublicKey': 3, 'NonPrefixedMcpToolNamesConfigToml': 2, 'NpmPackageDist': 2, 'NpmPackageInfo': 2,
    'NpmPackageMetadata': 1, 'NpmPackageVersionInfo': 1, 'NumberSchema': 6, 'OAuthError': 1, 'OAuthIdentity': 14, 'OAuthSessionConfig': 7,
    'OAuthSource': 6, 'OctetKeyPairParameters': 3, 'OctetKeyParameters': 2, 'OidcClaims': 5, 'OpenAiFormRequestParams': 3, 'OpenOperation': 2,
    'OrchestratorToml': 2, 'OtelConfigToml': 11, 'OtelRequirements': 11, 'OtelRequirementsToml': 11, 'OtelTlsConfig': 3, 'OtelToolResultLogConfig': 1,
    'OutputDiff': 1, 'OutputEnvelope': 2, 'OutputMeasurement': 3, 'OutputPayload': 2, 'OverriddenMetadata': 3, 'OwnerRecord': 2,
    'Page': 2, 'PaginatedListTaskListItem': 2, 'PatchApplyBeginEvent': 4, 'PatchApplyEndEvent': 7, 'PatchApplyUpdatedEvent': 2, 'PermissionDeniedDetails': 2,
    'PermissionMessages': 9, 'PermissionProfileListParams': 3, 'PermissionProfileListResponse': 2, 'PermissionProfileSummary': 3, 'PermissionProfileToml': 5, 'PermissionRequestDecisionWire': 5,
    'PermissionRequestHookSpecificOutputWire': 2, 'PermissionSelectors': 2, 'PermissionsRequestApprovalParams': 8, 'PermissionsRequestApprovalResponse': 3, 'PersistentDenyReadAclState': 1, 'PersistentModeSnapshot': 1,
    'PersonalAccessTokenMetadata': 5, 'PersonalUsageAttribution': 5, 'PetFile': 6, 'PidRecord': 4, 'PlanDeltaEvent': 4, 'PlanDeltaNotification': 4,
    'PlanItem': 2, 'PlanItemArg': 2, 'PlanLimitBreakdown': 2, 'PlanLimitHistory': 6, 'PlanLimitPeriod': 8, 'PlanLimitValue': 2,
    'PluginAppConfig': 2, 'PluginDetail': 12, 'PluginHookSummary': 2, 'PluginInstallParams': 4, 'PluginInstallResponse': 2, 'PluginInstalledParams': 2,
    'PluginInstalledResponse': 2, 'PluginInterface': 19, 'PluginListParams': 3, 'PluginListResponse': 3, 'PluginManifest': 3, 'PluginManifestInterface': 1,
    'PluginManifestMetadata': 4, 'PluginMarketplaceEntry': 4, 'PluginMcpRequirements': 1, 'PluginMcpServersFile': 1, 'PluginReadParams': 3, 'PluginReadResponse': 1,
    'PluginReconcileParams': 1, 'PluginSearchParams': 5, 'PluginShareCheckoutParams': 1, 'PluginShareContext': 8, 'PluginShareDeleteParams': 1, 'PluginSharePrincipal': 4,
    'PluginShareSaveParams': 4, 'PluginShareTarget': 3, 'PluginShareUpdateTargetsParams': 3, 'PluginSkillReadParams': 3, 'PluginSummary': 19, 'PluginUninstallParams': 1,
    'PluginUsageBucket': 2, 'PluginUsageMetricsResponse': 3, 'PluginUsageOverview': 5, 'PluginsMigration': 2, 'Position': 2, 'Post': 5,
    'PostMetadata': 5, 'PostToolUseHookSpecificOutputWire': 3, 'PrOutputItem': 1, 'PreToolUseHookSpecificOutputWire': 5, 'PrecomputedExports': 3, 'PreviousTurnSettings': 4,
    'ProcessExitedNotification': 7, 'ProcessKillParams': 1, 'ProcessOutputChunk': 3, 'ProcessOutputDeltaNotification': 4, 'ProcessResizePtyParams': 2, 'ProcessSpawnParams': 10,
    'ProcessTerminalSize': 2, 'ProcessWriteStdinParams': 3, 'ProductSurfacePremiumUsageValues': 7, 'ProfileIdentity': 2, 'ProfileInvocation': 4, 'ProfileMetadata': 2,
    'ProgressNotificationParam': 5, 'ProjectChangedNotification': 2, 'ProjectConfig': 1, 'ProjectCreateParams': 4, 'ProjectDeleteParams': 1, 'ProjectImportParams': 5,
    'ProjectListParams': 4, 'ProjectMcpServerMetadata': 2, 'ProjectMoveParams': 2, 'ProjectReadParams': 1, 'ProjectRoot': 1, 'ProjectTrustConfigToml': 1,
    'ProjectUpdateParams': 4, 'Prompt': 6, 'PromptArgument': 4, 'PromptMessage': 2, 'PromptReference': 2, 'PromptsCapability': 1,
    'Proof': 2, 'Proxy': 2, 'ProxyOptionalParam': 2, 'QueuedSubmission': 4, 'QuickDial': 2, 'RSAKeyParameters': 3,
    'Range': 2, 'RateLimitEvent': 6, 'RateLimitEventCredits': 3, 'RateLimitEventDetails': 2, 'RateLimitEventWindow': 3, 'RateLimitReachedType': 1,
    'RateLimitResetCredit': 7, 'RateLimitResetCreditDetails': 7, 'RateLimitResetCreditsDetails': 2, 'RateLimitSnapshot': 10, 'RateLimitStatusDetails': 4, 'RateLimitWindow': 3,
    'RateLimitWindowSnapshot': 4, 'RawAgentPluginManifest': 9, 'RawFileSystemSandboxEntry': 3, 'RawFileSystemSandboxPolicy': 3, 'RawFilesystemRequirementsToml': 6, 'RawMarketplaceManifest': 3,
    'RawMarketplaceManifestPluginPolicy': 3, 'RawMcpServerCommandIdentity': 1, 'RawMcpServerConfig': 30, 'RawMcpServerRequirement': 1, 'RawMcpServerUrlIdentity': 1, 'RawNetworkRequirementsToml': 15,
    'RawPayloadRef': 3, 'RawResponseCompletedEvent': 3, 'RawResponseCompletedNotification': 5, 'RawResponseItemCompletedNotification': 3, 'RawResponseItemEvent': 1, 'RawTraceEvent': 7,
    'ReadArgs': 3, 'ReadArguments': 5, 'ReadParams': 4, 'ReadPost': 3, 'ReadResourceArgs': 2, 'ReadResourceResult': 5,
    'ReadThread': 4, 'RealtimeAudioFrame': 5, 'RealtimeAudioToml': 3, 'RealtimeConversationClosedEvent': 1, 'RealtimeConversationListVoicesResponseEvent': 1, 'RealtimeConversationRealtimeEvent': 1,
    'RealtimeConversationSdpEvent': 1, 'RealtimeConversationStartedEvent': 2, 'RealtimeHandoffRequested': 4, 'RealtimeInputAudioSpeechStarted': 1, 'RealtimeNoopRequested': 2, 'RealtimeResponseCancelled': 1,
    'RealtimeResponseCreated': 1, 'RealtimeResponseDone': 1, 'RealtimeSnapshot': 1, 'RealtimeToml': 4, 'RealtimeTranscriptDelta': 1, 'RealtimeTranscriptDone': 1,
    'RealtimeTranscriptEntry': 2, 'RealtimeVoicesList': 5, 'ReasoningContentDeltaEvent': 5, 'ReasoningEffortOption': 2, 'ReasoningEffortPreset': 2, 'ReasoningItem': 3,
    'ReasoningRawContentDeltaEvent': 5, 'ReasoningSummaryPartAddedNotification': 4, 'ReasoningSummaryTextDeltaNotification': 5, 'ReasoningTextDeltaNotification': 5, 'RecommendedPluginInstallArgs': 2, 'RecommendedPluginItem': 3,
    'RecommendedPluginsResponse': 2, 'RecoverySnapshot': 1, 'RefreshResponse': 3, 'RegisterAgentResponse': 1, 'RegistryError': 2, 'RegistryErrorBody': 2,
    'ReleaseInfo': 1, 'RemoteAppTemplateResponse': 9, 'RemoteControlClientResponse': 8, 'RemoteControlClientsListParams': 4, 'RemoteControlClientsRevokeParams': 2, 'RemoteControlDisableResponse': 4,
    'RemoteControlEnableResponse': 4, 'RemoteControlPairingStartResponse': 4, 'RemoteControlPairingStatusParams': 2, 'RemoteControlPairingStatusResponse': 1, 'RemoteControlStatusChangedNotification': 4, 'RemoteMcpServerConfig': 2,
    'RemoteMessageBoardConfigToml': 3, 'RemoteNetworkProxyLaunchConfig': 5, 'RemotePluginCatalogDiskCache': 3, 'RemotePluginDirectoryItem': 18, 'RemotePluginDirectorySharePrincipal': 4, 'RemotePluginInstallMetadata': 2,
    'RemotePluginInstalledResponse': 2, 'RemotePluginListResponse': 2, 'RemotePluginMcpServerResponse': 1, 'RemotePluginMutationResponse': 3, 'RemotePluginPagination': 1, 'RemotePluginReleaseInterfaceResponse': 15,
    'RemotePluginReleaseResponse': 13, 'RemotePluginSharePrincipal': 4, 'RemotePluginShareUpdateTargetsResponse': 2, 'RemotePluginSkillDetailResponse': 3, 'RemotePluginSkillInterfaceResponse': 6, 'RemotePluginSkillResponse': 3,
    'RemoteSandboxConfigToml': 2, 'RemoteWorkspacePluginCreateResponse': 3, 'RemoteWorkspacePluginUploadUrlResponse': 3, 'RemovedAppsMcpPathOverrideConfigToml': 2, 'RequestHeader': 2, 'RequestHeaderToml': 2,
    'RequestParams': 5, 'RequestPermissionProfile': 2, 'RequestPermissionsArgs': 3, 'RequestPermissionsEnvironmentArgs': 1, 'RequestPermissionsEvent': 7, 'RequestPluginInstallArgs': 4,
    'RequestUserInputAnswer': 1, 'RequestUserInputAsyncArgs': 1, 'RequestUserInputQuestion': 6, 'RequestUserInputQuestionOption': 2, 'RequestUserInputResponse': 1, 'RequestUserInputToolArgs': 1,
    'RequiredInput': 2, 'RequirementsExecPolicyPatternTokenToml': 2, 'RequirementsExecPolicyPrefixRuleToml': 4, 'RequirementsExecPolicyToml': 1, 'ReserveReturnModel': 3, 'ResizePayload': 2,
    'Resource': 9, 'ResourceSerde': 9, 'ResourceServerMetadata': 4, 'ResourceTemplateReference': 1, 'ResourceTemplateSerde': 6, 'ResourceTokenResponse': 7,
    'ResourceUpdatedNotificationParam': 2, 'ResourcesCapability': 2, 'Response': 1, 'ResponseCompleted': 4, 'ResponseCompletedInputTokensDetails': 2, 'ResponseCompletedOutputTokensDetails': 1,
    'ResponseCompletedUsage': 6, 'ResponseUsageMetadata': 2, 'ResponsesStreamEvent': 14, 'ResumeAgentArgs': 1, 'RetainedContext': 9, 'RetainedSource': 3,
    'RetainedSourceId': 3, 'ReviewCodeLocation': 2, 'ReviewFinding': 5, 'ReviewLineRange': 2, 'ReviewOutputEvent': 4, 'ReviewStartParams': 3,
    'ReviewStartResponse': 2, 'RolloutBudgetConfigToml': 6, 'RolloutLineType': 1, 'Root': 3, 'RootsCapabilities': 1, 'RuntimeAccountRegistration': 4,
    'RuntimeAgentInstancesConfigToml': 2, 'RuntimeRegistration': 5, 'RuntimeRegistrationResponse': 3, 'SafetyBuffering': 3, 'SafetyBufferingEvent': 5, 'SamplingCapability': 2,
    'SamplingMessage': 3, 'SandboxProvisioningRequest': 5, 'SandboxState': 5, 'SandboxUserRecord': 2, 'SandboxUsersFile': 3, 'ScheduledTaskSummary': 4,
    'ScopeSelector': 2, 'ScopeStack': 2, 'ScreenshotOperation': 2, 'SearchArgs': 8, 'SearchCommands': 12, 'SearchCursor': 4,
    'SearchPosts': 7, 'SearchQuery': 3, 'SearchResponse': 3, 'SearchToolCallParams': 2, 'SecretsFile': 2, 'SecurityRiskScore': 4,
    'SelectedCapabilityRoot': 2, 'SendAddCreditsNudgeEmailParams': 1, 'SendAddCreditsNudgeEmailResponse': 1, 'SendArguments': 3, 'SendInputArgs': 4, 'SendMessageArgs': 2,
    'SendMessageToUserAsyncArgs': 1, 'SenderUserMessages': 3, 'ServerCapabilities': 7, 'ServerRequestResolvedNotification': 2, 'SessionContextWindow': 1, 'SessionIndexEntry': 3,
    'SessionManifest': 2, 'SessionMigration': 3, 'SessionNetworkProxyRuntime': 2, 'SessionStartHookSpecificOutputWire': 2, 'Settings': 3, 'SetupErrorReport': 2,
    'SetupMarker': 6, 'ShellEnvironmentPolicyTomlRaw': 7, 'ShellInfo': 2, 'ShellSnapshotRequest': 2, 'SignalParams': 2, 'SkillConfig': 3,
    'SkillDependencies': 1, 'SkillDiscoveryRoot': 2, 'SkillEntrySnapshot': 3, 'SkillErrorInfo': 2, 'SkillInterface': 8, 'SkillMetadata': 9,
    'SkillMigration': 1, 'SkillPolicy': 2, 'SkillSummary': 6, 'SkillUsageOverview': 4, 'SkillsConfigWriteParams': 3, 'SkillsConfigWriteResponse': 1,
    'SkillsExtraRootsSetParams': 1, 'SkillsListEntry': 3, 'SkillsListResponse': 1, 'SleepArgs': 1, 'SleepItem': 2, 'SleepToolConfigToml': 2,
    'Snapshot': 1, 'SnapshotSkill': 7, 'SourceMessage': 3, 'SpawnReady': 1, 'SpawnRequest': 13, 'SpendControlLimitDetails': 8,
    'SpendControlLimitSnapshot': 4, 'SpendControlStatusDetails': 2, 'SportsOperation': 9, 'StandardErrorResponse': 3, 'StartRemoteControlPairingResponse': 5, 'Status': 1,
    'StatusArguments': 1, 'StdinPayload': 1, 'StopSettings': 1, 'StoreManifest': 4, 'StoredOAuthTokens': 6, 'StoredPost': 2,
    'StoredToken': 4, 'StoredTurnError': 3, 'StreamErrorEvent': 3, 'StrictReviewRequiredNotification': 3, 'StringSchema': 7, 'StripAction': 1,
    'StyleModifier': 3, 'SubAgentActivityEvent': 7, 'SubAgentActivityItem': 6, 'SubagentMigration': 1, 'SubagentStartHookSpecificOutputWire': 2, 'Subscription': 3,
    'SubscriptionState': 5, 'SubscriptionsAcknowledgedNotificationParams': 2, 'SubscriptionsListenResult': 2, 'Suggestion': 2, 'SummaryOutput': 2, 'SyntaxReference': 7,
    'SyntaxSet': 2, 'TargetedAnswerModeration': 3, 'TaskListItem': 9, 'TaskUsageResponse': 2, 'TerminalInteractionEvent': 3, 'TerminalInteractionNotification': 5,
    'TerminalSessionArgs': 1, 'TerminateParams': 1, 'TerminateResponse': 1, 'TextContent': 3, 'TextElement': 2, 'TextPosition': 2,
    'TextRange': 2, 'Theme': 4, 'ThemeItem': 2, 'ThemeSettings': 30, 'ThreadApproveGuardianDeniedActionParams': 2, 'ThreadArchiveParams': 1,
    'ThreadArchivedNotification': 1, 'ThreadAttachment': 5, 'ThreadAttachmentAddParams': 4, 'ThreadAttachmentAddResponse': 2, 'ThreadAttachmentListParams': 3, 'ThreadAttachmentListResponse': 2,
    'ThreadAttachmentOwnerListParams': 5, 'ThreadAttachmentRemoveParams': 3, 'ThreadAttachmentUpdatedNotification': 5, 'ThreadBackgroundTerminal': 7, 'ThreadBackgroundTerminalsCleanParams': 1, 'ThreadBackgroundTerminalsListParams': 3,
    'ThreadBackgroundTerminalsListResponse': 2, 'ThreadBackgroundTerminalsTerminateParams': 2, 'ThreadClosedNotification': 1, 'ThreadCompactStartParams': 1, 'ThreadCompatibility': 33, 'ThreadDecrementElicitationParams': 1,
    'ThreadDeleteParams': 1, 'ThreadDeletedNotification': 1, 'ThreadEnvironment': 3, 'ThreadForkParams': 23, 'ThreadForkResponse': 14, 'ThreadGoal': 8,
    'ThreadGoalClearParams': 2, 'ThreadGoalClearResponse': 1, 'ThreadGoalClearedNotification': 1, 'ThreadGoalGetParams': 1, 'ThreadGoalGetResponse': 1, 'ThreadGoalSetParams': 5,
    'ThreadGoalSetResponse': 1, 'ThreadGoalUpdatedEvent': 3, 'ThreadGoalUpdatedNotification': 3, 'ThreadGuardianReviewParams': 1, 'ThreadIncrementElicitationParams': 1, 'ThreadInjectItemsParams': 2,
    'ThreadItemEntry': 5, 'ThreadItemsListParams': 6, 'ThreadItemsListResponse': 3, 'ThreadItemsReadParams': 3, 'ThreadListParams': 19, 'ThreadListResponse': 4,
    'ThreadLoadedListParams': 2, 'ThreadLoadedListResponse': 2, 'ThreadMemoryModeSetParams': 2, 'ThreadMemoryReadParams': 1, 'ThreadMetadataUpdateParams': 4, 'ThreadMetadataUpdateResponse': 1,
    'ThreadNameUpdatedNotification': 2, 'ThreadPredictionRequestParams': 2, 'ThreadPredictionUpdatedNotification': 3, 'ThreadPrepareApprovedPlanParams': 3, 'ThreadPrepareApprovedPlanResponse': 1, 'ThreadProjectUpdatedNotification': 2,
    'ThreadQueueAddParams': 4, 'ThreadQueueAddResponse': 1, 'ThreadQueueChangedEvent': 1, 'ThreadQueueChangedNotification': 1, 'ThreadQueueDeleteParams': 2, 'ThreadQueueListParams': 3,
    'ThreadQueueReorderParams': 2, 'ThreadQueueStartParams': 2, 'ThreadQueueUpdateParams': 4, 'ThreadReadParams': 2, 'ThreadReadResponse': 2, 'ThreadReadState': 2,
    'ThreadReadStateChangedNotification': 2, 'ThreadReadStateUpdateParams': 3, 'ThreadReadStateUpdateResponse': 1, 'ThreadRealtimeAppendAudioParams': 2, 'ThreadRealtimeAppendSpeechParams': 2, 'ThreadRealtimeAppendTextParams': 3,
    'ThreadRealtimeAudioChunk': 5, 'ThreadRealtimeClosedNotification': 2, 'ThreadRealtimeErrorNotification': 2, 'ThreadRealtimeInitialItem': 2, 'ThreadRealtimeItemAddedNotification': 2, 'ThreadRealtimeItemCompletedNotification': 2,
    'ThreadRealtimeItemStartedNotification': 2, 'ThreadRealtimeItemTranscriptDeltaNotification': 3, 'ThreadRealtimeListVoicesResponse': 1, 'ThreadRealtimeOutputAudioDeltaNotification': 2, 'ThreadRealtimeSdpNotification': 2, 'ThreadRealtimeStartParams': 21,
    'ThreadRealtimeStartedNotification': 3, 'ThreadRealtimeStopParams': 1, 'ThreadRealtimeTranscriptDeltaNotification': 3, 'ThreadRealtimeTranscriptDoneNotification': 3, 'ThreadResumeInitialTurnsPageParams': 3, 'ThreadResumeParams': 18,
    'ThreadResumeResponse': 18, 'ThreadRevertParams': 2, 'ThreadRevertResponse': 3, 'ThreadRevertedNotification': 1, 'ThreadRolledBackEvent': 1, 'ThreadSampleCancelParams': 1,
    'ThreadSampleParams': 10, 'ThreadSearchOccurrencesParams': 4, 'ThreadSearchParams': 9, 'ThreadSearchResponse': 3, 'ThreadSearchResult': 2, 'ThreadSection': 3,
    'ThreadSectionAppearance': 2, 'ThreadSectionChangedNotification': 2, 'ThreadSectionCreateParams': 2, 'ThreadSectionDeleteParams': 1, 'ThreadSectionListParams': 2, 'ThreadSectionMoveParams': 3,
    'ThreadSectionUpdateParams': 3, 'ThreadSetNameParams': 2, 'ThreadSettings': 15, 'ThreadSettingsAppliedEvent': 2, 'ThreadSettingsSnapshot': 15, 'ThreadSettingsUpdateParams': 15,
    'ThreadSettingsUpdatedNotification': 2, 'ThreadShellCommandParams': 3, 'ThreadStartParams': 27, 'ThreadStartResponse': 14, 'ThreadStartedMetadata': 6, 'ThreadStartedNotification': 1,
    'ThreadStatusChangedNotification': 2, 'ThreadSummary': 5, 'ThreadTimelineListParams': 3, 'ThreadTokenUsage': 3, 'ThreadTokenUsageUpdatedNotification': 3, 'ThreadTurnsCursor': 2,
    'ThreadTurnsListParams': 5, 'ThreadTurnsListResponse': 3, 'ThreadUnarchiveParams': 1, 'ThreadUnarchiveResponse': 1, 'ThreadUnarchivedNotification': 1, 'ThreadUnsubscribeParams': 1,
    'ThreadUnsubscribeResponse': 1, 'ThreadUsage': 5, 'ThreadUsageEstimate': 5, 'ThreadUsageQueryResponse': 1, 'TimeOperation': 1, 'TimelineCursor': 4,
    'TitleArguments': 2, 'TitledItems': 1, 'TitledMultiSelectEnumSchema': 7, 'TitledSingleSelectEnumSchema': 5, 'TokenBudgetConfigToml': 7, 'TokenCountEvent': 2,
    'TokenData': 6, 'TokenResponse': 4, 'TokenUsage': 7, 'TokenUsageBreakdown': 6, 'TokenUsageInfo': 4, 'TokenUsageProfile': 1,
    'TokenUsageProfileDailyBucket': 2, 'TokenUsageProfileStats': 6, 'TokenUsageRecord': 8, 'Tool': 8, 'ToolAnnotations': 5, 'ToolChoice': 1,
    'ToolEnvironmentArgs': 1, 'ToolInfo': 11, 'ToolRegistryConfigToml': 2, 'ToolRequestUserInputAnswer': 1, 'ToolRequestUserInputOption': 2, 'ToolRequestUserInputQuestion': 6,
    'ToolRequestUserInputResponse': 1, 'ToolResultContent': 5, 'ToolSerde': 8, 'ToolSuggestDisabledTool': 2, 'ToolSuggestDiscoverable': 2, 'ToolUseContent': 4,
    'ToolsCapability': 1, 'ToolsToml': 4, 'ToolsV2': 1, 'TraceBundleManifest': 7, 'TruncationPolicyConfig': 2, 'TuiAgentsKeymap': 12,
    'TuiApprovalKeymap': 8, 'TuiChatKeymap': 11, 'TuiComposerKeymap': 5, 'TuiEditorKeymap': 17, 'TuiGlobalKeymap': 33, 'TuiListKeymap': 10,
    'TuiPagerKeymap': 11, 'TuiVimNormalKeymap': 36, 'TuiVimOperatorKeymap': 20, 'TuiVimSearchKeymap': 4, 'TuiVimTextObjectKeymap': 9, 'Turn': 9,
    'TurnAbortedEvent': 7, 'TurnAttribution': 5, 'TurnCompleteEvent': 8, 'TurnCompletedNotification': 2, 'TurnCostsResponse': 1, 'TurnDiffEvent': 1,
    'TurnDiffUpdatedNotification': 3, 'TurnEnvironmentParams': 3, 'TurnError': 4, 'TurnInterruptParams': 2, 'TurnModerationMetadataEvent': 1, 'TurnModerationMetadataNotification': 3,
    'TurnPlanStep': 2, 'TurnPlanUpdatedNotification': 4, 'TurnSettingsUpdateParams': 8, 'TurnStartParams': 28, 'TurnStartResponse': 1, 'TurnStartedEvent': 7,
    'TurnStartedNotification': 2, 'TurnSteerParams': 7, 'TurnSteerResponse': 1, 'TurnToolOutput': 4, 'TurnsPage': 3, 'UntitledItems': 2,
    'UntitledMultiSelectEnumSchema': 7, 'UntitledSingleSelectEnumSchema': 5, 'UpdateGoalArgs': 1, 'UpdateOutput': 5, 'UpdatePlanArgs': 2, 'UpsertChannelRequest': 2,
    'UsageErrorBody': 5, 'UsageErrorResponse': 1, 'UserCodeResp': 3, 'UserMessageEvent': 14, 'UserMessageItem': 3, 'UserPromptSubmitHookSpecificOutputWire': 2,
    'UserVerificationCancelParams': 1, 'UserVerificationProof': 2, 'UserVerificationVerifyParams': 3, 'UserVerificationVerifyResponse': 1, 'VerifiedAccessGrant': 2, 'VerifiedAccessProgram': 2,
    'VerifiedAccessResponse': 1, 'VerifiedQuestionAnswer': 2, 'VersionInfo': 3, 'ViewImageArgs': 2, 'ViewImageToolCallEvent': 2, 'WaitArguments': 2,
    'WaitForEnvironmentArgs': 1, 'WaitTarget': 2, 'WalkEntry': 2, 'WalkError': 2, 'WalkOptions': 5, 'WalkOutcome': 3,
    'WarningEvent': 1, 'WarningNotification': 2, 'WeatherOperation': 3, 'WebSearchBeginEvent': 1, 'WebSearchEndEvent': 4, 'WebSearchItem': 4,
    'WebSearchLocation': 4, 'WebSearchToolConfig': 3, 'WindowsRequirementsToml': 3, 'WindowsSandboxProvisioningSettings': 2, 'WindowsSandboxProxyListeners': 2, 'WindowsSandboxReadinessResponse': 1,
    'WindowsSandboxSetupCompletedNotification': 3, 'WindowsSandboxSetupStartParams': 2, 'WindowsSandboxSetupStartResponse': 1, 'WindowsToml': 2, 'WindowsWorldWritableWarningNotification': 3, 'WireCapabilityRootDiscoverRequest': 3,
    'WireCapabilityRootsDiscoverParams': 1, 'WireExecParams': 14, 'WireFileSystemSandboxContext': 10, 'WireFsCanonicalizeParams': 2, 'WireFsCopyParams': 4, 'WireFsCreateDirectoryParams': 4,
    'WireFsGetMetadataParams': 3, 'WireFsOpenParams': 4, 'WireFsReadDirectoryParams': 2, 'WireFsReadFileParams': 3, 'WireFsRemoveParams': 5, 'WireFsWalkParams': 3,
    'WireFsWriteFileParams': 4, 'WireNestedToolCall': 5, 'WireRequestUserInputEvent': 5, 'WireResult': 6, 'WireToolName': 2, 'WireToolRequestUserInputParams': 6,
    'WorkspaceMessage': 5, 'WorkspaceRouting': 3, 'WorkspaceTokenResponse': 1, 'WorkspaceUsageCount': 10, 'WorkspaceUsageGroup': 5, 'WorldStateItem': 2,
    'WrappedWebsocketError': 3, 'WrappedWebsocketErrorEvent': 4, 'WriteParams': 3, 'WriteResponse': 1,
})

#: name -> every arity it was printed with, for the 22 ambiguous names.
ARITY_VARIANTS: Final[Mapping[str, tuple[int, ...]]] = MappingProxyType({
    'CreateArguments': (2, 3),
    'FsCopyParams': (3, 4),
    'FsCreateDirectoryParams': (2, 4),
    'FsGetMetadataParams': (1, 3),
    'FsReadDirectoryParams': (1, 2),
    'FsReadFileParams': (1, 3),
    'FsRemoveParams': (3, 5),
    'FsWriteFileParams': (2, 4),
    'Helper': (2, 4, 5),
    'InitializeResponse': (2, 4),
    'JwtHeader': (1, 2),
    'ListArgs': (2, 3),
    'ListArguments': (1, 2),
    'Notice': (3, 9),
    'RateLimitResetCreditsSummary': (1, 2),
    'ReadResponse': (1, 7),
    'ResourceTemplate': (6, 8),
    'SkillToolDependency': (6, 7),
    'SpawnAgentArgs': (6, 7),
    'ThreadUsageBreakdownGroup': (9, 10),
    'WaitArgs': (1, 2),
    'Wire': (18, 19),
})


class CatalogError(ValueError):
    """Raised when the catalog contradicts its own counts or a downstream table."""


def arities_of(name: str) -> tuple[int, ...]:
    """All arities printed for one struct name; empty when the name is not in the catalog."""
    if name in ARITY_VARIANTS:
        return ARITY_VARIANTS[name]
    value = STRUCT_ARITY.get(name)
    return (value,) if value is not None else ()


def validate_catalog() -> None:
    if len(STRUCT_ARITY) != SINGLE_ARITY_COUNT:
        raise CatalogError('single-arity table size disagrees with its count')
    if len(ARITY_VARIANTS) != VARIANT_ARITY_COUNT:
        raise CatalogError('variant table size disagrees with its count')
    if len(STRUCT_ARITY) + len(ARITY_VARIANTS) != STRUCT_COUNT:
        raise CatalogError('catalog size disagrees with STRUCT_COUNT')
    overlap = set(STRUCT_ARITY) & set(ARITY_VARIANTS)
    if overlap:
        raise CatalogError(f'{sorted(overlap)[:3]} appear in both tables')
    for name, arity in STRUCT_ARITY.items():
        if arity < 1:
            raise CatalogError(f'{name} has a non-positive arity')
    for name, variants in ARITY_VARIANTS.items():
        if len(variants) < 2:
            raise CatalogError(f'{name} is a variant entry with fewer than two arities')
        if len(set(variants)) != len(variants):
            raise CatalogError(f'{name} repeats an arity')


def catalog_summary() -> MappingProxyType[str, int]:
    validate_catalog()
    return MappingProxyType({
        'templates': TEMPLATE_TOTAL,
        'structs': STRUCT_COUNT,
        'single_arity': SINGLE_ARITY_COUNT,
        'arity_variants': VARIANT_ARITY_COUNT,
    })
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
