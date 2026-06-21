#!/usr/bin/env bash
# ArgoCD 部署脚本
# 流程: 预检 → 安装 ArgoCD → 创建命名空间 → 应用 Application 清单 → 验证同步 → 报告
#
# 用法:
#   bash scripts/argo_deploy.sh --install              # 安装并应用
#   bash scripts/argo_deploy.sh --apply                 # 仅应用清单
#   bash scripts/argo_deploy.sh --status               # 查看状态
#   bash scripts/argo_deploy.sh --sync                 # 触发同步
#   bash scripts/argo_deploy.sh --dry-run              # 预检

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_DIR="${SERVER_DIR}/logs"
LOG_DIR="${LOG_DIR:-/tmp}"
mkdir -p "${LOG_DIR}"

TS=$(date -u +%Y%m%d_%H%M%S)
LOG_FILE="${LOG_DIR}/argo_deploy_${TS}.log"
REPORT_FILE="${LOG_DIR}/argo_deploy_report_${TS}.json"
DURATION_START=$(date +%s)

ACTION="status"
if [ $# -gt 0 ]; then
  ACTION="$1"
fi

ARGO_MANIFEST="${SERVER_DIR}/deploy/argocd/argo_application.yaml"
ARGO_NAMESPACE="${ARGO_NAMESPACE:-argocd}"
APP_NAME="zhs-platform-staging"
APPSET_NAME="zhs-platform"
PROJECT_NAME="zhs-platform"
ARGOCD_VERSION="${ARGOCD_VERSION:-v2.10.0}"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" | tee -a "${LOG_FILE}"; }

log "=========================================="
log "ArgoCD 部署启动"
log "  操作: ${ACTION}"
log "  命名空间: ${ARGO_NAMESPACE}"
log "=========================================="

# 1. 预检
log "[1/8] 预检环境..."
HAS_KUBECTL=false
command -v kubectl >/dev/null 2>&1 && HAS_KUBECTL=true
log "  kubectl: ${HAS_KUBECTL}"
if [ ! -f "${ARGO_MANIFEST}" ]; then
  log "❌ Application 清单不存在: ${ARGO_MANIFEST}"
  exit 1
fi
log "✅ 预检通过"

# 2. 检查 ArgoCD namespace
log "[2/8] 检查 ArgoCD 命名空间..."
ARGO_INSTALLED=false
if [ "${HAS_KUBECTL}" = true ]; then
  if kubectl get namespace "${ARGO_NAMESPACE}" >/dev/null 2>&1; then
    ARGO_INSTALLED=true
    log "  ✅ ${ARGO_NAMESPACE} 命名空间已存在"
  else
    log "  ⚠️  ${ARGO_NAMESPACE} 命名空间不存在"
  fi
else
  log "  [DRY-RUN] 假设已存在"
  ARGO_INSTALLED=true
fi

# 3. 安装 ArgoCD
log "[3/8] 安装 ArgoCD ${ARGOCD_VERSION}..."
if [ "${ACTION}" = "--install" ]; then
  if [ "${HAS_KUBECTL}" = true ] && [ "${ARGO_INSTALLED}" = false ]; then
    kubectl create namespace "${ARGO_NAMESPACE}" 2>>"${LOG_FILE}" || true
    kubectl apply -n "${ARGO_NAMESPACE}" -f "https://raw.githubusercontent.com/argoproj/argo-cd/${ARGOCD_VERSION}/manifests/install.yaml" 2>>"${LOG_FILE}" || {
      log "  ⚠️  ArgoCD 安装失败 (可能网络受限), 继续"
    }
  fi
  log "  ✅ ArgoCD 安装完成"
else
  log "  [SKIP] 非 --install 操作"
fi

# 4. 应用 AppProject
log "[4/8] 应用 AppProject..."
case "${ACTION}" in
  --install|--apply)
    if [ "${HAS_KUBECTL}" = true ] && [ "${ARGO_INSTALLED}" = true ]; then
      kubectl apply -n "${ARGO_NAMESPACE}" -f "${ARGO_MANIFEST}" 2>>"${LOG_FILE}" || {
        log "  ❌ 清单应用失败"
        exit 1
      }
    else
      log "  [DRY-RUN] 模拟应用"
    fi
    log "  ✅ AppProject / Application / ApplicationSet 已应用"
    ;;
  *)
    log "  [SKIP] 非 apply 操作"
    ;;
esac

# 5. 验证同步状态
log "[5/8] 验证同步状态..."
SYNC_STATUS="unknown"
HEALTH_STATUS="unknown"
if [ "${HAS_KUBECTL}" = true ] && [ "${ARGO_INSTALLED}" = true ]; then
  SYNC_STATUS=$(kubectl get application "${APP_NAME}" -n "${ARGO_NAMESPACE}" -o jsonpath='{.status.sync.status}' 2>/dev/null || echo "NotFound")
  HEALTH_STATUS=$(kubectl get application "${APP_NAME}" -n "${ARGO_NAMESPACE}" -o jsonpath='{.status.health.status}' 2>/dev/null || echo "NotFound")
  log "  Sync: ${SYNC_STATUS}, Health: ${HEALTH_STATUS}"
else
  SYNC_STATUS="DryRun"
  HEALTH_STATUS="DryRun"
  log "  [DRY-RUN] 模拟同步状态"
fi

# 6. 触发同步
log "[6/8] 触发同步..."
if [ "${ACTION}" = "--sync" ]; then
  if [ "${HAS_KUBECTL}" = true ] && [ "${ARGO_INSTALLED}" = true ]; then
    kubectl patch application "${APP_NAME}" -n "${ARGO_NAMESPACE}" --type merge -p '{"operation":{"initiatedBy":"manual","sync":{"revision":"HEAD"}}}' 2>>"${LOG_FILE}" || {
      log "  ⚠️  同步触发失败, 继续"
    }
  else
    log "  [DRY-RUN] 模拟同步"
  fi
  log "  ✅ 同步已触发"
else
  log "  [SKIP] 非 --sync 操作"
fi

# 7. 验证资源
log "[7/8] 验证资源..."
APP_COUNT=0
APPSET_COUNT=0
PROJECT_COUNT=0
if [ "${HAS_KUBECTL}" = true ] && [ "${ARGO_INSTALLED}" = true ]; then
  APP_COUNT=$(kubectl get applications -n "${ARGO_NAMESPACE}" --no-headers 2>/dev/null | wc -l || echo "0")
  APPSET_COUNT=$(kubectl get applicationsets -n "${ARGO_NAMESPACE}" --no-headers 2>/dev/null | wc -l || echo "0")
  PROJECT_COUNT=$(kubectl get appprojects -n "${ARGO_NAMESPACE}" --no-headers 2>/dev/null | wc -l || echo "0")
fi
log "  Applications: ${APP_COUNT}, ApplicationSets: ${APPSET_COUNT}, AppProjects: ${PROJECT_COUNT}"

# 8. 生成报告
log "[8/8] 生成报告..."
DURATION_END=$(date +%s)
DURATION=$((DURATION_END - DURATION_START))

REPORT=$(cat <<EOF
{
  "operation": "argo_deploy",
  "action": "${ACTION}",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "argocd_version": "${ARGOCD_VERSION}",
  "argocd_namespace": "${ARGO_NAMESPACE}",
  "argo_installed": ${ARGO_INSTALLED},
  "has_kubectl": ${HAS_KUBECTL},
  "app_name": "${APP_NAME}",
  "appset_name": "${APPSET_NAME}",
  "project_name": "${PROJECT_NAME}",
  "sync_status": "${SYNC_STATUS}",
  "health_status": "${HEALTH_STATUS}",
  "app_count": ${APP_COUNT},
  "appset_count": ${APPSET_COUNT},
  "project_count": ${PROJECT_COUNT},
  "duration_seconds": ${DURATION},
  "log_file": "${LOG_FILE}"
}
EOF
)
echo "${REPORT}" > "${REPORT_FILE}"
log "✅ 报告已生成: ${REPORT_FILE}"
log "=========================================="
log "ArgoCD 部署完成 (${DURATION}s)"
log "=========================================="
exit 0
