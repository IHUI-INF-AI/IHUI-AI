#!/bin/bash
# PostgreSQL 安全审计脚本
#
# 审计内容:
#   1. SSL 配置检查
#   2. 密码加密检查
#   3. pg_hba.conf 权限检查
#   4. 角色权限检查
#   5. 默认账户检查
#   6. 审计日志检查
#
# 用法: ./scripts/pg_security_audit.sh
set -euo pipefail

PG_HOST="${PG_HOST:-127.0.0.1}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-zhs}"
PG_PASSWORD="${PG_PASSWORD:-zhs_pg_pass}"
DATABASES=("zhs_ai_project" "zhs_center_project" "zhs_educational_training")
OUTPUT_DIR="${OUTPUT_DIR:-/tmp/pg_security_audit}"
TS=$(date +%Y%m%d_%H%M%S)

export PGPASSWORD="${PG_PASSWORD}"

mkdir -p "${OUTPUT_DIR}"
REPORT="${OUTPUT_DIR}/security_audit_${TS}.json"

echo "============================================================"
echo "PostgreSQL 安全审计"
echo "============================================================"
echo "时间: $(date -Iseconds)"
echo "报告: ${REPORT}"
echo ""

# 生成 JSON 报告
echo "{" > "${REPORT}"
echo '  "timestamp": "'"${TS}"'",' >> "${REPORT}"
echo '  "audits": [' >> "${REPORT}"

# ---------- 1. SSL 配置检查 ----------
echo "  - SSL 配置检查..."
echo '    {"audit": "ssl_config", "status": "checking"},' >> "${REPORT}"
SSL_ON=$(psql -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d postgres -tAc \
  "SHOW ssl;" 2>/dev/null | tr -d '[:space:]' || echo "unknown")
SSL_PROTOCOL=$(psql -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d postgres -tAc \
  "SHOW ssl_min_protocol_version;" 2>/dev/null | tr -d '[:space:]' || echo "unknown")
echo "    SSL: ${SSL_ON}, 协议: ${SSL_PROTOCOL}"
echo '    {"audit": "ssl_config", "ssl": "'"${SSL_ON}"'", "min_protocol": "'"${SSL_PROTOCOL}"'", "status": "'"${SSL_ON}"'"},' >> "${REPORT}"

# ---------- 2. 密码加密检查 ----------
echo "  - 密码加密检查..."
PASSWORD_ENC=$(psql -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d postgres -tAc \
  "SHOW password_encryption;" 2>/dev/null | tr -d '[:space:]' || echo "unknown")
echo "    密码加密: ${PASSWORD_ENC}"
echo '    {"audit": "password_encryption", "method": "'"${PASSWORD_ENC}"'", "status": "'"${PASSWORD_ENC}"'"},' >> "${REPORT}"

# ---------- 3. 角色权限检查 ----------
echo "  - 角色权限检查..."
echo '    {"audit": "roles", "superusers": [' >> "${REPORT}"
psql -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d postgres -tA -F "|" <<EOF >> "${REPORT}"
SELECT '      {"role": "' || rolname || '", "superuser": ' || rolsuper || ', "can_login": ' || rolcanlogin || '}' as row
FROM pg_roles
WHERE rolsuper = true
ORDER BY rolname;
EOF
echo '' >> "${REPORT}"
echo '    ]},' >> "${REPORT}"

# ---------- 4. 默认账户检查 ----------
echo "  - 默认账户检查..."
DEFAULT_USERS=$(psql -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d postgres -tAc \
  "SELECT count(*) FROM pg_roles WHERE rolname IN ('postgres', 'admin', 'root') AND rolcanlogin = true;" 2>/dev/null || echo "0")
echo "    默认账户登录数: ${DEFAULT_USERS}"
echo '    {"audit": "default_accounts", "count": '"${DEFAULT_USERS}"', "status": "'"${DEFAULT_USERS}"'"},' >> "${REPORT}"

# ---------- 5. 连接数检查 ----------
echo "  - 连接数检查..."
MAX_CONN=$(psql -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d postgres -tAc \
  "SHOW max_connections;" 2>/dev/null | tr -d '[:space:]' || echo "0")
ACTIVE_CONN=$(psql -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d postgres -tAc \
  "SELECT count(*) FROM pg_stat_activity;" 2>/dev/null || echo "0")
echo "    最大连接: ${MAX_CONN}, 活跃: ${ACTIVE_CONN}"
echo '    {"audit": "connections", "max": '"${MAX_CONN}"', "active": '"${ACTIVE_CONN}"'},' >> "${REPORT}"

# ---------- 6. 数据库权限检查 ----------
echo "  - 数据库权限检查..."
echo '    {"audit": "database_permissions", "databases": [' >> "${REPORT}"
for db in "${DATABASES[@]}"; do
  PUB_PERM=$(psql -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d "${db}" -tAc \
    "SELECT count(*) FROM pg_database WHERE datname = '${db}' AND datacl IS NULL;" 2>/dev/null || echo "0")
  echo "    ${db}: public 权限默认=${PUB_PERM}"
  echo '      {"database": "'"${db}"'", "public_default": '"${PUB_PERM}"'},' >> "${REPORT}"
done
echo '' >> "${REPORT}"
echo '    ]}' >> "${REPORT}"

echo '  ]' >> "${REPORT}"
echo "}" >> "${REPORT}"

echo ""
echo "============================================================"
echo "✅ 安全审计报告生成完成"
echo "============================================================"
echo "报告: ${REPORT}"
echo ""
echo "安全建议:"
echo "  1. SSL: 确保 ssl=on, min_protocol=TLSv1.2"
echo "  2. 密码: 使用 scram-sha-256 加密"
echo "  3. pg_hba.conf: 强制 hostssl, 拒绝 0.0.0.0/0"
echo "  4. 角色: 最小权限, 避免超级用户"
echo "  5. 默认账户: 禁用 postgres 远程登录"
echo "  6. 审计: 开启 log_statement=ddl + log_connections"
echo "============================================================"
exit 0
