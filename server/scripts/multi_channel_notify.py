#!/usr/bin/env python3
"""多渠道告警通知

支持钉钉/企业微信/飞书/邮件 4 个渠道
用法:
  python scripts/multi_channel_notify.py --channel dingtalk --title "..." --content "..." --level critical
  python scripts/multi_channel_notify.py --channel all --title "..." --content "..." --level warning
  python scripts/multi_channel_notify.py --dry-run --channel all --title "测试" --content "测试" --level info
"""
import os
import sys
import json
import argparse
import urllib.request
import urllib.parse
import smtplib
from email.mime.text import MIMEText
from pathlib import Path
from datetime import datetime, timezone

SERVER_DIR = Path(__file__).resolve().parent.parent
LOG_DIR = SERVER_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)
NOTIFY_LOG = LOG_DIR / f"multi_channel_notify_{datetime.now(timezone.utc).strftime('%Y%m%d')}.log"


def log(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{ts}] {msg}"
    print(line)
    with open(NOTIFY_LOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def notify_dingtalk(webhook: str, title: str, content: str, level: str) -> dict:
    """钉钉告警通知"""
    if not webhook:
        return {"channel": "dingtalk", "status": "skipped", "reason": "未配置 webhook"}

    color_map = {"critical": "red", "warning": "orange", "info": "blue"}
    data = {
        "msgtype": "markdown",
        "markdown": {
            "title": f"[{level.upper()}] {title}",
            "text": f"## [{level.upper()}] {title}\n\n{content}\n\n---\n时间: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')} UTC",
        },
        "at": {"isAtAll": level == "critical"},
    }
    try:
        req = urllib.request.Request(
            webhook,
            data=json.dumps(data).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            return {"channel": "dingtalk", "status": "sent", "http_code": resp.status}
    except Exception as e:
        return {"channel": "dingtalk", "status": "failed", "error": str(e)}


def notify_wechat(webhook: str, title: str, content: str, level: str) -> dict:
    """企业微信告警通知"""
    if not webhook:
        return {"channel": "wechat", "status": "skipped", "reason": "未配置 webhook"}

    data = {
        "msgtype": "markdown",
        "markdown": {
            "content": f"## [{level.upper()}] {title}\n\n{content}\n\n> {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')} UTC",
        },
    }
    try:
        req = urllib.request.Request(
            webhook,
            data=json.dumps(data).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            return {"channel": "wechat", "status": "sent", "http_code": resp.status}
    except Exception as e:
        return {"channel": "wechat", "status": "failed", "error": str(e)}


def notify_feishu(webhook: str, title: str, content: str, level: str) -> dict:
    """飞书告警通知"""
    if not webhook:
        return {"channel": "feishu", "status": "skipped", "reason": "未配置 webhook"}

    color_map = {"critical": "red", "warning": "yellow", "info": "blue"}
    data = {
        "msg_type": "interactive",
        "card": {
            "header": {
                "title": {"tag": "plain_text", "content": f"[{level.upper()}] {title}"},
                "template": color_map.get(level, "blue"),
            },
            "elements": [
                {"tag": "markdown", "content": content},
                {"tag": "note", "elements": [{"tag": "plain_text", "content": datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}]},
            ],
        },
    }
    try:
        req = urllib.request.Request(
            webhook,
            data=json.dumps(data).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            return {"channel": "feishu", "status": "sent", "http_code": resp.status}
    except Exception as e:
        return {"channel": "feishu", "status": "failed", "error": str(e)}


def notify_email(smtp_host: str, smtp_port: int, username: str, password: str, sender: str, recipients: list, title: str, content: str, level: str) -> dict:
    """邮件告警通知"""
    if not all([smtp_host, username, password, sender, recipients]):
        return {"channel": "email", "status": "skipped", "reason": "邮件配置不完整"}

    msg = MIMEText(f"[{level.upper()}] {title}\n\n{content}", "plain", "utf-8")
    msg["Subject"] = f"[{level.upper()}] {title}"
    msg["From"] = sender
    msg["To"] = ", ".join(recipients)

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
            server.starttls()
            server.login(username, password)
            server.sendmail(sender, recipients, msg.as_string())
        return {"channel": "email", "status": "sent", "recipients_count": len(recipients)}
    except Exception as e:
        return {"channel": "email", "status": "failed", "error": str(e)}


def send_notification(channel: str, title: str, content: str, level: str, dry_run: bool) -> dict:
    """发送通知到指定渠道"""
    if dry_run:
        return {
            "channel": channel,
            "status": "dry_run",
            "title": title,
            "level": level,
            "content_length": len(content),
        }

    dingtalk_webhook = os.environ.get("DINGTALK_WEBHOOK", "")
    wechat_webhook = os.environ.get("WECHAT_WEBHOOK", "")
    feishu_webhook = os.environ.get("FEISHU_WEBHOOK", "")

    if channel == "dingtalk":
        return notify_dingtalk(dingtalk_webhook, title, content, level)
    if channel == "wechat":
        return notify_wechat(wechat_webhook, title, content, level)
    if channel == "feishu":
        return notify_feishu(feishu_webhook, title, content, level)
    if channel == "email":
        return notify_email(
            smtp_host=os.environ.get("SMTP_HOST", ""),
            smtp_port=int(os.environ.get("SMTP_PORT", "587")),
            username=os.environ.get("SMTP_USERNAME", ""),
            password=os.environ.get("SMTP_PASSWORD", ""),
            sender=os.environ.get("EMAIL_SENDER", ""),
            recipients=os.environ.get("EMAIL_RECIPIENTS", "").split(","),
            title=title,
            content=content,
            level=level,
        )
    if channel == "all":
        return {
            "dingtalk": notify_dingtalk(dingtalk_webhook, title, content, level),
            "wechat": notify_wechat(wechat_webhook, title, content, level),
            "feishu": notify_feishu(feishu_webhook, title, content, level),
            "email": notify_email(
                smtp_host=os.environ.get("SMTP_HOST", ""),
                smtp_port=int(os.environ.get("SMTP_PORT", "587")),
                username=os.environ.get("SMTP_USERNAME", ""),
                password=os.environ.get("SMTP_PASSWORD", ""),
                sender=os.environ.get("EMAIL_SENDER", ""),
                recipients=os.environ.get("EMAIL_RECIPIENTS", "").split(","),
                title=title,
                content=content,
                level=level,
            ),
        }
    return {"channel": channel, "status": "unknown_channel"}


def main() -> int:
    parser = argparse.ArgumentParser(description="多渠道告警通知")
    parser.add_argument("--channel", required=True, choices=["dingtalk", "wechat", "feishu", "email", "all"], help="通知渠道")
    parser.add_argument("--title", required=True, help="通知标题")
    parser.add_argument("--content", required=True, help="通知内容")
    parser.add_argument("--level", default="info", choices=["info", "warning", "critical"], help="告警级别")
    parser.add_argument("--dry-run", action="store_true", help="仅模拟不实际发送")
    args = parser.parse_args()

    log(f"发送通知: channel={args.channel}, level={args.level}, title={args.title}")
    result = send_notification(args.channel, args.title, args.content, args.level, args.dry_run)
    log(f"发送结果: {json.dumps(result, ensure_ascii=False)}")

    if isinstance(result, dict):
        if "status" in result and result["status"] in ("failed", "unknown_channel"):
            return 1
        if any(isinstance(v, dict) and v.get("status") == "failed" for v in result.values()):
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
