#!/bin/bash
# Redis 备份 — RDB 快照
# 用法: ./scripts/backup_redis.sh
set -euo pipefail

REDIS_HOST="${REDIS_HOST:-redis}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_PASSWORD="${REDIS_PASSWORD:-c61mK5QH}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/redis}"
RETAIN_DAYS="${RETAIN_DAYS:-14}"

mkdir -p "${BACKUP_DIR}"
TS=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/dump_${TS}.rdb"

echo "[redis-backup] start at $(date -Iseconds)"

# 触发 BGSAVE，然后等待完成
redis-cli -h "${REDIS_HOST}" -p "${REDIS_PORT}" -a "${REDIS_PASSWORD}" BGSAVE 1>/dev/null
sleep 2
while [[ "$(redis-cli -h "${REDIS_HOST}" -p "${REDIS_PORT}" -a "${REDIS_PASSWORD}" LASTSAVE)" == "$(redis-cli -h "${REDIS_HOST}" -p "${REDIS_PORT}" -a "${REDIS_PASSWORD}" LASTSAVE)" ]]; do
  sleep 1
done

# 从容器内拷贝 RDB
docker cp zhs-redis:/data/dump.rdb "${BACKUP_FILE}" 2>/dev/null || \
  cp /var/lib/redis/dump.rdb "${BACKUP_FILE}" 2>/dev/null || \
  echo "[redis-backup] WARN: rdb file copy failed"

gzip "${BACKUP_FILE}"
SIZE=$(du -h "${BACKUP_FILE}.gz" | cut -f1)
echo "[redis-backup] done: ${BACKUP_FILE}.gz (${SIZE})"

find "${BACKUP_DIR}" -name "dump_*.rdb.gz" -mtime +${RETAIN_DAYS} -delete 2>/dev/null || true
echo "[redis-backup] cleaned backups older than ${RETAIN_DAYS} days"
