#!/bin/sh
# IHUI AI CLI — 一键安装脚本 (macOS / Linux)
# 用法: curl -fsSL https://ihui.ai/install.sh | bash
#   或: curl -fsSL https://ihui.ai/install.sh | bash -s -- --version 1.0.0

set -eu

GITHUB_REPO="IHUI-INF-AI/IHUI-AI"
NPM_PACKAGE="@ihui/cli"
INSTALL_VERSION="${IHUI_VERSION:-latest}"
INSTALL_DIR_LOCAL="${HOME}/.local/bin"
INSTALL_DIR_GLOBAL="/usr/local/bin"
TEMP_DIR=""

log() {
    printf '\033[36m[ihui]\033[0m %s\n' "$*"
}

warn() {
    printf '\033[33m[ihui]\033[0m %s\n' "$*" >&2
}

err() {
    printf '\033[31m[ihui]\033[0m %s\n' "$*" >&2
}

cleanup() {
    if [ -n "$TEMP_DIR" ] && [ -d "$TEMP_DIR" ]; then
        rm -rf "$TEMP_DIR"
    fi
}
trap cleanup EXIT INT TERM

# ---------- 参数解析 ----------
while [ $# -gt 0 ]; do
    case "$1" in
        --version|-v)
            INSTALL_VERSION="$2"
            shift 2
            ;;
        --help|-h)
            cat <<EOF
IHUI AI CLI 安装脚本

用法:
  curl -fsSL https://ihui.ai/install.sh | bash
  curl -fsSL https://ihui.ai/install.sh | bash -s -- --version 1.0.0

环境变量:
  IHUI_VERSION   指定版本 (默认: latest)
EOF
            exit 0
            ;;
        *)
            err "未知参数: $1"
            exit 1
            ;;
    esac
done

# ---------- OS / 架构检测 ----------
detect_platform() {
    OS="$(uname -s)"
    ARCH="$(uname -m)"

    case "$OS" in
        Darwin) PLATFORM="macos" ;;
        Linux)  PLATFORM="linux" ;;
        *)
            err "不支持的操作系统: $OS (仅支持 macOS / Linux)"
            exit 1
            ;;
    esac

    case "$ARCH" in
        x86_64|amd64) ARCH="x64" ;;
        aarch64|arm64) ARCH="arm64" ;;
        *)
            err "不支持的架构: $ARCH (仅支持 x64 / arm64)"
            exit 1
            ;;
    esac

    log "检测到平台: ${PLATFORM}/${ARCH}"
}

# ---------- 版本号解析 ----------
resolve_version() {
    if [ "$INSTALL_VERSION" = "latest" ]; then
        log "解析最新版本..."
        LATEST_TAG=$(curl -fsSL "https://api.github.com/repos/${GITHUB_REPO}/releases/latest" \
            | grep '"tag_name"' | head -1 | sed -E 's/.*"([^"]+)".*/\1/')
        if [ -z "$LATEST_TAG" ]; then
            warn "无法获取最新版本号,降级到 npm 安装"
            return 1
        fi
        # tag 形如 cli-v1.0.0 → 提取 1.0.0
        VERSION_NUM=$(echo "$LATEST_TAG" | sed -E 's/^cli-v//')
        log "最新版本: ${VERSION_NUM} (tag: ${LATEST_TAG})"
    else
        VERSION_NUM="$INSTALL_VERSION"
        LATEST_TAG="cli-v${VERSION_NUM}"
        log "指定版本: ${VERSION_NUM}"
    fi
    return 0
}

# ---------- 下载 binary ----------
download_binary() {
    BINARY_NAME="ihui-${PLATFORM}-${ARCH}"
    if [ "$PLATFORM" = "macos" ] || [ "$PLATFORM" = "linux" ]; then
        ASSET_NAME="${BINARY_NAME}.tar.gz"
    else
        return 1
    fi

    if [ "$INSTALL_VERSION" = "latest" ]; then
        DOWNLOAD_URL="https://github.com/${GITHUB_REPO}/releases/latest/download/${ASSET_NAME}"
    else
        DOWNLOAD_URL="https://github.com/${GITHUB_REPO}/releases/download/cli-v${VERSION_NUM}/${ASSET_NAME}"
    fi

    log "下载: ${DOWNLOAD_URL}"
    TEMP_DIR=$(mktemp -d)
    if ! curl -fsSL "$DOWNLOAD_URL" -o "${TEMP_DIR}/${ASSET_NAME}"; then
        warn "下载 binary 失败"
        return 1
    fi

    log "解压..."
    tar -xzf "${TEMP_DIR}/${ASSET_NAME}" -C "$TEMP_DIR" 2>/dev/null || \
        gzip -dc "${TEMP_DIR}/${ASSET_NAME}" > "${TEMP_DIR}/ihui"

    if [ ! -f "${TEMP_DIR}/ihui" ]; then
        warn "解压后未找到 ihui 可执行文件"
        return 1
    fi

    chmod +x "${TEMP_DIR}/ihui"
    return 0
}

# ---------- 通过 npm 安装 ----------
install_via_npm() {
    log "尝试通过 npm 安装..."

    if ! command -v node >/dev/null 2>&1; then
        err "未检测到 Node.js,请先安装 Node.js >= 20.10.0 (https://nodejs.org)"
        exit 1
    fi

    NODE_VERSION=$(node -v | sed -E 's/v//')
    NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
    if [ "$NODE_MAJOR" -lt 20 ]; then
        err "Node.js 版本过低 (${NODE_VERSION}),需要 >= 20.10.0"
        exit 1
    fi

    if ! command -v npm >/dev/null 2>&1; then
        err "未检测到 npm,请先安装 npm"
        exit 1
    fi

    log "Node.js ${NODE_VERSION} 检测通过"
    log "执行: npm install -g ${NPM_PACKAGE}@${INSTALL_VERSION}"

    if [ "$INSTALL_VERSION" = "latest" ]; then
        npm install -g "$NPM_PACKAGE"
    else
        npm install -g "${NPM_PACKAGE}@${VERSION_NUM}"
    fi

    if ! command -v ihui >/dev/null 2>&1; then
        err "npm 安装完成但 ihui 不在 PATH 中,请检查 npm global bin 路径"
        exit 1
    fi

    log "npm 安装成功"
}

# ---------- 安装 binary 到系统 ----------
install_binary_to_path() {
    BINARY_PATH="${TEMP_DIR}/ihui"

    # 优先尝试 /usr/local/bin (需 sudo)
    if [ -w "$INSTALL_DIR_GLOBAL" ] || sudo -n true 2>/dev/null; then
        TARGET="${INSTALL_DIR_GLOBAL}/ihui"
        log "安装到 ${TARGET}"
        if [ -w "$INSTALL_DIR_GLOBAL" ]; then
            cp "$BINARY_PATH" "$TARGET"
        else
            sudo cp "$BINARY_PATH" "$TARGET"
            sudo chmod +x "$TARGET"
        fi
    else
        # 降级到 ~/.local/bin
        TARGET="${INSTALL_DIR_LOCAL}/ihui"
        log "安装到 ${TARGET}"
        mkdir -p "$INSTALL_DIR_LOCAL"
        cp "$BINARY_PATH" "$TARGET"
        chmod +x "$TARGET"

        # 提示 PATH
        case ":$PATH:" in
            *":${INSTALL_DIR_LOCAL}:"*) ;;
            *)
                warn "${INSTALL_DIR_LOCAL} 不在 PATH 中,请添加到 shell 配置:"
                printf '  export PATH="%s:$PATH"\n' "$INSTALL_DIR_LOCAL"
                ;;
        esac
    fi
}

# ---------- 验证安装 ----------
verify_install() {
    if command -v ihui >/dev/null 2>&1; then
        log "安装成功 ✓"
        echo ""
        ihui --version 2>/dev/null || true
        echo ""
        log "运行 \`ihui --help\` 查看完整命令列表"
    else
        err "安装可能未完成,ihui 未在 PATH 中"
        err "请重新打开终端或手动添加到 PATH"
        exit 1
    fi
}

# ---------- 主流程 ----------
main() {
    log "IHUI AI CLI 安装程序"
    log "版本: ${INSTALL_VERSION}"
    echo ""

    detect_platform

    # 优先尝试 binary 安装
    if resolve_version && download_binary; then
        install_binary_to_path
    else
        # 降级到 npm
        warn "降级到 npm 安装方式"
        install_via_npm
    fi

    verify_install
}

main
