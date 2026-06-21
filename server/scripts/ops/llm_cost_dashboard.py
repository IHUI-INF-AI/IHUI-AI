"""Phase 17 建议 1: LLM 路由成本看板.

目的:
  - 实时统计每租户 / 每模型 token 消耗 + 成本 + 错误率
  - 提供 Top 排名 + 时间窗口汇总
  - 导出 CSV / Markdown 报表
  - 与 Phase 16 CanaryRouter 集成, 自动记录每次路由

设计:
  ModelPricing:
    按模型 (input/output) per-1k token 价格表 (USD)

  UsageRecord:
    tenant_id, model, prompt_tokens, completion_tokens, cost_usd, error, ts

  CostTracker:
    record() 添加一条
    by_tenant(tenant) / by_model(model) 聚合
    top_tenants(n) / top_models(n)
    to_csv() / to_markdown()

  DashboardReporter:
    拼装总体报表 (按租户 / 模型 / 时间)
    包含 token 总量, 总成本, 错误率
"""

from __future__ import annotations

import csv
import io
import json
import time
from collections import defaultdict
from dataclasses import asdict, dataclass, field
from typing import Any

# 模型定价 (USD per 1K tokens, 近似)
# 来源: 各厂商公开价目表 (2026-06 近似值)
MODEL_PRICING = {
    "gpt-4": {"input": 0.03, "output": 0.06},
    "gpt-4-turbo": {"input": 0.01, "output": 0.03},
    "gpt-4o": {"input": 0.005, "output": 0.015},
    "gpt-4o-mini": {"input": 0.00015, "output": 0.0006},
    "gpt-3.5-turbo": {"input": 0.0015, "output": 0.002},
    "claude-3-opus": {"input": 0.015, "output": 0.075},
    "claude-3-sonnet": {"input": 0.003, "output": 0.015},
    "claude-3-haiku": {"input": 0.00025, "output": 0.00125},
    "gemini-pro": {"input": 0.00025, "output": 0.0005},
    "deepseek-chat": {"input": 0.00014, "output": 0.00028},
    "qwen-max": {"input": 0.0004, "output": 0.0012},
    "llama-3-70b": {"input": 0.00059, "output": 0.00079},
}


# ---------------------------------------------------------------------------
# 1. ModelPricing
# ---------------------------------------------------------------------------


class ModelPricing:
    """模型价格表."""

    @staticmethod
    def get(model: str) -> dict:
        """获取模型价格, 找不到返回默认值."""
        return MODEL_PRICING.get(model, {"input": 0.001, "output": 0.002})

    @staticmethod
    def calc_cost(model: str, prompt_tokens: int, completion_tokens: int) -> float:
        pricing = ModelPricing.get(model)
        cost = (prompt_tokens / 1000.0) * pricing["input"] + (completion_tokens / 1000.0) * pricing["output"]
        return round(cost, 6)

    @staticmethod
    def known_models() -> list[str]:
        return list(MODEL_PRICING.keys())


# ---------------------------------------------------------------------------
# 2. UsageRecord
# ---------------------------------------------------------------------------


@dataclass
class UsageRecord:
    tenant_id: str
    model: str
    prompt_tokens: int = 0
    completion_tokens: int = 0
    cost_usd: float = 0.0
    error: str = ""
    ts: float = field(default_factory=time.time)
    is_canary: bool = False

    def to_dict(self) -> dict:
        return asdict(self)


# ---------------------------------------------------------------------------
# 3. CostTracker
# ---------------------------------------------------------------------------


class CostTracker:
    """成本跟踪器 (内存版, 生产环境应接 DB)."""

    def __init__(self, max_records: int = 100_000):
        self._records: list[UsageRecord] = []
        self._max = max_records

    def record(self, rec: UsageRecord) -> None:
        self._records.append(rec)
        # 防止内存膨胀
        if len(self._records) > self._max:
            self._records = self._records[-self._max :]

    def record_usage(
        self,
        tenant_id: str,
        model: str,
        prompt_tokens: int,
        completion_tokens: int,
        error: str = "",
        is_canary: bool = False,
        ts: float | None = None,
    ) -> UsageRecord:
        cost = ModelPricing.calc_cost(model, prompt_tokens, completion_tokens) if not error else 0.0
        rec = UsageRecord(
            tenant_id=tenant_id,
            model=model,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            cost_usd=cost,
            error=error,
            ts=ts or time.time(),
            is_canary=is_canary,
        )
        self.record(rec)
        return rec

    def records(self, since: float | None = None) -> list[UsageRecord]:
        if since is None:
            return list(self._records)
        return [r for r in self._records if r.ts >= since]

    def by_tenant(self, tenant_id: str) -> dict:
        rows = [r for r in self._records if r.tenant_id == tenant_id]
        return self._aggregate(rows)

    def by_model(self, model: str) -> dict:
        rows = [r for r in self._records if r.model == model]
        return self._aggregate(rows)

    def top_tenants(self, n: int = 10) -> list[tuple[str, dict]]:
        agg: dict[str, list[UsageRecord]] = defaultdict(list)
        for r in self._records:
            agg[r.tenant_id].append(r)
        ranked = [(tid, self._aggregate(rs)) for tid, rs in agg.items()]
        ranked.sort(key=lambda x: -x[1]["total_cost_usd"])
        return ranked[:n]

    def top_models(self, n: int = 10) -> list[tuple[str, dict]]:
        agg: dict[str, list[UsageRecord]] = defaultdict(list)
        for r in self._records:
            agg[r.model].append(r)
        ranked = [(m, self._aggregate(rs)) for m, rs in agg.items()]
        ranked.sort(key=lambda x: -x[1]["total_cost_usd"])
        return ranked[:n]

    def _aggregate(self, rows: list[UsageRecord]) -> dict:
        if not rows:
            return {
                "total_requests": 0,
                "total_errors": 0,
                "error_rate": 0.0,
                "total_prompt_tokens": 0,
                "total_completion_tokens": 0,
                "total_tokens": 0,
                "total_cost_usd": 0.0,
                "canary_requests": 0,
            }
        n = len(rows)
        err = sum(1 for r in rows if r.error)
        p = sum(r.prompt_tokens for r in rows)
        c = sum(r.completion_tokens for r in rows)
        cost = sum(r.cost_usd for r in rows)
        can = sum(1 for r in rows if r.is_canary)
        return {
            "total_requests": n,
            "total_errors": err,
            "error_rate": round(err / n, 4) if n > 0 else 0.0,
            "total_prompt_tokens": p,
            "total_completion_tokens": c,
            "total_tokens": p + c,
            "total_cost_usd": round(cost, 4),
            "canary_requests": can,
        }

    def global_stats(self) -> dict:
        return self._aggregate(self._records)

    def window_stats(self, seconds: float) -> dict:
        """时间窗口内的统计."""
        since = time.time() - seconds
        return self._aggregate(self.records(since=since))

    def to_csv(self) -> str:
        """所有记录导出 CSV."""
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(
            [
                "ts",
                "tenant_id",
                "model",
                "prompt_tokens",
                "completion_tokens",
                "cost_usd",
                "error",
                "is_canary",
            ]
        )
        for r in self._records:
            writer.writerow(
                [
                    r.ts,
                    r.tenant_id,
                    r.model,
                    r.prompt_tokens,
                    r.completion_tokens,
                    r.cost_usd,
                    r.error,
                    r.is_canary,
                ]
            )
        return buf.getvalue()

    def to_json(self) -> str:
        return json.dumps([r.to_dict() for r in self._records], ensure_ascii=False, default=str)

    def clear(self) -> None:
        self._records.clear()

    def __len__(self) -> int:
        return len(self._records)


# ---------------------------------------------------------------------------
# 4. DashboardReporter
# ---------------------------------------------------------------------------


class DashboardReporter:
    """生成 Markdown 仪表板报表."""

    def __init__(self, period: str = ""):
        self.period = period or time.strftime("%Y-%m")

    def build(
        self,
        tracker: CostTracker,
        top_tenants: int = 10,
        top_models: int = 10,
    ) -> str:
        gs = tracker.global_stats()
        lines: list[str] = []
        lines.append(f"# LLM 路由成本看板 ({self.period})")
        lines.append("")
        lines.append("## 全局汇总")
        lines.append("")
        lines.append(f"- 总请求数: **{gs['total_requests']:,}**")
        lines.append(f"- 错误数: **{gs['total_errors']:,}** ({gs['error_rate']*100:.2f}%)")
        lines.append(
            f"- 总 token: **{gs['total_tokens']:,}** (prompt {gs['total_prompt_tokens']:,} + completion {gs['total_completion_tokens']:,})"
        )
        lines.append(f"- **总成本: ${gs['total_cost_usd']:.4f}**")
        lines.append(f"- 灰度请求: **{gs['canary_requests']:,}**")
        lines.append("")
        # Top 租户
        lines.append(f"## Top {top_tenants} 租户 (按成本)")
        lines.append("")
        lines.append("| 租户 | 请求 | 错误率 | token | 成本 (USD) |")
        lines.append("| --- | --- | --- | --- | --- |")
        for tid, s in tracker.top_tenants(top_tenants):
            lines.append(
                f"| `{tid}` | {s['total_requests']:,} | {s['error_rate']*100:.2f}% | {s['total_tokens']:,} | ${s['total_cost_usd']:.4f} |"
            )
        lines.append("")
        # Top 模型
        lines.append(f"## Top {top_models} 模型 (按成本)")
        lines.append("")
        lines.append("| 模型 | 请求 | 错误率 | token | 成本 (USD) |")
        lines.append("| --- | --- | --- | --- | --- |")
        for m, s in tracker.top_models(top_models):
            lines.append(
                f"| `{m}` | {s['total_requests']:,} | {s['error_rate']*100:.2f}% | {s['total_tokens']:,} | ${s['total_cost_usd']:.4f} |"
            )
        return "\n".join(lines) + "\n"

    def build_window(
        self,
        tracker: CostTracker,
        seconds: float,
    ) -> str:
        """时间窗口报表."""
        s = tracker.window_stats(seconds)
        lines: list[str] = []
        lines.append(f"# LLM 路由 - 最近 {seconds:.0f}s 窗口")
        lines.append("")
        lines.append(f"- 请求: **{s['total_requests']:,}**")
        lines.append(f"- 错误: **{s['total_errors']:,}** ({s['error_rate']*100:.2f}%)")
        lines.append(f"- Token: **{s['total_tokens']:,}**")
        lines.append(f"- **成本: ${s['total_cost_usd']:.4f}**")
        return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# 5. CanaryRouter 集成: 桥接
# ---------------------------------------------------------------------------


class CanaryRouterCostBridge:
    """把 Phase 16 CanaryRouter 桥接到 CostTracker.

    用法:
        tracker = CostTracker()
        bridge = CanaryRouterCostBridge(tracker)
        router = CanaryRouter(strategy, call_fn=bridge.wrapped_call())
    """

    def __init__(self, tracker: CostTracker):
        self.tracker = tracker

    def wrapped_call(self, tenant_resolver: Any | None = None):
        """返回 call_fn, 自动从响应里抓 token + 错误, 写入 tracker.

        tenant_resolver: 可选, (model, payload, response) -> tenant_id
        """

        def call(model: str, payload: dict):
            # 真实环境下调用 LLM API, 这里模拟
            # 模拟响应: 200 token completion, 50 token prompt
            response = {
                "usage": {
                    "prompt_tokens": payload.get("_prompt_tokens", 50),
                    "completion_tokens": payload.get("_completion_tokens", 200),
                },
                "content": f"echo: {payload.get('text', '')[:30]}",
            }
            tenant = tenant_resolver(model, payload, response) if tenant_resolver else payload.get("_tenant", "unknown")
            error = response.get("error", "")
            self.tracker.record_usage(
                tenant_id=tenant,
                model=model,
                prompt_tokens=response["usage"]["prompt_tokens"],
                completion_tokens=response["usage"]["completion_tokens"],
                error=error if error else "",
            )
            return response

        return call


# ---------------------------------------------------------------------------
# 6. CLI
# ---------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    import argparse

    p = argparse.ArgumentParser(description="LLM 路由成本看板")
    p.add_argument("--period", default="")
    p.add_argument("--format", default="markdown", choices=["markdown", "csv", "json"])
    p.add_argument("--out", default="")
    p.add_argument("--demo", action="store_true", help="加载 demo 数据后展示")
    p.add_argument("--top-tenants", type=int, default=10)
    p.add_argument("--top-models", type=int, default=10)
    p.add_argument("--window", type=float, default=0.0, help="只显示最近 N 秒窗口 (0=全部)")
    args = p.parse_args(argv)

    tracker = CostTracker()
    if args.demo or not tracker._records:
        # demo 数据
        for i in range(100):
            model = ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo", "claude-3-opus", "gpt-4o-mini"][i % 5]
            tenant = [f"user-{i % 8}", "vip-1", "vip-2"][i % 10 % 3] if i % 10 < 9 else f"user-{i % 8}"
            err = "" if i % 20 != 0 else "rate limit"
            tracker.record_usage(
                tenant_id=tenant,
                model=model,
                prompt_tokens=100 + i * 5,
                completion_tokens=200 + i * 10,
                error=err,
                is_canary=(i % 2 == 0),
            )

    if args.format == "csv":
        out = tracker.to_csv()
    elif args.format == "json":
        out = tracker.to_json()
    else:
        reporter = DashboardReporter(period=args.period)
        if args.window > 0:
            out = reporter.build_window(tracker, args.window)
        else:
            out = reporter.build(tracker, top_tenants=args.top_tenants, top_models=args.top_models)

    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(out)
        print(f"📄 已写入: {args.out}")
    else:
        print(out)
    return 0


if __name__ == "__main__":
    import sys

    sys.exit(main())
