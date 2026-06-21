#!/bin/bash
# PostgreSQL 14 → 16 逻辑升级脚本
#
# 方案: A (逻辑升级, pg_dump/restore)
# 停机时间: 30-60 分钟 (取决于数据量)
# 风险: 低 (逻辑备份可验证)
#
# 前置条件:
#   1. PG14 运行在 localhost:5432
#   2. PG16 已通过 deploy/docker/docker-compose.pg16-upgrade.yml 启动在 localhost:5433
#   3. 已执行完整备份 (backup_pg.sh + backup_pg_encrypted.sh)
#
# 用法: ./scripts/upgrade_pg14_to_pg16.sh
set -euo pipefail

PG14_HOST="${PG14_HOST:-127.0.0.1}"
PG14_PORT="${PG14_PORT:-5432}"
PG16_HOST="${PG16_HOST:-127.0.0.1}"
PG16_PORT="${PG16_PORT:-5433}"
PG_USER="${PG_USER:-zhs}"
PG_PASSWORD="${PG_PASSWORD:-zhs_pg_pass}"
DATABASES=("zhs_ai_project" "zhs_center_project" "zhs_educational_training")
BACKUP_DIR="${BACKUP_DIR:-/tmp/pg_upgrade}"
TS=$(date +%Y%m%d_%H%M%S)

export PGPASSWORD="${PG_PASSWORD}"

mkdir -p "${BACKUP_DIR}"

echo "============================================================"
echo "PostgreSQL 14 → 16 逻辑升级"
echo "============================================================"
echo "PG14: ${PG14_HOST}:${PG14_PORT}"
echo "PG16: ${PG16_HOST}:${PG16_PORT}"
echo "数据库: ${DATABASES[*]}"
echo "备份目录: ${BACKUP_DIR}"
echo "时间戳: ${TS}"
echo "============================================================"

# ---------- 步骤 1: 预检 ----------
echo ""
echo "[步骤 1/6] 预检..."
echo "  - 检查 PG14 连通性..."
if ! pg_isready -h "${PG14_HOST}" -p "${PG14_PORT}" -U "${PG_USER}" >/dev/null 2>&1; then
  echo "  ❌ PG14 不可达: ${PG14_HOST}:${PG14_PORT}"
  exit 1
fi
echo "  ✅ PG14 可达"

echo "  - 检查 PG16 连通性..."
if ! pg_isready -h "${PG16_HOST}" -p "${PG16_PORT}" -U "${PG_USER}" >/dev/null 2>&1; then
  echo "  ❌ PG16 不可达: ${PG16_HOST}:${PG16_PORT}"
  echo "  请先启动: docker-compose -f deploy/docker/docker-compose.pg16-upgrade.yml up -d"
  exit 1
fi
echo "  ✅ PG16 可达"

echo "  - 检查 PG14 版本..."
PG14_VERSION=$(psql -h "${PG14_HOST}" -p "${PG14_PORT}" -U "${PG_USER}" -d postgres -tAc "SHOW server_version;")
echo "  PG14 server_version: ${PG14_VERSION}"

echo "  - 检查 PG16 版本..."
PG16_VERSION=$(psql -h "${PG16_HOST}" -p "${PG16_PORT}" -U "${PG_USER}" -d postgres -tAc "SHOW server_version;")
echo "  PG16 server_version: ${PG16_VERSION}"

# ---------- 步骤 2: 全量备份 PG14 ----------
echo ""
echo "[步骤 2/6] 全量备份 PG14..."
for db in "${DATABASES[@]}"; do
  BACKUP_FILE="${BACKUP_DIR}/${db}_${TS}.sql.gz"
  echo "  - 备份 ${db} -> ${BACKUP_FILE}"
  if pg_dump -h "${PG14_HOST}" -p "${PG14_PORT}" -U "${PG_USER}" -d "${db}" \
    --format=plain --no-owner --no-privileges 2>/dev/null | gzip > "${BACKUP_FILE}"; then
    SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
    echo "    ✅ ${db} (${SIZE})"
  else
    echo "    ❌ ${db} 备份失败"
    exit 1
  fi
done

# ---------- 步骤 3: 恢复到 PG16 ----------
echo ""
echo "[步骤 3/6] 恢复到 PG16..."
for db in "${DATABASES[@]}"; do
  BACKUP_FILE="${BACKUP_DIR}/${db}_${TS}.sql.gz"
  echo "  - 创建数据库 ${db} (PG16)..."
  psql -h "${PG16_HOST}" -p "${PG16_PORT}" -U "${PG_USER}" -d postgres \
    -c "CREATE DATABASE ${db};" 2>/dev/null || echo "    (数据库已存在, 跳过创建)"

  echo "  - 恢复 ${db}..."
  if gunzip -c "${BACKUP_FILE}" | psql -h "${PG16_HOST}" -p "${PG16_PORT}" -U "${PG_USER}" -d "${db}" >/dev/null 2>&1; then
    echo "    ✅ ${db} 恢复成功"
  else
    echo "    ❌ ${db} 恢复失败"
    exit 1
  fi
done

# ---------- 步骤 4: 数据一致性验证 ----------
echo ""
echo "[步骤 4/6] 数据一致性验证..."
FAIL_COUNT=0
for db in "${DATABASES[@]}"; do
  echo "  - 验证 ${db}..."

  # 表数量
  PG14_TABLES=$(psql -h "${PG14_HOST}" -p "${PG14_PORT}" -U "${PG_USER}" -d "${db}" -tAc \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema');")
  PG16_TABLES=$(psql -h "${PG16_HOST}" -p "${PG16_PORT}" -U "${PG_USER}" -d "${db}" -tAc \
    "SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema');")

  if [ "${PG14_TABLES}" = "${PG16_TABLES}" ]; then
    echo "    ✅ 表数量一致: ${PG14_TABLES}"
  else
    echo "    ❌ 表数量不一致: PG14=${PG14_TABLES}, PG16=${PG16_TABLES}"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi

  # 总行数 (抽样)
  PG14_ROWS=$(psql -h "${PG14_HOST}" -p "${PG14_PORT}" -U "${PG_USER}" -d "${db}" -tAc \
    "SELECT coalesce(sum(n_live_tup),0) FROM pg_stat_user_tables;" 2>/dev/null || echo "0")
  PG16_ROWS=$(psql -h "${PG16_HOST}" -p "${PG16_PORT}" -U "${PG_USER}" -d "${db}" -tAc \
    "SELECT coalesce(sum(n_live_tup),0) FROM pg_stat_user_tables;" 2>/dev/null || echo "0")

  if [ "${PG14_ROWS}" = "${PG16_ROWS}" ]; then
    echo "    ✅ 行数一致: ${PG14_ROWS}"
  else
    echo "    ⚠️  行数差异: PG14=${PG14_ROWS}, PG16=${PG16_ROWS} (可能统计未更新)"
  fi

  # ANALYZE 更新统计
  psql -h "${PG16_HOST}" -p "${PG16_PORT}" -U "${PG_USER}" -d "${db}" -c "ANALYZE;" >/dev/null 2>&1 || true
done

# ---------- 步骤 5: 扩展兼容性检查 ----------
echo ""
echo "[步骤 5/6] 扩展兼容性检查..."
for db in "${DATABASES[@]}"; do
  echo "  - 检查 ${db} 扩展..."
  EXTENSIONS=$(psql -h "${PG16_HOST}" -p "${PG16_PORT}" -U "${PG_USER}" -d "${db}" -tAc \
    "SELECT extname FROM pg_extension WHERE extname NOT IN ('plpgsql');" 2>/dev/null || echo "")
  if [ -z "${EXTENSIONS}" ]; then
    echo "    ✅ 无第三方扩展"
  else
    echo "    ℹ️  扩展: ${EXTENSIONS}"
  fi
done

# ---------- 步骤 6: 生成切换指引 ----------
echo ""
echo "[步骤 6/6] 生成切换指引..."
echo "  ✅ 升级预验证完成"
echo ""
echo "  下一步切换操作:"
echo "    1. 停止应用: docker-compose stop api"
echo "    2. 修改 deploy/docker/docker-compose.yml: postgres:14-alpine → postgres:16-alpine"
echo "    3. 修改端口映射 (如需): 5433 → 5432"
echo "    4. 启动应用: docker-compose up -d"
echo "    5. 冒烟测试: curl http://localhost:8000/healthz"
echo "    6. 下线 PG14: docker-compose -f deploy/docker/docker-compose.pg16-upgrade.yml down"
echo ""
echo "  回滚方案:"
echo "    1. 停止应用"
echo "    2. 恢复 deploy/docker/docker-compose.yml: postgres:16-alpine → postgres:14-alpine"
echo "    3. 启动 PG14: docker-compose up -d postgres"
echo "    4. 启动应用"
echo ""

if [ "${FAIL_COUNT}" -gt 0 ]; then
  echo "============================================================"
  echo "❌ 升级验证失败 (${FAIL_COUNT} 项不一致)"
  echo "============================================================"
  exit 1
fi

echo "============================================================"
echo "✅ PostgreSQL 14 → 16 升级验证通过"
echo "============================================================"
exit 0
