# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""V3 #58 的**第二跳**对账:主对话流的权限模式档位消费点写法本身掩盖断链。

2026-10-18 现读的真仓形态(别枚已把 `permission_mode` 补进 `LLMCompleteRequest` 的声明,
所以"Pydantic 丢未知键"这一格已闭合;本枚处理剩下的那一格):6 处消费点全写成
`getattr(req, "permission_mode", None)`。这个写法让**"键没落地"(断链)与"用户没选"(合法默认)
长得一模一样** —— 而 mypy --strict 对 getattr-with-default 结构性失明,看不出那个键存不存在。
也就是说:即便将来有人再把字段声明删掉,类型检查一声不响,审批门与工具收窄静默退回默认档放行。

因此本文件不只测取值,还测两件事:
  · 阳性对照 —— 一个**未声明**的键确实会被 Pydantic 丢掉(证明"不声明=静默丢"这一机制真实存在,
    而不是我以为的;这正是为什么消费点不能写成 getattr-with-default);
  · 形状锁 —— 源码里不得再出现 `getattr(req, "permission_mode"`,且 `req.permission_mode`
    的消费点计数不得少于 6(掉一行=某条链路上又没人读它了)。

零外部依赖:不连 PG/Redis(§5 测试隔离铁律),不发起任何模型调用。
"""

from __future__ import annotations

from pathlib import Path

import pytest

from app.routers.llm import (
    _TOOL_DANGER_LEVELS,
    LLMCompleteRequest,
    _normalize_permission_mode,
    _resolve_tool_approval,
)

LLM_PY = Path(__file__).resolve().parents[1] / "app" / "routers" / "llm.py"


def _req(**extra: object) -> LLMCompleteRequest:
    return LLMCompleteRequest.model_validate({"messages": [{"role": "user", "content": "hi"}], **extra})


def test_positive_control_undeclared_key_is_dropped_by_pydantic() -> None:
    """阳性对照:未声明的键会被静默丢弃。

    没有这一条,就无法证明"字段没落地"与"客户端没传"是两种不同情况 —— 而本票的缺陷正是被
    这两者的相似掩盖的。这一条必须**红着才有意义**:若 Pydantic 行为变了(不再丢未知键),
    本文件的形状锁就该由"补声明"改成别的处置。
    """
    req = _req(some_key_that_is_not_declared_anywhere="accept-edits")
    assert not hasattr(req, "some_key_that_is_not_declared_anywhere")


def test_wire_permission_mode_reaches_the_model() -> None:
    """声明之后,wire 上的 kebab 拼写必须真的落在模型属性上。"""
    assert _req(permission_mode="accept-edits").permission_mode == "accept-edits"
    assert _req(permission_mode="bypass-permissions").permission_mode == "bypass-permissions"
    assert _req().permission_mode is None


def _code_lines(source: str) -> str:
    """把整行注释摘掉再判 —— 本票的形状锁讲的是**代码里有没有人读这个键**,
    而解释这一段的注释必然要把坏写法原样写出来。不做遮蔽,注释会把自己咬红(实测踩过)。
    """
    return "\n".join(l for l in source.splitlines() if not l.strip().startswith("#"))


def test_ruler_masks_comments_it_is_testing() -> None:
    """反证:遮蔽层真的在挡注释。构造面里坏写法只出现在注释 ⇒ 判"没有";
    若哪天遮蔽层失效,这条会先红,而不是让上一条锁把仓库里每一段说明文字都判成缺陷。"""
    fixture = '# getattr(req, "permission_mode", None) 是坏写法\nreq.permission_mode\n'
    masked = _code_lines(fixture)
    assert 'getattr(req, "permission_mode"' not in masked
    assert "req.permission_mode" in masked


def test_consumer_reads_the_attribute_not_a_default_guard() -> None:
    code = _code_lines(LLM_PY.read_text(encoding="utf-8"))
    assert 'getattr(req, "permission_mode"' not in code, "又退回 getattr-with-default 了"
    # 计数锁:消费点少于 6 处 = 某条链路重新没人读它(现测真仓为 6 处)
    assert code.count("req.permission_mode") >= 6, f"现读 {code.count('req.permission_mode')} 处"


def test_danger_levels_fixture_is_not_empty() -> None:
    """枚举到 0 判死不记绿:判定表空了,后面的档位断言就全是自证。"""
    assert len(_TOOL_DANGER_LEVELS) > 0
    assert _TOOL_DANGER_LEVELS["run_command"] == "high"
    assert _TOOL_DANGER_LEVELS["write_file"] == "medium"


@pytest.mark.parametrize(
    "mode,tool,expect_approval",
    [
        # 用户显式选了完全访问 ⇒ 不拦(既有档位语义,不是本票新造)
        ("bypass-permissions", "run_command", False),
        ("bypassPermissions", "run_command", False),
        # accept-edits 只替用户批准"编辑类",命令执行/删除仍需点头
        ("accept-edits", "write_file", False),
        ("accept-edits", "run_command", True),
        # plan / default / None:收录的高危都要审批
        ("plan", "run_command", True),
        ("default", "run_command", True),
        (None, "run_command", True),
    ],
)
def test_tool_approval_gate_responds_to_the_selected_axis(
    mode: str | None, tool: str, expect_approval: bool
) -> None:
    """行为级:这一格在补声明之前是**拿不到客户端值**的,所以断言的从来不是新语义,
    而是"语义终于连上了"。"""
    needs, _danger = _resolve_tool_approval(mode, tool)
    assert needs is expect_approval


def test_normalize_accepts_both_spellings() -> None:
    assert _normalize_permission_mode("bypassPermissions") == "bypass-permissions"
    assert _normalize_permission_mode("accept-edits") == "accept-edits"
    assert _normalize_permission_mode(None) == "default"
    assert _normalize_permission_mode("不认识的档位") == "default"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
