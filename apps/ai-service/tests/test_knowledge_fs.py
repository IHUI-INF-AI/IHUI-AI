# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""knowledge_fs 单元测试(2026-10-31 G2,对齐 Trae ckg Cfs* 读半边)。

测试隔离(AGENTS.md §5 铁律):全程不连生产库、不打真 HTTP ——
路径清单/文件聚合/语义检索三腿全部 monkeypatch;纯函数直接实跑。
覆盖:路径语法 / 目录投影 / 三态诚实(身份缺失、path_missing、
upstream_unavailable、empty_ambiguous)/ 符号级筛选。
"""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.services.knowledge_fs import (
    KnowledgeFS,
    group_entries,
    parse_vpath,
    vpath_of,
)

_ROWS = [
    {"filePath": "src/a.py", "lineStart": 1, "lineEnd": 20, "symbolName": "fn_a", "symbolType": "function", "language": "python"},
    {"filePath": "src/a.py", "lineStart": 22, "lineEnd": 30, "symbolName": "ClsA", "symbolType": "class", "language": "python"},
    {"filePath": "src/a.py", "lineStart": 1, "lineEnd": 30, "symbolName": None, "symbolType": "module_summary", "language": "python"},
    {"filePath": "src/deep/b.ts", "lineStart": 5, "lineEnd": 9, "symbolName": "fnB", "symbolType": "function", "language": "typescript"},
    {"filePath": "README.md", "lineStart": 1, "lineEnd": 4, "symbolName": None, "symbolType": "fixed", "language": "markdown"},
]


# ---------------------------------------------------------------------------
# 纯函数:路径语法
# ---------------------------------------------------------------------------


def test_vpath_of_file_and_symbol() -> None:
    assert vpath_of("r1", "src/a.py") == "/repo/r1/src/a.py"
    assert vpath_of("r1", "src/a.py", "fn_a") == "/repo/r1/src/a.py#fn_a"
    assert vpath_of("r1", "/leading/slash.py") == "/repo/r1/leading/slash.py"


def test_parse_vpath_legal() -> None:
    ref = parse_vpath("/repo/r1/src/a.py#fn_a")
    assert ref is not None
    assert (ref.repo_id, ref.file_path, ref.symbol_name) == ("r1", "src/a.py", "fn_a")
    ref2 = parse_vpath("/repo/r1/src/a.py")
    assert ref2 is not None and ref2.symbol_name is None


@pytest.mark.parametrize(
    "bad",
    [
        "",
        "/repo/",
        "/repo/r1/",
        "/repo/r1",
        "/repo/r1//a.py",
        "/repo/r1/src/a.py#",
        "/other/r1/a.py",
        None,
        "/repo/r1/a.py#",
    ],
)
def test_parse_vpath_illegal(bad: object) -> None:
    assert parse_vpath(bad) is None  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# 纯函数:目录投影
# ---------------------------------------------------------------------------


def test_group_entries_at_mount_root() -> None:
    entries = group_entries(_ROWS, "")
    names = {(e["type"], e["name"]) for e in entries}
    assert ("dir", "src/") in names
    assert ("file", "README.md") in names
    assert ("file", "src/a.py") not in names


def test_group_entries_nested_and_empty() -> None:
    nested = group_entries(_ROWS, "src")
    assert {"type": "dir", "name": "deep/"} in nested
    assert {"type": "file", "name": "a.py"} in nested
    assert group_entries(_ROWS, "no-such-dir") == []


# ---------------------------------------------------------------------------
# 服务层:三态诚实 + 投影(全程 monkeypatch,零网络零库)
# ---------------------------------------------------------------------------


@pytest.fixture()
def fs() -> KnowledgeFS:
    return KnowledgeFS()


async def test_identity_missing_is_explicit(fs: KnowledgeFS) -> None:
    for coro in (
        fs.list_dir("/repo/r1/", None),
        fs.read("/repo/r1/src/a.py", None),
        fs.stat("/repo/r1/src/a.py", None),
        fs.search("q", None),
    ):
        out = await coro
        assert out["status"] == "skipped_missing_identity"


async def test_list_dir_projects_entries(fs: KnowledgeFS, monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_fetch(repo_id: str, uid: str | None, tok: str | None) -> list[dict] | None:
        assert (repo_id, uid) == ("r1", "u1")
        return _ROWS

    monkeypatch.setattr(fs, "_fetch_path_index", fake_fetch)
    out = await fs.list_dir("/repo/r1/", "u1")
    assert out["status"] == "ok"
    assert {"type": "dir", "name": "src/"} in out["entries"]
    assert {"type": "file", "name": "README.md"} in out["entries"]


async def test_list_dir_invalid_prefix_and_upstream(fs: KnowledgeFS, monkeypatch: pytest.MonkeyPatch) -> None:
    assert (await fs.list_dir("/bogus/x", "u1"))["status"] == "path_invalid"
    assert (await fs.list_dir("/repo/r1/src/a.py#fn", "u1"))["status"] == "path_invalid"

    async def fail_fetch(repo_id: str, uid: str | None, tok: str | None) -> None:
        return None

    monkeypatch.setattr(fs, "_fetch_path_index", fail_fetch)
    assert (await fs.list_dir("/repo/r1/", "u1"))["status"] == "upstream_unavailable"


async def test_read_aggregates_chunks_honestly(fs: KnowledgeFS, monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_chunks(repo_id: str, fp: str, uid: str | None, tok: str | None) -> list[dict] | None:
        assert fp == "src/a.py"
        return [
            {"lineStart": 1, "lineEnd": 30, "content": "MODULE SUMMARY", "symbolName": None, "symbolType": "module_summary", "language": "python"},
            {"lineStart": 1, "lineEnd": 20, "content": "def fn_a():\n    ...", "symbolName": "fn_a", "symbolType": "function", "language": "python"},
        ]

    monkeypatch.setattr(fs, "_fetch_file_chunks", fake_chunks)
    out = await fs.read("/repo/r1/src/a.py", "u1")
    assert out["status"] == "ok" and out["chunks"] == 2
    assert "chunk 1/2" in out["content"] and "MODULE SUMMARY" in out["content"]

    out_sym = await fs.read("/repo/r1/src/a.py#fn_a", "u1")
    assert out_sym["status"] == "ok" and out_sym["chunks"] == 1 and "def fn_a" in out_sym["content"]
    assert out_sym["path"].endswith("#fn_a")


async def test_read_missing_paths(fs: KnowledgeFS, monkeypatch: pytest.MonkeyPatch) -> None:
    async def empty_chunks(repo_id: str, fp: str, uid: str | None, tok: str | None) -> list[dict] | None:
        return []

    monkeypatch.setattr(fs, "_fetch_file_chunks", empty_chunks)
    assert (await fs.read("/repo/r1/gone.py", "u1"))["status"] == "path_missing"

    async def rows_fetch(repo_id: str, uid: str | None, tok: str | None) -> list[dict] | None:
        return _ROWS

    monkeypatch.setattr(fs, "_fetch_path_index", rows_fetch)
    assert (await fs.read("/repo/r1/src/a.py#NoSuchSymbol", "u1"))["status"] == "path_missing"


async def test_stat_reports_metadata(fs: KnowledgeFS, monkeypatch: pytest.MonkeyPatch) -> None:
    async def rows_fetch(repo_id: str, uid: str | None, tok: str | None) -> list[dict] | None:
        return _ROWS

    monkeypatch.setattr(fs, "_fetch_path_index", rows_fetch)
    out = await fs.stat("/repo/r1/src/a.py", "u1")
    assert out["status"] == "ok" and out["chunks"] == 3
    assert out["line_start"] == 1 and out["line_end"] == 30
    assert "module_summary" in out["symbol_types"] and "function" in out["symbol_types"]
    assert (await fs.stat("/repo/r1/gone.py", "u1"))["status"] == "path_missing"


async def test_search_projects_and_honest_empty(fs: KnowledgeFS, monkeypatch: pytest.MonkeyPatch) -> None:
    hits = [
        {"repoId": "r1", "file_path": "src/a.py", "symbol_name": "fn_a", "score": 0.9, "line_start": 1, "line_end": 20, "content": "def fn_a(): pass"},
    ]
    monkeypatch.setattr(
        fs._indexer,
        "search",
        AsyncMock(return_value=hits),
    )
    out = await fs.search("认证逻辑", "u1", repo_id="r1")
    assert out["status"] == "ok"
    assert out["results"][0]["path"] == "/repo/r1/src/a.py#fn_a"

    monkeypatch.setattr(fs._indexer, "search", AsyncMock(return_value=[]))
    assert (await fs.search("q", "u1"))["status"] == "empty_ambiguous"

    async def boom(*a: object, **k: object) -> list:
        raise RuntimeError("gateway down")

    monkeypatch.setattr(fs._indexer, "search", boom)
    assert (await fs.search("q", "u1"))["status"] == "upstream_unavailable"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
