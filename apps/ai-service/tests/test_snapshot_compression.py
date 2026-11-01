# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""T12 缺口表 #8:索引快照压缩落盘(gzip)的接线钉,2026-11-01。

钉死的行为:
1. 压缩写 → 读回一致(roundtrip):gzip 只包 IO,payload 结构与自证判据一字不动;
2. 旧明文兼容:手写明文 JSON → 读侧魔数自识别不命中 → 走原路径照常 ok,不迁移不报错;
3. 截断/坏 gzip → 判 CORRUPT 且 detail 写明原委,绝不 crash、绝不静默当"无快照"(§0.3);
4. env `IHUI_SNAPSHOT_COMPRESS` 关 ⇒ 写明文,读侧仍双形态都认;
5. env 非法值 ⇒ 出声回落默认(压缩开),不许安静吃掉。

参考:Qoder 原生层 encode_zstd/decode_zstd/is_zstd_compressed(对侧 §5 表第 8 行);
本仓超越点 = 魔数自识别 + 截断判坏档出原委 + 应急出口 env 有单测。
"""

from __future__ import annotations

import gzip
import json
import logging
from pathlib import Path

import pytest

from app.services import codebase_indexer as ci
from app.services.codebase_indexer import CodebaseIndexer

# ---------------------------------------------------------------- 夹具与素材

_SNAPS = "snaps"


@pytest.fixture(autouse=True)
def _snap_dir(tmp_path, monkeypatch):
    """快照目录钉到临时盘(与 test_codebase_indexer_ignore.py 同款)。"""
    monkeypatch.setattr(ci, "_MERKLE_SNAPSHOT_DIR", tmp_path / _SNAPS)


@pytest.fixture(autouse=True)
def _compress_env_clean(monkeypatch):
    """每条用例默认 env 缺省(压缩开);要测开关的用例自己 setenv,互不串味。"""
    monkeypatch.delenv(ci.SNAPSHOT_COMPRESS_ENV, raising=False)


def _indexer() -> CodebaseIndexer:
    return CodebaseIndexer.__new__(CodebaseIndexer)


_FILES = {"a.py": "h-a", "b.py": "h-b", "sub/c.py": "h-c"}
_FP = {"a.py": "f" * 16}
_ALIAS = {"b.py": "a.py"}
_DIRS = {"sub": "d" * 64}


def _save(idx: CodebaseIndexer, root: Path, **kwargs: object) -> Path:
    idx._save_snapshot("repo-1", root, dict(_FILES), **kwargs)  # type: ignore[arg-type]
    return idx._snapshot_path("repo-1", root)


# ---------------------------------------------------------------- 用例


def test_roundtrip_compressed_write_reads_back_identical(tmp_path):
    """压缩写 → 读回一致:三枚附加表 + files 全数归位,档头是 gzip 魔数。"""
    idx = _indexer()
    path = _save(idx, tmp_path, fingerprints=_FP, aliases=_ALIAS, dir_rhashes=_DIRS)

    blob = path.read_bytes()
    assert blob[:2] == b"\x1f\x8b", "压缩开启时落盘必须是 gzip 形态"

    payload = json.loads(gzip.decompress(blob).decode("utf-8"))
    assert payload["files"] == _FILES
    assert payload["fileCount"] == len(_FILES)
    assert payload["merkleRoot"] == ci._merkle_root(_FILES)
    assert payload["schemaVersion"] == ci.SNAPSHOT_SCHEMA_VERSION

    read = idx._load_snapshot_read("repo-1", tmp_path)
    assert read.state == ci.SNAPSHOT_STATE_OK
    assert read.files == _FILES
    assert read.fingerprints == _FP
    assert read.aliases == _ALIAS
    assert read.dir_rhashes == _DIRS
    assert read.detail is None


def test_legacy_plaintext_snapshot_still_readable(tmp_path):
    """旧明文兼容:手写明文 JSON(不经压缩层)→ 读回 ok,不迁移不报错。"""
    payload = {
        "schemaVersion": ci.SNAPSHOT_SCHEMA_VERSION,
        "merkleRoot": ci._merkle_root(_FILES),
        "fileCount": len(_FILES),
        "files": _FILES,
        "simhashes": _FP,
        "aliases": _ALIAS,
        "dirRhashes": _DIRS,
    }
    idx = _indexer()
    path = idx._snapshot_path("repo-1", tmp_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")

    read = idx._load_snapshot_read("repo-1", tmp_path)
    assert read.state == ci.SNAPSHOT_STATE_OK
    assert read.files == _FILES
    assert read.fingerprints == _FP
    assert read.aliases == _ALIAS
    assert read.dir_rhashes == _DIRS


def test_truncated_gzip_judged_corrupt_with_detail(tmp_path):
    """截断 gzip → 判 CORRUPT 且 detail 点名 gzip 截断,绝不静默当"无快照"。"""
    idx = _indexer()
    path = _save(idx, tmp_path)
    blob = path.read_bytes()
    assert blob[:2] == b"\x1f\x8b"
    path.write_bytes(blob[:-8])  # 削掉尾部:CRC/ISIZE 一丢就是标准截断档

    read = idx._load_snapshot_read("repo-1", tmp_path)
    assert read.state == ci.SNAPSHOT_STATE_CORRUPT
    assert read.detail is not None
    assert "gzip" in read.detail
    assert "截断" in read.detail
    assert read.files == {}, "坏档不许把半截文件表当可用前像返回"


def test_magic_prefix_with_garbage_body_judged_corrupt(tmp_path):
    """魔数命中但身子是垃圾 → 同样判 CORRUPT 出原委,不许 crash 也不许当 ABSENT。"""
    idx = _indexer()
    path = idx._snapshot_path("repo-1", tmp_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"\x1f\x8b" + b"not-really-gzip")

    read = idx._load_snapshot_read("repo-1", tmp_path)
    assert read.state == ci.SNAPSHOT_STATE_CORRUPT
    assert read.detail is not None
    assert "gzip" in read.detail


def test_env_off_writes_plaintext_and_reads_back(tmp_path, monkeypatch):
    """应急出口:env 关 ⇒ 写明文;读侧魔数自识别不命中 ⇒ 走明文路径照常 ok。"""
    monkeypatch.setenv(ci.SNAPSHOT_COMPRESS_ENV, "0")
    idx = _indexer()
    path = _save(idx, tmp_path, dir_rhashes=_DIRS)

    blob = path.read_bytes()
    assert blob[:1] == b"{", "开关关闭时落盘必须是明文 JSON"
    assert json.loads(blob.decode("utf-8"))["files"] == _FILES

    read = idx._load_snapshot_read("repo-1", tmp_path)
    assert read.state == ci.SNAPSHOT_STATE_OK
    assert read.files == _FILES
    assert read.dir_rhashes == _DIRS

    # 双形态都认:同一份明文档,把开关摘掉(默认压缩开)再读,照样 ok。
    monkeypatch.delenv(ci.SNAPSHOT_COMPRESS_ENV)
    read_again = idx._load_snapshot_read("repo-1", tmp_path)
    assert read_again.state == ci.SNAPSHOT_STATE_OK
    assert read_again.files == _FILES


def test_env_off_values_cover_false_and_off_case_insensitive(monkeypatch):
    """env 取值解析单测:关词三枚大小写不敏感;开词与缺省 ⇒ 开。"""
    for off in ("0", "false", "off", "OFF", "False"):
        monkeypatch.setenv(ci.SNAPSHOT_COMPRESS_ENV, off)
        assert ci._snapshot_compress_enabled() is False, f"{off!r} 应判关"
    for on in ("1", "true", "on", "ON"):
        monkeypatch.setenv(ci.SNAPSHOT_COMPRESS_ENV, on)
        assert ci._snapshot_compress_enabled() is True, f"{on!r} 应判开"
    monkeypatch.delenv(ci.SNAPSHOT_COMPRESS_ENV)
    assert ci._snapshot_compress_enabled() is True
    monkeypatch.setenv(ci.SNAPSHOT_COMPRESS_ENV, "   ")
    assert ci._snapshot_compress_enabled() is True


def test_env_illegal_value_falls_back_to_compress_on_with_warning(tmp_path, monkeypatch, caplog):
    """env 非法值 ⇒ 出声回落默认(压缩开):写出去的还是 gzip,且日志点名 env 与原值。"""
    monkeypatch.setenv(ci.SNAPSHOT_COMPRESS_ENV, "maybe")
    idx = _indexer()
    with caplog.at_level(logging.WARNING, logger="app.services.codebase_indexer"):
        path = _save(idx, tmp_path)

    assert path.read_bytes()[:2] == b"\x1f\x8b", "非法值必须回落默认(压缩开)"
    assert any(
        ci.SNAPSHOT_COMPRESS_ENV in rec.getMessage() and "maybe" in rec.getMessage()
        for rec in caplog.records
    ), "非法值必须出声点名,不许安静吃掉"


def test_nonexistent_snapshot_still_absent(tmp_path):
    """档位语义不变:文件不存在仍旧 ABSENT(读侧改造不许动这条)。"""
    idx = _indexer()
    read = idx._load_snapshot_read("repo-1", tmp_path)
    assert read.state == ci.SNAPSHOT_STATE_ABSENT
    assert read.detail is None
