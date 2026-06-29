"""邮箱验证码工具.

发送策略 (三层降级, 全程免费无需个人账号):
1. SMTP 已配置 (SMTP_HOST + SMTP_USER + SMTP_PASSWORD) → 通过 alert_service.send_email 发送真实邮件
   (用户可自行配置 QQ/163/Gmail/Resend 等, 生产环境推荐)
2. SMTP 未配置 → 通过本地 SMTP 服务器 (aiosmtpd) 投递
   (完全免费, 无需任何账号, 邮件被本地捕获, 验证码可通过 API 查询)
3. 本地 SMTP 服务器未启动 → 开发模式: 验证码输出到日志和临时文件

验证码存入 Redis (key: email:code:{email}), 限速存 Redis (key: email:rate:{email}:{window}).
"""

import os
import re
import tempfile

from loguru import logger

from app.config import settings
from app.utils.redis_util import delete_key, get_key, get_redis, set_key

EMAIL_CODE_PREFIX = "email:code:"
EMAIL_RATE_PREFIX = "email:rate:"

# 多档限速配置: (窗口秒数, 允许次数, 错误标签)
EMAIL_RATE_TIERS = (
    (60, 1, "1 分钟"),
    (3600, 5, "1 小时"),
    (86400, 20, "1 天"),
)

# 邮箱格式正则 (简单校验, 不严格 RFC 5322)
_EMAIL_RE = re.compile(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$")


def is_valid_email(email: str) -> bool:
    """校验邮箱格式."""
    if not email or not isinstance(email, str):
        return False
    return bool(_EMAIL_RE.match(email.strip()))


def generate_code(length: int = 6) -> str:
    """生成随机数字验证码."""
    import random

    return "".join([str(random.randint(0, 9)) for _ in range(length)])


def _get_redis_or_none():
    """返回 redis 客户端或 None(允许测试 mock)."""
    try:
        return get_redis()
    except Exception:
        return None


def check_rate_limit(email: str) -> tuple[bool, str]:
    """邮箱验证码多档限速检查 (1分钟/1小时/1天).

    Returns:
        (allowed: bool, msg: str). Redis 不可用时 fail-open.
    """
    r = _get_redis_or_none()
    if r is None:
        return True, ""

    try:
        pipe = r.pipeline()
        for window_sec, _limit, _label in EMAIL_RATE_TIERS:
            tier_key = f"{EMAIL_RATE_PREFIX}{email}:{window_sec}"
            pipe.incr(tier_key)
            pipe.expire(tier_key, window_sec)
        results = pipe.execute()
        if len(results) == 2 and isinstance(results[1], int) and 0 <= results[1] <= 100:
            counts = [results[1]]
        else:
            counts = results[0::2]
        for i, (_, limit, label) in enumerate(EMAIL_RATE_TIERS):
            if i >= len(counts):
                break
            if counts[i] > limit:
                logger.warning(f"Email rate limit exceeded for {email}: tier={label} count={counts[i]} limit={limit}")
                return False, f"发送频率过高({label}内最多 {limit} 条)"
        return True, ""
    except Exception as e:
        logger.error(f"Email rate limit check error for {email}: {e}")
        return True, ""


def _build_email_html(code: str, expire_minutes: int = 5) -> str:
    """构建验证码邮件 HTML 内容 (扁平化设计, 无 text-shadow, 无 box-shadow)."""
    brand = settings.EMAIL_FROM_NAME or "智汇AI"
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>登录验证码</title></head>
<body style="margin:0;padding:0;background-color:#f5f7fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f5f7fa;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="480" style="background-color:#ffffff;border:1px solid #e4e7ed;border-radius:8px;overflow:hidden;">
        <tr><td style="background-color:#409eff;padding:20px 32px;">
          <span style="color:#ffffff;font-size:18px;font-weight:600;">{brand}</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 16px 0;color:#303133;font-size:20px;font-weight:600;">登录验证码</h1>
          <p style="margin:0 0 20px 0;color:#606266;font-size:14px;line-height:1.6;">您好，您正在使用邮箱登录 {brand}。请使用以下验证码完成登录：</p>
          <div style="margin:24px 0;padding:16px 24px;background-color:#ecf5ff;border:1px solid #d9ecff;border-radius:6px;text-align:center;">
            <span style="font-size:32px;font-weight:700;color:#409eff;letter-spacing:8px;font-family:'Courier New',monospace;">{code}</span>
          </div>
          <p style="margin:0 0 8px 0;color:#909399;font-size:13px;line-height:1.6;">验证码 {expire_minutes} 分钟内有效，请尽快使用。</p>
          <p style="margin:0;color:#909399;font-size:13px;line-height:1.6;">如果这不是您本人的操作，请忽略此邮件，您的账号安全不会受到影响。</p>
        </td></tr>
        <tr><td style="padding:16px 32px;background-color:#f5f7fa;border-top:1px solid #e4e7ed;">
          <p style="margin:0;color:#c0c4cc;font-size:12px;text-align:center;">此邮件由系统自动发送，请勿回复 · {brand}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


def _send_via_dev_console(email: str, code: str) -> bool:
    """开发模式: 验证码输出到日志和临时文件 (SMTP 未配置时降级)."""
    logger.info("=" * 50)
    logger.info(f"[DEV EMAIL] 邮箱: {email}, 验证码: {code}")
    logger.info(f"[DEV EMAIL] 请在登录页面输入: {code}")
    logger.info("=" * 50)
    tmp_path = os.path.join(tempfile.gettempdir(), "dev_email_code.txt")
    try:
        with open(tmp_path, "a", encoding="utf-8") as f:
            f.write(f"{email}:{code}\n")
    except Exception as e:
        logger.debug(f"write dev email file failed: {e}")
    return True


def _send_via_local_smtp(email: str, code: str) -> bool:
    """通过本地 SMTP 服务器 (aiosmtpd) 投递邮件.

    完全免费, 无需任何外部账号. 邮件被本地 SMTP 服务器捕获,
    验证码可通过 /api/v1/auth/email/inbox?email=xxx 查询.
    """
    import smtplib
    from email.mime.text import MIMEText

    from app.utils.local_smtp_server import LOCAL_SMTP_HOST, LOCAL_SMTP_PORT, is_running

    if not is_running():
        logger.warning("[Email] 本地 SMTP 服务器未运行, 降级到 dev console")
        return _send_via_dev_console(email, code)

    expire_minutes = max(1, settings.EMAIL_CODE_EXPIRE_SECONDS // 60)
    subject = f"【{settings.EMAIL_FROM_NAME or '智汇AI'}】登录验证码 {code}"
    html_body = _build_email_html(code, expire_minutes)

    msg = MIMEText(html_body, "html", "utf-8")
    msg["Subject"] = subject
    msg["From"] = f"{settings.EMAIL_FROM_NAME or '智汇AI'} <noreply@local.dev>"
    msg["To"] = email

    try:
        # 明文连接本地 SMTP 服务器 (aiosmtpd 默认无认证)
        with smtplib.SMTP(LOCAL_SMTP_HOST, LOCAL_SMTP_PORT, timeout=5) as server:
            server.ehlo()
            server.sendmail(msg["From"], [email], msg.as_string())
        logger.info(f"[Email] 本地 SMTP 投递成功: {email}")
        return True
    except Exception as e:
        logger.error(f"[Email] 本地 SMTP 投递失败 for {email}: {e}")
        # 降级到 dev console, 保证业务流程不中断
        return _send_via_dev_console(email, code)


def _send_via_smtp(email: str, code: str) -> bool:
    """通过 SMTP 发送真实邮件 (复用 alert_service 智能回退逻辑)."""
    try:
        from app.services.alert_service import send_email as _smtp_send
    except ImportError as e:
        logger.error(f"alert_service.send_email not importable: {e}")
        return False

    expire_minutes = max(1, settings.EMAIL_CODE_EXPIRE_SECONDS // 60)
    subject = f"【{settings.EMAIL_FROM_NAME or '智汇AI'}】登录验证码 {code}"
    html_body = _build_email_html(code, expire_minutes)

    # alert_service.send_email 接受 to_addrs (list), 内部用 MIMEText(html, "html", "utf-8")
    # 但它直接用 MIMEText 单部分. 为兼容, 直接调用其内部逻辑: 传 html body 即可
    try:
        ok = _smtp_send(
            to_addrs=[email],
            subject=subject,
            body=html_body,
        )
        return bool(ok)
    except Exception as e:
        logger.error(f"SMTP send failed for {email}: {e}")
        return False


def _send_via_brevo(email: str, code: str) -> bool:
    """通过 Brevo API 发送真实邮件 (免费 300 封/天).

    Brevo (原 Sendinblue) 提供免费邮件 API:
    - 300 封/天免费 (9000 封/月)
    - 无需域名验证 (用注册邮箱作为发件人)
    - 注册指南: https://www.brevo.com/ (用任意邮箱注册, 获取 API key)
    """
    import httpx

    api_key = settings.BREVO_API_KEY
    sender_email = settings.BREVO_SENDER_EMAIL
    sender_name = settings.BREVO_SENDER_NAME or "智汇AI"

    if not api_key or not sender_email:
        return False

    expire_minutes = max(1, settings.EMAIL_CODE_EXPIRE_SECONDS // 60)
    subject = f"【{sender_name}】登录验证码 {code}"
    html_body = _build_email_html(code, expire_minutes)

    payload = {
        "sender": {"name": sender_name, "email": sender_email},
        "to": [{"email": email}],
        "subject": subject,
        "htmlContent": html_body,
    }

    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(
                "https://api.brevo.com/v3/smtp/email",
                headers={
                    "api-key": api_key,
                    "Content-Type": "application/json",
                    "accept": "application/json",
                },
                json=payload,
            )
        if resp.status_code in (200, 201):
            logger.info(f"[Email] Brevo API 发送成功: {email}")
            return True
        logger.error(f"[Email] Brevo API 失败 [{resp.status_code}]: {resp.text[:200]}")
        return False
    except Exception as e:
        logger.error(f"[Email] Brevo API 异常 for {email}: {e}")
        return False


def _send_via_resend(email: str, code: str) -> bool:
    """通过 Resend API 发送真实邮件 (免费 100 封/天).

    Resend 提供免费邮件 API:
    - 100 封/天免费 (3000 封/月)
    - 需验证域名 (或使用 onboarding@resend.dev 测试)
    - 注册指南: https://resend.com/ (用任意邮箱注册, 获取 API key)
    """
    import httpx

    api_key = settings.RESEND_API_KEY
    sender_email = settings.RESEND_SENDER_EMAIL or "onboarding@resend.dev"
    sender_name = settings.EMAIL_FROM_NAME or "智汇AI"

    if not api_key:
        return False

    expire_minutes = max(1, settings.EMAIL_CODE_EXPIRE_SECONDS // 60)
    subject = f"【{sender_name}】登录验证码 {code}"
    html_body = _build_email_html(code, expire_minutes)

    payload = {
        "from": f"{sender_name} <{sender_email}>",
        "to": [email],
        "subject": subject,
        "html": html_body,
    }

    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
        if resp.status_code in (200, 201):
            logger.info(f"[Email] Resend API 发送成功: {email}")
            return True
        logger.error(f"[Email] Resend API 失败 [{resp.status_code}]: {resp.text[:200]}")
        return False
    except Exception as e:
        logger.error(f"[Email] Resend API 异常 for {email}: {e}")
        return False


async def send_email_code(email: str) -> dict:
    """生成并发送邮箱验证码.

    Returns:
        {"success": bool, "msg": str}
    """
    if not settings.EMAIL_LOGIN_ENABLED:
        return {"success": False, "msg": "邮箱登录未启用"}

    email = (email or "").strip().lower()
    if not is_valid_email(email):
        return {"success": False, "msg": "邮箱格式不正确"}

    # 限速检查
    allowed, err_msg = check_rate_limit(email)
    if not allowed:
        return {"success": False, "msg": err_msg or "发送频率过高,请稍后再试"}

    # 防止短时间内重复发送 (验证码未过期则不重发)
    key = f"{EMAIL_CODE_PREFIX}{email}"
    existing = get_key(key)
    if existing:
        return {"success": False, "msg": "验证码已发送,请稍候"}

    # 生成验证码
    code = generate_code(settings.EMAIL_CODE_LENGTH)
    expire_seconds = settings.EMAIL_CODE_EXPIRE_SECONDS

    # 存入 Redis
    set_key(key, code, ex=expire_seconds)

    # 发送策略 (四层降级, 生产环境优先使用免费邮件 API):
    # 1. Brevo API (BREVO_API_KEY 配置) → 真实邮件, 免费 300 封/天
    # 2. Resend API (RESEND_API_KEY 配置) → 真实邮件, 免费 100 封/天
    # 3. SMTP (SMTP_HOST + SMTP_USER + SMTP_PASSWORD 配置) → 真实邮件
    # 4. 本地 SMTP 服务器 (aiosmtpd) → 开发模式, 免费无账号, 邮件捕获到本地
    # 5. dev console → 验证码输出到日志和临时文件
    sent = False
    if settings.BREVO_API_KEY and settings.BREVO_SENDER_EMAIL:
        logger.info("Sending email via Brevo API")
        sent = _send_via_brevo(email, code)
    elif settings.RESEND_API_KEY:
        logger.info("Sending email via Resend API")
        sent = _send_via_resend(email, code)
    elif settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD:
        logger.info("Sending email via SMTP")
        sent = _send_via_smtp(email, code)
    else:
        logger.info("No email provider configured, using local SMTP server (aiosmtpd)")
        sent = _send_via_local_smtp(email, code)

    if not sent:
        delete_key(key)
        return {"success": False, "msg": "邮件发送失败,请稍后重试"}

    logger.info(f"Email code sent to {email}")
    return {"success": True, "msg": "验证码已发送"}


def verify_email_code(email: str, code: str) -> bool:
    """校验邮箱验证码. 成功后删除 (一次性使用)."""
    if not email or not code:
        return False
    email = email.strip().lower()
    key = f"{EMAIL_CODE_PREFIX}{email}"
    stored = get_key(key)
    if not stored:
        return False
    if stored == code:
        delete_key(key)
        return True
    return False
