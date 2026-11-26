# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""L09 跨平台落盘策略:默认拒绝明文;显式 plaintext 仅作开发出口;旧明文可读。"""

from __future__ import annotations

from pathlib import Path

import pytest

from app.services import mcp_oauth
from app.services.mcp_oauth import (
    MCPOAuthConfig,
    MCPOAuthToken,
    _load_persisted_token,
    _persist_token,
)


def _config(tmp_path: Path) -> MCPOAuthConfig:
    return MCPOAuthConfig(client_id="c", persist_path=str(tmp_path / "mcp-oauth.json"))


def _token() -> MCPOAuthToken:
    return MCPOAuthToken(access_token="secret-access-token", refresh_token="secret-refresh-token")


def test_default_refuses_plaintext_when_no_protector(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("MCP_OAUTH_PROTECT", raising=False)
    monkeypatch.delenv("MCP_OAUTH_ENCRYPTION_KEY", raising=False)
    monkeypatch.setattr(mcp_oauth, "dpapi_available", lambda: False)
    config = _config(tmp_path)

    _persist_token(config, _token())

    # 宁可不落盘,也不写明文。
    assert not Path(config.persist_path).exists()


def test_explicit_plaintext_is_dev_only_opt_in(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("MCP_OAUTH_PROTECT", "plaintext")
    monkeypatch.delenv("MCP_OAUTH_ENCRYPTION_KEY", raising=False)
    config = _config(tmp_path)

    _persist_token(config, _token())

    raw = Path(config.persist_path).read_text(encoding="utf-8")
    assert "secret-access-token" in raw
    restored = _load_persisted_token(config)
    assert restored is not None
    assert restored.access_token == "secret-access-token"


def test_legacy_plaintext_file_remains_readable(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("MCP_OAUTH_PROTECT", raising=False)
    monkeypatch.delenv("MCP_OAUTH_ENCRYPTION_KEY", raising=False)
    config = _config(tmp_path)
    Path(config.persist_path).write_text(
        '{"access_token":"legacy-token","refresh_token":"legacy-refresh"}',
        encoding="utf-8",
    )

    restored = _load_persisted_token(config)
    assert restored is not None
    assert restored.access_token == "legacy-token"
