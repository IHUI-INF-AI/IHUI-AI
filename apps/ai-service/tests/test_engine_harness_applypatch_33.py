# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
# app/core apply_patch 补丁解析/应用测试 — 第三十三批(对标 Codex apply-patch crate)
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pytest

from app.core.apply_patch import (
    AddFileHunk,
    ApplyPatchArgs,
    DeleteFileHunk,
    ParseError,
    SourceFile,
    StreamingPatchParser,
    UpdateFileChunk,
    UpdateFileHunk,
    apply_replacements,
    compute_replacements,
    derive_new_contents_from_chunks,
    parse_patch,
    parse_patch_text,
    seek_sequence,
)

BASIC = """*** Begin Patch
*** Add File: hello.txt
+Hello
*** End Patch"""


# ---------- 解析边界 ----------

def test_strict_rejects_missing_begin():
    with pytest.raises(ParseError, match="Begin Patch"):
        parse_patch_text("bad", strict=True)

def test_strict_rejects_missing_end():
    with pytest.raises(ParseError, match="End Patch"):
        parse_patch_text("*** Begin Patch\nbad", strict=True)

def test_lenient_strips_heredoc():
    heredoc = "<<\'EOF\'\n*** Begin Patch\n*** Add File: a.txt\n+x\n*** End Patch\nEOF"
    args = parse_patch_text(heredoc, strict=False)
    assert len(args.hunks) == 1 and isinstance(args.hunks[0], AddFileHunk)

def test_lenient_too_short_heredoc_rejected():
    with pytest.raises(ParseError):
        parse_patch_text("<<\'EOF\'\n*** End Patch\nEOF", strict=False)

def test_basic_add_file():
    args = parse_patch(BASIC)
    assert args.hunks == [AddFileHunk(path="hello.txt", contents="Hello\n")]
    assert args.environment_id is None

def test_environment_id_once():
    patch = "*** Begin Patch\n*** Environment ID: env-1\n*** Add File: a.txt\n+x\n*** End Patch"
    args = parse_patch(patch)
    assert args.environment_id == "env-1"

def test_environment_id_twice_rejected():
    patch = ("*** Begin Patch\n*** Environment ID: e1\n*** Environment ID: e2\n"
             "*** Add File: a.txt\n+x\n*** End Patch")
    with pytest.raises(ParseError, match="more than once"):
        parse_patch(patch)

def test_environment_id_empty_rejected():
    patch = "*** Begin Patch\n*** Environment ID: \n*** Add File: a.txt\n+x\n*** End Patch"
    with pytest.raises(ParseError, match="empty"):
        parse_patch(patch)

def test_delete_file_hunk():
    patch = "*** Begin Patch\n*** Delete File: gone.txt\n*** End Patch"
    assert parse_patch(patch).hunks == [DeleteFileHunk(path="gone.txt")]

def test_invalid_header_after_begin():
    patch = "*** Begin Patch\nnot-a-hunk\n*** End Patch"
    with pytest.raises(ParseError, match="valid hunk header"):
        parse_patch(patch)

def test_content_after_end_patch_rejected():
    patch = BASIC + "\ntrailing junk"
    with pytest.raises(ParseError, match="End Patch"):
        parse_patch(patch)

def test_blank_lines_after_end_patch_tolerated():
    assert len(parse_patch(BASIC + "\n\n").hunks) == 1

def test_finish_without_trailing_newline():
    parser = StreamingPatchParser()
    parser.push_delta(BASIC)  # 无 \n 结尾
    hunks = parser.finish()
    assert hunks == [AddFileHunk(path="hello.txt", contents="Hello\n")]


# ---------- Update File 语义 ----------

def test_update_file_full_flow():
    patch = """*** Begin Patch
*** Update File: src/app.py
@@
 def main():
-    print(1)
+    print(2)
*** End Patch"""
    args = parse_patch(patch)
    hunk = args.hunks[0]
    assert isinstance(hunk, UpdateFileHunk)
    chunk = hunk.chunks[0]
    assert chunk.change_context is None
    # @@ 后的空格前缀行是上下文行,双侧进入 old/new 并记录索引
    assert chunk.old_lines == ["def main():", "    print(1)"]
    assert chunk.new_lines == ["def main():", "    print(2)"]
    assert chunk.context_line_indices == [(0, 0)]

def test_update_with_change_context():
    patch = """*** Begin Patch
*** Update File: f.py
@@ class A:
 x
@@     def m(self):
-        pass
+        return 1
*** End Patch"""
    hunk = parse_patch(patch).hunks[0]
    c1, c2 = hunk.chunks
    assert c1.change_context == "class A:"
    assert c1.old_lines == ["x"] and c1.new_lines == ["x"]
    assert c2.change_context == "    def m(self):"
    assert c2.old_lines == ["        pass"]

def test_consecutive_context_markers_rejected():
    patch = ("*** Begin Patch\n*** Update File: f.py\n@@ class A:\n@@ def m:\n"
             "-a\n+b\n*** End Patch")
    with pytest.raises(ParseError, match="Unexpected line"):
        parse_patch(patch)

def test_move_to():
    patch = ("*** Begin Patch\n*** Update File: old.txt\n*** Move to: new.txt\n"
             "@@\n-a\n+b\n*** End Patch")
    hunk = parse_patch(patch).hunks[0]
    assert hunk.move_path == "new.txt" and hunk.affected_path() == "new.txt"

def test_end_of_file_marker():
    patch = ("*** Begin Patch\n*** Update File: f.txt\n@@\n tail\n+new tail\n"
             "*** End of File\n*** End Patch")
    chunk = parse_patch(patch).hunks[0].chunks[0]
    assert chunk.is_end_of_file is True

def test_empty_update_hunk_rejected():
    patch = "*** Begin Patch\n*** Update File: f.txt\n*** End Patch"
    with pytest.raises(ParseError, match="is empty"):
        parse_patch(patch)

def test_eof_without_lines_rejected():
    patch = ("*** Begin Patch\n*** Update File: f.txt\n@@\n*** End of File\n*** End Patch")
    with pytest.raises(ParseError, match="does not contain any lines"):
        parse_patch(patch)

def test_context_lines_record_indices():
    patch = ("*** Begin Patch\n*** Update File: f.txt\n@@\n keep\n-old\n+new\n*** End Patch")
    chunk = parse_patch(patch).hunks[0].chunks[0]
    assert chunk.context_line_indices == [(0, 0)]
    assert chunk.old_lines == ["keep", "old"] and chunk.new_lines == ["keep", "new"]


# ---------- 流式 push_delta ----------

def test_streaming_split_deltas():
    parser = StreamingPatchParser()
    for ch in BASIC:
        parser.push_delta(ch)
    assert parser.finish() == [AddFileHunk(path="hello.txt", contents="Hello\n")]

def test_streaming_crlf_normalised():
    parser = StreamingPatchParser()
    parser.push_delta(BASIC.replace("\n", "\r\n"))
    assert parser.finish() == [AddFileHunk(path="hello.txt", contents="Hello\n")]


# ---------- seek_sequence ----------

def test_seek_exact():
    lines = ["a", "b", "c"]
    assert seek_sequence(lines, ["b"], 0, False) == 1

def test_seek_rstrip():
    lines = ["a", "b   ", "c"]
    assert seek_sequence(lines, ["b"], 0, False) == 1

def test_seek_trim_both():
    lines = ["a", "  b  ", "c"]
    assert seek_sequence(lines, ["b"], 0, False) == 1

def test_seek_unicode_normalise():
    lines = ["a — b", "c"]  # em dash
    assert seek_sequence(lines, ["a - b"], 0, False) == 0

def test_seek_eof_priority():
    lines = ["x", "tail", "y", "tail"]
    assert seek_sequence(lines, ["tail"], 0, True) == 3

def test_seek_pattern_longer_than_lines_none():
    assert seek_sequence(["a"], ["a", "b"], 0, False) is None

def test_seek_empty_pattern_noop():
    assert seek_sequence(["a"], [], 2, False) == 2

def test_seek_not_found_none():
    assert seek_sequence(["a", "b"], ["z"], 0, False) is None


# ---------- compute_replacements / apply_replacements ----------

def test_compute_and_apply_simple():
    original = ["def main():", "    print(1)", "    print(2)"]
    chunk = UpdateFileChunk(old_lines=["    print(1)"], new_lines=["    print(2)"])
    reps = compute_replacements(original, "f.py", [chunk])
    assert reps == [(1, 1, ["    print(2)"])]
    assert apply_replacements(original, reps) == ["def main():", "    print(2)", "    print(2)"]

def test_compute_context_advances_index():
    original = ["class A:", "    pass", "class A:", "    pass"]
    chunk = UpdateFileChunk(change_context="class A:", old_lines=["    pass"], new_lines=["    return 1"])
    reps = compute_replacements(original, "f.py", [chunk])
    # context 命中 index 0 → line_index=1 → old_lines 从 1 起匹配
    assert reps[0][0] == 1

def test_compute_trailing_empty_sentinel_retry():
    original = ["a", "b"]
    chunk = UpdateFileChunk(old_lines=["b", ""], new_lines=["b", "c", ""], is_end_of_file=True)
    reps = compute_replacements(original, "f.py", [chunk])
    out = apply_replacements(original, reps)
    assert out == ["a", "b", "c"]

def test_compute_not_found_raises():
    with pytest.raises(ValueError, match="Failed to find expected lines"):
        compute_replacements(["x"], "f.py", [UpdateFileChunk(old_lines=["nope"], new_lines=[])])
    with pytest.raises(ValueError, match="Failed to find context"):
        compute_replacements(["x"], "f.py", [UpdateFileChunk(change_context="ctx", old_lines=["a"], new_lines=["b"])])

def test_apply_replacements_descending_order():
    original = ["1", "2", "3", "4"]
    reps = [(0, 1, ["one"]), (2, 1, ["three"])]
    assert apply_replacements(original, reps) == ["one", "2", "three", "4"]


# ---------- derive_new_contents / SourceFile ----------

def test_derive_lf_appends_final_newline():
    _, new = derive_new_contents_from_chunks("a\nb", [UpdateFileChunk(old_lines=["b"], new_lines=["B"])])
    assert new == "a\nB\n"

def test_derive_lf_replaces_whole_file():
    _, new = derive_new_contents_from_chunks("hello\n", [UpdateFileChunk(old_lines=["hello"], new_lines=["world"])])
    assert new == "world\n"

def test_source_file_preserves_crlf():
    sf = SourceFile.parse("a\r\nb\r\n")
    assert sf.line_texts() == ["a", "b"]
    sf.apply_replacements([(1, 1, ["B"])])
    assert sf.into_contents() == "a\r\nB\r\n"

def test_source_file_mixed_endings_kept_for_unchanged():
    sf = SourceFile.parse("a\r\nb\n")
    sf.apply_replacements([(0, 1, ["A"])])
    assert sf.into_contents() == "A\r\nb\n"  # 未动行保留原行尾;插入行用首选 CRLF

def test_source_file_unterminated_last_line():
    sf = SourceFile.parse("a\nb")
    sf.apply_replacements([(1, 1, ["B"])])
    assert sf.into_contents() == "a\nB\n"  # 历史行为:更新后必有尾换行
