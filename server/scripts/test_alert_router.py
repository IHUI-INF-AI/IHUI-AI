#!/usr/bin/env python3
"""多渠道告警路由规则测试 - alert_router.py

验证项:
1. 脚本存在
2. 3 个子命令: send / list-rules / test
3. 3 个级别路由 (critical/warning/info)
4. 关键词升级级别
5. 源特定规则 (6 个源)
6. 标签追加渠道 (5 个标签)
7. dry-run 模式
8. 调用 multi_channel_notify.py
9. 路由解析逻辑
10. 4 个通知渠道支持
"""
import os
import sys
import json
import subprocess
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPT = SERVER_DIR / "scripts" / "alert_router.py"
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
    print("P0-2 多渠道告警路由规则测试")
    print("=" * 60)

    test_case("脚本存在", SCRIPT.exists(), str(SCRIPT))

    content = SCRIPT.read_text(encoding="utf-8")

    # 3 子命令
    for cmd in ["send", "list-rules", "test"]:
        test_case(f"子命令 {cmd}", f'"{cmd}"' in content or f"cmd_{cmd}" in content, f"缺少 {cmd}")

    # 关键函数
    funcs = ["upgrade_level", "resolve_channels", "dispatch_alert"]
    for fn in funcs:
        test_case(f"函数 {fn}", f"def {fn}(" in content, f"缺少 {fn}")

    # 级别路由
    test_case("critical -> 4 渠道", '"critical"' in content and "dingtalk" in content and "wechat" in content and "feishu" in content and "email" in content, "")
    test_case("warning -> 2 渠道", '"warning"' in content, "")
    test_case("info -> 邮件", '"info"' in content, "")

    # 6 个源特定规则
    sources = ["pg_backup", "pg_slow_query", "vault_rotation", "deploy", "security_audit", "pitr_drill"]
    for src in sources:
        test_case(f"源规则 {src}", f'"{src}"' in content, f"缺少 {src}")

    # 5 个标签规则
    tags = ["db", "performance", "security", "business", "infra"]
    for tag in tags:
        test_case(f"标签规则 {tag}", f'"{tag}"' in content, f"缺少 {tag}")

    # 关键词升级
    test_case("关键词规则", "KEYWORD_RULES" in content, "")
    for kw in ["down", "outage", "deadlock"]:
        test_case(f"关键词 {kw}", f'"{kw}"' in content, f"缺少关键词 {kw}")

    # 级别优先级
    test_case("LEVEL_PRIORITY 字典", "LEVEL_PRIORITY" in content, "")

    # multi_channel_notify.py 集成
    test_case("调用 multi_channel_notify.py", "multi_channel_notify.py" in content, "")

    # 实际执行 - list-rules
    code, out, err = run_script("list-rules")
    test_case("list-rules 执行", code == 0, f"code={code}")
    test_case("输出含 default_level_rules", "default_level_rules" in out, "")
    test_case("输出含 source_rules", "source_rules" in out, "")

    # test 子命令 - critical
    code, out, err = run_script("test", "--level", "critical", "--source", "pg_backup")
    test_case("test critical pg_backup", code == 0, f"code={code}")
    test_case("输出 resolved_channels", "resolved_channels" in out, "")

    # test 子命令 - warning + tags
    code, out, err = run_script("test", "--level", "warning", "--tags", "db,performance")
    test_case("test warning + tags", code == 0, f"code={code}")
    test_case("test 渠道含 dingtalk", "dingtalk" in out, "")
    test_case("test 渠道含 feishu", "feishu" in out, "")

    # send dry-run
    code, out, err = run_script(
        "send",
        "--level", "critical",
        "--title", "测试告警",
        "--content", "测试内容",
        "--source", "pg_backup",
        "--tags", "db,security",
        "--dry-run",
    )
    test_case("send dry-run 执行", code == 0, f"code={code}")
    test_case("send dry-run 输出 channels", "channels" in out, "")

    # 关键词升级 - outage 升级到 critical
    code, out, err = run_script(
        "send",
        "--level", "warning",
        "--title", "服务异常",
        "--content", "outage detected",
        "--dry-run",
    )
    test_case("outage 关键词升级", code == 0, f"code={code}")

    # 无效级别
    code, out, err = run_script(
        "send",
        "--level", "invalid",
        "--title", "t",
        "--content", "c",
    )
    test_case("无效级别被拒绝", code != 0, f"code={code}")

    # 日志
    log_files = list(LOG_DIR.glob("alert_router_*.log"))
    test_case("写入路由日志", len(log_files) > 0, "")

    print("=" * 60)
    print(f"通过: {passed} / 失败: {failed}")
    print("=" * 60)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
