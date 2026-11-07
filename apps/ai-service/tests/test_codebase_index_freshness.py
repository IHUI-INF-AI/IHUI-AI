# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""索引新鲜度判定与按需刷新测试(2026-11-07)。

跟随 `tests/test_codebase_indexer_incremental.py` 的口径:真实索引器 + 临时仓库,
只把快照目录改到 tmp_path、把 embedding / 写 API / 删 API 换成桩。
覆盖 `check_freshness` 的 fresh/stale/expired/unknown/absent 与 `ensure_fresh` 的
none/incremental/full/catalog-only/consent-required 五档,并钉住"未变文件不重嵌入"。
"""

from __future__ import annotations

import gzip
import json
from collections.abc import Callable
from pathlib import Path
from typing import cast
from unittest.mock import AsyncMock, patch

import pytest

from app.services import codebase_indexer
from app.services.codebase_index_status import (
    FRESHNESS_EXPIRED,
    FRESHNESS_FRESH,
    FRESHNESS_STALE,
    FRESHNESS_UNKNOWN,
    check_freshness,
    ensure_fresh,
)
from app.services.codebase_indexer import CodebaseIndexer, CodeChunk
from app.services.codebase_symbol_catalog import CATALOG_KEY

_A_PY = "def alpha():\n    return 1\n"
_A_PY_EDITED = "def alpha():\n    return 1\n\ndef beta():\n    return 2\n"
_B_PY = "def gamma():\n    return 2\n"


@pytest.fixture(autouse=True)
def _isolate_merkle_snapshot_dir(tmp_path, monkeypatch):
    """快照写入重定向到 tmp_path,防污染真实用户目录。"""
    monkeypatch.setattr(
        codebase_indexer, "_MERKLE_SNAPSHOT_DIR", tmp_path / "merkle-snapshots"
    )


def _build_repo(tmp_path: Path) -> Path:
    repo = tmp_path / "repo"
    pkg = repo / "pkg"
    pkg.mkdir(parents=True)
    (pkg / "a.py").write_text(_A_PY, encoding="utf-8")
    (pkg / "b.py").write_text(_B_PY, encoding="utf-8")
    return repo


def _make_indexer() -> CodebaseIndexer:
    idx = CodebaseIndexer.__new__(CodebaseIndexer)
    idx._tree_sitter_available = False
    idx._api_base_url = "http://localhost:8801"
    idx._catalog_cache = {}
    return idx


async def _full_index(idx: CodebaseIndexer, repo: Path, repo_id: str) -> None:
    with (
        patch.object(idx, "_generate_embeddings_batch", new=AsyncMock(return_value=1)),
        patch.object(idx, "_write_to_api", new=AsyncMock(return_value={})),
    ):
        result = await idx.index_repository(str(repo), repo_id, incremental=False)
    assert result.files_indexed == 2


class _EmbedRecorder:
    """记录每次 embedding 批的输入切片(用于证明"未变文件没被重嵌入")。"""

    def __init__(self) -> None:
        self.calls: list[list[CodeChunk]] = []

    async def __call__(self, chunks: list[CodeChunk]) -> int:
        self.calls.append(list(chunks))
        return len(chunks)


def _rewrite_snapshot(path: Path, mutate: Callable[[dict[str, object]], None]) -> None:
    """就地改写快照 payload(兼容 gzip / 明文双形态,与索引器读侧同判据)。"""
    raw = path.read_bytes()
    compressed = raw[:2] == b"\x1f\x8b"
    if compressed:
        payload = cast(dict[str, object], json.loads(gzip.decompress(raw).decode("utf-8")))
    else:
        payload = cast(dict[str, object], json.loads(raw.decode("utf-8")))
    mutate(payload)
    text = json.dumps(payload, ensure_ascii=False, indent=0)
    path.write_bytes(gzip.compress(text.encode("utf-8")) if compressed else text.encode("utf-8"))


@pytest.mark.asyncio
async def test_initial_index_is_fresh(tmp_path):
    repo = _build_repo(tmp_path)
    idx = _make_indexer()
    await _full_index(idx, repo, "repo-fresh")

    report = check_freshness(str(repo), repo_id="repo-fresh", indexer=idx)

    assert report.state == FRESHNESS_FRESH
    assert report.catalog_state == "ok"
    assert report.catalog_symbols > 0
    assert report.changed_count == 0
    assert report.missing_count == 0


@pytest.mark.asyncio
async def test_incremental_refresh_only_reindexes_changed_file(tmp_path):
    repo = _build_repo(tmp_path)
    idx = _make_indexer()
    await _full_index(idx, repo, "repo-inc")

    (repo / "pkg" / "a.py").write_text(_A_PY_EDITED, encoding="utf-8")
    stale = check_freshness(str(repo), repo_id="repo-inc", indexer=idx)
    assert stale.state == FRESHNESS_STALE
    assert stale.changed_count == 1
    assert stale.changed_paths == ["pkg/a.py"]

    recorder = _EmbedRecorder()
    write_mock = AsyncMock(return_value={})
    with (
        patch.object(idx, "_generate_embeddings_batch", new=recorder),
        patch.object(idx, "_write_to_api", new=write_mock),
    ):
        outcome = await ensure_fresh(
            str(repo), repo_id="repo-inc", indexer=idx, consent_check=True
        )

        assert outcome.action == "incremental"
        assert outcome.index_result is not None
        assert outcome.index_result.files_indexed == 1
        assert outcome.index_result.chunks_created == 2
        assert len(recorder.calls) == 1
        assert {chunk.file_path for chunk in recorder.calls[0]} == {"pkg/a.py"}
        assert len(recorder.calls[0]) == outcome.index_result.chunks_created
        assert write_mock.await_count == 1
        assert outcome.after.state == FRESHNESS_FRESH

        calls_after_increment = len(recorder.calls)
        again = await ensure_fresh(
            str(repo), repo_id="repo-inc", indexer=idx, consent_check=True
        )
        assert again.action == "none"
        assert len(recorder.calls) == calls_after_increment  # 没改就不重算


@pytest.mark.asyncio
async def test_deleted_file_drops_catalog_entry(tmp_path):
    repo = _build_repo(tmp_path)
    idx = _make_indexer()
    await _full_index(idx, repo, "repo-del")

    (repo / "pkg" / "b.py").unlink()
    stale = check_freshness(str(repo), repo_id="repo-del", indexer=idx)
    assert stale.state == FRESHNESS_STALE
    assert stale.missing_count >= 1
    assert "pkg/b.py" in stale.missing_sample

    with (
        patch.object(idx, "_generate_embeddings_batch", new=_EmbedRecorder()),
        patch.object(idx, "_write_to_api", new=AsyncMock(return_value={})),
        patch.object(idx, "_delete_files_from_api", new=AsyncMock(return_value=0)),
    ):
        outcome = await ensure_fresh(
            str(repo), repo_id="repo-del", indexer=idx, consent_check=True
        )

    assert outcome.action == "incremental"
    catalog = idx.load_catalog("repo-del", repo)
    assert catalog is not None
    assert "pkg/b.py" not in catalog.files
    assert "pkg/a.py" in catalog.files


@pytest.mark.asyncio
async def test_corrupt_snapshot_is_unknown_then_full_rebuild(tmp_path):
    repo = _build_repo(tmp_path)
    idx = _make_indexer()
    await _full_index(idx, repo, "repo-corrupt")

    idx._snapshot_path("repo-corrupt", repo).write_bytes(b"{not-json")
    unknown = check_freshness(str(repo), repo_id="repo-corrupt", indexer=idx)
    assert unknown.state == FRESHNESS_UNKNOWN
    assert "快照" in unknown.detail

    with (
        patch.object(idx, "_generate_embeddings_batch", new=_EmbedRecorder()),
        patch.object(idx, "_write_to_api", new=AsyncMock(return_value={})),
    ):
        outcome = await ensure_fresh(
            str(repo), repo_id="repo-corrupt", indexer=idx, consent_check=True
        )

    assert outcome.action == "full"
    # main 的 _save_snapshot 守门(2026-11-07 定稿)拒绝用新快照覆盖损坏文件,
    # 所以全量重建后快照仍是坏的 ⇒ freshness 只能继续 unknown,不得谎报 fresh。
    assert outcome.after.state == FRESHNESS_UNKNOWN
    assert "快照" in outcome.after.detail
    # 快照坏 ⇒ 目录也读不出来(同一份档),如实报 absent,不得拿内存结果冒充已落盘。
    assert outcome.after.catalog_state == "absent"


@pytest.mark.asyncio
async def test_consent_required_sends_no_remote_calls(tmp_path):
    repo = _build_repo(tmp_path)
    idx = _make_indexer()
    await _full_index(idx, repo, "repo-consent")

    (repo / "pkg" / "a.py").write_text(_A_PY_EDITED, encoding="utf-8")
    recorder = _EmbedRecorder()
    with patch.object(idx, "_generate_embeddings_batch", new=recorder):
        outcome = await ensure_fresh(
            str(repo), repo_id="repo-consent", indexer=idx, consent_check=False
        )

    assert outcome.action == "consent-required"
    assert outcome.consented is False
    assert outcome.before.state == FRESHNESS_STALE
    assert recorder.calls == []  # 零额外 embedding
    assert outcome.index_result is None


@pytest.mark.asyncio
async def test_ttl_exceeded_is_expired(tmp_path):
    repo = _build_repo(tmp_path)
    idx = _make_indexer()
    await _full_index(idx, repo, "repo-ttl")

    mtime = idx._snapshot_path("repo-ttl", repo).stat().st_mtime
    report = check_freshness(
        str(repo), repo_id="repo-ttl", indexer=idx, ttl_s=1, now=mtime + 100
    )

    assert report.state == FRESHNESS_EXPIRED
    assert "TTL" in report.detail


@pytest.mark.asyncio
async def test_max_files_bound_reports_unknown(tmp_path):
    repo = _build_repo(tmp_path)
    idx = _make_indexer()
    await _full_index(idx, repo, "repo-max")

    report = check_freshness(str(repo), repo_id="repo-max", indexer=idx, max_files=1)

    assert report.state == FRESHNESS_UNKNOWN
    assert report.total_files == 2
    assert "上限" in report.detail


@pytest.mark.asyncio
async def test_catalog_only_repair_is_local(tmp_path):
    repo = _build_repo(tmp_path)
    idx = _make_indexer()
    await _full_index(idx, repo, "repo-catalog")

    _rewrite_snapshot(idx._snapshot_path("repo-catalog", repo), lambda p: p.pop(CATALOG_KEY, None))
    stale = check_freshness(str(repo), repo_id="repo-catalog", indexer=idx)
    assert stale.state == FRESHNESS_STALE
    assert stale.catalog_state == "absent"
    assert stale.changed_count == 0
    assert stale.added_count == 0
    assert stale.missing_count == 0

    recorder = _EmbedRecorder()
    with patch.object(idx, "_generate_embeddings_batch", new=recorder):
        outcome = await ensure_fresh(
            str(repo), repo_id="repo-catalog", indexer=idx, consent_check=False
        )

    assert outcome.action == "catalog-only"
    assert outcome.catalog_result is not None
    assert outcome.after.catalog_state == "ok"
    assert recorder.calls == []  # 目录补齐零远端、零 embedding
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
