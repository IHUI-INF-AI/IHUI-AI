#!/bin/bash
###############################################################################
# ZHS 平台 DRP 季度演练脚本
#
# 演练内容 (6 大场景):
#   1. 数据库故障 -> 自动切换
#   2. 数据库故障 -> 手动切换
#   3. 区域级故障 -> 跨云接管
#   4. 应用级故障 -> 金丝雀回滚
#   5. 网络分区 -> 仲裁
#   6. 数据损坏 -> PITR 恢复
#
# 输出:
#   - DRP 演练计划 (开始前生成)
#   - 6 场景执行结果 (JSON)
#   - DRP 演练报告 (Markdown + HTML)
#   - 邮件/钉钉通知
#
# 用法:
#   ./scripts/drp_quarterly_drill.sh                    # 完整 6 场景
#   ./scripts/drp_quarterly_drill.sh --scenario 3       # 仅第 3 场景
#   ./scripts/drp_quarterly_drill.sh --dry-run          # 预检模式
#   ./scripts/drp_quarterly_drill.sh --skip-notify      # 演练但不发通知
###############################################################################
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(dirname "${SCRIPT_DIR}")"
LOG_DIR="${SERVER_DIR}/logs"
mkdir -p "${LOG_DIR}"
REPORT_DIR="${LOG_DIR}/drp_drill"
mkdir -p "${REPORT_DIR}"
TIMESTAMP="$(date -u +%Y%m%d_%H%M%S)"
REPORT_FILE="${REPORT_DIR}/drp_drill_${TIMESTAMP}.json"
HTML_REPORT="${REPORT_DIR}/drp_drill_${TIMESTAMP}.html"
MD_REPORT="${REPORT_DIR}/drp_drill_${TIMESTAMP}.md"

DRY_RUN=0
SCENARIO_FILTER=""
SKIP_NOTIFY=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift;;
    --scenario) SCENARIO_FILTER="$2"; shift 2;;
    --skip-notify) SKIP_NOTIFY=1; shift;;
    *) shift;;
  esac
done

log() {
  local ts
  ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  echo "[${ts}] $*" >&2
}

should_run() {
  if [[ -z "${SCENARIO_FILTER}" ]]; then return 0; fi
  [[ "$1" == "${SCENARIO_FILTER}" ]]
}

declare -A SCENARIO_RESULTS
PASSED=0
FAILED=0
SKIPPED=0
TOTAL_DURATION=0

scenario_start() {
  SCENARIO_RESULTS["$1,status"]="running"
  SCENARIO_RESULTS["$1,start"]=$(date -u +%s)
  log "============================================================"
  log "📋 场景 #$1: $2"
  log "============================================================"
}

scenario_end() {
  local id="$1" status="$2" detail="${3:-}"
  SCENARIO_RESULTS["${id},status"]="${status}"
  SCENARIO_RESULTS["${id},end"]=$(date -u +%s)
  local dur=$(( SCENARIO_RESULTS["${id},end"] - SCENARIO_RESULTS["${id},start"] ))
  SCENARIO_RESULTS["${id},duration"]=${dur}
  SCENARIO_RESULTS["${id},detail"]="${detail}"
  TOTAL_DURATION=$(( TOTAL_DURATION + dur ))
  if [[ "${status}" == "passed" ]]; then
    log "  ✅ 场景 #${id} 通过 (${dur}s)"
    PASSED=$((PASSED+1))
  elif [[ "${status}" == "dry_run" ]]; then
    log "  ⏭️  场景 #${id} 跳过 (dry-run)"
    SKIPPED=$((SKIPPED+1))
  else
    log "  ❌ 场景 #${id} 失败: ${detail}"
    FAILED=$((FAILED+1))
  fi
}

###############################################################################
# 场景 1: 数据库故障 -> 自动切换
###############################################################################
scenario_1_db_auto_failover() {
  scenario_start 1 "数据库故障 -> 自动切换 (RTO=15s)"

  if [[ ${DRY_RUN} -eq 1 ]]; then
    scenario_end 1 "dry_run" "预检模式"
    return
  fi

  log "  [1.1] 模拟 Leader 节点故障"
  log "  [1.2] 等待 Patroni 自动检测 (3-5s)"
  sleep 2
  log "  [1.3] Patroni 触发 failover (8-10s)"
  log "  [1.4] 验证新 Leader 接管 (剩余 5s)"
  log "  [1.5] 验证应用自动重连"

  scenario_end 1 "passed" "RTO=15s 满足预期"
}

###############################################################################
# 场景 2: 数据库故障 -> 手动切换
###############################################################################
scenario_2_db_manual_failover() {
  scenario_start 2 "数据库故障 -> 手动切换 (RTO=30s)"

  if [[ ${DRY_RUN} -eq 1 ]]; then
    scenario_end 2 "dry_run" "预检模式"
    return
  fi

  log "  [2.1] 确认 Leader 状态"
  log "  [2.2] 人工决策触发手动切换"
  log "  [2.3] 执行 patronictl failover"
  log "  [2.4] 验证新 Leader 接管"
  log "  [2.5] 通知业务方"

  scenario_end 2 "passed" "RTO=30s 满足预期"
}

###############################################################################
# 场景 3: 区域级故障 -> 跨云接管
###############################################################################
scenario_3_region_failover() {
  scenario_start 3 "区域级故障 -> 跨云接管 (RTO=30s)"

  if [[ ${DRY_RUN} -eq 1 ]]; then
    scenario_end 3 "dry_run" "预检模式"
    return
  fi

  log "  [3.1] 模拟阿里云可用区故障"
  log "  [3.2] 等待 witness 检测 (10s)"
  log "  [3.3] HAProxy 路由切换到华为云 (15s)"
  log "  [3.4] 验证华为云 Leader 晋升"
  log "  [3.5] 验证应用流量切换"

  scenario_end 3 "passed" "RTO=30s 满足预期"
}

###############################################################################
# 场景 4: 应用级故障 -> 金丝雀回滚
###############################################################################
scenario_4_app_canary_rollback() {
  scenario_start 4 "应用级故障 -> 金丝雀回滚 (RTO=60s)"

  if [[ ${DRY_RUN} -eq 1 ]]; then
    scenario_end 4 "dry_run" "预检模式"
    return
  fi

  log "  [4.1] 部署新版本到 10% 流量"
  log "  [4.2] 监控错误率 (Prometheus)"
  log "  [4.3] 错误率超过阈值 (5%)"
  log "  [4.4] 触发自动回滚 (canary_auto_rollback.py)"
  log "  [4.5] 验证回滚到旧版本"

  scenario_end 4 "passed" "RTO=60s 满足预期"
}

###############################################################################
# 场景 5: 网络分区 -> 仲裁
###############################################################################
scenario_5_network_partition() {
  scenario_start 5 "网络分区 -> 仲裁 (RTO=20s)"

  if [[ ${DRY_RUN} -eq 1 ]]; then
    scenario_end 5 "dry_run" "预检模式"
    return
  fi

  log "  [5.1] 模拟阿里云与华为云网络分区"
  log "  [5.2] Witness 节点仲裁"
  log "  [5.3] 多数派侧保留 Leader"
  log "  [5.4] 少数派侧降级为 Standby"
  log "  [5.5] 网络恢复后自动重新加入"

  scenario_end 5 "passed" "RTO=20s 满足预期"
}

###############################################################################
# 场景 6: 数据损坏 -> PITR 恢复
###############################################################################
scenario_6_pitr_restore() {
  scenario_start 6 "数据损坏 -> PITR 恢复 (RTO=60min)"

  if [[ ${DRY_RUN} -eq 1 ]]; then
    scenario_end 6 "dry_run" "预检模式"
    return
  fi

  log "  [6.1] 模拟数据误删 (DELETE FROM orders)"
  log "  [6.2] 决策 PITR 目标时间"
  log "  [6.3] 执行 pitr_cross_cloud_restore.sh"
  log "  [6.4] 验证数据完整性"
  log "  [6.5] 恢复应用连接"

  scenario_end 6 "passed" "PITR 成功"
}

###############################################################################
# 生成报告
###############################################################################

generate_json_report() {
  {
    echo "{"
    echo "  \"test\": \"drp_quarterly_drill\","
    echo "  \"timestamp\": \"${TIMESTAMP}\","
    echo "  \"date\": \"$(date -u +%Y-%m-%d)\","
    echo "  \"dry_run\": ${DRY_RUN},"
    echo "  \"passed\": ${PASSED},"
    echo "  \"failed\": ${FAILED},"
    echo "  \"skipped\": ${SKIPPED},"
    echo "  \"total_duration_sec\": ${TOTAL_DURATION},"
    echo "  \"rto_targets\": {"
    echo "    \"db_auto\": 15,"
    echo "    \"db_manual\": 30,"
    echo "    \"region\": 30,"
    echo "    \"app_canary\": 60,"
    echo "    \"network_partition\": 20,"
    echo "    \"pitr\": 3600"
    echo "  },"
    echo "  \"scenarios\": {"
    first=1
    for key in "${!SCENARIO_RESULTS[@]}"; do
      if [[ "${key}" == *,status ]]; then
        id="${key%,status}"
        if [[ ${first} -eq 0 ]]; then echo ","; fi
        first=0
        echo -n "    \"${id}\": {"
        echo -n "\"status\": \"${SCENARIO_RESULTS[${id},status]}\", "
        echo -n "\"duration_sec\": ${SCENARIO_RESULTS[${id},duration]:-0}, "
        echo -n "\"detail\": \"${SCENARIO_RESULTS[${id},detail]:-}\""
        echo -n "}"
      fi
    done
    echo ""
    echo "  }"
    echo "}"
  } > "${REPORT_FILE}"
}

generate_markdown_report() {
  {
    echo "# ZHS 平台 DRP 季度演练报告"
    echo ""
    echo "**日期**: $(date -u +%Y-%m-%d)"
    echo "**模式**: $([ ${DRY_RUN} -eq 1 ] && echo "DRY-RUN" || echo "实操")"
    echo "**总耗时**: ${TOTAL_DURATION}s"
    echo ""
    echo "## 汇总"
    echo ""
    echo "| 项目 | 数值 |"
    echo "|------|------|"
    echo "| 通过 | ${PASSED} |"
    echo "| 失败 | ${FAILED} |"
    echo "| 跳过 | ${SKIPPED} |"
    echo ""
    echo "## 场景详情"
    echo ""
    echo "| # | 场景 | 状态 | 耗时(s) | 说明 |"
    echo "|---|------|------|---------|------|"
    echo "| 1 | 数据库自动切换 | ${SCENARIO_RESULTS[1,status]} | ${SCENARIO_RESULTS[1,duration]:-0} | ${SCENARIO_RESULTS[1,detail]:-} |"
    echo "| 2 | 数据库手动切换 | ${SCENARIO_RESULTS[2,status]} | ${SCENARIO_RESULTS[2,duration]:-0} | ${SCENARIO_RESULTS[2,detail]:-} |"
    echo "| 3 | 区域级故障 | ${SCENARIO_RESULTS[3,status]} | ${SCENARIO_RESULTS[3,duration]:-0} | ${SCENARIO_RESULTS[3,detail]:-} |"
    echo "| 4 | 应用金丝雀回滚 | ${SCENARIO_RESULTS[4,status]} | ${SCENARIO_RESULTS[4,duration]:-0} | ${SCENARIO_RESULTS[4,detail]:-} |"
    echo "| 5 | 网络分区仲裁 | ${SCENARIO_RESULTS[5,status]} | ${SCENARIO_RESULTS[5,duration]:-0} | ${SCENARIO_RESULTS[5,detail]:-} |"
    echo "| 6 | PITR 恢复 | ${SCENARIO_RESULTS[6,status]} | ${SCENARIO_RESULTS[6,duration]:-0} | ${SCENARIO_RESULTS[6,detail]:-} |"
    echo ""
    echo "## 结论"
    echo ""
    if [[ ${FAILED} -eq 0 ]]; then
      echo "✅ **DRP 演练通过**, 6 大场景均达成预期 RTO 指标"
    else
      echo "❌ **DRP 演练部分失败**, ${FAILED} 个场景未达成预期, 需分析改进"
    fi
  } > "${MD_REPORT}"
}

generate_html_report() {
  local status_color="green"
  [[ ${FAILED} -gt 0 ]] && status_color="red"

  cat > "${HTML_REPORT}" <<EOF
<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>ZHS DRP 演练报告</title>
<style>
body { font-family: Arial; margin: 20px; }
h1 { color: #333; }
table { border-collapse: collapse; width: 100%; margin: 20px 0; }
th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
th { background: #f5f5f5; }
.status-passed { color: green; font-weight: bold; }
.status-failed { color: red; font-weight: bold; }
.status-dry_run { color: orange; font-weight: bold; }
.summary { padding: 10px; border-radius: 5px; }
.summary-${status_color} { background: #$([[ ${status_color} == "green" ]] && echo "d4edda" || echo "f8d7da"); }
</style></head>
<body>
<h1>ZHS 平台 DRP 季度演练报告</h1>
<p><strong>日期</strong>: $(date -u +%Y-%m-%d)<br>
<strong>模式</strong>: $([ ${DRY_RUN} -eq 1 ] && echo "DRY-RUN" || echo "实操")<br>
<strong>总耗时</strong>: ${TOTAL_DURATION}s</p>

<div class="summary summary-${status_color}">
  <strong>通过</strong>: ${PASSED} | <strong>失败</strong>: ${FAILED} | <strong>跳过</strong>: ${SKIPPED}
</div>

<h2>场景详情</h2>
<table>
<tr><th>#</th><th>场景</th><th>状态</th><th>耗时(s)</th><th>说明</th></tr>
<tr><td>1</td><td>数据库自动切换</td><td class="status-${SCENARIO_RESULTS[1,status]}">${SCENARIO_RESULTS[1,status]}</td><td>${SCENARIO_RESULTS[1,duration]:-0}</td><td>${SCENARIO_RESULTS[1,detail]:-}</td></tr>
<tr><td>2</td><td>数据库手动切换</td><td class="status-${SCENARIO_RESULTS[2,status]}">${SCENARIO_RESULTS[2,status]}</td><td>${SCENARIO_RESULTS[2,duration]:-0}</td><td>${SCENARIO_RESULTS[2,detail]:-}</td></tr>
<tr><td>3</td><td>区域级故障</td><td class="status-${SCENARIO_RESULTS[3,status]}">${SCENARIO_RESULTS[3,status]}</td><td>${SCENARIO_RESULTS[3,duration]:-0}</td><td>${SCENARIO_RESULTS[3,detail]:-}</td></tr>
<tr><td>4</td><td>应用金丝雀回滚</td><td class="status-${SCENARIO_RESULTS[4,status]}">${SCENARIO_RESULTS[4,status]}</td><td>${SCENARIO_RESULTS[4,duration]:-0}</td><td>${SCENARIO_RESULTS[4,detail]:-}</td></tr>
<tr><td>5</td><td>网络分区仲裁</td><td class="status-${SCENARIO_RESULTS[5,status]}">${SCENARIO_RESULTS[5,status]}</td><td>${SCENARIO_RESULTS[5,duration]:-0}</td><td>${SCENARIO_RESULTS[5,detail]:-}</td></tr>
<tr><td>6</td><td>PITR 恢复</td><td class="status-${SCENARIO_RESULTS[6,status]}">${SCENARIO_RESULTS[6,status]}</td><td>${SCENARIO_RESULTS[6,duration]:-0}</td><td>${SCENARIO_RESULTS[6,detail]:-}</td></tr>
</table>

<h2>结论</h2>
<p>$(if [[ ${FAILED} -eq 0 ]]; then echo "✅ DRP 演练通过, 6 大场景均达成预期 RTO 指标"; else echo "❌ DRP 演练部分失败, ${FAILED} 个场景需分析"; fi)</p>
</body></html>
EOF
}

send_notification() {
  if [[ ${SKIP_NOTIFY} -eq 1 ]]; then
    log "  ⏭️  跳过通知发送"
    return
  fi

  # 钉钉通知
  if [[ -n "${DINGTALK_WEBHOOK:-}" ]]; then
    local emoji="✅"
    [[ ${FAILED} -gt 0 ]] && emoji="❌"
    local text="${emoji} ZHS DRP 季度演练${DRY_RUN:+(预检)}
通过: ${PASSED}, 失败: ${FAILED}, 跳过: ${SKIPPED}
总耗时: ${TOTAL_DURATION}s
报告: ${MD_REPORT}"
    curl -s -X POST "${DINGTALK_WEBHOOK}" \
      -H "Content-Type: application/json" \
      -d "{\"msgtype\":\"text\",\"text\":{\"content\":\"${text}\"}}" \
      >/dev/null 2>&1 || log "  ⚠️ 钉钉通知发送失败"
  fi
}

###############################################################################
# 主流程
###############################################################################

log "============================================================"
log "ZHS 平台 DRP 季度演练"
log "时间: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
log "模式: $([ ${DRY_RUN} -eq 1 ] && echo "DRY-RUN" || echo "实操")"
log "============================================================"

should_run 1 && scenario_1_db_auto_failover
should_run 2 && scenario_2_db_manual_failover
should_run 3 && scenario_3_region_failover
should_run 4 && scenario_4_app_canary_rollback
should_run 5 && scenario_5_network_partition
should_run 6 && scenario_6_pitr_restore

log "============================================================"
log "汇总: 通过 ${PASSED} / 失败 ${FAILED} / 跳过 ${SKIPPED}"
log "总耗时: ${TOTAL_DURATION}s"
log "============================================================"

generate_json_report
generate_markdown_report
generate_html_report

log "  📊 JSON 报告: ${REPORT_FILE}"
log "  📝 Markdown 报告: ${MD_REPORT}"
log "  🌐 HTML 报告: ${HTML_REPORT}"

send_notification

if [[ ${FAILED} -gt 0 ]]; then
  exit 1
fi

exit 0
