# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D113 跨语言对账的 **Python 侧那一半**。

分工(刻意不重复,否则又是一把尺子抄两遍 —— 守门 139 同一课):
  · 本文件 = **服务端自证**:`llm.py` 的 `_file_edit_preview_text` / `_file_edit_preview_frames`
    重算台账里的每一格,必须仍等于台账期望值。改了服务端语义而没重生成台账 ⇒ 这里红。
  · `apps/cli/tests/file-edit-preview-parity.test.ts` = **镜像自证 + 常量对账**:TS 实现重算同一批
    向量,并静态解析本仓 llm.py(HEAD 面)的预算常量 / 工具名 frozenset / 取键表与 TS 常量比对。
    改了 TS 镜像、或只改一侧的数字 ⇒ 那里红。
  两侧读**同一份台账**,故"镜像与服务端同语义"是传递闭包,不需要任一侧去执行另一侧的语言
  (不 spawn node / 不 spawn python:那会把"作者机能跑"当成"门禁能跑",AGENTS §22c 同型)。

台账期望值的重新生成(改服务端语义后的**唯一**合法出口,不是手改 JSON):
    cd apps/ai-service
    ./.venv/Scripts/python.exe -c "见 fixtures/file-edit-preview-cases.json 的 \\$comment"
  即:import app.routers.llm as L;对每格 (tool_name, args) 取
      expected = {"text": L._file_edit_preview_text(t, a),
                  "frames": [{"partialText": p, "truncated": bool(x)}
                             for p, x in L._file_edit_preview_frames(L._file_edit_preview_text(t, a) or "")]}
  重算后**同步**核对 TS 镜像是否跟着变(它必须变绿才算"两端仍同语义")。

零外部依赖:不连 PG / Redis(§5 测试隔离铁律),不触碰磁盘。
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

from app.routers.llm import (
    _FILE_EDIT_PREVIEW_TOOLS,
    _PREVIEW_LINES_PER_FRAME,
    _PREVIEW_MAX_CHARS,
    _PREVIEW_MAX_FRAMES,
    _PREVIEW_MAX_LINES,
    _file_edit_preview_frames,
    _file_edit_preview_text,
)

REPO = Path(__file__).resolve().parents[3]
LEDGER_PATH = REPO / "apps/ai-service/tests/fixtures/file-edit-preview-cases.json"


def _ledger() -> dict[str, Any]:
    assert LEDGER_PATH.is_file(), f"台账文件不在位:{LEDGER_PATH} —— 判据失明不是通过"
    return json.loads(LEDGER_PATH.read_text(encoding="utf-8"))


def _frames_of(text: str | None) -> list[dict[str, Any]]:
    if not text:
        return []
    return [
        {"partialText": part, "truncated": bool(flag)}
        for part, flag in _file_edit_preview_frames(text)
    ]


def test_ledger_declares_python_provenance_and_is_not_empty() -> None:
    data = _ledger()
    # 期望值必须出自 Python 侧,否则"服务端自证"会变成镜像给自己发合格证
    assert "python" in str(data.get("generatedBy", "")).lower()
    cases = data.get("cases") or []
    assert len(cases) > 0, "台账为空 = 恒绿尺子"
    # 判据分支必须都有向量,否则台账可以被削成"只覆盖最简单那一格"
    assert any(c["expected"]["text"] is None for c in cases)
    assert any(len(c["expected"]["frames"]) >= 2 for c in cases)
    assert any(f["truncated"] for c in cases for f in c["expected"]["frames"])
    assert any(len(c["expected"]["frames"]) == _PREVIEW_MAX_FRAMES for c in cases)


def test_budget_constants_match_ledger() -> None:
    data = _ledger()
    assert data["budget"] == {
        "maxFrames": _PREVIEW_MAX_FRAMES,
        "linesPerFrame": _PREVIEW_LINES_PER_FRAME,
        "maxLines": _PREVIEW_MAX_LINES,
        "maxChars": _PREVIEW_MAX_CHARS,
    }
    assert sorted(_FILE_EDIT_PREVIEW_TOOLS) == sorted(data["previewToolNames"])


def test_shared_key_table_matches_ledger() -> None:
    """服务端取键规则未被改动(台账记的是共享子集,CLI 扩展不在此列)。"""
    data = _ledger()
    table = data["sharedKeyTable"]
    assert sorted(table) == sorted(_FILE_EDIT_PREVIEW_TOOLS)
    assert _file_edit_preview_text("write_file", {"content": "x"}) == "x"
    assert _file_edit_preview_text("file_edit", {"new_string": "y"}) == "y"
    assert _file_edit_preview_text("edit_file", {"new_string": "z"}) == "z"
    # 非 string / 未知工具 / 缺键一律派生不出(镜像若放宽,TS 侧对账会红)
    assert _file_edit_preview_text("write_file", {"content": 123}) is None
    assert _file_edit_preview_text("write_file", {}) is None
    assert _file_edit_preview_text("read_file", {"content": "x"}) is None


@pytest.mark.parametrize("case", _ledger()["cases"], ids=lambda c: c["id"])
def test_case_matches_ledger(case: dict[str, Any]) -> None:
    text = _file_edit_preview_text(case["toolName"], case["args"])
    assert text == case["expected"]["text"], f"{case['id']}: 文本漂移"
    assert _frames_of(text) == case["expected"]["frames"], f"{case['id']}: 帧序列漂移"


def test_cli_local_extension_is_a_declared_divergence() -> None:
    """CLI 给 edit_file 兜了 replace 键 —— 服务端**必须**仍然派生不出,否则那条已声明的
    分歧悄悄变成了"两边各有一套",而 TS 侧的 equality 断言会跟着一起漂绿。"""
    case = next(
        (c for c in _ledger()["cases"] if c["id"] == "edit_file_replace_only_cli_local_key"),
        None,
    )
    assert case is not None, "台账里这条分歧向量不得删除(TS 侧靠它约束扩展键)"
    assert case["expected"]["text"] is None
    assert _file_edit_preview_text("edit_file", {"search": "a", "replace": "b"}) is None
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
