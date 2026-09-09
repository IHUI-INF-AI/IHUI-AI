# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍​‌​â€‹​‌​‌/â€Œâ€‹â€Œâ€‹â€Œâ€‹â€Œâ€‹â€Œâ€‹â€Œâ€‹â€Œâ€‹â€Œâ€‹â€Œâ€‹â€Œâ€‹â€Œâ€‹â€Œâ€‹â€Œâ€‹â€Œâ€‹

"""网页抓取工具集:对标开源项目 Firecrawl 的 Scrape / Map / Crawl / Extract 四大网络核心能力。

firecrawl 的核心开源价值 = 把"杂乱的网页"变成"干净的 LLM-ready 数据"。本项目已融合其
文档解析(anydoc)三件套,本模块补齐其网络抓取体系:

- fetch_readable:  对标 Scrape→clean markdown,抽取网页正文为干净 GFM markdown(去导航/页脚/脚本噪声)。
- map_site:        对标 Map,返回起始页面的站内 URL 地图(链接+锚文本)。
- crawl_site:      对标 Crawl,从起始 URL 递归抓取同域名页面(BFS,限深度/页数/并发)。
- extract_web:     对标 Extract,按显式字段 schema 从网页抽结构化数据(LLM 优先,启发式兜底)。

安全与健壮性约束(与 document_tools / fetch_url 一致):
- 所有网络入口先做 SSRF 校验(复用 screenshot_service._validate_url_ssrf),拒绝内网/回环/云元数据。
- 不引入第三方依赖:HTTP 用 httpx(已装),正文提取用 beautifulsoup4(已装)。
- 全部异常捕获并返回结构化失败 {ok:False, error, errorCode},不向 MCP 层抛异常。
"""

from __future__ import annotations

import asyncio
import json
import re
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin, urlsplit

# beautifulsoup4(已装机)
try:  # pragma: no cover - 依赖探测
    from bs4 import BeautifulSoup
    _BS4_OK: bool = True
except ImportError:  # pragma: no cover
    BeautifulSoup = None  # type: ignore[assignment]
    _BS4_OK = False

try:
    import httpx  # noqa: F401
    _HTTPX_OK: bool = True
except ImportError:  # pragma: no cover
    _HTTPX_OK = False

_DEFAULT_MAX_CHARS = 8000
_MAX_MAX_CHARS = 50000
_HTTP_TIMEOUT = 15.0
_MAX_DEPTH = 3
_MAX_PAGES = 50
_CRAWL_CONCURRENCY = 3
# 正文文字数低于该阈值 → 判定疑似 JS 渲染空壳, 触发 headless chromium 渲染兜底
_JS_RENDER_THRESHOLD = 150
_DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
}


# ============================================================================
# 结构失败辅助
# ============================================================================

def _fail(tool: str, message: str, error_code: str = "ERROR") -> Dict[str, Any]:
    return {"tool": tool, "ok": False, "error": message, "errorCode": error_code, "message": message}


# ============================================================================
# 共享 HTTP 层
# ============================================================================

def _validate_ssrf(url: str) -> Optional[str]:
    """SSRF 校验,返回错误消息;合法返回 None。"""
    try:
        from ..services.screenshot_service import _validate_url_ssrf

        ok, reason = _validate_url_ssrf(url)
        if not ok:
            return reason
        return None
    except Exception as e:  # noqa: BLE001 - 校验层异常视为不通过
        return "SSRF 校验异常: {}: {}".format(type(e).__name__, e)


def _is_http_html(url: str, content_type: str = "") -> bool:
    """判断目标是否为可抓取的 http/https HTML 页面(排除 pdf/图片/zip 等二进制)。"""
    scheme = urlsplit(url).scheme.lower()
    if scheme not in ("http", "https"):
        return False
    if content_type:
        ct = content_type.lower().split(";")[0].strip()
        if ct and ct not in ("text/html", "application/xhtml+xml", ""):
            return False
    path = urlsplit(url).path.lower()
    binary_hint_exts = (
        ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico",
        ".zip", ".gz", ".rar", ".7z", ".mp4", ".mp3", ".mov", ".exe", ".bin",
    )
    if any(path.endswith(e) for e in binary_hint_exts):
        return False
    return True


async def _http_get_html(url: str) -> Optional[Dict[str, Any]]:
    """抓取单个 URL 的 HTML。返回 {url, final_url, status_code, content_type, html};
    非 HTML/失败返回 None。不做 SSRF(调用方需先校验)。"""
    if not _HTTPX_OK:
        return None
    try:
        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT, follow_redirects=True) as client:
            resp = await client.get(url, headers=_DEFAULT_HEADERS)
        ctype = resp.headers.get("content-type", "")
        if not _is_http_html(str(resp.url), ctype):
            return None
        return {
            "url": str(resp.url),
            "final_url": str(resp.url),
            "status_code": resp.status_code,
            "content_type": ctype,
            "html": resp.text,
        }
    except Exception:  # noqa: BLE001
        return None


# ============================================================================
# readability 正文提取(纯 bs4)
# ============================================================================

_REMOVE_SELECTORS = (
    "script", "style", "noscript", "nav", "footer", "header", "aside",
    "iframe", "form", "button", "svg", "template", "figure",
)


def _visible_text(el: Any) -> str:
    """元素的可见文本(排除 script/style 子节点)。"""
    txt = el.get_text(" ", strip=True) if hasattr(el, "get_text") else str(el)
    return txt


def _link_text(el: Any) -> str:
    """元素内所有 <a> 的可见文本(用于 link-density 惩罚)。"""
    try:
        return " ".join(a.get_text(" ", strip=True) for a in el.find_all("a"))
    except Exception:  # noqa: BLE001
        return ""


def _score_container(el: Any) -> int:
    """正文容器文本密度打分:可见文本字符数 - 2*内链文本字符数(链接密度惩罚)。"""
    txt = _visible_text(el)
    links = _link_text(el)
    return len(txt) * 2 - len(links) * 3


def _pick_content_container(soup: Any) -> Any:
    """从 soup 中选正文容器:<article> 优先,否则按文本密度取分最高块级容器。"""
    article = soup.find("article")
    if article is not None and len(_visible_text(article)) >= 200:
        return article
    body = soup.find("body")
    if body is None:
        return soup
    best, best_score = None, -1
    for el in body.find_all(["section", "div", "main", "td", "article"]):
        txt = _visible_text(el)
        if len(txt) < 80:
            continue  # 跳过几乎无文本的容器
        score = _score_container(el)
        if score > best_score:
            best, best_score = el, score
    return best if best is not None else body


def _element_to_markdown(el: Any, base_url: str, include_links: bool, depth: int = 0) -> str:
    """递归把元素转为 GFM markdown。"""
    if depth > 12:  # 防深嵌套栈溢出
        return ""
    out: List[str] = []
    name = getattr(el, "name", None) or ""
    tag = name.lower()

    # 忽略噪声块
    if tag in ("script", "style", "noscript", "nav", "footer", "aside", "iframe", "button"):
        return ""

    if tag in ("h1", "h2", "h3", "h4", "h5", "h6"):
        level = int(tag[1])
        return "{} {}".format("#" * level, el.get_text(" ", strip=True))
    if tag == "a" and include_links:
        href = el.get("href", "")
        text = el.get_text(" ", strip=True)
        if href and text:
            abs_href = urljoin(base_url, href)
            if urlsplit(abs_href).scheme in ("http", "https"):
                return "[{}]({})".format(text, abs_href)
        return text
    if tag == "li":
        content = _children_to_markdown(el, base_url, include_links, depth + 1)
        # 嵌套 list 支持简单缩进
        return "- {}".format(content.replace("\n", "\n  ")) if content else ""
    if tag == "table":
        return _table_to_markdown(el)
    if tag == "img":
        src = el.get("src") or ""
        alt = el.get("alt") or ""
        if src and include_links:
            abs_src = urljoin(base_url, src)
            if urlsplit(abs_src).scheme in ("http", "https"):
                return "![{}]({})".format(alt, abs_src)
        return alt
    if tag in ("p", "div", "section", "main", "article", "blockquote", "pre"):
        inner = _children_to_markdown(el, base_url, include_links, depth + 1).strip()
        return "{}\n\n".format(inner) if inner else ""
    if tag in ("ul", "ol"):
        # 收集直接 li 子项,避免嵌套重复缩进爆炸
        items = []
        for child in el.find_all("li", recursive=False) or el.children:
            if getattr(child, "name", "").lower() == "li":
                items.append(_element_to_markdown(child, base_url, include_links, depth + 1))
            elif getattr(child, "name", ""):
                pass
        merged = "\n".join(it for it in items if it)
        return merged + "\n\n" if merged else ""

    # <b>/<strong>/<em>/<i>/<code>/<br>等 inline 处理
    if tag in ("b", "strong"):
        return "**{}**".format(el.get_text(" ", strip=True))
    if tag in ("i", "em"):
        return "*{}*".format(el.get_text(" ", strip=True))
    if tag == "code":
        return "`{}`".format(el.get_text(" ", strip=True))
    if tag == "br":
        return "\n"

    return _children_to_markdown(el, base_url, include_links, depth + 1)


def _children_to_markdown(el: Any, base_url: str, include_links: bool, depth: int) -> str:
    parts: List[str] = []
    for child in getattr(el, "children", []):
        if getattr(child, "name", None) is None:  # NavigableString
            text = str(child)
            text = re.sub(r"\s+", " ", text)
            if text:
                parts.append(text)
        else:
            parts.append(_element_to_markdown(child, base_url, include_links, depth))
    merged = "".join(parts)
    merged = re.sub(r"[ \t]+\n|\n[ \t]+", "\n", merged)
    merged = re.sub(r"\n{3,}", "\n\n", merged)
    return merged


def _table_to_markdown(el: Any) -> str:
    rows: List[List[str]] = []
    for tr in el.find_all("tr"):
        cells = []
        for cell in tr.find_all(["th", "td"]):
            cells.append(cell.get_text(" ", strip=True))
        if cells:
            rows.append(cells)
    if not rows:
        return ""
    ncols = max(len(r) for r in rows)
    header = rows[0] + [""] * (ncols - len(rows[0]))
    sep = ["---"] * ncols
    lines = ["| {} |".format(" | ".join(header)), "| {} |".format(" | ".join(sep))]
    for r in rows[1:]:
        padded = r + [""] * (ncols - len(r))
        lines.append("| {} |".format(" | ".join(padded)))
    return "\n".join(lines) + "\n\n"


def _readability_to_markdown(html: str, base_url: str = "", include_links: bool = False) -> str:
    """把 HTML 抽成干净 GFM markdown(对标 Firecrawl Scrape 的 clean markdown)。"""
    if not _BS4_OK:
        # 无 bs4 时退化为简单文本剥离
        text = re.sub(r"<script[^>]*>.*?</script>", "", html, flags=re.I | re.S)
        text = re.sub(r"<[^>]+>", " ", text)
        return re.sub(r"\s+", " ", text).strip()
    soup = BeautifulSoup(html, "html.parser")
    # 剥离噪声节点
    for sel in _REMOVE_SELECTORS:
        for node in soup.find_all(sel):
            node.decompose()
    container = _pick_content_container(soup)
    md = _element_to_markdown(container, base_url, include_links)
    md = re.sub(r"[ \t]+\n", "\n", md)
    md = re.sub(r"\n{3,}", "\n\n", md)
    return md.strip()


def _extract_title(html: str) -> str:
    try:
        soup = BeautifulSoup(html, "html.parser")
        t = soup.title.get_text(" ", strip=True) if soup.title else ""
        return t
    except Exception:  # noqa: BLE001
        return ""


# ============================================================================
# 链接提取(供 map_site / crawl_site 复用)
# ============================================================================

def _normalize_url(url: str) -> str:
    """URL 归一化: 去 fragment, host 小写含端口, 保留 scheme。"""
    try:
        parts = urlsplit(url)
        scheme = parts.scheme.lower()
        host = (parts.hostname or "").lower()
        port = parts.port
        default_port = 443 if scheme == "https" else 80 if scheme == "http" else None
        netloc = host
        if port and port != default_port:
            netloc = "{}:{}".format(host, port)
        path = parts.path or "/"
        return "{}://{}{}".format(scheme, netloc, path)
    except Exception:  # noqa: BLE001
        return url


def _registrable_root(hostname: str) -> str:
    """取可注册根(host 后两段, 忽略子域)。入参为纯 hostname(非完整 URL)。"""
    parts = (hostname or "").strip().split(".")
    if len(parts) >= 2:
        return ".".join(parts[-2:])
    return hostname


def _is_same_domain(url: str, start_url: str) -> bool:
    """判断两 URL 是否同属一个可注册根域(忽略子域差异, 如 blog.a.com vs a.com)。"""
    try:
        a = urlsplit(url)
        b = urlsplit(start_url)
        if a.hostname is None or b.hostname is None:
            return False
        return _registrable_root(a.hostname) == _registrable_root(b.hostname)
    except Exception:  # noqa: BLE001
        return False


def _extract_links(html: str, base_url: str, same_domain_only: bool = True) -> List[Dict[str, str]]:
    """从 HTML 提取站内链接(URL + 锚文本),去 fragment/去重。"""
    if not _BS4_OK:
        return []
    links: Dict[str, str] = {}
    try:
        soup = BeautifulSoup(html, "html.parser")
    except Exception:  # noqa: BLE001
        return []
    for a in soup.find_all("a"):
        href = a.get("href") or a.get("data-href")
        if not href:
            continue
        try:
            abs_url = urljoin(base_url, href)
            parts = urlsplit(abs_url)
            if parts.scheme.lower() not in ("http", "https"):
                continue
            norm = _normalize_url(abs_url)
            if same_domain_only and not _is_same_domain(abs_url, base_url):
                continue
            text = a.get_text(" ", strip=True)
            if len(text) > 80:
                text = text[:80] + "…"
            links[norm] = text
        except Exception:  # noqa: BLE001
            continue
    return [{"url": u, "text": t} for u, t in links.items()]


def _html_text_length(html: str) -> int:
    """统计 HTML 的可读正文文字数(剥 script/style/noscript/svg/head 后去空白)。"""
    if not html:
        return 0
    if not _BS4_OK:
        return len([c for c in html if not c.isspace()])
    try:
        soup = BeautifulSoup(html, "html.parser")
        for tag in soup(["script", "style", "noscript", "svg", "head", "template"]):
            tag.decompose()
        return len(re.sub(r"\s+", "", soup.get_text(" ") or ""))
    except Exception:  # noqa: BLE001
        return len([c for c in html if not c.isspace()])


async def _try_js_render(url: str) -> Optional[Dict[str, Any]]:
    """JS 渲染兜底:用平台单例 headless Chromium 渲染,取执行 JS 后的 DOM。

    交互传统抓取工具的"SPA 空壳"短板。异常/非页面一律返回 None(上层继续走原路)。
    """
    if not _is_http_html(url):
        return None
    try:
        from ..services.screenshot_service import render_to_html

        r = await render_to_html(url, timeout=15000)
        html = (r or {}).get("html") or ""
        if not html or _html_text_length(html) == 0:
            return None
        return {
            "html": html,
            "final_url": (r or {}).get("final_url") or url,
            "status_code": (r or {}).get("status_code") or 200,
        }
    except Exception:  # noqa: BLE001 - 渲染失败/超时/未装 chromium 一律降级
        return None


async def _fetch_with_js_fallback(url: str) -> Optional[Dict[str, Any]]:
    """HTTP 优先, 渲染兜底:httpx 抓到正文过短(疑似 JS 空壳)或抓取失败 → chromium 渲染。

    返回 {url, final_url, status_code, content_type, html, rendered}。
    """
    page = await _http_get_html(url)
    if page is not None and _html_text_length(page["html"]) >= _JS_RENDER_THRESHOLD:
        page["rendered"] = False
        return page
    # 正文过短 或 直接抓取失败 → 尝试 JS 渲染兜底
    rendered = await _try_js_render(url)
    if rendered is None:
        return page  # 兜底无效, 保留原始结果(可能是 None/短正文)
    return {
        "url": url,
        "final_url": rendered["final_url"],
        "status_code": rendered["status_code"],
        "content_type": "text/html",
        "html": rendered["html"],
        "rendered": True,
    }


# ============================================================================
# fetch_readable — 对标 Scrape → clean markdown
# ============================================================================

async def fetch_readable(arguments: Dict[str, Any]) -> Dict[str, Any]:
    """抓取单个网页并抽取正文为干净 GFM markdown(对标 Firecrawl Scrape)。"""
    url = arguments.get("url", "")
    if not url or not isinstance(url, str):
        return _fail("fetch_readable", "缺少 url 参数", "MISSING_PARAMS")

    max_chars = DEFAULT = _DEFAULT_MAX_CHARS
    raw_max = arguments.get("max_chars")
    if raw_max is not None:
        try:
            max_chars = int(raw_max)
        except (TypeError, ValueError):
            max_chars = DEFAULT
    max_chars = max(500, min(_MAX_MAX_CHARS, max_chars))
    include_links = bool(arguments.get("include_links", False))

    ssrf_reason = _validate_ssrf(url)
    if ssrf_reason:
        return _fail("fetch_readable", ssrf_reason, "SSRF_BLOCKED")
    if not _HTTPX_OK:
        return _fail("fetch_readable", "httpx 未安装, 无法抓取网页", "DEP_MISSING")

    page = await _fetch_with_js_fallback(url)
    if page is None:
        return _fail("fetch_readable", "抓取失败或目标非 HTML 页面", "FETCH_FAILED")

    rendered = bool(page.get("rendered"))

    try:
        title = _extract_title(page["html"])
        content = _readability_to_markdown(
            page["html"], base_url=page["final_url"], include_links=include_links
        )
    except Exception as e:  # noqa: BLE001
        return _fail("fetch_readable", "正文提取失败: {}: {}".format(type(e).__name__, e), "EXTRACT_FAILED")

    truncated = len(content) > max_chars
    if truncated:
        content = content[:max_chars]

    return {
        "tool": "fetch_readable",
        "ok": True,
        "url": page["final_url"],
        "title": title,
        "content": content,
        "status_code": page["status_code"],
        "content_type": page["content_type"],
        "chars": len(content),
        "truncated": truncated,
        "rendered": rendered,
        "message": "正文提取成功({} 字符{})".format(
            len(content), ", 经 JS 渲染" if rendered else ""
        ),
    }


# ============================================================================
# map_site — 对标 Map(站点 URL 地图)
# ============================================================================

async def map_site(arguments: Dict[str, Any]) -> Dict[str, Any]:
    """抓取起始页面并提取站内链接, 返回站点 URL 地图。"""
    url = arguments.get("url", "")
    if not url or not isinstance(url, str):
        return _fail("map_site", "缺少 url 参数", "MISSING_PARAMS")

    same_domain_only = bool(arguments.get("same_domain_only", True))
    max_links = int(arguments.get("max_links", 200))
    include_text = bool(arguments.get("include_text", True))

    ssrf_reason = _validate_ssrf(url)
    if ssrf_reason:
        return _fail("map_site", ssrf_reason, "SSRF_BLOCKED")
    if not _HTTPX_OK:
        return _fail("map_site", "httpx 未安装, 无法抓取网页", "DEP_MISSING")

    page = await _fetch_with_js_fallback(url)
    if page is None:
        return _fail("map_site", "抓取失败或目标非 HTML 页面", "FETCH_FAILED")

    rendered = bool(page.get("rendered"))

    try:
        links = _extract_links(page["html"], page["final_url"], same_domain_only)
    except Exception as e:  # noqa: BLE001
        return _fail("map_site", "链接提取失败: {}: {}".format(type(e).__name__, e), "EXTRACT_FAILED")

    if max_links > 0:
        links = links[:max_links]
    if not include_text:
        links = [{"url": l["url"]} for l in links]

    return {
        "tool": "map_site",
        "ok": True,
        "url": page["final_url"],
        "title": _extract_title(page["html"]),
        "link_count": len(links),
        "links": links,
        "rendered": rendered,
        "message": "提取到 {} 条链接".format(len(links)) if links else "未提取到链接",
    }


# ============================================================================
# crawl_site — 对标 Crawl(整站 BFS 爬取)
# ============================================================================

async def _fetch_page_limited(url: str, sem: Any) -> Optional[Dict[str, Any]]:
    """带信号量限并发的单页抓取。"""
    async with sem:
        return await _fetch_with_js_fallback(url)


def _url_key(url: str) -> str:
    return _normalize_url(url)


async def crawl_site(arguments: Dict[str, Any]) -> Dict[str, Any]:
    """从起始 URL 递归抓取同域名页面(BFS)。对标 Firecrawl Crawl。"""
    url = arguments.get("url", "")
    if not url or not isinstance(url, str):
        return _fail("crawl_site", "缺少 url 参数", "MISSING_PARAMS")

    max_depth = int(arguments.get("max_depth", 1))
    max_pages = int(arguments.get("max_pages", 10))
    format_type = str(arguments.get("format", "concatenated"))
    respect_robots = bool(arguments.get("respect_robots", False))

    max_depth = max(0, min(_MAX_DEPTH, max_depth))
    max_pages = max(1, min(_MAX_PAGES, max_pages))
    if format_type not in ("pages", "concatenated"):
        format_type = "concatenated"

    ssrf_reason = _validate_ssrf(url)
    if ssrf_reason:
        return _fail("crawl_site", ssrf_reason, "SSRF_BLOCKED")
    if not _HTTPX_OK:
        return _fail("crawl_site", "httpx 未安装, 无法抓取网页", "DEP_MISSING")

    start = url
    sem = asyncio.Semaphore(_CRAWL_CONCURRENCY)
    # 已入队集合(用于去重防重入)。出队不再按 visited 跳过:
    # 入队时即标记, 每个唯一 URL 只会入队一次、恰好处理一次, 避免
    # 子链接先标记后出队被误判为"已处理"而整层漏抓。
    enqueued: set[str] = {_url_key(url)}

    queue = [(url, 0)]
    results: List[Dict[str, Any]] = []
    fetched, failed, skipped = 0, 0, 0
    reached_max_pages = False

    while queue and len(results) < max_pages:
        current, depth = queue.pop(0)
        if not _is_http_html(current):
            skipped += 1
            continue
        if respect_robots and not _robots_path_allowed(current):
            skipped += 1
            continue

        page = await _fetch_page_limited(current, sem)
        if page is None:
            failed += 1
            if len(results) + 1 >= max_pages and depth >= max_depth:
                reached_max_pages = True
            continue

        try:
            title = _extract_title(page["html"])
            markdown = _readability_to_markdown(
                page["html"], base_url=page["final_url"]
            )
        except Exception:  # noqa: BLE001
            title, markdown = "", ""
        fetched += 1
        results.append({
            "url": page["final_url"],
            "title": title,
            "depth": depth,
            "status": page["status_code"],
            "rendered": bool(page.get("rendered")),
            "chars": len(markdown),
            "markdown": markdown,
        })
        if len(results) >= max_pages:
            reached_max_pages = True

        if depth < max_depth:
            try:
                child_links = _extract_links(page["html"], page["final_url"], same_domain_only=True)
            except Exception:  # noqa: BLE001
                child_links = []
            for link in child_links:
                ckey = _url_key(link["url"])
                if ckey in enqueued:
                    continue
                enqueued.add(ckey)
                queue.append((link["url"], depth + 1))

    truncated = reached_max_pages

    stats = {
        "fetched": fetched,
        "failed": failed,
        "skipped": skipped,
        "reached_max_pages": reached_max_pages,
        "max_depth_allowed": max_depth,
        "max_pages_allowed": max_pages,
    }

    if format_type == "pages":
        return {
            "tool": "crawl_site",
            "ok": True,
            "start_url": start,
            "pages_count": len(results),
            "pages": results,
            "stats": stats,
            "message": "已抓取 {} 页".format(len(results)),
        }

    # concatenated: 合并为单篇 markdown
    sections: List[str] = []
    for ent in results:
        sections.append("## {}\n来源: {}\n----\n{}".format(ent["title"] or ent["url"], ent["url"], ent["markdown"]))
    combined = "\n\n".join(sections)
    return {
        "tool": "crawl_site",
        "ok": True,
        "start_url": start,
        "pages_count": len(results),
        "content": combined,
        "chars": len(combined),
        "stats": stats,
        "message": "已抓取 {} 页(concatenated, {} 字符)".format(len(results), len(combined)),
    }


def _robots_path_allowed(url: str) -> bool:
    """校验 robots(仅在同模块内被 crawl_site 调用; 网络由 _http_get_html 负责)。"""
    try:
        parts = urlsplit(url)
        scheme = parts.scheme.lower()
        host = (parts.hostname or "").lower()
        port = parts.port
        if not host:
            return True
        rp = _robots_cache_get(scheme, host, port)
        if rp is None:
            return True  # 无法加载 robots 视为放行(保守但稳妥)
        path = parts.path or "/"
        return rp.can_fetch("*", url)
    except Exception:  # noqa: BLE001
        return True


_robots_cache: Dict[str, Any] = {}


def _robots_cache_get(scheme: str, host: str, port: Optional[int]) -> Any:
    import httpx as _httpx

    key = "{}://{}:{}".format(scheme, host, port or "")
    if key in _robots_cache:
        return _robots_cache[key]
    try:
        from urllib.robotparser import RobotFileParser

        netloc = host + (":{}".format(port) if port else "")
        robots_url = "{}://{}/robots.txt".format(scheme, netloc)
        rp = RobotFileParser()
        # 手动抓取 robots.txt(走 SSRF 校验), 避免 RobotFileParser 内部直接用 urlopen
        from ..services.screenshot_service import _validate_url_ssrf

        ok, _reason = _validate_url_ssrf(robots_url)
        if not ok:
            _robots_cache[key] = None
            return None
        try:
            with _httpx.Client(timeout=_HTTP_TIMEOUT, follow_redirects=True) as client:
                resp = client.get(robots_url, headers=_DEFAULT_HEADERS)
            data = resp.text if resp.status_code == 200 else ""
        except Exception:  # noqa: BLE001
            data = ""
        try:
            rp.parse(data.splitlines())
        except Exception:  # noqa: BLE001
            rp = None
        _robots_cache[key] = rp
        return rp
    except Exception:  # noqa: BLE001
        _robots_cache[key] = None
        return None


# ============================================================================
# extract_web — 对标 Extract(结构化抽取)
# ============================================================================

def _extract_heuristic(md: str, fields: Dict[str, str]) -> Dict[str, Any]:
    """启发式字段抽取: 按字段名在正文中做近邻扫描截取。"""
    result: Dict[str, Any] = {}
    confidence: Dict[str, float] = {}
    for field, ftype in fields.items():
        keywords = [field, field.strip()]
        found = None
        # 找关键词第一个出现位置, 向后取一段(直至下一字段/句末/换行)
        idx = -1
        for kw in keywords:
            if not kw:
                continue
            pos = md.lower().find(kw.lower())
            if pos >= 0:
                idx = pos
                break
        if idx < 0:
            confidence[field] = 0.0
            continue
        # 从关键词后取 120 字符(到最近的换行/句号), 去掉冒号
        seg = md[idx + len(kw) : idx + len(kw) + 160]
        seg = re.split(r"[\n。.！!；;]", seg)[0].strip()
        seg = seg.lstrip(":：= \t")
        # 去掉尾部残留的相邻字段名/链接
        seg = re.split(r"\s{2,}|\n", seg)[0]
        if seg:
            result[field] = seg
            confidence[field] = 0.6 if ftype != "number" else 0.7
        else:
            confidence[field] = 0.0
    return {"fields": result, "confidence": confidence}


async def _extract_via_llm(md: str, fields: Dict[str, str], max_chars: int = 8000) -> Optional[Dict[str, Any]]:
    """LLM 结构化抽取通道:调用 llm_gateway 按 fields schema 抽结构化 JSON。

    对标 Firecrawl Extract 的真 LLM 抽取(非正则启发式)。规则:
    - 未配置任何 LLM key(stub 模式)或 llm_gateway 导入异常 → 返回 None(上层走启发式兜底)
    - LLM 成功返回合法 JSON 且至少抽到一个字段 → {fields, confidence}
    - 其余任何失败 → None, 由上层降级启发式, 绝不向调用方抛异常
    """
    try:
        from ..core.llm_gateway import llm_gateway
    except Exception:  # noqa: BLE001 - 循环导入/缺依赖时降级
        return None
    try:
        if llm_gateway._is_stub_mode():
            return None  # 无任何 LLM key → 不浪费一次网络, 直接启发式
    except Exception:  # noqa: BLE001
        return None

    field_lines = "\n".join("- {} ({})".format(k, v) for k, v in fields.items())
    system_prompt = (
        "你是结构化网页信息抽取器。根据给定的网页正文和字段 schema,抽取每个字段的值。\n"
        "要求:\n"
        "- 只输出一个 JSON 对象(不要任何解释文字、不要 markdown 代码围栏)\n"
        "- 对象键必须与字段名完全一致;值是该字段从正文中提取到的信息(字符串或数字)\n"
        "- 某字段正文中找不到时,把该键的值设为 null\n"
        "- 严禁捏造正文中不存在的信息\n"
        "字段 schema:\n{}".format(field_lines)
    )
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": "网页正文:\n{}\n\n请按上面字段 schema 抽取,只输出 JSON。".format(md[:max_chars])},
    ]
    try:
        result = await llm_gateway.complete(messages, model="auto")
        # 费用归属(2026-09-09 立):捕获本次 LLM 调用的 token usage/model 并随结果透出,
        # 使 extract_web 的 LLM 消耗可观测、可随工具结果进入 step recorder 记账链路。
        usage = result.get("usage") or {}
        model_used = str(result.get("model") or "")
        content = (result.get("content") or "").strip()
        if result.get("stub"):
            return None
        if not content:
            # token 可能已消耗(空回复),usage 必须保留
            return {"fields": {}, "confidence": {}, "usage": usage, "model": model_used}
        # 剥离可能包裹的 ```json ... ``` 围栏后解析
        content = re.sub(r"^```(?:json)?\s*", "", content)
        content = re.sub(r"\s*```$", "", content).strip()
        data = json.loads(content)
        if not isinstance(data, dict):
            return {"fields": {}, "confidence": {}, "usage": usage, "model": model_used}
        extracted: Dict[str, Any] = {}
        confidence: Dict[str, float] = {}
        for k in fields:
            if k in data and data[k] is not None:
                extracted[k] = data[k]
                confidence[k] = 0.95 if str(data[k]).strip() else 0.0
            else:
                confidence[k] = 0.0
        if not extracted:
            # token 已消耗但未命中字段:保留 usage,上层降级启发式时仍可见
            return {"fields": {}, "confidence": confidence, "usage": usage, "model": model_used}
        return {"fields": extracted, "confidence": confidence, "usage": usage, "model": model_used}
    except Exception:  # noqa: BLE001 - LLM 超时/解析失败/走查结构异常一律降级
        return None


async def extract_web(arguments: Dict[str, Any]) -> Dict[str, Any]:
    """按字段 schema 从网页抽取结构化数据(对标 Firecrawl Extract)。"""
    url = arguments.get("url", "")
    if not url or not isinstance(url, str):
        return _fail("extract_web", "缺少 url 参数", "MISSING_PARAMS")
    raw_fields = arguments.get("fields", "")
    if not raw_fields:
        return _fail("extract_web", "缺少 fields 参数(JSON 对象)", "MISSING_PARAMS")
    try:
        fields = json.loads(raw_fields) if isinstance(raw_fields, str) else raw_fields
        if not isinstance(fields, dict):
            return _fail("extract_web", "fields 必须是 JSON 对象", "INVALID_PARAMS")
        fields = {str(k): str(v) for k, v in fields.items()}
    except json.JSONDecodeError:
        return _fail("extract_web", "fields 不是合法 JSON", "INVALID_PARAMS")

    max_chars = _DEFAULT_MAX_CHARS
    raw_max = arguments.get("max_chars")
    if raw_max is not None:
        try:
            max_chars = int(raw_max)
        except (TypeError, ValueError):
            max_chars = _DEFAULT_MAX_CHARS
    max_chars = max(500, min(_MAX_MAX_CHARS, max_chars))

    ssrf_reason = _validate_ssrf(url)
    if ssrf_reason:
        return _fail("extract_web", ssrf_reason, "SSRF_BLOCKED")
    if not _HTTPX_OK:
        return _fail("extract_web", "httpx 未安装, 无法抓取网页", "DEP_MISSING")

    page = await _http_get_html(url)
    if page is None:
        return _fail("extract_web", "抓取失败或目标非 HTML 页面", "FETCH_FAILED")

    try:
        md = _readability_to_markdown(page["html"], base_url=page["final_url"])
    except Exception as e:  # noqa: BLE001
        return _fail("extract_web", "正文提取失败: {}".format(e), "EXTRACT_FAILED")

    llm_result = await _extract_via_llm(md, fields, max_chars)
    if llm_result is not None and llm_result.get("fields"):
        return {
            "tool": "extract_web",
            "ok": True,
            "url": page["final_url"],
            "source": "llm",
            "fields": llm_result.get("fields", {}),
            "confidence": llm_result.get("confidence", {}),
            "llm_usage": llm_result.get("usage", {}),
            "llm_model": llm_result.get("model", ""),
            "message": "LLM 结构化抽取完成",
        }

    heur = _extract_heuristic(md, fields)
    found = heur["fields"]
    out: Dict[str, Any] = {
        "tool": "extract_web",
        "ok": len(found) > 0,
        "url": page["final_url"],
        "source": "heuristic",
        "fields": found,
        "confidence": heur["confidence"],
        "message": "启发式抽取 {} 个字段".format(len(found)),
    }
    # 费用可见性(2026-09-09 立):LLM 已消耗 token 但未命中字段而降级时,
    # usage 同样随结果透出并标记 llm_fallback —— 花了的钱不允许凭空消失。
    if llm_result is not None and llm_result.get("usage"):
        out["llm_usage"] = llm_result["usage"]
        out["llm_model"] = llm_result.get("model", "")
        out["llm_fallback"] = True
        out["message"] = "LLM 未命中字段, 降级启发式抽取 {} 个字段".format(len(found))
    return out