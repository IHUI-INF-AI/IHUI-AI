"""知识图谱服务(G5 - 2026-07-21,G5+ 2026-07-22 加 DrizzleGraphStore 持久化)。

提供:
- LLM NER 实体抽取(从一段文本抽取实体 + 关系)
- 从 RAG 文档批量构建图谱
- 查询某 owner 的图谱数据(节点 + 边)

设计:
- LLM 不可用(stub 模式)时,降级为关键词 NER(用简单启发式规则抽取大写名词/中文实体)
- 实体去重:(owner_uuid, name, type) 唯一约束
- 关系去重:(owner_uuid, source, target, type) 唯一约束
- 频次累加:同一实体被多次抽取时 frequency + 1,doc_ids 累加
- 关系权重:同一 (source, target, type) 边被多次抽取时 weight + 1

存储后端(由环境变量 `KNOWLEDGE_GRAPH_STORE` 决定):
- `memory` (默认): InMemoryGraphStore,进程内 dict,dev/test 场景
- `drizzle`:      DrizzleGraphStore,用 asyncpg 直连 PG,生产场景(进程重启不丢)
- 未知值: 启动时打 warning 强制回退到 memory,避免运行时崩溃

所有后端通过 `GraphStore` Protocol 暴露异步方法,API 路由统一 `await` 调用,
便于在不同后端之间无缝切换且未来可加新后端(CosmosDB / Neo4j 等)。
"""

from __future__ import annotations

import json
import logging
import os
import re
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Protocol

import asyncpg

from ..core.config import settings
from ..core.llm_gateway import llm_gateway

logger = logging.getLogger(__name__)

# 实体类型白名单
_ENTITY_TYPES = (
    "person",
    "org",
    "concept",
    "location",
    "event",
    "product",
    "technology",
    "other",
)

# 关系类型白名单
_RELATION_TYPES = (
    "works_for",
    "located_in",
    "part_of",
    "related_to",
    "created_by",
    "uses",
    "competes_with",
    "acquired_by",
    "other",
)

# 中文停用词(简易列表,只覆盖最常见的)
_CN_STOPWORDS = set(
    "的 了 是 在 和 与 及 或 也 都 还 但 而 被 从 到 把 让 使 为 对 这 那 你 我 他 她 它 我们 你好 请 谢谢".split()
)

_NER_SYSTEM_PROMPT = """你是专业的实体关系抽取助手。从给定文本中抽取:
1. entities: 实体列表,每条 {name, type, description}
   - type ∈ {person, org, concept, location, event, product, technology, other}
2. relations: 关系列表,每条 {source, target, type, description}
   - type ∈ {works_for, located_in, part_of, related_to, created_by, uses, competes_with, acquired_by, other}
   - source/target 必须用 entities 里的 name

只返回严格 JSON,不要解释,不要 markdown 代码块。格式:
{"entities": [{"name": "...", "type": "...", "description": "..."}], "relations": [{"source": "...", "target": "...", "type": "...", "description": "..."}]}
"""


class KnowledgeGraphService:
    """知识图谱服务(单例)。"""

    def __init__(self, gateway: Any = None) -> None:
        self._gateway = gateway or llm_gateway

    @staticmethod
    def _stub_extract(text: str) -> dict[str, list[dict[str, Any]]]:
        """无 LLM 时的关键词 NER fallback(简易启发式)。

        规则:
        - 中文 2-6 字连续片段(过滤停用词首字) → 实体
        - 英文大写开头 1-3 词 → 实体(type 推断)
        - 实体 A 出现在实体 B 之后 → 创建 related_to 关系
        """
        entities: list[dict[str, Any]] = []
        seen: set[tuple[str, str]] = set()

        # 中文片段(2-3 字,sliding window 非贪婪优先 2 字,去重 + 停用词过滤)
        for m in re.finditer(r"[\u4e00-\u9fff]{2,3}?", text):
            name = m.group(0)
            if name[0] in _CN_STOPWORDS:
                continue
            if len(set(name)) == 1:  # 过滤"哈哈""天天"这种重复字
                continue
            key = (name, "concept")
            if key in seen:
                continue
            seen.add(key)
            entities.append({
                "name": name,
                "type": "concept",
                "description": f"从文本抽取: {name}",
            })

        # 英文连续大写开头词
        for m in re.finditer(r"\b[A-Z][a-zA-Z]{1,}(?:\s+[A-Z][a-zA-Z]{1,}){0,2}\b", text):
            name = m.group(0).strip()
            key = (name, "concept")
            if key in seen:
                continue
            seen.add(key)
            entities.append({
                "name": name,
                "type": "concept",
                "description": f"从文本抽取: {name}",
            })

        # 简易关系:相邻实体间 related_to
        relations: list[dict[str, Any]] = []
        for i in range(len(entities) - 1):
            relations.append({
                "source": entities[i]["name"],
                "target": entities[i + 1]["name"],
                "type": "related_to",
                "description": "相邻共现(启发式推断)",
            })

        return {"entities": entities[:30], "relations": relations[:30]}

    @staticmethod
    def _parse_json_object(text: str) -> dict[str, Any] | None:
        """从 LLM 输出中提取 JSON 对象(处理 ```json 围栏和前/后杂文本)。"""
        if not text:
            return None
        # 去掉 markdown 围栏
        text = re.sub(r"^```(?:json)?\s*", "", text.strip())
        text = re.sub(r"\s*```$", "", text)
        # 尝试直接 parse
        try:
            obj = json.loads(text)
            if isinstance(obj, dict):
                return obj
        except (json.JSONDecodeError, TypeError):
            pass
        # 从 { 开始截取到匹配的 }
        start = text.find("{")
        if start < 0:
            return None
        depth = 0
        for i in range(start, len(text)):
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
                if depth == 0:
                    snippet = text[start : i + 1]
                    try:
                        obj = json.loads(snippet)
                        if isinstance(obj, dict):
                            return obj
                    except (json.JSONDecodeError, TypeError):
                        return None
        return None

    async def extract(self, text: str, *, owner_uuid: str | None = None) -> dict[str, Any]:
        """从一段文本抽取实体和关系。

        Args:
            text: 输入文本。
            owner_uuid: 用户 UUID(stub 模式可选)。

        Returns:
            {"entities": [...], "relations": [...], "stub": bool}
        """
        if not text or not text.strip():
            return {"entities": [], "relations": [], "stub": False}

        # stub 模式直接走关键词 NER
        from ..core.llm_gateway import LLMGateway

        if LLMGateway._is_stub_mode():
            result = self._stub_extract(text)
            result["stub"] = True
            return result

        # 真实 LLM 调用
        messages = [
            {"role": "system", "content": _NER_SYSTEM_PROMPT},
            {"role": "user", "content": text[:8000]},  # 限制输入长度
        ]
        try:
            response = await self._gateway.complete(messages, owner_uuid=owner_uuid)
            content = response.get("content", "")
            obj = self._parse_json_object(content) or {}
        except Exception:
            obj = {}

        entities = obj.get("entities", [])
        relations = obj.get("relations", [])
        # 过滤非法 type
        entities = [
            e for e in entities
            if isinstance(e, dict) and e.get("name") and e.get("type") in _ENTITY_TYPES
        ]
        relations = [
            r for r in relations
            if isinstance(r, dict)
            and r.get("source")
            and r.get("target")
            and r.get("type") in _RELATION_TYPES
        ]

        return {
            "entities": entities,
            "relations": relations,
            "stub": False,
        }


# 全局单例
knowledge_graph_service = KnowledgeGraphService()


# =============================================================================
# 存储层(G5+ 2026-07-22:加 DrizzleGraphStore 持久化后端)
# =============================================================================


class GraphStore(Protocol):
    """知识图谱存储统一接口(Protocol,Python 3.8+ 结构化子类型)。

    所有方法必须为 async,以便上层 API 路由统一 `await` 调用。
    InMemoryGraphStore 内部用 sync 实现但通过 `_async_*` 包装或 thin async wrapper
    保持接口一致;DrizzleGraphStore 用 asyncpg 原生 async。
    """

    async def upsert_entity(
        self,
        owner_uuid: str,
        name: str,
        entity_type: str,
        description: str | None = None,
        doc_id: int | None = None,
    ) -> dict[str, Any]: ...

    async def upsert_relation(
        self,
        owner_uuid: str,
        source_entity_id: int,
        target_entity_id: int,
        relation_type: str,
        description: str | None = None,
    ) -> dict[str, Any]: ...

    async def get_graph(self, owner_uuid: str) -> dict[str, Any]: ...

    async def clear(self, owner_uuid: str | None = None) -> None: ...


def _entity_to_dict(row: asyncpg.Record) -> dict[str, Any]:
    """把 asyncpg 行(实体表)转成 dict,统一字段命名(snake_case → API 期望的命名)。

    API 期望字段:id / owner_uuid / name / type / description / frequency / doc_ids
    """
    return {
        "id": row["id"],
        "owner_uuid": row["owner_uuid"],
        "name": row["name"],
        "type": row["type"],
        "description": row["description"],
        "frequency": row["frequency"],
        "doc_ids": list(row["doc_ids"]) if row["doc_ids"] else [],
    }


def _relation_to_dict(row: asyncpg.Record) -> dict[str, Any]:
    """把 asyncpg 行(关系表)转成 dict,统一字段命名。

    API 期望字段:id / owner_uuid / source_entity_id / target_entity_id /
    relation_type / description / weight
    """
    weight = row["weight"]
    if isinstance(weight, Decimal):
        weight = float(weight)
    return {
        "id": row["id"],
        "owner_uuid": row["owner_uuid"],
        "source_entity_id": row["source_entity_id"],
        "target_entity_id": row["target_entity_id"],
        "relation_type": row["relation_type"],
        "description": row["description"],
        "weight": weight,
    }


class InMemoryGraphStore:
    """内存版图谱存储,用于 dev/test 场景,生产用 DrizzleGraphStore。

    所有方法保持 async 接口(虽然内部是同步),与 GraphStore Protocol 一致。
    """

    def __init__(self) -> None:
        self.entities: dict[tuple[str, str, str], dict[str, Any]] = {}
        self.relations: dict[tuple[str, int, int, str], dict[str, Any]] = {}
        self._next_entity_id = 1
        self._next_relation_id = 1

    async def upsert_entity(
        self,
        owner_uuid: str,
        name: str,
        entity_type: str,
        description: str | None = None,
        doc_id: int | None = None,
    ) -> dict[str, Any]:
        key = (owner_uuid, name, entity_type)
        existing = self.entities.get(key)
        if existing:
            existing["frequency"] += 1
            if doc_id and doc_id not in existing["doc_ids"]:
                existing["doc_ids"].append(doc_id)
            return existing
        entity = {
            "id": self._next_entity_id,
            "owner_uuid": owner_uuid,
            "name": name,
            "type": entity_type,
            "description": description,
            "frequency": 1,
            "doc_ids": [doc_id] if doc_id else [],
        }
        self._next_entity_id += 1
        self.entities[key] = entity
        return entity

    async def upsert_relation(
        self,
        owner_uuid: str,
        source_entity_id: int,
        target_entity_id: int,
        relation_type: str,
        description: str | None = None,
    ) -> dict[str, Any]:
        key = (owner_uuid, source_entity_id, target_entity_id, relation_type)
        existing = self.relations.get(key)
        if existing:
            existing["weight"] = float(existing["weight"]) + 1
            return existing
        relation = {
            "id": self._next_relation_id,
            "owner_uuid": owner_uuid,
            "source_entity_id": source_entity_id,
            "target_entity_id": target_entity_id,
            "relation_type": relation_type,
            "description": description,
            "weight": 1,
        }
        self._next_relation_id += 1
        self.relations[key] = relation
        return relation

    async def get_graph(self, owner_uuid: str) -> dict[str, Any]:
        entities = [e for e in self.entities.values() if e["owner_uuid"] == owner_uuid]
        relations = [r for r in self.relations.values() if r["owner_uuid"] == owner_uuid]
        return {"entities": entities, "relations": relations}

    async def clear(self, owner_uuid: str | None = None) -> None:
        if owner_uuid is None:
            self.entities.clear()
            self.relations.clear()
            self._next_entity_id = 1
            self._next_relation_id = 1
        else:
            self.entities = {
                k: v for k, v in self.entities.items() if k[0] != owner_uuid
            }
            self.relations = {
                k: v for k, v in self.relations.items() if k[0] != owner_uuid
            }


class DrizzleGraphStore:
    """基于 asyncpg 直连 PostgreSQL 的图谱存储(生产环境)。

    复用 `packages/database/drizzle/0125_knowledge_graph.sql` 创建的两张表:
    - zhs_knowledge_entity   (实体表)
    - zhs_knowledge_relation (关系表)

    设计:
    - 单例 asyncpg pool,所有方法复用同一连接池(性能 + 连接数控制)
    - upsert_entity:先 SELECT,存在则 frequency+1 + doc_ids 累加;不存在则 INSERT
    - upsert_relation:先 SELECT,存在则 weight+1;不存在则 INSERT
    - get_graph:按 owner_uuid 过滤查询节点 + 边
    - clear:按 owner_uuid DELETE,owner_uuid=None 时全表清空(仅 admin 用)
    - 所有方法在 DB 不可达时抛 RuntimeError,上层 API 路由捕获并返回 500
    """

    def __init__(self) -> None:
        if not settings.database_url:
            raise ValueError("DATABASE_URL 未配置,无法初始化 DrizzleGraphStore")
        self._dsn = settings.database_url
        self._pool: asyncpg.Pool | None = None

    async def _get_pool(self) -> asyncpg.Pool:
        """懒加载 asyncpg pool,首次访问时创建,后续复用。"""
        if self._pool is None:
            self._pool = await asyncpg.create_pool(
                dsn=self._dsn,
                min_size=1,
                max_size=5,
                command_timeout=10,
            )
        return self._pool

    async def close(self) -> None:
        """关闭 pool(应用关闭时调用,释放连接)。"""
        if self._pool is not None:
            await self._pool.close()
            self._pool = None

    async def upsert_entity(
        self,
        owner_uuid: str,
        name: str,
        entity_type: str,
        description: str | None = None,
        doc_id: int | None = None,
    ) -> dict[str, Any]:
        """Upsert 实体:存在则 frequency+1 + doc_ids 累加,不存在则 INSERT。

        唯一约束 (owner_uuid, name, type) 保证并发安全,即使两个请求同时插入,
        第二个会被 unique violation 触发,本方法捕获后回退到 SELECT 路径。
        """
        pool = await self._get_pool()
        now = datetime.now(timezone.utc)

        async with pool.acquire() as conn:
            # 1. 先查现有实体
            existing = await conn.fetchrow(
                """
                SELECT id, owner_uuid, name, type, description, frequency, doc_ids
                FROM zhs_knowledge_entity
                WHERE owner_uuid = $1 AND name = $2 AND type = $3
                """,
                owner_uuid,
                name,
                entity_type,
            )

            if existing is not None:
                # 2. 更新 frequency + doc_ids(JSONB 数组追加)
                new_doc_ids = list(existing["doc_ids"]) if existing["doc_ids"] else []
                if doc_id is not None and doc_id not in new_doc_ids:
                    new_doc_ids.append(doc_id)
                row = await conn.fetchrow(
                    """
                    UPDATE zhs_knowledge_entity
                    SET frequency = frequency + 1,
                        doc_ids = $2::jsonb,
                        updated_at = $3
                    WHERE id = $1
                    RETURNING id, owner_uuid, name, type, description, frequency, doc_ids
                    """,
                    existing["id"],
                    json.dumps(new_doc_ids),
                    now,
                )
            else:
                # 3. 插入新实体
                initial_doc_ids = [doc_id] if doc_id is not None else []
                try:
                    row = await conn.fetchrow(
                        """
                        INSERT INTO zhs_knowledge_entity
                            (owner_uuid, name, type, description, frequency, doc_ids, created_at, updated_at)
                        VALUES ($1, $2, $3, $4, 1, $5::jsonb, $6, $6)
                        RETURNING id, owner_uuid, name, type, description, frequency, doc_ids
                        """,
                        owner_uuid,
                        name,
                        entity_type,
                        description,
                        json.dumps(initial_doc_ids),
                        now,
                    )
                except asyncpg.UniqueViolationError:
                    # 并发竞争:另一请求同时插入,降级到 SELECT 路径
                    row = await conn.fetchrow(
                        """
                        SELECT id, owner_uuid, name, type, description, frequency, doc_ids
                        FROM zhs_knowledge_entity
                        WHERE owner_uuid = $1 AND name = $2 AND type = $3
                        """,
                        owner_uuid,
                        name,
                        entity_type,
                    )
                    if row is None:
                        raise RuntimeError(
                            f"upsert_entity 并发竞争后仍找不到实体: "
                            f"owner={owner_uuid} name={name} type={entity_type}"
                        )
                    # 重新走更新路径
                    new_doc_ids = list(row["doc_ids"]) if row["doc_ids"] else []
                    if doc_id is not None and doc_id not in new_doc_ids:
                        new_doc_ids.append(doc_id)
                    row = await conn.fetchrow(
                        """
                        UPDATE zhs_knowledge_entity
                        SET frequency = frequency + 1,
                            doc_ids = $2::jsonb,
                            updated_at = $3
                        WHERE id = $1
                        RETURNING id, owner_uuid, name, type, description, frequency, doc_ids
                        """,
                        row["id"],
                        json.dumps(new_doc_ids),
                        now,
                    )

        assert row is not None
        return _entity_to_dict(row)

    async def upsert_relation(
        self,
        owner_uuid: str,
        source_entity_id: int,
        target_entity_id: int,
        relation_type: str,
        description: str | None = None,
    ) -> dict[str, Any]:
        """Upsert 关系:存在则 weight+1,不存在则 INSERT。

        唯一约束 (owner_uuid, source_entity_id, target_entity_id, relation_type)
        保证并发安全,UniqueViolation 走并发降级路径。
        """
        pool = await self._get_pool()
        now = datetime.now(timezone.utc)

        async with pool.acquire() as conn:
            existing = await conn.fetchrow(
                """
                SELECT id, owner_uuid, source_entity_id, target_entity_id,
                       relation_type, description, weight
                FROM zhs_knowledge_relation
                WHERE owner_uuid = $1
                  AND source_entity_id = $2
                  AND target_entity_id = $3
                  AND relation_type = $4
                """,
                owner_uuid,
                source_entity_id,
                target_entity_id,
                relation_type,
            )

            if existing is not None:
                row = await conn.fetchrow(
                    """
                    UPDATE zhs_knowledge_relation
                    SET weight = weight + 1,
                        updated_at = $2
                    WHERE id = $1
                    RETURNING id, owner_uuid, source_entity_id, target_entity_id,
                              relation_type, description, weight
                    """,
                    existing["id"],
                    now,
                )
            else:
                try:
                    row = await conn.fetchrow(
                        """
                        INSERT INTO zhs_knowledge_relation
                            (owner_uuid, source_entity_id, target_entity_id,
                             relation_type, description, weight, created_at, updated_at)
                        VALUES ($1, $2, $3, $4, $5, 1, $6, $6)
                        RETURNING id, owner_uuid, source_entity_id, target_entity_id,
                                  relation_type, description, weight
                        """,
                        owner_uuid,
                        source_entity_id,
                        target_entity_id,
                        relation_type,
                        description,
                        now,
                    )
                except asyncpg.UniqueViolationError:
                    # 并发降级
                    row = await conn.fetchrow(
                        """
                        SELECT id, owner_uuid, source_entity_id, target_entity_id,
                               relation_type, description, weight
                        FROM zhs_knowledge_relation
                        WHERE owner_uuid = $1
                          AND source_entity_id = $2
                          AND target_entity_id = $3
                          AND relation_type = $4
                        """,
                        owner_uuid,
                        source_entity_id,
                        target_entity_id,
                        relation_type,
                    )
                    if row is None:
                        raise RuntimeError(
                            f"upsert_relation 并发竞争后仍找不到关系: "
                            f"owner={owner_uuid} src={source_entity_id} "
                            f"tgt={target_entity_id} type={relation_type}"
                        )
                    row = await conn.fetchrow(
                        """
                        UPDATE zhs_knowledge_relation
                        SET weight = weight + 1,
                            updated_at = $2
                        WHERE id = $1
                        RETURNING id, owner_uuid, source_entity_id, target_entity_id,
                                  relation_type, description, weight
                        """,
                        row["id"],
                        now,
                    )

        assert row is not None
        return _relation_to_dict(row)

    async def get_graph(self, owner_uuid: str) -> dict[str, Any]:
        """查询某 owner 的图谱数据(节点 + 边)。"""
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            entity_rows = await conn.fetch(
                """
                SELECT id, owner_uuid, name, type, description, frequency, doc_ids
                FROM zhs_knowledge_entity
                WHERE owner_uuid = $1
                ORDER BY id ASC
                """,
                owner_uuid,
            )
            relation_rows = await conn.fetch(
                """
                SELECT id, owner_uuid, source_entity_id, target_entity_id,
                       relation_type, description, weight
                FROM zhs_knowledge_relation
                WHERE owner_uuid = $1
                ORDER BY id ASC
                """,
                owner_uuid,
            )
        return {
            "entities": [_entity_to_dict(r) for r in entity_rows],
            "relations": [_relation_to_dict(r) for r in relation_rows],
        }

    async def clear(self, owner_uuid: str | None = None) -> None:
        """清除图谱数据。

        - owner_uuid 给定:只删该 owner 的实体 + 关系
        - owner_uuid=None:全表清空(危险,仅 admin 场景使用,生产应禁用)
        """
        pool = await self._get_pool()
        async with pool.acquire() as conn:
            if owner_uuid is None:
                # 全表清空:先 relations 再 entities(无外键约束,但按依赖顺序更清晰)
                await conn.execute("TRUNCATE zhs_knowledge_relation")
                await conn.execute("TRUNCATE zhs_knowledge_entity RESTART IDENTITY")
            else:
                await conn.execute(
                    "DELETE FROM zhs_knowledge_relation WHERE owner_uuid = $1",
                    owner_uuid,
                )
                await conn.execute(
                    "DELETE FROM zhs_knowledge_entity WHERE owner_uuid = $1",
                    owner_uuid,
                )


# =============================================================================
# 全局 graph_store 工厂(根据环境变量选择后端)
# =============================================================================


def _create_graph_store() -> GraphStore:
    """根据环境变量 `KNOWLEDGE_GRAPH_STORE` 选择后端。"""
    backend = os.getenv("KNOWLEDGE_GRAPH_STORE", "memory").lower()
    if backend == "drizzle":
        try:
            store: GraphStore = DrizzleGraphStore()
            logger.info("知识图谱存储后端: DrizzleGraphStore (生产模式,asyncpg 直连 PG)")
            return store
        except Exception as e:
            logger.warning(
                f"DrizzleGraphStore 初始化失败,回退到 InMemoryGraphStore: {e}"
            )
            return InMemoryGraphStore()
    if backend != "memory":
        logger.warning(
            f"未知的知识图谱存储后端 {backend!r},使用默认内存模式 "
            f"(合法值: 'memory' | 'drizzle')"
        )
    return InMemoryGraphStore()


# 全局单例(API 路由和 build 流程统一引用)
graph_store: GraphStore = _create_graph_store()
