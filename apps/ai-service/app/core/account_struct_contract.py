# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""结构元数契约（AccountStructContract，131 struct / 9 角色域） —— 统一工程规范 R62（结构元数契约·serde with-N-elements）。

取证（codex.exe 26.1111.2228.0，365MB Rust PE，strings 逐字 + ``struct variant X::Y with N element``
机器反推，见 R58 ``families.out`` / 本轮 ``docs/engineering/round11-reverse/R61-*.md``）：逐字 struct 名与
元素数表由机器从二进制抽取，模块内表与单测双重钉死。本仓归属过滤：该族在本仓 app/core 零命中或仅异层别名。

一轴超越：131 个 codex struct 的逐字元素数（serde `with N elements` 硬断言）+ 9 类结构角色域（Params/Response/Notification/Toml/…）+ 可执行反查。元素数取自身 serde 生成元信息，非人工推断；角色域由结构名后缀确定性归类，与元素数正交。本仓归属过滤：本域结构名在 app/core 零命中；22 个多元素数冲突结构已排除。

诚实边界：131 个 struct 名与元素数逐字确证（单值一致）；角色域分类是本仓后缀归类非对照原生判据；各 struct 的具体字段名因 camelCase 连体串不可可靠切分，已另立 disasm 开放轴。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "AccountStructContract", "AccountStructContractError", "ACCOUNT_STRUCT_CONTRACT_ELEMENTS", "ACCOUNT_STRUCT_CONTRACT_DOMAIN", "account_struct_contract_names", "expected_account_struct_contract_element_count",
    "ensure_account_struct_contract", "account_struct_contract_domain", "account_struct_contract_domain_members", "is_account_struct_contract", "validate_account_struct_contract",
]

# 逐字 struct 名 → 元素数（serde 硬断言）（来自 ``with N element`` 声明，漂移由 pytest 钉死）。
ACCOUNT_STRUCT_CONTRACT_ELEMENTS: Final[dict[str, int]] = {
    "AccountEntry": 11,
    "AccountLoginCompletedNotification": 4,
    "AccountOAuthProvenance": 2,
    "AccountProfile": 3,
    "AccountSecuritySetupAction": 2,
    "AccountSecuritySetupNotice": 5,
    "AccountSessionsSwitchParams": 3,
    "AccountTokenUsageDailyBucket": 2,
    "AccountTokenUsageSummary": 5,
    "AccountUpdatedNotification": 2,
    "AccountUserAuthClaims": 2,
    "ActiveUsersSummary": 3,
    "AdditionalRateLimitDetails": 3,
    "AgentIdentityAuthRecord": 8,
    "AgentIdentityJwtClaims": 11,
    "ApiKeyResponseCost": 2,
    "ApiKeyTurnCost": 8,
    "ApiTokenMetadata": 3,
    "AsyncUserInputQuestion": 2,
    "AuthDotJson": 8,
    "AuthRecoveryEvent": 2,
    "AuthRecoveryNotification": 4,
    "AwsAuthRefreshConfig": 3,
    "BedrockAccessKeysAuth": 3,
    "BedrockApiKeyAuth": 2,
    "BedrockEnvironmentCredential": 2,
    "CatalogUsage": 2,
    "ChatGptAccountEntry": 3,
    "ChatGptAccountInfo": 7,
    "ChatgptAuthTokensRefreshParams": 2,
    "ChatgptAuthTokensRefreshResponse": 3,
    "ChatgptTokenMetadata": 5,
    "ClientActiveUsersCount": 2,
    "ClientWorkspaceUsageCount": 11,
    "ConsumeAccountRateLimitResetCreditParams": 2,
    "ConsumeRateLimitResetCreditResponse": 2,
    "ConsumptionUsageGroup": 9,
    "CredentialExportConfig": 3,
    "CredentialFrame": 4,
    "CreditUsageEventBySurface": 4,
    "CurrentUserCreditUsageDatum": 2,
    "CurrentUserCreditUsageResponse": 5,
    "CurrentUserCreditUsageSeries": 3,
    "DailyProductSurfaceUsage": 6,
    "DailyProductSurfaceUsageResponse": 5,
    "DailySkillUsageMetricsResponse": 3,
    "DailySkillUsageOverview": 2,
    "DailyWorkspaceUsageCount": 5,
    "DailyWorkspaceUsageCountResponse": 5,
    "ExchangedTokens": 3,
    "ExportedCredentials": 4,
    "FallbackTokenEntry": 9,
    "GatewayOAuthChangedNotification": 5,
    "GatewayOAuthLoginParams": 2,
    "GatewayOAuthPrompt": 3,
    "GatewayOAuthReadResponse": 6,
    "GatewayOAuthSettings": 9,
    "GetAccountRateLimitsResponse": 6,
    "GetAccountResponse": 4,
    "GetAccountTokenUsageResponse": 3,
    "GetAuthStatusParams": 2,
    "JwtClaims": 4,
    "McpServerIdpOAuthConfig": 4,
    "McpServerOauthLoginCompletedNotification": 5,
    "McpServerOauthLoginParams": 5,
    "McpServerOauthLoginResponse": 2,
    "ModelProviderAuthInfo": 5,
    "ModelProviderAwsAuthInfo": 4,
    "ModelTokenBudgetConfig": 7,
    "ModelUsage": 13,
    "OAuthIdentity": 14,
    "OAuthSessionConfig": 7,
    "OAuthSource": 6,
    "PersonalAccessTokenMetadata": 5,
    "PersonalUsageAttribution": 5,
    "PluginUsageBucket": 2,
    "PluginUsageMetricsResponse": 3,
    "PluginUsageOverview": 5,
    "ProductSurfacePremiumUsageValues": 7,
    "RateLimitEvent": 6,
    "RateLimitEventCredits": 3,
    "RateLimitEventDetails": 2,
    "RateLimitEventWindow": 3,
    "RateLimitResetCredit": 7,
    "RateLimitResetCreditDetails": 7,
    "RateLimitResetCreditsDetails": 2,
    "RateLimitSnapshot": 10,
    "RateLimitStatusDetails": 4,
    "RateLimitWindow": 3,
    "RateLimitWindowSnapshot": 4,
    "RequestUserInputQuestion": 6,
    "RequestUserInputQuestionOption": 2,
    "RequirementsExecPolicyPatternTokenToml": 2,
    "ResourceTokenResponse": 7,
    "ResponseCompletedInputTokensDetails": 2,
    "ResponseCompletedUsage": 6,
    "ResponseUsageMetadata": 2,
    "RuntimeAccountRegistration": 4,
    "SandboxUserRecord": 2,
    "SandboxUsersFile": 3,
    "SenderUserMessages": 3,
    "SkillUsageOverview": 4,
    "StoredOAuthTokens": 6,
    "StoredToken": 4,
    "TaskUsageResponse": 2,
    "ThreadTokenUsage": 3,
    "ThreadTokenUsageUpdatedNotification": 3,
    "ThreadUsage": 5,
    "ThreadUsageEstimate": 5,
    "TokenBudgetConfigToml": 7,
    "TokenCountEvent": 2,
    "TokenData": 6,
    "TokenResponse": 4,
    "TokenUsage": 7,
    "TokenUsageBreakdown": 6,
    "TokenUsageInfo": 4,
    "TokenUsageProfileDailyBucket": 2,
    "TokenUsageProfileStats": 6,
    "ToolRequestUserInputOption": 2,
    "ToolRequestUserInputQuestion": 6,
    "UsageErrorBody": 5,
    "UserCodeResp": 3,
    "UserMessageEvent": 14,
    "UserMessageItem": 3,
    "UserPromptSubmitHookSpecificOutputWire": 2,
    "UserVerificationProof": 2,
    "UserVerificationVerifyParams": 3,
    "WireRequestUserInputEvent": 5,
    "WireToolRequestUserInputParams": 6,
    "WorkspaceUsageCount": 10,
    "WorkspaceUsageGroup": 5,

}

# 本仓语义归类（非对照原生判据）：每个 variant 归入一个协议面域。
ACCOUNT_STRUCT_CONTRACT_DOMAIN: Final[dict[str, str]] = {
    "AccountEntry": "descriptor",
    "AccountLoginCompletedNotification": "notification",
    "AccountOAuthProvenance": "domain_object",
    "AccountProfile": "descriptor",
    "AccountSecuritySetupAction": "action",
    "AccountSecuritySetupNotice": "notification",
    "AccountSessionsSwitchParams": "request_params",
    "AccountTokenUsageDailyBucket": "domain_object",
    "AccountTokenUsageSummary": "descriptor",
    "AccountUpdatedNotification": "notification",
    "AccountUserAuthClaims": "descriptor",
    "ActiveUsersSummary": "descriptor",
    "AdditionalRateLimitDetails": "domain_object",
    "AgentIdentityAuthRecord": "descriptor",
    "AgentIdentityJwtClaims": "descriptor",
    "ApiKeyResponseCost": "domain_object",
    "ApiKeyTurnCost": "domain_object",
    "ApiTokenMetadata": "descriptor",
    "AsyncUserInputQuestion": "domain_object",
    "AuthDotJson": "domain_object",
    "AuthRecoveryEvent": "notification",
    "AuthRecoveryNotification": "notification",
    "AwsAuthRefreshConfig": "schema_config",
    "BedrockAccessKeysAuth": "domain_object",
    "BedrockApiKeyAuth": "domain_object",
    "BedrockEnvironmentCredential": "domain_object",
    "CatalogUsage": "domain_object",
    "ChatGptAccountEntry": "descriptor",
    "ChatGptAccountInfo": "descriptor",
    "ChatgptAuthTokensRefreshParams": "request_params",
    "ChatgptAuthTokensRefreshResponse": "response",
    "ChatgptTokenMetadata": "descriptor",
    "ClientActiveUsersCount": "domain_object",
    "ClientWorkspaceUsageCount": "domain_object",
    "ConsumeAccountRateLimitResetCreditParams": "request_params",
    "ConsumeRateLimitResetCreditResponse": "response",
    "ConsumptionUsageGroup": "domain_object",
    "CredentialExportConfig": "schema_config",
    "CredentialFrame": "domain_object",
    "CreditUsageEventBySurface": "domain_object",
    "CurrentUserCreditUsageDatum": "domain_object",
    "CurrentUserCreditUsageResponse": "response",
    "CurrentUserCreditUsageSeries": "domain_object",
    "DailyProductSurfaceUsage": "domain_object",
    "DailyProductSurfaceUsageResponse": "response",
    "DailySkillUsageMetricsResponse": "response",
    "DailySkillUsageOverview": "domain_object",
    "DailyWorkspaceUsageCount": "domain_object",
    "DailyWorkspaceUsageCountResponse": "response",
    "ExchangedTokens": "domain_object",
    "ExportedCredentials": "domain_object",
    "FallbackTokenEntry": "descriptor",
    "GatewayOAuthChangedNotification": "notification",
    "GatewayOAuthLoginParams": "request_params",
    "GatewayOAuthPrompt": "domain_object",
    "GatewayOAuthReadResponse": "response",
    "GatewayOAuthSettings": "schema_config",
    "GetAccountRateLimitsResponse": "response",
    "GetAccountResponse": "response",
    "GetAccountTokenUsageResponse": "response",
    "GetAuthStatusParams": "request_params",
    "JwtClaims": "descriptor",
    "McpServerIdpOAuthConfig": "schema_config",
    "McpServerOauthLoginCompletedNotification": "notification",
    "McpServerOauthLoginParams": "request_params",
    "McpServerOauthLoginResponse": "response",
    "ModelProviderAuthInfo": "descriptor",
    "ModelProviderAwsAuthInfo": "descriptor",
    "ModelTokenBudgetConfig": "schema_config",
    "ModelUsage": "domain_object",
    "OAuthIdentity": "domain_object",
    "OAuthSessionConfig": "schema_config",
    "OAuthSource": "domain_object",
    "PersonalAccessTokenMetadata": "descriptor",
    "PersonalUsageAttribution": "domain_object",
    "PluginUsageBucket": "domain_object",
    "PluginUsageMetricsResponse": "response",
    "PluginUsageOverview": "domain_object",
    "ProductSurfacePremiumUsageValues": "domain_object",
    "RateLimitEvent": "notification",
    "RateLimitEventCredits": "domain_object",
    "RateLimitEventDetails": "domain_object",
    "RateLimitEventWindow": "domain_object",
    "RateLimitResetCredit": "domain_object",
    "RateLimitResetCreditDetails": "domain_object",
    "RateLimitResetCreditsDetails": "domain_object",
    "RateLimitSnapshot": "domain_object",
    "RateLimitStatusDetails": "domain_object",
    "RateLimitWindow": "domain_object",
    "RateLimitWindowSnapshot": "domain_object",
    "RequestUserInputQuestion": "domain_object",
    "RequestUserInputQuestionOption": "domain_object",
    "RequirementsExecPolicyPatternTokenToml": "config_toml",
    "ResourceTokenResponse": "response",
    "ResponseCompletedInputTokensDetails": "domain_object",
    "ResponseCompletedUsage": "domain_object",
    "ResponseUsageMetadata": "descriptor",
    "RuntimeAccountRegistration": "domain_object",
    "SandboxUserRecord": "descriptor",
    "SandboxUsersFile": "domain_object",
    "SenderUserMessages": "domain_object",
    "SkillUsageOverview": "domain_object",
    "StoredOAuthTokens": "domain_object",
    "StoredToken": "domain_object",
    "TaskUsageResponse": "response",
    "ThreadTokenUsage": "domain_object",
    "ThreadTokenUsageUpdatedNotification": "notification",
    "ThreadUsage": "domain_object",
    "ThreadUsageEstimate": "domain_object",
    "TokenBudgetConfigToml": "config_toml",
    "TokenCountEvent": "notification",
    "TokenData": "content",
    "TokenResponse": "response",
    "TokenUsage": "domain_object",
    "TokenUsageBreakdown": "domain_object",
    "TokenUsageInfo": "descriptor",
    "TokenUsageProfileDailyBucket": "domain_object",
    "TokenUsageProfileStats": "domain_object",
    "ToolRequestUserInputOption": "domain_object",
    "ToolRequestUserInputQuestion": "domain_object",
    "UsageErrorBody": "content",
    "UserCodeResp": "response",
    "UserMessageEvent": "notification",
    "UserMessageItem": "content",
    "UserPromptSubmitHookSpecificOutputWire": "domain_object",
    "UserVerificationProof": "domain_object",
    "UserVerificationVerifyParams": "request_params",
    "WireRequestUserInputEvent": "notification",
    "WireToolRequestUserInputParams": "request_params",
    "WorkspaceUsageCount": "domain_object",
    "WorkspaceUsageGroup": "domain_object",

}

_CLOSED_SET: Final[frozenset[str]] = frozenset(ACCOUNT_STRUCT_CONTRACT_ELEMENTS)


class AccountStructContract(StrEnum):
    """对照协议面 variant（逐字登记，真相源）。"""

    ACCOUNT_ENTRY = "AccountEntry"
    ACCOUNT_LOGIN_COMPLETED_NOTIFICATION = "AccountLoginCompletedNotification"
    ACCOUNT_O_AUTH_PROVENANCE = "AccountOAuthProvenance"
    ACCOUNT_PROFILE = "AccountProfile"
    ACCOUNT_SECURITY_SETUP_ACTION = "AccountSecuritySetupAction"
    ACCOUNT_SECURITY_SETUP_NOTICE = "AccountSecuritySetupNotice"
    ACCOUNT_SESSIONS_SWITCH_PARAMS = "AccountSessionsSwitchParams"
    ACCOUNT_TOKEN_USAGE_DAILY_BUCKET = "AccountTokenUsageDailyBucket"
    ACCOUNT_TOKEN_USAGE_SUMMARY = "AccountTokenUsageSummary"
    ACCOUNT_UPDATED_NOTIFICATION = "AccountUpdatedNotification"
    ACCOUNT_USER_AUTH_CLAIMS = "AccountUserAuthClaims"
    ACTIVE_USERS_SUMMARY = "ActiveUsersSummary"
    ADDITIONAL_RATE_LIMIT_DETAILS = "AdditionalRateLimitDetails"
    AGENT_IDENTITY_AUTH_RECORD = "AgentIdentityAuthRecord"
    AGENT_IDENTITY_JWT_CLAIMS = "AgentIdentityJwtClaims"
    API_KEY_RESPONSE_COST = "ApiKeyResponseCost"
    API_KEY_TURN_COST = "ApiKeyTurnCost"
    API_TOKEN_METADATA = "ApiTokenMetadata"
    ASYNC_USER_INPUT_QUESTION = "AsyncUserInputQuestion"
    AUTH_DOT_JSON = "AuthDotJson"
    AUTH_RECOVERY_EVENT = "AuthRecoveryEvent"
    AUTH_RECOVERY_NOTIFICATION = "AuthRecoveryNotification"
    AWS_AUTH_REFRESH_CONFIG = "AwsAuthRefreshConfig"
    BEDROCK_ACCESS_KEYS_AUTH = "BedrockAccessKeysAuth"
    BEDROCK_API_KEY_AUTH = "BedrockApiKeyAuth"
    BEDROCK_ENVIRONMENT_CREDENTIAL = "BedrockEnvironmentCredential"
    CATALOG_USAGE = "CatalogUsage"
    CHAT_GPT_ACCOUNT_ENTRY = "ChatGptAccountEntry"
    CHAT_GPT_ACCOUNT_INFO = "ChatGptAccountInfo"
    CHATGPT_AUTH_TOKENS_REFRESH_PARAMS = "ChatgptAuthTokensRefreshParams"
    CHATGPT_AUTH_TOKENS_REFRESH_RESPONSE = "ChatgptAuthTokensRefreshResponse"
    CHATGPT_TOKEN_METADATA = "ChatgptTokenMetadata"
    CLIENT_ACTIVE_USERS_COUNT = "ClientActiveUsersCount"
    CLIENT_WORKSPACE_USAGE_COUNT = "ClientWorkspaceUsageCount"
    CONSUME_ACCOUNT_RATE_LIMIT_RESET_CREDIT_PARAMS = "ConsumeAccountRateLimitResetCreditParams"
    CONSUME_RATE_LIMIT_RESET_CREDIT_RESPONSE = "ConsumeRateLimitResetCreditResponse"
    CONSUMPTION_USAGE_GROUP = "ConsumptionUsageGroup"
    CREDENTIAL_EXPORT_CONFIG = "CredentialExportConfig"
    CREDENTIAL_FRAME = "CredentialFrame"
    CREDIT_USAGE_EVENT_BY_SURFACE = "CreditUsageEventBySurface"
    CURRENT_USER_CREDIT_USAGE_DATUM = "CurrentUserCreditUsageDatum"
    CURRENT_USER_CREDIT_USAGE_RESPONSE = "CurrentUserCreditUsageResponse"
    CURRENT_USER_CREDIT_USAGE_SERIES = "CurrentUserCreditUsageSeries"
    DAILY_PRODUCT_SURFACE_USAGE = "DailyProductSurfaceUsage"
    DAILY_PRODUCT_SURFACE_USAGE_RESPONSE = "DailyProductSurfaceUsageResponse"
    DAILY_SKILL_USAGE_METRICS_RESPONSE = "DailySkillUsageMetricsResponse"
    DAILY_SKILL_USAGE_OVERVIEW = "DailySkillUsageOverview"
    DAILY_WORKSPACE_USAGE_COUNT = "DailyWorkspaceUsageCount"
    DAILY_WORKSPACE_USAGE_COUNT_RESPONSE = "DailyWorkspaceUsageCountResponse"
    EXCHANGED_TOKENS = "ExchangedTokens"
    EXPORTED_CREDENTIALS = "ExportedCredentials"
    FALLBACK_TOKEN_ENTRY = "FallbackTokenEntry"
    GATEWAY_O_AUTH_CHANGED_NOTIFICATION = "GatewayOAuthChangedNotification"
    GATEWAY_O_AUTH_LOGIN_PARAMS = "GatewayOAuthLoginParams"
    GATEWAY_O_AUTH_PROMPT = "GatewayOAuthPrompt"
    GATEWAY_O_AUTH_READ_RESPONSE = "GatewayOAuthReadResponse"
    GATEWAY_O_AUTH_SETTINGS = "GatewayOAuthSettings"
    GET_ACCOUNT_RATE_LIMITS_RESPONSE = "GetAccountRateLimitsResponse"
    GET_ACCOUNT_RESPONSE = "GetAccountResponse"
    GET_ACCOUNT_TOKEN_USAGE_RESPONSE = "GetAccountTokenUsageResponse"
    GET_AUTH_STATUS_PARAMS = "GetAuthStatusParams"
    JWT_CLAIMS = "JwtClaims"
    MCP_SERVER_IDP_O_AUTH_CONFIG = "McpServerIdpOAuthConfig"
    MCP_SERVER_OAUTH_LOGIN_COMPLETED_NOTIFICATION = "McpServerOauthLoginCompletedNotification"
    MCP_SERVER_OAUTH_LOGIN_PARAMS = "McpServerOauthLoginParams"
    MCP_SERVER_OAUTH_LOGIN_RESPONSE = "McpServerOauthLoginResponse"
    MODEL_PROVIDER_AUTH_INFO = "ModelProviderAuthInfo"
    MODEL_PROVIDER_AWS_AUTH_INFO = "ModelProviderAwsAuthInfo"
    MODEL_TOKEN_BUDGET_CONFIG = "ModelTokenBudgetConfig"
    MODEL_USAGE = "ModelUsage"
    O_AUTH_IDENTITY = "OAuthIdentity"
    O_AUTH_SESSION_CONFIG = "OAuthSessionConfig"
    O_AUTH_SOURCE = "OAuthSource"
    PERSONAL_ACCESS_TOKEN_METADATA = "PersonalAccessTokenMetadata"
    PERSONAL_USAGE_ATTRIBUTION = "PersonalUsageAttribution"
    PLUGIN_USAGE_BUCKET = "PluginUsageBucket"
    PLUGIN_USAGE_METRICS_RESPONSE = "PluginUsageMetricsResponse"
    PLUGIN_USAGE_OVERVIEW = "PluginUsageOverview"
    PRODUCT_SURFACE_PREMIUM_USAGE_VALUES = "ProductSurfacePremiumUsageValues"
    RATE_LIMIT_EVENT = "RateLimitEvent"
    RATE_LIMIT_EVENT_CREDITS = "RateLimitEventCredits"
    RATE_LIMIT_EVENT_DETAILS = "RateLimitEventDetails"
    RATE_LIMIT_EVENT_WINDOW = "RateLimitEventWindow"
    RATE_LIMIT_RESET_CREDIT = "RateLimitResetCredit"
    RATE_LIMIT_RESET_CREDIT_DETAILS = "RateLimitResetCreditDetails"
    RATE_LIMIT_RESET_CREDITS_DETAILS = "RateLimitResetCreditsDetails"
    RATE_LIMIT_SNAPSHOT = "RateLimitSnapshot"
    RATE_LIMIT_STATUS_DETAILS = "RateLimitStatusDetails"
    RATE_LIMIT_WINDOW = "RateLimitWindow"
    RATE_LIMIT_WINDOW_SNAPSHOT = "RateLimitWindowSnapshot"
    REQUEST_USER_INPUT_QUESTION = "RequestUserInputQuestion"
    REQUEST_USER_INPUT_QUESTION_OPTION = "RequestUserInputQuestionOption"
    REQUIREMENTS_EXEC_POLICY_PATTERN_TOKEN_TOML = "RequirementsExecPolicyPatternTokenToml"
    RESOURCE_TOKEN_RESPONSE = "ResourceTokenResponse"
    RESPONSE_COMPLETED_INPUT_TOKENS_DETAILS = "ResponseCompletedInputTokensDetails"
    RESPONSE_COMPLETED_USAGE = "ResponseCompletedUsage"
    RESPONSE_USAGE_METADATA = "ResponseUsageMetadata"
    RUNTIME_ACCOUNT_REGISTRATION = "RuntimeAccountRegistration"
    SANDBOX_USER_RECORD = "SandboxUserRecord"
    SANDBOX_USERS_FILE = "SandboxUsersFile"
    SENDER_USER_MESSAGES = "SenderUserMessages"
    SKILL_USAGE_OVERVIEW = "SkillUsageOverview"
    STORED_O_AUTH_TOKENS = "StoredOAuthTokens"
    STORED_TOKEN = "StoredToken"
    TASK_USAGE_RESPONSE = "TaskUsageResponse"
    THREAD_TOKEN_USAGE = "ThreadTokenUsage"
    THREAD_TOKEN_USAGE_UPDATED_NOTIFICATION = "ThreadTokenUsageUpdatedNotification"
    THREAD_USAGE = "ThreadUsage"
    THREAD_USAGE_ESTIMATE = "ThreadUsageEstimate"
    TOKEN_BUDGET_CONFIG_TOML = "TokenBudgetConfigToml"
    TOKEN_COUNT_EVENT = "TokenCountEvent"
    TOKEN_DATA = "TokenData"
    TOKEN_RESPONSE = "TokenResponse"
    TOKEN_USAGE = "TokenUsage"
    TOKEN_USAGE_BREAKDOWN = "TokenUsageBreakdown"
    TOKEN_USAGE_INFO = "TokenUsageInfo"
    TOKEN_USAGE_PROFILE_DAILY_BUCKET = "TokenUsageProfileDailyBucket"
    TOKEN_USAGE_PROFILE_STATS = "TokenUsageProfileStats"
    TOOL_REQUEST_USER_INPUT_OPTION = "ToolRequestUserInputOption"
    TOOL_REQUEST_USER_INPUT_QUESTION = "ToolRequestUserInputQuestion"
    USAGE_ERROR_BODY = "UsageErrorBody"
    USER_CODE_RESP = "UserCodeResp"
    USER_MESSAGE_EVENT = "UserMessageEvent"
    USER_MESSAGE_ITEM = "UserMessageItem"
    USER_PROMPT_SUBMIT_HOOK_SPECIFIC_OUTPUT_WIRE = "UserPromptSubmitHookSpecificOutputWire"
    USER_VERIFICATION_PROOF = "UserVerificationProof"
    USER_VERIFICATION_VERIFY_PARAMS = "UserVerificationVerifyParams"
    WIRE_REQUEST_USER_INPUT_EVENT = "WireRequestUserInputEvent"
    WIRE_TOOL_REQUEST_USER_INPUT_PARAMS = "WireToolRequestUserInputParams"
    WORKSPACE_USAGE_COUNT = "WorkspaceUsageCount"
    WORKSPACE_USAGE_GROUP = "WorkspaceUsageGroup"



class AccountStructContractError(ValueError):
    """未登记的协议面 variant（封闭集/元素数/归类判据点名）。"""


def account_struct_contract_names() -> list[str]:
    """返回逐字 variant 名列表副本（顺序稳定，调用方改不动真相源）。"""
    return list(ACCOUNT_STRUCT_CONTRACT_ELEMENTS)


def expected_account_struct_contract_element_count(name: str) -> int:
    """该 variant 的逐字元素数（未登记抛错）。"""
    if not isinstance(name, str) or name not in _CLOSED_SET:
        raise AccountStructContractError(f"未登记的 variant: {name!r} —— 先在 app/core/account_struct_contract.py 的 ACCOUNT_STRUCT_CONTRACT_ELEMENTS 登记")
    return ACCOUNT_STRUCT_CONTRACT_ELEMENTS[name]


def ensure_account_struct_contract(value: str) -> str:
    """值域闭合：登记过原样放行，未登记抛 :class:`AccountStructContractError`。"""
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise AccountStructContractError(f"未登记的 variant: {value!r} —— 先在 app/core/account_struct_contract.py 的 AccountStructContract 登记后再产出")
    return value


def account_struct_contract_domain(value: str) -> str:
    """归类到协议面域（登记外抛错）。"""
    ensure_account_struct_contract(value)
    return ACCOUNT_STRUCT_CONTRACT_DOMAIN[value]


def account_struct_contract_domain_members(domain: str) -> tuple[str, ...]:
    """反查某域下的全部逐字 variant 名（元组副本，调用方改不动真相源）。"""
    if domain not in set(ACCOUNT_STRUCT_CONTRACT_DOMAIN.values()):
        raise AccountStructContractError(f"未登记的域: {domain!r} —— 合法域: {sorted(set(ACCOUNT_STRUCT_CONTRACT_DOMAIN.values()))!r}")
    return tuple(nm for nm, dom in ACCOUNT_STRUCT_CONTRACT_DOMAIN.items() if dom == domain)


def is_account_struct_contract(value: str) -> bool:
    """封闭集成员判定（不改值、不抛错）。"""
    return isinstance(value, str) and value in _CLOSED_SET


def validate_account_struct_contract(name: str, element_count: int) -> str:
    """一致性守门：variant 名与元素数须同时匹配逐字表，否则抛错点名。"""
    ensure_account_struct_contract(name)
    expected = expected_account_struct_contract_element_count(name)
    if element_count != expected:
        raise AccountStructContractError(f"{name!r} 的 struct 元素数应为 {expected}，实得 {element_count!r}")
    return name
