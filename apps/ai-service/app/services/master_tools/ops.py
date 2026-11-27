# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""总管智能体 · `agent_ops` 工具（P3-05）。

已落地：single / parallel / pipeline 派发真执行；运行只读面
（run_list/get/logs/artifacts/stats）+ pause/resume/talk + health。
debate/vote/critique/decomposed/team/recursive 与 stop/retry/cancel 未完成前
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
    {
        "dispatch",
        "run_list",
        "run_get",
        "run_logs",
        "run_artifacts",
        "run_stats",
        "run_pause",
        "run_resume",
        "run_talk",
        "health",
    }
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
        "maxRounds": {"type": "integer", "minimum": 1, "maximum": 6, "description": "debate/critique 轮次"},
        "constraints": {"type": "array", "items": {"type": "string"}, "maxItems": 16},
        "deliverables": {"type": "array", "items": {"type": "string"}, "maxItems": 16},
        "budget": {"type": "object"},
        "agents": {
            "type": "array",
            "maxItems": 9,
            "description": "parallel/debate/vote/critique 的参与者；每项必须有 definitionId 或 name",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "definitionId": {"type": "string", "format": "uuid"},
                    "name": {"type": "string"},
                    "goal": {"type": "string", "maxLength": 8000},
                },
            },
        },
        "steps": {
            "type": "array",
            "maxItems": 9,
            "description": "pipeline 模式的步骤；inputTemplate 支持 {input}/{prev_output}/{step}",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["inputTemplate"],
                "properties": {
                    "definitionId": {"type": "string", "format": "uuid"},
                    "name": {"type": "string"},
                    "inputTemplate": {"type": "string", "maxLength": 8000},
                },
            },
        },
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
    "查看和控制智能体运行：dispatch 支持 single / parallel / pipeline / debate / vote / critique，"
    "会创建父 run、真实执行并写步骤事件；run_list/run_get/run_logs/run_artifacts/run_stats 可查；"
    "run_pause/run_resume/run_talk 可操作当前实例的在飞会话，health 查运行时；"
    "decomposed/team/recursive 与 stop/retry/cancel 尚未接线，会明确报未实现。"
)

_ALLOWED_ARGS = frozenset(INPUT_SCHEMA["properties"].keys())
_LOCAL_ACTIONS = frozenset({"dispatch", "run_pause", "run_resume", "run_talk"})


def _api_base_url() -> str:
    override = os.environ.get("API_INTERNAL_BASE_URL", "").strip()
    if override:
        return override.rstrip("/")
    from ...core.config import settings

    return str(getattr(settings, "api_service_url", "http://localhost:8802")).rstrip("/")


def _enum_value(value: Any) -> Any:
    return getattr(value, "value", value)


def _now_iso() -> str:
    from datetime import UTC, datetime

    return datetime.now(UTC).isoformat()


def _resolve_dispatchable(provider: Any, ref: str) -> Any:
    """把解析错误收敛成 OpsToolError；不可派发的定义在这里就拒绝，不等到执行。"""
    from ..agent_resolver import AgentResolveError

    try:
        definition = provider.resolve(ref)
    except AgentResolveError as error:
        raise OpsToolError(
            error.code,
            error.message,
            details=error.details,
            suggestion="先用 agent_registry.inspect 确认 definitionId/name 与状态",
        ) from error
    if not definition.is_dispatchable:
        raise OpsToolError(
            "AGENT_NOT_DISPATCHABLE",
            "该定义未开启 isDispatchable",
            details={"definitionId": definition.id},
        )
    return definition


def _truncate(text: str, limit: int = 4000) -> str:
    return text if len(text) <= limit else text[:limit] + f"\n…[截断 {len(text) - limit} 字符]"


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
            if payload["action"] in _LOCAL_ACTIONS:
                result = await self._local_action(payload, user_id=user_id)
            else:
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

    async def _local_action(self, payload: dict[str, Any], *, user_id: str) -> Any:
        """dispatch 真实执行 single；pause/resume/talk 依赖本实例在飞会话。"""
        if payload["action"] == "dispatch":
            return await self._dispatch(payload, user_id=user_id)

        run_id = str(payload.get("runId") or "").strip()
        if not run_id:
            raise OpsToolError("AGENT_RUN_ID_REQUIRED", f"{payload['action']} 需要 runId")
        run = await self._post_ops({"action": "run_get", "runId": run_id}, user_id=user_id)
        session_id = str(run.get("sessionId") or "").strip() if isinstance(run, dict) else ""
        if not session_id:
            raise OpsToolError(
                "AGENT_RUN_SESSION_MISSING",
                "该运行没有 sessionId，无法定位在飞会话",
                details={"runId": run_id},
            )

        from ..agent_run_control import pause_session, resume_session, wake_session

        action = payload["action"]
        if action == "run_pause":
            result = await pause_session(session_id, user_id)
            return {
                "runId": run_id,
                "sessionId": session_id,
                "outcome": _enum_value(result.outcome),
                "changed": result.changed,
                "detail": result.detail,
            }
        if action == "run_resume":
            resumed = await resume_session(session_id, user_id)
            return {
                "runId": run_id,
                "sessionId": session_id,
                "outcome": _enum_value(resumed.outcome),
                "changed": resumed.changed,
                "detail": resumed.detail,
            }
        message = str(payload.get("message") or "").strip()
        if not message:
            raise OpsToolError("AGENT_MESSAGE_REQUIRED", "run_talk 需要 message")
        woken = await wake_session(session_id, owner_user_id=user_id, text=message)
        return {"runId": run_id, "sessionId": session_id, **woken}

    async def _dispatch(self, payload: dict[str, Any], *, user_id: str) -> dict[str, Any]:
        from ..agent_definition_provider import AgentDefinitionProvider
        from ..agent_orchestrator import AgentOrchestrator
        from ..agent_registry_client import AgentRegistryClient
        from ..run_ledger import RunLedgerClient

        mode = str(payload.get("mode") or "single")
        if mode in ("parallel", "pipeline", "debate", "vote", "critique"):
            return await self._dispatch_multi(payload, mode=mode, user_id=user_id)
        if mode != "single":
            raise OpsToolError(
                "AGENT_MODE_NOT_IMPLEMENTED",
                f"dispatch 当前支持 single / parallel / pipeline / debate / vote / critique，"
                f"拒绝把 {mode} 当成已执行",
                details={"mode": mode},
            )
        ref = str(payload.get("definitionId") or payload.get("name") or "").strip()
        goal = str(payload.get("goal") or "").strip()
        if not ref or not goal:
            raise OpsToolError(
                "AGENT_DISPATCH_INPUT_MISSING",
                "dispatch 需要 definitionId 或 name，以及 goal",
            )

        client = AgentRegistryClient(
            user_id=user_id, base_url=self._base_url, transport=self._transport
        )
        provider = AgentDefinitionProvider(client, user_id=user_id)
        await provider.prepare()
        definition = _resolve_dispatchable(provider, ref)

        run_id = str(uuid.uuid4())
        trace_id = f"tr_{uuid.uuid4().hex}"
        ledger = RunLedgerClient(
            user_id=user_id, base_url=self._base_url, transport=self._transport
        )
        await ledger.create_run(
            {
                "runId": run_id,
                "definitionId": definition.id,
                "definitionVersion": definition.version,
                "definitionName": definition.name,
                "ownerUserId": user_id,
                "mode": "single",
                "goal": goal,
                "traceId": trace_id,
                "status": "queued",
                "metadata": {"source": "master_tools.agent_ops.dispatch"},
            }
        )

        orchestrator = AgentOrchestrator(
            definition_provider=provider,
            run_ledger=ledger,
        )
        try:
            result = await orchestrator.invoke(definition.name, goal, run_id=run_id)
        except Exception as error:  # noqa: BLE001 -- 运行失败也要把 run 收口
            await ledger.update_run(
                run_id,
                {
                    "status": "failed",
                    "errorCode": "AGENT_DISPATCH_FAILED",
                    "errorMessage": f"{type(error).__name__}: {error}"[:2000],
                    "endedAt": _now_iso(),
                },
            )
            raise OpsToolError(
                "AGENT_DISPATCH_FAILED",
                f"派发执行失败: {type(error).__name__}",
                details={"runId": run_id},
            ) from error

        return {
            "runId": run_id,
            "traceId": trace_id,
            "definitionId": definition.id,
            "definitionVersion": definition.version,
            "agent": result.agent_name,
            "status": result.status,
            "output": result.output,
            "error": result.error,
            "errorCode": result.error_code,
            "durationMs": result.duration_ms,
            "iterations": result.iterations,
        }

    async def _dispatch_multi(
        self, payload: dict[str, Any], *, mode: str, user_id: str
    ) -> dict[str, Any]:
        """多参与者模式的父 run + 子步骤执行；debate/vote/critique 复用同一父账本。"""
        from ..agent_definition_provider import AgentDefinitionProvider
        from ..agent_orchestrator import AgentOrchestrator, to_run_registry_status
        from ..agent_registry_client import AgentRegistryClient
        from ..run_ledger import RunLedgerClient

        goal = str(payload.get("goal") or "").strip()
        items_key = "steps" if mode == "pipeline" else "agents"
        items = payload.get(items_key)
        if not isinstance(items, list) or not items:
            raise OpsToolError(
                "AGENT_DISPATCH_INPUT_MISSING",
                f"{mode} 需要非空 {items_key}",
            )
        if len(items) > 9:
            raise OpsToolError("AGENT_DISPATCH_INPUT_INVALID", "一次最多 9 个参与者/步骤")

        def _ref(item: Any) -> str:
            if not isinstance(item, dict):
                raise OpsToolError("AGENT_DISPATCH_INPUT_INVALID", "参与者/步骤必须是对象")
            return str(item.get("definitionId") or item.get("name") or "").strip()

        refs = [_ref(item) for item in items]
        if any(not ref for ref in refs):
            raise OpsToolError(
                "AGENT_DISPATCH_INPUT_MISSING",
                "每个参与者/步骤都需要 definitionId 或 name",
            )

        client = AgentRegistryClient(
            user_id=user_id, base_url=self._base_url, transport=self._transport
        )
        provider = AgentDefinitionProvider(client, user_id=user_id)
        await provider.prepare()

        resolved = [_resolve_dispatchable(provider, ref) for ref in refs]
        if mode in ("debate", "vote", "critique"):
            # 这三个模式内部直接 _run_agent，不经过 invoke 的白名单校验；在父 run 建账前补上。
            from ..agent_resolver import AgentResolveError

            validator = AgentOrchestrator(definition_provider=provider)
            for definition in resolved:
                try:
                    validator.validate_dispatch_definition(definition)
                except AgentResolveError as error:
                    raise OpsToolError(
                        error.code,
                        error.message,
                        details=error.details,
                    ) from error
        parent_ref = str(payload.get("definitionId") or payload.get("name") or "").strip() or refs[0]
        parent = _resolve_dispatchable(provider, parent_ref)

        if mode == "parallel":
            if not goal:
                goals = [
                    str(item.get("goal") or "").strip() if isinstance(item, dict) else ""
                    for item in items
                ]
                if all(goals):
                    goal = "并行派发：" + "；".join(goals)
                else:
                    raise OpsToolError(
                        "AGENT_DISPATCH_INPUT_MISSING",
                        "parallel 需要顶层 goal，或每个参与者都给 goal",
                    )
            agent_inputs = [
                {
                    "agent": definition.id,
                    "input": (
                        str(item.get("goal") or "").strip()
                        if isinstance(item, dict) and str(item.get("goal") or "").strip()
                        else goal
                    ),
                }
                for item, definition in zip(items, resolved, strict=True)
            ]
        elif mode == "pipeline":
            if not goal:
                raise OpsToolError("AGENT_DISPATCH_INPUT_MISSING", "pipeline 需要顶层 goal 作为初始输入")
            steps = [
                {
                    "agent": definition.id,
                    "input_template": (
                        str(item.get("inputTemplate") or "{input}")
                        if isinstance(item, dict)
                        else "{input}"
                    ),
                }
                for item, definition in zip(items, resolved, strict=True)
            ]
        else:
            if not goal:
                raise OpsToolError(
                    "AGENT_DISPATCH_INPUT_MISSING", f"{mode} 需要顶层 goal 作为讨论/投票/批判主题"
                )
            if len(resolved) < 2:
                raise OpsToolError(
                    "AGENT_DISPATCH_INPUT_INVALID",
                    f"{mode} 至少需要 2 个参与者",
                )
            agent_ids = [definition.id for definition in resolved]

        run_id = str(uuid.uuid4())
        trace_id = f"tr_{uuid.uuid4().hex}"
        ledger = RunLedgerClient(
            user_id=user_id, base_url=self._base_url, transport=self._transport
        )
        await ledger.create_run(
            {
                "runId": run_id,
                "definitionId": parent.id,
                "definitionVersion": parent.version,
                "definitionName": parent.name,
                "ownerUserId": user_id,
                "mode": mode,
                "goal": goal,
                "traceId": trace_id,
                "status": "queued",
                "metadata": {
                    "source": "master_tools.agent_ops.dispatch",
                    "participants": [definition.id for definition in resolved],
                },
            }
        )
        session = ledger.session(run_id)
        await session.status("running")

        orchestrator = AgentOrchestrator(
            definition_provider=provider,
            run_ledger=ledger,
        )
        try:
            if mode == "parallel":
                result = await orchestrator.run_parallel(
                    agent_inputs, session_id=f"{run_id}-session"
                )
            elif mode == "pipeline":
                result = await orchestrator.run_pipeline(
                    steps, initial_input=goal, session_id=f"{run_id}-session"
                )
            elif mode == "debate":
                result = await orchestrator.run_debate(
                    agent_ids,
                    goal,
                    max_rounds=int(payload.get("maxRounds") or 3),
                    session_id=f"{run_id}-session",
                )
            elif mode == "vote":
                result = await orchestrator.run_vote(agent_ids, goal, session_id=f"{run_id}-session")
            else:
                result = await orchestrator.run_critique(
                    agent_ids,
                    goal,
                    max_rounds=int(payload.get("maxRounds") or 2),
                    session_id=f"{run_id}-session",
                )
        except Exception as error:  # noqa: BLE001 -- 失败也要把父 run 收口
            await ledger.update_run(
                run_id,
                {
                    "status": "failed",
                    "errorCode": "AGENT_DISPATCH_FAILED",
                    "errorMessage": f"{type(error).__name__}: {error}"[:2000],
                    "endedAt": _now_iso(),
                },
            )
            raise OpsToolError(
                "AGENT_DISPATCH_FAILED",
                f"{mode} 派发执行失败: {type(error).__name__}",
                details={"runId": run_id},
            ) from error

        registry_status = to_run_registry_status(result.status)
        first_error = next((step for step in result.steps if step.status == "failed"), None)
        await session.status(
            registry_status,
            error_code=(
                "AGENT_STUB_RESULT"
                if result.status == "stub"
                else (first_error.error_code if first_error else None)
            ),
            error_message=(first_error.error if first_error else None),
        )
        for index, step in enumerate(result.steps, start=1):
            await session.append(
                "step",
                {
                    "iteration": index,
                    "agent": step.agent_name,
                    "status": to_run_registry_status(step.status),
                    "durationMs": step.duration_ms,
                    **({"error": step.error[:500]} if step.error else {}),
                },
            )

        return {
            "runId": run_id,
            "traceId": trace_id,
            "mode": mode,
            "definitionId": parent.id,
            "definitionVersion": parent.version,
            "agent": parent.name,
            "status": result.status,
            "runStatus": registry_status,
            "output": _truncate(result.final_output),
            "durationMs": result.total_duration_ms,
            "steps": [
                {
                    "agent": step.agent_name,
                    "status": step.status,
                    "runStatus": to_run_registry_status(step.status),
                    "durationMs": step.duration_ms,
                    "output": _truncate(step.output),
                    "error": step.error,
                    "errorCode": step.error_code,
                }
                for step in result.steps
            ],
        }

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
