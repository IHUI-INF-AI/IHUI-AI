"""Phase 16 建议 3: AI 灰度发布 (按租户灰度到新模型).

目的:
  - 按租户 ID 灰度, 新模型先给部分租户 (5%, 10%, 50%, 100%)
  - 支持租户白名单/黑名单
  - 支持按租户级别 (free/pro/enterprise) 分层灰度
  - 实时切换 + 灰度进度跟踪 + 报表

设计:
  CanaryStrategy:
    - percentage: 全局百分比 (0-100)
    - tenant_allowlist: 永远走 canary 的租户
    - tenant_blocklist: 永远不走 canary 的租户
    - tier_weights: 各 tier 内的灰度比例 (overrides percentage)

  TenantHasher:
    - 租户 ID -> 0-100 桶 (确定性, 一致)
    - 用于判断是否在灰度范围内

  CanaryRouter:
    - 接收 (tenant_id, request) -> 选 model
    - 记录灰度命中 (canary/conventional)
    - 提供报表 (灰度比例, 错误率)
"""

from __future__ import annotations

import hashlib
import time
from collections import defaultdict
from collections.abc import Callable
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

# ---------------------------------------------------------------------------
# 1. 数据类
# ---------------------------------------------------------------------------


class Tier(str, Enum):
    FREE = "free"
    PRO = "pro"
    ENTERPRISE = "enterprise"


@dataclass
class CanaryStats:
    """灰度命中统计."""

    canary_hits: int = 0
    conventional_hits: int = 0
    errors: int = 0
    total_latency_ms: float = 0.0

    @property
    def total(self) -> int:
        return self.canary_hits + self.conventional_hits

    @property
    def canary_ratio(self) -> float:
        if self.total == 0:
            return 0.0
        return self.canary_hits / self.total

    @property
    def avg_latency_ms(self) -> float:
        if self.total == 0:
            return 0.0
        return self.total_latency_ms / self.total

    def to_dict(self) -> dict:
        return {
            "canary_hits": self.canary_hits,
            "conventional_hits": self.conventional_hits,
            "errors": self.errors,
            "total": self.total,
            "canary_ratio": round(self.canary_ratio, 4),
            "avg_latency_ms": round(self.avg_latency_ms, 2),
        }


# ---------------------------------------------------------------------------
# 2. TenantHasher
# ---------------------------------------------------------------------------


class TenantHasher:
    """租户 ID -> 0-100 桶 (确定性, 一致)."""

    @staticmethod
    def bucket(tenant_id: str, salt: str = "zhs-canary") -> int:
        """返回 0-99 桶."""
        h = hashlib.md5(f"{salt}:{tenant_id}".encode()).digest()
        return h[0] % 100

    @staticmethod
    def in_canary(tenant_id: str, percentage: int, salt: str = "zhs-canary") -> bool:
        """判断 tenant 是否在 canary 范围内."""
        if percentage <= 0:
            return False
        if percentage >= 100:
            return True
        return TenantHasher.bucket(tenant_id, salt) < percentage


# ---------------------------------------------------------------------------
# 3. CanaryStrategy
# ---------------------------------------------------------------------------


@dataclass
class CanaryStrategy:
    """灰度策略.

    优先级:
      1. tenant_blocklist: 永远走 conventional
      2. tenant_allowlist: 永远走 canary
      3. tier_weights[tier]: tier 内的 canary 比例
      4. percentage: 全局 canary 比例 (兜底)
    """

    canary_model: str
    conventional_model: str
    percentage: int = 0  # 全局 canary 百分比
    tenant_allowlist: set[str] = field(default_factory=set)
    tenant_blocklist: set[str] = field(default_factory=set)
    tier_weights: dict[Tier, int] = field(default_factory=dict)
    salt: str = "zhs-canary"
    enabled: bool = True

    def __post_init__(self):
        if not 0 <= self.percentage <= 100:
            raise ValueError(f"percentage 必须在 0-100, 实际 {self.percentage}")
        for tier, p in self.tier_weights.items():
            if not 0 <= p <= 100:
                raise ValueError(f"tier {tier} 权重 {p} 越界")

    def should_use_canary(self, tenant_id: str, tier: Tier | str = Tier.FREE) -> bool:
        if not self.enabled:
            return False
        if tenant_id in self.tenant_blocklist:
            return False
        if tenant_id in self.tenant_allowlist:
            return True
        # tier 权重优先
        if tier in self.tier_weights or (isinstance(tier, str) and Tier(tier) in self.tier_weights):
            t = tier if isinstance(tier, Tier) else Tier(tier)
            p = self.tier_weights.get(t, self.percentage)
            return TenantHasher.in_canary(tenant_id, p, self.salt)
        return TenantHasher.in_canary(tenant_id, self.percentage, self.salt)


# ---------------------------------------------------------------------------
# 4. CanaryRouter
# ---------------------------------------------------------------------------


class CanaryRouter:
    """灰度路由器."""

    def __init__(
        self,
        strategy: CanaryStrategy,
        call_fn: Callable[[str, dict], Any] | None = None,
    ):
        self.strategy = strategy
        self.call_fn = call_fn  # 可选: 真实调用入口 (model, payload) -> response
        self._stats: dict[str, CanaryStats] = defaultdict(CanaryStats)  # per tenant
        self._global_stats = CanaryStats()
        self._log: list[dict] = []

    def route(self, tenant_id: str, request: dict, tier: Tier | str = Tier.FREE) -> dict:
        """路由请求到 model.

        Returns: {"model": ..., "tenant": ..., "is_canary": bool, "response": ..., "latency_ms": ...}
        """
        use_canary = self.strategy.should_use_canary(tenant_id, tier)
        model = self.strategy.canary_model if use_canary else self.strategy.conventional_model
        start = time.time()
        response: Any = None
        error: str | None = None
        try:
            if self.call_fn is not None:
                r = self.call_fn(model, request)
                if hasattr(r, "__await__") or hasattr(r, "__aiter__"):
                    # 不在异步上下文, 但接口允许
                    response = r
                else:
                    response = r
            else:
                # 模拟响应
                response = {"model": model, "echo": request.get("text", "")[:50]}
        except Exception as e:
            error = str(e)
        latency_ms = (time.time() - start) * 1000.0

        # 统计
        stats = self._stats[tenant_id]
        if error is not None:
            stats.errors += 1
            self._global_stats.errors += 1
        else:
            if use_canary:
                stats.canary_hits += 1
                self._global_stats.canary_hits += 1
            else:
                stats.conventional_hits += 1
                self._global_stats.conventional_hits += 1
        stats.total_latency_ms += latency_ms
        self._global_stats.total_latency_ms += latency_ms

        # 审计 log (限大小)
        self._log.append(
            {
                "ts": time.time(),
                "tenant": tenant_id,
                "tier": tier if isinstance(tier, str) else tier.value,
                "model": model,
                "is_canary": use_canary,
                "latency_ms": latency_ms,
                "error": error,
            }
        )
        if len(self._log) > 10000:
            self._log = self._log[-5000:]

        return {
            "model": model,
            "tenant": tenant_id,
            "tier": tier if isinstance(tier, str) else tier.value,
            "is_canary": use_canary,
            "response": response,
            "error": error,
            "latency_ms": latency_ms,
        }

    def stats(self, tenant_id: str | None = None) -> dict:
        if tenant_id is not None:
            return {tenant_id: self._stats[tenant_id].to_dict()}
        return {tid: s.to_dict() for tid, s in self._stats.items()}

    def global_stats(self) -> dict:
        return self._global_stats.to_dict()

    def report(self) -> str:
        """生成灰度报表 (Markdown)."""
        lines: list[str] = []
        lines.append("# AI 灰度发布报表")
        lines.append("")
        lines.append(f"- Canary 模型: `{self.strategy.canary_model}`")
        lines.append(f"- Conventional 模型: `{self.strategy.conventional_model}`")
        lines.append(f"- 灰度状态: {'启用' if self.strategy.enabled else '关闭'}")
        lines.append(f"- 灰度百分比: {self.strategy.percentage}%")
        if self.strategy.tenant_allowlist:
            lines.append(
                f"- 灰度白名单 ({len(self.strategy.tenant_allowlist)}): {', '.join(list(self.strategy.tenant_allowlist)[:5])}{'...' if len(self.strategy.tenant_allowlist) > 5 else ''}"
            )
        if self.strategy.tenant_blocklist:
            lines.append(
                f"- 黑名单 ({len(self.strategy.tenant_blocklist)}): {', '.join(list(self.strategy.tenant_blocklist)[:5])}{'...' if len(self.strategy.tenant_blocklist) > 5 else ''}"
            )
        if self.strategy.tier_weights:
            tw = ", ".join(f"{t.value}={p}%" for t, p in self.strategy.tier_weights.items())
            lines.append(f"- Tier 权重: {tw}")
        lines.append("")
        gs = self._global_stats
        lines.append("## 全局统计")
        lines.append("")
        lines.append(f"- 总请求: **{gs.total}**")
        lines.append(f"- Canary 命中: **{gs.canary_hits}** ({gs.canary_ratio*100:.1f}%)")
        lines.append(f"- Conventional 命中: **{gs.conventional_hits}**")
        lines.append(f"- 错误数: **{gs.errors}**")
        lines.append(f"- 平均延迟: **{gs.avg_latency_ms:.2f}ms**")
        lines.append("")
        if self._stats:
            lines.append("## Top 租户")
            lines.append("")
            lines.append("| 租户 | 总数 | Canary% | 平均延迟 |")
            lines.append("| --- | --- | --- | --- |")
            sorted_tenants = sorted(self._stats.items(), key=lambda x: -x[1].total)[:20]
            for tid, s in sorted_tenants:
                lines.append(f"| `{tid}` | {s.total} | {s.canary_ratio*100:.1f}% | {s.avg_latency_ms:.2f}ms |")
        return "\n".join(lines) + "\n"

    def reset(self) -> None:
        self._stats.clear()
        self._global_stats = CanaryStats()
        self._log.clear()


# ---------------------------------------------------------------------------
# 5. CLI
# ---------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    import argparse

    p = argparse.ArgumentParser(description="AI 灰度发布路由器")
    p.add_argument("--canary-model", default="gpt-4-turbo")
    p.add_argument("--conventional-model", default="gpt-3.5-turbo")
    p.add_argument("--percentage", type=int, default=10)
    p.add_argument("--allowlist", nargs="*", default=[])
    p.add_argument("--blocklist", nargs="*", default=[])
    p.add_argument("--free-pct", type=int, default=None, help="FREE tier canary 比例")
    p.add_argument("--pro-pct", type=int, default=None)
    p.add_argument("--enterprise-pct", type=int, default=None)
    p.add_argument("--tenants", nargs="*", default=["user-1", "user-2", "user-3", "user-4", "user-5"])
    p.add_argument("--report", action="store_true", help="打印报表")
    args = p.parse_args(argv)

    tier_weights = {}
    if args.free_pct is not None:
        tier_weights[Tier.FREE] = args.free_pct
    if args.pro_pct is not None:
        tier_weights[Tier.PRO] = args.pro_pct
    if args.enterprise_pct is not None:
        tier_weights[Tier.ENTERPRISE] = args.enterprise_pct

    strategy = CanaryStrategy(
        canary_model=args.canary_model,
        conventional_model=args.conventional_model,
        percentage=args.percentage,
        tenant_allowlist=set(args.allowlist),
        tenant_blocklist=set(args.blocklist),
        tier_weights=tier_weights,
    )
    router = CanaryRouter(strategy)

    # 模拟请求
    for tid in args.tenants:
        tier = Tier.PRO if "pro" in tid else Tier.FREE
        result = router.route(tid, {"text": f"hello from {tid}"}, tier)
        print(f"  {tid:12s} -> {result['model']:20s} canary={result['is_canary']}")

    if args.report:
        print()
        print(router.report())
    return 0


if __name__ == "__main__":
    import sys

    sys.exit(main())
