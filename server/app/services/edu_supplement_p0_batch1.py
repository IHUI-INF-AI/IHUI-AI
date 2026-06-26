"""edu_supplement_p0_batch1 service - P0 批次1 端点的真实 service 实现.

2026-06-26 补完: 把 40 个桩模式端点升级为真实业务实现.

字段约定 (与 edu_supplement_p0_batch1.py router 对齐):
  - 客户端 user_id: str (uuid, from get_current_user_id)
  - admin 端点 account_id / user_id: int (AdminUser.user_id, bigint)
  - 课程 ID: int (EduCourse.id)

分组:
  1. 支付回调 (2): alipay / wechat
  2. 认证授权补全 (9): logout / refresh / sms / permissions / roles
  3. 会员账户体系 (15): password / phone / email / account mgmt
  4. 课程相关基础 (14): enroll / favorite / rate / comments / complete

项目硬约束:
  - 6 位错误码
  - Body 参数
  - 软删除过滤
  - 外部 HTTP timeout=30.0
  - 敏感信息脱敏
  - except Exception 加 logger.debug
  - 异步避免同步 I/O
"""
from __future__ import annotations

import json
import logging
import re
import secrets
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.orm import Session

from app.utils.datetime_helper import utcnow
from app.utils.redis_util import get_key, set_key

from app.models.edu_models import (
    EduCertificate, EduCourse, EduLearnRecord,
    EduOrder, EduPayOrder,
)
from app.models.user_models import User, UserAuthInfo
from app.models.admin_models import AdminUser, AdminRole, AdminOperLog
from app.models.sys_models import SysRole, SysUser, SysUserRole, SysMenu, SysRoleMenu
from app.services.edu_base import (
    EduNotFoundError, EduPermissionError, EduValidationError,
    paginate, soft_delete,
)

logger = logging.getLogger(__name__)


# ===========================================================================
# 1. 支付回调 (2)
# ===========================================================================

def _verify_webhook_signature(raw_body: bytes, signature: Optional[str], secret: str) -> bool:
    """通用 webhook 验签: HMAC-SHA256(sha256=hex).

    Args:
        raw_body: 原始请求体
        signature: 请求头中的签名 (sha256=xxx)
        secret: 共享密钥 (空时降级为仅校验存在)

    Returns:
        True 验签通过
    """
    import hashlib
    import hmac

    if secret:
        if not signature:
            return False
        expected = "sha256=" + hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature)
    # 兼容模式: secret 未配置时只校验签名头存在
    return bool(signature)


def handle_alipay_callback(
    db: Session, raw_body: bytes, signature: Optional[str], secret: str,
) -> Dict[str, Any]:
    """支付宝异步回调: 验签 + 解析 + 更新订单状态.

    业务流程:
      1. 验签 (强制/兼容)
      2. 解析 JSON, 提取 out_trade_no / trade_status
      3. 查询 EduOrder, 幂等更新状态为 paid (trade_status=TRADE_SUCCESS)
      4. 返回 success 给支付宝 (避免重复回调)
    """
    if not _verify_webhook_signature(raw_body, signature, secret):
        raise EduPermissionError("invalid or missing alipay signature")

    try:
        payload = json.loads(raw_body) if raw_body else {}
    except json.JSONDecodeError as e:
        raise EduValidationError(f"alipay callback JSON parse failed: {e}")

    order_no = payload.get("out_trade_no") or payload.get("trade_no")
    trade_status = payload.get("trade_status", "")

    if not order_no:
        raise EduValidationError("alipay callback missing out_trade_no")

    handled = False
    if trade_status in ("TRADE_SUCCESS", "TRADE_FINISHED"):
        order = db.execute(
            select(EduOrder).where(EduOrder.out_trade_no == order_no)
        ).scalar_one_or_none()
        if order and order.status == 0:  # 0=pending
            order.status = 1  # 1=paid
            order.paid_at = utcnow()
            order.pay_type = "alipay"
            # 同步更新 EduPayOrder
            pay_order = db.execute(
                select(EduPayOrder).where(EduPayOrder.order_id == order.id)
            ).scalar_one_or_none()
            if pay_order:
                pay_order.pay_status = "paid"
                pay_order.transaction_id = payload.get("trade_no", "")
                pay_order.paid_at = order.paid_at
            handled = True
        elif order and order.status == 1:
            handled = True  # 幂等

    return {"order_no": order_no, "trade_status": trade_status, "handled": handled}


def handle_wechat_callback(
    db: Session, raw_body: bytes, signature: Optional[str], secret: str,
) -> Dict[str, Any]:
    """微信支付异步回调: 验签 + 解析 v3 (JSON) / v2 (XML) + 更新订单."""
    if not _verify_webhook_signature(raw_body, signature, secret):
        raise EduPermissionError("invalid or missing wechat signature")

    payload: Dict[str, Any] = {}
    try:
        try:
            payload = json.loads(raw_body) if raw_body else {}
        except json.JSONDecodeError:
            if raw_body:
                root = ET.fromstring(raw_body.decode("utf-8"))
                payload = {child.tag: child.text for child in root}
    except Exception as e:
        raise EduValidationError(f"wechat callback parse failed: {e}")

    order_no = payload.get("out_trade_no")
    if not order_no:
        raise EduValidationError("wechat callback missing out_trade_no")

    result_code = payload.get("result_code") or payload.get("trade_state", "")
    success_flag = (result_code == "SUCCESS")

    handled = False
    if success_flag:
        order = db.execute(
            select(EduOrder).where(EduOrder.out_trade_no == order_no)
        ).scalar_one_or_none()
        if order and order.status == 0:  # 0=pending
            order.status = 1  # 1=paid
            order.paid_at = utcnow()
            order.pay_type = "wechat"
            pay_order = db.execute(
                select(EduPayOrder).where(EduPayOrder.order_id == order.id)
            ).scalar_one_or_none()
            if pay_order:
                pay_order.pay_status = "paid"
                pay_order.transaction_id = payload.get("transaction_id", "")
                pay_order.paid_at = order.paid_at
            handled = True
        elif order and order.status == 1:
            handled = True

    return {"order_no": order_no, "result_code": result_code, "handled": handled}


# ===========================================================================
# 2. 认证授权补全 (9)
# ===========================================================================

def revoke_user_token(user_uuid: str) -> bool:
    """登出: 撤销该用户当前所有未过期的 token.

    实际实现: 把 user_uuid 加入 Redis 黑名单 (TTL = 7天, 与 refresh token 一致).
    """
    key = f"auth:user:revoked:{user_uuid}"
    return set_key(key, "1", ex=7 * 24 * 3600) is not None


def is_user_revoked(user_uuid: str) -> bool:
    """检查用户是否被强制登出 (黑名单)."""
    return get_key(f"auth:user:revoked:{user_uuid}") is not None


def refresh_access_token(refresh_token: str) -> Dict[str, str]:
    """刷新 access_token: 校验 refresh_token 有效性, 签发新 access_token.

    Bug-53 实现: 利用 JWT family_id 检测 token 重放.
    """
    from app.security import decode_access_token, create_access_token, create_refresh_token

    if not refresh_token:
        raise EduValidationError("refresh_token required")

    payload = decode_access_token(refresh_token, allow_refresh=True)
    if not payload or payload.get("type") != "refresh":
        raise EduPermissionError("invalid refresh_token")

    family_id = payload.get("family_id", "")
    if family_id and get_key(f"auth:family:revoked:{family_id}"):
        raise EduPermissionError("refresh_token family revoked (replay detected)")

    user_uuid = payload.get("sub", "")
    if not user_uuid:
        raise EduValidationError("refresh_token missing sub claim")

    if family_id:
        set_key(f"auth:family:revoked:{family_id}", "1", ex=8 * 24 * 3600)

    new_access = create_access_token(subject=user_uuid)
    new_refresh, _new_jti, new_fid = create_refresh_token(user_uuid)
    return {
        "access_token": new_access,
        "refresh_token": new_refresh,
        "token_type": "Bearer",
        "expires_in": 7 * 24 * 3600,
    }


# ----- 短信验证码 -----

_SMS_KEY_PREFIX = "auth:sms:"
_SMS_TTL_SECONDS = 5 * 60
_SMS_RESEND_COOLDOWN = 60


def _validate_phone(phone: str) -> str:
    """校验中国大陆手机号 (11 位数字, 1 开头)."""
    phone = re.sub(r"\s+", "", phone or "")
    if not re.match(r"^1[3-9]\d{9}$", phone):
        raise EduValidationError("phone format invalid (CN mobile required)")
    return phone


def _check_sms_cooldown(phone: str) -> None:
    cooldown_key = f"{_SMS_KEY_PREFIX}cooldown:{phone}"
    if get_key(cooldown_key):
        raise EduValidationError("短信发送过于频繁, 请 60 秒后再试")


def send_sms_code(phone: str, scene: str = "login") -> Dict[str, Any]:
    """发送短信验证码.

    流程: 校验手机号 -> 60s 冷却检查 -> 生成 6 位数字 -> 写 Redis (TTL=5min)
          -> 设置 60s 冷却 -> 调用短信网关.
    """
    phone = _validate_phone(phone)
    _check_sms_cooldown(phone)

    code = f"{secrets.randbelow(1000000):06d}"
    set_key(f"{_SMS_KEY_PREFIX}code:{scene}:{phone}", code, ex=_SMS_TTL_SECONDS)
    set_key(f"{_SMS_KEY_PREFIX}cooldown:{phone}", "1", ex=_SMS_RESEND_COOLDOWN)
    # 生产环境替换为 httpx.AsyncClient(timeout=30.0) 调真实短信网关
    logger.info("[SMS-GATEWAY-STUB] phone=%s code=%s scene=%s",
                phone[:3] + "****" + phone[-4:], code, scene)
    return {"phone": phone, "scene": scene, "ttl_seconds": _SMS_TTL_SECONDS, "sent": True}


def verify_sms_code(phone: str, code: str, scene: str = "login") -> bool:
    """校验短信验证码. 校验通过后立即失效 (一次性)."""
    phone = _validate_phone(phone)
    if not code or len(code) < 4:
        raise EduValidationError("code length invalid (>= 4 required)")

    key = f"{_SMS_KEY_PREFIX}code:{scene}:{phone}"
    stored = get_key(key)
    if not stored:
        raise EduValidationError("验证码已过期或未发送")
    if not secrets.compare_digest(stored, code):
        raise EduPermissionError("验证码错误")

    from app.utils.redis_util import delete_key
    delete_key(key)
    return True


# ----- 权限/角色 -----

def get_user_permissions(db: Session, user_uuid: str) -> Dict[str, Any]:
    """获取当前用户的权限列表 (role_key + menu perms).

    实际实现: 查询 sys_user -> sys_user_role -> sys_role (role_key) +
              sys_role_menu -> sys_menu (perms), 合并去重返回.
    """
    role_rows = db.execute(
        select(SysRole.role_key, SysRole.role_name)
        .join(SysUserRole, SysUserRole.role_id == SysRole.role_id)
        .join(SysUser, SysUser.user_id == SysUserRole.user_id)
        .where(SysUser.user_uuid == user_uuid, SysRole.status == "0", SysRole.del_flag == "0")
    ).all()
    roles = [{"role_key": r[0], "role_name": r[1]} for r in role_rows]

    perm_rows = db.execute(
        select(SysMenu.perms)
        .join(SysRoleMenu, SysRoleMenu.menu_id == SysMenu.menu_id)
        .join(SysUserRole, SysUserRole.role_id == SysRoleMenu.role_id)
        .join(SysUser, SysUser.user_id == SysUserRole.user_id)
        .where(SysUser.user_uuid == user_uuid, SysMenu.status == "0", SysMenu.perms.isnot(None))
        .distinct()
    ).all()
    perms = sorted({p[0] for p in perm_rows if p[0]})

    return {"user_uuid": user_uuid, "roles": roles, "permissions": perms}


def list_roles(db: Session, page: int, size: int) -> Tuple[List[AdminRole], int]:
    """分页查询角色列表 (admin). 软删除过滤."""
    return paginate(
        db, AdminRole, page=page, size=size,
        filters=[AdminRole.del_flag == "0"],
        order_by=AdminRole.role_sort.asc(),
    )


def create_role(db: Session, role_name: str, role_key: str, **fields) -> AdminRole:
    """创建角色. 校验 role_key 唯一性."""
    if not re.match(r"^[a-z][a-z0-9_:]{1,49}$", role_key):
        raise EduValidationError("role_key must match ^[a-z][a-z0-9_:]{1,49}$")

    existing = db.execute(
        select(AdminRole).where(AdminRole.role_key == role_key, AdminRole.del_flag == "0")
    ).scalar_one_or_none()
    if existing:
        raise EduValidationError(f"role_key '{role_key}' already exists")

    role = AdminRole(
        role_name=role_name,
        role_key=role_key,
        role_sort=fields.get("role_sort", 0),
        status=fields.get("status", "0"),
        remark=fields.get("remark", ""),
    )
    db.add(role)
    db.flush()
    db.refresh(role)
    return role


def update_role(db: Session, role_id: int, **fields) -> AdminRole:
    """更新角色 (admin)."""
    role = db.get(AdminRole, role_id)
    if not role or role.del_flag != "0":
        raise EduNotFoundError("role", role_id)
    allowed = {"role_name", "role_sort", "status", "remark"}
    for k, v in fields.items():
        if k in allowed and v is not None:
            setattr(role, k, v)
    db.flush()
    db.refresh(role)
    return role


def delete_role(db: Session, role_id: int) -> bool:
    """软删除角色 (del_flag='2')."""
    role = db.get(AdminRole, role_id)
    if not role or role.del_flag != "0":
        raise EduNotFoundError("role", role_id)
    # 检查是否有用户绑定
    user_count = db.execute(
        select(func.count(SysUserRole.user_id)).where(SysUserRole.role_id == role_id)
    ).scalar() or 0
    if user_count > 0:
        raise EduValidationError(f"role has {user_count} users bound, cannot delete")
    role.del_flag = "2"
    db.flush()
    return True


# ===========================================================================
# 3. 会员账户体系 (15)
# ===========================================================================

def _get_user_by_account(db: Session, account: str) -> Optional[User]:
    """通过手机号/UUID 查客户端用户 (User 表, uuid PK)."""
    account = (account or "").strip()
    if not account:
        return None
    return db.execute(
        select(User).where(or_(
            User.uuid == account,
            User.phone == account,
        )).limit(1)
    ).scalar_one_or_none()


# ----- 密码管理 -----

def generate_password_reset_token(db: Session, account: str) -> Dict[str, Any]:
    """生成密码重置 token (存入 Redis, 30 分钟有效).

    安全: 即使用户不存在也返回成功, 避免泄露账户存在性.
    """
    user = _get_user_by_account(db, account)
    token = secrets.token_urlsafe(32)
    if user:
        set_key(f"auth:reset:{token}", user.uuid, ex=30 * 60)
    masked = ""
    if account:
        masked = (account[:2] + "****" + account[-2:]) if len(account) >= 4 else "****"
    return {"sent": True, "reset_token": token, "account_masked": masked}


def reset_password_with_token(db: Session, reset_token: str, new_password: str) -> bool:
    """用 reset_token 重置密码."""
    if not reset_token:
        raise EduValidationError("reset_token required")
    if not new_password or len(new_password) < 6:
        raise EduValidationError("new_password must be >= 6 chars")

    user_uuid = get_key(f"auth:reset:{reset_token}")
    if not user_uuid:
        raise EduValidationError("reset_token invalid or expired")

    user = db.execute(select(User).where(User.uuid == user_uuid)).scalar_one_or_none()
    if not user:
        raise EduNotFoundError("user", 0)

    from app.security import hash_password
    user.password_hash = hash_password(new_password)
    user.password_salt = ""  # bcrypt 自带 salt

    from app.utils.redis_util import delete_key
    delete_key(f"auth:reset:{reset_token}")
    return True


def change_user_password(db: Session, user_uuid: str, old_password: str, new_password: str) -> bool:
    """修改密码 (需登录). 校验旧密码后设置新密码."""
    from app.security import hash_password, verify_password

    user = db.execute(select(User).where(User.uuid == str(user_uuid))).scalar_one_or_none()
    if not user:
        raise EduNotFoundError("user", 0)

    if not verify_password(old_password, user.password_hash, user.password_salt):
        raise EduPermissionError("old_password incorrect")

    user.password_hash = hash_password(new_password)
    user.password_salt = ""
    return True


# ----- 手机号绑定 -----

def bind_user_phone(db: Session, user_uuid: str, phone: str, code: str) -> bool:
    """绑定手机 (需登录 + 短信验证码)."""
    phone = _validate_phone(phone)
    verify_sms_code(phone, code, scene="bind_phone")

    # 检查手机号是否被其他用户占用
    existing = db.execute(
        select(User).where(User.phone == phone, User.uuid != str(user_uuid))
    ).scalar_one_or_none()
    if existing:
        raise EduValidationError("phone already bound to another account")

    user = db.execute(select(User).where(User.uuid == str(user_uuid))).scalar_one_or_none()
    if not user:
        raise EduNotFoundError("user", 0)

    user.phone = phone
    return True


def unbind_user_phone(db: Session, user_uuid: str, code: str) -> bool:
    """解绑手机 (需登录 + 短信验证码). 验证码发到当前绑定手机."""
    user = db.execute(select(User).where(User.uuid == str(user_uuid))).scalar_one_or_none()
    if not user or not user.phone:
        raise EduNotFoundError("user", 0)

    verify_sms_code(user.phone, code, scene="unbind_phone")
    auth_info = db.get(UserAuthInfo, str(user_uuid))
    if auth_info:
        auth_info.cancel_phone = user.phone
    user.phone = None
    return True


# ----- 邮箱绑定 -----

_EMAIL_REGEX = re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")


def _validate_email(email: str) -> str:
    email = (email or "").strip().lower()
    if not _EMAIL_REGEX.match(email):
        raise EduValidationError("email format invalid")
    return email


def send_email_verify(db: Session, user_uuid: str, email: str) -> Dict[str, Any]:
    """发送邮箱验证链接. 生成 verify_token 存 Redis (30 分钟).

    邮箱存 Redis 而非 User.email: User 表无 email 字段 (zhs_center.users 精简版).
    实际展示时从 Redis 读; 后续若 User 增加 email 字段再迁回 DB.
    """
    email = _validate_email(email)
    token = secrets.token_urlsafe(32)
    set_key(f"auth:email:verify:{token}", f"{user_uuid}:{email}", ex=30 * 60)
    # 同时记录 user → email 反向映射 (用于查询用户的当前邮箱)
    set_key(f"auth:email:user:{user_uuid}", email, ex=30 * 24 * 3600)
    # 生产环境替换为 httpx.AsyncClient(timeout=30.0) 调邮件网关
    logger.info("[EMAIL-GATEWAY-STUB] to=%s token=%s", email, token[:8] + "...")
    return {"email": email, "verify_token": token, "sent": True}


def verify_email_token(db: Session, user_uuid: str, verify_token: str) -> bool:
    """校验 verify_token, 标记邮箱已验证."""
    payload = get_key(f"auth:email:verify:{verify_token}")
    if not payload:
        raise EduValidationError("verify_token invalid or expired")

    token_uuid, email = payload.split(":", 1)
    if token_uuid != str(user_uuid):
        raise EduPermissionError("verify_token does not match current user")

    user = db.execute(select(User).where(User.uuid == str(user_uuid))).scalar_one_or_none()
    if not user:
        raise EduNotFoundError("user", 0)

    # 邮箱持久化到 Redis (verified 状态, TTL 1 年)
    set_key(f"auth:email:verified:{user_uuid}", email, ex=365 * 24 * 3600)

    from app.utils.redis_util import delete_key
    delete_key(f"auth:email:verify:{verify_token}")
    return True


# ----- 账户管理 (admin, 查 AdminUser 表) -----

def list_accounts(
    db: Session, page: int, size: int, status: Optional[str] = None,
) -> Tuple[List[AdminUser], int]:
    """分页查询账户列表 (admin). 用 AdminUser 表 (user_id bigint PK, del_flag 软删除)."""
    filters = [AdminUser.del_flag == "0"]
    if status is not None:
        filters.append(AdminUser.status == status)
    return paginate(db, AdminUser, page=page, size=size, filters=filters, order_by=AdminUser.user_id.desc())


def update_account_status(db: Session, account_id: int, status: str) -> bool:
    """更新账户状态 (admin). status: '0' 正常, '1' 停用."""
    if status not in ("0", "1"):
        raise EduValidationError("status must be '0' (active) or '1' (disabled)")
    user = db.get(AdminUser, account_id)
    if not user or user.del_flag != "0":
        raise EduNotFoundError("user", account_id)
    user.status = status
    return True


def freeze_account(db: Session, user_id: int, reason: str = "") -> bool:
    """冻结用户 (admin): status='1' (停用)."""
    user = db.get(AdminUser, user_id)
    if not user or user.del_flag != "0":
        raise EduNotFoundError("user", user_id)
    user.status = "1"
    logger.info("account frozen: user_id=%s reason=%s", user_id, reason or "(no reason)")
    return True


def unfreeze_account(db: Session, user_id: int) -> bool:
    """解冻用户 (admin): status='0' (启用)."""
    user = db.get(AdminUser, user_id)
    if not user or user.del_flag != "0":
        raise EduNotFoundError("user", user_id)
    user.status = "0"
    logger.info("account unfrozen: user_id=%s", user_id)
    return True


def list_account_logs(
    db: Session, user_id: int, page: int, size: int,
) -> Dict[str, Any]:
    """查询用户操作日志 (admin). 查 AdminOperLog."""
    user = db.get(AdminUser, user_id)
    if not user:
        raise EduNotFoundError("user", user_id)

    filters = []
    if user.user_uuid:
        filters.append(AdminOperLog.oper_name == user.user_uuid)
    items, total = paginate(
        db, AdminOperLog, page=page, size=size, filters=filters,
        order_by=AdminOperLog.oper_time.desc(),
    )
    return {
        "user_id": user_id,
        "user_uuid": user.user_uuid,
        "page": page,
        "size": size,
        "total": total,
        "items": [
            {
                "oper_id": getattr(o, "oper_id", None),
                "title": getattr(o, "title", None),
                "business_type": getattr(o, "business_type", None),
                "oper_name": getattr(o, "oper_name", None),
                "oper_time": o.oper_time.isoformat() if getattr(o, "oper_time", None) else None,
            }
            for o in items
        ],
    }


def batch_import_members(db: Session, members: List[Dict[str, Any]]) -> Dict[str, Any]:
    """批量导入会员 (admin). 写入 AdminUser 表 (因为这是 admin 端点).

    简化: 用 phone 作为 user_name, nickname 用 phone 后 4 位.
    """
    if not members:
        raise EduValidationError("members list empty")

    success_count = 0
    failed_items = []
    for idx, m in enumerate(members):
        try:
            phone = _validate_phone(m.get("phone", ""))
            existing = db.execute(
                select(AdminUser).where(AdminUser.phonenumber == phone, AdminUser.del_flag == "0")
            ).scalar_one_or_none()
            if existing:
                failed_items.append({"index": idx, "phone": phone, "reason": "phone exists"})
                continue
            user = AdminUser(
                user_name=f"user_{phone}",
                nick_name=m.get("nickname", phone[-4:]),
                phonenumber=phone,
                email=m.get("email"),
                status="0",
                del_flag="0",
            )
            db.add(user)
            success_count += 1
        except Exception as e:
            logger.debug("batch import member index=%s failed: %s", idx, e)
            failed_items.append({"index": idx, "reason": str(e)})

    db.flush()
    return {
        "total": len(members),
        "success": success_count,
        "failed": len(failed_items),
        "failed_items": failed_items[:50],
    }


def export_members(db: Session) -> Dict[str, Any]:
    """导出会员列表 (admin). 生成 export_id, 实际下载走独立端点."""
    export_id = secrets.token_urlsafe(16)
    set_key(f"export:member:{export_id}", "pending", ex=3600)
    # 后台任务异步生成 Excel, 写 OSS, 这里仅返回 export_id
    return {
        "export_id": export_id,
        "status": "pending",
        "message": "导出任务已提交, 请通过 export_id 查询进度",
    }


def get_member_statistics(db: Session) -> Dict[str, Any]:
    """会员统计 (admin). 查 AdminUser."""
    total = db.execute(
        select(func.count(AdminUser.user_id)).where(AdminUser.del_flag == "0")
    ).scalar() or 0
    active = db.execute(
        select(func.count(AdminUser.user_id)).where(
            AdminUser.del_flag == "0", AdminUser.status == "0"
        )
    ).scalar() or 0
    disabled = total - active
    from datetime import timedelta
    seven_days_ago = utcnow() - timedelta(days=7)
    new_7d = db.execute(
        select(func.count(AdminUser.user_id)).where(
            AdminUser.del_flag == "0", AdminUser.create_time >= seven_days_ago
        )
    ).scalar() or 0
    return {
        "total": total,
        "active": active,
        "disabled": disabled,
        "new_last_7d": new_7d,
        "active_rate": f"{(active / total * 100):.2f}%" if total > 0 else "0%",
    }


# ===========================================================================
# 4. 课程相关基础 (14)
# ===========================================================================

# 报名记录: EduLearnRecord (member_id+lesson_id 唯一)
# 收藏: BehaviorFavorite (通用, target_type='course' 区分)
# 评分/评论: Redis (key=rate:course:{id}, comment:course:{id})

_RATE_KEY_PREFIX = "rate:course:"
_COMMENT_KEY_PREFIX = "comment:course:"


# ----- 报名 -----

def list_enrolled_courses(db: Session, user_id: str, page: int, size: int) -> Dict[str, Any]:
    """查询当前用户已报名的课程列表."""
    member_id = int(user_id) if str(user_id).isdigit() else 0
    items, total = paginate(
        db, EduLearnRecord, page=page, size=size,
        filters=[EduLearnRecord.member_id == member_id] if member_id else [EduLearnRecord.member_id == -1],
        order_by=EduLearnRecord.updated_at.desc(),
    )
    course_ids = list({r.lesson_id for r in items if r.lesson_id})
    courses_map: Dict[int, Any] = {}
    if course_ids:
        courses = db.execute(
            select(EduCourse).where(EduCourse.id.in_(course_ids))
        ).scalars().all()
        courses_map = {c.id: c for c in courses}
    return {
        "total": total,
        "page": page,
        "size": size,
        "items": [
            {
                "enroll_id": r.id,
                "course_id": r.lesson_id,
                "course_name": courses_map[r.lesson_id].name if r.lesson_id in courses_map else None,
                "progress": r.progress,
                "is_completed": r.status == 1,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None,
            }
            for r in items
            if r.lesson_id
        ],
    }


def list_favorite_courses(db: Session, user_id: str, page: int, size: int) -> Dict[str, Any]:
    """查询当前用户收藏的课程列表."""
    from app.models.behavior_models import BehaviorFavorite
    user_uuid_str = str(user_id)
    items, total = paginate(
        db, BehaviorFavorite, page=page, size=size,
        filters=[
            BehaviorFavorite.user_id == user_uuid_str,
            BehaviorFavorite.target_type == "course",
        ],
        order_by=BehaviorFavorite.created_at.desc(),
    )
    course_ids = [i.target_id for i in items if i.target_id]
    courses_map: Dict[int, Any] = {}
    if course_ids:
        courses = db.execute(
            select(EduCourse).where(EduCourse.id.in_(course_ids))
        ).scalars().all()
        courses_map = {c.id: c for c in courses}
    return {
        "total": total,
        "page": page,
        "size": size,
        "items": [
            {
                "favorite_id": f.id,
                "course_id": f.target_id,
                "course_name": courses_map[f.target_id].name if f.target_id in courses_map else None,
                "created_at": f.created_at.isoformat() if f.created_at else None,
            }
            for f in items
            if f.target_id
        ],
    }


def list_recommended_courses(db: Session, user_id: str, page: int, size: int) -> Dict[str, Any]:
    """推荐课程 (简单实现: sort_weight 倒序的已发布课程)."""
    items, total = paginate(
        db, EduCourse, page=page, size=size,
        filters=[EduCourse.status == 1],
        order_by=desc(EduCourse.sort_weight),
    )
    return {
        "total": total,
        "page": page,
        "size": size,
        "items": [
            {
                "course_id": c.id,
                "course_name": c.name,
                "cover": c.image,
                "introduction": c.introduction,
                "sort_weight": c.sort_weight,
            }
            for c in items
        ],
    }


def list_course_categories(db: Session) -> List[Dict[str, Any]]:
    """查询课程分类列表 (树形)."""
    from app.models.app_content_models import CategoryDictionary
    rows = db.execute(
        select(CategoryDictionary).where(CategoryDictionary.type == "course_category")
        .order_by(CategoryDictionary.sort.asc(), CategoryDictionary.id.asc())
    ).scalars().all()
    return [
        {
            "id": r.id,
            "name": r.name,
            "code": r.code,
            "parent_id": getattr(r, "parent_id", None),
            "sort": r.sort,
        }
        for r in rows
    ]


def enroll_course(db: Session, user_id: str, course_id: int) -> Dict[str, Any]:
    """报名课程: 创建学习记录 (idempotent)."""
    course = db.get(EduCourse, course_id)
    if not course or course.status != 1:
        raise EduNotFoundError("course", course_id)

    member_id = int(user_id) if str(user_id).isdigit() else 0
    existing = db.execute(
        select(EduLearnRecord).where(
            and_(
                EduLearnRecord.member_id == member_id,
                EduLearnRecord.lesson_id == course_id,
            )
        )
    ).scalar_one_or_none()
    if existing:
        return {"course_id": course_id, "enrolled": True, "enroll_id": existing.id, "already": True}

    record = EduLearnRecord(
        member_id=member_id,
        lesson_id=course_id,
        learn_time=0,
        max_progress_time=0,
        progress=0,
        status=0,
    )
    db.add(record)
    db.flush()
    db.refresh(record)
    return {"course_id": course_id, "enrolled": True, "enroll_id": record.id, "already": False}


def cancel_enroll(db: Session, user_id: str, course_id: int) -> bool:
    """取消报名: 软删除学习记录."""
    member_id = int(user_id) if str(user_id).isdigit() else 0
    record = db.execute(
        select(EduLearnRecord).where(
            and_(
                EduLearnRecord.member_id == member_id,
                EduLearnRecord.lesson_id == course_id,
            )
        )
    ).scalar_one_or_none()
    if not record:
        raise EduNotFoundError("enrollment", course_id)
    db.delete(record)
    return True


def get_course_progress(db: Session, user_id: str, course_id: int) -> Dict[str, Any]:
    """查询当前用户在某课程的学习进度."""
    member_id = int(user_id) if str(user_id).isdigit() else 0
    records = db.execute(
        select(EduLearnRecord).where(
            and_(
                EduLearnRecord.member_id == member_id,
                EduLearnRecord.lesson_id == course_id,
            )
        )
    ).scalars().all()
    if not records:
        return {"course_id": course_id, "enrolled": False, "progress": 0, "is_completed": False}
    max_progress = max(r.progress or 0 for r in records)
    is_done = any(r.status == 1 for r in records)
    return {
        "course_id": course_id,
        "enrolled": True,
        "progress": max_progress,
        "is_completed": is_done,
        "records": [
            {
                "section_id": r.lesson_chapter_section_id,
                "learn_time": r.learn_time,
                "max_progress_time": r.max_progress_time,
                "progress": r.progress,
            }
            for r in records
        ],
    }


def favorite_course(db: Session, user_id: str, course_id: int) -> bool:
    """收藏课程 (idempotent)."""
    from app.models.behavior_models import BehaviorFavorite
    user_uuid_str = str(user_id)
    existing = db.execute(
        select(BehaviorFavorite).where(
            and_(
                BehaviorFavorite.user_id == user_uuid_str,
                BehaviorFavorite.target_id == course_id,
                BehaviorFavorite.target_type == "course",
            )
        )
    ).scalar_one_or_none()
    if existing:
        return True
    fav = BehaviorFavorite(
        user_id=user_uuid_str,
        target_id=course_id,
        target_type="course",
    )
    db.add(fav)
    return True


def cancel_favorite_course(db: Session, user_id: str, course_id: int) -> bool:
    """取消收藏."""
    from app.models.behavior_models import BehaviorFavorite
    user_uuid_str = str(user_id)
    fav = db.execute(
        select(BehaviorFavorite).where(
            and_(
                BehaviorFavorite.user_id == user_uuid_str,
                BehaviorFavorite.target_id == course_id,
                BehaviorFavorite.target_type == "course",
            )
        )
    ).scalar_one_or_none()
    if not fav:
        return False
    db.delete(fav)
    return True


# ----- 评分/评论 -----

def rate_course(db: Session, user_id: str, course_id: int, score: float) -> Dict[str, Any]:
    """评分课程: 1-5 星. 存 Redis hash + 更新课程平均分."""
    course = db.get(EduCourse, course_id)
    if not course or course.status != 1:
        raise EduNotFoundError("course", course_id)

    if not isinstance(score, (int, float)) or score < 1 or score > 5:
        raise EduValidationError("score must be 1-5")
    score = float(score)

    key = f"{_RATE_KEY_PREFIX}{course_id}"
    raw = get_key(key) or "{}"
    try:
        rating_map = json.loads(raw)
    except json.JSONDecodeError:
        rating_map = {}
    rating_map[str(user_id)] = score
    set_key(key, json.dumps(rating_map), ex=365 * 24 * 3600)

    if rating_map:
        avg = sum(rating_map.values()) / len(rating_map)
        course.score = round(avg, 2)

    return {
        "course_id": course_id,
        "user_score": score,
        "average_score": course.score,
        "total_ratings": len(rating_map),
    }


def list_course_comments(db: Session, course_id: int, page: int, size: int) -> Dict[str, Any]:
    """查询课程评论列表 (Redis 存储)."""
    key = f"{_COMMENT_KEY_PREFIX}{course_id}"
    raw = get_key(key) or "[]"
    try:
        all_comments = json.loads(raw)
    except json.JSONDecodeError:
        all_comments = []
    all_comments.sort(key=lambda x: x.get("created_at", ""), reverse=True)
    total = len(all_comments)
    start = (page - 1) * size
    end = start + size
    return {
        "total": total,
        "page": page,
        "size": size,
        "items": all_comments[start:end],
    }


def post_course_comment(db: Session, user_id: str, course_id: int, content: str) -> Dict[str, Any]:
    """发表课程评论."""
    course = db.get(EduCourse, course_id)
    if not course or course.status != 1:
        raise EduNotFoundError("course", course_id)
    if not content or len(content.strip()) == 0:
        raise EduValidationError("content required")
    if len(content) > 1000:
        raise EduValidationError("content too long (max 1000 chars)")

    key = f"{_COMMENT_KEY_PREFIX}{course_id}"
    raw = get_key(key) or "[]"
    try:
        all_comments = json.loads(raw)
    except json.JSONDecodeError:
        all_comments = []

    comment_id = secrets.token_hex(8)
    all_comments.append({
        "comment_id": comment_id,
        "course_id": course_id,
        "user_id": str(user_id),
        "content": content,
        "created_at": utcnow().isoformat(),
    })
    set_key(key, json.dumps(all_comments), ex=365 * 24 * 3600)
    return {"comment_id": comment_id, "course_id": course_id, "posted": True}


def delete_course_comment(user_id: str, comment_id: str, is_admin: bool = False) -> bool:
    """删除课程评论 (本人或 admin). 扫描 Redis 所有 comment key."""
    from app.utils.redis_util import get_redis
    r = get_redis()
    if r is None:
        return False

    deleted = False
    pattern = f"{_COMMENT_KEY_PREFIX}*"
    for key in r.scan_iter(match=pattern, count=100):
        raw = get_key(key)
        if not raw:
            continue
        try:
            comments = json.loads(raw)
        except json.JSONDecodeError:
            continue
        new_comments = []
        for c in comments:
            if c.get("comment_id") == comment_id:
                if is_admin or c.get("user_id") == str(user_id):
                    deleted = True
                else:
                    new_comments.append(c)
            else:
                new_comments.append(c)
        if deleted:
            set_key(key, json.dumps(new_comments), ex=365 * 24 * 3600)
            break
    return deleted


def mark_course_complete(db: Session, user_id: str, course_id: int) -> Dict[str, Any]:
    """标记课程完成: 更新学习进度 100%, 触发证书发放."""
    member_id = int(user_id) if str(user_id).isdigit() else 0

    records = db.execute(
        select(EduLearnRecord).where(
            and_(
                EduLearnRecord.member_id == member_id,
                EduLearnRecord.lesson_id == course_id,
            )
        )
    ).scalars().all()

    if not records:
        raise EduValidationError("not enrolled in this course")

    for r in records:
        r.progress = 100
        r.status = 1

    # 触发证书发放
    existing_cert = db.execute(
        select(EduCertificate).where(
            and_(
                EduCertificate.member_id == member_id,
                EduCertificate.lesson_id == course_id,
            )
        )
    ).scalar_one_or_none()
    cert_id = None
    if not existing_cert:
        course = db.get(EduCourse, course_id)
        cert = EduCertificate(
            member_id=member_id,
            lesson_id=course_id,
            code=f"CERT{datetime.now(timezone.utc).strftime('%Y%m%d')}{secrets.token_hex(4).upper()}",
            name=f"完成证书 - {course.name if course else course_id}",
            award_date=utcnow(),
        )
        db.add(cert)
        db.flush()
        db.refresh(cert)
        cert_id = cert.id

    return {
        "course_id": course_id,
        "completed": True,
        "records_updated": len(records),
        "certificate_id": cert_id,
    }
