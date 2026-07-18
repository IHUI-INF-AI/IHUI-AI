#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# IHUI-AI 数据库恢复脚本
# ------------------------------------------------------------
# 用法:
#   ./restore-db.sh latest                          恢复最新备份
#   ./restore-db.sh <filename>                      恢复指定备份文件
#   ./restore-db.sh latest --target-db ihui_test    恢复到指定数据库
#   ./restore-db.sh --help                          显示帮助
#
# 安全机制:
#   1. 恢复前自动备份当前数据库(防误操作)
#   2. 恢复前校验备份文件完整性(gzip -t)
#   3. 恢复后运行 schema 校验(检查关键表是否存在)
#   4. 必须显式确认(除非传入 --yes)
#
# 依赖: pg_dump / psql / gzip / gunzip
# ============================================================

# ── 配置 ──
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

PG_HOST="${PG_HOST:-127.0.0.1}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-ihui}"
PG_DB="${PG_DB:-ihui}"
PGSUPERUSER="${PGSUPERUSER:-postgres}"

BACKUP_DIR="${BACKUP_DIR:-/var/backups/ihui/db}"
PRE_RESTORE_DIR="${PRE_RESTORE_DIR:-/var/backups/ihui/pre-restore}"

LOG_FILE="/var/log/ihui-restore.log"

# schema 校验:必须存在的关键表(任一缺失视为恢复失败)
EXPECTED_TABLES="${EXPECTED_TABLES:-users roles menus sys_config}"

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
  echo "[${ts}] [${level}] [restore-db] $*" | tee -a "${LOG_FILE}" >&2 || true
}

ensure_dirs() {
  mkdir -p "${PRE_RESTORE_DIR}"
  mkdir -p "$(dirname "${LOG_FILE}")" 2>/dev/null || true
}

# 校验 gzip 完整性
# $1 = 文件路径
verify_gzip() {
  local f=$1
  log_info "校验备份文件完整性: ${f}"
  if gzip -t "${f}" 2>/dev/null; then
    log_info "完整性校验通过"
    return 0
  else
    log_error "完整性校验失败: ${f}"
    return 1
  fi
}

# 恢复前备份当前数据库(防误操作)
# $1 = 目标数据库名
pre_restore_backup() {
  local target_db=$1
  local ts filename filepath
  ts=$(date +"%Y%m%d-%H%M%S")
  filename="ihui-db-prerestore-${target_db}-${ts}.sql.gz"
  filepath="${PRE_RESTORE_DIR}/${filename}"

  log_step "恢复前备份当前数据库 ${target_db}"
  log_info "目标文件: ${filepath}"

  if ! PGPASSWORD="${PGPASSWORD:-}" pg_dump \
        -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" \
        -d "${target_db}" \
        --no-owner --no-privileges \
        --format=plain 2>/tmp/pgdump-err.$$ | gzip -9 > "${filepath}"; then
    log_error "恢复前备份失败:"
    cat /tmp/pgdump-err.$$ >&2 || true
    rm -f /tmp/pgdump-err.$$ "${filepath}"
    return 1
  fi
  rm -f /tmp/pgdump-err.$$

  if ! verify_gzip "${filepath}"; then
    log_error "恢复前备份完整性校验失败"
    return 1
  fi

  local size
  size=$(du -h "${filepath}" | cut -f1)
  log_info "恢复前备份完成: ${filepath} (${size})"
  log_warn "如恢复出错,可用此备份回滚: gunzip -c ${filepath} | psql -d ${target_db}"
  return 0
}

# schema 校验:检查关键表是否存在
# $1 = 目标数据库名
verify_schema() {
  local target_db=$1
  log_step "schema 校验: 检查关键表"
  log_info "期望表: ${EXPECTED_TABLES}"

  local missing=0
  for tbl in ${EXPECTED_TABLES}; do
    local exists
    exists=$(PGPASSWORD="${PGPASSWORD:-}" psql \
        -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" \
        -d "${target_db}" \
        -tAc "SELECT 1 FROM information_schema.tables WHERE table_name='${tbl}' LIMIT 1;" 2>/dev/null || echo "")
    if [[ "${exists}" == "1" ]]; then
      log_info "  ✓ ${tbl}"
    else
      log_error "  ✗ ${tbl} (缺失)"
      missing=$((missing + 1))
    fi
  done

  if [[ ${missing} -gt 0 ]]; then
    log_error "schema 校验失败: ${missing} 个关键表缺失"
    return 1
  fi
  log_info "schema 校验通过"
  return 0
}

# 查找最新备份文件
find_latest() {
  local latest
  latest=$(ls -1t "${BACKUP_DIR}"/ihui-db-*.sql.gz 2>/dev/null | head -n1 || true)
  if [[ -z "${latest}" ]]; then
    log_error "未找到任何备份文件: ${BACKUP_DIR}/ihui-db-*.sql.gz"
    exit 1
  fi
  echo "${latest}"
}

# 执行恢复
# $1 = 备份文件路径
# $2 = 目标数据库名
do_restore() {
  local backup_file=$1
  local target_db=$2

  if [[ ! -f "${backup_file}" ]]; then
    log_error "备份文件不存在: ${backup_file}"
    exit 1
  fi

  log_step "开始恢复"
  log_info "备份文件: ${backup_file}"
  log_info "目标数据库: ${target_db}"

  # 1. 校验完整性
  if ! verify_gzip "${backup_file}"; then
    log_persist ERROR "restore FAILED: integrity check failed for ${backup_file}"
    exit 1
  fi

  # 2. 恢复前备份当前数据库
  if ! pre_restore_backup "${target_db}"; then
    log_error "恢复前备份失败,中止恢复(避免数据丢失)"
    log_persist ERROR "restore FAILED: pre-restore backup failed"
    exit 1
  fi

  # 3. 恢复
  log_step "执行 gunzip | psql 恢复到 ${target_db}"
  # 用 ON_ERROR_STOP=1 让 psql 遇到错误立即停止
  if ! gunzip -c "${backup_file}" | PGPASSWORD="${PGPASSWORD:-}" psql \
        -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" \
        -d "${target_db}" \
        -v ON_ERROR_STOP=1 \
        -q 2>/tmp/psql-err.$$; then
    log_error "恢复失败:"
    cat /tmp/psql-err.$$ >&2 || true
    rm -f /tmp/psql-err.$$
    log_persist ERROR "restore FAILED: psql restore failed for ${target_db}"
    log_warn "如需回滚,使用恢复前备份: ls ${PRE_RESTORE_DIR}/"
    exit 1
  fi
  rm -f /tmp/psql-err.$$

  log_info "数据恢复完成"

  # 4. schema 校验
  if ! verify_schema "${target_db}"; then
    log_error "schema 校验失败,恢复可能不完整"
    log_persist ERROR "restore FAILED: schema validation failed for ${target_db}"
    log_warn "如需回滚,使用恢复前备份: ls ${PRE_RESTORE_DIR}/"
    exit 1
  fi

  log_info "数据库恢复成功: ${backup_file} → ${target_db}"
  log_persist INFO "restore OK: ${backup_file} -> ${target_db}"
}

# ── 用法 ──
usage() {
  cat <<EOF
用法: $0 <command> [options]

命令:
  latest                    恢复最新备份
  <filename>                恢复指定备份文件(绝对路径或相对 BACKUP_DIR)
  -h, --help                显示本帮助

选项:
  --target-db <name>        恢复到指定数据库(默认 ${PG_DB})
  --yes                     跳过确认提示(用于自动化)

环境变量:
  PG_HOST                   PostgreSQL 主机(默认 127.0.0.1)
  PG_PORT                   PostgreSQL 端口(默认 5432)
  PG_USER                   PostgreSQL 用户(默认 ihui)
  PG_DB                     默认目标数据库(默认 ihui)
  PGPASSWORD                PostgreSQL 密码(或用 ~/.pgpass)
  BACKUP_DIR                备份目录(默认 /var/backups/ihui/db)
  PRE_RESTORE_DIR           恢复前备份目录(默认 /var/backups/ihui/pre-restore)
  EXPECTED_TABLES           schema 校验的关键表(默认 "users roles menus sys_config")

示例:
  # 恢复最新备份到默认数据库
  PGPASSWORD=xxx $0 latest

  # 恢复指定备份
  PGPASSWORD=xxx $0 ihui-db-20260718-100000.sql.gz

  # 恢复到测试库(不覆盖生产库)
  PGPASSWORD=xxx $0 latest --target-db ihui_test

  # 自动化(跳过确认)
  PGPASSWORD=xxx $0 latest --yes

安全机制:
  1. 恢复前自动备份当前数据库到 ${PRE_RESTORE_DIR}
  2. 恢复前校验备份文件完整性(gzip -t)
  3. 恢复后 schema 校验(关键表: ${EXPECTED_TABLES})
  4. 默认需要手动确认,--yes 跳过
EOF
}

# ── 主逻辑 ──
main() {
  ensure_dirs

  local cmd="" target_db="${PG_DB}" skip_confirm=false backup_file=""

  # 解析参数
  while [[ $# -gt 0 ]]; do
    case "$1" in
      latest)
        cmd="latest"; shift
        ;;
      -h|--help|help)
        usage; exit 0
        ;;
      --target-db)
        target_db="$2"; shift 2
        ;;
      --yes)
        skip_confirm=true; shift
        ;;
      -*)
        log_error "未知选项: $1"; usage; exit 2
        ;;
      *)
        cmd="file"; backup_file="$1"; shift
        ;;
    esac
  done

  if [[ -z "${cmd}" ]]; then
    usage; exit 2
  fi

  # 解析备份文件路径
  if [[ "${cmd}" == "latest" ]]; then
    backup_file=$(find_latest)
  else
    # 支持相对 BACKUP_DIR 的路径
    if [[ ! -f "${backup_file}" && -f "${BACKUP_DIR}/${backup_file}" ]]; then
      backup_file="${BACKUP_DIR}/${backup_file}"
    fi
  fi

  # 确认提示
  if [[ "${skip_confirm}" != "true" ]]; then
    echo
    echo -e "${YELLOW}═══════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}⚠️  即将执行数据库恢复,此操作会覆盖目标数据库!${NC}"
    echo -e "${YELLOW}═══════════════════════════════════════════════════${NC}"
    echo "备份文件: ${backup_file}"
    echo "目标数据库: ${target_db} (@${PG_HOST}:${PG_PORT})"
    echo "恢复前会自动备份当前数据库到 ${PRE_RESTORE_DIR}"
    echo
    read -r -p "确认恢复? 输入 'yes' 继续: " confirm
    if [[ "${confirm}" != "yes" ]]; then
      log_warn "已取消"
      exit 0
    fi
  fi

  do_restore "${backup_file}" "${target_db}"
}

main "$@"
