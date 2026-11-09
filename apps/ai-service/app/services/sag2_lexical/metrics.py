# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""SAG2 词法通道·证据判定执行率遥测（本仓自有实现）。

零第三方依赖、线程安全的进程内累加器。口径钉死在下面这一段，调用方（judge.py）
只负责在每次 score() 前后计时并 record()，不得在这里补算或美化：

    judge_calls    = score() 被调用次数（含降级）
    judge_executed = verdict.executed is True 的次数
    其余            = 降级 / 未判定（judge_degraded = calls - executed）

「未判定绝不写成判过」在遥测层的对应面：只有 executed is True 才进分子，
降级与异常一律进分母，绝不把「调用过」记成「判定过」。
"""

from __future__ import annotations

import threading
from typing import Any

# 执行率 / 延迟统一精度；快照全部使用可复现的整数或定点小数，不引入 wall-clock 时间戳。
_PRECISION = 6


class Sag2JudgeMetrics:
    """线程安全的判定执行率累加器；snapshot() 恒返回 dict，零调用时全零。"""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._calls: int = 0
        self._executed: int = 0
        self._by_mode: dict[str, int] = {}
        self._latency_sum: float = 0.0
        self._max_latency: float = 0.0
        self._last_mode: str = ""
        self._last_reason: str = ""

    def reset(self) -> None:
        """清空全部计数（原地重置，保证已 import 的模块级单例引用不失效）。"""
        with self._lock:
            self._calls = 0
            self._executed = 0
            self._by_mode = {}
            self._latency_sum = 0.0
            self._max_latency = 0.0
            self._last_mode = ""
            self._last_reason = ""

    def record(self, verdict: Any, *, duration_ms: float = 0.0) -> None:
        """记录一次 score() 结果；verdict 只需具备 mode / executed / reason 三个属性。"""
        mode = str(getattr(verdict, "mode", "") or "")
        reason = str(getattr(verdict, "reason", "") or "")
        executed = getattr(verdict, "executed", False) is True
        latency = max(0.0, float(duration_ms))
        with self._lock:
            self._calls += 1
            if executed:
                self._executed += 1
            self._by_mode[mode] = self._by_mode.get(mode, 0) + 1
            self._latency_sum += latency
            if latency > self._max_latency:
                self._max_latency = latency
            self._last_mode = mode
            self._last_reason = reason

    def snapshot(self) -> dict[str, Any]:
        """返回可复现的只读快照；恒为 dict，零调用时所有数值字段为 0 / 0.0。"""
        with self._lock:
            calls = self._calls
            executed = self._executed
            rate = round(executed / calls, _PRECISION) if calls else 0.0
            degraded = calls - executed
            by_mode = dict(sorted(self._by_mode.items()))
            avg_latency = round(self._latency_sum / calls, _PRECISION) if calls else 0.0
            max_latency = round(self._max_latency, _PRECISION)
            last_mode = self._last_mode
            last_reason = self._last_reason
            # 可复现：整数序号（最近一次 record 的累计次数），刻意不用 wall-clock 时间戳。
            last_updated = calls
        return {
            "judge_calls": calls,
            "judge_executed": executed,
            "judge_execution_rate": rate,
            "judge_degraded": degraded,
            "by_mode": by_mode,
            "avg_latency_ms": avg_latency,
            "max_latency_ms": max_latency,
            "last_mode": last_mode,
            "last_reason": last_reason,
            "last_updated": last_updated,
        }


judge_metrics = Sag2JudgeMetrics()


def reset_judge_metrics() -> None:
    """重置模块级单例（测试隔离用）；原地重置，不替换全局引用。"""
    judge_metrics.reset()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
