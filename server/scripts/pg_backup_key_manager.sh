#!/bin/bash
# PostgreSQL 加密备份密钥管理脚本
#
# 支持 2 种密钥后端:
#   1. HashiCorp Vault (生产推荐) — 从 Vault KV 引擎读取密钥
#   2. 本地 KMS (开发/测试) — 从加密文件读取密钥, 密钥由 master key 解密
#
# 用法:
#   ./scripts/pg_backup_key_manager.sh fetch    # 获取备份密钥
#   ./scripts/pg_backup_key_manager.sh rotate   # 轮换备份密钥
#   ./scripts/pg_backup_key_manager.sh verify   # 验证密钥可用性
#
# 环境变量:
#   KEY_BACKEND=vault|local (默认 local)
#   VAULT_ADDR=http://vault:8200
#   VAULT_TOKEN=xxx
#   LOCAL_KEY_FILE=/etc/zhs/pg_backup_key.enc
#   LOCAL_MASTER_KEY_FILE=/etc/zhs/master.key
set -euo pipefail

KEY_BACKEND="${KEY_BACKEND:-local}"
KEY_PATH="${KEY_PATH:-secret/zhs/pg-backup}"
LOCAL_KEY_FILE="${LOCAL_KEY_FILE:-/etc/zhs/pg_backup_key.enc}"
LOCAL_MASTER_KEY_FILE="${LOCAL_MASTER_KEY_FILE:-/etc/zhs/master.key}"
KEY_CACHE_FILE="${KEY_CACHE_FILE:-/tmp/.pg_backup_key_cache}"
KEY_CACHE_TTL="${KEY_CACHE_TTL:-300}"  # 5 分钟缓存

ACTION="${1:-fetch}"

# ---------- 工具函数 ----------
log() { echo "[key-manager] $*"; }

fetch_from_vault() {
  if [ -z "${VAULT_ADDR:-}" ] || [ -z "${VAULT_TOKEN:-}" ]; then
    log "错误: VAULT_ADDR 或 VAULT_TOKEN 未设置"
    return 1
  fi

  # 检查缓存
  if [ -f "${KEY_CACHE_FILE}" ]; then
    cache_age=$(( $(date +%s) - $(stat -c %Y "${KEY_CACHE_FILE}" 2>/dev/null || echo 0) ))
    if [ "${cache_age}" -lt "${KEY_CACHE_TTL}" ]; then
      cat "${KEY_CACHE_FILE}"
      return 0
    fi
  fi

  # 从 Vault 读取
  local key
  key=$(vault kv get -field=encryption_key "${KEY_PATH}" 2>/dev/null) || {
    log "错误: 无法从 Vault 读取 ${KEY_PATH}"
    return 1
  }

  if [ ${#key} -lt 32 ]; then
    log "错误: 密钥长度不足 32 字符 (实际 ${#key})"
    return 1
  fi

  # 写入缓存
  echo -n "${key}" > "${KEY_CACHE_FILE}"
  chmod 600 "${KEY_CACHE_FILE}"
  echo -n "${key}"
  log "从 Vault 获取密钥成功 (路径: ${KEY_PATH})"
}

fetch_from_local() {
  if [ ! -f "${LOCAL_KEY_FILE}" ] || [ ! -f "${LOCAL_MASTER_KEY_FILE}" ]; then
    log "错误: 本地密钥文件不存在"
    log "  ${LOCAL_KEY_FILE} 或 ${LOCAL_MASTER_KEY_FILE} 缺失"
    return 1
  fi

  # 用 master key 解密本地密钥文件
  local key
  key=$(openssl enc -d -aes-256-cbc -pbkdf2 \
    -pass "file:${LOCAL_MASTER_KEY_FILE}" \
    -in "${LOCAL_KEY_FILE}" 2>/dev/null) || {
    log "错误: 本地密钥解密失败"
    return 1
  }

  if [ ${#key} -lt 32 ]; then
    log "错误: 密钥长度不足 32 字符 (实际 ${#key})"
    return 1
  fi

  echo -n "${key}"
  log "从本地 KMS 获取密钥成功"
}

rotate_vault() {
  if [ -z "${VAULT_ADDR:-}" ] || [ -z "${VAULT_TOKEN:-}" ]; then
    log "错误: VAULT_ADDR 或 VAULT_TOKEN 未设置"
    return 1
  fi

  # 生成新密钥 (32 字符)
  local new_key
  new_key=$(openssl rand -base64 24 | tr -d '\n' | head -c 32)

  # 写入 Vault
  vault kv put "${KEY_PATH}" encryption_key="${new_key}" >/dev/null 2>&1 || {
    log "错误: 无法写入 Vault"
    return 1
  }

  # 清除缓存
  rm -f "${KEY_CACHE_FILE}"

  log "Vault 密钥轮换成功 (新密钥已写入 ${KEY_PATH})"
  echo "新密钥长度: ${#new_key} 字符"
}

rotate_local() {
  mkdir -p "$(dirname "${LOCAL_KEY_FILE}")"

  # 生成新 master key (如不存在)
  if [ ! -f "${LOCAL_MASTER_KEY_FILE}" ]; then
    openssl rand -hex 32 > "${LOCAL_MASTER_KEY_FILE}"
    chmod 600 "${LOCAL_MASTER_KEY_FILE}"
    log "生成新 master key: ${LOCAL_MASTER_KEY_FILE}"
  fi

  # 生成新备份密钥
  local new_key
  new_key=$(openssl rand -base64 24 | tr -d '\n' | head -c 32)

  # 用 master key 加密
  echo -n "${new_key}" | openssl enc -aes-256-cbc -pbkdf2 \
    -pass "file:${LOCAL_MASTER_KEY_FILE}" \
    -out "${LOCAL_KEY_FILE}"
  chmod 600 "${LOCAL_KEY_FILE}"

  log "本地密钥轮换成功 (新密钥已加密存储)"
  echo "新密钥长度: ${#new_key} 字符"
}

verify_key() {
  local key
  key=$(fetch_key) || return 1

  # 验证密钥可用于加解密
  local test_data="verify_test_$(date +%s)"
  local encrypted
  encrypted=$(echo -n "${test_data}" | openssl enc -aes-256-cbc -pbkdf2 -pass "pass:${key}" 2>/dev/null)
  local decrypted
  decrypted=$(echo "${encrypted}" | openssl enc -d -aes-256-cbc -pbkdf2 -pass "pass:${key}" 2>/dev/null)

  if [ "${test_data}" = "${decrypted}" ]; then
    log "✅ 密钥验证通过 (加解密一致)"
    return 0
  else
    log "❌ 密钥验证失败 (加解密不一致)"
    return 1
  fi
}

fetch_key() {
  case "${KEY_BACKEND}" in
    vault) fetch_from_vault ;;
    local) fetch_from_local ;;
    *) log "错误: 未知 KEY_BACKEND=${KEY_BACKEND}"; return 1 ;;
  esac
}

# ---------- 主逻辑 ----------
case "${ACTION}" in
  fetch)
    fetch_key
    ;;
  rotate)
    case "${KEY_BACKEND}" in
      vault) rotate_vault ;;
      local) rotate_local ;;
      *) log "错误: 未知 KEY_BACKEND=${KEY_BACKEND}"; exit 1 ;;
    esac
    ;;
  verify)
    verify_key
    ;;
  *)
    echo "用法: $0 {fetch|rotate|verify}"
    echo "  fetch   - 获取备份密钥"
    echo "  rotate  - 轮换备份密钥"
    echo "  verify  - 验证密钥可用性"
    echo ""
    echo "环境变量:"
    echo "  KEY_BACKEND=vault|local (默认 local)"
    echo "  VAULT_ADDR, VAULT_TOKEN (Vault 模式)"
    echo "  LOCAL_KEY_FILE, LOCAL_MASTER_KEY_FILE (本地模式)"
    exit 1
    ;;
esac
