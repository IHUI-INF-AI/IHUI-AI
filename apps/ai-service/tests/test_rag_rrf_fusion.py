# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""V3 #52「RAG 真重排」验收测试:RRF 融合真改变名次 + 降级自证。

对应票面三条判据:
1. 融合真实生效 —— 融合后名次必须与任一路的名次**不同**(恒等变换即判失败)。
2. 真实语料 —— 夹具正文逐字取自仓内已入库的
   `app/skills/content_engine/articles/archive/{0713,0714,0716}.md`,由
   `_load_real_corpus()` 现读并逐条回验 verbatim,不是本文件自造的文本。
3. 降级诚实 —— cross-encoder / LLM 二段没真跑成时,返回体必须自带
   rerank_depth / rerank_executed / rerank_reason / recall 说明走了哪条路;
   任何一路被跳过或报错都要留计数与原因(禁止静默变短)。

⚠️ 隔离口径(§5 测试隔离铁律):
- 本机无 PG/Redis 在跑。向量库与内存库**全部** monkeypatch 成假实现,用例体内
  不调用任何 add_entry / add / set 写路径 ⇒ 对 PostgreSQL(8810)/Redis(8811)
  零副作用。每条用例的 patch 都在断言之前完成,体内无先于 patch 的真实写入。
- 被替的只有"检索后端给出的名次与相似度"这一层(本机没有可跑的 embedding
  模型)。向量路的排序代理取「段落长度**降序**、同长度按正文升序」—— 一个与关键词
  命中**无关**的确定性函数;选它的唯一理由是两路的秩互相冲突,否则"融合改变了
  名次"就退化成自证。关键词路的打分与排序由**生产代码** `_keyword_score` /
  `_keyword_fallback` 真算,未做任何替代。
- 反例证明一律调 `RAGService` 的真实方法(retrieve_only / query / _retrieve /
  _rerank);测试里不复制第二份 RRF 公式(§22c)。
"""

from __future__ import annotations

import hashlib
import inspect
import json
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock

import pytest

from app.services import rag as rag_module
from app.services.rag import (
    DEFAULT_RRF_K,
    DEPTH_LLM,
    DEPTH_NONE,
    DEPTH_SINGLE,
    DEPTH_RRF,
    RRF_K_ENV,
    RAGResult,
    RAGService,
    RAGSource,
    rag_service,
    resolve_rrf_k,
)
from app.services.reranker import RERANK_LLM_ENABLED_ENV

# =============================================================================
# 真实语料:仓内已入库的文章段落(不是自造 fixture)
# =============================================================================

_AI_SERVICE_ROOT = Path(__file__).resolve().parent.parent

#: 夹具源(受版本控制、文件名纯 ASCII,免得受控制台码页影响)。
CORPUS_SOURCES: tuple[str, ...] = (
    "app/skills/content_engine/articles/archive/0713.md",
    "app/skills/content_engine/articles/archive/0714.md",
    "app/skills/content_engine/articles/archive/0716.md",
)

_MIN_PARA_CHARS = 80
#: 语料上限(取三个真实文件的前 12 段)。两条设计线一起成立才有对照:
#: ① 鸽笼原理保证重叠 —— |V|=recall_k=10、|K|>=_MIN_KEYWORD_HITS=4、|U|=12
#:    ⇒ |V∩K| >= 10+4-12 = 2,融合永远有"两路同中"的样本可审。
#: ② 两路的秩必须**冲突**:向量代理取「长度降序」,而生产关键词打分
#:    hits/sqrt(len) 偏向短段 ⇒ 融合结果既不等于任一路、也不等于按 score
#:    重排 —— 三个"不等于"才是本票要的对照。
#:    (先按长度升序试过:融合 top5 恰好与关键词路同名,判据当场失去意义,
#:     故换降序。这段试错留在这里,免得下一个人又把它"改回看起来更自然"的升序。)
_CORPUS_CAP = 12
_MIN_KEYWORD_HITS = 4
_TOP_K = 5
_RECALL_K = max(_TOP_K * 2, 10)

#: 查询词取自语料里真实出现的词组,保证关键词路由生产代码算得出非零分。
QUERY = "Agent 工具"


def _extract_prose(text: str) -> list[str]:
    """从 Markdown 取正文段落:按空行切,剥结构性行,限长,保持文件原序。

    刻意不做任何"为让断言成立"的挑选 —— 只按长度与"是否 Markdown 结构行"筛。
    """
    out: list[str] = []
    for block in text.split("\n\n"):
        para = block.strip()
        if len(para) < _MIN_PARA_CHARS:
            continue
        if para.startswith(("#", "!", "-", "|", ">", "*", "`", "<", "  ")) or para in out:
            continue
        out.append(para)
    return out


class CorpusDoc:
    """一条真实知识块:正文 + 归属会话(源文件)。"""

    __slots__ = ("content", "session_id", "source", "digest")

    def __init__(self, content: str, session_id: str, source: str) -> None:
        self.content = content
        self.session_id = session_id
        self.source = source
        self.digest = hashlib.sha256(content.encode("utf-8")).hexdigest()[:12]


def _load_real_corpus() -> list[CorpusDoc]:
    """现读仓内真实段落;每条必须逐字存在于其源文件,否则判夹具失效。

    这里宁可当场 fail 也不 skip:按 §22c 的教训,"看不见" 不等于 "通过",
    一个静默跳过的验收测试比没有测试更坏。
    """
    docs: list[CorpusDoc] = []
    for rel in CORPUS_SOURCES:
        path = _AI_SERVICE_ROOT / Path(*rel.split("/"))
        assert path.is_file(), f"真实语料源缺失(夹具失效): {path}"
        raw = path.read_text(encoding="utf-8")
        session_id = "sess-" + hashlib.sha1(rel.encode("utf-8")).hexdigest()[:8]
        for para in _extract_prose(raw):
            assert para in raw, f"语料段落不再逐字存在于源文件,fixture 被改动: {rel}"
            docs.append(CorpusDoc(para, session_id, rel))
    docs = docs[:_CORPUS_CAP]
    assert len(docs) >= _CORPUS_CAP, f"真实语料不足 {len(docs)} < {_CORPUS_CAP}"
    # 融合按 content 前 200 字符去重:两条撞键会让"秩"的比较失去意义
    keys = {d.content.strip()[:200] for d in docs}
    assert len(keys) == len(docs), "语料存在前 200 字符同文,去重键撞车,夹具失效"
    return docs


CORPUS: list[CorpusDoc] = _load_real_corpus()

#: 会话 → 该会话下的真实消息(喂给生产 `_keyword_fallback`,打分由它自己算)
MESSAGES_BY_SESSION: dict[str, list[dict[str, Any]]] = {}
for _d in CORPUS:
    MESSAGES_BY_SESSION.setdefault(_d.session_id, []).append(
        {
            "role": "assistant",
            "content": _d.content,
            "timestamp": "2026-09-01T00:00:00Z",
        }
    )

BY_CONTENT: dict[str, CorpusDoc] = {d.content: d for d in CORPUS}
ALL_SESSIONS: list[str] = sorted(MESSAGES_BY_SESSION)


# =============================================================================
# 假检索后端(只替"向量库给的名次与相似度",不替任何判据)
# =============================================================================


def _vector_rank_key(doc: CorpusDoc) -> tuple[int, str]:
    """向量路排序代理:与关键词命中无关的确定性函数(长度**降序**、同长按正文)。

    本机没有可跑的 embedding 模型,这一层的秩必须由测试给出。选"长度降序"的
    唯一理由是它与生产关键词打分(hits/sqrt(len),偏向短段)反向 —— 两路的秩
    冲突,融合才有可审的产物。升序时两路 top5 会同名,判据退化成自证(实测过,
    见上方"语料上限"注释的试错记录)。
    """
    return (-len(doc.content), doc.content)


def _digests(sources: list[RAGSource]) -> list[str]:
    return [BY_CONTENT[s.content].digest for s in sources]


def _install_backends(
    monkeypatch: pytest.MonkeyPatch,
    *,
    vector_error: Exception | None = None,
    vector_empty: bool = False,
    failing_sessions: tuple[str, ...] = (),
) -> dict[str, Any]:
    """把两路检索换成假实现;返回探针记录(调用次数、拿到的参数)。"""
    probe: dict[str, Any] = {"vector_calls": 0, "kw_sessions": [], "kw_limit_seen": None}

    async def fake_embed(text: str, model: str | None = None) -> list[float]:
        if vector_error is not None:
            raise vector_error
        return [0.0, 0.0, 0.0]

    async def fake_search(
        query_embedding: list[float],
        top_k: int = 10,
        threshold: float = 0.7,
        user_id: str | None = None,
    ) -> list[tuple[str, dict[str, Any], float]]:
        probe["vector_calls"] += 1
        probe["vector_top_k"] = top_k
        if vector_empty:
            return []
        ordered = sorted(CORPUS, key=_vector_rank_key)
        return [
            (
                "e" + doc.digest,
                {
                    "session_id": doc.session_id,
                    "role": "assistant",
                    "content": doc.content,
                    "timestamp": "2026-09-01T00:00:00Z",
                },
                0.95 - 0.01 * i,  # 相似度严格递减,与向量名次同序(忠实模拟"上游已排好")
            )
            for i, doc in enumerate(ordered[:top_k])
        ]

    async def fake_list_sessions(user_id: str | None = None) -> list[str]:
        return list(ALL_SESSIONS)

    async def fake_get(
        session_id: str, limit: int = 100, *, user_id: str | None = None
    ) -> list[dict[str, Any]]:
        probe["kw_sessions"].append(session_id)
        probe["kw_limit_seen"] = limit
        if session_id in failing_sessions:
            raise RuntimeError(f"模拟会话读取失败 {session_id}")
        return [dict(m) for m in MESSAGES_BY_SESSION.get(session_id, [])]

    monkeypatch.setattr(rag_module.vector_memory, "embed", fake_embed, raising=False)
    monkeypatch.setattr(rag_module.vector_memory, "search", fake_search, raising=False)
    monkeypatch.setattr(
        rag_module.memory_store, "list_sessions", fake_list_sessions, raising=False
    )
    monkeypatch.setattr(rag_module.memory_store, "get", fake_get, raising=False)
    # 生成阶段不许打真网络(本文件只验收检索/重排)
    monkeypatch.setattr(
        rag_module.llm_gateway,
        "complete",
        AsyncMock(
            return_value={"content": "stub answer", "model": "test-model", "stub": True}
        ),
        raising=False,
    )
    return probe


# =============================================================================
# 环境隔离:不继承机器上的同名 env
# =============================================================================


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(RRF_K_ENV, raising=False)
    monkeypatch.delenv(RERANK_LLM_ENABLED_ENV, raising=False)


class BackendTripwire(BaseException):
    """必须是 BaseException:生产的两路召回都带 `except Exception` 兜底。

    实测教训 —— 本文件的引线第一版用 `AssertionError`,结果被
    `_keyword_fallback` 的 `except Exception` 咽掉,变成"记一条 error 然后返回
    空列表",未打桩的用例照样绿。判据失效的表现永远是安静,所以引线要选成
    生产兜底结构上抓不住的那一类。
    """


@pytest.fixture(autouse=True)
def _no_real_backend(monkeypatch: pytest.MonkeyPatch) -> None:
    """兜底闸:任何用例忘了装假后端就当场炸,而不是静默打到真实 Redis/向量库。

    §5 的铁律写着"autouse fixture 只兜住默认安全",但本文件的默认不安全:
    `_retrieve` 直连 `memory_store`(settings.redis_url 已配 → 真去连 8811)。
    实测本文件初版就漏了一处,真把 Redis 连接超时打满日志 —— 有 Redis 在跑的
    机器上那会读走生产会话数据。所以这里把两路都换成"一调用即炸"的引线;
    `_install_backends()` 在其后重新 setattr 覆盖,装了假后端的用例不受影响。
    """

    def _trip(*a: Any, **k: Any) -> Any:
        raise BackendTripwire(
            "测试未安装假检索后端 ⇒ 会打到真实 Redis/向量库(§5 测试隔离铁律)"
        )

    monkeypatch.setattr(rag_module.vector_memory, "embed", _trip, raising=False)
    monkeypatch.setattr(rag_module.vector_memory, "search", _trip, raising=False)
    monkeypatch.setattr(rag_module.vector_memory, "add_entry", _trip, raising=False)
    monkeypatch.setattr(rag_module.memory_store, "list_sessions", _trip, raising=False)
    monkeypatch.setattr(rag_module.memory_store, "get", _trip, raising=False)
    monkeypatch.setattr(rag_module.memory_store, "add", _trip, raising=False)
    monkeypatch.setattr(rag_module.llm_gateway, "complete", _trip, raising=False)
    monkeypatch.setattr(
        rag_module.reranker.llm_gateway, "structured_completion", _trip, raising=False
    )


# =============================================================================
# 判据 0:夹具自身有效性 —— 两路必须真给出不同的秩,否则后面的断言全是空转
# =============================================================================


class TestFixtureIsValid:
    async def test_two_paths_rank_differently(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        _install_backends(monkeypatch)
        vec = await rag_service._vector_retrieve(QUERY, top_k=_RECALL_K)
        kw = await rag_service._keyword_fallback(QUERY, top_k=_RECALL_K)
        assert len(kw) >= _MIN_KEYWORD_HITS, (
            f"关键词路只算出 {len(kw)} 条命中(<{_MIN_KEYWORD_HITS}),"
            "两路重叠无法由鸽笼原理保证 —— 需重挑语料或查询"
        )
        assert _digests(vec) != _digests(kw), (
            "两路秩完全相同 ⇒ 融合是恒等变换,本文件所有差异化断言失去意义"
        )

    def test_corpus_is_real_repo_text(self) -> None:
        """阳性对照:语料确实来自仓内已入库文件,不是本文件里的字符串常量。"""
        joined = "".join(
            (_AI_SERVICE_ROOT / Path(*rel.split("/"))).read_text(encoding="utf-8")
            for rel in CORPUS_SOURCES
        )
        assert len(CORPUS) >= _CORPUS_CAP
        for doc in CORPUS:
            assert doc.content in joined
        # 反向:测试文件正文里不得内嵌这些段落 —— 确保是"现读"而非"抄进夹具"
        here = Path(__file__).resolve().read_text(encoding="utf-8")
        assert CORPUS[0].content not in here, "语料被复制进测试文件,不再算现读"


# =============================================================================
# 判据 1:RRF 融合真实生效(不是恒等变换)
# =============================================================================


class TestRrfFusionIsReal:
    async def test_fused_order_differs_from_every_single_path(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        _install_backends(monkeypatch)
        vec = await rag_service._vector_retrieve(QUERY, top_k=_RECALL_K)
        kw = await rag_service._keyword_fallback(QUERY, top_k=_RECALL_K)
        fused = await rag_service.retrieve_only(QUERY, top_k=_TOP_K)

        assert fused and len(fused) <= _TOP_K
        fused_ids = _digests(fused)
        assert fused_ids != _digests(vec)[:_TOP_K], (
            f"融合后与向量路同名 ⇒ 假融合。fused={fused_ids} vec={_digests(vec)[:_TOP_K]}"
        )
        assert fused_ids != _digests(kw)[:_TOP_K], (
            f"融合后与关键词路同名 ⇒ 假融合。fused={fused_ids} kw={_digests(kw)[:_TOP_K]}"
        )

    async def test_two_path_docs_outrank_every_single_path_doc(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """RRF 的实质判据:两路都上榜的块,融合分必高于任何只上二路之一的块。

        这是 1/(k+r1)+1/(k+r2) > 1/(k+1) 的直接推论 —— 若实现只是"把两路拼接
        再按原分数排",这条必然不成立。
        """
        _install_backends(monkeypatch)
        fused = await rag_service.retrieve_only(QUERY, top_k=_TOP_K)
        both = [s for s in fused if s.fused_from == "vector+keyword"]
        single = [s for s in fused if s.fused_from in ("vector", "keyword")]
        assert both, "返回结果里没有两路同中的块 ⇒ 重叠不足,对照失效"
        assert single, "返回结果全为两路同中 ⇒ 无单路对照,换语料/查询"
        assert min(s.rrf_score for s in both) > max(s.rrf_score for s in single), (
            f"两路同中者最低分未超过单路最高分: both={[s.rrf_score for s in both]} "
            f"single={[s.rrf_score for s in single]}"
        )
        assert all(s.rrf_score > 0 for s in fused)

    async def test_some_doc_moves_up_and_some_down_vs_vector(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        _install_backends(monkeypatch)
        vec = await rag_service._vector_retrieve(QUERY, top_k=_RECALL_K)
        fused = await rag_service.retrieve_only(QUERY, top_k=_TOP_K)
        vec_rank = {d: i for i, d in enumerate(_digests(vec))}
        fused_rank = {d: i for i, d in enumerate(_digests(fused))}
        common = set(vec_rank) & set(fused_rank)
        up = [d for d in common if fused_rank[d] < vec_rank[d]]
        down = [d for d in common if fused_rank[d] > vec_rank[d]]
        assert up and down, f"融合未双向改变名次 up={up} down={down}(=恒等或整块倒序)"

    async def test_recall_stats_report_mode_and_counts(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        _install_backends(monkeypatch)
        stats: dict[str, Any] = {}
        await rag_service._retrieve(QUERY, top_k=_TOP_K, stats=stats)
        assert stats["mode"] == "rrf-fusion"
        assert stats["rrf_k"] == DEFAULT_RRF_K
        assert stats["recall_k"] == _RECALL_K
        assert stats["returned"] == _TOP_K
        assert stats["fused_total"] >= stats["returned"]
        assert stats["dropped_by_top_k"] == stats["fused_total"] - _TOP_K
        paths = stats["paths"]
        assert set(paths) == {"vector", "keyword"}, "两路都要留痕,不得只记一路"
        for label in ("vector", "keyword"):
            entry = paths[label]
            assert entry["status"] == "ok", entry
            assert entry["count"] > 0
            assert entry["dropped"] == entry["raw_count"] - entry["count"]
        assert paths["keyword"]["sessions_scanned"] == len(ALL_SESSIONS)
        assert paths["keyword"]["sessions_failed"] == 0

    async def test_public_contract_unchanged(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """retrieve_only 签名与返回类型不变:遥测走出参,没把公有契约换掉。"""
        _install_backends(monkeypatch)
        out = await rag_service.retrieve_only(QUERY, top_k=_TOP_K)
        assert isinstance(out, list) and all(isinstance(s, RAGSource) for s in out)
        assert "stats" not in inspect.signature(RAGService.retrieve_only).parameters
        # _retrieve 的 stats 是可选出参,旧调用点(不传)必须照常工作
        assert inspect.signature(RAGService._retrieve).parameters["stats"].default is None


# =============================================================================
# 判据 1b:病根 —— 二段没跑成时不再把融合名次按 score 重排(那才是"假重排")
# =============================================================================


class TestScoreResortIsGone:
    async def test_query_keeps_fused_ranking(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """端到端:`query()` 的最终名次 == 融合名次,而不是 score 降序。

        旧实现在降级分支调 `_rerank`(按 score 降序),把融合结果整块丢掉 ——
        这正是票面病根「`rag._rerank` 只按已有 score 排序」。
        """
        _install_backends(monkeypatch)
        fused = await rag_service.retrieve_only(QUERY, top_k=_TOP_K)
        result = await rag_service.query(QUERY, top_k=_TOP_K)

        assert _digests(result.sources) == _digests(fused), (
            f"二段未跑成却改了名次 ⇒ 降级路径又偷偷按 score 重排。"
            f"query={_digests(result.sources)} fused={_digests(fused)}"
        )
        old_style = RAGService._rerank(list(fused))  # 旧语义(默认不保序)
        assert _digests(result.sources) != _digests(old_style), (
            f"与旧的按 score 重排同名 ⇒ 本判据无牙(融合名次恰好等于分数序)"
            f" both={_digests(old_style)}"
        )

    async def test_preserve_order_is_the_switch(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """同一份输入:preserve_order=True 保名次,默认值退回旧语义。"""
        _install_backends(monkeypatch)
        fused = await rag_service.retrieve_only(QUERY, top_k=_TOP_K)
        kept = RAGService._rerank(list(fused), preserve_order=True)
        resort = RAGService._rerank(list(fused), preserve_order=False)
        assert _digests(kept) == _digests(fused)
        assert [s.score for s in resort] == sorted(
            (s.score for s in resort), reverse=True
        ), "默认档仍须是 score 降序(旧调用方语义未破)"
        assert _digests(kept) != _digests(resort)

    def test_empty_input_short_circuits(self) -> None:
        assert RAGService._rerank([]) == []
        assert RAGService._rerank([], preserve_order=True) == []

    async def test_threshold_still_filters_after_fusion(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """score 阈值语义保留(只剩过滤,不再是排序)。"""
        _install_backends(monkeypatch)
        fused = await rag_service.retrieve_only(QUERY, top_k=_TOP_K)
        cutoff = sorted(s.score for s in fused)[len(fused) // 2]
        kept = RAGService._rerank(fused, score_threshold=cutoff, preserve_order=True)
        assert kept and all(s.score >= cutoff for s in kept)
        # 过滤只删人,不得换序:kept 必须是 fused 的子序列
        it = iter(_digests(fused))
        assert all(d in it for d in _digests(kept)), "阈值过滤把融合名次打乱了"


# =============================================================================
# 判据 1c:RAG_RRF_K 是真旋钮(env → 融合 → 名次),非法值诚实回退
# =============================================================================


class TestRrfKKnob:
    def test_default_and_illegal_fallback(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv(RRF_K_ENV, raising=False)
        assert resolve_rrf_k() == DEFAULT_RRF_K == 60
        monkeypatch.setenv(RRF_K_ENV, "")
        assert resolve_rrf_k() == DEFAULT_RRF_K
        for bad in ("abc", "0", "-5", "1.5", "  "):
            monkeypatch.setenv(RRF_K_ENV, bad)
            assert resolve_rrf_k() == DEFAULT_RRF_K, f"{bad!r} 未被判为非法"
        monkeypatch.setenv(RRF_K_ENV, "7")
        assert resolve_rrf_k() == 7

    async def test_k_changes_fused_ranking(self, monkeypatch: pytest.MonkeyPatch) -> None:
        """改 k 必须量出名次差异,否则 env 只是装饰。"""
        _install_backends(monkeypatch)
        default_order = await rag_service.retrieve_only(QUERY, top_k=_TOP_K)
        monkeypatch.setenv(RRF_K_ENV, "1")
        k1_order = await rag_service.retrieve_only(QUERY, top_k=_TOP_K)
        assert _digests(k1_order) != _digests(default_order), (
            f"改 k 名次不动 ⇒ env 没接到融合调用。k=60 {_digests(default_order)}"
            f" / k=1 {_digests(k1_order)}"
        )
        assert k1_order[0].rrf_score > default_order[0].rrf_score, "k 变小 ⇒ 1/(k+rank) 变大"

    async def test_k_is_reported_in_recall(self, monkeypatch: pytest.MonkeyPatch) -> None:
        _install_backends(monkeypatch)
        monkeypatch.setenv(RRF_K_ENV, "3")
        stats: dict[str, Any] = {}
        await rag_service._retrieve(QUERY, top_k=_TOP_K, stats=stats)
        assert stats["rrf_k"] == 3


# =============================================================================
# 判据 3:降级必须自证(DEPTH_* + reason + recall,禁止静默变短)
# =============================================================================


class TestDegradationIsSelfAttesting:
    async def test_second_stage_off_is_reported_as_such(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        _install_backends(monkeypatch)
        result = await rag_service.query(QUERY, top_k=_TOP_K)
        assert result.rerank_depth == DEPTH_RRF
        assert result.rerank_executed is False
        assert "未启用" in result.rerank_reason
        assert set(result.rerank_engines) == {"cross-encoder", "llm"}
        assert "not-wired" in result.rerank_engines["cross-encoder"]
        assert RERANK_LLM_ENABLED_ENV in result.rerank_engines["llm"]
        # trace 里也要留同一结论,不能只在返回体里
        step = next(t for t in result.trace if t["node"] == "rerank")
        assert step["rerank_depth"] == DEPTH_RRF
        assert step["llm_rerank"] is False and step["rerank_executed"] is False
        assert next(t for t in result.trace if t["node"] == "retrieve")["recall_mode"] == "rrf-fusion"

    async def test_vector_failure_records_error_and_degrades(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        _install_backends(monkeypatch, vector_error=RuntimeError("embed 网关炸了"))
        stats: dict[str, Any] = {}
        out = await rag_service._retrieve(QUERY, top_k=_TOP_K, stats=stats)
        assert out, "向量路炸了必须还能给关键词路结果"
        assert stats["mode"] == "single-source:keyword"
        vec = stats["paths"]["vector"]
        assert vec["status"] == "error" and "embed 网关炸了" in vec["reason"]
        assert vec["count"] == 0 and vec["raw_count"] == 0

        result = await rag_service.query(QUERY, top_k=_TOP_K)
        assert result.rerank_depth == DEPTH_SINGLE, "只有一路有结果却自称融合,是假自证"
        assert result.rerank_executed is False
        # 降级支也要带来源路标注:调用方读 sources[].fused_from 必须能看出
        # "这一轮只有关键词路",而不是空串(向量单路那支由 rrf_fuse 自带 label)
        assert result.sources and all(
            s.fused_from == "keyword" for s in result.sources
        ), [s.fused_from for s in result.sources]

    async def test_zero_vector_hits_is_distinct_from_error(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """"报错" 与 "零命中" 两种世界不得在 recall 里同形。"""
        _install_backends(monkeypatch, vector_empty=True)
        stats: dict[str, Any] = {}
        await rag_service._retrieve(QUERY, top_k=_TOP_K, stats=stats)
        vec = stats["paths"]["vector"]
        assert vec["status"] == "empty"
        assert vec["reason"], "零命中也要写原因,否则与报错无法区分"

    async def test_unmatched_query_reports_no_candidates(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        _install_backends(monkeypatch, vector_empty=True)
        result = await rag_service.query("zzz与语料完全无关的词qqq", top_k=_TOP_K)
        assert result.rerank_depth == DEPTH_NONE
        assert "无候选" in result.rerank_reason
        assert result.sources == []
        assert result.recall["mode"] == "empty"
        assert result.recall["paths"]["keyword"]["status"] == "empty"

    async def test_partial_session_failure_is_counted_not_swallowed(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        _install_backends(monkeypatch, failing_sessions=tuple(ALL_SESSIONS[:1]))
        stats: dict[str, Any] = {}
        out = await rag_service._retrieve(QUERY, top_k=_TOP_K, stats=stats)
        assert out
        kw = stats["paths"]["keyword"]
        assert kw["sessions_failed"] == 1, "会话读失败必须计数,不得 continue 掉"
        assert "会话读取失败" in kw["reason"]
        assert kw["sessions_scanned"] == len(ALL_SESSIONS)

    async def test_dropped_by_top_k_is_reported(self, monkeypatch: pytest.MonkeyPatch) -> None:
        _install_backends(monkeypatch)
        stats: dict[str, Any] = {}
        await rag_service._retrieve(QUERY, top_k=2, stats=stats)
        assert stats["returned"] == 2
        assert stats["dropped_by_top_k"] == stats["fused_total"] - 2 > 0, (
            "被 top_k 截掉的条数必须留数 —— 静默变短等于把「没看见」写成「没有」"
        )

    async def test_session_scoped_search_scans_only_that_session(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        sid = ALL_SESSIONS[0]
        probe = _install_backends(monkeypatch)
        stats: dict[str, Any] = {}
        await rag_service._retrieve(QUERY, top_k=_TOP_K, session_id=sid, stats=stats)
        assert probe["kw_sessions"] == [sid], "限定会话时不得再扫别的会话"
        assert stats["paths"]["keyword"]["sessions_scanned"] == 1
        # 限定会话后向量路也要按 session 过滤:不得出现别人的块
        for path in stats["paths"].values():
            assert path["status"] in ("ok", "empty", "error", "partial")


# =============================================================================
# 判据 3b:LLM 二段真跑了才 executed=True;开了但失败要说"未产出可用打分"
# =============================================================================


class TestSecondStageEngine:
    async def test_llm_rerank_success_changes_ranking(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        _install_backends(monkeypatch)
        fused = await rag_service.retrieve_only(QUERY, top_k=_TOP_K)
        monkeypatch.setenv(RERANK_LLM_ENABLED_ENV, "1")
        n = len(fused)
        # 打分与融合名次**反序**(index 越后分越高)⇒ 二段真跑了就必须整个倒过来
        payload = {
            "scores": [
                {"index": i, "score": float(i), "reason": f"r{i}"} for i in range(n)
            ]
        }
        monkeypatch.setattr(
            rag_module.reranker.llm_gateway,
            "structured_completion",
            AsyncMock(return_value=payload),
            raising=False,
        )
        result = await rag_service.query(QUERY, top_k=_TOP_K)
        assert result.rerank_depth == DEPTH_LLM
        assert result.rerank_executed is True
        assert "打分重排成功" in result.rerank_reason
        assert _digests(result.sources) == list(reversed(_digests(fused))), (
            "反向打分必须把名次整个倒过来,否则二段没真参与定序"
        )

    async def test_llm_enabled_but_failing_is_not_reported_as_reranked(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        _install_backends(monkeypatch)
        fused = await rag_service.retrieve_only(QUERY, top_k=_TOP_K)
        monkeypatch.setenv(RERANK_LLM_ENABLED_ENV, "1")
        monkeypatch.setattr(
            rag_module.reranker.llm_gateway,
            "structured_completion",
            AsyncMock(side_effect=RuntimeError("网关 503")),
            raising=False,
        )
        result = await rag_service.query(QUERY, top_k=_TOP_K)
        assert result.rerank_executed is False
        assert result.rerank_depth == DEPTH_RRF
        assert "已启用但未产出可用打分" in result.rerank_reason, (
            "把「开了但失败」写成「未启用」就是伪装"
        )
        assert _digests(result.sources) == _digests(fused), "二段失败须退回融合名次"

    def test_engine_status_reflects_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv(RERANK_LLM_ENABLED_ENV, raising=False)
        assert RAGService.stage2_engine_status()["llm"].startswith("disabled")
        monkeypatch.setenv(RERANK_LLM_ENABLED_ENV, "true")
        assert RAGService.stage2_engine_status()["llm"] == "enabled"
        # cross-encoder 在册状态不随 env 变(本部署确实没有这一路)
        assert "not-wired" in RAGService.stage2_engine_status()["cross-encoder"]


# =============================================================================
# 判据 4:返回体把"名次怎么来的"带出去(调用方无需读日志)
# =============================================================================


class TestWireFormatCarriesProvenance:
    async def test_result_to_dict_exposes_rerank_and_recall(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        _install_backends(monkeypatch)
        result = await rag_service.query(QUERY, top_k=_TOP_K)
        d = RAGService.result_to_dict(result)
        assert set(d["rerank"]) == {"depth", "executed", "reason", "engines"}
        assert d["rerank"]["depth"] == DEPTH_RRF
        assert d["rerank"]["executed"] is False
        assert d["recall"]["mode"] == "rrf-fusion"
        assert d["recall"]["rrf_k"] == DEFAULT_RRF_K
        assert set(d["recall"]["paths"]) == {"vector", "keyword"}
        assert all("rrf_score" in s and "fused_from" in s for s in d["sources"])
        json.dumps(d, ensure_ascii=False)  # 可序列化,不抛

    async def test_legacy_keys_unchanged_for_callers(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """扩字段不得动既有键 —— api/v1/rag.py 与 knowledge_lookup 都按 key 消费。"""
        _install_backends(monkeypatch)
        d = RAGService.result_to_dict(await rag_service.query(QUERY, top_k=_TOP_K))
        for key in (
            "query",
            "answer",
            "sources",
            "source_count",
            "model",
            "context_tokens",
            "duration_ms",
            "stub",
            "trace",
        ):
            assert key in d, f"既有响应键丢失: {key}"
        for src in d["sources"]:
            for key in ("session_id", "role", "content", "score", "timestamp"):
                assert key in src, f"sources 既有字段丢失: {key}"
        assert d["source_count"] == len(d["sources"])

    def test_ragresult_new_fields_are_defaulted(self) -> None:
        """旧位置参数构造点(test_rag.py 等)必须继续可用。"""
        r = RAGResult(
            "q",
            "a",
            [RAGSource("s", "user", "c", 0.5)],
            "m",
            1,
            1.0,
            True,
        )
        assert r.rerank_depth == DEPTH_NONE
        assert r.rerank_executed is False
        assert r.recall == {} and r.rerank_engines == {}

    def test_depth_constant_set_is_closed(self) -> None:
        """DEPTH_* 是封闭集:新增档位必须同步本文件,否则账面会出现无人解释的值。"""
        assert {DEPTH_NONE, DEPTH_RRF, DEPTH_LLM, DEPTH_SINGLE} == {
            "none",
            "rrf-fusion",
            "llm-rerank",
            "single-source",
        }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
