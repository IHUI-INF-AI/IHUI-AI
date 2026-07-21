#!/usr/bin/env bash
# 销毁 IHUI-AI SaaS 客户租户
# 用法: ./scripts/destroy-customer.sh <slug> [--keep-data]
#
# 默认会删除所有数据,如需保留数据库备份请加 --keep-data

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

if [ $# -lt 1 ] || [ $# -gt 2 ]; then
    log_error "用法: $0 <slug> [--keep-data]"
    exit 1
fi

SLUG="$1"
KEEP_DATA="false"
if [ "${2:-}" = "--keep-data" ]; then
    KEEP_DATA="true"
fi

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

# ==================== 确认 ====================
if [ "${FORCE_DESTROY:-}" != "1" ]; then
    log_warn "即将销毁客户 '$SLUG'!"
    log_warn "  此操作会停止容器并删除所有数据(PostgreSQL/Redis volumes)"
    if [ "$KEEP_DATA" = "true" ]; then
        log_warn "  --keep-data 已指定,数据会备份到 backups/ 目录"
    fi
    read -r -p "确认销毁? 输入 'yes' 继续: " CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        log_info "已取消"
        exit 0
    fi
fi

# ==================== 停止容器 ====================
log_info "停止客户容器..."
(cd "$CUSTOMER_DIR" && docker compose down --remove-orphans 2>&1 || true)

# ==================== 备份数据(可选)====================
if [ "$KEEP_DATA" = "true" ]; then
    BACKUP_DIR="$SAAS_ROOT/backups/$SLUG/$(date +%Y%m%d_%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    log_info "备份数据到 $BACKUP_DIR..."

    # 备份 pgdata volume
    docker run --rm \
        -v "customer-${SLUG}-pgdata:/source:ro" \
        -v "$BACKUP_DIR:/backup" \
        alpine:latest \
        tar czf /backup/pgdata.tar.gz -C /source . 2>&1 || log_warn "pgdata 备份失败(可能 volume 已不存在)"

    log_info "备份完成"
fi

# ==================== 删除 volumes + 网络 ====================
log_info "删除客户 volumes..."
docker volume rm "customer-${SLUG}-pgdata" "customer-${SLUG}-redisdata" 2>/dev/null || true

# ==================== 删除客户目录 ====================
log_info "删除客户目录 $CUSTOMER_DIR..."
rm -rf "$CUSTOMER_DIR"

# ==================== 清理 Traefik 路由(自动)====================
# Traefik 通过 Docker labels 自动发现,容器删除后路由自动失效,无需手动处理

# ==================== 清理凭据备份 ====================
if [ -f "$SAAS_ROOT/.credentials/${SLUG}.env" ]; then
    log_info "清理凭据备份..."
    rm -f "$SAAS_ROOT/.credentials/${SLUG}.env"
fi

log_info "客户 '$SLUG' 销毁完成"
