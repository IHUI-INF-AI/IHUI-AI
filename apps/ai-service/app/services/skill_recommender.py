"""Skill 推荐引擎(2026-08-09 立,Phase 1)。

基于用户使用历史 + 当前上下文 + 技能标签相似度计算推荐。
融合 3 个维度:
- 历史使用频率(0.4):用户近期使用过的技能优先
- 标签相似度(0.4):技能标签与当前对话上下文关键词的匹配度
- 新鲜度(0.2):新上线技能适当提权

设计原则:
1. 零外部依赖:只依赖 skill_registry + skill_feedback_tracker
2. 零 LLM 调用:全规则引擎,快速稳定
3. 零配置:无环境变量,自动降级
"""

from __future__ import annotations

import logging
import random
from typing import Any

from app.services.skill_feedback import skill_feedback_tracker
from app.services.skills import Skill, skill_registry

logger = logging.getLogger(__name__)

# 新鲜度加分权重
_FRESHNESS_BOOST = 0.2
# 历史使用权重
_HISTORY_WEIGHT = 0.4
# 标签相似度权重
_TAG_WEIGHT = 0.4
# 默认返回数量
_DEFAULT_TOP_K = 5


class SkillRecommender:
    """Skill 推荐引擎(单例)。"""

    async def recommend(
        self,
        user_id: str | None = None,
        context: str | None = None,
        top_k: int = _DEFAULT_TOP_K,
    ) -> list[dict[str, Any]]:
        """返回推荐 skill 列表(按综合得分降序)。

        Args:
            user_id: 用户标识(None=匿名)。
            context: 当前对话上下文(可选,用于标签匹配)。
            top_k: 返回数量(默认 5)。

        Returns:
            [{skill_id, name, description, icon, category, tags, score, reason}, ...]。
        """
        skills = skill_registry.list_skills()
        if not skills:
            return []

        # 匿名用户 / 无历史:纯标签匹配 + 随机兜底
        if not user_id:
            return self._recommend_anonymous(skills, context, top_k)

        # 1. 计算每个 skill 的得分
        scored: list[tuple[Skill, float]] = []
        history_scores = await self._by_usage_history(user_id) if user_id else {}
        context_tags = self._extract_tags(context or "") if context else set()

        for skill in skills:
            score = 0.0
            # 历史使用维度
            hist_score = history_scores.get(skill.name, 0.0)
            score += hist_score * _HISTORY_WEIGHT

            # 标签相似度维度
            if context_tags:
                tag_score = self._by_tag_similarity(skill, context_tags)
                score += tag_score * _TAG_WEIGHT

            # 新鲜度维度
            score += self._by_freshness(skill) * _FRESHNESS_BOOST

            if score > 0:
                scored.append((skill, score))

        # 2. 按得分降序排列
        scored.sort(key=lambda x: x[1], reverse=True)

        # 3. 取 top_k(如果不足,用匿名推荐补齐)
        result = [self._to_recommendation(s, sc) for s, sc in scored[:top_k]]
        if len(result) < top_k:
            existing = {r["skill_id"] for r in result}
            remaining = [s for s in skills if s.name not in existing]
            random.shuffle(remaining)
            for s in remaining[: top_k - len(result)]:
                tag_score = self._by_tag_similarity(s, context_tags) if context_tags else 0.0
                result.append(self._to_recommendation(s, tag_score * _TAG_WEIGHT, reason="热门推荐"))

        return result

    def _recommend_anonymous(
        self,
        skills: list[Skill],
        context: str | None,
        top_k: int,
    ) -> list[dict[str, Any]]:
        """匿名用户推荐:先基于标签匹配,不足随机兜底。"""
        context_tags = self._extract_tags(context or "") if context else set()

        if context_tags:
            scored = [(s, self._by_tag_similarity(s, context_tags)) for s in skills]
            scored.sort(key=lambda x: x[1], reverse=True)
            matched = [s for s, sc in scored if sc > 0][:top_k]
            if len(matched) >= top_k:
                return [self._to_recommendation(s, sc) for s, sc in scored[:top_k]]

        # 随机兜底
        pool = list(skills)
        random.shuffle(pool)
        return [self._to_recommendation(s, 0.0, reason="热门推荐") for s in pool[:top_k]]

    async def _by_usage_history(self, user_id: str) -> dict[str, float]:
        """基于用户历史使用频率计算得分。

        从 SkillFeedbackTracker 获取该用户的所有使用记录,
        统计每个 skill 的使用次数,归一化到 [0, 1] 区间。
        """
        try:
            # 尝试获取所有技能的聚合统计
            all_stats = await skill_feedback_tracker.get_all_stats()
            if not all_stats:
                return {}
            # 按 usage_count 归一化
            max_count = max((s.get("totalUses", 0) for s in all_stats.values()), default=1)
            if max_count == 0:
                return {}
            return {
                name: min(stats.get("totalUses", 0) / max_count, 1.0)
                for name, stats in all_stats.items()
            }
        except Exception:
            logger.warning("skill_recommender: 读取使用历史失败", exc_info=True)
            return {}

    def _by_tag_similarity(self, skill: Skill, context_tags: set[str]) -> float:
        """计算 skill 标签与上下文关键词的匹配度。

        匹配度 = 命中标签数 / max(技能标签数, 1)
        """
        if not context_tags or not skill.tags:
            return 0.0
        skill_tags_lower = {t.lower() for t in skill.tags}
        hits = sum(
            1 for t in context_tags
            if t in skill_tags_lower or any(t in st for st in skill_tags_lower)
        )
        return hits / max(len(skill.tags), 1)

    def _by_freshness(self, skill: Skill) -> float:
        """新鲜度加分:新上线技能(创建 7 天内)额外加分。

        基于 source 和 name 判断:
        - ai-top 来源技能:内置新鲜(无确切创建时间,给 0.5 基础分)
        - auto 目录技能:较新,给 0.8 基础分
        """
        if skill.source == "auto":
            return 0.8
        if skill.source == "ai-top":
            return 0.5
        return 0.0

    @staticmethod
    def _extract_tags(text: str) -> set[str]:
        """从文本中提取关键词作为标签。

        简单实现:按空格/标点分词,过滤停用词,保留长度 ≥ 2 的词。
        """
        import re

        # 中文/英文/数字分词
        tokens = re.findall(r"[a-zA-Z]{2,}|[\u4e00-\u9fff]{2,}|\d{2,}", text)
        stop_words = {
            "the", "this", "that", "with", "from", "what", "which",
            "how", "why", "can", "you", "your", "our", "its", "are",
            "for", "and", "not", "but", "all", "any", "has", "had",
            "have", "was", "were", "been", "being", "some", "each",
            "every", "their", "them", "they", "then", "than", "who",
            "的", "了", "在", "是", "我", "有", "和", "就", "不", "人",
            "都", "一", "个", "上", "也", "很", "到", "说", "要", "去",
            "你", "会", "着", "没有", "看", "好", "自己", "这", "他",
        }
        return {t.lower() for t in tokens if t.lower() not in stop_words}

    @staticmethod
    def _to_recommendation(
        skill: Skill,
        score: float,
        reason: str | None = None,
    ) -> dict[str, Any]:
        """将 Skill 对象转为推荐结果字典。"""
        return {
            "skill_id": skill.name,
            "name": skill.name,
            "description": skill.description,
            "icon": skill.icon,
            "category": skill.category,
            "tags": skill.tags,
            "score": round(score, 4),
            "reason": reason or ("基于使用习惯" if score > 0.3 else "你可能感兴趣"),
            "available": skill.available,
        }


# 单例
skill_recommender = SkillRecommender()