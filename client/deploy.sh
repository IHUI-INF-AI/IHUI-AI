#!/bin/bash

# 项目部署脚本
# 使用方法: ./deploy.sh [环境]
# 环境: production (默认) | staging

set -e  # 遇到错误立即退出

ENV=${1:-production}
PROJECT_DIR="/var/www/ihui-ai/ihui-ai-officialsite-interface"
BUILD_DIR="$PROJECT_DIR/dist/web"
NGINX_CONFIG="/etc/nginx/sites-available/ihui-ai"

echo "=========================================="
echo "开始部署 iHui AI 前端项目"
echo "环境: $ENV"
echo "=========================================="

# 检查 Node.js 版本
echo "检查 Node.js 版本..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "错误: 需要 Node.js >= 20.0.0，当前版本: $(node -v)"
    exit 1
fi
echo "✓ Node.js 版本: $(node -v)"

# 检查项目目录
if [ ! -d "$PROJECT_DIR" ]; then
    echo "错误: 项目目录不存在: $PROJECT_DIR"
    exit 1
fi

cd "$PROJECT_DIR"

# 安装依赖
echo ""
echo "安装依赖..."
npm install

# 构建项目
echo ""
echo "构建项目..."
if [ "$ENV" = "production" ]; then
    npm run build:web
else
    npm run build:web
fi

# 检查构建结果
if [ ! -d "$BUILD_DIR" ] || [ -z "$(ls -A $BUILD_DIR)" ]; then
    echo "错误: 构建失败，dist/web 目录为空"
    exit 1
fi

echo "✓ 构建完成"

# 设置文件权限
echo ""
echo "设置文件权限..."
sudo chown -R www-data:www-data "$PROJECT_DIR/dist" 2>/dev/null || sudo chown -R nginx:nginx "$PROJECT_DIR/dist" 2>/dev/null || true
sudo chmod -R 755 "$PROJECT_DIR/dist"

# 检查 Nginx 配置
if [ -f "$NGINX_CONFIG" ]; then
    echo ""
    echo "检查 Nginx 配置..."
    if sudo nginx -t; then
        echo "✓ Nginx 配置正确"
        echo ""
        echo "重载 Nginx..."
        sudo systemctl reload nginx
        echo "✓ Nginx 已重载"
    else
        echo "警告: Nginx 配置有误，请检查 $NGINX_CONFIG"
    fi
else
    echo "警告: Nginx 配置文件不存在: $NGINX_CONFIG"
    echo "请手动配置 Nginx"
fi

echo ""
echo "=========================================="
echo "部署完成！"
echo "=========================================="
echo ""
echo "构建目录: $BUILD_DIR"
echo "文件数量: $(find $BUILD_DIR -type f | wc -l)"
echo ""
echo "下一步:"
echo "1. 检查网站是否正常访问"
echo "2. 查看 Nginx 日志: sudo tail -f /var/log/nginx/error.log"
echo "3. 如有问题，请参考 DEPLOYMENT.md"
