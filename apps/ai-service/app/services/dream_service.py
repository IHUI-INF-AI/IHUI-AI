"""Dream 梦境服务(对标 OpenClaw Mem Dream 机制)。

空闲时把短期记忆 Consolidation 到长期向量库,提取跨会话模式:
- consolidate(user_id):扫描 episodic 未固化条目 → LLM 提取模式 → 生成 semantic + 更新 procedural
- forget(user_id):基于遗忘曲线衰减 episodic(importance_score < threshold 删除)
- dream_topic(user_id):返回最近梦境主题(LLM 总结最近 10 条 semantic 生成主题标签)

遗忘曲线公式:
  decay_factor *= 0.95^(days_since_access)
  new_importance = original_importance * decay_factor

LLM 调用复用 llm_gateway 单例,失败时优雅降级(不阻塞主流程)。
"""

from __future__ import annotations

import json
import logging
import re
import time
from datetime import datetime, timezone
from typing import Any

from ..core.llm_gateway import llm_gateway
from .memory_service import MemoryService, memory_service

logger = logging.getLogger(__name__)

# 遗忘曲线参数
DECAY_BASE = 0.95  # 每天衰减 5%
DEFAULT_FORGET_THRESHOLD = 0.1  # importance < 0.1 删除
CONSOLIDATE_BATCH_SIZE = 20  # 单次固化最多扫描 20 条 episodic


class DreamService:
    """梦境固化 + 遗忘 + 主题生成服务。"""

    def __init__(
        self,
        memory: MemoryService | None = None,
        gateway: Any = None,
    ) -> None:
        self._memory = memory or memory_service
        self._gateway = gateway or llm_gateway

    async def consolidate(self, user_id: str) -> dict[str, Any]:
        """梦境固化:把 episodic 提炼为 semantic + procedural。

        流程:
        1. 收集 episodic 最近 CONSOLIDATE_BATCH_SIZE 条未固化条目
        2. 调用 LLM 提取跨会话模式(知识/偏好/工具用法)
        3. 知识类 → semantic_memory(带 embedding)
        4. 工具用法类 → procedural_memory(upsert 累加计数)
        5. 标记已固化的 episodic(metadata.consolidated = True)
        6. 生成梦境主题(LLM 总结最近 semantic)

        Returns:
            DreamResult dict:consolidatedCount / patterns / proceduralUpdated / topic / durationMs
        """
        start = time.time()

        # 1. 收集素材(跳过已固化的)
        episodic_list = await self._memory.list_episodic(user_id, limit=CONSOLIDATE_BATCH_SIZE)
        materials: list[str] = []
        unconsolidated: list[dict[str, Any]] = []
        for ep in episodic_list:
            meta = ep.get("metadata") or {}
            if meta.get("consolidated"):
                continue
            unconsolidated.append(ep)
            summary = ep.get("summary") or (ep.get("content", "")[:80])
            materials.append(f"[episodic {summary}] {ep.get('content', '')}")

        if not materials:
            return {
                "userId": user_id,
                "consolidatedCount": 0,
                "patterns": [],
                "proceduralUpdated": 0,
                "forgottenCount": 0,
                "topic": "无素材可固化",
                "durationMs": int((time.time() - start) * 1000),
            }

        # 2. 调用 LLM 提取模式
        prompt = self._build_consolidate_prompt(materials)
        try:
            resp = await self._gateway.complete(
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "你是一个记忆固化助手。从用户的历史对话片段中提取值得长期记忆的"
                            "知识、用户偏好、工具用法模式。严格输出 JSON,格式:\n"
                            '{"knowledge": [{"content": "...", "importance": 0.0-1.0}], '
                            '"patterns": [{"pattern": "...", "tool_name": "...", "success": true}]}'
                        ),
                    },
                    {"role": "user", "content": prompt},
                ],
            )
            content = resp.get("content", "")
            parsed = self._parse_consolidate_response(content)
        except Exception as e:
            logger.warning("[dream] consolidate LLM 调用失败: %s", e)
            parsed = {"knowledge": [], "patterns": []}

        # 3. 知识类 → semantic_memory
        consolidated_count = 0
        for item in parsed.get("knowledge", []):
            try:
                await self._memory.add_semantic(
                    user_id,
                    content=str(item.get("content", "")),
                    importance_score=float(item.get("importance", 0.5)),
                    metadata={"source": "dream_consolidate"},
                )
                consolidated_count += 1
            except Exception as e:
                logger.warning("[dream] add_semantic 失败: %s", e)

        # 4. 工具用法类 → procedural_memory
        procedural_updated = 0
        extracted_patterns: list[str] = []
        for item in parsed.get("patterns", []):
            pattern = str(item.get("pattern", ""))
            if not pattern:
                continue
            extracted_patterns.append(pattern)
            try:
                await self._memory.add_procedural(
                    user_id,
                    pattern=pattern,
                    tool_name=item.get("tool_name"),
                    success=bool(item.get("success", True)),
                    metadata={"source": "dream_consolidate"},
                )
                procedural_updated += 1
            except Exception as e:
                logger.warning("[dream] add_procedural 失败: %s", e)

        # 5. 标记 episodic 已固化
        for ep in unconsolidated:
            try:
                await self._memory.mark_episodic_consolidated(ep["id"])
            except Exception as e:
                logger.warning("[dream] mark_episodic_consolidated 失败: %s", e)

        # 6. 生成梦境主题
        topic = await self._generate_topic(user_id)

        return {
            "userId": user_id,
            "consolidatedCount": consolidated_count,
            "patterns": extracted_patterns,
            "proceduralUpdated": procedural_updated,
            "forgottenCount": 0,
            "topic": topic,
            "durationMs": int((time.time() - start) * 1000),
        }

    async def forget(
        self,
        user_id: str,
        threshold: float = DEFAULT_FORGET_THRESHOLD,
    ) -> dict[str, Any]:
        """基于遗忘曲线衰减 episodic_memory,importance_score < threshold 的删除。

        衰减公式:
          decay_factor *= 0.95^(days_since_access)
          new_importance = original_importance * new_decay_factor

        Returns:
            {"userId": ..., "forgottenCount": N, "decayedCount": M, "threshold": float}
        """
        episodic_list = await self._memory.list_episodic(user_id, limit=500)
        forgotten = 0
        decayed = 0
        now = datetime.now(timezone.utc)

        for ep in episodic_list:
            ep_id = ep["id"]
            # 计算距上次访问的天数(无 last_accessed_at 时用 createdAt 兜底)
            last_accessed_str = ep.get("lastAccessedAt") or ep.get("createdAt")
            last_dt: datetime | None = None
            if last_accessed_str:
                try:
                    last_dt = datetime.fromisoformat(last_accessed_str)
                except (ValueError, TypeError):
                    last_dt = None
            if last_dt is None:
                last_dt = now
            if last_dt.tzinfo is None:
                last_dt = last_dt.replace(tzinfo=timezone.utc)

            days_since = max(0.0, (now - last_dt).total_seconds() / 86400.0)
            current_decay = float(ep.get("decayFactor", 1.0))
            new_decay = current_decay * (DECAY_BASE ** days_since)
            current_importance = float(ep.get("importanceScore", 0.5))
            new_importance = current_importance * new_decay

            if new_importance < threshold:
                try:
                    await self._memory.delete_episodic(ep_id)
                    forgotten += 1
                except Exception as e:
                    logger.warning("[dream] delete_episodic 失败: %s", e)
            else:
                try:
                    await self._memory.update_episodic_decay(
                        ep_id, new_decay, new_importance
                    )
                    decayed += 1
                except Exception as e:
                    logger.warning("[dream] update_episodic_decay 失败: %s", e)

        return {
            "userId": user_id,
            "forgottenCount": forgotten,
            "decayedCount": decayed,
            "threshold": threshold,
        }

    async def dream_topic(self, user_id: str) -> dict[str, Any]:
        """返回最近梦境主题(LLM 总结最近 10 条 semantic_memory)。"""
        topic = await self._generate_topic(user_id)
        semantic_list = await self._memory.list_semantic(user_id, limit=10)
        return {
            "userId": user_id,
            "topic": topic,
            "tags": self._extract_tags(topic),
            "relatedMemoryCount": len(semantic_list),
            "generatedAt": datetime.now(timezone.utc).isoformat(),
        }

    # ------------------------------------------------------------------
    # 内部工具
    # ------------------------------------------------------------------

    async def _generate_topic(self, user_id: str) -> str:
        """调用 LLM 总结最近 10 条 semantic_memory 生成主题标签。"""
        semantic_list = await self._memory.list_semantic(user_id, limit=10)
        if not semantic_list:
            return "尚无足够记忆生成主题"
        contents = [
            s.get("content", "")[:100]
            for s in semantic_list
            if s.get("content")
        ]
        if not contents:
            return "尚无足够记忆生成主题"
        prompt = (
            "以下是用户最近的长期记忆条目,请用一句话(≤30 字)总结主题,"
            "并提取 3-5 个标签:\n\n"
        )
        prompt += "\n".join(f"- {c}" for c in contents)
        try:
            resp = await self._gateway.complete(
                messages=[
                    {
                        "role": "system",
                        "content": "你是记忆主题总结助手。输出格式:主题: <一句话>\n标签: #tag1 #tag2 #tag3",
                    },
                    {"role": "user", "content": prompt},
                ],
            )
            return resp.get("content", "主题生成失败").strip()
        except Exception as e:
            logger.warning("[dream] 主题生成失败: %s", e)
            return "主题生成失败"

    @staticmethod
    def _extract_tags(topic: str) -> list[str]:
        """从主题文本中提取 #tag 标签。"""
        return re.findall(r"#(\w+)", topic)

    @staticmethod
    def _build_consolidate_prompt(materials: list[str]) -> str:
        """构建固化 LLM prompt。"""
        joined = "\n\n".join(materials[:CONSOLIDATE_BATCH_SIZE])
        return (
            f"以下是用户的历史对话片段(共 {len(materials)} 条):\n\n"
            f"{joined}\n\n"
            "请提取:\n"
            "1. 值得长期记忆的知识/事实/用户偏好(写入 knowledge)\n"
            "2. 工具调用模式(如 'search then read' / 'edit then test',写入 patterns)\n"
            "严格输出 JSON,不要额外解释。"
        )

    @staticmethod
    def _parse_consolidate_response(content: str) -> dict[str, Any]:
        """解析 LLM 固化响应(JSON 容错解析,支持 ```json 包裹)。"""
        json_match = re.search(r"```(?:json)?\s*\n?([\s\S]*?)\n?```", content)
        raw = json_match.group(1) if json_match else content
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                return parsed
        except (json.JSONDecodeError, TypeError):
            pass
        return {"knowledge": [], "patterns": []}


dream_service = DreamService()
