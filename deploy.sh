#!/bin/bash
# ============================================================================
# 智汇AI 一键部署脚本
# 使用方法: 在服务器上执行 bash deploy.sh
# 前提: 服务器已安装 Docker 和 Docker Compose
# ============================================================================

set -e

echo "========================================"
echo "  智汇AI 一键部署"
echo "========================================"

# 1. 检查 Docker
echo "[1/6] 检查 Docker 环境..."
if ! command -v docker &> /dev/null; then
    echo "  安装 Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl start docker
    systemctl enable docker
fi
echo "  Docker 版本: $(docker --version)"

# 2. 检查 Docker Compose
echo "[2/6] 检查 Docker Compose..."
if ! docker compose version &> /dev/null; then
    echo "  FAIL: Docker Compose 不可用，请安装 Docker Compose V2"
    exit 1
fi
echo "  Docker Compose 版本: $(docker compose version)"

# 3. 克隆/更新代码
echo "[3/6] 获取最新代码..."
if [ -d "/opt/aizhs" ]; then
    cd /opt/aizhs
    git pull origin main
else
    git clone https://github.com/IHUI-INF-AI/IHUI-AI.git /opt/aizhs
    cd /opt/aizhs
fi
echo "  代码版本: $(git log --oneline -1)"

# 4. 检查配置文件
echo "[4/6] 检查配置文件..."
if [ ! -f ".env" ]; then
    echo "  FAIL: .env 文件不存在！请先创建 .env 文件"
    echo "  参考 .env.example 创建配置"
    exit 1
fi
if [ ! -f "server/.env.production" ]; then
    echo "  FAIL: server/.env.production 不存在！"
    exit 1
fi
if [ ! -f "ssl/fullchain.pem" ] || [ ! -f "ssl/privkey.pem" ]; then
    echo "  WARN: SSL 证书不存在，生成自签名证书..."
    mkdir -p ssl
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout ssl/privkey.pem \
        -out ssl/fullchain.pem \
        -subj "/C=CN/ST=Beijing/L=Beijing/O=AIZHS/CN=aizhs.top"
    echo "  自签名证书已生成（生产环境请替换为 CA 证书）"
fi
echo "  配置文件检查通过"

# 5. 预部署检查
echo "[5/6] 运行预部署检查..."
cd server
python3 scripts/pre_deploy_check.py || {
    echo "  预部署检查未通过，请修复后重试"
    exit 1
}
cd ..

# 6. 构建并启动
echo "[6/6] 构建 Docker 镜像并启动服务..."
docker compose down 2>/dev/null || true
docker compose up -d --build

echo ""
echo "========================================"
echo "  部署完成！"
echo "========================================"
echo ""
echo "服务状态："
docker compose ps
echo ""
echo "访问地址："
echo "  HTTPS: https://$(grep DOMAIN .env | cut -d= -f2)"
echo "  HTTP:  http://$(grep DOMAIN .env | cut -d= -f2) (自动重定向到 HTTPS)"
echo ""
echo "常用命令："
echo "  查看日志: docker compose logs -f"
echo "  重启服务: docker compose restart"
echo "  停止服务: docker compose down"
echo "  查看状态: docker compose ps"
echo ""
echo "健康检查："
echo "  后端: curl -k https://localhost/healthz"
echo "  前端: curl -k https://localhost/"
echo ""
