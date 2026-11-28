# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""总管智能体 · `agent_ops` 工具（P3-05）。

已落地九种 dispatch：single / parallel / pipeline / debate / vote / critique /
team / recursive / decomposed，全部创建父 run、真实执行并写步骤事件；
另含运行只读面（run_list/get/logs/artifacts/stats）+ pause/resume/talk +
run_cancel/run_stop（当前进程硬取消，跨进程通过 Redis 取消位通知执行实例）+ run_retry（按 dispatchPayload 重建）。
"""

from __future__ import annotations

import asyncio
import contextlib
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
from ..agent_run_cancel_bus import (
    request_remote_cancel,
    request_remote_steer,
    start_remote_cancel_watch,
    stop_remote_cancel_watch,
)
from ..agent_task_registry import (
    cancel_tasks,
    register_run_control,
    register_task,
    request_local_steer,
    request_local_stop,
    run_task_key,
    session_task_key,
    unregister_run_control,
    unregister_task,
)

TOOL_NAME = "agent_ops"

# 跨实例取消发出后等待执行实例收口的时间；超时如实返回 remote_requested，不冒充已停。
_REMOTE_CANCEL_TIMEOUT_SECONDS = 10.0
_REMOTE_CANCEL_POLL_SECONDS = 0.5
# 优雅停止要等当前步骤收口，给足时间；超时只报 stop_requested，不硬砍。
_GRACEFUL_STOP_TIMEOUT_SECONDS = 30.0

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
        "run_stop",
        "run_retry",
        "run_cancel",
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
    "run_pause/run_resume/run_talk 可操作当前实例的在飞会话；"
    "run_cancel/run_stop 硬取消：本进程直接 cancel，跨进程通过 Redis 取消位通知执行实例；"
    "run_retry 按创建 run 时保存的 dispatchPayload 重建新 run。"
    "health 查运行时。"
)

_ALLOWED_ARGS = frozenset(INPUT_SCHEMA["properties"].keys())
_LOCAL_ACTIONS = frozenset(
    {
        "dispatch",
        "run_pause",
        "run_resume",
        "run_talk",
        "run_stop",
        "run_retry",
        "run_cancel",
    }
)
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


def _dispatch_snapshot(payload: dict[str, Any]) -> dict[str, Any]:
    """只留可重放输入，供 run_retry 原样重建；不把 action/runId 写进快照。"""
    return {
        key: value
        for key, value in payload.items()
        if key not in ("action", "runId") and value is not None
    }


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

    async def handle(
        self,
        arguments: dict[str, Any],
        *,
        user_id: str,
        master_session_id: str | None = None,
    ) -> dict[str, Any]:
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
                result = await self._local_action(
                    payload, user_id=user_id, master_session_id=master_session_id
                )
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

    async def _local_action(
        self,
        payload: dict[str, Any],
        *,
        user_id: str,
        master_session_id: str | None = None,
    ) -> Any:
        """dispatch 真实执行 single；pause/resume/talk 依赖本实例在飞会话。"""
        if payload["action"] == "dispatch":
            return await self._dispatch(
                payload, user_id=user_id, master_session_id=master_session_id
            )

        run_id = str(payload.get("runId") or "").strip()
        if not run_id:
            raise OpsToolError("AGENT_RUN_ID_REQUIRED", f"{payload['action']} 需要 runId")
        run = await self._post_ops({"action": "run_get", "runId": run_id}, user_id=user_id)
        session_id = str(run.get("sessionId") or "").strip() if isinstance(run, dict) else ""
        action = payload["action"]
        if action in ("run_cancel", "run_stop"):
            return await self._cancel_run(run, run_id=run_id, user_id=user_id, action=action)
        if action == "run_retry":
            return await self._retry_run(
                run,
                run_id=run_id,
                user_id=user_id,
                master_session_id=master_session_id,
            )

        if not session_id:
            raise OpsToolError(
                "AGENT_RUN_SESSION_MISSING",
                "该运行没有 sessionId，无法定位在飞会话",
                details={"runId": run_id},
            )

        from ..agent_run_control import PauseOutcome, pause_session, resume_session, wake_session

        if action in ("run_pause", "run_resume"):
            mode = str(run.get("mode") or "") if isinstance(run, dict) else ""
            if mode != "single":
                raise OpsToolError(
                    "AGENT_RUN_PAUSE_UNSUPPORTED",
                    "pause/resume 只支持 single 模式；multi 模式的检查点无法安全重建全部参与者",
                    details={"runId": run_id, "mode": mode},
                )
            run_status = str(run.get("status") or "") if isinstance(run, dict) else ""
            if action == "run_pause" and run_status in {
                "succeeded",
                "failed",
                "canceled",
                "timeout",
            }:
                raise OpsToolError(
                    "AGENT_RUN_ALREADY_TERMINAL",
                    "run 已终态，不能再暂停",
                    details={"runId": run_id, "runStatus": run_status},
                )
            if action == "run_resume" and run_status != "paused":
                raise OpsToolError(
                    "AGENT_RUN_NOT_PAUSED",
                    "只有 paused 状态的 run 才能续跑；completed checkpoint 不是暂停点",
                    details={"runId": run_id, "runStatus": run_status},
                )

        if action == "run_pause":
            result = await pause_session(session_id, user_id)
            data = {
                "runId": run_id,
                "sessionId": session_id,
                "outcome": _enum_value(result.outcome),
                "changed": result.changed,
                "detail": result.detail,
            }
            if result.checkpoint_id:
                data["checkpointId"] = result.checkpoint_id
            if result.outcome == PauseOutcome.PAUSED:
                await self._await_paused(run_id=run_id, user_id=user_id, data=data)
            elif (
                result.outcome == PauseOutcome.CHECKPOINT_UNAVAILABLE
                and result.changed
            ):
                # pause() 在 messages 尚未初始化时拿不到 eager checkpoint，但暂停标志
                # 已置位，循环会在轮次边界尝试落 boundary checkpoint。此时不能只回
                # checkpoint_unavailable 就结束：继续等账本落到 paused，并把“恢复点
                # 待确认”如实带回，避免调用方误以为 run 还在跑。
                data["checkpointPending"] = True
                await self._await_paused(run_id=run_id, user_id=user_id, data=data)
            return data
        if action == "run_resume":
            runner = self._make_resume_runner(run, run_id=run_id, user_id=user_id)
            resumed = await resume_session(session_id, user_id, runner=runner)
            return {
                "runId": run_id,
                "sessionId": session_id,
                "outcome": _enum_value(resumed.outcome),
                "changed": resumed.changed,
                "checkpointId": resumed.checkpoint_id,
                "result": resumed.result,
                "detail": resumed.detail,
            }
        message = str(payload.get("message") or "").strip()
        if not message:
            raise OpsToolError("AGENT_MESSAGE_REQUIRED", "run_talk 需要 message")
        if request_local_steer(run_id, message):
            return {
                "runId": run_id,
                "sessionId": session_id,
                "outcome": "steered",
                "changed": True,
                "delivery": "next_iteration",
            }
        run_status = str(run.get("status") or "") if isinstance(run, dict) else ""
        if run_status == "running" and await request_remote_steer(run_id, message):
            # 请求落在没有该 run 控制句柄的实例：写 Redis 队列，由执行实例的
            # watcher 在下一轮 LLM 前注入。这里如实回报 queued，不冒充已注入。
            return {
                "runId": run_id,
                "sessionId": session_id,
                "outcome": "queued",
                "changed": True,
                "delivery": "next_iteration",
                "remote": True,
            }
        woken = await wake_session(session_id, owner_user_id=user_id, text=message)
        return {"runId": run_id, "sessionId": session_id, **woken}

    async def _cancel_run(
        self,
        run: Any,
        *,
        run_id: str,
        user_id: str,
        action: str,
    ) -> dict[str, Any]:
        """硬取消 run：本进程有任务直接 cancel；没有任务则写跨实例取消位。

        两种情况都不改数据库冒充“已停”：本进程取消由执行任务的 CancelledError
        路径收口；跨实例由执行侧 watcher 取消任务后收口，控制侧只等待账本终态。
        """
        status = str(run.get("status") or "") if isinstance(run, dict) else ""
        terminal = {"succeeded", "failed", "canceled", "timeout"}
        if status in terminal:
            return {
                "runId": run_id,
                "outcome": "already_terminal",
                "runStatus": status,
                "cancelledTasks": 0,
            }

        session_id = str(run.get("sessionId") or "").strip() if isinstance(run, dict) else ""
        if action == "run_stop" and status != "paused":
            if request_local_stop(run_id):
                return await self._await_graceful_stop(
                    run_id=run_id,
                    user_id=user_id,
                    initial_status=status,
                    remote=False,
                )
            remote_requested = await request_remote_cancel(
                run_id,
                session_id=session_id,
                action="run_stop",
            )
            if not remote_requested:
                return {
                    "runId": run_id,
                    "outcome": "not_local",
                    "runStatus": status,
                    "cancelledTasks": 0,
                    "reason": "该 run 既无本地停止句柄，跨实例取消位也不可用",
                }
            return await self._await_graceful_stop(
                run_id=run_id,
                user_id=user_id,
                initial_status=status,
                remote=True,
            )

        keys = [run_task_key(run_id)]
        if session_id:
            keys.append(session_task_key(session_id))
        result = await cancel_tasks(keys)
        if result["matched"] == 0:
            if status == "paused":
                # paused 没有在飞任务，但“取消一个暂停中的 run”是明确的终态迁移；
                # 这不是用状态冒充硬停，故单独标 reason=paused。
                from ..run_ledger import RunLedgerClient

                ledger = RunLedgerClient(
                    user_id=user_id, base_url=self._base_url, transport=self._transport
                )
                await ledger.update_run(
                    run_id,
                    {
                        "status": "canceled",
                        "errorCode": (
                            "AGENT_RUN_STOPPED"
                            if action == "run_stop"
                            else "AGENT_RUN_CANCELED"
                        ),
                        "errorMessage": (
                            "用户停止暂停中的运行"
                            if action == "run_stop"
                            else "用户取消暂停中的运行"
                        ),
                        "endedAt": _now_iso(),
                    },
                )
                event_written = False
                with contextlib.suppress(Exception):
                    event_written = await self._append_cancel_event(
                        run_id=run_id,
                        user_id=user_id,
                        error_code=(
                            "AGENT_RUN_STOPPED"
                            if action == "run_stop"
                            else "AGENT_RUN_CANCELED"
                        ),
                        error_message=(
                            "用户停止执行" if action == "run_stop" else "用户取消执行"
                        ),
                    )
                return {
                    "runId": run_id,
                    "outcome": "stopped" if action == "run_stop" else "cancelled",
                    "runStatus": "canceled",
                    "cancelledTasks": 0,
                    "cancelEventWritten": event_written,
                    "stopRequested": action == "run_stop",
                    "reason": "paused",
                }
            remote_requested = await request_remote_cancel(
                run_id,
                session_id=session_id,
                action=action,
            )
            if not remote_requested:
                return {
                    "runId": run_id,
                    "outcome": "not_local",
                    "runStatus": status,
                    "cancelledTasks": 0,
                    "reason": "该 run 不在当前 AI 进程，且跨实例取消位不可用",
                }
            return await self._await_remote_cancel(
                run_id=run_id,
                user_id=user_id,
                action=action,
                initial_status=status,
            )
        if result["pending"] > 0:
            return {
                "runId": run_id,
                "outcome": "cancel_timeout",
                "runStatus": status,
                "cancelledTasks": result["done"],
                "pendingTasks": result["pending"],
            }

        event_written = False
        try:
            event_written = await self._append_cancel_event(run_id=run_id, user_id=user_id)
        except Exception:  # noqa: BLE001 -- 事件补写失败不能改变已取消的 run 行
            logger.exception("[master-ops] cancel event append failed run=%s", run_id)
        after = await self._post_ops({"action": "run_get", "runId": run_id}, user_id=user_id)
        final_status = str(after.get("status") or "") if isinstance(after, dict) else ""
        requested = "stopped" if action == "run_stop" else "cancelled"
        return {
            "runId": run_id,
            "outcome": requested if final_status == "canceled" else "cancel_incomplete",
            "runStatus": final_status or status,
            "cancelledTasks": result["done"],
            "cancelEventWritten": event_written,
        }

    async def _await_graceful_stop(
        self,
        *,
        run_id: str,
        user_id: str,
        initial_status: str,
        remote: bool,
    ) -> dict[str, Any]:
        """等待优雅停止收口；轮次边界停下才返回 stopped，超时只报 stop_requested。"""
        deadline = time.monotonic() + _GRACEFUL_STOP_TIMEOUT_SECONDS
        status = initial_status
        while True:
            try:
                after = await self._post_ops(
                    {"action": "run_get", "runId": run_id}, user_id=user_id
                )
                status = str(after.get("status") or "") if isinstance(after, dict) else status
            except Exception as error:  # noqa: BLE001 -- 停止已发出，查询失败不能反过来说没发
                logger.warning(
                    "[master-ops] graceful stop poll failed run=%s: %s", run_id, error
                )
                return {
                    "runId": run_id,
                    "outcome": "stop_requested",
                    "runStatus": status,
                    "cancelledTasks": 0,
                    "stopRequested": True,
                    "remoteRequested": remote,
                    "reason": "停止请求已发出，但运行账本暂时不可查",
                }

            if status == "canceled":
                event_written = False
                with contextlib.suppress(Exception):
                    event_written = await self._append_cancel_event(
                        run_id=run_id,
                        user_id=user_id,
                        error_code="AGENT_RUN_STOPPED",
                        error_message="用户停止执行",
                    )
                return {
                    "runId": run_id,
                    "outcome": "stopped",
                    "runStatus": "canceled",
                    "cancelledTasks": 0,
                    "cancelEventWritten": event_written,
                    "stopRequested": True,
                    "remoteRequested": remote,
                    "reason": "remote_stop" if remote else "local_stop",
                }
            if status in {"succeeded", "failed", "timeout"}:
                return {
                    "runId": run_id,
                    "outcome": "stop_incomplete",
                    "runStatus": status,
                    "cancelledTasks": 0,
                    "stopRequested": True,
                    "remoteRequested": remote,
                    "reason": "停止请求到达前 run 已进入其它终态",
                }
            if time.monotonic() >= deadline:
                return {
                    "runId": run_id,
                    "outcome": "stop_requested",
                    "runStatus": status,
                    "cancelledTasks": 0,
                    "stopRequested": True,
                    "remoteRequested": remote,
                    "reason": "已在当前轮次边界请求停止，等待收口超时",
                }
            await asyncio.sleep(_REMOTE_CANCEL_POLL_SECONDS)

    async def _await_remote_cancel(
        self,
        *,
        run_id: str,
        user_id: str,
        action: str,
        initial_status: str,
    ) -> dict[str, Any]:
        """等待远端执行实例收口；超时/轮询失败一律如实返回未完成，不冒充已停。"""
        deadline = time.monotonic() + _REMOTE_CANCEL_TIMEOUT_SECONDS
        status = initial_status
        while True:
            try:
                after = await self._post_ops(
                    {"action": "run_get", "runId": run_id}, user_id=user_id
                )
                status = str(after.get("status") or "") if isinstance(after, dict) else status
            except Exception as error:  # noqa: BLE001 -- 取消位已发出，查询失败不能反过来说没发
                logger.warning(
                    "[master-ops] remote cancel poll failed run=%s: %s", run_id, error
                )
                return {
                    "runId": run_id,
                    "outcome": "remote_requested",
                    "runStatus": status,
                    "cancelledTasks": 0,
                    "remoteRequested": True,
                    "reason": "取消位已写入，但运行账本暂时不可查",
                }

            if status == "canceled":
                event_written = False
                with contextlib.suppress(Exception):
                    event_written = await self._append_cancel_event(
                        run_id=run_id, user_id=user_id
                    )
                requested = "stopped" if action == "run_stop" else "cancelled"
                return {
                    "runId": run_id,
                    "outcome": requested,
                    "runStatus": "canceled",
                    "cancelledTasks": 0,
                    "cancelEventWritten": event_written,
                    "remoteRequested": True,
                    "reason": "remote",
                }
            if status in {"succeeded", "failed", "timeout"}:
                return {
                    "runId": run_id,
                    "outcome": "cancel_incomplete",
                    "runStatus": status,
                    "cancelledTasks": 0,
                    "remoteRequested": True,
                    "reason": "取消位到达前 run 已进入其它终态",
                }
            if time.monotonic() >= deadline:
                return {
                    "runId": run_id,
                    "outcome": "remote_requested",
                    "runStatus": status,
                    "cancelledTasks": 0,
                    "remoteRequested": True,
                    "reason": "取消位已写入，等待执行实例收口超时",
                }
            await asyncio.sleep(_REMOTE_CANCEL_POLL_SECONDS)

    async def _await_paused(
        self, *, run_id: str, user_id: str, data: dict[str, Any]
    ) -> dict[str, Any]:
        """暂停请求发出后等 run 真正落到 paused；超时只报 pause_requested。"""
        deadline = time.monotonic() + _GRACEFUL_STOP_TIMEOUT_SECONDS
        status = "running"
        while True:
            try:
                after = await self._post_ops(
                    {"action": "run_get", "runId": run_id}, user_id=user_id
                )
                status = str(after.get("status") or "") if isinstance(after, dict) else status
            except Exception as error:  # noqa: BLE001
                logger.warning("[master-ops] pause poll failed run=%s: %s", run_id, error)
                data.update(outcome="pause_requested", runStatus=status)
                return data
            if status == "paused":
                data.update(outcome="paused", changed=True, runStatus="paused")
                return data
            if status in {"succeeded", "failed", "canceled", "timeout"}:
                data.update(
                    outcome="pause_incomplete",
                    changed=False,
                    runStatus=status,
                    reason="暂停请求到达前 run 已进入其它终态",
                )
                return data
            if time.monotonic() >= deadline:
                data.update(
                    outcome="pause_requested",
                    runStatus=status,
                    reason="暂停请求已发出，等待轮次边界收口超时",
                )
                return data
            await asyncio.sleep(_REMOTE_CANCEL_POLL_SECONDS)

    def _make_resume_runner(
        self, run: Any, *, run_id: str, user_id: str
    ) -> Any:
        async def runner(checkpoint: Any, requester: str) -> dict[str, Any]:
            return await self._resume_master_checkpoint(
                run, run_id=run_id, user_id=requester, checkpoint=checkpoint
            )

        return runner

    async def _resume_master_checkpoint(
        self,
        run: Any,
        *,
        run_id: str,
        user_id: str,
        checkpoint: Any,
    ) -> dict[str, Any]:
        """从真实 paused checkpoint 继续同一 run；不重跑已完成轮次。"""
        from ..agent_definition_provider import AgentDefinitionProvider
        from ..agent_orchestrator import AgentOrchestrator, to_run_registry_status
        from ..agent_registry_client import AgentRegistryClient
        from ..agent_checkpoint import get_agent_checkpoint_manager
        from ..run_ledger import RunLedgerClient

        metadata = getattr(checkpoint, "metadata", None) or {}
        definition_ref = str(
            metadata.get("definition_id")
            or (run.get("definitionId") if isinstance(run, dict) else "")
            or metadata.get("agent_name")
            or ""
        ).strip()
        if not definition_ref:
            raise OpsToolError(
                "AGENT_RESUME_CONTEXT_MISSING",
                "暂停 checkpoint 缺少 definition_id / agent_name，无法续跑",
                details={"runId": run_id},
            )
        session_id = str(
            metadata.get("session_id")
            or (run.get("sessionId") if isinstance(run, dict) else "")
            or ""
        ).strip()
        if not session_id:
            raise OpsToolError(
                "AGENT_RESUME_CONTEXT_MISSING",
                "暂停 checkpoint 缺少 session_id，无法重建控制面载体",
                details={"runId": run_id},
            )
        client = AgentRegistryClient(
            user_id=user_id, base_url=self._base_url, transport=self._transport
        )
        provider = AgentDefinitionProvider(client, user_id=user_id)
        await provider.prepare()
        definition = _resolve_dispatchable(provider, definition_ref)
        ledger = RunLedgerClient(
            user_id=user_id, base_url=self._base_url, transport=self._transport
        )
        orchestrator = AgentOrchestrator(
            definition_provider=provider,
            run_ledger=ledger,
            owner_user_id=user_id,
            checkpoint_manager=get_agent_checkpoint_manager(),
            definition_id=definition.id,
        )
        from ..agent_run_control import RunRegistration, detach_run, register_run

        registration = await register_run(
            session_id,
            owner_user_id=user_id,
            loop=orchestrator,
            max_turns=definition.max_iterations,
        )
        if registration != RunRegistration.REGISTERED:
            raise OpsToolError(
                "AGENT_SESSION_BUSY",
                "该会话已有未终态 run，拒绝覆盖续跑控制面载体",
                details={
                    "runId": run_id,
                    "sessionId": session_id,
                    "registration": registration.value,
                },
            )
        register_run_control(run_id, orchestrator)
        try:
            result = await orchestrator.resume(checkpoint, run_id=run_id)
        finally:
            unregister_run_control(run_id, orchestrator)
            # 续跑结束后把控制面记录交还给 detach_run：若本轮再次暂停则保留
            # paused 记录，若已结束则删除，不能留下一个挂着 orchestrator 的 running 记录。
            await detach_run(session_id, owner_user_id=user_id)
        return {
            "status": result.status,
            "runStatus": to_run_registry_status(result.status),
            "stop_reason": "paused" if result.status == "paused" else None,
            "output": result.output,
            "error": result.error,
            "errorCode": result.error_code,
            "iterations": result.iterations,
            "durationMs": result.duration_ms,
        }

    async def _retry_run(
        self,
        run: Any,
        *,
        run_id: str,
        user_id: str,
        master_session_id: str | None = None,
    ) -> dict[str, Any]:
        """按创建 run 时保存的 dispatch 快照重建一次新 run；旧 run 不改状态。"""
        status = str(run.get("status") or "") if isinstance(run, dict) else ""
        if status not in {"failed", "canceled", "timeout"}:
            raise OpsToolError(
                "AGENT_RUN_NOT_RETRYABLE",
                "只有 failed / canceled / timeout 的 run 可以 retry；"
                "running 请先 cancel，paused 请先 resume，succeeded 不应重跑",
                details={"runId": run_id, "runStatus": status},
            )
        metadata = run.get("metadata") if isinstance(run, dict) else {}
        snapshot = metadata.get("dispatchPayload") if isinstance(metadata, dict) else None
        if not isinstance(snapshot, dict):
            mode = str(run.get("mode") or "") if isinstance(run, dict) else ""
            definition_id = str(run.get("definitionId") or "") if isinstance(run, dict) else ""
            goal = str(run.get("goal") or "") if isinstance(run, dict) else ""
            if mode == "single" and definition_id and goal:
                snapshot = {"mode": "single", "definitionId": definition_id, "goal": goal}
            else:
                raise OpsToolError(
                    "AGENT_RETRY_SNAPSHOT_MISSING",
                    "该历史 run 没有 dispatchPayload 快照，无法原样重建多参与者/分片参数",
                    details={"runId": run_id, "mode": mode},
                )
        retry_payload = {
            key: value
            for key, value in snapshot.items()
            if key not in ("action", "runId") and value is not None
        }
        retry_payload["action"] = "dispatch"
        retried = await self._dispatch(
            retry_payload, user_id=user_id, master_session_id=master_session_id
        )
        return {
            "retriedFrom": run_id,
            "requestedMode": retry_payload.get("mode") or "single",
            "run": retried,
        }

    async def _append_cancel_event(
        self,
        *,
        run_id: str,
        user_id: str,
        error_code: str = "AGENT_RUN_CANCELED",
        error_message: str = "用户取消执行",
    ) -> bool:
        """确保 canceled 终态事件存在；由控制任务发，避免在已取消任务里再发网络请求。

        返回 True 表示事件已在账本中（自己写入或执行侧已写），False 表示写失败。
        """
        logs = await self._post_ops(
            {"action": "run_logs", "runId": run_id, "limit": 100}, user_id=user_id
        )
        items = logs.get("items") if isinstance(logs, dict) else None
        all_items = list(items) if isinstance(items, list) else []
        # 事件超过一页时继续按 afterSeq 翻，避免 next_seq 取到中间页最大值撞号。
        after_seq = logs.get("nextSeq") if isinstance(logs, dict) else None
        for _ in range(4):
            if not after_seq:
                break
            logs = await self._post_ops(
                {
                    "action": "run_logs",
                    "runId": run_id,
                    "afterSeq": int(after_seq),
                    "limit": 100,
                },
                user_id=user_id,
            )
            page = logs.get("items") if isinstance(logs, dict) else None
            if not isinstance(page, list) or not page:
                break
            all_items.extend(page)
            after_seq = logs.get("nextSeq") if isinstance(logs, dict) else None
        if all_items:
            for item in all_items:
                payload = item.get("payload") if isinstance(item, dict) else None
                if (
                    isinstance(payload, dict)
                    and item.get("type") == "status"
                    and payload.get("status") == "canceled"
                ):
                    return True
            next_seq = max(
                [int(item.get("seq") or 0) for item in all_items if isinstance(item, dict)],
                default=0,
            ) + 1
        else:
            next_seq = 1
        from ..run_ledger import RunLedgerClient

        ledger = RunLedgerClient(
            user_id=user_id, base_url=self._base_url, transport=self._transport
        )
        await ledger.append_event(
            run_id,
            next_seq,
            "status",
            {
                "status": "canceled",
                "errorCode": error_code,
                "errorMessage": error_message,
            },
        )
        return True

    async def _dispatch(
        self,
        payload: dict[str, Any],
        *,
        user_id: str,
        master_session_id: str | None = None,
    ) -> dict[str, Any]:
        from ..agent_definition_provider import AgentDefinitionProvider
        from ..agent_orchestrator import AgentOrchestrator, to_run_registry_status
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
            return await self._dispatch_multi(
            payload,
            mode=mode,
            user_id=user_id,
            master_session_id=master_session_id,
        )
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
        session_id = f"{run_id}-session"
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
                "sessionId": session_id,
                "mode": "single",
                "goal": goal,
                "traceId": trace_id,
                "status": "queued",
                "metadata": {
                    "source": "master_tools.agent_ops.dispatch",
                    "dispatchPayload": _dispatch_snapshot(payload),
                    **(
                        {"masterSessionId": master_session_id}
                        if master_session_id
                        else {}
                    ),
                },
            }
        )

        from ..agent_checkpoint import get_agent_checkpoint_manager
        from ..agent_run_control import RunRegistration, detach_run, register_run

        orchestrator = AgentOrchestrator(
            definition_provider=provider,
            run_ledger=ledger,
            owner_user_id=user_id,
            checkpoint_manager=get_agent_checkpoint_manager(),
            definition_id=definition.id,
        )
        registration = await register_run(
            session_id,
            owner_user_id=user_id,
            loop=orchestrator,
            max_turns=definition.max_iterations,
        )
        if registration != RunRegistration.REGISTERED:
            raise OpsToolError(
                "AGENT_SESSION_BUSY",
                "该会话已有未终态 run，拒绝覆盖控制面载体",
                details={"runId": run_id, "sessionId": session_id, "registration": registration.value},
            )
        register_run_control(run_id, orchestrator)
        task = asyncio.current_task()
        register_task(run_task_key(run_id), task)
        watcher = start_remote_cancel_watch(run_id, session_id)
        try:
            try:
                result = await orchestrator.invoke(
                    definition.name, goal, session_id=session_id, run_id=run_id
                )
            except asyncio.CancelledError:
                # 硬取消走的是 task.cancel()，这条路径不能落成 failed；落 canceled。
                # canceled 事件由控制任务在任务结束后补写，这里只保证 run 行收口。
                with contextlib.suppress(Exception):
                    await asyncio.shield(
                        ledger.update_run(
                            run_id,
                            {
                                "status": "canceled",
                                "errorCode": "AGENT_RUN_CANCELED",
                                "errorMessage": "用户取消执行",
                                "endedAt": _now_iso(),
                            },
                        )
                    )
                raise
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
        finally:
            unregister_run_control(run_id, orchestrator)
            unregister_task(run_task_key(run_id), task)
            await stop_remote_cancel_watch(watcher)
            await detach_run(session_id, owner_user_id=user_id)

        return {
            "runId": run_id,
            "traceId": trace_id,
            "definitionId": definition.id,
            "definitionVersion": definition.version,
            "agent": result.agent_name,
            "status": result.status,
            "runStatus": to_run_registry_status(result.status),
            "output": result.output,
            "error": result.error,
            "errorCode": result.error_code,
            "durationMs": result.duration_ms,
            "iterations": result.iterations,
        }

    async def _dispatch_multi(
        self,
        payload: dict[str, Any],
        *,
        mode: str,
        user_id: str,
        master_session_id: str | None = None,
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
        session_id = f"{run_id}-session"
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
                "sessionId": session_id,
                "mode": mode,
                "goal": goal,
                "traceId": trace_id,
                "status": "queued",
                "metadata": {
                    "source": "master_tools.agent_ops.dispatch",
                    "participants": [definition.id for definition in resolved],
                    "dispatchPayload": _dispatch_snapshot(payload),
                    **(
                        {"masterSessionId": master_session_id}
                        if master_session_id
                        else {}
                    ),
                },
            }
        )
        session = ledger.session(run_id)
        await session.status("running")

        orchestrator = AgentOrchestrator(
            definition_provider=provider,
            run_ledger=ledger,
        )
        register_run_control(run_id, orchestrator)
        task = asyncio.current_task()
        register_task(run_task_key(run_id), task)
        watcher = start_remote_cancel_watch(run_id, session_id)
        try:
            if mode == "parallel":
                result = await orchestrator.run_parallel(
                    agent_inputs, session_id=session_id
                )
            elif mode == "pipeline":
                result = await orchestrator.run_pipeline(
                    steps, initial_input=goal, session_id=session_id
                )
            elif mode == "debate":
                result = await orchestrator.run_debate(
                    agent_ids,
                    goal,
                    max_rounds=int(payload.get("maxRounds") or 3),
                    session_id=session_id,
                )
            elif mode == "vote":
                result = await orchestrator.run_vote(agent_ids, goal, session_id=session_id)
            elif mode == "critique":
                result = await orchestrator.run_critique(
                    agent_ids,
                    goal,
                    max_rounds=int(payload.get("maxRounds") or 2),
                    session_id=session_id,
                )
            elif mode == "decomposed":
                result = await orchestrator.run_decomposed(
                    goal,
                    strategy=str(payload.get("decomposeStrategy") or "dag"),
                    session_id=session_id,
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
                                    session_id=session_id,
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
        except asyncio.CancelledError:
            # 硬取消：先写终态事件和 run 行，再把取消向上抛；不能让父 run 停在 running。
            with contextlib.suppress(Exception):
                await asyncio.shield(
                    session.status(
                        "canceled",
                        error_code="AGENT_RUN_CANCELED",
                        error_message="用户取消执行",
                    )
                )
            with contextlib.suppress(Exception):
                await asyncio.shield(
                    ledger.update_run(
                        run_id,
                        {
                            "status": "canceled",
                            "errorCode": "AGENT_RUN_CANCELED",
                            "errorMessage": "用户取消执行",
                            "endedAt": _now_iso(),
                        },
                    )
                )
            raise
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
        finally:
            unregister_run_control(run_id, orchestrator)
            unregister_task(run_task_key(run_id), task)
            await stop_remote_cancel_watch(watcher)

        stopped_steps = [step for step in result.steps if step.status == "canceled"]
        if stopped_steps:
            # 多模式里任一参与者被优雅停止，父 run 必须落 canceled，不能把部分结果报成 succeeded。
            result.status = "canceled"
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
                "AGENT_RUN_STOPPED"
                if stopped_steps
                else (
                    "AGENT_STUB_RESULT"
                    if result.status == "stub"
                    else (first_error.error_code if first_error else None)
                )
            ),
            error_message=(
                stopped_steps[0].error
                if stopped_steps
                else (first_error.error if first_error else None)
            ),
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
