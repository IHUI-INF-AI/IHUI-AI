#!/usr/bin/env bash
# 备份 IHUI-AI SaaS 客户数据(仅 PostgreSQL,Redis 视为缓存)
# 用法: ./scripts/backup-customer.sh <slug>
#
# 输出: deploy/saas/backups/<slug>/<timestamp>/
#   - pgdata.tar.gz (PostgreSQL 数据)
#   - customer.env (客户环境变量,含凭据)
#   - metadata.json (备份元数据)

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

if [ $# -ne 1 ]; then
    log_error "用法: $0 <slug>"
    exit 1
fi

SLUG="$1"
if ! [[ "$SLUG" =~ ^[a-z0-9-]{3,20}$ ]]; then
    log_error "无效 slug: '$SLUG'"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SAAS_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CUSTOMER_DIR="$SAAS_ROOT/customers/$SLUG"

if [ ! -d "$CUSTOMER_DIR" ]; then
    log_error "客户 '$SLUG' 不存在: $CUSTOMER_DIR"
    exit 1
fi

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$SAAS_ROOT/backups/$SLUG/$TIMESTAMP"
mkdir -p "$BACKUP_DIR"

log_info "备份客户 '$SLUG' 到 $BACKUP_DIR..."

# 1. 备份 PostgreSQL 数据 volume
log_info "  备份 pgdata..."
if docker volume inspect "customer-${SLUG}-pgdata" >/dev/null 2>&1; then
    docker run --rm \
        -v "customer-${SLUG}-pgdata:/source:ro" \
        -v "$BACKUP_DIR:/backup" \
        alpine:latest \
        tar czf /backup/pgdata.tar.gz -C /source . 2>&1
    PG_SIZE=$(du -h "$BACKUP_DIR/pgdata.tar.gz" | cut -f1)
    log_info "    pgdata.tar.gz: $PG_SIZE"
else
    log_warn "  pgdata volume 不存在,跳过"
fi

# 2. 备份客户环境变量
log_info "  备份 .env..."
cp "$CUSTOMER_DIR/.env" "$BACKUP_DIR/customer.env"
chmod 600 "$BACKUP_DIR/customer.env"

# 3. 写入元数据
STATE="unknown"
[ -f "$CUSTOMER_DIR/.state" ] && STATE=$(cat "$CUSTOMER_DIR/.state")

cat > "$BACKUP_DIR/metadata.json" <<EOF
{
  "slug": "$SLUG",
  "timestamp": "$TIMESTAMP",
  "backup_time": "$(date -Iseconds)",
  "state": "$STATE",
  "hostname": "$(hostname)",
  "files": ["pgdata.tar.gz", "customer.env", "metadata.json"]
}
EOF

# 4. 创建最新备份软链接
ln -sfn "$TIMESTAMP" "$SAAS_ROOT/backups/$SLUG/latest"

# 5. 清理旧备份(保留最近 7 个)
log_info "  清理旧备份(保留最近 7 个)..."
cd "$SAAS_ROOT/backups/$SLUG"
ls -1dt */ 2>/dev/null | tail -n +8 | xargs -r rm -rf

log_info "✅ 备份完成: $BACKUP_DIR"
du -sh "$BACKUP_DIR"
