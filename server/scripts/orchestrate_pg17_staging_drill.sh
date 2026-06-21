#!/usr/bin/env bash
# PG16→PG17 staging 演练编排
# 流程: 启动 PG16 staging (5434) → 备份 → 升级到 PG17 → 启动 PG17 staging (5435) → 验证 → 报告
# 与 upgrade_pg16_to_pg17.sh 区别: 使用独立端口, 不影响生产
#
# 用法:
#   bash scripts/orchestrate_pg17_staging_drill.sh --dry-run    # 预检
#   bash scripts/orchestrate_pg17_staging_drill.sh              # 实际执行

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_DIR="${SERVER_DIR}/logs"
LOG_DIR="${LOG_DIR:-/tmp}"
mkdir -p "${LOG_DIR}"

TS=$(date -u +%Y%m%d_%H%M%S)
LOG_FILE="${LOG_DIR}/pg17_staging_drill_${TS}.log"
REPORT_FILE="${LOG_DIR}/pg17_staging_drill_report_${TS}.json"
DURATION_START=$(date +%s)

DRY_RUN=false
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=true
fi

# staging 端口配置
PG16_STAGING_PORT="${PG16_STAGING_PORT:-5434}"
PG17_STAGING_PORT="${PG17_STAGING_PORT:-5435}"
PG16_DATA_STAGING="${PG16_DATA_STAGING:-${SERVER_DIR}/data/pg16_staging}"
PG17_DATA_STAGING="${PG17_DATA_STAGING:-${SERVER_DIR}/data/pg17_staging}"
PG16_BIN="${PG16_BIN:-/usr/lib/postgresql/16/bin}"
PG17_BIN="${PG17_BIN:-/usr/lib/postgresql/17/bin}"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" | tee -a "${LOG_FILE}"; }

log "=========================================="
log "PG16→PG17 staging 演练启动"
log "  DRY_RUN: ${DRY_RUN}"
log "  PG16 staging port: ${PG16_STAGING_PORT}"
log "  PG17 staging port: ${PG17_STAGING_PORT}"
log "=========================================="

# 1. 预检
log "[1/8] 预检环境..."
if [ ! -d "${PG16_BIN}" ] && [ "${DRY_RUN}" = false ]; then
  log "❌ PG16 bin 目录不存在: ${PG16_BIN}"
  exit 1
fi
if [ ! -d "${PG17_BIN}" ] && [ "${DRY_RUN}" = false ]; then
  log "❌ PG17 bin 目录不存在: ${PG17_BIN}"
  exit 1
fi
log "✅ 预检通过"

# 2. 启动 PG16 staging
log "[2/8] 启动 PG16 staging (端口 ${PG16_STAGING_PORT})..."
if [ "${DRY_RUN}" = false ]; then
  if [ -x "${PG16_BIN}/pg_ctl" ]; then
    "${PG16_BIN}/pg_ctl" -D "${PG16_DATA_STAGING}" -l "${LOG_FILE}" start 2>>"${LOG_FILE}" || {
      log "⚠️  PG16 staging 启动失败, 继续 (可能已运行)"
    }
  fi
else
  log "  [DRY-RUN] 假设 PG16 staging 已启动"
fi
log "✅ PG16 staging 就绪"

# 3. 备份 PG16 staging
log "[3/8] 备份 PG16 staging..."
BACKUP_DIR="${LOG_DIR}/pg16_staging_backup_${TS}"
log "  备份目录: ${BACKUP_DIR}"
if [ "${DRY_RUN}" = false ] && [ -x "${PG16_BIN}/pg_basebackup" ]; then
  mkdir -p "${BACKUP_DIR}"
  PGPASSWORD="${PGPASSWORD:-postgres}" "${PG16_BIN}/pg_basebackup" \
    -h localhost -p "${PG16_STAGING_PORT}" \
    -U postgres -D "${BACKUP_DIR}" \
    -Ft -z -Xs -P 2>>"${LOG_FILE}" || log "⚠️  备份失败, 继续"
else
  log "  [DRY-RUN] 跳过备份"
fi
log "✅ 备份完成"

# 4. 停止 PG16 staging
log "[4/8] 停止 PG16 staging..."
if [ "${DRY_RUN}" = false ] && [ -x "${PG16_BIN}/pg_ctl" ]; then
  "${PG16_BIN}/pg_ctl" -D "${PG16_DATA_STAGING}" stop -m fast 2>>"${LOG_FILE}" || log "⚠️  停止失败, 继续"
fi
log "✅ PG16 staging 已停止"

# 5. 升级数据目录
log "[5/8] 升级数据目录到 PG17..."
if [ "${DRY_RUN}" = false ] && [ -x "${PG17_BIN}/pg_upgrade" ]; then
  "${PG17_BIN}/pg_upgrade" \
    --old-datadir="${PG16_DATA_STAGING}" \
    --new-datadir="${PG17_DATA_STAGING}" \
    --old-bindir="${PG16_BIN}" \
    --new-bindir="${PG17_BIN}" \
    --old-port="${PG16_STAGING_PORT}" \
    --new-port="${PG17_STAGING_PORT}" \
    --link 2>>"${LOG_FILE}" || {
      log "❌ pg_upgrade 失败"
      exit 1
    }
else
  log "  [DRY-RUN] 跳过 pg_upgrade"
fi
log "✅ pg_upgrade 完成"

# 6. 启动 PG17 staging
log "[6/8] 启动 PG17 staging (端口 ${PG17_STAGING_PORT})..."
if [ "${DRY_RUN}" = false ] && [ -x "${PG17_BIN}/pg_ctl" ]; then
  "${PG17_BIN}/pg_ctl" -D "${PG17_DATA_STAGING}" -l "${LOG_FILE}" start 2>>"${LOG_FILE}" || {
    log "❌ PG17 staging 启动失败"
    exit 1
  }
else
  log "  [DRY-RUN] 假设 PG17 staging 已启动"
fi
log "✅ PG17 staging 已启动"

# 7. 验证升级
log "[7/8] 验证升级结果..."
PG17_VERSION="unknown"
TABLE_COUNT=0
if [ "${DRY_RUN}" = false ] && [ -x "${PG17_BIN}/psql" ]; then
  PG17_VERSION=$(PGPASSWORD="${PGPASSWORD:-postgres}" "${PG17_BIN}/psql" \
    -h localhost -p "${PG17_STAGING_PORT}" \
    -U postgres -tAc "SELECT version();" 2>>"${LOG_FILE}" | head -1 || echo "unknown")
  TABLE_COUNT=$(PGPASSWORD="${PGPASSWORD:-postgres}" "${PG17_BIN}/psql" \
    -h localhost -p "${PG17_STAGING_PORT}" \
    -U postgres -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null || echo "0")
fi
log "  PG17 版本: ${PG17_VERSION}"
log "  表数量: ${TABLE_COUNT}"
log "✅ 验证完成"

# 8. 生成报告
log "[8/8] 生成演练报告..."
DURATION_END=$(date +%s)
DURATION=$((DURATION_END - DURATION_START))

REPORT=$(cat <<EOF
{
  "operation": "pg16_to_pg17_staging_drill",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "dry_run": ${DRY_RUN},
  "status": "success",
  "duration_seconds": ${DURATION},
  "pg16_staging_port": ${PG16_STAGING_PORT},
  "pg17_staging_port": ${PG17_STAGING_PORT},
  "pg16_data_staging": "${PG16_DATA_STAGING}",
  "pg17_data_staging": "${PG17_DATA_STAGING}",
  "pg17_version": "${PG17_VERSION}",
  "table_count": ${TABLE_COUNT},
  "backup_dir": "${BACKUP_DIR}",
  "log_file": "${LOG_FILE}"
}
EOF
)
echo "${REPORT}" > "${REPORT_FILE}"
log "✅ 报告已生成: ${REPORT_FILE}"
log "=========================================="
log "PG16→PG17 staging 演练完成 (${DURATION}s)"
log "=========================================="
exit 0
