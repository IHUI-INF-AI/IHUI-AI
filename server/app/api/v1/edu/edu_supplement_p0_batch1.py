"""Edu P0 批次1 补迁移 - 补齐 edu 微服务缺失的 P0 核心端点.

2026-06-26 补迁移 (Java -> Python, P0 批次1).
2026-06-26 补完: 把所有 40 个端点从桩模式升级为真实 service 实现.

本文件覆盖 edu 微服务 4 类共 40 个 P0 核心端点:
  1. 支付回调 (2): 支付宝 / 微信回调验签 + 订单状态更新
  2. 认证授权补全 (9): 登出/刷新Token/短信验证码/权限/角色管理
  3. 会员账户体系 (15): 密码/手机/邮箱绑定 + 账户管理(冻结/日志/导入导出/统计)
  4. 课程相关基础 (14): 报名/收藏/推荐/分类/评分/评论/完成标记

实现策略 (service + 路由):
  - 端点能正常注册、鉴权、参数校验
  - 业务逻辑在 service 层 (app.services.edu_supplement_p0_batch1)
  - 路由层只做参数接收和返回包装

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
"""
from __future__ import annotations

import logging
import os

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query, Request

from app.core.current_user import get_current_user_id
from app.database import get_session
from app.security import require_role
from app.services import edu_supplement_p0_batch1 as svc

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/edu", tags=["Edu-Supplement-P0-Batch1"])


def _get_db():
    """FastAPI dependency wrapper for app.database.get_session (contextmanager)."""
    with get_session() as db:
        yield db


def _to_dict(obj) -> dict:
    """ORM 对象转 dict (兼容 Phase A/B 字段)."""
    if obj is None:
        return {}
    if isinstance(obj, dict):
        return obj
    d = {}
    for col in getattr(obj, "__table__", type(obj)).columns if hasattr(obj, "__table__") else []:
        try:
            v = getattr(obj, col.name, None)
            d[col.name] = v.isoformat() if hasattr(v, "isoformat") else v
        except Exception as e:
            logger.debug("读取列 %s 失败: %s", col.name, e)
    return d


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
    """
    raw_body = await request.body()
    secret = os.environ.get("ALIPAY_PAY_SECRET", "")
    result = svc.handle_alipay_callback(
        db, raw_body=raw_body, signature=x_alipay_signature, secret=secret,
    )
    logger.info("alipay callback processed: %s", result)
    return result


@router.post("/pay/callback/wechat", summary="微信支付回调")
async def wechat_callback_endpoint(
    request: Request,
    x_wechat_signature: str = Header(None, alias="X-Wechatpay-Signature"),
    db=Depends(_get_db),
):
    """微信支付异步回调: 验签 + 解析 JSON/XML + 更新订单状态.

    验签密钥: 环境变量 WECHAT_PAY_SECRET (HMAC-SHA256).
    """
    raw_body = await request.body()
    secret = os.environ.get("WECHAT_PAY_SECRET", "")
    result = svc.handle_wechat_callback(
        db, raw_body=raw_body, signature=x_wechat_signature, secret=secret,
    )
    logger.info("wechat callback processed: %s", result)
    return result


# ===========================================================================
# 2. 认证授权补全 (9 个)
# ===========================================================================


@router.post("/auth/logout", summary="登出 (清 Token)")
def auth_logout_endpoint(user_id: str = Depends(get_current_user_id)):
    """登出: 将用户加入 Redis 黑名单, 拒绝后续 token 签发/校验."""
    ok = svc.revoke_user_token(str(user_id))
    logger.info("auth logout (user=%s, ok=%s)", user_id, ok)
    return {"logged_out": ok, "user_id": _mask(user_id)}


@router.post("/auth/refresh", summary="刷新 Token")
def auth_refresh_endpoint(payload: dict = Body(default={})):
    """用 refresh_token 换取新的 access_token + refresh_token (轮转)."""
    refresh_token = (payload.get("refresh_token") or "").strip()
    if not refresh_token:
        raise HTTPException(status_code=400, detail="refresh_token: 不能为空")
    result = svc.refresh_access_token(refresh_token=refresh_token)
    logger.info("auth refresh succeeded")
    return result


@router.post("/auth/send-sms", summary="发送短信验证码")
def auth_send_sms_endpoint(payload: dict = Body(default={})):
    """发送短信验证码: 6 位数字, 5 分钟有效, 60s 冷却."""
    phone = (payload.get("phone") or "").strip()
    scene = payload.get("scene", "login")
    result = svc.send_sms_code(phone=phone, scene=scene)
    return result


@router.post("/auth/verify-sms", summary="验证短信验证码")
def auth_verify_sms_endpoint(payload: dict = Body(default={})):
    """验证短信验证码. 校验通过后立即失效 (一次性)."""
    phone = (payload.get("phone") or "").strip()
    code = (payload.get("code") or "").strip()
    scene = payload.get("scene", "login")
    ok = svc.verify_sms_code(phone=phone, code=code, scene=scene)
    return {"verified": ok, "phone": _mask(phone)}


@router.get("/auth/permissions", summary="获取当前用户权限列表")
def auth_permissions_endpoint(user_id: str = Depends(get_current_user_id)):
    """返回当前用户的 role_key + menu perms 列表."""
    # _get_db 依赖; 这里只取 user_id, 不需要 db
    with get_session() as db:
        return svc.get_user_permissions(db, user_uuid=str(user_id))


@router.get("/auth/roles", summary="获取角色列表 (admin)", dependencies=[Depends(require_role("admin"))])
def auth_list_roles_endpoint(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db=Depends(_get_db),
):
    """分页查询角色列表 (admin)."""
    items, total = svc.list_roles(db, page=page, size=size)
    return {
        "total": total,
        "page": page,
        "size": size,
        "items": [_to_dict(r) for r in items],
    }


@router.post("/auth/roles", summary="创建角色 (admin)", dependencies=[Depends(require_role("admin"))])
def auth_create_role_endpoint(payload: dict = Body(default={}), db=Depends(_get_db)):
    """创建角色 (admin)."""
    role_name = (payload.get("role_name") or "").strip()
    role_key = (payload.get("role_key") or "").strip()
    if not role_name:
        raise HTTPException(status_code=400, detail="role_name: 不能为空")
    if not role_key:
        raise HTTPException(status_code=400, detail="role_key: 不能为空")
    role = svc.create_role(
        db, role_name=role_name, role_key=role_key,
        role_sort=payload.get("role_sort", 0),
        status=payload.get("status", "0"),
        remark=payload.get("remark", ""),
    )
    return _to_dict(role)


@router.put("/auth/roles/{role_id}", summary="更新角色 (admin)", dependencies=[Depends(require_role("admin"))])
def auth_update_role_endpoint(role_id: int, payload: dict = Body(default={}), db=Depends(_get_db)):
    """更新角色 (admin)."""
    if role_id <= 0:
        raise HTTPException(status_code=400, detail="role_id: 必须为正数")
    role = svc.update_role(db, role_id=role_id, **{k: v for k, v in payload.items() if v is not None})
    return _to_dict(role)


@router.delete("/auth/roles/{role_id}", summary="删除角色 (admin)", dependencies=[Depends(require_role("admin"))])
def auth_delete_role_endpoint(role_id: int, db=Depends(_get_db)):
    """删除角色 (软删除, admin)."""
    if role_id <= 0:
        raise HTTPException(status_code=400, detail="role_id: 必须为正数")
    ok = svc.delete_role(db, role_id=role_id)
    return {"deleted": ok, "role_id": role_id}


# ===========================================================================
# 3. 会员账户体系 (15 个)
# ===========================================================================


@router.post("/member/password/forgot", summary="忘记密码 (发送重置链接)")
def member_password_forgot_endpoint(payload: dict = Body(default={}), db=Depends(_get_db)):
    """忘记密码: 生成 reset_token, 通过邮件/短信发送重置链接."""
    account = (payload.get("account") or "").strip()
    if not account:
        raise HTTPException(status_code=400, detail="account: 不能为空")
    return svc.generate_password_reset_token(db, account=account)


@router.post("/member/password/reset", summary="重置密码")
def member_password_reset_endpoint(payload: dict = Body(default={}), db=Depends(_get_db)):
    """重置密码: 校验 reset_token, 设置新密码."""
    reset_token = (payload.get("reset_token") or "").strip()
    new_password = payload.get("new_password", "")
    if not reset_token:
        raise HTTPException(status_code=400, detail="reset_token: 不能为空")
    if not new_password or len(new_password) < 6:
        raise HTTPException(status_code=400, detail="new_password: 长度不足 (至少 6 位)")
    ok = svc.reset_password_with_token(db, reset_token=reset_token, new_password=new_password)
    return {"reset": ok}


@router.post("/member/password/change", summary="修改密码 (需登录)")
def member_password_change_endpoint(
    user_id: str = Depends(get_current_user_id),
    payload: dict = Body(default={}),
    db=Depends(_get_db),
):
    """修改密码 (需登录): 校验旧密码后设置新密码."""
    old_password = payload.get("old_password", "")
    new_password = payload.get("new_password", "")
    if not old_password:
        raise HTTPException(status_code=400, detail="old_password: 不能为空")
    if not new_password or len(new_password) < 6:
        raise HTTPException(status_code=400, detail="new_password: 长度不足 (至少 6 位)")
    if old_password == new_password:
        raise HTTPException(status_code=400, detail="新密码不能与旧密码相同")
    ok = svc.change_user_password(
        db, user_uuid=str(user_id),
        old_password=old_password, new_password=new_password,
    )
    return {"changed": ok, "user_id": _mask(user_id)}


@router.post("/member/phone/bind", summary="绑定手机 (需登录)")
def member_phone_bind_endpoint(
    user_id: str = Depends(get_current_user_id),
    payload: dict = Body(default={}),
    db=Depends(_get_db),
):
    """绑定手机 (需登录): 校验短信验证码后绑定."""
    phone = (payload.get("phone") or "").strip()
    code = (payload.get("code") or "").strip()
    if not phone or not code:
        raise HTTPException(status_code=400, detail="phone/code: 不能为空")
    ok = svc.bind_user_phone(db, user_uuid=str(user_id), phone=phone, code=code)
    return {"bound": ok, "user_id": _mask(user_id)}


@router.post("/member/phone/unbind", summary="解绑手机 (需登录)")
def member_phone_unbind_endpoint(
    user_id: str = Depends(get_current_user_id),
    payload: dict = Body(default={}),
    db=Depends(_get_db),
):
    """解绑手机 (需登录): 校验验证码后解绑."""
    code = (payload.get("code") or "").strip()
    if not code:
        raise HTTPException(status_code=400, detail="code: 不能为空")
    ok = svc.unbind_user_phone(db, user_uuid=str(user_id), code=code)
    return {"unbound": ok, "user_id": _mask(user_id)}


@router.post("/member/email/bind", summary="绑定邮箱 (需登录)")
def member_email_bind_endpoint(
    user_id: str = Depends(get_current_user_id),
    payload: dict = Body(default={}),
    db=Depends(_get_db),
):
    """绑定邮箱 (需登录): 发送验证邮件."""
    email = (payload.get("email") or "").strip()
    if not email:
        raise HTTPException(status_code=400, detail="email: 不能为空")
    result = svc.send_email_verify(db, user_uuid=str(user_id), email=email)
    result["user_id"] = _mask(user_id)
    return result


@router.post("/member/email/verify", summary="验证邮箱 (需登录)")
def member_email_verify_endpoint(
    user_id: str = Depends(get_current_user_id),
    payload: dict = Body(default={}),
    db=Depends(_get_db),
):
    """验证邮箱: 校验 verify_token 后标记邮箱已验证."""
    verify_token = (payload.get("verify_token") or "").strip()
    if not verify_token:
        raise HTTPException(status_code=400, detail="verify_token: 不能为空")
    ok = svc.verify_email_token(db, user_uuid=str(user_id), verify_token=verify_token)
    return {"verified": ok, "user_id": _mask(user_id)}


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
    items, total = svc.list_accounts(db, page=page, size=size, status=status)
    return {
        "total": total,
        "page": page,
        "size": size,
        "status": status,
        "items": [_to_dict(u) for u in items],
    }


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
    if account_id <= 0:
        raise HTTPException(status_code=400, detail="account_id: 必须为正数")
    status = (payload.get("status") or "").strip()
    if not status:
        raise HTTPException(status_code=400, detail="status: 不能为空")
    ok = svc.update_account_status(db, account_id=account_id, status=status)
    return {"updated": ok, "account_id": account_id, "status": status}


@router.post(
    "/member/account/{user_id}/freeze",
    summary="冻结用户 (admin)",
    dependencies=[Depends(require_role("admin"))],
)
def member_account_freeze_endpoint(user_id: int, payload: dict = Body(default={}), db=Depends(_get_db)):
    """冻结用户 (admin): 设置 status='1' (停用)."""
    if user_id <= 0:
        raise HTTPException(status_code=400, detail="user_id: 必须为正数")
    reason = (payload.get("reason") or "").strip()
    ok = svc.freeze_account(db, user_id=user_id, reason=reason)
    return {"frozen": ok, "user_id": user_id}


@router.post(
    "/member/account/{user_id}/unfreeze",
    summary="解冻用户 (admin)",
    dependencies=[Depends(require_role("admin"))],
)
def member_account_unfreeze_endpoint(user_id: int, db=Depends(_get_db)):
    """解冻用户 (admin): 设置 status='0' (启用)."""
    if user_id <= 0:
        raise HTTPException(status_code=400, detail="user_id: 必须为正数")
    ok = svc.unfreeze_account(db, user_id=user_id)
    return {"unfrozen": ok, "user_id": user_id}


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
    if user_id <= 0:
        raise HTTPException(status_code=400, detail="user_id: 必须为正数")
    return svc.list_account_logs(db, user_id=user_id, page=page, size=size)


@router.post(
    "/member/import",
    summary="批量导入会员 (admin)",
    dependencies=[Depends(require_role("admin"))],
)
def member_import_endpoint(payload: dict = Body(default={}), db=Depends(_get_db)):
    """批量导入会员 (admin): 接收会员列表, 批量创建."""
    members = payload.get("members")
    if not members or not isinstance(members, list) or len(members) == 0:
        raise HTTPException(status_code=400, detail="members: 不能为空")
    return svc.batch_import_members(db, members=members)


@router.get(
    "/member/export",
    summary="导出会员列表 (admin)",
    dependencies=[Depends(require_role("admin"))],
)
def member_export_endpoint(db=Depends(_get_db)):
    """导出会员列表 (admin): 异步任务, 返回 export_id 查询进度."""
    return svc.export_members(db)


@router.get(
    "/member/statistics",
    summary="会员统计 (admin)",
    dependencies=[Depends(require_role("admin"))],
)
def member_statistics_endpoint(db=Depends(_get_db)):
    """会员统计 (admin): 总数/新增/活跃/冻结等指标."""
    return svc.get_member_statistics(db)


# ===========================================================================
# 4. 课程相关基础端点 (14 个)
# ===========================================================================


@router.get("/learn/courses/enrolled", summary="我报名的课程")
def learn_courses_enrolled_endpoint(
    user_id: str = Depends(get_current_user_id),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db=Depends(_get_db),
):
    """查询当前用户已报名的课程列表."""
    return svc.list_enrolled_courses(db, user_id=str(user_id), page=page, size=size)


@router.get("/learn/courses/favorites", summary="我的收藏课程")
def learn_courses_favorites_endpoint(
    user_id: str = Depends(get_current_user_id),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db=Depends(_get_db),
):
    """查询当前用户收藏的课程列表."""
    return svc.list_favorite_courses(db, user_id=str(user_id), page=page, size=size)


@router.get("/learn/courses/recommended", summary="推荐课程")
def learn_courses_recommended_endpoint(
    user_id: str = Depends(get_current_user_id),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db=Depends(_get_db),
):
    """查询推荐课程列表 (基于 sort_weight 倒序)."""
    return svc.list_recommended_courses(db, user_id=str(user_id), page=page, size=size)


@router.get("/learn/courses/categories", summary="课程分类")
def learn_courses_categories_endpoint(db=Depends(_get_db)):
    """查询课程分类列表 (树形)."""
    return {"items": svc.list_course_categories(db)}


@router.post("/learn/courses/{course_id}/enroll", summary="报名课程")
def learn_course_enroll_endpoint(
    course_id: int,
    user_id: str = Depends(get_current_user_id),
    db=Depends(_get_db),
):
    """报名课程: 创建学习记录 (idempotent)."""
    if course_id <= 0:
        raise HTTPException(status_code=400, detail="course_id: 必须为正数")
    return svc.enroll_course(db, user_id=str(user_id), course_id=course_id)


@router.post("/learn/courses/{course_id}/cancel-enroll", summary="取消报名")
def learn_course_cancel_enroll_endpoint(
    course_id: int,
    user_id: str = Depends(get_current_user_id),
    db=Depends(_get_db),
):
    """取消报名: 软删除学习记录."""
    if course_id <= 0:
        raise HTTPException(status_code=400, detail="course_id: 必须为正数")
    ok = svc.cancel_enroll(db, user_id=str(user_id), course_id=course_id)
    return {"cancelled": ok, "course_id": course_id}


@router.get("/learn/courses/{course_id}/progress", summary="课程学习进度")
def learn_course_progress_endpoint(
    course_id: int,
    user_id: str = Depends(get_current_user_id),
    db=Depends(_get_db),
):
    """查询当前用户在某课程的学习进度."""
    if course_id <= 0:
        raise HTTPException(status_code=400, detail="course_id: 必须为正数")
    return svc.get_course_progress(db, user_id=str(user_id), course_id=course_id)


@router.post("/learn/courses/{course_id}/favorite", summary="收藏课程")
def learn_course_favorite_endpoint(
    course_id: int,
    user_id: str = Depends(get_current_user_id),
    db=Depends(_get_db),
):
    """收藏课程: 创建收藏记录 (idempotent)."""
    if course_id <= 0:
        raise HTTPException(status_code=400, detail="course_id: 必须为正数")
    ok = svc.favorite_course(db, user_id=str(user_id), course_id=course_id)
    return {"favorited": ok, "course_id": course_id}


@router.delete("/learn/courses/{course_id}/favorite", summary="取消收藏")
def learn_course_cancel_favorite_endpoint(
    course_id: int,
    user_id: str = Depends(get_current_user_id),
    db=Depends(_get_db),
):
    """取消收藏: 删除收藏记录."""
    if course_id <= 0:
        raise HTTPException(status_code=400, detail="course_id: 必须为正数")
    ok = svc.cancel_favorite_course(db, user_id=str(user_id), course_id=course_id)
    return {"unfavorited": ok, "course_id": course_id}


@router.post("/learn/courses/{course_id}/rate", summary="评分课程")
def learn_course_rate_endpoint(
    course_id: int,
    user_id: str = Depends(get_current_user_id),
    payload: dict = Body(default={}),
    db=Depends(_get_db),
):
    """评分课程: 提交评分 (1-5 星)."""
    if course_id <= 0:
        raise HTTPException(status_code=400, detail="course_id: 必须为正数")
    score = payload.get("score")
    if not isinstance(score, (int, float)) or score < 1 or score > 5:
        raise HTTPException(status_code=400, detail="score: 必须在 1-5 之间")
    return svc.rate_course(db, user_id=str(user_id), course_id=course_id, score=float(score))


@router.get("/learn/courses/{course_id}/comments", summary="课程评论列表")
def learn_course_comments_endpoint(
    course_id: int,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db=Depends(_get_db),
):
    """查询课程评论列表 (分页, Redis 存储)."""
    if course_id <= 0:
        raise HTTPException(status_code=400, detail="course_id: 必须为正数")
    return svc.list_course_comments(db, course_id=course_id, page=page, size=size)


@router.post("/learn/courses/{course_id}/comments", summary="发表课程评论")
def learn_course_post_comment_endpoint(
    course_id: int,
    user_id: str = Depends(get_current_user_id),
    payload: dict = Body(default={}),
    db=Depends(_get_db),
):
    """发表课程评论 (需登录)."""
    if course_id <= 0:
        raise HTTPException(status_code=400, detail="course_id: 必须为正数")
    content = (payload.get("content") or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="content: 不能为空")
    if len(content) > 1000:
        raise HTTPException(status_code=400, detail="content: 过长 (最多 1000 字)")
    return svc.post_course_comment(db, user_id=str(user_id), course_id=course_id, content=content)


@router.delete("/learn/courses/comments/{comment_id}", summary="删除课程评论")
def learn_course_delete_comment_endpoint(
    comment_id: str,
    user_id: str = Depends(get_current_user_id),
    db=Depends(_get_db),
):
    """删除课程评论 (本人或 admin)."""
    if not comment_id:
        raise HTTPException(status_code=400, detail="comment_id: 不能为空")
    # 判断当前用户是否为 admin
    from app.security import _check_role_sync
    is_admin = _check_role_sync(str(user_id), "admin")
    ok = svc.delete_course_comment(
        user_id=str(user_id), comment_id=comment_id, is_admin=is_admin,
    )
    return {"deleted": ok, "comment_id": comment_id}


@router.post("/learn/courses/{course_id}/complete", summary="标记课程完成")
def learn_course_complete_endpoint(
    course_id: int,
    user_id: str = Depends(get_current_user_id),
    db=Depends(_get_db),
):
    """标记课程完成: 更新进度 100%, 触发证书发放."""
    if course_id <= 0:
        raise HTTPException(status_code=400, detail="course_id: 必须为正数")
    return svc.mark_course_complete(db, user_id=str(user_id), course_id=course_id)


# ===========================================================================
# 工具函数
# ===========================================================================


def _mask(value: str | None) -> str:
    """敏感信息脱敏: 保留首尾各 2 位, 中间用 * 替换."""
    if not value:
        return ""
    s = str(value)
    if len(s) <= 4:
        return "*" * len(s)
    return s[:2] + "*" * (len(s) - 4) + s[-2:]
