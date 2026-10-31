# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""`render_repo_tree` 的接线与出口形状钉(goal-b47)。

钉三格:①定义↔处理函数双向在册(摘掉任一侧即红);②工作区白名单外必须拒答;
③成功档必须把核算面完整带回,而不是只回一段文本(调用方要能判断这份骨架全不全)。
"""

from __future__ import annotations

from typing import Any

from app.services import mcp_server as m


def test_tool_defined_and_handler_wired_both_ways():
    names = {t.name for t in m._TOOLS}
    assert "render_repo_tree" in names, "工具定义缺席 ⇒ 模型侧看不见这个能力"
    assert m._TOOL_HANDLERS.get("render_repo_tree") is m._tool_render_repo_tree
    assert len(m._TOOLS) == len(m._TOOL_HANDLERS), "定义与处理函数必须双射(本仓既有判据)"


async def test_path_outside_workspace_is_refused_not_emptied(monkeypatch):
    def fake_validate(_path: Any) -> tuple[bool, Any]:
        return False, "路径不在工作区白名单内"

    monkeypatch.setattr(m, "_validate_path_in_workspace", fake_validate)
    out = await m._tool_render_repo_tree({"path": "C:/Windows"})
    assert out["ok"] is False
    assert out["errorCode"] == "PATH_NOT_ALLOWED", "拒答必须具名,不能回一份空骨架冒充成功"
    assert "text" not in out


async def test_non_directory_is_refused(monkeypatch):
    monkeypatch.setattr(m, "_validate_path_in_workspace", lambda _p: (True, "G:/IHUI-AI/README.md"))
    out = await m._tool_render_repo_tree({"path": "README.md"})
    assert out["ok"] is False and out["errorCode"] == "NOT_A_DIRECTORY"


async def test_success_returns_accounting_not_only_text(monkeypatch, tmp_path):
    (tmp_path / "src" / "deep").mkdir(parents=True)
    (tmp_path / "src" / "a.ts").write_text("export const a = 1\n", encoding="utf-8")
    (tmp_path / "src" / "deep" / "b.py").write_text("x = 1\n", encoding="utf-8")
    monkeypatch.setattr(m, "_validate_path_in_workspace", lambda _p: (True, str(tmp_path)))

    out = await m._tool_render_repo_tree({"path": ".", "maxTokens": 512})
    assert out["ok"] is True
    for key in (
        "text",
        "tokens",
        "maxTokens",
        "dirsShown",
        "filesShown",
        "filesDropped",
        "filesIgnored",
        "ignoredBy",
        "enumerated",
        "complete",
        "engine",
    ):
        assert key in out, f"核算面缺 {key}"
    assert "a.ts" in out["text"] and "b.py" in out["text"]
    assert out["tokens"] <= out["maxTokens"]

    tight = await m._tool_render_repo_tree({"path": ".", "maxTokens": 1})
    assert tight["ok"] is True, "预算给小了是夹到下限,不是报错"
    assert tight["maxTokens"] >= m.MIN_MAX_TOKENS if hasattr(m, "MIN_MAX_TOKENS") else True
    assert tight["complete"] is False or tight["filesShown"] == tight["enumerated"]


async def test_bad_budget_is_named_not_silently_defaulted(monkeypatch, tmp_path):
    monkeypatch.setattr(m, "_validate_path_in_workspace", lambda _p: (True, str(tmp_path)))
    out = await m._tool_render_repo_tree({"path": ".", "maxTokens": "abc"})
    assert out["ok"] is False and out["errorCode"] == "BAD_MAX_TOKENS"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
