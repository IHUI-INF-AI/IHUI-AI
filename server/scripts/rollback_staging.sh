#!/usr/bin/env bash
# 回滚 staging 部署到上一版本
# 用法: ./scripts/rollback_staging.sh [steps]
#   steps: 回滚几次部署 (默认 1, 即上一个版本)
#
# 流程:
#   1. 查找上一个成功部署的镜像 tag
#   2. 停止当前 app
#   3. 启动上一个版本镜像
#   4. 健康检查
#   5. 通知

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

STEPS="${1:-1}"
ENV_FILE=".env.staging"
COMPOSE_FILE="deploy/docker/docker-compose.yml"
LOG_FILE="$PROJECT_DIR/logs/rollback_$(date +%Y%m%d_%H%M%S).log"

mkdir -p "$PROJECT_DIR/logs"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

DOCKER_COMPOSE="docker compose"
if ! docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE="docker-compose"
fi

# 加载 env
if [ -f "$ENV_FILE" ]; then
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
fi

# ---------------------------------------------------------------------------
# 查找上一个镜像 tag
# ---------------------------------------------------------------------------
log "=== 查找最近 $STEPS 个部署版本 ==="

# 优先从 git tags 找
AVAILABLE_TAGS=$(git tag --sort=-creatordate 2>/dev/null | grep -E "^staging-" | head -n "$STEPS" || true)

# 退而求其次: 找本地镜像
if [ -z "$AVAILABLE_TAGS" ]; then
    AVAILABLE_TAGS=$(docker images --format "{{.Tag}}" zhs-platform | grep -v "latest" | grep -v "<none>" | head -n "$STEPS" || true)
fi

if [ -z "$AVAILABLE_TAGS" ]; then
    log "ERROR: 找不到历史镜像可回滚"
    exit 1
fi

PREV_TAG=$(echo "$AVAILABLE_TAGS" | sed -n "${STEPS}p")
if [ -z "$PREV_TAG" ]; then
    PREV_TAG=$(echo "$AVAILABLE_TAGS" | head -1)
fi

log "将回滚到: $PREV_TAG"

# ---------------------------------------------------------------------------
# 备份当前数据库（回滚前）
# ---------------------------------------------------------------------------
log "=== 备份当前数据 ==="
STAGING_BACKUP_DIR="$PROJECT_DIR/backups/rollback_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$STAGING_BACKUP_DIR"
if $DOCKER_COMPOSE -f "$COMPOSE_FILE" ps db 2>/dev/null | grep -q "Up"; then
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" exec -T db pg_dump \
        -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}" \
        > "$STAGING_BACKUP_DIR/before_rollback.sql" 2>>"$LOG_FILE" || \
        log "WARN: 备份失败"
fi

# ---------------------------------------------------------------------------
# 回滚
# ---------------------------------------------------------------------------
log "=== 执行回滚 ==="

# 停止 app
$DOCKER_COMPOSE -f "$COMPOSE_FILE" --env-file "$ENV_FILE" stop app

# 拉起历史版本
if ! docker image inspect "zhs-platform:$PREV_TAG" >/dev/null 2>&1; then
    log "镜像 zhs-platform:$PREV_TAG 不存在, 尝试 pull"
    docker pull "zhs-platform:$PREV_TAG" 2>>"$LOG_FILE" || {
        log "ERROR: 无法拉取镜像 $PREV_TAG"
        exit 1
    }
fi

# 修改 compose 用历史镜像启动
export IMAGE_TAG="$PREV_TAG"
$DOCKER_COMPOSE -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d app

log "app 已用 $PREV_TAG 启动"

# ---------------------------------------------------------------------------
# 健康检查
# ---------------------------------------------------------------------------
log "=== 健康检查 ==="
for i in $(seq 1 30); do
    if curl -fsS "http://localhost:8000/healthz" >/dev/null 2>&1; then
        log "✅ /healthz 通过 (第 ${i} 次尝试)"
        break
    fi
    sleep 2
done

if ! curl -fsS "http://localhost:8000/healthz" >/dev/null 2>&1; then
    log "ERROR: 回滚后 /healthz 仍失败, 请检查日志"
    $DOCKER_COMPOSE -f "$COMPOSE_FILE" logs --tail=100 app | tee -a "$LOG_FILE"
    exit 1
fi

log "✅ 回滚成功: 当前版本 $PREV_TAG"
log "   数据库备份: $STAGING_BACKUP_DIR/before_rollback.sql"
log "   完整日志: $LOG_FILE"

# 钉钉通知
if [ -n "${DINGTALK_WEBHOOK:-}" ] && [ -n "${DINGTALK_SECRET:-}" ]; then
    MSG="⚠️ ZHS Platform staging 回滚到 $PREV_TAG\n时间: $(date '+%Y-%m-%d %H:%M:%S')"
    "$SCRIPT_DIR/notify_dingtalk.sh" "$MSG" 2>>"$LOG_FILE" || true
fi
