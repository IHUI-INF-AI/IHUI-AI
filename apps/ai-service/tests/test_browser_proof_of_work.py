# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""browser_proof_of_work 单测 — 钉住改状态分类、Markdown 内嵌判定、读取类恒通过。"""

from __future__ import annotations

import pytest

from app.services.browser_proof_of_work import (
    READ_ONLY_ACTIONS,
    STATE_CHANGING_ACTIONS,
    check_proof_of_work,
    is_screenshot_embedded,
    is_state_changing_action,
)


def test_state_changing_set_present() -> None:
    # 核心 14 类改状态动作齐备
    assert len(STATE_CHANGING_ACTIONS) >= 14
    for a in ("form_submit", "purchase", "send_message", "delete", "upload", "create"):
        assert a in STATE_CHANGING_ACTIONS


def test_read_only_set_present() -> None:
    assert len(READ_ONLY_ACTIONS) >= 9
    for a in ("navigate", "scroll", "screenshot", "read", "search"):
        assert a in READ_ONLY_ACTIONS


@pytest.mark.parametrize("action", ["form_submit", "purchase", "send_message", "delete", "upload"])
def test_state_changing_positive(action: str) -> None:
    assert is_state_changing_action(action) is True


@pytest.mark.parametrize("action", ["navigate", "scroll", "screenshot", "read", "search"])
def test_state_changing_negative_read_only(action: str) -> None:
    assert is_state_changing_action(action) is False


def test_state_changing_heuristic_roots() -> None:
    # 未命中封闭集但含改状态词根
    assert is_state_changing_action("submit_order") is True
    assert is_state_changing_action("post_reply") is True
    # 未命中且无词根 = 不改状态
    assert is_state_changing_action("hover_tooltip") is False


def test_screenshot_embedded_markdown() -> None:
    reply = "完成了!已提交表单。\n\n![proof](https://cdn.example.com/shot-abc123.png)"
    assert is_screenshot_embedded(
        visible_reply=reply, screenshot_url="https://cdn.example.com/shot-abc123.png"
    )


def test_screenshot_embedded_html_img() -> None:
    reply = '<p>已购买。</p><img src="https://shot.example.com/pow-1.png" alt="proof">'
    assert is_screenshot_embedded(
        visible_reply=reply, screenshot_url="https://shot.example.com/pow-1.png"
    )


def test_screenshot_embedded_wrong_url_fails() -> None:
    reply = "![proof](https://cdn.example.com/wrong-shot.png)"
    assert not is_screenshot_embedded(
        visible_reply=reply, screenshot_url="https://cdn.example.com/right-shot.png"
    )


def test_screenshot_embedded_empty_reply_fails() -> None:
    assert not is_screenshot_embedded(visible_reply="", screenshot_url="https://x.com/s.png")


def test_screenshot_embedded_none_url_fails() -> None:
    assert not is_screenshot_embedded(visible_reply="hi", screenshot_url=None)


def test_read_only_action_passes_without_screenshot() -> None:
    """读取类动作无截图也通过(不须 proof-of-work)。"""
    d = check_proof_of_work(action="navigate", screenshot_url=None, visible_reply="")
    assert d.is_state_changing is False
    assert d.requires_embed is False
    assert d.passed is True


def test_state_changing_no_screenshot_fails() -> None:
    d = check_proof_of_work(action="form_submit", screenshot_url=None, visible_reply="")
    assert d.is_state_changing is True
    assert d.requires_embed is True
    assert d.passed is False


def test_state_changing_screenshot_not_embedded_fails() -> None:
    """截图只贴在工具输出(未内嵌进可见回复)不算 proof-of-work。"""
    shot = "https://cdn.example.com/shot.png"
    # 工具输出文本里提到截图 URL,但可见回复里没有 Markdown 图片
    reply = f"工具输出里已有截图 {shot}"
    d = check_proof_of_work(action="purchase", screenshot_url=shot, visible_reply=reply)
    assert d.is_state_changing is True
    assert d.is_embedded is False
    assert d.passed is False
    assert "只贴在工具输出里不算" in d.detail or "须用 Markdown" in d.detail


def test_state_changing_screenshot_embedded_passes() -> None:
    shot = "https://cdn.example.com/pow-final.png"
    reply = f"已提交订单成功!\n\n![截图]( {shot} )"
    d = check_proof_of_work(action="purchase", screenshot_url=shot, visible_reply=reply)
    assert d.is_state_changing is True
    assert d.is_embedded is True
    assert d.passed is True


def test_decision_detail_never_empty() -> None:
    for action in ("navigate", "form_submit", "unknown_action"):
        d = check_proof_of_work(action=action, screenshot_url=None, visible_reply="")
        assert d.detail  # 恒非空


if __name__ == "__main__":
    pytest.main([__file__, "-q"])
