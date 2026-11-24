# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""AI 代码归属账的**对外函数式 API**(2026-11-05,goal-b49)。

判据与纯函数在 app/core/ai_code_attribution.py(仓内**只此一份**,按族拆到
_verdict/_record/_stats/_trace 四个子模块,那里是稳定聚合面);落盘在
app/services/ai_code_attribution_persistence.py;真跑 blame 在
app/services/ai_code_attribution_git.py。

**本模块自己不判归属**,只把三者串起来:
- ``record_attribution`` 造一条账行并落盘(判定在 core 里做);
- ``list_records`` / ``stats_*`` 是读数侧入口;
- ``trace_record`` 回溯一条账行,回溯不出 ⇒ unresolved + 原因(绝不假装成功)。

本模块同时 re-export 落盘层的 ``store`` 单例与 ``AiCodeAttributionStore``,
故 `from app.services.ai_code_attribution_store import store` 仍然可用
(测试用它 monkeypatch 落点)。
"""

from __future__ import annotations

import json
import logging
import uuid
from collections.abc import Mapping
from pathlib import Path

from app.core.ai_code_attribution import (
    TRACE_UNRESOLVED,
    AttributionRecord,
    AttributionStats,
    TraceResult,
    canonical_path_set,
    checkpoint_path_hash,
    compute_stats,
    host_prompt,
    make_record,
    plan_checkpoint,
    resolve_anchor,
)
from app.core.file_read_state import CHANGED_BY_EXTERNAL, VERDICT_STALE

from .ai_code_attribution_git import attach_checkpoint_note, detect_repo_root, git_blame
from .ai_code_attribution_persistence import (
    MAX_RECORDS,
    AiCodeAttributionStore,
    _path_key,
    _path_matches,
    store,
)
from .ttl_json_store import iso_now

logger = logging.getLogger(__name__)

__all__ = [
    "AiCodeAttributionStore",
    "MAX_RECORDS",
    "store",
    "host_session_id",
    "note_host_edit",
    "log_host_before_edit",
    "note_measured_external_edit",
    "log_host_edit_checkpoint",
    "list_checkpoint_log",
    "show_prompt",
    "remember_prompt",
    "record_attribution",
    "backfill_commit_sha",
    "mirror_checkpoints_to_notes",
    "list_records",
    "stats_for_path",
    "stats_for_session",
    "stats_all",
    "trace_record",
]


def host_session_id(arguments: Mapping[str, object] | None) -> str:
    """会话号只认承载层注入的 ``__session_id``。模型自报的 ``session_id`` 不算。"""
    if not isinstance(arguments, Mapping):
        return ""
    value = arguments.get("__session_id")
    if isinstance(value, str):
        return value.strip()
    return ""


def note_host_edit(
    tool: str,
    file: str,
    hunk: str,
    arguments: Mapping[str, object] | None,
    *,
    line_start: int = 1,
    line_end: int = 1,
) -> None:
    """写成功之后补一条归属账。记账失败不改变已经写完的文件。"""
    try:
        record_attribution(
            tool,
            file,
            hunk,
            session_id=host_session_id(arguments),
            line_start=line_start,
            line_end=line_end,
        )
    except Exception as exc:
        logger.warning("归属记账失败(不影响已完成的写入): %s", exc)
    try:
        log_host_edit_checkpoint(tool, file, hunk, arguments)
    except Exception as exc:
        logger.warning("检查点没记下(不影响已完成的写入): %s", exc)


def backfill_commit_sha(commit_sha: str, files: list[str]) -> tuple[int, str]:
    """提交成功后回填。返回 (改了几条, 拒绝原因)。拒绝时一条都不写。"""
    return store.backfill_commit_sha(commit_sha, files)


def mirror_checkpoints_to_notes(
    repo_root: Path,
    commit_sha: str,
    files: list[str],
    *,
    namespace: str = "",
) -> tuple[int, str]:
    """把路径对上的检查点写进该仓库的 git notes。对不上或清单为空都不创建引用。"""
    rows, refused = list_checkpoint_log()
    if refused:
        return 0, refused
    keys = [key for key in (_path_key(path) for path in files) if key]
    if not keys:
        return 0, ""
    written = 0
    for row in rows:
        paths = row.get("edited_filepaths")
        if not isinstance(paths, list):
            continue
        matched = any(isinstance(path, str) and _path_matches(path, keys) for path in paths)
        if not matched:
            continue
        status, reason = attach_checkpoint_note(repo_root, commit_sha, row, namespace=namespace)
        if status == "refused":
            return written, reason
        if status == "appended":
            written += 1
    return written, ""


def record_attribution(
    tool: str,
    file: str,
    hunk: str,
    *,
    session_id: str = "",
    line_start: int = 0,
    line_end: int = 0,
    commit_sha: str = "",
) -> AttributionRecord:
    """落一条归属记录(判定在 core 里做,这里只负责造记录 + 落盘)。"""
    record = make_record(
        record_id=uuid.uuid4().hex,
        tool=tool,
        file=file,
        hunk=hunk,
        session_id=session_id,
        line_start=line_start,
        line_end=line_end,
        commit_sha=commit_sha,
        at=iso_now(),
    )
    return store.append(record)


def list_records(
    *,
    path: str | None = None,
    session_id: str | None = None,
    limit: int = 100,
) -> list[AttributionRecord]:
    """列出归属记录(读数侧入口)。"""
    return store.list_records(path=path, session_id=session_id, limit=limit)


def stats_for_path(path: str) -> AttributionStats:
    """某文件的归属统计。"""
    return store.stats_for_path(path)


def stats_for_session(session_id: str) -> AttributionStats:
    """某次会话的归属统计。"""
    return store.stats_for_session(session_id)


def stats_all() -> AttributionStats:
    """全账统计(不按路径/会话过滤)。"""
    return compute_stats(store.list_records(limit=MAX_RECORDS))


def trace_record(record_id: str, *, repo_root: Path | None = None) -> TraceResult:
    """回溯一条归属记录;回溯不出 ⇒ unresolved + 原因。

    真正的 blame 执行在 app/services/ai_code_attribution_git.py(IO 与判据分离);
    「回溯不出 ⇒ unresolved」的裁决住在 core 的 resolve_anchor。
    """
    record = store.find(record_id)
    if record is None:
        return TraceResult(TRACE_UNRESOLVED, "回溯不出:账目里没有这条记录", ())
    root = repo_root or detect_repo_root()
    if root is None:
        return TraceResult(TRACE_UNRESOLVED, "回溯不出:取不到 git 仓库根", ())
    return resolve_anchor(
        record.anchor,
        lambda sha, path, start, end: git_blame(root, sha, path, start, end),
    )


def checkpoint_log_path() -> Path:
    """检查点日志与归属账同目录。测试把账挪走时，日志跟着走。"""
    return Path(store._file).with_name("ai_code_attribution_checkpoints.jsonl")


def prompt_log_path() -> Path:
    """提示词正文与检查点分开存放。git notes 只带编号，不带正文。"""
    return Path(store._file).with_name("ai_code_attribution_prompts.jsonl")


def _checkpoint_rows(path: Path) -> tuple[str, list[dict[str, object]]]:
    try:
        text = path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return "", []
    except OSError:
        return "检查点日志读不到,不能往下追加", []
    if text.strip() == "":
        return "", []
    rows: list[dict[str, object]] = []
    for line in text.splitlines():
        if not line.strip():
            continue
        try:
            item = json.loads(line)
        except ValueError:
            return "检查点日志读不到,不能往下追加", []
        if not isinstance(item, dict):
            return "检查点日志读不到,不能往下追加", []
        rows.append(item)
    return "", rows


def list_checkpoint_log() -> tuple[list[dict[str, object]], str]:
    """读检查点。日志损坏时不把空列表说成「还没有检查点」。"""
    refused, rows = _checkpoint_rows(checkpoint_log_path())
    if refused:
        return [], refused
    return rows, ""


def append_checkpoint(record: dict[str, object]) -> tuple[str, str]:
    """追加一条。同一去重键不写第二行。损坏的日志原字节不动。"""
    path = checkpoint_log_path()
    with store._lock:
        refused, rows = _checkpoint_rows(path)
        if refused:
            return "refused", refused
        key = str(record.get("dedupe_key") or "")
        if key and any(row.get("dedupe_key") == key for row in rows):
            return "duplicate", ""
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            with path.open("a", encoding="utf-8", newline="\n") as handle:
                handle.write(json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n")
        except OSError:
            return "refused", "检查点日志写不了"
        return "appended", ""


def _prompt_rows(path: Path) -> tuple[str, list[dict[str, object]]]:
    try:
        text = path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return "", []
    except OSError:
        return "提示词日志读不到", []
    if text.strip() == "":
        return "", []
    rows: list[dict[str, object]] = []
    for line in text.splitlines():
        if not line.strip():
            continue
        try:
            item = json.loads(line)
        except ValueError:
            return "提示词日志读不到", []
        if not isinstance(item, dict):
            return "提示词日志读不到", []
        rows.append(item)
    return "", rows


def remember_prompt(prompt_id: str, text: str) -> tuple[str, str]:
    """按编号收下正文。同一编号对上另一段时不覆盖先记下的那一段。"""
    token = prompt_id.strip()
    body = text.strip()
    if not token or not body:
        return "refused", "提示词编号或正文是空的"
    path = prompt_log_path()
    with store._lock:
        refused, rows = _prompt_rows(path)
        if refused:
            return "refused", refused
        for row in rows:
            if row.get("prompt_id") != token:
                continue
            if row.get("text") == body:
                return "duplicate", ""
            return "refused", "同一编号对上了另一段提示词"
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            with path.open("a", encoding="utf-8", newline="\n") as handle:
                handle.write(
                    json.dumps({"prompt_id": token, "text": body}, ensure_ascii=False, separators=(",", ":"))
                    + "\n"
                )
        except OSError:
            return "refused", "提示词日志写不了"
        return "appended", ""


def show_prompt(prompt_id: str) -> tuple[str | None, str]:
    """按编号取正文。编号是空的不扫全账。日志损坏时不把空结果说成没记过。"""
    if not isinstance(prompt_id, str) or not prompt_id.strip():
        return None, "没有提示词编号"
    refused, rows = _prompt_rows(prompt_log_path())
    if refused:
        return None, refused
    token = prompt_id.strip()
    for row in rows:
        if row.get("prompt_id") != token:
            continue
        body = row.get("text")
        if isinstance(body, str) and body.strip():
            return body, ""
        return None, "提示词没量到"
    return None, "提示词没量到"


def _log_host_hook(
    tool: str,
    file: str,
    hunk: str,
    arguments: Mapping[str, object] | None,
    hook_event_name: str,
) -> tuple[str, str]:
    planned, refused = plan_checkpoint(
        tool,
        file,
        hunk,
        arguments,
        hook_event_name=hook_event_name,
        session_id=host_session_id(arguments),
    )
    if planned is None:
        return "refused", refused
    status, reason = append_checkpoint(planned)
    if status != "refused":
        prompt_id, text, _prompt_refused = host_prompt(arguments)
        if prompt_id and text:
            try:
                remember_prompt(prompt_id, text)
            except Exception as exc:
                logger.warning("提示词没记下(不影响已记下的检查点): %s", exc)
    return status, reason


def log_host_before_edit(
    tool: str,
    file: str,
    hunk: str,
    arguments: Mapping[str, object] | None,
) -> tuple[str, str]:
    """闸门放行、字节落地之前记一条 before_edit。写失败时不补 after_edit。"""
    return _log_host_hook(tool, file, hunk, arguments, "before_edit")


def log_host_edit_checkpoint(
    tool: str,
    file: str,
    hunk: str,
    arguments: Mapping[str, object] | None,
) -> tuple[str, str]:
    """写成功之后记一条 after_edit。拒绝或重复都不改已经写完的文件。"""
    return _log_host_hook(tool, file, hunk, arguments, "after_edit")


def note_measured_external_edit(
    path: str,
    arguments: Mapping[str, object] | None,
    read_state: Mapping[str, object] | None,
) -> tuple[str, str]:
    """只有量到「读过之后、工具面之外改过」才记 known_human。别的脏因不记。"""
    if not isinstance(read_state, Mapping):
        return "skipped", ""
    if read_state.get("verdict") != VERDICT_STALE or read_state.get("changed_by") != CHANGED_BY_EXTERNAL:
        return "skipped", ""
    current = read_state.get("current")
    fingerprint = current.get("fingerprint") if isinstance(current, dict) else None
    if not isinstance(fingerprint, str) or not fingerprint.strip():
        return "refused", "外部改动的指纹没量到"
    token = fingerprint.strip()
    path_hash = checkpoint_path_hash([path])
    session_id = host_session_id(arguments)
    record: dict[str, object] = {
        "hook_event_name": "checkpoint",
        "dedupe_key": f"{session_id}:human:checkpoint:{path_hash}:{token}",
        "session_id": session_id,
        "operation_id": "human",
        "kind": "known_human",
        "tool": "external_edit",
        "edited_filepaths": canonical_path_set([path]),
        "path_hash": path_hash,
        "content_fingerprint": token,
    }
    return append_checkpoint(record)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
