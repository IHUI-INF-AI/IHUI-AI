# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""安全强化第 13 批(2026-10-31,R4 评估轮)修复钉住:连接器凭据落盘加密(H3)。

覆盖:
- save 后磁盘文件里 app_secret 为密文形态(``enc:v1:`` 前缀),不含明文
- get/list 读回是明文(round-trip,调用方行为与旧行为逐字节兼容)
- 存量明文记录(无前缀)读时原样返回 —— 渐进迁移不破坏旧数据
- 坏密文(密钥不匹配/损坏)解密失败 → 置空串,读面不崩
"""

from __future__ import annotations

import json
from pathlib import Path

from app.services import connector_store


def _store_at(monkeypatch, tmp_path: Path) -> Path:
    p = tmp_path / "connector_store.json"
    monkeypatch.setattr(connector_store, "_STORE_PATH", p)
    return p


def _record(key: str = "feishu:k1", secret: str = "super-secret-value") -> dict:
    return {
        "key": key,
        "type": "feishu",
        "name": "n",
        "app_id": "cli_a",
        "app_secret": secret,
        "extra": {},
        "enabled": True,
        # 手写夹具也要带属主 —— 存储读面按 (owner_user_id, key) 复合身份匹配,
        # 没有属主的记录对任何主体都不可见(G-371 fail-closed 语义)
        connector_store.OWNER_FIELD: "u1",
    }


def test_save_persists_ciphertext_not_plaintext(monkeypatch, tmp_path):
    store = _store_at(monkeypatch, tmp_path)
    saved = connector_store.save("u1", _record())
    assert saved is not None
    raw = store.read_text(encoding="utf-8")
    assert "super-secret-value" not in raw
    assert connector_store._SECRET_CIPHER_PREFIX in raw


def test_get_roundtrip_returns_plaintext(monkeypatch, tmp_path):
    _store_at(monkeypatch, tmp_path)
    connector_store.save("u1", _record())
    got = connector_store.get("u1", "feishu:k1")
    assert got is not None
    assert got["app_secret"] == "super-secret-value"


def test_legacy_plaintext_still_readable(monkeypatch, tmp_path):
    """存量明文(无前缀)读时原样返回,渐进迁移不破坏旧数据。"""
    store = _store_at(monkeypatch, tmp_path)
    legacy = _record()
    store.write_text(json.dumps([legacy], ensure_ascii=False), encoding="utf-8")
    got = connector_store.get("u1", "feishu:k1")
    assert got is not None
    assert got["app_secret"] == "super-secret-value"


def test_corrupted_cipher_degrades_to_empty_not_crash(monkeypatch, tmp_path):
    """坏密文解密失败 → 置空串,读面不抛异常。"""
    store = _store_at(monkeypatch, tmp_path)
    rec = _record()
    rec["app_secret"] = connector_store._SECRET_CIPHER_PREFIX + "bm90LWEtY2lwaGVy"
    store.write_text(json.dumps([rec], ensure_ascii=False), encoding="utf-8")
    got = connector_store.get("u1", "feishu:k1")
    assert got is not None
    assert got["app_secret"] == ""


def test_list_owned_roundtrip(monkeypatch, tmp_path):
    _store_at(monkeypatch, tmp_path)
    connector_store.save("u1", _record(key="feishu:a"))
    connector_store.save("u1", _record(key="feishu:b", secret="another-secret"))
    items = connector_store.list_owned("u1")
    assert {i["app_secret"] for i in items} == {"super-secret-value", "another-secret"}
    raw = (_store_path_of(tmp_path)).read_text(encoding="utf-8")
    assert "another-secret" not in raw


def _store_path_of(tmp_path: Path) -> Path:
    return tmp_path / "connector_store.json"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
