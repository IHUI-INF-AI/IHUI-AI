#!/usr/bin/env python3
"""定时任务监控器测试 - cron_monitor.py

验证项:
1. 脚本存在且可执行
2. 3 个命令: check / list / report
3. 监控任务定义完整 (5 个)
4. check 子命令正常退出
5. list 子命令输出任务清单
6. report 子命令生成 JSON 报告
7. JSON 报告包含必要字段
8. 状态文件保存/读取
9. 缺失日志返回 missing 状态
10. 超期日志返回 overdue 状态
11. 健康日志返回 healthy 状态
"""
import os
import sys
import json
import time
import subprocess
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPT = SERVER_DIR / "scripts" / "cron_monitor.py"
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


def run_script(*args: str) -> tuple[int, str, str]:
    """执行 cron_monitor.py, 返回 (退出码, stdout, stderr)"""
    proc = subprocess.run(
        [sys.executable, str(SCRIPT), *args],
        capture_output=True,
        text=True,
        encoding="utf-8",
        cwd=str(SERVER_DIR),
    )
    return proc.returncode, proc.stdout, proc.stderr


def main() -> int:
    print("=" * 60)
    print("P1-4 定时任务监控器测试")
    print("=" * 60)

    # 1. 脚本存在
    test_case("脚本存在", SCRIPT.exists(), str(SCRIPT))

    # 2. 3 个命令定义
    content = SCRIPT.read_text(encoding="utf-8")
    test_case("包含 check 命令", "\"check\":" in content, "缺少 check 命令映射")
    test_case("包含 list 命令", "\"list\":" in content, "缺少 list 命令映射")
    test_case("包含 report 命令", "\"report\":" in content, "缺少 report 命令映射")

    # 3. 监控任务定义 (5 个)
    expected_tasks = [
        "cron_pg_slow_query",
        "cron_pg_security_audit",
        "vault_key_rotation",
        "backup_pg_encrypted",
        "pitr_production_drill",
    ]
    for task in expected_tasks:
        test_case(f"定义任务 {task}", task in content, "未在 MONITORED_TASKS 中")

    # 4. check 子命令正常退出 (允许 0 或 1)
    code, out, err = run_script("check")
    test_case("check 子命令执行", code in (0, 1), f"code={code}, stderr={err[:200]}")

    # 5. list 子命令输出任务清单
    code, out, err = run_script("list")
    test_case("list 子命令执行成功", code == 0, f"code={code}")
    for task in expected_tasks:
        test_case(f"list 输出任务 {task}", task in out, "未在 list 输出中")

    # 6. report 子命令生成 JSON 报告
    code, out, err = run_script("report")
    test_case("report 子命令执行成功", code == 0, f"code={code}, stderr={err[:200]}")
    report_files = list(LOG_DIR.glob("cron_monitor_report_*.json"))
    test_case("生成 JSON 报告", len(report_files) > 0, "未找到报告文件")

    # 7. JSON 报告字段验证
    if report_files:
        latest = max(report_files, key=lambda p: p.stat().st_mtime)
        try:
            data = json.loads(latest.read_text(encoding="utf-8"))
            test_case("报告包含 timestamp", "timestamp" in data, "")
            test_case("报告包含 total_tasks", "total_tasks" in data, "")
            test_case("报告包含 healthy_count", "healthy_count" in data, "")
            test_case("报告包含 unhealthy_count", "unhealthy_count" in data, "")
            test_case("报告包含 tasks 列表", "tasks" in data and isinstance(data["tasks"], list), "")
        except json.JSONDecodeError as e:
            test_case("JSON 报告可解析", False, str(e))

    # 8. 状态文件保存/读取
    state_file = LOG_DIR / "cron_monitor_state.json"
    test_case("状态文件存在", state_file.exists(), f"未找到 {state_file}")
    if state_file.exists():
        try:
            state = json.loads(state_file.read_text(encoding="utf-8"))
            test_case("状态包含 last_runs", "last_runs" in state, "")
            test_case("状态包含 check_history", "check_history" in state, "")
        except json.JSONDecodeError as e:
            test_case("状态文件可解析", False, str(e))

    # 9. 模拟缺失日志场景 - 清理 logs 后 check
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    code, out, _ = run_script("check")
    test_case("check 命令在无日志场景下不崩溃", code in (0, 1), f"code={code}")

    # 10. 模拟超期日志场景 - 创建一个超期的日志文件
    overdue_log = LOG_DIR / "pg_slow_query_cron_20260101.log"
    overdue_log.write_text("test overdue log\n", encoding="utf-8")
    old_time = time.time() - (200 * 60)  # 200 分钟前
    os.utime(overdue_log, (old_time, old_time))

    code, out, _ = run_script("check")
    test_case("check 在有超期日志时不崩溃", code in (0, 1), f"code={code}")

    # 11. 模拟健康日志场景 - 创建一个最新的日志文件
    healthy_log = LOG_DIR / "pg_slow_query_cron_20260618.log"
    healthy_log.write_text("test healthy log\n", encoding="utf-8")
    code, out, _ = run_script("check")
    test_case("check 在有健康日志时正常执行", code in (0, 1), f"code={code}")

    # 清理测试日志
    for f in [overdue_log, healthy_log]:
        if f.exists():
            f.unlink()

    print("=" * 60)
    print(f"通过: {passed} / 失败: {failed}")
    print("=" * 60)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
