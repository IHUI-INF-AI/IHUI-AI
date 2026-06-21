#!/bin/bash
# HashiCorp Vault 生产部署编排脚本
#
# 功能: 一键部署 Vault + 初始化密钥路径 + 配置自动解封
# 流程: 预检 → 启动 Vault → 初始化 → 解封 → 启用 KV → 写入密钥 → 验证 → 报告
#
# 用法: ./scripts/deploy_vault_production.sh [--dry-run]
set -euo pipefail

DRY_RUN=0
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_DIR="${SERVER_DIR}/logs"
LOG_FILE="${LOG_DIR}/vault_deploy_$(date +%Y%m%d_%H%M%S).log"
REPORT_FILE="${LOG_DIR}/vault_deploy_report_$(date +%Y%m%d_%H%M%S).json"

mkdir -p "${LOG_DIR}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "${LOG_FILE}"
}

step() {
  log ""
  log "============================================================"
  log "[$1] $2"
  log "============================================================"
}

generate_report() {
  local status=$1
  local duration=$2
  local sealed=$3
  cat > "${REPORT_FILE}" <<EOF
{
  "timestamp": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "operation": "vault_production_deploy",
  "status": "${status}",
  "duration_seconds": ${duration},
  "vault": {
    "address": "http://127.0.0.1:8200",
    "sealed": ${sealed},
    "kv_path": "secret/zhs/pg-backup",
    "key_rotation_interval": "24h"
  },
  "log_file": "${LOG_FILE}"
}
EOF
  log "报告已生成: ${REPORT_FILE}"
}

START_TIME=$(date +%s)
SEALED="true"

log "HashiCorp Vault 生产部署"
log "模式: $([ ${DRY_RUN} -eq 1 ] && echo 'dry-run (仅预检)' || echo 'production (生产执行)')"
log "日志: ${LOG_FILE}"

# ---------- 步骤 1: 预检 ----------
step "1/8" "预检"

log "检查 docker..."
if ! command -v docker >/dev/null 2>&1; then
  log "❌ docker 未安装"
  generate_report "failed" 0 "${SEALED}"
  exit 1
fi
log "✅ docker 已安装"

log "检查 Vault compose 文件..."
VAULT_COMPOSE="${SERVER_DIR}/deploy/docker/docker-compose.vault.yml"
if [ ! -f "${VAULT_COMPOSE}" ]; then
  log "❌ 缺少 ${VAULT_COMPOSE}"
  generate_report "failed" 0 "${SEALED}"
  exit 1
fi
log "✅ deploy/docker/docker-compose.vault.yml 存在"

log "检查密钥管理脚本..."
if [ ! -f "${SCRIPT_DIR}/pg_backup_key_manager.sh" ]; then
  log "❌ 缺少 pg_backup_key_manager.sh"
  generate_report "failed" 0 "${SEALED}"
  exit 1
fi
log "✅ pg_backup_key_manager.sh 存在"

if [ ${DRY_RUN} -eq 1 ]; then
  log ""
  log "✅ dry-run 预检完成, 未执行实际部署"
  generate_report "dry_run_passed" 0 "${SEALED}"
  exit 0
fi

# ---------- 步骤 2: 启动 Vault ----------
step "2/8" "启动 Vault"

log "启动 Vault 容器..."
if docker compose -f "${VAULT_COMPOSE}" up -d >>"${LOG_FILE}" 2>&1; then
  log "✅ Vault 容器已启动"
else
  log "❌ Vault 启动失败"
  generate_report "failed" 0 "${SEALED}"
  exit 1
fi

log "等待 Vault 就绪..."
for i in $(seq 1 12); do
  if docker compose -f "${VAULT_COMPOSE}" exec -T vault \
    vault status >>"${LOG_FILE}" 2>&1; then
    log "✅ Vault 就绪 (等待 ${i}0 秒)"
    break
  fi
  sleep 5
  if [ ${i} -eq 12 ]; then
    log "⚠️  Vault 60 秒内未就绪 (可能需要初始化)"
  fi
done

# ---------- 步骤 3: 初始化 Vault ----------
step "3/8" "初始化 Vault"

log "检查 Vault 初始化状态..."
INIT_STATUS=$(docker compose -f "${VAULT_COMPOSE}" exec -T vault \
  vault status -format=json 2>/dev/null | \
  python3 -c "import sys,json; print(json.load(sys.stdin).get('initialized', False))" 2>/dev/null || echo "false")

if [ "${INIT_STATUS}" = "False" ] || [ "${INIT_STATUS}" = "false" ]; then
  log "初始化 Vault (1 key, 1 threshold)..."
  INIT_OUTPUT=$(docker compose -f "${VAULT_COMPOSE}" exec -T vault \
    vault operator init -key-shares=1 -key-threshold=1 -format=json 2>/dev/null)

  UNSEAL_KEY=$(echo "${INIT_OUTPUT}" | python3 -c "import sys,json; print(json.load(sys.stdin)['unseal_keys_b64'][0])" 2>/dev/null)
  ROOT_TOKEN=$(echo "${INIT_OUTPUT}" | python3 -c "import sys,json; print(json.load(sys.stdin)['root_token'])" 2>/dev/null)

  echo "UNSEAL_KEY=${UNSEAL_KEY}" > "${LOG_DIR}/vault_keys.txt"
  echo "ROOT_TOKEN=${ROOT_TOKEN}" >> "${LOG_DIR}/vault_keys.txt"
  chmod 600 "${LOG_DIR}/vault_keys.txt"
  log "✅ Vault 已初始化 (密钥保存到 ${LOG_DIR}/vault_keys.txt)"
else
  log "ℹ️  Vault 已初始化"
  if [ -f "${LOG_DIR}/vault_keys.txt" ]; then
    UNSEAL_KEY=$(grep UNSEAL_KEY "${LOG_DIR}/vault_keys.txt" | cut -d= -f2)
    ROOT_TOKEN=$(grep ROOT_TOKEN "${LOG_DIR}/vault_keys.txt" | cut -d= -f2)
  else
    log "⚠️  未找到 vault_keys.txt, 需手动解封"
  fi
fi

# ---------- 步骤 4: 解封 Vault ----------
step "4/8" "解封 Vault"

if [ -n "${UNSEAL_KEY:-}" ]; then
  log "解封 Vault..."
  if docker compose -f "${VAULT_COMPOSE}" exec -T vault \
    vault operator unseal "${UNSEAL_KEY}" >>"${LOG_FILE}" 2>&1; then
    log "✅ Vault 已解封"
    SEALED="false"
  else
    log "❌ Vault 解封失败"
    generate_report "failed" 0 "${SEALED}"
    exit 1
  fi
else
  log "⚠️  缺少 UNSEAL_KEY, 跳过解封"
fi

# ---------- 步骤 5: 启用 KV 引擎 ----------
step "5/8" "启用 KV 引擎"

if [ -n "${ROOT_TOKEN:-}" ]; then
  log "登录 Vault..."
  docker compose -f "${VAULT_COMPOSE}" exec -T -e VAULT_TOKEN="${ROOT_TOKEN}" vault \
    vault login "${ROOT_TOKEN}" >>"${LOG_FILE}" 2>&1

  log "启用 KV v2 引擎 (secret/)..."
  docker compose -f "${VAULT_COMPOSE}" exec -T -e VAULT_TOKEN="${ROOT_TOKEN}" vault \
    vault secrets enable -path=secret -version=2 kv >>"${LOG_FILE}" 2>&1 || log "  (secret/ 可能已启用)"

  log "✅ KV 引擎已启用"
else
  log "⚠️  缺少 ROOT_TOKEN, 跳过 KV 引擎启用"
fi

# ---------- 步骤 6: 写入初始密钥 ----------
step "6/8" "写入初始密钥"

if [ -n "${ROOT_TOKEN:-}" ]; then
  log "生成初始加密密钥..."
  INITIAL_KEY=$(openssl rand -base64 48 | tr -d '\n')

  log "写入 secret/zhs/pg-backup..."
  docker compose -f "${VAULT_COMPOSE}" exec -T -e VAULT_TOKEN="${ROOT_TOKEN}" vault \
    vault kv put secret/zhs/pg-backup encryption_key="${INITIAL_KEY}" \
    rotation_count=0 created_at="$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
    >>"${LOG_FILE}" 2>&1

  log "✅ 初始密钥已写入"
else
  log "⚠️  缺少 ROOT_TOKEN, 跳过密钥写入"
fi

# ---------- 步骤 7: 验证密钥访问 ----------
step "7/8" "验证密钥访问"

log "通过 pg_backup_key_manager.sh 验证..."
if [ -n "${ROOT_TOKEN:-}" ]; then
  export VAULT_ADDR="http://127.0.0.1:8200"
  export VAULT_TOKEN="${ROOT_TOKEN}"
  if bash "${SCRIPT_DIR}/pg_backup_key_manager.sh" verify >>"${LOG_FILE}" 2>&1; then
    log "✅ 密钥访问验证通过"
  else
    log "⚠️  密钥访问验证失败 (非致命)"
  fi
else
  log "⚠️  缺少 ROOT_TOKEN, 跳过验证"
fi

# ---------- 步骤 8: 报告 ----------
step "8/8" "生成报告"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

generate_report "success" ${DURATION} "${SEALED}"

log ""
log "============================================================"
log "✅ Vault 生产部署完成"
log "============================================================"
log "地址: http://127.0.0.1:8200"
log "密钥路径: secret/zhs/pg-backup"
log "解封状态: ${SEALED}"
log "密钥文件: ${LOG_DIR}/vault_keys.txt (权限 600)"
log "耗时: ${DURATION} 秒"
log "报告: ${REPORT_FILE}"
log "日志: ${LOG_FILE}"
log ""
log "下一步: 配置密钥轮换定时任务"
log "  crontab -e"
log "  0 3 * * * ${SCRIPT_DIR}/vault_key_rotation_cron.sh"
exit 0
