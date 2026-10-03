# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""联邦学习器(L7,2026-07-25 立,对标 Google Federated Learning)。

L7 联邦学习闭环:
1. 跨用户聚合:从 agent_meta_lessons 表加载所有用户 lessons → 按类型+标题聚类
2. 群体智慧抽取:对每组 >= min_users 个贡献的 lesson,调 LLM 提取共性内容
3. 差分隐私:对 source_user_count / confidence 加 Laplace 噪声(防成员推断)
4. PII 脱敏:anonymize_text 清洗 content 中的邮箱/手机/IP/身份证
5. 持久化:UPSERT 到 agent_federated_lessons 表(进程重启不丢失)
6. 注入:build_system_prompt_snippet 把高置信度群体 lesson 注入 AgentLoop

数据流:
  agent_meta_lessons 表(各用户元知识)
    ↓ aggregate_user_lessons(SELECT 直接读,不调 meta_learner 避免循环导入)
  聚类分组(lesson_type + title 关键词匹配)
    ↓ _extract_common_lesson(LLM 提取共性,失败降级用第一条 content)
  通用化 lesson + DP 噪声 + PII 脱敏
    ↓ _upsert_federated_lesson(UPSERT by lesson_type + title)
  agent_federated_lessons 表(群体智慧持久化)
    ↓ lifespan load_all_lessons → _cache 内存列表
    ↓ build_system_prompt_snippet
  AgentLoop system prompt 注入(让 LLM 知道群体共识)

降级链路(任何失败不阻塞主流程):
  - DB 异常 → 返回 0,warning
  - LLM 失败 → 降级用第一条 content
  - 聚类后无足够样本 → 返回 0
  - load 失败 → 空内存,warning

设计原则(对标 Google FL):
  - 隐私优先:user_id 不出本地,只存 hash;count/score 加 DP 噪声
  - k-anonymity:仅聚合 >= min_users 个贡献的 lesson(默认 2)
  - 不可逆:source_user_ids_hash = sha256(user_id + salt),无法反推
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import asyncpg

from ..core.db_pool import get_shared_pool
from ..core.llm_gateway import llm_gateway
from ._load_lifecycle import (
    DECISION_BACKOFF as _DECISION_BACKOFF,
)
from ._load_lifecycle import (
    DECISION_GAVE_UP as _DECISION_GAVE_UP,
)
from ._load_lifecycle import (
    decide_attempt as _decide_attempt,
)
from ._load_lifecycle import (
    monotonic as _monotonic,
)
from ._load_lifecycle import (
    state_after_failure as _state_after_failure,
)
from ._load_lifecycle import (
    state_after_success as _state_after_success,
)
from ._load_lifecycle import (
    state_label as _load_state_label,
)
from .differential_privacy import differential_privacy

logger = logging.getLogger(__name__)

# 注入 system prompt 的最大群体 lesson 条数(按 confidence + occurrence_count 排序)
_MAX_LESSONS_IN_PROMPT = 3

# 注入 system prompt 的最低置信度(避免噪声)
_MIN_CONFIDENCE_FOR_PROMPT = 0.4

# LLM 提取共性时的最大 content 条数(防 prompt 过长)
_MAX_CONTENTS_FOR_LLM = 8

# 单条 content 截断长度(防 prompt 爆长度)
_CONTENT_TRUNCATE = 300


# 修复(2026-07-28):复用 app.core.db_pool 共享 pool,避免 14 个独立 pool 打满 max_connections。
# 保留 _get_pool 函数签名(向后兼容)。
async def _get_pool() -> asyncpg.Pool:
    """获取 asyncpg 连接池(复用 app.core.db_pool 共享 pool)。"""
    return await get_shared_pool()


def _normalize_title(title: str) -> str:
    """归一化标题用于聚类(小写 + 去多余空白 + 去标点)。

    简单相似度:同类型 + 归一化后标题相同视为同组。
    不调 LLM(聚类阶段不耗 LLM token)。
    """
    if not title:
        return ""
    # 小写 + 去首尾空白 + 折叠中间空白
    s = " ".join(str(title).lower().split())
    # 去常见标点(中英文)
    for ch in ".,;:!?，。；：！？()[]()【】\"'`\"'":
        s = s.replace(ch, "")
    return s.strip()


class FederatedLearner:
    """联邦学习器:跨用户聚合群体智慧 lessons(单例)。

    L7:从 agent_meta_lessons 聚合跨用户共性,加 DP 噪声 + PII 脱敏后
    持久化到 agent_federated_lessons,供 AgentLoop 注入 system prompt。
    """

    def __init__(self) -> None:
        # 内存缓存:联邦 lesson 列表(list[dict],与 meta_learner 的 Map 不同,
        # 因为联邦 lesson 不需要按 id 反查,按 confidence 排序读取即可)
        self._cache: list[dict[str, Any]] = []
        # P1 修复:按需懒加载,替代 main.py startup 全量 hydrate
        # federated_lessons 是全局数据(非用户维度),用 _loaded 标记首次访问后全量加载
        self._loaded: bool = False
        self._loaded_lock: asyncio.Lock = asyncio.Lock()
        # G-748(2026-09-29):读失败不再固化 —— 失败计数 + 退避窗口 + 放弃留痕。
        # _loaded=False ∧ _load_failures>0 ⇒ "读不到",与 _loaded=True ∧ 缓存空
        # ⇒ "权威的空" 结构上可区分;判定与数值住在 _load_lifecycle(唯一一份)。
        self._load_failures: int = 0
        self._load_next_attempt_s: float = 0.0
        self._load_give_up_logged: bool = False

    # ==================================================================
    # P1 修复:按需懒加载(替代启动时全量 hydrate)
    # ==================================================================

    async def _ensure_loaded(self) -> None:
        """按需加载联邦 lessons(首次访问时触发,替代启动时全量 hydrate)。

        P1 修复:原 main.py lifespan 调 load_all_lessons() 全量加载所有联邦 lessons,
        导致启动慢 + 内存峰值高。改为首次访问时才加载。

        注意:federated_lessons 是全局数据(非用户维度),无法按 user_id 懒加载,
        故用 _loaded 布尔标记,首次访问时全量加载一次。

        线程安全:asyncio.Lock 防止并发首次访问重复加载。

        G-748(2026-09-29,取代旧口径"加载失败也标记为已加载、从此不再重试"):
        旧写法把一次瞬时 DB 故障永久固化成"确实没有 lessons"且余生不再重试 ——
        与 G-702 在 ab_test_tracker 上修掉的那一处同型。判定住在 _load_lifecycle
        (与 ab_test_tracker 共用那一份实现,两处各抄必漂移):
        - 读到成功(含读到空表)⇒ 置 loaded,不再打 DB —— 权威的空允许固化;
        - 读失败 ⇒ **不置 loaded**,指数退避重试(底 1s、封顶 60s);
        - 连续失败达上限 ⇒ 停止自动重试(有界,防每次调用打爆 IO),loaded 仍 False
          —— "试了 N 次都失败"不等于"没有数据"。
        """
        if self._loaded:
            return
        async with self._loaded_lock:
            # double-check:拿到锁后再次确认(可能在等锁期间被其他协程加载)
            if self._loaded:
                return
            now = _monotonic()
            decision = _decide_attempt(
                loaded=self._loaded,
                failures=self._load_failures,
                next_attempt_s=self._load_next_attempt_s,
                now=now,
            )
            if decision == _DECISION_GAVE_UP:
                if not self._load_give_up_logged:
                    self._load_give_up_logged = True
                    logger.warning(
                        "[federated_learner] _ensure_loaded 连续 %d 次读取失败,停止自动重试"
                        "(状态=读不到,非空表;恢复靠下一次进程重启或人工触发)",
                        self._load_failures,
                    )
                return
            if decision == _DECISION_BACKOFF:
                return  # 退避窗口内:本次调用不打 DB
            ok, _count = await self._try_load_all_lessons()
            if ok:
                self._loaded, self._load_failures, self._load_next_attempt_s = (
                    _state_after_success()
                )
            else:
                self._load_failures, self._load_next_attempt_s = _state_after_failure(
                    self._load_failures, now
                )

    # ==================================================================
    # 主聚合流程
    # ==================================================================

    async def aggregate_user_lessons(
        self,
        *,
        min_users: int = 2,
        max_lessons: int = 50,
    ) -> int:
        """主聚合流程:从 agent_meta_lessons 聚合跨用户共性到 agent_federated_lessons。

        流程:
        1. SELECT 所有 agent_meta_lessons(直接读表,不调 meta_learner 避免循环导入)
        2. 按 (lesson_type, normalized_title) 聚类分组
        3. 对每组 >= min_users 个贡献的 lesson,调 LLM 提取共性
        4. 对 source_user_count 加 DP 噪声(Laplace, epsilon=1.0)
        5. 对 confidence 加 DP 噪声(Laplace, epsilon=1.0)
        6. anonymize_text 脱敏 content 中的 PII
        7. UPSERT 到 agent_federated_lessons(by lesson_type + title)
        8. 返回新增/更新的 lesson 数

        Args:
            min_users: 最小贡献用户数阈值,默认 2(k-anonymity)。
            max_lessons: 单次聚合最大 lesson 数,默认 50(防 LLM 调用过多)。

        Returns:
            新增/更新的 lesson 数。失败降级返回 0 + warning。
        """
        try:
            # 1. 加载所有 agent_meta_lessons
            rows = await self._load_meta_lessons()
            if not rows:
                logger.info(
                    "[federated_learner] agent_meta_lessons 为空,跳过聚合"
                )
                return 0

            # 2. 按 (lesson_type, normalized_title) 聚类分组
            groups = self._group_lessons(rows)
            if not groups:
                return 0

            # 3. 对每组 >= min_users 的 lesson 聚合
            count = 0
            for (lesson_type, _norm_title), group_rows in groups.items():
                if count >= max_lessons:
                    break
                if len(group_rows) < min_users:
                    continue
                ok = await self._aggregate_one_group(
                    lesson_type=lesson_type,
                    group_rows=group_rows,
                )
                if ok:
                    count += 1

            # 4. 聚合后刷新内存缓存(避免下次 list 还查 DB)
            if count > 0:
                # G-748:刷新是一次**读取**,它自己也可能失败(旧写法无条件置 loaded,
                # 于是"刷新没读到"也被记成"已加载")。只在 read_ok 时固化。
                refreshed_ok, _n = await self._try_load_all_lessons()
                if refreshed_ok:
                    # P1 修复:标记已加载(缓存已刷新,后续 _ensure_loaded 不再重复加载)
                    self._loaded, self._load_failures, self._load_next_attempt_s = (
                        _state_after_success()
                    )

            logger.info(
                "[federated_learner] aggregate_user_lessons 完成: "
                "rows=%d, groups=%d, aggregated=%d",
                len(rows), len(groups), count,
            )
            return count
        except Exception as e:
            logger.warning(
                "[federated_learner] aggregate_user_lessons 失败(降级返回 0): %s: %s",
                type(e).__name__, e,
            )
            return 0

    async def _aggregate_one_group(
        self,
        *,
        lesson_type: str,
        group_rows: list[dict[str, Any]],
    ) -> bool:
        """聚合单个分组:LLM 提取共性 + DP 噪声 + PII 脱敏 + UPSERT。

        Args:
            lesson_type: lesson 类型(failure_pattern / success_pattern 等)。
            group_rows: 同组的多条 agent_meta_lessons 行。

        Returns:
            True 表示成功持久化。
        """
        # 取第一条的 title 作为代表标题(归一化前)
        title = str(group_rows[0].get("title", "")).strip()[:200]
        if not title:
            return False

        # 抽取共性 content
        contents = [
            str(r.get("content", "")).strip()[:_CONTENT_TRUNCATE]
            for r in group_rows
            if r.get("content")
        ]
        if not contents:
            return False

        common_content = await self._extract_common_lesson(
            lesson_type=lesson_type,
            title=title,
            contents=contents,
        )
        if not common_content:
            return False

        # DP 噪声:source_user_count(组内行数作为贡献用户数的代理,
        # agent_meta_lessons 无 user_id 字段,用行数近似)
        raw_count = len(group_rows)
        noisy_count = differential_privacy.apply_to_count(
            raw_count, epsilon=1.0
        )
        # 记录 DP 噪声量(审计用)
        dp_noise_added = abs(noisy_count - raw_count)

        # DP 噪声:confidence(取组内平均 confidence 作为基础)
        confidences = [
            float(r.get("confidence", 0.5) or 0.5) for r in group_rows
        ]
        avg_conf = sum(confidences) / len(confidences) if confidences else 0.5
        noisy_conf = differential_privacy.apply_to_score(
            avg_conf, epsilon=1.0, sensitivity=1.0
        )

        # PII 脱敏 content
        anonymized_content = differential_privacy.anonymize_text(common_content)

        # 累计 occurrence_count(组内各 lesson 的 occurrence_count 之和)
        total_occ = sum(
            int(r.get("occurrence_count", 1) or 1) for r in group_rows
        )

        # source_user_ids_hash:agent_meta_lessons 无 user_id,用 lesson title 列表
        # 的 hash 作为指纹(用于去重统计,不可逆)
        title_set = sorted({str(r.get("title", "")) for r in group_rows})
        source_user_ids_hash = differential_privacy.anonymize_user_id(
            "|".join(title_set)
        )

        # UPSERT 到 agent_federated_lessons
        return await self._upsert_federated_lesson(
            lesson_type=lesson_type,
            title=title,
            content=anonymized_content,
            source_user_count=noisy_count,
            source_user_ids_hash=source_user_ids_hash,
            confidence=noisy_conf,
            occurrence_count=total_occ,
            dp_noise_added=dp_noise_added,
        )

    async def _extract_common_lesson(
        self,
        *,
        lesson_type: str,
        title: str,
        contents: list[str],
    ) -> str:
        """从多条 content 提取共性 lesson 内容。

        策略:
        - 若组内 content 全部相同 → 直接复用第一条
        - 若不同 → 调 LLM 提取共性 summary
        - LLM 失败 → 降级用第一条 content

        Args:
            lesson_type: lesson 类型。
            title: lesson 标题。
            contents: 组内多条 content(已截断)。

        Returns:
            通用化后的 lesson 内容。失败降级用第一条 content。
        """
        # 去重判断
        unique_contents = list({c for c in contents if c})
        if not unique_contents:
            return ""
        if len(unique_contents) == 1:
            # 全部相同 → 直接复用
            return unique_contents[0]

        # 不同 → 调 LLM 提取共性(最多取前 _MAX_CONTENTS_FOR_LLM 条防 prompt 过长)
        samples = unique_contents[:_MAX_CONTENTS_FOR_LLM]
        prompt = self._build_llm_prompt(
            lesson_type=lesson_type, title=title, contents=samples
        )
        try:
            result = await llm_gateway.complete(
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "你是联邦学习聚合器。请从多条用户贡献的 lesson 中"
                            "提取共性内容,生成一条通用化的 lesson。"
                            "要求:200 字以内,不含任何用户特定信息,"
                            "直接输出共性内容,不要前缀或解释。"
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
            )
            content = str(result.get("content", "")).strip()
            if content and not result.get("error"):
                return content[:1000]
            # LLM 返回空或错误 → 降级
            logger.warning(
                "[federated_learner] LLM 提取共性返回空/错误,降级用第一条 content"
            )
            return unique_contents[0]
        except Exception as e:
            logger.warning(
                "[federated_learner] LLM 提取共性失败(降级用第一条 content): %s: %s",
                type(e).__name__, e,
            )
            return unique_contents[0]

    @staticmethod
    def _build_llm_prompt(
        *,
        lesson_type: str,
        title: str,
        contents: list[str],
    ) -> str:
        """构造 LLM 提取共性的 prompt。

        Args:
            lesson_type: lesson 类型。
            title: lesson 标题。
            contents: 组内多条 content。

        Returns:
            LLM prompt 字符串。
        """
        lines = [
            f"类型: {lesson_type}",
            f"标题: {title}",
            f"贡献用户数: {len(contents)}",
            "以下是各用户贡献的 lesson 内容:",
            "",
        ]
        for i, c in enumerate(contents, 1):
            lines.append(f"[用户 {i}] {c}")
        lines.append("")
        lines.append("请提取这些 lessons 的共性内容,生成一条通用化 lesson。")
        return "\n".join(lines)

    # ==================================================================
    # DB 加载层
    # ==================================================================

    async def _load_meta_lessons(self) -> list[dict[str, Any]]:
        """从 agent_meta_lessons 表加载所有 lessons(直接 SELECT)。

        不调 meta_learner API 避免循环导入(本模块被 meta_learner 反向引用时会出问题)。

        Returns:
            lesson 行列表(每行含 lesson_type/title/content/confidence/
            occurrence_count 字段)。DB 失败返回空列表。
        """
        try:
            pool = await _get_pool()
            async with pool.acquire() as conn:
                rows = await conn.fetch(
                    """SELECT
                           lesson_type,
                           title,
                           content,
                           confidence::float AS conf,
                           occurrence_count::int AS occ
                       FROM agent_meta_lessons
                       ORDER BY lesson_type, title"""
                )
        except Exception as e:
            logger.warning(
                "[federated_learner] _load_meta_lessons 失败(返回空): %s: %s",
                type(e).__name__, e,
            )
            return []
        # asyncpg.Record 转字典
        return [dict(r) for r in rows] if rows else []

    def _group_lessons(
        self, rows: list[dict[str, Any]]
    ) -> dict[tuple[str, str], list[dict[str, Any]]]:
        """按 (lesson_type, normalized_title) 聚类分组。

        简单相似度:同 lesson_type + 归一化标题相同视为同组。
        不调 LLM(聚类阶段不耗 LLM token)。

        Args:
            rows: agent_meta_lessons 行列表。

        Returns:
            分组字典:{(lesson_type, normalized_title): [rows]}。
        """
        groups: dict[tuple[str, str], list[dict[str, Any]]] = {}
        for row in rows:
            lesson_type = str(row.get("lesson_type", "other"))
            title = str(row.get("title", ""))
            norm = _normalize_title(title)
            if not norm:
                continue
            key = (lesson_type, norm)
            groups.setdefault(key, []).append(row)
        return groups

    # ==================================================================
    # 持久化层(UPSERT + load)
    # ==================================================================

    async def _upsert_federated_lesson(
        self,
        *,
        lesson_type: str,
        title: str,
        content: str,
        source_user_count: int,
        source_user_ids_hash: str,
        confidence: float,
        occurrence_count: int,
        dp_noise_added: float,
    ) -> bool:
        """UPSERT 单条联邦 lesson 到 DB(失败不抛错,仅 warning)。

        UPSERT 策略:按 (lesson_type, title) 查找(无 UNIQUE 约束,应用层 SELECT+INSERT/UPDATE)
          - 存在 → UPDATE content + source_user_count + confidence + occurrence_count + dp_noise_added
          - 不存在 → INSERT 新行

        Args:
            lesson_type: lesson 类型。
            title: lesson 标题。
            content: 已脱敏的 lesson 内容。
            source_user_count: 已加 DP 噪声的贡献用户数。
            source_user_ids_hash: 贡献用户 hash(不可逆)。
            confidence: 已加 DP 噪声的置信度。
            occurrence_count: 累计出现次数。
            dp_noise_added: DP 噪声量(审计用)。

        Returns:
            True 表示持久化成功(或仅写内存也算成功)。
        """
        try:
            pool = await _get_pool()
            async with pool.acquire() as conn:
                # 先查是否存在(按 lesson_type + title)
                row = await conn.fetchrow(
                    """SELECT id AS fid FROM agent_federated_lessons
                       WHERE lesson_type = $1 AND title = $2""",
                    lesson_type,
                    title,
                )
                if row:
                    # 修复(2026-09-12):id 列是 bigint,必须传 int;
                    # 旧代码 _uuid.UUID(db_id) 会把 bigint 主键传出 int64 范围/解析失败。
                    db_id = int(row["fid"])
                    await conn.execute(
                        """UPDATE agent_federated_lessons SET
                               content = $1,
                               source_user_count = $2,
                               source_user_ids_hash = $3,
                               confidence = $4,
                               occurrence_count = $5,
                               dp_noise_added = $6,
                               anonymized = true,
                               updated_at = NOW()
                           WHERE id = $7""",
                        content,
                        source_user_count,
                        source_user_ids_hash,
                        confidence,
                        occurrence_count,
                        dp_noise_added,
                        db_id,
                    )
                else:
                    await conn.execute(
                        """INSERT INTO agent_federated_lessons
                               (lesson_type, title, content, source_user_count,
                                source_user_ids_hash, confidence, occurrence_count,
                                dp_noise_added, anonymized)
                           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)""",
                        lesson_type,
                        title,
                        content,
                        source_user_count,
                        source_user_ids_hash,
                        confidence,
                        occurrence_count,
                        dp_noise_added,
                    )
        except Exception as e:
            logger.warning(
                "[federated_learner] _upsert_federated_lesson DB 失败(跳过): %s: %s",
                type(e).__name__, e,
            )
            return False
        return True

    async def load_all_lessons(self, limit: int = 500) -> int:
        """公开计数投影:成功返回条数,失败返回 0。

        ⚠️ 这里的 0 **分不出**"读到空表"与"读取失败"(失败也被投成 0)——
        内部判定必须走 _try_load_all_lessons 的二元组(G-748:口径同
        ab_test_tracker.load_active_tests,不得拿本函数返回值当"确实没有"的证据)。
        """
        ok, count = await self._try_load_all_lessons(limit)
        return count if ok else 0

    async def _try_load_all_lessons(self, limit: int = 500) -> tuple[bool, int]:
        """从 DB 全量 hydrate 联邦 lessons,并把"读不到"与"读到但为空"分开返回。

        由 main.py lifespan(经 load_all_lessons)/ _ensure_loaded 消费。

        返回 (read_ok, count):
        - (False, 0) ⇒ 连接/查询异常 = "读不到",瞬时故障,**不得**固化为权威的空;
        - (True, 0)  ⇒ 查询成功且结果集为空 = **权威的空**,可以固化。
        失败不抛(调用方按 read_ok 决定退避)。

        Args:
            limit: 最大加载条数(默认 500,防超大用户量爆内存)。
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
                           source_user_count::int AS suc,
                           source_user_ids_hash,
                           confidence::float AS conf,
                           occurrence_count::int AS occ,
                           dp_noise_added::float AS dpn,
                           anonymized,
                           created_at,
                           updated_at
                       FROM agent_federated_lessons
                       ORDER BY confidence DESC, occurrence_count DESC
                       LIMIT $1""",
                    limit,
                )
        except Exception as e:
            logger.warning(
                "[federated_learner] _try_load_all_lessons 读取失败(不固化为空): %s: %s",
                type(e).__name__, e,
            )
            return False, 0

        # 重建内存缓存
        self._cache = []
        for row in rows:
            self._cache.append({
                "lessonId": str(row["lesson_id"]),
                "lessonType": str(row["lesson_type"]),
                "title": str(row["title"]),
                "content": str(row["content"]),
                "sourceUserCount": int(row["suc"] or 1),
                "sourceUserIdsHash": str(row["source_user_ids_hash"] or ""),
                "confidence": float(row["conf"] or 0.5),
                "occurrenceCount": int(row["occ"] or 1),
                "dpNoiseAdded": float(row["dpn"] or 0.0),
                "anonymized": bool(row["anonymized"]),
                "createdAt": row["created_at"].isoformat() if row["created_at"] else "",
                "updatedAt": row["updated_at"].isoformat() if row["updated_at"] else "",
            })
        return True, len(self._cache)

    # ==================================================================
    # 查询接口
    # ==================================================================

    async def list_federated_lessons(
        self,
        *,
        lesson_type: str | None = None,
        top_k: int = 20,
    ) -> list[dict[str, Any]]:
        """按 confidence DESC 检索联邦 lessons。

        优先从内存缓存读取(同步快),缓存为空时 fallback 查 DB。

        Args:
            lesson_type: 类型过滤(可空,空表示全部)。
            top_k: 最大返回条数,默认 20。

        Returns:
            lessons 列表(按 confidence DESC 排序)。失败返回空列表。
        """
        # P1 修复:按需懒加载(替代启动时全量 hydrate,统一走 _ensure_loaded)
        await self._ensure_loaded()

        lessons = list(self._cache)
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
        return lessons[:top_k] if top_k > 0 else lessons

    async def build_system_prompt_snippet(
        self, *, max_lessons: int = 3
    ) -> str:
        """构建群体智慧 system prompt 片段(供 AgentLoop 注入)。

        格式(参考 meta_learner.build_system_prompt_snippet):
          ## 群体智慧(联邦学习)
          ### 失败模式共性(避免)
          - [类型] 标题: 内容摘要
          ### 成功模式共性(参考)
          - 标题: 内容摘要
          ### 工具使用经验
          - 标题: 内容摘要
          ### Skill 改进建议
          - 标题: 内容摘要

        Args:
            max_lessons: 最大注入条数,默认 3。

        Returns:
            system prompt 片段(多行字符串,≤ 1000 字符),或空字符串。
        """
        # P1 修复:按需懒加载(替代启动时全量 hydrate,统一走 _ensure_loaded)
        await self._ensure_loaded()
        if not self._cache:
            return ""

        # 筛选:confidence >= 阈值
        candidates = [
            l for l in self._cache
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
            "success_pattern": [],
            "tool_usage": [],
            "skill_improvement": [],
        }
        for lesson in candidates:
            lesson_type = str(lesson.get("lessonType", ""))
            if lesson_type in by_type:
                by_type[lesson_type].append(lesson)

        lines = ["## 群体智慧(联邦学习)"]
        type_labels = {
            "failure_pattern": "失败模式共性(避免)",
            "success_pattern": "成功模式共性(参考)",
            "tool_usage": "工具使用经验",
            "skill_improvement": "Skill 改进建议",
        }
        for lesson_type in (
            "failure_pattern", "success_pattern", "tool_usage", "skill_improvement"
        ):
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
                if title and content:
                    lines.append(f"- {title}: {content}")
                elif title:
                    lines.append(f"- {title}")

        snippet = "\n".join(lines)
        # 总长度限制 1000 字符
        if len(snippet) > 1000:
            snippet = snippet[:997] + "..."
        return snippet

    # ==================================================================
    # 状态查询
    # ==================================================================

    def get_status(self) -> dict[str, Any]:
        """返回当前联邦学习器状态(供 API / 前端查看)。

        G-759:`loaded`/`loadFailures`/`loadState` 三键把"读不到"与"读到但为空"
        分开报(G-748 已把判定收到 _load_lifecycle,G-759 只补这层对外投影,
        形状逐字对齐 ab_test_tracker.get_status 与 meta_learner.get_status)。
        四态词汇只有一份实现,不许本模块写死字面量。
        """
        lessons = list(self._cache)
        by_type: dict[str, int] = {
            "failure_pattern": 0,
            "success_pattern": 0,
            "tool_usage": 0,
            "skill_improvement": 0,
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
            # ⚠️ cacheLoaded **不是** loadState,也不是加载状态位:它的判据是
            # `len(self._cache) > 0`,即**缓存规模**(内存里有没有 lesson),与
            # `self._loaded`(是否成功完成过一次读取)**结构上无关**。
            # 后果:读到权威空表(读成功、库里确实没有 federated lesson)时它为
            # False,与"从未尝试加载"返回值完全相同 —— 下游**无法**据此区分
            # "确实没有数据"与"读不到"。这正是 G-748 之前的静默口径。
            # 本票**不改**它的语义(既有 tests/test_federated_learner.py 的
            # `cacheLoaded is False` / `is True` 两处断言已把它钉成规格),
            # 只用**新键** loadState 承载加载状态;要判"读没读到"请读 loadState。
            "cacheLoaded": len(self._cache) > 0,
            # G-759(2026-10-03):把"读不到"与"读到但为空"分开报给运维 ——
            # loaded=False ∧ loadFailures>0 是"读不到"(瞬时故障/已放弃自动重试),
            # **不得被读成**"确实没有 federated lessons";loadState 给单一判读字段。
            # 词汇表唯一来源 = _load_lifecycle.state_label(四态互不冒充;见该模块头注)
            "loaded": self._loaded,
            "loadFailures": self._load_failures,
            "loadState": _load_state_label(
                loaded=self._loaded, failures=self._load_failures
            ),
        }


# 全局单例(与 meta_learner / failure_clusterer 风格一致)
federated_learner = FederatedLearner()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
