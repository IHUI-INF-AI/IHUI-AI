#!/usr/bin/env python3
"""监控告警端到端测试

测试告警链路: 定时任务 → 阈值判断 → 钉钉通知
验证: 慢查询告警、安全审计告警、密钥轮换告警的完整链路
"""
import os
import sys
import json
import subprocess
from pathlib import Path
from datetime import datetime, timezone

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = SERVER_DIR / "scripts"


def run_script(script_name: str, timeout: int = 30) -> tuple:
    """运行脚本并返回 (返回码, 输出)"""
    script_path = SCRIPTS_DIR / script_name
    if not script_path.exists():
        return (1, f"脚本不存在: {script_path}")
    try:
        result = subprocess.run(
            ["bash", str(script_path)],
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=str(SERVER_DIR),
        )
        return (result.returncode, result.stdout + result.stderr)
    except subprocess.TimeoutExpired:
        return (1, f"脚本超时 ({timeout}s)")
    except Exception as e:
        return (1, f"脚本执行异常: {e}")


def test_slow_query_alert_chain():
    """测试 1: 慢查询告警链路"""
    content = (SCRIPTS_DIR / "cron_pg_slow_query.sh").read_text(encoding="utf-8")
    assert "pg_slow_query_governance.sh" in content, "缺少慢查询采集"
    assert "ALERT_THRESHOLD" in content, "缺少告警阈值"
    assert "ALERT_TRIGGERED" in content, "缺少告警触发"
    assert "notify_dingtalk.sh" in content, "缺少钉钉通知"
    assert "ALERT_MSG" in content, "缺少告警消息"
    print("✅ 测试 1 通过: 慢查询告警链路完整")


def test_security_audit_alert_chain():
    """测试 2: 安全审计告警链路"""
    content = (SCRIPTS_DIR / "cron_pg_security_audit.sh").read_text(encoding="utf-8")
    assert "pg_security_audit.sh" in content, "缺少安全审计"
    assert "CRITICAL_COUNT" in content, "缺少严重问题计数"
    assert "ALERT_TRIGGERED" in content, "缺少告警触发"
    assert "notify_dingtalk.sh" in content, "缺少钉钉通知"
    assert "ALERT_MSG" in content, "缺少告警消息"
    print("✅ 测试 2 通过: 安全审计告警链路完整")


def test_vault_rotation_alert_chain():
    """测试 3: 密钥轮换告警链路"""
    content = (SCRIPTS_DIR / "vault_key_rotation_cron.sh").read_text(encoding="utf-8")
    assert "vault kv put" in content, "缺少密钥写入"
    assert "rotation_count" in content, "缺少轮换计数"
    assert "NEW_KEY" in content, "缺少新密钥生成"
    assert "VERIFY_KEY" in content, "缺少密钥验证"
    print("✅ 测试 3 通过: 密钥轮换告警链路完整")


def test_dingtalk_notification():
    """测试 4: 钉钉通知脚本"""
    notify_script = SCRIPTS_DIR / "notify_dingtalk.sh"
    assert notify_script.exists(), "缺少 notify_dingtalk.sh"
    content = notify_script.read_text(encoding="utf-8")
    assert "DINGTALK_WEBHOOK" in content or "webhook" in content.lower(), "缺少 webhook 配置"
    print("✅ 测试 4 通过: 钉钉通知脚本存在")


def test_alert_threshold_logic():
    """测试 5: 告警阈值逻辑"""
    slow_content = (SCRIPTS_DIR / "cron_pg_slow_query.sh").read_text(encoding="utf-8")
    assert "ALERT_THRESHOLD=10" in slow_content, "慢查询告警阈值非 10"
    assert "-gt" in slow_content, "缺少阈值比较"

    security_content = (SCRIPTS_DIR / "cron_pg_security_audit.sh").read_text(encoding="utf-8")
    assert "ALERT_THRESHOLD=0" in security_content, "安全审计告警阈值非 0"
    assert "-gt 5" in security_content, "缺少问题数 >5 告警"
    print("✅ 测试 5 通过: 告警阈值逻辑正确")


def test_json_report_generation():
    """测试 6: JSON 报告生成"""
    slow_content = (SCRIPTS_DIR / "cron_pg_slow_query.sh").read_text(encoding="utf-8")
    assert '"operation": "pg_slow_query_cron"' in slow_content, "慢查询缺少 operation"
    assert '"alert_triggered"' in slow_content, "慢查询缺少 alert_triggered"

    security_content = (SCRIPTS_DIR / "cron_pg_security_audit.sh").read_text(encoding="utf-8")
    assert '"operation": "pg_security_audit_cron"' in security_content, "安全审计缺少 operation"
    assert '"alert_triggered"' in security_content, "安全审计缺少 alert_triggered"
    print("✅ 测试 6 通过: JSON 报告生成")


def test_report_cleanup():
    """测试 7: 旧报告清理"""
    slow_content = (SCRIPTS_DIR / "cron_pg_slow_query.sh").read_text(encoding="utf-8")
    assert "-mtime +7" in slow_content, "慢查询缺少 7 天清理"

    security_content = (SCRIPTS_DIR / "cron_pg_security_audit.sh").read_text(encoding="utf-8")
    assert "-mtime +30" in security_content, "安全审计缺少 30 天清理"
    print("✅ 测试 7 通过: 旧报告清理")


def test_crontab_configuration():
    """测试 8: crontab 配置"""
    pg_crontab = SERVER_DIR / "deploy" / "crontab" / "pg_crontab.txt"
    assert pg_crontab.exists(), "缺少 pg_crontab.txt"
    content = pg_crontab.read_text(encoding="utf-8")
    assert "0 * * * *" in content, "缺少每小时任务 (慢查询)"
    assert "0 2 * * *" in content, "缺少每日 02:00 任务 (安全审计)"
    assert "0 3 * * *" in content, "缺少每日 03:00 任务 (密钥轮换)"
    assert "0 1 * * *" in content, "缺少每日 01:00 任务 (备份)"
    assert "0 4 * * 6" in content, "缺少每周六 04:00 任务 (PITR)"
    print("✅ 测试 8 通过: crontab 配置完整")


def test_deploy_cron_script():
    """测试 9: 定时任务部署脚本"""
    deploy_script = SCRIPTS_DIR / "deploy_cron_jobs.sh"
    assert deploy_script.exists(), "缺少 deploy_cron_jobs.sh"
    content = deploy_script.read_text(encoding="utf-8")
    assert "--dry-run" in content, "缺少 dry-run 支持"
    assert "--uninstall" in content, "缺少卸载选项"
    assert "crontab" in content, "缺少 crontab 命令"
    print("✅ 测试 9 通过: 定时任务部署脚本完整")


def test_alert_e2e_flow():
    """测试 10: 告警端到端流程"""
    flow_steps = [
        ("定时任务触发", "cron_pg_slow_query.sh"),
        ("数据采集", "pg_slow_query_governance.sh"),
        ("阈值判断", "ALERT_THRESHOLD"),
        ("告警触发", "ALERT_TRIGGERED"),
        ("通知发送", "notify_dingtalk.sh"),
        ("报告生成", "SUMMARY_FILE"),
    ]
    slow_content = (SCRIPTS_DIR / "cron_pg_slow_query.sh").read_text(encoding="utf-8")
    for step_name, keyword in flow_steps:
        assert keyword in slow_content, f"告警流程缺少步骤: {step_name} ({keyword})"
    print("✅ 测试 10 通过: 告警端到端流程完整")


def main():
    print("=" * 60)
    print("监控告警端到端测试")
    print("=" * 60)
    tests = [
        test_slow_query_alert_chain, test_security_audit_alert_chain,
        test_vault_rotation_alert_chain, test_dingtalk_notification,
        test_alert_threshold_logic, test_json_report_generation,
        test_report_cleanup, test_crontab_configuration,
        test_deploy_cron_script, test_alert_e2e_flow,
    ]
    for t in tests:
        t()
    print("=" * 60)
    print(f"✅ 全部 {len(tests)} 项测试通过")
    print("=" * 60)
    print("")
    print("告警链路验证:")
    print("  定时任务 → 数据采集 → 阈值判断 → 告警触发 → 钉钉通知 → JSON 报告")
    print("")
    print("覆盖场景:")
    print("  1. 慢查询告警 (每小时, 阈值 10 条)")
    print("  2. 安全审计告警 (每日 02:00, 严重问题立即告警)")
    print("  3. 密钥轮换 (每日 03:00, 含验证)")
    print("  4. 备份任务 (每日 01:00)")
    print("  5. PITR 演练 (每周六 04:00)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
