# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""browser_visibility 判据钉(复现 Codex browser.capabilities.visibility)。

钉住:默认后台(get=False)、切可见须带准入理由、无据切可见即拒、
切回后台无需理由、重复 set 同值不算切换、切换留账、reset 清零、线程安全锁不阻塞。
零 IO,纯状态机。
"""

import pytest

from app.services.browser_visibility import (
    BrowserVisibility,
    VisibilityError,
    VisibilityReason,
)


def test_default_background():
    """默认不可见(后台跑),对齐 Codex "默认后台跑"。"""
    vis = BrowserVisibility()
    assert vis.get() is False


def test_set_visible_without_reason_rejected():
    """切到可见无据即拒(防 agent 随意弹前台打断用户)。"""
    vis = BrowserVisibility()
    with pytest.raises(VisibilityError):
        vis.set(True)  # 无 reason
    assert vis.get() is False  # 状态未变


def test_set_visible_with_user_requested():
    """带 user_requested 理由切可见:放行。"""
    vis = BrowserVisibility()
    change = vis.set(True, reason=VisibilityReason.USER_REQUESTED)
    assert vis.get() is True
    assert change.changed is True
    assert change.before is False and change.after is True
    assert change.reason == VisibilityReason.USER_REQUESTED.value


def test_set_visible_with_proof_of_work():
    """带 proof_of_work 理由切可见(改状态后须截图内嵌):放行。"""
    vis = BrowserVisibility()
    vis.set(True, reason=VisibilityReason.PROOF_OF_WORK)
    assert vis.get() is True


def test_set_background_no_reason_needed():
    """切回后台(不可见)无需理由 —— 默认态不打扰用户。"""
    vis = BrowserVisibility()
    vis.set(True, reason=VisibilityReason.USER_REQUESTED)
    change = vis.set(False)  # 无 reason
    assert vis.get() is False
    assert change.changed is True
    assert change.reason == VisibilityReason.BACKGROUND.value


def test_set_same_value_no_change():
    """重复 set 同值不算切换(changed=False),不留账。"""
    vis = BrowserVisibility()
    change = vis.set(False)  # 已是 False
    assert change.changed is False
    assert vis.get() is False
    assert len(vis.history()) == 0  # 无变化不留账


def test_history_records_changes_in_order():
    """切换账按发生序(newest last),含 before/after。"""
    vis = BrowserVisibility()
    vis.set(True, reason=VisibilityReason.USER_REQUESTED)
    vis.set(False)
    hist = vis.history()
    assert len(hist) == 2
    assert hist[0].before is False and hist[0].after is True
    assert hist[1].before is True and hist[1].after is False


def test_reset_clears_state():
    """reset 回默认后台态并清账(测试/新会话用)。"""
    vis = BrowserVisibility()
    vis.set(True, reason=VisibilityReason.PROOF_OF_WORK)
    vis.reset()
    assert vis.get() is False
    assert vis.history() == ()


def test_set_non_bool_rejected():
    """visible 须布尔,非布尔即拒。"""
    vis = BrowserVisibility()
    with pytest.raises(VisibilityError):
        vis.set(1, reason=VisibilityReason.USER_REQUESTED)


def test_initially_visible_override():
    """允许初始可见(有 headless=False 启动参数的场景)。"""
    vis = BrowserVisibility(initially_visible=True)
    assert vis.get() is True
