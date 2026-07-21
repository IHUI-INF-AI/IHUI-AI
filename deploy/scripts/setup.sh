#!/bin/bash
set -euo pipefail

# ============================================================
# IHUI-AI 首次部署脚本 (2026-07-21 立)
# ------------------------------------------------------------
# 一键执行:拉代码 + 装依赖 + 数据库迁移 + build + 启动 + Nginx 配置 + SSL
#
# 用法:
#   sudo ./deploy/scripts/setup.sh
#
# 前置条件(用户必须先做):
#   1. DNS 解析:加 @ 和 bsm 两条 A 记录指向本服务器 IP
#   2. 飞书后台「安全设置 → 重定向 URL」加 https://bsm.aizhs.top/callback?platform=feishu
#   3. 飞书后台「应用功能 → 网页」开关打开 + 发布应用版本
#   4. 其他第三方后台(微信/钉钉/GitHub/Google 等)加对应 redirect_uri
#
# 本脚本会做的事:
#   1. 拉代码 + 装依赖
#   2. 检查 .env.production(根目录)和 apps/web/.env.production 是否存在
#   3. 数据库迁移
#   4. build 前端(读取 apps/web/.env.production 静态注入)
#   5. build 后端
#   6. 启动 web + api(pm2 守护)
#   7. 部署 Nginx 配置(主域 + bsm 子域)
#   8. 申请 SSL 证书(certbot)
#   9. 健康检查 + 验证清单
# ============================================================

# ── 常量 ──
REPO_DIR="/opt/ihui"
LOG_FILE="/var/log/ihui-setup.log"
SSL_DOMAINS=("aizhs.top" "www.aizhs.top" "bsm.aizhs.top")

# ── 工具函数 ──
log() {
  local level=$1; shift
  local ts; ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  echo "[${ts}] [${level}] $*" | tee -a "${LOG_FILE}" >&2
}

die() { log ERROR "$*"; exit 1; }

step() { log INFO "▶ $*"; }

# ── 1. 前置检查 ──
preflight() {
  step "前置检查"

  [[ $EUID -eq 0 ]] || die "需要 root 权限,请用 sudo 执行"

  command -v git >/dev/null || die "未安装 git"
  command -v node >/dev/null || die "未安装 Node.js (需要 20+)"
  command -v pnpm >/dev/null || die "未安装 pnpm"
  command -v nginx >/dev/null || die "未安装 nginx"
  command -v certbot >/dev/null || die "未安装 certbot (sudo apt install certbot python3-certbot-nginx)"
  command -v psql >/dev/null || die "未安装 PostgreSQL 客户端"
  command -v pm2 >/dev/null || npm install -g pm2 || die "pm2 安装失败"

  [[ -d "${REPO_DIR}/.git" ]] || die "代码仓库不存在: ${REPO_DIR} (git clone 到此路径后再跑本脚本)"
  [[ -f "${REPO_DIR}/.env.production" ]] || die "缺少 ${REPO_DIR}/.env.production (复制 .env.production.example 填真实值)"
  [[ -f "${REPO_DIR}/apps/web/.env.production" ]] || die "缺少 ${REPO_DIR}/apps/web/.env.production (复制 apps/web/.env.production.example 填真实值)"

  log INFO "前置检查通过"
}

# ── 2. 拉代码 + 装依赖 ──
pull_and_install() {
  step "拉代码 + 装依赖"
  cd "${REPO_DIR}"
  git pull origin main
  pnpm install --frozen-lockfile
  log INFO "依赖安装完成"
}

# ── 3. 数据库迁移 ──
db_migrate() {
  step "数据库迁移"
  cd "${REPO_DIR}"
  pnpm --filter @ihui/api db:migrate
  log INFO "数据库迁移完成"
}

# ── 4. build 前端 + 后端 ──
build_all() {
  step "build 前端(读取 apps/web/.env.production 静态注入)"
  cd "${REPO_DIR}"
  pnpm --filter @ihui/web build

  step "build 后端"
  pnpm --filter @ihui/api build
  log INFO "build 完成"
}

# ── 5. 启动服务(pm2 守护) ──
start_services() {
  step "启动 web + api (pm2)"
  cd "${REPO_DIR}"

  # 杀掉旧进程(如果存在)
  pm2 delete ihui-web 2>/dev/null || true
  pm2 delete ihui-api 2>/dev/null || true

  # 启动 web (Blue 环境,端口 3000)
  pm2 start --name ihui-web "pnpm --filter @ihui/web start" --env production
  # 启动 api (Blue 环境,端口 8080)
  pm2 start --name ihui-api "pnpm --filter @ihui/api start" --env production

  # 保存 pm2 进程列表(开机自启)
  pm2 save
  pm2 startup systemd -u root --hp /root

  log INFO "服务已启动,等待 10s 稳定..."
  sleep 10

  # 健康检查
  curl -sf http://127.0.0.1:3000/ >/dev/null || die "web 服务启动失败 (3000)"
  curl -sf http://127.0.0.1:8080/api/health >/dev/null || die "api 服务启动失败 (8080)"
  log INFO "服务健康检查通过"
}

# ── 6. 部署 Nginx 配置 ──
deploy_nginx() {
  step "部署 Nginx 配置(主域 + bsm 子域)"
  cd "${REPO_DIR}"

  # 备份现有配置
  local ts; ts=$(date +%s)
  cp /etc/nginx/conf.d/nginx-blue-green.conf "/tmp/nginx-blue-green.conf.bak-${ts}" 2>/dev/null || true

  # 复制主域蓝绿配置
  cp deploy/nginx/nginx-blue-green.conf /etc/nginx/conf.d/

  # 复制 bsm 子域配置(2026-07-21 立)
  cp deploy/nginx/conf.d/bsm-subdomain.conf /etc/nginx/conf.d/

  # 复用现有 conf.d 配置(ssl-params / security-headers / rate-limit)
  cp deploy/nginx/conf.d/ssl-params.conf /etc/nginx/conf.d/ 2>/dev/null || true
  cp deploy/nginx/conf.d/security-headers.conf /etc/nginx/conf.d/ 2>/dev/null || true
  cp deploy/nginx/conf.d/rate-limit.conf /etc/nginx/conf.d/ 2>/dev/null || true

  # 验证配置
  nginx -t || die "nginx -t 验证失败,请检查 /etc/nginx/conf.d/*.conf"

  log INFO "Nginx 配置部署完成(尚未 reload,等 SSL 证书申请后再 reload)"
}

# ── 7. 申请 SSL 证书 ──
request_ssl() {
  step "申请 SSL 证书 (Let's Encrypt)"

  # 先临时启动 nginx 80 端口(用于 certbot http-01 校验)
  nginx -s reload 2>/dev/null || nginx

  # 申请证书(三个域名一起)
  certbot --nginx -n \
    --agree-tos \
    --register-unsafely-without-email \
    -d aizhs.top -d www.aizhs.top -d bsm.aizhs.top \
    --redirect

  log INFO "SSL 证书申请完成"
}

# ── 8. 最终 reload + 验证 ──
final_reload_and_verify() {
  step "最终 nginx reload + 验证"
  nginx -t || die "nginx -t 最终验证失败"
  nginx -s reload

  log INFO "等待 5s 让 nginx 稳定..."
  sleep 5

  echo ""
  echo "============================================================"
  echo "✅ IHUI-AI 生产环境部署完成!"
  echo "============================================================"
  echo ""
  echo "验证清单:"
  echo ""
  echo "1. 主域首页:"
  echo "   curl -I https://aizhs.top/"
  curl -sI https://aizhs.top/ | head -3 || log WARN "主域访问失败"
  echo ""
  echo "2. bsm 子域健康:"
  echo "   curl https://bsm.aizhs.top/nginx-health"
  curl -s https://bsm.aizhs.top/nginx-health || log WARN "子域访问失败"
  echo ""
  echo "3. API 健康:"
  echo "   curl https://aizhs.top/api/health"
  curl -s https://aizhs.top/api/health | head -100 || log WARN "API 访问失败"
  echo ""
  echo "4. 飞书 OAuth 跳转链路:"
  echo "   浏览器打开 https://aizhs.top → 点登录 → 点飞书登录 → 应跳到 accounts.feishu.cn 扫码页"
  echo ""
  echo "5. 飞书扫码:"
  echo "   手机飞书 App 扫码 → 授权 → 应跳回 https://aizhs.top 已登录"
  echo ""
  echo "============================================================"
  echo "下一步手动操作:"
  echo "1. 飞书后台「安全设置 → 重定向 URL」白名单加:"
  echo "   https://bsm.aizhs.top/callback?platform=feishu"
  echo "2. 飞书后台「应用功能 → 网页」开关打开"
  echo "3. 飞书后台「应用发布 → 版本管理与发布」创建版本 + 申请发布"
  echo "============================================================"
}

# ── 入口 ──
main() {
  mkdir -p "$(dirname "${LOG_FILE}")"
  log INFO "IHUI-AI 生产部署开始"

  preflight
  pull_and_install
  db_migrate
  build_all
  start_services
  deploy_nginx
  request_ssl
  final_reload_and_verify

  log INFO "部署全部完成"
}

main "$@"
