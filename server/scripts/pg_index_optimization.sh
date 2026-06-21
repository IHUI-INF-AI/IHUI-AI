#!/bin/bash
# PostgreSQL 索引优化建议脚本
#
# 功能:
#   1. 检测缺失索引 (seq_scan 比例高的表)
#   2. 检测未使用的索引 (idx_scan = 0)
#   3. 检测膨胀严重的表 (n_dead_tup)
#   4. 生成索引优化建议
#
# 用法: ./scripts/pg_index_optimization.sh
set -euo pipefail

PG_HOST="${PG_HOST:-127.0.0.1}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-zhs}"
PG_PASSWORD="${PG_PASSWORD:-zhs_pg_pass}"
DATABASES=("zhs_ai_project" "zhs_center_project" "zhs_educational_training")
OUTPUT_DIR="${OUTPUT_DIR:-/tmp/pg_index_opt}"
TS=$(date +%Y%m%d_%H%M%S)

export PGPASSWORD="${PG_PASSWORD}"

mkdir -p "${OUTPUT_DIR}"

echo "============================================================"
echo "PostgreSQL 索引优化建议"
echo "============================================================"
echo ""

for db in "${DATABASES[@]}"; do
  echo "========== ${db} =========="

  # ---------- 1. 缺失索引检测 ----------
  echo ""
  echo "[1] 缺失索引检测 (seq_scan > 1000 且无索引):"
  psql -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d "${db}" -c "
SELECT
  schemaname || '.' || relname AS table_name,
  seq_scan,
  seq_tup_read,
  n_live_tup,
  CASE
    WHEN n_live_tup > 0 THEN round((seq_tup_read::numeric / n_live_tup), 2)
    ELSE 0
  END AS seq_ratio
FROM pg_stat_user_tables
WHERE seq_scan > 1000
  AND n_live_tup > 100
ORDER BY seq_scan DESC
LIMIT 10;
" 2>/dev/null || echo "  (无法查询)"

  # ---------- 2. 未使用索引检测 ----------
  echo ""
  echo "[2] 未使用索引 (idx_scan = 0, 可考虑删除):"
  psql -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d "${db}" -c "
SELECT
  schemaname || '.' || relname AS table_name,
  indexrelname AS index_name,
  idx_scan,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 10;
" 2>/dev/null || echo "  (无法查询)"

  # ---------- 3. 表膨胀检测 ----------
  echo ""
  echo "[3] 表膨胀检测 (n_dead_tup > 1000, 需 VACUUM):"
  psql -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d "${db}" -c "
SELECT
  schemaname || '.' || relname AS table_name,
  n_live_tup,
  n_dead_tup,
  CASE
    WHEN n_live_tup > 0 THEN round((n_dead_tup::numeric / n_live_tup * 100), 2)
    ELSE 0
  END AS dead_ratio_pct,
  last_autovacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY n_dead_tup DESC
LIMIT 10;
" 2>/dev/null || echo "  (无法查询)"

  echo ""
done

echo ""
echo "============================================================"
echo "✅ 索引优化建议生成完成"
echo "============================================================"
echo ""
echo "建议操作:"
echo "  1. 对 seq_scan 高的表添加索引 (CREATE INDEX)"
echo "  2. 删除 idx_scan=0 的未使用索引 (DROP INDEX)"
echo "  3. 对 n_dead_tup 高的表执行 VACUUM ANALYZE"
echo "  4. 定期监控 (建议每周执行一次)"
echo "============================================================"
exit 0
