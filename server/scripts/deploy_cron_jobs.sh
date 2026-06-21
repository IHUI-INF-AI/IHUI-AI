#!/bin/bash
# 定时任务部署脚本
#
# 功能: 部署 PostgreSQL 相关定时任务到 crontab
# 流程: 检查 crontab → 合并任务 → 安装 → 验证 → 报告
#
# 用法: ./scripts/deploy_cron_jobs.sh [--dry-run] [--uninstall]
set -euo pipefail

DRY_RUN=0
UNINSTALL=0
for arg in "$@"; do
  case "${arg}" in
    --dry-run) DRY_RUN=1 ;;
    --uninstall) UNINSTALL=1 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_DIR="${SERVER_DIR}/logs"
TS=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${LOG_DIR}/cron_deploy_${TS}.log"
REPORT_FILE="${LOG_DIR}/cron_deploy_report_${TS}.json"
CRONTAB_FILE="${SERVER_DIR}/deploy/crontab/pg_crontab.txt"
VAULT_CRONTAB="${SERVER_DIR}/deploy/crontab/vault_crontab.txt"

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
  local installed=$3
  local task_count=$4
  cat > "${REPORT_FILE}" <<EOF
{
  "timestamp": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "operation": "cron_jobs_deploy",
  "status": "${status}",
  "duration_seconds": ${duration},
  "installed": ${installed},
  "task_count": ${task_count},
  "crontab_files": ["${CRONTAB_FILE}", "${VAULT_CRONTAB}"],
  "log_file": "${LOG_FILE}"
}
EOF
  log "报告已生成: ${REPORT_FILE}"
}

START_TIME=$(date +%s)
INSTALLED=0
TASK_COUNT=0

log "定时任务部署"
log "模式: $([ ${DRY_RUN} -eq 1 ] && echo 'dry-run' || echo 'production')$([ ${UNINSTALL} -eq 1 ] && echo ' (卸载)' || echo '')"
log "日志: ${LOG_FILE}"

# ---------- 步骤 1: 检查 crontab ----------
step "1/5" "检查 crontab"

log "检查 crontab 命令..."
if ! command -v crontab >/dev/null 2>&1; then
  log "❌ crontab 命令不可用"
  generate_report "failed" 0 0 0
  exit 1
fi
log "✅ crontab 可用"

# ---------- 步骤 2: 检查 crontab 文件 ----------
step "2/5" "检查 crontab 文件"

log "检查 PG crontab..."
if [ ! -f "${CRONTAB_FILE}" ]; then
  log "❌ 缺少 ${CRONTAB_FILE}"
  generate_report "failed" 0 0 0
  exit 1
fi
log "✅ pg_crontab.txt 存在"

log "检查 Vault crontab..."
if [ ! -f "${VAULT_CRONTAB}" ]; then
  log "❌ 缺少 ${VAULT_CRONTAB}"
  generate_report "failed" 0 0 0
  exit 1
fi
log "✅ vault_crontab.txt 存在"

# 统计任务数
TASK_COUNT=$(grep -c "^[0-9*]" "${CRONTAB_FILE}" 2>/dev/null || echo "0")
VAULT_TASKS=$(grep -c "^[0-9*]" "${VAULT_CRONTAB}" 2>/dev/null || echo "0")
TASK_COUNT=$((TASK_COUNT + VAULT_TASKS))
log "任务总数: ${TASK_COUNT}"

if [ ${DRY_RUN} -eq 1 ]; then
  log ""
  log "✅ dry-run 预检完成"
  END_TIME=$(date +%s)
  generate_report "dry_run_passed" $((END_TIME - START_TIME)) 0 ${TASK_COUNT}
  exit 0
fi

# ---------- 步骤 3: 卸载模式 ----------
step "3/5" "处理卸载模式"

if [ ${UNINSTALL} -eq 1 ]; then
  log "卸载定时任务..."
  crontab -r >>"${LOG_FILE}" 2>&1 || log "  (无 crontab 可卸载)"
  log "✅ 定时任务已卸载"
  END_TIME=$(date +%s)
  generate_report "uninstalled" $((END_TIME - START_TIME)) 0 0
  exit 0
fi

# ---------- 步骤 4: 安装定时任务 ----------
step "4/5" "安装定时任务"

log "合并 crontab 文件..."
MERGED_FILE="${LOG_DIR}/merged_crontab_${TS}.txt"
cat "${CRONTAB_FILE}" > "${MERGED_FILE}"
echo "" >> "${MERGED_FILE}"
cat "${VAULT_CRONTAB}" >> "${MERGED_FILE}"

log "安装 crontab..."
if crontab "${MERGED_FILE}" >>"${LOG_FILE}" 2>&1; then
  log "✅ crontab 已安装"
  INSTALLED=1
else
  log "❌ crontab 安装失败"
  generate_report "failed" 0 0 ${TASK_COUNT}
  exit 1
fi

# ---------- 步骤 5: 验证 ----------
step "5/5" "验证"

log "列出已安装的 crontab..."
crontab -l >>"${LOG_FILE}" 2>&1 || true

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

generate_report "success" ${DURATION} ${INSTALLED} ${TASK_COUNT}

log ""
log "============================================================"
log "✅ 定时任务部署完成"
log "============================================================"
log "已安装: $([ ${INSTALLED} -eq 1 ] && echo '是' || echo '否')"
log "任务数: ${TASK_COUNT}"
log "耗时: ${DURATION} 秒"
log "报告: ${REPORT_FILE}"
log "日志: ${LOG_FILE}"
log ""
log "查看: crontab -l"
log "卸载: ./scripts/deploy_cron_jobs.sh --uninstall"
exit 0
