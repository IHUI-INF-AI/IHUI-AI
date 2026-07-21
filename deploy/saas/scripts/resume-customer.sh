#!/usr/bin/env bash
# 恢复 IHUI-AI SaaS 客户(从 paused 状态启动)
# 用法: ./scripts/resume-customer.sh <slug>

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

CURRENT_STATE="unknown"
if [ -f "$CUSTOMER_DIR/.state" ]; then
    CURRENT_STATE=$(cat "$CUSTOMER_DIR/.state")
fi

if [ "$CURRENT_STATE" = "active" ]; then
    # 检查容器实际状态
    RUNNING=$(docker ps --filter "name=customer-${SLUG}-" --format "{{.Names}}" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$RUNNING" -gt 0 ]; then
        log_warn "客户 '$SLUG' 已经在运行"
        exit 0
    fi
    log_warn "状态文件显示 active 但容器未运行,继续启动..."
fi

log_info "恢复客户 '$SLUG'..."

# 启动容器
(cd "$CUSTOMER_DIR" && docker compose up -d 2>&1)

# 等待 API 就绪
log_info "等待 API 就绪..."
RETRIES=30
until docker exec "customer-${SLUG}-api" wget --spider -q http://127.0.0.1:8080/api/health >/dev/null 2>&1; do
    RETRIES=$((RETRIES - 1))
    if [ $RETRIES -le 0 ]; then
        log_error "API 启动超时"
        log_error "查看日志: cd $CUSTOMER_DIR && docker compose logs api"
        exit 1
    fi
    sleep 3
done

# 更新状态
echo "active" > "$CUSTOMER_DIR/.state"
echo "$(date -Iseconds)" > "$CUSTOMER_DIR/.state_changed_at"

log_info "客户 '$SLUG' 已恢复"
log_info "  访问: https://$(grep CUSTOMER_DOMAIN "$CUSTOMER_DIR/.env" | cut -d= -f2)"
