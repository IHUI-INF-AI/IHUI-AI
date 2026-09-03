# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""Deep Research 多轮深度研究管线。

对标头部产品(OpenAI Deep Research / Gemini Deep Research)的 agentic 多轮闭环:
    规划 → 多源检索 → 双向深度调查(gap 追问) → 综合成稿

设计要点:
- 纯异步主函数 `run_deep_research`:可在任意服务/路由中调用,接收可注入的
  `llm_complete_fn` 与检索源适配器,便于单元测试 mock(不真实联网)。
- 检索源复用项目现有能力:
    - `mcp_server.call_tool("web_search", {"query", "max_results"})`,内部走
      `_tool_web_search`,复用 DuckDuckGo Lite HTML 搜索,返回 `{"ok", "results":[...]}`。
    - `mcp_server.call_tool("fetch_url", {"url", "mode": "text", "max_chars"})`,
      内部走 `_tool_fetch_url`,自带 SSRF 防护(复用 screenshot_service._validate_url_ssrf)。
  (签名见 app/services/mcp_server.py: _tool_web_search L1212 / _tool_fetch_url L2690 /
   MCPServer.call_tool L5002)
- 并发控制:子问题/追问以 asyncio.Semaphore 限制并发上限(asyncio.gather 并行)。
- 状态可观察:研究过程产生后,外层的 DeepResearchManager 用进程内存储维护
  running/done/error 状态与断点续跑。
- 检索失败降级:单条检索失败仅记录、不影响整体;LLM 综合失败时用确定性模板降级成稿。
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import time
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any

logger = logging.getLogger(__name__)

# 允许参数注入与测试覆盖的数量默认值
_DEFAULT_MAX_ITERATIONS = 4
_DEFAULT_CONCURRENCY = 4
_DEFAULT_GAPS_PER_ROUND = 3
_DEFAULT_FETCH_PER_SUBQUESTION = 3
_SEARCH_RESULTS_K = 6
_BODY_MAX_CHARS = 6000

# 阶段定义(对外暴露给前端与中断/续跑逻辑)
PHASE_PLANNING = "planning"        # 规划:query → 子问题清单
PHASE_RETRIEVE = "retrieving"      # 多源检索:子问题检索
PHASE_DEEPEN = "deepening"         # 双向深度调查:gap 追问 + 再检索
PHASE_SYNTHESIZE = "synthesizing"  # 综合成稿
PHASE_DONE = "done"
PHASE_ERROR = "error"


class ResearchStatus(StrEnum):
    """研究运行状态(进程内存储,供前端轮询)。"""

    RUNNING = "running"
    DONE = "done"
    ERROR = "error"


@dataclass
class SourceRef:
    """来源引用:统一 URL 去重锚点。"""

    url: str
    title: str = ""
    snippet: str = ""


@dataclass
class EvidenceUnit:
    """一条已收集的(子问题 → 证据)信息单元,带来源标注。"""

    question: str
    content: str
    sources: list[SourceRef] = field(default_factory=list)
    depth: int = 0  # depth=0 来自初始子问题检索,depth>=1 来自 gap 追问轮
    source_name: str = ""


@dataclass
class StageSnapshot:
    """阶段快照:记录某阶段的起止、状态与信息。"""

    phase: str
    status: str  # running / done / skipped
    detail: str = ""
    started_at: float = field(default_factory=time.time)
    completed_at: float = 0.0


@dataclass
class ResearchReport:
    """深度研究最终产物(供路由序列化返回)。"""

    research_id: str
    query: str
    status: str = ResearchStatus.RUNNING.value
    error: str = ""
    subquestions: list[str] = field(default_factory=list)
    gap_questions: list[str] = field(default_factory=list)
    evidence: list[EvidenceUnit] = field(default_factory=list)
    markdown: str = ""
    headings: list[str] = field(default_factory=list)
    sources: list[SourceRef] = field(default_factory=list)
    stages: list[StageSnapshot] = field(default_factory=list)
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    max_iterations: int = _DEFAULT_MAX_ITERATIONS
    iteration: int = 0

    # ---- 序列化(供 FastAPI JSON 返回)----
    def to_dict(self) -> dict[str, Any]:
        return {
            "research_id": self.research_id,
            "query": self.query,
            "status": self.status,
            "error": self.error,
            "subquestions": self.subquestions,
            "gap_questions": self.gap_questions,
            "iteration": self.iteration,
            "max_iterations": self.max_iterations,
            "evidence": [
                {
                    "question": e.question,
                    "content": e.content[:1000],
                    "depth": e.depth,
                    "source": e.source_name,
                    "sources": [s.url for s in e.sources],
                }
                for e in self.evidence
            ],
            "headings": self.headings,
            "sources": [
                {"url": s.url, "title": s.title, "snippet": s.snippet} for s in self.sources
            ],
            "markdown": self.markdown,
            "stages": [
                {
                    "phase": st.phase,
                    "status": st.status,
                    "detail": st.detail,
                    "started_at": st.started_at,
                    "completed_at": st.completed_at,
                }
                for st in self.stages
            ],
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


# 类型别名:LLM 补全函数 —— 接收 messages,返回助手文本内容(简单契约,便于测试)
LLMFn = Callable[[list[dict[str, Any]]], Awaitable[str]]


def _apply_progress(
    report: ResearchReport, phase: str, arg: Any = None
) -> None:
    """统一的阶段快照与时间戳推进,供进度回调与前端展示使用。"""
    report.updated_at = time.time()
    # 结束上一个处于 running 的快照(转移到 completed)
    for st in report.stages:
        if st.status == "running" and not st.completed_at:
            st.status = "done"
            st.completed_at = time.time()
    if arg is not None:
        report.stages.append(
            StageSnapshot(phase=phase, status="running", detail=str(arg))
        )
    else:
        report.stages.append(StageSnapshot(phase=phase, status="running"))


# ---------------------------------------------------------------------------
# 检索源适配层
# ---------------------------------------------------------------------------

class MCPResearchSource:
    """复用项目 MCP 内置 web_search / fetch_url(带 SSRF 防护)的检索源。

    适配 mcp_server.MCPServer.call_tool(name, arguments):
        - "web_search": {"query": str, "max_results": int}
          → {"ok", "results": [{title,url,snippet}]}
        - "fetch_url": {"url", "mode": "text", "max_chars"} → {"ok", "content", "url", ...}
    """

    name = "mcp"

    async def search(self, query: str, k: int = _SEARCH_RESULTS_K) -> list[dict[str, str]]:
        from app.services.mcp_server import mcp_server  # 延迟导入,避免模块加载副作用

        res = await mcp_server.call_tool(
            "web_search", {"query": query, "max_results": k}
        )
        if not isinstance(res, dict) or not res.get("ok"):
            return []
        return [
            {"title": r.get("title", ""), "url": r.get("url", ""), "snippet": r.get("snippet", "")}
            for r in res.get("results", [])
            if r.get("url")
        ]

    async def fetch(self, url: str, max_chars: int = _BODY_MAX_CHARS) -> str:
        from app.services.mcp_server import mcp_server  # 延迟导入

        res = await mcp_server.call_tool(
            "fetch_url", {"url": url, "mode": "text", "max_chars": max_chars}
        )
        if not isinstance(res, dict) or not res.get("ok"):
            return ""
        return str(res.get("content", ""))


def _dedupe_url(url: str) -> str:
    """URL 规范化以便去重(去空白、去跟踪尾巴片段)。"""
    return (url or "").strip().rstrip("/#").split("#")[0]


# ---------------------------------------------------------------------------
# LLM 结构化提示与解析
# ---------------------------------------------------------------------------

def _extract_json_list(text: str) -> list[str]:
    """从 LLM 输出中尽力解析字符串列表(JSON 数组 / markdown 列表均可)。"""
    if not text:
        return []
    # 优先 JSON 数组
    m = re.search(r"\[[\s\S]*\]", text)
    if m:
        try:
            parsed = json.loads(m.group(0))
            if isinstance(parsed, list):
                return [str(x).strip() for x in parsed if str(x).strip()]
        except Exception:
            pass
    # 其次 markdown 编号/无序列表行
    lines = []
    for ln in text.splitlines():
        ln = ln.strip().lstrip("*-–—0123456789.").strip()
        if ln.startswith(("「", "“", "'", '"')):
            ln = ln.strip("「」”“\"'")
        if ln:
            lines.append(ln)
    return lines[:20]


def _extract_headings(markdown: str) -> list[str]:
    """从生成报告的 markdown 抽取标题,作为分节结构返回前端。"""
    return [
        ln.strip("# ").strip()
        for ln in markdown.splitlines()
        if re.match(r"^#{1,4}\s+", ln.strip())
    ]


async def _llm_json_list(llm_complete_fn: LLMFn, prompt: str) -> list[str]:
    """调用 LLM 并要求返回问题清单(解析失败返回空列表)。"""
    try:
        text = await llm_complete_fn([{"role": "user", "content": prompt}])
    except Exception as e:  # LLM 调用异常 → 降级为空清单
        logger.warning("deep_research llm 调用失败: %s", e)
        return []
    return _extract_json_list(text)


def _build_plan_prompt(query: str) -> str:
    return (
        f"你是一名资深研究员。请把下面的研究课题拆解成『可独立检索』的子问题清单。\n"
        f"要求:\n"
        f"1. 返回 4~8 个子问题;\n"
        f"2. 每个子问题是一个可直接放搜索引擎查询的关键词式问题,"
        f"涵盖背景、现状、数据、多方观点、趋势等维度;\n"
        f"3. 只用 JSON 字符串数组输出,不要任何解释。\n\n"
        f"研究课题: {query}"
    )


def _build_gap_prompt(query: str, existing: str, depth: int) -> str:
    return (
        f"你是一名严谨的研究员。基于以下已收集的信息,识别信息缺口并给出"
        f"最多 3 个需要『继续检索追问』的具体问题,用于查缺补漏/交叉验证/补充反方视角。\n"
        f"要求:\n"
        f"1. 每个追问是一个可直接放到搜索引擎的关键词式问题;\n"
        f"2. 优先补足证据不足、有争议、缺少数据或缺少反方观点的地方;\n"
        f"3. 只用 JSON 字符串数组输出,不要任何解释。\n\n"
        f"研究课题: {query}\n\n"
        f"【已收集信息】\n{existing[:4000]}"
    )


def _build_synthesis_prompt(
    query: str, subquestions: list[str], existing: str, sources_md: str
) -> str:
    return (
        f"你是一名资深研究员。请基于提供的多来源证据,撰写一份结构完整的深度研究报告。\n"
        f"请用与课题相同的语言输出。\n"
        f"报告结构必须包含:\n"
        f"# 执行摘要(3~5 句话给出核心结论)\n"
        f"## 背景\n## 主要发现\n## 竞争/对立观点\n## 数据一览\n## 结论与展望\n"
        f"具体要求:\n"
        f"1. 正文内用 [来源N] 标注引用,并在文末给出『# 引用来源 』列表;\n"
        f"2. 观点要区分『已被证据支持』与『存在争议』;\n"
        f"3. 纯文本 Markdown,不要多余开场白。\n\n"
        f"研究课题: {query}\n\n"
        f"【分析维度/子问题】\n{chr(10).join('- ' + s for s in subquestions)}\n\n"
        f"【多来源证据】\n{existing[:20000]}\n\n"
        f"【可用来源清单】\n{sources_md}"
    )


# ---------------------------------------------------------------------------
# 检索执行
# ---------------------------------------------------------------------------

async def _search_one(
    source: Any,
    question: str,
    *,
    sem: asyncio.Semaphore,
    max_fetch: int,
) -> EvidenceUnit:
    """对单个子问题:搜索 → 取前几个来源抓取正文 → 合并为一条证据。

    受外层 Semaphore 限流:同一个多源并发批次内,真正的并发上限为 concurrency。
    """
    async with sem:  # 并发上限:占住信号量槽位再执行搜索+抓取
        return await _search_one_impl(source, question, max_fetch=max_fetch)


async def _search_one_impl(
    source: Any, question: str, *, max_fetch: int
) -> EvidenceUnit:
    """_search_one 的实际执行体(已在信号量槽位内)。"""
    urls: list[str] = []
    sources: list[SourceRef] = []
    snippets: list[str] = []
    try:
        results = await source.search(question)
        for r in results[: _SEARCH_RESULTS_K]:
            url = _dedupe_url(r.get("url", ""))
            if not url or any(_dedupe_url(u) == url for u in urls):
                continue
            urls.append(url)
            title = r.get("title", "") or url
            snip = r.get("snippet", "") or ""
            sources.append(SourceRef(url=url, title=title, snippet=snip))
            if snip:
                snippets.append(snip)

        # 并发受限地抓取正文(url_order 保持稳定)
        fetches = [source.fetch(url) for url in urls[:max_fetch]]
        bodies = []
        for fut in asyncio.as_completed(fetches):
            try:
                body = await fut
            except Exception as e:
                logger.debug("fetch 失败: %s", e)
                body = ""
            if body:
                bodies.append(body)
        # 把抓到的正文拼接进证据内容(带来源锚点)
        content = "\n\n".join(dict.fromkeys(bodies if bodies else snippets)).strip()
        if not content:
            content = " ".join(snippets).strip()
        # 截断单条证据体量,避免上下文爆炸
        if len(content) > _BODY_MAX_CHARS:
            content = content[: _BODY_MAX_CHARS] + "…"
        return EvidenceUnit(
            question=question,
            content=content,
            sources=sources,
            source_name=getattr(source, "name", "mcp"),
        )
    except Exception as e:  # 单条检索失败 → 降级为「仅摘要」证据,不阻断整体
        logger.warning("deep_research 检索失败 q=%s: %s", question, e)
        return EvidenceUnit(
            question=question,
            content=" ".join(snippets).strip() or "(检索失败)",
            sources=sources,
            source_name=getattr(source, "name", "mcp"),
        )


async def _retrieve_many(
    report: ResearchReport,
    questions: list[str],
    *,
    depth: int,
    sources: list[Any],
    concurrency: int,
    max_fetch: int,
) -> list[EvidenceUnit]:
    """并行检索一组问题(子问题或 gap 追问),跨多源去重合并。"""
    if not questions:
        return []
    sem = asyncio.Semaphore(concurrency)
    # 遍历多源,收集全部证据(源之间按 URL 去重由 Report.dedup 兜底)
    tasks = [
        _search_one(src, q, sem=sem, max_fetch=max_fetch)
        for src in sources
        for q in questions
    ]
    units = await asyncio.gather(*tasks, return_exceptions=True)
    collected: list[EvidenceUnit] = []
    for u in units:
        if isinstance(u, Exception):
            logger.debug("检索任务异常: %s", u)
            continue
        u.depth = depth
        collected.append(u)
    # 合并到报告并做 URL 维度去重
    known: set[str] = {_dedupe_url(s.url) for e in report.evidence for s in e.sources}
    fresh: list[EvidenceUnit] = []
    for e in collected:
        new_src = [s for s in e.sources if _dedupe_url(s.url) not in known and _dedupe_url(s.url)]
        if new_src or e.content:
            report.evidence.append(e)
            fresh.append(e)
        for s in e.sources:
            known.add(_dedupe_url(s.url))
    # 重构报告级来源(按 URL 去重、保序)
    seen_src = set()
    dedup_sources: list[SourceRef] = []
    for e in report.evidence:
        for s in e.sources:
            key = _dedupe_url(s.url)
            if not key or key in seen_src:
                continue
            seen_src.add(key)
            dedup_sources.append(s)
    report.sources = dedup_sources
    report.updated_at = time.time()
    return fresh


def _evidence_to_text(report: ResearchReport) -> str:
    """把已收集证据格式化为对 LLM 友好的文本。"""
    parts = []
    for i, e in enumerate(report.evidence, 1):
        parts.append(f"[{i}] (深度第{e.depth}轮·{e.source_name}) {e.question}:\n{e.content}")
    return "\n\n".join(parts)


def _sources_markdown(report: ResearchReport) -> str:
    return "\n".join(
        f"<{s.url}|{s.title}>" for s in report.sources[:50]
    )


def _fallback_synthesize(report: ResearchReport) -> str:
    """LLM 综合失败时的确定性降级成稿(保证 reports 结构完整可用)。"""
    head = [
        f"# 执行摘要\n\n针对「{report.query}」的多来源初步研究已完成,"
        "结论如下(基于检索证据整理的要点)。"
    ]
    for i, e in enumerate(report.evidence[: _DEFAULT_GAPS_PER_ROUND + 2], 1):
        head.append(f"## 发现 {i}: {e.question}\n\n{e.content[:400]}")
    head.append("## 引用来源")
    for idx, s in enumerate(report.sources[:20], 1):
        head.append(f"{idx}. [{s.title}]({s.url})")
    return "\n\n".join(head)


# ---------------------------------------------------------------------------
# 主管线
# ---------------------------------------------------------------------------

async def run_deep_research(
    query: str,
    *,
    sources: list[Any] | None = None,
    llm_complete_fn: LLMFn,
    max_iterations: int = _DEFAULT_MAX_ITERATIONS,
    research_id: str | None = None,
    concurrency: int = _DEFAULT_CONCURRENCY,
    gaps_per_round: int = _DEFAULT_GAPS_PER_ROUND,
    max_fetch: int = _DEFAULT_FETCH_PER_SUBQUESTION,
) -> ResearchReport:
    """执行 agentic 多轮深度研究,返回结构化报告。

    阶段:
      1. planning   —— 把 query 拆为可检索子问题
      2. retrieving —— 对子问题多源检索 + 正文抓取 + 去重合并
      3. deepening  —— 基于已收集信息生成 gap 追问并再检索,循环至 max_iterations
      4. synthesizing —— LLM 结构化 Markdown 成稿(执行摘要/分节/结论/引用)
    """
    srcs: list[Any] = sources if sources is not None else [MCPResearchSource()]
    report = ResearchReport(
        research_id=research_id or f"dr_{uuid.uuid4().hex[:12]}",
        query=query,
        max_iterations=max_iterations,
    )
    _apply_progress(report, PHASE_PLANNING)

    try:
        # 1. 规划:拆子问题
        subquestions = await _llm_json_list(llm_complete_fn, _build_plan_prompt(query))
        report.subquestions = subquestions or [query]
        report.iteration = 0
        _apply_progress(report, PHASE_RETRIEVE, f"子问题数={len(report.subquestions)}")

        # 2. 多源检索(初始子问题,并行带并发上限)
        await _retrieve_many(
            report,
            report.subquestions,
            depth=0,
            sources=srcs,
            concurrency=concurrency,
            max_fetch=max_fetch,
        )

        # 3. 双向深度调查:gap 追问 + 再检索,循环至 max_iterations
        report.iteration = 0
        for i in range(1, max_iterations + 1):
            _apply_progress(
                report, PHASE_DEEPEN, f"第 {i}/{max_iterations} 轮追问"
            )
            existing = _evidence_to_text(report)
            gaps = await _llm_json_list(
                llm_complete_fn, _build_gap_prompt(query, existing, depth=i)
            )
            gaps = [g for g in gaps if not _is_question_redundant(g, report)][:gaps_per_round]
            if not gaps:
                break
            report.iteration = i
            report.gap_questions.extend(gaps)
            await _retrieve_many(
                report,
                gaps,
                depth=i,
                sources=srcs,
                concurrency=concurrency,
                max_fetch=max_fetch,
            )

        # 4. 综合成稿
        _apply_progress(report, PHASE_SYNTHESIZE)
        existing = _evidence_to_text(report)
        sources_md = _sources_markdown(report)
        try:
            markdown = await llm_complete_fn(
                [
                    {
                        "role": "user",
                        "content": _build_synthesis_prompt(
                            query, report.subquestions, existing, sources_md
                        ),
                    }
                ]
            )
            markdown = (markdown or "").strip()
        except Exception as e:
            logger.warning("deep_research 成稿 LLM 失败,降级模板: %s", e)
            markdown = ""
        if not markdown:
            markdown = _fallback_synthesize(report)
        report.markdown = markdown
        report.headings = _extract_headings(markdown)

        report.status = ResearchStatus.DONE.value
        _apply_progress(report, PHASE_DONE)
        return report
    except Exception as e:
        logger.exception("deep_research 执行异常: %s", e)
        report.status = ResearchStatus.ERROR.value
        report.error = str(e)[:500]
        _apply_progress(report, PHASE_ERROR, str(e)[:200])
        # 兜底:即便异常也尽量给出降级成稿,保证可读
        if not report.markdown:
            report.markdown = _fallback_synthesize(report)
        return report


def _is_question_redundant(q: str, report: ResearchReport) -> bool:
    """去重:与已有子问题/追问高度雷同的问题不再检索。"""
    seen = set(report.subquestions)
    seen.update(report.gap_questions)
    return any(len(q) >= 6 and (q in s or s in q) for s in seen)


# ---------------------------------------------------------------------------
# 进程内状态编排(供路由断点续跑)
# ---------------------------------------------------------------------------

@dataclass
class ResearchRun:
    """一次研究的进程内运行状态(running/done/error)与断点续跑句柄。"""

    research_id: str
    query: str
    status: ResearchStatus = ResearchStatus.RUNNING
    report: ResearchReport | None = None
    task: Any = None
    created_at: float = field(default_factory=time.time)
    error: str = ""


class DeepResearchManager:
    """极简的进程内研究管理:启动后台任务,支持查询进度/断点续跑。

    说明:进程内存储即满足『断点续跑』需求 —— 研究任务常驻进程,中途任何时刻
    通过 research_id 查询状态(running/done/error);任务完成后再 get 直接命中
    终态报告;重复 start/resume 不会重复启动(命中进行中或已完成即返回既有结果)。
    """

    def __init__(self) -> None:
        self._runs: dict[str, ResearchRun] = {}
        self._max_runs = 200

    def _evict(self) -> None:
        # 简单容量上限,防长时间运行内存泄漏
        while len(self._runs) > self._max_runs:
            self._runs.pop(next(iter(self._runs)), None)

    def start(
        self,
        query: str,
        llm_complete_fn: LLMFn,
        *,
        sources: list[Any] | None = None,
        max_iterations: int = _DEFAULT_MAX_ITERATIONS,
    ) -> ResearchRun:
        """启动一次研究(后台协程执行,立即返回 run 句柄)。

        说明:研究在进程内以后台任务常驻执行 —— 这就是『断点续跑』的基础。
        客户端任意时刻通过 get() 即可读到当前进度/终态,无需重启重跑。
        """
        research_id = f"dr_{uuid.uuid4().hex[:12]}"
        run = ResearchRun(research_id=research_id, query=query)
        self._runs[research_id] = run
        self._evict()

        async def _runner() -> None:
            report = await run_deep_research(
                query,
                sources=sources,
                llm_complete_fn=llm_complete_fn,
                max_iterations=max_iterations,
                research_id=research_id,
            )
            run.report = report
            run.error = report.error
            run.status = (
                ResearchStatus(report.status)
                if report.status in ResearchStatus._value2member_map_
                else ResearchStatus.ERROR
            )

        run.task = asyncio.create_task(_runner())
        return run

    def get(self, research_id: str) -> ResearchRun | None:
        """查询运行态:命中即返回(含进行中/已完成/出错),未命中返回 None。"""
        run = self._runs.get(research_id)
        if run is None:
            return None
        # 后台任务已结束但 run.status 未同步 → 按 report 兜底修正
        if run.report is not None and run.status is ResearchStatus.RUNNING:
            run.status = (
                ResearchStatus(run.report.status)
                if run.report.status in ResearchStatus._value2member_map_
                else ResearchStatus.ERROR
            )
            run.error = run.report.error
        return run

    def resume(
        self,
        research_id: str,
        llm_complete_fn: LLMFn,
        *,
        sources: list[Any] | None = None,
        max_iterations: int = _DEFAULT_MAX_ITERATIONS,
    ) -> ResearchRun | None:
        """断点续跑。

        进程内已存在该研究的运行/终态 → 直接返回(自动续接进度,不会重复检索);
        已被容量淘汰/进程重启导致丢失 → 记录到日志,交由路由层按 404 处理
        (无法在无原始 query 的情况下凭空还原中间产物)。
        """
        run = self.get(research_id)
        if run is not None:
            return run
        logger.warning(
            "deep_research resume 未命中 research_id=%s(可能已淘汰/进程重启)", research_id
        )
        return None


# 对外单例(路由复用)
manager = DeepResearchManager()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
