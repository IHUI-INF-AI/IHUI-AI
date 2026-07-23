"""LangGraph Skill 调度器(2026-07-23 新增)。

编排 AI Skills 调用,提供单步执行 / 失败重试(指数退避 1s/2s/4s)/
上下文传递 / token 用量统计。不替换 ai_skills.py 现有 llm_gateway 调用,
而是通过 SkillScheduler 包装。无新装依赖。
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

from ..core.llm_gateway import llm_gateway
from .skills import skill_registry

logger = logging.getLogger(__name__)

# 指数退避基准(秒):1s, 2s, 4s
_BACKOFF_BASE_SECONDS = 1.0
_MAX_BACKOFF_MULTIPLIER = 4  # 第 3 次重试:1 * 2^2 = 4s


class SkillScheduler:
    """LangGraph 编排的 skill 调度器。

    Attributes:
        max_retries: 单次 skill 调用的最大重试次数(含首次)。
        total_tokens: 累计所有 run_skill 调用的 token 用量。
        call_count: 累计 run_skill 调用次数(含失败重试)。
        error_count: 累计彻底失败(重试耗尽)的次数。
        history: 每次调用的简要历史(最多保留 100 条)。
    """

    def __init__(self, max_retries: int = 3) -> None:
        self.max_retries = max_retries
        self.total_tokens: int = 0
        self.call_count: int = 0
        self.error_count: int = 0
        self.history: list[dict[str, Any]] = []

    # ===== 单步执行 =====

    async def run_skill(
        self,
        skill_name: str,
        variables: dict[str, Any] | None = None,
        model: str | None = None,
        *,
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """运行单个 skill(包装 llm_gateway),支持重试 + token 统计。

        Returns dict: content / model / tokens / retries / error。
        """
        skill = skill_registry.get(skill_name)
        if skill is None:
            return self._record(
                skill_name=skill_name, content="", model="", tokens=0, retries=0,
                error=f"skill not found: {skill_name}",
            )

        # 合并 variables + context(context 优先,允许链式 skill 覆盖)
        merged_vars: dict[str, Any] = {}
        if variables:
            merged_vars.update(variables)
        if context:
            merged_vars.update(context)
        try:
            rendered = skill.render(merged_vars or None)
        except Exception as e:
            return self._record(
                skill_name=skill_name, content="", model="", tokens=0, retries=0,
                error=f"template render failed: {type(e).__name__}: {e}",
            )

        # 指数退避重试
        last_error: str | None = None
        for attempt in range(self.max_retries):
            if attempt > 0:
                backoff = min(
                    _BACKOFF_BASE_SECONDS * (2 ** (attempt - 1)),
                    _BACKOFF_BASE_SECONDS * _MAX_BACKOFF_MULTIPLIER,
                )
                logger.info(
                    "SkillScheduler 重试 skill=%s 第 %d 次,等待 %.1fs",
                    skill_name, attempt, backoff,
                )
                await asyncio.sleep(backoff)
            try:
                result = await llm_gateway.complete(
                    [{"role": "user", "content": rendered}],
                    model=model, temperature=0.7, max_tokens=2000,
                )
            except Exception as e:
                last_error = f"{type(e).__name__}: {e}"
                logger.warning(
                    "SkillScheduler skill=%s 第 %d 次调用异常: %s",
                    skill_name, attempt + 1, last_error,
                )
                continue
            if not result.get("error"):
                tokens = int(result.get("usage", {}).get("total_tokens", 0))
                return self._record(
                    skill_name=skill_name,
                    content=str(result.get("content", "")),
                    model=str(result.get("model", "")),
                    tokens=tokens, retries=attempt, error=None,
                )
            last_error = str(result.get("error_message") or result.get("error"))
            logger.warning(
                "SkillScheduler skill=%s 第 %d 次返回 error: %s",
                skill_name, attempt + 1, last_error,
            )

        # 重试耗尽
        return self._record(
            skill_name=skill_name, content="", model="", tokens=0,
            retries=self.max_retries - 1,
            error=f"重试 {self.max_retries} 次后仍失败: {last_error}",
        )

    # ===== 链式执行(上下文传递) =====

    async def run_chain(
        self,
        steps: list[dict[str, Any]],
        initial_context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """链式执行多个 skill,前一步输出可被后一步引用。

        每步 dict 字段:skill(必填)/ variables / context_from(从前序 step output 提取)/
        model。返回:results / context / total_tokens / error(任一步失败时记录最后一步的错误)。
        """
        context: dict[str, Any] = dict(initial_context or {})
        results: list[dict[str, Any]] = []
        for idx, step in enumerate(steps):
            skill_name = step.get("skill")
            if not skill_name:
                results.append(self._record(
                    skill_name="<missing>", content="", model="", tokens=0, retries=0,
                    error="step 缺少 skill 字段",
                ))
                continue
            if step.get("context_from") and results:
                context[step["context_from"]] = results[-1].get("content", "")
            step_result = await self.run_skill(
                skill_name=skill_name,
                variables=step.get("variables"),
                model=step.get("model"),
                context=context,
            )
            results.append(step_result)
            if step_result.get("content"):
                context[f"step_{idx}_output"] = step_result["content"]
        return {
            "results": results,
            "context": context,
            "total_tokens": self.total_tokens,
            "error": next((r.get("error") for r in reversed(results) if r.get("error")), None),
        }

    # ===== 内部工具 =====

    def _record(
        self,
        *,
        skill_name: str,
        content: str,
        model: str,
        tokens: int,
        retries: int,
        error: str | None,
    ) -> dict[str, Any]:
        """记录单次调用结果 + 更新累计统计。"""
        self.call_count += 1
        if tokens > 0:
            self.total_tokens += tokens
        if error:
            self.error_count += 1
        entry: dict[str, Any] = {
            "content": content, "model": model, "tokens": tokens,
            "retries": retries, "error": error,
        }
        # history 摘要(不含 content,避免内存膨胀)
        self.history.append({
            "skill": skill_name, "tokens": tokens, "retries": retries,
            "error": error, "ts": time.time(),
        })
        if len(self.history) > 100:
            self.history = self.history[-100:]
        return entry

    def stats(self) -> dict[str, Any]:
        """返回当前统计快照。"""
        return {
            "total_tokens": self.total_tokens,
            "call_count": self.call_count,
            "error_count": self.error_count,
            "history_size": len(self.history),
        }


# 全局单例(ai_skills.py 可选用)
skill_scheduler = SkillScheduler()
