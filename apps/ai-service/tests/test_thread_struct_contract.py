# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R62 pytest: thread_struct_contract struct arity contract.

Covers verbatim table, domain classification, reverse lookup, consistency gate,
reverse-mutation guards. Watermark by build.py.
"""

from __future__ import annotations

import pytest

from app.core.thread_struct_contract import (
    THREAD_STRUCT_CONTRACT_DOMAIN,
    THREAD_STRUCT_CONTRACT_ELEMENTS,
    ThreadStructContract,
    ThreadStructContractError,
    ensure_thread_struct_contract,
    expected_thread_struct_contract_element_count,
    is_thread_struct_contract,
    thread_struct_contract_domain,
    thread_struct_contract_domain_members,
    thread_struct_contract_names,
    validate_thread_struct_contract,
)


class TestVerbatimTable:
    def test_table_exact(self) -> None:
        assert THREAD_STRUCT_CONTRACT_ELEMENTS == {"AddAdHocNoteArgs": 2, "AgentMessageContentDeltaEvent": 4, "AgentMessageDeltaNotification": 4, "AgentMessageDisplay": 4, "AgentMessageEvent": 6, "AgentMessageItem": 7, "AgentMessageModeration": 2, "AttachmentThreadsCursor": 4, "AutoReviewMessages": 5, "BoardNotification": 3, "CancelledNotificationParam": 3, "ChatgptThreadTurnCosts": 2, "ChatgptTurnCost": 4, "CodexWorkspaceMessage": 5, "CollabAgentInteractionBeginEvent": 5, "CollabAgentInteractionEndEvent": 8, "CollabAgentSpawnBeginEvent": 6, "CollabAgentSpawnEndEvent": 10, "CollabCloseBeginEvent": 4, "CollabCloseEndEvent": 7, "CollabResumeBeginEvent": 6, "CollabResumeEndEvent": 7, "CollabWaitingBeginEvent": 5, "CollabWaitingEndEvent": 5, "CollaborationModeMessages": 2, "CommandExecOutputDeltaNotification": 4, "CommandExecutionOutputDeltaNotification": 4, "CompactionResumeMetadata": 6, "ConsequentialToolMessageTemplate": 5, "ConsequentialToolMessageTemplatesFile": 2, "ContextCompactedNotification": 2, "DeprecationNoticeEvent": 2, "DeprecationNoticeNotification": 2, "DynamicToolCallResponseEvent": 10, "ElicitationAbandonedEvent": 2, "ElicitationRequestEvent": 4, "EnteredReviewModeEvent": 4, "EnvironmentConnectionNotification": 2, "ErrorEvent": 3, "ErrorNotification": 4, "ExecClosedNotification": 2, "ExecCommandBeginEvent": 11, "ExecCommandEndEvent": 15, "ExecCommandOutputDeltaEvent": 3, "ExecExitedNotification": 4, "ExecOutputDeltaNotification": 4, "ExitedReviewModeEvent": 3, "FileChangeOutputDeltaNotification": 4, "FileChangePatchUpdatedNotification": 4, "FsChangedNotification": 2, "FuzzyFileSearchSessionUpdatedNotification": 3, "GetWorkspaceMessagesResponse": 2, "HistoryCursor": 4, "HistoryEntry": 3, "HistoryPosition": 3, "HookCompletedEvent": 2, "HookCompletedNotification": 3, "HookStartedEvent": 2, "HookStartedNotification": 3, "HttpRequestBodyDeltaNotification": 5, "InterruptedTurn": 5, "ItemCompletedEvent": 6, "ItemCompletedNotification": 5, "ItemStartedEvent": 4, "ItemStartedNotification": 4, "JSONRPCNotification": 2, "ListThreads": 6, "LoggingMessageNotificationParam": 4, "McpServerEventNotification": 2, "McpServerEventStreamNotification": 2, "McpServerEventStreamStartParams": 6, "McpServerStatusUpdatedNotification": 5, "McpStartupCompleteEvent": 3, "McpStartupUpdateEvent": 2, "McpToolCallBeginEvent": 11, "McpToolCallEndEvent": 13, "McpToolCallProgressNotification": 4, "ModelMessages": 14, "ModelRerouteEvent": 3, "ModelReroutedNotification": 5, "ModelSafetyBufferingUpdatedNotification": 7, "ModelVerificationNotification": 3, "MultiAgentMessages": 2, "MultiAgentModeMessages": 3, "MultiAgentRoleMessages": 2, "NewThreadModelDefaults": 3, "PlanDeltaEvent": 4, "PlanDeltaNotification": 4, "PlanLimitHistory": 6, "ProcessExitedNotification": 7, "ProcessOutputDeltaNotification": 4, "ProgressNotificationParam": 5, "ProjectChangedNotification": 2, "PromptMessage": 2, "RawResponseCompletedEvent": 3, "RawResponseCompletedNotification": 5, "RawResponseItemCompletedNotification": 3, "RawTraceEvent": 7, "ReadThread": 4, "RealtimeConversationStartedEvent": 2, "ReasoningContentDeltaEvent": 5, "ReasoningRawContentDeltaEvent": 5, "ReasoningSummaryPartAddedNotification": 4, "ReasoningSummaryTextDeltaNotification": 5, "ReasoningTextDeltaNotification": 5, "RemoteControlStatusChangedNotification": 4, "ResourceUpdatedNotificationParam": 2, "ResponsesStreamEvent": 14, "ReviewOutputEvent": 4, "SafetyBufferingEvent": 5, "SamplingMessage": 3, "SearchCursor": 4, "SendMessageArgs": 2, "ServerRequestResolvedNotification": 2, "SourceMessage": 3, "StoredTurnError": 3, "StreamErrorEvent": 3, "StrictReviewRequiredNotification": 3, "SubAgentActivityEvent": 7, "SubscriptionsAcknowledgedNotificationParams": 2, "TerminalInteractionEvent": 3, "TerminalInteractionNotification": 5, "ThreadAttachment": 5, "ThreadAttachmentAddParams": 4, "ThreadAttachmentAddResponse": 2, "ThreadAttachmentListParams": 3, "ThreadAttachmentListResponse": 2, "ThreadAttachmentOwnerListParams": 5, "ThreadAttachmentRemoveParams": 3, "ThreadAttachmentUpdatedNotification": 5, "ThreadBackgroundTerminal": 7, "ThreadBackgroundTerminalsListParams": 3, "ThreadBackgroundTerminalsListResponse": 2, "ThreadBackgroundTerminalsTerminateParams": 2, "ThreadCompatibility": 33, "ThreadEnvironment": 3, "ThreadForkParams": 23, "ThreadForkResponse": 14, "ThreadInjectItemsParams": 2, "ThreadItemEntry": 5, "ThreadItemsListParams": 6, "ThreadItemsListResponse": 3, "ThreadItemsReadParams": 3, "ThreadListParams": 19, "ThreadListResponse": 4, "ThreadLoadedListParams": 2, "ThreadLoadedListResponse": 2, "ThreadMemoryModeSetParams": 2, "ThreadMetadataUpdateParams": 4, "ThreadNameUpdatedNotification": 2, "ThreadPredictionRequestParams": 2, "ThreadPredictionUpdatedNotification": 3, "ThreadProjectUpdatedNotification": 2, "ThreadQueueAddParams": 4, "ThreadQueueDeleteParams": 2, "ThreadQueueListParams": 3, "ThreadQueueReorderParams": 2, "ThreadQueueStartParams": 2, "ThreadQueueUpdateParams": 4, "ThreadReadParams": 2, "ThreadReadResponse": 2, "ThreadReadState": 2, "ThreadReadStateChangedNotification": 2, "ThreadReadStateUpdateParams": 3, "ThreadRealtimeAudioChunk": 5, "ThreadRealtimeClosedNotification": 2, "ThreadRealtimeErrorNotification": 2, "ThreadRealtimeInitialItem": 2, "ThreadRealtimeItemAddedNotification": 2, "ThreadRealtimeItemCompletedNotification": 2, "ThreadRealtimeItemStartedNotification": 2, "ThreadRealtimeItemTranscriptDeltaNotification": 3, "ThreadRealtimeOutputAudioDeltaNotification": 2, "ThreadRealtimeSdpNotification": 2, "ThreadRealtimeStartParams": 21, "ThreadRealtimeStartedNotification": 3, "ThreadRealtimeTranscriptDeltaNotification": 3, "ThreadRealtimeTranscriptDoneNotification": 3, "ThreadResumeInitialTurnsPageParams": 3, "ThreadResumeParams": 18, "ThreadResumeResponse": 18, "ThreadRevertParams": 2, "ThreadRevertResponse": 3, "ThreadSampleParams": 10, "ThreadSearchOccurrencesParams": 4, "ThreadSearchParams": 9, "ThreadSearchResponse": 3, "ThreadSearchResult": 2, "ThreadSection": 3, "ThreadSectionChangedNotification": 2, "ThreadSectionCreateParams": 2, "ThreadSectionListParams": 2, "ThreadSectionMoveParams": 3, "ThreadSectionUpdateParams": 3, "ThreadSetNameParams": 2, "ThreadShellCommandParams": 3, "ThreadStartParams": 27, "ThreadStartResponse": 14, "ThreadStartedMetadata": 6, "ThreadStatusChangedNotification": 2, "ThreadSummary": 5, "ThreadTimelineListParams": 3, "ThreadTurnsCursor": 2, "ThreadTurnsListParams": 5, "ThreadTurnsListResponse": 3, "TimelineCursor": 4, "TuiChatKeymap": 11, "TurnAbortedEvent": 7, "TurnAttribution": 5, "TurnCompleteEvent": 8, "TurnCompletedNotification": 2, "TurnDiffUpdatedNotification": 3, "TurnEnvironmentParams": 3, "TurnInterruptParams": 2, "TurnModerationMetadataNotification": 3, "TurnPlanStep": 2, "TurnPlanUpdatedNotification": 4, "TurnStartParams": 28, "TurnStartedEvent": 7, "TurnStartedNotification": 2, "TurnSteerParams": 7, "TurnToolOutput": 4, "TurnsPage": 3, "ViewImageToolCallEvent": 2, "WarningNotification": 2, "WebSearchEndEvent": 4, "WindowsSandboxSetupCompletedNotification": 3, "WindowsWorldWritableWarningNotification": 3, "WorkspaceMessage": 5, "WrappedWebsocketErrorEvent": 4}

    def test_closed_set_cardinality(self) -> None:
        assert len(ThreadStructContract) == len(THREAD_STRUCT_CONTRACT_ELEMENTS) == 230

    def test_enum_values_match_table(self) -> None:
        assert {m.value for m in ThreadStructContract} == set(THREAD_STRUCT_CONTRACT_ELEMENTS)

    def test_all_counts_positive_int(self) -> None:
        assert all(isinstance(c, int) and c >= 1 for c in THREAD_STRUCT_CONTRACT_ELEMENTS.values())


class TestDomainClassification:
    def test_domain_covers_all(self) -> None:
        assert set(THREAD_STRUCT_CONTRACT_DOMAIN) == set(THREAD_STRUCT_CONTRACT_ELEMENTS)

    @pytest.mark.parametrize("name,expected", [('AgentMessageItem', 'content'), ('CompactionResumeMetadata', 'descriptor'), ('AgentMessageDisplay', 'domain_object'), ('StoredTurnError', 'error'), ('AgentMessageContentDeltaEvent', 'notification'), ('AddAdHocNoteArgs', 'request_params'), ('GetWorkspaceMessagesResponse', 'response')])
    def test_domain(self, name, expected) -> None:
        assert thread_struct_contract_domain(name) == expected

    def test_domain_rejects_unregistered(self) -> None:
        with pytest.raises(ThreadStructContractError):
            thread_struct_contract_domain("bogus")

    def test_domain_members_partition(self) -> None:
        seen = []
        for domain in set(THREAD_STRUCT_CONTRACT_DOMAIN.values()):
            seen.extend(thread_struct_contract_domain_members(domain))
        assert sorted(seen) == sorted(THREAD_STRUCT_CONTRACT_ELEMENTS)
        assert len(seen) == len(set(seen))

    def test_domain_members_rejects_unknown_domain(self) -> None:
        with pytest.raises(ThreadStructContractError):
            thread_struct_contract_domain_members("bogus_domain")


class TestMembershipAndCopy:
    def test_is_fn_true_for_all(self) -> None:
        assert all(is_thread_struct_contract(nm) for nm in THREAD_STRUCT_CONTRACT_ELEMENTS)

    def test_is_fn_false_case_sensitive(self) -> None:
        first = "AddAdHocNoteArgs"
        assert first in THREAD_STRUCT_CONTRACT_ELEMENTS
        assert not is_thread_struct_contract(first.lower())
        assert not is_thread_struct_contract("bogus")

    def test_names_returns_copy(self) -> None:
        a = thread_struct_contract_names()
        a.append("bogus")
        assert "bogus" not in THREAD_STRUCT_CONTRACT_ELEMENTS
        assert set(thread_struct_contract_names()) == set(THREAD_STRUCT_CONTRACT_ELEMENTS)

    def test_members_returns_immutable(self) -> None:
        domain = next(iter(set(THREAD_STRUCT_CONTRACT_DOMAIN.values())))
        assert isinstance(thread_struct_contract_domain_members(domain), tuple)


class TestConsistencyGate:
    @pytest.mark.parametrize("name,count", THREAD_STRUCT_CONTRACT_ELEMENTS.items())
    def test_validate_ok(self, name, count) -> None:
        assert validate_thread_struct_contract(name, count) == name

    @pytest.mark.parametrize("name,count", THREAD_STRUCT_CONTRACT_ELEMENTS.items())
    def test_validate_rejects_wrong_count(self, name, count) -> None:
        with pytest.raises(ThreadStructContractError, match="元素数应为"):
            validate_thread_struct_contract(name, count + 1)

    def test_ensure_rejects_unregistered(self) -> None:
        with pytest.raises(ThreadStructContractError):
            ensure_thread_struct_contract("bogus")

    def test_count_rejects_unregistered(self) -> None:
        with pytest.raises(ThreadStructContractError):
            expected_thread_struct_contract_element_count("bogus")


class TestReverseMutation:
    def test_verbatim_wire_names_case_sensitive(self) -> None:
        for nm in ("AddAdHocNoteArgs", "AgentMessageContentDeltaEvent"):
            assert nm in THREAD_STRUCT_CONTRACT_ELEMENTS
            assert nm.lower() not in THREAD_STRUCT_CONTRACT_ELEMENTS

    def test_element_counts_pinned(self) -> None:
        assert set(THREAD_STRUCT_CONTRACT_ELEMENTS.values()) == {2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14, 15, 18, 19, 21, 23, 27, 28, 33}
