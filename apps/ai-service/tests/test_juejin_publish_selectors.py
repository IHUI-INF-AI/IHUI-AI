# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

# -*- coding: utf-8 -*-
"""掘金发布弹层选择器判据回归(2026-09-27 缺陷修复配套;同日凌晨二次校准)。

背景:publish_history 曾出现 ``publish timeout (no redirect to /post/<id>)``。
根因三处:① 确认按钮按单字面量「确认发布」找,而弹层实测文案是「确定并发布」;
② 分类/标签选择器(``select.category-select`` 等)在掘金 DOM 里根本不存在;
③ 成功判据等 ``/post/<id>`` 跳转 —— 提交后文章处于审核期,规范地址是
``/spost/<id>``,``/post/`` 审核通过后才出现,该等待结构上不可能成立。

夹具纪律(AGENTS §22c):判据对象是真实页面形态时,夹具输入必须逐字取自真实产物。
**本夹具已于 2026-09-27 用三轮 headless 只读探针的一手 DOM 观察整体替换** ——
凭据注入与适配器 publish 完全同路径(id=13 解密 → create_stealth_browser_context
→ add_cookies),弹层已现场打开并逐字记录(存档 .ihui-agent/tmp/juejin-calib/
observation*.json);全程未点击最终提交按钮,无文章被发布。
当次实测同时**推翻**了上一版的两处推导:分类不是"小浮层下拉+hover 触发",而是弹层内
平铺 ``.category-list > .item``(选中态 class 追加 active);弹层容器不是任何
modal/popover 类,而是 ``.publish-popup``。上一版反向锁把 ``.category-list .item``
列为"假想 DOM"—— 实测证明它恰是主选择器,锁已按实测更正;被证伪的一直是
"分类=下拉形态"与 ``select.category-select`` 一族。
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from app.services.publish.adapters.juejin import (
    CATEGORY_ITEM_SELECTORS,
    DROPDOWN_OPTION_SELECTORS,
    PUBLISH_CONFIRM_TEXTS,
    PUBLISH_MODAL_SELECTORS,
    PUBLISH_OPEN_TEXTS,
    SPOST_URL_PREFIX,
    TAG_INPUT_SELECTOR,
    describe_stuck_stage,
    extract_article_id_from_submit,
    find_option_in_list,
    is_published_redirect,
    match_submit_api_url,
    pick_first_text,
)

_FIXTURE = Path(__file__).parent / "fixtures" / "juejin_probe" / "popup_strings.json"


@pytest.fixture(scope="module")
def fx() -> dict[str, Any]:
    data: dict[str, Any] = json.loads(_FIXTURE.read_text(encoding="utf-8"))
    return data


# ---------------------------------------------------------------------------
# ① 确认按钮:真文案命中 / 旧单字面量假设必须红 / 文案变回去仍能命中
# ---------------------------------------------------------------------------


class TestConfirmButtonText:
    def test_real_popup_text_matches(self, fx: dict[str, Any]) -> None:
        """弹层真实可见文案(实测记录)必须被候选集命中为「确定并发布」。"""
        texts: list[str] = fx["popup_visible_button_texts"]
        assert "确定并发布" in texts
        assert pick_first_text(texts, PUBLISH_CONFIRM_TEXTS) == "确定并发布"

    def test_old_single_literal_would_be_red_on_real_dom(
        self, fx: dict[str, Any]
    ) -> None:
        """判据有牙的证明:按旧实现口径(只认「确认发布」一个字面量)跑真实文案面,
        必须挑不到任何东西 —— 这正是历史 timeout 的机制。若哪天本用例变绿,
        说明有人在文案事实上动了手脚,而不是代码被修好。"""
        texts: list[str] = fx["popup_visible_button_texts"]
        old_impl_candidates = ("确认发布",)
        assert pick_first_text(texts, old_impl_candidates) is None

    def test_reverted_text_still_matches_multi_candidate(self, fx: dict[str, Any]) -> None:
        """「文案变回旧假设仍能命中」:多候选必须同时覆盖新旧两种文案。"""
        old_side: list[str] = fx["old_assumption_popup_button_texts"]
        assert pick_first_text(old_side, PUBLISH_CONFIRM_TEXTS) == "确认发布"

    def test_candidates_cover_both_generations(self) -> None:
        assert PUBLISH_CONFIRM_TEXTS == ("确定并发布", "确认发布")

    def test_no_hit_returns_none(self) -> None:
        assert pick_first_text(["取消", "保存草稿"], PUBLISH_CONFIRM_TEXTS) is None


# ---------------------------------------------------------------------------
# ② 提交接口:真提交 vs 草稿保存,判据必须区分
# ---------------------------------------------------------------------------


class TestSubmitApiMatching:
    def test_real_submit_urls_match(self, fx: dict[str, Any]) -> None:
        assert match_submit_api_url(fx["submit_api_url"]) is True
        assert match_submit_api_url(fx["submit_api_url_v2"]) is True

    def test_draft_save_is_not_submit(self, fx: dict[str, Any]) -> None:
        """草稿保存接口成功≠文章已提交 —— 旧 timeout 事故的误判源之一。"""
        assert match_submit_api_url(fx["draft_api_url"]) is False
        assert match_submit_api_url(fx["draft_update_api_url"]) is False

    def test_extract_article_id_contract(self, fx: dict[str, Any]) -> None:
        aid = extract_article_id_from_submit(
            {"err_no": 0, "data": {"article_id": "7555123456789012345"}}
        )
        assert aid == "7555123456789012345"
        # 三种候选键
        assert extract_article_id_from_submit({"err_no": 0, "data": {"id": 42}}) == "42"
        assert (
            extract_article_id_from_submit(
                {"err_no": 0, "data": {"articleId": "7555000000000000001"}}
            )
            == "7555000000000000001"
        )
        # err_no 非 0 / 无 data / 非 dict → 一律 None,不得猜
        assert extract_article_id_from_submit({"err_no": 2, "data": None}) is None
        assert extract_article_id_from_submit({"err_no": 0}) is None
        assert extract_article_id_from_submit("not-a-dict") is None


# ---------------------------------------------------------------------------
# ③ 成功判据:/published 过渡页 + /spost,不再依赖 /post/<id>
# ---------------------------------------------------------------------------


def _adapter_src() -> str:
    return (
        Path(__file__).parents[1]
        / "app" / "services" / "publish" / "adapters" / "juejin.py"
    ).read_text(encoding="utf-8")


class TestSuccessEvidence:
    def test_published_landing(self, fx: dict[str, Any]) -> None:
        assert is_published_redirect(fx["published_transition_url"]) is True
        assert is_published_redirect(fx["redirected_home_url"]) is False

    def test_under_review_url_is_spost_not_post(self, fx: dict[str, Any]) -> None:
        """审核期地址是 /spost/<id>;旧代码等的 /post/ 此时结构上不存在。"""
        under_review: str = fx["under_review_post_url"]
        assert under_review.startswith(SPOST_URL_PREFIX)
        assert is_published_redirect(under_review) is False

    def test_source_no_longer_waits_for_post_redirect(self) -> None:
        """反向锁:源码不得回到 wait_for_url("**/post/**") 旧判据。"""
        src = _adapter_src()
        assert 'wait_for_url("**/post/**"' not in src
        assert "publish timeout (no redirect to /post/<id>)" not in src

    def test_source_has_no_fabricated_category_dropdown_selectors(self) -> None:
        """反向锁:被证伪的 `select.category-select`(下拉假想形态的一族 DOM)不得回流。
        2026-09-27 一手实测:弹层 outerHTML 全量核对无任何 name=select 的分类控件。

        注:上一版把 `.category-list .item` 一并锁死 —— 当次实测证明它恰恰是现网
        **主选择器**(平铺列表),该断言已按实测移除;被证伪的是"分类=下拉"这一型,
        不是这个类名本身。锁的更新必须跟着实测走,不是跟着旧结论走。"""
        src = _adapter_src()
        assert "select.category-select" not in src


# ---------------------------------------------------------------------------
# ④ 分类:必选项;匹配缺失必须给出可定位错误
# ---------------------------------------------------------------------------


class TestCategorySelection:
    def test_exact_and_containment_match(self, fx: dict[str, Any]) -> None:
        seen: list[str] = fx["category_option_texts_seen"]
        assert find_option_in_list(seen, "后端") == "后端"
        assert find_option_in_list(seen, "人工智能") == "人工智能"

    def test_missing_category_returns_none_not_guess(self, fx: dict[str, Any]) -> None:
        seen: list[str] = fx["category_option_texts_seen"]
        assert find_option_in_list(seen, "元宇宙") is None

    def test_stuck_message_localizes_category_failure(self, fx: dict[str, Any]) -> None:
        """分类没选中时,错误信息必须点名「分类未选」这一步(可定位)。"""
        seen: list[str] = fx["category_option_texts_seen"]
        wanted = "元宇宙"
        assert find_option_in_list(seen, wanted) is None
        msg = describe_stuck_stage(
            modal_opened=True,
            category_selected=False,
            submit_called=False,
            submit_status=None,
            got_article_id=False,
            published_landing=False,
        )
        assert "category-not-selected" in msg
        assert "分类" in msg

    def test_stuck_message_distinguishes_submit_failures(self) -> None:
        http_err = describe_stuck_stage(
            modal_opened=True,
            category_selected=True,
            submit_called=True,
            submit_status=500,
            got_article_id=False,
            published_landing=False,
        )
        assert "submit-api-http-error" in http_err and "500" in http_err
        no_id = describe_stuck_stage(
            modal_opened=True,
            category_selected=True,
            submit_called=True,
            submit_status=200,
            got_article_id=False,
            published_landing=False,
        )
        assert "submit-api-no-article-id" in no_id
        not_called = describe_stuck_stage(
            modal_opened=True,
            category_selected=True,
            submit_called=False,
            submit_status=None,
            got_article_id=False,
            published_landing=False,
        )
        assert "submit-not-called" in not_called
        modal = describe_stuck_stage(
            modal_opened=False,
            category_selected=False,
            submit_called=False,
            submit_status=None,
            got_article_id=False,
            published_landing=False,
        )
        assert "publish-modal-not-opened" in modal


class TestSelectorTables:
    def test_modal_table_leads_with_live_observed_container(self, fx: dict[str, Any]) -> None:
        """弹层容器候选表必须把**当次实测唯一可见类**排在首位。
        旧表只列 modal/popover 三族 —— 当次实测 byte-modal 9 元素全隐藏、popover 0 个,
        wait_for_selector 恒超时 ⇒ 分类/标签步被静默跳过(链路上第二个真缺陷)。"""
        container_cls: str = fx["publish_popup_container_class"]
        first = PUBLISH_MODAL_SELECTORS[0]
        assert first == '[class*="publish-popup"]'
        token = first.partition('="')[2].rstrip('"]')
        assert token in container_cls
        # 回退族保留(改版韧性),但不得再占据首位
        assert any("modal" in s for s in PUBLISH_MODAL_SELECTORS[1:])

    def test_dropdown_table_leads_with_live_observed_tag_portal(self, fx: dict[str, Any]) -> None:
        """标签下拉选项候选首位 = 实测 portal 类(.byte-select-dropdown 下的 li)。"""
        assert DROPDOWN_OPTION_SELECTORS[0] == '[class*="byte-select-dropdown"] li'
        marker: str = fx["tag_dropdown_option_html_head"]
        assert "byte-select-option" in marker

    def test_confirm_texts_is_tuple_not_single_string(self) -> None:
        assert isinstance(PUBLISH_CONFIRM_TEXTS, tuple) and len(PUBLISH_CONFIRM_TEXTS) >= 2


# ---------------------------------------------------------------------------
# ⑤ 2026-09-27 一手实测形态:分类平铺列表 / 顶栏入口 exact 文案 / 标签输入框
# ---------------------------------------------------------------------------


class TestLiveDomShapes:
    def test_category_is_flat_item_list_not_dropdown(self, fx: dict[str, Any]) -> None:
        """分类实测 = 弹层内平铺 .category-list > .item(无 hover/无下拉)。
        主选择器必须排在候选首位,且能在实测 class 串上匹配。"""
        assert CATEGORY_ITEM_SELECTORS[0] == ".category-list .item"
        container_cls: str = fx["category_container_class"]
        assert "category-list" in container_cls
        assert fx["category_item_class_initial"] == "item"
        # 选中态:当次实测 class 追加 active(_select_category_in_modal 的第一复核依据)
        assert "active" in fx["category_selected_class_after_click"]

    def test_category_source_uses_flat_list_and_active_check(self) -> None:
        """源码正向锁:分类步必须走 CATEGORY_ITEM_SELECTORS 并以 active 类复核。
        (与反向锁配对 —— 反向锁拦"下拉假想"回流,正向锁保证"实测形态"真在码上。)"""
        src = _adapter_src()
        assert "CATEGORY_ITEM_SELECTORS" in src
        assert 'get_attribute("class")' in src
        assert '"active" in cls_attr' in src

    def test_opener_exact_text_leads(self, fx: dict[str, Any]) -> None:
        """顶栏入口实测 exact 文案 =「发布」,必须排候选首位
        (历史候选「完成并发布/发布文章」当次均未观测为按钮;「发布文章」是弹层标题文本)。"""
        assert PUBLISH_OPEN_TEXTS[0] == fx["publish_opener_exact_text"] == "发布"

    def test_tag_input_selector_matches_observed_dom(self, fx: dict[str, Any]) -> None:
        """标签输入框实测形态:.tag-input 内 input.byte-select__input;
        placeholder 不是 input 属性 ⇒ `.tag-input input` 一支必须保留且排前。"""
        assert TAG_INPUT_SELECTOR.startswith(".tag-input input")
        measured: str = fx["tag_input_selector_measured"]
        assert measured == ".tag-input .byte-select__input"
        assert measured.endswith("byte-select__input")

    def test_editor_bundle_evidence_is_v1_only(self, fx: dict[str, Any]) -> None:
        """bundle 取证串在案:提交接口当次仅核到 v1;v2 是防御候选,不是实测项。"""
        assert fx["editor_bundle_evidence_url"].endswith("app.12c77646.js")
        prov: dict[str, Any] = fx["_provenance"]
        assert "未**出现 v2" in prov["submit_api_url / draft_api_url"] or "v2" in prov[
            "submit_api_url / draft_api_url"
        ]

    def test_live_fixture_provenance_marks_first_hand_observation(self, fx: dict[str, Any]) -> None:
        """夹具诚实性锁:证据等级必须是一手实测(不得回退成二手记录措辞)。"""
        assert fx["_evidence_grade"] == "live-dom-observed-2026-09-27"
        popup_prov: str = fx["_provenance"]["popup_visible_button_texts"]
        assert "一手" in popup_prov or "当次实测" in popup_prov


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
