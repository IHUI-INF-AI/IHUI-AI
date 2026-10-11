# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
- `file` (默认):   FileGraphStore,内存工作集 + JSON 快照落盘(进程重启不丢,零外部依赖)
- `memory`:        InMemoryGraphStore,纯进程内 dict,**重启即失**(仅调试/评测用)
- `drizzle`:       DrizzleGraphStore,用 asyncpg 直连 PG,多实例共享图谱时用
- 未知值: 启动时打 warning 强制回退到默认档,避免运行时崩溃

所有后端通过 `GraphStore` Protocol 暴露异步方法,API 路由统一 `await` 调用,
便于在不同后端之间无缝切换且未来可加新后端(CosmosDB / Neo4j 等)。

持久化失败的处理口径(V3 #76 立,不得放宽):
落盘失败**永不静默**。任何一次写盘/装载失败都会 (1) 记 `persistence_error` 供
`GET /api/v1/ai/knowledge-graph/data` 的 `persistence` 字段现读, (2) 打 ERROR 日志并
原样带上 `内存档告警` 常量里的"当前为内存档、重启即失"。工厂在初始化阶段就无法建目录时
直接回落到纯 `InMemoryGraphStore`,同样打这句。理由:"数据在内存里读得到"与"数据已落盘"
是两件事,把前者伪装成后者就是本票要修的那个洞。
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import time
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any, Protocol

import asyncpg

from ..core.config import settings
from ..core.llm_gateway import llm_gateway

logger = logging.getLogger(__name__)

# 快照格式版本(结构变更时递增;不认识的版本按"文件损坏"处置,不猜)
_SNAPSHOT_VERSION = 1

# 回落/失败时必须出现在日志里的原话 —— 单一常量,便于运维按关键字 grep 告警,
# 也便于测试断言(不得在多处各写一份措辞)。
MEMORY_DEGRADED_NOTICE = "当前为内存档、重启即失"

# 默认落盘目录:与 `app/services/vector_memory.py` 的 `_PERSIST_DIR` 同根
# (`apps/ai-service/.data/`,已被 .gitignore:382 忽略)。复用既有惯例,不自立
# 第二套"运行时数据目录"约定。
_PERSIST_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    ".data",
)
_PERSIST_PATH = os.path.join(_PERSIST_DIR, "knowledge_graph.json")

# 后端合法值:默认 file(持久),memory 为显式非持久档
_BACKEND_DEFAULT = "file"
_VALID_BACKENDS = ("file", "memory", "drizzle")

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
_CN_STOPWORDS = {"的", "了", "是", "在", "和", "与", "及", "或", "也", "都", "还", "但", "而", "被", "从", "到", "把", "让", "使", "为", "对", "这", "那", "你", "我", "他", "她", "它", "我们", "你好", "请", "谢谢"}

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
    def _stub_extract(text: str) -> dict[str, Any]:
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
        except Exception as e:
            logger.warning("knowledge_graph.extract NER 提取失败: %s", e, exc_info=True)
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

    def persistence_status(self) -> dict[str, Any]:
        """返回"此刻数据到底落没落盘"的真实状态,不是"配置里写了什么"。

        列入 Protocol 是刻意的:三个后端都必须能回答这一问,上层就不需要
        `hasattr(store, ...)` 式的猜测 —— 一旦允许猜,漏答的那一档就会表现成
        "没有 persistence 字段",而读的人会把它当成"持久化正常"。
        """
        ...


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
    """内存版图谱存储:进程内 dict 工作集,**单独使用时重启即失**。

    自 V3 #76 起它同时是 `FileGraphStore` 的基类 —— 持久化档 = 这一层内存工作集
    + 一层 JSON 快照落盘。所以"落盘档是 InMemoryGraphStore 的子类"是结构事实,
    既有测试里 `isinstance(graph_store, InMemoryGraphStore)` 因此在换默认后端后
    仍然成立(它读的是"有没有内存工作集",那一直为真);而"是否真落盘"改由
    `persistent` 属性与端到端重启恢复测试把守,不再靠类型断言兼职。

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

    def persistence_status(self) -> dict[str, Any]:
        """本档不落盘:如实报 persistent=False 并带上告警原话。

        必须存在这个方法,而不是让上层用 hasattr 猜 —— 工厂回落正是落在这里,
        如果这里没有出口,运维在 API 上就看到"一切正常"。
        """
        return {
            "backend": "memory",
            "path": None,
            "persistent": False,
            "pending_unflushed": False,
            "load_failed": False,
            "write_failures": 0,
            "error": None,
            "notice": MEMORY_DEGRADED_NOTICE,
        }


class GraphPersistenceUnavailableError(RuntimeError):
    """快照落盘位置根本不可用时抛出(建目录/权限失败等)。

    只在构造阶段抛给工厂,让工厂回落到纯内存档并打 `MEMORY_DEGRADED_NOTICE`。
    运行期单条写入失败**不**抛本异常(那会把业务请求打成 500),只记录状态。
    """


class FileGraphStore(InMemoryGraphStore):
    """默认存储后端:内存工作集 + JSON 快照落盘(进程重启不丢,零第三方依赖)。

    继承 `InMemoryGraphStore` 不是权宜之计,而是这一档的真实结构:
    读路径全部走内存(与旧行为逐字一致,不引入磁盘 IO 抖动),写路径在改完内存后
    **写穿(write-through)**到快照文件。写穿而不是写后异步刷盘,是因为"重启即失"
    这一型故障的定义就是"返回给调用方成功、但落盘前进程没了";异步刷盘把这个窗口
    留在系统里,写穿不留。

    快照格式(`_SNAPSHOT_VERSION` 版本化,不认识的版本按损坏处置):
        {"version": 1, "next_entity_id": N, "next_relation_id": M,
         "entities": [...], "relations": [...]}

    失败口径见模块 docstring:任何失败都必须留 `persistence_error` + ERROR 日志,
    日志原文必须含 `MEMORY_DEGRADED_NOTICE`。
    """

    def __init__(self, path: str | None = None) -> None:
        super().__init__()
        resolved = (path or os.getenv("KNOWLEDGE_GRAPH_PATH", "").strip() or _PERSIST_PATH)
        self.path: str = os.path.abspath(resolved)
        # 可诊断状态(三条都进 GET /data 的 persistence 字段,不只在日志里)
        self.persistent: bool = True
        self.persistence_error: str | None = None
        self.load_failed: bool = False
        self.write_failures: int = 0
        self._dirty: bool = False
        self._lock = asyncio.Lock()
        self._ensure_dir()
        self._load_existing()

    # ------------------------------------------------------------------
    # 落盘位置准备与装载
    # ------------------------------------------------------------------

    def _ensure_dir(self) -> None:
        """建快照目录;建不出来就判"根本不可用"(抛给工厂回落,不静默)。"""
        directory = os.path.dirname(self.path) or "."
        try:
            os.makedirs(directory, exist_ok=True)
        except OSError as e:
            raise GraphPersistenceUnavailableError(
                f"知识图谱快照目录不可用: {directory} ({e})"
            ) from e

    def _load_existing(self) -> None:
        """启动时把已落盘的快照读回工作集(这就是"重启后可恢复"的那一步)。

        文件不存在 = 干净首启,不是错误。文件在但读不动/格式不认识 = 事故,必须
        留痕并如实置 `load_failed`,**不得**当成"没有数据"蒙过去。
        """
        if not os.path.exists(self.path):
            return
        try:
            with open(self.path, encoding="utf-8") as f:
                raw = json.load(f)
            self._absorb_snapshot(raw)
        except (OSError, ValueError, TypeError, KeyError) as e:
            # json.JSONDecodeError 是 ValueError 的子类;_absorb_snapshot 的结构校验
            # 抛 KeyError/TypeError/ValueError,四类都是"这份快照没能用"。
            self.load_failed = True
            self.persistence_error = f"快照装载失败(数据未恢复): {e}"
            logger.error(
                "知识图谱快照装载失败 path=%s: %s —— 快照将被下一次写入覆盖,"
                "在此之前图数据不完整;若该文件重要请从备份恢复。同时本进程按"
                "%s运行(%s)。",
                self.path,
                e,
                MEMORY_DEGRADED_NOTICE,
                self.persistence_error,
            )

    def _absorb_snapshot(self, raw: Any) -> None:
        """把快照 dict 装回内存工作集。结构不合即抛,由调用方按损坏处置。"""
        if not isinstance(raw, dict):
            raise ValueError("快照根节点不是对象")
        version = raw.get("version")
        if version != _SNAPSHOT_VERSION:
            raise ValueError(f"快照版本不受支持: {version!r} (期望 {_SNAPSHOT_VERSION})")
        entities = raw.get("entities")
        relations = raw.get("relations")
        if not isinstance(entities, list) or not isinstance(relations, list):
            raise ValueError("快照缺 entities/relations 数组")

        loaded_entities: dict[tuple[str, str, str], dict[str, Any]] = {}
        max_entity_id = 0
        for item in entities:
            if not isinstance(item, dict):
                raise ValueError("entities 内含非对象条目")
            entity: dict[str, Any] = {
                "id": int(item["id"]),
                "owner_uuid": str(item["owner_uuid"]),
                "name": str(item["name"]),
                "type": str(item["type"]),
                "description": item.get("description"),
                "frequency": int(item.get("frequency", 1)),
                "doc_ids": [int(x) for x in (item.get("doc_ids") or [])],
            }
            key = (entity["owner_uuid"], entity["name"], entity["type"])
            if key in loaded_entities:
                raise ValueError(f"快照内实体主键重复: {key}")
            loaded_entities[key] = entity
            max_entity_id = max(max_entity_id, entity["id"])

        loaded_relations: dict[tuple[str, int, int, str], dict[str, Any]] = {}
        max_relation_id = 0
        for item in relations:
            if not isinstance(item, dict):
                raise ValueError("relations 内含非对象条目")
            relation: dict[str, Any] = {
                "id": int(item["id"]),
                "owner_uuid": str(item["owner_uuid"]),
                "source_entity_id": int(item["source_entity_id"]),
                "target_entity_id": int(item["target_entity_id"]),
                "relation_type": str(item["relation_type"]),
                "description": item.get("description"),
                "weight": float(item.get("weight", 1)),
            }
            rkey = (
                relation["owner_uuid"],
                relation["source_entity_id"],
                relation["target_entity_id"],
                relation["relation_type"],
            )
            if rkey in loaded_relations:
                raise ValueError(f"快照内关系主键重复: {rkey}")
            loaded_relations[rkey] = relation
            max_relation_id = max(max_relation_id, relation["id"])

        self.entities = loaded_entities
        self.relations = loaded_relations
        # 主键续号取 max(快照记录值, 现存 id)+ 1:宁可留空洞,也不复用已删 id,
        # 否则重启后旧 id 可能指向另一个实体,把关系边接错。
        recorded_entity_id = raw.get("next_entity_id")
        recorded_relation_id = raw.get("next_relation_id")
        self._next_entity_id = max(
            [max_entity_id + 1]
            + ([int(recorded_entity_id)] if isinstance(recorded_entity_id, int) else [])
        )
        self._next_relation_id = max(
            [max_relation_id + 1]
            + ([int(recorded_relation_id)] if isinstance(recorded_relation_id, int) else [])
        )

    # ------------------------------------------------------------------
    # 写穿持久化
    # ------------------------------------------------------------------

    def _snapshot_payload(self) -> dict[str, Any]:
        """在事件循环线程内做浅拷贝快照(交 executor 序列化前必须已脱离活对象)。"""
        return {
            "version": _SNAPSHOT_VERSION,
            "next_entity_id": self._next_entity_id,
            "next_relation_id": self._next_relation_id,
            "entities": [dict(e) for e in self.entities.values()],
            "relations": [dict(r) for r in self.relations.values()],
        }

    def _write_snapshot_sync(self, snapshot: dict[str, Any]) -> None:
        """同步写盘(executor 线程内调用):同目录临时文件 + os.replace 原子替换。

        临时文件必须与目标同目录(跨目录 rename 非原子),且必须带唯一后缀
        (Windows 上并发 rename 到同名目标会 EPERM);替换失败重试只针对
        "目标被别的进程短暂占用",不掩盖真正的权限/磁盘错误。
        """
        tmp_path = f"{self.path}.{os.getpid()}.tmp"
        try:
            with open(tmp_path, "w", encoding="utf-8") as f:
                json.dump(snapshot, f, ensure_ascii=False)
            for attempt in range(3):
                try:
                    os.replace(tmp_path, self.path)
                    return
                except OSError:
                    if attempt == 2:
                        raise
                    time.sleep(0.05 * (attempt + 1))
        finally:
            if os.path.exists(tmp_path):
                try:
                    os.unlink(tmp_path)
                except OSError:
                    # 临时件删不掉不影响数据正确性,但不能无声:打 warning。
                    logger.warning("知识图谱快照临时件清理失败: %s", tmp_path)

    async def _flush_if_dirty(self) -> None:
        """把当前工作集写穿到磁盘。失败只记状态与日志,绝不向调用方抛。"""
        if not self._dirty:
            return
        async with self._lock:
            if not self._dirty:
                return
            snapshot = self._snapshot_payload()
            loop = asyncio.get_running_loop()
            try:
                await loop.run_in_executor(None, self._write_snapshot_sync, snapshot)
            except (OSError, TypeError, ValueError) as e:
                self.write_failures += 1
                self.persistent = False
                self._dirty = True  # 仍然脏:下一次写入继续尝试(磁盘满可能只是一时)
                if self.persistence_error is None:
                    self.persistence_error = f"快照写盘失败: {e}"
                # 首次失败 ERROR,后续 WARN:与 §5e"失败必须响"一致,但不刷日志。
                log = logger.error if self.write_failures == 1 else logger.warning
                log(
                    "知识图谱持久化失败(第 %d 次)path=%s: %s —— %s",
                    self.write_failures,
                    self.path,
                    e,
                    MEMORY_DEGRADED_NOTICE,
                )
                return
            self._dirty = False
            if not self.persistent:
                self.persistent = True
                self.persistence_error = None
                self.write_failures = 0
                logger.info("知识图谱持久化已恢复: %s", self.path)

    async def _after_mutation(self) -> None:
        self._dirty = True
        await self._flush_if_dirty()

    async def upsert_entity(
        self,
        owner_uuid: str,
        name: str,
        entity_type: str,
        description: str | None = None,
        doc_id: int | None = None,
    ) -> dict[str, Any]:
        entity = await super().upsert_entity(
            owner_uuid, name, entity_type, description, doc_id
        )
        await self._after_mutation()
        return entity

    async def upsert_relation(
        self,
        owner_uuid: str,
        source_entity_id: int,
        target_entity_id: int,
        relation_type: str,
        description: str | None = None,
    ) -> dict[str, Any]:
        relation = await super().upsert_relation(
            owner_uuid, source_entity_id, target_entity_id, relation_type, description
        )
        await self._after_mutation()
        return relation

    async def clear(self, owner_uuid: str | None = None) -> None:
        await super().clear(owner_uuid)
        await self._after_mutation()

    def persistence_status(self) -> dict[str, Any]:
        """当前这一档的真实持久化状态(不是"配置成了什么",而是"现在落没落盘")。"""
        return {
            "backend": "file",
            "path": self.path,
            "persistent": self.persistent,
            "pending_unflushed": self._dirty,
            "load_failed": self.load_failed,
            "write_failures": self.write_failures,
            "error": self.persistence_error,
            "notice": None if self.persistent else MEMORY_DEGRADED_NOTICE,
        }

    async def close(self) -> None:
        """进程收尾时刷脏(应用关闭走 main.py 的 graph_store.close())。"""
        await self._flush_if_dirty()


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
        now = datetime.now(UTC)

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
        now = datetime.now(UTC)

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

    def persistence_status(self) -> dict[str, Any]:
        """drizzle 档:持久性由 PG 保证,路径概念不适用。"""
        return {
            "backend": "drizzle",
            "path": None,
            "persistent": True,
            "pending_unflushed": False,
            "load_failed": False,
            "write_failures": 0,
            "error": None,
            "notice": None,
        }


# =============================================================================
# 全局 graph_store 工厂(根据环境变量选择后端)
# =============================================================================


def _memory_fallback(reason: str) -> InMemoryGraphStore:
    """回落到纯内存档,并把"这一档重启即失"喊出来(禁止静默伪装成已持久化)。"""
    logger.error(
        "知识图谱未能启用持久档,回落到纯内存档:%s —— %s", reason, MEMORY_DEGRADED_NOTICE
    )
    return InMemoryGraphStore()


# =============================================================================
# 多 worker × file 档 = 图数据静默丢失:启动期硬断言(2026-09-27 立)
# =============================================================================

#: 本断言**唯一**承认的 worker 数信号。选它的理由是"它与被审的那个决定是同一份输入":
#: uvicorn 自己就是这么定 worker 数的(`.venv/Lib/site-packages/uvicorn/config.py:352-353`,
#: `if workers is None and "WEB_CONCURRENCY" in os.environ: self.workers = int(...)`)。
#: 环境变量由 supervisor 继承给每一个 spawn 出来的 worker 子进程 ⇒ 它是"本进程是 N 分之一"
#: 的**因果上游**,不是对命令行的事后字符串模仿。
#:
#: TODO(worker 观测盲区,如实登记而非当作已解决):CLI 形态 `uvicorn --workers N`
#: **在 worker 进程内观测不到** —— supervisor 进程的 argv 里有它,但子进程 argv 是
#: `python -c "from multiprocessing.spawn import spawn_main; ..."` 桩,Windows 上又没有
#: `/proc/<ppid>/cmdline` 可退(本仓部署形态含 `deploy/win/*.ps1` + nssm 服务,Windows 是
#: 一等目标)。⇒ 那一格**本断言结构上看不见**,不得读成"多 worker 已全面受保"。
#: 补法二选一(都落在启动器侧,不在进程内):① 部署改用 `WEB_CONCURRENCY=N`(与本文件
#: 同一份输入);② 由启动器显式导出一个声明档(如 `IHUI_AI_SERVICE_WORKERS=N`)并让本函数
#: 同时认它 —— 那要同批改 `Dockerfile` CMD / `render.yaml` / `scripts/start-ihui-stack.ps1`
#: 三处启动器,属另一票,不得在这里顺手加第二个真相源。
_WORKER_COUNT_ENV = "WEB_CONCURRENCY"


def _observable_worker_count() -> int | None:
    """量"本进程是几个 uvicorn worker 之一";量不到一律返回 None(不猜、不默认 1)。

    None 的三种来路都要区分对待,否则就把"没判"写成"判过了":
      * 变量缺席 / 空串:本仓现有全部启动链路(`app/main.py` 的 `uvicorn.run` 不传
        `workers`、`Dockerfile` CMD、`render.yaml` startCommand、`scripts/start-ihui-stack.ps1`)
        都不带 worker 数 ⇒ 这是常态。按"未观测到多 worker"放过,否则开发机每次启动即红
        (与改动无关的恒红门,唯一结局是逼人绕过启动检查)。
      * 值不可 parse:喊一行 warning 后仍返回 None。此处判红没有意义 —— uvicorn 在自己的
        `Config.__init__` 里对同一个值做 `int()`,坏值在它那一层就会炸,轮不到本函数定罪。
    """
    raw = os.environ.get(_WORKER_COUNT_ENV)
    if raw is None:
        return None
    text = raw.strip()
    if not text:
        return None
    try:
        return int(text)
    except ValueError:
        logger.warning(
            "%s=%r 不是整数 ⇒ 无法判定 worker 数,本启动期断言对这一格不成立(既不冒红也不记绿)",
            _WORKER_COUNT_ENV,
            raw,
        )
        return None


def _file_store_multi_worker_error(workers: int) -> str:
    """拒绝启动的措辞:点名病灶 + 给出可复制的修复命令 + 写清自己的盲区。"""
    return (
        "知识图谱拒绝启动:多 worker 部署 + file 档 = 图数据静默丢失。\n"
        f"  观测到的 worker 数:{_WORKER_COUNT_ENV}={workers}"
        "(与 uvicorn 判定 worker 数读的是同一个变量)\n"
        "  病灶:FileGraphStore 是「整表 JSON 快照 + 写穿 + 最后写者赢」,每个 worker 进程"
        "各持一份内存工作集,彼此用各自的快照互相覆盖 ⇒ 图数据静默丢失且不报任何错。\n"
        "  修复(二选一,可直接复制):\n"
        "    KNOWLEDGE_GRAPH_STORE=drizzle uvicorn app.main:app --host 0.0.0.0 --port 8803\n"
        f"    {_WORKER_COUNT_ENV}=1 uvicorn app.main:app --host 0.0.0.0 --port 8803\n"
        "  已知盲区:CLI 形态 `uvicorn --workers N` 在 worker 进程内观测不到(见 "
        "`_WORKER_COUNT_ENV` 上方的 TODO),那一格不受本断言保护。"
    )


def _assert_file_store_worker_safe(backend: str) -> None:
    """`file` 档 + 观测到多 worker ⇒ 显式失败,拒绝启动。

    只判 `file` 一种:那是"默认档"(`_BACKEND_DEFAULT`),所以"没人配过"也落在这一格,
    正是爆炸半径最大的一处。`memory` 档在多 worker 下同样不共享,但它已经是**显式**选择
    且自带降级告示,不在本断言射程内(判据扩面要先清账,不得顺手)。
    """
    if backend != "file":
        return
    workers = _observable_worker_count()
    if workers is not None and workers > 1:
        message = _file_store_multi_worker_error(workers)
        logger.error(message)
        raise RuntimeError(message)


def _create_graph_store() -> GraphStore:
    """根据环境变量 `KNOWLEDGE_GRAPH_STORE` 选择后端。

    默认 `file`(落盘,重启可恢复)。`memory` 仍可选,但它现在是一个**显式**选择
    而非默认 —— 原默认正是本票要修的"重启即失"。

    本函数在 `graph_store = _create_graph_store()`(模块底部)执行,而那条语句在
    `app.main` 的导入链上(`app/api/v1/router.py` → `app/api/v1/knowledge_graph.py`),
    所以这里抛错 = uvicorn 在加载 ASGI app 阶段就退出非零 = **拒绝启动**,
    而不是"起来之后再悄悄丢数据"。
    """
    raw_backend = os.getenv("KNOWLEDGE_GRAPH_STORE", "").strip()
    backend = (raw_backend or _BACKEND_DEFAULT).lower()
    if backend not in _VALID_BACKENDS:
        logger.warning(
            "未知的知识图谱存储后端 %r,回落到默认 %r(合法值: %s)",
            raw_backend,
            _BACKEND_DEFAULT,
            " | ".join(_VALID_BACKENDS),
        )
        backend = _BACKEND_DEFAULT
    # 2026-09-27 立:多 worker 与 file 档互斥(必须在构造任何 store 之前判,
    # 否则等于先落盘一次再拒绝启动)。回落成 file 的那一支也要过这里 ⇒ 传的是
    # **解析后**的 backend,不是原始环境变量。
    _assert_file_store_worker_safe(backend)
    if backend == "drizzle":
        try:
            store: GraphStore = DrizzleGraphStore()
            logger.info("知识图谱存储后端: DrizzleGraphStore (asyncpg 直连 PG)")
            return store
        except Exception as e:
            return _memory_fallback(f"DrizzleGraphStore 初始化失败: {e}")
    if backend == "memory":
        store_only_memory = InMemoryGraphStore()
        logger.warning(
            "知识图谱存储后端: InMemoryGraphStore (显式 memory 档) —— %s",
            MEMORY_DEGRADED_NOTICE,
        )
        return store_only_memory
    try:
        file_store = FileGraphStore()
    except GraphPersistenceUnavailableError as e:
        return _memory_fallback(str(e))
    logger.info("知识图谱存储后端: FileGraphStore (落盘 %s)", file_store.path)
    return file_store


# 全局单例(API 路由和 build 流程统一引用)
graph_store: GraphStore = _create_graph_store()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
