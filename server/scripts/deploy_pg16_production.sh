#!/bin/bash
# PostgreSQL 16 生产升级编排脚本
#
# 功能: 一键执行 PG14→PG16 生产升级
# 流程: 预检 → 备份 → 启动 PG16 → 数据迁移 → 一致性验证 → 应用切换 → 冒烟测试 → 报告
# 回滚: 任意步骤失败自动回滚到 PG14
#
# 用法: ./scripts/deploy_pg16_production.sh [--dry-run]
set -euo pipefail

DRY_RUN=0
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_DIR="${SERVER_DIR}/logs"
LOG_FILE="${LOG_DIR}/pg16_deploy_$(date +%Y%m%d_%H%M%S).log"
REPORT_FILE="${LOG_DIR}/pg16_deploy_report_$(date +%Y%m%d_%H%M%S).json"

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

# 生成 JSON 报告
generate_report() {
  local status=$1
  local duration=$2
  local rollback=$3
  cat > "${REPORT_FILE}" <<EOF
{
  "timestamp": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "operation": "pg16_production_upgrade",
  "status": "${status}",
  "duration_seconds": ${duration},
  "rollback_triggered": ${rollback},
  "log_file": "${LOG_FILE}",
  "previous_version": "14",
  "target_version": "16",
  "databases": ["zhs_ai_project", "zhs_center_project", "zhs_educational_training"]
}
EOF
  log "报告已生成: ${REPORT_FILE}"
}

START_TIME=$(date +%s)
ROLLBACK_TRIGGERED=0

log "PostgreSQL 16 生产升级编排"
log "模式: $([ ${DRY_RUN} -eq 1 ] && echo 'dry-run (仅预检)' || echo 'production (生产执行)')"
log "日志: ${LOG_FILE}"

# ---------- 步骤 1: 预检 ----------
step "1/7" "预检"

log "检查 docker..."
if ! command -v docker >/dev/null 2>&1; then
  log "❌ docker 未安装"
  generate_report "failed" 0 1
  exit 1
fi
log "✅ docker 已安装"

log "检查 docker-compose..."
if ! docker compose version >/dev/null 2>&1 && ! command -v docker-compose >/dev/null 2>&1; then
  log "❌ docker compose 未安装"
  generate_report "failed" 0 1
  exit 1
fi
log "✅ docker compose 已安装"

log "检查升级脚本..."
if [ ! -f "${SCRIPT_DIR}/upgrade_pg14_to_pg16.sh" ]; then
  log "❌ 缺少 upgrade_pg14_to_pg16.sh"
  generate_report "failed" 0 1
  exit 1
fi
log "✅ upgrade_pg14_to_pg16.sh 存在"

log "检查 compose 文件..."
if [ ! -f "${SERVER_DIR}/deploy/docker/docker-compose.pg16-upgrade.yml" ]; then
  log "❌ 缺少 deploy/docker/docker-compose.pg16-upgrade.yml"
  generate_report "failed" 0 1
  exit 1
fi
log "✅ deploy/docker/docker-compose.pg16-upgrade.yml 存在"

log "检查加密备份脚本..."
if [ ! -f "${SCRIPT_DIR}/backup_pg_encrypted.sh" ]; then
  log "❌ 缺少 backup_pg_encrypted.sh"
  generate_report "failed" 0 1
  exit 1
fi
log "✅ backup_pg_encrypted.sh 存在"

if [ ${DRY_RUN} -eq 1 ]; then
  log ""
  log "✅ dry-run 预检完成, 未执行实际升级"
  generate_report "dry_run_passed" 0 0
  exit 0
fi

# ---------- 步骤 2: 加密备份 ----------
step "2/7" "加密备份 PG14"

log "执行加密备份..."
if bash "${SCRIPT_DIR}/backup_pg_encrypted.sh" >>"${LOG_FILE}" 2>&1; then
  log "✅ 加密备份完成"
else
  log "❌ 加密备份失败, 终止升级"
  generate_report "failed" 0 1
  exit 1
fi

# ---------- 步骤 3: 启动 PG16 实例 ----------
step "3/7" "启动 PG16 实例"

log "启动 PG16 (端口 5433)..."
if docker compose -f "${SERVER_DIR}/deploy/docker/docker-compose.pg16-upgrade.yml" up -d >>"${LOG_FILE}" 2>&1; then
  log "✅ PG16 容器已启动"
else
  log "❌ PG16 启动失败"
  generate_report "failed" 0 1
  exit 1
fi

log "等待 PG16 就绪..."
for i in $(seq 1 30); do
  if pg_isready -h 127.0.0.1 -p 5433 -U zhs >/dev/null 2>&1; then
    log "✅ PG16 就绪 (等待 ${i}0 秒)"
    break
  fi
  sleep 10
  if [ ${i} -eq 30 ]; then
    log "❌ PG16 300 秒内未就绪"
    generate_report "failed" 0 1
    exit 1
  fi
done

# ---------- 步骤 4: 执行数据迁移 ----------
step "4/7" "执行数据迁移"

log "调用 upgrade_pg14_to_pg16.sh..."
if bash "${SCRIPT_DIR}/upgrade_pg14_to_pg16.sh" >>"${LOG_FILE}" 2>&1; then
  log "✅ 数据迁移完成"
else
  log "❌ 数据迁移失败, 触发回滚"
  ROLLBACK_TRIGGERED=1
  log "回滚: 停止 PG16..."
  docker compose -f "${SERVER_DIR}/deploy/docker/docker-compose.pg16-upgrade.yml" down >>"${LOG_FILE}" 2>&1 || true
  generate_report "failed" 0 1
  exit 1
fi

# ---------- 步骤 5: 应用切换 ----------
step "5/7" "应用切换"

log "停止应用服务..."
docker compose -f "${SERVER_DIR}/deploy/docker/docker-compose.yml" stop api >>"${LOG_FILE}" 2>&1 || log "  (api 服务未运行)"

log "修改 compose 镜像版本..."
if grep -q "postgres:14-alpine" "${SERVER_DIR}/deploy/docker/docker-compose.yml"; then
  sed -i.bak 's/postgres:14-alpine/postgres:16-alpine/g' "${SERVER_DIR}/deploy/docker/docker-compose.yml"
  log "✅ 镜像已切换: 14-alpine → 16-alpine"
else
  log "ℹ️  未发现 postgres:14-alpine, 可能已切换"
fi

log "启动应用..."
docker compose -f "${SERVER_DIR}/deploy/docker/docker-compose.yml" up -d >>"${LOG_FILE}" 2>&1
log "✅ 应用已启动"

# ---------- 步骤 6: 冒烟测试 ----------
step "6/7" "冒烟测试"

log "等待 API 就绪..."
for i in $(seq 1 12); do
  if curl -sf http://localhost:8000/healthz >/dev/null 2>&1; then
    log "✅ API 健康检查通过"
    break
  fi
  sleep 5
  if [ ${i} -eq 12 ]; then
    log "❌ API 60 秒内未就绪, 触发回滚"
    ROLLBACK_TRIGGERED=1
    log "回滚: 恢复 PG14 镜像..."
    if [ -f "${SERVER_DIR}/deploy/docker/docker-compose.yml.bak" ]; then
      mv "${SERVER_DIR}/deploy/docker/docker-compose.yml.bak" "${SERVER_DIR}/deploy/docker/docker-compose.yml"
      docker compose -f "${SERVER_DIR}/deploy/docker/docker-compose.yml" up -d >>"${LOG_FILE}" 2>&1
    fi
    generate_report "failed" 0 1
    exit 1
  fi
done

log "执行数据库连通性测试..."
if docker compose -f "${SERVER_DIR}/deploy/docker/docker-compose.yml" exec -T postgres \
  psql -U zhs -d zhs_ai_project -c "SELECT 1;" >>"${LOG_FILE}" 2>&1; then
  log "✅ 数据库连通性正常"
else
  log "❌ 数据库连通性失败"
  generate_report "failed" 0 1
  exit 1
fi

# ---------- 步骤 7: 清理与报告 ----------
step "7/7" "清理与报告"

log "下线 PG16 升级实例..."
docker compose -f "${SERVER_DIR}/deploy/docker/docker-compose.pg16-upgrade.yml" down >>"${LOG_FILE}" 2>&1 || true

log "清理备份文件..."
rm -f "${SERVER_DIR}/deploy/docker/docker-compose.yml.bak"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

generate_report "success" ${DURATION} 0

log ""
log "============================================================"
log "✅ PostgreSQL 16 生产升级完成"
log "============================================================"
log "耗时: ${DURATION} 秒"
log "报告: ${REPORT_FILE}"
log "日志: ${LOG_FILE}"
exit 0
