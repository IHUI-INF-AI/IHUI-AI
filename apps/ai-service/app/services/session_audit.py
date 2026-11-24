# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""执行会话的权限文件与审计 trace(2026-11-24)。

竞品取证(Trae trae-sandbox / WorkBuddy sandbox-cli)显示:沙箱不是单一开关,
而是 session 路径 + permission file + 能力探测 + 审计事件的组合。IHUI 现有的
command_streamer 有会话身份注入与有界 kill,container_runtime 有 session_store,
但缺“每次执行可复核的权限文件与生命周期 trace”。

本模块不侵入执行链、不替换任何现有判据:
 - 每个 session 一个独立目录(由调用方给定 root,测试可注入 tmp_path);
 - permission file 是 JSON,缺失/畸形/版本不符 ⇒ 默认拒绝(不猜、不回落宽松);
 - trace 追加写 JSONL:启动 / 失败 / 退出三档,只记诊断字段,不记命令正文与环境变量。

纯 Python 标准库,无外部依赖,可直接在 pytest 下驱动。
"""

from __future__ import annotations

import json
import os
import tempfile
import time
from dataclasses import dataclass, field
from enum import StrEnum
from pathlib import Path
from typing import Any, Mapping

PERMISSION_FILENAME = "permission.json"
TRACE_FILENAME = "trace.jsonl"
PERMISSION_SCHEMA_VERSION = 1

TRACE_STARTED = "started"
TRACE_FAILED = "failed"
TRACE_EXITED = "exited"
_KNOWN_TRACE_EVENTS = frozenset({TRACE_STARTED, TRACE_FAILED, TRACE_EXITED})
_SENSITIVE_FIELD_KEYS = frozenset(
    {
        "password",
        "passwd",
        "secret",
        "apikey",
        "api_key",
        "accesstoken",
        "access_token",
        "refresh_token",
        "refreshtoken",
        "token",
        "authorization",
        "cookie",
    }
)


class PermissionDecision(StrEnum):
    """权限文件的判定结果。封闭三态,不把未判定压成允许。"""

    ALLOWED = "allowed"
    DENIED = "denied"
    UNDETERMINED = "undetermined"


@dataclass(frozen=True)
class PermissionFileResult:
    decision: PermissionDecision
    reason: str
    source: str


def session_directory(root: str | os.PathLike[str], session_id: str) -> Path:
    """返回该 session 的目录路径;session_id 只作路径段,不接受分隔符。

    非法 session_id(空/含路径分隔符/点段)抛 ValueError,避免越权写到别的目录。
    """
    if not session_id or session_id in {".", ".."}:
        raise ValueError("invalid session id")
    if "/" in session_id or "\\" in session_id or "\x00" in session_id:
        raise ValueError("invalid session id")
    return Path(root) / session_id


def read_permission_file(directory: str | os.PathLike[str]) -> PermissionFileResult:
    """读 session 目录下的权限文件。缺文件/畸形/未知版本一律未判定。

    `allow` 必须是布尔 true 才算允许;字符串 "true"、1 都不算(不猜、不类型转换)。
    """
    path = Path(directory) / PERMISSION_FILENAME
    try:
        raw = path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return PermissionFileResult(PermissionDecision.UNDETERMINED, "permission-file-absent", "file")
    except OSError as exc:
        return PermissionFileResult(
            PermissionDecision.UNDETERMINED, f"permission-file-unreadable:{type(exc).__name__}", "file"
        )
    try:
        payload = json.loads(raw)
    except (ValueError, UnicodeDecodeError):
        return PermissionFileResult(PermissionDecision.UNDETERMINED, "permission-file-malformed", "file")
    if not isinstance(payload, dict):
        return PermissionFileResult(PermissionDecision.UNDETERMINED, "permission-file-shape", "file")
    if payload.get("schemaVersion") != PERMISSION_SCHEMA_VERSION:
        return PermissionFileResult(PermissionDecision.UNDETERMINED, "permission-file-version", "file")
    allow = payload.get("allow")
    if not isinstance(allow, bool):
        return PermissionFileResult(PermissionDecision.UNDETERMINED, "permission-allow-not-bool", "file")
    if not allow:
        return PermissionFileResult(PermissionDecision.DENIED, "permission-explicit-deny", "file")
    return PermissionFileResult(PermissionDecision.ALLOWED, "permission-explicit-allow", "file")


def write_permission_file(
    directory: str | os.PathLike[str],
    *,
    allow: bool,
    reason: str = "",
    schema_version: int = PERMISSION_SCHEMA_VERSION,
) -> Path:
    """原子写权限文件(临时文件 + os.replace),避免半文件被读到。"""
    base = Path(directory)
    base.mkdir(parents=True, exist_ok=True)
    payload = {"schemaVersion": schema_version, "allow": allow, "reason": reason}
    fd, tmp = tempfile.mkstemp(prefix=".permission-", dir=str(base))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, ensure_ascii=False, sort_keys=True)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp, base / PERMISSION_FILENAME)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)
    return base / PERMISSION_FILENAME


@dataclass(frozen=True)
class TraceEvent:
    """单条 trace。fields 只放诊断值,不放命令正文/环境变量/凭据。"""

    event: str
    session_id: str
    ts: float = field(default_factory=time.time)
    fields: Mapping[str, Any] = field(default_factory=dict)

    def to_jsonl(self) -> str:
        return json.dumps(
            {
                "event": self.event,
                "sessionId": self.session_id,
                "ts": self.ts,
                "fields": dict(self.fields),
            },
            ensure_ascii=False,
            sort_keys=True,
        )


def append_trace(directory: str | os.PathLike[str], event: TraceEvent) -> None:
    """追加一条 trace 到 session 目录。事件名必须在封闭集内,否则拒绝写入。"""
    if event.event not in _KNOWN_TRACE_EVENTS:
        raise ValueError(f"unknown trace event: {event.event}")
    # 诊断入口同样不得成为泄漏面:敏感键一律拒收,不写半条。
    for key in event.fields:
        if str(key).lower() in _SENSITIVE_FIELD_KEYS:
            raise ValueError(f"sensitive trace field rejected: {key}")
    base = Path(directory)
    base.mkdir(parents=True, exist_ok=True)
    with (base / TRACE_FILENAME).open("a", encoding="utf-8") as fh:
        fh.write(event.to_jsonl() + "\n")


def read_traces(directory: str | os.PathLike[str]) -> list[dict[str, Any]]:
    """读回全部 trace(按写入顺序);文件不存在返回空列表。"""
    path = Path(directory) / TRACE_FILENAME
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except FileNotFoundError:
        return []
    return [json.loads(line) for line in lines if line.strip()]


def can_execute(directory: str | os.PathLike[str]) -> bool:
    """执行前置闸:只有显式 allowed 才放行;denied/undetermined 一律拒绝。"""
    return read_permission_file(directory).decision is PermissionDecision.ALLOWED
