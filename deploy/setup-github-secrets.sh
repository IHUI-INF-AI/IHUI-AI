#!/usr/bin/env bash
# GitHub Secrets 一键配置脚本
# 用法: ./setup-github-secrets.sh <owner/repo>
# 示例: ./setup-github-secrets.sh IHUI-INF-AI/IHUI-AI
#
# 前提: 已安装 gh CLI 并通过 gh auth login 认证

set -euo pipefail

REPO="${1:-IHUI-INF-AI/IHUI-AI}"

echo "=== GitHub Secrets 配置 ==="
echo "仓库: $REPO"
echo ""

read -rp "部署服务器 IP/域名: " DEPLOY_HOST
read -rp "SSH 用户名 [deploy]: " DEPLOY_USER
DEPLOY_USER="${DEPLOY_USER:-deploy}"
read -rp "SSH 私钥文件路径 [~/.ssh/ihui_deploy]: " KEY_PATH
KEY_PATH="${KEY_PATH:-$HOME/.ssh/ihui_deploy}"

if [ ! -f "$KEY_PATH" ]; then
  echo "错误: 私钥文件不存在: $KEY_PATH"
  exit 1
fi

echo ""
echo "正在设置 Secrets..."

gh secret set DEPLOY_HOST --repo "$REPO" --body "$DEPLOY_HOST"
gh secret set DEPLOY_USER --repo "$REPO" --body "$DEPLOY_USER"
gh secret set DEPLOY_SSH_PRIVATE_KEY --repo "$REPO" < "$KEY_PATH"

echo ""
echo "=== 配置完成 ==="
echo "已设置 3 个 Secrets: DEPLOY_HOST / DEPLOY_USER / DEPLOY_SSH_PRIVATE_KEY"
echo ""
echo "验证: gh secret list --repo $REPO"
