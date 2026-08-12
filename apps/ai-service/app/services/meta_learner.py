"""元学习器(L4-3 / L4-4,2026-07-25 立,对标 Hermes Agent meta-learning)。

L4 元学习闭环:
1. 失败聚类:跨 skill 失败案例 → FailureClusterer → failure_patterns
2. 元知识抽取:每个 failure_pattern → 提炼 meta_lesson(避坑指南)
3. 自评沉淀:SelfEvaluator 输出的 lesson / improvement → 转为 meta_lesson
4. 持久化:meta_lessons UPSERT 到 agent_meta_lessons 表(进程重启不丢失)
5. 注入:build_system_prompt_snippet 把高置信度 lessons 注入到 AgentLoop system prompt

数据流:
  skill_feedback_tracker(跨 skill 失败案例)
    ↓ FailureClusterer.cluster
  failure_patterns(聚类结果)
    ↓ MetaLearner._extract_lessons_from_patterns
  meta_lessons(避坑指南 / 改进建议)
    ↓ _persist_lesson(UPSERT by lesson_type+title)
  agent_meta_lessons 表(持久化)
    ↓ lifespan load_all_lessons → _lessons 内存 Map
    ↓ build_system_prompt_snippet
  AgentLoop system prompt 注入(让 LLM 知道避坑)

降级链路(任何失败不阻塞主流程):
  - DB 异常 → 仅写内存,warning
  - LLM 失败 → 跳过 lesson 抽取,只持久化原始 pattern
  - 失败案例不足 → 返回空,不触发聚类

类型契约对齐 packages/types/src/agent-runtime.ts 的 MetaLesson(本任务新增类型)。
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid as _uuid
from datetime import datetime, timezone
from typing import Any, Optional

import asyncpg

from ..core.config import settings
from ..core.db_pool import get_shared_pool
from .failure_clusterer import failure_clusterer
from .self_evaluator import self_evaluator

logger = logging.getLogger(__name__)

# 注入 system prompt 的最大 lesson 条数(按 confidence + occurrence_count 排序)
_MAX_LESSONS_IN_PROMPT = 5

# 注入 system prompt 的最低置信度(避免噪声)
_MIN_CONFIDENCE_FOR_PROMPT = 0.4


# 修复(2026-07-28):复用 app.core.db_pool 共享 pool,避免 14 个独立 pool 打满 max_connections。
# 保留 _get_pool 函数签名(向后兼容)。
async def _get_pool() -> asyncpg.Pool:
    """获取 asyncpg 连接池(复用 app.core.db_pool 共享 pool)。"""
    return await get_shared_pool()


class MetaLearner:
    """元学习器:从失败案例 + 自评结果抽取可复用 meta_lessons。

    L4-4:持久化到 agent_meta_lessons 表,重启不丢失。
    """

    def __init__(self) -> None:
        # 内存缓存:lesson_id -> MetaLesson dict
        self._lessons: dict[str, dict[str, Any]] = {}
        # (lesson_type, title) -> lesson_id 反查索引(避免重复落盘)
        self._title_index: dict[tuple[str, str], str] = {}
        # P1 修复:按需懒加载,替代 main.py startup 全量 hydrate
        # meta_lessons 是全局数据(非用户维度),用 _loaded 标记首次访问后全量加载
        self._loaded: bool = False
        self._loaded_lock: asyncio.Lock = asyncio.Lock()

    # ==================================================================
    # P1 修复:按需懒加载(替代启动时全量 hydrate)
    # ==================================================================

    async def _ensure_loaded(self) -> None:
        """按需加载 meta_lessons(首次访问时触发,替代启动时全量 hydrate)。

        P1 修复:原 main.py lifespan 调 load_all_lessons() 全量加载所有 lessons,
        导致启动慢 + 内存峰值高。改为首次访问时才加载。

        注意:meta_lessons 是全局数据(非用户维度),无法按 user_id 懒加载,
        故用 _loaded 布尔标记,首次访问时全量加载一次。

        线程安全:asyncio.Lock 防止并发首次访问重复加载。
        加载失败也标记为已加载(避免每次调用都重试,DB 异常时降级空内存)。
        """
        if self._loaded:
            return
        async with self._loaded_lock:
            # double-check:拿到锁后再次确认(可能在等锁期间被其他协程加载)
            if self._loaded:
                return
            try:
                # L5-11(2026-08-12):自愈建表——agent_meta_lessons 表此前从未创建,
                # 导致 lessons UPSERT 一直降级仅内存(重启即丢自进化知识)。
                await self._ensure_lesson_table()
                await self.load_all_lessons()
            except Exception as e:
                logger.warning(
                    "[meta_learner] _ensure_loaded 加载失败(降级空内存): %s", e
                )
            finally:
                # 无论成功失败都标记已加载(避免重复重试)
                self._loaded = True

    # ==================================================================
    # 元学习主流程
    # ==================================================================

    async def learn_from_failures(
        self, failure_cases: list[dict[str, Any]]
    ) -> dict[str, Any]:
        """从跨 skill 失败案例聚类 + 抽取 meta_lessons。

        Args:
            failure_cases: 跨 skill 失败案例列表(每条含 skillName/failureReason/usedAt)

        Returns:
            {
                "patternsCount": int,        # 聚类出的失败模式数
                "lessonsExtracted": int,     # 抽取的 meta_lessons 数
                "lessonsPersisted": int,     # 持久化的 meta_lessons 数
                "patterns": [...],           # 失败模式摘要(前 5 个)
                "lessons": [...],            # 抽取的 lessons 摘要(前 5 个)
            }
        """
        # P1 修复:按需懒加载 meta_lessons(替代启动时全量 hydrate)
        # 确保内存索引已加载,避免 _upsert_lesson 因缓存空导致重复 lesson
        await self._ensure_loaded()

        # 1. 失败聚类
        patterns = await failure_clusterer.cluster(failure_cases)

        # 2. 抽取 meta_lessons
        lessons = await self._extract_lessons_from_patterns(patterns)

        # 3. 持久化 + 内存索引
        persisted_count = 0
        for lesson in lessons:
            ok = await self._upsert_lesson(lesson)
            if ok:
                persisted_count += 1

        return {
            "patternsCount": len(patterns),
            "lessonsExtracted": len(lessons),
            "lessonsPersisted": persisted_count,
            "patterns": [
                {
                    "patternId": p.get("patternId"),
                    "category": p.get("category"),
                    "title": p.get("title"),
                    "caseCount": p.get("caseCount"),
                }
                for p in patterns[:5]
            ],
            "lessons": [
                {
                    "lessonId": l.get("lessonId"),
                    "lessonType": l.get("lessonType"),
                    "title": l.get("title"),
                    "confidence": l.get("confidence"),
                }
                for l in lessons[:5]
            ],
        }

    async def record_self_eval(
        self,
        eval_result: dict[str, Any],
        skill_name: str = "",
    ) -> dict[str, Any]:
        """从自评结果抽取 meta_lessons(改进点 + 教训 + 优势)。

        Args:
            eval_result: SelfEvaluator.evaluate 返回值
                (score/strengths/improvements/failureMode/lesson)
            skill_name: 触发自评的 skill 名(可空,用于 source_skills)

        Returns:
            {
                "lessonsExtracted": int,
                "lessonsPersisted": int,
                "lessons": [...],
            }
        """
        # P1 修复:按需懒加载 meta_lessons(替代启动时全量 hydrate)
        # 确保内存索引已加载,避免 _upsert_lesson 因缓存空导致重复 lesson
        await self._ensure_loaded()

        lessons: list[dict[str, Any]] = []
        source_skills = [skill_name] if skill_name else []

        # 1. 改进点 → improvement_tip
        for improvement in eval_result.get("improvements", []) or []:
            title = str(improvement)[:80]
            if not title:
                continue
            lessons.append({
                "lessonId": str(_uuid.uuid4()),
                "lessonType": "improvement_tip",
                "title": title,
                "content": str(improvement)[:500],
                "sourceSkills": source_skills,
                "failurePatternId": None,
                "occurrenceCount": 1,
                "confidence": max(0.3, float(eval_result.get("score", 0.5))),
            })

        # 2. 教训 → improvement_tip(可复用经验)
        lesson_text = eval_result.get("lesson")
        if lesson_text:
            lessons.append({
                "lessonId": str(_uuid.uuid4()),
                "lessonType": "improvement_tip",
                "title": str(lesson_text)[:80],
                "content": str(lesson_text)[:500],
                "sourceSkills": source_skills,
                "failurePatternId": None,
                "occurrenceCount": 1,
                "confidence": max(0.4, float(eval_result.get("score", 0.5))),
            })

        # 3. 优势 → best_practice
        for strength in eval_result.get("strengths", []) or []:
            title = str(strength)[:80]
            if not title:
                continue
            lessons.append({
                "lessonId": str(_uuid.uuid4()),
                "lessonType": "best_practice",
                "title": title,
                "content": str(strength)[:500],
                "sourceSkills": source_skills,
                "failurePatternId": None,
                "occurrenceCount": 1,
                "confidence": min(1.0, float(eval_result.get("score", 0.5)) + 0.2),
            })

        # 4. 失败模式 → failure_pattern
        failure_mode = eval_result.get("failureMode")
        if failure_mode:
            lessons.append({
                "lessonId": str(_uuid.uuid4()),
                "lessonType": "failure_pattern",
                "title": str(failure_mode)[:80],
                "content": f"自评识别失败模式: {failure_mode}",
                "sourceSkills": source_skills,
                "failurePatternId": None,
                "occurrenceCount": 1,
                "confidence": 0.5,
            })

        # 持久化
        persisted_count = 0
        for lesson in lessons:
            ok = await self._upsert_lesson(lesson)
            if ok:
                persisted_count += 1

        return {
            "lessonsExtracted": len(lessons),
            "lessonsPersisted": persisted_count,
            "lessons": [
                {
                    "lessonId": l.get("lessonId"),
                    "lessonType": l.get("lessonType"),
                    "title": l.get("title"),
                    "confidence": l.get("confidence"),
                }
                for l in lessons[:5]
            ],
        }

    async def evaluate_and_record(
        self,
        task_result: dict[str, Any],
        task_input: str = "",
        skill_name: str = "",
    ) -> dict[str, Any]:
        """组合:调 SelfEvaluator 自评 → record_self_eval 沉淀 lessons。

        供 AgentLoop.run_chain 后调用,作为 L4 元学习的运行时入口。

        Args:
            task_result: AgentLoopResult 字典
            task_input: 任务输入(用户 query 或任务描述)
            skill_name: 触发的 skill 名(可空)

        Returns:
            {
                "evalResult": SelfEvalResult,
                "lessonsExtracted": int,
                "lessonsPersisted": int,
            }
        """
        eval_result = await self_evaluator.evaluate(task_result, task_input)
        record_result = await self.record_self_eval(eval_result, skill_name)
        return {
            "evalResult": eval_result,
            "lessonsExtracted": record_result["lessonsExtracted"],
            "lessonsPersisted": record_result["lessonsPersisted"],
        }

    # ==================================================================
    # 元知识抽取
    # ==================================================================

    async def _extract_lessons_from_patterns(
        self, patterns: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """从 failure_patterns 抽取 meta_lessons。

        每个 failure_pattern 生成一条 failure_pattern 类型的 lesson:
          - title: pattern.title
          - content: pattern.description + suggestedFix
          - source_skills: pattern.sourceSkills
          - failure_pattern_id: pattern.patternId
          - occurrence_count: pattern.caseCount
          - confidence: 0.5 + min(0.4, caseCount / 20)
        """
        if not patterns:
            return []
        lessons: list[dict[str, Any]] = []
        for pattern in patterns:
            case_count = int(pattern.get("caseCount", 1) or 1)
            confidence = min(0.9, 0.5 + case_count / 20.0)
            content_parts = []
            desc = str(pattern.get("description", "")).strip()
            if desc:
                content_parts.append(f"症状: {desc}")
            fix = str(pattern.get("suggestedFix", "")).strip()
            if fix:
                content_parts.append(f"建议: {fix}")
            examples = pattern.get("exampleCases", []) or []
            if examples:
                example_text = "; ".join(
                    f"{e.get('skillName', '?')}: {str(e.get('failureReason', ''))[:100]}"
                    for e in examples[:2]
                    if isinstance(e, dict)
                )
                if example_text:
                    content_parts.append(f"案例: {example_text}")
            content = "\n".join(content_parts)[:1000]
            lessons.append({
                "lessonId": str(_uuid.uuid4()),
                "lessonType": "failure_pattern",
                "title": str(pattern.get("title", pattern.get("category", "unknown")))[:200],
                "content": content,
                "sourceSkills": list(pattern.get("sourceSkills", []) or []),
                "failurePatternId": str(pattern.get("patternId", "")),
                "occurrenceCount": case_count,
                "confidence": round(confidence, 2),
            })
        return lessons

    # ==================================================================
    # 持久化层(DB hydrate / UPSERT / delete)
    # ==================================================================

    async def _ensure_lesson_table(self) -> None:
        """L5-11(2026-08-12):确保 agent_meta_lessons 表存在(自愈建表)。

        该表此前从未在 migration/schema 中定义,meta_learner 用原生 SQL
        UPSERT,表缺失时 INSERT 抛异常 → 降级仅内存 → 重启丢自进化知识。
        首次加载时 CREATE TABLE IF NOT EXISTS 幂等建表。
        """
        try:
            pool = await _get_pool()
            async with pool.acquire() as conn:
                await conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS agent_meta_lessons (
                        id uuid PRIMARY KEY,
                        lesson_type varchar(64) NOT NULL,
                        title varchar(512) NOT NULL,
                        content text,
                        source_skills text[] DEFAULT '{}',
                        failure_pattern_id varchar(64),
                        occurrence_count integer DEFAULT 1,
                        confidence double precision DEFAULT 0.5,
                        system_prompt_snippet text,
                        created_at timestamptz DEFAULT NOW(),
                        updated_at timestamptz DEFAULT NOW()
                    )
                    """
                )
                await conn.execute(
                    "CREATE INDEX IF NOT EXISTS idx_agent_meta_lessons_type_title "
                    "ON agent_meta_lessons (lesson_type, title)"
                )
                # L5-11 自愈迁移(2026-08-12 实测抓出):初版表 failure_pattern_id 为
                # uuid 类型,但 FailureClusterer 的 pattern id 是 'fp_1' 字符串,
                # INSERT 抛 invalid UUID 异常 → lesson 降级仅内存。
                # 幂等 ALTER 转换 varchar(64)(已转换时同类型 no-op)。
                await conn.execute(
                    "ALTER TABLE agent_meta_lessons "
                    "ALTER COLUMN failure_pattern_id TYPE varchar(64)"
                )
        except Exception as e:
            logger.warning(
                "[meta_learner] _ensure_lesson_table 建表失败(降级内存): %s", e
            )

    async def _upsert_lesson(self, lesson: dict[str, Any]) -> bool:
        """UPSERT 单条 meta_lesson 到 DB + 内存(失败不抛错,仅 warning)。

        UPSERT 策略:按 (lesson_type, title) 查找
          - 存在 → UPDATE content + occurrence_count += new + source_skills 合并
          - 不存在 → INSERT 新行

        Args:
            lesson: MetaLesson 字典

        Returns:
            True 表示持久化成功(或仅写内存也算成功)
        """
        lesson_id = str(lesson.get("lessonId", ""))
        if not lesson_id:
            return False
        lesson_type = str(lesson.get("lessonType", "other"))
        title = str(lesson.get("title", ""))
        content = str(lesson.get("content", ""))
        source_skills = list(lesson.get("sourceSkills", []) or [])
        failure_pattern_id = lesson.get("failurePatternId")
        if failure_pattern_id is not None:
            failure_pattern_id = str(failure_pattern_id)
        occurrence_count = int(lesson.get("occurrenceCount", 1) or 1)
        confidence = float(lesson.get("confidence", 0.5))
        snippet = self._build_snippet_for_lesson(lesson)

        # 内存索引查找:同 (lesson_type, title) 视为同 lesson
        existing_id = self._title_index.get((lesson_type, title))
        if existing_id:
            # 内存合并:occurrence_count 累加,source_skills 合并去重
            existing = self._lessons.get(existing_id, {})
            existing_skills = set(existing.get("sourceSkills", []) or [])
            existing_skills.update(source_skills)
            existing["sourceSkills"] = sorted(existing_skills)
            existing["occurrenceCount"] = int(existing.get("occurrenceCount", 0)) + occurrence_count
            existing["confidence"] = round(
                min(1.0, float(existing.get("confidence", 0.5)) + confidence * 0.1), 2
            )
            existing["content"] = content  # 用新内容覆盖(LLM 新生成的更准)
            existing["updatedAt"] = datetime.now(timezone.utc).isoformat()
            existing["systemPromptSnippet"] = self._build_snippet_for_lesson(existing)
            # 用原 id(不换 id)
            lesson_id = existing_id
        else:
            # 新建内存缓存
            now_iso = datetime.now(timezone.utc).isoformat()
            self._lessons[lesson_id] = {
                "lessonId": lesson_id,
                "lessonType": lesson_type,
                "title": title,
                "content": content,
                "sourceSkills": source_skills,
                "failurePatternId": failure_pattern_id,
                "occurrenceCount": occurrence_count,
                "confidence": confidence,
                "systemPromptSnippet": snippet,
                "createdAt": now_iso,
                "updatedAt": now_iso,
            }
            self._title_index[(lesson_type, title)] = lesson_id

        # DB UPSERT(失败降级仅写内存)
        try:
            pool = await _get_pool()
            async with pool.acquire() as conn:
                # 先查是否存在(按 lesson_type + title)
                row = await conn.fetchrow(
                    """SELECT id, occurrence_count::int AS occ FROM agent_meta_lessons
                       WHERE lesson_type = $1 AND title = $2""",
                    lesson_type,
                    title,
                )
                if row:
                    db_id = str(row["id"])
                    db_occ = int(row["occ"] or 0)
                    new_occ = db_occ + occurrence_count
                    # 合并 source_skills(数组 union)
                    merged_skills = await self._merge_source_skills(
                        conn, db_id, source_skills
                    )
                    await conn.execute(
                        """UPDATE agent_meta_lessons SET
                               content = $1,
                               source_skills = $2,
                               occurrence_count = $3,
                               confidence = LEAST(1.0, confidence + $4 * 0.1),
                               system_prompt_snippet = $5,
                               updated_at = NOW()
                           WHERE id = $6""",
                        content,
                        merged_skills,
                        new_occ,
                        confidence,
                        snippet,
                        _uuid.UUID(db_id),
                    )
                else:
                    await conn.execute(
                        """INSERT INTO agent_meta_lessons
                               (id, lesson_type, title, content, source_skills,
                                failure_pattern_id, occurrence_count, confidence,
                                system_prompt_snippet)
                           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)""",
                        _uuid.UUID(lesson_id),
                        lesson_type,
                        title,
                        content,
                        source_skills,
                        failure_pattern_id,
                        occurrence_count,
                        confidence,
                        snippet,
                    )
        except Exception as e:
            logger.warning(
                "[meta_learner] _upsert_lesson DB 失败(降级仅写内存 lesson=%s): %s",
                lesson_id, e,
            )
            return True  # 仅写内存也算成功(不影响主流程)
        return True

    async def _merge_source_skills(
        self,
        conn: asyncpg.Connection,
        lesson_id: str,
        new_skills: list[str],
    ) -> list[str]:
        """合并 DB 中已有 source_skills 与新 skills(去重 + 排序)。"""
        try:
            row = await conn.fetchrow(
                "SELECT source_skills FROM agent_meta_lessons WHERE id = $1",
                _uuid.UUID(lesson_id),
            )
        except Exception as e:
            logger.warning("meta_learner._merge_source_skills 加载 source_skills 失败: %s", e, exc_info=True)
            return new_skills
        if not row:
            return new_skills
        existing = list(row["source_skills"] or [])
        merged = sorted(set(existing) | set(new_skills))
        return merged

    async def load_all_lessons(self, limit: int = 500) -> int:
        """启动时从 DB 全量 hydrate meta_lessons 到内存。

        由 main.py lifespan 调用,失败不阻塞启动(返回 0 + warning)。
        limit 默认 500,防止超大用户量一次性加载爆内存。

        Args:
            limit: 最大加载条数(默认 500)

        Returns:
            加载到内存的 lesson 条数
        """
        try:
            pool = await _get_pool()
            async with pool.acquire() as conn:
                rows = await conn.fetch(
                    """SELECT
                           id::text AS lesson_id,
                           lesson_type,
                           title,
                           content,
                           source_skills,
                           failure_pattern_id,
                           occurrence_count::int AS occ,
                           confidence::float AS conf,
                           system_prompt_snippet AS snippet,
                           created_at,
                           updated_at
                       FROM agent_meta_lessons
                       ORDER BY occurrence_count DESC, confidence DESC
                       LIMIT $1""",
                    limit,
                )
        except Exception as e:
            logger.warning(
                "[meta_learner] load_all_lessons 失败(降级空内存): %s", e
            )
            return 0

        count = 0
        for row in rows:
            lesson_id = str(row["lesson_id"])
            if not lesson_id:
                continue
            lesson_type = str(row["lesson_type"])
            title = str(row["title"])
            source_skills = list(row["source_skills"] or [])
            failure_pattern_id = row["failure_pattern_id"]
            snippet = row["snippet"]

            lesson = {
                "lessonId": lesson_id,
                "lessonType": lesson_type,
                "title": title,
                "content": str(row["content"]),
                "sourceSkills": source_skills,
                "failurePatternId": str(failure_pattern_id) if failure_pattern_id else None,
                "occurrenceCount": int(row["occ"] or 1),
                "confidence": float(row["conf"] or 0.5),
                "systemPromptSnippet": str(snippet) if snippet else "",
                "createdAt": row["created_at"].isoformat() if row["created_at"] else "",
                "updatedAt": row["updated_at"].isoformat() if row["updated_at"] else "",
            }
            if not lesson["systemPromptSnippet"]:
                lesson["systemPromptSnippet"] = self._build_snippet_for_lesson(lesson)
            self._lessons[lesson_id] = lesson
            self._title_index[(lesson_type, title)] = lesson_id
            count += 1
        return count

    async def delete_lesson(self, lesson_id: str) -> bool:
        """从 DB 删除 meta_lesson(用于手动清理低质量 lesson)。

        Args:
            lesson_id: lesson ID(UUID)

        Returns:
            True 表示删除成功(或内存已清除)
        """
        if not lesson_id:
            return False
        # 内存清除
        lesson = self._lessons.pop(lesson_id, None)
        if lesson:
            key = (str(lesson.get("lessonType", "")), str(lesson.get("title", "")))
            self._title_index.pop(key, None)
        try:
            pool = await _get_pool()
            async with pool.acquire() as conn:
                await conn.execute(
                    """DELETE FROM agent_meta_lessons WHERE id = $1""",
                    _uuid.UUID(lesson_id),
                )
            return True
        except Exception as e:
            logger.warning(
                "[meta_learner] delete_lesson DB 失败(lesson=%s,内存已清): %s",
                lesson_id, e,
            )
            # DB 失败不阻塞,内存已清除视为成功
            return True

    # ==================================================================
    # System prompt 注入(供 AgentLoop 调用)
    # ==================================================================

    def get_cached_lessons(
        self, lesson_type: str = "", limit: int = _MAX_LESSONS_IN_PROMPT
    ) -> list[dict[str, Any]]:
        """读取内存缓存的 lessons(同步,不查 DB)。

        供 AgentLoop 同步上下文使用,避免每次请求都查 DB。
        内存未命中时返回空列表,调用方应主动调 load_all_lessons。

        Args:
            lesson_type: 类型过滤(可空,空表示全部)
            limit: 最大返回条数(默认 5)

        Returns:
            lessons 列表(按 confidence + occurrence_count 倒序)
        """
        lessons = list(self._lessons.values())
        if lesson_type:
            lessons = [l for l in lessons if l.get("lessonType") == lesson_type]
        # 排序:confidence 优先,次 occurrence_count
        lessons.sort(
            key=lambda l: (
                float(l.get("confidence", 0.5)),
                int(l.get("occurrenceCount", 0)),
            ),
            reverse=True,
        )
        return lessons[:limit]

    def build_system_prompt_snippet(self, max_lessons: int = _MAX_LESSONS_IN_PROMPT) -> str:
        """构建元知识 system prompt 片段(同步,无 DB 查询)。

        供 AgentLoop 注入到 system prompt,让 LLM 知道:
          - 哪些失败模式要避免(failure_pattern)
          - 哪些改进建议要采纳(improvement_tip)
          - 哪些最佳实践要遵循(best_practice)

        格式:
          ## 元知识(避坑指南)
          ### 失败模式(避免)
          - [类别] 标题: 简要内容
          ### 改进建议(采纳)
          - 标题: 简要内容
          ### 最佳实践(遵循)
          - 标题: 简要内容

        Args:
            max_lessons: 最大注入条数(默认 5)

        Returns:
            system prompt 片段(多行字符串,≤ 1200 字符),或空字符串
        """
        if not self._lessons:
            return ""
        # 筛选:confidence >= 阈值
        candidates = [
            l for l in self._lessons.values()
            if float(l.get("confidence", 0.5)) >= _MIN_CONFIDENCE_FOR_PROMPT
        ]
        if not candidates:
            return ""
        # 排序:confidence 优先,次 occurrence_count
        candidates.sort(
            key=lambda l: (
                float(l.get("confidence", 0.5)),
                int(l.get("occurrenceCount", 0)),
            ),
            reverse=True,
        )
        candidates = candidates[:max_lessons]

        # 分类
        by_type: dict[str, list[dict[str, Any]]] = {
            "failure_pattern": [],
            "improvement_tip": [],
            "best_practice": [],
        }
        for lesson in candidates:
            lesson_type = str(lesson.get("lessonType", ""))
            if lesson_type in by_type:
                by_type[lesson_type].append(lesson)

        lines = ["## 元知识(避坑指南)"]
        type_labels = {
            "failure_pattern": "失败模式(避免)",
            "improvement_tip": "改进建议(采纳)",
            "best_practice": "最佳实践(遵循)",
        }
        for lesson_type in ("failure_pattern", "improvement_tip", "best_practice"):
            items = by_type[lesson_type]
            if not items:
                continue
            lines.append(f"### {type_labels[lesson_type]}")
            for lesson in items:
                title = str(lesson.get("title", "")).strip()
                content = str(lesson.get("content", "")).strip()
                # 每条内容截断 120 字符
                if len(content) > 120:
                    content = content[:117] + "..."
                # failure_pattern 加类别前缀
                if lesson_type == "failure_pattern":
                    pattern_id = str(lesson.get("failurePatternId", ""))
                    prefix = f"[{pattern_id}] " if pattern_id else ""
                    lines.append(f"- {prefix}{title}: {content}")
                else:
                    lines.append(f"- {title}: {content}")

        snippet = "\n".join(lines)
        # 总长度限制 1200 字符
        if len(snippet) > 1200:
            snippet = snippet[:1197] + "..."
        return snippet

    @staticmethod
    def _build_snippet_for_lesson(lesson: dict[str, Any]) -> str:
        """构建单条 lesson 的紧凑 snippet(用于 DB system_prompt_snippet 字段)。

        与 build_system_prompt_snippet 不同,这是单条 lesson 的摘要,用于:
        1. DB 字段持久化(避免每次都重新生成)
        2. 增量注入时拼接

        格式: "[类型标签] 标题: 内容摘要"
        """
        lesson_type = str(lesson.get("lessonType", ""))
        type_label = {
            "failure_pattern": "失败模式",
            "improvement_tip": "改进建议",
            "best_practice": "最佳实践",
        }.get(lesson_type, lesson_type)
        title = str(lesson.get("title", "")).strip()
        content = str(lesson.get("content", "")).strip()
        if len(content) > 120:
            content = content[:117] + "..."
        if not title and not content:
            return ""
        if title and content:
            return f"[{type_label}] {title}: {content}"
        return f"[{type_label}] {title or content}"

    # ==================================================================
    # 查询接口(供 API 暴露)
    # ==================================================================

    def get_status(self) -> dict[str, Any]:
        """返回当前元学习器状态(供 API / 前端查看)。"""
        lessons = list(self._lessons.values())
        by_type: dict[str, int] = {
            "failure_pattern": 0,
            "improvement_tip": 0,
            "best_practice": 0,
        }
        for lesson in lessons:
            lesson_type = str(lesson.get("lessonType", ""))
            if lesson_type in by_type:
                by_type[lesson_type] += 1
        avg_confidence = (
            sum(float(l.get("confidence", 0.5)) for l in lessons) / len(lessons)
            if lessons else 0.0
        )
        return {
            "totalLessons": len(lessons),
            "byType": by_type,
            "avgConfidence": round(avg_confidence, 2),
        }


# 单例(与 user_profile_builder / dream_scheduler 风格一致)
meta_learner = MetaLearner()
