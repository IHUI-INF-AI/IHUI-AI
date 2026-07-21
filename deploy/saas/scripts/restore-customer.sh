#!/usr/bin/env bash
# 从备份恢复 IHUI-AI SaaS 客户数据
# 用法: ./scripts/restore-customer.sh <slug> [<backup-timestamp>]
#
#   backup-timestamp: 可选,默认 latest(最新备份)
#                     格式: YYYYMMDD_HHMMSS(例: 20260721_120000)
#
# ⚠️ 警告:此操作会覆盖客户当前数据!恢复前请先自动备份。

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

if [ $# -lt 1 ] || [ $# -gt 2 ]; then
    log_error "用法: $0 <slug> [<backup-timestamp>]"
    exit 1
fi

SLUG="$1"
TIMESTAMP="${2:-latest}"
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

# 解析备份路径
if [ "$TIMESTAMP" = "latest" ]; then
    BACKUP_DIR="$SAAS_ROOT/backups/$SLUG/latest"
    if [ ! -d "$BACKUP_DIR" ]; then
        log_error "无最新备份: $BACKUP_DIR"
        exit 1
    fi
    BACKUP_DIR=$(readlink -f "$BACKUP_DIR")
else
    BACKUP_DIR="$SAAS_ROOT/backups/$SLUG/$TIMESTAMP"
fi

if [ ! -d "$BACKUP_DIR" ]; then
    log_error "备份不存在: $BACKUP_DIR"
    exit 1
fi

# 确认
log_warn "⚠️  即将从备份恢复客户 '$SLUG'!"
log_warn "  备份位置: $BACKUP_DIR"
log_warn "  此操作会覆盖客户当前所有数据"
read -r -p "确认恢复? 输入 'yes' 继续: " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    log_info "已取消"
    exit 0
fi

log_info "恢复客户 '$SLUG' 从 $BACKUP_DIR..."

# 1. 暂停客户(确保无写入)
log_info "  步骤 1/4: 暂停客户..."
(cd "$CUSTOMER_DIR" && docker compose down --remove-orphans 2>&1) || true

# 2. 自动备份当前状态(以防)
log_info "  步骤 2/4: 自动备份当前状态(防回滚)..."
"$SCRIPT_DIR/backup-customer.sh" "$SLUG" 2>&1 | tail -2

# 3. 恢复 pgdata
if [ -f "$BACKUP_DIR/pgdata.tar.gz" ]; then
    log_info "  步骤 3/4: 恢复 pgdata..."
    docker volume rm "customer-${SLUG}-pgdata" 2>/dev/null || true
    docker volume create "customer-${SLUG}-pgdata"
    docker run --rm \
        -v "customer-${SLUG}-pgdata:/target" \
        -v "$BACKUP_DIR:/backup:ro" \
        alpine:latest \
        tar xzf /backup/pgdata.tar.gz -C /target 2>&1
    log_info "    pgdata 已恢复"
else
    log_warn "  备份中无 pgdata.tar.gz,跳过"
fi

# 4. 启动
log_info "  步骤 4/4: 启动客户..."
"$SCRIPT_DIR/resume-customer.sh" "$SLUG"

log_info "✅ 恢复完成"
