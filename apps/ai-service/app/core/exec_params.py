# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# app/core/exec_params.py
"""命令执行参数与输出捕获策略 — 2026-09-19 第三十二批,对标 Codex core/src/exec.rs(纯算法部分)。

移植范围:
- 常量:DEFAULT_EXEC_COMMAND_TIMEOUT_MS=10_000、IO_DRAIN_TIMEOUT_MS=2_000、
  EXEC_OUTPUT_MAX_BYTES=DEFAULT_OUTPUT_BYTES_CAP=1MiB(utils/pty)。
- ExecCapturePolicy 四档(ShellTool 历史输出上限+超时 / FullBuffer 全缓冲免过期 /
  FullBufferWithExpiration 全缓冲+过期 / SensitiveFullBuffer 全缓冲+过期+抑制沙箱诊断)
  及 retained_bytes_cap / uses_expiration 判定。
- ExecExpiration 过期机制四变体 + wait_with_outcome(asyncio 版,TimeoutOrCancellation
  偏向 cancelled,对齐 tokio::select! biased)+ timeout_ms + with_cancellation 组合语义
  (Timeout→TimeoutOrCancellation;已有 cancellation→cancel_when_either 合并)。
- CancellationToken(asyncio.Event 版 tokio 等价)+ cancel_when_either(子 token 派生,
  任一取消即取消;派生时已取消立即返回)。
- ExecParams 数据类(command/cwd/env/expiration/capture_policy/network/sandbox 等)。
- 输出字节捕获纯算法:append_capped(上限内截断追加)、StreamOutput(text +
  truncated_after_lines)、aggregate_output(超上限时 stdout 保 1/3、stderr 保 2/3,
  stderr 未用完配额再平衡回 stdout——Codex 原注释语义)。

判定跳过(耦合证据):
- build_exec_request/SandboxManager.transform/SandboxType 选择:沙箱管理器与平台
  sandbox 进程包装(Landlock/Windows restricted token),属平台执行层;
- exec()/consume_output/spawn_child_async:子进程生命周期与事件通道(tokio mpsc),由
  我们侧执行器负责;StdoutStream(tx_event) 同理;
- NetworkProxy.apply_to_env_for_optional_environment:网络代理环境装配,依赖代理基础设施。
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

DEFAULT_EXEC_COMMAND_TIMEOUT_MS: int = 10_000
IO_DRAIN_TIMEOUT_MS: int = 2_000
DEFAULT_OUTPUT_BYTES_CAP: int = 1024 * 1024
EXEC_OUTPUT_MAX_BYTES: int = DEFAULT_OUTPUT_BYTES_CAP


class ExecCapturePolicy(str, Enum):
    """输出捕获策略四档(Codex exec.rs 同名枚举)。"""

    SHELL_TOOL = "shell_tool"
    FULL_BUFFER = "full_buffer"
    FULL_BUFFER_WITH_EXPIRATION = "full_buffer_with_expiration"
    SENSITIVE_FULL_BUFFER = "sensitive_full_buffer"

    def retained_bytes_cap(self) -> Optional[int]:
        """ShellTool 保历史输出上限;其余全缓冲无上限。"""
        return EXEC_OUTPUT_MAX_BYTES if self is ExecCapturePolicy.SHELL_TOOL else None

    def io_drain_timeout_ms(self) -> int:
        return IO_DRAIN_TIMEOUT_MS

    def uses_expiration(self) -> bool:
        """FullBuffer 唯一豁免过期/取消;其余档位均受 expiration 约束。"""
        return self is not ExecCapturePolicy.FULL_BUFFER


class ExecExpirationOutcome(str, Enum):
    TIMED_OUT = "timed_out"
    CANCELLED = "cancelled"


class CancellationToken:
    """tokio CancellationToken 的 asyncio 等价:cancel() 触发,await cancelled() 挂起至触发。"""

    def __init__(self) -> None:
        self._event = asyncio.Event()

    def cancel(self) -> None:
        self._event.set()

    @property
    def is_cancelled(self) -> bool:
        return self._event.is_set()

    async def cancelled(self) -> None:
        await self._event.wait()

    def child_token(self) -> "CancellationToken":
        """派生子 token:父取消时子随之取消(反向不传播)。"""
        child = CancellationToken()
        if self._event.is_set():
            child.cancel()
            return child
        self._link(child)
        return child

    def _link(self, child: "CancellationToken") -> None:
        async def _propagate() -> None:
            await self._event.wait()
            child.cancel()

        try:
            asyncio.get_running_loop().create_task(_propagate())
        except RuntimeError:
            # 无运行loop(纯同步构造场景):子 token 退化为不联动,调用方在 loop 内应重建
            pass


def cancel_when_either(first: CancellationToken, second: CancellationToken) -> CancellationToken:
    """Codex cancel_when_either 等价:任一取消即取消的组合 token。"""
    combined = first.child_token()
    if combined.is_cancelled or second.is_cancelled:
        combined.cancel()
        return combined

    async def _watch() -> None:
        await second.cancelled()
        combined.cancel()

    try:
        asyncio.get_running_loop().create_task(_watch())
    except RuntimeError:
        pass
    return combined


@dataclass(frozen=True)
class ExecExpiration:
    """过期机制四变体:显式超时 / 默认超时 / 取消令牌 / 超时或取消。timeout_ms 单位毫秒。"""

    kind: str
    timeout_ms: Optional[int] = None
    cancellation: Optional[CancellationToken] = None

    @classmethod
    def timeout(cls, timeout_ms: int) -> "ExecExpiration":
        return cls(kind="timeout", timeout_ms=timeout_ms)

    @classmethod
    def default_timeout(cls) -> "ExecExpiration":
        return cls(kind="default_timeout", timeout_ms=DEFAULT_EXEC_COMMAND_TIMEOUT_MS)

    @classmethod
    def from_cancellation(cls, cancellation: CancellationToken) -> "ExecExpiration":
        return cls(kind="cancellation", cancellation=cancellation)

    @classmethod
    def timeout_or_cancellation(
        cls, timeout_ms: int, cancellation: CancellationToken
    ) -> "ExecExpiration":
        return cls(kind="timeout_or_cancellation", timeout_ms=timeout_ms, cancellation=cancellation)

    def timeout_only_ms(self) -> Optional[int]:
        """Codex timeout_ms(windows cfg)等价:cancellation-only 变体无超时。"""
        if self.kind == "cancellation":
            return None
        return self.timeout_ms

    def with_cancellation(self, cancellation: CancellationToken) -> "ExecExpiration":
        """组合新取消令牌:Timeout→TimeoutOrCancellation;已有令牌→cancel_when_either 合并。"""
        if self.kind == "timeout":
            assert self.timeout_ms is not None
            return ExecExpiration.timeout_or_cancellation(self.timeout_ms, cancellation)
        if self.kind == "default_timeout":
            return ExecExpiration.timeout_or_cancellation(
                DEFAULT_EXEC_COMMAND_TIMEOUT_MS, cancellation
            )
        if self.kind == "cancellation":
            assert self.cancellation is not None
            return ExecExpiration.from_cancellation(
                cancel_when_either(self.cancellation, cancellation)
            )
        assert self.timeout_ms is not None and self.cancellation is not None
        return ExecExpiration.timeout_or_cancellation(
            self.timeout_ms, cancel_when_either(self.cancellation, cancellation)
        )

    async def wait_with_outcome(self) -> ExecExpirationOutcome:
        """挂起至过期:超时→TIMED_OUT;取消→CANCELLED;组合变体偏向 cancelled(biased select)。"""
        if self.kind == "cancellation":
            assert self.cancellation is not None
            await self.cancellation.cancelled()
            return ExecExpirationOutcome.CANCELLED
        timeout_ms = (
            self.timeout_ms if self.timeout_ms is not None else DEFAULT_EXEC_COMMAND_TIMEOUT_MS
        )
        if self.kind in ("timeout", "default_timeout"):
            await asyncio.sleep(timeout_ms / 1000)
            return ExecExpirationOutcome.TIMED_OUT
        assert self.cancellation is not None
        cancel_task = asyncio.ensure_future(self.cancellation.cancelled())
        sleep_task = asyncio.ensure_future(asyncio.sleep(timeout_ms / 1000))
        try:
            done, _ = await asyncio.wait(
                {cancel_task, sleep_task}, return_when=asyncio.FIRST_COMPLETED
            )
            # biased 语义:取消优先判定
            if cancel_task in done:
                return ExecExpirationOutcome.CANCELLED
            return ExecExpirationOutcome.TIMED_OUT
        finally:
            cancel_task.cancel()
            sleep_task.cancel()


@dataclass
class ExecParams:
    """Codex ExecParams 等价(字段子集,平台沙箱细节留空由执行层补齐)。"""

    command: list[str]
    cwd: str
    env: dict[str, str] = field(default_factory=dict)
    expiration: ExecExpiration = field(default_factory=ExecExpiration.default_timeout)
    capture_policy: ExecCapturePolicy = ExecCapturePolicy.SHELL_TOOL
    network: Optional[dict[str, object]] = None
    network_environment_id: Optional[str] = None
    sandbox_permissions: str = "none"
    justification: Optional[str] = None
    arg0: Optional[str] = None


@dataclass
class StreamOutput:
    """Codex StreamOutput<Vec<u8>> 等价,text 为字节串。"""

    text: bytes
    truncated_after_lines: Optional[int] = None


def append_capped(dst: bytearray, src: bytes, max_bytes: int) -> None:
    """Codex append_capped:dst 已满则丢弃;未满则只取剩余配额。"""
    if len(dst) >= max_bytes:
        return
    remaining = max_bytes - len(dst)
    take = min(remaining, len(src))
    dst.extend(src[:take])


def aggregate_output(
    stdout: StreamOutput,
    stderr: StreamOutput,
    max_bytes: Optional[int],
) -> StreamOutput:
    """Codex aggregate_output:无上限直接拼接;超上限 stdout 保 1/3、stderr 保 2/3,
    stderr 未用完的配额再平衡给 stdout(各流只取配额内前缀,不重排)。"""
    total_len = len(stdout.text) + len(stderr.text)
    if max_bytes is None or total_len <= max_bytes:
        return StreamOutput(text=stdout.text + stderr.text, truncated_after_lines=None)

    want_stdout = min(len(stdout.text), max_bytes // 3)
    want_stderr = len(stderr.text)
    stderr_take = min(want_stderr, max_bytes - want_stdout)
    remaining = max_bytes - (want_stdout + stderr_take)
    stdout_take = want_stdout + min(remaining, len(stdout.text) - want_stdout)

    return StreamOutput(
        text=stdout.text[:stdout_take] + stderr.text[:stderr_take],
        truncated_after_lines=None,
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
