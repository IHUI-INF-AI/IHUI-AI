#!/bin/bash
# MinIO 文件备份 — mc mirror 同步到本地
# 用法: ./scripts/backup_minio.sh
set -euo pipefail

MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://minio:9000}"
MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-admin}"
MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-imo@;UC^}"
BUCKETS=("zhs" "sys-mini" "uploads")
BACKUP_DIR="${BACKUP_DIR:-/var/backups/minio}"
RETAIN_DAYS="${RETAIN_DAYS:-14}"

mkdir -p "${BACKUP_DIR}"
TS=$(date +%Y%m%d_%H%M%S)

# 配置 mc 客户端
mc alias set local "${MINIO_ENDPOINT}" "${MINIO_ACCESS_KEY}" "${MINIO_SECRET_KEY}" 1>/dev/null

for bucket in "${BUCKETS[@]}"; do
  DEST="${BACKUP_DIR}/${bucket}_${TS}"
  echo "[minio-backup] bucket=${bucket} -> ${DEST}"
  mc mirror --overwrite --remove "local/${bucket}" "${DEST}" 1>/dev/null 2>&1 || \
    echo "[minio-backup] WARN: bucket ${bucket} mirror failed"
done

# 清理过期
find "${BACKUP_DIR}" -maxdepth 1 -type d -mtime +${RETAIN_DAYS} -exec rm -rf {} + 2>/dev/null || true
echo "[minio-backup] done at $(date -Iseconds)"
