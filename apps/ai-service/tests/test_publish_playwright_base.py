"""PlaywrightBaseAdapter 重构回归测试(2026-08-12 立)。

覆盖 11 个已下沉基类的标准模板适配器
(36kr/acfun/china_news/hupu/huxiu/lofter/people/tmtmedia/douban/baidu_zhidao/zhihu_daily):
1. 注册完整性:list_all_adapter_classes 仍能枚举全部适配器。
2. cookie 规格:名称/域名/httpOnly/secure/sameSite 与各平台原实现一致。
3. verify 判定模式:login+logout 模式 / logout 必现模式 归类正确。
4. verify_credentials 全场景:无 Playwright / 缺主 cookie / 登录跳转 /
   未登录内容 / 登录态成功,错误消息与路径与原实现一致。
5. publish 全场景:无 Playwright / 缺主 cookie / 成功 URL / 失败 URL,
   error_message 语义与原实现一致。
"""
from __future__ import annotations

import importlib
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.publish.base_adapter import PublishContent

LOGIN_MODE = [
    "36kr", "acfun", "china_news", "huxiu", "lofter",
    "people", "tmtmedia", "zhihu_daily",
]
LOGOUT_MODE = ["douban", "baidu_zhidao"]
# 六大号(2026-08-12 第二批下沉):logout 必现 verify + simulate 15-45s
SIX_MAJOR = ["baijiahao", "dayihao", "netease", "qq", "sina", "sohu"]
ALL_PLATFORMS = LOGIN_MODE + LOGOUT_MODE + SIX_MAJOR


def _adapter(pid: str):
    mod = importlib.import_module(f"app.services.publish.adapters.{pid}")
    for name in dir(mod):
        obj = getattr(mod, name)
        if isinstance(obj, type) and getattr(obj, "platform_id", None) == pid:
            return obj()
    raise AssertionError(f"class not found for {pid}")


def _creds(pid: str) -> dict:
    adapter = _adapter(pid)
    return {adapter.primary_cookie: "tok", **{s.name: "x" for s in adapter.cookie_specs}}


def _mock_page(url: str, content: str = "<html></html>", locator_count: int = 0) -> MagicMock:
    page = MagicMock()
    page.url = url
    page.content = AsyncMock(return_value=content)
    page.goto = AsyncMock()
    page.evaluate = AsyncMock()
    page.keyboard = MagicMock()
    page.keyboard.press = AsyncMock()
    page.wait_for_load_state = AsyncMock()
    page.wait_for_timeout = AsyncMock()

    def _locator(selector: str):
        loc = MagicMock()
        loc.first.count = AsyncMock(return_value=locator_count)
        loc.count = AsyncMock(return_value=locator_count)
        loc.set_input_files = AsyncMock()
        return loc

    page.locator = MagicMock(side_effect=_locator)
    return page


def _pw_context(page: MagicMock) -> tuple[MagicMock, MagicMock, MagicMock]:
    m_ctx = MagicMock()
    m_ctx.add_cookies = AsyncMock()
    m_ctx.new_page = AsyncMock(return_value=page)
    m_browser = MagicMock()
    m_pw = MagicMock()
    m_pw.__aenter__ = AsyncMock(return_value=m_pw)
    m_pw.__aexit__ = AsyncMock(return_value=None)
    m_pw.chromium.new_context = AsyncMock(return_value=m_ctx)
    return m_browser, m_ctx, m_pw


_PW_PATCHES = [
    "app.services.publish.adapters.playwright_base.create_stealth_browser_context",
    "app.services.publish.adapters.playwright_base.close_stealth_context",
    "app.services.publish.adapters.playwright_base.human_pause",
    "app.services.publish.adapters.playwright_base.human_type",
    "app.services.publish.adapters.playwright_base.human_click",
    "app.services.publish.adapters.playwright_base.simulate_reading",
    "app.services.publish.adapters.playwright_base.logger",
]


@pytest.fixture(autouse=True)
def _pw_mocks():
    # 只 patch 人类化函数 + close_stealth_context(await 调用);
    # create_stealth_browser_context 由各测试自行 patch,避免 autouse 覆盖测试内 AsyncMock。
    patchers = [
        patch(p, AsyncMock())
        for p in [
            "app.services.publish.adapters.playwright_base.human_pause",
            "app.services.publish.adapters.playwright_base.human_type",
            "app.services.publish.adapters.playwright_base.human_click",
            "app.services.publish.adapters.playwright_base.simulate_reading",
            "app.services.publish.adapters.playwright_base.close_stealth_context",
        ]
    ]
    for p in patchers:
        p.start()
    yield
    for p in patchers:
        p.stop()


class TestPlaywrightBaseRegistration:
    """适配器注册完整性。"""

    def test_all_standard_adapters_registered(self):
        from app.services.publish.base_adapter import list_all_adapter_classes

        ids = [c.platform_id for c in list_all_adapter_classes()]
        for pid in ALL_PLATFORMS:
            assert pid in ids, f"adapter {pid} missing after refactor"


class TestCookieSpecs:
    """cookie 规格与原实现一致。"""

    @pytest.mark.parametrize("pid", ALL_PLATFORMS)
    def test_cookies_generated(self, pid):
        adapter = _adapter(pid)
        cookies = adapter._cookies(_creds(pid))
        by_name = {c["name"]: c for c in cookies}
        assert set(by_name.keys()) == {s.name for s in adapter.cookie_specs}
        for spec in adapter.cookie_specs:
            c = by_name[spec.name]
            assert c["domain"] == spec.domain
            assert c.get("httpOnly") is spec.http_only or (c.get("httpOnly") is None and not spec.http_only)
            assert c.get("secure") is spec.secure or (c.get("secure") is None and not spec.secure)

    def test_36kr_specific_specs(self):
        adapter = _adapter("36kr")
        c = {x["name"]: x for x in adapter._cookies({"_36kr_session": "S", "acw_tc": "T"})}
        assert c["_36kr_session"]["domain"] == ".36kr.com"
        assert c["_36kr_session"].get("httpOnly") is True
        assert "httpOnly" not in c["acw_tc"]

    def test_zhihu_daily_specific_specs(self):
        adapter = _adapter("zhihu_daily")
        c = {x["name"]: x for x in adapter._cookies({"z_c0": "Z", "d_c0": "D"})}
        assert c["z_c0"].get("secure") is True
        assert c["z_c0"].get("sameSite") == "Lax"
        assert "secure" not in c["d_c0"]


class TestVerifyMode:
    """verify 判定模式归类正确。"""

    @pytest.mark.parametrize("pid", LOGIN_MODE)
    def test_login_logout_mode(self, pid):
        assert _adapter(pid).verify_logout_required is False

    @pytest.mark.parametrize("pid", LOGOUT_MODE + SIX_MAJOR)
    def test_logout_required_mode(self, pid):
        assert _adapter(pid).verify_logout_required is True


class TestVerifyCredentials:
    """verify_credentials 全场景行为等价。"""

    @pytest.mark.parametrize("pid", ALL_PLATFORMS)
    def test_no_playwright(self, pid):
        adapter = _adapter(pid)
        with patch("app.services.publish.adapters.playwright_base._HAS_PLAYWRIGHT", False):
            ok, msg = pytest.mark.asyncio and _run(adapter.verify_credentials(_creds(pid)))
        assert ok is False and "Playwright not installed" in msg

    @pytest.mark.parametrize("pid", ALL_PLATFORMS)
    def test_missing_primary_cookie(self, pid):
        adapter = _adapter(pid)
        ok, msg = _run(adapter.verify_credentials({}))
        assert ok is False and f"missing {adapter.primary_cookie} cookie" in msg

    @pytest.mark.parametrize("pid", ALL_PLATFORMS)
    def test_login_redirect(self, pid):
        adapter = _adapter(pid)
        page = _mock_page("https://x.com/login")
        _, ctx, pw = _pw_context(page)
        with patch("app.services.publish.adapters.playwright_base.async_playwright", return_value=pw), \
             patch("app.services.publish.adapters.playwright_base.create_stealth_browser_context",
                   AsyncMock(return_value=(MagicMock(), ctx))):
            ok, msg = _run(adapter.verify_credentials(_creds(pid)))
        assert ok is False and "redirected to login" in msg

    @pytest.mark.parametrize("pid", LOGIN_MODE)
    def test_login_button_visible_fails(self, pid):
        adapter = _adapter(pid)
        page = _mock_page("https://x.com/home", content="登录 注册")
        _, ctx, pw = _pw_context(page)
        with patch("app.services.publish.adapters.playwright_base.async_playwright", return_value=pw), \
             patch("app.services.publish.adapters.playwright_base.create_stealth_browser_context",
                   AsyncMock(return_value=(MagicMock(), ctx))):
            ok, _ = _run(adapter.verify_credentials(_creds(pid)))
        assert ok is False

    @pytest.mark.parametrize("pid", LOGOUT_MODE + SIX_MAJOR)
    def test_no_logout_button_fails(self, pid):
        adapter = _adapter(pid)
        page = _mock_page("https://x.com/home", content="欢迎使用本站 请先登入")
        _, ctx, pw = _pw_context(page)
        with patch("app.services.publish.adapters.playwright_base.async_playwright", return_value=pw), \
             patch("app.services.publish.adapters.playwright_base.create_stealth_browser_context",
                   AsyncMock(return_value=(MagicMock(), ctx))):
            ok, _ = _run(adapter.verify_credentials(_creds(pid)))
        assert ok is False

    @pytest.mark.parametrize("pid", ALL_PLATFORMS)
    def test_logged_in_succeeds(self, pid):
        adapter = _adapter(pid)
        content = "欢迎回来 退出" if adapter.verify_logout_required is False else "欢迎回来 退出 logout"
        page = _mock_page("https://x.com/home", content=content)
        _, ctx, pw = _pw_context(page)
        with patch("app.services.publish.adapters.playwright_base.async_playwright", return_value=pw), \
             patch("app.services.publish.adapters.playwright_base.create_stealth_browser_context",
                   AsyncMock(return_value=(MagicMock(), ctx))):
            ok, msg = _run(adapter.verify_credentials(_creds(pid)))
        assert ok is True, f"{pid}: {msg}"


class TestPublish:
    """publish 全场景行为等价。"""

    CONTENT = PublishContent(format="md", title="测试标题", text="第一段\n\n第二段")

    @pytest.mark.parametrize("pid", ALL_PLATFORMS)
    def test_no_playwright(self, pid):
        adapter = _adapter(pid)
        with patch("app.services.publish.adapters.playwright_base._HAS_PLAYWRIGHT", False):
            r = _run(adapter.publish(self.CONTENT, _creds(pid), {}))
        assert r.success is False and "Playwright not installed" in (r.error_message or "")

    @pytest.mark.parametrize("pid", ALL_PLATFORMS)
    def test_missing_primary_cookie(self, pid):
        adapter = _adapter(pid)
        r = _run(adapter.publish(self.CONTENT, {}, {}))
        assert r.success is False and f"missing {adapter.primary_cookie} cookie" in (r.error_message or "")

    @pytest.mark.parametrize("pid", ALL_PLATFORMS)
    def test_success_url(self, pid):
        adapter = _adapter(pid)
        url = "https://x.com/posts/123" if adapter.success_url_include else "https://x.com/done"
        page = _mock_page(url, locator_count=1)
        _, ctx, pw = _pw_context(page)
        with patch("app.services.publish.adapters.playwright_base.async_playwright", return_value=pw), \
             patch("app.services.publish.adapters.playwright_base.create_stealth_browser_context",
                   AsyncMock(return_value=(MagicMock(), ctx))):
            r = _run(adapter.publish(self.CONTENT, _creds(pid), {"tags": ["AI"]}))
        assert r.success is True, f"{pid}: {r.error_message}"

    @pytest.mark.parametrize("pid", ["netease", "qq", "sina"])
    def test_category_select_called(self, pid):
        """category_selector 配置的平台,publish 时调用 select_option。"""
        adapter = _adapter(pid)
        assert adapter.category_selector, f"{pid} should configure category_selector"
        page = _mock_page("https://x.com/done", locator_count=1)
        # 记录 select_option 调用
        select_calls = []

        def _locator(selector: str):
            loc = MagicMock()
            loc.first.count = AsyncMock(return_value=1)
            loc.count = AsyncMock(return_value=1)
            loc.set_input_files = AsyncMock()
            if adapter.category_selector in selector:
                loc.first.select_option = AsyncMock(side_effect=lambda **kw: select_calls.append(kw))
            return loc

        page.locator = MagicMock(side_effect=_locator)
        _, ctx, pw = _pw_context(page)
        with patch("app.services.publish.adapters.playwright_base.async_playwright", return_value=pw), \
             patch("app.services.publish.adapters.playwright_base.create_stealth_browser_context",
                   AsyncMock(return_value=(MagicMock(), ctx))):
            r = _run(adapter.publish(self.CONTENT, _creds(pid), {"tags": ["AI"], "category": "科技"}))
        assert r.success is True
        assert select_calls, f"{pid}: category select_option not called"
        assert select_calls[0]["label"] == "科技"

    @pytest.mark.parametrize("pid", ALL_PLATFORMS)
    def test_fail_url_no_success_signal(self, pid):
        adapter = _adapter(pid)
        fail_url = f"https://x.com/{adapter.success_url_exclude[0]}"
        page = _mock_page(fail_url, locator_count=1)

        def _locator(selector: str):
            loc = MagicMock()
            cnt = 0 if "success" in selector or "message" in selector else 1
            loc.first.count = AsyncMock(return_value=cnt)
            loc.count = AsyncMock(return_value=cnt)
            loc.set_input_files = AsyncMock()
            return loc

        page.locator = MagicMock(side_effect=_locator)
        _, ctx, pw = _pw_context(page)
        with patch("app.services.publish.adapters.playwright_base.async_playwright", return_value=pw), \
             patch("app.services.publish.adapters.playwright_base.create_stealth_browser_context",
                   AsyncMock(return_value=(MagicMock(), ctx))):
            r = _run(adapter.publish(self.CONTENT, _creds(pid), {}))
        assert r.success is False
        assert any(
            k in (r.error_message or "") for k in ("no success signal", "cookie expired", "publish failed")
        ), f"{pid}: unexpected msg {r.error_message}"


class TestDynamicUrlAdapters:
    """动态 URL 适配器(hupu/baidu_tieba):config 校验 + 动态 URL + payload 扩展。"""

    CASES = [
        ("hupu", {"hupu_fid": "sports"}, "https://bbs.hupu.com/sports/post",
         "missing hupu_fid in platform_config (target forum id)", {"hupu_fid": "sports"}),
        ("baidu_tieba", {"tieba_kw": "AI"}, "https://tieba.baidu.com/f?kw=AI&fr=index",
         "missing tieba_kw in platform_config (target forum name)", {"tieba_kw": "AI"}),
    ]

    @pytest.mark.parametrize("pid,cfg,url,err,payload", CASES)
    def test_dynamic_url_config_payload(self, pid, cfg, url, err, payload):
        adapter = _adapter(pid)
        assert adapter.build_create_url(cfg) == url
        assert adapter.validate_publish_config({}) == err
        assert adapter.validate_publish_config(cfg) is None
        assert adapter.extra_payload(cfg) == payload

    @pytest.mark.parametrize("pid,cfg,url,err,payload", CASES)
    def test_verify_mode(self, pid, cfg, url, err, payload):
        adapter = _adapter(pid)
        # hupu=login 模式, baidu_tieba=logout 模式
        if pid == "hupu":
            assert adapter.verify_logout_required is False
        else:
            assert adapter.verify_logout_required is True

    @pytest.mark.parametrize("pid,cfg,url,err,payload", CASES)
    def test_publish_missing_config(self, pid, cfg, url, err, payload):
        """缺 config 字段 → 直接失败(不进入浏览器流程)。"""
        adapter = _adapter(pid)
        r = _run(adapter.publish(TestPublish.CONTENT, _creds(pid), {}))
        assert r.success is False
        assert err in (r.error_message or "")

    @pytest.mark.parametrize("pid,cfg,url,err,payload", CASES)
    def test_publish_success_with_config(self, pid, cfg, url, err, payload):
        adapter = _adapter(pid)
        page = _mock_page(url, locator_count=1)
        _, ctx, pw = _pw_context(page)
        with patch("app.services.publish.adapters.playwright_base.async_playwright", return_value=pw), \
             patch("app.services.publish.adapters.playwright_base.create_stealth_browser_context",
                   AsyncMock(return_value=(MagicMock(), ctx))):
            r = _run(adapter.publish(TestPublish.CONTENT, _creds(pid), cfg))
        assert r.success is True, f"{pid}: {r.error_message}"
        assert r.payload == {"title": "测试标题", "tags": [], **payload}


def _run(coro):
    import asyncio

    return asyncio.run(coro)
