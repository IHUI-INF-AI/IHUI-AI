"""Gemini 原生适配器。

核心差异(相对 OpenAI/LiteLLM 通用层):
- function calling 用 OpenAPI schema(functionDeclarations)
- safety_settings(内容安全策略,OpenAI 无此概念)
- generation_config(temperature/topP/maxOutputTokens 统一封装)
"""

from __future__ import annotations

import json
from typing import Any, AsyncIterator

import httpx

from .base_provider import BaseProvider, ProviderError


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
        if safety_settings:
            payload["safetySettings"] = safety_settings
        return payload

    def _parse_candidates(self, data: dict[str, Any]) -> tuple[str, list[dict[str, Any]]]:
        """解析 Gemini candidates → (text, tool_calls)。"""
        text_parts: list[str] = []
        tool_calls: list[dict[str, Any]] = []
        for candidate in data.get("candidates", []):
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
        return "".join(text_parts), tool_calls

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
        text, tool_calls = self._parse_candidates(data)
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
                    async for line in resp.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        try:
                            event = json.loads(line[6:])
                        except json.JSONDecodeError:
                            continue
                        text, tool_calls = self._parse_candidates(event)
                        if text:
                            yield {"type": "chunk", "content": text}
                        if tool_calls:
                            yield {"type": "tool_call", "tool_calls": tool_calls}
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
