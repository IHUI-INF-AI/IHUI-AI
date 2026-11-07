# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AI 代码归属账的**记录构造族**(2026-11-05,goal-b49)。

这一族只做一件事:把「谁改的 + 改了哪一段」拼成一条**可回溯**的账行
(``AttributionRecord`` + 锚 ``HunkAnchor``),并给出稳定的 hunk 标识与
unified diff 的行区间解析。

判定不在这儿:归属三态与工具登记表住在 app/core/ai_code_attribution_verdict.py
(仓内唯一一份判据);本模块 import 它,自己不另立一份表。
"""

from __future__ import annotations

import hashlib
import re
from collections.abc import Mapping
from dataclasses import dataclass

from app.core.ai_code_attribution_verdict import (
    ATTRIBUTION_AI,
    ATTRIBUTION_HUMAN,
    classify,
)

#: hunk 摘要入账的字符上限(账目文件要有界;超限截断并由 make_record 标注)。
HUNK_SUMMARY_MAX = 500

#: unified diff 头 `@@ -a,b +c,d @@` 的行区间解析。
_DIFF_HUNK_RE = re.compile(r"^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@")


def compute_hunk_id(path: str, hunk: str) -> str:
    """hunk 稳定标识:路径 + 归一化摘要的 sha1 前 16 位。

    归一化会去掉行尾空白与整行空白行 ⇒ 同一段改动重放得到同一个 id,
    账目因此可去重、可幂等重记。
    """
    normalized = "\n".join(line.rstrip() for line in (hunk or "").splitlines() if line.strip())
    return hashlib.sha1(f"{path}\n{normalized}".encode()).hexdigest()[:16]


def parse_diff_line_range(diff: str) -> tuple[int, int]:
    """从 unified diff 解析**新文件**的行区间(多 hunk 取并集)。

    解析不出(无 diff / 非 unified 形态 / 纯删除)⇒ ``(0, 0)``,调用方据此
    如实记「锚缺行区间」,而不是编一个行号。
    """
    start: int | None = None
    end: int | None = None
    for line in (diff or "").splitlines():
        match = _DIFF_HUNK_RE.match(line.strip())
        if match is None:
            continue
        new_start = int(match.group(1))
        count = int(match.group(2)) if match.group(2) is not None else 1
        if count <= 0:
            continue  # 纯删除 hunk:新文件侧没有行
        hunk_end = new_start + count - 1
        start = new_start if start is None else min(start, new_start)
        end = hunk_end if end is None else max(end, hunk_end)
    if start is None or end is None:
        return (0, 0)
    return (start, end)


@dataclass(frozen=True)
class HunkAnchor:
    """回溯锚:足以事后用 git blame 指认「这几行是谁的」。

    ``commit_sha`` 为空 = 改动尚未提交 ⇒ 此刻**回溯不出**(如实记,见
    app/core/ai_code_attribution_trace.py 的 resolve_anchor);
    ``line_start``/``line_end`` 为 0 = 行区间缺失。
    """

    path: str
    line_start: int
    line_end: int
    hunk_id: str
    commit_sha: str


@dataclass(frozen=True)
class AttributionRecord:
    """归属账的一行:一段改动 = 一个 (tool, file, hunk) 三元组。"""

    record_id: str
    tool: str
    file: str
    hunk_summary: str
    attribution: str
    reason: str
    anchor: HunkAnchor
    session_id: str
    at: str


def make_record(
    record_id: str,
    tool: str,
    file: str,
    hunk: str,
    *,
    session_id: str = "",
    line_start: int = 0,
    line_end: int = 0,
    commit_sha: str = "",
    at: str = "",
) -> AttributionRecord:
    """造一条归属记录(纯函数:判定与归一化都在这里,IO 由调用方负责)。"""
    verdict = classify(tool, file, hunk)
    summary = (hunk or "")[:HUNK_SUMMARY_MAX]
    anchor = HunkAnchor(
        path=(file or "").strip(),
        line_start=max(0, int(line_start)),
        line_end=max(0, int(line_end)),
        hunk_id=compute_hunk_id(file, hunk),
        commit_sha=(commit_sha or "").strip(),
    )
    return AttributionRecord(
        record_id=record_id,
        tool=tool,
        file=file,
        hunk_summary=summary,
        attribution=verdict.attribution,
        reason=verdict.reason,
        anchor=anchor,
        session_id=session_id,
        at=at,
    )


#: 对侧 checkpoint 协议观察到的三个事件名。认不出的值不落账。
CHECKPOINT_HOOKS = ("before_edit", "after_edit", "checkpoint")

_HOST_TEXT_KEYS = (
    ("__completion_id", "completion_id"),
    ("__chat_session_path", "chat_session_path"),
    ("__cwd", "cwd"),
    ("__editor", "editor"),
    ("__editor_version", "editor_version"),
    ("__extension_version", "extension_version"),
    ("__model", "model"),
    ("__repo_working_dir", "repo_working_dir"),
    ("__workspace_folder", "workspace_folder"),
)
_HOST_LIST_KEYS = (
    ("__will_edit_filepaths", "will_edit_filepaths"),
    ("__dirty_files", "dirty_files"),
)


def canonical_path_set(paths: list[str]) -> list[str]:
    """路径集合归一：正斜杠、去尾斜杠、大小写不敏感、排序去重。"""
    found: set[str] = set()
    for raw in paths:
        text = raw.replace("\\", "/").strip().rstrip("/").casefold()
        if text:
            found.add(text)
    return sorted(found)


def checkpoint_path_hash(paths: list[str]) -> str:
    """文件集合哈希。顺序不同但集合相同 ⇒ 同一个键。"""
    blob = "\n".join(canonical_path_set(paths)).encode()
    return hashlib.sha256(blob).hexdigest()[:16]


def plan_checkpoint(
    tool: str,
    file: str,
    hunk: str,
    arguments: Mapping[str, object] | None,
    *,
    hook_event_name: str,
    session_id: str,
    edited_filepaths: list[str] | None = None,
) -> tuple[dict[str, object] | None, str]:
    """拼一条检查点。缺测的宿主字段留空，不填对侧的默认工具名或模型名。"""
    if hook_event_name not in CHECKPOINT_HOOKS:
        return None, "检查点事件不在 before_edit/after_edit/checkpoint"
    edited = [file] if edited_filepaths is None else edited_filepaths
    if any(not isinstance(item, str) for item in edited):
        return None, "改动文件清单形态不对"
    if not (file or "").strip() or not (hunk or "").strip() or not canonical_path_set(edited):
        return None, "缺少文件或改动"
    host, refused = _host_fields(arguments)
    if refused:
        return None, refused
    verdict = classify(tool, file, hunk)
    completion = host.get("completion_id")
    completion_text = completion.strip() if isinstance(completion, str) else ""
    if verdict.attribution == ATTRIBUTION_HUMAN:
        operation = "human"
        kind = "known_human"
    elif completion_text:
        operation = completion_text
        kind = "ai_tab"
    elif verdict.attribution == ATTRIBUTION_AI:
        operation = "unjudged"
        kind = "ai"
    else:
        operation = "unjudged"
        kind = "unjudged"
    path_hash = checkpoint_path_hash(edited)
    record: dict[str, object] = {
        "hook_event_name": hook_event_name,
        "dedupe_key": f"{session_id}:{operation}:{hook_event_name}:{path_hash}",
        "session_id": session_id,
        "operation_id": operation,
        "kind": kind,
        "tool": tool,
        "edited_filepaths": canonical_path_set(edited),
        "path_hash": path_hash,
    }
    record.update(host)
    return record, ""


def _host_fields(arguments: Mapping[str, object] | None) -> tuple[dict[str, object], str]:
    """只认宿主注入的 ``__`` 字段。没给就是没测到，给了但形态不对就拒绝整条。"""
    found: dict[str, object] = {name: None for _, name in (*_HOST_TEXT_KEYS, *_HOST_LIST_KEYS)}
    if not isinstance(arguments, Mapping):
        return found, ""
    for source, name in _HOST_TEXT_KEYS:
        if source not in arguments:
            continue
        value = arguments[source]
        if not isinstance(value, str):
            return found, "宿主字段形态不对"
        found[name] = value.strip()
    for source, name in _HOST_LIST_KEYS:
        if source not in arguments:
            continue
        value = arguments[source]
        if not isinstance(value, list) or any(not isinstance(item, str) for item in value):
            return found, "宿主文件清单形态不对"
        found[name] = canonical_path_set(value)
    return found, ""
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
