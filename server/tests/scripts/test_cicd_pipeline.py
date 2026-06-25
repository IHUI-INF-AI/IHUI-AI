#!/usr/bin/env python3
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))
"""CI/CD Pipeline 验证测试"""
import sys
import yaml
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
WORKFLOW = SERVER_DIR / ".github" / "workflows" / "pg_deploy_cicd.yml"


def test_workflow_exists():
    """测试 1: workflow 文件存在"""
    assert WORKFLOW.exists(), f"缺少 workflow: {WORKFLOW}"
    print("✅ 测试 1 通过: workflow 文件存在")


def test_yaml_valid():
    """测试 2: YAML 语法有效"""
    content = WORKFLOW.read_text(encoding="utf-8")
    try:
        data = yaml.safe_load(content)
        assert data is not None, "YAML 解析为空"
    except yaml.YAMLError as e:
        raise AssertionError(f"YAML 语法错误: {e}")
    print("✅ 测试 2 通过: YAML 语法有效")


def test_workflow_name():
    """测试 3: workflow 名称"""
    data = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))
    name = data.get("name", "")
    assert "PostgreSQL" in name or "PG" in name, f"workflow 名称不规范: {name}"
    print("✅ 测试 3 通过: workflow 名称")


def test_trigger_events():
    """测试 4: 触发事件"""
    data = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))
    on = data.get(True, data.get("on", {}))  # YAML 1.1: on 解析为 True
    assert "push" in on, "缺少 push 触发"
    assert "workflow_dispatch" in on, "缺少 workflow_dispatch 触发"
    print("✅ 测试 4 通过: 触发事件")


def test_precheck_job():
    """测试 5: 预检任务"""
    data = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))
    jobs = data.get("jobs", {})
    assert "precheck" in jobs, "缺少 precheck 任务"
    precheck = jobs["precheck"]
    assert "steps" in precheck, "precheck 缺少 steps"
    assert len(precheck["steps"]) >= 3, "precheck 步骤不足"
    print("✅ 测试 5 通过: 预检任务")


def test_test_job():
    """测试 6: 单元测试任务"""
    data = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))
    jobs = data.get("jobs", {})
    assert "test" in jobs, "缺少 test 任务"
    test_job = jobs["test"]
    assert test_job.get("needs") == "precheck", "test 任务缺少 precheck 依赖"
    print("✅ 测试 6 通过: 单元测试任务")


def test_staging_job():
    """测试 7: Staging 部署任务"""
    data = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))
    jobs = data.get("jobs", {})
    assert "deploy-staging" in jobs, "缺少 deploy-staging 任务"
    staging = jobs["deploy-staging"]
    assert staging.get("needs") == "test", "staging 缺少 test 依赖"
    assert staging.get("environment") == "staging", "staging environment 不正确"
    print("✅ 测试 7 通过: Staging 部署任务")


def test_production_job():
    """测试 8: 生产部署任务"""
    data = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))
    jobs = data.get("jobs", {})
    assert "deploy-production" in jobs, "缺少 deploy-production 任务"
    prod = jobs["deploy-production"]
    assert prod.get("environment") == "production", "production environment 不正确"
    print("✅ 测试 8 通过: 生产部署任务")


def test_runner_integration():
    """测试 9: 集成 prod_execution_runner.sh"""
    content = WORKFLOW.read_text(encoding="utf-8")
    assert "prod_execution_runner.sh" in content, "未集成 prod_execution_runner.sh"
    assert "--auto-confirm" in content, "缺少 --auto-confirm 参数"
    assert "--task=" in content, "缺少 --task 参数"
    print("✅ 测试 9 通过: 集成 prod_execution_runner.sh")


def test_notifications():
    """测试 10: 部署结果通知"""
    content = WORKFLOW.read_text(encoding="utf-8")
    assert "notify_dingtalk.sh" in content or "钉钉" in content or "notify" in content.lower(), "缺少通知配置"
    print("✅ 测试 10 通过: 部署结果通知")


def main():
    print("=" * 60)
    print("CI/CD Pipeline 验证")
    print("=" * 60)
    tests = [
        test_workflow_exists, test_yaml_valid, test_workflow_name,
        test_trigger_events, test_precheck_job, test_test_job,
        test_staging_job, test_production_job, test_runner_integration,
        test_notifications,
    ]
    for t in tests:
        t()
    print("=" * 60)
    print(f"✅ 全部 {len(tests)} 项测试通过")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
