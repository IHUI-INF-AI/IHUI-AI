#!/usr/bin/env python3
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))
"""Patroni 生产部署脚本验证测试"""
import os
import sys
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = SERVER_DIR / "scripts"
DOCS_DIR = SERVER_DIR / "docs"


def test_script_exists():
    """测试 1: 部署脚本存在"""
    script = SCRIPTS_DIR / "deploy_patroni_production.sh"
    assert script.exists(), f"缺少部署脚本: {script}"
    print("✅ 测试 1 通过: 部署脚本存在")


def test_script_structure():
    """测试 2: 脚本结构完整 (7 步流程)"""
    content = (SCRIPTS_DIR / "deploy_patroni_production.sh").read_text(encoding="utf-8")
    steps = ["预检", "部署 etcd", "部署 Patroni", "部署 HAProxy", "集群初始化验证", "故障转移演练", "生成报告"]
    for i, step in enumerate(steps, 1):
        assert step in content, f"缺少步骤 {i}: {step}"
    print("✅ 测试 2 通过: 7 步流程完整")


def test_dry_run_support():
    """测试 3: 支持 dry-run 模式"""
    content = (SCRIPTS_DIR / "deploy_patroni_production.sh").read_text(encoding="utf-8")
    assert "--dry-run" in content, "缺少 --dry-run 参数"
    assert "DRY_RUN=1" in content, "缺少 DRY_RUN 变量"
    assert "dry_run_passed" in content, "缺少 dry-run 报告状态"
    print("✅ 测试 3 通过: dry-run 模式支持")


def test_json_report():
    """测试 4: JSON 报告生成"""
    content = (SCRIPTS_DIR / "deploy_patroni_production.sh").read_text(encoding="utf-8")
    assert "generate_report" in content, "缺少 generate_report 函数"
    assert '"operation": "patroni_production_deploy"' in content, "缺少 operation 字段"
    assert '"cluster"' in content, "缺少 cluster 字段"
    assert '"scope": "zhs"' in content, "缺少 scope"
    assert '"nodes": 3' in content, "缺少 nodes"
    assert '"leader"' in content, "缺少 leader"
    assert '"haproxy_write_port": 5000' in content, "缺少 haproxy_write_port"
    assert '"haproxy_read_port": 5001' in content, "缺少 haproxy_read_port"
    print("✅ 测试 4 通过: JSON 报告生成")


def test_etcd_deployment():
    """测试 5: etcd 集群部署"""
    content = (SCRIPTS_DIR / "deploy_patroni_production.sh").read_text(encoding="utf-8")
    assert "etcd1" in content and "etcd2" in content and "etcd3" in content, "缺少 etcd 节点"
    assert "etcdctl endpoint health" in content, "缺少 etcd 健康检查"
    assert "etcd" in content, "缺少 etcd 引用"
    print("✅ 测试 5 通过: etcd 集群部署")


def test_patroni_deployment():
    """测试 6: Patroni 节点部署"""
    content = (SCRIPTS_DIR / "deploy_patroni_production.sh").read_text(encoding="utf-8")
    assert "patroni1" in content and "patroni2" in content and "patroni3" in content, "缺少 Patroni 节点"
    assert "patronictl list" in content, "缺少 patronictl 命令"
    assert "Leader" in content, "缺少 Leader 角色检查"
    print("✅ 测试 6 通过: Patroni 节点部署")


def test_haproxy_deployment():
    """测试 7: HAProxy 部署"""
    content = (SCRIPTS_DIR / "deploy_patroni_production.sh").read_text(encoding="utf-8")
    assert "haproxy" in content, "缺少 HAProxy 引用"
    assert "5000" in content, "缺少写端口 5000"
    assert "5001" in content, "缺少读端口 5001"
    assert "7000" in content, "缺少 stats 端口 7000"
    print("✅ 测试 7 通过: HAProxy 部署")


def test_failover_drill_integration():
    """测试 8: 故障转移演练集成"""
    content = (SCRIPTS_DIR / "deploy_patroni_production.sh").read_text(encoding="utf-8")
    assert "patroni_failover_drill.sh" in content, "未集成故障转移演练脚本"
    assert "故障转移演练" in content, "缺少故障转移演练步骤"
    print("✅ 测试 8 通过: 故障转移演练集成")


def test_logging():
    """测试 9: 日志记录"""
    content = (SCRIPTS_DIR / "deploy_patroni_production.sh").read_text(encoding="utf-8")
    assert "LOG_FILE" in content, "缺少 LOG_FILE 变量"
    assert "tee -a" in content, "缺少 tee 日志输出"
    assert "LOG_DIR" in content, "缺少 LOG_DIR 变量"
    print("✅ 测试 9 通过: 日志记录")


def test_documentation():
    """测试 10: 文档存在"""
    doc = DOCS_DIR / "PATRONI_PRODUCTION_DEPLOYMENT.md"
    assert doc.exists(), f"缺少文档: {doc}"
    content = doc.read_text(encoding="utf-8")
    assert "架构" in content, "文档缺少架构说明"
    assert "故障转移" in content, "文档缺少故障转移说明"
    assert "端口说明" in content, "文档缺少端口说明"
    assert "回滚" in content, "文档缺少回滚方案"
    print("✅ 测试 10 通过: 文档完整")


def main():
    print("=" * 60)
    print("Patroni 生产部署脚本验证")
    print("=" * 60)
    tests = [
        test_script_exists, test_script_structure, test_dry_run_support,
        test_json_report, test_etcd_deployment, test_patroni_deployment,
        test_haproxy_deployment, test_failover_drill_integration, test_logging,
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
