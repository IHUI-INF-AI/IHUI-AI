# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""b76-04 票3 —— step 记录审计载荷有界化(truncated 位)行为测试。

钉上游 world-read-input 的另一半语义:审计输入必须有界,但"宁可诚实地说被截了"
—— 超字节上限 ⇒ truncated 位置 True,每项文本 ≤ itemMaxChars、
证据数组 ≤ evidenceArrayMaxItems,不许静默夹半截。
"""

from __future__ import annotations

import json

from app.services.agent_step_recorder import (
    STEP_RECORD_CAPS,
    AgentStepRecorder,
)

BYTE_CAP = STEP_RECORD_CAPS["auditInputMaxBytes"]["cap"]
ITEM_CAP = STEP_RECORD_CAPS["itemMaxChars"]["cap"]
ARRAY_CAP = STEP_RECORD_CAPS["evidenceArrayMaxItems"]["cap"]


def _audit_bytes(step: dict) -> int:
    return len(json.dumps(step, ensure_ascii=False, default=str).encode("utf-8"))


def test_caps_table_named_with_enforcement():
    """每条 cap 必须命名且标注 enforcement 侧(记录侧执行)。"""
    assert BYTE_CAP == 4096  # 与 TS 侧 parity(上游 WORLD_READ_INPUT_MAX_BYTES 同源)
    for entry in STEP_RECORD_CAPS.values():
        assert entry["cap"] > 0
        assert entry["enforcement"] == "记录侧执行"


def test_within_caps_original_payload_untouched(tmp_path):
    """快路径原样:未超限的载荷不置 truncated 位。"""
    rec = AgentStepRecorder(file_path=tmp_path / "step_records.json")
    step = rec.append_step(
        "run-1",
        {
            "type": "tool",
            "tool_name": "read",
            "input_summary": "小载荷",
            "result_summary": "ok",
            "diff": [f"line-{i}" for i in range(3)],
        },
    )
    assert step["truncated"] is False
    assert step["input_summary"] == '"小载荷"'
    assert step["diff"] == [f"line-{i}" for i in range(3)]  # 证据数组原样保留(仅做有界化)


def test_over_byte_cap_truncated_bit_and_bounds(tmp_path):
    """审计载荷超字节上限 ⇒ truncated===true、每项 ≤ itemMaxChars、数组 ≤ 8。"""
    rec = AgentStepRecorder(file_path=tmp_path / "step_records.json")
    big_array = [f"evidence-{i:04d}" for i in range(40)]
    step = rec.append_step(
        "run-1",
        {
            "type": "tool",
            "tool_name": "write",
            "input_summary": {"blob": "字" * 2000},
            "result_summary": "果" * 2000,
            "diff": big_array,  # 40 项 > 8 ⇒ 有界化
        },
    )
    assert step["truncated"] is True
    # 每项文本 ≤ 单项目上限
    assert len(step["input_summary"]) <= ITEM_CAP
    assert len(step["result_summary"]) <= ITEM_CAP
    for key in ("input", "diff", "test", "rollback"):
        v = step.get(key)
        if isinstance(v, str):
            assert len(v) <= ITEM_CAP, key
        if isinstance(v, list):
            assert len(v) <= ARRAY_CAP, key
            for item in v:
                if isinstance(item, str):
                    assert len(item) <= ITEM_CAP, key
    # 整体字节上限也必须落住
    assert _audit_bytes(step) <= BYTE_CAP


def test_evidence_array_over_8_items_bounded(tmp_path):
    """数组恰 8 项 ⇒ 原样;8+1 项 ⇒ 截到 ≤ 8 且置位。"""
    rec = AgentStepRecorder(file_path=tmp_path / "step_records.json")
    exactly = [f"i{i}" for i in range(ARRAY_CAP)]
    ok_step = rec.append_step("r1", {"tool_name": "t", "diff": list(exactly)})
    assert ok_step["diff"] == exactly
    assert ok_step["truncated"] is False

    over = [f"i{i}" for i in range(ARRAY_CAP + 1)]
    cut = rec.append_step("r2", {"tool_name": "t", "diff": list(over)})
    assert len(cut["diff"]) <= ARRAY_CAP
    assert cut["truncated"] is True


def test_oversize_string_item_bounded(tmp_path):
    """单项字符串超 itemMaxChars ⇒ 截到上限并置位。"""
    rec = AgentStepRecorder(file_path=tmp_path / "step_records.json")
    step = rec.append_step("r1", {"tool_name": "t", "test": "t" * (ITEM_CAP + 500)})
    assert len(step["test"]) <= ITEM_CAP
    assert step["truncated"] is True
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
