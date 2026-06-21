#!/usr/bin/env python3
"""多租户压测报告生成器

读取 tenant_loadtest 生成的 JSON 报告, 输出:
- HTML 报告 (含图表)
- Markdown 报告
- 趋势对比 (与历史报告)
- 性能阈值告警

用法:
  python scripts/loadtest_report_gen.py report --input logs/tenant_loadtest_*.json --format html
  python scripts/loadtest_report_gen.py compare --baseline old.json --current new.json
  python scripts/loadtest_report_gen.py trend --directory logs/ --days 7
"""
import os
import sys
import json
import argparse
import statistics
import re
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional

SERVER_DIR = Path(__file__).resolve().parent.parent
LOG_DIR = SERVER_DIR / "logs"
REPORT_DIR = LOG_DIR / "loadtest_reports"
REPORT_DIR.mkdir(parents=True, exist_ok=True)


def log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}")


def load_report(path: Path) -> Optional[dict]:
    """加载压测报告"""
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as e:
        log(f"⚠️  加载失败 {path}: {e}")
        return None


def find_latest_reports(directory: Path, days: int = 7) -> list[Path]:
    """查找最近 N 天的压测报告"""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    reports = []
    pattern = re.compile(r"tenant_loadtest_(\d{8}_\d{6})\.json")
    for p in directory.glob("tenant_loadtest_*.json"):
        m = pattern.search(p.name)
        if m:
            try:
                ts = datetime.strptime(m.group(1), "%Y%m%d_%H%M%S")
                if ts.replace(tzinfo=timezone.utc) >= cutoff:
                    reports.append(p)
            except ValueError:
                continue
    return sorted(reports, key=lambda p: p.stat().st_mtime)


def generate_html_report(data: dict, output: Path) -> None:
    """生成 HTML 报告"""
    stats = data.get("stats", {})
    tenants = data.get("tenants", [])
    per_tenant = stats.get("per_tenant", {})

    tenant_rows = ""
    for tenant, info in per_tenant.items():
        tenant_rows += f"""
        <tr>
            <td>{tenant}</td>
            <td>{info.get('count', 0)}</td>
            <td>{info.get('avg_latency_ms', 0):.2f} ms</td>
            <td>{info.get('p95_latency_ms', 0):.2f} ms</td>
            <td>{info.get('slow_count', 0)}</td>
        </tr>"""

    html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>多租户压测报告</title>
    <style>
        body {{ font-family: -apple-system, sans-serif; margin: 20px; background: #f5f5f5; }}
        h1 {{ color: #333; }}
        .summary {{ display: flex; gap: 20px; margin-bottom: 20px; }}
        .card {{ background: white; padding: 20px; border-radius: 8px; flex: 1; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
        .metric {{ font-size: 32px; font-weight: bold; color: #1976d2; }}
        .label {{ color: #666; font-size: 14px; margin-top: 5px; }}
        table {{ width: 100%; border-collapse: collapse; background: white; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
        th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #eee; }}
        th {{ background: #fafafa; font-weight: 600; }}
    </style>
</head>
<body>
    <h1>多租户压测报告</h1>
    <p>生成时间: {datetime.now(timezone.utc).isoformat()}</p>
    <p>压测时间: {data.get('timestamp', 'N/A')}</p>
    <p>模式: <b>{data.get('mode', 'N/A')}</b> | 租户: <b>{', '.join(tenants)}</b></p>

    <div class="summary">
        <div class="card">
            <div class="metric">{stats.get('total_requests', 0)}</div>
            <div class="label">总请求数</div>
        </div>
        <div class="card">
            <div class="metric">{stats.get('qps', 0):.2f}</div>
            <div class="label">QPS</div>
        </div>
        <div class="card">
            <div class="metric">{stats.get('latency_ms', {}).get('p95', 0):.2f} ms</div>
            <div class="label">P95 延迟</div>
        </div>
        <div class="card">
            <div class="metric">{stats.get('success_rate', 0):.1f}%</div>
            <div class="label">成功率</div>
        </div>
    </div>

    <h2>各租户性能</h2>
    <table>
        <thead>
            <tr><th>租户</th><th>请求数</th><th>平均延迟</th><th>P95 延迟</th><th>慢请求</th></tr>
        </thead>
        <tbody>{tenant_rows}
        </tbody>
    </table>

    <h2>延迟分布</h2>
    <table>
        <tr><th>指标</th><th>值</th></tr>
        <tr><td>最小</td><td>{stats.get('latency_ms', {}).get('min', 0):.2f} ms</td></tr>
        <tr><td>最大</td><td>{stats.get('latency_ms', {}).get('max', 0):.2f} ms</td></tr>
        <tr><td>平均</td><td>{stats.get('latency_ms', {}).get('avg', 0):.2f} ms</td></tr>
        <tr><td>中位数</td><td>{stats.get('latency_ms', {}).get('median', 0):.2f} ms</td></tr>
        <tr><td>P95</td><td>{stats.get('latency_ms', {}).get('p95', 0):.2f} ms</td></tr>
        <tr><td>P99</td><td>{stats.get('latency_ms', {}).get('p99', 0):.2f} ms</td></tr>
    </table>
</body>
</html>"""
    output.write_text(html, encoding="utf-8")
    log(f"✅ HTML 报告: {output}")


def generate_markdown_report(data: dict, output: Path) -> None:
    """生成 Markdown 报告"""
    stats = data.get("stats", {})
    tenants = data.get("tenants", [])
    per_tenant = stats.get("per_tenant", {})

    md = f"""# 多租户压测报告

**生成时间**: {datetime.now(timezone.utc).isoformat()}
**压测时间**: {data.get('timestamp', 'N/A')}
**模式**: {data.get('mode', 'N/A')}
**租户**: {', '.join(tenants)}
**并发数**: {data.get('concurrency', 'N/A')}
**每租户请求数**: {data.get('requests_per_tenant', 'N/A')}

## 总体指标

| 指标 | 值 |
|------|-----|
| 总请求数 | {stats.get('total_requests', 0)} |
| QPS | {stats.get('qps', 0):.2f} |
| 成功率 | {stats.get('success_rate', 0):.2f}% |
| 慢请求 | {stats.get('slow_count', 0)} |
| 耗时 | {stats.get('duration_seconds', 0):.2f}s |

## 各租户性能

| 租户 | 请求数 | 平均延迟 | P95 延迟 | 慢请求 |
|------|--------|---------|---------|--------|
"""
    for tenant, info in per_tenant.items():
        md += f"| {tenant} | {info.get('count', 0)} | {info.get('avg_latency_ms', 0):.2f} ms | {info.get('p95_latency_ms', 0):.2f} ms | {info.get('slow_count', 0)} |\n"

    md += f"""
## 延迟分布

| 指标 | 值 |
|------|-----|
| 最小 | {stats.get('latency_ms', {}).get('min', 0):.2f} ms |
| 最大 | {stats.get('latency_ms', {}).get('max', 0):.2f} ms |
| 平均 | {stats.get('latency_ms', {}).get('avg', 0):.2f} ms |
| 中位数 | {stats.get('latency_ms', {}).get('median', 0):.2f} ms |
| P95 | {stats.get('latency_ms', {}).get('p95', 0):.2f} ms |
| P99 | {stats.get('latency_ms', {}).get('p99', 0):.2f} ms |
"""
    output.write_text(md, encoding="utf-8")
    log(f"✅ Markdown 报告: {output}")


def compare_reports(baseline: dict, current: dict) -> dict:
    """对比两个报告, 计算性能回归"""
    b_stats = baseline.get("stats", {})
    c_stats = current.get("stats", {})

    diff = {
        "qps_change": c_stats.get("qps", 0) - b_stats.get("qps", 0),
        "p95_change": c_stats.get("latency_ms", {}).get("p95", 0) - b_stats.get("latency_ms", {}).get("p95", 0),
        "success_rate_change": c_stats.get("success_rate", 0) - b_stats.get("success_rate", 0),
        "baseline_timestamp": baseline.get("timestamp"),
        "current_timestamp": current.get("timestamp"),
    }
    # 性能回归阈值
    diff["p95_regression"] = diff["p95_change"] > 10  # P95 增加 > 10ms 视为回归
    diff["qps_regression"] = diff["qps_change"] < -50  # QPS 减少 > 50 视为回归
    return diff


def cmd_report(args) -> int:
    """生成单次报告"""
    input_path = Path(args.input)
    if not input_path.exists():
        log(f"❌ 文件不存在: {input_path}")
        return 1

    data = load_report(input_path)
    if data is None:
        return 1

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    if args.format in ("html", "all"):
        html_path = REPORT_DIR / f"report_{timestamp}.html"
        generate_html_report(data, html_path)
    if args.format in ("md", "markdown", "all"):
        md_path = REPORT_DIR / f"report_{timestamp}.md"
        generate_markdown_report(data, md_path)
    return 0


def cmd_compare(args) -> int:
    """对比两个报告"""
    baseline = load_report(Path(args.baseline))
    current = load_report(Path(args.current))
    if baseline is None or current is None:
        return 1

    diff = compare_reports(baseline, current)
    print(json.dumps(diff, ensure_ascii=False, indent=2))
    return 0 if not (diff["p95_regression"] or diff["qps_regression"]) else 1


def cmd_trend(args) -> int:
    """生成趋势报告"""
    reports = find_latest_reports(LOG_DIR, args.days)
    if not reports:
        log(f"⚠️  最近 {args.days} 天无压测报告")
        return 0

    log(f"找到 {len(reports)} 个压测报告")
    trend_data = []
    for r in reports:
        data = load_report(r)
        if data is None:
            continue
        trend_data.append({
            "timestamp": data.get("timestamp"),
            "file": r.name,
            "qps": data.get("stats", {}).get("qps", 0),
            "p95": data.get("stats", {}).get("latency_ms", {}).get("p95", 0),
            "success_rate": data.get("stats", {}).get("success_rate", 0),
        })

    output = REPORT_DIR / f"trend_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.json"
    output.write_text(json.dumps(trend_data, ensure_ascii=False, indent=2), encoding="utf-8")
    log(f"✅ 趋势报告: {output}")
    print(json.dumps(trend_data, ensure_ascii=False, indent=2))
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="多租户压测报告生成器")
    sub = parser.add_subparsers(dest="command")

    report_p = sub.add_parser("report", help="生成单次报告")
    report_p.add_argument("--input", required=True, help="输入 JSON 路径")
    report_p.add_argument("--format", default="html", choices=["html", "md", "markdown", "all"], help="输出格式")

    compare_p = sub.add_parser("compare", help="对比报告")
    compare_p.add_argument("--baseline", required=True, help="基线报告")
    compare_p.add_argument("--current", required=True, help="当前报告")

    trend_p = sub.add_parser("trend", help="趋势分析")
    trend_p.add_argument("--directory", default=str(LOG_DIR), help="报告目录")
    trend_p.add_argument("--days", type=int, default=7, help="天数")

    args = parser.parse_args()

    if args.command == "report":
        return cmd_report(args)
    if args.command == "compare":
        return cmd_compare(args)
    if args.command == "trend":
        return cmd_trend(args)

    parser.print_help()
    return 1


if __name__ == "__main__":
    sys.exit(main())
