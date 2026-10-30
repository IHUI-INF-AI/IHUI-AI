# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""IHUI-AI Python SDK(骨架,后续真发布时填实现)。

OpenAI 兼容:POST /api/chat/completions + GET /api/models
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
        """POST /api/chat/completions — 创建对话补全(OpenAI 兼容)。"""
        data = self._request("/api/chat/completions", method="POST", json=body.to_dict())
        return ChatCompletionResponse(
            id=data["id"],
            object=data["object"],
            created=data["created"],
            model=data["model"],
            choices=data.get("choices", []),
            usage=data.get("usage"),
        )

    def models_list(self) -> ModelsListResponse:
        """GET /api/models — 模型列表。"""
        data = self._request("/api/models", method="GET")
        return ModelsListResponse(
            object=data["object"],
            data=[
                ModelInfo(id=m["id"], object=m["object"], created=m["created"], owned_by=m["owned_by"])
                for m in data.get("data", [])
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
