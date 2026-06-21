#!/usr/bin/env python3
"""PG16 生产升级实战编排脚本验证测试"""
import sys
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = SERVER_DIR / "scripts"
SCRIPT = SCRIPTS_DIR / "orchestrate_pg16_upgrade.sh"


def test_script_exists():
    """测试 1: 脚本存在"""
    assert SCRIPT.exists(), f"缺少脚本: {SCRIPT}"
    print("✅ 测试 1 通过: 脚本存在")


def test_script_structure():
    """测试 2: 脚本结构完整 (7 步流程)"""
    content = SCRIPT.read_text(encoding="utf-8")
    steps = ["环境检查", "dry-run 预检", "全量备份", "执行 PG16 升级", "应用冒烟测试", "验证 PG 版本", "生成报告"]
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


def test_skip_backup_option():
    """测试 4: 支持 --skip-backup 选项"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "--skip-backup" in content, "缺少 --skip-backup 参数"
    assert "SKIP_BACKUP=1" in content, "缺少 SKIP_BACKUP 变量"
    print("✅ 测试 4 通过: --skip-backup 选项")


def test_json_report():
    """测试 5: JSON 报告生成"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "generate_report" in content, "缺少 generate_report 函数"
    assert '"operation": "pg16_upgrade_orchestration"' in content, "缺少 operation 字段"
    assert '"backup_size_mb"' in content, "缺少 backup_size_mb"
    assert '"smoke_test"' in content, "缺少 smoke_test"
    assert '"scripts_used"' in content, "缺少 scripts_used"
    print("✅ 测试 5 通过: JSON 报告生成")


def test_deploy_script_integration():
    """测试 6: 集成 deploy_pg16_production.sh"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "deploy_pg16_production.sh" in content, "未集成 deploy_pg16_production.sh"
    assert "deploy_pg16_production.sh --dry-run" in content, "缺少 dry-run 调用"
    print("✅ 测试 6 通过: 集成 deploy_pg16_production.sh")


def test_backup_integration():
    """测试 7: 集成加密备份"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "backup_pg_encrypted.sh" in content, "未集成加密备份脚本"
    assert "BACKUP_SIZE" in content, "缺少备份大小记录"
    assert "BACKUP_DURATION" in content, "缺少备份耗时记录"
    print("✅ 测试 7 通过: 集成加密备份")


def test_smoke_test():
    """测试 8: 冒烟测试"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "healthz" in content, "缺少 API 健康检查"
    assert "SELECT version" in content, "缺少 PG 版本验证"
    assert "SMOKE_RESULT" in content, "缺少冒烟测试结果变量"
    assert "passed" in content, "缺少 passed 状态"
    assert "failed" in content, "缺少 failed 状态"
    print("✅ 测试 8 通过: 冒烟测试")


def test_pg_version_check():
    """测试 9: PG 版本检查"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "SHOW server_version" in content, "缺少 server_version 查询"
    assert 'grep -q "^16"' in content, "缺少 PG16 版本验证"
    print("✅ 测试 9 通过: PG 版本检查")


def test_compose_detection():
    """测试 10: docker compose 检测"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "docker compose version" in content, "缺少 docker compose 检测"
    assert "docker-compose" in content, "缺少 docker-compose 备选"
    assert "COMPOSE_CMD" in content, "缺少 COMPOSE_CMD 变量"
    print("✅ 测试 10 通过: docker compose 检测")


def main():
    print("=" * 60)
    print("PG16 生产升级实战编排脚本验证")
    print("=" * 60)
    tests = [
        test_script_exists, test_script_structure, test_dry_run_support,
        test_skip_backup_option, test_json_report, test_deploy_script_integration,
        test_backup_integration, test_smoke_test, test_pg_version_check,
        test_compose_detection,
    ]
    for t in tests:
        t()
    print("=" * 60)
    print(f"✅ 全部 {len(tests)} 项测试通过")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
