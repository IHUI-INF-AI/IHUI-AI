#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# IHUI-AI 数据库备份脚本
# ------------------------------------------------------------
# 用法:
#   ./backup-db.sh full                   全量备份(pg_dump | gzip)
#   ./backup-db.sh incremental            增量备份(WAL 归档切换 + 复制)
#   ./backup-db.sh --help                 显示帮助
#
# 备份文件命名:
#   全量:    ihui-db-YYYYMMDD-HHmmss.sql.gz
#   增量:    ihui-db-wal-YYYYMMDD-HHmmss.tar.gz
#
# 保留策略:
#   - 每日备份保留 7 天
#   - 每周备份(周日)保留 4 周
#   - 每月备份(每月 1 号)保留 6 个月
#
# OSS 上传(可选):
#   配置环境变量 OSS_BUCKET 后启用,使用 ossutil 或 aws s3 上传
#   必填: OSS_BUCKET, OSS_ENDPOINT(阿里云 OSS)
#   可选: OSS_PREFIX(默认 ihui-backup/db)
#
# 备份完整性校验:
#   gzip -t <file> 校验,失败则删除并标记本次备份失败
#
# 依赖: pg_dump / psql / gzip / tar / (可选) ossutil 或 aws-cli
# ============================================================

# ── 配置 ──
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# 数据库连接(优先使用环境变量,其次默认值)
PG_HOST="${PG_HOST:-127.0.0.1}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-ihui}"
PG_DB="${PG_DB:-ihui}"
# 密码通过 ~/.pgpass 或 PGPASSWORD 环境变量传递,不在脚本里硬编码

# 备份目录
BACKUP_DIR="${BACKUP_DIR:-/var/backups/ihui/db}"
# WAL 归档目录(PostgreSQL archive_command 写入此目录)
WAL_ARCHIVE_DIR="${WAL_ARCHIVE_DIR:-/var/backups/ihui/wal}"

# 保留策略(天)
RETAIN_DAILY_DAYS=7
RETAIN_WEEKLY_WEEKS=4
RETAIN_MONTHLY_MONTHS=6

# OSS 配置(可选)
OSS_BUCKET="${OSS_BUCKET:-}"
OSS_ENDPOINT="${OSS_ENDPOINT:-oss-cn-hangzhou.aliyuncs.com}"
OSS_PREFIX="${OSS_PREFIX:-ihui-backup/db}"

LOG_FILE="/var/log/ihui-backup.log"

# ── 颜色 ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ── 函数 ──
log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()  { echo -e "${BLUE}[STEP]${NC} $1"; }

log_persist() {
  local level=$1; shift
  local ts
  ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  echo "[${ts}] [${level}] [backup-db] $*" | tee -a "${LOG_FILE}" >&2 || true
}

ensure_dirs() {
  mkdir -p "${BACKUP_DIR}"
  mkdir -p "${WAL_ARCHIVE_DIR}"
  mkdir -p "$(dirname "${LOG_FILE}")" 2>/dev/null || true
}

# 生成时间戳文件名
# $1 = 类型(full|wal)
gen_filename() {
  local type=$1
  local ts
  ts=$(date +"%Y%m%d-%H%M%S")
  if [[ "${type}" == "full" ]]; then
    echo "ihui-db-${ts}.sql.gz"
  else
    echo "ihui-db-wal-${ts}.tar.gz"
  fi
}

# 校验 gzip 完整性,失败删除文件并返回 1
# $1 = 文件路径
verify_gzip() {
  local f=$1
  if gzip -t "${f}" 2>/dev/null; then
    log_info "完整性校验通过: ${f}"
    return 0
  else
    log_error "完整性校验失败,删除损坏文件: ${f}"
    rm -f "${f}"
    return 1
  fi
}

# ── 全量备份 ──
cmd_full() {
  local filename filepath
  filename=$(gen_filename full)
  filepath="${BACKUP_DIR}/${filename}"

  log_step "开始全量备份"
  log_info "主机: ${PG_HOST}:${PG_PORT}  数据库: ${PG_DB}"
  log_info "目标文件: ${filepath}"

  # pg_dump 选项:
  #   --no-owner --no-privileges 避免恢复时 owner 不匹配
  #   --format=plain 纯文本 + gzip 兼容性更好
  # PGPASSWORD 通过环境变量传递(不写在命令行,避免 ps 泄露)
  log_info "pg_dump | gzip 生成 ${filepath}"
  if ! PGPASSWORD="${PGPASSWORD:-}" pg_dump \
        -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" \
        -d "${PG_DB}" \
        --no-owner --no-privileges \
        --format=plain \
        2>/tmp/pgdump-err.$$ | gzip -9 > "${filepath}"; then
    log_error "pg_dump | gzip 失败:"
    cat /tmp/pgdump-err.$$ >&2 || true
    rm -f /tmp/pgdump-err.$$ "${filepath}"
    log_persist ERROR "full backup FAILED at pg_dump|gzip"
    exit 1
  fi
  rm -f /tmp/pgdump-err.$$

  # 完整性校验
  if ! verify_gzip "${filepath}"; then
    log_persist ERROR "full backup FAILED integrity check"
    exit 1
  fi

  local size
  size=$(du -h "${filepath}" | cut -f1)
  log_info "全量备份完成: ${filepath} (${size})"

  # 应用保留策略
  apply_retention

  # 上传 OSS
  upload_oss "${filepath}"

  log_persist INFO "full backup OK: ${filepath} (${size})"
}

# ── 增量备份(WAL 归档) ──
cmd_incremental() {
  local filename filepath
  filename=$(gen_filename wal)
  filepath="${BACKUP_DIR}/${filename}"

  log_step "开始增量备份(WAL 归档)"

  # 1. 强制切换 WAL,确保当前 WAL 段被归档
  log_info "SELECT pg_switch_wal() 强制切换 WAL 段"
  if ! PGPASSWORD="${PGPASSWORD:-}" psql \
        -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" \
        -d "${PG_DB}" \
        -t -c "SELECT pg_switch_wal();" >/dev/null 2>/tmp/psql-err.$$; then
    log_error "pg_switch_wal 失败:"
    cat /tmp/psql-err.$$ >&2 || true
    rm -f /tmp/psql-err.$$
    log_persist ERROR "incremental backup FAILED at pg_switch_wal"
    exit 1
  fi
  rm -f /tmp/psql-err.$$

  # 2. 等待 2s 让归档进程完成写入
  sleep 2

  # 3. 打包归档目录中的新 WAL 文件
  if [[ ! -d "${WAL_ARCHIVE_DIR}" ]]; then
    log_error "WAL 归档目录不存在: ${WAL_ARCHIVE_DIR}"
    log_warn  "请确认 postgresql.conf 中 archive_command 写入此目录"
    exit 1
  fi

  local wal_count
  wal_count=$(find "${WAL_ARCHIVE_DIR}" -type f | wc -l)
  if [[ "${wal_count}" -eq 0 ]]; then
    log_warn "WAL 归档目录为空,跳过本次增量备份"
    log_persist WARN "incremental backup SKIPPED (empty WAL archive)"
    return 0
  fi

  log_info "打包 ${wal_count} 个 WAL 文件 → ${filepath}"
  if ! tar -czf "${filepath}" -C "${WAL_ARCHIVE_DIR}" . 2>/tmp/tar-err.$$; then
    log_error "tar 打包失败:"
    cat /tmp/tar-err.$$ >&2 || true
    rm -f /tmp/tar-err.$$ "${filepath}"
    log_persist ERROR "incremental backup FAILED at tar"
    exit 1
  fi
  rm -f /tmp/tar-err.$$

  # 完整性校验(tar.gz 也是 gzip)
  if ! verify_gzip "${filepath}"; then
    log_persist ERROR "incremental backup FAILED integrity check"
    exit 1
  fi

  local size
  size=$(du -h "${filepath}" | cut -f1)
  log_info "增量备份完成: ${filepath} (${size})"

  # 应用保留策略
  apply_retention

  # 上传 OSS
  upload_oss "${filepath}"

  log_persist INFO "incremental backup OK: ${filepath} (${size})"
}

# ── 保留策略 ──
# 简化版:
#   - 文件名带 YYYYMMDD,根据日期判断保留
#   - 每日备份保留 7 天(< 7 天的全保留)
#   - 每周备份保留 4 周(周日创建的保留 28 天)
#   - 每月备份保留 6 个月(每月 1 号创建的保留 180 天)
# 其他超过保留期的删除
apply_retention() {
  log_step "应用保留策略"
  local now deleted=0
  now=$(date +%s)

  while IFS= read -r -d '' f; do
    local fname date_str epoch age_days
    fname=$(basename "${f}")
    # 从文件名提取 YYYYMMDD
    if [[ "${fname}" =~ ihui-db-(wal-)?([0-9]{8})-[0-9]{6}\.(sql|tar)\.gz ]]; then
      date_str="${BASH_REMATCH[2]}"
    else
      continue
    fi

    # 转 epoch(YYYYMMDD → YYYY-MM-DD)
    local iso="${date_str:0:4}-${date_str:4:2}-${date_str:6:2}"
    epoch=$(date -d "${iso}" +%s 2>/dev/null || date -jf '%Y-%m-%d' "${iso}" +%s 2>/dev/null || echo 0)
    [[ "${epoch}" == "0" ]] && continue

    age_days=$(( (now - epoch) / 86400 ))

    local dom dow
    dom=$(date -d "${iso}" +%-d 2>/dev/null || date -jf '%Y-%m-%d' "${iso}" +%-d 2>/dev/null || echo 0)
    dow=$(date -d "${iso}" +%u 2>/dev/null || date -jf '%Y-%m-%d' "${iso}" +%u 2>/dev/null || echo 0)

    local keep=false
    # 每日备份:7 天内保留
    if [[ ${age_days} -le ${RETAIN_DAILY_DAYS} ]]; then
      keep=true
    # 每周备份:周日创建 + 28 天内保留
    elif [[ "${dow}" == "7" && ${age_days} -le $((RETAIN_WEEKLY_WEEKS * 7)) ]]; then
      keep=true
    # 每月备份:1 号创建 + 180 天内保留
    elif [[ "${dom}" == "1" && ${age_days} -le $((RETAIN_MONTHLY_MONTHS * 30)) ]]; then
      keep=true
    fi

    if [[ "${keep}" == "false" ]]; then
      log_info "删除过期备份: ${fname} (age=${age_days}d)"
      rm -f "${f}"
      deleted=$((deleted + 1))
    fi
  done < <(find "${BACKUP_DIR}" -type f -name 'ihui-db-*.gz' -print0)

  log_info "保留策略执行完成,删除 ${deleted} 个过期备份"
}

# ── OSS 上传(可选) ──
# $1 = 本地文件路径
upload_oss() {
  local f=$1
  local fname
  fname=$(basename "${f}")

  if [[ -z "${OSS_BUCKET}" ]]; then
    return 0  # 未启用 OSS,跳过
  fi

  log_step "上传到 OSS: oss://${OSS_BUCKET}/${OSS_PREFIX}/${fname}"

  # 优先使用 ossutil(阿里云 OSS)
  if command -v ossutil >/dev/null 2>&1; then
    if ossutil cp "${f}" "oss://${OSS_BUCKET}/${OSS_PREFIX}/${fname}" \
        -e "${OSS_ENDPOINT}" \
        --force >/tmp/ossutil-out.$$ 2>&1; then
      log_info "OSS 上传成功(ossutil)"
      rm -f /tmp/ossutil-out.$$
      return 0
    else
      log_warn "ossutil 上传失败:"
      cat /tmp/ossutil-out.$$ >&2 || true
      rm -f /tmp/ossutil-out.$$
      return 1
    fi
  fi

  # 兼容 aws s3 cli(S3 兼容协议)
  if command -v aws >/dev/null 2>&1; then
    local s3_endpoint
    s3_endpoint="https://${OSS_ENDPOINT}"
    if AWS_S3_ENDPOINT="${s3_endpoint}" aws s3 cp "${f}" \
        "s3://${OSS_BUCKET}/${OSS_PREFIX}/${fname}" \
        --endpoint-url "${s3_endpoint}" >/tmp/aws-out.$$ 2>&1; then
      log_info "OSS 上传成功(aws s3)"
      rm -f /tmp/aws-out.$$
      return 0
    else
      log_warn "aws s3 上传失败:"
      cat /tmp/aws-out.$$ >&2 || true
      rm -f /tmp/aws-out.$$
      return 1
    fi
  fi

  log_warn "未找到 ossutil 或 aws cli,跳过 OSS 上传"
  log_warn "请安装: ossutil(阿里云) 或 awscli(S3 兼容)"
  return 1
}

# ── 用法 ──
usage() {
  cat <<EOF
用法: $0 <command>

命令:
  full          全量备份(pg_dump | gzip)
  incremental   增量备份(WAL 归档切换 + 打包)
  -h, --help    显示本帮助

环境变量:
  PG_HOST           PostgreSQL 主机(默认 127.0.0.1)
  PG_PORT           PostgreSQL 端口(默认 5432)
  PG_USER           PostgreSQL 用户(默认 ihui)
  PG_DB             PostgreSQL 数据库(默认 ihui)
  PGPASSWORD        PostgreSQL 密码(或用 ~/.pgpass)
  BACKUP_DIR        本地备份目录(默认 /var/backups/ihui/db)
  WAL_ARCHIVE_DIR   WAL 归档目录(默认 /var/backups/ihui/wal)
  OSS_BUCKET        配置后启用 OSS 上传(默认空=不上传)
  OSS_ENDPOINT      OSS 端点(默认 oss-cn-hangzhou.aliyuncs.com)
  OSS_PREFIX        OSS 对象前缀(默认 ihui-backup/db)

保留策略:
  每日备份保留 ${RETAIN_DAILY_DAYS} 天
  每周备份(周日)保留 ${RETAIN_WEEKLY_WEEKS} 周
  每月备份(1 号)保留 ${RETAIN_MONTHLY_MONTHS} 个月

示例:
  # 全量备份
  PGPASSWORD=xxx $0 full

  # 增量备份(crontab 每 6 小时)
  0 */6 * * * PGPASSWORD=xxx $0 incremental

  # 全量 + 上传 OSS
  PGPASSWORD=xxx OSS_BUCKET=my-bucket $0 full

文件命名:
  全量: ihui-db-YYYYMMDD-HHmmss.sql.gz
  增量: ihui-db-wal-YYYYMMDD-HHmmss.tar.gz
EOF
}

# ── 主逻辑 ──
main() {
  ensure_dirs
  case "${1:-}" in
    full)
      cmd_full
      ;;
    incremental)
      cmd_incremental
      ;;
    -h|--help|help|"")
      usage
      ;;
    *)
      echo "未知命令: ${1}" >&2
      usage
      exit 2
      ;;
  esac
}

main "$@"
