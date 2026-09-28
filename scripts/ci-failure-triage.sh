#!/usr/bin/env bash
# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# CI 失败分诊共享实现(唯一判据;各工作流经 env 注入参数调用,禁止在本文件之外内联第二份实现
# —— 两处算同一件事必漂移,漂移的代价是"诊断报告在说另一条命令")。
#
# 输入(全部经环境变量,调用点见 ci.yml / ci-monorepo.yml / knip.yml / openapi-check.yml /
# i18n-dead-key-audit.yml 的 "Failure triage" 步骤):
#   TRIAGE_WORKFLOW_FILE  本工作流自己的文件路径(runner 上是 .github/workflows/<name>.yml)
#   TRIAGE_IDS            空格分隔的步骤 id 清单,按作业内顺序排列
#   O_<ID>                每个 id 的 outcome(id 转大写、连字符转下划线后拼接;由 workflow env 注入)
#
# 行为契约(与 ci.yml 2026-09-28 落地的内联版逐条等价):
#   1. 按 TRIAGE_IDS 顺序点名第一个 outcome=failure 的步骤(只取第一个,后续失败不重复点名);
#   2. 按 id 从 TRIAGE_WORKFLOW_FILE 自身提取该步骤的单行 run: 命令原样重跑 —— 重跑映射 =
#      工作流文件本身,不手抄第二份命令清单(手抄必漂移);步骤显示名同样从文件内 name: 行提取;
#   3. action 步骤(uses:)没有可重跑命令 ⇒ 打"无可重跑命令",只点名步骤;
#   4. run: 是多行块标量(run: |)或提取不到 ⇒ 打"重跑映射缺失"并点名步骤名 —— 刻意不猜
#      块标量内容(猜了就是第二份真相),该退化分支必须保留且绝不静默跳过;
#   5. 没有任何已知 id 报 failure(job 被 cancel 等)⇒ dump 全部 outcome,同样不静默;
#   6. 重跑输出取末 60 行,逐行 ::error::(剥 CR/LF、% 先转义、单行截 1000 字符)⇒ 变成
#      check-run annotations,公开 API(GET /repos/<owner>/<repo>/commits/<sha>/check-runs)
#      零凭据可读。
# 本脚本恒 exit 0:它是分诊,不改变作业成败;失败分支里自己再红一次只会把诊断吞掉。

set -uo pipefail

WF="${TRIAGE_WORKFLOW_FILE:-}"

annotate() {
  # One ::error:: annotation per call: strip CR/LF, then percent-encode '%' first so the
  # workflow-command grammar can never be broken by tool output payload.
  local esc
  esc=$(printf '%s' "$1" | tr -d '\r\n' | sed 's/%/%25/g')
  printf '::error::%s\n' "$esc"
}

# ── 1. 按 id 顺序找第一个 failure(与内联版 probe() 同序同判)─────────────────────────
FAILED_ID=""
DUMP=""
for ID in $TRIAGE_IDS; do
  VAR="O_${ID^^}"
  VAR="${VAR//-/_}"
  OUTCOME="${!VAR:-}"
  DUMP="$DUMP $ID=$OUTCOME"
  if [ -z "$FAILED_ID" ] && [ "$OUTCOME" = "failure" ]; then
    FAILED_ID="$ID"
  fi
done

if [ -z "$FAILED_ID" ]; then
  # failure() fired but no step with an id reported 'failure' (job cancelled, or a step
  # outside this list). Printing all outcomes keeps this branch diagnosable, not silent.
  annotate "triage: job failed but no known step reported outcome=failure. all outcomes:$DUMP"
  exit 0
fi

# ── 2. 从工作流文件自身提取该步骤的显示名(不手抄第二份名字清单)────────────────────────
FAILED_NAME=""
if [ -n "$WF" ] && [ -f "$WF" ]; then
  FAILED_NAME=$(awk -v want="$FAILED_ID" '
    # name 可能写在列表项同一行(`- name: X`)或下一行(`name: X`)两种形态都要认。
    /^[[:space:]]*-[[:space:]]/ {
      line = $0
      sub(/^[[:space:]]*-[[:space:]]+/, "", line)
      if (line ~ /^name:[[:space:]]*/) { sub(/^name:[[:space:]]*/, "", line); curname = line }
      else { curname = "" }
    }
    /^[[:space:]]*name:[[:space:]]*/ { curname = $0; sub(/^[[:space:]]*name:[[:space:]]*/, "", curname) }
    /^[[:space:]]*id:[[:space:]]*/ {
      v = $0; sub(/^[[:space:]]*id:[[:space:]]*/, "", v)
      if (v == want) { print curname; exit }
    }
  ' "$WF" | tr -d '\r')
fi
[ -z "$FAILED_NAME" ] && FAILED_NAME="$FAILED_ID"

annotate "triage: first failing step is [$FAILED_ID] ($FAILED_NAME)"

# ── 3. 按 id 从工作流文件提取单行 run:(uses: 步骤与多行块标量都不猜)────────────────────
RUN_CMD=""
IS_ACTION=0
if [ -n "$WF" ] && [ -f "$WF" ]; then
  while IFS= read -r line; do
    case "$line" in
      USES) IS_ACTION=1 ;;
      RUN:*) RUN_CMD="${line#RUN:}" ;;
    esac
  done <<EOF2
$(awk -v want="$FAILED_ID" '
  # 先整文件读入,定位 id 行,再回溯到步骤起点(`- <字母>` 行,排除 paths: 等列表项),
  # 然后扫整个步骤块 —— uses: 可能写在 id: 之前(ci.yml 的 `- uses:` + `id:` 形态),
  # 只从 id 行向后扫会漏掉它,把 action 步骤误送进"重跑映射缺失"分支。
  { lines[NR] = $0 }
  END {
    idline = 0
    for (i = 1; i <= NR; i++) {
      if (lines[i] ~ ("^[[:space:]]*id:[[:space:]]*" want "[[:space:]]*$")) { idline = i; break }
    }
    if (idline == 0) exit
    start = idline
    for (i = idline; i >= 1; i--) {
      if (lines[i] ~ /^[[:space:]]*-[[:space:]][A-Za-z]/) { start = i; break }
    }
    dash = lines[start]; sub(/[^[:space:]].*$/, "", dash); ind = length(dash)
    for (i = start; i <= NR; i++) {
      l = lines[i]
      if (i > start && l ~ /^[[:space:]]*-[[:space:]][A-Za-z]/) {
        pre = l; sub(/[^[:space:]].*$/, "", pre)
        if (length(pre) <= ind) break
      }
      if (i > start && l !~ /^[[:space:]]*$/ && l !~ /^[[:space:]]*#/) {
        pre = l; sub(/[^[:space:]].*$/, "", pre)
        if (length(pre) < ind) break
      }
      # uses:/run: 可能写在列表项同一行(`- uses: X` / `- run: X`),先剥掉列表项前缀再判。
      body = l
      sub(/^[[:space:]]*/, "", body)
      sub(/^-[[:space:]]+/, "", body)
      if (body ~ /^uses:/) { print "USES" }
      else if (body ~ /^run:[[:space:]]*[|>]/) { break }   # 多行块标量:不提取,走映射缺失分支
      else if (body ~ /^run:[[:space:]]*$/) { break }
      else if (body ~ /^run:/) { sub(/^run:[[:space:]]*/, "", body); print "RUN:" body; break }
    }
  }
' "$WF" | tr -d '\r')
EOF2
fi

if [ "$IS_ACTION" -eq 1 ]; then
  # Action steps have no single 'run:' line to re-execute; naming the step is the honest ceiling here.
  annotate "triage: [$FAILED_ID] is an action step - there is no run command to re-execute. Read that step's own log panel or reproduce with the same action version."
  exit 0
fi

if [ -z "$RUN_CMD" ]; then
  annotate "triage: 重跑映射缺失 (rerun mapping missing) for [$FAILED_ID] ($FAILED_NAME) - no single-line run: found after id: $FAILED_ID in $WF. The failing step is named above; re-run its command manually."
  exit 0
fi

# ── 4. 原样重跑该命令,取末 60 行进 annotations ────────────────────────────────────────
annotate "triage: re-running ONLY this command: $RUN_CMD"
LOG="${RUNNER_TEMP:-/tmp}/ci-triage-rerun.log"
RC=0
bash -c "$RUN_CMD" >"$LOG" 2>&1 || RC=$?
TOTAL=$(wc -l <"$LOG" | tr -d '[:space:]')
if [ "$RC" -eq 0 ]; then
  annotate "triage: rerun exited 0 from the same checkout - failure not reproducible standalone (order/cache/env sensitive). Captured $TOTAL line(s); printing last 60 anyway."
else
  annotate "triage: rerun reproduced failure, exit $RC. Captured $TOTAL line(s), printing last 60 below - these are readable via the PUBLIC check-runs annotations API without log rights."
fi
tail -n 60 "$LOG" | while IFS= read -r line || [ -n "$line" ]; do
  annotate "[$FAILED_ID] ${line:0:1000}"
done
exit 0
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
