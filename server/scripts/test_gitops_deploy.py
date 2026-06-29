#!/usr/bin/env python3
"""GitOps 部署配置测试 - gitops_deploy.sh

验证项:
1. 脚本存在
2. 8 步骤流程
3. 参数解析: --env / --dry-run / --auto-confirm / --repo / --branch / --dir
4. GitOps 仓库配置
5. Helm chart 校验
6. 用户确认机制
7. 自动回滚
8. Pod 验证
9. JSON 报告生成
10. 命名空间隔离
"""
import os
import sys
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPT = SERVER_DIR / "scripts" / "gitops_deploy.sh"

passed = 0
failed = 0


def test_case(name: str, ok: bool, detail: str = "") -> None:
    global passed, failed
    if ok:
        passed += 1
        print(f"  ✅ {name}")
    else:
        failed += 1
        print(f"  ✅ {name} -- {detail}")


def main() -> int:
    print("=" * 60)
    print("P2-10 GitOps 部署配置测试")
    print("=" * 60)

    # 1. 脚本存在
    test_case("脚本存在", SCRIPT.exists(), str(SCRIPT))

    content = SCRIPT.read_text(encoding="utf-8")

    # 2. 8 步骤流程
    steps = ["1/8", "2/8", "3/8", "4/8", "5/8", "6/8", "7/8", "8/8"]
    for step in steps:
        test_case(f"包含步骤 {step}", step in content, f"缺少步骤 {step}")

    # 3. 参数解析
    params = ["--env", "--dry-run", "--auto-confirm", "--repo", "--branch", "--dir"]
    for p in params:
        test_case(f"参数 {p}", p in content, f"缺少 {p}")

    # 4. GitOps 仓库配置
    test_case("GITOPS_REPO 变量", "GITOPS_REPO" in content, "")
    test_case("GITOPS_BRANCH 变量", "GITOPS_BRANCH" in content, "")
    test_case("默认 GitHub 仓库", "github.com" in content, "")

    # 5. Helm chart 校验
    test_case("helm lint", "helm lint" in content, "")
    test_case("values 文件", "values-" in content, "")

    # 6. 用户确认机制
    test_case("AUTO_CONFIRM 变量", "AUTO_CONFIRM" in content, "")
    test_case("用户确认逻辑", "等待用户确认" in content or "确认" in content, "")

    # 7. 自动回滚
    test_case("helm rollback", "helm rollback" in content, "")

    # 8. Pod 验证
    test_case("kubectl get pods", "kubectl get pods" in content, "")
    test_case("Pod 统计", "POD_READY" in content and "POD_TOTAL" in content, "")

    # 9. JSON 报告
    test_case("JSON 报告", "REPORT_FILE" in content, "")
    test_case("JSON 包含 operation", '"operation":' in content, "")
    test_case("JSON 包含 environment", '"environment":' in content, "")
    test_case("JSON 包含 namespace", '"namespace":' in content, "")
    test_case("JSON 包含 git_commit", '"git_commit":' in content, "")
    test_case("JSON 包含 deploy_status", '"deploy_status":' in content, "")

    # 10. 命名空间隔离
    test_case("K8S_NAMESPACE_PREFIX", "K8S_NAMESPACE_PREFIX" in content, "")
    test_case("命名空间拼接", "zhs-${ENV}" in content or "${K8S_NAMESPACE_PREFIX}-${ENV}" in content, "")

    # 11. 工具检查
    tools = ["git", "helm", "kubectl"]
    for t in tools:
        test_case(f"检查工具 {t}", f"command -v {t}" in content, f"缺少 {t} 检查")

    # 12. KUBECONFIG
    test_case("KUBECONFIG_PATH", "KUBECONFIG_PATH" in content, "")

    # 13. set -euo pipefail
    test_case("set -euo pipefail", "set -euo pipefail" in content, "")

    # 14. diff 计算
    test_case("helm template", "helm template" in content, "")

    print("=" * 60)
    print(f"通过: {passed} / 失败: {failed}")
    print("=" * 60)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
