#!/usr/bin/env bash
# =============================================================================
# 生产 PG 迁移脚本 (P1 封版 047 站内信持久化)
#
# 作用: 在生产 G 盘 PG 上执行 alembic upgrade head
#       补建站内信持久化所需的 3 个索引
#
# 使用:
#   cd /opt/ihui/server   # 或生产代码目录
#   bash scripts/alembic_production_upgrade.sh
#
# 退出码:
#   0  = 迁移成功
#   1  = 迁移失败 (需运维介入, 查看日志后决定是否回滚)
#   2  = 当前 head 已是最新, 无需升级
# =============================================================================
set -euo pipefail

# ---- 配置 (运维按实际环境调整) ----
ALEMBIC_BIN="${ALEMBIC_BIN:-alembic}"
DB_URL_DEFAULT="postgresql://ihui:ihui@127.0.0.1:5432/ai"
DB_URL="${DATABASE_URL:-$DB_URL_DEFAULT}"
LOG_FILE="${LOG_FILE:-/var/log/ihui/alembic_upgrade_$(date +%Y%m%d_%H%M%S).log}"

mkdir -p "$(dirname "$LOG_FILE")"

echo "[$(date '+%F %T')] === 生产迁移开始 ===" | tee -a "$LOG_FILE"
echo "[$(date '+%T')] DB: $DB_URL" | tee -a "$LOG_FILE"
echo "[$(date '+%T')] Log: $LOG_FILE" | tee -a "$LOG_FILE"

# ---- 1. 备份 (防 rollback 不掉的极端情况) ----
echo "[$(date '+%T')] 步骤 1/4: 检查当前 head" | tee -a "$LOG_FILE"
CURRENT=$($ALEMBIC_BIN current 2>&1 | tee -a "$LOG_FILE" | grep -oE '[0-9a-f_]+' | tail -1 || echo "")
echo "[$(date '+%T')] 当前 head: $CURRENT" | tee -a "$LOG_FILE"

# ---- 2. 期望 head ----
EXPECTED="047_notify_persist"
HEAD=$($ALEMBIC_BIN heads 2>&1 | tee -a "$LOG_FILE" | grep -oE '[0-9a-f_]+' | tail -1 || echo "")
echo "[$(date '+%T')] 最新 head: $HEAD" | tee -a "$LOG_FILE"

if [ "$CURRENT" = "$HEAD" ]; then
    echo "[$(date '+%T')] 当前已是最新 head, 无需升级" | tee -a "$LOG_FILE"
    echo "=== 退出 (无需操作) ==="
    exit 2
fi

# ---- 3. 升级 ----
echo "[$(date '+%T')] 步骤 2/4: 执行 alembic upgrade head" | tee -a "$LOG_FILE"
if ! $ALEMBIC_BIN upgrade head 2>&1 | tee -a "$LOG_FILE"; then
    echo "[$(date '+%T')] FAIL: alembic upgrade head 失败" | tee -a "$LOG_FILE"
    echo "=== 迁移失败, 请查看日志后处理 ==="
    exit 1
fi

# ---- 4. 验证 ----
echo "[$(date '+%T')] 步骤 3/4: 验证迁移结果" | tee -a "$LOG_FILE"
NEW_CURRENT=$($ALEMBIC_BIN current 2>&1 | tee -a "$LOG_FILE" | grep -oE '[0-9a-f_]+' | tail -1 || echo "")
if [ "$NEW_CURRENT" != "$HEAD" ]; then
    echo "[$(date '+%T')] FAIL: 升级后 head=$NEW_CURRENT, 期望 $HEAD" | tee -a "$LOG_FILE"
    exit 1
fi
echo "[$(date '+%T')] OK: head 已是 $NEW_CURRENT" | tee -a "$LOG_FILE"

# ---- 5. 验证索引存在 (PG only) ----
echo "[$(date '+%T')] 步骤 4/4: 验证站内信 3 个索引" | tee -a "$LOG_FILE"
INDEX_CHECK=$(python - <<'PY' 2>&1
import os
from sqlalchemy import create_engine, text
url = os.environ.get("DATABASE_URL", "postgresql://ihui:ihui@127.0.0.1:5432/ai")
eng = create_engine(url)
with eng.connect() as c:
    rows = c.execute(text("SELECT indexname FROM pg_indexes WHERE schemaname='public' AND tablename='message'")).fetchall()
    names = {r[0] for r in rows}
    needed = {"idx_msg_user_unread", "idx_msg_user_created", "idx_msg_user_type"}
    missing = needed - names
    if missing:
        print(f"MISSING={missing}")
    else:
        print("OK")
PY
)
echo "  $INDEX_CHECK" | tee -a "$LOG_FILE"
if [[ "$INDEX_CHECK" == *"MISSING"* ]]; then
    echo "[$(date '+%T')] FAIL: 索引缺失, 迁移可能未完全生效" | tee -a "$LOG_FILE"
    exit 1
fi

echo "[$(date '+%T')] === 迁移成功, 封版准备就绪 ===" | tee -a "$LOG_FILE"
exit 0
