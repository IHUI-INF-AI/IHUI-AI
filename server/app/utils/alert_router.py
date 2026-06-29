"""业务异常告警分级路由 (Bug-58 修复).

三级告警:
  - CRITICAL: 短信 + 邮件 + 日志
  - WARNING : 邮件 + 日志
  - INFO    : 静默 (仅日志)

支持:
  - 热加载接收人列表 (从 hot_config 读取)
  - 失败容错: 短信/邮件异常不影响主流程
  - 抑制风暴: 同一 alert_key 在 SUPPRESS_WINDOW_SEC 内只触发一次 CRITICAL
"""

import json
import logging
import time
from collections.abc import Iterable

logger = logging.getLogger(__name__)

DEFAULT_SMS_PHONES_KEY = "ALERT_SMS_PHONES"
DEFAULT_EMAILS_KEY = "ALERT_EMAILS"
SUPPRESS_WINDOW_SEC = 60
_suppress_cache: dict[str, float] = {}


def _read_recipients(key: str, default: list[str]) -> list[str]:
    """从 hot_config 读取告警接收人列表, 容错降级到默认."""
    try:
        from app.utils.hot_config import hot_get

        val = hot_get(key, default)
        if isinstance(val, list):
            return [str(x) for x in val if x]
        if isinstance(val, str) and val.strip():
            return [p.strip() for p in val.split(",") if p.strip()]
        return list(default)
    except Exception as e:
        logger.debug(f"hot_config read {key} fail: {e}")
        return list(default)


def _should_suppress(alert_key: str) -> bool:
    """抑制风暴: SUPPRESS_WINDOW_SEC 内同一 key 只触发一次."""
    now = time.time()
    last = _suppress_cache.get(alert_key, 0.0)
    if now - last < SUPPRESS_WINDOW_SEC:
        return True
    _suppress_cache[alert_key] = now
    # 定期清理过期项, 避免内存膨胀
    if len(_suppress_cache) > 1024:
        cutoff = now - SUPPRESS_WINDOW_SEC * 10
        for k in list(_suppress_cache.keys()):
            if _suppress_cache[k] < cutoff:
                _suppress_cache.pop(k, None)
    return False


def _send_sms(phones: Iterable[str], body: str) -> bool:
    """通过 SMS_API_BASE_URL 发送告警短信, 失败返回 False 不抛异常."""
    try:
        import httpx

        from app.config import settings

        url = getattr(settings, "SMS_API_BASE_URL", "") or ""
        if not url:
            logger.info(f"[ALERT_SMS] {body}")
            return True
        target = list(phones)
        if not target:
            return False
        ok = True
        for phone in target:
            try:
                with httpx.Client(timeout=5) as client:
                    resp = client.post(
                        f"{url.rstrip('/')}/sms/alert",
                        json={"phone": phone, "msg": body},
                    )
                if resp.status_code >= 400:
                    ok = False
            except Exception as e:
                logger.warning(f"alert_sms send fail to {phone}: {e}")
                ok = False
        return ok
    except Exception as e:
        logger.warning(f"alert_sms module error: {e}")
        return False


def _send_email(emails: Iterable[str], subject: str, body: str) -> bool:
    """发送告警邮件. 默认仅 logger 记录, 若配置 SMTP 走 smtplib."""
    try:
        import os

        smtp_host = os.environ.get("ALERT_SMTP_HOST", "")
        smtp_port = int(os.environ.get("ALERT_SMTP_PORT", "0") or 0)
        smtp_user = os.environ.get("ALERT_SMTP_USER", "")
        smtp_pass = os.environ.get("ALERT_SMTP_PASS", "")

        target = list(emails)
        if not smtp_host or not target:
            for em in target:
                logger.warning(f"[ALERT_EMAIL] to={em} subject={subject} body={body}")
            return True

        import smtplib
        from email.mime.text import MIMEText

        msg = MIMEText(body, "plain", "utf-8")
        msg["Subject"] = subject
        msg["From"] = smtp_user or "alert@zhs.local"
        msg["To"] = "".join(target)
        with smtplib.SMTP(smtp_host, smtp_port or 25, timeout=5) as s:
            if smtp_user and smtp_pass:
                s.starttls()
                s.login(smtp_user, smtp_pass)
            s.sendmail(msg["From"], target, msg.as_string())
        return True
    except Exception as e:
        logger.warning(f"alert_email send fail: {e}")
        return False


def _format_body(alert_key: str, message: str) -> str:
    ts = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
    return json.dumps(
        {"ts": ts, "key": alert_key, "message": message},
        ensure_ascii=False,
    )


def alert_critical(
    alert_key: str, message: str, phones: list[str] | None = None, emails: list[str] | None = None
) -> bool:
    """CRITICAL 级告警: 短信 + 邮件 + 日志. 抑制窗口内只触发一次."""
    if _should_suppress(alert_key):
        return False
    body = _format_body(alert_key, message)
    logger.error(f"[CRITICAL] {alert_key} {message}")
    sms_targets = phones if phones is not None else _read_recipients(DEFAULT_SMS_PHONES_KEY, default=[])
    email_targets = emails if emails is not None else _read_recipients(DEFAULT_EMAILS_KEY, default=[])
    try:
        _send_sms(sms_targets, body)
    except Exception as e:
        logger.debug(f"alert_critical sms fail: {e}")
    try:
        _send_email(email_targets, f"[CRITICAL] {alert_key}", body)
    except Exception as e:
        logger.debug(f"alert_critical email fail: {e}")
    return True


def alert_warning(alert_key: str, message: str, emails: list[str] | None = None) -> bool:
    """WARNING 级告警: 邮件 + 日志. 不抑制."""
    body = _format_body(alert_key, message)
    logger.warning(f"[WARNING] {alert_key} {message}")
    targets = emails if emails is not None else _read_recipients(DEFAULT_EMAILS_KEY, default=[])
    try:
        _send_email(targets, f"[WARNING] {alert_key}", body)
    except Exception as e:
        logger.debug(f"alert_warning email fail: {e}")
    return True


def alert_info(alert_key: str, message: str) -> bool:
    """INFO 级: 仅日志, 完全静默."""
    logger.info(f"[INFO] {alert_key} {message}")
    return True


def clear_suppress(alert_key: str | None = None) -> None:
    """清空抑制窗口 (测试用)."""
    if alert_key is None:
        _suppress_cache.clear()
    else:
        _suppress_cache.pop(alert_key, None)
