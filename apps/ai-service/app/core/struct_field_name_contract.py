# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""非 hook struct 的 serde ``FIELDS`` 字段名契约 —— 统一工程规范 R65（结构字段名层）。

取证（codex.exe 26.1111.2228.0，382,514,992 B）：``.rdata`` 里 serde 的 ``FIELDS`` 是 N 组
16 字节 ``(ptr, len)`` 静态表；每个 struct 的字段字面量按声明顺序首尾相连、紧贴在
``"struct X with N elements"`` 模板之前。判据 = 字段串接必须逐字节成为「模板前那段
连续可打印文本」的后缀，且该后缀完整覆盖 ≥3 个字段名；同长度的其它表（含诱饵表）
后缀命中 0 字节，天然出局。全量扫描 2,661 处模板、2,197 张字段表 →
**44 个结构名 / 83 张表命中、0 歧义**；
同一结构的多份编译器副本内容逐字一致（生成器拒绝不一致者）。

诚实边界：仅覆盖「字段字面量与模板相邻」的结构；其余模板（含 ``ThreadStartParams``
27、``TurnStartParams`` 28）的字段串不与该模板相邻，其表→结构名归属仍是开放轴，
本模块不把它们写进契约、也不假称已归属。

一轴超越：R62 只有元素数（arity），本模块首次给出非 hook 结构的**逐字字段名 + 声明顺序
+ 出现次数/后缀字节证据 + sha256 指纹**，并用 ``validate_struct_fields`` 双向守门
（缺字段 / 多字段 / 未登记名 / 逐字不一致）。指纹是契约漂移哨兵（A13）的稳定锚点。

源证据：``D:/DevEnv/Temp/r65/pairing.json``（probe10 全局配对）；报告
``docs/engineering/round11-reverse/R65-non-hook-struct-field-name-contract.md``。
"""

from __future__ import annotations

import hashlib
import re
from typing import Final

_SNAKE: Final = re.compile(r"^[a-z][a-z0-9_]*$")
_CAMEL: Final = re.compile(r"^[a-z][a-zA-Z0-9]*$")

__all__ = [
    "STRUCT_FIELD_NAMES",
    "STRUCT_FIELD_ARITY",
    "STRUCT_FIELD_EVIDENCE",
    "STRUCT_FIELD_NAMES_SET",
    "StructFieldNameError",
    "struct_names",
    "fields_of",
    "struct_arity",
    "field_style",
    "struct_fingerprint",
    "missing_struct_fields",
    "unknown_struct_fields",
    "validate_struct_fields",
    "is_struct_field_contract",
    "ensure_struct_field_contract",
]

# 结构名 → 逐字字段名元组（声明顺序，来自 serde FIELDS 的 (ptr,len) 表）。
STRUCT_FIELD_NAMES: Final[dict[str, tuple[str, ...]]] = {
    'AgentMessageDisplay': ('action', 'blockType', 'cyberTrustedAccess', 'checkTrustedContacts',),
    'AgentRoleToml': ('description', 'config_file', 'nickname_candidates',),
    'AppInfo': (
        'id', 'name', 'description', 'logoUrl', 'logoUrlDark', 'iconAssets',
        'iconDarkAssets', 'distributionChannel', 'branding', 'appMetadata', 'labels',
        'installUrl', 'isAccessible', 'isEnabled', 'pluginDisplayNames',
    ),
    'AwsSigV4Config': (
        'placeholder_access_key_id', 'region', 'service', 'access_key_id',
        'secret_access_key', 'session_token', 'port', 'max_body_bytes',
    ),
    'BrowserUseConfigToml': ('allow_history_access', 'default_origin_policy', 'origins',),
    'ChatgptAuthTokensRefreshResponse': ('accessToken', 'chatgptAccountId', 'chatgptPlanType',),
    'CodeModeConfigToml': ('enabled', 'default_exec_yield_time_ms', 'experimental_show_cell_overhead', 'tool_input_schema_max_bytes', 'excluded_tool_namespaces', 'direct_only_tool_namespaces',),
    'CodexWorkspaceMessage': ('message_id', 'message_type', 'message_body', 'created_at', 'archived_at',),
    'CompactedItemWire': (
        'message', 'replacement_history', 'replacement_history_metadata',
        'guardian_history', 'retained_context', 'mcp_resource_origins', 'window_number',
        'first_window_id', 'previous_window_id', 'window_id', 'compaction_response_id',
        'latest_token_usage_record', 'resume_metadata',
    ),
    'ConfigToml': (
        'model', 'daybreak', 'review_model', 'model_provider', 'model_context_window',
        'model_auto_compact_token_limit', 'model_auto_compact_token_limit_scope',
        'model_post_turn_compact_threshold_percent', 'approval_policy',
        'approvals_reviewer', 'auto_review', 'browser_use', 'computer_use',
        'shell_environment_policy', 'allow_login_shell', 'sandbox_mode',
        'allow_symlinked_codex_home', 'sandbox_workspace_write', 'default_permissions',
        'permissions', 'notify', 'instructions', 'developer_instructions',
        'include_permissions_instructions', 'include_apps_instructions',
        'include_collaboration_mode_instructions', 'include_environment_context',
        'include_environment_context_time', 'model_instructions_file', 'compact_prompt',
        'forced_chatgpt_workspace_id', 'forced_login_method', 'cli_auth_credentials_store',
        'mcp_servers', 'mcp_enterprise_managed_auth', 'mcp_oauth_credentials_store',
        'mcp_oauth_callback_port', 'mcp_oauth_callback_url',
        'mcp_optional_startup_grace_ms', 'model_providers', 'project_doc_max_bytes',
        'project_doc_fallback_filenames', 'tool_output_token_limit',
        'background_terminal_max_timeout', 'thread_unload_delay_secs', 'js_repl_node_path',
        'js_repl_node_module_dirs', 'profile', 'profiles', 'history', 'sqlite_home',
        'log_dir', 'file_opener', 'tui', 'hide_agent_reasoning', 'show_raw_agent_reasoning',
        'model_reasoning_effort', 'plan_mode_reasoning_effort', 'model_reasoning_summary',
        'model_verbosity', 'model_catalog_json', 'personality', 'service_tier',
        'chatgpt_base_url', 'apps_mcp_product_sku', 'responses_api_metadata',
        'orchestrator', 'cloud', 'openai_base_url', 'audio',
        'experimental_realtime_ws_base_url', 'experimental_realtime_webrtc_call_base_url',
        'experimental_realtime_ws_model', 'realtime',
        'experimental_realtime_ws_backend_prompt',
        'experimental_realtime_ws_startup_context',
        'experimental_realtime_start_instructions', 'experimental_thread_store_endpoint',
        'experimental_thread_store', 'projects', 'web_search', 'tools', 'tool_suggest',
        'agents', 'goals', 'memories', 'skills', 'hooks', 'plugins', 'marketplaces',
        'features', 'suppress_unstable_features_warning', 'ghost_snapshot',
        'project_root_markers', 'check_for_update_on_startup', 'disable_paste_burst',
        'analytics', 'feedback', 'apps', 'desktop', 'otel', 'windows', 'notice',
        'experimental_compact_prompt_file', 'experimental_use_unified_exec_tool',
        'oss_provider',
    ),
    'CurrentTimeReminderConfigToml': ('enabled', 'reminder_interval_seconds', 'clock_source', 'delivery_mode', 'sleep_tool',),
    'EnvironmentInfo': (
        'shell', 'executorVersion', 'providerId', 'cwd', 'userHomeDir', 'platformOs',
        'prependPathDirs', 'temporaryDirectories', 'tempDir', 'capabilities',
    ),
    'ExternalConfigMigrationPrompts': ('home', 'home_last_prompted_at', 'projects', 'project_last_prompted_at',),
    'FileSystemSandboxContext': (
        'permissions', 'sandboxOverride', 'cwd', 'workspaceRoots', 'userHomeDir',
        'temporaryDirectories', 'windowsSandboxLevel', 'windowsSandboxProxySettingsMode',
        'useLegacyLandlock',
    ),
    'FsCopyParams': ('sourcePath', 'destinationPath', 'recursive', 'sandbox',),
    'GranularApprovalConfig': ('sandbox_approval', 'rules', 'skill_approval', 'request_permissions', 'mcp_elicitations',),
    'GuardianElasticSectionConfigToml': ('min_total_section_tokens', 'max_section_entry_tokens', 'max_total_section_tokens',),
    'GuardianV2ConfigToml': (
        'sync_elastic_budgeting', 'sync_elastic_sections', 'transcript_mode',
        'async_classifier_mode', 'async_classifier_conversation_token_limit', 'enabled',
        'free_guardian', 'thread_context', 'persist_scores', 'classifier_instructions',
        'review_threshold', 'max_tool_call_lag', 'reasoning_effort', 'max_action_tokens',
        'max_classifier_instruction_tokens', 'reuse_parent_compaction',
        'max_parent_compaction_tokens', 'review_scope', 'transcript',
    ),
    'GuardianV2TranscriptConfigToml': (
        'sources', 'include_images', 'max_message_entry_tokens', 'max_tool_entry_tokens',
        'max_message_transcript_tokens', 'max_tool_transcript_tokens',
        'max_recent_non_user_entries',
    ),
    'ImagegenArgs': ('prompt', 'gif', 'transparent_background', 'referenced_image_paths', 'num_last_images_to_include',),
    'McpResourceOrigin': (
        'call_id', 'turn_id', 'tool', 'connector_id', 'link_id', 'uri', 'ambiguous_account',
    ),
    'MisalignmentErrorDetails': ('errorType', 'detailedExplanation', 'steer', 'reviewTarget',),
    'ModelProviderCapabilities': ('cyber_access_programs', 'external_web_access', 'remote_compaction',),
    'ModelProviderInfo': (
        'name', 'base_url', 'model_catalog_url', 'env_key', 'env_key_instructions',
        'experimental_bearer_token', 'auth', 'gateway_oauth', 'aws', 'project_id',
        'location', 'credential_file', 'wire_api', 'capabilities', 'query_params',
        'http_headers', 'env_http_headers', 'request_max_retries', 'stream_max_retries',
        'stream_idle_timeout_ms', 'websocket_connect_timeout_ms', 'requires_openai_auth',
        'supports_websockets', 'supports_standalone_web_search',
    ),
    'ModelTokenBudgetConfig': (
        'enabled', 'use_history_notes_extension', 'reminder_threshold_tokens',
        'reminder_message_template', 'guidance_message', 'auto_compact_fallback_prompt',
        'auto_compact_fallback_buffer_tokens',
    ),
    'MultiAgentV2ConfigToml': (
        'enabled', 'max_concurrent_threads_per_session', 'min_wait_timeout_ms',
        'max_wait_timeout_ms', 'default_wait_timeout_ms', 'usage_hint_enabled',
        'usage_hint_text', 'root_agent_usage_hint_text', 'subagent_usage_hint_text',
        'subagent_developer_instructions', 'preserve_fork_prefix',
        'multi_agent_mode_hint_text', 'tool_namespace', 'hide_spawn_agent_metadata',
        'expose_spawn_agent_model_overrides', 'wait_agent_enabled', 'disable_native_tools',
        'disable_direct_message', 'message_board_in_memory', 'message_board_remote',
        'non_code_mode_only',
    ),
    'NetworkMitmHookToml': (
        'schemes', 'ports', 'host', 'methods', 'path_prefixes', 'query', 'headers', 'body',
        'action',
    ),
    'NetworkToml': (
        'enabled', 'proxy_url', 'enable_socks5', 'socks_url', 'enable_socks5_udp',
        'allow_upstream_proxy', 'dangerously_allow_non_loopback_proxy',
        'dangerously_allow_all_unix_sockets', 'mode', 'domains', 'unix_sockets',
        'allow_local_binding', 'mitm',
    ),
    'OtelConfigToml': (
        'tool_result', 'log_sse_deltas', 'log_user_prompt', 'log_agent_responses',
        'log_guardian_assessments', 'environment', 'exporter', 'trace_exporter',
        'metrics_exporter', 'span_attributes', 'tracestate',
    ),
    'ProcessExitedNotification': (
        'processHandle', 'exitCode', 'outputDrainTimedOut', 'stdout', 'stdoutCapReached',
        'stderr', 'stderrCapReached',
    ),
    'RateLimitSnapshot': (
        'limitId', 'limitName', 'normalModelSlug', 'primary', 'secondary', 'credits',
        'individualLimit', 'spendControlReached', 'planType', 'rateLimitReachedType',
    ),
    'RawNetworkRequirementsToml': (
        'enabled', 'http_port', 'socks_port', 'allow_upstream_proxy',
        'dangerously_allow_non_loopback_proxy', 'dangerously_allow_all_unix_sockets',
        'domains', 'review_domains', 'allowed_domains', 'managed_allowed_domains_only',
        'denied_domains', 'unix_sockets', 'allow_unix_sockets', 'allow_local_binding',
        'header_injections',
    ),
    'RemoteControlClientResponse': (
        'client_id', 'display_name', 'device_type', 'platform', 'os_version',
        'device_model', 'app_version', 'last_seen_at',
    ),
    'RemotePluginDirectoryItem': (
        'id', 'name', 'canonical_app_id', 'scope', 'discoverability',
        'creator_account_user_id', 'creator_name', 'share_url', 'share_principals',
        'can_publish_to_workspace', 'installation_policy', 'installation_policy_source',
        'must_show_installation_interstitial', 'authentication_policy', 'status',
        'disabled_reason', 'eligible_plan_types', 'release',
    ),
    'RequirementsExecPolicyPrefixRuleToml': ('canonical_matching', 'pattern', 'decision', 'justification',),
    'ResponseCompletedUsage': ('input_tokens', 'input_tokens_details', 'output_tokens', 'output_tokens_details', 'total_tokens', 'codex_rollout_budget_units',),
    'RolloutBudgetConfigToml': ('enforce_limit', 'enabled', 'limit_tokens', 'reminder_at_remaining_tokens', 'sampling_token_weight', 'prefill_token_weight',),
    'SandboxProvisioningRequest': ('codex_home', 'registered_core', 'refresh_only', 'settings', 'listeners',),
    'SportsOperation': (
        'tool', 'fn', 'league', 'team', 'opponent', 'date_from', 'date_to', 'num_games',
        'locale',
    ),
    'ThreadGoal': (
        'threadId', 'objective', 'status', 'tokenBudget', 'tokensUsed', 'timeUsedSeconds',
        'createdAt', 'updatedAt',
    ),
    'TokenBudgetConfigToml': (
        'enabled', 'use_history_notes_extension', 'reminder_threshold_tokens',
        'reminder_message_template', 'guidance_message', 'auto_compact_fallback_prompt',
        'auto_compact_fallback_buffer_tokens',
    ),
    'TokenUsageBreakdown': ('totalTokens', 'inputTokens', 'cachedInputTokens', 'cacheWriteInputTokens', 'outputTokens', 'reasoningOutputTokens',),
    'TokenUsageProfileStats': ('lifetime_tokens', 'peak_daily_tokens', 'longest_running_turn_sec', 'current_streak_days', 'longest_streak_days', 'daily_usage_buckets',),
    'TurnError': ('message', 'codexErrorInfo', 'additionalDetails', 'misalignment',),
}

# 结构名 → 元素数（= 独立来源的 ``struct X with N elements`` 模板读数，与字段数逐一相等）。
STRUCT_FIELD_ARITY: Final[dict[str, int]] = {
    'AgentMessageDisplay': 4,
    'AgentRoleToml': 3,
    'AppInfo': 15,
    'AwsSigV4Config': 8,
    'BrowserUseConfigToml': 3,
    'ChatgptAuthTokensRefreshResponse': 3,
    'CodeModeConfigToml': 6,
    'CodexWorkspaceMessage': 5,
    'CompactedItemWire': 13,
    'ConfigToml': 106,
    'CurrentTimeReminderConfigToml': 5,
    'EnvironmentInfo': 10,
    'ExternalConfigMigrationPrompts': 4,
    'FileSystemSandboxContext': 9,
    'FsCopyParams': 4,
    'GranularApprovalConfig': 5,
    'GuardianElasticSectionConfigToml': 3,
    'GuardianV2ConfigToml': 19,
    'GuardianV2TranscriptConfigToml': 7,
    'ImagegenArgs': 5,
    'McpResourceOrigin': 7,
    'MisalignmentErrorDetails': 4,
    'ModelProviderCapabilities': 3,
    'ModelProviderInfo': 24,
    'ModelTokenBudgetConfig': 7,
    'MultiAgentV2ConfigToml': 21,
    'NetworkMitmHookToml': 9,
    'NetworkToml': 13,
    'OtelConfigToml': 11,
    'ProcessExitedNotification': 7,
    'RateLimitSnapshot': 10,
    'RawNetworkRequirementsToml': 15,
    'RemoteControlClientResponse': 8,
    'RemotePluginDirectoryItem': 18,
    'RequirementsExecPolicyPrefixRuleToml': 4,
    'ResponseCompletedUsage': 6,
    'RolloutBudgetConfigToml': 6,
    'SandboxProvisioningRequest': 5,
    'SportsOperation': 9,
    'ThreadGoal': 8,
    'TokenBudgetConfigToml': 7,
    'TokenUsageBreakdown': 6,
    'TokenUsageProfileStats': 6,
    'TurnError': 4,
}

# 结构名 → 取证强度：模板出现次数 / 最长逐字节后缀字节数 / 后缀完整覆盖的字段数 / 副本表地址。
STRUCT_FIELD_EVIDENCE: Final[dict[str, dict[str, object]]] = {
    'AgentMessageDisplay': {'occurrences': 7, 'suffix_bytes': 47, 'fields_covered': 3, 'tables': ('0x151e06f00',)},
    'AgentRoleToml': {'occurrences': 1, 'suffix_bytes': 41, 'fields_covered': 3, 'tables': ('0x151aa1090',)},
    'AppInfo': {'occurrences': 3, 'suffix_bytes': 146, 'fields_covered': 13, 'tables': ('0x151be2bd0', '0x151ce9f60', '0x152334e30',)},
    'AwsSigV4Config': {'occurrences': 3, 'suffix_bytes': 68, 'fields_covered': 6, 'tables': ('0x151a9a1b0', '0x151d132f0', '0x15240b040',)},
    'BrowserUseConfigToml': {'occurrences': 5, 'suffix_bytes': 48, 'fields_covered': 3, 'tables': ('0x151a09a80', '0x151cdb6a0',)},
    'ChatgptAuthTokensRefreshResponse': {'occurrences': 1, 'suffix_bytes': 42, 'fields_covered': 3, 'tables': ('0x151ad9c20',)},
    'CodeModeConfigToml': {'occurrences': 2, 'suffix_bytes': 135, 'fields_covered': 5, 'tables': ('0x151ad0ee0', '0x151cc7730',)},
    'CodexWorkspaceMessage': {'occurrences': 1, 'suffix_bytes': 45, 'fields_covered': 4, 'tables': ('0x1519cb5d0',)},
    'CompactedItemWire': {'occurrences': 1, 'suffix_bytes': 71, 'fields_covered': 4, 'tables': ('0x152224e10',)},
    'ConfigToml': {'occurrences': 4, 'suffix_bytes': 78, 'fields_covered': 3, 'tables': ('0x1518ab8d0', '0x151a9e350', '0x1523b66c0',)},
    'CurrentTimeReminderConfigToml': {'occurrences': 3, 'suffix_bytes': 60, 'fields_covered': 4, 'tables': ('0x151a9ccb0', '0x151ad1ba0', '0x151cc8340', '0x152330e40',)},
    'EnvironmentInfo': {'occurrences': 1, 'suffix_bytes': 76, 'fields_covered': 6, 'tables': ('0x15200fc70',)},
    'ExternalConfigMigrationPrompts': {'occurrences': 1, 'suffix_bytes': 57, 'fields_covered': 4, 'tables': ('0x151b12b30',)},
    'FileSystemSandboxContext': {'occurrences': 1, 'suffix_bytes': 112, 'fields_covered': 6, 'tables': ('0x151ea6340',)},
    'FsCopyParams': {'occurrences': 1, 'suffix_bytes': 41, 'fields_covered': 4, 'tables': ('0x151ea7480',)},
    'GranularApprovalConfig': {'occurrences': 5, 'suffix_bytes': 70, 'fields_covered': 5, 'tables': ('0x151b42a10', '0x151bffeb0', '0x151cb5000', '0x1523b8fd0',)},
    'GuardianElasticSectionConfigToml': {'occurrences': 7, 'suffix_bytes': 72, 'fields_covered': 3, 'tables': ('0x151a9cee0', '0x151cc8570', '0x152331070',)},
    'GuardianV2ConfigToml': {'occurrences': 6, 'suffix_bytes': 123, 'fields_covered': 6, 'tables': ('0x151f24d70',)},
    'GuardianV2TranscriptConfigToml': {'occurrences': 6, 'suffix_bytes': 141, 'fields_covered': 6, 'tables': ('0x151946b10', '0x151e05bf0',)},
    'ImagegenArgs': {'occurrences': 1, 'suffix_bytes': 79, 'fields_covered': 5, 'tables': ('0x151fb20b0',)},
    'McpResourceOrigin': {'occurrences': 1, 'suffix_bytes': 57, 'fields_covered': 7, 'tables': ('0x152226170',)},
    'MisalignmentErrorDetails': {'occurrences': 2, 'suffix_bytes': 45, 'fields_covered': 4, 'tables': ('0x151b3f4e0', '0x151c0e9a0',)},
    'ModelProviderCapabilities': {'occurrences': 6, 'suffix_bytes': 57, 'fields_covered': 3, 'tables': ('0x15195d970', '0x151ad9cc0', '0x151cb95a0',)},
    'ModelProviderInfo': {'occurrences': 6, 'suffix_bytes': 157, 'fields_covered': 7, 'tables': ('0x151af7040', '0x1523c2c30',)},
    'ModelTokenBudgetConfig': {'occurrences': 1, 'suffix_bytes': 163, 'fields_covered': 7, 'tables': ('0x1519461b0', '0x151a9c400', '0x151cc7b60', '0x151e052d0',)},
    'MultiAgentV2ConfigToml': {'occurrences': 5, 'suffix_bytes': 415, 'fields_covered': 19, 'tables': ('0x151a9c6a0',)},
    'NetworkMitmHookToml': {'occurrences': 2, 'suffix_bytes': 58, 'fields_covered': 9, 'tables': ('0x1519c36b0', '0x151b29380', '0x151cc5a20', '0x151d09c50',)},
    'NetworkToml': {'occurrences': 4, 'suffix_bytes': 42, 'fields_covered': 4, 'tables': ('0x151b29260', '0x151cc58b0', '0x151d09b40',)},
    'OtelConfigToml': {'occurrences': 6, 'suffix_bytes': 157, 'fields_covered': 11, 'tables': ('0x1519c4720', '0x151b132a0', '0x1523640d0',)},
    'ProcessExitedNotification': {'occurrences': 2, 'suffix_bytes': 63, 'fields_covered': 5, 'tables': ('0x151bf6880',)},
    'RateLimitSnapshot': {'occurrences': 2, 'suffix_bytes': 109, 'fields_covered': 9, 'tables': ('0x151c06590',)},
    'RawNetworkRequirementsToml': {'occurrences': 1, 'suffix_bytes': 116, 'fields_covered': 6, 'tables': ('0x151cbfbb0',)},
    'RemoteControlClientResponse': {'occurrences': 1, 'suffix_bytes': 45, 'fields_covered': 4, 'tables': ('0x151a202d0',)},
    'RemotePluginDirectoryItem': {'occurrences': 2, 'suffix_bytes': 41, 'fields_covered': 3, 'tables': ('0x1519c9510', '0x151db3b90', '0x151e558f0',)},
    'RequirementsExecPolicyPrefixRuleToml': {'occurrences': 2, 'suffix_bytes': 46, 'fields_covered': 4, 'tables': ('0x151cdc500',)},
    'ResponseCompletedUsage': {'occurrences': 1, 'suffix_bytes': 104, 'fields_covered': 6, 'tables': ('0x151ac0e30',)},
    'RolloutBudgetConfigToml': {'occurrences': 6, 'suffix_bytes': 81, 'fields_covered': 4, 'tables': ('0x151cc8120', '0x152330c40',)},
    'SandboxProvisioningRequest': {'occurrences': 1, 'suffix_bytes': 44, 'fields_covered': 4, 'tables': ('0x15246bf50',)},
    'SportsOperation': {'occurrences': 1, 'suffix_bytes': 55, 'fields_covered': 9, 'tables': ('0x15245c7b0',)},
    'ThreadGoal': {'occurrences': 3, 'suffix_bytes': 54, 'fields_covered': 5, 'tables': ('0x151a1ebf0',)},
    'TokenBudgetConfigToml': {'occurrences': 5, 'suffix_bytes': 156, 'fields_covered': 6, 'tables': ('0x1519461b0', '0x151a9c400', '0x151cc7b60', '0x151e052d0',)},
    'TokenUsageBreakdown': {'occurrences': 2, 'suffix_bytes': 93, 'fields_covered': 6, 'tables': ('0x151c05d20',)},
    'TokenUsageProfileStats': {'occurrences': 1, 'suffix_bytes': 113, 'fields_covered': 6, 'tables': ('0x15240d390',)},
    'TurnError': {'occurrences': 3, 'suffix_bytes': 43, 'fields_covered': 3, 'tables': ('0x151b3f2f0', '0x15236c9c0', '0x152427c20',)},
}

STRUCT_FIELD_NAMES_SET: Final[frozenset[str]] = frozenset(STRUCT_FIELD_NAMES)


class StructFieldNameError(ValueError):
    """未登记结构名、或字段名集合与逐字契约不一致时抛错。"""


def struct_names() -> tuple[str, ...]:
    return tuple(STRUCT_FIELD_NAMES)


def ensure_struct_field_contract(name: str) -> str:
    if not isinstance(name, str) or name not in STRUCT_FIELD_NAMES_SET:
        raise StructFieldNameError(f"未登记结构字段契约: {name!r}")
    return name


def is_struct_field_contract(name: str) -> bool:
    return isinstance(name, str) and name in STRUCT_FIELD_NAMES_SET


def fields_of(name: str) -> tuple[str, ...]:
    ensure_struct_field_contract(name)
    return STRUCT_FIELD_NAMES[name]


def struct_arity(name: str) -> int:
    ensure_struct_field_contract(name)
    return STRUCT_FIELD_ARITY[name]


def field_style(name: str) -> str:
    """字段名风格：``snake`` / ``camel`` / ``mixed``（按逐字形态归类，不做改名）。"""
    fields = fields_of(name)
    if all(_SNAKE.fullmatch(f) for f in fields):
        return "snake"
    if all(_CAMEL.fullmatch(f) for f in fields):
        return "camel"
    return "mixed"


def struct_fingerprint(name: str) -> str:
    """字段序的稳定锚点：sha256(``"\x1f".join(fields)``)，用于契约漂移对比。"""
    return hashlib.sha256(
        "\x1f".join(fields_of(name)).encode()
    ).hexdigest()


def missing_struct_fields(name: str, mapping: dict[str, object]) -> tuple[str, ...]:
    """契约里该有、而 mapping 缺的字段名（逐字、保持声明顺序）。"""
    fields = fields_of(name)
    return tuple(f for f in fields if f not in mapping)


def unknown_struct_fields(name: str, mapping: dict[str, object]) -> tuple[str, ...]:
    """mapping 里多出来的字段名（契约未登记），按 mapping 自身栈序返回。"""
    fields = fields_of(name)
    known = set(fields)
    return tuple(k for k in mapping if k not in known)


def validate_struct_fields(name: str, mapping: dict[str, object]) -> str:
    """守门：键集必须与逐字契约完全相等（顺序不敏感，Wire JSON 无序）。"""
    ensure_struct_field_contract(name)
    missing = missing_struct_fields(name, mapping)
    unknown = unknown_struct_fields(name, mapping)
    if missing:
        raise StructFieldNameError(f"{name!r} 缺字段: {missing!r}")
    if unknown:
        raise StructFieldNameError(f"{name!r} 未登记字段: {unknown!r}")
    return name

# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
