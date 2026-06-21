"""告警抑制建议工单生成器 (建议 2 落地工具).

目标:
  对连续 7 天 flapping_score > 0.5 的告警, 自动生成抑制建议工单 (dry-run 写 PR 描述).
  不直接改 rules.yml, 避免 CI 误触发.

工单格式:
  - Markdown (贴 GitHub PR / Jira / 钉钉审批)
  - JSON (供下游自动化消费)

用法:
  # 演练模式: 内置 mock 数据
  python scripts/ops/generate_inhibit_ticket.py --mock

  # 真实模式: 复用 analyze_alert_noise 的数据源
  python scripts/ops/generate_inhibit_ticket.py --alertmanager-url http://am:9093

  # 自定义阈值 (默认 0.5)
  python scripts/ops/generate_inhibit_ticket.py --mock --flapping-threshold 0.6

输出:
  - logs/inhibit_tickets/<date>.md
  - logs/inhibit_tickets/<date>.json
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT))

from scripts.ops.analyze_alert_noise import (
    fetch_alertmanager_alerts,
    get_mock_data,
)

# 抑制建议规则: 评分>阈值且触发>5次 视为"flapping 严重, 需要抑制"
DEFAULT_FLAPPING_THRESHOLD = 0.5
DEFAULT_MIN_FIRING_COUNT = 5

# 抑制时长建议: 评分越高, 抑制时间越长 (单位: 小时)
INHIBIT_HOURS_BY_SCORE = {
    (0.5, 0.7): 4,  # 中度 flapping: 抑制 4h, 让团队复盘
    (0.7, 0.85): 8,  # 高度 flapping: 抑制 8h, 走工单
    (0.85, 1.01): 24,  # 极端 flapping: 抑制 24h, 强制要求立即修
}


def _inhibit_hours(score: float) -> int:
    for (lo, hi), hrs in INHIBIT_HOURS_BY_SCORE.items():
        if lo <= score < hi:
            return hrs
    return 4


def _suggest_action(alert: dict) -> str:
    """基于 alertname 给出具体抑制手段."""
    name = alert["alertname"]
    if name.startswith("ZHSMonitor"):
        return (
            f"在 docker/prometheus/rules.yml 把 `for: {(alert.get('flapping_score', 0) > 0.7 and '15m') or '5m'}` 调整, "
            f"或拆 `table_name` 标签减少同一 monitor 重复触发"
        )
    if name == "HighCPUUsage":
        return "加 HPA 扩容阈值到 70%, 或在 `for:` 字段加 5m 冷却"
    if name.startswith("DiskWill"):
        return "调整预测窗口从 4h 到 12h, 或加 `for: 30m` 冷却"
    return f"加 `for: 5m` 抑制冷却, 或用 silence 规则 `{name}` 周期 (工作时间外)"


def build_ticket(alerts: list[dict], threshold: float, min_firing: int) -> dict:
    """基于分析数据生成抑制工单.

    Args:
        alerts: alert noise 分析结果中的 alerts 列表
        threshold: flapping_score 阈值
        min_firing: 最小 firing 次数

    Returns:
        dict 含 markdown + json + ticket_count + ticket_ids
    """
    candidates = [
        a for a in alerts if a.get("flapping_score", 0) >= threshold and a.get("firing_count", 0) >= min_firing
    ]
    candidates.sort(key=lambda a: a.get("flapping_score", 0), reverse=True)

    now = datetime.now(UTC)
    tickets = []
    for a in candidates:
        hours = _inhibit_hours(a["flapping_score"])
        tickets.append(
            {
                "alertname": a["alertname"],
                "flapping_score": a["flapping_score"],
                "firing_count": a["firing_count"],
                "median_duration_sec": a.get("median_duration_sec", 0.0),
                "severity": a.get("severity", "info"),
                "tenant_id": a.get("tenant_id", "default"),
                "inhibit_hours": hours,
                "suggested_action": _suggest_action(a),
                "created_at": now.isoformat(),
            }
        )

    return {
        "generated_at": now.isoformat(),
        "threshold": threshold,
        "min_firing": min_firing,
        "ticket_count": len(tickets),
        "tickets": tickets,
    }


def render_markdown(payload: dict) -> str:
    md = []
    md.append("# 告警抑制建议工单 (自动生成)\n")
    md.append(f"- 生成时间: `{payload['generated_at']}`")
    md.append(f"- 抑制阈值: flapping_score >= **{payload['threshold']}**, firing >= **{payload['min_firing']}**")
    md.append(f"- 命中工单: **{payload['ticket_count']}** 条")
    md.append("")
    if not payload["tickets"]:
        md.append("✅ 无 flapping 告警需要抑制\n")
        return "\n".join(md)
    md.append("## 待抑制告警 (按 flapping_score 降序)\n")
    md.append("| 告警 | Flapping | 触发 | 建议抑制 (h) | 措施 |")
    md.append("|------|----------|------|---------------|------|")
    for t in payload["tickets"]:
        md.append(
            f"| `{t['alertname']}` | {t['flapping_score']:.2f} | {t['firing_count']} | "
            f"{t['inhibit_hours']} | {t['suggested_action']} |"
        )
    md.append("")
    md.append("## 推荐 silence 规则 (粘贴到 alertmanager)\n")
    for t in payload["tickets"]:
        md.append("```yaml")
        md.append(
            f"- matchers:\n"
            f"    - alertname = \"{t['alertname']}\"\n"
            f"  duration: {t['inhibit_hours']}h\n"
            f"  comment: \"auto-inhibit: flapping_score={t['flapping_score']:.2f} firing={t['firing_count']}\"\n"
        )
        md.append("```")
    md.append("")
    md.append("## 复盘 checklist\n")
    md.append("- [ ] 确认抑制时长 (默认 4/8/24h)")
    md.append("- [ ] 关联 Grafana 面板查看告警趋势")
    md.append("- [ ] 走 code review 合并 silence 规则")
    md.append("- [ ] 24h 后回查, 若 flapping 仍 > 0.5 走工单升级\n")
    return "\n".join(md)


def main() -> int:
    p = argparse.ArgumentParser(description="告警抑制建议工单生成器")
    p.add_argument("--mock", action="store_true", help="用内置 mock 数据")
    p.add_argument("--alertmanager-url", help="真实 alertmanager URL")
    p.add_argument("--lookback-days", type=int, default=7, help="回看天数")
    p.add_argument("--flapping-threshold", type=float, default=DEFAULT_FLAPPING_THRESHOLD)
    p.add_argument("--min-firing-count", type=int, default=DEFAULT_MIN_FIRING_COUNT)
    p.add_argument(
        "--out-dir", default=str(ROOT / "logs" / "inhibit_tickets"), help="工单输出目录 (默认 logs/inhibit_tickets)"
    )
    args = p.parse_args()

    if args.mock:
        data = get_mock_data()
        print(f"[{datetime.now(UTC).isoformat()}] mock 模式, 8 条 ZHSMonitor + 2 业务")
    elif args.alertmanager_url:
        data = fetch_alertmanager_alerts(args.alertmanager_url, args.lookback_days)
        print(
            f"[{datetime.now(UTC).isoformat()}] 真实 am 模式, 已拉取 active + {args.lookback_days} 天 history"
        )
    else:
        print("✗ 必须指定 --mock 或 --alertmanager-url")
        return 2

    payload = build_ticket(
        data["alerts"],
        threshold=args.flapping_threshold,
        min_firing=args.min_firing_count,
    )

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    date_str = datetime.now(UTC).strftime("%Y%m%d")
    md_path = out_dir / f"{date_str}.md"
    json_path = out_dir / f"{date_str}.json"

    md = render_markdown(payload)
    md_path.write_text(md, encoding="utf-8")
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"[OK] 工单数: {payload['ticket_count']}")
    print(f"  markdown: {md_path} ({len(md)} 字符)")
    print(f"  json:     {json_path}")
    if payload["tickets"]:
        for t in payload["tickets"][:5]:
            print(
                f"    - {t['alertname']:<30} flapping={t['flapping_score']:.2f} firing={t['firing_count']:<3} inhibit={t['inhibit_hours']}h"
            )
    return 0


if __name__ == "__main__":
    sys.exit(main())
