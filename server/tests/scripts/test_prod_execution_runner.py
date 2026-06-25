#!/usr/bin/env python3
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))
"""生产环境实战执行 Runner 验证测试"""
import sys
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = SERVER_DIR / "scripts"
SCRIPT = SCRIPTS_DIR / "prod_execution_runner.sh"


def test_script_exists():
    """测试 1: 脚本存在"""
    assert SCRIPT.exists(), f"缺少脚本: {SCRIPT}"
    print("✅ 测试 1 通过: 脚本存在")


def test_script_structure():
    """测试 2: 脚本结构完整 (3 步流程)"""
    content = SCRIPT.read_text(encoding="utf-8")
    steps = ["预检", "用户确认", "执行任务"]
    for i, step in enumerate(steps, 1):
        assert step in content, f"缺少步骤 {i}: {step}"
    print("✅ 测试 2 通过: 3 步流程完整")


def test_task_selection():
    """测试 3: 支持任务选择"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "--task=" in content, "缺少 --task 参数"
    assert "pg16" in content, "缺少 pg16 任务"
    assert "patroni" in content, "缺少 patroni 任务"
    assert "vault" in content, "缺少 vault 任务"
    assert "all" in content, "缺少 all 选项"
    print("✅ 测试 3 通过: 任务选择")


def test_dry_run_support():
    """测试 4: 支持 dry-run 模式"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "--dry-run" in content, "缺少 --dry-run 参数"
    assert "DRY_RUN=1" in content, "缺少 DRY_RUN 变量"
    assert "dry_run_passed" in content, "缺少 dry-run 报告状态"
    print("✅ 测试 4 通过: dry-run 模式支持")


def test_auto_confirm():
    """测试 5: 支持自动确认"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "--auto-confirm" in content, "缺少 --auto-confirm 参数"
    assert "AUTO_CONFIRM" in content, "缺少 AUTO_CONFIRM 变量"
    print("✅ 测试 5 通过: 自动确认")


def test_user_confirm():
    """测试 6: 用户确认逻辑"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "请确认是否继续" in content, "缺少用户确认提示"
    assert "yes" in content, "缺少 yes 确认"
    assert "cancelled" in content, "缺少取消状态"
    print("✅ 测试 6 通过: 用户确认逻辑")


def test_json_report():
    """测试 7: JSON 报告生成"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "generate_report" in content, "缺少 generate_report 函数"
    assert '"operation": "prod_execution_runner"' in content, "缺少 operation 字段"
    assert '"task"' in content, "缺少 task 字段"
    assert '"task_results"' in content, "缺少 task_results"
    assert '"auto_confirm"' in content, "缺少 auto_confirm"
    assert '"dry_run"' in content, "缺少 dry_run"
    print("✅ 测试 7 通过: JSON 报告生成")


def test_task_list():
    """测试 8: 任务清单"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "TASKS=()" in content, "缺少 TASKS 数组"
    assert "orchestrate_pg16_upgrade.sh" in content, "缺少 PG16 编排脚本"
    assert "orchestrate_patroni_deploy.sh" in content, "缺少 Patroni 编排脚本"
    assert "orchestrate_vault_deploy.sh" in content, "缺少 Vault 编排脚本"
    print("✅ 测试 8 通过: 任务清单")


def test_task_execution():
    """测试 9: 任务执行逻辑"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "TASK_START" in content, "缺少任务开始时间"
    assert "TASK_END" in content, "缺少任务结束时间"
    assert "TASK_DURATION" in content, "缺少任务耗时"
    assert "TASK_STATUS" in content, "缺少任务状态"
    assert "passed" in content, "缺少 passed 状态"
    assert "failed" in content, "缺少 failed 状态"
    print("✅ 测试 9 通过: 任务执行逻辑")


def test_task_results_json():
    """测试 10: 任务结果 JSON 数组"""
    content = SCRIPT.read_text(encoding="utf-8")
    assert "TASK_RESULTS" in content, "缺少 TASK_RESULTS 变量"
    assert "TASK_RESULTS+=" in content, "缺少 TASK_RESULTS 追加逻辑"
    assert 'name' in content and "status" in content, "缺少任务结果 JSON"
    assert "duration" in content, "缺少 duration 字段"
    print("✅ 测试 10 通过: 任务结果 JSON 数组")


def main():
    print("=" * 60)
    print("生产环境实战执行 Runner 验证")
    print("=" * 60)
    tests = [
        test_script_exists, test_script_structure, test_task_selection,
        test_dry_run_support, test_auto_confirm, test_user_confirm,
        test_json_report, test_task_list, test_task_execution,
        test_task_results_json,
    ]
    for t in tests:
        t()
    print("=" * 60)
    print(f"✅ 全部 {len(tests)} 项测试通过")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
