# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# -*- coding: utf-8 -*-
"""掘金发布弹层选择器判据回归(2026-09-27 缺陷修复配套)。

背景:publish_history 曾出现 ``publish timeout (no redirect to /post/<id>)``。
根因三处:① 确认按钮按单字面量「确认发布」找,而弹层实测文案是「确定并发布」;
② 分类/标签选择器(``select.category-select`` 等)在掘金 DOM 里根本不存在;
③ 成功判据等 ``/post/<id>`` 跳转 —— 提交后文章处于审核期,规范地址是
``/spost/<id>``,``/post/`` 审核通过后才出现,该等待结构上不可能成立。

夹具纪律(AGENTS §22c):判据对象是真实页面形态时,夹具输入必须逐字取自真实产物。
本文件的真实出处组件:
- ``tests/fixtures/juejin_probe/popup_strings.json`` 的接口 URL 串逐字取自掘金线上
  生产 JS bundle(公开资源;存档 .ihui-agent/tmp/juejin-probe/endpoints.json);
- 弹层按钮文案全集取自历史事故排查的**线上实测记录**(任务书给定)。本次探针因
  画像登录态在服务端失效**未能现场复抓弹层 DOM**,该事实已写进夹具 provenance,
  拿到新登录态后必须复验替换 —— 不得把本文件的通过读成"弹层 DOM 已实测"。
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from app.services.publish.adapters.juejin import (
    DROPDOWN_OPTION_SELECTORS,
    PUBLISH_CONFIRM_TEXTS,
    PUBLISH_MODAL_SELECTORS,
    SPOST_URL_PREFIX,
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

    def test_source_has_no_fabricated_category_dom_selectors(self) -> None:
        """反向锁:被证伪的 `select.category-select` / `.category-list .item`
        假想 DOM 不得回流。"""
        src = _adapter_src()
        assert "select.category-select" not in src
        assert ".category-list .item" not in src


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
    def test_modal_and_dropdown_tables_nonempty(self) -> None:
        assert PUBLISH_MODAL_SELECTORS and all("modal" in s or "popover" in s for s in PUBLISH_MODAL_SELECTORS)
        assert DROPDOWN_OPTION_SELECTORS

    def test_confirm_texts_is_tuple_not_single_string(self) -> None:
        assert isinstance(PUBLISH_CONFIRM_TEXTS, tuple) and len(PUBLISH_CONFIRM_TEXTS) >= 2


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
