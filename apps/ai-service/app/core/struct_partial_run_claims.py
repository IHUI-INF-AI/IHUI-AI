# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Structures recovered by their partial name set against a FIELDS array (R81).

R75 left 1072 sites whose pool segmented to fewer names than the arity.  R80 read 4005 FIELDS
record arrays.  Combining them: a struct whose partial name set M (>= 3 names) is contained in
exactly one array whose length equals the arity it is catalogued with gets that array.

**23 structures** are claimed this way and each gains a complete field list — something the
partial pool could never give.  16 names matched more than one array and are recorded as
ambiguous rather than resolved.

The rule is *containment* (`M ⊆ array`), not equality, so these claims are weaker than R75's
exact-arity gate: a three-name partial can in principle sit inside an unrelated array of the same
length.  Hence `PARTIAL_CLAIMS_ATTESTED = False` — the table is usable as a lead list, and each
entry names the array address so it can be re-checked independently.
"""

from __future__ import annotations

from collections.abc import Mapping
from types import MappingProxyType
from typing import Final

UNDER_STRUCTS_WITH_3_NAMES: Final[int] = 167
UNDER_SITES: Final[int] = 359
CLAIMED_COUNT: Final[int] = 23
AMBIGUOUS_COUNT: Final[int] = 16
TOTAL_CLAIMED_FIELDS: Final[int] = 162

#: Coverage before and after this round (R78's 278 + these claims).
COVERAGE_BEFORE: Final[int] = 278
COVERAGE_AFTER: Final[int] = 301

#: name -> (arity, array address, complete field list in record order)
CLAIMS: Final[Mapping[str, tuple[int, str, tuple[str, ...]]]] = MappingProxyType({
    'AgentMessageDisplay': (4, '0x151e06f00', ('action', 'blockType', 'cyberTrustedAccess', 'checkTrustedContacts')),
    'ChannelPermissions': (4, '0x151a5fbe8', ('read', 'post', 'reply', 'edit_metadata')),
    'CodexWorkspaceMessage': (5, '0x1519cb5d0', ('message_id', 'message_type', 'message_body', 'created_at', 'archived_at')),
    'CollabAgentSpawnEndEvent': (10, '0x152243b20', ('call_id', 'completed_at_ms', 'sender_thread_id', 'new_thread_id', 'new_agent_nickname', 'new_agent_role', 'prompt', 'model', 'reasoning_effort', 'status')),
    'CollabCloseEndEvent': (7, '0x152243c78', ('call_id', 'completed_at_ms', 'sender_thread_id', 'receiver_thread_id', 'receiver_agent_nickname', 'receiver_agent_role', 'status')),
    'CompactedItemWire': (13, '0x152224e10', ('message', 'replacement_history', 'replacement_history_metadata', 'guardian_history', 'retained_context', 'mcp_resource_origins', 'window_number', 'first_window_id', 'previous_window_id', 'window_id', 'compaction_response_id', 'latest_token_usage_record', 'resume_metadata')),
    'Error': (6, '0x151ac0c88', ('type', 'code', 'message', 'plan_type', 'resets_at', 'misalignment')),
    'FsGetMetadataResponse': (6, '0x151ea7158', ('isDirectory', 'isFile', 'isSymlink', 'size', 'createdAtMs', 'modifiedAtMs')),
    'FuzzyFileSearchResult': (6, '0x151bf6a98', ('root', 'path', 'match_type', 'file_name', 'score', 'indices')),
    'ModelSafetyBufferingUpdatedNotification': (7, '0x151c043e8', ('threadId', 'turnId', 'model', 'useCases', 'reasons', 'showBufferingUi', 'fasterModel')),
    'ModelUsage': (13, '0x15236f018', ('model', 'speed', 'credits', 'cost_usd', 'users', 'threads', 'turns', 'on_demand_credits', 'uncached_text_input_tokens', 'cached_text_input_tokens', 'text_output_tokens', 'text_total_tokens', 'total_tokens')),
    'OAuthSessionConfig': (7, '0x151cb8f68', ('authorization_url', 'token_url', 'device_authorization_url', 'client_id', 'resource', 'scopes', 'redirect_port')),
    'RawFilesystemRequirementsToml': (6, '0x151cbfe58', ('deny_read', 'description', 'extends', 'workspace_roots', 'filesystem', 'network')),
    'ReviewFinding': (5, '0x151e09a78', ('title', 'body', 'confidence_score', 'priority', 'code_location')),
    'SandboxProvisioningRequest': (5, '0x15246bf50', ('codex_home', 'registered_core', 'refresh_only', 'settings', 'listeners')),
    'SnapshotSkill': (7, '0x1522afdd8', ('package', 'name', 'description', 'alias_root', 'main_resource', 'prompt_visible', 'resources')),
    'ThreadRealtimeAudioChunk': (5, '0x151c069b8', ('data', 'sampleRate', 'numChannels', 'samplesPerChannel', 'itemId')),
    'ThreadSummary': (5, '0x151a5fc98', ('thread_id', 'root_post', 'reply_count', 'last_activity_at', 'latest_reply')),
    'ThreadUsageBreakdownGroup': (10, '0x1523c01c8', ('model', 'reasoning_effort', 'speed', 'estimated_usage_credits_micros', 'native_usage_usd_micros', 'net_new_input_tokens', 'cached_input_tokens', 'input_tokens', 'output_tokens', 'total_tokens')),
    'ThreadUsageEstimate': (5, '0x1523c0138', ('thread_id', 'estimated_usage_credits_micros', 'estimated_usage_usd_micros', 'native_usage_usd_micros', 'groups')),
    'TurnStartedEvent': (7, '0x152231290', ('turn_attribution', 'turn_id', 'root_turn_id', 'trace_id', 'started_at', 'model_context_window', 'collaboration_mode_kind')),
    'UpdateOutput': (5, '0x1519cf150', ('status', 'managedCodexPath', 'installedVersion', 'runningVersion', 'message')),
    'UserMessageEvent': (14, '0x152231388', ('client_id', 'message', 'images', 'image_details', 'file_ids', 'file_id_details', 'image_order', 'local_images', 'local_image_details', 'audio', 'audio_references', 'audio_order', 'local_audio', 'text_elements')),
})

#: Matched more than one array — kept as names, no attribution attempted.
AMBIGUOUS: Final[tuple[str, ...]] = (
    'ComputerUseWindowsExeConfigToml',
    'GatewayOAuthSettings',
    'GuardianV2ConfigToml',
    'McpElicitationNumberSchema',
    'McpElicitationStringSchema',
    'MemoryCitationEntry',
    'ModelProviderAwsAuthInfo',
    'NumberSchema',
    'RemoteAppTemplateResponse',
    'RemotePluginDirectorySharePrincipal',
    'StringSchema',
    'ThreadGoal',
    'TitledMultiSelectEnumSchema',
    'TuiPagerKeymap',
    'TuiVimOperatorKeymap',
    'TuiVimTextObjectKeymap',
)

CLAIM_RULE: Final[str] = "partial-name-set-subset-of-array"
PARTIAL_CLAIMS_ATTESTED: Final[bool] = False
MIN_PARTIAL_NAMES: Final[int] = 3


class PartialClaimError(ValueError):
    """Raised when a partial claim contradicts the catalog or its own counts."""


def claim_of(name: str) -> tuple[str, ...]:
    """Complete field list claimed for one struct; empty when unclaimed."""
    entry = CLAIMS.get(name)
    return entry[2] if entry else ()


def validate_partial_claims() -> None:
    if len(CLAIMS) != CLAIMED_COUNT:
        raise PartialClaimError("claim table size disagrees with CLAIMED_COUNT")
    if len(AMBIGUOUS) != AMBIGUOUS_COUNT:
        raise PartialClaimError("ambiguous list size disagrees with AMBIGUOUS_COUNT")
    if sum(len(f) for _a, _v, f in CLAIMS.values()) != TOTAL_CLAIMED_FIELDS:
        raise PartialClaimError("field total disagrees with the table")
    if COVERAGE_BEFORE + CLAIMED_COUNT != COVERAGE_AFTER:
        raise PartialClaimError("coverage arithmetic disagrees")
    for name, (arity, address, fields) in CLAIMS.items():
        if len(fields) != arity:
            raise PartialClaimError(f"{name}: {len(fields)} fields vs arity {arity}")
        if len(fields) < MIN_PARTIAL_NAMES:
            raise PartialClaimError(f"{name}: below the partial-name floor")
        if len(set(fields)) != len(fields):
            raise PartialClaimError(f"{name}: repeats a field")
        if not address.startswith('0x'):
            raise PartialClaimError(f"{name}: address is not a hex literal")
    if PARTIAL_CLAIMS_ATTESTED:
        raise PartialClaimError(
            "containment is not equality; flipping the attestation flag is unsupported")


def partial_claims_summary() -> Mapping[str, object]:
    validate_partial_claims()
    return MappingProxyType({
        'under_structs': UNDER_STRUCTS_WITH_3_NAMES,
        'claimed': CLAIMED_COUNT,
        'ambiguous': AMBIGUOUS_COUNT,
        'coverage_before': COVERAGE_BEFORE,
        'coverage_after': COVERAGE_AFTER,
        'attested': PARTIAL_CLAIMS_ATTESTED,
    })
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
