# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""本站操控意图自动路由(2026-09-20 AI 全量操控桥接)单元测试。

覆盖:ConversationService._app_control_intent_tools 的正/负样本、两处补全规则
(动作类补 describe、api 入口补成对)、正则键与实际注册工具名的一致性,
以及注册后 _filter_tools 能把它们转成 OpenAI function calling 定义。
"""

from __future__ import annotations

import pytest

from app.services import ui_action_bridge as ub
from app.services.conversation import (
    _API_ENTRY_TOOLS,
    _UI_INTENT_PATTERNS,
    _UI_RENDER_PROMPT,
    ConversationService,
)

select = ConversationService._app_control_intent_tools


# ---------------------------------------------------------------------------
# 正样本:命中即注入对应工具
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("帮我打开设置页面", {"web_ui_navigate", "web_ui_describe"}),
        ("把充值金额填成100", {"web_ui_fill", "web_ui_describe"}),
        ("点击保存按钮", {"web_ui_click", "web_ui_describe"}),
        ("提交这个表单", {"web_ui_submit", "web_ui_describe"}),
        ("切换到 plan 模式", {"web_ui_invoke", "web_ui_describe"}),
        ("新建一个会话", {"web_ui_invoke", "web_ui_describe"}),
        ("看一下当前页面显示什么", {"web_ui_read"}),
        ("这个页面上有哪些可操控的按钮", {"web_ui_describe"}),
        ("查一下所有用户列表", set(_API_ENTRY_TOOLS)),
        ("列出最近的订单", set(_API_ENTRY_TOOLS)),
        ("帮我调用后端接口创建一条记录", set(_API_ENTRY_TOOLS)),
    ],
)
def test_positive_intents(text: str, expected: set[str]) -> None:
    got = set(select(text))
    assert expected <= got, f"{text} → {got}"


# ---------------------------------------------------------------------------
# 负样本:普通问答不得注入操控工具(误判即白烧 token 并诱导幻觉)
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "text",
    [
        "什么是向量数据库",
        "帮我写一首关于秋天的诗",
        "把这段代码重构一下",
        "解释一下 JWT 刷新机制",
        "总结一下这篇文章的要点",
        "查一下用户认证是怎么实现的",
        "这张图里的建筑是什么",
        "今天心情不好,聊聊天",
    ],
)
def test_negative_intents(text: str) -> None:
    assert select(text) == []


# ---------------------------------------------------------------------------
# 补全规则
# ---------------------------------------------------------------------------

def test_action_without_describe_gets_describe_added() -> None:
    got = select("点击提交按钮")
    assert "web_ui_click" in got
    assert "web_ui_describe" in got  # 动作靠 describe 返回的 id 定位,缺它即断链


def test_pure_read_does_not_pull_describe() -> None:
    got = select("看一下当前页面显示了什么")
    assert "web_ui_read" in got
    assert "web_ui_describe" not in got


def test_api_entry_tools_always_paired() -> None:
    got = select("调用 api 查一下")
    assert set(_API_ENTRY_TOOLS) <= set(got)


def test_result_has_no_duplicates() -> None:
    got = select("打开设置页面并填写邮箱,再提交表单,顺便调用接口列出所有用户列表")
    assert len(got) == len(set(got))


# ---------------------------------------------------------------------------
# 键与注册面一致性
# ---------------------------------------------------------------------------

def test_pattern_keys_match_registered_tools() -> None:
    """正则里的工具名必须真实存在,否则 _filter_tools 静默丢工具。"""
    registered = {t.name for t, _ in ub._ui_tools()}
    registered |= set(_API_ENTRY_TOOLS)
    for key in _UI_INTENT_PATTERNS:
        assert key in registered, f"路由键 {key} 没有对应已注册工具"


def test_patterns_compile_and_are_tuples() -> None:
    for key, patterns in _UI_INTENT_PATTERNS.items():
        assert isinstance(patterns, tuple) and patterns, key


# ---------------------------------------------------------------------------
# 注册 → LLM 工具清单
# ---------------------------------------------------------------------------

async def test_filtered_tools_exposes_ui_tools(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.services.mcp_server import mcp_server

    monkeypatch.setenv("AGENT_CONTROL_INTERNAL_SECRET", "x")
    ub.register_ui_action_tools()
    try:
        names = [t.name for t in mcp_server.list_tools()]
        assert "web_ui_describe" in names
        tools = ConversationService()._filter_tools(["web_ui_describe", "web_ui_fill"])
        assert [t["function"]["name"] for t in tools] == ["web_ui_describe", "web_ui_fill"]
        assert tools[1]["function"]["parameters"]["required"] == ["target", "value"]
    finally:
        ub.unregister_external_tool_by_prefix("web_ui_")


def test_render_prompt_covers_safety_codes() -> None:
    for code in ("DESTRUCTIVE_BLOCKED", "ROUTE_NOT_ALLOWED", "TARGET_NOT_CONNECTED"):
        assert code in _UI_RENDER_PROMPT
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
