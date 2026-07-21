"""知识图谱服务(G5 - 2026-07-21)。

提供:
- LLM NER 实体抽取(从一段文本抽取实体 + 关系)
- 从 RAG 文档批量构建图谱
- 查询某 owner 的图谱数据(节点 + 边)

设计:
- LLM 不可用(stub 模式)时,降级为关键词 NER(用简单启发式规则抽取大写名词/中文实体)
- 实体去重:(owner_uuid, name, type) 唯一约束
- 关系去重:(owner_uuid, source, target, type) 唯一约束
- 频次累加:同一实体被多次抽取时 frequency + 1,doc_ids 累加
"""

from __future__ import annotations

import json
import re
from typing import Any

from ..core.llm_gateway import llm_gateway

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


# 内存数据存储(测试 / dev 环境无 DB 时的 fallback)
class InMemoryGraphStore:
    """内存版图谱存储,用于 dev/test 场景,生产用 DB。"""

    def __init__(self) -> None:
        self.entities: dict[tuple[str, str, str], dict[str, Any]] = {}
        self.relations: dict[tuple[str, int, int, str], dict[str, Any]] = {}
        self._next_entity_id = 1
        self._next_relation_id = 1

    def upsert_entity(
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

    def upsert_relation(
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

    def get_graph(self, owner_uuid: str) -> dict[str, Any]:
        entities = [e for e in self.entities.values() if e["owner_uuid"] == owner_uuid]
        relations = [r for r in self.relations.values() if r["owner_uuid"] == owner_uuid]
        return {"entities": entities, "relations": relations}

    def clear(self, owner_uuid: str | None = None) -> None:
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


# 全局单例(内存版;DB 接入前使用)
graph_store = InMemoryGraphStore()
