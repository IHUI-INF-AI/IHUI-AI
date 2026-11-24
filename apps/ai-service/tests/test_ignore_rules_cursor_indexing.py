# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""`.cursorindexingignore` 索引剪枝判据(2026-11-24,Cursor 索引专属忽略等价)。"""

from __future__ import annotations

from pathlib import Path

from app.services.ignore_rules import (
    DEFAULT_IGNORE_FILENAMES,
    INDEX_IGNORE_FILENAMES,
    filter_paths,
    filter_paths_for_index,
    load_ignore_set,
)


def _write(root: Path, name: str, text: str) -> None:
    (root / name).write_text(text, encoding="utf-8")


def test_index_filenames_include_cursor_only() -> None:
    assert ".cursorindexingignore" in INDEX_IGNORE_FILENAMES
    assert ".cursorindexingignore" not in DEFAULT_IGNORE_FILENAMES
    # 2026-11-24 定档:.cursorignore 是访问面 deny,同时并入索引剪枝
    assert ".cursorignore" in INDEX_IGNORE_FILENAMES


def test_cursor_indexing_ignore_prunes(tmp_path: Path) -> None:
    _write(tmp_path, ".cursorindexingignore", "secret/\n")
    ignore = load_ignore_set(tmp_path, filenames=INDEX_IGNORE_FILENAMES)
    kept, pruned = filter_paths(["secret/a.py", "src/b.py"], ignore)
    assert kept == ["src/b.py"]
    assert pruned == [("secret/a.py", ".cursorindexingignore:1")]


def test_cursor_indexing_ignore_prunes_tracked_too(tmp_path: Path) -> None:
    _write(tmp_path, ".cursorindexingignore", "vendor/generated.py\n")
    ignore = load_ignore_set(tmp_path, filenames=INDEX_IGNORE_FILENAMES)
    kept, pruned, tracked_kept = filter_paths_for_index(
        ["vendor/generated.py"], ignore, tracked={"vendor/generated.py"}
    )
    assert kept == []
    assert pruned == [("vendor/generated.py", ".cursorindexingignore:1")]
    assert tracked_kept == []


def test_gitignore_tracked_still_deferred(tmp_path: Path) -> None:
    _write(tmp_path, ".gitignore", "keep.log\n")
    ignore = load_ignore_set(tmp_path, filenames=INDEX_IGNORE_FILENAMES)
    kept, pruned, tracked_kept = filter_paths_for_index(["keep.log"], ignore, tracked={"keep.log"})
    assert kept == ["keep.log"]
    assert pruned == []
    assert tracked_kept == [("keep.log", ".gitignore:1")]


def test_default_face_does_not_read_cursor_file(tmp_path: Path) -> None:
    _write(tmp_path, ".cursorindexingignore", "secret/\n")
    ignore = load_ignore_set(tmp_path, filenames=DEFAULT_IGNORE_FILENAMES)
    kept, pruned = filter_paths(["secret/a.py"], ignore)
    assert kept == ["secret/a.py"]
    assert pruned == []


def test_indexer_uses_index_filenames() -> None:
    source = (Path(__file__).resolve().parents[1] / "app/services/codebase_indexer.py").read_text(encoding="utf-8")
    assert "filenames=INDEX_IGNORE_FILENAMES" in source
    assert "filenames=DEFAULT_IGNORE_FILENAMES" not in source
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
