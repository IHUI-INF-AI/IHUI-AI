# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""B2-05 `run_command` 毫秒超时的判据测试(2026-11-27)。

钉住四件事:

  1. `timeout_ms` 显式给出即**优先于**秒级 `timeout`;
  2. 毫秒 → 秒**向上取整**(`29_500ms` 必须是 30s);
  3. 非法值(bool / 0 / 负数 / 非数字)一律回落秒级,不静默成 1 秒;
  4. `max_timeout` 与硬上限仍然生效,毫秒路径不得绕过它们。

为什么单独一票:`run_command_budget_s` 此前只读 `timeout`(秒)。模型按工具契约传
`timeout_ms=30000`(想要 30 秒)会被当成"没给",**静默退回默认值** —— 这类"参数被忽略"
不会报错、不会留痕,只会让命令跑得比模型以为的久。
"""

from __future__ import annotations

import inspect

import pytest

from app.core.tool_timeout_policy import (
    RUN_COMMAND_DEFAULT_MAX_TIMEOUT_S,
    RUN_COMMAND_DEFAULT_TIMEOUT_S,
    resolve_tool_timeout_budget,
    run_command_budget_s,
)


@pytest.mark.parametrize(
    ("args", "expected"),
    [
        ({'timeout_ms': 30_000}, 30.0),
        ({'timeout_ms': 29_500}, 30.0),
        ({'timeout_ms': 1_001}, 2.0),
        ({'timeout_ms': 1}, 1.0),
        ({'timeout_ms': 999}, 1.0),
        # 毫秒优先于秒
        ({'timeout_ms': 30_000, 'timeout': 5}, 30.0),
        # 非法毫秒回落秒级
        ({'timeout_ms': 0, 'timeout': 45}, 45.0),
        ({'timeout_ms': -5, 'timeout': 45}, 45.0),
        ({'timeout_ms': True, 'timeout': 45}, 45.0),
        ({'timeout_ms': False, 'timeout': 45}, 45.0),
        ({'timeout_ms': 'abc', 'timeout': 45}, 45.0),
        # 无 timeout_ms 时保持原秒级语义
        ({'timeout': 45}, 45.0),
        ({'timeout': 0}, 1.0),
        ({}, float(RUN_COMMAND_DEFAULT_TIMEOUT_S)),
    ],
)
def test_run_command_budget_reads_timeout_ms(args: dict, expected: float) -> None:
    assert run_command_budget_s(args) == expected


def test_max_timeout_still_clamps_millisecond_path() -> None:
    # 毫秒路径不得绕过 max_timeout
    assert run_command_budget_s({'timeout_ms': 30_000, 'max_timeout': 10}) == 10.0


def test_huge_milliseconds_are_clamped_by_default_max() -> None:
    got = run_command_budget_s({'timeout_ms': 10_000_000})
    assert got <= float(RUN_COMMAND_DEFAULT_MAX_TIMEOUT_S)
    assert got >= 1.0


def test_resolve_budget_sees_milliseconds() -> None:
    budget = resolve_tool_timeout_budget('run_command', {'timeout_ms': 30_000}, default_s=300)
    assert budget.tool_budget_s == 30.0
    assert budget.source == 'args'


def test_run_command_budget_uses_timeout_ms_key() -> None:
    src = inspect.getsource(run_command_budget_s)
    assert 'data.get("timeout_ms")' in src
    # 毫秒必须先算:若排在秒级之后又被覆盖,等于没读。
    assert src.index('data.get("timeout_ms")') < src.index('data.get("timeout"')
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
