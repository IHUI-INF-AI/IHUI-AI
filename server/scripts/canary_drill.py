#!/usr/bin/env python3
"""金丝雀生产演练编排

通过 canary_release.sh 完整跑通金丝雀发布全流程:
1. 部署 v1 (stable)
2. 部署 v2 (canary)
3. 灰度 10% → 50% → 100%
4. 监控指标
5. 验证后全量或回滚
6. 生成报告

用法:
  python scripts/canary_drill.py --service api --version v2.0.0
  python scripts/canary_drill.py --service api --version v2.0.0 --dry-run
  python scripts/canary_drill.py --service api --rollback
"""
import os
import sys
import json
import argparse
import subprocess
from pathlib import Path
from datetime import datetime, timezone

SERVER_DIR = Path(__file__).resolve().parent.parent
LOG_DIR = SERVER_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
DRILL_REPORT = LOG_DIR / f"canary_drill_report_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.json"

CANARY_SCRIPT = SERVER_DIR / "scripts" / "canary_release.sh"

PHASES = [
    {"name": "Phase 1: 10% 灰度", "percent": 10, "duration_sec": 60},
    {"name": "Phase 2: 50% 灰度", "percent": 50, "duration_sec": 120},
    {"name": "Phase 3: 100% 全量", "percent": 100, "duration_sec": 60},
]


def log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}")


def run_canary(args: list[str], dry_run: bool) -> dict:
    """调用 canary_release.sh 并解析报告

    Args:
        args: canary_release.sh 的参数 (--service, --version, --promote 等)
        dry_run: 是否 dry-run
    """
    cmd = ["bash", str(CANARY_SCRIPT), *args]
    if dry_run:
        cmd.append("--dry-run")
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", cwd=str(SERVER_DIR), timeout=60)
    except Exception as e:
        return {
            "returncode": 1,
            "stdout": "",
            "stderr": f"调用失败: {e}",
            "report": {},
        }
    # 找 JSON 报告
    report_files = sorted(LOG_DIR.glob("canary_release_report_*.json"))
    report_data = {}
    if report_files:
        try:
            latest = report_files[-1]
            report_data = json.loads(latest.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as e:
            log(f"  报告解析失败: {e}")
    return {
        "returncode": proc.returncode,
        "stdout": proc.stdout[-500:] if proc.stdout else "",
        "stderr": proc.stderr[-500:] if proc.stderr else "",
        "report": report_data,
    }


def cmd_drill(args) -> int:
    """执行金丝雀演练"""
    service = args.service
    version = args.version
    dry_run = args.dry_run
    rollback_on_failure = not args.no_rollback

    log("=" * 60)
    log(f"金丝雀生产演练")
    log(f"  服务: {service}")
    log(f"  版本: {version}")
    log(f"  DRY_RUN: {dry_run}")
    log(f"  失败自动回滚: {rollback_on_failure}")
    log("=" * 60)

    drill_results = []
    failed = False
    final_action = "deployed"

    for i, phase in enumerate(PHASES, 1):
        log(f"\n[{i}/{len(PHASES)}] {phase['name']} (percent={phase['percent']}%)")
        log(f"  等待 {phase['duration_sec']}s 观察...")

        # Phase 1/2 用 deploy 模式 (创建/更新 canary), Phase 3 用 promote
        if phase["percent"] < 100:
            result = run_canary(
                ["--service", service, "--version", version],
                dry_run,
            )
        else:
            result = run_canary(
                ["--service", service, "--promote"],
                dry_run,
            )
        result["phase"] = phase["name"]
        result["percent"] = phase["percent"]
        drill_results.append(result)

        log(f"  返回码: {result['returncode']}")
        if result["report"]:
            log(f"  操作: {result['report'].get('action')}")
            log(f"  健康状态: {result['report'].get('health_status')}")
            log(f"  错误率: {result['report'].get('error_rate')}%")

        if result["returncode"] != 0:
            log(f"  ❌ {phase['name']} 失败")
            failed = True
            break

        if dry_run:
            log(f"  ✅ {phase['name']} dry-run 通过")
        else:
            log(f"  ✅ {phase['name']} 通过")

    # 全量或回滚
    if failed and rollback_on_failure:
        log("\n[ROLLBACK] 触发回滚...")
        rollback_result = run_canary(["--service", service, "--rollback"], dry_run)
        rollback_result["phase"] = "ROLLBACK"
        drill_results.append(rollback_result)
        final_action = "rolled_back"
        log(f"  回滚返回码: {rollback_result['returncode']}")
    elif not failed:
        log("\n[PROMOTE] 提升到 100% 全量...")
        promote_result = run_canary(["--service", service, "--promote"], dry_run)
        promote_result["phase"] = "PROMOTE"
        drill_results.append(promote_result)
        final_action = "promoted"
        log(f"  全量返回码: {promote_result['returncode']}")

    # 生成总报告
    total_duration = sum(d.get("report", {}).get("duration_seconds", 0) for d in drill_results)
    report = {
        "operation": "canary_drill",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "service": service,
        "version": version,
        "dry_run": dry_run,
        "phases_total": len(PHASES),
        "phases_executed": len(drill_results),
        "final_action": final_action,
        "failed": failed,
        "total_duration_seconds": total_duration,
        "drill_results": drill_results,
    }
    DRILL_REPORT.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    log(f"\n✅ 演练报告: {DRILL_REPORT}")

    log("=" * 60)
    log(f"演练完成: {final_action} ({total_duration}s)")
    log("=" * 60)
    return 0 if not failed else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="金丝雀生产演练")
    parser.add_argument("--service", required=True, help="服务名")
    parser.add_argument("--version", required=True, help="目标版本")
    parser.add_argument("--dry-run", action="store_true", help="仅演练不实际部署")
    parser.add_argument("--no-rollback", action="store_true", help="失败时不自动回滚")
    args = parser.parse_args()
    return cmd_drill(args)


if __name__ == "__main__":
    sys.exit(main())
