#!/usr/bin/env python3
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))
"""安全审计定时任务验证测试"""
import sys
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = SERVER_DIR / "scripts"
SCRIPT = SCRIPTS_DIR / "cron_pg_security_audit.sh"


def test_script_exists():
    """测试 1: 脚本存在"""
    assert SCRIPT.exists(), f"缺少脚本: {SCRIPT}"
    print("✅ 测试 1 通过: 脚本存在")


def test_script_structure():
    """测试 2: 脚本结构完整 (4 步流程)"""
    content = SCRIPT.read_text(encoding="utf-8")
    steps = ["执行安全审计", "解析审计结果", "告警判断与通知", "汇总报告"]
    for i, step in enumerate(steps, 1):
        assert step in content, f"缺少步骤 {i}: {step}"
    print("✅ 测试 2 通过: 4 步流程完整")


def test_audit_integration():
    """测试 3: 集成安全审计脚本"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "pg_security_audit.sh" in content, "未集成安全审计脚本"
    print("✅ 测试 3 通过: 集成安全审计脚本")


def test_json_parsing():
    """测试 4: JSON 结果解析"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "json.load" in content, "缺少 json.load"
    assert "checks" in content, "缺少 checks 字段解析"
    assert "status" in content, "缺少 status 字段解析"
    assert "severity" in content, "缺少 severity 字段解析"
    print("✅ 测试 4 通过: JSON 结果解析")


def test_critical_count():
    """测试 5: 严重问题计数"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "CRITICAL_COUNT" in content, "缺少 CRITICAL_COUNT"
    assert "critical" in content, "缺少 critical 严重级别"
    print("✅ 测试 5 通过: 严重问题计数")


def test_alert_threshold():
    """测试 6: 告警阈值"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "ALERT_THRESHOLD" in content, "缺少 ALERT_THRESHOLD"
    assert "ALERT_TRIGGERED" in content, "缺少 ALERT_TRIGGERED"
    assert "-gt" in content, "缺少阈值比较"
    print("✅ 测试 6 通过: 告警阈值")


def test_dingtalk_notification():
    """测试 7: 钉钉通知集成"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "notify_dingtalk.sh" in content, "缺少钉钉通知脚本引用"
    assert "ALERT_MSG" in content, "缺少告警消息"
    print("✅ 测试 7 通过: 钉钉通知集成")


def test_json_summary():
    """测试 8: JSON 汇总报告"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "SUMMARY_FILE" in content, "缺少 SUMMARY_FILE"
    assert '"operation": "pg_security_audit_cron"' in content, "缺少 operation 字段"
    assert '"total_checks"' in content, "缺少 total_checks"
    assert '"issues_count"' in content, "缺少 issues_count"
    assert '"critical_count"' in content, "缺少 critical_count"
    assert '"alert_triggered"' in content, "缺少 alert_triggered"
    print("✅ 测试 8 通过: JSON 汇总报告")


def test_report_cleanup():
    """测试 9: 旧报告清理"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "find" in content, "缺少 find 命令"
    assert "-mtime +30" in content, "缺少 30 天清理"
    assert "-delete" in content, "缺少 delete 选项"
    print("✅ 测试 9 通过: 旧报告清理")


def test_logging():
    """测试 10: 日志记录"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "LOG_FILE" in content, "缺少 LOG_FILE"
    assert "tee -a" in content, "缺少 tee 日志输出"
    assert "LOG_DIR" in content, "缺少 LOG_DIR"
    print("✅ 测试 10 通过: 日志记录")


def main():
    print("=" * 60)
    print("安全审计定时任务验证")
    print("=" * 60)
    tests = [
        test_script_exists, test_script_structure, test_audit_integration,
        test_json_parsing, test_critical_count, test_alert_threshold,
        test_dingtalk_notification, test_json_summary, test_report_cleanup,
        test_logging,
    ]
    for t in tests:
        t()
    print("=" * 60)
    print(f"✅ 全部 {len(tests)} 项测试通过")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
