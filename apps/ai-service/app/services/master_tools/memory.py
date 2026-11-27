# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""总管智能体 · `master_memory` 工具（P3-06）。

只做用户作用域的语义记忆；team/agent 作用域尚未接线，明确拒绝而不是假装写入。
写入口要求显式来源与 kind，便于审计与冲突排序。
"""

from __future__ import annotations

import time
import uuid
from typing import Any

TOOL_NAME = "master_memory"

ACTION_VALUES = ["memory_search", "memory_write", "memory_forget"]

INPUT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "required": ["action"],
    "additionalProperties": False,
    "properties": {
        "action": {"type": "string", "enum": ACTION_VALUES},
        "query": {"type": "string", "maxLength": 500},
        "scope": {"type": "string", "enum": ["user", "team", "agent"], "default": "user"},
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
    "检索、写入、遗忘用户长期记忆。只在用户明确说“记住”或判断为稳定偏好时写；"
    "一次性任务、日程、提醒、订阅不写。memory_forget 只删用户作用域语义记忆并需理由。"
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


class MasterMemoryTool:
    name = TOOL_NAME
    description = DESCRIPTION
    input_schema = INPUT_SCHEMA

    def __init__(self, service: Any | None = None) -> None:
        self._service = service

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
        if scope != "user":
            raise MemoryToolError(
                "MEMORY_SCOPE_UNSUPPORTED",
                f"{scope} 作用域尚未接线，当前只支持 user",
                suggestion="先用 user 作用域；团队记忆留给后续版本",
            )

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


master_memory_tool = MasterMemoryTool()
