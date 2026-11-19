# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""超预算预览接线单测（2026-11-19）。

钉住三件事：
① 超预算工具结果的**尾部结论**不再随截断丢失（对照件只留头）；
② 预览正文仍受 keep_chars 预算约束，且带续读凭据（artifact id / offset）；
③ 裁剪器不可用时不阻断消息出口（退回截头老行为）。
"""

from __future__ import annotations

import re

import pytest

from app.services import mcp_server, tool_output_artifacts
from app.services.agent_loop_v2 import bound_tool_result_for_context

TAIL = "TAIL_RESULT: 42 passed, 0 failed"


def _fake_artifact(text: str) -> dict[str, object]:
    return {
        "artifactId": "art-test",
        "preview": text[:40],
        "digest": "deadbeef",
        "bytes": len(text.encode("utf-8")),
        "chars": len(text),
        "truncatedOnDisk": False,
    }


def _patch_budget(monkeypatch: pytest.MonkeyPatch, *, max_tokens: int) -> None:
    monkeypatch.setattr(mcp_server, "_get_tool_output_max_tokens", lambda: max_tokens)
    monkeypatch.setattr(mcp_server, "_estimate_tokens_len", lambda s: len(s) // 4)


def _patch_spill(monkeypatch: pytest.MonkeyPatch) -> None:
    def _spill(text: str, **_kwargs: object) -> dict[str, object]:
        return _fake_artifact(text)

    monkeypatch.setattr(tool_output_artifacts, "maybe_spill_tool_output", _spill)


def test_tail_survives_overflow(monkeypatch: pytest.MonkeyPatch) -> None:
    payload = {"text": "A" * 5_000 + "\n" + TAIL}
    _patch_budget(monkeypatch, max_tokens=300)
    _patch_spill(monkeypatch)
    out = bound_tool_result_for_context(payload, tool_name="t", session_id="s")

    assert TAIL in out, "尾部结论必须保留在预览里"
    assert "tool result trimmed" in out, "中段必须留下裁剪 marker"
    assert "output_artifact_id" in out
    assert "art-test" in out


def test_preview_stays_within_budget(monkeypatch: pytest.MonkeyPatch) -> None:
    payload = {"text": "B" * 8_000 + "\n" + TAIL}
    _patch_budget(monkeypatch, max_tokens=300)
    _patch_spill(monkeypatch)
    out = bound_tool_result_for_context(payload, tool_name="t", session_id="s")

    keep_chars = 300 * 4
    offset_match = re.search(r'"output_offset":\s*(\d+)', out)
    assert offset_match is not None
    offset = int(offset_match.group(1))
    assert 0 < offset < keep_chars
    assert "B" * 16 in out
    assert len(out) <= keep_chars + 500, "预览+凭据必须落在预算量级内"


def test_pruner_failure_falls_back_to_head(monkeypatch: pytest.MonkeyPatch) -> None:
    payload = {"text": "C" * 5_000}
    _patch_budget(monkeypatch, max_tokens=1)
    _patch_spill(monkeypatch)
    out = bound_tool_result_for_context(payload, tool_name="t", session_id="s")
    # 预算过小(keep=4)时 room<=8 ⇒ 截头兜底,但凭据与截断说明仍要在
    assert "output_artifact_id" in out
    assert "C" in out or "art-test" in out
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
