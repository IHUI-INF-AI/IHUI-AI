# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""外部运行时导入路由(挂载在 /api/v1/ai/external-import 前缀;2026-10-31 立)。

对齐 Qoder「导入数据」4 维命名空间(sessions/automations/capabilities/memory),
逐维出口与让位语义见 external_runtime_import.py 头注。

身份纪律(与 codebase 检索同一条,不另设规则):user_id 只取 X-User-Id 头
(内部服务通道)或 Bearer JWT 的主体链;请求体不带 user_id 形状 ——
身份不得住客户端可整写字段(AGENTS.md §5)。
"""

from __future__ import annotations

import re
from typing import Any

from fastapi import APIRouter, Header
from pydantic import BaseModel, Field

from ...services.external_runtime_import import apply_bundle, parse_external_bundle

router = APIRouter()

_USER_ID_RE = re.compile(r"^[a-zA-Z0-9-]{1,128}$")


class ImportBundleRequest(BaseModel):
    """外部运行时导出包(spec v1,形状见 external_runtime_import 头注)。"""

    bundle: dict[str, Any] = Field(..., description="外部工具导出的 4 维 bundle")
    sessionId: str | None = Field(default=None, max_length=128)


@router.post("/bundle")
async def import_bundle(
    req: ImportBundleRequest,
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    """导入一个外部运行时 bundle(memory/automations 两维真写,capabilities 声明,sessions 让位)。"""
    # 身份链:只认内部通道 X-User-Id(经 internal_ticket 中间件注入,LLM 不可控);
    # Bearer JWT 的主体裁决在 api 侧,本端点不从 JWT 自行解主体(§5:身份不得
    # 从客户端可整写面反推)。import authorization 仅防未用形参告警。
    _ = authorization
    user_id = x_user_id
    if not user_id or not _USER_ID_RE.fullmatch(user_id):
        return {
            "code": 401,
            "message": "无法确定调用者身份:导入产物必须归属到人(内部通道 X-User-Id)",
            "data": None,
        }
    parsed = parse_external_bundle(req.bundle)
    outcome = await apply_bundle(parsed, user_id, session_id=req.sessionId)
    return {"code": 0, "message": "ok", "data": outcome}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
