# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R62 pytest: wire_struct_contract struct arity contract.

Covers verbatim table, domain classification, reverse lookup, consistency gate,
reverse-mutation guards. Watermark by build.py.
"""

from __future__ import annotations

import pytest

from app.core.wire_struct_contract import (
    WIRE_STRUCT_CONTRACT_DOMAIN,
    WIRE_STRUCT_CONTRACT_ELEMENTS,
    WireStructContract,
    WireStructContractError,
    ensure_wire_struct_contract,
    expected_wire_struct_contract_element_count,
    is_wire_struct_contract,
    validate_wire_struct_contract,
    wire_struct_contract_domain,
    wire_struct_contract_domain_members,
    wire_struct_contract_names,
)


class TestVerbatimTable:
    def test_table_exact(self) -> None:
        assert WIRE_STRUCT_CONTRACT_ELEMENTS == {"AnimationSpec": 4, "AnnotatedResponseItem": 2, "ArgumentInfo": 2, "BarrierArgs": 3, "BedrockCheckGovCloudRequirementsResponse": 2, "BedrockDiscoverResponse": 2, "CapabilityRootDiscoverRequest": 3, "CheckoutInputs": 5, "ClientInfo": 3, "CompactedItemWire": 13, "CompleteResult": 3, "CompletionInfo": 3, "ConsentRecord": 8, "CreditStatusDetails": 5, "DirectRegistrationResponse": 4, "DiscoverResult": 7, "DiscoverV2CapabilitiesRequest": 2, "DiscoverV2CapabilitiesResponse": 3, "DownloadLinkResponse": 6, "ElicitResult": 3, "ElicitationSchemaWire": 6, "EmaResourceMetadata": 3, "EnrollRemoteServerResponse": 4, "EnvironmentAddParams": 6, "EnvironmentInfoResponse": 2, "EnvironmentRegistryConnectResponse": 6, "EnvironmentRegistryRegistrationResponse": 4, "Error": 6, "ErrorData": 3, "ErrorPayload": 3, "ExchangeResponse": 5, "ExitPayload": 2, "FeedbackSaveResponse": 3, "FeedbackUploadParams": 6, "FeedbackUploadResponse": 2, "FollowupTaskArgs": 2, "FrameSpec": 4, "FunctionCallOutputItem": 4, "GcpSetupParams": 3, "GetPromptResult": 4, "GhPullRequestApiItem": 3, "GhPullRequestView": 3, "GitInfo": 3, "GitPullRequest": 16, "HttpHeader": 3, "HttpRequestParams": 8, "HttpRequestResponse": 3, "IdJagResponse": 7, "ImageData": 2, "ImageGenerationInputImage": 2, "ImageResponse": 5, "ImagegenArgs": 5, "InitializeParams": 2, "InitializeResult": 5, "InstallationRecord": 5, "InstallationsArgs": 3, "InstalledMarketplaceMetadata": 5, "JSONRPCError": 2, "JSONRPCErrorError": 3, "JSONRPCRequest": 4, "JSONRPCResponse": 2, "LegacyOutput": 3, "ListPromptsResult": 6, "ListRemoteControlClientsResponse": 2, "ListResourceTemplatesResult": 6, "ListResourcesResult": 6, "ListRootsResult": 2, "MarketplaceAddParams": 3, "MarketplaceAddResponse": 3, "MarketplaceLoadErrorInfo": 2, "MarketplaceRemoveResponse": 2, "MarketplaceUpgradeErrorInfo": 2, "MarketplaceUpgradeResponse": 3, "MemoryCitationEntry": 4, "MisalignmentErrorDetails": 4, "ModelActivitySummary": 4, "ModelInfoUpgrade": 3, "ModelListParams": 4, "ModelListResponse": 2, "ModelProviderInfo": 24, "ModelProviderListResponse": 3, "ModelProviderSummary": 5, "ModelUpgradeInfo": 5, "ModelsCacheEntry": 5, "NetworkProxyAuditMetadata": 9, "NpmPackageInfo": 2, "OpenAiFormRequestParams": 3, "OutputEnvelope": 2, "OutputMeasurement": 3, "OutputPayload": 2, "OverriddenMetadata": 3, "OwnerRecord": 2, "PidRecord": 4, "PostMetadata": 5, "ProcessOutputChunk": 3, "ProcessResizePtyParams": 2, "ProjectCreateParams": 4, "ProjectImportParams": 5, "ProjectListParams": 4, "ProjectMoveParams": 2, "ProjectUpdateParams": 4, "RawPayloadRef": 3, "RealtimeHandoffRequested": 4, "RealtimeNoopRequested": 2, "RealtimeTranscriptEntry": 2, "RefreshResponse": 3, "RegistryError": 2, "RegistryErrorBody": 2, "RemoteControlClientResponse": 8, "RemoteControlClientsListParams": 4, "RemoteControlClientsRevokeParams": 2, "RemoteControlDisableResponse": 4, "RemoteControlEnableResponse": 4, "RemoteControlPairingStartResponse": 4, "RemoteControlPairingStatusParams": 2, "RequestHeader": 2, "RequestParams": 5, "RequiredInput": 2, "ResizePayload": 2, "ResourceServerMetadata": 4, "ResponseCompleted": 4, "ReviewStartParams": 3, "ReviewStartResponse": 2, "RuntimeRegistrationResponse": 3, "SandboxProvisioningRequest": 5, "ScheduledTaskSummary": 4, "SendInputArgs": 4, "SessionIndexEntry": 3, "SetupErrorReport": 2, "SignalParams": 2, "SpendControlStatusDetails": 2, "StandardErrorResponse": 3, "StartRemoteControlPairingResponse": 5, "SubscriptionsListenResult": 2, "SummaryOutput": 2, "TraceBundleManifest": 7, "UpdateOutput": 5, "UpdatePlanArgs": 2, "VersionInfo": 3, "ViewImageArgs": 2, "WalkEntry": 2, "WalkError": 2, "WindowsSandboxSetupStartParams": 2, "WireCapabilityRootDiscoverRequest": 3, "WrappedWebsocketError": 3}

    def test_closed_set_cardinality(self) -> None:
        assert len(WireStructContract) == len(WIRE_STRUCT_CONTRACT_ELEMENTS) == 145

    def test_enum_values_match_table(self) -> None:
        assert {m.value for m in WireStructContract} == set(WIRE_STRUCT_CONTRACT_ELEMENTS)

    def test_all_counts_positive_int(self) -> None:
        assert all(isinstance(c, int) and c >= 1 for c in WIRE_STRUCT_CONTRACT_ELEMENTS.values())


class TestDomainClassification:
    def test_domain_covers_all(self) -> None:
        assert set(WIRE_STRUCT_CONTRACT_DOMAIN) == set(WIRE_STRUCT_CONTRACT_ELEMENTS)

    @pytest.mark.parametrize("name,expected", [('AnnotatedResponseItem', 'content'), ('ArgumentInfo', 'descriptor'), ('CheckoutInputs', 'domain_object'), ('Error', 'error'), ('CapabilityRootDiscoverRequest', 'request'), ('BarrierArgs', 'request_params'), ('BedrockCheckGovCloudRequirementsResponse', 'response'), ('AnimationSpec', 'schema_config')])
    def test_domain(self, name, expected) -> None:
        assert wire_struct_contract_domain(name) == expected

    def test_domain_rejects_unregistered(self) -> None:
        with pytest.raises(WireStructContractError):
            wire_struct_contract_domain("bogus")

    def test_domain_members_partition(self) -> None:
        seen = []
        for domain in set(WIRE_STRUCT_CONTRACT_DOMAIN.values()):
            seen.extend(wire_struct_contract_domain_members(domain))
        assert sorted(seen) == sorted(WIRE_STRUCT_CONTRACT_ELEMENTS)
        assert len(seen) == len(set(seen))

    def test_domain_members_rejects_unknown_domain(self) -> None:
        with pytest.raises(WireStructContractError):
            wire_struct_contract_domain_members("bogus_domain")


class TestMembershipAndCopy:
    def test_is_fn_true_for_all(self) -> None:
        assert all(is_wire_struct_contract(nm) for nm in WIRE_STRUCT_CONTRACT_ELEMENTS)

    def test_is_fn_false_case_sensitive(self) -> None:
        first = "AnimationSpec"
        assert first in WIRE_STRUCT_CONTRACT_ELEMENTS
        assert not is_wire_struct_contract(first.lower())
        assert not is_wire_struct_contract("bogus")

    def test_names_returns_copy(self) -> None:
        a = wire_struct_contract_names()
        a.append("bogus")
        assert "bogus" not in WIRE_STRUCT_CONTRACT_ELEMENTS
        assert set(wire_struct_contract_names()) == set(WIRE_STRUCT_CONTRACT_ELEMENTS)

    def test_members_returns_immutable(self) -> None:
        domain = next(iter(set(WIRE_STRUCT_CONTRACT_DOMAIN.values())))
        assert isinstance(wire_struct_contract_domain_members(domain), tuple)


class TestConsistencyGate:
    @pytest.mark.parametrize("name,count", WIRE_STRUCT_CONTRACT_ELEMENTS.items())
    def test_validate_ok(self, name, count) -> None:
        assert validate_wire_struct_contract(name, count) == name

    @pytest.mark.parametrize("name,count", WIRE_STRUCT_CONTRACT_ELEMENTS.items())
    def test_validate_rejects_wrong_count(self, name, count) -> None:
        with pytest.raises(WireStructContractError, match="元素数应为"):
            validate_wire_struct_contract(name, count + 1)

    def test_ensure_rejects_unregistered(self) -> None:
        with pytest.raises(WireStructContractError):
            ensure_wire_struct_contract("bogus")

    def test_count_rejects_unregistered(self) -> None:
        with pytest.raises(WireStructContractError):
            expected_wire_struct_contract_element_count("bogus")


class TestReverseMutation:
    def test_verbatim_wire_names_case_sensitive(self) -> None:
        for nm in ("AnimationSpec", "AnnotatedResponseItem"):
            assert nm in WIRE_STRUCT_CONTRACT_ELEMENTS
            assert nm.lower() not in WIRE_STRUCT_CONTRACT_ELEMENTS

    def test_element_counts_pinned(self) -> None:
        assert set(WIRE_STRUCT_CONTRACT_ELEMENTS.values()) == {2, 3, 4, 5, 6, 7, 8, 9, 13, 16, 24}
