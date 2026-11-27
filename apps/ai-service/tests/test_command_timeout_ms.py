# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""B2-05 命令级 `timeout_ms` 的判据测试(2026-11-27)。

钉住三件事:

  1. **单位换算**:毫秒 → 秒向上取整(`29_500ms` 必须是 30s,不能是 29s);
  2. **优先级与降级**:`timeout_ms` 显式给出就覆盖 `timeout`;非法值一律回落,不静默成 1 秒;
  3. **接线**:两个入口(`stream_command` / `run_command_simple`)都真的带了这个参数。

为什么这条值得单独一票:模型侧工具契约给的是 `timeout_ms`(毫秒),Python 侧此前只有秒级
`timeout`。`timeout_ms=30000` 若被当秒用,clamp 后是 1800 秒 —— 命令卡 30 分钟而调用方
以为自己设的是 30 秒。单位错位是**静默的**,所以才要有独立判据钉死。
"""

from __future__ import annotations

import inspect

import pytest

from app.services.command_streamer import (
    MAX_TIMEOUT,
    MIN_TIMEOUT,
    _resolve_timeout_seconds,
    run_command_simple,
    stream_command,
)


@pytest.mark.parametrize(
    ("timeout", "timeout_ms", "expected"),
    [
        # 无 timeout_ms ⇒ 走秒级,原样 clamp
        (300, None, 300),
        (0, None, MIN_TIMEOUT),
        (99999, None, MAX_TIMEOUT),
        # 毫秒优先于秒
        (300, 30_000, 30),
        (10, 30_000, 30),
        # 向上取整:29_500ms 是 30s,不是 29s
        (300, 29_500, 30),
        (300, 1_001, 2),
        # 极小毫秒托底到 1 秒
        (300, 1, 1),
        (300, 999, 1),
        # 非法值一律回落,不静默成 1 秒
        (300, 0, 300),
        (300, -5, 300),
        (300, True, 300),  # bool 是 int 子类,显式排除
        (300, False, 300),
    ],
)
def test_resolve_timeout_seconds(timeout, timeout_ms, expected) -> None:
    assert _resolve_timeout_seconds(timeout, timeout_ms) == expected


def test_resolve_timeout_seconds_rejects_non_numeric() -> None:
    assert _resolve_timeout_seconds(300, 'abc') == 300  # type: ignore[arg-type]
    assert _resolve_timeout_seconds(300, 3.9) == 1  # 浮点被 int() 截成 3ms ⇒ 1s


def test_resolve_timeout_seconds_clamps_huge_milliseconds() -> None:
    # 10_000_000ms = 10000s ⇒ clamp 到 1800s
    assert _resolve_timeout_seconds(300, 10_000_000) == MAX_TIMEOUT


def test_stream_command_exposes_timeout_ms() -> None:
    sig = inspect.signature(stream_command)
    assert 'timeout_ms' in sig.parameters
    assert sig.parameters['timeout_ms'].default is None


def test_run_command_simple_exposes_timeout_ms() -> None:
    sig = inspect.signature(run_command_simple)
    assert 'timeout_ms' in sig.parameters
    assert sig.parameters['timeout_ms'].default is None


def test_stream_command_uses_resolver_not_raw_clamp() -> None:
    src = inspect.getsource(stream_command)
    # 必须走归一器;若退回裸 _clamp_timeout(timeout) 就等于 timeout_ms 被静默忽略。
    assert '_resolve_timeout_seconds(timeout, timeout_ms)' in src
    assert '_clamp_timeout(timeout)\n' not in src


def test_run_command_simple_forwards_timeout_ms() -> None:
    src = inspect.getsource(run_command_simple)
    assert 'timeout_ms=timeout_ms' in src
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
