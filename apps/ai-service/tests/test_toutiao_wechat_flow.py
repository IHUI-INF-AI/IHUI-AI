# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# 头条微信通道·自愈式出码单元测试(2026-09-29 根治"qrconnect 页面未找到 uuid"抖动)
# 背景:该失败是瞬时风控/降级页类故障(同环境 8/8 轮探针全成功,坏变体无法稳定复现),
# 根治 = 重定向跟进 + 三策略提取 + 整链重试 + 失败指纹。本文件用假 client 全覆盖这些路径。
import pytest

import app.services.scan_login as svc
from app.services.scan_login import (
    ScanTask,
    _toutiao_wx_fetch_new_qr,
    _wx_absolute_url,
    _wx_extract_uuid,
    _wx_get_following_redirects,
)

_QRCONNECT_URL = (
    "https://open.weixin.qq.com/connect/qrconnect?appid=wx123"
    "&redirect_uri=https%3A%2F%2Fapi.snssdk.com%2Fauth%2Flogin_success"
    "&response_type=code&scope=snsapi_login&state=STATE123"
)
# 常规页:fordevtool 属性内嵌 uuid
_HTML_FORDEVTOOL = (
    "<html><body><div fordevtool = \"http://localhost:8080/devtool?uuid=ABC123456789DEF\">"
    "<img src=\"/connect/qrcode/ABC123456789DEF\"></body></html>"
)
# 降级变体 A:fordevtool 缺失,仅 img src 带 uuid
_HTML_QRCODE_ONLY = "<html><img id=\"wx_qrcode_img\" src=\"https://open.weixin.qq.com/connect/qrcode/XYZ0987654321\"></html>"
# 降级变体 B:仅 JS 里拼长轮询 URL 带 uuid
_HTML_JS_ONLY = "<html><script>var u=\"https://long.open.weixin.qq.com/connect/l/qrconnect?uuid=QRS9876543210ABC&last=408\";</script></html>"
_HTML_NO_UUID = "<html><body>环境异常,请稍后再试</body></html>"


class FakeResp:
    def __init__(self, status_code=200, headers=None, text="", content=b"", url=""):
        self.status_code = status_code
        self.headers = headers or {}
        self.text = text
        self.content = content
        self.url = url


class FakeClient:
    """按路由子串应答;同一子串多条路由按顺序消费(callable 可实现有状态应答)。"""

    def __init__(self, routes):
        self.routes = list(routes)  # list[(substring, resp|callable)]
        self.calls: list[str] = []

    def get(self, url, **_kw):
        self.calls.append(url)
        for sub, resp in self.routes:
            if sub in url:
                if isinstance(resp, list):
                    if not resp:
                        raise AssertionError(f"routes exhausted for {url}")
                    return resp.pop(0)
                return resp(url) if callable(resp) else resp
        raise AssertionError(f"no route for {url}")


def _make_task() -> ScanTask:
    return ScanTask(task_id="t1", user_id="u1", platform="toutiao")


# ---------------------------------------------------------------------------
# _wx_extract_uuid:三策略
# ---------------------------------------------------------------------------
def test_extract_uuid_fordevtool_strategy() -> None:
    assert _wx_extract_uuid(_HTML_FORDEVTOOL) == "ABC123456789DEF"


def test_extract_uuid_qrcode_src_fallback() -> None:
    assert _wx_extract_uuid(_HTML_QRCODE_ONLY) == "XYZ0987654321"


def test_extract_uuid_js_url_fallback() -> None:
    assert _wx_extract_uuid(_HTML_JS_ONLY) == "QRS9876543210ABC"


def test_extract_uuid_all_miss() -> None:
    assert _wx_extract_uuid(_HTML_NO_UUID) == ""


# ---------------------------------------------------------------------------
# _wx_absolute_url
# ---------------------------------------------------------------------------
def test_absolute_url_variants() -> None:
    base = "https://open.weixin.qq.com/connect/qrconnect?x=1"
    assert _wx_absolute_url(base, "https://a.b/c") == "https://a.b/c"
    assert _wx_absolute_url(base, "//long.open.weixin.qq.com/l") == "https://long.open.weixin.qq.com/l"
    assert _wx_absolute_url(base, "/connect/confirm?uuid=U1") == "https://open.weixin.qq.com/connect/confirm?uuid=U1"
    assert _wx_absolute_url(base, "http://x/y") == "http://x/y"


# ---------------------------------------------------------------------------
# _wx_get_following_redirects
# ---------------------------------------------------------------------------
def test_follow_redirects_until_200() -> None:
    client = FakeClient([
        ("step2", FakeResp(200, {"content-type": "text/html"}, _HTML_FORDEVTOOL, url=".../step2")),
        ("step1", FakeResp(302, {"location": "/step2"}, "", url=".../step1")),
    ])
    r = _wx_get_following_redirects(client, "https://wx.example.com/step1")
    assert r.status_code == 200
    assert _wx_extract_uuid(r.text) == "ABC123456789DEF"


def test_follow_redirects_hop_cap() -> None:
    def loop(url):
        return FakeResp(302, {"location": "/next"}, "", url=url)

    client = FakeClient([("wx.example.com", loop)])
    r = _wx_get_following_redirects(client, "https://wx.example.com/start", max_hops=5)
    # 6 次 302 后放弃,返回最后一个 3xx(不抛异常,由上层指纹归因)
    assert r.status_code == 302
    assert len(client.calls) == 6


# ---------------------------------------------------------------------------
# _toutiao_wx_fetch_new_qr:重试自愈
# ---------------------------------------------------------------------------
@pytest.fixture()
def _no_sleep(monkeypatch):
    monkeypatch.setattr(svc.time, "sleep", lambda _s: None)


@pytest.fixture()
def _no_persist(monkeypatch):
    seen = []
    monkeypatch.setattr(svc, "_persist_task", lambda task: seen.append(task.task_id))
    return seen


def _ok_wap_factory(state_seq, url):
    """wap_login 依次返回 state_seq 中的 302(每次新鲜 state)。"""
    state = state_seq.pop(0)
    loc = _QRCONNECT_URL.replace("STATE123", state)
    return FakeResp(302, {"location": loc}, "", url=url)


def test_retry_succeeds_on_second_attempt(_no_sleep, _no_persist) -> None:
    states = ["S1", "S2"]  # 每次 wap_login 成功都消费一个新鲜 state
    client = FakeClient([
        ("connect/qrcode/", FakeResp(200, {"content-type": "image/png"}, content=b"png", url="img")),
        # 第 1 次:qrconnect 页被风控降级(无 uuid);第 2 次:常规页
        ("qrconnect", [
            FakeResp(200, {"content-type": "text/html"}, _HTML_NO_UUID, url="qc"),
            FakeResp(200, {"content-type": "text/html"}, _HTML_FORDEVTOOL, url="qc"),
        ]),
        ("wap_login", lambda url: _ok_wap_factory(states, url)),
    ])
    task = _make_task()
    state, qr_uuid = _toutiao_wx_fetch_new_qr(client, task)
    assert state == "S2"  # 成功那次的全新 state(非首轮 S1)
    assert qr_uuid == "ABC123456789DEF"
    assert task.qr_image_b64, "成功后二维码应写入任务"
    assert _no_persist == ["t1"]


def test_retry_qrconnect_page_via_redirect_still_extracts(_no_sleep, _no_persist) -> None:
    # 回归:qrconnect 页本身经 302 才到 200(此前 follow_redirects=False 必失败的场景)
    states = ["S1"]
    client = FakeClient([
        ("connect/qrcode/", FakeResp(200, {"content-type": "image/png"}, content=b"png", url="img")),
        ("qrconnect", [
            FakeResp(302, {"location": "/connect/qrconnect?appid=wx123&state=STATE123&x=1"}, "", url="qc1"),
            FakeResp(200, {"content-type": "text/html"}, _HTML_QRCODE_ONLY, url="qc2"),
        ]),
        ("wap_login", lambda url: _ok_wap_factory(states, url)),
    ])
    state, qr_uuid = _toutiao_wx_fetch_new_qr(client, _make_task())
    assert state == "S1"
    assert qr_uuid == "XYZ0987654321"  # fordevtool 缺失,靠 qrcode src 策略兜底


def test_all_attempts_fail_raises_with_fingerprint(_no_sleep, _no_persist) -> None:
    client = FakeClient([
        ("wap_login", FakeResp(200, {"content-type": "text/html"}, _HTML_NO_UUID, url="wap")),
    ])
    with pytest.raises(RuntimeError) as ei:
        _toutiao_wx_fetch_new_qr(client, _make_task())
    msg = str(ei.value)
    assert "连续 3 次失败" in msg
    assert "最后指纹" in msg
    assert "status=200" in msg  # 指纹可归因
    assert len(client.calls) == 3  # 恰好 3 次完整尝试,无多余外呼


def test_missing_state_raises_fingerprint(_no_sleep, _no_persist) -> None:
    client = FakeClient([
        ("wap_login", FakeResp(302, {"location": "https://open.weixin.qq.com/connect/qrconnect?appid=wx123"}, "", url="wap")),
    ])
    with pytest.raises(RuntimeError) as ei:
        _toutiao_wx_fetch_new_qr(client, _make_task())
    assert "缺少 state" in str(ei.value)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
