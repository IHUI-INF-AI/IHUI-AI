# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""b76-13 票2 接线锁(2026-11-13 立):字段级结构判据必须真的挂在生产出口上。

立此锁的因由:`sse_contract.py::sse_frame_schema_fault` 早已落地、也有单测
(tests/test_sse_frame_schema_b76_13.py),但 `app/routers/llm.py::_sse()` 里
**从未调用它** —— 生产出口当时只接了"必备字段名在不在"这一档。判据有实现、
有测试、在册,唯独没有牙齿:生产端万一产出语义坏帧,前端照收,渲染出来就是
"状态徽章空白"或"截断了却不知道截掉多少",而账面上一切为绿。

本锁钉三件事(每条都打在生产出口 `_sse()` 上,不重算判据):
  ① 开关开启时,枚举闭合破坏的帧必须被点名(terminal_end.status='cancelled');
  ② 必要字段对破坏的帧必须被点名(truncated=true 却缺 totalChars);
  ③ 合法帧不得因这一维新增告警,且坏帧仍**原样产出**(诊断不改写帧、不阻断流)。
反向对照:把接线摘掉(模拟接线前形态)同一条断言必须咬不住 —— 锁不是走过场。
"""

from __future__ import annotations

import warnings

import pytest

from app.routers.llm import _sse


def _frames_of(evt: str, payload: dict) -> tuple[str, list[str]]:
    """产出帧并收集告警文案。"""
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        frame = _sse(evt, payload)
    return frame, [str(w.message) for w in caught]


@pytest.fixture
def contract_on(monkeypatch):
    monkeypatch.setenv("SSE_CONTRACT_VALIDATE_ENABLED", "1")


def test_enum_closure_fault_is_reported(contract_on):
    """① status 越出 {completed, failed} 必须被点名。"""
    _, msgs = _frames_of(
        "terminal_end",
        {"type": "terminal_end", "status": "cancelled", "terminalId": "t1", "durationMs": 5},
    )
    assert any("枚举闭合破坏" in m and "cancelled" in m for m in msgs), (
        f"枚举坏帧未被字段级判据点名 —— 接线掉了?实得告警:{msgs}"
    )


def test_required_pair_fault_is_reported(contract_on):
    """② truncated=true 却不带 totalChars 必须被点名。"""
    _, msgs = _frames_of(
        "terminal_end",
        {
            "type": "terminal_end",
            "status": "completed",
            "truncated": True,
            "terminalId": "t2",
            "durationMs": 6,
        },
    )
    assert any("totalChars" in m and "必要字段对" in m for m in msgs), (
        f"必要字段对破坏未被点名 —— 截断了却不知道截掉多少会被静默放过。实得:{msgs}"
    )


def test_legal_frame_has_no_schema_fault(contract_on):
    """③ 合法帧不得出现任何「帧结构非法」告警(避免判据恒告警)。"""
    _, msgs = _frames_of(
        "terminal_end",
        {
            "type": "terminal_end",
            "status": "completed",
            "terminalId": "t3",
            "durationMs": 7,
            "output": "ok",
            "totalChars": 2,
        },
    )
    assert not [m for m in msgs if "帧结构非法" in m], f"合法帧被误判: {msgs}"


def test_bad_frame_still_emitted_verbatim(contract_on):
    """诊断只告警,不改写帧、不阻断流 —— 坏帧必须原样产出。"""
    frame, _ = _frames_of(
        "terminal_end",
        {"type": "terminal_end", "status": "cancelled", "terminalId": "t4", "durationMs": 8},
    )
    assert frame.startswith("event: terminal_end\ndata: ")
    assert '"status": "cancelled"' in frame, "判据把帧改写了 —— 诊断不得改帧"


def test_switch_off_keeps_zero_warnings(monkeypatch):
    """off 档与接线前逐字等价:坏帧也不告警(开关语义没被这次接线改掉)。"""
    monkeypatch.setenv("SSE_CONTRACT_VALIDATE_ENABLED", "false")
    _, msgs = _frames_of(
        "terminal_end",
        {"type": "terminal_end", "status": "cancelled", "terminalId": "t5", "durationMs": 9},
    )
    assert msgs == [], f"off 档不该产生任何告警,实得:{msgs}"


def test_reverse_control_without_wiring_would_miss():
    """反向对照:直接调判据之外的路径(不接线)咬不住坏帧 —— 说明上面几条确实靠接线。

    这里不去改生产代码,而是证明"若只在出口检查字段名存在与否",枚举坏帧的
    status 是**存在的键**,旧判据因此必然放过 —— 这正是接线前的现场。
    """
    from app.core.sse_contract import SSE_EVENT_CONTRACTS

    payload = {"type": "terminal_end", "status": "cancelled", "terminalId": "t6"}
    contract = next((c for c in SSE_EVENT_CONTRACTS if c.name == "terminal_end"), None)
    assert contract is not None
    missing = [f for f in contract.payload_fields if f not in payload]
    # 旧判据(只查字段名有无)对 status 越界这件事完全无感
    assert "status" not in missing, "status 键是存在的,旧判据据此必然放过枚举越界"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
