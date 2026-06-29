#!/usr/bin/env python3
"""多渠道告警通知测试 - multi_channel_notify.py

验证项:
1. 脚本存在
2. 参数解析 (--channel / --title / --content / --level / --dry-run)
3. 5 个渠道支持 (dingtalk/wechat/feishu/email/all)
4. dry-run 模式不实际发送
5. 3 个告警级别 (info/warning/critical)
6. 钉钉通知函数存在
7. 企业微信通知函数存在
8. 飞书通知函数存在
9. 邮件通知函数存在
10. 日志写入 logs 目录
11. send_notification 函数存在
12. 错误处理
"""
import os
import sys
import json
import subprocess
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPT = SERVER_DIR / "scripts" / "multi_channel_notify.py"
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
    print("P1-5 多渠道告警通知测试")
    print("=" * 60)

    # 1. 脚本存在
    test_case("脚本存在", SCRIPT.exists(), str(SCRIPT))

    content = SCRIPT.read_text(encoding="utf-8")

    # 2. 5 个渠道支持
    channels = ["dingtalk", "wechat", "feishu", "email", "all"]
    for ch in channels:
        test_case(f"支持渠道 {ch}", f'"{ch}"' in content, f"缺少 {ch} 渠道")

    # 3. 4 个通知函数
    funcs = ["notify_dingtalk", "notify_wechat", "notify_feishu", "notify_email"]
    for fn in funcs:
        test_case(f"函数 {fn}", f"def {fn}(" in content, f"缺少 {fn} 函数")

    # 4. send_notification 函数
    test_case("send_notification 函数存在", "def send_notification(" in content, "")

    # 5. 3 个告警级别
    levels = ["info", "warning", "critical"]
    for lv in levels:
        test_case(f"支持级别 {lv}", f'"{lv}"' in content, f"缺少 {lv} 级别")

    # 6. dry-run 参数
    test_case("支持 --dry-run 参数", "--dry-run" in content, "")
    test_case("dry_run 逻辑", "dry_run" in content, "")

    # 7. argparse 参数
    test_case("使用 argparse", "argparse.ArgumentParser" in content, "")
    test_case("--channel 参数", '"--channel"' in content or "'--channel'" in content, "")
    test_case("--title 参数", '"--title"' in content or "'--title'" in content, "")
    test_case("--content 参数", '"--content"' in content or "'--content'" in content, "")
    test_case("--level 参数", '"--level"' in content or "'--level'" in content, "")

    # 8. dry-run 模式实际执行
    code, out, err = run_script(
        "--channel", "all",
        "--title", "测试告警",
        "--content", "测试内容",
        "--level", "warning",
        "--dry-run",
    )
    test_case("dry-run 模式执行成功", code == 0, f"code={code}, stderr={err[:200]}")
    test_case("输出包含 dry_run", "dry_run" in out, "")

    # 9. 无效渠道
    code, out, err = run_script(
        "--channel", "invalid",
        "--title", "t",
        "--content", "c",
        "--level", "info",
    )
    test_case("无效渠道被拒绝", code != 0, "应返回非 0 退出码")

    # 10. 日志写入
    log_files = list(LOG_DIR.glob("multi_channel_notify_*.log"))
    test_case("写入通知日志", len(log_files) > 0, "未找到日志文件")

    # 11. 错误处理 - 缺少 webhook 时跳过
    env = os.environ.copy()
    env.pop("DINGTALK_WEBHOOK", None)
    env.pop("WECHAT_WEBHOOK", None)
    env.pop("FEISHU_WEBHOOK", None)
    proc = subprocess.run(
        [sys.executable, str(SCRIPT), "--channel", "dingtalk", "--title", "t", "--content", "c", "--level", "info"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        cwd=str(SERVER_DIR),
        env=env,
    )
    test_case("无 webhook 时 graceful skip", proc.returncode == 0, f"code={proc.returncode}")
    test_case("输出包含 skipped", "skipped" in proc.stdout, "未跳过无配置场景")

    # 12. SMTP 缺失配置时邮件 graceful skip
    proc = subprocess.run(
        [sys.executable, str(SCRIPT), "--channel", "email", "--title", "t", "--content", "c", "--level", "info"],
        capture_output=True,
        text=True,
        encoding="utf-8",
        cwd=str(SERVER_DIR),
        env=env,
    )
    test_case("无 SMTP 配置时 graceful skip", proc.returncode == 0, f"code={proc.returncode}")

    print("=" * 60)
    print(f"通过: {passed} / 失败: {failed}")
    print("=" * 60)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
