# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:

"""任务经验沉淀抽取器(2-1c,2026-09-10 立)。

从 Agent 任务对话中提炼可复用的知识卡片(任务经验/项目事实/最佳实践/踩坑记录),
经 LLM 抽取后写入 apps/api 的 knowledge_cards 表(source='agent'),
与手动录入(2-1b 前端)、knowledge_lookup 检索(本任务 2-1c-3)构成经验复用闭环:

    任务对话 → LLM 抽取 ──→ 写卡(HTTP POST /api/knowledge-cards/,X-Internal-Secret)
                                    ↓
    同仓库后续任务 ← knowledge_lookup 注入(knowledge_cards 源,GET /search)

设计原则(对标 memory_extractor):
- LLM 失败降级返回空列表,不抛错;写卡失败降级跳过该卡,不阻塞其余卡片
- 容错 JSON 解析(剥 ```json 围栏 → 数组正则 → 对象 extracted 字段兜底)
- 字段标准化(kind 白名单 / tags 清洗截断 / confidence 0-1 → 0-100 整数)
"""

from __future__ import annotations

import json
import logging
import re
import time
from typing import Any

logger = logging.getLogger(__name__)

# 卡片类型白名单(与 api 侧 knowledge-card.ts cardKindSchema 对齐)
_VALID_KINDS = {"experience", "fact", "practices", "pitfall"}

# 单条消息截断长度(prompt token 控制,同 memory_extractor)
_MAX_MSG_CHARS = 500
# 对话整体截断长度
_MAX_CONVO_CHARS = 4000


class KnowledgeCardExtractor:
    """从任务对话中抽取知识卡片并写库。"""

    # 卡片类型 → 中文说明(喂给 LLM 的 prompt 用)
    _KIND_HINTS = {
        "experience": "任务经验(完成某类任务的可复用做法/步骤/方法)",
        "fact": "项目事实(架构/约定/依赖/环境约束)",
        "practices": "最佳实践(本仓库验证有效的规范做法)",
        "pitfall": "踩坑记录(遇到的问题 + 根因 + 解决办法)",
    }

    async def extract_and_save(
        self,
        messages: list[dict[str, Any]] | dict[str, Any],
        repo_name: str,
        *,
        user_id: str | None = None,
        session_id: str | None = None,
    ) -> dict[str, Any]:
        """从任务对话中抽取知识卡片并写入 knowledge_cards 表。

        Args:
            messages:   对话消息列表 [{role, content}],或单 dict 调用
                        {messages, repoName, userId, sessionId}(键名兼容驼峰)
            repo_name:  仓库名(卡片绑定维度)
            user_id:    归属用户(缺省写全局卡 userId=NULL,所有登录用户可见)
            session_id: 会话 ID(可选,记入卡片 context 便于溯源)

        Returns:
            {"extracted": [标准化后的卡片...], "saved": [api 返回的落库行...],
             "durationMs": int}
            LLM 失败 → extracted=[];写卡失败的卡片不进 saved,均不抛错。
        """
        start = time.time()

        # 兼容单 dict 调用
        if isinstance(messages, dict):
            req = messages
            messages = req.get("messages", []) or []
            repo_name = str(req.get("repoName") or req.get("repo_name") or repo_name)
            user_id = req.get("userId") or req.get("user_id") or user_id
            session_id = req.get("sessionId") or req.get("session_id") or session_id

        if not messages or not repo_name:
            return {
                "extracted": [],
                "saved": [],
                "durationMs": int((time.time() - start) * 1000),
            }

        # 1. LLM 抽取(失败降级空列表)
        cards = await self._llm_extract(messages, repo_name)

        # 2. 逐卡写库(单卡失败跳过,不阻塞其余)
        saved: list[dict[str, Any]] = []
        for card in cards:
            row = await self._save_card(card, repo_name, user_id=user_id, session_id=session_id)
            if row is not None:
                saved.append(row)

        if cards:
            logger.info(
                "[knowledge_card_extractor] 仓库 %s 抽取 %d 卡,落库 %d",
                repo_name,
                len(cards),
                len(saved),
            )

        return {
            "extracted": cards,
            "saved": saved,
            "durationMs": int((time.time() - start) * 1000),
        }

    async def _llm_extract(
        self,
        messages: list[dict[str, Any]],
        repo_name: str,
    ) -> list[dict[str, Any]]:
        """调 LLM 从任务对话中抽取知识卡片,返回标准化后的卡片列表。失败返回空列表。"""
        # 构建对话文本(控制 token,过长则截断,同 memory_extractor 策略)
        convo_lines: list[str] = []
        for idx, msg in enumerate(messages):
            role = str(msg.get("role", "user"))
            content = str(msg.get("content", ""))
            if not content:
                continue
            if len(content) > _MAX_MSG_CHARS:
                content = content[:_MAX_MSG_CHARS] + "..."
            convo_lines.append(f"[{idx}] {role}: {content}")
        convo_text = "\n".join(convo_lines)
        if len(convo_text) > _MAX_CONVO_CHARS:
            convo_text = convo_text[:_MAX_CONVO_CHARS] + "\n...(已截断)"

        kind_hints = "\n".join(
            f"- {k}: {desc}" for k, desc in self._KIND_HINTS.items()
        )
        prompt = (
            "你是任务经验沉淀助手。从下面的任务对话中提炼可复用的知识卡片,"
            f"沉淀到仓库「{repo_name}」。\n"
            "卡片类型:\n"
            f"{kind_hints}\n\n"
            "任务对话:\n"
            f"{convo_text}\n\n"
            "请输出 JSON 数组,每个元素格式:\n"
            '{"kind": "experience|fact|practices|pitfall", '
            '"title": "一句话标题(概括卡片要点)", '
            '"content": "卡片正文(markdown,含可操作细节:做法/步骤/根因/解法)", '
            '"tags": ["检索标签"], '
            '"confidence": 0.0-1.0}\n\n'
            "只输出 JSON 数组,不要额外解释。若无值得沉淀的经验,输出 []。"
        )

        try:
            from ..core.llm_gateway import llm_gateway
            resp = await llm_gateway.complete(
                [{"role": "user", "content": prompt}],
            )
            content = str(resp.get("content", "")) if isinstance(resp, dict) else ""
            return self._parse_extract_output(content)
        except Exception as e:
            logger.warning(
                "knowledge_card_extractor._llm_extract LLM 抽取失败: %s", e, exc_info=True
            )
            return []

    @staticmethod
    def _parse_extract_output(content: str) -> list[dict[str, Any]]:
        """解析 LLM 输出为标准化卡片列表(容错,复用 memory_extractor 模式)。

        优先提取 JSON 数组,其次提取 JSON 对象中的 extracted/cards 字段;
        每条标准化:kind 白名单校验、title/content 去空白、tags 清洗截断、
        confidence 0-1 浮点 → 0-100 整数。
        """
        if not content:
            return []
        # 去除 ```json 包裹
        cleaned = re.sub(r"```(?:json)?\s*", "", content).strip()
        # 优先尝试 JSON 数组
        raw_items: list[Any] = []
        arr_match = re.search(r"\[.*\]", cleaned, re.DOTALL)
        if arr_match:
            try:
                arr = json.loads(arr_match.group())
                if isinstance(arr, list):
                    raw_items = arr
            except (json.JSONDecodeError, TypeError):
                pass
        # 兜底:JSON 对象中的 extracted / cards 字段
        if not raw_items:
            obj_match = re.search(r"\{.*\}", cleaned, re.DOTALL)
            if obj_match:
                try:
                    obj = json.loads(obj_match.group())
                    if isinstance(obj, dict):
                        for key in ("extracted", "cards"):
                            field = obj.get(key)
                            if isinstance(field, list):
                                raw_items = field
                                break
                except (json.JSONDecodeError, TypeError):
                    pass

        cards: list[dict[str, Any]] = []
        for item in raw_items:
            if not isinstance(item, dict):
                continue
            card = KnowledgeCardExtractor._normalize_card(item)
            if card is not None:
                cards.append(card)
        return cards

    @staticmethod
    def _normalize_card(item: dict[str, Any]) -> dict[str, Any] | None:
        """标准化单张卡片:字段校验 + 清洗。无 title 或 content → 返回 None(丢弃)。"""
        title = str(item.get("title", "")).strip()
        content = str(item.get("content", "")).strip()
        if not title or not content:
            return None

        kind = str(item.get("kind", "experience")).strip().lower()
        if kind not in _VALID_KINDS:
            kind = "experience"

        # tags 清洗:字符串条目 → strip → 去空 → 截断 20 个,单个 ≤50 字符
        raw_tags = item.get("tags")
        tags: list[str] = []
        if isinstance(raw_tags, list):
            tags = [t[:50] for t in (str(x).strip() for x in raw_tags) if t][:20]

        # confidence:LLM 自评 0.0-1.0 → 0-100 整数(非法值回退 80)
        try:
            conf = float(item.get("confidence", 0.8))
        except (TypeError, ValueError):
            conf = 0.8
        confidence = max(0, min(100, int(round(conf * 100))))

        return {
            "kind": kind,
            "title": title[:300],
            "content": content[:20_000],
            "tags": tags,
            "confidence": confidence,
        }

    async def _save_card(
        self,
        card: dict[str, Any],
        repo_name: str,
        *,
        user_id: str | None = None,
        session_id: str | None = None,
    ) -> dict[str, Any] | None:
        """写单张卡片到 apps/api(source=agent,内部密钥认证)。失败返回 None。"""
        from ..core.config import settings
        from .api_client import get_api_client

        payload: dict[str, Any] = {
            "repoName": repo_name,
            "kind": card["kind"],
            "title": card["title"],
            "content": card["content"],
            "tags": card["tags"],
            "confidence": card["confidence"],
        }
        if user_id:
            payload["userId"] = user_id
        # 结构化上下文:溯源信息(任务会话 + 来源标注)
        payload["context"] = {"source": "agent", **({"sessionId": session_id} if session_id else {})}

        try:
            client = get_api_client()
            resp = await client.post(
                f"{settings.api_service_url}/api/knowledge-cards/",
                json=payload,
                headers={"X-Internal-Secret": settings.ai_callback_secret},
            )
            resp.raise_for_status()
            body = resp.json()
            if isinstance(body, dict) and body.get("code") == 0:
                data = body.get("data")
                if isinstance(data, dict):
                    return data
            logger.warning(
                "[knowledge_card_extractor] 写卡响应异常(跳过): %s", body
            )
            return None
        except Exception as e:
            logger.warning(
                "[knowledge_card_extractor] 写卡失败(降级跳过): %s", e, exc_info=True
            )
            return None


# 模块级单例(与 memory_extractor 等服务同风格)
knowledge_card_extractor = KnowledgeCardExtractor()
