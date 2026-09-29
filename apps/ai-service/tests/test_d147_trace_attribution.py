# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D147(2026-09-29 立)常驻回归:工具调用记录必须带 trace.id,且**不得带原文与凭据**。

交付报告里这两条原本只是一次"证据跑"(RC 已落件,但仓库里没有尺子)。
落进仓库的理由:trace 属性写脏之后的表现不是报错,而是"排查时才发现链断了/密钥进了日志"——
那一格只有拿真输入喂一次才知道,而没有任何人会主动去查。
"""

from __future__ import annotations

import re

from app.core.tool_call_trace import received as trace_received  # type: ignore[attr-defined]
from app.middleware.trace_context import use_trace_id  # type: ignore[attr-defined]

TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736"
SECRET = "sk-SUPERSECRETVALUE0123456789"
PROMPT = "请把这段 prompt 原文发给我,里面写着 " + SECRET


def _record_for(text: str) -> dict[str, object]:
    """在一条已绑定的 trace 下产出一张调用记录,返回它的 dict 形态。

    `as_dict()` 是**现取** contextvar 的(见 tool_call_trace.py:91),所以序列化必须
    发生在 trace 绑定期内 —— 第一版本测试把 as_dict() 写在 with 之外,得到 None,
    那是我自己用错了时刻,不是实现的缺陷。这一格值得留在测试里:
    "什么时候序列化"会改变结果,而调用点看起来完全一样。
    """
    with use_trace_id(TRACE_ID):
        event = trace_received("thread-1", text, "call-1")
        assert event is not None, "received() 在 trace 已绑定时必须产出记录"
        return event.as_dict() if hasattr(event, "as_dict") else dict(event)


def test_trace_id_propagates_into_call_record() -> None:
    """① 绑定 trace 后落库字段在位,且等于当轮那一条(不是空、不是 0)。"""
    record = _record_for("读取文件: src/index.ts")
    assert record.get("trace.id") == TRACE_ID


def test_prompt_and_credential_never_enter_trace_attributes() -> None:
    """② 阳性对照:整条记录序列化后**搜不到**prompt 原文与凭据。

    这条是票面第 4 项的硬要求。只断言"有个 traceId 字段"不构成验收 ——
    真正会出事的是为了排查方便把 payload 原样塞进属性。
    """
    record = _record_for(PROMPT)
    dumped = repr(record)
    assert SECRET not in dumped, "凭据原文进了 trace 导出"
    assert "请把这段 prompt 原文" not in dumped, "prompt 原文进了 trace 导出"
    assert record.get("trace.id") == TRACE_ID, "脱敏不能以丢掉编号为代价"


def test_unbound_context_yields_no_fake_trace_id() -> None:
    """③ 反向对照:没绑定 trace 时不得造一个"看起来像"的 id(宁缺勿造)。"""
    event = trace_received("thread-1", "无 trace 上下文的一条记录", "call-0")
    record = event.as_dict() if hasattr(event, "as_dict") else dict(event)
    value = record.get("trace.id")
    assert value is None or value == "", f"未绑定时不得有值,实得 {value!r}"
    assert not re.fullmatch(r"[0-9a-f]{32}", str(value or ""))
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
