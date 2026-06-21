#!/bin/bash
# 全量备份入口 — 串行执行 PostgreSQL + Redis + MinIO 三个备份
# 用法: ./scripts/backup_all.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "====== ZHS Platform 全量备份 ======"
echo "开始时间: $(date -Iseconds)"
echo ""

bash "${SCRIPT_DIR}/backup_pg.sh"
echo ""
bash "${SCRIPT_DIR}/backup_redis.sh"
echo ""
bash "${SCRIPT_DIR}/backup_minio.sh"

echo ""
echo "====== 备份完成 ======"
echo "结束时间: $(date -Iseconds)"
