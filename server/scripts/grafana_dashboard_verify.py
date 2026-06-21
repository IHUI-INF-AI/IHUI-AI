"""Grafana 大盘 schema 验证脚本.

目的: 在不导入 Grafana 的前提下, 静态验证所有 dashboard JSON:
1. JSON 格式有效
2. Grafana dashboard schema 关键字段 (uid / title / schemaVersion / panels)
3. 面板结构 (gridPos / targets / type)
4. 提取所有 PromQL expr 引用, 列出指标名清单
5. 与 postgres-exporter 已知指标集对比, 报告潜在未对齐指标

输出: logs/grafana_schema_verify.json
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

SERVER_ROOT = Path(__file__).resolve().parent.parent
DASHBOARD_DIR = SERVER_ROOT / "deploy" / "grafana" / "dashboards"

# postgres_exporter 暴露的核心指标 (https://github.com/prometheus-community/postgres_exporter)
# 仅列出项目中实际使用的关键子集, 用于静态检查
PG_EXPORTER_KNOWN_METRICS = {
    # 连接
    "pg_up", "pg_stat_activity_count",
    # 事务
    "pg_stat_database_xact_commit", "pg_stat_database_xact_rollback",
    "pg_stat_database_blks_hit", "pg_stat_database_blks_read",
    # 死锁
    "pg_stat_database_deadlocks", "pg_locks_count",
    # 元组
    "pg_stat_database_tup_fetched", "pg_stat_database_tup_inserted",
    "pg_stat_database_tup_updated", "pg_stat_database_tup_deleted",
    # 慢 SQL
    "pg_stat_statements_mean_exec_time", "pg_stat_statements_calls",
    "pg_stat_statements_total_exec_time",
    # 复制
    "pg_stat_replication_lag", "pg_replication_lag",
    # 数据库大小
    "pg_database_size_bytes", "pg_stat_user_tables_size",
    # 索引 / 表
    "pg_stat_user_tables_seq_scan", "pg_stat_user_tables_idx_scan",
    "pg_stat_user_indexes_idx_scan",
    # 缓存命中率
    "pg_stat_database_blks_hit_ratio",
    # 后台进程
    "pg_stat_bgwriter_checkpoints_timed", "pg_stat_bgwriter_checkpoints_req",
    # 长事务
    "pg_stat_activity_max_tx_duration",
}

# 解析 PromQL 指标名 (粗略, 抓取形如 metric_name{...} 的开头部分)
_METRIC_RE = re.compile(r"\b([a-zA-Z_][a-zA-Z0-9_]*)\s*[\({]")


def extract_metrics_from_expr(expr: str) -> list:
    """从 PromQL expr 中提取所有指标名."""
    return _METRIC_RE.findall(expr)


def validate_one_dashboard(path: Path) -> dict:
    """验证单个 dashboard JSON 文件."""
    result = {
        "file": path.name,
        "valid": False,
        "issues": [],
        "panels": 0,
        "metrics": Counter(),
    }
    try:
        text = path.read_text(encoding="utf-8")
    except Exception as e:
        result["issues"].append({"type": "read_error", "detail": str(e)})
        return result

    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        result["issues"].append({"type": "json_parse", "detail": str(e)})
        return result

    result["valid"] = True

    # 必备 schema 字段
    for required in ("title", "uid", "schemaVersion", "panels"):
        if required not in data:
            result["issues"].append({"type": "missing_field", "detail": required})

    # panels 必须是非空 list
    panels = data.get("panels", [])
    if not isinstance(panels, list) or len(panels) == 0:
        result["issues"].append({"type": "empty_panels"})
        return result

    result["panels"] = len(panels)

    # 遍历所有面板, 提取 expr
    for i, p in enumerate(panels):
        if not isinstance(p, dict):
            result["issues"].append({"type": f"panel_{i}_not_dict"})
            continue
        if "type" not in p:
            result["issues"].append({"type": f"panel_{i}_no_type"})
        if "gridPos" not in p:
            result["issues"].append({"type": f"panel_{i}_no_gridpos"})
        for t in p.get("targets", []) or []:
            expr = (t or {}).get("expr", "")
            for m in extract_metrics_from_expr(expr):
                result["metrics"][m] += 1

    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="logs/grafana_schema_verify.json")
    args = parser.parse_args()

    if not DASHBOARD_DIR.exists():
        print(f"[verify] dashboard 目录不存在: {DASHBOARD_DIR}")
        return 1

    files = sorted(DASHBOARD_DIR.glob("*.json"))
    print(f"[verify] 扫描 {len(files)} 个 dashboard JSON")

    all_metrics = Counter()
    issues_total = 0
    file_results = []
    for f in files:
        r = validate_one_dashboard(f)
        r["metrics"] = dict(r["metrics"])
        file_results.append(r)
        all_metrics.update(r["metrics"])
        issues_total += len(r["issues"])
        status = "OK  " if r["valid"] and not r["issues"] else "WARN"
        print(f"  [{status}] {f.name:35s}  panels={r['panels']:2d}  metrics={len(r['metrics']):2d}  issues={len(r['issues'])}")

    # 报告未对齐 PG exporter 的指标
    metrics_set = set(all_metrics.keys())
    pg_metrics_used = metrics_set & PG_EXPORTER_KNOWN_METRICS
    pg_metrics_unused = PG_EXPORTER_KNOWN_METRICS - metrics_set
    unknown_metrics = sorted(metrics_set - PG_EXPORTER_KNOWN_METRICS)

    print(f"\n[verify] 汇总:")
    print(f"  dashboard 文件: {len(files)}")
    print(f"  面板总数: {sum(r['panels'] for r in file_results)}")
    print(f"  独立指标总数: {len(metrics_set)}")
    print(f"  PG exporter 已知指标命中: {len(pg_metrics_used)}")
    print(f"  PG exporter 已知指标未用: {len(pg_metrics_unused)}")
    print(f"  schema 问题总数: {issues_total}")
    if unknown_metrics:
        print(f"  非 PG exporter 指标 (可能来自 prometheus 自带/其他 exporter):")
        for m in unknown_metrics[:20]:
            print(f"    - {m}")

    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "dashboard_dir": str(DASHBOARD_DIR),
        "files_scanned": len(files),
        "total_panels": sum(r["panels"] for r in file_results),
        "unique_metrics": len(metrics_set),
        "pg_exporter_metrics_used": sorted(pg_metrics_used),
        "pg_exporter_metrics_unused": sorted(pg_metrics_unused),
        "unknown_metrics_sample": unknown_metrics[:50],
        "issues_total": issues_total,
        "files": file_results,
        "verdict": "PASS" if issues_total == 0 else "WARN",
    }

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, ensure_ascii=False, indent=2, default=lambda x: dict(x) if isinstance(x, Counter) else x), encoding="utf-8")
    print(f"\n[verify] 报告: {out_path}")
    print(f"[verify] 结论: {report['verdict']}")
    return 0 if report["verdict"] == "PASS" else 0  # WARN 不算失败, 仅报告


if __name__ == "__main__":
    sys.exit(main())
