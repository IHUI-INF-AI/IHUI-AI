"""Grafana dashboard 集成测试 (任务 69).

覆盖:
  - 4 个 dashboard JSON 文件存在且 JSON 合法
  - 每个 dashboard 含必备 Grafana 字段
  - 指标名匹配代码中实际定义 (zhs_biz_*) 防止 dashboard 与代码漂移
  - uid 唯一, panel id 在 dashboard 内唯一
  - 建议 91: 新增 panel (Top 10 慢 SQL + DB pool trend) 存在且 PromQL 正确
  - 建议 91: 指标 zhs_slow_sql_with_trace_total / zhs_db_pool_* 在 monitoring.py 中已定义
"""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DASH_DIR = ROOT / "deploy" / "grafana" / "dashboards"
METRICS_FILE = ROOT / "app" / "metrics_business.py"
MONITORING_FILE = ROOT / "app" / "monitoring.py"


def _load_dashboards():
    return {f.name: json.loads(f.read_text(encoding="utf-8")) for f in DASH_DIR.glob("*.json")}


def test_dashboards_directory_has_all_required_files():
    """4 个 dashboard 全部存在."""
    required = {
        "zhs_biz_overview.json",
        "zhs_hls.json",
        "zhs_cache.json",
        "zhs_ws.json",
    }
    actual = {f.name for f in DASH_DIR.glob("*.json")}
    missing = required - actual
    assert not missing, f"缺失 dashboard: {missing}"


def test_dashboards_have_valid_grafana_schema():
    """每个 dashboard 必备 Grafana 8 字段齐全."""
    for name, d in _load_dashboards().items():
        for key in ("title", "uid", "panels", "schemaVersion", "tags", "templating", "time", "refresh"):
            assert key in d, f"{name}: 缺字段 {key}"
        assert d["uid"].startswith("zhs-"), f"{name}: uid 应以 zhs- 开头, 实际 {d['uid']}"
        assert isinstance(d["panels"], list) and d["panels"], f"{name}: panels 非空"
        # 每 panel 必有 id/type/title/gridPos/datasource
        for p in d["panels"]:
            for k in ("id", "type", "title", "gridPos", "datasource"):
                assert k in p, f"{name}: panel 缺 {k}"


def test_dashboard_uids_and_panel_ids_unique():
    """uid 全局唯一, 每个 dashboard 内部 panel id 不重复."""
    uids = []
    for name, d in _load_dashboards().items():
        uid = d["uid"]
        assert uid not in uids, f"uid 重复: {uid}"
        uids.append(uid)
        panel_ids = [p["id"] for p in d["panels"]]
        assert len(panel_ids) == len(set(panel_ids)), f"{name}: panel id 重复 {panel_ids}"


def test_dashboards_promql_matches_business_metrics_code():
    """Dashboard 引用的 PromQL 指标名必须在 app/metrics_business.py 实际定义, 防止 dashboard 与代码漂移."""
    # 1. 从 metrics_business.py 抓所有 prometheus_client.Counter/Gauge/Histogram 的第一个位置参数 (即指标名)
    code = METRICS_FILE.read_text(encoding="utf-8")
    defined = set(re.findall(r'(?:Counter|Gauge|Histogram)\(\s*"([a-z_0-9]+)"', code))
    assert defined, "未在 metrics_business.py 中找到任何指标定义"
    # 2. 从所有 dashboard JSON 中抓取 zhs_biz_* 引用 (含数字)
    used = set()
    for d in _load_dashboards().values():
        for panel in d["panels"]:
            for tgt in panel.get("targets", []) or []:
                for m in re.findall(r"(zhs_biz_[a-z_0-9]+)", tgt.get("expr", "")):
                    # 去掉 _bucket / _sum / _count 后缀 (Histogram 自动生成)
                    base = re.sub(r"_(bucket|sum|count)$", "", m)
                    used.add(base)
    # 3. 所有 used 必须在 defined 中
    undefined = used - defined
    assert not undefined, f"Dashboard 引用了未定义的指标: {undefined}"


# ---------------------------------------------------------------------------
# 建议 91: 新 panel (Top 10 慢 SQL + DB pool trend) 测试
# ---------------------------------------------------------------------------


def test_biz_overview_has_slow_sql_panel():
    """zhs_biz_overview 应新增 Top 10 慢 SQL panel."""
    d = json.loads((DASH_DIR / "zhs_biz_overview.json").read_text(encoding="utf-8"))
    titles = [p["title"] for p in d["panels"]]
    assert any("Top 10 慢 SQL" in t for t in titles), f"缺慢 SQL panel, 现有: {titles}"


def test_biz_overview_has_db_pool_panel():
    """zhs_biz_overview 应新增 DB pool trend panel."""
    d = json.loads((DASH_DIR / "zhs_biz_overview.json").read_text(encoding="utf-8"))
    titles = [p["title"] for p in d["panels"]]
    assert any("DB 连接池" in t for t in titles), f"缺 DB pool panel, 现有: {titles}"


def test_slow_sql_panel_promql_uses_slow_sql_with_trace():
    """慢 SQL panel PromQL 应引用 zhs_slow_sql_with_trace_total."""
    d = json.loads((DASH_DIR / "zhs_biz_overview.json").read_text(encoding="utf-8"))
    slow_panels = [p for p in d["panels"] if "Top 10 慢 SQL" in p.get("title", "")]
    assert slow_panels, "慢 SQL panel 不存在"
    exprs = [t["expr"] for p in slow_panels for t in p.get("targets", [])]
    assert any(
        "zhs_slow_sql_with_trace_total" in e for e in exprs
    ), f"慢 SQL panel 应引用 zhs_slow_sql_with_trace_total, 实际 exprs: {exprs}"


def test_db_pool_panel_promql_uses_pool_metrics():
    """DB pool panel PromQL 应引用 zhs_db_pool_in_use / zhs_db_pool_size."""
    d = json.loads((DASH_DIR / "zhs_biz_overview.json").read_text(encoding="utf-8"))
    pool_panels = [p for p in d["panels"] if "DB 连接池" in p.get("title", "")]
    assert pool_panels, "DB pool panel 不存在"
    exprs = [t["expr"] for p in pool_panels for t in p.get("targets", [])]
    assert any("zhs_db_pool_in_use" in e for e in exprs), f"缺 in_use 指标, exprs: {exprs}"
    assert any("zhs_db_pool_size" in e for e in exprs), f"缺 size 指标, exprs: {exprs}"


def test_new_panels_promql_matches_monitoring_metrics():
    """新 panel 引用指标必须在 monitoring.py 实际定义."""
    code = MONITORING_FILE.read_text(encoding="utf-8")
    defined = set(re.findall(r'(?:Counter|Gauge|Histogram)\(\s*"([a-z_0-9]+)"', code))
    used = set()
    d = json.loads((DASH_DIR / "zhs_biz_overview.json").read_text(encoding="utf-8"))
    for panel in d["panels"]:
        if "Top 10 慢 SQL" not in panel.get("title", "") and "DB 连接池" not in panel.get("title", ""):
            continue
        for tgt in panel.get("targets", []) or []:
            for m in re.findall(r"(zhs_[a-z_0-9]+)", tgt.get("expr", "")):
                used.add(m)
    undefined = used - defined
    assert not undefined, f"新 panel 引用了未在 monitoring.py 定义的指标: {undefined}"


def test_new_panels_have_unique_ids():
    """新增 panel id 不能与现有冲突."""
    d = json.loads((DASH_DIR / "zhs_biz_overview.json").read_text(encoding="utf-8"))
    ids = [p["id"] for p in d["panels"]]
    assert 7 in ids, f"应含 id=7 (Top 10 慢 SQL), 实际: {ids}"
    assert 8 in ids, f"应含 id=8 (DB pool), 实际: {ids}"
    assert len(ids) == len(set(ids)), f"panel id 重复: {ids}"


def test_helm_dashboards_synced_with_source():
    """helm chart 内的 dashboard 应与源同步 (sync 脚本应已运行)."""
    src = json.loads((DASH_DIR / "zhs_biz_overview.json").read_text(encoding="utf-8"))
    helm = json.loads(
        (ROOT / "deploy" / "helm" / "zhs-platform" / "dashboards" / "zhs_biz_overview.json").read_text(encoding="utf-8")
    )
    assert len(src["panels"]) == len(
        helm["panels"]
    ), f"panel 数量不同步: src={len(src['panels'])} helm={len(helm['panels'])}"
    # 新增的 panel id 在两边都存在
    src_ids = {p["id"] for p in src["panels"]}
    helm_ids = {p["id"] for p in helm["panels"]}
    assert src_ids == helm_ids, f"panel id 集合不同步: src-src helm={src_ids ^ helm_ids}"


# ---------------------------------------------------------------------------
# 建议 94: dashboard 联动 (links + template variables)
# ---------------------------------------------------------------------------


def test_biz_overview_has_trace_backend_template():
    """建议 94: dashboard 应有 DS_TEMPO template variable."""
    d = json.loads((DASH_DIR / "zhs_biz_overview.json").read_text(encoding="utf-8"))
    names = [v["name"] for v in d.get("templating", {}).get("list", [])]
    assert "DS_TEMPO" in names, f"缺 DS_TEMPO 模板变量, 现有: {names}"


def test_biz_overview_has_service_name_template():
    """建议 94: dashboard 应有 ZHS_SERVICE_NAME 模板变量."""
    d = json.loads((DASH_DIR / "zhs_biz_overview.json").read_text(encoding="utf-8"))
    names = [v["name"] for v in d.get("templating", {}).get("list", [])]
    assert "ZHS_SERVICE_NAME" in names, f"缺 ZHS_SERVICE_NAME, 现有: {names}"


def test_biz_overview_top_level_links():
    """建议 94: dashboard 顶层 links 应含 trace 后端跳转链接."""
    d = json.loads((DASH_DIR / "zhs_biz_overview.json").read_text(encoding="utf-8"))
    links = d.get("links", [])
    assert links, "应含顶层 links 数组"
    titles = [l.get("title", "") for l in links]
    assert any("Trace" in t for t in titles), f"顶层 links 应含 Trace 入口, 实际: {titles}"
    # 至少一个 link targetBlank=True (新窗口打开)
    assert any(l.get("targetBlank") for l in links), "应至少一个 link 在新窗口打开"


def test_slow_sql_panel_has_data_link():
    """建议 94: 慢 SQL panel 应含 links 配置 (点击跳转 trace)."""
    d = json.loads((DASH_DIR / "zhs_biz_overview.json").read_text(encoding="utf-8"))
    slow_panels = [p for p in d["panels"] if "Top 10 慢 SQL" in p.get("title", "")]
    assert slow_panels, "慢 SQL panel 不存在"
    p = slow_panels[0]
    assert p.get("links"), f"慢 SQL panel 应含 links, 实际 keys: {list(p.keys())}"
    link = p["links"][0]
    # URL 应引用 ${DS_TEMPO} 和 ${ZHS_SERVICE_NAME}
    url = link.get("url", "")
    assert "${DS_TEMPO}" in url, f"URL 应引用 ${{DS_TEMPO}}, 实际: {url}"
    assert "${ZHS_SERVICE_NAME}" in url, f"URL 应引用 ${{ZHS_SERVICE_NAME}}, 实际: {url}"


def test_slow_sql_link_url_uses_traceql():
    """建议 94: 慢 SQL panel link URL 应使用 TraceQL 查询 (Tempo 语法)."""
    d = json.loads((DASH_DIR / "zhs_biz_overview.json").read_text(encoding="utf-8"))
    slow_panels = [p for p in d["panels"] if "Top 10 慢 SQL" in p.get("title", "")]
    assert slow_panels
    url = slow_panels[0]["links"][0]["url"]
    # TraceQL 查询: {service.name="..."} 或 queryType=traceql
    assert "service.name=" in url or "traceql" in url, f"URL 应是 TraceQL 语法, 实际: {url}"


def test_helm_dashboard_synced_with_links():
    """建议 94: helm chart 内的 dashboard 也要含 links 配置."""
    helm = json.loads(
        (ROOT / "deploy" / "helm" / "zhs-platform" / "dashboards" / "zhs_biz_overview.json").read_text(encoding="utf-8")
    )
    assert helm.get("links"), "helm dashboard 应含顶层 links"
    slow_panels = [p for p in helm["panels"] if "Top 10 慢 SQL" in p.get("title", "")]
    assert slow_panels and slow_panels[0].get("links"), "helm 慢 SQL panel 应含 links"
