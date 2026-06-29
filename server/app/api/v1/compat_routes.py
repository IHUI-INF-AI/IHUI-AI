"""前端联调补丁路由: 为前端调用但后端尚未实现的接口提供兼容端点.

2026-06-21 联调: 这些接口在前端被调用但后端无对应路由,
之前靠 mock catch-all 兜底. 现在提供明确的兼容端点,
返回合理的空数据结构, 避免生产环境 404.

=== 占位状态清单 (2026-06-29 收尾核查) ===

以下端点为占位实现, 返回空数据以避免前端崩溃, 待后端真实实现后替换:

[i18n-v2] 全系列占位 (待实现真实 i18n 管理后台):
  - GET  /api/v1/i18n-v2/keys            (languages 返回真实数据, 其余占位)
  - GET  /api/v1/i18n-v2/entry/{key}
  - GET  /api/v1/i18n-v2/pull
  - GET  /api/v1/i18n-v2/export
  - GET  /api/v1/i18n-v2/stats
  - GET  /api/v1/i18n-v2/sync-log
  - GET  /api/v1/i18n-v2/diff
  - GET  /api/v1/i18n-v2/plural/{key}
  - GET  /api/v1/i18n-v2/tm/stats
  - GET  /api/v1/i18n-v2/mt/queue
  - POST /api/v1/i18n-v2/push
  - POST /api/v1/i18n-v2/push-plural
  - POST /api/v1/i18n-v2/format
  - POST /api/v1/i18n-v2/translate
  - POST /api/v1/i18n-v2/tm/search
  - POST /api/v1/i18n-v2/mt/translate
  - POST /api/v1/i18n-v2/mt/review

[wallet] 全系列占位 (待接入真实钱包服务):
  - GET /api/v1/wallet/balance
  - GET /api/v1/wallet/summary
  - GET /api/v1/wallet/trend
  - GET /api/v1/wallet/transactions
  - GET /api/v1/wallet/export

[dashboard] 全系列占位 (待接入真实仪表盘数据):
  - GET  /api/v1/dashboard/mobile
  - GET  /api/v1/dashboard/forecast
  - GET  /api/v1/dashboard/subscriptions
  - POST /api/v1/dashboard/subscriptions
  - DEL  /api/v1/dashboard/subscriptions/{sub_id}

[refunds] 全系列占位 (待接入真实退款流程):
  - GET  /api/v1/refunds/sla/monitor
  - GET  /api/v1/refunds/admin/list
  - GET  /api/v1/refunds/{refund_no}
  - POST /api/v1/refunds/{refund_id}/review
  - POST /api/v1/refunds/batch/review
  - POST /api/v1/refunds/{refund_id}/cancel
  - POST /api/v1/refunds/{refund_id}/evidence/batch

[security] 全系列占位 (待接入真实安全审计服务):
  - GET  /api/v1/security/policies
  - GET  /api/v1/security/score
  - GET  /api/v1/security/authz/events
  - GET  /api/v1/security/behavior/events
  - GET  /api/v1/security/behavior/findings
  - GET  /api/v1/security/behavior/risk
  - POST /api/v1/security/sensitive/request
  - POST /api/v1/security/sensitive/confirm
  - POST /api/v1/security/behavior/simulate

以下端点为真实转发 (非占位, 已接入后端 auth/sms 服务):
  - POST /api/login/pwd/login          → /api/v1/auth/login
  - POST /api/login/pwd/registerLogin  → /api/v1/auth/register
  - POST /api/login/pwd/refreshToken    → /api/v1/auth/refresh
  - POST /api/login/pwd/smsVerify       → verify_sms_code
  - POST /api/login/pwd/verify          → verify_sms_code
"""

from fastapi import APIRouter, Query, Request

from app.schemas.common import success

router = APIRouter(tags=["Compatibility"])


def _empty_list(key: str = "list"):
    return success(data={key: [], "total": 0})


def _empty_obj(key: str = "data"):
    return success(data={key: {}})


# ==================== i18n-v2 ====================

@router.get("/api/v1/i18n-v2/languages", summary="i18n 语言列表")
async def i18n_languages():
    return success(data=["zh-CN", "en-US"])


@router.get("/api/v1/i18n-v2/keys", summary="i18n 键列表")
async def i18n_keys():
    return _empty_list("keys")


@router.get("/api/v1/i18n-v2/entry/{key:path}", summary="i18n 条目")
async def i18n_entry(key: str):
    return success(data={"key": key, "translations": {}})


@router.get("/api/v1/i18n-v2/pull", summary="i18n 拉取")
async def i18n_pull(request: Request):
    return success(data={"entries": {}})


@router.get("/api/v1/i18n-v2/export", summary="i18n 导出")
async def i18n_export(request: Request):
    return success(data={})


@router.get("/api/v1/i18n-v2/stats", summary="i18n 统计")
async def i18n_stats():
    return success(data={"total_keys": 0, "translated": 0, "missing": 0})


@router.get("/api/v1/i18n-v2/sync-log", summary="i18n 同步日志")
async def i18n_sync_log():
    return _empty_list("logs")


@router.get("/api/v1/i18n-v2/diff", summary="i18n 差异")
async def i18n_diff():
    return success(data={"diff": []})


@router.get("/api/v1/i18n-v2/plural/{key:path}", summary="i18n 复数")
async def i18n_plural(key: str):
    return success(data={"key": key, "plural": {}})


@router.get("/api/v1/i18n-v2/tm/stats", summary="i18n TM 统计")
async def i18n_tm_stats():
    return success(data={"total": 0, "matched": 0})


@router.get("/api/v1/i18n-v2/mt/queue", summary="i18n MT 队列")
async def i18n_mt_queue():
    return _empty_list("queue")


@router.post("/api/v1/i18n-v2/push", summary="i18n 推送")
async def i18n_push(request: Request):
    return success(data={"updated": 0})


@router.post("/api/v1/i18n-v2/push-plural", summary="i18n 推送复数")
async def i18n_push_plural(request: Request):
    return success(data={"updated": 0})


@router.post("/api/v1/i18n-v2/format", summary="i18n 格式化")
async def i18n_format(request: Request):
    return success(data={"formatted": ""})


@router.post("/api/v1/i18n-v2/translate", summary="i18n 翻译")
async def i18n_translate(request: Request):
    return success(data={"translated": ""})


@router.post("/api/v1/i18n-v2/tm/search", summary="i18n TM 搜索")
async def i18n_tm_search(request: Request):
    return _empty_list("matches")


@router.post("/api/v1/i18n-v2/mt/translate", summary="i18n MT 翻译")
async def i18n_mt_translate(request: Request):
    return success(data={"translated": ""})


@router.post("/api/v1/i18n-v2/mt/review", summary="i18n MT 审查")
async def i18n_mt_review(request: Request):
    return success(data={"reviewed": False})


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


@router.get("/api/code", summary="获取验证码图片(legacy /api/code 别名)")
async def legacy_get_captcha():
    """Legacy /api/code alias for /api/v1/auth/captcha.

    前端白名单 AUTH_PATHS.code = '/api/code' (request.ts),
    但实际验证码在 /api/v1/auth/captcha. 添加此别名避免落 mock catch-all.
    """
    from app.utils.captcha_util import generate_captcha

    img_base64, captcha_key = generate_captcha()
    return success(data={"captcha_key": captcha_key, "img": img_base64})
