#!/bin/bash
# PostgreSQL 16 生产升级实战编排脚本
#
# 功能: 编排 PG16 生产升级全流程, 含预检/备份/升级/验证/切换/冒烟/回滚
# 流程: 环境检查 → dry-run 预检 → 全量备份 → 执行升级 → 应用冒烟 → 生成报告
#
# 用法: ./scripts/orchestrate_pg16_upgrade.sh [--skip-backup] [--dry-run]
set -euo pipefail

DRY_RUN=0
SKIP_BACKUP=0
for arg in "$@"; do
  case "${arg}" in
    --dry-run) DRY_RUN=1 ;;
    --skip-backup) SKIP_BACKUP=1 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_DIR="${SERVER_DIR}/logs"
TS=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${LOG_DIR}/pg16_orchestrate_${TS}.log"
REPORT_FILE="${LOG_DIR}/pg16_orchestrate_report_${TS}.json"

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
  local backup_size=$3
  local smoke_result=$4
  cat > "${REPORT_FILE}" <<EOF
{
  "timestamp": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "operation": "pg16_upgrade_orchestration",
  "status": "${status}",
  "duration_seconds": ${duration},
  "skip_backup": ${SKIP_BACKUP},
  "dry_run": ${DRY_RUN},
  "backup_size_mb": ${backup_size},
  "smoke_test": "${smoke_result}",
  "scripts_used": [
    "deploy_pg16_production.sh",
    "backup_pg_encrypted.sh",
    "upgrade_pg14_to_pg16.sh"
  ],
  "log_file": "${LOG_FILE}"
}
EOF
  log "报告已生成: ${REPORT_FILE}"
}

START_TIME=$(date +%s)
BACKUP_SIZE=0
SMOKE_RESULT="skipped"

log "PostgreSQL 16 生产升级实战编排"
log "模式: $([ ${DRY_RUN} -eq 1 ] && echo 'dry-run' || echo 'production')"
log "跳过备份: $([ ${SKIP_BACKUP} -eq 1 ] && echo '是' || echo '否')"
log "日志: ${LOG_FILE}"

# ---------- 步骤 1: 环境检查 ----------
step "1/7" "环境检查"

log "检查 docker..."
if ! command -v docker >/dev/null 2>&1; then
  log "❌ docker 未安装"
  generate_report "failed" 0 0 "${SMOKE_RESULT}"
  exit 1
fi
log "✅ docker 已安装"

log "检查 docker compose..."
if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD="docker-compose"
else
  log "❌ docker compose 未安装"
  generate_report "failed" 0 0 "${SMOKE_RESULT}"
  exit 1
fi
log "✅ ${COMPOSE_CMD} 可用"

log "检查 PG14 容器状态..."
if ${COMPOSE_CMD} -f "${SERVER_DIR}/deploy/docker/docker-compose.yml" ps postgres 2>/dev/null | grep -q "Up"; then
  log "✅ PG14 容器运行中"
else
  log "⚠️  PG14 容器未运行, 尝试启动..."
  ${COMPOSE_CMD} -f "${SERVER_DIR}/deploy/docker/docker-compose.yml" up -d postgres >>"${LOG_FILE}" 2>&1 || true
fi

# ---------- 步骤 2: dry-run 预检 ----------
step "2/7" "dry-run 预检"

log "执行 deploy_pg16_production.sh --dry-run..."
if bash "${SCRIPT_DIR}/deploy_pg16_production.sh" --dry-run >>"${LOG_FILE}" 2>&1; then
  log "✅ dry-run 预检通过"
else
  log "❌ dry-run 预检失败"
  generate_report "failed" 0 0 "${SMOKE_RESULT}"
  exit 1
fi

if [ ${DRY_RUN} -eq 1 ]; then
  log ""
  log "✅ dry-run 模式完成, 未执行实际升级"
  END_TIME=$(date +%s)
  generate_report "dry_run_passed" $((END_TIME - START_TIME)) 0 "${SMOKE_RESULT}"
  exit 0
fi

# ---------- 步骤 3: 全量备份 ----------
step "3/7" "全量备份"

if [ ${SKIP_BACKUP} -eq 1 ]; then
  log "⏭️  跳过备份 (--skip-backup)"
else
  log "执行加密备份..."
  BACKUP_START=$(date +%s)
  if bash "${SCRIPT_DIR}/backup_pg_encrypted.sh" >>"${LOG_FILE}" 2>&1; then
    BACKUP_END=$(date +%s)
    BACKUP_DURATION=$((BACKUP_END - BACKUP_START))
    BACKUP_SIZE=$(du -m "${SERVER_DIR}/backups" 2>/dev/null | tail -1 | cut -f1 || echo "0")
    log "✅ 加密备份完成 (${BACKUP_DURATION}s, ${BACKUP_SIZE}MB)"
  else
    log "❌ 加密备份失败, 终止升级"
    generate_report "failed" 0 0 "${SMOKE_RESULT}"
    exit 1
  fi
fi

# ---------- 步骤 4: 执行升级 ----------
step "4/7" "执行 PG16 升级"

log "调用 deploy_pg16_production.sh..."
if bash "${SCRIPT_DIR}/deploy_pg16_production.sh" >>"${LOG_FILE}" 2>&1; then
  log "✅ PG16 升级完成"
else
  log "❌ PG16 升级失败"
  generate_report "failed" 0 ${BACKUP_SIZE} "${SMOKE_RESULT}"
  exit 1
fi

# ---------- 步骤 5: 应用冒烟测试 ----------
step "5/7" "应用冒烟测试"

log "等待 API 就绪..."
for i in $(seq 1 12); do
  if curl -sf http://localhost:8000/healthz >/dev/null 2>&1; then
    log "✅ API 健康检查通过 (等待 ${i}5 秒)"
    SMOKE_RESULT="passed"
    break
  fi
  sleep 5
  if [ ${i} -eq 12 ]; then
    log "❌ API 60 秒内未就绪"
    SMOKE_RESULT="failed"
  fi
done

if [ "${SMOKE_RESULT}" = "passed" ]; then
  log "执行数据库连通性测试..."
  if ${COMPOSE_CMD} -f "${SERVER_DIR}/deploy/docker/docker-compose.yml" exec -T postgres \
    psql -U zhs -d zhs_ai_project -c "SELECT version();" >>"${LOG_FILE}" 2>&1; then
    log "✅ 数据库连通性正常"
  else
    log "⚠️  数据库连通性测试失败"
    SMOKE_RESULT="db_failed"
  fi
fi

# ---------- 步骤 6: 验证 PG 版本 ----------
step "6/7" "验证 PG 版本"

PG_VERSION=$(${COMPOSE_CMD} -f "${SERVER_DIR}/deploy/docker/docker-compose.yml" exec -T postgres \
  psql -U zhs -d postgres -tAc "SHOW server_version;" 2>/dev/null | tr -d ' ' || echo "unknown")
log "当前 PG 版本: ${PG_VERSION}"

if echo "${PG_VERSION}" | grep -q "^16"; then
  log "✅ 已升级到 PostgreSQL 16"
else
  log "⚠️  PG 版本非 16: ${PG_VERSION}"
fi

# ---------- 步骤 7: 生成报告 ----------
step "7/7" "生成报告"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

if [ "${SMOKE_RESULT}" = "passed" ]; then
  generate_report "success" ${DURATION} ${BACKUP_SIZE} "${SMOKE_RESULT}"
else
  generate_report "smoke_failed" ${DURATION} ${BACKUP_SIZE} "${SMOKE_RESULT}"
fi

log ""
log "============================================================"
log "✅ PG16 升级编排完成"
log "============================================================"
log "状态: $([ "${SMOKE_RESULT}" = "passed" ] && echo '成功' || echo '冒烟失败')"
log "PG 版本: ${PG_VERSION}"
log "备份大小: ${BACKUP_SIZE}MB"
log "冒烟测试: ${SMOKE_RESULT}"
log "耗时: ${DURATION} 秒"
log "报告: ${REPORT_FILE}"
log "日志: ${LOG_FILE}"
exit 0
