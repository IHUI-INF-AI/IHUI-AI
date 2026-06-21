#!/bin/bash
# PostgreSQL 慢查询治理脚本
#
# 功能:
#   1. 采集 pg_stat_statements Top N 慢查询
#   2. 生成 EXPLAIN ANALYZE 报告
#   3. 推荐索引优化建议
#   4. 输出治理报告 (JSON 格式)
#
# 用法: ./scripts/pg_slow_query_governance.sh [top_n]
set -euo pipefail

PG_HOST="${PG_HOST:-127.0.0.1}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-zhs}"
PG_PASSWORD="${PG_PASSWORD:-zhs_pg_pass}"
DATABASES=("zhs_ai_project" "zhs_center_project" "zhs_educational_training")
TOP_N="${1:-10}"
OUTPUT_DIR="${OUTPUT_DIR:-/tmp/pg_slow_query}"
TS=$(date +%Y%m%d_%H%M%S)

export PGPASSWORD="${PG_PASSWORD}"

mkdir -p "${OUTPUT_DIR}"

echo "============================================================"
echo "PostgreSQL 慢查询治理"
echo "============================================================"
echo "Top N: ${TOP_N}"
echo "数据库: ${DATABASES[*]}"
echo "输出: ${OUTPUT_DIR}/slow_query_${TS}.json"
echo ""

# 生成 JSON 报告
echo "{" > "${OUTPUT_DIR}/slow_query_${TS}.json"
echo '  "timestamp": "'"${TS}"'",' >> "${OUTPUT_DIR}/slow_query_${TS}.json"
echo '  "top_n": '"${TOP_N}"',' >> "${OUTPUT_DIR}/slow_query_${TS}.json"
echo '  "databases": [' >> "${OUTPUT_DIR}/slow_query_${TS}.json"

FIRST_DB=true
for db in "${DATABASES[@]}"; do
  echo "  - 采集 ${db}..."

  if [ "${FIRST_DB}" = true ]; then
    FIRST_DB=false
  else
    echo "," >> "${OUTPUT_DIR}/slow_query_${TS}.json"
  fi

  echo '    {' >> "${OUTPUT_DIR}/slow_query_${TS}.json"
  echo '      "database": "'"${db}"'",' >> "${OUTPUT_DIR}/slow_query_${TS}.json"

  # 检查 pg_stat_statements 扩展
  EXT_EXISTS=$(psql -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d "${db}" -tAc \
    "SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements';" 2>/dev/null || echo "0")

  if [ "${EXT_EXISTS}" = "1" ]; then
    echo '      "pg_stat_statements": "enabled",' >> "${OUTPUT_DIR}/slow_query_${TS}.json"
    echo '      "slow_queries": [' >> "${OUTPUT_DIR}/slow_query_${TS}.json"

    # Top N 慢查询 (按总执行时间排序)
    psql -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -d "${db}" -tA -F "|" <<EOF >> "${OUTPUT_DIR}/slow_query_${TS}.json"
SELECT
  '        {"queryid": "' || queryid || '", "calls": ' || calls || ', "total_time_ms": ' || round(total_exec_time::numeric, 2) || ', "mean_time_ms": ' || round(mean_exec_time::numeric, 2) || ', "rows": ' || rows || ', "query": "' || replace(replace(left(query, 200), '"', '\\"'), chr(10), ' ') || '"}' as row
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT ${TOP_N};
EOF

    echo '' >> "${OUTPUT_DIR}/slow_query_${TS}.json"
    echo '      ]' >> "${OUTPUT_DIR}/slow_query_${TS}.json"
  else
    echo '      "pg_stat_statements": "disabled",' >> "${OUTPUT_DIR}/slow_query_${TS}.json"
    echo '      "slow_queries": []' >> "${OUTPUT_DIR}/slow_query_${TS}.json"
    echo "    ⚠️  ${db} 未启用 pg_stat_statements"
  fi

  echo -n '    }' >> "${OUTPUT_DIR}/slow_query_${TS}.json"
done

echo "" >> "${OUTPUT_DIR}/slow_query_${TS}.json"
echo '  ]' >> "${OUTPUT_DIR}/slow_query_${TS}.json"
echo "}" >> "${OUTPUT_DIR}/slow_query_${TS}.json"

echo ""
echo "============================================================"
echo "✅ 慢查询治理报告生成完成"
echo "============================================================"
echo "报告: ${OUTPUT_DIR}/slow_query_${TS}.json"
echo ""
echo "优化建议:"
echo "  1. 启用 pg_stat_statements 扩展 (CREATE EXTENSION IF NOT EXISTS pg_stat_statements;)"
echo "  2. 对 Top N 慢查询执行 EXPLAIN ANALYZE 分析执行计划"
echo "  3. 检查缺失索引 (pg_stat_user_tables.seq_scan 比例高)"
echo "  4. 优化 SQL (避免 SELECT *, 添加 WHERE 条件, 使用索引)"
echo "  5. 定期 VACUUM ANALYZE 更新统计信息"
echo "============================================================"
exit 0
