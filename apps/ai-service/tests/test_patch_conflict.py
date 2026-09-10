# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""P1 1-2 补丁冲突处理集成测试(2026-09-08 立)。

覆盖 MCP 层完整链路:
- read_file 建立 base 版本跟踪
- file_edit 直接路径不受影响(回归保护)
- 外部修改 + 不相交区域 → 3-way 干净合并自动落盘(strategy=auto_merged_3way)
- 外部修改 + 重叠区域 → CONFLICT(不写盘),resolve_conflict 按块决策落盘
- resolve_conflict 局部拒绝(theirs = 保留磁盘现状)
- write_file / read_file 刷新 base
- 注册表一致性 + admin 限制
"""

from __future__ import annotations

from pathlib import Path

import pytest

from app.services import mcp_server
from app.services.mcp_server import (
    _ADMIN_ONLY_TOOLS,
    _TOOLS,
    _TOOL_HANDLERS,
    _tool_file_edit,
    _tool_read_file,
    _tool_resolve_conflict,
    _tool_write_file,
)


@pytest.fixture(autouse=True)
def _workspace_root(monkeypatch, tmp_path):
    """工作区白名单重定向到 tmp_path + 清空 base 版本跟踪(测试隔离)。"""
    monkeypatch.setattr(
        mcp_server, "_get_workspace_roots", lambda: [str(tmp_path.resolve())]
    )
    mcp_server._reset_file_base_store()
    yield tmp_path
    mcp_server._reset_file_base_store()


async def _read(path) -> dict:
    return await _tool_read_file({"path": str(path)})


async def _edit(file_path, old_string, new_string, replace_all=False) -> dict:
    return await _tool_file_edit({
        "file_path": str(file_path),
        "old_string": old_string,
        "new_string": new_string,
        "replace_all": replace_all,
    })


async def _resolve(file_path, old_string, new_string, choices, replace_all=False) -> dict:
    return await _tool_resolve_conflict({
        "file_path": str(file_path),
        "old_string": old_string,
        "new_string": new_string,
        "choices": choices,
        "replace_all": replace_all,
    })


def _write_direct(path: Path, content: str) -> None:
    """绕过 MCP 工具直接写盘(模拟外部并发修改)。"""
    path.write_text(content, encoding="utf-8")


# =============================================================================
# 注册表一致性
# =============================================================================

def test_resolve_conflict_registered():
    assert "resolve_conflict" in _TOOL_HANDLERS
    assert _TOOL_HANDLERS["resolve_conflict"] is _tool_resolve_conflict
    assert "resolve_conflict" in [t.name for t in _TOOLS]
    assert "resolve_conflict" in _ADMIN_ONLY_TOOLS


def test_resolve_conflict_schema():
    schema = next(t for t in _TOOLS if t.name == "resolve_conflict").input_schema
    assert set(schema["required"]) == {"file_path", "old_string", "new_string"}
    assert schema["properties"]["choices"]["items"]["enum"] == ["ours", "theirs"]


# =============================================================================
# base 版本跟踪
# =============================================================================

async def test_read_file_records_base(tmp_path):
    f = tmp_path / "a.py"
    f.write_text("a\nb\n", encoding="utf-8")
    await _read(f)
    assert mcp_server._FILE_BASE_CONTENT[str(f.resolve())] == "a\nb\n"


async def test_write_file_refreshes_base(tmp_path):
    f = tmp_path / "a.py"
    await _tool_write_file({"path": str(f), "content": "x\ny\n"})
    assert mcp_server._FILE_BASE_CONTENT[str(f.resolve())] == "x\ny\n"


# =============================================================================
# 3-way merge:干净合并自动落盘
# =============================================================================

async def test_disjoint_external_edit_auto_merged(tmp_path):
    """外部修改不相交区域 → 3-way 干净合并自动应用(自动回滚场景的补集)。

    old_string 跨行覆盖 tail 行(使磁盘 0 命中、走 3-way 分支),
    但 new_string 仅实际改动 return 行 → 与外部对 tail 的修改在
    base 行级不相交,可确定性干净合并。
    """
    f = tmp_path / "a.py"
    f.write_text("def f():\n    return 1\n# tail\n", encoding="utf-8")
    await _read(f)  # base 建立
    # 外部修改 tail(与 agent 实际要改的 return 行不相交)
    _write_direct(f, "def f():\n    return 1\n# tail-changed\n")
    res = await _edit(f, "return 1\n# tail", "return 2\n# tail")
    assert res["ok"] is True
    assert res["strategy"] == "auto_merged_3way"
    assert f.read_text(encoding="utf-8") == "def f():\n    return 2\n# tail-changed\n"
    # 合并后 base 刷新为合并结果
    assert mcp_server._FILE_BASE_CONTENT[str(f.resolve())] == "def f():\n    return 2\n# tail-changed\n"


# =============================================================================
# 3-way merge:双侧冲突 → CONFLICT 不写盘
# =============================================================================

async def test_overlapping_external_edit_conflict_no_write(tmp_path):
    f = tmp_path / "a.py"
    f.write_text("a\nb\nc\n", encoding="utf-8")
    await _read(f)
    # 外部改 b → B2;agent 想把 b → B1(重叠)
    _write_direct(f, "a\nB2\nc\n")
    disk_before = f.read_text(encoding="utf-8")
    res = await _edit(f, "b", "B1")
    assert res["ok"] is False
    assert res["errorCode"] == "CONFLICT"
    assert res["conflict_count"] == 1
    assert "resolve_conflict" in res["error"]
    # 冲突时文件未写盘(保持磁盘现状)
    assert f.read_text(encoding="utf-8") == disk_before


async def test_stale_without_base_still_not_found(tmp_path):
    """无 base 版本(未 read 过)→ 维持原 NOT_FOUND 行为(回归保护)。"""
    f = tmp_path / "a.py"
    f.write_text("a\nb\nc\n", encoding="utf-8")
    _write_direct(f, "a\nB2\nc\n")
    res = await _edit(f, "b", "B1")
    assert res["ok"] is False
    assert res["errorCode"] == "NOT_FOUND"


# =============================================================================
# resolve_conflict:按块决策(局部拒绝)
# =============================================================================

async def test_resolve_conflict_ours_applies_agent_edit(tmp_path):
    f = tmp_path / "a.py"
    f.write_text("a\nb\nc\n", encoding="utf-8")
    await _read(f)
    _write_direct(f, "a\nB2\nc\n")
    conflict = await _edit(f, "b", "B1")
    assert conflict["errorCode"] == "CONFLICT"

    res = await _resolve(f, "b", "B1", ["ours"])
    assert res["ok"] is True
    assert res["resolved"] == 1
    assert res["rejected_hunks"] == 0
    assert f.read_text(encoding="utf-8") == "a\nB1\nc\n"


async def test_resolve_conflict_theirs_rejects_agent_edit(tmp_path):
    """局部拒绝:选 theirs → 保留磁盘现状,拒绝 agent 该块修改。"""
    f = tmp_path / "a.py"
    f.write_text("a\nb\nc\n", encoding="utf-8")
    await _read(f)
    _write_direct(f, "a\nB2\nc\n")
    await _edit(f, "b", "B1")  # 触发 CONFLICT

    res = await _resolve(f, "b", "B1", ["theirs"])
    assert res["ok"] is True
    assert res["rejected_hunks"] == 1
    assert f.read_text(encoding="utf-8") == "a\nB2\nc\n"
    assert res["applied_choices"] == [{"index": 0, "choice": "theirs"}]


async def test_resolve_conflict_missing_choice_defaults_ours(tmp_path):
    f = tmp_path / "a.py"
    f.write_text("a\nb\nc\n", encoding="utf-8")
    await _read(f)
    _write_direct(f, "a\nB2\nc\n")
    await _edit(f, "b", "B1")

    res = await _resolve(f, "b", "B1", [])
    assert res["ok"] is True
    assert f.read_text(encoding="utf-8") == "a\nB1\nc\n"


async def test_resolve_conflict_without_base_fails(tmp_path):
    f = tmp_path / "a.py"
    f.write_text("a\nb\nc\n", encoding="utf-8")
    res = await _resolve(f, "b", "B1", ["ours"])
    assert res["ok"] is False
    assert res["errorCode"] == "NO_BASE_VERSION"


async def test_resolve_conflict_clean_merge_direct_write(tmp_path):
    """无冲突时 resolve_conflict 直接落盘干净合并结果。"""
    f = tmp_path / "a.py"
    f.write_text("def f():\n    return 1\n# tail\n", encoding="utf-8")
    await _read(f)
    _write_direct(f, "def f():\n    return 1\n# tail-changed\n")
    res = await _resolve(f, "return 1", "return 2", [])
    assert res["ok"] is True
    assert res["conflicts"] == 0
    assert f.read_text(encoding="utf-8") == "def f():\n    return 2\n# tail-changed\n"


async def test_resolve_conflict_creates_backup(tmp_path):
    f = tmp_path / "a.py"
    f.write_text("a\nb\nc\n", encoding="utf-8")
    await _read(f)
    _write_direct(f, "a\nB2\nc\n")
    await _edit(f, "b", "B1")
    res = await _resolve(f, "b", "B1", ["ours"])
    assert res["ok"] is True
    assert Path(res["backup_path"]).exists()
    # 备份内容为解决前的磁盘内容
    assert Path(res["backup_path"]).read_text(encoding="utf-8") == "a\nB2\nc\n"


# =============================================================================
# 回归保护:正常 direct 路径不受影响
# =============================================================================

async def test_direct_edit_still_works_without_external_change(tmp_path):
    f = tmp_path / "a.py"
    f.write_text("a\nb\nc\n", encoding="utf-8")
    await _read(f)
    res = await _edit(f, "b", "B")
    assert res["ok"] is True
    assert res["strategy"] == "direct"
    assert res["replaced_count"] == 1
    assert f.read_text(encoding="utf-8") == "a\nB\nc\n"


async def test_ambiguous_match_still_reports(tmp_path):
    f = tmp_path / "a.py"
    f.write_text("x\nx\n", encoding="utf-8")
    await _read(f)
    res = await _edit(f, "x", "y")
    assert res["ok"] is False
    assert res["errorCode"] == "AMBIGUOUS_MATCH"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
