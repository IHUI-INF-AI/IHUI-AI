# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""原子写 + 大文件分页读的不变式。

1. write_file 自动建父目录(模型不必先跑 mkdir);
2. 替换失败时目标仍是旧完整内容,临时件不残留;
3. 既有文件权限位在替换后保持;
4. read_file 传 offset/limit 时返回带行号窗口、总行数与下一页提示,
   不传时保持整文件旧契约;越界/非法参数显式报错。
"""

from __future__ import annotations

import os
import stat
from pathlib import Path

import pytest

from app.services import mcp_server
from app.utils import atomic_io


@pytest.fixture(autouse=True)
def _isolated_workspace(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> Path:
    mcp_server._reset_file_base_store()
    monkeypatch.setenv("MCP_WORKSPACE_ROOTS", str(tmp_path))
    yield tmp_path
    mcp_server._reset_file_base_store()


# ---------------------------------------------------------------------------
# 原子写
# ---------------------------------------------------------------------------


async def test_write_file_creates_parent_dirs(_isolated_workspace: Path) -> None:
    p = _isolated_workspace / "deep" / "nested" / "a.txt"
    result = await mcp_server._tool_write_file({"path": str(p), "content": "v1\n"})
    assert result["ok"] is True
    assert p.read_text(encoding="utf-8") == "v1\n"


async def test_write_file_empty_content_roundtrip(_isolated_workspace: Path) -> None:
    p = _isolated_workspace / "empty-write.txt"
    result = await mcp_server._tool_write_file({"path": str(p), "content": ""})
    assert result["ok"] is True
    assert p.read_bytes() == b""
    read = await mcp_server._tool_read_file({"path": str(p)})
    assert read["ok"] is True
    assert read["content"] == ""


async def test_write_file_replace_failure_keeps_old_bytes(
    _isolated_workspace: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    p = _isolated_workspace / "a.txt"
    p.write_text("old\n", encoding="utf-8")

    def _boom(tmp: str, target: Path) -> None:
        raise OSError("replace failed")

    monkeypatch.setattr(atomic_io, "_replace_with_retry", _boom)
    result = await mcp_server._tool_write_file({"path": str(p), "content": "new\n"})
    assert result["ok"] is False
    # 失败方向:旧文件一个字节都不变,临时件清理干净
    assert p.read_text(encoding="utf-8") == "old\n"
    assert list(_isolated_workspace.glob(".*.tmp")) == []


@pytest.mark.skipif(os.name == "nt", reason="Windows 不保证 POSIX 权限位")
async def test_write_file_preserves_existing_mode(_isolated_workspace: Path) -> None:
    p = _isolated_workspace / "mode.txt"
    p.write_text("old\n", encoding="utf-8")
    p.chmod(0o640)
    result = await mcp_server._tool_write_file({"path": str(p), "content": "new\n"})
    assert result["ok"] is True
    assert stat.S_IMODE(p.stat().st_mode) == 0o640


# ---------------------------------------------------------------------------
# 分页读
# ---------------------------------------------------------------------------


async def test_read_file_default_keeps_raw_contract(_isolated_workspace: Path) -> None:
    p = _isolated_workspace / "plain.txt"
    p.write_text("a\nb\n", encoding="utf-8")
    result = await mcp_server._tool_read_file({"path": str(p)})
    assert result["ok"] is True
    assert result["content"] == "a\nb\n"


async def test_read_file_window_line_numbers_and_next_offset(
    _isolated_workspace: Path,
) -> None:
    p = _isolated_workspace / "w.txt"
    p.write_text("l1\nl2\nl3\nl4\n", encoding="utf-8")
    result = await mcp_server._tool_read_file({"path": str(p), "offset": 2, "limit": 2})
    assert result["ok"] is True
    assert result["offset"] == 2
    assert result["totalLines"] == 4
    content = result["content"]
    assert "2: l2" in content
    assert "3: l3" in content
    assert "1: l1" not in content
    assert "4: l4" not in content
    assert "offset=4" in content


async def test_read_file_window_rejects_out_of_range(
    _isolated_workspace: Path,
) -> None:
    p = _isolated_workspace / "short.txt"
    p.write_text("only\n", encoding="utf-8")
    result = await mcp_server._tool_read_file({"path": str(p), "offset": 5})
    assert result["ok"] is False
    assert result["errorCode"] == "OFFSET_OUT_OF_RANGE"
    assert result["totalLines"] == 1


async def test_read_file_window_rejects_bad_limit(_isolated_workspace: Path) -> None:
    p = _isolated_workspace / "short.txt"
    p.write_text("only\n", encoding="utf-8")
    result = await mcp_server._tool_read_file({"path": str(p), "limit": 2001})
    assert result["ok"] is False
    assert result["errorCode"] == "INVALID_ARGUMENT"


async def test_read_file_window_truncates_long_line(_isolated_workspace: Path) -> None:
    p = _isolated_workspace / "long.txt"
    p.write_text("x" * 2500 + "\nshort\n", encoding="utf-8")
    result = await mcp_server._tool_read_file({"path": str(p), "offset": 1, "limit": 2})
    assert result["ok"] is True
    assert "已截断" in result["content"]
    assert "short" in result["content"]


async def test_read_file_window_stops_at_byte_cap(_isolated_workspace: Path) -> None:
    p = _isolated_workspace / "big.txt"
    p.write_text("\n".join("y" * 100 for _ in range(1200)) + "\n", encoding="utf-8")
    result = await mcp_server._tool_read_file({"path": str(p), "offset": 1, "limit": 2000})
    assert result["ok"] is True
    assert result["truncatedByBytes"] is True
    assert "至字节上限" in result["content"]


async def test_read_file_window_empty_file(_isolated_workspace: Path) -> None:
    p = _isolated_workspace / "empty.txt"
    p.write_text("", encoding="utf-8")
    result = await mcp_server._tool_read_file({"path": str(p), "offset": 1})
    assert result["ok"] is True
    assert result["totalLines"] == 0
    assert "共 0 行" in result["content"]
