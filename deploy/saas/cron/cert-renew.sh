#!/usr/bin/env bash
# Let's Encrypt 通配符证书续期检查
# 用法: 部署为 cron 每周日 3:00 执行(或手动 ./cert-renew.sh)
#
# 原理:
#   - Traefik 自动处理证书续期(acme.json 自动续)
#   - 本脚本仅做:1) 触发 Traefik 重新加载;2) 验证证书有效期 < 30 天则告警
#   - 如已过期 7 天内,自动重启 Traefik 强制重签

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SAAS_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ACME_JSON="$SAAS_ROOT/../volumes/saas_letsencrypt/_data/acme.json"

log_info() { echo -e "${GREEN}[INFO]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# 1. 验证 Traefik 容器在运行
if ! docker ps --format '{{.Names}}' | grep -q '^ihui-saas-traefik$'; then
    log_error "Traefik 容器未运行,无法续期"
    exit 1
fi

# 2. 检查 acme.json
if [ ! -f "$ACME_JSON" ]; then
    log_warn "acme.json 不存在,等待首次签发..."
    exit 0
fi

# 3. 解析 acme.json,找所有证书的最早过期时间
log_info "解析证书状态..."
# 使用 node 解析(避免 jq 依赖)
CERT_EXPIRY=$(cd "$SAAS_ROOT" && node -e "
const fs = require('fs');
const crypto = require('crypto');
const acme = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
let minExpiry = null;
for (const [domain, cert] of Object.entries(acme.Certificates || {})) {
    const notAfter = cert.certificate?.notAfter;
    if (notAfter) {
        const expiry = new Date(notAfter);
        if (!minExpiry || expiry < minExpiry) minExpiry = expiry;
    }
}
if (minExpiry) console.log(minExpiry.toISOString());
" "$ACME_JSON" 2>/dev/null || echo "")

if [ -z "$CERT_EXPIRY" ]; then
    log_warn "无法解析证书有效期(可能 acme.json 还在初始化)"
    exit 0
fi

NOW=$(date -Iseconds)
DAYS_LEFT=$(( ($(date -d "$CERT_EXPIRY" +%s) - $(date -d "$NOW" +%s)) / 86400 ))

log_info "  最早证书过期: $CERT_EXPIRY(剩余 $DAYS_LEFT 天)"

# 4. 判断
if [ "$DAYS_LEFT" -lt 7 ]; then
    log_warn "证书即将过期或已过期,重启 Traefik 强制重签..."
    (cd "$SAAS_ROOT" && docker compose restart traefik)
    log_info "Traefik 已重启,Let's Encrypt 将在下次签发时自动续期"
elif [ "$DAYS_LEFT" -lt 30 ]; then
    log_warn "证书将在 $DAYS_LEFT 天后过期,Traefik 会在剩余 30 天时自动续期"
    log_warn "  无需手动干预,建议监控此输出"
else
    log_info "证书状态健康(剩余 $DAYS_LEFT 天)"
fi

# 5. 清理过期 30 天以上的旧备份
log_info "清理过期备份..."
cd "$SAAS_ROOT/backups" 2>/dev/null || exit 0
find . -mindepth 2 -maxdepth 2 -type d -mtime +30 -exec rm -rf {} + 2>/dev/null || true
log_info "完成"
