# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""auto_context 本地目录检索腿测试(2026-11-07)。

语义腿(`codebase_indexer.search`)与本地目录腿并行:本地腿命中要带
`retrieval_leg="local-catalog"` 且正文是符号源代码;本地腿抛异常不得吞掉语义腿;
不给 `workspace_path` 时本地腿根本不启动。
"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core import auto_context
from app.services import codebase_indexer as indexer_module
from app.services.codebase_indexer import codebase_indexer

_A_PY = "def alpha_function():\n    return 1\n"
_B_PY = "def gamma_function():\n    return 2\n"


@pytest.fixture(autouse=True)
def _isolate(monkeypatch, tmp_path):
    monkeypatch.setattr(
        indexer_module, "_MERKLE_SNAPSHOT_DIR", tmp_path / "merkle-snapshots"
    )
    monkeypatch.delenv("IHUI_AUTO_CONTEXT_DISABLE", raising=False)


def _build_repo(tmp_path: Path) -> Path:
    repo = tmp_path / "repo"
    pkg = repo / "pkg"
    pkg.mkdir(parents=True)
    (pkg / "a.py").write_text(_A_PY, encoding="utf-8")
    (pkg / "b.py").write_text(_B_PY, encoding="utf-8")
    return repo


async def _build_index(repo: Path, repo_id: str) -> None:
    with (
        patch.object(
            codebase_indexer, "_generate_embeddings_batch", new=AsyncMock(return_value=1)
        ),
        patch.object(codebase_indexer, "_write_to_api", new=AsyncMock(return_value={})),
    ):
        await codebase_indexer.index_repository(str(repo), repo_id, incremental=False)
    catalog = codebase_indexer.load_catalog(repo_id, repo)
    assert catalog is not None
    assert catalog.symbol_count > 0


@pytest.mark.asyncio
async def test_local_catalog_leg_contributes_symbol_source(tmp_path, monkeypatch):
    repo = _build_repo(tmp_path)
    await _build_index(repo, "repo-auto-local")

    monkeypatch.setattr(codebase_indexer, "search", AsyncMock(return_value=[]))
    chunks = await auto_context.auto_retrieve(
        "alpha_function", workspace_path=str(repo), top_k=3
    )

    assert chunks
    assert any(chunk["retrieval_leg"] == "local-catalog" for chunk in chunks)
    local = [chunk for chunk in chunks if chunk["retrieval_leg"] == "local-catalog"]
    assert "def alpha_function():" in str(local[0]["content"])


@pytest.mark.asyncio
async def test_semantic_leg_survives_local_leg_failure(tmp_path, monkeypatch):
    semantic = {
        "file_path": "remote.py",
        "line_start": 1,
        "line_end": 2,
        "content": "remote semantic content",
        "score": 0.9,
    }
    monkeypatch.setattr(codebase_indexer, "search", AsyncMock(return_value=[semantic]))

    def _boom(*args: object, **kwargs: object) -> list[dict[str, object]]:
        raise RuntimeError("local catalog boom")

    monkeypatch.setattr(auto_context, "_local_catalog_hits", _boom)
    (tmp_path / "empty").mkdir()

    chunks = await auto_context.auto_retrieve(
        "alpha_function", workspace_path=str(tmp_path / "empty"), top_k=2
    )

    assert len(chunks) == 1
    assert chunks[0]["retrieval_leg"] == "semantic"
    assert chunks[0]["content"] == "remote semantic content"


@pytest.mark.asyncio
async def test_without_workspace_path_local_leg_not_attempted(tmp_path, monkeypatch):
    semantic = {
        "file_path": "remote.py",
        "line_start": 1,
        "line_end": 2,
        "content": "remote semantic content",
        "score": 0.9,
    }
    monkeypatch.setattr(codebase_indexer, "search", AsyncMock(return_value=[semantic]))
    guard = MagicMock(side_effect=AssertionError("本地腿不该被调用"))
    monkeypatch.setattr(auto_context, "_local_catalog_hits", guard)

    chunks = await auto_context.auto_retrieve("alpha_function", top_k=2)

    assert len(chunks) == 1
    assert chunks[0]["retrieval_leg"] == "semantic"
    guard.assert_not_called()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
