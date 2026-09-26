# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""V3 #51(2026-09-26 立):后台任务与 DAG 的**真实 executor 注册表**。

病根(票面原文):「`run_in_background` 只有 sleep/echo、`/dag/execute` 与
`WorkerPool._default_executor` 回显」——即"任务提交了、返回体说 executed:True,但什么都没跑"。
本模块是 6 类真实任务类型的**唯一落点**;`background_tasks.py` 与 `dag_scheduler.py` 都只从这里分派。

设计约束(逐条对应交付判据):
- **不许把桩伪装成功**:每个返回体必带 `executed`(是否真跑了业务)/ `stub`(该类型是否刻意是演示档)/
  `analysis_depth`(`real` / `stub` / `none`)三个自证字段。未知 task_type ⇒ 抛 `TaskExecutionError`
  (WorkerPool 会把它记成 blocked),或由 `background_tasks.run_in_background` 返回 `ok:False`,
  绝不返回 `executed: True`。形态与同仓 V3 #50 定下的自证约定一致。
- **幂等键**:`compute_idempotency_key()` 由 `task_type` + 规范化 arguments 派生(sha256),
  同一键的重复提交命中同一条任务记录,不重复执行。
- **断点续跑**:`Checkpoint` 以「单元」为粒度记录已完成项并把中间产物存进 `payload`;
  重跑时 `is_done(unit)` 为真的单元**不再执行**,终产物 = checkpoint 累积 ⇒ 与一次跑完逐字节等价。
- **Windows 禁弹窗**:所有子进程派生一律带 `CREATE_NO_WINDOW`(AGENTS §5b「后台进程禁弹窗」
  在 Python 侧的等价措施,守门 52 同族)。
- **子进程输出上限**:超出 `cap_bytes` 只保留前缀并置 `*_truncated=True` + 如实报总字节数,
  不静默截断(§5e「失败必须响」同一条禁令)。
- **出站 HTTP 走本仓既有出口**:复用 `app.core.llm_gateway.get_http_client()`(带代理的共享
  httpx 客户端),SSRF 判据复用 `app.services.screenshot_service._validate_url_ssrf`,
  WorkerPool 网络策略经 `app.services.network_guard.check_current`。禁止裸新建 client。
"""

from __future__ import annotations

import asyncio
import contextlib
import hashlib
import json
import logging
import os
import re
import shutil
import subprocess
import sys
import time
from collections.abc import Awaitable, Callable, Iterable, Sequence
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Final, Literal

logger = logging.getLogger(__name__)

# Windows: 0x08000000 = CREATE_NO_WINDOW。非 Windows 平台该常量不存在,取 0 即 no-op。
_NO_WINDOW: int = int(getattr(subprocess, "CREATE_NO_WINDOW", 0))

# 子进程单次读取块大小
_READ_CHUNK = 65536
# 默认输出保留上限(超出只置 truncated 标记并继续排空管道,防死锁)
DEFAULT_OUTPUT_CAP_BYTES: Final[int] = 256 * 1024
# 单任务最多处理的单元数(批量类任务的硬闸,防一次提交吃满内存)
DEFAULT_MAX_UNITS: Final[int] = 2000
# batch_llm / web_batch 的并发上限档位
MAX_CONCURRENCY: Final[int] = 8
DEFAULT_CONCURRENCY: Final[int] = 4

TaskTypeLiteral = Literal[
    "long_running_command",
    "test_suite",
    "code_index",
    "batch_llm",
    "web_batch",
    "patrol",
    "sleep",
    "echo",
]

# 真实落地的 6 类(stub=False) + 2 类演示档(stub=True,返回体自证 stub)。
# 这是一份**字面量**,供 scripts/check-background-task-type-parity.mjs 用 ast 解析;
# 与 TASK_EXECUTORS 的一致性由下方 import 期断言 + 单测双重钉死(改一处忘改另一处即 import 失败)。
IMPLEMENTED_TASK_TYPES: Final[tuple[str, ...]] = (
    "long_running_command",
    "test_suite",
    "code_index",
    "batch_llm",
    "web_batch",
    "patrol",
    "sleep",
    "echo",
)

# 演示/占位档:保留是为了不破坏既有调用方,但它们**必须**自证 stub。
STUB_TASK_TYPES: Final[tuple[str, ...]] = ("sleep", "echo")

PATROL_CHECKS: Final[tuple[str, ...]] = (
    "large_files",
    "stale_files",
    "empty_dirs",
    "todo_markers",
    "unreadable_files",
)


class TaskExecutionError(RuntimeError):
    """任务无法真实执行(未知类型 / 参数非法 / 依赖工具缺失)。

    抛错而不是返回 `executed: True`:WorkerPool 会把异常记成 `blocked` + error_message,
    从而在账面上与"跑成功了"区分开 —— 这是本票对"回显冒充执行"的结构性修法。
    """


# ---------------------------------------------------------------------------
# 断点续跑:checkpoint
# ---------------------------------------------------------------------------


@dataclass
class Checkpoint:
    """一次逻辑任务的进度记录(单元级)。

    `done` 里的每个 unit_id 表示"该单元已真实执行完且其产物已并入 payload",
    重跑时 executor 必须跳过它们(否则"断点续跑"只是一句散文)。
    """

    key: str
    done: set[str] = field(default_factory=set)
    payload: dict[str, Any] = field(default_factory=dict)
    _store: CheckpointStore | None = field(default=None, repr=False)

    def is_done(self, unit_id: str) -> bool:
        return unit_id in self.done

    def mark_done(self, unit_id: str, *, artifact: Any = None) -> None:
        self.done.add(unit_id)
        if artifact is not None:
            self.payload[unit_id] = artifact
        if self._store is not None:
            self._store.save(self)

    @property
    def completed_units(self) -> int:
        return len(self.done)

    def to_dict(self) -> dict[str, Any]:
        return {
            "key": self.key,
            "completed_units": len(self.done),
            "done": sorted(self.done),
            "payload": self.payload,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any], store: CheckpointStore | None = None) -> Checkpoint:
        raw_done = data.get("done")
        done = {str(x) for x in raw_done} if isinstance(raw_done, list) else set()
        raw_payload = data.get("payload")
        payload = raw_payload if isinstance(raw_payload, dict) else {}
        return cls(key=str(data.get("key", "")), done=done, payload=payload, _store=store)


class CheckpointStore:
    """checkpoint 存储:进程内存 + 可选目录持久化(JSON,原子写)。

    持久化目录由 `BACKGROUND_TASK_CHECKPOINT_DIR` 决定;未设置时仅内存
    (进程内中断→恢复仍然成立,跨进程重启不恢复 —— 如实登记,不假装)。
    """

    def __init__(self, root: str | os.PathLike[str] | None = None) -> None:
        self._root = Path(root) if root else None
        self._mem: dict[str, dict[str, Any]] = {}

    @classmethod
    def from_env(cls) -> CheckpointStore:
        raw = os.environ.get("BACKGROUND_TASK_CHECKPOINT_DIR", "").strip()
        return cls(raw if raw else None)

    @property
    def persistent(self) -> bool:
        return self._root is not None

    def _path(self, key: str) -> Path:
        assert self._root is not None  # noqa: S101 - 调用点已判 persistent
        digest = hashlib.sha256(key.encode("utf-8")).hexdigest()[:32]
        return self._root / f"{digest}.json"

    def load(self, key: str) -> Checkpoint:
        if self._root is not None:
            p = self._path(key)
            if p.is_file():
                try:
                    raw = json.loads(p.read_text(encoding="utf-8"))
                    if isinstance(raw, dict):
                        self._mem[key] = raw
                        return Checkpoint.from_dict({**raw, "key": key}, self)
                except Exception as e:  # noqa: BLE001 - 坏档按无档处理,但必须喊出来
                    logger.warning("[checkpoint] 读取失败(按空档续)%s: %s", key, e)
        data = self._mem.get(key)
        if isinstance(data, dict):
            return Checkpoint.from_dict({**data, "key": key}, self)
        return Checkpoint(key=key, _store=self)

    def save(self, cp: Checkpoint) -> None:
        data = cp.to_dict()
        self._mem[cp.key] = data
        if self._root is None:
            return
        try:
            self._root.mkdir(parents=True, exist_ok=True)
            p = self._path(cp.key)
            tmp = p.with_suffix(".tmp")
            tmp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
            os.replace(tmp, p)
        except Exception as e:  # noqa: BLE001 - 持久化失败不得反噬任务
            logger.warning("[checkpoint] 写盘失败(降级仅内存)%s: %s", cp.key, e)

    def drop(self, key: str) -> None:
        self._mem.pop(key, None)
        if self._root is not None:
            with contextlib.suppress(OSError):
                self._path(key).unlink(missing_ok=True)


_default_store: CheckpointStore | None = None


def get_checkpoint_store() -> CheckpointStore:
    global _default_store
    if _default_store is None:
        _default_store = CheckpointStore.from_env()
    return _default_store


def set_checkpoint_store(store: CheckpointStore | None) -> None:
    """测试/部署注入点(唯一的 checkpoint 存储换法,禁止在别处另立第二份)。"""
    global _default_store
    _default_store = store


# ---------------------------------------------------------------------------
# 幂等键
# ---------------------------------------------------------------------------


def canonical_json(value: Any) -> str:
    """规范化 JSON:键排序、无空白、非序列化对象降级为 str。"""
    return json.dumps(value, sort_keys=True, ensure_ascii=False, default=str, separators=(",", ":"))


def compute_idempotency_key(task_type: str, arguments: dict[str, Any]) -> str:
    """同一逻辑任务的幂等键 = sha256(task_type ⊕ 规范化 arguments)。

    判据(由 tests/test_task_idempotency.py 钉死):
    - 同 task_type + 同 arguments(键序无关)⇒ 同键
    - task_type 不同 ⇒ 不同键(哪怕 arguments 相同)
    - arguments 任一值不同 ⇒ 不同键
    """
    return hashlib.sha256(
        canonical_json({"task_type": task_type, "arguments": arguments}).encode("utf-8")
    ).hexdigest()[:32]


# ---------------------------------------------------------------------------
# 执行上下文
# ---------------------------------------------------------------------------

LlmCall = Callable[[list[dict[str, Any]], str | None], Awaitable[dict[str, Any]]]
HttpGetter = Callable[[str, float], Awaitable[tuple[int, str]]]


@dataclass
class TaskContext:
    """传给 executor 的上下文(含测试注入缝,生产走默认实现)。

    `llm_call` / `http_get` 是**传输层**注入点:默认分别落到 `llm_gateway.complete`
    与共享 `httpx` 客户端。测试注入 fake 只替换 socket 那一层,
    executor 的判据/聚合/隔离逻辑一行都不复制(§22c 禁测试复制实现)。
    """

    task_id: str
    task_type: str
    arguments: dict[str, Any]
    checkpoint: Checkpoint
    user_id: str | None = None
    session_id: str | None = None
    cancel_event: asyncio.Event = field(default_factory=asyncio.Event)
    llm_call: LlmCall | None = None
    http_get: HttpGetter | None = None

    def get(self, name: str, default: Any = None) -> Any:
        return self.arguments.get(name, default)

    def require_str(self, name: str) -> str:
        raw = self.arguments.get(name)
        if not isinstance(raw, str) or not raw.strip():
            raise TaskExecutionError(f"{self.task_type}: 缺少必填字符串参数 {name!r}")
        return raw

    def require_list(self, name: str) -> list[Any]:
        raw = self.arguments.get(name)
        if not isinstance(raw, list) or not raw:
            raise TaskExecutionError(f"{self.task_type}: 参数 {name!r} 必须是非空数组")
        return raw

    def int_arg(self, name: str, default: int, *, lo: int, hi: int) -> int:
        raw = self.arguments.get(name, default)
        try:
            val = int(raw) if raw is not None else default
        except (TypeError, ValueError) as e:
            raise TaskExecutionError(f"{self.task_type}: 参数 {name!r} 不是整数") from e
        return max(lo, min(hi, val))


def _proof(task_type: str, stub: bool, **extra: Any) -> dict[str, Any]:
    """每个 executor 返回体的公共自证字段(判据 1/2 的机器可读部分)。"""
    out: dict[str, Any] = {
        "task_type": task_type,
        "executed": not stub,
        "stub": stub,
        "analysis_depth": "stub" if stub else "real",
    }
    out.update(extra)
    return out


# ---------------------------------------------------------------------------
# 子进程基础设施(禁弹窗 + 输出上限 + 可取消)
# ---------------------------------------------------------------------------


@dataclass
class CommandRun:
    exit_code: int | None
    stdout: str
    stderr: str
    stdout_bytes: int
    stderr_bytes: int
    stdout_truncated: bool
    stderr_truncated: bool
    duration_ms: float
    timed_out: bool
    cancelled: bool

    def to_dict(self) -> dict[str, Any]:
        return {
            "exit_code": self.exit_code,
            "stdout": self.stdout,
            "stderr": self.stderr,
            "stdout_bytes": self.stdout_bytes,
            "stderr_bytes": self.stderr_bytes,
            "stdout_truncated": self.stdout_truncated,
            "stderr_truncated": self.stderr_truncated,
            "duration_ms": round(self.duration_ms, 2),
            "timed_out": self.timed_out,
            "cancelled": self.cancelled,
        }


_ACTIVE_PROCS: dict[str, list[asyncio.subprocess.Process]] = {}


def register_process(task_id: str, proc: asyncio.subprocess.Process) -> None:
    _ACTIVE_PROCS.setdefault(task_id, []).append(proc)


def unregister_process(task_id: str, proc: asyncio.subprocess.Process) -> None:
    bucket = _ACTIVE_PROCS.get(task_id)
    if not bucket:
        return
    with contextlib.suppress(ValueError):
        bucket.remove(proc)
    if not bucket:
        _ACTIVE_PROCS.pop(task_id, None)


def kill_processes_for(task_id: str) -> int:
    """杀掉某任务派生的所有在跑子进程。返回杀掉的进程数(0 = 没有在跑的)。"""
    killed = 0
    for proc in list(_ACTIVE_PROCS.get(task_id, [])):
        try:
            proc.kill()
            killed += 1
        except ProcessLookupError:
            pass
        except Exception as e:  # noqa: BLE001
            logger.warning("[executor] kill 失败 task_id=%s: %s", task_id, e)
    return killed


async def _drain_stream(
    stream: asyncio.StreamReader | None, cap: int
) -> tuple[bytes, int, bool]:
    if stream is None:
        return b"", 0, False
    kept = bytearray()
    total = 0
    truncated = False
    while True:
        chunk = await stream.read(_READ_CHUNK)
        if not chunk:
            break
        total += len(chunk)
        room = cap - len(kept)
        if room > 0:
            kept += chunk[:room]
        if total > cap:
            truncated = True
    return bytes(kept), total, truncated


def _resolve_argv(command: str | Sequence[str], args: Sequence[str] | None) -> list[str]:
    if isinstance(command, str):
        parts = command.split()
        if not parts:
            raise TaskExecutionError("command 为空,无法派生进程")
        argv = parts
    else:
        argv = [str(x) for x in command]
        if not argv:
            raise TaskExecutionError("command 为空数组,无法派生进程")
    if args:
        argv = argv + [str(x) for x in args]
    return argv


async def run_command(
    argv: Sequence[str],
    *,
    task_id: str,
    cwd: str | None = None,
    timeout_s: float = 300.0,
    cap_bytes: int = DEFAULT_OUTPUT_CAP_BYTES,
    env: dict[str, str] | None = None,
) -> CommandRun:
    """真实派生子进程(无 shell、禁窗口、可取消、输出有上限且截断自证)。"""
    start = time.monotonic()
    try:
        proc = await asyncio.create_subprocess_exec(
            *[str(a) for a in argv],
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=cwd,
            env=env,
            creationflags=_NO_WINDOW,
        )
    except FileNotFoundError as e:
        raise TaskExecutionError(f"可执行文件不存在:{argv[0] if argv else '(空)'}") from e
    except Exception as e:  # noqa: BLE001
        raise TaskExecutionError(f"子进程派生失败:{e}") from e

    register_process(task_id, proc)
    timed_out = False
    cancelled = False
    # 关键:管道必须**边跑边排空**。先 wait() 再读,子进程写满 OS 管道缓冲
    # (Windows 匿名管道 64KB,实测 200KB 输出即死锁)后就再也等不到它退出。
    drain_out = asyncio.create_task(_drain_stream(proc.stdout, cap_bytes))
    drain_err = asyncio.create_task(_drain_stream(proc.stderr, cap_bytes))
    out_b: tuple[bytes, int, bool] = (b"", 0, False)
    err_b: tuple[bytes, int, bool] = (b"", 0, False)
    try:
        try:
            await asyncio.wait_for(proc.wait(), timeout=timeout_s)
        except TimeoutError:
            timed_out = True
            with contextlib.suppress(ProcessLookupError):
                proc.kill()
            with contextlib.suppress(Exception):
                await proc.wait()
        except asyncio.CancelledError:
            cancelled = True
            with contextlib.suppress(ProcessLookupError):
                proc.kill()
            raise
    finally:
        try:
            out_b, err_b = await asyncio.wait_for(
                asyncio.gather(drain_out, drain_err), timeout=30.0
            )
        except Exception as e:  # noqa: BLE001 - 排空失败不得吞掉任务结论,但必须留痕
            logger.warning("[executor] 管道排空异常 task_id=%s: %s", task_id, e)
            drain_out.cancel()
            drain_err.cancel()
        unregister_process(task_id, proc)

    stdout_keep, stdout_total, stdout_trunc = out_b
    stderr_keep, stderr_total, stderr_trunc = err_b
    return CommandRun(
        exit_code=proc.returncode,
        stdout=stdout_keep.decode("utf-8", errors="replace"),
        stderr=stderr_keep.decode("utf-8", errors="replace"),
        stdout_bytes=stdout_total,
        stderr_bytes=stderr_total,
        stdout_truncated=stdout_trunc,
        stderr_truncated=stderr_trunc,
        duration_ms=(time.monotonic() - start) * 1000.0,
        timed_out=timed_out,
        cancelled=cancelled,
    )


def _assert_command_not_dangerous(argv: Sequence[str]) -> None:
    """复用本仓危险命令判据(app.core.command_safety),拒绝即抛,不静默降级。"""
    from app.core.command_safety import dangerous_command_match

    reason = dangerous_command_match([str(a) for a in argv])
    if reason:
        raise TaskExecutionError(f"命令被安全策略拒绝:{reason}")


# ---------------------------------------------------------------------------
# executor 1:长跑命令
# ---------------------------------------------------------------------------


async def _exec_long_running_command(ctx: TaskContext) -> dict[str, Any]:
    raw_command = ctx.arguments.get("command")
    if isinstance(raw_command, list):
        argv = [str(x) for x in raw_command]
        if not argv:
            raise TaskExecutionError("long_running_command: command 为空数组")
    elif isinstance(raw_command, str) and raw_command.strip():
        argv = _resolve_argv(raw_command, ctx.arguments.get("args"))
    else:
        raise TaskExecutionError("long_running_command: 缺少 command(字符串或 argv 数组)")

    _assert_command_not_dangerous(argv)
    cwd = ctx.arguments.get("cwd")
    timeout_s = float(ctx.int_arg("timeout_s", 300, lo=1, hi=7200))
    cap = ctx.int_arg("max_output_bytes", DEFAULT_OUTPUT_CAP_BYTES, lo=1024, hi=4 * 1024 * 1024)

    run = await run_command(
        argv,
        task_id=ctx.task_id,
        cwd=str(cwd) if isinstance(cwd, str) and cwd.strip() else None,
        timeout_s=timeout_s,
        cap_bytes=cap,
    )
    ctx.checkpoint.mark_done("command", artifact={"exit_code": run.exit_code})
    return _proof(
        ctx.task_type,
        False,
        ok=(run.exit_code == 0 and not run.timed_out and not run.cancelled),
        command=argv,
        **run.to_dict(),
    )


# ---------------------------------------------------------------------------
# executor 2:测试套
# ---------------------------------------------------------------------------

_PYTEST_COUNT_PATTERNS: dict[str, re.Pattern[str]] = {
    "passed": re.compile(r"(\d+) passed"),
    "failed": re.compile(r"(\d+) failed"),
    "error": re.compile(r"(\d+) error"),
    "skipped": re.compile(r"(\d+) skipped"),
}
_PYTEST_FAILURE_LINE = re.compile(r"^(FAILED|ERROR)\s+(\S+)")


def parse_pytest_output(text: str) -> dict[str, int]:
    """从 pytest 末行汇总里取真实计数(没有该维度即 0,不猜)。"""
    counts = dict.fromkeys(_PYTEST_COUNT_PATTERNS, 0)
    for key, pat in _PYTEST_COUNT_PATTERNS.items():
        m = pat.search(text)
        if m:
            counts[key] = int(m.group(1))
    return counts


def parse_pytest_failures(text: str) -> list[str]:
    out: list[str] = []
    for line in text.splitlines():
        m = _PYTEST_FAILURE_LINE.match(line.strip())
        if m:
            out.append(m.group(2))
    return out


def parse_vitest_report(report: dict[str, Any]) -> tuple[dict[str, int], list[str]]:
    """从 vitest json reporter 产物取真实计数与失败明细(jest 兼容版式)。"""
    total = int(report.get("numTotalTests", 0) or 0)
    passed = int(report.get("numPassedTests", 0) or 0)
    failed = int(report.get("numFailedTests", 0) or 0)
    counts = {"passed": passed, "failed": failed, "error": 0, "skipped": max(0, total - passed - failed)}
    failures: list[str] = []
    raw_results = report.get("testResults")
    if isinstance(raw_results, list):
        for entry in raw_results:
            if not isinstance(entry, dict):
                continue
            assertions = entry.get("assertionResults")
            if not isinstance(assertions, list):
                continue
            for a in assertions:
                if isinstance(a, dict) and a.get("status") == "failed":
                    name = a.get("fullName") or a.get("title") or str(entry.get("name", ""))
                    failures.append(str(name))
    return counts, failures


def resolve_vitest_cli(start: Path | None = None) -> str | None:
    """从仓库向上找 `node_modules/vitest/vitest.mjs`(不假设装在根)。"""
    cur = (start or Path.cwd()).resolve()
    for base in [cur, *cur.parents]:
        candidate = base / "node_modules" / "vitest" / "vitest.mjs"
        if candidate.is_file():
            return str(candidate)
    return None


async def _exec_test_suite(ctx: TaskContext) -> dict[str, Any]:
    target = ctx.require_str("target")
    framework_arg = str(ctx.arguments.get("framework", "auto")).strip().lower()
    cwd = ctx.arguments.get("cwd")
    cwd_path = Path(str(cwd)) if isinstance(cwd, str) and cwd.strip() else Path.cwd()
    timeout_s = float(ctx.int_arg("timeout_s", 900, lo=5, hi=7200))
    cap = ctx.int_arg("max_output_bytes", DEFAULT_OUTPUT_CAP_BYTES, lo=4096, hi=4 * 1024 * 1024)

    if framework_arg not in ("auto", "pytest", "vitest"):
        raise TaskExecutionError(f"test_suite: 未知 framework {framework_arg!r}(可选 auto/pytest/vitest)")
    framework = framework_arg
    if framework == "auto":
        suffix = Path(target).suffix.lower()
        framework = "vitest" if suffix in (".ts", ".tsx", ".js", ".jsx", ".mjs") else "pytest"

    extra_raw = ctx.arguments.get("extra_args")
    extra = [str(x) for x in extra_raw] if isinstance(extra_raw, list) else []
    unit_id = f"{framework}:{target}"

    # **断点续跑在此真的生效**:整套测试是一个单元,单元已完成的续跑必须直接取回
    # 计数与失败明细,而不是把套件再跑一遍。早先这格只有 mark_done 而没有 is_done 判,
    # 于是"续跑"只写在账上 —— 与 patrol 同一型(票面警告的"框架里有就算有")。
    if ctx.checkpoint.is_done(unit_id):
        cached = ctx.checkpoint.payload.get(unit_id)
        if isinstance(cached, dict):
            raw_counts = cached.get("counts")
            raw_failures = cached.get("failures")
            counts = {str(k): int(v or 0) for k, v in raw_counts.items()} if isinstance(raw_counts, dict) else {}
            failures = [str(x) for x in raw_failures] if isinstance(raw_failures, list) else []
            return _proof(
                ctx.task_type, False,
                ok=(counts.get("failed", 0) == 0 and counts.get("error", 0) == 0),
                framework=framework,
                target=target,
                command=None,
                collected_any=sum(counts.values()) > 0,
                counts=counts,
                failures=failures[:200],
                failures_truncated=len(failures) > 200,
                exit_code=None,
                timed_out=False,
                duration_ms=0.0,
                raw_tail="",
                reused_from_checkpoint=True,
            )

    report_path: Path | None = None
    if framework == "pytest":
        argv = [
            sys.executable, "-m", "pytest", target,
            "-q", "-rf", "--tb=line", "-n", "0",
            "-p", "no:cacheprovider", "--no-header", *extra,
        ]
    else:
        cli = resolve_vitest_cli(cwd_path)
        node = shutil.which("node")
        if cli is None or node is None:
            return _proof(
                ctx.task_type, False,
                ok=False, framework=framework, target=target,
                error="vitest CLI 或 node 不可解析(未安装/不在该仓库树上)",
                tool_available=False, counts={}, failures=[],
            )
        report_path = cwd_path / f".vitest-report-{ctx.task_id[:8]}.json"
        argv = [
            node, cli, "run", target,
            "--reporter=json", f"--outputFile={report_path}", *extra,
        ]

    run = await run_command(
        argv, task_id=ctx.task_id, cwd=str(cwd_path), timeout_s=timeout_s, cap_bytes=cap
    )
    text = run.stdout + "\n" + run.stderr
    if framework == "pytest":
        counts = parse_pytest_output(text)
        failures = parse_pytest_failures(text)
    else:
        report: dict[str, Any] = {}
        if report_path is not None and report_path.is_file():
            with contextlib.suppress(Exception):
                loaded = json.loads(report_path.read_text(encoding="utf-8"))
                if isinstance(loaded, dict):
                    report = loaded
            with contextlib.suppress(OSError):
                report_path.unlink(missing_ok=True)
        counts, failures = parse_vitest_report(report)

    collected_any = sum(counts.values()) > 0
    ctx.checkpoint.mark_done(unit_id, artifact={"counts": counts, "failures": failures})
    return _proof(
        ctx.task_type, False,
        ok=bool(counts.get("failed", 0) == 0 and counts.get("error", 0) == 0 and not run.timed_out)
        and collected_any,
        framework=framework,
        target=target,
        command=argv,
        collected_any_test=collected_any,
        counts=counts,
        failures=failures[:200],
        failures_truncated=len(failures) > 200,
        exit_code=run.exit_code,
        timed_out=run.timed_out,
        duration_ms=round(run.duration_ms, 2),
        raw_tail=text[-4000:],
        reused_from_checkpoint=False,
    )


# ---------------------------------------------------------------------------
# executor 3:代码索引(真遍历 + 真切片 + 产出索引工件)
# ---------------------------------------------------------------------------


async def _exec_code_index(ctx: TaskContext) -> dict[str, Any]:
    from app.services.codebase_indexer import (
        _file_content_hash,
        _merkle_root,
        codebase_indexer,
    )

    root_raw = ctx.require_str("root")
    root = Path(root_raw)
    if not root.is_dir():
        raise TaskExecutionError(f"code_index: root 不是目录 {root_raw!r}")
    max_files = ctx.int_arg("max_files", 500, lo=1, hi=5000)
    output_raw = ctx.arguments.get("output_path")

    collected = await asyncio.to_thread(codebase_indexer._collect_code_files, root)
    scanned = len(collected)
    # **护栏语义(如实登记,不得默默少东西)**:`max_files` 是**截断**,不是拒绝 ——
    # 取前 N 个,余下部分计入 files_omitted_by_max_files 并在返回体里明说。
    # 不做"超限即拒"是因为拒绝会让一次大仓库提交直接失败,而截断 + 计数 + 可续跑
    # (下面每轮最多新读 50 个文件)合起来才是可用的形态。
    # 刻意**不**把"没读到的文件"混进 read_errors:那是两件不同的事,混计就看不清了。
    kept = collected[:max_files]
    omitted_by_cap = scanned - len(kept)
    collected = kept

    checkpoint = ctx.checkpoint
    index: dict[str, Any] = {}
    existing = checkpoint.payload.get("__index__")
    if isinstance(existing, dict):
        index = {str(k): v for k, v in existing.items()}

    hashed: dict[str, str] = {
        str(k): str(v) for k, v in (checkpoint.payload.get("__hashes__") or {}).items()
    }
    reused = 0
    read_errors: list[str] = []
    budget = 0  # 每次最多新读 50 个文件,避免一次性吃满内存(单元可续)
    deferred_by_budget = 0  # 本轮因预算没轮到的单元数(下一轮从断点接着做)

    for path, language in collected:
        try:
            rel = path.relative_to(root).as_posix()
        except ValueError:
            rel = path.as_posix()
        if checkpoint.is_done(rel):
            reused += 1
            continue
        if budget >= 50:
            # 剩下的全部是"本轮没轮到",不是"读失败",也不是"永久省略"
            deferred_by_budget += 1
            continue
        budget += 1
        try:
            content = await asyncio.to_thread(path.read_text, encoding="utf-8")
        except Exception as e:  # noqa: BLE001 - 单文件读失败不得中断整轮索引
            read_errors.append(f"{rel}: {type(e).__name__}")
            checkpoint.mark_done(rel, artifact=None)
            continue
        chunks = codebase_indexer._chunk_by_regex(content, language)
        symbols = [c.symbol_name for c in chunks if c.symbol_name]
        index[rel] = {
            "language": language,
            "lines": content.count("\n") + 1,
            "chunks": len(chunks),
            "symbols": symbols[:200],
        }
        hashed[rel] = _file_content_hash(content)
        checkpoint.payload["__index__"] = index
        checkpoint.payload["__hashes__"] = hashed
        checkpoint.mark_done(rel)

    checkpoint.payload["__index__"] = index
    checkpoint.payload["__hashes__"] = hashed
    merkle = _merkle_root(hashed) if hashed else ""

    artifact_path: str | None = None
    body = {
        "repo_root": str(root),
        "files_scanned": scanned,
        "files_indexed": len(index),
        "files_reused_from_checkpoint": reused,
        "files_considered_this_run": len(collected),
        "files_omitted_by_max_files": omitted_by_cap,
        "files_deferred_by_budget": deferred_by_budget,
        "chunks_total": sum(int(v.get("chunks", 0)) for v in index.values() if isinstance(v, dict)),
        "merkle_root": merkle,
        "read_errors": read_errors,
        "index": index,
    }
    if isinstance(output_raw, str) and output_raw.strip():
        artifact_path = output_raw
        Path(output_raw).parent.mkdir(parents=True, exist_ok=True)
        await asyncio.to_thread(
            Path(output_raw).write_text,
            json.dumps(body, ensure_ascii=False, indent=2),
            "utf-8",
        )

    return _proof(
        ctx.task_type, False,
        ok=True,
        root=str(root),
        files_scanned=scanned,
        files_indexed=len(index),
        files_reused_from_checkpoint=reused,
        # 三个"少做了多少"的诚实计数:max_files 截断 / 每轮预算推迟 / 完全没轮到的比例
        files_omitted_by_max_files=omitted_by_cap,
        files_deferred_by_budget=deferred_by_budget,
        truncated_by_max_files=omitted_by_cap > 0,
        incomplete=omitted_by_cap > 0 or deferred_by_budget > 0,
        chunks_total=body["chunks_total"],
        symbols_total=sum(len(v["symbols"]) for v in index.values() if isinstance(v, dict)),
        merkle_root=merkle,
        read_errors=read_errors[:50],
        artifact_path=artifact_path,
        resumed=reused > 0,
    )


# ---------------------------------------------------------------------------
# executor 4:批量 LLM(并发上限 + 失败隔离)
# ---------------------------------------------------------------------------


async def _default_llm_call(messages: list[dict[str, Any]], model: str | None) -> dict[str, Any]:
    from app.core.llm_gateway import llm_gateway

    return await llm_gateway.complete(messages, model)


async def _exec_batch_llm(ctx: TaskContext) -> dict[str, Any]:
    items = ctx.require_list("items")
    if len(items) > DEFAULT_MAX_UNITS:
        raise TaskExecutionError(f"batch_llm: items 超过上限 {DEFAULT_MAX_UNITS}")
    concurrency = ctx.int_arg("concurrency", DEFAULT_CONCURRENCY, lo=1, hi=MAX_CONCURRENCY)
    template = ctx.arguments.get("prompt_template")
    if not isinstance(template, str) or not template.strip():
        template = "{item}"
    model = ctx.arguments.get("model")
    model_name = model if isinstance(model, str) and model.strip() else None
    llm_call = ctx.llm_call or _default_llm_call

    sem = asyncio.Semaphore(concurrency)
    results: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []
    peak_inflight = 0
    inflight = 0
    lock = asyncio.Lock()
    succeeded = 0

    async def one(idx: int, item: Any) -> None:
        nonlocal peak_inflight, inflight, succeeded
        unit = f"item:{idx}"
        if ctx.checkpoint.is_done(unit):
            cached = ctx.checkpoint.payload.get(unit)
            results.append({"index": idx, "reused": True, "output": cached})
            return
        if ctx.cancel_event.is_set():
            async with lock:
                failures.append({"index": idx, "error": "任务已取消,未发起调用"})
            return
        async with sem:
            # 排队到号再判一次:取消必须在"即将执行"那一刻生效,
            # 否则 gather 一次性起出的协程会绕过协作式取消(检查点早于排队)。
            if ctx.cancel_event.is_set():
                async with lock:
                    failures.append({"index": idx, "error": "任务已取消,未发起调用"})
                return
            async with lock:
                inflight += 1
                peak_inflight = max(peak_inflight, inflight)
            try:
                prompt = template.replace("{item}", str(item))
                resp = await llm_call([{"role": "user", "content": prompt}], model_name)
                async with lock:
                    if isinstance(resp, dict) and resp.get("error"):
                        failures.append({"index": idx, "error": str(resp.get("error"))[:500]})
                    elif not isinstance(resp, dict):
                        failures.append({"index": idx, "error": f"返回体非字典:{type(resp).__name__}"})
                    else:
                        succeeded += 1
                        content = str(resp.get("content", ""))[:2000]
                        results.append({"index": idx, "reused": False, "output": content})
                        ctx.checkpoint.mark_done(unit, artifact=content)
            except asyncio.CancelledError:
                raise
            except Exception as e:  # noqa: BLE001 - 单项失败必须被隔离,不得炸整批
                async with lock:
                    failures.append({"index": idx, "error": f"{type(e).__name__}: {e}"[:500]})
            finally:
                async with lock:
                    inflight -= 1

    await asyncio.gather(*(one(i, it) for i, it in enumerate(items)))

    return _proof(
        ctx.task_type, False,
        ok=(len(failures) == 0),
        requested=len(items),
        succeeded=succeeded,
        failed=len(failures),
        concurrency_limit=concurrency,
        peak_inflight=peak_inflight,
        concurrency_respected=peak_inflight <= concurrency,
        reused_from_checkpoint=sum(1 for r in results if r.get("reused")),
        results=results[:500],
        failures=failures[:200],
        model=model_name,
    )


# ---------------------------------------------------------------------------
# executor 5:网页批处理(真外部 URL + SSRF 护栏 + 走既有出站出口)
# ---------------------------------------------------------------------------


async def _default_http_get(url: str, timeout_s: float) -> tuple[int, str]:
    """走本仓共享出站客户端(带代理配置),不在这里新建 client。"""
    from app.core.llm_gateway import get_http_client

    client = get_http_client()
    resp = await client.get(url, timeout=timeout_s, follow_redirects=False)
    status = int(getattr(resp, "status_code", 0))
    body_text = str(getattr(resp, "text", "") or "")
    return status, body_text


_TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)


def extract_title(html: str) -> str:
    m = _TITLE_RE.search(html)
    return re.sub(r"\s+", " ", m.group(1)).strip()[:200] if m else ""


async def _exec_web_batch(ctx: TaskContext) -> dict[str, Any]:
    urls = ctx.require_list("urls")
    if len(urls) > DEFAULT_MAX_UNITS:
        raise TaskExecutionError(f"web_batch: urls 超过上限 {DEFAULT_MAX_UNITS}")
    concurrency = ctx.int_arg("concurrency", DEFAULT_CONCURRENCY, lo=1, hi=MAX_CONCURRENCY)
    timeout_s = float(ctx.int_arg("timeout_s", 20, lo=1, hi=120))
    cap = ctx.int_arg("max_bytes", 64 * 1024, lo=1024, hi=2 * 1024 * 1024)
    http_get = ctx.http_get or _default_http_get

    from app.services.network_guard import check_current
    from app.services.screenshot_service import _validate_url_ssrf

    sem = asyncio.Semaphore(concurrency)
    results: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []
    blocked: list[dict[str, Any]] = []
    lock = asyncio.Lock()
    succeeded = 0

    async def one(idx: int, url: Any) -> None:
        nonlocal succeeded
        unit = f"url:{idx}"
        if ctx.checkpoint.is_done(unit):
            cached = ctx.checkpoint.payload.get(unit)
            results.append({"index": idx, "reused": True, **(cached if isinstance(cached, dict) else {})})
            return
        target = str(url or "")
        ok_ssrf, reason = await asyncio.to_thread(_validate_url_ssrf, target)
        if not ok_ssrf:
            async with lock:
                blocked.append({"index": idx, "url": target[:300], "reason": reason})
            return
        ok_policy, policy_reason = check_current(target)
        if not ok_policy:
            async with lock:
                blocked.append({"index": idx, "url": target[:300], "reason": f"出站策略拒绝:{policy_reason}"})
            return
        async with sem:
            if ctx.cancel_event.is_set():
                async with lock:
                    failures.append({"index": idx, "url": target[:300], "error": "任务已取消,未发起请求"})
                return
            try:
                status, body = await http_get(target, timeout_s)
            except asyncio.CancelledError:
                raise
            except Exception as e:  # noqa: BLE001 - 单 URL 失败隔离
                async with lock:
                    failures.append({"index": idx, "url": target[:300], "error": f"{type(e).__name__}: {e}"[:400]})
                return
            total = len(body.encode("utf-8"))
            truncated = total > cap
            snippet = body[:cap]
            entry = {
                "index": idx,
                "url": target[:300],
                "status": status,
                "bytes": total,
                "body_truncated": truncated,
                "title": extract_title(snippet),
                "ok": 200 <= status < 400,
            }
            async with lock:
                if 200 <= status < 400:
                    succeeded += 1
                else:
                    failures.append({"index": idx, "url": target[:300], "error": f"HTTP {status}"})
                results.append({"reused": False, **entry})
                ctx.checkpoint.mark_done(unit, artifact=entry)

    await asyncio.gather(*(one(i, u) for i, u in enumerate(urls)))

    return _proof(
        ctx.task_type, False,
        ok=(len(failures) == 0 and len(blocked) == 0),
        requested=len(urls),
        succeeded=succeeded,
        failed=len(failures),
        ssrf_or_policy_blocked=len(blocked),
        concurrency_limit=concurrency,
        results=results[:500],
        failures=failures[:200],
        blocked=blocked[:200],
        egress="shared-httpx-client",
    )


# ---------------------------------------------------------------------------
# executor 6:patrol 真实巡检(跑什么 / 判定什么 / 产出什么)
# ---------------------------------------------------------------------------

_TODO_RE = re.compile(r"\b(TODO|FIXME|HACK|XXX)\b")
_PATROL_SCAN_EXTS = {".py", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".md", ".json", ".css", ".go", ".rs"}
_PATROL_SKIP_DIRS = {
    ".git", "node_modules", ".venv", "venv", "__pycache__", "dist", "build",
    ".next", ".pytest_tmp", "coverage", ".turbo", ".cache", ".mypy_cache",
}


async def _exec_patrol(ctx: TaskContext) -> dict[str, Any]:
    """巡检:遍历目标树,按**封闭判定集**产 finding,给 verdict。

    跑什么:一次真实目录遍历(os.walk,跳过依赖/构建目录)。
    判定什么:5 条阈值化判据(large_files / stale_files / empty_dirs / todo_markers /
      unreadable_files),每条一个可配阈值,命中即产 finding{path,severity,detail}。
    产出什么:findings 清单 + 每判据计数 + verdict(ok|warn|critical)+ 可选工件文件。
    """
    root = Path(ctx.require_str("root"))
    if not root.is_dir():
        raise TaskExecutionError(f"patrol: root 不是目录 {root}")
    checks_raw = ctx.arguments.get("checks")
    checks = [str(c) for c in checks_raw] if isinstance(checks_raw, list) and checks_raw else list(PATROL_CHECKS)
    unknown = [c for c in checks if c not in PATROL_CHECKS]
    if unknown:
        raise TaskExecutionError(f"patrol: 未知判据 {unknown}(可用 {list(PATROL_CHECKS)})")

    max_bytes = ctx.int_arg("max_file_bytes", 5 * 1024 * 1024, lo=1024, hi=10 * 1024 * 1024 * 1024)
    stale_days = ctx.int_arg("stale_days", 365, lo=1, hi=3650)
    todo_max = ctx.int_arg("max_todo_per_file", 5, lo=1, hi=10000)
    max_files = ctx.int_arg("max_files", 4000, lo=1, hi=200000)
    now_ts = time.time()
    stale_seconds = stale_days * 86400

    findings: list[dict[str, str]] = []
    scanned = 0
    unreadable = 0
    reused = 0
    truncated_by_cap = False

    def walk() -> None:  # noqa: C901 - 一遍遍历产多判据,拆函数反而绕
        nonlocal scanned, unreadable, truncated_by_cap, reused
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = sorted(d for d in dirnames if d not in _PATROL_SKIP_DIRS)
            dp = Path(dirpath)
            rel_dir = dp.relative_to(root).as_posix() or "."
            if "empty_dirs" in checks and not filenames and not dirnames and rel_dir != ".":
                findings.append({"check": "empty_dirs", "path": rel_dir, "severity": "info", "detail": "空目录"})
            for fname in sorted(filenames):
                if scanned >= max_files:
                    truncated_by_cap = True
                    return
                fp = dp / fname
                rel = fp.relative_to(root).as_posix()
                unit = f"file:{rel}"
                scanned += 1
                # **断点续跑在此真的生效**:已判过的文件不再 stat/读正文,
                # 其结论从 checkpoint 里取回。早先这格只写了 `mark_done` 而不跳过,
                # 于是"续跑"是装饰性的 —— 活照样全干一遍(票面警告的"框架里有就算有")。
                if ctx.checkpoint.is_done(unit):
                    reused += 1
                    cached = ctx.checkpoint.payload.get(unit)
                    if isinstance(cached, dict):
                        for item in cached.get("findings", []):
                            if isinstance(item, dict):
                                findings.append(dict(item))
                        unreadable += int(cached.get("unreadable", 0) or 0)
                    continue
                file_findings: list[dict[str, str]] = []
                file_unreadable = 0
                try:
                    st = fp.stat()
                except OSError as e:
                    file_unreadable = 1
                    if "unreadable_files" in checks:
                        file_findings.append({
                            "check": "unreadable_files", "path": rel, "severity": "warning",
                            "detail": str(e)[:200],
                        })
                else:
                    if "large_files" in checks and st.st_size > max_bytes:
                        file_findings.append({
                            "check": "large_files", "path": rel, "severity": "warning",
                            "detail": f"{st.st_size} B > 阈值 {max_bytes} B",
                        })
                    if "stale_files" in checks and (now_ts - st.st_mtime) > stale_seconds:
                        file_findings.append({
                            "check": "stale_files", "path": rel, "severity": "info",
                            "detail": f"mtime 距今 {(now_ts - st.st_mtime) / 86400:.0f} 天 > {stale_days} 天",
                        })
                    if "todo_markers" in checks and fp.suffix.lower() in _PATROL_SCAN_EXTS:
                        try:
                            content = fp.read_text(encoding="utf-8", errors="replace")
                        except OSError:
                            file_unreadable = 1
                            if "unreadable_files" in checks:
                                file_findings.append({
                                    "check": "unreadable_files", "path": rel, "severity": "warning",
                                    "detail": "正文读取失败",
                                })
                        else:
                            hits = len(_TODO_RE.findall(content))
                            if hits >= todo_max:
                                file_findings.append({
                                    "check": "todo_markers", "path": rel, "severity": "warning",
                                    "detail": f"{hits} 处 TODO/FIXME ≥ {todo_max}",
                                })
                unreadable += file_unreadable
                findings.extend(file_findings)
                ctx.checkpoint.mark_done(
                    unit, artifact={"findings": file_findings, "unreadable": file_unreadable}
                )

    await asyncio.to_thread(walk)

    by_check: dict[str, int] = dict.fromkeys(checks, 0)
    worst = "ok"
    for f in findings:
        by_check[f["check"]] = by_check.get(f["check"], 0) + 1
        if f["severity"] == "critical":
            worst = "critical"
        elif f["severity"] == "warning" and worst != "critical":
            worst = "warning"
    if unreadable and "unreadable_files" in checks and worst == "ok":
        worst = "warning"

    artifact_path: str | None = None
    output_raw = ctx.arguments.get("output_path")
    if isinstance(output_raw, str) and output_raw.strip():
        artifact_path = output_raw
        Path(output_raw).parent.mkdir(parents=True, exist_ok=True)
        await asyncio.to_thread(
            Path(output_raw).write_text,
            json.dumps({"root": str(root), "findings": findings, "verdict": worst}, ensure_ascii=False, indent=2),
            "utf-8",
        )

    return _proof(
        ctx.task_type, False,
        ok=(worst != "critical"),
        root=str(root),
        checks_run=checks,
        files_scanned=scanned,
        files_reused_from_checkpoint=reused,
        unreadable=unreadable,
        findings_by_check=by_check,
        findings=findings[:500],
        findings_truncated=len(findings) > 500,
        scan_truncated_by_max_files=truncated_by_cap,
        verdict=worst,
        artifact_path=artifact_path,
    )


# ---------------------------------------------------------------------------
# 演示档(自证 stub:不伪装成真实执行)
# ---------------------------------------------------------------------------


async def _exec_sleep(ctx: TaskContext) -> dict[str, Any]:
    """演示档。行为逐字保留自 mcp_server 原 `_bg_impl_sleep`(含批58 的时长校验接线),
    这样工具层删掉那份内联实现时不会丢能力(AGENTS §7:有承接功能才允许删)。
    """
    seconds = float(ctx.arguments.get("seconds", 0) or 0)
    if os.environ.get("MCP_MODEL_TOOLS_ENABLED", "false").strip().lower() in ("on", "1", "true", "yes"):
        try:
            from app.core.model_tools_57 import validate_sleep_duration

            err = validate_sleep_duration(seconds * 1000.0)
            if err is not None:
                return _proof(ctx.task_type, True, error=str(err), slept_seconds=0, ok=False)
        except Exception as e:  # noqa: BLE001 - 校验失败降级照常休眠(与旧实现同)
            logger.warning("[executor] model_tools 时长校验失败(降级照常休眠): %s", e)
    await asyncio.sleep(seconds)
    return _proof(ctx.task_type, True, slept_seconds=seconds, ok=True)


async def _exec_echo(ctx: TaskContext) -> dict[str, Any]:
    return _proof(ctx.task_type, True, echo=str(ctx.arguments.get("message", "")), ok=True)


# ---------------------------------------------------------------------------
# 注册表
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class ExecutorSpec:
    """一条任务类型的落地描述。`stub=True` 必须自证,不得被当作真实能力引用。"""

    task_type: str
    description: str
    run: Callable[[TaskContext], Awaitable[dict[str, Any]]]
    resumable: bool = True
    stub: bool = False


_SPECS: tuple[ExecutorSpec, ...] = (
    ExecutorSpec(
        task_type="long_running_command",
        description="真实派生长跑子进程(无 shell、禁窗口、可取消、输出上限与截断自证)",
        run=_exec_long_running_command,
        resumable=False,
    ),
    ExecutorSpec(
        task_type="test_suite",
        description="真实跑 pytest / vitest,回真实计数与失败明细",
        run=_exec_test_suite,
    ),
    ExecutorSpec(
        task_type="code_index",
        description="真实遍历仓库并产出代码索引结构(切片/符号/merkle 根/工件),单元级可续跑",
        run=_exec_code_index,
    ),
    ExecutorSpec(
        task_type="batch_llm",
        description="真实并发调用 LLM,带并发上限与逐项失败隔离",
        run=_exec_batch_llm,
    ),
    ExecutorSpec(
        task_type="web_batch",
        description="真实抓外部 URL 批量页面,走共享出站客户端,SSRF/策略前置拒绝",
        run=_exec_web_batch,
    ),
    ExecutorSpec(
        task_type="patrol",
        description="真实巡检:遍历目标树,按 5 条阈值判据产 finding 与 verdict",
        run=_exec_patrol,
    ),
    ExecutorSpec(
        task_type="sleep",
        description="演示档:休眠(自证 stub=True,不代表真实业务能力)",
        run=_exec_sleep,
        resumable=False,
        stub=True,
    ),
    ExecutorSpec(
        task_type="echo",
        description="演示档:回显(自证 stub=True,不代表真实业务能力)",
        run=_exec_echo,
        resumable=False,
        stub=True,
    ),
)

TASK_EXECUTORS: Final[dict[str, ExecutorSpec]] = {s.task_type: s for s in _SPECS}
REAL_TASK_TYPES: Final[tuple[str, ...]] = tuple(s.task_type for s in _SPECS if not s.stub)

# 一致性硬闸:字面量声明与注册表必须同集合(门禁解析前者,运行时用后者;
# 两边漂了就 import 期炸,而不是等一次线上"未知任务类型")
_MISSING = set(IMPLEMENTED_TASK_TYPES) - set(TASK_EXECUTORS)
_EXTRA = set(TASK_EXECUTORS) - set(IMPLEMENTED_TASK_TYPES)
if _MISSING or _EXTRA:
    raise RuntimeError(
        f"task_executors 注册表与 IMPLEMENTED_TASK_TYPES 漂移:缺实现={sorted(_MISSING)} 多实现={sorted(_EXTRA)}"
    )


def get_spec(task_type: str) -> ExecutorSpec:
    spec = TASK_EXECUTORS.get(str(task_type).strip())
    if spec is None:
        raise TaskExecutionError(
            f"未知任务类型 {task_type!r};已实现类型={sorted(TASK_EXECUTORS)}"
        )
    return spec


_ORIGINAL_SPECS: Final[dict[str, ExecutorSpec]] = dict(TASK_EXECUTORS)


def get_original_spec(task_type: str) -> ExecutorSpec:
    """注册表的**原始**条目(不受运行期替换影响)。

    存在的唯一理由:测试会把某条 spec 换成计数版(`tests/test_background_task_type_wiring_51.py`),
    还原时不能调 `get_spec` —— 那拿回来的正是被换掉的那条,还原就成了空操作。
    """
    spec = _ORIGINAL_SPECS.get(str(task_type).strip())
    if spec is None:
        raise TaskExecutionError(f"注册表原始条目里没有 {task_type!r}")
    return spec


def supported_task_types() -> list[str]:
    return sorted(TASK_EXECUTORS)


async def execute_task(
    task_type: str,
    arguments: dict[str, Any],
    *,
    task_id: str | None = None,
    checkpoint_key: str | None = None,
    user_id: str | None = None,
    session_id: str | None = None,
    cancel_event: asyncio.Event | None = None,
    llm_call: LlmCall | None = None,
    http_get: HttpGetter | None = None,
    store: CheckpointStore | None = None,
) -> dict[str, Any]:
    """按 task_type 分派到真实 executor —— **全仓唯一分派出口**。

    `background_tasks.submit_typed`(run_in_background)与
    `dag_scheduler.WorkerPool._default_executor`(DAG/看板)都只走这一条,
    于是"工具面能跑的类型"与"DAG 面能跑的类型"结构上不可能分叉。
    """
    spec = get_spec(task_type)
    tid = task_id or hashlib.sha256(f"{spec.task_type}:{time.time()}".encode()).hexdigest()[:32]
    key = checkpoint_key or f"{spec.task_type}:{tid}"
    cp = (store or get_checkpoint_store()).load(key)
    ctx = TaskContext(
        task_id=tid,
        task_type=spec.task_type,
        arguments=arguments if isinstance(arguments, dict) else {},
        checkpoint=cp,
        user_id=user_id,
        session_id=session_id,
        cancel_event=cancel_event or asyncio.Event(),
        llm_call=llm_call,
        http_get=http_get,
    )
    result = await spec.run(ctx)
    result["checkpoint_key"] = key
    result["checkpoint_completed_units"] = cp.completed_units
    result["resumable"] = spec.resumable
    return result


def _payload_of(task: Any) -> dict[str, Any]:  # noqa: ANN401 - KanbanTask 结构由调用方保证
    raw = getattr(task, "payload", None)
    return raw if isinstance(raw, dict) else {}


async def execute_for_kanban(task: Any) -> dict[str, Any]:  # noqa: ANN401
    """`WorkerPool._default_executor` 的真实实现入口(V3 #51 判据 5)。

    KanbanTask.payload 里 `taskType`(或 `task_type`)指定类型、`arguments`(或 `args`)
    给参数;checkpoint 键取 payload 的 `idempotencyKey`,缺省用 `dag:<task.id>`
    —— 于是同一 DAG 任务重提交天然从断点续,不从头再来。
    未知类型 ⇒ 抛 TaskExecutionError ⇒ WorkerPool 记 blocked(不是 done)。
    """
    payload = _payload_of(task)
    task_type = payload.get("taskType") or payload.get("task_type") or ""
    if not str(task_type).strip():
        raise TaskExecutionError(
            "KanbanTask.payload 未声明 taskType/task_type;可用类型="
            + ",".join(supported_task_types())
        )
    raw_args = payload.get("arguments")
    if not isinstance(raw_args, dict):
        alt = payload.get("args")
        raw_args = alt if isinstance(alt, dict) else {}
    args: dict[str, Any] = {str(k): v for k, v in raw_args.items()}
    key = payload.get("idempotencyKey") or payload.get("idempotency_key") or f"dag:{getattr(task, 'id', task_type)}"
    return await execute_task(
        str(task_type),
        args,
        task_id=str(getattr(task, "id", "") or None),
        checkpoint_key=str(key),
    )


def checkpoint_snapshot(key: str) -> dict[str, Any]:
    """供状态查询暴露"当前跑到哪一格"。"""
    cp = get_checkpoint_store().load(key)
    return {"key": cp.key, "completed_units": cp.completed_units}


def iter_registry_descriptions() -> Iterable[tuple[str, str, bool]]:
    for spec in _SPECS:
        yield spec.task_type, spec.description, spec.stub
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
