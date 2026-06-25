#!/usr/bin/env python3
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))
"""pgBouncer 连接串切换工具验证测试"""
import sys
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = SERVER_DIR / "scripts"
SCRIPT = SCRIPTS_DIR / "switch_pgbouncer_connection.py"


def test_script_exists():
    """测试 1: 脚本存在"""
    assert SCRIPT.exists(), f"缺少脚本: {SCRIPT}"
    print("✅ 测试 1 通过: 脚本存在")


def test_four_commands():
    """测试 2: 支持 4 个命令"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "cmd_check" in content, "缺少 check 命令"
    assert "cmd_switch" in content, "缺少 switch 命令"
    assert "cmd_revert" in content, "缺少 revert 命令"
    assert "cmd_status" in content, "缺少 status 命令"
    assert '"check": cmd_check' in content, "缺少 check 命令映射"
    assert '"switch": cmd_switch' in content, "缺少 switch 命令映射"
    assert '"revert": cmd_revert' in content, "缺少 revert 命令映射"
    assert '"status": cmd_status' in content, "缺少 status 命令映射"
    print("✅ 测试 2 通过: 4 个命令支持")


def test_port_constants():
    """测试 3: 端口常量定义"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "PG_DIRECT_PORT = 5432" in content, "缺少 PG_DIRECT_PORT"
    assert "PG_BOUNCER_PORT = 6432" in content, "缺少 PG_BOUNCER_PORT"
    print("✅ 测试 3 通过: 端口常量定义")


def test_port_check():
    """测试 4: 端口连通性检查"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "check_port" in content, "缺少 check_port 函数"
    assert "socket.create_connection" in content, "缺少 socket 连接"
    assert "socket.timeout" in content, "缺少超时处理"
    print("✅ 测试 4 通过: 端口连通性检查")


def test_state_persistence():
    """测试 5: 状态持久化"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "STATE_FILE" in content, "缺少 STATE_FILE"
    assert "load_state" in content, "缺少 load_state 函数"
    assert "save_state" in content, "缺少 save_state 函数"
    assert "pgbouncer_switch_state.json" in content, "缺少状态文件名"
    print("✅ 测试 5 通过: 状态持久化")


def test_env_file_handling():
    """测试 6: .env 文件处理"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "ENV_FILE" in content, "缺少 ENV_FILE"
    assert ".env" in content, "缺少 .env 文件引用"
    assert "PG_PORT=" in content, "缺少 PG_PORT 配置"
    assert "PG_HOST=" in content, "缺少 PG_HOST 配置"
    print("✅ 测试 6 通过: .env 文件处理")


def test_switch_logic():
    """测试 7: 切换逻辑"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "PG_BOUNCER_PORT" in content, "切换逻辑缺少 pgBouncer 端口"
    assert "previous" in content, "缺少 previous 状态保存"
    assert "current" in content, "缺少 current 状态保存"
    assert "switched_at" in content, "缺少切换时间记录"
    print("✅ 测试 7 通过: 切换逻辑")


def test_revert_logic():
    """测试 8: 回滚逻辑"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "cmd_revert" in content, "缺少回滚命令"
    assert "previous" in content, "回滚缺少 previous 状态"
    assert "unlink" in content, "缺少状态文件清理"
    assert "回滚" in content, "缺少回滚提示"
    print("✅ 测试 8 通过: 回滚逻辑")


def test_status_display():
    """测试 9: 状态显示"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "cmd_status" in content, "缺少状态命令"
    assert "模式" in content, "缺少模式显示"
    assert "直连" in content, "缺少直连模式标识"
    assert "连接池" in content, "缺少连接池模式标识"
    print("✅ 测试 9 通过: 状态显示")


def test_restart_hint():
    """测试 10: 重启提示"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "docker compose restart api" in content, "缺少重启提示"
    assert "回滚命令" in content, "缺少回滚命令提示"
    print("✅ 测试 10 通过: 重启提示")


def main():
    print("=" * 60)
    print("pgBouncer 连接串切换工具验证")
    print("=" * 60)
    tests = [
        test_script_exists, test_four_commands, test_port_constants,
        test_port_check, test_state_persistence, test_env_file_handling,
        test_switch_logic, test_revert_logic, test_status_display,
        test_restart_hint,
    ]
    for t in tests:
        t()
    print("=" * 60)
    print(f"✅ 全部 {len(tests)} 项测试通过")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
