# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""D31 设计稿转码 API 路由(挂载在 /api 前缀,注册行移交主会话,见交付报告)。

端点:
- POST /api/figma/transcode   提交转码(fileKey+nodeId 或粘贴 figmaUrl)→ taskId
- GET  /api/figma/tasks/{taskId}  查询任务状态与产物

鉴权(沿用既有 JWT 依赖,不新造第二套身份判定):
- 两个端点都经 `require_request_user_id`(app/core/jwt_auth.py)解析令牌主体;
- 任务记录写入归属主体,GET 时归属不符即 403 —— 本路由**不接收** user_id 请求参数,
  "是谁"只由令牌决定,结构上杜绝守门 117 那型"认证≠授权"(参数自报身份覆盖主体)。

响应统一 {code, message, data} 格式(code=0 成功)。
Figma 令牌缺失 fail-closed:POST 直接返回 code=412 + errorCode=FIGMA_TOKEN_MISSING,
不创建任务、不产出任何模拟数据。
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from ..core.jwt_auth import DEV_ANONYMOUS_PRINCIPAL, require_request_user_id
from ..services.figma_transcoder import (
    FigmaTranscodeError,
    get_task,
    normalize_node_id,
    parse_figma_url,
    resolve_figma_token,
    start_transcode_task,
)

router = APIRouter()


class FigmaTranscodeRequest(BaseModel):
    """转码请求:figmaUrl 与 (fileKey+nodeId) 二选一,URL 优先。刻意无 user_id 字段。"""

    model_config = ConfigDict(populate_by_name=True)

    figma_url: str | None = Field(None, alias="figmaUrl", description="粘贴的 Figma 设计稿 URL(含 node-id 参数)")
    file_key: str | None = Field(None, alias="fileKey", description="Figma file key")
    node_id: str | None = Field(None, alias="nodeId", description="Figma 节点 id,形如 123:456 或 123-456")
    extra_requirements: str | None = Field(None, alias="extraRequirements", description="附加给模型的补充需求(可选)")


def _fail(code: int, message: str, error_code: str) -> dict[str, Any]:
    return {"code": code, "message": message, "errorCode": error_code, "data": None}


def _resolve_targets(req: FigmaTranscodeRequest) -> tuple[str, str]:
    """入参归一:url 优先;两路都拿不到合法 (fileKey, nodeId) 即抛 FIGMA_NODE_ID_INVALID。"""
    if req.figma_url:
        file_key, node_id = parse_figma_url(req.figma_url)
        if not node_id:
            raise FigmaTranscodeError(
                "FIGMA_NODE_ID_INVALID",
                "Figma URL 未携带 node-id 参数 —— 请在 URL 里带上要转码的帧(Select frame 后复制 link)",
            )
        return file_key, node_id
    if req.file_key:
        if not req.node_id:
            raise FigmaTranscodeError("FIGMA_NODE_ID_INVALID", "fileKey 路径必须同时提供 nodeId")
        return req.file_key.strip(), normalize_node_id(req.node_id)
    raise FigmaTranscodeError("FIGMA_NODE_ID_INVALID", "必须提供 figmaUrl 或 fileKey+nodeId")


@router.post("/figma/transcode")
async def submit_transcode(
    req: FigmaTranscodeRequest,
    principal: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """提交转码任务:先做入参与令牌两项 fail-closed 校验,再异步起跑。"""
    try:
        file_key, node_id = _resolve_targets(req)
    except FigmaTranscodeError as e:
        return _fail(400, e.message, e.code)
    try:
        resolve_figma_token()
    except FigmaTranscodeError as e:
        # fail-closed:没有 Figma 令牌就不接受任务 —— 排队后失败与立即失败相比,
        # 立即失败让调用方拿得到确定结论,不产生"任务在跑其实必挂"的第三种状态。
        return _fail(412, e.message, e.code)
    task = start_transcode_task(principal, file_key, node_id, extra_requirements=req.extra_requirements)
    return {"code": 0, "message": "ok", "data": task.to_public()}


@router.get("/figma/tasks/{task_id}")
async def get_transcode_task(
    task_id: str,
    principal: str = Depends(require_request_user_id),
) -> dict[str, Any]:
    """查询任务状态。归属不符 → 403(与 memory.py 同一收口形态:归属只认令牌主体)。"""
    task = get_task(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="转码任务不存在或已过期")
    # require_request_user_id 只在"本进程根本没启用 JWT 校验"时回落 DEV 单一租户;
    # 真实主体下,任务归属必须逐字等于令牌主体。
    if principal != DEV_ANONYMOUS_PRINCIPAL and task.user_id != principal:
        raise HTTPException(status_code=403, detail="无权查看他人的转码任务")
    return {"code": 0, "message": "ok", "data": task.to_public()}
