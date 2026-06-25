#!/usr/bin/env python3
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))
"""慢查询治理定时任务验证测试"""
import sys
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = SERVER_DIR / "scripts"
SCRIPT = SCRIPTS_DIR / "cron_pg_slow_query.sh"


def test_script_exists():
    """测试 1: 脚本存在"""
    assert SCRIPT.exists(), f"缺少脚本: {SCRIPT}"
    print("✅ 测试 1 通过: 脚本存在")


def test_script_structure():
    """测试 2: 脚本结构完整 (4 步流程)"""
    content = SCRIPT.read_text(encoding="utf-8")
    steps = ["采集慢查询", "索引优化建议", "汇总报告", "告警通知"]
    for i, step in enumerate(steps, 1):
        assert step in content, f"缺少步骤 {i}: {step}"
    print("✅ 测试 2 通过: 4 步流程完整")


def test_slow_query_integration():
    """测试 3: 集成慢查询治理脚本"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "pg_slow_query_governance.sh" in content, "未集成慢查询治理脚本"
    print("✅ 测试 3 通过: 集成慢查询治理脚本")


def test_index_optimization_integration():
    """测试 4: 集成索引优化脚本"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "pg_index_optimization.sh" in content, "未集成索引优化脚本"
    print("✅ 测试 4 通过: 集成索引优化脚本")


def test_json_summary():
    """测试 5: JSON 汇总报告"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "SUMMARY_FILE" in content, "缺少 SUMMARY_FILE"
    assert '"operation": "pg_slow_query_cron"' in content, "缺少 operation 字段"
    assert '"slow_query_count"' in content, "缺少 slow_query_count"
    assert '"index_issues"' in content, "缺少 index_issues"
    assert '"alert_triggered"' in content, "缺少 alert_triggered"
    print("✅ 测试 5 通过: JSON 汇总报告")


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


def test_report_cleanup():
    """测试 8: 旧报告清理"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "find" in content, "缺少 find 命令"
    assert "-mtime +7" in content, "缺少 7 天清理"
    assert "-delete" in content, "缺少 delete 选项"
    print("✅ 测试 8 通过: 旧报告清理")


def test_report_directory():
    """测试 9: 报告目录"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "REPORT_DIR" in content, "缺少 REPORT_DIR"
    assert "pg_slow_query" in content, "缺少报告子目录"
    assert "mkdir -p" in content, "缺少目录创建"
    print("✅ 测试 9 通过: 报告目录")


def test_logging():
    """测试 10: 日志记录"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "LOG_FILE" in content, "缺少 LOG_FILE"
    assert "tee -a" in content, "缺少 tee 日志输出"
    assert "LOG_DIR" in content, "缺少 LOG_DIR"
    print("✅ 测试 10 通过: 日志记录")


def main():
    print("=" * 60)
    print("慢查询治理定时任务验证")
    print("=" * 60)
    tests = [
        test_script_exists, test_script_structure, test_slow_query_integration,
        test_index_optimization_integration, test_json_summary, test_alert_threshold,
        test_dingtalk_notification, test_report_cleanup, test_report_directory,
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
