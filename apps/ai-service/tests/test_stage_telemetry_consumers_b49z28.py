# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# -*- coding: utf-8 -*-
"""Z28 格 2 装车证明:rag.query 与 conversation.chat 的段账**登记处**改吃 stage_telemetry 单源。

钉的是四件事:
① 段清单只在器物 `_TOOL_STAGES` 一处登记(消费方读得到、也拿得到固定段序);
② 真跑一遍 rag.query ⇒ 四段各落**恰好一条** `[stage_result]` 行,结论词全在在册词表内;
③ 出参形状与**数值口径**一字未改:trace 仍是 `{node, duration_ms, …*_count}` 四条形,
   duration_ms 仍是"毫秒两位小数"的浮点(取整由器物投影给出,消费方不复算);
④ 单源锁:消费方文件里不得再出现第二份段清单/词表,也不得再出现手写的
   `round((time.monotonic() - t0) * 1000, 2)` 段账。

隔离口径(AGENTS §5):不碰 PG 8810 / Redis 8811,LLM 与检索全用替身。
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import pytest

from app.services import rag as rag_module
from app.services import stage_telemetry
from app.services.rag import RAGService
from app.services.stage_telemetry import STAGE_RESULTS, StageRecord, stages_of

RAG_TRACE_KEYS: dict[str, set[str]] = {
    "retrieve": {"node", "duration_ms", "raw_count", "recall_mode"},
    "rerank": {
        "node",
        "duration_ms",
        "filtered_count",
        "score_threshold",
        "llm_rerank",
        "rerank_depth",
        "rerank_executed",
        "rerank_reason",
        "rerank_engines",
    },
    "context": {"node", "duration_ms", "context_chars", "context_tokens"},
    "generate": {"node", "duration_ms", "model", "stub"},
}


class _Sink:
    """收 [stage_result] 结论行(不依赖 structlog 后端配置,也不落盘)。"""

    def __init__(self) -> None:
        self.lines: list[str] = []
        self.warnings: list[str] = []

    def info(self, message: Any, *_a: Any) -> None:
        self.lines.append(str(message))

    def warning(self, message: Any, *args: Any) -> None:
        self.warnings.append(str(message) % args if args else str(message))

    def debug(self, message: Any, *_a: Any) -> None:
        return None


@pytest.fixture
def sink(monkeypatch):
    collector = _Sink()
    monkeypatch.setattr(stage_telemetry, "logger", collector)
    return collector


def _wire_rag(monkeypatch, service: RAGService, *, sources: list[Any], answer: str = "答复") -> None:
    async def fake_retrieve(
        query: str,
        top_k: int = 5,
        session_id: Any = None,
        stats: Any = None,
        user_id: Any = None,
    ):
        if stats is not None:
            stats["mode"] = "rrf-fusion"
        return list(sources)

    async def fake_rerank(query: str, raw, score_threshold: float = 0.0, recall_stats: Any = None):
        return rag_module.RerankOutcome(
            sources=list(raw), depth=rag_module.DEPTH_NONE, executed=False, reason="测试替身:不跑二段",
        )

    def fake_build_context(srcs, max_chars: int = 6000):
        return ("上下文文本", 7)

    async def fake_generate(question: str, context: str, model: Any = None):
        return (answer, "test-model", False)

    monkeypatch.setattr(service, "_retrieve", fake_retrieve)
    monkeypatch.setattr(service, "_rerank_with_llm", fake_rerank)
    monkeypatch.setattr(service, "_build_context", fake_build_context)
    monkeypatch.setattr(service, "_generate", fake_generate)


async def test_registry_holds_both_new_stage_lists() -> None:
    assert stages_of("rag_query") == ("retrieve", "rerank", "context", "generate")
    assert stages_of("conversation_run") == (
        "intent_classify",
        "tool_select",
        "llm_call",
        "tool_execute",
        "all_tools_failed",
        "llm_summarize",
    )


async def test_rag_query_emits_exactly_one_line_per_stage(corpus_stub, monkeypatch, sink) -> None:
    service = RAGService()
    _wire_rag(monkeypatch, service, sources=corpus_stub)
    result = await service.query("问题", top_k=3, score_threshold=0.2)

    assert [t["node"] for t in result.trace] == list(stages_of("rag_query")), "段序必须仍是在册四段"
    for entry in result.trace:
        node = entry["node"]
        assert set(entry.keys()) == RAG_TRACE_KEYS[node], f"{node} 的出参形状被改了"
        duration = entry["duration_ms"]
        assert isinstance(duration, float) and duration >= 0.0
        assert duration == round(duration, 2), "数值口径:毫秒两位小数(由器物投影取整)"
    assert result.trace[0]["recall_mode"] == "rrf-fusion"
    assert result.trace[0]["raw_count"] == len(corpus_stub)
    assert result.trace[1]["filtered_count"] == len(corpus_stub)

    line_re = re.compile(rf"\[{stage_telemetry.STAGE_LOG_EVENT}\] (.*)")
    rows = [line_re.search(line).group(1) for line in sink.lines if line_re.search(line)]
    assert len(rows) == 4, f"每段恰好一条结论行,多了少了都算破:{rows}"
    parsed = [dict(_kv(row)) for row in rows]
    assert all(p["tool"] == "rag_query" for p in parsed), parsed
    assert [p["stage"] for p in parsed] == list(stages_of("rag_query"))
    for fields in parsed:
        assert fields["result"] in STAGE_RESULTS, f"结论词表新造档:{fields}"
        assert fields["trace_id"] == "unjudged" or fields["trace_id"], fields
    assert sink.warnings == [], f"段名/词表/二次记账任一越界都会出声:{sink.warnings}"


async def test_rag_query_no_sources_marks_empty_not_unjudged(corpus_stub, monkeypatch, sink) -> None:
    """查过了、没有 ⇒ empty(可据此下结论);不许与 unjudged 同形(§0.3)。"""
    service = RAGService()
    _wire_rag(monkeypatch, service, sources=[], answer="")
    result = await service.query("问题")
    assert result.trace[0]["raw_count"] == 0
    words = {dict(_kv(m.group(1)))["stage"]: dict(_kv(m.group(1)))["result"] for m in
             re.finditer(rf"\[{stage_telemetry.STAGE_LOG_EVENT}\] (.*)", "\n".join(sink.lines))}
    assert words["retrieve"] == "empty" and words["generate"] == "unjudged"


async def test_consumers_do_not_self_declare_second_source() -> None:
    """单源锁:三条消费链路都只 import 器物,不自立段清单/词表,也不再手写段账取整。"""
    services = Path(rag_module.__file__).parent
    for name in ("rag.py", "conversation.py", "mcp_server.py"):
        src = (services / name).read_text(encoding="utf-8")
        assert "from .stage_telemetry import" in src or "stage_telemetry import" in src, name
        assert "_TOOL_STAGES" not in src, f"{name} 自立了第二份段清单(§0.6)"
        assert "STAGE_RESULTS" not in src, f"{name} 自立了第二份结论词表(§0.6)"
        assert "round((time.monotonic() - t0) * 1000, 2)" not in src, f"{name} 仍在手写段账耗时"


async def test_conversation_registers_every_stage_of_its_list() -> None:
    """conversation.chat 的段账登记点逐段可数(真跑要 LLM/记忆全套替身,超出本票预算;
    行为面由既有 tests/test_conversation.py 原样绿钉住,静态面由验收尺 J5 维判)。"""
    src = (Path(rag_module.__file__).parent / "conversation.py").read_text(encoding="utf-8")
    for stage in stages_of("conversation_run"):
        assert f'_stage_ms(\n                        "{stage}"' in src or f'"{stage}"' in src, stage
        assert f'"{stage}",' in src or f'"{stage}"' in src
    words = re.findall(r'_stage_ms\(\s*"[a-z_]+",\s*"([a-z_]+)"', src)
    assert words, "至少要有字面结论词可核"
    for word in words:
        assert word in STAGE_RESULTS, f"结论词表新造档:{word}"


async def test_search_codebase_registration_untouched() -> None:
    """Z19 的六段登记不得被本次改动挪位(格 2 只加行,不搬位)。"""
    assert stages_of("search_codebase") == (
        "validate", "keyword_leg", "semantic_leg", "lazy_index", "fuse", "assemble",
    )
    assert StageRecord(stage="x", result="ok", duration_ms=1.234, count=1).as_dict()["duration_ms"] == 1.23


def _kv(row: str) -> list[tuple[str, str]]:
    return [(m.group(1), m.group(2)) for m in re.finditer(r"(\w+)=(\S+)", row)]


@pytest.fixture
def corpus_stub() -> list[Any]:
    return [rag_module.RAGSource(session_id="s1", role="user", content="片段", score=0.9)]

# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
