# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""父子块切分器(small-to-big / parent-child chunking)· 生产移植版。

移植自骨架 .ihui-agent/tmp/kb-rag-scaffold/chunking/parent_child_chunker.py
(纯标准库、零第三方依赖,tiktoken 可选),保留其全部公开 API 与确定性
chunk_id(sha1(doc_id|kind|seq|text[:64])[:16])、strip_watermark、
estimate_tokens、expand_to_parents 等核心行为。

生产接线(app/services/rag.py,默认关闭,env RAG_PARENT_CHILD_ENABLED=1/true 启用):
- 摄取:add_document 逐子块 embed + 写入 vector_memory,entry 额外携带
  rag_doc_id / rag_parent_id / rag_parent_text / rag_child_text;
- 检索:向量路命中带 rag_parent_text 的条目时,送入 LLM 上下文的 content
  换为父块全文(small-to-big),子块命中证据保留在 RAGSource.rag_child_text。

切分预算配置沿用骨架的 KB_CHUNK_* 环境变量(ChunkerConfig.from_env()):
- KB_CHUNK_PARENT_TOKENS        父块 token 上限,默认 1200
- KB_CHUNK_CHILD_TOKENS         子块 token 上限,默认 300
- KB_CHUNK_CHILD_OVERLAP_RATIO  子块重叠比例 [0,0.5],默认 0.15
- KB_CHUNK_USE_TIKTOKEN         尝试 tiktoken 精确计数,默认关(未装自动回退)

中文知识库 RAG 摄取层组件:把一篇 Markdown 文档切成
- 父块(parent,默认目标 ~1200 token):送进 LLM 上下文的大块,保语义完整;
- 子块(child,默认目标 ~300 token):进向量库(Qdrant/ES)做召回的小块,带重叠窗口。

核心不变式(由构造保证,骨架 self_test 逐条断言):
1. child ⊆ parent:子块是父块字符区间 [parent.start, parent.end) 内的连续子区间;
2. 确定性:同一 (doc_id, 文本, 配置) 两次切分,chunk_id / 边界 / 数量完全一致;
3. 预算:父/子块的"正文 token 估算值"不超过各自上限(标题行不计预算;
   仅当存在不可再分的超长原子单元——如超大代码块——时才走字符硬切兜底);
4. Markdown 感知:标题行只进 heading_path 不占预算;围栏代码块(``` / ~~~)内部
   永不被任何分隔符切开(硬切兜底除外)。

依赖:纯标准库。tiktoken 为**可选**精确计数后端(prefer_tiktoken=True 时
try/except 导入,失败自动回退启发式估算),不是硬依赖。

公开 API:
    ChunkerConfig            配置(含 from_env())
    ParentChildChunker       切分器,chunk_document(text, doc_id, source) -> ChunkingResult
    Chunk / ChildHit / ParentHit / ChunkingResult
    expand_to_parents()      small-to-big:子块命中 -> 去重父块 + 命中证据
    export_jsonl()           父/子统一 JSONL 导出(type 字段区分),供 Qdrant/ES 摄取
    estimate_tokens()        启发式 token 估算(CJK≈1/字,ASCII≈4 字/token)
    find_code_regions()      扫描围栏代码块的字符区间
"""

from __future__ import annotations

import hashlib
import json
import os
import re
from bisect import bisect_left, bisect_right
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, field
from typing import Literal

__all__ = [
    "Chunk",
    "ChunkKind",
    "ChunkerConfig",
    "ChunkingResult",
    "ChildHit",
    "ParentHit",
    "ParentChildChunker",
    "TokenCounter",
    "estimate_tokens",
    "expand_to_parents",
    "export_jsonl",
    "find_code_regions",
    "strip_watermark",
]

# ---------------------------------------------------------------------------
# token 计数:默认启发式,tiktoken 可选精确(绝不硬依赖)
# ---------------------------------------------------------------------------


def _is_cjk(ch: str) -> bool:
    """是否按"1 字符 ≈ 1 token"口径计费的 CJK/全角字符。"""
    o = ord(ch)
    return (
        0x3400 <= o <= 0x4DBF      # 扩展 A
        or 0x4E00 <= o <= 0x9FFF   # 基本汉字
        or 0x3000 <= o <= 0x303F   # CJK 标点(。、「」等)
        or 0xFF00 <= o <= 0xFFEF   # 全角字符(?,、等)
        or 0xF900 <= o <= 0xFAFF   # 兼容表意文字
    )


def estimate_tokens(text: str) -> int:
    """启发式 token 估算:CJK 字符 ≈ 1 token,其余(ASCII 等)约 4 字符 ≈ 1 token。

    与 ai-service rag.py 的 _build_context 粗估口径同级,但区分了中英文,
    对中文知识库文档的预算控制更稳。
    """
    if not text:
        return 0
    cjk = sum(1 for ch in text if _is_cjk(ch))
    other = len(text) - cjk
    return cjk + (other + 3) // 4


class TokenCounter:
    """token 计数器。prefer_tiktoken=True 时尝试精确编码,任何失败回退启发式。

    tiktoken 不可用(未安装 / 词表下载失败 / 编码异常)都不会抛错,
    保证本模块在无第三方依赖的环境(如纯 stdlib 的 self_test)可运行。
    """

    def __init__(self, prefer_tiktoken: bool = False) -> None:
        self._encoding = None
        self._fallback = estimate_tokens
        if prefer_tiktoken:
            try:  # noqa: S112 - 可选依赖探测,失败即静默回退是本类的设计
                import tiktoken  # type: ignore[import-not-found]

                self._encoding = tiktoken.get_encoding("cl100k_base")
            except Exception:
                self._encoding = None

    @property
    def exact(self) -> bool:
        """当前是否启用了 tiktoken 精确计数。"""
        return self._encoding is not None

    def count(self, text: str) -> int:
        if self._encoding is not None:
            try:
                return len(self._encoding.encode(text))
            except Exception:
                pass
        return self._fallback(text)


# ---------------------------------------------------------------------------
# 配置(环境变量约定对齐 ai-service:大写 env 名 + 非法值回退默认)
# ---------------------------------------------------------------------------

ENV_PARENT_TOKENS = "KB_CHUNK_PARENT_TOKENS"
ENV_CHILD_TOKENS = "KB_CHUNK_CHILD_TOKENS"
ENV_CHILD_OVERLAP = "KB_CHUNK_CHILD_OVERLAP_RATIO"
ENV_USE_TIKTOKEN = "KB_CHUNK_USE_TIKTOKEN"

DEFAULT_PARENT_MAX_TOKENS = 1200
DEFAULT_CHILD_MAX_TOKENS = 300
DEFAULT_CHILD_OVERLAP_RATIO = 0.15


@dataclass(frozen=True)
class ChunkerConfig:
    """父子块切分配置。

    - parent_max_tokens: 父块正文 token 上限(标题行不计入,见不变式 3)
    - child_max_tokens:  子块正文 token 上限(含重叠部分)
    - child_overlap_ratio: 子块重叠窗口占 child_max_tokens 的比例,[0, 0.5]
    - prefer_tiktoken:   尝试用 tiktoken 精确计数(可选依赖,失败回退启发式)
    """

    parent_max_tokens: int = DEFAULT_PARENT_MAX_TOKENS
    child_max_tokens: int = DEFAULT_CHILD_MAX_TOKENS
    child_overlap_ratio: float = DEFAULT_CHILD_OVERLAP_RATIO
    prefer_tiktoken: bool = False

    def __post_init__(self) -> None:
        if self.parent_max_tokens <= 0 or self.child_max_tokens <= 0:
            raise ValueError("token 预算必须为正数")
        if self.child_max_tokens > self.parent_max_tokens:
            raise ValueError("child_max_tokens 不得大于 parent_max_tokens")
        if not 0.0 <= self.child_overlap_ratio <= 0.5:
            raise ValueError("child_overlap_ratio 必须在 [0, 0.5] 内")

    @property
    def child_overlap_tokens(self) -> int:
        """子块重叠窗口的 token 预算。"""
        return int(round(self.child_max_tokens * self.child_overlap_ratio))

    @classmethod
    def from_env(cls) -> "ChunkerConfig":
        """从环境变量构建(非法/缺失回退默认,行为对齐 rag.resolve_rrf_k)。"""

        def _positive_int(name: str, default: int) -> int:
            raw = os.environ.get(name, "").strip()
            try:
                value = int(raw)
            except ValueError:
                return default
            return value if value > 0 else default

        def _ratio(name: str, default: float) -> float:
            raw = os.environ.get(name, "").strip()
            try:
                value = float(raw)
            except ValueError:
                return default
            return value if 0.0 <= value <= 0.5 else default

        use_tiktoken = os.environ.get(ENV_USE_TIKTOKEN, "").strip().lower() in {
            "1", "true", "yes", "on",
        }
        return cls(
            parent_max_tokens=_positive_int(ENV_PARENT_TOKENS, DEFAULT_PARENT_MAX_TOKENS),
            child_max_tokens=_positive_int(ENV_CHILD_TOKENS, DEFAULT_CHILD_MAX_TOKENS),
            child_overlap_ratio=_ratio(ENV_CHILD_OVERLAP, DEFAULT_CHILD_OVERLAP_RATIO),
            prefer_tiktoken=use_tiktoken,
        )


# ---------------------------------------------------------------------------
# 数据结构
# ---------------------------------------------------------------------------

ChunkKind = Literal["parent", "child"]

# 递归切分分隔符优先级(首项为伪分隔符:Markdown 标题层级边界):
# 标题 > 空行 > 换行 > 中文句号/问号/叹号 > 逗号 > (兜底字符硬切)
_HEADING_SEP = "\x00heading"
SEPARATORS: tuple[str, ...] = (
    _HEADING_SEP, "\n\n", "\n", "。", "？", "！", "，", ",",
)

_HEADING_RE = re.compile(r"^(#{1,6})\s+\S")
_FENCE_RE = re.compile(r"^\s*(```|~~~)")


@dataclass
class Chunk:
    """一个文本块(父块或子块)。

    - chunk_id: sha1(doc_id|kind|seq|text[:64]) 前 16 位,确定性、可复现
    - text: 预处理文档(strip_watermark 后)[start, end) 区间的**原样切片**
      (不额外 strip,保证偏移可回放;入库/embedding 前请自行 strip)
    - token_count: 正文 token 估算值(标题行不计,与预算断言同一口径)
    - heading_path: 块起点生效的标题栈,如 ["# 部署指南", "## Nginx 配置"]
    """

    doc_id: str
    chunk_id: str
    kind: ChunkKind
    seq: int
    text: str
    heading_path: list[str]
    start: int
    end: int
    source: str
    token_count: int
    parent_id: str | None = None

    def to_dict(self) -> dict[str, object]:
        """JSONL / Qdrant payload 友好的序列化。"""
        return {
            "type": self.kind,
            "doc_id": self.doc_id,
            "chunk_id": self.chunk_id,
            "parent_id": self.parent_id,
            "seq": self.seq,
            "text": self.text,
            "heading_path": list(self.heading_path),
            "start": self.start,
            "end": self.end,
            "source": self.source,
            "token_count": self.token_count,
        }


@dataclass
class ChildHit:
    """子块检索命中(向量/关键词召回结果喂给 expand_to_parents 的单元)。"""

    child: Chunk
    score: float


@dataclass
class ParentHit:
    """展开后的父块命中。

    - score: 该父块所有子块命中里的最高分(代表分)
    - evidence: 命中该父块的**全部**子块,按分数降序(保留命中证据供溯源/高亮)
    """

    parent: Chunk
    score: float
    evidence: list[ChildHit] = field(default_factory=list)


@dataclass
class ChunkingResult:
    """一篇文档的完整切分结果。"""

    doc_id: str
    source: str
    parents: list[Chunk]
    children: list[Chunk]

    @property
    def parents_by_id(self) -> dict[str, Chunk]:
        return {p.chunk_id: p for p in self.parents}

    def children_of(self, parent_id: str) -> list[Chunk]:
        return [c for c in self.children if c.parent_id == parent_id]

    def expand_to_parents(
        self, child_hits: Sequence[ChildHit]
    ) -> list[ParentHit]:
        """便捷入口:等价于 expand_to_parents(child_hits, self.parents_by_id)。"""
        return expand_to_parents(child_hits, self.parents_by_id)


# ---------------------------------------------------------------------------
# 文档结构索引(行/标题/代码块,全部基于原文档绝对偏移)
# ---------------------------------------------------------------------------


@dataclass
class _LineInfo:
    start: int
    end: int
    is_heading: bool


@dataclass
class _HeadingInfo:
    line_start: int
    line_end: int
    path: list[str]


class _DocIndex:
    """一次扫描产出:行表、标题栈、围栏代码块区间;提供预算/切点/路径查询。"""

    def __init__(self, text: str, counter: TokenCounter) -> None:
        self.text = text
        self.counter = counter
        self.lines: list[_LineInfo] = []
        self._line_starts: list[int] = []
        self.headings: list[_HeadingInfo] = []
        self.code_regions: list[tuple[int, int]] = []
        self._scan()

    def _scan(self) -> None:
        in_code = False
        region_start = -1
        stack: list[tuple[int, str]] = []  # (level, 原始标题行文本)
        pos = 0
        for raw in self.text.splitlines(keepends=True):
            s, e = pos, pos + len(raw)
            body = raw.rstrip("\r\n")
            fence = _FENCE_RE.match(body)
            hm = None if fence is not None else _HEADING_RE.match(body)
            is_heading = hm is not None and not in_code
            if fence is not None:
                if not in_code:
                    in_code, region_start = True, s
                else:
                    in_code = False
                    self.code_regions.append((region_start, e))
            elif is_heading and hm is not None:
                level = len(hm.group(1))
                while stack and stack[-1][0] >= level:
                    stack.pop()
                stack.append((level, body))
                self.headings.append(_HeadingInfo(s, e, [t for _, t in stack]))
            self.lines.append(_LineInfo(s, e, is_heading))
            self._line_starts.append(s)
            pos = e
        if in_code:  # 未闭合围栏:兜底到文档末尾,保护剩余内容
            self.code_regions.append((region_start, len(self.text)))

    # ---- 查询 ----

    def _lines_in(self, s: int, e: int) -> Iterable[_LineInfo]:
        i = max(bisect_right(self._line_starts, s) - 1, 0)
        while i < len(self.lines) and self.lines[i].start < e:
            if self.lines[i].end > s:
                yield self.lines[i]
            i += 1

    def budget(self, s: int, e: int) -> int:
        """区间 [s, e) 的正文 token 估算值(标题行不计入预算,代码块计入)。"""
        if e <= s:
            return 0
        total = 0
        for ln in self._lines_in(s, e):
            if ln.is_heading:
                continue
            frag = self.text[max(s, ln.start):min(e, ln.end)]
            if frag:
                total += self.counter.count(frag)
        return total

    def heading_path_at(self, pos: int) -> list[str]:
        """pos 处生效的标题栈(含恰好在 pos 起的标题行本身)。"""
        path: list[str] = []
        for h in self.headings:
            if h.line_start <= pos:
                path = list(h.path)
            else:
                break
        return path

    def strictly_in_code(self, p: int) -> bool:
        """p 是否严格落在某个围栏代码块内部(边界不算)。"""
        starts = [rs for rs, _ in self.code_regions]
        i = bisect_right(starts, p) - 1
        return i >= 0 and starts[i] < p < self.code_regions[i][1]

    def valid_cut(self, p: int) -> bool:
        """切点合法性:不切进代码块内部,不把标题行与其后正文拆开。"""
        if self.strictly_in_code(p):
            return False
        return not any(h.line_end == p for h in self.headings)

    def cut_points(self, sep: str, s: int, e: int) -> list[int]:
        """按分隔符 sep 在 (s, e) 内的合法切点(分隔符随左侧内容走)。"""
        if sep == _HEADING_SEP:
            return [h.line_start for h in self.headings if s < h.line_start < e]
        pts: list[int] = []
        i = self.text.find(sep, s)
        while i != -1 and i < e:
            p = i + len(sep)
            if s < p < e and self.valid_cut(p):
                pts.append(p)
            i = self.text.find(sep, i + 1)
        return pts


def find_code_regions(text: str) -> list[tuple[int, int]]:
    """扫描 Markdown 围栏代码块的 [start, end) 字符区间(公开辅助函数)。"""
    return _DocIndex(text, TokenCounter()).code_regions


# ---------------------------------------------------------------------------
# 切分器
# ---------------------------------------------------------------------------


_HTML_COMMENT_RE = re.compile(r"<!--.*?-->", re.DOTALL)
_ZERO_WIDTH_RE = re.compile(r"[\u200b-\u200f\u2060\ufeff]")


def strip_watermark(text: str) -> str:
    """摄取预处理:剥离 HTML 注释(含 provenance 水印)与零宽字符(U+200B/200C/200D/FEFF 等)。

    真实语料缺陷修复:文档头部水印 HTML 注释(~1.5k 字符、近千个零宽字符)按启发式
    token 估算计入 ≈375 token,吃掉首父块约 1/3 预算。放在 chunking 摄取入口
    (chunk_document 顶部)而非 generator 侧:预算问题必须在 token 估算前解决,
    且切分产物(子块/导出 JSONL/下游 embedding)同享干净文本。
    无注释/无零宽字符的输入为 no-op,不影响 child⊆parent、确定性等不变式;
    剥离后 start/end 偏移以预处理文本为准(Chunk.text 仍是其原样切片)。
    """
    if "<!--" not in text and not _ZERO_WIDTH_RE.search(text):
        return text
    return _ZERO_WIDTH_RE.sub("", _HTML_COMMENT_RE.sub("", text))


def _make_chunk_id(doc_id: str, kind: str, seq: int, text: str) -> str:
    """确定性 chunk_id:sha1(doc_id|kind|seq|text 前 64 字符) 前 16 位。"""
    h = hashlib.sha1()
    h.update(doc_id.encode("utf-8"))
    h.update(b"\x1f")
    h.update(kind.encode("utf-8"))
    h.update(b"\x1f")
    h.update(str(seq).encode("utf-8"))
    h.update(b"\x1f")
    h.update(text[:64].encode("utf-8"))
    return h.hexdigest()[:16]


class ParentChildChunker:
    """父子两级切分器。

    用法::

        chunker = ParentChildChunker(ChunkerConfig.from_env())
        result = chunker.chunk_document(md_text, doc_id="deploy-guide", source="deploy.md")
        export_jsonl(result.parents, result.children, "chunks.jsonl")
    """

    def __init__(self, config: ChunkerConfig | None = None) -> None:
        self.config = config or ChunkerConfig()
        self.counter = TokenCounter(self.config.prefer_tiktoken)

    # ---- 公开 ----

    def chunk_document(
        self,
        text: str,
        doc_id: str,
        source: str = "",
    ) -> ChunkingResult:
        """把整篇文档切成父/子两级块。纯函数式:不改任何全局状态,同输入必同输出。"""
        if not doc_id:
            raise ValueError("doc_id 不能为空")
        # 摄取入口预处理:剥水印 HTML 注释与零宽字符(见 strip_watermark 的放置理由注释;
        # 对无水印输入为 no-op,下方切分与偏移均基于预处理后的文本)
        text = strip_watermark(text)
        idx = _DocIndex(text, self.counter)

        parent_spans = self._split_to_budget(idx, 0, len(text), self.config.parent_max_tokens, SEPARATORS)
        parents: list[Chunk] = []
        for s, e in parent_spans:
            if not text[s:e].strip():
                continue
            parents.append(
                self._make_chunk(idx, text, doc_id, source, "parent", s, e, None, len(parents))
            )

        children: list[Chunk] = []
        for parent in parents:
            spans = self._split_to_budget(
                idx, parent.start, parent.end, self.config.child_max_tokens, SEPARATORS
            )
            for j, (s, e) in enumerate(spans):
                if not text[s:e].strip():
                    continue
                cs = s
                if j > 0:  # 重叠窗口:向前扩,受 overlap 与子块预算双重上限约束
                    cur = idx.budget(s, e)
                    cap = min(
                        self.config.child_overlap_tokens,
                        self.config.child_max_tokens - cur,
                    )
                    cs = self._extend_start(idx, s, parent.start, cap)
                children.append(
                    self._make_chunk(
                        idx, text, doc_id, source, "child", cs, e,
                        parent.chunk_id, len(children),
                    )
                )

        return ChunkingResult(
            doc_id=doc_id, source=source, parents=parents, children=children
        )

    # ---- 私有:区间切分 ----

    def _split_to_budget(
        self,
        idx: _DocIndex,
        s: int,
        e: int,
        max_tokens: int,
        seps: tuple[str, ...],
    ) -> list[tuple[int, int]]:
        """递归分隔符切分:保证每个返回区间的 budget() <= max_tokens。

        策略:按当前分隔符切成"碎片"(分隔符随左侧),贪心合并相邻碎片直到再并
        就超预算;单个碎片仍超预算的,降级用下一个分隔符递归;分隔符穷尽后走
        字符硬切兜底(仍尽量避开代码块内部)。
        """
        if e <= s:
            return [(s, e)]
        if idx.budget(s, e) <= max_tokens:
            return [(s, e)]
        if not seps:
            return self._hard_cut(idx, s, e, max_tokens)

        cuts = idx.cut_points(seps[0], s, e)
        if not cuts:
            return self._split_to_budget(idx, s, e, max_tokens, seps[1:])

        bounds = [s, *cuts, e]
        pieces = [(bounds[i], bounds[i + 1]) for i in range(len(bounds) - 1)]
        groups: list[tuple[int, int]] = []
        cur_s, cur_e = pieces[0]
        for ps, pe in pieces[1:]:
            if idx.budget(cur_s, pe) <= max_tokens:
                cur_e = pe
            else:
                groups.append((cur_s, cur_e))
                cur_s, cur_e = ps, pe
        groups.append((cur_s, cur_e))

        out: list[tuple[int, int]] = []
        for gs, ge in groups:
            if idx.budget(gs, ge) <= max_tokens:
                out.append((gs, ge))
            else:
                out.extend(self._split_to_budget(idx, gs, ge, max_tokens, seps[1:]))
        return out

    def _hard_cut(self, idx: _DocIndex, s: int, e: int, max_tokens: int) -> list[tuple[int, int]]:
        """字符硬切兜底:二分找"budget 不超上限"的最远切点,保证每步至少前进 1 字符。

        切点若严格落进代码块内部,退到该代码块起点;若窗口整体都在一个超大代码
        块内(原子单元超预算的极端情形),只能切开它——这是文档化的硬切兜底。
        """
        out: list[tuple[int, int]] = []
        cur = s
        while cur < e:
            lo, hi, best = cur + 1, e, cur + 1
            while lo <= hi:
                mid = (lo + hi) // 2
                if idx.budget(cur, mid) <= max_tokens:
                    best, lo = mid, mid + 1
                else:
                    hi = mid - 1
            cut = best
            for rs, re_ in idx.code_regions:
                if rs < cut < re_:
                    if rs > cur:
                        cut = rs
                    break
            out.append((cur, cut))
            cur = cut
        return out

    def _extend_start(
        self, idx: _DocIndex, s: int, floor: int, overlap_budget: int
    ) -> int:
        """子块向前重叠扩展:在 [floor, s) 内尽量前移起点,受 overlap 预算约束,
        且绝不进入代码块内部(保证 child ⊆ parent 与代码块完整性)。"""
        if overlap_budget <= 0:
            return s
        best = s
        for p in range(s - 1, floor - 1, -1):
            if idx.strictly_in_code(p):
                break
            if idx.budget(p, s) > overlap_budget:
                break
            best = p
        return best

    def _make_chunk(
        self,
        idx: _DocIndex,
        text: str,
        doc_id: str,
        source: str,
        kind: ChunkKind,
        s: int,
        e: int,
        parent_id: str | None,
        seq: int,
    ) -> Chunk:
        body = text[s:e]
        return Chunk(
            doc_id=doc_id,
            chunk_id=_make_chunk_id(doc_id, kind, seq, body),
            kind=kind,
            seq=seq,
            text=body,
            heading_path=idx.heading_path_at(s),
            start=s,
            end=e,
            source=source,
            token_count=idx.budget(s, e),
            parent_id=parent_id,
        )


# ---------------------------------------------------------------------------
# small-to-big 检索支持
# ---------------------------------------------------------------------------


def expand_to_parents(
    child_hits: Sequence[ChildHit],
    parents: Mapping[str, Chunk],
) -> list[ParentHit]:
    """子块命中 -> 父块去重展开(small-to-big 的"big"一步)。

    - 按 parent_id 去重:同一父块的多个子块命中合并为一个 ParentHit;
    - ParentHit.score 取子块命中最高分,父块列表按该代表分降序;
    - evidence 保留全部命中子块(降序),供引用溯源 / 命中位置高亮;
    - parent_id 缺失或不在 parents 表里的命中被丢弃(脏数据不静默升级成假父块)。
    """
    grouped: dict[str, list[ChildHit]] = {}
    order: list[str] = []
    for hit in child_hits:
        pid = hit.child.parent_id
        if pid is None or pid not in parents:
            continue
        if pid not in grouped:
            grouped[pid] = []
            order.append(pid)
        grouped[pid].append(hit)
    out = [
        ParentHit(
            parent=parents[pid],
            score=max(h.score for h in ev),
            evidence=sorted(ev, key=lambda h: h.score, reverse=True),
        )
        for pid, ev in ((p, grouped[p]) for p in order)
    ]
    out.sort(key=lambda ph: ph.score, reverse=True)
    return out


# ---------------------------------------------------------------------------
# JSONL 导出(供 Qdrant / ES 摄取)
# ---------------------------------------------------------------------------


def export_jsonl(
    parents: Sequence[Chunk],
    children: Sequence[Chunk],
    out_path: str | os.PathLike[str],
) -> str:
    """父/子块统一导出为 JSONL(每行一个 JSON 对象,``type`` 字段区分 parent/child)。

    单文件 + type 字段比父子两文件对接 Qdrant/ES bulk 摄取更省事
    (父子可共用同一 pipeline,按 type 路由到不同 collection/索引)。
    返回实际写入路径。
    """
    with open(out_path, "w", encoding="utf-8", newline="\n") as f:
        for chunk in [*parents, *children]:
            f.write(json.dumps(chunk.to_dict(), ensure_ascii=False))
            f.write("\n")
    return os.fspath(out_path)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
