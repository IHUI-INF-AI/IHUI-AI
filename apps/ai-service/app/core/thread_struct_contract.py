# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""结构元数契约（ThreadStructContract，230 struct / 7 角色域） —— 统一工程规范 R62（结构元数契约·serde with-N-elements）。

取证（codex.exe 26.1111.2228.0，365MB Rust PE，strings 逐字 + ``struct variant X::Y with N element``
机器反推，见 R58 ``families.out`` / 本轮 ``docs/engineering/round11-reverse/R61-*.md``）：逐字 struct 名与
元素数表由机器从二进制抽取，模块内表与单测双重钉死。本仓归属过滤：该族在本仓 app/core 零命中或仅异层别名。

一轴超越：230 个 codex struct 的逐字元素数（serde `with N elements` 硬断言）+ 7 类结构角色域（Params/Response/Notification/Toml/…）+ 可执行反查。元素数取自身 serde 生成元信息，非人工推断；角色域由结构名后缀确定性归类，与元素数正交。本仓归属过滤：本域结构名在 app/core 零命中；22 个多元素数冲突结构已排除。

诚实边界：230 个 struct 名与元素数逐字确证（单值一致）；角色域分类是本仓后缀归类非对照原生判据；各 struct 的具体字段名因 camelCase 连体串不可可靠切分，已另立 disasm 开放轴。
"""

from __future__ import annotations

from enum import StrEnum
from typing import Final

__all__ = [
    "ThreadStructContract", "ThreadStructContractError", "THREAD_STRUCT_CONTRACT_ELEMENTS", "THREAD_STRUCT_CONTRACT_DOMAIN", "thread_struct_contract_names", "expected_thread_struct_contract_element_count",
    "ensure_thread_struct_contract", "thread_struct_contract_domain", "thread_struct_contract_domain_members", "is_thread_struct_contract", "validate_thread_struct_contract",
]

# 逐字 struct 名 → 元素数（serde 硬断言）（来自 ``with N element`` 声明，漂移由 pytest 钉死）。
THREAD_STRUCT_CONTRACT_ELEMENTS: Final[dict[str, int]] = {
    "AddAdHocNoteArgs": 2,
    "AgentMessageContentDeltaEvent": 4,
    "AgentMessageDeltaNotification": 4,
    "AgentMessageDisplay": 4,
    "AgentMessageEvent": 6,
    "AgentMessageItem": 7,
    "AgentMessageModeration": 2,
    "AttachmentThreadsCursor": 4,
    "AutoReviewMessages": 5,
    "BoardNotification": 3,
    "CancelledNotificationParam": 3,
    "ChatgptThreadTurnCosts": 2,
    "ChatgptTurnCost": 4,
    "CodexWorkspaceMessage": 5,
    "CollabAgentInteractionBeginEvent": 5,
    "CollabAgentInteractionEndEvent": 8,
    "CollabAgentSpawnBeginEvent": 6,
    "CollabAgentSpawnEndEvent": 10,
    "CollabCloseBeginEvent": 4,
    "CollabCloseEndEvent": 7,
    "CollabResumeBeginEvent": 6,
    "CollabResumeEndEvent": 7,
    "CollabWaitingBeginEvent": 5,
    "CollabWaitingEndEvent": 5,
    "CollaborationModeMessages": 2,
    "CommandExecOutputDeltaNotification": 4,
    "CommandExecutionOutputDeltaNotification": 4,
    "CompactionResumeMetadata": 6,
    "ConsequentialToolMessageTemplate": 5,
    "ConsequentialToolMessageTemplatesFile": 2,
    "ContextCompactedNotification": 2,
    "DeprecationNoticeEvent": 2,
    "DeprecationNoticeNotification": 2,
    "DynamicToolCallResponseEvent": 10,
    "ElicitationAbandonedEvent": 2,
    "ElicitationRequestEvent": 4,
    "EnteredReviewModeEvent": 4,
    "EnvironmentConnectionNotification": 2,
    "ErrorEvent": 3,
    "ErrorNotification": 4,
    "ExecClosedNotification": 2,
    "ExecCommandBeginEvent": 11,
    "ExecCommandEndEvent": 15,
    "ExecCommandOutputDeltaEvent": 3,
    "ExecExitedNotification": 4,
    "ExecOutputDeltaNotification": 4,
    "ExitedReviewModeEvent": 3,
    "FileChangeOutputDeltaNotification": 4,
    "FileChangePatchUpdatedNotification": 4,
    "FsChangedNotification": 2,
    "FuzzyFileSearchSessionUpdatedNotification": 3,
    "GetWorkspaceMessagesResponse": 2,
    "HistoryCursor": 4,
    "HistoryEntry": 3,
    "HistoryPosition": 3,
    "HookCompletedEvent": 2,
    "HookCompletedNotification": 3,
    "HookStartedEvent": 2,
    "HookStartedNotification": 3,
    "HttpRequestBodyDeltaNotification": 5,
    "InterruptedTurn": 5,
    "ItemCompletedEvent": 6,
    "ItemCompletedNotification": 5,
    "ItemStartedEvent": 4,
    "ItemStartedNotification": 4,
    "JSONRPCNotification": 2,
    "ListThreads": 6,
    "LoggingMessageNotificationParam": 4,
    "McpServerEventNotification": 2,
    "McpServerEventStreamNotification": 2,
    "McpServerEventStreamStartParams": 6,
    "McpServerStatusUpdatedNotification": 5,
    "McpStartupCompleteEvent": 3,
    "McpStartupUpdateEvent": 2,
    "McpToolCallBeginEvent": 11,
    "McpToolCallEndEvent": 13,
    "McpToolCallProgressNotification": 4,
    "ModelMessages": 14,
    "ModelRerouteEvent": 3,
    "ModelReroutedNotification": 5,
    "ModelSafetyBufferingUpdatedNotification": 7,
    "ModelVerificationNotification": 3,
    "MultiAgentMessages": 2,
    "MultiAgentModeMessages": 3,
    "MultiAgentRoleMessages": 2,
    "NewThreadModelDefaults": 3,
    "PlanDeltaEvent": 4,
    "PlanDeltaNotification": 4,
    "PlanLimitHistory": 6,
    "ProcessExitedNotification": 7,
    "ProcessOutputDeltaNotification": 4,
    "ProgressNotificationParam": 5,
    "ProjectChangedNotification": 2,
    "PromptMessage": 2,
    "RawResponseCompletedEvent": 3,
    "RawResponseCompletedNotification": 5,
    "RawResponseItemCompletedNotification": 3,
    "RawTraceEvent": 7,
    "ReadThread": 4,
    "RealtimeConversationStartedEvent": 2,
    "ReasoningContentDeltaEvent": 5,
    "ReasoningRawContentDeltaEvent": 5,
    "ReasoningSummaryPartAddedNotification": 4,
    "ReasoningSummaryTextDeltaNotification": 5,
    "ReasoningTextDeltaNotification": 5,
    "RemoteControlStatusChangedNotification": 4,
    "ResourceUpdatedNotificationParam": 2,
    "ResponsesStreamEvent": 14,
    "ReviewOutputEvent": 4,
    "SafetyBufferingEvent": 5,
    "SamplingMessage": 3,
    "SearchCursor": 4,
    "SendMessageArgs": 2,
    "ServerRequestResolvedNotification": 2,
    "SourceMessage": 3,
    "StoredTurnError": 3,
    "StreamErrorEvent": 3,
    "StrictReviewRequiredNotification": 3,
    "SubAgentActivityEvent": 7,
    "SubscriptionsAcknowledgedNotificationParams": 2,
    "TerminalInteractionEvent": 3,
    "TerminalInteractionNotification": 5,
    "ThreadAttachment": 5,
    "ThreadAttachmentAddParams": 4,
    "ThreadAttachmentAddResponse": 2,
    "ThreadAttachmentListParams": 3,
    "ThreadAttachmentListResponse": 2,
    "ThreadAttachmentOwnerListParams": 5,
    "ThreadAttachmentRemoveParams": 3,
    "ThreadAttachmentUpdatedNotification": 5,
    "ThreadBackgroundTerminal": 7,
    "ThreadBackgroundTerminalsListParams": 3,
    "ThreadBackgroundTerminalsListResponse": 2,
    "ThreadBackgroundTerminalsTerminateParams": 2,
    "ThreadCompatibility": 33,
    "ThreadEnvironment": 3,
    "ThreadForkParams": 23,
    "ThreadForkResponse": 14,
    "ThreadInjectItemsParams": 2,
    "ThreadItemEntry": 5,
    "ThreadItemsListParams": 6,
    "ThreadItemsListResponse": 3,
    "ThreadItemsReadParams": 3,
    "ThreadListParams": 19,
    "ThreadListResponse": 4,
    "ThreadLoadedListParams": 2,
    "ThreadLoadedListResponse": 2,
    "ThreadMemoryModeSetParams": 2,
    "ThreadMetadataUpdateParams": 4,
    "ThreadNameUpdatedNotification": 2,
    "ThreadPredictionRequestParams": 2,
    "ThreadPredictionUpdatedNotification": 3,
    "ThreadProjectUpdatedNotification": 2,
    "ThreadQueueAddParams": 4,
    "ThreadQueueDeleteParams": 2,
    "ThreadQueueListParams": 3,
    "ThreadQueueReorderParams": 2,
    "ThreadQueueStartParams": 2,
    "ThreadQueueUpdateParams": 4,
    "ThreadReadParams": 2,
    "ThreadReadResponse": 2,
    "ThreadReadState": 2,
    "ThreadReadStateChangedNotification": 2,
    "ThreadReadStateUpdateParams": 3,
    "ThreadRealtimeAudioChunk": 5,
    "ThreadRealtimeClosedNotification": 2,
    "ThreadRealtimeErrorNotification": 2,
    "ThreadRealtimeInitialItem": 2,
    "ThreadRealtimeItemAddedNotification": 2,
    "ThreadRealtimeItemCompletedNotification": 2,
    "ThreadRealtimeItemStartedNotification": 2,
    "ThreadRealtimeItemTranscriptDeltaNotification": 3,
    "ThreadRealtimeOutputAudioDeltaNotification": 2,
    "ThreadRealtimeSdpNotification": 2,
    "ThreadRealtimeStartParams": 21,
    "ThreadRealtimeStartedNotification": 3,
    "ThreadRealtimeTranscriptDeltaNotification": 3,
    "ThreadRealtimeTranscriptDoneNotification": 3,
    "ThreadResumeInitialTurnsPageParams": 3,
    "ThreadResumeParams": 18,
    "ThreadResumeResponse": 18,
    "ThreadRevertParams": 2,
    "ThreadRevertResponse": 3,
    "ThreadSampleParams": 10,
    "ThreadSearchOccurrencesParams": 4,
    "ThreadSearchParams": 9,
    "ThreadSearchResponse": 3,
    "ThreadSearchResult": 2,
    "ThreadSection": 3,
    "ThreadSectionChangedNotification": 2,
    "ThreadSectionCreateParams": 2,
    "ThreadSectionListParams": 2,
    "ThreadSectionMoveParams": 3,
    "ThreadSectionUpdateParams": 3,
    "ThreadSetNameParams": 2,
    "ThreadShellCommandParams": 3,
    "ThreadStartParams": 27,
    "ThreadStartResponse": 14,
    "ThreadStartedMetadata": 6,
    "ThreadStatusChangedNotification": 2,
    "ThreadSummary": 5,
    "ThreadTimelineListParams": 3,
    "ThreadTurnsCursor": 2,
    "ThreadTurnsListParams": 5,
    "ThreadTurnsListResponse": 3,
    "TimelineCursor": 4,
    "TuiChatKeymap": 11,
    "TurnAbortedEvent": 7,
    "TurnAttribution": 5,
    "TurnCompleteEvent": 8,
    "TurnCompletedNotification": 2,
    "TurnDiffUpdatedNotification": 3,
    "TurnEnvironmentParams": 3,
    "TurnInterruptParams": 2,
    "TurnModerationMetadataNotification": 3,
    "TurnPlanStep": 2,
    "TurnPlanUpdatedNotification": 4,
    "TurnStartParams": 28,
    "TurnStartedEvent": 7,
    "TurnStartedNotification": 2,
    "TurnSteerParams": 7,
    "TurnToolOutput": 4,
    "TurnsPage": 3,
    "ViewImageToolCallEvent": 2,
    "WarningNotification": 2,
    "WebSearchEndEvent": 4,
    "WindowsSandboxSetupCompletedNotification": 3,
    "WindowsWorldWritableWarningNotification": 3,
    "WorkspaceMessage": 5,
    "WrappedWebsocketErrorEvent": 4,

}

# 本仓语义归类（非对照原生判据）：每个 variant 归入一个协议面域。
THREAD_STRUCT_CONTRACT_DOMAIN: Final[dict[str, str]] = {
    "AddAdHocNoteArgs": "request_params",
    "AgentMessageContentDeltaEvent": "notification",
    "AgentMessageDeltaNotification": "notification",
    "AgentMessageDisplay": "domain_object",
    "AgentMessageEvent": "notification",
    "AgentMessageItem": "content",
    "AgentMessageModeration": "domain_object",
    "AttachmentThreadsCursor": "domain_object",
    "AutoReviewMessages": "domain_object",
    "BoardNotification": "notification",
    "CancelledNotificationParam": "domain_object",
    "ChatgptThreadTurnCosts": "domain_object",
    "ChatgptTurnCost": "domain_object",
    "CodexWorkspaceMessage": "content",
    "CollabAgentInteractionBeginEvent": "notification",
    "CollabAgentInteractionEndEvent": "notification",
    "CollabAgentSpawnBeginEvent": "notification",
    "CollabAgentSpawnEndEvent": "notification",
    "CollabCloseBeginEvent": "notification",
    "CollabCloseEndEvent": "notification",
    "CollabResumeBeginEvent": "notification",
    "CollabResumeEndEvent": "notification",
    "CollabWaitingBeginEvent": "notification",
    "CollabWaitingEndEvent": "notification",
    "CollaborationModeMessages": "domain_object",
    "CommandExecOutputDeltaNotification": "notification",
    "CommandExecutionOutputDeltaNotification": "notification",
    "CompactionResumeMetadata": "descriptor",
    "ConsequentialToolMessageTemplate": "domain_object",
    "ConsequentialToolMessageTemplatesFile": "domain_object",
    "ContextCompactedNotification": "notification",
    "DeprecationNoticeEvent": "notification",
    "DeprecationNoticeNotification": "notification",
    "DynamicToolCallResponseEvent": "notification",
    "ElicitationAbandonedEvent": "notification",
    "ElicitationRequestEvent": "notification",
    "EnteredReviewModeEvent": "notification",
    "EnvironmentConnectionNotification": "notification",
    "ErrorEvent": "notification",
    "ErrorNotification": "notification",
    "ExecClosedNotification": "notification",
    "ExecCommandBeginEvent": "notification",
    "ExecCommandEndEvent": "notification",
    "ExecCommandOutputDeltaEvent": "notification",
    "ExecExitedNotification": "notification",
    "ExecOutputDeltaNotification": "notification",
    "ExitedReviewModeEvent": "notification",
    "FileChangeOutputDeltaNotification": "notification",
    "FileChangePatchUpdatedNotification": "notification",
    "FsChangedNotification": "notification",
    "FuzzyFileSearchSessionUpdatedNotification": "notification",
    "GetWorkspaceMessagesResponse": "response",
    "HistoryCursor": "domain_object",
    "HistoryEntry": "descriptor",
    "HistoryPosition": "domain_object",
    "HookCompletedEvent": "notification",
    "HookCompletedNotification": "notification",
    "HookStartedEvent": "notification",
    "HookStartedNotification": "notification",
    "HttpRequestBodyDeltaNotification": "notification",
    "InterruptedTurn": "domain_object",
    "ItemCompletedEvent": "notification",
    "ItemCompletedNotification": "notification",
    "ItemStartedEvent": "notification",
    "ItemStartedNotification": "notification",
    "JSONRPCNotification": "notification",
    "ListThreads": "domain_object",
    "LoggingMessageNotificationParam": "domain_object",
    "McpServerEventNotification": "notification",
    "McpServerEventStreamNotification": "notification",
    "McpServerEventStreamStartParams": "request_params",
    "McpServerStatusUpdatedNotification": "notification",
    "McpStartupCompleteEvent": "notification",
    "McpStartupUpdateEvent": "notification",
    "McpToolCallBeginEvent": "notification",
    "McpToolCallEndEvent": "notification",
    "McpToolCallProgressNotification": "notification",
    "ModelMessages": "domain_object",
    "ModelRerouteEvent": "notification",
    "ModelReroutedNotification": "notification",
    "ModelSafetyBufferingUpdatedNotification": "notification",
    "ModelVerificationNotification": "notification",
    "MultiAgentMessages": "domain_object",
    "MultiAgentModeMessages": "domain_object",
    "MultiAgentRoleMessages": "domain_object",
    "NewThreadModelDefaults": "domain_object",
    "PlanDeltaEvent": "notification",
    "PlanDeltaNotification": "notification",
    "PlanLimitHistory": "domain_object",
    "ProcessExitedNotification": "notification",
    "ProcessOutputDeltaNotification": "notification",
    "ProgressNotificationParam": "domain_object",
    "ProjectChangedNotification": "notification",
    "PromptMessage": "content",
    "RawResponseCompletedEvent": "notification",
    "RawResponseCompletedNotification": "notification",
    "RawResponseItemCompletedNotification": "notification",
    "RawTraceEvent": "notification",
    "ReadThread": "domain_object",
    "RealtimeConversationStartedEvent": "notification",
    "ReasoningContentDeltaEvent": "notification",
    "ReasoningRawContentDeltaEvent": "notification",
    "ReasoningSummaryPartAddedNotification": "notification",
    "ReasoningSummaryTextDeltaNotification": "notification",
    "ReasoningTextDeltaNotification": "notification",
    "RemoteControlStatusChangedNotification": "notification",
    "ResourceUpdatedNotificationParam": "domain_object",
    "ResponsesStreamEvent": "notification",
    "ReviewOutputEvent": "notification",
    "SafetyBufferingEvent": "notification",
    "SamplingMessage": "content",
    "SearchCursor": "domain_object",
    "SendMessageArgs": "request_params",
    "ServerRequestResolvedNotification": "notification",
    "SourceMessage": "content",
    "StoredTurnError": "error",
    "StreamErrorEvent": "notification",
    "StrictReviewRequiredNotification": "notification",
    "SubAgentActivityEvent": "notification",
    "SubscriptionsAcknowledgedNotificationParams": "request_params",
    "TerminalInteractionEvent": "notification",
    "TerminalInteractionNotification": "notification",
    "ThreadAttachment": "domain_object",
    "ThreadAttachmentAddParams": "request_params",
    "ThreadAttachmentAddResponse": "response",
    "ThreadAttachmentListParams": "request_params",
    "ThreadAttachmentListResponse": "response",
    "ThreadAttachmentOwnerListParams": "request_params",
    "ThreadAttachmentRemoveParams": "request_params",
    "ThreadAttachmentUpdatedNotification": "notification",
    "ThreadBackgroundTerminal": "domain_object",
    "ThreadBackgroundTerminalsListParams": "request_params",
    "ThreadBackgroundTerminalsListResponse": "response",
    "ThreadBackgroundTerminalsTerminateParams": "request_params",
    "ThreadCompatibility": "domain_object",
    "ThreadEnvironment": "domain_object",
    "ThreadForkParams": "request_params",
    "ThreadForkResponse": "response",
    "ThreadInjectItemsParams": "request_params",
    "ThreadItemEntry": "descriptor",
    "ThreadItemsListParams": "request_params",
    "ThreadItemsListResponse": "response",
    "ThreadItemsReadParams": "request_params",
    "ThreadListParams": "request_params",
    "ThreadListResponse": "response",
    "ThreadLoadedListParams": "request_params",
    "ThreadLoadedListResponse": "response",
    "ThreadMemoryModeSetParams": "request_params",
    "ThreadMetadataUpdateParams": "request_params",
    "ThreadNameUpdatedNotification": "notification",
    "ThreadPredictionRequestParams": "request_params",
    "ThreadPredictionUpdatedNotification": "notification",
    "ThreadProjectUpdatedNotification": "notification",
    "ThreadQueueAddParams": "request_params",
    "ThreadQueueDeleteParams": "request_params",
    "ThreadQueueListParams": "request_params",
    "ThreadQueueReorderParams": "request_params",
    "ThreadQueueStartParams": "request_params",
    "ThreadQueueUpdateParams": "request_params",
    "ThreadReadParams": "request_params",
    "ThreadReadResponse": "response",
    "ThreadReadState": "descriptor",
    "ThreadReadStateChangedNotification": "notification",
    "ThreadReadStateUpdateParams": "request_params",
    "ThreadRealtimeAudioChunk": "domain_object",
    "ThreadRealtimeClosedNotification": "notification",
    "ThreadRealtimeErrorNotification": "notification",
    "ThreadRealtimeInitialItem": "content",
    "ThreadRealtimeItemAddedNotification": "notification",
    "ThreadRealtimeItemCompletedNotification": "notification",
    "ThreadRealtimeItemStartedNotification": "notification",
    "ThreadRealtimeItemTranscriptDeltaNotification": "notification",
    "ThreadRealtimeOutputAudioDeltaNotification": "notification",
    "ThreadRealtimeSdpNotification": "notification",
    "ThreadRealtimeStartParams": "request_params",
    "ThreadRealtimeStartedNotification": "notification",
    "ThreadRealtimeTranscriptDeltaNotification": "notification",
    "ThreadRealtimeTranscriptDoneNotification": "notification",
    "ThreadResumeInitialTurnsPageParams": "request_params",
    "ThreadResumeParams": "request_params",
    "ThreadResumeResponse": "response",
    "ThreadRevertParams": "request_params",
    "ThreadRevertResponse": "response",
    "ThreadSampleParams": "request_params",
    "ThreadSearchOccurrencesParams": "request_params",
    "ThreadSearchParams": "request_params",
    "ThreadSearchResponse": "response",
    "ThreadSearchResult": "response",
    "ThreadSection": "domain_object",
    "ThreadSectionChangedNotification": "notification",
    "ThreadSectionCreateParams": "request_params",
    "ThreadSectionListParams": "request_params",
    "ThreadSectionMoveParams": "request_params",
    "ThreadSectionUpdateParams": "request_params",
    "ThreadSetNameParams": "request_params",
    "ThreadShellCommandParams": "request_params",
    "ThreadStartParams": "request_params",
    "ThreadStartResponse": "response",
    "ThreadStartedMetadata": "descriptor",
    "ThreadStatusChangedNotification": "notification",
    "ThreadSummary": "descriptor",
    "ThreadTimelineListParams": "request_params",
    "ThreadTurnsCursor": "domain_object",
    "ThreadTurnsListParams": "request_params",
    "ThreadTurnsListResponse": "response",
    "TimelineCursor": "domain_object",
    "TuiChatKeymap": "domain_object",
    "TurnAbortedEvent": "notification",
    "TurnAttribution": "domain_object",
    "TurnCompleteEvent": "notification",
    "TurnCompletedNotification": "notification",
    "TurnDiffUpdatedNotification": "notification",
    "TurnEnvironmentParams": "request_params",
    "TurnInterruptParams": "request_params",
    "TurnModerationMetadataNotification": "notification",
    "TurnPlanStep": "domain_object",
    "TurnPlanUpdatedNotification": "notification",
    "TurnStartParams": "request_params",
    "TurnStartedEvent": "notification",
    "TurnStartedNotification": "notification",
    "TurnSteerParams": "request_params",
    "TurnToolOutput": "domain_object",
    "TurnsPage": "domain_object",
    "ViewImageToolCallEvent": "notification",
    "WarningNotification": "notification",
    "WebSearchEndEvent": "notification",
    "WindowsSandboxSetupCompletedNotification": "notification",
    "WindowsWorldWritableWarningNotification": "notification",
    "WorkspaceMessage": "content",
    "WrappedWebsocketErrorEvent": "notification",

}

_CLOSED_SET: Final[frozenset[str]] = frozenset(THREAD_STRUCT_CONTRACT_ELEMENTS)


class ThreadStructContract(StrEnum):
    """对照协议面 variant（逐字登记，真相源）。"""

    ADD_AD_HOC_NOTE_ARGS = "AddAdHocNoteArgs"
    AGENT_MESSAGE_CONTENT_DELTA_EVENT = "AgentMessageContentDeltaEvent"
    AGENT_MESSAGE_DELTA_NOTIFICATION = "AgentMessageDeltaNotification"
    AGENT_MESSAGE_DISPLAY = "AgentMessageDisplay"
    AGENT_MESSAGE_EVENT = "AgentMessageEvent"
    AGENT_MESSAGE_ITEM = "AgentMessageItem"
    AGENT_MESSAGE_MODERATION = "AgentMessageModeration"
    ATTACHMENT_THREADS_CURSOR = "AttachmentThreadsCursor"
    AUTO_REVIEW_MESSAGES = "AutoReviewMessages"
    BOARD_NOTIFICATION = "BoardNotification"
    CANCELLED_NOTIFICATION_PARAM = "CancelledNotificationParam"
    CHATGPT_THREAD_TURN_COSTS = "ChatgptThreadTurnCosts"
    CHATGPT_TURN_COST = "ChatgptTurnCost"
    CODEX_WORKSPACE_MESSAGE = "CodexWorkspaceMessage"
    COLLAB_AGENT_INTERACTION_BEGIN_EVENT = "CollabAgentInteractionBeginEvent"
    COLLAB_AGENT_INTERACTION_END_EVENT = "CollabAgentInteractionEndEvent"
    COLLAB_AGENT_SPAWN_BEGIN_EVENT = "CollabAgentSpawnBeginEvent"
    COLLAB_AGENT_SPAWN_END_EVENT = "CollabAgentSpawnEndEvent"
    COLLAB_CLOSE_BEGIN_EVENT = "CollabCloseBeginEvent"
    COLLAB_CLOSE_END_EVENT = "CollabCloseEndEvent"
    COLLAB_RESUME_BEGIN_EVENT = "CollabResumeBeginEvent"
    COLLAB_RESUME_END_EVENT = "CollabResumeEndEvent"
    COLLAB_WAITING_BEGIN_EVENT = "CollabWaitingBeginEvent"
    COLLAB_WAITING_END_EVENT = "CollabWaitingEndEvent"
    COLLABORATION_MODE_MESSAGES = "CollaborationModeMessages"
    COMMAND_EXEC_OUTPUT_DELTA_NOTIFICATION = "CommandExecOutputDeltaNotification"
    COMMAND_EXECUTION_OUTPUT_DELTA_NOTIFICATION = "CommandExecutionOutputDeltaNotification"
    COMPACTION_RESUME_METADATA = "CompactionResumeMetadata"
    CONSEQUENTIAL_TOOL_MESSAGE_TEMPLATE = "ConsequentialToolMessageTemplate"
    CONSEQUENTIAL_TOOL_MESSAGE_TEMPLATES_FILE = "ConsequentialToolMessageTemplatesFile"
    CONTEXT_COMPACTED_NOTIFICATION = "ContextCompactedNotification"
    DEPRECATION_NOTICE_EVENT = "DeprecationNoticeEvent"
    DEPRECATION_NOTICE_NOTIFICATION = "DeprecationNoticeNotification"
    DYNAMIC_TOOL_CALL_RESPONSE_EVENT = "DynamicToolCallResponseEvent"
    ELICITATION_ABANDONED_EVENT = "ElicitationAbandonedEvent"
    ELICITATION_REQUEST_EVENT = "ElicitationRequestEvent"
    ENTERED_REVIEW_MODE_EVENT = "EnteredReviewModeEvent"
    ENVIRONMENT_CONNECTION_NOTIFICATION = "EnvironmentConnectionNotification"
    ERROR_EVENT = "ErrorEvent"
    ERROR_NOTIFICATION = "ErrorNotification"
    EXEC_CLOSED_NOTIFICATION = "ExecClosedNotification"
    EXEC_COMMAND_BEGIN_EVENT = "ExecCommandBeginEvent"
    EXEC_COMMAND_END_EVENT = "ExecCommandEndEvent"
    EXEC_COMMAND_OUTPUT_DELTA_EVENT = "ExecCommandOutputDeltaEvent"
    EXEC_EXITED_NOTIFICATION = "ExecExitedNotification"
    EXEC_OUTPUT_DELTA_NOTIFICATION = "ExecOutputDeltaNotification"
    EXITED_REVIEW_MODE_EVENT = "ExitedReviewModeEvent"
    FILE_CHANGE_OUTPUT_DELTA_NOTIFICATION = "FileChangeOutputDeltaNotification"
    FILE_CHANGE_PATCH_UPDATED_NOTIFICATION = "FileChangePatchUpdatedNotification"
    FS_CHANGED_NOTIFICATION = "FsChangedNotification"
    FUZZY_FILE_SEARCH_SESSION_UPDATED_NOTIFICATION = "FuzzyFileSearchSessionUpdatedNotification"
    GET_WORKSPACE_MESSAGES_RESPONSE = "GetWorkspaceMessagesResponse"
    HISTORY_CURSOR = "HistoryCursor"
    HISTORY_ENTRY = "HistoryEntry"
    HISTORY_POSITION = "HistoryPosition"
    HOOK_COMPLETED_EVENT = "HookCompletedEvent"
    HOOK_COMPLETED_NOTIFICATION = "HookCompletedNotification"
    HOOK_STARTED_EVENT = "HookStartedEvent"
    HOOK_STARTED_NOTIFICATION = "HookStartedNotification"
    HTTP_REQUEST_BODY_DELTA_NOTIFICATION = "HttpRequestBodyDeltaNotification"
    INTERRUPTED_TURN = "InterruptedTurn"
    ITEM_COMPLETED_EVENT = "ItemCompletedEvent"
    ITEM_COMPLETED_NOTIFICATION = "ItemCompletedNotification"
    ITEM_STARTED_EVENT = "ItemStartedEvent"
    ITEM_STARTED_NOTIFICATION = "ItemStartedNotification"
    J_S_O_N_R_P_C_NOTIFICATION = "JSONRPCNotification"
    LIST_THREADS = "ListThreads"
    LOGGING_MESSAGE_NOTIFICATION_PARAM = "LoggingMessageNotificationParam"
    MCP_SERVER_EVENT_NOTIFICATION = "McpServerEventNotification"
    MCP_SERVER_EVENT_STREAM_NOTIFICATION = "McpServerEventStreamNotification"
    MCP_SERVER_EVENT_STREAM_START_PARAMS = "McpServerEventStreamStartParams"
    MCP_SERVER_STATUS_UPDATED_NOTIFICATION = "McpServerStatusUpdatedNotification"
    MCP_STARTUP_COMPLETE_EVENT = "McpStartupCompleteEvent"
    MCP_STARTUP_UPDATE_EVENT = "McpStartupUpdateEvent"
    MCP_TOOL_CALL_BEGIN_EVENT = "McpToolCallBeginEvent"
    MCP_TOOL_CALL_END_EVENT = "McpToolCallEndEvent"
    MCP_TOOL_CALL_PROGRESS_NOTIFICATION = "McpToolCallProgressNotification"
    MODEL_MESSAGES = "ModelMessages"
    MODEL_REROUTE_EVENT = "ModelRerouteEvent"
    MODEL_REROUTED_NOTIFICATION = "ModelReroutedNotification"
    MODEL_SAFETY_BUFFERING_UPDATED_NOTIFICATION = "ModelSafetyBufferingUpdatedNotification"
    MODEL_VERIFICATION_NOTIFICATION = "ModelVerificationNotification"
    MULTI_AGENT_MESSAGES = "MultiAgentMessages"
    MULTI_AGENT_MODE_MESSAGES = "MultiAgentModeMessages"
    MULTI_AGENT_ROLE_MESSAGES = "MultiAgentRoleMessages"
    NEW_THREAD_MODEL_DEFAULTS = "NewThreadModelDefaults"
    PLAN_DELTA_EVENT = "PlanDeltaEvent"
    PLAN_DELTA_NOTIFICATION = "PlanDeltaNotification"
    PLAN_LIMIT_HISTORY = "PlanLimitHistory"
    PROCESS_EXITED_NOTIFICATION = "ProcessExitedNotification"
    PROCESS_OUTPUT_DELTA_NOTIFICATION = "ProcessOutputDeltaNotification"
    PROGRESS_NOTIFICATION_PARAM = "ProgressNotificationParam"
    PROJECT_CHANGED_NOTIFICATION = "ProjectChangedNotification"
    PROMPT_MESSAGE = "PromptMessage"
    RAW_RESPONSE_COMPLETED_EVENT = "RawResponseCompletedEvent"
    RAW_RESPONSE_COMPLETED_NOTIFICATION = "RawResponseCompletedNotification"
    RAW_RESPONSE_ITEM_COMPLETED_NOTIFICATION = "RawResponseItemCompletedNotification"
    RAW_TRACE_EVENT = "RawTraceEvent"
    READ_THREAD = "ReadThread"
    REALTIME_CONVERSATION_STARTED_EVENT = "RealtimeConversationStartedEvent"
    REASONING_CONTENT_DELTA_EVENT = "ReasoningContentDeltaEvent"
    REASONING_RAW_CONTENT_DELTA_EVENT = "ReasoningRawContentDeltaEvent"
    REASONING_SUMMARY_PART_ADDED_NOTIFICATION = "ReasoningSummaryPartAddedNotification"
    REASONING_SUMMARY_TEXT_DELTA_NOTIFICATION = "ReasoningSummaryTextDeltaNotification"
    REASONING_TEXT_DELTA_NOTIFICATION = "ReasoningTextDeltaNotification"
    REMOTE_CONTROL_STATUS_CHANGED_NOTIFICATION = "RemoteControlStatusChangedNotification"
    RESOURCE_UPDATED_NOTIFICATION_PARAM = "ResourceUpdatedNotificationParam"
    RESPONSES_STREAM_EVENT = "ResponsesStreamEvent"
    REVIEW_OUTPUT_EVENT = "ReviewOutputEvent"
    SAFETY_BUFFERING_EVENT = "SafetyBufferingEvent"
    SAMPLING_MESSAGE = "SamplingMessage"
    SEARCH_CURSOR = "SearchCursor"
    SEND_MESSAGE_ARGS = "SendMessageArgs"
    SERVER_REQUEST_RESOLVED_NOTIFICATION = "ServerRequestResolvedNotification"
    SOURCE_MESSAGE = "SourceMessage"
    STORED_TURN_ERROR = "StoredTurnError"
    STREAM_ERROR_EVENT = "StreamErrorEvent"
    STRICT_REVIEW_REQUIRED_NOTIFICATION = "StrictReviewRequiredNotification"
    SUB_AGENT_ACTIVITY_EVENT = "SubAgentActivityEvent"
    SUBSCRIPTIONS_ACKNOWLEDGED_NOTIFICATION_PARAMS = "SubscriptionsAcknowledgedNotificationParams"
    TERMINAL_INTERACTION_EVENT = "TerminalInteractionEvent"
    TERMINAL_INTERACTION_NOTIFICATION = "TerminalInteractionNotification"
    THREAD_ATTACHMENT = "ThreadAttachment"
    THREAD_ATTACHMENT_ADD_PARAMS = "ThreadAttachmentAddParams"
    THREAD_ATTACHMENT_ADD_RESPONSE = "ThreadAttachmentAddResponse"
    THREAD_ATTACHMENT_LIST_PARAMS = "ThreadAttachmentListParams"
    THREAD_ATTACHMENT_LIST_RESPONSE = "ThreadAttachmentListResponse"
    THREAD_ATTACHMENT_OWNER_LIST_PARAMS = "ThreadAttachmentOwnerListParams"
    THREAD_ATTACHMENT_REMOVE_PARAMS = "ThreadAttachmentRemoveParams"
    THREAD_ATTACHMENT_UPDATED_NOTIFICATION = "ThreadAttachmentUpdatedNotification"
    THREAD_BACKGROUND_TERMINAL = "ThreadBackgroundTerminal"
    THREAD_BACKGROUND_TERMINALS_LIST_PARAMS = "ThreadBackgroundTerminalsListParams"
    THREAD_BACKGROUND_TERMINALS_LIST_RESPONSE = "ThreadBackgroundTerminalsListResponse"
    THREAD_BACKGROUND_TERMINALS_TERMINATE_PARAMS = "ThreadBackgroundTerminalsTerminateParams"
    THREAD_COMPATIBILITY = "ThreadCompatibility"
    THREAD_ENVIRONMENT = "ThreadEnvironment"
    THREAD_FORK_PARAMS = "ThreadForkParams"
    THREAD_FORK_RESPONSE = "ThreadForkResponse"
    THREAD_INJECT_ITEMS_PARAMS = "ThreadInjectItemsParams"
    THREAD_ITEM_ENTRY = "ThreadItemEntry"
    THREAD_ITEMS_LIST_PARAMS = "ThreadItemsListParams"
    THREAD_ITEMS_LIST_RESPONSE = "ThreadItemsListResponse"
    THREAD_ITEMS_READ_PARAMS = "ThreadItemsReadParams"
    THREAD_LIST_PARAMS = "ThreadListParams"
    THREAD_LIST_RESPONSE = "ThreadListResponse"
    THREAD_LOADED_LIST_PARAMS = "ThreadLoadedListParams"
    THREAD_LOADED_LIST_RESPONSE = "ThreadLoadedListResponse"
    THREAD_MEMORY_MODE_SET_PARAMS = "ThreadMemoryModeSetParams"
    THREAD_METADATA_UPDATE_PARAMS = "ThreadMetadataUpdateParams"
    THREAD_NAME_UPDATED_NOTIFICATION = "ThreadNameUpdatedNotification"
    THREAD_PREDICTION_REQUEST_PARAMS = "ThreadPredictionRequestParams"
    THREAD_PREDICTION_UPDATED_NOTIFICATION = "ThreadPredictionUpdatedNotification"
    THREAD_PROJECT_UPDATED_NOTIFICATION = "ThreadProjectUpdatedNotification"
    THREAD_QUEUE_ADD_PARAMS = "ThreadQueueAddParams"
    THREAD_QUEUE_DELETE_PARAMS = "ThreadQueueDeleteParams"
    THREAD_QUEUE_LIST_PARAMS = "ThreadQueueListParams"
    THREAD_QUEUE_REORDER_PARAMS = "ThreadQueueReorderParams"
    THREAD_QUEUE_START_PARAMS = "ThreadQueueStartParams"
    THREAD_QUEUE_UPDATE_PARAMS = "ThreadQueueUpdateParams"
    THREAD_READ_PARAMS = "ThreadReadParams"
    THREAD_READ_RESPONSE = "ThreadReadResponse"
    THREAD_READ_STATE = "ThreadReadState"
    THREAD_READ_STATE_CHANGED_NOTIFICATION = "ThreadReadStateChangedNotification"
    THREAD_READ_STATE_UPDATE_PARAMS = "ThreadReadStateUpdateParams"
    THREAD_REALTIME_AUDIO_CHUNK = "ThreadRealtimeAudioChunk"
    THREAD_REALTIME_CLOSED_NOTIFICATION = "ThreadRealtimeClosedNotification"
    THREAD_REALTIME_ERROR_NOTIFICATION = "ThreadRealtimeErrorNotification"
    THREAD_REALTIME_INITIAL_ITEM = "ThreadRealtimeInitialItem"
    THREAD_REALTIME_ITEM_ADDED_NOTIFICATION = "ThreadRealtimeItemAddedNotification"
    THREAD_REALTIME_ITEM_COMPLETED_NOTIFICATION = "ThreadRealtimeItemCompletedNotification"
    THREAD_REALTIME_ITEM_STARTED_NOTIFICATION = "ThreadRealtimeItemStartedNotification"
    THREAD_REALTIME_ITEM_TRANSCRIPT_DELTA_NOTIFICATION = "ThreadRealtimeItemTranscriptDeltaNotification"
    THREAD_REALTIME_OUTPUT_AUDIO_DELTA_NOTIFICATION = "ThreadRealtimeOutputAudioDeltaNotification"
    THREAD_REALTIME_SDP_NOTIFICATION = "ThreadRealtimeSdpNotification"
    THREAD_REALTIME_START_PARAMS = "ThreadRealtimeStartParams"
    THREAD_REALTIME_STARTED_NOTIFICATION = "ThreadRealtimeStartedNotification"
    THREAD_REALTIME_TRANSCRIPT_DELTA_NOTIFICATION = "ThreadRealtimeTranscriptDeltaNotification"
    THREAD_REALTIME_TRANSCRIPT_DONE_NOTIFICATION = "ThreadRealtimeTranscriptDoneNotification"
    THREAD_RESUME_INITIAL_TURNS_PAGE_PARAMS = "ThreadResumeInitialTurnsPageParams"
    THREAD_RESUME_PARAMS = "ThreadResumeParams"
    THREAD_RESUME_RESPONSE = "ThreadResumeResponse"
    THREAD_REVERT_PARAMS = "ThreadRevertParams"
    THREAD_REVERT_RESPONSE = "ThreadRevertResponse"
    THREAD_SAMPLE_PARAMS = "ThreadSampleParams"
    THREAD_SEARCH_OCCURRENCES_PARAMS = "ThreadSearchOccurrencesParams"
    THREAD_SEARCH_PARAMS = "ThreadSearchParams"
    THREAD_SEARCH_RESPONSE = "ThreadSearchResponse"
    THREAD_SEARCH_RESULT = "ThreadSearchResult"
    THREAD_SECTION = "ThreadSection"
    THREAD_SECTION_CHANGED_NOTIFICATION = "ThreadSectionChangedNotification"
    THREAD_SECTION_CREATE_PARAMS = "ThreadSectionCreateParams"
    THREAD_SECTION_LIST_PARAMS = "ThreadSectionListParams"
    THREAD_SECTION_MOVE_PARAMS = "ThreadSectionMoveParams"
    THREAD_SECTION_UPDATE_PARAMS = "ThreadSectionUpdateParams"
    THREAD_SET_NAME_PARAMS = "ThreadSetNameParams"
    THREAD_SHELL_COMMAND_PARAMS = "ThreadShellCommandParams"
    THREAD_START_PARAMS = "ThreadStartParams"
    THREAD_START_RESPONSE = "ThreadStartResponse"
    THREAD_STARTED_METADATA = "ThreadStartedMetadata"
    THREAD_STATUS_CHANGED_NOTIFICATION = "ThreadStatusChangedNotification"
    THREAD_SUMMARY = "ThreadSummary"
    THREAD_TIMELINE_LIST_PARAMS = "ThreadTimelineListParams"
    THREAD_TURNS_CURSOR = "ThreadTurnsCursor"
    THREAD_TURNS_LIST_PARAMS = "ThreadTurnsListParams"
    THREAD_TURNS_LIST_RESPONSE = "ThreadTurnsListResponse"
    TIMELINE_CURSOR = "TimelineCursor"
    TUI_CHAT_KEYMAP = "TuiChatKeymap"
    TURN_ABORTED_EVENT = "TurnAbortedEvent"
    TURN_ATTRIBUTION = "TurnAttribution"
    TURN_COMPLETE_EVENT = "TurnCompleteEvent"
    TURN_COMPLETED_NOTIFICATION = "TurnCompletedNotification"
    TURN_DIFF_UPDATED_NOTIFICATION = "TurnDiffUpdatedNotification"
    TURN_ENVIRONMENT_PARAMS = "TurnEnvironmentParams"
    TURN_INTERRUPT_PARAMS = "TurnInterruptParams"
    TURN_MODERATION_METADATA_NOTIFICATION = "TurnModerationMetadataNotification"
    TURN_PLAN_STEP = "TurnPlanStep"
    TURN_PLAN_UPDATED_NOTIFICATION = "TurnPlanUpdatedNotification"
    TURN_START_PARAMS = "TurnStartParams"
    TURN_STARTED_EVENT = "TurnStartedEvent"
    TURN_STARTED_NOTIFICATION = "TurnStartedNotification"
    TURN_STEER_PARAMS = "TurnSteerParams"
    TURN_TOOL_OUTPUT = "TurnToolOutput"
    TURNS_PAGE = "TurnsPage"
    VIEW_IMAGE_TOOL_CALL_EVENT = "ViewImageToolCallEvent"
    WARNING_NOTIFICATION = "WarningNotification"
    WEB_SEARCH_END_EVENT = "WebSearchEndEvent"
    WINDOWS_SANDBOX_SETUP_COMPLETED_NOTIFICATION = "WindowsSandboxSetupCompletedNotification"
    WINDOWS_WORLD_WRITABLE_WARNING_NOTIFICATION = "WindowsWorldWritableWarningNotification"
    WORKSPACE_MESSAGE = "WorkspaceMessage"
    WRAPPED_WEBSOCKET_ERROR_EVENT = "WrappedWebsocketErrorEvent"



class ThreadStructContractError(ValueError):
    """未登记的协议面 variant（封闭集/元素数/归类判据点名）。"""


def thread_struct_contract_names() -> list[str]:
    """返回逐字 variant 名列表副本（顺序稳定，调用方改不动真相源）。"""
    return list(THREAD_STRUCT_CONTRACT_ELEMENTS)


def expected_thread_struct_contract_element_count(name: str) -> int:
    """该 variant 的逐字元素数（未登记抛错）。"""
    if not isinstance(name, str) or name not in _CLOSED_SET:
        raise ThreadStructContractError(f"未登记的 variant: {name!r} —— 先在 app/core/thread_struct_contract.py 的 THREAD_STRUCT_CONTRACT_ELEMENTS 登记")
    return THREAD_STRUCT_CONTRACT_ELEMENTS[name]


def ensure_thread_struct_contract(value: str) -> str:
    """值域闭合：登记过原样放行，未登记抛 :class:`ThreadStructContractError`。"""
    if not isinstance(value, str) or value not in _CLOSED_SET:
        raise ThreadStructContractError(f"未登记的 variant: {value!r} —— 先在 app/core/thread_struct_contract.py 的 ThreadStructContract 登记后再产出")
    return value


def thread_struct_contract_domain(value: str) -> str:
    """归类到协议面域（登记外抛错）。"""
    ensure_thread_struct_contract(value)
    return THREAD_STRUCT_CONTRACT_DOMAIN[value]


def thread_struct_contract_domain_members(domain: str) -> tuple[str, ...]:
    """反查某域下的全部逐字 variant 名（元组副本，调用方改不动真相源）。"""
    if domain not in set(THREAD_STRUCT_CONTRACT_DOMAIN.values()):
        raise ThreadStructContractError(f"未登记的域: {domain!r} —— 合法域: {sorted(set(THREAD_STRUCT_CONTRACT_DOMAIN.values()))!r}")
    return tuple(nm for nm, dom in THREAD_STRUCT_CONTRACT_DOMAIN.items() if dom == domain)


def is_thread_struct_contract(value: str) -> bool:
    """封闭集成员判定（不改值、不抛错）。"""
    return isinstance(value, str) and value in _CLOSED_SET


def validate_thread_struct_contract(name: str, element_count: int) -> str:
    """一致性守门：variant 名与元素数须同时匹配逐字表，否则抛错点名。"""
    ensure_thread_struct_contract(name)
    expected = expected_thread_struct_contract_element_count(name)
    if element_count != expected:
        raise ThreadStructContractError(f"{name!r} 的 struct 元素数应为 {expected}，实得 {element_count!r}")
    return name
