"""gemini_provider.py 单元测试。

Google Gemini API 原生适配器。

测试覆盖:
- __init__:默认 base_url / 自定义 api_base / timeout
- DEFAULT_SAFETY_SETTINGS:4 个类别 / BLOCK_ONLY_HIGH 阈值
- _convert_messages:system 分离 / user/model role 转换 / 非 str content 序列化
- _convert_tools:function → functionDeclarations / 空 tools 返回 None
- _build_generation_config:temperature/top_p/max_tokens 封装
- _build_payload:contents/systemInstruction/generationConfig/tools/safetySettings
- _parse_candidates:text + functionCall / finish_reason / 多 candidate
- complete:成功路径 / SAFETY 拦截 / 4xx ProviderError
- astream:chunk / SAFETY 拦截 / 4xx error / 网络异常
- list_models
"""

from __future__ import annotations

import json
from contextlib import contextmanager
from typing import Any, Iterator
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.providers.base_provider import ProviderError
from app.providers.gemini_provider import DEFAULT_SAFETY_SETTINGS, GeminiProvider


@contextmanager
def _patch_http_client(fake_client: Any) -> Iterator[None]:
    """Patch get_http_client in both base_provider(_request 用)和 gemini_provider(astream 用)。"""
    with patch("app.providers.base_provider.get_http_client", return_value=fake_client), \
         patch("app.providers.gemini_provider.get_http_client", return_value=fake_client):
        yield


# =============================================================================
# __init__
# =============================================================================


def test_init_default_base_url():
    """默认 base_url 指向 Google Gemini API。"""
    p = GeminiProvider(api_key="gem-key")
    assert p.base_url == "https://generativelanguage.googleapis.com"
    assert p.api_key == "gem-key"


def test_init_custom_api_base():
    """自定义 api_base 会覆盖默认值(末尾 / 被剥离)。"""
    p = GeminiProvider(api_key="k", api_base="https://gateway.example.com/")
    assert p.base_url == "https://gateway.example.com"


def test_init_timeout_default_60():
    """timeout 默认 60.0。"""
    p = GeminiProvider(api_key="k")
    assert p.timeout == 60.0


def test_init_custom_timeout():
    """可自定义 timeout。"""
    p = GeminiProvider(api_key="k", timeout=99.0)
    assert p.timeout == 99.0


# =============================================================================
# DEFAULT_SAFETY_SETTINGS
# =============================================================================


def test_default_safety_settings_has_four_categories():
    """4 个安全类别。"""
    assert len(DEFAULT_SAFETY_SETTINGS) == 4


def test_default_safety_settings_all_block_only_high():
    """所有类别阈值都是 BLOCK_ONLY_HIGH。"""
    for s in DEFAULT_SAFETY_SETTINGS:
        assert s["threshold"] == "BLOCK_ONLY_HIGH"


def test_default_safety_settings_contains_required_categories():
    """包含 4 个必需类别。"""
    categories = {s["category"] for s in DEFAULT_SAFETY_SETTINGS}
    expected = {
        "HARM_CATEGORY_HARASSMENT",
        "HARM_CATEGORY_HATE_SPEECH",
        "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        "HARM_CATEGORY_DANGEROUS_CONTENT",
    }
    assert categories == expected


# =============================================================================
# _convert_messages
# =============================================================================


def test_convert_messages_separates_system():
    """system 消息被分离到 system_text。"""
    p = GeminiProvider(api_key="k")
    messages = [
        {"role": "system", "content": "rule"},
        {"role": "user", "content": "hi"},
    ]
    system, contents = p._convert_messages(messages)
    assert system == "rule"
    assert len(contents) == 1
    assert contents[0]["role"] == "user"
    assert contents[0]["parts"] == [{"text": "hi"}]


def test_convert_messages_assistant_becomes_model():
    """assistant role 转为 model。"""
    p = GeminiProvider(api_key="k")
    messages = [
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": "hello"},
    ]
    _, contents = p._convert_messages(messages)
    assert contents[1]["role"] == "model"


def test_convert_messages_multiple_system_joined():
    """多个 system 消息用 \\n\\n 连接。"""
    p = GeminiProvider(api_key="k")
    messages = [
        {"role": "system", "content": "r1"},
        {"role": "system", "content": "r2"},
        {"role": "user", "content": "hi"},
    ]
    system, _ = p._convert_messages(messages)
    assert system == "r1\n\nr2"


def test_convert_messages_no_system_returns_none():
    """无 system 时返回 (None, contents)。"""
    p = GeminiProvider(api_key="k")
    system, _ = p._convert_messages([{"role": "user", "content": "hi"}])
    assert system is None


def test_convert_messages_non_string_content_serialized():
    """非 str content 用 JSON 序列化。"""
    p = GeminiProvider(api_key="k")
    messages = [{"role": "user", "content": [{"type": "text"}]}]
    _, contents = p._convert_messages(messages)
    assert "text" in contents[0]["parts"][0]


# =============================================================================
# _convert_tools
# =============================================================================


def test_convert_tools_none_returns_none():
    """tools=None 返回 None。"""
    p = GeminiProvider(api_key="k")
    assert p._convert_tools(None) is None


def test_convert_tools_empty_returns_none():
    """tools=[] 返回 None。"""
    p = GeminiProvider(api_key="k")
    assert p._convert_tools([]) is None


def test_convert_tools_function_to_function_declarations():
    """function 类型 tools 转为 functionDeclarations。"""
    p = GeminiProvider(api_key="k")
    tools = [{
        "type": "function",
        "function": {
            "name": "search",
            "description": "Search web",
            "parameters": {"type": "object", "properties": {"q": {"type": "string"}}},
        },
    }]
    result = p._convert_tools(tools)
    assert len(result) == 1
    assert "functionDeclarations" in result[0]
    decls = result[0]["functionDeclarations"]
    assert decls[0]["name"] == "search"
    assert decls[0]["description"] == "Search web"
    assert decls[0]["parameters"] == tools[0]["function"]["parameters"]


def test_convert_tools_function_default_parameters_when_missing():
    """function 缺 parameters 时默认空 object schema。"""
    p = GeminiProvider(api_key="k")
    tools = [{"type": "function", "function": {"name": "x"}}]
    result = p._convert_tools(tools)
    assert result[0]["functionDeclarations"][0]["parameters"] == {"type": "object", "properties": {}}


def test_convert_tools_non_function_skipped():
    """非 function 类型 tools 被跳过(不进 functionDeclarations)。"""
    p = GeminiProvider(api_key="k")
    tools = [{"type": "other"}]
    result = p._convert_tools(tools)
    assert result is None


# =============================================================================
# _build_generation_config
# =============================================================================


def test_build_generation_config_temperature():
    """temperature 被封装。"""
    p = GeminiProvider(api_key="k")
    config = p._build_generation_config(temperature=0.5)
    assert config == {"temperature": 0.5}


def test_build_generation_config_top_p_to_topP():
    """top_p 转为 topP。"""
    p = GeminiProvider(api_key="k")
    config = p._build_generation_config(top_p=0.9)
    assert config == {"topP": 0.9}


def test_build_generation_config_max_tokens_to_maxOutputTokens():
    """max_tokens 转为 maxOutputTokens。"""
    p = GeminiProvider(api_key="k")
    config = p._build_generation_config(max_tokens=100)
    assert config == {"maxOutputTokens": 100}


def test_build_generation_config_empty_when_no_known_params():
    """无已知参数时返回空 dict。"""
    p = GeminiProvider(api_key="k")
    config = p._build_generation_config(other_param="x")
    assert config == {}


# =============================================================================
# _build_payload
# =============================================================================


def test_build_payload_contains_contents():
    """payload 含 contents 字段。"""
    p = GeminiProvider(api_key="k")
    payload = p._build_payload(
        [{"role": "user", "content": "hi"}],
        "gemini-1.5-pro",
        tools=None,
        safety_settings=None,
    )
    assert "contents" in payload
    assert len(payload["contents"]) == 1


def test_build_payload_system_instruction_when_system_present():
    """有 system 时 payload['systemInstruction'] 被设置。"""
    p = GeminiProvider(api_key="k")
    payload = p._build_payload(
        [{"role": "system", "content": "rule"}, {"role": "user", "content": "hi"}],
        "gemini-1.5-pro",
        tools=None,
        safety_settings=None,
    )
    assert "systemInstruction" in payload
    assert payload["systemInstruction"]["parts"][0]["text"] == "rule"


def test_build_payload_no_system_instruction_when_absent():
    """无 system 时不含 systemInstruction。"""
    p = GeminiProvider(api_key="k")
    payload = p._build_payload(
        [{"role": "user", "content": "hi"}],
        "gemini-1.5-pro",
        tools=None,
        safety_settings=None,
    )
    assert "systemInstruction" not in payload


def test_build_payload_generation_config_when_known_params():
    """有 temperature/top_p/max_tokens 时含 generationConfig。"""
    p = GeminiProvider(api_key="k")
    payload = p._build_payload(
        [{"role": "user", "content": "hi"}],
        "gemini-1.5-pro",
        tools=None,
        safety_settings=None,
        temperature=0.7,
        max_tokens=200,
    )
    assert payload["generationConfig"] == {"temperature": 0.7, "maxOutputTokens": 200}


def test_build_payload_uses_default_safety_settings_when_none():
    """safety_settings=None 时使用 DEFAULT_SAFETY_SETTINGS。"""
    p = GeminiProvider(api_key="k")
    payload = p._build_payload(
        [{"role": "user", "content": "hi"}],
        "gemini-1.5-pro",
        tools=None,
        safety_settings=None,
    )
    assert payload["safetySettings"] == DEFAULT_SAFETY_SETTINGS


def test_build_payload_custom_safety_settings_override():
    """自定义 safety_settings 覆盖默认值。"""
    p = GeminiProvider(api_key="k")
    custom = [{"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"}]
    payload = p._build_payload(
        [{"role": "user", "content": "hi"}],
        "gemini-1.5-pro",
        tools=None,
        safety_settings=custom,
    )
    assert payload["safetySettings"] == custom


def test_build_payload_tools_included_when_present():
    """有 tools 时含 tools 字段。"""
    p = GeminiProvider(api_key="k")
    tools = [{"type": "function", "function": {"name": "x", "description": "d", "parameters": {}}}]
    payload = p._build_payload(
        [{"role": "user", "content": "hi"}],
        "gemini-1.5-pro",
        tools=tools,
        safety_settings=None,
    )
    assert "tools" in payload


# =============================================================================
# _parse_candidates
# =============================================================================


def test_parse_candidates_text_only():
    """纯 text parts 返回 (text, [], finish_reason)。"""
    p = GeminiProvider(api_key="k")
    data = {
        "candidates": [{
            "finishReason": "STOP",
            "content": {"parts": [{"text": "hello"}, {"text": " world"}]},
        }],
    }
    text, tool_calls, finish = p._parse_candidates(data)
    assert text == "hello world"
    assert tool_calls == []
    assert finish == "STOP"


def test_parse_candidates_function_call():
    """functionCall part 解析为 tool_calls。"""
    p = GeminiProvider(api_key="k")
    data = {
        "candidates": [{
            "finishReason": "STOP",
            "content": {"parts": [{"functionCall": {"name": "search", "args": {"q": "x"}}}]},
        }],
    }
    text, tool_calls, finish = p._parse_candidates(data)
    assert text == ""
    assert len(tool_calls) == 1
    assert tool_calls[0]["function"]["name"] == "search"
    assert json.loads(tool_calls[0]["function"]["arguments"]) == {"q": "x"}


def test_parse_candidates_multiple_candidates_first_finish_reason():
    """多 candidate 时取第一个的 finishReason。"""
    p = GeminiProvider(api_key="k")
    data = {
        "candidates": [
            {"finishReason": "STOP", "content": {"parts": [{"text": "a"}]}},
            {"finishReason": "MAX_TOKENS", "content": {"parts": [{"text": "b"}]}},
        ],
    }
    text, _, finish = p._parse_candidates(data)
    assert text == "ab"
    assert finish == "STOP"


def test_parse_candidates_empty_data():
    """空数据返回 ('', [], None)。"""
    p = GeminiProvider(api_key="k")
    text, tool_calls, finish = p._parse_candidates({})
    assert text == ""
    assert tool_calls == []
    assert finish is None


# =============================================================================
# complete
# =============================================================================


async def test_complete_success_returns_text():
    """complete 成功返回 text + usage。"""
    p = GeminiProvider(api_key="gem-key")

    fake_data = {
        "candidates": [{
            "finishReason": "STOP",
            "content": {"parts": [{"text": "hello"}]},
        }],
        "usageMetadata": {"totalTokenCount": 10},
    }
    fake_resp = MagicMock()
    fake_resp.status_code = 200
    fake_resp.json.return_value = fake_data

    fake_client = MagicMock()
    fake_client.request = AsyncMock(return_value=fake_resp)

    with _patch_http_client(fake_client):
        result = await p.complete([{"role": "user", "content": "hi"}], "gemini-1.5-pro")

    assert result["content"] == "hello"
    assert result["model"] == "gemini-1.5-pro"
    assert result["usage"] == {"totalTokenCount": 10}
    assert result["stub"] is False


async def test_complete_url_contains_api_key_and_model():
    """complete URL 含 api_key 查询参数 + 模型名。"""
    p = GeminiProvider(api_key="gem-key")

    fake_resp = MagicMock()
    fake_resp.status_code = 200
    fake_resp.json.return_value = {"candidates": []}

    fake_client = MagicMock()
    fake_client.request = AsyncMock(return_value=fake_resp)

    with _patch_http_client(fake_client):
        await p.complete([{"role": "user", "content": "x"}], "gemini-1.5-pro")

    args, _ = fake_client.request.call_args
    url = args[1]
    assert "key=gem-key" in url
    assert "models/gemini-1.5-pro:generateContent" in url


async def test_complete_safety_block_returns_error_message():
    """SAFETY 拦截时返回 error + error_message(不抛异常)。"""
    p = GeminiProvider(api_key="k")

    fake_data = {
        "candidates": [{"finishReason": "SAFETY", "content": {"parts": []}}],
        "usageMetadata": {},
    }
    fake_resp = MagicMock()
    fake_resp.status_code = 200
    fake_resp.json.return_value = fake_data

    fake_client = MagicMock()
    fake_client.request = AsyncMock(return_value=fake_resp)

    with _patch_http_client(fake_client):
        result = await p.complete([{"role": "user", "content": "x"}], "gemini-1.5-pro")

    assert result["content"] == ""
    assert result["error"] is True
    assert "SAFETY" in result["error_message"]


async def test_complete_recitation_block_returns_error_message():
    """RECITATION 拦截也返回 error。"""
    p = GeminiProvider(api_key="k")

    fake_data = {
        "candidates": [{"finishReason": "RECITATION", "content": {"parts": []}}],
    }
    fake_resp = MagicMock()
    fake_resp.status_code = 200
    fake_resp.json.return_value = fake_data

    fake_client = MagicMock()
    fake_client.request = AsyncMock(return_value=fake_resp)

    with _patch_http_client(fake_client):
        result = await p.complete([{"role": "user", "content": "x"}], "gemini-1.5-pro")

    assert result["error"] is True


async def test_complete_4xx_raises_provider_error():
    """complete 4xx 抛 ProviderError。"""
    p = GeminiProvider(api_key="k")

    fake_resp = MagicMock()
    fake_resp.status_code = 400
    fake_resp.json.return_value = {"error": "bad request"}

    fake_client = MagicMock()
    fake_client.request = AsyncMock(return_value=fake_resp)

    with _patch_http_client(fake_client):
        with pytest.raises(ProviderError) as exc_info:
            await p.complete([{"role": "user", "content": "x"}], "gemini-1.5-pro")

    assert exc_info.value.status_code == 400


# =============================================================================
# astream
# =============================================================================


def _make_stream_resp(lines: list[str], status_code: int = 200) -> MagicMock:
    resp = MagicMock()
    resp.status_code = status_code

    async def _aiter_lines():
        for line in lines:
            yield line

    resp.aiter_lines = _aiter_lines
    resp.aread = AsyncMock(return_value=b"err")
    return resp


class _FakeStreamCtx:
    def __init__(self, resp: MagicMock) -> None:
        self.resp = resp

    async def __aenter__(self) -> MagicMock:
        return self.resp

    async def __aexit__(self, *args: Any) -> None:
        return None


async def test_astream_yields_chunks_and_done():
    """astream 正常流:chunk + done。"""
    p = GeminiProvider(api_key="k")

    evt1 = {"candidates": [{"content": {"parts": [{"text": "hello"}]}}]}
    evt2 = {
        "candidates": [{"content": {"parts": [{"text": " world"}]}}],
        "usageMetadata": {"totalTokenCount": 5},
    }
    lines = [
        f"data: {json.dumps(evt1)}",
        f"data: {json.dumps(evt2)}",
    ]
    resp = _make_stream_resp(lines)
    fake_client = MagicMock()
    fake_client.stream = MagicMock(return_value=_FakeStreamCtx(resp))

    with _patch_http_client(fake_client):
        events = [e async for e in p.astream([{"role": "user", "content": "x"}], "gemini-1.5-pro")]

    chunks = [e for e in events if e["type"] == "chunk"]
    assert "".join(c["content"] for c in chunks) == "hello world"
    done = next(e for e in events if e["type"] == "done")
    assert done["usage"] == {"totalTokenCount": 5}


async def test_astream_safety_block_yields_error():
    """流式 SAFETY 拦截(无 chunk) yield error。"""
    p = GeminiProvider(api_key="k")

    evt = {"candidates": [{"finishReason": "SAFETY", "content": {"parts": []}}]}
    lines = [f"data: {json.dumps(evt)}"]
    resp = _make_stream_resp(lines)
    fake_client = MagicMock()
    fake_client.stream = MagicMock(return_value=_FakeStreamCtx(resp))

    with _patch_http_client(fake_client):
        events = [e async for e in p.astream([{"role": "user", "content": "x"}], "gemini-1.5-pro")]

    assert any(e["type"] == "error" for e in events)


async def test_astream_4xx_yields_error_event():
    """4xx yield error 事件。"""
    p = GeminiProvider(api_key="k")

    resp = _make_stream_resp([], status_code=500)
    fake_client = MagicMock()
    fake_client.stream = MagicMock(return_value=_FakeStreamCtx(resp))

    with _patch_http_client(fake_client):
        events = [e async for e in p.astream([{"role": "user", "content": "x"}], "gemini-1.5-pro")]

    assert len(events) == 1
    assert events[0]["type"] == "error"


async def test_astream_httpx_error_yields_error_event():
    """httpx 异常 yield error 事件。"""
    p = GeminiProvider(api_key="k")

    fake_client = MagicMock()
    fake_client.stream = MagicMock(side_effect=httpx.ConnectError("refused"))

    with _patch_http_client(fake_client):
        events = [e async for e in p.astream([{"role": "user", "content": "x"}], "gemini-1.5-pro")]

    assert len(events) == 1
    assert events[0]["type"] == "error"


# =============================================================================
# list_models
# =============================================================================


async def test_list_models_returns_models_list():
    """list_models 返回 models 数组。"""
    p = GeminiProvider(api_key="k")

    fake_data = {"models": [{"name": "gemini-1.5-pro"}, {"name": "gemini-1.5-flash"}]}
    fake_resp = MagicMock()
    fake_resp.status_code = 200
    fake_resp.json.return_value = fake_data

    fake_client = MagicMock()
    fake_client.request = AsyncMock(return_value=fake_resp)

    with _patch_http_client(fake_client):
        models = await p.list_models()

    assert len(models) == 2
    assert models[0]["name"] == "gemini-1.5-pro"
