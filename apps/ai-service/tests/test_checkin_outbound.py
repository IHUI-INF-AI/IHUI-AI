# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""签到出站节流闸门单测(风控第四件套,2026-10-16 立;第五件套挑战熔断增补)。

覆盖:
- 全局间隔:两请求间至少等 CHECKIN_OUTBOUND_MIN;
- 429 → pause → before_request 快速失败抛 OutboundPaused(不睡不打);
- pause 叠加取更晚截止;reset 清状态;
- note_status(429) 触发全局暂停,其它状态码不触发;
- 第五件套:challenge_type 纯函数 / note_challenge 长暂停 / 告警 webhook
  去重与 fail-open。
"""

from __future__ import annotations

import asyncio
import time

import pytest

from app.services import checkin_outbound
from app.services.checkin_outbound import (
    CHALLENGE_COOLDOWN_SECONDS,
    OutboundGate,
    OutboundPaused,
    challenge_type,
)


@pytest.fixture
def gate(monkeypatch):
    """每例独立闸门 + 间隔归零(免真实睡眠),例后不污染单例。"""
    monkeypatch.setenv("CHECKIN_OUTBOUND_MIN", "0")
    monkeypatch.setenv("CHECKIN_OUTBOUND_MAX", "0")
    monkeypatch.setenv("CHECKIN_RATE_LIMIT_PAUSE", "60")
    monkeypatch.delenv("CHECKIN_ALERT_WEBHOOK", raising=False)
    checkin_outbound._alert_last_sent.clear()
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


# ---------------------------------------------------------------------------
# 第五件套:挑战页/WAF 熔断(2026-10-16)
# ---------------------------------------------------------------------------


class TestChallengeType:
    def test_wall_statuses(self):
        """403/418 = 挑战墙信号。"""
        assert challenge_type(403) == "Challenge"
        assert challenge_type(418) == "Challenge"

    def test_non_challenge_statuses(self):
        """其余状态码(含 429/401/2xx/None)不是挑战墙——各有既定分类。"""
        assert challenge_type(429) is None
        assert challenge_type(401) is None
        assert challenge_type(200) is None
        assert challenge_type(500) is None
        assert challenge_type(None) is None

    def test_cooldown_constant_is_thirty_minutes(self):
        """挑战冷却是跨模块共用常量,锁 30min,防各处字面量漂移。"""
        assert CHALLENGE_COOLDOWN_SECONDS == 1800


class TestNoteChallenge:
    async def test_pauses_longer_than_429(self, gate, monkeypatch):
        """挑战暂停默认 300s,长于 429 的 60s(被拦截时停手必须更久)。"""
        monkeypatch.delenv("CHECKIN_CHALLENGE_PAUSE", raising=False)
        gate.note_challenge("qoder")
        assert 290 < gate.paused_remaining() <= 300
        t0 = time.monotonic()
        with pytest.raises(OutboundPaused):
            await gate.before_request("trae")
        assert time.monotonic() - t0 < 0.5  # 快速失败

    async def test_pause_env_override(self, gate, monkeypatch):
        monkeypatch.setenv("CHECKIN_CHALLENGE_PAUSE", "600")
        gate.note_challenge("minimax")
        assert 590 < gate.paused_remaining() <= 600

    async def test_pause_env_bad_value_falls_back(self, gate, monkeypatch):
        monkeypatch.setenv("CHECKIN_CHALLENGE_PAUSE", "abc")
        gate.note_challenge("trae")
        assert 290 < gate.paused_remaining() <= 300

    async def test_reset_clears_challenge_pause(self, gate):
        gate.note_challenge("trae")
        gate.reset()
        assert gate.paused_remaining() == 0


class TestAlertWebhook:
    async def test_no_webhook_no_task(self, gate, monkeypatch):
        """env 未设 = 零行为变化:不建任务、不发任何请求。"""
        monkeypatch.delenv("CHECKIN_ALERT_WEBHOOK", raising=False)
        gate.pause(seconds=30, reason="429")
        assert checkin_outbound._alert_tasks == set()

    async def test_webhook_fires_with_dedup(self, gate, monkeypatch):
        """设了 webhook:暂停即告警;同 kind 10 分钟去重(第二次不再发)。"""
        sent: list[tuple[str, str, str]] = []

        async def fake_post(url: str, kind: str, text: str) -> None:
            sent.append((url, kind, text))

        monkeypatch.setattr(checkin_outbound, "_post_alert", fake_post)
        monkeypatch.setenv("CHECKIN_ALERT_WEBHOOK", "https://sctapi.ftqq.com/FAKE.send")
        gate.pause(seconds=30, reason="trae 返回 429")
        gate.pause(seconds=30, reason="trae 返回 429 第二次")
        tasks = list(checkin_outbound._alert_tasks)
        assert len(tasks) == 1  # 去重生效
        await asyncio.gather(*tasks)
        assert len(sent) == 1
        url, kind, text = sent[0]
        assert url == "https://sctapi.ftqq.com/FAKE.send"
        assert kind == "出站全局暂停"
        assert "429" in text

    async def test_post_alert_failure_swallowed(self, gate, monkeypatch):
        """投递失败只吞异常(真实 POST 到必然失败的地址也不炸主链路)。"""
        monkeypatch.setenv("CHECKIN_ALERT_WEBHOOK", "https://127.0.0.1:1/hook")
        gate.pause(seconds=30, reason="fail-open 测试")
        tasks = list(checkin_outbound._alert_tasks)
        assert len(tasks) == 1
        await asyncio.gather(*tasks)  # 不抛即过
