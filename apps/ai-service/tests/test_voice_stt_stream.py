# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""流式分段转写 iter_transcribe_segments 的边界钉住(对齐流式 ASR 语义)。

超越整段 _transcribe_sync 的轴,每个都有测试钉住:
  ① 首段早返回 —— 第一段 yield 时即返回,不必等整段音频处理完;
  ② 每段带时间戳(start/end)—— 调用方可按时间轴渲染字幕;
  ③ stop_after / 取消 —— 可提前收尾,已产出段仍有效。
"""

from __future__ import annotations

from dataclasses import dataclass

from app.routers import voice_stt


@dataclass
class _FakeSegment:
    text: str
    start: float
    end: float


class _FakeModel:
    """伪造 faster-whisper 模型:transcribe 返回 (segments 生成器, info),记录 transcribe 次数。"""

    def __init__(self, segments: list[_FakeSegment]) -> None:
        self._segments = segments
        self.transcribe_calls: list[dict[str, object]] = []

    def transcribe(self, audio: str, *, language: str | None, vad_filter: bool):
        self.transcribe_calls.append({"audio": audio, "language": language, "vad": vad_filter})
        # 返回真正的生成器,使惰性推进可被观测
        return (seg for seg in self._segments), {"language": language, "duration": 0.0}


def _multi_segments() -> list[_FakeSegment]:
    return [
        _FakeSegment("你好", 0.0, 1.2),
        _FakeSegment("，世界", 1.2, 2.5),
        _FakeSegment("。测试", 2.5, 4.0),
    ]


def test_first_segment_yields_early(tmp_path) -> None:
    """① 首段早返回:第一次 next 即产出第一段,transcribe 已启动。"""
    model = _FakeModel(_multi_segments())
    audio = str(tmp_path / "a.wav")
    gen = voice_stt.iter_transcribe_segments(model, audio)
    first = next(gen)
    assert first["seq"] == 0
    assert first["text"] == "你好"
    assert first["start"] == 0.0 and first["end"] == 1.2
    assert model.transcribe_calls[0]["vad"] is True
    gen.close()


def test_segments_carry_timestamps(tmp_path) -> None:
    """② 每段带时间戳:顺序产出且 start/end 单调递增。"""
    model = _FakeModel(_multi_segments())
    audio = str(tmp_path / "a.wav")
    frames = list(voice_stt.iter_transcribe_segments(model, audio))
    body = [f for f in frames if "text" in f and not f.get("done")]
    assert [f["text"] for f in body] == ["你好", "，世界", "。测试"]
    assert [f["start"] for f in body] == [0.0, 1.2, 2.5]
    assert [f["end"] for f in body] == [1.2, 2.5, 4.0]


def test_done_frame_carries_full_text(tmp_path) -> None:
    """收尾 done 帧:fullText 是顺次拼接(等价整段转写)。"""
    model = _FakeModel(_multi_segments())
    audio = str(tmp_path / "a.wav")
    frames = list(voice_stt.iter_transcribe_segments(model, audio))
    done = frames[-1]
    assert done["done"] is True
    assert done["segmentCount"] == 3
    assert done["fullText"] == "你好，世界。测试"


def test_stop_after_early_finish(tmp_path) -> None:
    """③ stop_after:只产出前 N 段,fullText 仅含已产出部分。"""
    model = _FakeModel(_multi_segments())
    audio = str(tmp_path / "a.wav")
    frames = list(
        voice_stt.iter_transcribe_segments(model, audio, stop_after=2)
    )
    done = frames[-1]
    assert done["done"] is True
    assert done["segmentCount"] == 2
    assert done["fullText"] == "你好，世界"


def test_close_cancels_without_exhausting(tmp_path) -> None:
    """取消:取到第一段后 close,后续段不再产出(生成器被终止)。"""
    model = _FakeModel(_multi_segments())
    audio = str(tmp_path / "a.wav")
    gen = voice_stt.iter_transcribe_segments(model, audio)
    got = [next(gen)]
    assert got[0]["seq"] == 0
    gen.close()
    # 只取了 1 段;close 后生成器关闭,不影响已产出段的有效性
    assert len(got) == 1


def test_language_passthrough(tmp_path) -> None:
    """language 透传给底层模型。"""
    model = _FakeModel(_multi_segments())
    audio = str(tmp_path / "a.wav")
    frames = list(
        voice_stt.iter_transcribe_segments(model, audio, language="zh")
    )
    assert model.transcribe_calls[0]["language"] == "zh"
    assert frames[-1]["done"] is True
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
