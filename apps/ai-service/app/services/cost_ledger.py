# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""全链路成本账本(Cost Ledger)(对标 Claude Code / Codex 的成本透明可观测)。

统一聚合"会话 / 工具 / 模型 / 时间窗"维度的 token 与成本,作为未来前端费用
看板(按天/按小时走势、Top 工具、用户/会话/运行粒度成本)的数据底座。

定位与既有模块的分工(只复用、不重写):
- agent_step_recorder   : 按 run 录制 step(含 tokens_in/out/cost/duration_ms/status),
                          是本账本 `sync_from_recorder` 的录制源头。
- cloud_run_store       : 记 run 级 output/created_at(本账本不做 run 汇总,run 维度来自 recorder)。
- tool_cost_accounting   : 聚合 step 的 cost 口径(round 6 位),本账本沿用同一 cost 口径,
                          不重复实现汇率 / 定价;cost 未知时用内置估算表(见 estimate_cost_usd)。
- llm_budget_governor    : 执行前配额门控 + 支柱/模型用量。本账本是执行后的事后审计账本,
                          与 governor 的预算门控互补,不抢其预算判断职责。

设计:
- 主存储:进程内 dict[record_id -> LedgerEntry](读写快、跨请求可见)
- 幂等:append 以 record_id 去重,同 record_id 不重复入账
- 持久化:每次变更把全量条目写回 data/cost_ledger.json(ai-service 数据目录),进程重启可恢复;
  文件缺失/损坏时静默降级为空账本。并发用 threading.Lock 保护原子性。
- 全部确定性:cost/金额一律 round 6 位,与 recorder/tool_cost_accounting 口径一致。
"""

from __future__ import annotations

import json
import logging
import threading
import time
from dataclasses import asdict, dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from .agent_step_recorder import AgentStepRecorder, agent_step_recorder

logger = logging.getLogger(__name__)

# 有效 status(沿用 recorder)
_VALID_STATUS = ("ok", "error")
# 时间序列支持的粒度
_VALID_GRANULARITY = ("hour", "day")

# JSON 持久化文件(ai-service 根下的 data/cost_ledger.json)
_DATA_DIR = Path(__file__).resolve().parents[2] / "data"
_LEDGER_FILE = _DATA_DIR / "cost_ledger.json"

# 内置主流模型估算单价(USD per 1K tokens)。仅用于 cost 缺失时的估算;
# 已有 cost 的条目(含 sync_from_recorder)沿用录入口径,不走估算。
# 口径与 llm_budget_governor.model_cost_table 语义一致(per 1K token / 美元);
# 具体数值为估算,可用 set_pricing(model, per_in, per_out) 注入覆盖。
_DEFAULT_PRICING: dict[str, dict[str, float]] = {
    "gpt-4o": {"per_in": 0.0025, "per_out": 0.0100},
    "gpt-4o-mini": {"per_in": 0.00015, "per_out": 0.00060},
    "gpt-4-turbo": {"per_in": 0.0100, "per_out": 0.0300},
    "claude-3-opus": {"per_in": 0.0150, "per_out": 0.0750},
    "claude-3-sonnet": {"per_in": 0.0030, "per_out": 0.0150},
    "claude-3-haiku": {"per_in": 0.00025, "per_out": 0.00125},
    "claude-sonnet-4": {"per_in": 0.0030, "per_out": 0.0150},
    "deepseek-chat": {"per_in": 0.00027, "per_out": 0.00110},
    "deepseek-reasoner": {"per_in": 0.00055, "per_out": 0.00219},
    # 未知模型默认价(估算)
    "default": {"per_in": 0.0020, "per_out": 0.0080},
}


def _now_iso() -> str:
    """当前 UTC 时间 ISO8601(秒级)。"""
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _to_num(value: Any, default: float = 0.0) -> float:
    """安全转 float,失败回退默认值(与 recorder 同源策略)。"""
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _parse_at(value: Any) -> datetime | None:
    """把 ISO 时间戳解析为 aware datetime;失败返回 None。"""
    if not value:
        return None
    text = str(value)
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        return datetime.fromisoformat(text)
    except (ValueError, TypeError):
        return None


@dataclass
class LedgerEntry:
    """单条成本账本条目。record_id 为幂等键。"""

    record_id: str = ""  # 幂等键(append 去重依据);run 内可用 "run_id:step:N"
    user_id: str = ""
    session_id: str = ""
    run_id: str = ""
    tool_name: str = ""
    model: str = ""
    tokens_in: int = 0
    tokens_out: int = 0
    total_tokens: int = 0
    cost_usd: float = 0.0       # USD,round 6 位(与 recorder/tool_cost_accounting 口径一致)
    duration_ms: float = 0.0
    status: str = "ok"          # ok / error
    at: str = ""                # UTC ISO8601
    estimated: bool = False     # cost 是否来自估算(未知模型用默认价)

    def to_dict(self) -> dict[str, Any]:
        """序列化为可 JSON 化的 dict。"""
        return asdict(self)


class CostLedger:
    """全链路成本账本(进程内 dict + JSON 文件持久化,threading.Lock 原子)。

    用法:
        ledger = CostLedger(file_path=...)        # 测试用 tmp_path
        ledger.append(entry)                       # 幂等(record_id 去重)
        ledger.sync_from_recorder("run-1", rec)    # 把 recorder 的 run 合并入账
        ledger.aggregate({"user_id": "u1"})        # 任意维度过滤聚合
        ledger.top_tools(5)                        # 成本 Top 工具
        ledger.timeseries("day")                   # 看板走势(按天/按小时)
        ledger.reset()                             # 清空账本
    """

    def __init__(
        self,
        *,
        file_path: Path | None = None,
        pricing: dict[str, dict[str, float]] | None = None,
    ) -> None:
        self._file = file_path or _LEDGER_FILE
        self._data: dict[str, dict[str, Any]] = {}  # record_id -> entry
        self._lock = threading.Lock()
        self._loaded = False
        self._pricing = dict(
            _DEFAULT_PRICING if pricing is None else pricing
        )
        if "default" not in self._pricing:
            self._pricing["default"] = {"per_in": 0.0020, "per_out": 0.0080}

    # ---------------- 内部 ----------------

    def _load(self) -> None:
        """从 JSON 懒加载到内存(仅首次;损坏/缺失降级为空)。"""
        if self._loaded:
            return
        try:
            if self._file.exists():
                raw = json.loads(self._file.read_text(encoding="utf-8"))
                if isinstance(raw, dict):
                    self._data = {
                        rid: dict(entry)
                        for rid, entry in raw.items()
                        if isinstance(entry, dict) and rid
                    }
        except Exception as e:
            logger.warning("cost_ledger 读取失败(降级为空): %s", e)
        finally:
            self._loaded = True

    def _persist(self) -> None:
        """把内存全量条目写回 JSON 文件(尽力,失败降级内存保留)。"""
        try:
            self._file.parent.mkdir(parents=True, exist_ok=True)
            self._file.write_text(
                json.dumps(self._data, ensure_ascii=False, indent=2), encoding="utf-8"
            )
        except Exception as e:
            logger.warning("cost_ledger 写盘失败(内存保留): %s", e)

    def _normalize(self, entry: Any) -> dict[str, Any]:
        """把传入条目(或 LedgerEntry)归一化为标准结构,缺省字段回填。

        cost_usd 缺省/为 None 时走估算(estimate_cost_usd),并标记 estimated。
        """
        e = entry.to_dict() if isinstance(entry, LedgerEntry) else dict(entry or {})
        tokens_in = int(_to_num(e.get("tokens_in"), 0))
        tokens_out = int(_to_num(e.get("tokens_out"), 0))
        raw_total = e.get("total_tokens")
        if raw_total is None or _to_num(raw_total) <= 0:
            # 未显式提供(或为 0 的占位)→ 回填 in+out(LedgerEntry 默认 total_tokens=0)
            total_tokens = tokens_in + tokens_out
        else:
            total_tokens = int(_to_num(raw_total))
        model = str(e.get("model") or "")

        raw_cost = e.get("cost_usd")
        if raw_cost is None:
            est = self.estimate_cost_usd(model, tokens_in, tokens_out)
            cost_usd = est["cost_usd"]
            estimated = est["estimated"]
        else:
            cost_usd = round(_to_num(raw_cost), 6)
            estimated = bool(e.get("estimated", False))

        raw_status = str(e.get("status") or "ok").strip().lower()
        status = raw_status if raw_status in _VALID_STATUS else "ok"
        return {
            "record_id": str(e.get("record_id") or ""),
            "user_id": str(e.get("user_id") or ""),
            "session_id": str(e.get("session_id") or ""),
            "run_id": str(e.get("run_id") or ""),
            "tool_name": str(e.get("tool_name") or ""),
            "model": model,
            "tokens_in": tokens_in,
            "tokens_out": tokens_out,
            "total_tokens": total_tokens,
            "cost_usd": cost_usd,
            "duration_ms": round(_to_num(e.get("duration_ms")), 2),
            "status": status,
            "at": str(e.get("at") or _now_iso()),
            "estimated": estimated,
        }

    def _filtered(self, filter: dict[str, Any] | None) -> list[dict[str, Any]]:
        """按过滤条件筛出条目(list filter 键均可选)。

        支持:user_id / session_id / run_id / tool_name / model / status / date(YYYY-MM-DD)。
        """
        filter = dict(filter or {})
        date = filter.get("date")

        def _matches(entry: dict[str, Any], key: str) -> bool:
            want = filter.get(key)
            return not want or str(entry.get(key) or "") == want

        with self._lock:
            self._load()
            matched = [
                e
                for e in self._data.values()
                if (
                    _matches(e, "user_id")
                    and _matches(e, "session_id")
                    and _matches(e, "run_id")
                    and _matches(e, "tool_name")
                    and _matches(e, "model")
                    and _matches(e, "status")
                    and (not date or str(e.get("at") or "")[:10] == date)
                )
            ]
        return [dict(e) for e in matched]

    # ---------------- 写入 ----------------

    def append(self, entry: Any) -> dict[str, Any]:
        """追加一条账目(幂等:同 record_id 不重复)。返回 {"appended", "entry"}。"""
        with self._lock:
            self._load()
            norm = self._normalize(entry)
            if not norm["record_id"]:
                raise ValueError("record_id 不能为空")
            if norm["record_id"] in self._data:
                return {"appended": False, "entry": dict(self._data[norm["record_id"]])}
            self._data[norm["record_id"]] = norm
            self._persist()
            return {"appended": True, "entry": dict(norm)}

    def sync_from_recorder(
        self,
        run_id: str,
        recorder: AgentStepRecorder | None = None,
        *,
        user_id: str = "",
        session_id: str = "",
    ) -> dict[str, Any]:
        """把 recorder 某 run 的全部步骤合并成本账本条目。

        复用 recorder 的 cost(已 round 6 位),保证与 recorder 口径一致、可审计;
        返回 {"run_id", "synced", "skipped"(幂等去重跳过)}。
        """
        if recorder is None:
            recorder = agent_step_recorder
        steps = recorder.replay(run_id).get("steps") or []
        synced = 0
        skipped = 0
        for idx, s in enumerate(steps):
            step_index = _to_num(s.get("step_index"), idx)
            entry = {
                "record_id": f"{run_id}:step:{int(step_index)}",
                "user_id": user_id or "",
                "session_id": session_id or "",
                "run_id": run_id,
                "tool_name": str(s.get("tool_name") or ""),
                "model": str(s.get("model") or ""),
                "tokens_in": s.get("tokens_in"),
                "tokens_out": s.get("tokens_out"),
                "total_tokens": s.get("tokens"),
                "cost_usd": s.get("cost"),
                "duration_ms": s.get("duration_ms"),
                "status": s.get("status") or "ok",
                "at": s.get("at") or "",
                "estimated": False,
            }
            result = self.append(entry)
            if result["appended"]:
                synced += 1
            else:
                skipped += 1
        return {"run_id": run_id, "synced": synced, "skipped": skipped}

    def reset(self) -> None:
        """清空账本全部条目(并落盘空账)。"""
        with self._lock:
            self._data = {}
            self._loaded = True
            self._persist()

    # ---------------- 读取 ----------------

    def count(self, filter: dict[str, Any] | None = None) -> int:
        """满足过滤的条目数(空过滤=全量)。"""
        return len(self._filtered(filter))

    def aggregate(self, filter: dict[str, Any] | None = None) -> dict[str, Any]:
        """按 user/session/run/tool/model/date/status 过滤聚合。

        返回 totals:tokens_in/out、总数/成败/估算计数、cost、duration、steps、
        by_tool / by_model、窗口边界(start/end)。
        """
        entries = self._filtered(filter)
        n = len(entries)
        total_in = sum(int(e.get("tokens_in") or 0) for e in entries)
        total_out = sum(int(e.get("tokens_out") or 0) for e in entries)
        total = sum(int(e.get("total_tokens") or 0) for e in entries)
        ok_count = sum(1 for e in entries if e.get("status") == "ok")
        estimated_count = sum(1 for e in entries if e.get("estimated"))

        by_tool: dict[str, dict[str, Any]] = {}
        by_model: dict[str, dict[str, Any]] = {}
        parsed: list[datetime] = []
        for e in entries:
            tool = str(e.get("tool_name") or "(unknown)")
            model = str(e.get("model") or "") or "(unknown)"
            for store, key in ((by_tool, tool), (by_model, model)):
                b = store.setdefault(
                    key,
                    {"steps": 0, "tokens_in": 0, "tokens_out": 0, "tokens": 0, "cost": 0.0},
                )
                b["steps"] += 1
                b["tokens_in"] += int(e.get("tokens_in") or 0)
                b["tokens_out"] += int(e.get("tokens_out") or 0)
                b["tokens"] += int(e.get("total_tokens") or 0)
                b["cost"] = round(b["cost"] + float(e.get("cost_usd") or 0.0), 6)
            dt = _parse_at(e.get("at"))
            if dt is not None:
                parsed.append(dt)

        return {
            "steps": n,
            "count": n,
            "ok_count": ok_count,
            "error_count": n - ok_count,
            "estimated_count": estimated_count,
            "total_tokens_in": total_in,
            "total_tokens_out": total_out,
            "total_tokens": total,
            "total_cost": round(
                sum(float(e.get("cost_usd") or 0.0) for e in entries), 6
            ),
            "total_duration_ms": round(
                sum(float(e.get("duration_ms") or 0.0) for e in entries), 2
            ),
            "by_tool": by_tool,
            "by_model": by_model,
            "window": (
                {"start": min(parsed).isoformat(), "end": max(parsed).isoformat()}
                if parsed
                else {"start": None, "end": None}
            ),
        }

    def top_tools(self, n: int = 10, filter: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        """按成本降序返回 Top 工具(含 steps/tokens/cost)。同成本按工具名稳定排序。"""
        by: dict[str, dict[str, Any]] = {}
        for e in self._filtered(filter):
            tool = str(e.get("tool_name") or "(unknown)")
            b = by.setdefault(
                tool, {"steps": 0, "tokens_in": 0, "tokens_out": 0, "tokens": 0, "cost": 0.0}
            )
            b["steps"] += 1
            b["tokens_in"] += int(e.get("tokens_in") or 0)
            b["tokens_out"] += int(e.get("tokens_out") or 0)
            b["tokens"] += int(e.get("total_tokens") or 0)
            b["cost"] = round(b["cost"] + float(e.get("cost_usd") or 0.0), 6)
        ranked = sorted(by.items(), key=lambda kv: (-kv[1]["cost"], kv[0]))
        return [{"tool_name": name, **stats} for name, stats in ranked[: max(1, int(n))]]

    def timeseries(
        self, granularity: str = "hour", filter: dict[str, Any] | None = None
    ) -> list[dict[str, Any]]:
        """时间序列(看板走势)。granularity:"hour"|"day"。

        空过滤=全量;只含实际有数据的桶(按时间升序)。cost round 6 位。
        """
        if granularity not in _VALID_GRANULARITY:
            raise ValueError(
                f"granularity 必须是 {'/'.join(_VALID_GRANULARITY)},got {granularity!r}"
            )
        buckets: dict[str, dict[str, Any]] = {}
        for e in self._filtered(filter):
            dt = _parse_at(e.get("at"))
            if dt is None:
                continue
            key = (
                dt.strftime("%Y-%m-%d")
                if granularity == "day"
                else dt.strftime("%Y-%m-%dT%H")
            )
            b = buckets.setdefault(
                key,
                {
                    "bucket": key,
                    "steps": 0,
                    "tokens_in": 0,
                    "tokens_out": 0,
                    "tokens": 0,
                    "cost": 0.0,
                },
            )
            b["steps"] += 1
            b["tokens_in"] += int(e.get("tokens_in") or 0)
            b["tokens_out"] += int(e.get("tokens_out") or 0)
            b["tokens"] += int(e.get("total_tokens") or 0)
            b["cost"] = round(b["cost"] + float(e.get("cost_usd") or 0.0), 6)
        items = [buckets[k] for k in sorted(buckets)]
        for b in items:
            b["cost"] = round(b["cost"], 6)
        return items

    # ---------------- 成本估算与定价 ----------------

    def set_pricing(self, model: str, per_in: float, per_out: float) -> None:
        """注入/覆盖某模型的估算单价(USD per 1K tokens)。"""
        self._pricing[str(model or "default")] = {
            "per_in": float(per_in),
            "per_out": float(per_out),
        }

    def estimate_cost_usd(
        self, model: str, tokens_in: int, tokens_out: int
    ) -> dict[str, Any]:
        """按模型估算成本(USD,round 6 位)。

        已知模型(内置表或 set_pricing 注入)→ estimated=False;
        未知模型用默认价 → estimated=True。
        返回 {"cost_usd", "estimated"}。仅当录入时没带 cost 才走估算。
        """
        model = str(model or "").strip()
        known = bool(model) and model in self._pricing and model != "default"
        rates = self._pricing.get(model) or self._pricing["default"]
        cost = (
            (float(tokens_in) / 1000.0) * float(rates["per_in"])
            + (float(tokens_out) / 1000.0) * float(rates["per_out"])
        )
        return {"cost_usd": round(cost, 6), "estimated": not known}


# 全局单例(router 与 agent 埋点共用)
cost_ledger = CostLedger()
