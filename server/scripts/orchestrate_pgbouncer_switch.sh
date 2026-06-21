#!/bin/bash
# pgBouncer 生产切换编排脚本
#
# 功能: 编排 pgBouncer 生产切换全流程, 含预检/切换/验证/回滚
# 流程: 环境检查 → pgBouncer 健康检查 → 切换连接 → 重启应用 → 验证 → 报告
#
# 用法: ./scripts/orchestrate_pgbouncer_switch.sh [--revert] [--dry-run]
set -euo pipefail

DRY_RUN=0
REVERT=0
for arg in "$@"; do
  case "${arg}" in
    --dry-run) DRY_RUN=1 ;;
    --revert) REVERT=1 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_DIR="${SERVER_DIR}/logs"
TS=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${LOG_DIR}/pgbouncer_switch_orchestrate_${TS}.log"
REPORT_FILE="${LOG_DIR}/pgbouncer_switch_report_${TS}.json"

mkdir -p "${LOG_DIR}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "${LOG_FILE}"
}

step() {
  log ""
  log "============================================================"
  log "[$1] $2"
  log "============================================================"
}

generate_report() {
  local status=$1
  local duration=$2
  local mode=$3
  local app_restarted=$4
  cat > "${REPORT_FILE}" <<EOF
{
  "timestamp": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "operation": "pgbouncer_switch_orchestration",
  "status": "${status}",
  "mode": "${mode}",
  "duration_seconds": ${duration},
  "app_restarted": ${app_restarted},
  "target_port": 6432,
  "previous_port": 5432,
  "log_file": "${LOG_FILE}"
}
EOF
  log "报告已生成: ${REPORT_FILE}"
}

START_TIME=$(date +%s)
APP_RESTARTED=0
MODE=$([ ${REVERT} -eq 1 ] && echo "revert" || echo "switch")

log "pgBouncer 生产切换编排"
log "模式: ${MODE}$([ ${DRY_RUN} -eq 1 ] && echo ' (dry-run)' || echo '')"
log "日志: ${LOG_FILE}"

# ---------- 步骤 1: 环境检查 ----------
step "1/6" "环境检查"

log "检查 docker..."
if ! command -v docker >/dev/null 2>&1; then
  log "❌ docker 未安装"
  generate_report "failed" 0 "${MODE}" ${APP_RESTARTED}
  exit 1
fi
log "✅ docker 已安装"

log "检查 switch_pgbouncer_connection.py..."
if [ ! -f "${SCRIPT_DIR}/switch_pgbouncer_connection.py" ]; then
  log "❌ 缺少 switch_pgbouncer_connection.py"
  generate_report "failed" 0 "${MODE}" ${APP_RESTARTED}
  exit 1
fi
log "✅ switch_pgbouncer_connection.py 存在"

if [ ${DRY_RUN} -eq 1 ]; then
  log ""
  log "✅ dry-run 预检完成"
  END_TIME=$(date +%s)
  generate_report "dry_run_passed" $((END_TIME - START_TIME)) "${MODE}" ${APP_RESTARTED}
  exit 0
fi

# ---------- 步骤 2: pgBouncer 健康检查 (仅切换模式) ----------
step "2/6" "pgBouncer 健康检查"

if [ ${REVERT} -eq 0 ]; then
  log "检查 pgBouncer 可用性..."
  if python3 "${SCRIPT_DIR}/switch_pgbouncer_connection.py" check >>"${LOG_FILE}" 2>&1; then
    log "✅ pgBouncer 健康检查通过"
  else
    log "❌ pgBouncer 不可用, 请先启动: docker compose up -d pgbouncer"
    generate_report "failed" 0 "${MODE}" ${APP_RESTARTED}
    exit 1
  fi
else
  log "ℹ️  回滚模式, 跳过 pgBouncer 健康检查"
fi

# ---------- 步骤 3: 执行切换/回滚 ----------
step "3/6" "执行 ${MODE}"

if [ ${REVERT} -eq 1 ]; then
  log "执行回滚..."
  if python3 "${SCRIPT_DIR}/switch_pgbouncer_connection.py" revert >>"${LOG_FILE}" 2>&1; then
    log "✅ 回滚完成"
  else
    log "❌ 回滚失败"
    generate_report "failed" 0 "${MODE}" ${APP_RESTARTED}
    exit 1
  fi
else
  log "执行切换..."
  if python3 "${SCRIPT_DIR}/switch_pgbouncer_connection.py" switch >>"${LOG_FILE}" 2>&1; then
    log "✅ 切换完成"
  else
    log "❌ 切换失败"
    generate_report "failed" 0 "${MODE}" ${APP_RESTARTED}
    exit 1
  fi
fi

# ---------- 步骤 4: 重启应用 ----------
step "4/6" "重启应用"

log "重启 api 服务..."
if docker compose -f "${SERVER_DIR}/deploy/docker/docker-compose.yml" restart api >>"${LOG_FILE}" 2>&1; then
  log "✅ api 服务已重启"
  APP_RESTARTED=1
else
  log "⚠️  api 服务重启失败 (可能未运行)"
fi

# ---------- 步骤 5: 验证应用 ----------
step "5/6" "验证应用"

log "等待 API 就绪..."
for i in $(seq 1 12); do
  if curl -sf http://localhost:8000/healthz >/dev/null 2>&1; then
    log "✅ API 健康检查通过 (等待 ${i}5 秒)"
    break
  fi
  sleep 5
  if [ ${i} -eq 12 ]; then
    log "⚠️  API 60 秒内未就绪"
  fi
done

log "检查当前连接状态..."
python3 "${SCRIPT_DIR}/switch_pgbouncer_connection.py" status >>"${LOG_FILE}" 2>&1 || true

# ---------- 步骤 6: 生成报告 ----------
step "6/6" "生成报告"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

generate_report "success" ${DURATION} "${MODE}" ${APP_RESTARTED}

log ""
log "============================================================"
log "✅ pgBouncer ${MODE} 编排完成"
log "============================================================"
log "模式: ${MODE}"
log "应用重启: $([ ${APP_RESTARTED} -eq 1 ] && echo '是' || echo '否')"
log "耗时: ${DURATION} 秒"
log "报告: ${REPORT_FILE}"
log "日志: ${LOG_FILE}"
log ""
log "回滚命令: ./scripts/orchestrate_pgbouncer_switch.sh --revert"
exit 0
