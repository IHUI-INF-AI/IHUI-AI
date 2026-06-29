#!/usr/bin/env python3
"""pgBouncer + Patroni 集成生产化编排脚本验证测试"""
import sys
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = SERVER_DIR / "scripts"
SCRIPT = SCRIPTS_DIR / "orchestrate_pgbouncer_patroni.sh"


def test_script_exists():
    """测试 1: 脚本存在"""
    assert SCRIPT.exists(), f"缺少脚本: {SCRIPT}"
    print("✅ 测试 1 通过: 脚本存在")


def test_script_structure():
    """测试 2: 脚本结构完整 (7 步流程)"""
    content = SCRIPT.read_text(encoding="utf-8")
    steps = ["预检", "部署 Patroni", "部署 pgBouncer", "验证读写分离", "应用切换", "重启应用", "生成报告"]
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
    assert '"operation": "pgbouncer_patroni_orchestration"' in content, "缺少 operation 字段"
    assert '"patroni_status"' in content, "缺少 patroni_status"
    assert '"pgbouncer_status"' in content, "缺少 pgbouncer_status"
    assert '"read_write_split"' in content, "缺少 read_write_split"
    assert '"app_switched"' in content, "缺少 app_switched"
    assert '"architecture"' in content, "缺少 architecture"
    assert "write_path" in content, "缺少 write_path"
    assert "read_path" in content, "缺少 read_path"
    print("✅ 测试 4 通过: JSON 报告生成")


def test_patroni_integration():
    """测试 5: 集成 Patroni 部署"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "orchestrate_patroni_deploy.sh" in content, "未集成 Patroni 部署脚本"
    print("✅ 测试 5 通过: 集成 Patroni 部署")


def test_pgbouncer_compose():
    """测试 6: pgBouncer compose 部署"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "deploy/docker/docker-compose.pgbouncer-patroni.yml" in content, "缺少 pgBouncer compose 引用"
    assert "docker compose" in content, "缺少 docker compose 命令"
    print("✅ 测试 6 通过: pgBouncer compose 部署")


def test_rw_split_verification():
    """测试 7: 读写分离验证"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "6432" in content, "缺少写端口 6432"
    assert "6433" in content, "缺少读端口 6433"
    assert "pg_is_in_recovery" in content, "缺少 pg_is_in_recovery 检查"
    assert "WRITE_RESULT" in content, "缺少写结果变量"
    assert "READ_RESULT" in content, "缺少读结果变量"
    print("✅ 测试 7 通过: 读写分离验证")


def test_app_switch():
    """测试 8: 应用切换"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "switch_pgbouncer_connection.py" in content, "未集成切换工具"
    assert "switch" in content, "缺少 switch 命令"
    assert "APP_SWITCHED" in content, "缺少切换状态变量"
    print("✅ 测试 8 通过: 应用切换")


def test_app_restart():
    """测试 9: 应用重启"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "restart api" in content, "缺少 api 重启"
    assert "healthz" in content, "缺少健康检查"
    print("✅ 测试 9 通过: 应用重启")


def test_compose_file_checks():
    """测试 10: compose 文件检查"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "deploy/docker/docker-compose.patroni-ha.yml" in content, "缺少 Patroni compose 检查"
    assert "deploy/docker/docker-compose.pgbouncer-patroni.yml" in content, "缺少 pgBouncer compose 检查"
    assert "pgbouncer_patroni.ini" in content, "缺少 pgBouncer ini 检查"
    print("✅ 测试 10 通过: compose 文件检查")


def main():
    print("=" * 60)
    print("pgBouncer + Patroni 集成生产化编排脚本验证")
    print("=" * 60)
    tests = [
        test_script_exists, test_script_structure, test_dry_run_support,
        test_json_report, test_patroni_integration, test_pgbouncer_compose,
        test_rw_split_verification, test_app_switch, test_app_restart,
        test_compose_file_checks,
    ]
    for t in tests:
        t()
    print("=" * 60)
    print(f"✅ 全部 {len(tests)} 项测试通过")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
