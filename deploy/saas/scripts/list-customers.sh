#!/usr/bin/env bash
# 列出所有 IHUI-AI SaaS 客户租户及状态
# 用法: ./scripts/list-customers.sh

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SAAS_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CUSTOMERS_DIR="$SAAS_ROOT/customers"

if [ ! -d "$CUSTOMERS_DIR" ]; then
    echo "无客户目录: $CUSTOMERS_DIR"
    exit 0
fi

# 加载顶层 .env 拿 BASE_DOMAIN
if [ -f "$SAAS_ROOT/.env" ]; then
    # shellcheck disable=SC1091
    set -a; . "$SAAS_ROOT/.env"; set +a
fi

BASE_DOMAIN_VAL="${BASE_DOMAIN:-<未配置>}"

printf "${GREEN}%-20s %-30s %-15s %-20s${NC}\n" "SLUG" "DOMAIN" "STATUS" "RESOURCES"
printf "%-20s %-30s %-15s %-20s\n" "----" "------" "------" "----------"

# 扫描 customers/*/docker-compose.yml
for dir in "$CUSTOMERS_DIR"/*/; do
    [ -d "$dir" ] || continue
    slug=$(basename "$dir")
    [ "$slug" = ".gitkeep" ] && continue

    compose_file="$dir/docker-compose.yml"
    [ -f "$compose_file" ] || continue

    domain="${slug}.${BASE_DOMAIN_VAL}"

    # 读取资源限制
    mem=$(grep -E "memory:" "$compose_file" 2>/dev/null | head -1 | awk '{print $NF}' | tr -d "'" || echo "-")
    cpu=$(grep -E "cpus:" "$compose_file" 2>/dev/null | head -1 | awk '{print $NF}' | tr -d "'" || echo "-")

    # 检查容器运行状态
    running=$(docker ps --filter "name=customer-${slug}-" --format "{{.Names}}" 2>/dev/null | wc -l | tr -d ' ')
    total=$(docker ps -a --filter "name=customer-${slug}-" --format "{{.Names}}" 2>/dev/null | wc -l | tr -d ' ')

    if [ "$running" -gt 0 ] && [ "$running" -eq "$total" ]; then
        status="${GREEN}up ($running/$total)${NC}"
    elif [ "$running" -gt 0 ]; then
        status="${YELLOW}partial ($running/$total)${NC}"
    elif [ "$total" -gt 0 ]; then
        status="${YELLOW}down (0/$total)${NC}"
    else
        status="not-created"
    fi

    resources="mem=${mem} cpu=${cpu}"
    printf "%-20s %-30s %-30b %-20s\n" "$slug" "$domain" "$status" "$resources"
done

echo ""
echo "总览:"
echo "  Traefik:  $(docker ps --filter "name=ihui-saas-traefik" --format "{{.Status}}" 2>/dev/null || echo 'not running')"
echo "  网络:      $(docker network ls --filter "name=ihui-saas-net" --format "{{.Name}}" 2>/dev/null || echo 'not created')"
echo "  客户数:    $(ls -1d "$CUSTOMERS_DIR"/*/ 2>/dev/null | wc -l)"
