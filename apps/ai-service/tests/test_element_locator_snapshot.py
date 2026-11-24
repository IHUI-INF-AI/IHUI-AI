# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""element_locator_snapshot 判据钉(统一实现 ElementInfo 统一元素快照)。

钉住:多候选降级(primary 置首 + candidates 补齐去重)、frame 路径解析、
各种入参形状归一(裸串/IHUI 单 selector/Codex candidates/嵌套对象)、
语义字段(visibleText/ariaName/role)。全部纯函数入出参断言,零 IO。
"""

from app.services.element_locator_snapshot import (
    FRAME_SEPARATOR,
    normalize_element_target,
    resolve_selector_candidates,
)


def test_bare_selector_string():
    """裸 selector 字符串 → 单候选 + primary。"""
    snap = normalize_element_target("#submit-btn")
    assert snap is not None
    assert snap.selector.primary == "#submit-btn"
    assert snap.selector.ordered == ("#submit-btn",)
    assert snap.has_fallback is False


def test_ihui_single_selector_dict_zero_regression():
    """IHUI 既有形状 {"selector": "css"} 归一,不回归。"""
    snap = normalize_element_target({"selector": "button.login"})
    assert snap is not None
    assert snap.selector.ordered == ("button.login",)


def test_candidates_with_primary_ordered_first():
    """Codex candidates + primary:primary 置首,其余按序,去重。"""
    snap = normalize_element_target(
        {
            "selector": {
                "candidates": ["#a", ".b", "#a", "text=Login"],
                "primary": ".b",
            }
        }
    )
    assert snap is not None
    # primary(".b") 置首,其余按 candidates 顺序("#a" 先),重复 "#a" 去重
    assert snap.selector.ordered == (".b", "#a", "text=Login")
    assert snap.has_fallback is True


def test_candidates_without_primary_uses_list_order():
    """无 primary 时按 candidates 原序,首元素即首选。"""
    snap = normalize_element_target(
        {"selector": {"candidates": ["#x", "#y", "#z"]}}
    )
    assert snap is not None
    assert snap.selector.ordered == ("#x", "#y", "#z")


def test_frame_selectors_parsed():
    """frameSelectors 跨 frame 路径保留。"""
    snap = normalize_element_target(
        {
            "selector": {
                "candidates": ["#inner"],
                "frameSelectors": ["iframe#main", "iframe.panel"],
            }
        }
    )
    assert snap is not None
    assert snap.selector.frame_selectors == ("iframe#main", "iframe.panel")
    assert snap.selector.ordered == ("#inner",)


def test_frame_path_in_string_splits():
    """裸串含 >> 分隔符拆成 frame 路径 + 末段 primary。"""
    snap = normalize_element_target(f"iframe#main{FRAME_SEPARATOR}#inner")
    assert snap is not None
    assert snap.selector.frame_selectors == ("iframe#main",)
    assert snap.selector.primary == "#inner"


def test_coda_top_level_candidates_shape():
    """Codex 顶层直接带 candidates/primary(无 selector 包裹)也能归一。"""
    snap = normalize_element_target(
        {"candidates": [".p", ".q"], "primary": ".q", "frameSelectors": ["f1"]}
    )
    assert snap is not None
    assert snap.selector.ordered == (".q", ".p")
    assert snap.selector.frame_selectors == ("f1",)


def test_semantic_fields_normalized():
    """语义字段 visibleText/ariaName/role/tag_name 归一,空串→None。"""
    snap = normalize_element_target(
        {
            "selector": {"candidates": ["#b"]},
            "visibleText": "Sign in",
            "aria_name": "Sign in",
            "role": "button",
            "tag_name": "button",
            "test_id": "login-btn",
        }
    )
    assert snap is not None
    assert snap.visible_text == "Sign in"
    assert snap.aria_name == "Sign in"
    assert snap.role == "button"
    assert snap.tag_name == "button"
    assert snap.test_id == "login-btn"


def test_empty_strings_become_none():
    """空串语义字段归一为 None,不留空串。"""
    snap = normalize_element_target(
        {"selector": "#b", "visibleText": "  ", "ariaName": ""}
    )
    assert snap is not None
    assert snap.visible_text is None
    assert snap.aria_name is None


def test_no_locatable_info_returns_none():
    """无任何可定位信息 → None(调用方回退坐标等其他目标形态)。"""
    assert normalize_element_target(None) is None
    assert normalize_element_target("") is None
    assert normalize_element_target({"visibleText": "only text, no selector"}) is None
    assert normalize_element_target(12345) is None


def test_resolve_candidates_helper():
    """resolve_selector_candidates 快捷入口:返回有序候选,无定位返回空。"""
    assert resolve_selector_candidates({"selector": {"candidates": ["#a", "#b"], "primary": "#b"}}) == (
        "#b",
        "#a",
    )
    assert resolve_selector_candidates(None) == ()


def test_candidates_dedup_and_blank_filtered():
    """candidates 去重 + 丢弃空串。"""
    snap = normalize_element_target(
        {"selector": {"candidates": ["#a", "  ", "#a", "#b"]}}
    )
    assert snap is not None
    assert snap.selector.ordered == ("#a", "#b")
