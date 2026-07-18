#!/bin/bash
set -euo pipefail

# ============================================================
# IHUI-AI 证书部署脚本
# ------------------------------------------------------------
# 用法:
#   ./deploy_certs.sh deploy [--cert <证书路径>] [--key <私钥路径>]
#                             从环境变量 CERT_PATH/KEY_PATH 或参数读取,
#                             复制到 /etc/nginx/ssl/aizhs.top.{crt,key}
#   ./deploy_certs.sh renew    调用 certbot renew 续期, 续期成功后 reload nginx
#   ./deploy_certs.sh check    检查证书有效期 (< 30天 告警, < 7天 紧急告警)
#
# 依赖:
#   - nginx (deploy / renew 都需要)
#   - certbot (renew 时需要)
#   - openssl (check 时需要)
#
# 使用前请执行: chmod +x deploy_certs.sh
# deploy / renew 需要 root 权限(写 /etc/nginx/ssl + nginx reload)
# ============================================================

# ── 常量配置 ──
# SSL 证书目标路径(nginx-blue-green.conf 引用)
SSL_DIR="/etc/nginx/ssl"
CERT_FILE="${SSL_DIR}/aizhs.top.crt"
KEY_FILE="${SSL_DIR}/aizhs.top.key"
# 续期日志路径
LOG_FILE="/var/log/ihui-cert-deploy.log"
# 告警阈值(剩余天数)
WARN_DAYS=30
CRITICAL_DAYS=7

# ── 工具函数: 记录日志 ──
log() {
  local level=$1
  shift
  local ts
  ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  echo "[${ts}] [${level}] $*" | tee -a "${LOG_FILE}" >&2
}

# ── 工具函数: 确保目录存在 ──
ensure_dirs() {
  mkdir -p "${SSL_DIR}"
  mkdir -p "$(dirname "${LOG_FILE}")"
}

# ── 子命令: deploy ──
# 从环境变量 CERT_PATH / KEY_PATH 或 --cert / --key 参数读取路径
cmd_deploy() {
  local src_cert="${CERT_PATH:-}"
  local src_key="${KEY_PATH:-}"

  # 解析 --cert / --key 参数(覆盖环境变量)
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --cert) src_cert="$2"; shift 2 ;;
      --key)  src_key="$2";  shift 2 ;;
      *) log ERROR "未知参数: $1"; exit 2 ;;
    esac
  done

  # 校验源文件路径
  if [[ -z "${src_cert}" || -z "${src_key}" ]]; then
    log ERROR "缺少证书或私钥路径. 请设置 CERT_PATH/KEY_PATH 环境变量, 或使用 --cert/--key 参数"
    exit 2
  fi
  if [[ ! -f "${src_cert}" ]]; then
    log ERROR "证书文件不存在: ${src_cert}"
    exit 1
  fi
  if [[ ! -f "${src_key}" ]]; then
    log ERROR "私钥文件不存在: ${src_key}"
    exit 1
  fi

  log INFO "开始部署证书: ${src_cert} → ${CERT_FILE}"

  # 复制证书 + 私钥
  # 使用 install -m 直接设置权限,避免后续 chmod
  install -m 644 "${src_cert}" "${CERT_FILE}"
  install -m 600 "${src_key}"  "${KEY_FILE}"

  # 校验权限(双保险)
  chmod 644 "${CERT_FILE}"
  chmod 600 "${KEY_FILE}"

  log INFO "证书已部署: ${CERT_FILE} (644) + ${KEY_FILE} (600)"

  # nginx 校验 + reload
  if ! nginx -t >/dev/null 2>&1; then
    log ERROR "nginx -t 验证失败,请检查证书与配置是否匹配"
    nginx -t || true
    exit 1
  fi
  nginx -s reload
  log INFO "证书部署完成, nginx 已 reload"
}

# ── 子命令: renew ──
# 调用 certbot renew, 续期成功才 reload nginx
cmd_renew() {
  log INFO "开始 certbot renew"
  # --quiet: 安静模式,只在出错时输出
  if certbot renew --quiet; then
    log INFO "certbot renew 成功"
    # 续期成功后 reload nginx(让新证书生效)
    if nginx -t >/dev/null 2>&1; then
      nginx -s reload
      log INFO "nginx 已 reload, 新证书已生效"
    else
      log ERROR "nginx -t 失败,未执行 reload,请检查 nginx 配置"
      nginx -t || true
      exit 1
    fi
  else
    log ERROR "certbot renew 失败,请检查 certbot 日志 (/var/log/letsencrypt/)"
    exit 1
  fi

  # 记录续期后的有效期
  if [[ -f "${CERT_FILE}" ]]; then
    local enddate
    enddate=$(openssl x509 -in "${CERT_FILE}" -noout -enddate 2>/dev/null | cut -d= -f2 || echo "unknown")
    log INFO "续期后证书到期时间: ${enddate}"
  fi
}

# ── 子命令: check ──
# 检查证书有效期, <30天告警, <7天紧急告警
cmd_check() {
  if [[ ! -f "${CERT_FILE}" ]]; then
    log ERROR "证书文件不存在: ${CERT_FILE}"
    exit 1
  fi

  # 取证书到期时间(格式: notAfter=May 12 23:59:59 2027 GMT)
  local enddate epoch_now epoch_end remain
  enddate=$(openssl x509 -in "${CERT_FILE}" -noout -enddate | cut -d= -f2)
  if [[ -z "${enddate}" ]]; then
    log ERROR "无法解析证书到期时间"
    exit 1
  fi

  # 转换为 epoch 秒
  epoch_end=$(date -d "${enddate}" +%s 2>/dev/null || date -jf '%b %d %H:%M:%S %Y %Z' "${enddate}" +%s 2>/dev/null || echo 0)
  if [[ "${epoch_end}" == "0" ]]; then
    log ERROR "无法转换到期时间到 epoch: ${enddate}"
    exit 1
  fi
  epoch_now=$(date +%s)
  remain=$(( (epoch_end - epoch_now) / 86400 ))

  echo "证书: ${CERT_FILE}"
  echo "到期时间: ${enddate}"
  echo "剩余天数: ${remain} 天"

  if [[ ${remain} -le ${CRITICAL_DAYS} ]]; then
    log CRITICAL "证书剩余 ${remain} 天 (<= ${CRITICAL_DAYS} 天),请立即续期!"
    exit 2  # 紧急告警退出码
  elif [[ ${remain} -le ${WARN_DAYS} ]]; then
    log WARN "证书剩余 ${remain} 天 (<= ${WARN_DAYS} 天),建议尽快续期"
    exit 0
  else
    log INFO "证书状态正常 (剩余 ${remain} 天)"
    exit 0
  fi
}

# ── 用法提示 ──
usage() {
  cat <<EOF
用法: $0 <command> [options]

命令:
  deploy [--cert <crt>] [--key <key>]
                              部署证书到 ${CERT_FILE} + ${KEY_FILE}
                              路径来源: --cert/--key 参数 > CERT_PATH/KEY_PATH 环境变量
  renew                       certbot renew + nginx reload
  check                       检查证书有效期 (< ${WARN_DAYS}d 告警, < ${CRITICAL_DAYS}d 紧急)

示例:
  # 从环境变量部署
  CERT_PATH=/tmp/aizhs.top.crt KEY_PATH=/tmp/aizhs.top.key $0 deploy

  # 用参数部署
  $0 deploy --cert /tmp/aizhs.top.crt --key /tmp/aizhs.top.key

  # 续期(crontab: 0 3 * * 0)
  $0 renew

  # 检查
  $0 check
EOF
}

# ── 入口 ──
main() {
  ensure_dirs
  local cmd=${1:-}
  case "${cmd}" in
    deploy) shift; cmd_deploy "$@" ;;
    renew)  cmd_renew ;;
    check)  cmd_check ;;
    -h|--help|help|"") usage ;;
    *)
      echo "未知命令: ${cmd}" >&2
      usage
      exit 2
      ;;
  esac
}

main "$@"
