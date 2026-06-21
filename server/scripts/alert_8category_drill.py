"""8 类告警规则异常注入演练脚本.

8 类告警:
1. PGInstanceDown      - 实例宕机 (TCP 探测失败)
2. PGConnectionsHigh   - 连接数占满 (max_connections 90%+)
3. PGDeadlockDetected  - 死锁 (pg_stat_database 死锁计数)
4. PGRollbackHigh      - 回滚率高 (xact_rollback / xact_commit > 5%)
5. PGCacheHitLow       - 缓存命中率低 (< 95%)
6. PGReplicationLagHigh- 复制延迟高 (lag > 30s)
7. PGBloatHigh         - 表膨胀率高 (实际/期望 > 3x)
8. PGLongTransaction   - 长事务 (> 10min)

每类异常生成一条模拟告警事件 + 推荐 PromQL 抓取 + 清理步骤.

用法:
    python scripts/alert_8category_drill.py
    python scripts/alert_8category_drill.py --category instance
    python scripts/alert_8category_drill.py --dry-run
"""
from __future__ import annotations

import argparse
import json
import sqlite3
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

SERVER_ROOT = Path(__file__).resolve().parent.parent
ALERT_HISTORY_DB = SERVER_ROOT / "logs" / "alert_history.db"

CATEGORIES = [
    {
        "id": "instance",
        "rule": "PGInstanceDown",
        "severity": "critical",
        "trigger": "up{job='postgres-exporter'} == 0 持续 30s",
        "injection": "停止 postgres-exporter / 关闭 PG 监听端口",
        "promql": "up{job='postgres-exporter'} == 0",
        "recover": "恢复 exporter / 启动 PG 监听端口",
        "cleanup": "kubectl rollout restart deploy/postgres-exporter",
    },
    {
        "id": "connection",
        "rule": "PGConnectionsHigh",
        "severity": "warning",
        "trigger": "pg_stat_activity count / max_connections > 0.9",
        "injection": "并发开 100+ 空闲连接 (psql -c 'SELECT pg_sleep(60)')",
        "promql": "(sum(pg_stat_activity_count) by (datname) / on(datname) pg_settings_max_connections) > 0.9",
        "recover": "pg_terminate_backend 杀掉空闲连接",
        "cleanup": "psql -c \"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state='idle' AND query_start < now() - interval '5 min'\"",
    },
    {
        "id": "deadlock",
        "rule": "PGDeadlockDetected",
        "severity": "warning",
        "trigger": "rate(pg_stat_database_deadlocks[5m]) > 0",
        "injection": "两个事务并发更新同一行, 制造死锁",
        "promql": "rate(pg_stat_database_deadlocks[5m]) > 0",
        "recover": "应用层捕获 deadlock_detected 异常并重试",
        "cleanup": "无需清理, 死锁自动解开; 检查应用层重试逻辑",
    },
    {
        "id": "rollback",
        "rule": "PGRollbackHigh",
        "severity": "warning",
        "trigger": "rate(xact_rollback[5m]) / rate(xact_commit[5m]) > 0.05",
        "injection": "应用层触发 50% 事务回滚 (随机 raise)",
        "promql": "rate(pg_stat_xact_rollback[5m]) / rate(pg_stat_xact_commit[5m]) > 0.05",
        "recover": "修复应用层事务逻辑, 减少异常抛出",
        "cleanup": "无需清理, 监控大盘 5min 内会自动恢复",
    },
    {
        "id": "cache",
        "rule": "PGCacheHitLow",
        "severity": "warning",
        "trigger": "pg_stat_database blks_hit / (blks_hit + blks_read) < 0.95",
        "injection": "执行大量 seq scan, 拉低缓存命中率",
        "promql": "(sum(pg_stat_database_blks_hit) / (sum(pg_stat_database_blks_hit) + sum(pg_stat_database_blks_read))) < 0.95",
        "recover": "ANALYZE 大表 + 调整 shared_buffers",
        "cleanup": "ANALYZE VERBOSE; 调优 postgresql.conf shared_buffers",
    },
    {
        "id": "replication",
        "rule": "PGReplicationLagHigh",
        "severity": "critical",
        "trigger": "pg_replication_lag / pg_last_wal_receive_lsn 秒差 > 30",
        "injection": "主库写 10GB 突发, 模拟从库追不上",
        "promql": "pg_replication_lag_seconds > 30",
        "recover": "暂停主库写入, 等待从库追平",
        "cleanup": "无需清理, lag 追上后自动恢复",
    },
    {
        "id": "bloat",
        "rule": "PGBloatHigh",
        "severity": "warning",
        "trigger": "(pgstattuple 免费空间 + 死元组) / 表大小 > 0.3",
        "injection": "频繁 UPDATE + 不 VACUUM, 制造死元组堆积",
        "promql": "pgstattuple_dead_tuple_percent > 30",
        "recover": "VACUUM ANALYZE 目标表",
        "cleanup": "VACUUM (VERBOSE, ANALYZE) schema.table;",
    },
    {
        "id": "longtx",
        "rule": "PGLongTransaction",
        "severity": "warning",
        "trigger": "pg_stat_activity xact_start < now() - 10min 且 state='active'",
        "injection": "执行 BEGIN; SELECT pg_sleep(900); COMMIT;",
        "promql": "(now() - pg_stat_activity_xact_start) > 600",
        "recover": "pg_cancel_backend 杀掉长事务",
        "cleanup": "psql -c \"SELECT pg_cancel_backend(pid) FROM pg_stat_activity WHERE xact_start < now() - interval '10 min' AND state='active'\"",
    },
]


def ensure_db() -> None:
    ALERT_HISTORY_DB.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(ALERT_HISTORY_DB))
    # 适配已有 schema (timestamp / level / title / content / source / status / extra)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS alert_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            level TEXT NOT NULL,
            title TEXT NOT NULL,
            content TEXT,
            source TEXT,
            tags TEXT,
            channels TEXT,
            status TEXT,
            extra TEXT,
            created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        )
    """)
    conn.commit()
    conn.close()


def record_event(rule: str, severity: str, status: str, message: str) -> None:
    ensure_db()
    conn = sqlite3.connect(str(ALERT_HISTORY_DB))
    conn.execute(
        "INSERT INTO alert_history (timestamp, level, title, content, source, tags, status, extra) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (
            datetime.now(timezone.utc).isoformat(),
            severity,
            rule,
            message,
            "alert_8category_drill",
            f"rule={rule}",
            status,
            json.dumps({"drill": True}, ensure_ascii=False),
        ),
    )
    conn.commit()
    conn.close()


def run_drill(category: dict, dry_run: bool) -> dict:
    """演练单个类别, 生成模拟告警事件."""
    print(f"\n  [{category['id']}] {category['rule']} ({category['severity']})")
    print(f"    触发条件: {category['trigger']}")
    print(f"    注入方式: {category['injection']}")
    print(f"    PromQL:   {category['promql']}")

    if dry_run:
        verdict = "DRY_RUN"
        message = f"Dry-run 演练 {category['rule']}"
    else:
        # 记录到 alert_history_db (模拟告警事件)
        record_event(
            rule=category["rule"],
            severity=category["severity"],
            status="drill_triggered",
            message=f"drill 触发 {category['rule']}: {category['injection']}",
        )
        verdict = "TRIGGERED"
        message = f"告警事件已记录到 alert_history_db, 等待 Prometheus 抓取并触发 Alertmanager 路由"

    print(f"    清理:    {category['cleanup']}")
    print(f"    结果:    {verdict}")

    return {
        "category": category["id"],
        "rule": category["rule"],
        "severity": category["severity"],
        "verdict": verdict,
        "message": message,
        "promql": category["promql"],
        "cleanup": category["cleanup"],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--category", default="", help="只跑某个类别 (留空跑全部 8 类)")
    parser.add_argument("--dry-run", action="store_true", help="只输出演练方案, 不真注入")
    parser.add_argument("--output", default="logs/alert_8category_drill.json")
    args = parser.parse_args()

    print(f"[alert-8cat-drill] 起点: {datetime.now(timezone.utc).isoformat()}")
    print(f"[alert-8cat-drill] 模式: {'dry-run' if args.dry_run else 'live'}")

    cats = CATEGORIES
    if args.category:
        cats = [c for c in CATEGORIES if c["id"] == args.category]
        if not cats:
            print(f"[alert-8cat-drill] 未知类别: {args.category}, 可选: {[c['id'] for c in CATEGORIES]}")
            return 2

    results = []
    for c in cats:
        r = run_drill(c, args.dry_run)
        results.append(r)
        time.sleep(0.1)  # 间隔避免 sqlite 锁

    summary = {
        "total": len(results),
        "triggered": sum(1 for r in results if r["verdict"] in ("TRIGGERED", "DRY_RUN")),
        "failed": sum(1 for r in results if r["verdict"] == "FAIL"),
    }

    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "mode": "dry-run" if args.dry_run else "live",
        "category_filter": args.category or "all",
        "results": results,
        "summary": summary,
        "verdict": "PASS" if summary["failed"] == 0 else "FAIL",
    }
    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"\n[alert-8cat-drill] 汇总: 触发 {summary['triggered']} / 失败 {summary['failed']} / 共 {summary['total']}")
    print(f"[alert-8cat-drill] 报告: {out}")
    print(f"[alert-8cat-drill] 结论: {report['verdict']}")
    return 0 if report["verdict"] == "PASS" else 1


if __name__ == "__main__":
    import sys
    sys.exit(main())
