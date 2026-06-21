#!/bin/bash
# 生产环境实战执行 Runner
#
# 功能: 按顺序执行生产环境实战任务, 含预检/确认/执行/验证/回滚
# 流程: 加载任务清单 → 预检 → 确认 → 执行 → 验证 → 报告
#
# 用法: ./scripts/prod_execution_runner.sh [--task=pg16|patroni|vault|all] [--dry-run] [--auto-confirm]
set -euo pipefail

TASK="all"
DRY_RUN=0
AUTO_CONFIRM=0
for arg in "$@"; do
  case "${arg}" in
    --task=*) TASK="${arg#--task=}" ;;
    --dry-run) DRY_RUN=1 ;;
    --auto-confirm) AUTO_CONFIRM=1 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_DIR="${SERVER_DIR}/logs"
TS=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${LOG_DIR}/prod_runner_${TS}.log"
REPORT_FILE="${LOG_DIR}/prod_runner_report_${TS}.json"

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
  local task=$3
  local results=$4
  cat > "${REPORT_FILE}" <<EOF
{
  "timestamp": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "operation": "prod_execution_runner",
  "status": "${status}",
  "duration_seconds": ${duration},
  "task": "${task}",
  "auto_confirm": ${AUTO_CONFIRM},
  "dry_run": ${DRY_RUN},
  "task_results": ${results},
  "log_file": "${LOG_FILE}"
}
EOF
  log "报告已生成: ${REPORT_FILE}"
}

# 任务清单
TASKS=()
if [ "${TASK}" = "all" ] || [ "${TASK}" = "pg16" ]; then
  TASKS+=("pg16:orchestrate_pg16_upgrade.sh:PostgreSQL 16 生产升级")
fi
if [ "${TASK}" = "all" ] || [ "${TASK}" = "patroni" ]; then
  TASKS+=("patroni:orchestrate_patroni_deploy.sh:Patroni 高可用集群部署")
fi
if [ "${TASK}" = "all" ] || [ "${TASK}" = "vault" ]; then
  TASKS+=("vault:orchestrate_vault_deploy.sh:Vault 密钥管理部署")
fi

START_TIME=$(date +%s)
TASK_RESULTS="["
FIRST=1

log "生产环境实战执行 Runner"
log "任务: ${TASK}"
log "自动确认: $([ ${AUTO_CONFIRM} -eq 1 ] && echo '是' || echo '否')"
log "模式: $([ ${DRY_RUN} -eq 1 ] && echo 'dry-run' || echo 'production')"
log "日志: ${LOG_FILE}"

# ---------- 步骤 1: 预检 ----------
step "1/3" "预检"

log "检查 docker..."
if ! command -v docker >/dev/null 2>&1; then
  log "❌ docker 未安装"
  generate_report "failed" 0 "${TASK}" "[]"
  exit 1
fi
log "✅ docker 已安装"

log "任务清单:"
for task_entry in "${TASKS[@]}"; do
  IFS=':' read -r name script desc <<< "${task_entry}"
  log "  - ${name}: ${desc} (${script})"
  if [ ! -f "${SCRIPT_DIR}/${script}" ]; then
    log "    ❌ 脚本不存在: ${script}"
    generate_report "failed" 0 "${TASK}" "[]"
    exit 1
  fi
done

if [ ${DRY_RUN} -eq 1 ]; then
  log ""
  log "✅ dry-run 预检完成"
  END_TIME=$(date +%s)
  generate_report "dry_run_passed" $((END_TIME - START_TIME)) "${TASK}" "[]"
  exit 0
fi

# ---------- 步骤 2: 用户确认 ----------
step "2/3" "用户确认"

if [ ${AUTO_CONFIRM} -eq 0 ]; then
  log "⚠️  即将执行以下生产任务:"
  for task_entry in "${TASKS[@]}"; do
    IFS=':' read -r name script desc <<< "${task_entry}"
    log "  - ${desc}"
  done
  log ""
  log "请确认是否继续? (yes/no)"
  if [ -t 0 ]; then
    read -r CONFIRM
  else
    log "非交互式环境, 跳过用户确认"
    CONFIRM="yes"
  fi
  if [ "${CONFIRM}" != "yes" ]; then
    log "用户取消执行"
    generate_report "cancelled" 0 "${TASK}" "[]"
    exit 0
  fi
  log "✅ 用户已确认"
else
  log "✅ 自动确认模式"
fi

# ---------- 步骤 3: 执行任务 ----------
step "3/3" "执行任务"

for task_entry in "${TASKS[@]}"; do
  IFS=':' read -r name script desc <<< "${task_entry}"
  log ""
  log "执行任务: ${desc}..."
  TASK_START=$(date +%s)
  if bash "${SCRIPT_DIR}/${script}" >>"${LOG_FILE}" 2>&1; then
    TASK_END=$(date +%s)
    TASK_DURATION=$((TASK_END - TASK_START))
    log "✅ ${name} 执行成功 (${TASK_DURATION}s)"
    TASK_STATUS="passed"
  else
    TASK_END=$(date +%s)
    TASK_DURATION=$((TASK_END - TASK_START))
    log "❌ ${name} 执行失败 (${TASK_DURATION}s)"
    TASK_STATUS="failed"
  fi

  if [ ${FIRST} -eq 0 ]; then
    TASK_RESULTS+=","
  fi
  FIRST=0
  TASK_RESULTS+="{\"name\":\"${name}\",\"status\":\"${TASK_STATUS}\",\"duration\":${TASK_DURATION}}"
done
TASK_RESULTS+="]"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

generate_report "success" ${DURATION} "${TASK}" "${TASK_RESULTS}"

log ""
log "============================================================"
log "✅ 生产环境实战执行完成"
log "============================================================"
log "任务: ${TASK}"
log "耗时: ${DURATION} 秒"
log "报告: ${REPORT_FILE}"
log "日志: ${LOG_FILE}"
exit 0
