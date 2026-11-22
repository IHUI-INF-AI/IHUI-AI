# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""结构元数契约（WireStructContract，145 struct / 8 角色域） —— 统一工程规范 R62（结构元数契约·serde with-N-elements）。

取证（codex.exe 26.1111.2228.0，365MB Rust PE，strings 逐字 + ``struct variant X::Y with N element``
机器反推，见 R58 ``families.out`` / 本轮 ``docs/engineering/round11-reverse/R61-*.md``）：逐字 struct 名与
元素数表由机器从二进制抽取，模块内表与单测双重钉死。本仓归属过滤：该族在本仓 app/core 零命中或仅异层别名。

一轴超越：145 个 codex struct 的逐字元素数（serde `with N elements` 硬断言）+ 8 类结构角色域（Params/Response/Notification/Toml/…）+ 可执行反查。元素数取自身 serde 生成元信息，非人工推断；角色域由结构名后缀确定性归类，与元素数正交。本仓归属过滤：本域结构名在 app/core 零命中；22 个多元素数冲突结构已排除。

诚实边界：145 个 struct 名与元素数逐字确证（单值一致）；角色域分类是本仓后缀归类非对照原生判据；各 struct 的具体字段名因 camelCase 连体串不可可靠切分，已另立 disasm 开放轴。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "WireStructContract", "WireStructContractError", "WIRE_STRUCT_CONTRACT_ELEMENTS", "WIRE_STRUCT_CONTRACT_DOMAIN", "wire_struct_contract_names", "expected_wire_struct_contract_element_count",
    "ensure_wire_struct_contract", "wire_struct_contract_domain", "wire_struct_contract_domain_members", "is_wire_struct_contract", "validate_wire_struct_contract",
]

# 逐字 struct 名 → 元素数（serde 硬断言）（来自 ``with N element`` 声明，漂移由 pytest 钉死）。
WIRE_STRUCT_CONTRACT_ELEMENTS: Final[dict[str, int]] = {
    "AnimationSpec": 4,
    "AnnotatedResponseItem": 2,
    "ArgumentInfo": 2,
    "BarrierArgs": 3,
    "BedrockCheckGovCloudRequirementsResponse": 2,
    "BedrockDiscoverResponse": 2,
    "CapabilityRootDiscoverRequest": 3,
    "CheckoutInputs": 5,
    "ClientInfo": 3,
    "CompactedItemWire": 13,
    "CompleteResult": 3,
    "CompletionInfo": 3,
    "ConsentRecord": 8,
    "CreditStatusDetails": 5,
    "DirectRegistrationResponse": 4,
    "DiscoverResult": 7,
    "DiscoverV2CapabilitiesRequest": 2,
    "DiscoverV2CapabilitiesResponse": 3,
    "DownloadLinkResponse": 6,
    "ElicitResult": 3,
    "ElicitationSchemaWire": 6,
    "EmaResourceMetadata": 3,
    "EnrollRemoteServerResponse": 4,
    "EnvironmentAddParams": 6,
    "EnvironmentInfoResponse": 2,
    "EnvironmentRegistryConnectResponse": 6,
    "EnvironmentRegistryRegistrationResponse": 4,
    "Error": 6,
    "ErrorData": 3,
    "ErrorPayload": 3,
    "ExchangeResponse": 5,
    "ExitPayload": 2,
    "FeedbackSaveResponse": 3,
    "FeedbackUploadParams": 6,
    "FeedbackUploadResponse": 2,
    "FollowupTaskArgs": 2,
    "FrameSpec": 4,
    "FunctionCallOutputItem": 4,
    "GcpSetupParams": 3,
    "GetPromptResult": 4,
    "GhPullRequestApiItem": 3,
    "GhPullRequestView": 3,
    "GitInfo": 3,
    "GitPullRequest": 16,
    "HttpHeader": 3,
    "HttpRequestParams": 8,
    "HttpRequestResponse": 3,
    "IdJagResponse": 7,
    "ImageData": 2,
    "ImageGenerationInputImage": 2,
    "ImageResponse": 5,
    "ImagegenArgs": 5,
    "InitializeParams": 2,
    "InitializeResult": 5,
    "InstallationRecord": 5,
    "InstallationsArgs": 3,
    "InstalledMarketplaceMetadata": 5,
    "JSONRPCError": 2,
    "JSONRPCErrorError": 3,
    "JSONRPCRequest": 4,
    "JSONRPCResponse": 2,
    "LegacyOutput": 3,
    "ListPromptsResult": 6,
    "ListRemoteControlClientsResponse": 2,
    "ListResourceTemplatesResult": 6,
    "ListResourcesResult": 6,
    "ListRootsResult": 2,
    "MarketplaceAddParams": 3,
    "MarketplaceAddResponse": 3,
    "MarketplaceLoadErrorInfo": 2,
    "MarketplaceRemoveResponse": 2,
    "MarketplaceUpgradeErrorInfo": 2,
    "MarketplaceUpgradeResponse": 3,
    "MemoryCitationEntry": 4,
    "MisalignmentErrorDetails": 4,
    "ModelActivitySummary": 4,
    "ModelInfoUpgrade": 3,
    "ModelListParams": 4,
    "ModelListResponse": 2,
    "ModelProviderInfo": 24,
    "ModelProviderListResponse": 3,
    "ModelProviderSummary": 5,
    "ModelUpgradeInfo": 5,
    "ModelsCacheEntry": 5,
    "NetworkProxyAuditMetadata": 9,
    "NpmPackageInfo": 2,
    "OpenAiFormRequestParams": 3,
    "OutputEnvelope": 2,
    "OutputMeasurement": 3,
    "OutputPayload": 2,
    "OverriddenMetadata": 3,
    "OwnerRecord": 2,
    "PidRecord": 4,
    "PostMetadata": 5,
    "ProcessOutputChunk": 3,
    "ProcessResizePtyParams": 2,
    "ProjectCreateParams": 4,
    "ProjectImportParams": 5,
    "ProjectListParams": 4,
    "ProjectMoveParams": 2,
    "ProjectUpdateParams": 4,
    "RawPayloadRef": 3,
    "RealtimeHandoffRequested": 4,
    "RealtimeNoopRequested": 2,
    "RealtimeTranscriptEntry": 2,
    "RefreshResponse": 3,
    "RegistryError": 2,
    "RegistryErrorBody": 2,
    "RemoteControlClientResponse": 8,
    "RemoteControlClientsListParams": 4,
    "RemoteControlClientsRevokeParams": 2,
    "RemoteControlDisableResponse": 4,
    "RemoteControlEnableResponse": 4,
    "RemoteControlPairingStartResponse": 4,
    "RemoteControlPairingStatusParams": 2,
    "RequestHeader": 2,
    "RequestParams": 5,
    "RequiredInput": 2,
    "ResizePayload": 2,
    "ResourceServerMetadata": 4,
    "ResponseCompleted": 4,
    "ReviewStartParams": 3,
    "ReviewStartResponse": 2,
    "RuntimeRegistrationResponse": 3,
    "SandboxProvisioningRequest": 5,
    "ScheduledTaskSummary": 4,
    "SendInputArgs": 4,
    "SessionIndexEntry": 3,
    "SetupErrorReport": 2,
    "SignalParams": 2,
    "SpendControlStatusDetails": 2,
    "StandardErrorResponse": 3,
    "StartRemoteControlPairingResponse": 5,
    "SubscriptionsListenResult": 2,
    "SummaryOutput": 2,
    "TraceBundleManifest": 7,
    "UpdateOutput": 5,
    "UpdatePlanArgs": 2,
    "VersionInfo": 3,
    "ViewImageArgs": 2,
    "WalkEntry": 2,
    "WalkError": 2,
    "WindowsSandboxSetupStartParams": 2,
    "WireCapabilityRootDiscoverRequest": 3,
    "WrappedWebsocketError": 3,

}

# 本仓语义归类（非对照原生判据）：每个 variant 归入一个协议面域。
WIRE_STRUCT_CONTRACT_DOMAIN: Final[dict[str, str]] = {
    "AnimationSpec": "schema_config",
    "AnnotatedResponseItem": "content",
    "ArgumentInfo": "descriptor",
    "BarrierArgs": "request_params",
    "BedrockCheckGovCloudRequirementsResponse": "response",
    "BedrockDiscoverResponse": "response",
    "CapabilityRootDiscoverRequest": "request",
    "CheckoutInputs": "domain_object",
    "ClientInfo": "descriptor",
    "CompactedItemWire": "domain_object",
    "CompleteResult": "response",
    "CompletionInfo": "descriptor",
    "ConsentRecord": "descriptor",
    "CreditStatusDetails": "domain_object",
    "DirectRegistrationResponse": "response",
    "DiscoverResult": "response",
    "DiscoverV2CapabilitiesRequest": "request",
    "DiscoverV2CapabilitiesResponse": "response",
    "DownloadLinkResponse": "response",
    "ElicitResult": "response",
    "ElicitationSchemaWire": "domain_object",
    "EmaResourceMetadata": "descriptor",
    "EnrollRemoteServerResponse": "response",
    "EnvironmentAddParams": "request_params",
    "EnvironmentInfoResponse": "response",
    "EnvironmentRegistryConnectResponse": "response",
    "EnvironmentRegistryRegistrationResponse": "response",
    "Error": "error",
    "ErrorData": "content",
    "ErrorPayload": "content",
    "ExchangeResponse": "response",
    "ExitPayload": "content",
    "FeedbackSaveResponse": "response",
    "FeedbackUploadParams": "request_params",
    "FeedbackUploadResponse": "response",
    "FollowupTaskArgs": "request_params",
    "FrameSpec": "schema_config",
    "FunctionCallOutputItem": "content",
    "GcpSetupParams": "request_params",
    "GetPromptResult": "response",
    "GhPullRequestApiItem": "content",
    "GhPullRequestView": "domain_object",
    "GitInfo": "descriptor",
    "GitPullRequest": "request",
    "HttpHeader": "domain_object",
    "HttpRequestParams": "request_params",
    "HttpRequestResponse": "response",
    "IdJagResponse": "response",
    "ImageData": "content",
    "ImageGenerationInputImage": "domain_object",
    "ImageResponse": "response",
    "ImagegenArgs": "request_params",
    "InitializeParams": "request_params",
    "InitializeResult": "response",
    "InstallationRecord": "descriptor",
    "InstallationsArgs": "request_params",
    "InstalledMarketplaceMetadata": "descriptor",
    "JSONRPCError": "error",
    "JSONRPCErrorError": "error",
    "JSONRPCRequest": "request",
    "JSONRPCResponse": "response",
    "LegacyOutput": "domain_object",
    "ListPromptsResult": "response",
    "ListRemoteControlClientsResponse": "response",
    "ListResourceTemplatesResult": "response",
    "ListResourcesResult": "response",
    "ListRootsResult": "response",
    "MarketplaceAddParams": "request_params",
    "MarketplaceAddResponse": "response",
    "MarketplaceLoadErrorInfo": "descriptor",
    "MarketplaceRemoveResponse": "response",
    "MarketplaceUpgradeErrorInfo": "descriptor",
    "MarketplaceUpgradeResponse": "response",
    "MemoryCitationEntry": "descriptor",
    "MisalignmentErrorDetails": "domain_object",
    "ModelActivitySummary": "descriptor",
    "ModelInfoUpgrade": "domain_object",
    "ModelListParams": "request_params",
    "ModelListResponse": "response",
    "ModelProviderInfo": "descriptor",
    "ModelProviderListResponse": "response",
    "ModelProviderSummary": "descriptor",
    "ModelUpgradeInfo": "descriptor",
    "ModelsCacheEntry": "descriptor",
    "NetworkProxyAuditMetadata": "descriptor",
    "NpmPackageInfo": "descriptor",
    "OpenAiFormRequestParams": "request_params",
    "OutputEnvelope": "domain_object",
    "OutputMeasurement": "domain_object",
    "OutputPayload": "content",
    "OverriddenMetadata": "descriptor",
    "OwnerRecord": "descriptor",
    "PidRecord": "descriptor",
    "PostMetadata": "descriptor",
    "ProcessOutputChunk": "domain_object",
    "ProcessResizePtyParams": "request_params",
    "ProjectCreateParams": "request_params",
    "ProjectImportParams": "request_params",
    "ProjectListParams": "request_params",
    "ProjectMoveParams": "request_params",
    "ProjectUpdateParams": "request_params",
    "RawPayloadRef": "domain_object",
    "RealtimeHandoffRequested": "domain_object",
    "RealtimeNoopRequested": "domain_object",
    "RealtimeTranscriptEntry": "descriptor",
    "RefreshResponse": "response",
    "RegistryError": "error",
    "RegistryErrorBody": "content",
    "RemoteControlClientResponse": "response",
    "RemoteControlClientsListParams": "request_params",
    "RemoteControlClientsRevokeParams": "request_params",
    "RemoteControlDisableResponse": "response",
    "RemoteControlEnableResponse": "response",
    "RemoteControlPairingStartResponse": "response",
    "RemoteControlPairingStatusParams": "request_params",
    "RequestHeader": "domain_object",
    "RequestParams": "request_params",
    "RequiredInput": "domain_object",
    "ResizePayload": "content",
    "ResourceServerMetadata": "descriptor",
    "ResponseCompleted": "domain_object",
    "ReviewStartParams": "request_params",
    "ReviewStartResponse": "response",
    "RuntimeRegistrationResponse": "response",
    "SandboxProvisioningRequest": "request",
    "ScheduledTaskSummary": "descriptor",
    "SendInputArgs": "request_params",
    "SessionIndexEntry": "descriptor",
    "SetupErrorReport": "domain_object",
    "SignalParams": "request_params",
    "SpendControlStatusDetails": "domain_object",
    "StandardErrorResponse": "response",
    "StartRemoteControlPairingResponse": "response",
    "SubscriptionsListenResult": "response",
    "SummaryOutput": "domain_object",
    "TraceBundleManifest": "schema_config",
    "UpdateOutput": "domain_object",
    "UpdatePlanArgs": "request_params",
    "VersionInfo": "descriptor",
    "ViewImageArgs": "request_params",
    "WalkEntry": "descriptor",
    "WalkError": "error",
    "WindowsSandboxSetupStartParams": "request_params",
    "WireCapabilityRootDiscoverRequest": "request",
    "WrappedWebsocketError": "error",

}

_CLOSED_SET: Final[frozenset[str]] = frozenset(WIRE_STRUCT_CONTRACT_ELEMENTS)


class WireStructContract(StrEnum):
    """对照协议面 variant（逐字登记，真相源）。"""

    ANIMATION_SPEC = "AnimationSpec"
    ANNOTATED_RESPONSE_ITEM = "AnnotatedResponseItem"
    ARGUMENT_INFO = "ArgumentInfo"
    BARRIER_ARGS = "BarrierArgs"
    BEDROCK_CHECK_GOV_CLOUD_REQUIREMENTS_RESPONSE = "BedrockCheckGovCloudRequirementsResponse"
    BEDROCK_DISCOVER_RESPONSE = "BedrockDiscoverResponse"
    CAPABILITY_ROOT_DISCOVER_REQUEST = "CapabilityRootDiscoverRequest"
    CHECKOUT_INPUTS = "CheckoutInputs"
    CLIENT_INFO = "ClientInfo"
    COMPACTED_ITEM_WIRE = "CompactedItemWire"
    COMPLETE_RESULT = "CompleteResult"
    COMPLETION_INFO = "CompletionInfo"
    CONSENT_RECORD = "ConsentRecord"
    CREDIT_STATUS_DETAILS = "CreditStatusDetails"
    DIRECT_REGISTRATION_RESPONSE = "DirectRegistrationResponse"
    DISCOVER_RESULT = "DiscoverResult"
    DISCOVER_V2_CAPABILITIES_REQUEST = "DiscoverV2CapabilitiesRequest"
    DISCOVER_V2_CAPABILITIES_RESPONSE = "DiscoverV2CapabilitiesResponse"
    DOWNLOAD_LINK_RESPONSE = "DownloadLinkResponse"
    ELICIT_RESULT = "ElicitResult"
    ELICITATION_SCHEMA_WIRE = "ElicitationSchemaWire"
    EMA_RESOURCE_METADATA = "EmaResourceMetadata"
    ENROLL_REMOTE_SERVER_RESPONSE = "EnrollRemoteServerResponse"
    ENVIRONMENT_ADD_PARAMS = "EnvironmentAddParams"
    ENVIRONMENT_INFO_RESPONSE = "EnvironmentInfoResponse"
    ENVIRONMENT_REGISTRY_CONNECT_RESPONSE = "EnvironmentRegistryConnectResponse"
    ENVIRONMENT_REGISTRY_REGISTRATION_RESPONSE = "EnvironmentRegistryRegistrationResponse"
    ERROR = "Error"
    ERROR_DATA = "ErrorData"
    ERROR_PAYLOAD = "ErrorPayload"
    EXCHANGE_RESPONSE = "ExchangeResponse"
    EXIT_PAYLOAD = "ExitPayload"
    FEEDBACK_SAVE_RESPONSE = "FeedbackSaveResponse"
    FEEDBACK_UPLOAD_PARAMS = "FeedbackUploadParams"
    FEEDBACK_UPLOAD_RESPONSE = "FeedbackUploadResponse"
    FOLLOWUP_TASK_ARGS = "FollowupTaskArgs"
    FRAME_SPEC = "FrameSpec"
    FUNCTION_CALL_OUTPUT_ITEM = "FunctionCallOutputItem"
    GCP_SETUP_PARAMS = "GcpSetupParams"
    GET_PROMPT_RESULT = "GetPromptResult"
    GH_PULL_REQUEST_API_ITEM = "GhPullRequestApiItem"
    GH_PULL_REQUEST_VIEW = "GhPullRequestView"
    GIT_INFO = "GitInfo"
    GIT_PULL_REQUEST = "GitPullRequest"
    HTTP_HEADER = "HttpHeader"
    HTTP_REQUEST_PARAMS = "HttpRequestParams"
    HTTP_REQUEST_RESPONSE = "HttpRequestResponse"
    ID_JAG_RESPONSE = "IdJagResponse"
    IMAGE_DATA = "ImageData"
    IMAGE_GENERATION_INPUT_IMAGE = "ImageGenerationInputImage"
    IMAGE_RESPONSE = "ImageResponse"
    IMAGEGEN_ARGS = "ImagegenArgs"
    INITIALIZE_PARAMS = "InitializeParams"
    INITIALIZE_RESULT = "InitializeResult"
    INSTALLATION_RECORD = "InstallationRecord"
    INSTALLATIONS_ARGS = "InstallationsArgs"
    INSTALLED_MARKETPLACE_METADATA = "InstalledMarketplaceMetadata"
    J_S_O_N_R_P_C_ERROR = "JSONRPCError"
    J_S_O_N_R_P_C_ERROR_ERROR = "JSONRPCErrorError"
    J_S_O_N_R_P_C_REQUEST = "JSONRPCRequest"
    J_S_O_N_R_P_C_RESPONSE = "JSONRPCResponse"
    LEGACY_OUTPUT = "LegacyOutput"
    LIST_PROMPTS_RESULT = "ListPromptsResult"
    LIST_REMOTE_CONTROL_CLIENTS_RESPONSE = "ListRemoteControlClientsResponse"
    LIST_RESOURCE_TEMPLATES_RESULT = "ListResourceTemplatesResult"
    LIST_RESOURCES_RESULT = "ListResourcesResult"
    LIST_ROOTS_RESULT = "ListRootsResult"
    MARKETPLACE_ADD_PARAMS = "MarketplaceAddParams"
    MARKETPLACE_ADD_RESPONSE = "MarketplaceAddResponse"
    MARKETPLACE_LOAD_ERROR_INFO = "MarketplaceLoadErrorInfo"
    MARKETPLACE_REMOVE_RESPONSE = "MarketplaceRemoveResponse"
    MARKETPLACE_UPGRADE_ERROR_INFO = "MarketplaceUpgradeErrorInfo"
    MARKETPLACE_UPGRADE_RESPONSE = "MarketplaceUpgradeResponse"
    MEMORY_CITATION_ENTRY = "MemoryCitationEntry"
    MISALIGNMENT_ERROR_DETAILS = "MisalignmentErrorDetails"
    MODEL_ACTIVITY_SUMMARY = "ModelActivitySummary"
    MODEL_INFO_UPGRADE = "ModelInfoUpgrade"
    MODEL_LIST_PARAMS = "ModelListParams"
    MODEL_LIST_RESPONSE = "ModelListResponse"
    MODEL_PROVIDER_INFO = "ModelProviderInfo"
    MODEL_PROVIDER_LIST_RESPONSE = "ModelProviderListResponse"
    MODEL_PROVIDER_SUMMARY = "ModelProviderSummary"
    MODEL_UPGRADE_INFO = "ModelUpgradeInfo"
    MODELS_CACHE_ENTRY = "ModelsCacheEntry"
    NETWORK_PROXY_AUDIT_METADATA = "NetworkProxyAuditMetadata"
    NPM_PACKAGE_INFO = "NpmPackageInfo"
    OPEN_AI_FORM_REQUEST_PARAMS = "OpenAiFormRequestParams"
    OUTPUT_ENVELOPE = "OutputEnvelope"
    OUTPUT_MEASUREMENT = "OutputMeasurement"
    OUTPUT_PAYLOAD = "OutputPayload"
    OVERRIDDEN_METADATA = "OverriddenMetadata"
    OWNER_RECORD = "OwnerRecord"
    PID_RECORD = "PidRecord"
    POST_METADATA = "PostMetadata"
    PROCESS_OUTPUT_CHUNK = "ProcessOutputChunk"
    PROCESS_RESIZE_PTY_PARAMS = "ProcessResizePtyParams"
    PROJECT_CREATE_PARAMS = "ProjectCreateParams"
    PROJECT_IMPORT_PARAMS = "ProjectImportParams"
    PROJECT_LIST_PARAMS = "ProjectListParams"
    PROJECT_MOVE_PARAMS = "ProjectMoveParams"
    PROJECT_UPDATE_PARAMS = "ProjectUpdateParams"
    RAW_PAYLOAD_REF = "RawPayloadRef"
    REALTIME_HANDOFF_REQUESTED = "RealtimeHandoffRequested"
    REALTIME_NOOP_REQUESTED = "RealtimeNoopRequested"
    REALTIME_TRANSCRIPT_ENTRY = "RealtimeTranscriptEntry"
    REFRESH_RESPONSE = "RefreshResponse"
    REGISTRY_ERROR = "RegistryError"
    REGISTRY_ERROR_BODY = "RegistryErrorBody"
    REMOTE_CONTROL_CLIENT_RESPONSE = "RemoteControlClientResponse"
    REMOTE_CONTROL_CLIENTS_LIST_PARAMS = "RemoteControlClientsListParams"
    REMOTE_CONTROL_CLIENTS_REVOKE_PARAMS = "RemoteControlClientsRevokeParams"
    REMOTE_CONTROL_DISABLE_RESPONSE = "RemoteControlDisableResponse"
    REMOTE_CONTROL_ENABLE_RESPONSE = "RemoteControlEnableResponse"
    REMOTE_CONTROL_PAIRING_START_RESPONSE = "RemoteControlPairingStartResponse"
    REMOTE_CONTROL_PAIRING_STATUS_PARAMS = "RemoteControlPairingStatusParams"
    REQUEST_HEADER = "RequestHeader"
    REQUEST_PARAMS = "RequestParams"
    REQUIRED_INPUT = "RequiredInput"
    RESIZE_PAYLOAD = "ResizePayload"
    RESOURCE_SERVER_METADATA = "ResourceServerMetadata"
    RESPONSE_COMPLETED = "ResponseCompleted"
    REVIEW_START_PARAMS = "ReviewStartParams"
    REVIEW_START_RESPONSE = "ReviewStartResponse"
    RUNTIME_REGISTRATION_RESPONSE = "RuntimeRegistrationResponse"
    SANDBOX_PROVISIONING_REQUEST = "SandboxProvisioningRequest"
    SCHEDULED_TASK_SUMMARY = "ScheduledTaskSummary"
    SEND_INPUT_ARGS = "SendInputArgs"
    SESSION_INDEX_ENTRY = "SessionIndexEntry"
    SETUP_ERROR_REPORT = "SetupErrorReport"
    SIGNAL_PARAMS = "SignalParams"
    SPEND_CONTROL_STATUS_DETAILS = "SpendControlStatusDetails"
    STANDARD_ERROR_RESPONSE = "StandardErrorResponse"
    START_REMOTE_CONTROL_PAIRING_RESPONSE = "StartRemoteControlPairingResponse"
    SUBSCRIPTIONS_LISTEN_RESULT = "SubscriptionsListenResult"
    SUMMARY_OUTPUT = "SummaryOutput"
    TRACE_BUNDLE_MANIFEST = "TraceBundleManifest"
    UPDATE_OUTPUT = "UpdateOutput"
    UPDATE_PLAN_ARGS = "UpdatePlanArgs"
    VERSION_INFO = "VersionInfo"
    VIEW_IMAGE_ARGS = "ViewImageArgs"
    WALK_ENTRY = "WalkEntry"
    WALK_ERROR = "WalkError"
    WINDOWS_SANDBOX_SETUP_START_PARAMS = "WindowsSandboxSetupStartParams"
    WIRE_CAPABILITY_ROOT_DISCOVER_REQUEST = "WireCapabilityRootDiscoverRequest"
    WRAPPED_WEBSOCKET_ERROR = "WrappedWebsocketError"



class WireStructContractError(ValueError):
    """未登记的协议面 variant（封闭集/元素数/归类判据点名）。"""


def wire_struct_contract_names() -> list[str]:
    """返回逐字 variant 名列表副本（顺序稳定，调用方改不动真相源）。"""
    return list(WIRE_STRUCT_CONTRACT_ELEMENTS)


def expected_wire_struct_contract_element_count(name: str) -> int:
    """该 variant 的逐字元素数（未登记抛错）。"""
    if not isinstance(name, str) or name not in _CLOSED_SET:
        raise WireStructContractError(f"未登记的 variant: {name!r} —— 先在 app/core/wire_struct_contract.py 的 WIRE_STRUCT_CONTRACT_ELEMENTS 登记")
    return WIRE_STRUCT_CONTRACT_ELEMENTS[name]


def ensure_wire_struct_contract(value: str) -> str:
    """值域闭合：登记过原样放行，未登记抛 :class:`WireStructContractError`。"""
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise WireStructContractError(f"未登记的 variant: {value!r} —— 先在 app/core/wire_struct_contract.py 的 WireStructContract 登记后再产出")
    return value


def wire_struct_contract_domain(value: str) -> str:
    """归类到协议面域（登记外抛错）。"""
    ensure_wire_struct_contract(value)
    return WIRE_STRUCT_CONTRACT_DOMAIN[value]


def wire_struct_contract_domain_members(domain: str) -> tuple[str, ...]:
    """反查某域下的全部逐字 variant 名（元组副本，调用方改不动真相源）。"""
    if domain not in set(WIRE_STRUCT_CONTRACT_DOMAIN.values()):
        raise WireStructContractError(f"未登记的域: {domain!r} —— 合法域: {sorted(set(WIRE_STRUCT_CONTRACT_DOMAIN.values()))!r}")
    return tuple(nm for nm, dom in WIRE_STRUCT_CONTRACT_DOMAIN.items() if dom == domain)


def is_wire_struct_contract(value: str) -> bool:
    """封闭集成员判定（不改值、不抛错）。"""
    return isinstance(value, str) and value in _CLOSED_SET


def validate_wire_struct_contract(name: str, element_count: int) -> str:
    """一致性守门：variant 名与元素数须同时匹配逐字表，否则抛错点名。"""
    ensure_wire_struct_contract(name)
    expected = expected_wire_struct_contract_element_count(name)
    if element_count != expected:
        raise WireStructContractError(f"{name!r} 的 struct 元素数应为 {expected}，实得 {element_count!r}")
    return name
