"""Payment schemas."""

from datetime import datetime

from pydantic import BaseModel


class OrderCreate(BaseModel):
    product_id: str | None = None
    order_type: int = 0
    amount: int = 0
    pay_type: str = "wechat"
    activity_id: str | None = None
    product_identity_id: str | None = None


class OrderOut(BaseModel):
    id: int
    user_id: str | None = None
    out_trade_no: str | None = None
    amount: int | None = None
    status: int | None = None
    payment_status: int | None = None
    pay_type: str | None = None
    created_at: datetime | None = None
    model_config = {"from_attributes": True}


class WechatPayRequest(BaseModel):
    out_trade_no: str
    total_amount: int
    description: str = "ZHS Token Recharge"
    open_id: str | None = None


class AlipayRequest(BaseModel):
    out_trade_no: str
    total_amount: float
    subject: str = "ZHS Token Recharge"
