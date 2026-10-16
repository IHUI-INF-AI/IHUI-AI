# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""签到出站节流闸门单测(风控第四件套,2026-10-16 立)。

覆盖:
- 全局间隔:两请求间至少等 CHECKIN_OUTBOUND_MIN;
- 429 → pause → before_request 快速失败抛 OutboundPaused(不睡不打);
- pause 叠加取更晚截止;reset 清状态;
- note_status(429) 触发全局暂停,其它状态码不触发。
"""

from __future__ import annotations

import time

import pytest

from app.services.checkin_outbound import OutboundGate, OutboundPaused


@pytest.fixture
def gate(monkeypatch):
    """每例独立闸门 + 间隔归零(免真实睡眠),例后不污染单例。"""
    monkeypatch.setenv("CHECKIN_OUTBOUND_MIN", "0")
    monkeypatch.setenv("CHECKIN_OUTBOUND_MAX", "0")
    monkeypatch.setenv("CHECKIN_RATE_LIMIT_PAUSE", "60")
    return OutboundGate()


class TestGapThrottle:
    async def test_gap_zero_no_wait(self, gate):
        t0 = time.monotonic()
        await gate.before_request("trae")
        await gate.before_request("trae")
        assert time.monotonic() - t0 < 0.5  # 间隔 0 时不睡

    async def test_gap_schedules_next_slot(self, gate, monkeypatch):
        monkeypatch.setenv("CHECKIN_OUTBOUND_MIN", "5")
        monkeypatch.setenv("CHECKIN_OUTBOUND_MAX", "5")
        t0 = time.monotonic()
        await gate.before_request("trae")  # 第一发立即放行并占槽
        # 槽位已被推到 +5s;直接查状态而非真睡 5s
        assert gate._next_slot - t0 >= 4.9

    async def test_gap_bounds_fallback_on_bad_env(self, gate, monkeypatch):
        monkeypatch.setenv("CHECKIN_OUTBOUND_MIN", "abc")
        t0 = time.monotonic()
        await gate.before_request("trae")
        # 非法值回退默认(1.5~4.5),第一发仍立即放行
        assert time.monotonic() - t0 < 0.5


class TestPause:
    async def test_pause_then_before_request_fast_fails(self, gate):
        gate.pause(seconds=30, reason="429")
        assert gate.paused_remaining() > 25
        t0 = time.monotonic()
        with pytest.raises(OutboundPaused) as ei:
            await gate.before_request("trae")
        assert time.monotonic() - t0 < 0.5  # 快速失败,绝不睡到暂停结束
        assert ei.value.remaining > 25
        assert "限流冷却中" in str(ei.value)

    async def test_note_status_429_pauses_others_do_not(self, gate):
        gate.note_status(429, "trae")
        assert gate.paused_remaining() > 0
        gate.reset()
        gate.note_status(500, "trae")
        gate.note_status(200, "trae")
        assert gate.paused_remaining() == 0

    async def test_pause_stacking_keeps_later_deadline(self, gate):
        gate.pause(seconds=10, reason="a")
        gate.pause(seconds=60, reason="b")
        assert gate.paused_remaining() > 55  # 取更晚,不被更短的覆盖回退

    async def test_reset_clears_all(self, gate):
        gate.pause(seconds=60, reason="x")
        gate.reset()
        assert gate.paused_remaining() == 0
        await gate.before_request("trae")  # 不抛

    async def test_default_pause_from_env(self, gate, monkeypatch):
        monkeypatch.setenv("CHECKIN_RATE_LIMIT_PAUSE", "120")
        gate.pause(reason="429")
        assert 115 < gate.paused_remaining() <= 120
