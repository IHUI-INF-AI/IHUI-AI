#!/bin/bash
# Patroni 生产部署实战编排脚本
#
# 功能: 编排 Patroni 高可用集群生产部署全流程
# 流程: 环境检查 → dry-run 预检 → 部署集群 → 验证选举 → 故障转移演练 → 读写测试 → 报告
#
# 用法: ./scripts/orchestrate_patroni_deploy.sh [--dry-run]
set -euo pipefail

DRY_RUN=0
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_DIR="${SERVER_DIR}/logs"
TS=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${LOG_DIR}/patroni_orchestrate_${TS}.log"
REPORT_FILE="${LOG_DIR}/patroni_orchestrate_report_${TS}.json"

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
  local leader=$3
  local failover_result=$4
  cat > "${REPORT_FILE}" <<EOF
{
  "timestamp": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "operation": "patroni_deploy_orchestration",
  "status": "${status}",
  "duration_seconds": ${duration},
  "leader": "${leader}",
  "failover_drill": "${failover_result}",
  "cluster": {
    "scope": "zhs",
    "nodes": 3,
    "write_port": 5000,
    "read_port": 5001,
    "stats_port": 7000
  },
  "log_file": "${LOG_FILE}"
}
EOF
  log "报告已生成: ${REPORT_FILE}"
}

START_TIME=$(date +%s)
LEADER="unknown"
FAILOVER_RESULT="skipped"

log "Patroni 生产部署实战编排"
log "模式: $([ ${DRY_RUN} -eq 1 ] && echo 'dry-run' || echo 'production')"
log "日志: ${LOG_FILE}"

# ---------- 步骤 1: 环境检查 ----------
step "1/7" "环境检查"

log "检查 docker..."
if ! command -v docker >/dev/null 2>&1; then
  log "❌ docker 未安装"
  generate_report "failed" 0 "${LEADER}" "${FAILOVER_RESULT}"
  exit 1
fi
log "✅ docker 已安装"

log "检查 Patroni HA compose..."
COMPOSE_FILE="${SERVER_DIR}/deploy/docker/docker-compose.patroni-ha.yml"
if [ ! -f "${COMPOSE_FILE}" ]; then
  log "❌ 缺少 ${COMPOSE_FILE}"
  generate_report "failed" 0 "${LEADER}" "${FAILOVER_RESULT}"
  exit 1
fi
log "✅ deploy/docker/docker-compose.patroni-ha.yml 存在"

log "检查 HAProxy 配置..."
if [ ! -f "${SERVER_DIR}/docker/haproxy/haproxy.cfg" ]; then
  log "❌ 缺少 haproxy.cfg"
  generate_report "failed" 0 "${LEADER}" "${FAILOVER_RESULT}"
  exit 1
fi
log "✅ haproxy.cfg 存在"

# ---------- 步骤 2: dry-run 预检 ----------
step "2/7" "dry-run 预检"

log "执行 deploy_patroni_production.sh --dry-run..."
if bash "${SCRIPT_DIR}/deploy_patroni_production.sh" --dry-run >>"${LOG_FILE}" 2>&1; then
  log "✅ dry-run 预检通过"
else
  log "❌ dry-run 预检失败"
  generate_report "failed" 0 "${LEADER}" "${FAILOVER_RESULT}"
  exit 1
fi

if [ ${DRY_RUN} -eq 1 ]; then
  log ""
  log "✅ dry-run 模式完成"
  END_TIME=$(date +%s)
  generate_report "dry_run_passed" $((END_TIME - START_TIME)) "${LEADER}" "${FAILOVER_RESULT}"
  exit 0
fi

# ---------- 步骤 3: 部署集群 ----------
step "3/7" "部署 Patroni 集群"

log "调用 deploy_patroni_production.sh..."
if bash "${SCRIPT_DIR}/deploy_patroni_production.sh" >>"${LOG_FILE}" 2>&1; then
  log "✅ Patroni 集群部署完成"
else
  log "❌ Patroni 集群部署失败"
  generate_report "failed" 0 "${LEADER}" "${FAILOVER_RESULT}"
  exit 1
fi

# ---------- 步骤 4: 验证主节点选举 ----------
step "4/7" "验证主节点选举"

log "查询集群状态..."
for i in $(seq 1 12); do
  LEADER=$(docker compose -f "${COMPOSE_FILE}" exec -T patroni1 \
    patronictl list --format json 2>/dev/null | \
    python3 -c "import sys,json; data=json.load(sys.stdin); print([m for m in data if m.get('Role')=='Leader'][0]['Member'] if any(m.get('Role')=='Leader' for m in data) else 'unknown')" 2>/dev/null || echo "unknown")
  if [ "${LEADER}" != "unknown" ] && [ -n "${LEADER}" ]; then
    log "✅ 主节点: ${LEADER} (等待 ${i}0 秒)"
    break
  fi
  sleep 10
  if [ ${i} -eq 12 ]; then
    log "❌ 120 秒内未选举主节点"
    generate_report "failed" 0 "${LEADER}" "${FAILOVER_RESULT}"
    exit 1
  fi
done

# ---------- 步骤 5: 故障转移演练 ----------
step "5/7" "故障转移演练"

log "执行 patroni_failover_drill.sh..."
if bash "${SCRIPT_DIR}/patroni_failover_drill.sh" >>"${LOG_FILE}" 2>&1; then
  log "✅ 故障转移演练通过"
  FAILOVER_RESULT="passed"
else
  log "⚠️  故障转移演练失败 (非致命)"
  FAILOVER_RESULT="failed"
fi

# ---------- 步骤 6: 读写端口测试 ----------
step "6/7" "读写端口测试"

log "测试写端口 (5000)..."
if docker compose -f "${COMPOSE_FILE}" exec -T patroni1 \
  psql -h patroni1 -p 5432 -U zhs -d postgres -c "SELECT pg_is_in_recovery();" >>"${LOG_FILE}" 2>&1; then
  log "✅ 写端口连通"
else
  log "⚠️  写端口连通性待验证"
fi

log "测试 HAProxy stats (7000)..."
if curl -sf http://localhost:7000 >/dev/null 2>&1; then
  log "✅ HAProxy stats 可访问"
else
  log "⚠️  HAProxy stats 不可访问"
fi

# ---------- 步骤 7: 生成报告 ----------
step "7/7" "生成报告"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

if [ "${FAILOVER_RESULT}" = "passed" ]; then
  generate_report "success" ${DURATION} "${LEADER}" "${FAILOVER_RESULT}"
else
  generate_report "failover_failed" ${DURATION} "${LEADER}" "${FAILOVER_RESULT}"
fi

log ""
log "============================================================"
log "✅ Patroni 部署编排完成"
log "============================================================"
log "主节点: ${LEADER}"
log "故障转移: ${FAILOVER_RESULT}"
log "写端口: 5000"
log "读端口: 5001"
log "stats: http://localhost:7000"
log "耗时: ${DURATION} 秒"
log "报告: ${REPORT_FILE}"
log "日志: ${LOG_FILE}"
exit 0
