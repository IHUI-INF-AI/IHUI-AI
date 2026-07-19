"""Gemini 原生适配器。

核心差异(相对 OpenAI/LiteLLM 通用层):
- function calling 用 OpenAPI schema(functionDeclarations)
- safety_settings(内容安全策略,OpenAI 无此概念)
- generation_config(temperature/topP/maxOutputTokens 统一封装)

safety_settings 默认策略(2026-07-19 修订):
- 旧版默认 BLOCK_MEDIUM_AND_ABOVE(Gemini 默认值),对中等概率违规内容即拦截,
  导致大量正常对话被误判为"违规"并返回空文本/finishReason=SAFETY,
  用户感知为"模型报错自动结束对话"。
- 现默认 BLOCK_ONLY_HIGH(仅拦截高概率违规内容),与 OpenAI/Anthropic 默认策略对齐,
  避免误判。调用方仍可通过 safety_settings 参数覆盖。
"""

from __future__ import annotations

import json
from typing import Any, AsyncIterator

import httpx

from .base_provider import BaseProvider, ProviderError


# Gemini 4 个安全类别,默认全部设为 BLOCK_ONLY_HIGH(仅拦截高概率违规)
# 与 OpenAI/Anthropic 默认内容策略对齐,避免误判正常对话
DEFAULT_SAFETY_SETTINGS: list[dict[str, str]] = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_ONLY_HIGH"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_ONLY_HIGH"},
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_ONLY_HIGH"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_ONLY_HIGH"},
]


class GeminiProvider(BaseProvider):
    """Google Gemini API 原生适配器。"""

    def __init__(self, api_key: str, api_base: str | None = None, timeout: float = 60.0):
        super().__init__(api_key, api_base, timeout)
        self.base_url = (api_base or "https://generativelanguage.googleapis.com").rstrip("/")

    def _convert_messages(
        self,
        messages: list[dict[str, Any]],
    ) -> tuple[str | None, list[dict[str, Any]]]:
        """OpenAI messages → Gemini contents + system_instruction。

        Gemini 用 role user/model(非 user/assistant),system 单独传。
        """
        system: list[str] = []
        contents: list[dict[str, Any]] = []
        for m in messages:
            role = m.get("role")
            content = m.get("content", "")
            if role == "system":
                if isinstance(content, str):
                    system.append(content)
                else:
                    system.append(json.dumps(content, ensure_ascii=False))
            else:
                gemini_role = "user" if role == "user" else "model"
                parts = [{"text": content}] if isinstance(content, str) else [{"text": json.dumps(content, ensure_ascii=False)}]
                contents.append({"role": gemini_role, "parts": parts})
        system_text = "\n\n".join(system) if system else None
        return system_text, contents

    def _convert_tools(self, tools: list[dict[str, Any]] | None) -> list[dict[str, Any]] | None:
        """OpenAI function calling → Gemini functionDeclarations(OpenAPI schema)。"""
        if not tools:
            return None
        declarations: list[dict[str, Any]] = []
        for t in tools:
            if t.get("type") == "function":
                fn = t.get("function", {})
                declarations.append({
                    "name": fn.get("name"),
                    "description": fn.get("description", ""),
                    "parameters": fn.get("parameters", {"type": "object", "properties": {}}),
                })
        return [{"functionDeclarations": declarations}] if declarations else None

    def _build_generation_config(self, **kwargs: Any) -> dict[str, Any]:
        """将 OpenAI 风格参数封装到 Gemini generation_config。"""
        config: dict[str, Any] = {}
        if "temperature" in kwargs:
            config["temperature"] = kwargs.pop("temperature")
        if "top_p" in kwargs:
            config["topP"] = kwargs.pop("top_p")
        if "max_tokens" in kwargs:
            config["maxOutputTokens"] = kwargs.pop("max_tokens")
        return config

    def _build_payload(
        self,
        messages: list[dict[str, Any]],
        model: str,
        *,
        tools: list[dict[str, Any]] | None,
        safety_settings: list[dict[str, Any]] | None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        system_text, contents = self._convert_messages(messages)
        payload: dict[str, Any] = {"contents": contents}
        if system_text:
            payload["systemInstruction"] = {"parts": [{"text": system_text}]}
        gen_config = self._build_generation_config(**kwargs)
        if gen_config:
            payload["generationConfig"] = gen_config
        converted_tools = self._convert_tools(tools)
        if converted_tools:
            payload["tools"] = converted_tools
        # safety_settings:Gemini 独有,控制内容安全策略
        # 调用方未显式传入时,使用 DEFAULT_SAFETY_SETTINGS(BLOCK_ONLY_HIGH),
        # 避免使用 Gemini 默认的 BLOCK_MEDIUM_AND_ABOVE 误判正常对话
        payload["safetySettings"] = safety_settings or DEFAULT_SAFETY_SETTINGS
        return payload

    def _parse_candidates(self, data: dict[str, Any]) -> tuple[str, list[dict[str, Any]], str | None]:
        """解析 Gemini candidates → (text, tool_calls, finish_reason)。

        返回 finish_reason 用于上层检测 SAFETY 拦截,以便返回明确错误而非空文本。
        """
        text_parts: list[str] = []
        tool_calls: list[dict[str, Any]] = []
        finish_reason: str | None = None
        for candidate in data.get("candidates", []):
            if finish_reason is None:
                finish_reason = candidate.get("finishReason")
            content = candidate.get("content", {})
            for part in content.get("parts", []):
                if "text" in part:
                    text_parts.append(part["text"])
                elif "functionCall" in part:
                    fc = part["functionCall"]
                    tool_calls.append({
                        "id": fc.get("name"),
                        "type": "function",
                        "function": {
                            "name": fc.get("name"),
                            "arguments": json.dumps(fc.get("args", {}), ensure_ascii=False),
                        },
                    })
        return "".join(text_parts), tool_calls, finish_reason

    async def complete(
        self,
        messages: list[dict[str, Any]],
        model: str,
        *,
        tools: list[dict[str, Any]] | None = None,
        safety_settings: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        payload = self._build_payload(messages, model, tools=tools, safety_settings=safety_settings, **kwargs)
        real_model = self._strip_prefix(model)
        url = f"{self.base_url}/v1beta/models/{real_model}:generateContent?key={self.api_key}"
        data = await self._request("POST", url, json=payload)
        text, tool_calls, finish_reason = self._parse_candidates(data)
        # SAFETY/RECITATION 拦截:Gemini 返回空文本 + finishReason=SAFETY,
        # 上抛明确错误避免前端看到空回复(用户感知为"对话被自动结束")
        if not text and finish_reason in ("SAFETY", "RECITATION", "BLOCKLIST"):
            return {
                "content": "",
                "model": real_model,
                "usage": data.get("usageMetadata", {}),
                "stub": False,
                "error": True,
                "error_message": f"内容被 Gemini 安全策略拦截(finishReason={finish_reason}),请调整提问方式",
            }
        result: dict[str, Any] = {
            "content": text,
            "model": real_model,
            "usage": data.get("usageMetadata", {}),
            "stub": False,
        }
        if tool_calls:
            result["tool_calls"] = tool_calls
        return result

    async def astream(
        self,
        messages: list[dict[str, Any]],
        model: str,
        *,
        tools: list[dict[str, Any]] | None = None,
        safety_settings: list[dict[str, Any]] | None = None,
        **kwargs: Any,
    ) -> AsyncIterator[dict[str, Any]]:
        payload = self._build_payload(messages, model, tools=tools, safety_settings=safety_settings, **kwargs)
        real_model = self._strip_prefix(model)
        url = f"{self.base_url}/v1beta/models/{real_model}:streamGenerateContent?key={self.api_key}&alt=sse"
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                async with client.stream("POST", url, json=payload) as resp:
                    if resp.status_code >= 400:
                        body = await resp.aread()
                        raise ProviderError(
                            f"Gemini 流式调用失败: {resp.status_code} {body[:300]!r}",
                            resp.status_code,
                        )
                    saw_chunk = False
                    async for line in resp.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        try:
                            event = json.loads(line[6:])
                        except json.JSONDecodeError:
                            continue
                        text, tool_calls, finish_reason = self._parse_candidates(event)
                        if text:
                            saw_chunk = True
                            yield {"type": "chunk", "content": text}
                        if tool_calls:
                            yield {"type": "tool_call", "tool_calls": tool_calls}
                        # 流式末尾检测 SAFETY 拦截:整段没产出过 chunk 且 finishReason 是 SAFETY
                        if (
                            not saw_chunk
                            and finish_reason in ("SAFETY", "RECITATION", "BLOCKLIST")
                        ):
                            yield {
                                "type": "error",
                                "message": f"内容被 Gemini 安全策略拦截(finishReason={finish_reason}),请调整提问方式",
                            }
                        if event.get("usageMetadata"):
                            yield {
                                "type": "done",
                                "model": real_model,
                                "usage": event["usageMetadata"],
                                "stub": False,
                            }
        except httpx.HTTPError as e:
            yield {"type": "error", "message": f"Gemini 流式网络异常: {e}"}
        except ProviderError as e:
            yield {"type": "error", "message": str(e)}

    async def list_models(self) -> list[dict[str, Any]]:
        url = f"{self.base_url}/v1beta/models?key={self.api_key}"
        data = await self._request("GET", url)
        return data.get("models", [])
