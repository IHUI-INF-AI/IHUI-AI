# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# WATERMARK-PLACEHOLDER(本行由 scripts/watermark.mjs inject 替换为横幅)

"""G3 Beyond-Coding 泛化:create_artifact 交付物工具(2026-10-30 立)。

让 agent 在对话中产出 html_report | slides | sheet | doc | video_ref 五类
交付物。落法(不建新表,挂既有机制):

- **payload 落盘**:仓库根 `tmp/artifacts/<artifact_id>/v<version>.<ext>` ——
  即 `app/routers/artifacts.py` 既有白名单目录,`.owner` sidecar 归属契约与
  generate_chart 逐字同构(宿主注入的 __user_id,LLM 不可控);
- **结构化 JSON 附件**:Artifact 元数据记录经既有 `artifacts_store`
  (Redis hash `mcp:artifacts:<conversation_id>`,内存降级)登记为会话附件,
  summarize_artifacts 等既有聚合面自动可见;更新时复用同一 attachment_id;
- **目录级索引**:`artifact.json`(最新版元数据)+ `owner.json`(user_id +
  session_id),供 apps/api 导出端点按 artifact_id 直查与归属校验。

版本语义:更新 = version+1,**旧版 payload 文件保留**(文件名带版本号)。
类型/校验词表与 packages/shared/src/artifact/types.ts 同源,改动必须两侧同步。
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# 项目根 = G:/IHUI-AI (app/tools -> app -> ai-service -> apps -> IHUI-AI)
_PROJECT_ROOT = Path(__file__).resolve().parents[4]

# 产物根目录:默认仓库根 tmp/artifacts(与 routers/artifacts.py 白名单同址);
# env IHUI_ARTIFACTS_DIR 仅供测试/部署重定向(与 STORAGE_DIR 同一惯例)。
def _artifacts_dir() -> Path:
    return Path(os.environ.get("IHUI_ARTIFACTS_DIR") or (_PROJECT_ROOT / "tmp" / "artifacts"))

# 交付物五型(与 shared DELIVERABLE_ARTIFACT_KINDS 逐字一致)
_ALLOWED_KINDS: frozenset[str] = frozenset({"html_report", "slides", "sheet", "doc", "video_ref"})
_ALLOWED_STATUSES: frozenset[str] = frozenset({"draft", "final"})

# kind → 落盘扩展名 / MIME(与 shared ARTIFACT_EXT_BY_KIND / ARTIFACT_MIME_BY_KIND 同步)
_EXT_BY_KIND: dict[str, str] = {
    "html_report": "html",
    "slides": "json",
    "sheet": "json",
    "doc": "md",
    "video_ref": "json",
}
_MIME_BY_KIND: dict[str, str] = {
    "html_report": "text/html; charset=utf-8",
    "slides": "application/json",
    "sheet": "application/json",
    "doc": "text/markdown; charset=utf-8",
    "video_ref": "application/json",
}

_UUID_RE = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)


def _now_iso() -> str:
    """UTC ISO 时间戳(带 Z 后缀,与 shared z.iso.datetime() 校验兼容)。"""
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _fail(tool: str, code: str, message: str) -> dict[str, Any]:
    return {"tool": tool, "ok": False, "errorCode": code, "message": message}


def _validate_deck(obj: Any) -> str | None:
    """slides deck 结构校验(镜像 shared slidesDeckSchema);返回错误信息或 None。"""
    if not isinstance(obj, dict) or not isinstance(obj.get("slides"), list) or not obj["slides"]:
        return "slides payload 必须是 {slides: [{title, bullets[], notes?}]} 且至少一页"
    for i, slide in enumerate(obj["slides"]):
        if not isinstance(slide, dict):
            return f"slides[{i}] 必须是对象"
        if not isinstance(slide.get("title"), str):
            return f"slides[{i}].title 必须是字符串"
        bullets = slide.get("bullets")
        if not isinstance(bullets, list) or not all(isinstance(b, str) for b in bullets):
            return f"slides[{i}].bullets 必须是字符串数组"
        if "notes" in slide and not isinstance(slide["notes"], str):
            return f"slides[{i}].notes 必须是字符串"
    return None


def _validate_sheet(obj: Any) -> str | None:
    """sheet 结构校验(镜像 shared sheetPayloadSchema);返回错误信息或 None。"""
    if not isinstance(obj, dict):
        return "sheet payload 必须是 {columns: string[], rows: cell[][]}"
    columns = obj.get("columns")
    if not isinstance(columns, list) or not columns or not all(isinstance(c, str) for c in columns):
        return "sheet.columns 必须是非空字符串数组"
    rows = obj.get("rows")
    if not isinstance(rows, list):
        return "sheet.rows 必须是数组"
    for i, row in enumerate(rows):
        if not isinstance(row, list):
            return f"rows[{i}] 必须是数组"
        for cell in row:
            # bool 是 int 子类,与 shared sheetCellSchema 同口径显式拒收
            if isinstance(cell, bool) or not isinstance(cell, (str, int, float)) and cell is not None:
                return f"rows[{i}] 含非法单元格(仅允许 string/number/null)"
    return None


def _validate_video_ref(obj: Any) -> str | None:
    if not isinstance(obj, dict) or not isinstance(obj.get("url"), str) or not obj["url"]:
        return "video_ref payload 必须是 {url: string, provider?: string}"
    if "provider" in obj and not isinstance(obj["provider"], str):
        return "video_ref.provider 必须是字符串"
    return None


def _normalize_payload(kind: str, content: str) -> tuple[str | None, Any]:
    """按 kind 校验并归一化 payload。

    返回 (错误信息, 落盘文本);错误时落盘文本为 None。
    dict 型 payload(slides/sheet/video_ref)重新序列化,保证字节稳定。
    """
    if kind in ("html_report", "doc"):
        return None, content
    try:
        obj = json.loads(content)
    except json.JSONDecodeError as exc:
        return f"{kind} 的 content 必须是合法 JSON: {exc}", None
    validator = {"slides": _validate_deck, "sheet": _validate_sheet, "video_ref": _validate_video_ref}[kind]
    err = validator(obj)
    if err:
        return err, None
    return None, json.dumps(obj, ensure_ascii=False, separators=(",", ":"))


def _payload_ref(path: Path) -> str:
    """payload 相对路径(posix,相对项目根);目录被重定向到根外时回落绝对路径。"""
    try:
        return str(path.relative_to(_PROJECT_ROOT.resolve())).replace("\\", "/")
    except ValueError:
        return str(path).replace("\\", "/")


async def _register_attachment(session_id: str, record: dict[str, Any], prev_attachment_id: str | None) -> str | None:
    """把 Artifact 元数据登记/更新为会话结构化 JSON 附件(既有 artifacts_store)。

    失败不阻断主流程(落盘记录仍是权威),返回本次 attachment_id(可为 None)。
    """
    from ..services.artifacts_store import artifacts_store

    payload = {
        "type": "file",
        "title": record["title"],
        "content": "",
        "metadata": {"deliverable": "artifact", "artifact": record},
    }
    try:
        if prev_attachment_id:
            res = await artifacts_store.update(session_id, prev_attachment_id, {"title": payload["title"], "metadata": payload["metadata"]})
            if res.get("ok"):
                return prev_attachment_id
            logger.warning("create_artifact 附件更新失败(改用新增): %s", res.get("errorCode"))
        res = await artifacts_store.add(session_id, payload)
        if res.get("ok"):
            return str(res.get("artifact_id"))
        logger.warning("create_artifact 附件登记失败: %s", res.get("errorCode"))
    except Exception:  # noqa: BLE001 - 附件面是旁路,绝不把主流程带崩
        logger.exception("create_artifact 附件登记未预期异常")
    return None


async def create_artifact(arguments: dict[str, Any]) -> dict[str, Any]:
    """创建/更新交付物 Artifact(工具调用入口;异常自兜底,不抛给 MCP 层)。

    输入(LLM 可控):
        kind:        html_report | slides | sheet | doc | video_ref
        title:       产物标题(非空)
        content:     payload 正文(html_report=自包含 HTML;doc=Markdown;
                     slides/sheet/video_ref=对应 JSON 字符串)
        message_id:  源转录锚点消息 id(必填)
        anchor_index: 锚点序号(可选,非负整数)
        status:      draft(默认)| final
        artifact_id: 更新既有产物时传入(其 version+1,旧版 payload 保留)

    输入(宿主注入,LLM 不可控):__user_id / __session_id(call_tool 覆盖写入)。

    返回:成功 {"tool","ok":True,"artifact":{...},"message"};失败带 errorCode。
    """
    tool_name = "create_artifact"
    try:
        if not isinstance(arguments, dict):
            return _fail(tool_name, "INVALID_ARGS", "arguments 必须为 dict")

        kind = arguments.get("kind")
        if not isinstance(kind, str) or kind not in _ALLOWED_KINDS:
            return _fail(tool_name, "INVALID_KIND", f"kind 非法,仅支持: {sorted(_ALLOWED_KINDS)}")
        title = arguments.get("title")
        if not isinstance(title, str) or not title.strip():
            return _fail(tool_name, "MISSING_TITLE", "title 必填且不能为空")
        title = title.strip()
        content = arguments.get("content")
        if not isinstance(content, str) or not content.strip():
            return _fail(tool_name, "MISSING_CONTENT", "content 必填且不能为空")
        message_id = arguments.get("message_id")
        if not isinstance(message_id, str) or not message_id.strip():
            return _fail(tool_name, "MISSING_ANCHOR", "message_id 必填(源转录锚点)")
        anchor_index = arguments.get("anchor_index")
        if anchor_index is not None and (not isinstance(anchor_index, int) or isinstance(anchor_index, bool) or anchor_index < 0):
            return _fail(tool_name, "INVALID_ANCHOR_INDEX", "anchor_index 必须是非负整数")
        status = arguments.get("status", "draft")
        if status not in _ALLOWED_STATUSES:
            return _fail(tool_name, "INVALID_STATUS", f"status 仅支持: {sorted(_ALLOWED_STATUSES)}")
        session_id = str(arguments.get("__session_id") or "").strip()
        if not session_id:
            return _fail(tool_name, "MISSING_SESSION", "缺少宿主注入的 __session_id(产物必须挂在会话上)")
        user_id = str(arguments.get("__user_id") or "").strip()

        artifact_id = arguments.get("artifact_id")
        prev_record: dict[str, Any] | None = None
        if artifact_id is not None:
            if not isinstance(artifact_id, str) or not _UUID_RE.match(artifact_id):
                return _fail(tool_name, "INVALID_ARTIFACT_ID", "artifact_id 必须是合法 UUID")
            prev_file = _artifacts_dir() / artifact_id / "artifact.json"
            if not prev_file.is_file():
                return _fail(tool_name, "NOT_FOUND", f"待更新的产物不存在: {artifact_id}")
            try:
                prev_record = json.loads(prev_file.read_text(encoding="utf-8"))
            except (OSError, ValueError) as exc:
                return _fail(tool_name, "CORRUPTED_RECORD", f"既有产物记录不可读: {exc}")
            if not isinstance(prev_record, dict) or prev_record.get("session_id") != session_id:
                # 跨会话更新一律拒绝(锚定产物不随会话迁移)
                return _fail(tool_name, "NOT_FOUND", "产物不属于当前会话")
            if prev_record.get("kind") != kind:
                return _fail(tool_name, "KIND_MISMATCH", "更新不允许变更 kind")
        else:
            artifact_id = str(uuid.uuid4())

        err, payload_text = _normalize_payload(kind, content)
        if err:
            return _fail(tool_name, "INVALID_PAYLOAD", err)
        assert payload_text is not None

        version = int(prev_record.get("version", 0)) + 1 if prev_record else 1
        ext = _EXT_BY_KIND[kind]
        art_dir = _artifacts_dir() / artifact_id
        art_dir.mkdir(parents=True, exist_ok=True)
        payload_path = art_dir / f"v{version}.{ext}"
        data = payload_text.encode("utf-8")
        payload_path.write_bytes(data)

        # 归属 sidecar:与 generate_chart 同一契约(<payload>.owner),
        # routers/artifacts.py 的 token 签发校验直接适用 html_report 预览。
        sidecar = Path(str(payload_path) + ".owner")
        sidecar.write_text(json.dumps({"user_id": user_id}, ensure_ascii=False), encoding="utf-8")
        owner_file = art_dir / "owner.json"
        owner_file.write_text(
            json.dumps({"user_id": user_id, "session_id": session_id}, ensure_ascii=False),
            encoding="utf-8",
        )

        now = _now_iso()
        record: dict[str, Any] = {
            "id": artifact_id,
            "kind": kind,
            "title": title,
            "version": version,
            "session_id": session_id,
            "turn_anchor": {"message_id": message_id.strip(), **({"index": anchor_index} if anchor_index is not None else {})},
            "payload_ref": _payload_ref(payload_path),
            "mime": _MIME_BY_KIND[kind],
            "size_bytes": len(data),
            "checksum": hashlib.sha256(data).hexdigest(),
            "created_at": prev_record.get("created_at", now) if prev_record else now,
            "updated_at": now,
            "status": status,
        }

        attachment_id = await _register_attachment(
            session_id,
            record,
            prev_record.get("attachment_id") if prev_record else None,
        )
        if attachment_id:
            record["attachment_id"] = attachment_id

        (art_dir / "artifact.json").write_text(
            json.dumps(record, ensure_ascii=False, indent=2), encoding="utf-8"
        )

        logger.info("Artifact 已%s: %s v%d", "更新" if prev_record else "创建", artifact_id, version)
        return {
            "tool": tool_name,
            "ok": True,
            "artifact": record,
            "message": f"产物已{'更新' if prev_record else '创建'}(v{version})",
        }
    except Exception as exc:  # 兜底:绝不向上层抛异常(与 generate_chart 同一纪律)
        logger.exception("create_artifact 未预期异常")
        return _fail(tool_name, "INTERNAL_ERROR", f"产物创建失败: {exc}")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
