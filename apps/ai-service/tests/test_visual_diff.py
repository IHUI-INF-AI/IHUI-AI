# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""视觉像素比对(遵循统一工程规范)行为钉子。

钉行为不钉实现:可判定(changed 驱动动作是否生效分支)/ 抗噪(亚像素噪声不算变更)/
可定位(bbox + hotspot 给变更聚类)。逐项做反向变异:改条件应翻转结论。
"""

from __future__ import annotations

import hashlib

from PIL import Image, ImageDraw

from app.core.visual_diff import DiffConfig, compare_visual


def _frame(color, box=None):
    im = Image.new("RGB", (200, 120), color)
    if box is not None:
        ImageDraw.Draw(im).rectangle(box, fill=(255, 0, 0))
    return im


def _identical():
    a = _frame((255, 255, 255))
    return compare_visual(a, a.copy())


def _click_change():
    return compare_visual(
        _frame((255, 255, 255)),
        _frame((255, 255, 255), (50, 50, 90, 80)),
    )


def _size_change():
    return compare_visual(
        _frame((0, 0, 0)),
        Image.new("RGB", (300, 300), (0, 0, 0)),
    )


def _subpixel_noise():
    base = _frame((100, 100, 100))
    noisy = base.copy()
    for x in range(0, 200, 3):
        for y in range(0, 120, 3):
            noisy.putpixel((x, y), (105, 105, 105))  # +5/通道,远低于 threshold=25
    return compare_visual(base, noisy)


# ---- 1. 可判定 ----


def test_identical_frames_report_no_change():
    r = _identical()
    assert r.changed is False
    assert r.change_ratio == 0.0
    assert r.changed_pixels == 0
    assert r.bbox is None
    assert r.hotspots == []


def test_click_change_reports_changed_with_ratio():
    r = _click_change()
    assert r.changed is True
    assert 0 < r.change_ratio < 0.2  # 局部小区域变更
    assert r.changed_pixels > 0


def test_size_mismatch_is_structural_change():
    r = _size_change()
    assert r.changed is True
    assert r.change_ratio == 1.0
    assert r.bbox == {"x": 0, "y": 0, "width": 300, "height": 300}


# ---- 2. 抗噪 ----


def test_subpixel_noise_below_threshold_not_changed():
    r = _subpixel_noise()
    assert r.changed is False, f"亚像素噪声被误判为变更: {r.as_dict()}"


def test_raising_threshold_suppresses_marginal_change():
    before = _frame((255, 255, 255))
    after = _frame((255, 255, 255), (0, 0, 200, 120))  # 大半图变红
    strict = compare_visual(before, after, DiffConfig(threshold=240))
    loose = compare_visual(before, after, DiffConfig(threshold=10))
    assert loose.changed is True
    # 极高阈值下,纯红(255,0,0) vs 白(255,255,255)的灰度差可能被压掉
    assert strict.change_ratio <= loose.change_ratio


# ---- 3. 可定位 ----


def test_hotspot_localizes_change_region():
    r = _click_change()
    assert r.hotspots, "有变更但无 hotspot"
    top = r.hotspots[0]
    assert top.changed_pixels > 0
    assert r.bbox is not None
    # bbox 应覆盖变更区(点击框 50,50-90,80)
    assert r.bbox["x"] <= 50 and r.bbox["y"] <= 50


# ---- 4. 纯函数无副作用 ----


def test_inputs_not_mutated():
    a = _frame((255, 255, 255))
    b = _frame((255, 255, 255), (0, 0, 10, 10))
    h = hashlib.md5(a.tobytes()).hexdigest()
    compare_visual(a, b)
    assert hashlib.md5(a.tobytes()).hexdigest() == h, "输入帧被修改"


# ---- 反向变异 ----


def test_zero_ratio_floor_flags_any_change():
    # 反向:把 ratio_floor 降到 0,孤立单像素变更也应判 changed=True
    before = _frame((255, 255, 255))
    after = _frame((255, 255, 255))
    after.putpixel((100, 60), (0, 0, 0))  # 单像素
    cfg = DiffConfig(ratio_floor=0.0)
    r = compare_visual(before, after, cfg)
    assert r.changed is True, "ratio_floor=0 时单像素变更应算 changed"
    assert r.changed_pixels == 1


def test_default_floor_requires_meaningful_change():
    # 正向:默认 ratio_floor 下,单像素噪声不算 changed(与上一条构成反向对)
    before = _frame((255, 255, 255))
    after = _frame((255, 255, 255))
    after.putpixel((100, 60), (0, 0, 0))
    r = compare_visual(before, after)  # 默认 config
    assert r.changed is False, "默认 ratio_floor 下单像素不应算显著变更"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
