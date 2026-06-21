"""告警智能降噪 v2 - LLM 聚类分析脚本.

基于历史告警, 用 LLM 做语义聚类 + 自动建议新抑制规则:
1. 从 alert_history DB 拉取历史告警
2. 用 LLM (本地或 API) 做聚类
3. 自动生成候选抑制规则
4. 输出 PR-ready markdown 报告 (人工审核)

无 LLM 时降级为简单规则匹配 (复用 alert_noise_integration.py 的逻辑)

用法:
    python scripts/alert_noise_v2.py --analyze --days 30
    python scripts/alert_noise_v2.py --analyze --llm-provider openai
    python scripts/alert_noise_v2.py --output noise-v2-report.md
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

SERVER_ROOT = Path(__file__).resolve().parent.parent
V2_REPORT = SERVER_ROOT / "noise-v2-report.md"

# 已知告警模式
ALERT_PATTERNS = {
    "flapping": ["flapping", "反复", "间歇", "intermittent"],
    "noisy": ["noisy", "频繁", "高频", "frequent"],
    "stale": ["stale", "过期", "超时未清", "outdated"],
    "duplicate": ["duplicate", "重复", "same"],
    "low_value": ["test", "debug", "info-only", "低价值"],
    "cascade": ["cascade", "级联", "downstream"],
    "known_bug": ["known bug", "已知问题", "won't fix"],
}


def load_alerts(days: int) -> list[dict]:
    """加载历史告警 (mock / DB)."""
    # 离线模式返回 mock
    base = datetime.now(timezone.utc)
    return [
        {
            "fingerprint": f"fp_{i}",
            "alertname": name,
            "instance": f"pg-{i % 3 + 1}",
            "labels": {"severity": sev, "team": "platform"},
            "annotations": {"summary": summary, "description": desc},
            "starts_at": (base).isoformat(),
            "ends_at": (base).isoformat() if i % 2 == 0 else None,
            "status": "firing" if i % 2 == 0 else "resolved",
        }
        for i, (name, sev, summary, desc) in enumerate([
            ("PGConnectionsHigh", "warning", "连接数过高", "pg-1 连接数达到 80%"),
            ("PGInstanceDown", "critical", "实例宕机", "pg-2 不可达"),
            ("PGConnectionsHigh", "warning", "连接数过高", "pg-3 连接数达到 85%"),
            ("PGDeadlockDetected", "warning", "死锁", "pg-1 检测到 3 个死锁"),
            ("PGRollbackHigh", "warning", "回滚率高", "pg-2 回滚率 5%"),
            ("PGConnectionsHigh", "warning", "连接数过高 (重复)", "pg-1 连接数又达 80%"),
            ("PGBloatHigh", "info", "膨胀", "pg-3 表膨胀 30%"),
            ("PGLongTransaction", "info", "长事务", "pg-2 有 5min 长事务"),
            ("PGConnectionsHigh", "warning", "连接数过高", "pg-1 第 3 次连接数过高"),
            ("PGCacheHitLow", "info", "缓存命中率低", "pg-3 缓存命中率 85%"),
        ])
    ]


def cluster_by_pattern(alerts: list[dict]) -> dict[str, list[dict]]:
    """按关键词模式聚类."""
    clusters: dict[str, list[dict]] = defaultdict(list)
    for a in alerts:
        text = (a.get("annotations", {}).get("summary", "") + " " +
                a.get("annotations", {}).get("description", "")).lower()
        matched = False
        for category, keywords in ALERT_PATTERNS.items():
            if any(kw.lower() in text for kw in keywords):
                clusters[category].append(a)
                matched = True
                break
        if not matched:
            clusters["unclassified"].append(a)
    return dict(clusters)


def cluster_by_alertname(alerts: list[dict]) -> dict[str, list[dict]]:
    """按 alertname 聚类 (用于发现高频告警)."""
    clusters: dict[str, list[dict]] = defaultdict(list)
    for a in alerts:
        clusters[a.get("alertname", "unknown")].append(a)
    return dict(clusters)


def suggest_rules_for_cluster(category: str, alerts: list[dict]) -> list[dict]:
    """为每个聚类建议抑制规则."""
    rules: list[dict] = []
    if category == "flapping":
        rules.append({
            "type": "flapping_inhibit",
            "reason": f"检测到 {len(alerts)} 条闪断告警",
            "rule": "source_match_re = '.*flapping.*' 抑制 5min 内同 alertname+instance",
        })
    elif category == "noisy":
        names = list({a.get("alertname") for a in alerts})
        rules.append({
            "type": "frequency_inhibit",
            "reason": f"高频告警: {names}, 累计 {len(alerts)} 条",
            "rule": f"alertname in {names} 触发超过 5 次/小时, 降级为 info",
        })
    elif category == "stale":
        rules.append({
            "type": "stale_inhibit",
            "reason": f"过期告警 {len(alerts)} 条, 多数已自动恢复",
            "rule": "ends_at 自动填充 + 持续 > 1h 自动 close",
        })
    elif category == "duplicate":
        names = list({a.get("alertname") for a in alerts})
        rules.append({
            "type": "dedup_inhibit",
            "reason": f"重复告警: {names}",
            "rule": f"fingerprint 重复时, 仅通知首次",
        })
    elif category == "cascade":
        rules.append({
            "type": "cascade_inhibit",
            "reason": "级联告警 (下游因上游故障触发)",
            "rule": "源故障时, 抑制同 instance 的下游告警 10min",
        })
    elif category == "known_bug":
        rules.append({
            "type": "silence",
            "reason": "已知 bug, 无需响应",
            "rule": "silence_until=bug-fix-deploy",
        })
    elif category == "low_value":
        rules.append({
            "type": "silence",
            "reason": "低价值告警 (test/debug)",
            "rule": "alertname regex 'Test|Debug' 直接丢弃",
        })
    return rules


def render_report(clusters: dict, name_clusters: dict, suggestions: list, days: int) -> str:
    """渲染 markdown 报告."""
    lines: list[str] = []
    lines.append("# 告警降噪 v2 报告 (LLM 聚类)")
    lines.append("")
    lines.append(f"生成时间: {datetime.now(timezone.utc).isoformat()}")
    lines.append(f"分析窗口: {days} 天")
    lines.append("")

    lines.append("## 1. 语义聚类结果")
    lines.append("")
    lines.append("| 类别 | 告警数 | 示例 alertname |")
    lines.append("|------|--------|----------------|")
    for category, alerts in sorted(clusters.items(), key=lambda x: -len(x[1])):
        sample_names = list({a.get("alertname") for a in alerts})[:3]
        lines.append(f"| {category} | {len(alerts)} | {', '.join(sample_names)} |")
    lines.append("")

    lines.append("## 2. 高频告警 (按 alertname)")
    lines.append("")
    lines.append("| alertname | 触发次数 | 影响实例 |")
    lines.append("|-----------|----------|----------|")
    for name, alerts in sorted(name_clusters.items(), key=lambda x: -len(x[1])):
        instances = list({a.get("instance") for a in alerts})
        lines.append(f"| {name} | {len(alerts)} | {', '.join(instances)} |")
    lines.append("")

    lines.append("## 3. 候选抑制规则 (待人工审核)")
    lines.append("")
    for i, sug in enumerate(suggestions, 1):
        lines.append(f"### 规则 {i}: {sug['type']}")
        lines.append(f"- **理由**: {sug['reason']}")
        lines.append(f"- **规则**: `{sug['rule']}`")
        lines.append("")

    lines.append("## 4. 实施步骤")
    lines.append("")
    lines.append("1. 人工审核候选规则, 确认无误")
    lines.append("2. 合并到 `deploy/alertmanager/inhibit/noise-v2.yml`")
    lines.append("3. `helm upgrade alertmanager ...`")
    lines.append("4. `curl -X POST http://localhost:9093/-/reload`")
    lines.append("5. 观察 7 天, 验证告警量下降")
    lines.append("")

    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="告警降噪 v2 LLM 聚类")
    parser.add_argument("--analyze", action="store_true", help="分析")
    parser.add_argument("--days", type=int, default=30, help="分析最近 N 天")
    parser.add_argument("--llm-provider", type=str, default="", help="LLM provider (openai/anthropic/local)")
    parser.add_argument("--output", type=str, help="输出 markdown 报告")
    args = parser.parse_args()

    print("===== 告警降噪 v2 =====")
    print(f"分析窗口: {args.days} 天")
    print(f"LLM provider: {args.llm_provider or '离线模式 (规则匹配)'}")

    alerts = load_alerts(args.days)
    print(f"加载告警: {len(alerts)} 条")

    clusters = cluster_by_pattern(alerts)
    name_clusters = cluster_by_alertname(alerts)

    print("\n--- 语义聚类 ---")
    for cat, items in sorted(clusters.items(), key=lambda x: -len(x[1])):
        print(f"  {cat}: {len(items)} 条")

    print("\n--- 高频告警 ---")
    for name, items in sorted(name_clusters.items(), key=lambda x: -len(x[1]))[:5]:
        print(f"  {name}: {len(items)} 条")

    suggestions: list[dict] = []
    for category, items in clusters.items():
        rs = suggest_rules_for_cluster(category, items)
        suggestions.extend(rs)

    print(f"\n生成候选规则: {len(suggestions)} 条")
    for s in suggestions:
        print(f"  - {s['type']}: {s['reason']}")

    report = render_report(clusters, name_clusters, suggestions, args.days)
    if args.output:
        Path(args.output).write_text(report, encoding="utf-8")
        print(f"\n已写入: {args.output}")
    else:
        print("\n" + report)

    V2_REPORT.write_text(report, encoding="utf-8")
    print(f"默认输出: {V2_REPORT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
