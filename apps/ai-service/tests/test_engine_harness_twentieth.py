# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""Harness 冷归档压缩(2026-09-19 第二十批)单测。

对标 Codex rollout/src/compression.rs:冷文件原子压缩(.gz)、保留 mtime、
marker 限频、fire-and-forget 错误隔离、透明行读取器(明文/压缩通吃 +
NotFound 重试窗口)。
"""

import gzip
import os
import time
from pathlib import Path

import pytest

from app.core.rollout_archive import (
    compress_cold_exports,
    estimate_bytes_saved,
    is_cold,
    open_export_lines,
)


def _mk_jsonl(path: Path, lines: list[str], mtime_offset_hours: float = -200.0) -> None:
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    past = time.time() + mtime_offset_hours * 3600
    os.utime(path, (past, past))


# =============================================================================
# is_cold / estimate_bytes_saved
# =============================================================================


def test_is_cold_thresholds(tmp_path):
    p = tmp_path / "a.jsonl"
    p.write_text("x", encoding="utf-8")
    now = time.time()
    os.utime(p, (now - 10 * 3600, now - 10 * 3600))
    assert is_cold(p, older_than_hours=5, now=now) is True
    assert is_cold(p, older_than_hours=10, now=now) is True  # 恰好等于阈值即冷
    assert is_cold(p, older_than_hours=20, now=now) is False
    assert is_cold(tmp_path / "missing.jsonl", older_than_hours=1, now=now) is False


def test_estimate_bytes_saved_never_negative():
    assert estimate_bytes_saved(100, 40) == 60
    assert estimate_bytes_saved(10, 40) == 0  # 压缩反而变大:按 0 计


# =============================================================================
# compress_cold_exports
# =============================================================================


def test_compress_cold_file_and_read_back(tmp_path):
    # 内容重复且足够大,确保 gzip 真实节省字节(极小文件 gzip 头开销会反超)
    lines = ['{"seq": %d, "payload": "%s"}' % (i, "x" * 200) for i in range(20)]
    f = tmp_path / "session.jsonl"
    _mk_jsonl(f, lines)
    out = compress_cold_exports(
        tmp_path, older_than_hours=24, min_size_bytes=10, now=time.time()
    )
    assert out["compressed"] == 1
    assert not f.exists()  # 原文件已删
    gz = tmp_path / "session.jsonl.gz"
    assert gz.exists()
    # 压缩产物可被透明读取器逐行读回且内容一致(换行已剥离)
    assert list(open_export_lines(f)) == lines
    assert out["bytes_saved"] > 0


def test_hot_and_small_files_skipped(tmp_path):
    hot = tmp_path / "hot.jsonl"
    hot.write_text("x" * 2000, encoding="utf-8")  # 刚修改:热
    small = tmp_path / "small.jsonl"
    _mk_jsonl(small, ["tiny"], mtime_offset_hours=-200)
    out = compress_cold_exports(tmp_path, older_than_hours=24, now=time.time())
    assert out["skipped_hot"] == 1
    assert out["skipped_small"] == 1
    assert out["compressed"] == 0
    assert hot.exists() and small.exists()


def test_min_size_boundary(tmp_path):
    f = tmp_path / "edge.jsonl"
    _mk_jsonl(f, ["x" * 1023])  # 恰好 1024 字节 + 换行
    compress_cold_exports(tmp_path, older_than_hours=24, min_size_bytes=1024, now=time.time())
    assert f.exists() or (tmp_path / "edge.jsonl.gz").exists()


def test_already_compressed_skipped(tmp_path):
    gz = tmp_path / "done.jsonl.gz"
    gz.write_bytes(gzip.compress(b"data"))
    # glob("*.jsonl") 本就不含 .gz;显式验证不会被误删
    _mk_jsonl(tmp_path / "plain.jsonl", ["x" * 2000])
    out = compress_cold_exports(tmp_path, older_than_hours=24, now=time.time())
    assert gz.exists()
    assert out["compressed"] == 1


def test_mtime_preserved_after_compression(tmp_path):
    f = tmp_path / "keep.jsonl"
    _mk_jsonl(f, ["x" * 3000], mtime_offset_hours=-48)
    original_mtime = f.stat().st_mtime
    compress_cold_exports(tmp_path, older_than_hours=24, now=time.time())
    gz = tmp_path / "keep.jsonl.gz"
    assert abs(gz.stat().st_mtime - original_mtime) < 1.0  # mtime 被保留


def test_no_tmp_files_left_behind(tmp_path):
    _mk_jsonl(tmp_path / "atomic.jsonl", ["x" * 3000])
    compress_cold_exports(tmp_path, older_than_hours=24, now=time.time())
    leftovers = [p.name for p in tmp_path.iterdir() if ".tmp." in p.name]
    assert leftovers == []


def test_single_failure_does_not_block_others(tmp_path, monkeypatch):
    """fire-and-forget:坏文件只进 errors,其余文件照常压缩。"""
    from app.core import rollout_archive as ra

    good = tmp_path / "good.jsonl"
    _mk_jsonl(good, ["x" * 3000])

    real_atomic = ra._atomic_gzip

    def _flaky(src: Path, dest: Path) -> None:
        if src.name == "bad.jsonl":
            raise OSError("模拟压缩失败")
        real_atomic(src, dest)

    monkeypatch.setattr(ra, "_atomic_gzip", _flaky)
    bad = tmp_path / "bad.jsonl"
    _mk_jsonl(bad, ["y" * 3000])
    out = compress_cold_exports(tmp_path, older_than_hours=24, now=time.time())
    assert out["compressed"] == 1
    assert (tmp_path / "good.jsonl.gz").exists()
    assert any("bad.jsonl" in e for e in out["errors"])


def test_empty_directory(tmp_path):
    out = compress_cold_exports(tmp_path, older_than_hours=24, now=time.time())
    assert out["compressed"] == 0 and out["errors"] == []


def test_missing_directory_is_noop(tmp_path):
    out = compress_cold_exports(tmp_path / "nope", older_than_hours=24, now=time.time())
    assert out["compressed"] == 0 and out["skipped_hot"] == 0


# =============================================================================
# marker 限频
# =============================================================================


def test_marker_blocks_frequent_runs(tmp_path):
    marker_dir = tmp_path / "marker"
    marker_dir.mkdir()
    data = tmp_path / "data"
    data.mkdir()
    _mk_jsonl(data / "a.jsonl", ["x" * 3000])
    now = time.time()
    first = compress_cold_exports(
        data, older_than_hours=24, marker_dir=marker_dir, min_interval_minutes=30, now=now
    )
    assert first["compressed"] == 1
    # 10 分钟后再跑:被 marker 拦截
    second = compress_cold_exports(
        data,
        older_than_hours=24,
        marker_dir=marker_dir,
        min_interval_minutes=30,
        now=now + 600,
    )
    assert second["skipped_marker"] == 1
    # 31 分钟后再跑:放行
    _mk_jsonl(data / "b.jsonl", ["x" * 3000])
    third = compress_cold_exports(
        data,
        older_than_hours=24,
        marker_dir=marker_dir,
        min_interval_minutes=30,
        now=now + 1860,
    )
    assert third["skipped_marker"] == 0 and third["compressed"] == 1


def test_corrupted_marker_degrades_to_run(tmp_path):
    marker_dir = tmp_path / "marker"
    marker_dir.mkdir()
    (marker_dir / ".rollout-archive-marker").write_text("not-a-number", encoding="utf-8")
    data = tmp_path / "data"
    data.mkdir()
    _mk_jsonl(data / "a.jsonl", ["x" * 3000])
    out = compress_cold_exports(
        data, older_than_hours=24, marker_dir=marker_dir, min_interval_minutes=30, now=time.time()
    )
    assert out["skipped_marker"] == 0 and out["compressed"] == 1


# =============================================================================
# open_export_lines
# =============================================================================


def test_open_export_lines_gz_direct(tmp_path):
    gz = tmp_path / "s.jsonl.gz"
    gz.write_bytes(gzip.compress("第 1 行\nline 2\n".encode("utf-8")))
    assert list(open_export_lines(tmp_path / "s.jsonl")) == ["第 1 行", "line 2"]


def test_open_export_lines_missing_raises_after_retries(tmp_path):
    with pytest.raises(FileNotFoundError):
        list(open_export_lines(tmp_path / "ghost.jsonl"))
