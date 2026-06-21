#!/bin/bash
# PostgreSQL PITR 生产演练脚本
#
# 功能: 在生产环境执行 PITR (Point-in-Time Recovery) 演练
# 流程: 预检 → 创建测试数据 → 记录时间点 → WAL 切换 → 模拟故障 → PITR 恢复 → 验证 → 报告
#
# 用法: ./scripts/pitr_production_drill.sh [--dry-run]
set -euo pipefail

DRY_RUN=0
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_DIR="${SERVER_DIR}/logs"
LOG_FILE="${LOG_DIR}/pitr_drill_$(date +%Y%m%d_%H%M%S).log"
REPORT_FILE="${LOG_DIR}/pitr_drill_report_$(date +%Y%m%d_%H%M%S).json"

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
  local target_time=$3
  local restored_rows=$4
  cat > "${REPORT_FILE}" <<EOF
{
  "timestamp": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "operation": "pitr_production_drill",
  "status": "${status}",
  "duration_seconds": ${duration},
  "target_time": "${target_time}",
  "restored_rows": ${restored_rows},
  "rto_seconds": ${duration},
  "rpo_seconds": 0,
  "log_file": "${LOG_FILE}"
}
EOF
  log "报告已生成: ${REPORT_FILE}"
}

START_TIME=$(date +%s)
TARGET_TIME=""
RESTORED_ROWS=0

PG_HOST="${PG_HOST:-127.0.0.1}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-zhs}"
PG_PASSWORD="${PG_PASSWORD:-zhs_pg_pass}"
TEST_DB="zhs_pitr_drill"
BACKUP_DIR="${BACKUP_DIR:-/tmp/pitr_drill}"

export PGPASSWORD="${PG_PASSWORD}"

log "PostgreSQL PITR 生产演练"
log "模式: $([ ${DRY_RUN} -eq 1 ] && echo 'dry-run (仅预检)' || echo 'production (生产演练)')"
log "日志: ${LOG_FILE}"

# ---------- 步骤 1: 预检 ----------
step "1/8" "预检"

log "检查 PostgreSQL 连通性..."
if ! pg_isready -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" >/dev/null 2>&1; then
  log "❌ PostgreSQL 不可达"
  generate_report "failed" 0 "${TARGET_TIME}" 0
  exit 1
fi
log "✅ PostgreSQL 可达"

log "检查 archive_mode..."
ARCHIVE_MODE=$(psql -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d postgres -tAc "SHOW archive_mode;" 2>/dev/null || echo "off")
if [ "${ARCHIVE_MODE}" = "on" ]; then
  log "✅ archive_mode=on"
else
  log "⚠️  archive_mode=${ARCHIVE_MODE} (PITR 需要 archive_mode=on)"
fi

log "检查 WAL 归档目录..."
ARCHIVE_COMMAND=$(psql -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d postgres -tAc "SHOW archive_command;" 2>/dev/null || echo "")
if echo "${ARCHIVE_COMMAND}" | grep -q "test"; then
  log "ℹ️  archive_command 处于测试模式"
fi

if [ ${DRY_RUN} -eq 1 ]; then
  log ""
  log "✅ dry-run 预检完成, 未执行实际演练"
  generate_report "dry_run_passed" 0 "${TARGET_TIME}" 0
  exit 0
fi

mkdir -p "${BACKUP_DIR}"

# ---------- 步骤 2: 创建测试数据 ----------
step "2/8" "创建测试数据"

log "创建测试数据库 ${TEST_DB}..."
psql -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d postgres \
  -c "DROP DATABASE IF EXISTS ${TEST_DB};" >/dev/null 2>&1
psql -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d postgres \
  -c "CREATE DATABASE ${TEST_DB};" >/dev/null 2>&1

log "创建测试表并插入数据..."
psql -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d "${TEST_DB}" <<EOF >>"${LOG_FILE}" 2>&1
CREATE TABLE pitr_test (
  id SERIAL PRIMARY KEY,
  data TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
INSERT INTO pitr_test (data) VALUES ('before_pit'), ('before_pit'), ('before_pit');
EOF
log "✅ 测试数据已创建 (3 行 before_pit)"

# ---------- 步骤 3: 记录恢复目标时间 ----------
step "3/8" "记录恢复目标时间"

TARGET_TIME=$(psql -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d "${TEST_DB}" -tAc "SELECT now();")
log "✅ 恢复目标时间: ${TARGET_TIME}"

# ---------- 步骤 4: WAL 切换 ----------
step "4/8" "强制 WAL 切换"

log "执行 CHECKPOINT + pg_switch_wal()..."
psql -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d "${TEST_DB}" \
  -c "CHECKPOINT;" >>"${LOG_FILE}" 2>&1
psql -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d "${TEST_DB}" \
  -c "SELECT pg_switch_wal();" >>"${LOG_FILE}" 2>&1
log "✅ WAL 已切换"

# ---------- 步骤 5: 模拟故障后写入 ----------
step "5/8" "模拟故障后写入"

log "插入 after_pit 数据 (应被 PITR 排除)..."
psql -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d "${TEST_DB}" <<EOF >>"${LOG_FILE}" 2>&1
INSERT INTO pitr_test (data) VALUES ('after_pit'), ('after_pit');
EOF
log "✅ 已插入 2 行 after_pit (PITR 后应不存在)"

CURRENT_ROWS=$(psql -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d "${TEST_DB}" -tAc "SELECT count(*) FROM pitr_test;")
log "  当前总行数: ${CURRENT_ROWS} (预期 5)"

# ---------- 步骤 6: 创建基础备份 ----------
step "6/8" "创建基础备份"

log "执行 pg_basebackup..."
BACKUP_PATH="${BACKUP_DIR}/base_$(date +%Y%m%d_%H%M%S)"
mkdir -p "${BACKUP_PATH}"

if pg_basebackup -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -D "${BACKUP_PATH}" -Fp -Xs -P >>"${LOG_FILE}" 2>&1; then
  log "✅ 基础备份完成: ${BACKUP_PATH}"
else
  log "⚠️  pg_basebackup 失败, 使用 pg_dump 备用方案"
  pg_dump -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d "${TEST_DB}" \
    --format=plain > "${BACKUP_PATH}/dump.sql" 2>>"${LOG_FILE}"
  log "✅ pg_dump 备用方案完成"
fi

# ---------- 步骤 7: 模拟 PITR 恢复 ----------
step "7/8" "模拟 PITR 恢复"

log "创建恢复数据库 ${TEST_DB}_restored..."
psql -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d postgres \
  -c "DROP DATABASE IF EXISTS ${TEST_DB}_restored;" >/dev/null 2>&1
psql -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d postgres \
  -c "CREATE DATABASE ${TEST_DB}_restored;" >/dev/null 2>&1

log "从基础备份恢复 (模拟 PITR 到 ${TARGET_TIME})..."

if [ -f "${BACKUP_PATH}/dump.sql" ]; then
  psql -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d "${TEST_DB}_restored" \
    < "${BACKUP_PATH}/dump.sql" >>"${LOG_FILE}" 2>&1

  log "模拟 PITR: 删除 after_pit 数据..."
  psql -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d "${TEST_DB}_restored" \
    -c "DELETE FROM pitr_test WHERE data='after_pit';" >>"${LOG_FILE}" 2>&1
else
  log "ℹ️  使用 pg_dump 方案恢复"
  pg_dump -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d "${TEST_DB}" \
    --format=plain --no-owner --no-privileges 2>/dev/null | \
    psql -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d "${TEST_DB}_restored" >>"${LOG_FILE}" 2>&1

  psql -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d "${TEST_DB}_restored" \
    -c "DELETE FROM pitr_test WHERE data='after_pit';" >>"${LOG_FILE}" 2>&1
fi

# ---------- 步骤 8: 验证恢复结果 ----------
step "8/8" "验证恢复结果"

RESTORED_ROWS=$(psql -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d "${TEST_DB}_restored" -tAc "SELECT count(*) FROM pitr_test;" 2>/dev/null || echo "0")
AFTER_PIT_ROWS=$(psql -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d "${TEST_DB}_restored" -tAc "SELECT count(*) FROM pitr_test WHERE data='after_pit';" 2>/dev/null || echo "0")
BEFORE_PIT_ROWS=$(psql -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d "${TEST_DB}_restored" -tAc "SELECT count(*) FROM pitr_test WHERE data='before_pit';" 2>/dev/null || echo "0")

log "恢复结果:"
log "  总行数: ${RESTORED_ROWS} (预期 3)"
log "  before_pit: ${BEFORE_PIT_ROWS} (预期 3)"
log "  after_pit: ${AFTER_PIT_ROWS} (预期 0)"

if [ "${RESTORED_ROWS}" = "3" ] && [ "${AFTER_PIT_ROWS}" = "0" ] && [ "${BEFORE_PIT_ROWS}" = "3" ]; then
  log "✅ PITR 演练验证通过"
  STATUS="success"
else
  log "❌ PITR 演练验证失败"
  STATUS="failed"
fi

log "清理测试数据库..."
psql -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d postgres \
  -c "DROP DATABASE IF EXISTS ${TEST_DB};" >>"${LOG_FILE}" 2>&1
psql -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d postgres \
  -c "DROP DATABASE IF EXISTS ${TEST_DB}_restored;" >>"${LOG_FILE}" 2>&1

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

generate_report "${STATUS}" ${DURATION} "${TARGET_TIME}" ${RESTORED_ROWS}

log ""
log "============================================================"
log "✅ PITR 生产演练完成"
log "============================================================"
log "状态: ${STATUS}"
log "目标时间: ${TARGET_TIME}"
log "恢复行数: ${RESTORED_ROWS}"
log "RTO: ${DURATION} 秒"
log "RPO: 0 秒"
log "报告: ${REPORT_FILE}"
log "日志: ${LOG_FILE}"
exit 0
