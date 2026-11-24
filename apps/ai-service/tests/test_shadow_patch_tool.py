# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""apply_patch_set MCP 工具判据(2026-11-24,shadow workspace 的消费面)。"""

from __future__ import annotations

from pathlib import Path
from uuid import uuid4

import pytest

from app.services.agent_security_prefs import security_principal_scope
from app.services.mcp_server import _ADMIN_ONLY_TOOLS, _TOOL_HANDLERS, _TOOLS, _tool_apply_patch_set


def test_registered_and_admin_only() -> None:
    names = {tool.name for tool in _TOOLS}
    assert "apply_patch_set" in names
    assert "apply_patch_set" in _TOOL_HANDLERS
    assert "apply_patch_set" in _ADMIN_ONLY_TOOLS
    schema = next(tool.input_schema for tool in _TOOLS if tool.name == "apply_patch_set")
    assert schema["required"] == ["path", "patches"]
    assert schema["properties"]["patches"]["maxItems"] == 64


@pytest.mark.asyncio
async def test_requires_principal(tmp_path: Path) -> None:
    result = await _tool_apply_patch_set(
        {"path": str(tmp_path), "patches": [{"path": "a.py", "content": "x = 1\n"}]}
    )
    assert result["ok"] is False
    assert result["error"] == "principal_required"
    assert not (tmp_path / "a.py").exists()


@pytest.mark.asyncio
async def test_applies_through_the_tool(tmp_path: Path) -> None:
    with security_principal_scope(str(uuid4())):
        result = await _tool_apply_patch_set(
            {
                "path": str(tmp_path),
                "patches": [
                    {"path": "a.py", "content": "x = 1\n"},
                    {"path": "b/c.json", "content": '{"ok": 1}\n'},
                ],
            }
        )
    assert result["status"] == "applied"
    assert (tmp_path / "a.py").read_text(encoding="utf-8") == "x = 1\n"
    assert (tmp_path / "b" / "c.json").exists()


@pytest.mark.asyncio
async def test_dry_run_and_validate_false(tmp_path: Path) -> None:
    with security_principal_scope(str(uuid4())):
        dry = await _tool_apply_patch_set(
            {"path": str(tmp_path), "patches": [{"path": "a.py", "content": "x = 1\n"}], "dryRun": True}
        )
        unchecked = await _tool_apply_patch_set(
            {
                "path": str(tmp_path),
                "patches": [{"path": "bad.py", "content": "def broken(:\n"}],
                "validate": False,
            }
        )
    assert dry["status"] == "validated"
    assert not (tmp_path / "a.py").exists()
    assert unchecked["status"] == "applied"
    assert (tmp_path / "bad.py").exists()


@pytest.mark.asyncio
async def test_bad_arguments_are_rejected(tmp_path: Path) -> None:
    with security_principal_scope(str(uuid4())):
        missing = await _tool_apply_patch_set({"path": str(tmp_path), "patches": "not-a-list"})
        no_workspace = await _tool_apply_patch_set({"patches": []})
    assert missing["errorCode"] == "invalid_patches"
    assert no_workspace["errorCode"] == "workspace_missing"


@pytest.mark.asyncio
async def test_language_server_error_blocks_before_real_write(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_diagnostics(_arguments: dict[str, object]) -> dict[str, object]:
        return {
            "ok": True,
            "diagnostics": [
                {"severity": "Error", "line": 1, "column": 1, "source": "pyright", "message": "type error"}
            ],
        }

    import app.services.mcp_server as mcp_server

    monkeypatch.setattr(mcp_server, "_tool_get_diagnostics", fake_diagnostics)
    with security_principal_scope(str(uuid4())):
        result = await _tool_apply_patch_set(
            {"path": str(tmp_path), "patches": [{"path": "a.py", "content": "x: int = 'bad'\n"}]}
        )
    assert result["status"] == "validation_failed"
    assert result["validation"]["engine"] == "lsp+builtin"
    assert result["validation"]["languageServer"]["files"] == 1
    assert not (tmp_path / "a.py").exists()


@pytest.mark.asyncio
async def test_language_server_unavailable_falls_back_to_builtin(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_diagnostics(_arguments: dict[str, object]) -> dict[str, object]:
        return {"ok": False, "errorCode": "LSP_UNAVAILABLE"}

    import app.services.mcp_server as mcp_server

    monkeypatch.setattr(mcp_server, "_tool_get_diagnostics", fake_diagnostics)
    with security_principal_scope(str(uuid4())):
        result = await _tool_apply_patch_set(
            {"path": str(tmp_path), "patches": [{"path": "a.py", "content": "x = 1\n"}]}
        )
    assert result["status"] == "applied"
    assert result["validation"]["engine"] == "builtin"
    assert result["validation"]["languageServer"]["unavailable"] is True
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
