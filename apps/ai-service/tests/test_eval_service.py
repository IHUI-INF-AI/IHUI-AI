"""评估服务单元测试。"""

from __future__ import annotations

import pytest

from app.services.eval_service import (
    EvalResult,
    EvalRun,
    EvalService,
    _score_similarity,
)


@pytest.fixture
def service() -> EvalService:
    """干净的评估服务实例。"""
    s = EvalService()
    s.create_dataset(
        name="test-ds",
        items=[
            {"input": "你好", "expected_output": "你好世界"},
            {"input": "天气如何", "expected_output": "今天天气很好"},
        ],
        description="测试数据集",
    )
    return s


# ---------------------------------------------------------------------------
# _score_similarity
# ---------------------------------------------------------------------------


class TestScoreSimilarity:
    def test_exact_match(self) -> None:
        assert _score_similarity("hello world", "hello world") == 1.0

    def test_partial_match(self) -> None:
        score = _score_similarity("hello world", "hello there")
        assert 0.4 < score < 1.0

    def test_no_match(self) -> None:
        assert _score_similarity("abc", "xyz") == 0.0

    def test_empty_expected(self) -> None:
        assert _score_similarity("hello", "") == 1.0

    def test_empty_actual(self) -> None:
        assert _score_similarity("", "hello") == 0.0

    def test_both_empty(self) -> None:
        assert _score_similarity("", "") == 1.0

    def test_case_insensitive(self) -> None:
        assert _score_similarity("Hello World", "hello world") == 1.0

    def test_extra_words(self) -> None:
        score = _score_similarity("hello world foo bar", "hello world")
        assert score == 1.0


# ---------------------------------------------------------------------------
# create_dataset / get_dataset / list_datasets / delete_dataset
# ---------------------------------------------------------------------------


class TestDatasetCRUD:
    def test_create_and_get(self, service: EvalService) -> None:
        ds = service.get_dataset("test-ds")
        assert ds is not None
        assert ds["name"] == "test-ds"
        assert ds["item_count"] == 2
        assert ds["description"] == "测试数据集"

    def test_create_duplicate(self, service: EvalService) -> None:
        with pytest.raises(ValueError, match="数据集已存在"):
            service.create_dataset(name="test-ds", items=[{"input": "x"}])

    def test_list_datasets(self, service: EvalService) -> None:
        datasets = service.list_datasets()
        assert len(datasets) == 1
        assert datasets[0]["name"] == "test-ds"

    def test_get_nonexistent(self, service: EvalService) -> None:
        assert service.get_dataset("nonexistent") is None

    def test_delete_dataset(self, service: EvalService) -> None:
        ok = service.delete_dataset("test-ds")
        assert ok is True
        assert service.get_dataset("test-ds") is None

    def test_delete_nonexistent(self, service: EvalService) -> None:
        assert service.delete_dataset("nonexistent") is False

    def test_empty_dataset(self) -> None:
        s = EvalService()
        result = s.create_dataset(name="empty", items=[], description="空数据集")
        assert result["item_count"] == 0


# ---------------------------------------------------------------------------
# run_eval
# ---------------------------------------------------------------------------


class TestRunEval:
    async def test_run_eval_success(self, service: EvalService) -> None:
        async def mock_llm(messages: list, tools=None) -> dict:
            content = messages[-1].get("content", "") if messages else ""
            return {"content": f"response to {content}", "tool_calls": None}

        run = await service.run_eval(
            dataset_name="test-ds",
            model="test-model",
            prompt_name="test-prompt",
            llm_complete_fn=mock_llm,
        )

        assert run.id is not None
        assert run.dataset_name == "test-ds"
        assert run.model == "test-model"
        assert run.prompt_name == "test-prompt"
        assert len(run.results) == 2
        assert 0.0 <= run.avg_score <= 1.0
        assert run.total_duration_ms >= 0
        assert run.created_at is not None

    async def test_run_eval_nonexistent_dataset(self, service: EvalService) -> None:
        async def mock_llm(messages: list, tools=None) -> dict:
            return {"content": "response", "tool_calls": None}

        with pytest.raises(ValueError, match="数据集不存在"):
            await service.run_eval(
                dataset_name="nonexistent",
                model="test-model",
                prompt_name="test-prompt",
                llm_complete_fn=mock_llm,
            )

    async def test_run_eval_llm_error(self, service: EvalService) -> None:
        async def failing_llm(messages: list, tools=None) -> dict:
            msg = "LLM 调用失败"
            raise RuntimeError(msg)

        run = await service.run_eval(
            dataset_name="test-ds",
            model="test-model",
            prompt_name="test-prompt",
            llm_complete_fn=failing_llm,
        )

        assert len(run.results) == 2
        for r in run.results:
            assert r.error is not None
            assert r.score == 0.0

    async def test_run_eval_empty_dataset(self) -> None:
        s = EvalService()
        s.create_dataset(name="empty", items=[])

        async def mock_llm(messages: list, tools=None) -> dict:
            return {"content": "response", "tool_calls": None}

        run = await s.run_eval(
            dataset_name="empty",
            model="test-model",
            prompt_name="test-prompt",
            llm_complete_fn=mock_llm,
        )

        assert len(run.results) == 0
        assert run.avg_score == 0.0


# ---------------------------------------------------------------------------
# compare_runs
# ---------------------------------------------------------------------------


class TestCompareRuns:
    async def test_compare_two_runs(self, service: EvalService) -> None:
        async def mock_llm_a(messages: list, tools=None) -> dict:
            return {"content": "hello world", "tool_calls": None}

        async def mock_llm_b(messages: list, tools=None) -> dict:
            return {"content": "你好 世界", "tool_calls": None}

        run_a = await service.run_eval(
            dataset_name="test-ds", model="model-a", prompt_name="prompt-a",
            llm_complete_fn=mock_llm_a,
        )
        run_b = await service.run_eval(
            dataset_name="test-ds", model="model-b", prompt_name="prompt-b",
            llm_complete_fn=mock_llm_b,
        )

        result = service.compare_runs([run_a.id, run_b.id])
        assert len(result["runs"]) == 2
        assert "comparison" in result
        assert result["comparison"]["best_run"] in (run_a.id, run_b.id)
        assert result["comparison"]["score_spread"] >= 0

    def test_compare_no_runs(self, service: EvalService) -> None:
        result = service.compare_runs(["nonexistent"])
        assert len(result["runs"]) == 0
        assert result["comparison"] == {}


# ---------------------------------------------------------------------------
# list_runs / get_run
# ---------------------------------------------------------------------------


class TestRunQuery:
    async def test_list_runs(self, service: EvalService) -> None:
        async def mock_llm(messages: list, tools=None) -> dict:
            return {"content": "response", "tool_calls": None}

        await service.run_eval(
            dataset_name="test-ds", model="m", prompt_name="p",
            llm_complete_fn=mock_llm,
        )

        runs = service.list_runs()
        assert len(runs) == 1
        assert runs[0]["dataset_name"] == "test-ds"
        assert runs[0]["model"] == "m"
        assert runs[0]["item_count"] == 2

    async def test_get_run(self, service: EvalService) -> None:
        async def mock_llm(messages: list, tools=None) -> dict:
            return {"content": "response", "tool_calls": None}

        run = await service.run_eval(
            dataset_name="test-ds", model="m", prompt_name="p",
            llm_complete_fn=mock_llm,
        )

        fetched = service.get_run(run.id)
        assert fetched is not None
        assert fetched.id == run.id
        assert fetched.dataset_name == "test-ds"

    def test_get_nonexistent_run(self, service: EvalService) -> None:
        assert service.get_run("nonexistent") is None