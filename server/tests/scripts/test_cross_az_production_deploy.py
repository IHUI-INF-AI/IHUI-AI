#!/usr/bin/env python3
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))
"""跨 AZ 生产部署脚本验证测试"""
import sys
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = SERVER_DIR / "scripts"
SCRIPT = SCRIPTS_DIR / "deploy_pg_cross_az_production.sh"


def test_script_exists():
    """测试 1: 脚本存在"""
    assert SCRIPT.exists(), f"缺少脚本: {SCRIPT}"
    print("✅ 测试 1 通过: 脚本存在")


def test_script_structure():
    """测试 2: 脚本结构完整 (7 步流程)"""
    content = SCRIPT.read_text(encoding="utf-8")
    steps = ["预检", "部署 AZ-A", "部署 AZ-B", "部署 AZ-C", "配置 HAProxy", "跨 AZ 灾备演练", "生成报告"]
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
    assert '"operation": "pg_cross_az_production_deploy"' in content, "缺少 operation 字段"
    assert '"architecture"' in content, "缺少 architecture 字段"
    assert '"az_a"' in content, "缺少 az_a"
    assert '"az_b"' in content, "缺少 az_b"
    assert '"az_c"' in content, "缺少 az_c"
    assert '"rto_target_seconds"' in content, "缺少 rto_target_seconds"
    assert '"rpo_target_seconds"' in content, "缺少 rpo_target_seconds"
    print("✅ 测试 4 通过: JSON 报告生成")


def test_az_a_leader():
    """测试 5: AZ-A Leader 部署"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "AZ-A" in content, "缺少 AZ-A"
    assert "Leader" in content, "缺少 Leader 角色"
    assert "synchronous_commit=on" in content, "缺少 synchronous_commit 配置"
    print("✅ 测试 5 通过: AZ-A Leader 部署")


def test_az_b_sync_replica():
    """测试 6: AZ-B Sync Replica 部署"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "AZ-B" in content, "缺少 AZ-B"
    assert "Sync Replica" in content, "缺少 Sync Replica"
    assert "synchronous replication" in content, "缺少同步复制说明"
    assert "RPO = 0" in content, "缺少 RPO=0 声明"
    print("✅ 测试 6 通过: AZ-B Sync Replica 部署")


def test_az_c_async_replica():
    """测试 7: AZ-C Async Replica 部署"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "AZ-C" in content, "缺少 AZ-C"
    assert "Async Replica" in content, "缺少 Async Replica"
    assert "asynchronous replication" in content, "缺少异步复制说明"
    assert "城市级灾备" in content, "缺少城市级灾备说明"
    print("✅ 测试 7 通过: AZ-C Async Replica 部署")


def test_haproxy_backup_mode():
    """测试 8: HAProxy backup 模式"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "backup" in content, "缺少 backup 模式"
    assert "5000" in content, "缺少写端口 5000"
    assert "5001" in content, "缺少读端口 5001"
    assert "7000" in content, "缺少 stats 端口 7000"
    print("✅ 测试 8 通过: HAProxy backup 模式")


def test_drill_integration():
    """测试 9: 灾备演练集成"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "pg_cross_az_drill.sh" in content, "未集成灾备演练脚本"
    assert "跨 AZ 灾备演练" in content, "缺少灾备演练步骤"
    print("✅ 测试 9 通过: 灾备演练集成")


def test_rto_rpo_targets():
    """测试 10: RTO/RPO 目标"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "RTO" in content, "缺少 RTO"
    assert "RPO" in content, "缺少 RPO"
    assert "30" in content, "缺少 RTO 30 秒目标"
    print("✅ 测试 10 通过: RTO/RPO 目标")


def main():
    print("=" * 60)
    print("跨 AZ 生产部署脚本验证")
    print("=" * 60)
    tests = [
        test_script_exists, test_script_structure, test_dry_run_support,
        test_json_report, test_az_a_leader, test_az_b_sync_replica,
        test_az_c_async_replica, test_haproxy_backup_mode, test_drill_integration,
        test_rto_rpo_targets,
    ]
    for t in tests:
        t()
    print("=" * 60)
    print(f"✅ 全部 {len(tests)} 项测试通过")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
