"""记忆自动提取器(对标 Hermes Agent 自动记忆提取)。

从对话流中自动提取用户偏好 / 项目约定 / 历史决策 / 事实信息 / 用户反馈,
每条带 confidence 分数。L2-1(2026-07-25 立)升级去重机制:
- 字符级预筛(difflib.SequenceMatcher,>0.85 视为明显重复,直接 skip)
- 语义级精筛(vector_memory embedding cosine,>=0.92 视为语义重复)
- 语义冲突时调 LLM 仲裁:replace / merge / latest / skip

LLM 失败时降级返回空列表,不抛错。embedding 失败时降级走字符级判断。
"""

import json
import logging
import re
import time
from difflib import SequenceMatcher
from typing import Any

logger = logging.getLogger(__name__)

# 字符级快速预筛阈值(>0.85 视为明显重复,直接 skip)
_DEDUP_THRESHOLD = 0.85

# L2-1:语义级精筛阈值(embedding cosine >=0.92 视为语义重复,触发 LLM 仲裁)
_SEMANTIC_DEDUP_THRESHOLD = 0.92


class MemoryExtractor:
    """从对话流中自动提取记忆。"""

    # 记忆类型 → 中文说明(喂给 LLM 的 prompt 用)
    _TYPE_HINTS = {
        "preference": "用户偏好(技术栈/工具/风格/UI/交互习惯)",
        "convention": "项目约定(代码规范/命名/架构/目录结构)",
        "decision": "历史决策(技术选型/方案取舍/为什么不用 X)",
        "fact": "事实信息(用户身份/团队/环境/版本/外部约束)",
        "feedback": "用户反馈(喜欢/不喜欢/修改意见/抱怨)",
    }

    async def extract(
        self,
        messages: list[dict[str, Any]] | dict[str, Any],
        user_id: str | None = None,
        session_id: str | None = None,
        existing_entries: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """从对话中自动提取记忆。

        Args:
            messages:         对话消息列表 [{role, content}],或 MemorySystem 传入的 request dict
            user_id:          用户 ID
            session_id:       会话 ID(可选)
            existing_entries: 已有记忆列表(用于去重)

        Returns:
            {"extracted": [...], "durationMs": int}

        L2-1 新增:每条 extracted item 可能含 conflictResolution 字段:
            - {action: "replace"|"merge"|"latest"|"skip", conflictWith: <entry_id>, mergedText?: str, reason: str}
        """
        start = time.time()

        # 兼容 MemorySystem 单 dict 调用
        if isinstance(messages, dict):
            req = messages
            messages = req.get("messages", []) or []
            user_id = req.get("userId") or req.get("user_id") or user_id
            session_id = req.get("sessionId") or req.get("session_id") or session_id
            existing_entries = (
                req.get("existingEntries")
                or req.get("existing_entries")
                or existing_entries
            )

        if not messages:
            return {"extracted": [], "durationMs": int((time.time() - start) * 1000)}

        existing_entries = existing_entries or []

        # 调 LLM 提取
        raw_items = await self._llm_extract(messages)

        # 去重 + 标准化
        extracted: list[dict[str, Any]] = []
        existing_texts = [
            str(e.get("text", "")) for e in existing_entries if isinstance(e, dict)
        ]
        for item in raw_items:
            text = str(item.get("text", "")).strip()
            if not text:
                continue

            # 第 1 道:字符级快速预筛(明显重复 → skip)
            if self._is_duplicate(text, existing_texts + [e.get("text", "") for e in extracted]):
                continue

            # 第 2 道:语义级精筛(embedding cosine >=0.92 → LLM 仲裁)
            # 失败降级:不阻塞,直接当作不重复
            conflict_resolution: dict[str, Any] | None = None
            final_text = text
            conflict = await self._find_semantic_conflict(text, existing_entries)
            if conflict is not None:
                sim, conflict_entry = conflict
                decision = await self._llm_arbitrate_conflict(
                    new_text=text,
                    old_text=str(conflict_entry.get("text", "")),
                    new_meta=item,
                    old_meta=conflict_entry,
                )
                # skip → 直接跳过这条(被仲裁判定为重复)
                if decision["action"] == "skip":
                    continue
                # merge → 用 LLM 合并后的文本
                if decision["action"] == "merge" and decision.get("mergedText"):
                    final_text = str(decision["mergedText"]).strip()
                # 附加冲突解决元信息(MemorySystem 写入时据此执行 replace/merge/latest)
                conflict_resolution = {
                    "action": decision["action"],
                    "conflictWith": conflict_entry.get("id"),
                    "mergedText": decision.get("mergedText"),
                    "reason": decision.get("reason", ""),
                    "similarity": round(sim, 4),
                }

            entry_item: dict[str, Any] = {
                "type": str(item.get("type", "fact")),
                "category": str(item.get("category", "未分类")),
                "text": final_text,
                "confidence": float(item.get("confidence", 0.5)),
                "sourceMessageIndex": int(item.get("sourceMessageIndex", -1)),
            }
            if conflict_resolution is not None:
                entry_item["conflictResolution"] = conflict_resolution
            extracted.append(entry_item)

        return {
            "extracted": extracted,
            "durationMs": int((time.time() - start) * 1000),
        }

    async def _llm_extract(self, messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """调 LLM 从对话中提取记忆,返回原始条目列表。失败返回空列表。"""
        # 构建对话摘要(控制 token,过长则截断)
        convo_lines: list[str] = []
        for idx, msg in enumerate(messages):
            role = str(msg.get("role", "user"))
            content = str(msg.get("content", ""))
            if not content:
                continue
            # 单条消息截断到 500 字符
            if len(content) > 500:
                content = content[:500] + "..."
            convo_lines.append(f"[{idx}] {role}: {content}")
        convo_text = "\n".join(convo_lines)
        # 整体截断到 4000 字符
        if len(convo_text) > 4000:
            convo_text = convo_text[:4000] + "\n...(已截断)"

        type_hints = "\n".join(
            f"- {t}: {desc}" for t, desc in self._TYPE_HINTS.items()
        )
        prompt = (
            "你是记忆提取助手。从下面的对话中提取值得长期记忆的信息。\n"
            "记忆类型:\n"
            f"{type_hints}\n\n"
            "对话内容:\n"
            f"{convo_text}\n\n"
            "请输出 JSON 数组,每个元素格式:\n"
            '{"type": "preference|convention|decision|fact|feedback", '
            '"category": "分类(如 UI 偏好/技术选型)", '
            '"text": "记忆内容(陈述句)", '
            '"confidence": 0.0-1.0, '
            '"sourceMessageIndex": 消息索引整数}\n\n'
            "只输出 JSON 数组,不要额外解释。若无值得记忆的信息,输出 []。"
        )

        try:
            from ..core.llm_gateway import llm_gateway
            resp = await llm_gateway.complete(
                [{"role": "user", "content": prompt}],
            )
            content = str(resp.get("content", "")) if isinstance(resp, dict) else ""
            return self._parse_extract_output(content)
        except Exception:
            return []

    @staticmethod
    def _parse_extract_output(content: str) -> list[dict[str, Any]]:
        """解析 LLM 输出为记忆条目列表(容错,复用 _parse_eval_output 模式)。

        优先提取 JSON 数组,其次提取 JSON 对象中的 extracted 字段。
        """
        if not content:
            return []
        # 去除 ```json 包裹
        cleaned = re.sub(r"```(?:json)?\s*", "", content).strip()
        # 优先尝试 JSON 数组
        arr_match = re.search(r"\[.*\]", cleaned, re.DOTALL)
        if arr_match:
            try:
                arr = json.loads(arr_match.group())
                if isinstance(arr, list):
                    return [item for item in arr if isinstance(item, dict)]
            except (json.JSONDecodeError, TypeError):
                pass
        # 兜底:JSON 对象中的 extracted 字段
        obj_match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if obj_match:
            try:
                obj = json.loads(obj_match.group())
                if isinstance(obj, dict):
                    extracted = obj.get("extracted", [])
                    if isinstance(extracted, list):
                        return [item for item in extracted if isinstance(item, dict)]
            except (json.JSONDecodeError, TypeError):
                pass
        return []

    @staticmethod
    def _is_duplicate(text: str, existing_texts: list[str]) -> bool:
        """文本相似度去重:difflib.SequenceMatcher,相似度 >0.85 视为重复。"""
        if not existing_texts:
            return False
        text_lower = text.lower()
        for ex in existing_texts:
            if not ex:
                continue
            ratio = SequenceMatcher(None, text_lower, ex.lower()).ratio()
            if ratio > _DEDUP_THRESHOLD:
                return True
        return False

    # ==================================================================
    # L2-1 语义去重 + LLM 冲突仲裁(2026-07-25 立)
    # ==================================================================

    async def _find_semantic_conflict(
        self,
        text: str,
        existing_entries: list[dict[str, Any]],
    ) -> tuple[float, dict[str, Any]] | None:
        """语义级查找冲突:embedding cosine 找最相似条目。

        Args:
            text:             新提取的记忆文本
            existing_entries: 已有记忆列表

        Returns:
            (similarity, entry) 若找到 cosine >= _SEMANTIC_DEDUP_THRESHOLD 的条目;
            None 若无语义重复 / 现有列表为空 / embedding 失败

        降级:embedding 失败(向量服务不可用 / llm_gateway 不可用)→ 返回 None,
        MemoryExtractor 会跳过语义去重,直接当不重复处理(不阻塞主流程)。
        """
        if not existing_entries:
            return None
        try:
            from .vector_memory import vector_memory
            from .memory_service import _cosine_similarity
        except Exception as e:
            logger.warning("语义去重依赖加载失败,降级跳过: %s", e)
            return None

        try:
            query_vec = await vector_memory.embed(text)
            if not query_vec:
                return None

            best_sim = 0.0
            best_entry: dict[str, Any] | None = None
            for entry in existing_entries:
                if not isinstance(entry, dict):
                    continue
                ex_text = str(entry.get("text", "")).strip()
                if not ex_text:
                    continue
                ex_vec = await vector_memory.embed(ex_text)
                sim = _cosine_similarity(query_vec, ex_vec)
                if sim > best_sim:
                    best_sim = sim
                    best_entry = entry

            if best_entry is not None and best_sim >= _SEMANTIC_DEDUP_THRESHOLD:
                return best_sim, best_entry
        except Exception as e:
            logger.warning("语义去重查找失败,降级跳过: %s", e)
            return None
        return None

    async def _llm_arbitrate_conflict(
        self,
        new_text: str,
        old_text: str,
        new_meta: dict[str, Any],
        old_meta: dict[str, Any],
    ) -> dict[str, Any]:
        """LLM 仲裁语义冲突:决定 replace / merge / latest / skip。

        Args:
            new_text: 新提取的记忆文本
            old_text: 已有的记忆文本
            new_meta: 新条目元信息(type/category/confidence/...)
            old_meta: 旧条目元信息(含 id/type/category/...)

        Returns:
            {"action": "replace"|"merge"|"latest"|"skip", "mergedText": str|None, "reason": str}

        降级策略:
            - LLM 失败 → action="latest"(保守保留两者,旧条目由 MemorySystem 标记 superseded)
            - LLM 返回无法解析 → action="latest"
        """
        prompt = (
            "你是记忆冲突仲裁助手。已有记忆与新提取记忆语义相似度很高(>=0.92),需要决定如何处理。\n\n"
            f"已有记忆: {old_text}\n"
            f"  类型: {old_meta.get('type', 'unknown')} / 分类: {old_meta.get('category', '')}\n\n"
            f"新记忆: {new_text}\n"
            f"  类型: {new_meta.get('type', 'unknown')} / 分类: {new_meta.get('category', '')}\n\n"
            "请判断:\n"
            '1. "replace": 新记忆完全覆盖旧记忆(旧信息已被新信息修正/失效)\n'
            '2. "merge": 合并新旧记忆为一条(互补信息,不可分割)\n'
            '3. "latest": 两者都保留,但标记旧记忆为 superseded(不同时间点的快照)\n'
            '4. "skip": 跳过新记忆(语义上完全等价,无新信息)\n\n'
            "请输出 JSON:\n"
            '{"action": "replace|merge|latest|skip", "mergedText": "<仅 merge 时填合并后的文本>", "reason": "<一句话理由>"}\n\n'
            "只输出 JSON,不要额外解释。"
        )

        try:
            from ..core.llm_gateway import llm_gateway
            resp = await llm_gateway.complete(
                [{"role": "user", "content": prompt}],
            )
            content = str(resp.get("content", "")) if isinstance(resp, dict) else ""
            return self._parse_arbitrate_output(content)
        except Exception as e:
            logger.warning("LLM 冲突仲裁失败,降级 latest: %s", e)
            return {
                "action": "latest",
                "mergedText": None,
                "reason": f"LLM 仲裁失败,降级保留两者: {e}",
            }

    @staticmethod
    def _parse_arbitrate_output(content: str) -> dict[str, Any]:
        """解析 LLM 仲裁输出,失败降级为 latest。"""
        if not content:
            return {"action": "latest", "mergedText": None, "reason": "空输出"}
        cleaned = re.sub(r"```(?:json)?\s*", "", content).strip()
        obj_match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if not obj_match:
            return {"action": "latest", "mergedText": None, "reason": "未找到 JSON"}
        try:
            obj = json.loads(obj_match.group())
            if not isinstance(obj, dict):
                return {"action": "latest", "mergedText": None, "reason": "非对象"}
            action = str(obj.get("action", "latest")).lower()
            if action not in {"replace", "merge", "latest", "skip"}:
                action = "latest"
            merged_text = obj.get("mergedText")
            if merged_text is not None:
                merged_text = str(merged_text).strip()
            reason = str(obj.get("reason", ""))
            return {
                "action": action,
                "mergedText": merged_text,
                "reason": reason,
            }
        except (json.JSONDecodeError, TypeError, ValueError) as e:
            return {"action": "latest", "mergedText": None, "reason": f"JSON 解析失败: {e}"}
