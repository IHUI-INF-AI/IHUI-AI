# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""codebase_indexer Merkle 增量同步 + 三层语义索引测试(2026-09-07 立)。

覆盖:
- _file_content_hash / _merkle_root(任意文件增删改均改变根 hash)
- index_repository 增量:首轮全量 → 零变更跳过 → 单文件重索引 → 删除清理
- incremental=False 强制全量
- 快照原子持久化(无 .tmp 残留)
- _delete_files_from_api(DELETE /repo/:id/files,失败返回 None 与成功 0 可分)
- 三层语义切片:module_summary / architecture_summary 生成条件与集成
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services import codebase_indexer
from app.services.codebase_indexer import CodebaseIndexer, CodeChunk


@pytest.fixture(autouse=True)
def _isolate_merkle_snapshot_dir(tmp_path, monkeypatch):
    """快照写入重定向到 tmp_path,防污染真实用户目录。"""
    monkeypatch.setattr(
        codebase_indexer, "_MERKLE_SNAPSHOT_DIR", tmp_path / "merkle-snapshots"
    )


def _make_indexer() -> CodebaseIndexer:
    idx = CodebaseIndexer.__new__(CodebaseIndexer)
    idx._tree_sitter_available = False
    idx._api_base_url = "http://localhost:8801"
    return idx


class TestMerkleHelpers:
    def test_content_hash_deterministic(self):
        h1 = codebase_indexer._file_content_hash("abc")
        h2 = codebase_indexer._file_content_hash("abc")
        h3 = codebase_indexer._file_content_hash("abd")
        assert h1 == h2
        assert h1 != h3

    def test_merkle_root_sensitive_to_any_change(self):
        base = {"a.py": "h1", "b.py": "h2"}
        r1 = codebase_indexer._merkle_root(base)
        assert codebase_indexer._merkle_root({**base, "b.py": "h3"}) != r1
        assert codebase_indexer._merkle_root({**base, "c.py": "h4"}) != r1
        assert codebase_indexer._merkle_root({"a.py": "h1"}) != r1
        assert codebase_indexer._merkle_root({"b.py": "h2", "a.py": "h1"}) == r1


class TestIncrementalIndex:
    @pytest.mark.asyncio
    async def test_first_index_then_unchanged_skip(self, tmp_path):
        (tmp_path / "main.py").write_text("def foo():\n    return 1\n")
        (tmp_path / "util.py").write_text("def bar():\n    return 2\n")
        idx = _make_indexer()
        with patch.object(idx, "_generate_embeddings_batch", new=AsyncMock(return_value=2)):
            with patch.object(idx, "_write_to_api", new=AsyncMock(return_value={})):
                first = await idx.index_repository(str(tmp_path), "repo-inc")
        assert first.files_indexed == 2
        assert first.files_unchanged == 0
        assert first.merkle_root != ""

        embed_mock = AsyncMock(return_value=0)
        write_mock = AsyncMock(return_value={})
        with patch.object(idx, "_generate_embeddings_batch", new=embed_mock):
            with patch.object(idx, "_write_to_api", new=write_mock):
                second = await idx.index_repository(str(tmp_path), "repo-inc")
        assert second.files_unchanged == 2
        assert second.files_indexed == 0
        assert second.chunks_created == 0
        embed_mock.assert_not_called()

    @pytest.mark.asyncio
    async def test_modified_file_reindexed_only(self, tmp_path):
        (tmp_path / "a.py").write_text("def foo():\n    return 1\n")
        (tmp_path / "b.py").write_text("def bar():\n    return 2\n")
        idx = _make_indexer()
        with patch.object(idx, "_generate_embeddings_batch", new=AsyncMock(return_value=2)):
            with patch.object(idx, "_write_to_api", new=AsyncMock(return_value={})):
                await idx.index_repository(str(tmp_path), "repo-mod")
        (tmp_path / "a.py").write_text("def foo():\n    return 999\n")
        with patch.object(idx, "_generate_embeddings_batch", new=AsyncMock(return_value=1)):
            with patch.object(idx, "_write_to_api", new=AsyncMock(return_value={})):
                result = await idx.index_repository(str(tmp_path), "repo-mod")
        assert result.files_indexed == 1
        assert result.files_unchanged == 1

    @pytest.mark.asyncio
    async def test_deleted_file_triggers_ghost_cleanup(self, tmp_path):
        (tmp_path / "a.py").write_text("def foo():\n    return 1\n")
        (tmp_path / "b.py").write_text("def bar():\n    return 2\n")
        idx = _make_indexer()
        with patch.object(idx, "_generate_embeddings_batch", new=AsyncMock(return_value=2)):
            with patch.object(idx, "_write_to_api", new=AsyncMock(return_value={})):
                await idx.index_repository(str(tmp_path), "repo-del")
        (tmp_path / "b.py").unlink()
        delete_mock = AsyncMock(return_value=3)
        with patch.object(idx, "_delete_files_from_api", new=delete_mock):
            with patch.object(idx, "_generate_embeddings_batch", new=AsyncMock(return_value=1)):
                with patch.object(idx, "_write_to_api", new=AsyncMock(return_value={})):
                    result = await idx.index_repository(str(tmp_path), "repo-del")
        assert result.files_deleted == 3
        deleted_args = delete_mock.call_args.args[1]
        assert "b.py" in deleted_args
        assert "a.py" not in deleted_args

    @pytest.mark.asyncio
    async def test_unreadable_directory_is_not_a_deleted_file(self, tmp_path, monkeypatch):
        """子目录列不出来时,里面的文件不能被当成已删除去清切片。"""
        import os
        from pathlib import Path

        monkeypatch.setenv("IHUI_DISABLE_RIPGREP_ENUMERATION", "1")
        (tmp_path / "keep.py").write_text("def keep():\n    return 1\n", encoding="utf-8")
        blocked = tmp_path / "blocked"
        blocked.mkdir()
        hidden = blocked / "hidden.py"
        hidden.write_text("def hidden():\n    return 1\n", encoding="utf-8")
        idx = _make_indexer()
        with patch.object(idx, "_generate_embeddings_batch", new=AsyncMock(return_value=2)):
            with patch.object(idx, "_write_to_api", new=AsyncMock(return_value={})):
                first = await idx.index_repository(str(tmp_path), "repo-unread")
        assert first.files_indexed == 2
        real_scandir = os.scandir

        def deny(path: str) -> object:
            if Path(path).name == "blocked":
                raise PermissionError(13, "denied", str(path))
            return real_scandir(path)

        monkeypatch.setattr(os, "scandir", deny)
        delete_mock = AsyncMock(return_value=1)
        with patch.object(idx, "_delete_files_from_api", new=delete_mock):
            with patch.object(idx, "_generate_embeddings_batch", new=AsyncMock(return_value=0)):
                with patch.object(idx, "_write_to_api", new=AsyncMock(return_value={})):
                    second = await idx.index_repository(str(tmp_path), "repo-unread")
        assert second.files_deleted == 0
        delete_mock.assert_not_called()
        assert any("不能把没列到的文件当成已删除" in err for err in second.errors)
        assert hidden.read_text(encoding="utf-8") == "def hidden():\n    return 1\n"

    @pytest.mark.asyncio
    async def test_incremental_false_forces_full(self, tmp_path):
        (tmp_path / "main.py").write_text("def foo():\n    return 1\n")
        idx = _make_indexer()
        with patch.object(idx, "_generate_embeddings_batch", new=AsyncMock(return_value=1)):
            with patch.object(idx, "_write_to_api", new=AsyncMock(return_value={})):
                await idx.index_repository(str(tmp_path), "repo-full")
        with patch.object(idx, "_generate_embeddings_batch", new=AsyncMock(return_value=1)):
            with patch.object(idx, "_write_to_api", new=AsyncMock(return_value={})):
                result = await idx.index_repository(
                    str(tmp_path), "repo-full", incremental=False
                )
        assert result.files_indexed == 1
        assert result.files_unchanged == 0

    @pytest.mark.asyncio
    async def test_snapshot_persisted_atomically(self, tmp_path):
        (tmp_path / "main.py").write_text("def foo():\n    return 1\n")
        idx = _make_indexer()
        with patch.object(idx, "_generate_embeddings_batch", new=AsyncMock(return_value=1)):
            with patch.object(idx, "_write_to_api", new=AsyncMock(return_value={})):
                await idx.index_repository(str(tmp_path), "repo-snap")
        snap_dir = codebase_indexer._MERKLE_SNAPSHOT_DIR
        snaps = list(snap_dir.glob("repo-snap-*.merkle.json"))
        assert len(snaps) == 1
        assert list(snap_dir.glob("*.tmp")) == []


class TestDeleteFilesFromApi:
    @pytest.mark.asyncio
    async def test_successful_delete(self):
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        idx._api_base_url = "http://localhost:8801"
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"code": 0, "data": {"deleted": 5}}
        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.request = AsyncMock(return_value=mock_resp)
        with patch("httpx.AsyncClient", return_value=mock_client):
            deleted = await idx._delete_files_from_api("repo-1", ["gone.py"], None)
        assert deleted == 5
        method, url = mock_client.request.call_args.args
        assert method == "DELETE"
        assert url == "http://localhost:8801/api/v1/codebase/repo/repo-1/files"

    @pytest.mark.asyncio
    async def test_empty_paths_noop(self):
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        idx._api_base_url = "http://localhost:8801"
        assert await idx._delete_files_from_api("repo-1", [], None) == 0

    @pytest.mark.asyncio
    async def test_api_error_returns_none(self):
        """AIS-027:删除失败必须与"成功删了 0 条"可分(返回 None),否则失败静默。"""
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        idx._api_base_url = "http://localhost:8801"
        mock_resp = MagicMock()
        mock_resp.status_code = 500
        mock_resp.text = "boom"
        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.request = AsyncMock(return_value=mock_resp)
        with patch("httpx.AsyncClient", return_value=mock_client):
            assert await idx._delete_files_from_api("repo-1", ["x.py"], None) is None


class TestAis027CommitSemantics:
    """AIS-027:快照只记"真正已索引"的状态,失败必须留待下轮重试。"""

    @pytest.mark.asyncio
    async def test_write_failure_is_retried_next_round(self, tmp_path):
        """写库批次失败的文件不得按 unchanged 跳过,否则永久检索不到。"""
        (tmp_path / "a.py").write_text("def foo():\n    return 1\n")
        idx = _make_indexer()

        calls = {"n": 0}

        async def flaky_write(repo_id, batch, *args, **kwargs):
            calls["n"] += 1
            if calls["n"] == 1:
                raise RuntimeError("vector store down")
            return {}

        with patch.object(idx, "_generate_embeddings_batch", new=AsyncMock(return_value=1)):
            with patch.object(idx, "_write_to_api", new=AsyncMock(side_effect=flaky_write)):
                first = await idx.index_repository(str(tmp_path), "repo-retry")
        assert first.errors, "写失败必须显式报错,不能被吞"
        assert any("下轮重试" in e for e in first.errors)

        embed = AsyncMock(return_value=0)
        write = AsyncMock(return_value={})
        with patch.object(idx, "_generate_embeddings_batch", new=embed):
            with patch.object(idx, "_write_to_api", new=write):
                second = await idx.index_repository(str(tmp_path), "repo-retry")
        assert second.files_unchanged == 0, (
            "写失败的文件被判 unchanged ⇒ 下一轮永远不会重写"
        )
        assert second.files_indexed == 1
        assert embed.await_count == 1, "重试轮必须重新向量化该文件"

    @pytest.mark.asyncio
    async def test_delete_failure_keeps_entry_for_retry(self, tmp_path):
        """删除失败路径必须留在快照里,否则幽灵切片永不清理。"""
        (tmp_path / "a.py").write_text("def foo():\n    return 1\n")
        idx = _make_indexer()
        with patch.object(idx, "_generate_embeddings_batch", new=AsyncMock(return_value=1)):
            with patch.object(idx, "_write_to_api", new=AsyncMock(return_value={})):
                await idx.index_repository(str(tmp_path), "repo-del-retry")

        (tmp_path / "a.py").unlink()
        with patch.object(idx, "_generate_embeddings_batch", new=AsyncMock(return_value=0)):
            with patch.object(idx, "_write_to_api", new=AsyncMock(return_value={})):
                with patch.object(
                    idx, "_delete_files_from_api", new=AsyncMock(return_value=None)
                ):
                    second = await idx.index_repository(str(tmp_path), "repo-del-retry")
        assert any("删除幽灵切片失败" in e for e in second.errors)

        delete_ok = AsyncMock(return_value=1)
        with patch.object(idx, "_generate_embeddings_batch", new=AsyncMock(return_value=0)):
            with patch.object(idx, "_write_to_api", new=AsyncMock(return_value={})):
                with patch.object(idx, "_delete_files_from_api", new=delete_ok):
                    third = await idx.index_repository(str(tmp_path), "repo-del-retry")
        assert third.files_deleted == 1
        delete_ok.assert_awaited_once()
        _, deleted = delete_ok.await_args.args[0], delete_ok.await_args.args[1]
        assert deleted == ["a.py"], "删除失败路径丢失 ⇒ 下一轮不会再尝试删除"


class TestThreeLayerSemanticChunks:
    def _symbol_chunks(self, n: int, path: str = "src/mod.py") -> list[CodeChunk]:
        return [
            CodeChunk(
                file_path=path,
                line_start=i * 10 + 1,
                line_end=i * 10 + 9,
                content=f"def fn_{i}():\n    pass\n",
                language="python",
                symbol_name=f"fn_{i}",
                symbol_type="function",
            )
            for i in range(n)
        ]

    def test_module_summary_skipped_for_small_files(self):
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        assert idx._build_module_summary_chunks("a.py", "python", self._symbol_chunks(3)) is None

    def test_module_summary_generated_for_large_files(self):
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        chunk = idx._build_module_summary_chunks("src/mod.py", "python", self._symbol_chunks(5))
        assert chunk is not None
        assert chunk.symbol_type == "module_summary"
        assert chunk.file_path == "src/mod.py"
        assert "Module summary: src/mod.py" in chunk.content
        assert "fn_0" in chunk.content
        assert "fn_4" in chunk.content

    def test_architecture_summary_requires_min_files(self):
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        chunks = idx._build_architecture_summary_chunks(
            [("src/a.py", "python", 2), ("src/b.py", "python", 1)]
        )
        assert chunks == []
        chunks = idx._build_architecture_summary_chunks(
            [("src/a.py", "python", 2), ("src/b.py", "python", 1), ("src/c.py", "python", 3)]
        )
        assert len(chunks) == 1
        assert chunks[0].symbol_type == "architecture_summary"
        assert chunks[0].file_path == "src/"
        assert "Architecture summary: directory 'src'" in chunks[0].content

    def test_architecture_summary_groups_by_top_dir(self):
        idx = CodebaseIndexer.__new__(CodebaseIndexer)
        files = [
            ("apps/web/a.ts", "typescript", 1),
            ("apps/web/b.ts", "typescript", 1),
            ("apps/web/c.ts", "typescript", 1),
            ("apps/api/x.py", "python", 1),
            ("apps/api/y.py", "python", 1),
            ("apps/api/z.py", "python", 1),
        ]
        chunks = idx._build_architecture_summary_chunks(files)
        assert len(chunks) == 2
        assert {c.file_path for c in chunks} == {"apps/web/", "apps/api/"}

    @pytest.mark.asyncio
    async def test_layers_integrated_into_index_repository(self, tmp_path):
        (tmp_path / "a.py").write_text(
            "def f1():\n    pass\n\ndef f2():\n    pass\n\ndef f3():\n    pass\n\ndef f4():\n    pass\n"
        )
        (tmp_path / "b.py").write_text("def g1():\n    pass\n")
        (tmp_path / "c.py").write_text("def h1():\n    pass\n")
        idx = _make_indexer()
        with patch.object(idx, "_generate_embeddings_batch", new=AsyncMock(return_value=9)):
            with patch.object(idx, "_write_to_api", new=AsyncMock(return_value={})) as wm:
                result = await idx.index_repository(str(tmp_path), "repo-layer")
        written_types: list = []
        for call in wm.call_args_list:
            for c in call.args[1]:
                written_types.append(c.symbol_type)
        assert "module_summary" in written_types
        assert "architecture_summary" in written_types
        assert result.files_indexed == 3
