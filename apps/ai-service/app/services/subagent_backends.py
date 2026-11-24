# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""子代理上下文后端：spawn 与 fork 的注册面（B1-09）。

口径（对照 DSH 的 `dsh-subagent-fork-in-process` / `dsh-subagent-spawn-in-process`）：

- `spawn`：零父上下文，子代理只拿到本次任务；
- `fork`：把父作业的**已终态**任务与结果作为平衡前缀播种，运行中的父作业拒绝，
  避免把半截回合、在飞工具结果带进子上下文；
- 两种后端都受 `MAX_FORK_DEPTH` 约束，fork 链超过上限显式拒绝；
- 缺省后端仍是 `spawn`，现有调用方不传 `context_mode` 时行为零变化。

本模块只做纯判据与种子拼装，不启动进程、不写数据库；作业台在
`subagent_jobs.py` 里持有作业表，并把本模块的种子接到真实 invoker 上。
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Final, Literal

ContextMode = Literal["spawn", "fork"]

#: fork 链深度上限。超过就拒绝，而不是让子子孙孙把父上下文无限复制。
MAX_FORK_DEPTH: Final = 4

#: 单个父作业结果进入种子的字符预算。作业台本身已按 4000 字摘要，
#: 这里再兜一道，防止调用方直接塞未摘要的长结果。
MAX_SEED_RESULT_CHARS: Final = 4000


class SubagentContextError(ValueError):
    """上下文播种失败；code 供工具层原样回给模型。"""

    def __init__(self, code: str, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(message)


@dataclass(frozen=True)
class ContextSeed:
    """一次播种的结果。text 为空表示零父上下文。"""

    backend: ContextMode
    text: str
    parent_job_id: str | None = None
    depth: int = 0
    parent_status: str | None = None
    truncated: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "backend": self.backend,
            "parent_job_id": self.parent_job_id,
            "depth": self.depth,
            "parent_status": self.parent_status,
            "seed_chars": len(self.text),
            "truncated": self.truncated,
        }


def normalize_context_mode(raw: object) -> ContextMode:
    """缺省 spawn；只接受两个注册名，未知值不静默折成 spawn。"""
    if raw is None:
        return "spawn"
    value = str(raw).strip().lower()
    if value not in ("spawn", "fork"):
        raise SubagentContextError(
            "SUBAGENT_INVALID_CONTEXT_MODE",
            f"context_mode 只能是 spawn 或 fork，收到 {raw!r}",
        )
    return value  # type: ignore[return-value]


def _job_attr(job: object, name: str, default: Any = None) -> Any:
    if isinstance(job, Mapping):
        return job.get(name, default)
    return getattr(job, name, default)


def _parent_depth(
    parent_job_id: str,
    jobs: Mapping[str, object],
    *,
    max_depth: int,
) -> int:
    """沿 parent_job_id 链数深度；链本身有环时按深度上限拒绝。"""
    depth = 1
    seen = {parent_job_id}
    current = parent_job_id
    while True:
        if depth > max_depth:
            raise SubagentContextError(
                "SUBAGENT_FORK_DEPTH_LIMIT",
                f"fork 链深度超过上限 {max_depth}",
            )
        job = jobs.get(current)
        if job is None:
            return depth
        parent = _job_attr(job, "parent_job_id")
        if not parent:
            return depth
        parent = str(parent)
        if parent in seen:
            raise SubagentContextError(
                "SUBAGENT_FORK_DEPTH_LIMIT",
                "fork 链存在环，拒绝播种",
            )
        seen.add(parent)
        current = parent
        depth += 1


def _format_seed(parent: object) -> tuple[str, bool]:
    task = str(_job_attr(parent, "task", "") or "").strip()
    result = _job_attr(parent, "result")
    result_text = result if isinstance(result, str) else str(result or "")
    result_text = result_text.strip()
    truncated = False
    if len(result_text) > MAX_SEED_RESULT_CHARS:
        result_text = result_text[:MAX_SEED_RESULT_CHARS]
        truncated = True
    text = (
        "这是从父作业 fork 出的子代理上下文。\n"
        "[父作业任务]\n"
        f"{task or '(空)'}\n\n"
        "[父作业最终输出]\n"
        f"{result_text or '(空)'}\n\n"
        "[你的任务]\n"
    )
    return text, truncated


class SpawnBackend:
    """零父上下文后端。"""

    name: ContextMode = "spawn"

    def build_seed(
        self,
        *,
        parent_job_id: str | None,
        jobs: Mapping[str, object],
        user_id: str | None,
        session_id: str | None,
        max_depth: int = MAX_FORK_DEPTH,
    ) -> ContextSeed:
        # spawn 不接受 parent_job_id：传了就是调用方把 fork 与 spawn 混用。
        if parent_job_id:
            raise SubagentContextError(
                "SUBAGENT_SPAWN_PARENT_UNSUPPORTED",
                "spawn 后端不接受 parent_job_id；需要继承父上下文请用 fork",
            )
        return ContextSeed(backend="spawn", text="")


class ForkBackend:
    """从已终态父作业播种的 fork 后端。"""

    name: ContextMode = "fork"

    def build_seed(
        self,
        *,
        parent_job_id: str | None,
        jobs: Mapping[str, object],
        user_id: str | None,
        session_id: str | None,
        max_depth: int = MAX_FORK_DEPTH,
    ) -> ContextSeed:
        if not parent_job_id:
            raise SubagentContextError(
                "SUBAGENT_FORK_PARENT_REQUIRED",
                "fork 后端必须提供 parent_job_id",
            )
        parent = jobs.get(parent_job_id)
        if parent is None:
            raise SubagentContextError(
                "SUBAGENT_NOT_FOUND", "父作业不存在或无权访问"
            )
        owner = _job_attr(parent, "user_id")
        if not user_id or owner != user_id:
            raise SubagentContextError(
                "SUBAGENT_NOT_FOUND", "父作业不存在或无权访问"
            )
        parent_session = _job_attr(parent, "session_id")
        if session_id is not None and parent_session not in (None, session_id):
            raise SubagentContextError(
                "SUBAGENT_NOT_FOUND", "父作业不存在或无权访问"
            )
        finished = bool(_job_attr(parent, "finished", False))
        if not finished:
            raise SubagentContextError(
                "SUBAGENT_FORK_PARENT_RUNNING",
                "父作业仍在运行；fork 只能播种已终态的平衡前缀",
            )
        ok = bool(_job_attr(parent, "ok", False))
        cancelled = bool(_job_attr(parent, "cancelled", False))
        if cancelled:
            raise SubagentContextError(
                "SUBAGENT_FORK_PARENT_CANCELLED",
                "父作业已取消，没有可播种的平衡前缀",
            )
        if not ok:
            raise SubagentContextError(
                "SUBAGENT_FORK_PARENT_FAILED",
                "父作业未成功结束，没有可播种的平衡前缀",
            )
        depth = _parent_depth(parent_job_id, jobs, max_depth=max_depth)
        text, truncated = _format_seed(parent)
        return ContextSeed(
            backend="fork",
            text=text,
            parent_job_id=parent_job_id,
            depth=depth,
            parent_status=str(_job_attr(parent, "status", "succeeded")),
            truncated=truncated,
        )


_BACKENDS: Final[dict[ContextMode, SpawnBackend | ForkBackend]] = {
    "spawn": SpawnBackend(),
    "fork": ForkBackend(),
}


def resolve_backend(mode: object) -> SpawnBackend | ForkBackend:
    """按注册名取后端；未知值显式失败。"""
    return _BACKENDS[normalize_context_mode(mode)]


def build_context_seed(
    mode: object,
    *,
    parent_job_id: str | None,
    jobs: Mapping[str, object],
    user_id: str | None,
    session_id: str | None,
    max_depth: int = MAX_FORK_DEPTH,
) -> ContextSeed:
    """唯一入口：校验模式后交给对应后端。"""
    return resolve_backend(mode).build_seed(
        parent_job_id=parent_job_id,
        jobs=jobs,
        user_id=user_id,
        session_id=session_id,
        max_depth=max_depth,
    )


__all__ = [
    "MAX_FORK_DEPTH",
    "MAX_SEED_RESULT_CHARS",
    "ContextMode",
    "ContextSeed",
    "ForkBackend",
    "SpawnBackend",
    "SubagentContextError",
    "build_context_seed",
    "normalize_context_mode",
    "resolve_backend",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
