#!/usr/bin/env python3
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'scripts'))
"""ArgoCD Application 清单测试 - argo_application.yaml

验证项:
1. 文件存在
2. YAML 语法正确
3. 3 个资源: Application / ApplicationSet / AppProject
4. API 版本正确
5. 多环境支持 (staging / production)
6. Git 仓库配置
7. 同步策略 (自动化 / 修剪 / 自愈)
8. 重试配置
9. 同步窗口
10. RBAC 角色
11. 资源白名单
"""
import os
import sys
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPT = SERVER_DIR / "deploy" / "argocd" / "argo_application.yaml"

passed = 0
failed = 0


def test_case(name: str, ok: bool, detail: str = "") -> None:
    global passed, failed
    if ok:
        passed += 1
        print(f"  ✅ {name}")
    else:
        failed += 1
        print(f"  ❌ {name} -- {detail}")


def main() -> int:
    print("=" * 60)
    print("P2-7 ArgoCD Application 清单测试")
    print("=" * 60)

    test_case("文件存在", SCRIPT.exists(), str(SCRIPT))

    if not SCRIPT.exists():
        return 1

    content = SCRIPT.read_text(encoding="utf-8")

    # YAML 解析
    try:
        import yaml
        docs = list(yaml.safe_load_all(content))
        test_case("YAML 可解析", True, "")
        test_case(f"包含 {len(docs)} 个文档", len(docs) >= 3, f"实际 {len(docs)}")
    except ImportError:
        test_case("PyYAML 可用", False, "缺少 pyyaml 依赖")
        return 1
    except yaml.YAMLError as e:
        test_case("YAML 语法正确", False, str(e))
        return 1

    # 3 个资源
    kinds = []
    for doc in docs:
        if doc and "kind" in doc:
            kinds.append(doc["kind"])
    test_case("包含 Application", "Application" in kinds, f"kinds={kinds}")
    test_case("包含 ApplicationSet", "ApplicationSet" in kinds, "")
    test_case("包含 AppProject", "AppProject" in kinds, "")

    # API 版本
    api_versions = [doc.get("apiVersion", "") for doc in docs if doc]
    test_case("argoproj.io/v1alpha1 API", "argoproj.io/v1alpha1" in api_versions, "")

    # 找 Application 资源
    app_doc = next((d for d in docs if d and d.get("kind") == "Application"), None)
    test_case("Application 资源存在", app_doc is not None, "")
    if app_doc:
        spec = app_doc.get("spec", {})
        test_case("spec.project", "project" in spec, "")
        test_case("spec.source", "source" in spec, "")
        test_case("spec.destination", "destination" in spec, "")
        test_case("spec.syncPolicy", "syncPolicy" in spec, "")

        # 仓库
        source = spec.get("source", {})
        test_case("repoURL 配置", "repoURL" in source, "")
        test_case("targetRevision", "targetRevision" in source, "")
        test_case("path 配置", "path" in source, "")
        test_case("helm valueFiles", "valueFiles" in source.get("helm", {}), "")

        # 同步策略
        sync_policy = spec.get("syncPolicy", {})
        automated = sync_policy.get("automated", {})
        test_case("automated.prune", "prune" in automated, "")
        test_case("automated.selfHeal", "selfHeal" in automated, "")

        # 重试
        retry = sync_policy.get("retry", {})
        test_case("retry.limit", "limit" in retry, "")
        test_case("retry.backoff", "backoff" in retry, "")

        # 命名空间
        dest = spec.get("destination", {})
        test_case("destination.namespace", "namespace" in dest, "")
        test_case("destination.server", "server" in dest, "")

    # ApplicationSet
    appset = next((d for d in docs if d and d.get("kind") == "ApplicationSet"), None)
    test_case("ApplicationSet 资源存在", appset is not None, "")
    if appset:
        generators = appset.get("spec", {}).get("generators", [])
        test_case("list generator", any("list" in g for g in generators), "")
        template = appset.get("spec", {}).get("template", {})
        test_case("template.spec", "spec" in template, "")

    # AppProject
    project = next((d for d in docs if d and d.get("kind") == "AppProject"), None)
    test_case("AppProject 资源存在", project is not None, "")
    if project:
        proj_spec = project.get("spec", {})
        test_case("sourceRepos", "sourceRepos" in proj_spec, "")
        test_case("destinations", "destinations" in proj_spec, "")
        test_case("clusterResourceWhitelist", "clusterResourceWhitelist" in proj_spec, "")
        test_case("namespaceResourceWhitelist", "namespaceResourceWhitelist" in proj_spec, "")
        test_case("roles", "roles" in proj_spec, "")
        test_case("syncWindows", "syncWindows" in proj_spec, "")

        # RBAC
        roles = proj_spec.get("roles", [])
        test_case(f"包含 {len(roles)} 个角色", len(roles) >= 2, f"实际 {len(roles)}")

        # 资源白名单
        ns_white = proj_spec.get("namespaceResourceWhitelist", [])
        test_case(f"白名单 {len(ns_white)} 项", len(ns_white) >= 5, f"实际 {len(ns_white)}")

        # 同步窗口
        sync_windows = proj_spec.get("syncWindows", [])
        test_case("含同步窗口", len(sync_windows) > 0, "")

    # 环境列表
    test_case("staging 环境", "staging" in content, "")
    test_case("production 环境", "production" in content, "")

    # 命名空间
    namespaces = ["zhs-staging", "zhs-production", "argocd"]
    for ns in namespaces:
        test_case(f"命名空间 {ns}", ns in content, f"缺少 {ns}")

    # SyncOptions
    sync_options = ["CreateNamespace=true", "PrunePropagationPolicy=foreground", "ServerSideApply=true"]
    for opt in sync_options:
        test_case(f"syncOption {opt}", opt in content, f"缺少 {opt}")

    # multi-env support
    test_case("goTemplate 模板", "goTemplate: true" in content, "")
    test_case("valueFiles 模板", "values-{{.env}}.yaml" in content, "")

    print("=" * 60)
    print(f"通过: {passed} / 失败: {failed}")
    print("=" * 60)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
