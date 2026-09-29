# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""R3:任务流(agents.py)与主对话流共用同一份帧级 traceId 注入实现。

立票理由不是"少一个键",而是**两条流各自拼帧**时判序会漂开:漂开的表现是
"主对话流的帧能对上 llm_call_logs 里的对账键、任务流的帧对不上",
而两端都自检通过、没有任何报错 —— 属本仓最难归因的那一型。

三条断言各钉一侧:
① 注入逻辑只有一份实现(源文件层面:llm 路由里不得再留着第二份函数体);
② 任务流的 `data:` 帧在**无 trace** 时也要被剥掉自写的 traceId(与主对话流同规则,
   否则"缺席"在两条流上含义不同);
③ 有 trace 时任务流的帧确实带上小写 32 hex 的值。
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import pytest

from app import routers
from app.core import sse_frames
from app.routers import agents as agents_mod

TRACE_RE = re.compile(r'"traceId":\s*"([0-9a-f]{32})"')


def _llm_source() -> str:
    root = Path(getattr(routers, "__file__", "")).resolve().parent
    return (root / "llm.py").read_text(encoding="utf-8")


def test_注入点只有一份实现() -> None:
    src = _llm_source()
    # llm 路由必须引用共享实现,且不得再留第二份函数体(留着就会与 core 那份漂开)
    assert "from ..core.sse_frames import with_frame_trace_id" in src
    assert "def _with_frame_trace_id(" not in src, "llm.py 里仍有第二份注入实现"


def test_任务流_无有效trace时剥掉自写键(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(sse_frames, "sse_frame_trace_id", lambda: None)
    framed: dict[str, Any] = sse_frames.with_frame_trace_id(
        "message",
        {"type": "message", "traceId": "deadbeef" * 4},
    )
    assert "traceId" not in framed, "自写的无出处值被留在帧上 ⇒ 与主对话流规则不一致"


def test_任务流_有trace时_format_sse_带上小写十六进制键(monkeypatch: pytest.MonkeyPatch) -> None:
    trace = "0af7651916cd43dd8448eb211c80319c"
    monkeypatch.setattr(sse_frames, "sse_frame_trace_id", lambda: trace)
    wire = agents_mod._format_sse("7", {"type": "message", "delta": "hi"})
    assert f'"traceId": "{trace}"' in wire
    assert wire.startswith("id: 7\nevent: message\n"), wire


def test_任务流_兼容面事件不被加键(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.core.sse_contract import SSE_COMPAT_EVENTS

    compat = sorted(SSE_COMPAT_EVENTS)[0]
    monkeypatch.setattr(sse_frames, "sse_frame_trace_id", lambda: "0af7651916cd43dd8448eb211c80319c")
    payload: dict[str, Any] = {"type": compat, "text": "x"}
    framed = sse_frames.with_frame_trace_id(compat, payload)
    assert "traceId" not in framed, "兼容面(wire 与 Anthropic 官方一致)不得被加我方自定键"
    # 工厂不改入参:上面返回的必须仍是同一个对象(不改拷贝)
    assert framed is payload


def test_帧内值是合法32hex() -> None:
    from app.core import sse_frames as mod

    mod_id = mod.with_frame_trace_id("message", {"type": "message"})
    # 无 trace 上下文时不该出现键(测试进程未起 middleware ⇒ trace_id 为 None)
    assert "traceId" not in mod_id
    wire_like = json.dumps({"traceId": "A" * 32})
    assert TRACE_RE.search(wire_like) is None, "大写不该被认作合法值(本正则只认小写)"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
