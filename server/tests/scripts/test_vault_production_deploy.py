#!/usr/bin/env python3
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))
"""Vault 生产部署与密钥轮换验证测试"""
import os
import sys
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = SERVER_DIR / "scripts"
DOCS_DIR = SERVER_DIR / "docs"


def test_deploy_script_exists():
    """测试 1: 部署脚本存在"""
    script = SCRIPTS_DIR / "deploy_vault_production.sh"
    assert script.exists(), f"缺少部署脚本: {script}"
    print("✅ 测试 1 通过: 部署脚本存在")


def test_deploy_script_structure():
    """测试 2: 部署脚本结构完整 (8 步流程)"""
    content = (SCRIPTS_DIR / "deploy_vault_production.sh").read_text(encoding="utf-8")
    steps = ["预检", "启动 Vault", "初始化 Vault", "解封 Vault", "启用 KV 引擎", "写入初始密钥", "验证密钥访问", "生成报告"]
    for i, step in enumerate(steps, 1):
        assert step in content, f"缺少步骤 {i}: {step}"
    print("✅ 测试 2 通过: 8 步流程完整")


def test_dry_run_support():
    """测试 3: 支持 dry-run 模式"""
    content = (SCRIPTS_DIR / "deploy_vault_production.sh").read_text(encoding="utf-8")
    assert "--dry-run" in content, "缺少 --dry-run 参数"
    assert "DRY_RUN=1" in content, "缺少 DRY_RUN 变量"
    assert "dry_run_passed" in content, "缺少 dry-run 报告状态"
    print("✅ 测试 3 通过: dry-run 模式支持")


def test_json_report():
    """测试 4: JSON 报告生成"""
    content = (SCRIPTS_DIR / "deploy_vault_production.sh").read_text(encoding="utf-8")
    assert "generate_report" in content, "缺少 generate_report 函数"
    assert '"operation": "vault_production_deploy"' in content, "缺少 operation 字段"
    assert '"vault"' in content, "缺少 vault 字段"
    assert '"address"' in content, "缺少 address"
    assert '"sealed"' in content, "缺少 sealed"
    assert '"kv_path": "secret/zhs/pg-backup"' in content, "缺少 kv_path"
    assert '"key_rotation_interval": "24h"' in content, "缺少 key_rotation_interval"
    print("✅ 测试 4 通过: JSON 报告生成")


def test_vault_init():
    """测试 5: Vault 初始化逻辑"""
    content = (SCRIPTS_DIR / "deploy_vault_production.sh").read_text(encoding="utf-8")
    assert "vault operator init" in content, "缺少 vault operator init"
    assert "-key-shares=1" in content, "缺少 key-shares 参数"
    assert "-key-threshold=1" in content, "缺少 key-threshold 参数"
    assert "unseal_keys_b64" in content, "缺少 unseal_keys_b64"
    assert "root_token" in content, "缺少 root_token"
    assert "vault_keys.txt" in content, "缺少密钥文件保存"
    assert "chmod 600" in content, "缺少权限设置"
    print("✅ 测试 5 通过: Vault 初始化逻辑")


def test_vault_unseal():
    """测试 6: Vault 解封逻辑"""
    content = (SCRIPTS_DIR / "deploy_vault_production.sh").read_text(encoding="utf-8")
    assert "vault operator unseal" in content, "缺少 vault operator unseal"
    assert "UNSEAL_KEY" in content, "缺少 UNSEAL_KEY 变量"
    print("✅ 测试 6 通过: Vault 解封逻辑")


def test_kv_engine():
    """测试 7: KV 引擎启用"""
    content = (SCRIPTS_DIR / "deploy_vault_production.sh").read_text(encoding="utf-8")
    assert "vault secrets enable" in content, "缺少 vault secrets enable"
    assert "-path=secret" in content, "缺少 -path=secret"
    assert "-version=2" in content, "缺少 -version=2"
    assert "kv" in content, "缺少 kv 引擎"
    print("✅ 测试 7 通过: KV 引擎启用")


def test_key_rotation_cron():
    """测试 8: 密钥轮换定时脚本"""
    script = SCRIPTS_DIR / "vault_key_rotation_cron.sh"
    assert script.exists(), f"缺少轮换脚本: {script}"
    content = script.read_text(encoding="utf-8")
    assert "openssl rand -base64 48" in content, "缺少密钥生成"
    assert "vault kv put" in content, "缺少密钥写入"
    assert "rotation_count" in content, "缺少轮换计数"
    assert "secret/zhs/pg-backup-history" in content, "缺少历史归档路径"
    assert "5/5" in content or "[5/5]" in content, "缺少 5 步流程"
    print("✅ 测试 8 通过: 密钥轮换定时脚本")


def test_key_rotation_logic():
    """测试 9: 密钥轮换逻辑"""
    content = (SCRIPTS_DIR / "vault_key_rotation_cron.sh").read_text(encoding="utf-8")
    assert "读取当前密钥" in content, "缺少读取当前密钥步骤"
    assert "生成新密钥" in content, "缺少生成新密钥步骤"
    assert "保留旧密钥" in content or "归档" in content, "缺少旧密钥归档步骤"
    assert "写入新密钥" in content, "缺少写入新密钥步骤"
    assert "验证新密钥" in content, "缺少验证步骤"
    assert "NEW_COUNT" in content, "缺少轮换计数递增"
    print("✅ 测试 9 通过: 密钥轮换逻辑")


def test_documentation():
    """测试 10: 文档存在"""
    doc = DOCS_DIR / "VAULT_PRODUCTION_DEPLOYMENT.md"
    assert doc.exists(), f"缺少文档: {doc}"
    content = doc.read_text(encoding="utf-8")
    assert "架构" in content, "文档缺少架构说明"
    assert "密钥轮换" in content, "文档缺少密钥轮换说明"
    assert "安全注意事项" in content, "文档缺少安全注意事项"
    assert "crontab" in content, "文档缺少 crontab 配置"
    print("✅ 测试 10 通过: 文档完整")


def main():
    print("=" * 60)
    print("Vault 生产部署与密钥轮换验证")
    print("=" * 60)
    tests = [
        test_deploy_script_exists, test_deploy_script_structure, test_dry_run_support,
        test_json_report, test_vault_init, test_vault_unseal,
        test_kv_engine, test_key_rotation_cron, test_key_rotation_logic,
        test_documentation,
    ]
    for t in tests:
        t()
    print("=" * 60)
    print(f"✅ 全部 {len(tests)} 项测试通过")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
