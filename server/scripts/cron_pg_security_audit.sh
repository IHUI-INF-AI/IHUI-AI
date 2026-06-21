#!/bin/bash
# PostgreSQL 安全审计定时任务脚本
#
# 功能: 定时执行安全审计, 生成 JSON 报告, 触发告警
# 频率: 每日 02:00 (通过 crontab 配置)
# 流程: 调用审计脚本 → 解析结果 → 告警判断 → 通知 → 清理
#
# 用法: ./scripts/cron_pg_security_audit.sh
# crontab: 0 2 * * * /path/to/cron_pg_security_audit.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_DIR="${SERVER_DIR}/logs"
REPORT_DIR="${SERVER_DIR}/logs/pg_security"
TS=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${LOG_DIR}/pg_security_cron_${TS}.log"
SUMMARY_FILE="${REPORT_DIR}/summary_${TS}.json"

mkdir -p "${REPORT_DIR}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "${LOG_FILE}"
}

log "============================================================"
log "PostgreSQL 安全审计定时任务"
log "============================================================"
log "时间戳: ${TS}"
log "报告目录: ${REPORT_DIR}"

# ---------- 步骤 1: 执行安全审计 ----------
log ""
log "[1/4] 执行安全审计..."
AUDIT_REPORT="${REPORT_DIR}/audit_${TS}.json"
if bash "${SCRIPT_DIR}/pg_security_audit.sh" > "${AUDIT_REPORT}" 2>>"${LOG_FILE}"; then
  log "✅ 安全审计完成: ${AUDIT_REPORT}"
else
  log "❌ 安全审计失败"
  exit 1
fi

# ---------- 步骤 2: 解析审计结果 ----------
log ""
log "[2/4] 解析审计结果..."

ISSUES_COUNT=$(python3 -c "
import json
try:
    data = json.load(open('${AUDIT_REPORT}'))
    issues = 0
    for check in data.get('checks', []):
        if check.get('status') == 'fail':
            issues += 1
    print(issues)
except Exception:
    print(0)
" 2>/dev/null || echo "0")

CRITICAL_COUNT=$(python3 -c "
import json
try:
    data = json.load(open('${AUDIT_REPORT}'))
    critical = 0
    for check in data.get('checks', []):
        if check.get('status') == 'fail' and check.get('severity') == 'critical':
            critical += 1
    print(critical)
except Exception:
    print(0)
" 2>/dev/null || echo "0")

TOTAL_CHECKS=$(python3 -c "
import json
try:
    data = json.load(open('${AUDIT_REPORT}'))
    print(len(data.get('checks', [])))
except Exception:
    print(0)
" 2>/dev/null || echo "0")

log "  审计项: ${TOTAL_CHECKS}"
log "  问题数: ${ISSUES_COUNT}"
log "  严重问题: ${CRITICAL_COUNT}"

# ---------- 步骤 3: 告警判断与通知 ----------
log ""
log "[3/4] 告警判断与通知..."

ALERT_THRESHOLD=0
ALERT_TRIGGERED=0
if [ "${CRITICAL_COUNT}" -gt ${ALERT_THRESHOLD} ]; then
  ALERT_TRIGGERED=1
  log "⚠️  严重告警触发: ${CRITICAL_COUNT} 个严重问题"
elif [ "${ISSUES_COUNT}" -gt 5 ]; then
  ALERT_TRIGGERED=1
  log "⚠️  告警触发: ${ISSUES_COUNT} 个问题 (>5)"
fi

if [ ${ALERT_TRIGGERED} -eq 1 ]; then
  if [ -f "${SCRIPT_DIR}/notify_dingtalk.sh" ]; then
    ALERT_MSG="PostgreSQL 安全审计告警: 总问题 ${ISSUES_COUNT}, 严重 ${CRITICAL_COUNT}, 审计项 ${TOTAL_CHECKS}"
    bash "${SCRIPT_DIR}/notify_dingtalk.sh" "${ALERT_MSG}" >>"${LOG_FILE}" 2>&1 || log "  (钉钉通知失败, 非致命)"
    log "✅ 钉钉告警已发送"
  else
    log "ℹ️  notify_dingtalk.sh 不存在, 跳过钉钉通知"
  fi
else
  log "✅ 无告警"
fi

# ---------- 步骤 4: 汇总报告 ----------
log ""
log "[4/4] 汇总报告..."

cat > "${SUMMARY_FILE}" <<EOF
{
  "timestamp": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "operation": "pg_security_audit_cron",
  "status": "success",
  "total_checks": ${TOTAL_CHECKS},
  "issues_count": ${ISSUES_COUNT},
  "critical_count": ${CRITICAL_COUNT},
  "alert_triggered": ${ALERT_TRIGGERED},
  "audit_report": "${AUDIT_REPORT}",
  "log_file": "${LOG_FILE}"
}
EOF
log "✅ 汇总报告: ${SUMMARY_FILE}"

# ---------- 清理旧报告 (保留 30 天) ----------
log ""
log "清理 30 天前的旧报告..."
find "${REPORT_DIR}" -name "*.json" -mtime +30 -delete 2>/dev/null || true
log "✅ 旧报告清理完成"

log ""
log "============================================================"
log "✅ 安全审计定时任务完成"
log "============================================================"
log "审计项: ${TOTAL_CHECKS}"
log "问题数: ${ISSUES_COUNT}"
log "严重问题: ${CRITICAL_COUNT}"
log "告警: $([ ${ALERT_TRIGGERED} -eq 1 ] && echo '已触发' || echo '无')"
log "汇总: ${SUMMARY_FILE}"
exit 0
