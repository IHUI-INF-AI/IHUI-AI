# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

r"""批次 2(2026-11-06 立)工具输出落盘分页:超阈值输出 → 工件文件 + 摘要 + 续读凭据。

解决的问题
  - 历史行为(`bound_tool_result_for_context`)只把**截断后的尾部**写临时文件,正文里的
    指针无法被模型消费:没有 artifactId、没有 offset、也没有读取工具。大输出(命令日志/
    大文件/网页正文)因此只有前若干 token 的可见性,模型无法继续取证。
  - 本模块把完整输出落为工件(`.ihui-agent/tmp/tool-output/<artifact_id>.txt` + `.json`
    元数据),正文只放预览 + 机器可读凭据;模型用 `read_tool_output` 按 offset 分页续读,
    每次分页都有 `next/complete`,直到读到 `complete=true`。

不可漂的三条:
 ① **原文只在本机工件目录**:上下文与账行都只拿 digest(sha256)与截断预览,原文不出
    ai-service 进程(与 B04 账本的 hash-only 纪律同源)。
 ② **artifactId 是唯一续读键**:32 位小写 hex,严格校验后才拼路径(防目录穿越);
    工件目录在仓库内 `.ihui-agent/tmp`,不写盘根、不用系统临时目录。
 ③ **有界**:单工件最多存 2M 字符,超出的部分明确标 `truncatedOnDisk`(续读到末尾也
    读不到的部分不能假装不存在);工件按 7 天保留期惰性清理。

`complete` 的语义是"上下文是否已拿到完整输出",不是"文件是否存在":
  - `maybe_spill_tool_output` 返回的 `complete` 恒为 False(它只会在超预算时被调用);
  - `read_tool_output_page` 的 `complete` 只在读到落盘内容末尾时为 True。
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
import time
import uuid
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# 严格 ID 形状:只接受 uuid4().hex(32 位小写 hex)。拼路径前必须过这一关。
ARTIFACT_ID_RE = re.compile(r"^[0-9a-f]{32}$")

# 单工件落盘硬上限(字符):再大就不是"工具输出"而是数据集,应走文件/对象存储能力。
MAX_STORED_CHARS = 2_000_000
# 工件保留期:惰性清理(每次落盘顺手扫一遍,不做后台任务)。
RETENTION_SECONDS = 7 * 24 * 3600
# 分页默认/上限(字符):默认值与常见工具输出预览同档,上限防止单帧撑爆上下文。
DEFAULT_PAGE_CHARS = 4_000
MAX_PAGE_CHARS = 20_000
# 元数据里不落 preview(原文只在 .txt),此处只列"可对外"的字段。
_META_FIELDS = (
    "artifactId",
    "digest",
    "bytes",
    "chars",
    "storedChars",
    "complete",
    "truncatedOnDisk",
    "toolName",
    "sessionId",
    "toolCallId",
    "createdAt",
)


def artifact_dir() -> Path:
    """工件落点:仓库内 `.ihui-agent/tmp/tool-output`,与历史溢出目录同一处(不新造)。"""
    root = Path(__file__).resolve().parents[4]
    dest = root / ".ihui-agent" / "tmp" / "tool-output"
    dest.mkdir(parents=True, exist_ok=True)
    return dest


def serialize_tool_payload(payload: Any) -> str:
    """工具结果 → 正文的唯一序列化形态(与历史 json.dumps 参数逐字一致)。"""
    try:
        return json.dumps(payload, ensure_ascii=False, default=str)
    except (TypeError, ValueError):
        return json.dumps({"error": "tool result not serializable"}, ensure_ascii=False)


def _text_path(artifact_id: str) -> Path:
    return artifact_dir() / f"{artifact_id}.txt"


def _meta_path(artifact_id: str) -> Path:
    return artifact_dir() / f"{artifact_id}.json"


def _prune_expired(now: float) -> None:
    """惰性清理超过保留期的工件(失败只 debug,不影响本次落盘)。"""
    cutoff = now - RETENTION_SECONDS
    try:
        for path in artifact_dir().glob("*.txt"):
            try:
                if path.stat().st_mtime < cutoff:
                    path.unlink(missing_ok=True)
                    path.with_suffix(".json").unlink(missing_ok=True)
            except OSError:
                continue
    except OSError:
        return


def maybe_spill_tool_output(
    text: str,
    *,
    tool_name: str,
    session_id: str | None = None,
    tool_call_id: str | None = None,
    keep_chars: int,
    force: bool = False,
) -> dict[str, Any] | None:
    """超预算时把完整输出落盘并返回工件凭据;未超预算返回 None。

    `keep_chars` 是正文预览保留的字符数(调用方按 token 预算换算),用于给
    `offset/next` 与 `preview` 同一口径的起点。`force=True` 表示调用方已经确定
    要落盘(用于"两套 token 估算口径差 1-2"的边界),跳过二次预算判断。
    """
    if not force:
        from .mcp_server import _estimate_tokens_len, _get_tool_output_max_tokens

        if _estimate_tokens_len(text) <= _get_tool_output_max_tokens():
            return None

    artifact_id = uuid.uuid4().hex
    stored = text[:MAX_STORED_CHARS]
    truncated_on_disk = len(text) > len(stored)
    digest = "sha256:" + hashlib.sha256(text.encode("utf-8")).hexdigest()
    preview_len = max(0, min(keep_chars, len(stored)))

    try:
        _text_path(artifact_id).write_text(stored, encoding="utf-8")
        meta = {
            "artifactId": artifact_id,
            "digest": digest,
            "bytes": len(text.encode("utf-8")),
            "chars": len(text),
            "storedChars": len(stored),
            "complete": False,
            "truncatedOnDisk": truncated_on_disk,
            "toolName": tool_name,
            "sessionId": session_id,
            "toolCallId": tool_call_id,
            "createdAt": int(time.time() * 1000),
        }
        _meta_path(artifact_id).write_text(
            json.dumps(meta, ensure_ascii=False), encoding="utf-8"
        )
    except OSError as e:
        logger.warning("[b2] 工具输出落盘失败(降级为纯截断): %s", e)
        return None

    _prune_expired(time.time())

    return {
        **meta,
        "path": str(_text_path(artifact_id)),
        "preview": stored[:preview_len],
        "offset": preview_len,
        "next": preview_len,
    }


def read_tool_output_page(
    artifact_id: str,
    *,
    offset: int = 0,
    limit: int = DEFAULT_PAGE_CHARS,
) -> dict[str, Any]:
    """按字符 offset 读一页工件正文;返回 `content/next/complete` 与摘要元数据。

    失败一律返回 `ok=false` + 稳定 `error` 词(不让模型靠异常文本猜原因):
      - unknown_artifact: id 形状非法、元数据不存在,或元数据内容损坏;
      - artifact_unreadable: 元数据或正文读失败(磁盘/权限/目标是目录),不能说成没有这份工件。
    """
    if not ARTIFACT_ID_RE.match(artifact_id or ""):
        return {"ok": False, "error": "unknown_artifact", "artifactId": ""}

    try:
        meta = json.loads(_meta_path(artifact_id).read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {"ok": False, "error": "unknown_artifact", "artifactId": artifact_id}
    except ValueError:
        return {"ok": False, "error": "unknown_artifact", "artifactId": artifact_id}
    except OSError:
        return {"ok": False, "error": "artifact_unreadable", "artifactId": artifact_id}

    try:
        stored = _text_path(artifact_id).read_text(encoding="utf-8")
    except OSError:
        return {"ok": False, "error": "artifact_unreadable", "artifactId": artifact_id}

    page_size = max(1, min(int(limit), MAX_PAGE_CHARS))
    start = max(0, int(offset))
    page = stored[start : start + page_size]
    next_offset = start + len(page)
    truncated_on_disk = bool(meta.get("truncatedOnDisk"))
    complete = next_offset >= len(stored) and not truncated_on_disk

    return {
        "ok": True,
        "artifactId": artifact_id,
        "digest": meta.get("digest"),
        "toolName": meta.get("toolName"),
        "totalChars": meta.get("chars"),
        "totalBytes": meta.get("bytes"),
        "storedChars": len(stored),
        "truncatedOnDisk": truncated_on_disk,
        "offset": start,
        "next": next_offset,
        "complete": complete,
        "content": page,
    }


__all__ = [
    "ARTIFACT_ID_RE",
    "MAX_STORED_CHARS",
    "DEFAULT_PAGE_CHARS",
    "MAX_PAGE_CHARS",
    "artifact_dir",
    "serialize_tool_payload",
    "maybe_spill_tool_output",
    "read_tool_output_page",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
