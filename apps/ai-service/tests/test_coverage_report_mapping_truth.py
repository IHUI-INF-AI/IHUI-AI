# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""覆盖探测报告的现役映射真值必须与 live 源码一致(2026-11-24)。

历史报告 docs/connectors/coverage-report-2026-11-24.json 的 tables.http_fallback 是
修复前快照(404/405→unsupported)。报告已加 current_code_truth 块镜像 live _HTTP_MAP;
本测试钉住两者逐字相等 —— 将来任何人重生成报告若把现役映射改回旧值,这里立刻红,
不靠人肉记得"那张表是旧的"。不验证平台业务码语义(仓库无权威文档、抽样未命中)。
"""
import json
from pathlib import Path

from app.services.connectors import coverage_probe

REPORT = Path(__file__).resolve().parents[3] / "docs/connectors/coverage-report-2026-11-24.json"


def test_report_current_http_map_matches_live_source():
    report = json.loads(REPORT.read_text(encoding="utf-8"))
    truth = report["mapping"]["current_code_truth"]
    live = {str(k): v for k, v in coverage_probe._HTTP_MAP.items()}
    assert truth["http_fallback"] == live
    # 修复前的旧映射仍在 tables 里作为历史快照,但必须标注,不能被误读为现役
    assert "修复前快照" in report["mapping"]["tables_status"]
    assert report["mapping"]["tables"]["http_fallback"]["404"] == "unsupported"  # 历史值保留
    assert truth["http_fallback"]["404"] == "error"  # 现役值已纠正


def test_mutation_lock_stale_report_is_detected():
    """变异锁:把报告现役映射改回旧 unsupported ⇒ live 对拍必须失败。"""
    report = json.loads(REPORT.read_text(encoding="utf-8"))
    live = {str(k): v for k, v in coverage_probe._HTTP_MAP.items()}
    mutated = json.loads(json.dumps(report))
    mutated["mapping"]["current_code_truth"]["http_fallback"]["404"] = "unsupported"
    assert mutated["mapping"]["current_code_truth"]["http_fallback"] != live
