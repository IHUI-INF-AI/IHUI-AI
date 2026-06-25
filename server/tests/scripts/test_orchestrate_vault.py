#!/usr/bin/env python3
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))
"""Vault 生产部署实战编排脚本验证测试"""
import sys
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = SERVER_DIR / "scripts"
SCRIPT = SCRIPTS_DIR / "orchestrate_vault_deploy.sh"
CRONTAB_FILE = SERVER_DIR / "deploy" / "crontab" / "vault_crontab.txt"


def test_script_exists():
    """测试 1: 脚本存在"""
    assert SCRIPT.exists(), f"缺少脚本: {SCRIPT}"
    print("✅ 测试 1 通过: 脚本存在")


def test_script_structure():
    """测试 2: 脚本结构完整 (7 步流程)"""
    content = SCRIPT.read_text(encoding="utf-8")
    steps = ["环境检查", "dry-run 预检", "部署 Vault", "验证密钥访问", "配置 crontab", "测试密钥轮换", "生成报告"]
    for i, step in enumerate(steps, 1):
        assert step in content, f"缺少步骤 {i}: {step}"
    print("✅ 测试 2 通过: 7 步流程完整")


def test_dry_run_support():
    """测试 3: 支持 dry-run 模式"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "--dry-run" in content, "缺少 --dry-run 参数"
    assert "DRY_RUN=1" in content, "缺少 DRY_RUN 变量"
    assert "dry_run_passed" in content, "缺少 dry-run 报告状态"
    print("✅ 测试 3 通过: dry-run 模式支持")


def test_json_report():
    """测试 4: JSON 报告生成"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "generate_report" in content, "缺少 generate_report 函数"
    assert '"operation": "vault_deploy_orchestration"' in content, "缺少 operation 字段"
    assert '"vault_sealed"' in content, "缺少 vault_sealed"
    assert '"rotation_test"' in content, "缺少 rotation_test"
    assert '"crontab_installed"' in content, "缺少 crontab_installed"
    assert '"vault_address"' in content, "缺少 vault_address"
    print("✅ 测试 4 通过: JSON 报告生成")


def test_deploy_script_integration():
    """测试 5: 集成 deploy_vault_production.sh"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "deploy_vault_production.sh" in content, "未集成 deploy_vault_production.sh"
    assert "deploy_vault_production.sh --dry-run" in content, "缺少 dry-run 调用"
    print("✅ 测试 5 通过: 集成 deploy_vault_production.sh")


def test_key_manager_integration():
    """测试 6: 集成密钥管理脚本"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "pg_backup_key_manager.sh" in content, "未集成密钥管理脚本"
    assert "pg_backup_key_manager.sh verify" in content, "缺少 verify 调用"
    print("✅ 测试 6 通过: 集成密钥管理脚本")


def test_rotation_cron_integration():
    """测试 7: 集成密钥轮换脚本"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "vault_key_rotation_cron.sh" in content, "未集成密钥轮换脚本"
    assert "ROTATION_TEST" in content, "缺少轮换测试结果变量"
    print("✅ 测试 7 通过: 集成密钥轮换脚本")


def test_crontab_file_creation():
    """测试 8: crontab 文件创建"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "CRONTAB_FILE" in content, "缺少 CRONTAB_FILE 变量"
    assert "vault_crontab.txt" in content, "缺少 crontab 文件名"
    assert "cat > " in content, "缺少 crontab 文件创建"
    assert "0 3 * * *" in content, "缺少每日 03:00 轮换任务"
    assert "0 2 * * 0" in content, "缺少每周日 02:00 验证任务"
    print("✅ 测试 8 通过: crontab 文件创建")


def test_crontab_install():
    """测试 9: crontab 安装"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "crontab" in content, "缺少 crontab 命令"
    assert 'crontab "${CRONTAB_FILE}"' in content, "缺少 crontab 安装"
    assert "CRONTAB_INSTALLED" in content, "缺少安装状态变量"
    print("✅ 测试 9 通过: crontab 安装")


def test_crontab_file_exists():
    """测试 10: crontab 配置文件已生成"""
    assert CRONTAB_FILE.exists(), f"缺少 crontab 文件: {CRONTAB_FILE}"
    content = CRONTAB_FILE.read_text(encoding="utf-8")
    assert "vault_key_rotation_cron.sh" in content, "crontab 缺少轮换脚本"
    assert "pg_backup_key_manager.sh verify" in content, "crontab 缺少验证脚本"
    assert "VAULT_ADDR" in content, "crontab 缺少 VAULT_ADDR"
    print("✅ 测试 10 通过: crontab 配置文件已生成")


def main():
    print("=" * 60)
    print("Vault 生产部署实战编排脚本验证")
    print("=" * 60)
    tests = [
        test_script_exists, test_script_structure, test_dry_run_support,
        test_json_report, test_deploy_script_integration, test_key_manager_integration,
        test_rotation_cron_integration, test_crontab_file_creation, test_crontab_install,
        test_crontab_file_exists,
    ]
    for t in tests:
        t()
    print("=" * 60)
    print(f"✅ 全部 {len(tests)} 项测试通过")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
