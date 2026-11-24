# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R62 pytest: account_struct_contract struct arity contract.

Covers verbatim table, domain classification, reverse lookup, consistency gate,
reverse-mutation guards. Watermark by build.py.
"""

from __future__ import annotations

import pytest

from app.core.account_struct_contract import (
    ACCOUNT_STRUCT_CONTRACT_DOMAIN,
    ACCOUNT_STRUCT_CONTRACT_ELEMENTS,
    AccountStructContract,
    AccountStructContractError,
    account_struct_contract_domain,
    account_struct_contract_domain_members,
    account_struct_contract_names,
    ensure_account_struct_contract,
    expected_account_struct_contract_element_count,
    is_account_struct_contract,
    validate_account_struct_contract,
)


class TestVerbatimTable:
    def test_table_exact(self) -> None:
        assert ACCOUNT_STRUCT_CONTRACT_ELEMENTS == {"AccountEntry": 11, "AccountLoginCompletedNotification": 4, "AccountOAuthProvenance": 2, "AccountProfile": 3, "AccountSecuritySetupAction": 2, "AccountSecuritySetupNotice": 5, "AccountSessionsSwitchParams": 3, "AccountTokenUsageDailyBucket": 2, "AccountTokenUsageSummary": 5, "AccountUpdatedNotification": 2, "AccountUserAuthClaims": 2, "ActiveUsersSummary": 3, "AdditionalRateLimitDetails": 3, "AgentIdentityAuthRecord": 8, "AgentIdentityJwtClaims": 11, "ApiKeyResponseCost": 2, "ApiKeyTurnCost": 8, "ApiTokenMetadata": 3, "AsyncUserInputQuestion": 2, "AuthDotJson": 8, "AuthRecoveryEvent": 2, "AuthRecoveryNotification": 4, "AwsAuthRefreshConfig": 3, "BedrockAccessKeysAuth": 3, "BedrockApiKeyAuth": 2, "BedrockEnvironmentCredential": 2, "CatalogUsage": 2, "ChatGptAccountEntry": 3, "ChatGptAccountInfo": 7, "ChatgptAuthTokensRefreshParams": 2, "ChatgptAuthTokensRefreshResponse": 3, "ChatgptTokenMetadata": 5, "ClientActiveUsersCount": 2, "ClientWorkspaceUsageCount": 11, "ConsumeAccountRateLimitResetCreditParams": 2, "ConsumeRateLimitResetCreditResponse": 2, "ConsumptionUsageGroup": 9, "CredentialExportConfig": 3, "CredentialFrame": 4, "CreditUsageEventBySurface": 4, "CurrentUserCreditUsageDatum": 2, "CurrentUserCreditUsageResponse": 5, "CurrentUserCreditUsageSeries": 3, "DailyProductSurfaceUsage": 6, "DailyProductSurfaceUsageResponse": 5, "DailySkillUsageMetricsResponse": 3, "DailySkillUsageOverview": 2, "DailyWorkspaceUsageCount": 5, "DailyWorkspaceUsageCountResponse": 5, "ExchangedTokens": 3, "ExportedCredentials": 4, "FallbackTokenEntry": 9, "GatewayOAuthChangedNotification": 5, "GatewayOAuthLoginParams": 2, "GatewayOAuthPrompt": 3, "GatewayOAuthReadResponse": 6, "GatewayOAuthSettings": 9, "GetAccountRateLimitsResponse": 6, "GetAccountResponse": 4, "GetAccountTokenUsageResponse": 3, "GetAuthStatusParams": 2, "JwtClaims": 4, "McpServerIdpOAuthConfig": 4, "McpServerOauthLoginCompletedNotification": 5, "McpServerOauthLoginParams": 5, "McpServerOauthLoginResponse": 2, "ModelProviderAuthInfo": 5, "ModelProviderAwsAuthInfo": 4, "ModelTokenBudgetConfig": 7, "ModelUsage": 13, "OAuthIdentity": 14, "OAuthSessionConfig": 7, "OAuthSource": 6, "PersonalAccessTokenMetadata": 5, "PersonalUsageAttribution": 5, "PluginUsageBucket": 2, "PluginUsageMetricsResponse": 3, "PluginUsageOverview": 5, "ProductSurfacePremiumUsageValues": 7, "RateLimitEvent": 6, "RateLimitEventCredits": 3, "RateLimitEventDetails": 2, "RateLimitEventWindow": 3, "RateLimitResetCredit": 7, "RateLimitResetCreditDetails": 7, "RateLimitResetCreditsDetails": 2, "RateLimitSnapshot": 10, "RateLimitStatusDetails": 4, "RateLimitWindow": 3, "RateLimitWindowSnapshot": 4, "RequestUserInputQuestion": 6, "RequestUserInputQuestionOption": 2, "RequirementsExecPolicyPatternTokenToml": 2, "ResourceTokenResponse": 7, "ResponseCompletedInputTokensDetails": 2, "ResponseCompletedUsage": 6, "ResponseUsageMetadata": 2, "RuntimeAccountRegistration": 4, "SandboxUserRecord": 2, "SandboxUsersFile": 3, "SenderUserMessages": 3, "SkillUsageOverview": 4, "StoredOAuthTokens": 6, "StoredToken": 4, "TaskUsageResponse": 2, "ThreadTokenUsage": 3, "ThreadTokenUsageUpdatedNotification": 3, "ThreadUsage": 5, "ThreadUsageEstimate": 5, "TokenBudgetConfigToml": 7, "TokenCountEvent": 2, "TokenData": 6, "TokenResponse": 4, "TokenUsage": 7, "TokenUsageBreakdown": 6, "TokenUsageInfo": 4, "TokenUsageProfileDailyBucket": 2, "TokenUsageProfileStats": 6, "ToolRequestUserInputOption": 2, "ToolRequestUserInputQuestion": 6, "UsageErrorBody": 5, "UserCodeResp": 3, "UserMessageEvent": 14, "UserMessageItem": 3, "UserPromptSubmitHookSpecificOutputWire": 2, "UserVerificationProof": 2, "UserVerificationVerifyParams": 3, "WireRequestUserInputEvent": 5, "WireToolRequestUserInputParams": 6, "WorkspaceUsageCount": 10, "WorkspaceUsageGroup": 5}

    def test_closed_set_cardinality(self) -> None:
        assert len(AccountStructContract) == len(ACCOUNT_STRUCT_CONTRACT_ELEMENTS) == 131

    def test_enum_values_match_table(self) -> None:
        assert {m.value for m in AccountStructContract} == set(ACCOUNT_STRUCT_CONTRACT_ELEMENTS)

    def test_all_counts_positive_int(self) -> None:
        assert all(isinstance(c, int) and c >= 1 for c in ACCOUNT_STRUCT_CONTRACT_ELEMENTS.values())


class TestDomainClassification:
    def test_domain_covers_all(self) -> None:
        assert set(ACCOUNT_STRUCT_CONTRACT_DOMAIN) == set(ACCOUNT_STRUCT_CONTRACT_ELEMENTS)

    @pytest.mark.parametrize("name,expected", [('AccountSecuritySetupAction', 'action'), ('RequirementsExecPolicyPatternTokenToml', 'config_toml'), ('TokenData', 'content'), ('AccountEntry', 'descriptor'), ('AccountOAuthProvenance', 'domain_object'), ('AccountLoginCompletedNotification', 'notification'), ('AccountSessionsSwitchParams', 'request_params'), ('ChatgptAuthTokensRefreshResponse', 'response'), ('AwsAuthRefreshConfig', 'schema_config')])
    def test_domain(self, name, expected) -> None:
        assert account_struct_contract_domain(name) == expected

    def test_domain_rejects_unregistered(self) -> None:
        with pytest.raises(AccountStructContractError):
            account_struct_contract_domain("bogus")

    def test_domain_members_partition(self) -> None:
        seen = []
        for domain in set(ACCOUNT_STRUCT_CONTRACT_DOMAIN.values()):
            seen.extend(account_struct_contract_domain_members(domain))
        assert sorted(seen) == sorted(ACCOUNT_STRUCT_CONTRACT_ELEMENTS)
        assert len(seen) == len(set(seen))

    def test_domain_members_rejects_unknown_domain(self) -> None:
        with pytest.raises(AccountStructContractError):
            account_struct_contract_domain_members("bogus_domain")


class TestMembershipAndCopy:
    def test_is_fn_true_for_all(self) -> None:
        assert all(is_account_struct_contract(nm) for nm in ACCOUNT_STRUCT_CONTRACT_ELEMENTS)

    def test_is_fn_false_case_sensitive(self) -> None:
        first = "AccountEntry"
        assert first in ACCOUNT_STRUCT_CONTRACT_ELEMENTS
        assert not is_account_struct_contract(first.lower())
        assert not is_account_struct_contract("bogus")

    def test_names_returns_copy(self) -> None:
        a = account_struct_contract_names()
        a.append("bogus")
        assert "bogus" not in ACCOUNT_STRUCT_CONTRACT_ELEMENTS
        assert set(account_struct_contract_names()) == set(ACCOUNT_STRUCT_CONTRACT_ELEMENTS)

    def test_members_returns_immutable(self) -> None:
        domain = next(iter(set(ACCOUNT_STRUCT_CONTRACT_DOMAIN.values())))
        assert isinstance(account_struct_contract_domain_members(domain), tuple)


class TestConsistencyGate:
    @pytest.mark.parametrize("name,count", ACCOUNT_STRUCT_CONTRACT_ELEMENTS.items())
    def test_validate_ok(self, name, count) -> None:
        assert validate_account_struct_contract(name, count) == name

    @pytest.mark.parametrize("name,count", ACCOUNT_STRUCT_CONTRACT_ELEMENTS.items())
    def test_validate_rejects_wrong_count(self, name, count) -> None:
        with pytest.raises(AccountStructContractError, match="元素数应为"):
            validate_account_struct_contract(name, count + 1)

    def test_ensure_rejects_unregistered(self) -> None:
        with pytest.raises(AccountStructContractError):
            ensure_account_struct_contract("bogus")

    def test_count_rejects_unregistered(self) -> None:
        with pytest.raises(AccountStructContractError):
            expected_account_struct_contract_element_count("bogus")


class TestReverseMutation:
    def test_verbatim_wire_names_case_sensitive(self) -> None:
        for nm in ("AccountEntry", "AccountLoginCompletedNotification"):
            assert nm in ACCOUNT_STRUCT_CONTRACT_ELEMENTS
            assert nm.lower() not in ACCOUNT_STRUCT_CONTRACT_ELEMENTS

    def test_element_counts_pinned(self) -> None:
        assert set(ACCOUNT_STRUCT_CONTRACT_ELEMENTS.values()) == {2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14}
