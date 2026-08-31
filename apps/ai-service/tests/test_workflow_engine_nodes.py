# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""工作流引擎新节点类型测试(condition/delay/loop/parallel/tool)。

覆盖:条件分支(LLM 判定 + 模板渲染 + 降级)、延迟(默认/上限/非法值)、
循环(count 注入 loop_index + 非法值处理)、并行(收集所有结果 + 单步失败隔离)、
MCP 工具调用(存在/不存在/参数解析)。
"""

from __future__ import annotations

import json

import pytest

from app.core.llm_gateway import llm_gateway
from app.services.workflow_engine import WorkflowEngine


@pytest.fixture
def engine() -> WorkflowEngine:
    """每次测试返回干净的引擎实例。"""
    return WorkflowEngine()


# =========================================================================
# condition 条件分支
# =========================================================================


class TestConditionNode:
    """condition 节点测试。"""

    @pytest.mark.asyncio
    async def test_condition_true_branch(
        self, engine: WorkflowEngine, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """LLM 判真 → 执行 thenSteps。"""

        async def fake_complete(messages, **kwargs):
            return {"content": "true", "stub": True}

        monkeypatch.setattr(llm_gateway, "complete", fake_complete)
        result = await engine._execute_step(
            {
                "type": "condition",
                "condition": "{context.amount} > 10",
                "thenSteps": [{"type": "echo", "input": "yes"}],
                "elseSteps": [{"type": "echo", "input": "no"}],
            },
            {"amount": 100},
            "inst-1",
        )
        parsed = json.loads(result["output"])
        assert parsed["result"] is True
        assert parsed["branch"] == "then"
        assert parsed["steps"] == [{"output": "yes"}]

    @pytest.mark.asyncio
    async def test_condition_false_branch(
        self, engine: WorkflowEngine, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """LLM 判假 → 执行 elseSteps。"""

        async def fake_complete(messages, **kwargs):
            return {"content": "false", "stub": True}

        monkeypatch.setattr(llm_gateway, "complete", fake_complete)
        result = await engine._execute_step(
            {
                "type": "condition",
                "condition": "{context.amount} > 10",
                "thenSteps": [{"type": "echo", "input": "yes"}],
                "elseSteps": [{"type": "echo", "input": "no"}],
            },
            {"amount": 5},
            "inst-1",
        )
        parsed = json.loads(result["output"])
        assert parsed["result"] is False
        assert parsed["branch"] == "else"
        assert parsed["steps"] == [{"output": "no"}]

    @pytest.mark.asyncio
    async def test_condition_llm_exception_falls_back_true(
        self, engine: WorkflowEngine, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """LLM 抛异常 → 降级为条件为真,执行 thenSteps,不抛异常。"""

        async def fake_complete(messages, **kwargs):
            raise RuntimeError("llm down")

        monkeypatch.setattr(llm_gateway, "complete", fake_complete)
        result = await engine._execute_step(
            {
                "type": "condition",
                "condition": "some condition",
                "thenSteps": [{"type": "echo", "input": "then"}],
                "elseSteps": [{"type": "echo", "input": "else"}],
            },
            {},
            "inst-1",
        )
        parsed = json.loads(result["output"])
        assert parsed["result"] is True
        assert parsed["branch"] == "then"

    @pytest.mark.asyncio
    async def test_condition_llm_error_falls_back_true(
        self, engine: WorkflowEngine, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """LLM 返回 error → 降级为条件为真。"""

        async def fake_complete(messages, **kwargs):
            return {"content": "", "error": "rate limited"}

        monkeypatch.setattr(llm_gateway, "complete", fake_complete)
        result = await engine._execute_step(
            {
                "type": "condition",
                "condition": "some condition",
                "thenSteps": [{"type": "echo", "input": "then"}],
                "elseSteps": [{"type": "echo", "input": "else"}],
            },
            {},
            "inst-1",
        )
        parsed = json.loads(result["output"])
        assert parsed["result"] is True
        assert parsed["branch"] == "then"

    @pytest.mark.asyncio
    async def test_condition_template_rendering(
        self, engine: WorkflowEngine, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """{context.var} 模板用 context 值替换后传给 LLM。"""

        seen: dict[str, str] = {}

        async def fake_complete(messages, **kwargs):
            seen["prompt"] = messages[0]["content"]
            return {"content": "true", "stub": True}

        monkeypatch.setattr(llm_gateway, "complete", fake_complete)
        await engine._execute_step(
            {"type": "condition", "condition": "{context.name} 是 张三"},
            {"name": "张三"},
            "inst-1",
        )
        assert "张三" in seen["prompt"]

    @pytest.mark.asyncio
    async def test_condition_no_condition_runs_then(
        self, engine: WorkflowEngine
    ) -> None:
        """condition 字段缺失 → 不调 LLM,直接走 thenSteps。"""

        result = await engine._execute_step(
            {
                "type": "condition",
                "thenSteps": [{"type": "echo", "input": "then"}],
                "elseSteps": [{"type": "echo", "input": "else"}],
            },
            {},
            "inst-1",
        )
        parsed = json.loads(result["output"])
        assert parsed["result"] is True
        assert parsed["branch"] == "then"


# =========================================================================
# delay 延迟
# =========================================================================


class TestDelayNode:
    """delay 节点测试。"""

    @pytest.mark.asyncio
    async def test_delay_zero(self, engine: WorkflowEngine) -> None:
        """duration=0 立即返回。"""
        result = await engine._execute_step(
            {"type": "delay", "duration": 0}, {}, "inst-1"
        )
        assert result["output"] == "delayed 0s"

    @pytest.mark.asyncio
    async def test_delay_default_one(
        self, engine: WorkflowEngine, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """duration 缺省 → 1 秒。"""
        sleeps: list[float] = []

        async def fake_sleep(seconds: float) -> None:
            sleeps.append(seconds)

        monkeypatch.setattr(
            "app.services.workflow_engine.asyncio.sleep", fake_sleep
        )
        result = await engine._execute_step({"type": "delay"}, {}, "inst-1")
        assert result["output"] == "delayed 1s"
        assert sleeps == [1]

    @pytest.mark.asyncio
    async def test_delay_cap_300(
        self, engine: WorkflowEngine, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """duration 超过 300 → 截断到 300。"""
        sleeps: list[float] = []

        async def fake_sleep(seconds: float) -> None:
            sleeps.append(seconds)

        monkeypatch.setattr(
            "app.services.workflow_engine.asyncio.sleep", fake_sleep
        )
        result = await engine._execute_step(
            {"type": "delay", "duration": 999}, {}, "inst-1"
        )
        assert result["output"] == "delayed 300s"
        assert sleeps == [300]

    @pytest.mark.asyncio
    async def test_delay_negative_clamped_to_zero(
        self, engine: WorkflowEngine, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """duration 为负 → 夹到 0。"""
        sleeps: list[float] = []

        async def fake_sleep(seconds: float) -> None:
            sleeps.append(seconds)

        monkeypatch.setattr(
            "app.services.workflow_engine.asyncio.sleep", fake_sleep
        )
        result = await engine._execute_step(
            {"type": "delay", "duration": -5}, {}, "inst-1"
        )
        assert result["output"] == "delayed 0s"
        assert sleeps == [0]

    @pytest.mark.asyncio
    async def test_delay_invalid_duration_defaults_one(
        self, engine: WorkflowEngine, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """duration 非法(非数字)→ 按 1 处理。"""
        sleeps: list[float] = []

        async def fake_sleep(seconds: float) -> None:
            sleeps.append(seconds)

        monkeypatch.setattr(
            "app.services.workflow_engine.asyncio.sleep", fake_sleep
        )
        result = await engine._execute_step(
            {"type": "delay", "duration": "abc"}, {}, "inst-1"
        )
        assert result["output"] == "delayed 1s"
        assert sleeps == [1]


# =========================================================================
# loop 循环
# =========================================================================


class TestLoopNode:
    """loop 节点测试。"""

    @pytest.mark.asyncio
    async def test_loop_three_iterations(
        self, engine: WorkflowEngine
    ) -> None:
        """count=3,每次注入 loop_index,汇总 3 次输出。"""
        result = await engine._execute_step(
            {
                "type": "loop",
                "count": 3,
                "steps": [{"type": "echo"}],
            },
            {},
            "inst-1",
        )
        parsed = json.loads(result["output"])
        assert parsed["count"] == 3
        assert len(parsed["iterations"]) == 3
        for i, iteration in enumerate(parsed["iterations"]):
            ctx = json.loads(iteration[0]["output"])
            assert ctx["loop_index"] == i

    @pytest.mark.asyncio
    async def test_loop_invalid_count_defaults_one(
        self, engine: WorkflowEngine
    ) -> None:
        """count 为负/非数字 → 按 1 处理。"""
        result = await engine._execute_step(
            {"type": "loop", "count": -1, "steps": [{"type": "echo", "input": "x"}]},
            {},
            "inst-1",
        )
        parsed = json.loads(result["output"])
        assert parsed["count"] == 1
        assert parsed["iterations"][0][0]["output"] == "x"

        result2 = await engine._execute_step(
            {"type": "loop", "count": "abc", "steps": [{"type": "echo", "input": "x"}]},
            {},
            "inst-1",
        )
        parsed2 = json.loads(result2["output"])
        assert parsed2["count"] == 1

    @pytest.mark.asyncio
    async def test_loop_count_cap_20(
        self, engine: WorkflowEngine
    ) -> None:
        """count 超过 20 → 截断到 20。"""
        result = await engine._execute_step(
            {"type": "loop", "count": 100, "steps": [{"type": "echo", "input": "x"}]},
            {},
            "inst-1",
        )
        parsed = json.loads(result["output"])
        assert parsed["count"] == 20
        assert len(parsed["iterations"]) == 20


# =========================================================================
# parallel 并行
# =========================================================================


class TestParallelNode:
    """parallel 节点测试。"""

    @pytest.mark.asyncio
    async def test_parallel_all_results(
        self, engine: WorkflowEngine
    ) -> None:
        """所有子步骤结果按顺序收集。"""
        result = await engine._execute_step(
            {
                "type": "parallel",
                "steps": [
                    {"type": "echo", "input": "a"},
                    {"type": "echo", "input": "b"},
                    {"type": "echo", "input": "c"},
                ],
            },
            {},
            "inst-1",
        )
        parsed = json.loads(result["output"])
        assert [r["output"] for r in parsed["results"]] == ["a", "b", "c"]

    @pytest.mark.asyncio
    async def test_parallel_isolates_failure(
        self, engine: WorkflowEngine
    ) -> None:
        """单个子步骤失败(返回 error)不影响其他子步骤。"""
        result = await engine._execute_step(
            {
                "type": "parallel",
                "steps": [
                    {"type": "invalid_type"},
                    {"type": "echo", "input": "ok"},
                ],
            },
            {},
            "inst-1",
        )
        parsed = json.loads(result["output"])
        assert "error" in parsed["results"][0]
        assert parsed["results"][1]["output"] == "ok"

    @pytest.mark.asyncio
    async def test_parallel_empty_steps(
        self, engine: WorkflowEngine
    ) -> None:
        """steps 为空 → results 为空列表。"""
        result = await engine._execute_step(
            {"type": "parallel", "steps": []}, {}, "inst-1"
        )
        parsed = json.loads(result["output"])
        assert parsed["results"] == []


# =========================================================================
# tool MCP 工具调用
# =========================================================================


class TestToolNode:
    """tool 节点测试。"""

    @pytest.mark.asyncio
    async def test_tool_missing_name(
        self, engine: WorkflowEngine
    ) -> None:
        """config 缺工具名 → 返回 error。"""
        result = await engine._execute_step(
            {"type": "tool", "config": {}}, {}, "inst-1"
        )
        assert result["error"] == "tool 类型 step 缺少 config.tool 或 config.toolName"

    @pytest.mark.asyncio
    async def test_tool_not_found(
        self, engine: WorkflowEngine
    ) -> None:
        """工具不存在 → 返回指定错误文案。"""
        result = await engine._execute_step(
            {"type": "tool", "config": {"tool": "nonexistent_tool"}},
            {},
            "inst-1",
        )
        assert result["error"] == "工具不存在: nonexistent_tool"

    @pytest.mark.asyncio
    async def test_tool_real_analyze_code(
        self, engine: WorkflowEngine
    ) -> None:
        """真实调用 mcp_server 的 analyze_code 工具(纯计算,无 IO)。"""
        result = await engine._execute_step(
            {
                "type": "tool",
                "config": {"tool": "analyze_code"},
                "input": '{"code": "hello\\nworld", "language": "text"}',
            },
            {},
            "inst-1",
        )
        parsed = json.loads(result["output"])
        assert parsed["ok"] is True
        assert parsed["metrics"]["lines"] == 2

    @pytest.mark.asyncio
    async def test_tool_mocked_call(
        self, engine: WorkflowEngine, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """config.toolName 与 dict input,并 mock call_tool 验证透传。"""
        captured: dict[str, object] = {}

        async def fake_call_tool(name, arguments=None, **kwargs):
            captured["name"] = name
            captured["arguments"] = arguments
            return {"ok": True, "mock": "yes"}

        monkeypatch.setattr(
            "app.services.mcp_server.mcp_server.call_tool", fake_call_tool
        )
        result = await engine._execute_step(
            {
                "type": "tool",
                "config": {"toolName": "analyze_code", "server": "ignored"},
                "input": {"code": "x", "language": "python"},
            },
            {},
            "inst-1",
        )
        assert captured["name"] == "analyze_code"
        assert captured["arguments"] == {"code": "x", "language": "python"}
        parsed = json.loads(result["output"])
        assert parsed["mock"] == "yes"

    @pytest.mark.asyncio
    async def test_tool_input_plain_string(
        self, engine: WorkflowEngine, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """非 JSON 字符串 input → 包成 {"input": s} 兜底。"""
        captured: dict[str, object] = {}

        async def fake_call_tool(name, arguments=None, **kwargs):
            captured["arguments"] = arguments
            return {"ok": True}

        monkeypatch.setattr(
            "app.services.mcp_server.mcp_server.call_tool", fake_call_tool
        )
        await engine._execute_step(
            {"type": "tool", "config": {"tool": "analyze_code"}, "input": "hello"},
            {},
            "inst-1",
        )
        assert captured["arguments"] == {"input": "hello"}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
