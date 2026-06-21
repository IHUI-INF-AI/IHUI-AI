"""Phase 19 建议 4: AI 路由 Phase 4 - 多模型自动选型.

目的:
  - 多模型按 (成本 / 质量 / 延迟) 综合评分自动选型
  - 任务类型敏感 (CHAT/CODE/SUMMARIZE/TRANSLATE/EMBEDDING)
  - 用户偏好: cost_sensitive / quality_first / low_latency / balanced
  - 选型审计 (得分明细 + 决策)
  - 模拟候选调用 + 选型

设计:
  ModelProfile:
    name, cost_in, cost_out, quality_score, latency_p50_ms, max_tokens

  TaskType: CHAT / CODE / SUMMARIZE / TRANSLATE / EMBEDDING
  Preference: COST / QUALITY / LATENCY / BALANCED

  ScoringPolicy:
    每个 (task, preference) 配一组权重
    score = w_q*quality + w_c*(1-cost_norm) + w_l*(1-latency_norm)

  ModelSelector:
    select(task, text_len, preference) -> (chosen, all_scores)
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass
from enum import Enum

# ---------------------------------------------------------------------------
# 1. 枚举
# ---------------------------------------------------------------------------


class TaskType(str, Enum):
    CHAT = "chat"
    CODE = "code"
    SUMMARIZE = "summarize"
    TRANSLATE = "translate"
    EMBEDDING = "embedding"


class Preference(str, Enum):
    COST = "cost"
    QUALITY = "quality"
    LATENCY = "latency"
    BALANCED = "balanced"


# ---------------------------------------------------------------------------
# 2. 数据类
# ---------------------------------------------------------------------------


@dataclass
class ModelProfile:
    name: str
    cost_per_1k_in: float  # USD
    cost_per_1k_out: float
    quality_score: float  # 0-1
    latency_p50_ms: float
    max_tokens: int = 4096
    provider: str = "unknown"

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "provider": self.provider,
            "cost_per_1k_in": self.cost_per_1k_in,
            "cost_per_1k_out": self.cost_per_1k_out,
            "quality_score": self.quality_score,
            "latency_p50_ms": self.latency_p50_ms,
            "max_tokens": self.max_tokens,
        }


@dataclass
class ScoredModel:
    model: ModelProfile
    quality_norm: float
    cost_norm: float
    latency_norm: float
    weighted_score: float
    estimated_cost_usd: float

    def to_dict(self) -> dict:
        return {
            "model": self.model.name,
            "quality_norm": round(self.quality_norm, 4),
            "cost_norm": round(self.cost_norm, 4),
            "latency_norm": round(self.latency_norm, 4),
            "weighted_score": round(self.weighted_score, 4),
            "estimated_cost_usd": round(self.estimated_cost_usd, 6),
        }


@dataclass
class SelectionRecord:
    ts: float
    task: TaskType
    preference: Preference
    chosen: str
    candidates: list[dict]
    text_len: int
    ts_iso: str = ""

    def __post_init__(self):
        if not self.ts_iso:
            self.ts_iso = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(self.ts))

    def to_dict(self) -> dict:
        return {
            "ts": self.ts,
            "ts_iso": self.ts_iso,
            "task": self.task.value,
            "preference": self.preference.value,
            "chosen": self.chosen,
            "candidates": self.candidates,
            "text_len": self.text_len,
        }


# ---------------------------------------------------------------------------
# 3. 评分策略
# ---------------------------------------------------------------------------

# 权重表: (task, preference) -> (w_quality, w_cost, w_latency)
# 总和应为 1.0
WEIGHT_TABLE: dict[tuple[TaskType, Preference], tuple[float, float, float]] = {
    # CHAT
    (TaskType.CHAT, Preference.QUALITY): (0.7, 0.2, 0.1),
    (TaskType.CHAT, Preference.COST): (0.2, 0.7, 0.1),
    (TaskType.CHAT, Preference.LATENCY): (0.2, 0.1, 0.7),
    (TaskType.CHAT, Preference.BALANCED): (0.4, 0.3, 0.3),
    # CODE (质量权重更高)
    (TaskType.CODE, Preference.QUALITY): (0.85, 0.10, 0.05),
    (TaskType.CODE, Preference.COST): (0.3, 0.6, 0.1),
    (TaskType.CODE, Preference.LATENCY): (0.4, 0.1, 0.5),
    (TaskType.CODE, Preference.BALANCED): (0.55, 0.25, 0.20),
    # SUMMARIZE (成本敏感)
    (TaskType.SUMMARIZE, Preference.QUALITY): (0.5, 0.3, 0.2),
    (TaskType.SUMMARIZE, Preference.COST): (0.2, 0.7, 0.1),
    (TaskType.SUMMARIZE, Preference.LATENCY): (0.3, 0.1, 0.6),
    (TaskType.SUMMARIZE, Preference.BALANCED): (0.4, 0.4, 0.2),
    # TRANSLATE
    (TaskType.TRANSLATE, Preference.QUALITY): (0.7, 0.2, 0.1),
    (TaskType.TRANSLATE, Preference.COST): (0.3, 0.6, 0.1),
    (TaskType.TRANSLATE, Preference.LATENCY): (0.3, 0.1, 0.6),
    (TaskType.TRANSLATE, Preference.BALANCED): (0.5, 0.3, 0.2),
    # EMBEDDING (通常 cost + latency 重要)
    (TaskType.EMBEDDING, Preference.QUALITY): (0.6, 0.3, 0.1),
    (TaskType.EMBEDDING, Preference.COST): (0.1, 0.7, 0.2),
    (TaskType.EMBEDDING, Preference.LATENCY): (0.1, 0.2, 0.7),
    (TaskType.EMBEDDING, Preference.BALANCED): (0.3, 0.4, 0.3),
}


# ---------------------------------------------------------------------------
# 4. ModelSelector
# ---------------------------------------------------------------------------

DEFAULT_PROFILES: list[ModelProfile] = [
    ModelProfile("gpt-4o", 0.005, 0.015, 0.95, 800, 4096, "openai"),
    ModelProfile("gpt-4o-mini", 0.00015, 0.0006, 0.85, 500, 16384, "openai"),
    ModelProfile("claude-3.5-sonnet", 0.003, 0.015, 0.96, 900, 8192, "anthropic"),
    ModelProfile("claude-3-haiku", 0.00025, 0.00125, 0.82, 400, 4096, "anthropic"),
    ModelProfile("gemini-1.5-pro", 0.00125, 0.005, 0.90, 700, 8192, "google"),
    ModelProfile("deepseek-chat", 0.00014, 0.00028, 0.83, 600, 8192, "deepseek"),
    ModelProfile("qwen-max", 0.0008, 0.002, 0.87, 550, 8192, "alibaba"),
]


class ModelSelector:
    """多模型自动选型器."""

    def __init__(self, profiles: list[ModelProfile] | None = None, weights: dict | None = None):
        self.profiles = list(profiles) if profiles is not None else list(DEFAULT_PROFILES)
        self.weights = dict(weights) if weights is not None else dict(WEIGHT_TABLE)
        self._history: list[SelectionRecord] = []

    def add_profile(self, p: ModelProfile) -> None:
        self.profiles.append(p)

    def _estimate_cost(self, profile: ModelProfile, text_len: int, output_ratio: float = 0.5) -> float:
        # 假设 input = text_len tokens, output = text_len * output_ratio
        in_tok = text_len
        out_tok = text_len * output_ratio
        return (in_tok / 1000.0) * profile.cost_per_1k_in + (out_tok / 1000.0) * profile.cost_per_1k_out

    def score_all(self, task: TaskType, text_len: int, preference: Preference) -> list[ScoredModel]:
        w_q, w_c, w_l = self.weights.get((task, preference), (0.4, 0.3, 0.3))
        # 计算归一化
        costs = [self._estimate_cost(p, text_len) for p in self.profiles]
        max_cost = max(costs) or 1.0
        min_cost = min(costs) or 0.0
        max_lat = max(p.latency_p50_ms for p in self.profiles) or 1.0
        min_lat = min(p.latency_p50_ms for p in self.profiles) or 0.0
        scored: list[ScoredModel] = []
        for p, cost in zip(self.profiles, costs):
            q_norm = p.quality_score  # 0-1
            c_norm = (cost - min_cost) / (max_cost - min_cost) if max_cost > min_cost else 0.0
            l_norm = (p.latency_p50_ms - min_lat) / (max_lat - min_lat) if max_lat > min_lat else 0.0
            score = w_q * q_norm + w_c * (1 - c_norm) + w_l * (1 - l_norm)
            scored.append(
                ScoredModel(
                    model=p,
                    quality_norm=q_norm,
                    cost_norm=c_norm,
                    latency_norm=l_norm,
                    weighted_score=score,
                    estimated_cost_usd=cost,
                )
            )
        scored.sort(key=lambda s: -s.weighted_score)
        return scored

    def select(
        self, task: TaskType, text_len: int, preference: Preference = Preference.BALANCED
    ) -> tuple[ModelProfile, list[ScoredModel]]:
        scored = self.score_all(task, text_len, preference)
        chosen = scored[0].model
        rec = SelectionRecord(
            ts=time.time(),
            task=task,
            preference=preference,
            chosen=chosen.name,
            candidates=[s.to_dict() for s in scored],
            text_len=text_len,
        )
        self._history.append(rec)
        return chosen, scored

    def history(self, limit: int = 50) -> list[dict]:
        return [r.to_dict() for r in self._history[-limit:]]

    def stats(self) -> dict:
        from collections import Counter

        counter = Counter(r.chosen for r in self._history)
        return {
            "total": len(self._history),
            "by_model": dict(counter),
        }

    def report(self) -> str:
        s = self.stats()
        lines = ["# 多模型选型报表", ""]
        lines.append(f"- 总选型次数: **{s['total']}**")
        if s["by_model"]:
            lines.append("")
            lines.append("## 模型被选次数")
            lines.append("")
            lines.append("| 模型 | 次数 |")
            lines.append("| --- | --- |")
            for k, v in sorted(s["by_model"].items(), key=lambda x: -x[1]):
                lines.append(f"| {k} | {v} |")
        return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# 5. CLI
# ---------------------------------------------------------------------------


def _demo() -> dict:
    sel = ModelSelector()
    out = []
    for task in [TaskType.CHAT, TaskType.CODE, TaskType.SUMMARIZE, TaskType.TRANSLATE]:
        for pref in [Preference.COST, Preference.QUALITY, Preference.LATENCY, Preference.BALANCED]:
            chosen, scored = sel.select(task, text_len=1000, preference=pref)
            out.append(
                {
                    "task": task.value,
                    "preference": pref.value,
                    "chosen": chosen.name,
                    "top_score": round(scored[0].weighted_score, 4),
                    "estimated_cost_usd": round(scored[0].estimated_cost_usd, 6),
                }
            )
    return {"results": out, "stats": sel.stats()}


def main(argv: list[str] | None = None, selector: ModelSelector | None = None) -> int:
    import argparse

    p = argparse.ArgumentParser(description="多模型自动选型")
    sub = p.add_subparsers(dest="cmd", required=True)

    p_demo = sub.add_parser("demo")
    p_select = sub.add_parser("select")
    p_select.add_argument("--task", choices=[t.value for t in TaskType], required=True)
    p_select.add_argument("--text-len", type=int, default=1000)
    p_select.add_argument("--preference", choices=[p.value for p in Preference], default="balanced")
    p_report = sub.add_parser("report")

    args = p.parse_args(argv)
    s = selector or ModelSelector()
    if args.cmd == "demo":
        out = _demo()
        print(json.dumps(out, ensure_ascii=False, indent=2, default=str))
        return 0
    if args.cmd == "select":
        chosen, scored = s.select(TaskType(args.task), args.text_len, Preference(args.preference))
        print(
            json.dumps(
                {
                    "chosen": chosen.to_dict(),
                    "all_scores": [sc.to_dict() for sc in scored],
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0
    if args.cmd == "report":
        # 跑一遍 demo 再报告
        for task in [TaskType.CHAT, TaskType.CODE]:
            for pref in [Preference.COST, Preference.QUALITY]:
                s.select(task, text_len=1000, preference=pref)
        print(s.report())
        return 0
    return 1


if __name__ == "__main__":
    import sys

    sys.exit(main())
