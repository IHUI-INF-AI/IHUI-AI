# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""image_search — 图片检索(DuckDuckGo Images,无 API key)。

对标 Qoder/Trae 的 ImageSearch 工具面:给 query 返回可直接消费的图片结果
(imageUrl / thumbnailUrl / sourceUrl / 尺寸 / 标题)。出网腿与 web_search 同源
(DuckDuckGo,无 key),不引入付费搜索栈。

两步协议:
1. GET ``https://duckduckgo.com/?q=<q>&iax=images&ia=images`` 取 ``vqd`` token;
2. GET ``https://duckduckgo.com/i.js?l=wt-wt&o=json&q=<q>&vqd=<vqd>`` 拿 JSON。

失效方向(AGENTS §0.3):网络不可达 / token 取不到 / 载荷不认识 ⇒ 返回
``ok=False`` + 空 results + ``error``,绝不编造图片,也不把"没拿到"记成绿。
本模块只做检索与解析,工具注册与身份/审批面留在 ``mcp_server``(接线同批)。
"""

from __future__ import annotations

import re
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:  # pragma: no cover - 仅类型面
    import httpx

DDG_HTML_URL = "https://duckduckgo.com/"
DDG_IMAGES_JSON_URL = "https://duckduckgo.com/i.js"

_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)

# DuckDuckGo 的 vqd 出现形态随页面版本漂:,三种都在真页面上见过。
_VQD_PATTERNS = (
    re.compile(r'vqd="([^"]+)"'),
    re.compile(r"vqd=([\d-]+)"),
    re.compile(r'vqd:\s*"([^"]+)"'),
)


def _extract_vqd(html: str) -> str | None:
    """从图片搜索落地页里取 vqd token;取不到返回 None(调用方判未判定)。"""
    for pattern in _VQD_PATTERNS:
        match = pattern.search(html)
        if match:
            value = match.group(1).strip()
            if value:
                return value
    return None


def _parse_images_payload(payload: dict[str, Any], max_results: int) -> list[dict[str, Any]]:
    """把 DuckDuckGo i.js 的 JSON 投影成工具结果;字段缺失时不编造。"""
    items = payload.get("results")
    if not isinstance(items, list):
        return []
    out: list[dict[str, Any]] = []
    for item in items:
        if len(out) >= max_results:
            break
        if not isinstance(item, dict):
            continue
        image = item.get("image")
        if not isinstance(image, str) or not image:
            continue
        width = item.get("width")
        height = item.get("height")
        out.append(
            {
                "title": str(item.get("title") or ""),
                "imageUrl": image,
                "thumbnailUrl": str(item.get("thumbnail") or ""),
                "sourceUrl": str(item.get("url") or ""),
                "width": width if isinstance(width, int) else 0,
                "height": height if isinstance(height, int) else 0,
                "source": str(item.get("source") or ""),
            }
        )
    return out


async def search_images(
    query: str,
    max_results: int = 8,
    *,
    client: httpx.AsyncClient | None = None,
) -> dict[str, Any]:
    """执行一次图片检索。

    ``client`` 注入只用于测试(MockTransport);生产路径不传,内部自建连接。
    """
    query = query.strip()
    if not query:
        return {
            "tool": "image_search",
            "ok": True,
            "query": query,
            "results": [],
            "total": 0,
            "message": "搜索关键词为空",
        }

    try:
        import httpx as _httpx
    except ImportError:
        return {
            "tool": "image_search",
            "ok": False,
            "query": query,
            "results": [],
            "total": 0,
            "message": "[stub] httpx 未安装,无法执行图片检索",
            "error": "httpx_missing",
        }

    headers = {"User-Agent": _UA}
    own_client = client is None
    active = client or _httpx.AsyncClient(timeout=10.0, follow_redirects=True)

    try:
        landing = await active.get(
            DDG_HTML_URL,
            params={"q": query, "iax": "images", "ia": "images"},
            headers=headers,
        )
        landing.raise_for_status()
        vqd = _extract_vqd(landing.text)
        if vqd is None:
            return {
                "tool": "image_search",
                "ok": False,
                "query": query,
                "results": [],
                "total": 0,
                "message": "图片检索不可用:vqd token 未取到",
                "error": "vqd_not_found",
            }

        resp = await active.get(
            DDG_IMAGES_JSON_URL,
            params={"l": "wt-wt", "o": "json", "q": query, "vqd": vqd},
            headers={**headers, "Referer": DDG_HTML_URL},
        )
        resp.raise_for_status()
        payload = resp.json()
        if not isinstance(payload, dict):
            raise ValueError("i.js 返回的不是 JSON 对象")

        results = _parse_images_payload(payload, max(1, int(max_results)))
        return {
            "tool": "image_search",
            "ok": True,
            "query": query,
            "results": results,
            "total": len(results),
            "message": f"找到 {len(results)} 条图片" if results else "未找到图片",
        }
    except Exception as e:  # noqa: BLE001 - 检索失败不拖垮工具链,由调用方按 ok=False 处理
        return {
            "tool": "image_search",
            "ok": False,
            "query": query,
            "results": [],
            "total": 0,
            "message": f"图片检索失败: {e}",
            "error": str(e),
        }
    finally:
        if own_client:
            await active.aclose()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
