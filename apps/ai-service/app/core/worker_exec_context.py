# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core/worker_exec_context.py
"""Super-agent worker 的 per-request 执行上下文(工作目录 + 环境变量)。

定位:**护栏,不是沙箱。** 它只把「本次编排请求声明的 cwd/env」安全地接到
工具子进程的 spawn 点,并拒绝明显越界/未授权的值;同一 OS 用户下,工人仍可
通过绝对路径或自行启动的进程绕过这些限制 —— 这是设计边界,不要把它当安全
隔离层(原型文档同款表述,后来人不要误读)。

契约(HTTP 编排入口):
- ``cwd``:可选;必须为**绝对路径**、目录存在,且解析后位于
  ``MCP_WORKSPACE_ROOTS`` 允许根内,否则拒绝(400)。它只改变工具子进程的
  默认/相对工作目录。
- ``env``:可选;只接受 ``WORKER_ENV_ALLOWED_KEYS`` 白名单键,出现任何其他
  键**直接拒绝**,绝不静默丢弃(静默丢弃会让调用方误以为已生效)。

删除语义为什么不放进 env 字段:JSON map 无法表达「删除继承键」。因此
``apply_worker_child_env`` 在 ai-service 侧对**子进程基座环境**执行凭据剥离
(GH_TOKEN/GITHUB_TOKEN/GIT_CONFIG_*/GIT_AUTHOR_*/GIT_COMMITTER_*),再叠加
请求 env。派发侧同样只上行白名单键,两侧判据一致。
"""

from __future__ import annotations

import contextvars
import os
from collections.abc import Iterator, Mapping
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from types import MappingProxyType

#: 请求 env 允许的键。刻意收窄到派发侧真正需要设置的三个 git 隔离开关;
#: 新增键必须先改这里与 `apps/api/src/services/worker-dispatch-env.ts` 的同名清单。
WORKER_ENV_ALLOWED_KEYS: frozenset[str] = frozenset(
    {
        "GIT_CONFIG_NOSYSTEM",
        "GIT_ASKPASS",
        "GIT_TERMINAL_PROMPT",
    }
)

#: worker 上下文生效时,从子进程基座环境剥离的继承键(凭据 + git 身份/配置注入面)。
#: 剥离发生在合并请求 env **之前**,请求 env 只能按白名单重新声明,无法借剥离逆流。
WORKER_ENV_SCRUBBED_KEYS: frozenset[str] = frozenset(
    {
        "GH_TOKEN",
        "GITHUB_TOKEN",
        "GIT_CONFIG_COUNT",
        "GIT_CONFIG_PARAMETERS",
        "GIT_CONFIG_GLOBAL",
        "GIT_AUTHOR_NAME",
        "GIT_AUTHOR_EMAIL",
        "GIT_AUTHOR_DATE",
        "GIT_COMMITTER_NAME",
        "GIT_COMMITTER_EMAIL",
        "GIT_COMMITTER_DATE",
    }
)

_WORKER_ENV_SCRUBBED_PREFIXES: tuple[str, ...] = ("GIT_AUTHOR_", "GIT_COMMITTER_")


class WorkerExecContextError(ValueError):
    """请求级 cwd/env 不合法。调用方必须转 400,不得降级放行。"""


@dataclass(frozen=True)
class WorkerExecContext:
    """一次编排请求声明的执行目录与白名单环境覆盖。"""

    cwd: str | None
    env: Mapping[str, str]


_CURRENT: contextvars.ContextVar[WorkerExecContext | None] = contextvars.ContextVar(
    "worker_exec_context", default=None
)


def current_worker_exec_context() -> WorkerExecContext | None:
    """返回当前 asyncio 任务链上的 worker 上下文;无则 None。"""
    return _CURRENT.get()


def resolve_worker_cwd(raw: str) -> str:
    """校验并解析请求 cwd:绝对路径 + 存在于允许根内。"""
    if not isinstance(raw, str) or not raw.strip():
        raise WorkerExecContextError("cwd 不能为空")
    text = raw.strip()
    if not os.path.isabs(text):
        raise WorkerExecContextError(f"cwd 必须是绝对路径(收到: {text})")
    # 复用 MCP 工作区白名单的唯一判据,不新造第二套根集合。
    from app.services.mcp_server import _validate_path_in_workspace

    ok, info = _validate_path_in_workspace(text, extra_roots=())
    if not ok:
        raise WorkerExecContextError(f"cwd 不在允许的工作区根内: {info}")
    resolved = os.path.abspath(info)
    if not os.path.isdir(resolved):
        raise WorkerExecContextError(f"cwd 不存在或不是目录: {resolved}")
    return resolved


def validate_worker_env(raw: Mapping[str, object] | None) -> dict[str, str]:
    """校验请求 env:键必须命中白名单,值必须是字符串。"""
    if raw is None:
        return {}
    if not isinstance(raw, Mapping):
        raise WorkerExecContextError("env 必须是字符串键值对象")
    unknown = sorted(str(key) for key in raw if key not in WORKER_ENV_ALLOWED_KEYS)
    if unknown:
        raise WorkerExecContextError("env 含未授权键(只接受白名单): " + ", ".join(unknown))
    out: dict[str, str] = {}
    for key, value in raw.items():
        if not isinstance(value, str):
            raise WorkerExecContextError(f"env[{key}] 必须是字符串")
        if "\x00" in value:
            raise WorkerExecContextError(f"env[{key}] 含 NUL 字符")
        out[str(key)] = value
    return out


def build_worker_exec_context(
    cwd: object = None,
    env: Mapping[str, object] | None = None,
) -> WorkerExecContext | None:
    """构造请求上下文;cwd/env 都未声明时返回 None(保持原行为)。"""
    if cwd is not None and not isinstance(cwd, str):
        raise WorkerExecContextError("cwd 必须是字符串")
    resolved_cwd = resolve_worker_cwd(cwd) if cwd else None
    resolved_env = validate_worker_env(env)
    if resolved_cwd is None and not resolved_env:
        return None
    return WorkerExecContext(cwd=resolved_cwd, env=MappingProxyType(resolved_env))


@contextmanager
def worker_exec_scope(ctx: WorkerExecContext | None) -> Iterator[None]:
    """在编排调用期间发布上下文(asyncio 子任务自动继承)。"""
    if ctx is None:
        yield
        return
    token = _CURRENT.set(ctx)
    try:
        yield
    finally:
        _CURRENT.reset(token)


def _is_scrubbed_key(key: str) -> bool:
    upper = key.upper()
    if upper in WORKER_ENV_SCRUBBED_KEYS:
        return True
    return any(upper.startswith(prefix) for prefix in _WORKER_ENV_SCRUBBED_PREFIXES)


def scrub_worker_env(env: Mapping[str, str]) -> dict[str, str]:
    """剥掉 worker 上下文下的宿主凭据/git 注入键;无上下文时原样复制。"""
    if _CURRENT.get() is None:
        return dict(env)
    return {key: value for key, value in env.items() if not _is_scrubbed_key(key)}


def apply_worker_child_env(env: Mapping[str, str]) -> dict[str, str]:
    """子进程环境的统一合并点:先剥离,再叠加白名单覆盖。

    必须在 sandbox/exec_env 的守卫之前调用(``build_child_env`` 的 ``extra`` /
    ``guarded_child_env`` 之前),否则请求 env 会被守卫当成"调用方任意 env"处理。
    """
    ctx = _CURRENT.get()
    if ctx is None:
        return dict(env)
    merged = {key: value for key, value in env.items() if not _is_scrubbed_key(key)}
    merged.update(ctx.env)
    return merged


def worker_env_overrides() -> dict[str, str]:
    """返回需要叠加到子进程的白名单 env;无上下文时为空。"""
    ctx = _CURRENT.get()
    return dict(ctx.env) if ctx is not None else {}


def effective_worker_cwd(tool_cwd: str | None) -> str | None:
    """把工具调用的 cwd 收敛到 worker 目录;无上下文时返回 None(不改行为)。

    - 未传 / "." → worker cwd;
    - 相对路径 → 以 worker cwd 为基准解析;
    - 绝对路径 → 原样交给既有工作区校验(仍受 MCP_WORKSPACE_ROOTS 约束)。
    """
    ctx = _CURRENT.get()
    if ctx is None or not ctx.cwd:
        return None
    raw = (tool_cwd or "").strip()
    if not raw or raw == ".":
        return ctx.cwd
    candidate = Path(raw)
    if candidate.is_absolute():
        return str(candidate)
    return str((Path(ctx.cwd) / candidate).resolve(strict=False))
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
