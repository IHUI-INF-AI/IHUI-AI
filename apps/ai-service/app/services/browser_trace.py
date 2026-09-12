# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""浏览器自动化操作 trace 记录与存储(Record & Replay · H9 失败可回放)。

把一次浏览器自动化会话(computer-use 驾驶舱 / 回放)的每步操作(动作 / 目标
selector|ref|坐标 / 参数 / 结果摘要 / 错误 / 截图引用 / 耗时 / 时间戳)录成
结构化 trace,持久化到 data/browser_traces.json,供事后回放与审计。

Trace 结构(append_step 入参缺省字段由 store 归一化):
    trace_id / started_at / updated_at / steps[]
Step 结构:
    step_index / action(navigate|click|type|select_option|scroll|screenshot|
    extract_text|wait_for|snapshot|close) / target{selector|ref|x,y} / params{url|text|...} /
    expect{text_contains|title_contains|url_contains|selector_exists} /
    status(ok|error) / result_summary / error{kind,message} /
    screenshot_ref / duration_ms / at

存储:与 agent_step_recorder 同款——进程内 dict[trace_id -> record] + 每次变更
全量写回 JSON(损坏/缺失静默降级为空);截图 PNG 落盘 data/browser_traces/
<trace_id>/ 下,step 内仅存相对引用。并发用 threading.Lock 保护。
"""

from __future__ import annotations

import json
import logging
import re
import threading
import time
import uuid
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# 单 trace 保留步数上限(防超长会话撑爆文件)
MAX_STEPS_PER_TRACE = 500
# 摘要单条长度上限
SUMMARY_LIMIT = 1000
# trace_id 字符白名单(用于目录名,防路径穿越)
_TRACE_ID_RE = re.compile(r"^[A-Za-z0-9._-]{1,64}$")

_VALID_ACTIONS = (
    "navigate",
    "click",
    "type",
    "select_option",
    "scroll",
    "screenshot",
    "extract_text",
    "wait_for",
    "snapshot",
    "close",
)
_VALID_STATUS = ("ok", "error")
_VALID_EXPECT_TYPES = ("text_contains", "title_contains", "url_contains", "selector_exists")

# JSON 持久化文件(ai-service 根下的 data/browser_traces.json)
_DATA_DIR = Path(__file__).resolve().parents[2] / "data"
_TRACES_FILE = _DATA_DIR / "browser_traces.json"
_SCREENSHOT_DIR = _DATA_DIR / "browser_traces"


def _now_iso() -> str:
    """当前 UTC 时间 ISO8601(秒级)。"""
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def new_trace_id() -> str:
    """生成一个新的 trace_id(时间戳前缀 + 短 uuid,便于排序与阅读)。"""
    return time.strftime("bt-%Y%m%d-%H%M%S-") + uuid.uuid4().hex[:8]


def _clip_text(value: Any, limit: int) -> str:
    """把任意值转文本并截断到 limit。"""
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
    """把调用方传入的 step 归一化为标准结构,缺省字段回填。"""
    action = str(step.get("action") or "")
    if action not in _VALID_ACTIONS:
        action = "navigate"
    raw_status = str(step.get("status", "ok")).strip().lower()
    status = raw_status if raw_status in _VALID_STATUS else "ok"
    target = step.get("target")
    expect = step.get("expect")
    error = step.get("error")
    params = step.get("params")
    return {
        "step_index": int(_to_num(step.get("step_index"), idx)),
        "action": action,
        "target": dict(target) if isinstance(target, dict) else None,
        "params": dict(params) if isinstance(params, dict) else {},
        "expect": (
            {
                "type": expect["type"],
                "value": str(expect.get("value", "")),
            }
            if isinstance(expect, dict)
            and expect.get("type") in _VALID_EXPECT_TYPES
            else None
        ),
        "status": status,
        "result_summary": _clip_text(step.get("result_summary", ""), SUMMARY_LIMIT),
        "error": (
            {
                "kind": str(error.get("kind") or "exception"),
                "message": str(error.get("message") or "")[:500],
            }
            if isinstance(error, dict)
            else None
        ),
        "screenshot_ref": str(step.get("screenshot_ref")) if step.get("screenshot_ref") else None,
        "duration_ms": round(_to_num(step.get("duration_ms")), 2),
        "at": str(step.get("at") or _now_iso()),
    }


def extract_assertions(trace: dict[str, Any]) -> list[dict[str, Any]]:
    """从 trace 提取断言(带 expect 的步骤),供回放逐条比对。"""
    assertions: list[dict[str, Any]] = []
    for step in trace.get("steps", []):
        expect = step.get("expect")
        if expect:
            assertions.append(
                {"step_index": step.get("step_index"), "action": step.get("action"), "expect": expect}
            )
    return assertions


class BrowserTraceStore:
    """浏览器操作 trace 存储器(进程内 dict + JSON 文件持久化 + 截图落盘)。

    用法:
        store = BrowserTraceStore(file_path=..., screenshot_dir=...)  # 测试用 tmp_path
        store.append_step("bt-1", {"action": "navigate", "params": {"url": "..."}})
        trace = store.get_trace("bt-1")
        ref = store.attach_screenshot("bt-1", 0, png_bytes)
    """

    def __init__(
        self,
        *,
        file_path: Path | None = None,
        screenshot_dir: Path | None = None,
        max_steps: int = MAX_STEPS_PER_TRACE,
    ) -> None:
        self._file = file_path or _TRACES_FILE
        self._shot_dir = screenshot_dir or _SCREENSHOT_DIR
        self._data: dict[str, dict[str, Any]] = {}
        self._lock = threading.Lock()
        self._loaded = False
        self._max_steps = max(1, int(max_steps))

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
                        tid: record
                        for tid, record in raw.items()
                        if isinstance(record, dict) and isinstance(record.get("steps"), list)
                    }
        except Exception as e:
            logger.warning("browser_trace_store 读取失败(降级为空): %s", e)
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
            logger.warning("browser_trace_store 写盘失败(内存保留): %s", e)

    def _trim(self, record: dict[str, Any]) -> None:
        """超出 max_steps 时删除最旧步骤。"""
        steps = record["steps"]
        overflow = len(steps) - self._max_steps
        if overflow > 0:
            record["steps"] = steps[overflow:]

    # ---------------- 写入 ----------------

    def append_step(self, trace_id: str, step: dict[str, Any]) -> dict[str, Any]:
        """追加一步(按时间序)。trace_id 为空 raise ValueError,非法字符 raise ValueError。"""
        if not trace_id or not _TRACE_ID_RE.match(trace_id):
            raise ValueError(f"非法 trace_id: {trace_id!r}")
        with self._lock:
            self._load()
            if trace_id not in self._data:
                self._data[trace_id] = {"steps": [], "started_at": _now_iso()}
            record = self._data[trace_id]
            idx = len(record["steps"])
            normalized = _normalize_step(dict(step), idx)
            normalized["step_index"] = idx
            record["steps"].append(normalized)
            record["updated_at"] = _now_iso()
            self._trim(record)
            self._persist()
            return dict(normalized)

    def delete_trace(self, trace_id: str) -> bool:
        """删除某 trace(幂等)。存在则删除并返回 True,不存在返回 False。"""
        with self._lock:
            self._load()
            if trace_id in self._data:
                del self._data[trace_id]
                self._persist()
                return True
            return False

    # ---------------- 截图落盘 ----------------

    def save_trace_file(self, trace_id: str, name: str, payload: bytes) -> str:
        """把二进制(截图 PNG 等)写到 data/browser_traces/<trace_id>/<name>,返回相对引用。"""
        if not _TRACE_ID_RE.match(trace_id or ""):
            raise ValueError(f"非法 trace_id: {trace_id!r}")
        target_dir = self._shot_dir / trace_id
        target_dir.mkdir(parents=True, exist_ok=True)
        (target_dir / name).write_bytes(payload)
        return f"browser_traces/{trace_id}/{name}"

    def attach_screenshot(self, trace_id: str, step_index: int, png_bytes: bytes) -> str | None:
        """把截图落盘并回填到对应 step 的 screenshot_ref(供回放对照)。"""
        with self._lock:
            self._load()
            record = self._data.get(trace_id)
            if not record:
                return None
            idx = int(step_index)
            if idx < 0 or idx >= len(record["steps"]):
                return None
        ref = self.save_trace_file(trace_id, f"step_{idx:03d}.png", png_bytes)
        with self._lock:
            record["steps"][idx]["screenshot_ref"] = ref
            record["updated_at"] = _now_iso()
            self._persist()
        return ref

    # ---------------- 读取 ----------------

    def get_trace(self, trace_id: str) -> dict[str, Any] | None:
        """取整个 trace(深拷贝);不存在返回 None。"""
        with self._lock:
            self._load()
            record = self._data.get(trace_id)
        if not record:
            return None
        out = dict(record)
        out["steps"] = [dict(s) for s in record["steps"]]
        return out

    def list_traces(self) -> list[dict[str, Any]]:
        """列出全部 trace 摘要(按 started_at 倒序,新的在前)。"""
        with self._lock:
            self._load()
            items = []
            for tid, record in self._data.items():
                steps = record.get("steps", [])
                ok = sum(1 for s in steps if s.get("status") == "ok")
                items.append(
                    {
                        "trace_id": tid,
                        "step_count": len(steps),
                        "ok_count": ok,
                        "error_count": len(steps) - ok,
                        "started_at": record.get("started_at", ""),
                        "updated_at": record.get("updated_at", ""),
                    }
                )
        items.sort(key=lambda it: it["started_at"], reverse=True)
        return items


# 全局单例(computer-use 路由录制/回放共用)
browser_trace_store = BrowserTraceStore()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
