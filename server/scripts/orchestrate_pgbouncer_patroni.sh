#!/bin/bash
# pgBouncer + Patroni 集成生产化编排脚本
#
# 功能: 编排 pgBouncer + Patroni 集成部署, 实现连接池 + 读写分离 + 高可用
# 流程: 预检 → 部署 Patroni → 部署 pgBouncer → 验证读写分离 → 应用切换 → 报告
#
# 用法: ./scripts/orchestrate_pgbouncer_patroni.sh [--dry-run]
set -euo pipefail

DRY_RUN=0
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_DIR="${SERVER_DIR}/logs"
TS=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${LOG_DIR}/pgbouncer_patroni_orchestrate_${TS}.log"
REPORT_FILE="${LOG_DIR}/pgbouncer_patroni_report_${TS}.json"

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
  local patroni_status=$3
  local pgbouncer_status=$4
  local rw_split=$5
  local app_switched=$6
  cat > "${REPORT_FILE}" <<EOF
{
  "timestamp": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "operation": "pgbouncer_patroni_orchestration",
  "status": "${status}",
  "duration_seconds": ${duration},
  "patroni_status": "${patroni_status}",
  "pgbouncer_status": "${pgbouncer_status}",
  "read_write_split": "${rw_split}",
  "app_switched": ${app_switched},
  "architecture": {
    "write_path": "app → pgBouncer:6432 → HAProxy:5000 → Patroni Leader",
    "read_path": "app → pgBouncer:6433 → HAProxy:5001 → Patroni All Nodes"
  },
  "log_file": "${LOG_FILE}"
}
EOF
  log "报告已生成: ${REPORT_FILE}"
}

START_TIME=$(date +%s)
PATRONI_STATUS="skipped"
PGBOUNCER_STATUS="skipped"
RW_SPLIT="skipped"
APP_SWITCHED=0

log "pgBouncer + Patroni 集成生产化编排"
log "模式: $([ ${DRY_RUN} -eq 1 ] && echo 'dry-run' || echo 'production')"
log "日志: ${LOG_FILE}"

# ---------- 步骤 1: 预检 ----------
step "1/7" "预检"

log "检查 docker..."
if ! command -v docker >/dev/null 2>&1; then
  log "❌ docker 未安装"
  generate_report "failed" 0 "${PATRONI_STATUS}" "${PGBOUNCER_STATUS}" "${RW_SPLIT}" ${APP_SWITCHED}
  exit 1
fi
log "✅ docker 已安装"

log "检查 Patroni HA compose..."
PATRONI_COMPOSE="${SERVER_DIR}/deploy/docker/docker-compose.patroni-ha.yml"
if [ ! -f "${PATRONI_COMPOSE}" ]; then
  log "❌ 缺少 ${PATRONI_COMPOSE}"
  generate_report "failed" 0 "${PATRONI_STATUS}" "${PGBOUNCER_STATUS}" "${RW_SPLIT}" ${APP_SWITCHED}
  exit 1
fi
log "✅ deploy/docker/docker-compose.patroni-ha.yml 存在"

log "检查 pgBouncer + Patroni compose..."
PGBOUNCER_COMPOSE="${SERVER_DIR}/deploy/docker/docker-compose.pgbouncer-patroni.yml"
if [ ! -f "${PGBOUNCER_COMPOSE}" ]; then
  log "❌ 缺少 ${PGBOUNCER_COMPOSE}"
  generate_report "failed" 0 "${PATRONI_STATUS}" "${PGBOUNCER_STATUS}" "${RW_SPLIT}" ${APP_SWITCHED}
  exit 1
fi
log "✅ deploy/docker/docker-compose.pgbouncer-patroni.yml 存在"

log "检查 pgBouncer Patroni 配置..."
PGBOUNCER_INI="${SERVER_DIR}/docker/pgbouncer/pgbouncer_patroni.ini"
if [ ! -f "${PGBOUNCER_INI}" ]; then
  log "❌ 缺少 ${PGBOUNCER_INI}"
  generate_report "failed" 0 "${PATRONI_STATUS}" "${PGBOUNCER_STATUS}" "${RW_SPLIT}" ${APP_SWITCHED}
  exit 1
fi
log "✅ pgbouncer_patroni.ini 存在"

if [ ${DRY_RUN} -eq 1 ]; then
  log ""
  log "✅ dry-run 预检完成"
  END_TIME=$(date +%s)
  generate_report "dry_run_passed" $((END_TIME - START_TIME)) "${PATRONI_STATUS}" "${PGBOUNCER_STATUS}" "${RW_SPLIT}" ${APP_SWITCHED}
  exit 0
fi

# ---------- 步骤 2: 部署 Patroni ----------
step "2/7" "部署 Patroni 集群"

log "调用 orchestrate_patroni_deploy.sh..."
if bash "${SCRIPT_DIR}/orchestrate_patroni_deploy.sh" >>"${LOG_FILE}" 2>&1; then
  log "✅ Patroni 集群部署完成"
  PATRONI_STATUS="deployed"
else
  log "❌ Patroni 集群部署失败"
  generate_report "failed" 0 "${PATRONI_STATUS}" "${PGBOUNCER_STATUS}" "${RW_SPLIT}" ${APP_SWITCHED}
  exit 1
fi

# ---------- 步骤 3: 部署 pgBouncer ----------
step "3/7" "部署 pgBouncer + Patroni 集成"

log "启动 pgBouncer + HAProxy..."
if docker compose -f "${PGBOUNCER_COMPOSE}" up -d >>"${LOG_FILE}" 2>&1; then
  log "✅ pgBouncer + HAProxy 已启动"
  PGBOUNCER_STATUS="deployed"
else
  log "❌ pgBouncer 启动失败"
  generate_report "failed" 0 "${PATRONI_STATUS}" "${PGBOUNCER_STATUS}" "${RW_SPLIT}" ${APP_SWITCHED}
  exit 1
fi

log "等待 pgBouncer 就绪..."
sleep 10

# ---------- 步骤 4: 验证读写分离 ----------
step "4/7" "验证读写分离"

log "测试写端口 (6432)..."
if pg_isready -h 127.0.0.1 -p 6432 -U zhs >/dev/null 2>&1; then
  log "✅ 写端口 6432 可达"
else
  log "⚠️  写端口 6432 不可达"
fi

log "测试读端口 (6433)..."
if pg_isready -h 127.0.0.1 -p 6433 -U zhs >/dev/null 2>&1; then
  log "✅ 读端口 6433 可达"
else
  log "⚠️  读端口 6433 不可达"
fi

log "验证写路由 (应到主节点)..."
WRITE_RESULT=$(psql -h 127.0.0.1 -p 6432 -U zhs -d postgres -tAc "SELECT pg_is_in_recovery();" 2>/dev/null || echo "error")
if [ "${WRITE_RESULT}" = "f" ]; then
  log "✅ 写端口路由到主节点"
  RW_SPLIT="passed"
else
  log "⚠️  写端口路由异常: ${WRITE_RESULT}"
  RW_SPLIT="failed"
fi

log "验证读路由 (可能到从节点)..."
READ_RESULT=$(psql -h 127.0.0.1 -p 6433 -U zhs -d postgres -tAc "SELECT pg_is_in_recovery();" 2>/dev/null || echo "error")
log "  读端口 recovery 状态: ${READ_RESULT}"

# ---------- 步骤 5: 应用切换 ----------
step "5/7" "应用切换到 pgBouncer"

log "切换应用连接串到 pgBouncer..."
if python3 "${SCRIPT_DIR}/switch_pgbouncer_connection.py" switch >>"${LOG_FILE}" 2>&1; then
  log "✅ 应用连接串已切换"
  APP_SWITCHED=1
else
  log "⚠️  应用连接串切换失败"
fi

# ---------- 步骤 6: 重启应用 ----------
step "6/7" "重启应用"

log "重启 api 服务..."
if docker compose -f "${SERVER_DIR}/deploy/docker/docker-compose.yml" restart api >>"${LOG_FILE}" 2>&1; then
  log "✅ api 服务已重启"
else
  log "⚠️  api 服务重启失败 (可能未运行)"
fi

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

# ---------- 步骤 7: 生成报告 ----------
step "7/7" "生成报告"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

generate_report "success" ${DURATION} "${PATRONI_STATUS}" "${PGBOUNCER_STATUS}" "${RW_SPLIT}" ${APP_SWITCHED}

log ""
log "============================================================"
log "✅ pgBouncer + Patroni 集成生产化完成"
log "============================================================"
log "Patroni: ${PATRONI_STATUS}"
log "pgBouncer: ${PGBOUNCER_STATUS}"
log "读写分离: ${RW_SPLIT}"
log "应用切换: $([ ${APP_SWITCHED} -eq 1 ] && echo '是' || echo '否')"
log "写路径: app → pgBouncer:6432 → HAProxy:5000 → Patroni Leader"
log "读路径: app → pgBouncer:6433 → HAProxy:5001 → Patroni All Nodes"
log "耗时: ${DURATION} 秒"
log "报告: ${REPORT_FILE}"
log "日志: ${LOG_FILE}"
exit 0
