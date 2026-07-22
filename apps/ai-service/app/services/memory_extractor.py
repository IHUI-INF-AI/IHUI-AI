"""记忆自动提取器(对标 Hermes Agent 自动记忆提取)。

从对话流中自动提取用户偏好 / 项目约定 / 历史决策 / 事实信息 / 用户反馈,
每条带 confidence 分数,与已有记忆做文本相似度去重(difflib.SequenceMatcher)。
LLM 失败时降级返回空列表,不抛错。
"""

import json
import re
import time
from difflib import SequenceMatcher
from typing import Any

# 去重相似度阈值(>0.85 视为重复)
_DEDUP_THRESHOLD = 0.85


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
            {"extracted": [{type, category, text, confidence, sourceMessageIndex}], "durationMs": int}

        LLM 失败降级:返回空 extracted 列表。
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
            # 与已有记忆 + 本轮已提取记忆去重
            if self._is_duplicate(text, existing_texts + [e.get("text", "") for e in extracted]):
                continue
            extracted.append({
                "type": str(item.get("type", "fact")),
                "category": str(item.get("category", "未分类")),
                "text": text,
                "confidence": float(item.get("confidence", 0.5)),
                "sourceMessageIndex": int(item.get("sourceMessageIndex", -1)),
            })

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
