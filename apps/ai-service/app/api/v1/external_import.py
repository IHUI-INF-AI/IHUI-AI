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

from fastapi import APIRouter, Request
from pydantic import BaseModel, Field

from ...core.inbound_identity import resolve_inbound_actor
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
    request: Request,
) -> dict[str, Any]:
    """导入一个外部运行时 bundle(memory/automations 两维真写,capabilities 声明,sessions 让位)。"""
    # 身份链(2026-11-01 安全强化):主体只经 inbound_identity 这一份出口取 ——
    # 已验签内网头的签名载荷 sub,或已验签 JWT 的主体。原实现读 `Header(alias="X-User-Id")`
    # 的字面值并注释称"经 internal_ticket 中间件注入":本进程从无此注入,那枚头就是客户端
    # 可整写字段,任何登录用户带 `X-User-Id: <受害者 uuid>` 即可把导入产物写成他人归属
    # (AGENTS §5「身份不得住客户端可整写字段」)。形状校验保留,但作用在已验证主体上。
    user_id = resolve_inbound_actor(request)
    if not user_id or not _USER_ID_RE.fullmatch(user_id):
        return {
            "code": 401,
            "message": "无法确定调用者身份:导入产物必须归属到已验签的主体",
            "data": None,
        }
    parsed = parse_external_bundle(req.bundle)
    outcome = await apply_bundle(parsed, user_id, session_id=req.sessionId)
    return {"code": 0, "message": "ok", "data": outcome}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
