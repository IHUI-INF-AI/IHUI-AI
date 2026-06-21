#!/bin/bash
# PostgreSQL 慢查询治理定时任务脚本
#
# 功能: 定时采集慢查询 + 索引优化建议, 生成 JSON 报告
# 频率: 每小时 (通过 crontab 配置)
# 流程: 调用治理脚本 → 调用索引优化 → 汇总报告 → 告警判断 → 通知
#
# 用法: ./scripts/cron_pg_slow_query.sh
# crontab: 0 * * * * /path/to/cron_pg_slow_query.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_DIR="${SERVER_DIR}/logs"
REPORT_DIR="${SERVER_DIR}/logs/pg_slow_query"
TS=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${LOG_DIR}/pg_slow_query_cron_${TS}.log"
SUMMARY_FILE="${REPORT_DIR}/summary_${TS}.json"

mkdir -p "${REPORT_DIR}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "${LOG_FILE}"
}

log "============================================================"
log "PostgreSQL 慢查询治理定时任务"
log "============================================================"
log "时间戳: ${TS}"
log "报告目录: ${REPORT_DIR}"

# ---------- 步骤 1: 采集慢查询 ----------
log ""
log "[1/4] 采集慢查询..."
SLOW_QUERY_REPORT="${REPORT_DIR}/slow_query_${TS}.json"
if bash "${SCRIPT_DIR}/pg_slow_query_governance.sh" > "${SLOW_QUERY_REPORT}" 2>>"${LOG_FILE}"; then
  log "✅ 慢查询采集完成: ${SLOW_QUERY_REPORT}"
else
  log "❌ 慢查询采集失败"
  exit 1
fi

# ---------- 步骤 2: 索引优化建议 ----------
log ""
log "[2/4] 索引优化建议..."
INDEX_REPORT="${REPORT_DIR}/index_optimization_${TS}.json"
if bash "${SCRIPT_DIR}/pg_index_optimization.sh" > "${INDEX_REPORT}" 2>>"${LOG_FILE}"; then
  log "✅ 索引优化完成: ${INDEX_REPORT}"
else
  log "⚠️  索引优化失败 (非致命)"
  echo '{"status":"failed","timestamp":"'$(date -u '+%Y-%m-%dT%H:%M:%SZ')'"}' > "${INDEX_REPORT}"
fi

# ---------- 步骤 3: 汇总报告 ----------
log ""
log "[3/4] 汇总报告..."

SLOW_QUERY_COUNT=$(python3 -c "
import json
try:
    data = json.load(open('${SLOW_QUERY_REPORT}'))
    queries = data.get('slow_queries', [])
    total = sum(len(db.get('queries', [])) for db in queries)
    print(total)
except Exception:
    print(0)
" 2>/dev/null || echo "0")

INDEX_ISSUES=$(python3 -c "
import json
try:
    data = json.load(open('${INDEX_REPORT}'))
    issues = len(data.get('missing_indexes', [])) + len(data.get('unused_indexes', [])) + len(data.get('bloat_tables', []))
    print(issues)
except Exception:
    print(0)
" 2>/dev/null || echo "0")

ALERT_THRESHOLD=10
ALERT_TRIGGERED=0
if [ "${SLOW_QUERY_COUNT}" -gt ${ALERT_THRESHOLD} ] || [ "${INDEX_ISSUES}" -gt ${ALERT_THRESHOLD} ]; then
  ALERT_TRIGGERED=1
fi

cat > "${SUMMARY_FILE}" <<EOF
{
  "timestamp": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "operation": "pg_slow_query_cron",
  "status": "success",
  "slow_query_count": ${SLOW_QUERY_COUNT},
  "index_issues": ${INDEX_ISSUES},
  "alert_threshold": ${ALERT_THRESHOLD},
  "alert_triggered": ${ALERT_TRIGGERED},
  "reports": {
    "slow_query": "${SLOW_QUERY_REPORT}",
    "index_optimization": "${INDEX_REPORT}"
  },
  "log_file": "${LOG_FILE}"
}
EOF
log "✅ 汇总报告: ${SUMMARY_FILE}"

# ---------- 步骤 4: 告警通知 ----------
log ""
log "[4/4] 告警通知..."

if [ ${ALERT_TRIGGERED} -eq 1 ]; then
  log "⚠️  告警触发: 慢查询=${SLOW_QUERY_COUNT}, 索引问题=${INDEX_ISSUES}"
  if [ -f "${SCRIPT_DIR}/notify_dingtalk.sh" ]; then
    ALERT_MSG="PostgreSQL 慢查询告警: 慢查询 ${SLOW_QUERY_COUNT} 条, 索引问题 ${INDEX_ISSUES} 个, 阈值 ${ALERT_THRESHOLD}"
    bash "${SCRIPT_DIR}/notify_dingtalk.sh" "${ALERT_MSG}" >>"${LOG_FILE}" 2>&1 || log "  (钉钉通知失败, 非致命)"
    log "✅ 钉钉告警已发送"
  else
    log "ℹ️  notify_dingtalk.sh 不存在, 跳过钉钉通知"
  fi
else
  log "✅ 无告警: 慢查询=${SLOW_QUERY_COUNT}, 索引问题=${INDEX_ISSUES} (阈值 ${ALERT_THRESHOLD})"
fi

# ---------- 清理旧报告 (保留 7 天) ----------
log ""
log "清理 7 天前的旧报告..."
find "${REPORT_DIR}" -name "*.json" -mtime +7 -delete 2>/dev/null || true
log "✅ 旧报告清理完成"

log ""
log "============================================================"
log "✅ 慢查询治理定时任务完成"
log "============================================================"
log "慢查询: ${SLOW_QUERY_COUNT} 条"
log "索引问题: ${INDEX_ISSUES} 个"
log "告警: $([ ${ALERT_TRIGGERED} -eq 1 ] && echo '已触发' || echo '无')"
log "汇总: ${SUMMARY_FILE}"
exit 0
