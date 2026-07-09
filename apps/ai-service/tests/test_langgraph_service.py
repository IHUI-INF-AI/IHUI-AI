"""LangGraph 服务单元测试。

测试条件边逻辑、服务可用性、结果构建、trace 可观测性。
不调用真实 LLM(不触发 ainvoke / complete)。
"""

from app.services.langgraph_service import (
    GraphState,
    LangGraphService,
    WorkflowState,
    _trace_entry,
)


class TestLangGraphAvailability:
    """LangGraph 服务可用性。"""

    def test_service_initializes_without_crash(self):
        """服务初始化不崩溃(无论 LangGraph 是否安装)。"""
        service = LangGraphService()
        assert isinstance(service.available, bool)

    def test_available_property_returns_bool(self):
        """available 属性返回布尔值。"""
        service = LangGraphService()
        assert service.available is True or service.available is False


class TestConditionalEdges:
    """条件边函数逻辑(_should_execute / _should_continue)。"""

    def setup_method(self):
        self.service = LangGraphService()

    def test_should_execute_returns_error_when_error_exists(self):
        """有 error 时 _should_execute 返回 'error'。"""
        state: GraphState = {"goal": "test", "error": "出错了"}
        assert self.service._should_execute(state) == "error"

    def test_should_execute_returns_summarize_when_no_plan(self):
        """plan 为空时 _should_execute 返回 'summarize'。"""
        state: GraphState = {"goal": "test", "plan": []}
        assert self.service._should_execute(state) == "summarize"

    def test_should_execute_returns_execute_when_plan_exists(self):
        """plan 非空时 _should_execute 返回 'execute'。"""
        state: GraphState = {"goal": "test", "plan": ["步骤1"]}
        assert self.service._should_execute(state) == "execute"

    def test_should_continue_returns_error_when_error_exists(self):
        """有 error 时 _should_continue 返回 'error'。"""
        state: GraphState = {"goal": "test", "error": "失败"}
        assert self.service._should_continue(state) == "error"

    def test_should_continue_returns_error_when_exceeds_max_iterations(self):
        """超过最大迭代次数时 _should_continue 返回 'error'。"""
        state: GraphState = {"goal": "test", "plan": ["s1"], "step_index": 0, "iterations": 999}
        assert self.service._should_continue(state) == "error"

    def test_should_continue_returns_execute_when_steps_remain(self):
        """还有步骤未执行时 _should_continue 返回 'execute'。"""
        state: GraphState = {"goal": "test", "plan": ["s1", "s2"], "step_index": 0, "iterations": 1}
        assert self.service._should_continue(state) == "execute"

    def test_should_continue_returns_summarize_when_all_steps_done(self):
        """所有步骤完成时 _should_continue 返回 'summarize'。"""
        state: GraphState = {"goal": "test", "plan": ["s1", "s2"], "step_index": 2, "iterations": 2}
        assert self.service._should_continue(state) == "summarize"


class TestResultBuilder:
    """结果构建函数。"""

    def setup_method(self):
        self.service = LangGraphService()

    def test_build_result_from_state_contains_all_fields(self):
        """_build_result_from_state 包含所有字段。"""
        state: GraphState = {
            "goal": "测试目标",
            "session_id": "sess-1",
            "plan": ["步骤1"],
            "results": [{"step": 1, "plan": "步骤1", "result": "结果"}],
            "summary": "总结",
            "error": None,
            "iterations": 1,
            "status": "completed",
        }
        result = self.service._build_result_from_state(state)
        assert result["status"] == "completed"
        assert result["goal"] == "测试目标"
        assert result["session_id"] == "sess-1"
        assert result["plan"] == ["步骤1"]
        assert len(result["results"]) == 1
        assert result["summary"] == "总结"
        assert result["error"] is None
        assert result["iterations"] == 1
        assert result["langgraph_available"] is True

    def test_build_result_from_state_with_defaults(self):
        """_build_result_from_state 对空 state 使用默认值。"""
        result = self.service._build_result_from_state({})
        assert result["status"] == "completed"
        assert result["goal"] == ""
        assert result["plan"] == []
        assert result["results"] == []
        assert result["summary"] == ""
        assert result["error"] is None
        assert result["iterations"] == 0


# =============================================================================
# Trace 可观测性测试
# =============================================================================


class TestTraceEntry:
    """_trace_entry 函数测试。"""

    def test_trace_entry_basic_fields(self):
        """基础字段:node/start/end/duration_ms/status。"""
        entry = _trace_entry("plan", 1000.0, 1000.5)
        assert entry["node"] == "plan"
        assert "start" in entry
        assert "end" in entry
        assert entry["duration_ms"] == 500.0
        assert entry["status"] == "ok"

    def test_trace_entry_with_error(self):
        """错误状态 + error 字段。"""
        entry = _trace_entry("execute", 1000.0, 1001.0, status="error", error="失败")
        assert entry["status"] == "error"
        assert entry["error"] == "失败"

    def test_trace_entry_with_metadata(self):
        """元数据字段透传(step/plan_length/iterations 等)。"""
        entry = _trace_entry(
            "execute", 1000.0, 1000.2,
            step=1, total_steps=3, iterations=1, stub=True,
        )
        assert entry["step"] == 1
        assert entry["total_steps"] == 3
        assert entry["iterations"] == 1
        assert entry["stub"] is True

    def test_trace_entry_duration_precision(self):
        """duration_ms 保留 2 位小数。"""
        entry = _trace_entry("summarize", 1000.0, 1000.123456)
        assert entry["duration_ms"] == 123.46

    def test_trace_entry_iso_format(self):
        """start/end 为 ISO8601 格式 + Z 后缀。"""
        entry = _trace_entry("plan", 1700000000.0, 1700000000.5)
        assert entry["start"].endswith("Z")
        assert entry["end"].endswith("Z")
        assert "T" in entry["start"]

    def test_trace_entry_no_error_field_when_ok(self):
        """status=ok 时无 error 字段。"""
        entry = _trace_entry("plan", 1000.0, 1000.1)
        assert "error" not in entry


class TestWorkflowStateTrace:
    """WorkflowState trace 属性测试。"""

    def test_workflow_state_has_trace_attribute(self):
        """WorkflowState 初始化含 trace 空列表。"""
        state = WorkflowState("goal", "session-1")
        assert hasattr(state, "trace")
        assert state.trace == []

    def test_workflow_state_trace_mutable(self):
        """trace 列表可追加。"""
        state = WorkflowState("goal", "session-1")
        state.trace.append(_trace_entry("plan", 1.0, 1.5))
        assert len(state.trace) == 1
        assert state.trace[0]["node"] == "plan"


class TestGraphStateTrace:
    """GraphState trace 字段测试。"""

    def test_graph_state_accepts_trace_field(self):
        """GraphState 含 trace 字段。"""
        state: GraphState = {
            "goal": "test",
            "trace": [_trace_entry("plan", 1.0, 1.5)],
        }
        assert "trace" in state
        assert len(state["trace"]) == 1


class TestBuildResultWithTrace:
    """_build_result / _build_result_from_state 含 trace 字段测试。"""

    def setup_method(self):
        self.service = LangGraphService()

    def test_build_result_includes_trace(self):
        """_build_result 结果含 trace + trace_summary。"""
        state = WorkflowState("goal", "session-1")
        state.trace.append(_trace_entry("plan", 1.0, 1.5))
        state.trace.append(_trace_entry("execute", 1.5, 2.0, step=1))

        result = self.service._build_result(state)

        assert "trace" in result
        assert len(result["trace"]) == 2
        assert result["trace"][0]["node"] == "plan"
        assert result["trace"][1]["node"] == "execute"

    def test_build_result_includes_trace_summary(self):
        """_build_result 结果含 trace_summary。"""
        state = WorkflowState("goal", "session-1")
        state.trace.append(_trace_entry("plan", 1.0, 1.5))
        state.trace.append(_trace_entry("execute", 1.5, 2.0))

        result = self.service._build_result(state)

        assert "trace_summary" in result
        assert result["trace_summary"]["total_nodes"] == 2
        assert result["trace_summary"]["total_duration_ms"] == 1000.0  # 500 + 500
        assert result["trace_summary"]["nodes"] == ["plan", "execute"]

    def test_build_result_from_state_includes_trace(self):
        """_build_result_from_state 结果含 trace + trace_summary。"""
        state: GraphState = {
            "goal": "test",
            "status": "completed",
            "trace": [
                _trace_entry("plan", 1.0, 1.2),
                _trace_entry("execute", 1.2, 1.5, step=1),
                _trace_entry("summarize", 1.5, 1.8),
            ],
        }

        result = self.service._build_result_from_state(state)

        assert "trace" in result
        assert len(result["trace"]) == 3
        assert "trace_summary" in result
        assert result["trace_summary"]["total_nodes"] == 3
        assert result["trace_summary"]["nodes"] == ["plan", "execute", "summarize"]

    def test_build_result_empty_trace(self):
        """空 trace 时 trace_summary 字段仍存在。"""
        state = WorkflowState("goal", "session-1")
        result = self.service._build_result(state)

        assert result["trace"] == []
        assert result["trace_summary"]["total_nodes"] == 0
        assert result["trace_summary"]["total_duration_ms"] == 0
        assert result["trace_summary"]["nodes"] == []

    def test_build_result_from_state_empty_trace(self):
        """_build_result_from_state 空 trace 时 trace_summary 字段仍存在。"""
        result = self.service._build_result_from_state({})
        assert result["trace"] == []
        assert result["trace_summary"]["total_nodes"] == 0
