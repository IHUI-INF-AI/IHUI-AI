# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Merkle 快照的自证档(2026-11-01,逆向对齐 T9「读到坏档不当没发生过」那一格)。

钉的是"坏档必须有自己的名字":旧口径把打不开/形态不合/尾部截断一律塌成空 dict,
于是端上读到的是"增量同步完成",而实际上 ①本轮白烧全量 embedding,
②`deleted_paths = prev - new` 的分母也变空 ⇒ **幽灵切片永不清理**。
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

import pytest

from app.services import codebase_indexer as ci


@pytest.fixture(autouse=True)
def _snap_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(ci, "_MERKLE_SNAPSHOT_DIR", tmp_path / "snaps")
    (tmp_path / "snaps").mkdir()
    yield


def _files() -> dict[str, str]:
    return {"a.ts": "hash-a", "b.ts": "hash-b", "c.ts": "hash-c"}


def _idx() -> ci.CodebaseIndexer:
    return ci.CodebaseIndexer()


def _write(path_key: str, blob: dict[str, object]) -> None:
    import pathlib

    idx = _idx()
    target = idx._snapshot_path("repo-x", pathlib.Path(path_key))
    target.write_text(json.dumps(blob, ensure_ascii=False), encoding="utf-8")
    return target


def _read(tmp_path) -> ci.SnapshotRead:
    return _idx()._load_snapshot_read("repo-x", tmp_path)


def test_roundtrip_v2_is_ok_and_carries_the_files(tmp_path):
    idx = _idx()
    idx._save_snapshot("repo-x", tmp_path, _files())
    out = idx._load_snapshot_read("repo-x", tmp_path)
    assert out.state == ci.SNAPSHOT_STATE_OK
    assert out.files == _files()
    assert out.detail is None


def test_saved_blob_is_self_describing(tmp_path):
    idx = _idx()
    idx._save_snapshot("repo-x", tmp_path, _files())
    raw = json.loads(idx._snapshot_path("repo-x", tmp_path).read_text(encoding="utf-8"))
    assert raw["schemaVersion"] == ci.SNAPSHOT_SCHEMA_VERSION
    assert raw["fileCount"] == 3, "条数必须自己声明,否则读侧无从判截断"
    assert raw["merkleRoot"] == ci._merkle_root(_files())


def test_missing_snapshot_is_absent_not_corrupt(tmp_path):
    out = _idx()._load_snapshot_read("repo-x", tmp_path)
    assert out.state == ci.SNAPSHOT_STATE_ABSENT
    assert out.files == {}


def test_legacy_v1_blob_is_named_legacy_and_still_usable(tmp_path):
    # 旧档只有 merkleRoot + files,没有任何自证凭据 ⇒ 内容可用,但不得冒充 ok。
    _idx()._snapshot_path("repo-x", tmp_path).write_text(
        json.dumps({"merkleRoot": ci._merkle_root(_files()), "files": _files()}), encoding="utf-8"
    )
    out = _idx()._load_snapshot_read("repo-x", tmp_path)
    assert out.state == ci.SNAPSHOT_STATE_LEGACY
    assert out.files == _files()
    assert out.detail is not None and "无法自证" in out.detail


def test_count_mismatch_is_truncated_not_silently_accepted(tmp_path):
    idx = _idx()
    idx._save_snapshot("repo-x", tmp_path, _files())
    path = idx._snapshot_path("repo-x", tmp_path)
    blob = json.loads(path.read_text(encoding="utf-8"))
    blob["files"].pop("c.ts")  # 条数与声明不符,merkle 也一起漂 ⇒ 两把尺都得拦得住
    path.write_text(json.dumps(blob), encoding="utf-8")
    out = idx._load_snapshot_read("repo-x", tmp_path)
    assert out.state == ci.SNAPSHOT_STATE_TRUNCATED
    assert out.files == {}, "自证失败的档不得被当成上一轮的真相拿去算删除集"


def test_content_edit_with_matching_count_is_caught_by_recomputed_root(tmp_path):
    idx = _idx()
    idx._save_snapshot("repo-x", tmp_path, _files())
    path = idx._snapshot_path("repo-x", tmp_path)
    blob = json.loads(path.read_text(encoding="utf-8"))
    blob["files"]["a.ts"] = "tampered"  # 条数没变,只有内容漂了
    path.write_text(json.dumps(blob), encoding="utf-8")
    out = idx._load_snapshot_read("repo-x", tmp_path)
    assert out.state == ci.SNAPSHOT_STATE_TRUNCATED
    assert "merkleRoot" in str(out.detail)


def test_unparseable_blob_is_corrupt(tmp_path):
    idx = _idx()
    idx._save_snapshot("repo-x", tmp_path, _files())
    path = idx._snapshot_path("repo-x", tmp_path)
    tail = path.read_text(encoding="utf-8")[:-18]
    path.write_text(tail, encoding="utf-8")  # 真截尾:JSON 直接不成形
    out = idx._load_snapshot_read("repo-x", tmp_path)
    assert out.state == ci.SNAPSHOT_STATE_CORRUPT


def test_unknown_schema_version_is_corrupt_not_guessed(tmp_path):
    idx = _idx()
    idx._save_snapshot("repo-x", tmp_path, _files())
    path = idx._snapshot_path("repo-x", tmp_path)
    blob = json.loads(path.read_text(encoding="utf-8"))
    blob["schemaVersion"] = 99
    path.write_text(json.dumps(blob), encoding="utf-8")
    out = idx._load_snapshot_read("repo-x", tmp_path)
    assert out.state == ci.SNAPSHOT_STATE_CORRUPT


def test_state_enum_is_single_source_and_rejects_unknown(tmp_path):
    assert ci.SNAPSHOT_STATES == (
        ci.SNAPSHOT_STATE_OK,
        ci.SNAPSHOT_STATE_LEGACY,
        ci.SNAPSHOT_STATE_ABSENT,
        ci.SNAPSHOT_STATE_CORRUPT,
        ci.SNAPSHOT_STATE_TRUNCATED,
        ci.SNAPSHOT_STATE_SKIPPED,
    )
    with pytest.raises(ValueError):
        ci.SnapshotRead({}, "fine-i-guess")


@pytest.mark.asyncio
async def test_index_repository_names_the_failed_self_proof_instead_of_cleaning_ghosts(tmp_path):
    (tmp_path / "keep.ts").write_text("export const a = 1\n", encoding="utf-8")
    idx = _idx()
    idx._save_snapshot("repo-x", tmp_path, {"keep.ts": "stale-hash", "gone.ts": "hash-gone"})
    path = idx._snapshot_path("repo-x", tmp_path)
    blob = json.loads(path.read_text(encoding="utf-8"))
    blob["fileCount"] = 99  # 自证失败
    path.write_text(json.dumps(blob), encoding="utf-8")

    with patch.object(idx, "_generate_embeddings_batch", new=AsyncMock(return_value=1)):
        with patch.object(idx, "_write_to_api", new=AsyncMock(return_value={})):
            with patch.object(idx, "_delete_files_from_api", new=AsyncMock(return_value=0)) as delmock:
                result = await idx.index_repository(str(tmp_path), "repo-x", incremental=True)

    assert result.snapshot_state == ci.SNAPSHOT_STATE_TRUNCATED
    assert result.files_deleted == 0
    assert delmock.await_count == 0, "拿一份自证失败的档去删活文件的切片,是本票要根治的那一型"
    assert any("自证失败" in e for e in result.errors), "坏档必须在响应上出声,不只住日志"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
