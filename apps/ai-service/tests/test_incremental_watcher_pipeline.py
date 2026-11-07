# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""事件驱动增量索引入口用例(goal-b49 Z8)。

钉死四格:
1. 同一变更集下,增量入口落库行集/快照与"全量重扫"逐字等值(正向对照);
2. 删除的文件确实从索引里消失(断言旧行不再存在,正向对照=同伴文件仍在);
3. 空批/形态不合/坏快照 ⇒ 未判定并点名,零副作用(§0.3,不冒充"没有变更");
4. 两路径共用判据:增量轮零成本跳过未变文件(files_unchanged 可数)。

隔离:api 写删端点与 embed 全部假实现(零网络、零 DB,不碰 PG/Redis)。
"""

from __future__ import annotations

import copy
from unittest.mock import AsyncMock, patch

import pytest

from app.services import codebase_indexer as ci
from app.services.codebase_incremental_index import index_changed_paths
from app.services.codebase_indexer import CodebaseIndexer

REPO_ID = "r1"
A_PY = "".join(f"def f{i}():\n    return {i}\n\n" for i in range(1, 6))


@pytest.fixture(autouse=True)
def _snap_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(ci, "_MERKLE_SNAPSHOT_DIR", tmp_path / "snaps")


class _FakeApi:
    """模拟 api 侧写删端点:indexChunks 按 filePath 先删旧再插新(幂等契约)。"""

    def __init__(self, indexer: CodebaseIndexer) -> None:
        self.store: dict[str, list[dict]] = {}
        self._patches = [
            patch.object(indexer, "_write_to_api", new=AsyncMock(side_effect=self._write)),
            patch.object(indexer, "_delete_files_from_api", new=AsyncMock(side_effect=self._delete)),
            patch.object(indexer, "_generate_embeddings_batch", new=AsyncMock(side_effect=self._embed)),
        ]

    async def _write(self, repo_id, chunks, api_token=None, internal_user_id=None):
        for fp in {c.file_path for c in chunks}:
            self.store.pop(fp, None)
        for c in chunks:
            self.store.setdefault(c.file_path, []).append(
                {
                    "filePath": c.file_path,
                    "lineStart": c.line_start,
                    "lineEnd": c.line_end,
                    "content": c.content,
                    "symbolType": c.symbol_type,
                    "symbolName": c.symbol_name,
                    "embedding": c.embedding,
                }
            )
        return {"ok": True}

    async def _delete(self, repo_id, file_paths, api_token=None, internal_user_id=None):
        return sum(len(self.store.pop(fp, [])) for fp in file_paths)

    async def _embed(self, chunks):
        for c in chunks:
            c.embedding = [float(len(c.content))]
            c.embedding_provider = "fake-remote"
        return len(chunks)

    def __enter__(self):
        for p in self._patches:
            p.start()
        return self

    def __exit__(self, *exc):
        for p in self._patches:
            p.stop()
        return False

    def rows(self) -> list:
        return sorted(
            (fp, r["lineStart"], r["lineEnd"], r["content"], r["symbolType"], r["symbolName"],
             tuple(r["embedding"] or []))
            for fp, rows in self.store.items()
            for r in rows
        )


def _make_repo(root):
    (root / "src").mkdir(parents=True)
    (root / "a.py").write_text(A_PY, encoding="utf-8")
    (root / "b.ts").write_text("export function beta(x: number): number {\n  return x + 1\n}\n", encoding="utf-8")
    (root / "w.md").write_text("# doc\nlines\n", encoding="utf-8")
    for name in ("x", "y", "z"):
        (root / "src" / f"{name}.py").write_text(f"def f_{name}():\n    return 1\n", encoding="utf-8")


async def _churn_disk(root):
    """改 a.py / 删 b.ts / 增 n.py —— 两路径要吃进同一变更集的三格。"""
    (root / "a.py").write_text(A_PY + "def f6():\n    return 6\n", encoding="utf-8")
    (root / "b.ts").unlink()
    (root / "n.py").write_text("def fn():\n    return 42\n", encoding="utf-8")


@pytest.mark.asyncio
async def test_incremental_hits_equal_full_rescan(tmp_path):
    root = tmp_path / "repo"
    root.mkdir()
    _make_repo(root)
    indexer = CodebaseIndexer()
    snap_path = indexer._snapshot_path(REPO_ID, root)
    with _FakeApi(indexer) as fake:
        await indexer.index_repository(str(root), repo_id=REPO_ID)  # 冷启动(全量)
        baseline_store = copy.deepcopy(fake.store)
        baseline_snap = snap_path.read_bytes()
        _churn_disk(root)

        res_full = await indexer.index_repository(str(root), repo_id=REPO_ID)
        rows_full = fake.rows()
        snap_full = indexer._load_snapshot_read(REPO_ID, root)

        fake.store.clear()
        fake.store.update(copy.deepcopy(baseline_store))
        snap_path.write_bytes(baseline_snap)
        res_inc = await index_changed_paths(
            indexer, str(root), [str(root / "a.py"), str(root / "b.ts"), str(root / "n.py")],
            repo_id=REPO_ID,
        )
        rows_inc = fake.rows()
        snap_inc = indexer._load_snapshot_read(REPO_ID, root)

    # 行集逐字等值(切片/模块摘要/架构摘要全在内)
    assert rows_full == rows_inc
    # 快照四维等值 + 整仓 merkle 根等值
    assert res_full.merkle_root == res_inc.merkle_root
    assert snap_full.files == snap_inc.files
    assert snap_full.fingerprints == snap_inc.fingerprints
    assert snap_full.aliases == snap_inc.aliases
    assert snap_full.dir_rhashes == snap_inc.dir_rhashes
    assert res_full.chunks_created == res_inc.chunks_created
    assert res_inc.errors == [] and res_inc.snapshot_state == "ok"


@pytest.mark.asyncio
async def test_deleted_file_purged_from_index(tmp_path):
    root = tmp_path / "repo"
    root.mkdir()
    _make_repo(root)
    indexer = CodebaseIndexer()
    victim = root / "src" / "x.py"
    with _FakeApi(indexer) as fake:
        await indexer.index_repository(str(root), repo_id=REPO_ID)
        assert "src/x.py" in fake.store  # 正向对照:确实在索引里
        victim.unlink()
        res = await index_changed_paths(indexer, str(root), [str(victim)], repo_id=REPO_ID)
        snap = indexer._load_snapshot_read(REPO_ID, root)
    assert "src/x.py" not in fake.store  # 旧条目不再被查得到(副作用维)
    assert "src/y.py" in fake.store  # 同伴文件未被牵连
    assert res.files_deleted >= 1
    assert "src/x.py" not in snap.files
    assert res.errors == []


@pytest.mark.asyncio
async def test_unreadable_root_does_not_enter_incremental_delete(tmp_path, monkeypatch):
    (tmp_path / "keep.py").write_text("keep\n", encoding="utf-8")
    monkeypatch.setattr(
        "app.services.codebase_incremental_index.classify_fs_path",
        lambda _path: "unread",
    )
    idx = CodebaseIndexer.__new__(CodebaseIndexer)
    result = await index_changed_paths(idx, str(tmp_path), [str(tmp_path / "keep.py")])
    assert any("读不到" in err for err in result.errors)
    assert (tmp_path / "keep.py").read_text(encoding="utf-8") == "keep\n"


@pytest.mark.asyncio
async def test_empty_and_malformed_batch_are_undetermined(tmp_path):
    root = tmp_path / "repo"
    root.mkdir()
    _make_repo(root)
    indexer = CodebaseIndexer()
    with _FakeApi(indexer) as fake:
        await indexer.index_repository(str(root), repo_id=REPO_ID)
        rows_before = fake.rows()
        res_empty = await index_changed_paths(indexer, str(root), [], repo_id=REPO_ID)
        res_bad = await index_changed_paths(indexer, str(root), ["   "], repo_id=REPO_ID)
        res_mix = await index_changed_paths(
            indexer, str(root), ["   ", str(root / "a.py")], repo_id=REPO_ID
        )
        assert fake.rows() == rows_before  # 三格都零副作用
    assert any("未判定" in e for e in res_empty.errors)
    assert any("形态不合" in e for e in res_bad.errors)
    assert any("形态不合" in e for e in res_mix.errors)
    assert res_mix.files_unchanged == 1 and res_mix.files_indexed == 0  # a.py 未变⇒零成本跳过


@pytest.mark.asyncio
async def test_corrupt_snapshot_refuses_increment(tmp_path):
    root = tmp_path / "repo"
    root.mkdir()
    _make_repo(root)
    indexer = CodebaseIndexer()
    with _FakeApi(indexer) as fake:
        await indexer.index_repository(str(root), repo_id=REPO_ID)
        rows_before = fake.rows()
        indexer._snapshot_path(REPO_ID, root).write_bytes(b"\x1f\x8b broken-gzip")
        res = await index_changed_paths(indexer, str(root), [str(root / "a.py")], repo_id=REPO_ID)
        assert fake.rows() == rows_before  # 坏快照轮:零写零删
    assert res.snapshot_state == ci.SNAPSHOT_STATE_CORRUPT
    assert any("未判定" in e and "index_repository" in e for e in res.errors)
    assert res.files_indexed == 0 and res.chunks_created == 0


def test_save_snapshot_keeps_corrupt_bytes(tmp_path, monkeypatch):
    monkeypatch.setattr(ci, "_MERKLE_SNAPSHOT_DIR", tmp_path)
    indexer = CodebaseIndexer()
    root = tmp_path / "repo"
    root.mkdir()
    path = indexer._snapshot_path(REPO_ID, root)
    body = b"{not json"
    path.write_bytes(body)
    indexer._save_snapshot(REPO_ID, root, {"a.py": "abc"})
    assert path.read_bytes() == body


def _public_defined(mod):
    return sorted(
        name
        for name, val in vars(mod).items()
        if not name.startswith("_") and getattr(val, "__module__", None) == mod.__name__
    )


def test_incremental_split_export_sets_locked():
    """拆档导出集加锁:预扫/入口两档各只有一个公开出口,防"第二把尺"回潮(§0.6)。"""
    from app.services import codebase_incremental_index as inc_index
    from app.services import codebase_incremental_scan as inc_scan

    assert _public_defined(inc_index) == ["index_changed_paths"]
    assert _public_defined(inc_scan) == ["BatchScan", "scan_incremental_batch"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
