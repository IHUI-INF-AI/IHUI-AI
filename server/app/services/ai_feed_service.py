"""AI 动态/资讯聚合服务层.

对标 insprira(灵感熔炉)的核心能力, 但完全自研, 零付费 API 依赖:
  - 采集: DailyHotApi(40+平台) + RSSHub(AI媒体) + arXiv/HF Papers/Hacker News 官方 API
  - 趋势: pandas EMA 平滑 + pct_change, 输出 rising/stable/cooling/new 四态
  - 智能: DeepSeek-V3 批处理分类 + 摘要(批处理降本 10 倍+)

设计原则:
  - 函数式(与项目现有 service 风格一致), 同步 + 异步混合
  - 采集用 asyncio + httpx 并发, 趋势/LLM 用同步(被 scheduler await 调用)
  - Redis 缓存采集结果 + 分布式锁(避免重复抓取)
  - 所有外部调用 tenacity 重试 + 超时 + 降级(失败不阻塞其他源)
  - 日志用 logger, 不用 print
"""
import asyncio
import json
import logging
from datetime import date, datetime, timedelta
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 配置常量
# ---------------------------------------------------------------------------
_TIMEOUT = httpx.Timeout(15.0, connect=10.0)
_HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; IHUI-AI-FeedBot/1.0)",
    "Accept": "application/json, application/atom+xml, application/rss+xml, */*",
}

# 趋势标签
TREND_RISING = "rising"
TREND_STABLE = "stable"
TREND_COOLING = "cooling"
TREND_NEW = "new"

# LLM 分类体系(对标 insprira)
LLM_CATEGORIES = ["hotspot", "account", "source", "creation", "analysis", "retrieval", "tool"]


# ===========================================================================
# 1. 采集层 — 三类数据源统一入口
# ===========================================================================
async def fetch_all_sources() -> dict[str, Any]:
    """并发采集所有 enabled 数据源, 返回 {source_code: [items]}.

    每个 item 结构: {id, title, url, cover_url, author, hot, rank, publish_time, summary}
    失败的源返回空列表, 不影响其他源.
    """
    from app.database import get_session
    from app.models.ai_feed_models import AiFeedSource

    from types import SimpleNamespace

    sources: list[SimpleNamespace] = []
    with get_session() as db:
        rows = (
            db.query(AiFeedSource)
            .filter(AiFeedSource.enabled == True)  # noqa: E712
            .order_by(AiFeedSource.sort_order)
            .all()
        )
        # 在 session 内提取属性为轻量 namespace, 避免 DetachedInstanceError
        for r in rows:
            sources.append(SimpleNamespace(
                source_code=r.source_code,
                source_name=r.source_name,
                source_type=r.source_type,
                endpoint=r.endpoint,
                category=r.category,
                color=r.color,
            ))

    if not sources:
        logger.warning("ai_feed: no enabled sources found")
        return {}

    semaphore = asyncio.Semaphore(settings.AI_FEED_FETCH_CONCURRENCY)
    results: dict[str, Any] = {}

    async def _fetch_one(src: SimpleNamespace) -> None:
        async with semaphore:
            try:
                items = await _fetch_by_type(src)
                results[src.source_code] = items
                _update_source_status(src.source_code, "success", len(items))
            except Exception as e:
                logger.warning(f"ai_feed: fetch {src.source_code} failed: {e}")
                results[src.source_code] = []
                _update_source_status(src.source_code, "failed", 0)

    await asyncio.gather(*[_fetch_one(s) for s in sources])
    total = sum(len(v) for v in results.values())
    logger.info(f"ai_feed: fetched {total} items from {len(results)} sources")
    return results


async def _fetch_by_type(src) -> list[dict]:
    """根据 source_type 分发到对应采集器."""
    if src.source_type == "hotlist":
        return await _fetch_dailyhot(src)
    elif src.source_type == "rss":
        return await _fetch_rsshub(src)
    elif src.source_type == "api":
        return await _fetch_official_api(src)
    elif src.source_type == "native":
        return await _fetch_native(src)
    else:
        logger.warning(f"ai_feed: unknown source_type {src.source_type} for {src.source_code}")
        return []


async def _fetch_dailyhot(src) -> list[dict]:
    """从 DailyHotApi 拉取平台热榜. endpoint 是平台码(如 weibo/zhihu/bilibili)."""
    base = (settings.DAILYHOT_API_URL or "").rstrip("/")
    if not base:
        logger.debug(f"ai_feed: DAILYHOT_API_URL empty, skip {src.source_code}")
        return []
    url = f"{base}/{src.endpoint}"
    async with httpx.AsyncClient(timeout=_TIMEOUT, headers=_HEADERS) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()

    # DailyHotApi 返回 {code: 200, data: [{...}]}
    raw_items = data.get("data") or data.get("items") or []
    items: list[dict] = []
    for i, raw in enumerate(raw_items[: settings.AI_FEED_TOP_N]):
        items.append(
            {
                "id": str(raw.get("id") or raw.get("short_id") or f"{src.source_code}-{i}"),
                "title": (raw.get("title") or "").strip(),
                "url": raw.get("url") or raw.get("mobileUrl") or "",
                "cover_url": raw.get("cover") or raw.get("img") or raw.get("image") or "",
                "author": raw.get("author") or raw.get("nickname") or "",
                "hot": _parse_hot(raw.get("hot") or raw.get("hotScore") or 0),
                "rank": i + 1,
                "publish_time": None,
                "summary": (raw.get("desc") or raw.get("description") or "").strip(),
            }
        )
    return items


async def _fetch_rsshub(src) -> list[dict]:
    """从 RSSHub 拉取 RSS feed, 用 feedparser 解析. endpoint 是路由路径(如 jiqizhixin/news)."""
    base = (settings.RSSHUB_URL or "").rstrip("/")
    if not base:
        logger.debug(f"ai_feed: RSSHUB_URL empty, skip {src.source_code}")
        return []
    url = f"{base}/{src.endpoint.lstrip('/')}"
    async with httpx.AsyncClient(timeout=_TIMEOUT, headers=_HEADERS) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        content = resp.content

    try:
        import feedparser  # 延迟导入, 避免未安装时模块加载失败
    except ImportError:
        logger.error("ai_feed: feedparser not installed, run: pip install feedparser")
        return []

    parsed = feedparser.parse(content)
    items: list[dict] = []
    for i, entry in enumerate(parsed.entries[: settings.AI_FEED_TOP_N]):
        # 提取封面图(media:content 或 enclosure)
        cover = ""
        if hasattr(entry, "media_content") and entry.media_content:
            cover = entry.media_content[0].get("url", "")
        elif hasattr(entry, "media_thumbnail") and entry.media_thumbnail:
            cover = entry.media_thumbnail[0].get("url", "")
        elif hasattr(entry, "enclosures") and entry.enclosures:
            cover = entry.enclosures[0].get("href", "")

        pub_time = None
        if hasattr(entry, "published_parsed") and entry.published_parsed:
            try:
                pub_time = datetime(*entry.published_parsed[:6])
            except Exception:
                pub_time = None

        items.append(
            {
                "id": str(entry.get("id") or entry.get("link") or f"{src.source_code}-{i}"),
                "title": (entry.get("title") or "").strip(),
                "url": entry.get("link") or "",
                "cover_url": cover,
                "author": (entry.get("author") or "").strip(),
                "hot": 0,  # RSS 无热度值, 按时间排序
                "rank": i + 1,
                "publish_time": pub_time,
                "summary": _strip_html(entry.get("summary") or entry.get("description") or "")[:300],
            }
        )
    return items


async def _fetch_official_api(src) -> list[dict]:
    """官方 API 直连: arXiv / Hugging Face Papers / Hacker News. endpoint 格式 'provider:resource'."""
    endpoint = src.endpoint or ""
    if endpoint.startswith("arxiv:"):
        return await _fetch_arxiv(endpoint[6:])
    elif endpoint.startswith("huggingface:"):
        return await _fetch_hf_papers()
    elif endpoint.startswith("hn:"):
        return await _fetch_hackernews(endpoint[3:])
    else:
        logger.warning(f"ai_feed: unknown api endpoint {endpoint}")
        return []


async def _fetch_native(src) -> list[dict]:
    """原生直连采集器: 直接调用平台 API, 不依赖 DailyHotApi/RSSHub.

    endpoint 值决定使用哪个采集器: bilibili / 36kr / toutiao / ithome / baidu / weibo / zhihu
    """
    ep = (src.endpoint or "").strip()
    if ep == "bilibili":
        return await _native_bilibili()
    elif ep == "36kr":
        return await _native_36kr()
    elif ep == "toutiao":
        return await _native_toutiao()
    elif ep == "ithome":
        return await _native_ithome()
    elif ep == "baidu":
        return await _native_baidu()
    elif ep == "weibo":
        return await _native_weibo()
    elif ep == "zhihu":
        return await _native_zhihu()
    elif ep == "douyin":
        return await _native_douyin()
    elif ep == "ithome-ai-rss":
        return await _native_ithome_rss()
    else:
        logger.warning(f"ai_feed: unknown native endpoint {ep}")
        return []


# 浏览器级别请求头, 模拟真实用户访问
_BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/html, */*",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Referer": "",
}


async def _native_bilibili() -> list[dict]:
    """B站综合热门排行榜. 免费, 无需 Cookie."""
    url = "https://api.bilibili.com/x/web-interface/ranking/v2?rid=0&type=all"
    headers = {**_BROWSER_HEADERS, "Referer": "https://www.bilibili.com/"}
    async with httpx.AsyncClient(timeout=_TIMEOUT, headers=headers, follow_redirects=True) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()

    raw_items = data.get("data", {}).get("list", [])
    items: list[dict] = []
    for i, v in enumerate(raw_items[: settings.AI_FEED_TOP_N]):
        items.append({
            "id": str(v.get("bvid") or v.get("aid") or f"bili-{i}"),
            "title": (v.get("title") or "").strip(),
            "url": f"https://www.bilibili.com/video/{v.get('bvid', '')}" if v.get("bvid") else "",
            "cover_url": v.get("pic") or "",
            "author": (v.get("owner", {}).get("name") or "") if isinstance(v.get("owner"), dict) else "",
            "hot": _parse_hot(v.get("score") or v.get("stat", {}).get("view", 0) if isinstance(v.get("stat"), dict) else 0),
            "rank": i + 1,
            "publish_time": None,
            "summary": (v.get("desc") or "")[:200],
        })
    return items


async def _native_36kr() -> list[dict]:
    """36氪热榜. 免费, 返回 JSON."""
    url = "https://gateway.36kr.com/api/mis/nav/home/nav/rank/hot"
    headers = {**_BROWSER_HEADERS, "Content-Type": "application/json"}
    async with httpx.AsyncClient(timeout=_TIMEOUT, headers=headers, follow_redirects=True) as client:
        resp = await client.post(url, json={"partner_id": "wap", "param": {"siteId": 1, "platformId": 2}})
        resp.raise_for_status()
        data = resp.json()

    raw_items = (data.get("data") or {}).get("hotRankList", []) or []
    if not raw_items:
        raw_items = (data.get("data") or {}).get("items", []) or []
    items: list[dict] = []
    for i, v in enumerate(raw_items[: settings.AI_FEED_TOP_N]):
        item_data = v.get("item") or v
        items.append({
            "id": str(item_data.get("itemId") or item_data.get("entityId") or f"36kr-{i}"),
            "title": (item_data.get("widgetTitle") or item_data.get("title") or "").strip(),
            "url": item_data.get("entityUrl") or item_data.get("url") or "",
            "cover_url": item_data.get("coverImage") or item_data.get("widgetImage") or "",
            "author": (item_data.get("authorName") or item_data.get("author") or ""),
            "hot": _parse_hot(v.get("rankScore") or item_data.get("readNum", 0)),
            "rank": i + 1,
            "publish_time": None,
            "summary": (item_data.get("summary") or item_data.get("widgetContent") or "")[:200],
        })
    return items


async def _native_toutiao() -> list[dict]:
    """今日头条热榜. 免费, 返回 JSON."""
    url = "https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc"
    headers = {**_BROWSER_HEADERS, "Referer": "https://www.toutiao.com/"}
    async with httpx.AsyncClient(timeout=_TIMEOUT, headers=headers, follow_redirects=True) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()

    raw_items = data.get("data", [])
    items: list[dict] = []
    for i, v in enumerate(raw_items[: settings.AI_FEED_TOP_N]):
        # cover 可能是 dict 或 string
        cover = v.get("Image") or v.get("image") or ""
        if isinstance(cover, dict):
            cover = cover.get("url") or ""
        elif not isinstance(cover, str):
            cover = str(cover) if cover else ""
        items.append({
            "id": str(v.get("ClusterId") or v.get("cluster_id") or f"tt-{i}"),
            "title": (v.get("Title") or v.get("title") or "").strip(),
            "url": v.get("Url") or v.get("url") or "",
            "cover_url": cover,
            "author": "",
            "hot": _parse_hot(v.get("HotValue") or v.get("hot_value") or 0),
            "rank": i + 1,
            "publish_time": None,
            "summary": "",
        })
    return items


async def _native_ithome() -> list[dict]:
    """IT之家热榜. 免费, 返回 JSON."""
    url = "https://m.ithome.com/rankm/"
    headers = {**_BROWSER_HEADERS, "Referer": "https://m.ithome.com/"}
    async with httpx.AsyncClient(timeout=_TIMEOUT, headers=headers, follow_redirects=True) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        text = resp.text

    # IT之家热榜是 HTML, 需要正则解析
    import re
    items: list[dict] = []
    # 匹配热榜条目
    pattern = r'<a[^>]*href="([^"]*)"[^>]*>.*?<span[^>]*>(\d+)</span>.*?<p[^>]*>(.*?)</p>'
    matches = re.findall(pattern, text, re.DOTALL)
    for i, (url_href, rank, title) in enumerate(matches[: settings.AI_FEED_TOP_N]):
        clean_title = re.sub(r'<[^>]+>', '', title).strip()
        items.append({
            "id": f"ithome-{i}",
            "title": clean_title,
            "url": url_href if url_href.startswith("http") else f"https://m.ithome.com{url_href}",
            "cover_url": "",
            "author": "IT之家",
            "hot": _parse_hot(rank),
            "rank": i + 1,
            "publish_time": None,
            "summary": "",
        })
    return items


async def _native_ithome_rss() -> list[dict]:
    """IT之家 RSS feed. 免费 XML."""
    url = "https://www.ithome.com/rss/"
    headers = {**_BROWSER_HEADERS, "Referer": "https://www.ithome.com/"}
    async with httpx.AsyncClient(timeout=_TIMEOUT, headers=headers, follow_redirects=True) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        content = resp.content

    try:
        import feedparser
    except ImportError:
        return []

    parsed = feedparser.parse(content)
    items: list[dict] = []
    for i, entry in enumerate(parsed.entries[: settings.AI_FEED_TOP_N]):
        pub_time = None
        if hasattr(entry, "published_parsed") and entry.published_parsed:
            try:
                pub_time = datetime(*entry.published_parsed[:6])
            except Exception:
                pass
        items.append({
            "id": str(entry.get("id") or f"ithome-rss-{i}"),
            "title": (entry.get("title") or "").strip(),
            "url": entry.get("link") or "",
            "cover_url": "",
            "author": "IT之家",
            "hot": 0,
            "rank": i + 1,
            "publish_time": pub_time,
            "summary": _strip_html(entry.get("summary") or "")[:200],
        })
    return items


async def _native_baidu() -> list[dict]:
    """百度热搜榜. 免费, 返回 JSON."""
    url = "https://top.baidu.com/api/board?platform=wise&tab=realtime"
    headers = {**_BROWSER_HEADERS, "Referer": "https://top.baidu.com/", "Accept": "application/json"}
    async with httpx.AsyncClient(timeout=_TIMEOUT, headers=headers, follow_redirects=True) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()

    raw_items = (data.get("data") or {}).get("cards", [{}])[0].get("content", [])
    items: list[dict] = []
    for i, v in enumerate(raw_items[: settings.AI_FEED_TOP_N]):
        items.append({
            "id": str(v.get("query") or v.get("word") or f"baidu-{i}"),
            "title": (v.get("word") or v.get("query") or "").strip(),
            "url": v.get("url") or v.get("rawUrl") or f"https://www.baidu.com/s?wd={v.get('word', '')}",
            "cover_url": v.get("img") or "",
            "author": "",
            "hot": _parse_hot(v.get("hotScore") or v.get("hot") or 0),
            "rank": i + 1,
            "publish_time": None,
            "summary": (v.get("desc") or "")[:200],
        })
    return items


async def _native_weibo() -> list[dict]:
    """微博热搜. 需要 Cookie, 尝试无 Cookie 访问移动端 API."""
    url = "https://weibo.com/ajax/side/hotSearch"
    headers = {**_BROWSER_HEADERS, "Referer": "https://weibo.com/", "Cookie": ""}
    async with httpx.AsyncClient(timeout=_TIMEOUT, headers=headers, follow_redirects=True) as client:
        resp = await client.get(url)
        if resp.status_code != 200:
            logger.debug(f"ai_feed: weibo returned {resp.status_code}, skipping")
            return []
        data = resp.json()

    raw_items = data.get("data", {}).get("realtime", [])
    items: list[dict] = []
    for i, v in enumerate(raw_items[: settings.AI_FEED_TOP_N]):
        items.append({
            "id": str(v.get("mid") or f"weibo-{i}"),
            "title": (v.get("note") or v.get("word") or "").strip(),
            "url": f"https://s.weibo.com/weibo?q=%23{v.get('word', '')}%23" if v.get("word") else "",
            "cover_url": v.get("pic") or "",
            "author": "",
            "hot": _parse_hot(v.get("num") or v.get("raw_hot") or 0),
            "rank": i + 1,
            "publish_time": None,
            "summary": "",
        })
    return items


async def _native_zhihu() -> list[dict]:
    """知乎热榜. 需要 Cookie, 尝试访问."""
    url = "https://www.zhihu.com/api/v3/feed/topstory/hot-lists/total?limit=30"
    headers = {**_BROWSER_HEADERS, "Referer": "https://www.zhihu.com/hot"}
    async with httpx.AsyncClient(timeout=_TIMEOUT, headers=headers, follow_redirects=True) as client:
        resp = await client.get(url)
        if resp.status_code != 200:
            logger.debug(f"ai_feed: zhihu returned {resp.status_code}, skipping")
            return []
        data = resp.json()

    raw_items = data.get("data", [])
    items: list[dict] = []
    for i, v in enumerate(raw_items[: settings.AI_FEED_TOP_N]):
        target = v.get("target", {})
        items.append({
            "id": str(target.get("id") or f"zhihu-{i}"),
            "title": (target.get("title") or "").strip(),
            "url": target.get("url") or f"https://www.zhihu.com/question/{target.get('id', '')}",
            "cover_url": target.get("thumbnail") or "",
            "author": (target.get("author", {}).get("name") or "") if isinstance(target.get("author"), dict) else "",
            "hot": _parse_hot(v.get("detail_text") or "0"),
            "rank": i + 1,
            "publish_time": None,
            "summary": (target.get("excerpt") or "")[:200],
        })
    return items


async def _native_douyin() -> list[dict]:
    """抖音热榜. 需要 Cookie, 尝试访问."""
    url = "https://www.iesdouyin.com/aweme/v1/web/hot/search/list/"
    headers = {**_BROWSER_HEADERS, "Referer": "https://www.douyin.com/"}
    async with httpx.AsyncClient(timeout=_TIMEOUT, headers=headers, follow_redirects=True) as client:
        resp = await client.get(url)
        if resp.status_code != 200:
            logger.debug(f"ai_feed: douyin returned {resp.status_code}, skipping")
            return []
        data = resp.json()

    raw_items = (data.get("data") or {}).get("word_list", [])
    items: list[dict] = []
    for i, v in enumerate(raw_items[: settings.AI_FEED_TOP_N]):
        items.append({
            "id": str(v.get("sentence_id") or f"douyin-{i}"),
            "title": (v.get("word") or "").strip(),
            "url": f"https://www.douyin.com/search/{v.get('word', '')}",
            "cover_url": "",
            "author": "",
            "hot": _parse_hot(v.get("hot_value") or 0),
            "rank": i + 1,
            "publish_time": None,
            "summary": "",
        })
    return items


async def _fetch_arxiv(category: str = "cs.AI") -> list[dict]:
    """arXiv API: 返回 Atom XML, 解析为统一 item. 免费, 无需 Key."""
    url = f"https://export.arxiv.org/api/query?search_query=cat:{category}&start=0&max_results={settings.AI_FEED_TOP_N}&sortBy=submittedDate&sortOrder=descending"
    async with httpx.AsyncClient(timeout=_TIMEOUT, headers=_HEADERS, follow_redirects=True) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        content = resp.content

    try:
        import feedparser
    except ImportError:
        return []

    parsed = feedparser.parse(content)
    items: list[dict] = []
    for i, entry in enumerate(parsed.entries):
        pub_time = None
        if hasattr(entry, "published_parsed") and entry.published_parsed:
            try:
                pub_time = datetime(*entry.published_parsed[:6])
            except Exception:
                pub_time = None
        # arXiv 摘要可能很长, 截断
        summary = _strip_html(entry.get("summary") or "")[:300]
        items.append(
            {
                "id": entry.get("id", f"arxiv-{i}").split("/")[-1],
                "title": _clean_arxiv_title(entry.get("title") or ""),
                "url": entry.get("link", ""),
                "cover_url": "",
                "author": ", ".join([a.get("name", "") for a in entry.get("authors", [])][:3]),
                "hot": 0,
                "rank": i + 1,
                "publish_time": pub_time,
                "summary": summary,
            }
        )
    return items


async def _fetch_hf_papers() -> list[dict]:
    """Hugging Face Daily Papers API. 免费, 可匿名."""
    url = "https://huggingface.co/api/daily_papers"
    async with httpx.AsyncClient(timeout=_TIMEOUT, headers=_HEADERS, follow_redirects=True) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        data = resp.json()

    items: list[dict] = []
    # data 可能是 list 或 {papers: [...]}
    papers = data if isinstance(data, list) else data.get("papers", data.get("data", []))
    for i, p in enumerate(papers[: settings.AI_FEED_TOP_N]):
        paper = p.get("paper") if isinstance(p, dict) and "paper" in p else p
        title = paper.get("title", "")
        paper_id = paper.get("id", f"hf-{i}")
        pub_time = None
        try:
            pub_time = datetime.fromisoformat(paper.get("publishedAt", "").replace("Z", "+00:00"))
        except Exception:
            pub_time = None
        items.append(
            {
                "id": str(paper_id),
                "title": title.strip(),
                "url": f"https://huggingface.co/papers/{paper_id}",
                "cover_url": "",
                "author": ", ".join([a.get("name", "") for a in paper.get("authors", [])][:3]),
                "hot": paper.get("upvotes", 0),
                "rank": i + 1,
                "publish_time": pub_time,
                "summary": (paper.get("summary") or "")[:300],
            }
        )
    return items


async def _fetch_hackernews(kind: str = "top") -> list[dict]:
    """Hacker News Firebase API. 免费, 无需 Key. kind: top/new/best."""
    kind_map = {"top": "topstories", "new": "newstories", "best": "beststories"}
    stories_key = kind_map.get(kind, "topstories")
    async with httpx.AsyncClient(timeout=_TIMEOUT, headers=_HEADERS) as client:
        resp = await client.get(f"https://hacker-news.firebaseio.com/v0/{stories_key}.json")
        resp.raise_for_status()
        ids = resp.json()[: settings.AI_FEED_TOP_N]

        # 并发获取每个 story 详情
        semaphore = asyncio.Semaphore(10)

        async def _get_one(story_id: int) -> dict | None:
            async with semaphore:
                try:
                    r = await client.get(f"https://hacker-news.firebaseio.com/v0/item/{story_id}.json")
                    r.raise_for_status()
                    return r.json()
                except Exception:
                    return None

        stories = await asyncio.gather(*[_get_one(i) for i in ids])
        stories = [s for s in stories if s and s.get("title")]

    items: list[dict] = []
    for i, s in enumerate(stories):
        pub_time = None
        if s.get("time"):
            pub_time = datetime.fromtimestamp(s["time"])
        items.append(
            {
                "id": str(s.get("id")),
                "title": s.get("title", "").strip(),
                "url": s.get("url") or f"https://news.ycombinator.com/item?id={s.get('id')}",
                "cover_url": "",
                "author": s.get("by", ""),
                "hot": s.get("score", 0),
                "rank": i + 1,
                "publish_time": pub_time,
                "summary": "",
            }
        )
    return items


# ===========================================================================
# 2. 持久化层 — 条目去重入库 + 每日快照
# ===========================================================================
def persist_items(source_code: str, items: list[dict]) -> int:
    """将采集的 items 去重写入 ai_feed_hot_item + ai_feed_snapshot. 返回新增/更新条数."""
    from app.database import get_session
    from app.models.ai_feed_models import AiFeedHotItem, AiFeedSnapshot

    if not items:
        return 0

    today = date.today()
    now = datetime.utcnow()
    count = 0

    with get_session() as db:
        for item in items:
            platform_id = item["id"]
            if not platform_id:
                continue

            # 类型安全: 确保 cover_url/author/summary 是字符串
            cover_url = item.get("cover_url") or ""
            if not isinstance(cover_url, str):
                cover_url = cover_url.get("url", "") if isinstance(cover_url, dict) else str(cover_url)
            author = item.get("author") or ""
            if not isinstance(author, str):
                author = str(author)
            summary = item.get("summary") or ""
            if not isinstance(summary, str):
                summary = str(summary)

            # 查找已有条目
            existing = (
                db.query(AiFeedHotItem)
                .filter(
                    AiFeedHotItem.source_code == source_code,
                    AiFeedHotItem.platform_item_id == platform_id,
                )
                .first()
            )

            if existing:
                # 更新最新热度/排名/标题(标题可能变)
                existing.title = item["title"] or existing.title
                existing.url = item.get("url") or existing.url
                existing.cover_url = cover_url or existing.cover_url
                existing.author = author or existing.author
                existing.current_rank = item.get("rank")
                existing.current_hot = item.get("hot")
                existing.last_seen_at = now
                if item.get("publish_time"):
                    existing.publish_time = item["publish_time"]
                if summary and not existing.summary:
                    existing.summary = summary
                item_id = existing.id
            else:
                # 新建条目
                new_item = AiFeedHotItem(
                    source_code=source_code,
                    platform_item_id=platform_id,
                    title=item["title"],
                    summary=summary,
                    url=item.get("url"),
                    cover_url=cover_url,
                    author=author,
                    current_rank=item.get("rank"),
                    current_hot=item.get("hot"),
                    publish_time=item.get("publish_time"),
                    first_seen_at=now,
                    last_seen_at=now,
                    trend_tag=TREND_NEW,  # 新条目标记 new
                )
                db.add(new_item)
                db.flush()
                item_id = new_item.id

            # 写入今日快照(幂等: 同一 (source, pid, date) 只写一次)
            existing_snap = (
                db.query(AiFeedSnapshot)
                .filter(
                    AiFeedSnapshot.source_code == source_code,
                    AiFeedSnapshot.platform_item_id == platform_id,
                    AiFeedSnapshot.snapshot_date == today,
                )
                .first()
            )
            if not existing_snap:
                snap = AiFeedSnapshot(
                    source_code=source_code,
                    platform_item_id=platform_id,
                    item_id=item_id,
                    title=item["title"],
                    rank=item.get("rank"),
                    hot_value=item.get("hot"),
                    snapshot_date=today,
                    captured_at=now,
                )
                db.add(snap)
            count += 1

        db.commit()
    return count


def _update_source_status(source_code: str, status: str, count: int) -> None:
    """更新数据源采集状态(非关键, 失败静默)."""
    try:
        from app.database import get_session
        from app.models.ai_feed_models import AiFeedSource

        with get_session() as db:
            src = db.query(AiFeedSource).filter(AiFeedSource.source_code == source_code).first()
            if src:
                src.last_fetch_at = datetime.utcnow()
                src.last_fetch_status = status
                src.last_fetch_count = count
                db.commit()
    except Exception as e:
        logger.debug(f"ai_feed: update source status failed: {e}")


# ===========================================================================
# 3. 趋势计算层 — pandas EMA + pct_change
# ===========================================================================
def compute_trend_signals() -> int:
    """计算所有条目的 7/14 天趋势信号, 写入 ai_feed_trend_signal. 返回处理条目数.

    算法:
      1. 取每个条目最近 N+3 天的快照(N=窗口)
      2. 用 EMA(span=settings.AI_FEED_EMA_SPAN) 平滑 hot_value
      3. growth_pct = (ema_today - ema_n_days_ago) / ema_n_days_ago * 100
      4. rank_delta = rank_n_days_ago - rank_today(正=上升)
      5. 标签: growth > RISING_PCT 且 rank_delta > 0 → rising
              growth < COOLING_PCT 或 rank_delta < -5 → cooling
              snapshot_count < N/2 → new(数据不足)
              其余 → stable
    """
    try:
        import pandas as pd
    except ImportError:
        logger.error("ai_feed: pandas not installed")
        return 0

    from app.database import get_session
    from app.models.ai_feed_models import AiFeedHotItem, AiFeedSnapshot, AiFeedTrendSignal

    windows = [int(w.strip()) for w in settings.AI_FEED_TREND_WINDOWS.split(",") if w.strip()]
    ema_span = settings.AI_FEED_EMA_SPAN
    rising_pct = settings.AI_FEED_TREND_RISING_PCT
    cooling_pct = settings.AI_FEED_TREND_COOLING_PCT
    max_window = max(windows) if windows else 14
    today = date.today()
    since_date = today - timedelta(days=max_window + ema_span + 2)

    with get_session() as db:
        # 取最近 N 天所有快照
        snapshots = (
            db.query(AiFeedSnapshot)
            .filter(AiFeedSnapshot.snapshot_date >= since_date)
            .order_by(AiFeedSnapshot.platform_item_id, AiFeedSnapshot.snapshot_date)
            .all()
        )

        if not snapshots:
            logger.info("ai_feed: no snapshots for trend computation")
            return 0

        # 转 DataFrame
        rows = [
            {
                "item_id": s.item_id,
                "source_code": s.source_code,
                "platform_item_id": s.platform_item_id,
                "snapshot_date": s.snapshot_date,
                "rank": s.rank,
                "hot_value": int(s.hot_value or 0),
            }
            for s in snapshots
            if s.item_id is not None
        ]
        df = pd.DataFrame(rows)
        if df.empty:
            return 0

        now = datetime.utcnow()
        processed = 0

        # 按 item_id 分组计算
        for (item_id, src_code, pid), group in df.groupby(["item_id", "source_code", "platform_item_id"]):
            group = group.sort_values("snapshot_date").reset_index(drop=True)
            if len(group) < 2:
                continue

            # EMA 平滑热度
            group["ema_hot"] = group["hot_value"].ewm(span=ema_span, adjust=False).mean()

            for window in windows:
                if len(group) < 2:
                    continue

                # 取 window 天前的快照(最近的那条作为 today)
                today_row = group.iloc[-1]
                target_date = today_row["snapshot_date"] - timedelta(days=window)
                then_rows = group[group["snapshot_date"] <= target_date]
                if then_rows.empty:
                    # window 天内首次出现 → new
                    tag = TREND_NEW
                    growth_pct = None
                    rank_delta = None
                    ema_now = int(today_row["ema_hot"])
                    hot_then = None
                    snap_count = len(group)
                else:
                    then_row = then_rows.iloc[-1]
                    ema_now = float(today_row["ema_hot"])
                    ema_then = float(then_row["ema_hot"])
                    if ema_then > 0:
                        growth_pct = (ema_now - ema_then) / ema_then * 100
                    else:
                        growth_pct = 100.0 if ema_now > 0 else 0.0
                    rank_delta = (then_row["rank"] or 0) - (today_row["rank"] or 0)
                    snap_count = len(group)

                    # 趋势标签
                    if snap_count < max(2, window // 2):
                        tag = TREND_NEW
                    elif growth_pct > rising_pct and rank_delta >= 0:
                        tag = TREND_RISING
                    elif growth_pct < cooling_pct or rank_delta < -5:
                        tag = TREND_COOLING
                    else:
                        tag = TREND_STABLE

                    hot_then = int(ema_then)
                    ema_now = int(ema_now)

                # upsert 趋势信号
                sig = (
                    db.query(AiFeedTrendSignal)
                    .filter(
                        AiFeedTrendSignal.item_id == item_id,
                        AiFeedTrendSignal.window_days == window,
                    )
                    .first()
                )
                if sig:
                    sig.growth_pct = growth_pct
                    sig.rank_delta = rank_delta
                    sig.ema_hot = ema_now
                    sig.hot_then = hot_then
                    sig.trend_tag = tag
                    sig.computed_at = now
                    sig.snapshot_count = snap_count
                else:
                    db.add(
                        AiFeedTrendSignal(
                            item_id=item_id,
                            source_code=src_code,
                            platform_item_id=pid,
                            window_days=window,
                            growth_pct=growth_pct,
                            rank_delta=rank_delta,
                            ema_hot=ema_now,
                            hot_then=hot_then,
                            trend_tag=tag,
                            computed_at=now,
                            snapshot_count=snap_count,
                        )
                    )

            # 同步 7 天趋势到 hot_item(便于列表快速筛选)
            sig7 = (
                db.query(AiFeedTrendSignal)
                .filter(
                    AiFeedTrendSignal.item_id == item_id,
                    AiFeedTrendSignal.window_days == 7,
                )
                .first()
            )
            item = db.query(AiFeedHotItem).filter(AiFeedHotItem.id == item_id).first()
            if item and sig7:
                item.trend_tag = sig7.trend_tag
                item.trend_growth_pct = sig7.growth_pct
                # new 标签 3 天后自动失效为 stable
                if item.trend_tag == TREND_NEW and item.first_seen_at < (now - timedelta(days=3)):
                    item.trend_tag = TREND_STABLE
                    sig7.trend_tag = TREND_STABLE

            processed += 1

        db.commit()
        logger.info(f"ai_feed: computed trends for {processed} items")
        return processed


# ===========================================================================
# 4. LLM 分类与摘要层 — DeepSeek-V3 批处理
# ===========================================================================
async def process_llm_batch(limit: int = 100) -> int:
    """对未处理或过期的条目批量生成 LLM 分类 + 摘要. 返回处理条目数.

    批处理降本: 把 BATCH_SIZE 条拼一个 prompt, 一次性返回 JSON 数组.
    模型: DeepSeek-V3(经 openai SDK, base_url 指向 DeepSeek), 性价比最优.
    失败降级: 跳过本批, 记日志, 不阻塞.
    """
    from app.utils.ai_keys import deepseek_key

    api_key = deepseek_key()
    if not api_key:
        logger.info("ai_feed: DEEPSEEK_API_KEY not configured, skip LLM processing")
        return 0

    from app.database import get_session
    from app.models.ai_feed_models import AiFeedHotItem

    # 取未处理的条目(llm_processed_at 为空 或 超过 7 天)
    cutoff = datetime.utcnow() - timedelta(days=7)
    with get_session() as db:
        items = (
            db.query(AiFeedHotItem)
            .filter(
                (AiFeedHotItem.llm_processed_at == None)  # noqa: E711
                | (AiFeedHotItem.llm_processed_at < cutoff)
            )
            .order_by(AiFeedHotItem.current_hot.desc().nullslast())
            .limit(limit)
            .all()
        )
        if not items:
            return 0

        # 转为可序列化(避免 session 关闭后访问)
        item_data = [
            {"id": it.id, "title": it.title, "summary": (it.summary or "")[:200]}
            for it in items
        ]

    # 批处理
    batch_size = settings.AI_FEED_LLM_BATCH_SIZE
    total_processed = 0
    for i in range(0, len(item_data), batch_size):
        batch = item_data[i : i + batch_size]
        try:
            results = await _call_llm_for_batch(api_key, batch)
            _apply_llm_results(results)
            total_processed += len(batch)
        except Exception as e:
            logger.warning(f"ai_feed: LLM batch {i//batch_size} failed: {e}")

    logger.info(f"ai_feed: LLM processed {total_processed} items")
    return total_processed


async def _call_llm_for_batch(api_key: str, batch: list[dict]) -> list[dict]:
    """调用 DeepSeek-V3 对一批条目生成分类+摘要. 返回 [{id, category, tags, summary}]."""
    try:
        from openai import AsyncOpenAI
    except ImportError:
        logger.error("ai_feed: openai SDK not installed")
        return []

    client = AsyncOpenAI(api_key=api_key, base_url="https://api.deepseek.com/v1")
    max_chars = settings.AI_FEED_SUMMARY_MAX_CHARS

    # 构造批处理 prompt
    items_text = "\n".join(
        f"[{i + 1}] 标题: {b['title']}\n    摘要: {b['summary']}" for i, b in enumerate(batch)
    )

    prompt = f"""你是一个 AI 资讯分类助手。请对以下 {len(batch)} 条资讯进行分类和摘要。

分类类别(只能选一个): hotspot(热点事件), account(账号动态), source(信息源), creation(创作内容), analysis(深度分析), retrieval(资源检索), tool(工具产品)

要求:
1. 为每条资讯选择最合适的分类
2. 生成不超过 {max_chars} 字的中文摘要
3. 提取 1-3 个标签

待处理资讯:
{items_text}

请严格返回 JSON 数组, 不要有任何其他文字:
[
  {{"index": 1, "category": "hotspot", "summary": "...", "tags": ["标签1", "标签2"]}},
  ...
]"""

    resp = await client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {"role": "system", "content": "你是专业的 AI 资讯分类与摘要助手, 只返回 JSON."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.3,
        max_tokens=2000,
    )

    content = resp.choices[0].message.content.strip()
    # 兼容 ```json ... ``` 包裹
    if content.startswith("```"):
        content = content.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        logger.warning(f"ai_feed: LLM response not valid JSON: {content[:200]}")
        return []

    # 映射回原始 id
    results: list[dict] = []
    for item in parsed:
        idx = item.get("index", 0)
        if 1 <= idx <= len(batch):
            results.append(
                {
                    "id": batch[idx - 1]["id"],
                    "category": item.get("category", "source"),
                    "summary": item.get("summary", ""),
                    "tags": item.get("tags", []),
                }
            )
    return results


def _apply_llm_results(results: list[dict]) -> None:
    """将 LLM 结果写回 ai_feed_hot_item."""
    from app.database import get_session
    from app.models.ai_feed_models import AiFeedHotItem

    if not results:
        return

    now = datetime.utcnow()
    with get_session() as db:
        for r in results:
            item = db.query(AiFeedHotItem).filter(AiFeedHotItem.id == r["id"]).first()
            if item:
                item.llm_category = r.get("category")
                item.llm_tags = json.dumps(r.get("tags", []), ensure_ascii=False)
                if r.get("summary"):
                    item.llm_summary = r["summary"]
                item.llm_processed_at = now
        db.commit()


# ===========================================================================
# 5. 查询层 — 供 API 路由调用
# ===========================================================================
def list_feed_items(
    source_code: str | None = None,
    category: str | None = None,
    trend_tag: str | None = None,
    keyword: str | None = None,
    page: int = 1,
    limit: int = 20,
) -> dict:
    """分页查询资讯条目列表(供 API 调用). 返回 {items, total, page, limit}."""
    from app.database import get_session
    from app.models.ai_feed_models import AiFeedHotItem, AiFeedSource

    with get_session() as db:
        q = db.query(AiFeedHotItem)
        if source_code:
            q = q.filter(AiFeedHotItem.source_code == source_code)
        if category:
            q = q.filter(AiFeedHotItem.llm_category == category)
        if trend_tag:
            q = q.filter(AiFeedHotItem.trend_tag == trend_tag)
        if keyword:
            q = q.filter(AiFeedHotItem.title.like(f"%{keyword}%"))

        total = q.count()
        items = (
            q.order_by(AiFeedHotItem.last_seen_at.desc())
            .offset((page - 1) * limit)
            .limit(limit)
            .all()
        )

        # 查 source 信息用于前端展示
        source_map = {s.source_code: s for s in db.query(AiFeedSource).all()}

        return {
            "items": [_item_to_dict(it, source_map) for it in items],
            "total": total,
            "page": page,
            "limit": limit,
        }


def list_sources(enabled_only: bool = True) -> list[dict]:
    """查询所有数据源(供前端动态 Tab 渲染)."""
    from app.database import get_session
    from app.models.ai_feed_models import AiFeedSource

    with get_session() as db:
        q = db.query(AiFeedSource)
        if enabled_only:
            q = q.filter(AiFeedSource.enabled == True)  # noqa: E712
        sources = q.order_by(AiFeedSource.sort_order).all()
        return [_source_to_dict(s) for s in sources]


def get_trend_chart(item_id: int, window: int = 14) -> dict:
    """获取某条目的趋势图表数据(近 window 天的排名/热度曲线)."""
    from app.database import get_session
    from app.models.ai_feed_models import AiFeedSnapshot, AiFeedTrendSignal, AiFeedHotItem

    with get_session() as db:
        item = db.query(AiFeedHotItem).filter(AiFeedHotItem.id == item_id).first()
        if not item:
            return {}

        since = date.today() - timedelta(days=window)
        snaps = (
            db.query(AiFeedSnapshot)
            .filter(
                AiFeedSnapshot.source_code == item.source_code,
                AiFeedSnapshot.platform_item_id == item.platform_item_id,
                AiFeedSnapshot.snapshot_date >= since,
            )
            .order_by(AiFeedSnapshot.snapshot_date)
            .all()
        )

        # 趋势信号
        signals = (
            db.query(AiFeedTrendSignal)
            .filter(AiFeedTrendSignal.item_id == item_id)
            .all()
        )
        sig_map = {s.window_days: s for s in signals}

        return {
            "item": _item_to_dict(item, {}),
            "dates": [s.snapshot_date.isoformat() for s in snaps],
            "hot_values": [int(s.hot_value or 0) for s in snaps],
            "ranks": [s.rank for s in snaps],
            "trends": {
                str(w): {
                    "growth_pct": sig.growth_pct,
                    "rank_delta": sig.rank_delta,
                    "trend_tag": sig.trend_tag,
                    "snapshot_count": sig.snapshot_count,
                }
                for w, sig in sig_map.items()
            },
        }


def get_source_stats() -> dict:
    """获取数据源采集统计(供管理后台/调试)."""
    from app.database import get_session
    from app.models.ai_feed_models import AiFeedSource, AiFeedHotItem
    from sqlalchemy import func

    with get_session() as db:
        sources = db.query(AiFeedSource).order_by(AiFeedSource.sort_order).all()
        stats = []
        for s in sources:
            item_count = (
                db.query(func.count(AiFeedHotItem.id))
                .filter(AiFeedHotItem.source_code == s.source_code)
                .scalar()
            ) or 0
            stats.append(
                {
                    **_source_to_dict(s),
                    "total_items": item_count,
                }
            )
        return {"sources": stats}


# ===========================================================================
# 跨源热点聚合 (Phase 3 差异化: 同一话题在多平台的传播分析)
# ===========================================================================
def get_cross_source_topics(
    hours: int = 48,
    min_sources: int = 2,
    limit: int = 20,
) -> list[dict]:
    """跨源热点聚合: 将多个平台中讨论同一话题的条目聚合为话题组.

    算法:
      1. 取近 hours 小时的全部条目
      2. 按 LLM tags 分组(优先), 无 tags 则按标题关键词重叠度分组
      3. 每组计算: 覆盖源数 / 总热度 / 最佳排名 / 聚合趋势
      4. 按 source_count desc, total_hot desc 排序, 取 top limit

    返回示例:
      [{
        "topic_title": "GPT-5 发布",
        "topic_tags": ["hotspot", "AI"],
        "source_count": 5,
        "sources": ["weibo", "zhihu", "bilibili", "36kr", "jiqizhixin"],
        "total_hot": 12345678,
        "best_rank": 1,
        "aggregate_trend": "rising",
        "items": [...],
        "item_count": 8
      }]
    """
    from collections import defaultdict
    from app.database import get_session
    from app.models.ai_feed_models import AiFeedHotItem, AiFeedSource

    with get_session() as db:
        since = datetime.utcnow() - timedelta(hours=hours)
        items = (
            db.query(AiFeedHotItem)
            .filter(AiFeedHotItem.last_seen_at >= since)
            .order_by(AiFeedHotItem.current_hot.desc().nullslast())
            .limit(500)
            .all()
        )
        if not items:
            return []

        source_map = {s.source_code: s for s in db.query(AiFeedSource).all()}

        # --- 步骤 1: 按标签或标题关键词分组 ---
        tag_groups: dict[str, list] = defaultdict(list)
        keyword_groups: dict[str, list] = defaultdict(list)

        for item in items:
            # 优先按 LLM tags 分组
            if item.llm_tags:
                for tag in item.llm_tags[:3]:  # 最多取前 3 个标签
                    tag_groups[tag].append(item)
            # 无标签时按标题前 10 字符分组(简化聚类)
            else:
                title_prefix = item.title[:10] if item.title else ""
                if title_prefix:
                    keyword_groups[title_prefix].append(item)

        # --- 步骤 2: 合并分组, 计算聚合指标 ---
        all_groups = {}
        for tag, group_items in tag_groups.items():
            all_groups[tag] = group_items
        for prefix, group_items in keyword_groups.items():
            # 只保留 >=2 条的标题前缀组
            if len(group_items) >= 2:
                all_groups[f"kw:{prefix}"] = group_items

        topics = []
        for group_key, group_items in all_groups.items():
            # 去重: 同一 source_code 只保留热度最高的一条
            seen_sources = {}
            for item in group_items:
                code = item.source_code
                if code not in seen_sources or (item.current_hot or 0) > (seen_sources[code].current_hot or 0):
                    seen_sources[code] = item

            unique_items = list(seen_sources.values())
            source_codes = list(seen_sources.keys())

            if len(source_codes) < min_sources:
                continue

            # 选最具代表性的标题(热度最高)
            rep_item = max(unique_items, key=lambda x: x.current_hot or 0)
            topic_title = rep_item.title

            # 聚合趋势: 有一个 rising 就是 rising, 否则有 new 就是 new, 否则 stable
            trends = [i.trend_tag for i in unique_items if i.trend_tag]
            if "rising" in trends:
                agg_trend = "rising"
            elif "new" in trends:
                agg_trend = "new"
            elif "cooling" in trends and "rising" not in trends:
                agg_trend = "cooling"
            else:
                agg_trend = "stable"

            total_hot = sum((i.current_hot or 0) for i in unique_items)
            best_rank = min((i.current_rank for i in unique_items if i.current_rank), default=None)

            # 聚合标签
            topic_tags = []
            if not group_key.startswith("kw:"):
                topic_tags.append(group_key)
            for i in unique_items:
                if i.llm_tags:
                    for t in i.llm_tags[:2]:
                        if t not in topic_tags:
                            topic_tags.append(t)

            topics.append({
                "topic_title": topic_title,
                "topic_tags": topic_tags[:5],
                "source_count": len(source_codes),
                "sources": source_codes,
                "source_names": [
                    source_map.get(c).source_name if source_map.get(c) else c
                    for c in source_codes
                ],
                "total_hot": total_hot,
                "best_rank": best_rank,
                "aggregate_trend": agg_trend,
                "items": [_item_to_dict(i, source_map) for i in unique_items],
                "item_count": len(unique_items),
                "representative_item_id": rep_item.id,
            })

        # 排序: source_count desc, total_hot desc
        topics.sort(key=lambda x: (x["source_count"], x["total_hot"]), reverse=True)
        return topics[:limit]


def get_trend_notifications(
    hours: int = 24,
    min_growth: float = 15.0,
    limit: int = 10,
) -> list[dict]:
    """获取近期趋势爆发通知(rising 且增长率 >= min_growth).

    用于前端轮询推送通知 — 替代 socket.io 的轻量方案.
    """
    from app.database import get_session
    from app.models.ai_feed_models import AiFeedHotItem, AiFeedSource

    with get_session() as db:
        since = datetime.utcnow() - timedelta(hours=hours)
        source_map = {s.source_code: s for s in db.query(AiFeedSource).all()}

        items = (
            db.query(AiFeedHotItem)
            .filter(
                AiFeedHotItem.trend_tag == "rising",
                AiFeedHotItem.trend_growth_pct >= min_growth,
                AiFeedHotItem.last_seen_at >= since,
            )
            .order_by(AiFeedHotItem.trend_growth_pct.desc())
            .limit(limit)
            .all()
        )

        return [_item_to_dict(i, source_map) for i in items]


# ===========================================================================
# 工具函数
# ===========================================================================
def _item_to_dict(item, source_map: dict) -> dict:
    """序列化条目(含 source 名称)."""
    src = source_map.get(item.source_code)
    return {
        "id": item.id,
        "source_code": item.source_code,
        "source_name": src.source_name if src else item.source_code,
        "source_color": src.color if src else None,
        "source_category": src.category if src else None,
        "platform_item_id": item.platform_item_id,
        "title": item.title,
        "summary": item.summary,
        "llm_summary": item.llm_summary,
        "llm_category": item.llm_category,
        "llm_tags": json.loads(item.llm_tags) if item.llm_tags else [],
        "url": item.url,
        "cover_url": item.cover_url,
        "author": item.author,
        "current_rank": item.current_rank,
        "current_hot": item.current_hot,
        "trend_tag": item.trend_tag,
        "trend_growth_pct": item.trend_growth_pct,
        "publish_time": item.publish_time.isoformat() if item.publish_time else None,
        "first_seen_at": item.first_seen_at.isoformat() if item.first_seen_at else None,
        "last_seen_at": item.last_seen_at.isoformat() if item.last_seen_at else None,
        "title_en": item.title_en,
        "title_ja": item.title_ja,
        "title_ko": item.title_ko,
    }


def _source_to_dict(s) -> dict:
    return {
        "id": s.id,
        "source_code": s.source_code,
        "source_name": s.source_name,
        "source_type": s.source_type,
        "endpoint": s.endpoint,
        "category": s.category,
        "icon": s.icon,
        "color": s.color,
        "enabled": s.enabled,
        "sort_order": s.sort_order,
        "fetch_interval_minutes": s.fetch_interval_minutes,
        "last_fetch_at": s.last_fetch_at.isoformat() if s.last_fetch_at else None,
        "last_fetch_status": s.last_fetch_status,
        "last_fetch_count": s.last_fetch_count,
        "description": s.description,
    }


def _parse_hot(val) -> int:
    """解析热度值(DailyHotApi 可能返回 '1.2万' 等字符串)."""
    if isinstance(val, (int, float)):
        return int(val)
    if isinstance(val, str):
        val = val.strip()
        try:
            return int(val)
        except ValueError:
            if "万" in val:
                try:
                    return int(float(val.replace("万", "")) * 10000)
                except ValueError:
                    return 0
            if "亿" in val:
                try:
                    return int(float(val.replace("亿", "")) * 100000000)
                except ValueError:
                    return 0
    return 0


def _strip_html(text: str) -> str:
    """去除 HTML 标签(简易版, RSS summary 可能含 HTML)."""
    import re
    clean = re.compile(r"<[^>]+>")
    return clean.sub("", text).strip()


def _clean_arxiv_title(title: str) -> str:
    """清理 arXiv 标题(多余空白换行)."""
    return " ".join(title.split()).strip()


# ===========================================================================
# 6. 多语言翻译层 — LLM 标题翻译(按需, 批处理)
# ===========================================================================
async def translate_titles_batch(limit: int = 50) -> int:
    """对缺多语言标题的条目批量翻译为 en/ja/ko.

    复用 DeepSeek-V3, 批处理降本. 失败降级跳过.
    """
    from app.utils.ai_keys import deepseek_key

    api_key = deepseek_key()
    if not api_key:
        logger.info("ai_feed: DEEPSEEK_API_KEY not configured, skip translation")
        return 0

    from app.database import get_session
    from app.models.ai_feed_models import AiFeedHotItem

    with get_session() as db:
        items = (
            db.query(AiFeedHotItem)
            .filter(
                (AiFeedHotItem.title_en == None)  # noqa: E711
                | (AiFeedHotItem.title_ja == None)
                | (AiFeedHotItem.title_ko == None)
            )
            .order_by(AiFeedHotItem.current_hot.desc().nullslast())
            .limit(limit)
            .all()
        )
        if not items:
            return 0
        item_data = [{"id": it.id, "title": it.title} for it in items]

    batch_size = settings.AI_FEED_LLM_BATCH_SIZE
    total = 0
    for i in range(0, len(item_data), batch_size):
        batch = item_data[i : i + batch_size]
        try:
            results = await _call_llm_translate(api_key, batch)
            _apply_translate_results(results)
            total += len(batch)
        except Exception as e:
            logger.warning(f"ai_feed: translate batch {i//batch_size} failed: {e}")
    logger.info(f"ai_feed: translated {total} items")
    return total


async def _call_llm_translate(api_key: str, batch: list[dict]) -> list[dict]:
    """调用 DeepSeek-V3 批量翻译标题为 en/ja/ko."""
    try:
        from openai import AsyncOpenAI
    except ImportError:
        return []

    client = AsyncOpenAI(api_key=api_key, base_url="https://api.deepseek.com/v1")
    items_text = "\n".join(f"[{i + 1}] {b['title']}" for i, b in enumerate(batch))
    prompt = f"""将以下中文标题翻译为英文、日文、韩文, 保持简洁准确.

{items_text}

严格返回 JSON 数组:
[
  {{"index": 1, "en": "...", "ja": "...", "ko": "..."}},
  ...
]"""

    resp = await client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {"role": "system", "content": "你是专业翻译, 只返回 JSON."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
        max_tokens=2000,
    )
    content = resp.choices[0].message.content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        return []

    results = []
    for item in parsed:
        idx = item.get("index", 0)
        if 1 <= idx <= len(batch):
            results.append(
                {
                    "id": batch[idx - 1]["id"],
                    "en": item.get("en", ""),
                    "ja": item.get("ja", ""),
                    "ko": item.get("ko", ""),
                }
            )
    return results


def _apply_translate_results(results: list[dict]) -> None:
    """将翻译结果写回."""
    from app.database import get_session
    from app.models.ai_feed_models import AiFeedHotItem

    if not results:
        return
    with get_session() as db:
        for r in results:
            item = db.query(AiFeedHotItem).filter(AiFeedHotItem.id == r["id"]).first()
            if item:
                if r.get("en"):
                    item.title_en = r["en"]
                if r.get("ja"):
                    item.title_ja = r["ja"]
                if r.get("ko"):
                    item.title_ko = r["ko"]
        db.commit()
