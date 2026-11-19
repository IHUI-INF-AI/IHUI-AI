# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""客户端 RPC 方法清单封闭集（ClientRequest，187 struct variant） —— 统一工程规范 R59（协议面封闭集轴型）。

取证（codex.exe 26.1111.2228.0，365MB Rust PE，strings 逐字 + ``struct variant X::Y with N element`` 机器反推，
见 R58 ``families.out`` / 本轮 ``docs/engineering/round11-reverse/R59-*.md``）：逐字 variant 名与元素数表由
机器从二进制抽取，模块内表与单测双重钉死。本仓归属过滤：该族名在本仓 app/core 零命中（或仅为异层别名，
见下），是干净的协议面空白——与 R56-R58 的语义 enum 不同，本轴登记的是**RPC 方法/事件载荷名清单**。

一轴超越：对照把 187 个客户端 RPC 方法散在协议分发 match 里，只有方法名没有方法族维度。本模块钉死 187 方法逐字表（元素数一律 2，机器反推）+ 42 首 token→方法族归类，并提供前缀归类 ``classify_client_request_by_prefix`` 与显式归类双重交叉校验——两路判据对全部 187 方法必须一致，这是 R56-R58 单分类模块没有的第二维可执行守门。

诚实边界：187 方法名与元素数逐字确证；serde tag/rename 未确证（按 Rust variant 名逐字登记）。42 首 token→方法族是**本仓语义归类**，非对照原生判据；``by_prefix`` 与 ``DOMAIN`` 本就是同一规则的两处实现（交叉校验防漂移），不是两个独立真相源。方法运行时语义未确证。
"""

from __future__ import annotations

import re
from enum import StrEnum
from typing import Final

__all__ = [
    "ClientRequestMethod",
    "ClientRequestMethodError",
    "CLIENT_REQUEST_ELEMENTS",
    "CLIENT_REQUEST_DOMAIN",
    "client_request_names",
    "expected_element_count",
    "ensure_client_request_method",
    "client_request_domain",
    "client_request_domain_members",
    "is_client_request",
    "validate_client_request",
    "_TOKEN_DOMAIN",
    "client_request_prefix",
    "classify_client_request_by_prefix",
]

# 逐字 variant 名 → struct 元素数（来自 ``with N element`` 声明，漂移由 pytest 钉死）。
CLIENT_REQUEST_ELEMENTS: Final[dict[str, int]] = {
    "AccountSessionsList": 2,
    "AccountSessionsSwitch": 2,
    "AppsInstalled": 2,
    "AppsList": 2,
    "AppsRead": 2,
    "BedrockCheckGovCloudRequirements": 2,
    "BedrockDiscover": 2,
    "BedrockSetup": 2,
    "CancelLoginAccount": 2,
    "CollaborationModeList": 2,
    "CommandExecResize": 2,
    "CommandExecTerminate": 2,
    "CommandExecWrite": 2,
    "ConfigBatchWrite": 2,
    "ConfigRead": 2,
    "ConfigRequirementsRead": 2,
    "ConfigValueWrite": 2,
    "ConsumeAccountRateLimitResetCredit": 2,
    "EnvironmentAdd": 2,
    "EnvironmentInfo": 2,
    "EnvironmentStatus": 2,
    "ExperimentalFeatureEnablementSet": 2,
    "ExperimentalFeatureList": 2,
    "ExternalAgentConfigDetect": 2,
    "ExternalAgentConfigImport": 2,
    "ExternalAgentConfigImportHistoriesRead": 2,
    "ExternalAgentConfigImportHistoryRecord": 2,
    "FeedbackSave": 2,
    "FeedbackUpload": 2,
    "FsCopy": 2,
    "FsCreateDirectory": 2,
    "FsGetMetadata": 2,
    "FsReadDirectory": 2,
    "FsReadFile": 2,
    "FsRemove": 2,
    "FsUnwatch": 2,
    "FsWatch": 2,
    "FsWriteFile": 2,
    "FuzzyFileSearch": 2,
    "FuzzyFileSearchSessionStart": 2,
    "FuzzyFileSearchSessionStop": 2,
    "FuzzyFileSearchSessionUpdate": 2,
    "GatewayOAuthCancel": 2,
    "GatewayOAuthLogin": 2,
    "GatewayOAuthRead": 2,
    "GcpSetup": 2,
    "GetAccount": 2,
    "GetAccountRateLimits": 2,
    "GetAccountSecuritySetup": 2,
    "GetAccountTokenUsage": 2,
    "GetAuthStatus": 2,
    "GetConversationSummary": 2,
    "GetWorkspaceMessages": 2,
    "GitDiffToRemote": 2,
    "HooksList": 2,
    "Initialize": 2,
    "LoginAccount": 2,
    "LogoutAccount": 2,
    "MarketplaceAdd": 2,
    "MarketplaceRemove": 2,
    "MarketplaceUpgrade": 2,
    "McpResourceRead": 2,
    "McpServerEventStreamStart": 2,
    "McpServerEventStreamStop": 2,
    "McpServerOauthLogin": 2,
    "McpServerRefresh": 2,
    "McpServerStatusList": 2,
    "McpServerToolCall": 2,
    "MemoryReset": 2,
    "MemoryStatus": 2,
    "MockExperimentalMethod": 2,
    "ModelList": 2,
    "ModelProviderCapabilitiesRead": 2,
    "ModelProviderConfigWrite": 2,
    "ModelProviderList": 2,
    "OneOffCommandExec": 2,
    "PermissionProfileList": 2,
    "PluginInstall": 2,
    "PluginInstalled": 2,
    "PluginList": 2,
    "PluginRead": 2,
    "PluginReconcile": 2,
    "PluginSearch": 2,
    "PluginShareCheckout": 2,
    "PluginShareDelete": 2,
    "PluginShareList": 2,
    "PluginShareSave": 2,
    "PluginShareUpdateTargets": 2,
    "PluginSkillRead": 2,
    "PluginUninstall": 2,
    "ProcessKill": 2,
    "ProcessResizePty": 2,
    "ProcessSpawn": 2,
    "ProcessWriteStdin": 2,
    "ProjectCreate": 2,
    "ProjectDelete": 2,
    "ProjectImport": 2,
    "ProjectList": 2,
    "ProjectMove": 2,
    "ProjectRead": 2,
    "ProjectUpdate": 2,
    "RemoteControlClientsList": 2,
    "RemoteControlClientsRevoke": 2,
    "RemoteControlDisable": 2,
    "RemoteControlEnable": 2,
    "RemoteControlPairingStart": 2,
    "RemoteControlPairingStatus": 2,
    "RemoteControlStatusRead": 2,
    "ReviewStart": 2,
    "RolloutCompress": 2,
    "SendAddCreditsNudgeEmail": 2,
    "ServerDiagnostics": 2,
    "SkillsConfigWrite": 2,
    "SkillsExtraRootsSet": 2,
    "SkillsList": 2,
    "ThreadApproveGuardianDeniedAction": 2,
    "ThreadArchive": 2,
    "ThreadAttachmentAdd": 2,
    "ThreadAttachmentList": 2,
    "ThreadAttachmentOwnerList": 2,
    "ThreadAttachmentRemove": 2,
    "ThreadBackgroundTerminalsClean": 2,
    "ThreadBackgroundTerminalsList": 2,
    "ThreadBackgroundTerminalsTerminate": 2,
    "ThreadCompactStart": 2,
    "ThreadDecrementElicitation": 2,
    "ThreadDelete": 2,
    "ThreadFork": 2,
    "ThreadGoalClear": 2,
    "ThreadGoalGet": 2,
    "ThreadGoalSet": 2,
    "ThreadGuardianReview": 2,
    "ThreadIncrementElicitation": 2,
    "ThreadInjectItems": 2,
    "ThreadItemsList": 2,
    "ThreadItemsRead": 2,
    "ThreadList": 2,
    "ThreadLoadedList": 2,
    "ThreadMemoryModeSet": 2,
    "ThreadMemoryRead": 2,
    "ThreadMetadataUpdate": 2,
    "ThreadPredictionRequest": 2,
    "ThreadPrepareApprovedPlan": 2,
    "ThreadQueueAdd": 2,
    "ThreadQueueDelete": 2,
    "ThreadQueueList": 2,
    "ThreadQueueReorder": 2,
    "ThreadQueueStart": 2,
    "ThreadQueueUpdate": 2,
    "ThreadRead": 2,
    "ThreadReadStateUpdate": 2,
    "ThreadRealtimeAppendAudio": 2,
    "ThreadRealtimeAppendSpeech": 2,
    "ThreadRealtimeAppendText": 2,
    "ThreadRealtimeListVoices": 2,
    "ThreadRealtimeStart": 2,
    "ThreadRealtimeStop": 2,
    "ThreadResume": 2,
    "ThreadRevert": 2,
    "ThreadSample": 2,
    "ThreadSampleCancel": 2,
    "ThreadSearch": 2,
    "ThreadSearchOccurrences": 2,
    "ThreadSectionCreate": 2,
    "ThreadSectionDelete": 2,
    "ThreadSectionList": 2,
    "ThreadSectionMove": 2,
    "ThreadSectionUpdate": 2,
    "ThreadSetName": 2,
    "ThreadSettingsUpdate": 2,
    "ThreadShellCommand": 2,
    "ThreadStart": 2,
    "ThreadTimelineList": 2,
    "ThreadTurnsList": 2,
    "ThreadUnarchive": 2,
    "ThreadUnsubscribe": 2,
    "TurnInterrupt": 2,
    "TurnSettingsUpdate": 2,
    "TurnStart": 2,
    "TurnSteer": 2,
    "UserVerificationCancel": 2,
    "UserVerificationDelete": 2,
    "UserVerificationEnroll": 2,
    "UserVerificationStatus": 2,
    "UserVerificationVerify": 2,
    "WindowsSandboxReadiness": 2,
    "WindowsSandboxSetupStart": 2,

}

# 本仓语义归类（非对照原生判据）：每个方法/载荷归入一个协议面域。
CLIENT_REQUEST_DOMAIN: Final[dict[str, str]] = {
    "AccountSessionsList": "account",
    "AccountSessionsSwitch": "account",
    "AppsInstalled": "app",
    "AppsList": "app",
    "AppsRead": "app",
    "BedrockCheckGovCloudRequirements": "cloud_setup",
    "BedrockDiscover": "cloud_setup",
    "BedrockSetup": "cloud_setup",
    "CancelLoginAccount": "auth",
    "CollaborationModeList": "collaboration",
    "CommandExecResize": "process",
    "CommandExecTerminate": "process",
    "CommandExecWrite": "process",
    "ConfigBatchWrite": "config",
    "ConfigRead": "config",
    "ConfigRequirementsRead": "config",
    "ConfigValueWrite": "config",
    "ConsumeAccountRateLimitResetCredit": "account",
    "EnvironmentAdd": "environment",
    "EnvironmentInfo": "environment",
    "EnvironmentStatus": "environment",
    "ExperimentalFeatureEnablementSet": "experimental",
    "ExperimentalFeatureList": "experimental",
    "ExternalAgentConfigDetect": "external_agent",
    "ExternalAgentConfigImport": "external_agent",
    "ExternalAgentConfigImportHistoriesRead": "external_agent",
    "ExternalAgentConfigImportHistoryRecord": "external_agent",
    "FeedbackSave": "feedback",
    "FeedbackUpload": "feedback",
    "FsCopy": "filesystem",
    "FsCreateDirectory": "filesystem",
    "FsGetMetadata": "filesystem",
    "FsReadDirectory": "filesystem",
    "FsReadFile": "filesystem",
    "FsRemove": "filesystem",
    "FsUnwatch": "filesystem",
    "FsWatch": "filesystem",
    "FsWriteFile": "filesystem",
    "FuzzyFileSearch": "fuzzy_search",
    "FuzzyFileSearchSessionStart": "fuzzy_search",
    "FuzzyFileSearchSessionStop": "fuzzy_search",
    "FuzzyFileSearchSessionUpdate": "fuzzy_search",
    "GatewayOAuthCancel": "oauth",
    "GatewayOAuthLogin": "oauth",
    "GatewayOAuthRead": "oauth",
    "GcpSetup": "cloud_setup",
    "GetAccount": "query",
    "GetAccountRateLimits": "query",
    "GetAccountSecuritySetup": "query",
    "GetAccountTokenUsage": "query",
    "GetAuthStatus": "query",
    "GetConversationSummary": "query",
    "GetWorkspaceMessages": "query",
    "GitDiffToRemote": "git",
    "HooksList": "hooks",
    "Initialize": "lifecycle",
    "LoginAccount": "auth",
    "LogoutAccount": "auth",
    "MarketplaceAdd": "marketplace",
    "MarketplaceRemove": "marketplace",
    "MarketplaceUpgrade": "marketplace",
    "McpResourceRead": "mcp",
    "McpServerEventStreamStart": "mcp",
    "McpServerEventStreamStop": "mcp",
    "McpServerOauthLogin": "mcp",
    "McpServerRefresh": "mcp",
    "McpServerStatusList": "mcp",
    "McpServerToolCall": "mcp",
    "MemoryReset": "memory",
    "MemoryStatus": "memory",
    "MockExperimentalMethod": "experimental",
    "ModelList": "model",
    "ModelProviderCapabilitiesRead": "model",
    "ModelProviderConfigWrite": "model",
    "ModelProviderList": "model",
    "OneOffCommandExec": "process",
    "PermissionProfileList": "permission",
    "PluginInstall": "plugin",
    "PluginInstalled": "plugin",
    "PluginList": "plugin",
    "PluginRead": "plugin",
    "PluginReconcile": "plugin",
    "PluginSearch": "plugin",
    "PluginShareCheckout": "plugin",
    "PluginShareDelete": "plugin",
    "PluginShareList": "plugin",
    "PluginShareSave": "plugin",
    "PluginShareUpdateTargets": "plugin",
    "PluginSkillRead": "plugin",
    "PluginUninstall": "plugin",
    "ProcessKill": "process",
    "ProcessResizePty": "process",
    "ProcessSpawn": "process",
    "ProcessWriteStdin": "process",
    "ProjectCreate": "project",
    "ProjectDelete": "project",
    "ProjectImport": "project",
    "ProjectList": "project",
    "ProjectMove": "project",
    "ProjectRead": "project",
    "ProjectUpdate": "project",
    "RemoteControlClientsList": "remote_control",
    "RemoteControlClientsRevoke": "remote_control",
    "RemoteControlDisable": "remote_control",
    "RemoteControlEnable": "remote_control",
    "RemoteControlPairingStart": "remote_control",
    "RemoteControlPairingStatus": "remote_control",
    "RemoteControlStatusRead": "remote_control",
    "ReviewStart": "review",
    "RolloutCompress": "rollout",
    "SendAddCreditsNudgeEmail": "account",
    "ServerDiagnostics": "diagnostics",
    "SkillsConfigWrite": "skills",
    "SkillsExtraRootsSet": "skills",
    "SkillsList": "skills",
    "ThreadApproveGuardianDeniedAction": "thread",
    "ThreadArchive": "thread",
    "ThreadAttachmentAdd": "thread",
    "ThreadAttachmentList": "thread",
    "ThreadAttachmentOwnerList": "thread",
    "ThreadAttachmentRemove": "thread",
    "ThreadBackgroundTerminalsClean": "thread",
    "ThreadBackgroundTerminalsList": "thread",
    "ThreadBackgroundTerminalsTerminate": "thread",
    "ThreadCompactStart": "thread",
    "ThreadDecrementElicitation": "thread",
    "ThreadDelete": "thread",
    "ThreadFork": "thread",
    "ThreadGoalClear": "thread",
    "ThreadGoalGet": "thread",
    "ThreadGoalSet": "thread",
    "ThreadGuardianReview": "thread",
    "ThreadIncrementElicitation": "thread",
    "ThreadInjectItems": "thread",
    "ThreadItemsList": "thread",
    "ThreadItemsRead": "thread",
    "ThreadList": "thread",
    "ThreadLoadedList": "thread",
    "ThreadMemoryModeSet": "thread",
    "ThreadMemoryRead": "thread",
    "ThreadMetadataUpdate": "thread",
    "ThreadPredictionRequest": "thread",
    "ThreadPrepareApprovedPlan": "thread",
    "ThreadQueueAdd": "thread",
    "ThreadQueueDelete": "thread",
    "ThreadQueueList": "thread",
    "ThreadQueueReorder": "thread",
    "ThreadQueueStart": "thread",
    "ThreadQueueUpdate": "thread",
    "ThreadRead": "thread",
    "ThreadReadStateUpdate": "thread",
    "ThreadRealtimeAppendAudio": "thread",
    "ThreadRealtimeAppendSpeech": "thread",
    "ThreadRealtimeAppendText": "thread",
    "ThreadRealtimeListVoices": "thread",
    "ThreadRealtimeStart": "thread",
    "ThreadRealtimeStop": "thread",
    "ThreadResume": "thread",
    "ThreadRevert": "thread",
    "ThreadSample": "thread",
    "ThreadSampleCancel": "thread",
    "ThreadSearch": "thread",
    "ThreadSearchOccurrences": "thread",
    "ThreadSectionCreate": "thread",
    "ThreadSectionDelete": "thread",
    "ThreadSectionList": "thread",
    "ThreadSectionMove": "thread",
    "ThreadSectionUpdate": "thread",
    "ThreadSetName": "thread",
    "ThreadSettingsUpdate": "thread",
    "ThreadShellCommand": "thread",
    "ThreadStart": "thread",
    "ThreadTimelineList": "thread",
    "ThreadTurnsList": "thread",
    "ThreadUnarchive": "thread",
    "ThreadUnsubscribe": "thread",
    "TurnInterrupt": "turn",
    "TurnSettingsUpdate": "turn",
    "TurnStart": "turn",
    "TurnSteer": "turn",
    "UserVerificationCancel": "user_verification",
    "UserVerificationDelete": "user_verification",
    "UserVerificationEnroll": "user_verification",
    "UserVerificationStatus": "user_verification",
    "UserVerificationVerify": "user_verification",
    "WindowsSandboxReadiness": "sandbox",
    "WindowsSandboxSetupStart": "sandbox",

}

_CLOSED_SET: Final[frozenset[str]] = frozenset(CLIENT_REQUEST_ELEMENTS)


class ClientRequestMethod(StrEnum):
    """对照协议面 variant（逐字登记，真相源）。"""

    ACCOUNT_SESSIONS_LIST = "AccountSessionsList"
    ACCOUNT_SESSIONS_SWITCH = "AccountSessionsSwitch"
    APPS_INSTALLED = "AppsInstalled"
    APPS_LIST = "AppsList"
    APPS_READ = "AppsRead"
    BEDROCK_CHECK_GOV_CLOUD_REQUIREMENTS = "BedrockCheckGovCloudRequirements"
    BEDROCK_DISCOVER = "BedrockDiscover"
    BEDROCK_SETUP = "BedrockSetup"
    CANCEL_LOGIN_ACCOUNT = "CancelLoginAccount"
    COLLABORATION_MODE_LIST = "CollaborationModeList"
    COMMAND_EXEC_RESIZE = "CommandExecResize"
    COMMAND_EXEC_TERMINATE = "CommandExecTerminate"
    COMMAND_EXEC_WRITE = "CommandExecWrite"
    CONFIG_BATCH_WRITE = "ConfigBatchWrite"
    CONFIG_READ = "ConfigRead"
    CONFIG_REQUIREMENTS_READ = "ConfigRequirementsRead"
    CONFIG_VALUE_WRITE = "ConfigValueWrite"
    CONSUME_ACCOUNT_RATE_LIMIT_RESET_CREDIT = "ConsumeAccountRateLimitResetCredit"
    ENVIRONMENT_ADD = "EnvironmentAdd"
    ENVIRONMENT_INFO = "EnvironmentInfo"
    ENVIRONMENT_STATUS = "EnvironmentStatus"
    EXPERIMENTAL_FEATURE_ENABLEMENT_SET = "ExperimentalFeatureEnablementSet"
    EXPERIMENTAL_FEATURE_LIST = "ExperimentalFeatureList"
    EXTERNAL_AGENT_CONFIG_DETECT = "ExternalAgentConfigDetect"
    EXTERNAL_AGENT_CONFIG_IMPORT = "ExternalAgentConfigImport"
    EXTERNAL_AGENT_CONFIG_IMPORT_HISTORIES_READ = "ExternalAgentConfigImportHistoriesRead"
    EXTERNAL_AGENT_CONFIG_IMPORT_HISTORY_RECORD = "ExternalAgentConfigImportHistoryRecord"
    FEEDBACK_SAVE = "FeedbackSave"
    FEEDBACK_UPLOAD = "FeedbackUpload"
    FS_COPY = "FsCopy"
    FS_CREATE_DIRECTORY = "FsCreateDirectory"
    FS_GET_METADATA = "FsGetMetadata"
    FS_READ_DIRECTORY = "FsReadDirectory"
    FS_READ_FILE = "FsReadFile"
    FS_REMOVE = "FsRemove"
    FS_UNWATCH = "FsUnwatch"
    FS_WATCH = "FsWatch"
    FS_WRITE_FILE = "FsWriteFile"
    FUZZY_FILE_SEARCH = "FuzzyFileSearch"
    FUZZY_FILE_SEARCH_SESSION_START = "FuzzyFileSearchSessionStart"
    FUZZY_FILE_SEARCH_SESSION_STOP = "FuzzyFileSearchSessionStop"
    FUZZY_FILE_SEARCH_SESSION_UPDATE = "FuzzyFileSearchSessionUpdate"
    GATEWAY_O_AUTH_CANCEL = "GatewayOAuthCancel"
    GATEWAY_O_AUTH_LOGIN = "GatewayOAuthLogin"
    GATEWAY_O_AUTH_READ = "GatewayOAuthRead"
    GCP_SETUP = "GcpSetup"
    GET_ACCOUNT = "GetAccount"
    GET_ACCOUNT_RATE_LIMITS = "GetAccountRateLimits"
    GET_ACCOUNT_SECURITY_SETUP = "GetAccountSecuritySetup"
    GET_ACCOUNT_TOKEN_USAGE = "GetAccountTokenUsage"
    GET_AUTH_STATUS = "GetAuthStatus"
    GET_CONVERSATION_SUMMARY = "GetConversationSummary"
    GET_WORKSPACE_MESSAGES = "GetWorkspaceMessages"
    GIT_DIFF_TO_REMOTE = "GitDiffToRemote"
    HOOKS_LIST = "HooksList"
    INITIALIZE = "Initialize"
    LOGIN_ACCOUNT = "LoginAccount"
    LOGOUT_ACCOUNT = "LogoutAccount"
    MARKETPLACE_ADD = "MarketplaceAdd"
    MARKETPLACE_REMOVE = "MarketplaceRemove"
    MARKETPLACE_UPGRADE = "MarketplaceUpgrade"
    MCP_RESOURCE_READ = "McpResourceRead"
    MCP_SERVER_EVENT_STREAM_START = "McpServerEventStreamStart"
    MCP_SERVER_EVENT_STREAM_STOP = "McpServerEventStreamStop"
    MCP_SERVER_OAUTH_LOGIN = "McpServerOauthLogin"
    MCP_SERVER_REFRESH = "McpServerRefresh"
    MCP_SERVER_STATUS_LIST = "McpServerStatusList"
    MCP_SERVER_TOOL_CALL = "McpServerToolCall"
    MEMORY_RESET = "MemoryReset"
    MEMORY_STATUS = "MemoryStatus"
    MOCK_EXPERIMENTAL_METHOD = "MockExperimentalMethod"
    MODEL_LIST = "ModelList"
    MODEL_PROVIDER_CAPABILITIES_READ = "ModelProviderCapabilitiesRead"
    MODEL_PROVIDER_CONFIG_WRITE = "ModelProviderConfigWrite"
    MODEL_PROVIDER_LIST = "ModelProviderList"
    ONE_OFF_COMMAND_EXEC = "OneOffCommandExec"
    PERMISSION_PROFILE_LIST = "PermissionProfileList"
    PLUGIN_INSTALL = "PluginInstall"
    PLUGIN_INSTALLED = "PluginInstalled"
    PLUGIN_LIST = "PluginList"
    PLUGIN_READ = "PluginRead"
    PLUGIN_RECONCILE = "PluginReconcile"
    PLUGIN_SEARCH = "PluginSearch"
    PLUGIN_SHARE_CHECKOUT = "PluginShareCheckout"
    PLUGIN_SHARE_DELETE = "PluginShareDelete"
    PLUGIN_SHARE_LIST = "PluginShareList"
    PLUGIN_SHARE_SAVE = "PluginShareSave"
    PLUGIN_SHARE_UPDATE_TARGETS = "PluginShareUpdateTargets"
    PLUGIN_SKILL_READ = "PluginSkillRead"
    PLUGIN_UNINSTALL = "PluginUninstall"
    PROCESS_KILL = "ProcessKill"
    PROCESS_RESIZE_PTY = "ProcessResizePty"
    PROCESS_SPAWN = "ProcessSpawn"
    PROCESS_WRITE_STDIN = "ProcessWriteStdin"
    PROJECT_CREATE = "ProjectCreate"
    PROJECT_DELETE = "ProjectDelete"
    PROJECT_IMPORT = "ProjectImport"
    PROJECT_LIST = "ProjectList"
    PROJECT_MOVE = "ProjectMove"
    PROJECT_READ = "ProjectRead"
    PROJECT_UPDATE = "ProjectUpdate"
    REMOTE_CONTROL_CLIENTS_LIST = "RemoteControlClientsList"
    REMOTE_CONTROL_CLIENTS_REVOKE = "RemoteControlClientsRevoke"
    REMOTE_CONTROL_DISABLE = "RemoteControlDisable"
    REMOTE_CONTROL_ENABLE = "RemoteControlEnable"
    REMOTE_CONTROL_PAIRING_START = "RemoteControlPairingStart"
    REMOTE_CONTROL_PAIRING_STATUS = "RemoteControlPairingStatus"
    REMOTE_CONTROL_STATUS_READ = "RemoteControlStatusRead"
    REVIEW_START = "ReviewStart"
    ROLLOUT_COMPRESS = "RolloutCompress"
    SEND_ADD_CREDITS_NUDGE_EMAIL = "SendAddCreditsNudgeEmail"
    SERVER_DIAGNOSTICS = "ServerDiagnostics"
    SKILLS_CONFIG_WRITE = "SkillsConfigWrite"
    SKILLS_EXTRA_ROOTS_SET = "SkillsExtraRootsSet"
    SKILLS_LIST = "SkillsList"
    THREAD_APPROVE_GUARDIAN_DENIED_ACTION = "ThreadApproveGuardianDeniedAction"
    THREAD_ARCHIVE = "ThreadArchive"
    THREAD_ATTACHMENT_ADD = "ThreadAttachmentAdd"
    THREAD_ATTACHMENT_LIST = "ThreadAttachmentList"
    THREAD_ATTACHMENT_OWNER_LIST = "ThreadAttachmentOwnerList"
    THREAD_ATTACHMENT_REMOVE = "ThreadAttachmentRemove"
    THREAD_BACKGROUND_TERMINALS_CLEAN = "ThreadBackgroundTerminalsClean"
    THREAD_BACKGROUND_TERMINALS_LIST = "ThreadBackgroundTerminalsList"
    THREAD_BACKGROUND_TERMINALS_TERMINATE = "ThreadBackgroundTerminalsTerminate"
    THREAD_COMPACT_START = "ThreadCompactStart"
    THREAD_DECREMENT_ELICITATION = "ThreadDecrementElicitation"
    THREAD_DELETE = "ThreadDelete"
    THREAD_FORK = "ThreadFork"
    THREAD_GOAL_CLEAR = "ThreadGoalClear"
    THREAD_GOAL_GET = "ThreadGoalGet"
    THREAD_GOAL_SET = "ThreadGoalSet"
    THREAD_GUARDIAN_REVIEW = "ThreadGuardianReview"
    THREAD_INCREMENT_ELICITATION = "ThreadIncrementElicitation"
    THREAD_INJECT_ITEMS = "ThreadInjectItems"
    THREAD_ITEMS_LIST = "ThreadItemsList"
    THREAD_ITEMS_READ = "ThreadItemsRead"
    THREAD_LIST = "ThreadList"
    THREAD_LOADED_LIST = "ThreadLoadedList"
    THREAD_MEMORY_MODE_SET = "ThreadMemoryModeSet"
    THREAD_MEMORY_READ = "ThreadMemoryRead"
    THREAD_METADATA_UPDATE = "ThreadMetadataUpdate"
    THREAD_PREDICTION_REQUEST = "ThreadPredictionRequest"
    THREAD_PREPARE_APPROVED_PLAN = "ThreadPrepareApprovedPlan"
    THREAD_QUEUE_ADD = "ThreadQueueAdd"
    THREAD_QUEUE_DELETE = "ThreadQueueDelete"
    THREAD_QUEUE_LIST = "ThreadQueueList"
    THREAD_QUEUE_REORDER = "ThreadQueueReorder"
    THREAD_QUEUE_START = "ThreadQueueStart"
    THREAD_QUEUE_UPDATE = "ThreadQueueUpdate"
    THREAD_READ = "ThreadRead"
    THREAD_READ_STATE_UPDATE = "ThreadReadStateUpdate"
    THREAD_REALTIME_APPEND_AUDIO = "ThreadRealtimeAppendAudio"
    THREAD_REALTIME_APPEND_SPEECH = "ThreadRealtimeAppendSpeech"
    THREAD_REALTIME_APPEND_TEXT = "ThreadRealtimeAppendText"
    THREAD_REALTIME_LIST_VOICES = "ThreadRealtimeListVoices"
    THREAD_REALTIME_START = "ThreadRealtimeStart"
    THREAD_REALTIME_STOP = "ThreadRealtimeStop"
    THREAD_RESUME = "ThreadResume"
    THREAD_REVERT = "ThreadRevert"
    THREAD_SAMPLE = "ThreadSample"
    THREAD_SAMPLE_CANCEL = "ThreadSampleCancel"
    THREAD_SEARCH = "ThreadSearch"
    THREAD_SEARCH_OCCURRENCES = "ThreadSearchOccurrences"
    THREAD_SECTION_CREATE = "ThreadSectionCreate"
    THREAD_SECTION_DELETE = "ThreadSectionDelete"
    THREAD_SECTION_LIST = "ThreadSectionList"
    THREAD_SECTION_MOVE = "ThreadSectionMove"
    THREAD_SECTION_UPDATE = "ThreadSectionUpdate"
    THREAD_SET_NAME = "ThreadSetName"
    THREAD_SETTINGS_UPDATE = "ThreadSettingsUpdate"
    THREAD_SHELL_COMMAND = "ThreadShellCommand"
    THREAD_START = "ThreadStart"
    THREAD_TIMELINE_LIST = "ThreadTimelineList"
    THREAD_TURNS_LIST = "ThreadTurnsList"
    THREAD_UNARCHIVE = "ThreadUnarchive"
    THREAD_UNSUBSCRIBE = "ThreadUnsubscribe"
    TURN_INTERRUPT = "TurnInterrupt"
    TURN_SETTINGS_UPDATE = "TurnSettingsUpdate"
    TURN_START = "TurnStart"
    TURN_STEER = "TurnSteer"
    USER_VERIFICATION_CANCEL = "UserVerificationCancel"
    USER_VERIFICATION_DELETE = "UserVerificationDelete"
    USER_VERIFICATION_ENROLL = "UserVerificationEnroll"
    USER_VERIFICATION_STATUS = "UserVerificationStatus"
    USER_VERIFICATION_VERIFY = "UserVerificationVerify"
    WINDOWS_SANDBOX_READINESS = "WindowsSandboxReadiness"
    WINDOWS_SANDBOX_SETUP_START = "WindowsSandboxSetupStart"



class ClientRequestMethodError(ValueError):
    """未登记的协议面 variant（封闭集/元素数/归类判据点名）。"""


def client_request_names() -> list[str]:
    """返回逐字 variant 名列表副本（顺序稳定，调用方改不动真相源）。"""
    return list(CLIENT_REQUEST_ELEMENTS)


def expected_element_count(name: str) -> int:
    """该 variant 的逐字元素数（未登记抛错）。"""
    if not isinstance(name, str) or name not in _CLOSED_SET:
        raise ClientRequestMethodError(
            f"未登记的协议面 variant: {name!r} —— 先在 app/core/client_request_method.py 的 CLIENT_REQUEST_ELEMENTS 登记"
        )
    return CLIENT_REQUEST_ELEMENTS[name]


def ensure_client_request_method(value: str) -> str:
    """值域闭合：登记过原样放行，未登记抛 :class:`ClientRequestMethodError`。"""
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise ClientRequestMethodError(
            f"未登记的协议面 variant: {value!r} —— 先在 app/core/client_request_method.py 的 ClientRequestMethod 登记后再产出"
        )
    return value


def client_request_domain(value: str) -> str:
    """归类到协议面域（登记外抛错）。"""
    ensure_client_request_method(value)
    return CLIENT_REQUEST_DOMAIN[value]


def client_request_domain_members(domain: str) -> tuple[str, ...]:
    """反查某域下的全部逐字 variant 名（元组副本，调用方改不动真相源）。"""
    if domain not in set(CLIENT_REQUEST_DOMAIN.values()):
        raise ClientRequestMethodError(
            f"未登记的协议面域: {domain!r} —— 合法域: {sorted(set(CLIENT_REQUEST_DOMAIN.values()))!r}"
        )
    return tuple(nm for nm, dom in CLIENT_REQUEST_DOMAIN.items() if dom == domain)


def is_client_request(value: str) -> bool:
    """封闭集成员判定（不改值、不抛错）。"""
    return isinstance(value, str) and value in _CLOSED_SET

# 首 token → 方法族（本仓语义归类，与 CLIENT_REQUEST_DOMAIN 同一规则的第二处实现）。
_TOKEN_DOMAIN: Final[dict[str, str]] = {
    "Account": "account",
    "Apps": "app",
    "Bedrock": "cloud_setup",
    "Cancel": "auth",
    "Collaboration": "collaboration",
    "Command": "process",
    "Config": "config",
    "Consume": "account",
    "Environment": "environment",
    "Experimental": "experimental",
    "External": "external_agent",
    "Feedback": "feedback",
    "Fs": "filesystem",
    "Fuzzy": "fuzzy_search",
    "Gateway": "oauth",
    "Gcp": "cloud_setup",
    "Get": "query",
    "Git": "git",
    "Hooks": "hooks",
    "Initialize": "lifecycle",
    "Login": "auth",
    "Logout": "auth",
    "Marketplace": "marketplace",
    "Mcp": "mcp",
    "Memory": "memory",
    "Mock": "experimental",
    "Model": "model",
    "One": "process",
    "Permission": "permission",
    "Plugin": "plugin",
    "Process": "process",
    "Project": "project",
    "Remote": "remote_control",
    "Review": "review",
    "Rollout": "rollout",
    "Send": "account",
    "Server": "diagnostics",
    "Skills": "skills",
    "Thread": "thread",
    "Turn": "turn",
    "User": "user_verification",
    "Windows": "sandbox",
}

def client_request_prefix(name: str) -> str:
    """取 PascalCase 方法名的首 token（未登记抛错）。"""
    ensure_client_request_method(name)
    m = re.match(r"[A-Z][a-z]+|[A-Z]+(?=[A-Z]|$)", name)
    if not m:
        raise ClientRequestMethodError(f"无法解析方法名首 token: {name!r}")
    return m.group()


def classify_client_request_by_prefix(name: str) -> str:
    """前缀归类（与 client_request_domain 两路实现同一规则，交叉校验防漂移）。"""
    tok = client_request_prefix(name)
    if tok not in _TOKEN_DOMAIN:
        raise ClientRequestMethodError(f"未登记的方法族 token: {tok!r}（来自 {name!r}）")
    return _TOKEN_DOMAIN[tok]


def validate_client_request(name: str, element_count: int) -> str:
    """一致性守门：variant 名与元素数须同时匹配逐字表，否则抛错点名。"""
    ensure_client_request_method(name)
    expected = expected_element_count(name)
    if element_count != expected:
        raise ClientRequestMethodError(
            f"{name!r} 的 struct 元素数应为 {expected}，实得 {element_count!r}"
        )
    return name
