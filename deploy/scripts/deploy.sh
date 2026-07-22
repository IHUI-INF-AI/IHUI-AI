#!/bin/bash
set -euo pipefail

# ============================================================
# IHUI-AI 蓝绿部署切换脚本
# ------------------------------------------------------------
# 用法:
#   ./deploy.sh blue       切换到 Blue 环境 (web=3000, api=8080)
#   ./deploy.sh green      切换到 Green 环境 (web=3001, api=8081)
#   ./deploy.sh status     显示当前激活环境
#   ./deploy.sh rollback   回滚到上一个环境
#
# 切换流程:
#   1. 备份当前 nginx 配置到 /tmp/nginx-backup-<时间戳>.conf
#   2. sed 替换 blue_web/green_web 和 blue_api/green_api
#   3. nginx -t 验证配置语法
#   4. 验证失败 → 恢复备份并退出 1
#   5. 验证成功 → nginx -s reload
#   6. 等待 5 秒, curl 健康检查 /nginx-health
#   7. 健康检查失败 → 自动回滚到备份
#   8. 记录切换日志到 /var/log/ihui-deploy.log
#
# 使用前请执行: chmod +x deploy.sh
# 需要 root 权限(写 /etc/nginx + nginx reload)
# ============================================================

# ── 常量配置 ──
# nginx 蓝绿配置文件路径(与 nginx/README.md 约定一致)
NGINX_CONF="/etc/nginx/conf.d/nginx-blue-green.conf"
# 健康检查端点(由 nginx-blue-green.conf 中 location /nginx-health 提供)
HEALTH_URL="http://127.0.0.1/nginx-health"
# 切换后健康检查等待秒数
HEALTH_WAIT_SEC=5
# 部署日志路径
LOG_FILE="/var/log/ihui-deploy.log"
# 备份目录(每个备份带时间戳)
BACKUP_DIR="/tmp"
# 上一次激活环境的标记文件(用于 rollback)
STATE_FILE="/var/lib/ihui/last-env"

# ── 工具函数: 记录日志 ──
# 格式: [ISO 时间] [LEVEL] 消息
log() {
  local level=$1
  shift
  local ts
  ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  echo "[${ts}] [${level}] $*" | tee -a "${LOG_FILE}" >&2
}

# ── 工具函数: 确保目录存在 ──
ensure_dirs() {
  mkdir -p "$(dirname "${LOG_FILE}")"
  mkdir -p "$(dirname "${STATE_FILE}")"
  mkdir -p "$(dirname "${NGINX_CONF}")"
}

# ── 工具函数: 备份当前 nginx 配置 ──
# 返回备份文件路径(写到 stdout)
backup_conf() {
  local ts backup
  ts=$(date +%s)
  backup="${BACKUP_DIR}/nginx-backup-${ts}.conf"
  if [[ -f "${NGINX_CONF}" ]]; then
    cp "${NGINX_CONF}" "${backup}"
    log INFO "已备份当前配置到 ${backup}"
  else
    log WARN "配置文件 ${NGINX_CONF} 不存在,跳过备份"
    backup=""
  fi
  echo "${backup}"
}

# ── 工具函数: 从配置中检测当前激活环境 ──
# 解析 proxy_pass 行,匹配到 blue_* 返回 blue,匹配到 green_* 返回 green
detect_active() {
  if [[ ! -f "${NGINX_CONF}" ]]; then
    echo "unknown"
    return
  fi
  # 取第一个 proxy_pass http://xxx_api 的 xxx 作为激活环境名
  local active
  active=$(grep -E 'proxy_pass\s+http://(blue|green)_api' "${NGINX_CONF}" \
    | head -n1 \
    | sed -E 's/.*proxy_pass\s+http:\/\/(blue|green)_api.*/\1/')
  if [[ -z "${active}" ]]; then
    echo "unknown"
  else
    echo "${active}"
  fi
}

# ── 工具函数: 执行 sed 替换 ──
# $1 = 目标环境(blue|green)
apply_target() {
  local target=$1
  if [[ "${target}" == "blue" ]]; then
    # green → blue
    sed -i 's/green_web/blue_web/g; s/green_api/blue_api/g' "${NGINX_CONF}"
  else
    # blue → green
    sed -i 's/blue_web/green_web/g; s/blue_api/green_api/g' "${NGINX_CONF}"
  fi
  log INFO "已将配置切到 ${target}"
}

# ── 工具函数: 健康检查 ──
# 返回 0 = 健康, 非 0 = 不健康
health_check() {
  local code
  # -s 静默 / -o /dev/null 丢弃 body / -w %{http_code} 取状态码 / --max-time 5s
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "${HEALTH_URL}" || true)
  if [[ "${code}" == "200" ]]; then
    log INFO "健康检查通过 (HTTP 200)"
    return 0
  else
    log ERROR "健康检查失败 (HTTP ${code:-000})"
    return 1
  fi
}

# ── 工具函数: 恢复备份 ──
# $1 = 备份文件路径
restore_backup() {
  local backup=$1
  if [[ -z "${backup}" || ! -f "${backup}" ]]; then
    log ERROR "备份文件不存在,无法恢复: ${backup}"
    return 1
  fi
  cp "${backup}" "${NGINX_CONF}"
  log WARN "已恢复备份 ${backup}"
  # 恢复后再 reload 一次,保证 nginx 运行的是旧配置
  if nginx -t >/dev/null 2>&1; then
    nginx -s reload || log ERROR "恢复后 nginx reload 失败"
  fi
}

# ── 工具函数: 保存当前激活环境为"上一个环境" ──
# 切换前调用,这样 rollback 时能拿到旧环境
save_previous() {
  local current
  current=$(detect_active)
  echo "${current}" > "${STATE_FILE}"
  log INFO "已记录上一个激活环境: ${current}"
}

# ── 核心逻辑: 切换到目标环境 ──
# $1 = blue|green
switch_to() {
  local target=$1
  local current backup

  current=$(detect_active)
  if [[ "${current}" == "${target}" ]]; then
    log INFO "当前已是 ${target},无需切换"
    return 0
  fi

  log INFO "开始切换 ${current} → ${target}"
  # 1. 备份
  backup=$(backup_conf)
  # 2. 保存上一个环境(用于 rollback)
  save_previous
  # 3. sed 替换
  apply_target "${target}"
  # 4. nginx -t 验证
  if ! nginx -t >/dev/null 2>&1; then
    log ERROR "nginx -t 验证失败,执行自动回滚"
    nginx -t || true  # 输出详细错误到 stderr
    restore_backup "${backup}"
    exit 1
  fi
  log INFO "nginx -t 验证通过"
  # 5. reload
  nginx -s reload
  log INFO "已执行 nginx -s reload"
  # 6. 等待 + 健康检查
  sleep "${HEALTH_WAIT_SEC}"
  if ! health_check; then
    # 7. 健康检查失败 → 自动回滚
    log ERROR "切换后健康检查失败,自动回滚到 ${current}"
    restore_backup "${backup}"
    exit 1
  fi
  # 8. 记录切换日志
  log INFO "切换成功: ${current} → ${target}"
}

# ── 子命令: status ──
cmd_status() {
  local current
  current=$(detect_active)
  echo "当前激活环境: ${current}"
  if [[ "${current}" == "blue" ]]; then
    echo "  - web: 127.0.0.1:8841"
    echo "  - api: 127.0.0.1:8842"
  elif [[ "${current}" == "green" ]]; then
    echo "  - web: 127.0.0.1:8843"
    echo "  - api: 127.0.0.1:8844"
  fi
}

# ── 子命令: rollback ──
cmd_rollback() {
  local prev current backup
  if [[ ! -f "${STATE_FILE}" ]]; then
    log ERROR "找不到上一个环境记录 (${STATE_FILE}),无法回滚"
    exit 1
  fi
  prev=$(cat "${STATE_FILE}")
  current=$(detect_active)
  if [[ "${prev}" == "${current}" || "${prev}" == "unknown" ]]; then
    log ERROR "上一个环境 (${prev}) 等于当前环境 (${current}) 或不可识别,无需回滚"
    exit 1
  fi
  log INFO "开始回滚 ${current} → ${prev}"
  backup=$(backup_conf)
  apply_target "${prev}"
  if ! nginx -t >/dev/null 2>&1; then
    log ERROR "回滚后 nginx -t 失败,恢复备份"
    restore_backup "${backup}"
    exit 1
  fi
  nginx -s reload
  sleep "${HEALTH_WAIT_SEC}"
  if ! health_check; then
    log ERROR "回滚后健康检查失败,恢复备份"
    restore_backup "${backup}"
    exit 1
  fi
  # 回滚成功后,更新上一个环境记录为当前(被回滚的)环境
  echo "${current}" > "${STATE_FILE}"
  log INFO "回滚成功: ${current} → ${prev}"
}

# ── 子命令: blue / green ──
cmd_blue()  { switch_to blue; }
cmd_green() { switch_to green; }

# ── 用法提示 ──
usage() {
  cat <<EOF
用法: $0 <command>

命令:
  blue       切换到 Blue 环境 (web=3000, api=8080)
  green      切换到 Green 环境 (web=3001, api=8081)
  status     显示当前激活环境
  rollback   回滚到上一个环境

示例:
  $0 green       # 蓝 → 绿
  $0 status      # 查看当前
  $0 rollback    # 回到切换前
EOF
}

# ── 入口 ──
main() {
  ensure_dirs
  local cmd=${1:-}
  case "${cmd}" in
    blue)     cmd_blue ;;
    green)    cmd_green ;;
    status)   cmd_status ;;
    rollback) cmd_rollback ;;
    -h|--help|help|"") usage ;;
    *)
      echo "未知命令: ${cmd}" >&2
      usage
      exit 2
      ;;
  esac
}

main "$@"
