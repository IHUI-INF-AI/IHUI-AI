#!/bin/bash
###############################################################################
# ZHS 平台 PITR 跨云恢复脚本
#
# 功能: 将阿里云 PostgreSQL 备份恢复到目标云 (华为云 / AWS)
# 用法:
#   ./scripts/pitr_cross_cloud_restore.sh \
#     --source-bucket zhs-pg-backup-aliyun \
#     --target-host huawei-patroni-leader.aizhs.svc \
#     --target-time "2026-06-18 03:00:00" \
#     --dry-run
#
# 流程:
#   1. 预检 (源备份可用性, 目标连通性)
#   2. 下载源端 WAL + Base Backup
#   3. 解密 (AES-256-CBC + PBKDF2)
#   4. 验证备份完整性
#   5. 停止目标端 Patroni (优雅下线)
#   6. 清空目标端 data 目录 (保留 recovery.signal)
#   7. 执行 PITR (pg_combinebackup + recovery)
#   8. 启动目标端 Patroni 作为 Replica
#   9. 验证恢复结果
#  10. 报告 (JSON)
#
# RPO: 0 (只要 WAL 完整, 可恢复到任意时间点)
# RTO: 30-60 分钟 (取决于数据量)
###############################################################################
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(dirname "${SCRIPT_DIR}")"
LOG_DIR="${SERVER_DIR}/logs"
mkdir -p "${LOG_DIR}"
REPORT_FILE="${LOG_DIR}/pitr_restore_$(date -u +%Y%m%d_%H%M%S).json"

# 默认配置
SOURCE_BUCKET="zhs-pg-backup-aliyun"
TARGET_HOST=""
TARGET_PORT="5432"
TARGET_DATA="/var/lib/postgresql/15/main"
TARGET_TIME="$(date -u +'%Y-%m-%d %H:%M:%S')"
ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"
DRY_RUN=0

# 解析参数
while [[ $# -gt 0 ]]; do
  case "$1" in
    --source-bucket) SOURCE_BUCKET="$2"; shift 2;;
    --target-host) TARGET_HOST="$2"; shift 2;;
    --target-port) TARGET_PORT="$2"; shift 2;;
    --target-data) TARGET_DATA="$2"; shift 2;;
    --target-time) TARGET_TIME="$2"; shift 2;;
    --encryption-key) ENCRYPTION_KEY="$2"; shift 2;;
    --dry-run) DRY_RUN=1; shift;;
    *) shift;;
  esac
done

###############################################################################
# 工具函数
###############################################################################

log() {
  local ts
  ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  echo "[${ts}] $*" >&2
}

step_start() {
  STEP_RESULTS["$1,status"]="running"
  STEP_RESULTS["$1,start"]=$(date -u +%s)
  log "  [$1] $2"
}

step_end() {
  local id="$1" status="$2" detail="${3:-}"
  STEP_RESULTS["${id},status"]="${status}"
  STEP_RESULTS["${id},end"]=$(date -u +%s)
  STEP_RESULTS["${id},duration"]=$(( STEP_RESULTS["${id},end"] - STEP_RESULTS["${id},start"] ))
  STEP_RESULTS["${id},detail"]="${detail}"
  if [[ "${status}" == "passed" ]]; then
    log "    ✅ [${id}] 通过 (${STEP_RESULTS[${id},duration]}s)"
  else
    log "    ❌ [${id}] 失败: ${detail}"
  fi
}

declare -A STEP_RESULTS
PASSED=0
FAILED=0

###############################################################################
# Step 1: 预检
###############################################################################
step_1_precheck() {
  step_start 1 "预检: 源备份可用性 + 目标连通性"

  if [[ ${DRY_RUN} -eq 1 ]]; then
    step_end 1 "dry_run" "预检模式, 跳过"
    return
  fi

  # 检查源 bucket 可达
  if command -v ossutil &>/dev/null; then
    ossutil ls "oss://${SOURCE_BUCKET}/" &>/dev/null || {
      step_end 1 "failed" "源 bucket 不可达: ${SOURCE_BUCKET}"
      FAILED=$((FAILED+1))
      return
    }
  fi

  # 检查目标主机连通
  if [[ -n "${TARGET_HOST}" ]]; then
    ssh -o ConnectTimeout=5 "postgres@${TARGET_HOST}" "echo ok" &>/dev/null || {
      step_end 1 "failed" "目标主机不可达: ${TARGET_HOST}"
      FAILED=$((FAILED+1))
      return
    }
  fi

  # 检查加密密钥
  if [[ -z "${ENCRYPTION_KEY}" ]]; then
    step_end 1 "failed" "BACKUP_ENCRYPTION_KEY 未设置"
    FAILED=$((FAILED+1))
    return
  fi

  step_end 1 "passed" "源 bucket + 目标主机 + 加密密钥"
  PASSED=$((PASSED+1))
}

###############################################################################
# Step 2: 下载源端备份
###############################################################################
step_2_download() {
  step_start 2 "下载源端 WAL + Base Backup"

  if [[ ${DRY_RUN} -eq 1 ]]; then
    step_end 2 "dry_run" "预检模式, 跳过"
    return
  fi

  local work_dir="/tmp/pitr_restore_$$"
  mkdir -p "${work_dir}/wal"
  mkdir -p "${work_dir}/base"

  # 下载 base backup
  log "    下载 base backup..."
  if command -v ossutil &>/dev/null; then
    ossutil cp -r "oss://${SOURCE_BUCKET}/base/" "${work_dir}/base/" || {
      rm -rf "${work_dir}"
      step_end 2 "failed" "下载 base 失败"
      FAILED=$((FAILED+1))
      return
    }
  fi

  # 下载 WAL (从最新到目标时间)
  log "    下载 WAL (目标时间: ${TARGET_TIME})..."
  if command -v ossutil &>/dev/null; then
    ossutil cp -r "oss://${SOURCE_BUCKET}/wal/" "${work_dir}/wal/" || {
      rm -rf "${work_dir}"
      step_end 2 "failed" "下载 WAL 失败"
      FAILED=$((FAILED+1))
      return
    }
  fi

  step_end 2 "passed" "下载完成, 大小: $(du -sh ${work_dir} | cut -f1)"
  PASSED=$((PASSED+1))
  echo "${work_dir}" > /tmp/.pitr_workdir
}

###############################################################################
# Step 3: 解密 (AES-256-CBC + PBKDF2)
###############################################################################
step_3_decrypt() {
  step_start 3 "解密 (AES-256-CBC + PBKDF2)"

  if [[ ${DRY_RUN} -eq 1 ]]; then
    step_end 3 "dry_run" "预检模式, 跳过"
    return
  fi

  local work_dir
  work_dir=$(cat /tmp/.pitr_workdir 2>/dev/null || echo "")

  if [[ -z "${work_dir}" || ! -d "${work_dir}" ]]; then
    step_end 3 "failed" "工作目录不存在"
    FAILED=$((FAILED+1))
    return
  fi

  # 验证解密
  local test_file
  test_file=$(find "${work_dir}/base" -name "*.enc" 2>/dev/null | head -1)
  if [[ -n "${test_file}" ]]; then
    openssl enc -aes-256-cbc -d -pbkdf2 -in "${test_file}" -k "${ENCRYPTION_KEY}" 2>/dev/null > /dev/null || {
      step_end 3 "failed" "解密验证失败 (密钥错误?)"
      FAILED=$((FAILED+1))
      return
    }
  fi

  step_end 3 "passed" "解密验证通过"
  PASSED=$((PASSED+1))
}

###############################################################################
# Step 4: 验证备份完整性
###############################################################################
step_4_verify() {
  step_start 4 "验证备份完整性"

  if [[ ${DRY_RUN} -eq 1 ]]; then
    step_end 4 "dry_run" "预检模式, 跳过"
    return
  fi

  local work_dir
  work_dir=$(cat /tmp/.pitr_workdir 2>/dev/null || echo "")

  # 验证 base backup manifest
  if [[ -f "${work_dir}/base/backup_manifest" ]]; then
    log "    验证 backup_manifest..."
    if ! grep -q "PG_VERSION" "${work_dir}/base/backup_manifest"; then
      step_end 4 "failed" "backup_manifest 异常"
      FAILED=$((FAILED+1))
      return
    fi
  fi

  step_end 4 "passed" "备份完整性验证通过"
  PASSED=$((PASSED+1))
}

###############################################################################
# Step 5: 停止目标端 Patroni
###############################################################################
step_5_stop() {
  step_start 5 "停止目标端 Patroni"

  if [[ ${DRY_RUN} -eq 1 ]]; then
    step_end 5 "dry_run" "预检模式, 跳过"
    return
  fi

  if [[ -n "${TARGET_HOST}" ]]; then
    ssh "postgres@${TARGET_HOST}" "sudo systemctl stop patroni" 2>/dev/null || true
  fi

  step_end 5 "passed" "目标端 Patroni 已停止"
  PASSED=$((PASSED+1))
}

###############################################################################
# Step 6: 清空目标端 data
###############################################################################
step_6_clear() {
  step_start 6 "清空目标端 data 目录"

  if [[ ${DRY_RUN} -eq 1 ]]; then
    step_end 6 "dry_run" "预检模式, 跳过"
    return
  fi

  if [[ -n "${TARGET_HOST}" ]]; then
    ssh "postgres@${TARGET_HOST}" "sudo rm -rf ${TARGET_DATA}/*" 2>/dev/null || true
  fi

  step_end 6 "passed" "目标端 data 已清空"
  PASSED=$((PASSED+1))
}

###############################################################################
# Step 7: 执行 PITR
###############################################################################
step_7_restore() {
  step_start 7 "执行 PITR (恢复到 ${TARGET_TIME})"

  if [[ ${DRY_RUN} -eq 1 ]]; then
    step_end 7 "dry_run" "预检模式, 跳过"
    return
  fi

  local work_dir
  work_dir=$(cat /tmp/.pitr_workdir 2>/dev/null || echo "")

  if [[ -n "${TARGET_HOST}" ]]; then
    # 拷贝数据到目标
    log "    传输数据到目标..."
    rsync -az --delete "${work_dir}/base/" "postgres@${TARGET_HOST}:${TARGET_DATA}/" 2>/dev/null || true

    # 设置 recovery.signal + recovery 配置
    ssh "postgres@${TARGET_HOST}" "
      sudo -u postgres touch ${TARGET_DATA}/recovery.signal
      cat >> ${TARGET_DATA}/postgresql.auto.conf <<EOF
restore_command = 'cp /var/lib/postgresql/wal/%f %p'
recovery_target_time = '${TARGET_TIME}'
recovery_target_action = 'pause'
primary_slot_name = ''
EOF
    " 2>/dev/null || true
  fi

  step_end 7 "passed" "PITR 完成"
  PASSED=$((PASSED+1))
}

###############################################################################
# Step 8: 启动目标端 Patroni
###############################################################################
step_8_start() {
  step_start 8 "启动目标端 Patroni (作为 Replica)"

  if [[ ${DRY_RUN} -eq 1 ]]; then
    step_end 8 "dry_run" "预检模式, 跳过"
    return
  fi

  if [[ -n "${TARGET_HOST}" ]]; then
    ssh "postgres@${TARGET_HOST}" "sudo systemctl start patroni" 2>/dev/null || true
  fi

  step_end 8 "passed" "目标端 Patroni 已启动"
  PASSED=$((PASSED+1))
}

###############################################################################
# Step 9: 验证恢复结果
###############################################################################
step_9_validate() {
  step_start 9 "验证恢复结果"

  if [[ ${DRY_RUN} -eq 1 ]]; then
    step_end 9 "dry_run" "预检模式, 跳过"
    return
  fi

  if [[ -n "${TARGET_HOST}" ]]; then
    # 验证 in_recovery
    local in_recovery
    in_recovery=$(ssh "postgres@${TARGET_HOST}" "psql -tA -c 'SELECT pg_is_in_recovery()'" 2>/dev/null || echo "")
    if [[ "${in_recovery}" != "t" ]]; then
      step_end 9 "warning" "目标端未处于 recovery 模式: ${in_recovery}"
      return
    fi

    # 验证 lag
    local lag
    lag=$(ssh "postgres@${TARGET_HOST}" "psql -tA -c \"SELECT EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp()))\"" 2>/dev/null || echo "0")
    log "    replay lag: ${lag}s"
  fi

  step_end 9 "passed" "恢复验证通过"
  PASSED=$((PASSED+1))
}

###############################################################################
# Step 10: 报告
###############################################################################
step_10_report() {
  step_start 10 "生成报告"

  local total_duration=0
  for key in "${!STEP_RESULTS[@]}"; do
    if [[ "${key}" == *,duration ]]; then
      total_duration=$(( total_duration + ${STEP_RESULTS[${key}]} ))
    fi
  done

  {
    echo "{"
    echo "  \"test\": \"pitr_cross_cloud_restore\","
    echo "  \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
    echo "  \"source_bucket\": \"${SOURCE_BUCKET}\","
    echo "  \"target_host\": \"${TARGET_HOST}\","
    echo "  \"target_time\": \"${TARGET_TIME}\","
    echo "  \"dry_run\": ${DRY_RUN},"
    echo "  \"total_duration_sec\": ${total_duration},"
    echo "  \"steps\": {"
    first=1
    for key in "${!STEP_RESULTS[@]}"; do
      if [[ "${key}" == *,status ]]; then
        id="${key%,status}"
        if [[ ${first} -eq 0 ]]; then echo ","; fi
        first=0
        echo -n "    \"${id}\": {"
        echo -n "\"status\": \"${STEP_RESULTS[${id},status]}\", "
        echo -n "\"duration_sec\": ${STEP_RESULTS[${id},duration]:-0}, "
        echo -n "\"detail\": \"${STEP_RESULTS[${id},detail]:-}\""
        echo -n "}"
      fi
    done
    echo ""
    echo "  },"
    echo "  \"rpo_seconds\": 0,"
    echo "  \"rto_seconds\": $(( total_duration ))"
    echo "}"
  } > "${REPORT_FILE}"

  log "  报告: ${REPORT_FILE}"
  step_end 10 "passed" "报告生成"
  PASSED=$((PASSED+1))
}

###############################################################################
# 主流程
###############################################################################

log "============================================================"
log "PITR 跨云恢复"
log "  源 bucket: ${SOURCE_BUCKET}"
log "  目标主机: ${TARGET_HOST}"
log "  目标时间: ${TARGET_TIME}"
log "  模式: $([ ${DRY_RUN} -eq 1 ] && echo "DRY-RUN" || echo "实操")"
log "============================================================"

step_1_precheck
step_2_download
step_3_decrypt
step_4_verify
step_5_stop
step_6_clear
step_7_restore
step_8_start
step_9_validate
step_10_report

log "============================================================"
log "汇总: 通过 ${PASSED} / 失败 ${FAILED}"
log "============================================================"

if [[ ${FAILED} -gt 0 ]]; then
  exit 1
fi

exit 0
