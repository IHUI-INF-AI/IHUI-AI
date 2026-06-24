"""业务通知邮件 (迁移自 ihui-ai-edu-notification-service).

使用 Python 标准库 smtplib + email, 通过 asyncio.to_thread 包装为异步.
支持 SSL (端口 465) 和 STARTTLS (端口 587).

配置: settings.NOTIFY_SMTP_* (与告警 SMTP 分开, 用于业务通知: 注册/订单/课程等).
"""

import asyncio
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Iterable

from loguru import logger

from app.config import settings


def _build_message(
    from_addr: str,
    to_emails: list[str],
    subject: str,
    html_body: str,
    text_body: str,
    encoding: str,
) -> MIMEMultipart:
    """构建 MIME 邮件 (同时包含纯文本与 HTML)."""
    msg = MIMEMultipart("alternative")
    msg["From"] = from_addr
    msg["To"] = ", ".join(to_emails)
    msg["Subject"] = subject
    # 先纯文本后 HTML, 客户端按优先级显示最后一个支持的 (HTML)
    if text_body:
        msg.attach(MIMEText(text_body, "plain", encoding))
    msg.attach(MIMEText(html_body, "html", encoding))
    return msg


def _smtp_send_blocking(
    host: str,
    port: int,
    user: str,
    password: str,
    from_addr: str,
    to_emails: list[str],
    subject: str,
    html_body: str,
    text_body: str,
    encoding: str,
    use_ssl: bool,
) -> bool:
    """同步发送邮件 (在线程中执行). 返回 True 表示成功."""
    msg = _build_message(from_addr, to_emails, subject, html_body, text_body, encoding)
    try:
        if use_ssl:
            # 端口 465: 直接 SSL 连接
            with smtplib.SMTP_SSL(host, port, timeout=30) as server:
                server.login(user, password)
                server.sendmail(from_addr, to_emails, msg.as_string())
        else:
            # 端口 587/25: 明文 + STARTTLS 升级
            with smtplib.SMTP(host, port, timeout=30) as server:
                server.ehlo()
                try:
                    server.starttls()
                    server.ehlo()
                except smtplib.SMTPException:
                    # 服务器不支持 STARTTLS, 继续明文 (仅限内网/测试)
                    logger.warning(f"SMTP STARTTLS not supported by {host}:{port}, sending plain")
                server.login(user, password)
                server.sendmail(from_addr, to_emails, msg.as_string())
        return True
    except smtplib.SMTPAuthenticationError as e:
        logger.error(f"SMTP auth failed: host={host} user={user} err={e}")
        return False
    except smtplib.SMTPException as e:
        logger.error(f"SMTP send error: host={host}:{port} subject={subject} err={e}")
        return False
    except Exception as e:
        logger.error(f"SMTP send failed: host={host}:{port} subject={subject} err={e}")
        return False


async def send_notify_email(
    to_emails: str | Iterable[str],
    subject: str,
    html_body: str,
    text_body: str = "",
) -> bool:
    """发送业务通知邮件 (异步).

    Args:
        to_emails: 收件人, 单个邮箱字符串或可迭代多个邮箱
        subject: 邮件主题
        html_body: HTML 正文
        text_body: 纯文本正文 (可选, 客户端不支持 HTML 时显示)

    Returns: True 表示发送成功, False 表示失败.

    使用 settings.NOTIFY_SMTP_* 配置. SSL (465) / STARTTLS (587) 自动选择.
    """
    host = settings.NOTIFY_SMTP_HOST or ""
    port = settings.NOTIFY_SMTP_PORT or 465
    user = settings.NOTIFY_SMTP_USER or ""
    password = settings.NOTIFY_SMTP_PASSWORD or ""
    encoding = settings.NOTIFY_SMTP_DEFAULT_ENCODING or "utf-8"
    from_addr = settings.NOTIFY_EMAIL_FROM or user

    if not host or not user or not password:
        logger.error("NOTIFY_SMTP_HOST/USER/PASSWORD 未配置, 无法发送通知邮件")
        return False

    # 规范化收件人列表
    if isinstance(to_emails, str):
        recipients = [addr.strip() for addr in to_emails.split(",") if addr.strip()]
    else:
        recipients = [addr.strip() for addr in to_emails if addr and addr.strip()]
    if not recipients:
        logger.error("通知邮件收件人为空")
        return False

    # 判断 SSL / STARTTLS: 端口 465 或 protocol=smtps → SSL; 否则 STARTTLS
    protocol = (settings.NOTIFY_SMTP_PROTOCOL or "").lower()
    use_ssl = port == 465 or protocol == "smtps"

    logger.info(
        f"sending notify email: host={host}:{port} ssl={use_ssl} from={from_addr} to={recipients} subject={subject}"
    )
    try:
        ok = await asyncio.to_thread(
            _smtp_send_blocking,
            host,
            port,
            user,
            password,
            from_addr,
            recipients,
            subject,
            html_body,
            text_body,
            encoding,
            use_ssl,
        )
        if ok:
            logger.info(f"notify email sent: subject={subject} to={len(recipients)} recipients")
        return ok
    except Exception as e:
        logger.error(f"notify email async dispatch failed: subject={subject} err={e}")
        return False
