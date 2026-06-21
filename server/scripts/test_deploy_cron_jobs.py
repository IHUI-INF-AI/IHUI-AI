#!/usr/bin/env python3
"""定时任务部署脚本验证测试"""
import sys
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = SERVER_DIR / "scripts"
SCRIPT = SCRIPTS_DIR / "deploy_cron_jobs.sh"
PG_CRONTAB = SERVER_DIR / "deploy" / "crontab" / "pg_crontab.txt"
VAULT_CRONTAB = SERVER_DIR / "deploy" / "crontab" / "vault_crontab.txt"


def test_script_exists():
    """测试 1: 脚本存在"""
    assert SCRIPT.exists(), f"缺少脚本: {SCRIPT}"
    print("✅ 测试 1 通过: 脚本存在")


def test_script_structure():
    """测试 2: 脚本结构完整 (5 步流程)"""
    content = SCRIPT.read_text(encoding="utf-8")
    steps = ["检查 crontab", "检查 crontab 文件", "处理卸载模式", "安装定时任务", "验证"]
    for i, step in enumerate(steps, 1):
        assert step in content, f"缺少步骤 {i}: {step}"
    print("✅ 测试 2 通过: 5 步流程完整")


def test_dry_run_support():
    """测试 3: 支持 dry-run 模式"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "--dry-run" in content, "缺少 --dry-run 参数"
    assert "DRY_RUN=1" in content, "缺少 DRY_RUN 变量"
    assert "dry_run_passed" in content, "缺少 dry-run 报告状态"
    print("✅ 测试 3 通过: dry-run 模式支持")


def test_uninstall_option():
    """测试 4: 支持 --uninstall 选项"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "--uninstall" in content, "缺少 --uninstall 参数"
    assert "UNINSTALL=1" in content, "缺少 UNINSTALL 变量"
    assert "crontab -r" in content, "缺少 crontab -r 卸载命令"
    print("✅ 测试 4 通过: --uninstall 选项")


def test_json_report():
    """测试 5: JSON 报告生成"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "generate_report" in content, "缺少 generate_report 函数"
    assert '"operation": "cron_jobs_deploy"' in content, "缺少 operation 字段"
    assert '"installed"' in content, "缺少 installed"
    assert '"task_count"' in content, "缺少 task_count"
    assert '"crontab_files"' in content, "缺少 crontab_files"
    print("✅ 测试 5 通过: JSON 报告生成")


def test_pg_crontab_exists():
    """测试 6: PG crontab 文件存在"""
    assert PG_CRONTAB.exists(), f"缺少 PG crontab: {PG_CRONTAB}"
    content = PG_CRONTAB.read_text(encoding="utf-8")
    assert "cron_pg_slow_query.sh" in content, "缺少慢查询任务"
    assert "cron_pg_security_audit.sh" in content, "缺少安全审计任务"
    assert "backup_pg_encrypted.sh" in content, "缺少备份任务"
    assert "pitr_production_drill.sh" in content, "缺少 PITR 演练任务"
    print("✅ 测试 6 通过: PG crontab 文件存在")


def test_vault_crontab_exists():
    """测试 7: Vault crontab 文件存在"""
    assert VAULT_CRONTAB.exists(), f"缺少 Vault crontab: {VAULT_CRONTAB}"
    content = VAULT_CRONTAB.read_text(encoding="utf-8")
    assert "vault_key_rotation_cron.sh" in content, "缺少密钥轮换任务"
    assert "pg_backup_key_manager.sh" in content, "缺少密钥验证任务"
    print("✅ 测试 7 通过: Vault crontab 文件存在")


def test_crontab_merge():
    """测试 8: crontab 合并逻辑"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "MERGED_FILE" in content, "缺少 MERGED_FILE 变量"
    assert "cat" in content, "缺少 cat 合并命令"
    assert "merged_crontab" in content, "缺少合并文件名"
    print("✅ 测试 8 通过: crontab 合并逻辑")


def test_crontab_install():
    """测试 9: crontab 安装"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert 'crontab "${MERGED_FILE}"' in content, "缺少 crontab 安装命令"
    assert "crontab -l" in content, "缺少 crontab -l 验证命令"
    assert "INSTALLED" in content, "缺少安装状态变量"
    print("✅ 测试 9 通过: crontab 安装")


def test_task_count():
    """测试 10: 任务计数"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "TASK_COUNT" in content, "缺少 TASK_COUNT 变量"
    assert "grep -c" in content, "缺少 grep -c 计数"
    print("✅ 测试 10 通过: 任务计数")


def main():
    print("=" * 60)
    print("定时任务部署脚本验证")
    print("=" * 60)
    tests = [
        test_script_exists, test_script_structure, test_dry_run_support,
        test_uninstall_option, test_json_report, test_pg_crontab_exists,
        test_vault_crontab_exists, test_crontab_merge, test_crontab_install,
        test_task_count,
    ]
    for t in tests:
        t()
    print("=" * 60)
    print(f"✅ 全部 {len(tests)} 项测试通过")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
