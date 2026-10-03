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
    step_index / type(tool|message|plan|llm) / tool_name / input_summary /
    result_summary / status(ok|error) / tokens / tokens_in / tokens_out /
    duration_ms / cost / http_summary / at
Prompt 缓存计量(P0-①,2026-09-18 立,对标 Codex Harness 的缓存可观测):
    cached_tokens(缓存读命中)/ cache_creation_tokens(缓存写,Anthropic 5min TTL)
    —— 主循环 LLM 步骤(type=llm)与工具内嵌 LLM 用量均透传此二字段,
    供 cost_ledger 缓存感知计价与命中统计。
可解释性证据字段(1-5,2026-09-08 立,缺省回填,原样保留供回放审计):
    input(原始入参,None=未提供) / decision / reason /
    diff / test / rollback(均为 None=未推导)

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

from ._load_lifecycle import (
    DECISION_BACKOFF as _DECISION_BACKOFF,
)
from ._load_lifecycle import (
    DECISION_GAVE_UP as _DECISION_GAVE_UP,
)
from ._load_lifecycle import (
    decide_attempt as _decide_attempt,
)
from ._load_lifecycle import (
    monotonic as _lifecycle_monotonic,
)
from ._load_lifecycle import (
    state_after_failure as _state_after_failure,
)
from ._load_lifecycle import (
    state_after_success as _state_after_success,
)
from .ttl_json_store import (
    load_ttl_records,
    resolve_retention_days,
    write_json_atomic,
)

_RETENTION_ENV = "AGENT_STEP_RECORDS_RETENTION_DAYS"

_DEFAULT_RETENTION_DAYS = 30
_RETENTION_DAYS = resolve_retention_days(_RETENTION_ENV, _DEFAULT_RETENTION_DAYS)

_MAX_RUNS = 1_000


logger = logging.getLogger(__name__)

# 单 run 保留步数上限(唯一真源见 app/core/tunables.py)
# b76-04 票3:step 记录审计载荷 caps 常量表(数字即契约,必须住在有名字的表里;
# 每条 cap 标注 enforcement 侧 —— 本表全部是记录侧执行:审计输入必须有界,
# 但快路径原样、超限逐项收紧并置 truncated 位,"宁可诚实地说被截了",
# 不许静默夹半截进审计文件)。
STEP_RECORD_CAPS: dict[str, dict[str, Any]] = {
    # 审计输入整体字节上限(对齐上游 world-read-input 的 WORLD_READ_INPUT_MAX_BYTES = 4096)
    "auditInputMaxBytes": {"cap": 4096, "enforcement": "记录侧执行"},
    # 单项文本字符上限(SUMMARY_LIMIT 是它的别名,旧调用点继续可用)
    "itemMaxChars": {"cap": 1000, "enforcement": "记录侧执行"},
    # 证据数组(diff/test/rollback)项数上限
    "evidenceArrayMaxItems": {"cap": 8, "enforcement": "记录侧执行"},
}
# 输入/结果摘要单条长度上限(历史名,= itemMaxChars.cap,防单条超大撑爆文件)
SUMMARY_LIMIT = STEP_RECORD_CAPS["itemMaxChars"]["cap"]
# 分页 page_size 上限
PAGE_SIZE_MAX = 200

_VALID_TYPES = ("tool", "message", "plan", "llm")
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


def _clip_text_flagged(value: Any, limit: int) -> tuple[str, bool]:
    """_clip_text 的带位版:第二返回值 = 是否发生了截断(供 truncated 位归集)。"""
    try:
        text = json.dumps(value, ensure_ascii=False, default=str)
    except Exception:
        text = str(value)
    if len(text) > limit:
        # 截断事实进 truncated 位(不往文本里塞标记,保持"每项 ≤ 上限"的干净后件)
        return text[:limit], True
    return text, False


def _bound_evidence(value: Any, max_items: int, max_chars: int) -> tuple[Any, bool]:
    """证据位(diff/test/rollback)有界化:数组 ≤ max_items、每项字符串 ≤ max_chars。"""
    changed = False
    if isinstance(value, list):
        if len(value) > max_items:
            value = value[:max_items]
            changed = True
        bounded: list[Any] = []
        for item in value:
            if isinstance(item, str) and len(item) > max_chars:
                bounded.append(item[:max_chars])
                changed = True
            else:
                bounded.append(item)
        return bounded, changed
    if isinstance(value, str) and len(value) > max_chars:
        return value[:max_chars], True
    return value, changed


def _bound_audit_payload(step: dict[str, Any], truncated: bool) -> dict[str, Any]:
    """审计输入必须有界(b76-04 票3,上游 world-read-input 的另一半语义)。

    超过 auditInputMaxBytes ⇒ 逐字段收紧(最长文本字段折半,下限 64)并置 truncated 位;
    收紧到底仍超 ⇒ 丢弃 input 原始体(最大自由文本位)。终态保证:
    每项文本 ≤ itemMaxChars、证据数组 ≤ evidenceArrayMaxItems、truncated 位如实可读。
    """
    item_chars = STEP_RECORD_CAPS["itemMaxChars"]["cap"]
    text_fields = ("input_summary", "result_summary", "decision", "reason", "http_summary")
    guard = 0
    while guard < 64:
        guard += 1
        try:
            size = len(json.dumps(step, ensure_ascii=False, default=str).encode("utf-8"))
        except Exception:
            size = 0
        if size <= STEP_RECORD_CAPS["auditInputMaxBytes"]["cap"]:
            break
        longest = max(text_fields, key=lambda k: len(str(step.get(k) or "")))
        cur = str(step.get(longest) or "")
        if len(cur) <= 64:
            if step.get("input") is not None:
                step["input"] = None  # 最大自由文本位让位,诚实置位
                truncated = True
                continue
            break
        step[longest] = cur[: max(64, len(cur) // 2)]
        truncated = True
    step["truncated"] = truncated
    return step


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
    truncated = False
    input_summary, clipped = _clip_text_flagged(step.get("input_summary", ""), SUMMARY_LIMIT)
    truncated = truncated or clipped
    result_summary, clipped = _clip_text_flagged(step.get("result_summary", ""), SUMMARY_LIMIT)
    truncated = truncated or clipped
    evidence_max = STEP_RECORD_CAPS["evidenceArrayMaxItems"]["cap"]
    item_chars = STEP_RECORD_CAPS["itemMaxChars"]["cap"]
    bounded_input, clipped = _bound_evidence(step.get("input"), evidence_max, item_chars)
    truncated = truncated or clipped
    bounded_diff, clipped = _bound_evidence(step.get("diff"), evidence_max, item_chars)
    truncated = truncated or clipped
    bounded_test, clipped = _bound_evidence(step.get("test"), evidence_max, item_chars)
    truncated = truncated or clipped
    bounded_rollback, clipped = _bound_evidence(step.get("rollback"), evidence_max, item_chars)
    truncated = truncated or clipped
    return {
        "step_index": int(_to_num(step.get("step_index"), idx)),
        "type": stype,
        "tool_name": str(step.get("tool_name") or ""),
        "input_summary": input_summary,
        "result_summary": result_summary,
        "status": status,
        "tokens": int(_to_num(step.get("tokens"), 0)),
        "tokens_in": int(_to_num(step.get("tokens_in"), 0)),
        "tokens_out": int(_to_num(step.get("tokens_out"), 0)),
        # P0-①(2026-09-18):Prompt 缓存读/写 token 透传(0=无缓存信息),
        # 归一化钳到非负,供 cost_ledger 缓存感知计价
        "cached_tokens": max(0, int(_to_num(step.get("cached_tokens"), 0))),
        "cache_creation_tokens": max(
            0, int(_to_num(step.get("cache_creation_tokens"), 0))
        ),
        # model(2026-09-09 立):此前归一化时被丢弃,导致 sync_from_recorder 的
        # s.get("model") 永远为空 —— 工具内嵌 LLM 用量(如 extract_web)入账无模型可归
        "model": str(step.get("model") or ""),
        "duration_ms": round(_to_num(step.get("duration_ms")), 2),
        "cost": round(_to_num(step.get("cost")), 6),
        "http_summary": str(step.get("http_summary") or ""),
        "at": str(step.get("at") or _now_iso()),
        # 1-5 可解释性证据(2026-09-08 立):缺省回填;b76-04 票3 起超限有界化(诚实置位)
        "input": bounded_input,
        "decision": str(step.get("decision") or ""),
        "reason": str(step.get("reason") or ""),
        "diff": bounded_diff,
        "test": bounded_test,
        "rollback": bounded_rollback,
        # 内部位:append_step 处 pop 后归集进整体 truncated(b76-04 票3)
        "_truncated": truncated,
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
        # G-758(2026-10-03):加载生命周期标量(判定住在 _load_lifecycle,唯一一份)。
        # _loaded=False ∧ _load_failures>0 ⇒ "读不到"(待重试/已放弃自动重试),绝不等于空。
        self._load_failures: int = 0
        self._load_next_attempt_s: float = 0.0
        self._load_give_up_logged: bool = False
        self._max_steps = max(1, int(max_steps))
        self._summary_limit = max(1, int(summary_limit))

    # ---------------- 内部 ----------------

    def _load(self) -> None:
        """从 JSON 懒加载到内存(仅首次;损坏/缺失降级为空)。"""
        if self._loaded:
            return
        now = _lifecycle_monotonic()
        decision = _decide_attempt(
            loaded=self._loaded,
            failures=self._load_failures,
            next_attempt_s=self._load_next_attempt_s,
            now=now,
        )
        if decision == _DECISION_GAVE_UP:
            if not self._load_give_up_logged:
                self._load_give_up_logged = True
                logger.warning(
                    "[agent_step_recorder] _load 连续 %d 次读取失败,停止自动重试(状态=读不到,非空表)",
                    self._load_failures,
                )
            return
        if decision == _DECISION_BACKOFF:
            return  # 退避窗口内:本次调用不打 IO
        try:
            # 2026-10-03 数据出域合规整改:读取走 ttl_json_store(带保留期 + 存量
            # 过期清理),不再裸 json.loads。原逻辑保留在 base 里,两侧改动在此归并。
            data, dropped = load_ttl_records(
                self._file,
                retention_days=_RETENTION_DAYS,
                shape="mapping",
                max_items=_MAX_RUNS,
                validate=lambda r: isinstance(r, dict) and isinstance(r.get("steps"), list),
            )
            if dropped:
                logger.info("agent_step_recorder 加载:清理过期/超限 run %d 个", dropped)
            self._data = data
            self._loaded, self._load_failures, self._load_next_attempt_s = _state_after_success()
        except Exception as e:
            self._load_failures, self._load_next_attempt_s = _state_after_failure(
                self._load_failures, now
            )
            logger.warning("agent_step_recorder 读取失败(降级为空)(本次降级为空,退避后自动重试;连续失败到上限停自动重试): %s", e)

    def _persist(self) -> None:
        """把内存全量记录写回 JSON 文件(尽力,失败降级内存保留)。"""
        try:
            # 2026-10-03 数据出域合规整改:原子写(临时文件 + os.replace),
            # 避免崩在半截时盘上留一个坏 JSON(读侧会 fail-closed 成空 ⇒ 静默丢数据)。
            write_json_atomic(self._file, self._data, indent=2)
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
            # b76-04 票3:审计载荷整体有界(超字节上限 ⇒ 收紧 + truncated 位,不静默)
            normalized = _bound_audit_payload(normalized, normalized.pop("_truncated", False))
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
