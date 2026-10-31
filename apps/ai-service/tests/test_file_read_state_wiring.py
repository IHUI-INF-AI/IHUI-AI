# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""读侧登记 / 编辑前脏判定 / 自我写入登记 —— 三处生产接线用例。

背景:2026-10-31 前 `read_file` / `write_file` / `file_edit` 只在本模块顶部 import 了
`record_read` / `record_self_write` / `judge_read_state` / `read_state_field`,一次都没调
(ruff F401 是唯一线索) —— 「造好没装车」。本册钉住接线后的五条不变式:

1. read_file 成功 ⇒ 登记 (session, path);同会话紧接着 file_edit 判 fresh(不误报)
2. 他处改盘 ⇒ 默认档 file_edit 仍写成功,只返回体点名 stale + 归因(不拒写)
3. 显式严格档 ∧ stale ⇒ 拒写,且盘上字节未变(副作用断言,§5)
4. write_file 之后 ⇒ 自我写入登记;再 file_edit 判 fresh 而非「他席覆盖」
5. 无会话身份 ⇒ 判定落 undetermined 且不拦(失效方向=多要一次说明,不冒绿也不加拦门)
"""

from __future__ import annotations

from pathlib import Path

import pytest

from app.core import file_read_state
from app.services import mcp_server


@pytest.fixture(autouse=True)
def _isolated_workspace(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> Path:
    file_read_state._reset_read_state_store()
    mcp_server._reset_file_base_store()
    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", str(tmp_path))
    monkeypatch.delenv("FILE_READ_STATE_STRICT", raising=False)
    yield tmp_path
    file_read_state._reset_read_state_store()


def _mk(root: Path, name: str = "a.txt", body: str = "hello\n") -> Path:
    p = root / name
    p.write_text(body, encoding="utf-8")
    return p


async def test_read_then_edit_is_fresh(_isolated_workspace: Path) -> None:
    p = _mk(_isolated_workspace)
    read = await mcp_server._tool_read_file({"path": str(p), "__session_id": "s1"})
    assert read["ok"] is True

    verdict = file_read_state.judge_read_state("s1", str(p))
    assert verdict["verdict"] == "fresh"

    edit = await mcp_server._tool_file_edit(
        {
            "file_path": str(p),
            "old_string": "hello",
            "new_string": "hi",
            "__session_id": "s1",
        }
    )
    assert edit["ok"] is True
    assert edit["readState"]["verdict"] == "fresh"


async def test_external_change_is_reported_but_not_blocking(
    _isolated_workspace: Path,
) -> None:
    p = _mk(_isolated_workspace)
    await mcp_server._tool_read_file({"path": str(p), "__session_id": "s1"})
    p.write_text("hello\n外部又改了一行\n", encoding="utf-8")

    edit = await mcp_server._tool_file_edit(
        {
            "file_path": str(p),
            "old_string": "hello",
            "new_string": "hi",
            "__session_id": "s1",
        }
    )
    assert edit["ok"] is True
    assert edit["readState"]["verdict"] == "stale"
    assert edit["readState"]["blocking"] is False


async def test_strict_mode_refuses_stale_write(_isolated_workspace: Path) -> None:
    p = _mk(_isolated_workspace)
    await mcp_server._tool_read_file({"path": str(p), "__session_id": "s1"})
    external = "hello\n外部又改了一行\n"
    p.write_text(external, encoding="utf-8")

    edit = await mcp_server._tool_file_edit(
        {
            "file_path": str(p),
            "old_string": "hello",
            "new_string": "hi",
            "read_state_strict": True,
            "__session_id": "s1",
        }
    )
    assert edit["ok"] is False
    assert edit["errorCode"] == "STALE_READ_CONFIRMATION_REQUIRED"
    assert edit["readState"]["blocking"] is True
    # 副作用断言:拒绝了就一个字节都不许落盘
    assert p.read_text(encoding="utf-8") == external


async def test_write_file_records_self_write(_isolated_workspace: Path) -> None:
    p = _isolated_workspace / "b.txt"
    wrote = await mcp_server._tool_write_file(
        {"path": str(p), "content": "v1\n", "__session_id": "s1"}
    )
    assert wrote["ok"] is True

    verdict = file_read_state.judge_read_state("s1", str(p))
    assert verdict["verdict"] == "fresh"
    assert verdict["reason"] == "unchanged_since_self_write"

    edit = await mcp_server._tool_file_edit(
        {
            "file_path": str(p),
            "old_string": "v1",
            "new_string": "v2",
            "__session_id": "s1",
        }
    )
    assert edit["ok"] is True
    assert edit["readState"]["verdict"] == "fresh"


async def test_missing_session_is_undetermined_never_blocking(
    _isolated_workspace: Path,
) -> None:
    p = _mk(_isolated_workspace)
    read = await mcp_server._tool_read_file({"path": str(p)})
    assert read["ok"] is True

    edit = await mcp_server._tool_file_edit(
        {"file_path": str(p), "old_string": "hello", "new_string": "hi"}
    )
    assert edit["ok"] is True
    assert edit["readState"]["verdict"] == "undetermined"
    assert edit["readState"]["blocking"] is False
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
