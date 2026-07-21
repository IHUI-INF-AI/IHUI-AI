#!/usr/bin/env bash
# 暂停 IHUI-AI SaaS 客户(停止容器,保留数据)
# 用法: ./scripts/pause-customer.sh <slug>
#
# 效果:
#   - docker compose down(数据保留)
#   - 写入 customers/<slug>/.state = paused
#   - Traefik 路由自动失效(容器不在,labels 不生效)

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

# 检查当前状态
CURRENT_STATE="unknown"
if [ -f "$CUSTOMER_DIR/.state" ]; then
    CURRENT_STATE=$(cat "$CUSTOMER_DIR/.state")
fi

if [ "$CURRENT_STATE" = "paused" ]; then
    log_warn "客户 '$SLUG' 已经是 paused 状态"
    exit 0
fi

log_info "暂停客户 '$SLUG'(数据保留)..."

# 停止容器
(cd "$CUSTOMER_DIR" && docker compose down --remove-orphans 2>&1) || log_warn "docker compose down 失败(可能容器已停止)"

# 写入状态
echo "paused" > "$CUSTOMER_DIR/.state"
echo "$(date -Iseconds)" > "$CUSTOMER_DIR/.state_changed_at"

log_info "客户 '$SLUG' 已暂停"
log_info "  数据保留在: docker volumes customer-${SLUG}-pgdata + customer-${SLUG}-redisdata"
log_info "  恢复: ./scripts/resume-customer.sh $SLUG"
