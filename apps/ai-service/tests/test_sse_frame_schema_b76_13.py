# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""b76-13 票2:出站帧的字段级结构不变量 —— 生产侧判据钉子。

断言打在生产判据出口 app/core/sse_contract.py::sse_frame_schema_fault 上:
枚举闭合、必要字段对(truncated=true ⇒ totalChars)、form_response 跨字段成对
(拒绝零副作用);装饰性字段坏型不杀帧;表外事件名不冒充判过。
"""

from importlib import import_module

sc = import_module("app.core.sse_contract")


def test_enum_closure_terminal_end_status():
    bad = sc.sse_frame_schema_fault("terminal_end", {"status": "cancelled", "durationMs": 5})
    assert bad and any("status" in i for i in bad)
    ok = sc.sse_frame_schema_fault("terminal_end", {"status": "completed", "durationMs": 5})
    assert ok == []


def test_required_pair_truncated_total_chars():
    bad = sc.sse_frame_schema_fault(
        "terminal_end", {"status": "completed", "truncated": True, "durationMs": 5}
    )
    assert any("totalChars" in i for i in bad), "截断却不知道截掉多少 ⇒ 必须 fault"
    ok = sc.sse_frame_schema_fault(
        "terminal_end",
        {"status": "completed", "truncated": True, "totalChars": 1024, "durationMs": 5},
    )
    assert ok == []


def test_form_response_pair_invariants():
    # approve 不得带理由,必须带 values
    bad = sc.sse_frame_schema_fault(
        "form_response", {"action": "approve", "reject_reason": "x"}
    )
    assert any("approve" in i for i in bad)
    # reject 不得带 values(拒绝零副作用),必须带理由
    bad2 = sc.sse_frame_schema_fault(
        "form_response", {"action": "reject", "values": {"to": "x@y.z"}}
    )
    assert any("reject" in i for i in bad2)
    ok = sc.sse_frame_schema_fault(
        "form_response", {"action": "reject", "reject_reason": "不发了"}
    )
    assert ok == []


def test_decorative_fields_do_not_kill_frame():
    # output 是装饰档:坏型不进 fault 判据(降级展示,卡片退化成纯文本)
    faults = sc.sse_frame_schema_fault(
        "terminal_end", {"status": "completed", "output": 42, "durationMs": 5}
    )
    assert faults == []


def test_out_of_scope_event_is_not_judged():
    # 表外事件名:空清单 = 不在射程,不冒充判过
    assert sc.sse_frame_schema_fault("chunk", {"content": "hi"}) == []


def test_non_dict_payload_is_fault_for_registered_frames():
    faults = sc.sse_frame_schema_fault("terminal_end", "not-a-dict")
    assert faults and "dict" in faults[0]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
