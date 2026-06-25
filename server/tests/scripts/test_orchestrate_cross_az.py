#!/usr/bin/env python3
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))
"""跨 AZ 生产部署编排脚本验证测试"""
import sys
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = SERVER_DIR / "scripts"
SCRIPT = SCRIPTS_DIR / "orchestrate_cross_az_deploy.sh"


def test_script_exists():
    """测试 1: 脚本存在"""
    assert SCRIPT.exists(), f"缺少脚本: {SCRIPT}"
    print("✅ 测试 1 通过: 脚本存在")


def test_script_structure():
    """测试 2: 脚本结构完整 (6 步流程)"""
    content = SCRIPT.read_text(encoding="utf-8")
    steps = ["环境检查", "dry-run 预检", "部署 3 AZ", "跨 AZ 灾备演练", "RTO/RPO 验证", "生成报告"]
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
    assert '"operation": "cross_az_deploy_orchestration"' in content, "缺少 operation 字段"
    assert '"drill_result"' in content, "缺少 drill_result"
    assert '"rto_seconds"' in content, "缺少 rto_seconds"
    assert '"rpo_seconds"' in content, "缺少 rpo_seconds"
    assert '"architecture"' in content, "缺少 architecture"
    assert '"az_a": "leader"' in content, "缺少 az_a"
    assert '"az_b": "sync_replica"' in content, "缺少 az_b"
    assert '"az_c": "async_replica"' in content, "缺少 az_c"
    print("✅ 测试 4 通过: JSON 报告生成")


def test_deploy_script_integration():
    """测试 5: 集成 deploy_pg_cross_az_production.sh"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "deploy_pg_cross_az_production.sh" in content, "未集成跨 AZ 部署脚本"
    assert "deploy_pg_cross_az_production.sh --dry-run" in content, "缺少 dry-run 调用"
    print("✅ 测试 5 通过: 集成跨 AZ 部署脚本")


def test_drill_integration():
    """测试 6: 集成灾备演练"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "pg_cross_az_drill.sh" in content, "未集成灾备演练脚本"
    assert "DRILL_RESULT" in content, "缺少演练结果变量"
    print("✅ 测试 6 通过: 集成灾备演练")


def test_rto_evaluation():
    """测试 7: RTO 评估"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "RTO" in content, "缺少 RTO"
    assert "DRILL_START" in content, "缺少演练开始时间"
    assert "DRILL_END" in content, "缺少演练结束时间"
    assert "-le 30" in content, "缺少 RTO 目标 30s"
    print("✅ 测试 7 通过: RTO 评估")


def test_rpo_evaluation():
    """测试 8: RPO 评估"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "RPO" in content, "缺少 RPO"
    assert "RPO=0" in content, "缺少 RPO=0 设置"
    assert "AZ-C 异步 RPO <5s" in content, "缺少 AZ-C RPO 说明"
    print("✅ 测试 8 通过: RPO 评估")


def test_doc_check():
    """测试 9: 文档检查"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "PG_CROSS_AZ_DEPLOYMENT.md" in content, "缺少部署文档检查"
    print("✅ 测试 9 通过: 文档检查")


def test_compose_check():
    """测试 10: compose 文件检查"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "deploy/docker/docker-compose.patroni-ha.yml" in content, "缺少 patroni-ha compose 检查"
    print("✅ 测试 10 通过: compose 文件检查")


def main():
    print("=" * 60)
    print("跨 AZ 生产部署编排脚本验证")
    print("=" * 60)
    tests = [
        test_script_exists, test_script_structure, test_dry_run_support,
        test_json_report, test_deploy_script_integration, test_drill_integration,
        test_rto_evaluation, test_rpo_evaluation, test_doc_check,
        test_compose_check,
    ]
    for t in tests:
        t()
    print("=" * 60)
    print(f"✅ 全部 {len(tests)} 项测试通过")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
