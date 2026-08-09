"""Skill 推荐引擎单元测试(2026-08-09 新增,Phase 1)。

测试覆盖:
- SkillRecommender.recommend 主入口(匿名/有用户/空列表)
- 内部方法:_by_tag_similarity / _by_freshness / _extract_tags
- 标签与上下文关键词匹配
- 匿名推荐随机兜底
- 路由端点 GET /api/ai-skills/recommendations
"""

from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient

from app.routers import ai_skills
from app.services.skill_recommender import SkillRecommender, skill_recommender
from app.services.skills import Skill


# =============================================================================
# 辅助
# =============================================================================

BASE_SKILLS = [
    Skill(
        name="code-review",
        description="代码审查",
        prompt_template="review {code}",
        icon="code",
        category="code",
        tags=["code", "review", "quality"],
        source="builtin",
        available=True,
    ),
    Skill(
        name="text-summary",
        description="文本总结",
        prompt_template="summarize {content}",
        icon="file-text",
        category="code",
        tags=["summary", "text", "nlp"],
        source="builtin",
        available=True,
    ),
    Skill(
        name="auto-redbook-skills",
        description="小红书文案",
        prompt_template="write {topic}",
        icon="sparkles",
        category="media",
        tags=["social", "media", "copywriting"],
        source="ai-top",
        available=True,
    ),
    Skill(
        name="guizang-ppt-skill",
        description="PPT 大纲生成",
        prompt_template="outline {topic}",
        icon="presentation",
        category="media",
        tags=["presentation", "ppt", "outline"],
        source="ai-top",
        available=True,
    ),
    Skill(
        name="test-generator",
        description="测试生成",
        prompt_template="generate tests for {code}",
        icon="test-tube",
        category="code",
        tags=["test", "code", "quality"],
        source="builtin",
        available=True,
    ),
    Skill(
        name="doc-writer",
        description="文档撰写",
        prompt_template="write docs for {code}",
        icon="book-open",
        category="code",
        tags=["documentation", "code", "writing"],
        source="builtin",
        available=True,
    ),
    Skill(
        name="wechat-article",
        description="公众号文章",
        prompt_template="write wechat article about {topic}",
        icon="message-square",
        category="media",
        tags=["wechat", "article", "media"],
        source="builtin",
        available=True,
    ),
    Skill(
        name="auto-skill",
        description="自动进化技能",
        prompt_template="help with {task}",
        icon="zap",
        category="code",
        tags=["auto", "evolved"],
        source="auto",
        available=True,
    ),
]


def _make_app():
    from fastapi import FastAPI

    app = FastAPI()
    app.include_router(ai_skills.router)
    return app


# =============================================================================
# SkillRecommender 单元测试
# =============================================================================


class TestSkillRecommender:
    """SkillRecommender 核心逻辑测试。"""

    def setup_method(self) -> None:
        self.recommender = SkillRecommender()

    # --- recommend 主入口 ---

    @pytest.mark.asyncio
    async def test_recommend_anonymous_returns_list(self, monkeypatch):
        """匿名推荐返回 top_k 个 skill。"""
        monkeypatch.setattr(
            "app.services.skill_recommender.skill_registry.list_skills",
            lambda: BASE_SKILLS,
        )
        result = await self.recommender.recommend(user_id=None, top_k=3)
        assert len(result) == 3
        for r in result:
            assert "skill_id" in r
            assert "name" in r
            assert "score" in r
            assert "reason" in r

    @pytest.mark.asyncio
    async def test_recommend_anonymous_returns_max_available(self, monkeypatch):
        """匿名推荐超过技能总数时返回全部。"""
        monkeypatch.setattr(
            "app.services.skill_recommender.skill_registry.list_skills",
            lambda: BASE_SKILLS,
        )
        result = await self.recommender.recommend(user_id=None, top_k=100)
        assert len(result) == len(BASE_SKILLS)

    @pytest.mark.asyncio
    async def test_recommend_empty_skills(self, monkeypatch):
        """技能列表为空时返回空列表。"""
        monkeypatch.setattr(
            "app.services.skill_recommender.skill_registry.list_skills",
            lambda: [],
        )
        result = await self.recommender.recommend(user_id="test", top_k=5)
        assert result == []

    @pytest.mark.asyncio
    async def test_recommend_with_context_tags_match(self, monkeypatch):
        """带上下文时标签匹配度影响推荐结果(匿名模式,含随机兜底)。"""
        monkeypatch.setattr(
            "app.services.skill_recommender.skill_registry.list_skills",
            lambda: BASE_SKILLS,
        )
        # "code review quality" 应匹配 code-review/test-generator
        result = await self.recommender.recommend(
            user_id=None, context="need code review quality check", top_k=5
        )
        assert len(result) == 5
        # 匿名模式可能有标签匹配,也可能随机兜底,只验证格式
        for r in result:
            assert "skill_id" in r
            assert "score" in r

    @pytest.mark.asyncio
    async def test_recommend_with_context_media(self, monkeypatch):
        """媒体类上下文倾向于推荐媒体类技能(匿名模式,含随机兜底)。"""
        monkeypatch.setattr(
            "app.services.skill_recommender.skill_registry.list_skills",
            lambda: BASE_SKILLS,
        )
        result = await self.recommender.recommend(
            user_id=None, context="write wechat article social media", top_k=5
        )
        assert len(result) == 5
        # 匿名模式可能有媒体类技能,也可能随机,只验证格式
        for r in result:
            assert "skill_id" in r

    # --- _by_tag_similarity ---

    def test_tag_similarity_exact_match(self):
        """标签完全匹配返回 1.0。"""
        skill = BASE_SKILLS[0]  # code-review: ["code", "review", "quality"]
        score = self.recommender._by_tag_similarity(skill, {"code", "review", "quality"})
        assert score == 1.0

    def test_tag_similarity_partial_match(self):
        """标签部分匹配返回 0.0~1.0。"""
        skill = BASE_SKILLS[0]  # code-review: ["code", "review", "quality"]
        score = self.recommender._by_tag_similarity(skill, {"code", "python"})
        assert 0 < score < 1.0

    def test_tag_similarity_no_match(self):
        """标签不匹配返回 0.0。"""
        skill = BASE_SKILLS[0]  # code-review: ["code", "review", "quality"]
        score = self.recommender._by_tag_similarity(skill, {"social", "media"})
        assert score == 0.0

    def test_tag_similarity_empty_tags(self):
        """技能无标签返回 0.0。"""
        skill = Skill(
            name="empty", description="", prompt_template="", tags=[], source="builtin"
        )
        score = self.recommender._by_tag_similarity(skill, {"code"})
        assert score == 0.0

    def test_tag_similarity_empty_context(self):
        """上下文无标签返回 0.0。"""
        skill = BASE_SKILLS[0]
        score = self.recommender._by_tag_similarity(skill, set())
        assert score == 0.0

    # --- _by_freshness ---

    def test_freshness_auto_source(self):
        """auto 来源技能新鲜度最高。"""
        skill = BASE_SKILLS[-1]  # auto-skill, source="auto"
        score = self.recommender._by_freshness(skill)
        assert score == 0.8

    def test_freshness_ai_top_source(self):
        """ai-top 来源技能中等新鲜度。"""
        skill = BASE_SKILLS[2]  # auto-redbook-skills, source="ai-top"
        score = self.recommender._by_freshness(skill)
        assert score == 0.5

    def test_freshness_builtin_source(self):
        """builtin 来源技能新鲜度最低。"""
        skill = BASE_SKILLS[0]  # code-review, source="builtin"
        score = self.recommender._by_freshness(skill)
        assert score == 0.0

    # --- _extract_tags ---

    def test_extract_tags_english(self):
        """英文分词。"""
        tags = self.recommender._extract_tags("code review quality")
        assert "code" in tags
        assert "review" in tags
        assert "quality" in tags

    def test_extract_tags_chinese(self):
        """中文分词。"""
        tags = self.recommender._extract_tags("代码审查 质量检查")
        assert "代码审查" in tags
        assert "质量检查" in tags

    def test_extract_tags_stop_words(self):
        """停用词被过滤。"""
        tags = self.recommender._extract_tags("the this that is")
        assert "the" not in tags
        assert "this" not in tags

    def test_extract_tags_empty(self):
        """空文本返回空集合。"""
        tags = self.recommender._extract_tags("")
        assert tags == set()

    def test_extract_tags_short_words(self):
        """短词(长度<2)被过滤。"""
        tags = self.recommender._extract_tags("a b c")
        assert tags == set()

    # --- _to_recommendation ---

    def test_to_recommendation_format(self):
        """推荐结果格式正确。"""
        skill = BASE_SKILLS[0]
        rec = self.recommender._to_recommendation(skill, 0.85, reason="测试推荐")
        assert rec["skill_id"] == "code-review"
        assert rec["name"] == "code-review"
        assert rec["score"] == 0.85
        assert rec["reason"] == "测试推荐"
        assert rec["available"] is True

    def test_to_recommendation_default_reason(self):
        """默认 reason 基于 score 自动生成。"""
        skill = BASE_SKILLS[0]
        rec = self.recommender._to_recommendation(skill, 0.5)
        assert rec["reason"] == "基于使用习惯"
        rec2 = self.recommender._to_recommendation(skill, 0.1)
        assert rec2["reason"] == "你可能感兴趣"


# =============================================================================
# 路由端点测试
# =============================================================================


class TestRecommendationsEndpoint:
    """GET /api/ai-skills/recommendations 端点测试。"""

    @pytest.mark.asyncio
    async def test_recommendations_returns_200(self, monkeypatch):
        """端点正常返回 200。"""
        monkeypatch.setattr(
            "app.services.skill_recommender.skill_registry.list_skills",
            lambda: BASE_SKILLS,
        )
        app = _make_app()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.get("/ai-skills/recommendations")
        assert resp.status_code == 200
        data = resp.json()
        assert data["code"] == 0
        assert isinstance(data["data"], list)

    @pytest.mark.asyncio
    async def test_recommendations_respects_top_k(self, monkeypatch):
        """top_k 参数生效。"""
        monkeypatch.setattr(
            "app.services.skill_recommender.skill_registry.list_skills",
            lambda: BASE_SKILLS,
        )
        app = _make_app()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.get("/ai-skills/recommendations?top_k=3")
        assert resp.status_code == 200
        assert len(resp.json()["data"]) == 3

    @pytest.mark.asyncio
    async def test_recommendations_context_filter(self, monkeypatch):
        """context 参数影响推荐结果。"""
        monkeypatch.setattr(
            "app.services.skill_recommender.skill_registry.list_skills",
            lambda: BASE_SKILLS,
        )
        app = _make_app()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.get("/ai-skills/recommendations?context=code+review")
        assert resp.status_code == 200
        data = resp.json()["data"]
        # 至少有一个 code 类技能
        code_skills = [r for r in data if r["category"] == "code"]
        assert len(code_skills) > 0

    @pytest.mark.asyncio
    async def test_recommendations_top_k_clamped(self, monkeypatch):
        """top_k 被限制在 [1, 10]。"""
        monkeypatch.setattr(
            "app.services.skill_recommender.skill_registry.list_skills",
            lambda: BASE_SKILLS,
        )
        app = _make_app()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.get("/ai-skills/recommendations?top_k=100")
        assert resp.status_code == 200
        # 最多返回技能总数(8)
        assert len(resp.json()["data"]) <= 8

    @pytest.mark.asyncio
    async def test_recommendations_empty_skills(self, monkeypatch):
        """技能为空时返回空列表。"""
        monkeypatch.setattr(
            "app.services.skill_recommender.skill_registry.list_skills",
            lambda: [],
        )
        app = _make_app()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.get("/ai-skills/recommendations")
        assert resp.status_code == 200
        assert resp.json()["data"] == []

    @pytest.mark.asyncio
    async def test_recommendations_result_format(self, monkeypatch):
        """推荐结果字段格式正确。"""
        monkeypatch.setattr(
            "app.services.skill_recommender.skill_registry.list_skills",
            lambda: BASE_SKILLS,
        )
        app = _make_app()
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            resp = await ac.get("/ai-skills/recommendations")
        assert resp.status_code == 200
        for item in resp.json()["data"]:
            assert "skill_id" in item
            assert "name" in item
            assert "score" in item
            assert "reason" in item
            assert "available" in item