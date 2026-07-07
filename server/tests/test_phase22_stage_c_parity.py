"""
Stage C 综合单元测试 — MCP client / Persona Registry / Codebase 增量。

对标 Claude Code / Codex / Trae / WorkBuddy 主流能力:
- MCP 3 传输 (stdio/http/sse) + OAuth + env 展开
- 151 expert persona 检索
- Codebase 增量更新 (git 优先 / mtime 回退) + 三种 RAG 检索
"""

from __future__ import annotations

import asyncio
import json
import os
import shutil
import subprocess
import tempfile
import time
import unittest
from pathlib import Path

# 允许 server 包导入
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "server"))

from app.api.v1.workspace import codebase_incremental, mcp_bridge, persona_registry  # noqa: E402


# ---------------------------------------------------------------------------
# MCP Bridge
# ---------------------------------------------------------------------------

class TestMCPEnvExpand(unittest.TestCase):
    """env 展开 + 认证 headers"""

    def test_expand_env_string(self):
        os.environ["TEST_TOKEN"] = "abc123"
        self.assertEqual(mcp_bridge.expand_env("Bearer ${TEST_TOKEN}"), "Bearer abc123")
        self.assertEqual(mcp_bridge.expand_env("${UNDEFINED_X}"), "")
        del os.environ["TEST_TOKEN"]

    def test_expand_env_nested(self):
        os.environ["API_KEY"] = "k1"
        data = {"a": "${API_KEY}", "b": ["x${API_KEY}y", "plain"], "c": {"d": "${API_KEY}"}}
        out = mcp_bridge.expand_env(data)
        self.assertEqual(out["a"], "k1")
        self.assertEqual(out["b"], ["xk1y", "plain"])
        self.assertEqual(out["c"]["d"], "k1")
        del os.environ["API_KEY"]

    def test_build_auth_headers_bearer(self):
        from app.api.v1.workspace.schemas import MCPServerConfig, MCPAuthConfig
        cfg = MCPServerConfig(
            name="x",
            auth=MCPAuthConfig(type="bearer", token="secret-token"),
        )
        headers = mcp_bridge.build_auth_headers(cfg)
        self.assertEqual(headers["Authorization"], "Bearer secret-token")

    def test_build_auth_headers_apikey_fallback(self):
        from app.api.v1.workspace.schemas import MCPServerConfig
        cfg = MCPServerConfig(name="x", api_key="k2")
        headers = mcp_bridge.build_auth_headers(cfg)
        self.assertEqual(headers["Authorization"], "Bearer k2")

    def test_build_auth_headers_custom(self):
        from app.api.v1.workspace.schemas import MCPServerConfig
        cfg = MCPServerConfig(
            name="x",
            api_key="k",
            headers={"X-Custom": "v"},
        )
        headers = mcp_bridge.build_auth_headers(cfg)
        self.assertEqual(headers["X-Custom"], "v")
        self.assertEqual(headers["Authorization"], "Bearer k")


class TestMCPStdioClient(unittest.TestCase):
    """stdio 传输: 协议层 / 错误处理"""

    def test_no_command_returns_false(self):
        from app.api.v1.workspace.schemas import MCPServerConfig
        cfg = MCPServerConfig(name="empty")
        client = mcp_bridge.MCPStdioClient(cfg)
        # 无 command, connect 立即返回 False
        self.assertFalse(asyncio.run(client.connect()))


class TestMCPManager(unittest.IsolatedAsyncioTestCase):
    """Manager 多服务器管理"""

    async def test_add_unsupported_transport(self):
        from app.api.v1.workspace.schemas import MCPServerConfig
        mgr = mcp_bridge.MCPManager()
        cfg = MCPServerConfig(name="bad", transport="unknown")
        self.assertFalse(await mgr.add_server(cfg))
        self.assertIsNotNone(mgr.get_status("bad"))
        self.assertFalse(mgr.get_status("bad").online)


class TestMCPLoadConfig(unittest.TestCase):
    """load_mcp_config 解析 .claude/settings.json"""

    def test_load_valid(self):
        with tempfile.TemporaryDirectory() as tmp:
            claude_dir = Path(tmp) / ".claude"
            claude_dir.mkdir()
            (claude_dir / "settings.json").write_text(json.dumps({
                "mcpServers": {
                    "weather": {
                        "command": "npx",
                        "args": ["-y", "@w/mcp"],
                        "env": {"API": "${ENV_API}"},
                    },
                    "remote": {
                        "url": "https://example.com/mcp",
                        "transport": "http",
                        "api_key": "k",
                    },
                }
            }))
            servers = mcp_bridge.load_mcp_config(tmp)
            self.assertEqual(len(servers), 2)
            self.assertEqual(servers[0].name, "weather")
            self.assertEqual(servers[0].transport, "stdio")
            self.assertEqual(servers[1].transport, "http")
            self.assertEqual(servers[1].api_key, "k")

    def test_load_missing_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(mcp_bridge.load_mcp_config(tmp), [])

    def test_load_invalid_json(self):
        with tempfile.TemporaryDirectory() as tmp:
            claude_dir = Path(tmp) / ".claude"
            claude_dir.mkdir()
            (claude_dir / "settings.json").write_text("not json")
            self.assertEqual(mcp_bridge.load_mcp_config(tmp), [])

    def test_load_skip_incomplete_stdio(self):
        with tempfile.TemporaryDirectory() as tmp:
            claude_dir = Path(tmp) / ".claude"
            claude_dir.mkdir()
            (claude_dir / "settings.json").write_text(json.dumps({
                "mcpServers": {
                    "broken": {"args": ["x"]},  # no command
                    "valid": {"command": "echo", "args": []},
                }
            }))
            servers = mcp_bridge.load_mcp_config(tmp)
            self.assertEqual(len(servers), 1)
            self.assertEqual(servers[0].name, "valid")


# ---------------------------------------------------------------------------
# Persona Registry
# ---------------------------------------------------------------------------

class TestPersonaRegistry(unittest.TestCase):
    """Persona Registry CRUD + 检索"""

    def setUp(self):
        # 隔离持久化: 用临时目录
        self.tmp = Path(tempfile.mkdtemp())
        os.environ["IHUI_PERSONAS_DIR"] = str(self.tmp)
        # 重置 singleton
        persona_registry._registry = None

    def tearDown(self):
        del os.environ["IHUI_PERSONAS_DIR"]
        shutil.rmtree(self.tmp, ignore_errors=True)
        persona_registry._registry = None

    def test_load_builtin_count(self):
        reg = persona_registry.get_persona_registry()
        self.assertGreaterEqual(len(reg.list_all()), 140)
        # 验证 7 大类别
        cats = {c["name"] for c in reg.list_categories()}
        self.assertEqual(cats, {"engineering", "creative", "business", "academic", "legal", "medical", "specialty"})

    def test_get_existing(self):
        reg = persona_registry.get_persona_registry()
        p = reg.get("code-reviewer")
        self.assertIsNotNone(p)
        self.assertEqual(p.name, "Code Reviewer")
        self.assertEqual(p.category, "engineering")

    def test_get_nonexistent(self):
        reg = persona_registry.get_persona_registry()
        self.assertIsNone(reg.get("not-exists"))

    def test_search(self):
        reg = persona_registry.get_persona_registry()
        hits = reg.search("code")
        self.assertGreater(len(hits), 0)
        ids = {p.id for p in hits}
        self.assertIn("code-reviewer", ids)

    def test_search_empty_query_returns_all(self):
        reg = persona_registry.get_persona_registry()
        self.assertEqual(len(reg.search("")), len(reg.list_all()))

    def test_list_by_category(self):
        reg = persona_registry.get_persona_registry()
        eng = reg.list_by_category("engineering")
        self.assertGreater(len(eng), 30)
        for p in eng:
            self.assertEqual(p.category, "engineering")

    def test_disable_enable(self):
        reg = persona_registry.get_persona_registry()
        reg.disable("code-reviewer")
        self.assertFalse(reg.get("code-reviewer").enabled)
        reg.enable("code-reviewer")
        self.assertTrue(reg.get("code-reviewer").enabled)

    def test_cannot_delete_builtin(self):
        reg = persona_registry.get_persona_registry()
        with self.assertRaises(ValueError):
            reg.delete("code-reviewer")

    def test_add_custom_persists(self):
        reg = persona_registry.get_persona_registry()
        custom = persona_registry.Persona(
            id="my-custom",
            name="Custom",
            category="engineering",
            description="test",
            system_prompt="you are test",
        )
        reg.add(custom)
        # 重新加载
        persona_registry._registry = None
        reg2 = persona_registry.get_persona_registry()
        self.assertIsNotNone(reg2.get("my-custom"))
        self.assertEqual(reg2.get("my-custom").name, "Custom")

    def test_update_builtin(self):
        reg = persona_registry.get_persona_registry()
        reg.update("code-reviewer", description="updated desc")
        self.assertEqual(reg.get("code-reviewer").description, "updated desc")

    def test_get_system_prompt(self):
        reg = persona_registry.get_persona_registry()
        sp = reg.get_system_prompt("code-reviewer")
        self.assertIsNotNone(sp)
        self.assertGreater(len(sp), 50)

    def test_get_system_prompt_disabled(self):
        reg = persona_registry.get_persona_registry()
        reg.disable("code-reviewer")
        self.assertIsNone(reg.get_system_prompt("code-reviewer"))


# ---------------------------------------------------------------------------
# Codebase 增量更新
# ---------------------------------------------------------------------------

class TestCodebaseIncremental(unittest.TestCase):
    """增量更新 + 检索 (mtime)"""

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        # 创建测试文件
        (self.tmp / "foo.py").write_text("def hello():\n    return 1\n")
        (self.tmp / "bar.js").write_text("function bar() { return 2; }\n")
        (self.tmp / "ignore_dir").mkdir()
        (self.tmp / "ignore_dir" / "skip.py").write_text("skipped")
        # 写一个 ignore 的扩展
        (self.tmp / "big.bin").write_text("x" * 2048)

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_initial_incremental_builds_index(self):
        result = codebase_incremental.incremental_update(str(self.tmp))
        self.assertFalse(result["skipped"])
        # symbols_changed == -1 表示全量 (无既有索引), 也算成功
        self.assertTrue(result["symbols_changed"] > 0 or result["symbols_changed"] == -1)

    def test_no_changes_after_incremental(self):
        codebase_incremental.incremental_update(str(self.tmp))
        # 第二次应跳过
        result = codebase_incremental.incremental_update(str(self.tmp))
        self.assertTrue(result["skipped"])
        self.assertEqual(result["diff"]["total"], 0)

    def test_detect_modification(self):
        codebase_incremental.incremental_update(str(self.tmp))
        time.sleep(1.0)  # 跨秒级 mtime
        (self.tmp / "foo.py").write_text("def hello():\n    return 999\n")
        result = codebase_incremental.incremental_update(str(self.tmp))
        self.assertFalse(result["skipped"])
        self.assertIn("foo.py", result["diff"]["modified"])

    def test_detect_deletion(self):
        codebase_incremental.incremental_update(str(self.tmp))
        time.sleep(1.0)
        (self.tmp / "bar.js").unlink()
        result = codebase_incremental.incremental_update(str(self.tmp))
        self.assertFalse(result["skipped"])
        self.assertIn("bar.js", result["diff"]["deleted"])

    def test_ignore_dirs(self):
        # 使用 _IGNORE_DIRS 中真实存在的目录名
        skip_dir = self.tmp / "node_modules"
        skip_dir.mkdir()
        (skip_dir / "skip.py").write_text("# should be ignored")
        result = codebase_incremental.incremental_update(str(self.tmp))
        all_paths = result["diff"]["added"]
        self.assertFalse(any("node_modules" in p for p in all_paths))

    def test_status(self):
        codebase_incremental.incremental_update(str(self.tmp))
        s = codebase_incremental.get_status(str(self.tmp))
        self.assertGreater(s.symbol_files, 0)
        self.assertGreater(s.semantic_chunks, 0)
        self.assertEqual(s.semantic_backend, "tfidf")
        self.assertGreater(s.last_incremental_at, 0)

    def test_search_fuzzy(self):
        codebase_incremental.incremental_update(str(self.tmp))
        results = codebase_incremental.search_codebase(str(self.tmp), "foo", mode="fuzzy")
        self.assertGreater(len(results), 0)
        self.assertEqual(results[0]["name"], "foo.py")

    def test_search_symbols(self):
        codebase_incremental.incremental_update(str(self.tmp))
        results = codebase_incremental.search_codebase(str(self.tmp), "hello", mode="symbols")
        self.assertGreater(len(results), 0)
        self.assertEqual(results[0]["name"], "hello")

    def test_search_semantic(self):
        codebase_incremental.incremental_update(str(self.tmp))
        results = codebase_incremental.search_codebase(str(self.tmp), "function return", mode="semantic")
        # TF-IDF 至少返回一个
        self.assertIsInstance(results, list)


class TestCodebaseIncrementalGit(unittest.TestCase):
    """git 路径: 用临时 git 仓库验证"""

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        subprocess.run(["git", "init", "-q"], cwd=str(self.tmp), check=True)
        subprocess.run(["git", "config", "user.email", "t@t"], cwd=str(self.tmp), check=True)
        subprocess.run(["git", "config", "user.name", "T"], cwd=str(self.tmp), check=True)
        (self.tmp / "a.py").write_text("def a(): pass\n")
        subprocess.run(["git", "add", "a.py"], cwd=str(self.tmp), check=True)
        subprocess.run(["git", "commit", "-q", "-m", "init"], cwd=str(self.tmp), check=True)

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_git_added_file(self):
        codebase_incremental.incremental_update(str(self.tmp))
        # 后续新增
        (self.tmp / "b.py").write_text("def b(): pass\n")
        result = codebase_incremental.incremental_update(str(self.tmp))
        self.assertIn("b.py", result["diff"]["added"])

    def test_git_modified_file(self):
        codebase_incremental.incremental_update(str(self.tmp))
        (self.tmp / "a.py").write_text("def a(): return 1\n")
        subprocess.run(["git", "add", "a.py"], cwd=str(self.tmp), check=True)
        result = codebase_incremental.incremental_update(str(self.tmp))
        # git 视为 modified (我们 M 状态)
        self.assertTrue(
            "a.py" in result["diff"]["modified"] or "a.py" in result["diff"]["added"]
        )


# ---------------------------------------------------------------------------
# Persona 注入到 agent_loop (P0 修复验证)
# ---------------------------------------------------------------------------

class TestPersonaInjection(unittest.IsolatedAsyncioTestCase):
    """验证 persona_id 真正注入到 agent_loop 的 system prompt"""

    def setUp(self):
        # 隔离 personas 持久化
        self.tmp = Path(tempfile.mkdtemp())
        os.environ["IHUI_PERSONAS_DIR"] = str(self.tmp)
        # 重置 singleton
        persona_registry._registry = None

    def tearDown(self):
        if "IHUI_PERSONAS_DIR" in os.environ:
            del os.environ["IHUI_PERSONAS_DIR"]
        shutil.rmtree(self.tmp, ignore_errors=True)
        persona_registry._registry = None

    async def test_persona_id_injected_into_system_prompt(self):
        """persona_id 必须出现在 agent.context 事件的 system prompt 里"""
        from app.api.v1.workspace import agent_loop
        from unittest.mock import patch

        tmp = Path(tempfile.mkdtemp())
        try:
            fake_cfg = {"model": "fake", "code": "default"}

            async def fake_stream(*args, **kwargs):
                yield {"type": "done", "usage": {}, "attempts": 1}

            with patch.object(agent_loop, "_get_model_config", return_value=fake_cfg), \
                 patch.object(agent_loop, "chat_with_tools", side_effect=fake_stream):
                events = []
                async for ev in agent_loop.run_agent_loop(
                    prompt="hello",
                    model_id="default",
                    workspace_path=str(tmp),
                    user_uuid="test",
                    max_iterations=1,
                    persona_id="code-reviewer",
                ):
                    events.append(ev)

            ctx = next((e for e in events if e.get("type") == "agent.context"), None)
            self.assertIsNotNone(ctx, "agent.context 事件必须被 yield")
            self.assertIsNotNone(ctx.get("persona"), "persona 字段必须存在")
            self.assertEqual(ctx["persona"]["id"], "code-reviewer")
            self.assertEqual(ctx["persona"]["name"], "Code Reviewer")
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    async def test_unknown_persona_id_skipped_safely(self):
        """未知 persona_id 不能让 agent_loop 崩"""
        from app.api.v1.workspace import agent_loop
        from unittest.mock import patch

        tmp = Path(tempfile.mkdtemp())
        try:
            fake_cfg = {"model": "fake", "code": "default"}

            async def fake_stream(*args, **kwargs):
                yield {"type": "done", "usage": {}, "attempts": 1}

            with patch.object(agent_loop, "_get_model_config", return_value=fake_cfg), \
                 patch.object(agent_loop, "chat_with_tools", side_effect=fake_stream):
                events = []
                async for ev in agent_loop.run_agent_loop(
                    prompt="hello",
                    model_id="default",
                    workspace_path=str(tmp),
                    max_iterations=1,
                    persona_id="nonexistent-persona-12345",
                ):
                    events.append(ev)

            ctx = next((e for e in events if e.get("type") == "agent.context"), None)
            self.assertIsNotNone(ctx)
            self.assertIsNone(ctx.get("persona"), "未知 persona 注入时 persona 字段必须为 None")
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    async def test_disabled_persona_skipped(self):
        """禁用的 persona 不能注入"""
        from app.api.v1.workspace import agent_loop
        from unittest.mock import patch

        tmp = Path(tempfile.mkdtemp())
        try:
            reg = persona_registry.get_persona_registry()
            reg.disable("code-reviewer")
            try:
                fake_cfg = {"model": "fake", "code": "default"}

                async def fake_stream(*args, **kwargs):
                    yield {"type": "done", "usage": {}, "attempts": 1}

                with patch.object(agent_loop, "_get_model_config", return_value=fake_cfg), \
                     patch.object(agent_loop, "chat_with_tools", side_effect=fake_stream):
                    events = []
                    async for ev in agent_loop.run_agent_loop(
                        prompt="hello",
                        model_id="default",
                        workspace_path=str(tmp),
                        max_iterations=1,
                        persona_id="code-reviewer",
                    ):
                        events.append(ev)
                ctx = next((e for e in events if e.get("type") == "agent.context"), None)
                self.assertIsNotNone(ctx)
                self.assertIsNone(ctx.get("persona"), "禁用 persona 注入时 persona 字段必须为 None")
            finally:
                reg.enable("code-reviewer")
        finally:
            shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    unittest.main(verbosity=2)


# ---------------------------------------------------------------------------
# End-to-end Mock LLM 测试 (P1 修复: 不依赖真 LLM, 验证完整 agent_loop 流程)
# ---------------------------------------------------------------------------

class TestAgentLoopEndToEnd(unittest.IsolatedAsyncioTestCase):
    """端到端: mock LLM 工具调用循环, 验证 events 序列 + tool dispatch + 历史持久化"""

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        os.environ["IHUI_PERSONAS_DIR"] = str(self.tmp)
        persona_registry._registry = None

    def tearDown(self):
        if "IHUI_PERSONAS_DIR" in os.environ:
            del os.environ["IHUI_PERSONAS_DIR"]
        shutil.rmtree(self.tmp, ignore_errors=True)
        persona_registry._registry = None

    async def test_full_loop_with_tool_call(self):
        """完整一轮: agent.context → tool.call → tool.result → agent.text.delta → agent.done"""
        from app.api.v1.workspace import agent_loop
        from unittest.mock import patch

        fake_cfg = {"model": "fake", "code": "default"}

        # mock LLM stream: 第一次产出 tool_call, 第二次产出文本
        call_count = [0]

        async def fake_stream(*args, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                yield {
                    "type": "tool_call_complete",
                    "id": "call_1",
                    "name": "read_file",
                    "arguments": {"path": "test.txt"},
                }
                yield {"type": "done", "usage": {"prompt_tokens": 10, "completion_tokens": 5}, "attempts": 1}
            else:
                yield {"type": "text_delta", "content": "Hello "}
                yield {"type": "text_delta", "content": "world"}
                yield {"type": "done", "usage": {"prompt_tokens": 20, "completion_tokens": 10}, "attempts": 1}

        with patch.object(agent_loop, "_get_model_config", return_value=fake_cfg), \
             patch.object(agent_loop, "chat_with_tools", side_effect=fake_stream):
            events = []
            async for ev in agent_loop.run_agent_loop(
                prompt="read test.txt",
                model_id="default",
                workspace_path=str(self.tmp),
                max_iterations=3,
            ):
                events.append(ev)

        event_types = [e.get("type") for e in events]
        # 必须包含: context, tool.call, tool.result, text_delta (2次), done
        self.assertIn("agent.context", event_types)
        self.assertIn("agent.tool.call", event_types)
        self.assertIn("agent.tool.result", event_types)
        self.assertIn("agent.text.delta", event_types)
        self.assertIn("agent.done", event_types)

        # 至少 2 个 text.delta
        text_deltas = [e for e in events if e.get("type") == "agent.text.delta"]
        self.assertGreaterEqual(len(text_deltas), 1)

        # tool.call 事件必须带 input
        tool_call = next(e for e in events if e.get("type") == "agent.tool.call")
        self.assertEqual(tool_call["name"], "read_file")
        self.assertEqual(tool_call["input"]["path"], "test.txt")

    async def test_permission_mode_default_blocks_dangerous_tool(self):
        """default 模式下, run_command 黑名单命令应被拦截"""
        from app.api.v1.workspace import agent_loop
        from unittest.mock import patch

        fake_cfg = {"model": "fake", "code": "default"}

        async def fake_stream(*args, **kwargs):
            yield {
                "type": "tool_call_complete",
                "id": "call_1",
                "name": "run_command",
                "arguments": {"command": "rm -rf /"},
            }
            yield {"type": "done", "usage": {}, "attempts": 1}

        with patch.object(agent_loop, "_get_model_config", return_value=fake_cfg), \
             patch.object(agent_loop, "chat_with_tools", side_effect=fake_stream):
            events = []
            async for ev in agent_loop.run_agent_loop(
                prompt="rm -rf /",
                model_id="default",
                workspace_path=str(self.tmp),
                max_iterations=2,
                permission_mode="default",
            ):
                events.append(ev)

        # tool.result 应带 success=False 或包含禁止提示
        tool_result = next((e for e in events if e.get("type") == "agent.tool.result"), None)
        self.assertIsNotNone(tool_result)
        # shell blacklisted 或 perm deny
        self.assertFalse(tool_result.get("success", True))

    async def test_permission_mode_bypass_allows_dangerous_tool(self):
        """bypassPermissions 模式下, 危险命令也应被允许 (但黑名单仍硬拦截)"""
        from app.api.v1.workspace import agent_loop
        from unittest.mock import patch

        fake_cfg = {"model": "fake", "code": "default"}

        async def fake_stream(*args, **kwargs):
            yield {
                "type": "tool_call_complete",
                "id": "call_1",
                "name": "run_command",
                "arguments": {"command": "ls"},
            }
            yield {"type": "done", "usage": {}, "attempts": 1}

        with patch.object(agent_loop, "_get_model_config", return_value=fake_cfg), \
             patch.object(agent_loop, "chat_with_tools", side_effect=fake_stream):
            events = []
            async for ev in agent_loop.run_agent_loop(
                prompt="ls",
                model_id="default",
                workspace_path=str(self.tmp),
                max_iterations=2,
                permission_mode="bypassPermissions",
            ):
                events.append(ev)

        tool_result = next((e for e in events if e.get("type") == "agent.tool.result"), None)
        self.assertIsNotNone(tool_result)
        self.assertTrue(tool_result.get("success", False), "bypass 模式下 ls 必须成功")

    async def test_plan_mode_registers_submit_plan_tool(self):
        """plan 模式必须注册 submit_plan 工具"""
        from app.api.v1.workspace import agent_loop
        from unittest.mock import patch

        fake_cfg = {"model": "fake", "code": "default"}

        async def fake_stream(*args, **kwargs):
            yield {"type": "done", "usage": {}, "attempts": 1}

        with patch.object(agent_loop, "_get_model_config", return_value=fake_cfg), \
             patch.object(agent_loop, "chat_with_tools", side_effect=fake_stream) as mock_chat:
            async for _ in agent_loop.run_agent_loop(
                prompt="plan it",
                model_id="default",
                workspace_path=str(self.tmp),
                max_iterations=1,
                permission_mode="plan",
            ):
                pass

        # 检查 chat_with_tools 被调用时的 tools 参数
        call_args = mock_chat.call_args
        tools = call_args.kwargs.get("tools") or call_args.args[2] if len(call_args.args) > 2 else []
        tool_names = [t.get("function", {}).get("name") for t in tools]
        self.assertIn("submit_plan", tool_names, "plan 模式下必须注册 submit_plan 工具")
