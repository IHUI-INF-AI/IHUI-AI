# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""总管智能体 · `master_memory` 工具（P3-06 / R3）。

用户作用域走四层记忆服务；团队作用域走 `apps/api` 的 `/api/team-memory`
（短期内部票 scope=team-memory），权限由 API 统一按团队成员/管理员判定。
`agent` 作用域仍明确拒绝：v2 的 `agent_memory.py` 只是进程内缓存，不是长期 DB 权威。
"""

from __future__ import annotations

import os
import time
import uuid
from typing import Any

TOOL_NAME = "master_memory"

ACTION_VALUES = ["memory_search", "memory_write", "memory_forget"]
TEAM_KINDS = frozenset({"decision", "convention", "pitfall", "fingerprint"})

INPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["action"],
    "additionalProperties": False,
    "properties": {
        "action": {"type": "string", "enum": ACTION_VALUES},
        "query": {"type": "string", "maxLength": 500},
        "scope": {"type": "string", "enum": ["user", "team", "agent"], "default": "user"},
        "scopeId": {
            "type": "string",
            "maxLength": 128,
            "description": "团队作用域必填：团队 UUID 或共享 workspace key",
        },
        "kind": {
            "type": "string",
            "enum": [
                "preference",
                "fact",
                "event",
                "skill",
                "relationship",
                "decision",
                "convention",
                "pitfall",
                "fingerprint",
            ],
        },
        "tags": {
            "type": "array",
            "items": {"type": "string", "maxLength": 64},
            "maxItems": 30,
        },
        "limit": {"type": "integer", "minimum": 1, "maximum": 20, "default": 5},
        "content": {"type": "string", "maxLength": 4000},
        "summary": {"type": "string", "maxLength": 200},
        "importance": {"type": "number", "minimum": 0, "maximum": 1},
        "source": {"type": "string", "maxLength": 200},
        "memoryId": {"type": "string"},
        "reason": {"type": "string", "maxLength": 500},
    },
}

DESCRIPTION = (
    "检索、写入、遗忘长期记忆。user 作用域写用户语义记忆；team 作用域写团队共享记忆，"
    "必须给 scopeId，且只允许 decision/convention/pitfall/fingerprint，权限由团队成员关系判定。"
    "只在明确“记住”或稳定偏好时写；一次性任务、日程、提醒、订阅不写。"
    "agent 作用域未接：进程内记忆不是长期权威，不假装持久化。"
)


class MemoryToolError(Exception):
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


class MasterMemoryTool:
    name = TOOL_NAME
    description = DESCRIPTION
    input_schema = INPUT_SCHEMA

    def __init__(
        self,
        service: Any | None = None,
        *,
        base_url: str | None = None,
        transport: Any | None = None,
    ) -> None:
        self._service = service
        self._base_url = (base_url or _api_base_url()).rstrip("/")
        self._transport = transport

    def _memory_service(self) -> Any:
        if self._service is None:
            from ..memory_service import memory_service

            self._service = memory_service
        return self._service

    async def handle(self, arguments: dict[str, Any], *, user_id: str) -> dict[str, Any]:
        request_id = f"req_{uuid.uuid4().hex[:12]}"
        started = time.monotonic()

        def envelope(data: Any = None, error: MemoryToolError | None = None) -> dict[str, Any]:
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
            action, data = await self._dispatch(arguments, user_id=user_id)
        except MemoryToolError as error:
            return envelope(error=error)
        except Exception as error:  # noqa: BLE001 -- 工具永不抛裸异常
            return envelope(
                error=MemoryToolError(
                    "MEMORY_UNAVAILABLE",
                    f"记忆服务不可用: {error}",
                    retryable=True,
                )
            )
        return envelope(data)

    async def _dispatch(self, arguments: dict[str, Any], *, user_id: str) -> tuple[str, Any]:
        action = str(arguments.get("action") or "").strip()
        if action not in ACTION_VALUES:
            raise MemoryToolError("AGENT_ACTION_INVALID", f"未知 action: {action!r}")
        scope = str(arguments.get("scope") or "user")
        if scope == "agent":
            raise MemoryToolError(
                "MEMORY_SCOPE_UNSUPPORTED",
                "agent 作用域未接：进程内 agent_memory 不是长期权威",
                suggestion="要长期保留请用 user 或 team 作用域",
            )
        if scope == "team":
            return await self._team_dispatch(action, arguments, user_id=user_id)
        if scope != "user":
            raise MemoryToolError("MEMORY_SCOPE_UNSUPPORTED", f"未知作用域: {scope!r}")

        service = self._memory_service()
        if action == "memory_search":
            query = str(arguments.get("query") or "").strip()
            if not query:
                raise MemoryToolError("MEMORY_QUERY_REQUIRED", "memory_search 需要 query")
            rows = await service.recall(
                user_id,
                query,
                top_k=int(arguments.get("limit") or 5),
            )
            return action, {"items": rows}

        if action == "memory_write":
            content = str(arguments.get("content") or "").strip()
            if not content:
                raise MemoryToolError("MEMORY_CONTENT_REQUIRED", "memory_write 需要 content")
            metadata = {
                "kind": arguments.get("kind") or "fact",
                "source": arguments.get("source"),
            }
            row = await service.save(
                user_id=user_id,
                content=content,
                layer="semantic",
                summary=arguments.get("summary"),
                importance_score=arguments.get("importance"),
                metadata=metadata,
            )
            return action, row

        memory_id = str(arguments.get("memoryId") or "").strip()
        if not memory_id:
            raise MemoryToolError("MEMORY_ID_REQUIRED", "memory_forget 需要 memoryId")
        deleted = await service.delete_semantic(user_id, memory_id)
        if not deleted:
            raise MemoryToolError(
                "MEMORY_NOT_FOUND",
                "记忆不存在或不属于当前用户",
                details={"memoryId": memory_id},
            )
        return action, {"memoryId": memory_id, "status": "deleted"}

    # ── 团队作用域：apps/api /api/team-memory（内部票 scope=team-memory） ──

    async def _team_dispatch(
        self, action: str, arguments: dict[str, Any], *, user_id: str
    ) -> tuple[str, Any]:
        scope_id = str(arguments.get("scopeId") or "").strip()
        if not scope_id:
            raise MemoryToolError(
                "MEMORY_SCOPE_ID_REQUIRED",
                "team 作用域需要 scopeId（团队 UUID 或共享 workspace key）",
            )

        if action == "memory_search":
            query = str(arguments.get("query") or "").strip()
            if not query:
                raise MemoryToolError("MEMORY_QUERY_REQUIRED", "memory_search 需要 query")
            kind = arguments.get("kind")
            if kind is not None and kind not in TEAM_KINDS:
                raise MemoryToolError(
                    "MEMORY_KIND_UNSUPPORTED",
                    f"团队记忆不支持 kind={kind!r}",
                    details={"allowedKinds": sorted(TEAM_KINDS)},
                )
            params: dict[str, Any] = {
                "scopeId": scope_id,
                "keyword": query,
                "limit": int(arguments.get("limit") or 5),
            }
            if kind:
                params["kind"] = kind
            body = await self._team_request("GET", "/api/team-memory", user_id=user_id, params=params)
            rows = body.get("data")
            if not isinstance(rows, list):
                raise MemoryToolError("MEMORY_UNAVAILABLE", "团队记忆响应缺少数组 data")
            return action, {"items": rows, "scopeId": scope_id}

        if action == "memory_write":
            content = str(arguments.get("content") or "").strip()
            if not content:
                raise MemoryToolError("MEMORY_CONTENT_REQUIRED", "memory_write 需要 content")
            kind = str(arguments.get("kind") or "decision")
            if kind not in TEAM_KINDS:
                raise MemoryToolError(
                    "MEMORY_KIND_UNSUPPORTED",
                    f"团队记忆不支持 kind={kind!r}",
                    details={"allowedKinds": sorted(TEAM_KINDS)},
                    suggestion="团队记忆只收 decision/convention/pitfall/fingerprint",
                )
            title = str(arguments.get("summary") or "").strip() or content[:120]
            tags = arguments.get("tags")
            if not isinstance(tags, list):
                tags = []
            payload = {
                "scopeId": scope_id,
                "kind": kind,
                "title": title[:300],
                "content": content,
                "tags": [str(tag)[:64] for tag in tags][:30],
            }
            body = await self._team_request(
                "POST", "/api/team-memory", user_id=user_id, json=payload
            )
            return action, {"item": body.get("data"), "scopeId": scope_id}

        memory_id = str(arguments.get("memoryId") or "").strip()
        if not memory_id:
            raise MemoryToolError("MEMORY_ID_REQUIRED", "memory_forget 需要 memoryId")
        await self._team_request(
            "DELETE", f"/api/team-memory/{memory_id}", user_id=user_id
        )
        return action, {"memoryId": memory_id, "status": "deleted", "scopeId": scope_id}

    async def _team_request(
        self,
        method: str,
        path: str,
        *,
        user_id: str,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        import httpx

        from ...core.internal_ticket import (
            InternalServiceCredentialError,
            internal_service_headers,
        )

        try:
            headers = internal_service_headers(
                user_id,
                "team-memory",
                legacy_token=_legacy_secret(),
            )
        except InternalServiceCredentialError as error:
            raise MemoryToolError(
                "MEMORY_UNAVAILABLE",
                f"内部服务凭据不可用: {error}",
                retryable=True,
            ) from error
        try:
            async with httpx.AsyncClient(timeout=15.0, transport=self._transport) as client:
                response = await client.request(
                    method,
                    f"{self._base_url}{path}",
                    headers=headers,
                    params=params,
                    json=json,
                )
        except httpx.HTTPError as error:
            raise MemoryToolError(
                "MEMORY_UNAVAILABLE",
                f"团队记忆请求失败: {error}",
                retryable=True,
            ) from error
        try:
            body = response.json()
        except ValueError as error:
            raise MemoryToolError(
                "MEMORY_UNAVAILABLE",
                f"团队记忆响应不是 JSON (HTTP {response.status_code})",
                retryable=response.status_code >= 500,
            ) from error
        if response.status_code == 404:
            raise MemoryToolError(
                "MEMORY_NOT_FOUND",
                str(body.get("message") or "团队记忆不存在或无权限"),
                details={"httpStatus": 404},
            )
        if response.status_code == 403:
            raise MemoryToolError(
                "MEMORY_SCOPE_FORBIDDEN",
                str(body.get("message") or "无权访问该团队作用域"),
                details={"httpStatus": 403},
            )
        if response.status_code >= 400 or body.get("code") != 0:
            raise MemoryToolError(
                str(body.get("errorCode") or "MEMORY_UNAVAILABLE"),
                str(body.get("message") or f"团队记忆请求失败 HTTP {response.status_code}"),
                retryable=response.status_code >= 500,
                details={"httpStatus": response.status_code},
            )
        if not isinstance(body, dict):
            raise MemoryToolError("MEMORY_UNAVAILABLE", "团队记忆响应不是对象")
        return body


master_memory_tool = MasterMemoryTool()
