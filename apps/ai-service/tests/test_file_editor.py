"""file_editor.py 单元测试:edit_file + validate_path + create_backup + generate_diff。

测试覆盖(16 个用例):
- edit_file 替换单次命中
- edit_file 多次命中 + replace_all=True
- edit_file 多次命中 + replace_all=False(失败)
- edit_file 0 次命中 + create_if_missing=True(创建新文件)
- edit_file 0 次命中 + create_if_missing=False(失败)
- edit_file 文件不存在 + create_if_missing=False(失败)
- edit_file 文件不存在 + create_if_missing=True(创建新文件)
- edit_file old_string 为空(失败)
- edit_file 文件超 1MB(失败)
- edit_file 路径在黑名单(失败)
- edit_file 路径不在白名单(失败)
- edit_file new_string 为空(删除代码,成功)
- validate_path 各种场景(白名单/黑名单/空路径)
- create_backup 创建备份文件
- generate_diff 输出 unified diff 格式
- edit_file 替换后生成 diff 含 @@ 标记
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from app.services import file_editor
from app.services.file_editor import (
    MAX_FILE_SIZE,
    create_backup,
    edit_file,
    generate_diff,
    validate_path,
)


# =============================================================================
# 公共 fixture:把 tmp_path 加入白名单 + 备份根目录重定向到 tmp_path
# =============================================================================


@pytest.fixture(autouse=True)
def _isolate_workspace(monkeypatch, tmp_path):
    """每个测试前:
    - 把 _WORKSPACE_ROOTS 替换为 [tmp_path](白名单只含临时目录)
    - 把 _BACKUP_ROOT 重定向到 tmp_path/file_edit_backup(防污染项目目录)
    """
    monkeypatch.setattr(file_editor, "_WORKSPACE_ROOTS", [str(tmp_path)])
    monkeypatch.setattr(file_editor, "_BACKUP_ROOT", tmp_path / "file_edit_backup")


# =============================================================================
# edit_file:成功路径
# =============================================================================


def test_edit_file_replace_single_match(tmp_path):
    """edit_file 单次命中:替换并写回,返回 action=replaced。"""
    f = tmp_path / "code.py"
    f.write_text("def foo():\n    return 1\n", encoding="utf-8")
    out = edit_file(
        file_path=str(f),
        old_string="return 1",
        new_string="return 42",
    )
    assert out["ok"] is True
    assert out["action"] == "replaced"
    assert out["count"] == 1
    assert "return 42" in out["new_content_preview"]
    assert "return 1" in out["old_content_preview"]
    assert f.read_text(encoding="utf-8") == "def foo():\n    return 42\n"
    # 备份文件存在
    assert "backup_path" in out
    assert os.path.exists(out["backup_path"])


def test_edit_file_replace_all_multiple_matches(tmp_path):
    """edit_file 多次命中 + replace_all=True:全部替换,action=replaced_all。"""
    f = tmp_path / "todo.txt"
    f.write_text("TODO: fix\nTODO: test\nTODO: docs\n", encoding="utf-8")
    out = edit_file(
        file_path=str(f),
        old_string="TODO",
        new_string="DONE",
        replace_all=True,
    )
    assert out["ok"] is True
    assert out["action"] == "replaced_all"
    assert out["count"] == 3
    assert f.read_text(encoding="utf-8") == "DONE: fix\nDONE: test\nDONE: docs\n"


def test_edit_file_multiple_matches_no_replace_all(tmp_path):
    """edit_file 多次命中 + replace_all=False:返回 MULTIPLE_MATCHES 失败。"""
    f = tmp_path / "dup.py"
    f.write_text("x = 1\nx = 2\n", encoding="utf-8")
    out = edit_file(
        file_path=str(f),
        old_string="x",
        new_string="y",
        replace_all=False,
    )
    assert out["ok"] is False
    assert out["errorCode"] == "MULTIPLE_MATCHES"
    assert out["count"] == 2
    # 文件未被修改
    assert f.read_text(encoding="utf-8") == "x = 1\nx = 2\n"


def test_edit_file_create_when_file_missing(tmp_path):
    """edit_file 文件不存在 + create_if_missing=True:创建新文件。"""
    f = tmp_path / "new_module.py"
    assert not f.exists()
    out = edit_file(
        file_path=str(f),
        old_string="placeholder",
        new_string="def hello():\n    print('hi')\n",
        create_if_missing=True,
    )
    assert out["ok"] is True
    assert out["action"] == "created"
    assert f.read_text(encoding="utf-8") == "def hello():\n    print('hi')\n"
    assert "def hello" in out["new_content_preview"]


def test_edit_file_zero_matches_no_create(tmp_path):
    """edit_file 文件存在 + 0 次命中 + create_if_missing=False:OLD_STRING_NOT_FOUND。"""
    f = tmp_path / "a.py"
    f.write_text("def foo():\n    pass\n", encoding="utf-8")
    out = edit_file(
        file_path=str(f),
        old_string="nonexistent_string_xyz",
        new_string="whatever",
        create_if_missing=False,
    )
    assert out["ok"] is False
    assert out["errorCode"] == "OLD_STRING_NOT_FOUND"
    # 文件未被修改
    assert f.read_text(encoding="utf-8") == "def foo():\n    pass\n"


def test_edit_file_file_not_found_no_create(tmp_path):
    """edit_file 文件不存在 + create_if_missing=False:FILE_NOT_FOUND。"""
    f = tmp_path / "ghost.py"
    out = edit_file(
        file_path=str(f),
        old_string="something",
        new_string="other",
        create_if_missing=False,
    )
    assert out["ok"] is False
    assert out["errorCode"] == "FILE_NOT_FOUND"
    assert not f.exists()


def test_edit_file_empty_old_string(tmp_path):
    """edit_file old_string 为空:返回 EMPTY_OLD_STRING(最先校验,不碰磁盘)。"""
    f = tmp_path / "x.py"
    f.write_text("content", encoding="utf-8")
    out = edit_file(
        file_path=str(f),
        old_string="",
        new_string="new",
    )
    assert out["ok"] is False
    assert out["errorCode"] == "EMPTY_OLD_STRING"
    # 文件未被修改
    assert f.read_text(encoding="utf-8") == "content"


def test_edit_file_file_too_large(tmp_path):
    """edit_file 文件超 1MB:返回 FILE_TOO_LARGE。"""
    f = tmp_path / "big.txt"
    # 写入 MAX_FILE_SIZE + 100 字节
    f.write_bytes(b"x" * (MAX_FILE_SIZE + 100))
    out = edit_file(
        file_path=str(f),
        old_string="x",
        new_string="y",
    )
    assert out["ok"] is False
    assert out["errorCode"] == "FILE_TOO_LARGE"


def test_edit_file_path_in_blacklist(tmp_path):
    """edit_file 路径在敏感目录黑名单(.git):返回 PATH_NOT_IN_WORKSPACE。"""
    # tmp_path/.git/config(黑名单优先,即使 tmp_path 在白名单内)
    git_dir = tmp_path / ".git"
    git_dir.mkdir()
    f = git_dir / "config"
    f.write_text("content", encoding="utf-8")
    out = edit_file(
        file_path=str(f),
        old_string="content",
        new_string="modified",
    )
    assert out["ok"] is False
    assert out["errorCode"] == "PATH_NOT_IN_WORKSPACE"
    assert "敏感目录" in out["message"]


def test_edit_file_path_not_in_workspace(tmp_path):
    """edit_file 路径不在白名单:返回 PATH_NOT_IN_WORKSPACE。"""
    # tmp_path 在白名单,但 /tmp/other 不在(用绝对路径绕过)
    outside = tmp_path.parent / "outside_workspace_xyz"
    outside.mkdir(exist_ok=True)
    f = outside / "x.py"
    try:
        f.write_text("content", encoding="utf-8")
        out = edit_file(
            file_path=str(f),
            old_string="content",
            new_string="modified",
        )
        assert out["ok"] is False
        assert out["errorCode"] == "PATH_NOT_IN_WORKSPACE"
        assert "白名单" in out["message"]
    finally:
        # 清理(避免污染其他测试)
        import shutil
        shutil.rmtree(outside, ignore_errors=True)


def test_edit_file_empty_new_string_deletes_code(tmp_path):
    """edit_file new_string 为空:删除 old_string 片段,返回成功。"""
    f = tmp_path / "code.py"
    f.write_text("import debug\nprint('main')\n", encoding="utf-8")
    out = edit_file(
        file_path=str(f),
        old_string="import debug\n",
        new_string="",
    )
    assert out["ok"] is True
    assert out["action"] == "replaced"
    assert f.read_text(encoding="utf-8") == "print('main')\n"


def test_edit_file_diff_contains_unified_markers(tmp_path):
    """edit_file 替换后生成 diff,含 @@ / --- / +++ unified diff 标记。"""
    f = tmp_path / "a.py"
    f.write_text("line1\nline2\nline3\n", encoding="utf-8")
    out = edit_file(
        file_path=str(f),
        old_string="line2",
        new_string="line_two",
    )
    assert out["ok"] is True
    diff = out["diff"]
    assert "---" in diff
    assert "+++" in diff
    assert "@@" in diff
    assert "-line2" in diff
    assert "+line_two" in diff


# =============================================================================
# validate_path:各种场景
# =============================================================================


def test_validate_path_in_workspace(tmp_path):
    """validate_path 白名单内路径:返回 (True, resolved_path)。"""
    f = tmp_path / "a.py"
    f.write_text("x", encoding="utf-8")
    ok, info = validate_path(str(f))
    assert ok is True
    assert info == str(f.resolve())


def test_validate_path_empty():
    """validate_path 空路径:返回 (False, ...)。"""
    ok, info = validate_path("")
    assert ok is False
    assert "为空" in info


def test_validate_path_blacklist(tmp_path):
    """validate_path 黑名单路径(.git/node_modules/dist 等):返回 (False, ...)。"""
    for dirname in [".git", "node_modules", "dist", "build", ".venv", "__pycache__"]:
        d = tmp_path / dirname / "sub"
        d.mkdir(parents=True)
        f = d / "f.txt"
        f.write_text("x", encoding="utf-8")
        ok, info = validate_path(str(f))
        assert ok is False, f"{dirname} 应在黑名单内"
        assert "敏感目录" in info or "黑名单" in info


def test_validate_path_not_in_workspace(tmp_path):
    """validate_path 不在白名单:返回 (False, ...)。"""
    outside = tmp_path.parent / "outside_workspace_test_xyz"
    outside.mkdir(exist_ok=True)
    f = outside / "x.py"
    try:
        f.write_text("x", encoding="utf-8")
        ok, info = validate_path(str(f))
        assert ok is False
        assert "白名单" in info
    finally:
        import shutil
        shutil.rmtree(outside, ignore_errors=True)


# =============================================================================
# create_backup
# =============================================================================


def test_create_backup_creates_file(tmp_path):
    """create_backup 创建备份文件,内容与原文件一致。"""
    f = tmp_path / "src.py"
    original = "def foo():\n    return 1\n"
    f.write_text(original, encoding="utf-8")
    backup_path = create_backup(str(f))
    assert os.path.exists(backup_path)
    assert backup_path.endswith(".bak")
    # 备份内容与原文件一致
    assert Path(backup_path).read_text(encoding="utf-8") == original
    # 原文件未被修改
    assert f.read_text(encoding="utf-8") == original


def test_create_backup_unique_per_call(tmp_path):
    """create_backup 多次调用生成不同备份文件(pid+nanos 后缀防并发冲突)。"""
    f = tmp_path / "src.py"
    f.write_text("content", encoding="utf-8")
    p1 = create_backup(str(f))
    p2 = create_backup(str(f))
    assert p1 != p2
    assert os.path.exists(p1)
    assert os.path.exists(p2)


# =============================================================================
# generate_diff
# =============================================================================


def test_generate_diff_unified_format():
    """generate_diff 输出 unified diff 格式(含 --- / +++ / @@ 标记)。"""
    old = "line1\nline2\nline3\n"
    new = "line1\nline_two\nline3\n"
    diff = generate_diff(old, new, "/fake/path/a.py")
    assert "---" in diff
    assert "+++" in diff
    assert "@@" in diff
    assert "-line2" in diff
    assert "+line_two" in diff


def test_generate_diff_identical_content_empty():
    """generate_diff 内容相同:返回空字符串(无差异)。"""
    content = "same\ncontent\n"
    diff = generate_diff(content, content, "/fake/a.py")
    assert diff == ""


def test_generate_diff_truncates_long_diff():
    """generate_diff 超长 diff 截断到前 200 行。"""
    # 生成 1000 行不同内容
    old_lines = [f"old_line_{i}" for i in range(1000)]
    new_lines = [f"new_line_{i}" for i in range(1000)]
    old = "\n".join(old_lines) + "\n"
    new = "\n".join(new_lines) + "\n"
    diff = generate_diff(old, new, "/fake/big.py")
    diff_line_count = diff.count("\n")
    # 截断后行数不超过 MAX_DIFF_LINES(200)+少量 header
    assert diff_line_count <= 205, f"diff 行数 {diff_line_count} 未截断到 200 行以内"
