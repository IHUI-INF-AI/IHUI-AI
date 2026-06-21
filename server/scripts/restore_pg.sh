#!/bin/bash
# PostgreSQL 恢复 — 从备份恢复 3 个库
# 用法:
#   ./scripts/restore_pg.sh zhs_ai_project_20260618_030000.sql.gz
#   ./scripts/restore_pg.sh latest
#   ./scripts/restore_pg.sh /path/to/backup.sql.gz
set -euo pipefail

PG_HOST="${PG_HOST:-postgres}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-zhs}"
PG_PASSWORD="${PG_PASSWORD:-zhs_pg_pass}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/postgresql}"
export PGPASSWORD="${PG_PASSWORD}"

BACKUP_FILE="${1:-}"
if [ -z "${BACKUP_FILE}" ]; then
  echo "用法: $0 <backup_file.sql.gz|latest|/path/to/file.sql.gz>"
  exit 1
fi

# latest: 取 BACKUP_DIR 下最新的备份
if [ "${BACKUP_FILE}" = "latest" ]; then
  BACKUP_FILE=$(ls -t "${BACKUP_DIR}"/*.sql.gz 2>/dev/null | head -1)
  if [ -z "${BACKUP_FILE}" ]; then
    echo "[pg-restore] 错误: ${BACKUP_DIR} 下无备份文件"
    exit 1
  fi
fi

# 相对路径: 拼接 BACKUP_DIR
if [[ ! "${BACKUP_FILE}" = /* ]] && [ ! -f "${BACKUP_FILE}" ]; then
  BACKUP_FILE="${BACKUP_DIR}/${BACKUP_FILE}"
fi

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "[pg-restore] 错误: 备份文件不存在: ${BACKUP_FILE}"
  exit 1
fi

# 从文件名解析目标库名 (格式: <db>_<timestamp>.sql.gz)
DB_NAME=$(basename "${BACKUP_FILE}" .sql.gz | sed 's/_[0-9]\{8\}_[0-9]\{6\}$//')

echo "[pg-restore] start at $(date -Iseconds)"
echo "[pg-restore] backup: ${BACKUP_FILE}"
echo "[pg-restore] target database: ${DB_NAME}"

# 确认
read -p "确认恢复到 ${DB_NAME}? (yes/no): " CONFIRM
[ "${CONFIRM}" = "yes" ] || { echo "[pg-restore] 已取消"; exit 0; }

# 恢复
echo "[pg-restore] restoring..."
gunzip -c "${BACKUP_FILE}" | psql -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d "${DB_NAME}" 2>&1 | tail -20

echo "[pg-restore] done at $(date -Iseconds)"
