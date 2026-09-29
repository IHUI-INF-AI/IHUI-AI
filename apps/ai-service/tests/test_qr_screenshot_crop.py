# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""二维码截图裁剪判据的单元测试(2026-09-29 立)。

立因:`_update_qr_screenshot` 此前一律 `page.screenshot(full_page=False)`,即截**整个登录页**。
2026-09-29 真机截图实测:知乎那张 1024x720 的画面里二维码不足 200px,手机对着屏幕很难扫上
—— 这是用户说的"扫码登录不好使"里最直觉的一层,和路由通不通无关。

`_pick_qr_clip` 是纯函数,不依赖浏览器:每条正例都配一条"不得误伤"的反例。
"""

from __future__ import annotations

from app.services.scan_login import _QR_ELEMENT_SELECTORS, _pick_qr_clip


def box(x: float, y: float, w: float, h: float) -> dict[str, float]:
    return {"x": x, "y": y, "width": w, "height": h}


def test_正常盒子应裁出带留白的矩形() -> None:
    clip = _pick_qr_clip(box(300, 200, 240, 240), 1024, 720)
    assert clip is not None
    # 默认留白 16px,四边各外扩一次
    assert clip == {"x": 284, "y": 184, "width": 272, "height": 272}


def test_越界时向内收缩而收缩后仍不够大就退回整屏() -> None:
    # 元素大部分在视口外:裁出来的窗不足下限 ⇒ 宁可不裁(截一条边没有意义)
    assert _pick_qr_clip(box(1000, 700, 200, 200), 1024, 720) is None
    # 元素贴右下但仍有足够面积:clip 必须被夹在视口内,不外扩
    clip = _pick_qr_clip(box(800, 560, 200, 200), 1024, 720)
    assert clip is not None
    assert clip["x"] == 784 and clip["y"] == 544
    assert clip["x"] + clip["width"] <= 1024
    assert clip["y"] + clip["height"] <= 720


def test_盒子小于下限一律不裁() -> None:
    # 30px 的"二维码"多半是占位图或图标,截它不如截整页
    assert _pick_qr_clip(box(10, 10, 60, 60), 1024, 720) is None
    assert _pick_qr_clip(box(10, 10, 119, 400), 1024, 720) is None


def test_量不到盒子时退回整屏() -> None:
    assert _pick_qr_clip(None, 1024, 720) is None
    assert _pick_qr_clip({}, 1024, 720) is None
    # 负坐标 = 元素在视口外(滚动出去了),不得裁出一个看不见的窗
    assert _pick_qr_clip(box(-50, 10, 200, 200), 1024, 720) is None


def test_字段类型坏了不抛异常只退回() -> None:
    assert _pick_qr_clip(box(0, 0, "abc", 200), 1024, 720) is None  # type: ignore[arg-type]
    assert _pick_qr_clip({"x": 0, "y": 0, "width": 200}, 1024, 720) is None


def test_裁后仍小于下限也不裁() -> None:
    # 元素在视口角落且大部分在视口外:收缩后可用尺寸不足 ⇒ 退回整屏
    assert _pick_qr_clip(box(1020, 718, 400, 400), 1024, 720) is None


def test_候选表首位必须是语义容器而不是裸_img() -> None:
    """裸 `img` 会先命中站点 logo —— 给用户一张扫不了的图比不给图更糟。"""
    assert _QR_ELEMENT_SELECTORS[0].startswith('[class*="qrcode"')
    assert "img" not in [s for s in _QR_ELEMENT_SELECTORS if s == "img"]
    # 通用位图载体只能排在语义容器之后
    assert _QR_ELEMENT_SELECTORS.index("canvas") > _QR_ELEMENT_SELECTORS.index(
        '[class*="qrcode"] img'
    )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
