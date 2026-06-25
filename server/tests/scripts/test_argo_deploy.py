#!/usr/bin/env python3
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))
"""ArgoCD 部署脚本测试 - argo_deploy.sh

验证项:
1. 脚本存在
2. 8 步骤流程
3. 4 个操作: --install / --apply / --status / --sync
4. kubectl 集成
5. Application 清单引用
6. AppProject / Application / ApplicationSet
7. 同步状态验证
8. JSON 报告
"""
import os
import sys
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPT = SERVER_DIR / "scripts" / "argo_deploy.sh"
ARGO_MANIFEST = SERVER_DIR / "deploy" / "argocd" / "argo_application.yaml"

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
    print("P0-3 ArgoCD 部署脚本测试")
    print("=" * 60)

    test_case("脚本存在", SCRIPT.exists(), str(SCRIPT))
    test_case("Application 清单存在", ARGO_MANIFEST.exists(), str(ARGO_MANIFEST))
    content = SCRIPT.read_text(encoding="utf-8")

    # 8 步骤
    steps = ["1/8", "2/8", "3/8", "4/8", "5/8", "6/8", "7/8", "8/8"]
    for step in steps:
        test_case(f"包含步骤 {step}", step in content, f"缺少步骤 {step}")

    # 关键步骤
    test_case("预检", "预检" in content, "")
    test_case("检查命名空间", "命名空间" in content, "")
    test_case("安装 ArgoCD", "安装 ArgoCD" in content or "ARGOCD_VERSION" in content, "")
    test_case("应用 AppProject", "AppProject" in content, "")
    test_case("验证同步状态", "验证同步" in content or "SYNC_STATUS" in content, "")
    test_case("触发同步", "触发同步" in content, "")
    test_case("验证资源", "验证资源" in content, "")
    test_case("生成报告", "REPORT_FILE" in content, "")

    # 4 个操作
    actions = ["--install", "--apply", "--status", "--sync", "--dry-run"]
    for act in actions:
        test_case(f"操作 {act}", act in content, f"缺少 {act}")

    # 资源引用
    test_case("Application 清单路径", "argo_application.yaml" in content, "")

    # kubectl 集成
    kubectl_cmds = ["kubectl get namespace", "kubectl apply", "kubectl get application", "kubectl patch application"]
    for cmd in kubectl_cmds:
        test_case(f"kubectl {cmd.split()[-1]}", cmd in content, f"缺少 {cmd}")

    # 3 种 ArgoCD 资源
    resources = ["applications", "applicationsets", "appprojects"]
    for res in resources:
        test_case(f"资源 {res}", res in content, f"缺少 {res}")

    # JSON 报告
    test_case("JSON 含 operation", '"operation":' in content, "")
    test_case("JSON 含 action", '"action":' in content, "")
    test_case("JSON 含 argocd_version", "argocd_version" in content, "")
    test_case("JSON 含 sync_status", "sync_status" in content, "")
    test_case("JSON 含 health_status", "health_status" in content, "")
    test_case("JSON 含 app_count", "app_count" in content, "")

    # 资源名称
    test_case("APP_NAME 变量", "APP_NAME" in content, "")
    test_case("APPSET_NAME 变量", "APPSET_NAME" in content, "")
    test_case("PROJECT_NAME 变量", "PROJECT_NAME" in content, "")

    # 环境变量
    test_case("ARGO_NAMESPACE", "ARGO_NAMESPACE" in content, "")
    test_case("ARGOCD_VERSION", "ARGOCD_VERSION" in content, "")

    # 默认版本
    test_case("默认版本 v2.10.0", "v2.10.0" in content, "")

    # set -euo pipefail
    test_case("set -euo pipefail", "set -euo pipefail" in content, "")

    print("=" * 60)
    print(f"通过: {passed} / 失败: {failed}")
    print("=" * 60)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
