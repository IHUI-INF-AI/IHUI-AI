#!/usr/bin/env python3
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))
"""pgBouncer 生产切换编排脚本验证测试"""
import sys
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = SERVER_DIR / "scripts"
SCRIPT = SCRIPTS_DIR / "orchestrate_pgbouncer_switch.sh"


def test_script_exists():
    """测试 1: 脚本存在"""
    assert SCRIPT.exists(), f"缺少脚本: {SCRIPT}"
    print("✅ 测试 1 通过: 脚本存在")


def test_script_structure():
    """测试 2: 脚本结构完整 (6 步流程)"""
    content = SCRIPT.read_text(encoding="utf-8")
    steps = ["环境检查", "pgBouncer 健康检查", "执行", "重启应用", "验证应用", "生成报告"]
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


def test_revert_option():
    """测试 4: 支持 --revert 选项"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "--revert" in content, "缺少 --revert 参数"
    assert "REVERT=1" in content, "缺少 REVERT 变量"
    print("✅ 测试 4 通过: --revert 选项")


def test_json_report():
    """测试 5: JSON 报告生成"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "generate_report" in content, "缺少 generate_report 函数"
    assert '"operation": "pgbouncer_switch_orchestration"' in content, "缺少 operation 字段"
    assert '"mode"' in content, "缺少 mode 字段"
    assert '"app_restarted"' in content, "缺少 app_restarted"
    assert '"target_port": 6432' in content, "缺少 target_port"
    assert '"previous_port": 5432' in content, "缺少 previous_port"
    print("✅ 测试 5 通过: JSON 报告生成")


def test_switch_tool_integration():
    """测试 6: 集成 switch_pgbouncer_connection.py"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "switch_pgbouncer_connection.py" in content, "未集成切换工具"
    assert "check" in content, "缺少 check 调用"
    assert "switch" in content, "缺少 switch 调用"
    assert "revert" in content, "缺少 revert 调用"
    assert "status" in content, "缺少 status 调用"
    print("✅ 测试 6 通过: 集成切换工具")


def test_app_restart():
    """测试 7: 应用重启"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "docker compose" in content, "缺少 docker compose"
    assert "restart api" in content, "缺少 api 重启"
    assert "APP_RESTARTED" in content, "缺少重启状态变量"
    print("✅ 测试 7 通过: 应用重启")


def test_health_check():
    """测试 8: 健康检查"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "healthz" in content, "缺少 API 健康检查"
    assert "curl -sf http://localhost:8000/healthz" in content, "缺少健康检查命令"
    print("✅ 测试 8 通过: 健康检查")


def test_mode_detection():
    """测试 9: 模式检测"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "MODE=" in content, "缺少 MODE 变量"
    assert "revert" in content, "缺少 revert 模式"
    assert "switch" in content, "缺少 switch 模式"
    print("✅ 测试 9 通过: 模式检测")


def test_rollback_hint():
    """测试 10: 回滚提示"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "回滚命令" in content, "缺少回滚命令提示"
    assert "--revert" in content, "缺少回滚参数提示"
    print("✅ 测试 10 通过: 回滚提示")


def main():
    print("=" * 60)
    print("pgBouncer 生产切换编排脚本验证")
    print("=" * 60)
    tests = [
        test_script_exists, test_script_structure, test_dry_run_support,
        test_revert_option, test_json_report, test_switch_tool_integration,
        test_app_restart, test_health_check, test_mode_detection,
        test_rollback_hint,
    ]
    for t in tests:
        t()
    print("=" * 60)
    print(f"✅ 全部 {len(tests)} 项测试通过")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
