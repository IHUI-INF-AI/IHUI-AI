#!/usr/bin/env bash
# IHUI CLI 一键安装脚本
# 用法: curl -fsSL https://ihui.ai/install.sh | bash
# 依赖: Node.js 20+(自动检测,缺失则报错引导安装)
set -euo pipefail

if [[ -t 1 ]]; then
  BOLD='\033[1m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
else
  BOLD=''; GREEN=''; YELLOW=''; RED=''; CYAN=''; NC=''
fi

info()  { printf "${GREEN}✓${NC} %s\n" "$1"; }
warn()  { printf "${YELLOW}⚠${NC} %s\n" "$1"; }
fatal() { printf "${RED}✗${NC} %s\n" "$1" >&2; exit 1; }

printf "${CYAN}${BOLD}IHUI AI Coding Agent — 安装中...${NC}\n"

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

# 3. 全局安装(需要写权限,失败提示 sudo)
if ! $PM_INSTALL @ihui/cli; then
  warn "全局安装失败,可能需要管理员权限,尝试 sudo 重试..."
  if ! sudo $PM_INSTALL @ihui/cli; then
    fatal "安装失败,请检查网络或手动运行: $PM_INSTALL @ihui/cli"
  fi
fi

# 4. 验证
if command -v ihui >/dev/null 2>&1; then
  info "安装成功: ihui $(ihui --version 2>/dev/null || echo 'unknown')"
  printf "  运行 ${BOLD}ihui${NC} 进入交互式 REPL\n"
  printf "  文档: ${CYAN}https://ihui.ai${NC}\n"
else
  warn "ihui 未加入 PATH,请将 npm 全局 bin 目录加入 PATH"
  printf "  查询全局 bin: ${BOLD}npm bin -g${NC}\n"
fi
