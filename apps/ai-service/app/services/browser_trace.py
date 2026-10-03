# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""浏览器自动化操作 trace 记录与存储(Record & Replay · H9 失败可回放)。

把一次浏览器自动化会话(computer-use 驾驶舱 / 回放)的每步操作(动作 / 目标
selector|ref|坐标 / 参数 / 结果摘要 / 错误 / 截图引用 / 耗时 / 时间戳)录成
结构化 trace,持久化到 data/browser_traces.json,供事后回放与审计。

Trace 结构(append_step 入参缺省字段由 store 归一化):
    trace_id / started_at / updated_at / owner_user_id / steps[]
Step 结构:
    step_index / action(navigate|click|type|select_option|scroll|screenshot|
    extract_text|wait_for|snapshot|close) / target{selector|ref|x,y} / params{url|text|...} /
    expect{text_contains|title_contains|url_contains|selector_exists} /
    status(ok|error) / result_summary / error{kind,message} /
    screenshot_ref / duration_ms / at

存储:与 agent_step_recorder 同款——进程内 dict[trace_id -> record] + 每次变更
全量写回 JSON(损坏/缺失静默降级为空);截图 PNG 落盘 data/browser_traces/
<trace_id>/ 下,step 内仅存相对引用。并发用 threading.Lock 保护。

归属(G-258 B 组第二票,2026-09-27):trace 里躺着**每一步的目标与参数**(点过哪个
selector、往哪个输入框输过什么)和失败截图,改前 store 完全没有属主概念,于是
`GET /computer-use/trace` 一次列出全站所有人的操作流水。现在:
  · 创建即盖章 —— owner 由**首次** `append_step` 写入(值来自承载层传入的令牌主体,
    不从请求体、也不从记录内容反推),此后不可变;
  · 读 / 列表 / 删 / 贴截图 四个口都按 `owner_user_id` 过滤,判据只有
    `browser_hub._same_owner` 这一份实现(禁止在此另抄一份同形函数);
  · **别人的 trace 与"不存在"逐字同形**(同一个 `None` / 同一个 False / 同一条取值
    路径),否则这四个口合起来就是一个"探测别人的 trace_id 是否存在"的预言机;
  · 磁盘上的**历史 JSON 记录没有 owner 字段** ⇒ `owner_user_id` 读成 None ⇒ 按
    `_same_owner` 的三态,**对所有已登录调用方不可见**(只有 owner=None 的系统级内部
    调用能读到)。这是刻意选的处置,不是遗漏:与 session_store / browser_hub 同一条
    口径 —— "没盖章"绝不等于"人人可见",否则一次数据搬家就把这道口重新打开了。
    代价是这批历史 trace 在 UI 里读不到(文件与截图仍在盘上、未删除);要给它们补
    属主必须另有依据(例如从 computer_use 的会话日志逐条溯源),不得凭猜填。
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

from .browser_hub import _same_owner

from ._load_lifecycle import (
    decide_attempt as _decide_attempt,
    monotonic as _lifecycle_monotonic,
    state_after_failure as _state_after_failure,
    state_after_success as _state_after_success,
    DECISION_BACKOFF as _DECISION_BACKOFF,
    DECISION_GAVE_UP as _DECISION_GAVE_UP,
)
logger = logging.getLogger(__name__)

# 记录里存放属主的键名。**只在创建时写一次**,任何后续路径都不改它。
OWNER_KEY = "owner_user_id"

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


def _record_owner(record: dict[str, Any] | None) -> str | None:
    """从一条 trace 记录取属主;键缺席 / 值非字符串 / 空串 ⇒ None(= 未盖章)。

    与 `session_store.thread_owner` 同一条纪律:属主只认**已落库的那份**,且必须
    合型才当身份用 —— Redis/JSON 往返经常把值写成非 str,`==` 比较会静默永假。
    """
    if not record:
        return None
    owner = record.get(OWNER_KEY)
    if isinstance(owner, str) and owner:
        return owner
    return None


class BrowserTraceStore:
    """浏览器操作 trace 存储器(进程内 dict + JSON 文件持久化 + 截图落盘)。

    用法:
        store = BrowserTraceStore(file_path=..., screenshot_dir=...)  # 测试用 tmp_path
        store.append_step("bt-1", {"action": "navigate", "params": {"url": "..."}},
                          owner_user_id="u-1")        # 首次建记录即盖章
        trace = store.get_trace("bt-1", owner_user_id="u-1")
        ref = store.attach_screenshot("bt-1", 0, png_bytes, owner_user_id="u-1")

    `owner_user_id` 缺省 None 的语义是**系统级内部调用**(不设过滤),不是"公开可读":
    带身份的调用方一律按 `_same_owner` 过滤,而未盖章的记录对带身份的调用方不可见。
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
        # G-758(2026-10-03):加载生命周期标量(判定住在 _load_lifecycle,唯一一份)。
        # _loaded=False ∧ _load_failures>0 ⇒ "读不到"(待重试/已放弃自动重试),绝不等于空。
        self._load_failures: int = 0
        self._load_next_attempt_s: float = 0.0
        self._load_give_up_logged: bool = False
        self._max_steps = max(1, int(max_steps))

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
                    "[browser_trace_store] _load 连续 %d 次读取失败,停止自动重试(状态=读不到,非空表)",
                    self._load_failures,
                )
            return
        if decision == _DECISION_BACKOFF:
            return  # 退避窗口内:本次调用不打 IO
        try:
            if self._file.exists():
                raw = json.loads(self._file.read_text(encoding="utf-8"))
                if isinstance(raw, dict):
                    self._data = {
                        tid: record
                        for tid, record in raw.items()
                        if isinstance(record, dict) and isinstance(record.get("steps"), list)
                    }
            self._loaded, self._load_failures, self._load_next_attempt_s = _state_after_success()
        except Exception as e:
            self._load_failures, self._load_next_attempt_s = _state_after_failure(
                self._load_failures, now
            )
            logger.warning("browser_trace_store 读取失败(降级为空)(本次降级为空,退避后自动重试;连续失败到上限停自动重试): %s", e)

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

    def append_step(
        self,
        trace_id: str,
        step: dict[str, Any],
        *,
        owner_user_id: str | None = None,
    ) -> dict[str, Any]:
        """追加一步(按时间序)。trace_id 为空 raise ValueError,非法字符 raise ValueError。

        归属在这一格有**两件事**要做,缺一不可:

          · 记录不存在 → 建记录时就把 `owner_user_id` 写进去。这是它唯一的盖章时机,
            之后任何一次 append 都不再改这个值(否则"先给自己录一条、再让别人续写"
            就能把属主顶掉)。
          · 记录已存在 → 先过 `_same_owner` 再写。**写面不判等于读面白判**:
            `/trace/start` 的 trace_id 是客户端可自指定的,如果 append 不看归属,
            A 就能把步骤(含 `type` 的文本)灌进 B 的 trace,而 B 一次 `/replay` 就
            会在 B 自己的浏览器里真实执行 A 挑的那些步骤 —— 读口收紧了,链路照样通。

        跨属主写入抛 ValueError(与"非法 trace_id"同一个出口)。调用方 routers/
        computer_use.py::_record_step 把它降级成一条 warning 日志并返回 None,所以
        既不会污染他人记录,也不会让主操作失败;`step is None` 同时让紧随其后的
        attach_screenshot 走不到(那条 trace 不是我的,一张截图也不该往它的目录里落)。
        """
        if not trace_id or not _TRACE_ID_RE.match(trace_id):
            raise ValueError(f"非法 trace_id: {trace_id!r}")
        with self._lock:
            self._load()
            record = self._data.get(trace_id)
            if record is None:
                record = {"steps": [], "started_at": _now_iso(), OWNER_KEY: owner_user_id}
                self._data[trace_id] = record
            elif not _same_owner(_record_owner(record), owner_user_id):
                # 消息里不写属主是谁,也不区分"别人的"与"不能写的"
                raise ValueError(f"trace 不可写: {trace_id}")
            idx = len(record["steps"])
            normalized = _normalize_step(dict(step), idx)
            normalized["step_index"] = idx
            record["steps"].append(normalized)
            record["updated_at"] = _now_iso()
            self._trim(record)
            self._persist()
            return dict(normalized)

    def delete_trace(self, trace_id: str, *, owner_user_id: str | None = None) -> bool:
        """删除某 trace(幂等)。存在且属于调用方才删并返回 True。

        别人的 trace 返回 **False**,与"不存在"逐字同形 —— 返回不同值(比如 403 或
        True-but-not-deleted)都会把这里变成存在性预言机。
        """
        with self._lock:
            self._load()
            record = self._data.get(trace_id)
            if record is None:
                return False
            if not _same_owner(_record_owner(record), owner_user_id):
                return False
            del self._data[trace_id]
            self._persist()
            return True

    # ---------------- 截图落盘 ----------------

    def save_trace_file(self, trace_id: str, name: str, payload: bytes) -> str:
        """把二进制(截图 PNG 等)写到 data/browser_traces/<trace_id>/<name>,返回相对引用。"""
        if not _TRACE_ID_RE.match(trace_id or ""):
            raise ValueError(f"非法 trace_id: {trace_id!r}")
        target_dir = self._shot_dir / trace_id
        target_dir.mkdir(parents=True, exist_ok=True)
        (target_dir / name).write_bytes(payload)
        return f"browser_traces/{trace_id}/{name}"

    def attach_screenshot(
        self,
        trace_id: str,
        step_index: int,
        png_bytes: bytes,
        *,
        owner_user_id: str | None = None,
    ) -> str | None:
        """把截图落盘并回填到对应 step 的 screenshot_ref(供回放对照)。

        这是**写面**,与 append_step 同一条归属判据:别人的 trace 返回 None(与
        "trace 不存在"同形),既不写记录也不往他人目录里落文件。
        """
        with self._lock:
            self._load()
            record = self._data.get(trace_id)
            if not record:
                return None
            if not _same_owner(_record_owner(record), owner_user_id):
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

    def get_trace(
        self, trace_id: str, *, owner_user_id: str | None = None
    ) -> dict[str, Any] | None:
        """取整个 trace(深拷贝);不存在、或不归调用方 ⇒ 同一个 None。

        两种情形**必须**同形(同一个返回类型、同一条取值路径、消息里也不点名),
        否则 `GET /trace/{id}` 就退化成"逐个 trace_id 试探别人有没有录过"的预言机。
        """
        with self._lock:
            self._load()
            record = self._data.get(trace_id)
            if not record:
                return None
            if not _same_owner(_record_owner(record), owner_user_id):
                return None
            out = dict(record)
            out["steps"] = [dict(s) for s in record["steps"]]
        return out

    def list_traces(self, *, owner_user_id: str | None = None) -> list[dict[str, Any]]:
        """列出**属于调用方**的 trace 摘要(按 started_at 倒序,新的在前)。

        给了身份却仍然列全量,等于把整站的操作流水(含每步 target/params)摊给任何
        一个登录用户 —— 这一格改前就是这样的。
        """
        with self._lock:
            self._load()
            items = []
            for tid, record in self._data.items():
                if not _same_owner(_record_owner(record), owner_user_id):
                    continue
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
