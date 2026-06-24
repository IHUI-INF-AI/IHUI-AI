"""外呼回调 - 外部系统回调处理 + 大模型意向判断.

迁移自 coze_zhs_py/api/outbound.py.
"""

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Body, HTTPException, Request
from loguru import logger
from pydantic import BaseModel, Field
from sqlalchemy import BigInteger, Column, Index, Integer, String, Text

from app.database import Base, get_session
from app.models.base import TimestampMixin
from app.schemas.common import error, success


class CallBackLog(TimestampMixin, Base):
    """外呼回调日志"""

    __tablename__ = "callback_log"
    __table_args__ = (
        Index("idx_cbl_biz", "biz_type"),
        Index("idx_cbl_time", "created_at"),
        {"extend_existing": True},
    )
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    biz_type = Column(String(50), nullable=False, comment="业务类型: call/sms/payment/...")
    biz_id = Column(String(64), nullable=True, comment="业务ID")
    source = Column(String(50), nullable=True, comment="来源系统")
    request_body = Column(Text, nullable=True, comment="请求体")
    response_body = Column(Text, nullable=True, comment="响应体")
    status = Column(Integer, default=1, comment="0=失败 1=成功")
    error_msg = Column(String(500), nullable=True)
    ip = Column(String(50), nullable=True)
    process_time = Column(Integer, default=0, comment="处理耗时(毫秒)")


router = APIRouter()


@router.post("/call", summary="外呼回调")
async def call_callback(
    request: Request,
    biz_id: str | None = None,
    biz_type: str = "call",
    source: str | None = None,
    payload: dict = Body(default_factory=dict, embed=True),
):
    with get_session() as db:
        try:
            start = datetime.utcnow()
            body = await request.body()
            ip = request.client.host if request.client else None
            log = CallBackLog(
                biz_type=biz_type,
                biz_id=biz_id,
                source=source,
                request_body=body.decode("utf-8") if body else "",
                status=1,
                ip=ip,
            )
            db.add(log)
            db.flush()
            log.response_body = '{"code":0,"message":"ok"}'
            log.process_time = int((datetime.utcnow() - start).total_seconds() * 1000)
            return success({"callback_id": log.id})
        except Exception as e:
            logger.error(f"call callback error: {e}")
            return error(str(e))


@router.post("/sms", summary="短信回调")
async def sms_callback(
    request: Request, biz_id: str | None = None, payload: dict = Body(default_factory=dict, embed=True)
):
    return await call_callback(request, biz_id=biz_id, biz_type="sms", source="sms", payload=payload)


@router.post("/payment", summary="支付回调")
async def payment_callback(
    request: Request, biz_id: str | None = None, payload: dict = Body(default_factory=dict, embed=True)
):
    return await call_callback(request, biz_id=biz_id, biz_type="payment", source="payment", payload=payload)


@router.get("/log/list", operation_id="callback_log_list", summary="回调日志")
async def log_list(
    page: int = 1,
    limit: int = 20,
    biz_type: str | None = None,
    source: str | None = None,
    status: int | None = None,
):
    with get_session() as db:
        try:
            q = db.query(CallBackLog)
            if biz_type:
                q = q.filter(CallBackLog.biz_type == biz_type)
            if source:
                q = q.filter(CallBackLog.source == source)
            if status is not None:
                q = q.filter(CallBackLog.status == status)
            total = q.count()
            items = q.order_by(CallBackLog.id.desc()).offset((page - 1) * limit).limit(limit).all()
            return success(
                [
                    {
                        "id": l.id,
                        "biz_type": l.biz_type,
                        "biz_id": l.biz_id,
                        "source": l.source,
                        "status": l.status,
                        "error_msg": l.error_msg,
                        "ip": l.ip,
                        "process_time": l.process_time,
                        "create_time": l.created_at.isoformat() if l.created_at else None,
                    }
                    for l in items
                ],
                total=total,
            )
        except Exception as e:
            logger.error(f"callback log error: {e}")
            return error(str(e))


@router.get("/log/{lid}", summary="回调详情")
async def log_detail(lid: int):
    with get_session() as db:
        try:
            l = db.query(CallBackLog).filter(CallBackLog.id == lid).first()
            if not l:
                return error("日志不存在", "404")
            return success(
                {
                    "id": l.id,
                    "biz_type": l.biz_type,
                    "biz_id": l.biz_id,
                    "source": l.source,
                    "request_body": l.request_body,
                    "response_body": l.response_body,
                    "status": l.status,
                    "error_msg": l.error_msg,
                    "ip": l.ip,
                    "process_time": l.process_time,
                    "create_time": l.created_at.isoformat() if l.created_at else None,
                }
            )
        except Exception as e:
            logger.error(f"callback log detail error: {e}")
            return error(str(e))


# ---------------------------------------------------------------------------
# 外呼回调 - 大模型意向判断 (迁移自 coze_zhs_py/api/outbound.py)
# ---------------------------------------------------------------------------


class OutboundCallbackRequest(BaseModel):
    """外呼回调请求"""

    user_input: str = Field(..., description="用户输入内容")
    model_id: str = Field(..., description="模型ID")
    user_uuid: str | None = Field("", description="用户UUID, 可选")
    phone: str | None = Field("", description="用户电话号码, 可选")
    call_id: str | None = Field("", description="通话ID, 可选")
    custom_prompt: str | None = Field("", description="自定义提示词, 可选")


class OutboundCallbackResponse(BaseModel):
    """外呼回调响应"""

    answer: str = Field(..., description="大模型生成的回答")
    action: str = Field(..., description="后续动作: continue/transfer/end")
    transfer_number: str | None = Field("", description="转接号码, 仅 action=transfer 时有效")
    intent: str | None = Field("", description="用户意向: 高意向/普通/低意向")


# 意向关键词
HIGH_INTENT_KEYWORDS = ["价格", "购买", "演示", "试用", "合作", "签约", "方案", "报价"]
LOW_INTENT_KEYWORDS = ["不需要", "不感兴趣", "再见", "挂断", "勿扰"]


def _analyze_intent(user_input: str) -> str:
    """分析用户意向, 返回 高意向/普通/低意向."""
    text_lower = user_input.lower()
    for kw in HIGH_INTENT_KEYWORDS:
        if kw in text_lower:
            return "高意向"
    for kw in LOW_INTENT_KEYWORDS:
        if kw in text_lower:
            return "低意向"
    return "普通"


def _determine_action(intent: str, cfg: dict[str, Any]) -> tuple[str, str]:
    """根据意向决定后续动作, 返回 (action, transfer_number)."""
    transfer_number = cfg.get("transfer_number", "")
    if intent == "高意向":
        return "transfer", transfer_number
    if intent == "低意向":
        return "end", ""
    return "continue", ""


@router.post("/outbound/callback", summary="外呼回调接口(大模型意向判断)")
async def outbound_callback(req: OutboundCallbackRequest):
    """接收外呼系统回调, 调用大模型生成回复, 并判断用户意向.

    功能:
    1. 接收外呼系统的用户输入
    2. 调用大模型生成回复
    3. 判断用户意向(高意向/普通/低意向)
    4. 返回回复和后续动作(继续/转接/结束)
    """
    try:
        # 验证用户 token (如果提供了 user_uuid)
        if req.user_uuid:
            from app.services.token_utils_service import check_user_token_sufficient

            token_check = await check_user_token_sufficient(req.user_uuid, min_tokens=1000)
            if not token_check.get("sufficient"):
                raise HTTPException(
                    status_code=402,
                    detail=token_check.get("reason", "Token余额不足"),
                )

        # 获取模型配置
        from app.api.v1.llm.ws import get_effective_config, stream_llm

        cfg = get_effective_config(req.model_id, None)
        if not cfg:
            raise HTTPException(status_code=404, detail="模型不存在")

        # 构建提示词
        system_prompt = req.custom_prompt or "你是一个专业的客服助手，负责回答用户咨询。"
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": req.user_input},
        ]

        logger.info(
            f"[Outbound] 收到外呼回调: call_id={req.call_id}, "
            f"phone={req.phone}, user_input={req.user_input[:50]}..."
        )

        # 调用大模型 (收集完整回答)
        full_response = ""
        async for chunk in stream_llm(cfg, messages):
            if isinstance(chunk, dict):
                kind = chunk.get("kind", "")
                content = chunk.get("content", "")
                if kind == "answer":
                    full_response += content

        answer = full_response.strip()
        if not answer:
            raise HTTPException(status_code=500, detail="大模型未返回有效回答")

        # 判断用户意向
        intent = _analyze_intent(req.user_input)

        # 根据意向决定后续动作
        action, transfer_number = _determine_action(intent, cfg)

        logger.info(
            f"[Outbound] 生成回复: answer={answer[:50]}..., "
            f"intent={intent}, action={action}"
        )

        return OutboundCallbackResponse(
            answer=answer,
            action=action,
            transfer_number=transfer_number,
            intent=intent,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Outbound] 处理外呼回调异常: {e}")
        raise HTTPException(status_code=500, detail=f"处理失败: {e}")
