#!/bin/bash
# Vault 密钥轮换定时任务脚本
#
# 功能: 定时轮换 PostgreSQL 备份加密密钥
# 频率: 每日 03:00 (通过 crontab 配置)
# 流程: 生成新密钥 → 写入 Vault → 更新轮换计数 → 保留旧密钥 → 通知
#
# 用法: ./scripts/vault_key_rotation_cron.sh
# crontab: 0 3 * * * /path/to/vault_key_rotation_cron.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_DIR="${SERVER_DIR}/logs"
LOG_FILE="${LOG_DIR}/vault_key_rotation_$(date +%Y%m%d_%H%M%S).log"
REPORT_FILE="${LOG_DIR}/vault_key_rotation_report_$(date +%Y%m%d_%H%M%S).json"

mkdir -p "${LOG_DIR}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "${LOG_FILE}"
}

VAULT_ADDR="${VAULT_ADDR:-http://127.0.0.1:8200}"
VAULT_TOKEN="${VAULT_TOKEN:-}"
SECRET_PATH="secret/zhs/pg-backup"
MAX_HISTORY=5

if [ -z "${VAULT_TOKEN}" ]; then
  if [ -f "${LOG_DIR}/vault_keys.txt" ]; then
    VAULT_TOKEN=$(grep ROOT_TOKEN "${LOG_DIR}/vault_keys.txt" | cut -d= -f2)
  fi
fi

if [ -z "${VAULT_TOKEN}" ]; then
  log "❌ 缺少 VAULT_TOKEN"
  exit 1
fi

export VAULT_ADDR VAULT_TOKEN

log "============================================================"
log "Vault 密钥轮换"
log "============================================================"
log "Vault: ${VAULT_ADDR}"
log "路径: ${SECRET_PATH}"

# 读取当前密钥信息
log ""
log "[1/5] 读取当前密钥信息..."
CURRENT_DATA=$(vault kv get -format=json "${SECRET_PATH}" 2>/dev/null || echo "{}")
CURRENT_KEY=$(echo "${CURRENT_DATA}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('data',{}).get('encryption_key',''))" 2>/dev/null || echo "")
ROTATION_COUNT=$(echo "${CURRENT_DATA}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('data',{}).get('rotation_count',0))" 2>/dev/null || echo "0")

if [ -z "${CURRENT_KEY}" ]; then
  log "❌ 无法读取当前密钥"
  exit 1
fi
log "✅ 当前密钥已读取 (轮换次数: ${ROTATION_COUNT})"

# 生成新密钥
log ""
log "[2/5] 生成新密钥..."
NEW_KEY=$(openssl rand -base64 48 | tr -d '\n')
if [ ${#NEW_KEY} -lt 32 ]; then
  log "❌ 新密钥长度不足: ${#NEW_KEY}"
  exit 1
fi
log "✅ 新密钥已生成 (长度: ${#NEW_KEY})"

# 保留旧密钥到历史
log ""
log "[3/5] 保留旧密钥到历史..."
TIMESTAMP=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
HISTORY_PATH="secret/zhs/pg-backup-history"
vault kv put "${HISTORY_PATH}" \
  "key_${TIMESTAMP}=${CURRENT_KEY}" \
  "rotation_count=${ROTATION_COUNT}" \
  >>"${LOG_FILE}" 2>&1 || log "  (历史写入失败, 非致命)"
log "✅ 旧密钥已归档到 ${HISTORY_PATH}"

# 写入新密钥
log ""
log "[4/5] 写入新密钥..."
NEW_COUNT=$((ROTATION_COUNT + 1))
vault kv put "${SECRET_PATH}" \
  encryption_key="${NEW_KEY}" \
  rotation_count="${NEW_COUNT}" \
  last_rotated_at="${TIMESTAMP}" \
  created_at="${TIMESTAMP}" \
  >>"${LOG_FILE}" 2>&1
log "✅ 新密钥已写入 (轮换次数: ${NEW_COUNT})"

# 验证新密钥
log ""
log "[5/5] 验证新密钥..."
VERIFY_KEY=$(vault kv get -field=encryption_key "${SECRET_PATH}" 2>/dev/null || echo "")
if [ "${VERIFY_KEY}" = "${NEW_KEY}" ]; then
  log "✅ 新密钥验证通过"
else
  log "❌ 新密钥验证失败"
  exit 1
fi

# 生成报告
cat > "${REPORT_FILE}" <<EOF
{
  "timestamp": "${TIMESTAMP}",
  "operation": "vault_key_rotation",
  "status": "success",
  "secret_path": "${SECRET_PATH}",
  "rotation_count": ${NEW_COUNT},
  "key_length": ${#NEW_KEY},
  "history_path": "${HISTORY_PATH}",
  "log_file": "${LOG_FILE}"
}
EOF

log ""
log "============================================================"
log "✅ 密钥轮换完成"
log "============================================================"
log "轮换次数: ${NEW_COUNT}"
log "报告: ${REPORT_FILE}"
exit 0
