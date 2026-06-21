#!/usr/bin/env bash
# PITR crontab 安装脚本
# 注册 daily_pitr_cron.sh 到 crontab (每周六 04:00 执行)
# 支持 --install / --uninstall / --status / --validate
#
# 用法:
#   bash scripts/deploy_pitr_cron.sh --install
#   bash scripts/deploy_pitr_cron.sh --uninstall
#   bash scripts/deploy_pitr_cron.sh --status
#   bash scripts/deploy_pitr_cron.sh --validate

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_DIR="${SERVER_DIR}/logs"
LOG_DIR="${LOG_DIR:-/tmp}"
mkdir -p "${LOG_DIR}"

TS=$(date -u +%Y%m%d_%H%M%S)
LOG_FILE="${LOG_DIR}/deploy_pitr_cron_${TS}.log"
REPORT_FILE="${LOG_DIR}/deploy_pitr_cron_report_${TS}.json"

ACTION="status"
if [ $# -gt 0 ]; then
  ACTION="$1"
fi

PITR_SCRIPT="${SCRIPT_DIR}/daily_pitr_cron.sh"
CRON_MARKER="# ZHS_PITR_DAILY_DRILL"
CRON_LINE="0 4 * * 6 ${PITR_SCRIPT} >> ${LOG_DIR}/pitr_daily_cron.log 2>&1 ${CRON_MARKER}"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" | tee -a "${LOG_FILE}"; }

log "=========================================="
log "PITR crontab 管理 - 操作: ${ACTION}"
log "=========================================="

# 1. 预检
log "[1/5] 预检环境..."
if [ ! -x "${PITR_SCRIPT}" ]; then
  log "⚠️  PITR 脚本不存在或不可执行: ${PITR_SCRIPT}"
  if [ ! -f "${PITR_SCRIPT}" ]; then
    log "❌ PITR 脚本不存在, 终止"
    exit 1
  fi
  chmod +x "${PITR_SCRIPT}" 2>/dev/null || true
fi
HAS_CRONTAB=false
command -v crontab >/dev/null 2>&1 && HAS_CRONTAB=true
log "  crontab 命令: ${HAS_CRONTAB}"
log "✅ 预检完成"

# 2. 检测现有 crontab
log "[2/5] 检测现有 crontab..."
EXISTING_LINE=""
if [ "${HAS_CRONTAB}" = true ]; then
  EXISTING_LINE=$(crontab -l 2>/dev/null | grep "${CRON_MARKER}" || echo "")
fi
if [ -n "${EXISTING_LINE}" ]; then
  log "  发现现有 PITR crontab: ${EXISTING_LINE}"
else
  log "  未发现现有 PITR crontab"
fi

# 3. 执行操作
log "[3/5] 执行操作: ${ACTION}..."
case "${ACTION}" in
  --install)
    if [ -n "${EXISTING_LINE}" ]; then
      log "  ⚠️  PITR crontab 已存在, 跳过安装"
      RESULT_STATUS="already_installed"
    else
      if [ "${HAS_CRONTAB}" = true ]; then
        (crontab -l 2>/dev/null; echo "${CRON_LINE}") | crontab - 2>>"${LOG_FILE}" || {
          log "❌ crontab 安装失败"
          exit 1
        }
        log "  ✅ crontab 已安装: ${CRON_LINE}"
      else
        log "  [DRY-RUN] 假设 crontab 安装: ${CRON_LINE}"
      fi
      RESULT_STATUS="installed"
    fi
    ;;

  --uninstall)
    if [ -z "${EXISTING_LINE}" ]; then
      log "  ⚠️  PITR crontab 不存在, 无需卸载"
      RESULT_STATUS="not_installed"
    else
      if [ "${HAS_CRONTAB}" = true ]; then
        crontab -l 2>/dev/null | grep -v "${CRON_MARKER}" | crontab - 2>>"${LOG_FILE}" || {
          log "❌ crontab 卸载失败"
          exit 1
        }
        log "  ✅ crontab 已卸载"
      else
        log "  [DRY-RUN] 假设卸载"
      fi
      RESULT_STATUS="uninstalled"
    fi
    ;;

  --status)
    if [ -n "${EXISTING_LINE}" ]; then
      log "  ✅ PITR crontab 已安装"
      log "  计划: ${EXISTING_LINE}"
      RESULT_STATUS="installed"
    else
      log "  ❌ PITR crontab 未安装"
      RESULT_STATUS="not_installed"
    fi
    ;;

  --validate)
    log "  验证 PITR 脚本可执行性..."
    if [ -x "${PITR_SCRIPT}" ]; then
      log "  ✅ 脚本可执行"
    else
      log "  ❌ 脚本不可执行"
      RESULT_STATUS="invalid"
    fi
    if [ -n "${EXISTING_LINE}" ]; then
      log "  ✅ crontab 已注册"
    else
      log "  ⚠️  crontab 未注册"
    fi
    RESULT_STATUS="validated"
    ;;

  *)
    log "❌ 未知操作: ${ACTION}"
    log "  支持: --install / --uninstall / --status / --validate"
    exit 1
    ;;
esac

# 4. 验证
log "[4/5] 验证结果..."
case "${ACTION}" in
  --install)
    if [ "${HAS_CRONTAB}" = true ]; then
      NEW_LINE=$(crontab -l 2>/dev/null | grep "${CRON_MARKER}" || echo "")
      if [ -n "${NEW_LINE}" ]; then
        log "  ✅ 验证成功: crontab 包含 PITR 行"
      else
        log "  ❌ 验证失败: crontab 未包含 PITR 行"
        RESULT_STATUS="install_failed"
      fi
    fi
    ;;

  --uninstall)
    if [ "${HAS_CRONTAB}" = true ]; then
      NEW_LINE=$(crontab -l 2>/dev/null | grep "${CRON_MARKER}" || echo "")
      if [ -z "${NEW_LINE}" ]; then
        log "  ✅ 验证成功: crontab 已清理 PITR 行"
      else
        log "  ❌ 验证失败: crontab 仍包含 PITR 行"
        RESULT_STATUS="uninstall_failed"
      fi
    fi
    ;;
esac

# 5. 生成报告
log "[5/5] 生成报告..."
REPORT=$(cat <<EOF
{
  "operation": "deploy_pitr_cron",
  "action": "${ACTION}",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "result_status": "${RESULT_STATUS:-unknown}",
  "pitr_script": "${PITR_SCRIPT}",
  "cron_line": "${CRON_LINE}",
  "has_crontab": ${HAS_CRONTAB},
  "log_file": "${LOG_FILE}"
}
EOF
)
echo "${REPORT}" > "${REPORT_FILE}"
log "✅ 报告已生成: ${REPORT_FILE}"
log "=========================================="
log "PITR crontab 管理完成: ${RESULT_STATUS:-unknown}"
log "=========================================="
exit 0
