# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""跨语言术语桥：词典 / 语料括号对照 / 只补位不抢名次 / 端到端中文问英文答。

全部零模型、零外部服务；每个断言钉死一条可观测行为，而不是「函数能跑」。
"""

from __future__ import annotations

import pytest

from app.services.sag2_lexical import LexicalIndex, Sag2Options, Sag2LexicalService
from app.services.sag2_lexical.bridge import (
    TermBridge,
    extract_paren_pairs,
    load_bridge_dict,
)
from app.services.sag2_lexical.judge import LexicalOnlyJudge
from app.services.sag2_lexical.retrieval import retrieve
from app.services.sag2_lexical.text import casefold_tokens, match_query


# ---------------------------------------------------------------------------
# 纯函数层
# ---------------------------------------------------------------------------


class TestParenPairs:
    def test_cjk_first_and_latin_first_both_recognized(self):
        text = "我们做向量检索（vector retrieval），也做 RAG (检索增强生成)。"
        pairs = extract_paren_pairs(text)
        cjk_side = {cjk: lat for cjk, lat in pairs}
        # CJK 侧允许带前导动词（注册时会展开后缀），这里断言的是「后缀能对上」。
        assert any(c.endswith("向量检索") and lat == "vector retrieval"
                   for c, lat in cjk_side.items()), pairs
        assert any(lat == "RAG" and "检索增强生成" in c
                   for c, lat in cjk_side.items()), pairs

    def test_noise_is_rejected(self):
        # 年份、纯中文括号、单字母都不该被当成对照。
        text = "发布于（2024），见附录（见下文），选项（a）与（b）。"
        pairs = extract_paren_pairs(text)
        assert pairs == [], f"噪声被判成对照: {pairs}"

    def test_long_latin_run_with_slash_and_dash(self):
        pairs = extract_paren_pairs("检索增强生成（retrieval-augmented generation, RAG）")
        assert pairs, "带连字符/逗号的拉丁串应被接受"
        assert "retrieval-augmented generation" in pairs[0][1]


class TestDict:
    def test_builtin_dict_is_bidirectional(self):
        bridge = TermBridge(load_bridge_dict())
        forward = bridge.expand("向量检索", LexicalIndex())
        terms = [b.term for b in forward]
        assert "vector retrieval" in terms, terms
        backward = bridge.expand("vector retrieval", LexicalIndex())
        assert "向量检索" in [b.term for b in backward]

    def test_alias_edges_connect_synonyms(self):
        bridge = TermBridge(load_bridge_dict())
        got = [b.term for b in bridge.expand("vector search", LexicalIndex())]
        # 同义词之间也应连通（vector search → vector retrieval）。
        assert "vector retrieval" in got, got

    def test_external_dict_file_merges(self, tmp_path):
        extra = tmp_path / "bridge.json"
        extra.write_text('{"自研术语": ["homebrew term"]}', encoding="utf-8")
        merged = load_bridge_dict(str(extra))
        assert "自研术语" in merged
        # 内置表仍在（合并而非替换）。
        assert "向量检索" in merged

    def test_missing_dict_file_falls_back_to_builtin(self, tmp_path):
        merged = load_bridge_dict(str(tmp_path / "nope.json"))
        assert "向量检索" in merged


# ---------------------------------------------------------------------------
# 语料自举
# ---------------------------------------------------------------------------


class TestCorpusBootstrap:
    def test_paren_pair_found_in_corpus_enables_bridge(self):
        index = LexicalIndex()
        # 「自研门控」不在内置词典里，只能靠语料括号对照建立桥。
        index.add_document(
            "notes/design.md",
            "本方案的自研门控（adaptive blending gate）负责权重分配。",
        )
        bridge = TermBridge(terms={"占位": ("placeholder",)})
        expanded = bridge.expand("自研门控", index)
        assert [b.term for b in expanded] == ["adaptive blending gate"], [
            b.to_dict() for b in expanded
        ]
        assert expanded[0].kind == "paren"

    def test_corpus_cache_invalidated_by_version(self):
        index = LexicalIndex()
        index.add_document("a.md", "旧内容（old stuff）无关。")
        bridge = TermBridge(terms={})
        assert [b.term for b in bridge.expand("旧内容", index)] == ["old stuff"]
        index.add_document("b.md", "新词（new term）出现了。")
        # 版本递增后必须重建，新对照立刻可见。
        assert [b.term for b in bridge.expand("新词", index)] == ["new term"]

    def test_unknown_term_reports_nothing_not_a_guess(self):
        index = LexicalIndex()
        index.add_document("a.md", "完全无关的一段中文。")
        bridge = TermBridge(terms={})
        assert bridge.expand("完全无关", index) == []


# ---------------------------------------------------------------------------
# 端到端：中文问、英文答
# ---------------------------------------------------------------------------


def _english_only_index() -> LexicalIndex:
    index = LexicalIndex()
    index.add_document(
        "docs/hnsw.md",
        "HNSW builds a hierarchical navigable small world graph for "
        "approximate nearest neighbor search over embeddings.",
    )
    index.add_document(
        "docs/bm25.md",
        "BM25 ranks documents by term frequency and inverse document frequency.",
    )
    index.add_document(
        "docs/other.md",
        "The cafeteria serves noodles at noon.",
    )
    return index


@pytest.mark.asyncio
async def test_chinese_query_finds_english_doc_via_dict_bridge():
    """中文问「近似最近邻」→ 英文文档 approximate nearest neighbor 被召回。

    这是「抄无可抄」要补的那个洞：词法层面中英零重叠，此前必然零召回。
    """
    index = _english_only_index()
    # 基线：不开桥 ⇒ 一个候选都没有。
    baseline = await retrieve(
        index,
        "近似最近邻",
        LexicalOnlyJudge(),
        Sag2Options(max_hops=0, top_k=5),
        bridge=None,
    )
    assert baseline.results == [], "基线本应零召回（中文词元在英文索引里不存在）"

    bridged = await retrieve(
        index,
        "近似最近邻",
        LexicalOnlyJudge(),
        Sag2Options(max_hops=0, top_k=5),
        bridge=TermBridge(load_bridge_dict()),
    )
    paths = [c["path"] for c in bridged.citations]
    assert "docs/hnsw.md" in paths, f"桥接后仍未召回目标文档: {paths}"
    assert bridged.bridge, "结果里应记录用了哪些桥接词"
    assert bridged.paths["bridge"]["status"] == "ok"
    assert bridged.paths["bridge"]["count"] >= 1


@pytest.mark.asyncio
async def test_english_query_finds_chinese_doc():
    index = LexicalIndex()
    index.add_document("notes/a.md", "本系统使用近似最近邻算法加速向量召回。")
    result = await retrieve(
        index,
        "approximate nearest neighbor",
        LexicalOnlyJudge(),
        Sag2Options(max_hops=0, top_k=5),
        bridge=TermBridge(load_bridge_dict()),
    )
    assert [c["path"] for c in result.citations] == ["notes/a.md"]


@pytest.mark.asyncio
async def test_bridge_does_not_disturb_ranking_when_both_languages_hit():
    """中英都命中时，原查询候选顺序必须一字不动（桥只补位）。"""
    index = LexicalIndex()
    index.add_document("zh.md", "向量检索是本项目的核心能力。")
    index.add_document("en.md", "vector retrieval is the core capability.")
    index.add_document("noise.md", "vector of a matrix retrieval of data.")

    plain = await retrieve(
        index,
        "向量检索",
        LexicalOnlyJudge(),
        Sag2Options(max_hops=0, top_k=3, candidate_k=50),
        bridge=None,
    )
    bridged = await retrieve(
        index,
        "向量检索",
        LexicalOnlyJudge(),
        Sag2Options(max_hops=0, top_k=3, candidate_k=50),
        bridge=TermBridge(load_bridge_dict()),
    )
    plain_paths = [c["path"] for c in plain.citations]
    bridged_paths = [c["path"] for c in bridged.citations]
    # 原查询命中的那份必须仍在首位，且原顺序是桥接结果的**前缀**。
    assert plain_paths, "基线不该为空"
    assert bridged_paths[: len(plain_paths)] == plain_paths, (
        f"桥接污染了原排序: {plain_paths} -> {bridged_paths}"
    )


@pytest.mark.asyncio
async def test_bridge_disabled_option_keeps_zero_recall():
    index = _english_only_index()
    result = await retrieve(
        index,
        "近似最近邻",
        LexicalOnlyJudge(),
        Sag2Options(max_hops=0, top_k=5, cross_lingual=False),
        bridge=TermBridge(load_bridge_dict()),
    )
    assert result.results == []
    assert result.bridge == []


@pytest.mark.asyncio
async def test_service_status_exposes_cross_lingual_numbers():
    service = Sag2LexicalService(index=LexicalIndex(), gateway=None)
    service.add_document("a.md", "本方案用倒排索引（inverted index）加速。")
    data = service.status()
    cross = data["cross_lingual"]
    assert cross["dict_terms"] > 50, cross
    assert cross["corpus_pairs"] >= 1, cross
    # 语料对照必须来自真实文档，而不是凭空计数。
    assert cross["corpus_enabled"] is True


def test_paren_pair_survives_tokenizer_normalization():
    """括号对照入库前走同一套归一化，保证与检索词同构。"""
    bridge = TermBridge(terms={})
    index = LexicalIndex()
    index.add_document("a.md", "混合检索（Hybrid   Search）很重要。")
    got = bridge.expand("混合检索", index)
    assert got and got[0].term == "hybrid search", [b.to_dict() for b in got]
    # 归一化后确实能被倒排命中（不是只存在于映射表里）。
    assert index.candidate_query(["hybrid", "search"], 5)


def test_match_query_unchanged_by_bridge_module():
    """桥模块不得偷偷改查询词元（原查询是排序的地基）。"""
    assert match_query("向量检索") == ["向量", "量检", "检索"]
    assert casefold_tokens("RAG") == ["rag"]
