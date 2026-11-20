# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""钩子运行审计落盘(2026-11-21 第 39 项)。

为什么单独立这一层:第 26/37/38 项把 `hook.run` 送进了 SSE 与前端面板,但那是
**内存态**——会话断开、进程重启、面板刷新之后,"昨天哪个钩子连续超时"就没有
任何可查的痕迹。排障与守门(失败率/超时风暴)需要的是一份**只追加、可按会话切**
的落盘事实,而不是让前端缓存充当证据。

口径(与既有实现的关系,不新造第二份真相源):
  - 唯一写入口 = `record_hook_run(payload)`,载荷形与 `hook.run` **逐字同形**
    (`run_id / session_id / tool_name / hooks`),从 `HookEngine.publish_observation`
    这一个观察者出口调用 —— 两条腿(agent_loop 与子代理派发)本来就汇到那里,
    所以不需要在每个挂载点各写一份。
  - 落盘失败(目录只读 / 磁盘满 / 并发写崩)只 warning,**绝不影响**钩子执行结果
    的下行;审计是观察面的附属品,不能反过来成为新的单点故障。
  - 空 `hooks` 帧不落(与 SSE 的"空表不发"同一条纪律)。

路径:默认 `<repo>/.ihui-agent/state/hook-audit.jsonl`,env `IHUI_HOOK_AUDIT_PATH`
可整体改路径(测试与多环境用);超过 `HOOK_AUDIT_MAX_BYTES` 轮转为 `.jsonl.1`。
"""

from __future__ import annotations

import json
import logging
import os
import threading
from collections import deque
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Final

logger = logging.getLogger(__name__)

HOOK_AUDIT_REL: Final = ".ihui-agent/state/hook-audit.jsonl"
HOOK_AUDIT_MAX_BYTES: Final = 5 * 1024 * 1024
_AUDIT_EVENT: Final = "hook.run"
_WRITE_LOCK = threading.Lock()

__all__ = [
    "HOOK_AUDIT_REL",
    "HOOK_AUDIT_MAX_BYTES",
    "hook_audit_path",
    "record_hook_run",
    "record_observation",
    "summarize_hook_audit",
]


def hook_audit_path() -> Path:
    """审计台账路径:env 覆盖优先,默认仓库根下 `.ihui-agent/state`。"""
    override = os.environ.get("IHUI_HOOK_AUDIT_PATH")
    if override:
        return Path(override).expanduser()
    # app/core/hook_audit.py → parents[2] = apps/ai-service,parents[3] = 仓库根
    return Path(__file__).resolve().parents[3] / HOOK_AUDIT_REL


def _rotate_if_needed(path: Path) -> None:
    try:
        if path.exists() and path.stat().st_size >= HOOK_AUDIT_MAX_BYTES:
            path.replace(path.with_name(path.name + ".1"))
    except OSError as exc:  # 轮转失败不影响本次追加(写不进去就写不进去)
        logger.warning("hook_audit: rotate failed for %s: %s", path, exc)


def _extract(payload: dict[str, Any]) -> dict[str, Any] | None:
    hooks_raw = payload.get("hooks")
    if not isinstance(hooks_raw, list) or not hooks_raw:
        return None
    hooks: list[dict[str, Any]] = []
    for item in hooks_raw:
        if not isinstance(item, dict):
            continue
        hooks.append(
            {
                "name": item.get("name"),
                "kind": item.get("kind"),
                "status": item.get("status"),
                "durationMs": item.get("durationMs"),
                "error": item.get("error"),
            }
        )
    if not hooks:
        return None
    return {
        "ts": datetime.now(UTC).isoformat(),
        "runId": payload.get("run_id"),
        "sessionId": payload.get("session_id"),
        "toolName": payload.get("tool_name"),
        "hooks": hooks,
    }


def record_hook_run(payload: dict[str, Any]) -> bool:
    """把一帧 `hook.run` 追加进审计台账;写成功返回 True,任何失败返回 False。"""
    record = _extract(payload)
    if record is None:
        return False
    path = hook_audit_path()
    line = json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n"
    try:
        with _WRITE_LOCK:
            path.parent.mkdir(parents=True, exist_ok=True)
            _rotate_if_needed(path)
            with path.open("a", encoding="utf-8") as fh:
                fh.write(line)
    except Exception as exc:  # noqa: BLE001 —— 审计绝不许冒泡打断钩子下行
        logger.warning("hook_audit: append failed for %s: %s", path, exc)
        return False
    return True


def record_observation(event: str, payload: dict[str, Any]) -> bool:
    """观察面统一入口:只有 `hook.run` 落盘,其它观察事件不记(避免账目口径膨胀)。"""
    if event != _AUDIT_EVENT:
        return False
    return record_hook_run(payload)


def summarize_hook_audit(
    session_id: str | None = None,
    max_lines: int = 20000,
) -> dict[str, Any]:
    """台账摘要(2026-11-21 第 41 项):只读聚合,按会话切可选。

    `available=False` 表示"台账不存在",与"存在但零条"**分开报** —— 前端据此
    决定"回落显示 0"还是"不显示",不把取不到输入说成零。
    只用 `deque(maxlen=max_lines)` 读尾部:台账 5MB 轮转、长会话上万行,
    全量读进来算聚合会随运行时长线性变慢。
    """
    path = hook_audit_path()
    result: dict[str, Any] = {
        "path": str(path),
        "available": False,
        "sessionId": session_id,
        "total": 0,
        "ok": 0,
        "timeout": 0,
        "error": 0,
        "totalDurationMs": 0,
        "slowestMs": 0,
        "lastTs": None,
        "truncated": False,
        "linesRead": 0,
    }
    try:
        if not path.exists():
            return result
    except OSError as exc:
        logger.warning("hook_audit: stat failed for %s: %s", path, exc)
        return result
    result["available"] = True
    lines: deque[str] = deque(maxlen=max(1, max_lines))
    try:
        with path.open("r", encoding="utf-8", errors="replace") as fh:
            for line in fh:
                lines.append(line)
    except Exception as exc:  # noqa: BLE001 —— 读失败回"不可用",不冒充 0
        logger.warning("hook_audit: read failed for %s: %s", path, exc)
        result["available"] = False
        return result
    result["truncated"] = len(lines) >= max(1, max_lines)
    for line in lines:
        if not line.strip():
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        if not isinstance(row, dict):
            continue
        if session_id and row.get("sessionId") != session_id:
            continue
        hooks = row.get("hooks")
        if not isinstance(hooks, list):
            continue
        for hook in hooks:
            if not isinstance(hook, dict):
                continue
            result["total"] += 1
            status = hook.get("status")
            if status == "ok":
                result["ok"] += 1
            elif status == "timeout":
                result["timeout"] += 1
            else:
                result["error"] += 1
            duration = hook.get("durationMs")
            if isinstance(duration, (int, float)) and duration > 0:
                result["totalDurationMs"] += int(duration)
                result["slowestMs"] = max(result["slowestMs"], int(duration))
        ts = row.get("ts")
        if isinstance(ts, str):
            result["lastTs"] = ts
        result["linesRead"] += 1
    return result
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
