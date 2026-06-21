#!/usr/bin/env python3
"""告警降噪 - 相似度合并

功能:
  - 基于 Levenshtein 距离计算告警相似度
  - 自动合并高相似度告警 (避免重复通知)
  - 合并阈值: 相似度 > 0.85
  - 合并后保留最高级别 + 最近时间
  - 输出降噪统计报告

用法:
  # 对 alert_history DB 中的告警做降噪
  python scripts/alert_dedup.py run --hours 24

  # 干跑模式 (不写库)
  python scripts/alert_dedup.py run --hours 24 --dry-run

  # 查看降噪统计
  python scripts/alert_dedup.py stats
"""
import os
import sys
import json
import sqlite3
import argparse
import re
from pathlib import Path
from datetime import datetime, timezone, timedelta
from collections import defaultdict

SERVER_DIR = Path(__file__).resolve().parent.parent
SCRIPTS_DIR = SERVER_DIR / "scripts"
LOG_DIR = SERVER_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = LOG_DIR / "alert_history.db"

# 合并阈值
SIMILARITY_THRESHOLD = 0.85
# 标题归一化 (去除变量)
NORMALIZE_PATTERNS = [
    (r'\b\d+\.\d+\.\d+\b', '<ver>'),           # 版本号
    (r'\b\d+ms\b', '<dur>'),                   # 持续时间
    (r'\b\d+(\.\d+)?(s|ms|sec|min|h|hour)s?\b', '<dur>'),  # 时间
    (r'\b\d+%\b', '<pct>'),                    # 百分比
    (r'\b\d+\b', '<num>'),                     # 数字
    (r'\b[a-f0-9]{8,}\b', '<hex>'),            # hex 字符串 (容器 ID)
    (r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b', '<ip>'),  # IP
    (r'\b[A-Z][a-zA-Z0-9]*Error\b', '<Err>'),  # 错误类名
    (r'\b[A-Z][a-zA-Z0-9]*Exception\b', '<Exc>'),  # 异常类名
]


def log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}", file=sys.stderr, flush=True)


def normalize_title(title: str) -> str:
    """归一化告警标题, 去除变量"""
    if not title:
        return ""
    text = title.lower().strip()
    for pattern, replacement in NORMALIZE_PATTERNS:
        text = re.sub(pattern, replacement, text)
    # 多空格合并
    text = re.sub(r'\s+', ' ', text)
    return text.strip()


def levenshtein_distance(s1: str, s2: str) -> int:
    """计算 Levenshtein 距离"""
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)

    prev = list(range(len(s2) + 1))
    for i, c1 in enumerate(s1):
        curr = [i + 1]
        for j, c2 in enumerate(s2):
            curr.append(min(
                prev[j + 1] + 1,         # 删除
                curr[j] + 1,             # 插入
                prev[j] + (c1 != c2),    # 替换
            ))
        prev = curr
    return prev[-1]


def similarity(s1: str, s2: str) -> float:
    """计算相似度 (0-1)"""
    if not s1 and not s2:
        return 1.0
    if not s1 or not s2:
        return 0.0
    dist = levenshtein_distance(s1, s2)
    max_len = max(len(s1), len(s2))
    return 1.0 - dist / max_len


def find_similar_groups(alerts: list[dict], threshold: float = SIMILARITY_THRESHOLD) -> list[list[dict]]:
    """查找相似告警组 (Union-Find 算法)"""
    n = len(alerts)
    parent = list(range(n))

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(x, y):
        rx, ry = find(x), find(y)
        if rx != ry:
            parent[rx] = ry

    # 归一化
    normalized = [normalize_title(a.get("title", "")) for a in alerts]

    # 两两比较相似度
    for i in range(n):
        for j in range(i + 1, n):
            if similarity(normalized[i], normalized[j]) >= threshold:
                union(i, j)

    # 收集组
    groups = defaultdict(list)
    for i in range(n):
        groups[find(i)].append(alerts[i])

    return [g for g in groups.values() if len(g) > 1]


def merge_group(group: list[dict]) -> dict:
    """合并一组告警: 保留最高级别 + 最近时间"""
    # 级别优先级
    level_priority = {"critical": 3, "warning": 2, "info": 1}
    # 选最高级别
    highest = max(group, key=lambda a: level_priority.get(a.get("level", "info"), 0))
    # 选最近时间戳
    latest = max(group, key=lambda a: a.get("timestamp", ""))
    # 累计 count
    count = len(group)
    # 收集所有 id 和 source
    ids = [a["id"] for a in group]
    sources = list({a.get("source", "") for a in group if a.get("source")})
    # 标题用 highest 的标题
    merged = {
        "id": highest["id"],
        "level": highest.get("level", "warning"),
        "title": highest.get("title", ""),
        "timestamp": latest.get("timestamp", ""),
        "count": count,
        "merged_ids": ids,
        "sources": sources,
    }
    return merged


def cmd_run(args) -> int:
    """运行降噪合并"""
    log(f"开始告警降噪, 时间窗口: {args.hours}小时, 阈值: {SIMILARITY_THRESHOLD}")

    if not DB_PATH.exists():
        log(f"❌ DB 不存在: {DB_PATH}")
        return 1

    conn = sqlite3.connect(str(DB_PATH), timeout=10.0)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # 查询时间窗口内未合并的告警
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=args.hours)).isoformat()
    cur.execute("""
        SELECT id, timestamp, level, title, source, status, alertname, service, region
        FROM alert_history
        WHERE timestamp >= ? AND status != 'merged' AND level IN ('critical', 'warning', 'info')
        ORDER BY id ASC
    """, (cutoff,))
    rows = [dict(r) for r in cur.fetchall()]

    if not rows:
        log("⚠️ 时间窗口内无告警")
        conn.close()
        return 0

    log(f"  加载 {len(rows)} 条告警")

    # 查找相似组
    groups = find_similar_groups(rows, SIMILARITY_THRESHOLD)
    log(f"  发现 {len(groups)} 组可合并")

    if not groups:
        log("✅ 无需合并")
        conn.close()
        return 0

    # 合并
    merged_alerts = []
    for group in groups:
        merged = merge_group(group)
        merged_alerts.append(merged)
        log(f"  合并组 [{merged['level']}] '{merged['title']}': {merged['count']} 条 -> id={merged['id']}")

    if args.dry_run:
        log("[DRY-RUN] 不写库")
        conn.close()
        print(json.dumps({
            "dry_run": True,
            "groups_found": len(groups),
            "merged": merged_alerts,
        }, ensure_ascii=False, indent=2))
        return 0

    # 写库: 标记为 merged
    for merged in merged_alerts:
        # 主告警: 标记 merged 状态, 写合并详情到 extra
        for mid in merged["merged_ids"]:
            if mid == merged["id"]:
                continue
            cur.execute("""
                UPDATE alert_history
                SET status = 'merged', extra = json_extract(COALESCE(extra, '{}'), '$') || json_object('merged_into', ?)
                WHERE id = ?
            """, (merged["id"], mid))
        # 更新主告警的 count
        cur.execute("""
            UPDATE alert_history
            SET extra = json_extract(COALESCE(extra, '{}'), '$') || json_object('merged_count', ?, 'merged_ids', ?)
            WHERE id = ?
        """, (merged["count"], json.dumps(merged["merged_ids"]), merged["id"]))

    conn.commit()
    log(f"✅ 合并完成: {len(merged_alerts)} 组, 节省通知 {sum(m['count'] - 1 for m in merged_alerts)} 条")
    conn.close()

    print(json.dumps({
        "groups_found": len(groups),
        "merged": merged_alerts,
        "saved_notifications": sum(m["count"] - 1 for m in merged_alerts),
    }, ensure_ascii=False, indent=2))
    return 0


def cmd_stats(args) -> int:
    """降噪统计"""
    if not DB_PATH.exists():
        log(f"❌ DB 不存在: {DB_PATH}")
        return 1

    conn = sqlite3.connect(str(DB_PATH), timeout=10.0)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # 总告警
    cur.execute("SELECT COUNT(*) as c FROM alert_history")
    total = cur.fetchone()["c"]

    # 已合并
    cur.execute("SELECT COUNT(*) as c FROM alert_history WHERE status = 'merged'")
    merged = cur.fetchone()["c"]

    # 24h 活跃
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    cur.execute("SELECT COUNT(*) as c FROM alert_history WHERE timestamp >= ?", (cutoff,))
    active_24h = cur.fetchone()["c"]

    # 按级别
    cur.execute("SELECT level, COUNT(*) as c FROM alert_history WHERE timestamp >= ? GROUP BY level", (cutoff,))
    by_level = {r["level"]: r["c"] for r in cur.fetchall()}

    # 按来源
    cur.execute("SELECT COALESCE(NULLIF(source, ''), 'unknown') as s, COUNT(*) as c FROM alert_history WHERE timestamp >= ? GROUP BY s ORDER BY c DESC LIMIT 10", (cutoff,))
    by_source = {r["s"]: r["c"] for r in cur.fetchall()}

    conn.close()

    noise_reduction_pct = (merged / total * 100) if total > 0 else 0.0

    print(json.dumps({
        "total": total,
        "merged": merged,
        "noise_reduction_pct": round(noise_reduction_pct, 2),
        "active_24h": active_24h,
        "by_level_24h": by_level,
        "by_source_24h": by_source,
        "threshold": SIMILARITY_THRESHOLD,
    }, ensure_ascii=False, indent=2))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="告警降噪")
    sub = parser.add_subparsers(dest="command")

    run_p = sub.add_parser("run", help="运行降噪")
    run_p.add_argument("--hours", type=int, default=24)
    run_p.add_argument("--dry-run", action="store_true")

    sub.add_parser("stats", help="统计")

    args = parser.parse_args()

    if args.command == "run":
        return cmd_run(args)
    if args.command == "stats":
        return cmd_stats(args)

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
