#!/bin/bash
# PostgreSQL 17 staging 环境准备脚本
#
# 功能: 准备 PG17 staging 环境, 执行兼容性验证
# 流程: 预检 → 启动 PG17 → 数据迁移 → 兼容性测试 → 增量备份测试 → JSON_TABLE 测试 → 报告
#
# 用法: ./scripts/prepare_pg17_staging.sh [--dry-run]
set -euo pipefail

DRY_RUN=0
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_DIR="${SERVER_DIR}/logs"
TS=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${LOG_DIR}/pg17_staging_${TS}.log"
REPORT_FILE="${LOG_DIR}/pg17_staging_report_${TS}.json"

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
  local pg_version=$3
  local compat_test=$4
  local incremental_backup=$5
  local json_table=$6
  cat > "${REPORT_FILE}" <<EOF
{
  "timestamp": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "operation": "pg17_staging_preparation",
  "status": "${status}",
  "duration_seconds": ${duration},
  "pg_version": "${pg_version}",
  "compatibility_test": "${compat_test}",
  "incremental_backup_test": "${incremental_backup}",
  "json_table_test": "${json_table}",
  "staging_port": 5434,
  "log_file": "${LOG_FILE}"
}
EOF
  log "报告已生成: ${REPORT_FILE}"
}

START_TIME=$(date +%s)
PG_VERSION="unknown"
COMPAT_TEST="skipped"
INCREMENTAL_BACKUP="skipped"
JSON_TABLE="skipped"

log "PostgreSQL 17 staging 环境准备"
log "模式: $([ ${DRY_RUN} -eq 1 ] && echo 'dry-run' || echo 'production')"
log "日志: ${LOG_FILE}"

# ---------- 步骤 1: 预检 ----------
step "1/7" "预检"

log "检查 docker..."
if ! command -v docker >/dev/null 2>&1; then
  log "❌ docker 未安装"
  generate_report "failed" 0 "${PG_VERSION}" "${COMPAT_TEST}" "${INCREMENTAL_BACKUP}" "${JSON_TABLE}"
  exit 1
fi
log "✅ docker 已安装"

log "检查 PG17 compose 文件..."
COMPOSE_FILE="${SERVER_DIR}/deploy/docker/docker-compose.pg17-staging.yml"
if [ ! -f "${COMPOSE_FILE}" ]; then
  log "❌ 缺少 ${COMPOSE_FILE}"
  generate_report "failed" 0 "${PG_VERSION}" "${COMPAT_TEST}" "${INCREMENTAL_BACKUP}" "${JSON_TABLE}"
  exit 1
fi
log "✅ deploy/docker/docker-compose.pg17-staging.yml 存在"

log "检查 PG17 评估文档..."
ASSESSMENT_DOC="${SERVER_DIR}/docs/PG17_UPGRADE_ASSESSMENT.md"
if [ ! -f "${ASSESSMENT_DOC}" ]; then
  log "❌ 缺少 ${ASSESSMENT_DOC}"
  generate_report "failed" 0 "${PG_VERSION}" "${COMPAT_TEST}" "${INCREMENTAL_BACKUP}" "${JSON_TABLE}"
  exit 1
fi
log "✅ PG17_UPGRADE_ASSESSMENT.md 存在"

if [ ${DRY_RUN} -eq 1 ]; then
  log ""
  log "✅ dry-run 预检完成"
  END_TIME=$(date +%s)
  generate_report "dry_run_passed" $((END_TIME - START_TIME)) "${PG_VERSION}" "${COMPAT_TEST}" "${INCREMENTAL_BACKUP}" "${JSON_TABLE}"
  exit 0
fi

# ---------- 步骤 2: 启动 PG17 ----------
step "2/7" "启动 PG17 staging"

log "启动 PG17 容器 (端口 5434)..."
if docker compose -f "${COMPOSE_FILE}" up -d >>"${LOG_FILE}" 2>&1; then
  log "✅ PG17 容器已启动"
else
  log "❌ PG17 启动失败"
  generate_report "failed" 0 "${PG_VERSION}" "${COMPAT_TEST}" "${INCREMENTAL_BACKUP}" "${JSON_TABLE}"
  exit 1
fi

log "等待 PG17 就绪..."
for i in $(seq 1 30); do
  if pg_isready -h 127.0.0.1 -p 5434 -U zhs >/dev/null 2>&1; then
    log "✅ PG17 就绪 (等待 ${i}0 秒)"
    break
  fi
  sleep 10
  if [ ${i} -eq 30 ]; then
    log "❌ PG17 300 秒内未就绪"
    generate_report "failed" 0 "${PG_VERSION}" "${COMPAT_TEST}" "${INCREMENTAL_BACKUP}" "${JSON_TABLE}"
    exit 1
  fi
done

PG_VERSION=$(psql -h 127.0.0.1 -p 5434 -U zhs -d postgres -tAc "SHOW server_version;" 2>/dev/null || echo "unknown")
log "PG17 版本: ${PG_VERSION}"

# ---------- 步骤 3: 数据迁移 ----------
step "3/7" "数据迁移 (从 PG16)"

log "从 PG16 导出数据..."
DATABASES=("zhs_ai_project" "zhs_center_project" "zhs_educational_training")
for db in "${DATABASES[@]}"; do
  log "  - 迁移 ${db}..."
  psql -h 127.0.0.1 -p 5434 -U zhs -d postgres -c "CREATE DATABASE ${db};" >>"${LOG_FILE}" 2>&1 || true
  if pg_dump -h 127.0.0.1 -p 5433 -U zhs -d "${db}" --format=plain --no-owner --no-privileges 2>/dev/null | \
     psql -h 127.0.0.1 -p 5434 -U zhs -d "${db}" >>"${LOG_FILE}" 2>&1; then
    log "    ✅ ${db} 迁移成功"
  else
    log "    ⚠️  ${db} 迁移失败 (可能 PG16 未运行)"
  fi
done

# ---------- 步骤 4: 兼容性测试 ----------
step "4/7" "兼容性测试"

log "执行 SQL 兼容性测试..."
psql -h 127.0.0.1 -p 5434 -U zhs -d postgres <<EOF >>"${LOG_FILE}" 2>&1
-- 测试基本 SQL
SELECT 1;
-- 测试 JSON
SELECT '{"a": 1}'::json->'a';
-- 测试数组
SELECT ARRAY[1, 2, 3];
-- 测试窗口函数
SELECT row_number() OVER (ORDER BY 1);
EOF

if [ $? -eq 0 ]; then
  log "✅ 兼容性测试通过"
  COMPAT_TEST="passed"
else
  log "❌ 兼容性测试失败"
  COMPAT_TEST="failed"
fi

# ---------- 步骤 5: 增量备份测试 ----------
step "5/7" "增量备份测试"

log "测试 pg_basebackup --incremental..."
if pg_basebackup -h 127.0.0.1 -p 5434 -U zhs -D /tmp/pg17_incremental_test -Fp -Xs -P --incremental >>"${LOG_FILE}" 2>&1; then
  log "✅ 增量备份支持"
  INCREMENTAL_BACKUP="passed"
  rm -rf /tmp/pg17_incremental_test
else
  log "⚠️  增量备份不支持或失败"
  INCREMENTAL_BACKUP="failed"
fi

# ---------- 步骤 6: JSON_TABLE 测试 ----------
step "6/7" "JSON_TABLE 测试"

log "测试 JSON_TABLE 函数..."
psql -h 127.0.0.1 -p 5434 -U zhs -d postgres <<EOF >>"${LOG_FILE}" 2>&1
SELECT * FROM JSON_TABLE(
  '[{"name": "Alice", "age": 30}, {"name": "Bob", "age": 25}]'::json,
  '\$[*]'
  COLUMNS (
    name TEXT PATH '\$.name',
    age INT PATH '\$.age'
  )
);
EOF

if [ $? -eq 0 ]; then
  log "✅ JSON_TABLE 支持"
  JSON_TABLE="passed"
else
  log "⚠️  JSON_TABLE 不支持"
  JSON_TABLE="failed"
fi

# ---------- 步骤 7: 生成报告 ----------
step "7/7" "生成报告"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

generate_report "success" ${DURATION} "${PG_VERSION}" "${COMPAT_TEST}" "${INCREMENTAL_BACKUP}" "${JSON_TABLE}"

log ""
log "============================================================"
log "✅ PG17 staging 环境准备完成"
log "============================================================"
log "PG 版本: ${PG_VERSION}"
log "兼容性测试: ${COMPAT_TEST}"
log "增量备份: ${INCREMENTAL_BACKUP}"
log "JSON_TABLE: ${JSON_TABLE}"
log "staging 端口: 5434"
log "耗时: ${DURATION} 秒"
log "报告: ${REPORT_FILE}"
log "日志: ${LOG_FILE}"
log ""
log "下一步:"
log "  1. 执行应用回归测试"
log "  2. 执行性能基准测试"
log "  3. 等待 Patroni spilo-17 镜像"
log "  4. 创建 upgrade_pg16_to_pg17.sh"
exit 0
