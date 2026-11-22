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
#   ihui_diag_run       失败点调 ai-diagnose.mjs 并把报告落盘 logs/;node/key/日志/脚本不齐则拒绝运行
#                       (拒绝仍会投一封"没诊断成 + 为什么 + 出路"的信,见下)
#   ihui_diag_safe_category 类别 sanitize:身份只吃稳定枚举,原文/读数一律不进键(§5e-1)
#   ihui_diag_bump_count 同类别第几轮(计数只进正文与投递账,不进身份)
#   ihui_diag_notify    把诊断结论经**唯一到人通道**寄出(§5e:一律经 notify-deploy-failure.ts),
#                       并把这一轮的结论落 logs/.diag-notify-log.jsonl 供回读
#
# 用法(在调用方脚本里):
#   set -euo pipefail                 # ihui_diag_capture 依赖 pipefail
#   source "$(dirname "${BASH_SOURCE[0]}")/deploy-diagnose.sh"
#   ihui_diag_init "$PROJECT_ROOT/deploy/prod-bundle" "compose"
#   ...
#   ihui_diag_result failed "build" "docker compose build 失败"
#   ihui_diag_run "docker compose build 失败" build     # 第二个参数 = 稳定类别,进告警身份
#   # (投信在 ihui_diag_run 内部完成:诊断成或没成都到人,调用方不必各写一遍)
#
# 设计约束:
#   - 默认零行为变化:所有函数任何失败一律 || true,绝不因为"诊断跑不了"弄挂部署。
#   - 到人只走**一条**通道:邮件,且一律经 apps/api/scripts/notify-deploy-failure.ts(§5e,
#     版式唯一源 email-templates.ts,守门 81 硬拦自拼 SMTP)。本库不自拼 SMTP、不引第三方推送腿,
#     只把「正文落文件 + 调那条出口」这一步做掉;投递尝试由出口自己记进
#     .ihui-agent/state/mail-send-ledger.jsonl(§5e-3),本库不再另记一本账。
#   - 不写死盘符:落点全部由调用方传进来的 base 目录推导(§15b)。
# =============================================================================

# 由本库所在目录推导,调用方不需要知道它被放在哪。
IHUI_DIAG_SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

IHUI_DIAG_LOG_FILE="${IHUI_DIAG_LOG_FILE:-}"
IHUI_DIAG_RESULT_FILE="${IHUI_DIAG_RESULT_FILE:-}"
IHUI_DIAG_LOG_DIR="${IHUI_DIAG_LOG_DIR:-}"
IHUI_DIAG_STARTED_AT="${IHUI_DIAG_STARTED_AT:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"
# 发信台账里的生产者名(§5e-3:量算仪按 (producer, 身份) 数封数)。改名 = 老账对不上新账,
# 所以它是**常量**,不由调用方随手传;要区分链别请改类别(--stage / 身份里的第二段)。
IHUI_DIAG_MAIL_SOURCE="prod-bundle-compose"

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
    IHUI_DIAG_LOG_DIR="${base}/logs"
    export IHUI_DIAG_LOG_FILE IHUI_DIAG_RESULT_FILE IHUI_DIAG_LOG_DIR
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
# $1 = 给模型的上下文一句话  $2 = 类别(稳定枚举:build/up/health/cloudflared/…,进告警身份)
ihui_diag_run() {
    local context="${1:-部署失败}"
    local category="${2:-deploy}"
    # 三条出口路径(缺件时各自点名原因,再由 ihui_diag_notify 把"没诊断成"这件事投出去):
    #   diag=ok        诊断报告已产出
    #   diag=skipped   因 node/key/日志/脚本缺失没跑诊断(正文会写明是哪一格)
    local diag_state="skipped"
    local diag_why=""
    if ! command -v node >/dev/null 2>&1; then
        diag_why="本机没有 node"
        ihui_diag_log "[diag] ${diag_why},跳过 AI 诊断"
        ihui_diag_notify "$category" "$context" "$diag_state" "$diag_why"
        return 0
    fi
    if [[ -z "${IHUI_AI_KEY:-}" ]]; then
        diag_why="未设 IHUI_AI_KEY(不产生编造诊断)"
        ihui_diag_log "[diag] ${diag_why},跳过 AI 诊断"
        ihui_diag_notify "$category" "$context" "$diag_state" "$diag_why"
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
        diag_why="找不到 ai-diagnose.mjs(试过 ${IHUI_DIAG_SELF_DIR}/ 与 ../scripts/)"
        ihui_diag_log "[diag][WARN] ${diag_why},诊断未执行"
        echo "[diag][WARN] ${diag_why},跳过 AI 诊断" >&2
        ihui_diag_notify "$category" "$context" "$diag_state" "$diag_why"
        return 0
    fi
    if [[ -z "${IHUI_DIAG_LOG_FILE}" || ! -s "${IHUI_DIAG_LOG_FILE}" ]]; then
        diag_why="部署日志为空,诊断没有输入可用"
        ihui_diag_log "[diag][WARN] ${diag_why}"
        echo "[diag][WARN] ${diag_why},跳过 AI 诊断" >&2
        ihui_diag_notify "$category" "$context" "$diag_state" "$diag_why"
        return 0
    fi
    # 诊断报告落盘(P2-13③ 票面明令):流水写进部署日志同目录(每次调用一份、带时刻,
    # 同一轮两个失败点不互相覆盖),外加固定名 latest 指针 —— 与 ihui_diag_init 的
    # 日志双件同型,失败后在 logs/ 下直接可查。
    local report latest
    report="${IHUI_DIAG_LOG_FILE%.log}-ai-diagnose-$(date +%H%M%S).md"
    latest="$(dirname "${report}")/ai-diagnose-latest.md"
    echo "[diag] 调用 AI 诊断助手分析失败日志(P2-13),报告将落盘: ${report}" >&2
    if node "${script}" --log "${IHUI_DIAG_LOG_FILE}" --tail 300 --context "${context}" --out "${report}" >/dev/null 2>&1; then
        diag_state="ok"
        diag_why="诊断报告已落盘: ${report}"
    else
        diag_why="AI 诊断退出码非 0,没有产出可用报告"
        echo "[diag][WARN] ${diag_why},不影响部署流程" >&2
    fi
    [[ -f "${report}" ]] && { ln -sf "$(basename "${report}")" "${latest}" 2>/dev/null || cp -f "${report}" "${latest}" 2>/dev/null || true; }
    ihui_diag_notify "$category" "$context" "$diag_state" "$diag_why"
    return 0
}

# ── 仓库根推导(出口脚本与 .ihui-agent/state 都在根下)──────────────────────
# 不写死盘符(§15/§15b):从采集库自身位置逐级上溯,取第一个真的带着
# `apps/api/scripts/notify-deploy-failure.ts` 的目录。取不到 ⇒ 返回 1,由调用方
# **如实报未判定**,绝不猜一个路径去发信(§0.3)。
ihui_diag_repo_root() {
    local d="${IHUI_DIAG_SELF_DIR}"
    local i
    for i in 1 2 3 4; do
        d="$(cd "${d}/.." 2>/dev/null && pwd)" || return 1
        [[ -n "${d}" && -f "${d}/apps/api/scripts/notify-deploy-failure.ts" ]] && {
            printf '%s' "${d}"
            return 0
        }
    done
    return 1
}

# 类别 sanitize:身份只吃**稳定枚举**,任何带空格/斜杠/读数的原文都不许进键(§5e-1)。
ihui_diag_safe_category() {
    printf '%s' "${1:-deploy}" | tr -c 'a-zA-Z0-9-' '_'
}

# 同一类别的第几次失败(计数只进正文与落盘,不进身份 —— 身份随计数漂移就等于没有去重)。
ihui_diag_bump_count() {
    local safe
    safe="$(ihui_diag_safe_category "${1:-deploy}")"
    local f="${IHUI_DIAG_LOG_DIR}/.diag-notify-count-${safe}"
    local n=0
    [[ -r "${f}" ]] && n="$(tr -dc '0-9' <"${f}" 2>/dev/null)"
    [[ -z "${n}" ]] && n=0
    n=$((n + 1))
    printf '%s' "${n}" >"${f}" 2>/dev/null || true
    printf '%s' "${n}"
}

# 可回读投递账(本库这一侧的一行)。它**不是**第二本发信台账:§5e-3 的
# .ihui-agent/state/mail-send-ledger.jsonl 由唯一出口自己追写、记的是"投递本身";
# 这一行记的是"compose 链哪一轮、哪个身份、什么结论(含 unjudged:*)",
# 让"这轮到底有没有到人"在 logs/ 就地可读,不必去猜出口那本账里有没有对应行。
ihui_diag_notify_record() {
    local identity="$1" safe="$2" count="$3" diag_state="$4" result="$5" message_file="$6"
    [[ -n "${IHUI_DIAG_LOG_DIR}" ]] || return 0
    printf '{"at":"%s","identity":"%s","category":"%s","count":%s,"diag":"%s","result":"%s","producer":"%s","messageFile":"%s"}\n' \
        "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${identity}" "${safe}" "${count:-0}" "${diag_state}" "${result}" \
        "${IHUI_DIAG_MAIL_SOURCE}" "${message_file}" \
        >>"${IHUI_DIAG_LOG_DIR}/.diag-notify-log.jsonl" 2>/dev/null || true
    return 0
}

# ── 诊断结果投递到**邮件这一条唯一通道**(P2-13③ 票面:"结果必须落到人")────────
# 为什么必须在 ihui_diag_run 之内、而不是让每个调用方各写一遍:
#   §5e 明令发信一律经 apps/api/scripts/notify-deploy-failure.ts(版式唯一源
#   email-templates.ts,守门 81 硬拦自拼 SMTP),第三方推送腿已整体摘除。本函数
#   **只做一件事**:把正文写成文件、按唯一出口的命令行调它。台账
#   .ihui-agent/state/mail-send-ledger.jsonl 由出口自己追写(§5e-3),本库不另记一本账。
# 去抖身份 = `compose-deploy;<类别>`(纯稳定枚举 × 出口自带的 4h 窗口)。
#   刻意**不**把计数/时刻/日志路径/原文拼进身份:那是"同一件事每轮换一次身份"那一型
#   (守门 224 V1 的立项凭据,48h 内寄出 47 封同一条故障即此)。实时读数一律进正文。
# 可回读:每一次投递(含压住/失败)都落 `<logs>/.diag-notify-log.jsonl` 一行,
#   寄不出去再落 `.ihui-agent/state/deploy-diagnose-alert-UNDELIVERED.json` 标记,
#   下次成功自动清除(§5e「失败必须响」,ops-watch-reader 扫这一格)。
# 默认零行为变化:任何失败只留痕,绝不因为"信寄不出去"把部署再判挂一次。
# $1 = 类别  $2 = 一句话病因  $3 = ok|skipped  $4 = 诊断产出说明
ihui_diag_notify() {
    local category="${1:-deploy}"
    local context="${2:-部署失败}"
    local diag_state="${3:-skipped}"
    local diag_why="${4:-}"
    local safe root line_body log_path report_hint cand rc
    safe="$(ihui_diag_safe_category "${category}")"
    local identity="compose-deploy;${safe}"
    local count=0

    # 正文必须先有落点才谈得上投递与补寄:logs/ 不可写时一律**报未判定**并点名出路,
    # 不往一级目录(CWD)撒文件(§15/§28 根目录整洁)。
    if [[ -z "${IHUI_DIAG_LOG_DIR}" ]]; then
        ihui_diag_log "[notify][未判定] logs 落点缺失,本轮没有到人通知"
        echo "[notify][未判定] 没有 <base>/logs 落点 ⇒ 告警正文无处可留;出路: 先确认可写目录后重跑,或手工经邮件出口补寄(见 apps/api/scripts/notify-deploy-failure.ts --help)" >&2
        return 0
    fi
    [[ -n "${IHUI_DIAG_LOG_DIR}" ]] && count="$(ihui_diag_bump_count "${category}")"
    log_path="${IHUI_DIAG_LOG_FILE:-未落盘}"
    report_hint="${IHUI_DIAG_LOG_DIR}/ai-diagnose-latest.md"
    line_body="${IHUI_DIAG_LOG_DIR}/deploy-notify-${safe}.txt"

    {
        printf '部署链: docker compose(prod-bundle)\n'
        printf '类别: %s\n' "${category}"
        printf '本轮同类别第 %s 次失败(计数只进正文,不进去重身份)\n' "${count}"
        printf '病因: %s\n' "${context}"
        printf 'AI 诊断: %s\n' "${diag_why:-未说明}"
        printf '部署结果 JSON: %s\n' "${IHUI_DIAG_RESULT_FILE:-未落盘}"
        printf '部署日志: %s\n' "${log_path}"
        printf '\n下一步(按顺序试,都是单命令):\n'
        printf '  1) cat %s   # 诊断报告(%s)\n' "${report_hint}" "${diag_state}"
        printf '  2) tail -n 200 %s\n' "${log_path}"
    } >"${line_body}" 2>/dev/null || true

    if ! root="$(ihui_diag_repo_root)"; then
        # 未判定 ≠ 已寄出:找不到唯一出口时把正文留在盘上并点名命令,人还能补寄。
        ihui_diag_notify_record "${identity}" "${safe}" "${count}" "${diag_state}" "unjudged:no-outlet" "${line_body}"
        ihui_diag_log "[notify][未判定] 取不到仓库根(没有 apps/api/scripts/notify-deploy-failure.ts),本轮告警未投递;身份=${identity};正文=${line_body}"
        echo "[notify][未判定] 未找到邮件唯一出口 apps/api/scripts/notify-deploy-failure.ts ⇒ 本轮没有到人通知;正文已落 ${line_body}(身份 ${identity}),出路: 在仓库根执行 node apps/api/node_modules/tsx/dist/cli.mjs apps/api/scripts/notify-deploy-failure.ts --message-file ${line_body} --alert-id ${identity} --source ${IHUI_DIAG_MAIL_SOURCE} --strict" >&2
        return 0
    fi

    {
        printf '  3) cd %s && docker compose logs --tail 200\n' "${root}"
        printf '  4) cd %s && bash deploy/prod-bundle/health-check.sh\n' "${root}"
        printf '  5) 修好后重跑: cd %s && bash deploy/prod-bundle/deploy.sh --skip-build\n' "${root}"
    } >>"${line_body}" 2>/dev/null || true

    local tsx=""
    for cand in \
        "${root}/apps/api/node_modules/tsx/dist/cli.mjs" \
        "${root}/node_modules/tsx/dist/cli.mjs"; do
        if [[ -f "${cand}" ]]; then tsx="${cand}"; break; fi
    done
    if [[ -z "${tsx}" ]]; then
        ihui_diag_notify_record "${identity}" "${safe}" "${count}" "${diag_state}" "unjudged:no-tsx" "${line_body}"
        ihui_diag_log "[notify][未判定] 取不到 tsx 入口(apps/api/node_modules/tsx/dist/cli.mjs),未投递;正文=${line_body};身份=${identity}"
        echo "[notify][未判定] 没有 tsx 入口 ⇒ 没走邮件出口;出路(单命令): cd ${root} && pnpm --filter @ihui/api exec tsx scripts/notify-deploy-failure.ts --title \"compose 部署失败(${category})\" --message-file ${line_body} --source ${IHUI_DIAG_MAIL_SOURCE} --alert-id ${identity} --strict" >&2
        return 0
    fi

    local extra=()
    [[ -n "${IHUI_DIAG_NOTIFY_EXTRA:-}" ]] && read -r -a extra <<<"${IHUI_DIAG_NOTIFY_EXTRA}"
    echo "[diag] 邮件唯一通道投递中(身份 ${identity})…" >&2
    # 退出码必须是被调方(node)的,不能让管道/重定向把它洗成 0(与本库 ihui_diag_capture
    # 依赖 pipefail 是同一条纪律);套在 if 里是为了 set -e 的调用方不因"信没寄出去"被带挂。
    local out_file="${IHUI_DIAG_LOG_DIR}/deploy-notify-out.txt"
    if node "${tsx}" "${root}/apps/api/scripts/notify-deploy-failure.ts" \
        --title "compose 部署失败(${category})" \
        --severity critical \
        --source "${IHUI_DIAG_MAIL_SOURCE}" \
        --stage "${category}" \
        --alert-id "${identity}" \
        --message-file "${line_body}" \
        --strict ${extra[@]+"${extra[@]}"} >"${out_file}" 2>&1; then
        rc=0
    else
        rc=$?
    fi
    if [[ -n "${IHUI_DIAG_LOG_FILE}" ]]; then
        tail -n 5 "${out_file}" 2>/dev/null | while IFS= read -r l; do ihui_diag_log "[notify-out] $l"; done || true
    fi
    # 可回读投递账:成功/被出口压住/演练/失败/未判定五态都要有一行(§0.3 "没判"不得写成"判过",
    # 反之"判了"也不得漏账);出口侧另有 mail-send-ledger.jsonl,两本各答各的问题。
    # 三档必须分开量出来,不能靠退出码猜:
    #   --dry-run 恒 exit 0(通道根本没碰)⇒ 记 dry-run,**不得**记成"已到人";
    #   同身份在窗口内已寄过 ⇒ exit 0 + "已按标识去重" ⇒ 记 suppressed;
    #   真送达 ⇒ exit 0 + "已通过 … 通道发送" ⇒ 记 delivered。
    local result="failed:${rc}"
    if [[ "${rc}" -eq 0 ]]; then
        result="delivered"
        if grep -q '\[dry-run\]' "${out_file}" 2>/dev/null; then
            result="dry-run"
        elif grep -q '已按标识去重' "${out_file}" 2>/dev/null; then
            result="suppressed"
        fi
    fi
    ihui_diag_notify_record "${identity}" "${safe}" "${count}" "${diag_state}" "${result}" "${line_body}"

    local mark="${root}/.ihui-agent/state/deploy-diagnose-alert-UNDELIVERED.json"
    if [[ "${rc}" -eq 0 ]]; then
        # 只有"真到人"或"同身份已被窗口压住(那封早已到人)"才清未送达标记;
        # 演练档(dry-run)结构上没碰通道 ⇒ 绝不清,否则"练过一次"会被读成"欠账已清偿"。
        if [[ "${result}" == "delivered" || "${result}" == "suppressed" ]]; then
            rm -f "${mark}" 2>/dev/null && ihui_diag_log "[notify] ${result},未送达标记已清除" || ihui_diag_log "[notify] ${result}"
        else
            ihui_diag_log "[notify] ${result}(没碰通道,保留未送达标记)"
        fi
    else
        mkdir -p "$(dirname "${mark}")" 2>/dev/null || true
        printf '{"producer":"deploy/prod-bundle compose 链","alertId":"%s","reason":"notify-deploy-failure.ts exit=%s","at":"%s","messageFile":"%s"}\n' \
            "${identity}" "${rc}" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${line_body}" >"${mark}" 2>/dev/null || true
        echo "[notify][ERROR] 邮件未送达(exit=${rc}),已落未送达标记: ${mark};补寄单命令: node ${tsx} ${root}/apps/api/scripts/notify-deploy-failure.ts --message-file ${line_body} --alert-id ${identity} --source ${IHUI_DIAG_MAIL_SOURCE} --strict" >&2
        ihui_diag_log "[notify][ERROR] 未送达 exit=${rc},标记=${mark}"
    fi
    return 0
}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
