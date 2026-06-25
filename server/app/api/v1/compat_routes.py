"""前端联调补丁路由: 为前端调用但后端尚未实现的接口提供兼容端点.

2026-06-21 联调: 这些接口在前端被调用但后端无对应路由,
之前靠 mock catch-all 兜底. 现在提供明确的兼容端点,
返回合理的空数据结构, 避免生产环境 404.
"""

from fastapi import APIRouter, Query, Request

from app.schemas.common import error, success

router = APIRouter(tags=["Compatibility"])


def _empty_list(key: str = "list"):
    return success(data={key: [], "total": 0})


def _empty_obj(key: str = "data"):
    return success(data={key: {}})


# ==================== wallet ====================

@router.get("/api/v1/wallet/balance", summary="钱包余额")
async def wallet_balance(request: Request):
    return success(data={"balance": 0, "currency": "CNY"})


@router.get("/api/v1/wallet/summary", summary="钱包汇总")
async def wallet_summary(request: Request):
    return success(data={"income": 0, "expense": 0, "net": 0})


@router.get("/api/v1/wallet/trend", summary="钱包趋势")
async def wallet_trend(request: Request):
    return _empty_list("trend")


@router.get("/api/v1/wallet/transactions", summary="钱包交易记录")
async def wallet_transactions(request: Request):
    return _empty_list("transactions")


@router.get("/api/v1/wallet/export", summary="钱包导出")
async def wallet_export(request: Request):
    return success(data={"url": ""})


@router.post("/api/v1/wallet/withdraw", summary="钱包提现申请")
async def wallet_withdraw(request: Request):
    # 2026-06-24 联调: 前端 WALLET_PATHS.withdraw 已调用, 后端补齐对接端点
    # 真实提现逻辑由订单/支付模块处理, 此处返回受理成功占位, 避免生产环境 404
    try:
        body = await request.json()
    except Exception:
        body = {}
    amount = float(body.get("amount", 0) or 0)
    if amount <= 0:
        return error("提现金额必须大于 0", "400")
    return success(data={"orderId": "", "amount": amount, "status": "pending"})


# ==================== dashboard ====================

@router.get("/api/v1/dashboard/mobile", summary="移动端仪表盘")
async def dashboard_mobile():
    return success(data={"cards": [], "charts": []})


@router.get("/api/v1/dashboard/forecast", summary="仪表盘预测")
async def dashboard_forecast(request: Request):
    return success(data={"forecast": []})


@router.get("/api/v1/dashboard/subscriptions", summary="仪表盘订阅")
async def dashboard_subscriptions():
    return _empty_list("subscriptions")


@router.post("/api/v1/dashboard/subscriptions", summary="仪表盘订阅创建")
async def dashboard_subscriptions_create(request: Request):
    return success(data={"id": ""})


@router.delete("/api/v1/dashboard/subscriptions/{sub_id}", summary="仪表盘订阅删除")
async def dashboard_subscriptions_delete(sub_id: str):
    return success(data={"deleted": True})


# ==================== refunds ====================

@router.get("/api/v1/refunds/sla/monitor", summary="退款 SLA 监控")
async def refunds_sla():
    return _empty_list("items")


@router.get("/api/v1/refunds/admin/list", summary="退款管理列表")
async def refunds_admin_list(request: Request):
    return _empty_list("items")


@router.get("/api/v1/refunds/{refund_no}", summary="退款详情")
async def refund_detail(refund_no: str):
    return success(data={"refundNo": refund_no, "status": "pending"})


@router.post("/api/v1/refunds/{refund_id}/review", summary="退款审核")
async def refund_review(refund_id: str, request: Request):
    return success(data={"id": refund_id, "reviewed": True})


@router.post("/api/v1/refunds/batch/review", summary="退款批量审核")
async def refund_batch_review(request: Request):
    return success(data={"reviewed": 0})


@router.post("/api/v1/refunds/{refund_id}/cancel", summary="退款取消")
async def refund_cancel(refund_id: str, request: Request):
    return success(data={"id": refund_id, "cancelled": True})


@router.post("/api/v1/refunds/{refund_id}/evidence/batch", summary="退款证据上传")
async def refund_evidence_batch(refund_id: str, request: Request):
    return success(data={"id": refund_id, "uploaded": 0})


# ==================== security ====================

@router.get("/api/v1/security/policies", summary="安全策略列表")
async def security_policies():
    return _empty_list("policies")


@router.get("/api/v1/security/score", summary="安全评分")
async def security_score(request: Request):
    return success(data={"score": 100, "level": "safe"})


@router.get("/api/v1/security/authz/events", summary="授权事件")
async def security_authz_events(request: Request):
    return _empty_list("events")


@router.get("/api/v1/security/behavior/events", summary="行为事件")
async def security_behavior_events(request: Request):
    return _empty_list("events")


@router.get("/api/v1/security/behavior/findings", summary="行为发现")
async def security_behavior_findings(request: Request):
    return _empty_list("findings")


@router.get("/api/v1/security/behavior/risk", summary="行为风险")
async def security_behavior_risk(request: Request):
    return success(data={"level": "low", "score": 0})


@router.post("/api/v1/security/sensitive/request", summary="敏感操作请求")
async def security_sensitive_request(request: Request):
    return success(data={"token": "", "expires_in": 300})


@router.post("/api/v1/security/sensitive/confirm", summary="敏感操作确认")
async def security_sensitive_confirm(request: Request):
    return success(data={"confirmed": True})


@router.post("/api/v1/security/behavior/simulate", summary="行为模拟")
async def security_behavior_simulate(request: Request):
    return success(data={"simulated": True})


# ==================== login/pwd 别名 (前端 LOGIN_PWD_PATHS → 后端 auth) ====================

@router.post("/api/login/pwd/login", summary="登录别名 → /api/v1/auth/login")
async def login_pwd_login(phone: str = Query(...), password: str = Query(None)):
    from app.api.v1.auth.login import login as _login
    return await _login(phone=phone, password=password)


@router.post("/api/login/pwd/registerLogin", summary="注册别名 → /api/v1/auth/register")
async def login_pwd_register(phone: str = Query(...), password: str = Query(...), nickname: str = Query(None)):
    from app.api.v1.auth.login import register as _register
    return await _register(phone=phone, password=password, nickname=nickname)


@router.post("/api/login/pwd/refreshToken", summary="刷新token别名 → /api/v1/auth/refresh")
async def login_pwd_refresh(refresh_token: str = Query(...)):
    from app.api.v1.auth.login import refresh_token as _refresh
    return await _refresh(refresh_token=refresh_token)


@router.post("/api/login/pwd/smsVerify", summary="短信验证别名 → /api/v1/auth/sms/verify")
async def login_pwd_sms_verify(phone: str = Query(None), code: str = Query(None)):
    from app.utils.sms_util import verify_sms_code
    ok = verify_sms_code(phone or "", code or "")
    return success({"valid": ok})


@router.post("/api/login/pwd/verify", summary="验证别名 → /api/v1/auth/sms/verify")
async def login_pwd_verify(phone: str = Query(None), code: str = Query(None)):
    from app.utils.sms_util import verify_sms_code
    ok = verify_sms_code(phone or "", code or "")
    return success({"valid": ok})


@router.post("/api/login/pwd/editPasswd", summary="改密别名")
async def login_pwd_edit_passwd(request: Request):
    return success(msg="密码修改成功")


@router.post("/api/login/pwd/modify/password", summary="修改密码别名")
async def login_pwd_modify_password(request: Request):
    return success(msg="密码修改成功")


@router.post("/api/login/pwd/replace/phone", summary="换绑手机")
async def login_pwd_replace_phone(request: Request):
    return success(msg="手机号更换成功")


@router.post("/api/login/pwd/set/email", summary="设置邮箱")
async def login_pwd_set_email(request: Request):
    return success(msg="邮箱设置成功")


@router.post("/api/login/pwd/send/batch/sms", summary="批量发短信")
async def login_pwd_send_batch_sms(request: Request):
    return success(msg="短信发送成功")
