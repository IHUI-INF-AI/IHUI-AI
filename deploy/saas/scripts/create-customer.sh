#!/usr/bin/env bash
# 创建 IHUI-AI SaaS 客户租户
# 用法: ./scripts/create-customer.sh <slug>
#   slug: 客户标识,3-20 字符,小写字母数字横线
#
# 流程:
#   1. 校验参数
#   2. 加载顶层 .env
#   3. 生成随机凭据
#   4. 复制 templates/customer/ 到 customers/<slug>/
#   5. 替换占位符
#   6. docker compose up -d
#   7. 等待 healthcheck 通过
#   8. 输出访问地址 + 初始凭据

set -euo pipefail

# ==================== 颜色输出 ====================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# ==================== 参数校验 ====================
if [ $# -ne 1 ]; then
    log_error "用法: $0 <slug>"
    log_error "  slug: 3-20 字符,小写字母数字横线,例: acme / beta-corp / client-001"
    exit 1
fi

SLUG="$1"

if ! [[ "$SLUG" =~ ^[a-z0-9-]{3,20}$ ]]; then
    log_error "无效 slug: '$SLUG'"
    log_error "  必须 3-20 字符,仅允许小写字母、数字、横线"
    exit 1
fi

# ==================== 路径定位 ====================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SAAS_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ==================== 加载顶层 .env ====================
if [ ! -f "$SAAS_ROOT/.env" ]; then
    log_error "未找到 $SAAS_ROOT/.env"
    log_error "  请先复制 .env.example 为 .env 并填写:"
    log_error "  cp $SAAS_ROOT/.env.example $SAAS_ROOT/.env"
    exit 1
fi

# shellcheck disable=SC1091
set -a
. "$SAAS_ROOT/.env"
set +a

if [ -z "${BASE_DOMAIN:-}" ]; then
    log_error ".env 中未设置 BASE_DOMAIN"
    exit 1
fi

CUSTOMER_DOMAIN="${SLUG}.${BASE_DOMAIN}"
CUSTOMER_DIR="$SAAS_ROOT/customers/$SLUG"

# ==================== 校验未重复 ====================
if [ -d "$CUSTOMER_DIR" ]; then
    log_error "客户 '$SLUG' 已存在: $CUSTOMER_DIR"
    log_error "  如需重建请先销毁: ./scripts/destroy-customer.sh $SLUG"
    exit 1
fi

# ==================== 校验 Traefik 在运行 ====================
if ! docker ps --format '{{.Names}}' | grep -q '^ihui-saas-traefik$'; then
    log_warn "Traefik 未运行,正在启动..."
    (cd "$SAAS_ROOT" && docker compose up -d traefik)
    log_info "等待 Traefik 就绪..."
    sleep 10
fi

# ==================== 生成随机凭据 ====================
log_info "生成随机凭据..."
DB_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)
REDIS_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 32)
JWT_SECRET=$(openssl rand -base64 48 | tr -d '/+=' | head -c 64)
CREDENTIALS_ENCRYPTION_KEY=$(openssl rand -hex 32)
AI_CALLBACK_SECRET=$(openssl rand -hex 32)

# ==================== 复制模板 + 替换占位符 ====================
log_info "复制客户模板到 $CUSTOMER_DIR..."
mkdir -p "$CUSTOMER_DIR"

cp "$SAAS_ROOT/templates/customer/docker-compose.yml" "$CUSTOMER_DIR/docker-compose.yml"
cp "$SAAS_ROOT/templates/customer/init-db.sql" "$CUSTOMER_DIR/init-db.sql"

# 替换占位符
log_info "替换占位符..."
MEMORY_LIMIT="${DEFAULT_MEMORY_LIMIT:-2G}"
CPU_LIMIT="${DEFAULT_CPU_LIMIT:-1.0}"
IMAGE_TAG_VAL="${IMAGE_TAG:-latest}"

for f in "$CUSTOMER_DIR/docker-compose.yml" "$CUSTOMER_DIR/.env"; do
    if [ -f "$f" ]; then
        sed -i.bak \
            -e "s|{{SLUG}}|${SLUG}|g" \
            -e "s|{{DOMAIN}}|${CUSTOMER_DOMAIN}|g" \
            -e "s|{{DB_PASSWORD}}|${DB_PASSWORD}|g" \
            -e "s|{{REDIS_PASSWORD}}|${REDIS_PASSWORD}|g" \
            -e "s|{{JWT_SECRET}}|${JWT_SECRET}|g" \
            -e "s|{{CREDENTIALS_ENCRYPTION_KEY}}|${CREDENTIALS_ENCRYPTION_KEY}|g" \
            -e "s|{{AI_CALLBACK_SECRET}}|${AI_CALLBACK_SECRET}|g" \
            -e "s|{{MEMORY_LIMIT}}|${MEMORY_LIMIT}|g" \
            -e "s|{{CPU_LIMIT}}|${CPU_LIMIT}|g" \
            -e "s|{{IMAGE_TAG}}|${IMAGE_TAG_VAL}|g" \
            "$f"
        rm -f "$f.bak"
    fi
done

# 生成 .env 文件
cat > "$CUSTOMER_DIR/.env" <<EOF
CUSTOMER_SLUG=${SLUG}
CUSTOMER_DOMAIN=${CUSTOMER_DOMAIN}
DB_NAME=ihui_${SLUG}
DB_USER=ihui_${SLUG}
DB_PASSWORD=${DB_PASSWORD}
POSTGRES_PASSWORD=${DB_PASSWORD}
REDIS_PASSWORD=${REDIS_PASSWORD}
JWT_SECRET=${JWT_SECRET}
CREDENTIALS_ENCRYPTION_KEY=${CREDENTIALS_ENCRYPTION_KEY}
AI_CALLBACK_SECRET=${AI_CALLBACK_SECRET}
MEMORY_LIMIT=${MEMORY_LIMIT}
CPU_LIMIT=${CPU_LIMIT}
IMAGE_TAG=${IMAGE_TAG_VAL}
EOF

# init-db.sql 替换 {{SLUG}} 占位符
sed -i.bak -e "s|{{SLUG}}|${SLUG}|g" "$CUSTOMER_DIR/init-db.sql"
rm -f "$CUSTOMER_DIR/init-db.sql.bak"

chmod 600 "$CUSTOMER_DIR/.env"

# ==================== 启动客户容器 ====================
log_info "启动客户容器..."
(cd "$CUSTOMER_DIR" && docker compose up -d)

# ==================== 等待健康检查 ====================
log_info "等待数据库就绪..."
RETRIES=30
until docker exec "customer-${SLUG}-db" pg_isready -U "ihui_${SLUG}" -d "ihui_${SLUG}" >/dev/null 2>&1; do
    RETRIES=$((RETRIES - 1))
    if [ $RETRIES -le 0 ]; then
        log_error "数据库启动超时"
        log_error "查看日志: docker logs customer-${SLUG}-db"
        exit 1
    fi
    sleep 2
done

log_info "等待 API 服务就绪..."
RETRIES=30
until docker exec "customer-${SLUG}-api" wget --spider -q http://127.0.0.1:8080/api/health >/dev/null 2>&1; do
    RETRIES=$((RETRIES - 1))
    if [ $RETRIES -le 0 ]; then
        log_error "API 服务启动超时"
        log_error "查看日志: docker logs customer-${SLUG}-api"
        exit 1
    fi
    sleep 3
done

# ==================== 输出 ====================
cat <<EOF

${GREEN}========================================${NC}
${GREEN}客户 '$SLUG' 创建成功${NC}
${GREEN}========================================${NC}

访问地址:    https://${CUSTOMER_DOMAIN}
管理后台:    https://${CUSTOMER_DOMAIN}/admin

凭据(请妥善保存,不会再次显示):
  数据库名:   ihui_${SLUG}
  数据库用户: ihui_${SLUG}
  数据库密码: ${DB_PASSWORD}
  Redis 密码: ${REDIS_PASSWORD}
  JWT 密钥:   ${JWT_SECRET}

后续操作:
  查看状态:   ./scripts/list-customers.sh
  查看日志:   cd $CUSTOMER_DIR && docker compose logs -f
  销毁租户:   ./scripts/destroy-customer.sh $SLUG

${YELLOW}提示: 证书由 Let's Encrypt 自动签发,首次访问可能需要等待 1-2 分钟${NC}

EOF

# 备份凭据到 SAAS_ROOT/.credentials/{slug}.env
mkdir -p "$SAAS_ROOT/.credentials"
chmod 700 "$SAAS_ROOT/.credentials"
cp "$CUSTOMER_DIR/.env" "$SAAS_ROOT/.credentials/${SLUG}.env"
chmod 600 "$SAAS_ROOT/.credentials/${SLUG}.env"

log_info "凭据已备份到: $SAAS_ROOT/.credentials/${SLUG}.env (权限 600)"
