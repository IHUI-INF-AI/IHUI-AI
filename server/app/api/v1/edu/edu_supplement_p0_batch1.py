"""Edu P0 批次1 补迁移 - 补齐 edu 微服务缺失的 P0 核心端点.

2026-06-26 补迁移 (Java -> Python, P0 批次1).

本文件补齐 edu 微服务 4 类共 40 个 P0 核心端点:
  1. 支付回调 (2): 支付宝 / 微信回调验签 + 订单状态更新
  2. 认证授权补全 (9): 登出/刷新Token/短信验证码/权限/角色管理
  3. 会员账户体系 (15): 密码/手机/邮箱绑定 + 账户管理(冻结/日志/导入导出/统计)
  4. 课程相关基础 (14): 报名/收藏/推荐/分类/评分/评论/完成标记

实现策略 (桩+日志):
  - 端点能正常注册、鉴权、参数校验, 前端可调用不会 404
  - 业务逻辑先做基础校验 (非空/正数/格式), 再返回 "endpoint ready, service pending"
  - 后续逐步接入 service 层 (app.services.edu_*) 替换桩返回

项目硬约束:
  - 6 位错误码 (401000 未登录 / 403000 无权限 / 400000 参数错误 等)
  - Body 参数而非 Query 提交数据
  - 软删除过滤 (del_flag='0')
  - 外部 HTTP 请求加 timeout=30.0
  - 敏感信息日志脱敏
  - except Exception 加 logger.debug
  - 异步避免同步 I/O

鉴权:
  - admin 端点: dependencies=[Depends(require_role("admin"))]
  - 用户端点: user_id: str = Depends(get_current_user_id)

参考:
  - 现有风格: app/api/v1/edu/pay.py (webhook 验签 / _get_db / success)
  - 鉴权用法: app/api/v1/edu/member.py (require_role / get_current_user_id)
  - Java 源: H:\\历史项目存档\\edu client\\service\\service\\ihui-ai-edu-*-service
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import os

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query, Request

from app.core.current_user import get_current_user_id
from app.database import get_session
from app.schemas.common import ErrorCode, success
from app.schemas.error_codes import http_status_for
from app.security import require_role

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/edu", tags=["Edu-Supplement-P0-Batch1"])


def _get_db():
    """FastAPI dependency wrapper for app.database.get_session (contextmanager)."""
    with get_session() as db:
        yield db


def _raise_error(code: ErrorCode | str, msg: str) -> None:
    """抛出带 6 位业务错误码的 HTTPException."""
    raise HTTPException(status_code=http_status_for(code), detail=f"{code}: {msg}")


def _mask(value: str | None) -> str:
    """敏感信息脱敏: 保留首尾各 2 位, 中间用 * 替换."""
    if not value:
        return ""
    s = str(value)
    if len(s) <= 4:
        return "*" * len(s)
    return s[:2] + "*" * (len(s) - 4) + s[-2:]


def _require_str(value, field: str) -> str:
    """校验字符串非空, 否则抛 400000."""
    if not value or not str(value).strip():
        _raise_error(ErrorCode.PARAM_MISSING, f"{field} 不能为空")
    return str(value).strip()


def _require_positive(value, field: str):
    """校验正数, 否则抛 400000."""
    if not isinstance(value, (int, float)) or value <= 0:
        _raise_error(ErrorCode.PARAM_INVALID, f"{field} 必须为正数")
    return value


def _pending(endpoint: str, **extra) -> dict:
    """桩返回: service 未实现时返回 ready 状态, 附带基础校验后的参数."""
    data: dict = {"message": "endpoint ready, service pending", "endpoint": endpoint}
    if extra:
        data.update(extra)
    return success(data=data)


# ===========================================================================
# 1. 支付回调 (2 个, 最高优先级)
# 基于 pay.py 的 webhook 验签模式 (HMAC-SHA256)
# ===========================================================================


@router.post("/pay/callback/alipay", summary="支付宝支付回调")
async def alipay_callback_endpoint(
    request: Request,
    x_alipay_signature: str = Header(None, alias="X-Alipay-Signature"),
    db=Depends(_get_db),
):
    """支付宝异步回调: 验签 + 解析 JSON + 更新订单状态.

    验签密钥: 环境变量 ALIPAY_PAY_SECRET (HMAC-SHA256).
    生产环境必须配置密钥并验签; 开发环境未配置时仍要求签名头存在.
    """
    raw_body = await request.body()
    secret = os.environ.get("ALIPAY_PAY_SECRET", "")
    if secret:
        # 强制验签模式 (生产): 必须带签名且验签通过
        if not x_alipay_signature:
            logger.debug("alipay callback rejected: secret configured but signature missing")
            _raise_error(ErrorCode.UNAUTHORIZED, "Missing signature")
        expected = "sha256=" + hmac.new(
            secret.encode("utf-8"), raw_body, hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(expected, x_alipay_signature):
            logger.debug("alipay callback rejected: signature mismatch")
            _raise_error(ErrorCode.TOKEN_INVALID, "Invalid signature")
    else:
        # 兼容模式 (开发): secret 未配置时仍要求签名头存在
        if not x_alipay_signature:
            logger.debug("alipay callback rejected: signature header missing")
            _raise_error(ErrorCode.FORBIDDEN, "missing X-Alipay-Signature header")

    import json as _json

    try:
        payload = _json.loads(raw_body) if raw_body else {}
    except _json.JSONDecodeError as e:
        logger.debug("alipay callback JSON parse failed: %s", e)
        _raise_error(ErrorCode.PARAM_INVALID, "请求体格式错误")
        raise  # _raise_error always raises; this is for type checkers

    # 解析回调关键字段 (支付宝异步通知)
    order_no = payload.get("out_trade_no") or payload.get("trade_no")
    trade_status = payload.get("trade_status")
    logger.info("alipay callback received (order=%s, status=%s)", _mask(order_no), trade_status)

    # 业务: 更新订单状态 (service 待接入)
    # from app.services.edu_pay import handle_alipay_callback
    return _pending(
        "pay/callback/alipay",
        order_no=order_no,
        trade_status=trade_status,
    )


@router.post("/pay/callback/wechat", summary="微信支付回调")
async def wechat_callback_endpoint(
    request: Request,
    x_wechat_signature: str = Header(None, alias="X-Wechatpay-Signature"),
    db=Depends(_get_db),
):
    """微信支付异步回调: 验签 + 解析 JSON/XML + 更新订单状态.

    验签密钥: 环境变量 WECHAT_PAY_SECRET (HMAC-SHA256).
    支持 wechat pay v3 (JSON) 与 v2 (XML) 两种回调格式.
    """
    raw_body = await request.body()
    secret = os.environ.get("WECHAT_PAY_SECRET", "")
    if secret:
        if not x_wechat_signature:
            logger.debug("wechat callback rejected: secret configured but signature missing")
            _raise_error(ErrorCode.UNAUTHORIZED, "Missing signature")
        expected = "sha256=" + hmac.new(
            secret.encode("utf-8"), raw_body, hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(expected, x_wechat_signature):
            logger.debug("wechat callback rejected: signature mismatch")
            _raise_error(ErrorCode.TOKEN_INVALID, "Invalid signature")
    else:
        if not x_wechat_signature:
            logger.debug("wechat callback rejected: signature header missing")
            _raise_error(ErrorCode.FORBIDDEN, "missing X-Wechatpay-Signature header")

    # 解析 body: 优先 JSON (v3), 失败回退 XML (v2)
    payload: dict = {}
    try:
        import json as _json

        try:
            payload = _json.loads(raw_body) if raw_body else {}
        except _json.JSONDecodeError:
            if raw_body:
                import xml.etree.ElementTree as _et

                root = _et.fromstring(raw_body.decode("utf-8"))
                payload = {child.tag: child.text for child in root}
    except Exception as e:
        logger.debug("wechat callback parse failed: %s", e)
        _raise_error(ErrorCode.PARAM_INVALID, "请求体格式错误")
        raise

    order_no = payload.get("out_trade_no")
    result_code = payload.get("result_code") or payload.get("trade_state")
    logger.info("wechat callback received (order=%s, result=%s)", _mask(order_no), result_code)

    # 业务: 更新订单状态 (service 待接入)
    return _pending(
        "pay/callback/wechat",
        order_no=order_no,
        result_code=result_code,
    )


# ===========================================================================
# 2. 认证授权补全 (9 个)
# ===========================================================================


@router.post("/auth/logout", summary="登出 (清 Token)")
def auth_logout_endpoint(user_id: str = Depends(get_current_user_id)):
    """登出: 将当前 Token 加入黑名单 (JWT 黑名单机制).

    service 待接入: app.core.jwt_blacklist.revoke_token
    """
    logger.info("auth logout (user=%s)", _mask(user_id))
    return _pending("auth/logout", user_id=_mask(user_id))


@router.post("/auth/refresh", summary="刷新 Token")
def auth_refresh_endpoint(payload: dict = Body(default={})):
    """用 refresh_token 换取新的 access_token.

    refresh token 轮转 (Bug-53): 验证 family_id 防止重放.
    """
    refresh_token = _require_str(payload.get("refresh_token"), "refresh_token")
    logger.info("auth refresh requested (token=%s)", _mask(refresh_token))
    # service 待接入: app.security.decode_access_token + create_access_token + create_refresh_token
    return _pending("auth/refresh")


@router.post("/auth/send-sms", summary="发送短信验证码")
async def auth_send_sms_endpoint(payload: dict = Body(default={})):
    """发送短信验证码: 调用短信网关, 验证码存 Redis (5 分钟有效).

    限流: 同一手机号 60 秒内只能发一次 (service 接入后实现).
    外部 HTTP 请求 (短信网关) 需 timeout=30.0.
    """
    phone = _require_str(payload.get("phone"), "phone")
    # 简单手机号格式校验 (中国大陆 11 位)
    if len(phone) != 11 or not phone.isdigit():
        _raise_error(ErrorCode.PARAM_INVALID, "phone 格式无效")
    scene = payload.get("scene", "login")
    logger.info("auth send-sms (phone=%s, scene=%s)", _mask(phone), scene)
    # service 待接入: app.services.sms.send_code(phone, scene) -- 内部 httpx timeout=30.0
    return _pending("auth/send-sms", phone=_mask(phone), scene=scene)


@router.post("/auth/verify-sms", summary="验证短信验证码")
def auth_verify_sms_endpoint(payload: dict = Body(default={})):
    """验证短信验证码: 校验 Redis 中的验证码."""
    phone = _require_str(payload.get("phone"), "phone")
    code = _require_str(payload.get("code"), "code")
    if len(code) < 4:
        _raise_error(ErrorCode.PARAM_INVALID, "code 长度不足")
    logger.info("auth verify-sms (phone=%s)", _mask(phone))
    # service 待接入: app.services.sms.verify_code(phone, code)
    return _pending("auth/verify-sms", phone=_mask(phone))


@router.get("/auth/permissions", summary="获取当前用户权限列表")
def auth_permissions_endpoint(user_id: str = Depends(get_current_user_id)):
    """返回当前用户的权限标识列表 (role_key + perms)."""
    logger.info("auth permissions (user=%s)", _mask(user_id))
    # service 待接入: app.security 查询用户角色 + 菜单权限
    return _pending("auth/permissions", user_id=_mask(user_id))


@router.get("/auth/roles", summary="获取角色列表 (admin)", dependencies=[Depends(require_role("admin"))])
def auth_list_roles_endpoint(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db=Depends(_get_db),
):
    """分页查询角色列表 (admin)."""
    logger.info("auth list-roles (page=%s, size=%s)", page, size)
    # service 待接入: 查询 sys_role where del_flag='0' (软删除过滤)
    return _pending("auth/roles/list", page=page, size=size)


@router.post("/auth/roles", summary="创建角色 (admin)", dependencies=[Depends(require_role("admin"))])
def auth_create_role_endpoint(payload: dict = Body(default={}), db=Depends(_get_db)):
    """创建角色 (admin)."""
    role_name = _require_str(payload.get("role_name"), "role_name")
    role_key = _require_str(payload.get("role_key"), "role_key")
    logger.info("auth create-role (name=%s, key=%s)", role_name, role_key)
    # service 待接入: 插入 sys_role
    return _pending("auth/roles/create", role_name=role_name, role_key=role_key)


@router.put("/auth/roles/{role_id}", summary="更新角色 (admin)", dependencies=[Depends(require_role("admin"))])
def auth_update_role_endpoint(role_id: int, payload: dict = Body(default={}), db=Depends(_get_db)):
    """更新角色 (admin)."""
    _require_positive(role_id, "role_id")
    logger.info("auth update-role (id=%s)", role_id)
    # service 待接入: 更新 sys_role where role_id=? and del_flag='0'
    return _pending("auth/roles/update", role_id=role_id)


@router.delete("/auth/roles/{role_id}", summary="删除角色 (admin)", dependencies=[Depends(require_role("admin"))])
def auth_delete_role_endpoint(role_id: int, db=Depends(_get_db)):
    """删除角色 (软删除, admin)."""
    _require_positive(role_id, "role_id")
    logger.info("auth delete-role (id=%s)", role_id)
    # service 待接入: update sys_role set del_flag='2' where role_id=?
    return _pending("auth/roles/delete", role_id=role_id)


# ===========================================================================
# 3. 会员账户体系 (15 个)
# ===========================================================================


@router.post("/member/password/forgot", summary="忘记密码 (发送重置链接)")
async def member_password_forgot_endpoint(payload: dict = Body(default={})):
    """忘记密码: 生成重置 token, 发送重置链接到邮箱/手机.

    外部 HTTP 请求 (邮件/短信网关) 需 timeout=30.0.
    """
    account = _require_str(payload.get("account"), "account")  # 手机号或邮箱
    logger.info("member password-forgot (account=%s)", _mask(account))
    # service 待接入: 查用户 -> 生成 reset_token -> 发送通知
    return _pending("member/password/forgot", account=_mask(account))


@router.post("/member/password/reset", summary="重置密码")
def member_password_reset_endpoint(payload: dict = Body(default={})):
    """重置密码: 校验 reset_token, 设置新密码."""
    reset_token = _require_str(payload.get("reset_token"), "reset_token")
    new_password = _require_str(payload.get("new_password"), "new_password")
    if len(new_password) < 6:
        _raise_error(ErrorCode.PASSWORD_WEAK, "密码长度不足 (至少 6 位)")
    logger.info("member password-reset (token=%s)", _mask(reset_token))
    # service 待接入: 校验 token -> hash_password -> 更新
    return _pending("member/password/reset")


@router.post("/member/password/change", summary="修改密码 (需登录)")
def member_password_change_endpoint(
    user_id: str = Depends(get_current_user_id),
    payload: dict = Body(default={}),
    db=Depends(_get_db),
):
    """修改密码 (需登录): 校验旧密码后设置新密码."""
    old_password = _require_str(payload.get("old_password"), "old_password")
    new_password = _require_str(payload.get("new_password"), "new_password")
    if len(new_password) < 6:
        _raise_error(ErrorCode.PASSWORD_WEAK, "新密码长度不足 (至少 6 位)")
    if old_password == new_password:
        _raise_error(ErrorCode.PARAM_INVALID, "新密码不能与旧密码相同")
    logger.info("member password-change (user=%s)", _mask(user_id))
    # service 待接入: verify_password(old) -> hash_password(new) -> update
    return _pending("member/password/change", user_id=_mask(user_id))


@router.post("/member/phone/bind", summary="绑定手机 (需登录)")
def member_phone_bind_endpoint(
    user_id: str = Depends(get_current_user_id),
    payload: dict = Body(default={}),
    db=Depends(_get_db),
):
    """绑定手机 (需登录): 校验短信验证码后绑定."""
    phone = _require_str(payload.get("phone"), "phone")
    code = _require_str(payload.get("code"), "code")
    if len(phone) != 11 or not phone.isdigit():
        _raise_error(ErrorCode.PARAM_INVALID, "phone 格式无效")
    logger.info("member phone-bind (user=%s, phone=%s)", _mask(user_id), _mask(phone))
    # service 待接入: verify_code -> 检查手机号未注册 -> 绑定
    return _pending("member/phone/bind", user_id=_mask(user_id), phone=_mask(phone))


@router.post("/member/phone/unbind", summary="解绑手机 (需登录)")
def member_phone_unbind_endpoint(
    user_id: str = Depends(get_current_user_id),
    payload: dict = Body(default={}),
    db=Depends(_get_db),
):
    """解绑手机 (需登录): 校验验证码后解绑."""
    code = _require_str(payload.get("code"), "code")
    logger.info("member phone-unbind (user=%s)", _mask(user_id))
    # service 待接入: verify_code -> 清除手机号
    return _pending("member/phone/unbind", user_id=_mask(user_id))


@router.post("/member/email/bind", summary="绑定邮箱 (需登录)")
def member_email_bind_endpoint(
    user_id: str = Depends(get_current_user_id),
    payload: dict = Body(default={}),
    db=Depends(_get_db),
):
    """绑定邮箱 (需登录): 发送验证邮件."""
    email = _require_str(payload.get("email"), "email")
    if "@" not in email or "." not in email:
        _raise_error(ErrorCode.PARAM_INVALID, "email 格式无效")
    logger.info("member email-bind (user=%s, email=%s)", _mask(user_id), _mask(email))
    # service 待接入: 生成 verify_token -> 发送验证邮件 (httpx timeout=30.0)
    return _pending("member/email/bind", user_id=_mask(user_id), email=_mask(email))


@router.post("/member/email/verify", summary="验证邮箱 (需登录)")
def member_email_verify_endpoint(
    user_id: str = Depends(get_current_user_id),
    payload: dict = Body(default={}),
    db=Depends(_get_db),
):
    """验证邮箱: 校验 verify_token 后标记邮箱已验证."""
    verify_token = _require_str(payload.get("verify_token"), "verify_token")
    logger.info("member email-verify (user=%s)", _mask(user_id))
    # service 待接入: 校验 token -> 更新 email_status='verified'
    return _pending("member/email/verify", user_id=_mask(user_id))


@router.get(
    "/member/account/list",
    summary="账户列表 (admin)",
    dependencies=[Depends(require_role("admin"))],
)
def member_account_list_endpoint(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
    db=Depends(_get_db),
):
    """分页查询账户列表 (admin, 软删除过滤)."""
    logger.info("member account-list (page=%s, size=%s, status=%s)", page, size, status)
    # service 待接入: 查询 sys_user where del_flag='0' [and status=?]
    return _pending("member/account/list", page=page, size=size, status=status)


@router.put(
    "/member/account/{account_id}/status",
    summary="更新账户状态 (admin)",
    dependencies=[Depends(require_role("admin"))],
)
def member_account_status_endpoint(
    account_id: int,
    payload: dict = Body(default={}),
    db=Depends(_get_db),
):
    """更新账户状态 (admin): 启用/停用."""
    _require_positive(account_id, "account_id")
    status = _require_str(payload.get("status"), "status")
    logger.info("member account-status (id=%s, status=%s)", account_id, status)
    # service 待接入: update sys_user set status=? where user_id=? and del_flag='0'
    return _pending("member/account/status", account_id=account_id, status=status)


@router.post(
    "/member/account/{user_id}/freeze",
    summary="冻结用户 (admin)",
    dependencies=[Depends(require_role("admin"))],
)
def member_account_freeze_endpoint(user_id: int, payload: dict = Body(default={}), db=Depends(_get_db)):
    """冻结用户 (admin): 设置 status='1' (停用)."""
    _require_positive(user_id, "user_id")
    reason = payload.get("reason", "")
    logger.info("member account-freeze (user=%s, reason=%s)", user_id, reason)
    # service 待接入: update sys_user set status='1' where user_id=?
    return _pending("member/account/freeze", user_id=user_id, reason=reason)


@router.post(
    "/member/account/{user_id}/unfreeze",
    summary="解冻用户 (admin)",
    dependencies=[Depends(require_role("admin"))],
)
def member_account_unfreeze_endpoint(user_id: int, db=Depends(_get_db)):
    """解冻用户 (admin): 设置 status='0' (启用)."""
    _require_positive(user_id, "user_id")
    logger.info("member account-unfreeze (user=%s)", user_id)
    # service 待接入: update sys_user set status='0' where user_id=?
    return _pending("member/account/unfreeze", user_id=user_id)


@router.get(
    "/member/account/{user_id}/logs",
    summary="用户操作日志 (admin)",
    dependencies=[Depends(require_role("admin"))],
)
def member_account_logs_endpoint(
    user_id: int,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db=Depends(_get_db),
):
    """查询用户操作日志 (admin)."""
    _require_positive(user_id, "user_id")
    logger.info("member account-logs (user=%s, page=%s)", user_id, page)
    # service 待接入: 查询 sys_oper_log where user_id=?
    return _pending("member/account/logs", user_id=user_id, page=page, size=size)


@router.post(
    "/member/import",
    summary="批量导入会员 (admin)",
    dependencies=[Depends(require_role("admin"))],
)
def member_import_endpoint(payload: dict = Body(default={}), db=Depends(_get_db)):
    """批量导入会员 (admin): 接收会员列表, 批量创建."""
    members = payload.get("members")
    if not members or not isinstance(members, list) or len(members) == 0:
        _raise_error(ErrorCode.PARAM_MISSING, "members 不能为空")
    logger.info("member import (count=%s)", len(members))
    # service 待接入: 批量 insert sys_user (事务)
    return _pending("member/import", count=len(members))


@router.get(
    "/member/export",
    summary="导出会员列表 (admin)",
    dependencies=[Depends(require_role("admin"))],
)
def member_export_endpoint(db=Depends(_get_db)):
    """导出会员列表 (admin): 生成 Excel/CSV 下载."""
    logger.info("member export requested")
    # service 待接入: 查询 sys_user where del_flag='0' -> 生成 Excel
    return _pending("member/export")


@router.get(
    "/member/statistics",
    summary="会员统计 (admin)",
    dependencies=[Depends(require_role("admin"))],
)
def member_statistics_endpoint(db=Depends(_get_db)):
    """会员统计 (admin): 总数/新增/活跃/冻结等指标."""
    logger.info("member statistics requested")
    # service 待接入: 聚合查询 sys_user (count + group by status)
    return _pending("member/statistics")


# ===========================================================================
# 4. 课程相关基础端点 (14 个)
# 注意: 静态路径 (enrolled/favorites/recommended/categories) 必须在
#       参数化路径 ({course_id}/...) 之前注册, 否则被 {course_id} 拦截.
# ===========================================================================


@router.get("/learn/courses/enrolled", summary="我报名的课程")
def learn_courses_enrolled_endpoint(
    user_id: str = Depends(get_current_user_id),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db=Depends(_get_db),
):
    """查询当前用户已报名的课程列表."""
    logger.info("learn courses-enrolled (user=%s, page=%s)", _mask(user_id), page)
    # service 待接入: 查询报名记录 join 课程 where del_flag='0'
    return _pending("learn/courses/enrolled", user_id=_mask(user_id), page=page, size=size)


@router.get("/learn/courses/favorites", summary="我的收藏课程")
def learn_courses_favorites_endpoint(
    user_id: str = Depends(get_current_user_id),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db=Depends(_get_db),
):
    """查询当前用户收藏的课程列表."""
    logger.info("learn courses-favorites (user=%s, page=%s)", _mask(user_id), page)
    # service 待接入: 查询收藏记录 join 课程
    return _pending("learn/courses/favorites", user_id=_mask(user_id), page=page, size=size)


@router.get("/learn/courses/recommended", summary="推荐课程")
def learn_courses_recommended_endpoint(
    user_id: str = Depends(get_current_user_id),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db=Depends(_get_db),
):
    """查询推荐课程列表 (基于用户兴趣/报名历史)."""
    logger.info("learn courses-recommended (user=%s, page=%s)", _mask(user_id), page)
    # service 待接入: 推荐算法 / 热门课程
    return _pending("learn/courses/recommended", user_id=_mask(user_id), page=page, size=size)


@router.get("/learn/courses/categories", summary="课程分类")
def learn_courses_categories_endpoint(db=Depends(_get_db)):
    """查询课程分类列表 (树形)."""
    logger.info("learn courses-categories requested")
    # service 待接入: 查询课程分类树
    return _pending("learn/courses/categories")


@router.post("/learn/courses/{course_id}/enroll", summary="报名课程")
def learn_course_enroll_endpoint(
    course_id: int,
    user_id: str = Depends(get_current_user_id),
    db=Depends(_get_db),
):
    """报名课程: 创建报名记录, 增加课程学习人数."""
    _require_positive(course_id, "course_id")
    logger.info("learn course-enroll (course=%s, user=%s)", course_id, _mask(user_id))
    # service 待接入: 检查是否已报名 -> 创建报名记录 -> increment_student_count
    return _pending("learn/courses/enroll", course_id=course_id, user_id=_mask(user_id))


@router.post("/learn/courses/{course_id}/cancel-enroll", summary="取消报名")
def learn_course_cancel_enroll_endpoint(
    course_id: int,
    user_id: str = Depends(get_current_user_id),
    db=Depends(_get_db),
):
    """取消报名: 软删除报名记录."""
    _require_positive(course_id, "course_id")
    logger.info("learn course-cancel-enroll (course=%s, user=%s)", course_id, _mask(user_id))
    # service 待接入: 软删除报名记录
    return _pending("learn/courses/cancel-enroll", course_id=course_id, user_id=_mask(user_id))


@router.get("/learn/courses/{course_id}/progress", summary="课程学习进度")
def learn_course_progress_endpoint(
    course_id: int,
    user_id: str = Depends(get_current_user_id),
    db=Depends(_get_db),
):
    """查询当前用户在某课程的学习进度."""
    _require_positive(course_id, "course_id")
    logger.info("learn course-progress (course=%s, user=%s)", course_id, _mask(user_id))
    # service 待接入: 查询学习进度记录
    return _pending("learn/courses/progress", course_id=course_id, user_id=_mask(user_id))


@router.post("/learn/courses/{course_id}/favorite", summary="收藏课程")
def learn_course_favorite_endpoint(
    course_id: int,
    user_id: str = Depends(get_current_user_id),
    db=Depends(_get_db),
):
    """收藏课程: 创建收藏记录."""
    _require_positive(course_id, "course_id")
    logger.info("learn course-favorite (course=%s, user=%s)", course_id, _mask(user_id))
    # service 待接入: 检查是否已收藏 -> 创建收藏记录
    return _pending("learn/courses/favorite", course_id=course_id, user_id=_mask(user_id))


@router.delete("/learn/courses/{course_id}/favorite", summary="取消收藏")
def learn_course_cancel_favorite_endpoint(
    course_id: int,
    user_id: str = Depends(get_current_user_id),
    db=Depends(_get_db),
):
    """取消收藏: 软删除收藏记录."""
    _require_positive(course_id, "course_id")
    logger.info("learn course-cancel-favorite (course=%s, user=%s)", course_id, _mask(user_id))
    # service 待接入: 软删除收藏记录
    return _pending("learn/courses/cancel-favorite", course_id=course_id, user_id=_mask(user_id))


@router.post("/learn/courses/{course_id}/rate", summary="评分课程")
def learn_course_rate_endpoint(
    course_id: int,
    user_id: str = Depends(get_current_user_id),
    payload: dict = Body(default={}),
    db=Depends(_get_db),
):
    """评分课程: 提交评分 (1-5 星) + 评语."""
    _require_positive(course_id, "course_id")
    score = payload.get("score")
    if not isinstance(score, (int, float)) or score < 1 or score > 5:
        _raise_error(ErrorCode.PARAM_INVALID, "score 必须在 1-5 之间")
    logger.info("learn course-rate (course=%s, user=%s, score=%s)", course_id, _mask(user_id), score)
    # service 待接入: 创建评分记录 -> 更新课程平均评分
    return _pending("learn/courses/rate", course_id=course_id, score=score)


@router.get("/learn/courses/{course_id}/comments", summary="课程评论列表")
def learn_course_comments_endpoint(
    course_id: int,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db=Depends(_get_db),
):
    """查询课程评论列表 (分页)."""
    _require_positive(course_id, "course_id")
    logger.info("learn course-comments (course=%s, page=%s)", course_id, page)
    # service 待接入: 查询评论 where course_id=? and del_flag='0'
    return _pending("learn/courses/comments", course_id=course_id, page=page, size=size)


@router.post("/learn/courses/{course_id}/comments", summary="发表课程评论")
def learn_course_post_comment_endpoint(
    course_id: int,
    user_id: str = Depends(get_current_user_id),
    payload: dict = Body(default={}),
    db=Depends(_get_db),
):
    """发表课程评论 (需登录)."""
    _require_positive(course_id, "course_id")
    content = _require_str(payload.get("content"), "content")
    logger.info("learn course-post-comment (course=%s, user=%s)", course_id, _mask(user_id))
    # service 待接入: 创建评论记录
    return _pending("learn/courses/comments/post", course_id=course_id, user_id=_mask(user_id))


@router.delete("/learn/courses/comments/{comment_id}", summary="删除课程评论")
def learn_course_delete_comment_endpoint(
    comment_id: int,
    user_id: str = Depends(get_current_user_id),
    db=Depends(_get_db),
):
    """删除课程评论 (本人或 admin)."""
    _require_positive(comment_id, "comment_id")
    logger.info("learn course-delete-comment (comment=%s, user=%s)", comment_id, _mask(user_id))
    # service 待接入: 校验权限 (本人/admin) -> 软删除评论
    return _pending("learn/courses/comments/delete", comment_id=comment_id, user_id=_mask(user_id))


@router.post("/learn/courses/{course_id}/complete", summary="标记课程完成")
def learn_course_complete_endpoint(
    course_id: int,
    user_id: str = Depends(get_current_user_id),
    db=Depends(_get_db),
):
    """标记课程完成: 更新学习进度为 100%, 可触发证书发放."""
    _require_positive(course_id, "course_id")
    logger.info("learn course-complete (course=%s, user=%s)", course_id, _mask(user_id))
    # service 待接入: 更新进度=100% -> 检查发证条件 -> 发证
    return _pending("learn/courses/complete", course_id=course_id, user_id=_mask(user_id))
