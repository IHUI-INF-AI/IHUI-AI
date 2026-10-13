# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G-815972(2026-10-13)宿主故障身份标记测试。

覆盖:
- ① ``raise Wrapped("x") from HostTurnFault(code="provider_pipe_broken")`` ⇒
  ``_classify_error`` 分类为该 code(错误族 —— 该返回值即落库面:checkpoint
  metadata / hook error 事件的 error_type 由此而来),不得判成 cancelled;
- ② 纯 CancelledError 沿 ``__cause__`` 链走到底,不得被认成宿主故障;
- ③ 自引用 ``__cause__`` 环(e.__cause__ = e)与超长链:深度上限(6)内停下,
  不抛栈、不死循环;
- 消费点:``should_retry_compact_with_current_model`` 对盖章异常一律不可重试,
  文本兜底行为不变。
"""

from __future__ import annotations

import asyncio

from app.services.agent_loop_v2 import (
    AgentLoopV2,
    HostTurnFault,
    find_declared_host_fault,
)
from app.services.compact_with_llm import should_retry_compact_with_current_model


def test_wrapped_host_fault_classified_by_code_not_cancelled() -> None:
    """① 包装层之下的宿主盖章被认领:分类为 code(错误族),而非 cancelled。"""

    class Wrapped(Exception):
        pass

    fault = HostTurnFault("provider_pipe_broken")
    err = Wrapped("x")
    err.__cause__ = fault  # 等价 raise Wrapped("x") from fault

    assert find_declared_host_fault(err) is fault
    classified = AgentLoopV2._classify_error(err)
    assert classified == "provider_pipe_broken"
    assert classified != "cancelled"
    # classified 即落库事件的 error_type(checkpoint metadata / hook error),属错误族


def test_host_fault_marker_beats_cancelled_classification() -> None:
    """标记优先于 cancelled 分支:CancelledError 链上盖了宿主章 ⇒ 按章分类。"""
    err = asyncio.CancelledError()
    err.__cause__ = HostTurnFault("provider_pipe_broken")
    assert find_declared_host_fault(err) is not None
    assert AgentLoopV2._classify_error(err) == "provider_pipe_broken"


def test_pure_cancelled_error_never_recognized_as_host_fault() -> None:
    """② 纯取消沿链到底(链上只有普通异常)不得认成宿主故障,仍分类 cancelled。"""
    err = asyncio.CancelledError()
    err.__cause__ = RuntimeError("upstream boom")
    assert find_declared_host_fault(err) is None
    assert AgentLoopV2._classify_error(err) == "cancelled"
    assert should_retry_compact_with_current_model(err) is False  # 纯取消仍不可重试


def test_self_referential_cause_chain_stops_within_depth() -> None:
    """③ 自引用环:e.__cause__ = e —— WeakSet 环检测在深度上限内停下,不抛栈。"""
    e = RuntimeError("self loop")
    e.__cause__ = e
    # 返回 None 而非 RecursionError(环在第二圈入口即被 WeakSet 识别)
    assert find_declared_host_fault(e) is None


def test_depth_limit_long_chain_without_marker_returns_none() -> None:
    """超长无标记链(10 层包装)走到深度上限(6)即返 None,不越限。"""
    current: BaseException = RuntimeError("base")
    for _ in range(10):
        wrapper = RuntimeError("wrap")
        wrapper.__cause__ = current
        current = wrapper
    assert find_declared_host_fault(current) is None


def test_depth_boundary_marker_at_six_hops_found_seven_not() -> None:
    """深度边界:标记恰在第 6 跳(上限内)可命中;第 7 跳起超限返回 None。"""
    fault = HostTurnFault("host_down")

    six_hops: BaseException = fault
    for _ in range(6):
        wrapper = RuntimeError("wrap")
        wrapper.__cause__ = six_hops
        six_hops = wrapper
    assert find_declared_host_fault(six_hops) is fault

    seven_hops: BaseException = fault
    for _ in range(7):
        wrapper = RuntimeError("wrap")
        wrapper.__cause__ = seven_hops
        seven_hops = wrapper
    assert find_declared_host_fault(seven_hops) is None


def test_should_retry_compact_refuses_stamped_host_fault() -> None:
    """消费点:盖章异常(任意包装)一律不可用当前模型重试;文本兜底行为不变。"""
    stamped = RuntimeError("compaction failed")
    stamped.__cause__ = HostTurnFault("provider_pipe_broken")
    assert should_retry_compact_with_current_model(stamped) is False
    assert should_retry_compact_with_current_model(
        HostTurnFault("provider_pipe_broken")
    ) is False
    # 无标记的普通异常(文本无中止标记)仍可重试 —— 兜底判据未被收紧
    assert should_retry_compact_with_current_model(RuntimeError("provider pipe broken")) is True
