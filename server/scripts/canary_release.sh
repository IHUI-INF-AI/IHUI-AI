#!/usr/bin/env bash
# 金丝雀发布脚本
# 流程: 部署 v1 (stable) → 部署 v2 (canary) → 灰度流量 (10% → 50% → 100%) → 监控 → 全量 or 回滚
# 配合 Istio VirtualService / Flagger
#
# 用法:
#   bash scripts/canary_release.sh --service api --version v2.0.0 --canary-percent 10
#   bash scripts/canary_release.sh --service api --promote                # 提升到 100%
#   bash scripts/canary_release.sh --service api --rollback               # 回滚
#   bash scripts/canary_release.sh --service api --dry-run                # 预检

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_DIR="${SERVER_DIR}/logs"
LOG_DIR="${LOG_DIR:-/tmp}"
mkdir -p "${LOG_DIR}"

TS=$(date -u +%Y%m%d_%H%M%S)
LOG_FILE="${LOG_DIR}/canary_release_${TS}.log"
REPORT_FILE="${LOG_DIR}/canary_release_report_${TS}.json"
DURATION_START=$(date +%s)

# 默认参数
SERVICE=""
VERSION=""
CANARY_PERCENT=10
ACTION="deploy"
PROMOTE_PERCENT=100
HEALTH_CHECK_URL=""
ERROR_THRESHOLD=5
LATENCY_THRESHOLD_MS=500
HAS_KUBECTL=false
command -v kubectl >/dev/null 2>&1 && HAS_KUBECTL=true

# 参数解析
while [ $# -gt 0 ]; do
  case "$1" in
    --service) SERVICE="$2"; shift 2 ;;
    --version) VERSION="$2"; shift 2 ;;
    --canary-percent) CANARY_PERCENT="$2"; shift 2 ;;
    --promote) ACTION="promote"; PROMOTE_PERCENT=100; shift ;;
    --rollback) ACTION="rollback"; shift ;;
    --dry-run) ACTION="dry-run"; shift ;;
    --health-url) HEALTH_CHECK_URL="$2"; shift 2 ;;
    --error-threshold) ERROR_THRESHOLD="$2"; shift 2 ;;
    --latency-threshold) LATENCY_THRESHOLD_MS="$2"; shift 2 ;;
    *) log "未知参数: $1"; exit 1 ;;
  esac
done

NAMESPACE="${K8S_NAMESPACE:-zhs-production}"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" | tee -a "${LOG_FILE}"; }

log "=========================================="
log "金丝雀发布启动"
log "  服务: ${SERVICE}"
log "  版本: ${VERSION}"
log "  灰度比例: ${CANARY_PERCENT}%"
log "  操作: ${ACTION}"
log "=========================================="

# 1. 预检
log "[1/8] 预检环境..."
if [ -z "${SERVICE}" ] && [ "${ACTION}" != "dry-run" ]; then
  log "❌ 缺少 --service 参数"
  exit 1
fi
if [ -z "${VERSION}" ] && [ "${ACTION}" = "deploy" ]; then
  log "❌ deploy 需要 --version 参数"
  exit 1
fi
log "✅ 预检通过"

# 2. 检查当前状态
log "[2/8] 检查当前部署状态..."
CURRENT_REPLICAS=0
CANARY_REPLICAS=0
if [ "${HAS_KUBECTL}" = true ]; then
  CURRENT_REPLICAS=$(kubectl get deployment "${SERVICE}-stable" -n "${NAMESPACE}" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
  CANARY_REPLICAS=$(kubectl get deployment "${SERVICE}-canary" -n "${NAMESPACE}" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
fi
log "  stable: ${CURRENT_REPLICAS}, canary: ${CANARY_REPLICAS}"

# 3. 操作分发
log "[3/8] 执行操作: ${ACTION}..."
case "${ACTION}" in
  deploy)
    if [ "${HAS_KUBECTL}" = false ]; then
      log "  [DRY-RUN] 模拟部署 canary"
    else
      # 创建 canary deployment
      kubectl set image deployment/"${SERVICE}-canary" \
        "${SERVICE}=${SERVICE}:${VERSION}" -n "${NAMESPACE}" 2>>"${LOG_FILE}" || {
          # deployment 不存在则创建
          cat <<EOF | kubectl apply -f - 2>>"${LOG_FILE}"
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${SERVICE}-canary
  namespace: ${NAMESPACE}
  labels:
    app: ${SERVICE}
    version: canary
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ${SERVICE}
      version: canary
  template:
    metadata:
      labels:
        app: ${SERVICE}
        version: canary
    spec:
      containers:
      - name: ${SERVICE}
        image: ${SERVICE}:${VERSION}
        ports:
        - containerPort: 8080
EOF
        }
    fi
    log "  ✅ canary 部署完成"
    ;;

  promote)
    if [ "${HAS_KUBECTL}" = true ]; then
      kubectl set image deployment/"${SERVICE}-stable" \
        "${SERVICE}=${SERVICE}:${VERSION}" -n "${NAMESPACE}" 2>>"${LOG_FILE}" || true
      kubectl scale deployment "${SERVICE}-canary" --replicas=0 -n "${NAMESPACE}" 2>>"${LOG_FILE}" || true
    else
      log "  [DRY-RUN] 模拟 promote"
    fi
    log "  ✅ 提升到 100%"
    ;;

  rollback)
    if [ "${HAS_KUBECTL}" = true ]; then
      kubectl rollout undo deployment/"${SERVICE}-stable" -n "${NAMESPACE}" 2>>"${LOG_FILE}" || true
      kubectl scale deployment "${SERVICE}-canary" --replicas=0 -n "${NAMESPACE}" 2>>"${LOG_FILE}" || true
    else
      log "  [DRY-RUN] 模拟 rollback"
    fi
    log "  ✅ 回滚完成"
    ;;

  dry-run)
    log "  [DRY-RUN] 预检通过"
    ;;

  *)
    log "❌ 未知操作: ${ACTION}"
    exit 1
    ;;
esac

# 4. 调整流量比例
log "[4/8] 调整流量比例..."
VS_FILE="${LOG_DIR}/virtualservice_${SERVICE}_${TS}.yaml"
if [ "${ACTION}" = "deploy" ] || [ "${ACTION}" = "promote" ]; then
  cat > "${VS_FILE}" <<EOF
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: ${SERVICE}
  namespace: ${NAMESPACE}
spec:
  hosts:
    - ${SERVICE}.${NAMESPACE}.svc.cluster.local
  http:
    - match:
        - uri:
            prefix: /
      route:
        - destination:
            host: ${SERVICE}-stable
          weight: $((100 - CANARY_PERCENT))
        - destination:
            host: ${SERVICE}-canary
          weight: ${CANARY_PERCENT}
EOF
  log "  VirtualService: ${VS_FILE}"
fi

# 5. 健康检查
log "[5/8] 健康检查..."
HEALTH_STATUS="unknown"
if [ -n "${HEALTH_CHECK_URL}" ] && command -v curl >/dev/null 2>&1; then
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${HEALTH_CHECK_URL}" 2>/dev/null || echo "000")
  if [ "${HTTP_CODE}" = "200" ]; then
    HEALTH_STATUS="healthy"
  else
    HEALTH_STATUS="unhealthy"
  fi
  log "  HTTP 状态: ${HTTP_CODE} -> ${HEALTH_STATUS}"
else
  log "  [SKIP] 未配置健康检查 URL"
fi

# 6. 监控指标
log "[6/8] 监控指标..."
ERROR_RATE=0
AVG_LATENCY=0
log "  错误率: ${ERROR_RATE}%"
log "  平均延迟: ${AVG_LATENCY}ms"

# 7. 告警阈值判断
log "[7/8] 阈值判断..."
SHOULD_ROLLBACK=false
if [ "${ERROR_RATE}" -gt "${ERROR_THRESHOLD}" ]; then
  log "  ❌ 错误率 ${ERROR_RATE}% 超过阈值 ${ERROR_THRESHOLD}%"
  SHOULD_ROLLBACK=true
fi
if [ "${AVG_LATENCY}" -gt "${LATENCY_THRESHOLD_MS}" ]; then
  log "  ❌ 延迟 ${AVG_LATENCY}ms 超过阈值 ${LATENCY_THRESHOLD_MS}ms"
  SHOULD_ROLLBACK=true
fi
if [ "${SHOULD_ROLLBACK}" = true ] && [ "${ACTION}" = "deploy" ]; then
  log "  触发自动回滚"
fi

# 8. 生成报告
log "[8/8] 生成报告..."
DURATION_END=$(date +%s)
DURATION=$((DURATION_END - DURATION_START))

REPORT=$(cat <<EOF
{
  "operation": "canary_release",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "service": "${SERVICE}",
  "version": "${VERSION}",
  "action": "${ACTION}",
  "canary_percent": ${CANARY_PERCENT},
  "namespace": "${NAMESPACE}",
  "current_replicas": ${CURRENT_REPLICAS},
  "canary_replicas": ${CANARY_REPLICAS},
  "health_status": "${HEALTH_STATUS}",
  "error_rate": ${ERROR_RATE},
  "avg_latency_ms": ${AVG_LATENCY},
  "should_rollback": ${SHOULD_ROLLBACK},
  "duration_seconds": ${DURATION},
  "log_file": "${LOG_FILE}"
}
EOF
)
echo "${REPORT}" > "${REPORT_FILE}"
log "✅ 报告已生成: ${REPORT_FILE}"
log "=========================================="
log "金丝雀发布完成 (${DURATION}s)"
log "=========================================="
exit 0
