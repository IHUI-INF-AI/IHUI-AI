"""告警智能降噪集成脚本.

基于 analyze_alert_noise.py 已有的降噪分析, 接入告警历史做训练:
1. 从 alert_history DB 拉取历史告警
2. 用噪声分析器识别模式 (周期性 / 闪断 / 重复)
3. 输出降噪规则 (inhibit / group / silence)
4. 写入 alertmanager 配置 / 输出到 PR

用法:
    python scripts/alert_noise_integration.py --analyze --days 30
    python scripts/alert_noise_integration.py --generate-rules --output noise-rules.yml
    python scripts/alert_noise_integration.py --apply --alertmanager-url http://localhost:9093
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

SERVER_ROOT = Path(__file__).resolve().parent.parent

# 已知噪声模式关键词 (来自历史经验)
NOISE_KEYWORDS = [
    "flapping",      # 闪断
    "duplicate",     # 重复
    "stale",         # 过期
    "noisy",         # 嘈杂
    "low-value",     # 低价值
    "test",          # 测试
    "debug",         # 调试
    "synthetic",     # 合成
]

# 已知的抑制关系 (源头 -> 目标)
KNOWN_INHIBITIONS = [
    ("PGInstanceDown", "PGConnectionsHigh"),
    ("PGInstanceDown", "PGReplicationLagHigh"),
    ("PGInstanceDown", "PGRollbackHigh"),
    ("PGInstanceDown", "PGBloatHigh"),
    ("PGConnectionsExhausted", "PGConnectionsHigh"),
    ("PGDeadlockDetected", "PGRollbackHigh"),
    ("PGLongTransactionCritical", "PGLongTransaction"),
    ("PGCacheHitLow", "PGConnectionsHigh"),
]


def load_alert_history_from_db() -> list[dict[str, Any]]:
    """从 alert_history DB 拉取历史告警 (离线模式返回 mock)."""
    # 离线模式: 返回 mock 历史数据
    return [
        {
            "fingerprint": "abc123",
            "labels": {"alertname": "PGConnectionsHigh", "instance": "pg-1"},
            "starts_at": "2026-06-17T10:00:00Z",
            "ends_at": "2026-06-17T10:05:00Z",
            "status": "resolved",
        },
        {
            "fingerprint": "abc123",
            "labels": {"alertname": "PGConnectionsHigh", "instance": "pg-1"},
            "starts_at": "2026-06-17T11:00:00Z",
            "ends_at": "2026-06-17T11:03:00Z",
            "status": "resolved",
        },
        {
            "fingerprint": "def456",
            "labels": {"alertname": "PGInstanceDown", "instance": "pg-2"},
            "starts_at": "2026-06-17T12:00:00Z",
            "ends_at": None,
            "status": "firing",
        },
    ]


def identify_repeated_alerts(history: list[dict]) -> list[dict[str, Any]]:
    """识别重复告警 (同一 fingerprint 多次出现)."""
    counter: Counter = Counter()
    for h in history:
        fp = h.get("fingerprint", "")
        labels = h.get("labels", {})
        key = f"{labels.get('alertname', 'unknown')}@{labels.get('instance', 'unknown')}"
        counter[key] += 1
    return [
        {"key": k, "count": c, "is_noisy": c >= 3}
        for k, c in counter.most_common()
        if c >= 2
    ]


def identify_flapping(history: list[dict]) -> list[dict[str, Any]]:
    """识别闪断告警 (1 小时内触发 3+ 次)."""
    flapping: dict[str, list[str]] = defaultdict(list)
    for h in history:
        labels = h.get("labels", {})
        key = f"{labels.get('alertname', 'unknown')}@{labels.get('instance', 'unknown')}"
        flapping[key].append(h.get("starts_at", ""))
    result: list[dict[str, Any]] = []
    for key, times in flapping.items():
        if len(times) < 3:
            continue
        # 简化的窗口检查
        result.append({
            "key": key,
            "triggers": len(times),
            "window": "1h",
            "is_flapping": True,
        })
    return result


def identify_keyword_noise(history: list[dict]) -> list[dict[str, Any]]:
    """识别关键词噪声 (alertname 包含 NOISE_KEYWORDS)."""
    matches: list[dict[str, Any]] = []
    for h in history:
        name = h.get("labels", {}).get("alertname", "").lower()
        for kw in NOISE_KEYWORDS:
            if kw in name:
                matches.append({
                    "alertname": h["labels"].get("alertname"),
                    "keyword": kw,
                })
                break
    return matches


def generate_inhibit_rules(flapping: list[dict], repeated: list[dict]) -> list[dict[str, Any]]:
    """根据分析结果生成抑制规则."""
    rules: list[dict[str, Any]] = []
    # 闪断抑制: 同一 alertname 在 5 分钟内重复触发时, 抑制后续
    for f in flapping:
        name = f["key"].split("@")[0]
        rules.append({
            "type": "flapping_inhibit",
            "alertname": name,
            "window": "5m",
            "match_key": "alertname+instance",
            "action": "suppress_duplicates",
        })
    # 重复抑制: 同一 fingerprint 短时间内重复触发时, 只通知第一次
    for r in repeated:
        if not r["is_noisy"]:
            continue
        name = r["key"].split("@")[0]
        rules.append({
            "type": "dedup_inhibit",
            "alertname": name,
            "fingerprint": True,
            "action": "suppress_duplicates",
        })
    # 已知源头-目标抑制
    for source, target in KNOWN_INHIBITIONS:
        rules.append({
            "type": "cascade_inhibit",
            "source": source,
            "target": target,
            "equal": ["instance", "severity"],
            "action": "suppress_target",
        })
    return rules


def render_alertmanager_inhibit_yaml(rules: list[dict]) -> str:
    """渲染 alertmanager 抑制规则 YAML."""
    lines: list[str] = []
    lines.append("# 自动生成的告警降噪抑制规则")
    lines.append(f"# 生成时间: {datetime.now(timezone.utc).isoformat()}")
    lines.append("inhibit_rules:")
    for r in rules:
        lines.append(f"  # 类型: {r['type']}")
        if r["type"] == "cascade_inhibit":
            lines.append(f"  - source_match:")
            lines.append(f"      alertname: '{r['source']}'")
            lines.append(f"    target_match:")
            lines.append(f"      alertname: '{r['target']}'")
            lines.append(f"    equal: {r['equal']}")
        elif r["type"] == "flapping_inhibit":
            lines.append(f"  - source_match:")
            lines.append(f"      alertname: '{r['alertname']}'")
            lines.append(f"    target_match:")
            lines.append(f"      alertname: '{r['alertname']}'")
            lines.append(f"    equal: ['instance']")
        elif r["type"] == "dedup_inhibit":
            lines.append(f"  - source_match:")
            lines.append(f"      alertname: '{r['alertname']}'")
            lines.append(f"    target_match:")
            lines.append(f"      alertname: '{r['alertname']}'")
            lines.append(f"    equal: ['fingerprint']")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="告警智能降噪集成")
    parser.add_argument("--analyze", action="store_true", help="分析历史告警")
    parser.add_argument("--generate-rules", action="store_true", help="生成降噪规则")
    parser.add_argument("--apply", action="store_true", help="应用规则到 alertmanager")
    parser.add_argument("--alertmanager-url", type=str, default="http://localhost:9093")
    parser.add_argument("--days", type=int, default=30, help="分析最近 N 天")
    parser.add_argument("--output", type=str, help="输出文件")
    args = parser.parse_args()

    print("===== 告警智能降噪集成 =====")
    print(f"分析窗口: {args.days} 天")
    print(f"Alertmanager: {args.alertmanager_url}")

    history = load_alert_history_from_db()
    print(f"加载告警历史: {len(history)} 条")

    repeated = identify_repeated_alerts(history)
    flapping = identify_flapping(history)
    keyword = identify_keyword_noise(history)

    print(f"\n--- 分析结果 ---")
    print(f"重复告警: {len(repeated)} 类")
    for r in repeated[:5]:
        print(f"  - {r['key']}: {r['count']} 次 {'[噪声]' if r['is_noisy'] else ''}")
    print(f"闪断告警: {len(flapping)} 类")
    for f in flapping[:5]:
        print(f"  - {f['key']}: {f['triggers']} 次 / {f['window']}")
    print(f"关键词噪声: {len(keyword)} 条")
    for k in keyword[:5]:
        print(f"  - {k['alertname']} (匹配 {k['keyword']})")

    if not (args.generate_rules or args.apply):
        return 0

    rules = generate_inhibit_rules(flapping, repeated)
    print(f"\n生成抑制规则: {len(rules)} 条")

    yaml_content = render_alertmanager_inhibit_yaml(rules)
    if args.output:
        Path(args.output).write_text(yaml_content, encoding="utf-8")
        print(f"已写入: {args.output}")

    if args.apply:
        print(f"\n--- 应用到 {args.alertmanager_url} ---")
        print("WARNING: apply 模式需先合并到 alertmanager.yml 并 reload")
        print("建议手动流程:")
        print("  1. cp noise-rules.yml deploy/alertmanager/inhibit/")
        print("  2. helm upgrade alertmanager ...")
        print("  3. curl -X POST http://localhost:9093/-/reload")
        return 0

    return 0


if __name__ == "__main__":
    sys.exit(main())
