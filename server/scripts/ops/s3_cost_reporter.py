"""Phase 16 建议 4: S3 生命周期 v4 - 月度成本报表 + 异常 bucket 报警.

目的:
  - 汇总 S3 桶的月度成本
  - 检测异常 (成本激增, 桶大小激增, 频繁 lifecycle miss)
  - 输出 Markdown / JSON 报表
  - 可选: 推送到 Slack / Webhook

设计:
  BucketUsage:
    bucket, size_gb, objects, monthly_cost_usd, storage_class_breakdown

  CostCalculator:
    按存储类计算月度成本 (S3 Standard / IA / Glacier 等)
    - Standard: $0.023/GB/月
    - IA: $0.0125/GB/月
    - Glacier: $0.004/GB/月
    - Deep Archive: $0.00099/GB/月

  AnomalyDetector:
    - 同比 (与上月比): cost_change_pct > 30% 报警
    - 桶大小: size_change_pct > 50% 报警
    - 成本绝对值: > threshold_usd 报警

  CostReporter:
    - 生成 Markdown 报表
    - 包含桶列表, 异常清单, 节省建议
    - 支持 JSON 导出

  AlertSink:
    - Webhook / Slack / 打印 (可扩展)
"""

from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass, field

# ---------------------------------------------------------------------------
# 1. 数据类
# ---------------------------------------------------------------------------


@dataclass
class BucketUsage:
    bucket: str
    size_gb: float
    objects: int
    storage_class: str = "STANDARD"
    # 上月数据 (用于对比)
    prev_size_gb: float = 0.0
    prev_monthly_cost_usd: float = 0.0

    def monthly_cost(self) -> float:
        return round(self.size_gb * STORAGE_CLASS_PRICING.get(self.storage_class, STORAGE_CLASS_PRICING["STANDARD"]), 4)


# 月度美元/GB 价格 (近似, 实际以 AWS 报价为准)
STORAGE_CLASS_PRICING = {
    "STANDARD": 0.023,
    "STANDARD_IA": 0.0125,
    "ONEZONE_IA": 0.01,
    "INTELLIGENT_TIERING": 0.023,
    "GLACIER": 0.004,
    "DEEP_ARCHIVE": 0.00099,
    "GLACIER_IR": 0.01,
}


@dataclass
class Anomaly:
    bucket: str
    severity: str  # LOW / MEDIUM / HIGH
    type: str  # cost_spike / size_spike / high_cost / policy_miss
    message: str
    metric: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "bucket": self.bucket,
            "severity": self.severity,
            "type": self.type,
            "message": self.message,
            **self.metric,
        }


# ---------------------------------------------------------------------------
# 2. CostCalculator
# ---------------------------------------------------------------------------


class CostCalculator:
    """计算 S3 桶成本."""

    @staticmethod
    def calc(usage: BucketUsage) -> float:
        return usage.monthly_cost()

    @staticmethod
    def calc_breakdown(usage: BucketUsage) -> dict:
        """成本细分: 存储费 + 假定请求费 (略)."""
        storage = CostCalculator.calc(usage)
        return {
            "storage": storage,
            "total": storage,
            "rate_per_gb": STORAGE_CLASS_PRICING.get(usage.storage_class, STORAGE_CLASS_PRICING["STANDARD"]),
        }

    @staticmethod
    def total(usages: list[BucketUsage]) -> float:
        return round(sum(CostCalculator.calc(u) for u in usages), 2)


# ---------------------------------------------------------------------------
# 3. AnomalyDetector
# ---------------------------------------------------------------------------


class AnomalyDetector:
    """检测 S3 成本/大小异常."""

    def __init__(
        self,
        cost_spike_pct: float = 30.0,
        size_spike_pct: float = 50.0,
        high_cost_threshold_usd: float = 1000.0,
    ):
        self.cost_spike_pct = cost_spike_pct
        self.size_spike_pct = size_spike_pct
        self.high_cost_threshold_usd = high_cost_threshold_usd

    def detect(self, usages: list[BucketUsage]) -> list[Anomaly]:
        anomalies: list[Anomaly] = []
        for u in usages:
            cost_now = CostCalculator.calc(u)
            # 1) 成本激增 (与上月比)
            if u.prev_monthly_cost_usd > 0:
                change = (cost_now - u.prev_monthly_cost_usd) / u.prev_monthly_cost_usd * 100.0
                if change > self.cost_spike_pct:
                    anomalies.append(
                        Anomaly(
                            bucket=u.bucket,
                            severity="HIGH" if change > 100 else "MEDIUM",
                            type="cost_spike",
                            message=f"成本环比 +{change:.1f}% (上月 ${u.prev_monthly_cost_usd:.2f} -> 本月 ${cost_now:.2f})",
                            metric={
                                "change_pct": round(change, 2),
                                "prev_cost": u.prev_monthly_cost_usd,
                                "curr_cost": cost_now,
                            },
                        )
                    )
            # 2) 桶大小激增
            if u.prev_size_gb > 0:
                change = (u.size_gb - u.prev_size_gb) / u.prev_size_gb * 100.0
                if change > self.size_spike_pct:
                    anomalies.append(
                        Anomaly(
                            bucket=u.bucket,
                            severity="MEDIUM",
                            type="size_spike",
                            message=f"桶大小 +{change:.1f}% (上月 {u.prev_size_gb:.2f}GB -> 本月 {u.size_gb:.2f}GB)",
                            metric={
                                "change_pct": round(change, 2),
                                "prev_size": u.prev_size_gb,
                                "curr_size": u.size_gb,
                            },
                        )
                    )
            # 3) 高成本桶
            if cost_now > self.high_cost_threshold_usd:
                anomalies.append(
                    Anomaly(
                        bucket=u.bucket,
                        severity="MEDIUM",
                        type="high_cost",
                        message=f"桶成本 ${cost_now:.2f}/月 超过阈值 ${self.high_cost_threshold_usd}",
                        metric={"monthly_cost_usd": cost_now, "threshold": self.high_cost_threshold_usd},
                    )
                )
        return anomalies


# ---------------------------------------------------------------------------
# 4. CostReporter
# ---------------------------------------------------------------------------


class CostReporter:
    """生成 S3 成本报表 (Markdown / JSON)."""

    def __init__(self, period: str = ""):
        self.period = period or time.strftime("%Y-%m")

    def to_markdown(
        self,
        usages: list[BucketUsage],
        anomalies: list[Anomaly],
    ) -> str:
        lines: list[str] = []
        lines.append(f"# S3 成本报表 ({self.period})")
        lines.append("")
        total = CostCalculator.total(usages)
        lines.append("## 汇总")
        lines.append("")
        lines.append(f"- 桶总数: **{len(usages)}**")
        lines.append(f"- 总存储: **{sum(u.size_gb for u in usages):.2f} GB**")
        lines.append(f"- 总对象数: **{sum(u.objects for u in usages):,}**")
        lines.append(f"- **月度总成本: ${total:.2f}**")
        lines.append("")
        if usages:
            lines.append("## 桶详情")
            lines.append("")
            lines.append("| 桶 | 大小 (GB) | 对象 | 存储类 | 月度成本 | 占比 |")
            lines.append("| --- | --- | --- | --- | --- | --- |")
            for u in sorted(usages, key=lambda x: -CostCalculator.calc(x)):
                cost = CostCalculator.calc(u)
                pct = (cost / total * 100) if total > 0 else 0
                lines.append(
                    f"| `{u.bucket}` | {u.size_gb:.2f} | {u.objects:,} | {u.storage_class} | ${cost:.2f} | {pct:.1f}% |"
                )
        lines.append("")
        if anomalies:
            lines.append("## ⚠️ 异常清单")
            lines.append("")
            lines.append("| 桶 | 严重度 | 类型 | 消息 |")
            lines.append("| --- | --- | --- | --- |")
            sev_order = {"HIGH": 3, "MEDIUM": 2, "LOW": 1}
            for a in sorted(anomalies, key=lambda x: -sev_order.get(x.severity, 0)):
                lines.append(f"| `{a.bucket}` | {a.severity} | {a.type} | {a.message} |")
        else:
            lines.append("## ✅ 无异常")
        lines.append("")
        # 节省建议
        suggestions = self._suggest_savings(usages)
        if suggestions:
            lines.append("## 💡 节省建议")
            lines.append("")
            for s in suggestions:
                lines.append(f"- {s}")
        return "\n".join(lines) + "\n"

    def to_json(
        self,
        usages: list[BucketUsage],
        anomalies: list[Anomaly],
    ) -> str:
        total = CostCalculator.total(usages)
        return json.dumps(
            {
                "period": self.period,
                "total_cost_usd": total,
                "total_size_gb": sum(u.size_gb for u in usages),
                "total_objects": sum(u.objects for u in usages),
                "buckets": [asdict(u) | {"monthly_cost_usd": CostCalculator.calc(u)} for u in usages],
                "anomalies": [a.to_dict() for a in anomalies],
                "suggestions": self._suggest_savings(usages),
            },
            ensure_ascii=False,
            indent=2,
            default=str,
        )

    def _suggest_savings(self, usages: list[BucketUsage]) -> list[str]:
        out: list[str] = []
        for u in usages:
            if u.storage_class == "STANDARD" and u.size_gb > 100:
                # 假设可降级到 STANDARD_IA
                cur = CostCalculator.calc(u)
                ia = u.size_gb * STORAGE_CLASS_PRICING["STANDARD_IA"]
                save = cur - ia
                if save > 5.0:
                    out.append(f"`{u.bucket}`: STANDARD -> STANDARD_IA 可节省 ${save:.2f}/月 ({save/cur*100:.0f}%)")
        return out


# ---------------------------------------------------------------------------
# 5. AlertSink
# ---------------------------------------------------------------------------


class AlertSink:
    """告警接收端 (webhook / slack / 打印)."""

    def __init__(self, webhook_url: str = ""):
        self.webhook_url = webhook_url
        self._delivered: list[dict] = []

    def send(self, anomalies: list[Anomaly]) -> dict:
        if not anomalies:
            return {"sent": 0, "ok": True}
        payload = {
            "text": f"🚨 S3 异常告警 ({len(anomalies)} 项)",
            "anomalies": [a.to_dict() for a in anomalies],
        }
        self._delivered.append(payload)
        if not self.webhook_url:
            return {"sent": len(anomalies), "ok": True, "mode": "stdout"}
        try:
            data = json.dumps(payload).encode("utf-8")
            req = urllib.request.Request(
                self.webhook_url,
                data=data,
                method="POST",
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                return {"sent": len(anomalies), "ok": resp.getcode() < 400, "status": resp.getcode()}
        except Exception as e:
            return {"sent": 0, "ok": False, "error": str(e)}

    @property
    def delivered(self) -> list[dict]:
        return list(self._delivered)


# ---------------------------------------------------------------------------
# 6. CLI
# ---------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    import argparse

    p = argparse.ArgumentParser(description="S3 成本报表 + 异常报警")
    p.add_argument("--input", help="JSON 输入文件 (含 buckets 数组)")
    p.add_argument("--period", default="", help="报表周期 (默认本月)")
    p.add_argument("--format", default="markdown", choices=["markdown", "json"])
    p.add_argument("--out", default="", help="输出文件 (默认 stdout)")
    p.add_argument("--webhook", default="", help="告警 webhook URL")
    p.add_argument("--cost-spike-pct", type=float, default=30.0)
    p.add_argument("--size-spike-pct", type=float, default=50.0)
    p.add_argument("--high-cost", type=float, default=1000.0)
    args = p.parse_args(argv)

    if args.input and os.path.exists(args.input):
        with open(args.input, encoding="utf-8") as f:
            data = json.load(f)
        usages = [BucketUsage(**item) for item in data]
    else:
        # demo 数据
        usages = [
            BucketUsage("zhs-logs", 500.0, 1_000_000, "STANDARD", prev_size_gb=400.0, prev_monthly_cost_usd=9.20),
            BucketUsage("zhs-archive", 2000.0, 100, "STANDARD", prev_size_gb=1800.0, prev_monthly_cost_usd=41.40),
            BucketUsage("zhs-cold", 800.0, 50, "STANDARD_IA"),
            BucketUsage(
                "zhs-billing-anomaly", 100.0, 10, "STANDARD", prev_size_gb=50.0, prev_monthly_cost_usd=1.15
            ),  # 翻倍
            BucketUsage("zhs-expensive", 50000.0, 5_000_000, "STANDARD"),  # 超阈值
        ]

    detector = AnomalyDetector(
        cost_spike_pct=args.cost_spike_pct,
        size_spike_pct=args.size_spike_pct,
        high_cost_threshold_usd=args.high_cost,
    )
    anomalies = detector.detect(usages)
    reporter = CostReporter(period=args.period)
    if args.format == "json":
        out = reporter.to_json(usages, anomalies)
    else:
        out = reporter.to_markdown(usages, anomalies)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(out)
        print(f"📄 报表已写入: {args.out}")
    else:
        print(out)

    if anomalies:
        sink = AlertSink(webhook_url=args.webhook)
        r = sink.send(anomalies)
        print(f"🚨 告警: {r}")
    return 0


if __name__ == "__main__":
    import sys

    sys.exit(main())
