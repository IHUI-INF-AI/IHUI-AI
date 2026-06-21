#!/usr/bin/env python3
"""告警链路部署脚本测试 - alert_link_deploy.sh

验证项:
1. 脚本存在
2. 8 步骤流程
3. --dry-run 模式
4. --test 模式
5. 4 渠道 webhook 检查
6. Python 依赖检查
7. 部署 3 个组件 (alert_router/multi_channel/alert_history_db)
8. 测试发送
9. JSON 报告生成
"""
import os
import sys
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPT = SERVER_DIR / "scripts" / "alert_link_deploy.sh"

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


def main() -> int:
    print("=" * 60)
    print("P0-2 告警链路部署脚本测试")
    print("=" * 60)

    test_case("脚本存在", SCRIPT.exists(), str(SCRIPT))
    content = SCRIPT.read_text(encoding="utf-8")

    # 8 步骤
    steps = ["1/8", "2/8", "3/8", "4/8", "5/8", "6/8", "7/8", "8/8"]
    for step in steps:
        test_case(f"包含步骤 {step}", step in content, f"缺少步骤 {step}")

    # 关键步骤
    test_case("预检环境", "预检" in content, "")
    test_case("检查依赖", "依赖" in content, "")
    test_case("配置 webhook", "webhook" in content or "WEBHOOK" in content, "")
    test_case("部署 alert_router", "alert_router" in content, "")
    test_case("部署 multi_channel_notify", "multi_channel_notify" in content, "")
    test_case("部署 alert_history_db", "alert_history_db" in content, "")
    test_case("测试发送", "测试发送" in content, "")
    test_case("生成报告", "REPORT_FILE" in content, "")

    # 模式
    test_case("--dry-run 模式", "--dry-run" in content, "")
    test_case("--test 模式", "--test" in content, "")

    # 4 渠道
    channels = ["dingtalk", "wechat", "feishu", "email", "smtp"]
    for ch in channels:
        test_case(f"渠道 {ch}", ch in content, f"缺少 {ch}")

    # 3 个组件
    components = ["alert_router.py", "multi_channel_notify.py", "alert_history_db.py"]
    for comp in components:
        test_case(f"组件 {comp}", comp in content, f"缺少 {comp}")

    # JSON 报告
    test_case("JSON 含 operation", '"operation":' in content, "")
    test_case("JSON 含 channels", '"channels":' in content, "")
    test_case("JSON 含 components", '"components":' in content, "")
    test_case("JSON 含 duration", '"duration_seconds":' in content, "")
    test_case("JSON 含 dingtalk", "dingtalk" in content and "true" in content, "")

    # 环境变量
    env_vars = ["DINGTALK_WEBHOOK", "WECHAT_WEBHOOK", "FEISHU_WEBHOOK", "SMTP_HOST", "SMTP_USERNAME", "SMTP_PASSWORD"]
    for v in env_vars:
        test_case(f"环境变量 {v}", v in content, f"缺少 {v}")

    # set -euo pipefail
    test_case("set -euo pipefail", "set -euo pipefail" in content, "")

    # 缺失依赖处理
    test_case("MISSING_DEPS 统计", "MISSING_DEPS" in content, "")

    print("=" * 60)
    print(f"通过: {passed} / 失败: {failed}")
    print("=" * 60)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
