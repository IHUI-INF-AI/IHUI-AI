# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""SAG2 词法通道 · 跨语言术语桥（CJK ↔ 拉丁）。

问题
----
纯词法索引按**字面**匹配。中文查询「向量检索」永远命不中英文文档里的
``vector retrieval``，反过来也一样 —— 这在中英混排的工程/合同/研报语料上
是实打实的召回黑洞（同义但不同文字，词法层面零重叠）。

约束（决定实现方式的硬边界）
----------------------------
SAG2 的立身之本是「建库零模型、零 embedding」，所以**不能**用翻译模型或
多语言向量来解决跨语言。词法通道只能依赖「已经共现过的对照关系」。因此本模块
只承认三条高精度来源，任一不成立就**明说查不到**，绝不猜：

1. ``dict``  —— 内置术语表 + 外部 JSON（``SAG2_BRIDGE_DICT``，
   格式 ``{"中文": ["english", ...]}``）；
2. ``paren`` —— 语料自举：抓正文里的括号对照写法
   「向量检索（vector retrieval）」「RAG（检索增强生成）」；
3. ``alias`` —— 词典里的同义串（``vector search`` ↔ ``vector retrieval``）。

刻意**不做**的两件事（做了就是骗人）：
* 不按「同段落共现」猜桥 —— 中文段落里同段出现 30 个英文词，共现不等于同义，
  会把「数据库」桥到 "the" 上；
* 不处理「无任何对照关系的纯跨语言」（中文问、英文文档、两文都无对照）。
  那需要 embedding 或翻译，属于 RAG 向量腿的职责；本通道如实返回无桥。

键的粒度（踩过的坑，写在这里避免重犯）
------------------------------------
索引层 ``casefold_tokens`` 把中文切成「单字 + bigram」，所以**查询词元**
是 ``["近似","似最","最近","近邻"]`` 而不是整词「近似最近邻」；而词典键、
括号对照都是**整短语**。两侧粒度不一致时，直接拿词元查表永远查不到。
因此本模块统一走 ``candidate_keys()``：从原始查询串展开出「所有可能的术语
片段」（CJK 连续段的所有子串、拉丁连续词的 1~4 元组），再逐个查表。
语料侧同理：括号前的中文串注册它的**全部后缀**，这样「我们做向量检索（…）」
既能被「向量检索」命中，也能被「检索」命中。

打分
----
桥接词作为**补位候选**参与召回，不替原查询词：原词排序恒不变，桥接词按来源
可信度降权（``dict`` 0.9 / ``paren`` 0.8 / ``alias`` 0.6），被多个来源证实
则累加（上限 1.0）。
"""

from __future__ import annotations

import json
import logging
import os
import re
import unicodedata
from dataclasses import dataclass
from typing import Any, Final

from .index import LexicalIndex

logger = logging.getLogger(__name__)

__all__ = [
    "BRIDGE_ENV",
    "BridgeTerm",
    "TermBridge",
    "candidate_keys",
    "extract_paren_pairs",
    "load_bridge_dict",
]

BRIDGE_ENV: Final = "SAG2_BRIDGE_DICT"

#: 每次查询最多注入多少条桥接词（防止词典大时把原查询淹没）。
MAX_BRIDGE_TERMS: Final = 6
#: CJK 术语片段的最大长度（字）。
MAX_CJK_TERM: Final = 12
#: 拉丁术语片段的最大词数（approximate nearest neighbor = 3）。
MAX_LATIN_WORDS: Final = 4

_CJK_CLASS: Final = r"\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff"
_CJK_BLOCK = re.compile(rf"[{_CJK_CLASS}]+")
_LATIN_BLOCK = re.compile(r"[A-Za-z][A-Za-z0-9'’\- ]{0,90}")
_LATIN_WORD = re.compile(r"[A-Za-z][A-Za-z0-9'’\-]*")

# 括号对照：允许括号内有多段（"retrieval augmented generation (RAG)" 这类），
# 也允许 CJK 侧前面还粘着别的汉字（后续按后缀展开覆盖）。
_PAREN_CJK_FIRST = re.compile(
    rf"([{_CJK_CLASS}]{{2,{MAX_CJK_TERM}}})\s*[（(]\s*([A-Za-z][^）)\n]{{1,60}}?)\s*[）)]"
)
_PAREN_LATIN_FIRST = re.compile(
    rf"([A-Za-z][A-Za-z0-9'’\- ]{{1,60}}?)\s*[（(]\s*([{_CJK_CLASS}]{{2,{MAX_CJK_TERM}}})\s*[）)]"
)

#: 内置术语表：以「中文 → 拉丁别名列表」为唯一真相，双向由 ``_build_from_dict`` 展开。
#: 选取标准：**在真实语料里高频、且两种写法确实指同一件事**。
DEFAULT_TERMS: Final[dict[str, tuple[str, ...]]] = {
    # -- 检索 / RAG ------------------------------------------------------
    "向量检索": ("vector retrieval", "vector search", "semantic search"),
    "语义检索": ("semantic search", "vector retrieval"),
    "关键词检索": ("keyword search", "lexical search", "full-text search"),
    "全文检索": ("full-text search", "full text search", "fts"),
    "混合检索": ("hybrid search", "hybrid retrieval"),
    "多跳检索": ("multi-hop retrieval", "multi-hop"),
    "检索增强生成": ("retrieval augmented generation", "rag"),
    "倒排索引": ("inverted index", "inverted list"),
    "重排序": ("rerank", "re-ranking", "reranking"),
    "倒数排名融合": ("reciprocal rank fusion", "rrf"),
    "嵌入": ("embedding", "embeddings"),
    "向量数据库": ("vector database", "vectordb"),
    "近似最近邻": ("approximate nearest neighbor", "ann", "hnsw"),
    "分块": ("chunking", "chunk"),
    "引用": ("citation", "citations"),
    "召回率": ("recall",),
    "精确率": ("precision",),
    "准确率": ("accuracy",),
    "评测": ("benchmark", "evaluation"),
    "语料库": ("corpus",),
    # -- AI / 模型 -------------------------------------------------------
    "大语言模型": ("large language model", "llm"),
    "大模型": ("large language model", "llm"),
    "提示词": ("prompt", "prompts"),
    "微调": ("fine-tuning", "finetune"),
    "推理": ("inference",),
    "上下文": ("context", "context window"),
    "词元": ("token", "tokens"),
    "分词": ("tokenizer", "tokenization"),
    "智能体": ("agent", "agents"),
    "工具调用": ("tool calling", "function calling"),
    "幻觉": ("hallucination",),
    "知识图谱": ("knowledge graph",),
    "多模态": ("multimodal",),
    "量化": ("quantization", "quantized"),
    "蒸馏": ("distillation",),
    "注意力": ("attention",),
    "对话": ("chat", "conversation"),
    "会话": ("session", "conversation"),
    # -- 工程 / 架构 -----------------------------------------------------
    "微服务": ("microservice", "microservices"),
    "单体": ("monolith", "monolithic"),
    "网关": ("gateway",),
    "中间件": ("middleware",),
    "缓存": ("cache", "caching"),
    "限流": ("rate limit", "rate limiting"),
    "熔断": ("circuit breaker",),
    "降级": ("degrade", "degradation", "fallback"),
    "幂等": ("idempotent", "idempotency"),
    "并发": ("concurrency", "concurrent"),
    "吞吐": ("throughput",),
    "延迟": ("latency",),
    "超时": ("timeout",),
    "重试": ("retry", "retries"),
    "接口": ("api", "interface"),
    "端点": ("endpoint",),
    "部署": ("deploy", "deployment"),
    "容器": ("container", "docker"),
    "编排": ("orchestration", "kubernetes", "k8s"),
    "监控": ("monitoring", "observability"),
    "日志": ("log", "logs", "logging"),
    "指标": ("metric", "metrics"),
    "追踪": ("trace", "tracing"),
    "告警": ("alert", "alarm", "alerting"),
    "备份": ("backup",),
    "恢复": ("restore", "recovery"),
    "迁移": ("migration", "migrate"),
    "灰度": ("canary", "gray release"),
    "回滚": ("rollback",),
    "压测": ("stress test", "load test"),
    "单元测试": ("unit test", "unittest"),
    "集成测试": ("integration test",),
    "端到端": ("end to end", "e2e"),
    "类型检查": ("type check", "typecheck"),
    "静态检查": ("lint", "linter", "eslint", "ruff"),
    "代码审查": ("code review",),
    "技术债": ("technical debt", "tech debt"),
    # -- 数据 / 数据库 ---------------------------------------------------
    "数据库": ("database", "db"),
    "关系型数据库": ("relational database", "rdbms"),
    "事务": ("transaction",),
    "索引": ("index", "indexes", "indices"),
    "主键": ("primary key",),
    "外键": ("foreign key",),
    "分区": ("partition", "partitioning"),
    "分片": ("shard", "sharding"),
    "复制": ("replication", "replica"),
    "主从": ("primary replica", "master slave"),
    "连接池": ("connection pool",),
    "死锁": ("deadlock",),
    "慢查询": ("slow query",),
    "执行计划": ("query plan", "explain plan"),
    "数据仓库": ("data warehouse",),
    "数据湖": ("data lake",),
    "数据管道": ("data pipeline", "etl"),
    "埋点": ("event tracking",),
    # -- 安全 / 合规 -----------------------------------------------------
    "鉴权": ("authentication", "authn"),
    "授权": ("authorization", "authz"),
    "权限": ("permission", "permissions"),
    "多租户": ("multi-tenant", "multitenant"),
    "租户": ("tenant",),
    "加密": ("encryption", "encrypt"),
    "脱敏": ("masking", "redaction", "anonymize"),
    "审计": ("audit", "audit log"),
    "合规": ("compliance",),
    "个人信息": ("personal information", "pii"),
    "数据出境": ("data transfer", "cross-border data"),
    "漏洞": ("vulnerability", "cve"),
    "注入攻击": ("injection", "sql injection"),
    "越权": ("privilege escalation", "broken access control"),
    # -- 业务 / 组织 -----------------------------------------------------
    "董事会": ("board of directors", "board"),
    "股东会": ("shareholders meeting", "general meeting"),
    "决议": ("resolution",),
    "合同": ("contract",),
    "甲方": ("party a",),
    "乙方": ("party b",),
    "违约": ("breach", "default"),
    "赔偿": ("compensation", "damages"),
    "预算": ("budget",),
    "决算": ("final accounts", "settlement"),
    "营收": ("revenue",),
    "毛利": ("gross profit", "gross margin"),
    "净利": ("net profit",),
    "现金流": ("cash flow",),
    "应收账款": ("accounts receivable", "receivable"),
    "应付账款": ("accounts payable", "payable"),
    "库存": ("inventory",),
    "报销": ("reimbursement",),
    "审批": ("approval", "approve"),
    "绩效": ("performance review", "kpi", "okr"),
    "招聘": ("recruiting", "hiring"),
    "入职": ("onboarding",),
    "离职": ("resignation", "offboarding"),
    "薪酬": ("compensation", "salary", "payroll"),
    "培训": ("training",),
    "供应商": ("vendor", "supplier"),
    "采购": ("procurement", "purchasing"),
    "交付": ("delivery", "deliverable"),
    "里程碑": ("milestone",),
    "验收": ("acceptance", "uat"),
    "需求": ("requirement", "requirements"),
    "缺陷": ("defect", "bug"),
    "迭代": ("sprint", "iteration"),
    "复盘": ("retrospective", "postmortem"),
}

#: 来源可信度权重（同一对词被多个来源证实时叠加取和，最后归一化截断）。
_SOURCE_WEIGHT: Final[dict[str, float]] = {
    "dict": 0.9,
    "paren": 0.8,
    "alias": 0.6,
}


@dataclass(frozen=True)
class BridgeTerm:
    """一条跨语言桥接词。"""

    term: str
    source_term: str
    kind: str
    score: float

    def to_dict(self) -> dict[str, Any]:
        return {
            "term": self.term,
            "source_term": self.source_term,
            "kind": self.kind,
            "score": round(self.score, 6),
        }


def _norm(text: str) -> str:
    """桥接**键**归一化：NFKD + casefold + 压缩空白，**不切词**。

    为什么不用 ``casefold_tokens``：它会把中文切成「单字 + bigram」的空格串
    （「向量检索」→「向 量 检 索 向量 量检 检索」），当键能对上但**给人看**
    完全不可读，桥接的可解释性直接归零。桥接键只需要「同一个写法的不同大小写
    /全角半角」能对上，不需要切词；真正召回时由 ``match_query`` 拆 token。
    """
    folded = unicodedata.normalize("NFKD", text).casefold()
    return " ".join(folded.split())


def _has_cjk(text: str) -> bool:
    return bool(_CJK_BLOCK.search(text))


def candidate_keys(query: str, *, max_cjk: int = MAX_CJK_TERM) -> list[str]:
    """把原始查询展开成「可能代表一个术语」的全部片段键（已归一化、去重保序）。

    * CJK 连续段 → 所有长度 2..``max_cjk`` 的子串
      （「近似最近邻」→ 近邻 / 最近 / 似最 / 近似 / 最近邻 / … / 近似最近邻）；
    * 拉丁连续段 → 1..``MAX_LATIN_WORDS`` 个连续词的组合
      （``approximate nearest neighbor`` → 3 词整体也在里面）。

    为什么要这么宽：查询词元是 bigram、术语键是整短语，只取一种粒度必然漏。
    展开后每个片段独立查表，查不到就是查不到（没有模糊匹配），所以不会变脏。
    """
    keys: list[str] = []
    seen: set[str] = set()

    def add(raw: str) -> None:
        key = _norm(raw)
        if key and key not in seen:
            seen.add(key)
            keys.append(key)

    for match in _CJK_BLOCK.finditer(query):
        run = match.group()
        for start in range(len(run)):
            for end in range(start + 2, min(start + max_cjk, len(run)) + 1):
                add(run[start:end])
    for match in _LATIN_BLOCK.finditer(query):
        words = _LATIN_WORD.findall(match.group())
        for size in range(1, min(MAX_LATIN_WORDS, len(words)) + 1):
            for start in range(len(words) - size + 1):
                add(" ".join(words[start : start + size]))
    return keys


def extract_paren_pairs(text: str) -> list[tuple[str, str]]:
    """抽取正文里的括号对照对（原始中文字串, 拉丁串），未归一化。

    CJK 侧可能带着前导动词（「我们做向量检索（…）」→「我们做向量检索」），
    这是有意的：注册时会对它展开**全部后缀**，因此「向量检索」仍能命中。
    """
    pairs: list[tuple[str, str]] = []
    for match in _PAREN_CJK_FIRST.finditer(text):
        cjk, lat = match.group(1).strip(), match.group(2).strip()
        if lat and not lat.isdigit():
            pairs.append((cjk, lat.rstrip(" .,;:，")))
    for match in _PAREN_LATIN_FIRST.finditer(text):
        lat, cjk = match.group(1).strip(), match.group(2).strip()
        if lat and not lat.isdigit():
            pairs.append((cjk, lat.rstrip(" .,;:，")))
    return pairs


def _latin_variants(raw: str) -> list[str]:
    """拉丁串的多种可查形态：整体 + 按逗号/斜杠切分的各段。

    「retrieval augmented generation, RAG」两侧都该是键 —— 整体没人会整句查，
    但用户很可能只查 ``RAG``。
    """
    variants = [raw]
    for piece in re.split(r"[,;/|]", raw):
        cleaned = piece.strip()
        if len(cleaned) >= 2:
            variants.append(cleaned)
    return variants


def _cjk_suffixes(raw: str, *, min_len: int = 2, max_len: int = MAX_CJK_TERM) -> list[str]:
    """中文串的全部后缀（2..max_len 字）。

    只取后缀而不是任意子串：括号前的短语是「…做向量检索（…）」这种形态，
    真正对应的术语总在**末尾**，取后缀既覆盖又不会把「我们做」这种前缀噪音
    注册成键。
    """
    out: list[str] = []
    for start in range(len(raw)):
        piece = raw[start:]
        if min_len <= len(piece) <= max_len:
            out.append(piece)
    return out


def load_bridge_dict(path: str | None = None) -> dict[str, tuple[str, ...]]:
    """合并内置词表与外部 JSON（外部优先，追加到同一中文键下）。

    外部文件格式：``{"向量检索": ["vector retrieval"], ...}``。
    文件不存在/解析失败 ⇒ 只用内置表并记一条 warning，绝不让启动失败。
    """
    merged: dict[str, list[str]] = {
        key: list(values) for key, values in DEFAULT_TERMS.items()
    }
    target = path or os.environ.get(BRIDGE_ENV, "")
    if not target:
        return {k: tuple(v) for k, v in merged.items()}
    try:
        with open(target, encoding="utf-8") as handle:
            data = json.load(handle)
    except FileNotFoundError:
        logger.warning("[sag2-bridge] 词典文件不存在，仅用内置表: %s", target)
        return {k: tuple(v) for k, v in merged.items()}
    except (OSError, json.JSONDecodeError) as exc:
        logger.warning("[sag2-bridge] 词典文件不可用(%s)，仅用内置表", exc)
        return {k: tuple(v) for k, v in merged.items()}
    if not isinstance(data, dict):
        logger.warning("[sag2-bridge] 词典文件顶层不是对象，忽略")
        return {k: tuple(v) for k, v in merged.items()}
    for key, value in data.items():
        if not isinstance(key, str):
            continue
        items: list[str] = []
        if isinstance(value, str):
            items = [value]
        elif isinstance(value, list):
            items = [str(v) for v in value if isinstance(v, str)]
        if not items:
            continue
        bucket = merged.setdefault(key, [])
        for item in items:
            if item not in bucket:
                bucket.append(item)
    return {k: tuple(v) for k, v in merged.items()}


class TermBridge:
    """跨语言桥：查表 + 语料括号对照，零模型。

    构建是**惰性 + 版本缓存**的：第一次查询时扫一遍语料抽括号对照（正则，
    20k 块量级在数百毫秒内），此后索引 ``version`` 不变就直接复用；
    版本一变（新增/删除文档）自动重建。
    """

    def __init__(
        self,
        terms: dict[str, tuple[str, ...]] | None = None,
        *,
        max_terms: int = MAX_BRIDGE_TERMS,
        use_corpus: bool = True,
    ) -> None:
        self._max_terms = max_terms
        self._use_corpus = use_corpus
        self._dict = terms if terms is not None else load_bridge_dict()
        # 归一化键 → {目标词元: 来源集合}
        self._forward: dict[str, dict[str, set[str]]] = {}
        self._build_from_dict()
        self._cached_version: int | None = None
        self._cached_index_id: int | None = None
        self._corpus_pairs: dict[str, dict[str, set[str]]] = {}

    # -- 词典 ---------------------------------------------------------------

    def _link(self, source: str, target: str, kind: str) -> None:
        src = _norm(source)
        dst = _norm(target)
        if not src or not dst or src == dst:
            return
        self._forward.setdefault(src, {}).setdefault(dst, set()).add(kind)

    def _build_from_dict(self) -> None:
        for cjk, aliases in self._dict.items():
            for alias in aliases:
                # 中文 → 拉丁；拉丁 → 中文，双向都建。
                self._link(cjk, alias, "dict")
                self._link(alias, cjk, "dict")
            # 同义词之间也建 alias 边（"vector search" ↔ "vector retrieval"），
            # 跨语言查询落到任意一个写法都能扩散到其余写法。
            normalized = [_norm(a) for a in aliases]
            for left in normalized:
                for right in normalized:
                    if left and right and left != right:
                        self._link(left, right, "alias")

    # -- 语料自举 -----------------------------------------------------------

    def _corpus_texts(self, index: LexicalIndex) -> list[str]:
        """取全部块的正文；索引不支持枚举时返回空（不是错误）。"""
        paths = getattr(index, "paths", None)
        snapshot = getattr(index, "snapshot_chunks", None)
        if not callable(paths) or not callable(snapshot):
            return []
        texts: list[str] = []
        for path in paths():
            texts.extend(chunk.content for chunk in snapshot(path))
        return texts

    def _corpus_pairs_for(self, index: LexicalIndex) -> dict[str, dict[str, set[str]]]:
        """按索引版本缓存「括号对照」图。"""
        if not self._use_corpus:
            return {}
        same_index = self._cached_index_id == id(index)
        if same_index and self._cached_version == index.version:
            return self._corpus_pairs
        pairs: dict[str, dict[str, set[str]]] = {}

        def link(src: str, dst: str) -> None:
            left, right = _norm(src), _norm(dst)
            if not left or not right or left == right:
                return
            pairs.setdefault(left, {}).setdefault(right, set()).add("paren")
            pairs.setdefault(right, {}).setdefault(left, set()).add("paren")

        for text in self._corpus_texts(index):
            if "（" not in text and "(" not in text:
                continue
            for cjk, lat in extract_paren_pairs(text):
                for suffix in _cjk_suffixes(cjk):
                    for variant in _latin_variants(lat):
                        link(suffix, variant)
        self._cached_index_id = id(index)
        self._cached_version = index.version
        self._corpus_pairs = pairs
        return pairs

    # -- 对外 ---------------------------------------------------------------

    def expand(
        self,
        query: str,
        index: LexicalIndex,
        *,
        limit: int | None = None,
    ) -> list[BridgeTerm]:
        """给一句自然语言查询生成跨语言桥接词，按可信度降序。

        ``query`` 是**原始查询串**（不是切好的词元）——因为术语键是整短语，
        必须由 ``candidate_keys`` 展开后才能对上。
        """
        corpus = self._corpus_pairs_for(index)
        cap = limit if limit is not None else self._max_terms
        found: dict[str, BridgeTerm] = {}
        for key in candidate_keys(query):
            sources: dict[str, set[str]] = {}
            for target, kinds in self._forward.get(key, {}).items():
                sources.setdefault(target, set()).update(kinds)
            for target, kinds in corpus.get(key, {}).items():
                sources.setdefault(target, set()).update(kinds)
            for target, kinds in sources.items():
                if target == key:
                    continue
                score = sum(_SOURCE_WEIGHT.get(kind, 0.5) for kind in kinds)
                existing = found.get(target)
                if existing is None or score > existing.score:
                    found[target] = BridgeTerm(
                        term=target,
                        source_term=key,
                        kind="+".join(sorted(kinds)),
                        score=min(score, 1.0),
                    )
        # 长键优先：同分时「近似最近邻」比「近邻」更可能是用户真正的意思。
        ranked = sorted(
            found.values(), key=lambda b: (-b.score, -len(b.source_term), b.term)
        )
        return ranked[:cap]

    def status(self, index: LexicalIndex | None = None) -> dict[str, Any]:
        """桥接自证：词表规模 + 语料对照规模（供 status 端点直读）。"""
        data: dict[str, Any] = {
            "dict_terms": len(self._dict),
            "dict_edges": sum(len(v) for v in self._forward.values()),
            "corpus_enabled": self._use_corpus,
        }
        if index is not None:
            corpus = self._corpus_pairs_for(index)
            data["corpus_edges"] = sum(len(v) for v in corpus.values())
            data["corpus_pairs"] = len(corpus)
        return data
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
