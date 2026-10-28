# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""app/core/voice_barge_in.py 判据单元测试(D11 第二工「段间静默内可打断」)。

判据不是拍脑袋的常数:窗口与去抖都由 D126 实测基线推出(段尾静默 570ms、
段首 180ms、段间硬静默 750ms)。本文件把"什么时候判打断"钉成可回归的数字:

- 正例:起音落在段尾静默余量内且持续 >= 300ms → 打断;
- 反例:有声区中途起音 / 只响 200ms / 已越过段尾 / 未在播 / 段太短装不下去抖
  → 一律不打断(宁可不切,也不切掉有声内容)。

分段函数是本判据的物理前提(没有段就没有段间静默),同样正反成对。
"""
from __future__ import annotations

from app.core.voice_barge_in import (
    MIN_VOICED_MS,
    SEGMENT_GAP_MS,
    SEGMENT_TAIL_SILENCE_MS,
    barge_in_window_ms,
    decide_barge_in,
    policy_payload,
    split_speech_segments,
)


class TestBargeInWindow:
    """窗口 = 段尾静默余量,与实测读数一一对应。"""

    def test_measured_1944ms_segment_window_starts_at_tail_margin(self):
        # 实测第一段时长 1944ms,尾静默 570ms ⇒ 可判区间 [1374, 1944]
        assert barge_in_window_ms(1944) == (1374, 1944)

    def test_zero_or_negative_duration_has_no_window(self):
        assert barge_in_window_ms(0) == (0, 0)
        assert barge_in_window_ms(-5) == (0, 0)

    def test_short_segment_never_arms_inside_lead_silence(self):
        # 段太短:tail 被压到 120ms,窗口 [180, 300] —— 绝不越过段首
        start, end = barge_in_window_ms(300)
        assert (start, end) == (180, 300)
        assert start >= 180  # 段首静默不参与判打断


class TestDecideBargeIn:
    """三条判据同时成立才算打断;每条都配一条反证。"""

    def test_voiced_run_inside_tail_margin_interrupts(self):
        assert decide_barge_in(
            playing=True,
            voiced_ms=MIN_VOICED_MS,
            now_ms_into_segment=1944 - SEGMENT_TAIL_SILENCE_MS + MIN_VOICED_MS,
            segment_duration_ms=1944,
        ) is True

    def test_too_short_voiced_run_is_not_an_interrupt(self):
        # 200ms 只有 2 帧:单帧咳嗽/键盘声不能把播报切掉
        assert decide_barge_in(
            playing=True,
            voiced_ms=200,
            now_ms_into_segment=1674,
            segment_duration_ms=1944,
        ) is False

    def test_run_started_mid_speech_is_rejected(self):
        # 起音在 1300ms(有声区),即使已闻到 600ms 也不算 —— 无法排除扬声器回声
        assert decide_barge_in(
            playing=True,
            voiced_ms=600,
            now_ms_into_segment=1900,
            segment_duration_ms=1944,
        ) is False

    def test_decision_after_segment_end_is_rejected(self):
        # 下一段已开始,此刻再停播只会切掉新段的有声内容
        assert decide_barge_in(
            playing=True,
            voiced_ms=MIN_VOICED_MS,
            now_ms_into_segment=1945,
            segment_duration_ms=1944,
        ) is False

    def test_not_playing_never_interrupts(self):
        assert decide_barge_in(
            playing=False,
            voiced_ms=MIN_VOICED_MS,
            now_ms_into_segment=1674,
            segment_duration_ms=1944,
        ) is False

    def test_short_segment_cannot_fit_the_debounce(self):
        # 窗口 [180, 300] 只有 120ms,装不下 300ms 去抖 ⇒ 不判(如实留白)
        assert decide_barge_in(
            playing=True,
            voiced_ms=MIN_VOICED_MS,
            now_ms_into_segment=300,
            segment_duration_ms=300,
        ) is False


class TestSplitSpeechSegments:
    """逐段合成是判据的物理前提。"""

    def test_splits_into_sentence_segments_and_keeps_text_intact(self):
        text = "今天天气不错。我们出去走走。顺便买点水果。"
        segments = split_speech_segments(text)
        assert len(segments) >= 1
        assert "".join(segments) == text.replace(" ", "")

    def test_empty_text_yields_no_segments(self):
        assert split_speech_segments("") == []
        assert split_speech_segments("   \n\t ") == []

    def test_tiny_trailing_sentence_merges_into_previous(self):
        # 末尾碎句单独成段会多付一次 750ms 段间静默 ⇒ 并入上一段
        segments = split_speech_segments("今天天气不错。我们出去走走。好。")
        assert all(len(seg) >= 8 for seg in segments[:-1]) or len(segments) == 1
        assert "".join(segments) == "今天天气不错。我们出去走走。好。"

    def test_overlong_sentence_is_hard_wrapped_under_limit(self):
        text = "甲" * 450 + "。"
        segments = split_speech_segments(text, max_chars=200)
        assert len(segments) == 3
        assert all(len(seg) <= 200 for seg in segments)
        assert "".join(segments) == text


class TestPolicyPayload:
    """policy 是客户端唯一的数字来源,必须与常量同源。"""

    def test_payload_carries_measured_baseline(self):
        policy = policy_payload()
        assert policy["policy"] == "silence_gap_only"
        assert policy["minVoicedMs"] == MIN_VOICED_MS == 300
        assert policy["segmentGapMs"] == SEGMENT_GAP_MS == 750
        assert policy["segmentTailSilenceMs"] == SEGMENT_TAIL_SILENCE_MS == 570

    def test_payload_is_not_a_single_frame_debounce(self):
        # 反证:去掉抖(100ms)等于任何噪声都触发打断,与判据口径不符
        assert policy_payload()["minVoicedMs"] != policy_payload()["frameHopMs"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
