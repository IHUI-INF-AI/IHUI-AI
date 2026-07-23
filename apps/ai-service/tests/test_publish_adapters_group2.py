"""publish/adapters 7 个平台适配器综合测试(2026-07-23 立,补齐零覆盖)。

覆盖维度(80 cases):
1. ToutiaoAdapter(10 cases):类属性 / 实例化 / verify_credentials 成功+缺凭证+HTTP 异常+无 token / publish 成功+缺凭证+HTTP 异常+API 错误
2. WechatAdapter(11 cases):类属性 / 实例化 / verify_credentials 成功+缺凭证+HTTP 异常+errcode / publish 草稿成功+缺凭证+草稿失败+立即发布成功+无 media_id
3. WeiboAdapter(12 cases):类属性 / 实例化 / verify_credentials 成功(有用户信息)+成功(无用户信息)+缺凭证+HTTP 异常+无 uid / publish 文本成功+缺凭证+缺文本+图片缺 file_path+视频缺 video_url
4. WordPressAdapter(12 cases):类属性 / 实例化 / _build_xmlrpc_request 基本+混合类型 / _parse_xmlrpc_response int+fault / _decode_value struct+array / verify_credentials 成功+缺字段 / publish 成功+缺凭证
5. XiaohongshuAdapter(12 cases):类属性 / 实例化 / _cookies / verify_credentials 无 Playwright+缺凭证+成功+登录跳转 / publish 无 Playwright+缺凭证+无图片+成功+无效图片路径
6. YouTubeAdapter(11 cases):类属性 / 实例化 / _refresh_access_token 成功+缺字段+HTTP 异常 / verify_credentials 成功(有频道)+成功(无频道)+缺凭证 / publish 非 video+缺 file_path+成功
7. ZhihuAdapter(12 cases):类属性 / 实例化 / _cookies / verify_credentials 无 Playwright+缺凭证+成功+登录可见 / publish 无 Playwright+缺凭证+按钮未找到+成功+超时
"""

from __future__ import annotations

import xml.etree.ElementTree as ET
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.services.publish.adapters.toutiao import ToutiaoAdapter
from app.services.publish.adapters.wechat import WechatAdapter
from app.services.publish.adapters.weibo import WeiboAdapter
from app.services.publish.adapters.wordpress import WordPressAdapter
from app.services.publish.adapters.xiaohongshu import XiaohongshuAdapter
from app.services.publish.adapters.youtube import YouTubeAdapter
from app.services.publish.adapters.zhihu import ZhihuAdapter
from app.services.publish.base_adapter import BasePlatformAdapter, PublishContent, PublishResult


# =============================================================================
# 工厂 / 辅助函数
# =============================================================================


def _make_resp(status_code: int = 200, json_data: dict | None = None,
               text: str = "", headers: dict | None = None) -> MagicMock:
    """创建 mock httpx 同步响应(用于 httpx.post / AsyncClient 返回值)。"""
    resp = MagicMock()
    resp.status_code = status_code
    resp.json.return_value = json_data if json_data is not None else {}
    resp.text = text
    resp.headers = headers if headers is not None else {}
    resp.content = text.encode("utf-8") if text else b""
    return resp


def _mock_async_client(*, post_return=None, post_side=None,
                       get_return=None, get_side=None,
                       put_return=None) -> AsyncMock:
    """创建 mock httpx.AsyncClient 上下文管理器。

    post_side / get_side 支持列表(多响应顺序返回)或异常实例(模拟 HTTP 错误)。
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
    if put_return is not None:
        client.put = AsyncMock(return_value=put_return)
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=None)
    return client


def _make_playwright_chain(page_url: str = "https://example.com",
                           page_content: str = "<html></html>",
                           locator_count: int = 1,
                           locator_tag: str = "TEXTAREA",
                           wait_for_url_raises: bool = False):
    """创建 Playwright mock 链。

    返回 (mock_async_playwright, mock_page, mock_locator)。
    mock_async_playwright 是可调用对象,async_playwright() 返回 async context manager。
    """
    mock_locator = MagicMock()
    mock_locator.first = mock_locator
    mock_locator.count = AsyncMock(return_value=locator_count)
    mock_locator.fill = AsyncMock()
    mock_locator.click = AsyncMock()
    mock_locator.set_input_files = AsyncMock()
    mock_locator.evaluate = AsyncMock(return_value=locator_tag)

    mock_page = AsyncMock()
    mock_page.url = page_url
    mock_page.content = AsyncMock(return_value=page_content)
    mock_page.goto = AsyncMock()
    mock_page.wait_for_timeout = AsyncMock()
    mock_page.evaluate = AsyncMock()
    mock_page.locator = MagicMock(return_value=mock_locator)
    if wait_for_url_raises:
        mock_page.wait_for_url = AsyncMock(side_effect=Exception("timeout"))
    else:
        mock_page.wait_for_url = AsyncMock()

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
# 1. ToutiaoAdapter(10 tests)
# =============================================================================


class TestToutiaoAdapter:
    """头条号适配器:基于头条号开放平台 OpenAPI(httpx)。"""

    def test_class_attributes(self):
        """类属性:platform_id / platform_name / supported_formats / requires_credentials。"""
        assert ToutiaoAdapter.platform_id == "toutiao"
        assert ToutiaoAdapter.platform_name == "头条号"
        assert ToutiaoAdapter.supported_formats == ["md", "html"]
        assert ToutiaoAdapter.requires_credentials == ["app_id", "app_secret"]
        assert ToutiaoAdapter.needs_browser is False

    def test_instantiation(self):
        """适配器可实例化且为 BasePlatformAdapter 子类。"""
        adapter = ToutiaoAdapter()
        assert isinstance(adapter, BasePlatformAdapter)

    async def test_verify_credentials_success(self):
        """verify_credentials 成功:token API 返回 access_token + getTokenInfo 返回 success。"""
        token_resp = _make_resp(200, json_data={"access_token": "tok123"})
        verify_resp = _make_resp(200, json_data={
            "message": "success", "data": {"expires_in": 7200},
        })
        client = _mock_async_client(post_return=token_resp, get_return=verify_resp)
        with patch("app.services.publish.adapters.toutiao.httpx.AsyncClient", return_value=client):
            adapter = ToutiaoAdapter()
            ok, msg = await adapter.verify_credentials({"app_id": "id", "app_secret": "sec"})
        assert ok is True
        assert "7200" in msg

    async def test_verify_credentials_missing_app_id(self):
        """verify_credentials 缺 app_id → False。"""
        adapter = ToutiaoAdapter()
        ok, msg = await adapter.verify_credentials({"app_id": "", "app_secret": "sec"})
        assert ok is False
        assert "missing" in msg

    async def test_verify_credentials_http_error(self):
        """verify_credentials token API HTTP 异常 → False。"""
        client = _mock_async_client(post_side=httpx.ConnectError("refused"))
        with patch("app.services.publish.adapters.toutiao.httpx.AsyncClient", return_value=client):
            adapter = ToutiaoAdapter()
            ok, msg = await adapter.verify_credentials({"app_id": "id", "app_secret": "sec"})
        assert ok is False
        assert "http error" in msg

    async def test_verify_credentials_no_access_token(self):
        """verify_credentials token API 返回无 access_token → False。"""
        token_resp = _make_resp(200, json_data={"error": "bad creds"})
        client = _mock_async_client(post_return=token_resp)
        with patch("app.services.publish.adapters.toutiao.httpx.AsyncClient", return_value=client):
            adapter = ToutiaoAdapter()
            ok, msg = await adapter.verify_credentials({"app_id": "id", "app_secret": "sec"})
        assert ok is False
        assert "no access_token" in msg

    async def test_publish_success(self):
        """publish 成功:返回 PublishResult success=True + article_id。"""
        token_resp = _make_resp(200, json_data={"access_token": "tok"})
        publish_resp = _make_resp(200, json_data={
            "message": "success", "data": {"article_id": "art123"},
        })
        client = _mock_async_client(post_side=[token_resp, publish_resp])
        with patch("app.services.publish.adapters.toutiao.httpx.AsyncClient", return_value=client):
            adapter = ToutiaoAdapter()
            content = PublishContent(format="md", title="测试标题", text="正文")
            result = await adapter.publish(content, {"app_id": "id", "app_secret": "sec"}, {})
        assert result.success is True
        assert result.platform_content_id == "art123"
        assert result.payload["article_id"] == "art123"

    async def test_publish_no_credentials(self):
        """publish 缺凭证 → success=False。"""
        adapter = ToutiaoAdapter()
        content = PublishContent(format="md", title="标题", text="正文")
        result = await adapter.publish(content, {"app_id": "", "app_secret": ""}, {})
        assert result.success is False
        assert "missing" in result.error_message

    async def test_publish_http_error(self):
        """publish HTTP 异常 → success=False。"""
        token_resp = _make_resp(200, json_data={"access_token": "tok"})
        publish_err = httpx.ConnectError("timeout")
        client = _mock_async_client(post_side=[token_resp, publish_err])
        with patch("app.services.publish.adapters.toutiao.httpx.AsyncClient", return_value=client):
            adapter = ToutiaoAdapter()
            content = PublishContent(format="md", title="标题", text="正文")
            result = await adapter.publish(content, {"app_id": "id", "app_secret": "sec"}, {})
        assert result.success is False
        assert "publish failed" in result.error_message

    async def test_publish_api_error(self):
        """publish API 返回 message != success → success=False。"""
        token_resp = _make_resp(200, json_data={"access_token": "tok"})
        publish_resp = _make_resp(200, json_data={"message": "error", "data": {}})
        client = _mock_async_client(post_side=[token_resp, publish_resp])
        with patch("app.services.publish.adapters.toutiao.httpx.AsyncClient", return_value=client):
            adapter = ToutiaoAdapter()
            content = PublishContent(format="md", title="标题", text="正文")
            result = await adapter.publish(content, {"app_id": "id", "app_secret": "sec"}, {})
        assert result.success is False
        assert "publish failed" in result.error_message


# =============================================================================
# 2. WechatAdapter(11 tests)
# =============================================================================


class TestWechatAdapter:
    """微信公众号适配器:基于公众号 OpenAPI(httpx)。"""

    def test_class_attributes(self):
        """类属性。"""
        assert WechatAdapter.platform_id == "wechat"
        assert WechatAdapter.platform_name == "公众号"
        assert WechatAdapter.supported_formats == ["md", "html"]
        assert WechatAdapter.requires_credentials == ["app_id", "app_secret"]
        assert WechatAdapter.needs_browser is False

    def test_instantiation(self):
        """可实例化。"""
        adapter = WechatAdapter()
        assert isinstance(adapter, BasePlatformAdapter)

    async def test_verify_credentials_success(self):
        """verify_credentials 成功:token API 返回 access_token。"""
        token_resp = _make_resp(200, json_data={"access_token": "tok"})
        client = _mock_async_client(get_return=token_resp)
        with patch("app.services.publish.adapters.wechat.httpx.AsyncClient", return_value=client):
            adapter = WechatAdapter()
            ok, msg = await adapter.verify_credentials({"app_id": "id", "app_secret": "sec"})
        assert ok is True
        assert "access_token acquired" in msg

    async def test_verify_credentials_missing_app_id(self):
        """verify_credentials 缺 app_id → False。"""
        adapter = WechatAdapter()
        ok, msg = await adapter.verify_credentials({"app_id": "", "app_secret": "sec"})
        assert ok is False
        assert "missing" in msg

    async def test_verify_credentials_http_error(self):
        """verify_credentials HTTP 异常 → False。"""
        client = _mock_async_client(get_side=httpx.ConnectError("refused"))
        with patch("app.services.publish.adapters.wechat.httpx.AsyncClient", return_value=client):
            adapter = WechatAdapter()
            ok, msg = await adapter.verify_credentials({"app_id": "id", "app_secret": "sec"})
        assert ok is False
        assert "http error" in msg

    async def test_verify_credentials_errcode_nonzero(self):
        """verify_credentials token API 返回 errcode != 0 → False。"""
        token_resp = _make_resp(200, json_data={"errcode": 40001, "errmsg": "invalid"})
        client = _mock_async_client(get_return=token_resp)
        with patch("app.services.publish.adapters.wechat.httpx.AsyncClient", return_value=client):
            adapter = WechatAdapter()
            ok, msg = await adapter.verify_credentials({"app_id": "id", "app_secret": "sec"})
        assert ok is False
        assert "get token failed" in msg

    async def test_publish_success_draft_only(self):
        """publish 成功(仅草稿):publish_now=False → stage=draft。"""
        token_resp = _make_resp(200, json_data={"access_token": "tok"})
        draft_resp = _make_resp(200, json_data={"errcode": 0, "media_id": "media456"})
        client = _mock_async_client(get_return=token_resp, post_return=draft_resp)
        with patch("app.services.publish.adapters.wechat.httpx.AsyncClient", return_value=client):
            adapter = WechatAdapter()
            content = PublishContent(format="md", title="微信文章", text="正文")
            config = {"thumb_media_id": "thumb123", "publish_now": False}
            result = await adapter.publish(content, {"app_id": "id", "app_secret": "sec"}, config)
        assert result.success is True
        assert result.platform_content_id == "media456"
        assert result.payload["stage"] == "draft"

    async def test_publish_no_credentials(self):
        """publish 缺凭证 → success=False。"""
        adapter = WechatAdapter()
        content = PublishContent(format="md", title="标题", text="正文")
        result = await adapter.publish(content, {"app_id": "", "app_secret": ""}, {})
        assert result.success is False
        assert "missing" in result.error_message

    async def test_publish_draft_add_failed(self):
        """publish 草稿新增失败(errcode != 0)→ success=False。"""
        token_resp = _make_resp(200, json_data={"access_token": "tok"})
        draft_resp = _make_resp(200, json_data={"errcode": 40001, "errmsg": "invalid"})
        client = _mock_async_client(get_return=token_resp, post_return=draft_resp)
        with patch("app.services.publish.adapters.wechat.httpx.AsyncClient", return_value=client):
            adapter = WechatAdapter()
            content = PublishContent(format="md", title="标题", text="正文")
            result = await adapter.publish(content, {"app_id": "id", "app_secret": "sec"}, {})
        assert result.success is False
        assert "draft add failed" in result.error_message

    async def test_publish_publish_now_success(self):
        """publish 立即发布成功:publish_now=True → stage=submitted_for_publish。"""
        token_resp = _make_resp(200, json_data={"access_token": "tok"})
        draft_resp = _make_resp(200, json_data={"errcode": 0, "media_id": "media789"})
        freepublish_resp = _make_resp(200, json_data={"errcode": 0, "publish_id": "pub123"})
        client = _mock_async_client(
            get_return=token_resp, post_side=[draft_resp, freepublish_resp],
        )
        with patch("app.services.publish.adapters.wechat.httpx.AsyncClient", return_value=client):
            adapter = WechatAdapter()
            content = PublishContent(format="md", title="标题", text="正文")
            config = {"thumb_media_id": "thumb", "publish_now": True}
            result = await adapter.publish(content, {"app_id": "id", "app_secret": "sec"}, config)
        assert result.success is True
        assert result.payload["stage"] == "submitted_for_publish"
        assert result.payload["publish_id"] == "pub123"

    async def test_publish_no_media_id(self):
        """publish 草稿新增成功但无 media_id → success=False。"""
        token_resp = _make_resp(200, json_data={"access_token": "tok"})
        draft_resp = _make_resp(200, json_data={"errcode": 0})
        client = _mock_async_client(get_return=token_resp, post_return=draft_resp)
        with patch("app.services.publish.adapters.wechat.httpx.AsyncClient", return_value=client):
            adapter = WechatAdapter()
            content = PublishContent(format="md", title="标题", text="正文")
            result = await adapter.publish(content, {"app_id": "id", "app_secret": "sec"}, {})
        assert result.success is False
        assert "no media_id" in result.error_message


# =============================================================================
# 3. WeiboAdapter(12 tests)
# =============================================================================


class TestWeiboAdapter:
    """微博适配器:基于微博开放平台 OAuth2 API(httpx)。"""

    def test_class_attributes(self):
        """类属性。"""
        assert WeiboAdapter.platform_id == "weibo"
        assert WeiboAdapter.platform_name == "微博"
        assert WeiboAdapter.supported_formats == ["md", "html", "image", "video"]
        assert WeiboAdapter.requires_credentials == ["access_token", "uid"]
        assert WeiboAdapter.needs_browser is False

    def test_instantiation(self):
        """可实例化。"""
        adapter = WeiboAdapter()
        assert isinstance(adapter, BasePlatformAdapter)

    async def test_verify_credentials_success_with_user_info(self):
        """verify_credentials 成功:get_uid 返回 uid + show.json 返回 screen_name。"""
        uid_resp = _make_resp(200, json_data={"uid": "100"})
        user_resp = _make_resp(200, json_data={"screen_name": "测试用户"})
        client = _mock_async_client(get_side=[uid_resp, user_resp])
        with patch("app.services.publish.adapters.weibo.httpx.AsyncClient", return_value=client):
            adapter = WeiboAdapter()
            ok, msg = await adapter.verify_credentials({"access_token": "tok", "uid": "100"})
        assert ok is True
        assert "测试用户" in msg
        assert "uid=100" in msg

    async def test_verify_credentials_success_no_user_info(self):
        """verify_credentials 成功但 show.json 非 200 → 降级返回 connected (uid=)。"""
        uid_resp = _make_resp(200, json_data={"uid": "200"})
        user_resp = _make_resp(500, json_data={})
        client = _mock_async_client(get_side=[uid_resp, user_resp])
        with patch("app.services.publish.adapters.weibo.httpx.AsyncClient", return_value=client):
            adapter = WeiboAdapter()
            ok, msg = await adapter.verify_credentials({"access_token": "tok", "uid": "200"})
        assert ok is True
        assert "uid=200" in msg

    async def test_verify_credentials_missing_access_token(self):
        """verify_credentials 缺 access_token → False。"""
        adapter = WeiboAdapter()
        ok, msg = await adapter.verify_credentials({"access_token": "", "uid": "100"})
        assert ok is False
        assert "missing access_token" in msg

    async def test_verify_credentials_http_error(self):
        """verify_credentials HTTP 异常 → False。"""
        client = _mock_async_client(get_side=httpx.ConnectError("refused"))
        with patch("app.services.publish.adapters.weibo.httpx.AsyncClient", return_value=client):
            adapter = WeiboAdapter()
            ok, msg = await adapter.verify_credentials({"access_token": "tok", "uid": "100"})
        assert ok is False
        assert "http error" in msg

    async def test_verify_credentials_no_uid(self):
        """verify_credentials get_uid 返回无 uid → False。"""
        uid_resp = _make_resp(200, json_data={"error": "no uid"})
        client = _mock_async_client(get_return=uid_resp)
        with patch("app.services.publish.adapters.weibo.httpx.AsyncClient", return_value=client):
            adapter = WeiboAdapter()
            ok, msg = await adapter.verify_credentials({"access_token": "tok", "uid": "100"})
        assert ok is False
        assert "verify failed" in msg

    async def test_publish_text_success(self):
        """publish 文本微博(md 格式)成功:返回 weibo_id + published_url。"""
        success_resp = _make_resp(200, json_data={
            "id": 123, "mid": "mid456", "user": {"id": 100},
        })
        client = _mock_async_client(post_return=success_resp)
        with patch("app.services.publish.adapters.weibo.httpx.AsyncClient", return_value=client):
            adapter = WeiboAdapter()
            content = PublishContent(format="md", title="标题", text="正文内容")
            result = await adapter.publish(content, {"access_token": "tok", "uid": "100"}, {})
        assert result.success is True
        assert result.platform_content_id == "123"
        assert "weibo.com/100/mid456" in result.published_url

    async def test_publish_missing_access_token(self):
        """publish 缺 access_token → success=False。"""
        adapter = WeiboAdapter()
        content = PublishContent(format="md", title="标题", text="正文")
        result = await adapter.publish(content, {"access_token": "", "uid": "100"}, {})
        assert result.success is False
        assert "missing access_token" in result.error_message

    async def test_publish_missing_text(self):
        """publish 无标题无正文无 platform_config.text → success=False。"""
        adapter = WeiboAdapter()
        content = PublishContent(format="md", title="", text=None)
        result = await adapter.publish(content, {"access_token": "tok", "uid": "100"}, {})
        assert result.success is False
        assert "missing text content" in result.error_message

    async def test_publish_image_no_file_path(self):
        """publish 图片格式但无 file_path → success=False。"""
        adapter = WeiboAdapter()
        content = PublishContent(format="image", title="图片微博", text="看图")
        result = await adapter.publish(content, {"access_token": "tok", "uid": "100"}, {})
        assert result.success is False
        assert "image format requires file_path" in result.error_message

    async def test_publish_video_no_video_url(self):
        """publish 视频格式但无 video_url → success=False。"""
        adapter = WeiboAdapter()
        content = PublishContent(format="video", title="视频微博", text="看视频")
        result = await adapter.publish(content, {"access_token": "tok", "uid": "100"}, {})
        assert result.success is False
        assert "video format requires" in result.error_message


# =============================================================================
# 4. WordPressAdapter(12 tests)
# =============================================================================


class TestWordPressAdapter:
    """WordPress 适配器:基于 XML-RPC API(httpx.post 同步)。"""

    def test_class_attributes(self):
        """类属性。"""
        assert WordPressAdapter.platform_id == "wordpress"
        assert WordPressAdapter.platform_name == "WordPress"
        assert WordPressAdapter.supported_formats == ["md", "html", "docx", "pdf"]
        assert WordPressAdapter.requires_credentials == ["site_url", "username", "application_password"]
        assert WordPressAdapter.needs_browser is False

    def test_instantiation(self):
        """可实例化。"""
        adapter = WordPressAdapter()
        assert isinstance(adapter, BasePlatformAdapter)

    def test_build_xmlrpc_request_basic(self):
        """_build_xmlrpc_request 构造基本 XML-RPC 请求(methodName + 3 个 string/int 参数)。"""
        adapter = WordPressAdapter()
        xml = adapter._build_xmlrpc_request("wp.getProfiles", [1, "user", "pass"])
        assert '<?xml version="1.0" encoding="UTF-8"?>' in xml
        assert "<methodName>wp.getProfiles</methodName>" in xml
        assert "<int>1</int>" in xml
        assert "<string>user</string>" in xml
        assert "<string>pass</string>" in xml

    def test_build_xmlrpc_request_mixed_types(self):
        """_build_xmlrpc_request 支持混合类型:dict → struct,list → array,bool → boolean。"""
        adapter = WordPressAdapter()
        xml = adapter._build_xmlrpc_request("wp.newPost", [
            1, "user", "pass",
            {"post_title": "Hello", "publish": True},
            ["tag1", "tag2"],
        ])
        assert "<struct>" in xml
        assert "<member>" in xml
        assert "<array>" in xml
        assert "<boolean>1</boolean>" in xml

    def test_parse_xmlrpc_response_int(self):
        """_parse_xmlrpc_response 解析 int 返回 Python int。"""
        adapter = WordPressAdapter()
        xml = (
            b'<?xml version="1.0"?><methodResponse>'
            b'<params><param><value><int>42</int></value></param></params>'
            b'</methodResponse>'
        )
        assert adapter._parse_xmlrpc_response(xml) == 42

    def test_parse_xmlrpc_response_fault_raises(self):
        """_parse_xmlrpc_response 检测到 fault → 抛 RuntimeError。"""
        adapter = WordPressAdapter()
        xml = (
            b'<?xml version="1.0"?><methodResponse>'
            b'<fault><value><struct>'
            b'<member><name>faultString</name><value><string>Auth failed</string></value></member>'
            b'</struct></value></fault></methodResponse>'
        )
        with pytest.raises(RuntimeError, match="WordPress XML-RPC fault: Auth failed"):
            adapter._parse_xmlrpc_response(xml)

    def test_decode_value_struct(self):
        """_decode_value 解析 struct → dict。"""
        adapter = WordPressAdapter()
        el = ET.fromstring(
            '<value><struct>'
            '<member><name>displayName</name><value><string>Alice</string></value></member>'
            '<member><name>user_id</name><value><int>5</int></value></member>'
            '</struct></value>'
        )
        result = adapter._decode_value(el)
        assert result == {"displayName": "Alice", "user_id": 5}

    def test_decode_value_array(self):
        """_decode_value 解析 array → list。"""
        adapter = WordPressAdapter()
        el = ET.fromstring(
            '<value><array><data>'
            '<value><int>1</int></value>'
            '<value><int>2</int></value>'
            '</data></array></value>'
        )
        assert adapter._decode_value(el) == [1, 2]

    async def test_verify_credentials_success_dict(self):
        """verify_credentials 成功:_xmlrpc 返回 dict → connected as <name>。"""
        xml = (
            b'<?xml version="1.0"?><methodResponse>'
            b'<params><param><value><struct>'
            b'<member><name>displayName</name><value><string>Admin</string></value></member>'
            b'<member><name>user_id</name><value><int>1</int></value></member>'
            b'</struct></value></param></params></methodResponse>'
        )
        mock_resp = MagicMock()
        mock_resp.content = xml
        mock_resp.raise_for_status = MagicMock()
        with patch("app.services.publish.adapters.wordpress.httpx.post", return_value=mock_resp):
            adapter = WordPressAdapter()
            ok, msg = await adapter.verify_credentials({
                "site_url": "https://blog.example.com",
                "username": "admin",
                "application_password": "xxxx xxxx",
            })
        assert ok is True
        assert "Admin" in msg
        assert "user_id=1" in msg

    async def test_verify_credentials_missing_fields(self):
        """verify_credentials 缺字段 → False。"""
        adapter = WordPressAdapter()
        ok, msg = await adapter.verify_credentials({
            "site_url": "", "username": "admin", "application_password": "xxxx",
        })
        assert ok is False
        assert "missing required fields" in msg

    async def test_publish_success(self):
        """publish 成功:_xmlrpc wp.newPost 返回 post_id → published_url。"""
        xml = (
            b'<?xml version="1.0"?><methodResponse>'
            b'<params><param><value><int>99</int></value></param></params>'
            b'</methodResponse>'
        )
        mock_resp = MagicMock()
        mock_resp.content = xml
        mock_resp.raise_for_status = MagicMock()
        with patch("app.services.publish.adapters.wordpress.httpx.post", return_value=mock_resp):
            adapter = WordPressAdapter()
            content = PublishContent(format="html", title="WP 文章", html="<p>内容</p>")
            result = await adapter.publish(
                content,
                {"site_url": "https://blog.example.com", "username": "admin", "application_password": "xxxx"},
                {"post_status": "publish"},
            )
        assert result.success is True
        assert result.platform_content_id == "99"
        assert "blog.example.com/?p=99" in result.published_url

    async def test_publish_no_credentials(self):
        """publish 缺凭证 → success=False。"""
        adapter = WordPressAdapter()
        content = PublishContent(format="md", title="标题", text="正文")
        result = await adapter.publish(
            content,
            {"site_url": "", "username": "", "application_password": ""},
            {},
        )
        assert result.success is False
        assert "invalid credentials" in result.error_message


# =============================================================================
# 5. XiaohongshuAdapter(12 tests)
# =============================================================================


class TestXiaohongshuAdapter:
    """小红书适配器:基于 Playwright 浏览器自动化。"""

    def test_class_attributes(self):
        """类属性:needs_browser=True。"""
        assert XiaohongshuAdapter.platform_id == "xiaohongshu"
        assert XiaohongshuAdapter.platform_name == "小红书"
        assert XiaohongshuAdapter.supported_formats == ["md", "html", "image", "video"]
        assert XiaohongshuAdapter.requires_credentials == ["web_session"]
        assert XiaohongshuAdapter.needs_browser is True

    def test_instantiation(self):
        """可实例化。"""
        adapter = XiaohongshuAdapter()
        assert isinstance(adapter, BasePlatformAdapter)

    def test_cookies(self):
        """_cookies:凭证 dict → cookies list,验证 name/value/domain/path/httpOnly。"""
        adapter = XiaohongshuAdapter()
        cookies = adapter._cookies({"web_session": "sess123"})
        assert len(cookies) == 1
        c = cookies[0]
        assert c["name"] == "web_session"
        assert c["value"] == "sess123"
        assert c["domain"] == ".xiaohongshu.com"
        assert c["path"] == "/"
        assert c["httpOnly"] is True
        assert c["secure"] is True
        assert c["sameSite"] == "Lax"

    async def test_verify_credentials_no_playwright(self, monkeypatch):
        """verify_credentials 无 Playwright → False。"""
        monkeypatch.setattr("app.services.publish.adapters.xiaohongshu._HAS_PLAYWRIGHT", False)
        adapter = XiaohongshuAdapter()
        ok, msg = await adapter.verify_credentials({"web_session": "sess"})
        assert ok is False
        assert "Playwright not installed" in msg

    async def test_verify_credentials_missing_web_session(self, monkeypatch):
        """verify_credentials 缺 web_session → False。"""
        monkeypatch.setattr("app.services.publish.adapters.xiaohongshu._HAS_PLAYWRIGHT", True)
        adapter = XiaohongshuAdapter()
        ok, msg = await adapter.verify_credentials({"web_session": ""})
        assert ok is False
        assert "missing web_session" in msg

    async def test_verify_credentials_success(self, monkeypatch):
        """verify_credentials 成功:mock Playwright → page.url 不含 login。"""
        monkeypatch.setattr("app.services.publish.adapters.xiaohongshu._HAS_PLAYWRIGHT", True)
        mock_pw, _, _ = _make_playwright_chain(
            page_url="https://creator.xiaohongshu.com/creator/home",
        )
        monkeypatch.setattr("app.services.publish.adapters.xiaohongshu.async_playwright", mock_pw, raising=False)
        adapter = XiaohongshuAdapter()
        ok, msg = await adapter.verify_credentials({"web_session": "sess"})
        assert ok is True
        assert "connected" in msg

    async def test_verify_credentials_login_redirect(self, monkeypatch):
        """verify_credentials cookie 过期:page.url 含 login → False。"""
        monkeypatch.setattr("app.services.publish.adapters.xiaohongshu._HAS_PLAYWRIGHT", True)
        mock_pw, _, _ = _make_playwright_chain(
            page_url="https://creator.xiaohongshu.com/login",
        )
        monkeypatch.setattr("app.services.publish.adapters.xiaohongshu.async_playwright", mock_pw, raising=False)
        adapter = XiaohongshuAdapter()
        ok, msg = await adapter.verify_credentials({"web_session": "expired"})
        assert ok is False
        assert "cookie expired" in msg

    async def test_publish_no_playwright(self, monkeypatch):
        """publish 无 Playwright → success=False。"""
        monkeypatch.setattr("app.services.publish.adapters.xiaohongshu._HAS_PLAYWRIGHT", False)
        adapter = XiaohongshuAdapter()
        content = PublishContent(format="image", title="标题", text="内容")
        result = await adapter.publish(content, {"web_session": "sess"}, {})
        assert result.success is False
        assert "Playwright not installed" in result.error_message

    async def test_publish_missing_web_session(self, monkeypatch):
        """publish 缺 web_session → success=False。"""
        monkeypatch.setattr("app.services.publish.adapters.xiaohongshu._HAS_PLAYWRIGHT", True)
        adapter = XiaohongshuAdapter()
        content = PublishContent(format="image", title="标题", text="内容")
        result = await adapter.publish(content, {"web_session": ""}, {})
        assert result.success is False
        assert "missing web_session" in result.error_message

    async def test_publish_no_images_no_video(self, monkeypatch):
        """publish 无图片无视频无封面 → success=False。

        BUG: 源码第 95-99 行外层 if 含 ``and not content.cover_path`` 条件,
        导致内层 ``if content.cover_path`` 为死代码(永不执行)。cover_path 设但无 images
        时不进入此块,而是走后续 valid_images 检查失败路径。本测试仅覆盖全空场景。
        """
        monkeypatch.setattr("app.services.publish.adapters.xiaohongshu._HAS_PLAYWRIGHT", True)
        adapter = XiaohongshuAdapter()
        content = PublishContent(format="md", title="标题", text="内容")
        result = await adapter.publish(content, {"web_session": "sess"}, {})
        assert result.success is False
        assert "at least 1 image or video" in result.error_message

    async def test_publish_success(self, monkeypatch, tmp_path):
        """publish 成功:mock Playwright 全链路 + 真实临时图片文件。"""
        monkeypatch.setattr("app.services.publish.adapters.xiaohongshu._HAS_PLAYWRIGHT", True)
        img = tmp_path / "test.jpg"
        img.write_bytes(b"fake image")
        mock_pw, _, _ = _make_playwright_chain(
            page_url="https://creator.xiaohongshu.com/publish/publish",
            locator_count=1,
            locator_tag="TEXTAREA",
        )
        monkeypatch.setattr("app.services.publish.adapters.xiaohongshu.async_playwright", mock_pw, raising=False)
        adapter = XiaohongshuAdapter()
        content = PublishContent(
            format="image", title="小红书笔记", text="内容",
            images=[str(img)],
        )
        result = await adapter.publish(content, {"web_session": "sess"}, {})
        assert result.success is True
        assert result.platform == "xiaohongshu"
        assert result.payload["images_count"] == 1
        assert result.payload["is_video"] is False

    async def test_publish_no_valid_images(self, monkeypatch):
        """publish 图片路径无效(文件不存在)→ success=False。"""
        monkeypatch.setattr("app.services.publish.adapters.xiaohongshu._HAS_PLAYWRIGHT", True)
        mock_pw, _, _ = _make_playwright_chain(
            page_url="https://creator.xiaohongshu.com/publish/publish",
        )
        monkeypatch.setattr("app.services.publish.adapters.xiaohongshu.async_playwright", mock_pw, raising=False)
        adapter = XiaohongshuAdapter()
        content = PublishContent(
            format="image", title="笔记", text="内容",
            images=["/nonexistent/path.jpg"],
        )
        result = await adapter.publish(content, {"web_session": "sess"}, {})
        assert result.success is False
        assert "no valid image files" in result.error_message


# =============================================================================
# 6. YouTubeAdapter(11 tests)
# =============================================================================


class TestYouTubeAdapter:
    """YouTube 适配器:基于 YouTube Data API v3(httpx + _call_with_refresh)。"""

    def test_class_attributes(self):
        """类属性:仅支持 video 格式。"""
        assert YouTubeAdapter.platform_id == "youtube"
        assert YouTubeAdapter.platform_name == "YouTube"
        assert YouTubeAdapter.supported_formats == ["video"]
        assert YouTubeAdapter.requires_credentials == [
            "access_token", "refresh_token", "client_id", "client_secret",
        ]
        assert YouTubeAdapter.needs_browser is False

    def test_instantiation(self):
        """可实例化。"""
        adapter = YouTubeAdapter()
        assert isinstance(adapter, BasePlatformAdapter)

    async def test_refresh_access_token_success(self):
        """_refresh_access_token 成功:返回新 token + 更新后的 credentials。"""
        refresh_resp = _make_resp(200, json_data={"access_token": "new_tok"})
        client = _mock_async_client(post_return=refresh_resp)
        with patch("app.services.publish.adapters.youtube.httpx.AsyncClient", return_value=client):
            adapter = YouTubeAdapter()
            ok, msg, creds = await adapter._refresh_access_token({
                "refresh_token": "r", "client_id": "c", "client_secret": "s",
                "access_token": "old",
            })
        assert ok is True
        assert msg == "new_tok"
        assert creds["access_token"] == "new_tok"

    async def test_refresh_access_token_missing_fields(self):
        """_refresh_access_token 缺 refresh_token/client_id/client_secret → False。"""
        adapter = YouTubeAdapter()
        ok, msg, creds = await adapter._refresh_access_token({
            "refresh_token": "", "client_id": "", "client_secret": "",
        })
        assert ok is False
        assert "missing" in msg

    async def test_refresh_access_token_http_error(self):
        """_refresh_access_token HTTP 异常 → False。"""
        client = _mock_async_client(post_side=httpx.ConnectError("refused"))
        with patch("app.services.publish.adapters.youtube.httpx.AsyncClient", return_value=client):
            adapter = YouTubeAdapter()
            ok, msg, creds = await adapter._refresh_access_token({
                "refresh_token": "r", "client_id": "c", "client_secret": "s",
            })
        assert ok is False
        assert "http error" in msg

    async def test_verify_credentials_success_with_channel(self):
        """verify_credentials 成功:channels.list 返回频道信息。"""
        mock_resp = _make_resp(200, json_data={
            "items": [{"id": "UC123", "snippet": {"title": "My Channel"}}],
        })
        adapter = YouTubeAdapter()
        adapter._call_with_refresh = AsyncMock(return_value=(mock_resp, {"access_token": "tok"}))
        ok, msg = await adapter.verify_credentials({"access_token": "tok"})
        assert ok is True
        assert "My Channel" in msg
        assert "UC123" in msg

    async def test_verify_credentials_success_no_channel(self):
        """verify_credentials 成功但无频道:items 为空 → connected (no channel yet)。"""
        mock_resp = _make_resp(200, json_data={"items": []})
        adapter = YouTubeAdapter()
        adapter._call_with_refresh = AsyncMock(return_value=(mock_resp, {"access_token": "tok"}))
        ok, msg = await adapter.verify_credentials({"access_token": "tok"})
        assert ok is True
        assert "no channel" in msg

    async def test_verify_credentials_missing_access_token(self):
        """verify_credentials 缺 access_token → False。"""
        adapter = YouTubeAdapter()
        ok, msg = await adapter.verify_credentials({"access_token": ""})
        assert ok is False
        assert "missing access_token" in msg

    async def test_publish_non_video_format(self):
        """publish 非 video 格式 → success=False。"""
        adapter = YouTubeAdapter()
        content = PublishContent(format="md", title="标题", text="正文")
        result = await adapter.publish(
            content,
            {"access_token": "tok", "refresh_token": "r", "client_id": "c", "client_secret": "s"},
            {},
        )
        assert result.success is False
        assert "only supports video format" in result.error_message

    async def test_publish_missing_file_path(self):
        """publish video 格式但无 file_path → success=False。"""
        adapter = YouTubeAdapter()
        content = PublishContent(format="video", title="视频标题")
        result = await adapter.publish(
            content,
            {"access_token": "tok", "refresh_token": "r", "client_id": "c", "client_secret": "s"},
            {},
        )
        assert result.success is False
        assert "missing file_path" in result.error_message

    async def test_publish_success(self, tmp_path):
        """publish 成功:mock _call_with_refresh 返回 upload URL + mock httpx PUT 返回 video_id。"""
        video_file = tmp_path / "test.mp4"
        video_file.write_bytes(b"fake video content")
        start_upload_resp = _make_resp(
            200, headers={"Location": "https://upload.googleapis.com/upload/abc"},
        )
        upload_resp = _make_resp(200, json_data={"id": "vid123"})
        adapter = YouTubeAdapter()
        adapter._call_with_refresh = AsyncMock(
            return_value=(start_upload_resp, {"access_token": "tok"}),
        )
        mock_client = _mock_async_client(put_return=upload_resp)
        with patch("app.services.publish.adapters.youtube.httpx.AsyncClient", return_value=mock_client):
            content = PublishContent(format="video", title="测试视频", file_path=str(video_file))
            result = await adapter.publish(
                content,
                {"access_token": "tok", "refresh_token": "r", "client_id": "c", "client_secret": "s"},
                {"privacy_status": "public"},
            )
        assert result.success is True
        assert result.platform_content_id == "vid123"
        assert "watch?v=vid123" in result.published_url
        assert result.payload["privacy_status"] == "public"


# =============================================================================
# 7. ZhihuAdapter(12 tests)
# =============================================================================


class TestZhihuAdapter:
    """知乎适配器:基于 Playwright 浏览器自动化。"""

    def test_class_attributes(self):
        """类属性:needs_browser=True。"""
        assert ZhihuAdapter.platform_id == "zhihu"
        assert ZhihuAdapter.platform_name == "知乎"
        assert ZhihuAdapter.supported_formats == ["md", "html"]
        assert ZhihuAdapter.requires_credentials == ["z_c0"]
        assert ZhihuAdapter.needs_browser is True

    def test_instantiation(self):
        """可实例化。"""
        adapter = ZhihuAdapter()
        assert isinstance(adapter, BasePlatformAdapter)

    def test_cookies(self):
        """_cookies:凭证 dict → cookies list,验证 name/value/domain/path/httpOnly。"""
        adapter = ZhihuAdapter()
        cookies = adapter._cookies({"z_c0": "cookie456"})
        assert len(cookies) == 1
        c = cookies[0]
        assert c["name"] == "z_c0"
        assert c["value"] == "cookie456"
        assert c["domain"] == ".zhihu.com"
        assert c["path"] == "/"
        assert c["httpOnly"] is True
        assert c["secure"] is True
        assert c["sameSite"] == "Lax"

    async def test_verify_credentials_no_playwright(self, monkeypatch):
        """verify_credentials 无 Playwright → False。"""
        monkeypatch.setattr("app.services.publish.adapters.zhihu._HAS_PLAYWRIGHT", False)
        adapter = ZhihuAdapter()
        ok, msg = await adapter.verify_credentials({"z_c0": "cookie"})
        assert ok is False
        assert "Playwright not installed" in msg

    async def test_verify_credentials_missing_z_c0(self, monkeypatch):
        """verify_credentials 缺 z_c0 → False。"""
        monkeypatch.setattr("app.services.publish.adapters.zhihu._HAS_PLAYWRIGHT", True)
        adapter = ZhihuAdapter()
        ok, msg = await adapter.verify_credentials({"z_c0": ""})
        assert ok is False
        assert "missing z_c0" in msg

    async def test_verify_credentials_success(self, monkeypatch):
        """verify_credentials 成功:页面内容不含"登录"或含"写文章"。"""
        monkeypatch.setattr("app.services.publish.adapters.zhihu._HAS_PLAYWRIGHT", True)
        mock_pw, _, _ = _make_playwright_chain(
            page_content="<html>欢迎,写文章</html>",
        )
        monkeypatch.setattr("app.services.publish.adapters.zhihu.async_playwright", mock_pw, raising=False)
        adapter = ZhihuAdapter()
        ok, msg = await adapter.verify_credentials({"z_c0": "cookie"})
        assert ok is True
        assert "connected" in msg

    async def test_verify_credentials_login_visible(self, monkeypatch):
        """verify_credentials cookie 过期:页面含"登录"且不含"写文章" → False。"""
        monkeypatch.setattr("app.services.publish.adapters.zhihu._HAS_PLAYWRIGHT", True)
        mock_pw, _, _ = _make_playwright_chain(
            page_content="<html>请登录</html>",
        )
        monkeypatch.setattr("app.services.publish.adapters.zhihu.async_playwright", mock_pw, raising=False)
        adapter = ZhihuAdapter()
        ok, msg = await adapter.verify_credentials({"z_c0": "expired"})
        assert ok is False
        assert "cookie expired or invalid" in msg

    async def test_publish_no_playwright(self, monkeypatch):
        """publish 无 Playwright → success=False。"""
        monkeypatch.setattr("app.services.publish.adapters.zhihu._HAS_PLAYWRIGHT", False)
        adapter = ZhihuAdapter()
        content = PublishContent(format="md", title="标题", text="正文")
        result = await adapter.publish(content, {"z_c0": "cookie"}, {})
        assert result.success is False
        assert "Playwright not installed" in result.error_message

    async def test_publish_missing_z_c0(self, monkeypatch):
        """publish 缺 z_c0 → success=False。"""
        monkeypatch.setattr("app.services.publish.adapters.zhihu._HAS_PLAYWRIGHT", True)
        adapter = ZhihuAdapter()
        content = PublishContent(format="md", title="标题", text="正文")
        result = await adapter.publish(content, {"z_c0": ""}, {})
        assert result.success is False
        assert "missing z_c0" in result.error_message

    async def test_publish_publish_button_not_found(self, monkeypatch):
        """publish 按钮未找到:publish_btn.count() == 0 → success=False。"""
        monkeypatch.setattr("app.services.publish.adapters.zhihu._HAS_PLAYWRIGHT", True)
        mock_pw, _, _ = _make_playwright_chain(
            page_url="https://zhuanlan.zhihu.com/write",
            locator_count=0,
        )
        monkeypatch.setattr("app.services.publish.adapters.zhihu.async_playwright", mock_pw, raising=False)
        adapter = ZhihuAdapter()
        content = PublishContent(format="md", title="知乎文章", text="正文内容")
        result = await adapter.publish(content, {"z_c0": "cookie"}, {})
        assert result.success is False
        assert "publish button not found" in result.error_message

    async def test_publish_success(self, monkeypatch):
        """publish 成功:mock Playwright 全链路,wait_for_url 成功 → published_url。"""
        monkeypatch.setattr("app.services.publish.adapters.zhihu._HAS_PLAYWRIGHT", True)
        mock_pw, _, _ = _make_playwright_chain(
            page_url="https://zhuanlan.zhihu.com/p/123456",
            locator_count=1,
        )
        monkeypatch.setattr("app.services.publish.adapters.zhihu.async_playwright", mock_pw, raising=False)
        adapter = ZhihuAdapter()
        content = PublishContent(format="md", title="知乎文章", text="正文内容")
        result = await adapter.publish(content, {"z_c0": "cookie"}, {})
        assert result.success is True
        assert "zhuanlan.zhihu.com/p/123456" in result.published_url
        assert result.platform_content_id == "123456"

    async def test_publish_timeout(self, monkeypatch):
        """publish 超时:wait_for_url 抛异常 → success=False。"""
        monkeypatch.setattr("app.services.publish.adapters.zhihu._HAS_PLAYWRIGHT", True)
        mock_pw, _, _ = _make_playwright_chain(
            page_url="https://zhuanlan.zhihu.com/write",
            locator_count=1,
            wait_for_url_raises=True,
        )
        monkeypatch.setattr("app.services.publish.adapters.zhihu.async_playwright", mock_pw, raising=False)
        adapter = ZhihuAdapter()
        content = PublishContent(format="md", title="知乎文章", text="正文")
        result = await adapter.publish(content, {"z_c0": "cookie"}, {})
        assert result.success is False
        assert "publish timeout" in result.error_message
