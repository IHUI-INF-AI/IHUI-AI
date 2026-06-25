#!/usr/bin/env python3
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))
"""PG16 生产升级部署脚本验证测试"""
import os
import sys
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = SERVER_DIR / "scripts"
DOCS_DIR = SERVER_DIR / "docs"


def test_script_exists():
    """测试 1: 部署脚本存在"""
    script = SCRIPTS_DIR / "deploy_pg16_production.sh"
    assert script.exists(), f"缺少部署脚本: {script}"
    assert os.access(script, os.R_OK), "脚本不可读"
    print("✅ 测试 1 通过: 部署脚本存在")


def test_script_structure():
    """测试 2: 脚本结构完整 (7 步流程)"""
    content = (SCRIPTS_DIR / "deploy_pg16_production.sh").read_text(encoding="utf-8")
    steps = ["预检", "加密备份", "启动 PG16", "数据迁移", "应用切换", "冒烟测试", "清理与报告"]
    for i, step in enumerate(steps, 1):
        assert step in content, f"缺少步骤 {i}: {step}"
    print("✅ 测试 2 通过: 7 步流程完整")


def test_dry_run_support():
    """测试 3: 支持 dry-run 模式"""
    content = (SCRIPTS_DIR / "deploy_pg16_production.sh").read_text(encoding="utf-8")
    assert "--dry-run" in content, "缺少 --dry-run 参数"
    assert "DRY_RUN=1" in content, "缺少 DRY_RUN 变量"
    assert "dry_run_passed" in content, "缺少 dry-run 报告状态"
    print("✅ 测试 3 通过: dry-run 模式支持")


def test_json_report():
    """测试 4: JSON 报告生成"""
    content = (SCRIPTS_DIR / "deploy_pg16_production.sh").read_text(encoding="utf-8")
    assert "generate_report" in content, "缺少 generate_report 函数"
    assert '"operation": "pg16_production_upgrade"' in content, "缺少 operation 字段"
    assert '"status"' in content, "缺少 status 字段"
    assert '"duration_seconds"' in content, "缺少 duration_seconds 字段"
    assert '"rollback_triggered"' in content, "缺少 rollback_triggered 字段"
    assert '"previous_version": "14"' in content, "缺少 previous_version"
    assert '"target_version": "16"' in content, "缺少 target_version"
    print("✅ 测试 4 通过: JSON 报告生成")


def test_rollback_logic():
    """测试 5: 自动回滚逻辑"""
    content = (SCRIPTS_DIR / "deploy_pg16_production.sh").read_text(encoding="utf-8")
    assert "ROLLBACK_TRIGGERED=1" in content, "缺少回滚触发标记"
    assert "回滚" in content, "缺少回滚逻辑"
    assert "deploy/docker/docker-compose.yml.bak" in content, "缺少 compose 备份恢复"
    assert "mv" in content, "缺少文件恢复命令"
    print("✅ 测试 5 通过: 自动回滚逻辑")


def test_logging():
    """测试 6: 日志记录"""
    content = (SCRIPTS_DIR / "deploy_pg16_production.sh").read_text(encoding="utf-8")
    assert "LOG_FILE" in content, "缺少 LOG_FILE 变量"
    assert "tee -a" in content, "缺少 tee 日志输出"
    assert "LOG_DIR" in content, "缺少 LOG_DIR 变量"
    assert "mkdir -p" in content, "缺少日志目录创建"
    print("✅ 测试 6 通过: 日志记录")


def test_encrypted_backup_integration():
    """测试 7: 加密备份集成"""
    content = (SCRIPTS_DIR / "deploy_pg16_production.sh").read_text(encoding="utf-8")
    assert "backup_pg_encrypted.sh" in content, "未集成加密备份脚本"
    assert "加密备份" in content, "缺少加密备份步骤说明"
    print("✅ 测试 7 通过: 加密备份集成")


def test_smoke_test():
    """测试 8: 冒烟测试集成"""
    content = (SCRIPTS_DIR / "deploy_pg16_production.sh").read_text(encoding="utf-8")
    assert "healthz" in content, "缺少 API 健康检查"
    assert "SELECT 1" in content, "缺少数据库连通性测试"
    assert "冒烟测试" in content, "缺少冒烟测试步骤"
    print("✅ 测试 8 通过: 冒烟测试集成")


def test_image_switch():
    """测试 9: 镜像切换逻辑"""
    content = (SCRIPTS_DIR / "deploy_pg16_production.sh").read_text(encoding="utf-8")
    assert "postgres:14-alpine" in content, "缺少 PG14 镜像引用"
    assert "postgres:16-alpine" in content, "缺少 PG16 镜像引用"
    assert "sed" in content, "缺少 sed 镜像替换"
    assert ".bak" in content, "缺少备份文件"
    print("✅ 测试 9 通过: 镜像切换逻辑")


def test_cleanup():
    """测试 10: 清理逻辑"""
    content = (SCRIPTS_DIR / "deploy_pg16_production.sh").read_text(encoding="utf-8")
    assert "deploy/docker/docker-compose.pg16-upgrade.yml" in content, "缺少 PG16 compose 引用"
    assert "down" in content, "缺少容器下线命令"
    assert "rm -f" in content, "缺少文件清理"
    print("✅ 测试 10 通过: 清理逻辑")


def test_documentation():
    """测试 11: 文档存在"""
    doc = DOCS_DIR / "PG16_PRODUCTION_DEPLOYMENT.md"
    assert doc.exists(), f"缺少文档: {doc}"
    content = doc.read_text(encoding="utf-8")
    assert "升级方案" in content, "文档缺少升级方案"
    assert "回滚方案" in content, "文档缺少回滚方案"
    assert "风险评估" in content, "文档缺少风险评估"
    print("✅ 测试 11 通过: 文档完整")


def main():
    print("=" * 60)
    print("PG16 生产升级部署脚本验证")
    print("=" * 60)
    tests = [
        test_script_exists, test_script_structure, test_dry_run_support,
        test_json_report, test_rollback_logic, test_logging,
        test_encrypted_backup_integration, test_smoke_test, test_image_switch,
        test_cleanup, test_documentation,
    ]
    for t in tests:
        t()
    print("=" * 60)
    print(f"✅ 全部 {len(tests)} 项测试通过")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
