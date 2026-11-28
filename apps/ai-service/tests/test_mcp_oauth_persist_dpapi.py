# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""L09 消费侧回归:MCP OAuth 检查点由 DPAPI 封装、失败不回落明文、退出清内存。"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

from app.services import mcp_oauth
from app.services.mcp_oauth import (
    MCPOAuthClient,
    MCPOAuthConfig,
    MCPOAuthToken,
    OAuthPersistUnread,
    _load_persisted_token,
    _persist_token,
)
from app.services.mcp_oauth_dpapi import DPAPI_PREFIX

pytestmark = pytest.mark.skipif(sys.platform != "win32", reason="DPAPI 仅在 Windows 可用")


def _config(tmp_path: Path) -> MCPOAuthConfig:
    return MCPOAuthConfig(client_id="c", persist_path=str(tmp_path / "mcp-oauth.json"))


def _token(value: str = "secret-access-token") -> MCPOAuthToken:
    return MCPOAuthToken(access_token=value, refresh_token="secret-refresh-token", expires_in=3600)


def test_dpapi_roundtrip_and_no_plaintext_on_disk(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("MCP_OAUTH_PROTECT", raising=False)
    monkeypatch.delenv("MCP_OAUTH_ENCRYPTION_KEY", raising=False)
    config = _config(tmp_path)

    _persist_token(config, _token())

    raw = Path(config.persist_path).read_text(encoding="utf-8")
    assert raw.startswith(DPAPI_PREFIX)
    assert "secret-access-token" not in raw
    assert "secret-refresh-token" not in raw
    restored = _load_persisted_token(config)
    assert restored is not None
    assert restored.access_token == "secret-access-token"
    assert restored.refresh_token == "secret-refresh-token"


def test_protect_failure_keeps_last_good_checkpoint(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("MCP_OAUTH_PROTECT", raising=False)
    config = _config(tmp_path)
    _persist_token(config, _token("good-token"))

    def boom(_data: bytes) -> str:
        raise OSError("dpapi down")

    monkeypatch.setattr(mcp_oauth, "dpapi_encode", boom)
    _persist_token(config, _token("new-token"))

    # 写失败绝不退回明文,也不覆盖上一份可恢复的检查点。
    restored = _load_persisted_token(config)
    assert restored is not None
    assert restored.access_token == "good-token"
    assert "new-token" not in Path(config.persist_path).read_text(encoding="utf-8")


def test_foreign_dpapi_file_is_unread_not_empty(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    config = _config(tmp_path)
    _persist_token(config, _token())
    path = Path(config.persist_path)
    before = path.read_text(encoding="utf-8")

    monkeypatch.setattr(mcp_oauth, "dpapi_available", lambda: False)
    with pytest.raises(OAuthPersistUnread):
        _load_persisted_token(config)
    assert path.read_text(encoding="utf-8") == before
    assert not list(path.parent.glob("*.corrupt-*"))


def test_corrupt_ciphertext_backs_up_then_degrades(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("MCP_OAUTH_PROTECT", raising=False)
    config = _config(tmp_path)
    path = Path(config.persist_path)
    path.write_text(DPAPI_PREFIX + "not-a-valid-cipher", encoding="utf-8")

    assert _load_persisted_token(config) is None
    backups = list(path.parent.glob("mcp-oauth.json.corrupt-*"))
    assert backups, "内容损坏必须先备份留证,不能静默覆盖"


def test_clear_memory_copy_removes_process_copy() -> None:
    client = MCPOAuthClient(MCPOAuthConfig(client_id="c"))
    client._token = _token()
    client._authorization_code = "one-shot-code"
    client._code_verifier = "verifier"

    client.clear_memory_copy()

    assert client._token is None
    assert client._authorization_code is None
    assert client._code_verifier is None
