"""协议互转适配器(2026-07-30 立,对齐 OmniRoute 三协议互转 + 超越)。

OmniRoute 支持 OpenAI Chat Completions / Anthropic Messages / Gemini generateContent
三协议互转,允许客户端用任意一种协议调用,IHUI 在此基础上扩展:

- **协议透传**:检测客户端入站协议,直接走对应原生 provider 适配器,避免"先转 OpenAI 再转回"
  的二次格式损失(对齐 OmniRoute 的协议感知路由)。
- **OpenAI canonical**:内部以 OpenAI Chat Completions 格式为 canonical 中转格式,
  messages/tools/response 三层互转。
- **响应反向归一**:无论 provider 返回哪种协议响应,统一转回客户端入站协议格式。

三协议核心差异速查:

| 维度         | OpenAI Chat Completions             | Anthropic Messages                  | Gemini generateContent                |
| ------------ | ----------------------------------- | ----------------------------------- | ------------------------------------- |
| system       | messages[0].role=system             | 独立 system 参数                     | systemInstruction.parts[0].text        |
| role 命名    | user/assistant/tool                 | user/assistant(无 tool)            | user/model(无 assistant/tool)         |
| content      | string 或 array                     | content blocks[{type,text/tool_use}] | parts[{text/functionCall}]            |
| tools        | [{type:function,function:{name,...}}] | [{name,description,input_schema}]   | [{functionDeclarations:[{name,...}]}] |
| tool_calls   | message.tool_calls[{id,function}]   | content block type=tool_use         | parts functionCall                     |
| tool_result  | role=tool, content=string           | role=user, content[{type:tool_result}] | 不支持(用 parts functionResponse)   |
| 采样参数     | temperature/top_p/max_tokens         | temperature/top_p/max_tokens(必填)  | generationConfig.{temperature,topP,maxOutputTokens} |
| 响应 text    | choices[0].message.content          | content blocks[type=text].text      | candidates[0].content.parts[text]      |
| 响应 usage   | usage.{prompt,completion}_tokens    | usage.{input,output}_tokens         | usageMetadata.{promptTokenCount,candidatesTokenCount} |

本模块仅做"格式转换"纯函数,不发起 HTTP 请求,不耦合 provider 适配器实例,
便于单元测试与在 combo_router / llm_gateway / agent_loop 任意层复用。
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)


class ProtocolType(str, Enum):
    """LLM API 协议类型。"""

    OPENAI = "openai_chat"  # OpenAI Chat Completions(/v1/chat/completions)
    ANTHROPIC = "anthropic_messages"  # Anthropic Messages(/v1/messages)
    GEMINI = "gemini_generate_content"  # Gemini generateContent(/v1beta/models/{model}:generateContent)


# ---------------- 入站协议探测 ----------------


def detect_protocol(payload: dict[str, Any]) -> ProtocolType:
    """根据请求 payload 自动探测入站协议。

    判定顺序(命中即返回,避免误判):
    1. Gemini:payload 含 ``contents`` 字段(Gemini 独有)
    2. Anthropic:payload 含 ``max_tokens`` 且 ``messages`` 内无 system role,
       或 payload 含 ``system`` 字段(Anthropic 独立 system 参数)
    3. OpenAI:payload 含 ``messages`` 字段(默认 fallback)

    Args:
        payload: 客户端原始请求 body。

    Returns:
        探测到的协议类型,默认 OpenAI。
    """
    if "contents" in payload:
        return ProtocolType.GEMINI
    if "system" in payload and "messages" in payload:
        return ProtocolType.ANTHROPIC
    if "messages" in payload:
        msgs = payload["messages"]
        if isinstance(msgs, list) and any(
            isinstance(m, dict) and m.get("role") == "system" for m in msgs
        ):
            # OpenAI 把 system 放在 messages 里;Anthropic 用独立 system 参数
            return ProtocolType.OPENAI
        # 无 system role 的 messages 既可能是 Anthropic 也可能是 OpenAI,
        # 用 max_tokens 是否必填的语义无法在 payload 层判定,降级 OpenAI
        return ProtocolType.OPENAI
    # 兜底:无 messages 字段的非标请求,按 OpenAI 处理(后续 normalize 会失败上抛)
    return ProtocolType.OPENAI


# ---------------- OpenAI ↔ Anthropic ----------------


def openai_to_anthropic_request(openai_req: dict[str, Any]) -> dict[str, Any]:
    """OpenAI Chat Completions 请求 → Anthropic Messages 请求。

    转换规则:
    - messages 中 role=system 抽出为独立 system 参数
    - role=tool 转为 role=user + content[{type:tool_result, tool_use_id, content}]
    - tools[].function.parameters → tools[].input_schema
    - max_tokens 必填(Anthropic 强制),缺省补 4096
    - temperature/top_p 透传,Top_p 保留原名(Anthropic 同名)
    """
    messages = openai_req.get("messages", [])
    system_parts: list[str] = []
    rest: list[dict[str, Any]] = []
    for m in messages:
        role = m.get("role")
        content = m.get("content", "")
        if role == "system":
            if isinstance(content, str):
                system_parts.append(content)
            else:
                system_parts.append(json.dumps(content, ensure_ascii=False))
        elif role == "tool":
            # OpenAI tool result → Anthropic user message + tool_result content block
            rest.append({
                "role": "user",
                "content": [{
                    "type": "tool_result",
                    "tool_use_id": m.get("tool_call_id", ""),
                    "content": content if isinstance(content, str) else json.dumps(content, ensure_ascii=False),
                }],
            })
        elif role == "assistant" and m.get("tool_calls"):
            # OpenAI assistant tool_calls → Anthropic assistant content blocks
            blocks: list[dict[str, Any]] = []
            if isinstance(content, str) and content:
                blocks.append({"type": "text", "text": content})
            for tc in m["tool_calls"]:
                fn = tc.get("function", {})
                try:
                    args = json.loads(fn.get("arguments", "{}"))
                except (json.JSONDecodeError, TypeError):
                    args = {}
                blocks.append({
                    "type": "tool_use",
                    "id": tc.get("id", ""),
                    "name": fn.get("name", ""),
                    "input": args,
                })
            rest.append({"role": "assistant", "content": blocks})
        else:
            rest.append(m)

    req: dict[str, Any] = {
        "model": _strip_provider_prefix(openai_req.get("model", "")),
        "messages": rest,
        "max_tokens": openai_req.get("max_tokens", 4096),
    }
    if system_parts:
        req["system"] = "\n\n".join(system_parts)
    if "temperature" in openai_req:
        req["temperature"] = openai_req["temperature"]
    if "top_p" in openai_req:
        req["top_p"] = openai_req["top_p"]
    if "stream" in openai_req:
        req["stream"] = openai_req["stream"]
    # tools 转换
    tools = openai_req.get("tools")
    if tools:
        req["tools"] = [_openai_tool_to_anthropic(t) for t in tools]
    if "tool_choice" in openai_req:
        req["tool_choice"] = _openai_tool_choice_to_anthropic(openai_req["tool_choice"])
    return req


def anthropic_to_openai_request(anthropic_req: dict[str, Any]) -> dict[str, Any]:
    """Anthropic Messages 请求 → OpenAI Chat Completions 请求。"""
    messages: list[dict[str, Any]] = []
    system = anthropic_req.get("system")
    if system:
        if isinstance(system, str):
            messages.append({"role": "system", "content": system})
        elif isinstance(system, list):
            # Anthropic system 可为 content blocks 数组
            text = " ".join(
                b.get("text", "") for b in system if isinstance(b, dict) and b.get("type") == "text"
            )
            if text:
                messages.append({"role": "system", "content": text})

    for m in anthropic_req.get("messages", []):
        role = m.get("role", "user")
        content = m.get("content")
        if isinstance(content, list):
            # 检测 tool_result block(OpenAI 转 role=tool)
            if any(isinstance(b, dict) and b.get("type") == "tool_result" for b in content):
                for b in content:
                    if isinstance(b, dict) and b.get("type") == "tool_result":
                        messages.append({
                            "role": "tool",
                            "tool_call_id": b.get("tool_use_id", ""),
                            "content": b.get("content", ""),
                        })
            elif any(isinstance(b, dict) and b.get("type") == "tool_use" for b in content):
                # assistant tool_use block → OpenAI assistant.tool_calls
                text_parts: list[str] = []
                tool_calls: list[dict[str, Any]] = []
                for b in content:
                    if not isinstance(b, dict):
                        continue
                    if b.get("type") == "text":
                        text_parts.append(b.get("text", ""))
                    elif b.get("type") == "tool_use":
                        tool_calls.append({
                            "id": b.get("id", ""),
                            "type": "function",
                            "function": {
                                "name": b.get("name", ""),
                                "arguments": json.dumps(b.get("input", {}), ensure_ascii=False),
                            },
                        })
                msg: dict[str, Any] = {"role": "assistant", "content": "\n".join(text_parts)}
                if tool_calls:
                    msg["tool_calls"] = tool_calls
                messages.append(msg)
            else:
                # 纯文本 content blocks
                joined = " ".join(
                    b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text"
                )
                messages.append({"role": role, "content": joined})
        else:
            messages.append({"role": role, "content": content})

    req: dict[str, Any] = {
        "model": anthropic_req.get("model", ""),
        "messages": messages,
    }
    if "max_tokens" in anthropic_req:
        req["max_tokens"] = anthropic_req["max_tokens"]
    if "temperature" in anthropic_req:
        req["temperature"] = anthropic_req["temperature"]
    if "top_p" in anthropic_req:
        req["top_p"] = anthropic_req["top_p"]
    if "stream" in anthropic_req:
        req["stream"] = anthropic_req["stream"]
    tools = anthropic_req.get("tools")
    if tools:
        req["tools"] = [_anthropic_tool_to_openai(t) for t in tools]
    if "tool_choice" in anthropic_req:
        req["tool_choice"] = _anthropic_tool_choice_to_openai(anthropic_req["tool_choice"])
    return req


def openai_to_anthropic_response(openai_resp: dict[str, Any]) -> dict[str, Any]:
    """OpenAI Chat Completions 响应 → Anthropic Messages 响应格式。"""
    choices = openai_resp.get("choices", [])
    if not choices:
        return {"content": [], "model": openai_resp.get("model", ""), "usage": {}}
    msg = choices[0].get("message", {})
    content_blocks: list[dict[str, Any]] = []
    if msg.get("content"):
        content_blocks.append({"type": "text", "text": msg["content"]})
    for tc in msg.get("tool_calls", []) or []:
        fn = tc.get("function", {})
        try:
            args = json.loads(fn.get("arguments", "{}"))
        except (json.JSONDecodeError, TypeError):
            args = {}
        content_blocks.append({
            "type": "tool_use",
            "id": tc.get("id", ""),
            "name": fn.get("name", ""),
            "input": args,
        })

    usage = openai_resp.get("usage", {})
    return {
        "id": openai_resp.get("id", ""),
        "type": "message",
        "role": "assistant",
        "model": openai_resp.get("model", ""),
        "content": content_blocks,
        "stop_reason": _openai_finish_to_anthropic_stop(choices[0].get("finish_reason")),
        "usage": {
            "input_tokens": usage.get("prompt_tokens", 0),
            "output_tokens": usage.get("completion_tokens", 0),
        },
    }


def anthropic_to_openai_response(anthropic_resp: dict[str, Any]) -> dict[str, Any]:
    """Anthropic Messages 响应 → OpenAI Chat Completions 响应格式。"""
    content_blocks = anthropic_resp.get("content", [])
    text_parts: list[str] = []
    tool_calls: list[dict[str, Any]] = []
    for b in content_blocks:
        if not isinstance(b, dict):
            continue
        if b.get("type") == "text":
            text_parts.append(b.get("text", ""))
        elif b.get("type") == "tool_use":
            tool_calls.append({
                "id": b.get("id", ""),
                "type": "function",
                "function": {
                    "name": b.get("name", ""),
                    "arguments": json.dumps(b.get("input", {}), ensure_ascii=False),
                },
            })
    message: dict[str, Any] = {
        "role": "assistant",
        "content": "\n".join(text_parts),
    }
    if tool_calls:
        message["tool_calls"] = tool_calls
    usage = anthropic_resp.get("usage", {})
    return {
        "id": anthropic_resp.get("id", ""),
        "object": "chat.completion",
        "model": anthropic_resp.get("model", ""),
        "choices": [{
            "index": 0,
            "message": message,
            "finish_reason": _anthropic_stop_to_openai_finish(anthropic_resp.get("stop_reason")),
        }],
        "usage": {
            "prompt_tokens": usage.get("input_tokens", 0),
            "completion_tokens": usage.get("output_tokens", 0),
            "total_tokens": usage.get("input_tokens", 0) + usage.get("output_tokens", 0),
        },
    }


# ---------------- OpenAI ↔ Gemini ----------------


def openai_to_gemini_request(openai_req: dict[str, Any]) -> dict[str, Any]:
    """OpenAI Chat Completions 请求 → Gemini generateContent 请求。"""
    system_parts: list[str] = []
    contents: list[dict[str, Any]] = []
    for m in openai_req.get("messages", []):
        role = m.get("role")
        content = m.get("content", "")
        if role == "system":
            if isinstance(content, str):
                system_parts.append(content)
            else:
                system_parts.append(json.dumps(content, ensure_ascii=False))
        elif role == "tool":
            # OpenAI tool result → Gemini functionResponse part
            try:
                response_obj = json.loads(content) if isinstance(content, str) else content
            except (json.JSONDecodeError, TypeError):
                response_obj = {"result": content}
            contents.append({
                "role": "user",
                "parts": [{"functionResponse": {"name": m.get("tool_call_id", ""), "response": response_obj}}],
            })
        elif role == "assistant" and m.get("tool_calls"):
            parts: list[dict[str, Any]] = []
            if isinstance(content, str) and content:
                parts.append({"text": content})
            for tc in m["tool_calls"]:
                fn = tc.get("function", {})
                try:
                    args = json.loads(fn.get("arguments", "{}"))
                except (json.JSONDecodeError, TypeError):
                    args = {}
                parts.append({"functionCall": {"name": fn.get("name", ""), "args": args}})
            contents.append({"role": "model", "parts": parts})
        else:
            gemini_role = "user" if role == "user" else "model"
            text = content if isinstance(content, str) else json.dumps(content, ensure_ascii=False)
            contents.append({"role": gemini_role, "parts": [{"text": text}]})

    payload: dict[str, Any] = {"contents": contents}
    if system_parts:
        payload["systemInstruction"] = {"parts": [{"text": "\n\n".join(system_parts)}]}

    gen_config: dict[str, Any] = {}
    if "temperature" in openai_req:
        gen_config["temperature"] = openai_req["temperature"]
    if "top_p" in openai_req:
        gen_config["topP"] = openai_req["top_p"]
    if "max_tokens" in openai_req:
        gen_config["maxOutputTokens"] = openai_req["max_tokens"]
    if gen_config:
        payload["generationConfig"] = gen_config

    tools = openai_req.get("tools")
    if tools:
        declarations = [_openai_tool_to_gemini(t) for t in tools]
        if declarations:
            payload["tools"] = [{"functionDeclarations": declarations}]
    return payload


def gemini_to_openai_request(gemini_req: dict[str, Any]) -> dict[str, Any]:
    """Gemini generateContent 请求 → OpenAI Chat Completions 请求。"""
    messages: list[dict[str, Any]] = []
    sys_inst = gemini_req.get("systemInstruction")
    if isinstance(sys_inst, dict):
        sys_text = " ".join(
            p.get("text", "") for p in sys_inst.get("parts", []) if isinstance(p, dict) and "text" in p
        )
        if sys_text:
            messages.append({"role": "system", "content": sys_text})

    for c in gemini_req.get("contents", []):
        role = c.get("role", "user")
        parts = c.get("parts", [])
        openai_role = "assistant" if role == "model" else "user"
        # 检测 functionCall / functionResponse
        has_fc = any(isinstance(p, dict) and "functionCall" in p for p in parts)
        has_fr = any(isinstance(p, dict) and "functionResponse" in p for p in parts)
        if has_fr:
            for p in parts:
                if isinstance(p, dict) and "functionResponse" in p:
                    fr = p["functionResponse"]
                    messages.append({
                        "role": "tool",
                        "tool_call_id": fr.get("name", ""),
                        "content": json.dumps(fr.get("response", {}), ensure_ascii=False),
                    })
        elif has_fc:
            text_parts = [p.get("text", "") for p in parts if isinstance(p, dict) and "text" in p]
            tool_calls = []
            for p in parts:
                if isinstance(p, dict) and "functionCall" in p:
                    fc = p["functionCall"]
                    tool_calls.append({
                        "id": fc.get("name", ""),
                        "type": "function",
                        "function": {
                            "name": fc.get("name", ""),
                            "arguments": json.dumps(fc.get("args", {}), ensure_ascii=False),
                        },
                    })
            msg: dict[str, Any] = {"role": openai_role, "content": "\n".join(text_parts)}
            if tool_calls:
                msg["tool_calls"] = tool_calls
            messages.append(msg)
        else:
            text = " ".join(
                p.get("text", "") for p in parts if isinstance(p, dict) and "text" in p
            )
            messages.append({"role": openai_role, "content": text})

    req: dict[str, Any] = {"messages": messages}
    gen_config = gemini_req.get("generationConfig", {})
    if "temperature" in gen_config:
        req["temperature"] = gen_config["temperature"]
    if "topP" in gen_config:
        req["top_p"] = gen_config["topP"]
    if "maxOutputTokens" in gen_config:
        req["max_tokens"] = gen_config["maxOutputTokens"]
    tools = gemini_req.get("tools")
    if isinstance(tools, list) and tools:
        declarations = tools[0].get("functionDeclarations", []) if isinstance(tools[0], dict) else []
        if declarations:
            req["tools"] = [_gemini_tool_to_openai(t) for t in declarations]
    return req


def openai_to_gemini_response(openai_resp: dict[str, Any]) -> dict[str, Any]:
    """OpenAI Chat Completions 响应 → Gemini generateContent 响应格式。"""
    choices = openai_resp.get("choices", [])
    parts: list[dict[str, Any]] = []
    finish_reason = "STOP"
    if choices:
        msg = choices[0].get("message", {})
        if msg.get("content"):
            parts.append({"text": msg["content"]})
        for tc in msg.get("tool_calls", []) or []:
            fn = tc.get("function", {})
            try:
                args = json.loads(fn.get("arguments", "{}"))
            except (json.JSONDecodeError, TypeError):
                args = {}
            parts.append({"functionCall": {"name": fn.get("name", ""), "args": args}})
        finish_reason = _openai_finish_to_gemini(choices[0].get("finish_reason"))

    usage = openai_resp.get("usage", {})
    return {
        "candidates": [{
            "content": {"parts": parts, "role": "model"},
            "finishReason": finish_reason,
            "index": 0,
        }],
        "usageMetadata": {
            "promptTokenCount": usage.get("prompt_tokens", 0),
            "candidatesTokenCount": usage.get("completion_tokens", 0),
            "totalTokenCount": usage.get("total_tokens", 0),
        },
    }


def gemini_to_openai_response(gemini_resp: dict[str, Any]) -> dict[str, Any]:
    """Gemini generateContent 响应 → OpenAI Chat Completions 响应格式。"""
    candidates = gemini_resp.get("candidates", [])
    text_parts: list[str] = []
    tool_calls: list[dict[str, Any]] = []
    finish_reason = "stop"
    if candidates:
        c = candidates[0]
        for p in c.get("content", {}).get("parts", []):
            if not isinstance(p, dict):
                continue
            if "text" in p:
                text_parts.append(p["text"])
            elif "functionCall" in p:
                fc = p["functionCall"]
                tool_calls.append({
                    "id": fc.get("name", ""),
                    "type": "function",
                    "function": {
                        "name": fc.get("name", ""),
                        "arguments": json.dumps(fc.get("args", {}), ensure_ascii=False),
                    },
                })
        finish_reason = _gemini_finish_to_openai(c.get("finishReason"))

    message: dict[str, Any] = {
        "role": "assistant",
        "content": "\n".join(text_parts),
    }
    if tool_calls:
        message["tool_calls"] = tool_calls
    usage = gemini_resp.get("usageMetadata", {})
    return {
        "object": "chat.completion",
        "choices": [{
            "index": 0,
            "message": message,
            "finish_reason": finish_reason,
        }],
        "usage": {
            "prompt_tokens": usage.get("promptTokenCount", 0),
            "completion_tokens": usage.get("candidatesTokenCount", 0),
            "total_tokens": usage.get("totalTokenCount", 0),
        },
    }


# ---------------- Anthropic ↔ Gemini (经 OpenAI 中转) ----------------


def anthropic_to_gemini_request(anthropic_req: dict[str, Any]) -> dict[str, Any]:
    """Anthropic Messages 请求 → Gemini generateContent 请求(经 OpenAI 中转)。"""
    return openai_to_gemini_request(anthropic_to_openai_request(anthropic_req))


def gemini_to_anthropic_request(gemini_req: dict[str, Any]) -> dict[str, Any]:
    """Gemini generateContent 请求 → Anthropic Messages 请求(经 OpenAI 中转)。"""
    return openai_to_anthropic_request(gemini_to_openai_request(gemini_req))


def anthropic_to_gemini_response(anthropic_resp: dict[str, Any]) -> dict[str, Any]:
    """Anthropic Messages 响应 → Gemini generateContent 响应(经 OpenAI 中转)。"""
    return openai_to_gemini_response(anthropic_to_openai_response(anthropic_resp))


def gemini_to_anthropic_response(gemini_resp: dict[str, Any]) -> dict[str, Any]:
    """Gemini generateContent 响应 → Anthropic Messages 响应(经 OpenAI 中转)。"""
    return openai_to_anthropic_response(gemini_to_openai_response(gemini_resp))


# ---------------- 统一调度入口 ----------------


@dataclass
class ProtocolConverter:
    """协议转换器:按入站协议 + 目标协议调度对应转换函数。

    用法:
        converter = ProtocolConverter()
        # 客户端用 Anthropic 协议发请求,要转给 Gemini provider
        gemini_req = converter.convert_request(
            anthropic_req, ProtocolType.ANTHROPIC, ProtocolType.GEMINI
        )
        # Gemini provider 返回响应,要转回 Anthropic 给客户端
        anthropic_resp = converter.convert_response(
            gemini_resp, ProtocolType.GEMINI, ProtocolType.ANTHROPIC
        )
    """

    _REQUEST_CONVERTERS: dict[tuple[ProtocolType, ProtocolType], Callable[[dict[str, Any]], dict[str, Any]]] = field(default_factory=dict)

    def __post_init__(self) -> None:
        # 注册 6 个方向的请求转换函数(同协议 no-op)
        self._REQUEST_CONVERTERS = {
            (ProtocolType.OPENAI, ProtocolType.ANTHROPIC): openai_to_anthropic_request,
            (ProtocolType.OPENAI, ProtocolType.GEMINI): openai_to_gemini_request,
            (ProtocolType.ANTHROPIC, ProtocolType.OPENAI): anthropic_to_openai_request,
            (ProtocolType.ANTHROPIC, ProtocolType.GEMINI): anthropic_to_gemini_request,
            (ProtocolType.GEMINI, ProtocolType.OPENAI): gemini_to_openai_request,
            (ProtocolType.GEMINI, ProtocolType.ANTHROPIC): gemini_to_anthropic_request,
        }
        self._RESPONSE_CONVERTERS: dict[tuple[ProtocolType, ProtocolType], Callable[[dict[str, Any]], dict[str, Any]]] = {
            (ProtocolType.OPENAI, ProtocolType.ANTHROPIC): openai_to_anthropic_response,
            (ProtocolType.OPENAI, ProtocolType.GEMINI): openai_to_gemini_response,
            (ProtocolType.ANTHROPIC, ProtocolType.OPENAI): anthropic_to_openai_response,
            (ProtocolType.ANTHROPIC, ProtocolType.GEMINI): anthropic_to_gemini_response,
            (ProtocolType.GEMINI, ProtocolType.OPENAI): gemini_to_openai_response,
            (ProtocolType.GEMINI, ProtocolType.ANTHROPIC): gemini_to_anthropic_response,
        }

    def convert_request(
        self,
        req: dict[str, Any],
        from_protocol: ProtocolType,
        to_protocol: ProtocolType,
    ) -> dict[str, Any]:
        """请求格式转换。同协议直接返回(避免无谓拷贝)。"""
        if from_protocol == to_protocol:
            return req
        converter = self._REQUEST_CONVERTERS.get((from_protocol, to_protocol))
        if not converter:
            logger.warning("不支持的协议转换: %s → %s,原样返回", from_protocol, to_protocol)
            return req
        try:
            return converter(req)
        except Exception as e:
            logger.error("协议转换失败 %s → %s: %s", from_protocol, to_protocol, e)
            return req

    def convert_response(
        self,
        resp: dict[str, Any],
        from_protocol: ProtocolType,
        to_protocol: ProtocolType,
    ) -> dict[str, Any]:
        """响应格式转换。同协议直接返回。"""
        if from_protocol == to_protocol:
            return resp
        converter = self._RESPONSE_CONVERTERS.get((from_protocol, to_protocol))
        if not converter:
            logger.warning("不支持的响应协议转换: %s → %s,原样返回", from_protocol, to_protocol)
            return resp
        try:
            return converter(resp)
        except Exception as e:
            logger.error("响应协议转换失败 %s → %s: %s", from_protocol, to_protocol, e)
            return resp


# 模块级单例(无状态,可全局复用)
protocol_converter = ProtocolConverter()


# ---------------- 私有辅助函数 ----------------


def _strip_provider_prefix(model: str) -> str:
    """去除模型名的 provider 前缀(stepfun/xxx → xxx)。"""
    return model.split("/", 1)[1] if "/" in model else model


def _openai_tool_to_anthropic(tool: dict[str, Any]) -> dict[str, Any]:
    """OpenAI tool → Anthropic tool(input_schema)。"""
    if tool.get("type") == "function":
        fn = tool.get("function", {})
        return {
            "name": fn.get("name", ""),
            "description": fn.get("description", ""),
            "input_schema": fn.get("parameters", {"type": "object", "properties": {}}),
        }
    return tool


def _anthropic_tool_to_openai(tool: dict[str, Any]) -> dict[str, Any]:
    """Anthropic tool → OpenAI tool(function.parameters)。"""
    if "input_schema" in tool or "name" in tool:
        return {
            "type": "function",
            "function": {
                "name": tool.get("name", ""),
                "description": tool.get("description", ""),
                "parameters": tool.get("input_schema", {"type": "object", "properties": {}}),
            },
        }
    return tool


def _openai_tool_to_gemini(tool: dict[str, Any]) -> dict[str, Any]:
    """OpenAI tool → Gemini functionDeclaration。"""
    if tool.get("type") == "function":
        fn = tool.get("function", {})
        return {
            "name": fn.get("name", ""),
            "description": fn.get("description", ""),
            "parameters": fn.get("parameters", {"type": "object", "properties": {}}),
        }
    return tool


def _gemini_tool_to_openai(declaration: dict[str, Any]) -> dict[str, Any]:
    """Gemini functionDeclaration → OpenAI tool。"""
    return {
        "type": "function",
        "function": {
            "name": declaration.get("name", ""),
            "description": declaration.get("description", ""),
            "parameters": declaration.get("parameters", {"type": "object", "properties": {}}),
        },
    }


def _openai_tool_choice_to_anthropic(tool_choice: Any) -> Any:
    """OpenAI tool_choice → Anthropic tool_choice。

    OpenAI: "auto" / "none" / "required" / {type:"function", function:{name}}
    Anthropic: "auto" / "any" / {type:"tool", name}
    """
    if tool_choice == "auto":
        return {"type": "auto"}
    if tool_choice == "none":
        return None  # Anthropic 不支持 none,直接不传 tools
    if tool_choice == "required":
        return {"type": "any"}
    if isinstance(tool_choice, dict) and tool_choice.get("type") == "function":
        return {"type": "tool", "name": tool_choice.get("function", {}).get("name", "")}
    return tool_choice


def _anthropic_tool_choice_to_openai(tool_choice: Any) -> Any:
    """Anthropic tool_choice → OpenAI tool_choice。"""
    if isinstance(tool_choice, dict):
        t = tool_choice.get("type")
        if t == "auto":
            return "auto"
        if t == "any":
            return "required"
        if t == "tool":
            return {"type": "function", "function": {"name": tool_choice.get("name", "")}}
    return tool_choice


def _openai_finish_to_anthropic_stop(finish: Optional[str]) -> Optional[str]:
    """OpenAI finish_reason → Anthropic stop_reason。"""
    mapping = {
        "stop": "end_turn",
        "length": "max_tokens",
        "tool_calls": "tool_use",
        "function_call": "tool_use",
        "content_filter": "end_turn",
    }
    return mapping.get(finish or "", "end_turn")


def _anthropic_stop_to_openai_finish(stop: Optional[str]) -> Optional[str]:
    """Anthropic stop_reason → OpenAI finish_reason。"""
    mapping = {
        "end_turn": "stop",
        "max_tokens": "length",
        "stop_sequence": "stop",
        "tool_use": "tool_calls",
    }
    return mapping.get(stop or "", "stop")


def _openai_finish_to_gemini(finish: Optional[str]) -> str:
    """OpenAI finish_reason → Gemini finishReason。"""
    mapping = {
        "stop": "STOP",
        "length": "MAX_TOKENS",
        "tool_calls": "STOP",
        "function_call": "STOP",
        "content_filter": "SAFETY",
    }
    return mapping.get(finish or "", "STOP")


def _gemini_finish_to_openai(finish: Optional[str]) -> str:
    """Gemini finishReason → OpenAI finish_reason。"""
    mapping = {
        "STOP": "stop",
        "MAX_TOKENS": "length",
        "SAFETY": "content_filter",
        "RECITATION": "content_filter",
        "BLOCKLIST": "content_filter",
    }
    return mapping.get(finish or "", "stop")
