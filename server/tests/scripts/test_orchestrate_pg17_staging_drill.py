#!/usr/bin/env python3
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))
"""PG16→PG17 staging 演练编排测试 - orchestrate_pg17_staging_drill.sh

验证项:
1. 脚本存在
2. 8 步骤流程
3. --dry-run 模式
4. 独立端口 (5434 / 5435)
5. pg_upgrade --link
6. 备份 + 启动 + 验证 + 报告
7. 与 upgrade_pg16_to_pg17.sh 区别
8. JSON 报告
"""
import os
import sys
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPT = SERVER_DIR / "scripts" / "orchestrate_pg17_staging_drill.sh"

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
    print("P1-4 PG16→PG17 staging 演练测试")
    print("=" * 60)

    test_case("脚本存在", SCRIPT.exists(), str(SCRIPT))
    content = SCRIPT.read_text(encoding="utf-8")

    # 8 步骤
    steps = ["1/8", "2/8", "3/8", "4/8", "5/8", "6/8", "7/8", "8/8"]
    for step in steps:
        test_case(f"包含步骤 {step}", step in content, f"缺少步骤 {step}")

    # 关键步骤
    test_case("预检", "预检" in content, "")
    test_case("启动 PG16 staging", "启动 PG16" in content, "")
    test_case("备份 PG16 staging", "备份" in content and "pg_basebackup" in content, "")
    test_case("停止 PG16", "停止" in content, "")
    test_case("pg_upgrade --link", "pg_upgrade" in content and "--link" in content, "")
    test_case("启动 PG17 staging", "启动 PG17" in content, "")
    test_case("验证升级", "验证" in content and "version()" in content, "")
    test_case("生成报告", "REPORT_FILE" in content, "")

    # dry-run
    test_case("--dry-run 参数", "--dry-run" in content, "")
    test_case("DRY_RUN 变量", "DRY_RUN" in content, "")

    # 独立端口
    test_case("PG16 staging 端口 5434", "PG16_STAGING_PORT" in content and "5434" in content, "")
    test_case("PG17 staging 端口 5435", "PG17_STAGING_PORT" in content and "5435" in content, "")

    # 环境变量
    env_vars = ["PG16_STAGING_PORT", "PG17_STAGING_PORT", "PG16_DATA_STAGING", "PG17_DATA_STAGING", "PG16_BIN", "PG17_BIN"]
    for v in env_vars:
        test_case(f"环境变量 {v}", v in content, f"缺少 {v}")

    # JSON 报告字段
    test_case("JSON 含 operation", '"operation":' in content, "")
    test_case("JSON 含 pg17_staging_drill", "pg17_staging_drill" in content, "")
    test_case("JSON 含 dry_run", '"dry_run":' in content, "")
    test_case("JSON 含 duration", '"duration_seconds":' in content, "")
    test_case("JSON 含 pg17_version", "pg17_version" in content, "")
    test_case("JSON 含 table_count", "table_count" in content, "")

    # 工具
    tools = ["pg_ctl", "pg_basebackup", "pg_upgrade", "psql"]
    for t in tools:
        test_case(f"使用 {t}", t in content, f"缺少 {t}")

    # set -euo pipefail
    test_case("set -euo pipefail", "set -euo pipefail" in content, "")

    # 错误处理
    test_case("启动失败 graceful", "启动失败" in content, "")
    test_case("备份失败 graceful", "备份失败" in content, "")

    print("=" * 60)
    print(f"通过: {passed} / 失败: {failed}")
    print("=" * 60)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
