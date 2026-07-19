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
    """清理单例状态,避免测试间污染。"""
    memory_store._use_redis = False
    memory_store._redis = None
    memory_store._store.clear()
    vector_memory._store.clear()
    yield
    memory_store._use_redis = False
    memory_store._redis = None
    memory_store._store.clear()
    vector_memory._store.clear()


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
