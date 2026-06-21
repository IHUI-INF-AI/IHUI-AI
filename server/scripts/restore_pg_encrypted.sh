#!/bin/bash
# PostgreSQL 加密备份恢复 — openssl 解密 + gunzip + psql
# 用法:
#   ./scripts/restore_pg_encrypted.sh <backup_file.sql.gz.enc|latest|/path/to/file.sql.gz.enc>
#
# 解密算法: AES-256-CBC + PBKDF2 (与 backup_pg_encrypted.sh 对应)
set -euo pipefail

PG_HOST="${PG_HOST:-postgres}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-zhs}"
PG_PASSWORD="${PG_PASSWORD:-zhs_pg_pass}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/postgresql}"
export PGPASSWORD="${PG_PASSWORD}"

# 加密密钥
ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"
if [ -z "${ENCRYPTION_KEY}" ]; then
  echo "[pg-restore-enc] 错误: BACKUP_ENCRYPTION_KEY 未设置"
  exit 1
fi

BACKUP_FILE="${1:-}"
if [ -z "${BACKUP_FILE}" ]; then
  echo "用法: $0 <backup_file.sql.gz.enc|latest|/path/to/file.sql.gz.enc>"
  exit 1
fi

# latest: 取最新加密备份
if [ "${BACKUP_FILE}" = "latest" ]; then
  BACKUP_FILE=$(ls -t "${BACKUP_DIR}"/*.sql.gz.enc 2>/dev/null | head -1)
  if [ -z "${BACKUP_FILE}" ]; then
    echo "[pg-restore-enc] 错误: ${BACKUP_DIR} 下无加密备份文件"
    exit 1
  fi
fi

# 相对路径拼接
if [[ ! "${BACKUP_FILE}" = /* ]] && [ ! -f "${BACKUP_FILE}" ]; then
  BACKUP_FILE="${BACKUP_DIR}/${BACKUP_FILE}"
fi

if [ ! -f "${BACKUP_FILE}" ]; then
  echo "[pg-restore-enc] 错误: 备份文件不存在: ${BACKUP_FILE}"
  exit 1
fi

# 从文件名解析目标库名 (格式: <db>_<timestamp>.sql.gz.enc)
DB_NAME=$(basename "${BACKUP_FILE}" .sql.gz.enc | sed 's/_[0-9]\{8\}_[0-9]\{6\}$//')

echo "[pg-restore-enc] start at $(date -Iseconds)"
echo "[pg-restore-enc] backup: ${BACKUP_FILE}"
echo "[pg-restore-enc] target database: ${DB_NAME}"
echo "[pg-restore-enc] decryption=AES-256-CBC"

# 确认
read -p "确认恢复到 ${DB_NAME}? (yes/no): " CONFIRM
[ "${CONFIRM}" = "yes" ] || { echo "[pg-restore-enc] 已取消"; exit 0; }

# 解密 + 解压 + 恢复
echo "[pg-restore-enc] decrypting + restoring..."
openssl enc -d -aes-256-cbc -pbkdf2 -pass "pass:${ENCRYPTION_KEY}" \
  -in "${BACKUP_FILE}" \
  | gunzip \
  | psql -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d "${DB_NAME}" 2>&1 | tail -20

echo "[pg-restore-enc] done at $(date -Iseconds)"
