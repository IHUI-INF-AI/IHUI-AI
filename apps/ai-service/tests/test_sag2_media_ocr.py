# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""音视频转写（media_text）与图片 OCR（ocr_text）真测试。

判据：能读的必须真读到文本，读不到的必须给出**具名原因**，不许返回空字符串
伪装成"读到了"。STT 模型（483MB）不在测试里下载 —— 用注入的假模型验证管道
（真模型那一段属于部署期验证），OCR 引擎同理只在装了才跑真识别。
"""

from __future__ import annotations

import sys

import pytest

from app.services.sag2_lexical import folder_ingest as fi
from app.services.sag2_lexical import media_text, ocr_text

# ---------------------------------------------------------------------------
# 音视频
# ---------------------------------------------------------------------------


class _FakeSegment:
    def __init__(self, text: str) -> None:
        self.text = text


class _FakeModel:
    def __init__(self, segments: list[_FakeSegment]) -> None:
        self._segments = segments
        self.calls: list[tuple[str, object]] = []

    def transcribe(self, path: str, language: object = None, vad_filter: bool = True):
        self.calls.append((path, language))
        return iter(self._segments), {"language": "zh"}


def test_非音视频后缀直接拒(tmp_path) -> None:
    target = tmp_path / "a.txt"
    target.write_text("x", encoding="utf-8")
    text, parser, reason = media_text.transcribe_media(str(target))
    assert text is None and parser == "none"
    assert reason.startswith("unsupported:")


def test_模型不可用时给具名原因而不是空文本(tmp_path, monkeypatch) -> None:
    target = tmp_path / "会议.mp3"
    target.write_bytes(b"\x00" * 32)
    monkeypatch.setattr(media_text, "_load_engine", lambda: (None, "asr-unavailable:OSError"))
    text, parser, reason = media_text.transcribe_media(str(target))
    assert (text, parser) == (None, "none")
    assert reason == "asr-unavailable:OSError"


def test_真管道_假模型转写并按语言自动判定(tmp_path, monkeypatch) -> None:
    target = tmp_path / "周会.m4a"
    target.write_bytes(b"\x00" * 32)
    model = _FakeModel([_FakeSegment("这季度预算要重新审一遍"), _FakeSegment("英文术语 ROI")])
    monkeypatch.setattr(media_text, "_load_engine", lambda: (model, ""))
    # 复用路由里的真实拼接实现（不重写一份），只把模型换成假的。
    text, parser, reason = media_text.transcribe_media(str(target))
    assert parser == "faster-whisper"
    assert reason == ""
    assert text == "这季度预算要重新审一遍英文术语 ROI"
    assert model.calls == [(str(target), None)]


def test_纯静音转写为空时不算成功(tmp_path, monkeypatch) -> None:
    target = tmp_path / "静音.wav"
    target.write_bytes(b"\x00" * 32)
    monkeypatch.setattr(media_text, "_load_engine", lambda: (_FakeModel([_FakeSegment("   ")]), ""))
    text, parser, reason = media_text.transcribe_media(str(target))
    assert (text, parser, reason) == (None, "none", "empty")


def test_超过体积上限不做ASR(tmp_path) -> None:
    target = tmp_path / "超大.mp4"
    target.write_bytes(b"\x00" * 16)
    original = media_text.MAX_MEDIA_BYTES
    media_text.MAX_MEDIA_BYTES = 4
    try:
        text, _parser, reason = media_text.transcribe_media(str(target))
    finally:
        media_text.MAX_MEDIA_BYTES = original
    assert text is None and reason.startswith("too-large-for-asr:")


def test_asr_探测只报事实(tmp_path) -> None:
    info = media_text.asr_available()
    assert info["engine"] == "faster-whisper"
    assert ".mp3" in info["suffixes"]
    assert isinstance(info["installed"], bool)


# ---------------------------------------------------------------------------
# OCR
# ---------------------------------------------------------------------------


class _FakeTesseract:
    class pytesseract:  # noqa: N801 - 模仿真实模块的属性布局
        tesseract_cmd = "/usr/bin/tesseract"

    def __init__(self, text: str = "", error: Exception | None = None) -> None:
        self.text = text
        self.error = error
        self.calls: list[str] = []

    def image_to_string(self, path: str, lang: str = "") -> str:
        self.calls.append(lang)
        if self.error is not None:
            raise self.error
        return self.text

    def get_languages(self, config: str = "") -> list[str]:
        return ["chi_sim", "eng"]


def test_非图片后缀不做OCR(tmp_path) -> None:
    target = tmp_path / "a.md"
    target.write_text("x", encoding="utf-8")
    text, parser, reason = ocr_text.ocr_image(str(target))
    assert text is None and parser == "none"
    assert reason.startswith("unsupported:")


def test_缺pytesseract时具名缺件(tmp_path, monkeypatch) -> None:
    target = tmp_path / "截图.png"
    target.write_bytes(b"\x89PNG\r\n\x1a\n")
    monkeypatch.setitem(sys.modules, "pytesseract", None)
    text, parser, reason = ocr_text.ocr_image(str(target))
    assert (text, parser) == (None, "none")
    assert reason == "missing-dep:pytesseract"


def test_真识别路径_引擎返回文本即采用(tmp_path, monkeypatch) -> None:
    target = tmp_path / "发票.png"
    target.write_bytes(b"\x89PNG\r\n\x1a\n")
    fake = _FakeTesseract("发票号 12345 金额 2000 元")
    monkeypatch.setitem(sys.modules, "pytesseract", fake)
    text, parser, reason = ocr_text.ocr_image(str(target))
    assert parser == "tesseract"
    assert reason == ""
    assert "2000" in str(text)
    assert fake.calls == ["chi_sim+eng"]


def test_识别结果过短判为empty而不是当正文(tmp_path, monkeypatch) -> None:
    target = tmp_path / "噪声.png"
    target.write_bytes(b"\x89PNG\r\n\x1a\n")
    monkeypatch.setitem(sys.modules, "pytesseract", _FakeTesseract("   "))
    text, parser, reason = ocr_text.ocr_image(str(target))
    assert (text, parser, reason) == (None, "none", "empty")


def test_缺tesseract二进制时具名缺件(tmp_path, monkeypatch) -> None:
    target = tmp_path / "图.png"
    target.write_bytes(b"\x89PNG\r\n\x1a\n")
    err = RuntimeError("tesseract is not installed or it's not in your PATH")
    monkeypatch.setitem(sys.modules, "pytesseract", _FakeTesseract(error=err))
    text, _parser, reason = ocr_text.ocr_image(str(target))
    assert text is None
    assert reason == "missing-binary:tesseract"


def test_缺中文语言包时回落英文并写明回落事实(tmp_path, monkeypatch) -> None:
    target = tmp_path / "中文图.png"
    target.write_bytes(b"\x89PNG\r\n\x1a\n")

    class _Fallback(_FakeTesseract):
        def image_to_string(self, path: str, lang: str = "") -> str:
            self.calls.append(lang)
            if lang != "eng":
                raise RuntimeError("Failed loading language 'chi_sim'")
            return "invoice number 12345 amount 2000"

    fake = _Fallback()
    monkeypatch.setitem(sys.modules, "pytesseract", fake)
    text, parser, reason = ocr_text.ocr_image(str(target))
    assert parser == "tesseract-eng-only"
    assert reason == "fallback-lang:eng"
    assert "12345" in str(text)
    assert fake.calls == ["chi_sim+eng", "eng"]


def test_扫描版PDF如实报缺栅格化器() -> None:
    text, parser, reason = ocr_text.ocr_pdf("whatever.pdf")
    assert text is None and parser == "none"
    assert reason.startswith("needs-rasterizer:pdf")


def test_ocr_探测字段齐备() -> None:
    info = ocr_text.ocr_available()
    assert info["engine"] == "tesseract"
    assert ".png" in info["image_suffixes"]
    assert info["pdf_rasterizer"] == "unavailable"


# ---------------------------------------------------------------------------
# 与 extract_text 的接线
# ---------------------------------------------------------------------------


def test_extract_text_图片走OCR_缺件原因逐字保留(tmp_path, monkeypatch) -> None:
    target = tmp_path / "证据.png"
    target.write_bytes(b"\x89PNG\r\n\x1a\n")
    monkeypatch.setitem(sys.modules, "pytesseract", None)
    text, parser, reason = fi.extract_text(str(target))
    assert (text, parser) == (None, "none")
    assert reason == "missing-dep:pytesseract"


def test_extract_text_音视频走转写(tmp_path, monkeypatch) -> None:
    target = tmp_path / "访谈.ogg"
    target.write_bytes(b"\x00" * 16)
    monkeypatch.setattr(media_text, "_load_engine", lambda: (_FakeModel([_FakeSegment("录音内容")]), ""))
    text, parser, reason = fi.extract_text(str(target))
    assert (parser, reason) == ("faster-whisper", "")
    assert text == "录音内容"


def test_extract_text_扫描件PDF带needs_ocr标记(tmp_path, monkeypatch) -> None:
    target = tmp_path / "扫描件.pdf"
    target.write_bytes(b"%PDF-1.4\n%%EOF\n")
    text, parser, reason = fi.extract_text(str(target))
    assert (text, parser) == (None, "none")
    assert "needs-ocr:pdf" in reason


@pytest.mark.skipif(
    not ocr_text.ocr_available()["installed"], reason="本机未装 pytesseract"
)
def test_装了引擎才跑真识别(monkeypatch, tmp_path) -> None:
    # 本机没有 pytesseract 时这条自动跳过，绝不伪造"识别成功"。
    from PIL import Image  # noqa: PLC0415 - 仅该用例需要

    target = tmp_path / "白板.png"
    Image.new("RGB", (40, 20), "white").save(target)
    text, _parser, reason = ocr_text.ocr_image(str(target))
    assert text is None or isinstance(text, str)
    assert reason == "" or reason.startswith("empty")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
