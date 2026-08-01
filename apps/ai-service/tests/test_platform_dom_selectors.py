"""platform_dom_selectors.py 单元测试:平台发布页 DOM 选择器维护表。

测试覆盖:
- PlatformDomSelectors dataclass 构造与默认值
- PLATFORM_SELECTORS 字典结构完整性(38 平台 / key 与 platform 字段一致 / 选择器格式合法)
- get_selectors:已知平台返回对象 / 未知平台返回 None
- list_platforms_with_selectors:返回所有 key 列表
- _get_selector_value:主选择器 / 候选列表 / 主为空时只返回候选 / 去重
- verify_selector:平台未配置 / page 为 None / page 无 query_selector / 候选为空 /
  主选择器命中 / fallback 命中(idx>0)/ 全部失效 / query_selector 抛异常
- verify_all_selectors:平台未配置返回空 dict / 仅含已配置字段
- list_outdated_selectors:阈值边界 / 负数抛 ValueError / 未验证视为过期 / 无效日期
- list_unverified_selectors:last_verified 为空
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any
from unittest.mock import MagicMock

import pytest

from app.services.publish.platform_dom_selectors import (
    PLATFORM_SELECTORS,
    PlatformDomSelectors,
    _get_selector_value,
    get_selectors,
    list_outdated_selectors,
    list_platforms_with_selectors,
    list_unverified_selectors,
    verify_all_selectors,
    verify_selector,
)


# =============================================================================
# 1. PlatformDomSelectors dataclass 构造与默认值
# =============================================================================


class TestPlatformDomSelectorsDataclass:
    """PlatformDomSelectors 字段构造与默认值。"""

    def test_full_construction(self) -> None:
        """所有字段显式构造。"""
        s = PlatformDomSelectors(
            platform="wechat",
            login_url="https://mp.weixin.qq.com/",
            publish_url="https://mp.weixin.qq.com/cgi-bin/appmsg",
            title_input="#title",
            content_editor="#ueditor_0",
            cover_upload=".js_cover_area",
            video_upload="input[type=file]",
            tag_input=".js_tag_input",
            category_select=".category",
            original_checkbox="#original",
            submit_button=".js_send",
            selector_version="2026.07.31",
            last_verified="2026-07-31",
            fallback_selectors={"title_input": ["#title2"]},
        )
        assert s.platform == "wechat"
        assert s.login_url == "https://mp.weixin.qq.com/"
        assert s.title_input == "#title"
        assert s.fallback_selectors == {"title_input": ["#title2"]}

    def test_default_values_only_platform_required(self) -> None:
        """仅 platform 必填,其他字段有默认值。"""
        s = PlatformDomSelectors(platform="test")
        assert s.platform == "test"
        assert s.login_url == ""
        assert s.publish_url == ""
        assert s.title_input == ""
        assert s.content_editor == ""
        assert s.cover_upload == ""
        assert s.video_upload == ""
        assert s.tag_input == ""
        assert s.category_select == ""
        assert s.original_checkbox == ""
        assert s.submit_button == ""
        assert s.selector_version == "2026.07.31"
        assert s.last_verified == "2026-07-31"
        assert s.fallback_selectors == {}

    def test_fallback_selectors_default_is_empty_dict(self) -> None:
        """fallback_selectors 默认为空 dict(每个实例独立)。"""
        s1 = PlatformDomSelectors(platform="a")
        s2 = PlatformDomSelectors(platform="b")
        s1.fallback_selectors["x"] = ["y"]
        assert s2.fallback_selectors == {}  # 不共享


# =============================================================================
# 2. PLATFORM_SELECTORS 字典结构完整性
# =============================================================================


class TestPlatformSelectorsDict:
    """PLATFORM_SELECTORS 模块级字典的结构完整性。"""

    def test_dict_is_non_empty(self) -> None:
        """PLATFORM_SELECTORS 不应为空。"""
        assert len(PLATFORM_SELECTORS) > 0

    def test_dict_contains_at_least_38_platforms(self) -> None:
        """应包含至少 38 个平台(任务文档要求)。"""
        assert len(PLATFORM_SELECTORS) >= 38

    def test_key_matches_platform_field(self) -> None:
        """每个 entry 的 key 应与其 platform 字段一致。"""
        for key, selectors in PLATFORM_SELECTORS.items():
            assert selectors.platform == key, (
                f"key {key!r} 与 platform 字段 {selectors.platform!r} 不一致"
            )

    def test_all_selector_strings_are_str(self) -> None:
        """所有选择器字段应为 str 类型(允许空串)。"""
        str_fields = (
            "login_url", "publish_url", "title_input", "content_editor",
            "cover_upload", "video_upload", "tag_input", "category_select",
            "original_checkbox", "submit_button", "selector_version",
            "last_verified",
        )
        for platform, s in PLATFORM_SELECTORS.items():
            for field_name in str_fields:
                v = getattr(s, field_name)
                assert isinstance(v, str), (
                    f"{platform}.{field_name} 应为 str,实际 {type(v).__name__}"
                )

    def test_fallback_selectors_is_dict_of_list_of_str(self) -> None:
        """fallback_selectors 应为 dict[str, list[str]]。"""
        for platform, s in PLATFORM_SELECTORS.items():
            assert isinstance(s.fallback_selectors, dict)
            for k, v in s.fallback_selectors.items():
                assert isinstance(k, str)
                assert isinstance(v, list)
                for item in v:
                    assert isinstance(item, str)

    def test_known_platforms_present(self) -> None:
        """核心平台应在表中。"""
        required = {"wordpress", "medium", "youtube", "bilibili", "wechat", "zhihu", "csdn"}
        keys = set(PLATFORM_SELECTORS.keys())
        missing = required - keys
        assert not missing, f"缺失核心平台: {missing}"

    def test_last_verified_format_is_iso_date(self) -> None:
        """last_verified 应为 YYYY-MM-DD 格式或空串。"""
        for platform, s in PLATFORM_SELECTORS.items():
            if not s.last_verified:
                continue
            try:
                datetime.strptime(s.last_verified, "%Y-%m-%d")
            except ValueError as e:
                pytest.fail(f"{platform}.last_verified 格式无效: {s.last_verified!r} ({e})")


# =============================================================================
# 3. get_selectors
# =============================================================================


class TestGetSelectors:
    """get_selectors 查询接口。"""

    def test_known_platform_returns_object(self) -> None:
        """已知平台返回 PlatformDomSelectors。"""
        result = get_selectors("wechat")
        assert result is not None
        assert isinstance(result, PlatformDomSelectors)
        assert result.platform == "wechat"

    def test_unknown_platform_returns_none(self) -> None:
        """未知平台返回 None。"""
        assert get_selectors("nonexistent_platform_xyz") is None

    def test_empty_string_returns_none(self) -> None:
        """空串返回 None。"""
        assert get_selectors("") is None

    def test_case_sensitive(self) -> None:
        """查询大小写敏感(WECHAT ≠ wechat)。"""
        assert get_selectors("WECHAT") is None
        assert get_selectors("wechat") is not None


# =============================================================================
# 4. list_platforms_with_selectors
# =============================================================================


class TestListPlatformsWithSelectors:
    """list_platforms_with_selectors 返回所有平台 ID 列表。"""

    def test_returns_list_of_str(self) -> None:
        """返回值为 list[str]。"""
        result = list_platforms_with_selectors()
        assert isinstance(result, list)
        for p in result:
            assert isinstance(p, str)

    def test_length_matches_dict(self) -> None:
        """长度应等于 PLATFORM_SELECTORS。"""
        assert len(list_platforms_with_selectors()) == len(PLATFORM_SELECTORS)

    def test_contains_known_platforms(self) -> None:
        """应包含已知平台。"""
        result = set(list_platforms_with_selectors())
        assert "wechat" in result
        assert "bilibili" in result


# =============================================================================
# 5. _get_selector_value
# =============================================================================


class TestGetSelectorValue:
    """_get_selector_value 取主选择器 + 候选列表。"""

    def test_main_value_with_fallbacks(self) -> None:
        """主选择器非空 + 有 fallback → 候选列表 = [主, *fallbacks]。"""
        s = PlatformDomSelectors(
            platform="t",
            title_input="#main",
            fallback_selectors={"title_input": ["#fb1", "#fb2"]},
        )
        main, candidates = _get_selector_value(s, "title_input")
        assert main == "#main"
        assert candidates == ["#main", "#fb1", "#fb2"]

    def test_main_empty_with_fallbacks(self) -> None:
        """主选择器为空 + 有 fallback → 候选列表仅含 fallbacks。"""
        s = PlatformDomSelectors(
            platform="t",
            title_input="",
            fallback_selectors={"title_input": ["#fb1", "#fb2"]},
        )
        main, candidates = _get_selector_value(s, "title_input")
        assert main == ""
        assert candidates == ["#fb1", "#fb2"]

    def test_main_value_no_fallbacks(self) -> None:
        """主选择器非空 + 无 fallback → 候选列表仅含主。"""
        s = PlatformDomSelectors(platform="t", title_input="#main")
        main, candidates = _get_selector_value(s, "title_input")
        assert main == "#main"
        assert candidates == ["#main"]

    def test_both_empty_returns_empty_candidates(self) -> None:
        """主选择器为空 + 无 fallback → 候选列表为空。"""
        s = PlatformDomSelectors(platform="t", title_input="")
        main, candidates = _get_selector_value(s, "title_input")
        assert main == ""
        assert candidates == []

    def test_dedup_when_fallback_equals_main(self) -> None:
        """fallback 与主相同时去重。"""
        s = PlatformDomSelectors(
            platform="t",
            title_input="#main",
            fallback_selectors={"title_input": ["#main", "#fb1"]},
        )
        _, candidates = _get_selector_value(s, "title_input")
        assert candidates == ["#main", "#fb1"]

    def test_empty_string_fallbacks_filtered(self) -> None:
        """fallback 列表中的空串应被过滤。"""
        s = PlatformDomSelectors(
            platform="t",
            title_input="#main",
            fallback_selectors={"title_input": ["", "#fb1", ""]},
        )
        _, candidates = _get_selector_value(s, "title_input")
        assert candidates == ["#main", "#fb1"]

    def test_nonexistent_field_returns_empty(self) -> None:
        """字段不存在时返回 ('', [])。"""
        s = PlatformDomSelectors(platform="t", title_input="#main")
        main, candidates = _get_selector_value(s, "nonexistent_field")
        assert main == ""
        assert candidates == []


# =============================================================================
# 6. verify_selector
# =============================================================================


class TestVerifySelector:
    """verify_selector 运行时验证单选择器。"""

    def test_unknown_platform_returns_false(self) -> None:
        """平台未配置 → False。"""
        page = MagicMock()
        assert verify_selector("nonexistent_xyz", "title_input", page) is False

    def test_none_page_returns_false(self) -> None:
        """page 为 None → False。"""
        assert verify_selector("wechat", "title_input", None) is False

    def test_page_without_query_selector_returns_false(self) -> None:
        """page 无 query_selector 方法 → False。"""
        page = MagicMock(spec=[])  # 空接口
        assert verify_selector("wechat", "title_input", page) is False

    def test_no_candidates_returns_false(self) -> None:
        """主+候选均为空 → False。

        用一个真实的 PLATFORM_SELECTORS 中字段为空且无 fallback 的平台/字段。
        """
        # 找一个 original_checkbox 为空且无 fallback 的平台
        target_platform = None
        for p, s in PLATFORM_SELECTORS.items():
            if not s.original_checkbox and not s.fallback_selectors.get("original_checkbox"):
                target_platform = p
                break
        if target_platform is None:
            pytest.skip("所有平台都有 original_checkbox 或 fallback,无法测试空候选路径")
        page = MagicMock()
        page.query_selector.return_value = None
        assert verify_selector(target_platform, "original_checkbox", page) is False

    def test_main_selector_hits_returns_true(self) -> None:
        """主选择器命中 → True。"""
        page = MagicMock()
        page.query_selector.return_value = MagicMock()
        # 用 wechat.title_input(主选择器非空)
        assert verify_selector("wechat", "title_input", page) is True
        # 应调用 query_selector 一次(主选择器命中即返回)
        page.query_selector.assert_called_once()

    def test_fallback_selector_hits_returns_true(self) -> None:
        """主选择器失效 + fallback 命中 → True。

        构造一个 mock PlatformDomSelectors 并注入到 PLATFORM_SELECTORS。
        """
        from app.services.publish import platform_dom_selectors as mod

        fake = PlatformDomSelectors(
            platform="__test_fake__",
            title_input="#main",
            fallback_selectors={"title_input": ["#fb1", "#fb2"]},
        )
        original = mod.PLATFORM_SELECTORS.get("__test_fake__")
        mod.PLATFORM_SELECTORS["__test_fake__"] = fake
        try:
            page = MagicMock()
            # 第一次(主)返回 None,第二次(fallback1)返回元素
            page.query_selector.side_effect = [None, MagicMock()]
            assert verify_selector("__test_fake__", "title_input", page) is True
            assert page.query_selector.call_count == 2
        finally:
            if original is None:
                mod.PLATFORM_SELECTORS.pop("__test_fake__", None)
            else:
                mod.PLATFORM_SELECTORS["__test_fake__"] = original

    def test_all_candidates_fail_returns_false(self) -> None:
        """主 + 所有 fallback 均失效 → False。"""
        from app.services.publish import platform_dom_selectors as mod

        fake = PlatformDomSelectors(
            platform="__test_fake_all_fail__",
            title_input="#main",
            fallback_selectors={"title_input": ["#fb1", "#fb2"]},
        )
        original = mod.PLATFORM_SELECTORS.get("__test_fake_all_fail__")
        mod.PLATFORM_SELECTORS["__test_fake_all_fail__"] = fake
        try:
            page = MagicMock()
            page.query_selector.return_value = None
            assert verify_selector("__test_fake_all_fail__", "title_input", page) is False
            assert page.query_selector.call_count == 3  # 主 + 2 fallback
        finally:
            if original is None:
                mod.PLATFORM_SELECTORS.pop("__test_fake_all_fail__", None)
            else:
                mod.PLATFORM_SELECTORS["__test_fake_all_fail__"] = original

    def test_query_selector_exception_continues_to_next(self) -> None:
        """query_selector 抛异常时应继续尝试下一个候选。"""
        from app.services.publish import platform_dom_selectors as mod

        fake = PlatformDomSelectors(
            platform="__test_exc__",
            title_input="#main",
            fallback_selectors={"title_input": ["#fb1"]},
        )
        original = mod.PLATFORM_SELECTORS.get("__test_exc__")
        mod.PLATFORM_SELECTORS["__test_exc__"] = fake
        try:
            page = MagicMock()
            # 第一次抛异常,第二次返回元素
            page.query_selector.side_effect = [RuntimeError("boom"), MagicMock()]
            assert verify_selector("__test_exc__", "title_input", page) is True
            assert page.query_selector.call_count == 2
        finally:
            if original is None:
                mod.PLATFORM_SELECTORS.pop("__test_exc__", None)
            else:
                mod.PLATFORM_SELECTORS["__test_exc__"] = original


# =============================================================================
# 7. verify_all_selectors
# =============================================================================


class TestVerifyAllSelectors:
    """verify_all_selectors 验证平台所有非空选择器。"""

    def test_unknown_platform_returns_empty_dict(self) -> None:
        """未知平台返回空 dict。"""
        page = MagicMock()
        assert verify_all_selectors("nonexistent_xyz", page) == {}

    def test_returns_only_configured_fields(self) -> None:
        """只返回已配置(主或 fallback 非空)的字段。"""
        page = MagicMock()
        page.query_selector.return_value = MagicMock()
        result = verify_all_selectors("wechat", page)
        # wechat 配置了 title_input/content_editor/cover_upload/tag_input/submit_button
        # (video_upload/category_select/original_checkbox 可能为空)
        assert isinstance(result, dict)
        # 至少有 title_input(wechat 有配置)
        assert "title_input" in result
        # 所有值应为 bool
        for v in result.values():
            assert isinstance(v, bool)

    def test_all_selectors_hit_returns_all_true(self) -> None:
        """所有选择器命中 → 所有值为 True。"""
        page = MagicMock()
        page.query_selector.return_value = MagicMock()
        result = verify_all_selectors("wechat", page)
        assert all(result.values())


# =============================================================================
# 8. list_outdated_selectors
# =============================================================================


class TestListOutdatedSelectors:
    """list_outdated_selectors 过期检测。"""

    def test_default_threshold_30_days_returns_empty(self) -> None:
        """默认 30 天阈值,所有平台 last_verified=2026-07-31(近期)→ 应返回较少过期项。

        注意:测试运行日期可能远晚于 2026-07-31,所以这里只验证返回值是 list[str]。
        """
        result = list_outdated_selectors()
        assert isinstance(result, list)
        for p in result:
            assert isinstance(p, str)

    def test_zero_threshold_returns_all(self) -> None:
        """阈值 0 天 → 所有有 last_verified 的平台都视为过期(除非此刻刚验证)。"""
        result = list_outdated_selectors(days_threshold=0)
        # 0 天阈值下,2026-07-31 验证的都过期
        assert len(result) > 0

    def test_large_threshold_returns_empty(self) -> None:
        """超大阈值(100000 天)→ 无过期。"""
        result = list_outdated_selectors(days_threshold=100000)
        assert result == []

    def test_negative_threshold_raises_value_error(self) -> None:
        """负数阈值 → ValueError。"""
        with pytest.raises(ValueError, match="days_threshold 不能为负数"):
            list_outdated_selectors(days_threshold=-1)

    def test_result_is_sorted(self) -> None:
        """返回列表应按字母序排序。"""
        result = list_outdated_selectors(days_threshold=0)
        assert result == sorted(result)

    def test_unverified_platform_included(self) -> None:
        """last_verified 为空的平台应被视为过期。"""
        from app.services.publish import platform_dom_selectors as mod

        fake = PlatformDomSelectors(
            platform="__test_unverified__",
            last_verified="",  # 未验证
        )
        original = mod.PLATFORM_SELECTORS.get("__test_unverified__")
        mod.PLATFORM_SELECTORS["__test_unverified__"] = fake
        try:
            result = list_outdated_selectors(days_threshold=100000)
            assert "__test_unverified__" in result
        finally:
            if original is None:
                mod.PLATFORM_SELECTORS.pop("__test_unverified__", None)
            else:
                mod.PLATFORM_SELECTORS["__test_unverified__"] = original

    def test_invalid_date_format_treated_as_outdated(self) -> None:
        """last_verified 格式无效 → 视为过期。"""
        from app.services.publish import platform_dom_selectors as mod

        fake = PlatformDomSelectors(
            platform="__test_invalid_date__",
            last_verified="not-a-date",
        )
        original = mod.PLATFORM_SELECTORS.get("__test_invalid_date__")
        mod.PLATFORM_SELECTORS["__test_invalid_date__"] = fake
        try:
            result = list_outdated_selectors(days_threshold=100000)
            assert "__test_invalid_date__" in result
        finally:
            if original is None:
                mod.PLATFORM_SELECTORS.pop("__test_invalid_date__", None)
            else:
                mod.PLATFORM_SELECTORS["__test_invalid_date__"] = original


# =============================================================================
# 9. list_unverified_selectors
# =============================================================================


class TestListUnverifiedSelectors:
    """list_unverified_selectors 列出从未验证的平台。"""

    def test_returns_list_of_str(self) -> None:
        """返回 list[str]。"""
        result = list_unverified_selectors()
        assert isinstance(result, list)
        for p in result:
            assert isinstance(p, str)

    def test_result_is_sorted(self) -> None:
        """返回列表应按字母序排序。"""
        result = list_unverified_selectors()
        assert result == sorted(result)

    def test_default_table_has_no_unverified(self) -> None:
        """默认 PLATFORM_SELECTORS 所有平台都有 last_verified=2026-07-31 → 无未验证。"""
        result = list_unverified_selectors()
        # 默认表所有平台 last_verified 非空
        assert result == []

    def test_unverified_platform_included(self) -> None:
        """手动注入 last_verified='' 的平台应被列出。"""
        from app.services.publish import platform_dom_selectors as mod

        fake = PlatformDomSelectors(
            platform="__test_unverified_list__",
            last_verified="",
        )
        original = mod.PLATFORM_SELECTORS.get("__test_unverified_list__")
        mod.PLATFORM_SELECTORS["__test_unverified_list__"] = fake
        try:
            result = list_unverified_selectors()
            assert "__test_unverified_list__" in result
        finally:
            if original is None:
                mod.PLATFORM_SELECTORS.pop("__test_unverified_list__", None)
            else:
                mod.PLATFORM_SELECTORS["__test_unverified_list__"] = original


# =============================================================================
# 10. 模块级 __all__ 完整性
# =============================================================================


class TestModuleAll:
    """模块 __all__ 导出完整性。"""

    def test_all_exports_present(self) -> None:
        """__all__ 应包含所有公开接口。"""
        from app.services.publish.platform_dom_selectors import __all__

        expected = {
            "PlatformDomSelectors",
            "PLATFORM_SELECTORS",
            "get_selectors",
            "list_platforms_with_selectors",
            "verify_selector",
            "verify_all_selectors",
            "list_outdated_selectors",
            "list_unverified_selectors",
        }
        assert set(__all__) == expected
