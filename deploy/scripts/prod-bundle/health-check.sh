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

# ── 拓扑判据(2026-10-13):health-check 家族原本只描述 compose 拓扑 ────────────
# 生产机(WIN-20251101PXT)是 nssm 原生托管:机器上没有 docker,`deploy/prod-bundle/`
# 下也没有任何 compose 清单(「容器状态」这一整族在此结构上不可能成立),jq 亦不在
# PATH。旧写法把这些一律记成 FAIL ⇒ 每轮都报出一屏与线上实际状态无关的失败(服务全
# Running、健康端点全 200),等于把"没装这套东西"读成"这套东西坏了"。
# 处置:前置不在位的一律落 SKIP —— 不计 FAIL、不改退出码(调用方的失败判定保持不变),
# 文案给出本机该跑的入口;compose 拓扑上 docker/清单/jq 都在位 ⇒ 行为与改前逐条一致。
SKIP=0
NATIVE_HINT="本机非 compose 拓扑,本项不适用;原生形态请跑 deploy/win/test-health.ps1"
COMPOSE_MANIFEST="$(ls "$PROJECT_ROOT/deploy/prod-bundle"/docker-compose*.y*ml 2>/dev/null | head -1)"
IS_COMPOSE_TOPO=0
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1 && [[ -n "$COMPOSE_MANIFEST" ]]; then
    IS_COMPOSE_TOPO=1
fi
HAS_JQ=0
if command -v jq >/dev/null 2>&1; then HAS_JQ=1; fi
export HAS_JQ

skip() {
    local name="$1" why="$2"
    SKIP=$((SKIP + 1))
    RESULTS+=("{\"name\":\"$(json_escape "$name")\",\"state\":\"SKIP\",\"detail\":\"$(json_escape "$why")\"}")
    if [[ "$OUTPUT_MODE" != "json" ]]; then
        echo "[$name] SKIP  $why"
    fi
}

# JSON 取值:有 jq 走 jq;没有就用 sed 兜这一个字段 —— 缺解析器不该把健康的端点判成红
http_field() {
    local url="$1" field="$2" body
    body="$(curl -sf --max-time 10 "$url" 2>/dev/null)" || return 1
    if [[ "$HAS_JQ" == "1" ]]; then
        printf '%s' "$body" | jq -r --arg f "$field" '.[$f] // empty' 2>/dev/null
    else
        printf '%s' "$body" | tr -d '\r\n' \
            | sed -n "s/.*\"$field\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p"
    fi
}
# 依次试多个候选 URL,取到 status 就据此判定(原生拓扑下 8801 前端不开 /ai-service/
# 前缀 —— nginx 那份配置没在这台机上跑 —— 真相入口是 AI 服务自身的 8803)
http_status_ok() {
    local st
    for u in "$@"; do
        st="$(http_field "$u" status 2>/dev/null)"
        if [[ -n "$st" ]]; then
            [[ "$st" == "ok" || "$st" == "healthy" ]] && return 0 || return 1
        fi
    done
    return 1
}
# .models/.data 至少一个为非空数组(无 jq 时按 JSON 形态判,不够深但不会假性通过)
http_array_nonempty() {
    local url="$1" body
    body="$(curl -sf --max-time 10 "$url" 2>/dev/null)" || return 1
    if [[ "$HAS_JQ" == "1" ]]; then
        printf '%s' "$body" | jq -e '(.models // .data // []) | length > 0' >/dev/null 2>&1
        return $?
    fi
    printf '%s' "$body" | tr -d '\r\n' \
        | grep -qE '"(models|data)"[[:space:]]*:[[:space:]]*\[[[:space:]]*[{"'"'"']'
}
# df 的单位开关 GNU 是 -BG、BSD/macOS 是 -g:旧写法只认前者,非 GNU 环境这一项恒红
disk_free_gb() {
    local v
    v="$(df -BG . 2>/dev/null | awk 'NR==2{gsub(/[^0-9]/,"",$4); print $4}')"
    [[ -z "$v" ]] && v="$(df -g . 2>/dev/null | awk 'NR==2{gsub(/[^0-9]/,"",$4); print $4}')"
    printf '%s' "${v:-0}"
}
export -f http_field http_status_ok http_array_nonempty disk_free_gb

if [[ "$OUTPUT_MODE" != "json" ]]; then
    echo "========== IHUI-AI 健康检查 =========="
    echo "拓扑判据: IS_COMPOSE_TOPO=$IS_COMPOSE_TOPO HAS_JQ=$HAS_JQ"
fi

# 1. Docker 容器状态(前置:docker + compose 清单)
if [[ "$IS_COMPOSE_TOPO" == "1" ]]; then
    check "docker" \
        "Docker 容器在运行" \
        "Docker 容器未运行,跑 docker compose up -d" \
        "" \
        bash -c 'docker compose ps --format json 2>/dev/null | jq -e "length > 0" >/dev/null'
else
    skip "docker" "$NATIVE_HINT(docker 或 compose 清单不在位)"
fi

# 2. 各容器健康(同一前置)
for svc in db redis api ai-service web; do
    if [[ "$IS_COMPOSE_TOPO" == "1" ]]; then
        check "container-$svc" \
            "$svc 容器运行中" \
            "$svc 容器未运行" \
            "$svc 容器状态异常" \
            bash -c "docker compose ps --format json 2>/dev/null | jq -e '[.[] | select(.Service==\"$svc\") | select(.State==\"running\")] | length == 1' >/dev/null"
    else
        skip "container-$svc" "$NATIVE_HINT(docker 或 compose 清单不在位)"
    fi
done

# 3. API 健康(本地)
check "api-health-local" \
    "API 本地健康" \
    "API 本地健康检查失败" \
    "" \
    bash -c 'http_status_ok http://localhost:8801/api/health'

# 4. AI Service 健康(原生拓扑下真相入口是 8803:8801 上跑的是 Next 前门,它没有
#    nginx 那份 location /ai-service/,所以旧写法在这里恒红而 AI 服务本身是健康的)
check "ai-service-health-local" \
    "AI Service 本地健康" \
    "AI Service 本地健康检查失败" \
    "" \
    bash -c 'http_status_ok http://localhost:8801/ai-service/health http://localhost:8803/health'

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
    bash -c 'http_array_nonempty http://localhost:8801/ai-service/llm/models'

# 7. 公网访问(主域)
# 7. 公网访问(主域)—— 状态码判据须同时认 HTTP/1.x 与 HTTP/2:旧式 `^HTTP/2? 200`
#    里那个 `2?` 只匹配字符 2,不匹配 `1.1`,于是主域走 HTTP/1.1 响应时这项恒 WARN
#    (且 warn 文案写的是"超时",把真因盖住了);bsm 那项没这个问题,因为它是宽松匹配。
check "public-main" \
    "公网 https://aizhs.top 通(经 Cloudflare)" \
    "公网 https://aizhs.top 不通" \
    "公网访问异常(超时,或状态码非 2xx)" \
    bash -c 'curl -sI --max-time 30 https://aizhs.top/ | grep -qiE "^HTTP/[0-9](\.[0-9]+)? 200"'

# 8. 公网访问(认证子域)
check "public-bsm" \
    "公网 https://bsm.aizhs.top 通" \
    "公网 https://bsm.aizhs.top 不通" \
    "" \
    bash -c 'curl -sI --max-time 30 https://bsm.aizhs.top/ | head -1 | grep -qE "200|307|302"'

# 9. Cloudflared 容器(前置同 1:它是容器形态;原生形态下 cloudflared 跑的是 Windows 服务)
if [[ "$IS_COMPOSE_TOPO" == "1" ]]; then
    check "cloudflared" \
        "cloudflared 容器运行中" \
        "cloudflared 容器未运行" \
        "" \
        bash -c 'docker compose -f deploy/prod-bundle/cloudflared/docker-compose.cloudflared.yml ps --format json 2>/dev/null | jq -e "[.[] | select(.Service==\"cloudflared\") | select(.State==\"running\")] | length == 1" >/dev/null'
else
    skip "cloudflared" "$NATIVE_HINT(cloudflared 在本机是 Windows 服务,不是容器)"
fi

# 10. 磁盘空间(>10GB)
check "disk-space" \
    "磁盘剩余 > 10GB" \
    "磁盘剩余 < 10GB(危险)" \
    "" \
    bash -c '[ "$(disk_free_gb)" -gt 10 ]'

# 11. 数据库表数量
DB_USER=$(grep -E "^DB_USER=" "$PROJECT_ROOT/.env.production" 2>/dev/null | head -1 | cut -d= -f2-)
DB_NAME=$(grep -E "^DB_NAME=" "$PROJECT_ROOT/.env.production" 2>/dev/null | head -1 | cut -d= -f2-)
DB_USER=${DB_USER:-ihui}
DB_NAME=${DB_NAME:-ihui}
# 11. 数据库表数量(前置同 1:它 docker exec 进 db 容器;原生形态的表数另有 pg 侧判据)
if [[ "$IS_COMPOSE_TOPO" == "1" ]]; then
    check "db-tables" \
        "数据库表数量 > 50(迁移成功)" \
        "数据库表数量异常(迁移可能失败)" \
        "" \
        bash -c "[ \$(docker compose exec -T db psql -U $DB_USER -d $DB_NAME -t -c \"SELECT count(*) FROM information_schema.tables WHERE table_schema='public';\" 2>/dev/null) -gt 50 ]"
else
    skip "db-tables" "$NATIVE_HINT(库不在本机容器里;迁移结果看部署环的 db:migrate 段)"
fi

# 汇总
if [[ "$OUTPUT_MODE" == "json" ]]; then
    # 退出码与 text 模式完全一致(FAIL>0 ⇒ 1),只是把载荷换成 JSON —— 否则"改了输出格式"
    # 会顺带把调用方的失败判定改掉,那属于把一处改进变成一处回归。
    joined=""
    for r in ${RESULTS[@]+"${RESULTS[@]}"}; do
        [[ -n "$joined" ]] && joined="$joined,$r" || joined="$r"
    done
    printf '{"generatedAt":"%s","pass":%d,"warn":%d,"fail":%d,"skip":%d,"checks":[%s]}\n' \
        "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$PASS" "$WARN" "$FAIL" "$SKIP" "$joined"
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
echo "  SKIP: $SKIP(前置不在位,非失败)"
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
