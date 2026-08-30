"""原生 function calling 全链路真实 provider e2e 联调测试(2026-08-31 立)。

与 test_native_fc_tools_passthrough.py(mock 层)互补,本文件做真实网络调用:
CLI(apps/cli runToolLoop)→ /api/llm/complete/stream(extraBody.tools)→
routers/llm.py generic 路径透传 tools/tool_choice → llm_gateway.astream →
真实上游 provider(OpenAI 兼容 / Anthropic 原生)→ 流式 tool_calls 累积 →
SSE tool-call-start 事件(ToolCallEvent 契约:type/toolCallId/toolName/args)。

可用性探测(模块导入时快照,conftest autouse fixture 会按测试清空环境):
- OpenAI 兼容 provider:llm_providers JSON 的 stepfun 条目(国内直连,免代理);
- Anthropic:os.environ ANTHROPIC_API_KEY 或 llm_providers JSON anthropic 条目。
无 key 的测试用 pytest.mark.skipif 自动跳过,不在无 key 环境产生误报。

真实调用统一 asyncio.wait_for 60s 超时(未引入 pytest-timeout 依赖)。
"""

from __future__ import annotations

import asyncio
import json
import os
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import settings
from app.main import app

# =============================================================================
# 环境可用性探测(模块导入时快照 —— conftest 的 autouse fixture 在每个测试
# 开始时才清空 os.environ vendor key 与 settings.llm_providers,此处先留存真实值)
# =============================================================================

_REAL_LLM_PROVIDERS = settings.llm_providers or ""
_REAL_ANTHROPIC_ENV_KEY = os.environ.get("ANTHROPIC_API_KEY") or ""


def _real_providers_json() -> dict[str, Any]:
    """解析 .env LLM_PROVIDERS JSON(失败返回空 dict,不抛错)。"""
    try:
        data = json.loads(_REAL_LLM_PROVIDERS)
    except (json.JSONDecodeError, TypeError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


# OpenAI 兼容 provider:stepfun(国内直连;key 在 llm_providers JSON 中)
_OPENAI_COMPAT_MODEL = os.environ.get(
    "NATIVE_FC_E2E_OPENAI_COMPAT_MODEL", "stepfun/step-3.7-flash"
)
_HAS_OPENAI_COMPAT_KEY = bool(
    (_real_providers_json().get("stepfun") or {}).get("api_key")
)

# Anthropic:官方 key(os.environ)或 llm_providers JSON anthropic 条目
_ANTHROPIC_MODEL = os.environ.get(
    "NATIVE_FC_E2E_ANTHROPIC_MODEL", "anthropic/claude-sonnet-4-5"
)
_HAS_ANTHROPIC_KEY = bool(
    _REAL_ANTHROPIC_ENV_KEY
    or (_real_providers_json().get("anthropic") or {}).get("api_key")
)

requires_openai_compat_key = pytest.mark.skipif(
    not _HAS_OPENAI_COMPAT_KEY,
    reason="未配置 OpenAI 兼容 provider key(llm_providers JSON 无 stepfun 条目),跳过真实 e2e",
)
requires_anthropic_key = pytest.mark.skipif(
    not _HAS_ANTHROPIC_KEY,
    reason="未配置 ANTHROPIC_API_KEY(或 llm_providers JSON anthropic 条目),跳过 Anthropic 真实 e2e",
)


# =============================================================================
# 公共 fixture / 工具
# =============================================================================


@pytest.fixture
async def client():
    """异步 HTTP 测试客户端(httpx + ASGI,app fixture 层直连 router)。"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


def _parse_sse_events(raw: str) -> list[dict[str, Any]]:
    """解析 SSE 原始文本为事件列表:[{"event": "chunk", "data": {...}}, ...]"""
    events: list[dict[str, Any]] = []
    for block in raw.split("\n\n"):
        if not block.strip():
            continue
        event_type: str | None = None
        data: Any = None
        for line in block.split("\n"):
            if line.startswith("event:"):
                event_type = line[6:].strip()
            elif line.startswith("data:"):
                data_str = line[5:].strip()
                try:
                    data = json.loads(data_str)
                except (json.JSONDecodeError, ValueError):
                    data = data_str
        if event_type or data is not None:
            events.append({"event": event_type, "data": data})
    return events


async def _stream_chat(client: AsyncClient, body: dict[str, Any]) -> str:
    """调用 /api/llm/complete/stream 并返回原始 SSE 文本(60s 超时兜底)。"""
    resp = await asyncio.wait_for(
        client.post("/api/llm/complete/stream", json=body), timeout=60.0
    )
    assert resp.status_code == 200, f"HTTP {resp.status_code}: {resp.text[:500]}"
    return resp.text


def _restore_real_llm_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """恢复 conftest 清空的真实 LLM provider 配置(真实调用前提):
    - settings.llm_providers:.env 的 provider JSON(_resolve/_is_stub_mode 数据源);
    - ANTHROPIC_API_KEY:os.environ 官方 key(如有)。
    同时放开受限模型门禁(测试无 JWT,stepfun/agnes/anthropic 均属受限前缀)。
    """
    from app.routers import llm as llm_router

    if _REAL_LLM_PROVIDERS:
        monkeypatch.setattr(settings, "llm_providers", _REAL_LLM_PROVIDERS)
    if _REAL_ANTHROPIC_ENV_KEY:
        monkeypatch.setenv("ANTHROPIC_API_KEY", _REAL_ANTHROPIC_ENV_KEY)
    monkeypatch.setattr(llm_router, "_is_restricted_model", lambda m: False)


_WEATHER_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "查询指定城市的实时天气",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "城市名,如:上海",
                    }
                },
                "required": ["location"],
            },
        },
    }
]

_FORCE_TOOL_MESSAGES = [
    {
        "role": "system",
        "content": "你是天气助手。收到天气相关问题时,必须调用 get_weather 工具查询,禁止凭空回答。",
    },
    {"role": "user", "content": "用 get_weather 工具查一下上海的天气"},
]


def _assert_tool_call_start(events: list[dict[str, Any]], provider_desc: str) -> None:
    """断言 SSE 流中出现符合 ToolCallEvent 契约的 tool-call-start(get_weather/上海)。"""
    err_events = [e for e in events if e["event"] == "error"]
    assert not err_events, f"{provider_desc} 流内 error 事件: {err_events[:1]}"

    tc_events = [e for e in events if e["event"] == "tool-call-start"]
    assert tc_events, (
        f"{provider_desc} 未收到 tool-call-start 事件,"
        f"事件类型分布: {sorted({str(e['event']) for e in events})}"
    )

    first = tc_events[0]["data"]
    assert first["type"] == "tool-call-start"
    assert first["toolName"] == "get_weather", f"toolName={first.get('toolName')!r}"
    args = first["args"]
    assert isinstance(args, dict), f"args 未解析为 dict: {args!r}"
    assert "location" in args, f"args 缺 location 字段: {args!r}"
    assert "上海" in str(args.get("location", "")), f"location 不含上海: {args!r}"
    # toolCallId 契约字段存在(真实 provider 会给 call_xxx / toolu_xxx 形态)
    assert first.get("toolCallId"), "toolCallId 为空"

    # 原生 tool_calls 事件不外漏(已转换为 tool-call-start)
    assert not [e for e in events if e["event"] == "tool_calls"]

    # 流正常收尾
    assert [e for e in events if e["event"] == "done"], "缺少 done 事件"


# =============================================================================
# 测试 1:OpenAI 兼容 provider 真实 e2e(stepfun 原生适配器路径)
# =============================================================================


@requires_openai_compat_key
async def test_openai_compat_provider_real_native_fc(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """OpenAI 兼容 provider(stepfun/*)真实全链路:

    HTTP tools/tool_choice → router 透传 → llm_gateway.astream(tools 存在 →
    StepfunProvider 厂商原生流式)→ 流式 tool_calls 分片累积 →
    SSE tool-call-start(toolName=get_weather,args 含 location=上海)。
    """
    _restore_real_llm_env(monkeypatch)

    raw = await _stream_chat(client, {
        "messages": _FORCE_TOOL_MESSAGES,
        "model": _OPENAI_COMPAT_MODEL,
        "tools": _WEATHER_TOOLS,
        "tool_choice": "auto",
    })
    events = _parse_sse_events(raw)
    _assert_tool_call_start(events, f"[{_OPENAI_COMPAT_MODEL}] OpenAI 兼容真实链路")


# =============================================================================
# 测试 2:Anthropic 原生协议真实 e2e(tool_schema_adapter 转换路径)
# =============================================================================


@requires_anthropic_key
async def test_anthropic_provider_real_native_fc(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Anthropic 真实全链路:

    OpenAI 格式 tools → tool_schema_adapter.openai_tools_to_anthropic(input_schema)
    → AnthropicProvider.astream(/v1/messages 流式)→ content_block_start/input_json_delta
    分片累积 → anthropic_response_to_openai → SSE tool-call-start。

    注:不传 tool_choice(Anthropic 要求对象形态 {"type": "auto"},而请求侧契约是
    OpenAI 字符串 "auto";省略时 Anthropic 默认 auto,由强 prompt 引导调用工具)。
    """
    _restore_real_llm_env(monkeypatch)

    raw = await _stream_chat(client, {
        "messages": _FORCE_TOOL_MESSAGES,
        "model": _ANTHROPIC_MODEL,
        "tools": _WEATHER_TOOLS,
    })
    events = _parse_sse_events(raw)
    _assert_tool_call_start(events, f"[{_ANTHROPIC_MODEL}] Anthropic 真实链路")
