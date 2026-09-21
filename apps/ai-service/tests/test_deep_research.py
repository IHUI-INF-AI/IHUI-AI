# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""deep_research 多轮深度研究管线测试。

覆盖(全部 mock llm_complete_fn 与检索源,不真实联网):
1. 规划:query 拆为可检索子问题
2. 多源检索合并与 URL 去重
3. 双向深度调查:gap 追问循环
4. 报告结构完整性(执行摘要/分节/引用来源)
5. max_iterations 中止
6. 检索失败时降级成稿
7. 进程内状态管理器(start/get/resume)
"""

from __future__ import annotations

import json

from app.services.deep_research import (
    DeepResearchManager,
    ResearchReport,
    ResearchStatus,
    SourceRef,
    SourceTier,
    VerificationStatus,
    _dedupe_url,
    _extract_headings,
    _fallback_synthesize,
    cross_check,
    grade_source,
    run_deep_research,
)

__all__: list[str] = []


# ---------------------------------------------------------------------------
# 假检索源
# ---------------------------------------------------------------------------

class FakeSource:
    """确定性假检索源:search 返回解析结果,fetch 返回固定正文。"""

    name = "fake"
    fail_search = False
    fetch_results = {}

    async def search(self, query, k=6):
        if self.fail_search:
            raise RuntimeError("search 网络失败")
        q = query.lower().replace(" ", "-")
        return [
            {
                "title": f"结果-{q}-1",
                "url": f"https://example.com/{q}/1",
                "snippet": f"{query}: 摘要1",
            },
            {
                "title": f"结果-{q}-2",
                "url": f"https://example.com/{q}/2",
                "snippet": f"{query}: 摘要2",
            },
        ][:k]

    async def fetch(self, url, max_chars=6000):
        if getattr(self, "fail_fetch", False):
            raise RuntimeError("fetch 网络失败")
        return f"[正文] {url}"


class DuplicateSource(FakeSource):
    """与 FakeSource 返回相同 URL,用于验证跨源去重。"""

    name = "fake2"


class MultiDomainSource:
    """确定性多域名检索源:便于构造多独立来源/跨域核验场景。"""

    name = "multi"

    def __init__(self, items):
        self._items = list(items)  # [(url, title, snippet), ...]

    async def search(self, query, k=6):
        return [
            {"title": t, "url": u, "snippet": s} for u, t, s in self._items[:k]
        ]

    async def fetch(self, url, max_chars=6000):
        return f"[正文] {url}"


# ---------------------------------------------------------------------------
# 假 LLM:基于提示词关键词路由不同行为
# ---------------------------------------------------------------------------

def _make_llm(plan_list, gap_returns, synthesis_text=None):
    """构造确定性 llm_complete_fn。

    - plan 提示包含『拆解成』→ 返回子问题清单
    - gap 提示包含『识别信息缺口』→ 依序弹用 gap_returns(每被调用取一个,耗尽后返回 [])
    - synthesis 提示包含『撰写一份结构完整』→ 返回 fix 报告
    """

    async def _llm(messages):
        content = messages[-1]["content"]
        if "拆解成『可独立检索』的子问题" in content:
            return json.dumps(plan_list, ensure_ascii=False)
        if "识别信息缺口" in content:
            if gap_returns:
                # 若 gap_returns 是「永远返回」哨兵,关键字 always
                return json.dumps(gap_returns.pop(0), ensure_ascii=False)
            return "[]"
        if "撰写一份结构完整" in content:
            if synthesis_text is not None:
                return synthesis_text
            return (
                "# 执行摘要\n\n这是核心结论。\n"
                "## 背景\n背景内容。\n"
                "## 主要发现\n- 观点 A [来源1]\n"
                "## 结论与展望\n结论。\n"
                "# 引用来源\n\n1. [来源A](https://example.com/a/1)"
            )
        return ""

    return _llm


def _report_stage_names(report):
    return [s.phase for s in report.stages]


# ---------------------------------------------------------------------------
# 测试
# ---------------------------------------------------------------------------

async def test_plan_splits_subquestions():
    """规划阶段把 query 拆成可检索子问题。"""
    llm = _make_llm(["子问题A", "子问题B", "子问题C"], [])
    report = await run_deep_research(
        "测试某个领域", sources=[FakeSource()], llm_complete_fn=llm, max_iterations=2
    )
    assert report.status == ResearchStatus.DONE.value
    assert report.subquestions == ["子问题A", "子问题B", "子问题C"]
    assert "planning" in _report_stage_names(report)


async def test_multisource_merge_dedup_url():
    """多源(gather)检索收集证据,并按 URL 维度去重合并。"""
    llm = _make_llm(["问题1"], [])
    report = await run_deep_research(
        "多源研究",
        sources=[FakeSource(), DuplicateSource()],  # 两个源返回相同 URL → 来源去重
        llm_complete_fn=llm,
        max_iterations=1,
    )
    assert len(report.evidence) >= 1
    # 跨源 URL 去重:同一 url 只在 report.sources 出现一次
    urls = [s.url for s in report.sources]
    assert len(urls) == len(set(urls))
    # 证据至少携带一条来源
    assert all(e.sources for e in report.evidence if e.content and e.content != "(检索失败)")
    assert report.status == ResearchStatus.DONE.value


async def test_gap_question_loop():
    """双向深度调查:基于已收集信息生成 gap 并再检索,直到无新 gap。"""
    # gap_returns: 第一轮返回 2 个追问,之后返回 [] → 循环应执行 1 轮后停止
    llm = _make_llm(["子问题1"], [["追问1", "追问2"]])
    report = await run_deep_research(
        "补缺口研究", sources=[FakeSource()], llm_complete_fn=llm, max_iterations=4
    )
    assert report.gap_questions == ["追问1", "追问2"]
    assert report.iteration == 1  # 只进入 1 轮追问(第 2 轮返回 [] 即停止)
    # 追问产生的新证据 depth >= 1
    depths = {e.depth for e in report.evidence}
    assert 1 in depths
    assert "deepening" in _report_stage_names(report)


async def test_report_structure_complete():
    """综合成稿:Markdown 含执行摘要/分节/引用来源,headings 抽取正确。"""
    md = (
        "# 执行摘要\n\n摘要内容。\n"
        "## 背景\n\n背景。\n## 主要发现\n\n发现。\n"
        "# 引用来源\n\n1. [A](https://example.com/a)"
    )
    llm = _make_llm(["子1"], [], synthesis_text=md)
    report = await run_deep_research(
        "结构化研究", sources=[FakeSource()], llm_complete_fn=llm, max_iterations=1
    )
    assert "执行摘要" in report.markdown
    assert "引用来源" in report.markdown
    assert "## 主要发现" in report.markdown
    assert "执行摘要" in report.headings
    assert report.status == ResearchStatus.DONE.value


async def test_max_iterations_stops_loop():
    """gap 每轮都返回新追问,循环必须被 max_iterations 限制中止。"""
    # 哨兵:gap 永远返回 -> 若未限流会无限循环
    async def _llm(messages):
        content = messages[-1]["content"]
        if "拆解成" in content:
            return json.dumps(["子1"], ensure_ascii=False)
        if "识别信息缺口" in content:
            return json.dumps(["追问X"], ensure_ascii=False)
        return "# 执行摘要\n结束。\n# 引用来源"

    report = await run_deep_research(
        "限流研究", sources=[FakeSource()], llm_complete_fn=_llm, max_iterations=3
    )
    assert report.iteration == 3
    assert report.status == ResearchStatus.DONE.value


async def test_retrieval_failure_degrades():
    """检索异常时降级为可用证据,仍能产出结构化报告(不抛错)。"""
    src = FakeSource()
    src.fail_search = True
    src.fail_fetch = True

    async def _llm(messages):
        content = messages[-1]["content"]
        if "拆解成" in content:
            return json.dumps(["子1"], ensure_ascii=False)
        if "识别信息缺口" in content:
            return "[]"
        return "# 执行摘要\n降级结论。\n# 引用来源"

    report = await run_deep_research(
        "失败降级研究", sources=[src], llm_complete_fn=_llm, max_iterations=1
    )
    assert report.status == ResearchStatus.DONE.value
    assert report.markdown  # 非空成稿
    # 检索失败时仍保留了含「(检索失败)」占位的证据,不阻断整体


async def test_synthesis_llm_failure_falls_back():
    """综合成稿阶段 LLM 抛错 → 用确定性模板降级,报告仍结构完整。"""
    async def _llm(messages):
        content = messages[-1]["content"]
        if "拆解成" in content:
            return json.dumps(["子1"], ensure_ascii=False)
        if "识别信息缺口" in content:
            return "[]"
        raise RuntimeError("成稿 LLM 挂了")

    report = await run_deep_research(
        "成稿降级研究", sources=[FakeSource()], llm_complete_fn=_llm, max_iterations=1
    )
    assert report.status == ResearchStatus.DONE.value
    assert "执行摘要" in report.markdown  # _fallback_synthesize 输出


def test_helpers_heading_and_url_dedup():
    """轻量纯函数:heading 抽取、URL 规范化、口径性断言。"""
    md = "# 标题A\n\n## 标题B\n\n正文\n### 标题C"
    assert _extract_headings(md) == ["标题A", "标题B", "标题C"]
    assert _dedupe_url("https://a.com/x/#frag") == "https://a.com/x/"


async def test_manager_start_get_resume():
    """进程内状态管理器:启动→查询→断点续跑命中。"""
    llm = _make_llm(["子1"], [])
    mgr = DeepResearchManager()
    run = mgr.start("课题X", llm, sources=[FakeSource()], max_iterations=1)
    got = mgr.get(run.research_id)
    assert got.research_id == run.research_id
    resumed = mgr.resume(run.research_id, llm)
    assert resumed is not None
    assert mgr.resume("dr_不存在", llm) is None
    # 等待后台完成后再取终态(报告应已写入)
    await run.task
    done = mgr.get(run.research_id)
    assert done.report is not None
    assert done.status == ResearchStatus.DONE


def test_fallback_synthesize_structure():
    """确定性降级成稿包含指定小节与引用。"""
    report = ResearchReport(research_id="x", query="q", status=ResearchStatus.DONE.value)
    report.sources.append(SourceRef(url="https://e.com/1", title="T"))
    md = _fallback_synthesize(report)
    assert "执行摘要" in md
    assert "引用来源" in md


# ---------------------------------------------------------------------------
# B. 来源分级 + 可信度标注
# ---------------------------------------------------------------------------

def test_grade_source_tiers():
    """来源分级:官方/权威 > 媒体 > 论坛/社区/个人 > 未知,置信度随档位递减。"""
    gov = grade_source("https://www.gov.cn/x/1")
    assert gov.tier == SourceTier.AUTHORITATIVE.value
    assert gov.verified is True and gov.confidence == 0.9

    media = grade_source("https://reuters.com/world/x")
    assert media.tier == SourceTier.MEDIA.value
    assert media.verified is True and media.confidence == 0.7

    community = grade_source("https://www.zhihu.com/question/1")
    assert community.tier == SourceTier.COMMUNITY.value
    assert community.verified is False  # UGC → 须标注,不得裸引

    unknown = grade_source("https://example.com/x")
    assert unknown.tier == SourceTier.UNKNOWN.value
    assert unknown.verified is False
    assert unknown.confidence == 0.25  # 未知档置信度最低


async def test_pipeline_grades_sources_and_low_credit_marking():
    """主管线:检索后的来源带分级;未知/低可信来源在 report 中被标注(非裸引)。"""
    # 关键断言:gov.cn(官方) + reuters(媒体) 双独立来源 → 高置信
    items = [
        ("https://www.gov.cn/stats", "政府部门", "官方统计"),
        ("https://reuters.com/news", "路透", "报道一致"),  # 无冲突词 → 多源印证
    ]
    async def _llm(messages):
        content = messages[-1]["content"]
        if "拆解成" in content:
            return json.dumps(["市场规模"], ensure_ascii=False)
        if "识别信息缺口" in content:
            return "[]"
        return "# 执行摘要\n结论。\n# 引用来源"

    report = await run_deep_research(
        "分级研究", sources=[MultiDomainSource(items)], llm_complete_fn=_llm, max_iterations=1
    )
    assert all(s.tier for s in report.sources)  # 每条来源都有分级
    tiers = {s.tier for s in report.sources}
    assert SourceTier.AUTHORITATIVE.value in tiers
    assert SourceTier.MEDIA.value in tiers
    # 该问题有官方+媒体两个独立来源且无冲突 → 多源印证
    einfo = report.crosscheck[0]
    assert einfo["verification"] == VerificationStatus.CORROBORATED.value
    assert einfo["independent_sources"] == 2
    assert report.limitations == []  # 双源一致 → 无需待核验


# ---------------------------------------------------------------------------
# C. 跨来源交叉核验:一致 / 单一 / 矛盾 / 无从核实
# ---------------------------------------------------------------------------

def _mk_report_with(evs):
    report = ResearchReport(research_id="x", query="q", status=ResearchStatus.DONE.value)
    report.evidence = list(evs)
    return report


def _mk_evidence(question, url_snippets, content="证据正文"):
    sources = []
    for url, (title, snip) in url_snippets.items():
        g = grade_source(url, title)
        g.snippet = snip
        sources.append(g)
    from app.services.deep_research import EvidenceUnit
    return EvidenceUnit(question=question, content=content, sources=sources)


def test_cross_check_three_cases():
    """交叉核验:一致(corroborated)/单一(single_source)/矛盾(conflicting)。"""
    # 1. 一致:两个独立来源、无冲突词 → 高置信
    r1 = _mk_report_with([
        _mk_evidence("Q多源一致", {
            "https://reuters.com/a": ("路透", "报告显示 2024 年增长 5%"),
            "https://apnews.com/b": ("美联社", "报告显示 2024 年增长 5%"),
        }),
    ])
    cross_check(r1)
    assert r1.crosscheck[0]["verification"] == VerificationStatus.CORROBORATED.value
    assert r1.crosscheck[0]["independent_sources"] == 2
    assert r1.limitations == []

    # 2. 单一:仅一个独立来源 → 待核验(进 limitations)
    r2 = _mk_report_with([
        _mk_evidence("Q单源", {
            "https://zhihu.com/z": ("知乎", "据个人分析存在争议说法"),
        }),
    ])
    cross_check(r2)
    assert r2.crosscheck[0]["verification"] == VerificationStatus.SINGLE_SOURCE.value
    assert "待核验" in r2.crosscheck[0]["note"]
    assert len(r2.limitations) == 1 and "Q单源" in r2.limitations[0]

    # 3. 矛盾:≥2 独立来源群各含冲突词 → 需核实(进 limitations)
    r3 = _mk_report_with([
        _mk_evidence("Q矛盾", {
            "https://example-x.com/1": ("甲报", "官方否认该说法"),
            "https://example-y.com/2": ("乙报", "机构驳斥传言"),
        }),
    ])
    cross_check(r3)
    assert r3.crosscheck[0]["verification"] == VerificationStatus.CONFLICTING.value
    assert "矛盾" in r3.crosscheck[0]["note"]
    assert len(r3.limitations) == 1 and "Q矛盾" in r3.limitations[0]


def test_cross_check_no_sources_unverified():
    """无从核实:来源为空时标为 unverified,不装作确定。"""
    from app.services.deep_research import EvidenceUnit
    r = _mk_report_with([EvidenceUnit(question="Q无源", content="(检索失败)")])
    cross_check(r)
    assert r.crosscheck[0]["verification"] == VerificationStatus.UNVERIFIED.value
    # unverified 不入 limitations(仅单源/矛盾需人工待核验)
    assert r.limitations == []


# ---------------------------------------------------------------------------
# D. 最终报告结构强化:序列化含分级引用 + 交叉核验 + 限制清单
# ---------------------------------------------------------------------------

def test_report_serialization_has_graded_fields():
    """to_dict 新增分级/核验/限制字段(向后兼容:旧字段仍在)。"""
    from app.services.deep_research import EvidenceUnit
    report = ResearchReport(research_id="x", query="q")
    report.sources.append(grade_source("https://www.zhihu.com/1", "UGC"))
    report.evidence.append(EvidenceUnit(question="Q", content="c", sources=report.sources))
    cross_check(report)
    d = report.to_dict()
    # 旧字段保留
    for key in ("research_id", "query", "status", "evidence", "sources", "markdown"):
        assert key in d
    # 新字段:来源分级 + 核验 + 限制
    assert d["sources"][0]["tier"] == SourceTier.COMMUNITY.value
    assert d["sources"][0]["verified"] is False
    assert d["sources"][0]["confidence"] == 0.4
    assert "verification" in d["evidence"][0]
    assert isinstance(d["verifications"], list)
    assert isinstance(d["limitations"], list)


def test_fallback_synthesize_has_grading_and_verification_sections():
    """降级成稿含『引用分级』与『限制与待核验』小节。"""
    from app.services.deep_research import EvidenceUnit
    report = ResearchReport(research_id="x", query="q", status=ResearchStatus.DONE.value)
    g = grade_source("https://zhihu.com/1", "UGC")
    report.sources.append(g)
    report.evidence.append(EvidenceUnit(question="单源", content="c", sources=[g]))
    cross_check(report)
    md = _fallback_synthesize(report)
    assert "引用分级" in md
    assert "限制与待核验" in md
    assert "待核验" in md


# ---------------------------------------------------------------------------
# E. 可注入 LLM 交叉核验(factcheck_llm_fn):启发式兜底 + LLM 语义增强双路径
# ---------------------------------------------------------------------------

def _dual_source_report_llm():
    """构造『双独立来源、无冲突词』→ 启发式判 corroborated;synthesis 返回固定 Markdown。"""
    items = [
        ("https://reuters.com/a", "路透", "报告显示 2024 年增长 5%"),
        ("https://apnews.com/b", "美联社", "报告显示 2024 年增长 5%"),
    ]

    async def _llm(messages):
        content = messages[-1]["content"]
        if "拆解成" in content:
            return json.dumps(["市场规模"], ensure_ascii=False)
        if "识别信息缺口" in content:
            return "[]"
        return "# 执行摘要\n结论。\n# 引用来源"

    return items, _llm


async def test_factcheck_llm_overrides_heuristic():
    """注入 LLM:即便启发式判多源印证,也优先采用 LLM 语义判定(冲突)。

    覆盖后 crosscheck 带 source=llm / reason / confidence。
    """
    items, _llm = _dual_source_report_llm()

    async def _fact_llm(pairs):
        return [
            {
                "question": pairs[0]["question"],
                "conclusion": VerificationStatus.CONFLICTING.value,
                "reason": "两来源口径不一致(语义冲突)",
                "confidence": 0.85,
            }
        ]

    report = await run_deep_research(
        "分级研究",
        sources=[MultiDomainSource(items)],
        llm_complete_fn=_llm,
        max_iterations=1,
        factcheck_llm_fn=_fact_llm,
    )
    f = report.crosscheck[0]
    assert f["verification"] == VerificationStatus.CONFLICTING.value  # LLM 判定覆盖启发式
    assert f["source"] == "llm"
    assert "语义冲突" in f["reason"]
    assert f["confidence"] == 0.85
    # 覆盖后 limitations 反映 LLM 判定(矛盾 → 进待核验清单)
    assert any("市场规模" in lim and "矛盾" in lim for lim in report.limitations)
    # 证据级 verification 同步为 LLM 判定
    assert all(e.verification == VerificationStatus.CONFLICTING.value for e in report.evidence)


async def test_factcheck_llm_exception_falls_back():
    """LLM 交叉核验抛异常 → 静默回退启发式,报告结论与状态不受影响(不炸管线)。"""
    items, _llm = _dual_source_report_llm()

    async def _fact_llm(pairs):
        raise RuntimeError("factcheck LLM 超时")

    report = await run_deep_research(
        "分级研究",
        sources=[MultiDomainSource(items)],
        llm_complete_fn=_llm,
        max_iterations=1,
        factcheck_llm_fn=_fact_llm,
    )
    assert report.status == ResearchStatus.DONE.value
    f = report.crosscheck[0]
    # 启发式结论保留(corroborated),无 LLM 标记
    assert f["verification"] == VerificationStatus.CORROBORATED.value
    assert "source" not in f
    assert report.limitations == []


async def test_factcheck_llm_malformed_safe():
    """LLM 返回畸形(非列表/条目非法)→ 静默跳过,启发式保留,安全稳定。"""
    items, _llm = _dual_source_report_llm()

    async def _fact_llm(pairs):
        return "这不是一个列表"  # 非列表 → 整包回退启发式

    report = await run_deep_research(
        "分级研究",
        sources=[MultiDomainSource(items)],
        llm_complete_fn=_llm,
        max_iterations=1,
        factcheck_llm_fn=_fact_llm,
    )
    assert report.status == ResearchStatus.DONE.value
    assert report.crosscheck[0]["verification"] == VerificationStatus.CORROBORATED.value
    assert "source" not in report.crosscheck[0]


async def test_factcheck_llm_partial_malformed_skips_bad():
    """LLM 返回列表但含畸形条目 → 只采纳合法条目,畸形条目影响的启发式结论不受破坏。"""
    items, _llm = _dual_source_report_llm()

    async def _fact_llm(pairs):
        # 第 1 条合法(覆盖为 single_source),第 2 条畸形(非法 conclusion) → 应被跳过
        return [
            {
                "question": "市场规模",
                "conclusion": "single_source",
                "reason": "LLM 认为资料不足",
                "confidence": 0.6,
            },
            {
                "question": "市场规模",
                "conclusion": "not_a_status",
                "reason": "非法",
                "confidence": 0.5,
            },
        ]

    report = await run_deep_research(
        "分级研究",
        sources=[MultiDomainSource(items)],
        llm_complete_fn=_llm,
        max_iterations=1,
        factcheck_llm_fn=_fact_llm,
    )
    f = report.crosscheck[0]
    assert f["verification"] == VerificationStatus.SINGLE_SOURCE.value  # 仅合法条目生效
    assert f["source"] == "llm"
    assert "待核验" in f["note"]


async def test_factcheck_llm_unknown_question_ignored():
    """LLM 返回的 question 与任何证据不匹配 → 该判定被忽略,启发式保留。"""
    items, _llm = _dual_source_report_llm()

    async def _fact_llm(pairs):
        return [
            {
                "question": "完全不存在的断言",
                "conclusion": "conflicting",
                "reason": "x",
                "confidence": 0.9,
            }
        ]

    report = await run_deep_research(
        "分级研究",
        sources=[MultiDomainSource(items)],
        llm_complete_fn=_llm,
        max_iterations=1,
        factcheck_llm_fn=_fact_llm,
    )
    f = report.crosscheck[0]
    assert f["verification"] == VerificationStatus.CORROBORATED.value  # 无匹配 → 启发式保留
    assert "source" not in f
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
