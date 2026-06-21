#!/usr/bin/env python3
"""ArgoCD ApplicationSet 多环境管理脚本 (Round 11 P0-11)

功能:
  - 应用 ApplicationSet 多环境配置
  - 验证 ApplicationSet 状态
  - 跨集群同步监控
  - 同步窗口管理
  - 通知配置校验
  - dry-run 模式
  - 多环境 (dev/staging/production) 操作

用法:
  python scripts/argocd_multienv.py apply --env all
  python scripts/argocd_multienv.py apply --env production --cluster aliyun-prod
  python scripts/argocd_multienv.py status --env all
  python scripts/argocd_multienv.py validate
  python scripts/argocd_multienv.py sync-window
  python scripts/argocd_multienv.py notifications
"""
import argparse
import json
import os
import subprocess
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = SERVER_DIR / "scripts"
DEPLOY_DIR = SERVER_DIR / "deploy"
ARGOCD_DIR = DEPLOY_DIR / "argocd"
MANIFEST = ARGOCD_DIR / "applicationset_multienv.yaml"

ARGOCD_SERVER = os.environ.get("ARGOCD_SERVER", "argocd-server.argocd.svc.cluster.local:443")
ARGOCD_TOKEN = os.environ.get("ARGOCD_TOKEN", "")
ARGOCD_USERNAME = os.environ.get("ARGOCD_USERNAME", "admin")

# 环境和集群配置
ENVIRONMENTS = ["dev", "staging", "production"]
CLUSTERS = [
    {"name": "aliyun-prod", "url": "https://aliyun-prod.k8s.example.com", "type": "primary"},
    {"name": "huawei-prod", "url": "https://huawei-prod.k8s.example.com", "type": "dr"},
    {"name": "aws-dr", "url": "https://aws-dr.k8s.example.com", "type": "dr"},
]
APPS = ["zhs-core", "zhs-api", "zhs-web", "zhs-worker"]


def log(msg: str) -> None:
    """输出日志"""
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print(f"[{ts}] {msg}", file=sys.stderr, flush=True)


def run_argocd(args: list, timeout: int = 30) -> tuple[int, str, str]:
    """执行 argocd CLI 命令"""
    cmd = ["argocd"] + args
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            env={**os.environ, "ARGOCD_SERVER": ARGOCD_SERVER, "ARGOCD_AUTH_TOKEN": ARGOCD_TOKEN},
        )
        return result.returncode, result.stdout, result.stderr
    except FileNotFoundError:
        return 127, "", "argocd CLI 未安装"
    except subprocess.TimeoutExpired:
        return 124, "", f"命令超时 ({timeout}s)"
    except Exception as e:
        return 1, "", str(e)


def kubectl_apply(manifest: Path, namespace: str = "argocd", dry_run: bool = False) -> dict:
    """使用 kubectl 应用 manifest"""
    if not manifest.exists():
        return {"status": "error", "detail": f"manifest 不存在: {manifest}"}

    cmd = ["kubectl", "apply", "-f", str(manifest), "-n", namespace]
    if dry_run:
        cmd.append("--dry-run=server")

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        return {
            "status": "success" if result.returncode == 0 else "error",
            "returncode": result.returncode,
            "stdout": result.stdout,
            "stderr": result.stderr,
        }
    except FileNotFoundError:
        return {"status": "error", "detail": "kubectl 未安装"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}


def validate_manifest() -> dict:
    """校验 manifest 完整性"""
    if not MANIFEST.exists():
        return {"status": "error", "detail": f"缺失 manifest: {MANIFEST}"}

    content = MANIFEST.read_text(encoding="utf-8")
    errors = []
    warnings = []

    # 1. 必需字段
    required_fields = [
        "kind: ApplicationSet",
        "kind: AppProject",
        "kind: ConfigMap",
        "argocd.argoproj.io/v1alpha1",
    ]
    for field in required_fields:
        if field not in content:
            errors.append(f"缺失字段: {field}")

    # 2. 3 套环境
    for env in ENVIRONMENTS:
        if f"env: {env}" not in content:
            errors.append(f"缺失环境: {env}")

    # 3. 3 个集群
    for cluster in CLUSTERS:
        if cluster["name"] not in content:
            errors.append(f"缺失集群: {cluster['name']}")

    # 4. 4 个应用
    for app in APPS:
        if app not in content:
            errors.append(f"缺失应用: {app}")

    # 5. 同步窗口
    if "syncWindows" not in content:
        warnings.append("未配置 syncWindows")
    if "kind: allow" not in content:
        warnings.append("未配置 allow sync window (生产环境将无法自动同步)")

    # 6. 自动修复
    if "selfHeal: true" not in content:
        warnings.append("未启用 selfHeal")

    # 7. 通知配置
    if "service.dingtalk" not in content:
        warnings.append("未配置钉钉通知")
    if "service.slack" not in content:
        warnings.append("未配置 Slack 通知")

    # 8. 角色
    if "releaser" not in content:
        warnings.append("未配置 releaser 角色")

    return {
        "status": "error" if errors else "ok",
        "errors": errors,
        "warnings": warnings,
        "manifest": str(MANIFEST),
        "size_bytes": len(content),
    }


def get_application_status(env: Optional[str] = None, cluster: Optional[str] = None) -> dict:
    """获取 Application 状态"""
    rc, stdout, stderr = run_argocd([
        "app", "list",
        "-o", "json",
        "--project", "zhs-platform",
    ])

    if rc != 0:
        return {
            "status": "error",
            "detail": f"argocd app list 失败: {stderr}",
            "applications": [],
        }

    try:
        apps = json.loads(stdout) if stdout.strip() else []
    except json.JSONDecodeError:
        return {"status": "error", "detail": "JSON 解析失败", "raw": stdout[:500]}

    # 过滤
    filtered = []
    for app in apps:
        name = app.get("metadata", {}).get("name", "")
        if env and f"-{env}-" not in name:
            continue
        if cluster and not name.endswith(f"-{cluster}"):
            continue
        filtered.append({
            "name": name,
            "sync_status": app.get("status", {}).get("sync", {}).get("status"),
            "health_status": app.get("status", {}).get("health", {}).get("status"),
            "revision": app.get("status", {}).get("sync", {}).get("revision", "")[:12],
            "last_synced": app.get("status", {}).get("operationState", {}).get("finishedAt"),
        })

    return {
        "status": "ok",
        "filter": {"env": env, "cluster": cluster},
        "count": len(filtered),
        "applications": filtered,
    }


def get_sync_windows() -> dict:
    """获取同步窗口状态"""
    rc, stdout, stderr = run_argocd([
        "proj", "windows", "zhs-platform",
        "-o", "json",
    ])

    if rc != 0:
        return {"status": "error", "detail": f"argocd proj windows 失败: {stderr}"}

    return {
        "status": "ok",
        "windows_raw": stdout,
    }


def check_notification_config() -> dict:
    """校验通知配置"""
    if not MANIFEST.exists():
        return {"status": "error", "detail": f"缺失 manifest: {MANIFEST}"}

    content = MANIFEST.read_text(encoding="utf-8")
    checks = {
        "dingtalk_service": "service.dingtalk" in content,
        "slack_service": "service.slack" in content,
        "deployed_trigger": "trigger.on-deployed" in content,
        "sync_failed_trigger": "trigger.on-sync-failed" in content,
        "health_degraded_trigger": "trigger.on-health-degraded" in content,
        "prod_specific_trigger": "on-deployed-prod" in content,
        "dingtalk_endpoint": "dingtalk-zhs" in content,
        "slack_endpoint": "slack-zhs" in content,
        "subscriptions": "subscriptions" in content,
    }

    all_ok = all(checks.values())
    return {
        "status": "ok" if all_ok else "warning",
        "checks": checks,
        "all_ok": all_ok,
    }


def cmd_apply(args) -> int:
    """应用 ApplicationSet 配置"""
    if not MANIFEST.exists():
        log(f"❌ manifest 不存在: {MANIFEST}")
        return 1

    log(f"[apply] {args.env} / {args.cluster} (dry_run={args.dry_run})")

    result = kubectl_apply(MANIFEST, namespace="argocd", dry_run=args.dry_run)
    print(json.dumps({
        "operation": "apply",
        "env": args.env,
        "cluster": args.cluster,
        "dry_run": args.dry_run,
        "result": result,
    }, ensure_ascii=False, indent=2))

    if result.get("status") == "error":
        return 1
    return 0


def cmd_status(args) -> int:
    """查看应用状态"""
    result = get_application_status(env=args.env, cluster=args.cluster)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def cmd_validate(args) -> int:
    """校验 manifest"""
    result = validate_manifest()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["status"] == "ok" else 1


def cmd_sync_window(args) -> int:
    """查看同步窗口"""
    result = get_sync_windows()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def cmd_notifications(args) -> int:
    """校验通知配置"""
    result = check_notification_config()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["status"] == "ok" else 1


def cmd_list_envs(args) -> int:
    """列出所有环境"""
    result = {
        "environments": ENVIRONMENTS,
        "clusters": CLUSTERS,
        "apps": APPS,
        "total_combinations": len(ENVIRONMENTS) * len(CLUSTERS) * len(APPS),
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="ArgoCD 多环境管理")
    sub = parser.add_subparsers(dest="command")

    # apply
    ap_p = sub.add_parser("apply", help="应用 ApplicationSet")
    ap_p.add_argument("--env", default="all", choices=ENVIRONMENTS + ["all"])
    ap_p.add_argument("--cluster", default="all", choices=[c["name"] for c in CLUSTERS] + ["all"])
    ap_p.add_argument("--dry-run", action="store_true")

    # status
    st_p = sub.add_parser("status", help="查看应用状态")
    st_p.add_argument("--env", default=None, choices=ENVIRONMENTS + [None])
    st_p.add_argument("--cluster", default=None, choices=[c["name"] for c in CLUSTERS] + [None])

    # validate
    sub.add_parser("validate", help="校验 manifest")

    # sync-window
    sub.add_parser("sync-window", help="查看同步窗口")

    # notifications
    sub.add_parser("notifications", help="校验通知配置")

    # list-envs
    sub.add_parser("list-envs", help="列出所有环境/集群/应用")

    args = parser.parse_args()

    if args.command == "apply":
        return cmd_apply(args)
    if args.command == "status":
        return cmd_status(args)
    if args.command == "validate":
        return cmd_validate(args)
    if args.command == "sync-window":
        return cmd_sync_window(args)
    if args.command == "notifications":
        return cmd_notifications(args)
    if args.command == "list-envs":
        return cmd_list_envs(args)

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
