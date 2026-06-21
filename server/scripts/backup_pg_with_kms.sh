#!/bin/bash
# PostgreSQL 加密备份包装器 — 集成密钥管理
#
# 流程:
#   1. 从 Vault/本地 KMS 获取加密密钥
#   2. 调用 backup_pg_encrypted.sh 执行加密备份
#   3. 清除密钥缓存 (安全)
#
# 用法: ./scripts/backup_pg_with_kms.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[kms-backup] 从 KMS 获取加密密钥..."
ENCRYPTION_KEY=$("${SCRIPT_DIR}/pg_backup_key_manager.sh" fetch)

if [ -z "${ENCRYPTION_KEY}" ]; then
  echo "[kms-backup] ❌ 获取密钥失败"
  exit 1
fi

echo "[kms-backup] ✅ 密钥获取成功 (长度: ${#ENCRYPTION_KEY})"

# 导出密钥环境变量, 调用加密备份
export BACKUP_ENCRYPTION_KEY="${ENCRYPTION_KEY}"

echo "[kms-backup] 执行加密备份..."
if "${SCRIPT_DIR}/backup_pg_encrypted.sh"; then
  echo "[kms-backup] ✅ 加密备份成功"
  # 清除密钥缓存
  rm -f /tmp/.pg_backup_key_cache 2>/dev/null || true
  echo "[kms-backup] 密钥缓存已清除"
  exit 0
else
  echo "[kms-backup] ❌ 加密备份失败"
  rm -f /tmp/.pg_backup_key_cache 2>/dev/null || true
  exit 1
fi
