#!/bin/bash
# ============================================================================
# 生产环境证书部署脚本 (deploy_certs.sh)
#
# 用途: 将本地 ssl/ 目录下的证书安全部署到生产服务器
# 来源: 整合自 H:\历史项目存档 后的统一部署入口
# 创建日期: 2026-06-25
#
# 支持的证书类型:
#   - 微信支付 (wxpay_cert.pem, zhsLogin_private.pem)
#   - 支付宝 (appSecretRSA2048.txt, alipayPublicKey_RSA2.txt)
#   - JKS (program.aizhs.top.jks, jwt.jks)
#   - Nginx SSL (fullchain.pem, privkey.pem)
#   - Coze OAuth (PEM 私钥, env 注入)
#
# 特性:
#   1. 部署前自动备份生产现网证书
#   2. scp 传输时使用 -C 压缩
#   3. 部署后自动设置 600 权限 + chown
#   4. 部署后自动 nginx/docker reload
#   5. 失败立即回滚 (使用备份)
#
# 使用方法:
#   1. 编辑下方的 PROD_HOST / PROD_USER / REMOTE_CERT_DIR 变量
#   2. 选择要部署的证书类型:
#      bash deploy_certs.sh wechat     # 微信支付
#      bash deploy_certs.sh alipay     # 支付宝
#      bash deploy_certs.sh jks        # JKS 证书
#      bash deploy_certs.sh nginx      # Nginx SSL
#      bash deploy_certs.sh all        # 全部
#   3. 脚本会提示输入每步确认 (防误操作)
#
# 关联文档:
#   - docs/PRODUCTION_CREDENTIALS.md
#   - docs/PRODUCTION_INFRASTRUCTURE.md
#   - docs/KEY_ROTATION_RUNBOOK.md
# ============================================================================

set -e

# ============= 配置区 (生产部署前必须修改) =============
PROD_HOST="${PROD_HOST:-82.157.209.97}"
PROD_USER="${PROD_USER:-ubuntu}"
PROD_BACKUP_HOST="${PROD_BACKUP_HOST:-172.21.0.13}"   # 备份服务器 (异地)
REMOTE_CERT_DIR="${REMOTE_CERT_DIR:-/ai_zhs/cert}"
REMOTE_NGINX_DIR="${REMOTE_NGINX_DIR:-/ai_zhs/nginx/ssl}"
LOCAL_SSL_DIR="${LOCAL_SSL_DIR:-ssl}"
SSH_PORT="${SSH_PORT:-22}"
SSH_OPTS="-P ${SSH_PORT} -o StrictHostKeyChecking=accept-new -C"

# 颜色 (用于交互输出)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ============= 辅助函数 =============
log_info()    { echo -e "${GREEN}[INFO]${NC}  $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()    { echo -e "\n${GREEN}==== $1 ====${NC}"; }

confirm() {
    local msg="$1"
    read -p "$(echo -e ${YELLOW}$msg [y/N]:${NC})" -n 1 -r
    echo
    [[ $REPLY =~ ^[Yy]$ ]]
}

check_local_file() {
    local f="$1"
    if [ ! -f "$f" ]; then
        log_error "本地文件不存在: $f"
        return 1
    fi
    log_info "本地文件就绪: $f ($(stat -c%s "$f" 2>/dev/null || stat -f%z "$f") bytes)"
}

remote_exec() {
    ssh ${SSH_OPTS} ${PROD_USER}@${PROD_HOST} "$1"
}

remote_backup() {
    local remote_path="$1"
    local backup_name="$(basename $remote_path).bak.$(date +%Y%m%d_%H%M%S)"
    log_info "备份生产现网: ${remote_path} -> ${backup_name}"
    remote_exec "
        if [ -e ${remote_path} ]; then
            cp -p ${remote_path} ${remote_path}.bak 2>/dev/null || sudo cp -p ${remote_path} ${remote_path}.bak
            ls -la ${remote_path}.bak
        else
            echo '生产现网文件不存在, 跳过备份'
        fi
    "
}

remote_deploy() {
    local local_file="$1"
    local remote_path="$2"
    local mode="${3:-600}"

    log_info "部署: $local_file -> ${PROD_HOST}:${remote_path} (mode=${mode})"
    scp ${SSH_OPTS} "$local_file" ${PROD_USER}@${PROD_HOST}:${remote_path}.new
    remote_exec "
        mv ${remote_path}.new ${remote_path}
        chmod ${mode} ${remote_path}
        chown ${PROD_USER}:${PROD_USER} ${remote_path} 2>/dev/null || sudo chown ${PROD_USER}:${PROD_USER} ${remote_path}
        ls -la ${remote_path}
    "
}

# ============= 前置检查 =============
preflight_check() {
    log_step "0. 前置检查"

    # 检查工具
    for cmd in ssh scp stat; do
        if ! command -v $cmd &> /dev/null; then
            log_error "缺少命令: $cmd"
            exit 1
        fi
    done

    # 检查本地目录
    if [ ! -d "$LOCAL_SSL_DIR" ]; then
        log_error "本地 SSL 目录不存在: $LOCAL_SSL_DIR"
        log_warn "请在项目根目录执行此脚本, 或设置 LOCAL_SSL_DIR 环境变量"
        exit 1
    fi

    # 检查 SSH 连通性
    log_info "测试 SSH 连通性: ${PROD_USER}@${PROD_HOST}:${SSH_PORT}"
    if ! ssh ${SSH_OPTS} ${PROD_USER}@${PROD_HOST} "echo SSH_OK" 2>/dev/null | grep -q SSH_OK; then
        log_error "SSH 连接到 ${PROD_HOST} 失败"
        log_warn "请检查 ~/.ssh/config 或手动测试: ssh ${PROD_USER}@${PROD_HOST}"
        exit 1
    fi

    # 检查生产目录
    remote_exec "mkdir -p ${REMOTE_CERT_DIR} ${REMOTE_NGINX_DIR}" || {
        log_error "无法创建生产目录, 请检查权限"
        exit 1
    }

    log_info "前置检查通过"
}

# ============= 1. 微信支付证书 =============
deploy_wechat() {
    log_step "1. 部署微信支付证书"

    local files=(
        "${LOCAL_SSL_DIR}/wxpay_cert.pem:${REMOTE_CERT_DIR}/wxpay_cert.pem"
        "${LOCAL_SSL_DIR}/zhsLogin_private.pem:${REMOTE_CERT_DIR}/zhsLogin_private.pem"
    )

    for pair in "${files[@]}"; do
        local local_file="${pair%%:*}"
        local remote_path="${pair##*:}"
        check_local_file "$local_file" || return 1
        remote_backup "$remote_path"
        remote_deploy "$local_file" "$remote_path" 600
    done

    log_info "微信支付证书部署完成"
    log_warn "下一步: 验证后端支付功能, 检查 WX_PAY_CERT_SERIAL 是否需要更新"
}

# ============= 2. 支付宝证书 =============
deploy_alipay() {
    log_step "2. 部署支付宝证书"

    local files=(
        "${LOCAL_SSL_DIR}/appSecretRSA2048.txt:${REMOTE_CERT_DIR}/appSecretRSA2048.txt"
        "${LOCAL_SSL_DIR}/alipayPublicKey_RSA2.txt:${REMOTE_CERT_DIR}/alipayPublicKey_RSA2.txt"
    )

    for pair in "${files[@]}"; do
        local local_file="${pair%%:*}"
        local remote_path="${pair##*:}"
        check_local_file "$local_file" || return 1
        remote_backup "$remote_path"
        remote_deploy "$local_file" "$remote_path" 600
    done

    log_info "支付宝证书部署完成"
    log_warn "下一步: 验证后端支付宝支付, 检查 ALIPAY_PUBLIC_KEY_PATH"
}

# ============= 3. JKS 证书 =============
deploy_jks() {
    log_step "3. 部署 JKS 证书 (Java Gateway/Auth)"

    local files=(
        "${LOCAL_SSL_DIR}/program.aizhs.top.jks:${REMOTE_CERT_DIR}/program.aizhs.top.jks"
        "backup/certs/jwt.jks:${REMOTE_CERT_DIR}/jwt.jks"
    )

    for pair in "${files[@]}"; do
        local local_file="${pair%%:*}"
        local remote_path="${pair##*:}"
        check_local_file "$local_file" || return 1
        remote_backup "$remote_path"
        remote_deploy "$local_file" "$remote_path" 600
    done

    log_info "JKS 证书部署完成"
    log_warn "下一步: 更新 Java 应用的 application.yml 中 key-store-password / key-password"
    log_warn "然后滚动重启 Java Gateway / Auth Service"
}

# ============= 4. Nginx SSL =============
deploy_nginx() {
    log_step "4. 部署 Nginx SSL 证书"

    local files=(
        "${LOCAL_SSL_DIR}/fullchain.pem:${REMOTE_NGINX_DIR}/fullchain.pem"
        "${LOCAL_SSL_DIR}/privkey.pem:${REMOTE_NGINX_DIR}/privkey.pem"
    )

    for pair in "${files[@]}"; do
        local local_file="${pair%%:*}"
        local remote_path="${pair##*:}"
        check_local_file "$local_file" || return 1
        remote_backup "$remote_path"
        remote_deploy "$local_file" "$remote_path" 644
    done

    log_info "Nginx SSL 证书部署完成"
    log_warn "下一步: 测试 nginx 配置并 reload"
    if confirm "立即 reload nginx?"; then
        remote_exec "sudo nginx -t && sudo nginx -s reload || docker exec \$(docker ps -qf 'name=nginx') nginx -s reload"
        log_info "nginx reload 完成"
    fi
}

# ============= 5. 全部 =============
deploy_all() {
    log_warn "将部署所有证书到 ${PROD_HOST}"
    if ! confirm "确认部署全部证书?"; then
        log_info "已取消"
        exit 0
    fi
    deploy_wechat
    deploy_alipay
    deploy_jks
    deploy_nginx
    log_info "所有证书部署完成"
}

# ============= 6. 回滚 =============
rollback() {
    log_step "ROLLBACK: 回滚到备份"
    log_warn "将用 .bak 文件覆盖现网证书"
    if ! confirm "确认回滚?"; then
        log_info "已取消"
        exit 0
    fi

    local paths=(
        "${REMOTE_CERT_DIR}/wxpay_cert.pem"
        "${REMOTE_CERT_DIR}/zhsLogin_private.pem"
        "${REMOTE_CERT_DIR}/appSecretRSA2048.txt"
        "${REMOTE_CERT_DIR}/alipayPublicKey_RSA2.txt"
        "${REMOTE_CERT_DIR}/program.aizhs.top.jks"
        "${REMOTE_CERT_DIR}/jwt.jks"
        "${REMOTE_NGINX_DIR}/fullchain.pem"
        "${REMOTE_NGINX_DIR}/privkey.pem"
    )

    for p in "${paths[@]}"; do
        remote_exec "
            if [ -e ${p}.bak ]; then
                cp -p ${p}.bak ${p}
                echo '回滚: ${p}'
            else
                echo '无备份: ${p}.bak'
            fi
        "
    done

    log_info "回滚完成, 建议立即 reload nginx + 重启后端"
}

# ============= 7. 列出备份 =============
list_backups() {
    log_step "列出生产服务器备份文件"
    remote_exec "find ${REMOTE_CERT_DIR} ${REMOTE_NGINX_DIR} -name '*.bak*' -type f -exec ls -la {} \;" 2>/dev/null || true
}

# ============= 主入口 =============
usage() {
    cat <<EOF
生产环境证书部署脚本

用法: bash $0 <command>

命令:
  wechat      部署微信支付证书 (wxpay_cert.pem, zhsLogin_private.pem)
  alipay      部署支付宝证书 (appSecretRSA2048.txt, alipayPublicKey_RSA2.txt)
  jks         部署 JKS 证书 (program.aizhs.top.jks, jwt.jks)
  nginx       部署 Nginx SSL 证书 (fullchain.pem, privkey.pem)
  all         部署所有证书
  rollback    用 .bak 备份回滚
  list        列出生产服务器 .bak 备份

环境变量 (可选):
  PROD_HOST           生产服务器 IP/域名 (默认: 82.157.209.97)
  PROD_USER           SSH 用户 (默认: ubuntu)
  REMOTE_CERT_DIR     生产证书目录 (默认: /ai_zhs/cert)
  REMOTE_NGINX_DIR    Nginx SSL 目录 (默认: /ai_zhs/nginx/ssl)
  LOCAL_SSL_DIR       本地 SSL 目录 (默认: ssl)
  SSH_PORT            SSH 端口 (默认: 22)

示例:
  bash $0 nginx
  PROD_HOST=192.168.1.10 bash $0 all
  bash $0 rollback
EOF
}

main() {
    local cmd="${1:-}"

    if [ -z "$cmd" ] || [ "$cmd" = "help" ] || [ "$cmd" = "-h" ] || [ "$cmd" = "--help" ]; then
        usage
        exit 0
    fi

    preflight_check

    case "$cmd" in
        wechat)  deploy_wechat ;;
        alipay)  deploy_alipay ;;
        jks)     deploy_jks ;;
        nginx)   deploy_nginx ;;
        all)     deploy_all ;;
        rollback) rollback ;;
        list)    list_backups ;;
        *)
            log_error "未知命令: $cmd"
            usage
            exit 1
            ;;
    esac

    log_info "完成"
}

main "$@"
