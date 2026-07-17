"""项目记忆加载服务测试。

测试覆盖:
- load_project_memory: 文件优先级(.ihui/memory.md > CLAUDE.md > AGENTS.md)、
  空内容跳过、文件不存在返回 None、workspace_path=None 用 cwd、unicode 内容
- build_system_prompt: 无记忆返回默认、有记忆注入格式、session_id 预留参数
- 常量: MEMORY_FILENAMES 顺序、DEFAULT_SYSTEM_PROMPT 内容
"""

from __future__ import annotations

import pytest

from app.services.project_memory import (
    DEFAULT_SYSTEM_PROMPT,
    MEMORY_FILENAMES,
    build_system_prompt,
    load_project_memory,
)


class TestLoadProjectMemory:
    def test_returns_none_when_no_file_exists(self, tmp_path):
        assert load_project_memory(str(tmp_path)) is None

    def test_loads_ihui_memory_md_first(self, tmp_path):
        (tmp_path / ".ihui").mkdir()
        (tmp_path / ".ihui" / "memory.md").write_text("IHUI memory", encoding="utf-8")
        (tmp_path / "CLAUDE.md").write_text("CLAUDE", encoding="utf-8")
        (tmp_path / "AGENTS.md").write_text("AGENTS", encoding="utf-8")
        assert load_project_memory(str(tmp_path)) == "IHUI memory"

    def test_loads_claude_md_second(self, tmp_path):
        (tmp_path / "CLAUDE.md").write_text("CLAUDE", encoding="utf-8")
        (tmp_path / "AGENTS.md").write_text("AGENTS", encoding="utf-8")
        assert load_project_memory(str(tmp_path)) == "CLAUDE"

    def test_loads_agents_md_last(self, tmp_path):
        (tmp_path / "AGENTS.md").write_text("AGENTS", encoding="utf-8")
        assert load_project_memory(str(tmp_path)) == "AGENTS"

    def test_empty_content_skipped(self, tmp_path):
        (tmp_path / ".ihui").mkdir()
        (tmp_path / ".ihui" / "memory.md").write_text("   \n\n  ", encoding="utf-8")
        (tmp_path / "CLAUDE.md").write_text("Real content", encoding="utf-8")
        assert load_project_memory(str(tmp_path)) == "Real content"

    def test_all_files_empty_returns_none(self, tmp_path):
        (tmp_path / "CLAUDE.md").write_text("", encoding="utf-8")
        (tmp_path / "AGENTS.md").write_text("  \n  ", encoding="utf-8")
        assert load_project_memory(str(tmp_path)) is None

    def test_strips_whitespace(self, tmp_path):
        (tmp_path / "CLAUDE.md").write_text("\n  content  \n", encoding="utf-8")
        assert load_project_memory(str(tmp_path)) == "content"

    def test_none_workspace_uses_cwd(self, tmp_path, monkeypatch):
        (tmp_path / "CLAUDE.md").write_text("cwd content", encoding="utf-8")
        monkeypatch.chdir(str(tmp_path))
        assert load_project_memory(None) == "cwd content"

    def test_unicode_content(self, tmp_path):
        (tmp_path / "CLAUDE.md").write_text("项目记忆:中文内容", encoding="utf-8")
        assert load_project_memory(str(tmp_path)) == "项目记忆:中文内容"


class TestBuildSystemPrompt:
    def test_returns_default_when_no_memory(self, tmp_path):
        assert build_system_prompt(workspace_path=str(tmp_path)) == DEFAULT_SYSTEM_PROMPT

    def test_injects_memory_into_prompt(self, tmp_path):
        (tmp_path / "CLAUDE.md").write_text("My project rules", encoding="utf-8")
        result = build_system_prompt(workspace_path=str(tmp_path))
        assert DEFAULT_SYSTEM_PROMPT in result
        assert "My project rules" in result
        assert "## 项目记忆" in result

    def test_session_id_param_accepted(self, tmp_path):
        result = build_system_prompt(session_id="sess-123", workspace_path=str(tmp_path))
        assert result == DEFAULT_SYSTEM_PROMPT

    def test_none_workspace_uses_cwd(self, tmp_path, monkeypatch):
        (tmp_path / "CLAUDE.md").write_text("cwd prompt", encoding="utf-8")
        monkeypatch.chdir(str(tmp_path))
        result = build_system_prompt(workspace_path=None)
        assert "cwd prompt" in result


class TestConstants:
    def test_memory_filenames_order(self):
        assert MEMORY_FILENAMES == [".ihui/memory.md", "CLAUDE.md", "AGENTS.md"]

    def test_default_system_prompt_content(self):
        assert DEFAULT_SYSTEM_PROMPT
        assert "IHUI" in DEFAULT_SYSTEM_PROMPT
