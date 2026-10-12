#!/usr/bin/env bash
# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# =============================================================================
# IHUI-AI 密钥批量生成脚本(Linux / macOS)
# =============================================================================
# 用法:在 deploy/prod-bundle/ 目录下执行
#   chmod +x gen-secrets.sh && ./gen-secrets.sh
#
# 行为:同 gen-secrets.ps1,生成 .env.production
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE="${SCRIPT_DIR}/.env.production.template"
OUTPUT="${SCRIPT_DIR}/../../.env.production"

if [[ ! -f "$TEMPLATE" ]]; then
    echo "[ERROR] 模板文件不存在: $TEMPLATE"
    echo "提示:在 deploy/prod-bundle/ 目录下运行此脚本"
    exit 1
fi

# 生成密码学安全的随机字符串
gen_hex() {
    local bytes="${1:-32}"
    openssl rand -hex "$bytes"
}

gen_password() {
    local length="${1:-24}"
    # 仅用 URL-safe 字符,避免特殊字符在 docker-compose / DATABASE_URL 里出问题
    tr -dc 'A-Za-z0-9' </dev/urandom | head -c "$length" || true
}

# 准备替换映射
declare -A REPLACEMENTS
REPLACEMENTS["<AUTOGEN-DB-PASSWORD>"]=$(gen_password 24)
REPLACEMENTS["<AUTOGEN-REDIS-PASSWORD>"]=$(gen_password 24)
REPLACEMENTS["<AUTOGEN-JWT-SECRET>"]=$(gen_hex 48)
REPLACEMENTS["<AUTOGEN-CREDENTIALS-KEY>"]=$(gen_hex 32)
REPLACEMENTS["<AUTOGEN-AI-CALLBACK-SECRET>"]=$(gen_hex 32)
REPLACEMENTS["<AUTOGEN-SERVICE-MESH-JWT>"]=$(gen_hex 32)
REPLACEMENTS["<AUTOGEN-AUDIT-HMAC>"]=$(gen_hex 32)
REPLACEMENTS["<AUTOGEN-SWAGGER-KEY>"]=$(gen_hex 32)
REPLACEMENTS["<AUTOGEN-GRAFANA-PASSWORD>"]=$(gen_password 20)

# 读取模板
TEMPLATE_CONTENT=$(cat "$TEMPLATE")

# 应用替换
for placeholder in "${!REPLACEMENTS[@]}"; do
    value="${REPLACEMENTS[$placeholder]}"
    # 用 sed 转义占位符的特殊字符(< > -)
    esc_placeholder=$(printf '%s\n' "$placeholder" | sed 's/[[\.*^$()+?{|]/\\&/g')
    TEMPLATE_CONTENT=$(echo "$TEMPLATE_CONTENT" | sed "s|${esc_placeholder}|${value}|g")
done

# 如果 .env.production 已存在,合并:保留用户已填的字段
if [[ -f "$OUTPUT" ]]; then
    echo "[INFO] .env.production 已存在,执行合并更新(保留用户已填字段)..." >&2
    # 解析已存在的 key=value
    declare -A EXISTING_KEYS
    while IFS= read -r line; do
        if [[ "$line" =~ ^[[:space:]]*([A-Z_][A-Z0-9_]*)[[:space:]]*=[[:space:]]*(.*)$ ]]; then
            EXISTING_KEYS["${BASH_REMATCH[1]}"]="${BASH_REMATCH[2]}"
        fi
    done < "$OUTPUT"

    # 重新生成结果,保留用户已填值
    RESULT=""
    while IFS= read -r line; do
        if [[ "$line" =~ ^[[:space:]]*([A-Z_][A-Z0-9_]*)[[:space:]]*=[[:space:]]*(.*)$ ]]; then
            key="${BASH_REMATCH[1]}"
            new_val="${BASH_REMATCH[2]}"
            if [[ -n "${EXISTING_KEYS[$key]:-}" ]]; then
                existing_val="${EXISTING_KEYS[$key]}"
                if [[ "$existing_val" =~ ^\<AUTOGEN- ]] || [[ "$existing_val" =~ ^\<COPY-FROM-DEV-MACHINE ]]; then
                    # 占位符,用新值
                    RESULT+="${key}=${new_val}"$'\n'
                else
                    # 用户已填的真实值,保留
                    RESULT+="${key}=${existing_val}"$'\n'
                fi
            else
                RESULT+="${key}=${new_val}"$'\n'
            fi
        else
            RESULT+="${line}"$'\n'
        fi
    done <<< "$TEMPLATE_CONTENT"
    TEMPLATE_CONTENT="$RESULT"
fi

# 写入
printf '%s' "$TEMPLATE_CONTENT" > "$OUTPUT"
chmod 600 "$OUTPUT"

echo ""
echo "[OK] .env.production 已生成: $OUTPUT"
echo ""
echo "已自动生成的密钥(请妥善保管,不要泄露):"
for placeholder in "${!REPLACEMENTS[@]}"; do
    field=""
    case "$placeholder" in
        "<AUTOGEN-DB-PASSWORD>")         field="DB_PASSWORD" ;;
        "<AUTOGEN-REDIS-PASSWORD>")      field="REDIS_PASSWORD" ;;
        "<AUTOGEN-JWT-SECRET>")          field="JWT_SECRET" ;;
        "<AUTOGEN-CREDENTIALS-KEY>")     field="CREDENTIALS_ENCRYPTION_KEY" ;;
        "<AUTOGEN-AI-CALLBACK-SECRET>")  field="AI_CALLBACK_SECRET" ;;
        "<AUTOGEN-SERVICE-MESH-JWT>")    field="SERVICE_MESH_JWT_SECRET" ;;
        "<AUTOGEN-AUDIT-HMAC>")          field="AUDIT_LOG_HMAC_SECRET" ;;
        "<AUTOGEN-SWAGGER-KEY>")         field="SWAGGER_API_KEY" ;;
        "<AUTOGEN-GRAFANA-PASSWORD>")    field="GRAFANA_ADMIN_PASSWORD" ;;
    esac
    echo "  $field = ${REPLACEMENTS[$placeholder]}"
done
echo ""
echo "下一步:从开发机 .env 拷贝真实 LLM key 等到 .env.production,然后运行 deploy.sh" >&2
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
