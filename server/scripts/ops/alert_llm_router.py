"""Phase 14 建议 4: LLM 告警摘要多模型路由.

目的:
  Phase 11 建议 4 用单一模型 (默认 gpt-4o-mini) 做摘要.
  Phase 14 加多模型路由:
  1. 按 alertname / severity 路由到不同模型
     例: HighErrorRate → gpt-4o (高精度)
         DiskSpaceLow → gpt-4o-mini (低成本)
         兜底 → mock
  2. 配额管理: 每模型每分钟 N 请求, 超限拒绝或排队
  3. 成本估算: 按 input/output token 单价累计
  4. A/B 测试: 按 hash(alert) % 100 分配到对照/实验组
  5. 自动降级: 主模型不可用 → 备选, 仍失败 → mock

组件:
  - ModelRoute         路由规则
  - ModelQuota         配额 (滑动窗口)
  - ModelStats         统计 (调用/错误/成本)
  - ModelRouter        选模型 + 调 + 记录 + 降级
  - route_summarize    高层 API

用法:
  router = ModelRouter.from_config({
      "routes": [
          {"model": "gpt-4o",        "match": {"alertname": "HighErrorRate"}, "priority": 10, "rpm": 60, "cost_per_1k_input": 0.005, "cost_per_1k_output": 0.015},
          {"model": "gpt-4o-mini",   "match": {"alertname": "DiskSpaceLow"}, "priority": 5,  "rpm": 120, "cost_per_1k_input": 0.00015, "cost_per_1k_output": 0.0006},
          {"model": "mock",          "match": {},                             "priority": 1,  "rpm": 9999, "cost_per_1k_input": 0, "cost_per_1k_output": 0},
      ],
      "ab_test": {
          "enabled": True,
          "experiment_model": "gpt-4o",
          "control_model": "gpt-4o-mini",
          "experiment_pct": 20,
      },
      "fallback_chain": ["mock"],
  })

  summary = router.summarize(alert, force_mock=False)
  print(router.stats_dict())
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import time
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_ROOT / "scripts" / "ops"))

import alert_llm_summary  # noqa: E402

# ---------------------------------------------------------------------------
# 1. 数据类
# ---------------------------------------------------------------------------


@dataclass
class ModelRoute:
    """单条路由规则."""

    model: str
    matcher: dict[str, str] = field(default_factory=dict)  # alertname / severity 精确匹配
    alertname_pattern: str = ""  # alertname 正则匹配
    severity: str = ""  # 严重程度匹配
    priority: int = 0  # 高优先级优先
    rpm: int = 60  # 每分钟请求数上限
    cost_per_1k_input: float = 0.0
    cost_per_1k_output: float = 0.0
    enabled: bool = True

    def matches(self, alert: dict) -> bool:
        if not self.enabled:
            return False
        if self.matcher:
            for k, v in self.matcher.items():
                if alert.get(k) != v:
                    return False
            return True
        if self.alertname_pattern:
            name = alert.get("alertname", "")
            if not re.search(self.alertname_pattern, name):
                return False
        if self.severity:
            if alert.get("severity", "") != self.severity:
                return False
        return True


class ModelQuota:
    """滑动窗口配额 (每分钟 N 个请求)."""

    def __init__(self, rpm: int):
        self.rpm = rpm
        self.calls: deque[float] = deque()

    def allow(self) -> bool:
        """检查是否允许一次调用, 允许则记录时间戳."""
        now = time.time()
        # 清掉 60s 之外的
        while self.calls and now - self.calls[0] > 60.0:
            self.calls.popleft()
        if len(self.calls) >= self.rpm:
            return False
        self.calls.append(now)
        return True

    def remaining(self) -> int:
        now = time.time()
        while self.calls and now - self.calls[0] > 60.0:
            self.calls.popleft()
        return max(0, self.rpm - len(self.calls))

    def reset(self) -> None:
        self.calls.clear()


@dataclass
class ModelStats:
    """单模型统计."""

    call_count: int = 0
    success_count: int = 0
    error_count: int = 0
    fallback_count: int = 0
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_cost_usd: float = 0.0
    last_call_ts: float = 0.0
    last_error: str = ""

    def record_call(self, success: bool, input_tokens: int, output_tokens: int, cost: float) -> None:
        self.call_count += 1
        if success:
            self.success_count += 1
        else:
            self.error_count += 1
        self.total_input_tokens += input_tokens
        self.total_output_tokens += output_tokens
        self.total_cost_usd += cost
        self.last_call_ts = time.time()

    def to_dict(self) -> dict:
        return {
            "call_count": self.call_count,
            "success_count": self.success_count,
            "error_count": self.error_count,
            "fallback_count": self.fallback_count,
            "total_input_tokens": self.total_input_tokens,
            "total_output_tokens": self.total_output_tokens,
            "total_cost_usd": round(self.total_cost_usd, 6),
            "last_call_ts": self.last_call_ts,
            "last_error": self.last_error,
        }


# ---------------------------------------------------------------------------
# 2. ModelRouter
# ---------------------------------------------------------------------------

# transient 异常 (同 phase 13)
_TRANSIENT_EXCEPTIONS = (ConnectionError, TimeoutError, OSError)


class ModelRouter:
    """多模型路由器."""

    def __init__(
        self,
        routes: list[ModelRoute],
        ab_test: dict | None = None,
        fallback_chain: list[str] | None = None,
        max_retries_per_model: int = 1,
    ):
        self.routes = sorted(routes, key=lambda r: -r.priority)
        self.ab_test = ab_test or {}
        self.fallback_chain = fallback_chain or ["mock"]
        self.max_retries_per_model = max_retries_per_model
        self.quotas: dict[str, ModelQuota] = {r.model: ModelQuota(r.rpm) for r in routes}
        self.stats: dict[str, ModelStats] = {r.model: ModelStats() for r in routes}
        # mock 始终可用
        if "mock" not in self.quotas:
            self.quotas["mock"] = ModelQuota(99999)
            self.stats["mock"] = ModelStats()

    @classmethod
    def from_config(cls, cfg: dict) -> ModelRouter:
        routes: list[ModelRoute] = []
        for r in cfg.get("routes", []):
            matcher = dict(r.get("match", {}))
            # 把 alertname 提到顶层 matcher, 方便测试
            routes.append(
                ModelRoute(
                    model=r["model"],
                    matcher=matcher,
                    alertname_pattern=r.get("alertname_pattern", ""),
                    severity=r.get("severity", ""),
                    priority=int(r.get("priority", 0)),
                    rpm=int(r.get("rpm", 60)),
                    cost_per_1k_input=float(r.get("cost_per_1k_input", 0)),
                    cost_per_1k_output=float(r.get("cost_per_1k_output", 0)),
                    enabled=bool(r.get("enabled", True)),
                )
            )
        return cls(
            routes=routes,
            ab_test=cfg.get("ab_test"),
            fallback_chain=cfg.get("fallback_chain"),
        )

    # --------- 路由选择 ---------

    def _match_route(self, alert: dict) -> ModelRoute | None:
        """按优先级找第一个匹配的路由."""
        for r in self.routes:
            if r.matches(alert):
                return r
        return None

    def _ab_split(self, alert: dict) -> str | None:
        """A/B 分配, 返回模型名. 未启用或无配置时返回 None."""
        ab = self.ab_test
        if not ab.get("enabled"):
            return None
        exp = ab.get("experiment_model", "")
        ctrl = ab.get("control_model", "")
        pct = int(ab.get("experiment_pct", 0))
        if not (exp and ctrl and 0 <= pct <= 100):
            return None
        # 稳定 hash 分配
        h = hashlib.md5(json.dumps(alert, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()
        bucket = int(h[:8], 16) % 100
        return exp if bucket < pct else ctrl

    def select_model(self, alert: dict) -> str:
        """选主模型 (考虑 A/B). 找不到时返回 'mock'."""
        # A/B 优先
        ab_model = self._ab_split(alert)
        if ab_model and ab_model in self.quotas:
            return ab_model
        r = self._match_route(alert)
        if r is not None:
            return r.model
        return "mock"

    def get_route(self, model: str) -> ModelRoute | None:
        for r in self.routes:
            if r.model == model:
                return r
        return None

    # --------- 调 + 配额 + 降级 ---------

    def _call_model(self, alert: dict, model: str) -> str:
        """调真模型或 mock. 失败抛异常."""
        # 配额检查
        quota = self.quotas.get(model)
        if quota and not quota.allow():
            raise RuntimeError(f"模型 {model} 配额已满")

        if model == "mock":
            return alert_llm_summary.summarize_alert(alert, force_mock=True)

        # 真模型: 通过 alert_llm_summary 调, 临时设置 env
        old_model = os.environ.get("ZHS_LLM_MODEL", "")
        os.environ["ZHS_LLM_MODEL"] = model
        try:
            return alert_llm_summary.summarize_alert(alert, force_mock=False)
        finally:
            os.environ["ZHS_LLM_MODEL"] = old_model

    def _estimate_tokens(self, text: str) -> int:
        """估算 token 数: 英文 4 字符/token, 中文 1.5 字符/token."""
        if not text:
            return 0
        # 简化: 全部按 2 字符/token 估算
        return max(1, len(text) // 2)

    def _calc_cost(self, route: ModelRoute | None, input_text: str, output_text: str) -> float:
        if route is None:
            return 0.0
        in_t = self._estimate_tokens(input_text)
        out_t = self._estimate_tokens(output_text)
        return (in_t / 1000.0) * route.cost_per_1k_input + (out_t / 1000.0) * route.cost_per_1k_output

    def summarize(self, alert: dict, force_mock: bool = False) -> dict:
        """调摘要, 自动选模型 + 降级 + 配额. 返回结果 dict.

        Returns:
            {
                "summary": str,
                "model": str,         # 实际调用的模型
                "fallback_used": bool,
                "attempts": list[{model, ok, error?}],
            }
        """
        attempts: list[dict] = []
        if force_mock:
            primary = "mock"
        else:
            primary = self.select_model(alert)

        # 主模型 + 降级链
        models_try = [primary] + [m for m in self.fallback_chain if m != primary]
        last_err: str = ""
        used_model = "mock"
        summary = ""
        for m in models_try:
            route = self.get_route(m)
            input_text = json.dumps(alert, ensure_ascii=False)
            for attempt in range(self.max_retries_per_model + 1):
                try:
                    summary = self._call_model(alert, m)
                    cost = self._calc_cost(route, input_text, summary)
                    self.stats[m].record_call(
                        True, self._estimate_tokens(input_text), self._estimate_tokens(summary), cost
                    )
                    attempts.append({"model": m, "ok": True, "attempt": attempt + 1})
                    used_model = m
                    last_err = ""
                    # 跳出两层循环
                    break
                except _TRANSIENT_EXCEPTIONS as e:
                    last_err = f"{type(e).__name__}: {e}"
                    if attempt < self.max_retries_per_model:
                        time.sleep(0.05 * (2**attempt))  # 内部短暂退避
                        continue
                    self.stats[m].last_error = last_err
                    self.stats[m].record_call(False, 0, 0, 0)
                    attempts.append({"model": m, "ok": False, "error": last_err})
                    if m != primary:
                        self.stats[primary].fallback_count += 1
                    break
                except Exception as e:
                    # 非 transient 错误: 不重试
                    last_err = f"{type(e).__name__}: {e}"
                    self.stats[m].last_error = last_err
                    self.stats[m].record_call(False, 0, 0, 0)
                    attempts.append({"model": m, "ok": False, "error": last_err})
                    break
            if summary:
                break

        if not summary:
            # 所有模型都失败 → 用 mock 兜底
            try:
                summary = alert_llm_summary.summarize_alert(alert, force_mock=True)
                used_model = "mock"
                self.stats["mock"].record_call(True, 0, len(summary) // 2, 0)
                attempts.append({"model": "mock", "ok": True, "fallback_final": True})
            except Exception as e:
                summary = f"[LLM 摘要失败: {e}]"
                attempts.append({"model": "mock", "ok": False, "error": str(e), "fallback_final": True})

        return {
            "summary": summary,
            "model": used_model,
            "fallback_used": used_model != primary,
            "attempts": attempts,
        }

    def stats_dict(self) -> dict:
        return {
            "models": {m: s.to_dict() for m, s in self.stats.items()},
            "quotas_remaining": {m: q.remaining() for m, q in self.quotas.items()},
        }

    def reset(self) -> None:
        for s in self.stats.values():
            s.__dict__.update(ModelStats().__dict__)
        for q in self.quotas.values():
            q.reset()


# ---------------------------------------------------------------------------
# 3. CLI
# ---------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    import argparse

    p = argparse.ArgumentParser(description="LLM 多模型路由器演示")
    p.add_argument("--alert-json", help="告警 JSON 字符串")
    p.add_argument("--config", type=Path, help="路由配置 JSON 文件")
    p.add_argument("--reset-stats", action="store_true", help="重置统计")
    p.add_argument("--force-mock", action="store_true", help="强制 mock")
    args = p.parse_args(argv)

    cfg = {}
    if args.config:
        cfg = json.loads(args.config.read_text(encoding="utf-8"))
    if not cfg.get("routes"):
        # 默认配置
        cfg = {
            "routes": [
                {
                    "model": "gpt-4o-mini",
                    "match": {},
                    "priority": 1,
                    "rpm": 100,
                    "cost_per_1k_input": 0.00015,
                    "cost_per_1k_output": 0.0006,
                },
                {"model": "mock", "match": {}, "priority": 0, "rpm": 99999},
            ],
            "fallback_chain": ["mock"],
        }

    router = ModelRouter.from_config(cfg)
    if args.reset_stats:
        router.reset()

    if args.alert_json:
        alert = json.loads(args.alert_json)
    else:
        alert = {
            "alertname": "HighErrorRate",
            "severity": "critical",
            "service": "zhs-platform-api",
            "summary": "5xx 错误率 12%",
            "labels": {"region": "cn-east-1"},
        }

    result = router.summarize(alert, force_mock=args.force_mock)
    print(f"model: {result['model']}")
    print(f"fallback_used: {result['fallback_used']}")
    print(f"summary: {result['summary']}")
    print(f"attempts: {json.dumps(result['attempts'], ensure_ascii=False)}")
    print(f"stats: {json.dumps(router.stats_dict(), ensure_ascii=False, indent=2)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
