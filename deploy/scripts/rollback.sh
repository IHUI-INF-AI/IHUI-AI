#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# IHUI-AI 回滚脚本
# ------------------------------------------------------------
# 用法:
#   ./rollback.sh                 回滚到上一个版本(蓝绿环境切换)
#   ./rollback.sh to <commit>     回滚到指定 git commit(重新构建 + 切环境)
#   ./rollback.sh list            列出可回滚版本(git log + docker tag)
#   ./rollback.sh --help          显示帮助
#
# 行为:
#   1. 默认回滚:读取 /var/lib/ihui/last-env,切换 blue↔green,
#      nginx -t 校验 + reload + 健康检查,失败自动切回.
#   2. 指定 commit:git fetch + checkout <commit> + 重新构建,
#      重启 inactive 环境服务,健康检查通过后切流量.
#   3. list:输出最近 20 条 git commit + 已有 docker 镜像 tag.
#
# 依赖: nginx / curl / git / (可选) docker / docker compose
# 需要 root 权限(写 /etc/nginx + nginx reload + /var/lib/ihui)
# ============================================================

# ── 配置 ──
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

NGINX_CONF="/etc/nginx/conf.d/nginx-blue-green.conf"
HEALTH_URL="http://127.0.0.1/nginx-health"
HEALTH_WAIT_SEC=5
LOG_FILE="/var/log/ihui-deploy.log"
STATE_FILE="/var/lib/ihui/last-env"
# inactive 环境的服务重启命令(可被环境变量覆盖)
# 默认走 systemd,若使用 docker compose 请设置:
#   export RESTART_CMD="docker compose -f /opt/ihui/docker-compose.yml restart"
RESTART_CMD="${RESTART_CMD:-systemctl restart ihui-api ihui-web}"
# 构建命令(rollback to <commit> 时使用)
BUILD_CMD="${BUILD_CMD:-cd ${PROJECT_ROOT} && pnpm install --frozen-lockfile && pnpm build}"

# ── 颜色 ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ── 函数 ──
log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()  { echo -e "${BLUE}[STEP]${NC} $1"; }

# 写入部署日志(与 deploy.sh 共享日志文件)
log_persist() {
  local level=$1
  shift
  local ts
  ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  echo "[${ts}] [${level}] [rollback] $*" | tee -a "${LOG_FILE}" >&2 || true
}

ensure_dirs() {
  mkdir -p "$(dirname "${LOG_FILE}")" 2>/dev/null || true
  mkdir -p "$(dirname "${STATE_FILE}")" 2>/dev/null || true
}

# 检测当前激活环境(blue|green|unknown)
detect_active() {
  if [[ ! -f "${NGINX_CONF}" ]]; then
    echo "unknown"; return
  fi
  local active
  active=$(grep -E 'proxy_pass\s+http://(blue|green)_api' "${NGINX_CONF}" \
    | head -n1 \
    | sed -E 's/.*proxy_pass\s+http:\/\/(blue|green)_api.*/\1/' || true)
  [[ -z "${active}" ]] && echo "unknown" || echo "${active}"
}

# 切换 nginx 配置到目标环境
apply_target() {
  local target=$1
  if [[ "${target}" == "blue" ]]; then
    sed -i 's/green_web/blue_web/g; s/green_api/blue_api/g' "${NGINX_CONF}"
  else
    sed -i 's/blue_web/green_web/g; s/blue_api/green_api/g' "${NGINX_CONF}"
  fi
}

# 备份当前 nginx 配置
backup_conf() {
  local ts backup
  ts=$(date +%s)
  backup="/tmp/nginx-rollback-backup-${ts}.conf"
  [[ -f "${NGINX_CONF}" ]] && cp "${NGINX_CONF}" "${backup}" || backup=""
  echo "${backup}"
}

# 恢复 nginx 配置备份
restore_conf() {
  local backup=$1
  if [[ -z "${backup}" || ! -f "${backup}" ]]; then
    log_error "备份文件不存在,无法恢复: ${backup}"
    return 1
  fi
  cp "${backup}" "${NGINX_CONF}"
  log_warn "已恢复 nginx 配置备份: ${backup}"
  if nginx -t >/dev/null 2>&1; then
    nginx -s reload || log_error "恢复后 nginx reload 失败"
  fi
}

# 健康检查:HTTP 200 才算通过
health_check() {
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "${HEALTH_URL}" || true)
  if [[ "${code}" == "200" ]]; then
    log_info "健康检查通过 (HTTP 200)"
    return 0
  fi
  log_error "健康检查失败 (HTTP ${code:-000})"
  return 1
}

# 切换环境(蓝绿),失败自动回切
# $1 = 目标环境(blue|green)
switch_env() {
  local target=$1
  local current backup
  current=$(detect_active)
  if [[ "${current}" == "${target}" ]]; then
    log_warn "当前已是 ${target},无需切换"
    return 0
  fi
  if [[ "${current}" == "unknown" ]]; then
    log_error "无法识别当前激活环境,拒绝切换(避免误操作)"
    return 1
  fi

  log_step "切换环境 ${current} → ${target}"
  backup=$(backup_conf)
  # 记录当前环境为上一个环境(用于失败回切)
  echo "${current}" > "${STATE_FILE}"

  apply_target "${target}"
  if ! nginx -t >/dev/null 2>&1; then
    log_error "nginx -t 校验失败,执行自动回切"
    nginx -t || true
    restore_conf "${backup}"
    return 1
  fi
  nginx -s reload
  sleep "${HEALTH_WAIT_SEC}"
  if ! health_check; then
    log_error "切换后健康检查失败,自动回切到 ${current}"
    restore_conf "${backup}"
    echo "${target}" > "${STATE_FILE}"  # 标记上一个环境为被回滚的目标
    return 1
  fi
  log_info "环境切换成功: ${current} → ${target}"
  log_persist INFO "rollback switch ${current} -> ${target} OK"
  return 0
}

# ── 子命令: list ──
# 列出最近 20 条 git commit + 已有 docker tag
cmd_list() {
  log_step "可回滚版本列表"
  echo
  echo -e "${BLUE}── Git 最近 20 条提交 ──${NC}"
  if [[ -d "${PROJECT_ROOT}/.git" ]]; then
    git -C "${PROJECT_ROOT}" log --oneline -20 --pretty=format:'%C(green)%h%C(reset) %C(yellow)(%cr)%C(reset) %s %C(cyan)<%an>%C(reset)'
    echo
  else
    log_warn "${PROJECT_ROOT} 不是 git 仓库"
  fi

  echo
  echo -e "${BLUE}── Docker 镜像 tag(ihui-ai) ──${NC}"
  if command -v docker >/dev/null 2>&1; then
    local images
    images=$(docker images --filter "reference=*ihui*" --format '{{.Repository}}:{{.Tag}}\t{{.CreatedSince}}\t{{.Size}}' 2>/dev/null || true)
    if [[ -n "${images}" ]]; then
      printf '%-50s %-20s %s\n' "REPOSITORY:TAG" "CREATED" "SIZE"
      echo "${images}"
    else
      log_warn "未找到 ihui 相关 docker 镜像"
    fi
  else
    log_warn "未安装 docker,跳过镜像列表"
  fi

  echo
  echo -e "${BLUE}── 当前激活环境 ──${NC}"
  local cur
  cur=$(detect_active)
  echo "当前: ${cur}"
  if [[ -f "${STATE_FILE}" ]]; then
    echo "上一个(可回滚到): $(cat "${STATE_FILE}")"
  else
    echo "上一个: (无记录)"
  fi
}

# ── 子命令: to <commit> ──
# 回滚到指定 git commit:fetch + checkout + build + 重启 inactive + 切流量
cmd_to() {
  local commit=$1
  local current target

  if [[ -z "${commit}" ]]; then
    log_error "缺少 commit 参数,用法: $0 to <commit>"
    exit 2
  fi

  if [[ ! -d "${PROJECT_ROOT}/.git" ]]; then
    log_error "${PROJECT_ROOT} 不是 git 仓库,无法回滚到指定 commit"
    exit 1
  fi

  current=$(detect_active)
  if [[ "${current}" == "blue" ]]; then
    target="green"
  elif [[ "${current}" == "green" ]]; then
    target="blue"
  else
    log_error "当前激活环境未知 (${current}),拒绝回滚"
    exit 1
  fi

  log_step "回滚到 commit ${commit},目标环境: ${target}"

  # 1. 拉取最新引用(确保 commit 存在)
  log_info "git fetch origin"
  if ! git -C "${PROJECT_ROOT}" fetch origin --tags >/dev/null 2>&1; then
    log_warn "git fetch 失败,继续尝试本地 commit"
  fi

  # 2. 校验 commit 存在
  if ! git -C "${PROJECT_ROOT}" cat-file -e "${commit}^{commit}" 2>/dev/null; then
    log_error "commit 不存在: ${commit}"
    exit 1
  fi

  local short_hash
  short_hash=$(git -C "${PROJECT_ROOT}" rev-parse --short "${commit}")
  local commit_msg
  commit_msg=$(git -C "${PROJECT_ROOT}" log -1 --pretty=%s "${commit}")
  log_info "目标 commit: ${short_hash} — ${commit_msg}"

  # 3. checkout 到目标 commit(分离 HEAD,避免污染当前分支)
  log_info "git checkout ${short_hash}(分离 HEAD)"
  git -C "${PROJECT_ROOT}" checkout --detach "${commit}"

  # 4. 构建
  log_step "执行构建: ${BUILD_CMD}"
  if ! eval "${BUILD_CMD}"; then
    log_error "构建失败,执行 git checkout 回到原分支并退出"
    git -C "${PROJECT_ROOT}" checkout - >/dev/null 2>&1 || true
    exit 1
  fi

  # 5. 重启 inactive 环境(目标环境)的服务
  log_step "重启目标环境(${target})服务: ${RESTART_CMD}"
  if ! eval "${RESTART_CMD}"; then
    log_error "服务重启失败,执行 git checkout 回到原分支并退出"
    git -C "${PROJECT_ROOT}" checkout - >/dev/null 2>&1 || true
    exit 1
  fi

  # 6. 等待目标环境就绪后再切流量
  log_info "等待 ${HEALTH_WAIT_SEC}s 让目标环境稳定..."
  sleep "${HEALTH_WAIT_SEC}"

  # 7. 切流量(蓝绿切换)
  if ! switch_env "${target}"; then
    log_error "切流量失败,已自动回切,但代码已 checkout 到 ${short_hash}"
    log_warn "如需恢复代码,请手动: cd ${PROJECT_ROOT} && git checkout -"
    exit 1
  fi

  log_info "回滚到 commit ${short_hash} 完成,流量已切到 ${target}"
  log_persist INFO "rollback to commit ${short_hash} (${commit_msg}) -> ${target} OK"
}

# ── 子命令: 默认(回滚到上一个环境) ──
cmd_prev() {
  local prev current
  if [[ ! -f "${STATE_FILE}" ]]; then
    log_error "找不到上一个环境记录 (${STATE_FILE}),无法回滚"
    log_warn "提示: 可用 '$0 list' 查看可回滚版本,或 '$0 to <commit>' 指定版本"
    exit 1
  fi
  prev=$(cat "${STATE_FILE}")
  current=$(detect_active)
  if [[ "${prev}" == "${current}" || "${prev}" == "unknown" ]]; then
    log_error "上一个环境 (${prev}) 等于当前环境 (${current}) 或不可识别,无需回滚"
    exit 1
  fi
  log_step "回滚: ${current} → ${prev}"
  if ! switch_env "${prev}"; then
    log_error "回滚失败,已自动切回 ${current}"
    log_persist ERROR "rollback prev ${current} -> ${prev} FAILED"
    exit 1
  fi
  log_persist INFO "rollback prev ${current} -> ${prev} OK"
}

# ── 用法 ──
usage() {
  cat <<EOF
用法: $0 [command]

命令:
  (无)                回滚到上一个版本(蓝绿环境切换)
  to <commit>         回滚到指定 git commit(重新构建 + 切环境)
  list                列出可回滚版本(git log + docker tag)
  -h, --help          显示本帮助

示例:
  $0                          # 蓝↔绿 切换到上一个环境
  $0 list                     # 查看可回滚版本
  $0 to abc1234               # 回滚到 commit abc1234
  $0 to v1.2.3                # 回滚到 tag v1.2.3

环境变量:
  RESTART_CMD                 重启服务命令(默认: systemctl restart ihui-api ihui-web)
                              docker compose 示例:
                              export RESTART_CMD="docker compose -f /opt/ihui/docker-compose.yml restart"
  BUILD_CMD                   构建命令(默认: pnpm install --frozen-lockfile && pnpm build)

依赖文件:
  ${NGINX_CONF}               nginx 蓝绿配置
  ${STATE_FILE}               上一个环境记录(由 deploy.sh 切换前写入)
  ${LOG_FILE}                 部署日志
EOF
}

# ── 主逻辑 ──
main() {
  ensure_dirs
  case "${1:-}" in
    ""|prev)
      cmd_prev
      ;;
    to)
      shift
      cmd_to "${1:-}"
      ;;
    list)
      cmd_list
      ;;
    -h|--help|help)
      usage
      ;;
    *)
      echo "未知命令: ${1}" >&2
      usage
      exit 2
      ;;
  esac
}

main "$@"
