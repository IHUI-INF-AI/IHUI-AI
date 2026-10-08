# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G-815977 配对测试:回合终态封闭集的三层钉子。

① enum ≡ tuple::data:`TurnStopReason` 成员与 :data:`TURN_STOP_REASON_VALUES`
   (守门 151 SV5 的静态解析投影)逐字等值 —— 改任何一侧必须同笔(模块 docstring
   承诺的钉子落在这里);
② 值域闭合::func:`ensure_turn_stop_reason` 正条(集内原样放行,含
   ``cancelled``/``canceled`` 两式刻意同档收编、不清零)/反条(未登记档位抛
   :class:`TurnStopReasonError` 且点名);
③ 装配面与跨语言锁:done 帧装配点确实过了闭合判据、goal gate 三常量改引枚举、
   packages/types 的 ``AGENT_TURN_STOP_REASONS`` 与 Py 表逐字等值(机器等值由
   守门 151 SV5 判,此处钉字面漂移)。
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from app.core.turn_stop_reason import (
    TURN_STOP_REASON_VALUES,
    TurnStopReason,
    TurnStopReasonError,
    ensure_turn_stop_reason,
)

HERE = Path(__file__).resolve().parent
ROUTER = HERE.parent / "app" / "routers" / "agents.py"
GOAL_GATE = HERE.parent / "app" / "services" / "goal_completion_gate.py"
PRODUCER = HERE.parent / "app" / "services" / "agent_loop_v2.py"
TS_TYPES = HERE.parents[2] / "packages" / "types" / "src" / "agent-runtime.ts"


# ---- ① enum ≡ tuple(同笔纪律的钉子) ----


def test_enum_members_equal_literal_table_in_order():
    assert tuple(m.value for m in TurnStopReason) == TURN_STOP_REASON_VALUES


def test_literal_table_covers_every_member_as_a_set():
    assert set(TURN_STOP_REASON_VALUES) == {m.value for m in TurnStopReason}


def test_wire_value_is_the_member_value():
    """StrEnum 成员即 wire 值:done 帧 stop_reason 的对外字符串逐字不变。"""
    assert TurnStopReason.VERIFICATION_UNDETERMINED == "verification_undetermined"
    assert str(TurnStopReason.COMPLETED) == "completed"
    assert all(isinstance(v, str) for v in TURN_STOP_REASON_VALUES)


# ---- ② 值域闭合(正反成对) ----


def test_every_registered_value_passes_through_unchanged():
    for v in TURN_STOP_REASON_VALUES:
        assert ensure_turn_stop_reason(v) == v


def test_both_spellings_are_admitted_same_bucket():
    """cancelled/canceled 两式同档收编 —— 对旧客户端的刻意兼容,收口不得清零。"""
    assert ensure_turn_stop_reason("cancelled") == "cancelled"
    assert ensure_turn_stop_reason("canceled") == "canceled"
    assert TurnStopReason.CANCELLED == "cancelled"
    assert TurnStopReason.CANCELED == "canceled"


def test_unregistered_value_raises_and_is_named():
    with pytest.raises(TurnStopReasonError) as ei:
        ensure_turn_stop_reason("toxic_unregistered_stop")
    msg = str(ei.value)
    assert "toxic_unregistered_stop" in msg, "判据必须点名违规值"
    assert "TurnStopReason" in msg, "报文必须指到登记处,不许只喊一句违规"


def test_non_str_input_is_rejected():
    for bad in (None, 42, b"completed"):
        with pytest.raises(TurnStopReasonError):
            ensure_turn_stop_reason(bad)  # type: ignore[arg-type]


# ---- ③ 装配面与跨语言锁(源码级) ----


def test_done_frame_assembly_point_passes_the_closure_gate():
    src = ROUTER.read_text(encoding="utf-8")
    assert "ensure_turn_stop_reason(frame_stop_reason)" in src, (
        "done 帧装配点必须在发射前过值域闭合判据"
    )
    assert not re.search(r'frame_stop_reason\s*=\s*"verification_undetermined"', src), (
        "裸字面量形态回来了 —— 必须改引 STOP_VERIFICATION_UNDETERMINED"
    )


def test_goal_gate_constants_derive_from_the_enum():
    src = GOAL_GATE.read_text(encoding="utf-8")
    for name in (
        "STOP_VERIFICATION_NOT_ACHIEVED",
        "STOP_VERIFICATION_UNDETERMINED",
        "STOP_GOAL_BLOCKED",
    ):
        m = re.search(rf"{name}:\s*Final\s*=\s*(\S+)", src)
        assert m, f"{name} 定义丢失"
        assert m.group(1).startswith("TurnStopReason."), (
            f"{name} 退回裸字面量 —— 三份写法之一又回来了"
        )
    assert "TurnStopReason.BUDGET_EXCEEDED" in src and "TurnStopReason.MAX_ITERATIONS" in src, (
        "BUDGET_STOP_REASONS 必须引枚举成员,不许各写一份字符串"
    )


def test_producer_literals_stay_within_the_closed_set():
    """生产点的 stop_reason 字面量赋值都落在集内(漂出集即红,与 done 帧判据同向)。"""
    src = PRODUCER.read_text(encoding="utf-8")
    used = set(re.findall(r'stop_reason\s*=\s*"([a-z_]+)"', src))
    assert used, "扫描不到任何生产点 ⇒ 尺子漂了,不得当成全绿"
    assert used <= set(TURN_STOP_REASON_VALUES), (
        f"发现封闭集之外的 stop_reason 档位:{sorted(used - set(TURN_STOP_REASON_VALUES))}"
    )


def test_types_package_table_is_in_sync_with_python():
    src = TS_TYPES.read_text(encoding="utf-8")
    m = re.search(r"export const AGENT_TURN_STOP_REASONS = \[(.*?)\] as const", src, re.S)
    assert m, "TS 对齐表丢失 —— 跨语言等值没有了对账对象"
    ts_values = re.findall(r"'([a-z_]+)'", m.group(1))
    assert ts_values == list(TURN_STOP_REASON_VALUES), (
        f"跨语言漂移:TS={ts_values} Py={list(TURN_STOP_REASON_VALUES)}"
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
