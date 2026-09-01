# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

"""语雀 Connector:公开知识库免 token 拉取(2026-09-02 立,P2-2)。

免 token 原理(2026-09-02 实测,已抓取 https://www.yuque.com/yuque/developer 验证):
- 语雀公开知识库首页是 SSR 渲染的,HTML 里注入 `window.appData` JSON:
  `window.appData = JSON.parse(decodeURIComponent("%7B...%22"));`
  其中 `appData.book.id` 为知识库 ID、`appData.book.toc` 为完整目录(含文档列表)。
- 单篇正文:文档页 HTML 是 SPA 空壳(<div id="ReactApp"></div> 为空),
  正文需调用语雀免 token 公开接口:
  `GET https://www.yuque.com/api/docs/{slug}?book_id={book_id}&include_contributors=true`
  返回 `data.content`(lake 格式 HTML,`<!doctype lake>` 开头),用 BeautifulSoup 转纯文本。
- 为什么不用开放 API:语雀开放 API(https://www.yuque.com/api/v2/...)需要
  X-Auth-Token,未带 token 一律 401。公开知识库的场景走上述页面/接口即可零成本读取。

URL 格式:
- 知识库首页:https://www.yuque.com/{user}/{repo}
- 单篇文档:https://www.yuque.com/{user}/{repo}/{slug}
- 正文接口:https://www.yuque.com/api/docs/{slug}?book_id={book_id}

用户配置:
    extra = {"user": "yuque", "repo": "developer"}
即可免 token 同步公开知识库文档列表 + 拉取单篇文档正文。
"""

from __future__ import annotations

import json
import logging
import re
import urllib.parse
from datetime import UTC, datetime
from typing import Any

import requests
from bs4 import BeautifulSoup

from app.services.connectors import MAX_DOC_CHARS

logger = logging.getLogger(__name__)

# 语雀 SSR 注入的 appData(实测 2026-09-02:JSON 经 decodeURIComponent 包裹)
_APPDATA_RE = re.compile(r'JSON\.parse\(decodeURIComponent\("([^"]+)"\)\)')

# 浏览器 UA(语雀对裸 requests UA 可能返回反爬页)
_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
)


def now_iso() -> str:
    """当前 UTC 时间的 ISO 8601 字符串。"""
    return datetime.now(UTC).isoformat()


def _extra(record: dict[str, Any]) -> dict[str, Any]:
    """取连接器记录里的类型专属配置(缺省空 dict)。"""
    extra = record.get("extra") or {}
    return extra if isinstance(extra, dict) else {}


def _request(
    url: str, params: dict[str, Any] | None = None, timeout: int = 20
) -> requests.Response:
    """带浏览器 UA 的 GET 请求(统一超时,避免挂死)。"""
    return requests.get(
        url,
        params=params,
        headers={"User-Agent": _UA, "Referer": "https://www.yuque.com/"},
        timeout=timeout,
    )


def _extract_appdata(html: str) -> dict[str, Any]:
    """从语雀 SSR HTML 提取 window.appData JSON;找不到返回空 dict。"""
    m = _APPDATA_RE.search(html)
    if not m:
        return {}
    try:
        data = json.loads(urllib.parse.unquote(m.group(1)))
        return data if isinstance(data, dict) else {}
    except Exception:  # noqa: BLE001 - 解析失败返回空 dict
        return {}


def _html_to_text(content: str) -> str:
    """把语雀 lake HTML 转纯文本(保留段落边界,压缩多余空行)。"""
    soup = BeautifulSoup(content, "html.parser")
    for tag in soup.find_all(
        ["p", "div", "li", "blockquote", "pre", "tr", "br", "h1", "h2", "h3", "h4", "h5", "h6"]
    ):
        tag.append("\n")
    text = soup.get_text()
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def _truncate(content: str, max_chars: int = MAX_DOC_CHARS) -> tuple[str, bool]:
    """超长截断;截断点尽量落在段落边界(用 rfind 换行符)。"""
    if len(content) <= max_chars:
        return content, False
    cut = content.rfind("\n", 0, max_chars)
    if cut < max_chars // 2:  # 段落边界离上限太远就硬切
        cut = max_chars
    return content[:cut], True


async def sync(record: dict[str, Any]) -> dict[str, Any]:
    """同步语雀公开知识库文档列表。

    从知识库首页 HTML 提取 appData.book.toc 目录,返回文档列表。
    """
    extra = _extra(record)
    user = str(extra.get("user") or "").strip()
    repo = str(extra.get("repo") or "").strip()
    if not user or not repo:
        return {
            "ok": False,
            "message": "缺少 extra.user / extra.repo 配置",
            "items": [],
            "last_sync_at": "",
        }
    try:
        html = _request(f"https://www.yuque.com/{user}/{repo}").text
        appdata = _extract_appdata(html)
        raw_book = appdata.get("book")
        book: dict[str, Any] = raw_book if isinstance(raw_book, dict) else {}
        raw_toc = book.get("toc")
        toc: list[Any] = raw_toc if isinstance(raw_toc, list) else []
        items: list[dict[str, str]] = []
        for entry in toc:
            if not isinstance(entry, dict):
                continue
            if entry.get("type") != "DOC":
                continue  # TITLE 等分组条目无 doc_id,跳过
            slug = str(entry.get("url") or "").strip()
            if not slug:
                continue
            items.append({"doc_id": slug, "title": str(entry.get("title") or slug)})
        if not items:
            return {
                "ok": False,
                "message": "知识库为空或页面未包含目录数据(可能非公开库或页面结构变更)",
                "items": [],
                "last_sync_at": "",
            }
        return {
            "ok": True,
            "message": f"找到 {len(items)} 篇文档",
            "items": items,
            "last_sync_at": now_iso(),
        }
    except Exception as e:  # noqa: BLE001 - 出错降级,不抛异常
        logger.warning("yuque sync 失败: %s", e)
        return {"ok": False, "message": str(e), "items": [], "last_sync_at": ""}


async def fetch_document(record: dict[str, Any], doc_id: str) -> dict[str, Any]:
    """拉取单篇语雀文档正文并转纯文本。

    先抓首页拿 book_id,再调免 token 公开接口取 data.content(lake HTML)。
    """
    extra = _extra(record)
    user = str(extra.get("user") or "").strip()
    repo = str(extra.get("repo") or "").strip()
    slug = str(doc_id or "").strip()
    if not user or not repo:
        return {
            "ok": False,
            "title": "",
            "content": "",
            "chars": 0,
            "truncated": False,
            "message": "缺少 extra.user / extra.repo 配置",
        }
    if not slug:
        return {
            "ok": False,
            "title": "",
            "content": "",
            "chars": 0,
            "truncated": False,
            "message": "doc_id(slug) 为空",
        }
    try:
        # book_id 不在配置里,每次从首页 appData 取(公开库公开可读)
        html = _request(f"https://www.yuque.com/{user}/{repo}").text
        appdata = _extract_appdata(html)
        raw_book = appdata.get("book")
        book: dict[str, Any] = raw_book if isinstance(raw_book, dict) else {}
        book_id = book.get("id")
        if not book_id:
            return {
                "ok": False,
                "title": "",
                "content": "",
                "chars": 0,
                "truncated": False,
                "message": "无法从首页获取 book_id(可能非公开库或页面结构变更)",
            }
        resp = _request(
            f"https://www.yuque.com/api/docs/{slug}",
            params={
                "book_id": book_id,
                "include_contributors": "true",
                "include_like": "true",
                "include_hits": "true",
                "merge_dynamic_data": "false",
            },
        )
        resp.raise_for_status()
        payload = resp.json()
        data = payload.get("data") if isinstance(payload, dict) else None
        if not isinstance(data, dict):
            return {
                "ok": False,
                "title": "",
                "content": "",
                "chars": 0,
                "truncated": False,
                "message": "文档接口返回异常",
            }
        title = str(data.get("title") or slug)
        raw_content = str(data.get("content") or "")
        if not raw_content.strip():
            return {
                "ok": False,
                "title": title,
                "content": "",
                "chars": 0,
                "truncated": False,
                "message": "文档正文为空(可能无公开读取权限)",
            }
        text = _html_to_text(raw_content)
        content, truncated = _truncate(text)
        return {
            "ok": True,
            "title": title,
            "content": content,
            "chars": len(content),
            "truncated": truncated,
            "message": f"正文 {len(content)} 字符" + ("(已截断)" if truncated else ""),
        }
    except Exception as e:  # noqa: BLE001 - 出错降级,不抛异常
        logger.warning("yuque fetch_document 失败(%s): %s", slug, e)
        return {
            "ok": False,
            "title": "",
            "content": "",
            "chars": 0,
            "truncated": False,
            "message": str(e),
        }
