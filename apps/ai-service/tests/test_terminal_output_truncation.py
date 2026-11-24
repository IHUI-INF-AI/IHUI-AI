# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""终端输出截断交代(D34/D40 生产侧,2026-09-22 第 39 轮)。

判据:截断必须**可被发现**。SSE 帧与落库记录都只带截断后的文本,刷新/回放时客户端没有
live 缓冲可比对,所以 truncated + totalChars 必须随帧下发,且两侧口径一致。
"""

from __future__ import annotations

import json
from typing import Any

from app.core.sse_contract import SSE_EVENT_CONTRACTS
from app.routers.llm import (
    TERMINAL_OUTPUT_LIMIT,
    _build_terminal_task,
    _clip_terminal_output,
    _format_terminal_end_event,
)


def _frame_payload(evt: str) -> dict[str, Any]:
    """terminal_end 事件的 `data:` 行解析回字典(不假设冒号后有无空格)。"""
    line = next(x for x in evt.splitlines() if x.startswith("data:"))
    loaded = json.loads(line[5:].strip())
    assert isinstance(loaded, dict)
    return loaded


class TestClipTerminalOutput:
    def test_未超限不打截断标(self) -> None:
        shown, truncated, total = _clip_terminal_output("hello")
        assert (shown, truncated, total) == ("hello", False, 5)

    def test_超限给出截断文本与原始长度(self) -> None:
        raw = "x" * (TERMINAL_OUTPUT_LIMIT + 1234)
        shown, truncated, total = _clip_terminal_output(raw)
        assert len(shown) == TERMINAL_OUTPUT_LIMIT
        assert truncated is True
        assert total == len(raw)


class TestTerminalEndFrame:
    def test_短输出不带噪声字段(self) -> None:
        evt = _format_terminal_end_event(
            "t1", {"stdout": "ok"}, True, 0.0, message_id=None
        )
        payload = _frame_payload(evt)
        assert payload["output"] == "ok"
        assert payload["totalChars"] == 2
        assert "truncated" not in payload

    def test_长输出必须同时给截断标与总长(self) -> None:
        raw = "y" * (TERMINAL_OUTPUT_LIMIT + 5000)
        evt = _format_terminal_end_event("t2", {"output": raw}, True, 0.0, message_id="m1")
        payload = _frame_payload(evt)
        assert payload["truncated"] is True
        assert payload["totalChars"] == len(raw)
        assert len(payload["output"]) == TERMINAL_OUTPUT_LIMIT
        # 只截文本不改语义:界面据 totalChars 才知道"还有 5000 字没显示"
        assert payload["totalChars"] - len(payload["output"]) == 5000

    def test_无输出时不写空字段(self) -> None:
        payload = _frame_payload(
            _format_terminal_end_event("t3", {"stdout": ""}, True, 0.0, message_id=None)
        )
        assert "output" not in payload
        assert "truncated" not in payload
        assert "totalChars" not in payload


class TestPersistedRecordSameContract:
    def test_落库记录与SSE帧同口径(self) -> None:
        raw = "z" * (TERMINAL_OUTPUT_LIMIT + 77)
        rec = _build_terminal_task("t4", {"output": raw}, True, 0.0, "ls -l")
        assert rec["truncated"] is True
        assert rec["totalChars"] == len(raw)
        assert len(rec["output"]) == TERMINAL_OUTPUT_LIMIT


class TestContractDeclaresTheFields:
    def test_terminal_end契约字段(self) -> None:
        fields = next(
            c.payload_fields for c in SSE_EVENT_CONTRACTS if c.name == "terminal_end"
        )
        assert {"truncated", "totalChars"} <= set(fields)
        # 第 36 轮收回空壳帧后,不许再出现无生产点的 declared 字段
        assert "formattedOutput" not in fields
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
