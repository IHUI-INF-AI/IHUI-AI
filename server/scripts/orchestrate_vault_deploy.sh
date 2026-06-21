#!/bin/bash
# Vault 生产部署实战编排脚本
#
# 功能: 编排 Vault 生产部署 + 密钥轮换定时任务配置
# 流程: 环境检查 → dry-run 预检 → 部署 Vault → 验证密钥 → 配置 crontab → 测试轮换 → 报告
#
# 用法: ./scripts/orchestrate_vault_deploy.sh [--dry-run]
set -euo pipefail

DRY_RUN=0
if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOG_DIR="${SERVER_DIR}/logs"
TS=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${LOG_DIR}/vault_orchestrate_${TS}.log"
REPORT_FILE="${LOG_DIR}/vault_orchestrate_report_${TS}.json"
CRONTAB_FILE="${SERVER_DIR}/deploy/crontab/vault_crontab.txt"

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
  local rotation_test=$4
  local crontab_installed=$5
  cat > "${REPORT_FILE}" <<EOF
{
  "timestamp": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "operation": "vault_deploy_orchestration",
  "status": "${status}",
  "duration_seconds": ${duration},
  "vault_sealed": ${sealed},
  "rotation_test": "${rotation_test}",
  "crontab_installed": ${crontab_installed},
  "vault_address": "http://127.0.0.1:8200",
  "secret_path": "secret/zhs/pg-backup",
  "log_file": "${LOG_FILE}"
}
EOF
  log "报告已生成: ${REPORT_FILE}"
}

START_TIME=$(date +%s)
SEALED="true"
ROTATION_TEST="skipped"
CRONTAB_INSTALLED=0

log "Vault 生产部署实战编排"
log "模式: $([ ${DRY_RUN} -eq 1 ] && echo 'dry-run' || echo 'production')"
log "日志: ${LOG_FILE}"

# ---------- 步骤 1: 环境检查 ----------
step "1/7" "环境检查"

log "检查 docker..."
if ! command -v docker >/dev/null 2>&1; then
  log "❌ docker 未安装"
  generate_report "failed" 0 "${SEALED}" "${ROTATION_TEST}" ${CRONTAB_INSTALLED}
  exit 1
fi
log "✅ docker 已安装"

log "检查 Vault compose..."
VAULT_COMPOSE="${SERVER_DIR}/deploy/docker/docker-compose.vault.yml"
if [ ! -f "${VAULT_COMPOSE}" ]; then
  log "❌ 缺少 ${VAULT_COMPOSE}"
  generate_report "failed" 0 "${SEALED}" "${ROTATION_TEST}" ${CRONTAB_INSTALLED}
  exit 1
fi
log "✅ deploy/docker/docker-compose.vault.yml 存在"

log "检查密钥管理脚本..."
if [ ! -f "${SCRIPT_DIR}/pg_backup_key_manager.sh" ]; then
  log "❌ 缺少 pg_backup_key_manager.sh"
  generate_report "failed" 0 "${SEALED}" "${ROTATION_TEST}" ${CRONTAB_INSTALLED}
  exit 1
fi
log "✅ pg_backup_key_manager.sh 存在"

log "检查密钥轮换脚本..."
if [ ! -f "${SCRIPT_DIR}/vault_key_rotation_cron.sh" ]; then
  log "❌ 缺少 vault_key_rotation_cron.sh"
  generate_report "failed" 0 "${SEALED}" "${ROTATION_TEST}" ${CRONTAB_INSTALLED}
  exit 1
fi
log "✅ vault_key_rotation_cron.sh 存在"

# ---------- 步骤 2: dry-run 预检 ----------
step "2/7" "dry-run 预检"

log "执行 deploy_vault_production.sh --dry-run..."
if bash "${SCRIPT_DIR}/deploy_vault_production.sh" --dry-run >>"${LOG_FILE}" 2>&1; then
  log "✅ dry-run 预检通过"
else
  log "❌ dry-run 预检失败"
  generate_report "failed" 0 "${SEALED}" "${ROTATION_TEST}" ${CRONTAB_INSTALLED}
  exit 1
fi

if [ ${DRY_RUN} -eq 1 ]; then
  log ""
  log "✅ dry-run 模式完成"
  END_TIME=$(date +%s)
  generate_report "dry_run_passed" $((END_TIME - START_TIME)) "${SEALED}" "${ROTATION_TEST}" ${CRONTAB_INSTALLED}
  exit 0
fi

# ---------- 步骤 3: 部署 Vault ----------
step "3/7" "部署 Vault"

log "调用 deploy_vault_production.sh..."
if bash "${SCRIPT_DIR}/deploy_vault_production.sh" >>"${LOG_FILE}" 2>&1; then
  log "✅ Vault 部署完成"
  SEALED="false"
else
  log "❌ Vault 部署失败"
  generate_report "failed" 0 "${SEALED}" "${ROTATION_TEST}" ${CRONTAB_INSTALLED}
  exit 1
fi

# ---------- 步骤 4: 验证密钥访问 ----------
step "4/7" "验证密钥访问"

log "通过 pg_backup_key_manager.sh 验证..."
if [ -f "${LOG_DIR}/vault_keys.txt" ]; then
  export VAULT_ADDR="http://127.0.0.1:8200"
  export VAULT_TOKEN=$(grep ROOT_TOKEN "${LOG_DIR}/vault_keys.txt" | cut -d= -f2)
  if bash "${SCRIPT_DIR}/pg_backup_key_manager.sh" verify >>"${LOG_FILE}" 2>&1; then
    log "✅ 密钥访问验证通过"
  else
    log "⚠️  密钥访问验证失败"
  fi
else
  log "⚠️  未找到 vault_keys.txt, 跳过验证"
fi

# ---------- 步骤 5: 配置 crontab ----------
step "5/7" "配置 crontab"

log "创建 crontab 配置文件..."
mkdir -p "$(dirname "${CRONTAB_FILE}")"

cat > "${CRONTAB_FILE}" <<EOF
# Vault 密钥轮换定时任务
# 每日 03:00 执行密钥轮换
# 环境变量需根据实际部署调整

SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

# Vault 配置
VAULT_ADDR=http://127.0.0.1:8200
# VAULT_TOKEN 从 vault_keys.txt 读取或使用有限权限 token

# 每日 03:00 执行密钥轮换
0 3 * * * ${SCRIPT_DIR}/vault_key_rotation_cron.sh >> ${LOG_DIR}/vault_rotation_cron.log 2>&1

# 每周日 02:00 执行密钥验证
0 2 * * 0 ${SCRIPT_DIR}/pg_backup_key_manager.sh verify >> ${LOG_DIR}/vault_verify.log 2>&1
EOF

log "✅ crontab 配置文件已创建: ${CRONTAB_FILE}"

log "安装 crontab..."
if command -v crontab >/dev/null 2>&1; then
  if crontab "${CRONTAB_FILE}" >>"${LOG_FILE}" 2>&1; then
    log "✅ crontab 已安装"
    CRONTAB_INSTALLED=1
  else
    log "⚠️  crontab 安装失败"
  fi
else
  log "ℹ️  crontab 命令不可用, 请手动安装: crontab ${CRONTAB_FILE}"
fi

# ---------- 步骤 6: 测试密钥轮换 ----------
step "6/7" "测试密钥轮换"

log "执行 vault_key_rotation_cron.sh..."
if [ -n "${VAULT_TOKEN:-}" ]; then
  if bash "${SCRIPT_DIR}/vault_key_rotation_cron.sh" >>"${LOG_FILE}" 2>&1; then
    log "✅ 密钥轮换测试通过"
    ROTATION_TEST="passed"
  else
    log "⚠️  密钥轮换测试失败 (非致命)"
    ROTATION_TEST="failed"
  fi
else
  log "⚠️  缺少 VAULT_TOKEN, 跳过轮换测试"
fi

# ---------- 步骤 7: 生成报告 ----------
step "7/7" "生成报告"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

if [ "${ROTATION_TEST}" = "passed" ]; then
  generate_report "success" ${DURATION} "${SEALED}" "${ROTATION_TEST}" ${CRONTAB_INSTALLED}
else
  generate_report "rotation_failed" ${DURATION} "${SEALED}" "${ROTATION_TEST}" ${CRONTAB_INSTALLED}
fi

log ""
log "============================================================"
log "✅ Vault 部署编排完成"
log "============================================================"
log "Vault 地址: http://127.0.0.1:8200"
log "解封状态: ${SEALED}"
log "密钥轮换: ${ROTATION_TEST}"
log "crontab: $([ ${CRONTAB_INSTALLED} -eq 1 ] && echo '已安装' || echo '未安装')"
log "crontab 文件: ${CRONTAB_FILE}"
log "耗时: ${DURATION} 秒"
log "报告: ${REPORT_FILE}"
log "日志: ${LOG_FILE}"
exit 0
