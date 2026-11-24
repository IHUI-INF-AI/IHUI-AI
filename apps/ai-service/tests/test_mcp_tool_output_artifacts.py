# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

r"""批次 2(2026-11-06 立)MCP 输出护栏与续读工具回归。

钉住三件事:
 A 未超预算:原样返回、不落盘、不带 output_artifact 键(不多写凭据);
 B 超预算:先落盘完整结果,再按字符串叶子截断;返回体带 artifact_id/digest/
   bytes/chars/complete=false 与 output_continuation,且下一帧可读回**完整原文**;
 C read_tool_output 工具:非法 id/脏 offset 都不抛,返回稳定 ok/error 词。

隔离纪律:工件目录换到 tmp_path,不写仓库 `.ihui-agent`。
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import pytest

from app.services import mcp_server
from app.services import tool_output_artifacts as toa


@pytest.fixture(autouse=True)
def tmp_artifact_dir(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Path:
    dest = tmp_path / "tool-output"
    dest.mkdir()
    monkeypatch.setattr(toa, "artifact_dir", lambda: dest)
    return dest


def test_a_under_budget_returns_unchanged() -> None:
    """A 预算内:原样返回,不产生工件、不追加任何续读键。"""
    result = {"tool": "read_file", "ok": True, "content": "small"}
    out = mcp_server._truncate_tool_output(result, tool_name="read_file", session_id="s")
    assert out == result
    assert "output_artifact" not in out
    assert "truncated" not in out


def test_b_over_budget_spills_full_payload_before_truncating(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """B 超预算:工件里是截断前完整载荷,正文只留凭据。"""
    monkeypatch.setattr(mcp_server, "_get_tool_output_max_tokens", lambda: 10)
    result = {"tool": "run_command", "ok": True, "output": "A" * 800}
    full = toa.serialize_tool_payload(result)

    out = mcp_server._truncate_tool_output(result, tool_name="run_command", session_id="s-1")

    assert out["truncated"] is True
    artifact = out["output_artifact"]
    assert toa.ARTIFACT_ID_RE.match(str(artifact["artifact_id"]))
    assert artifact["chars"] == len(full)
    assert artifact["bytes"] == len(full.encode("utf-8"))
    assert artifact["complete"] is False
    assert artifact["truncated_on_disk"] is False
    assert "read_tool_output" in out["output_continuation"]
    assert str(artifact["artifact_id"]) in out["output_continuation"]
    # 正文确实被截短(不再等于完整载荷)
    assert len(json.dumps(out, ensure_ascii=False)) < len(full)


def test_b2_pages_reconstruct_full_output(monkeypatch: pytest.MonkeyPatch) -> None:
    """B2 从 artifact 分页可拼回完整原文,最后一页 complete=true。"""
    monkeypatch.setattr(mcp_server, "_get_tool_output_max_tokens", lambda: 10)
    result = {"tool": "run_command", "ok": True, "output": "B" * 600}
    full = toa.serialize_tool_payload(result)
    out = mcp_server._truncate_tool_output(result, tool_name="run_command", session_id="s-2")
    artifact_id = out["output_artifact"]["artifact_id"]

    chunks: list[str] = []
    offset = 0
    for _ in range(20):
        page = asyncio.run(
            mcp_server._tool_read_tool_output(
                {"artifact_id": artifact_id, "offset": offset, "limit": 100}
            )
        )
        assert page["ok"] is True
        chunks.append(page["content"])
        offset = page["next"]
        if page["complete"]:
            break

    assert "".join(chunks) == full
    assert page["complete"] is True


def test_b3_spill_failure_degrades_to_plain_truncation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """B3 落盘失败:仍截断,但**不带**伪凭据(不让模型读一个不存在的工件)。"""
    monkeypatch.setattr(mcp_server, "_get_tool_output_max_tokens", lambda: 10)
    monkeypatch.setattr(
        toa, "maybe_spill_tool_output", lambda *_a, **_k: (_ for _ in ()).throw(OSError("disk"))
    )
    out = mcp_server._truncate_tool_output(
        {"tool": "run_command", "ok": True, "output": "C" * 500}, tool_name="run_command"
    )
    assert out["truncated"] is True
    assert "output_artifact" not in out
    assert "output_continuation" not in out


def test_c_read_tool_output_unknown_id_and_dirty_args() -> None:
    """C 续读工具:非法 id 返回 unknown_artifact;脏 offset/limit 归默认值不抛。"""
    page = asyncio.run(mcp_server._tool_read_tool_output({"artifact_id": "../x"}))
    assert page["tool"] == "read_tool_output"
    assert page["ok"] is False
    assert page["error"] == "unknown_artifact"

    artifact = toa.maybe_spill_tool_output(
        "0123456789", tool_name="read_file", keep_chars=0, force=True
    )
    assert artifact is not None
    page = asyncio.run(
        mcp_server._tool_read_tool_output(
            {
                "artifact_id": artifact["artifactId"],
                "offset": "not-a-number",
                "limit": "also-bad",
            }
        )
    )
    assert page["ok"] is True
    assert page["offset"] == 0
    assert page["content"] == "0123456789"
    assert page["complete"] is True


def test_c2_missing_artifact_id_is_stable_error() -> None:
    """C2 缺 artifact_id ⇒ unknown_artifact(不进 read_tool_output_page 的异常路径)。"""
    page = asyncio.run(mcp_server._tool_read_tool_output({"artifact_id": ""}))
    assert page["ok"] is False
    assert page["error"] == "unknown_artifact"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
