"""评估服务 — 数据集管理 + 自动化评估 + 回归测试。

设计:
- EvalDataset: 评估数据集(name, description, items[{input, expected_output}])
- EvalRun: 一次评估运行(dataset, model, prompt, results[{input, actual_output, score}])
- 支持对比: 相同数据集在不同模型/prompt 下的效果
- 评分: 简单字符串相似度 + LLM 评判(可选)
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable

logger = logging.getLogger(__name__)


@dataclass
class EvalItem:
    """评估数据集中的单个条目。"""

    input: str
    expected_output: str = ""


@dataclass
class EvalResult:
    """单次评估结果。"""

    input: str
    expected_output: str
    actual_output: str
    score: float  # 0.0 - 1.0
    duration_ms: float = 0.0
    error: str | None = None


@dataclass
class EvalRun:
    """一次评估运行记录。"""

    id: str
    dataset_name: str
    model: str
    prompt_name: str
    results: list[EvalResult]
    avg_score: float
    total_duration_ms: float
    created_at: str


class EvalService:
    """评估服务 — 数据集管理 + 自动化评估 + 运行对比。"""

    def __init__(self) -> None:
        self._datasets: dict[str, list[EvalItem]] = {}
        self._runs: list[EvalRun] = []
        self._dataset_metadata: dict[str, dict[str, str]] = {}

    def create_dataset(
        self, name: str, items: list[dict], description: str = ""
    ) -> dict:
        """创建评估数据集。"""
        if name in self._datasets:
            raise ValueError(f"数据集已存在: {name}")
        eval_items = [
            EvalItem(input=item.get("input", ""), expected_output=item.get("expected_output", ""))
            for item in items
        ]
        self._datasets[name] = eval_items
        self._dataset_metadata[name] = {"name": name, "description": description}
        return {
            "name": name,
            "description": description,
            "item_count": len(eval_items),
        }

    def get_dataset(self, name: str) -> dict | None:
        """获取数据集详情。"""
        items = self._datasets.get(name)
        if items is None:
            return None
        meta = self._dataset_metadata.get(name, {})
        return {
            "name": name,
            "description": meta.get("description", ""),
            "items": [
                {"input": item.input, "expected_output": item.expected_output}
                for item in items
            ],
            "item_count": len(items),
        }

    def list_datasets(self) -> list[dict]:
        """列出所有数据集。"""
        return [
            {
                "name": name,
                "description": self._dataset_metadata.get(name, {}).get("description", ""),
                "item_count": len(items),
            }
            for name, items in self._datasets.items()
        ]

    def delete_dataset(self, name: str) -> bool:
        """删除数据集。"""
        if name not in self._datasets:
            return False
        del self._datasets[name]
        self._dataset_metadata.pop(name, None)
        return True

    async def run_eval(
        self,
        dataset_name: str,
        model: str,
        prompt_name: str,
        llm_complete_fn: Callable[..., Any],
    ) -> EvalRun:
        """对数据集中的每个 item 执行 LLM 调用，计算评分。"""
        items = self._datasets.get(dataset_name)
        if items is None:
            raise ValueError(f"数据集不存在: {dataset_name}")

        run_id = uuid.uuid4().hex[:12]
        results: list[EvalResult] = []
        start_time = time.monotonic()

        for item in items:
            item_start = time.monotonic()
            error: str | None = None
            actual_output = ""
            try:
                response = await llm_complete_fn(
                    messages=[{"role": "user", "content": item.input}],
                    tools=None,
                )
                actual_output = response.get("content", "") if isinstance(response, dict) else str(response)
            except Exception as e:
                error = str(e)
                logger.warning("评估条目执行失败(input=%s): %s", item.input[:50], e)

            duration_ms = (time.monotonic() - item_start) * 1000
            score = _score_similarity(actual_output, item.expected_output) if not error else 0.0

            results.append(
                EvalResult(
                    input=item.input,
                    expected_output=item.expected_output,
                    actual_output=actual_output,
                    score=score,
                    duration_ms=duration_ms,
                    error=error,
                )
            )

        total_duration_ms = (time.monotonic() - start_time) * 1000
        avg_score = sum(r.score for r in results) / len(results) if results else 0.0

        run = EvalRun(
            id=run_id,
            dataset_name=dataset_name,
            model=model,
            prompt_name=prompt_name,
            results=results,
            avg_score=round(avg_score, 4),
            total_duration_ms=round(total_duration_ms, 2),
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        self._runs.append(run)
        return run

    def compare_runs(self, run_ids: list[str]) -> dict:
        """对比多次评估运行的结果。"""
        runs = [r for r in self._runs if r.id in run_ids]
        if not runs:
            return {"runs": [], "comparison": {}}

        comparison = {
            "avg_scores": {r.id: r.avg_score for r in runs},
            "best_run": max(runs, key=lambda r: r.avg_score).id,
            "worst_run": min(runs, key=lambda r: r.avg_score).id,
            "score_spread": max(r.avg_score for r in runs) - min(r.avg_score for r in runs),
        }

        return {
            "runs": [
                {
                    "id": r.id,
                    "dataset_name": r.dataset_name,
                    "model": r.model,
                    "prompt_name": r.prompt_name,
                    "avg_score": r.avg_score,
                    "total_duration_ms": r.total_duration_ms,
                    "created_at": r.created_at,
                }
                for r in runs
            ],
            "comparison": comparison,
        }

    def get_run(self, run_id: str) -> EvalRun | None:
        """获取单次评估运行详情。"""
        for r in self._runs:
            if r.id == run_id:
                return r
        return None

    def list_runs(self) -> list[dict]:
        """列出所有评估运行。"""
        return [
            {
                "id": r.id,
                "dataset_name": r.dataset_name,
                "model": r.model,
                "prompt_name": r.prompt_name,
                "avg_score": r.avg_score,
                "total_duration_ms": r.total_duration_ms,
                "created_at": r.created_at,
                "item_count": len(r.results),
            }
            for r in self._runs
        ]


def _score_similarity(actual: str, expected: str) -> float:
    """基于关键词重叠的简单评分(0.0-1.0)。"""
    if not actual and not expected:
        return 1.0
    if not expected:
        return 1.0 if actual else 0.0
    actual_words = set(actual.lower().split())
    expected_words = set(expected.lower().split())
    if not expected_words:
        return 1.0
    intersection = actual_words & expected_words
    return len(intersection) / len(expected_words)


# 全局单例
eval_service = EvalService()