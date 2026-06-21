#!/usr/bin/env python3
"""多租户压测脚本测试 - tenant_loadtest.py

验证项:
1. 脚本存在
2. 参数: --mode / --tenants / --concurrency / --requests / --max-latency / --dry-run / --report
3. 2 种压测模式: sequential / concurrent
4. 并发压测执行
5. 顺序压测执行
6. 延迟统计 (min/max/avg/median/p95/p99)
7. 每租户统计
8. JSON 报告生成
9. dry-run 模式
10. 性能阈值告警
11. 慢请求检测
12. QPS 计算
"""
import os
import sys
import json
import subprocess
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPT = SERVER_DIR / "scripts" / "tenant_loadtest.py"
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


def run_script(*args: str, timeout: int = 60) -> tuple[int, str, str]:
    proc = subprocess.run(
        [sys.executable, str(SCRIPT), *args],
        capture_output=True,
        text=True,
        encoding="utf-8",
        cwd=str(SERVER_DIR),
        timeout=timeout,
    )
    return proc.returncode, proc.stdout, proc.stderr


def main() -> int:
    print("=" * 60)
    print("P1-5 多租户压测脚本测试")
    print("=" * 60)

    test_case("脚本存在", SCRIPT.exists(), str(SCRIPT))
    content = SCRIPT.read_text(encoding="utf-8")

    # 关键参数
    for p in ["--mode", "--tenants", "--concurrency", "--requests", "--max-latency", "--dry-run", "--report"]:
        test_case(f"参数 {p}", p in content, f"缺少 {p}")

    # 2 种模式
    test_case("sequential 模式", '"sequential"' in content, "")
    test_case("concurrent 模式", '"concurrent"' in content, "")

    # 关键函数
    funcs = ["simulate_tenant_request", "run_sequential", "run_concurrent", "analyze_results"]
    for fn in funcs:
        test_case(f"函数 {fn}", f"def {fn}(" in content, f"缺少 {fn}")

    # 延迟统计
    for stat in ["min", "max", "avg", "median", "p95", "p99"]:
        test_case(f"延迟统计 {stat}", stat in content, f"缺少 {stat}")

    # statistics 库
    test_case("使用 statistics 库", "import statistics" in content, "")

    # ThreadPoolExecutor
    test_case("使用 ThreadPoolExecutor", "ThreadPoolExecutor" in content, "")

    # JSON 报告
    test_case("JSON 报告生成", "LOADTEST_REPORT" in content, "")
    test_case("JSON 含 operation", '"operation":' in content, "")
    test_case("JSON 含 stats", '"stats":' in content, "")

    # QPS / 慢请求
    test_case("QPS 计算", "qps" in content, "")
    test_case("慢请求检测", "is_slow" in content and "slow_count" in content, "")

    # dry-run
    code, out, err = run_script("--dry-run")
    test_case("dry-run 执行", code == 0, f"code={code}")

    # 顺序压测
    code, out, err = run_script(
        "--mode", "sequential",
        "--tenants", "zhs",
        "--requests", "20",
        "--report",
        timeout=30,
    )
    test_case("顺序压测执行", code == 0, f"code={code}")
    test_case("输出总请求数", "总请求" in out or "total_requests" in out, "")
    test_case("输出 QPS", "QPS" in out, "")

    # 并发压测
    code, out, err = run_script(
        "--mode", "concurrent",
        "--tenants", "zhs,demo,test",
        "--concurrency", "10",
        "--requests", "30",
        "--max-latency", "50",
        timeout=30,
    )
    test_case("并发压测执行", code in (0, 1), f"code={code}")
    test_case("并发输出 P95", "P95" in out, "")

    # 报告文件
    report_files = list(LOG_DIR.glob("tenant_loadtest_*.json"))
    test_case("生成 JSON 报告", len(report_files) > 0, "")

    if report_files:
        latest = max(report_files, key=lambda p: p.stat().st_mtime)
        try:
            data = json.loads(latest.read_text(encoding="utf-8"))
            test_case("报告含 operation", "operation" in data, "")
            test_case("报告含 mode", "mode" in data, "")
            test_case("报告含 tenants", "tenants" in data, "")
            test_case("报告含 stats", "stats" in data, "")
            stats = data.get("stats", {})
            test_case("stats 含 total_requests", "total_requests" in stats, "")
            test_case("stats 含 latency_ms", "latency_ms" in stats, "")
            test_case("stats 含 per_tenant", "per_tenant" in stats, "")
        except json.JSONDecodeError as e:
            test_case("报告 JSON 可解析", False, str(e))

    # 无效租户
    code, out, err = run_script("--tenants", "invalid_tenant")
    test_case("无效租户被拒绝", code != 0, f"code={code}")

    # 无效模式
    code, out, err = run_script("--mode", "invalid_mode")
    test_case("无效模式被拒绝", code != 0, f"code={code}")

    # 慢请求阈值告警
    code, out, err = run_script(
        "--mode", "sequential",
        "--tenants", "zhs",
        "--requests", "10",
        "--max-latency", "1",
        timeout=30,
    )
    test_case("慢请求阈值触发告警", code != 0 or "超过阈值" in out, "")

    print("=" * 60)
    print(f"通过: {passed} / 失败: {failed}")
    print("=" * 60)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
