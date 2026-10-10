# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""G-815971:限额/配额收口的那一轮,禁止 D120 续期再打开模型请求通道。

正反成对(台账验收):
① 限额收口的那轮 ⇒ 续期判定 False(续期计数不增,hook 注入条目为 0 ——
   注入只发生在判定 True 分支内,判定 False 即零注入);
② 正常完成但接近上限的一轮 ⇒ 续期照旧触发(防本判据把 D120 整个关掉)。
判据唯一出口:`_is_budget_exhaustion_error`(码面白名单 + 消息面模式)。
"""

from __future__ import annotations

import pytest

from app.routers import llm as llm_mod
from app.routers.llm import _d120_should_extend, _is_budget_exhaustion_error

# "其余条件全部满足"的基线参数(非首轮/下一轮触顶/未用尽/上轮有工具执行)
_BASE = {
    "tool_iter": 3,
    "iter_budget": 4,
    "extensions_used": 0,
    "tool_executed_last_round": True,
}


def test_budget_exhausted_turn_must_not_extend():
    """① 限额收口的那轮:其余条件全满足也一票否决(续期计数不增、注入条目归零)。"""
    assert not _d120_should_extend(**_BASE, budget_exhausted=True)


def test_normal_completion_near_limit_still_extends():
    """② 正常完成但接近上限:续期照旧触发(排除条款不得误伤 D120)。"""
    assert _d120_should_extend(**_BASE, budget_exhausted=False)


def test_exclusion_does_not_leak_into_normal_path():
    """排除条款只挂 budget_exhausted 一位:其余条件不满足时,未收口同样不续期。"""
    assert not _d120_should_extend(
        tool_iter=0,  # 首轮
        iter_budget=4,
        extensions_used=0,
        tool_executed_last_round=True,
        budget_exhausted=False,
    )
    assert not _d120_should_extend(
        tool_iter=3,
        iter_budget=4,
        extensions_used=2,  # 已用尽
        tool_executed_last_round=True,
        budget_exhausted=False,
    )
    assert not _d120_should_extend(
        tool_iter=3,
        iter_budget=4,
        extensions_used=0,
        tool_executed_last_round=False,  # 上一轮没有工具执行
        budget_exhausted=False,
    )


def test_env_off_disables_extension_but_exclusion_still_holds(monkeypatch):
    """env 关闭(LLM_ITERATION_EXTEND_LIMIT=0)⇒ 恒不续期;排除条款方向一致。"""
    monkeypatch.setattr(llm_mod, "_ITERATION_EXTEND_LIMIT", 0)
    assert not _d120_should_extend(**_BASE, budget_exhausted=False)
    assert not _d120_should_extend(**_BASE, budget_exhausted=True)


@pytest.mark.parametrize(
    "code",
    [
        "BUDGET_EXHAUSTED",
        "TRIAL_QUOTA_EXCEEDED",
        "PROVIDER_QUOTA_EXHAUSTED",
        "QUOTA_EXCEEDED",
        "RATE_LIMITED",
        "RATE_LIMIT_EXCEEDED",
        "PAYMENT_REQUIRED",
    ],
)
def test_budget_error_codes_recognized(code):
    """码面白名单全量命中(网关 hard 中断 / 试用额度门 / provider 额度耗尽 / 限流)。"""
    assert _is_budget_exhaustion_error(code)


@pytest.mark.parametrize(
    "message",
    [
        "Error 429: too many requests",
        "Quota exceeded for project",
        "Rate limit reached, retry later",
        "insufficient_quota: you exceeded your current quota",
        "今日免费额度已用完",
        "账户配额不足",
        "余额不足,请充值",
    ],
)
def test_budget_error_messages_recognized(message):
    """消息面模式命中(大小写不敏感;中英双语)。"""
    assert _is_budget_exhaustion_error(None, message)


@pytest.mark.parametrize(
    "code,message",
    [
        ("TOOL_MODE_UNAVAILABLE", ""),
        ("SELECTOR_NOT_FOUND", "element not found"),
        ("CHAT_MODE_TOOL_BLOCKED", "plan mode blocks writes"),
        ("", ""),
        (None, None),
        ("EXECUTION_EXCEPTION", "command exited with code 1"),
    ],
)
def test_non_budget_errors_not_misjudged(code, message):
    """非限额错误不得误判(防排除条款误伤普通工具失败轮的续期)。"""
    assert not _is_budget_exhaustion_error(code, message)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
