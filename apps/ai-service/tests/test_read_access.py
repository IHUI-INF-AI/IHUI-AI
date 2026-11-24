# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""`.cursorignore` 访问面判据与 MCP 读写工具接线(2026-11-24)。"""

from __future__ import annotations

from pathlib import Path

import pytest

from app.services import mcp_server
from app.services.read_access import access_denied_for_resolved, check_access


def _write_rule(root: Path, text: str) -> None:
    (root / ".cursorignore").write_text(text, encoding="utf-8")


def test_check_access_matches_and_reports_source(tmp_path: Path) -> None:
    _write_rule(tmp_path, "secret/\n*.key\n")
    denied, rule, errors = check_access(tmp_path, "secret/a.py")
    assert denied is True
    assert rule is not None
    assert rule.where() == ".cursorignore:1"
    assert errors == []

    denied_key, key_rule, _ = check_access(tmp_path, "certs/private.key")
    assert denied_key is True
    assert key_rule is not None

    allowed, no_rule, _ = check_access(tmp_path, "src/main.py")
    assert allowed is False
    assert no_rule is None


def test_negation_is_last_match_wins(tmp_path: Path) -> None:
    _write_rule(tmp_path, "secret/*.py\n!secret/keep.py\n")
    assert check_access(tmp_path, "secret/drop.py")[0] is True
    assert check_access(tmp_path, "secret/keep.py")[0] is False


def test_unreadable_rule_file_fails_closed(tmp_path: Path) -> None:
    (tmp_path / ".cursorignore").mkdir()
    denied, rule, errors = check_access(tmp_path, "src/main.py")
    assert denied is True
    assert rule is None
    assert errors and "目录而非规则文件" in errors[0]
    denial = access_denied_for_resolved(tmp_path / "src" / "main.py", [str(tmp_path)])
    assert denial is not None
    assert denial.where == ".cursorignore:unreadable"


def test_rule_change_is_picked_up_without_stale_cache(tmp_path: Path) -> None:
    _write_rule(tmp_path, "a.py\n")
    assert check_access(tmp_path, "a.py")[0] is True
    _write_rule(tmp_path, "# longer replacement to change size\nb.py\n")
    assert check_access(tmp_path, "a.py")[0] is False
    assert check_access(tmp_path, "b.py")[0] is True


def test_resolved_path_finds_containing_root(tmp_path: Path) -> None:
    _write_rule(tmp_path, "secret.txt\n")
    target = tmp_path / "secret.txt"
    target.write_text("x", encoding="utf-8")
    denial = access_denied_for_resolved(target, [str(tmp_path)])
    assert denial is not None
    assert denial.rel == "secret.txt"
    assert denial.rule is not None


@pytest.mark.asyncio
async def test_read_file_is_denied_without_leaking_content(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _write_rule(tmp_path, "secret.txt\n")
    target = tmp_path / "secret.txt"
    target.write_text("TOP-SECRET", encoding="utf-8")
    monkeypatch.setattr(mcp_server, "_get_workspace_roots", lambda: [str(tmp_path)])
    monkeypatch.setattr(mcp_server, "_active_extra_roots", lambda: ())
    result = await mcp_server._tool_read_file({"path": str(target)})
    assert result["ok"] is False
    assert result["errorCode"] == "CURSORIGNORE_DENIED"
    assert result["content"] == ""
    assert "TOP-SECRET" not in str(result)


@pytest.mark.asyncio
async def test_write_file_is_denied_before_touching_disk(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _write_rule(tmp_path, "secret.txt\n")
    target = tmp_path / "secret.txt"
    monkeypatch.setattr(mcp_server, "_get_workspace_roots", lambda: [str(tmp_path)])
    monkeypatch.setattr(mcp_server, "_active_extra_roots", lambda: ())
    result = await mcp_server._tool_write_file({"path": str(target), "content": "new"})
    assert result["ok"] is False
    assert result["errorCode"] == "CURSORIGNORE_DENIED"
    assert not target.exists()


@pytest.mark.asyncio
async def test_apply_patch_set_rejects_ignored_path(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from uuid import uuid4

    from app.services.agent_security_prefs import security_principal_scope

    _write_rule(tmp_path, "secret.txt\n")
    with security_principal_scope(str(uuid4())):
        result = await mcp_server._tool_apply_patch_set(
            {"path": str(tmp_path), "patches": [{"path": "secret.txt", "content": "new"}]}
        )
    assert result["status"] == "rejected"
    assert result["errorCode"] == "CURSORIGNORE_DENIED"
    assert not (tmp_path / "secret.txt").exists()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
