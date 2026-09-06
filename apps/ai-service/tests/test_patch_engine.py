# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""patch_engine(Codex 风格补丁引擎)单元测试。

覆盖:解析(含畸形报错行号)/ hunk 三级匹配(exact/fuzzy/bestfit,策略与置信度
记录)/ 语法校验钩子(.py/.json/.ts/.js)/ 多文件事务性回滚 / dry_run 预览 /
CRLF+BOM 保真 / root 沙箱路径安全 / PatchResult API。
"""

from __future__ import annotations

import json
import os
import stat
from pathlib import Path

import pytest

from app.services.patch_engine import (
    MatchStrategy,
    PatchApplyError,
    PatchParseError,
    PatchResult,
    SyntaxValidationError,
    apply_patch,
    parse_patch,
    validate_syntax,
)

# ---------------------------------------------------------------------------
# 工具
# ---------------------------------------------------------------------------


def codex(*sections: str) -> str:
    """组装完整 Codex 补丁文本。"""
    return "*** Begin Patch\n" + "\n".join(sections) + "\n*** End Patch\n"


def read_bytes(root: Path, rel: str) -> bytes:
    return (root / rel).read_bytes()


# ---------------------------------------------------------------------------
# 1. 解析
# ---------------------------------------------------------------------------


def test_parse_single_update(tmp_path: Path) -> None:
    text = codex("*** Update File: a.txt", "@@", " keep", "-old", "+new")
    patches = parse_patch(text)
    assert len(patches) == 1
    assert patches[0].path == "a.txt"
    assert patches[0].kind == "update"
    assert len(patches[0].hunks) == 1


def test_parse_add_file(tmp_path: Path) -> None:
    text = codex("*** Add File: new.txt", "+hello", "+world")
    patches = parse_patch(text)
    assert patches[0].kind == "add"
    assert patches[0].new_content == "hello\nworld\n"


def test_parse_delete_file(tmp_path: Path) -> None:
    text = codex("*** Delete File: gone.txt", "-anything")
    patches = parse_patch(text)
    assert patches[0].kind == "delete"
    assert patches[0].path == "gone.txt"


def test_parse_multiple_files(tmp_path: Path) -> None:
    text = codex(
        "*** Update File: a.txt", "@@", " x", "-y", "+z",
        "*** Add File: b.txt", "+b",
        "*** Delete File: c.txt",
    )
    patches = parse_patch(text)
    assert [p.kind for p in patches] == ["update", "add", "delete"]
    assert [p.path for p in patches] == ["a.txt", "b.txt", "c.txt"]


def test_parse_missing_begin_raises() -> None:
    with pytest.raises(PatchParseError, match=r"第 1 行"):
        parse_patch("*** Update File: a.txt\n x\n")


def test_parse_missing_end_raises() -> None:
    with pytest.raises(PatchParseError, match=r"End Patch"):
        parse_patch("*** Begin Patch\n*** Update File: a.txt\n x\n")


def test_parse_unknown_directive_error_has_lineno() -> None:
    text = "*** Begin Patch\n*** Update File: a.txt\n@@\n x\n*** Frobnicate: bad\n*** End Patch\n"
    with pytest.raises(PatchParseError, match=r"第 5 行.*未知指令"):
        parse_patch(text)


def test_parse_add_rejects_non_plus_line() -> None:
    text = codex("*** Add File: a.txt", "+ok", "not plus line")
    with pytest.raises(PatchParseError, match=r"第 4 行.*'\+' 行"):
        parse_patch(text)


def test_parse_update_without_hunks_raises() -> None:
    text = codex("*** Update File: a.txt", "*** Add File: b.txt", "+b")
    with pytest.raises(PatchParseError, match=r"没有任何 hunk"):
        parse_patch(text)


def test_parse_empty_add_raises() -> None:
    text = codex("*** Add File: a.txt", "*** End Patch")
    # "*** End Patch" 被识别为结束,Add 段无内容
    with pytest.raises(PatchParseError, match=r"内容为空|未找到任何文件段"):
        parse_patch("*** Begin Patch\n*** Add File: a.txt\n*** End Patch\n")


def test_parse_missing_path_raises() -> None:
    text = codex("*** Update File:", "@@", " x")
    with pytest.raises(PatchParseError, match=r"缺少路径"):
        parse_patch(text)


def test_parse_multiple_hunks_split_by_at() -> None:
    text = codex(
        "*** Update File: a.txt",
        "@@", " one", "+two",
        "@@", " three", "-four",
    )
    patches = parse_patch(text)
    assert len(patches[0].hunks) == 2
    assert patches[0].hunks[0].added_count() == 1
    assert patches[0].hunks[1].deleted_count() == 1


def test_parse_end_of_file_marker_tolerated() -> None:
    text = codex(
        "*** Update File: a.txt", "@@", " x", "-y", "+z", "*** End of File"
    )
    patches = parse_patch(text)
    assert len(patches[0].hunks) == 1


def test_parse_hunk_line_kinds() -> None:
    text = codex("*** Update File: a.txt", "@@", " ctx", "-del", "+add")
    lines = parse_patch(text)[0].hunks[0].lines
    assert [ln.kind for ln in lines] == ["context", "delete", "add"]
    assert [ln.text for ln in lines] == ["ctx", "del", "add"]


def test_parse_no_file_sections_raises() -> None:
    with pytest.raises(PatchParseError, match=r"未找到任何文件段"):
        parse_patch("*** Begin Patch\n\n*** End Patch\n")


def test_parse_context_marker_space_stripped() -> None:
    text = codex("*** Update File: a.txt", "@@", "  indented", "+x")
    # "  indented"(标记空格 + 缩进)应还原为 " indented"
    assert parse_patch(text)[0].hunks[0].lines[0].text == " indented"


# ---------------------------------------------------------------------------
# 2. hunk 三级匹配
# ---------------------------------------------------------------------------


def test_apply_exact_match(tmp_path: Path) -> None:
    (tmp_path / "a.txt").write_text("one\ntwo\nthree\n")
    text = codex("*** Update File: a.txt", "@@", " one", "-two", "+TWO")
    result = apply_patch(text, tmp_path)
    assert result.ok
    assert (tmp_path / "a.txt").read_text() == "one\nTWO\nthree\n"
    h = result.files[0].hunks[0]
    assert h.strategy is MatchStrategy.EXACT
    assert h.confidence == 1.0
    assert h.position == 0


def test_apply_exact_match_shifted_position(tmp_path: Path) -> None:
    (tmp_path / "a.txt").write_text("p\nq\nr\ns\nt\n")
    text = codex("*** Update File: a.txt", "@@", " s", "-t", "+T")
    result = apply_patch(text, tmp_path)
    assert result.ok
    assert result.files[0].hunks[0].strategy is MatchStrategy.EXACT
    assert result.files[0].hunks[0].position == 3
    assert (tmp_path / "a.txt").read_text() == "p\nq\nr\ns\nT\n"


def test_apply_fuzzy_ignores_trailing_whitespace(tmp_path: Path) -> None:
    (tmp_path / "a.txt").write_text("def foo():   \n    pass\n")
    text = codex("*** Update File: a.txt", "@@", " def foo():", "-    pass", "+    return 1")
    result = apply_patch(text, tmp_path)
    assert result.ok
    h = result.files[0].hunks[0]
    assert h.strategy is MatchStrategy.FUZZY
    assert h.confidence == 0.9


def test_apply_fuzzy_preserves_original_line_content(tmp_path: Path) -> None:
    (tmp_path / "a.txt").write_text("def foo():\t\nbody\n")
    text = codex("*** Update File: a.txt", "@@", " def foo():", "+x")
    result = apply_patch(text, tmp_path)
    assert result.ok
    # 上下文行保留文件原内容(含制表符尾巴),不被补丁文本覆盖
    out = (tmp_path / "a.txt").read_text()
    assert out.splitlines()[0] == "def foo():\t"
    assert out.splitlines()[1] == "x"


def test_apply_bestfit_fallback(tmp_path: Path) -> None:
    (tmp_path / "a.txt").write_text("alpha\nbeta\ngamma\ndeltaX\n")
    # 补丁声明的旧行 "delta" 与文件 "deltaX" 不一致:exact/fuzzy 均失败,回退 bestfit
    text = codex(
        "*** Update File: a.txt",
        "@@", " alpha", " beta", " gamma", "-delta", "+omega",
    )
    result = apply_patch(text, tmp_path)
    assert result.ok
    h = result.files[0].hunks[0]
    assert h.strategy is MatchStrategy.BESTFIT
    assert 0.6 <= h.confidence <= 1.0
    assert (tmp_path / "a.txt").read_text() == "alpha\nbeta\ngamma\nomega\n"


def test_apply_unmatchable_hunk_returns_error(tmp_path: Path) -> None:
    (tmp_path / "a.txt").write_text("aaa\nbbb\n")
    text = codex("*** Update File: a.txt", "@@", "-zzz1", "-zzz2", "-zzz3", "-zzz4", "+new")
    result = apply_patch(text, tmp_path)
    assert not result.ok
    assert "无法匹配" in result.error
    # 文件未被改动
    assert (tmp_path / "a.txt").read_text() == "aaa\nbbb\n"


def test_apply_multiple_hunks_sequential(tmp_path: Path) -> None:
    (tmp_path / "a.txt").write_text("l1\nl2\nl3\nl4\nl5\n")
    text = codex(
        "*** Update File: a.txt",
        "@@", " l1", "-l2", "+L2",
        "@@", " l4", "-l5", "+L5",
    )
    result = apply_patch(text, tmp_path)
    assert result.ok
    assert (tmp_path / "a.txt").read_text() == "l1\nL2\nl3\nl4\nL5\n"
    assert [h.index for h in result.files[0].hunks] == [0, 1]


def test_apply_pure_addition_hunk(tmp_path: Path) -> None:
    (tmp_path / "a.txt").write_text("a\n")
    text = codex("*** Update File: a.txt", "@@", " a", "+b")
    result = apply_patch(text, tmp_path)
    assert result.ok
    assert (tmp_path / "a.txt").read_text() == "a\nb\n"
    assert result.files[0].added == 1
    assert result.files[0].deleted == 0


def test_apply_pure_deletion_hunk(tmp_path: Path) -> None:
    (tmp_path / "a.txt").write_text("a\nb\nc\n")
    text = codex("*** Update File: a.txt", "@@", " a", "-b")
    result = apply_patch(text, tmp_path)
    assert result.ok
    assert (tmp_path / "a.txt").read_text() == "a\nc\n"
    assert result.files[0].deleted == 1


def test_apply_delete_file(tmp_path: Path) -> None:
    (tmp_path / "gone.txt").write_text("bye\n")
    result = apply_patch(codex("*** Delete File: gone.txt"), tmp_path)
    assert result.ok
    assert not (tmp_path / "gone.txt").exists()


def test_apply_add_file(tmp_path: Path) -> None:
    result = apply_patch(codex("*** Add File: sub/new.txt", "+hi"), tmp_path)
    assert result.ok
    assert (tmp_path / "sub" / "new.txt").read_text() == "hi\n"


def test_apply_add_existing_file_fails(tmp_path: Path) -> None:
    (tmp_path / "x.txt").write_text("x\n")
    result = apply_patch(codex("*** Add File: x.txt", "+y"), tmp_path)
    assert not result.ok
    assert "已存在" in result.error


def test_apply_update_missing_file_fails(tmp_path: Path) -> None:
    result = apply_patch(codex("*** Update File: no.txt", "@@", "-a", "+b"), tmp_path)
    assert not result.ok
    assert "不存在" in result.error


def test_apply_delete_missing_file_fails(tmp_path: Path) -> None:
    result = apply_patch(codex("*** Delete File: no.txt"), tmp_path)
    assert not result.ok
    assert "不存在" in result.error


def test_apply_accepts_parsed_filepatch_list(tmp_path: Path) -> None:
    (tmp_path / "a.txt").write_text("a\nb\n")
    patches = parse_patch(codex("*** Update File: a.txt", "@@", "-b", "+B"))
    result = apply_patch(patches, tmp_path)
    assert result.ok
    assert (tmp_path / "a.txt").read_text() == "a\nB\n"


def test_apply_path_traversal_rejected(tmp_path: Path) -> None:
    text = codex("*** Update File: ../evil.txt", "@@", "-a", "+b")
    result = apply_patch(text, tmp_path)
    assert not result.ok
    assert "越出 root" in result.error


def test_apply_absolute_path_rejected(tmp_path: Path) -> None:
    outside = str(tmp_path.parent / "outside.txt")
    text = codex(f"*** Add File: {outside}", "+x")
    result = apply_patch(text, tmp_path)
    assert not result.ok
    assert "越出 root" in result.error


# ---------------------------------------------------------------------------
# 3. 语法校验钩子
# ---------------------------------------------------------------------------


def test_validate_py_ok() -> None:
    validate_syntax("m.py", "def f():\n    return 1\n")


def test_validate_py_bad_has_lineno() -> None:
    with pytest.raises(SyntaxValidationError, match=r"第 1 行"):
        validate_syntax("m.py", "def f(:\n    pass\n")


def test_validate_json_ok() -> None:
    validate_syntax("c.json", '{"a": [1, 2]}')


def test_validate_json_bad_has_lineno() -> None:
    with pytest.raises(SyntaxValidationError, match=r"第 2 行"):
        validate_syntax("c.json", '{\n  "a": ,\n}')


def test_validate_ts_balanced() -> None:
    validate_syntax("a.ts", "function f(x: number): string { return '(' + x; } // )\n")


def test_validate_js_unbalanced_bracket() -> None:
    with pytest.raises(SyntaxValidationError, match=r"第 1 行"):
        validate_syntax("a.js", "function f( {\n  return 1;\n}\n")


def test_validate_js_brace_in_string_ignored() -> None:
    validate_syntax("a.js", "const s = '}}}{{';\nconst t = \"(]\";\n")


def test_validate_js_unclosed_quote() -> None:
    with pytest.raises(SyntaxValidationError, match=r"引号"):
        validate_syntax("a.js", 'const s = "abc;\nconst x = 1;\n')


def test_validate_js_comment_brackets_ignored() -> None:
    validate_syntax("a.js", "/* ) ] } */\n// ( [ {\nconst a = (1 + 2);\n")


def test_validate_unknown_extension_passes() -> None:
    validate_syntax("a.txt", "def broken( :\n  ???\n")


def test_apply_py_syntax_failure_error_has_lineno(tmp_path: Path) -> None:
    (tmp_path / "m.py").write_text("x = 1\n")
    text = codex("*** Update File: m.py", "@@", "-x = 1", "+def f(:")
    result = apply_patch(text, tmp_path)
    assert not result.ok
    assert "第 1 行" in result.error
    assert "Python 语法错误" in result.error


# ---------------------------------------------------------------------------
# 4. 多文件事务性
# ---------------------------------------------------------------------------


def test_batch_rollback_on_second_file_syntax_failure(tmp_path: Path) -> None:
    (tmp_path / "a.txt").write_text("a\n")
    (tmp_path / "b.py").write_text("y = 2\n")
    text = codex(
        "*** Update File: a.txt", "@@", "-a", "+A",
        "*** Update File: b.py", "@@", "-y = 2", "+def bad(:",
    )
    result = apply_patch(text, tmp_path)
    assert not result.ok
    # 第一个文件不得被写入(整批回滚)
    assert (tmp_path / "a.txt").read_text() == "a\n"
    assert (tmp_path / "b.py").read_text() == "y = 2\n"


def test_batch_rollback_on_second_file_match_failure(tmp_path: Path) -> None:
    (tmp_path / "a.txt").write_text("a\n")
    (tmp_path / "b.txt").write_text("b\n")
    text = codex(
        "*** Update File: a.txt", "@@", "-a", "+A",
        "*** Update File: b.txt", "@@", "-zzz1", "-zzz2", "-zzz3", "-zzz4", "+B",
    )
    result = apply_patch(text, tmp_path)
    assert not result.ok
    assert (tmp_path / "a.txt").read_text() == "a\n"


def test_batch_success_writes_all_files(tmp_path: Path) -> None:
    (tmp_path / "a.txt").write_text("a\n")
    text = codex(
        "*** Update File: a.txt", "@@", "-a", "+A",
        "*** Add File: b.txt", "+new",
        "*** Delete File: c.txt" if False else "*** Add File: c.txt", "+del",
    )
    result = apply_patch(text, tmp_path)
    assert result.ok
    assert (tmp_path / "a.txt").read_text() == "A\n"
    assert (tmp_path / "b.txt").exists()
    assert len(result.files) == 3


def test_commit_io_failure_rolls_back_written_file(tmp_path: Path) -> None:
    (tmp_path / "a.txt").write_text("orig-a\n")
    (tmp_path / "b.txt").write_text("orig-b\n")
    # 让 b.txt 只读:计划阶段读取正常,提交阶段 open(wb) 失败 → 回滚 a.txt
    os.chmod(tmp_path / "b.txt", stat.S_IREAD)
    try:
        text = codex(
            "*** Update File: a.txt", "@@", "-orig-a", "+changed",
            "*** Update File: b.txt", "@@", "-orig-b", "+blocked",
        )
        result = apply_patch(text, tmp_path)
        assert not result.ok
        assert "写入失败" in result.error
        assert (tmp_path / "a.txt").read_text() == "orig-a\n"
        assert (tmp_path / "b.txt").read_text() == "orig-b\n"
    finally:
        os.chmod(tmp_path / "b.txt", stat.S_IWRITE)


# ---------------------------------------------------------------------------
# 5. dry_run 预览
# ---------------------------------------------------------------------------


def test_dry_run_previews_without_writing(tmp_path: Path) -> None:
    (tmp_path / "a.txt").write_text("a\nb\n")
    text = codex("*** Update File: a.txt", "@@", "-b", "+B")
    result = apply_patch(text, tmp_path, dry_run=True)
    assert result.ok
    assert result.dry_run
    assert (tmp_path / "a.txt").read_text() == "a\nb\n"  # 未写盘
    assert result.files[0].hunks[0].strategy is MatchStrategy.EXACT


def test_dry_run_detects_syntax_error(tmp_path: Path) -> None:
    (tmp_path / "m.py").write_text("x = 1\n")
    text = codex("*** Update File: m.py", "@@", "-x = 1", "+x = (")
    result = apply_patch(text, tmp_path, dry_run=True)
    assert not result.ok
    assert result.dry_run
    assert (tmp_path / "m.py").read_text() == "x = 1\n"


def test_dry_run_add_and_delete_preview(tmp_path: Path) -> None:
    (tmp_path / "d.txt").write_text("d\n")
    text = codex(
        "*** Add File: n.txt", "+n",
        "*** Delete File: d.txt",
    )
    result = apply_patch(text, tmp_path, dry_run=True)
    assert result.ok
    assert (tmp_path / "d.txt").exists()
    assert not (tmp_path / "n.txt").exists()


# ---------------------------------------------------------------------------
# 6. CRLF / BOM 保真
# ---------------------------------------------------------------------------


def test_crlf_preserved(tmp_path: Path) -> None:
    (tmp_path / "a.txt").write_bytes(b"def f():\r\n    pass\r\n")
    text = codex("*** Update File: a.txt", "@@", " def f():", "-    pass", "+    return 1")
    result = apply_patch(text, tmp_path)
    assert result.ok
    data = read_bytes(tmp_path, "a.txt")
    assert data == b"def f():\r\n    return 1\r\n"


def test_bom_preserved(tmp_path: Path) -> None:
    (tmp_path / "a.txt").write_bytes(b"\xef\xbb\xbfa\nb\n")
    text = codex("*** Update File: a.txt", "@@", " a", "-b", "+c")
    result = apply_patch(text, tmp_path)
    assert result.ok
    data = read_bytes(tmp_path, "a.txt")
    assert data.startswith(b"\xef\xbb\xbf")
    assert data[3:] == b"a\nc\n"


def test_bom_and_crlf_combined(tmp_path: Path) -> None:
    (tmp_path / "a.txt").write_bytes(b"\xef\xbb\xbfa\r\nb\r\n")
    text = codex("*** Update File: a.txt", "@@", "+header")
    result = apply_patch(text, tmp_path)
    assert result.ok
    data = read_bytes(tmp_path, "a.txt")
    assert data == b"\xef\xbb\xbfheader\r\na\r\nb\r\n"


def test_lf_file_stays_lf(tmp_path: Path) -> None:
    (tmp_path / "a.txt").write_bytes(b"a\nb\n")
    text = codex("*** Update File: a.txt", "@@", "-b", "+c")
    assert apply_patch(text, tmp_path).ok
    assert read_bytes(tmp_path, "a.txt") == b"a\nc\n"


def test_file_without_trailing_newline(tmp_path: Path) -> None:
    (tmp_path / "a.txt").write_bytes(b"a\nb")
    text = codex("*** Update File: a.txt", "@@", " a", "-b", "+c")
    assert apply_patch(text, tmp_path).ok
    assert read_bytes(tmp_path, "a.txt") == b"a\nc"


# ---------------------------------------------------------------------------
# 7. PatchResult API
# ---------------------------------------------------------------------------


def test_result_to_dict_json_serializable(tmp_path: Path) -> None:
    (tmp_path / "a.txt").write_text("a\nb\n")
    text = codex("*** Update File: a.txt", "@@", "-b", "+B")
    result = apply_patch(text, tmp_path)
    payload = json.loads(json.dumps(result.to_dict()))
    assert payload["ok"] is True
    assert payload["files"][0]["hunks"][0]["strategy"] == "exact"
    assert payload["files"][0]["hunks"][0]["confidence"] == 1.0


def test_result_is_patched_result_type(tmp_path: Path) -> None:
    result = apply_patch(codex("*** Add File: x.txt", "+x"), tmp_path)
    assert isinstance(result, PatchResult)
    assert result.error == ""
    assert result.files[0].kind == "add"


def test_parse_error_from_apply_patch_string(tmp_path: Path) -> None:
    result = apply_patch("garbage without markers", tmp_path)
    assert not result.ok
    assert "Begin Patch" in result.error


def test_patch_apply_error_is_patch_error() -> None:
    assert issubclass(PatchApplyError, ValueError)
    assert issubclass(SyntaxValidationError, ValueError)
    assert issubclass(PatchParseError, ValueError)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
