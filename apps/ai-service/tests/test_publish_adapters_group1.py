"""publish/adapters 7 个平台适配器综合测试(group1,补齐零覆盖)。

覆盖维度(78 cases):
1. BilibiliAdapter(13 cases):类属性 / 实例化 / _cookies(dict)/ verify_credentials 成功+缺凭证+HTTP 异常+code!=0 / publish 不支持格式+缺 file_path+文件不存在+preupload 异常+缺 upos_uri+成功
2. CsdnAdapter(10 cases):类属性 / 实例化 / _cookies(list+httpOnly)/ verify_credentials 无 Playwright+缺凭证+成功+登录跳转 / publish 无 Playwright+缺凭证+成功
3. DouyinAdapter(10 cases):类属性 / 实例化 / verify_credentials 成功+缺凭证+HTTP 异常+error_code / publish 不支持格式+缺 file_path+文件不存在+init 异常+成功
4. JuejinAdapter(10 cases):类属性 / 实例化 / _cookies / verify_credentials 无 Playwright+缺凭证+成功+登录可见 / publish 无 Playwright+缺正文+成功
5. KuaishouAdapter(10 cases):类属性 / 实例化 / verify_credentials 成功+缺凭证+HTTP 异常+result!=1 / publish 不支持格式+缺 open_id+文件不存在+upload 异常+成功
6. MediumAdapter(10 cases):类属性 / 实例化 / _headers / verify_credentials 成功+缺凭证+HTTP 异常+非 200 / publish 缺凭证+无法解析 author_id+成功
7. ShipinhaoAdapter(15 cases):类属性 / 实例化 / _parse_cookies(JSON 串+dict+cookie 串+空)/ verify_credentials 无 Playwright+成功+登录跳转 / publish 无 Playwright+不支持格式+缺 cookies+成功
"""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.services.publish.adapters.bilibili import BilibiliAdapter
from app.services.publish.adapters.csdn import CsdnAdapter
from app.services.publish.adapters.douyin import DouyinAdapter
from app.services.publish.adapters.juejin import JuejinAdapter
from app.services.publish.adapters.kuaishou import KuaishouAdapter
from app.services.publish.adapters.medium import MediumAdapter
from app.services.publish.adapters.shipinhao import ShipinhaoAdapter
from app.services.publish.base_adapter import BasePlatformAdapter, PublishContent, PublishResult


# =============================================================================
# 工厂 / 辅助函数
# =============================================================================


def _make_resp(status_code: int = 200, json_data: dict | None = None,
               text: str = "", headers: dict | None = None) -> MagicMock:
    """创建 mock httpx 响应。"""
    resp = MagicMock()
    resp.status_code = status_code
    resp.json.return_value = json_data if json_data is not None else {}
    resp.text = text
    resp.headers = headers if headers is not None else {}
    resp.content = text.encode("utf-8") if text else b""
    return resp


def _mock_async_client(*, post_return=None, post_side=None,
                       get_return=None, get_side=None,
                       put_return=None, put_side=None) -> AsyncMock:
    """创建 mock httpx.AsyncClient 上下文管理器。

    post_side / get_side / put_side 支持列表(多响应顺序返回)或异常实例。
    """
    client = AsyncMock()
    if post_side is not None:
        client.post = AsyncMock(side_effect=post_side)
    elif post_return is not None:
        client.post = AsyncMock(return_value=post_return)
    if get_side is not None:
        client.get = AsyncMock(side_effect=get_side)
    elif get_return is not None:
        client.get = AsyncMock(return_value=get_return)
    if put_side is not None:
        client.put = AsyncMock(side_effect=put_side)
    elif put_return is not None:
        client.put = AsyncMock(return_value=put_return)
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=None)
    return client


def _make_playwright_chain(page_url: str = "https://example.com",
                           page_content: str = "<html></html>",
                           locator_count: int = 1,
                           locator_text: str = "text",
                           wait_for_url_raises: bool = False,
                           wait_for_selector_raises: bool = False,
                           wait_for_raises: bool = False):
    """创建 Playwright mock 链,返回 (mock_async_playwright, mock_page, mock_locator)。"""
    mock_locator = MagicMock()
    mock_locator.first = mock_locator
    mock_locator.count = AsyncMock(return_value=locator_count)
    mock_locator.fill = AsyncMock()
    mock_locator.click = AsyncMock()
    mock_locator.set_input_files = AsyncMock()
    mock_locator.evaluate = AsyncMock()
    mock_locator.text_content = AsyncMock(return_value=locator_text)
    if wait_for_raises:
        mock_locator.wait_for = AsyncMock(side_effect=Exception("timeout"))
    else:
        mock_locator.wait_for = AsyncMock()

    mock_page = AsyncMock()
    mock_page.url = page_url
    mock_page.content = AsyncMock(return_value=page_content)
    mock_page.goto = AsyncMock()
    mock_page.wait_for_timeout = AsyncMock()
    mock_page.evaluate = AsyncMock()
    mock_page.locator = MagicMock(return_value=mock_locator)
    mock_page.keyboard = MagicMock()
    mock_page.keyboard.press = AsyncMock()
    if wait_for_url_raises:
        mock_page.wait_for_url = AsyncMock(side_effect=Exception("timeout"))
    else:
        mock_page.wait_for_url = AsyncMock()
    if wait_for_selector_raises:
        mock_page.wait_for_selector = AsyncMock(side_effect=Exception("timeout"))
    else:
        mock_page.wait_for_selector = AsyncMock()

    mock_context = AsyncMock()
    mock_context.new_page = AsyncMock(return_value=mock_page)
    mock_context.add_cookies = AsyncMock()

    mock_browser = AsyncMock()
    mock_browser.new_context = AsyncMock(return_value=mock_context)
    mock_browser.close = AsyncMock()

    mock_pw_obj = AsyncMock()
    mock_pw_obj.chromium = AsyncMock()
    mock_pw_obj.chromium.launch = AsyncMock(return_value=mock_browser)

    mock_cm = AsyncMock()
    mock_cm.__aenter__.return_value = mock_pw_obj

    mock_async_playwright = MagicMock(return_value=mock_cm)
    return mock_async_playwright, mock_page, mock_locator


# =============================================================================
# 1. BilibiliAdapter(12 tests)
# =============================================================================


class TestBilibiliAdapter:
    """B站适配器:基于 Cookie + Web API(httpx,非 Playwright)。"""

    def test_class_attributes(self):
        """类属性:platform_id / platform_name / supported_formats / requires_credentials / needs_browser。"""
        assert BilibiliAdapter.platform_id == "bilibili"
        assert BilibiliAdapter.platform_name == "B站"
        assert BilibiliAdapter.supported_formats == ["video"]
        assert BilibiliAdapter.requires_credentials == ["sessdata", "bili_jct", "dedeuserid"]
        assert BilibiliAdapter.needs_browser is False

    def test_instantiation(self):
        """适配器可实例化且为 BasePlatformAdapter 子类。"""
        adapter = BilibiliAdapter()
        assert isinstance(adapter, BasePlatformAdapter)

    def test_cookies(self):
        """_cookies:凭证 dict → httpx cookies dict(非 Playwright list)。"""
        adapter = BilibiliAdapter()
        creds = {"sessdata": "sd", "bili_jct": "jct", "dedeuserid": "did"}
        cookies = adapter._cookies(creds)
        assert isinstance(cookies, dict)
        assert cookies["SESSDATA"] == "sd"
        assert cookies["bili_jct"] == "jct"
        assert cookies["DedeUserID"] == "did"

    async def test_verify_credentials_success(self):
        """verify_credentials 成功:nav API code==0 → connected as <uname>。"""
        nav_resp = _make_resp(200, json_data={
            "code": 0,
            "data": {"uname": "测试用户", "mid": 12345, "vipStatus": 1},
        })
        client = _mock_async_client(get_return=nav_resp)
        with patch("app.services.publish.adapters.bilibili.httpx.AsyncClient", return_value=client):
            adapter = BilibiliAdapter()
            ok, msg = await adapter.verify_credentials({
                "sessdata": "sd", "bili_jct": "jct", "dedeuserid": "did",
            })
        assert ok is True
        assert "测试用户" in msg
        assert "uid=12345" in msg

    async def test_verify_credentials_missing_sessdata(self):
        """verify_credentials 缺 sessdata → False。"""
        adapter = BilibiliAdapter()
        ok, msg = await adapter.verify_credentials({"sessdata": "", "bili_jct": "jct"})
        assert ok is False
        assert "missing sessdata" in msg

    async def test_verify_credentials_http_error(self):
        """verify_credentials HTTP 异常 → False。"""
        client = _mock_async_client(get_side=httpx.ConnectError("refused"))
        with patch("app.services.publish.adapters.bilibili.httpx.AsyncClient", return_value=client):
            adapter = BilibiliAdapter()
            ok, msg = await adapter.verify_credentials({"sessdata": "sd"})
        assert ok is False
        assert "http error" in msg

    async def test_verify_credentials_code_nonzero(self):
        """verify_credentials API code != 0 → False(未登录)。"""
        nav_resp = _make_resp(200, json_data={"code": -101, "message": "账号未登录"})
        client = _mock_async_client(get_return=nav_resp)
        with patch("app.services.publish.adapters.bilibili.httpx.AsyncClient", return_value=client):
            adapter = BilibiliAdapter()
            ok, msg = await adapter.verify_credentials({"sessdata": "bad"})
        assert ok is False
        assert "not logged in" in msg

    async def test_publish_unsupported_format(self):
        """publish 非 video 格式 → success=False。"""
        adapter = BilibiliAdapter()
        content = PublishContent(format="md", title="标题", text="正文")
        result = await adapter.publish(content, {"sessdata": "sd"}, {})
        assert result.success is False
        assert "only supports video format" in result.error_message

    async def test_publish_missing_file_path(self):
        """publish video 格式但无 file_path → success=False。"""
        adapter = BilibiliAdapter()
        content = PublishContent(format="video", title="视频标题")
        result = await adapter.publish(content, {"sessdata": "sd"}, {})
        assert result.success is False
        assert "missing file_path" in result.error_message

    async def test_publish_file_not_found(self):
        """publish video 文件不存在 → success=False。"""
        adapter = BilibiliAdapter()
        content = PublishContent(format="video", title="标题", file_path="/nonexistent/video.mp4")
        result = await adapter.publish(content, {"sessdata": "sd"}, {})
        assert result.success is False
        assert "video file not found" in result.error_message

    async def test_publish_preupload_http_error(self):
        """publish preupload HTTP 异常 → success=False。"""
        client = _mock_async_client(post_side=httpx.ConnectError("refused"))
        with patch("app.services.publish.adapters.bilibili.httpx.AsyncClient", return_value=client):
            adapter = BilibiliAdapter()
            content = PublishContent(format="video", title="标题", file_path=__file__)
            result = await adapter.publish(content, {"sessdata": "sd", "bili_jct": "jct"}, {})
        assert result.success is False
        assert "preupload failed" in result.error_message

    async def test_publish_preupload_missing_upos_uri(self, tmp_path):
        """publish preupload 返回无 upos_uri → success=False。"""
        video_file = tmp_path / "test.mp4"
        video_file.write_bytes(b"fake video")
        preupload_resp = _make_resp(200, json_data={"biz_id": "b", "auth": "a"})
        client = _mock_async_client(post_return=preupload_resp)
        with patch("app.services.publish.adapters.bilibili.httpx.AsyncClient", return_value=client):
            adapter = BilibiliAdapter()
            content = PublishContent(format="video", title="标题", file_path=str(video_file))
            result = await adapter.publish(content, {"sessdata": "sd", "bili_jct": "jct"}, {})
        assert result.success is False
        assert "missing upos_uri" in result.error_message

    async def test_publish_success(self, tmp_path):
        """publish 成功:preupload → init → chunk PUT → submit 全链路 mock,返回 bvid。"""
        video_file = tmp_path / "test.mp4"
        video_file.write_bytes(b"fake video content")
        preupload_resp = _make_resp(200, json_data={
            "upos_uri": "upos://abc/def",
            "biz_id": "biz123",
            "auth": "auth_tok",
            "endpoint": "https://up.example.com",
            "chunk_size": 4194304,
        })
        init_resp = _make_resp(200, json_data={"upload_id": "uid123"})
        chunk_resp = _make_resp(200, text="ok")
        submit_resp = _make_resp(200, json_data={
            "code": 0,
            "data": {"aid": 12345, "bvid": "BV1xx"},
        })
        client = _mock_async_client(
            post_side=[preupload_resp, init_resp, submit_resp],
            put_return=chunk_resp,
        )
        with patch("app.services.publish.adapters.bilibili.httpx.AsyncClient", return_value=client):
            adapter = BilibiliAdapter()
            content = PublishContent(format="video", title="测试视频", file_path=str(video_file))
            result = await adapter.publish(
                content, {"sessdata": "sd", "bili_jct": "jct", "dedeuserid": "did"},
                {"tid": 122, "tag": "测试"},
            )
        assert result.success is True
        assert result.platform_content_id == "12345"
        assert "BV1xx" in result.published_url
        assert result.payload["bvid"] == "BV1xx"
        assert result.payload["is_draft"] is True


# =============================================================================
# 2. CsdnAdapter(10 tests)
# =============================================================================


class TestCsdnAdapter:
    """CSDN 适配器:基于 Playwright 浏览器自动化。"""

    def test_class_attributes(self):
        """类属性:needs_browser=True。"""
        assert CsdnAdapter.platform_id == "csdn"
        assert CsdnAdapter.platform_name == "CSDN"
        assert CsdnAdapter.supported_formats == ["md", "html"]
        assert CsdnAdapter.requires_credentials == ["UserName", "UserToken", "UserSecret"]
        assert CsdnAdapter.needs_browser is True

    def test_instantiation(self):
        """可实例化。"""
        adapter = CsdnAdapter()
        assert isinstance(adapter, BasePlatformAdapter)

    def test_cookies(self):
        """_cookies:凭证 dict → Playwright cookies list,验证 name/value/domain/path/httpOnly。"""
        adapter = CsdnAdapter()
        cookies = adapter._cookies({"UserName": "u", "UserToken": "t", "UserSecret": "s"})
        assert len(cookies) == 3
        by_name = {c["name"]: c for c in cookies}
        assert by_name["UserName"]["value"] == "u"
        assert by_name["UserName"]["domain"] == ".csdn.net"
        assert by_name["UserName"]["path"] == "/"
        assert "httpOnly" not in by_name["UserName"]
        assert by_name["UserToken"]["httpOnly"] is True
        assert by_name["UserSecret"]["httpOnly"] is True

    async def test_verify_credentials_no_playwright(self, monkeypatch):
        """verify_credentials 无 Playwright → False。"""
        monkeypatch.setattr("app.services.publish.adapters.csdn._HAS_PLAYWRIGHT", False)
        adapter = CsdnAdapter()
        ok, msg = await adapter.verify_credentials({"UserName": "u", "UserToken": "t"})
        assert ok is False
        assert "Playwright not installed" in msg

    async def test_verify_credentials_missing_username(self, monkeypatch):
        """verify_credentials 缺 UserName → False。"""
        monkeypatch.setattr("app.services.publish.adapters.csdn._HAS_PLAYWRIGHT", True)
        adapter = CsdnAdapter()
        ok, msg = await adapter.verify_credentials({"UserName": "", "UserToken": "t"})
        assert ok is False
        assert "missing UserName" in msg

    async def test_verify_credentials_success(self, monkeypatch):
        """verify_credentials 成功:page.url 不含 login → connected as <username>。"""
        monkeypatch.setattr("app.services.publish.adapters.csdn._HAS_PLAYWRIGHT", True)
        mock_pw, _, _ = _make_playwright_chain(page_url="https://mp.csdn.net/dashboard")
        monkeypatch.setattr("app.services.publish.adapters.csdn.async_playwright", mock_pw, raising=False)
        adapter = CsdnAdapter()
        ok, msg = await adapter.verify_credentials({"UserName": "testuser", "UserToken": "t"})
        assert ok is True
        assert "connected as testuser" in msg

    async def test_verify_credentials_login_redirect(self, monkeypatch):
        """verify_credentials cookie 过期:page.url 含 login → False。"""
        monkeypatch.setattr("app.services.publish.adapters.csdn._HAS_PLAYWRIGHT", True)
        mock_pw, _, _ = _make_playwright_chain(page_url="https://passport.csdn.net/login")
        monkeypatch.setattr("app.services.publish.adapters.csdn.async_playwright", mock_pw, raising=False)
        adapter = CsdnAdapter()
        ok, msg = await adapter.verify_credentials({"UserName": "u", "UserToken": "t"})
        assert ok is False
        assert "cookie expired" in msg

    async def test_publish_no_playwright(self, monkeypatch):
        """publish 无 Playwright → success=False。"""
        monkeypatch.setattr("app.services.publish.adapters.csdn._HAS_PLAYWRIGHT", False)
        adapter = CsdnAdapter()
        content = PublishContent(format="md", title="标题", text="正文")
        result = await adapter.publish(content, {"UserName": "u"}, {})
        assert result.success is False
        assert "Playwright not installed" in result.error_message

    async def test_publish_missing_username(self, monkeypatch):
        """publish 缺 UserName → success=False。"""
        monkeypatch.setattr("app.services.publish.adapters.csdn._HAS_PLAYWRIGHT", True)
        adapter = CsdnAdapter()
        content = PublishContent(format="md", title="标题", text="正文")
        result = await adapter.publish(content, {"UserName": ""}, {})
        assert result.success is False
        assert "missing UserName" in result.error_message

    async def test_publish_success(self, monkeypatch):
        """publish 成功:mock Playwright 全链路,wait_for_url 成功 → published_url。"""
        monkeypatch.setattr("app.services.publish.adapters.csdn._HAS_PLAYWRIGHT", True)
        mock_pw, _, _ = _make_playwright_chain(
            page_url="https://blog.csdn.net/testuser/article/details/123456",
            locator_count=1,
        )
        monkeypatch.setattr("app.services.publish.adapters.csdn.async_playwright", mock_pw, raising=False)
        adapter = CsdnAdapter()
        content = PublishContent(format="md", title="CSDN 文章", text="正文内容")
        result = await adapter.publish(
            content, {"UserName": "u", "UserToken": "t", "UserSecret": "s"},
            {"tags": ["Python"], "category": "后端"},
        )
        assert result.success is True
        assert "123456" in result.published_url
        assert result.platform_content_id == "123456"


# =============================================================================
# 3. DouyinAdapter(10 tests)
# =============================================================================


class TestDouyinAdapter:
    """抖音适配器:基于抖音开放平台 OpenAPI(httpx)。"""

    def test_class_attributes(self):
        """类属性:needs_browser=False(默认)。"""
        assert DouyinAdapter.platform_id == "douyin"
        assert DouyinAdapter.platform_name == "抖音"
        assert DouyinAdapter.supported_formats == ["video"]
        assert DouyinAdapter.requires_credentials == ["access_token", "open_id", "client_key", "client_secret"]
        assert DouyinAdapter.needs_browser is False

    def test_instantiation(self):
        """可实例化。"""
        adapter = DouyinAdapter()
        assert isinstance(adapter, BasePlatformAdapter)

    async def test_verify_credentials_success(self):
        """verify_credentials 成功:data.description == "user_info" → connected as <nickname>。"""
        resp = _make_resp(200, json_data={
            "data": {
                "description": "user_info",
                "nickname": "抖音用户",
                "open_id": "openid123",
            },
        })
        client = _mock_async_client(get_return=resp)
        with patch("app.services.publish.adapters.douyin.httpx.AsyncClient", return_value=client):
            adapter = DouyinAdapter()
            ok, msg = await adapter.verify_credentials({
                "access_token": "tok", "open_id": "oid",
                "client_key": "ck", "client_secret": "cs",
            })
        assert ok is True
        assert "抖音用户" in msg
        assert "openid123" in msg

    async def test_verify_credentials_missing_fields(self):
        """verify_credentials 缺 access_token / open_id / client_key → False。"""
        adapter = DouyinAdapter()
        ok, msg = await adapter.verify_credentials({
            "access_token": "", "open_id": "oid", "client_key": "ck",
        })
        assert ok is False
        assert "missing" in msg

    async def test_verify_credentials_http_error(self):
        """verify_credentials HTTP 异常 → False。"""
        client = _mock_async_client(get_side=httpx.ConnectError("refused"))
        with patch("app.services.publish.adapters.douyin.httpx.AsyncClient", return_value=client):
            adapter = DouyinAdapter()
            ok, msg = await adapter.verify_credentials({
                "access_token": "tok", "open_id": "oid", "client_key": "ck",
            })
        assert ok is False
        assert "http error" in msg

    async def test_verify_credentials_error_code(self):
        """verify_credentials data.error_code != 0 → False。"""
        resp = _make_resp(200, json_data={
            "data": {"error_code": 40001, "description": "token invalid"},
        })
        client = _mock_async_client(get_return=resp)
        with patch("app.services.publish.adapters.douyin.httpx.AsyncClient", return_value=client):
            adapter = DouyinAdapter()
            ok, msg = await adapter.verify_credentials({
                "access_token": "tok", "open_id": "oid", "client_key": "ck",
            })
        assert ok is False
        assert "verify failed" in msg

    async def test_publish_unsupported_format(self):
        """publish 非 video 格式 → success=False。"""
        adapter = DouyinAdapter()
        content = PublishContent(format="md", title="标题", text="正文")
        result = await adapter.publish(content, {"access_token": "tok"}, {})
        assert result.success is False
        assert "only supports video format" in result.error_message

    async def test_publish_missing_file_path(self):
        """publish video 格式但无 file_path → success=False。"""
        adapter = DouyinAdapter()
        content = PublishContent(format="video", title="标题")
        result = await adapter.publish(content, {"access_token": "tok"}, {})
        assert result.success is False
        assert "missing file_path" in result.error_message

    async def test_publish_video_not_found(self):
        """publish _upload_video 文件不存在 → success=False。"""
        adapter = DouyinAdapter()
        content = PublishContent(format="video", title="标题", file_path="/nonexistent/video.mp4")
        result = await adapter.publish(
            content, {"access_token": "tok", "open_id": "oid"},
            {},
        )
        assert result.success is False
        assert "video not found" in result.error_message

    async def test_publish_upload_init_http_error(self, tmp_path):
        """publish _upload_video init upload HTTP 异常 → success=False。"""
        video_file = tmp_path / "test.mp4"
        video_file.write_bytes(b"fake video")
        client = _mock_async_client(post_side=httpx.ConnectError("refused"))
        with patch("app.services.publish.adapters.douyin.httpx.AsyncClient", return_value=client):
            adapter = DouyinAdapter()
            content = PublishContent(format="video", title="标题", file_path=str(video_file))
            result = await adapter.publish(
                content, {"access_token": "tok", "open_id": "oid"},
                {},
            )
        assert result.success is False
        assert "init upload failed" in result.error_message

    async def test_publish_success(self, tmp_path):
        """publish 成功:init upload → upload → complete → create video 全链路 mock。"""
        video_file = tmp_path / "test.mp4"
        video_file.write_bytes(b"fake video content")
        init_resp = _make_resp(200, json_data={
            "data": {"upload_token": "ut", "video": {"video_id": "vid123"}},
        })
        upload_resp = _make_resp(200, json_data={"data": {}})
        complete_resp = _make_resp(200, json_data={"data": {}})
        create_resp = _make_resp(200, json_data={
            "data": {"item_id": "item456", "error_code": 0},
        })
        client = _mock_async_client(post_side=[init_resp, upload_resp, complete_resp, create_resp])
        with patch("app.services.publish.adapters.douyin.httpx.AsyncClient", return_value=client):
            adapter = DouyinAdapter()
            content = PublishContent(format="video", title="抖音视频", file_path=str(video_file))
            result = await adapter.publish(
                content, {"access_token": "tok", "open_id": "oid"},
                {"desc": "描述"},
            )
        assert result.success is True
        assert result.platform_content_id == "item456"
        assert result.payload["video_id"] == "vid123"


# =============================================================================
# 4. JuejinAdapter(10 tests)
# =============================================================================


class TestJuejinAdapter:
    """掘金适配器:基于 Playwright 浏览器自动化。"""

    def test_class_attributes(self):
        """类属性:needs_browser=True。"""
        assert JuejinAdapter.platform_id == "juejin"
        assert JuejinAdapter.platform_name == "掘金"
        assert JuejinAdapter.supported_formats == ["md", "html"]
        assert JuejinAdapter.requires_credentials == ["sessionid", "signatureId"]
        assert JuejinAdapter.needs_browser is True

    def test_instantiation(self):
        """可实例化。"""
        adapter = JuejinAdapter()
        assert isinstance(adapter, BasePlatformAdapter)

    def test_cookies(self):
        """_cookies:凭证 dict → Playwright cookies list,3 个 cookie 均 httpOnly。"""
        adapter = JuejinAdapter()
        cookies = adapter._cookies({"sessionid": "sess", "signatureId": "sig"})
        assert len(cookies) == 3
        by_name = {c["name"]: c for c in cookies}
        assert by_name["sessionid"]["value"] == "sess"
        assert by_name["sessionid"]["domain"] == ".juejin.cn"
        assert by_name["sessionid"]["httpOnly"] is True
        assert by_name["sessionid_ss"]["value"] == "sess"
        assert by_name["sid_guard"]["value"] == "sig"
        assert by_name["sid_guard"]["httpOnly"] is True

    async def test_verify_credentials_no_playwright(self, monkeypatch):
        """verify_credentials 无 Playwright → False。"""
        monkeypatch.setattr("app.services.publish.adapters.juejin._HAS_PLAYWRIGHT", False)
        adapter = JuejinAdapter()
        ok, msg = await adapter.verify_credentials({"sessionid": "s"})
        assert ok is False
        assert "Playwright not installed" in msg

    async def test_verify_credentials_missing_sessionid(self, monkeypatch):
        """verify_credentials 缺 sessionid → False。"""
        monkeypatch.setattr("app.services.publish.adapters.juejin._HAS_PLAYWRIGHT", True)
        adapter = JuejinAdapter()
        ok, msg = await adapter.verify_credentials({"sessionid": ""})
        assert ok is False
        assert "missing sessionid" in msg

    async def test_verify_credentials_success(self, monkeypatch):
        """verify_credentials 成功:页面内容不含"登录" → connected (sessionid valid)。"""
        monkeypatch.setattr("app.services.publish.adapters.juejin._HAS_PLAYWRIGHT", True)
        mock_pw, _, _ = _make_playwright_chain(
            page_content="<html>欢迎,写文章</html>",
        )
        monkeypatch.setattr("app.services.publish.adapters.juejin.async_playwright", mock_pw, raising=False)
        adapter = JuejinAdapter()
        ok, msg = await adapter.verify_credentials({"sessionid": "sess"})
        assert ok is True
        assert "connected" in msg

    async def test_verify_credentials_login_visible(self, monkeypatch):
        """verify_credentials cookie 过期:页面含"登录"+class="login"+无 avatar → False。"""
        monkeypatch.setattr("app.services.publish.adapters.juejin._HAS_PLAYWRIGHT", True)
        mock_pw, _, _ = _make_playwright_chain(
            page_content='<html>请登录</html><div class="login">登录</div>',
        )
        monkeypatch.setattr("app.services.publish.adapters.juejin.async_playwright", mock_pw, raising=False)
        adapter = JuejinAdapter()
        ok, msg = await adapter.verify_credentials({"sessionid": "expired"})
        assert ok is False
        assert "cookie expired" in msg

    async def test_publish_no_playwright(self, monkeypatch):
        """publish 无 Playwright → success=False。"""
        monkeypatch.setattr("app.services.publish.adapters.juejin._HAS_PLAYWRIGHT", False)
        adapter = JuejinAdapter()
        content = PublishContent(format="md", title="标题", text="正文")
        result = await adapter.publish(content, {"sessionid": "s"}, {})
        assert result.success is False
        assert "Playwright not installed" in result.error_message

    async def test_publish_missing_text(self, monkeypatch):
        """publish 无 text 无 html → success=False。"""
        monkeypatch.setattr("app.services.publish.adapters.juejin._HAS_PLAYWRIGHT", True)
        adapter = JuejinAdapter()
        content = PublishContent(format="md", title="标题", text=None, html=None)
        result = await adapter.publish(content, {"sessionid": "s"}, {})
        assert result.success is False
        assert "missing content text" in result.error_message

    async def test_publish_success(self, monkeypatch):
        """publish 成功:mock Playwright 全链路,wait_for_url 成功 → published_url。"""
        monkeypatch.setattr("app.services.publish.adapters.juejin._HAS_PLAYWRIGHT", True)
        mock_pw, _, _ = _make_playwright_chain(
            page_url="https://juejin.cn/post/7123456789",
            locator_count=1,
        )
        monkeypatch.setattr("app.services.publish.adapters.juejin.async_playwright", mock_pw, raising=False)
        adapter = JuejinAdapter()
        content = PublishContent(format="md", title="掘金文章", text="正文内容")
        result = await adapter.publish(
            content, {"sessionid": "s", "signatureId": "sig"},
            {"category": "前端", "tags": ["React"]},
        )
        assert result.success is True
        assert "7123456789" in result.published_url
        assert result.platform_content_id == "7123456789"


# =============================================================================
# 5. KuaishouAdapter(10 tests)
# =============================================================================


class TestKuaishouAdapter:
    """快手适配器:基于快手开放平台 OpenAPI(httpx)。"""

    def test_class_attributes(self):
        """类属性:needs_browser=False(默认)。"""
        assert KuaishouAdapter.platform_id == "kuaishou"
        assert KuaishouAdapter.platform_name == "快手"
        assert KuaishouAdapter.supported_formats == ["video"]
        assert KuaishouAdapter.requires_credentials == ["access_token", "app_id", "app_secret"]
        assert KuaishouAdapter.needs_browser is False

    def test_instantiation(self):
        """可实例化。"""
        adapter = KuaishouAdapter()
        assert isinstance(adapter, BasePlatformAdapter)

    async def test_verify_credentials_success(self):
        """verify_credentials 成功:result==1 → connected as <name>。"""
        resp = _make_resp(200, json_data={
            "result": 1,
            "user_info": {"name": "快手用户", "kwai_id": "kwai123"},
        })
        client = _mock_async_client(get_return=resp)
        with patch("app.services.publish.adapters.kuaishou.httpx.AsyncClient", return_value=client):
            adapter = KuaishouAdapter()
            ok, msg = await adapter.verify_credentials({"access_token": "tok", "app_id": "aid"})
        assert ok is True
        assert "快手用户" in msg

    async def test_verify_credentials_missing_fields(self):
        """verify_credentials 缺 access_token / app_id → False。"""
        adapter = KuaishouAdapter()
        ok, msg = await adapter.verify_credentials({"access_token": "", "app_id": "aid"})
        assert ok is False
        assert "missing" in msg

    async def test_verify_credentials_http_error(self):
        """verify_credentials HTTP 异常 → False。"""
        client = _mock_async_client(get_side=httpx.ConnectError("refused"))
        with patch("app.services.publish.adapters.kuaishou.httpx.AsyncClient", return_value=client):
            adapter = KuaishouAdapter()
            ok, msg = await adapter.verify_credentials({"access_token": "tok", "app_id": "aid"})
        assert ok is False
        assert "http error" in msg

    async def test_verify_credentials_result_not_1(self):
        """verify_credentials result != 1 → False。"""
        resp = _make_resp(200, json_data={"result": 0, "error_msg": "invalid token"})
        client = _mock_async_client(get_return=resp)
        with patch("app.services.publish.adapters.kuaishou.httpx.AsyncClient", return_value=client):
            adapter = KuaishouAdapter()
            ok, msg = await adapter.verify_credentials({"access_token": "tok", "app_id": "aid"})
        assert ok is False
        assert "verify failed" in msg

    async def test_publish_unsupported_format(self):
        """publish 非 video 格式 → success=False。"""
        adapter = KuaishouAdapter()
        content = PublishContent(format="md", title="标题", text="正文")
        result = await adapter.publish(content, {"access_token": "tok"}, {})
        assert result.success is False
        assert "only supports video format" in result.error_message

    async def test_publish_missing_open_id(self):
        """publish 缺 open_id(credentials 和 platform_config 都没)→ success=False。"""
        adapter = KuaishouAdapter()
        content = PublishContent(format="video", title="标题", file_path="/tmp/v.mp4")
        result = await adapter.publish(
            content, {"access_token": "tok", "app_id": "aid"},
            {},
        )
        assert result.success is False
        assert "missing open_id" in result.error_message

    async def test_publish_video_not_found(self):
        """publish _upload_video 文件不存在 → success=False。"""
        adapter = KuaishouAdapter()
        content = PublishContent(format="video", title="标题", file_path="/nonexistent/v.mp4")
        result = await adapter.publish(
            content, {"access_token": "tok", "app_id": "aid"},
            {"open_id": "oid"},
        )
        assert result.success is False
        assert "video not found" in result.error_message

    async def test_publish_upload_http_error(self, tmp_path):
        """publish _upload_video HTTP 异常 → success=False。"""
        video_file = tmp_path / "test.mp4"
        video_file.write_bytes(b"fake video")
        client = _mock_async_client(post_side=httpx.ConnectError("refused"))
        with patch("app.services.publish.adapters.kuaishou.httpx.AsyncClient", return_value=client):
            adapter = KuaishouAdapter()
            content = PublishContent(format="video", title="标题", file_path=str(video_file))
            result = await adapter.publish(
                content, {"access_token": "tok", "app_id": "aid"},
                {"open_id": "oid"},
            )
        assert result.success is False
        assert "upload failed" in result.error_message

    async def test_publish_success(self, tmp_path):
        """publish 成功:upload_video → photo/publish 全链路 mock。"""
        video_file = tmp_path / "test.mp4"
        video_file.write_bytes(b"fake video content")
        upload_resp = _make_resp(200, json_data={
            "result": 1,
            "video_info": {"video_id": "vid789"},
        })
        publish_resp = _make_resp(200, json_data={
            "result": 1,
            "photo_info": {"photo_id": "photo123", "share_url": "https://www.kuaishou.com/photo/123"},
        })
        client = _mock_async_client(post_side=[upload_resp, publish_resp])
        with patch("app.services.publish.adapters.kuaishou.httpx.AsyncClient", return_value=client):
            adapter = KuaishouAdapter()
            content = PublishContent(format="video", title="快手视频", file_path=str(video_file))
            result = await adapter.publish(
                content, {"access_token": "tok", "app_id": "aid"},
                {"open_id": "oid", "caption": "描述"},
            )
        assert result.success is True
        assert result.platform_content_id == "photo123"
        assert "kuaishou.com/photo/123" in result.published_url
        assert result.payload["video_id"] == "vid789"


# =============================================================================
# 6. MediumAdapter(10 tests)
# =============================================================================


class TestMediumAdapter:
    """Medium 适配器:基于 REST API(httpx)。"""

    def test_class_attributes(self):
        """类属性:needs_browser=False(默认)。"""
        assert MediumAdapter.platform_id == "medium"
        assert MediumAdapter.platform_name == "Medium"
        assert MediumAdapter.supported_formats == ["md", "html"]
        assert MediumAdapter.requires_credentials == ["integration_token"]
        assert MediumAdapter.needs_browser is False

    def test_instantiation(self):
        """可实例化。"""
        adapter = MediumAdapter()
        assert isinstance(adapter, BasePlatformAdapter)

    def test_headers(self):
        """_headers:token → Authorization Bearer + Accept + Content-Type。"""
        adapter = MediumAdapter()
        headers = adapter._headers("mytoken")
        assert headers["Authorization"] == "Bearer mytoken"
        assert headers["Accept"] == "application/json"
        assert headers["Content-Type"] == "application/json"
        assert headers["Accept-Charset"] == "utf-8"

    async def test_verify_credentials_success(self):
        """verify_credentials 成功:GET /me 返回 200 → connected as <name>。"""
        resp = _make_resp(200, json_data={
            "data": {"name": "Medium User", "id": "uid123", "username": "mediumuser"},
        })
        client = _mock_async_client(get_return=resp)
        with patch("app.services.publish.adapters.medium.httpx.AsyncClient", return_value=client):
            adapter = MediumAdapter()
            ok, msg = await adapter.verify_credentials({"integration_token": "tok"})
        assert ok is True
        assert "Medium User" in msg
        assert "uid123" in msg

    async def test_verify_credentials_missing_token(self):
        """verify_credentials 缺 integration_token → False。"""
        adapter = MediumAdapter()
        ok, msg = await adapter.verify_credentials({"integration_token": ""})
        assert ok is False
        assert "missing integration_token" in msg

    async def test_verify_credentials_http_error(self):
        """verify_credentials HTTP 异常 → False。"""
        client = _mock_async_client(get_side=httpx.ConnectError("refused"))
        with patch("app.services.publish.adapters.medium.httpx.AsyncClient", return_value=client):
            adapter = MediumAdapter()
            ok, msg = await adapter.verify_credentials({"integration_token": "tok"})
        assert ok is False
        assert "http error" in msg

    async def test_verify_credentials_non_200(self):
        """verify_credentials API 返回 401 → False。"""
        resp = _make_resp(401, text="Unauthorized")
        client = _mock_async_client(get_return=resp)
        with patch("app.services.publish.adapters.medium.httpx.AsyncClient", return_value=client):
            adapter = MediumAdapter()
            ok, msg = await adapter.verify_credentials({"integration_token": "bad"})
        assert ok is False
        assert "401" in msg

    async def test_publish_missing_token(self):
        """publish 缺 integration_token → success=False。"""
        adapter = MediumAdapter()
        content = PublishContent(format="html", title="标题", html="<p>内容</p>")
        result = await adapter.publish(content, {"integration_token": ""}, {})
        assert result.success is False
        assert "missing integration_token" in result.error_message

    async def test_publish_failed_resolve_author(self):
        """publish 无 author_id 且 GET /me 无 id → failed to resolve author_id。"""
        me_resp = _make_resp(200, json_data={"data": {}})
        client = _mock_async_client(get_return=me_resp)
        with patch("app.services.publish.adapters.medium.httpx.AsyncClient", return_value=client):
            adapter = MediumAdapter()
            content = PublishContent(format="html", title="标题", html="<p>内容</p>")
            result = await adapter.publish(
                content, {"integration_token": "tok"},
                {},
            )
        assert result.success is False
        assert "failed to resolve author_id" in result.error_message

    async def test_publish_success(self):
        """publish 成功:author_id 已在 platform_config 中 → 直接 POST /users/{id}/posts。"""
        post_resp = _make_resp(201, json_data={
            "data": {"id": "post123", "url": "https://medium.com/@user/post123"},
        })
        client = _mock_async_client(post_return=post_resp)
        with patch("app.services.publish.adapters.medium.httpx.AsyncClient", return_value=client):
            adapter = MediumAdapter()
            content = PublishContent(format="html", title="Medium Post", html="<p>Hello</p>")
            result = await adapter.publish(
                content, {"integration_token": "tok"},
                {"author_id": "user123", "tags": ["tech"]},
            )
        assert result.success is True
        assert result.platform_content_id == "post123"
        assert "medium.com/@user/post123" in result.published_url
        assert result.payload["publication_id"] is None


# =============================================================================
# 7. ShipinhaoAdapter(12 tests)
# =============================================================================


class TestShipinhaoAdapter:
    """视频号适配器:基于 Playwright 浏览器自动化(微信生态)。"""

    def test_class_attributes(self):
        """类属性:needs_browser=True。"""
        assert ShipinhaoAdapter.platform_id == "shipinhao"
        assert ShipinhaoAdapter.platform_name == "视频号"
        assert ShipinhaoAdapter.supported_formats == ["video"]
        assert ShipinhaoAdapter.requires_credentials == ["wechat_channels"]
        assert ShipinhaoAdapter.needs_browser is True

    def test_instantiation(self):
        """可实例化。"""
        adapter = ShipinhaoAdapter()
        assert isinstance(adapter, BasePlatformAdapter)

    def test_parse_cookies_json_string(self):
        """_parse_cookies:JSON 字符串 → Playwright cookies list。"""
        adapter = ShipinhaoAdapter()
        raw = '[{"name":"sess","value":"v1","httpOnly":true}]'
        cookies = adapter._parse_cookies({"wechat_channels": raw})
        assert len(cookies) == 1
        assert cookies[0]["name"] == "sess"
        assert cookies[0]["value"] == "v1"
        assert cookies[0]["domain"] == ".qq.com"
        assert cookies[0]["path"] == "/"
        assert cookies[0]["httpOnly"] is True

    def test_parse_cookies_dict(self):
        """_parse_cookies:dict → cookies list(domain 默认 .qq.com)。"""
        adapter = ShipinhaoAdapter()
        cookies = adapter._parse_cookies({"wechat_channels": {"sess": "v1", "foo": "bar"}})
        assert len(cookies) == 2
        by_name = {c["name"]: c for c in cookies}
        assert by_name["sess"]["value"] == "v1"
        assert by_name["foo"]["value"] == "bar"
        assert by_name["sess"]["domain"] == ".qq.com"

    def test_parse_cookies_cookie_string(self):
        """_parse_cookies:cookie 字符串(k1=v1; k2=v2)→ cookies list。"""
        adapter = ShipinhaoAdapter()
        cookies = adapter._parse_cookies({"wechat_channels": "sess=v1; foo=bar"})
        assert len(cookies) == 2
        by_name = {c["name"]: c for c in cookies}
        assert by_name["sess"]["value"] == "v1"
        assert by_name["foo"]["value"] == "bar"

    def test_parse_cookies_empty(self):
        """_parse_cookies:空字符串 → []。"""
        adapter = ShipinhaoAdapter()
        assert adapter._parse_cookies({"wechat_channels": ""}) == []
        assert adapter._parse_cookies({}) == []

    async def test_verify_credentials_no_playwright(self, monkeypatch):
        """verify_credentials 无 Playwright → False。"""
        monkeypatch.setattr("app.services.publish.adapters.shipinhao._HAS_PLAYWRIGHT", False)
        adapter = ShipinhaoAdapter()
        ok, msg = await adapter.verify_credentials({"wechat_channels": '[{"name":"a","value":"b"}]'})
        assert ok is False
        assert "Playwright not installed" in msg

    async def test_verify_credentials_success(self, monkeypatch):
        """verify_credentials 成功:page.url 不含 login + content 不含"扫码" → True。"""
        monkeypatch.setattr("app.services.publish.adapters.shipinhao._HAS_PLAYWRIGHT", True)
        mock_pw, _, _ = _make_playwright_chain(
            page_url="https://channels.weixin.qq.com/platform/dashboard",
            page_content="<html>视频号助手</html>",
        )
        monkeypatch.setattr("app.services.publish.adapters.shipinhao.async_playwright", mock_pw, raising=False)
        adapter = ShipinhaoAdapter()
        ok, msg = await adapter.verify_credentials({"wechat_channels": '[{"name":"a","value":"b"}]'})
        assert ok is True
        assert "connected" in msg

    async def test_verify_credentials_login_redirect(self, monkeypatch):
        """verify_credentials cookie 过期:page.url 含 login → False。"""
        monkeypatch.setattr("app.services.publish.adapters.shipinhao._HAS_PLAYWRIGHT", True)
        mock_pw, _, _ = _make_playwright_chain(
            page_url="https://channels.weixin.qq.com/login",
        )
        monkeypatch.setattr("app.services.publish.adapters.shipinhao.async_playwright", mock_pw, raising=False)
        adapter = ShipinhaoAdapter()
        ok, msg = await adapter.verify_credentials({"wechat_channels": '[{"name":"a","value":"b"}]'})
        assert ok is False
        assert "cookie expired" in msg

    async def test_publish_no_playwright(self, monkeypatch):
        """publish 无 Playwright → success=False。"""
        monkeypatch.setattr("app.services.publish.adapters.shipinhao._HAS_PLAYWRIGHT", False)
        adapter = ShipinhaoAdapter()
        content = PublishContent(format="video", title="标题", file_path="/tmp/v.mp4")
        result = await adapter.publish(content, {"wechat_channels": '[{"name":"a","value":"b"}]'}, {})
        assert result.success is False
        assert "Playwright not installed" in result.error_message

    async def test_publish_unsupported_format(self, monkeypatch):
        """publish 非 video 格式 → success=False。

        BUG: 源码第 128-139 行 cookie 检查(format 检查)在 format 检查之前,
        cookie 通过后才走到 format 检查。行为正确,仅检查顺序问题。
        """
        monkeypatch.setattr("app.services.publish.adapters.shipinhao._HAS_PLAYWRIGHT", True)
        adapter = ShipinhaoAdapter()
        content = PublishContent(format="md", title="标题", text="正文")
        result = await adapter.publish(
            content, {"wechat_channels": '[{"name":"a","value":"b"}]'},
            {},
        )
        assert result.success is False
        assert "only supports video format" in result.error_message

    async def test_publish_missing_cookies(self, monkeypatch):
        """publish 缺 wechat_channels → success=False。"""
        monkeypatch.setattr("app.services.publish.adapters.shipinhao._HAS_PLAYWRIGHT", True)
        adapter = ShipinhaoAdapter()
        content = PublishContent(format="video", title="标题", file_path="/tmp/v.mp4")
        result = await adapter.publish(content, {"wechat_channels": ""}, {})
        assert result.success is False
        assert "missing wechat_channels" in result.error_message

    async def test_publish_success(self, monkeypatch, tmp_path):
        """publish 成功:mock Playwright 全链路 + 真实临时视频文件。"""
        monkeypatch.setattr("app.services.publish.adapters.shipinhao._HAS_PLAYWRIGHT", True)
        video_file = tmp_path / "test.mp4"
        video_file.write_bytes(b"fake video content")
        mock_pw, _, _ = _make_playwright_chain(
            page_url="https://channels.weixin.qq.com/platform/post/list",
            locator_count=1,
        )
        monkeypatch.setattr("app.services.publish.adapters.shipinhao.async_playwright", mock_pw, raising=False)
        adapter = ShipinhaoAdapter()
        content = PublishContent(format="video", title="视频号内容", file_path=str(video_file))
        result = await adapter.publish(
            content, {"wechat_channels": '[{"name":"a","value":"b"}]'},
            {"tags": ["测试"]},
        )
        assert result.success is True
        assert result.platform == "shipinhao"
        assert result.payload["title"] == "视频号内容"
        assert result.payload["tags"] == ["测试"]
