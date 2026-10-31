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

每条结果带来源可信度分档 ``trust = {tier, score, reasons}``(见 ``assess_trust``):
图搜结果与图标一样需要"一眼看出能不能信"(AGENTS §4 品牌图标同源同一条思路),
所以官方/可信图源/未背书/不可用四档随结果下发,结果集按 score 降序稳定排序。

失效方向(AGENTS §0.3):网络不可达 / token 取不到 / 载荷不认识 ⇒ 返回
``ok=False`` + 空 results + ``error``,绝不编造图片,也不把"没拿到"记成绿。
本模块只做检索与解析,工具注册与身份/审批面留在 ``mcp_server``(接线同批)。
"""

from __future__ import annotations

import ipaddress
import re
from typing import TYPE_CHECKING, Any
from urllib.parse import urlsplit

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


# 来源可信度白名单:这是**消费门禁**(决定这条图能不能直接当官方素材用),不是恶意域名
# 黑名单。未命中白名单 **不等于**恶意,只表示来源未经我方背书 ⇒ 落 unknown 档并如实告知;
# 反过来,白名单只背书"这张图从哪来",不背书图的内容与授权。
OFFICIAL_HOSTS: tuple[str, ...] = (
    "wikimedia.org",
    "wikipedia.org",
    "github.com",
    "githubusercontent.com",
    "unsplash.com",
    "pexels.com",
    "openai.com",
    "anthropic.com",
    "apple.com",
    "microsoft.com",
    "google.com",
)

TRUSTED_IMAGE_HOSTS: tuple[str, ...] = (
    "imgur.com",
    "cloudinary.com",
    "pinimg.com",
    "staticflickr.com",
    "cdninstagram.com",
)

# 分档基分与上限:official 90+/trusted 60-80/unknown 30-50/unsafe 恒 0。
# 加分项(同主域)只在本档内抬分(每项 _BONUS_UNIT),**不跨档**。
_TIER_SCORE = {"official": 92, "trusted": 68, "unknown": 40, "unsafe": 0}
_TIER_CAP = {"official": 100, "trusted": 80, "unknown": 50, "unsafe": 0}
_BONUS_UNIT = {"official": 4, "trusted": 6, "unknown": 5}
# http 明文在最低可信档无法再降档时的扣分(降档优先于扣分,避免分数跌出本档区间)
_HTTP_PENALTY = 10

# 多段公共后缀:取"主域"时不能只剥两级(example.co.uk 的主域是 example.co.uk)
_MULTI_PART_SUFFIXES = frozenset(
    {"co.uk", "com.cn", "com.au", "co.jp", "com.br", "co.kr", "com.tw", "com.hk"}
)


def _inspect_url(raw: object) -> tuple[str | None, str, str | None]:
    """探一条 URL:返回 ``(主机名, 协议, 不可用原因)``,主机名为 None 时原因非空。

    不可用 = 不是字符串 / 解析不出 / 非 http(s) / 指向回环、私有、保留网段。
    """
    if not isinstance(raw, str) or not raw.strip():
        return None, "", "URL 缺失或不是字符串"
    try:
        parts = urlsplit(raw.strip())
        host = parts.hostname
        scheme = parts.scheme.lower()
    except ValueError as exc:
        return None, "", f"URL 解析失败:{exc}"
    if scheme not in ("http", "https"):
        return None, scheme, f"非 http(s) 协议:{scheme or '空'}"
    if not host:
        return None, scheme, "URL 缺主机名"
    host = host.strip(".").lower()
    if not host:
        return None, scheme, "URL 主机名为空"

    probe: ipaddress.IPv4Address | ipaddress.IPv6Address | None
    try:
        probe = ipaddress.ip_address(host)
    except ValueError:
        probe = None
    if probe is not None:
        if (
            probe.is_private
            or probe.is_loopback
            or probe.is_link_local
            or probe.is_unspecified
            or probe.is_reserved
            or probe.is_multicast
        ):
            return None, scheme, f"指向回环/私有/保留网段:{host}"
    elif host == "localhost" or host.endswith(".localhost"):
        return None, scheme, f"指向回环主机:{host}"
    return host, scheme, None


def _match_domain(host: str, domains: tuple[str, ...]) -> str | None:
    """命中白名单返回被命中的域名(按后缀匹配,``evil-wikimedia.org`` 不算命中)。"""
    for domain in domains:
        if host == domain or host.endswith("." + domain):
            return domain
    return None


def _registrable(host: str) -> str:
    """取主域(eTLD+1);IP 字面量原样返回,不参与跨主机合并。"""
    try:
        ipaddress.ip_address(host)
    except ValueError:
        pass
    else:
        return host
    labels = host.split(".")
    if len(labels) <= 2:
        return host
    if ".".join(labels[-2:]) in _MULTI_PART_SUFFIXES:
        return ".".join(labels[-3:])
    return ".".join(labels[-2:])


def _host_label(item: dict[str, Any]) -> str:
    """点名用的主机标签:即便 URL 被判 unsafe(回环/私网)也要报出它指向谁。"""
    raw = item.get("imageUrl")
    if isinstance(raw, str):
        try:
            host = urlsplit(raw.strip()).hostname
        except ValueError:
            host = None
        if host:
            return host.strip(".").lower() or "未知来源"
    return "未知来源"


def assess_trust(item: dict[str, Any]) -> dict[str, Any]:
    """给单条图搜结果出可信度分档 ``{tier, score, reasons}``。

    判据按顺序(命中即定档,全部写进 reasons):
    1. 图片地址解析失败 / 非 http(s) / 回环·私有·保留网段 ⇒ ``unsafe``(score 0);
    2. http 明文 ⇒ 至少降一档(official→trusted、trusted→unknown;已在 unknown 则扣分);
    3. 命中 ``OFFICIAL_HOSTS`` ⇒ ``official``(90+,封顶 100);
    4. 命中 ``TRUSTED_IMAGE_HOSTS`` ⇒ ``trusted``(60-80);
    5. 其余 ⇒ ``unknown``(30-50)。
    附加加分(只抬分、不跨档):来源页与图片同主域、缩略图与主图同主域。
    """
    host, scheme, bad = _inspect_url(item.get("imageUrl"))
    if host is None:
        return {"tier": "unsafe", "score": 0, "reasons": [f"图片地址不可用:{bad}"]}

    reasons: list[str] = []
    official = _match_domain(host, OFFICIAL_HOSTS)
    trusted = _match_domain(host, TRUSTED_IMAGE_HOSTS)
    if official is not None:
        tier = "official"
        reasons.append(f"域名命中官方/高可信白名单:{official}")
    elif trusted is not None:
        tier = "trusted"
        reasons.append(f"域名命中可信图源白名单:{trusted}")
    else:
        tier = "unknown"
        reasons.append(f"域名未命中白名单(消费门禁口径,未命中不等于恶意):{host}")

    penalty = 0
    if scheme == "http":
        if tier == "official":
            tier = "trusted"
            reasons.append("http 明文传输:官方档降一档为 trusted")
        elif tier == "trusted":
            tier = "unknown"
            reasons.append("http 明文传输:可信档降一档为 unknown")
        else:
            penalty = _HTTP_PENALTY
            reasons.append(f"http 明文传输:已是最低可信档,扣 {_HTTP_PENALTY} 分")

    bonus = 0
    unit = _BONUS_UNIT[tier]
    same_site, _, _ = _inspect_url(item.get("sourceUrl"))
    if same_site is not None and _registrable(same_site) == _registrable(host):
        bonus += unit
        reasons.append(f"来源页与图片同主域:{_registrable(host)}")
    thumb, _, _ = _inspect_url(item.get("thumbnailUrl"))
    if thumb is not None and _registrable(thumb) == _registrable(host):
        bonus += unit
        reasons.append(f"缩略图与主图同主域:{_registrable(host)}")

    score = max(0, min(_TIER_SCORE[tier] - penalty + bonus, _TIER_CAP[tier]))
    return {"tier": tier, "score": score, "reasons": reasons}


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
        parsed: dict[str, Any] = {
            "title": str(item.get("title") or ""),
            "imageUrl": image,
            "thumbnailUrl": str(item.get("thumbnail") or ""),
            "sourceUrl": str(item.get("url") or ""),
            "width": width if isinstance(width, int) else 0,
            "height": height if isinstance(height, int) else 0,
            "source": str(item.get("source") or ""),
        }
        parsed["trust"] = assess_trust(parsed)
        out.append(parsed)
    return out


def _summary(results: list[dict[str, Any]]) -> str:
    """摘要:总条数 + unsafe 条数(有则点名),不让"来源不可信"只藏在明细里。"""
    if not results:
        return "未找到图片"
    unsafe = [item for item in results if item["trust"]["tier"] == "unsafe"]
    if not unsafe:
        return f"找到 {len(results)} 条图片"
    named = "、".join(_host_label(item) for item in unsafe[:3])
    if len(unsafe) > 3:
        named += " 等"
    return f"找到 {len(results)} 条图片;其中 {len(unsafe)} 条来源不可信(unsafe):{named}"


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
        # 稳定排序:同分保持上游原序(Python sort 保证稳定),高分在前便于直接消费
        results.sort(key=lambda item: item["trust"]["score"], reverse=True)
        return {
            "tool": "image_search",
            "ok": True,
            "query": query,
            "results": results,
            "total": len(results),
            "message": _summary(results),
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
