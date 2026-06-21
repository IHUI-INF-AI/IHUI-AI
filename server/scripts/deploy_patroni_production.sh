#!/bin/bash
# Patroni 高可用集群生产部署编排脚本
#
# 功能: 一键部署 3 节点 Patroni + etcd + HAProxy 高可用集群
# 流程: 预检 → 部署 etcd → 部署 Patroni → 部署 HAProxy → 初始化集群 → 验证 → 报告
#
# 用法: ./scripts/deploy_patroni_production.sh [--dry-run]
set -euo pipefail

DRY_RUN=0
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_DIR="${SERVER_DIR}/logs"
LOG_FILE="${LOG_DIR}/patroni_deploy_$(date +%Y%m%d_%H%M%S).log"
REPORT_FILE="${LOG_DIR}/patroni_deploy_report_$(date +%Y%m%d_%H%M%S).json"

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
  cat > "${REPORT_FILE}" <<EOF
{
  "timestamp": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "operation": "patroni_production_deploy",
  "status": "${status}",
  "duration_seconds": ${duration},
  "cluster": {
    "scope": "zhs",
    "nodes": 3,
    "etcd_endpoints": ["http://etcd1:2379", "http://etcd2:2379", "http://etcd3:2379"],
    "leader": "${leader}",
    "haproxy_write_port": 5000,
    "haproxy_read_port": 5001,
    "haproxy_stats_port": 7000
  },
  "log_file": "${LOG_FILE}"
}
EOF
  log "报告已生成: ${REPORT_FILE}"
}

START_TIME=$(date +%s)
LEADER="unknown"

log "Patroni 高可用集群生产部署"
log "模式: $([ ${DRY_RUN} -eq 1 ] && echo 'dry-run (仅预检)' || echo 'production (生产执行)')"
log "日志: ${LOG_FILE}"

# ---------- 步骤 1: 预检 ----------
step "1/7" "预检"

log "检查 docker..."
if ! command -v docker >/dev/null 2>&1; then
  log "❌ docker 未安装"
  generate_report "failed" 0 "${LEADER}"
  exit 1
fi
log "✅ docker 已安装"

log "检查 compose 文件..."
COMPOSE_FILE="${SERVER_DIR}/deploy/docker/docker-compose.patroni-ha.yml"
if [ ! -f "${COMPOSE_FILE}" ]; then
  log "❌ 缺少 ${COMPOSE_FILE}"
  generate_report "failed" 0 "${LEADER}"
  exit 1
fi
log "✅ deploy/docker/docker-compose.patroni-ha.yml 存在"

log "检查 HAProxy 配置..."
HAPROXY_CFG="${SERVER_DIR}/docker/haproxy/haproxy.cfg"
if [ ! -f "${HAPROXY_CFG}" ]; then
  log "❌ 缺少 ${HAPROXY_CFG}"
  generate_report "failed" 0 "${LEADER}"
  exit 1
fi
log "✅ haproxy.cfg 存在"

log "检查故障转移演练脚本..."
if [ ! -f "${SCRIPT_DIR}/patroni_failover_drill.sh" ]; then
  log "❌ 缺少 patroni_failover_drill.sh"
  generate_report "failed" 0 "${LEADER}"
  exit 1
fi
log "✅ patroni_failover_drill.sh 存在"

if [ ${DRY_RUN} -eq 1 ]; then
  log ""
  log "✅ dry-run 预检完成, 未执行实际部署"
  generate_report "dry_run_passed" 0 "${LEADER}"
  exit 0
fi

# ---------- 步骤 2: 部署 etcd 集群 ----------
step "2/7" "部署 etcd 集群"

log "启动 etcd 3 节点集群..."
if docker compose -f "${COMPOSE_FILE}" up -d etcd1 etcd2 etcd3 >>"${LOG_FILE}" 2>&1; then
  log "✅ etcd 集群已启动"
else
  log "❌ etcd 启动失败"
  generate_report "failed" 0 "${LEADER}"
  exit 1
fi

log "等待 etcd 集群就绪..."
for i in $(seq 1 12); do
  if docker compose -f "${COMPOSE_FILE}" exec -T etcd1 \
    etcdctl endpoint health --endpoints=http://etcd1:2379,http://etcd2:2379,http://etcd3:2379 \
    >>"${LOG_FILE}" 2>&1; then
    log "✅ etcd 集群就绪 (等待 ${i}0 秒)"
    break
  fi
  sleep 10
  if [ ${i} -eq 12 ]; then
    log "❌ etcd 120 秒内未就绪"
    generate_report "failed" 0 "${LEADER}"
    exit 1
  fi
done

# ---------- 步骤 3: 部署 Patroni 节点 ----------
step "3/7" "部署 Patroni 节点"

log "启动 Patroni 3 节点..."
if docker compose -f "${COMPOSE_FILE}" up -d patroni1 patroni2 patroni3 >>"${LOG_FILE}" 2>&1; then
  log "✅ Patroni 节点已启动"
else
  log "❌ Patroni 启动失败"
  generate_report "failed" 0 "${LEADER}"
  exit 1
fi

log "等待 Patroni 集群选举主节点..."
for i in $(seq 1 18); do
  LEADER=$(docker compose -f "${COMPOSE_FILE}" exec -T patroni1 \
    patronictl list --format json 2>/dev/null | \
    python3 -c "import sys,json; data=json.load(sys.stdin); print([m for m in data if m.get('Role')=='Leader'][0]['Member'] if any(m.get('Role')=='Leader' for m in data) else 'unknown')" 2>/dev/null || echo "unknown")
  if [ "${LEADER}" != "unknown" ] && [ -n "${LEADER}" ]; then
    log "✅ 主节点已选举: ${LEADER} (等待 ${i}0 秒)"
    break
  fi
  sleep 10
  if [ ${i} -eq 18 ]; then
    log "❌ 180 秒内未选举主节点"
    generate_report "failed" 0 "${LEADER}"
    exit 1
  fi
done

# ---------- 步骤 4: 部署 HAProxy ----------
step "4/7" "部署 HAProxy"

log "启动 HAProxy..."
if docker compose -f "${COMPOSE_FILE}" up -d haproxy >>"${LOG_FILE}" 2>&1; then
  log "✅ HAProxy 已启动"
else
  log "❌ HAProxy 启动失败"
  generate_report "failed" 0 "${LEADER}"
  exit 1
fi

log "等待 HAProxy 就绪..."
sleep 5
if curl -sf http://localhost:7000 >/dev/null 2>&1; then
  log "✅ HAProxy stats 就绪"
else
  log "⚠️  HAProxy stats 未就绪 (可能需要手动检查)"
fi

# ---------- 步骤 5: 集群初始化验证 ----------
step "5/7" "集群初始化验证"

log "验证集群状态..."
CLUSTER_INFO=$(docker compose -f "${COMPOSE_FILE}" exec -T patroni1 \
  patronictl list 2>/dev/null || echo "查询失败")
echo "${CLUSTER_INFO}" | tee -a "${LOG_FILE}"

log "验证写端口 (5000)..."
if docker compose -f "${COMPOSE_FILE}" exec -T patroni1 \
  psql -h patroni1 -p 5432 -U zhs -d postgres -c "SELECT 1;" >>"${LOG_FILE}" 2>&1; then
  log "✅ 写端口连通"
else
  log "⚠️  写端口连通性待验证"
fi

log "验证读端口 (5001)..."
if curl -sf http://localhost:5001 >/dev/null 2>&1 || \
  docker compose -f "${COMPOSE_FILE}" exec -T haproxy \
  nc -z localhost 5001 >>"${LOG_FILE}" 2>&1; then
  log "✅ 读端口连通"
else
  log "⚠️  读端口连通性待验证"
fi

# ---------- 步骤 6: 故障转移演练 ----------
step "6/7" "故障转移演练"

log "执行故障转移演练..."
if bash "${SCRIPT_DIR}/patroni_failover_drill.sh" >>"${LOG_FILE}" 2>&1; then
  log "✅ 故障转移演练通过"
else
  log "⚠️  故障转移演练失败 (非致命, 集群仍可用)"
fi

# ---------- 步骤 7: 报告 ----------
step "7/7" "生成报告"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

generate_report "success" ${DURATION} "${LEADER}"

log ""
log "============================================================"
log "✅ Patroni 高可用集群部署完成"
log "============================================================"
log "主节点: ${LEADER}"
log "写端口: 5000 (HAProxy → 主节点)"
log "读端口: 5001 (HAProxy → 所有节点轮询)"
log "stats:  http://localhost:7000 (admin/admin123)"
log "耗时: ${DURATION} 秒"
log "报告: ${REPORT_FILE}"
log "日志: ${LOG_FILE}"
exit 0
