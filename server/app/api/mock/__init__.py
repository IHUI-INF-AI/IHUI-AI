"""Java 后端接口的本地 Mock 端点 (开发环境 fallback).

当远程 Java 后端 (bsm.aizhs.top) 不可用或接口未实现时,
本地 Python 后端提供与前端兼容的 mock 数据, 保持前后端联调可用.

挂载路径: /api/* 和 /prod-api/* (兼容 vite proxy rewrite)
"""

import logging
import time
import uuid
from collections import defaultdict

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

from app.core.exceptions import BusinessException
from app.schemas.error_codes import ErrorCode

logger = logging.getLogger(__name__)

# mock SMS 限流: 60s 窗口内拒绝. Redis 不可用时降级到内存 dict.
_mock_sms_last_sent: dict = defaultdict(float)
_MOCK_SMS_WINDOW_SECONDS = 60


def _mock_sms_rate_limit(phone: str) -> bool:
    """检查 mock SMS 限流. True=允许发送, False=限流中. Redis 不可用时降级到内存."""
    key = f"mock:sms:limit:{phone}"
    try:
        from app.utils.redis_util import get_redis
        r = get_redis()
        ok = r.set(key, "1", nx=True, ex=_MOCK_SMS_WINDOW_SECONDS)
        return ok is not None
    except Exception:
        now = time.time()
        last = _mock_sms_last_sent.get(phone, 0.0)
        if now - last < _MOCK_SMS_WINDOW_SECONDS:
            return False
        _mock_sms_last_sent[phone] = now
        return True

# 不使用 prefix, 因为需要同时支持 /api/* 和 /prod-api/* 路径
# 用两个独立 router 避免 prefix 冲突
api_router = APIRouter(tags=["Java Backend Mock /api"])
prod_router = APIRouter(tags=["Java Backend Mock /prod-api"])


def _ok(data, msg: str = "success"):
    return {"code": 200, "msg": msg, "data": data, "timestamp": int(time.time() * 1000)}


def _page(data, total: int = 0, page_num: int = 1, page_size: int = 20):
    return {
        "code": 200,
        "msg": "success",
        "data": {
            "list": data,
            "total": total,
            "pageNum": page_num,
            "page": page_num,
            "pageSize": page_size,
            "totalPages": (total + page_size - 1) // page_size if page_size else 0,
        },
        "timestamp": int(time.time() * 1000),
    }


# --- 智能体分类 (Java 后端 /api/category/* 的 fallback) ---

_MOCK_CATEGORIES = [
    {"id": 1, "name": "AI 写作", "icon": "pen", "count": 128, "description": "智能写作助手"},
    {"id": 2, "name": "AI 绘画", "icon": "palette", "count": 256, "description": "图像生成与编辑"},
    {"id": 3, "name": "AI 编程", "icon": "code", "count": 64, "description": "代码生成与审查"},
    {"id": 4, "name": "AI 翻译", "icon": "language", "count": 32, "description": "多语言翻译"},
    {"id": 5, "name": "AI 视频", "icon": "video", "count": 48, "description": "视频生成与处理"},
    {"id": 6, "name": "AI 音频", "icon": "audio", "count": 24, "description": "语音合成与识别"},
    {"id": 7, "name": "AI 客服", "icon": "service", "count": 89, "description": "智能客服"},
    {"id": 8, "name": "AI 教育", "icon": "edu", "count": 56, "description": "智能教学"},
    {"id": 9, "name": "AI 办公", "icon": "office", "count": 72, "description": "办公自动化"},
    {"id": 10, "name": "AI 营销", "icon": "marketing", "count": 41, "description": "营销文案"},
]


# === /api/* 路径 ===


@api_router.get("/api/category/list", summary="Mock: 智能体分类列表", operation_id="mock_category_list")
def mock_category_list():
    return _ok(_MOCK_CATEGORIES)


@api_router.get("/api/category/getPlazaList", summary="Mock: Plaza 分类列表", operation_id="mock_plaza_list")
def mock_plaza_list():
    return _ok(_MOCK_CATEGORIES)


@api_router.get(
    "/api/category/getPlazaInfoById/{category_id}", summary="Mock: Plaza 分类详情", operation_id="mock_plaza_info"
)
def mock_plaza_info(category_id: int):
    cat = next((c for c in _MOCK_CATEGORIES if c["id"] == category_id), None)
    if not cat:
        raise HTTPException(status_code=404, detail="category not found")
    return _ok({**cat, "subAgents": []})


@api_router.post("/api/category/addPlazaModel", summary="Mock: 添加 Plaza 模型", operation_id="mock_add_plaza_model")
async def mock_add_plaza_model(request: Request):
    body = await request.json()
    return _ok({"id": int(time.time()), **body})


@api_router.get("/api/openclaw/sessions", summary="Mock: OpenClaw 会话列表", operation_id="mock_openclaw_sessions")
def mock_openclaw_sessions():
    return _page([], total=0)


@api_router.get("/api/openclaw/tools", summary="Mock: OpenClaw 工具列表", operation_id="mock_openclaw_tools")
def mock_openclaw_tools():
    return _ok([])


@api_router.get("/api/developer/models", summary="Mock: 开发者模型列表", operation_id="mock_developer_models")
def mock_developer_models():
    models = [
        {
            "id": "gpt-4",
            "name": "GPT-4",
            "provider": "openai",
            "enabled": True,
            "pricing": {"input": 0.03, "output": 0.06},
        },
        {
            "id": "gpt-3.5-turbo",
            "name": "GPT-3.5 Turbo",
            "provider": "openai",
            "enabled": True,
            "pricing": {"input": 0.001, "output": 0.002},
        },
        {
            "id": "claude-3-opus",
            "name": "Claude 3 Opus",
            "provider": "anthropic",
            "enabled": True,
            "pricing": {"input": 0.015, "output": 0.075},
        },
        {
            "id": "qwen-max",
            "name": "通义千问 Max",
            "provider": "aliyun",
            "enabled": True,
            "pricing": {"input": 0.02, "output": 0.06},
        },
    ]
    return _ok(models)


@api_router.get("/api/statistics/dashboard", summary="Mock: 仪表盘统计", operation_id="mock_stats_dashboard")
def mock_stats_dashboard():
    return _ok(
        {
            "totalUsers": 1280,
            "activeAgents": 56,
            "totalRevenue": 89500.50,
            "monthlyGrowth": 0.156,
            "trend": [
                {"date": "2026-06-11", "value": 1200},
                {"date": "2026-06-12", "value": 1350},
                {"date": "2026-06-13", "value": 1180},
                {"date": "2026-06-14", "value": 1420},
                {"date": "2026-06-15", "value": 1580},
                {"date": "2026-06-16", "value": 1690},
                {"date": "2026-06-17", "value": 1820},
            ],
        }
    )


@api_router.get("/api/statistics/overview", summary="Mock: 总览统计", operation_id="mock_stats_overview")
def mock_stats_overview():
    return _ok({"users": 1280, "agents": 56, "revenue": 89500.50, "orders": 320})


# === /prod-api/* 镜像 (兼容 vite proxy rewrite) ===


@prod_router.get("/prod-api/category/list", include_in_schema=False)
def prod_category_list():
    return _ok(_MOCK_CATEGORIES)


@prod_router.get("/prod-api/category/getPlazaList", include_in_schema=False)
def prod_plaza_list():
    return _ok(_MOCK_CATEGORIES)


@prod_router.get("/prod-api/category/getPlazaInfoById/{category_id}", include_in_schema=False)
def prod_plaza_info(category_id: int):
    cat = next((c for c in _MOCK_CATEGORIES if c["id"] == category_id), None)
    if not cat:
        raise BusinessException(code=ErrorCode.NOT_FOUND, msg="category not found")
    return _ok({**cat, "subAgents": []})


@prod_router.post("/prod-api/category/addPlazaModel", include_in_schema=False)
async def prod_add_plaza_model(request: Request):
    body = await request.json()
    return _ok({"id": int(time.time()), **body})


@prod_router.get("/prod-api/openclaw/sessions", include_in_schema=False)
def prod_openclaw_sessions():
    return _page([], total=0)


@prod_router.get("/prod-api/openclaw/tools", include_in_schema=False)
def prod_openclaw_tools():
    return _ok([])


@prod_router.get("/prod-api/developer/models", include_in_schema=False)
def prod_developer_models():
    return _ok(
        [
            {"id": "gpt-4", "name": "GPT-4", "provider": "openai", "enabled": True},
            {"id": "qwen-max", "name": "通义千问 Max", "provider": "aliyun", "enabled": True},
        ]
    )


@prod_router.get("/prod-api/statistics/dashboard", include_in_schema=False)
def prod_stats_dashboard():
    return _ok(
        {
            "totalUsers": 1280,
            "activeAgents": 56,
            "totalRevenue": 89500.50,
        }
    )


# 监控埋点 (前端会高频调用, 默认返回成功避免 404 噪声)
@api_router.post("/api/monitor/collect", summary="Mock: 前端监控埋点", operation_id="mock_monitor_collect")
def mock_monitor_collect(request: Request):
    return _ok({"received": True})


@api_router.post("/api/monitor/error", summary="Mock: 前端错误上报", operation_id="mock_monitor_error")
def mock_monitor_error(request: Request):
    return _ok({"received": True})


@api_router.post("/api/monitor/performance", summary="Mock: 前端性能上报", operation_id="mock_monitor_perf")
def mock_monitor_performance(request: Request):
    return _ok({"received": True})


@prod_router.api_route("/prod-api/ai/{path:path}", methods=["GET", "POST", "PUT", "DELETE"], include_in_schema=False)
def prod_ai_catchall(path: str, request: Request):
    return _ok({"path": path, "method": request.method})


@prod_router.api_route(
    "/prod-api/system/{path:path}", methods=["GET", "POST", "PUT", "DELETE"], include_in_schema=False
)
def prod_system_catchall(path: str, request: Request):
    return _ok({"path": path, "method": request.method})


@prod_router.post("/prod-api/monitor/collect", include_in_schema=False)
def prod_monitor_collect(request: Request):
    return _ok({"received": True})


@prod_router.post("/prod-api/monitor/error", include_in_schema=False)
def prod_monitor_error(request: Request):
    return _ok({"received": True})


@prod_router.post("/prod-api/monitor/performance", include_in_schema=False)
def prod_monitor_performance(request: Request):
    return _ok({"received": True})


# === 扩展 mock 端点 (覆盖前端所有 176 个未匹配 API 调用) ===


def _gen_token(prefix: str = "token") -> str:
    return f"mock-{prefix}-{uuid.uuid4().hex[:16]}"


async def _body(request: Request) -> dict:
    raw = await request.body()
    if not raw:
        return {}
    try:
        return await request.json()
    except Exception:
        return {}


# --- Auth 模块 ---
@api_router.post("/api/auth/login", operation_id="mock_auth_login_post")
async def mock_auth_login_post(request: Request):
    body = await _body(request)
    return _ok({
        "token": _gen_token(),
        "refreshToken": _gen_token("refresh"),
        "user": {"id": 1, "username": body.get("username", "user"), "role": "user"},
        "expiresIn": 7200,
    })


@api_router.post("/api/auth/register", operation_id="mock_auth_register_post")
async def mock_auth_register_post(request: Request):
    body = await _body(request)
    return _ok({"id": int(time.time()), "username": body.get("username", "new_user")})


@api_router.post("/api/auth/logout", operation_id="mock_auth_logout_post")
def mock_auth_logout_post():
    return _ok({"loggedOut": True})


@api_router.post("/api/auth/refresh", operation_id="mock_auth_refresh_post")
def mock_auth_refresh_post():
    return _ok({"token": _gen_token(), "refreshToken": _gen_token("refresh"), "expiresIn": 7200})


@api_router.get("/api/auth/user-info", operation_id="mock_auth_user_info")
def mock_auth_user_info():
    return _ok({"id": 1, "username": "user", "email": "user@example.com", "role": "user"})


@api_router.get("/api/auth/profile", operation_id="mock_auth_profile")
def mock_auth_profile():
    return _ok({"id": 1, "username": "user", "email": "user@example.com", "avatar": ""})


@api_router.get("/api/auth/health", operation_id="mock_auth_health")
def mock_auth_health():
    return _ok({"status": "ok", "timestamp": int(time.time())})


# --- User 模块 ---
@api_router.post("/api/user/login", operation_id="mock_user_login_post")
async def mock_user_login_post(request: Request):
    body = await _body(request)
    return _ok({
        "token": _gen_token(),
        "refreshToken": _gen_token("refresh"),
        "user": {"id": 1, "username": body.get("username", "user")},
        "expiresIn": 7200,
    })


@api_router.post("/api/user/logout", operation_id="mock_user_logout_post")
def mock_user_logout_post():
    return _ok({"loggedOut": True})


@api_router.get("/api/user/profile", operation_id="mock_user_profile")
def mock_user_profile():
    return _ok({"id": 1, "username": "user", "email": "user@example.com", "avatar": "", "phone": ""})


@api_router.put("/api/user/profile", operation_id="mock_user_profile_put")
async def mock_user_profile_put(request: Request):
    body = await _body(request)
    return _ok({"id": 1, **body})


@api_router.get("/api/user/getUserInfo", operation_id="mock_user_get_info")
def mock_user_get_info():
    return _ok({"id": 1, "username": "user", "email": "user@example.com", "coins": 100, "vipLevel": 0})


@api_router.get("/api/user/api-tokens", operation_id="mock_user_api_tokens")
def mock_user_api_tokens():
    return _ok([])


@api_router.get("/api/user/api-usage/stats", operation_id="mock_user_api_usage_stats")
def mock_user_api_usage_stats():
    return _ok({"totalCalls": 0, "totalTokens": 0, "todayCalls": 0})


@api_router.get("/api/user/api-balance", operation_id="mock_user_api_balance")
def mock_user_api_balance():
    return _ok({"balance": 100.0, "currency": "CNY"})


# --- VIP 模块 ---
@api_router.get("/api/vip/plans", operation_id="mock_vip_plans")
def mock_vip_plans():
    return _ok([
        {"id": 1, "name": "月度会员", "price": 29.9, "duration": 30, "features": ["无限对话", "优先客服"]},
        {"id": 2, "name": "年度会员", "price": 299, "duration": 365, "features": ["无限对话", "优先客服", "专属模型"]},
    ])


@api_router.get("/api/vip/levels", operation_id="mock_vip_levels")
def mock_vip_levels():
    return _ok([
        {"level": 0, "name": "普通用户", "minPoints": 0},
        {"level": 1, "name": "铜牌会员", "minPoints": 100},
        {"level": 2, "name": "银牌会员", "minPoints": 500},
        {"level": 3, "name": "金牌会员", "minPoints": 2000},
    ])


@api_router.get("/api/vip/privileges", operation_id="mock_vip_privileges")
def mock_vip_privileges():
    return _ok(["无限对话", "优先客服", "专属模型", "API 调用", "数据导出"])


@api_router.post("/api/vip/order/create", operation_id="mock_vip_order_create")
async def mock_vip_order_create(request: Request):
    body = await _body(request)
    return _ok({"orderId": f"VIP{int(time.time())}", "status": "pending", **body})


# --- Wallet 模块 ---
@api_router.get("/api/wallet/info", operation_id="mock_wallet_info")
def mock_wallet_info():
    return _ok({"balance": 100.50, "frozen": 0, "total": 100.50, "currency": "CNY"})


@api_router.get("/api/wallet/transactions", operation_id="mock_wallet_transactions")
def mock_wallet_transactions():
    return _page([], total=0)


# --- Upload 模块 ---
# NOTE: Commented out because the real legacy upload routes provide the actual implementation.
# @api_router.post("/api/upload/single", operation_id="mock_upload_single")
# def mock_upload_single():
#     return _ok({"url": f"https://mock.example.com/files/{uuid.uuid4().hex[:8]}", "id": int(time.time())})
#
#
# @api_router.post("/api/upload/files", operation_id="mock_upload_files")
# def mock_upload_files():
#     return _ok([{"url": f"https://mock.example.com/files/{uuid.uuid4().hex[:8]}", "id": int(time.time())}])
#
#
# @api_router.delete("/api/upload/file/{file_id}", operation_id="mock_upload_file_delete")
# def mock_upload_file_delete(file_id: str):
#     return _ok({"deleted": True, "id": file_id})


# --- Courses 模块 ---
@api_router.get("/api/courses", operation_id="mock_courses_list")
def mock_courses_list():
    return _page([], total=0)


@api_router.get("/api/courses/my", operation_id="mock_courses_my")
def mock_courses_my():
    return _ok([])


# --- Login (Java 风格) 模块 ---
@api_router.post("/api/login/pwd/login", operation_id="mock_login_pwd_login")
async def mock_login_pwd_login(request: Request):
    body = await _body(request)
    return _ok({
        "token": _gen_token(),
        "refreshToken": _gen_token("refresh"),
        "userInfo": {"id": 1, "username": body.get("username", body.get("phone", "user"))},
        "expiresIn": 7200,
    })


@api_router.post("/api/login/pwd/smsVerify", operation_id="mock_login_pwd_sms_verify")
async def mock_login_pwd_sms_verify(request: Request):
    """发送手机验证码 - mock 始终返回成功, 但有 60s 限流 (Redis 持久化)."""
    body = await _body(request)
    phone = body.get("phone", "13800000000")
    if not _mock_sms_rate_limit(phone):
        raise BusinessException(code=ErrorCode.RATE_LIMIT, msg=f"verification code already sent, retry after {_MOCK_SMS_WINDOW_SECONDS}s")
    # mock 固定验证码 123456, 供前端 e2e 走通
    return _ok({"phone": phone, "code": "123456", "expireSeconds": 60})


@api_router.post("/api/login/pwd/verify", operation_id="mock_login_pwd_verify")
async def mock_login_pwd_verify(request: Request):
    """验证手机验证码 - mock 始终返回临时密钥."""
    body = await _body(request)
    phone = body.get("phone", "13800000000")
    code = str(body.get("code", ""))
    # 接受任何 6 位数字验证码 (前端默认填 123456)
    if not code or len(code) != 6 or not code.isdigit():
        raise BusinessException(code=ErrorCode.SMS_CODE_INVALID, msg="invalid verification code")
    temp_key = _gen_token("tempkey")
    return _ok({"phone": phone, "tempKey": temp_key, "tempKeyExpireSeconds": 300})


@api_router.post("/api/login/pwd/registerLogin", operation_id="mock_login_pwd_register")
async def mock_login_pwd_register(request: Request):
    body = await _body(request)
    return _ok({
        "token": _gen_token(),
        "refreshToken": _gen_token("refresh"),
        "userInfo": {"id": int(time.time()), "username": body.get("username", "new_user")},
        "expiresIn": 7200,
    })


@api_router.post("/api/login/pwd/refreshToken", operation_id="mock_login_pwd_refresh")
async def mock_login_pwd_refresh(request: Request):
    """刷新 token - mock 返回真实 JWT, 让前端后续请求能通过鉴权."""
    body = await _body(request)
    refresh_token = body.get("refreshToken", "")
    # 尝试解码 refresh token 拿 user_uuid; 失败用默认值 (兼容旧 mock login 的随机 token)
    user_uuid = "mock-user"
    if refresh_token:
        from app.security import decode_access_token
        payload = decode_access_token(refresh_token)
        if payload and payload.get("type") == "refresh":
            user_uuid = payload.get("sub", user_uuid)
    from app.security import create_access_token, create_refresh_token
    new_access = create_access_token(user_uuid)
    new_refresh, _jti, _fid = create_refresh_token(user_uuid)
    return _ok({"token": new_access, "refreshToken": new_refresh, "expiresIn": 7200})


# --- AI 模块 (补充 /api/ai/* 下的具体端点) ---
@api_router.post("/api/ai/chat", operation_id="mock_ai_chat")
async def mock_ai_chat(request: Request):
    body = await _body(request)
    return _ok({"response": "这是一个 mock 响应", "model": body.get("model", "gpt-4"), "usage": {"total_tokens": 100}})


@api_router.post("/api/ai/generate", operation_id="mock_ai_generate")
async def mock_ai_generate(request: Request):
    body = await _body(request)
    return _ok({"result": "mock 生成结果", "model": body.get("model", "gpt-4")})


@api_router.get("/api/ai/models", operation_id="mock_ai_models")
def mock_ai_models():
    return _ok([
        {"id": "gpt-4", "name": "GPT-4", "provider": "openai"},
        {"id": "gpt-3.5-turbo", "name": "GPT-3.5 Turbo", "provider": "openai"},
        {"id": "claude-3-opus", "name": "Claude 3 Opus", "provider": "anthropic"},
        {"id": "qwen-max", "name": "通义千问 Max", "provider": "aliyun"},
    ])


# --- AI-Program 模块 ---
@api_router.get("/api/ai-program/plaza", operation_id="mock_ai_program_plaza")
def mock_ai_program_plaza():
    return _page([], total=0)


@api_router.get("/api/ai-program/plaza/demands/list", operation_id="mock_plaza_demands_list")
def mock_plaza_demands_list():
    demands = [
        {
            "id": 1, "userId": "u1", "userName": "张三", "avatar": "",
            "title": "寻找 AI 智能客服系统集成伙伴",
            "description": "需要一个支持多轮对话的智能客服系统,能与现有 CRM 打通,目标 7 天内 POC 验证.",
            "type": "demand", "category": "aiChat", "status": 2,
            "viewCount": 128, "commentCount": 12, "createTime": "2026-06-10 10:00:00", "updateTime": "2026-06-17 10:00:00",
        },
        {
            "id": 2, "userId": "u2", "userName": "李四", "avatar": "",
            "title": "AI 代码助手私有化部署需求",
            "description": "团队 30+ 人,希望私有化部署 AI 代码助手以保障代码安全,需要支持主流 IDE.",
            "type": "demand", "category": "aiCoding", "status": 2,
            "viewCount": 256, "commentCount": 24, "createTime": "2026-06-11 14:00:00", "updateTime": "2026-06-17 14:00:00",
        },
    ]
    return _page(demands, total=len(demands))


@api_router.get("/api/ai-program/plaza/demands/{demand_id}", operation_id="mock_plaza_demand_detail")
def mock_plaza_demand_detail(demand_id: int):
    return _ok({
        "id": demand_id, "userId": "u1", "userName": "张三", "avatar": "",
        "title": "寻找 AI 智能客服系统集成伙伴",
        "description": "需要一个支持多轮对话的智能客服系统,能与现有 CRM 打通,目标 7 天内 POC 验证.",
        "type": "demand", "category": "aiChat", "status": 2,
        "viewCount": 128, "commentCount": 12, "createTime": "2026-06-10 10:00:00", "updateTime": "2026-06-17 10:00:00",
    })


@api_router.post("/api/ai-program/login/pwd/login", operation_id="mock_ai_program_login")
async def mock_ai_program_login(request: Request):
    body = await _body(request)
    return _ok({
        "token": _gen_token(),
        "refreshToken": _gen_token("refresh"),
        "userInfo": {"id": 1, "username": body.get("username", "user")},
        "expiresIn": 7200,
    })


# --- Customer-Service 模块 ---
# NOTE: These mocks are commented out because the real legacy routes
# (挂载在 /api/customer-service/*) provide the actual implementation.
# @api_router.get("/api/customer-service/faqs", operation_id="mock_cs_faqs")
# def mock_cs_faqs():
#     return _ok([
#         {"id": 1, "question": "如何注册?", "answer": "点击注册按钮即可"},
#         {"id": 2, "question": "如何充值?", "answer": "进入钱包页面充值"},
#     ])
#
#
# @api_router.get("/api/customer-service/tickets", operation_id="mock_cs_tickets")
# def mock_cs_tickets():
#     return _page([], total=0)


# --- Skills 模块 ---
@api_router.get("/api/skills/list", operation_id="mock_skills_list")
def mock_skills_list():
    return _ok([
        {"name": "writing", "description": "AI 写作", "enabled": True},
        {"name": "translation", "description": "AI 翻译", "enabled": True},
    ])


@api_router.get("/api/skills/metadata", operation_id="mock_skills_metadata")
def mock_skills_metadata():
    return _ok({"version": "1.0", "count": 2})


# --- Feature-Flags 模块 ---
@api_router.get("/api/feature-flags", operation_id="mock_feature_flags")
def mock_feature_flags():
    return _ok({"newUI": True, "beta": False, "maintenance": False})


@api_router.get("/api/feature-flags/experiments", operation_id="mock_ff_experiments")
def mock_ff_experiments():
    return _ok([])


# --- Fund 模块 ---
@api_router.post("/api/fund/ali/pay", operation_id="mock_fund_ali_pay")
async def mock_fund_ali_pay(request: Request):
    body = await _body(request)
    return _ok({"orderId": f"ALI{int(time.time())}", "payUrl": "https://mock.example.com/ali/pay", **body})


@api_router.post("/api/fund/wx/pay", operation_id="mock_fund_wx_pay")
async def mock_fund_wx_pay(request: Request):
    body = await _body(request)
    return _ok({"orderId": f"WX{int(time.time())}", "codeUrl": "https://mock.example.com/wx/pay", **body})


# --- Orders 模块 ---
@api_router.get("/api/orders", operation_id="mock_orders_list")
def mock_orders_list():
    return _page([], total=0)


@api_router.post("/api/order/create", operation_id="mock_order_create")
async def mock_order_create(request: Request):
    body = await _body(request)
    return _ok({"orderId": f"ORD{int(time.time())}", "status": "pending", **body})


# --- Payment 模块 ---
@api_router.post("/api/payment/createOrder", operation_id="mock_payment_create")
async def mock_payment_create(request: Request):
    body = await _body(request)
    return _ok({"orderId": f"PAY{int(time.time())}", "status": "pending", **body})


@api_router.get("/api/payment/checkOrderStatus", operation_id="mock_payment_check")
def mock_payment_check():
    return _ok({"status": "success", "paid": True})


# --- Recharge 模块 ---
@api_router.get("/api/recharge/config", operation_id="mock_recharge_config")
def mock_recharge_config():
    return _ok({"min": 10, "max": 10000, "methods": ["alipay", "wechat"]})


@api_router.post("/api/recharge/create", operation_id="mock_recharge_create")
async def mock_recharge_create(request: Request):
    body = await _body(request)
    return _ok({"orderId": f"REC{int(time.time())}", "status": "pending", **body})


# --- Service-Appointment 模块 ---
@api_router.get("/api/service-appointment", operation_id="mock_sa_list")
def mock_sa_list():
    return _page([], total=0)


# --- Speech 模块 ---
@api_router.get("/api/speech/baidu/token", operation_id="mock_speech_token")
def mock_speech_token():
    return _ok({"token": _gen_token("baidu"), "expiresIn": 2592000})


# --- Unified-AI 模块 ---
@api_router.get("/api/unified-ai/capabilities", operation_id="mock_unified_ai_caps")
def mock_unified_ai_caps():
    return _ok(["chat", "generate", "translate", "code", "image"])


@api_router.post("/api/unified-ai/invoke", operation_id="mock_unified_ai_invoke")
async def mock_unified_ai_invoke(request: Request):
    body = await _body(request)
    return _ok({"result": "mock 调用结果", "capability": body.get("capability", "chat")})


# --- Models 模块 ---
@api_router.get("/api/models/pricing", operation_id="mock_models_pricing")
def mock_models_pricing():
    return _ok([
        {"model": "gpt-4", "input": 0.03, "output": 0.06},
        {"model": "gpt-3.5-turbo", "input": 0.001, "output": 0.002},
    ])


# --- Mobile 模块 ---
@api_router.get("/api/mobile/orders/list", operation_id="mock_mobile_orders")
def mock_mobile_orders():
    return _page([], total=0)


# --- Audit 模块 ---
# NOTE: Commented out because the real legacy audit routes provide the actual implementation.
# @api_router.get("/api/audit/logs", operation_id="mock_audit_logs")
# def mock_audit_logs():
#     return _page([], total=0)
#
#
# @api_router.get("/api/audit/stats", operation_id="mock_audit_stats")
# def mock_audit_stats():
#     return _ok({"total": 0, "today": 0, "errors": 0})


# --- Admin 模块 ---
@api_router.post("/api/admin/login", operation_id="mock_admin_login")
async def mock_admin_login(request: Request):
    body = await _body(request)
    return _ok({
        "token": _gen_token("admin"),
        "refreshToken": _gen_token("refresh"),
        "admin": {"id": 1, "username": body.get("username", "admin"), "role": "admin"},
        "expiresIn": 7200,
    })


@api_router.get("/api/admin/users", operation_id="mock_admin_users")
def mock_admin_users():
    return _page([], total=0)


@api_router.get("/api/admin/roles", operation_id="mock_admin_roles")
def mock_admin_roles():
    return _ok([
        {"id": 1, "name": "admin", "description": "管理员"},
        {"id": 2, "name": "user", "description": "普通用户"},
    ])


@api_router.get("/api/admin/menus", operation_id="mock_admin_menus")
def mock_admin_menus():
    return _ok([
        {"id": 1, "name": "仪表盘", "path": "/dashboard", "icon": "dashboard"},
        {"id": 2, "name": "用户管理", "path": "/users", "icon": "users"},
    ])# --- Agents 模块 ---
@api_router.get("/api/agents/categories", operation_id="mock_agents_categories")
def mock_agents_categories():
    return _ok(_MOCK_CATEGORIES)


# --- Agent bylink 接口 (AgentsSquareList 使用) ---
@api_router.get("/api/agent/rule/search/bylink", operation_id="mock_agent_bylink")
def mock_agent_bylink():
    """返回按主分类分组的智能体列表 (兼容前端 AgentsSquareList 期望格式)."""
    return _ok({
        "AI写作": [
            {
                "botId": "mock-w-1", "agentId": "mock-w-1",
                "agentName": "写作助手", "botName": "写作助手", "name": "写作助手",
                "agentDescription": "辅助写作、润色与续写", "description": "辅助写作、润色与续写",
                "agentAvatar": "", "avatar": "",
                "creatorName": "智汇", "userName": "智汇",
                "creatorAvatar": "", "userAvatar": "",
                "agentMainCategory": [{"id": "1", "name": "AI写作"}],
                "agentCategory": [{"id": "1-1", "name": "写作助手"}],
                "usageCount": 128, "collectCount": 56, "isCollect": 0,
                "likeCount": 89, "isThumbs": 0, "is_top": 1,
            },
            {
                "botId": "mock-t-1", "agentId": "mock-t-1",
                "agentName": "翻译润色", "botName": "翻译润色", "name": "翻译润色",
                "agentDescription": "多语言翻译与文本润色", "description": "多语言翻译与文本润色",
                "agentAvatar": "", "avatar": "",
                "creatorName": "智汇", "userName": "智汇",
                "creatorAvatar": "", "userAvatar": "",
                "agentMainCategory": [{"id": "1", "name": "AI写作"}],
                "agentCategory": [{"id": "1-2", "name": "翻译润色"}],
                "usageCount": 96, "collectCount": 42, "isCollect": 0,
                "likeCount": 73, "isThumbs": 0, "is_top": 0,
            },
        ],
        "AI客服": [
            {
                "botId": "mock-s-1", "agentId": "mock-s-1",
                "agentName": "智能客服", "botName": "智能客服", "name": "智能客服",
                "agentDescription": "7x24 小时智能客服与常见问题解答", "description": "7x24 小时智能客服与常见问题解答",
                "agentAvatar": "", "avatar": "",
                "creatorName": "智汇", "userName": "智汇",
                "creatorAvatar": "", "userAvatar": "",
                "agentMainCategory": [{"id": "2", "name": "AI客服"}],
                "agentCategory": [{"id": "2-1", "name": "智能客服"}],
                "usageCount": 256, "collectCount": 102, "isCollect": 0,
                "likeCount": 156, "isThumbs": 0, "is_top": 1,
            },
        ],
        "AI绘画": [
            {
                "botId": "mock-p-1", "agentId": "mock-p-1",
                "agentName": "头像设计师", "botName": "头像设计师", "name": "头像设计师",
                "agentDescription": "AI 生成个性化头像设计", "description": "AI 生成个性化头像设计",
                "agentAvatar": "", "avatar": "",
                "creatorName": "智汇", "userName": "智汇",
                "creatorAvatar": "", "userAvatar": "",
                "agentMainCategory": [{"id": "3", "name": "AI绘画"}],
                "agentCategory": [{"id": "3-1", "name": "头像设计师"}],
                "usageCount": 184, "collectCount": 78, "isCollect": 0,
                "likeCount": 112, "isThumbs": 0, "is_top": 0,
            },
        ],
        "AI编程": [
            {
                "botId": "mock-c-1", "agentId": "mock-c-1",
                "agentName": "代码助手", "botName": "代码助手", "name": "代码助手",
                "agentDescription": "代码补全、审查与重构建议", "description": "代码补全、审查与重构建议",
                "agentAvatar": "", "avatar": "",
                "creatorName": "智汇", "userName": "智汇",
                "creatorAvatar": "", "userAvatar": "",
                "agentMainCategory": [{"id": "4", "name": "AI编程"}],
                "agentCategory": [{"id": "4-1", "name": "代码助手"}],
                "usageCount": 312, "collectCount": 145, "isCollect": 0,
                "likeCount": 198, "isThumbs": 0, "is_top": 1,
            },
        ],
        "AI办公": [
            {
                "botId": "mock-ppt-1", "agentId": "mock-ppt-1",
                "agentName": "PPT 大师", "botName": "PPT 大师", "name": "PPT 大师",
                "agentDescription": "一键生成专业 PPT 演示文稿", "description": "一键生成专业 PPT 演示文稿",
                "agentAvatar": "", "avatar": "",
                "creatorName": "智汇", "userName": "智汇",
                "creatorAvatar": "", "userAvatar": "",
                "agentMainCategory": [{"id": "5", "name": "AI办公"}],
                "agentCategory": [{"id": "5-1", "name": "PPT 大师"}],
                "usageCount": 142, "collectCount": 61, "isCollect": 0,
                "likeCount": 87, "isThumbs": 0, "is_top": 0,
            },
        ],
    })


@api_router.get("/api/agent/categories", operation_id="mock_agent_categories")
def mock_agent_categories():
    """返回智能体分类 (主分类 + 子分类). 同时含 list 字段兼容 backend-contract 契约."""
    main_cats = [
        {"id": "1", "name": "AI写作"},
        {"id": "2", "name": "AI客服"},
        {"id": "3", "name": "AI绘画"},
        {"id": "4", "name": "AI编程"},
        {"id": "5", "name": "AI办公"},
    ]
    sub_cats = [
        {"id": "1-1", "name": "写作助手"},
        {"id": "1-2", "name": "翻译润色"},
        {"id": "2-1", "name": "智能客服"},
        {"id": "3-1", "name": "头像设计师"},
        {"id": "4-1", "name": "代码助手"},
        {"id": "5-1", "name": "PPT 大师"},
    ]
    return _ok({
        "list": main_cats,
        "agentMainCategory": main_cats,
        "agentCategory": sub_cats,
    })


@api_router.post("/api/agent/collect/{agent_id}", operation_id="mock_agent_collect")
def mock_agent_collect(agent_id: str):
    return _ok({"message": "收藏成功", "agentId": agent_id})


@api_router.post("/api/agent/like/{agent_id}", operation_id="mock_agent_like")
def mock_agent_like(agent_id: str):
    return _ok({"message": "点赞成功", "agentId": agent_id})


# --- /api/agent/zhsAgent/* 契约兼容 (供 backend-contract.spec.ts 验证) ---

_ZHS_AGENTS = [
    {"id": "w-1", "name": "写作助手", "title": "AI写作助手", "categoryId": "cat-writing",
     "description": "辅助写作、润色与续写", "avatar": "", "usageCount": 128},
    {"id": "t-1", "name": "翻译润色", "title": "多语言翻译", "categoryId": "cat-writing",
     "description": "多语言翻译与文本润色", "avatar": "", "usageCount": 96},
    {"id": "s-1", "name": "智能客服", "title": "7x24智能客服", "categoryId": "cat-service",
     "description": "7x24 小时智能客服", "avatar": "", "usageCount": 256},
    {"id": "p-1", "name": "头像设计师", "title": "AI头像设计", "categoryId": "cat-draw",
     "description": "AI 生成个性化头像", "avatar": "", "usageCount": 184},
    {"id": "c-1", "name": "代码助手", "title": "AI编程助手", "categoryId": "cat-code",
     "description": "代码补全与审查", "avatar": "", "usageCount": 312},
    {"id": "ppt-1", "name": "PPT大师", "title": "AI办公PPT", "categoryId": "cat-office",
     "description": "一键生成专业PPT", "avatar": "", "usageCount": 142},
]


@api_router.get("/api/agent/zhsAgent/list", operation_id="mock_zhs_agent_list")
def mock_zhs_agent_list(request: Request):
    """返回智能体列表 (分页 + categoryId 过滤), 兼容 backend-contract 契约."""
    params = request.query_params
    page = int(params.get("page", params.get("pageNum", "1")))
    page_size = int(params.get("pageSize", "20"))
    category_id = params.get("categoryId", "")

    items = _ZHS_AGENTS
    if category_id:
        items = [a for a in items if a.get("categoryId") == category_id]

    total = len(items)
    start = (page - 1) * page_size
    page_items = items[start:start + page_size]

    return _ok({"list": page_items, "total": total, "page": page, "pageSize": page_size})


@api_router.get("/api/agent/zhsAgent/{agent_id}", operation_id="mock_zhs_agent_detail")
def mock_zhs_agent_detail(agent_id: str):
    """返回单个智能体详情, 不存在则 404."""
    for a in _ZHS_AGENTS:
        if a["id"] == agent_id:
            return _ok(a)
    from fastapi import HTTPException
    raise HTTPException(status_code=404, detail="Agent not found")


# --- V1 模块 ---注意: /api/v1/* 路径不再提供 mock, 避免 catch-all 拦截真实 /api/v1/* 端点.
# 真实端点由 app/api/v1/router.py 提供, 缺失路径会返回标准 404.


# --- /api/ai/* 和 /api/system/* 通用 catch-all (放在具体路由之后) ---


@api_router.api_route(
    "/api/ai/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE"],
    include_in_schema=False,
    operation_id="mock_ai_catchall",
)
def mock_ai_catchall(path: str, request: Request):
    return _ok({"path": path, "method": request.method})


@api_router.api_route(
    "/api/system/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE"],
    include_in_schema=False,
    operation_id="mock_system_catchall",
)
def mock_system_catchall(path: str, request: Request):
    return _ok({"path": path, "method": request.method})


# --- 模块级 catch-all (兜底所有未覆盖的子路径) ---

# NOTE: "upload", "customer-service", "audit", "agent" are removed from this list
# because the real legacy routes (挂载在 /api/<module>/*) provide the actual implementation.
# If kept, the module-level catch-all would intercept those paths and return mock data.
_MODULES = [
    "auth", "user", "vip", "wallet", "courses", "login",
    "ai-program", "skills", "feature-flags", "fund",
    "orders", "payment", "recharge", "service-appointment", "speech",
    "unified-ai", "models", "mobile", "admin", "agents",
    "code", "data", "developer", "edu", "openclaw", "order", "pay",
    "product", "rbac", "rum", "service", "tools",
]


def _make_catchall(module: str):
    def handler(path: str, request: Request):
        return _ok({"path": path, "method": request.method, "module": module})
    handler.__name__ = f"mock_{module}_catchall"
    return handler


for _mod in _MODULES:
    api_router.api_route(
        f"/api/{_mod}/{{path:path}}",
        methods=["GET", "POST", "PUT", "DELETE"],
        include_in_schema=False,
    )(_make_catchall(_mod))


# --- /prod-api/* 镜像 catch-all (兜底所有 /prod-api/* 路径) ---


@prod_router.api_route(
    "/prod-api/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
    include_in_schema=False,
)
def prod_catchall(path: str, request: Request):
    return _ok({"path": path, "method": request.method, "source": "prod-api-mock"})


# 兼容旧版引用
router = api_router


# === Coze / OpenAPI 兼容性 mock (兼容不同前缀) ===

coze_router = APIRouter(tags=["Coze Mock"])


@coze_router.get(
    "/cozeZhsApi/cache/agent-category-dict/categories",
    summary="Mock: Coze 智能体分类字典",
    operation_id="mock_coze_categories",
)
def mock_coze_categories():
    return _ok(
        [
            {"id": "writing", "name": "AI 写作", "icon": "edit", "count": 128},
            {"id": "image", "name": "AI 绘画", "icon": "picture", "count": 256},
            {"id": "code", "name": "AI 编程", "icon": "code", "count": 64},
            {"id": "translate", "name": "AI 翻译", "icon": "translation", "count": 32},
            {"id": "video", "name": "AI 视频", "icon": "video-camera", "count": 48},
            {"id": "audio", "name": "AI 音频", "icon": "sound", "count": 24},
        ]
    )


@coze_router.get(
    "/cozeZhsApi/cache/agent-category-dict/categories/{category_id}",
    summary="Mock: Coze 分类详情",
    operation_id="mock_coze_category_detail",
)
def mock_coze_category_detail(category_id: str):
    return _ok({"id": category_id, "name": category_id, "agents": []})


@coze_router.get("/cozeZhsApi/agents", summary="Mock: Coze 智能体列表", operation_id="mock_coze_agents")
def mock_coze_agents():
    return _ok(
        [
            {"id": "coze-1", "name": "写作助手", "category": "writing", "status": "active"},
            {"id": "coze-2", "name": "画师 AI", "category": "image", "status": "active"},
        ]
    )


# === 通用 catch-all 兜底 (匹配 /cozeZhsApi/*, /api-kou/* 等任何未覆盖路径) ===

from_fastapi_router = APIRouter(tags=["Universal Mock Fallback"])


@from_fastapi_router.api_route(
    "/cozeZhsApi/{path:path}", methods=["GET", "POST", "PUT", "DELETE"], include_in_schema=False
)
def mock_coze_catchall(path: str, request: Request):
    return _ok({"path": path, "method": request.method, "source": "coze-mock"})


@from_fastapi_router.api_route(
    "/api-kou/{path:path}", methods=["GET", "POST", "PUT", "DELETE"], include_in_schema=False
)
def mock_kou_catchall(path: str, request: Request):
    return _ok({"path": path, "method": request.method, "source": "kou-mock"})


@from_fastapi_router.api_route(
    "/dev-api/{path:path}", methods=["GET", "POST", "PUT", "DELETE"], include_in_schema=False
)
def mock_devapi_catchall(path: str, request: Request):
    return _ok({"path": path, "method": request.method, "source": "dev-api-mock"})


# 通用 mock catch-all: 匹配 /api/{path:path} 任意路径
# 当 v1 端点未实现时, 由 mock 兜底返回通用数据
@from_fastapi_router.api_route(
    "/api/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"], include_in_schema=False
)
async def mock_api_catchall(path: str, request: Request):
    """通用 mock 兜底. 覆盖所有 /api/* 路径, 让前端开发时无 404.

    2026-06-25 修复#D: 跳过 /api/v1/* 路径. v1 有真实端点, 缺失路径应返回 404
    而非 mock 兜底, 避免掩盖前端调用已迁移路径的错误 (如 /api/v1/agents/apply
    已迁移到 /api/v1/agents/withdrawal/apply, 若被 mock 兜底返回 200, 前端无法
    发现调用错误). 注释 "V1 模块注意: /api/v1/* 不再提供 mock" 原本设计意图如此,
    但 catch-all 的 /api/{path:path} 仍会匹配 v1/xxx, 现显式拦截.
    """
    # /api/v1/* 路径不提供 mock, 返回 404 让前端发现调用错误
    if path.startswith("v1/"):
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"v1 endpoint not found: /api/{path}")
    method = request.method
    # 根据路径推断返回数据
    lower = path.lower()
    # /api/health* 委托给真实健康检查端点 (避免前端拿不到真实健康状态)
    if method == "GET" and (path == "health" or path.startswith("health/")):
        # /api/health/history: 直接调真实 health_history endpoint (返回内存 deque, 不查 DB)
        if path == "health/history":
            from app.api.health import health_history
            return _ok(await health_history(limit=50))
        # /api/health: 快速检查 (避免真实 1s+ 延迟)
        from app.api.health import _check_db
        import asyncio, time
        _start = time.time()
        # 快速 DB 检查 (用 0.3s 超时)
        try:
            db_check = await asyncio.wait_for(_check_db(timeout=0.3), timeout=0.4)
        except TimeoutError:
            db_check = {"ok": False, "error": "db check timeout"}
        # Redis 不调真实检查 (内部 socket_connect_timeout=2s 太慢), 用缓存的连接池状态判断
        # 启动时可能未调用过, 触发 lazy init (只调一次, 启动成功后会缓存)
        try:
            from app.utils.redis_util import (
                _try_connect_redis, _use_fake as _r_use_fake, _pool as _r_pool, _fake_redis as _r_fake,
            )
            # 触发一次 lazy init (只在第一次调用时执行实际连接, 后续命中短路)
            if _r_pool is None and not _r_use_fake:
                _try_connect_redis()
            if _r_use_fake and _r_fake is not None:
                redis_check = {"ok": True, "msg": "ok (fakeredis)"}
            elif _r_use_fake and _r_fake is None:
                redis_check = {"ok": False, "msg": "fakeredis not installed"}
            elif _r_pool is not None:
                redis_check = {"ok": True, "msg": "ok"}
            else:
                redis_check = {"ok": False, "msg": "not initialized"}
        except Exception as e:
            redis_check = {"ok": False, "msg": str(e)[:80]}
        overall_ok = db_check.get("ok", False) and redis_check.get("ok", False)
        _status = "ok" if overall_ok else "degraded"
        _latency_ms = (time.time() - _start) * 1000
        # 写历史 (与真实 /health 行为一致, 让 trend 图表能累积数据)
        try:
            from app.api.health import _record_history
            _record_history(_latency_ms, _status, db_check.get("ok", False), redis_check.get("ok", False))
        except Exception as e:
            logger.debug("mock 健康检查记录历史失败: %s", e)
        return _ok({
            "status": _status,
            "uptime_s": round(time.time() - _start, 1),
            "db": db_check,
            "redis": redis_check,
        })
    if method == "GET":
        if "list" in lower or "page" in lower:
            return _ok({"list": [], "total": 0, "page": 1, "size": 10})
        if "info" in lower or "detail" in lower or "get" in lower:
            return _ok({"id": path.split("/")[-1] if "/" in path else path, "mock": True})
        if "config" in lower or "metadata" in lower:
            return _ok({"mock": True, "version": "1.0.0"})
        return _ok({"mock": True, "path": path, "method": method})
    if method == "POST":
        return _ok({"id": f"mock-{path}", "created": True, "mock": True})
    if method == "PUT" or method == "PATCH":
        return _ok({"updated": True, "mock": True, "path": path})
    if method == "DELETE":
        return _ok({"deleted": True, "mock": True, "path": path})
    return _ok({"mock": True, "path": path, "method": method})


# 注意:fallback 路由需要用 Starlette 的 Mount 或 app.middleware 实现 catch-all,
# 上述 Router 不会匹配其他前缀未注册的路径.在生产部署时建议使用反向代理兜底.
