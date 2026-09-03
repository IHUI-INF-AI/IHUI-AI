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
    _dedupe_url,
    _extract_headings,
    _fallback_synthesize,
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
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
