#!/usr/bin/env bash
# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# IHUI CLI 一键安装脚本
# 用法: curl -fsSL https://aizhs.top/install.sh | bash
# 依赖: Node.js 20+(自动检测,缺失则报错引导安装;macOS/Linux 优先走 GitHub binary 下载,失败降级 npm)
# 同源说明: 与根目录 scripts/install.sh 为同源双分发版本(根目录版是 aizhs.top 实际服务的版本,本目录版随 npm 包/仓库分发),两者能力保持一致。
set -euo pipefail

GITHUB_REPO="IHUI-INF-AI/IHUI-AI"
NPM_PACKAGE="ihui-cli"
INSTALL_VERSION="${IHUI_VERSION:-latest}"
INSTALL_DIR_LOCAL="${HOME}/.local/bin"
INSTALL_DIR_GLOBAL="/usr/local/bin"
TEMP_DIR=""

if [[ -t 1 ]]; then
  BOLD='\033[1m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
else
  BOLD=''; GREEN=''; YELLOW=''; RED=''; CYAN=''; NC=''
fi

info()  { printf "${GREEN}✓${NC} %s\n" "$1"; }
warn()  { printf "${YELLOW}⚠${NC} %s\n" "$1"; }
fatal() { printf "${RED}✗${NC} %s\n" "$1" >&2; exit 1; }

printf "${CYAN}${BOLD}IHUI AI Coding Agent — 安装中...${NC}\n"

# 0. 参数解析(--version 或环境变量 IHUI_VERSION 指定版本)
while [[ $# -gt 0 ]]; do
  case "$1" in
    --version|-v)
      INSTALL_VERSION="$2"
      shift 2
      ;;
    --help|-h)
      cat <<EOF
IHUI CLI 安装脚本

用法:
  curl -fsSL https://aizhs.top/install.sh | bash
  curl -fsSL https://aizhs.top/install.sh | bash -s -- --version 1.0.0

环境变量:
  IHUI_VERSION   指定版本 (默认: latest)
EOF
      exit 0
      ;;
    *)
      fatal "未知参数: $1"
      ;;
  esac
done

# ---------- 平台 / 架构检测(binary 通道) ----------
detect_platform() {
  OS="$(uname -s)"
  ARCH="$(uname -m)"

  case "$OS" in
    Darwin) PLATFORM="macos" ;;
    Linux)  PLATFORM="linux" ;;
    *)
      fatal "不支持的操作系统: $OS (仅支持 macOS / Linux)"
      ;;
  esac

  case "$ARCH" in
    x86_64|amd64) ARCH="x64" ;;
    aarch64|arm64) ARCH="arm64" ;;
    *)
      fatal "不支持的架构: $ARCH (仅支持 x64 / arm64)"
      ;;
  esac

  info "检测到平台: ${PLATFORM}/${ARCH}"
}

# ---------- 版本号解析(binary 通道) ----------
resolve_version() {
  if [[ "$INSTALL_VERSION" == "latest" ]]; then
    info "解析最新版本..."
    LATEST_TAG=$(curl -fsSL "https://api.github.com/repos/${GITHUB_REPO}/releases/latest" \
      | grep '"tag_name"' | head -1 | sed -E 's/.*"([^"]+)".*/\1/')
    if [[ -z "$LATEST_TAG" ]]; then
      warn "无法获取最新版本号,降级到 npm 安装"
      return 1
    fi
    # tag 形如 cli-v1.0.0 → 提取 1.0.0
    VERSION_NUM=$(echo "$LATEST_TAG" | sed -E 's/^cli-v//')
    info "最新版本: ${VERSION_NUM} (tag: ${LATEST_TAG})"
  else
    VERSION_NUM="$INSTALL_VERSION"
    LATEST_TAG="cli-v${VERSION_NUM}"
    info "指定版本: ${VERSION_NUM}"
  fi
  return 0
}

# ---------- 下载 binary(binary 通道) ----------
download_binary() {
  BINARY_NAME="ihui-${PLATFORM}-${ARCH}"
  if [[ "$PLATFORM" == "macos" ]] || [[ "$PLATFORM" == "linux" ]]; then
    ASSET_NAME="${BINARY_NAME}.tar.gz"
  else
    return 1
  fi

  if [[ "$INSTALL_VERSION" == "latest" ]]; then
    DOWNLOAD_URL="https://github.com/${GITHUB_REPO}/releases/latest/download/${ASSET_NAME}"
  else
    DOWNLOAD_URL="https://github.com/${GITHUB_REPO}/releases/download/cli-v${VERSION_NUM}/${ASSET_NAME}"
  fi

  info "下载: ${DOWNLOAD_URL}"
  TEMP_DIR=$(mktemp -d)
  if ! curl -fsSL "$DOWNLOAD_URL" -o "${TEMP_DIR}/${ASSET_NAME}"; then
    warn "下载 binary 失败"
    return 1
  fi

  info "解压..."
  tar -xzf "${TEMP_DIR}/${ASSET_NAME}" -C "$TEMP_DIR" 2>/dev/null || \
    gzip -dc "${TEMP_DIR}/${ASSET_NAME}" > "${TEMP_DIR}/ihui"

  if [[ ! -f "${TEMP_DIR}/ihui" ]]; then
    warn "解压后未找到 ihui 可执行文件"
    return 1
  fi

  chmod +x "${TEMP_DIR}/ihui"
  return 0
}

# ---------- 安装 binary 到系统(binary 通道) ----------
install_binary_to_path() {
  BINARY_PATH="${TEMP_DIR}/ihui"

  # 优先尝试 /usr/local/bin (需 sudo)
  if [[ -w "$INSTALL_DIR_GLOBAL" ]] || sudo -n true 2>/dev/null; then
    TARGET="${INSTALL_DIR_GLOBAL}/ihui"
    info "安装到 ${TARGET}"
    if [[ -w "$INSTALL_DIR_GLOBAL" ]]; then
      cp "$BINARY_PATH" "$TARGET"
    else
      sudo cp "$BINARY_PATH" "$TARGET"
      sudo chmod +x "$TARGET"
    fi
  else
    # 降级到 ~/.local/bin
    TARGET="${INSTALL_DIR_LOCAL}/ihui"
    info "安装到 ${TARGET}"
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

# ---------- npm 降级安装(原有 npm 通道收拢为降级路径) ----------
install_via_npm() {
  # 1. 检测 Node.js
  if ! command -v node >/dev/null 2>&1; then
    fatal "未检测到 Node.js,请先安装 Node.js 20+ (https://nodejs.org)"
  fi
  NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
  if [[ "$NODE_MAJOR" -lt 20 ]]; then
    fatal "Node.js 版本过低(当前 $(node -v)),需 20+ (https://nodejs.org)"
  fi
  info "Node.js $(node -v)"

  # 2. 选择包管理器(npm 优先,降级 pnpm)
  if command -v npm >/dev/null 2>&1; then
    PM_INSTALL="npm install -g"
  elif command -v pnpm >/dev/null 2>&1; then
    PM_INSTALL="pnpm add -g"
  else
    fatal "未检测到 npm/pnpm,请先安装 npm (随 Node.js 附带)"
  fi

  # 3. 全局安装(需要写权限,失败提示 sudo;支持指定版本)
  if [[ "$INSTALL_VERSION" == "latest" ]]; then
    INSTALL_TARGET="$NPM_PACKAGE"
  else
    INSTALL_TARGET="${NPM_PACKAGE}@${VERSION_NUM}"
  fi
  if ! $PM_INSTALL "$INSTALL_TARGET"; then
    warn "全局安装失败,可能需要管理员权限,尝试 sudo 重试..."
    if ! sudo $PM_INSTALL "$INSTALL_TARGET"; then
      fatal "安装失败,请检查网络或手动运行: $PM_INSTALL $INSTALL_TARGET"
    fi
  fi
}

cleanup() {
  if [[ -n "$TEMP_DIR" ]] && [[ -d "$TEMP_DIR" ]]; then
    rm -rf "$TEMP_DIR"
  fi
}
trap cleanup EXIT INT TERM

# ---------- 主流程:优先 binary 下载安装,失败降级 npm ----------
detect_platform
if resolve_version && download_binary; then
  install_binary_to_path
else
  warn "降级到 npm 安装方式"
  install_via_npm
fi

# 4. 验证
if command -v ihui >/dev/null 2>&1; then
  info "安装成功: ihui $(ihui --version 2>/dev/null || echo 'unknown')"
  printf "  运行 ${BOLD}ihui${NC} 进入交互式 REPL\n"
  printf "  文档: ${CYAN}https://aizhs.top${NC}\n"
else
  warn "ihui 未加入 PATH,请将 npm 全局 bin 目录加入 PATH"
  printf "  查询全局 bin: ${BOLD}npm bin -g${NC}\n"
fi
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
