#!/usr/bin/env bash
# =============================================================================
# Celery beat 单例检查脚本 (P1 封版)
#
# 作用: 防止多 Celery beat 进程同时调度对账任务, 导致重复推送站内信告警
#
# 使用:
#   bash scripts/celery_beat_singleton_check.sh
#
# 退出码:
#   0  = 单例 (正常)
#   1  = 检测到多 beat (异常, 需运维 kill 冗余进程)
#   2  = 未检测到 beat (异常, 调度未启动)
# =============================================================================
set -euo pipefail

# ---- 1. 检测 beat 进程数 ----
echo "[$(date '+%T')] === Celery beat 单例检查 ==="

# 多平台检测: Linux ps / Windows wmic
if command -v wmic >/dev/null 2>&1; then
    # Windows
    COUNT=$(wmic process where "name='python.exe'" get CommandLine 2>/dev/null \
        | grep -i "celery.*beat" \
        | grep -v "celery.*beat --help" \
        | grep -cv "^$" || echo 0)
    METHOD="wmic"
elif command -v pgrep >/dev/null 2>&1; then
    # Linux/Unix
    COUNT=$(pgrep -af "celery.*beat" 2>/dev/null \
        | grep -v "celery_beat_singleton_check" \
        | grep -cv "grep" || echo 0)
    METHOD="pgrep"
elif command -v ps >/dev/null 2>&1; then
    # 通用 fallback
    COUNT=$(ps auxww 2>/dev/null \
        | grep -E "celery.*beat" \
        | grep -v "grep" \
        | grep -v "celery_beat_singleton_check" \
        | wc -l | tr -d ' ')
    METHOD="ps"
else
    echo "  FAIL: 无法检测进程 (缺 wmic/pgrep/ps)"
    exit 1
fi

echo "  检测方式: $METHOD"
echo "  beat 进程数: $COUNT"

# ---- 2. 判定 ----
if [ "$COUNT" = "0" ]; then
    echo "  ⚠️  未检测到 Celery beat 进程, 对账调度未启动"
    echo "  建议: celery -A app.celery_app beat -l info --detach"
    exit 2
elif [ "$COUNT" = "1" ]; then
    echo "  ✅ 单例 (1 个 beat 进程), 对账调度正常"
    exit 0
else
    echo "  ❌ 检测到 $COUNT 个 beat 进程, 会对账重复触发!"
    echo ""
    echo "  修复 (Linux):"
    echo "    pkill -f 'celery.*beat'"
    echo "    celery -A app.celery_app beat -l info --detach"
    echo ""
    echo "  修复 (Windows):"
    echo "    taskkill /F /IM python.exe /FI \"WINDOWTITLE eq celery beat*\""
    exit 1
fi
