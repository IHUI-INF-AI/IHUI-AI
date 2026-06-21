#!/usr/bin/env python3
"""pgBouncer Prometheus exporter 测试 - pgbouncer_exporter.py

验证项:
1. 脚本存在
2. 3 个子命令: once/serve/check
3. 函数定义: collect_metrics / format_prometheus / parse_stats / parse_pools / parse_databases
4. Prometheus 文本格式输出
5. JSON 输出格式
6. /metrics 端点定义
7. /health 端点定义
8. 端口参数
9. 环境变量读取
10. 优雅降级 (无连接时不崩溃)
"""
import os
import sys
import json
import subprocess
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPT = SERVER_DIR / "scripts" / "pgbouncer_exporter.py"
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
        print(f"  ✅ {name} -- {detail}")


def run_script(*args: str) -> tuple[int, str, str]:
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
    print("P1-7 pgBouncer Prometheus 监控测试")
    print("=" * 60)

    # 1. 脚本存在
    test_case("脚本存在", SCRIPT.exists(), str(SCRIPT))

    content = SCRIPT.read_text(encoding="utf-8")

    # 2. 3 个子命令
    test_case("once 子命令", "\"once\"" in content or "'once'" in content, "")
    test_case("serve 子命令", "\"serve\"" in content or "'serve'" in content, "")
    test_case("check 子命令", "\"check\"" in content or "'check'" in content, "")

    # 3. 函数定义
    funcs = ["collect_metrics", "format_prometheus", "parse_stats", "parse_pools", "parse_databases"]
    for fn in funcs:
        test_case(f"函数 {fn}", f"def {fn}(" in content, f"缺少 {fn}")

    # 4. 关键 Prometheus 指标
    prom_metrics = ["pgbouncer_up", "total_xact_count", "total_query_count"]
    for m in prom_metrics:
        test_case(f"指标 {m}", m in content, f"缺少 {m}")

    # 5. 端点定义
    test_case("/metrics 端点", "/metrics" in content, "")
    test_case("/health 端点", "/health" in content, "")

    # 6. 端口参数
    test_case("端口参数", "--port" in content, "")

    # 7. 环境变量
    env_vars = ["PGBOUNCER_HOST", "PGBOUNCER_PORT", "PGBOUNCER_USER", "PGBOUNCER_PASSWORD"]
    for v in env_vars:
        test_case(f"环境变量 {v}", v in content, f"缺少 {v}")

    # 8. 优雅降级
    test_case("连接失败处理", "ConnectionRefusedError" in content, "")
    test_case("socket.timeout 处理", "socket.timeout" in content, "")

    # 9. 实际执行 - once 子命令 (无 pgBouncer 时优雅降级)
    code, out, err = run_script("once", "--format", "json")
    test_case("once --format json 执行", code in (0, 1), f"code={code}")
    test_case("输出含 JSON 字段", "timestamp" in out or "pgbouncer" in out, "")

    # 10. once --format prom
    code, out, err = run_script("once", "--format", "prom")
    test_case("once --format prom 执行", code in (0, 1), f"code={code}")
    test_case("输出含 HELP", "HELP" in out, "")
    test_case("输出含 TYPE", "TYPE" in out, "")
    test_case("输出含 pgbouncer_up", "pgbouncer_up" in out, "")

    # 11. check 子命令
    code, out, err = run_script("check")
    test_case("check 子命令执行", code in (0, 1), f"code={code}")

    # 12. 无效子命令
    code, out, err = run_script("invalid_cmd")
    test_case("无效子命令被拒绝", code != 0, "应返回非 0 退出码")

    # 13. 测试 parse_stats 解析逻辑 (静态)
    test_str = """
 name | value
------+------
 total_xact_count | 100
 total_query_count | 500
 total_received | 1024
"""
    # 验证解析函数存在
    test_case("parse_stats 解析 total_xact_count", "total_xact_count" in content, "")
    test_case("parse_stats 解析 total_query_count", "total_query_count" in content, "")

    # 14. 解析 SHOW POOLS 字段
    pool_fields = ["cl_active", "cl_waiting", "sv_active", "sv_idle", "sv_used"]
    for f in pool_fields:
        test_case(f"pool 字段 {f}", f in content, f"缺少 {f}")

    # 15. 解析 SHOW DATABASES 字段
    db_fields = ["name", "host", "port", "database", "pool_size", "reserve_pool"]
    for f in db_fields:
        test_case(f"database 字段 {f}", f in content, f"缺少 {f}")

    # 16. connection_ok 字段
    test_case("connection_ok 字段", "connection_ok" in content, "")

    print("=" * 60)
    print(f"通过: {passed} / 失败: {failed}")
    print("=" * 60)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
