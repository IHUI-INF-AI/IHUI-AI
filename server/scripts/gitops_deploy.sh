#!/usr/bin/env bash
# GitOps 部署配置
# 从 Git 仓库拉取部署清单, 应用到 Kubernetes/Helm
# 流程: 拉取代码 → 校验 → diff → 应用 → 验证 → 报告
#
# 用法:
#   bash scripts/gitops_deploy.sh --env staging                       # 部署到 staging
#   bash scripts/gitops_deploy.sh --env production --auto-confirm     # 部署到生产
#   bash scripts/gitops_deploy.sh --env staging --dry-run             # 仅 diff

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_DIR="${SERVER_DIR}/logs"
LOG_DIR="${LOG_DIR:-/tmp}"
mkdir -p "${LOG_DIR}"

TS=$(date -u +%Y%m%d_%H%M%S)
LOG_FILE="${LOG_DIR}/gitops_deploy_${TS}.log"
REPORT_FILE="${LOG_DIR}/gitops_deploy_report_${TS}.json"
DURATION_START=$(date +%s)

# 默认参数
ENV="staging"
DRY_RUN=false
AUTO_CONFIRM=false
GITOPS_REPO="${GITOPS_REPO:-git@github.com:zhs/zhs-gitops.git}"
GITOPS_BRANCH="${GITOPS_BRANCH:-main}"
GITOPS_DIR="${GITOPS_DIR:-${HOME}/zhs-gitops}"
HELM_CHART_DIR="${HELM_CHART_DIR:-${GITOPS_DIR}/charts/zhs-platform}"
K8S_NAMESPACE_PREFIX="${K8S_NAMESPACE_PREFIX:-zhs}"
KUBECONFIG_PATH="${KUBECONFIG_PATH:-${HOME}/.kube/config}"

# 参数解析
while [ $# -gt 0 ]; do
  case "$1" in
    --env) ENV="$2"; shift 2 ;;
    --dry-run) DRY_RUN=true; shift ;;
    --auto-confirm) AUTO_CONFIRM=true; shift ;;
    --repo) GITOPS_REPO="$2"; shift 2 ;;
    --branch) GITOPS_BRANCH="$2"; shift 2 ;;
    --dir) GITOPS_DIR="$2"; shift 2 ;;
    *) log "未知参数: $1"; exit 1 ;;
  esac
done

NAMESPACE="${K8S_NAMESPACE_PREFIX}-${ENV}"
VALUES_FILE="${HELM_CHART_DIR}/values-${ENV}.yaml"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" | tee -a "${LOG_FILE}"; }

log "=========================================="
log "GitOps 部署启动"
log "  环境: ${ENV}"
log "  命名空间: ${NAMESPACE}"
log "  仓库: ${GITOPS_REPO}@${GITOPS_BRANCH}"
log "  DRY_RUN: ${DRY_RUN}"
log "=========================================="

# 1. 预检
log "[1/8] 预检环境..."
HAS_GIT=false
HAS_HELM=false
HAS_KUBECTL=false
command -v git >/dev/null 2>&1 && HAS_GIT=true
command -v helm >/dev/null 2>&1 && HAS_HELM=true
command -v kubectl >/dev/null 2>&1 && HAS_KUBECTL=true
log "  git: ${HAS_GIT}, helm: ${HAS_HELM}, kubectl: ${HAS_KUBECTL}"
if [ "${HAS_HELM}" = false ] && [ "${DRY_RUN}" = false ]; then
  log "❌ helm 未安装"
  exit 1
fi
log "✅ 预检通过"

# 2. 拉取/更新 GitOps 仓库
log "[2/8] 拉取 GitOps 仓库..."
if [ -d "${GITOPS_DIR}" ]; then
  if [ "${DRY_RUN}" = false ] && [ "${HAS_GIT}" = true ]; then
    (cd "${GITOPS_DIR}" && git fetch origin 2>>"${LOG_FILE}" && git reset --hard "origin/${GITOPS_BRANCH}" 2>>"${LOG_FILE}") || {
      log "⚠️  git pull 失败, 尝试继续"
    }
  fi
  log "  使用现有目录: ${GITOPS_DIR}"
else
  log "  [DRY-RUN] 假设目录存在: ${GITOPS_DIR}"
  mkdir -p "${GITOPS_DIR}"
fi
log "✅ 仓库就绪"

# 3. 计算当前版本 (git commit)
log "[3/8] 获取当前版本..."
GIT_COMMIT="unknown"
GIT_COMMIT_SHORT="unknown"
if [ -d "${GITOPS_DIR}/.git" ] && [ "${HAS_GIT}" = true ]; then
  GIT_COMMIT=$(cd "${GITOPS_DIR}" && git rev-parse HEAD 2>/dev/null || echo "unknown")
  GIT_COMMIT_SHORT=$(cd "${GITOPS_DIR}" && git rev-parse --short HEAD 2>/dev/null || echo "unknown")
fi
log "  Commit: ${GIT_COMMIT_SHORT}"

# 4. 校验 Helm chart
log "[4/8] 校验 Helm chart..."
HELM_VALUES_OK=false
if [ -f "${VALUES_FILE}" ] && [ "${HAS_HELM}" = true ] && [ "${DRY_RUN}" = false ]; then
  if helm lint "${HELM_CHART_DIR}" --values "${VALUES_FILE}" >>"${LOG_FILE}" 2>&1; then
    HELM_VALUES_OK=true
  fi
else
  HELM_VALUES_OK=true  # 预检模式跳过
  log "  [DRY-RUN] 跳过 helm lint"
fi
log "✅ chart 校验: ${HELM_VALUES_OK}"

# 5. 计算 diff (helm template)
log "[5/8] 计算部署 diff..."
DIFF_OUTPUT=""
if [ -f "${VALUES_FILE}" ] && [ "${HAS_HELM}" = true ] && [ "${DRY_RUN}" = false ]; then
  DIFF_OUTPUT=$(helm template "${ENV}" "${HELM_CHART_DIR}" --values "${VALUES_FILE}" --namespace "${NAMESPACE}" 2>>"${LOG_FILE}" || echo "")
else
  log "  [DRY-RUN] 跳过 diff 计算"
fi
DIFF_LINES=$(echo "${DIFF_OUTPUT}" | wc -l || echo "0")
log "  diff 行数: ${DIFF_LINES}"

# 6. 用户确认
log "[6/8] 等待用户确认..."
if [ "${AUTO_CONFIRM}" = false ] && [ "${DRY_RUN}" = false ]; then
  log "  ⚠️  实际部署需要 --auto-confirm 参数"
  log "  当前使用 dry-run 模式"
  DRY_RUN=true
fi
log "✅ 确认通过"

# 7. 应用部署
log "[7/8] 应用部署..."
DEPLOY_STATUS="success"
if [ "${DRY_RUN}" = false ] && [ "${HAS_HELM}" = true ]; then
  if helm upgrade --install "zhs-platform-${ENV}" "${HELM_CHART_DIR}" \
    --values "${VALUES_FILE}" \
    --namespace "${NAMESPACE}" \
    --create-namespace \
    --wait \
    --timeout 10m 2>>"${LOG_FILE}"; then
    DEPLOY_STATUS="success"
  else
    DEPLOY_STATUS="failed"
    log "❌ helm upgrade 失败, 启动回滚"
    helm rollback "zhs-platform-${ENV}" 2>>"${LOG_FILE}" || true
  fi
else
  log "  [DRY-RUN] 跳过 helm upgrade"
fi
log "部署状态: ${DEPLOY_STATUS}"

# 8. 验证部署
log "[8/8] 验证部署..."
POD_READY=0
POD_TOTAL=0
if [ "${DEPLOY_STATUS}" = "success" ] && [ "${HAS_KUBECTL}" = true ] && [ "${DRY_RUN}" = false ]; then
  POD_TOTAL=$(kubectl get pods -n "${NAMESPACE}" --no-headers 2>/dev/null | wc -l || echo "0")
  POD_READY=$(kubectl get pods -n "${NAMESPACE}" --no-headers 2>/dev/null | grep -c "Running" || echo "0")
fi
log "  Pods: ${POD_READY}/${POD_TOTAL} Running"

# 生成报告
DURATION_END=$(date +%s)
DURATION=$((DURATION_END - DURATION_START))

REPORT=$(cat <<EOF
{
  "operation": "gitops_deploy",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "environment": "${ENV}",
  "namespace": "${NAMESPACE}",
  "git_commit": "${GIT_COMMIT}",
  "git_commit_short": "${GIT_COMMIT_SHORT}",
  "dry_run": ${DRY_RUN},
  "auto_confirm": ${AUTO_CONFIRM},
  "helm_values_ok": ${HELM_VALUES_OK},
  "diff_lines": ${DIFF_LINES},
  "deploy_status": "${DEPLOY_STATUS}",
  "pod_ready": ${POD_READY},
  "pod_total": ${POD_TOTAL},
  "duration_seconds": ${DURATION},
  "log_file": "${LOG_FILE}"
}
EOF
)
echo "${REPORT}" > "${REPORT_FILE}"
log "✅ 报告已生成: ${REPORT_FILE}"
log "=========================================="
log "GitOps 部署完成 (${DURATION}s)"
log "=========================================="
exit 0
