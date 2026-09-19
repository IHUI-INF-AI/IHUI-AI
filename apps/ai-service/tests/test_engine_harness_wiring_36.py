# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
# apply_patch × sandbox_policy 受保护元数据接线测试 — 第三十六批
# (对标 Codex WritableRoot.is_path_writable 在 apply_patch 落盘通道的强制点)
import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pytest

from test_engine_harness_fifth import _engine, _rpc, _find_builtin  # 复用第五批助手


def _v4a_patch(body: str) -> str:
    return "*** Begin Patch\n" + body + "\n*** End Patch"


@pytest.mark.asyncio
async def test_patch_rejects_git_hooks_path(tmp_path):
    """.git 首段路径不可被补丁修改(hooks 提权风险)。"""
    (tmp_path / ".git").mkdir()
    (tmp_path / ".git" / "hooks").mkdir()
    engine, _ = _engine()
    started = await _rpc(engine, "thread.start", {"workspace": str(tmp_path)})
    thread = engine._threads[started["threadId"]]
    tool = _find_builtin(engine, thread, "apply_patch")
    patch = _v4a_patch(
        "*** Update File: .git/hooks/pre-commit\n@@\n-old\n+evil"
    )
    result = await tool.executor({"patch": patch})
    assert result.get("error") and "受保护路径" in result["error"]
    assert result.get("protected") == ".git"
    # 零修改:原文件未被触碰
    assert (tmp_path / ".git" / "hooks" / "pre-commit").exists() is False


@pytest.mark.asyncio
async def test_patch_rejects_codex_metadata_path(tmp_path):
    """.codex 首段路径不可被补丁修改(即使目录尚不存在)。"""
    engine, _ = _engine()
    started = await _rpc(engine, "thread.start", {"workspace": str(tmp_path)})
    thread = engine._threads[started["threadId"]]
    tool = _find_builtin(engine, thread, "apply_patch")
    patch = _v4a_patch(
        "*** Add File: .codex/config.toml\n+key=value"
    )
    result = await tool.executor({"patch": patch})
    assert result.get("error") and "受保护路径" in result["error"]
    assert result.get("protected") == ".codex"
    assert (tmp_path / ".codex").exists() is False


@pytest.mark.asyncio
async def test_patch_rejects_move_from_protected_source(tmp_path):
    """V4A Move to:源路径受保护时整段拒绝(删除同样不可)。"""
    (tmp_path / ".agents").mkdir()
    (tmp_path / ".agents" / "skill.md").write_text("x\n", encoding="utf-8")
    engine, _ = _engine()
    started = await _rpc(engine, "thread.start", {"workspace": str(tmp_path)})
    thread = engine._threads[started["threadId"]]
    tool = _find_builtin(engine, thread, "apply_patch")
    patch = _v4a_patch(
        "*** Update File: .agents/skill.md\n*** Move to: agents-moved.md\n@@\n-x\n+y"
    )
    result = await tool.executor({"patch": patch})
    assert result.get("error") and "受保护路径" in result["error"]
    assert result.get("protected") == ".agents"
    # 源文件未被移动
    assert (tmp_path / ".agents" / "skill.md").exists() is True
    assert (tmp_path / "agents-moved.md").exists() is False


@pytest.mark.asyncio
async def test_patch_still_applies_normal_paths(tmp_path):
    """回归:普通路径补丁行为不变(接线只拦受保护首段)。"""
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "mod.py").write_text("def f():\n    return 1\n", encoding="utf-8")
    engine, _ = _engine()
    started = await _rpc(engine, "thread.start", {"workspace": str(tmp_path)})
    thread = engine._threads[started["threadId"]]
    tool = _find_builtin(engine, thread, "apply_patch")
    patch = _v4a_patch(
        "*** Update File: src/mod.py\n@@\n def f():\n-    return 1\n+    return 42"
    )
    result = await tool.executor({"patch": patch})
    assert result.get("applied") is True
    assert "return 42" in (tmp_path / "src" / "mod.py").read_text(encoding="utf-8")
