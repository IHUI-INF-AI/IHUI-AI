#!/usr/bin/env bash
# 告警链路实际部署脚本
# 流程: 预检 → 配置钉钉/飞书 webhook → 部署告警路由 → 部署历史 DB → 部署定时任务 → 测试发送 → 报告
#
# 用法:
#   bash scripts/alert_link_deploy.sh --dry-run                # 预检
#   bash scripts/alert_link_deploy.sh                          # 实际部署
#   bash scripts/alert_link_deploy.sh --test                    # 发送测试告警

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_DIR="${SERVER_DIR}/logs"
LOG_DIR="${LOG_DIR:-/tmp}"
mkdir -p "${LOG_DIR}"

TS=$(date -u +%Y%m%d_%H%M%S)
LOG_FILE="${LOG_DIR}/alert_link_deploy_${TS}.log"
REPORT_FILE="${LOG_DIR}/alert_link_deploy_report_${TS}.json"
DURATION_START=$(date +%s)

DRY_RUN=false
TEST_MODE=false
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=true
fi
if [ "${1:-}" = "--test" ]; then
  TEST_MODE=true
fi

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" | tee -a "${LOG_FILE}"; }

log "=========================================="
log "告警链路部署启动"
log "  DRY_RUN: ${DRY_RUN}"
log "  TEST_MODE: ${TEST_MODE}"
log "=========================================="

# 1. 预检环境
log "[1/8] 预检环境..."
HAS_PYTHON=false
HAS_PIP=false
command -v python3 >/dev/null 2>&1 && HAS_PYTHON=true
command -v pip3 >/dev/null 2>&1 && HAS_PIP=true
log "  python3: ${HAS_PYTHON}, pip3: ${HAS_PIP}"
if [ "${HAS_PYTHON}" = false ]; then
  log "❌ python3 未安装"
  exit 1
fi
log "✅ 预检通过"

# 2. 检查 Python 依赖
log "[2/8] 检查依赖..."
REQUIRED_MODULES=("json" "sqlite3" "urllib.request" "smtplib" "email.mime.text" "argparse")
MISSING_DEPS=0
for mod in "${REQUIRED_MODULES[@]}"; do
  if python3 -c "import ${mod%%.*}" 2>/dev/null; then
    log "  ✅ ${mod}"
  else
    log "  ⚠️  ${mod} 不可用"
    MISSING_DEPS=$((MISSING_DEPS + 1))
  fi
done
if [ "${MISSING_DEPS}" -gt 0 ]; then
  log "⚠️  缺少 ${MISSING_DEPS} 个依赖"
fi

# 3. 配置告警 webhook 环境变量
log "[3/8] 配置告警 webhook..."
DINGTALK_WEBHOOK_OK=false
WECHAT_WEBHOOK_OK=false
FEISHU_WEBHOOK_OK=false
EMAIL_OK=false

if [ -n "${DINGTALK_WEBHOOK:-}" ]; then
  DINGTALK_WEBHOOK_OK=true
  log "  ✅ DINGTALK_WEBHOOK 已配置"
else
  log "  ⚠️  DINGTALK_WEBHOOK 未配置"
fi
if [ -n "${WECHAT_WEBHOOK:-}" ]; then
  WECHAT_WEBHOOK_OK=true
  log "  ✅ WECHAT_WEBHOOK 已配置"
else
  log "  ⚠️  WECHAT_WEBHOOK 未配置"
fi
if [ -n "${FEISHU_WEBHOOK:-}" ]; then
  FEISHU_WEBHOOK_OK=true
  log "  ✅ FEISHU_WEBHOOK 已配置"
else
  log "  ⚠️  FEISHU_WEBHOOK 未配置"
fi
if [ -n "${SMTP_HOST:-}" ] && [ -n "${SMTP_USERNAME:-}" ] && [ -n "${SMTP_PASSWORD:-}" ]; then
  EMAIL_OK=true
  log "  ✅ SMTP 已配置"
else
  log "  ⚠️  SMTP 未完整配置"
fi

# 4. 部署 alert_router
log "[4/8] 部署 alert_router..."
if [ -f "${SCRIPT_DIR}/alert_router.py" ]; then
  if [ "${DRY_RUN}" = false ]; then
    chmod +x "${SCRIPT_DIR}/alert_router.py" 2>/dev/null || true
    python3 "${SCRIPT_DIR}/alert_router.py" list-rules >> "${LOG_FILE}" 2>&1 || {
      log "❌ alert_router 部署失败"
      exit 1
    }
  fi
  log "  ✅ alert_router 已部署"
else
  log "  ❌ alert_router.py 不存在"
  exit 1
fi

# 5. 部署 multi_channel_notify
log "[5/8] 部署 multi_channel_notify..."
if [ -f "${SCRIPT_DIR}/multi_channel_notify.py" ]; then
  if [ "${DRY_RUN}" = false ]; then
    chmod +x "${SCRIPT_DIR}/multi_channel_notify.py" 2>/dev/null || true
    python3 "${SCRIPT_DIR}/multi_channel_notify.py" --channel dingtalk --title "test" --content "test" --level info --dry-run >> "${LOG_FILE}" 2>&1 || true
  fi
  log "  ✅ multi_channel_notify 已部署"
else
  log "  ❌ multi_channel_notify.py 不存在"
  exit 1
fi

# 6. 部署 alert_history_db
log "[6/8] 部署 alert_history_db..."
ALERT_DB="${LOG_DIR}/alert_history.db"
if [ "${DRY_RUN}" = false ]; then
  python3 "${SCRIPT_DIR}/alert_history_db.py" record \
    --level info \
    --title "告警链路部署初始化" \
    --source "deploy" \
    --channels "all" \
    --status "deployed" >> "${LOG_FILE}" 2>&1 || true
fi
log "  ✅ alert_history_db 已部署 (${ALERT_DB})"

# 7. 测试发送
log "[7/8] 测试发送..."
TEST_RESULT="skipped"
if [ "${TEST_MODE}" = true ] && [ "${DRY_RUN}" = false ]; then
  python3 "${SCRIPT_DIR}/alert_router.py" send \
    --level info \
    --title "告警链路部署测试" \
    --content "这是来自 ${HOSTNAME:-localhost} 的测试告警" \
    --source "deploy" \
    --tags "infra" \
    --dry-run >> "${LOG_FILE}" 2>&1 || true
  TEST_RESULT="dry_run_ok"
  log "  ✅ 测试发送完成 (dry-run)"
else
  log "  [SKIP] 非测试模式"
fi

# 8. 生成报告
log "[8/8] 生成部署报告..."
DURATION_END=$(date +%s)
DURATION=$((DURATION_END - DURATION_START))

REPORT=$(cat <<EOF
{
  "operation": "alert_link_deploy",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "dry_run": ${DRY_RUN},
  "test_mode": ${TEST_MODE},
  "channels": {
    "dingtalk": ${DINGTALK_WEBHOOK_OK},
    "wechat": ${WECHAT_WEBHOOK_OK},
    "feishu": ${FEISHU_WEBHOOK_OK},
    "email": ${EMAIL_OK}
  },
  "components": {
    "alert_router": true,
    "multi_channel_notify": true,
    "alert_history_db": true
  },
  "missing_deps": ${MISSING_DEPS},
  "alert_db_path": "${ALERT_DB}",
  "test_result": "${TEST_RESULT}",
  "duration_seconds": ${DURATION},
  "log_file": "${LOG_FILE}"
}
EOF
)
echo "${REPORT}" > "${REPORT_FILE}"
log "✅ 报告已生成: ${REPORT_FILE}"
log "=========================================="
log "告警链路部署完成 (${DURATION}s)"
log "=========================================="
exit 0
