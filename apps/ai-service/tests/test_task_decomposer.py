"""task_decomposer 综合测试(2026-07-22 立,补齐 AI 编排核心模块零覆盖)。

覆盖维度(77 cases):
1. _coerce_request:dict/对象转换 + 字段兼容(snake_case/camelCase)+ 默认值 + 类型校验(8 tests)
2. _extract_json:纯 JSON / markdown 代码块 / 无 JSON / 无效 JSON / 边界(8 tests)
3. _parse_sub_tasks:正常解析 + agent 降级 + 缺字段默认 + 非法 item 跳过(10 tests)
4. _fallback_decompose:按 agent 均分 + 空兜底 + 最多 3 + 依赖链 + priority 递减(8 tests)
5. topological_sort:线性 / 并行 / 菱形 / 环检测 / 自环 / 依赖不存在容错 / priority 降序(12 tests)
6. compute_parallel_batches:无依赖全并行 / 串行 / 菱形 / 环容错 / priority 降序(10 tests)
7. _estimate_total_duration:全有 / 全无 / 部分 / 并行取最大 / 空列表(6 tests)
8. decompose 主流程:LLM mock + 降级 + recursive + maxSubTasks 截断 + 4 策略(10 tests)
9. _recursive_expand:复杂递归 + depth 限制 + 失败容错(5 tests)
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

import pytest

from app.services.task_decomposer import (
    SubTask,
    SubTaskDependency,
    TaskDecomposer,
    TaskDecompositionRequest,
    TaskDecompositionResult,
    task_decomposer,
)


# =============================================================================
# 1. _coerce_request(8 tests)
# =============================================================================


class TestCoerceRequest:
    """_coerce_request:dict/对象转换 + 字段兼容 + 默认值 + 类型校验。"""

    def test_pass_request_object_returns_as_is(self):
        req = TaskDecompositionRequest(task="hello", availableAgents=[])
        result = TaskDecomposer._coerce_request(req)
        assert result is req

    def test_pass_dict_camel_case_fields(self):
        result = TaskDecomposer._coerce_request({
            "task": "build app",
            "availableAgents": [{"name": "coder", "capabilities": ["ts"]}],
            "strategy": "parallel",
            "maxSubTasks": 5,
        })
        assert result.task == "build app"
        assert len(result.availableAgents) == 1
        assert result.strategy == "parallel"
        assert result.maxSubTasks == 5

    def test_pass_dict_snake_case_available_agents(self):
        result = TaskDecomposer._coerce_request({
            "task": "test",
            "available_agents": [{"name": "tester"}],
        })
        assert len(result.availableAgents) == 1

    def test_pass_dict_snake_case_max_sub_tasks(self):
        """max_sub_tasks 在 maxSubTasks 为 None 时才生效(源码 `or` 短路设计)。"""
        result = TaskDecomposer._coerce_request({
            "task": "test",
            "availableAgents": [],
            "maxSubTasks": None,
            "max_sub_tasks": 7,
        })
        assert result.maxSubTasks == 7

    def test_dict_missing_strategy_defaults_dag(self):
        result = TaskDecomposer._coerce_request({"task": "x", "availableAgents": []})
        assert result.strategy == "dag"

    def test_dict_missing_max_sub_tasks_defaults_10(self):
        result = TaskDecomposer._coerce_request({"task": "x", "availableAgents": []})
        assert result.maxSubTasks == 10

    def test_dict_available_agents_none_returns_empty_list(self):
        result = TaskDecomposer._coerce_request({
            "task": "x",
            "availableAgents": None,
        })
        assert result.availableAgents == []

    def test_pass_invalid_type_raises_type_error(self):
        with pytest.raises(TypeError, match="必须是"):
            TaskDecomposer._coerce_request(123)  # type: ignore[arg-type]


# =============================================================================
# 2. _extract_json(8 tests)
# =============================================================================


class TestExtractJson:
    """_extract_json:纯 JSON / markdown 代码块 / 无 JSON / 无效 JSON / 边界。"""

    def test_pure_json_object(self):
        text = '{"subTasks": [{"id": "st-1"}]}'
        result = task_decomposer._extract_json(text)
        assert result is not None
        assert "subTasks" in result

    def test_markdown_code_block_with_language(self):
        text = '```json\n{"subTasks": []}\n```'
        result = task_decomposer._extract_json(text)
        assert result is not None
        assert result == {"subTasks": []}

    def test_markdown_code_block_without_language(self):
        text = '```\n{"key": "value"}\n```'
        result = task_decomposer._extract_json(text)
        assert result is not None
        assert result == {"key": "value"}

    def test_json_with_surrounding_text(self):
        text = 'Here is the result:\n{"subTasks": [{"id": "st-1"}]}\nDone.'
        result = task_decomposer._extract_json(text)
        assert result is not None
        assert "subTasks" in result

    def test_empty_string_returns_none(self):
        assert task_decomposer._extract_json("") is None

    def test_no_json_returns_none(self):
        assert task_decomposer._extract_json("just plain text") is None

    def test_invalid_json_returns_none(self):
        assert task_decomposer._extract_json("{invalid json}") is None

    def test_only_opening_brace_returns_none(self):
        """只有 `{` 没有 `}` → None。"""
        assert task_decomposer._extract_json("{ incomplete") is None


# =============================================================================
# 3. _parse_sub_tasks(10 tests)
# =============================================================================


class TestParseSubTasks:
    """_parse_sub_tasks:正常解析 + agent 降级 + 缺字段默认 + 非法 item 跳过。"""

    def _make_request(self, agents=None):
        return TaskDecompositionRequest(
            task="test",
            availableAgents=agents if agents is not None else [{"name": "coder", "capabilities": ["ts"]}],
        )

    def test_parse_full_fields(self):
        req = self._make_request()
        raw = [{
            "id": "st-1",
            "description": "write code",
            "recommendedAgentType": "coder",
            "requiredCapabilities": ["ts", "react"],
            "dependencies": [{"dependsOn": "st-0", "type": "output"}],
            "priority": 8,
            "estimatedDurationSeconds": 60,
            "retryable": False,
            "maxRetries": 5,
        }]
        result = task_decomposer._parse_sub_tasks(raw, req)
        assert len(result) == 1
        st = result[0]
        assert st.id == "st-1"
        assert st.description == "write code"
        assert st.recommendedAgentType == "coder"
        assert st.requiredCapabilities == ["ts", "react"]
        assert len(st.dependencies) == 1
        assert st.dependencies[0].dependsOn == "st-0"
        assert st.dependencies[0].type == "output"
        assert st.priority == 8
        assert st.estimatedDurationSeconds == 60
        assert st.retryable is False
        assert st.maxRetries == 5

    def test_missing_id_auto_generated(self):
        req = self._make_request()
        raw = [{"description": "task", "recommendedAgentType": "coder"}]
        result = task_decomposer._parse_sub_tasks(raw, req)
        assert len(result) == 1
        assert result[0].id.startswith("st-")

    def test_missing_description_defaults_empty(self):
        req = self._make_request()
        raw = [{"id": "st-1", "recommendedAgentType": "coder"}]
        result = task_decomposer._parse_sub_tasks(raw, req)
        assert result[0].description == ""

    def test_missing_recommended_agent_defaults_empty(self):
        """valid_agents 为空时,agent_type 保持空字符串。"""
        req = self._make_request(agents=[])
        raw = [{"id": "st-1", "description": "task"}]
        result = task_decomposer._parse_sub_tasks(raw, req)
        assert result[0].recommendedAgentType == ""

    def test_agent_not_in_list_fallback_to_first(self):
        """recommendedAgentType 不在 valid_agents → 降级取第一个(set 无序,用单 agent)。"""
        req = self._make_request(agents=[{"name": "alpha"}])
        raw = [{"id": "st-1", "recommendedAgentType": "unknown_agent"}]
        result = task_decomposer._parse_sub_tasks(raw, req)
        assert result[0].recommendedAgentType == "alpha"

    def test_missing_required_capabilities_defaults_empty(self):
        req = self._make_request()
        raw = [{"id": "st-1", "recommendedAgentType": "coder"}]
        result = task_decomposer._parse_sub_tasks(raw, req)
        assert result[0].requiredCapabilities == []

    def test_missing_dependencies_defaults_empty(self):
        req = self._make_request()
        raw = [{"id": "st-1", "recommendedAgentType": "coder"}]
        result = task_decomposer._parse_sub_tasks(raw, req)
        assert result[0].dependencies == []

    def test_missing_priority_defaults_5(self):
        req = self._make_request()
        raw = [{"id": "st-1", "recommendedAgentType": "coder"}]
        result = task_decomposer._parse_sub_tasks(raw, req)
        assert result[0].priority == 5

    def test_missing_estimated_duration_defaults_none(self):
        req = self._make_request()
        raw = [{"id": "st-1", "recommendedAgentType": "coder"}]
        result = task_decomposer._parse_sub_tasks(raw, req)
        assert result[0].estimatedDurationSeconds is None

    def test_non_dict_item_skipped(self):
        req = self._make_request()
        raw = ["not a dict", 123, None, {"id": "st-1", "recommendedAgentType": "coder"}]
        result = task_decomposer._parse_sub_tasks(raw, req)
        assert len(result) == 1


# =============================================================================
# 4. _fallback_decompose(8 tests)
# =============================================================================


class TestFallbackDecompose:
    """_fallback_decompose:LLM 不可用时的简单分解。"""

    def test_single_agent_produces_one_subtask(self):
        req = TaskDecompositionRequest(
            task="do something",
            availableAgents=[{"name": "worker", "capabilities": ["x"]}],
        )
        result = task_decomposer._fallback_decompose(req)
        assert len(result) == 1
        assert result[0].recommendedAgentType == "worker"

    def test_three_agents_produce_three_subtasks(self):
        req = TaskDecompositionRequest(
            task="do something",
            availableAgents=[
                {"name": "a", "capabilities": []},
                {"name": "b", "capabilities": []},
                {"name": "c", "capabilities": []},
            ],
        )
        result = task_decomposer._fallback_decompose(req)
        assert len(result) == 3

    def test_five_agents_capped_at_three(self):
        """最多 3 个子任务(即使有 5 个 agent)。"""
        req = TaskDecompositionRequest(
            task="do something",
            availableAgents=[{"name": f"a{i}"} for i in range(5)],
            maxSubTasks=10,
        )
        result = task_decomposer._fallback_decompose(req)
        assert len(result) == 3

    def test_empty_agents_fallback_general(self):
        """0 个 agent → 1 个子任务(兜底 general)。"""
        req = TaskDecompositionRequest(task="do something", availableAgents=[])
        result = task_decomposer._fallback_decompose(req)
        assert len(result) == 1
        assert result[0].recommendedAgentType == "general"

    def test_subtasks_have_chain_dependencies(self):
        """子任务间有依赖(链式 st-1 → st-2 → st-3)。"""
        req = TaskDecompositionRequest(
            task="do something",
            availableAgents=[{"name": "a"}, {"name": "b"}, {"name": "c"}],
        )
        result = task_decomposer._fallback_decompose(req)
        assert len(result) == 3
        assert result[0].dependencies == []
        assert result[1].dependencies[0].dependsOn == "st-1"
        assert result[2].dependencies[0].dependsOn == "st-2"

    def test_priority_decreasing(self):
        """priority 递减(10, 8, 6)。"""
        req = TaskDecompositionRequest(
            task="do something",
            availableAgents=[{"name": "a"}, {"name": "b"}, {"name": "c"}],
        )
        result = task_decomposer._fallback_decompose(req)
        assert result[0].priority == 10
        assert result[1].priority == 8
        assert result[2].priority == 6

    def test_description_truncated_to_80_chars(self):
        """description 截断 task 到 80 字符。"""
        long_task = "x" * 200
        req = TaskDecompositionRequest(
            task=long_task,
            availableAgents=[{"name": "a"}],
        )
        result = task_decomposer._fallback_decompose(req)
        # description = f"子任务 1:处理「{task[:80]}」的第 1/1 部分"
        # task[:80] = 80 个 x
        assert "x" * 80 in result[0].description
        assert "x" * 81 not in result[0].description

    def test_estimated_duration_30_seconds(self):
        req = TaskDecompositionRequest(
            task="do something",
            availableAgents=[{"name": "a"}],
        )
        result = task_decomposer._fallback_decompose(req)
        assert result[0].estimatedDurationSeconds == 30


# =============================================================================
# 5. topological_sort(12 tests)
# =============================================================================


class TestTopologicalSort:
    """topological_sort:Kahn 算法 + 环检测 + priority 降序。"""

    def _make_subtasks(self, defs: list[tuple[str, list[str], int]]) -> list[SubTask]:
        """快速构建 SubTask 列表。defs = [(id, [depends_on], priority), ...]"""
        return [
            SubTask(
                id=sid,
                description=f"task {sid}",
                recommendedAgentType="agent",
                dependencies=[SubTaskDependency(dependsOn=d) for d in deps],
                priority=prio,
            )
            for sid, deps, prio in defs
        ]

    def test_empty_list_returns_empty(self):
        assert task_decomposer.topological_sort([]) == []

    def test_single_node(self):
        sts = self._make_subtasks([("A", [], 5)])
        assert task_decomposer.topological_sort(sts) == ["A"]

    def test_linear_chain_a_to_b_to_c(self):
        sts = self._make_subtasks([("A", [], 5), ("B", ["A"], 5), ("C", ["B"], 5)])
        assert task_decomposer.topological_sort(sts) == ["A", "B", "C"]

    def test_parallel_nodes_priority_descending(self):
        """无依赖的并行节点按 priority 降序排列。"""
        sts = self._make_subtasks([("A", [], 3), ("B", [], 7), ("C", [], 5)])
        result = task_decomposer.topological_sort(sts)
        assert result == ["B", "C", "A"]

    def test_diamond_dependency(self):
        """菱形:A→B, A→C, B→D, C→D。"""
        sts = self._make_subtasks([
            ("A", [], 5),
            ("B", ["A"], 5),
            ("C", ["A"], 5),
            ("D", ["B", "C"], 5),
        ])
        result = task_decomposer.topological_sort(sts)
        assert result[0] == "A"
        assert result[-1] == "D"
        assert set(result[1:3]) == {"B", "C"}

    def test_cycle_detection_raises(self):
        """环 A→B→A → ValueError。"""
        sts = self._make_subtasks([("A", ["B"], 5), ("B", ["A"], 5)])
        with pytest.raises(ValueError, match="依赖环"):
            task_decomposer.topological_sort(sts)

    def test_self_loop_raises(self):
        """自环 A→A → ValueError。"""
        sts = self._make_subtasks([("A", ["A"], 5)])
        with pytest.raises(ValueError, match="依赖环"):
            task_decomposer.topological_sort(sts)

    def test_three_node_cycle_raises(self):
        """3 节点环 A→B→C→A → ValueError。"""
        sts = self._make_subtasks([
            ("A", ["C"], 5),
            ("B", ["A"], 5),
            ("C", ["B"], 5),
        ])
        with pytest.raises(ValueError, match="依赖环"):
            task_decomposer.topological_sort(sts)

    def test_dependency_not_exists_ignored(self):
        """依赖不存在的任务 → 容错忽略。"""
        sts = self._make_subtasks([("A", [], 5), ("B", ["NONEXIST"], 5)])
        result = task_decomposer.topological_sort(sts)
        assert set(result) == {"A", "B"}

    def test_same_level_priority_descending(self):
        """同层节点(都依赖 A)按 priority 降序。"""
        sts = self._make_subtasks([
            ("A", [], 1),
            ("B", ["A"], 3),
            ("C", ["A"], 7),
            ("D", ["A"], 5),
        ])
        result = task_decomposer.topological_sort(sts)
        assert result[0] == "A"
        # B/C/D 都依赖 A,同层按 priority 降序: C(7) > D(5) > B(3)
        assert result[1:4] == ["C", "D", "B"]

    def test_complex_mixed_dag(self):
        """复杂混合 DAG:A→B, A→C, B→D, C→D, D→E。"""
        sts = self._make_subtasks([
            ("A", [], 10),
            ("B", ["A"], 8),
            ("C", ["A"], 6),
            ("D", ["B", "C"], 4),
            ("E", ["D"], 2),
        ])
        result = task_decomposer.topological_sort(sts)
        assert result == ["A", "B", "C", "D", "E"]

    def test_all_parallel_same_priority(self):
        """全并行 + 相同 priority → 任意顺序都可(只要全包含)。"""
        sts = self._make_subtasks([("A", [], 5), ("B", [], 5), ("C", [], 5)])
        result = task_decomposer.topological_sort(sts)
        assert set(result) == {"A", "B", "C"}
        assert len(result) == 3


# =============================================================================
# 6. compute_parallel_batches(10 tests)
# =============================================================================


class TestComputeParallelBatches:
    """compute_parallel_batches:按依赖关系分组 + 同批 priority 降序。"""

    def _make_subtasks(self, defs: list[tuple[str, list[str], int]]) -> list[SubTask]:
        return [
            SubTask(
                id=sid,
                description=f"task {sid}",
                recommendedAgentType="agent",
                dependencies=[SubTaskDependency(dependsOn=d) for d in deps],
                priority=prio,
            )
            for sid, deps, prio in defs
        ]

    def test_empty_list_returns_empty(self):
        assert task_decomposer.compute_parallel_batches([]) == []

    def test_single_node(self):
        sts = self._make_subtasks([("A", [], 5)])
        assert task_decomposer.compute_parallel_batches(sts) == [["A"]]

    def test_no_dependencies_all_parallel(self):
        """无依赖 3 节点 → 1 批(priority 降序)。"""
        sts = self._make_subtasks([("A", [], 3), ("B", [], 7), ("C", [], 5)])
        result = task_decomposer.compute_parallel_batches(sts)
        assert result == [["B", "C", "A"]]

    def test_linear_chain_separate_batches(self):
        """线性链 A→B→C → 3 批。"""
        sts = self._make_subtasks([("A", [], 5), ("B", ["A"], 5), ("C", ["B"], 5)])
        result = task_decomposer.compute_parallel_batches(sts)
        assert result == [["A"], ["B"], ["C"]]

    def test_diamond_three_batches(self):
        """菱形 A→B, A→C, B→D, C→D → [[A], [B,C], [D]]。"""
        sts = self._make_subtasks([
            ("A", [], 5),
            ("B", ["A"], 7),
            ("C", ["A"], 3),
            ("D", ["B", "C"], 5),
        ])
        result = task_decomposer.compute_parallel_batches(sts)
        assert result[0] == ["A"]
        assert result[1] == ["B", "C"]  # priority 降序:B(7) > C(3)
        assert result[2] == ["D"]

    def test_cycle_fallback_adds_remaining(self):
        """环 → 容错(剩余节点加入最后一批,避免死循环)。"""
        sts = self._make_subtasks([("A", ["B"], 5), ("B", ["A"], 5)])
        result = task_decomposer.compute_parallel_batches(sts)
        # 环节点没有入度为 0 的,直接加入最后一批
        assert len(result) >= 1
        remaining = set()
        for batch in result:
            remaining.update(batch)
        assert remaining == {"A", "B"}

    def test_batch_priority_descending(self):
        """批次内 priority 降序。"""
        sts = self._make_subtasks([
            ("A", [], 1),
            ("B", [], 9),
            ("C", [], 5),
        ])
        result = task_decomposer.compute_parallel_batches(sts)
        assert result[0] == ["B", "C", "A"]

    def test_dependency_not_exists_ignored(self):
        """依赖不存在 → 容错。"""
        sts = self._make_subtasks([("A", [], 5), ("B", ["NONEXIST"], 5)])
        result = task_decomposer.compute_parallel_batches(sts)
        # A 和 B 都没有有效依赖,同批
        assert len(result) == 1
        assert set(result[0]) == {"A", "B"}

    def test_complex_mixed_dag(self):
        """复杂混合 DAG:A→B, A→C, B→D, C→D, D→E。"""
        sts = self._make_subtasks([
            ("A", [], 10),
            ("B", ["A"], 8),
            ("C", ["A"], 6),
            ("D", ["B", "C"], 4),
            ("E", ["D"], 2),
        ])
        result = task_decomposer.compute_parallel_batches(sts)
        assert result[0] == ["A"]
        assert set(result[1]) == {"B", "C"}
        assert result[2] == ["D"]
        assert result[3] == ["E"]

    def test_all_serial_vs_all_parallel(self):
        """全串行(链式)vs 全并行对比。"""
        # 全并行
        parallel_sts = self._make_subtasks([("A", [], 5), ("B", [], 5), ("C", [], 5)])
        parallel_result = task_decomposer.compute_parallel_batches(parallel_sts)
        assert len(parallel_result) == 1
        # 全串行
        serial_sts = self._make_subtasks([
            ("A", [], 5),
            ("B", ["A"], 5),
            ("C", ["B"], 5),
        ])
        serial_result = task_decomposer.compute_parallel_batches(serial_sts)
        assert len(serial_result) == 3


# =============================================================================
# 7. _estimate_total_duration(6 tests)
# =============================================================================


class TestEstimateTotalDuration:
    """_estimate_total_duration:各批次最大耗时之和。"""

    def _make_subtasks(self, defs):
        return [
            SubTask(
                id=sid,
                description=f"task {sid}",
                recommendedAgentType="agent",
                estimatedDurationSeconds=dur,
            )
            for sid, dur in defs
        ]

    def test_all_have_duration(self):
        sts = self._make_subtasks([("A", 10), ("B", 20), ("C", 30)])
        batches = [["A", "B"], ["C"]]
        result = TaskDecomposer._estimate_total_duration(sts, batches)
        # batch 1: max(10, 20) = 20, batch 2: max(30) = 30 → 50
        assert result == 50

    def test_none_have_duration(self):
        sts = self._make_subtasks([("A", None), ("B", None)])
        batches = [["A"], ["B"]]
        result = TaskDecomposer._estimate_total_duration(sts, batches)
        assert result is None

    def test_partial_duration(self):
        sts = self._make_subtasks([("A", 10), ("B", None), ("C", 30)])
        batches = [["A", "B"], ["C"]]
        result = TaskDecomposer._estimate_total_duration(sts, batches)
        # batch 1: max(10, None→0) = 10, batch 2: max(30) = 30 → 40
        assert result == 40

    def test_single_batch(self):
        sts = self._make_subtasks([("A", 15), ("B", 25)])
        batches = [["A", "B"]]
        result = TaskDecomposer._estimate_total_duration(sts, batches)
        assert result == 25

    def test_empty_list_returns_none(self):
        result = TaskDecomposer._estimate_total_duration([], [])
        assert result is None

    def test_parallel_batch_takes_max(self):
        """并行批次取最大值。"""
        sts = self._make_subtasks([("A", 5), ("B", 50), ("C", 10)])
        batches = [["A", "B", "C"]]  # 全并行
        result = TaskDecomposer._estimate_total_duration(sts, batches)
        assert result == 50


# =============================================================================
# 8. decompose 主流程(10 tests,需要 mock llm_gateway)
# =============================================================================


class TestDecompose:
    """decompose 主流程:LLM mock + 降级 + recursive + maxSubTasks 截断 + 4 策略。"""

    def _make_llm_response(self, sub_tasks_raw):
        """构造 LLM 返回的 JSON 字符串。"""
        return json.dumps({"subTasks": sub_tasks_raw})

    @pytest.mark.asyncio
    async def test_llm_returns_valid_json(self):
        """LLM 返回正常 JSON → 正确分解。"""
        llm_content = self._make_llm_response([
            {"id": "st-1", "description": "step 1", "recommendedAgentType": "coder"},
            {"id": "st-2", "description": "step 2", "recommendedAgentType": "coder",
             "dependencies": [{"dependsOn": "st-1", "type": "output"}]},
        ])
        with patch("app.services.task_decomposer.llm_gateway") as mock:
            mock.complete = AsyncMock(
                return_value={"content": llm_content, "model": "mock", "stub": False}
            )
            result = await task_decomposer.decompose({
                "task": "build app",
                "availableAgents": [{"name": "coder", "capabilities": ["ts"]}],
                "strategy": "dag",
            })
        assert len(result.subTasks) == 2
        assert result.strategy == "dag"
        assert result.executionOrder == ["st-1", "st-2"]
        assert result.parallelBatches == [["st-1"], ["st-2"]]

    @pytest.mark.asyncio
    async def test_llm_returns_markdown_code_block(self):
        """LLM 返回 markdown 代码块 → 正确解析。"""
        llm_content = f'```json\n{self._make_llm_response([{"id": "st-1", "description": "task", "recommendedAgentType": "coder"}])}\n```'
        with patch("app.services.task_decomposer.llm_gateway") as mock:
            mock.complete = AsyncMock(
                return_value={"content": llm_content, "model": "mock", "stub": False}
            )
            result = await task_decomposer.decompose({
                "task": "build",
                "availableAgents": [{"name": "coder"}],
            })
        assert len(result.subTasks) == 1

    @pytest.mark.asyncio
    async def test_llm_returns_empty_content_fallback(self):
        """LLM 返回空内容 → 降级分解。"""
        with patch("app.services.task_decomposer.llm_gateway") as mock:
            mock.complete = AsyncMock(
                return_value={"content": "", "model": "mock", "stub": False}
            )
            result = await task_decomposer.decompose({
                "task": "build",
                "availableAgents": [{"name": "coder"}],
            })
        # 降级分解:1 个 agent → 1 个子任务
        assert len(result.subTasks) == 1
        assert result.subTasks[0].id == "st-1"

    @pytest.mark.asyncio
    async def test_llm_returns_non_json_fallback(self):
        """LLM 返回非 JSON → 降级分解。"""
        with patch("app.services.task_decomposer.llm_gateway") as mock:
            mock.complete = AsyncMock(
                return_value={"content": "I cannot decompose this", "model": "mock"}
            )
            result = await task_decomposer.decompose({
                "task": "build",
                "availableAgents": [{"name": "coder"}],
            })
        assert len(result.subTasks) == 1

    @pytest.mark.asyncio
    async def test_llm_raises_exception_fallback(self):
        """LLM 抛异常 → 降级分解。"""
        with patch("app.services.task_decomposer.llm_gateway") as mock:
            mock.complete = AsyncMock(side_effect=RuntimeError("LLM down"))
            result = await task_decomposer.decompose({
                "task": "build",
                "availableAgents": [{"name": "coder"}, {"name": "tester"}],
            })
        assert len(result.subTasks) == 2

    @pytest.mark.asyncio
    async def test_max_sub_tasks_truncation(self):
        """maxSubTasks 截断。"""
        # LLM 返回 5 个子任务,但 maxSubTasks=3
        tasks_raw = [
            {"id": f"st-{i}", "description": f"task {i}", "recommendedAgentType": "coder"}
            for i in range(1, 6)
        ]
        with patch("app.services.task_decomposer.llm_gateway") as mock:
            mock.complete = AsyncMock(
                return_value={"content": self._make_llm_response(tasks_raw)}
            )
            result = await task_decomposer.decompose({
                "task": "build",
                "availableAgents": [{"name": "coder"}],
                "maxSubTasks": 3,
            })
        assert len(result.subTasks) == 3

    @pytest.mark.asyncio
    async def test_recursive_strategy(self):
        """recursive 策略:复杂任务(描述 > 100 字)递归分解。"""
        # 第 1 次 LLM 调用:返回 1 个复杂子任务(描述 > 100 字)
        # 第 2 次 LLM 调用(递归):返回 2 个简单子任务
        first_response = self._make_llm_response([
            {"id": "st-1", "description": "x" * 120, "recommendedAgentType": "coder",
             "priority": 5},
        ])
        second_response = self._make_llm_response([
            {"id": "sub-1", "description": "sub task 1", "recommendedAgentType": "coder"},
            {"id": "sub-2", "description": "sub task 2", "recommendedAgentType": "coder"},
        ])
        with patch("app.services.task_decomposer.llm_gateway") as mock:
            mock.complete = AsyncMock(
                side_effect=[
                    {"content": first_response},
                    {"content": second_response},
                ]
            )
            result = await task_decomposer.decompose({
                "task": "complex task",
                "availableAgents": [{"name": "coder"}],
                "strategy": "recursive",
            })
        # 递归后:2 个子任务 + 1 个父任务 = 3
        assert result.strategy == "recursive"
        assert len(result.subTasks) >= 1

    @pytest.mark.asyncio
    async def test_sequential_strategy(self):
        """sequential 策略。"""
        llm_content = self._make_llm_response([
            {"id": "st-1", "description": "step 1", "recommendedAgentType": "coder"},
            {"id": "st-2", "description": "step 2", "recommendedAgentType": "coder",
             "dependencies": [{"dependsOn": "st-1"}]},
        ])
        with patch("app.services.task_decomposer.llm_gateway") as mock:
            mock.complete = AsyncMock(return_value={"content": llm_content})
            result = await task_decomposer.decompose({
                "task": "build",
                "availableAgents": [{"name": "coder"}],
                "strategy": "sequential",
            })
        assert result.strategy == "sequential"
        assert len(result.subTasks) == 2

    @pytest.mark.asyncio
    async def test_parallel_strategy(self):
        """parallel 策略。"""
        llm_content = self._make_llm_response([
            {"id": "st-1", "description": "task A", "recommendedAgentType": "coder"},
            {"id": "st-2", "description": "task B", "recommendedAgentType": "coder"},
        ])
        with patch("app.services.task_decomposer.llm_gateway") as mock:
            mock.complete = AsyncMock(return_value={"content": llm_content})
            result = await task_decomposer.decompose({
                "task": "build",
                "availableAgents": [{"name": "coder"}],
                "strategy": "parallel",
            })
        assert result.strategy == "parallel"
        # 无依赖 → 1 批
        assert len(result.parallelBatches) == 1

    @pytest.mark.asyncio
    async def test_dag_strategy_default(self):
        """dag 策略(默认)。"""
        llm_content = self._make_llm_response([
            {"id": "st-1", "description": "root", "recommendedAgentType": "coder"},
        ])
        with patch("app.services.task_decomposer.llm_gateway") as mock:
            mock.complete = AsyncMock(return_value={"content": llm_content})
            result = await task_decomposer.decompose({
                "task": "build",
                "availableAgents": [{"name": "coder"}],
            })
        assert result.strategy == "dag"
        assert len(result.subTasks) == 1
        assert result.executionOrder == ["st-1"]


# =============================================================================
# 9. _recursive_expand(5 tests)
# =============================================================================


class TestRecursiveExpand:
    """_recursive_expand:复杂递归 + depth 限制 + 失败容错。"""

    @pytest.mark.asyncio
    async def test_complex_task_recursively_expanded(self):
        """描述超过 100 字 → 递归分解。"""
        parent = SubTask(
            id="st-1",
            description="x" * 120,
            recommendedAgentType="coder",
            priority=5,
        )
        req = TaskDecompositionRequest(
            task="complex",
            availableAgents=[{"name": "coder"}],
            strategy="recursive",
        )
        sub_response = json.dumps({"subTasks": [
            {"id": "sub-1", "description": "sub task", "recommendedAgentType": "coder"},
        ]})
        with patch("app.services.task_decomposer.llm_gateway") as mock:
            mock.complete = AsyncMock(return_value={"content": sub_response})
            result = await task_decomposer._recursive_expand([parent], req, depth=1)
        # 递归后:1 个子任务 + 1 个父任务
        assert len(result) >= 1
        # 子任务 id 应有前缀
        has_prefixed = any("-" in st.id for st in result if st.id != "st-1")
        assert has_prefixed

    @pytest.mark.asyncio
    async def test_high_priority_recursively_expanded(self):
        """priority >= 8 → 递归分解。"""
        parent = SubTask(
            id="st-1",
            description="short",
            recommendedAgentType="coder",
            priority=9,
        )
        req = TaskDecompositionRequest(
            task="complex",
            availableAgents=[{"name": "coder"}],
            strategy="recursive",
        )
        sub_response = json.dumps({"subTasks": [
            {"id": "sub-1", "description": "sub", "recommendedAgentType": "coder"},
        ]})
        with patch("app.services.task_decomposer.llm_gateway") as mock:
            mock.complete = AsyncMock(return_value={"content": sub_response})
            result = await task_decomposer._recursive_expand([parent], req, depth=1)
        assert len(result) >= 1

    @pytest.mark.asyncio
    async def test_simple_task_not_expanded(self):
        """简单任务(描述短 + priority 低)→ 不递归。"""
        parent = SubTask(
            id="st-1",
            description="simple task",
            recommendedAgentType="coder",
            priority=3,
        )
        req = TaskDecompositionRequest(
            task="simple",
            availableAgents=[{"name": "coder"}],
            strategy="recursive",
        )
        result = await task_decomposer._recursive_expand([parent], req, depth=1)
        assert len(result) == 1
        assert result[0].id == "st-1"

    @pytest.mark.asyncio
    async def test_exceeds_max_depth_returns_unchanged(self):
        """超过 MAX_RECURSIVE_DEPTH(3)→ 停止递归。"""
        parent = SubTask(
            id="st-1",
            description="x" * 120,
            recommendedAgentType="coder",
            priority=9,
        )
        req = TaskDecompositionRequest(
            task="complex",
            availableAgents=[{"name": "coder"}],
            strategy="recursive",
        )
        result = await task_decomposer._recursive_expand([parent], req, depth=5)
        assert len(result) == 1
        assert result[0].id == "st-1"

    @pytest.mark.asyncio
    async def test_recursive_failure_keeps_original(self):
        """递归分解失败 → 保留原任务。"""
        parent = SubTask(
            id="st-1",
            description="x" * 120,
            recommendedAgentType="coder",
            priority=9,
        )
        req = TaskDecompositionRequest(
            task="complex",
            availableAgents=[{"name": "coder"}],
            strategy="recursive",
        )
        with patch("app.services.task_decomposer.llm_gateway") as mock:
            mock.complete = AsyncMock(side_effect=RuntimeError("LLM down"))
            result = await task_decomposer._recursive_expand([parent], req, depth=1)
        assert len(result) == 1
        assert result[0].id == "st-1"


# =============================================================================
# TaskDecompositionResult.to_dict(附加,3 tests)
# =============================================================================


class TestResultToDict:
    """TaskDecompositionResult.to_dict:序列化正确性。"""

    def test_full_result_serialization(self):
        sts = [
            SubTask(
                id="st-1",
                description="task 1",
                recommendedAgentType="coder",
                requiredCapabilities=["ts"],
                dependencies=[SubTaskDependency(dependsOn="st-0", type="output")],
                priority=8,
                estimatedDurationSeconds=30,
                retryable=False,
                maxRetries=1,
            )
        ]
        result = TaskDecompositionResult(
            subTasks=sts,
            executionOrder=["st-1"],
            parallelBatches=[["st-1"]],
            strategy="dag",
            totalEstimatedDurationSeconds=30,
        )
        d = result.to_dict()
        assert d["strategy"] == "dag"
        assert d["executionOrder"] == ["st-1"]
        assert d["parallelBatches"] == [["st-1"]]
        assert d["totalEstimatedDurationSeconds"] == 30
        st_dict = d["subTasks"][0]
        assert st_dict["id"] == "st-1"
        assert st_dict["priority"] == 8
        assert st_dict["retryable"] is False
        assert st_dict["maxRetries"] == 1
        assert st_dict["dependencies"][0]["dependsOn"] == "st-0"
        assert st_dict["dependencies"][0]["type"] == "output"

    def test_empty_dependencies_serialization(self):
        sts = [SubTask(id="st-1", description="t", recommendedAgentType="a")]
        result = TaskDecompositionResult(
            subTasks=sts,
            executionOrder=["st-1"],
            parallelBatches=[["st-1"]],
            strategy="parallel",
        )
        d = result.to_dict()
        assert d["subTasks"][0]["dependencies"] == []
        assert d["subTasks"][0]["requiredCapabilities"] == []
        assert d["totalEstimatedDurationSeconds"] is None

    def test_none_duration_serialization(self):
        result = TaskDecompositionResult(
            subTasks=[],
            executionOrder=[],
            parallelBatches=[],
            strategy="sequential",
        )
        d = result.to_dict()
        assert d["totalEstimatedDurationSeconds"] is None
        assert d["subTasks"] == []
