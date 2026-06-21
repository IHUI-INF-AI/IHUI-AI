#!/bin/bash
# PostgreSQL 加密备份 — pg_dump + gzip + openssl AES-256 加密
# 用法: ./scripts/backup_pg_encrypted.sh
#
# 加密算法: AES-256-CBC + PBKDF2 密钥派生
# 密钥来源: 环境变量 BACKUP_ENCRYPTION_KEY (32+ 字符)
#
# 异地容灾: 可选 rsync 到远程服务器 (配置 BACKUP_REMOTE_HOST + BACKUP_REMOTE_PATH)
set -euo pipefail

PG_HOST="${PG_HOST:-postgres}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-zhs}"
PG_PASSWORD="${PG_PASSWORD:-zhs_pg_pass}"
DATABASES=("zhs_ai_project" "zhs_center_project" "zhs_educational_training")
BACKUP_DIR="${BACKUP_DIR:-/var/backups/postgresql}"
RETAIN_DAYS="${RETAIN_DAYS:-14}"

# 加密密钥 (必须 32+ 字符)
ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"
if [ -z "${ENCRYPTION_KEY}" ]; then
  echo "[pg-backup-enc] 错误: BACKUP_ENCRYPTION_KEY 未设置 (需 32+ 字符)"
  exit 1
fi

# 异地容灾配置 (可选)
REMOTE_HOST="${BACKUP_REMOTE_HOST:-}"
REMOTE_PATH="${BACKUP_REMOTE_PATH:-}"

mkdir -p "${BACKUP_DIR}"
TS=$(date +%Y%m%d_%H%M%S)
export PGPASSWORD="${PG_PASSWORD}"

echo "[pg-backup-enc] start at $(date -Iseconds)"
echo "[pg-backup-enc] host=${PG_HOST}:${PG_PORT} databases=${DATABASES[*]}"
echo "[pg-backup-enc] encryption=AES-256-CBC remote=${REMOTE_HOST:-disabled}"

FAIL_COUNT=0
for db in "${DATABASES[@]}"; do
  BACKUP_FILE="${BACKUP_DIR}/${db}_${TS}.sql.gz.enc"
  echo "[pg-backup-enc] dumping+encrypting: ${db} -> ${BACKUP_FILE}"

  # pg_dump | gzip | openssl 加密
  if pg_dump -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d "${db}" \
    --format=plain --no-owner --no-privileges 2>/dev/null \
    | gzip \
    | openssl enc -aes-256-cbc -pbkdf2 -salt -pass "pass:${ENCRYPTION_KEY}" \
    > "${BACKUP_FILE}"; then
    SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
    echo "[pg-backup-enc] OK: ${db} (${SIZE}, encrypted)"

    # 异地容灾同步 (可选)
    if [ -n "${REMOTE_HOST}" ] && [ -n "${REMOTE_PATH}" ]; then
      if rsync -az --timeout=300 "${BACKUP_FILE}" \
        "${REMOTE_HOST}:${REMOTE_PATH}/" 2>/dev/null; then
        echo "[pg-backup-enc] synced: ${db} -> ${REMOTE_HOST}:${REMOTE_PATH}"
      else
        echo "[pg-backup-enc] WARN: ${db} 异地同步失败"
      fi
    fi
  else
    echo "[pg-backup-enc] WARN: ${db} 备份失败"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
done

# 清理过期备份 (本地)
find "${BACKUP_DIR}" -name "*.sql.gz.enc" -mtime +${RETAIN_DAYS} -delete 2>/dev/null || true
echo "[pg-backup-enc] cleaned local backups older than ${RETAIN_DAYS} days"

# 清理过期备份 (远程, 可选)
if [ -n "${REMOTE_HOST}" ] && [ -n "${REMOTE_PATH}" ]; then
  ssh "${REMOTE_HOST}" "find ${REMOTE_PATH} -name '*.sql.gz.enc' -mtime +${RETAIN_DAYS} -delete" 2>/dev/null || true
  echo "[pg-backup-enc] cleaned remote backups older than ${RETAIN_DAYS} days"
fi

echo "[pg-backup-enc] done at $(date -Iseconds) (fail=${FAIL_COUNT})"

[ "${FAIL_COUNT}" -gt 0 ] && exit 1
exit 0
