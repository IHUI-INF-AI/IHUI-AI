#!/usr/bin/env python3
"""多租户压测报告生成器测试 - loadtest_report_gen.py

验证项:
1. 脚本存在
2. 3 个子命令: report / compare / trend
3. HTML 报告生成
4. Markdown 报告生成
5. 报告对比
6. 趋势分析
7. 报告查找
8. 性能回归检测
"""
import os
import sys
import json
import subprocess
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPT = SERVER_DIR / "scripts" / "loadtest_report_gen.py"
LOG_DIR = SERVER_DIR / "logs"

passed = 0
failed = 0


def test_case(name: str, ok: bool, detail: str = "") -> None:
    global passed, failed
    if ok:
        passed += 1
        print(f"  ✅ {name}")
    else:
        failed += 1
        print(f"  ❌ {name} -- {detail}")


def run_script(*args: str, timeout: int = 30) -> tuple[int, str, str]:
    proc = subprocess.run(
        [sys.executable, str(SCRIPT), *args],
        capture_output=True, text=True, encoding="utf-8",
        cwd=str(SERVER_DIR), timeout=timeout,
    )
    return proc.returncode, proc.stdout, proc.stderr


def main() -> int:
    print("=" * 60)
    print("P1-6 多租户压测报告生成器测试")
    print("=" * 60)

    test_case("脚本存在", SCRIPT.exists(), str(SCRIPT))
    content = SCRIPT.read_text(encoding="utf-8")

    # 3 子命令
    for cmd in ["report", "compare", "trend"]:
        test_case(f"子命令 {cmd}", f'"{cmd}"' in content or f"cmd_{cmd}" in content, f"缺少 {cmd}")

    # 函数
    funcs = ["load_report", "find_latest_reports", "generate_html_report", "generate_markdown_report", "compare_reports"]
    for fn in funcs:
        test_case(f"函数 {fn}", f"def {fn}(" in content, f"缺少 {fn}")

    # HTML 报告特性
    test_case("HTML 模板", "<!DOCTYPE html>" in content or "DOCTYPE" in content, "")
    test_case("HTML 含表格", "<table" in content, "")
    test_case("HTML 含 CSS", "style" in content and "background" in content, "")

    # Markdown 报告特性
    test_case("Markdown 表格", "|" in content and "---" in content, "")

    # 对比
    test_case("对比逻辑", "compare_reports" in content and "diff" in content, "")
    test_case("P95 回归阈值", "p95_regression" in content, "")
    test_case("QPS 回归阈值", "qps_regression" in content, "")

    # 趋势
    test_case("趋势分析", "trend" in content, "")
    test_case("天数参数", "--days" in content, "")

    # 准备测试数据
    test_data = {
        "operation": "tenant_loadtest",
        "timestamp": "2026-06-18T03:00:00+00:00",
        "mode": "concurrent",
        "tenants": ["zhs", "demo", "test"],
        "concurrency": 20,
        "requests_per_tenant": 100,
        "stats": {
            "total_requests": 300,
            "success_count": 295,
            "success_rate": 98.33,
            "slow_count": 5,
            "slow_rate": 1.67,
            "duration_seconds": 1.5,
            "qps": 200.0,
            "latency_ms": {
                "min": 0.5,
                "max": 100.0,
                "avg": 5.0,
                "median": 4.0,
                "p95": 25.0,
                "p99": 50.0,
            },
            "per_tenant": {
                "zhs": {"count": 100, "avg_latency_ms": 5.0, "p95_latency_ms": 25.0, "slow_count": 2},
                "demo": {"count": 100, "avg_latency_ms": 4.5, "p95_latency_ms": 20.0, "slow_count": 2},
                "test": {"count": 100, "avg_latency_ms": 5.5, "p95_latency_ms": 30.0, "slow_count": 1},
            },
        },
    }
    test_input = LOG_DIR / "tenant_loadtest_test_20260618_030000.json"
    test_input.write_text(json.dumps(test_data, ensure_ascii=False), encoding="utf-8")

    # report 子命令
    code, out, err = run_script("report", "--input", str(test_input), "--format", "html")
    test_case("report html 执行", code == 0, f"code={code}, stderr={err[:200]}")

    code, out, err = run_script("report", "--input", str(test_input), "--format", "md")
    test_case("report md 执行", code == 0, f"code={code}")

    code, out, err = run_script("report", "--input", str(test_input), "--format", "all")
    test_case("report all 执行", code == 0, f"code={code}")

    # 报告文件
    html_reports = list((LOG_DIR / "loadtest_reports").glob("report_*.html"))
    md_reports = list((LOG_DIR / "loadtest_reports").glob("report_*.md"))
    test_case("生成 HTML 报告", len(html_reports) > 0, "")
    test_case("生成 Markdown 报告", len(md_reports) > 0, "")

    # HTML 报告内容
    if html_reports:
        html_content = html_reports[-1].read_text(encoding="utf-8")
        test_case("HTML 含 DOCTYPE", "<!DOCTYPE html>" in html_content, "")
        test_case("HTML 含多租户", "zhs" in html_content and "demo" in html_content, "")
        test_case("HTML 含 QPS", "QPS" in html_content, "")

    # Markdown 报告内容
    if md_reports:
        md_content = md_reports[-1].read_text(encoding="utf-8")
        test_case("MD 含表格", "|" in md_content, "")
        test_case("MD 含 QPS", "QPS" in md_content, "")

    # 准备对比数据
    baseline_data = dict(test_data)
    baseline_data["stats"] = dict(test_data["stats"])
    baseline_data["stats"]["qps"] = 250.0  # 之前更快
    baseline_data["stats"]["latency_ms"] = dict(test_data["stats"]["latency_ms"])
    baseline_data["stats"]["latency_ms"]["p95"] = 15.0

    current_data = dict(test_data)
    current_data["stats"] = dict(test_data["stats"])
    current_data["stats"]["qps"] = 200.0
    current_data["stats"]["latency_ms"] = dict(test_data["stats"]["latency_ms"])
    current_data["stats"]["latency_ms"]["p95"] = 25.0

    baseline_file = LOG_DIR / "tenant_loadtest_baseline.json"
    current_file = LOG_DIR / "tenant_loadtest_current.json"
    baseline_file.write_text(json.dumps(baseline_data, ensure_ascii=False), encoding="utf-8")
    current_file.write_text(json.dumps(current_data, ensure_ascii=False), encoding="utf-8")

    # compare 子命令
    code, out, err = run_script(
        "compare",
        "--baseline", str(baseline_file),
        "--current", str(current_file),
    )
    test_case("compare 执行", code in (0, 1), f"code={code}")  # 可能有回归所以 code=1
    test_case("compare 输出 diff", "p95_change" in out, "")
    test_case("compare 检测回归", "p95_regression" in out, "")

    # trend 子命令
    code, out, err = run_script("trend", "--directory", str(LOG_DIR), "--days", "7")
    test_case("trend 执行", code == 0, f"code={code}")

    # 无效子命令
    code, out, err = run_script()
    test_case("无子命令被拒绝", code != 0, f"code={code}")

    # 无效输入
    code, out, err = run_script("report", "--input", "nonexistent.json")
    test_case("无效输入被拒绝", code != 0, f"code={code}")

    # 清理测试数据
    for f in [test_input, baseline_file, current_file]:
        if f.exists():
            f.unlink()

    print("=" * 60)
    print(f"通过: {passed} / 失败: {failed}")
    print("=" * 60)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
