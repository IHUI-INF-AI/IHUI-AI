"""image_uploader 模块测试(12 平台图床上传 + dispatch + 降级)。

覆盖维度(24 cases):
1. _PLATFORM_IMAGE_ENDPOINTS dict 完整性校验(1 test)
2. upload_to_platform dispatch 入口(5 tests):dispatch 成功 / 未知平台 / 文件不存在 /
   网络异常降级 / 凭证缺失降级
3. 12 个平台上传函数(15 tests):每个平台 mock HTTP/Playwright 验证调用路径和返回值
   - csdn / juejin / jianshu / zhihu / wechat / weibo / wordpress / bilibili / medium(HTTP/XML-RPC)
   - toutiao(NotImplementedError → "")
   - xiaohongshu / baijiahao(Playwright mock + 不可用降级)
4. 边界场景(3 tests):图片文件不存在 / 网络异常降级 / Playwright 不可用降级
"""
from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.publish.image_uploader import (
    _PLATFORM_IMAGE_ENDPOINTS,
    _PLATFORM_UPLOADERS,
    cleanup_temp_images,
    extract_external_images,
    download_image,
    replace_image_src,
    upload_to_baijiahao,
    upload_to_bilibili,
    upload_to_csdn,
    upload_to_jianshu,
    upload_to_juejin,
    upload_to_medium,
    upload_to_platform,
    upload_to_toutiao,
    upload_to_wechat,
    upload_to_weibo,
    upload_to_wordpress,
    upload_to_xiaohongshu,
    upload_to_zhihu,
)


# =============================================================================
# 工厂 / 辅助函数
# =============================================================================


def _make_httpx_resp(
    status_code: int = 200,
    json_data: dict | None = None,
    text: str = "",
) -> MagicMock:
    """创建 mock httpx 响应。"""
    resp = MagicMock()
    resp.status_code = status_code
    resp.json.return_value = json_data if json_data is not None else {}
    resp.text = text
    resp.headers = {"content-type": "image/png"}
    resp.content = text.encode("utf-8") if text else b""
    return resp


def _mock_async_client(
    *,
    post_return: MagicMock | None = None,
    post_side: object | None = None,
    get_return: MagicMock | None = None,
    get_side: object | None = None,
) -> AsyncMock:
    """创建 mock httpx.AsyncClient 上下文管理器。

    post_side / get_side 支持异常实例或列表(多响应顺序返回)。
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
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=None)
    return client


def _make_image(tmp_path: Path, name: str = "test.png") -> Path:
    """创建临时图片文件。"""
    img = tmp_path / name
    img.write_bytes(b"\x89PNG\r\n\x1a\nfake-png-content")
    return img


def _make_playwright_mocks(
    page_url: str = "https://creator.xiaohongshu.com/publish/publish",
    locator_count: int = 1,
    evaluate_return: str = "https://sns-img.example.com/test.jpg",
) -> tuple[AsyncMock, AsyncMock, AsyncMock]:
    """创建 Playwright mock 链。

    返回 (mock_page, mock_context, mock_browser)。
    """
    mock_locator = MagicMock()
    mock_locator.first = mock_locator
    mock_locator.count = AsyncMock(return_value=locator_count)
    mock_locator.set_input_files = AsyncMock()

    mock_page = AsyncMock()
    mock_page.url = page_url
    mock_page.goto = AsyncMock()
    mock_page.wait_for_timeout = AsyncMock()
    mock_page.evaluate = AsyncMock(return_value=evaluate_return)
    mock_page.locator = MagicMock(return_value=mock_locator)

    mock_context = AsyncMock()
    mock_context.new_page = AsyncMock(return_value=mock_page)
    mock_context.add_cookies = AsyncMock()

    mock_browser = AsyncMock()
    return mock_page, mock_context, mock_browser


# =============================================================================
# 1. _PLATFORM_IMAGE_ENDPOINTS dict 完整性(1 test)
# =============================================================================


class TestPlatformEndpoints:
    """_PLATFORM_IMAGE_ENDPOINTS dict 完整性校验。"""

    def test_has_12_platforms_with_required_fields(self):
        """dict 包含 12 个平台,每个平台有 url/method/auth/response_url_field 4 个字段。"""
        expected_platforms = {
            "csdn", "juejin", "jianshu", "zhihu",
            "wechat", "weibo", "wordpress", "bilibili",
            "toutiao", "xiaohongshu", "baijiahao", "medium",
        }
        assert set(_PLATFORM_IMAGE_ENDPOINTS.keys()) == expected_platforms
        assert len(_PLATFORM_IMAGE_ENDPOINTS) == 12
        for pid, cfg in _PLATFORM_IMAGE_ENDPOINTS.items():
            assert "url" in cfg, f"{pid} 缺 url 字段"
            assert "method" in cfg, f"{pid} 缺 method 字段"
            assert "auth" in cfg, f"{pid} 缺 auth 字段"
            assert "response_url_field" in cfg, f"{pid} 缺 response_url_field 字段"

        # 同时验证 dispatch 表与 endpoints dict 的 key 一致
        assert set(_PLATFORM_UPLOADERS.keys()) == expected_platforms


# =============================================================================
# 2. upload_to_platform dispatch 入口(5 tests)
# =============================================================================


class TestUploadToPlatformDispatch:
    """upload_to_platform 统一入口 dispatch 逻辑。"""

    async def test_dispatch_to_csdn(self, tmp_path):
        """csdn 平台 dispatch 到 upload_to_csdn,返回值透传。"""
        mock_func = AsyncMock(return_value="https://img-blog.csdnimg.cn/test.png")
        img = _make_image(tmp_path)
        with patch.dict(
            "app.services.publish.image_uploader._PLATFORM_UPLOADERS",
            {"csdn": mock_func},
        ):
            result = await upload_to_platform("csdn", img, {"cookie": "abc"})
        assert result == "https://img-blog.csdnimg.cn/test.png"
        mock_func.assert_awaited_once()

    async def test_unknown_platform_returns_empty(self, tmp_path):
        """未知平台返回空字符串(不抛异常)。"""
        img = _make_image(tmp_path)
        result = await upload_to_platform("unknown_platform_xyz", img, {})
        assert result == ""

    async def test_image_not_found_returns_empty(self, tmp_path):
        """图片文件不存在返回空字符串。"""
        fake_path = tmp_path / "nonexistent.png"
        result = await upload_to_platform("csdn", fake_path, {"cookie": "abc"})
        assert result == ""

    async def test_network_exception_returns_empty(self, tmp_path):
        """上传函数抛网络异常 → dispatch 捕获返回空字符串。"""
        mock_func = AsyncMock(side_effect=httpx_connect_error())
        img = _make_image(tmp_path)
        with patch.dict(
            "app.services.publish.image_uploader._PLATFORM_UPLOADERS",
            {"csdn": mock_func},
        ):
            result = await upload_to_platform("csdn", img, {"cookie": "abc"})
        assert result == ""

    async def test_not_implemented_returns_empty(self, tmp_path):
        """上传函数 raise NotImplementedError → dispatch 捕获返回空字符串。"""
        mock_func = AsyncMock(side_effect=NotImplementedError("test not supported"))
        img = _make_image(tmp_path)
        with patch.dict(
            "app.services.publish.image_uploader._PLATFORM_UPLOADERS",
            {"csdn": mock_func},
        ):
            result = await upload_to_platform("csdn", img, {"cookie": "abc"})
        assert result == ""


def httpx_connect_error() -> Exception:
    """构造一个 httpx 连接异常(用于 mock side_effect)。"""
    import httpx
    return httpx.ConnectError("mock connection refused")


# =============================================================================
# 3. csdn 上传(2 tests)
# =============================================================================


class TestCsdnUploader:
    """CSDN 图床上传。"""

    @patch("app.services.publish.image_uploader.httpx.AsyncClient")
    async def test_upload_success(self, mock_client_cls, tmp_path):
        """CSDN 上传成功:返回 data.url。"""
        mock_resp = _make_httpx_resp(
            json_data={"data": {"url": "https://img-blog.csdnimg.cn/test.png"}}
        )
        mock_client_cls.return_value = _mock_async_client(post_return=mock_resp)
        img = _make_image(tmp_path)
        result = await upload_to_csdn(img, {"cookie": "UserName=test; UserToken=abc"})
        assert result == "https://img-blog.csdnimg.cn/test.png"

    async def test_missing_cookie_returns_empty(self, tmp_path):
        """CSDN 无 cookie → 返回空字符串。"""
        img = _make_image(tmp_path)
        result = await upload_to_csdn(img, {})
        assert result == ""


# =============================================================================
# 4. juejin 上传(1 test)
# =============================================================================


class TestJuejinUploader:
    """掘金图床上传。"""

    @patch("app.services.publish.image_uploader.httpx.AsyncClient")
    async def test_upload_success(self, mock_client_cls, tmp_path):
        """掘金上传成功:返回 data.url。"""
        mock_resp = _make_httpx_resp(
            json_data={"data": {"url": "https://p3-juejin.byteimg.com/test.png"}}
        )
        mock_client_cls.return_value = _mock_async_client(post_return=mock_resp)
        img = _make_image(tmp_path)
        result = await upload_to_juejin(img, {"cookie": "sessionid=abc123"})
        assert result == "https://p3-juejin.byteimg.com/test.png"


# =============================================================================
# 5. jianshu 上传(1 test)
# =============================================================================


class TestJianshuUploader:
    """简书图床上传。"""

    @patch("app.services.publish.image_uploader.httpx.AsyncClient")
    async def test_upload_success(self, mock_client_cls, tmp_path):
        """简书上传成功:返回 url。"""
        mock_resp = _make_httpx_resp(
            json_data={"url": "https://upload-images.jianshu.io/test.png"}
        )
        mock_client_cls.return_value = _mock_async_client(post_return=mock_resp)
        img = _make_image(tmp_path)
        result = await upload_to_jianshu(img, {"cookie": "_jianshu_session=abc"})
        assert result == "https://upload-images.jianshu.io/test.png"


# =============================================================================
# 6. zhihu 上传(1 test)
# =============================================================================


class TestZhihuUploader:
    """知乎图床上传。"""

    @patch("app.services.publish.image_uploader.httpx.AsyncClient")
    async def test_upload_success_with_relative_src(self, mock_client_cls, tmp_path):
        """知乎上传成功:src 为相对路径 → 自动补全为 https://pic1.zhimg.com/...。"""
        mock_resp = _make_httpx_resp(json_data={"src": "/v2-abc123.jpg"})
        mock_client_cls.return_value = _mock_async_client(post_return=mock_resp)
        img = _make_image(tmp_path)
        result = await upload_to_zhihu(img, {"z_c0": "token_abc"})
        assert result == "https://pic1.zhimg.com/v2-abc123.jpg"


# =============================================================================
# 7. wechat 上传(1 test)
# =============================================================================


class TestWechatUploader:
    """微信公众号图床上传。"""

    @patch("app.services.publish.image_uploader.httpx.AsyncClient")
    async def test_upload_success_with_access_token(self, mock_client_cls, tmp_path):
        """微信上传成功:直接用 access_token,返回 media_id。"""
        mock_resp = _make_httpx_resp(json_data={"media_id": "MEDIA_ID_12345"})
        mock_client_cls.return_value = _mock_async_client(post_return=mock_resp)
        img = _make_image(tmp_path)
        result = await upload_to_wechat(img, {"access_token": "token_abc"})
        assert result == "MEDIA_ID_12345"


# =============================================================================
# 8. weibo 上传(1 test)
# =============================================================================


class TestWeiboUploader:
    """微博图床上传。"""

    @patch("app.services.publish.image_uploader.httpx.AsyncClient")
    async def test_upload_success_returns_pic_url(self, mock_client_cls, tmp_path):
        """微博上传成功:返回 pic_url。"""
        mock_resp = _make_httpx_resp(
            json_data={"pic_url": "https://wx4.sinaimg.cn/test.jpg"}
        )
        mock_client_cls.return_value = _mock_async_client(post_return=mock_resp)
        img = _make_image(tmp_path)
        result = await upload_to_weibo(img, {"access_token": "token_abc", "uid": "123"})
        assert result == "https://wx4.sinaimg.cn/test.jpg"

    async def test_missing_token_returns_empty(self, tmp_path):
        """微博无 access_token → 返回空字符串。"""
        img = _make_image(tmp_path)
        result = await upload_to_weibo(img, {})
        assert result == ""


# =============================================================================
# 9. wordpress 上传(1 test)
# =============================================================================


class TestWordPressUploader:
    """WordPress XML-RPC 图床上传。"""

    @patch("app.services.publish.image_uploader.httpx.AsyncClient")
    async def test_upload_success_returns_url(self, mock_client_cls, tmp_path):
        """WordPress 上传成功:从 XML 响应提取图片 URL。"""
        xml_response = (
            '<?xml version="1.0"?>'
            '<methodResponse><params><param><value><struct>'
            '<member><name>id</name><value><string>123</string></value></member>'
            '<member><name>url</name><value><string>'
            'https://blog.example.com/wp-content/uploads/2026/test.jpg'
            '</string></value></member>'
            '</struct></value></param></params></methodResponse>'
        )
        mock_resp = _make_httpx_resp(text=xml_response)
        mock_client_cls.return_value = _mock_async_client(post_return=mock_resp)
        img = _make_image(tmp_path)
        creds = {
            "site_url": "https://blog.example.com",
            "username": "admin",
            "application_password": "xxxx xxxx xxxx xxxx",
        }
        result = await upload_to_wordpress(img, creds)
        assert result == "https://blog.example.com/wp-content/uploads/2026/test.jpg"

    async def test_missing_credentials_returns_empty(self, tmp_path):
        """WordPress 凭证不完整 → 返回空字符串。"""
        img = _make_image(tmp_path)
        result = await upload_to_wordpress(img, {"site_url": "https://blog.example.com"})
        assert result == ""


# =============================================================================
# 10. bilibili 上传(1 test)
# =============================================================================


class TestBilibiliUploader:
    """B站封面图床上传。"""

    @patch("app.services.publish.image_uploader.httpx.AsyncClient")
    async def test_upload_success_returns_cover_url(self, mock_client_cls, tmp_path):
        """B站上传成功:返回 data.url(cover_url)。"""
        mock_resp = _make_httpx_resp(
            json_data={
                "code": 0,
                "message": "ok",
                "data": {"url": "https://archive.biliimg.com/bfs/archive/test.jpg"},
            }
        )
        mock_client_cls.return_value = _mock_async_client(post_return=mock_resp)
        img = _make_image(tmp_path)
        creds = {"sessdata": "sess_abc", "bili_jct": "jct_xyz", "dedeuserid": "123"}
        result = await upload_to_bilibili(img, creds)
        assert result == "https://archive.biliimg.com/bfs/archive/test.jpg"

    async def test_missing_bili_jct_returns_empty(self, tmp_path):
        """B站无 bili_jct(csrf) → 返回空字符串。"""
        img = _make_image(tmp_path)
        result = await upload_to_bilibili(img, {"sessdata": "abc"})
        assert result == ""


# =============================================================================
# 11. toutiao 上传(1 test)
# =============================================================================


class TestToutiaoUploader:
    """头条号图床上传(NotImplementedError)。"""

    async def test_raises_not_implemented(self, tmp_path):
        """头条号无独立图片上传 API → raise NotImplementedError。"""
        img = _make_image(tmp_path)
        with pytest.raises(NotImplementedError, match="头条号开放平台未提供独立图片上传 API"):
            await upload_to_toutiao(img, {"access_token": "abc"})

    async def test_dispatch_catches_not_implemented(self, tmp_path):
        """通过 upload_to_platform 调用 toutiao → 降级返回空字符串。"""
        img = _make_image(tmp_path)
        result = await upload_to_platform("toutiao", img, {"access_token": "abc"})
        assert result == ""


# =============================================================================
# 12. xiaohongshu 上传(2 tests)
# =============================================================================


class TestXiaohongshuUploader:
    """小红书 Playwright 图床上传。"""

    @patch("app.services.publish.anti_risk.browser_factory.close_stealth_context", new_callable=AsyncMock)
    @patch("app.services.publish.anti_risk.create_stealth_browser_context", new_callable=AsyncMock)
    @patch("playwright.async_api.async_playwright")
    async def test_upload_success_via_playwright(
        self,
        mock_async_pw,
        mock_create,
        mock_close,
        tmp_path,
    ):
        """小红书上传成功:mock Playwright 链,从 DOM 抓取图片 URL。"""
        # mock async_playwright() 上下文管理器
        mock_pw_obj = AsyncMock()
        mock_async_pw.return_value.__aenter__ = AsyncMock(return_value=mock_pw_obj)
        mock_async_pw.return_value.__aexit__ = AsyncMock(return_value=None)

        # mock create_stealth_browser_context 返回 (browser, context)
        _, mock_context, mock_browser = _make_playwright_mocks(
            page_url="https://creator.xiaohongshu.com/publish/publish",
            evaluate_return="https://sns-img.xhscdn.com/test.jpg",
        )
        mock_create.return_value = (mock_browser, mock_context)

        img = _make_image(tmp_path)
        result = await upload_to_xiaohongshu(img, {"web_session": "session_abc"})
        assert result == "https://sns-img.xhscdn.com/test.jpg"
        mock_create.assert_awaited_once()
        mock_close.assert_awaited_once()

    async def test_missing_web_session_returns_empty(self, tmp_path):
        """小红书无 web_session → 返回空字符串(不触发 Playwright import)。"""
        img = _make_image(tmp_path)
        result = await upload_to_xiaohongshu(img, {})
        assert result == ""

    async def test_playwright_unavailable_returns_empty(self, monkeypatch, tmp_path):
        """Playwright 不可用 → 降级返回空字符串。"""
        # 让 playwright 模块导入失败
        monkeypatch.setitem(sys.modules, "playwright", None)
        monkeypatch.setitem(sys.modules, "playwright.async_api", None)
        img = _make_image(tmp_path)
        result = await upload_to_xiaohongshu(img, {"web_session": "abc"})
        assert result == ""


# =============================================================================
# 13. baijiahao 上传(1 test)
# =============================================================================


class TestBaijiahaoUploader:
    """百家号 Playwright 图床上传。"""

    @patch("app.services.publish.anti_risk.browser_factory.close_stealth_context", new_callable=AsyncMock)
    @patch("app.services.publish.anti_risk.create_stealth_browser_context", new_callable=AsyncMock)
    @patch("playwright.async_api.async_playwright")
    async def test_upload_success_via_playwright(
        self,
        mock_async_pw,
        mock_create,
        mock_close,
        tmp_path,
    ):
        """百家号上传成功:mock Playwright 链,从 DOM 抓取图片 URL。"""
        mock_pw_obj = AsyncMock()
        mock_async_pw.return_value.__aenter__ = AsyncMock(return_value=mock_pw_obj)
        mock_async_pw.return_value.__aexit__ = AsyncMock(return_value=None)

        _, mock_context, mock_browser = _make_playwright_mocks(
            page_url="https://baijiahao.baidu.com/builder/rc/edit?type=news",
            evaluate_return="https://pic.baidu.com/test.jpg",
        )
        mock_create.return_value = (mock_browser, mock_context)

        img = _make_image(tmp_path)
        result = await upload_to_baijiahao(img, {"BDUSS": "bduss_abc", "STOKEN": "stoken_xyz"})
        assert result == "https://pic.baidu.com/test.jpg"
        mock_create.assert_awaited_once()
        mock_close.assert_awaited_once()

    async def test_missing_bduss_returns_empty(self, tmp_path):
        """百家号无 BDUSS → 返回空字符串。"""
        img = _make_image(tmp_path)
        result = await upload_to_baijiahao(img, {})
        assert result == ""


# =============================================================================
# 14. medium 上传(1 test)
# =============================================================================


class TestMediumUploader:
    """Medium 图床上传。"""

    @patch("app.services.publish.image_uploader.httpx.AsyncClient")
    async def test_upload_success_returns_url(self, mock_client_cls, tmp_path):
        """Medium 上传成功:返回 data.url。"""
        mock_resp = _make_httpx_resp(
            status_code=201,
            json_data={"data": {"url": "https://cdn-images-1.medium.com/test.jpg"}},
        )
        mock_client_cls.return_value = _mock_async_client(post_return=mock_resp)
        img = _make_image(tmp_path)
        result = await upload_to_medium(img, {"access_token": "token_abc"})
        assert result == "https://cdn-images-1.medium.com/test.jpg"

    async def test_missing_token_returns_empty(self, tmp_path):
        """Medium 无 access_token → 返回空字符串。"""
        img = _make_image(tmp_path)
        result = await upload_to_medium(img, {})
        assert result == ""


# =============================================================================
# 15. 边界场景:网络异常降级 / HTTP 错误降级(3 tests)
# =============================================================================


class TestEdgeCases:
    """边界场景与降级。"""

    @patch("app.services.publish.image_uploader.httpx.AsyncClient")
    async def test_http_error_returns_empty(self, mock_client_cls, tmp_path):
        """HTTP 500 错误 → 返回空字符串(不抛异常)。"""
        mock_resp = _make_httpx_resp(status_code=500)
        mock_client_cls.return_value = _mock_async_client(post_return=mock_resp)
        img = _make_image(tmp_path)
        result = await upload_to_csdn(img, {"cookie": "abc"})
        assert result == ""

    @patch("app.services.publish.image_uploader.httpx.AsyncClient")
    async def test_network_exception_returns_empty(self, mock_client_cls, tmp_path):
        """httpx 网络异常 → 返回空字符串(降级,不抛异常)。"""
        mock_client_cls.return_value = _mock_async_client(
            post_side=httpx_connect_error()
        )
        img = _make_image(tmp_path)
        result = await upload_to_csdn(img, {"cookie": "abc"})
        assert result == ""

    @patch("app.services.publish.image_uploader.httpx.AsyncClient")
    async def test_bilibili_api_error_code_returns_empty(self, mock_client_cls, tmp_path):
        """B站 API 返回 code!=0 → 返回空字符串。"""
        mock_resp = _make_httpx_resp(
            json_data={"code": -101, "message": "csrf invalid", "data": None}
        )
        mock_client_cls.return_value = _mock_async_client(post_return=mock_resp)
        img = _make_image(tmp_path)
        creds = {"sessdata": "abc", "bili_jct": "jct"}
        result = await upload_to_bilibili(img, creds)
        assert result == ""

    async def test_image_file_not_found_all_platforms(self, tmp_path):
        """图片不存在时所有平台返回空字符串。"""
        fake_path = tmp_path / "nonexistent.png"
        for platform in _PLATFORM_UPLOADERS:
            result = await upload_to_platform(platform, fake_path, {})
            assert result == "", f"{platform} 应返回空字符串"
