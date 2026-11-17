# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Structures matched to their serde FIELDS record arrays (R80).

R68 proved `FIELDS` is a contiguous array of 16 B fat `&'static str` records.  This round scans
`.rdata` for such arrays directly — **4005** runs, 118 of them with >= 20 records — and matches them to
R75's reconstructions by (length == arity ∧ name set equal): **65 structures** get a record array
with its address and its order.

Two consequences:

* **62 of the 65** record orders equal the order R75 segmented out of the byte pool.  So for a
  single-copy struct the pool's byte order and the FIELDS order are the same thing, which is why
  segmenting a pool produces the right *names* in a usable order.  This does **not** contradict R76:
  R76 measured pools that mix several copies of a big struct, and those orders are scrambled.
* The three differing entries are recorded, not smoothed: `ErrorData` (`code, data, message` in the
  array), `Failure` and `SetupErrorReport` (`message, code`).

What this does **not** settle: `TurnStartParams` (arity 28) and `ThreadStartParams` (arity 27) have
**no complete record array** in the scan — only a 13-record Turn variant (which does contain
`modelProvider`, one of the two names R72 could not position) and a 20-record Thread variant.
So "record order == declaration order" stays **undetermined** for the two structures R72 could
actually check it against.  Recorded as undetermined rather than assumed either way.

Triple attestation: `RateLimitSnapshot` now agrees across three independent judges — R65 (LEA
window), R75 (pool segmentation) and this round's record array.
"""

from __future__ import annotations

from collections.abc import Mapping
from types import MappingProxyType
from typing import Final

from app.core.struct_strict_reconstruction import STRICT_STRUCTURES

RECORD_RUNS: Final[int] = 4005
RUNS_GE_20: Final[int] = 118
EXACT_PAIR_COUNT: Final[int] = 65
ORDER_MATCHES_POOL: Final[int] = 62

#: name -> (array address, record order)
FIELDS_RUNS: Final[Mapping[str, tuple[str, tuple[str, ...]]]] = MappingProxyType({
    'AnnotatedResponseItem': ('0x1521c8300', ('item', 'annotations')),
    'AsyncUserInputQuestion': ('0x1519c6148', ('title', 'options')),
    'AudioControls': ('0x1521c9c40', ('microphoneMuted', 'speakerSuppressed')),
    'AudioDevice': ('0x1521c9bc8', ('name', 'channels', 'isDefault')),
    'AudioDeviceSelection': ('0x1521c9cf0', ('microphone', 'speaker', 'channel')),
    'AudioState': ('0x1521c9b90', ('microphonePeak', 'speakerPeak')),
    'AutoReviewRequirementsToml': ('0x151cc6620', ('required_on_models', 'ignore_rules')),
    'BrowserUseConfigToml': ('0x151a09a80', ('allow_history_access', 'default_origin_policy', 'origins')),
    'BrowserUseOriginPolicyConfigToml': ('0x151a09af8', ('access', 'downloads', 'uploads', 'full_cdp_access')),
    'ComputerUseWindowsConfigToml': ('0x1519d0c60', ('aumids', 'exes')),
    'ConfiguredUpdater': ('0x1519cf320', ('autoUpdateEnabled', 'updateIntervalMinutes')),
    'CopyFileArgs': ('0x152143948', ('source_environment_id', 'source_path', 'target_environment_id', 'target_path')),
    'DiscoveredPluginFiles': ('0x151ea8690', ('manifest', 'mcpConfig', 'appsConfig')),
    'DynamicToolCallResponse': ('0x151ad2c18', ('contentItems', 'success')),
    'EnvironmentsToml': ('0x151e91660', ('default', 'include_local', 'environments')),
    'ErrorData': ('0x1518d9e70', ('code', 'data', 'message')),
    'Failure': ('0x151ad3370', ('message', 'code')),
    'FsCopyParams': ('0x151ea7480', ('sourcePath', 'destinationPath', 'recursive', 'sandbox')),
    'FsHelperOpenResponse': ('0x151ea61f8', ('processId', 'fileHandle')),
    'GeneratedRecap': ('0x152332050', ('summary', 'next_action')),
    'GranularApprovalConfig': ('0x1519492d8', ('sandbox_approval', 'rules', 'skill_approval', 'request_permissions', 'mcp_elicitations')),
    'GuardianV2ReviewScopeConfigToml': ('0x151a9ce78', ('computer_use_only', 'sandboxed_exec_commands')),
    'GuardianV2TranscriptConfigToml': ('0x151946b10', ('sources', 'include_images', 'max_message_entry_tokens', 'max_tool_entry_tokens', 'max_message_transcript_tokens', 'max_tool_transcript_tokens', 'max_recent_non_user_entries')),
    'HostHello': ('0x151c9fff0', ('selectedVersion', 'capabilities')),
    'ImportedExternalAgentSessionRecord': ('0x151ed1df8', ('source_path', 'content_sha256', 'imported_thread_id', 'imported_at', 'source_modified_at', 'connector_names', 'title')),
    'InitializeCapabilities': ('0x151ad9ad8', ('requiredHumanApproval', 'explicitGatewayOauth', 'experimentalApi', 'requestAttestation', 'mcpServerOpenaiFormElicitation', 'optOutNotificationMethods', 'extensions')),
    'InitializeParams': ('0x151ad4360', ('clientInfo', 'capabilities')),
    'LegacyPermissionProfile': ('0x151947e28', ('network', 'file_system')),
    'McpServerEventStreamNotification': ('0x151c034d8', ('subscriptionId', 'notification')),
    'McpServerIdpOAuthConfig': ('0x1518ace18', ('issuer', 'client_id', 'client_secret', 'token_endpoint_auth_method')),
    'MisalignmentErrorDetails': ('0x1519d0b08', ('errorType', 'detailedExplanation', 'steer', 'reviewTarget')),
    'ModelProviderCapabilities': ('0x15195d970', ('cyber_access_programs', 'external_web_access', 'remote_compaction')),
    'ModelTokenBudgetConfig': ('0x1519461b0', ('enabled', 'use_history_notes_extension', 'reminder_threshold_tokens', 'reminder_message_template', 'guidance_message', 'auto_compact_fallback_prompt', 'auto_compact_fallback_buffer_tokens')),
    'NetworkPolicyAmendment': ('0x1519d07a0', ('host', 'action')),
    'OwnerRecord': ('0x15247d1c8', ('version', 'ownerThreadId')),
    'ProcessExitedNotification': ('0x151bf6880', ('processHandle', 'exitCode', 'outputDrainTimedOut', 'stdout', 'stdoutCapReached', 'stderr', 'stderrCapReached')),
    'ProjectChangedNotification': ('0x151c06918', ('projectId', 'changeType')),
    'Proof': ('0x15195cf60', ('credentialId', 'signature')),
    'RateLimitSnapshot': ('0x151c06590', ('limitId', 'limitName', 'normalModelSlug', 'primary', 'secondary', 'credits', 'individualLimit', 'spendControlReached', 'planType', 'rateLimitReachedType')),
    'RequestPermissionProfile': ('0x151be2740', ('network', 'fileSystem')),
    'RequirementsExecPolicyPatternTokenToml': ('0x151cdc578', ('token', 'any_of')),
    'RequirementsExecPolicyPrefixRuleToml': ('0x151cdc500', ('canonical_matching', 'pattern', 'decision', 'justification')),
    'ResponseCompletedUsage': ('0x151ac0e30', ('input_tokens', 'input_tokens_details', 'output_tokens', 'output_tokens_details', 'total_tokens', 'codex_rollout_budget_units')),
    'ResponseUsageMetadata': ('0x151ac9158', ('amount', 'metadata')),
    'SafetyBuffering': ('0x151ac0f70', ('use_cases', 'reasons', 'retry_model')),
    'SessionManifest': ('0x151ed1c28', ('cliSessionId', 'remoteMcpServersConfig')),
    'SetupErrorReport': ('0x151ad3370', ('message', 'code')),
    'SkillPolicy': ('0x151ea2898', ('allowImplicitInvocation', 'products')),
    'TextElement': ('0x151b31b10', ('byteRange', 'placeholder')),
    'ThreadReadState': ('0x151c05bb0', ('firstUnread', 'revision')),
    'ThreadSectionAppearance': ('0x151b3f478', ('icon', 'color')),
    'TokenUsageBreakdown': ('0x151c05d20', ('totalTokens', 'inputTokens', 'cachedInputTokens', 'cacheWriteInputTokens', 'outputTokens', 'reasoningOutputTokens')),
    'TokenUsageProfileDailyBucket': ('0x1519cb708', ('start_date', 'tokens')),
    'TokenUsageProfileStats': ('0x15240d390', ('lifetime_tokens', 'peak_daily_tokens', 'longest_running_turn_sec', 'current_streak_days', 'longest_streak_days', 'daily_usage_buckets')),
    'ToolRegistryConfigToml': ('0x151a9c9f0', ('error_on_tool_collisions', 'turn_metadata_includes_tool_info')),
    'TurnError': ('0x1519d0958', ('message', 'codexErrorInfo', 'additionalDetails', 'misalignment')),
    'UpdatePlanArgs': ('0x151e0a140', ('explanation', 'plan')),
    'VerifiedAccessProgram': ('0x151e226e8', ('state', 'grants')),
    'WalkOutcome': ('0x151ea64e8', ('entries', 'errors', 'truncated')),
    'WebSearchLocation': ('0x151aea940', ('country', 'region', 'city', 'timezone')),
    'WebSearchToolConfig': ('0x1518aafb8', ('context_size', 'allowed_domains', 'location')),
    'WindowsSandboxProxyListeners': ('0x15246c030', ('http_ports', 'socks_ports')),
    'WindowsWorldWritableWarningNotification': ('0x151bf5ae8', ('samplePaths', 'extraCount', 'failedScan')),
    'WireNestedToolCall': ('0x151ca0928', ('cell_id', 'runtime_tool_call_id', 'tool_name', 'tool_kind', 'input')),
    'WireToolName': ('0x151ca0608', ('name', 'namespace')),
})

#: The three whose record order differs from the pool segmentation order.
ORDER_DIFFERS: Final[tuple[str, ...]] = (
    'ErrorData',
    'Failure',
    'SetupErrorReport',
)

#: R72 could only check the record-order claim on Turn/Thread; neither has a complete array here.
RECORD_ORDER_IS_DECLARATION: Final[str] = "undetermined_for_turn_and_thread"
TURN_FULL_RUN_FOUND: Final[bool] = False
THREAD_FULL_RUN_FOUND: Final[bool] = False

#: Partial variants that do exist, recorded with their measured order (read from the record array).
TURN_VARIANT_RUN: Final[tuple[str, int, tuple[str, ...]]] = (
    '0x151c05ab8', 13, ('environments', 'approvalPolicy', 'approvalsReviewer', 'sandboxPolicy', 'activePermissionProfile', 'model', 'modelProvider', 'serviceTier', 'effort', 'summary', 'collaborationMode', 'multiAgentMode', 'personality'),
)
THREAD_VARIANT_RUN_ADDRESS: Final[str] = '0x1519bcec8'
THREAD_VARIANT_RUN_LENGTH: Final[int] = 20

#: `modelProvider` — one of the two names R72 left unpositioned — appears inside the Turn variant.
MODEL_PROVIDER_POSITIONED_IN_VARIANT: Final[bool] = True

TRIPLE_ATTESTED: Final[tuple[str, ...]] = ("RateLimitSnapshot",)


class FieldsRunError(ValueError):
    """Raised when a record-array claim contradicts the reconstruction table."""


def order_of(name: str) -> tuple[str, ...]:
    """Record order of one struct; empty when this round has no array for it."""
    entry = FIELDS_RUNS.get(name)
    return entry[1] if entry else ()


def validate_fields_runs() -> None:
    if len(FIELDS_RUNS) != EXACT_PAIR_COUNT:
        raise FieldsRunError("pair table size disagrees with EXACT_PAIR_COUNT")
    if ORDER_MATCHES_POOL + len(ORDER_DIFFERS) != EXACT_PAIR_COUNT:
        raise FieldsRunError("matching + differing counts do not add up")
    for name, (address, order) in FIELDS_RUNS.items():
        if name not in STRICT_STRUCTURES:
            raise FieldsRunError(f"{name} has an array but is not in the reconstruction table")
        if len(order) != STRICT_STRUCTURES[name][0]:
            raise FieldsRunError(
                f"{name}: {len(order)} records vs arity {STRICT_STRUCTURES[name][0]}")
        if set(order) != set(STRICT_STRUCTURES[name][1]):
            raise FieldsRunError(f"{name}: record names differ from the reconstruction")
        if not address.startswith('0x'):
            raise FieldsRunError(f"{name}: address is not a hex literal")
    for name in ORDER_DIFFERS:
        if name not in FIELDS_RUNS:
            raise FieldsRunError(f"{name} is listed as differing but has no array")
    if RECORD_ORDER_IS_DECLARATION not in (
            "undetermined_for_turn_and_thread", "confirmed", "refuted"):
        raise FieldsRunError("record-order claim is neither confirmed, refuted nor undetermined")
    if TURN_FULL_RUN_FOUND or THREAD_FULL_RUN_FOUND:
        raise FieldsRunError("a complete Turn/Thread array would change the recorded conclusion")


def fields_run_summary() -> Mapping[str, object]:
    validate_fields_runs()
    return MappingProxyType({
        'record_runs': RECORD_RUNS,
        'runs_ge_20': RUNS_GE_20,
        'exact_pairs': EXACT_PAIR_COUNT,
        'order_matches_pool': ORDER_MATCHES_POOL,
        'order_differs': len(ORDER_DIFFERS),
        'record_order_claim': RECORD_ORDER_IS_DECLARATION,
    })
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
