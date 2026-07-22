"""用户画像建模(对标 Hermes Agent 用户画像)。

基于记忆聚合用户画像,按 5 维度分类:
- preference:           偏好(技术栈/工具/风格)
- expertise:            专业能力
- communication_style:  沟通风格
- workflow:             工作流习惯
- domain:               领域知识

画像生成优先用 LLM 归纳;LLM 失败时降级为按记忆 type 字段简单分类。
返回格式严格对齐 packages/types 的 UserProfileAggregate 契约。
"""

import json
import re
from datetime import datetime, timezone
from typing import Any

# 5 维度(对齐 agent-runtime.ts UserProfileDimension)
_DIMENSIONS = (
    "preference",
    "expertise",
    "communication_style",
    "workflow",
    "domain",
)

# 记忆 type → 画像维度(降级分类映射)
_TYPE_TO_DIMENSION: dict[str, str] = {
    "preference": "preference",
    "feedback": "preference",       # 用户反馈归入偏好维度
    "convention": "workflow",       # 项目约定归入工作流
    "decision": "domain",           # 历史决策归入领域知识
    "fact": "expertise",            # 事实信息归入专业能力
}


class UserProfileBuilder:
    """基于记忆聚合用户画像。"""

    def __init__(self, memory_client: Any = None) -> None:
        # 构造时可选传 memory_client(兼容 MemorySystem 现有调用)
        self._client = memory_client
        # 画像缓存:user_id -> UserProfileAggregate
        self._profiles: dict[str, dict[str, Any]] = {}

    # ==================================================================
    # 全量画像构建
    # ==================================================================

    async def build_profile(
        self,
        user_id: str,
        memory_client: Any = None,
    ) -> dict[str, Any]:
        """基于用户所有记忆构建画像(全量)。

        Args:
            user_id:       用户 ID
            memory_client: UnifiedMemoryClient(可选,未传则用构造时的)

        Returns:
            UserProfileAggregate 字典:
            {userId, entries: [UserProfileEntry], totalMemories, completeness, updatedAt}
        """
        client = memory_client or self._client
        entries = await self._get_entries(user_id, client)
        if not entries:
            return self._empty_profile(user_id)

        # 优先 LLM 归纳
        llm_entries = await self._llm_build_profile(user_id, entries)
        if llm_entries:
            profile = self._assemble_profile(user_id, entries, llm_entries)
            self._profiles[user_id] = profile
            return profile

        # 降级:按记忆 type 字段简单分类
        profile = self._fallback_build_profile(user_id, entries)
        self._profiles[user_id] = profile
        return profile

    # ==================================================================
    # 增量更新画像
    # ==================================================================

    async def update_profile(
        self,
        user_id: str,
        new_memory: dict[str, Any],
        memory_client: Any = None,
    ) -> dict[str, Any]:
        """增量更新画像(读取现有画像 + 新记忆,避免全量重建)。

        Args:
            user_id:       用户 ID
            new_memory:    新增的记忆条目
            memory_client: UnifiedMemoryClient(可选)

        Returns:
            更新后的 UserProfileAggregate 字典
        """
        client = memory_client or self._client
        # 读取现有画像(缓存优先,否则全量构建)
        profile = self._profiles.get(user_id)
        if profile is None:
            return await self.build_profile(user_id, client)

        # 按降级规则确定新记忆影响的维度
        dimension = self._dimension_of(new_memory)
        memory_id = str(new_memory.get("id", ""))
        now = datetime.now(timezone.utc).isoformat()

        # 找到对应维度的画像条目
        target_entry: dict[str, Any] | None = None
        for entry in profile.get("entries", []):
            if entry.get("dimension") == dimension:
                target_entry = entry
                break

        if target_entry is None:
            # 该维度不存在,新建
            target_entry = {
                "userId": user_id,
                "dimension": dimension,
                "content": str(new_memory.get("text", "")),
                "confidence": 0.4,
                "supportingMemoryIds": [memory_id] if memory_id else [],
                "updatedAt": now,
            }
            profile["entries"].append(target_entry)
        else:
            # 已存在:加入 supportingMemoryIds,提升 confidence
            support_ids = list(target_entry.get("supportingMemoryIds", []))
            if memory_id and memory_id not in support_ids:
                support_ids.append(memory_id)
            target_entry["supportingMemoryIds"] = support_ids
            target_entry["confidence"] = min(1.0, 0.3 + 0.15 * len(support_ids))
            target_entry["updatedAt"] = now
            # 追加新记忆内容(简短摘要)
            new_text = str(new_memory.get("text", ""))
            if new_text:
                existing_content = str(target_entry.get("content", ""))
                if new_text not in existing_content:
                    target_entry["content"] = (
                        f"{existing_content}; {new_text}"[:500]
                    )

        # 重新计算完整度 + totalMemories
        profile["totalMemories"] = int(profile.get("totalMemories", 0)) + 1
        covered = sum(
            1 for e in profile["entries"]
            if e.get("supportingMemoryIds") or e.get("content")
        )
        profile["completeness"] = round(covered / len(_DIMENSIONS), 2)
        profile["updatedAt"] = now

        self._profiles[user_id] = profile
        return profile

    # ==================================================================
    # LLM 归纳(优先)
    # ==================================================================

    async def _llm_build_profile(
        self,
        user_id: str,
        entries: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """调 LLM 归纳用户画像(5 维度)。失败返回空列表。"""
        # 构建记忆摘要(控制 token)
        memory_lines: list[str] = []
        for idx, e in enumerate(entries[:50]):  # 最多 50 条
            text = str(e.get("text", ""))[:200]
            if not text:
                continue
            memory_lines.append(f"[{idx}] {text}")
        memory_text = "\n".join(memory_lines)
        if not memory_text:
            return []
        if len(memory_text) > 3000:
            memory_text = memory_text[:3000] + "\n...(已截断)"

        dims_hint = "\n".join(f"- {d}" for d in _DIMENSIONS)
        prompt = (
            "你是用户画像建模助手。基于以下用户记忆,归纳用户画像。\n"
            f"画像维度:\n{dims_hint}\n\n"
            "用户记忆:\n"
            f"{memory_text}\n\n"
            "请输出 JSON 数组,每个元素代表一个维度的画像:\n"
            '{"dimension": "维度名", '
            '"content": "该维度画像内容(陈述句)", '
            '"confidence": 0.0-1.0, '
            '"supportingMemoryIndices": [记忆索引整数]}\n\n'
            "只输出 JSON 数组,不要额外解释。若无足够信息,输出 []。"
        )

        try:
            from ..core.llm_gateway import llm_gateway
            resp = await llm_gateway.complete(
                [{"role": "user", "content": prompt}],
            )
            content = str(resp.get("content", "")) if isinstance(resp, dict) else ""
            return self._parse_profile_output(content, entries, user_id)
        except Exception:
            return []

    @staticmethod
    def _parse_profile_output(
        content: str,
        entries: list[dict[str, Any]],
        user_id: str,
    ) -> list[dict[str, Any]]:
        """解析 LLM 输出为 UserProfileEntry 列表(容错)。"""
        if not content:
            return []
        cleaned = re.sub(r"```(?:json)?\s*", "", content).strip()
        arr_match = re.search(r"\[.*\]", cleaned, re.DOTALL)
        if not arr_match:
            return []
        try:
            arr = json.loads(arr_match.group())
        except (json.JSONDecodeError, TypeError):
            return []
        if not isinstance(arr, list):
            return []

        result: list[dict[str, Any]] = []
        now = datetime.now(timezone.utc).isoformat()
        for item in arr:
            if not isinstance(item, dict):
                continue
            dimension = str(item.get("dimension", ""))
            if dimension not in _DIMENSIONS:
                continue
            # 把 indices 转成 memory ids
            indices = item.get("supportingMemoryIndices", [])
            support_ids: list[str] = []
            if isinstance(indices, list):
                for i in indices:
                    try:
                        idx = int(i)
                        if 0 <= idx < len(entries):
                            mid = str(entries[idx].get("id", ""))
                            if mid:
                                support_ids.append(mid)
                    except (ValueError, TypeError):
                        continue
            result.append({
                "userId": user_id,
                "dimension": dimension,
                "content": str(item.get("content", "")),
                "confidence": float(item.get("confidence", 0.5)),
                "supportingMemoryIds": support_ids,
                "updatedAt": now,
            })
        return result

    # ==================================================================
    # 降级:按记忆 type 字段简单分类
    # ==================================================================

    def _fallback_build_profile(
        self,
        user_id: str,
        entries: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """LLM 失败降级:按记忆 type 字段分类到对应维度。"""
        now = datetime.now(timezone.utc).isoformat()
        # dimension -> {texts, support_ids}
        grouped: dict[str, dict[str, Any]] = {d: {"texts": [], "ids": []} for d in _DIMENSIONS}

        for entry in entries:
            dim = self._dimension_of(entry)
            text = str(entry.get("text", ""))
            mid = str(entry.get("id", ""))
            if text:
                grouped[dim]["texts"].append(text)
            if mid:
                grouped[dim]["ids"].append(mid)

        profile_entries: list[dict[str, Any]] = []
        for dim in _DIMENSIONS:
            data = grouped[dim]
            if not data["texts"]:
                continue
            content = "; ".join(data["texts"])[:500]
            support_ids = data["ids"]
            confidence = min(1.0, 0.3 + 0.15 * len(support_ids))
            profile_entries.append({
                "userId": user_id,
                "dimension": dim,
                "content": content,
                "confidence": round(confidence, 2),
                "supportingMemoryIds": support_ids,
                "updatedAt": now,
            })

        return self._assemble_profile_from_entries(user_id, entries, profile_entries)

    # ==================================================================
    # 内部工具
    # ==================================================================

    @staticmethod
    def _dimension_of(memory: dict[str, Any]) -> str:
        """根据记忆 type 字段映射到画像维度(降级规则)。"""
        mtype = str(memory.get("type", "")).lower()
        return _TYPE_TO_DIMENSION.get(mtype, "preference")

    @staticmethod
    def _assemble_profile(
        user_id: str,
        entries: list[dict[str, Any]],
        profile_entries: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """组装 UserProfileAggregate(LLM 路径)。"""
        now = datetime.now(timezone.utc).isoformat()
        covered = sum(1 for d in _DIMENSIONS if any(e.get("dimension") == d for e in profile_entries))
        return {
            "userId": user_id,
            "entries": profile_entries,
            "totalMemories": len(entries),
            "completeness": round(covered / len(_DIMENSIONS), 2),
            "updatedAt": now,
        }

    @staticmethod
    def _assemble_profile_from_entries(
        user_id: str,
        entries: list[dict[str, Any]],
        profile_entries: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """组装 UserProfileAggregate(降级路径)。"""
        now = datetime.now(timezone.utc).isoformat()
        covered = len(profile_entries)
        return {
            "userId": user_id,
            "entries": profile_entries,
            "totalMemories": len(entries),
            "completeness": round(covered / len(_DIMENSIONS), 2),
            "updatedAt": now,
        }

    @staticmethod
    def _empty_profile(user_id: str) -> dict[str, Any]:
        """空画像(无记忆时)。"""
        now = datetime.now(timezone.utc).isoformat()
        return {
            "userId": user_id,
            "entries": [],
            "totalMemories": 0,
            "completeness": 0.0,
            "updatedAt": now,
        }

    @staticmethod
    async def _get_entries(
        user_id: str,
        memory_client: Any,
    ) -> list[dict[str, Any]]:
        """从 memory_client 读取用户记忆(降级返回空列表)。"""
        if memory_client is None:
            return []
        try:
            if hasattr(memory_client, "get_entries"):
                result = await memory_client.get_entries(user_id, scope="user")
                return result if isinstance(result, list) else []
        except Exception:
            pass
        return []
