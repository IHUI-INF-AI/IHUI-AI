"""本地 SMTP 服务器 (基于开源 aiosmtpd).

完全免费、无需任何外部账号. 启动后监听本地端口, 捕获所有投递的邮件,
提取验证码并提供查询接口. 适用于开发/测试环境邮箱登录流程验证.

工作流程:
1. main.py 启动时调用 start_local_smtp() 启动本地 SMTP 服务器 (默认 127.0.0.1:8025)
2. email_util.py 在 SMTP_HOST 未配置时, 通过 smtplib 把邮件投递到本地 SMTP 服务器
3. 本地 SMTP 服务器收到邮件后, 解析验证码存入内存 + 文件
4. 通过 get_latest_code(email) 查询最新验证码 (供开发 API 使用)

优势:
- 完全免费, 无需注册任何账号
- 真实 SMTP 协议流程 (smtplib → aiosmtpd)
- 邮件内容完整捕获, 可视化查看
- 与生产 SMTP 无缝切换 (配置 SMTP_HOST 即可切到真实邮件服务)
"""

import os
import re
import tempfile
import threading
import time
from email import message_from_string
from email.policy import default as default_policy

from loguru import logger

# ============================================================================
# 内存邮箱存储: {email: [{"code": "xxx", "subject": "...", "ts": 123, "raw": "..."}]}
# ============================================================================
_email_inbox: dict[str, list[dict]] = {}
_inbox_lock = threading.Lock()

# 验证码正则: 6 位数字 (前后有非数字边界)
_CODE_RE = re.compile(r"(?<!\d)(\d{6})(?!\d)")

# 本地 SMTP 服务器默认配置
LOCAL_SMTP_HOST = "127.0.0.1"
LOCAL_SMTP_PORT = 8025

# 全局控制器引用
_controller = None


class _EmailHandler:
    """aiosmtpd 邮件处理器: 捕获邮件并提取验证码."""

    async def handle_DATA(self, server, session, envelope):
        """收到邮件时调用."""
        try:
            raw_bytes = envelope.content
            if isinstance(raw_bytes, bytes):
                raw_text = raw_bytes.decode("utf-8", errors="ignore")
            else:
                raw_text = str(raw_bytes)

            rcpt_tos = envelope.rcpt_tos or []
            to_addr = rcpt_tos[0] if rcpt_tos else "unknown"

            # 解析邮件
            msg = message_from_string(raw_text, policy=default_policy)
            subject = str(msg.get("Subject", ""))

            # 提取邮件正文 (text/plain 或 text/html)
            body_text = ""
            if msg.is_multipart():
                for part in msg.walk():
                    ctype = part.get_content_type()
                    if ctype in ("text/plain", "text/html"):
                        try:
                            body_text += part.get_content()
                        except Exception:
                            payload = part.get_payload(decode=True)
                            if payload:
                                body_text += payload.decode("utf-8", errors="ignore")
            else:
                try:
                    body_text = msg.get_content()
                except Exception:
                    payload = msg.get_payload(decode=True)
                    if payload:
                        body_text = payload.decode("utf-8", errors="ignore")

            # 从主题或正文提取 6 位验证码
            code = ""
            m = _CODE_RE.search(subject)
            if m:
                code = m.group(1)
            else:
                m = _CODE_RE.search(body_text)
                if m:
                    code = m.group(1)

            entry = {
                "code": code,
                "subject": subject,
                "from": envelope.mail_from or "",
                "to": to_addr,
                "ts": time.time(),
                "body": body_text[:2000],  # 截断防止内存膨胀
            }

            to_key = to_addr.strip().lower()
            with _inbox_lock:
                _email_inbox.setdefault(to_key, []).append(entry)
                # 每个邮箱最多保留 20 封, 防止内存泄漏
                if len(_email_inbox[to_key]) > 20:
                    _email_inbox[to_key] = _email_inbox[to_key][-20:]

            # 同时写入临时文件 (兼容旧 dev console 模式)
            try:
                tmp_path = os.path.join(tempfile.gettempdir(), "dev_email_code.txt")
                with open(tmp_path, "a", encoding="utf-8") as f:
                    f.write(f"{to_key}:{code}\n")
            except Exception as e:
                logger.debug(f"[LocalSMTP] write temp file failed: {e}")

            logger.info(
                "[LocalSMTP] 邮件已捕获: to={} subject={!r} code={}",
                to_addr, subject[:50], code,
            )
            return "250 Message accepted for delivery"
        except Exception as e:
            logger.exception("[LocalSMTP] handle_DATA error: {}", e)
            return "550 Internal error"


def start_local_smtp(host: str = LOCAL_SMTP_HOST, port: int = LOCAL_SMTP_PORT) -> bool:
    """启动本地 SMTP 服务器 (幂等, 重复调用安全).

    Returns:
        True 表示已启动或已在运行, False 表示启动失败.
    """
    global _controller
    if _controller is not None:
        return True

    try:
        from aiosmtpd.controller import Controller

        _controller = Controller(_EmailHandler(), hostname=host, port=port)
        _controller.start()
        logger.info("[LocalSMTP] 本地 SMTP 服务器已启动: {}:{}", host, port)
        return True
    except Exception as e:
        logger.warning("[LocalSMTP] 启动失败: {}", e)
        _controller = None
        return False


def stop_local_smtp() -> None:
    """停止本地 SMTP 服务器."""
    global _controller
    if _controller is not None:
        try:
            _controller.stop()
        except Exception as e:
            logger.debug("[LocalSMTP] stop error: {}", e)
        _controller = None
        logger.info("[LocalSMTP] 本地 SMTP 服务器已停止")


def is_running() -> bool:
    """检查本地 SMTP 服务器是否在运行."""
    return _controller is not None


def get_inbox(email: str) -> list[dict]:
    """获取指定邮箱的所有捕获邮件 (按时间倒序)."""
    to_key = (email or "").strip().lower()
    if not to_key:
        return []
    with _inbox_lock:
        emails = list(_email_inbox.get(to_key, []))
    emails.reverse()
    return emails


def get_latest_code(email: str, max_age_seconds: int = 600) -> dict | None:
    """获取指定邮箱的最新验证码.

    Args:
        email: 邮箱地址
        max_age_seconds: 验证码最大有效期 (秒), 默认 10 分钟

    Returns:
        {"code": "xxx", "subject": "...", "ts": 123, ...} 或 None
    """
    to_key = (email or "").strip().lower()
    if not to_key:
        return None
    with _inbox_lock:
        emails = list(_email_inbox.get(to_key, []))
    if not emails:
        return None
    latest = emails[-1]
    # 过期检查
    if max_age_seconds > 0 and (time.time() - latest.get("ts", 0)) > max_age_seconds:
        return None
    return latest


def clear_inbox(email: str | None = None) -> int:
    """清空邮箱存储.

    Args:
        email: 指定邮箱则只清空该邮箱, None 则清空所有.

    Returns:
        清空的邮件数量.
    """
    with _inbox_lock:
        if email is None:
            count = sum(len(v) for v in _email_inbox.values())
            _email_inbox.clear()
            return count
        to_key = email.strip().lower()
        count = len(_email_inbox.get(to_key, []))
        _email_inbox.pop(to_key, None)
        return count
