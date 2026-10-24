# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""语音打断(barge-in)判据 —— 「段间静默内可打断」的唯一事实源(D11 第二工)。

立因:现网语音对话是半双工回合制(说完自动发 + done 边沿整段朗读),「流式回 +
可打断」两格全缺;上一工(D126 取证)已定档「真实差距」并量得段间静默基线,
本模块把那条基线固化成判据,避免客户端各自硬编码数字。

基线(真跑读数:zh-CN-XiaoxiaoNeural / rate +0% / 三句短句,见
`.ihui-agent/tmp/d126-evidence-report.md` §2.2):
- 每段首静默 170~190ms、尾静默 570~590ms;
- 逐段合成后连续播放,段间硬静默 = 尾 + 首 = 750~760ms(方差 ±10ms);
- 整段合成的自然句间停顿 640/650ms 与本判据无关(本判据只作用于逐段播放)。

判据(三条同时成立才判打断):
1. **只在段尾静默余量内**接受起音:播报有声区的中途不判 —— 当前无 AEC 取证,
   无法把用户人声与扬声器回声分开(取证报告 U2 未判定);
2. 人声连续 >= MIN_VOICED_MS(300ms = 3 个 100ms 帧)才算起音,单帧咳嗽/噪声不算;
3. 起音起点(now - voiced_ms)落在余量窗内,且判定时刻仍在窗内 —— 打断动作发生在
   下一段开始之前,不会切掉任何有声内容。

本模块是纯函数 + 常量,不依赖 fastapi / edge_tts;服务端经 /voice/tts/stream 的
policy 事件把同一组数字下发给客户端,两端不得各写一份。
"""

from __future__ import annotations

import re
from typing import Any

# ---- 测量基线(改数字 = 改判据,必须同时更新取证报告与客户端契约) ----
FRAME_HOP_MS = 100  # 能量帧步长(RMS 判静音的采样粒度)
SEGMENT_LEAD_SILENCE_MS = 180  # 段首静默实测 170~190ms
SEGMENT_TAIL_SILENCE_MS = 570  # 段尾静默实测 570~590ms
SEGMENT_GAP_MS = SEGMENT_LEAD_SILENCE_MS + SEGMENT_TAIL_SILENCE_MS  # 750(与实测 750~760 对齐)
MIN_VOICED_MS = 3 * FRAME_HOP_MS  # 300:至少 3 帧连续有声才算起音
# 单帧"有声"的能量下限(RMS,归一化 float 采样)。仅客户端 VAD 取帧用,不参与
# decide_barge_in;随 policy 下发,客户端不得自留一份数字。
VOICED_RMS_THRESHOLD = 0.02

# ---- 分段参数(流式回的单位;单段上限与 /voice/tts 的 2000 字符不同量级) ----
MAX_SEGMENT_CHARS = 200  # 单段送 TTS 的上限(超长句按可读断点硬切)
MIN_SEGMENT_CHARS = 8  # 短于此的碎句并入下一句,避免"嗯。"单独成段多付一次 750ms

# 句末判据:中文句读 + ASCII 叹/问/分号 + 省略号 + 换行。ASCII 句点**刻意不算**
# 句末(避免把 "3.14" / "a.m." / 缩写切开);英文长段由 _wrap_chunk 按可读断点兜底。
_SENTENCE_RE = re.compile(r"[^。！？；!?;…\n]+[。！？；!?;…\n]?")
# 硬切时优先找可读断点:中文逗号 / 英文逗号 / 空格。
_SOFT_BREAKS = ("，", ",", " ", "、")


def barge_in_window_ms(segment_duration_ms: int) -> tuple[int, int]:
    """单段音频内可判打断的时间窗(Epoch 相对段首,单位 ms)。

    窗口 = 段尾静默余量 [duration - tail, duration]。段太短(lead+tail 超出时长)
    时按比例收缩,且绝不越过段首 —— 宁可窗口为零,也不把有声区当静默区。
    """
    if segment_duration_ms <= 0:
        return (0, 0)
    lead = min(SEGMENT_LEAD_SILENCE_MS, segment_duration_ms)
    tail = min(SEGMENT_TAIL_SILENCE_MS, max(0, segment_duration_ms - lead))
    return (segment_duration_ms - tail, segment_duration_ms)


def decide_barge_in(
    *,
    playing: bool,
    voiced_ms: int,
    now_ms_into_segment: int,
    segment_duration_ms: int,
) -> bool:
    """当前时刻的人声游程是否构成打断(True = 立即停播并接管发言)。

    参数都是"客户端此刻可观测到的事实":是否在播、连续有声多长、播到本段第几毫秒、
    本段总时长。判据见模块头注三条;任何一条不成立都返回 False(宁可不打断,
    也不在会有声内容上误切)。
    """
    if not playing:
        return False
    if voiced_ms < MIN_VOICED_MS or voiced_ms > now_ms_into_segment:
        return False
    start, end = barge_in_window_ms(segment_duration_ms)
    if end <= 0:
        return False
    run_start = now_ms_into_segment - voiced_ms
    return start <= run_start and now_ms_into_segment <= end


def split_speech_segments(text: str, *, max_chars: int = MAX_SEGMENT_CHARS) -> list[str]:
    """把待朗读文本切成逐段合成的单位(按句读,碎句前并,超长句硬切)。

    纯文本处理,不触网不依赖 edge_tts;空文本返回空列表(调用方据此报 400)。
    """
    raw = re.sub(r"\s+", " ", (text or "").strip())
    if not raw:
        return []

    chunks: list[str] = []
    buf = ""
    for part in _SENTENCE_RE.findall(raw):
        buf += part
        if len(buf) >= MIN_SEGMENT_CHARS:
            chunks.append(buf)
            buf = ""
    if buf:
        # 末尾碎句:并入上一段(单段时自成一段),不单独多付一次 750ms 段间静默
        if chunks:
            chunks[-1] += buf
        else:
            chunks.append(buf)

    wrapped: list[str] = []
    for chunk in chunks:
        wrapped.extend(_wrap_chunk(chunk, max_chars))
    return [c for c in wrapped if c]


def _wrap_chunk(chunk: str, max_chars: int) -> list[str]:
    """超长句按可读断点(逗号/顿号/空格)硬切;找不到就按上限硬切。"""
    out: list[str] = []
    rest = chunk
    while len(rest) > max_chars:
        window = rest[:max_chars]
        cut = max(window.rfind(mark) for mark in _SOFT_BREAKS)
        if cut < MIN_SEGMENT_CHARS:  # 断点太靠前会切出碎段,不如按上限硬切
            cut = max_chars - 1
        out.append(rest[: cut + 1].strip())
        rest = rest[cut + 1 :].strip()
    if rest:
        out.append(rest)
    return out


def policy_payload() -> dict[str, Any]:
    """随 /voice/tts/stream 首帧下发的打断判据(客户端唯一的数字来源)。"""
    return {
        "type": "policy",
        "policy": "silence_gap_only",
        "frameHopMs": FRAME_HOP_MS,
        "minVoicedMs": MIN_VOICED_MS,
        "segmentLeadSilenceMs": SEGMENT_LEAD_SILENCE_MS,
        "segmentTailSilenceMs": SEGMENT_TAIL_SILENCE_MS,
        "segmentGapMs": SEGMENT_GAP_MS,
        "maxSegmentChars": MAX_SEGMENT_CHARS,
        "voicedRmsThreshold": VOICED_RMS_THRESHOLD,
        "source": ".ihui-agent/tmp/d126-evidence-report.md §2.2(2026-10-23 实测)",
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
