# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""browser_interaction_params 判据钉(复现 Codex 三级交互原语参数边界)。

钉住:鼠标按钮 1-5 枚举(含侧键 back/forward)、duration 0–30s 边界、
拖拽=点列路径(非起止两点)、对话框一等 API 语义。越界即拒不静默夹紧。
全部纯函数入出参断言,零 IO。
"""

import pytest

from app.services.browser_interaction_params import (
    DIALOG_ALERT,
    DIALOG_CONFIRM,
    DIALOG_PROMPT,
    InteractionParamError,
    normalize_click_params,
    normalize_drag_params,
    validate_dialog_disposition,
)

# ── 鼠标按钮枚举 ─────────────────────────────────────────────────────────

def test_mouse_button_mapping_includes_side_buttons():
    """1-5 枚举含侧键 4-back / 5-forward。"""
    assert normalize_click_params({"x": 10, "y": 20, "button": 1}).button == "left"
    assert normalize_click_params({"x": 10, "y": 20, "button": 2}).button == "middle"
    assert normalize_click_params({"x": 10, "y": 20, "button": 3}).button == "right"
    assert normalize_click_params({"x": 10, "y": 20, "button": 4}).button == "back"
    assert normalize_click_params({"x": 10, "y": 20, "button": 5}).button == "forward"


def test_invalid_mouse_button_rejected():
    """越界按钮(0/6/字符串)即拒,不夹紧。"""
    for bad in (0, 6, -1, "left"):
        with pytest.raises(InteractionParamError):
            normalize_click_params({"x": 10, "y": 20, "button": bad})


# ── duration 边界 ─────────────────────────────────────────────────────────

def test_duration_zero_to_thirty_accepted():
    """duration 0–30s 合法(0=普通点击,>0=长按)。"""
    assert normalize_click_params({"x": 1, "y": 2, "duration": 0}).duration_s == 0.0
    assert normalize_click_params({"x": 1, "y": 2, "duration": 1.5}).duration_s == 1.5
    assert normalize_click_params({"x": 1, "y": 2, "duration": 30}).duration_s == 30.0


def test_duration_out_of_range_rejected():
    """负数 / 超 30s 即拒。"""
    for bad in (-0.1, 30.1, 100):
        with pytest.raises(InteractionParamError):
            normalize_click_params({"x": 1, "y": 2, "duration": bad})


def test_missing_xy_rejected():
    """缺 x/y / 非数值即拒。"""
    with pytest.raises(InteractionParamError):
        normalize_click_params({"y": 2})
    with pytest.raises(InteractionParamError):
        normalize_click_params({"x": "left", "y": 2})


def test_keypress_normalized():
    """keypress 归一为字符串元组。"""
    params = normalize_click_params({"x": 1, "y": 2, "keypress": ["shift", "a"]})
    assert params.keypress == ("shift", "a")
    single = normalize_click_params({"x": 1, "y": 2, "keypress": "super"})
    assert single.keypress == ("super",)


# ── 拖拽 = 点列路径 ───────────────────────────────────────────────────────

def test_drag_path_min_two_points():
    """path 至少 2 点;单点/缺失即拒。"""
    ok = normalize_drag_params(
        {"path": [{"x": 0, "y": 0}, {"x": 50, "y": 50}, {"x": 100, "y": 20}]}
    )
    assert ok.path == ((0, 0), (50, 50), (100, 20))
    assert ok.button == "left"
    with pytest.raises(InteractionParamError):
        normalize_drag_params({"path": [{"x": 0, "y": 0}]})
    with pytest.raises(InteractionParamError):
        normalize_drag_params({})


def test_drag_supports_curved_path():
    """拖拽支持曲线(多点路径,非起止两点)。"""
    curve = normalize_drag_params(
        {
            "path": [
                {"x": 0, "y": 0},
                {"x": 25, "y": 40},
                {"x": 50, "y": 30},
                {"x": 80, "y": 60},
            ]
        }
    )
    assert len(curve.path) == 4


# ── 对话框一等 API ────────────────────────────────────────────────────────

def test_alert_has_no_text_field():
    """alert 只有 OK,无输入字段;不接受 prompt_text。"""
    d = validate_dialog_disposition(DIALOG_ALERT, accepted=True)
    assert d.accepted is True
    with pytest.raises(InteractionParamError):
        validate_dialog_disposition(DIALOG_ALERT, accepted=True, prompt_text="hi")


def test_prompt_accepts_text():
    """prompt 有输入字段,可带 prompt_text。"""
    d = validate_dialog_disposition(DIALOG_PROMPT, accepted=True, prompt_text="my answer")
    assert d.prompt_text == "my answer"


def test_confirm_dismiss_semantics():
    """confirm 可 accept(True) / dismiss(False)。"""
    ok = validate_dialog_disposition(DIALOG_CONFIRM, accepted=True)
    cancel = validate_dialog_disposition(DIALOG_CONFIRM, accepted=False)
    assert ok.accepted is True
    assert cancel.accepted is False


def test_unknown_dialog_type_rejected():
    """未知对话框类型即拒。"""
    with pytest.raises(InteractionParamError):
        validate_dialog_disposition("toast", accepted=True)
