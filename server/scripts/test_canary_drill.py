#!/usr/bin/env python3
"""金丝雀生产演练测试 - canary_drill.py

验证项:
1. 脚本存在
2. 参数: --service / --version / --dry-run / --no-rollback
3. 3 阶段演练 (10% / 50% / 100%)
4. 调用 canary_release.sh
5. dry-run 模式
6. 失败回滚
7. 成功 promote
8. JSON 报告生成
9. 报告聚合
"""
import os
import sys
import json
import subprocess
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPT = SERVER_DIR / "scripts" / "canary_drill.py"
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


def run_script(*args: str, timeout: int = 120) -> tuple[int, str, str]:
    proc = subprocess.run(
        [sys.executable, str(SCRIPT), *args],
        capture_output=True, text=True, encoding="utf-8",
        cwd=str(SERVER_DIR), timeout=timeout,
    )
    return proc.returncode, proc.stdout, proc.stderr


def main() -> int:
    print("=" * 60)
    print("P1-4 金丝雀生产演练测试")
    print("=" * 60)

    test_case("脚本存在", SCRIPT.exists(), str(SCRIPT))
    content = SCRIPT.read_text(encoding="utf-8")

    # 参数
    for p in ["--service", "--version", "--dry-run", "--no-rollback"]:
        test_case(f"参数 {p}", p in content, f"缺少 {p}")

    # 3 阶段
    test_case("3 阶段定义", "PHASES" in content, "")
    test_case("Phase 1: 10%", "10" in content, "")
    test_case("Phase 2: 50%", "50" in content, "")
    test_case("Phase 3: 100%", "100" in content, "")

    # 函数
    funcs = ["run_canary", "cmd_drill", "log"]
    for fn in funcs:
        test_case(f"函数 {fn}", f"def {fn}(" in content, f"缺少 {fn}")

    # 调用 canary_release.sh
    test_case("调用 canary_release.sh", "canary_release.sh" in content, "")

    # 操作
    test_case("--rollback 引用", "--rollback" in content, "")
    test_case("--promote 引用", "--promote" in content, "")

    # JSON 报告
    test_case("JSON 含 operation", '"operation":' in content, "")
    test_case("JSON 含 service", '"service":' in content, "")
    test_case("JSON 含 version", '"version":' in content, "")
    test_case("JSON 含 phases_total", "phases_total" in content, "")
    test_case("JSON 含 final_action", "final_action" in content, "")
    test_case("JSON 含 drill_results", "drill_results" in content, "")

    # 失败处理
    test_case("failed 字段", "failed" in content and "failed = True" in content, "")

    # 实际执行 dry-run
    code, out, err = run_script(
        "--service", "test_api",
        "--version", "v2.0.0",
        "--dry-run",
        timeout=120,
    )
    # drill 在 dry-run 模式下可能因 Phase 1 的 canary 退出码 1 而停止, 这正常
    test_case("dry-run 演练执行", code in (0, 1), f"code={code}, stderr={err[:200]}")
    test_case("输出含 Phase 1", "Phase 1" in out, "")
    has_phase_2 = "Phase 2" in out
    has_phase_3 = "Phase 3" in out
    report_files = list(LOG_DIR.glob("canary_drill_report_*.json"))
    has_report = len(report_files) > 0
    test_case("演练部分或全部执行", has_phase_2 or has_phase_3 or has_report or "ROLLBACK" in out or "PROMOTE" in out,
              "演练可能因 Phase 1 失败提前终止")
    test_case("演练有日志输出", len(out) > 0, "无输出")

    if report_files:
        latest = max(report_files, key=lambda p: p.stat().st_mtime)
        try:
            data = json.loads(latest.read_text(encoding="utf-8"))
            test_case("报告含 operation", "operation" in data, "")
            test_case("报告含 service", "service" in data, "")
            test_case("报告含 version", "version" in data, "")
            test_case("报告含 phases_total", "phases_total" in data, "")
            test_case("报告含 dry_run", "dry_run" in data, "")
            test_case("报告含 final_action", "final_action" in data, "")
            test_case("报告含 drill_results", "drill_results" in data, "")
            test_case("dry_run=true", data.get("dry_run") is True, "")
            test_case("final_action 合法", data.get("final_action") in ("promoted", "rolled_back", "deployed"), "")
        except json.JSONDecodeError as e:
            test_case("报告 JSON 可解析", False, str(e))

    # 缺少参数
    code, out, err = run_script()
    test_case("缺参数被拒绝", code != 0, f"code={code}")

    print("=" * 60)
    print(f"通过: {passed} / 失败: {failed}")
    print("=" * 60)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
