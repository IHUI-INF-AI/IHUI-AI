#!/bin/bash
# PostgreSQL 备份 — pg_dump 全量备份 3 个库 (ai / center / course)
# 用法: ./scripts/backup_pg.sh
set -euo pipefail

PG_HOST="${PG_HOST:-postgres}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-zhs}"
PG_PASSWORD="${PG_PASSWORD:-zhs_pg_pass}"
DATABASES=("zhs_ai_project" "zhs_center_project" "zhs_educational_training")
BACKUP_DIR="${BACKUP_DIR:-/var/backups/postgresql}"
RETAIN_DAYS="${RETAIN_DAYS:-14}"

mkdir -p "${BACKUP_DIR}"
TS=$(date +%Y%m%d_%H%M%S)
export PGPASSWORD="${PG_PASSWORD}"

echo "[pg-backup] start at $(date -Iseconds)"
echo "[pg-backup] host=${PG_HOST}:${PG_PORT} databases=${DATABASES[*]}"

FAIL_COUNT=0
for db in "${DATABASES[@]}"; do
  BACKUP_FILE="${BACKUP_DIR}/${db}_${TS}.sql.gz"
  echo "[pg-backup] dumping: ${db} -> ${BACKUP_FILE}"
  if pg_dump -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d "${db}" \
    --format=plain --no-owner --no-privileges 2>/dev/null | gzip > "${BACKUP_FILE}"; then
    SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
    echo "[pg-backup] OK: ${db} (${SIZE})"
  else
    echo "[pg-backup] WARN: ${db} 备份失败"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
done

find "${BACKUP_DIR}" -name "*.sql.gz" -mtime +${RETAIN_DAYS} -delete 2>/dev/null || true
echo "[pg-backup] cleaned backups older than ${RETAIN_DAYS} days"
echo "[pg-backup] done at $(date -Iseconds) (fail=${FAIL_COUNT})"

[ "${FAIL_COUNT}" -gt 0 ] && exit 1
exit 0
