"""_tool_file_edit 单元测试:精细编辑 + conflict 检测 + 备份/回滚。

覆盖:
- 成功路径:唯一匹配替换 / replace_all=true / new_string 为空(删除)
- conflict 检测:0 处匹配 NOT_FOUND / ≥2 处匹配 AMBIGUOUS_MATCH
- 错误码:PATH_NOT_ALLOWED / FILE_NOT_FOUND / INVALID_ARGUMENT / BINARY_FILE
- 备份:.bak 在成功后保留 / 内容正确
- diff_preview:包含 -old / +new 行
- 返回结构:replaced_count / backup_path / ok 字段
- 注册表一致性:_TOOLS / _TOOL_HANDLERS / _ADMIN_ONLY_TOOLS
"""

from __future__ import annotations

import os

import pytest

from app.services import mcp_server
from app.services.mcp_server import (
    _ADMIN_ONLY_TOOLS,
    _TOOLS,
    _TOOL_HANDLERS,
    _tool_file_edit,
)


@pytest.fixture(autouse=True)
def _workspace_root(monkeypatch, tmp_path):
    """把工作区白名单重定向到 tmp_path,隔离测试文件。"""
    monkeypatch.setattr(mcp_server, "_WORKSPACE_ROOTS", [str(tmp_path.resolve())])
    return tmp_path


async def _edit(file_path, old_string, new_string, replace_all=False):
    return await _tool_file_edit({
        "file_path": str(file_path),
        "old_string": old_string,
        "new_string": new_string,
        "replace_all": replace_all,
    })


# =============================================================================
# 注册表一致性
# =============================================================================

def test_file_edit_registered_in_handlers():
    assert "file_edit" in _TOOL_HANDLERS
    assert _TOOL_HANDLERS["file_edit"] is _tool_file_edit


def test_file_edit_registered_in_tools_schema():
    names = [t.name for t in _TOOLS]
    assert "file_edit" in names


def test_file_edit_is_admin_only():
    assert "file_edit" in _ADMIN_ONLY_TOOLS


def test_file_edit_schema_required_fields():
    schema = next(t for t in _TOOLS if t.name == "file_edit").input_schema
    assert set(schema["required"]) == {"file_path", "old_string", "new_string"}
    assert schema["properties"]["old_string"]["minLength"] == 1
    assert schema["properties"]["replace_all"]["default"] is False


# =============================================================================
# 成功路径
# =============================================================================

async def test_unique_match_replace(_workspace_root):
    p = _workspace_root / "a.txt"
    p.write_text("hello world\n", encoding="utf-8")
    res = await _edit(p, "world", "python")
    assert res["ok"] is True
    assert res["replaced_count"] == 1
    assert p.read_text(encoding="utf-8") == "hello python\n"
    assert res["backup_path"].endswith(".bak")
    assert os.path.isfile(res["backup_path"])
    assert open(res["backup_path"], encoding="utf-8").read() == "hello world\n"


async def test_replace_all_multiple_matches(_workspace_root):
    p = _workspace_root / "b.txt"
    p.write_text("foo bar foo bar foo\n", encoding="utf-8")
    res = await _edit(p, "foo", "FOO", replace_all=True)
    assert res["ok"] is True
    assert res["replaced_count"] == 3
    assert p.read_text(encoding="utf-8") == "FOO bar FOO bar FOO\n"


async def test_empty_new_string_deletes(_workspace_root):
    p = _workspace_root / "c.txt"
    p.write_text("keep this-remove this\n", encoding="utf-8")
    res = await _edit(p, "-remove this", "")
    assert res["ok"] is True
    assert res["replaced_count"] == 1
    assert p.read_text(encoding="utf-8") == "keep this\n"


async def test_diff_preview_contains_old_and_new(_workspace_root):
    p = _workspace_root / "d.txt"
    p.write_text("line1\nold\nline3\n", encoding="utf-8")
    res = await _edit(p, "old", "new")
    assert res["ok"] is True
    assert "-old" in res["diff_preview"]
    assert "+new" in res["diff_preview"]


async def test_multiline_block_replace(_workspace_root):
    p = _workspace_root / "e.txt"
    p.write_text("def f():\n    return 1\n", encoding="utf-8")
    res = await _edit(p, "    return 1", "    return 2")
    assert res["ok"] is True
    assert p.read_text(encoding="utf-8") == "def f():\n    return 2\n"


# =============================================================================
# conflict 检测
# =============================================================================

async def test_not_found_error(_workspace_root):
    p = _workspace_root / "f.txt"
    p.write_text("nothing here\n", encoding="utf-8")
    res = await _edit(p, "absent", "x")
    assert res["ok"] is False
    assert res["errorCode"] == "NOT_FOUND"
    assert res["match_count"] == 0
    # 未改动 + 无 .bak
    assert p.read_text(encoding="utf-8") == "nothing here\n"
    assert not os.path.isfile(str(p) + ".bak")


async def test_ambiguous_match_error(_workspace_root):
    p = _workspace_root / "g.txt"
    p.write_text("dup dup\n", encoding="utf-8")
    res = await _edit(p, "dup", "x")
    assert res["ok"] is False
    assert res["errorCode"] == "AMBIGUOUS_MATCH"
    assert res["match_count"] == 2
    assert p.read_text(encoding="utf-8") == "dup dup\n"
    assert not os.path.isfile(str(p) + ".bak")


async def test_ambiguous_resolved_by_replace_all(_workspace_root):
    p = _workspace_root / "h.txt"
    p.write_text("dup dup\n", encoding="utf-8")
    res = await _edit(p, "dup", "x", replace_all=True)
    assert res["ok"] is True
    assert res["replaced_count"] == 2


# =============================================================================
# 错误码
# =============================================================================

async def test_path_not_allowed(_workspace_root, tmp_path_factory):
    outside = tmp_path_factory.mktemp("outside") / "z.txt"
    outside.write_text("x\n", encoding="utf-8")
    res = await _edit(outside, "x", "y")
    assert res["ok"] is False
    assert res["errorCode"] == "PATH_NOT_ALLOWED"


async def test_file_not_found(_workspace_root):
    res = await _edit(_workspace_root / "missing.txt", "a", "b")
    assert res["ok"] is False
    assert res["errorCode"] == "FILE_NOT_FOUND"


async def test_empty_old_string(_workspace_root):
    p = _workspace_root / "i.txt"
    p.write_text("content\n", encoding="utf-8")
    res = await _edit(p, "", "x")
    assert res["ok"] is False
    assert res["errorCode"] == "INVALID_ARGUMENT"


async def test_binary_file_rejected(_workspace_root):
    p = _workspace_root / "j.bin"
    p.write_bytes(b"abc\x00def")
    res = await _edit(p, "abc", "xyz")
    assert res["ok"] is False
    assert res["errorCode"] == "BINARY_FILE"


async def test_file_too_large(_workspace_root, monkeypatch):
    p = _workspace_root / "big.txt"
    p.write_text("x", encoding="utf-8")
    # 把大小阈值降到 0,使 1 字节文件即超限
    monkeypatch.setattr(os.path, "getsize", lambda *_a, **_k: 11 * 1024 * 1024)
    res = await _edit(p, "x", "y")
    assert res["ok"] is False
    assert res["errorCode"] == "FILE_TOO_LARGE"
