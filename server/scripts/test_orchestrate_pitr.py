#!/usr/bin/env python3
"""PITR 生产演练编排脚本验证测试"""
import sys
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = SERVER_DIR / "scripts"
SCRIPT = SCRIPTS_DIR / "orchestrate_pitr_drill.sh"


def test_script_exists():
    """测试 1: 脚本存在"""
    assert SCRIPT.exists(), f"缺少脚本: {SCRIPT}"
    print("✅ 测试 1 通过: 脚本存在")


def test_script_structure():
    """测试 2: 脚本结构完整 (6 步流程)"""
    content = SCRIPT.read_text(encoding="utf-8")
    steps = ["环境检查", "dry-run 预检", "全量备份", "执行 PITR 演练", "RTO/RPO 评估", "生成报告"]
    for i, step in enumerate(steps, 1):
        assert step in content, f"缺少步骤 {i}: {step}"
    print("✅ 测试 2 通过: 6 步流程完整")


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
    assert '"operation": "pitr_drill_orchestration"' in content, "缺少 operation 字段"
    assert '"rto_seconds"' in content, "缺少 rto_seconds"
    assert '"rpo_seconds"' in content, "缺少 rpo_seconds"
    assert '"drill_result"' in content, "缺少 drill_result"
    assert '"rto_target": 300' in content, "缺少 rto_target"
    assert '"rpo_target": 0' in content, "缺少 rpo_target"
    print("✅ 测试 4 通过: JSON 报告生成")


def test_drill_script_integration():
    """测试 5: 集成 pitr_production_drill.sh"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "pitr_production_drill.sh" in content, "未集成 PITR 演练脚本"
    assert "pitr_production_drill.sh --dry-run" in content, "缺少 dry-run 调用"
    print("✅ 测试 5 通过: 集成 PITR 演练脚本")


def test_backup_integration():
    """测试 6: 集成加密备份"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "backup_pg_encrypted.sh" in content, "未集成加密备份脚本"
    print("✅ 测试 6 通过: 集成加密备份")


def test_archive_mode_check():
    """测试 7: archive_mode 检查"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "archive_mode" in content, "缺少 archive_mode 检查"
    assert "SHOW archive_mode" in content, "缺少 archive_mode 查询"
    print("✅ 测试 7 通过: archive_mode 检查")


def test_rto_evaluation():
    """测试 8: RTO 评估"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "RTO" in content, "缺少 RTO"
    assert "DRILL_START" in content, "缺少演练开始时间"
    assert "DRILL_END" in content, "缺少演练结束时间"
    assert "300" in content, "缺少 RTO 目标 300s"
    print("✅ 测试 8 通过: RTO 评估")


def test_rpo_evaluation():
    """测试 9: RPO 评估"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "RPO" in content, "缺少 RPO"
    assert "RPO=0" in content, "缺少 RPO=0 设置"
    print("✅ 测试 9 通过: RPO 评估")


def test_pg_connectivity_check():
    """测试 10: PostgreSQL 连通性检查"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "pg_isready" in content, "缺少 pg_isready 检查"
    assert "127.0.0.1" in content, "缺少主机地址"
    assert "5432" in content, "缺少端口 5432"
    print("✅ 测试 10 通过: PostgreSQL 连通性检查")


def main():
    print("=" * 60)
    print("PITR 生产演练编排脚本验证")
    print("=" * 60)
    tests = [
        test_script_exists, test_script_structure, test_dry_run_support,
        test_json_report, test_drill_script_integration, test_backup_integration,
        test_archive_mode_check, test_rto_evaluation, test_rpo_evaluation,
        test_pg_connectivity_check,
    ]
    for t in tests:
        t()
    print("=" * 60)
    print(f"✅ 全部 {len(tests)} 项测试通过")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
