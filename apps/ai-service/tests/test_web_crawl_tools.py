# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""
Firecrawl 网络抓取工具(fetch_readable / map_site / crawl_site / extract_web)单元测试。

对齐 test_document_asset_tools.py 风格:本地构造 HTML fixture + mock 网络,离线跑,
绝不发真实请求。网络层通过 monkeypatch 模块内 _http_get_html 模拟。
"""

import pytest
from unittest.mock import patch

# 直接导入模块(不导入 mcp_server, 避免太重)
import sys
import os

_PKG = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _PKG not in sys.path:
    sys.path.insert(0, _PKG)

from app.tools import web_crawl_tools as wc  # noqa: E402


@pytest.fixture(autouse=True)
def _no_js_render(monkeypatch):
    """单元测试默认不触发真实 headless chromium 渲染兜底(_try_js_render→None)。

    这些 HTML fixture 正文很短, 若不钉死 _try_js_render, _fetch_with_js_fallback
    会真的拉起 playwright/chromium(联网/慢/不可控)。个别用例需单独 override 该桩。
    """
    async def _null(url):  # noqa: ANN001
        return None
    monkeypatch.setattr(wc, "_try_js_render", _null)

# ---- 常用 HTML fixture ----

SIMPLE_HTML = """<html><head><title>测试标题</title></head><body>
<nav>导航 <a href="/n1">导航链接</a></nav>
<article>
<h1>正文大标题</h1>
<p>第一段正文内容,包含需要提取的文字。</p>
<p>第二段正文,继续补充上下文。</p>
<table><tr><th>名称</th><th>数值</th></tr>
<tr><td>苹果</td><td>10</td></tr></table>
</article>
<footer>页脚信息不该出现</footer>
<script>var junk=1</script>
</body></html>"""

LINK_HTML = """<html><head><title>链接页</title></head><body>
<a href="/about">关于我们</a>
<a href="https://example.com/docs">绝对链接</a>
<a href="../relative">相对链接</a>
<a href="/page#section">带fragment</a>
<a href="mailto:x@y.com">邮件</a>
<a href="https://news.example.com/other">子域链接</a>
<a href="/about">重复链接</a>
<a href="javascript:void(0)">脚本链接</a>
</body></html>"""

# 三层互链站点: 首页 -> sub1/sub2 -> leaf
SITE_PAGES = {
    "https://site.com/": "<html><body><a href='/sub1'>子页1</a><a href='/sub2'>子页2</a><a href='http://external.com/x'>外部</a></body></html>",
    "https://site.com/sub1": "<html><body><h1>子页1</h1><a href='/leaf1'>叶子1</a><a href='/'>首页</a></body></html>",
    "https://site.com/sub2": "<html><body><h1>子页2</h1><a href='/leaf2'>叶子2</a></body></html>",
    "https://site.com/leaf1": "<html><body><h1>叶子1</h1>无链接</body></html>",
    "https://site.com/leaf2": "<html><body><h1>叶子2</h1>无链接</body></html>",
}


def _fake_fetch(pages=None):
    """构造一个 monkeypatch 用的 _http_get_html: 返回页表里的 HTML, 未知页返回 None。"""
    raw = dict(SITE_PAGES if pages is None else pages)
    # 归一化键(去尾斜杠), 与 caller 的 url.rstrip("/") 一致, 避免 / vs 无 / 键失配
    norm = {(k or "/").rstrip("/") or "/": v for k, v in raw.items()}

    async def fake(url, *a, **kw):
        key = (url or "/").rstrip("/") or "/"
        html = norm.get(key)
        if html is None:
            return None
        return {
            "url": url,
            "final_url": url,
            "status_code": 200,
            "content_type": "text/html",
            "html": html,
        }

    return fake


# ============================================================================
# 注册一致性(对齐 test_codebase_index_trigger 风格)
# ============================================================================

def test_web_tools_registered_in_mcp():
    """4 个新工具名同时存在于 _TOOLS 与 _TOOL_HANDLERS, 且两表计数一致。"""
    import app.services.mcp_server as mcp

    names = [t.name for t in mcp._TOOLS]
    for n in ("fetch_readable", "map_site", "crawl_site", "extract_web"):
        assert n in names, f"{n} missing from _TOOLS"
        assert n in mcp._TOOL_HANDLERS, f"{n} missing from _TOOL_HANDLERS"
    assert len(mcp._TOOLS) == len(mcp._TOOL_HANDLERS)


# ============================================================================
# fetch_readable
# ============================================================================

class TestFetchReadable:
    async def test_readable_picks_article_and_strips_noise(self, monkeypatch):
        monkeypatch.setattr(wc, "_http_get_html", _fake_fetch({"https://example.com/": SIMPLE_HTML}))
        monkeypatch.setattr(wc, "_validate_ssrf", lambda u: None)
        r = await wc.fetch_readable({"url": "https://example.com/"})
        assert r["ok"] is True
        assert "正文大标题" in r["content"]
        assert "第一段正文内容" in r["content"]
        assert "页脚信息不该出现" not in r["content"]
        assert "导航链接" not in r["content"]
        assert "苹果" in r["content"]  # 表格内容保留
        assert r["title"] == "测试标题"

    async def test_missing_url(self):
        r = await wc.fetch_readable({})
        assert r["ok"] is False
        assert r["errorCode"] == "MISSING_PARAMS"

    async def test_ssrf_blocked(self, monkeypatch):
        # SSRF 校验应先于抓取: 内网地址直接被拒
        monkeypatch.setattr(wc, "_http_get_html", _fake_fetch({}))
        for bad in ("http://127.0.0.1/", "http://10.0.0.1/", "http://169.254.169.254/"):
            r = await wc.fetch_readable({"url": bad})
            assert r["ok"] is False
            assert r["errorCode"] == "SSRF_BLOCKED", bad

    async def test_max_chars_truncation(self, monkeypatch):
        # max_chars 存在下界(500): 构造足够长正文以触发截断
        long_html = (
            "<html><head><title>t</title></head><body><article>"
            + "<p>{}</p>".format("长正文内容。" * 150)
            + "</article></body></html>"
        )
        monkeypatch.setattr(wc, "_http_get_html", _fake_fetch({"https://example.com/": long_html}))
        monkeypatch.setattr(wc, "_validate_ssrf", lambda u: None)
        r = await wc.fetch_readable({"url": "https://example.com/", "max_chars": 500})
        assert r["ok"] is True
        assert r["truncated"] is True
        assert r["chars"] == 500
        assert len(r["content"]) == 500

    async def test_network_failure_returns_error(self, monkeypatch):
        # 让 _http_get_html 返回 None → 视为抓取失败/非 HTML
        monkeypatch.setattr(wc, "_http_get_html", _fake_fetch({"https://a.com/": None}))
        monkeypatch.setattr(wc, "_validate_ssrf", lambda u: None)
        r = await wc.fetch_readable({"url": "https://a.com/"})
        assert r["ok"] is False
        assert r["errorCode"] == "FETCH_FAILED"


# ============================================================================
# map_site
# ============================================================================

class TestMapSite:
    async def test_extract_links_filters(self, monkeypatch):
        monkeypatch.setattr(wc, "_http_get_html", _fake_fetch({"https://example.com/": LINK_HTML}))
        monkeypatch.setattr(wc, "_validate_ssrf", lambda u: None)
        r = await wc.map_site({"url": "https://example.com/"})
        assert r["ok"] is True
        urls = [l["url"] for l in r["links"]]
        # 同域(仅 example.com 与子域 news.example.com 含)链接保留
        assert any("example.com/" in u for u in urls)
        # 去 fragment: 不应含 '#'
        assert all("#" not in u for u in urls)
        # mailto:/javascript: 被过滤
        assert not any("mailto" in u or "javascript" in u for u in urls)
        # 去重: '/about' 只出现一次
        about = [u for u in urls if u.endswith("/about")]
        assert len(about) == 1
        # 相对链路经 urljoin 归一
        assert any(u == "https://example.com/about" for u in urls)

    async def test_include_text_false(self, monkeypatch):
        monkeypatch.setattr(wc, "_http_get_html", _fake_fetch({"https://example.com/": LINK_HTML}))
        monkeypatch.setattr(wc, "_validate_ssrf", lambda u: None)
        r = await wc.map_site({"url": "https://example.com/", "include_text": False})
        assert all(isinstance(l["url"], str) and "text" not in l for l in r["links"])

    async def test_missing_url(self):
        r = await wc.map_site({})
        assert r["ok"] is False
        assert r["errorCode"] == "MISSING_PARAMS"


# ============================================================================
# crawl_site
# ============================================================================

class TestCrawlSite:
    async def test_bfs_limits_and_dedup(self, monkeypatch):
        monkeypatch.setattr(wc, "_http_get_html", _fake_fetch())
        monkeypatch.setattr(wc, "_validate_ssrf", lambda u: None)
        r = await wc.crawl_site({"url": "https://site.com/", "max_depth": 1, "max_pages": 10, "format": "pages"})
        assert r["ok"] is True
        urls = [p["url"] for p in r["pages"]]
        # 首页 + sub1 + sub2(深度1), 不进入 leaf(深度2)
        assert "https://site.com/" in urls
        assert "https://site.com/sub1" in urls
        assert "https://site.com/sub2" in urls
        # 外部域不入
        assert not any("external.com" in u for u in urls)
        # 无重复
        assert len(urls) == len(set(urls))

    async def test_max_pages_hard_cap(self, monkeypatch):
        monkeypatch.setattr(wc, "_http_get_html", _fake_fetch())
        monkeypatch.setattr(wc, "_validate_ssrf", lambda u: None)
        r = await wc.crawl_site({"url": "https://site.com/", "max_depth": 2, "max_pages": 3, "format": "pages"})
        assert len(r["pages"]) <= 3
        assert r["stats"]["reached_max_pages"] in (True, False)

    async def test_concatenated_and_pages_formats(self, monkeypatch):
        monkeypatch.setattr(wc, "_http_get_html", _fake_fetch())
        monkeypatch.setattr(wc, "_validate_ssrf", lambda u: None)
        r_con = await wc.crawl_site({"url": "https://site.com/", "max_depth": 0, "max_pages": 5, "format": "concatenated"})
        assert "content" in r_con and "pages_count" in r_con
        r_pages = await wc.crawl_site({"url": "https://site.com/", "max_depth": 0, "max_pages": 5, "format": "pages"})
        assert isinstance(r_pages["pages"], list) and "content" not in r_pages

    async def test_missing_url(self):
        r = await wc.crawl_site({})
        assert r["ok"] is False
        assert r["errorCode"] == "MISSING_PARAMS"


# ============================================================================
# extract_web
# ============================================================================

class TestExtractWeb:
    async def test_heuristic_extraction(self, monkeypatch):
        html = "<html><body><article><p>价格: 199 元。作者: 张三。数量巨大正文填充。</p></article></body></html>"
        monkeypatch.setattr(wc, "_http_get_html", _fake_fetch({"https://example.com/": html}))
        monkeypatch.setattr(wc, "_validate_ssrf", lambda u: None)
        r = await wc.extract_web({"url": "https://example.com/", "fields": '{"价格":"number","作者":"string"}'})
        assert r["ok"] is True
        assert "作者" in r["fields"] and "张三" in r["fields"]["作者"]
        assert "价格" in r["fields"] and "199" in r["fields"]["价格"]

    async def test_field_not_found_ok_false(self, monkeypatch):
        html = "<html><body><article><p>完全无关的正文。</p></article></body></html>"
        monkeypatch.setattr(wc, "_http_get_html", _fake_fetch({"https://example.com/": html}))
        monkeypatch.setattr(wc, "_validate_ssrf", lambda u: None)
        r = await wc.extract_web({"url": "https://example.com/", "fields": '{"价格":"number"}'})
        assert r["ok"] is False

    async def test_missing_fields(self, monkeypatch):
        r = await wc.extract_web({"url": "https://a.com/"})
        assert r["ok"] is False
        assert r["errorCode"] == "MISSING_PARAMS"

    async def test_invalid_fields_json(self, monkeypatch):
        r = await wc.extract_web({"url": "https://a.com/", "fields": "not-json"})
        assert r["ok"] is False
        assert r["errorCode"] == "INVALID_PARAMS"


# ============================================================================
# LLM 结构化抽取通道 _extract_via_llm(2026-09-09 极致补齐:真 LLM Extract)
# ============================================================================

class TestExtractViaLLM:
    """extract_web 的 LLM 通道:调用 llm_gateway.complete 按 schema 抽结构化 JSON。

    stub(无 LLM key)→ None(走启发式);成功 JSON → {fields, confidence};
    失败/非 JSON/全空 → None。monkeypatch llm_gateway,不触网。
    """

    def _stub_gateway(self, monkeypatch, stub=True, content=None, complete_side_effect=None):
        import app.core.llm_gateway as lg
        monkeypatch.setattr(lg.llm_gateway, "_is_stub_mode", lambda: stub)
        if complete_side_effect is not None:
            monkeypatch.setattr(lg.llm_gateway, "complete", complete_side_effect)
        else:
            async def _complete(messages, model=None, **kw):
                return {"content": content, "stub": stub}
            monkeypatch.setattr(lg.llm_gateway, "complete", _complete)
        return lg

    async def test_stub_mode_returns_none(self, monkeypatch):
        self._stub_gateway(monkeypatch, stub=True)
        assert await wc._extract_via_llm("正文", {"价格": "number"}) is None

    async def test_valid_json_returns_fields(self, monkeypatch):
        self._stub_gateway(monkeypatch, stub=False,
                           content='{"价格": 199, "作者": "张三"}')
        r = await wc._extract_via_llm("正文", {"价格": "number", "作者": "string"})
        assert r is not None
        assert r["fields"]["价格"] == 199
        assert r["fields"]["作者"] == "张三"
        assert r["confidence"]["价格"] > 0.5

    async def test_fence_wrapped_json_parsed(self, monkeypatch):
        self._stub_gateway(monkeypatch, stub=False,
                           content='```json\n{"价格": 88}\n```')
        r = await wc._extract_via_llm("正文", {"价格": "number"})
        assert r is not None and r["fields"]["价格"] == 88

    async def test_non_json_or_missing_returns_none(self, monkeypatch):
        self._stub_gateway(monkeypatch, stub=False, content="抱歉我无法完成")
        assert await wc._extract_via_llm("正文", {"价格": "number"}) is None

    async def test_all_null_fields_returns_empty_with_usage_slot(self, monkeypatch):
        """LLM 全 null → {fields:{}}(token 已消耗,不再丢弃返回值)。"""
        self._stub_gateway(monkeypatch, stub=False, content='{"价格": null, "作者": null}')
        r = await wc._extract_via_llm("正文", {"价格": "number", "作者": "string"})
        assert r is not None and r["fields"] == {}

    async def test_complete_raises_returns_none(self, monkeypatch):
        async def _boom(messages, model=None, **kw):
            raise RuntimeError("llm down")
        self._stub_gateway(monkeypatch, stub=False, complete_side_effect=_boom)
        assert await wc._extract_via_llm("正文", {"价格": "number"}) is None

    async def test_extract_web_prefers_llm_when_available(self, monkeypatch):
        # extract_web 集成:LLM 可用时 source=llm(而非 heuristic)
        self._stub_gateway(monkeypatch, stub=False, content='{"价格": 199, "作者": "张三"}')
        html = "<html><body><article><p>价格: 199 元。作者: 张三。</p></article></body></html>"
        monkeypatch.setattr(wc, "_http_get_html", _fake_fetch({"https://example.com/": html}))
        monkeypatch.setattr(wc, "_validate_ssrf", lambda u: None)
        r = await wc.extract_web({"url": "https://example.com/", "fields": '{"价格":"number","作者":"string"}'})
        assert r["ok"] is True
        assert r["source"] == "llm"
        assert r["fields"]["价格"] == 199


# ============================================================================
# JS 渲染兜底(2026-09-09 极致补齐:SPA 空壳 → headless chromium 渲染)
# ============================================================================

class TestJsRenderFallback:
    """_fetch_with_js_fallback: httpx 抓到空壳/短正文时, _try_js_render 渲染兜底。

    autouse fixture 默认把 _try_js_render 钉成 None(不触网), 本类再单独 override
    成返回渲染后 HTML, 验证兜底接管。
    """

    async def test_fetch_readable_uses_rendered_html(self, monkeypatch):
        # httpx 只能抓到 SPA 空壳(正文极短), JS 渲染后才有真实内容
        shell = "<html><head><title>壳</title></head><body></body></html>"
        rendered_html = "<html><head><title>真实页</title></head><body><article><h1>JS渲染正文</h1><p>这是渲染后才出现的内容。</p></article></body></html>"
        monkeypatch.setattr(wc, "_http_get_html", _fake_fetch({"https://spa.com/": shell}))
        monkeypatch.setattr(wc, "_validate_ssrf", lambda u: None)

        async def _fake_render(url):
            assert url == "https://spa.com/"
            return {"html": rendered_html, "final_url": url, "status_code": 200}
        monkeypatch.setattr(wc, "_try_js_render", _fake_render)

        r = await wc.fetch_readable({"url": "https://spa.com/"})
        assert r["ok"] is True
        assert r["rendered"] is True
        assert "JS渲染正文" in r["content"]
        assert "渲染后才出现" in r["content"]

    async def test_no_render_when_http_content_is_rich(self, monkeypatch):
        # 正文足够 → 不走渲染兜底, rendered=False
        rich = "<html><body><article>{}</article></body></html>".format("<p>正常正文。</p>" * 60)
        monkeypatch.setattr(wc, "_http_get_html", _fake_fetch({"https://x.com/": rich}))
        monkeypatch.setattr(wc, "_validate_ssrf", lambda u: None)
        r = await wc.fetch_readable({"url": "https://x.com/"})
        assert r["ok"] is True
        assert r["rendered"] is False

    def test_html_text_length_strips_noise(self):
        # 只有噪声(script/style)无正文 → 0; 有真实正文 → 非 0
        assert wc._html_text_length("<html><body><script>var a=1</script><style>.x{}</style></body></html>") == 0
        html = "<html><body><article>真实内容</article></body></html>"
        assert wc._html_text_length(html) >= 4


# ============================================================================
# 私有辅助单元
# ============================================================================

def test_url_normalization_and_domain():
    assert wc._normalize_url("https://Example.com:443/path#frag") == "https://example.com/path"
    assert wc._normalize_url("https://a.com:8080/x") == "https://a.com:8080/x"
    assert wc._is_same_domain("https://blog.example.com/x", "https://example.com/") is True
    assert wc._is_same_domain("https://other.net/x", "https://example.com/") is False

def test_is_http_html_filters_binary():
    assert wc._is_http_html("https://a.com/page") is True
    assert wc._is_http_html("https://a.com/photo.png") is False
    assert wc._is_http_html("ftp://a.com/x") is False
    assert wc._is_http_html("https://a.com/doc.pdf", "application/pdf") is False

# ============================================================================
# extract_web — LLM token usage 透出(费用归属可观测,2026-09-09 立)
# ============================================================================

class _FakeGateway:
    """替身 llm_gateway:可编程 complete 返回值。"""

    def __init__(self, resp):
        self.resp = resp
        self.calls: list = []

    def _is_stub_mode(self) -> bool:
        return False

    async def complete(self, messages, model="auto", **kw):  # noqa: ANN001, ANN003
        self.calls.append({"messages": messages, "model": model})
        return self.resp


class TestExtractWebLLMUsage:
    async def test_llm_usage_passed_through(self, monkeypatch):
        """LLM 通道成功 → 结果携带 llm_usage/llm_model,source=llm,usage 与网关返回一致。"""
        gw = _FakeGateway({
            "content": '{"名称": "苹果", "数值": "10"}',
            "model": "test-model-x",
            "usage": {"prompt_tokens": 120, "completion_tokens": 30, "total_tokens": 150},
            "stub": False,
        })
        monkeypatch.setattr("app.core.llm_gateway.llm_gateway", gw)
        monkeypatch.setattr(wc, "_http_get_html", _fake_fetch({"https://example.com/": SIMPLE_HTML}))
        monkeypatch.setattr(wc, "_validate_ssrf", lambda u: None)

        r = await wc.extract_web({"url": "https://example.com/", "fields": {"名称": "string", "数值": "number"}})
        assert r["ok"] is True
        assert r["source"] == "llm"
        assert r["fields"] == {"名称": "苹果", "数值": "10"}
        assert r["llm_usage"] == {"prompt_tokens": 120, "completion_tokens": 30, "total_tokens": 150}
        assert r["llm_model"] == "test-model-x"
        assert gw.calls and gw.calls[0]["model"] == "auto"

    async def test_llm_json_missing_usage_defaults_empty(self, monkeypatch):
        """网关未返回 usage(异常 provider)→ llm_usage 为空 dict,不炸。"""
        gw = _FakeGateway({"content": '{"名称": "苹果"}', "model": "m1", "stub": False})
        monkeypatch.setattr("app.core.llm_gateway.llm_gateway", gw)
        monkeypatch.setattr(wc, "_http_get_html", _fake_fetch({"https://example.com/": SIMPLE_HTML}))
        monkeypatch.setattr(wc, "_validate_ssrf", lambda u: None)

        r = await wc.extract_web({"url": "https://example.com/", "fields": {"名称": "string"}})
        assert r["ok"] is True and r["source"] == "llm"
        assert r["llm_usage"] == {}

    async def test_llm_null_fields_falls_back_keeps_usage(self, monkeypatch):
        """LLM 全 null 降级启发式 → source=heuristic 但 llm_usage/llm_fallback 保留(费用可见)。"""
        gw = _FakeGateway({"content": '{"名称": null, "数值": null}', "model": "m1", "usage": {"total_tokens": 9}, "stub": False})
        monkeypatch.setattr("app.core.llm_gateway.llm_gateway", gw)
        monkeypatch.setattr(wc, "_http_get_html", _fake_fetch({"https://example.com/": SIMPLE_HTML}))
        monkeypatch.setattr(wc, "_validate_ssrf", lambda u: None)

        r = await wc.extract_web({"url": "https://example.com/", "fields": {"名称": "string", "数值": "number"}})
        assert r["source"] == "heuristic"
        assert r["llm_fallback"] is True
        assert r["llm_usage"] == {"total_tokens": 9}
        assert r["llm_model"] == "m1"

    async def test_llm_failure_falls_back_no_usage(self, monkeypatch):
        """LLM 抛异常 → 不向外抛,降级启发式(网络层失败无 usage 可保留)。"""

        class _BoomGW(_FakeGateway):
            async def complete(self, messages, model="auto", **kw):  # noqa: ANN003
                raise RuntimeError("llm down")

        monkeypatch.setattr("app.core.llm_gateway.llm_gateway", _BoomGW(None))
        monkeypatch.setattr(wc, "_http_get_html", _fake_fetch({"https://example.com/": SIMPLE_HTML}))
        monkeypatch.setattr(wc, "_validate_ssrf", lambda u: None)

        r = await wc.extract_web({"url": "https://example.com/", "fields": {"名称": "string"}})
        assert r["source"] == "heuristic"
        assert "llm_usage" not in r and "llm_fallback" not in r
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
