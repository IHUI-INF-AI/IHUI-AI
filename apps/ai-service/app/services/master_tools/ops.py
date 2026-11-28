# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""总管智能体 · `agent_ops` 工具（P3-05）。

已落地九种 dispatch：single / parallel / pipeline / debate / vote / critique /
team / recursive / decomposed，全部创建父 run、真实执行并写步骤事件；
另含运行只读面（run_list/get/logs/artifacts/stats）+ pause/resume/talk + health。
stop/retry/cancel 未完成前明确返回 `AGENT_ACTION_NOT_IMPLEMENTED`，不伪造成功。
"""

from __future__ import annotations

import asyncio
import logging
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
        "strategy": {
            "type": "string",
            "enum": ["merge", "best_of", "consensus"],
            "description": "team 模式的聚合策略，默认 merge",
        },
        "chunks": {
            "type": "array",
            "maxItems": 20,
            "items": {"type": "string", "minLength": 1, "maxLength": 12000},
            "description": "recursive 模式的原文分片；不传则拒绝执行",
        },
        "depth": {"type": "integer", "minimum": 1, "maximum": 3, "default": 1},
        "maxCharsPerNode": {
            "type": "integer",
            "minimum": 1024,
            "maximum": 32768,
            "default": 8192,
        },
        "decomposeStrategy": {
            "type": "string",
            "enum": ["sequential", "parallel", "dag"],
            "description": "decomposed 模式的任务分解策略，默认 dag",
        },
        "constraints": {"type": "array", "items": {"type": "string"}, "maxItems": 16},
        "deliverables": {"type": "array", "items": {"type": "string"}, "maxItems": 16},
        "budget": {"type": "object"},
        "agents": {
            "type": "array",
            "maxItems": 9,
            "description": "parallel/debate/vote/critique/team/recursive/decomposed 的参与者；每项必须有 definitionId 或 name",
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
    "查看和控制智能体运行：dispatch 支持 single / parallel / pipeline / debate / vote / critique / team / recursive / decomposed，"
    "会创建父 run、真实执行并写步骤事件；run_list/run_get/run_logs/run_artifacts/run_stats 可查；"
    "run_pause/run_resume/run_talk 可操作当前实例的在飞会话，health 查运行时；"
    "stop/retry/cancel 尚未接线，会明确报未实现。"
)

_ALLOWED_ARGS = frozenset(INPUT_SCHEMA["properties"].keys())
_LOCAL_ACTIONS = frozenset({"dispatch", "run_pause", "run_resume", "run_talk"})
logger = logging.getLogger(__name__)


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

    # API 内部账本用 zod datetime 校验，只接受 Z 结尾；isoformat 的 +00:00 会被 400。
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


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


def _recursive_to_orchestration(rr: dict[str, Any]) -> Any:
    """把 run_recursive 的分层 dict 归一成 OrchestrationResult，父 run 仍走同一套落账。"""
    from ..agent_orchestrator import AgentStepResult, OrchestrationResult

    steps: list[AgentStepResult] = []
    levels = rr.get("levels") or []
    for level in levels:
        for contributor in level.get("contributors") or []:
            status = str(contributor.get("status") or "failed")
            steps.append(
                AgentStepResult(
                    agent_name=str(contributor.get("name") or "part"),
                    input=str(contributor.get("task") or ""),
                    output=str(contributor.get("output") or ""),
                    status="completed" if status == "completed" else "failed",
                    duration_ms=float(contributor.get("duration_ms") or 0.0),
                    error=(
                        None
                        if status == "completed"
                        else str(contributor.get("error") or "子任务未完成")
                    ),
                )
            )
    failed = sum(1 for step in steps if step.status != "completed")
    return OrchestrationResult(
        orchestration_id=f"recursive-{uuid.uuid4().hex[:8]}",
        steps=steps,
        final_output=str(rr.get("merged_text") or ""),
        status="completed" if steps and failed == 0 else "failed",
        total_duration_ms=round(sum(step.duration_ms for step in steps), 2),
        trace=[
            {
                "depth": level.get("round_index"),
                "nodes": len(level.get("contributors") or []),
                "succeeded": level.get("succeeded"),
                "failed": level.get("failed"),
            }
            for level in levels
        ],
    )


def _team_round_to_orchestration(rr: Any) -> Any:
    """把 TeamRoundResult 归一成 OrchestrationResult，复用父 run 的落账与返回形状。"""
    from ..agent_orchestrator import AgentStepResult, OrchestrationResult

    steps = [
        AgentStepResult(
            agent_name=contributor.name,
            input="",
            output=contributor.output,
            status=contributor.status,
            duration_ms=contributor.duration_ms,
            error=contributor.error,
        )
        for contributor in rr.contributors
    ]
    merged = str(rr.aggregate.get("merged_text") or rr.summary_context or "")
    recommendation = str(rr.aggregate.get("recommendation") or "")
    if recommendation:
        merged = f"{merged}\n\n建议:{recommendation}" if merged else recommendation
    return OrchestrationResult(
        orchestration_id=rr.round_id,
        steps=steps,
        final_output=merged,
        status="completed" if rr.failed == 0 else "failed",
        total_duration_ms=round(sum(step.duration_ms for step in steps), 2),
        trace=[
            {
                "round": rr.round_index,
                "strategy": rr.strategy,
                "succeeded": rr.succeeded,
                "failed": rr.failed,
            }
        ],
    )


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
        if mode in (
            "parallel",
            "pipeline",
            "debate",
            "vote",
            "critique",
            "team",
            "recursive",
            "decomposed",
        ):
            return await self._dispatch_multi(payload, mode=mode, user_id=user_id)
        if mode != "single":
            raise OpsToolError(
                "AGENT_MODE_NOT_IMPLEMENTED",
                "dispatch 当前支持 single / parallel / pipeline / debate / vote / critique / team / recursive / decomposed，"
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
        if mode in ("debate", "vote", "critique", "team", "decomposed"):
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
        elif mode == "decomposed":
            if not goal:
                raise OpsToolError("AGENT_DISPATCH_INPUT_MISSING", "decomposed 需要顶层 goal 作为待分解任务")
            agent_ids = [definition.id for definition in resolved]
        elif mode == "recursive":
            if not goal:
                raise OpsToolError("AGENT_DISPATCH_INPUT_MISSING", "recursive 需要顶层 goal 作为递归目标")
            raw_chunks = payload.get("chunks")
            if not isinstance(raw_chunks, list) or not raw_chunks:
                raise OpsToolError("AGENT_DISPATCH_INPUT_MISSING", "recursive 需要非空 chunks")
            if len(raw_chunks) > 20:
                raise OpsToolError("AGENT_DISPATCH_INPUT_INVALID", "recursive 一次最多 20 个分片")
            chunks = [str(chunk).strip() for chunk in raw_chunks if str(chunk).strip()]
            if not chunks:
                raise OpsToolError("AGENT_DISPATCH_INPUT_MISSING", "recursive 的 chunks 不能全是空串")
            agent_ids = [definition.id for definition in resolved]
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
            team_tasks = []
            seen_names: dict[str, int] = {}
            for item, definition in zip(items, resolved, strict=True):
                order = seen_names.get(definition.name, 0) + 1
                seen_names[definition.name] = order
                team_tasks.append(
                    {
                        "name": (
                            definition.name
                            if order == 1
                            else f"{definition.name}#{order}"
                        ),
                        "task": (
                            str(item.get("goal") or "").strip()
                            if isinstance(item, dict) and str(item.get("goal") or "").strip()
                            else goal
                        ),
                    }
                )

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
            elif mode == "critique":
                result = await orchestrator.run_critique(
                    agent_ids,
                    goal,
                    max_rounds=int(payload.get("maxRounds") or 2),
                    session_id=f"{run_id}-session",
                )
            elif mode == "decomposed":
                result = await orchestrator.run_decomposed(
                    goal,
                    strategy=str(payload.get("decomposeStrategy") or "dag"),
                    session_id=f"{run_id}-session",
                    agent_refs=agent_ids,
                )
            elif mode == "recursive":
                from ..agent_teams import TeamContributor, TeamOrchestrator

                async def chunk_runner(
                    tasks: list[dict[str, Any]], max_concurrency: int
                ) -> list[TeamContributor]:
                    semaphore = asyncio.Semaphore(max(1, min(max_concurrency, 5)))
                    async def run_one(task: dict[str, Any]) -> TeamContributor:
                        part = str(task.get("name") or "part-0")
                        try:
                            index = int(part.rsplit("-", 1)[1]) - 1
                        except (IndexError, ValueError):
                            index = 0
                        definition = resolved[index % len(resolved)]
                        task_text = str(task.get("task") or goal)
                        async with semaphore:
                            try:
                                sub = await orchestrator.invoke(
                                    definition.id,
                                    task_text,
                                    session_id=f"{run_id}-session",
                                )
                            except Exception as error:  # noqa: BLE001 -- 单个分片失败不拖垮整层
                                return TeamContributor(
                                    name=f"{definition.name}#{part}",
                                    task=task_text,
                                    status="failed",
                                    error=f"{type(error).__name__}: {error}"[:300],
                                )
                        # invoke 返回 AgentStepResult（字段是 output），
                        # 历史 runner 契约是 final_output；两边都接住，避免真跑才炸。
                        output = str(
                            getattr(sub, "final_output", None)
                            or getattr(sub, "output", "")
                        )
                        return TeamContributor(
                            name=f"{definition.name}#{part}",
                            task=task_text,
                            status="completed" if sub.status == "completed" else "failed",
                            output=output,
                            error=None if sub.status == "completed" else "子任务未完成",
                            duration_ms=float(
                                getattr(sub, "total_duration_ms", None)
                                or getattr(sub, "duration_ms", 0.0)
                            ),
                            conclusion=output[:120],
                        )

                    return list(
                        await asyncio.gather(*(run_one(task) for task in tasks))
                    )

                recursive = await TeamOrchestrator(orchestrator=orchestrator).run_recursive(
                    goal,
                    chunks,
                    runner=chunk_runner,
                    merge_strategy="merge",
                    max_concurrency=min(len(chunks), 5),
                    depth=max(1, min(3, int(payload.get("depth") or 1))),
                    max_chars_per_node=max(
                        1024, min(32768, int(payload.get("maxCharsPerNode") or 8192))
                    ),
                )
                if recursive.get("ok") is False:
                    raise OpsToolError(
                        str(recursive.get("errorCode") or "AGENT_DISPATCH_FAILED"),
                        str(recursive.get("error") or "recursive 执行被拒绝"),
                        details={"runId": run_id},
                    )
                result = _recursive_to_orchestration(recursive)
            else:
                from ..agent_teams import TeamOrchestrator

                team = await TeamOrchestrator(orchestrator=orchestrator).run_round(
                    objective=goal,
                    tasks=team_tasks,
                    strategy=str(payload.get("strategy") or "merge"),  # type: ignore[arg-type]
                    max_concurrency=min(len(team_tasks), 5),
                )
                result = _team_round_to_orchestration(team)
        except OpsToolError as error:
            await ledger.update_run(
                run_id,
                {
                    "status": "failed",
                    "errorCode": error.code,
                    "errorMessage": error.message[:2000],
                    "endedAt": _now_iso(),
                },
            )
            raise
        except Exception as error:  # noqa: BLE001 -- 失败也要把父 run 收口
            logger.exception("[master-ops] %s dispatch failed run=%s", mode, run_id)
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
        # 终态必须落在步骤事件之后：否则 run_logs 先看到 succeeded，再看到 step，
        # 时间线读起来像“结束后又执行了一次”。
        await session.status(
            registry_status,
            error_code=(
                "AGENT_STUB_RESULT"
                if result.status == "stub"
                else (first_error.error_code if first_error else None)
            ),
            error_message=(first_error.error if first_error else None),
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
