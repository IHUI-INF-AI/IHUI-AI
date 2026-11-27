# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""总管智能体 · `agent_ops` 工具（P3-05）。

当前落地：运行只读面（run_list/get/logs/artifacts/stats）+ health。
派发、pause/resume/talk/stop/retry/cancel 需要跨进程运行控制面，未完成前
明确返回 `AGENT_ACTION_NOT_IMPLEMENTED`，不伪造成功。
"""

from __future__ import annotations

import os
import time
import uuid
from typing import Any

import httpx

from ...core.internal_ticket import (
    InternalServiceCredentialError,
    internal_service_headers,
)

TOOL_NAME = "agent_ops"

ACTION_VALUES = [
    "dispatch",
    "run_list",
    "run_get",
    "run_logs",
    "run_artifacts",
    "run_stats",
    "run_talk",
    "run_pause",
    "run_resume",
    "run_stop",
    "run_retry",
    "run_cancel",
    "health",
]

_IMPLEMENTED = frozenset(
    {"run_list", "run_get", "run_logs", "run_artifacts", "run_stats", "health"}
)

INPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["action"],
    "additionalProperties": False,
    "properties": {
        "action": {"type": "string", "enum": ACTION_VALUES},
        "definitionId": {"type": "string", "format": "uuid"},
        "name": {"type": "string"},
        "mode": {
            "type": "string",
            "enum": [
                "single",
                "parallel",
                "pipeline",
                "debate",
                "vote",
                "critique",
                "decomposed",
                "team",
                "recursive",
            ],
        },
        "goal": {"type": "string", "maxLength": 8000},
        "constraints": {"type": "array", "items": {"type": "string"}, "maxItems": 16},
        "deliverables": {"type": "array", "items": {"type": "string"}, "maxItems": 16},
        "budget": {"type": "object"},
        "runId": {"type": "string", "format": "uuid"},
        "message": {"type": "string", "maxLength": 4000},
        "delivery": {"type": "string", "enum": ["auto", "steer", "queue", "continue"]},
        "reason": {"type": "string", "maxLength": 500},
        "includeEvents": {"type": "boolean", "default": False},
        "limit": {"type": "integer", "minimum": 1, "maximum": 200, "default": 50},
        "cursor": {"type": "string"},
        "runStatus": {
            "type": "string",
            "enum": ["queued", "running", "paused", "succeeded", "failed", "canceled", "timeout", "blocked"],
        },
        "afterSeq": {"type": "integer", "minimum": 0},
    },
}

DESCRIPTION = (
    "查看和控制智能体运行：run_list/run_get/run_logs/run_artifacts/run_stats 可查，"
    "health 查运行时；dispatch/pause/resume/talk/stop/retry/cancel 尚未接线，"
    "调用会明确报未实现，不要把它当成成功。"
)

_ALLOWED_ARGS = frozenset(INPUT_SCHEMA["properties"].keys())


def _api_base_url() -> str:
    override = os.environ.get("API_INTERNAL_BASE_URL", "").strip()
    if override:
        return override.rstrip("/")
    from ...core.config import settings

    return str(getattr(settings, "api_service_url", "http://localhost:8802")).rstrip("/")


def _legacy_secret() -> str:
    return (
        os.environ.get("AI_CALLBACK_SECRET", "").strip()
        or os.environ.get("INTERNAL_SERVICE_TOKEN", "").strip()
    )


class OpsToolError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        *,
        retryable: bool = False,
        details: dict[str, Any] | None = None,
        suggestion: str | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.retryable = retryable
        self.details = details or {}
        self.suggestion = suggestion


class AgentOpsTool:
    name = TOOL_NAME
    description = DESCRIPTION
    input_schema = INPUT_SCHEMA

    def __init__(
        self,
        *,
        base_url: str | None = None,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._base_url = (base_url or _api_base_url()).rstrip("/")
        self._transport = transport

    def _build_payload(self, arguments: dict[str, Any]) -> dict[str, Any]:
        action = str(arguments.get("action") or "").strip()
        if action not in ACTION_VALUES:
            raise OpsToolError("AGENT_ACTION_INVALID", f"未知 action: {action!r}")
        if action not in _IMPLEMENTED:
            raise OpsToolError(
                "AGENT_ACTION_NOT_IMPLEMENTED",
                f"{action} 尚未接线；当前只支持运行只读面与 health",
                suggestion="先用 run_get/run_logs 查状态，不要把它当成已执行",
            )
        payload = {"action": action}
        for key, value in arguments.items():
            if key in _ALLOWED_ARGS and key != "action" and value is not None:
                payload[key] = value
        return payload

    async def handle(self, arguments: dict[str, Any], *, user_id: str) -> dict[str, Any]:
        request_id = f"req_{uuid.uuid4().hex[:12]}"
        started = time.monotonic()

        def envelope(data: Any = None, error: OpsToolError | None = None) -> dict[str, Any]:
            body: dict[str, Any] = {
                "action": str(arguments.get("action") or ""),
                "meta": {
                    "requestId": request_id,
                    "durationMs": round((time.monotonic() - started) * 1000, 2),
                },
            }
            if error is not None:
                body["ok"] = False
                body["error"] = {
                    "code": error.code,
                    "message": error.message,
                    "retryable": error.retryable,
                    "details": error.details,
                    **({"suggestion": error.suggestion} if error.suggestion else {}),
                }
            else:
                body["ok"] = True
                body["data"] = data
            return body

        try:
            payload = self._build_payload(arguments)
            result = await self._post_ops(payload, user_id=user_id)
        except OpsToolError as error:
            return envelope(error=error)
        except (httpx.HTTPError, InternalServiceCredentialError, ValueError) as error:
            return envelope(
                error=OpsToolError(
                    "STORAGE_UNAVAILABLE",
                    f"运行服务不可用: {error}",
                    retryable=True,
                )
            )
        return envelope(data=result)

    async def _post_ops(self, payload: dict[str, Any], *, user_id: str) -> Any:
        headers = internal_service_headers(
            user_id,
            "agent-registry",
            legacy_token=_legacy_secret(),
        )
        async with httpx.AsyncClient(timeout=15.0, transport=self._transport) as client:
            response = await client.post(
                f"{self._base_url}/api/internal/agent-registry/ops",
                headers=headers,
                json=payload,
            )
        try:
            body = response.json()
        except ValueError as error:
            raise OpsToolError(
                "STORAGE_UNAVAILABLE",
                f"运行响应不是 JSON (HTTP {response.status_code})",
                retryable=response.status_code >= 500,
            ) from error
        if response.status_code >= 400 or body.get("code") != 0:
            raise OpsToolError(
                str(body.get("errorCode") or "AGENT_API_ERROR"),
                str(body.get("message") or f"运行请求失败 HTTP {response.status_code}"),
                retryable=response.status_code >= 500,
                details={"httpStatus": response.status_code},
            )
        data = body.get("data")
        if not isinstance(data, dict) or "result" not in data:
            raise OpsToolError("STORAGE_UNAVAILABLE", "运行响应缺少 data.result")
        return data["result"]


agent_ops_tool = AgentOpsTool()
