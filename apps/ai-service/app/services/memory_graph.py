# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""
记忆图谱服务(P3 #41 阶段1b + 阶段2,2026-09-16 立)。

把平铺的 agent_memory_semantic 条目升级为知识图谱:
- extract_and_store_edges:取用户最近 N 条记忆 → LLM 抽取实体关系 → 幂等写入
  agent_memory_edges(唯一约束 ON CONFLICT DO NOTHING)。由 memory_service.add_semantic
  写入后异步触发(fire-and-forget,失败不影响主流程)。
- query_graph:关键词命中记忆条目 + 一跳邻居 + 相应边 → 子图(前端可视化阶段3 接入)。

关系抽取 prompt 约束 LLM「只基于给定文本,不臆造」;解析容错:非法 JSON / 结构
不符一律返回空,抽取失败永不抛出(记忆主功能零影响)。
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

# 抽取时取最近记忆条数(控制 prompt 长度与 LLM 成本)
EXTRACT_WINDOW = 20
# 单轮抽取超时(s)——超时放弃本轮,不影响记忆主功能
EXTRACT_TIMEOUT_S = 20
# 图谱查询单跳邻居上限(防止超级节点拖垮响应)
QUERY_NEIGHBOR_CAP = 40


async def extract_and_store_edges(owner_uuid: str) -> int:
    """对用户最近记忆做一轮关系抽取并幂等写入边表。返回新增边数。

    任何异常都被吞掉(logger.warning)——调用方 fire-and-forget,主流程零感知。
    """
    if not owner_uuid:
        return 0
    try:
        from ..core.llm_gateway import LLMGateway
        from .memory_service import memory_service

        if LLMGateway._is_stub_mode():
            return 0

        items = await memory_service.list_semantic(owner_uuid, limit=EXTRACT_WINDOW)
        if len(items) < 2:
            return 0  # 少于 2 条无法构成关系

        texts = [str(it.get("content", "")) for it in items]
        ids = [str(it.get("id", "")) for it in items]

        prompt = (
            "以下是一组用户长期记忆条目(编号从 0)。请找出其中存在明确语义关系的条目对,"
            "只基于给定文本判断,不要臆造。输出 JSON 数组,每项 "
            '{"source": <编号>, "target": <编号>, "relation": "<关系短语,如 depends_on/relates_to/contradicts/same_as>"}。'
            "没有明确关系时输出 []。只输出 JSON,不要多余文字。\n\n"
            + "\n".join(f"{i}. {t[:200]}" for i, t in enumerate(texts))
        )
        messages = [{"role": "user", "content": prompt}]
        result = await asyncio.wait_for(
            memory_service._gateway.complete(messages, model=settings_model()),
            timeout=EXTRACT_TIMEOUT_S,
        )
        pairs = _parse_pairs(str(result.get("content", "")))
        if not pairs:
            return 0

        pool = await _get_pool()
        inserted = 0
        async with pool.acquire() as conn:
            for p in pairs:
                si, ti, rel = p
                if si >= len(ids) or ti >= len(ids) or si == ti:
                    continue
                try:
                    tag = await conn.execute(
                        """INSERT INTO agent_memory_edges
                           (user_id, source_id, target_id, relation, weight)
                           VALUES ($1, $2, $3, $4, 1)
                           ON CONFLICT (user_id, source_id, target_id, relation)
                           DO NOTHING""",
                        owner_uuid,
                        ids[si],
                        ids[ti],
                        rel[:64],
                    )
                    inserted += 1 if tag and tag.endswith("1") else 0
                except Exception as e:  # 单条失败不影响其余
                    logger.warning("memory_graph: 单条边写入失败: %s", e)
        return inserted
    except asyncio.TimeoutError:
        logger.warning("memory_graph: 关系抽取超时(>%ss)", EXTRACT_TIMEOUT_S)
    except Exception as e:
        logger.warning("memory_graph: 关系抽取失败(降级): %s", e)
    return 0


def _parse_pairs(content: str) -> list[tuple[int, int, str]]:
    """解析 LLM 输出为 (source_idx, target_idx, relation) 列表。容错:非法输入返回 []。"""
    try:
        start = content.find("[")
        end = content.rfind("]")
        if start < 0 or end <= start:
            return []
        arr = json.loads(content[start : end + 1])
        out: list[tuple[int, int, str]] = []
        for item in arr:
            if not isinstance(item, dict):
                continue
            s, t, r = item.get("source"), item.get("target"), item.get("relation")
            if isinstance(s, int) and isinstance(t, int) and isinstance(r, str) and r.strip():
                out.append((s, t, r.strip()[:64]))
        return out
    except Exception:
        return []


def settings_model() -> str:
    """抽取用的模型(与记忆提炼同源,延迟导入避免循环)。"""
    from ..core.config import settings

    return settings.litellm_model


async def _get_pool():
    from ..core.db_pool import get_shared_pool

    return await get_shared_pool()


async def query_graph(owner_uuid: str, query: str) -> dict[str, Any]:
    """图谱子查询:关键词命中记忆 + 一跳邻居 + 相应边。

    返回 {nodes: [{id, content, importanceScore}], edges: [{source, target, relation, weight}]}。
    """
    empty: dict[str, Any] = {"nodes": [], "edges": []}
    if not owner_uuid:
        return empty
    try:
        pool = await _get_pool()
        kw = f"%{query.strip()[:100]}%"
        async with pool.acquire() as conn:
            hits = await conn.fetch(
                """SELECT id, content, importance_score::text AS importance
                   FROM agent_memory_semantic
                   WHERE user_id = $1 AND content ILIKE $2
                   ORDER BY importance_score DESC, created_at DESC
                   LIMIT 10""",
                owner_uuid,
                kw,
            )
            if not hits:
                return empty
            hit_ids = [str(r["id"]) for r in hits]

            # 一跳邻居(上限 QUERY_NEIGHBOR_CAP,防超级节点)
            neighbors = await conn.fetch(
                """SELECT DISTINCT m.id, m.content, m.importance_score::text AS importance
                   FROM agent_memory_edges e
                   JOIN agent_memory_semantic m
                     ON m.id = CASE WHEN e.source_id::text = ANY($2::uuid[])
                                    THEN e.target_id ELSE e.source_id END
                   WHERE e.user_id = $1
                     AND (e.source_id::text = ANY($2::uuid[]) OR e.target_id::text = ANY($2::uuid[]))
                   LIMIT $3""",
                owner_uuid,
                hit_ids,
                QUERY_NEIGHBOR_CAP,
            )
            edges = await conn.fetch(
                """SELECT source_id::text AS source, target_id::text AS target,
                          relation, weight::text AS weight
                   FROM agent_memory_edges
                   WHERE user_id = $1
                     AND (source_id::text = ANY($2::uuid[]) OR target_id::text = ANY($2::uuid[]))""",
                owner_uuid,
                hit_ids,
            )

        nodes = [
            {
                "id": str(r["id"]),
                "content": r["content"],
                "importanceScore": r["importance"],
                "hit": str(r["id"]) in hit_ids,
            }
            for r in list(hits) + list(neighbors)
        ]
        return {
            "nodes": nodes,
            "edges": [
                {
                    "source": e["source"],
                    "target": e["target"],
                    "relation": e["relation"],
                    "weight": e["weight"],
                }
                for e in edges
            ],
        }
    except Exception as e:
        logger.warning("memory_graph: 子图查询失败(降级为空): %s", e)
        return empty


def fire_and_forget_extract(owner_uuid: str) -> None:
    """记忆写入后的异步抽取入口(fire-and-forget;主流程零感知)。"""
    try:
        asyncio.get_running_loop()
        asyncio.create_task(extract_and_store_edges(owner_uuid))
    except RuntimeError:
        logger.warning("memory_graph: 无 running loop,跳过异步抽取")
