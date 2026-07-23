"""publish 核心模块测试(2026-07-23 立,补齐 4 模块零覆盖)。

覆盖维度(85+ cases):
1. base_adapter - PublishResult dataclass:构造/默认值/duration_ms/payload(6 tests)
2. base_adapter - PublishResult default_factory 独立性(1 test)
3. base_adapter - PublishContent dataclass:构造/默认值/字段(4 tests)
4. base_adapter - PublishContent default_factory 独立性(2 tests)
5. base_adapter - BasePlatformAdapter ABC:不可实例化/抽象方法集/缺方法(5 tests)
6. base_adapter - 子类实现 + 类属性默认值(3 tests)
7. base_adapter - get_adapter 边界 + list_all_adapter_classes(4 tests)
8. content_parser - parse_md:标题/空串/特殊字符/tables/fenced_code(5 tests)
9. content_parser - parse_html:清洗/移除危险标签/移除 on* 属性(5 tests)
10. content_parser - parse_docx:mammoth 路径/异常/双库缺失(3 tests)
11. content_parser - parse_pdf:文本提取/空页跳过/全部空/库缺失(4 tests)
12. content_parser - parse_to_html:6 格式 + 缺参 + 大小写 + 未知格式(8 tests)
13. content_parser - _safe_read:正常/缺失/过大(3 tests)
14. content_parser - enrich_content:已填充/解析/失败/图片追加(4 tests)
15. credentials_crypto - _load_key:env 合法/无效/长度错/缺失(4 tests)
16. credentials_crypto - _get_key:缓存单例/不重读 env(2 tests)
17. credentials_crypto - encrypt/decrypt 往返/随机 IV/空 dict/嵌套(4 tests)
18. credentials_crypto - decrypt 异常:空串/坏 base64/短 blob/错密钥/篡改(5 tests)
19. credentials_crypto - generate_key_b64(2 tests)
20. notifications - _get_db_conn:无 DSN/连接失败/成功(3 tests)
21. notifications - _ensure_table:3 条 SQL(1 test)
22. notifications - _write_to_db:成功/None/异常/关闭连接(4 tests)
23. notifications - _push_sio:成功/异常(2 tests)
24. notifications - notify_publish_complete:双通道/降级/字段/房间(6 tests)
25. notifications - notify_progress:成功/失败/字段/广播(4 tests)
"""
from __future__ import annotations

import base64
import json
import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.core.config import settings
from app.services.publish.base_adapter import (
    BasePlatformAdapter,
    PublishContent,
    PublishResult,
    get_adapter,
    list_all_adapter_classes,
)
from app.services.publish.content_parser import (
    _safe_read,
    enrich_content,
    parse_docx,
    parse_html,
    parse_md,
    parse_pdf,
    parse_to_html,
)
from app.services.publish.credentials_crypto import (
    _get_key,
    _load_key,
    decrypt,
    encrypt,
    generate_key_b64,
)
from app.services.publish.notifications import (
    _ensure_table,
    _get_db_conn,
    _push_sio,
    _write_to_db,
    notify_progress,
    notify_publish_complete,
)


# =============================================================================
# autouse fixture: 重置 credentials_crypto 模块级 _KEY 缓存
# =============================================================================


@pytest.fixture(autouse=True)
def _reset_crypto_key(monkeypatch):
    """每个测试前重置 credentials_crypto._KEY,确保密钥隔离。"""
    import app.services.publish.credentials_crypto as crypto_mod

    monkeypatch.setattr(crypto_mod, "_KEY", None)
    monkeypatch.delenv("PUBLISH_CREDENTIALS_KEY", raising=False)
    yield


# =============================================================================
# 工厂函数
# =============================================================================


def make_result(
    success: bool = True,
    platform: str = "test",
    url: str | None = None,
    content_id: str | None = None,
    error: str | None = None,
    duration: int = 0,
    payload: dict | None = None,
) -> PublishResult:
    return PublishResult(
        success=success,
        platform=platform,
        published_url=url,
        platform_content_id=content_id,
        error_message=error,
        duration_ms=duration,
        payload=payload if payload is not None else {},
    )


def make_content(
    fmt: str = "md",
    title: str = "测试标题",
    text: str | None = None,
    file_path: str | None = None,
    html: str | None = None,
    images: list[str] | None = None,
) -> PublishContent:
    return PublishContent(
        format=fmt,
        title=title,
        text=text,
        file_path=file_path,
        html=html,
        images=images if images is not None else [],
    )


# =============================================================================
# 1. PublishResult dataclass 构造与默认值(6 tests)
# =============================================================================


class TestPublishResult:
    """PublishResult dataclass 字段构造与默认值。"""

    def test_full_construction(self):
        """所有字段显式构造。"""
        r = PublishResult(
            success=True,
            platform="wordpress",
            published_url="https://example.com/post/1",
            platform_content_id="post-123",
            error_message=None,
            duration_ms=500,
            payload={"extra": "data"},
        )
        assert r.success is True
        assert r.platform == "wordpress"
        assert r.published_url == "https://example.com/post/1"
        assert r.platform_content_id == "post-123"
        assert r.error_message is None
        assert r.duration_ms == 500
        assert r.payload == {"extra": "data"}

    def test_minimal_success(self):
        """success=True 时只需 success + platform。"""
        r = PublishResult(success=True, platform="medium")
        assert r.success is True
        assert r.platform == "medium"
        assert r.published_url is None
        assert r.platform_content_id is None
        assert r.error_message is None
        assert r.duration_ms == 0
        assert r.payload == {}

    def test_success_with_url_only(self):
        """success=True 时 published_url 非空,platform_content_id 为 None。"""
        r = make_result(success=True, url="https://blog.example.com/123")
        assert r.published_url == "https://blog.example.com/123"
        assert r.platform_content_id is None

    def test_success_with_content_id_only(self):
        """success=True 时 platform_content_id 非空,published_url 为 None。"""
        r = make_result(success=True, content_id="abc-456")
        assert r.platform_content_id == "abc-456"
        assert r.published_url is None

    def test_failure_with_error_message(self):
        """success=False 时 error_message 必填(实际为约定,dataclass 不强制)。"""
        r = make_result(success=False, error="发布失败:网络超时")
        assert r.success is False
        assert r.error_message == "发布失败:网络超时"

    def test_duration_ms_custom_value(self):
        """duration_ms 可设置任意整数值。"""
        r = make_result(duration=12345)
        assert r.duration_ms == 12345
        r2 = make_result(duration=0)
        assert r2.duration_ms == 0


# =============================================================================
# 2. PublishResult default_factory 独立性(1 test)
# =============================================================================


class TestPublishResultFactory:
    def test_payload_default_factory_independence(self):
        """两个 PublishResult 实例的 payload 是独立 dict(不共享引用)。"""
        r1 = PublishResult(success=True, platform="a")
        r2 = PublishResult(success=True, platform="b")
        r1.payload["key"] = "value"
        assert r1.payload == {"key": "value"}
        assert r2.payload == {}


# =============================================================================
# 3. PublishContent dataclass 构造与默认值(4 tests)
# =============================================================================


class TestPublishContent:
    """PublishContent dataclass 字段构造与默认值。"""

    def test_full_construction(self):
        """所有字段显式构造。"""
        c = PublishContent(
            format="md",
            title="文章标题",
            text="# 正文",
            file_path="/path/to/file.docx",
            cover_path="/path/to/cover.jpg",
            html="<p>已解析</p>",
            images=["img1.jpg", "img2.png"],
            extra={"author": "tester"},
        )
        assert c.format == "md"
        assert c.title == "文章标题"
        assert c.text == "# 正文"
        assert c.file_path == "/path/to/file.docx"
        assert c.cover_path == "/path/to/cover.jpg"
        assert c.html == "<p>已解析</p>"
        assert c.images == ["img1.jpg", "img2.png"]
        assert c.extra == {"author": "tester"}

    def test_minimal_construction(self):
        """只需 format + title。"""
        c = PublishContent(format="html", title="最小")
        assert c.format == "html"
        assert c.title == "最小"
        assert c.text is None
        assert c.file_path is None
        assert c.cover_path is None
        assert c.html is None
        assert c.images == []
        assert c.extra == {}

    def test_cover_path_default_none(self):
        """cover_path 默认 None(可选字段)。"""
        c = make_content()
        assert c.cover_path is None

    def test_extra_field_default_empty_dict(self):
        """extra 默认空 dict。"""
        c = make_content()
        assert c.extra == {}


# =============================================================================
# 4. PublishContent default_factory 独立性(2 tests)
# =============================================================================


class TestPublishContentFactory:
    def test_images_default_factory_independence(self):
        """两个 PublishContent 实例的 images 是独立 list。"""
        c1 = PublishContent(format="md", title="a")
        c2 = PublishContent(format="md", title="b")
        c1.images.append("img.jpg")
        assert c1.images == ["img.jpg"]
        assert c2.images == []

    def test_extra_default_factory_independence(self):
        """两个 PublishContent 实例的 extra 是独立 dict。"""
        c1 = PublishContent(format="md", title="a")
        c2 = PublishContent(format="md", title="b")
        c1.extra["k"] = "v"
        assert c1.extra == {"k": "v"}
        assert c2.extra == {}


# =============================================================================
# 5. BasePlatformAdapter ABC(5 tests)
# =============================================================================


class TestBaseAdapterABC:
    """BasePlatformAdapter 抽象基类行为。"""

    def test_cannot_instantiate_directly(self):
        """BasePlatformAdapter 是 ABC,直接实例化抛 TypeError。"""
        with pytest.raises(TypeError, match="abstract"):
            BasePlatformAdapter()

    def test_abstractmethods_contains_both_methods(self):
        """__abstractmethods__ 包含 verify_credentials 和 publish。"""
        assert "verify_credentials" in BasePlatformAdapter.__abstractmethods__
        assert "publish" in BasePlatformAdapter.__abstractmethods__

    def test_subclass_missing_verify_credentials(self):
        """子类只实现 publish,缺少 verify_credentials → 不可实例化。"""

        class PartialAdapter(BasePlatformAdapter):
            async def publish(self, content, credentials, platform_config):
                return PublishResult(success=True, platform="test")

        with pytest.raises(TypeError):
            PartialAdapter()

    def test_subclass_missing_publish(self):
        """子类只实现 verify_credentials,缺少 publish → 不可实例化。"""

        class PartialAdapter(BasePlatformAdapter):
            async def verify_credentials(self, credentials):
                return True, "ok"

        with pytest.raises(TypeError):
            PartialAdapter()

    def test_complete_subclass_instantiable(self):
        """子类实现两个抽象方法 → 可实例化。"""

        class CompleteAdapter(BasePlatformAdapter):
            platform_id = "test_complete"
            platform_name = "测试平台"

            async def verify_credentials(self, credentials):
                return True, "verified"

            async def publish(self, content, credentials, platform_config):
                return PublishResult(success=True, platform="test_complete")

        adapter = CompleteAdapter()
        assert isinstance(adapter, BasePlatformAdapter)
        assert adapter.platform_id == "test_complete"


# =============================================================================
# 6. 子类实现 + 类属性默认值(3 tests)
# =============================================================================


class TestAdapterClassAttrs:
    """适配器类属性默认值与自定义。"""

    def test_base_class_attribute_defaults(self):
        """BasePlatformAdapter 类属性默认值正确。"""
        assert BasePlatformAdapter.platform_id == ""
        assert BasePlatformAdapter.platform_name == ""
        assert BasePlatformAdapter.supported_formats == []
        assert BasePlatformAdapter.requires_credentials == []
        assert BasePlatformAdapter.needs_browser is False

    def test_subclass_can_override_class_attrs(self):
        """子类可覆盖类属性。"""

        class CustomAdapter(BasePlatformAdapter):
            platform_id = "custom"
            platform_name = "自定义平台"
            supported_formats = ["md", "html"]
            requires_credentials = ["token"]
            needs_browser = True

            async def verify_credentials(self, credentials):
                return True, "ok"

            async def publish(self, content, credentials, platform_config):
                return PublishResult(success=True, platform="custom")

        assert CustomAdapter.platform_id == "custom"
        assert CustomAdapter.platform_name == "自定义平台"
        assert CustomAdapter.supported_formats == ["md", "html"]
        assert CustomAdapter.requires_credentials == ["token"]
        assert CustomAdapter.needs_browser is True

    def test_subclass_verify_credentials_signature(self):
        """子类 verify_credentials 返回 tuple[bool, str]。"""

        class TestAdapter(BasePlatformAdapter):
            async def verify_credentials(self, credentials):
                return (True, "验证通过")

            async def publish(self, content, credentials, platform_config):
                return PublishResult(success=True, platform="test")

        adapter = TestAdapter()
        # 验证方法存在且是协程函数
        import inspect

        assert inspect.iscoroutinefunction(adapter.verify_credentials)
        assert inspect.iscoroutinefunction(adapter.publish)


# =============================================================================
# 7. get_adapter + list_all_adapter_classes(4 tests)
# =============================================================================


class TestGetAdapter:
    """get_adapter 工厂函数边界。"""

    def test_get_adapter_unknown_platform_returns_none(self):
        """未知 platform_id → None。"""
        assert get_adapter("nonexistent-xyz-123") is None

    @patch("app.services.publish.base_adapter.list_all_adapter_classes")
    def test_get_adapter_returns_instance_for_matching_id(self, mock_list):
        """匹配 platform_id → 返回适配器实例。"""

        class TestAdapter(BasePlatformAdapter):
            platform_id = "test_match"

            async def verify_credentials(self, credentials):
                return True, "ok"

            async def publish(self, content, credentials, platform_config):
                return PublishResult(success=True, platform="test_match")

        mock_list.return_value = [TestAdapter]
        result = get_adapter("test_match")
        assert result is not None
        assert isinstance(result, TestAdapter)
        assert result.platform_id == "test_match"

    @patch("app.services.publish.base_adapter.list_all_adapter_classes")
    def test_get_adapter_constructor_failure_returns_none(self, mock_list):
        """适配器构造函数抛异常 → get_adapter 返回 None(异常被捕获)。"""

        class FailingAdapter(BasePlatformAdapter):
            platform_id = "failing"

            def __init__(self):
                raise RuntimeError("init error")

            async def verify_credentials(self, credentials):
                return True, "ok"

            async def publish(self, content, credentials, platform_config):
                return PublishResult(success=True, platform="failing")

        mock_list.return_value = [FailingAdapter]
        result = get_adapter("failing")
        assert result is None

    def test_list_all_adapter_classes_returns_subclasses(self):
        """list_all_adapter_classes 返回的每个类都是 BasePlatformAdapter 子类。"""
        classes = list_all_adapter_classes()
        assert len(classes) > 0
        for cls in classes:
            assert issubclass(cls, BasePlatformAdapter)


# =============================================================================
# 8. parse_md(5 tests)
# =============================================================================


class TestParseMd:
    """markdown → html 转换。"""

    def test_heading_conversion(self):
        """# 标题 → <h1>(toc 扩展可能添加 id 属性)。"""
        result = parse_md("# 标题")
        assert "<h1" in result
        assert "标题" in result

    def test_empty_string(self):
        """空串 → 空字符串。"""
        result = parse_md("")
        assert isinstance(result, str)
        assert result.strip() == ""

    def test_ampersand_escaped(self):
        """特殊字符 & → &amp;。"""
        result = parse_md("A & B")
        assert "&amp;" in result

    def test_table_extension(self):
        """tables 扩展生效:markdown 表格 → <table>。"""
        text = "| 列1 | 列2 |\n|-----|-----|\n| A | B |"
        result = parse_md(text)
        assert "<table>" in result
        assert "<th" in result or "<td" in result

    def test_fenced_code_extension(self):
        """fenced_code 扩展生效:``` 代码块 → <pre><code>。"""
        text = "```python\nprint('hello')\n```"
        result = parse_md(text)
        assert "<pre>" in result
        assert "<code" in result


# =============================================================================
# 9. parse_html(5 tests)
# =============================================================================


class TestParseHtml:
    """html 清洗(移除危险标签和事件属性)。"""

    def test_normal_html_preserved(self):
        """正常 HTML 标签保留。"""
        result = parse_html("<p>hello <strong>world</strong></p>")
        assert "<p>" in result
        assert "<strong>" in result
        assert "hello" in result
        assert "world" in result

    def test_removes_script_tag(self):
        """script 标签及内容被移除。"""
        result = parse_html('<p>safe</p><script>alert("xss")</script>')
        assert "<script" not in result.lower()
        assert "alert" not in result
        assert "safe" in result

    def test_removes_style_tag(self):
        """style 标签及内容被移除。"""
        result = parse_html("<style>body { color: red; }</style><p>text</p>")
        assert "<style" not in result.lower()
        assert "color: red" not in result
        assert "text" in result

    def test_removes_dangerous_tags(self):
        """iframe/object/embed/form 标签被移除。"""
        html = (
            '<iframe src="evil.com"></iframe>'
            "<object data='evil.swf'></object>"
            "<embed src='evil.swf'>"
            "<form><input name='x'></form>"
            "<p>safe</p>"
        )
        result = parse_html(html)
        assert "<iframe" not in result.lower()
        assert "<object" not in result.lower()
        assert "<embed" not in result.lower()
        assert "<form" not in result.lower()
        assert "safe" in result

    def test_removes_on_attributes(self):
        """on* 事件属性被移除(onclick/onload 等)。"""
        result = parse_html('<p onclick="alert(1)" onload="doX()">text</p>')
        assert "onclick" not in result.lower()
        assert "onload" not in result.lower()
        assert "text" in result


# =============================================================================
# 10. parse_docx(3 tests)
# =============================================================================


class TestParseDocx:
    """docx → html 转换(mammoth 优先,python-docx 降级)。"""

    @patch("mammoth.convert_to_html")
    def test_mammoth_path_returns_html(self, mock_convert, tmp_path):
        """mammoth 已安装时,走 mammoth 路径返回 .value。"""
        tmp_file = tmp_path / "test.docx"
        tmp_file.write_bytes(b"fake docx content")
        mock_result = MagicMock()
        mock_result.value = "<p>mammoth html</p>"
        mock_convert.return_value = mock_result

        result = parse_docx(str(tmp_file))
        assert result == "<p>mammoth html</p>"
        mock_convert.assert_called_once()

    @patch("mammoth.convert_to_html")
    def test_mammoth_exception_propagates(self, mock_convert, tmp_path):
        """mammoth 抛非 ImportError 异常 → 直接传播(不被 except ImportError 捕获)。"""
        tmp_file = tmp_path / "test.docx"
        tmp_file.write_bytes(b"fake")
        mock_convert.side_effect = RuntimeError("mammoth parse error")

        with pytest.raises(RuntimeError, match="mammoth parse error"):
            parse_docx(str(tmp_file))

    def test_both_libraries_missing_raises_runtimeerror(self, monkeypatch, tmp_path):
        """mammoth 和 python-docx 均不可用 → RuntimeError。"""
        tmp_file = tmp_path / "test.docx"
        tmp_file.write_bytes(b"fake")
        monkeypatch.setitem(sys.modules, "mammoth", None)
        monkeypatch.setitem(sys.modules, "docx", None)

        with pytest.raises(RuntimeError, match="neither mammoth nor python-docx"):
            parse_docx(str(tmp_file))


# =============================================================================
# 11. parse_pdf(4 tests)
# =============================================================================


class TestParsePdf:
    """pdf → text → html 转换。"""

    @patch("pdfplumber.open")
    def test_extracts_text_from_pages(self, mock_open):
        """正常提取文本:每页 <h2> + 每行 <p>。"""
        mock_pdf = MagicMock()
        mock_page = MagicMock()
        mock_page.extract_text.return_value = "第一行\n第二行"
        mock_pdf.pages = [mock_page]
        mock_open.return_value.__enter__.return_value = mock_pdf

        result = parse_pdf("fake.pdf")
        assert "<h2>第 1 页</h2>" in result
        assert "<p>第一行</p>" in result
        assert "<p>第二行</p>" in result

    @patch("pdfplumber.open")
    def test_empty_pages_skipped(self, mock_open):
        """空页(extract_text 返回空或 None)被跳过。"""
        mock_pdf = MagicMock()
        mock_page1 = MagicMock()
        mock_page1.extract_text.return_value = ""
        mock_page2 = MagicMock()
        mock_page2.extract_text.return_value = None
        mock_pdf.pages = [mock_page1, mock_page2]
        mock_open.return_value.__enter__.return_value = mock_pdf

        result = parse_pdf("fake.pdf")
        assert result == "<p>(PDF 无可提取文本)</p>"

    @patch("pdfplumber.open")
    def test_mixed_empty_and_content_pages(self, mock_open):
        """混合:空页跳过,有内容的页正常提取。"""
        mock_pdf = MagicMock()
        mock_page1 = MagicMock()
        mock_page1.extract_text.return_value = ""  # 空 → 跳过
        mock_page2 = MagicMock()
        mock_page2.extract_text.return_value = "有内容"
        mock_pdf.pages = [mock_page1, mock_page2]
        mock_open.return_value.__enter__.return_value = mock_pdf

        result = parse_pdf("fake.pdf")
        assert "第 1 页" not in result  # page 1 skipped
        assert "<h2>第 2 页</h2>" in result
        assert "<p>有内容</p>" in result

    def test_pdfplumber_not_installed_raises(self, monkeypatch):
        """pdfplumber 未安装 → RuntimeError。"""
        monkeypatch.setitem(sys.modules, "pdfplumber", None)
        with pytest.raises(RuntimeError, match="pdfplumber not installed"):
            parse_pdf("fake.pdf")


# =============================================================================
# 12. parse_to_html(8 tests)
# =============================================================================


class TestParseToHtml:
    """parse_to_html 格式分派与边界。"""

    def test_md_format(self):
        """md 格式:返回 (html, [])。"""
        html, images = parse_to_html("md", text="# 标题")
        assert "<h1" in html
        assert images == []

    def test_html_format(self):
        """html 格式:返回清洗后的 (html, [])。"""
        html, images = parse_to_html("html", text="<p>hello</p>")
        assert "<p>" in html
        assert "hello" in html
        assert images == []

    @patch("app.services.publish.content_parser.parse_docx")
    def test_docx_format_calls_parse_docx(self, mock_parse_docx):
        """docx 格式:调用 parse_docx。"""
        mock_parse_docx.return_value = "<p>docx content</p>"
        html, images = parse_to_html("docx", file_path="/fake/path.docx")
        assert html == "<p>docx content</p>"
        assert images == []
        mock_parse_docx.assert_called_once_with("/fake/path.docx")

    @patch("app.services.publish.content_parser.parse_pdf")
    def test_pdf_format_calls_parse_pdf(self, mock_parse_pdf):
        """pdf 格式:调用 parse_pdf。"""
        mock_parse_pdf.return_value = "<p>pdf content</p>"
        html, images = parse_to_html("pdf", file_path="/fake/path.pdf")
        assert html == "<p>pdf content</p>"
        assert images == []
        mock_parse_pdf.assert_called_once_with("/fake/path.pdf")

    def test_image_format_returns_empty(self):
        """image 格式:返回 ("", [])。"""
        html, images = parse_to_html("image", file_path="/fake/img.jpg")
        assert html == ""
        assert images == []

    def test_video_format_returns_empty(self):
        """video 格式:返回 ("", [])。"""
        html, images = parse_to_html("video", file_path="/fake/video.mp4")
        assert html == ""
        assert images == []

    def test_missing_text_or_file_path_raises(self):
        """md 缺 text / html 缺 text / docx 缺 file_path / pdf 缺 file_path → ValueError。"""
        with pytest.raises(ValueError, match="md format requires text"):
            parse_to_html("md")
        with pytest.raises(ValueError, match="html format requires text"):
            parse_to_html("html")
        with pytest.raises(ValueError, match="docx format requires file_path"):
            parse_to_html("docx")
        with pytest.raises(ValueError, match="pdf format requires file_path"):
            parse_to_html("pdf")

    def test_unsupported_format_raises(self):
        """未知格式 → ValueError。"""
        with pytest.raises(ValueError, match="unsupported format"):
            parse_to_html("txt", text="hello")
        with pytest.raises(ValueError, match="unsupported format"):
            parse_to_html("XML", text="<x/>")


# =============================================================================
# 13. _safe_read(3 tests)
# =============================================================================


class TestSafeRead:
    """_safe_read 文件安全读取。"""

    def test_normal_read(self, tmp_path):
        """正常读取文件内容。"""
        tmp_file = tmp_path / "test.txt"
        tmp_file.write_bytes(b"hello world")
        data = _safe_read(str(tmp_file))
        assert data == b"hello world"

    def test_missing_file_raises(self):
        """文件不存在 → FileNotFoundError。"""
        with pytest.raises(FileNotFoundError, match="file not found"):
            _safe_read("/nonexistent/path/file.txt")

    @patch("app.services.publish.content_parser.Path")
    def test_too_large_raises(self, mock_path_cls):
        """文件超过 50MB → ValueError。"""
        mock_p = MagicMock()
        mock_p.is_file.return_value = True
        mock_p.stat.return_value.st_size = 100 * 1024 * 1024  # 100MB > 50MB
        mock_path_cls.return_value = mock_p
        with pytest.raises(ValueError, match="file too large"):
            _safe_read("fake_large.bin")


# =============================================================================
# 14. enrich_content(4 tests)
# =============================================================================


class TestEnrichContent:
    """enrich_content 填充 html 字段。"""

    def test_already_has_html_returns_unchanged(self):
        """content.html 已有值 → 不重新解析。"""
        content = make_content(html="<p>existing</p>")
        result = enrich_content(content)
        assert result.html == "<p>existing</p>"

    def test_md_fills_html(self):
        """md 格式无 html → 解析后填充 html。"""
        content = make_content(fmt="md", text="# 标题")
        result = enrich_content(content)
        assert result.html is not None
        assert "<h1" in result.html

    def test_parse_failure_leaves_empty_html(self):
        """解析失败(md 缺 text) → html 设为空串(不阻塞)。"""
        content = make_content(fmt="md", text=None)
        result = enrich_content(content)
        assert result.html == ""

    @patch("app.services.publish.content_parser.parse_to_html")
    def test_appends_images_from_parse(self, mock_parse):
        """parse_to_html 返回 images 时,追加到 content.images。"""
        mock_parse.return_value = ("<p>html</p>", ["new_img.jpg"])
        content = make_content(fmt="md", text="# x", images=["existing.jpg"])
        result = enrich_content(content)
        assert result.html == "<p>html</p>"
        assert "existing.jpg" in result.images
        assert "new_img.jpg" in result.images


# =============================================================================
# 15. _load_key(4 tests)
# =============================================================================


class TestLoadKey:
    """_load_key 密钥加载逻辑。"""

    def test_valid_env_key(self, monkeypatch):
        """环境变量设为合法 base64(32 字节)→ 返回该密钥。"""
        valid_key = generate_key_b64()
        monkeypatch.setenv("PUBLISH_CREDENTIALS_KEY", valid_key)
        key = _load_key()
        assert key == base64.b64decode(valid_key, validate=True)
        assert len(key) == 32

    def test_invalid_env_falls_back_to_ephemeral(self, monkeypatch):
        """环境变量非法 base64 → 降级到临时密钥。"""
        monkeypatch.setenv("PUBLISH_CREDENTIALS_KEY", "!!!invalid-base64!!!")
        key = _load_key()
        assert isinstance(key, bytes)
        assert len(key) == 32  # 仍是 32 字节临时密钥

    def test_wrong_length_falls_back_to_ephemeral(self, monkeypatch):
        """环境变量解码后非 32 字节 → 降级到临时密钥。"""
        short_key = base64.b64encode(b"0" * 16).decode("ascii")
        monkeypatch.setenv("PUBLISH_CREDENTIALS_KEY", short_key)
        key = _load_key()
        assert isinstance(key, bytes)
        assert len(key) == 32

    def test_missing_env_falls_back_to_ephemeral(self, monkeypatch):
        """环境变量未设置 → 降级到临时密钥。"""
        monkeypatch.delenv("PUBLISH_CREDENTIALS_KEY", raising=False)
        key = _load_key()
        assert isinstance(key, bytes)
        assert len(key) == 32


# =============================================================================
# 16. _get_key(2 tests)
# =============================================================================


class TestGetKey:
    """_get_key 密钥缓存单例。"""

    def test_caches_singleton(self):
        """_get_key 第二次调用返回同一密钥对象(缓存)。"""
        key1 = _get_key()
        key2 = _get_key()
        assert key1 is key2

    def test_does_not_reread_env_after_cached(self, monkeypatch):
        """_get_key 缓存后,修改环境变量不影响已缓存的密钥。"""
        key1 = _get_key()
        # 改变环境变量
        new_key = generate_key_b64()
        monkeypatch.setenv("PUBLISH_CREDENTIALS_KEY", new_key)
        key2 = _get_key()
        assert key1 is key2  # 仍返回缓存


# =============================================================================
# 17. encrypt/decrypt 往返(4 tests)
# =============================================================================


class TestEncryptDecrypt:
    """encrypt → decrypt 往返一致性。"""

    def test_roundtrip_basic(self):
        """基础 dict 加解密往返。"""
        credentials = {"token": "abc123", "user_id": 42}
        cipher = encrypt(credentials)
        assert isinstance(cipher, str)
        assert "abc123" not in cipher
        assert decrypt(cipher) == credentials

    def test_roundtrip_unicode(self):
        """包含中文/特殊字符的 dict 加解密往返。"""
        credentials = {
            "name": "测试账号",
            "cookie": "session=中文; path=/",
            "nested": {"key": "值"},
        }
        cipher = encrypt(credentials)
        assert decrypt(cipher) == credentials

    def test_encrypt_produces_different_ciphers(self):
        """同一明文多次加密得到不同密文(IV 随机)。"""
        credentials = {"token": "same"}
        c1 = encrypt(credentials)
        c2 = encrypt(credentials)
        assert c1 != c2

    def test_encrypt_empty_and_nested_dict(self):
        """空 dict 和嵌套 dict 均可加解密。"""
        empty_cipher = encrypt({})
        assert decrypt(empty_cipher) == {}

        nested = {"a": {"b": {"c": [1, 2, 3]}}}
        nested_cipher = encrypt(nested)
        assert decrypt(nested_cipher) == nested


# =============================================================================
# 18. decrypt 异常(5 tests)
# =============================================================================


class TestDecryptErrors:
    """decrypt 边界异常处理。"""

    def test_empty_string_raises(self):
        """空串 → ValueError。"""
        with pytest.raises(ValueError, match="empty cipher"):
            decrypt("")

    def test_invalid_base64_raises(self):
        """非 base64 字符串 → ValueError。"""
        with pytest.raises(ValueError, match="invalid base64 cipher"):
            decrypt("!!!not-base64!!!")

    def test_short_blob_raises(self):
        """解 base64 后长度不足(IV + tag)→ ValueError。"""
        short_blob = base64.b64encode(b"short").decode("ascii")
        with pytest.raises(ValueError, match="cipher blob too short"):
            decrypt(short_blob)

    def test_wrong_key_raises(self, monkeypatch):
        """用不同密钥解密 → GCM tag 校验失败,抛异常。"""
        import app.services.publish.credentials_crypto as crypto_mod

        # 用 key A 加密
        key_a = generate_key_b64()
        monkeypatch.setenv("PUBLISH_CREDENTIALS_KEY", key_a)
        monkeypatch.setattr(crypto_mod, "_KEY", None)
        cipher = encrypt({"secret": "data"})

        # 切换到 key B
        key_b = generate_key_b64()
        monkeypatch.setenv("PUBLISH_CREDENTIALS_KEY", key_b)
        monkeypatch.setattr(crypto_mod, "_KEY", None)

        with pytest.raises(Exception):  # InvalidTag
            decrypt(cipher)

    def test_tampered_cipher_raises(self):
        """篡改密文 → GCM tag 校验失败,抛异常。"""
        cipher = encrypt({"token": "secret"})
        # 翻转最后一个字符(篡改 tag)
        tampered = cipher[:-1] + ("A" if cipher[-1] != "A" else "B")
        with pytest.raises(Exception):
            decrypt(tampered)


# =============================================================================
# 19. generate_key_b64(2 tests)
# =============================================================================


class TestGenerateKey:
    """generate_key_b64 密钥生成。"""

    def test_returns_valid_32_byte_key(self):
        """返回的 base64 字符串解码后为 32 字节。"""
        key_b64 = generate_key_b64()
        assert isinstance(key_b64, str)
        decoded = base64.b64decode(key_b64, validate=True)
        assert len(decoded) == 32

    def test_produces_different_keys(self):
        """每次调用返回不同密钥(随机生成)。"""
        k1 = generate_key_b64()
        k2 = generate_key_b64()
        assert k1 != k2


# =============================================================================
# 20. _get_db_conn(3 tests)
# =============================================================================


class TestGetDbConn:
    """_get_db_conn 数据库连接获取与降级。"""

    async def test_no_dsn_returns_none(self, monkeypatch):
        """settings.database_url 为空 → 返回 None。"""
        monkeypatch.setattr(settings, "database_url", "")
        conn = await _get_db_conn()
        assert conn is None

    async def test_connect_failure_returns_none(self, monkeypatch):
        """asyncpg.connect 抛异常 → 返回 None(降级)。"""
        monkeypatch.setattr(settings, "database_url", "postgres://fake")
        mock_connect = AsyncMock(side_effect=RuntimeError("connection refused"))
        monkeypatch.setattr("asyncpg.connect", mock_connect)
        conn = await _get_db_conn()
        assert conn is None

    async def test_success_returns_conn(self, monkeypatch):
        """连接成功 → 返回 conn 对象。"""
        monkeypatch.setattr(settings, "database_url", "postgres://fake")
        mock_conn = MagicMock()
        mock_connect = AsyncMock(return_value=mock_conn)
        monkeypatch.setattr("asyncpg.connect", mock_connect)
        conn = await _get_db_conn()
        assert conn is mock_conn


# =============================================================================
# 21. _ensure_table(1 test)
# =============================================================================


class TestEnsureTable:
    """_ensure_table 建表幂等。"""

    async def test_executes_3_sql_commands(self):
        """执行 3 条 SQL(CREATE TABLE + 2 CREATE INDEX)。"""
        conn = AsyncMock()
        await _ensure_table(conn)
        assert conn.execute.call_count == 3
        # 验证 SQL 内容包含关键关键字
        calls = [c.args[0] for c in conn.execute.call_args_list]
        assert any("CREATE TABLE" in sql for sql in calls)
        assert any("CREATE INDEX" in sql for sql in calls)


# =============================================================================
# 22. _write_to_db(4 tests)
# =============================================================================


class TestWriteToDb:
    """_write_to_db 通知表写入与降级。"""

    @patch("app.services.publish.notifications._get_db_conn", new_callable=AsyncMock)
    async def test_conn_none_returns_false(self, mock_get_conn):
        """_get_db_conn 返回 None → 返回 False。"""
        mock_get_conn.return_value = None
        result = await _write_to_db("task1", None, "success", "ok", {})
        assert result is False

    @patch("app.services.publish.notifications._ensure_table", new_callable=AsyncMock)
    @patch("app.services.publish.notifications._get_db_conn", new_callable=AsyncMock)
    async def test_success_returns_true(self, mock_get_conn, mock_ensure):
        """写入成功 → 返回 True,调用 _ensure_table + conn.execute。"""
        mock_conn = AsyncMock()
        mock_get_conn.return_value = mock_conn
        result = await _write_to_db("task1", "user1", "success", "ok", {"k": "v"})
        assert result is True
        mock_ensure.assert_awaited_once_with(mock_conn)
        assert mock_conn.execute.call_count == 1
        mock_conn.close.assert_awaited_once()

    @patch("app.services.publish.notifications._ensure_table", new_callable=AsyncMock)
    @patch("app.services.publish.notifications._get_db_conn", new_callable=AsyncMock)
    async def test_exception_returns_false(self, mock_get_conn, mock_ensure):
        """_ensure_table 抛异常 → 返回 False,但连接仍在 finally 中关闭。"""
        mock_conn = AsyncMock()
        mock_get_conn.return_value = mock_conn
        mock_ensure.side_effect = RuntimeError("table creation failed")
        result = await _write_to_db("task1", None, "success", "ok", {})
        assert result is False
        mock_conn.close.assert_awaited_once()

    @patch("app.services.publish.notifications._ensure_table", new_callable=AsyncMock)
    @patch("app.services.publish.notifications._get_db_conn", new_callable=AsyncMock)
    async def test_insert_args_passed_correctly(self, mock_get_conn, mock_ensure):
        """INSERT SQL 参数正确传递(task_id/user_id/status/summary/payload)。"""
        mock_conn = AsyncMock()
        mock_get_conn.return_value = mock_conn
        await _write_to_db("t1", "u1", "success", "摘要", {"k": "v"})
        call_args = mock_conn.execute.call_args
        sql = call_args.args[0]
        assert "INSERT INTO publish_notifications" in sql
        assert call_args.args[1] == "t1"
        assert call_args.args[2] == "u1"
        assert call_args.args[3] == "success"
        assert call_args.args[4] == "摘要"
        assert json.loads(call_args.args[5]) == {"k": "v"}


# =============================================================================
# 23. _push_sio(2 tests)
# =============================================================================


class TestPushSio:
    """_push_sio Socket.IO 推送与降级。"""

    @patch("app.sio.sio")
    async def test_success_returns_true(self, mock_sio):
        """sio.emit 成功 → 返回 True。"""
        mock_sio.emit = AsyncMock(return_value=None)
        result = await _push_sio("user:u1", "publish_complete", {"k": "v"})
        assert result is True
        mock_sio.emit.assert_awaited_once_with(
            "publish_complete", {"k": "v"}, room="user:u1"
        )

    @patch("app.sio.sio")
    async def test_emit_failure_returns_false(self, mock_sio):
        """sio.emit 抛异常 → 返回 False(降级,不阻塞)。"""
        mock_sio.emit = AsyncMock(side_effect=RuntimeError("connection lost"))
        result = await _push_sio("user:u1", "publish_complete", {"k": "v"})
        assert result is False


# =============================================================================
# 24. notify_publish_complete(6 tests)
# =============================================================================


class TestNotifyPublishComplete:
    """notify_publish_complete 完成通知入口。"""

    @patch("app.services.publish.notifications._write_to_db", new_callable=AsyncMock)
    @patch("app.services.publish.notifications._push_sio", new_callable=AsyncMock)
    async def test_both_channels_succeed(self, mock_push, mock_write):
        """双通道成功 → {"sio": True, "db": True}。"""
        mock_push.return_value = True
        mock_write.return_value = True
        result = await notify_publish_complete("t1", "u1", "success", "done")
        assert result == {"sio": True, "db": True}
        mock_push.assert_awaited_once()
        mock_write.assert_awaited_once()

    @patch("app.services.publish.notifications._write_to_db", new_callable=AsyncMock)
    @patch("app.services.publish.notifications._push_sio", new_callable=AsyncMock)
    async def test_sio_fails_db_succeeds(self, mock_push, mock_write):
        """sio 失败 db 成功 → {"sio": False, "db": True}。"""
        mock_push.return_value = False
        mock_write.return_value = True
        result = await notify_publish_complete("t1", "u1", "failed", "err")
        assert result == {"sio": False, "db": True}

    @patch("app.services.publish.notifications._write_to_db", new_callable=AsyncMock)
    @patch("app.services.publish.notifications._push_sio", new_callable=AsyncMock)
    async def test_db_fails_sio_succeeds(self, mock_push, mock_write):
        """db 失败 sio 成功 → {"sio": True, "db": False}。"""
        mock_push.return_value = True
        mock_write.return_value = False
        result = await notify_publish_complete("t1", "u1", "success", "ok")
        assert result == {"sio": True, "db": False}

    @patch("app.services.publish.notifications._write_to_db", new_callable=AsyncMock)
    @patch("app.services.publish.notifications._push_sio", new_callable=AsyncMock)
    async def test_both_channels_fail(self, mock_push, mock_write):
        """双通道失败 → {"sio": False, "db": False}。"""
        mock_push.return_value = False
        mock_write.return_value = False
        result = await notify_publish_complete("t1", "u1", "failed", "err")
        assert result == {"sio": False, "db": False}

    @patch("app.services.publish.notifications._write_to_db", new_callable=AsyncMock)
    @patch("app.services.publish.notifications._push_sio", new_callable=AsyncMock)
    async def test_payload_none_defaults_to_empty_and_room_logic(self, mock_push, mock_write):
        """payload=None → 默认 {};user_id 设定 → room='user:xxx'。"""
        mock_push.return_value = True
        mock_write.return_value = True
        await notify_publish_complete("t1", "u1", "success", "ok", None)
        data = mock_push.call_args.args[2]
        assert data["payload"] == {}
        assert mock_push.call_args.args[0] == "user:u1"

    @patch("app.services.publish.notifications._write_to_db", new_callable=AsyncMock)
    @patch("app.services.publish.notifications._push_sio", new_callable=AsyncMock)
    async def test_broadcast_room_and_data_structure(self, mock_push, mock_write):
        """user_id=None → room='publish:broadcast';data 含必填字段。"""
        mock_push.return_value = True
        mock_write.return_value = True
        await notify_publish_complete("t1", None, "success", "摘要", {"k": "v"})
        assert mock_push.call_args.args[0] == "publish:broadcast"
        data = mock_push.call_args.args[2]
        assert data["type"] == "publish_complete"
        assert data["task_id"] == "t1"
        assert data["user_id"] is None
        assert data["status"] == "success"
        assert data["summary"] == "摘要"
        assert data["payload"] == {"k": "v"}
        assert "timestamp" in data


# =============================================================================
# 25. notify_progress(4 tests)
# =============================================================================


class TestNotifyProgress:
    """notify_progress 单平台进度通知。"""

    @patch("app.services.publish.notifications._push_sio", new_callable=AsyncMock)
    async def test_success_returns_true(self, mock_push):
        """推送成功 → 返回 True。"""
        mock_push.return_value = True
        result = await notify_progress("t1", "u1", "wordpress", "start", "开始发布")
        assert result is True
        mock_push.assert_awaited_once()

    @patch("app.services.publish.notifications._push_sio", new_callable=AsyncMock)
    async def test_push_failure_returns_false(self, mock_push):
        """推送失败 → 返回 False。"""
        mock_push.return_value = False
        result = await notify_progress("t1", "u1", "medium", "failed", "超时")
        assert result is False

    @patch("app.services.publish.notifications._push_sio", new_callable=AsyncMock)
    async def test_data_structure_and_room(self, mock_push):
        """data 结构正确 + user_id 设定 → room='user:xxx'。"""
        mock_push.return_value = True
        await notify_progress("t1", "u1", "wordpress", "success", "发布完成")
        assert mock_push.call_args.args[0] == "user:u1"
        assert mock_push.call_args.args[1] == "publish_progress"
        data = mock_push.call_args.args[2]
        assert data["type"] == "publish_progress"
        assert data["task_id"] == "t1"
        assert data["platform"] == "wordpress"
        assert data["status"] == "success"
        assert data["message"] == "发布完成"
        assert "timestamp" in data

    @patch("app.services.publish.notifications._push_sio", new_callable=AsyncMock)
    async def test_broadcast_room_and_default_message(self, mock_push):
        """user_id=None → broadcast room;message 默认空串。"""
        mock_push.return_value = True
        await notify_progress("t1", None, "bilibili", "start")
        assert mock_push.call_args.args[0] == "publish:broadcast"
        data = mock_push.call_args.args[2]
        assert data["message"] == ""