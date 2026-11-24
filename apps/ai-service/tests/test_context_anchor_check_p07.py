# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""P0-7 回合前上下文自检钩子验收(2026-11-24)。

覆盖:默认关闭零开销 / 锚点完整零行为(正向对照)/ 锚点缺失触发回源重读 /
重读不可用降级不阻断 / 无路径锚点不扫描 / 双名参数键 / 本轮 assistant 消息
不计入历史 / 重读回调异常降级 / 接线回潮闸。
"""

from __future__ import annotations

import asyncio
import os
from pathlib import Path
from unittest.mock import AsyncMock

import pytest

from app.core import context_anchor_check as ac
from app.services.agent_loop_v2 import ToolCall


def _tc(name: str, args: dict[str, object]) -> ToolCall:
    return ToolCall(id="call-1", name=name, args=dict(args))


def _norm(path: str) -> str:
    return os.path.normcase(os.path.normpath(os.path.abspath(path)))


@pytest.fixture(autouse=True)
def _isolate(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(ac.ANCHOR_CHECK_ENV, raising=False)


def _truncated_messages(anchor: str) -> list[dict[str, object]]:
    """桩"已截断"上下文:历史里没有锚点,只有本轮 assistant(tool_calls) 带着它。"""
    return [
        {"role": "system", "content": "你是代码助手。"},
        {"role": "user", "content": "先前的对话已被压缩截断,旧文件引用已从上下文掉落。"},
        {
            "role": "assistant",
            "content": "",
            "tool_calls": [{"id": "call-1", "name": "edit_file", "args": {"path": anchor}}],
        },
    ]


# ---------------------------------------------------------------------------
# 开关与零开销
# ---------------------------------------------------------------------------


def test_disabled_by_default_zero_overhead(monkeypatch: pytest.MonkeyPatch) -> None:
    assert ac.anchor_check_enabled() is False
    anchor = os.path.join("proj", "src", "gone.py")
    messages = _truncated_messages(anchor)
    spy = AsyncMock()

    result = asyncio.run(
        ac.run_context_anchor_check(
            [_tc("edit_file", {"path": anchor})], messages, reread_callback=spy
        )
    )
    assert result.enabled is False
    assert result.checked == 0
    assert len(messages) == 3
    spy.assert_not_called()


@pytest.mark.parametrize("truthy", ["on", "1", "true", "yes", "ON"])
def test_enabled_env_truthy_values(monkeypatch: pytest.MonkeyPatch, truthy: str) -> None:
    monkeypatch.setenv(ac.ANCHOR_CHECK_ENV, truthy)
    assert ac.anchor_check_enabled() is True


def test_no_path_anchor_no_text_scan(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(ac.ANCHOR_CHECK_ENV, "on")
    messages: list[dict[str, object]] = [
        {"role": "user", "content": "北京天气怎么样"},
    ]
    spy = AsyncMock()
    result = asyncio.run(
        ac.run_context_anchor_check(
            [_tc("get_weather", {"city": "北京"})], messages, reread_callback=spy
        )
    )
    assert result.enabled is True
    assert result.checked == 0
    assert len(messages) == 1
    spy.assert_not_called()


# ---------------------------------------------------------------------------
# 正向对照:锚点完整 ⇒ 零行为
# ---------------------------------------------------------------------------


async def test_anchor_present_zero_behavior(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(ac.ANCHOR_CHECK_ENV, "on")
    anchor = os.path.join("proj", "src", "main.py")
    messages: list[dict[str, object]] = [
        {"role": "system", "content": "你是代码助手。"},
        {"role": "user", "content": f"请查看 {anchor} 的内容并修改。"},
        {
            "role": "assistant",
            "content": "",
            "tool_calls": [{"id": "call-1", "name": "edit_file", "args": {"path": anchor}}],
        },
    ]
    spy = AsyncMock()
    result = await ac.run_context_anchor_check(
        [_tc("edit_file", {"path": anchor})], messages, reread_callback=spy
    )
    assert result.missing == []
    assert _norm(anchor) in result.present
    assert len(messages) == 3
    assert result.messages_mutated is False
    spy.assert_not_called()


# ---------------------------------------------------------------------------
# 超越轴:锚点缺失 ⇒ 触发回源重读,而非直接下发工具
# ---------------------------------------------------------------------------


async def test_missing_anchor_triggers_reread(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setenv(ac.ANCHOR_CHECK_ENV, "on")
    gone = tmp_path / "gone.py"
    gone.write_text("print(1)\n", encoding="utf-8")
    anchor = str(gone)
    norm = _norm(anchor)
    messages = _truncated_messages(anchor)
    spy = AsyncMock(return_value="print(1) 重读内容")

    result = await ac.run_context_anchor_check(
        [_tc("edit_file", {"path": anchor})], messages, reread_callback=spy
    )

    assert result.missing == [norm]
    assert result.reread == [
        {"anchor": norm, "tools": ["edit_file"], "chars": len("print(1) 重读内容")}
    ]
    spy.assert_awaited_once_with(norm)
    assert result.messages_mutated is True
    # 重读片段已补回上下文
    appended = messages[-1]
    assert appended["role"] == "user"
    assert norm in str(appended["content"])
    assert "print(1) 重读内容" in str(appended["content"])
    # 审计痕迹落明细
    assert result.audit["missing"] == [norm]
    assert result.audit["reread"][0]["anchor"] == norm
    assert result.audit["iteration"] is None


async def test_reread_unavailable_recorded_not_blocking(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(ac.ANCHOR_CHECK_ENV, "on")
    anchor = os.path.join("proj", "src", "missing.py")
    norm = _norm(anchor)
    messages = _truncated_messages(anchor)
    spy = AsyncMock(return_value=None)

    result = await ac.run_context_anchor_check(
        [_tc("edit_file", {"path": anchor})], messages, reread_callback=spy
    )
    assert result.missing == [norm]
    assert result.unavailable == [{"anchor": norm, "tools": ["edit_file"]}]
    assert result.reread == []
    assert result.messages_mutated is False
    assert len(messages) == 3
    spy.assert_awaited_once_with(norm)


async def test_reread_callback_exception_is_degraded(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(ac.ANCHOR_CHECK_ENV, "on")
    anchor = os.path.join("proj", "src", "boom.py")
    norm = _norm(anchor)
    messages = _truncated_messages(anchor)

    async def _boom(_path: str) -> str:
        raise RuntimeError("read backend down")

    result = await ac.run_context_anchor_check(
        [_tc("read_file", {"path": anchor})], messages, reread_callback=_boom
    )
    assert result.unavailable == [{"anchor": norm, "tools": ["read_file"]}]
    assert result.messages_mutated is False


# ---------------------------------------------------------------------------
# 提取口径
# ---------------------------------------------------------------------------


def test_extracts_double_name_path_keys() -> None:
    assert ac.extract_path_anchors("edit_file", {"file_path": "/a/b.py"}) == [
        os.path.normcase(os.path.normpath(os.path.abspath("/a/b.py")))
    ]
    assert ac.extract_path_anchors("write_file", {"path": "/a/c.py"})
    # 非 str / 空值剔除
    assert ac.extract_path_anchors("write_file", {"path": 123, "file_path": "  "}) == []


def test_current_assistant_tool_calls_excluded_from_history(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """本轮 assistant 消息自身携带锚点,不得被当成"仍在历史上下文内"。"""
    monkeypatch.setenv(ac.ANCHOR_CHECK_ENV, "on")
    anchor = os.path.join("proj", "src", "self_ref.py")
    norm = _norm(anchor)
    messages = _truncated_messages(anchor)
    spy = AsyncMock(return_value=None)
    result = asyncio.run(
        ac.run_context_anchor_check(
            [_tc("edit_file", {"path": anchor})], messages, reread_callback=spy
        )
    )
    assert result.missing == [norm]


# ---------------------------------------------------------------------------
# 接线回潮闸
# ---------------------------------------------------------------------------


def test_wiring_invokes_check_before_tool_dispatch() -> None:
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    loop_text = (Path(here) / "app" / "services" / "agent_loop_v2.py").read_text(
        encoding="utf-8"
    )
    check_line = "await self._run_context_anchor_check(i, messages, tool_calls)"
    dispatch_line = "tool_results = await self._execute_tools(tool_calls)"
    assert check_line in loop_text
    assert loop_text.index(check_line) < loop_text.index(dispatch_line)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
