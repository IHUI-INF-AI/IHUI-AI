# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠


"""OCR 真识别回归：装了引擎就得**真认得出中文字**，不能只断言"返回了字符串"。

为什么另立文件：`test_sag2_media_ocr.py` 里那条 ``test_装了引擎才跑真识别`` 断言的是
``text is None or isinstance(text, str)`` —— 引擎返回乱码也能过。这里换成带标准答案的
断言：合成一张含金额/人名的中文页，OCR 后要求关键实体至少命中 4 个、CER ≤ 0.15。

阈值取宽（0.15）是有意的：不同引擎（rapidocr / tesseract）与不同字体的 CER 有差异，
本用例要抓的是"完全认不出/返回噪声"这类真故障，不是卡引擎精度。精度读数交给
``scripts/sag2_ocr_probe.py``（多档位 + 多 seed 给区间）。

无引擎 / 无中文字体时 skip —— 如实跳过，绝不伪造成"识别成功"。
"""

from __future__ import annotations

import os

import pytest

from app.services.sag2_lexical import ocr_text

pytestmark = pytest.mark.skipif(
    not ocr_text.ocr_available()["installed"], reason="本机未装 OCR 引擎（可选依赖）"
)

TITLE = "采购付款通知"
BODY = (
    "经审批，向量检索项目第三季度支出 940 万元，",
    "超出年度额度 140 万元，责任人王工。",
    "请于 2026 年 12 月 31 日前提交复盘报告。",
)
REFERENCE = TITLE + "".join(BODY)
KEYWORDS = ("向量检索", "王工", "940", "140", "2026", "复盘")

FONT_CANDIDATES = (
    r"C:\Windows\Fonts\simsun.ttc",
    r"C:\Windows\Fonts\msyh.ttc",
    r"C:\Windows\Fonts\simhei.ttf",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    "/System/Library/Fonts/PingFang.ttc",
)


def _font(size: int):
    from PIL import ImageFont  # noqa: PLC0415 - 只有生成样本的用例需要

    for path in FONT_CANDIDATES:
        if not os.path.exists(path):
            continue
        try:
            return ImageFont.truetype(path, size)
        except Exception:  # noqa: BLE001 - 损坏/不支持就换下一个
            continue
    return None


def _normalize(text: str) -> str:
    return "".join(ch for ch in text if ch.isalnum())


def _levenshtein(a: str, b: str) -> int:
    if len(a) < len(b):
        a, b = b, a
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def _cer(reference: str, hypothesis: str) -> float:
    ref, hyp = _normalize(reference), _normalize(hypothesis)
    if not ref:
        return 1.0
    return _levenshtein(ref, hyp) / len(ref)


def _make_page(path, *, rotate: float = 0.6, noise: float = 5.0):
    """合成一张"轻度扫描"的中文页；字体缺失时返回 False（调用方 skip）。"""
    from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

    title_font = _font(38)
    body_font = _font(28)
    if title_font is None or body_font is None:
        return False
    image = Image.new("L", (1240, 1754), 255)
    draw = ImageDraw.Draw(image)
    draw.text((140, 150), TITLE, font=title_font, fill=0)
    y = 250
    for line in BODY:
        draw.text((140, y), line, font=body_font, fill=0)
        y += 64
    image = image.rotate(rotate, resample=Image.Resampling.BICUBIC, fillcolor=250)
    image = image.filter(ImageFilter.GaussianBlur(0.5))
    try:
        import numpy as np  # noqa: PLC0415 - 仅噪声模拟需要

        array = np.asarray(image, dtype=np.float32)
        array = np.asarray(array + np.random.default_rng(11).normal(0.0, noise, array.shape), dtype=np.float32)
        image = Image.fromarray(np.clip(array, 0, 255).astype(np.uint8), mode="L")
    except ImportError:  # pragma: no cover - numpy 在主依赖里，理论上到不了
        pass
    ImageEnhance.Contrast(image).enhance(0.94).convert("RGB").save(path, dpi=(150, 150))
    return True


def test_真识别_中文扫描件关键实体必须命中(tmp_path) -> None:
    target = tmp_path / "notice.png"
    if not _make_page(target):
        pytest.skip("本机无可用 CJK 字体，无法生成带标准答案的样本")

    text, parser, reason = ocr_text.ocr_image(str(target))
    assert text is not None, f"引擎在位却读不出任何字：parser={parser} reason={reason}"
    assert parser != "none"

    flat = _normalize(text)
    hits = [word for word in KEYWORDS if _normalize(word) in flat]
    assert len(hits) >= 4, f"关键实体只命中 {hits}，OCR 输出前 120 字：{text[:120]}"

    error = _cer(REFERENCE, text)
    assert error <= 0.15, f"CER={error:.4f} 超过 0.15，OCR 输出前 120 字：{text[:120]}"


def test_真识别_扫描件PDF走栅格化链路(tmp_path) -> None:
    page = tmp_path / "page.png"
    if not _make_page(page, rotate=0.8):
        pytest.skip("本机无可用 CJK 字体，无法生成带标准答案的样本")

    from PIL import Image  # noqa: PLC0415 - 只有该用例需要

    pdf = tmp_path / "scan.pdf"
    Image.open(page).save(pdf, resolution=150.0)

    text, parser, reason = ocr_text.ocr_pdf(str(pdf))
    assert text is not None, f"扫描件 PDF 没读出字：parser={parser} reason={reason}"
    assert parser.startswith("pdf+"), f"链路应带栅格化前缀，实际 parser={parser}"
    assert len(_normalize(text)) >= 20
    assert "向量检索" in _normalize(text) or "王工" in _normalize(text)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
