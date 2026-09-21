# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""会话文件导入解析路由(api-service 转发入口)。

- POST /api/session-import/parse  multipart 上传 Claude Code / Codex / Cursor / Aider
  的会话导出文件,调用 app.services.importers.parse_conversation_file 解析为统一 IR。

错误映射(与 image_edit/publish 等上传路由惯例一致):
- 扩展名不在白名单 / source 非法(ValueError)→ 400
- 文件超过 20MiB → 413
- 解析器意外异常 → 500

认证:沿用 voice_stt / image_edit 等 multipart 上传路由惯例,不挂 per-route
Depends,由 main.py 全局 JWTAuthMiddleware 校验 api 端透传的用户 JWT。
"""
from __future__ import annotations

import logging
import os
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

logger = logging.getLogger(__name__)

router = APIRouter()

# 允许的会话导出文件后缀(jsonl/json 导出、md 纯文本、sqlite/db/vscdb 会话库)
_ALLOWED_EXTENSIONS = {".jsonl", ".json", ".md", ".sqlite", ".db", ".vscdb"}
# 上传体积上限 20MiB
_MAX_UPLOAD_BYTES = 20 * 1024 * 1024


@router.post("/session-import/parse")
async def parse_session_import(
    file: UploadFile = File(..., description="会话导出文件(jsonl/json/md/sqlite/db/vscdb)"),
    source: str = Form(..., description="数据源: claude_code/codex/cursor/aider"),
) -> dict[str, Any]:
    """解析会话导出文件为统一 IR(路径钉死 /api/session-import/parse)。"""
    filename = file.filename or ""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in _ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"不支持的文件类型: {ext or '(无后缀)'}"
                f"(允许: {', '.join(sorted(_ALLOWED_EXTENSIONS))})"
            ),
        )
    data = await file.read()
    if len(data) > _MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"file too large: {len(data)} bytes > max {_MAX_UPLOAD_BYTES} bytes (20MiB)",
        )

    # 函数内惰性导入:importers 包由独立任务实现,缺失时不阻塞应用启动(同 image_edit 风格)
    from app.services.importers import parse_conversation_file

    try:
        parsed, warnings, truncated = parse_conversation_file(source, filename, data)
    except ValueError as e:
        logger.info("[session-import] 非法请求(source=%s, file=%s): %s", source, filename, e)
        raise HTTPException(status_code=400, detail=str(e)) from None
    except Exception as e:  # noqa: BLE001
        logger.exception("[session-import] 解析异常(source=%s, file=%s): %s", source, filename, e)
        raise HTTPException(status_code=500, detail=f"会话导入解析异常: {e}") from e
    return {
        "conversations": parsed.get("conversations", []),
        "truncated": truncated,
        "warnings": warnings,
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
