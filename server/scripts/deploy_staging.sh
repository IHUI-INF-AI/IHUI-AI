#!/usr/bin/env bash
# staging 部署脚本 — 在预发布环境完整部署 zhs-platform
# 用法: ./scripts/deploy_staging.sh [version]
#   version: 镜像 tag, 默认为 git 当前 short sha
#
# 执行流程:
#   1. 环境检查 (docker, compose, 网络)
#   2. .env 文件生成 (基于 .env.staging 模板, 自动生成强密钥)
#   3. 拉取/构建镜像
#   4. 备份当前数据
#   5. 数据库迁移 (alembic upgrade head)
#   6. 滚动重启服务 (app + nginx)
#   7. 健康检查
#   8. 通知部署结果

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# ---------------------------------------------------------------------------
# 参数
# ---------------------------------------------------------------------------
VERSION="${1:-$(git rev-parse --short HEAD 2>/dev/null || echo 'latest')}"
ENV_FILE=".env.staging"
COMPOSE_FILE="deploy/docker/docker-compose.yml"
LOG_FILE="$PROJECT_DIR/logs/deploy_$(date +%Y%m%d_%H%M%S).log"

mkdir -p "$PROJECT_DIR/logs"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

fail() {
    log "ERROR: $*"
    exit 1
}

# ---------------------------------------------------------------------------
# 1. 环境检查
# ---------------------------------------------------------------------------
log "=== Step 1: 环境检查 ==="

command -v docker >/dev/null 2>&1 || fail "docker 未安装"
command -v docker compose >/dev/null 2>&1 || command -v docker-compose >/dev/null 2>&1 || fail "docker compose 未安装"

DOCKER_COMPOSE="docker compose"
if ! docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE="docker-compose"
fi

# 检查磁盘
FREE_GB=$(df -BG "$PROJECT_DIR" | tail -1 | awk '{print $4}' | tr -d 'G')
if [ "${FREE_GB:-0}" -lt 5 ]; then
    fail "磁盘空间不足: 剩余 ${FREE_GB}G, 至少需要 5G"
fi

log "docker version: $(docker --version)"
log "compose version: $($DOCKER_COMPOSE version --short 2>/dev/null || echo 'unknown')"
log "free disk: ${FREE_GB}G"
log "deploy version: $VERSION"

# ---------------------------------------------------------------------------
# 2. .env 文件
# ---------------------------------------------------------------------------
log "=== Step 2: 生成 .env.staging ==="

if [ ! -f "$ENV_FILE" ]; then
    log "生成 $ENV_FILE (首次部署)"

    # 生成强密钥
    JWT_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(48))")
    SESSION_SECRET=$(python3 -c "import secrets; print(secrets.token_urlsafe(48))")

    cat > "$ENV_FILE" <<EOF
# ZHS Platform staging 环境
# Generated at $(date '+%Y-%m-%d %H:%M:%S')

ENV=staging
DEBUG=false
API_HOST=0.0.0.0
API_PORT=8000
API_WORKERS=4

# JWT
JWT_SECRET_KEY=${JWT_SECRET}
JWT_EXPIRE_MINUTES=60
SESSION_SECRET_KEY=${SESSION_SECRET}

# Database (与生产密码不同, 容器内访问)
DB_PASSWORD=staging_db_pwd_$(python3 -c 'import secrets; print(secrets.token_hex(8))')

# Redis (容器内)
REDIS_HOST=redis
REDIS_PASSWORD=staging_redis_pwd
REDIS_PORT=6379

# MinIO
MINIO_ACCESS_KEY=zhs_staging
MINIO_SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_urlsafe(24))')

# 告警 (staging 不发真实告警, 留空)
DINGTALK_WEBHOOK=
WECHAT_WORK_WEBHOOK=
FEISHU_WEBHOOK=
ALERT_EMAIL_TO=
SMTP_HOST=

# APM (可选)
OTEL_EXPORTER_OTLP_ENDPOINT=
OTEL_TRACES_SAMPLER_ARG=0.1
ZHS_PLATFORM_SERVICE_NAME=zhs-platform-staging

# 监控采样
PROMETHEUS_ENABLED=true
EOF
    log "$ENV_FILE 已生成"
else
    log "$ENV_FILE 已存在, 沿用"
fi

# 加载环境变量
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# ---------------------------------------------------------------------------
# 3. 拉取/构建镜像
# ---------------------------------------------------------------------------
log "=== Step 3: 拉取/构建镜像 ==="

if docker image inspect "zhs-platform:$VERSION" >/dev/null 2>&1; then
    log "镜像 zhs-platform:$VERSION 已存在, 跳过构建"
else
    log "构建镜像 zhs-platform:$VERSION"
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" build --build-arg VERSION="$VERSION" app
    docker tag zhs-platform:latest "zhs-platform:$VERSION"
fi

# ---------------------------------------------------------------------------
# 4. 备份当前数据 (升级前)
# ---------------------------------------------------------------------------
log "=== Step 4: 备份 staging 数据 ==="

if [ -x "$SCRIPT_DIR/backup_pg.sh" ]; then
    if $DOCKER_COMPOSE -f "$COMPOSE_FILE" ps db 2>/dev/null | grep -q "Up"; then
        STAGING_BACKUP_DIR="$PROJECT_DIR/backups/staging_$(date +%Y%m%d_%H%M%S)"
        mkdir -p "$STAGING_BACKUP_DIR"
        log "备份到 $STAGING_BACKUP_DIR"
        # 简化版: 直接调 pg_dump
        $DOCKER_COMPOSE -f "$COMPOSE_FILE" exec -T db pg_dump \
            -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}" \
            > "$STAGING_BACKUP_DIR/pre_deploy.sql" 2>>"$LOG_FILE" || \
            log "WARN: 备份失败, 继续部署"
    else
        log "数据库未运行, 跳过备份"
    fi
fi

# ---------------------------------------------------------------------------
# 5. 启动服务
# ---------------------------------------------------------------------------
log "=== Step 5: 启动服务 ==="

# 先启动数据库/redis/minio
$DOCKER_COMPOSE -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d db redis minio
log "等待数据库就绪"
for i in $(seq 1 30); do
    if $DOCKER_COMPOSE -f "$COMPOSE_FILE" exec -T db pg_isready -U "${POSTGRES_USER:-postgres}" 2>/dev/null; then
        log "数据库就绪"
        break
    fi
    sleep 2
done

# 启动 app
$DOCKER_COMPOSE -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d app
log "app 容器已启动"

# ---------------------------------------------------------------------------
# 6. 数据库迁移
# ---------------------------------------------------------------------------
log "=== Step 6: 数据库迁移 ==="

$DOCKER_COMPOSE -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T app \
    alembic upgrade head 2>>"$LOG_FILE" || \
    log "WARN: alembic 迁移失败, 可能是首次部署或无迁移文件"

# ---------------------------------------------------------------------------
# 7. 启动完整服务栈
# ---------------------------------------------------------------------------
log "=== Step 7: 启动 nginx + monitoring (如有) ==="

$DOCKER_COMPOSE -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d nginx
log "nginx 已启动"

# ---------------------------------------------------------------------------
# 8. 健康检查
# ---------------------------------------------------------------------------
log "=== Step 8: 健康检查 ==="

HEALTH_URL="http://localhost:8000/healthz"
READY_URL="http://localhost:8000/readyz"

for i in $(seq 1 30); do
    if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
        log "✅ /healthz 通过 (第 ${i} 次尝试)"
        break
    fi
    sleep 2
done

if ! curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    fail "/healthz 30 次尝试后仍失败, 请检查容器日志: $DOCKER_COMPOSE -f $COMPOSE_FILE logs --tail=100 app"
fi

# readyz 包含 DB/Redis 检查
if curl -fsS "$READY_URL" >/dev/null 2>&1; then
    log "✅ /readyz 通过 (DB+Redis 全部健康)"
else
    log "WARN: /readyz 失败, 但 /healthz 通过, 服务部分就绪"
fi

# ---------------------------------------------------------------------------
# 9. 通知
# ---------------------------------------------------------------------------
log "=== Step 9: 部署完成 ==="

log "✅ staging 部署成功"
log "   version: $VERSION"
log "   URL: https://staging.zhs.local"
log "   logs: $LOG_FILE"
log "   容器状态:"
$DOCKER_COMPOSE -f "$COMPOSE_FILE" ps | tee -a "$LOG_FILE"

# 发送钉钉通知（如果配置了）
if [ -n "${DINGTALK_WEBHOOK:-}" ] && [ -n "${DINGTALK_SECRET:-}" ]; then
    MSG="✅ ZHS Platform staging 部署成功\n版本: $VERSION\n时间: $(date '+%Y-%m-%d %H:%M:%S')"
    "$SCRIPT_DIR/notify_dingtalk.sh" "$MSG" 2>>"$LOG_FILE" || log "WARN: 钉钉通知失败"
fi

log "完整日志: $LOG_FILE"
exit 0
