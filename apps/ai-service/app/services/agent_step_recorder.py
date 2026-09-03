# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""Agent 运行步骤录制与回放(Record & Replay)(对标 WorkBuddy/Codex 可复现审计)。

把一次 agent 运行每一步(哪个工具 / 入参摘要 / 结果摘要 / token / 耗时 / 成本 /
状态)录成结构化 step 日志,随后可按运行 / 按步回放与审计;并聚合单运行的
token / 耗时 / 成本 / 成败统计。默认不接入任何 agent 执行器(由调用方显式注入),
未注入时 agent 主循环行为与现状逐零差异。

Step 结构(append_step 入参缺省字段由 recorder 归一化):
    step_index / type(tool|message|plan) / tool_name / input_summary /
    result_summary / status(ok|error) / tokens / tokens_in / tokens_out /
    duration_ms / cost / http_summary / at

存储:与 cloud_run_store / mcp_store 同款 —— 进程内 dict[run_id -> steps]
+ 每次变更全量写回 data/step_records.json(ai-service 数据目录),进程重启可恢复;
文件缺失/损坏时静默降级为空。并发用 threading.Lock 保护原子性。
上限:单 run 仅保留最近 MAX_STEPS_PER_RUN 步(超出丢最旧,防超长运行撑爆文件)。
"""

from __future__ import annotations

import json
import logging
import threading
import time
from pathlib import Path
from typing import Any

from app.core.tunables import MAX_STEPS_PER_RUN

logger = logging.getLogger(__name__)

# 单 run 保留步数上限(唯一真源见 app/core/tunables.py)
# 输入/结果摘要单条长度上限(防单条超大撑爆文件)
SUMMARY_LIMIT = 1000
# 分页 page_size 上限
PAGE_SIZE_MAX = 200

_VALID_TYPES = ("tool", "message", "plan")
_VALID_STATUS = ("ok", "error")

# JSON 持久化文件(ai-service 根下的 data/step_records.json)
_DATA_DIR = Path(__file__).resolve().parents[2] / "data"
_STEPS_FILE = _DATA_DIR / "step_records.json"


def _now_iso() -> str:
    """当前 UTC 时间 ISO8601(秒级)。"""
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _clip_text(value: Any, limit: int) -> str:
    """把任意值转文本并截断到 limit(防超大摘要撑爆文件)。"""
    try:
        text = json.dumps(value, ensure_ascii=False, default=str)
    except Exception:
        text = str(value)
    if len(text) > limit:
        return text[:limit] + "…"
    return text


def _to_num(value: Any, default: float = 0.0) -> float:
    """安全转 float,失败回退默认值。"""
    if value is None:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _normalize_step(step: dict[str, Any], idx: int) -> dict[str, Any]:
    """把调用方传入的 step 归一化为标准结构,缺省字段回填,防 JSON 不可序列化。"""
    stype = step.get("type", "tool")
    if stype not in _VALID_TYPES:
        stype = "tool"
    raw_status = str(step.get("status", "ok")).strip().lower()
    status = raw_status if raw_status in _VALID_STATUS else "ok"
    return {
        "step_index": int(_to_num(step.get("step_index"), idx)),
        "type": stype,
        "tool_name": str(step.get("tool_name") or ""),
        "input_summary": _clip_text(step.get("input_summary", ""), SUMMARY_LIMIT),
        "result_summary": _clip_text(step.get("result_summary", ""), SUMMARY_LIMIT),
        "status": status,
        "tokens": int(_to_num(step.get("tokens"), 0)),
        "tokens_in": int(_to_num(step.get("tokens_in"), 0)),
        "tokens_out": int(_to_num(step.get("tokens_out"), 0)),
        "duration_ms": round(_to_num(step.get("duration_ms")), 2),
        "cost": round(_to_num(step.get("cost")), 6),
        "http_summary": str(step.get("http_summary") or ""),
        "at": str(step.get("at") or _now_iso()),
    }


class AgentStepRecorder:
    """Agent 运行步骤录制器(进程内 dict + JSON 文件持久化)。

    用法:
        rec = AgentStepRecorder(file_path=...)   # 测试用 tmp_path
        rec.append_step("run-1", {"type": "tool", "tool_name": "read_file", ...})
        steps = rec.replay("run-1")              # 全量(时间序)
        step  = rec.replay("run-1", step_index=2)  # 单步回看
        metrics = rec.get_run_metrics("run-1")
    """

    def __init__(
        self,
        *,
        file_path: Path | None = None,
        max_steps: int = MAX_STEPS_PER_RUN,
        summary_limit: int = SUMMARY_LIMIT,
    ) -> None:
        self._file = file_path or _STEPS_FILE
        self._data: dict[str, dict[str, Any]] = {}  # run_id -> {"steps": [...], ...}
        self._lock = threading.Lock()
        self._loaded = False
        self._max_steps = max(1, int(max_steps))
        self._summary_limit = max(1, int(summary_limit))

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
                        rid: record
                        for rid, record in raw.items()
                        if isinstance(record, dict) and isinstance(record.get("steps"), list)
                    }
        except Exception as e:
            logger.warning("agent_step_recorder 读取失败(降级为空): %s", e)
        finally:
            self._loaded = True

    def _persist(self) -> None:
        """把内存全量记录写回 JSON 文件(尽力,失败降级内存保留)。"""
        try:
            self._file.parent.mkdir(parents=True, exist_ok=True)
            self._file.write_text(
                json.dumps(self._data, ensure_ascii=False, indent=2), encoding="utf-8"
            )
        except Exception as e:
            logger.warning("agent_step_recorder 写盘失败(内存保留): %s", e)

    def _trim(self, record: dict[str, Any]) -> None:
        """超出 max_steps 时删除最旧步骤,保留最近 max_steps 步。"""
        steps = record["steps"]
        overflow = len(steps) - self._max_steps
        if overflow > 0:
            record["steps"] = steps[overflow:]

    # ---------------- 写入 ----------------

    def append_step(self, run_id: str, step: dict[str, Any]) -> dict[str, Any]:
        """追加一步(按时间序 append,与写入顺序一致)。返回归一化后的 step。

        run_id 为空 raise ValueError;step 缺省字段由 recorder 归一化填回。
        """
        if not run_id:
            raise ValueError("run_id 不能为空")
        with self._lock:
            self._load()
            if run_id not in self._data:
                self._data[run_id] = {"steps": [], "started_at": _now_iso()}
            record = self._data[run_id]
            idx = len(record["steps"])
            normalized = _normalize_step(dict(step), idx)
            normalized["step_index"] = idx
            record["steps"].append(normalized)
            record["updated_at"] = _now_iso()
            self._trim(record)
            self._persist()
            return dict(normalized)

    def reset_run(self, run_id: str) -> bool:
        """清空某运行的步骤记录。存在则删除并返回 True,不存在返回 False(幂等)。"""
        with self._lock:
            self._load()
            if run_id in self._data:
                del self._data[run_id]
                self._persist()
                return True
            return False

    # ---------------- 读取 ----------------

    def _steps_copy(self, run_id: str) -> list[dict[str, Any]]:
        """取某 run 的步骤(深拷贝,避免调用方污染内部)。"""
        with self._lock:
            self._load()
            record = self._data.get(run_id)
        return [dict(s) for s in record["steps"]] if record else []

    def get_run_steps(
        self, run_id: str, *, page: int = 1, page_size: int = 20
    ) -> dict[str, Any]:
        """按时间序分页列出某运行的步骤。空运行返回 0 条。"""
        steps = self._steps_copy(run_id)
        total = len(steps)
        page = max(1, int(page or 1))
        page_size = min(max(1, int(page_size or 20)), PAGE_SIZE_MAX)
        start = (page - 1) * page_size
        return {
            "list": steps[start : start + page_size],
            "total": total,
            "page": page,
            "pageSize": page_size,
        }

    def replay(self, run_id: str, step_index: int | None = None) -> dict[str, Any]:
        """回放:含 step_index 取单步,否则取全量(时间序)。空运行返回空序列。"""
        steps = self._steps_copy(run_id)
        if step_index is not None:
            idx = int(step_index)
            if idx < 0 or idx >= len(steps):
                return {"run_id": run_id, "step": None, "found": False}
            return {"run_id": run_id, "step": steps[idx], "found": True}
        return {"run_id": run_id, "steps": steps, "total": len(steps)}

    def get_run_metrics(self, run_id: str) -> dict[str, Any]:
        """聚合单运行指标:步数 / 成败 / 总 token / 总耗时 / 总成本。"""
        steps = self._steps_copy(run_id)
        n = len(steps)
        ok = sum(1 for s in steps if s.get("status") == "ok")
        return {
            "run_id": run_id,
            "step_count": n,
            "ok_count": ok,
            "error_count": n - ok,
            "total_tokens": sum(int(s.get("tokens") or 0) for s in steps),
            "total_tokens_in": sum(int(s.get("tokens_in") or 0) for s in steps),
            "total_tokens_out": sum(int(s.get("tokens_out") or 0) for s in steps),
            "total_duration_ms": round(
                sum(float(s.get("duration_ms") or 0.0) for s in steps), 2
            ),
            "total_cost": round(sum(float(s.get("cost") or 0.0) for s in steps), 6),
        }


# 全局单例(router 与后续 agent 执行器注入共用)
agent_step_recorder = AgentStepRecorder()
