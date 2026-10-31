# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""connector_store: app_secret 加密不可用必须 fail-closed(绝不落明文)。

R11 收口的 P1 修复:此前加密失败时降级明文落盘,现改为拒绝持久化。
"""
from __future__ import annotations

import app.services.connector_store as cs


def test_encrypt_secret_fail_closed(monkeypatch):
    """加密异常时 _encrypt_secret 必须抛 SecretCryptoUnavailable,而非返回明文。"""
    import app.services.publish.credentials_crypto as cc

    def boom(*_a, **_k):
        raise RuntimeError("kms unavailable")

    monkeypatch.setattr(cc, "encrypt", boom)
    with __import__("pytest").raises(cs.SecretCryptoUnavailable):
        cs._encrypt_secret("super-secret")


def test_save_fail_closed_when_crypto_unavailable(monkeypatch, tmp_path):
    """加密不可用时 save 必须返回 None(不落明文),而非静默存明文。"""
    import pytest

    import app.services.publish.credentials_crypto as cc

    def boom(*_a, **_k):
        raise RuntimeError("kms unavailable")

    monkeypatch.setattr(cc, "encrypt", boom)
    monkeypatch.setattr(cs, "_STORE_PATH", tmp_path / "connector_store.json")

    rec = {
        "key": "yuque:docs",
        "type": "yuque",
        "name": "语雀",
        "app_id": "id",
        "app_secret": "super-secret",
        "extra": {},
        "enabled": True,
    }
    result = cs.save("user-1", rec)
    assert result is None
    # 文件不应以明文写入(要么没写,要么加密形态)
    store_file = tmp_path / "connector_store.json"
    if store_file.exists():
        content = store_file.read_text(encoding="utf-8")
        assert "super-secret" not in content
