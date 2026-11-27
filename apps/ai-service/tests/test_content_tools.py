# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""generate_content 内容出稿工具测试(2026-11-27 立)。

覆盖:参数校验、stub 模式不产假稿、JSON/围栏/纯文本三种解析、字数区间与
cost 归属字段透传。LLM 调用全部 monkeypatch,不打真实上游。
"""

from __future__ import annotations

from typing import Any

from app.core.llm_gateway import llm_gateway
from app.tools.content_tools import _char_count, _parse_payload, generate_content


def _args(**overrides: Any) -> dict[str, Any]:
    base = {
        "brief": "给长春的个体创作者讲清楚 AI 出稿怎么省时间",
        "platform": "douyin",
        "tone": "口语",
        "min_chars": 0,
        "max_chars": 3000,
        "__user_id": "user-1",
        "__session_id": "sess-001",
    }
    base.update(overrides)
    return base


class TestValidation:
    async def test_missing_brief(self):
        res = await generate_content(_args(brief="   "))
        assert res["ok"] is False
        assert res["errorCode"] == "MISSING_BRIEF"

    async def test_min_greater_than_max(self):
        res = await generate_content(_args(min_chars=500, max_chars=100))
        assert res["ok"] is False
        assert res["errorCode"] == "INVALID_RANGE"

    async def test_title_chars_out_of_range(self):
        res = await generate_content(_args(title_chars=61))
        assert res["ok"] is False
        assert res["errorCode"] == "INVALID_TITLE_CHARS"

    async def test_stub_mode_refuses_to_fake(self, monkeypatch):
        monkeypatch.setattr(llm_gateway, "_is_stub_mode", lambda: True)
        res = await generate_content(_args())
        assert res["ok"] is False
        assert res["errorCode"] == "LLM_UNAVAILABLE"
        assert "content" not in res


class TestGeneration:
    async def test_json_result_and_cost_attribution(self, monkeypatch):
        captured: dict[str, Any] = {}

        async def fake_complete(messages, model=None, **kwargs):
            captured["messages"] = messages
            captured["model"] = model
            captured["kwargs"] = kwargs
            return {
                "content": '{"title":"AI 出稿省时间","content":"先把需求说清楚，再让 AI 出初稿。"}',
                "model": "auto-test",
                "usage": {"prompt_tokens": 10, "completion_tokens": 20},
            }

        monkeypatch.setattr(llm_gateway, "_is_stub_mode", lambda: False)
        monkeypatch.setattr(llm_gateway, "complete", fake_complete)
        res = await generate_content(_args(max_chars=100))
        assert res["ok"] is True
        assert res["title"] == "AI 出稿省时间"
        assert res["content"].startswith("先把需求")
        assert res["charCount"] == _char_count(res["content"])
        assert res["withinRange"] is True
        assert res["model"] == "auto-test"
        assert res["usage"]["completion_tokens"] == 20
        assert captured["model"] == "auto"
        assert captured["kwargs"]["billing_user_id"] == "user-1"
        assert captured["kwargs"]["conversation_id"] == "sess-001"

    async def test_hashtags_and_title_length_output(self, monkeypatch):
        captured: dict[str, Any] = {}

        async def fake_complete(messages, model=None, **kwargs):
            captured["messages"] = messages
            return {
                "content": (
                    '{"title":"AI时代普通人如何做好内容的变现",'
                    '"content":"先把需求说清楚，再让 AI 出初稿。",'
                    '"hashtags":["AI","人工智能","内容创作","普通人副业","AI工具"]}'
                ),
                "model": "auto-test",
                "usage": {},
            }

        monkeypatch.setattr(llm_gateway, "_is_stub_mode", lambda: False)
        monkeypatch.setattr(llm_gateway, "complete", fake_complete)
        res = await generate_content(_args(title_chars=16, hashtag_count=5, max_chars=100))
        assert res["ok"] is True
        assert res["titleLength"] == 16
        assert res["titleWithinRange"] is True
        assert res["hashtags"] == ["#AI", "#人工智能", "#内容创作", "#普通人副业", "#AI工具"]
        assert res["hashtagCount"] == 5
        assert "标题字数：16" in captured["messages"][1]["content"]
        assert "话题词个数：5" in captured["messages"][1]["content"]

    async def test_fenced_json_is_parsed(self, monkeypatch):
        async def fake_complete(messages, model=None, **kwargs):
            return {
                "content": '```json\n{"title":"标题","content":"正文内容"}\n```',
                "model": "auto-test",
                "usage": {},
            }

        monkeypatch.setattr(llm_gateway, "_is_stub_mode", lambda: False)
        monkeypatch.setattr(llm_gateway, "complete", fake_complete)
        res = await generate_content(_args())
        assert res["ok"] is True
        assert res["title"] == "标题"
        assert res["content"] == "正文内容"

    async def test_plain_text_fallback(self, monkeypatch):
        async def fake_complete(messages, model=None, **kwargs):
            return {
                "content": "标题：口播开头\n第一句就讲痛点。\n第二句给方案。",
                "model": "auto-test",
                "usage": {},
            }

        monkeypatch.setattr(llm_gateway, "_is_stub_mode", lambda: False)
        monkeypatch.setattr(llm_gateway, "complete", fake_complete)
        res = await generate_content(_args())
        assert res["ok"] is True
        assert res["title"] == "口播开头"
        assert "第一句就讲痛点" in res["content"]

    async def test_empty_content_is_failure(self, monkeypatch):
        async def fake_complete(messages, model=None, **kwargs):
            return {"content": "   ", "model": "auto-test", "usage": {}}

        monkeypatch.setattr(llm_gateway, "_is_stub_mode", lambda: False)
        monkeypatch.setattr(llm_gateway, "complete", fake_complete)
        res = await generate_content(_args())
        assert res["ok"] is False
        assert res["errorCode"] == "EMPTY_RESULT"


class TestParsingHelpers:
    def test_char_count_ignores_whitespace(self):
        assert _char_count("你 好\n世界") == 4

    def test_parse_payload_keeps_raw_text_when_not_json(self):
        title, content, hashtags = _parse_payload("就是一段普通正文")
        assert title == ""
        assert content == "就是一段普通正文"
        assert hashtags == []


def test_registered_in_mcp_registry():
    """工具必须同时出现在 _TOOLS 与 _TOOL_HANDLERS，否则 MCP 面调不到。"""
    from app.services.mcp_server import _TOOL_HANDLERS, _TOOLS

    assert any(tool.name == "generate_content" for tool in _TOOLS)
    assert "generate_content" in _TOOL_HANDLERS


def test_list_tools_exposes_generate_content():
    """默认工具清单里必须能看到它，模型才有机会选择。"""
    from app.services.mcp_server import mcp_server

    names = [tool.name for tool in mcp_server.list_tools()]
    assert "generate_content" in names
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
