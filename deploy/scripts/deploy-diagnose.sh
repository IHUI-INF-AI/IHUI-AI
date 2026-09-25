#!/usr/bin/env bash
# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# =============================================================================
# IHUI-AI 部署诊断采集库(P2-13 deploy 运维 AI 化)
# =============================================================================
# 为什么需要它:deploy/scripts/deploy.sh(蓝绿链)早就把失败日志交给
# ai-diagnose.mjs 做根因诊断,但 docker compose 那条链(deploy/prod-bundle/deploy.sh)
# 一个字节都没落盘 —— 而 ai-diagnose.mjs 的入参就是一个日志文件。
# 归档那份 prod-bundle/ai-diagnose.sh 依赖的 4 个输入里,主仓只有
# containerLogs 天然有内容,其余 3 个(结果 JSON / health --json / 部署日志)
# 全无生产者。所以"接诊断"必须先"把输入产出来",否则迁来的是个什么都看不到的脚本。
#
# 本库把那三件产出补齐,并对两条链通用:
#   ihui_diag_init      定下日志/结果落盘路径(不改变终端输出,只额外写文件)
#   ihui_diag_log       把一行文字追加进部署日志(给 err/ok/step 用)
#   ihui_diag_result    落 .last-deploy-result.json(部署结果,供管理页/采集器读)
#   ihui_diag_capture   把一条命令的 stdout+stderr 同时"透传 + 落盘"(依赖 pipefail)
#   ihui_diag_container_logs  失败时把容器日志抓进部署日志(它是唯一原本就有内容的输入)
#   ihui_diag_health_json     跑 health-check --json 落到文件(取不到不报错)
#   ihui_diag_run       失败点调 ai-diagnose.mjs;node/IHUI_AI_KEY 不齐则静默跳过
#
# 用法(在调用方脚本里):
#   set -euo pipefail                 # ihui_diag_capture 依赖 pipefail
#   source "$(dirname "${BASH_SOURCE[0]}")/deploy-diagnose.sh"
#   ihui_diag_init "$PROJECT_ROOT/deploy/prod-bundle" "compose"
#   ...
#   ihui_diag_result failed "build" "docker compose build 失败"
#   ihui_diag_run "docker compose build 失败"
#
# 设计约束:
#   - 默认零行为变化:所有函数任何失败一律 || true,绝不因为"诊断跑不了"弄挂部署。
#   - 不发任何通知。到人出口只有邮件一条通道,且一律经 apps/api/scripts/notify-deploy-failure.ts
#     (§5e),本库只产文件,不自拼 SMTP、不引第三方推送。
#   - 不写死盘符:落点全部由调用方传进来的 base 目录推导(§15b)。
# =============================================================================

# 由本库所在目录推导,调用方不需要知道它被放在哪。
IHUI_DIAG_SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

IHUI_DIAG_LOG_FILE="${IHUI_DIAG_LOG_FILE:-}"
IHUI_DIAG_RESULT_FILE="${IHUI_DIAG_RESULT_FILE:-}"
IHUI_DIAG_STARTED_AT="${IHUI_DIAG_STARTED_AT:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"

# ── 落点初始化 ─────────────────────────────────────────────────────────────
# $1 = base 目录(日志与结果文件写进 <base>/logs/),$2 = 标签(用于日志文件名)
ihui_diag_init() {
    local base="$1"
    local tag="${2:-deploy}"
    local ts
    ts="$(date +%Y%m%d-%H%M%S)"
    mkdir -p "${base}/logs" 2>/dev/null || true
    # 固定名 latest 供采集器读,带时间戳的那份是流水(§28:日志一律落 logs/,不落一级目录)
    IHUI_DIAG_LOG_FILE="${base}/logs/deploy-${tag}-${ts}.log"
    IHUI_DIAG_RESULT_FILE="${base}/logs/.last-deploy-result.json"
    export IHUI_DIAG_LOG_FILE IHUI_DIAG_RESULT_FILE
    : >"${IHUI_DIAG_LOG_FILE}" 2>/dev/null || IHUI_DIAG_LOG_FILE=""
    if [[ -n "${IHUI_DIAG_LOG_FILE}" ]]; then
        # latest 是指针还是副本?这里用软链;文件系统不支持则退回覆盖写副本。
        ln -sf "$(basename "${IHUI_DIAG_LOG_FILE}")" "${base}/logs/deploy-${tag}-latest.log" 2>/dev/null ||
            cp -f "${IHUI_DIAG_LOG_FILE}" "${base}/logs/deploy-${tag}-latest.log" 2>/dev/null || true
        echo "[diag] 部署日志落盘: ${IHUI_DIAG_LOG_FILE}" >&2
    else
        echo "[diag][WARN] 日志目录不可写,诊断输入将缺失" >&2
    fi
    return 0
}

# 追加一行到部署日志(调用方已经把同一行 echo 到 stderr/stdout 了,这里只补盘)
ihui_diag_log() {
    [[ -n "${IHUI_DIAG_LOG_FILE}" ]] || return 0
    printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >>"${IHUI_DIAG_LOG_FILE}" 2>/dev/null || true
    return 0
}

# ── 透传 + 落盘 ────────────────────────────────────────────────────────────
# 依赖 pipefail:docker compose 失败时整条管道必须仍判失败,否则"接了诊断"等于
# 把部署的失败判定给吞了 —— 那比不接更糟。调用方必须 set -o pipefail。
ihui_diag_capture() {
    if [[ -z "${IHUI_DIAG_LOG_FILE}" ]]; then
        "$@"
        return $?
    fi
    { echo "----- \$ $* $(date '+%H:%M:%S') -----"; } >>"${IHUI_DIAG_LOG_FILE}" 2>/dev/null || true
    # 2>&1 让 stderr 也进日志;tee 不吞退出码(pipefail 下 PIPESTATUS[0] 是被调方)
    set -o pipefail 2>/dev/null || true
    "$@" 2>&1 | tee -a "${IHUI_DIAG_LOG_FILE}"
}

# ── 部署结果落盘(.last-deploy-result.json)────────────────────────────────
# 这是此前全仓零生产者的那个输入:apps/api/src/routes/deploy-diagnosis.ts 与
# packages/api-client/src/endpoints/admin-deploy.ts 都在读它,却没人写它。
# $1 = success|failed|skipped  $2 = 阶段名  $3 = 一句话说明
ihui_diag_result() {
    local status="$1"
    local stage="$2"
    local message="$3"
    [[ -n "${IHUI_DIAG_RESULT_FILE}" ]] || return 0
    # JSON 里的字符串必须转义,否则一句带引号的错误就把整个文件写成非法 JSON,
    # 而下游是 JSON.parse —— 宁可少一条记录,也不能产一个解析不了的产物。
    local esc
    esc="$(printf '%s' "${message}" | tr -d '\r' | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' | awk '{printf "%s\\n", $0}' | sed -e 's/\\n$//')"
    printf '{"status":"%s","stage":"%s","message":"%s","startedAt":"%s","finishedAt":"%s","logFile":"%s","scriptDir":"%s"}\n' \
        "${status}" "${stage}" "${esc}" "${IHUI_DIAG_STARTED_AT}" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        "${IHUI_DIAG_LOG_FILE}" "${IHUI_DIAG_SELF_DIR}" >"${IHUI_DIAG_RESULT_FILE}.tmp" 2>/dev/null &&
        mv -f "${IHUI_DIAG_RESULT_FILE}.tmp" "${IHUI_DIAG_RESULT_FILE}" 2>/dev/null || true
    ihui_diag_log "[result] ${status} @ ${stage}: ${message}"
    return 0
}

# ── 容器日志(唯一原本就有内容的那个输入)─────────────────────────────────
# $1 = 追加说明(进日志用),可选 $2 = compose 文件(第二栈时传)
ihui_diag_container_logs() {
    local note="${1:-}"
    local compose_file="${2:-}"
    command -v docker >/dev/null 2>&1 || { ihui_diag_log "[diag] docker 不可用,跳过容器日志 ${note}"; return 0; }
    [[ -n "${IHUI_DIAG_LOG_FILE}" ]] || return 0
    local args=(compose logs --tail 200)
    [[ -n "${compose_file}" ]] && args=(-f "${compose_file}" "${args[@]}")
    {
        echo "===== 容器日志(docker ${args[*]}) ${note} ====="
        docker "${args[@]}" 2>&1 || echo "[diag] docker ${args[*]} 退出码非 0"
    } >>"${IHUI_DIAG_LOG_FILE}" 2>/dev/null || true
    return 0
}

# ── 健康检查 JSON 落盘 ─────────────────────────────────────────────────────
# 蓝绿链的 deploy/scripts/health-check.sh 早就支持 --json,compose 链那份不支持,
# 所以这里对"支持 --json 的那份"才产文件,否则如实记一行缺失,不产半成品。
# $1 = health-check 脚本路径  $2 = 输出文件
ihui_diag_health_json() {
    local script="$1"
    local out="$2"
    [[ -f "${script}" ]] || { ihui_diag_log "[diag] health-check 不存在: ${script}"; return 0; }
    if ! grep -q -- '--json' "${script}" 2>/dev/null; then
        ihui_diag_log "[diag] ${script} 不支持 --json,健康检查输入缺失"
        return 0
    fi
    bash "${script}" --json >"${out}" 2>/dev/null || true
    if [[ -s "${out}" ]] && head -c 1 "${out}" 2>/dev/null | grep -q '{'; then
        ihui_diag_log "[diag] 健康检查 JSON 已落: ${out}"
    else
        ihui_diag_log "[diag] 健康检查 JSON 未取得有效载荷(保留原始输出供排查)"
    fi
    return 0
}

# ── 调 ai-diagnose.mjs ─────────────────────────────────────────────────────
# $1 = 给模型的上下文一句话
ihui_diag_run() {
    local context="${1:-部署失败}"
    if ! command -v node >/dev/null 2>&1; then
        ihui_diag_log "[diag] node 不可用,跳过 AI 诊断"
        return 0
    fi
    if [[ -z "${IHUI_AI_KEY:-}" ]]; then
        ihui_diag_log "[diag] 未设 IHUI_AI_KEY,跳过 AI 诊断(不产生编造诊断)"
        return 0
    fi
    # 入库源在 deploy/scripts/,bundle 副本在 deploy/prod-bundle/ —— 两条链的相对位置
    # 不同,所以按候选列表找。找不到就如实落一行,绝不静默。
    local script=""
    local cand
    for cand in \
        "${IHUI_DIAG_SELF_DIR}/ai-diagnose.mjs" \
        "${IHUI_DIAG_SELF_DIR}/../scripts/ai-diagnose.mjs" \
        "${IHUI_DIAG_SELF_DIR}/../prod-bundle/ai-diagnose.mjs"; do
        if [[ -f "${cand}" ]]; then script="${cand}"; break; fi
    done
    if [[ -z "${script}" ]]; then
        ihui_diag_log "[diag][WARN] 找不到 ai-diagnose.mjs,诊断未执行"
        echo "[diag][WARN] 找不到 ai-diagnose.mjs(试过 ${IHUI_DIAG_SELF_DIR}/ 与 ../scripts/),跳过 AI 诊断" >&2
        return 0
    fi
    if [[ -z "${IHUI_DIAG_LOG_FILE}" || ! -s "${IHUI_DIAG_LOG_FILE}" ]]; then
        ihui_diag_log "[diag][WARN] 部署日志为空,AI 诊断没有输入可用"
        echo "[diag][WARN] 部署日志为空,跳过 AI 诊断" >&2
        return 0
    fi
    echo "[diag] 调用 AI 诊断助手分析失败日志(P2-13)..." >&2
    node "${script}" --log "${IHUI_DIAG_LOG_FILE}" --tail 300 --context "${context}" ||
        echo "[diag][WARN] AI 诊断不可用(退出码 $?),不影响部署流程" >&2
    return 0
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
