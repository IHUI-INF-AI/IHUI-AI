# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""近同改名(`basis=simhash`)在 `codebase_indexer` 差集路径上的端到端接线钉(P85 补)。

既有用例各钉一半:`test_codebase_indexer_rename.py` 只钉精确档(同 content-hash)的四态,
`test_rename_detect.py` / `test_rename_detect_p85_criteria.py` 钉纯函数层。本档补中间那道缝:
**候选档接进索引链之后,到底还重不重嵌入、还删不删旧路径、三个透出字段长什么样**。

三格:
① 近同候选只改「删 + 增」的读法:旧路径照删、新路径照嵌(`files_renamed` 必须为 0,
   不得把候选冒充成"免重嵌入"的精确改名);
② 透出字段形态:`rename_candidates` 的逐键(basis / hamming)与 `rename_note` 在本档为 None;
③ 两条降级路径(`skipped-no-fingerprints` / `skipped-too-many`)走到本路径时的回执形态。

判据常量一律从 `app.services.rename_detect` 导入,不在本文件复制第二份。
"""

from __future__ import annotations

from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest

from app.services import codebase_indexer as ci
from app.services.codebase_indexer import CodebaseIndexer
from app.services.rename_detect import (
    NEAR_STAGE_SKIPPED_NO_FINGERPRINTS,
    NEAR_STAGE_SKIPPED_TOO_MANY,
    RENAME_BASIS_SIMHASH,
    RENAME_MAX_CANDIDATES_PER_SIDE,
    RENAME_MAX_HAMMING,
    compute_simhash,
    hamming_distance,
)

#: 夹具正文:内容长度要让 64 bit 指纹稳定,"加一行注释"才落在阈值内。
#: 指纹不稳时由用例内的夹具自检直接转红,不会把偶然产物当判据。
_BODY = "\n".join(
    f"def handler_{i}(req):\n"
    f"    value = req.get('k{i}')\n"
    f"    return {{'id': {i}, 'value': value}}\n"
    for i in range(30)
)
_EDITED = _BODY + "# renamed by the migration script\n"


@pytest.fixture(autouse=True)
def _snap_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(ci, "_MERKLE_SNAPSHOT_DIR", tmp_path / "snaps")


class _Round:
    """一轮索引的现场:结果 + 真被写进去的切片 + 真被删掉的路径。"""

    def __init__(self) -> None:
        self.written: list = []
        self.deleted: list[str] = []
        self.result = None

    @property
    def written_paths(self) -> set[str]:
        return {c.file_path for c in self.written}


async def _index(root: Path, repo_id: str = "repo-1") -> _Round:
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
        round_.result = await idx.index_repository(str(root), repo_id, incremental=True)
    return round_


def _write(root: Path, rel: str, body: str) -> Path:
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body, encoding="utf-8")
    return path


def _measured_distance() -> int:
    """夹具自检:真实文本的指纹距离必须落在候选档内(否则用例自己先红)。"""
    return hamming_distance(compute_simhash(_BODY), compute_simhash(_EDITED))


@pytest.mark.asyncio
async def test_near_rename_changes_only_the_bucket_reading_and_still_reembeds(tmp_path):
    """①+②:候选档照旧删旧嵌新,`files_renamed` 不得冒充精确改名的豁免。"""
    root = tmp_path / "repo"
    root.mkdir()
    measured = _measured_distance()
    assert measured <= RENAME_MAX_HAMMING, f"夹具自身须落在候选档内(实测 {measured})"

    _write(root, "src/old.py", _BODY)
    first = await _index(root)
    assert first.written_paths == {"src/old.py"}

    (root / "src/old.py").rename(root / "src/new.py")
    _write(root, "src/new.py", _EDITED)
    second = await _index(root)

    # ① 内容变过 ⇒ 新旧两条链路一步都不能省:旧切片照删,新内容照嵌。
    assert second.deleted == ["src/old.py"], "候选档只改读法,不许把旧切片留下来"
    assert second.written_paths == {"src/new.py"}, "候选档内容已变,不许谎称免重嵌入"
    assert second.result.files_renamed == 0, "`files_renamed` 只数精确档,候选不得混进去"

    # ② 透出字段形态:逐键、逐值类型都钉住。
    assert second.result.rename_candidates == [
        {
            "oldPath": "src/old.py",
            "newPath": "src/new.py",
            "basis": RENAME_BASIS_SIMHASH,
            "hamming": measured,
        }
    ]
    assert second.result.rename_note is None, "near_stage=done 不是降级,不该出降级回执"


@pytest.mark.asyncio
async def test_near_stage_without_fingerprints_degrades_to_exact_only_and_says_so(
    tmp_path, monkeypatch
):
    """③-a:当前轮产不出指纹 ⇒ 只判精确档,回执点名且差集照「删 + 增」处理。"""
    root = tmp_path / "repo"
    root.mkdir()
    _write(root, "src/old.py", _BODY)
    await _index(root)

    (root / "src/old.py").rename(root / "src/new.py")
    _write(root, "src/new.py", _EDITED)
    # 当前轮指纹缺失:上一轮快照里有旧指纹,新一侧拿不出来 ⇒ 近同档无从判起。
    monkeypatch.setattr(ci, "fingerprint_hex", lambda _value: None)
    second = await _index(root)

    assert second.deleted == ["src/old.py"]
    assert second.written_paths == {"src/new.py"}
    assert second.result.files_renamed == 0
    assert second.result.rename_candidates == [], "没做近同判定 ⇒ 不许报候选"
    note = second.result.rename_note or ""
    assert NEAR_STAGE_SKIPPED_NO_FINGERPRINTS in note, note
    assert "只判了精确改名" in note, note
    assert "删除 + 新增" in note, note


@pytest.mark.asyncio
async def test_near_stage_over_candidate_cap_degrades_and_says_so(tmp_path):
    """③-b:两侧候选规模超上限 ⇒ 跳过近同档并如实报,不许静默退回精确档。"""
    root = tmp_path / "repo"
    root.mkdir()
    old_rels = [f"src/old_{i:03d}.py" for i in range(RENAME_MAX_CANDIDATES_PER_SIDE + 1)]
    for i, rel in enumerate(old_rels):
        _write(root, rel, f"def old_{i}():\n    return {i}\n")
    await _index(root)

    for rel in old_rels:
        (root / rel).unlink()
    _write(root, "src/new_only.py", "def brand_new():\n    return 42\n")
    second = await _index(root)

    assert set(second.deleted) == set(old_rels), "超限只影响近同判定,删除面照常"
    assert second.written_paths == {"src/new_only.py"}, "新增面照常重嵌入"
    assert second.result.files_renamed == 0
    assert second.result.rename_candidates == []
    note = second.result.rename_note or ""
    assert NEAR_STAGE_SKIPPED_TOO_MANY in note, note
    assert "只判了精确改名" in note, note
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
