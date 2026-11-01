# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""目录级递归前像的**接线钉**(T12 缺口表 #1 后半程,2026-11-01)。

模块 `dir_rhash.py` 是纯函数(18 例在 test_dir_rhash.py);本件钉的是它住进
`codebase_indexer` 增量链之后的四条行为:
1. 每轮落盘的快照必须带 `dirRhashes`(否则下一轮永远"没有这一维");
2. 整枝搬家在响应上点名,且只报最浅一枝(祖先已报,后代不重复计);
3. 上一轮档没有这一维 ⇒ 响应明说"本轮起才有",不冒充"判过且干净";
4. 上一轮档自证失败 ⇒ 目录差分这一维宁可报"没做",不拿垃圾读数。

差分只读不改:不参与删除/别名/重索引决策(那两维归逐文件判据与 P85)。
"""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from app.services import codebase_indexer as ci
from app.services.codebase_indexer import CodebaseIndexer


@pytest.fixture(autouse=True)
def _snap_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(ci, "_MERKLE_SNAPSHOT_DIR", tmp_path / "snaps")


def _write(root: Path, rel: str, body: str) -> Path:
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body, encoding="utf-8")
    return path


async def _index(root: Path) -> ci.IndexResult:
    idx = CodebaseIndexer.__new__(CodebaseIndexer)
    idx._tree_sitter_available = False
    idx._api_base_url = "http://localhost:8801"
    with (
        patch.object(idx, "_generate_embeddings_batch", new=AsyncMock(return_value=0)),
        patch.object(idx, "_write_to_api", new=AsyncMock(return_value={})),
        patch.object(idx, "_delete_files_from_api", new=AsyncMock(return_value=0)),
    ):
        return await idx.index_repository(str(root), "repo-1")


def _snapshot_payload() -> dict:
    snaps = list(ci._MERKLE_SNAPSHOT_DIR.glob("repo-1-*.merkle.json"))
    assert len(snaps) == 1, f"快照文件应恰好一枚,现读 {len(snaps)}"
    return json.loads(snaps[0].read_text(encoding="utf-8"))


@pytest.mark.asyncio
async def test_round1_writes_dir_rhashes_into_snapshot(tmp_path):
    """每轮快照必须带目录前像 —— 缺了它,下一轮的整枝比对就永远是"没这一维"。"""
    root = tmp_path / "repo"
    _write(root, "src/pkg/a.py", "A = 1\n")
    _write(root, "src/b.py", "B = 2\n")
    await _index(root)
    payload = _snapshot_payload()
    assert "dirRhashes" in payload, "快照缺 dirRhashes ⇒ 整枝比对永远判不出"
    dirs = payload["dirRhashes"]
    assert "" in dirs, "根目录的键必须是空串(与 dir_rhash_map 的口径同一套)"
    assert {"src", "src/pkg"} <= set(dirs), "每一层目录都要有前像,少一层就漏一格"


@pytest.mark.asyncio
async def test_round2_directory_move_is_reported_shallowest_branch(tmp_path):
    """整枝搬家在响应上点名,且只报最浅一枝。"""
    root = tmp_path / "repo"
    _write(root, "src/pkg/a.py", "A = 1\n")
    _write(root, "src/pkg/deep/c.py", "C = 3\n")
    _write(root, "keep.py", "K = 0\n")
    await _index(root)
    (root / "src").rename(root / "lib")  # 整枝一次搬:src → lib(含 pkg/deep 两层后代)
    result = await _index(root)
    assert result.dirs_moved == [{"newPath": "lib", "oldPath": "src"}], (
        "整枝搬家只报最浅一枝(src→lib);lib/pkg、lib/pkg/deep 是它的后代,不再重复计"
    )
    assert result.dir_rhash_note is not None and "整枝搬家 1" in result.dir_rhash_note


@pytest.mark.asyncio
async def test_round2_no_change_reports_unchanged_and_no_moves(tmp_path):
    root = tmp_path / "repo"
    _write(root, "src/a.py", "A = 1\n")
    await _index(root)
    result = await _index(root)
    assert result.dirs_moved == []
    assert result.dir_rhash_note is not None and "未变" in result.dir_rhash_note


@pytest.mark.asyncio
async def test_snapshot_without_dir_layer_reports_dimension_absent(tmp_path):
    """上一轮档没有这一维 ⇒ 响应明说,不冒充"判过且干净"。"""
    root = tmp_path / "repo"
    _write(root, "src/a.py", "A = 1\n")
    await _index(root)
    # 模拟"dirRhashes 出现之前"的中间档:同 schemaVersion、缺这一枚键
    payload = _snapshot_payload()
    snaps = list(ci._MERKLE_SNAPSHOT_DIR.glob("repo-1-*.merkle.json"))
    snaps[0].write_text(
        json.dumps({k: v for k, v in payload.items() if k != "dirRhashes"}, ensure_ascii=False),
        encoding="utf-8",
    )
    result = await _index(root)
    assert result.dirs_moved == [], "没有前像就不许报搬家(没判 ≠ 判过且干净)"
    assert result.dir_rhash_note is not None and "没有目录前像" in result.dir_rhash_note


@pytest.mark.asyncio
async def test_corrupt_snapshot_skips_dir_diff_entirely(tmp_path):
    """档自证失败 ⇒ 目录差分这一维宁可报"没做",不拿垃圾读数。"""
    root = tmp_path / "repo"
    _write(root, "src/a.py", "A = 1\n")
    await _index(root)
    payload = _snapshot_payload()
    payload["merkleRoot"] = "0" * 64  # 与 files 重算值必不符 ⇒ truncated
    snaps = list(ci._MERKLE_SNAPSHOT_DIR.glob("repo-1-*.merkle.json"))
    snaps[0].write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    result = await _index(root)
    assert result.snapshot_state == "truncated"
    assert result.dir_rhash_note is None, "坏档不得产出目录差分读数"
    assert result.dirs_moved == []


@pytest.mark.asyncio
async def test_dir_rhash_note_absent_on_non_incremental_round(tmp_path):
    """非增量轮(force 全量)不做目录差分:snapshot_state=skipped 就是这句话的出处。"""
    root = tmp_path / "repo"
    _write(root, "src/a.py", "A = 1\n")
    idx = CodebaseIndexer.__new__(CodebaseIndexer)
    idx._tree_sitter_available = False
    idx._api_base_url = "http://localhost:8801"
    with (
        patch.object(idx, "_generate_embeddings_batch", new=AsyncMock(return_value=0)),
        patch.object(idx, "_write_to_api", new=AsyncMock(return_value={})),
        patch.object(idx, "_delete_files_from_api", new=AsyncMock(return_value=0)),
    ):
        result = await idx.index_repository(str(root), "repo-1", incremental=False)
    assert result.snapshot_state == "skipped"
    assert result.dir_rhash_note is None
    assert result.dirs_moved == []
