# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""IHUI-AI Python SDK(骨架,后续真发布时填实现)。

端点对齐 ai-service 真实路由:POST /api/llm/complete + GET /api/llm/models
(BUG-95:旧版 /api/chat/completions 与 /api/models 全仓无注册,调用必 404)。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

import requests


class IhuiError(Exception):
    """HTTP 4xx/5xx 异常,含 status_code 与 body。"""

    def __init__(self, status_code: int, message: str, body: Any = None) -> None:
        super().__init__(f"IHUI API 错误 [{status_code}]: {message}")
        self.status_code = status_code
        self.body = body


@dataclass
class Message:
    role: str  # 'system' | 'user' | 'assistant'
    content: str


@dataclass
class ChatCompletionRequest:
    model: str
    messages: list[Message]
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    stream: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "model": self.model,
            "messages": [{"role": m.role, "content": m.content} for m in self.messages],
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "stream": self.stream,
        }


@dataclass
class ChatCompletionResponse:
    id: str
    object: str
    created: int
    model: str
    choices: list[dict[str, Any]] = field(default_factory=list)
    usage: Optional[dict[str, int]] = None


@dataclass
class ModelInfo:
    id: str
    object: str
    created: int
    owned_by: str


@dataclass
class ModelsListResponse:
    object: str
    data: list[ModelInfo] = field(default_factory=list)


class IhuiClient:
    """IHUI-AI 客户端,内部封装 requests,统一加 Authorization + 错误抛出。"""

    def __init__(self, api_base: str, api_key: str, timeout: int = 30) -> None:
        self.api_base = api_base.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout

    def _request(self, path: str, method: str = "GET", json: Any = None) -> Any:
        url = f"{self.api_base}{path}"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }
        resp = requests.request(method, url, headers=headers, json=json, timeout=self.timeout)
        try:
            body = resp.json()
        except ValueError:
            body = resp.text
        if not resp.ok:
            raise IhuiError(resp.status_code, str(body), body)
        return body

    def chat_completions_create(self, body: ChatCompletionRequest) -> ChatCompletionResponse:
        """POST /api/llm/complete — 创建对话补全(真实端点;旧 /api/chat/completions 全仓零注册,调用必 404)。"""
        data = self._request("/api/llm/complete", method="POST", json=body.to_dict())
        # /api/llm/complete 返回内部网关结构(content/usage/model…),不是 OpenAI 信封;
        # 防御式投影到本 SDK 的 dataclass,缺字段不 KeyError(骨架不假设上游字段齐全)。
        payload: dict[str, Any] = data if isinstance(data, dict) else {}
        raw_choices = payload.get("choices")
        choices: list[dict[str, Any]] = raw_choices if isinstance(raw_choices, list) else []
        if not choices:
            content = payload.get("content")
            if isinstance(content, str) and content:
                choices = [
                    {
                        "index": 0,
                        "message": {"role": "assistant", "content": content},
                        "finish_reason": "stop",
                    }
                ]
        created_raw = payload.get("created")
        return ChatCompletionResponse(
            id=str(payload.get("id") or payload.get("request_id") or ""),
            object=str(payload.get("object") or "chat.completion"),
            created=int(created_raw) if isinstance(created_raw, (int, float)) else 0,
            model=str(payload.get("model") or body.model),
            choices=choices,
            usage=payload.get("usage") if isinstance(payload.get("usage"), dict) else None,
        )

    def models_list(self) -> ModelsListResponse:
        """GET /api/llm/models — 模型列表(真实端点;旧 /api/models 全仓零注册,调用必 404)。"""
        data = self._request("/api/llm/models", method="GET")
        # 真实响应是 {"models":[{id,provider,…}],"default":…,"stub_mode":…},
        # 不是 OpenAI 的 {"object":"list","data":[…]};两种形状都兼容,逐字段兜底。
        payload: dict[str, Any] = data if isinstance(data, dict) else {}
        raw = payload.get("models")
        if not isinstance(raw, list):
            raw = payload.get("data", [])
        return ModelsListResponse(
            object=str(payload.get("object") or "list"),
            data=[
                ModelInfo(
                    id=str(m.get("id") or ""),
                    object=str(m.get("object") or "model"),
                    created=int(m["created"]) if isinstance(m.get("created"), (int, float)) else 0,
                    owned_by=str(m.get("owned_by") or m.get("provider") or ""),
                )
                for m in raw
                if isinstance(m, dict)
            ],
        )


__all__ = [
    "IhuiClient",
    "IhuiError",
    "Message",
    "ChatCompletionRequest",
    "ChatCompletionResponse",
    "ModelInfo",
    "ModelsListResponse",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
