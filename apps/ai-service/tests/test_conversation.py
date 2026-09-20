# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Conversation service 单元测试。

测试覆盖:
- 意图分类(LLM 不可用时 fallback 关键词)
- JSON 解析(_parse_json_object 各种格式)
- 工具选择(allowed_tools / suggested_tools / 关键词 fallback)
- 完整 chat 流程(stub 模式,无 API key)
- 序列化(ConversationResult → dict)
"""

from __future__ import annotations

import json

import pytest

from app.services.conversation import (
    INTENT_LABELS,
    ConversationResult,
    ConversationService,
    IntentResult,
    ToolCallRecord,
    conversation_service,
)
from app.services.memory import memory_store
from app.services.vector_memory import vector_memory


@pytest.fixture(autouse=True)
def _clear_singletons():
    """清理单例状态,避免测试间污染。

    2026-08-22 修复:VectorMemoryStore 重构后内部存储为 _entries/_vectors(原 _store 移除)。
    """
    memory_store._use_redis = False
    memory_store._redis = None
    memory_store._store.clear()
    vector_memory._entries.clear()
    vector_memory._vectors.clear()
    yield
    memory_store._use_redis = False
    memory_store._redis = None
    memory_store._store.clear()
    vector_memory._entries.clear()
    vector_memory._vectors.clear()


# =============================================================================
# 辅助:基础工具
# =============================================================================


def test_intent_labels_includes_required():
    """INTENT_LABELS 含必要标签。"""
    for label in ("chat", "qa", "tool_use", "code", "analysis", "creative", "other"):
        assert label in INTENT_LABELS


def test_service_singleton_exists():
    assert conversation_service is not None
    assert isinstance(conversation_service, ConversationService)


# =============================================================================
# JSON 解析
# =============================================================================


class TestParseJsonObject:
    def test_parse_valid_json(self):
        text = '{"intent": "code", "confidence": 0.8}'
        result = ConversationService._parse_json_object(text)
        assert result == {"intent": "code", "confidence": 0.8}

    def test_parse_json_with_surrounding_text(self):
        text = '以下是结果: {"intent": "qa", "needs_tool": true} 结束'
        result = ConversationService._parse_json_object(text)
        assert result is not None
        assert result["intent"] == "qa"
        assert result["needs_tool"] is True

    def test_parse_invalid_returns_none(self):
        assert ConversationService._parse_json_object("") is None
        assert ConversationService._parse_json_object("not json") is None
        assert ConversationService._parse_json_object("[1, 2, 3]") is None


# =============================================================================
# Fallback 意图
# =============================================================================


class TestFallbackIntent:
    def test_fallback_chat(self):
        svc = ConversationService()
        result = svc._fallback_intent("hello world")
        assert isinstance(result, IntentResult)
        assert result.intent in INTENT_LABELS

    def test_fallback_code_intent(self):
        svc = ConversationService()
        result = svc._fallback_intent("写一个 Python 函数")
        assert result.intent == "code"
        assert result.needs_tool is True
        assert "search_codebase" in result.suggested_tools

    def test_fallback_qa_intent(self):
        svc = ConversationService()
        result = svc._fallback_intent("什么是 LangGraph?")
        assert result.intent == "qa"

    def test_fallback_tool_use_intent(self):
        svc = ConversationService()
        result = svc._fallback_intent("搜索一下 Redis 的用法")
        assert result.intent == "tool_use"
        assert "search_web" in result.suggested_tools

    def test_fallback_git_intent(self):
        svc = ConversationService()
        result = svc._fallback_intent("git status 看一下")
        assert result.intent == "tool_use"
        assert "git_operations" in result.suggested_tools


# =============================================================================
# 工具选择
# =============================================================================


class TestToolSelection:
    def test_filter_tools_with_allowed(self):
        svc = ConversationService()
        tools = svc._filter_tools(["search_codebase", "unknown_tool"])
        # 至少 1 个真实工具
        assert len(tools) >= 1
        assert tools[0]["function"]["name"] == "search_codebase"
        assert tools[0]["type"] == "function"

    def test_filter_tools_empty(self):
        svc = ConversationService()
        assert svc._filter_tools([]) == []
        assert svc._filter_tools(["nonexistent_tool_xyz"]) == []

    def test_keyword_tool_select(self):
        svc = ConversationService()
        result = svc._keyword_tool_select("git status 看看")
        assert "git_operations" in result

    def test_keyword_tool_select_returns_top_n(self):
        svc = ConversationService()
        result = svc._keyword_tool_select("搜索 网页 web")
        # 应至少返回一个搜索类工具
        assert any("search" in t or "web" in t for t in result)


# =============================================================================
# Chat 流程(stub 模式,无 API key)
# =============================================================================


@pytest.mark.asyncio
async def test_chat_basic_stub():
    """基础 chat 流程(stub 模式)。"""
    svc = ConversationService()
    result = await svc.chat(
        user_input="你好",
        session_id="test-conv-1",
        max_iterations=2,
    )
    assert isinstance(result, ConversationResult)
    assert result.session_id == "test-conv-1"
    assert result.user_input == "你好"
    assert result.iterations >= 1
    # duration_ms 在 Windows 上可能为 0(time.monotonic 精度限制),但不应为负
    assert result.duration_ms >= 0
    assert result.intent.intent in INTENT_LABELS
    assert result.final_response  # 非空


@pytest.mark.asyncio
async def test_chat_with_allowed_tools():
    """指定工具列表。"""
    svc = ConversationService()
    result = await svc.chat(
        user_input="写一个函数",
        session_id="test-conv-2",
        allowed_tools=["search_codebase"],
        max_iterations=2,
    )
    assert result.session_id == "test-conv-2"
    # 工具列表被强制指定
    assert result.iterations >= 1


@pytest.mark.asyncio
async def test_chat_new_session_id():
    """不传 session_id 时自动生成。"""
    svc = ConversationService()
    result = await svc.chat(user_input="hi", max_iterations=1)
    assert result.session_id.startswith("conv-")


@pytest.mark.asyncio
async def test_chat_keyword_fallback_intent():
    """关键词触发 tool_use 意图。"""
    svc = ConversationService()
    result = await svc.chat(
        user_input="搜索一下 FastAPI 的文档",
        session_id="test-conv-3",
        max_iterations=1,
    )
    # 关键词 fallback 应识别为 tool_use 或包含 web_search 建议
    assert result.intent.intent in ("tool_use", "qa", "chat")


# =============================================================================
# 序列化
# =============================================================================


def test_result_to_dict_basic():
    """result_to_dict 返回完整字段。"""
    intent = IntentResult(
        intent="code", confidence=0.9, needs_tool=True, suggested_tools=["search_codebase"]
    )
    tool_calls = [
        ToolCallRecord(
            tool="search_codebase",
            arguments={"query": "foo"},
            result={"ok": True, "matches": []},
            ok=True,
            duration_ms=12.5,
        ),
    ]
    result = ConversationResult(
        session_id="s1",
        user_input="test",
        intent=intent,
        tool_calls=tool_calls,
        final_response="answer",
        model="gpt-4",
        iterations=1,
        duration_ms=100.0,
        stub=True,
        trace=[{"node": "intent_classify"}],
    )
    d = ConversationService.result_to_dict(result)
    assert d["session_id"] == "s1"
    assert d["user_input"] == "test"
    assert d["intent"]["intent"] == "code"
    assert d["intent"]["confidence"] == 0.9
    assert d["intent"]["needs_tool"] is True
    assert d["tool_calls"][0]["tool"] == "search_codebase"
    assert d["tool_calls"][0]["ok"] is True
    assert d["final_response"] == "answer"
    assert d["iterations"] == 1
    assert d["stub"] is True
    assert len(d["trace"]) == 1


def test_result_to_dict_json_serializable():
    """序列化结果可被 json.dumps。"""
    intent = IntentResult(intent="chat", confidence=0.5)
    result = ConversationResult(
        session_id="s2", user_input="x", intent=intent, tool_calls=[],
        final_response="y", model="m", iterations=0, duration_ms=0.0, stub=True,
    )
    d = ConversationService.result_to_dict(result)
    json.dumps(d)  # 不抛异常


# =============================================================================
# 教育管理(edu_*)意图预路由 + 身份透传回归(2026-09-19)
# =============================================================================

# 追加区块所需依赖(置于文件末尾以不动既有 import 区;E402 在 pyproject 已全局豁免)
import httpx

from app.core.llm_gateway import llm_gateway
from app.services.mcp_server import _TOOL_HANDLERS, mcp_server


def test_edu_intent_tools_strong_signals():
    """强信号文本命中对应 edu 工具(欠费 → 查询;发催费 → 写操作)。"""
    # "欠费"命中只读查询工具 edu_list_arrears
    assert "edu_list_arrears" in ConversationService._edu_intent_tools("查一下欠费名单")
    # "发催费"命中写操作 edu_send_fee_reminder(写操作同样进预路由:
    # LLM 侧二次确认规范 + api 侧 RBAC 兜底权限)
    assert "edu_send_fee_reminder" in ConversationService._edu_intent_tools("给张三发催费提醒")


def test_edu_intent_tools_unrelated_text_empty():
    """无关文本(无教育业务强信号)不命中任何 edu 工具。"""
    assert ConversationService._edu_intent_tools("你好") == []


@pytest.mark.asyncio
async def test_chat_edu_identity_passthrough_end_to_end(monkeypatch):
    """chat() 身份透传端到端:sid → call_tool → args["__user_id"] → httpx 鉴权头。

    验证链路(2026-09-19 教育管理身份透传):
    sid 复合格式首段经 _resolve_user_id 解析 → _execute_tool_call(user_id=…,
    session_id=…) → mcp_server.call_tool 收到正确入参并注入 args["__user_id"]
    → edu handler 经 _edu_api_request 发 HTTP 请求,头里带
    x-user-id / x-internal-service-token。
    """
    sid = "user-e2e-1001:sess-e2e"  # 复合格式,首段可被 _resolve_user_id 解析
    expect_uid = "user-e2e-1001"
    # edu 内部鉴权头依赖 AI_CALLBACK_SECRET,显式注入保证确定性
    monkeypatch.setenv("AI_CALLBACK_SECRET", "test-callback-secret")

    # 1) spy 包一层真实 call_tool:捕获入参且不阻断后续 handler/httpx 链路
    captured_calls: list[dict] = []
    real_call_tool = mcp_server.call_tool

    async def spy_call_tool(name, arguments=None, *, user_role=0, user_id=None, session_id=None):
        captured_calls.append({
            "name": name,
            "user_id": user_id,
            "session_id": session_id,
        })
        return await real_call_tool(
            name, arguments, user_role=user_role, user_id=user_id, session_id=session_id
        )

    monkeypatch.setattr(mcp_server, "call_tool", spy_call_tool)

    # 2) spy 包一层真实 edu handler:直接断言 call_tool 注入后的 args 身份键
    real_edu_handler = _TOOL_HANDLERS["edu_list_arrears"]
    captured_handler_args: list[dict] = []

    async def spy_edu_handler(args):
        captured_handler_args.append(dict(args))
        return await real_edu_handler(args)

    monkeypatch.setitem(_TOOL_HANDLERS, "edu_list_arrears", spy_edu_handler)

    # 3) 在 httpx 层拦截,捕获 edu handler 发出的真实请求对象(不发真实网络);
    #    URL 过滤 edu 前缀,避免画像/记忆注入等其他 httpx 调用混入断言
    captured_requests: list[dict] = []

    class _FakeEduResponse:
        status_code = 200

        def json(self):
            return {"code": 0, "message": "ok", "data": {"list": [], "total": 0}}

    async def fake_httpx_request(self, method, url, **kwargs):
        captured_requests.append({
            "method": method,
            "url": str(url),
            "headers": dict(kwargs.get("headers") or {}),
            "params": dict(kwargs.get("params") or {}),
        })
        return _FakeEduResponse()

    monkeypatch.setattr(httpx.AsyncClient, "request", fake_httpx_request)

    # 4) stub LLM:意图分类轮(无 tools kwarg)返回空内容 → 走关键词 fallback;
    #    工具轮第 1 次发起 edu_list_arrears tool_call,工具结果回灌后给最终回复
    async def fake_complete(messages, model=None, **kwargs):
        if not kwargs.get("tools"):
            return {"content": "", "model": "stub", "stub": True}
        if not any(m.get("role") == "tool" for m in messages):
            return {
                "content": "",
                "model": "stub",
                "stub": True,
                "tool_calls": [{
                    "id": "call_edu_1",
                    "type": "function",
                    "function": {
                        "name": "edu_list_arrears",
                        "arguments": json.dumps({"page": 1, "pageSize": 10}),
                    },
                }],
            }
        return {"content": "已为您查询欠费名单", "model": "stub", "stub": True}

    monkeypatch.setattr(llm_gateway, "complete", fake_complete)

    svc = ConversationService()
    result = await svc.chat(
        user_input="查一下欠费名单",
        session_id=sid,
        max_iterations=3,
    )

    # 5) call_tool 收到从 sid 解析出的 user_id 与完整 session_id
    assert captured_calls, "应发生至少一次 mcp_server.call_tool 调用"
    call = captured_calls[0]
    assert call["name"] == "edu_list_arrears"
    assert call["user_id"] == expect_uid
    assert call["session_id"] == sid

    # 6) call_tool 注入的 __user_id/__session_id 到达 handler(身份注入的直接证据)
    assert captured_handler_args, "edu handler 应被调用"
    assert captured_handler_args[0].get("__user_id") == expect_uid
    assert captured_handler_args[0].get("__session_id") == sid

    # 7) edu handler 发出的 HTTP 请求头携带真实用户身份
    edu_reqs = [r for r in captured_requests if "edu-ai-management" in r["url"]]
    assert edu_reqs, "edu handler 应发出 httpx 请求"
    req = edu_reqs[0]
    assert "/student-roster" in req["url"]
    assert req["headers"].get("x-user-id") == expect_uid
    assert req["headers"].get("x-internal-service-token") == "test-callback-secret"
    assert req["params"].get("arrearsOnly") == "true"
    # 工具执行成功(ok=True)并记录进 result.tool_calls
    assert result.tool_calls and result.tool_calls[0].ok is True
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
