#!/usr/bin/env bash
# 生成自签名 SSL 证书 (staging 内部 HTTPS 用)
# 用法: ./scripts/gen_ssl_staging.sh
#
# 生成的证书位于 docker/nginx/ssl/staging.{crt,key}
# 浏览器首次访问会警告, 自行添加信任即可

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SSL_DIR="$PROJECT_DIR/docker/nginx/ssl"
CERT_FILE="$SSL_DIR/staging.crt"
KEY_FILE="$SSL_DIR/staging.key"

mkdir -p "$SSL_DIR"

if [ -f "$CERT_FILE" ] && [ -f "$KEY_FILE" ]; then
    echo "证书已存在: $CERT_FILE"
    echo "如需重新生成, 请先删除:"
    echo "  rm $CERT_FILE $KEY_FILE"
    exit 0
fi

DOMAIN="${STAGING_DOMAIN:-staging.zhs.local}"
DAYS=365

openssl req -x509 -newkey rsa:2048 -nodes \
    -keyout "$KEY_FILE" \
    -out "$CERT_FILE" \
    -days "$DAYS" \
    -subj "/C=CN/ST=Beijing/L=Beijing/O=ZHS Platform/OU=Staging/CN=$DOMAIN" \
    -addext "subjectAltName=DNS:$DOMAIN,DNS:localhost,IP:127.0.0.1"

chmod 600 "$KEY_FILE"
chmod 644 "$CERT_FILE"

echo "证书已生成:"
echo "  证书: $CERT_FILE"
echo "  私钥: $KEY_FILE"
echo "  域名: $DOMAIN"
echo "  有效期: $DAYS 天"
echo ""
echo "客户端信任: 将 staging.crt 导入系统受信任根证书"
