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

# 来源可信度分级:官方/权威 > 媒体/机构 > 论坛/社区/个人 > 未知
class SourceTier(StrEnum):
    """来源安全分级(供引用标注与最终报告引用分级使用)。"""

    AUTHORITATIVE = "authoritative"  # 官方政府/学术/权威机构域名
    MEDIA = "media"  # 主流新闻媒体/出版机构
    COMMUNITY = "community"  # 论坛/社交/个人 UGC(未经编辑审核)
    UNKNOWN = "unknown"  # 无法判定来源类型(可信度存疑,须标注)


class VerificationStatus(StrEnum):
    """证据交叉核验状态(多独立来源一致 → 高置信;单源/矛盾 → 标注待核验)。"""

    CORROBORATED = "corroborated"  # ≥2 独立来源一致
    SINGLE_SOURCE = "single_source"  # 仅单一来源 → 待核验
    CONFLICTING = "conflicting"  # ≥2 独立来源互相矛盾 → 需核实
    UNVERIFIED = "unverified"  # 无可用来源


# 分级 → 中文展示标签 / 基础置信度
_TIER_LABELS = {
    SourceTier.AUTHORITATIVE.value: "官方/权威",
    SourceTier.MEDIA.value: "媒体/机构",
    SourceTier.COMMUNITY.value: "论坛/社区/个人",
    SourceTier.UNKNOWN.value: "未知/未核实",
}
_TIER_CONFIDENCE = {
    SourceTier.AUTHORITATIVE.value: 0.9,
    SourceTier.MEDIA.value: 0.7,
    SourceTier.COMMUNITY.value: 0.4,
    SourceTier.UNKNOWN.value: 0.25,
}
_TIER_RELIABLE = {SourceTier.AUTHORITATIVE.value, SourceTier.MEDIA.value}

_VERIFICATION_LABELS = {
    VerificationStatus.CORROBORATED.value: "多源印证(高置信)",
    VerificationStatus.SINGLE_SOURCE.value: "单一来源(待核验)",
    VerificationStatus.CONFLICTING.value: "多源矛盾(需核实)",
    VerificationStatus.UNVERIFIED.value: "无从核实",
}

# 判定为"多独立来源相互矛盾"时的冲突信号词(出现在摘要/标题中)
_CONFLICT_MARKERS = (
    "驳斥", "否认", "反驳", "称不实", "不属实", "辟谣", "造谣", "误导", "失实",
    "contradict", "deny", "dispute", "disputed", "debunk", "debunks",
)

# 权威官方域名后缀(政府/学术/军事)
_AUTHORITATIVE_SUFFIXES = (
    ".gov", ".gov.cn", ".edu", ".edu.cn", ".ac.cn", ".edu.hk", ".mil",
    ".gov.uk", ".gov.au", ".gov.tw", ".govt", ".gouv", ".go.jp", ".org.cn",
)
# 知名权威机构主域名
_AUTHORITATIVE_HOSTS = {
    "who.int", "un.org", "worldbank.org", "imf.org", "oecd.org", "iea.org",
    "nasa.gov", "nih.gov", "fda.gov", "wto.org", "europa.eu",
}
# 主流新闻媒体/出版机构主域名(权威媒体 → 归为高可信中的"媒体"档)
_MEDIA_HOSTS = {
    "reuters.com", "apnews.com", "bbc.com", "bbc.co.uk", "cnn.com", "nytimes.com",
    "wsj.com", "theguardian.com", "economist.com", "bloomberg.com", "ft.com",
    "forbes.com", "xinhuanet.com", "people.com.cn", "news.cn", "chinanews.com",
    "caixin.com", "yicai.com", "ifeng.com", "sina.com", "qq.com", "163.com",
    "sohu.com", "thepaper.cn", "jiemian.com", "huxiu.com",
}
# 论坛/社交/个人 UGC 主域名(低可信,须标注)
_COMMUNITY_HOSTS = {
    "reddit.com", "zhihu.com", "quora.com", "douban.com", "xiaohongshu.com",
    "weibo.com", "twitter.com", "x.com", "facebook.com", "youtube.com",
    "bilibili.com", "tieba.baidu.com", "hupu.com", "medium.com",
    "jianshu.com", "douyin.com", "kuaishou.com",
}
# UGC 域名特征子串(含即视为社区/个人内容场)
_COMMUNITY_MARKERS = ("forum", ".bbs", "blog-", "blogspot", "feed", "community.")

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
    """来源引用:统一 URL 去重锚点,含来源分级与可信度标注。"""

    url: str
    title: str = ""
    snippet: str = ""
    tier: str = SourceTier.UNKNOWN.value  # 来源分级(authoritative/media/community/unknown)
    confidence: float = 0.0  # 0~1 基础置信度(由分级推导)
    verified: bool = True  # 是否为高可信来源(官方/媒体);社区/未知 → False 须标注
    note: str = ""  # 分级说明(如"未知域名,可信度存疑,建议人工核验")


@dataclass
class EvidenceUnit:
    """一条已收集的(子问题 → 证据)信息单元,带来源标注与交叉核验状态。"""

    question: str
    content: str
    sources: list[SourceRef] = field(default_factory=list)
    depth: int = 0  # depth=0 来自初始子问题检索,depth>=1 来自 gap 追问轮
    source_name: str = ""
    verification: str = VerificationStatus.UNVERIFIED.value  # 交叉核验状态(by cross_check)


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
    crosscheck: list[dict[str, Any]] = field(default_factory=list)  # 逐证据交叉核验结果
    limitations: list[str] = field(default_factory=list)  # 限制与待核验清单(单源/矛盾/无从核实)
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
                    "verification": e.verification,
                    "sources": [s.url for s in e.sources],
                }
                for e in self.evidence
            ],
            "headings": self.headings,
            "sources": [
                {
                    "url": s.url,
                    "title": s.title,
                    "snippet": s.snippet,
                    "tier": s.tier,
                    "confidence": s.confidence,
                    "verified": s.verified,
                }
                for s in self.sources
            ],
            "verifications": self.crosscheck,
            "limitations": self.limitations,
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
# 类型别名:LLM 交叉核验函数 —— 接收一组「断言 + 来源群 + 证据」,返回结构化判定。
# 入参:list[dict],每个 dict 含 question/claim/sources;返回值:list[dict],
# 每个 dict 含 question/conclusion/reason/confidence。conclusion 须为 VerificationStatus 之一。
FactcheckLLMFn = Callable[[list[dict[str, Any]]], Awaitable[list[dict[str, Any]]]]

# 合法核验状态值(供 LLM 判定合法性校验)
_VERIFICATION_VALUES = {m.value for m in VerificationStatus}


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
# 来源分级 + 交叉核验(可信度标注 / fact-check)
# ---------------------------------------------------------------------------

def _normalized_host(url: str) -> str:
    """提取规范化主机名(去协议、去 www/m/news 前缀)。"""
    m = re.match(r"(?:https?://)?([^/\s?#]+)", (url or "").strip())
    if not m:
        return ""
    host = m.group(1).lower()
    for p in ("www.", "m.", "mobile.", "news."):
        if host.startswith(p):
            host = host[len(p):]
            break
    return host


def _domain_family(url: str) -> str:
    """来源独立家族(用于统计"独立来源数":不同站点可视为相互印证)。"""
    return _normalized_host(url)


def grade_source(url: str, title: str = "") -> SourceRef:
    """对单个来源 URL 分级(authoritative/media/community/unknown)并给出置信度。

    决定 `verified` 是否可信:官方/媒体默认可信(报告可裸引);社区/未知须标注。
    """
    host = _normalized_host(url)
    # 权威官方域名:主域名命中 / 命中官方后缀(含裸后缀如 gov.cn、edu.cn)
    is_authoritative = (
        host and (
            host in _AUTHORITATIVE_HOSTS
            or host.endswith(_AUTHORITATIVE_SUFFIXES)
            or host in {s.lstrip(".") for s in _AUTHORITATIVE_SUFFIXES}
        )
    )
    if is_authoritative:
        tier = SourceTier.AUTHORITATIVE.value
    elif host in _MEDIA_HOSTS:
        tier = SourceTier.MEDIA.value
    elif host in _COMMUNITY_HOSTS or any(m in host for m in _COMMUNITY_MARKERS):
        tier = SourceTier.COMMUNITY.value
    else:
        tier = SourceTier.UNKNOWN.value
    confidence = _TIER_CONFIDENCE[tier]
    verified = tier in _TIER_RELIABLE
    if not verified:
        note = (
            "未知域名,可信度存疑,建议人工核验" if tier == SourceTier.UNKNOWN.value
            else "论坛/社交等 UGC 来源,未经编辑审核"
        )
    else:
        note = _TIER_LABELS[tier]
    return SourceRef(
        url=url,
        title=title,
        tier=tier,
        confidence=confidence,
        verified=verified,
        note=note,
    )


def _has_conflict_marker(text: str) -> bool:
    """判定文本是否含"来源间相互矛盾"信号词。"""
    t = (text or "").lower()
    return any(m in t for m in _CONFLICT_MARKERS)


def _classify_verification(*, independent_sources: int, conflicting: int) -> str:
    """交叉核验分类:多源一致→高置信;单源→待核验;多源矛盾→需核实;无源→无从核实。

    - conflicting ≥ 2:有 ≥2 个独立来源群出现冲突信号词 → 矛盾(需核实)
    - independent_sources ≥ 2:多独立来源一致 → 高置信
    - independent_sources == 1:单来源 → 待核验
    - 否则:无从核实
    """
    if conflicting >= 2:
        return VerificationStatus.CONFLICTING.value
    if independent_sources >= 2:
        return VerificationStatus.CORROBORATED.value
    if independent_sources == 1:
        return VerificationStatus.SINGLE_SOURCE.value
    return VerificationStatus.UNVERIFIED.value


def cross_check(report: ResearchReport) -> list[dict[str, Any]]:
    """对已收集证据执行跨来源交叉核验,并写入 report(evidence.verification / crosscheck)。

    每个证据独立域名来源:
        ≥2 且无冲突信号 → corroborated(多源印证,高置信)
        仅 1 个独立来源  → single_source(单一来源,待核验)
        ≥2 且其中 ≥2 群含矛盾信号 → conflicting(多源矛盾,需核实)
        无可信来源配得上 → unverified(无从核实)

    返回核验明细列表(亦写入 report.crosscheck 与 report.limitations)。
    """
    findings: list[dict[str, Any]] = []
    for e in report.evidence:
        groups: dict[str, list[SourceRef]] = {}
        for s in e.sources:
            fam = _domain_family(s.url)
            if not fam:
                continue
            groups.setdefault(fam, []).append(s)
        independent = len(groups)
        conflicting = 0
        for srcs in groups.values():
            if any(
                _has_conflict_marker(s.snippet or "")
                or _has_conflict_marker(s.title or "")
                for s in srcs
            ):
                conflicting += 1
        status = _classify_verification(
            independent_sources=independent, conflicting=conflicting
        )
        e.verification = status
        findings.append(
            {
                "question": e.question,
                "verification": status,
                "independent_sources": independent,
                "sources": [s.url for s in e.sources],
                "note": _VERIFICATION_LABELS[status],
            }
        )
    report.crosscheck = findings
    report.limitations = _refresh_limitations(findings)
    return findings


def _refresh_limitations(findings: list[dict[str, Any]]) -> list[str]:
    """按交叉核验结果推导待核验清单(仅单源/矛盾 入清单)。"""
    return [
        f"{f['question']} —— {f['note']}(独立来源 {f['independent_sources']})"
        for f in findings
        if f["verification"]
        in (VerificationStatus.SINGLE_SOURCE.value, VerificationStatus.CONFLICTING.value)
    ]


def _build_claim_pairs(report: ResearchReport) -> list[dict[str, Any]]:
    """把已收集证据转为一组待核验的『断言 + 来源群 + 证据』,作为 factcheck_llm_fn 入参。"""
    pairs: list[dict[str, Any]] = []
    for e in report.evidence:
        pairs.append(
            {
                "question": e.question,
                "claim": e.content[:2000],
                "sources": [
                    {
                        "url": s.url,
                        "title": s.title,
                        "tier": s.tier,
                        "snippet": s.snippet or s.title,
                    }
                    for s in e.sources
                ],
            }
        )
    return pairs


async def _apply_llm_factcheck(
    report: ResearchReport, factcheck_llm_fn: FactcheckLLMFn
) -> None:
    """用注入的 LLM 做语义级交叉核验,按 question 覆盖启发式结论。

    契约:返回 list[dict] 含 question / conclusion / reason / confidence。
    conclusion 须为合法 VerificationStatus;返回异常/超时/非列表/条目畸形 → 静默跳过
    (保留启发式),绝不炸管线。结果落进同一 evidence.verification / report.crosscheck /
    report.limitations 结构;crosscheck 仅新增 source/reason/confidence key,不改旧 key。
    """
    try:
        pairs = _build_claim_pairs(report)
        if not pairs:
            return
        judgments = await factcheck_llm_fn(pairs)
    except Exception as e:  # LLM 调用异常/超时 → 静默回退启发式
        logger.warning("deep_research factcheck_llm 调用失败,回退启发式核验: %s", e)
        return
    if not isinstance(judgments, list):  # 返回非法(非列表)→ 静默回退启发式
        logger.warning("deep_research factcheck_llm 返回非法(非列表),回退启发式核验")
        return

    # question → (conclusion, reason, confidence) 映射(仅采纳结构合法条目)
    by_q: dict[str, tuple[str, str, float]] = {}
    for j in judgments:
        if not isinstance(j, dict):
            continue  # 单条畸形 → 跳过该条,其余仍可用
        q = j.get("question")
        conc = j.get("conclusion")
        if not isinstance(q, str) or conc not in _VERIFICATION_VALUES:
            continue
        conf = j.get("confidence")
        by_q[q] = (
            conc,
            str(j.get("reason", "") or ""),
            float(conf) if isinstance(conf, (int, float)) else 0.0,
        )
    if not by_q:
        return

    for f in report.crosscheck:
        override = by_q.get(f["question"])
        if override is None:
            continue
        conc, reason, conf = override
        f["verification"] = conc
        f["note"] = _VERIFICATION_LABELS[conc]
        f["source"] = "llm"  # 新增:本判定来自 LLM 语义核验
        f["reason"] = reason  # 新增:LLM 判定理由
        f["confidence"] = conf  # 新增:LLM 置信度
        for e in report.evidence:
            if e.question == f["question"]:
                e.verification = conc
                break
    # 状态变化 → 重新推导待核验清单
    report.limitations = _refresh_limitations(report.crosscheck)


async def _run_cross_check(
    report: ResearchReport, factcheck_llm_fn: FactcheckLLMFn | None = None
) -> list[dict[str, Any]]:
    """统一交叉核验入口:先跑启发式兜底,再可选叠加 LLM 语义增强(覆盖同 question 结论)。"""
    cross_check(report)
    if factcheck_llm_fn is not None:
        await _apply_llm_factcheck(report, factcheck_llm_fn)
    return report.crosscheck


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
    query: str,
    subquestions: list[str],
    existing: str,
    sources_md: str,
    verification_md: str = "",
) -> str:
    return (
        f"你是一名资深研究员。请基于提供的多来源证据,撰写一份结构完整的深度研究报告。\n"
        f"请用与课题相同的语言输出。\n"
        f"报告结构必须遵循『结论先行』(如有争议点也如实说明):\n"
        f"# 执行摘要(3~5 句话给出核心结论,首段即呈现)\n"
        f"## 关键发现(分论点逐条给出,每条带 [来源N] 分级引用)\n"
        f"## 竞争/对立观点\n"
        f"## 引用分级(说明各来源类型与可信度等级)\n"
        f"## 限制与待核验(明确列出:仅单源支撑、来源互相矛盾、无法核实的点)\n"
        f"## 结论与展望\n"
        f"具体要求:\n"
        f"1. 正文内用 [来源N] 标注引用,并在文末给出『# 引用来源 』列表;\n"
        f"2. 区分『已被多源支持的高置信结论』与『仅单源/待核验的推断』——"
        f"后者务必在『限制与待核验』中如实标出,不得装作确定;\n"
        f"3. 对下方『交叉核验结果』中标为待核验/矛盾的点,必须在『限制与待核验』说明;\n"
        f"4. 来源清单中已标『需标注』的低可信/未知来源,引用时须附其来源类型,不得裸引;\n"
        f"5. 纯文本 Markdown,不要多余开场白。\n\n"
        f"研究课题: {query}\n\n"
        f"【分析维度/子问题】\n{chr(10).join('- ' + s for s in subquestions)}\n\n"
        f"【多来源证据】\n{existing[:20000]}\n\n"
        f"【交叉核验结果】\n{verification_md}\n\n"
        f"【可用来源清单(分级)】\n{sources_md}"
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
            graded = grade_source(url, title)
            graded.snippet = snip
            sources.append(graded)
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
    """把来源清单格式化为分级引用:低可信/未知来源显式标注来源类型。"""
    parts = []
    for i, s in enumerate(report.sources[:50], 1):
        tag = ""
        if not s.verified:
            tag = f"[{_TIER_LABELS.get(s.tier, s.tier)}·需标注]"
        parts.append(f"{i}. <{s.url}|{s.title}> {tag}")
    return "\n".join(parts)


def _verifications_markdown(report: ResearchReport) -> str:
    """把交叉核验结果格式化为对 LLM 友好的逐条清单。"""
    if not report.crosscheck:
        return "(尚无交叉核验信息)"
    return "\n".join(
        f"- {f['question']} → {f['note']}(独立来源 {f['independent_sources']})"
        for f in report.crosscheck
    )


def _fallback_synthesize(report: ResearchReport) -> str:
    """LLM 综合失败时的确定性降级成稿(保证 reports 结构完整可用)。"""
    head = [
        f"# 执行摘要\n\n针对「{report.query}」的多来源初步研究已完成,"
        "结论如下(基于检索证据整理的要点)。"
    ]
    for i, e in enumerate(report.evidence[: _DEFAULT_GAPS_PER_ROUND + 2], 1):
        head.append(f"## 发现 {i}: {e.question}\n\n{e.content[:400]}")
    # 交叉核验汇总:多源印证 / 单源待核验 / 矛盾
    if report.crosscheck:
        head.append("## 限制与待核验\n")
        if report.limitations:
            for lim in report.limitations[:10]:
                head.append(f"- {lim}")
        else:
            head.append("- 未见需特别核验的点(各关键断言均有独立来源支撑)。")
    head.append("## 引用分级\n\n按来源可信度标注(官方/权威 > 媒体 > 论坛/社区/个人 > 未知):")
    if report.sources:
        for idx, s in enumerate(report.sources[:20], 1):
            tag = _TIER_LABELS.get(s.tier, s.tier)
            flag = "" if s.verified else f"(⚠{s.note})"
            head.append(f"{idx}. [{s.title}]({s.url}) ─ {tag} {flag}")
    else:
        head.append("- 本次未检索到可用来源。")
    head.append("\n## 引用来源")
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
    factcheck_llm_fn: FactcheckLLMFn | None = None,
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
        await _run_cross_check(  # 启发式兜底 + 可选 LLM 语义增强
            report, factcheck_llm_fn=factcheck_llm_fn
        )
        verification_md = _verifications_markdown(report)
        try:
            markdown = await llm_complete_fn(
                [
                    {
                        "role": "user",
                        "content": _build_synthesis_prompt(
                            query,
                            report.subquestions,
                            existing,
                            sources_md,
                            verification_md=verification_md,
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
        factcheck_llm_fn: FactcheckLLMFn | None = None,
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
                factcheck_llm_fn=factcheck_llm_fn,
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
