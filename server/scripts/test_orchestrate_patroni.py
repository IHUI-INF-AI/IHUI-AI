#!/usr/bin/env python3
"""Patroni 生产部署实战编排脚本验证测试"""
import sys
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = SERVER_DIR / "scripts"
SCRIPT = SCRIPTS_DIR / "orchestrate_patroni_deploy.sh"


def test_script_exists():
    """测试 1: 脚本存在"""
    assert SCRIPT.exists(), f"缺少脚本: {SCRIPT}"
    print("✅ 测试 1 通过: 脚本存在")


def test_script_structure():
    """测试 2: 脚本结构完整 (7 步流程)"""
    content = SCRIPT.read_text(encoding="utf-8")
    steps = ["环境检查", "dry-run 预检", "部署 Patroni 集群", "验证主节点选举", "故障转移演练", "读写端口测试", "生成报告"]
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
    assert '"operation": "patroni_deploy_orchestration"' in content, "缺少 operation 字段"
    assert '"leader"' in content, "缺少 leader 字段"
    assert '"failover_drill"' in content, "缺少 failover_drill 字段"
    assert '"cluster"' in content, "缺少 cluster 字段"
    assert '"write_port": 5000' in content, "缺少 write_port"
    assert '"read_port": 5001' in content, "缺少 read_port"
    print("✅ 测试 4 通过: JSON 报告生成")


def test_deploy_script_integration():
    """测试 5: 集成 deploy_patroni_production.sh"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "deploy_patroni_production.sh" in content, "未集成 deploy_patroni_production.sh"
    assert "deploy_patroni_production.sh --dry-run" in content, "缺少 dry-run 调用"
    print("✅ 测试 5 通过: 集成 deploy_patroni_production.sh")


def test_failover_drill_integration():
    """测试 6: 集成故障转移演练"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "patroni_failover_drill.sh" in content, "未集成故障转移演练脚本"
    assert "FAILOVER_RESULT" in content, "缺少故障转移结果变量"
    print("✅ 测试 6 通过: 集成故障转移演练")


def test_leader_election_check():
    """测试 7: 主节点选举验证"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "patronictl list" in content, "缺少 patronictl list"
    assert "Leader" in content, "缺少 Leader 角色检查"
    assert "LEADER" in content, "缺少 LEADER 变量"
    print("✅ 测试 7 通过: 主节点选举验证")


def test_read_write_test():
    """测试 8: 读写端口测试"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "5000" in content, "缺少写端口 5000"
    assert "5001" in content, "缺少读端口 5001"
    assert "pg_is_in_recovery" in content, "缺少 pg_is_in_recovery 查询"
    print("✅ 测试 8 通过: 读写端口测试")


def test_haproxy_stats_check():
    """测试 9: HAProxy stats 检查"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "7000" in content, "缺少 stats 端口 7000"
    assert "curl -sf http://localhost:7000" in content, "缺少 HAProxy stats 检查"
    print("✅ 测试 9 通过: HAProxy stats 检查")


def test_compose_file_check():
    """测试 10: compose 文件检查"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "deploy/docker/docker-compose.patroni-ha.yml" in content, "缺少 patroni-ha compose 引用"
    assert "haproxy.cfg" in content, "缺少 haproxy.cfg 检查"
    print("✅ 测试 10 通过: compose 文件检查")


def main():
    print("=" * 60)
    print("Patroni 生产部署实战编排脚本验证")
    print("=" * 60)
    tests = [
        test_script_exists, test_script_structure, test_dry_run_support,
        test_json_report, test_deploy_script_integration, test_failover_drill_integration,
        test_leader_election_check, test_read_write_test, test_haproxy_stats_check,
        test_compose_file_check,
    ]
    for t in tests:
        t()
    print("=" * 60)
    print(f"✅ 全部 {len(tests)} 项测试通过")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
