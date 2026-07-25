"""Shadow Runner(L5-4,2026-07-25 立,对标 Hermes Agent shadow traffic)。

设计要点:
1. SkillScheduler.run_skill 调用 control 版本(线上稳定版本)完成后,
   fire-and-forget 触发 ShadowRunner.maybe_shadow_call
2. ShadowRunner 按 shadow_ratio 概率,用 treatment_content 调 LLM(shadow call)
3. shadow call 结果不返回给用户(只用于收集指标做 A/B 检验)
4. 两个版本的调用结果都记录到 ABTestTracker.record_call
5. SkillEvolutionScheduler.iterate 成功后调 register_treatment 注册 treatment 内容

内存模型:
  _treatments: dict[test_id, treatment_content str]
  内存为主,进程重启后由 SkillEvolutionScheduler 下次 iterate 重新填充

为什么不持久化 treatment_content?
  - treatment content 是 LLM 生成的临时内容(几 KB),持久化到 DB 增加表复杂度
  - 进程重启时 ABTestTracker.load_active_tests 加载 running 测试,
    但 _treatments 缓存为空 → shadow call 跳过(只统计 control)
  - 下次 SkillEvolutionScheduler.iterate 时如果同 skill 已有 running test,
    会先 stop 旧 test 再创建新 test,重新注册 treatment

集成链路:
  SkillEvolutionScheduler._evolve_skill
    ↓ iterate_on_feedback 返回 newContent
  shadow_runner.register_treatment(test_id, new_content)
    ↓ 用户调用 skill
  SkillScheduler.run_skill
    ↓ 调用 control 版本(线上 skill_registry.get(skill_name))
    ↓ fire-and-forget
  ShadowRunner.maybe_shadow_call(skill, control_result, ...)
    ↓ 随机数 < shadow_ratio
  llm_gateway.complete(treatment_content)
    ↓ 两个版本结果都记录
  ab_test_tracker.record_call(test_id, version, success, duration_ms, tokens)
"""

from __future__ import annotations

import asyncio
import logging
import random
import time
from typing import Any

from ..core.llm_gateway import llm_gateway
from .ab_test_tracker import ab_test_tracker

logger = logging.getLogger(__name__)


class ShadowRunner:
    """Shadow 调用执行器(单例 shadow_runner)。

    内存模型:
      _treatments: dict[test_id, str] - treatment prompt 内容缓存
      _lock: asyncio.Lock - 保护 _treatments 并发写入
    """

    def __init__(self) -> None:
        self._treatments: dict[str, str] = {}
        self._lock = asyncio.Lock()
        # 持有 create_task 引用,防止 CPython GC 回收未完成的子任务
        self._pending_tasks: set[asyncio.Task] = set()

    # ==================================================================
    # Treatment 内容管理
    # ==================================================================

    async def register_treatment(self, test_id: str, content: str) -> None:
        """注册 treatment 内容(由 SkillEvolutionScheduler.iterate 后调用)。

        Args:
            test_id: ABTest ID
            content: treatment 版本的 prompt 内容(skill.md 的 prompt 部分)
        """
        if not test_id or not content:
            return
        async with self._lock:
            self._treatments[test_id] = content
        logger.info(
            "[shadow_runner] register_treatment test=%s content_len=%d",
            test_id,
            len(content),
        )

    async def unregister_treatment(self, test_id: str) -> None:
        """清理 treatment 内容(测试结束时调)。"""
        async with self._lock:
            self._treatments.pop(test_id, None)

    def get_treatment(self, test_id: str) -> str | None:
        """查询 treatment 内容(无锁,只读)。"""
        return self._treatments.get(test_id)

    # ==================================================================
    # Shadow 调用
    # ==================================================================

    def maybe_shadow_call(
        self,
        skill_name: str,
        control_call_result: dict[str, Any],
        *,
        model: str | None = None,
        variables: dict[str, Any] | None = None,
    ) -> None:
        """fire-and-forget:按 shadow_ratio 概率调 LLM shadow。

        由 SkillScheduler.run_skill 调用完成后调用。

        Args:
            skill_name: 调用的 skill 名
            control_call_result: control 版本的调用结果
                {content, model, tokens, retries, error}
            model: control 调用使用的 model(传给 shadow 调用保持一致)
            variables: variables + context 合并的 prompt 变量(用于 treatment render)
        """
        try:
            # 查找 active test
            test = ab_test_tracker.get_active_test(skill_name)
            if not test:
                return  # 无 active test,跳过

            test_id = test.get("testId")
            shadow_ratio = float(test.get("shadowRatio", 0.0))
            if shadow_ratio <= 0.0:
                return

            # 概率决定是否 shadow(每个调用独立采样)
            if random.random() >= shadow_ratio:
                return

            # 查找 treatment 内容(若没有,无法 shadow,跳过)
            treatment_content = self._treatments.get(test_id)
            if not treatment_content:
                logger.debug(
                    "[shadow_runner] test=%s treatment 内容未注册,跳过 shadow",
                    test_id,
                )
                return

            # 记录 control 指标
            control_success = not control_call_result.get("error")
            control_tokens = int(control_call_result.get("tokens", 0) or 0)
            control_duration_ms = 0.0  # 由调用方补充,默认 0

            # 启动 shadow task(fire-and-forget)
            task = asyncio.create_task(
                self._shadow_call(
                    test_id=test_id,
                    skill_name=skill_name,
                    treatment_content=treatment_content,
                    variables=variables or {},
                    model=model,
                    control_call_result=control_call_result,
                )
            )
            self._pending_tasks.add(task)
            task.add_done_callback(self._pending_tasks.discard)
        except Exception as e:
            # 任何异常都不影响主流程(只 warning)
            logger.warning(
                "[shadow_runner] maybe_shadow_call 失败(忽略): %s: %s",
                type(e).__name__,
                e,
            )

    async def _shadow_call(
        self,
        *,
        test_id: str,
        skill_name: str,
        treatment_content: str,
        variables: dict[str, Any],
        model: str | None,
        control_call_result: dict[str, Any],
    ) -> None:
        """执行 shadow LLM 调用 + 记录指标。

        任何异常只 warning,不向上抛(fire-and-forget)。
        """
        # control 指标记录(由 control_call_result 提取)
        try:
            control_test = ab_test_tracker.get_test(test_id)
            if not control_test:
                return
            control_version = control_test.get("controlVersion", "")
            control_success = not control_call_result.get("error")
            control_tokens = int(control_call_result.get("tokens", 0) or 0)
            # 注:duration_ms 由 SkillScheduler.run_skill 测量,这里无法获取
            # 取 0(SignificanceTester 仍能基于 success_rate / tokens 做检验)
            control_duration_ms = 0.0
            ab_test_tracker.record_call(
                test_id,
                control_version,
                success=control_success,
                duration_ms=control_duration_ms,
                tokens=control_tokens,
            )
        except Exception as e:
            logger.warning(
                "[shadow_runner] record control 失败 test=%s: %s: %s",
                test_id,
                type(e).__name__,
                e,
            )

        # treatment LLM 调用
        treatment_start = time.time()
        treatment_success = False
        treatment_tokens = 0
        try:
            # 简化:treatment_content 直接作为 user message
            # (与 Skill.render 输出后的 messages[0].content 同语义)
            result = await llm_gateway.complete(
                [{"role": "user", "content": treatment_content}],
                model=model,
                temperature=0.7,
                max_tokens=2000,
            )
            if not result.get("error"):
                treatment_success = True
                treatment_tokens = int(result.get("usage", {}).get("total_tokens", 0))
        except Exception as e:
            logger.warning(
                "[shadow_runner] shadow LLM 调用失败 test=%s skill=%s: %s: %s",
                test_id,
                skill_name,
                type(e).__name__,
                e,
            )
        treatment_duration_ms = (time.time() - treatment_start) * 1000.0

        # 记录 treatment 指标
        try:
            control_test = ab_test_tracker.get_test(test_id)
            if not control_test:
                return
            treatment_version = control_test.get("treatmentVersion", "")
            ab_test_tracker.record_call(
                test_id,
                treatment_version,
                success=treatment_success,
                duration_ms=treatment_duration_ms,
                tokens=treatment_tokens,
            )
        except Exception as e:
            logger.warning(
                "[shadow_runner] record treatment 失败 test=%s: %s: %s",
                test_id,
                type(e).__name__,
                e,
            )

    # ==================================================================
    # 状态查询 / 清理
    # ==================================================================

    def get_status(self) -> dict[str, Any]:
        """返回当前 shadow runner 状态摘要。"""
        return {
            "registeredTreatments": len(self._treatments),
            "pendingTasks": len(self._pending_tasks),
            "testIds": list(self._treatments.keys()),
        }

    async def cleanup_inactive(self) -> int:
        """清理已结束测试(stopped/promoted/rolled_back)的 treatment 内容。

        由 ABTestScheduler 周期调用,避免内存泄露。
        Returns: 清理的条数
        """
        cleaned = 0
        async with self._lock:
            for test_id in list(self._treatments.keys()):
                test = ab_test_tracker.get_test(test_id)
                if not test or test.get("status") != "running":
                    self._treatments.pop(test_id, None)
                    cleaned += 1
        if cleaned:
            logger.info(
                "[shadow_runner] cleanup_inactive 清理 %d 条过期 treatment", cleaned
            )
        return cleaned


# 全局单例
shadow_runner = ShadowRunner()
