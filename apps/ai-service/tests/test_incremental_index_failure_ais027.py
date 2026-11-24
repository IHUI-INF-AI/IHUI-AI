# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AIS-027 夹具:增量索引的「写失败 / 删失败」不得把失败推进成"已完成"。

改前必红依据(两条都直接钉在旧实现的行为上):
1. 写失败:旧实现只把异常记进 `result.errors`,快照仍以**新 hash** 收敛 ⇒ 下一轮同路径
   判 `unchanged`,永远不再重写;`test_write_failure_does_not_advance_snapshot` 断言
   「同一个变更路径第二次调用仍会触发写入」,旧码第二次零写入 ⇒ 必红。
2. 删失败:旧实现里 `deleted_paths` 已被 scan 从 new_hashes 摘除且照常落快照 ⇒
   幽灵切片永留;`test_delete_failure_keeps_snapshot_entry_for_retry` 断言快照里仍有该
   路径,旧码必红。
"""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.services import codebase_indexer
from app.services.codebase_incremental_index import index_changed_paths
from app.services.codebase_indexer import CodebaseIndexer

REPO_ID = "repo-ais027"


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


async def _seed(idx: CodebaseIndexer, root, files: dict[str, str]) -> None:
    for name, text in files.items():
        (root / name).write_text(text, encoding="utf-8")
    with patch.object(idx, "_generate_embeddings_batch", new=AsyncMock(return_value=1)):
        with patch.object(idx, "_write_to_api", new=AsyncMock(return_value={})):
            await idx.index_repository(str(root), REPO_ID)


def _snapshot_files(idx: CodebaseIndexer, root) -> set[str]:
    snap = idx._load_snapshot_read(REPO_ID, root.resolve())
    assert snap.state in {"ok", "legacy"}, f"快照不可用: {snap.state} {snap.detail}"
    return set(snap.files)


class TestIncrementalWriteFailureAis027:
    @pytest.mark.asyncio
    async def test_write_failure_does_not_advance_snapshot(self, tmp_path):
        idx = _make_indexer()
        await _seed(idx, tmp_path, {"a.py": "def foo():\n    return 1\n"})
        assert "a.py" in _snapshot_files(idx, tmp_path)

        (tmp_path / "a.py").write_text("def foo():\n    return 2\n", encoding="utf-8")
        write_mock = AsyncMock(side_effect=RuntimeError("vector store 503"))
        with patch.object(idx, "_generate_embeddings_batch", new=AsyncMock(return_value=1)):
            with patch.object(idx, "_write_to_api", new=write_mock):
                first = await index_changed_paths(
                    idx, str(tmp_path), [str(tmp_path / "a.py")], REPO_ID
                )
        assert any("写入" in e for e in first.errors), first.errors
        # 关键:失败的那份不得带着新 hash 进快照,否则下一轮判 unchanged
        assert "a.py" not in _snapshot_files(idx, tmp_path)

        # 下一轮同路径必须重新索引并写回(旧实现这里写次数为 0)
        retry_mock = AsyncMock(return_value={})
        with patch.object(idx, "_generate_embeddings_batch", new=AsyncMock(return_value=1)):
            with patch.object(idx, "_write_to_api", new=retry_mock):
                second = await index_changed_paths(
                    idx, str(tmp_path), [str(tmp_path / "a.py")], REPO_ID
                )
        assert retry_mock.await_count >= 1, "写失败的路径没有在下一轮重试"
        assert second.files_indexed >= 1
        assert "a.py" in _snapshot_files(idx, tmp_path)

    @pytest.mark.asyncio
    async def test_write_failure_keeps_other_files_converged(self, tmp_path):
        """失败只冻结受影响文件,不拖累同批其它文件——否则一次抖动会放大成整轮不收敛。"""
        idx = _make_indexer()
        await _seed(idx, tmp_path, {"a.py": "def foo():\n    return 1\n", "b.py": "def bar():\n    return 2\n"})
        (tmp_path / "b.py").write_text("def bar():\n    return 3\n", encoding="utf-8")

        async def flaky(_repo_id, batch, *_args):
            if any(c.file_path == "b.py" for c in batch):
                raise RuntimeError("boom")
            return {}

        with patch.object(idx, "_generate_embeddings_batch", new=AsyncMock(return_value=1)):
            with patch.object(idx, "_write_to_api", new=AsyncMock(side_effect=flaky)):
                await index_changed_paths(idx, str(tmp_path), [str(tmp_path / "b.py")], REPO_ID)

        files = _snapshot_files(idx, tmp_path)
        assert "b.py" not in files, "写失败的文件不得进快照"
        assert "a.py" in files, "未受影响文件必须照常收敛"


class TestIncrementalDeleteFailureAis027:
    @pytest.mark.asyncio
    async def test_delete_failure_keeps_snapshot_entry_for_retry(self, tmp_path):
        idx = _make_indexer()
        await _seed(idx, tmp_path, {"a.py": "def foo():\n    return 1\n", "b.py": "def bar():\n    return 2\n"})
        (tmp_path / "b.py").unlink()

        with patch.object(idx, "_delete_files_from_api", new=AsyncMock(return_value=0)):
            with patch.object(idx, "_generate_embeddings_batch", new=AsyncMock(return_value=1)):
                with patch.object(idx, "_write_to_api", new=AsyncMock(return_value={})):
                    result = await index_changed_paths(
                        idx, str(tmp_path), [str(tmp_path / "b.py")], REPO_ID
                    )
        assert result.files_deleted == 0
        assert any("删除未完成" in e for e in result.errors), result.errors
        # 关键:没删掉的条目必须留在快照里,下一轮才会再进 deleted_candidates
        assert "b.py" in _snapshot_files(idx, tmp_path), "删除失败被记成了已删除(幽灵切片永留)"

        # 下一轮删除成功 ⇒ 才允许从快照摘除
        with patch.object(idx, "_delete_files_from_api", new=AsyncMock(return_value=1)):
            with patch.object(idx, "_generate_embeddings_batch", new=AsyncMock(return_value=1)):
                with patch.object(idx, "_write_to_api", new=AsyncMock(return_value={})):
                    retry = await index_changed_paths(
                        idx, str(tmp_path), [str(tmp_path / "b.py")], REPO_ID
                    )
        assert retry.files_deleted == 1
        assert "b.py" not in _snapshot_files(idx, tmp_path)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
