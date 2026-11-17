# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R69: visitor-key evidence pins set exactness, the arity gap and the Thread mixing."""

from __future__ import annotations

import pytest

from app.core.struct_visitor_key_evidence import (
    FALSIFIED_AFTER_R68,
    MEASUREMENTS,
    THREAD_MIXED_MARKERS,
    TURN_ARITY_GAP,
    TURN_LAST_NAME_CANDIDATE,
    TURN_LAST_NAME_VERIFIED,
    TURN_START_PARAMS_ARITY,
    TURN_START_PARAMS_ATTESTED_TAIL,
    TURN_VISITOR_ONLY,
    VisitorKeyEvidenceError,
    ensure_visitor_key_evidence,
    thread_keys_are_mixed,
    turn_arity_gap,
    turn_start_params_keys,
    validate_visitor_key_evidence,
)

TURN_KEYS = ('threadId', 'summary', 'approvalPolicy', 'permissions', 'disabledPluginIds', 'additionalContext', 'outputSchema', 'multiAgentMode', 'effort', 'sandboxPolicy', 'collaborationMode', 'parentTurnId', 'rootTurnId', 'environments', 'clientUserMessageId', 'responsesapiClientMetadataPatch', 'serviceTierForTurn', 'toolOutput', 'responsesapiClientMetadata', 'turnTrigger', 'model', 'personality', 'approvalsReviewer', 'runtimeWorkspaceRoots', 'serviceTier', 'modelProvider', 'cyberAccessProgram')
THREAD_KEYS = ('baseInstructions', 'ephemeral', 'personality', 'model', 'runtimeWorkspaceRoots', 'threadSource', 'modelProvider', 'allowProviderModelFallback', 'historyMode', 'developerInstructions', 'environments', 'mockExperimentalField', 'selectedCapabilityRoots', 'serviceName', 'approvalPolicy', 'permissions', 'approvalsReviewer', 'daybreakEnabled', 'multiAgentMode', 'sandbox', 'serviceTier', 'config', 'dynamicTools', 'projectId', 'sessionStartSource', 'id', 'preview', 'status', 'createdAt', 'cliVersion', 'source', 'recencyAt', 'canAcceptDirectInput', 'agentRole', 'name', 'section', 'forkedFromId', 'originator', 'reasoningEffort', 'agentNickname', 'extra', 'sectionEnteredAt', 'parentThreadId')


def test_turn_keys_are_the_recorded_set() -> None:
    assert turn_start_params_keys() == TURN_KEYS
    assert len(TURN_KEYS) == 27
    assert len(set(TURN_KEYS)) == 27


def test_arity_is_28_and_one_name_is_still_missing() -> None:
    assert TURN_START_PARAMS_ARITY == 28
    assert turn_arity_gap() == 1
    assert TURN_START_PARAMS_ARITY - len(TURN_KEYS) == TURN_ARITY_GAP


def test_attested_tail_is_fully_covered() -> None:
    missing = [n for n in TURN_START_PARAMS_ATTESTED_TAIL if n not in TURN_KEYS]
    assert missing == []
    assert "cyberAccessProgram" in TURN_KEYS


def test_visitor_only_names_are_the_header_candidates() -> None:
    assert TURN_VISITOR_ONLY == ("threadId", "summary", "model", "modelProvider")
    for name in TURN_VISITOR_ONLY:
        assert name in TURN_KEYS


def test_thread_visitor_is_mixed_and_unusable_as_field_list() -> None:
    assert thread_keys_are_mixed() is True
    assert len(THREAD_KEYS) == 43
    assert all(marker in THREAD_KEYS for marker in THREAD_MIXED_MARKERS)
    assert len(THREAD_KEYS) != 27


def test_falsified_methods_after_r68_are_recorded() -> None:
    ids = [method_id for method_id, _why in FALSIFIED_AFTER_R68]
    assert ids == ["widened-record-array", "code-order-literal-run",
                   "dictionary-dp-segmentation", "fragment-table-no-boundary"]


def test_last_name_candidate_is_marked_unverified() -> None:
    assert TURN_LAST_NAME_CANDIDATE == "cwd"
    assert TURN_LAST_NAME_VERIFIED is False
    assert TURN_LAST_NAME_CANDIDATE not in TURN_KEYS


def test_measurements_are_pinned() -> None:
    assert MEASUREMENTS["widened_record_runs"] == 17134
    assert MEASUREMENTS["record_arrays_of_27"] == 1
    assert MEASUREMENTS["record_arrays_of_28"] == 3
    assert MEASUREMENTS["turn_union"] == 27
    assert MEASUREMENTS["thread_visitor_keys"] == 43


def test_validator_passes() -> None:
    validate_visitor_key_evidence()
    ensure_visitor_key_evidence()


def test_validator_rejects_truncated_set() -> None:
    import app.core.struct_visitor_key_evidence as mod

    original = mod.TURN_START_PARAMS_VISITOR_KEYS
    try:
        mod.TURN_START_PARAMS_VISITOR_KEYS = original[:-1]
        with pytest.raises(VisitorKeyEvidenceError):
            validate_visitor_key_evidence()
    finally:
        mod.TURN_START_PARAMS_VISITOR_KEYS = original
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
