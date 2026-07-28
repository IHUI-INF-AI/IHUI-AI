#!/usr/bin/env bash
# IHUI-AI 企业版 Demo 环境一键搭建脚本
# Idempotent: 可重复运行,第二次检测已存在则跳过
# 用法:
#   ./scripts/setup-enterprise-demo.sh                 # 启动 Demo
#   ./scripts/setup-enterprise-demo.sh --dry-run       # 仅打印计划,不执行
#   ./scripts/setup-enterprise-demo.sh --clean         # 停止 + 删除容器(保留镜像)
#   ./scripts/setup-enterprise-demo.sh --purge         # 彻底清理(含数据卷)
#   ./scripts/setup-enterprise-demo.sh --reset         # 重置数据库 + 重新初始化
#   ./scripts/setup-enterprise-demo.sh --stop         # 仅停止
#   ./scripts/setup-enterprise-demo.sh --status       # 查看状态
#   ./scripts/setup-enterprise-demo.sh --deploy k8s    # 一键部署到 K8s(可选)

set -eu

# ==================== 配置 ====================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.demo.yml"
ENV_FILE="$PROJECT_ROOT/.env"

WEB_PORT=8801
API_PORT=8802
AI_PORT=8803
GRAFANA_PORT=8816
POSTGRES_PORT=5432
REDIS_PORT=6379

PROJECT_NAME="ihui-enterprise-demo"
DEMO_NETWORK="${PROJECT_NAME}-net"
DEMO_VOLUME_DATA="${PROJECT_NAME}-data"
DEMO_VOLUME_LOGS="${PROJECT_NAME}-logs"

# ==================== 颜色输出 ====================
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[0;33m'
    BLUE='\033[0;34m'
    CYAN='\033[0;36m'
    BOLD='\033[1m'
    NC='\033[0m'
else
    RED=''; GREEN=''; YELLOW=''; BLUE=''; CYAN=''; BOLD=''; NC=''
fi

log()   { printf "${CYAN}[demo]${NC} %s\n" "$*"; }
info()  { printf "${BLUE}[info]${NC} %s\n" "$*"; }
warn()  { printf "${YELLOW}[warn]${NC} %s\n" "$*" >&2; }
err()   { printf "${RED}[err ]${NC} %s\n"  "$*" >&2; }
ok()    { printf "${GREEN}[ok  ]${NC} %s\n" "$*"; }
title() { printf "\n${BOLD}${BLUE}==> %s${NC}\n" "$*"; }

# ==================== 参数解析 ====================
DRY_RUN=0
ACTION="up"  # up | stop | clean | purge | reset | status

while [ $# -gt 0 ]; do
    case "$1" in
        --dry-run) DRY_RUN=1; shift ;;
        --clean)   ACTION="clean"; shift ;;
        --purge)   ACTION="purge"; shift ;;
        --reset)   ACTION="reset"; shift ;;
        --stop)    ACTION="stop"; shift ;;
        --status)  ACTION="status"; shift ;;
        --deploy)  ACTION="deploy"; DEPLOY_TARGET="${2:-k8s}"; shift 2 ;;
        -h|--help)
            sed -n '2,15p' "$0"
            exit 0
            ;;
        *)
            err "未知参数: $1"
            err "使用 --help 查看用法"
            exit 1
            ;;
    esac
done

# ==================== 工具函数 ====================

# 在 dry-run 模式下,用 echo 代替实际执行
run() {
    if [ "$DRY_RUN" -eq 1 ]; then
        info "[DRY-RUN] $*"
    else
        "$@"
    fi
}

# 检测命令是否存在
require_cmd() {
    if ! command -v "$1" >/dev/null 2>&1; then
        err "缺少必要命令: $1"
        err "请先安装 $1 后重试"
        return 1
    fi
}

# 检测端口是否被占用
check_port() {
    local port=$1
    local service=$2
    if command -v ss >/dev/null 2>&1; then
        if ss -ltn "sport = :$port" 2>/dev/null | grep -q LISTEN; then
            warn "端口 $port 已被占用($service 可能受影响)"
            return 1
        fi
    elif command -v lsof >/dev/null 2>&1; then
        if lsof -i ":$port" >/dev/null 2>&1; then
            warn "端口 $port 已被占用($service 可能受影响)"
            return 1
        fi
    else
        info "未检测到 ss/lsof,跳过端口检查"
    fi
    return 0
}

# 等待服务健康
wait_healthy() {
    local service=$1
    local max_wait=${2:-120}
    local waited=0
    log "等待 $service 健康检查通过(最多 ${max_wait}s)..."
    while [ $waited -lt $max_wait ]; do
        if [ "$DRY_RUN" -eq 1 ]; then
            info "[DRY-RUN] 跳过健康检查"
            return 0
        fi
        local state
        state=$(docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" ps --format json "$service" 2>/dev/null | grep -o '"Health":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "unknown")
        if [ "$state" = "healthy" ]; then
            ok "$service 已就绪"
            return 0
        fi
        sleep 2
        waited=$((waited + 2))
        printf "."
    done
    printf "\n"
    warn "$service 健康检查超时($max_wait 秒),但将继续后续步骤"
    return 1
}

# 检测 Docker Compose 文件是否已存在(用于幂等性)
ensure_compose_file() {
    if [ -f "$COMPOSE_FILE" ] && [ "$DRY_RUN" -eq 0 ]; then
        info "检测到已存在的 $COMPOSE_FILE,使用现有配置"
        return 0
    fi
    if [ ! -f "$COMPOSE_FILE" ] && [ "$DRY_RUN" -eq 0 ]; then
        # 项目根目录没有 docker-compose.demo.yml,从模板生成一份最小可用的
        log "生成 $COMPOSE_FILE(Demo 模式)"
        cat > "$COMPOSE_FILE" <<'EOF'
name: ihui-enterprise-demo

services:
  postgres:
    image: postgres:15-alpine
    container_name: ihui-demo-postgres
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-ihui}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-demo_pass_2026}
      POSTGRES_DB: ${POSTGRES_DB:-ihui_demo}
    ports:
      - "5432:5432"
    volumes:
      - ihui-demo-pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-ihui}"]
      interval: 5s
      timeout: 3s
      retries: 10
    networks: [demo]

  redis:
    image: redis:7-alpine
    container_name: ihui-demo-redis
    command: ["redis-server", "--requirepass", "${REDIS_PASSWORD:-demo_redis_2026}"]
    ports:
      - "6379:6379"
    volumes:
      - ihui-demo-redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD:-demo_redis_2026}", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10
    networks: [demo]

  api:
    image: registry.cn-hangzhou.aliyuncs.com/ihui/api:1.0.0-demo
    container_name: ihui-demo-api
    depends_on:
      postgres: { condition: service_healthy }
      redis:    { condition: service_healthy }
    environment:
      NODE_ENV: demo
      DATABASE_URL: postgresql://${POSTGRES_USER:-ihui}:${POSTGRES_PASSWORD:-demo_pass_2026}@postgres:5432/${POSTGRES_DB:-ihui_demo}
      REDIS_URL: redis://:${REDIS_PASSWORD:-demo_redis_2026}@redis:6379
      JWT_SECRET: ${JWT_SECRET:-demo_jwt_secret_32_chars_random}
      LLM_PROVIDER: mock
      WEB_PORT: "8801"
    ports:
      - "8802:8802"
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:8802/health"]
      interval: 10s
      timeout: 5s
      retries: 6
    networks: [demo]

  web:
    image: registry.cn-hangzhou.aliyuncs.com/ihui/web:1.0.0-demo
    container_name: ihui-demo-web
    depends_on:
      api: { condition: service_healthy }
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8802
    ports:
      - "8801:8801"
    networks: [demo]

  ai-service:
    image: registry.cn-hangzhou.aliyuncs.com/ihui/ai-service:1.0.0-demo
    container_name: ihui-demo-ai-service
    depends_on:
      postgres: { condition: service_healthy }
      redis:    { condition: service_healthy }
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER:-ihui}:${POSTGRES_PASSWORD:-demo_pass_2026}@postgres:5432/${POSTGRES_DB:-ihui_demo}
      REDIS_URL: redis://:${REDIS_PASSWORD:-demo_redis_2026}@redis:6379
      LLM_PROVIDER: mock
    ports:
      - "8803:8803"
    networks: [demo]

  grafana:
    image: grafana/grafana:latest
    container_name: ihui-demo-grafana
    depends_on:
      - api
    environment:
      GF_SECURITY_ADMIN_USER: admin
      GF_SECURITY_ADMIN_PASSWORD: admin
    ports:
      - "8816:3000"
    networks: [demo]

volumes:
  ihui-demo-pgdata:
  ihui-demo-redisdata:

networks:
  demo:
    name: ihui-enterprise-demo-net
EOF
    fi
}

# 准备 .env 文件
ensure_env() {
    if [ -f "$ENV_FILE" ] && [ "$DRY_RUN" -eq 0 ]; then
        info "检测到已存在的 $ENV_FILE,使用现有配置"
        return 0
    fi
    if [ "$DRY_RUN" -eq 0 ] || [ ! -f "$ENV_FILE" ]; then
        log "生成 $ENV_FILE(Demo 模式默认配置)"
        if [ "$DRY_RUN" -eq 0 ]; then
            cat > "$ENV_FILE" <<EOF
# IHUI-AI Enterprise Demo Environment
# 此文件由 setup-enterprise-demo.sh 自动生成,生产环境请勿使用

POSTGRES_USER=ihui
POSTGRES_PASSWORD=demo_pass_2026
POSTGRES_DB=ihui_demo
REDIS_PASSWORD=demo_redis_2026
JWT_SECRET=demo_jwt_secret_32_chars_random_$(date +%s)
NODE_ENV=demo
LLM_PROVIDER=mock
EOF
        else
            info "[DRY-RUN] 将创建 $ENV_FILE"
        fi
    fi
}

# ==================== 主流程 ====================

title "IHUI-AI 企业版 Demo 环境管理"

case "$ACTION" in
    status)
        log "查看 Demo 环境状态"
        if ! command -v docker >/dev/null 2>&1; then
            err "Docker 未安装"
            exit 1
        fi
        if [ ! -f "$COMPOSE_FILE" ]; then
            warn "未找到 $COMPOSE_FILE,环境未初始化"
            exit 0
        fi
        run docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" ps
        exit 0
        ;;

    stop)
        title "停止 Demo 环境"
        require_cmd docker
        if [ ! -f "$COMPOSE_FILE" ]; then
            warn "未找到 $COMPOSE_FILE,无需停止"
            exit 0
        fi
        run docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" stop
        ok "Demo 环境已停止"
        info "数据卷保留,可使用 ./scripts/setup-enterprise-demo.sh(无参数)重启"
        exit 0
        ;;

    clean)
        title "清理 Demo 环境(保留镜像和数据卷)"
        require_cmd docker
        if [ ! -f "$COMPOSE_FILE" ]; then
            warn "未找到 $COMPOSE_FILE,无需清理"
            exit 0
        fi
        run docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down
        ok "容器已删除,镜像和数据卷保留"
        exit 0
        ;;

    purge)
        title "彻底清理 Demo 环境(含数据卷)"
        require_cmd docker
        if [ ! -f "$COMPOSE_FILE" ]; then
            warn "未找到 $COMPOSE_FILE,无需清理"
        else
            run docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" down -v
        fi
        run docker volume rm "${PROJECT_NAME}_ihui-demo-pgdata" "${PROJECT_NAME}_ihui-demo-redisdata" 2>/dev/null || true
        run rm -f "$ENV_FILE"
        ok "已彻底清理 Demo 环境"
        exit 0
        ;;

    reset)
        title "重置数据库(保留容器)"
        require_cmd docker
        if [ "$DRY_RUN" -eq 0 ]; then
            if ! docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" ps postgres 2>/dev/null | grep -q "Up"; then
                err "Postgres 容器未运行,请先启动 Demo 环境"
                exit 1
            fi
        fi
        run docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" exec -T postgres \
            psql -U ihui -d ihui_demo -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
        run docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" exec -T api pnpm db:migrate
        run docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" exec -T api pnpm db:seed:demo
        ok "数据库已重置 + 重新初始化"
        exit 0
        ;;

    deploy)
        title "一键部署到 $DEPLOY_TARGET"
        warn "该功能为预告接口,实际部署请参考 docs/enterprise-service/deployment-guide.md"
        info "  私有云 Helm: helm install ihui charts/ihui-enterprise -f values.yaml"
        info "  公有云 Terraform: terraform apply"
        info "  混合云: 配置 VPC Peering 后分别部署核心 + 推理"
        exit 0
        ;;

    up|"")
        title "启动 IHUI-AI 企业版 Demo 环境"
        ;;

    *)
        err "未知动作: $ACTION"
        exit 1
        ;;
esac

# ==================== 启动流程 ====================

title "环境自检"
require_cmd docker
if ! docker compose version >/dev/null 2>&1; then
    err "需要 Docker Compose v2+,请升级 Docker Desktop / docker-compose-plugin"
    exit 1
fi
ok "Docker 与 Docker Compose 已就绪"

title "端口检查"
check_port "$WEB_PORT"      "Web"      || true
check_port "$API_PORT"      "API"      || true
check_port "$AI_PORT"       "AI-Service" || true
check_port "$GRAFANA_PORT"  "Grafana"  || true
check_port "$POSTGRES_PORT" "Postgres" || true
check_port "$REDIS_PORT"    "Redis"    || true
ok "端口检查完成(警告可忽略,后续启动若失败会再报错)"

title "准备配置文件"
ensure_env
ensure_compose_file
ok "配置文件就绪"

title "拉取 Docker 镜像"
run docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" pull
ok "镜像拉取完成"

title "启动服务"
run docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" up -d
ok "所有服务已启动"

title "健康检查"
wait_healthy "postgres" 60
wait_healthy "redis" 60
wait_healthy "api" 120
wait_healthy "web" 60
wait_healthy "ai-service" 60
ok "健康检查通过"

title "数据库初始化"
run docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" exec -T api pnpm db:migrate
ok "数据库迁移完成"
run docker compose -f "$COMPOSE_FILE" -p "$PROJECT_NAME" exec -T api pnpm db:seed:demo
ok "种子数据导入完成"

# ==================== 输出访问信息 ====================

cat <<EOF

${BOLD}${GREEN}========================================${NC}
${BOLD}${GREEN}  IHUI-AI 企业版 Demo 启动成功!${NC}
${BOLD}${GREEN}========================================${NC}

${BOLD}访问入口:${NC}
  Web 前端:       ${CYAN}http://localhost:${WEB_PORT}${NC}
  API 文档:       ${CYAN}http://localhost:${API_PORT}/docs${NC}
  AI Service:     ${CYAN}http://localhost:${AI_PORT}/docs${NC}
  Grafana 监控:   ${CYAN}http://localhost:${GRAFANA_PORT}${NC}  (admin / admin)

${BOLD}默认账号:${NC}
  管理员: ${CYAN}admin@demo.ihui-ai.com${NC} / ${CYAN}Demo@2026${NC}
  测试用户 5 个(同密码):
    alice@demo.ihui-ai.com  (创作者)
    bob@demo.ihui-ai.com    (消费者)
    carol@demo.ihui-ai.com  (部门管理员)
    david@demo.ihui-ai.com  (审计员)
    eve@demo.ihui-ai.com    (财务)

${BOLD}常用命令:${NC}
  查看日志:   ${CYAN}docker compose -f ${COMPOSE_FILE} -p ${PROJECT_NAME} logs -f${NC}
  停止:       ${CYAN}./scripts/setup-enterprise-demo.sh --stop${NC}
  重置数据:   ${CYAN}./scripts/setup-enterprise-demo.sh --reset${NC}
  清理容器:   ${CYAN}./scripts/setup-enterprise-demo.sh --clean${NC}
  彻底清理:   ${CYAN}./scripts/setup-enterprise-demo.sh --purge${NC}

${YELLOW}⚠  演示环境仅用于演示,严禁用于生产!${NC}

EOF

title "完成"
exit 0
