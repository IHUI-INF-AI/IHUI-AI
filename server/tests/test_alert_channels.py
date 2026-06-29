"""测试多渠道告警推送 — 用 respx mock HTTP, 用 aiosmtpd 模拟 SMTP.

覆盖:
- 钉钉正常推送 + 加签
- 钉钉失败重试
- 企业微信推送
- 飞书推送
- 邮件 SMTP
- 统一 push_alert 入口
- 配置加载与校验
"""

import asyncio
from email import message_from_string
from email.message import Message

import pytest
import pytest_asyncio
import respx
from httpx import Response

from app.config import settings
from app.services.alert_service import (
    format_prometheus_alert,
    get_alert_config,
    push_alert,
    push_dingtalk,
    push_feishu,
    push_wechat_work,
    send_email,
    validate_alert_config,
)

# ---------------------------------------------------------------------------
# 配置校验
# ---------------------------------------------------------------------------


class TestAlertConfig:
    def test_get_alert_config_shape(self):
        cfg = get_alert_config()
        assert "dingtalk" in cfg
        assert "wechat_work" in cfg
        assert "feishu" in cfg
        assert "email" in cfg
        assert "to" in cfg["email"]
        assert isinstance(cfg["email"]["to"], list)

    def test_validate_no_channel_soft(self):
        """soft 模式：无渠道不应抛错,只返回空 channels 列表."""
        old_d, old_w, old_f = (
            settings.DINGTALK_WEBHOOK,
            settings.WECHAT_WORK_WEBHOOK,
            settings.FEISHU_WEBHOOK,
        )
        old_smtp_host = settings.SMTP_HOST
        old_alert_to = settings.ALERT_EMAIL_TO
        settings.DINGTALK_WEBHOOK = ""
        settings.WECHAT_WORK_WEBHOOK = ""
        settings.FEISHU_WEBHOOK = ""
        settings.SMTP_HOST = ""
        settings.ALERT_EMAIL_TO = ""
        try:
            result = validate_alert_config(strict=False)
            assert result["count"] == 0
            assert result["channels"] == []
        finally:
            settings.DINGTALK_WEBHOOK = old_d
            settings.WECHAT_WORK_WEBHOOK = old_w
            settings.FEISHU_WEBHOOK = old_f
            settings.SMTP_HOST = old_smtp_host
            settings.ALERT_EMAIL_TO = old_alert_to

    def test_validate_strict_raises(self):
        old_d, old_w, old_f = (
            settings.DINGTALK_WEBHOOK,
            settings.WECHAT_WORK_WEBHOOK,
            settings.FEISHU_WEBHOOK,
        )
        old_smtp_host = settings.SMTP_HOST
        old_alert_to = settings.ALERT_EMAIL_TO
        settings.DINGTALK_WEBHOOK = ""
        settings.WECHAT_WORK_WEBHOOK = ""
        settings.FEISHU_WEBHOOK = ""
        settings.SMTP_HOST = ""
        settings.ALERT_EMAIL_TO = ""
        try:
            with pytest.raises(RuntimeError, match="No alert channel"):
                validate_alert_config(strict=True)
        finally:
            settings.DINGTALK_WEBHOOK = old_d
            settings.WECHAT_WORK_WEBHOOK = old_w
            settings.FEISHU_WEBHOOK = old_f
            settings.SMTP_HOST = old_smtp_host
            settings.ALERT_EMAIL_TO = old_alert_to

    def test_validate_with_dingtalk(self):
        old = settings.DINGTALK_WEBHOOK
        settings.DINGTALK_WEBHOOK = "https://oapi.dingtalk.com/robot/send?access_token=test"
        try:
            result = validate_alert_config()
            assert "dingtalk" in result["channels"]
            assert result["count"] >= 1
        finally:
            settings.DINGTALK_WEBHOOK = old


# ---------------------------------------------------------------------------
# 钉钉
# ---------------------------------------------------------------------------


class TestDingTalk:
    @respx.mock
    async def test_push_success(self):
        url = "https://oapi.dingtalk.com/robot/send?access_token=test"
        route = respx.post(url).mock(return_value=Response(200, json={"errcode": 0, "errmsg": "ok"}))
        ok = await push_dingtalk(url, "T", "M")
        assert ok is True
        assert route.call_count == 1
        # 请求体必须是 markdown
        sent = route.calls[0].request
        import json as _j

        body = _j.loads(sent.content)
        assert body["msgtype"] == "markdown"
        assert "T" in body["markdown"]["title"]

    @respx.mock
    async def test_push_with_secret_signs(self):
        url = "https://oapi.dingtalk.com/robot/send?access_token=test"
        route = respx.post(url).mock(return_value=Response(200, json={"errcode": 0, "errmsg": "ok"}))
        ok = await push_dingtalk(url, "T", "M", secret="SECabc123")
        assert ok is True
        import json as _j

        body = _j.loads(route.calls[0].request.content)
        assert "timestamp" in body
        assert "sign" in body
        # sign 必须是 base64 (经 url-encode 后)
        assert len(body["sign"]) > 0

    @respx.mock
    async def test_push_failure_with_retry(self):
        url = "https://oapi.dingtalk.com/robot/send?access_token=test"
        # 第一次 500, 第二次 200
        route = respx.post(url).mock(
            side_effect=[
                Response(500, json={"errcode": -1, "errmsg": "fail"}),
                Response(200, json={"errcode": 0, "errmsg": "ok"}),
            ]
        )
        ok = await push_dingtalk(url, "T", "M")
        assert ok is True
        assert route.call_count == 2  # 1 失败 + 1 成功

    @respx.mock
    async def test_push_all_fail(self):
        url = "https://oapi.dingtalk.com/robot/send?access_token=test"
        route = respx.post(url).mock(return_value=Response(403, text="forbidden"))
        ok = await push_dingtalk(url, "T", "M")
        assert ok is False
        # 2 次尝试
        assert route.call_count == 2

    @respx.mock
    async def test_push_network_error(self):
        url = "https://oapi.dingtalk.com/robot/send?access_token=test"
        respx.post(url).mock(side_effect=Exception("connection refused"))
        ok = await push_dingtalk(url, "T", "M")
        assert ok is False


# ---------------------------------------------------------------------------
# 企业微信
# ---------------------------------------------------------------------------


class TestWeChatWork:
    @respx.mock
    async def test_push_success(self):
        url = "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=test"
        route = respx.post(url).mock(return_value=Response(200, json={"errcode": 0, "errmsg": "ok"}))
        ok = await push_wechat_work(url, "Title", "Body")
        assert ok is True
        import json as _j

        body = _j.loads(route.calls[0].request.content)
        assert body["msgtype"] == "markdown"
        assert "Title" in body["markdown"]["content"]

    @respx.mock
    async def test_push_fail(self):
        url = "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=test"
        respx.post(url).mock(return_value=Response(200, json={"errcode": 40001, "errmsg": "invalid"}))
        ok = await push_wechat_work(url, "T", "M")
        assert ok is False


# ---------------------------------------------------------------------------
# 飞书
# ---------------------------------------------------------------------------


class TestFeishu:
    @respx.mock
    async def test_push_success(self):
        url = "https://open.feishu.cn/open-apis/bot/v2/hook/test"
        route = respx.post(url).mock(return_value=Response(200, json={"code": 0, "msg": "success"}))
        ok = await push_feishu(url, "FS-Title", "FS-Body")
        assert ok is True
        import json as _j

        body = _j.loads(route.calls[0].request.content)
        assert body["msg_type"] == "interactive"
        assert body["card"]["header"]["title"]["content"] == "FS-Title"

    @respx.mock
    async def test_push_fail(self):
        url = "https://open.feishu.cn/open-apis/bot/v2/hook/test"
        respx.post(url).mock(return_value=Response(200, json={"code": 1, "msg": "invalid token"}))
        ok = await push_feishu(url, "T", "M")
        assert ok is False


# ---------------------------------------------------------------------------
# 统一入口
# ---------------------------------------------------------------------------


class TestPushAlert:
    @respx.mock
    async def test_push_alert_records_history(self):
        """push_alert 应当同时写入告警历史."""
        from app.api.v1.monitor.alerts import _ALERT_HISTORY

        before = len(_ALERT_HISTORY)

        # 全部配置为真实 URL, mock 都返回成功
        old_d, old_w, old_f = (
            settings.DINGTALK_WEBHOOK,
            settings.WECHAT_WORK_WEBHOOK,
            settings.FEISHU_WEBHOOK,
        )
        settings.DINGTALK_WEBHOOK = "https://oapi.dingtalk.com/robot/send?access_token=hist"
        settings.WECHAT_WORK_WEBHOOK = "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=hist"
        settings.FEISHU_WEBHOOK = "https://open.feishu.cn/open-apis/bot/v2/hook/hist"

        respx.post(settings.DINGTALK_WEBHOOK).mock(return_value=Response(200, json={"errcode": 0}))
        respx.post(settings.WECHAT_WORK_WEBHOOK).mock(return_value=Response(200, json={"errcode": 0}))
        respx.post(settings.FEISHU_WEBHOOK).mock(return_value=Response(200, json={"code": 0}))

        try:
            result = await push_alert("Hist-Test", "Body", "warning")
            assert result["dingtalk"] is True
            assert result["wechat"] is True
            assert result["feishu"] is True
            assert result["email"] is False  # 未配置
            # 历史 +1
            assert len(_ALERT_HISTORY) == before + 1
            assert _ALERT_HISTORY[-1]["title"] == "Hist-Test"
            assert _ALERT_HISTORY[-1]["severity"] == "warning"
        finally:
            settings.DINGTALK_WEBHOOK = old_d
            settings.WECHAT_WORK_WEBHOOK = old_w
            settings.FEISHU_WEBHOOK = old_f

    @respx.mock
    async def test_push_alert_no_config(self):
        """未配置任何渠道时, 应安全返回全 False 不抛错."""
        old_d, old_w, old_f = (
            settings.DINGTALK_WEBHOOK,
            settings.WECHAT_WORK_WEBHOOK,
            settings.FEISHU_WEBHOOK,
        )
        old_smtp = settings.SMTP_HOST
        old_to = settings.ALERT_EMAIL_TO
        settings.DINGTALK_WEBHOOK = ""
        settings.WECHAT_WORK_WEBHOOK = ""
        settings.FEISHU_WEBHOOK = ""
        settings.SMTP_HOST = ""
        settings.ALERT_EMAIL_TO = ""
        try:
            result = await push_alert("T", "M")
            # push_alert 返回全部 8 个渠道键 (含 pagerduty/slack/teams/generic),
            # 即使未配置也返回 False, 避免下游 KeyError.
            assert result == {
                "dingtalk": False, "wechat": False, "feishu": False, "email": False,
                "pagerduty": False, "slack": False, "teams": False, "generic": False,
            }
        finally:
            settings.DINGTALK_WEBHOOK = old_d
            settings.WECHAT_WORK_WEBHOOK = old_w
            settings.FEISHU_WEBHOOK = old_f
            settings.SMTP_HOST = old_smtp
            settings.ALERT_EMAIL_TO = old_to


# ---------------------------------------------------------------------------
# 邮件 (SMTP) — 用 aiosmtpd 起本地服务器
# ---------------------------------------------------------------------------


class _SmtpCollectorHandler:
    """SMTP 收集器 — 记录收到的邮件."""

    def __init__(self):
        self.messages: list = []

    async def handle_DATA(self, server, session, envelope):
        # decode_data=True 时 content 已是 str
        raw = envelope.content
        if isinstance(raw, bytes):
            raw = raw.decode("utf-8", errors="replace")
        msg = message_from_string(raw)
        self.messages.append(
            {
                "from": envelope.mail_from,
                "to": list(envelope.rcpt_tos),
                "subject": msg["Subject"],
                "body": _extract_body(msg),
            }
        )
        return "250 Message accepted for delivery"


def _extract_body(msg: Message) -> str:
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "text/html":
                return part.get_payload(decode=True).decode("utf-8", errors="replace")
        return msg.get_payload()
    return msg.get_payload(decode=True).decode("utf-8", errors="replace")


@pytest_asyncio.fixture
async def smtp_server():
    """起一个本地 SMTP 收集邮件 (用 asyncio.start_server + aiosmtpd.smtp.SMTP)."""
    from aiosmtpd.smtp import SMTP as SMTPServer

    handler = _SmtpCollectorHandler()

    loop = asyncio.get_event_loop()

    class _Box:
        hostname = "127.0.0.1"
        port = 0

    box = _Box()

    def _factory():
        return SMTPServer(handler, enable_SMTPUTF8=False, decode_data=True)

    server = await loop.create_server(_factory, host="127.0.0.1", port=0)
    socks = server.sockets or []
    if socks:
        box.port = socks[0].getsockname()[1]
    try:
        yield box, handler
    finally:
        server.close()
        await server.wait_closed()


class TestEmailAlert:
    """smtplib 是同步 IO, 测试用线程池执行避免阻塞事件循环."""

    async def test_send_email_success(self, smtp_server, event_loop_policy):
        controller, handler = smtp_server
        port = controller.port

        old_host = settings.SMTP_HOST
        old_port = settings.SMTP_PORT
        old_user = settings.SMTP_USER
        old_pwd = settings.SMTP_PASSWORD
        settings.SMTP_HOST = "127.0.0.1"
        settings.SMTP_PORT = port
        settings.SMTP_USER = "alerts@zhs.local"
        settings.SMTP_PASSWORD = "testpass"
        try:
            # smtplib 同步, 放到 executor 不阻塞 event loop
            import functools

            fn = functools.partial(
                send_email,
                to_addrs=["ops@zhs.local", "oncall@zhs.local"],
                subject="[critical] HighErrorRate",
                body="<h2>5xx 错误率 12%</h2>",
                use_ssl=False,
                use_tls=False,
            )
            loop = asyncio.get_event_loop()
            ok = await loop.run_in_executor(None, fn)
            assert ok is True
            # 给 server 一点时间处理
            await asyncio.sleep(0.2)
            assert len(handler.messages) == 1
            m = handler.messages[0]
            assert m["from"] == "alerts@zhs.local"
            assert set(m["to"]) == {"ops@zhs.local", "oncall@zhs.local"}
            assert m["subject"] == "[critical] HighErrorRate"
            assert "5xx 错误率" in m["body"]
        finally:
            settings.SMTP_HOST = old_host
            settings.SMTP_PORT = old_port
            settings.SMTP_USER = old_user
            settings.SMTP_PASSWORD = old_pwd

    async def test_send_email_no_config(self):
        """未配置 SMTP 时应返回 False 而不是抛错."""
        import functools

        old_host = settings.SMTP_HOST
        settings.SMTP_HOST = ""
        try:
            loop = asyncio.get_event_loop()
            ok = await loop.run_in_executor(None, functools.partial(send_email, ["a@b.com"], "S", "B"))
            assert ok is False
        finally:
            settings.SMTP_HOST = old_host

    async def test_send_email_server_down(self):
        """SMTP 服务器不可达时返回 False."""
        import functools

        loop = asyncio.get_event_loop()
        old_host = settings.SMTP_HOST
        old_port = settings.SMTP_PORT
        old_user = settings.SMTP_USER
        old_pwd = settings.SMTP_PASSWORD
        settings.SMTP_HOST = "127.0.0.1"
        settings.SMTP_PORT = 1  # 不可能有人监听
        settings.SMTP_USER = "x@y.com"
        settings.SMTP_PASSWORD = "p"
        try:
            fn = functools.partial(
                send_email,
                ["a@b.com"],
                "S",
                "B",
                smtp_port=1,
                use_ssl=False,
                use_tls=False,
            )
            ok = await loop.run_in_executor(None, fn)
            assert ok is False
        finally:
            settings.SMTP_HOST = old_host
            settings.SMTP_PORT = old_port
            settings.SMTP_USER = old_user
            settings.SMTP_PASSWORD = old_pwd


# ---------------------------------------------------------------------------
# Alertmanager 格式
# ---------------------------------------------------------------------------


class TestFormatAlert:
    def test_firing(self):
        a = {
            "status": "firing",
            "labels": {"alertname": "X", "severity": "critical", "instance": "i1"},
            "annotations": {"summary": "S", "description": "D"},
        }
        title, msg = format_prometheus_alert(a)
        # 建议 138: title 包含 alertname + summary
        assert title == "[X] S"
        assert "critical" in msg
        assert "i1" in msg
        assert "D" in msg

    def test_resolved(self):
        a = {
            "status": "resolved",
            "labels": {"alertname": "X"},
            "annotations": {"summary": "OK"},
        }
        title, msg = format_prometheus_alert(a)
        # 建议 138: title 包含 alertname + summary
        assert title == "[X] OK"
        assert "resolved" in msg
