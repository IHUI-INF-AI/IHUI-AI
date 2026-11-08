# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""SAG2 词法通道·索引层（本仓自有实现）。

取证自对照程序 ``store.rs`` 的**行为与设计**：contentless 倒排索引、
BM25 粗筛、文件 hash 驱动的增量重建、索引版本递增使查询缓存失效、
引用锚定到「文件 hash + 原文区间 + 保存的片段」。

差异（贴本仓架构的超越轴）：对照用 SQLite FTS5 单机库；本层用内存倒排 +
标准 BM25(k1/b/字段权重)，零新依赖、零 DDL、无需数据库即可跑全量测试。
生产可替换为 Postgres ``tsvector`` 适配器，接口不变。

建库阶段**不调用任何模型、不算 embedding、不抽实体关系**——这是 SAG2
相对 GraphRAG 一类方案的核心分工：语料准备只提供通用词法访问能力。
"""

from __future__ import annotations

import hashlib
import math
from dataclasses import dataclass
from typing import Any

from .text import casefold_tokens, sentence_spans

BM25_K1 = 1.2
BM25_B = 0.75
TITLE_BOOST = 2
HEADING_BOOST = 2
DEFAULT_CHUNK_SIZE = 512
DEFAULT_CHUNK_OVERLAP = 80


def sha256_text(text: str) -> str:
    """文件内容指纹（增量索引与 citation 锚定共用）。"""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


@dataclass
class Chunk:
    """一个段落块及其在原文件中的锚点。"""

    chunk_id: int
    path: str
    title: str
    heading: str
    content: str
    start: int
    end: int
    start_line: int
    end_line: int
    doc_hash: str


@dataclass
class ScoredChunk:
    """带分数的候选；``score`` 为证据判断分，``bm25`` 保留词法先验。"""

    chunk: Chunk
    score: float = 0.0
    bm25: float = 0.0
    order: int = 0
    previous_score: float | None = None
    hop: int = 0

    @property
    def key(self) -> str:
        c = self.chunk
        return f"{c.path}#{c.chunk_id}:{c.start}-{c.end}"

    @property
    def content(self) -> str:
        return self.chunk.content

    @property
    def path(self) -> str:
        return self.chunk.path


@dataclass
class AddOutcome:
    """增量索引结果：是否真的重建、原因、指纹、块数、版本。"""

    changed: bool
    reason: str
    doc_hash: str
    chunk_count: int
    version: int


class LexicalIndex:
    """纯词法倒排索引（可独立运行，无外部服务）。"""

    def __init__(self) -> None:
        self._chunks: dict[int, Chunk] = {}
        self._postings: dict[str, dict[int, int]] = {}
        self._lengths: dict[int, int] = {}
        self._doc_chunks: dict[str, list[int]] = {}
        self._doc_hashes: dict[str, str] = {}
        self._doc_sources: dict[str, str] = {}
        self._next_id = 1
        self.version = 0
        self._avgdl = 0.0

    # ------------------------------------------------------------------
    # 写入 / 增量
    # ------------------------------------------------------------------

    def add_document(
        self,
        path: str,
        content: str,
        *,
        title: str | None = None,
        heading: str = "",
        chunk_size: int = DEFAULT_CHUNK_SIZE,
        overlap: int = DEFAULT_CHUNK_OVERLAP,
    ) -> AddOutcome:
        """登记一个文档；hash 未变则**不重建**（对照的增量语义）。"""
        fingerprint = sha256_text(content)
        doc_title = title or path.rsplit("/", 1)[-1]
        if self._doc_hashes.get(path) == fingerprint:
            return AddOutcome(
                changed=False,
                reason="unchanged:文件 hash 未变,跳过重建",
                doc_hash=fingerprint,
                chunk_count=len(self._doc_chunks.get(path, [])),
                version=self.version,
            )

        self._remove_chunks(path)
        self._doc_sources[path] = content
        self._doc_hashes[path] = fingerprint
        spans = sentence_spans(content)
        blocks = self._build_blocks(content, spans, chunk_size, overlap)
        new_ids: list[int] = []
        for start, end, text in blocks:
            cid = self._next_id
            self._next_id += 1
            chunk = Chunk(
                chunk_id=cid,
                path=path,
                title=doc_title,
                heading=heading,
                content=text,
                start=start,
                end=end,
                start_line=content.count("\n", 0, start) + 1,
                end_line=content.count("\n", 0, end) + 1,
                doc_hash=fingerprint,
            )
            self._chunks[cid] = chunk
            new_ids.append(cid)
            self._index_chunk(chunk, doc_title, heading)
        self._doc_chunks[path] = new_ids
        self.version += 1
        self._refresh_avgdl()
        return AddOutcome(
            changed=True,
            reason="rebuilt:文件新增或 hash 变化",
            doc_hash=fingerprint,
            chunk_count=len(new_ids),
            version=self.version,
        )

    def _build_blocks(
        self,
        content: str,
        spans: list[tuple[int, int, str]],
        chunk_size: int,
        overlap: int,
    ) -> list[tuple[int, int, str]]:
        """按句累积到目标长度，相邻块以完整句子重叠。

        对照：正文块目标约 512 字符、保留完整句子、相邻重叠约 80 字符，
        块内保留 heading 路径与行列位置。
        """
        if not spans:
            return [(0, len(content), content)] if content else []
        blocks: list[tuple[int, int, str]] = []
        current: list[tuple[int, int, str]] = []
        current_len = 0
        for span in spans:
            length = span[1] - span[0]
            if current and current_len + length > chunk_size:
                blocks.append(self._emit(content, current))
                kept: list[tuple[int, int, str]] = []
                acc = 0
                for item in reversed(current):
                    if acc >= overlap:
                        break
                    kept.insert(0, item)
                    acc += item[1] - item[0]
                current = kept
                current_len = acc
            current.append(span)
            current_len += length
        if current:
            blocks.append(self._emit(content, current))
        return blocks

    @staticmethod
    def _emit(
        content: str, spans: list[tuple[int, int, str]]
    ) -> tuple[int, int, str]:
        start, end = spans[0][0], spans[-1][1]
        return start, end, content[start:end]

    def _index_chunk(self, chunk: Chunk, title: str, heading: str) -> None:
        cid = chunk.chunk_id
        body_terms = casefold_tokens(chunk.content)
        self._lengths[cid] = len(body_terms) or 1
        weighted: dict[str, int] = {}
        for term in body_terms:
            weighted[term] = weighted.get(term, 0) + 1
        # 对照 bm25(chunk_fts,2,2,1)：title/heading 列权重为 2，body 为 1。
        for term in casefold_tokens(title):
            weighted[term] = weighted.get(term, 0) + TITLE_BOOST
        for term in casefold_tokens(heading):
            weighted[term] = weighted.get(term, 0) + HEADING_BOOST
        for term, count in weighted.items():
            self._postings.setdefault(term, {})[cid] = count

    def _remove_chunks(self, path: str) -> None:
        for cid in self._doc_chunks.pop(path, []):
            self._chunks.pop(cid, None)
            self._lengths.pop(cid, None)
        for posting in self._postings.values():
            for cid in [c for c in posting if c not in self._chunks]:
                posting.pop(cid, None)
        self._postings = {t: p for t, p in self._postings.items() if p}

    def remove_document(self, path: str) -> bool:
        """移除文档索引（原文件不动，对照语义）。"""
        if path not in self._doc_hashes:
            return False
        self._remove_chunks(path)
        self._doc_hashes.pop(path, None)
        self._doc_sources.pop(path, None)
        self.version += 1
        self._refresh_avgdl()
        return True

    def _refresh_avgdl(self) -> None:
        self._avgdl = (
            sum(self._lengths.values()) / len(self._lengths) if self._lengths else 0.0
        )

    # ------------------------------------------------------------------
    # 统计 / 打分
    # ------------------------------------------------------------------

    def chunk_count(self) -> int:
        return len(self._chunks)

    def document_count(self) -> int:
        return len(self._doc_hashes)

    def frequency(self, term: str) -> int:
        """含该词的块数 df。"""
        return len(self._postings.get(term, {}))

    def bm25_idf(self, term: str) -> float:
        """BM25 平滑 IDF：ln(1 + (N - df + 0.5)/(df + 0.5))。"""
        n = self.chunk_count()
        df = self.frequency(term)
        return math.log(1.0 + (n - df + 0.5) / (df + 0.5))

    def corpus_idf(self, term: str) -> float:
        """词表 IDF：ln((1+N)/(1+df)) + 1（DPP 向量与词表统计用）。"""
        n = self.chunk_count()
        df = self.frequency(term)
        return math.log((1.0 + n) / (1.0 + df)) + 1.0

    def _bm25_term(self, term: str, cid: int) -> float:
        tf = self._postings.get(term, {}).get(cid, 0)
        if tf <= 0:
            return 0.0
        dl = self._lengths.get(cid, 1) or 1
        avgdl = self._avgdl or 1.0
        denominator = tf + BM25_K1 * (1.0 - BM25_B + BM25_B * dl / avgdl)
        if denominator <= 0:
            return 0.0
        return self.bm25_idf(term) * (tf * (BM25_K1 + 1.0)) / denominator

    def has_match(self, term: str) -> bool:
        """词项在索引里是否有命中（查询词修复/扩展词解析用）。"""
        return any(token in self._postings for token in casefold_tokens(term))

    def candidate_query(
        self,
        terms: list[str],
        limit: int,
        excluded: set[str] | None = None,
    ) -> list[ScoredChunk]:
        """BM25 粗筛：宽松 OR 合并，返回按词法分降序的候选。"""
        excluded = excluded or set()
        scores: dict[int, float] = {}
        for term in terms:
            for cid in self._postings.get(term, {}):
                scores[cid] = scores.get(cid, 0.0) + self._bm25_term(term, cid)
        ranked = sorted(
            (cid for cid, value in scores.items() if value > 0),
            key=lambda cid: (-scores[cid], cid),
        )
        out: list[ScoredChunk] = []
        for cid in ranked:
            chunk = self._chunks.get(cid)
            if chunk is None:
                continue
            candidate = ScoredChunk(chunk=chunk, bm25=scores[cid])
            # 先排除已见候选，再按 limit 截断。对照的 FTS5 SQL 把 excluded
            # 放在 WHERE 里再 LIMIT；若反过来「先 LIMIT 再过滤」，用 limit=1
            # 探测词项是否还有新命中时，第一名恰好是已见段落就会误判为
            # 「无新命中」，把真正的桥接词丢掉（小语料实测会退化成单轮）。
            if candidate.key in excluded:
                continue
            candidate.order = len(out)
            out.append(candidate)
            if len(out) >= limit:
                break
        return out

    def candidate_queries(
        self,
        required_terms: list[str],
        limit: int,
        excluded: set[str] | None = None,
    ) -> list[list[ScoredChunk]]:
        """每个扩展词一组候选，供 ``interleave`` 按 rank 轮询合并。

        对照扩展轮构造 ``"term1" OR "term2" ... OR (原查询)``，并为每个
        required term 单独召回一组，避免某个高频词独占整个候选池。
        """
        return [
            self.candidate_query([term], limit, excluded)
            for term in required_terms
        ]

    # ------------------------------------------------------------------
    # hydration / citation
    # ------------------------------------------------------------------

    def hydrate(self, candidate: ScoredChunk) -> bool:
        """校验原文指纹与区间是否仍匹配。

        对照：文件变更后请求重索引，而不是把旧位置套到新正文上；
        单个陈旧文件只跳过该候选，不让整次查询失败。
        """
        c = candidate.chunk
        source = self._doc_sources.get(c.path)
        if source is None or sha256_text(source) != c.doc_hash:
            return False
        return source[c.start : c.end] == c.content

    def citation(self, candidate: ScoredChunk) -> dict[str, Any]:
        """引用锚点：文件 hash + 字符区间 + 行列 + 生成答案时用的原片段。"""
        c = candidate.chunk
        return {
            "path": c.path,
            "title": c.title,
            "heading": c.heading,
            "doc_hash": c.doc_hash,
            "byte_range": [c.start, c.end],
            "start_line": c.start_line,
            "end_line": c.end_line,
            "passage": c.content,
            "score": round(candidate.score, 6),
            "bm25": round(candidate.bm25, 6),
            "hop": candidate.hop,
        }

    def status(self) -> dict[str, Any]:
        """索引状态（显式读出，供「索引未就绪」判定）。"""
        return {
            "version": self.version,
            "documents": self.document_count(),
            "chunks": self.chunk_count(),
            "terms": len(self._postings),
            "avg_chunk_length": round(self._avgdl, 3),
            "ready": self.chunk_count() > 0,
            "backend": "in-memory-inverted-index",
        }
