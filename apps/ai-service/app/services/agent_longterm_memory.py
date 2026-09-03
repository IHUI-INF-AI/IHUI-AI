# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""长期 Agent 记忆服务(跨会话沉淀,对标 Claude Code/Codex 的"无记忆"痛点)。

项目已有会话内记忆(memory_service 四层 / long_term_memory L8 跨会话 RAG / question
摘要 / meta_learner 避坑),但缺一层"把一次会话沉淀出的用户偏好、项目约定、已解决
问题、踩坑教训、用户目标"自动提炼成可查询、可回忆注入的记忆条目,从而让 agent 在
新会话里不再反复犯同样错误、不再重问同样偏好。

本模块定位:
  1. LongTermMemory 服务 —— 确定性条目存储(进程内 dict + JSON 落盘 + threading.Lock,
     与 cloud_run_store / agent_step_recorder 同款范式,不依赖 DB 迁移):
        add / search / recall_for_context / get_top_by_importance / remove /
        bulk_import_from_extract
  2. extract_candidates_from_session —— 从会话消息确定性抽取"候选记忆"(规则驱动,不用 LLM)
  3. build_memory_context_block —— 把条目组装成可注入 system prompt 的摘要块
     (接入点说明见该函数 docstring,默认不接入 agent 主循环)

与既有 memory_service / long_term_memory 的关系:
  - memory_service 四层是 DB 持久化的向量/事实记忆(embedding/pgvector)
  - long_term_memory 是跨会话 RAG 检索会话摘要的门面
  - 本模块是"自治沉淀 + 轻量检索注入"的长期记忆层,字段聚焦 value 类条目
    (偏好/约定/教训/已解决问题/目标),用确定性相似度去重,零 LLM/零 DB 门槛
"""

from __future__ import annotations

import json
import logging
import threading
import time
import uuid
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 常量
# ---------------------------------------------------------------------------

# 合法条目类型
MEMORY_TYPES = (
    "user_preference",
    "project_convention",
    "lesson_learned",
    "resolved_issue",
    "goal",
)

# 类型 -> 中文标签(注入上下文与 tags 用)
TYPE_LABELS = {
    "user_preference": "用户偏好",
    "project_convention": "项目约定",
    "lesson_learned": "踩坑教训",
    "resolved_issue": "已解决问题",
    "goal": "用户目标",
}

# 去重相似度阈值(字符 bigram 的归一化 Jaccard):>= 该值视为同一记忆合并
DEFAULT_DEDUP_THRESHOLD = 0.55

# 单条内容/原文长度上限(防超大单条撑爆 JSON 文件)
CONTENT_LIMIT = 1000
SOURCE_LIMIT = 500

# 每条记忆重要性范围(1-5)
IMPORTANCE_MIN = 1
IMPORTANCE_MAX = 5

# JSON 持久化文件(ai-service 根下的 data/agent_longterm_memory.json)
_DATA_DIR = Path(__file__).resolve().parents[2] / "data"
_MEMORY_FILE = _DATA_DIR / "agent_longterm_memory.json"

# 抽取候选时强化模式标记(命中即认为"值得沉淀")
_STRONG_MARKERS = (
    "以后", "记住", "记得", "别忘了", "切记", "别", "不要再", "不要", "避免",
    "约定", "规范", "统一", "务必", "坑", "教训", "下次", "今后", "后续",
)

# 类型推断关键词(按优先级:先命中谁归谁,保证确定性)
_TYPE_RULES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("project_convention", ("约定", "规范", "统一", "规定", "一律", "标准", "团队")),
    ("lesson_learned", ("坑", "教训", "别再", "不要再", "避免", "注意", "别", "踩坑")),
    ("resolved_issue", ("解决了", "修复", "已处理", "搞定", "原因", "问题出在", "排查")),
    ("goal", ("目标是", "接下来要", "打算", "计划", "后续要", "要实现")),
    ("user_preference", ("喜欢", "不喜欢", "偏爱", "习惯", "希望", "更偏好", "我一直")),
)


def _now_iso() -> str:
    """当前 UTC 时间 ISO8601(秒级)。"""
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _clip_text(value: Any, limit: int) -> str:
    """把任意值转文本并截断到 limit(防超大单条撑爆文件)。

    None/空 视为空串(而非 str(None)="None"),便于空内容判空。
    """
    if value is None:
        return ""
    try:
        text = str(value).strip()
    except Exception:
        text = ""
    if not text:
        return ""
    if len(text) > limit:
        return text[: limit - 1] + "…"
    return text


def _normalize_type(raw_type: Any) -> str:
    """把类型规范化为合法值,非法值回退 'lesson_learned'(防御,永不抛错)。"""
    t = str(raw_type or "").strip()
    if t in MEMORY_TYPES:
        return t
    if t == "convention":
        return "project_convention"
    if t == "preference":
        return "user_preference"
    return "lesson_learned"


def _clamp_importance(value: Any) -> int:
    """钳制重要性到 [IMPORTANCE_MIN, IMPORTANCE_MAX] 的整数。"""
    try:
        v = int(value)
    except (TypeError, ValueError):
        v = 3
    return max(IMPORTANCE_MIN, min(IMPORTANCE_MAX, v))


# ---------------------------------------------------------------------------
# 确定性轻量相似度(字符 bigram 归一化 Jaccard,无第三方依赖)
# ---------------------------------------------------------------------------


def _char_bigrams(text: str) -> set[str]:
    """取文本的字符 bigram 集合(小写)。"""
    t = str(text).lower()
    if len(t) <= 1:
        return {t} if t else set()
    return {t[i : i + 2] for i in range(len(t) - 1)}


def jaccard_similarity(a: str, b: str) -> float:
    """计算两段文本的归一化 Jaccard 相似度(字符 bigram,取值 0-1)。

    - 两段都为空 → 视为相同(1.0)
    - 任一段为空(非同时)→ 0.0
    - regex 无关、确定性、无需分词与外部库
    """
    grams_a = _char_bigrams(a)
    grams_b = _char_bigrams(b)
    if not grams_a and not grams_b:
        return 1.0
    if not grams_a or not grams_b:
        return 0.0
    return len(grams_a & grams_b) / len(grams_a | grams_b)


# ---------------------------------------------------------------------------
# LongTermMemory(runtime 存储服务)
# ---------------------------------------------------------------------------


class AgentLongTermMemory:
    """长期 Agent 记忆服务(进程内 dict + JSON 文件持久化)。

    条目字段:
        memory_id:         唯一 ID(UUID hex)
        type:              类型(user_preference|project_convention|lesson_learned|
                           resolved_issue|goal)
        content:           记忆正文(去重按 同 user+type+内容相似 判断)
        source_session_id: 来源会话 ID
        keywords:          关键词列表(检索用)
        tags:              标签列表(过滤用,默认含类型中文标签)
        user_id:           所属用户(检索/隔离维度)
        importance:        重要性 1-5(去重合并时自动提升)
        created_at:        创建时间
        updated_at:        最近更新
        last_accessed_at:  最近一次被 recall 命中时间
        access_count:      被 recall 命中次数(访问统计)

    存储策略(与 cloud_run_store / agent_step_recorder 同款):
    - 主存储: 进程内 dict[memory_id -> entry](读快、跨请求可见)
    - 持久化: 每次变更把全量 dict 写回 data/agent_longterm_memory.json,
      进程重启可恢复;文件缺失/损坏时静默降级为空存储
    - 并发:   threading.Lock 保护 dict 与 JSON 读写的原子性
    """

    def __init__(
        self,
        file_path: Path | None = None,
        dedup_threshold: float = DEFAULT_DEDUP_THRESHOLD,
    ) -> None:
        self._data: dict[str, dict[str, Any]] = {}
        self._file = file_path or _MEMORY_FILE
        self._lock = threading.Lock()
        self._loaded = False
        self._dedup_threshold = max(0.0, min(1.0, float(dedup_threshold)))

    # ---------------- 内部 ----------------

    def _load(self) -> None:
        """从 JSON 懒加载到内存(仅首次;损坏/缺失降级为空)。"""
        if self._loaded:
            return
        try:
            if self._file.exists():
                raw = json.loads(self._file.read_text(encoding="utf-8"))
                if isinstance(raw, dict):
                    self._data = {
                        mid: e
                        for mid, e in raw.items()
                        if isinstance(e, dict) and e.get("memory_id")
                    }
        except Exception as e:
            logger.warning("agent_longterm_memory 读取失败(降级为空): %s", e)
        finally:
            self._loaded = True

    def _persist(self) -> None:
        """把内存全量记录写回 JSON 文件(尽力,失败降级内存保留)。"""
        try:
            self._file.parent.mkdir(parents=True, exist_ok=True)
            self._file.write_text(
                json.dumps(self._data, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
        except Exception as e:
            logger.warning("agent_longterm_memory 写盘失败(内存保留): %s", e)

    def _find_duplicate(
        self, user_id: str, mem_type: str, content: str
    ) -> dict[str, Any] | None:
        """找同 用户+类型+内容相似 的既有条目(相似度 < 阈值则不算重复)。"""
        for entry in self._data.values():
            if (
                entry.get("user_id") == user_id
                and entry.get("type") == mem_type
                and jaccard_similarity(entry.get("content", ""), content)
                >= self._dedup_threshold
            ):
                return entry
        return None

    def _mark_accessed(self, memory_id: str) -> None:
        """命中访问统计(access_count+1 / 刷新 last_accessed_at)。"""
        entry = self._data.get(memory_id)
        if entry is None:
            return
        entry["access_count"] = int(entry.get("access_count", 0)) + 1
        entry["last_accessed_at"] = _now_iso()

    # ---------------- 写入 ----------------

    def add(
        self,
        content: str,
        *,
        user_id: str,
        type: str = "lesson_learned",
        source_session_id: str | None = None,
        keywords: list[str] | None = None,
        tags: list[str] | None = None,
        importance: int = 3,
    ) -> dict[str, Any]:
        """新增一条记忆。同 user+type+内容相似 时合并既有条目(提升 importance/刷新 updated)。

        合并策略:
          - importance = min(5, max(既有, 新) + 1)(权重随反复出现而提升)
          - keywords / tags 取并集去重
          - 保留原 memory_id(不换 id),refresh updated_at

        Args:
            content: 记忆正文(必填,空串直接返回空 dict)
            user_id: 所属用户(去重/隔离维度)
            type:    类型(非法值回退 lesson_learned)
            其余:    source_session_id / keywords / tags / importance(默认 3)

        Returns:
            归一化后的条目 dict(合并或新建;空 content 返回空 dict)
        """
        content = _clip_text(content, CONTENT_LIMIT)
        if not content:
            return {}
        mem_type = _normalize_type(type)
        importance = _clamp_importance(importance)
        now = _now_iso()

        with self._lock:
            self._load()
            dup = self._find_duplicate(user_id, mem_type, content)
            if dup is not None:
                dup["importance"] = min(
                    IMPORTANCE_MAX,
                    max(int(dup.get("importance", 3)), importance) + 1,
                )
                dup["keywords"] = sorted(
                    set(dup.get("keywords", []) or []) | set(keywords or [])
                )
                dup["tags"] = sorted(set(dup.get("tags", []) or []) | set(tags or []))
                if source_session_id:
                    dup["source_session_id"] = (
                        dup.get("source_session_id") or source_session_id
                    )
                dup["updated_at"] = now
                self._persist()
                return dict(dup)

            memory_id = uuid.uuid4().hex
            tag_set = set(tags or [])
            tag_set.add(TYPE_LABELS.get(mem_type, mem_type))
            entry: dict[str, Any] = {
                "memory_id": memory_id,
                "type": mem_type,
                "content": content,
                "source_session_id": _clip_text(source_session_id or "", SOURCE_LIMIT),
                "keywords": sorted(set(keywords or [])),
                "tags": sorted(tag_set),
                "user_id": str(user_id),
                "importance": importance,
                "created_at": now,
                "updated_at": now,
                "last_accessed_at": "",
                "access_count": 0,
            }
            self._data[memory_id] = entry
            self._persist()
            return dict(entry)

    def bulk_import_from_extract(
        self,
        candidates: list[dict[str, Any]],
        user_id: str,
        session_id: str | None = None,
    ) -> dict[str, Any]:
        """把 extract_candidates_from_session 产出的候选批量写入(去重合并)。

        Args:
            candidates: 候选条目列表(每项含 content/type 可选 keywords/tags/importance)
            user_id:    所属用户
            session_id: 批量导入的默认来源会话

        Returns:
            {"added": int, "merged": int, "skipped": int, "total": int}
        """
        added = merged = skipped = 0
        if not candidates:
            return {"added": 0, "merged": 0, "skipped": 0, "total": 0}
        # 先触发一次懒加载并预取当前 id 集合(判定去重合并),
        # 注意:不能在此持有 self._lock 再调 self.add —— threading.Lock 不可重入
        # (add 内部会再次 acquire,造成死锁)。
        with self._lock:
            self._load()
            before = set(self._data.keys())
        for cand in candidates:
            if not isinstance(cand, dict):
                skipped += 1
                continue
            content = _clip_text(
                cand.get("content") or cand.get("source_message"), CONTENT_LIMIT
            )
            if not content:
                skipped += 1
                continue
            mem_type = _normalize_type(cand.get("type"))
            src = cand.get("source_session_id") or session_id or ""
            # add 内部自带 lock,逐条原子写入;每条 add 都会 persist,安全
            entry = self.add(
                content,
                user_id=user_id,
                type=mem_type,
                source_session_id=src,
                keywords=list(cand.get("keywords") or []),
                tags=list(cand.get("tags") or []),
                importance=_clamp_importance(cand.get("importance", 3)),
            )
            if entry.get("memory_id") in before:
                merged += 1
            else:
                added += 1
                before.add(entry.get("memory_id"))
        return {
            "added": added,
            "merged": merged,
            "skipped": skipped,
            "total": len(candidates),
        }

    # ---------------- 读取 ----------------

    def get(self, memory_id: str) -> dict[str, Any] | None:
        """按 memory_id 取单条(返回值副本,不污染内部)。"""
        with self._lock:
            self._load()
            entry = self._data.get(memory_id)
            return dict(entry) if entry else None

    def count(self, user_id: str | None = None) -> int:
        """条目总数(可按用户过滤)。"""
        with self._lock:
            self._load()
            if not user_id:
                return len(self._data)
            return sum(1 for e in self._data.values() if e.get("user_id") == user_id)

    def search(
        self,
        user_id: str,
        query: str = "",
        keywords: list[str] | None = None,
        tags: list[str] | None = None,
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        """检索记忆(关键词/tags/用户过滤 + 轻量相关度排序)。

        - keywords 任一命中即保留;tags 需交集非空才保留
        - query 非空:按 内容 bigram 相似度(0.7) + 关键词命中率(0.3) 综合排序,
          返回副本并带 relevance 字段(0-1)
        - query 为空:按 importance 降序,次按 updated_at 降序

        Args:
            user_id: 用户隔离过滤
            query:   查询文本(可空)
            keywords/tags/limit: 过滤与上限

        Returns:
            条目副本列表(每项含可选 relevance 字段)
        """
        with self._lock:
            self._load()
            entries = [
                e for e in self._data.values() if e.get("user_id") == user_id
            ]
        if keywords:
            kw = set(keywords)
            entries = [e for e in entries if kw & set(e.get("keywords", []))]
        if tags:
            tg = set(tags)
            entries = [e for e in entries if tg & set(e.get("tags", []))]
        if not entries:
            return []

        query = _clip_text(query, CONTENT_LIMIT)
        if query:
            scored: list[tuple[float, dict[str, Any]]] = []
            for e in entries:
                content_score = jaccard_similarity(e.get("content", ""), query)
                e_kws = e.get("keywords", [])
                kw_hit = (
                    sum(1 for k in e_kws if k and k in query) / len(e_kws)
                    if e_kws
                    else 0.0
                )
                rel = round(0.7 * content_score + 0.3 * kw_hit, 4)
                scored.append((rel, e))
            scored.sort(key=lambda x: x[0], reverse=True)
            picked = scored[:limit]
            return [{**dict(e), "relevance": rel} for rel, e in picked]
        # 无 query:按重要性降序,次按最近更新
        entries.sort(
            key=lambda e: (
                int(e.get("importance", 3)),
                e.get("updated_at", ""),
            ),
            reverse=True,
        )
        return [dict(e) for e in entries[:limit]]

    def get_top_by_importance(self, user_id: str, top_k: int = 5) -> list[dict[str, Any]]:
        """按重要性取 top_k 条目(importance 降序,次按最近更新)。"""
        return self.search(user_id, query="", limit=top_k)

    def recall_for_context(
        self,
        user_id: str,
        query: str,
        top_k: int = 5,
        min_relevance: float = 0.0,
    ) -> str:
        """检索 top_k 并格式化为可注入上下文的摘要块。

        - 按 search 相关度取前 top_k(命中后更新访问统计 access_count/last_accessed_at)
        - query 非空且 min_relevance>0 时,丢弃低于阈值(噪声)的条目
        - 组装结果交给 build_memory_context_block 格式化;失败/空返回 ""

        Context 命中即视为"被读取",用于访问统计(重要性/热度的伴生信号)。
        """
        if not user_id:
            return ""
        top = self.search(user_id, query=query, limit=top_k)
        if query and min_relevance > 0:
            top = [e for e in top if float(e.get("relevance", 0.0)) >= min_relevance]
        if not top:
            return ""

        with self._lock:
            self._load()
            changed = False
            for e in top:
                mid = e.get("memory_id")
                if mid in self._data:
                    self._mark_accessed(mid)
                    changed = True
            if changed:
                self._persist()

        text = build_memory_context_block(top)
        if len(text) > 4000:
            text = text[:3997] + "..."
        return text

    # ---------------- 删除 ----------------

    def remove(self, memory_id: str) -> bool:
        """按 memory_id 删除。存在返回 True,不存在返回 False(幂等)。"""
        with self._lock:
            self._load()
            if memory_id in self._data:
                del self._data[memory_id]
                self._persist()
                return True
            return False


# ---------------------------------------------------------------------------
# 确定性候选记忆抽取(规则驱动,零 LLM)
# ---------------------------------------------------------------------------


def extract_candidates_from_session(
    messages: list[dict[str, Any]],
    session_id: str = "",
    user_id: str = "",
) -> list[dict[str, Any]]:
    """从会话消息确定性抽取"候选记忆"(识别强化的长期价值消息正文)。

    规则(清晰、不误抽):
      - 只看 role 为 user/assistant 的消息
      - 正文命中 _STRONG_MARKERS(以后/记住/别/不要再/约定/规范/坑/教训/务必/统一…)
        才纳入候选,并满足长度门槛(>=6 且 <= SOURCE_LIMIT),避免一次性闲聊
      - 类型按 _TYPE_RULES 关键词优先级推断,确定性;推断不出按作者归
        (user→user_preference,assistant→lesson_learned)
      - 产出候选含 content(清洗后)/source_message(原文)/source_session_id/
        keywords(分词 + 用户强标记)/tags(类型标签)/importance(规则启发)

    Args:
        messages:   会话消息列表([{"role": ..., "content": ...}, ...])
        session_id: 来源会话(写入 source_session_id)
        user_id:    传递用(仅透传)

    Returns:
        候选条目列表(直接可喂给 bulk_import_from_extract)
    """
    candidates: list[dict[str, Any]] = []
    for msg in messages or []:
        if not isinstance(msg, dict):
            continue
        role = str(msg.get("role", "")).strip()
        if role not in ("user", "assistant"):
            continue
        raw = str(msg.get("content", "")).strip()
        if not raw or not _contains_any(raw, _STRONG_MARKERS):
            continue
        if len(raw) < 6 or len(raw) > SOURCE_LIMIT:
            continue
        content = _clean_content(raw)
        if not content:
            continue
        mem_type = _infer_type(raw)
        importance = 4 if mem_type in ("lesson_learned", "project_convention") else 3
        candidates.append(
            {
                "type": mem_type,
                "content": content,
                "source_message": _clip_text(raw, SOURCE_LIMIT),
                "source_session_id": str(session_id or ""),
                "keywords": _tokenize(raw),
                "tags": [TYPE_LABELS.get(mem_type, mem_type)],
                "importance": importance,
                "user_id": str(user_id or ""),
            }
        )
    return candidates


def _contains_any(text: str, markers: tuple[str, ...]) -> bool:
    """text 是否命中任意标记(子串)。"""
    return any(m in text for m in markers)


def _clean_content(raw: str) -> str:
    """把原始消息清洗为记忆正文(去首尾空白/前后缀,折叠空白,截断)。"""
    text = raw.strip().strip("\"'“”‘’").replace("\r", " ").replace("\n", " ")
    text = " ".join(text.split())
    ensure = text.lstrip(":：,，。!！?").strip("…，,。 ")
    out = ensure or text
    return _clip_text(out, CONTENT_LIMIT)


def _infer_type(text: str) -> str:
    """按 _TYPE_RULES 优先级确定性推断类型(命中即返回,保序)。"""
    for mem_type, words in _TYPE_RULES:
        if any(w in text for w in words):
            return mem_type
    return "user_preference"


def _tokenize(text: str) -> list[str]:
    """轻量分词:按标点/空白切分,保留长度>=2 的去重片段,上限 8(确定性)。"""
    import re

    parts = re.split(r"[\s,，。.!！?？;；:：、/\\()（）\[\]{}“”\"'<>《》]+", text)
    tokens: list[str] = []
    for p in parts:
        p = p.strip()
        if len(p) >= 2 and p not in tokens:
            tokens.append(p)
        if len(tokens) >= 8:
            break
    return tokens


# ---------------------------------------------------------------------------
# 上下文注入组装(只组装,不实现接入;接入说明见 build_memory_context_block)
# ---------------------------------------------------------------------------


def build_memory_context_block(entries: list[dict[str, Any]]) -> str:
    """把记忆条目组装成可注入 system prompt 的摘要块。

    ⚠️ 接入点说明(仅说明,本函数不实现接入):
    请在 app/services/agent_loop_v2.py 的 `_inject_user_profile`(约 L790)之后追加
    该块。参考既有注入方式(L758 *_inject_memory_context / L790 *_inject_user_profile):
    调用方先 `recall_for_context(user_id, query, top_k=5)` 拿到文本,再
    `if messages[0].role == "system": messages[0].content += "\\n\\n" + block
    else: messages.insert(0, {"role": "system", "content": block})`。
    默认保持"零接入零回归"——不在 agent 主循环启用,由上层业务显式挂载。

    格式:按类型分组(用户偏好/项目约定/…),组内按 importance 降序,每条附重要度。

    Args:
        entries: LongTermMemory 输出的条目(含 content/type/importance)

    Returns:
        多行摘要文本;空输入返回 ""
    """
    if not entries:
        return ""
    # 分组(保留 MEMORY_TYPES 顺序)+ 组内 importance 降序
    grouped: dict[str, list[dict[str, Any]]] = {}
    for e in entries:
        mem_type = _normalize_type(e.get("type"))
        grouped.setdefault(mem_type, []).append(e)
    lines = ["## 长期记忆(跨会话沉淀 · 自动注入,请遵循)"]
    for mem_type in MEMORY_TYPES:
        items = grouped.get(mem_type)
        if not items:
            continue
        items.sort(key=lambda x: int(x.get("importance", 3)), reverse=True)
        label = TYPE_LABELS.get(mem_type, mem_type)
        lines.append(f"### {label}")
        for item in items:
            content = _clip_text(item.get("content", ""), 200)
            imp = int(item.get("importance", 3))
            lines.append(f"- [{label}·重要度 {imp}] {content}")
    return "\n".join(lines)


# 全局单例(与 cloud_run_store / agent_step_recorder 风格一致)
agent_longterm_memory = AgentLongTermMemory()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
