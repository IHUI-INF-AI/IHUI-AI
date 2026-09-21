# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""记忆质量评测体系(2026-09-03 立,补齐差距矩阵"记忆质量度量"1.5 分真空)。

对标 Claude Code / Codex 的记忆评测思路,把"记忆到底好不好用"变成可量化、
可每日回归的数字。与具体存储解耦:评测器面向一个最小存储协议(duck-typed),
VectorMemoryStore / 内存伪实现 / 真实 PostgreSQL 后端均可注入,零 DB 零 LLM
也能离线跑确定性场景。

评测维度(每项 0~1,加权总分):
1. write_consistency — 写入后可完整读回(不丢、不改、不串)
2. recall_at_k       — 语义检索召回率:已知事实能否被相关查询命中
3. precision_at_k    — 检索精度:不相关内容是否被错误召回(污染率)
4. mutation_correct  — 更新/删除后检索结果正确变化(无幽灵命中)
5. noise_robustness  — 弱相关噪声条目不挤占强相关命中(top1 稳定性)

用法:
    from app.services.memory_quality_eval import MemoryQualityEvaluator, run_offline
    report = await run_offline()          # 内置内存存储 + 词袋伪 embed,全离线
    report.summary()                       # 打印 markdown 摘要
"""

from __future__ import annotations

import hashlib
import math
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any, Protocol

# ---------------------------------------------------------------------------
# 类型契约
# ---------------------------------------------------------------------------


class EmbedFn(Protocol):
    """文本 → 向量。返回 None 表示嵌入不可用(该维度降级为 0)。"""

    def __call__(self, text: str) -> Awaitable[list[float] | None]: ...


class VectorStore(Protocol):
    """评测所需的存储最小接口(与 VectorMemoryStore 兼容)。"""

    async def add_entry(
        self, entry_id: str, entry: dict[str, Any], embedding: list[float]
    ) -> None: ...
    async def search(
        self, query_embedding: list[float], top_k: int = 10, threshold: float = 0.0
    ) -> list[tuple[str, dict[str, Any], float]]: ...
    def list_entries(self) -> list[dict[str, Any]]: ...
    async def update_embedding(self, entry_id: str, embedding: list[float]) -> None: ...
    async def delete(self, entry_id: str) -> None: ...
    def list_entry_ids(self) -> list[str]: ...
    def clear(self) -> None: ...


# ---------------------------------------------------------------------------
# 结果模型
# ---------------------------------------------------------------------------


@dataclass
class DimensionScore:
    name: str
    score: float  # 0~1
    detail: str = ""

    def __post_init__(self) -> None:
        self.score = max(0.0, min(1.0, float(self.score)))


@dataclass
class MemoryQualityReport:
    dimensions: list[DimensionScore] = field(default_factory=list)
    overall: float = 0.0
    duration_ms: int = 0
    storage_kind: str = "unknown"
    embed_kind: str = "unknown"

    def as_dict(self) -> dict[str, Any]:
        return {
            "overall": round(self.overall, 4),
            "duration_ms": self.duration_ms,
            "storage_kind": self.storage_kind,
            "embed_kind": self.embed_kind,
            "dimensions": [
                {"name": d.name, "score": round(d.score, 4), "detail": d.detail}
                for d in self.dimensions
            ],
        }

    def summary(self) -> str:
        lines = [
            "## 记忆质量评测报告",
            "",
            f"- 综合分: **{self.overall:.2f}** / 1.00",
            f"- 存储后端: {self.storage_kind} · 嵌入: {self.embed_kind}",
            f"- 耗时: {self.duration_ms} ms",
            "",
            "| 维度 | 得分 | 说明 |",
            "|---|---|---|",
        ]
        for d in self.dimensions:
            lines.append(f"| {d.name} | {d.score:.2f} | {d.detail} |")
        return "\n".join(lines)


# ---------------------------------------------------------------------------
# 离线测试用:词袋哈希伪向量 + 内存存储
# ---------------------------------------------------------------------------


def _bag_hash_embed(text: str, dim: int = 64) -> list[float]:
    """词袋哈希伪向量:同词文本向量相似,词完全不同则远离。

    用于离线确定性评测(真实 LLM embed 在测试环境不可用)。词袋散列到 dim 维,
    每维取词频的 tanh 压缩,最后 L2 归一化。向量语义 = 词集合的软 Jaccard。
    """
    vec = [0.0] * dim
    for token in _tokenize(text):
        h = int(hashlib.md5(token.encode("utf-8")).hexdigest()[:8], 16)
        vec[h % dim] += 1.0
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def _tokenize(text: str) -> list[str]:
    """极简分词:连续 CJK 双字块 + 拉丁词,统一小写。"""
    tokens: list[str] = []
    # 拉丁词
    for w in text.lower().split():
        cleaned = "".join(ch for ch in w if ch.isalnum())
        if cleaned:
            tokens.append(cleaned)
    # CJK 双字块(2-gram),捕捉中文短语相似度
    cjk = "".join(ch for ch in text if "\u4e00" <= ch <= "\u9fff")
    for i in range(len(cjk) - 1):
        tokens.append(cjk[i : i + 2])
    return tokens


class InMemoryVectorStore:
    """纯内存向量存储(评测专用,实现 VectorStore 协议)。"""

    def __init__(self) -> None:
        self._entries: dict[str, dict[str, Any]] = {}
        self._vectors: dict[str, list[float]] = {}

    async def add_entry(
        self, entry_id: str, entry: dict[str, Any], embedding: list[float]
    ) -> None:
        self._entries[entry_id] = entry
        self._vectors[entry_id] = embedding

    async def search(
        self,
        query_embedding: list[float],
        top_k: int = 10,
        threshold: float = 0.0,
    ) -> list[tuple[str, dict[str, Any], float]]:
        scored: list[tuple[str, dict[str, Any], float]] = []
        for eid, vec in self._vectors.items():
            sim = _cosine(query_embedding, vec)
            if sim >= threshold:
                scored.append((eid, self._entries.get(eid, {}), sim))
        scored.sort(key=lambda x: x[2], reverse=True)
        return scored[:top_k]

    def list_entries(self) -> list[dict[str, Any]]:
        return [dict(e) for e in self._entries.values()]

    def list_entry_ids(self) -> list[str]:
        return list(self._entries.keys())

    async def update_embedding(self, entry_id: str, embedding: list[float]) -> None:
        if entry_id in self._entries:
            self._vectors[entry_id] = embedding

    async def delete(self, entry_id: str) -> None:
        self._entries.pop(entry_id, None)
        self._vectors.pop(entry_id, None)

    def clear(self) -> None:
        self._entries.clear()
        self._vectors.clear()


def _cosine(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b, strict=True))
    na = math.sqrt(sum(x * x for x in a)) or 1.0
    nb = math.sqrt(sum(y * y for y in b)) or 1.0
    return dot / (na * nb)


# ---------------------------------------------------------------------------
# 评测器
# ---------------------------------------------------------------------------


class MemoryQualityEvaluator:
    """对给定存储执行记忆质量评测。

    参数:
        store: 实现 VectorStore 协议(默认 InMemoryVectorStore)
        embed: 文本→向量(默认词袋哈希,全离线;传入 llm_gateway embed 即真实评测)
        storage_kind / embed_kind: 仅用于报告展示的标签
    """

    def __init__(
        self,
        store: VectorStore | None = None,
        embed: Callable[[str], Awaitable[list[float] | None]] | None = None,
        *,
        storage_kind: str = "in-memory",
        embed_kind: str = "bag-hash",
    ) -> None:
        self.store = store or InMemoryVectorStore()
        self._embed = embed or (lambda t: _async_bag(t))
        self.storage_kind = storage_kind
        self.embed_kind = embed_kind

    async def run(self) -> MemoryQualityReport:
        started = time.monotonic()
        dims = [
            await self._write_consistency(),
            await self._recall_at_k(),
            await self._precision_at_k(),
            await self._mutation_correct(),
            await self._noise_robustness(),
        ]
        overall = sum(d.score for d in dims) / len(dims)
        return MemoryQualityReport(
            dimensions=dims,
            overall=overall,
            duration_ms=int((time.monotonic() - started) * 1000),
            storage_kind=self.storage_kind,
            embed_kind=self.embed_kind,
        )

    # -- 各维度 -----------------------------------------------------------

    async def _fresh(self) -> VectorStore:
        """维度隔离:清空并复用注入的存储(或每次新建内存实例)。

        真实后端评测(run_on_store 注入 VectorMemoryStore 等)必须让所有
        维度写进同一个后端实例,故此处优先清空复用 self.store;仅当外部
        未注入任何 store 时才退化为每维度新建内存实例。
        """
        if self.store is not None:
            self.store.clear()
            return self.store
        return InMemoryVectorStore()

    async def _emb(self, text: str) -> list[float]:
        vec = await self._embed(text)
        return vec or [0.0] * 64

    async def _write_consistency(self) -> DimensionScore:
        """写 10 条 → 全部读回且内容一致。"""
        store = await self._fresh()
        facts = [f"用户偏好事实 {i}:喜欢喝{'咖啡' if i % 2 else '茶'}" for i in range(10)]
        for i, f in enumerate(facts):
            await store.add_entry(f"wc-{i}", {"content": f, "kind": "fact"}, await self._emb(f))
        entries = store.list_entries()
        contents = {e.get("content") for e in entries if e.get("content")}
        hit = sum(1 for f in facts if f in contents)
        score = hit / len(facts)
        detail = f"写入 {len(facts)} 条,读回命中 {hit}/{len(facts)},无内容串改"
        return DimensionScore("write_consistency", score, detail)

    async def _recall_at_k(self) -> DimensionScore:
        """三主题 × 3 条;每主题 1 条查询,top3 内命中本主题任一条即计召回。"""
        store = await self._fresh()
        topics: dict[str, list[str]] = {
            "咖啡": [
                "用户喜欢拿铁咖啡,每天早晨一杯",
                "用户偏好中深度烘焙咖啡豆",
                "用户喝咖啡不加糖",
            ],
            "跑步": [
                "用户每周跑步三次,每次五公里",
                "用户参加马拉松训练计划",
                "用户跑步时听播客",
            ],
            "Python": [
                "用户是 Python 开发者,擅长 FastAPI",
                "用户写过多线程爬虫项目",
                "用户熟悉异步编程 asyncio",
            ],
        }
        eid = 0
        for topic, texts in topics.items():
            for t in texts:
                vec = await self._emb(t)
                await store.add_entry(f"rc-{eid}", {"content": t, "topic": topic}, vec)
                eid += 1
        queries = {
            "咖啡": "早上喝什么提神?咖啡偏好",
            "跑步": "运动习惯是什么?",
            "Python": "后端用什么语言?",
        }
        recalled = 0
        for topic, q in queries.items():
            hits = await store.search(await self._emb(q), top_k=3, threshold=0.0)
            if any(e.get("topic") == topic for _hid, e, _s in hits):
                recalled += 1
        score = recalled / len(queries)
        detail = f"3 主题 × 3 事实,3 查询 top3 命中 {recalled}/3"
        return DimensionScore("recall_at_k", score, detail)

    async def _precision_at_k(self) -> DimensionScore:
        """写入 A/B 两主题各 3 条 + 3 条无关噪声;A 查询 top3 应全属 A。"""
        store = await self._fresh()
        a_texts = [f"用户 A{i} 喜欢喝茶和龙井" for i in range(3)]
        b_texts = [f"用户 B{i} 喜欢喝可乐和雪碧" for i in range(3)]
        noise = ["今天天气不错适合散步", "股票市场波动较大", "用户养了一只橘猫"]
        for i, t in enumerate(a_texts):
            await store.add_entry(f"pa-{i}", {"content": t, "topic": "tea"}, await self._emb(t))
        for i, t in enumerate(b_texts):
            await store.add_entry(f"pb-{i}", {"content": t, "topic": "cola"}, await self._emb(t))
        for i, t in enumerate(noise):
            await store.add_entry(f"pn-{i}", {"content": t, "topic": "noise"}, await self._emb(t))
        q = "用户喝茶有什么偏好?"
        hits = await store.search(await self._emb(q), top_k=3, threshold=0.0)
        correct = sum(1 for _hid, e, _s in hits if e.get("topic") == "tea")
        polluted = len(hits) - correct
        score = correct / max(len(hits), 1)
        detail = f"A 主题查询 top{max(len(hits), 1)} 中属 A {correct} 条(含 {polluted} 条污染)"
        return DimensionScore("precision_at_k", score, detail)

    async def _mutation_correct(self) -> DimensionScore:
        """删除旧事实、更新向量后:旧条目不再被召回,新语义可召回。"""
        store = await self._fresh()
        old = "用户现在用 iPhone 13"
        new = "用户现在用 Pixel 9"
        await store.add_entry("mt-old", {"content": old, "topic": "phone"}, await self._emb(old))
        await store.add_entry("mt-new", {"content": new, "topic": "phone"}, await self._emb(new))
        # 1) 删除旧 → 旧查询不再召回 mt-old
        await store.delete("mt-old")
        q_old = "用户用什么苹果手机?"
        hits_old = await store.search(await self._emb(q_old), top_k=5, threshold=0.0)
        ghost = any(hid == "mt-old" for hid, _e, _s in hits_old)
        # 2) 更新 mt-new 的向量为"旧语义",旧查询应能召回(证明 update 生效)
        await store.update_embedding("mt-new", await self._emb(old))
        hits_upd = await store.search(await self._emb(q_old), top_k=5, threshold=0.0)
        updated = any(hid == "mt-new" for hid, _e, _s in hits_upd)
        checks = [(not ghost, "删除后无幽灵命中"), (updated, "更新向量后可按新语义召回")]
        passed = sum(1 for ok, _why in checks if ok)
        detail = "; ".join(why if ok else f"失败:{why}" for ok, why in checks)
        return DimensionScore("mutation_correct", passed / len(checks), detail)

    async def _noise_robustness(self) -> DimensionScore:
        """1 条强相关 + 5 条弱噪声,查询应稳定命中强相关(top1 = 强相关)。

        词袋伪 embed 下"查询 = 强相关条目的近义改写"(共享足量词汇)才成立;
        噪声条目刻意与查询零同词,以验证弱相关不挤占强相关命中。
        """
        store = await self._fresh()
        strong = "用户在长春经营人工智能公司,专注 AI 应用落地"
        weak = [
            "今天气温很高适合游泳",
            "股票市场今天波动较大",
            "团队上周末去了净月潭徒步",
            "用户养了一只橘色小猫",
            "书店上新了一批历史书籍",
        ]
        s_vec = await self._emb(strong)
        await store.add_entry("ns-strong", {"content": strong, "topic": "strong"}, s_vec)
        for i, w in enumerate(weak):
            w_vec = await self._emb(w)
            await store.add_entry(f"ns-w{i}", {"content": w, "topic": "weak"}, w_vec)
        # 查询 = 强相关条目改写:共享"用户/长春/人工智能/公司/AI/应用"等词
        q = "用户的长春人工智能公司专注 AI 应用落地业务"
        hits = await store.search(await self._emb(q), top_k=1, threshold=0.0)
        top_ok = bool(hits) and hits[0][0] == "ns-strong"
        hit_topic = hits[0][1].get("topic") if hits else "空"
        detail = f"top1 命中强相关: {top_ok}(命中 {hit_topic})"
        return DimensionScore("noise_robustness", 1.0 if top_ok else 0.0, detail)


async def _async_bag(text: str) -> list[float]:
    return _bag_hash_embed(text)


async def run_offline() -> MemoryQualityReport:
    """零依赖离线评测(内置内存存储 + 词袋伪向量)。"""
    return await MemoryQualityEvaluator().run()


async def run_on_store(
    store: VectorStore,
    embed: Callable[[str], Awaitable[list[float] | None]],
    *,
    storage_kind: str = "custom",
    embed_kind: str = "custom",
) -> MemoryQualityReport:
    """对真实存储(如 VectorMemoryStore + llm_gateway embed)跑评测。"""
    return await MemoryQualityEvaluator(
        store=store, embed=embed, storage_kind=storage_kind, embed_kind=embed_kind
    ).run()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
