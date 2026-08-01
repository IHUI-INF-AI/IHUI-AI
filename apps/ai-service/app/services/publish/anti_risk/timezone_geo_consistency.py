"""时区地理位置一致性校验 — 校验账号时区/语言与代理 IP 地理位置一致。

检测原理:平台通过 IP 地理位置推断用户所在时区和语言,再与浏览器 navigator.timezone
和 navigator.language 对比。如果不一致(如 IP 在北京但时区设为 America/New_York),
则判定为"使用代理/伪造时区"→ 触发风控。

对抗策略:校验 timezone + language 与代理 IP 地理位置三者一致后再发布。
- 调用 ip-api.com 获取 IP 地理位置和时区
- 校验 navigator.timezone 与 IP 所在时区一致
- 校验 navigator.language 与 IP 所在国家匹配
- 不一致时返回建议(应更换代理或调整时区)

提供 5 个常见地理位置的预设配置(北京/上海/广州/深圳/香港)。
缓存 IP 查询结果(TTL 1 小时)避免重复请求。
"""
from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass

import httpx
from playwright.async_api import BrowserContext

from app.core.logging import get_logger

logger = get_logger(__name__)


# IP 查询缓存 TTL(秒)
_IP_CACHE_TTL = 3600  # 1 小时


@dataclass
class GeoInfo:
    """IP 地理位置信息(来自 ip-api.com)。"""

    ip: str
    country: str  # 国家代码,如 "CN"
    region: str  # 省份,如 "Beijing"
    city: str  # 城市,如 "Beijing"
    timezone: str  # 时区,如 "Asia/Shanghai"
    country_code: str  # 国家代码,如 "CN"


@dataclass
class ConsistencyReport:
    """时区-地理位置一致性报告。

    Attributes:
        consistent: 是否一致(True=一致,False=不一致)
        geo_info: IP 地理位置信息(查询失败时为 None)
        timezone_match: 时区是否匹配
        language_match: 语言是否匹配
        suggestion: 不一致时的优化建议
    """

    consistent: bool
    geo_info: GeoInfo | None = None
    timezone_match: bool = False
    language_match: bool = False
    suggestion: str = ""


# ---------------------------------------------------------------------------
# 5 个常见地理位置的预设配置
# ---------------------------------------------------------------------------

_GEO_PRESETS: dict[str, dict[str, str]] = {
    "beijing": {
        "timezone": "Asia/Shanghai",
        "language": "zh-CN",
        "country": "CN",
        "city": "Beijing",
    },
    "shanghai": {
        "timezone": "Asia/Shanghai",
        "language": "zh-CN",
        "country": "CN",
        "city": "Shanghai",
    },
    "guangzhou": {
        "timezone": "Asia/Shanghai",
        "language": "zh-CN",
        "country": "CN",
        "city": "Guangzhou",
    },
    "shenzhen": {
        "timezone": "Asia/Shanghai",
        "language": "zh-CN",
        "country": "CN",
        "city": "Shenzhen",
    },
    "hongkong": {
        "timezone": "Asia/Hong_Kong",
        "language": "zh-HK",
        "country": "HK",
        "city": "Hong Kong",
    },
}


# 国家代码→语言映射
_COUNTRY_LANGUAGE_MAP: dict[str, str] = {
    "CN": "zh-CN",
    "HK": "zh-HK",
    "TW": "zh-TW",
    "US": "en-US",
    "GB": "en-GB",
    "JP": "ja-JP",
    "KR": "ko-KR",
}


class TimezoneGeoValidator:
    """时区地理位置一致性校验器(单例)。

    缓存 IP 查询结果(asyncio.Lock + dict,TTL 1 小时),避免重复请求。
    """

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._cache: dict[str, tuple[float, GeoInfo]] = {}

    async def _query_geo(self, ip: str) -> GeoInfo | None:
        """查询 IP 地理位置(带缓存,TTL 1 小时)。"""
        now = time.time()
        async with self._lock:
            cached = self._cache.get(ip)
            if cached and (now - cached[0]) < _IP_CACHE_TTL:
                return cached[1]

        # 查询 ip-api.com
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(f"http://ip-api.com/json/{ip}")
                resp.raise_for_status()
                data = resp.json()
                geo = GeoInfo(
                    ip=ip,
                    country=str(data.get("country", "")),
                    region=str(data.get("regionName", "")),
                    city=str(data.get("city", "")),
                    timezone=str(data.get("timezone", "")),
                    country_code=str(data.get("countryCode", "")),
                )
                async with self._lock:
                    self._cache[ip] = (now, geo)
                return geo
        except (httpx.HTTPError, KeyError, ValueError) as e:
            logger.warning("[timezone_geo] 查询 IP %s 地理位置失败: %s", ip, e)
            return None

    async def validate(
        self,
        account_id: str,
        timezone: str,
        proxy_ip: str,
        language: str = "",
    ) -> ConsistencyReport:
        """校验账号时区与代理 IP 地理位置一致性。

        Args:
            account_id: 账号 ID(用于日志)
            timezone: 浏览器时区(如 "Asia/Shanghai")
            proxy_ip: 代理出口 IP
            language: 浏览器语言(如 "zh-CN",可选)

        Returns:
            ConsistencyReport(含一致性结果 + 建议)
        """
        geo = await self._query_geo(proxy_ip)
        if geo is None:
            return ConsistencyReport(
                consistent=True,  # 查询失败时降级为一致(不阻断)
                geo_info=None,
                timezone_match=True,
                language_match=True,
                suggestion="IP 地理位置查询失败,已降级跳过校验",
            )

        # 校验时区一致
        timezone_match = geo.timezone == timezone
        # 校验语言与国家匹配
        expected_lang = _COUNTRY_LANGUAGE_MAP.get(geo.country_code, "")
        language_match = True
        if language and expected_lang:
            language_match = language.startswith(geo.country_code.lower()) or \
                language.startswith(expected_lang.split("-")[0])

        consistent = timezone_match and language_match
        suggestions: list[str] = []
        if not timezone_match:
            suggestions.append(
                f"时区不匹配:浏览器={timezone}, IP 地理={geo.timezone}"
                f"(应设为 {geo.timezone})"
            )
        if not language_match:
            suggestions.append(
                f"语言不匹配:浏览器={language}, IP 国家={geo.country_code}"
                f"(应设为 {expected_lang})"
            )

        if consistent:
            logger.debug(
                "[timezone_geo] 账号 %s 时区-地理一致: ip=%s tz=%s lang=%s",
                account_id, proxy_ip, timezone, language,
            )
        else:
            logger.warning(
                "[timezone_geo] 账号 %s 时区-地理不一致: %s",
                account_id, "; ".join(suggestions),
            )

        return ConsistencyReport(
            consistent=consistent,
            geo_info=geo,
            timezone_match=timezone_match,
            language_match=language_match,
            suggestion="; ".join(suggestions),
        )

    def get_preset(self, city: str) -> dict[str, str] | None:
        """获取预设地理位置配置。"""
        return _GEO_PRESETS.get(city.lower())

    def clear_cache(self) -> None:
        """清除 IP 查询缓存。"""
        self._cache.clear()


# ---------------------------------------------------------------------------
# 全局单例
# ---------------------------------------------------------------------------

_global_validator: TimezoneGeoValidator | None = None


def get_timezone_geo_validator() -> TimezoneGeoValidator:
    """获取全局 TimezoneGeoValidator 单例。"""
    global _global_validator
    if _global_validator is None:
        _global_validator = TimezoneGeoValidator()
    return _global_validator


def _build_timezone_consistency_script(timezone: str, language: str) -> str:
    """构建时区-语言一致性注入脚本。"""
    lang_escaped = language.replace("'", "\\'")
    lang_parts = language.split("-")
    lang_primary = lang_parts[0] if lang_parts else "zh"
    return f"""
(function() {{
  'use strict';
  try {{
    // 锁定时区(通过 Intl.DateTimeFormat resolvedOptions)
    var _origDTF = Intl.DateTimeFormat;
    Intl.DateTimeFormat = function(locale, options) {{
      var opts = options || {{}};
      opts.timeZone = '{timezone}';
      return new _origDTF(locale, opts);
    }};
    Intl.DateTimeFormat.prototype = _origDTF.prototype;
  }} catch (e) {{}}
  try {{
    // 锁定语言
    Object.defineProperty(navigator, 'language', {{
      get: function() {{ return '{lang_escaped}'; }},
      configurable: true,
    }});
    Object.defineProperty(navigator, 'languages', {{
      get: function() {{ return ['{lang_escaped}', '{lang_primary}', 'en']; }},
      configurable: true,
    }});
  }} catch (e) {{}}
}})();
"""


async def apply_consistency(
    context: BrowserContext, timezone: str, language: str,
) -> None:
    """注入脚本设置时区和语言(确保与 IP 地理位置一致)。

    Args:
        context: Playwright BrowserContext(async)
        timezone: 目标时区(如 "Asia/Shanghai")
        language: 目标语言(如 "zh-CN")
    """
    script = _build_timezone_consistency_script(timezone, language)
    await context.add_init_script(script)
    logger.debug(
        "[timezone_geo] 时区-语言一致性脚本已注入: tz=%s lang=%s",
        timezone, language,
    )


__all__ = [
    "GeoInfo",
    "ConsistencyReport",
    "TimezoneGeoValidator",
    "get_timezone_geo_validator",
    "apply_consistency",
    "_build_timezone_consistency_script",
]
