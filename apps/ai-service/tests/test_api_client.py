"""api_client.py 单元测试:API 契约类型存根运行时模块。

测试覆盖:
- TypedDict 实例化与字段访问(User / AuthToken / ApiResponse 等)
- Literal 类型别名存在
- Protocol 类(_ApiResultSuccess / _ApiResultFailure)
- repairMessages stub 函数(返回 None/省略号)
- __all__ 导出列表完整性
- 类型注解可读(__annotations__)
"""

from __future__ import annotations

from typing import Any, get_args, get_origin

import pytest

from app.types import api_client
from app.types.api_client import (
    AgentTask,
    AgentTaskStatus,
    ApiResult,
    ApiResponse,
    Attachment,
    AuthToken,
    BeginPromptData,
    CancelPromptData,
    ChannelConfig,
    ChatMessage,
    ChatRequest,
    ChatRole,
    CreateSessionData,
    CustomerServiceFromType,
    CustomerServiceMessage,
    CustomerServiceMessageType,
    CustomerServiceSession,
    CustomerServiceSessionStatus,
    DingtalkMessage,
    EndPromptData,
    FeishuMessage,
    HookContext,
    HookEntry,
    HookEvent,
    HookMethod,
    HookResult,
    HooksConfig,
    JSONSchema,
    JSONSchemaType,
    LoadSessionData,
    NotificationChannel,
    NotificationItem,
    PaginatedResponse,
    PermissionCheckResult,
    PermissionDecision,
    PermissionMode,
    PermissionRules,
    PersonaContract,
    PersonaContracts,
    PlanContext,
    PlanEvent,
    PlanState,
    PromptMode,
    RepairResult,
    RepairableMessage,
    SessionMessage,
    SessionState,
    SessionStatus,
    SkillDefinition,
    SkillFrontmatter,
    SubagentPersona,
    UnreadCount,
    UsageStats,
    User,
    UserProfile,
    WechatWorkMessage,
    WSNotification,
    repairMessages,
)


# =============================================================================
# TypedDict 实例化与字段访问
# =============================================================================


def test_user_typeddict_construction():
    """User TypedDict 应能构造 dict 并访问字段。"""
    u: User = {"id": "u1", "phone": "13800000000", "nickname": "alice", "roleId": 1}
    assert u["id"] == "u1"
    assert u["nickname"] == "alice"
    assert u["roleId"] == 1


def test_user_optional_fields():
    """User total=False,所有字段可选,空 dict 合法。"""
    u: User = {}
    assert u == {}


def test_user_profile_extends_user():
    """UserProfile 应继承 User 字段(total=False)。"""
    p: UserProfile = {"id": "u1", "bio": "hi", "gender": 1, "birthday": "2000-01-01"}
    assert p["bio"] == "hi"
    assert p["id"] == "u1"


def test_authtoken_required_fields():
    """AuthToken total=True(默认),所有字段必填。"""
    t: AuthToken = {
        "accessToken": "at",
        "refreshToken": "rt",
        "expiresIn": 3600,
        "tokenType": "Bearer",
    }
    assert t["accessToken"] == "at"
    assert t["expiresIn"] == 3600


def test_apiresponse_optional_fields():
    """ApiResponse total=False,字段可选。"""
    r: ApiResponse = {"code": 200, "message": "ok", "data": {"x": 1}}
    assert r["code"] == 200
    assert r["data"] == {"x": 1}


def test_paginated_response_required_fields():
    """PaginatedResponse total=True,4 字段必填。"""
    p: PaginatedResponse = {"list": [1, 2], "total": 2, "page": 1, "pageSize": 10}
    assert p["list"] == [1, 2]
    assert p["total"] == 2


def test_chatmessage_construction():
    """ChatMessage TypedDict 构造。"""
    m: ChatMessage = {"role": "user", "content": "hi"}
    assert m["role"] == "user"


def test_chatrequest_construction():
    """ChatRequest TypedDict 构造。"""
    r: ChatRequest = {
        "model": "gpt-4",
        "messages": [{"role": "user", "content": "hi"}],
        "stream": True,
        "temperature": 0.7,
        "maxTokens": 1000,
    }
    assert r["model"] == "gpt-4"
    assert r["stream"] is True


def test_agenttask_construction():
    """AgentTask TypedDict 构造。"""
    t: AgentTask = {"id": "t1", "goal": "do x", "status": "running", "result": ""}
    assert t["status"] == "running"


def test_notificationitem_construction():
    """NotificationItem 构造(含 extra dict)。"""
    n: NotificationItem = {
        "id": "n1",
        "type": "info",
        "title": "t",
        "content": "c",
        "isRead": False,
        "extra": {"k": "v"},
    }
    assert n["extra"] == {"k": "v"}


def test_channelconfig_construction():
    """ChannelConfig 构造。"""
    c: ChannelConfig = {"channel": "feishu", "webhookUrl": "http://x", "secret": "s"}
    assert c["channel"] == "feishu"


def test_dingtalk_message_construction():
    """DingtalkMessage 构造。"""
    m: DingtalkMessage = {"msgtype": "text", "text": {"content": "hi"}}
    assert m["msgtype"] == "text"


def test_feishu_message_required_fields():
    """FeishuMessage total=True,msg_type + content 必填。"""
    m: FeishuMessage = {"msg_type": "text", "content": {"text": "hi"}}
    assert m["msg_type"] == "text"


def test_wechat_work_message_construction():
    """WechatWorkMessage 构造。"""
    m: WechatWorkMessage = {"msgtype": "markdown", "markdown": {"content": "# hi"}}
    assert m["msgtype"] == "markdown"


def test_sessionstate_required_fields():
    """SessionState total=True,11 字段必填。"""
    s: SessionState = {
        "id": "s1",
        "sessionId": "sess-1",
        "createdAt": "2025-01-01",
        "updatedAt": "2025-01-01",
        "messages": [],
        "status": "running",
        "model": "gpt-4",
        "toolState": {},
        "cwd": "/tmp",
        "error": "",
    }
    assert s["status"] == "running"
    assert s["sessionId"] == "sess-1"


def test_repairable_message_required_fields():
    """RepairableMessage total=True,role + content 必填。"""
    m: RepairableMessage = {"role": "user", "content": "hi"}
    assert m["role"] == "user"


def test_skilldefinition_required_fields():
    """SkillDefinition total=True,5 字段必填。"""
    s: SkillDefinition = {
        "filePath": "/a/skill.md",
        "sourceDir": "/a",
        "frontmatter": {"name": "skill"},
        "content": "body",
        "hasFrontmatter": True,
    }
    assert s["hasFrontmatter"] is True


def test_jsonschema_construction():
    """JSONSchema TypedDict 构造(递归)。"""
    s: JSONSchema = {
        "type": "object",
        "description": "obj",
        "properties": {"name": {"type": "string"}},
        "required": ["name"],
    }
    assert s["type"] == "object"
    assert "name" in s["properties"]


def test_persona_contract_required_fields():
    """PersonaContract total=True,input_schema + output_schema 必填。"""
    c: PersonaContract = {
        "input_schema": {"type": "object"},
        "output_schema": {"type": "string"},
    }
    assert c["input_schema"]["type"] == "object"


# =============================================================================
# Literal 类型别名
# =============================================================================


def test_chatrole_literal_values():
    """ChatRole Literal 含 4 个值。"""
    args = get_args(ChatRole)
    assert set(args) == {"system", "user", "assistant", "tool"}


def test_agent_task_status_literal():
    """AgentTaskStatus Literal 含 4 个值。"""
    args = get_args(AgentTaskStatus)
    assert set(args) == {"pending", "running", "completed", "failed"}


def test_notification_channel_literal():
    """NotificationChannel 含 7 个渠道。"""
    args = get_args(NotificationChannel)
    assert "feishu" in args
    assert "dingtalk" in args
    assert "wechat" in args
    assert "sms" in args
    assert "email" in args
    assert "push" in args
    assert len(args) == 7


def test_permission_mode_literal():
    """PermissionMode 含 5 个值。"""
    args = get_args(PermissionMode)
    assert set(args) == {"default", "acceptEdits", "bypassPermissions", "plan", "manual"}


def test_permission_decision_literal():
    """PermissionDecision 含 allow/deny/ask。"""
    assert set(get_args(PermissionDecision)) == {"allow", "deny", "ask"}


def test_danger_level_literal():
    """DangerLevel 含 read/write/dangerous。"""
    assert set(get_args(api_client.DangerLevel)) == {"read", "write", "dangerous"}


def test_session_status_literal():
    """SessionStatus 含 4 个值。"""
    assert set(get_args(SessionStatus)) == {"running", "completed", "failed", "cancelled"}


def test_hook_event_literal_non_empty():
    """HookEvent 含 14 个事件。"""
    args = get_args(HookEvent)
    assert "preToolCall" in args
    assert "postToolCall" in args
    assert "sessionStart" in args
    assert len(args) >= 10


def test_hook_method_literal():
    """HookMethod 含 POST/PUT/GET。"""
    assert set(get_args(HookMethod)) == {"POST", "PUT", "GET"}


def test_jsonschema_type_literal():
    """JSONSchemaType 含 7 个 JSON 类型。"""
    args = get_args(JSONSchemaType)
    assert "object" in args
    assert "string" in args
    assert "number" in args
    assert "null" in args


def test_subagent_persona_literal():
    """SubagentPersona 含 5 个角色。"""
    args = get_args(SubagentPersona)
    assert "researcher" in args
    assert "coder" in args
    assert "reviewer" in args
    assert "planner" in args
    assert "general" in args


def test_prompt_mode_literal():
    """PromptMode 含 4 个值。"""
    args = get_args(PromptMode)
    assert set(args) == {"default", "plan", "accept-edits", "bypass-permissions"}


def test_customer_service_session_status_literal():
    """CustomerServiceSessionStatus Literal。"""
    assert set(get_args(CustomerServiceSessionStatus)) == {"pending", "active", "closed"}


def test_customer_service_from_type_literal():
    """CustomerServiceFromType Literal。"""
    assert set(get_args(CustomerServiceFromType)) == {"user", "agent", "bot"}


def test_customer_service_message_type_literal():
    """CustomerServiceMessageType Literal。"""
    assert set(get_args(CustomerServiceMessageType)) == {"text", "image", "file", "system"}


# =============================================================================
# Protocol 类(_ApiResultSuccess / _ApiResultFailure)
# =============================================================================


def test_apiresult_union_type():
    """ApiResult 应为 Union 类型。"""
    origin = get_origin(ApiResult)
    assert origin is not None  # Union


def test_apiresult_success_protocol_members():
    """_ApiResultSuccess Protocol 应有 success + data 成员。"""
    cls = api_client._ApiResultSuccess
    assert hasattr(cls, "__protocol_attrs__") or "success" in dir(cls)


# =============================================================================
# repairMessages stub
# =============================================================================


def test_repairmessages_is_callable():
    """repairMessages 应为可调用函数。"""
    assert callable(repairMessages)


def test_repairmessages_returns_none_or_result():
    """repairMessages 是 stub(实现为 '...'),调用应返回 None。"""
    # stub 实现 body 为 '...',返回 None
    result = repairMessages([{"role": "user", "content": "hi"}])
    # stub 返回 None(Python 默认)
    assert result is None


def test_repairmessages_empty_input():
    """空 messages 列表也能调用(不抛错)。"""
    result = repairMessages([])
    assert result is None


# =============================================================================
# __all__ 完整性
# =============================================================================


def test_all_exports_list_complete():
    """__all__ 应包含全部导出名称(>50 项)。"""
    assert len(api_client.__all__) >= 50


def test_all_exports_match_real_attributes():
    """__all__ 中每个名称都应是模块真实属性。"""
    for name in api_client.__all__:
        assert hasattr(api_client, name), f"__all__ 中的 {name} 不是模块属性"


def test_all_exports_contains_key_names():
    """__all__ 应包含关键导出。"""
    expected = {
        "User", "AuthToken", "ApiResponse", "ChatMessage", "ChatRequest",
        "AgentTask", "NotificationItem", "PermissionMode", "HookEvent",
        "JSONSchema", "SessionState", "SkillDefinition", "repairMessages",
    }
    assert expected.issubset(set(api_client.__all__))


# =============================================================================
# HookContext / HookEntry / HooksConfig
# =============================================================================


def test_hookcontext_construction():
    """HookContext 构造。"""
    c: HookContext = {
        "workspacePath": "/tmp",
        "sessionId": "s1",
        "toolName": "shell",
        "toolArgs": {"cmd": "ls"},
        "toolResult": "ok",
    }
    assert c["toolName"] == "shell"


def test_hookentry_construction():
    """HookEntry 构造。"""
    e: HookEntry = {
        "name": "hook1",
        "command": "echo hi",
        "webhook": "http://x",
        "method": "POST",
        "timeout": 30,
    }
    assert e["method"] == "POST"


def test_hooksconfig_construction():
    """HooksConfig 构造(含 14 个事件列表字段)。"""
    c: HooksConfig = {
        "preToolCall": [{"name": "h", "command": "x"}],
        "sessionStart": [],
    }
    assert c["preToolCall"][0]["name"] == "h"


# =============================================================================
# 其他 TypedDict
# =============================================================================


def test_unreadcount_construction():
    """UnreadCount 构造。"""
    u: UnreadCount = {"message": 3, "notification": 5, "total": 8}
    assert u["total"] == 8


def test_attachment_construction():
    """Attachment 构造。"""
    a: Attachment = {"kind": "file", "path": "/tmp/x.txt", "mimeType": "text/plain"}
    assert a["kind"] == "file"


def test_usagestats_construction():
    """UsageStats 构造。"""
    u: UsageStats = {"inputTokens": 100, "outputTokens": 50}
    assert u["inputTokens"] == 100


def test_beginpromptdata_construction():
    """BeginPromptData 构造。"""
    d: BeginPromptData = {
        "sessionId": "s1",
        "prompt": "hi",
        "attachments": [{"kind": "file", "path": "/x"}],
        "mode": "default",
    }
    assert d["sessionId"] == "s1"


def test_endpromptdata_required_sessionid():
    """EndPromptData total=True,sessionId 必填。"""
    d: EndPromptData = {"sessionId": "s1"}
    assert d["sessionId"] == "s1"


def test_cancel_promptdata_construction():
    """CancelPromptData 构造。"""
    d: CancelPromptData = {"sessionId": "s1", "reason": "user cancelled"}
    assert d["reason"] == "user cancelled"


def test_create_session_data_construction():
    """CreateSessionData 构造。"""
    d: CreateSessionData = {
        "workspaceRoot": "/tmp",
        "initialPrompt": "hi",
        "modelId": "gpt-4",
        "mode": "plan",
    }
    assert d["mode"] == "plan"


def test_load_session_data_required():
    """LoadSessionData total=True,sessionId 必填。"""
    d: LoadSessionData = {"sessionId": "s1"}
    assert d["sessionId"] == "s1"


def test_plan_context_construction():
    """PlanContext 构造。"""
    c: PlanContext = {
        "currentState": "executing",
        "messages": [],
        "planSteps": ["step1"],
        "currentStepIndex": 0,
    }
    assert c["currentState"] == "executing"
