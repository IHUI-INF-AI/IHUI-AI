#!/usr/bin/env bash
# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# =============================================================================
# IHUI-AI 部署后健康检查脚本(Linux / macOS)
# =============================================================================
# 用法:./deploy/prod-bundle/health-check.sh          人类可读输出
#       ./deploy/prod-bundle/health-check.sh --json   机器可读 JSON(监控/AI 诊断集成)
# --json 是 P2-13 补齐的那个输入:deploy-diagnosis API 与 deploy-diagnose.sh 都要读
# 健康检查的 JSON,而蓝绿链那份 deploy/scripts/health-check.sh 早就支持、本 bundle 这份
# 此前不支持 —— 同族脚本两套能力,就是"手机上改了 web 没改"的部署版。
# =============================================================================
set -uo pipefail

OUTPUT_MODE="text"
for arg in "$@"; do
    case "$arg" in
        --json) OUTPUT_MODE="json" ;;
        -h|--help)
            echo "用法: $0 [--json]"; exit 0 ;;
        *) echo "[ERROR] 未知参数: $arg" >&2; exit 1 ;;
    esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

PASS=0
FAIL=0
WARN=0
# 每项结果攒成 JSON 片段,--json 时一次性输出(text 模式不付这份成本)
RESULTS=()

json_escape() {
    printf '%s' "$1" | tr -d '\r\n' | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

check() {
    local name="$1"
    local ok_msg="$2"
    local fail_msg="$3"
    local warn_msg="${4:-}"
    shift 4
    local state detail
    if "$@" >/dev/null 2>&1; then
        state="PASS"; detail="$ok_msg"
        PASS=$((PASS + 1))
    elif [[ -n "$warn_msg" ]]; then
        state="WARN"; detail="$warn_msg"
        WARN=$((WARN + 1))
    else
        state="FAIL"; detail="$fail_msg"
        FAIL=$((FAIL + 1))
    fi
    RESULTS+=("{\"name\":\"$(json_escape "$name")\",\"state\":\"$state\",\"detail\":\"$(json_escape "$detail")\"}")
    if [[ "$OUTPUT_MODE" != "json" ]]; then
        echo "[$name] $state  $detail"
    fi
}

if [[ "$OUTPUT_MODE" != "json" ]]; then
    echo "========== IHUI-AI 健康检查 =========="
fi

# 1. Docker 容器状态
check "docker" \
    "Docker 容器在运行" \
    "Docker 容器未运行,跑 docker compose up -d" \
    "" \
    bash -c 'docker compose ps --format json 2>/dev/null | jq -e "length > 0" >/dev/null'

# 2. 各容器健康
for svc in db redis api ai-service web; do
    check "container-$svc" \
        "$svc 容器运行中" \
        "$svc 容器未运行" \
        "$svc 容器状态异常" \
        bash -c "docker compose ps --format json 2>/dev/null | jq -e '[.[] | select(.Service==\"$svc\") | select(.State==\"running\")] | length == 1' >/dev/null"
done

# 3. API 健康(本地)
check "api-health-local" \
    "API 本地健康" \
    "API 本地健康检查失败" \
    "" \
    bash -c 'curl -sf --max-time 10 http://localhost:8801/api/health | jq -e ".status == \"ok\" or .status == \"healthy\"" >/dev/null'

# 4. AI Service 健康
check "ai-service-health-local" \
    "AI Service 本地健康" \
    "AI Service 本地健康检查失败" \
    "" \
    bash -c 'curl -sf --max-time 10 http://localhost:8801/ai-service/health | jq -e ".status == \"ok\" or .status == \"healthy\"" >/dev/null'

# 5. Web 首页
check "web-home-local" \
    "Web 本地首页 200" \
    "Web 本地首页异常" \
    "" \
    bash -c 'curl -sI --max-time 10 http://localhost:8801/ | head -1 | grep -q "200"'

# 6. LLM 模型列表
check "llm-models" \
    "LLM 模型列表非空(AI key 已配置)" \
    "LLM 模型列表为空(检查 STEPFUN_API_KEY 等)" \
    "LLM 模型列表端点异常" \
    bash -c 'curl -sf --max-time 10 http://localhost:8801/ai-service/llm/models | jq -e "(.models // .data // []) | length > 0" >/dev/null'

# 7. 公网访问(主域)
check "public-main" \
    "公网 https://aizhs.top 通(经 Cloudflare)" \
    "公网 https://aizhs.top 不通" \
    "公网访问超时" \
    bash -c 'curl -sI --max-time 30 https://aizhs.top/ | grep -qiE "^HTTP/2? 200"'

# 8. 公网访问(认证子域)
check "public-bsm" \
    "公网 https://bsm.aizhs.top 通" \
    "公网 https://bsm.aizhs.top 不通" \
    "" \
    bash -c 'curl -sI --max-time 30 https://bsm.aizhs.top/ | head -1 | grep -qE "200|307|302"'

# 9. Cloudflared 容器
check "cloudflared" \
    "cloudflared 容器运行中" \
    "cloudflared 容器未运行" \
    "" \
    bash -c 'docker compose -f deploy/prod-bundle/cloudflared/docker-compose.cloudflared.yml ps --format json 2>/dev/null | jq -e "[.[] | select(.Service==\"cloudflared\") | select(.State==\"running\")] | length == 1" >/dev/null'

# 10. 磁盘空间(>10GB)
check "disk-space" \
    "磁盘剩余 > 10GB" \
    "磁盘剩余 < 10GB(危险)" \
    "" \
    bash -c '[ $(df -GB . | awk "NR==2{print \$4}") -gt 10 ]'

# 11. 数据库表数量
DB_USER=$(grep -E "^DB_USER=" "$PROJECT_ROOT/.env.production" 2>/dev/null | head -1 | cut -d= -f2-)
DB_NAME=$(grep -E "^DB_NAME=" "$PROJECT_ROOT/.env.production" 2>/dev/null | head -1 | cut -d= -f2-)
DB_USER=${DB_USER:-ihui}
DB_NAME=${DB_NAME:-ihui}
check "db-tables" \
    "数据库表数量 > 50(迁移成功)" \
    "数据库表数量异常(迁移可能失败)" \
    "" \
    bash -c "[ \$(docker compose exec -T db psql -U $DB_USER -d $DB_NAME -t -c \"SELECT count(*) FROM information_schema.tables WHERE table_schema='public';\" 2>/dev/null) -gt 50 ]"

# 汇总
if [[ "$OUTPUT_MODE" == "json" ]]; then
    # 退出码与 text 模式完全一致(FAIL>0 ⇒ 1),只是把载荷换成 JSON —— 否则"改了输出格式"
    # 会顺带把调用方的失败判定改掉,那属于把一处改进变成一处回归。
    joined=""
    for r in ${RESULTS[@]+"${RESULTS[@]}"}; do
        [[ -n "$joined" ]] && joined="$joined,$r" || joined="$r"
    done
    printf '{"generatedAt":"%s","pass":%d,"warn":%d,"fail":%d,"checks":[%s]}\n' \
        "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$PASS" "$WARN" "$FAIL" "$joined"
    [[ $FAIL -gt 0 ]] && exit 1
    exit 0
fi

echo ""
echo "=========================================="
echo "  健康检查汇总"
echo "=========================================="
echo "  PASS: $PASS"
echo "  WARN: $WARN"
echo "  FAIL: $FAIL"
echo ""

if [[ $FAIL -gt 0 ]]; then
    echo "存在 FAIL 项,部署未完全成功。请按上述 FAIL 信息排查。"
    exit 1
elif [[ $WARN -gt 0 ]]; then
    echo "存在 WARN 项,部署基本完成但需关注。建议处理 WARN 后再声明部署成功。"
    exit 0
else
    echo "所有检查通过,部署成功!"
    exit 0
fi
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
