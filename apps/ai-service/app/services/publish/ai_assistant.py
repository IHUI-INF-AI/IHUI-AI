"""AI 辅助写作服务 — 基于项目已有的 LangGraph + LiteLLM(llm_gateway)。

提供:
- generate_titles:基于正文 + 平台风格生成标题候选
- polish_content:正文润色(更通顺/更吸引人)
- recommend_tags:推荐标签
- generate_summary:生成 SEO 摘要
- analyze_seo:SEO 分析(评分 + 建议)
- suggest_cover:封面设计建议
- astream_*:流式版本(SSE 逐字输出),供 router 直接 yield

设计:
1. 复用 llm_gateway 单例(共享 key 池/fallback/stub 降级),不直接 import litellm。
2. 所有方法 async,失败返回空列表/空串(不抛异常,由调用方决定如何提示用户)。
3. prompt 内置平台风格适配(微信公众号/知乎/小红书/CSDN 等)。
4. 无数据库依赖,纯 LLM 调用 + prompt 工程。

未来接入:由 ai-service router(app/routers/publish.py)新增 /publish/ai/* 端点,
import 本模块的 AiWritingService 单例并调用即可。
"""
from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any, Optional

from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.llm_gateway import llm_gateway
from app.core.logging import get_logger

logger = get_logger(__name__)

# 平台风格提示(影响标题/正文/标签生成策略)
_PLATFORM_HINTS: dict[str, str] = {
    "wechat": "微信公众号(正式、有深度、标题稳重)",
    "zhihu": "知乎(专业、有理有据、标题带问句或观点)",
    "xiaohongshu": "小红书(轻松、带 emoji、标题吸引点击、口语化)",
    "csdn": "CSDN(技术、实用、标题带关键词)",
    "juejin": "掘金(技术、年轻化、标题简洁)",
    "weibo": "微博(简短、话题性强、带话题标签)",
    "toutiao": "今日头条(信息量大、标题党适度)",
    "bilibili": "哔哩哔哩(年轻、二次元友好、标题有梗)",
}


def _platform_hint(platform: str) -> str:
    return _PLATFORM_HINTS.get(platform, "通用平台(标题简洁、内容清晰)")


def _truncate(content: str, max_chars: int = 3000) -> str:
    if len(content) <= max_chars:
        return content
    return content[:max_chars] + "\n...(内容已截断)"


class SeoReport(BaseModel):
    """SEO 分析报告。"""

    score: int = Field(ge=0, le=100, description="整体 SEO 评分")
    title_score: int = Field(ge=0, le=100, description="标题评分")
    content_score: int = Field(ge=0, le=100, description="正文评分")
    keyword_density: dict[str, float] = Field(default_factory=dict, description="关键词密度")
    suggestions: list[str] = Field(default_factory=list, description="优化建议")


class AiWritingService:
    """AI 辅助写作服务(基于 llm_gateway,共享 key 池/fallback/stub 降级)。"""

    @property
    def _model(self) -> str:
        return settings.litellm_model

    async def _complete(self, prompt: str, system: Optional[str] = None) -> str:
        """非流式 LLM 调用,返回完整文本。失败返回空串。"""
        messages: list[dict[str, str]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        try:
            result = await llm_gateway.complete(messages, model=self._model)
            content = result.get("content", "") if isinstance(result, dict) else ""
            return str(content).strip()
        except Exception as e:
            logger.warning("[ai_assistant] complete failed: %s", e)
            return ""

    async def _astream(self, prompt: str, system: Optional[str] = None) -> AsyncIterator[str]:
        """流式 LLM 调用,yield 逐字 chunk。失败静默结束。"""
        messages: list[dict[str, str]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        try:
            async for event in llm_gateway.astream(messages, model=self._model):
                etype = event.get("type")
                if etype == "chunk":
                    chunk = event.get("content", "")
                    if isinstance(chunk, str) and chunk:
                        yield chunk
        except Exception as e:
            logger.warning("[ai_assistant] astream failed: %s", e)

    # ===== 标题生成 =====

    async def generate_titles(
        self, content: str, platform: str = "", count: int = 5
    ) -> list[str]:
        """生成标题候选(基于正文 + 平台风格)。"""
        if not content.strip():
            return []
        hint = _platform_hint(platform)
        prompt = (
            f"你是标题生成专家。基于以下正文,为{hint}生成 {count} 个吸引人的标题候选。"
            "每个标题单独一行,只输出标题文本,不要编号和解释。\n\n"
            f"正文:\n{_truncate(content)}"
        )
        result = await self._complete(prompt)
        if not result:
            return []
        titles = [
            line.strip().lstrip("0123456789.、)）) ")
            for line in result.split("\n")
            if line.strip()
        ]
        return [t for t in titles if t][:count]

    async def astream_titles(
        self, content: str, platform: str = "", count: int = 5
    ) -> AsyncIterator[str]:
        hint = _platform_hint(platform)
        prompt = (
            f"你是标题生成专家。基于以下正文,为{hint}生成 {count} 个吸引人的标题候选。"
            "每个标题单独一行,只输出标题文本,不要编号和解释。\n\n"
            f"正文:\n{_truncate(content)}"
        )
        async for chunk in self._astream(prompt):
            yield chunk

    # ===== 正文润色 =====

    async def polish_content(self, content: str, style: str = "professional") -> str:
        """正文润色(更通顺/更吸引人)。style: professional/casual/technical。"""
        if not content.strip():
            return ""
        style_hint = {
            "professional": "专业、正式",
            "casual": "轻松、口语化",
            "technical": "技术、严谨",
        }.get(style, "专业")
        prompt = (
            f"你是中文润色专家。请润色以下正文,使其更通顺、更吸引人,"
            f"风格:{style_hint}。保持原意不变,直接输出润色后的完整正文,不要解释:\n\n{content}"
        )
        return await self._complete(prompt)

    async def astream_polish(
        self, content: str, style: str = "professional"
    ) -> AsyncIterator[str]:
        style_hint = {
            "professional": "专业、正式",
            "casual": "轻松、口语化",
            "technical": "技术、严谨",
        }.get(style, "专业")
        prompt = (
            f"你是中文润色专家。请润色以下正文,使其更通顺、更吸引人,"
            f"风格:{style_hint}。保持原意不变,直接输出润色后的完整正文,不要解释:\n\n{content}"
        )
        async for chunk in self._astream(prompt):
            yield chunk

    # ===== 标签推荐 =====

    async def recommend_tags(
        self, content: str, platform: str = "", count: int = 8
    ) -> list[str]:
        """推荐标签(基于正文 + 平台)。"""
        if not content.strip():
            return []
        hint = _platform_hint(platform)
        prompt = (
            f"你是标签推荐专家。基于以下正文,为{hint}推荐 {count} 个相关标签。"
            "每个标签用逗号分隔,只输出标签,不要解释:\n\n"
            f"{_truncate(content)}"
        )
        result = await self._complete(prompt)
        if not result:
            return []
        tags = [t.strip().lstrip("#") for t in result.replace("，", ",").split(",")]
        return [t for t in tags if t][:count]

    # ===== 摘要生成 =====

    async def generate_summary(self, content: str, max_length: int = 100) -> str:
        """生成摘要(SEO 用)。"""
        if not content.strip():
            return ""
        prompt = (
            f"你是摘要生成专家。请为以下正文生成一段 {max_length} 字以内的摘要,用于 SEO。"
            "直接输出摘要文本,不要解释:\n\n"
            f"{_truncate(content)}"
        )
        return await self._complete(prompt)

    async def astream_summary(self, content: str, max_length: int = 100) -> AsyncIterator[str]:
        prompt = (
            f"你是摘要生成专家。请为以下正文生成一段 {max_length} 字以内的摘要,用于 SEO。"
            "直接输出摘要文本,不要解释:\n\n"
            f"{_truncate(content)}"
        )
        async for chunk in self._astream(prompt):
            yield chunk

    # ===== SEO 分析 =====

    async def analyze_seo(
        self, title: str, content: str, platform: str = ""
    ) -> Optional[SeoReport]:
        """SEO 分析(标题评分/正文评分/关键词密度/建议)。返回 None 表示失败。"""
        if not content.strip():
            return None
        hint = _platform_hint(platform)
        prompt = (
            f"你是 SEO 分析专家。请分析以下标题和正文(平台:{hint})的 SEO 质量,"
            '输出 JSON 格式:{"score":1-100,"title_score":1-100,"content_score":1-100,'
            '"keyword_density":{"关键词":百分比数字},"suggestions":["建议1","建议2"]}'
            "只输出 JSON,不要其他文字:\n\n"
            f"标题:{title or '(无)'}\n\n正文:\n{_truncate(content)}"
        )
        result = await self._complete(prompt)
        if not result:
            return None
        # 提取 JSON(容错:AI 可能包裹 ```json)
        json_str = result
        if "```" in json_str:
            import re
            match = re.search(r"```(?:json)?\s*([\s\S]*?)```", json_str)
            if match and match.group(1):
                json_str = match.group(1).strip()
        try:
            data = json.loads(json_str)
        except json.JSONDecodeError:
            logger.warning("[ai_assistant] SEO JSON parse failed: %s", result[:200])
            return None
        try:
            return SeoReport(
                score=int(data.get("score", 0)),
                title_score=int(data.get("title_score", 0)),
                content_score=int(data.get("content_score", 0)),
                keyword_density={
                    str(k): float(v)
                    for k, v in (data.get("keyword_density") or {}).items()
                    if isinstance(v, (int, float))
                },
                suggestions=[
                    str(s) for s in (data.get("suggestions") or []) if isinstance(s, str)
                ],
            )
        except (TypeError, ValueError) as e:
            logger.warning("[ai_assistant] SEO report build failed: %s", e)
            return None

    # ===== 封面建议 =====

    async def suggest_cover(self, content: str) -> list[str]:
        """封面设计建议(风格/配色/元素)。"""
        if not content.strip():
            return []
        prompt = (
            "你是封面设计顾问。基于以下正文,建议 3 个封面设计方案"
            "(风格/配色/元素)。每个方案一行,简洁描述:\n\n"
            f"{_truncate(content)}"
        )
        result = await self._complete(prompt)
        if not result:
            return []
        return [line.strip() for line in result.split("\n") if line.strip()][:3]

    # ===== 批量分析(一次调用返回多个结果,减少 LLM 往返) =====

    async def analyze_all(
        self, content: str, title: str, platform: str = ""
    ) -> dict[str, Any]:
        """一次性返回标题候选 + 标签 + 摘要 + SEO + 封面建议。"""
        titles, tags, summary, seo, covers = await asyncio_gather(
            self.generate_titles(content, platform),
            self.recommend_tags(content, platform),
            self.generate_summary(content),
            self.analyze_seo(title, content, platform),
            self.suggest_cover(content),
        )
        return {
            "titles": titles,
            "tags": tags,
            "summary": summary,
            "seo": seo.model_dump() if seo else None,
            "covers": covers,
        }


async def asyncio_gather(*coros: Any) -> list[Any]:
    """asyncio.gather 包装(避免顶层 import asyncio)。"""
    import asyncio
    return list(await asyncio.gather(*coros, return_exceptions=False))


# 单例
ai_writing_service = AiWritingService()
