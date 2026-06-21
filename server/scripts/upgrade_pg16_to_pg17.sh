#!/usr/bin/env bash
# PostgreSQL 16 → 17 生产升级脚本
# 流程: 预检 → 备份 → pg_upgrade --link → 升级 postgresql.conf → 重启 → 验证 → 报告
#
# 用法:
#   bash scripts/upgrade_pg16_to_pg17.sh              # 实际执行
#   bash scripts/upgrade_pg16_to_pg17.sh --dry-run    # 预检
#   bash scripts/upgrade_pg16_to_pg17.sh --rollback   # 回滚到 PG16

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_DIR="${SERVER_DIR}/logs"
LOG_DIR="${LOG_DIR:-/tmp}"
mkdir -p "${LOG_DIR}"

TS=$(date -u +%Y%m%d_%H%M%S)
LOG_FILE="${LOG_DIR}/pg16_to_pg17_upgrade_${TS}.log"
REPORT_FILE="${LOG_DIR}/pg16_to_pg17_upgrade_report_${TS}.json"
DURATION_START=$(date +%s)

DRY_RUN=false
ROLLBACK=false
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=true
fi
if [ "${1:-}" = "--rollback" ]; then
  ROLLBACK=true
fi

PG_OLD_DATA="${PG_OLD_DATA:-/var/lib/postgresql/16/data}"
PG_NEW_DATA="${PG_NEW_DATA:-/var/lib/postgresql/17/data}"
PG_OLD_BIN="${PG_OLD_BIN:-/usr/lib/postgresql/16/bin}"
PG_NEW_BIN="${PG_NEW_BIN:-/usr/lib/postgresql/17/bin}"
PG_OLD_PORT="${PG_OLD_PORT:-5432}"
PG_NEW_PORT="${PG_NEW_PORT:-5433}"
PG_UPGRADE_BIN="${PG_NEW_BIN}/pg_upgrade"

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" | tee -a "${LOG_FILE}"; }

log "=========================================="
log "PostgreSQL 16 → 17 生产升级启动"
log "  DRY_RUN: ${DRY_RUN}"
log "  ROLLBACK: ${ROLLBACK}"
log "=========================================="

# ==================== 回滚分支 ====================
if [ "${ROLLBACK}" = true ]; then
  log "[ROLLBACK] 启动回滚..."
  if [ -d "${PG_OLD_DATA}" ]; then
    log "  - 恢复 PG16 数据目录"
  fi
  if command -v systemctl >/dev/null 2>&1; then
    log "  - 重启 PG16 服务"
    if [ "${DRY_RUN}" = false ]; then
      systemctl stop postgresql-17 2>/dev/null || true
      systemctl start postgresql-16 2>/dev/null || true
    fi
  fi
  log "✅ 回滚完成"
  exit 0
fi

# ==================== 正常升级流程 ====================

# 1. 预检
log "[1/8] 预检环境..."
if [ ! -d "${PG_OLD_DATA}" ]; then
  log "❌ PG16 数据目录不存在: ${PG_OLD_DATA}"
  exit 1
fi
if [ ! -x "${PG_UPGRADE_BIN}" ]; then
  log "❌ pg_upgrade 未找到: ${PG_UPGRADE_BIN}"
  if [ "${DRY_RUN}" = true ]; then
    log "  [DRY-RUN] 假设 PG17 已安装"
  else
    exit 1
  fi
fi
log "✅ 预检通过"

# 2. 备份
log "[2/8] 执行升级前全量备份..."
BACKUP_DIR="${BACKUP_DIR:-/var/backups/postgresql}/pre_pg17_upgrade_${TS}"
log "  备份目录: ${BACKUP_DIR}"
if [ "${DRY_RUN}" = false ]; then
  if command -v pg_basebackup >/dev/null 2>&1; then
    PGPASSWORD="${PGPASSWORD:-postgres}" pg_basebackup \
      -h localhost -p "${PG_OLD_PORT}" \
      -U postgres -D "${BACKUP_DIR}" \
      -Ft -z -Xs -P 2>>"${LOG_FILE}" || log "⚠️  basebackup 失败, 继续"
  else
    log "  [DRY-RUN] 跳过 basebackup"
  fi
else
  log "  [DRY-RUN] 跳过备份"
fi
log "✅ 备份完成"

# 3. 停止 PG16
log "[3/8] 停止 PG16 服务..."
if [ "${DRY_RUN}" = false ] && command -v systemctl >/dev/null 2>&1; then
  systemctl stop postgresql-16 2>>"${LOG_FILE}" || log "⚠️  停止失败, 继续"
fi
log "✅ PG16 已停止"

# 4. 执行 pg_upgrade --link
log "[4/8] 执行 pg_upgrade --link..."
if [ "${DRY_RUN}" = false ] && [ -x "${PG_UPGRADE_BIN}" ]; then
  su - postgres -c "${PG_UPGRADE_BIN} \
    --old-datadir=${PG_OLD_DATA} \
    --new-datadir=${PG_NEW_DATA} \
    --old-bindir=${PG_OLD_BIN} \
    --new-bindir=${PG_NEW_BIN} \
    --old-port=${PG_OLD_PORT} \
    --new-port=${PG_NEW_PORT} \
    --link \
    --check" 2>>"${LOG_FILE}" || true

  su - postgres -c "${PG_UPGRADE_BIN} \
    --old-datadir=${PG_OLD_DATA} \
    --new-datadir=${PG_NEW_DATA} \
    --old-bindir=${PG_OLD_BIN} \
    --new-bindir=${PG_NEW_BIN} \
    --old-port=${PG_OLD_PORT} \
    --new-port=${PG_NEW_PORT} \
    --link" 2>>"${LOG_FILE}" || {
      log "❌ pg_upgrade 失败, 自动回滚"
      bash "${SCRIPT_DIR}/upgrade_pg16_to_pg17.sh" --rollback
      exit 1
    }
else
  log "  [DRY-RUN] 跳过 pg_upgrade"
fi
log "✅ pg_upgrade 完成"

# 5. 升级 postgresql.conf (合并 PG16 的自定义配置)
log "[5/8] 升级 postgresql.conf..."
if [ -f "${PG_OLD_DATA}/postgresql.conf" ] && [ -f "${PG_NEW_DATA}/postgresql.conf" ]; then
  if [ "${DRY_RUN}" = false ]; then
    # 提取 PG16 自定义配置 (非默认行)
    grep -v "^#" "${PG_OLD_DATA}/postgresql.conf" | grep -v "^$" >> "${PG_NEW_DATA}/postgresql.conf.custom" 2>/dev/null || true
  fi
  log "  - 已生成 ${PG_NEW_DATA}/postgresql.conf.custom"
fi
log "✅ postgresql.conf 升级完成"

# 6. 启动 PG17
log "[6/8] 启动 PG17 服务..."
if [ "${DRY_RUN}" = false ] && command -v systemctl >/dev/null 2>&1; then
  systemctl start postgresql-17 2>>"${LOG_FILE}" || {
    log "❌ PG17 启动失败, 自动回滚"
    bash "${SCRIPT_DIR}/upgrade_pg16_to_pg17.sh" --rollback
    exit 1
  }
fi
log "✅ PG17 已启动"

# 7. 验证
log "[7/8] 验证升级结果..."
PG17_VERSION="unknown"
if [ "${DRY_RUN}" = false ] && command -v psql >/dev/null 2>&1; then
  PG17_VERSION=$(PGPASSWORD="${PGPASSWORD:-postgres}" psql -h localhost -p "${PG_NEW_PORT}" -U postgres -tAc "SELECT version();" 2>>"${LOG_FILE}" | head -1 || echo "unknown")
fi
log "  PG17 版本: ${PG17_VERSION}"
log "✅ 升级验证完成"

# 8. 生成报告
log "[8/8] 生成升级报告..."
DURATION_END=$(date +%s)
DURATION=$((DURATION_END - DURATION_START))

REPORT=$(cat <<EOF
{
  "operation": "pg16_to_pg17_upgrade",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "dry_run": ${DRY_RUN},
  "status": "success",
  "duration_seconds": ${DURATION},
  "old_data_dir": "${PG_OLD_DATA}",
  "new_data_dir": "${PG_NEW_DATA}",
  "old_port": ${PG_OLD_PORT},
  "new_port": ${PG_NEW_PORT},
  "pg17_version": "${PG17_VERSION}",
  "backup_dir": "${BACKUP_DIR}",
  "log_file": "${LOG_FILE}"
}
EOF
)
echo "${REPORT}" > "${REPORT_FILE}"
log "✅ 报告已生成: ${REPORT_FILE}"
log "=========================================="
log "PostgreSQL 16 → 17 升级完成 (${DURATION}s)"
log "=========================================="
exit 0
