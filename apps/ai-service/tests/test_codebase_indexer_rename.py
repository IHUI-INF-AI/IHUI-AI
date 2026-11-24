# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""改名检测的接线钉(P85,`codebase_indexer` 快照差集一侧)。

纯函数层的判据在 `tests/test_rename_detect.py`;这里钉的是**接线后果**:
精确改名之后 ①不重嵌入、②不清旧切片、③快照记住"行还在源路径下",
以及 ④删除 + 无关新增**不得**被读成改名。这三条任何一条错了,索引要么白烧 embedding,
要么把文件从检索面静默抹掉。
"""

from __future__ import annotations

import gzip
import json
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from app.services import codebase_indexer as ci
from app.services.codebase_indexer import CodebaseIndexer

BODY = "\n".join(
    f"def handler_{i}(req):\n"
    f"    value = req.get('k{i}')\n"
    f"    return {{'id': {i}, 'value': value}}\n"
    for i in range(30)
)


@pytest.fixture(autouse=True)
def _snap_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(ci, "_MERKLE_SNAPSHOT_DIR", tmp_path / "snaps")


class _Round:
    """一轮索引的全部现场:结果 + 真被写进去的切片 + 真被删掉的路径。"""

    def __init__(self) -> None:
        self.written: list = []
        self.deleted: list[str] = []
        self.result = None

    @property
    def written_paths(self) -> set[str]:
        return {c.file_path for c in self.written}


async def _index(root: Path, repo_id: str = "repo-1", *, incremental: bool = True) -> _Round:
    idx = CodebaseIndexer.__new__(CodebaseIndexer)
    idx._tree_sitter_available = False
    idx._api_base_url = "http://localhost:8801"
    round_ = _Round()

    async def fake_write(_repo_id, chunks, token=None, internal_user_id=None):
        round_.written.extend(chunks)
        return {}

    async def fake_delete(_repo_id, paths, token=None, internal_user_id=None):
        round_.deleted.extend(paths)
        return len(paths)

    with (
        patch.object(idx, "_generate_embeddings_batch", new=AsyncMock(return_value=0)),
        patch.object(idx, "_write_to_api", new=fake_write),
        patch.object(idx, "_delete_files_from_api", new=fake_delete),
    ):
        round_.result = await idx.index_repository(str(root), repo_id, incremental=incremental)
    return round_


def _snapshot_blob(root: Path, repo_id: str = "repo-1") -> dict:
    idx = CodebaseIndexer.__new__(CodebaseIndexer)
    raw = idx._snapshot_path(repo_id, root).read_bytes()
    # 快照默认 gzip 落盘(T12 缺口表 #8,3b3e9542a4):读侧与生产用**同一把**魔数尺子,
    # 不另写一份判据 —— 否则本文件的四条接线钉会在压缩档上全部失真(实测 4 红)。
    if ci._is_gzip_compressed(raw):
        raw = gzip.decompress(raw)
    return json.loads(raw.decode("utf-8"))


def _write(root: Path, rel: str, body: str) -> Path:
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body, encoding="utf-8")
    return path


@pytest.mark.asyncio
async def test_exact_rename_is_not_reembedded_and_not_deleted(tmp_path):
    root = tmp_path / "repo"
    _write(root, "src/old.py", BODY)
    first = await _index(root)
    assert "src/old.py" in first.written_paths

    (root / "src/old.py").rename(root / "src/new.py")
    second = await _index(root)

    assert second.result.files_renamed == 1
    assert second.written_paths == set(), "同 content-hash 的改名不得重新切片/嵌入"
    assert second.deleted == [], "源路径的切片还活着(行仍留在它下面),不许清"
    assert [c["newPath"] for c in second.result.rename_candidates] == ["src/new.py"]
    assert second.result.rename_candidates[0]["basis"] == "content-hash"
    assert _snapshot_blob(root)["aliases"] == {"src/new.py": "src/old.py"}


@pytest.mark.asyncio
async def test_rename_only_skips_that_file_while_real_new_content_still_indexes(tmp_path):
    root = tmp_path / "repo"
    _write(root, "src/old.py", BODY)
    await _index(root)

    (root / "src/old.py").rename(root / "src/new.py")
    _write(root, "src/brand_new.py", "def brand_new():\n    return 42\n")
    second = await _index(root)

    assert second.result.files_renamed == 1
    assert second.written_paths == {"src/brand_new.py"}, "改名的跳过嵌入,真新增的照旧嵌入"
    assert second.deleted == []


@pytest.mark.asyncio
async def test_editing_a_renamed_file_moves_the_rows_to_the_real_path(tmp_path):
    """改名后又被编辑 ⇒ 按真实路径重嵌入,并把留在源路径下的旧行清掉(不许两份并存)。"""
    root = tmp_path / "repo"
    _write(root, "src/old.py", BODY)
    await _index(root)
    (root / "src/old.py").rename(root / "src/new.py")
    await _index(root)

    _write(root, "src/new.py", BODY + "\n# edited after the rename\n")
    third = await _index(root)

    assert third.written_paths == {"src/new.py"}, "内容变过就必须重嵌入真实路径"
    assert third.deleted == ["src/old.py"], "源路径那批旧行必须清掉,否则同一份内容在索引里有两份"
    assert _snapshot_blob(root)["aliases"] == {}, "别名用完即摘,不许留在快照里"


@pytest.mark.asyncio
async def test_delete_plus_unrelated_add_is_not_read_as_rename(tmp_path):
    root = tmp_path / "repo"
    _write(root, "src/del.py", "def doomed():\n    return 1\n")
    await _index(root)

    (root / "src/del.py").unlink()
    _write(root, "src/added.py", "class TotallyDifferent:\n    x = [i for i in range(9)]\n")
    second = await _index(root)

    assert second.result.files_renamed == 0, "删 + 无关增不得被当成改名(否则旧切片不清、新切片不建)"
    assert second.deleted == ["src/del.py"]
    assert second.written_paths == {"src/added.py"}
    assert _snapshot_blob(root)["aliases"] == {}


@pytest.mark.asyncio
async def test_rename_chain_resolves_to_the_row_holder(tmp_path):
    """A→B→C 的连续改名:别名链条必须归位到真正持有切片行的那一枚(A)。"""
    root = tmp_path / "repo"
    _write(root, "a.py", BODY)
    await _index(root)
    (root / "a.py").rename(root / "b.py")
    await _index(root)
    (root / "b.py").rename(root / "c.py")
    third = await _index(root)

    assert third.result.files_renamed == 1
    assert third.deleted == [], "链条中段的 B 从没持有过行,清它等于清空这枚文件"
    aliases = _snapshot_blob(root)["aliases"]
    assert aliases == {"c.py": "a.py"}, f"别名必须归位到行居所,现读 {aliases}"
    assert third.written_paths == set()


def test_alias_resolution_stops_on_cycles():
    """坏档自指(A→B→A)不得把归位函数拖进死循环。"""
    assert ci._resolve_alias_source("x", {"x": "y", "y": "x"}) in {"x", "y"}
    assert ci._resolve_alias_source("a", {"b": "c"}) == "a"
    assert ci._resolve_alias_source("b", {"b": "c", "c": "d"}) == "d"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
