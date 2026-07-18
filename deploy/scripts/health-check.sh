#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# IHUI-AI 健康检查脚本
# ------------------------------------------------------------
# 用法:
#   ./health-check.sh                执行所有检查
#   ./health-check.sh --quiet        只输出错误(适用于 cron)
#   ./health-check.sh --json         输出 JSON(适用于监控系统集成)
#   ./health-check.sh --help         显示帮助
#
# 检查项:
#   1. docker-compose 服务健康状态(若存在 docker-compose.yml)
#   2. API /api/health 端点
#   3. Web / 页面可访问
#   4. AI service /health 端点
#   5. PostgreSQL 连接
#   6. Redis 连接
#   7. 磁盘空间(剩余 > 10%)
#   8. 内存使用(< 90%)
#
# 退出码:
#   0 = 全部通过
#   1 = 至少一项失败
#
# 依赖: curl / (可选) docker compose / psql / redis-cli / df / free
# ============================================================

# ── 配置 ──
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# 服务地址(可通过环境变量覆盖)
API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:8080}"
WEB_BASE_URL="${WEB_BASE_URL:-http://127.0.0.1:3000}"
AI_BASE_URL="${AI_BASE_URL:-http://127.0.0.1:8000}"

# 数据库连接
PG_HOST="${PG_HOST:-127.0.0.1}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-ihui}"
PG_DB="${PG_DB:-ihui}"

# Redis 连接
REDIS_HOST="${REDIS_HOST:-127.0.0.1}"
REDIS_PORT="${REDIS_PORT:-6379}"

# docker compose 文件(自动探测)
COMPOSE_FILE="${COMPOSE_FILE:-}"
# 阈值
DISK_MIN_FREE_PCT=10   # 磁盘剩余至少 10%
MEM_MAX_USED_PCT=90    # 内存使用最多 90%

# curl 超时(秒)
CURL_TIMEOUT=5

# ── 颜色 ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ── 函数 ──
log_info()  { [[ "${QUIET:-false}" != "true" ]] && echo -e "${GREEN}[INFO]${NC} $1" || true; }
log_warn()  { [[ "${QUIET:-false}" != "true" ]] && echo -e "${YELLOW}[WARN]${NC} $1" || true; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()  { [[ "${QUIET:-false}" != "true" ]] && echo -e "${BLUE}[STEP]${NC} $1" || true; }

# 状态行(对齐输出)
# $1 = 状态(PASS/FAIL/SKIP/WARN)
# $2 = 检查项
# $3 = 详情
print_status() {
  local status=$1 item=$2 detail=$3
  local color icon
  case "${status}" in
    PASS) color="${GREEN}"; icon="✓" ;;
    FAIL) color="${RED}";   icon="✗" ;;
    WARN) color="${YELLOW}"; icon="!" ;;
    SKIP) color="${YELLOW}"; icon="-" ;;
  esac
  printf "%s%-4s%s  %-30s %s\n" "${color}" "${icon}" "${NC}" "${item}" "${detail}"
}

# 全局结果收集(用于 JSON 输出与退出码)
RESULTS=()
RESULT_COUNT=0
FAIL_COUNT=0

# 记录检查结果
# $1 = status(PASS/FAIL/SKIP/WARN)
# $2 = item
# $3 = detail
record() {
  local status=$1 item=$2 detail=$3
  print_status "${status}" "${item}" "${detail}"
  RESULTS+=("{\"status\":\"${status}\",\"item\":\"${item}\",\"detail\":\"${detail}\"}")
  RESULT_COUNT=$((RESULT_COUNT + 1))
  [[ "${status}" == "FAIL" ]] && FAIL_COUNT=$((FAIL_COUNT + 1))
}

# ── 探测 docker compose 文件 ──
detect_compose_file() {
  # 优先使用环境变量
  if [[ -n "${COMPOSE_FILE}" && -f "${COMPOSE_FILE}" ]]; then
    return 0
  fi
  # 自动探测常见路径
  local candidates=(
    "${PROJECT_ROOT}/docker-compose.yml"
    "${PROJECT_ROOT}/docker-compose.yaml"
    "${PROJECT_ROOT}/compose.yml"
    "${PROJECT_ROOT}/compose.yaml"
    "/opt/ihui/docker-compose.yml"
    "/opt/ihui/compose.yml"
  )
  for f in "${candidates[@]}"; do
    if [[ -f "${f}" ]]; then
      COMPOSE_FILE="${f}"
      return 0
    fi
  done
  return 1
}

# ── 检查 1: docker-compose 服务健康状态 ──
check_docker_compose() {
  log_step "检查 docker-compose 服务"

  if ! command -v docker >/dev/null 2>&1; then
    record SKIP "docker-compose" "docker 未安装"
    return 0
  fi
  if ! detect_compose_file; then
    record SKIP "docker-compose" "未找到 docker-compose.yml"
    return 0
  fi

  local output unhealthy
  # --format 输出 "name state health" 三列,过滤出非 running 或非 healthy
  if ! output=$(docker compose -f "${COMPOSE_FILE}" ps --format '{{.Name}} {{.Status}}' 2>&1); then
    record FAIL "docker-compose" "docker compose ps 失败: ${output}"
    return 0
  fi

  if [[ -z "${output}" ]]; then
    record WARN "docker-compose" "无运行中的服务"
    return 0
  fi

  # 统计非健康/非 running 的服务
  unhealthy=$(echo "${output}" | grep -v -E '(running|healthy)' || true)
  if [[ -n "${unhealthy}" ]]; then
    record FAIL "docker-compose" "异常服务: $(echo "${unhealthy}" | tr '\n' ',')"
  else
    local count
    count=$(echo "${output}" | wc -l | tr -d ' ')
    record PASS "docker-compose" "${count} 个服务全部 running/healthy"
  fi
}

# ── 检查 2: API /api/health ──
check_api_health() {
  log_step "检查 API /api/health"
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time "${CURL_TIMEOUT}" \
        "${API_BASE_URL}/api/health" || true)
  if [[ "${code}" == "200" ]]; then
    record PASS "API /api/health" "HTTP 200 (${API_BASE_URL}/api/health)"
  else
    record FAIL "API /api/health" "HTTP ${code:-000} (${API_BASE_URL}/api/health)"
  fi
}

# ── 检查 3: Web / 可访问 ──
check_web_health() {
  log_step "检查 Web / 页面"
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time "${CURL_TIMEOUT}" \
        "${WEB_BASE_URL}/" || true)
  # Web 页面 200/304 都算正常,3xx 重定向也算正常(跟随)
  if [[ "${code}" =~ ^(200|304)$ ]]; then
    record PASS "Web /" "HTTP ${code} (${WEB_BASE_URL}/)"
  else
    record FAIL "Web /" "HTTP ${code:-000} (${WEB_BASE_URL}/)"
  fi
}

# ── 检查 4: AI service /health ──
check_ai_health() {
  log_step "检查 AI service /health"
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time "${CURL_TIMEOUT}" \
        "${AI_BASE_URL}/health" || true)
  if [[ "${code}" == "200" ]]; then
    record PASS "AI /health" "HTTP 200 (${AI_BASE_URL}/health)"
  else
    record FAIL "AI /health" "HTTP ${code:-000} (${AI_BASE_URL}/health)"
  fi
}

# ── 检查 5: PostgreSQL 连接 ──
check_pg() {
  log_step "检查 PostgreSQL 连接"
  if ! command -v psql >/dev/null 2>&1; then
    record SKIP "PostgreSQL" "psql 未安装"
    return 0
  fi
  local result
  result=$(PGPASSWORD="${PGPASSWORD:-}" psql \
        -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" \
        -d "${PG_DB}" \
        -tAc "SELECT 1;" 2>&1 || true)
  if [[ "${result}" == "1" ]]; then
    record PASS "PostgreSQL" "连接成功 (${PG_HOST}:${PG_PORT}/${PG_DB})"
  else
    record FAIL "PostgreSQL" "连接失败: $(echo "${result}" | head -n1)"
  fi
}

# ── 检查 6: Redis 连接 ──
check_redis() {
  log_step "检查 Redis 连接"
  if ! command -v redis-cli >/dev/null 2>&1; then
    record SKIP "Redis" "redis-cli 未安装"
    return 0
  fi
  local result
  result=$(redis-cli -h "${REDIS_HOST}" -p "${REDIS_PORT}" ping 2>&1 || true)
  if [[ "${result}" == "PONG" ]]; then
    record PASS "Redis" "连接成功 (${REDIS_HOST}:${REDIS_PORT})"
  else
    record FAIL "Redis" "连接失败: $(echo "${result}" | head -n1)"
  fi
}

# ── 检查 7: 磁盘空间 ──
check_disk() {
  log_step "检查磁盘空间(剩余 > ${DISK_MIN_FREE_PCT}%)"
  # 检查根分区和 /var(数据库/日志通常在此)
  local partitions=("/")
  [[ -d /var ]] && partitions+=("/var")
  [[ -d /opt ]] && partitions+=("/opt")

  local all_ok=true
  local details=""
  for part in "${partitions[@]}"; do
    local line use_pct free_pct
    line=$(df -h "${part}" 2>/dev/null | tail -n1 || true)
    if [[ -z "${line}" ]]; then
      continue
    fi
    # df 输出: Filesystem Size Used Avail Use% Mountedon
    use_pct=$(echo "${line}" | awk '{print $5}' | tr -d '%')
    if [[ -z "${use_pct}" ]]; then
      continue
    fi
    free_pct=$((100 - use_pct))
    if [[ ${free_pct} -lt ${DISK_MIN_FREE_PCT} ]]; then
      all_ok=false
      details="${details} ${part}=${free_pct}%free"
    else
      details="${details} ${part}=${free_pct}%free"
    fi
  done

  if [[ "${all_ok}" == "true" ]]; then
    record PASS "磁盘空间" "$(echo "${details}" | sed 's/^ //')"
  else
    record FAIL "磁盘空间" "剩余不足阈值:$(echo "${details}" | sed 's/^ //')"
  fi
}

# ── 检查 8: 内存使用 ──
check_memory() {
  log_step "检查内存使用(< ${MEM_MAX_USED_PCT}%)"
  if ! command -v free >/dev/null 2>&1; then
    record SKIP "内存" "free 未安装"
    return 0
  fi
  local total used used_pct
  total=$(free -m | awk '/^Mem:/ {print $2}')
  used=$(free -m | awk '/^Mem:/ {print $3}')
  if [[ -z "${total}" || "${total}" == "0" ]]; then
    record SKIP "内存" "无法读取内存信息"
    return 0
  fi
  used_pct=$((used * 100 / total))
  if [[ ${used_pct} -lt ${MEM_MAX_USED_PCT} ]]; then
    record PASS "内存" "已用 ${used_pct}% (${used}/${total} MB)"
  else
    record FAIL "内存" "已用 ${used_pct}% (${used}/${total} MB) 超过 ${MEM_MAX_USED_PCT}%"
  fi
}

# ── 输出 JSON 报告 ──
output_json() {
  local ts
  ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  echo "{"
  echo "  \"timestamp\": \"${ts}\","
  echo "  \"total\": ${RESULT_COUNT},"
  echo "  \"failed\": ${FAIL_COUNT},"
  echo "  \"passed\": $((RESULT_COUNT - FAIL_COUNT)),"
  echo "  \"checks\": ["
  local first=true
  for r in "${RESULTS[@]}"; do
    if [[ "${first}" == "true" ]]; then
      first=false
    else
      echo ","
    fi
    printf "    %s" "${r}"
  done
  echo
  echo "  ]"
  echo "}"
}

# ── 用法 ──
usage() {
  cat <<EOF
用法: $0 [options]

选项:
  --quiet          只输出错误(适用于 cron 告警)
  --json           输出 JSON 格式(适用于监控系统集成)
  -h, --help       显示本帮助

环境变量:
  API_BASE_URL     API 基础地址(默认 http://127.0.0.1:8080)
  WEB_BASE_URL     Web 基础地址(默认 http://127.0.0.1:3000)
  AI_BASE_URL      AI 服务基础地址(默认 http://127.0.0.1:8000)
  PG_HOST/PG_PORT/PG_USER/PG_DB    PostgreSQL 连接(默认 127.0.0.1:5432/ihui/ihui)
  REDIS_HOST/REDIS_PORT            Redis 连接(默认 127.0.0.1:6379)
  COMPOSE_FILE     docker-compose 文件路径(默认自动探测)

检查项:
  1. docker-compose 服务健康状态
  2. API /api/health 端点
  3. Web / 页面可访问
  4. AI service /health 端点
  5. PostgreSQL 连接
  6. Redis 连接
  7. 磁盘空间(剩余 > ${DISK_MIN_FREE_PCT}%)
  8. 内存使用(< ${MEM_MAX_USED_PCT}%)

退出码:
  0 = 全部通过
  1 = 至少一项失败

示例:
  $0                       # 交互式彩色输出
  $0 --quiet               # cron 用,只输出错误
  $0 --json | jq .         # 监控集成
EOF
}

# ── 主逻辑 ──
main() {
  local output_mode="text"
  QUIET=false

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --quiet) QUIET=true; shift ;;
      --json)  output_mode="json"; shift ;;
      -h|--help|help) usage; exit 0 ;;
      *) log_error "未知选项: $1"; usage; exit 2 ;;
    esac
  done

  # 执行所有检查
  check_docker_compose
  check_api_health
  check_web_health
  check_ai_health
  check_pg
  check_redis
  check_disk
  check_memory

  # 输出汇总
  if [[ "${output_mode}" == "json" ]]; then
    output_json
  else
    echo
    echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
    if [[ ${FAIL_COUNT} -eq 0 ]]; then
      echo -e "${GREEN}全部 ${RESULT_COUNT} 项检查通过${NC}"
    else
      echo -e "${RED}${FAIL_COUNT}/${RESULT_COUNT} 项检查失败${NC}"
    fi
    echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
  fi

  [[ ${FAIL_COUNT} -eq 0 ]] && exit 0 || exit 1
}

main "$@"
