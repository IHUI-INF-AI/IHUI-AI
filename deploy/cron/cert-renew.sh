#!/usr/bin/env bash
# 微信支付平台证书每月续签包装脚本
# 由 cron 调用,负责:
#   1. 切换到项目目录
#   2. 加载 .env.production
#   3. 调用 cert-renew-watchdog
#   4. 失败时记录到日志 + 通知 webhook

set -euo pipefail

PROJECT_ROOT="${IHUI_PROJECT_ROOT:-/opt/ihui}"
LOG_DIR="${IHUI_LOG_DIR:-/opt/ihui/logs}"
WEBHOOK_URL="${IHUI_WEBHOOK_URL:-}"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

mkdir -p "$LOG_DIR"

log() {
  echo "[$TIMESTAMP] $*" | tee -a "$LOG_DIR/cert-renew.log"
}

cd "$PROJECT_ROOT" || {
  log "ERROR: 项目目录不存在: $PROJECT_ROOT"
  exit 1
}

# 加载 .env.production (Node 18+ 自动加载,这里保险起见)
if [ -f ".env.production" ]; then
  set -a
  # shellcheck disable=SC1091
  source .env.production
  set +a
fi

log "开始微信支付平台证书续签"

if [ -n "$WEBHOOK_URL" ]; then
  WEBHOOK_ARG="--webhook $WEBHOOK_URL"
else
  WEBHOOK_ARG=""
fi

if /usr/bin/node scripts/cert-renew-watchdog.mjs $WEBHOOK_ARG >> "$LOG_DIR/cert-renew.log" 2>&1; then
  log "✅ 平台证书续签完成"
else
  EXIT_CODE=$?
  log "❌ 平台证书续签失败 (exit $EXIT_CODE)"
  if [ -n "$WEBHOOK_URL" ]; then
    curl -X POST "$WEBHOOK_URL" \
      -H "Content-Type: application/json" \
      -d "{\"level\":\"error\",\"service\":\"cert-renew\",\"message\":\"平台证书续签失败 (exit $EXIT_CODE)\",\"timestamp\":\"$TIMESTAMP\"}" \
      --max-time 5 || true
  fi
  exit $EXIT_CODE
fi
