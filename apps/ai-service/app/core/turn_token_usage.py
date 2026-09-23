# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""批58:turn token 指标 — 对标 codex state/turn_token_usage.rs。

按「实际产出响应的模型」分组记账;同一模型多次响应在该轮内累计为一个直方图样本。
emit 时保留零值样本(无 usage 上报的轮次);仅 compaction 运行时不为选定模型造样本。
六桶 token_type: total/input/cached_input/cache_write_input/output/reasoning_output。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

TURN_TOKEN_USAGE_METRIC = "turn_token_usage"

TOKEN_TYPES: tuple[tuple[str, str], ...] = (
    ("total", "total_tokens"),
    ("input", "input_tokens"),
    ("cached_input", "cached_input_tokens"),
    ("cache_write_input", "cache_write_input_tokens"),
    ("output", "output_tokens"),
    ("reasoning_output", "reasoning_output_tokens"),
)


@dataclass
class _ModelUsage:
    telemetry: dict[str, Any]
    totals: dict[str, int] = field(default_factory=dict)


class TurnTokenUsage:
    """按模型分组的轮内 token 直方图记账(纯数据,无 IO;emit 交由调用方投递)。"""

    def __init__(self) -> None:
        self._by_model: dict[str, _ModelUsage] = {}

    def record(
        self,
        model: str,
        telemetry: dict[str, Any] | None = None,
        *,
        total_tokens: int = 0,
        input_tokens: int = 0,
        cached_input_tokens: int = 0,
        cache_write_input_tokens: int = 0,
        output_tokens: int = 0,
        reasoning_output_tokens: int = 0,
    ) -> None:
        entry = self._by_model.get(model)
        if entry is None:
            entry = _ModelUsage(telemetry=telemetry or {})
            self._by_model[model] = entry
        add = {
            "total_tokens": total_tokens,
            "input_tokens": input_tokens,
            "cached_input_tokens": cached_input_tokens,
            "cache_write_input_tokens": cache_write_input_tokens,
            "output_tokens": output_tokens,
            "reasoning_output_tokens": reasoning_output_tokens,
        }
        for k, v in add.items():
            entry.totals[k] = entry.totals.get(k, 0) + int(v)

    def samples(self, fallback_telemetry: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        """产出直方图样本列表。空账本时用 fallback 造一个零值样本(对齐 codex 保留零值语义)。"""
        out: list[dict[str, Any]] = []
        entries = list(self._by_model.values())
        if not entries:
            if fallback_telemetry is None:
                return out
            entries = [_ModelUsage(telemetry=fallback_telemetry)]
        for entry in entries:
            for label, field_name in TOKEN_TYPES:
                out.append(
                    {
                        "metric": TURN_TOKEN_USAGE_METRIC,
                        "token_type": label,
                        "value": max(0, entry.totals.get(field_name, 0)),
                        "telemetry": dict(entry.telemetry),
                    }
                )
        return out

    def models(self) -> list[str]:
        return sorted(self._by_model)

    def reset(self) -> None:
        self._by_model = {}
