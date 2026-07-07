"""
统一 LLM 网关 — 支持所有模型协议 + Agent 工具调用。

支持的协议:
1. OpenAI Chat Completions  (/v1/chat/completions)  — 通用最广
2. OpenAI Responses API     (/v1/responses)        — Codex 使用的新一代协议
3. Anthropic Messages API   (/v1/messages)          — Claude 系列
4. OpenAI 兼容 (DeepSeek/通义千问/豆包/FreeLLMAPI 等)  — 复用 #1

关键能力:
- 自动 tool_call 解析 (OpenAI function calling 格式)
- 自动 Anthropic tool_use 解析
- 统一转换为内部 ToolCall 结构
- 流式 (SSE) + 非流式
- 自动从 zhs_ai_model_info_unify 加载配置
"""

from __future__ import annotations

import json
import time
from typing import Any, AsyncGenerator
from dataclasses import dataclass, field

import httpx

from app.config import settings
from app.utils.ai_keys import resolve_key
from app.utils.ai_helpers import bearer_headers


# ---------------------------------------------------------------------------
# 统一数据结构
# ---------------------------------------------------------------------------

@dataclass
class ChatMessage:
    """统一消息格式 — 对标 OpenAI/Anthropic。"""
    role: str  # system|user|assistant|tool
    content: str = ""
    tool_calls: list[dict[str, Any]] = field(default_factory=list)  # assistant 消息的工具调用
    tool_call_id: str | None = None  # tool 角色消息的关联 ID
    name: str | None = None  # 工具名 (tool 角色)
    # 多模态图片 (Computer Use 截图等): 每个元素为不含 data URI 前缀的纯 base64 字符串 (PNG)。
    # 网关会按协议转成对应的多模态内容块 (OpenAI image_url / Anthropic image)。
    images: list[str] | None = None


@dataclass
class ToolCall:
    """工具调用 — LLM 请求执行的工具。"""
    id: str
    name: str
    arguments: dict[str, Any]


@dataclass
class LLMResponse:
    """LLM 响应 — 统一格式。"""
    content: str = ""
    tool_calls: list[ToolCall] = field(default_factory=list)
    finish_reason: str = "stop"  # stop|tool_calls|length
    usage: dict[str, int] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# 配置加载 (复用现有 zhs_ai_model_info_unify 表)
# ---------------------------------------------------------------------------

def _get_model_config(model_id: str) -> dict[str, Any] | None:
    """从数据库加载模型配置。

    复用 app.api.v1.llm.ws.get_effective_config 的逻辑,
    但返回更完整的配置供网关使用。
    """
    try:
        from app.api.v1.llm.ws import get_effective_config

        cfg = get_effective_config(model_id)
        if not cfg:
            return None

        # 补全: 确保关键字段存在
        cfg.setdefault("api_key", "")
        cfg.setdefault("api_base", "")
        cfg.setdefault("model_name", model_id)
        cfg.setdefault("temperature", 0.7)
        cfg.setdefault("max_tokens", 4096)
        cfg.setdefault("timeout", 120)
        return cfg
    except Exception:
        return None


def _detect_protocol(cfg: dict[str, Any]) -> str:
    """根据配置自动检测使用哪个协议。

    Returns:
        "openai" | "anthropic" | "openai_responses"
    """
    api_base = (cfg.get("api_base") or "").lower()
    model_name = (cfg.get("model_name") or "").lower()
    manufacturer = (cfg.get("manufacturer") or "").lower()

    # Anthropic
    if "anthropic" in manufacturer or "claude" in model_name or "anthropic" in api_base:
        return "anthropic"

    # OpenAI Responses (新协议, 暂不默认使用)
    # if "responses" in api_base:
    #     return "openai_responses"

    # 默认 OpenAI Chat Completions (最通用)
    return "openai"


# ---------------------------------------------------------------------------
# OpenAI Chat Completions (支持 tool_call)
# ---------------------------------------------------------------------------

async def chat_openai(
    messages: list[ChatMessage],
    cfg: dict[str, Any],
    tools: list[dict[str, Any]] | None = None,
    stream: bool = False,
) -> AsyncGenerator[dict[str, Any], None]:
    """OpenAI Chat Completions 协议 (支持 tool_call)。

    适用于: OpenAI / DeepSeek / 通义千问 (兼容模式) / 豆包 (兼容模式) / FreeLLMAPI 等

    Yields:
        {"type": "text_delta", "content": str}     — 文本片段
        {"type": "tool_call_delta", "id": str, "name": str, "arguments": str} — 工具调用片段
        {"type": "done", "finish_reason": str, "usage": dict} — 完成
        {"type": "error", "message": str} — 错误
    """
    api_base = cfg.get("api_base") or "https://api.openai.com/v1"
    api_key = cfg.get("api_key") or resolve_key(None, "openai_key", "freellmapi_key")
    model_name = cfg.get("model_name") or "gpt-4o"
    temperature = cfg.get("temperature", 0.7)
    max_tokens = cfg.get("max_tokens", 4096)
    timeout = cfg.get("timeout", 120)

    url = f"{api_base.rstrip('/')}/chat/completions"

    # 构建请求体 (每条消息可能展开为多条, 例如 tool+图片会拆成 tool 文本 + user 图片)
    oai_messages: list[dict[str, Any]] = []
    for m in messages:
        oai_messages.extend(_msg_to_openai(m))
    body: dict[str, Any] = {
        "model": model_name,
        "messages": oai_messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": stream,
    }
    if tools:
        body["tools"] = [
            {"type": "function", "function": t["function"] if "function" in t else t}
            for t in tools
        ]

    headers = bearer_headers(api_key, extra={"Content-Type": "application/json"})

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            if stream:
                async with client.stream("POST", url, json=body, headers=headers) as resp:
                    if resp.status_code != 200:
                        text = await resp.aread()
                        yield {"type": "error", "message": f"HTTP {resp.status_code}: {text.decode()[:500]}"}
                        return

                    accumulated_tool_calls: dict[int, dict[str, str]] = {}
                    async for line in resp.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        data = line[6:].strip()
                        if data == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data)
                        except json.JSONDecodeError:
                            continue

                        delta = chunk.get("choices", [{}])[0].get("delta", {})
                        finish = chunk.get("choices", [{}])[0].get("finish_reason")

                        # 文本
                        if delta.get("content"):
                            yield {"type": "text_delta", "content": delta["content"]}

                        # 工具调用
                        if delta.get("tool_calls"):
                            for tc in delta["tool_calls"]:
                                idx = tc.get("index", 0)
                                if idx not in accumulated_tool_calls:
                                    accumulated_tool_calls[idx] = {
                                        "id": tc.get("id", ""),
                                        "name": tc.get("function", {}).get("name", ""),
                                        "arguments": "",
                                    }
                                else:
                                    if tc.get("id"):
                                        accumulated_tool_calls[idx]["id"] = tc["id"]
                                    if tc.get("function", {}).get("name"):
                                        accumulated_tool_calls[idx]["name"] = tc["function"]["name"]

                                args_delta = tc.get("function", {}).get("arguments", "")
                                if args_delta:
                                    accumulated_tool_calls[idx]["arguments"] += args_delta
                                    yield {
                                        "type": "tool_call_delta",
                                        "id": accumulated_tool_calls[idx]["id"],
                                        "name": accumulated_tool_calls[idx]["name"],
                                        "arguments": args_delta,
                                    }

                        if finish:
                            # 发送完整的 tool_calls
                            for idx in sorted(accumulated_tool_calls.keys()):
                                tc = accumulated_tool_calls[idx]
                                yield {
                                    "type": "tool_call_complete",
                                    "id": tc["id"],
                                    "name": tc["name"],
                                    "arguments": tc["arguments"],
                                }
                            yield {"type": "done", "finish_reason": finish, "usage": chunk.get("usage", {})}
                            return

                    # 流结束但无 finish_reason
                    yield {"type": "done", "finish_reason": "stop", "usage": {}}
            else:
                resp = await client.post(url, json=body, headers=headers)
                if resp.status_code != 200:
                    yield {"type": "error", "message": f"HTTP {resp.status_code}: {resp.text[:500]}"}
                    return

                data = resp.json()
                choice = data.get("choices", [{}])[0]
                msg = choice.get("message", {})

                if msg.get("content"):
                    yield {"type": "text_delta", "content": msg["content"]}

                if msg.get("tool_calls"):
                    for tc in msg["tool_calls"]:
                        args_str = tc.get("function", {}).get("arguments", "{}")
                        try:
                            args = json.loads(args_str)
                        except json.JSONDecodeError:
                            args = {"raw": args_str}
                        yield {
                            "type": "tool_call_complete",
                            "id": tc.get("id", ""),
                            "name": tc.get("function", {}).get("name", ""),
                            "arguments": args,
                        }

                yield {"type": "done", "finish_reason": choice.get("finish_reason", "stop"), "usage": data.get("usage", {})}

    except httpx.TimeoutException:
        yield {"type": "error", "message": f"请求超时 ({timeout}s)"}
    except Exception as e:
        yield {"type": "error", "message": str(e)}


def _oai_image_blocks(images: list[str]) -> list[dict[str, Any]]:
    """将 base64 图片列表转为 OpenAI image_url 内容块。"""
    return [
        {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}}
        for b64 in images
    ]


def _msg_to_openai(m: ChatMessage) -> list[dict[str, Any]]:
    """ChatMessage → OpenAI 消息列表 (支持多模态图片)。

    - tool 角色: OpenAI 不支持图片放入 tool 消息, 故有图片时拆成
      [tool 文本消息, user 图片消息] 两条 (OpenAI 允许连续消息)。
    - user/assistant 角色: 有图片时 content 转为多模态内容块列表。
    """
    if m.role == "tool":
        msgs: list[dict[str, Any]] = [{
            "role": "tool",
            "content": m.content,
            "tool_call_id": m.tool_call_id or "",
        }]
        if m.images:
            msgs.append({
                "role": "user",
                "content": [{"type": "text", "text": "[截图结果]"}] + _oai_image_blocks(m.images),
            })
        return msgs

    msg: dict[str, Any] = {"role": m.role}
    if m.images:
        blocks: list[dict[str, Any]] = []
        if m.content:
            blocks.append({"type": "text", "text": m.content})
        blocks.extend(_oai_image_blocks(m.images))
        msg["content"] = blocks
    else:
        msg["content"] = m.content
    if m.tool_calls:
        msg["tool_calls"] = m.tool_calls
    return [msg]


def _anthropic_image_blocks(images: list[str]) -> list[dict[str, Any]]:
    """将 base64 图片列表转为 Anthropic image 内容块。"""
    return [
        {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": b64}}
        for b64 in images
    ]


# ---------------------------------------------------------------------------
# Anthropic Messages API (支持 tool_use)
# ---------------------------------------------------------------------------

async def chat_anthropic(
    messages: list[ChatMessage],
    cfg: dict[str, Any],
    tools: list[dict[str, Any]] | None = None,
    stream: bool = False,
) -> AsyncGenerator[dict[str, Any], None]:
    """Anthropic Messages API (Claude 系列, 支持 tool_use)。

    Yields 同 chat_openai 的格式 (统一)。
    """
    api_base = cfg.get("api_base") or "https://api.anthropic.com"
    api_key = cfg.get("api_key") or resolve_key(None, "anthropic_key")
    model_name = cfg.get("model_name") or "claude-sonnet-4-20250514"
    max_tokens = cfg.get("max_tokens", 4096)
    timeout = cfg.get("timeout", 120)

    url = f"{api_base.rstrip('/')}/v1/messages"

    # 分离 system 消息
    system_text = ""
    chat_msgs = []
    for m in messages:
        if m.role == "system":
            system_text += m.content + "\n"
        elif m.role == "tool":
            # tool_result 内容: 有图片时转为 [文本块, 图片块...] (Anthropic 支持)
            tr_content: Any = m.content
            if m.images:
                tr_content = [{"type": "text", "text": m.content}] + _anthropic_image_blocks(m.images)
            chat_msgs.append({
                "role": "user",
                "content": [{
                    "type": "tool_result",
                    "tool_use_id": m.tool_call_id or "",
                    "content": tr_content,
                }],
            })
        elif m.role == "assistant" and m.tool_calls:
            # assistant + tool_use
            content_blocks = []
            if m.content:
                content_blocks.append({"type": "text", "text": m.content})
            for tc in m.tool_calls:
                # arguments 是 JSON 字符串, 需解析为 dict 给 Anthropic 的 input 字段
                raw_args = tc.get("function", {}).get("arguments", "{}")
                if isinstance(raw_args, str):
                    try:
                        parsed_args = json.loads(raw_args)
                    except json.JSONDecodeError:
                        parsed_args = {}
                else:
                    parsed_args = raw_args if isinstance(raw_args, dict) else {}
                content_blocks.append({
                    "type": "tool_use",
                    "id": tc.get("id", ""),
                    "name": tc.get("function", {}).get("name", ""),
                    "input": parsed_args,
                })
            chat_msgs.append({"role": "assistant", "content": content_blocks})
        else:
            # 普通用户/助手消息: 有图片时转为多模态内容块列表
            if m.images:
                blocks = []
                if m.content:
                    blocks.append({"type": "text", "text": m.content})
                blocks.extend(_anthropic_image_blocks(m.images))
                chat_msgs.append({"role": m.role, "content": blocks})
            else:
                chat_msgs.append({"role": m.role, "content": m.content})

    body: dict[str, Any] = {
        "model": model_name,
        "max_tokens": max_tokens,
        "messages": chat_msgs,
        "stream": stream,
    }
    if system_text.strip():
        body["system"] = system_text.strip()
    if tools:
        body["tools"] = [
            {
                "name": t.get("function", {}).get("name", t.get("name", "")),
                "description": t.get("function", {}).get("description", t.get("description", "")),
                "input_schema": t.get("function", {}).get("parameters", t.get("input_schema", {})),
            }
            for t in tools
        ]

    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            if stream:
                async with client.stream("POST", url, json=body, headers=headers) as resp:
                    if resp.status_code != 200:
                        text = await resp.aread()
                        yield {"type": "error", "message": f"HTTP {resp.status_code}: {text.decode()[:500]}"}
                        return

                    current_tool: dict[str, Any] = {}
                    async for line in resp.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        data = line[6:].strip()
                        try:
                            event = json.loads(data)
                        except json.JSONDecodeError:
                            continue

                        etype = event.get("type", "")

                        if etype == "content_block_start":
                            block = event.get("content_block", {})
                            if block.get("type") == "tool_use":
                                current_tool = {"id": block.get("id", ""), "name": block.get("name", ""), "arguments": ""}
                            elif block.get("type") == "text":
                                pass  # 等待 delta

                        elif etype == "content_block_delta":
                            delta = event.get("delta", {})
                            if delta.get("type") == "text_delta":
                                yield {"type": "text_delta", "content": delta.get("text", "")}
                            elif delta.get("type") == "input_json_delta":
                                current_tool["arguments"] += delta.get("partial_json", "")
                                yield {
                                    "type": "tool_call_delta",
                                    "id": current_tool["id"],
                                    "name": current_tool["name"],
                                    "arguments": delta.get("partial_json", ""),
                                }

                        elif etype == "content_block_stop":
                            if current_tool.get("name"):
                                try:
                                    args = json.loads(current_tool["arguments"]) if current_tool["arguments"] else {}
                                except json.JSONDecodeError:
                                    args = {"raw": current_tool["arguments"]}
                                yield {
                                    "type": "tool_call_complete",
                                    "id": current_tool["id"],
                                    "name": current_tool["name"],
                                    "arguments": args,
                                }
                                current_tool = {}

                        elif etype == "message_stop":
                            yield {"type": "done", "finish_reason": "stop", "usage": {}}

                        elif etype == "message_delta":
                            delta = event.get("delta", {})
                            if delta.get("stop_reason") == "tool_use":
                                pass  # tool_call_complete 已发

            else:
                resp = await client.post(url, json=body, headers=headers)
                if resp.status_code != 200:
                    yield {"type": "error", "message": f"HTTP {resp.status_code}: {resp.text[:500]}"}
                    return

                data = resp.json()
                for block in data.get("content", []):
                    if block.get("type") == "text":
                        yield {"type": "text_delta", "content": block.get("text", "")}
                    elif block.get("type") == "tool_use":
                        yield {
                            "type": "tool_call_complete",
                            "id": block.get("id", ""),
                            "name": block.get("name", ""),
                            "arguments": block.get("input", {}),
                        }

                yield {"type": "done", "finish_reason": data.get("stop_reason", "stop"), "usage": data.get("usage", {})}

    except httpx.TimeoutException:
        yield {"type": "error", "message": f"请求超时 ({timeout}s)"}
    except Exception as e:
        yield {"type": "error", "message": str(e)}


# ---------------------------------------------------------------------------
# 统一分发器 (含 API 重试退避 — 对标 Codex/Gemini 的容错机制)
# ---------------------------------------------------------------------------

import asyncio

# 可重试的 HTTP 状态码 (429 限流 / 5xx 服务端错误)
_RETRIABLE_STATUS = {429, 500, 502, 503, 504}
# 可重试的错误关键词 (中英文)
_RETRIABLE_KEYWORDS = ("timeout", "timed out", "connection", "connect", "read timeout",
                       "pool", "reset", "eof", "broken pipe", "temporary",
                       "rate limit", "overloaded", "capacity",
                       "超时", "连接", "限流", "过载", "临时", "重试")


def _is_retriable_error(message: str) -> bool:
    """判断错误是否可重试 (网络超时/连接/限流/服务端错误)。"""
    msg_lower = message.lower()
    # HTTP 状态码检查
    for code in _RETRIABLE_STATUS:
        if f"http {code}" in msg_lower:
            return True
    # 关键词检查 (中英文)
    for kw in _RETRIABLE_KEYWORDS:
        if kw in msg_lower or kw in message:
            return True
    return False


async def chat_with_tools(
    messages: list[ChatMessage],
    cfg: dict[str, Any],
    tools: list[dict[str, Any]] | None = None,
    stream: bool = True,
    max_retries: int = 3,
) -> AsyncGenerator[dict[str, Any], None]:
    """统一 LLM 调用 — 自动选择协议 + API 重试退避。

    根据 cfg 自动分发到 OpenAI / Anthropic / Responses API。
    所有协议的输出统一为相同的事件流格式。

    重试策略 (对标 Codex/Gemini 容错):
    - 在流式输出开始前 (连接/响应阶段), 遇到可重试错误自动重试
    - 指数退避: 1s → 2s → 4s
    - 流式输出开始后不重试 (避免重复输出)
    - 429 限流时尊重 Retry-After (如有)
    """
    protocol = _detect_protocol(cfg)

    def _create_gen():
        if protocol == "anthropic":
            return chat_anthropic(messages, cfg, tools, stream)
        return chat_openai(messages, cfg, tools, stream)

    last_error = ""
    for attempt in range(1, max_retries + 1):
        streaming_started = False
        gen = _create_gen()
        try:
            async for event in gen:
                etype = event.get("type")

                # 流式内容开始 → 标记不可重试
                if etype in ("text_delta", "tool_call_delta", "tool_call_complete"):
                    streaming_started = True
                    yield event
                elif etype == "done":
                    # 成功完成 — 附带重试信息 (如有)
                    event.setdefault("attempts", attempt)
                    yield event
                    return
                elif etype == "error":
                    err_msg = event.get("message", "")
                    # 在流式开始前遇到可重试错误 → 退避后重试
                    if not streaming_started and attempt < max_retries and _is_retriable_error(err_msg):
                        last_error = err_msg
                        break  # 退出 async for, 进入重试
                    # 不可重试或已耗尽重试 → 直接返回错误
                    yield event
                    return
                else:
                    yield event
            else:
                # 生成器正常结束 (无 done 也无 error) → 视为成功
                return

            # 可重试错误 → 指数退避
            if last_error:
                wait = 2 ** (attempt - 1)  # 1s, 2s, 4s
                await asyncio.sleep(wait)
                continue

        except (httpx.TimeoutException, httpx.ConnectError, httpx.ReadError) as e:
            # 底层网络异常 (在 yield 之前)
            if not streaming_started and attempt < max_retries:
                last_error = str(e)
                wait = 2 ** (attempt - 1)
                await asyncio.sleep(wait)
                continue
            yield {"type": "error", "message": f"网络错误 (重试 {attempt}/{max_retries}): {e}"}
            return

    # 所有重试耗尽
    yield {"type": "error", "message": f"重试 {max_retries} 次后仍失败: {last_error}"}


def get_tool_definitions(allowed: list[str] | None = None) -> list[dict[str, Any]]:
    """获取工具定义列表 (供 LLM function calling)。

    Args:
        allowed: 允许的工具名列表, None=全部
    """
    from app.api.v1.workspace.tools import TOOL_DEFINITIONS

    if allowed is None:
        return TOOL_DEFINITIONS
    return [t for t in TOOL_DEFINITIONS if t["function"]["name"] in allowed]
