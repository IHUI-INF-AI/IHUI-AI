#!/usr/bin/env python3
"""告警历史持久化

将 alert_router / multi_channel_notify 发送的告警持久化到 SQLite/PostgreSQL
支持查询、清理、统计、报表导出

用法:
  python scripts/alert_history_db.py record --level critical --title "..." --source pg_backup --channels dingtalk
  python scripts/alert_history_db.py query --level critical --limit 10
  python scripts/alert_history_db.py stats --days 7
  python scripts/alert_history_db.py cleanup --days 90
  python scripts/alert_history_db.py export --format json --output report.json
"""
import os
import sys
import json
import sqlite3
import argparse
from pathlib import Path
from datetime import datetime, timezone, timedelta

SERVER_DIR = Path(__file__).resolve().parent.parent
LOG_DIR = SERVER_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = LOG_DIR / "alert_history.db"


def get_connection() -> sqlite3.Connection:
    """获取 SQLite 连接 (懒初始化表结构)"""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    _init_schema(conn)
    return conn


def _init_schema(conn: sqlite3.Connection) -> None:
    """初始化表结构"""
    conn.executescript("""
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
        );
        CREATE INDEX IF NOT EXISTS idx_alert_history_ts ON alert_history(timestamp);
        CREATE INDEX IF NOT EXISTS idx_alert_history_level ON alert_history(level);
        CREATE INDEX IF NOT EXISTS idx_alert_history_source ON alert_history(source);
    """)
    conn.commit()


def log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}")


def cmd_record(args) -> int:
    """记录告警历史"""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO alert_history (timestamp, level, title, content, source, tags, channels, status, extra)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        datetime.now(timezone.utc).isoformat(),
        args.level,
        args.title,
        args.content or "",
        args.source or "",
        args.tags or "",
        args.channels or "",
        args.status or "sent",
        json.dumps(args.extra or {}, ensure_ascii=False) if hasattr(args, "extra") else "",
    ))
    conn.commit()
    alert_id = cur.lastrowid
    conn.close()
    log(f"✅ 告警已记录: id={alert_id}, level={args.level}, title={args.title}")
    return 0


def cmd_query(args) -> int:
    """查询告警历史"""
    conn = get_connection()
    where = []
    params = []
    if args.level:
        where.append("level = ?")
        params.append(args.level)
    if args.source:
        where.append("source = ?")
        params.append(args.source)
    if args.since:
        where.append("timestamp >= ?")
        params.append(args.since)

    sql = "SELECT * FROM alert_history"
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += f" ORDER BY id DESC LIMIT {int(args.limit)}"

    cur = conn.cursor()
    cur.execute(sql, params)
    rows = cur.fetchall()
    conn.close()

    results = [dict(r) for r in rows]
    print(json.dumps(results, ensure_ascii=False, indent=2))
    log(f"查询返回 {len(results)} 条记录")
    return 0


def cmd_stats(args) -> int:
    """统计告警历史"""
    conn = get_connection()
    cur = conn.cursor()

    since = (datetime.now(timezone.utc) - timedelta(days=args.days)).isoformat()

    # 按级别统计
    cur.execute("""
        SELECT level, COUNT(*) as count
        FROM alert_history
        WHERE timestamp >= ?
        GROUP BY level
        ORDER BY count DESC
    """, (since,))
    by_level = {row["level"]: row["count"] for row in cur.fetchall()}

    # 按源统计
    cur.execute("""
        SELECT COALESCE(NULLIF(source, ''), 'unknown') as src, COUNT(*) as count
        FROM alert_history
        WHERE timestamp >= ?
        GROUP BY src
        ORDER BY count DESC
        LIMIT 10
    """, (since,))
    by_source = {row["src"]: row["count"] for row in cur.fetchall()}

    # 按天统计
    cur.execute("""
        SELECT substr(timestamp, 1, 10) as day, COUNT(*) as count
        FROM alert_history
        WHERE timestamp >= ?
        GROUP BY day
        ORDER BY day DESC
    """, (since,))
    by_day = {row["day"]: row["count"] for row in cur.fetchall()}

    # 总数
    cur.execute("SELECT COUNT(*) as total FROM alert_history WHERE timestamp >= ?", (since,))
    total = cur.fetchone()["total"]

    conn.close()

    stats = {
        "operation": "alert_stats",
        "since": since,
        "days": args.days,
        "total": total,
        "by_level": by_level,
        "by_source": by_source,
        "by_day": by_day,
    }
    print(json.dumps(stats, ensure_ascii=False, indent=2))
    return 0


def cmd_cleanup(args) -> int:
    """清理过期告警"""
    conn = get_connection()
    cur = conn.cursor()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=args.days)).isoformat()
    cur.execute("DELETE FROM alert_history WHERE timestamp < ?", (cutoff,))
    deleted = cur.rowcount
    conn.commit()
    conn.close()
    log(f"✅ 清理完成: 删除 {deleted} 条超过 {args.days} 天的记录")
    return 0


def cmd_export(args) -> int:
    """导出告警历史"""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM alert_history ORDER BY id DESC LIMIT ?", (int(args.limit),))
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()

    output_path = Path(args.output) if args.output else LOG_DIR / f"alert_export_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.json"
    output_path.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    log(f"✅ 已导出 {len(rows)} 条记录到: {output_path}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="告警历史持久化")
    sub = parser.add_subparsers(dest="command")

    record_p = sub.add_parser("record", help="记录告警")
    record_p.add_argument("--level", required=True, choices=["info", "warning", "critical"])
    record_p.add_argument("--title", required=True)
    record_p.add_argument("--content", default="")
    record_p.add_argument("--source", default="")
    record_p.add_argument("--tags", default="")
    record_p.add_argument("--channels", default="")
    record_p.add_argument("--status", default="sent")

    query_p = sub.add_parser("query", help="查询告警")
    query_p.add_argument("--level", choices=["info", "warning", "critical"])
    query_p.add_argument("--source")
    query_p.add_argument("--since", help="起始时间 (ISO 格式)")
    query_p.add_argument("--limit", type=int, default=50)

    stats_p = sub.add_parser("stats", help="告警统计")
    stats_p.add_argument("--days", type=int, default=7)

    cleanup_p = sub.add_parser("cleanup", help="清理过期")
    cleanup_p.add_argument("--days", type=int, default=90)

    export_p = sub.add_parser("export", help="导出告警")
    export_p.add_argument("--limit", type=int, default=1000)
    export_p.add_argument("--output")

    args = parser.parse_args()

    if args.command == "record":
        return cmd_record(args)
    if args.command == "query":
        return cmd_query(args)
    if args.command == "stats":
        return cmd_stats(args)
    if args.command == "cleanup":
        return cmd_cleanup(args)
    if args.command == "export":
        return cmd_export(args)

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
