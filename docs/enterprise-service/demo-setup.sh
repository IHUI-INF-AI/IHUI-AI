#!/usr/bin/env bash
# IHUI-AI Demo 环境一键搭建脚本
# 适用: WSL / Linux / Mac(需 Docker + Docker Compose + Git + curl)
# 用法: bash demo-setup.sh [项目目录](默认 ./ihui-ai-demo)
set -euo pipefail

PROJECT_DIR="${1:-./ihui-ai-demo}"
REPO_URL="https://github.com/ihui-ai/ihui-ai.git"  # 占位,实际以销售提供的仓库地址为准
WEB_PORT="8801"
API_PORT="8802"
AI_PORT="8803"
HEALTH_WAIT=30

c_red()   { printf "\033[31m%s\033[0m\n" "$*"; }
c_green() { printf "\033[32m%s\033[0m\n" "$*"; }
c_yellow(){ printf "\033[33m%s\033[0m\n" "$*"; }
c_blue()  { printf "\033[36m%s\033[0m\n" "$*"; }

step() { c_blue "==> $*"; }
ok()   { c_green "  ✓ $*"; }
warn() { c_yellow "  ! $*"; }
die()  { c_red "  ✗ $*"; exit 1; }

echo ""
c_blue "============================================"
c_blue "  IHUI-AI Demo 环境一键搭建"
c_blue "============================================"
echo ""

# 1. 依赖检查
step "检查依赖"
command -v docker >/dev/null 2>&1 || die "未检测到 docker,请先安装 Docker: https://docs.docker.com/get-docker/"
command -v git >/dev/null 2>&1 || die "未检测到 git,请先安装 Git"
command -v curl >/dev/null 2>&1 || die "未检测到 curl,请先安装 curl"

if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  die "未检测到 Docker Compose,请安装 Docker Compose v2 或独立版本"
fi
ok "docker / git / curl / docker compose 就绪"

# 2. Docker 守护进程检查
step "检查 Docker 守护进程"
if ! docker info >/dev/null 2>&1; then
  die "Docker 守护进程未运行,请先启动 Docker(Windows/Mac 启动 Docker Desktop,Linux 执行 systemctl start docker)"
fi
ok "Docker 守护进程运行中"

# 3. 克隆项目
step "准备项目代码: ${PROJECT_DIR}"
if [ -d "${PROJECT_DIR}/.git" ]; then
  warn "目录已存在,执行 git pull 更新"
  git -C "${PROJECT_DIR}" pull --ff-only || warn "拉取失败,继续使用现有代码"
else
  git clone --depth 1 "${REPO_URL}" "${PROJECT_DIR}" || die "克隆失败,请确认仓库地址:${REPO_URL}"
  ok "项目已克隆到 ${PROJECT_DIR}"
fi
cd "${PROJECT_DIR}"

# 4. 环境变量配置
step "配置环境变量"
if [ -f ".env.example" ]; then
  if [ ! -f ".env" ]; then
    cp .env.example .env
    ok "已从 .env.example 创建 .env"
  else
    warn ".env 已存在,跳过创建(如需重置请先删除 .env)"
  fi
else
  warn "未找到 .env.example,跳过(请确认仓库完整性)"
fi

# 5. 启动服务
step "启动 Docker Compose 服务(首次会拉取镜像,请耐心等待)"
${COMPOSE} up -d
ok "容器已启动"

# 6. 等待健康检查
step "等待服务就绪(最多 ${HEALTH_WAIT}s)"
elapsed=0
healthy=false
while [ "${elapsed}" -lt "${HEALTH_WAIT}" ]; do
  sleep 1
  elapsed=$((elapsed + 1))
  printf "."
  if curl -sf "http://localhost:${WEB_PORT}" >/dev/null 2>&1; then
    healthy=true
    break
  fi
done
echo ""

if [ "${healthy}" = "true" ]; then
  ok "Web 服务健康检查通过(${elapsed}s)"
else
  warn "Web 服务在 ${HEALTH_WAIT}s 内未就绪,查看日志排查:"
  warn "  ${COMPOSE} logs --tail=50 web api ai-service"
fi

# 7. 输出访问信息
echo ""
c_green "============================================"
c_green "  IHUI-AI Demo 环境已启动"
c_green "============================================"
echo ""
echo "  访问地址:"
echo "    Web 应用:    http://localhost:${WEB_PORT}"
echo "    API 服务:    http://localhost:${API_PORT}/health"
echo "    AI Service:  http://localhost:${AI_PORT}/health"
echo ""
echo "  默认账号(如需): admin@aizhs.top / 123456(以 .env 中 DEFAULT_ADMIN 配置为准)"
echo ""
echo "  常用命令(在 ${PROJECT_DIR} 下执行):"
echo "    查看日志:  ${COMPOSE} logs -f"
echo "    停止服务:  ${COMPOSE} down"
echo "    重启服务:  ${COMPOSE} restart"
echo "    清理环境:  ${COMPOSE} down -v  (会删除数据卷)"
echo ""
c_blue "  销售联系: sales@aizhs.top"
echo ""
