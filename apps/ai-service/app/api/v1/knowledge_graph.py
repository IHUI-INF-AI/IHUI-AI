"""知识图谱 API(G5 - 2026-07-21,G5+ 2026-07-22 加 DrizzleGraphStore 持久化)。

端点(挂载在 /api/v1/ai/knowledge-graph 前缀):
- POST /extract   从一段文本抽取实体 + 关系
- POST /build     从一段文本抽取 + 入库(memory/drizzle store)
- GET  /data      查询某 owner 的图谱数据
- DELETE /data    清除某 owner 的图谱

存储后端由 `KNOWLEDGE_GRAPH_STORE` 环境变量控制:
- `memory` (默认):进程内 dict,dev/test 场景
- `drizzle`:asyncpg 直连 PG,生产场景(进程重启不丢)
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Header
from pydantic import BaseModel, Field

from ...services.knowledge_graph import graph_store, knowledge_graph_service

router = APIRouter()


class ExtractRequest(BaseModel):
    """实体抽取请求。"""

    text: str = Field(..., min_length=1, max_length=32000, description="输入文本")


class BuildRequest(BaseModel):
    """构建图谱请求(从一段文本抽取后入库)。"""

    text: str = Field(..., min_length=1, max_length=32000, description="输入文本")


@router.post("/extract")
async def extract_entities(
    req: ExtractRequest,
    x_owner_uuid: str | None = Header(default=None, alias="X-Owner-Uuid"),
) -> dict[str, Any]:
    """从一段文本抽取实体 + 关系(不入库)。"""
    try:
        result = await knowledge_graph_service.extract(req.text, owner_uuid=x_owner_uuid)
        return {
            "code": 0,
            "message": "ok",
            "data": {
                "entities": result["entities"],
                "relations": result["relations"],
                "stub": result["stub"],
            },
        }
    except Exception as e:
        return {
            "code": 500,
            "message": f"抽取失败: {e}",
            "data": {"error": str(e)},
        }


@router.post("/build")
async def build_graph(
    req: BuildRequest,
    x_owner_uuid: str | None = Header(default=None, alias="X-Owner-Uuid"),
) -> dict[str, Any]:
    """从一段文本抽取后入库(内存 store)。"""
    owner = x_owner_uuid or "anonymous"
    try:
        result = await knowledge_graph_service.extract(req.text, owner_uuid=owner)

        # 入库(upsert 实体 + 关系)
        entity_map: dict[str, dict[str, Any]] = {}
        for e in result["entities"]:
            saved = await graph_store.upsert_entity(
                owner_uuid=owner,
                name=e["name"],
                entity_type=e["type"],
                description=e.get("description"),
            )
            entity_map[e["name"]] = saved

        relation_count = 0
        for r in result["relations"]:
            src = entity_map.get(r["source"])
            tgt = entity_map.get(r["target"])
            if not src or not tgt:
                continue
            await graph_store.upsert_relation(
                owner_uuid=owner,
                source_entity_id=src["id"],
                target_entity_id=tgt["id"],
                relation_type=r["type"],
                description=r.get("description"),
            )
            relation_count += 1

        return {
            "code": 0,
            "message": "ok",
            "data": {
                "entities_added": len(entity_map),
                "relations_added": relation_count,
                "stub": result["stub"],
            },
        }
    except Exception as e:
        return {
            "code": 500,
            "message": f"构建图谱失败: {e}",
            "data": {"error": str(e)},
        }


@router.get("/data")
async def get_graph_data(
    x_owner_uuid: str | None = Header(default=None, alias="X-Owner-Uuid"),
) -> dict[str, Any]:
    """获取某 owner 的图谱数据(节点 + 边)。"""
    owner = x_owner_uuid or "anonymous"
    graph = await graph_store.get_graph(owner)
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "owner_uuid": owner,
            "entities": graph["entities"],
            "relations": graph["relations"],
            "stats": {
                "entity_count": len(graph["entities"]),
                "relation_count": len(graph["relations"]),
            },
        },
    }


@router.delete("/data")
async def clear_graph(
    x_owner_uuid: str | None = Header(default=None, alias="X-Owner-Uuid"),
) -> dict[str, Any]:
    """清除某 owner 的图谱数据。"""
    owner = x_owner_uuid or "anonymous"
    before = await graph_store.get_graph(owner)
    await graph_store.clear(owner)
    return {
        "code": 0,
        "message": "ok",
        "data": {
            "owner_uuid": owner,
            "cleared_entities": len(before["entities"]),
            "cleared_relations": len(before["relations"]),
        },
    }
