#!/usr/bin/env bash
# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# =============================================================================
# IHUI-AI 一键部署脚本(Linux / macOS)
# =============================================================================
# 用法:在项目根目录执行
#   sudo chmod +x deploy/prod-bundle/deploy.sh
#   sudo ./deploy/prod-bundle/deploy.sh
#
# 完整流程同 deploy.ps1
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

# ── P2-13 部署诊断采集库(必须在 step/ok/warn/err 定义之前 source:那几个函数会调它)──
# 库自身所有函数一律不让部署挂掉(见其头注释「默认零行为变化」),因此 set -e 下可安全 source。
# shellcheck source=deploy-diagnose.sh
if [[ -f "$SCRIPT_DIR/deploy-diagnose.sh" ]]; then
    # shellcheck disable=SC1091
    source "$SCRIPT_DIR/deploy-diagnose.sh"
else
    # 摘线保护:库不在了也要跑得动部署,给一堆空函数而不是 exit。
    ihui_diag_log()     { :; }
    ihui_diag_capture() { "$@"; }
    ihui_diag_result()  { :; }
    ihui_diag_container_logs() { :; }
    ihui_diag_health_json()    { :; }
    ihui_diag_run()     { echo "[diag][WARN] 缺 deploy-diagnose.sh,诊断未执行" >&2; }
    ihui_diag_init()    { echo "[diag][WARN] 缺 deploy-diagnose.sh,本轮不落盘" >&2; }
fi
# 日志与结果落进 bundle 自己的 logs/ —— 不写死盘符,全部由 SCRIPT_DIR 推导(§15b)。
ihui_diag_init "$SCRIPT_DIR" "compose"


SKIP_BUILD=false
SKIP_CLOUDFLARED=false
FORCE_REGEN=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --skip-build)       SKIP_BUILD=true; shift ;;
        --skip-cloudflared) SKIP_CLOUDFLARED=true; shift ;;
        --force-regen)      FORCE_REGEN=true; shift ;;
        *) echo "[ERROR] 未知参数: $1"; exit 1 ;;
    esac
done

step() { echo ""; echo "========== $1 =========="; ihui_diag_log "STEP $1"; }
ok()   { echo "[OK] $1"; ihui_diag_log "[OK] $1"; }
warn() { echo "[WARN] $1" >&2; ihui_diag_log "[WARN] $1"; }
err()  { echo "[ERROR] $1" >&2; ihui_diag_log "[ERROR] $1"; }

# ==================== 1. 前置依赖检查 ====================
step "步骤 1/9:前置依赖检查"

if ! command -v git >/dev/null 2>&1; then
    err "Git 未安装。apt install -y git  或  https://git-scm.com/download"
    exit 1
fi
ok "Git: $(git --version)"

if ! command -v docker >/dev/null 2>&1; then
    err "Docker 未安装。curl -fsSL https://get.docker.com | sh"
    exit 1
fi
if ! docker info >/dev/null 2>&1; then
    err "Docker daemon 未运行。systemctl start docker  或加入 docker 组后重新登录"
    exit 1
fi
ok "Docker: $(docker version --format '{{.Server.Version}}')"

if ! docker compose version >/dev/null 2>&1; then
    err "Docker Compose 未安装。apt install -y docker-compose-plugin"
    exit 1
fi
ok "Docker Compose: $(docker compose version)"

# ==================== 2. 生成 .env.production ====================
step "步骤 2/9:生成 .env.production"

ENV_FILE="$PROJECT_ROOT/.env.production"
TEMPLATE_FILE="$PROJECT_ROOT/deploy/prod-bundle/.env.production.template"
SECRETS_FILE="$PROJECT_ROOT/.env.secrets.from-dev"

if [[ ! -f "$ENV_FILE" ]] || [[ "$FORCE_REGEN" == "true" ]]; then
    if [[ -f "$ENV_FILE" ]]; then
        warn ".env.production 已存在,--force-regen 强制重新生成"
        rm -f "$ENV_FILE"
    fi
    if [[ ! -f "$TEMPLATE_FILE" ]]; then
        err "模板文件不存在: $TEMPLATE_FILE"
        exit 1
    fi
    chmod +x "$SCRIPT_DIR/gen-secrets.sh"
    "$SCRIPT_DIR/gen-secrets.sh"
    ok ".env.production 已生成"
else
    ok ".env.production 已存在,跳过生成(用 --force-regen 强制重生成)"
fi

# 自动从 TUNNEL_TOKEN.local.txt 填充 token(如果 .env.production 里是占位符)
TOKEN_FILE="$PROJECT_ROOT/deploy/prod-bundle/cloudflared/TUNNEL_TOKEN.local.txt"
if [[ -f "$TOKEN_FILE" ]]; then
    if grep -q "TUNNEL_TOKEN=<PASTE-YOUR-TUNNEL-TOKEN-HERE>" "$ENV_FILE"; then
        REAL_TOKEN=$(cat "$TOKEN_FILE" | tr -d '[:space:]')
        if [[ -n "$REAL_TOKEN" ]] && [[ "$REAL_TOKEN" == eyJ* ]]; then
            sed -i "s|TUNNEL_TOKEN=<PASTE-YOUR-TUNNEL-TOKEN-HERE>|TUNNEL_TOKEN=${REAL_TOKEN}|g" "$ENV_FILE"
            ok "已从 TUNNEL_TOKEN.local.txt 自动填充 token"
        fi
    fi
fi

# 校验 .env.production 必填字段非占位符
if grep -E "^(DB_PASSWORD|REDIS_PASSWORD|JWT_SECRET|CREDENTIALS_ENCRYPTION_KEY|AI_CALLBACK_SECRET|TUNNEL_TOKEN)=<(AUTOGEN|COPY|PASTE)-[^>]+>" "$ENV_FILE"; then
    err "存在占位符,请填入真实值或重新跑 gen-secrets.sh"
    exit 1
fi

# ==================== 2.5 生成 apps/web/.env.production(下载页配置) ====================
# NEXT_PUBLIC_* 在 Next.js build 时静态编译进产物(Dockerfile.web COPY . . 带入),
# 但该文件被 .gitignore 忽略,需在部署机生成。仅含非敏感下载配置。
step "步骤 2.5/9:生成 apps/web/.env.production(自托管下载页)"
WEB_ENV_FILE="$PROJECT_ROOT/apps/web/.env.production"
mkdir -p "$(dirname "$WEB_ENV_FILE")"
if [[ ! -f "$WEB_ENV_FILE" ]] || [[ "$FORCE_REGEN" == "true" ]]; then
    cat > "$WEB_ENV_FILE" << 'WEBENV'
# ===== 下载页配置(2026-08-17 部署机自动生成,自托管分发不上架)=====
# Android APK:同源相对路径(public/apk/ihui-ai-latest.apk),经 aizhs.top 域名直链下载
NEXT_PUBLIC_DOWNLOAD_APK_URL=/apk/ihui-ai-latest.apk
NEXT_PUBLIC_DOWNLOAD_APK_VERSION=1.0.0
NEXT_PUBLIC_DOWNLOAD_APK_RELEASE_DATE=2026-08-17
WEBENV
    ok "apps/web/.env.production 已生成(APK 下载配置)"
else
    ok "apps/web/.env.production 已存在,跳过"
fi

# ==================== 3. 合并用户从开发机拷贝的密钥 ====================
step "步骤 3/9:合并开发机密钥(如有)"

if [[ -f "$SECRETS_FILE" ]]; then
    echo "检测到 .env.secrets.from-dev,合并到 .env.production..."
    # 用 awk 合并:开发机文件的 key 覆盖 .env.production 的同名 key
    awk -F= '
        NR==FNR {
            if ($0 ~ /^[[:space:]]*[A-Z_][A-Z0-9_]*[[:space:]]*=/) {
                key=$1; gsub(/[[:space:]]/, "", key);
                val=substr($0, index($0,"=")+1);
                secrets[key]=val;
            }
            next
        }
        {
            if ($0 ~ /^[[:space:]]*[A-Z_][A-Z0-9_]*[[:space:]]*=/) {
                key=$1; gsub(/[[:space:]]/, "", key);
                if (key in secrets) {
                    print key "=" secrets[key];
                    print "  覆盖 " key " (从 .env.secrets.from-dev)" > "/dev/stderr";
                } else {
                    print $0;
                }
            } else {
                print $0;
            }
        }
    ' "$SECRETS_FILE" "$ENV_FILE" > "$ENV_FILE.tmp" && mv "$ENV_FILE.tmp" "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    rm -f "$SECRETS_FILE"
    warn ".env.secrets.from-dev 已删除(避免泄露)"
    ok "开发机密钥已合并"
else
    echo "未检测到 .env.secrets.from-dev,跳过合并"
    echo "如需启用 AI 对话,请手动编辑 .env.production 填入 STEPFUN_API_KEY 等"
fi

# ==================== 4. 构建 Docker 镜像 ====================
step "步骤 4/9:构建 Docker 镜像(首次较慢,约 5-15 分钟)"

if [[ "$SKIP_BUILD" == "true" ]]; then
    warn "跳过 docker build(--skip-build)"
else
    echo "构建中...(Next.js build 需要 ~4GB 内存,请耐心等待)"
    if ! ihui_diag_capture docker compose build; then
        err "docker compose build 失败"
        err "常见原因:1) 内存不足(改 deploy/docker/Dockerfile.web NODE_OPTIONS=--max-old-space-size=4096)"
        err "         2) 网络问题(pnpm install 超时,设 HTTP_PROXY/HTTPS_PROXY)"
        err "         3) 磁盘空间不足(docker system prune -a 清理)"
        ihui_diag_result failed "build" "docker compose build 失败"
        ihui_diag_run "deploy.sh(compose 链)docker compose build 失败,已落部署日志"
        exit 1
    fi
    ok "Docker 镜像构建完成"
fi

# ==================== 5. 启动核心服务 ====================
step "步骤 5/9:启动核心服务"

if ! ihui_diag_capture docker compose up -d; then
    err "docker compose up 失败"
    err "查看日志:docker compose logs"
    ihui_diag_container_logs "compose up 失败后抓取"
    ihui_diag_result failed "up" "docker compose up -d 失败"
    ihui_diag_run "deploy.sh(compose 链)docker compose up -d 失败,日志已含容器输出"
    exit 1
fi
ok "docker compose up 命令已发出"

# ==================== 6. 等待服务健康 ====================
step "步骤 6/9:等待服务健康(最多 180 秒)"

MAX_WAIT=180
WAITED=0
HEALTHY=false
while [[ $WAITED -lt $MAX_WAIT ]]; do
    sleep 5
    WAITED=$((WAITED + 5))
    if docker compose ps --format json 2>/dev/null | jq -e '[.[] | select(.Service=="db" or .Service=="redis" or .Service=="api" or .Service=="ai-service" or .Service=="web") | select(.State != "running" or (.Health // "healthy") != "healthy")] | length == 0' >/dev/null 2>&1; then
        HEALTHY=true
        break
    fi
    echo "  已等待 ${WAITED}s / ${MAX_WAIT}s..."
done

if [[ "$HEALTHY" != "true" ]]; then
    warn "部分服务未在 ${MAX_WAIT}s 内健康,继续部署"
    echo "查看状态:docker compose ps"
    echo "查看日志:docker compose logs <service>"
    # 这是本链最需要诊断的一类失败:栈起来了但不健康,而此前没有任何输入被留下来。
    ihui_diag_container_logs "等待 ${MAX_WAIT}s 后仍不健康"
    ihui_diag_health_json "$SCRIPT_DIR/health-check.sh" "$SCRIPT_DIR/logs/health-check.json"
    ihui_diag_result failed "health" "部分服务未在 ${MAX_WAIT}s 内健康"
    ihui_diag_run "deploy.sh(compose 链)等待 ${MAX_WAIT}s 后容器仍未全部健康,已附容器日志与健康检查输出"
else
    ok "所有核心服务已健康"
fi

# ==================== 7. 启动 Cloudflare Tunnel ====================
step "步骤 7/9:启动 Cloudflare Tunnel(内网穿透)"

if [[ "$SKIP_CLOUDFLARED" == "true" ]]; then
    warn "跳过 cloudflared 启动(--skip-cloudflared)"
else
    CF_COMPOSE="$PROJECT_ROOT/deploy/prod-bundle/cloudflared/docker-compose.cloudflared.yml"
    if [[ -f "$CF_COMPOSE" ]]; then
        TUNNEL_TOKEN=$(grep -E "^TUNNEL_TOKEN=" "$ENV_FILE" | head -1 | cut -d= -f2-)
        if [[ -z "$TUNNEL_TOKEN" ]]; then
            err ".env.production 缺 TUNNEL_TOKEN,无法启动 cloudflared"
            ihui_diag_result failed "cloudflared" ".env.production 缺 TUNNEL_TOKEN"
        else
            export TUNNEL_TOKEN
            if ! ihui_diag_capture docker compose -f "$CF_COMPOSE" up -d; then
                err "cloudflared 启动失败"
                err "查看日志:docker compose -f $CF_COMPOSE logs cloudflared"
                ihui_diag_container_logs "cloudflared 启动失败后抓取" "$CF_COMPOSE"
                ihui_diag_result failed "cloudflared" "docker compose -f $CF_COMPOSE up -d 失败"
                ihui_diag_run "deploy.sh(compose 链)cloudflared 启动失败(第二 compose 栈),日志含该栈容器输出"
            else
                ok "cloudflared 已启动"
                echo "等待 10 秒让 tunnel 建立..."
                sleep 10
            fi
        fi
    else
        warn "$CF_COMPOSE 不存在,跳过容器化 cloudflared"
    fi
fi

# ==================== 8. 公网验证 ====================
step "步骤 8/9:公网验证 https://aizhs.top"

echo "[本地验证] curl http://localhost:8801/api/health ..."
if curl -sf --max-time 10 http://localhost:8801/api/health; then
    ok "API 健康"
else
    warn "API 健康检查失败(可能还在启动)"
fi

echo "[本地验证] curl http://localhost:8801/ai-service/health ..."
if curl -sf --max-time 10 http://localhost:8801/ai-service/health; then
    ok "AI Service 健康"
else
    warn "AI Service 健康检查失败(可能还在启动)"
fi

if [[ "$SKIP_CLOUDFLARED" != "true" ]]; then
    echo "[公网验证] curl -I https://aizhs.top/ ..."
    if curl -sI --max-time 30 https://aizhs.top/ | head -1; then
        ok "公网访问 aizhs.top 成功"
    else
        warn "公网访问失败,等 30 秒后重试..."
        sleep 30
        if curl -sI --max-time 30 https://aizhs.top/ | head -1; then
            ok "公网访问 aizhs.top(重试后)成功"
        else
            warn "公网访问仍失败,检查 cloudflared 日志: docker compose -f deploy/prod-bundle/cloudflared/docker-compose.cloudflared.yml logs"
        fi
    fi
fi

# ==================== 9. 部署报告 ====================
step "步骤 9/9:部署报告"

echo ""
echo "=========================================="
echo "  IHUI-AI 部署完成"
echo "=========================================="
echo ""
echo "本地访问:"
echo "  Web:        http://localhost:8801"
echo "  API:        http://localhost:8801/api/health"
echo "  AI Service: http://localhost:8801/ai-service/health"
echo ""
echo "公网访问(通过 Cloudflare Tunnel):"
echo "  主站:    https://aizhs.top"
echo "  登录:    https://bsm.aizhs.top/login"
echo ""
echo "管理员初始账号(仅未轮换时有效):"
echo "  用户名:  admin"
echo "  密码:    admin123"
echo "  说明:    这是 0067/0071 迁移种子的初始口令;一旦执行过 reset:admin-password"
echo "           轮换即失效,当前口令以归档文件 D:\DevEnv\secrets\admin-password.txt 为准"
echo ""
echo "常用运维命令:"
echo "  查看状态:  docker compose ps"
echo "  查看日志:  docker compose logs -f <service>"
echo "  重启服务:  docker compose restart <service>"
echo "  停止栈:    docker compose down"
echo "  启动栈:    docker compose up -d"
echo ""
echo "下一步:"
echo "  1. 跑健康检查: ./deploy/prod-bundle/health-check.sh"
echo "  2. 跑部署后清单: cat deploy/prod-bundle/POST-DEPLOY-CHECKLIST.md"
echo "  3. 首次登录后立即改密码,并把生效口令归档到 D:\DevEnv\secrets\admin-password.txt"
echo "     轮换命令: pnpm --filter @ihui/api reset:admin-password --account admin --password <新口令> --yes --force"
echo "     口令未归档 = 事故:下次无人能登录(2026-09-14 轮换后未留档,导致生产 admin 无人可用)"
echo "  4. (推荐)rotate Cloudflare Tunnel token"
echo ""
ihui_diag_result success "done" "deploy.sh(compose 链)执行完毕"
ok "部署脚本执行完毕"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
