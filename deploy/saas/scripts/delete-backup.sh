#!/usr/bin/env bash
# 删除指定客户的某个备份(P1-2.2b)
# 用法: ./scripts/delete-backup.sh <slug> <timestamp>
#
# 删除: deploy/saas/backups/<slug>/<timestamp>/
# 安全:跳过 'latest' 软链接,仅删具体时间戳目录;若为最新备份会重新指向倒数第二新的

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

if [ $# -ne 2 ]; then
    log_error "用法: $0 <slug> <timestamp>"
    exit 1
fi

SLUG="$1"
TIMESTAMP="$2"

if ! [[ "$SLUG" =~ ^[a-z0-9-]{3,20}$ ]]; then
    log_error "无效 slug: '$SLUG'"
    exit 1
fi

# timestamp 格式校验:YYYYMMDD_HHMMSS
if ! [[ "$TIMESTAMP" =~ ^[0-9]{8}_[0-9]{6}$ ]]; then
    log_error "无效 timestamp: '$TIMESTAMP'(期望格式:YYYYMMDD_HHMMSS)"
    exit 1
fi

# 拒绝删除 latest
if [ "$TIMESTAMP" = "latest" ]; then
    log_error "禁止删除 'latest' 软链接"
    exit 1
fi

# 拒绝路径穿越
if [[ "$TIMESTAMP" == */* ]] || [[ "$TIMESTAMP" == *..* ]]; then
    log_error "非法 timestamp(包含路径分隔符或相对路径)"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SAAS_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$SAAS_ROOT/backups/$SLUG/$TIMESTAMP"

if [ ! -d "$BACKUP_DIR" ]; then
    log_error "备份不存在: $BACKUP_DIR"
    exit 1
fi

# 二次确认(除非 FORCE_DELETE=1)
if [ "${FORCE_DELETE:-0}" != "1" ]; then
    log_warn "即将删除备份: $BACKUP_DIR"
    log_warn "  大小: $(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1 || echo 'unknown')"
    read -p "确认删除? [yes/no] " -r CONFIRM
    if [ "$CONFIRM" != "yes" ]; then
        log_info "已取消"
        exit 0
    fi
fi

log_info "删除备份: $BACKUP_DIR"
rm -rf "$BACKUP_DIR"

# 若删的是 latest 指向的目录,重新指向剩余中最新
LATEST_LINK="$SAAS_ROOT/backups/$SLUG/latest"
if [ -L "$LATEST_LINK" ] && [ "$(readlink "$LATEST_LINK")" = "$TIMESTAMP" ]; then
    log_info "  latest 链接被删除,重新指向剩余最新..."
    NEW_LATEST=$(ls -1dt "$SAAS_ROOT/backups/$SLUG"/*/ 2>/dev/null | head -n 1 | xargs -I {} basename {} || true)
    if [ -n "$NEW_LATEST" ]; then
        ln -sfn "$NEW_LATEST" "$LATEST_LINK"
        log_info "  latest → $NEW_LATEST"
    else
        rm -f "$LATEST_LINK"
        log_warn "  已无剩余备份,latest 链接已删除"
    fi
fi

log_info "✅ 删除完成"
