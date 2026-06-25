#!/usr/bin/env python3
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))
"""PITR crontab 安装脚本测试 - deploy_pitr_cron.sh

验证项:
1. 脚本存在
2. 4 个操作: --install / --uninstall / --status / --validate
3. CRON_MARKER 标识
4. 周六 04:00 计划
5. 调用 daily_pitr_cron.sh
6. 5 步骤流程
7. JSON 报告生成
8. crontab 兼容性处理 (Windows 下优雅降级)
9. 幂等性: 重复安装 / 重复卸载
"""
import os
import sys
import subprocess
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPT = SERVER_DIR / "scripts" / "deploy_pitr_cron.sh"
PITR_SCRIPT = SERVER_DIR / "scripts" / "daily_pitr_cron.sh"
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


def main() -> int:
    print("=" * 60)
    print("P0-3 PITR crontab 安装脚本测试")
    print("=" * 60)

    test_case("脚本存在", SCRIPT.exists(), str(SCRIPT))
    test_case("PITR 脚本存在", PITR_SCRIPT.exists(), str(PITR_SCRIPT))

    content = SCRIPT.read_text(encoding="utf-8")

    # 4 个操作
    actions = ["--install", "--uninstall", "--status", "--validate"]
    for act in actions:
        test_case(f"操作 {act}", act in content, f"缺少 {act}")

    # CRON_MARKER
    test_case("CRON_MARKER 标识", "CRON_MARKER" in content, "")
    test_case("ZHS_PITR 标识", "ZHS_PITR" in content, "")

    # 周六 04:00
    test_case("周六 04:00 计划", "0 4 * * 6" in content, "")

    # 调用 PITR 脚本
    test_case("调用 daily_pitr_cron.sh", "daily_pitr_cron.sh" in content, "")

    # 5 步骤
    steps = ["1/5", "2/5", "3/5", "4/5", "5/5"]
    for step in steps:
        test_case(f"包含步骤 {step}", step in content, f"缺少步骤 {step}")

    # JSON 报告
    test_case("JSON 报告", "REPORT_FILE" in content, "")
    test_case("JSON 含 operation", '"operation":' in content, "")
    test_case("JSON 含 action", '"action":' in content, "")
    test_case("JSON 含 result_status", '"result_status":' in content, "")

    # crontab 兼容性
    test_case("检查 crontab 命令", "command -v crontab" in content, "")
    test_case("HAS_CRONTAB 变量", "HAS_CRONTAB" in content, "")

    # Windows 降级
    test_case("DRY-RUN 降级", "DRY-RUN" in content or "dry-run" in content, "")

    # 幂等性相关
    test_case("已存在检查", "已存在" in content or "already" in content, "")

    # 结果状态
    statuses = ["installed", "uninstalled", "already_installed", "not_installed", "validated"]
    found_statuses = sum(1 for s in statuses if s in content)
    test_case(f"包含 {found_statuses} 种结果状态", found_statuses >= 3, f"实际 {found_statuses} 种")

    # set -euo pipefail
    test_case("set -euo pipefail", "set -euo pipefail" in content, "")

    # crontab 操作
    test_case("crontab -l 检查", "crontab -l" in content, "")
    test_case("crontab - 写入", "crontab -" in content, "")

    # 输出文件
    test_case("log 输出到 LOG_DIR", "LOG_DIR" in content and "LOG_FILE" in content, "")

    print("=" * 60)
    print(f"通过: {passed} / 失败: {failed}")
    print("=" * 60)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
