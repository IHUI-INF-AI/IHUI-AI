# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R59 pytest: client_request_method protocol-surface closed set.

Covers: verbatim element-count table, semantic domain classification, executable
reverse lookup, consistency gate, plus reverse-mutation guards. Watermark by build.py.
"""

from __future__ import annotations

import pytest

from app.core.client_request_method import (
    _TOKEN_DOMAIN,
    CLIENT_REQUEST_DOMAIN,
    CLIENT_REQUEST_ELEMENTS,
    ClientRequestMethod,
    ClientRequestMethodError,
    classify_client_request_by_prefix,
    client_request_domain,
    client_request_domain_members,
    client_request_names,
    client_request_prefix,
    ensure_client_request_method,
    expected_element_count,
    is_client_request,
    validate_client_request,
)


class TestVerbatimTable:
    def test_table_exact(self) -> None:
        assert CLIENT_REQUEST_ELEMENTS == {"AccountSessionsList": 2, "AccountSessionsSwitch": 2, "AppsInstalled": 2, "AppsList": 2, "AppsRead": 2, "BedrockCheckGovCloudRequirements": 2, "BedrockDiscover": 2, "BedrockSetup": 2, "CancelLoginAccount": 2, "CollaborationModeList": 2, "CommandExecResize": 2, "CommandExecTerminate": 2, "CommandExecWrite": 2, "ConfigBatchWrite": 2, "ConfigRead": 2, "ConfigRequirementsRead": 2, "ConfigValueWrite": 2, "ConsumeAccountRateLimitResetCredit": 2, "EnvironmentAdd": 2, "EnvironmentInfo": 2, "EnvironmentStatus": 2, "ExperimentalFeatureEnablementSet": 2, "ExperimentalFeatureList": 2, "ExternalAgentConfigDetect": 2, "ExternalAgentConfigImport": 2, "ExternalAgentConfigImportHistoriesRead": 2, "ExternalAgentConfigImportHistoryRecord": 2, "FeedbackSave": 2, "FeedbackUpload": 2, "FsCopy": 2, "FsCreateDirectory": 2, "FsGetMetadata": 2, "FsReadDirectory": 2, "FsReadFile": 2, "FsRemove": 2, "FsUnwatch": 2, "FsWatch": 2, "FsWriteFile": 2, "FuzzyFileSearch": 2, "FuzzyFileSearchSessionStart": 2, "FuzzyFileSearchSessionStop": 2, "FuzzyFileSearchSessionUpdate": 2, "GatewayOAuthCancel": 2, "GatewayOAuthLogin": 2, "GatewayOAuthRead": 2, "GcpSetup": 2, "GetAccount": 2, "GetAccountRateLimits": 2, "GetAccountSecuritySetup": 2, "GetAccountTokenUsage": 2, "GetAuthStatus": 2, "GetConversationSummary": 2, "GetWorkspaceMessages": 2, "GitDiffToRemote": 2, "HooksList": 2, "Initialize": 2, "LoginAccount": 2, "LogoutAccount": 2, "MarketplaceAdd": 2, "MarketplaceRemove": 2, "MarketplaceUpgrade": 2, "McpResourceRead": 2, "McpServerEventStreamStart": 2, "McpServerEventStreamStop": 2, "McpServerOauthLogin": 2, "McpServerRefresh": 2, "McpServerStatusList": 2, "McpServerToolCall": 2, "MemoryReset": 2, "MemoryStatus": 2, "MockExperimentalMethod": 2, "ModelList": 2, "ModelProviderCapabilitiesRead": 2, "ModelProviderConfigWrite": 2, "ModelProviderList": 2, "OneOffCommandExec": 2, "PermissionProfileList": 2, "PluginInstall": 2, "PluginInstalled": 2, "PluginList": 2, "PluginRead": 2, "PluginReconcile": 2, "PluginSearch": 2, "PluginShareCheckout": 2, "PluginShareDelete": 2, "PluginShareList": 2, "PluginShareSave": 2, "PluginShareUpdateTargets": 2, "PluginSkillRead": 2, "PluginUninstall": 2, "ProcessKill": 2, "ProcessResizePty": 2, "ProcessSpawn": 2, "ProcessWriteStdin": 2, "ProjectCreate": 2, "ProjectDelete": 2, "ProjectImport": 2, "ProjectList": 2, "ProjectMove": 2, "ProjectRead": 2, "ProjectUpdate": 2, "RemoteControlClientsList": 2, "RemoteControlClientsRevoke": 2, "RemoteControlDisable": 2, "RemoteControlEnable": 2, "RemoteControlPairingStart": 2, "RemoteControlPairingStatus": 2, "RemoteControlStatusRead": 2, "ReviewStart": 2, "RolloutCompress": 2, "SendAddCreditsNudgeEmail": 2, "ServerDiagnostics": 2, "SkillsConfigWrite": 2, "SkillsExtraRootsSet": 2, "SkillsList": 2, "ThreadApproveGuardianDeniedAction": 2, "ThreadArchive": 2, "ThreadAttachmentAdd": 2, "ThreadAttachmentList": 2, "ThreadAttachmentOwnerList": 2, "ThreadAttachmentRemove": 2, "ThreadBackgroundTerminalsClean": 2, "ThreadBackgroundTerminalsList": 2, "ThreadBackgroundTerminalsTerminate": 2, "ThreadCompactStart": 2, "ThreadDecrementElicitation": 2, "ThreadDelete": 2, "ThreadFork": 2, "ThreadGoalClear": 2, "ThreadGoalGet": 2, "ThreadGoalSet": 2, "ThreadGuardianReview": 2, "ThreadIncrementElicitation": 2, "ThreadInjectItems": 2, "ThreadItemsList": 2, "ThreadItemsRead": 2, "ThreadList": 2, "ThreadLoadedList": 2, "ThreadMemoryModeSet": 2, "ThreadMemoryRead": 2, "ThreadMetadataUpdate": 2, "ThreadPredictionRequest": 2, "ThreadPrepareApprovedPlan": 2, "ThreadQueueAdd": 2, "ThreadQueueDelete": 2, "ThreadQueueList": 2, "ThreadQueueReorder": 2, "ThreadQueueStart": 2, "ThreadQueueUpdate": 2, "ThreadRead": 2, "ThreadReadStateUpdate": 2, "ThreadRealtimeAppendAudio": 2, "ThreadRealtimeAppendSpeech": 2, "ThreadRealtimeAppendText": 2, "ThreadRealtimeListVoices": 2, "ThreadRealtimeStart": 2, "ThreadRealtimeStop": 2, "ThreadResume": 2, "ThreadRevert": 2, "ThreadSample": 2, "ThreadSampleCancel": 2, "ThreadSearch": 2, "ThreadSearchOccurrences": 2, "ThreadSectionCreate": 2, "ThreadSectionDelete": 2, "ThreadSectionList": 2, "ThreadSectionMove": 2, "ThreadSectionUpdate": 2, "ThreadSetName": 2, "ThreadSettingsUpdate": 2, "ThreadShellCommand": 2, "ThreadStart": 2, "ThreadTimelineList": 2, "ThreadTurnsList": 2, "ThreadUnarchive": 2, "ThreadUnsubscribe": 2, "TurnInterrupt": 2, "TurnSettingsUpdate": 2, "TurnStart": 2, "TurnSteer": 2, "UserVerificationCancel": 2, "UserVerificationDelete": 2, "UserVerificationEnroll": 2, "UserVerificationStatus": 2, "UserVerificationVerify": 2, "WindowsSandboxReadiness": 2, "WindowsSandboxSetupStart": 2}

    def test_closed_set_cardinality(self) -> None:
        assert len(ClientRequestMethod) == len(CLIENT_REQUEST_ELEMENTS) == 187

    def test_enum_values_match_table(self) -> None:
        assert {m.value for m in ClientRequestMethod} == set(CLIENT_REQUEST_ELEMENTS)

    def test_all_counts_positive_int(self) -> None:
        assert all(isinstance(c, int) and c >= 1 for c in CLIENT_REQUEST_ELEMENTS.values())


class TestDomainClassification:
    def test_domain_covers_all(self) -> None:
        assert set(CLIENT_REQUEST_DOMAIN) == set(CLIENT_REQUEST_ELEMENTS)

    @pytest.mark.parametrize("name,expected", [('AccountSessionsList', 'account'), ('AppsInstalled', 'app'), ('CancelLoginAccount', 'auth'), ('BedrockCheckGovCloudRequirements', 'cloud_setup'), ('CollaborationModeList', 'collaboration'), ('ConfigBatchWrite', 'config'), ('ServerDiagnostics', 'diagnostics'), ('EnvironmentAdd', 'environment'), ('ExperimentalFeatureEnablementSet', 'experimental'), ('ExternalAgentConfigDetect', 'external_agent'), ('FeedbackSave', 'feedback'), ('FsCopy', 'filesystem'), ('FuzzyFileSearch', 'fuzzy_search'), ('GitDiffToRemote', 'git'), ('HooksList', 'hooks'), ('Initialize', 'lifecycle'), ('MarketplaceAdd', 'marketplace'), ('McpResourceRead', 'mcp'), ('MemoryReset', 'memory'), ('ModelList', 'model'), ('GatewayOAuthCancel', 'oauth'), ('PermissionProfileList', 'permission'), ('PluginInstall', 'plugin'), ('CommandExecResize', 'process'), ('ProjectCreate', 'project'), ('GetAccount', 'query'), ('RemoteControlClientsList', 'remote_control'), ('ReviewStart', 'review'), ('RolloutCompress', 'rollout'), ('WindowsSandboxReadiness', 'sandbox'), ('SkillsConfigWrite', 'skills'), ('ThreadApproveGuardianDeniedAction', 'thread'), ('TurnInterrupt', 'turn'), ('UserVerificationCancel', 'user_verification')])
    def test_domain(self, name, expected) -> None:
        assert client_request_domain(name) == expected

    def test_domain_rejects_unregistered(self) -> None:
        with pytest.raises(ClientRequestMethodError):
            client_request_domain("bogus")

    def test_domain_members_partition(self) -> None:
        seen = []
        for domain in set(CLIENT_REQUEST_DOMAIN.values()):
            seen.extend(client_request_domain_members(domain))
        assert sorted(seen) == sorted(CLIENT_REQUEST_ELEMENTS)
        assert len(seen) == len(set(seen))

    def test_domain_members_rejects_unknown_domain(self) -> None:
        with pytest.raises(ClientRequestMethodError):
            client_request_domain_members("bogus_domain")


class TestMembershipAndCopy:
    def test_is_fn_true_for_all(self) -> None:
        assert all(is_client_request(nm) for nm in CLIENT_REQUEST_ELEMENTS)

    def test_is_fn_false_case_sensitive(self) -> None:
        first = "AccountSessionsList"
        assert first in CLIENT_REQUEST_ELEMENTS
        assert not is_client_request(first.lower())
        assert not is_client_request("bogus")

    def test_names_returns_copy(self) -> None:
        a = client_request_names()
        a.append("bogus")
        assert "bogus" not in CLIENT_REQUEST_ELEMENTS
        assert set(client_request_names()) == set(CLIENT_REQUEST_ELEMENTS)

    def test_members_returns_immutable(self) -> None:
        domain = next(iter(set(CLIENT_REQUEST_DOMAIN.values())))
        a = client_request_domain_members(domain)
        assert isinstance(a, tuple)


class TestConsistencyGate:
    @pytest.mark.parametrize("name,count", CLIENT_REQUEST_ELEMENTS.items())
    def test_validate_ok(self, name, count) -> None:
        assert validate_client_request(name, count) == name

    @pytest.mark.parametrize("name,count", CLIENT_REQUEST_ELEMENTS.items())
    def test_validate_rejects_wrong_count(self, name, count) -> None:
        with pytest.raises(ClientRequestMethodError, match="元素数应为"):
            validate_client_request(name, count + 1)

    def test_ensure_rejects_unregistered(self) -> None:
        with pytest.raises(ClientRequestMethodError):
            ensure_client_request_method("bogus")

    def test_count_rejects_unregistered(self) -> None:
        with pytest.raises(ClientRequestMethodError):
            expected_element_count("bogus")


class TestPrefixCrossCheck:
    def test_token_domain_covers_all_tokens(self) -> None:
        tokens = {client_request_prefix(nm) for nm in CLIENT_REQUEST_ELEMENTS}
        assert tokens == set(_TOKEN_DOMAIN)

    @pytest.mark.parametrize("name", list(CLIENT_REQUEST_ELEMENTS))
    def test_prefix_classification_matches_domain(self, name) -> None:
        assert classify_client_request_by_prefix(name) == client_request_domain(name)

    def test_prefix_rejects_unregistered(self) -> None:
        with pytest.raises(ClientRequestMethodError):
            client_request_prefix("bogus")


class TestReverseMutation:
    def test_verbatim_wire_names_case_sensitive(self) -> None:
        for nm in ("AccountSessionsList", "AccountSessionsSwitch"):
            assert nm in CLIENT_REQUEST_ELEMENTS
            assert nm.lower() not in CLIENT_REQUEST_ELEMENTS

    def test_element_counts_not_all_identical_sentinel(self) -> None:
        """差异化元素数族必须真的有 >1 种取值；恒 2 族由本断言钉住不能伪装差异化。"""
        counts = set(CLIENT_REQUEST_ELEMENTS.values())
        assert counts == {2}
