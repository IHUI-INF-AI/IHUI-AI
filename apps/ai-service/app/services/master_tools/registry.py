# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""总管智能体 · `agent_registry` 工具（P3-04）。

十一个注册表动作，全部走 API 内部 `/ops`，不直连数据库；删除只创建审批，
不代替用户确认。返回统一信封 `{ok, action, data|error, meta}`，永不抛裸异常。
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

TOOL_NAME = "agent_registry"

ACTION_VALUES = [
    "list",
    "inspect",
    "create",
    "update",
    "clone",
    "disable",
    "enable",
    "rollback",
    "precheck_delete",
    "delete",
    "restore",
]

INPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["action"],
    "additionalProperties": False,
    "properties": {
        "action": {"type": "string", "enum": ACTION_VALUES},
        "id": {"type": "string", "format": "uuid"},
        "name": {"type": "string", "pattern": "^[a-z0-9][a-z0-9_-]{0,31}$"},
        "displayName": {"type": "string", "maxLength": 100},
        "description": {"type": "string", "maxLength": 2000},
        "scope": {"type": "string", "enum": ["personal", "team"]},
        "teamId": {"type": "string", "format": "uuid"},
        "role": {"type": "string", "maxLength": 32},
        "systemPrompt": {"type": "string", "maxLength": 8000},
        "model": {"type": "string", "maxLength": 100},
        "temperature": {"type": "number", "minimum": 0, "maximum": 2},
        "maxTokens": {"type": "integer", "minimum": 1, "maximum": 200000},
        "tools": {"type": "array", "items": {"type": "string"}, "maxItems": 32},
        "skills": {"type": "array", "items": {"type": "string"}, "maxItems": 16},
        "permissions": {"type": "object"},
        "memoryPolicy": {"type": "object"},
        "budget": {"type": "object"},
        "concurrencyLimit": {"type": "integer", "minimum": 1, "maximum": 8},
        "isDispatchable": {"type": "boolean"},
        "metadata": {"type": "object"},
        "ifVersion": {"type": "integer", "minimum": 1},
        "targetVersion": {"type": "integer", "minimum": 1},
        "precheckToken": {"type": "string", "maxLength": 128},
        "reason": {"type": "string", "maxLength": 500},
        "includeVersions": {"type": "boolean", "default": False},
        "query": {"type": "string", "maxLength": 80},
        "status": {"type": "string", "enum": ["active", "disabled", "deleted"]},
        "limit": {"type": "integer", "minimum": 1, "maximum": 100, "default": 20},
        "cursor": {"type": "string", "maxLength": 256},
    },
}

DESCRIPTION = (
    "管理智能体定义：list/inspect/create/update/clone/disable/enable/rollback/"
    "precheck_delete/delete/restore。delete 只发起审批，不立即删除；"
    "不确定工具名先 inspect 内置样例。"
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


class MasterToolError(Exception):
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


class AgentRegistryTool:
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
            raise MasterToolError(
                "AGENT_ACTION_INVALID",
                f"未知 action: {action!r}",
                suggestion=f"可用 action: {', '.join(ACTION_VALUES)}",
            )
        payload = {"action": action}
        for key, value in arguments.items():
            if key in _ALLOWED_ARGS and key != "action" and value is not None:
                payload[key] = value
        return payload

    async def handle(self, arguments: dict[str, Any], *, user_id: str) -> dict[str, Any]:
        request_id = f"req_{uuid.uuid4().hex[:12]}"
        started = time.monotonic()

        def envelope(data: Any = None, error: MasterToolError | None = None) -> dict[str, Any]:
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
        except MasterToolError as error:
            return envelope(error=error)
        except (httpx.HTTPError, InternalServiceCredentialError, ValueError) as error:
            return envelope(
                error=MasterToolError(
                    "STORAGE_UNAVAILABLE",
                    f"注册表服务不可用: {error}",
                    retryable=True,
                )
            )

        if payload["action"] in {"delete"} and isinstance(result, dict):
            if str(result.get("status") or "") == "pending":
                return envelope(
                    error=MasterToolError(
                        "APPROVAL_REQUIRED",
                        "已生成删除审批，请在右侧卡片确认；不要重复发起",
                        details={
                            "approvalId": result.get("id"),
                            "impactHash": result.get("impactHash"),
                            "expiresAt": result.get("expiresAt"),
                        },
                        suggestion="等待用户点击确认；不要重复调用 delete",
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
            raise MasterToolError(
                "STORAGE_UNAVAILABLE",
                f"注册表响应不是 JSON (HTTP {response.status_code})",
                retryable=response.status_code >= 500,
            ) from error

        if response.status_code >= 400 or body.get("code") != 0:
            code = str(body.get("errorCode") or "AGENT_API_ERROR")
            raise MasterToolError(
                code,
                str(body.get("message") or f"注册表请求失败 HTTP {response.status_code}"),
                retryable=response.status_code >= 500,
                details={"httpStatus": response.status_code},
            )
        data = body.get("data")
        if not isinstance(data, dict) or "result" not in data:
            raise MasterToolError("STORAGE_UNAVAILABLE", "注册表响应缺少 data.result")
        return data["result"]


agent_registry_tool = AgentRegistryTool()
