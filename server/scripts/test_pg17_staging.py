#!/usr/bin/env python3
"""PostgreSQL 17 staging 环境准备脚本验证测试"""
import sys
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = SERVER_DIR / "scripts"
SCRIPT = SCRIPTS_DIR / "prepare_pg17_staging.sh"
COMPOSE_FILE = SERVER_DIR / "deploy" / "docker" / "docker-compose.pg17-staging.yml"


def test_script_exists():
    """测试 1: 脚本存在"""
    assert SCRIPT.exists(), f"缺少脚本: {SCRIPT}"
    print("✅ 测试 1 通过: 脚本存在")


def test_compose_exists():
    """测试 2: compose 文件存在"""
    assert COMPOSE_FILE.exists(), f"缺少 compose 文件: {COMPOSE_FILE}"
    print("✅ 测试 2 通过: compose 文件存在")


def test_script_structure():
    """测试 3: 脚本结构完整 (7 步流程)"""
    content = SCRIPT.read_text(encoding="utf-8")
    steps = ["预检", "启动 PG17", "数据迁移", "兼容性测试", "增量备份测试", "JSON_TABLE 测试", "生成报告"]
    for i, step in enumerate(steps, 1):
        assert step in content, f"缺少步骤 {i}: {step}"
    print("✅ 测试 3 通过: 7 步流程完整")


def test_dry_run_support():
    """测试 4: 支持 dry-run 模式"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "--dry-run" in content, "缺少 --dry-run 参数"
    assert "DRY_RUN=1" in content, "缺少 DRY_RUN 变量"
    assert "dry_run_passed" in content, "缺少 dry-run 报告状态"
    print("✅ 测试 4 通过: dry-run 模式支持")


def test_json_report():
    """测试 5: JSON 报告生成"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "generate_report" in content, "缺少 generate_report 函数"
    assert '"operation": "pg17_staging_preparation"' in content, "缺少 operation 字段"
    assert '"pg_version"' in content, "缺少 pg_version"
    assert '"compatibility_test"' in content, "缺少 compatibility_test"
    assert '"incremental_backup_test"' in content, "缺少 incremental_backup_test"
    assert '"json_table_test"' in content, "缺少 json_table_test"
    assert '"staging_port": 5434' in content, "缺少 staging_port"
    print("✅ 测试 5 通过: JSON 报告生成")


def test_compose_pg17_image():
    """测试 6: PG17 镜像"""
    content = COMPOSE_FILE.read_text(encoding="utf-8")
    assert "postgres:17-alpine" in content, "缺少 PG17 镜像"
    print("✅ 测试 6 通过: PG17 镜像")


def test_compose_port():
    """测试 7: 端口配置"""
    content = COMPOSE_FILE.read_text(encoding="utf-8")
    assert "5434:5432" in content, "缺少端口 5434"
    print("✅ 测试 7 通过: 端口配置")


def test_compose_volume():
    """测试 8: 独立数据卷"""
    content = COMPOSE_FILE.read_text(encoding="utf-8")
    assert "pg17_staging_data" in content, "缺少独立数据卷"
    print("✅ 测试 8 通过: 独立数据卷")


def test_data_migration():
    """测试 9: 数据迁移逻辑"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "pg_dump" in content, "缺少 pg_dump"
    assert "5433" in content, "缺少 PG16 端口 5433"
    assert "5434" in content, "缺少 PG17 端口 5434"
    assert "zhs_ai_project" in content, "缺少数据库迁移"
    print("✅ 测试 9 通过: 数据迁移逻辑")


def test_feature_tests():
    """测试 10: 新特性测试"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "--incremental" in content, "缺少增量备份测试"
    assert "JSON_TABLE" in content, "缺少 JSON_TABLE 测试"
    assert "pg_basebackup" in content, "缺少 pg_basebackup"
    print("✅ 测试 10 通过: 新特性测试")


def main():
    print("=" * 60)
    print("PostgreSQL 17 staging 环境准备脚本验证")
    print("=" * 60)
    tests = [
        test_script_exists, test_compose_exists, test_script_structure,
        test_dry_run_support, test_json_report, test_compose_pg17_image,
        test_compose_port, test_compose_volume, test_data_migration,
        test_feature_tests,
    ]
    for t in tests:
        t()
    print("=" * 60)
    print(f"✅ 全部 {len(tests)} 项测试通过")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
