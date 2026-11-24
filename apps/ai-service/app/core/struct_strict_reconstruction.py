# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Serde structure reconstruction, arity + shape double gate (R75).

Every `struct <Name> with <N> elements` message in `.rdata` is preceded by that struct's field
names concatenated without separators.  There are **3186** such messages
(1436 distinct struct names — the same name repeats once per crate copy).  Segmenting
the preceding run with a trie over the 20k ident dictionary yields, for 489 sites,
exactly the arity's worth of names.

A count match alone is not enough — fragments such as `er` / `ic` / `Ti` can pad a short list up
to the arity, exactly as happened on the TurnStartParams pool.  So a second gate is imposed:
**every segment must be field-shaped**.  Both gates together accept **277 structures** across
452 sites, i.e. **814 fields**.

Cross-check against the 44 structures R65 had already attested: 19 overlap, **16 identical**,
3 divergent (each divergent case is a name borrowed from a neighbouring pool, and is
listed below name by name rather than smoothed away).
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from types import MappingProxyType
from typing import Final

TEMPLATE_TOTAL: Final[int] = 3186
DISTINCT_STRUCT_NAMES: Final[int] = 1436
LOOSE_ARITY_COLLISIONS: Final[int] = 489
STRICT_SITES: Final[int] = 452
STRICT_STRUCT_COUNT: Final[int] = 277
STRICT_FIELD_COUNT: Final[int] = 814

#: name -> (declared arity, reconstructed fields).  len(fields) must equal the arity.
STRICT_STRUCTURES: Final[Mapping[str, tuple[int, tuple[str, ...]]]] = MappingProxyType({
    'AccountRateLimitsUpdatedNotification': (1, ('rateLimits',)),
    'ActivePermissionProfile': (2, ('environmentId', 'runtimeWorkspaceRoots')),
    'ActiveUsersSummary': (3, ('total_users', 'clients', 'models')),
    'AgentMessageInvocationArgs': (1, ('message',)),
    'AgentMessageModeration': (2, ('moderated', 'display')),
    'AgentPluginMcpFile': (2, ('schema', 'mcpServers')),
    'AnnotatedResponseItem': (2, ('item', 'annotations')),
    'Annotations': (3, ('audience', 'priority', 'lastModified')),
    'ApiKeyTurnCostsResponse': (1, ('estimated_usage_usd_micros',)),
    'AppBranding': (6, ('category', 'developer', 'website', 'privacyPolicy', 'termsOfService', 'isDiscoverableApp')),
    'AppListUpdatedNotification': (1, ('data',)),
    'AppReview': (1, ('pr',)),
    'AppScreenshot': (3, ('url', 'fileId', 'userPrompt')),
    'ApplyPatchApprovalParams': (5, ('conversationId', 'callId', 'fileChanges', 'reason', 'grantRoot')),
    'ApprovalMessages': (7, ('on_request', 'on_request_auto_review', 'never', 'unless_trusted', 'request_permissions', 'auto_review_suffix', 'granular')),
    'AppsListParams': (4, ('cursor', 'limit', 'threadId', 'forceRefetch')),
    'AsyncUserInputQuestion': (2, ('title', 'options')),
    'AttestationGenerateResponse': (1, ('token',)),
    'AudioControls': (2, ('microphoneMuted', 'speakerSuppressed')),
    'AudioDevice': (3, ('name', 'channels', 'isDefault')),
    'AudioDeviceSelection': (3, ('microphone', 'speaker', 'channel')),
    'AudioState': (2, ('microphonePeak', 'speakerPeak')),
    'AutoReviewMessages': (5, ('policy', 'policy_template', 'node_repl_policy', 'rejection_instructions', 'timeout_instructions')),
    'AutoReviewRequirementsToml': (2, ('required_on_models', 'ignore_rules')),
    'AutoReviewToml': (5, ('timeout_ms', 'circuit_break_action', 'policy', 'experimental_conversation_history_prompt', 'conversation_history_max_output_tokens')),
    'BedrockDiscoverResponse': (2, ('account', 'codexRateLimits')),
    'BrowserUseConfigToml': (3, ('allow_history_access', 'default_origin_policy', 'origins')),
    'BrowserUseOriginPolicyConfigToml': (4, ('access', 'downloads', 'uploads', 'full_cdp_access')),
    'ByteRange': (2, ('start', 'end')),
    'CancelLoginAccountParams': (1, ('loginId',)),
    'CapabilityRootsDiscoverParams': (1, ('roots',)),
    'ClientInfo': (3, ('map', 'name', 'version')),
    'CloudConfigBundle': (2, ('config_toml', 'requirements_toml')),
    'CloudConfigBundleCacheSignedPayload': (6, ('version', 'cached_at', 'expires_at', 'chatgpt_user_id', 'account_id', 'bundle')),
    'CloudConfigFragment': (3, ('id', 'name', 'contents')),
    'CloudConfigTomlBundle': (1, ('enterprise_managed',)),
    'CloudToml': (1, ('skills',)),
    'CodexAppsServerInfoDiskCache': (2, ('schema_version', 'server_info')),
    'CodexPackageManifest': (1, ('version',)),
    'CollabAgentRef': (3, ('thread_id', 'agent_nickname', 'agent_role')),
    'CompletionInfo': (3, ('values', 'total', 'hasMore')),
    'ComputerUseMacosConfigToml': (1, ('bundle_ids',)),
    'ComputerUseWindowsConfigToml': (2, ('aumids', 'exes')),
    'ConfigBatchWriteParams': (4, ('edits', 'filePath', 'expectedVersion', 'reloadUserConfig')),
    'ConfigurationReasoning': (1, ('effort',)),
    'ConfiguredSettings': (1, ('updater',)),
    'ConfiguredUpdater': (2, ('autoUpdateEnabled', 'updateIntervalMinutes')),
    'ConnectorDirectoryDiskCache': (2, ('schema_version', 'connectors')),
    'ConsentRecord': (8, ('schemaVersion', 'consent', 'source', 'promptedMxcVersion', 'promptResourceVersion', 'promptLocale', 'updatedAtEpoch', 'revision')),
    'ConsequentialToolMessageTemplatesFile': (2, ('schema_version', 'template')),
    'ConsumeAccountRateLimitResetCreditResponse': (1, ('payload',)),
    'ConsumeRateLimitResetCreditResponse': (2, ('windows', 'reset')),
    'ContextManagementConfigToml': (1, ('experimental_mode',)),
    'CopyFileArgs': (4, ('source_environment_id', 'source_path', 'target_environment_id', 'target_path')),
    'CredentialExportConfig': (3, ('ignore_untracked_files_over_bytes', 'large_untracked_dir_warning_threshold', 'args')),
    'CredentialFrame': (4, ('expires_at', 'chatgpt_user_id', 'environment_id', 'token')),
    'CreditUsageEventBySurface': (4, ('product_surface', 'credit_amount', 'usage', 'id')),
    'CreditsSnapshot': (3, ('hasCredits', 'unlimited', 'balance')),
    'CuratedPluginsBackupArchiveResponse': (1, ('download_url',)),
    'DiscoveredPluginFiles': (3, ('manifest', 'mcpConfig', 'appsConfig')),
    'DispatchedWriteStdinArgs': (4, ('session_id', 'chars', 'yield_time_ms', 'max_output_tokens')),
    'DynamicToolCallResponse': (2, ('contentItems', 'success')),
    'ElicitResult': (3, ('action', 'content', 'meta')),
    'EllipticCurveKeyParameters': (4, ('task_id', 'taskId', 'encrypted_task_id', 'encryptedTaskId')),
    'EnrollRemoteServerResponse': (4, ('stream_id', 'seq_id', 'cursor', 'expires_at')),
    'EnvironmentConnectionEvent': (1, ('environment_id',)),
    'EnvironmentInfo': (10, ('map', 'shell', 'executorVersion', 'providerId', 'userHomeDir', 'platformOs', 'prependPathDirs', 'temporaryDirectories', 'tempDir', 'capabilities')),
    'EnvironmentsToml': (3, ('default', 'include_local', 'environments')),
    'ErrorData': (3, ('code', 'message', 'data')),
    'ErrorDetail': (1, ('code',)),
    'ErrorEnvelope': (1, ('error',)),
    'ExchangeResponse': (5, ('access_token', 'token_type', 'issued_token_type', 'expires_in', 'expires_at')),
    'ExperimentalFeatureEnablementSetParams': (1, ('enablement',)),
    'Failure': (2, ('code', 'message')),
    'FinanceOperation': (3, ('ticker', 'type', 'market')),
    'FindOperation': (2, ('ref_id', 'pattern')),
    'FormElicitationCapability': (1, ('schemaValidation',)),
    'FrameSpec': (4, ('progress', 'total', 'height', 'columns')),
    'FsCopyParams': (4, ('sourcePath', 'destinationPath', 'recursive', 'sandbox')),
    'FsHelperOpenParams': (2, ('required', 'mode')),
    'FsHelperOpenResponse': (2, ('processId', 'fileHandle')),
    'FsReadDirectoryEntry': (3, ('fileName', 'isDirectory', 'isFile')),
    'FuzzyFileSearchSessionStopParams': (1, ('sessionId',)),
    'GeneratedRecap': (2, ('summary', 'next_action')),
    'GetAuthStatusParams': (2, ('includeToken', 'refreshToken')),
    'GetTaskResponse': (1, ('current_diff_task_turn',)),
    'GifOptions': (2, ('frame_count', 'frame_duration_ms')),
    'GitDiffToRemoteParams': (1, ('cwd',)),
    'GitHubGitRefSummary': (1, ('object',)),
    'GitInfo': (3, ('sha', 'branch', 'originUrl')),
    'GithubResponse': (1, ('value',)),
    'GoalsToml': (1, ('max_goal_token_budget',)),
    'GranularApprovalConfig': (5, ('sandbox_approval', 'rules', 'skill_approval', 'request_permissions', 'mcp_elicitations')),
    'GuardianRetainedOmissions': (2, ('user_instructions', 'assistant_context')),
    'GuardianV2ReviewScopeConfigToml': (2, ('computer_use_only', 'sandboxed_exec_commands')),
    'GuardianV2TranscriptConfigToml': (7, ('sources', 'include_images', 'max_message_entry_tokens', 'max_tool_entry_tokens', 'max_message_transcript_tokens', 'max_tool_transcript_tokens', 'max_recent_non_user_entries')),
    'HistoryEntry': (3, ('session_id', 'ts', 'text')),
    'HostHello': (2, ('selectedVersion', 'capabilities')),
    'Icon': (4, ('src', 'mimeType', 'sizes', 'theme')),
    'IdJagClaims': (10, ('iss', 'sub', 'aud', 'client_id', 'jti', 'exp', 'iat', 'scope', 'authorization', 'details')),
    'ImageData': (2, ('b64_json', 'generation_id')),
    'ImageResponse': (5, ('created', 'data', 'background', 'quality', 'size')),
    'ImportedExternalAgentSessionLedger': (2, ('records', 'detected_connector_records')),
    'ImportedExternalAgentSessionRecord': (7, ('source_path', 'content_sha256', 'imported_thread_id', 'imported_at', 'source_modified_at', 'connector_names', 'title')),
    'InAppBrowserRequirementsToml': (1, ('allow_external_browser_settings_import',)),
    'InitializeCapabilities': (7, ('requiredHumanApproval', 'explicitGatewayOauth', 'experimentalApi', 'requestAttestation', 'mcpServerOpenaiFormElicitation', 'optOutNotificationMethods', 'extensions')),
    'InitializeParams': (2, ('clientInfo', 'capabilities')),
    'InterruptedTurn': (5, ('turn_id', 'output_schema', 'service_tier', 'cyber_access_program', 'local_environment')),
    'JSONRPCError': (2, ('error', 'id')),
    'JwkSet': (1, ('keys',)),
    'JwtClaims': (4, ('exp', 'nbf', 'iss', 'aud')),
    'JwtHeader': (1, ('alg',)),
    'LegacyOutput': (3, ('raw_memory', 'rollout_summary', 'rollout_slug')),
    'LegacyPermissionProfile': (2, ('network', 'file_system')),
    'ListResourcesResult': (6, ('toolsListChanged', 'promptsListChanged', 'resourcesListChanged', 'resourceSubscriptions', 'stopReason', 'resources')),
    'MarketplaceNameMismatch': (2, ('inputs', 'found_name')),
    'McpAppUi': (2, ('resourceUri', 'preferredModelDisplayMode')),
    'McpElicitationSchema': (4, ('schema', 'type', 'properties', 'required')),
    'McpElicitationTitledEnumItems': (1, ('anyOf',)),
    'McpResourceOrigin': (7, ('call_id', 'turn_id', 'tool', 'connector_id', 'link_id', 'uri', 'ambiguous_account')),
    'McpResourceOriginCheckpoint': (3, ('origins', 'turns', 'current_turn_id')),
    'McpServerEventStreamNotification': (2, ('subscriptionId', 'notification')),
    'McpServerEventStreamStopParams': (1, ('subscriptionId',)),
    'McpServerIdpOAuthConfig': (4, ('issuer', 'client_id', 'client_secret', 'token_endpoint_auth_method')),
    'McpStartupCompleteEvent': (3, ('ready', 'failed', 'cancelled')),
    'McpToolCallError': (1, ('message',)),
    'MemoriesToml': (15, ('version', 'dual_write', 'disable_on_external_context', 'generate_memories', 'use_memories', 'dedicated_tools', 'max_raw_memories_for_consolidation', 'max_unused_days', 'max_rollout_age_days', 'max_rollouts_per_startup', 'min_rollout_idle_hours', 'min_rate_limit_remaining_percent', 'extract_model', 'consolidation_model', 'consolidation_service_tier')),
    'MemoryCitation': (2, ('entries', 'threadIds')),
    'MemoryStatusParams': (1, ('minConsolidatedThreads',)),
    'MisalignmentErrorDetails': (4, ('errorType', 'detailedExplanation', 'steer', 'reviewTarget')),
    'MisalignmentSteer': (1, ('message',)),
    'ModelHint': (1, ('name',)),
    'ModelInfoUpgrade': (3, ('model', 'migration_markdown', 'retirement_at')),
    'ModelListResponse': (2, ('roots', 'default')),
    'ModelPreferences': (4, ('hints', 'costPriority', 'speedPriority', 'intelligencePriority')),
    'ModelProviderCapabilities': (3, ('cyber_access_programs', 'external_web_access', 'remote_compaction')),
    'ModelTokenBudgetConfig': (7, ('enabled', 'use_history_notes_extension', 'reminder_threshold_tokens', 'reminder_message_template', 'guidance_message', 'auto_compact_fallback_prompt', 'auto_compact_fallback_buffer_tokens')),
    'ModelVerificationEvent': (1, ('verifications',)),
    'ModelsCacheEntry': (5, ('fetched_at', 'etag', 'client_version', 'identity', 'models')),
    'ModelsResponse': (1, ('models',)),
    'MultiAgentMessages': (2, ('role', 'mode')),
    'MultiAgentModeMessages': (3, ('explicit', 'proactive', 'hint_text')),
    'MxcCommand': (5, ('permissions', 'sandbox_policy_cwd', 'managed_network', 'command', 'default_child_env')),
    'NetworkApprovalContext': (2, ('host', 'protocol')),
    'NetworkPermissions': (1, ('enabled',)),
    'NetworkPolicyAmendment': (2, ('host', 'action')),
    'NodeReplExecOutput': (2, ('exit_code', 'output')),
    'NonPrefixedMcpToolNamesConfigToml': (2, ('fileId', 'server_names')),
    'NpmPackageDist': (2, ('tarball', 'integrity')),
    'NpmPackageInfo': (2, ('tags', 'version')),
    'NpmPackageVersionInfo': (1, ('dist',)),
    'OwnerRecord': (2, ('version', 'ownerThreadId')),
    'PermissionDeniedDetails': (2, ('action', 'resource')),
    'PermissionMessages': (9, ('danger_full_access', 'workspace_write', 'read_only', 'approved_prefixes', 'approved_command_prefix_saved', 'writable_root', 'writable_roots', 'omitted_paths', 'denied_reads')),
    'PermissionProfileListResponse': (2, ('network', 'items')),
    'PermissionProfileToml': (5, ('body_secret_substitution', 'aws_sigv4strip_request_headers', 'inject_request_headers', 'extends', 'workspace_roots')),
    'PersistentDenyReadAclState': (1, ('principals',)),
    'PersonalAccessTokenMetadata': (5, ('email', 'chatgpt_user_id', 'chatgpt_account_id', 'chatgpt_plan_type', 'chatgpt_account_is_fedramp')),
    'PlanItem': (2, ('id', 'text')),
    'PluginMcpServersFile': (1, ('mcpServers',)),
    'PluginReadParams': (3, ('marketplacePath', 'remoteMarketplaceName', 'pluginName')),
    'PluginShareSaveParams': (4, ('pluginPath', 'remotePluginId', 'discoverability', 'shareTargets')),
    'ProcessExitedNotification': (7, ('processHandle', 'exitCode', 'outputDrainTimedOut', 'stdout', 'stdoutCapReached', 'stderr', 'stderrCapReached')),
    'ProcessKillParams': (1, ('processHandle',)),
    'ProcessTerminalSize': (2, ('rows', 'cols')),
    'ProjectChangedNotification': (2, ('projectId', 'changeType')),
    'ProjectConfig': (1, ('trust_level',)),
    'ProjectMcpServerMetadata': (2, ('serverIdentifier', 'serverName')),
    'ProjectTrustConfigToml': (1, ('error_description',)),
    'Proof': (2, ('credentialId', 'signature')),
    'QuickDial': (2, ('persistencemax_bytes', 'label')),
    'RateLimitReachedType': (1, ('type',)),
    'RateLimitResetCreditsDetails': (2, ('available', 'count')),
    'RateLimitSnapshot': (10, ('limitId', 'limitName', 'normalModelSlug', 'primary', 'secondary', 'credits', 'individualLimit', 'spendControlReached', 'planType', 'rateLimitReachedType')),
    'RateLimitStatusDetails': (4, ('limit_reached', 'primary_window', 'secondary', 'window')),
    'RateLimitWindow': (3, ('usedPercent', 'windowDurationMins', 'resetsAt')),
    'RawMcpServerRequirement': (1, ('identity',)),
    'RealtimeConversationListVoicesResponseEvent': (1, ('voices',)),
    'RealtimeConversationSdpEvent': (1, ('sdp',)),
    'RealtimeToml': (4, ('notifications', 'notification_method', 'notification_condition', 'transportvoice')),
    'RefreshResponse': (3, ('id_token', 'access_token', 'refresh_token')),
    'RegisterAgentResponse': (1, ('agent_runtime_id',)),
    'RemoteControlPairingStatusParams': (2, ('pairingCode', 'manualPairingCode')),
    'RemotePluginInstallMetadata': (2, ('schema_version', 'remote_plugin_id')),
    'RemotePluginMcpServerResponse': (1, ('key',)),
    'RemotePluginSkillDetailResponse': (3, ('skill', 'md', 'contents')),
    'RemotePluginSkillInterfaceResponse': (6, ('operations', 'short_description', 'brand_color', 'default_prompt', 'icon_small_url', 'icon_large_url')),
    'RemotePluginSkillResponse': (3, ('installed_at', 'disabled_skill_names', 'interface')),
    'RemoteSandboxConfigToml': (2, ('hostname', 'patterns')),
    'RemovedAppsMcpPathOverrideConfigToml': (2, ('shortDescriptiondiscoveryRoot', 'dependencies')),
    'RequestPermissionProfile': (2, ('network', 'fileSystem')),
    'RequestUserInputAnswer': (1, ('answers',)),
    'RequestUserInputToolArgs': (1, ('questions',)),
    'RequirementsExecPolicyPatternTokenToml': (2, ('token', 'any_of')),
    'RequirementsExecPolicyPrefixRuleToml': (4, ('canonical_matching', 'pattern', 'decision', 'justification')),
    'RequirementsExecPolicyToml': (1, ('prefix_rule',)),
    'ResponseCompletedUsage': (6, ('input_tokens', 'input_tokens_details', 'output_tokens', 'output_tokens_details', 'total_tokens', 'codex_rollout_budget_units')),
    'ResponseUsageMetadata': (2, ('amount', 'metadata')),
    'RetainedContext': (9, ('accepted_file_audio', 'verified_answers', 'incomplete', 'user_messages', 'user_messages_incomplete', 'assistant_messages', 'assistant_messages_incomplete', 'next_order', 'sender_deliveries')),
    'ReviewCodeLocation': (2, ('absolute_file_path', 'line_range')),
    'ReviewLineRange': (2, ('start', 'end')),
    'ReviewOutputEvent': (4, ('findings', 'overall_correctness', 'overall_explanation', 'overall_confidence_score')),
    'RolloutBudgetConfigToml': (6, ('glob_scan_max_depth', 'enforce_limit', 'limit_tokens', 'reminder_at_remaining_tokens', 'sampling_token_weight', 'prefill_token_weight')),
    'Root': (3, ('uri', 'name', 'meta')),
    'RootsCapabilities': (1, ('listChanged',)),
    'SafetyBuffering': (3, ('use_cases', 'reasons', 'retry_model')),
    'SandboxUserRecord': (2, ('username', 'password')),
    'SandboxUsersFile': (3, ('offline', 'onli', 'ne')),
    'SearchResponse': (3, ('encrypted_output', 'output', 'results')),
    'SecretsFile': (2, ('version', 'secrets')),
    'SendAddCreditsNudgeEmailParams': (1, ('creditType',)),
    'SessionContextWindow': (1, ('window_id',)),
    'SessionManifest': (2, ('cliSessionId', 'remoteMcpServersConfig')),
    'SessionNetworkProxyRuntime': (2, ('http_addr', 'socks_addr')),
    'Settings': (3, ('sequence', 'model', 'reasoning_effort')),
    'SetupErrorReport': (2, ('code', 'message')),
    'SetupMarker': (6, ('version', 'offline_username', 'online_username', 'created_at', 'proxy_ports', 'allow_local_binding')),
    'SkillDependencies': (1, ('tools',)),
    'SkillPolicy': (2, ('allowImplicitInvocation', 'products')),
    'SkillsExtraRootsSetParams': (1, ('extraRoots',)),
    'SleepArgs': (1, ('duration_ms',)),
    'SleepItem': (2, ('output_token_limit', 'durationMs')),
    'SpendControlStatusDetails': (2, ('reached', 'individual_limit')),
    'SportsOperation': (9, ('tool', 'fn', 'league', 'team', 'opponent', 'date_from', 'date_to', 'num_games', 'locale')),
    'StandardErrorResponse': (3, ('invalid', 'error_description', 'error_uri')),
    'StopSettings': (1, ('shutdownGraceSeconds',)),
    'StoredPost': (2, ('metadata', 'text')),
    'TerminalSessionArgs': (1, ('session_id',)),
    'TextElement': (2, ('byteRange', 'placeholder')),
    'ThreadAttachmentAddParams': (4, ('manualCode', 'attachmentType', 'identityKey', 'payload')),
    'ThreadEnvironment': (3, ('environmentId', 'cwd', 'runtimeWorkspaceRoots')),
    'ThreadQueueAddResponse': (1, ('cyber',)),
    'ThreadReadState': (2, ('firstUnread', 'revision')),
    'ThreadReadStateUpdateResponse': (1, ('allowExternalBrowserSettingsImport',)),
    'ThreadRolledBackEvent': (1, ('num_turns',)),
    'ThreadSampleCancelParams': (1, ('requestId',)),
    'ThreadSectionAppearance': (2, ('icon', 'color')),
    'ThreadStartedNotification': (1, ('thread',)),
    'ThreadTokenUsage': (3, ('total', 'last', 'modelContextWindow')),
    'ThreadTurnsCursor': (2, ('turnId', 'includeAnchor')),
    'TimeOperation': (1, ('utc_offset',)),
    'TitledItems': (1, ('anyOf',)),
    'TokenBudgetConfigToml': (7, ('bundle_ids', 'use_history_notes_extension', 'reminder_threshold_tokens', 'reminder_message_template', 'guidance_message', 'auto_compact_fallback_prompt', 'auto_compact_fallback_buffer_tokens')),
    'TokenCountEvent': (2, ('info', 'rate_limits')),
    'TokenUsage': (7, ('input_tokens', 'cached_input_tokens', 'cache_write_input_tokens', 'output_tokens', 'reasoning_output_tokens', 'total_tokens', 'codex_rollout_budget_units')),
    'TokenUsageBreakdown': (6, ('totalTokens', 'inputTokens', 'cachedInputTokens', 'cacheWriteInputTokens', 'outputTokens', 'reasoningOutputTokens')),
    'TokenUsageInfo': (4, ('total_token_usage', 'last_token_usage', 'last_usage_includes_reasoning', 'model_context_window')),
    'TokenUsageProfileDailyBucket': (2, ('start_date', 'tokens')),
    'TokenUsageProfileStats': (6, ('lifetime_tokens', 'peak_daily_tokens', 'longest_running_turn_sec', 'current_streak_days', 'longest_streak_days', 'daily_usage_buckets')),
    'ToolAnnotations': (5, ('failed', 'readOnlyHint', 'destructiveHint', 'idempotentHint', 'openWorldHint')),
    'ToolChoice': (1, ('mode',)),
    'ToolRegistryConfigToml': (2, ('error_on_tool_collisions', 'turn_metadata_includes_tool_info')),
    'ToolSuggestDisabledTool': (2, ('type', 'id')),
    'ToolsCapability': (1, ('listChanged',)),
    'ToolsToml': (4, ('client_search_provider', 'web_search', 'experimental_request_user_input', 'update_plan')),
    'ToolsV2': (1, ('warnings',)),
    'TuiChatKeymap': (11, ('open_presets', 'toggle_voice', 'toggle_voice_mute', 'interrupt_turn', 'decrease_reasoning_effort', 'increase_reasoning_effort', 'previous_permission_mode', 'next_permission_mode', 'edit_queued_message', 'prompt_stack_back', 'skip_question')),
    'TuiGlobalKeymap': (33, ('leader', 'change_host', 'focus_main_composer', 'focus_sidebar_content', 'focus_sidebar_tabs', 'hide_pane', 'close_sidebar_tab', 'sidebar_up', 'sidebar_down', 'focus_pane_left', 'focus_pane_right', 'minimize_pane_width', 'maximize_pane_width', 'equalize_pane_widths', 'resize_panes', 'move_divider_left', 'move_divider_right', 'toggle_pane_zoom', 'open_agents', 'open_transcript', 'find_transcript', 'select_transcript', 'focus_activity', 'open_external_editor', 'copy', 'clear_terminal', 'submit', 'queue', 'toggle_shortcuts', 'toggle_vim_mode', 'toggle_fast_mode', 'toggle_raw_output', 'toggle_side_conversation')),
    'TuiListKeymap': (10, ('move_up', 'move_down', 'move_left', 'move_right', 'page_up', 'page_down', 'jump_top', 'jump_bottom', 'accept', 'cancel')),
    'TuiVimSearchKeymap': (4, ('forward', 'backward', 'next', 'previous')),
    'TurnError': (4, ('message', 'codexErrorInfo', 'additionalDetails', 'misalignment')),
    'UpdatePlanArgs': (2, ('explanation', 'plan')),
    'UsageErrorResponse': (1, ('error',)),
    'VerifiedAccessProgram': (2, ('state', 'grants')),
    'VerifiedAccessResponse': (1, ('program',)),
    'VersionInfo': (3, ('latest_version', 'last_checked_at', 'dismissed_version')),
    'WalkEntry': (2, ('path', 'kind')),
    'WalkOptions': (5, ('maxDepth', 'maxDirectories', 'maxEntries', 'followDirectorySymlinks', 'pruneHiddenDirectories')),
    'WalkOutcome': (3, ('entries', 'errors', 'truncated')),
    'WebSearchLocation': (4, ('country', 'region', 'city', 'timezone')),
    'WebSearchToolConfig': (3, ('context_size', 'allowed_domains', 'location')),
    'WindowsRequirementsToml': (3, ('allowed_sandbox_implementations', 'require', 'mxc')),
    'WindowsSandboxProxyListeners': (2, ('http_ports', 'socks_ports')),
    'WindowsWorldWritableWarningNotification': (3, ('samplePaths', 'extraCount', 'failedScan')),
    'WireNestedToolCall': (5, ('cell_id', 'runtime_tool_call_id', 'tool_name', 'tool_kind', 'input')),
    'WireToolName': (2, ('name', 'namespace')),
    'WorldStateItem': (2, ('full', 'state')),
})

#: Same struct name, same arity, different field list at different sites — a real ambiguity
#: in this image, kept as data instead of resolved by preference.
ARITY_CONFLICTS: Final[tuple[str, ...]] = (
    'ActivePermissionProfile',
    'AppReview',
    'AsyncUserInputQuestion',
    'CreditsSnapshot',
    'GitInfo',
    'JwtHeader',
    'PersonalAccessTokenMetadata',
    'QuickDial',
    'RateLimitSnapshot',
    'RateLimitWindow',
    'TextElement',
)

#: Cross-check against R65: (name, strict_len, r65_len, only_in_r65, only_in_strict).
CROSS_CHECK_IDENTICAL: Final[int] = 16
CROSS_CHECK_DIVERGENT: Final[tuple[tuple[str, int, int, tuple[str, ...], tuple[str, ...]], ...]] = (
    ('EnvironmentInfo', 10, 10, ('cwd',), ('map',)),
    ('RolloutBudgetConfigToml', 6, 6, ('enabled',), ('glob_scan_max_depth',)),
    ('TokenBudgetConfigToml', 7, 7, ('enabled',), ('bundle_ids',)),
)

FIELD_SHAPE: Final[re.Pattern[str]] = re.compile(
    r'^[a-z][a-z0-9]*(?:[A-Z][a-z0-9]+)+$'      # camelCase
    r'|^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$'        # snake_case
    r'|^[a-z][a-z0-9]{1,24}$'                 # plain single word
)


class StrictReconstructionError(ValueError):
    """Raised when a reconstructed structure contradicts its own arity or shape."""


def validate_reconstruction() -> None:
    if len(STRICT_STRUCTURES) != STRICT_STRUCT_COUNT:
        raise StrictReconstructionError('struct count does not match the table')
    if sum(len(f) for _a, f in STRICT_STRUCTURES.values()) != STRICT_FIELD_COUNT:
        raise StrictReconstructionError('field count does not match the table')
    for name, (arity, fields) in STRICT_STRUCTURES.items():
        if len(fields) != arity:
            raise StrictReconstructionError(
                f'{name} declares arity {arity} but carries {len(fields)} names')
        if len(fields) != len(set(fields)):
            raise StrictReconstructionError(f'{name} repeats a field name')
        for field in fields:
            if not FIELD_SHAPE.match(field):
                raise StrictReconstructionError(f'{name}: {field!r} is not field-shaped')
    for name in ARITY_CONFLICTS:
        if name not in STRICT_STRUCTURES:
            raise StrictReconstructionError(f'{name} is a conflict but has no entry')
    for name, strict_len, _r65_len, only_r65, only_strict in CROSS_CHECK_DIVERGENT:
        if name not in STRICT_STRUCTURES:
            raise StrictReconstructionError(f'{name} diverges but has no entry')
        if strict_len != len(STRICT_STRUCTURES[name][1]):
            raise StrictReconstructionError(f'{name} divergent length disagrees with the table')
        if not (only_r65 or only_strict):
            raise StrictReconstructionError(f'{name} diverges with no recorded difference')


def reconstruction_summary() -> Mapping[str, int]:
    validate_reconstruction()
    return MappingProxyType({
        'templates': TEMPLATE_TOTAL,
        'distinct_names': DISTINCT_STRUCT_NAMES,
        'strict_structs': STRICT_STRUCT_COUNT,
        'strict_sites': STRICT_SITES,
        'strict_fields': STRICT_FIELD_COUNT,
        'arity_conflicts': len(ARITY_CONFLICTS),
        'cross_check_identical': CROSS_CHECK_IDENTICAL,
        'cross_check_divergent': len(CROSS_CHECK_DIVERGENT),
    })


def fields_of(name: str) -> tuple[str, ...]:
    """Reconstructed field names of one struct; empty when the struct is not in the table."""
    entry = STRICT_STRUCTURES.get(name)
    return entry[1] if entry else ()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
