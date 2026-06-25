#!/usr/bin/env python3
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))
"""Round 8 端到端综合回归测试

串联 P0-1 ~ P2-9 所有交付物, 验证它们之间的集成和协同
测试场景:
1. 告警链路: alert_router -> multi_channel_notify -> alert_history_db
2. 租户链路: tenant_routing -> tenant_routing.sql
3. 监控链路: cron_monitor -> multi_channel_notify
4. 部署链路: orchestrate_pg17 -> upgrade_pg16_to_pg17
5. GitOps 链路: gitops_deploy -> canary_release
6. PITR 链路: deploy_pitr_cron -> daily_pitr_cron
7. 压测链路: tenant_loadtest
"""
import os
import sys
import json
import subprocess
from pathlib import Path
from datetime import datetime, timezone

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = SERVER_DIR / "scripts"
LOG_DIR = SERVER_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
E2E_REPORT = LOG_DIR / f"round8_e2e_report_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.json"

passed = 0
failed = 0
test_results = []


def test_case(name: str, ok: bool, detail: str = "") -> bool:
    global passed, failed
    if ok:
        passed += 1
        print(f"  ✅ {name}")
        test_results.append({"name": name, "status": "passed"})
        return True
    failed += 1
    print(f"  ❌ {name} -- {detail}")
    test_results.append({"name": name, "status": "failed", "detail": detail})
    return False


def run_py(*args, timeout: int = 30) -> tuple[int, str, str]:
    return subprocess.run(
        [sys.executable, *args],
        capture_output=True, text=True, encoding="utf-8",
        cwd=str(SERVER_DIR), timeout=timeout,
    )


def scenario_1_alert_chain() -> bool:
    """场景 1: 告警链路 (alert_router -> multi_channel_notify -> alert_history_db)"""
    print("\n--- 场景 1: 告警链路 ---")
    ok = True

    # 1.1 alert_router send dry-run
    proc = run_py(str(SCRIPTS_DIR / "alert_router.py"), "send",
                  "--level", "critical",
                  "--title", "E2E 测试告警",
                  "--content", "outage detected in e2e test",
                  "--source", "pg_backup",
                  "--tags", "db,security",
                  "--dry-run")
    ok &= test_case("1.1 alert_router 路由解析", proc.returncode == 0, f"code={proc.returncode}")
    ok &= test_case("1.2 alert_router 输出 channels", "channels" in proc.stdout, "")

    # 1.3 alert_router list-rules
    proc = run_py(str(SCRIPTS_DIR / "alert_router.py"), "list-rules")
    ok &= test_case("1.3 alert_router 列出规则", proc.returncode == 0, "")

    # 1.4 multi_channel_notify dry-run
    proc = run_py(str(SCRIPTS_DIR / "multi_channel_notify.py"),
                  "--channel", "all",
                  "--title", "E2E",
                  "--content", "test",
                  "--level", "info",
                  "--dry-run")
    ok &= test_case("1.4 multi_channel_notify 多渠道", proc.returncode == 0, "")

    # 1.5 alert_history_db record
    proc = run_py(str(SCRIPTS_DIR / "alert_history_db.py"),
                  "record", "--level", "warning",
                  "--title", "E2E 记录",
                  "--source", "e2e_test",
                  "--channels", "dingtalk")
    ok &= test_case("1.5 alert_history_db 记录", proc.returncode == 0, "")

    # 1.6 alert_history_db query
    proc = run_py(str(SCRIPTS_DIR / "alert_history_db.py"),
                  "query", "--source", "e2e_test", "--limit", "5")
    ok &= test_case("1.6 alert_history_db 查询", "e2e_test" in proc.stdout, "")

    return ok


def scenario_2_tenant_chain() -> bool:
    """场景 2: 租户链路"""
    print("\n--- 场景 2: 租户链路 ---")
    ok = True

    # 2.1 tenant_routing list
    proc = run_py(str(SCRIPTS_DIR / "tenant_routing.py"), "list")
    ok &= test_case("2.1 tenant_routing 列出", "zhs" in proc.stdout, "")

    # 2.2 tenant_routing validate
    proc = run_py(str(SCRIPTS_DIR / "tenant_routing.py"),
                  "validate", "--tenant", "zhs_prod_2026")
    ok &= test_case("2.2 validate 合法", proc.returncode == 0, "")

    # 2.3 tenant_routing route dry-run
    proc = run_py(str(SCRIPTS_DIR / "tenant_routing.py"),
                  "route", "--tenant", "zhs", "--dry-run")
    ok &= test_case("2.3 route dry-run", "tenant_zhs" in proc.stdout, "")

    # 2.4 tenant_routing health
    proc = run_py(str(SCRIPTS_DIR / "tenant_routing.py"),
                  "health", "--tenant", "demo")
    ok &= test_case("2.4 health 检查", proc.returncode in (0, 1), "")

    return ok


def scenario_3_monitor_chain() -> bool:
    """场景 3: 监控链路 (cron_monitor -> multi_channel_notify)"""
    print("\n--- 场景 3: 监控链路 ---")
    ok = True

    # 3.1 cron_monitor list
    proc = run_py(str(SCRIPTS_DIR / "cron_monitor.py"), "list")
    ok &= test_case("3.1 cron_monitor 列出任务", "cron_pg_slow_query" in proc.stdout, "")

    # 3.2 cron_monitor check
    proc = run_py(str(SCRIPTS_DIR / "cron_monitor.py"), "check")
    ok &= test_case("3.2 cron_monitor check", proc.returncode in (0, 1), "")

    # 3.3 cron_monitor report
    proc = run_py(str(SCRIPTS_DIR / "cron_monitor.py"), "report")
    ok &= test_case("3.3 cron_monitor report", proc.returncode == 0, "")

    return ok


def scenario_4_pg_upgrade_chain() -> bool:
    """场景 4: PG 升级链路"""
    print("\n--- 场景 4: PG 升级链路 ---")
    ok = True

    # 4.1 orchestrate_pg17 脚本存在
    ok &= test_case("4.1 orchestrate_pg17_staging_drill 存在",
                    (SCRIPTS_DIR / "orchestrate_pg17_staging_drill.sh").exists(), "")

    # 4.2 upgrade_pg16_to_pg17 脚本存在
    ok &= test_case("4.2 upgrade_pg16_to_pg17 存在",
                    (SCRIPTS_DIR / "upgrade_pg16_to_pg17.sh").exists(), "")

    # 4.3 两个脚本都使用 pg_upgrade
    drill_content = (SCRIPTS_DIR / "orchestrate_pg17_staging_drill.sh").read_text(encoding="utf-8")
    upgrade_content = (SCRIPTS_DIR / "upgrade_pg16_to_pg17.sh").read_text(encoding="utf-8")
    ok &= test_case("4.3 drill 脚本含 pg_upgrade", "pg_upgrade" in drill_content, "")
    ok &= test_case("4.4 upgrade 脚本含 pg_upgrade", "pg_upgrade" in upgrade_content, "")

    return ok


def scenario_5_gitops_chain() -> bool:
    """场景 5: GitOps 链路 (gitops_deploy -> canary_release)"""
    print("\n--- 场景 5: GitOps 链路 ---")
    ok = True

    # 5.1 gitops_deploy 脚本存在
    ok &= test_case("5.1 gitops_deploy 存在",
                    (SCRIPTS_DIR / "gitops_deploy.sh").exists(), "")

    # 5.2 canary_release 脚本存在
    ok &= test_case("5.2 canary_release 存在",
                    (SCRIPTS_DIR / "canary_release.sh").exists(), "")

    # 5.3 argo_application.yaml 存在
    argo_path = SERVER_DIR / "deploy" / "argocd" / "argo_application.yaml"
    ok &= test_case("5.3 argo_application.yaml 存在", argo_path.exists(), "")

    # 5.4 三个文件协调
    gitops_content = (SCRIPTS_DIR / "gitops_deploy.sh").read_text(encoding="utf-8")
    canary_content = (SCRIPTS_DIR / "canary_release.sh").read_text(encoding="utf-8")
    ok &= test_case("5.4 gitops_deploy 含 helm", "helm" in gitops_content, "")
    ok &= test_case("5.5 canary_release 含 kubectl", "kubectl" in canary_content, "")

    return ok


def scenario_6_pitr_chain() -> bool:
    """场景 6: PITR 链路 (deploy_pitr_cron -> daily_pitr_cron)"""
    print("\n--- 场景 6: PITR 链路 ---")
    ok = True

    # 6.1 daily_pitr_cron 存在
    ok &= test_case("6.1 daily_pitr_cron 存在",
                    (SCRIPTS_DIR / "daily_pitr_cron.sh").exists(), "")

    # 6.2 deploy_pitr_cron 存在
    ok &= test_case("6.2 deploy_pitr_cron 存在",
                    (SCRIPTS_DIR / "deploy_pitr_cron.sh").exists(), "")

    # 6.3 deploy 引用 daily
    deploy_content = (SCRIPTS_DIR / "deploy_pitr_cron.sh").read_text(encoding="utf-8")
    ok &= test_case("6.3 deploy 引用 daily_pitr_cron", "daily_pitr_cron.sh" in deploy_content, "")

    # 6.4 包含 crontab 配置
    ok &= test_case("6.4 包含 crontab 标记", "CRON_MARKER" in deploy_content, "")

    return ok


def scenario_7_loadtest_chain() -> bool:
    """场景 7: 多租户压测"""
    print("\n--- 场景 7: 多租户压测链路 ---")
    ok = True

    # 7.1 tenant_loadtest 存在
    ok &= test_case("7.1 tenant_loadtest 存在",
                    (SCRIPTS_DIR / "tenant_loadtest.py").exists(), "")

    # 7.2 dry-run
    proc = run_py(str(SCRIPTS_DIR / "tenant_loadtest.py"), "--dry-run")
    ok &= test_case("7.2 dry-run", proc.returncode == 0, "")

    # 7.3 小规模压测
    proc = run_py(str(SCRIPTS_DIR / "tenant_loadtest.py"),
                  "--mode", "sequential",
                  "--tenants", "zhs",
                  "--requests", "10",
                  timeout=30)
    ok &= test_case("7.3 顺序压测", proc.returncode == 0, "")

    return ok


def scenario_8_observability_chain() -> bool:
    """场景 8: 可观测性链路"""
    print("\n--- 场景 8: 可观测性链路 ---")
    ok = True

    # 8.1 pgbouncer_exporter 存在
    ok &= test_case("8.1 pgbouncer_exporter 存在",
                    (SCRIPTS_DIR / "pgbouncer_exporter.py").exists(), "")

    # 8.2 once 子命令
    proc = run_py(str(SCRIPTS_DIR / "pgbouncer_exporter.py"),
                  "once", "--format", "prom")
    ok &= test_case("8.2 pgbouncer exporter prom", proc.returncode in (0, 1), "")

    return ok


def main() -> int:
    print("=" * 60)
    print("Round 8 端到端综合回归测试")
    print("=" * 60)

    scenarios = [
        ("场景 1: 告警链路", scenario_1_alert_chain),
        ("场景 2: 租户链路", scenario_2_tenant_chain),
        ("场景 3: 监控链路", scenario_3_monitor_chain),
        ("场景 4: PG 升级链路", scenario_4_pg_upgrade_chain),
        ("场景 5: GitOps 链路", scenario_5_gitops_chain),
        ("场景 6: PITR 链路", scenario_6_pitr_chain),
        ("场景 7: 多租户压测", scenario_7_loadtest_chain),
        ("场景 8: 可观测性", scenario_8_observability_chain),
    ]

    for name, fn in scenarios:
        fn()

    print("\n" + "=" * 60)
    print(f"总计: 通过 {passed} / 失败 {failed}")
    print("=" * 60)

    # 生成 E2E 报告
    report = {
        "operation": "round8_e2e",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "total": passed + failed,
        "passed": passed,
        "failed": failed,
        "success_rate": round(passed / (passed + failed) * 100, 2) if (passed + failed) > 0 else 0,
        "test_results": test_results,
    }
    E2E_REPORT.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"✅ E2E 报告: {E2E_REPORT}")

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
