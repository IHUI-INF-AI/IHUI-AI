# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""read_project_rule MCP 工具判据(2026-11-24 第二档,Cursor Agent Requested 等价)。"""

from __future__ import annotations

from pathlib import Path

import pytest

from app.core.project_rules import select_rules
from app.services.mcp_server import (
    _TOOL_HANDLERS,
    _TOOLS,
    _tool_list_project_rules,
    _tool_read_project_rule,
)


def _rule_text(description: str, body: str) -> str:
    return f"---\ndescription: {description}\nalwaysApply: false\n---\n{body}\n"


@pytest.fixture(autouse=True)
def _no_user_rules(monkeypatch: pytest.MonkeyPatch) -> None:
    """默认关掉真实用户规则目录,保证名单确定;需要用户档的用例自行置 0。"""
    monkeypatch.setenv("IHUI_USER_RULES_DISABLE", "1")


def _write(root: Path, rel: str, text: str) -> Path:
    path = root / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return path


def test_tool_registered_both_sides() -> None:
    names = {tool.name for tool in _TOOLS}
    assert "read_project_rule" in names
    assert "read_project_rule" in _TOOL_HANDLERS
    schema = next(t.input_schema for t in _TOOLS if t.name == "read_project_rule")
    assert schema["required"] == ["locator"]


@pytest.mark.asyncio
async def test_reads_project_rule(tmp_path: Path) -> None:
    _write(tmp_path, ".ihui/rules/a.mdc", _rule_text("A 规则", "DO-A"))
    out = await _tool_read_project_rule({"path": str(tmp_path), "locator": ".ihui/rules/a.mdc"})
    assert out["ok"] is True
    assert out["body"] == "DO-A"
    assert out["scope"] == "project"
    assert out["description"] == "A 规则"


@pytest.mark.asyncio
async def test_missing_locator(tmp_path: Path) -> None:
    out = await _tool_read_project_rule({"path": str(tmp_path)})
    assert out["ok"] is False
    assert out["errorCode"] == "missing_argument"


@pytest.mark.asyncio
async def test_unknown_locator_code(tmp_path: Path) -> None:
    out = await _tool_read_project_rule({"path": str(tmp_path), "locator": "other/a.mdc"})
    assert out["ok"] is False
    assert out["errorCode"] == "unknown_locator"


@pytest.mark.asyncio
async def test_traversal_code(tmp_path: Path) -> None:
    out = await _tool_read_project_rule({"path": str(tmp_path), "locator": "../escape.mdc"})
    assert out["ok"] is False
    assert out["errorCode"] == "invalid_locator"


@pytest.mark.asyncio
async def test_workspace_missing() -> None:
    out = await _tool_read_project_rule({"path": "Z:/definitely-missing", "locator": "a.mdc"})
    assert out["ok"] is False
    assert out["errorCode"] == "workspace_missing"


@pytest.mark.asyncio
async def test_agent_requested_roundtrip(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    workspace = tmp_path / "repo"
    workspace.mkdir()
    user_dir = tmp_path / "home" / ".cursor" / "rules"
    user_dir.mkdir(parents=True)
    (user_dir / "req.mdc").write_text(_rule_text("请求式", "USER-BODY"), encoding="utf-8")
    monkeypatch.setenv("IHUI_USER_RULES_DISABLE", "0")
    monkeypatch.setenv("IHUI_USER_RULES_DIRS", str(user_dir))
    locator = select_rules(workspace).agent_requested[0].locator
    out = await _tool_read_project_rule({"path": str(workspace), "locator": locator})
    assert out["ok"] is True
    assert out["body"] == "USER-BODY"
    assert out["scope"] == "user"
    assert out["locator"] == locator


# ==================== list_project_rules 诊断面 ====================


def test_list_tool_registered_both_sides() -> None:
    names = {tool.name for tool in _TOOLS}
    assert "list_project_rules" in names
    assert "list_project_rules" in _TOOL_HANDLERS


@pytest.mark.asyncio
async def test_lists_selected_agent_requested_and_excluded(tmp_path: Path) -> None:
    (tmp_path / ".ihui/rules").mkdir(parents=True)
    (tmp_path / ".ihui/rules/always.mdc").write_text(
        "---\nalwaysApply: true\n---\nALWAYS-BODY\n", encoding="utf-8"
    )
    (tmp_path / ".ihui/rules/glob.mdc").write_text(
        "---\nglobs: [\"src/**\"]\n---\nGLOB-BODY\n", encoding="utf-8"
    )
    (tmp_path / ".ihui/rules/agent.mdc").write_text(
        "---\ndescription: 请求式规则\n---\nAGENT-BODY\n", encoding="utf-8"
    )
    (tmp_path / ".ihui/rules/broken.mdc").write_text(
        "---\nalwaysApply: nope\n---\nBROKEN\n", encoding="utf-8"
    )
    out = await _tool_list_project_rules({"path": str(tmp_path), "targetPaths": ["src/a.py"]})
    assert out["ok"] is True
    assert {x["locator"] for x in out["selected"]} == {
        ".ihui/rules/always.mdc",
        ".ihui/rules/glob.mdc",
    }
    assert out["agentRequested"][0]["locator"] == ".ihui/rules/agent.mdc"
    assert [x["locator"] for x in out["excluded"]] == [".ihui/rules/broken.mdc"]
    assert out["excluded"][0]["reason"].startswith("invalid_frontmatter")
    # 诊断面不回正文:否则它就成了第二个注入面
    assert all("body" not in x for x in out["selected"])
    assert out["budget"]["used"] > 0


@pytest.mark.asyncio
async def test_list_rejects_bad_budget_and_targets(tmp_path: Path) -> None:
    bad_budget = await _tool_list_project_rules({"path": str(tmp_path), "budgetChars": 0})
    assert bad_budget["ok"] is False
    assert bad_budget["errorCode"] == "invalid_budget"
    bad_targets = await _tool_list_project_rules({"path": str(tmp_path), "targetPaths": "src/a.py"})
    assert bad_targets["ok"] is False
    assert bad_targets["errorCode"] == "invalid_targets"


@pytest.mark.asyncio
async def test_list_reports_budget_truncation(tmp_path: Path) -> None:
    (tmp_path / ".ihui/rules").mkdir(parents=True)
    (tmp_path / ".ihui/rules/long.mdc").write_text(
        "---\nalwaysApply: true\n---\n" + "X" * 200 + "\n", encoding="utf-8"
    )
    out = await _tool_list_project_rules({"path": str(tmp_path), "budgetChars": 50})
    assert out["ok"] is True
    assert out["budget"]["truncated"] is True
    assert out["budget"]["used"] <= 50
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
