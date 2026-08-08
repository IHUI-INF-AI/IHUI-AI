"""语言偏好一致性 — 拦截语言相关 API,校验语言/时区/IP 三者一致。

检测原理:navigator.language / navigator.languages / Intl.DateTimeFormat().resolvedOptions().locale
是语言偏好指纹。如果浏览器语言(zh-CN)与 IP 地理位置(美国)不一致,则判定为"使用代理/
伪造语言"→ 触发风控。

对抗策略:
1. 拦截 navigator.language / navigator.languages,返回 [language, language-region]
2. 拦截 Intl.DateTimeFormat().resolvedOptions().locale,返回 language-region
3. 拦截 navigator.imeMode,返回 'auto'
4. 提供 validate_language_consistency 校验语言/时区/IP 三者一致性

语言一致性校验:
- 语言前缀(zh/en/ja/ko)应与 IP 所在国家匹配
- 时区应与 IP 所在地理位置一致
- 三者不一致时返回 False
"""
from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from playwright.async_api import BrowserContext

from app.core.logging import get_logger
from .timezone_geo_consistency import get_timezone_geo_validator

logger = get_logger(__name__)


# 语言前缀→国家代码映射
_LANGUAGE_COUNTRY_MAP: dict[str, str] = {
    "zh": "CN",
    "zh-CN": "CN",
    "zh-TW": "TW",
    "zh-HK": "HK",
    "en": "US",
    "en-US": "US",
    "en-GB": "GB",
    "ja": "JP",
    "ja-JP": "JP",
    "ko": "KR",
    "ko-KR": "KR",
}

# 国家代码→时区映射(常见)
_COUNTRY_TIMEZONE_MAP: dict[str, str] = {
    "CN": "Asia/Shanghai",
    "TW": "Asia/Taipei",
    "HK": "Asia/Hong_Kong",
    "US": "America/New_York",
    "GB": "Europe/London",
    "JP": "Asia/Tokyo",
    "KR": "Asia/Seoul",
}


def _build_language_consistency_script(language: str, region: str) -> str:
    """构建语言一致性注入 JS 脚本。"""
    lang_region = f"{language}-{region}" if region else language
    lang_primary = language.split("-")[0] if "-" in language else language
    # 转义单引号
    lr_escaped = lang_region.replace("'", "\\'")
    lp_escaped = lang_primary.replace("'", "\\'")
    return f"""
(function() {{
  'use strict';

  // ---- 1. navigator.language / navigator.languages ----
  try {{
    Object.defineProperty(navigator, 'language', {{
      get: function() {{ return '{lr_escaped}'; }},
      configurable: true,
    }});
    Object.defineProperty(navigator, 'languages', {{
      get: function() {{ return ['{lr_escaped}', '{lp_escaped}', 'en']; }},
      configurable: true,
    }});
  }} catch (e) {{}}

  // ---- 2. Intl.DateTimeFormat().resolvedOptions().locale ----
  try {{
    var _origDTF = Intl.DateTimeFormat;
    Intl.DateTimeFormat = function(locale, options) {{
      var opts = options || {{}};
      // 如果调用方未指定 locale,使用我们的语言
      var loc = (arguments.length === 0 || !arguments[0]) ? '{lr_escaped}' : locale;
      return new _origDTF(loc, opts);
    }};
    Intl.DateTimeFormat.prototype = _origDTF.prototype;
    // 保留静态方法
    Intl.DateTimeFormat.supportedLocalesOf = _origDTF.supportedLocalesOf;
  }} catch (e) {{}}

  // ---- 3. navigator.imeMode ----
  // 返回 'auto'(真人默认值)
  try {{
    Object.defineProperty(navigator, 'imeMode', {{
      get: function() {{ return 'auto'; }},
      configurable: true,
    }});
  }} catch (e) {{}}

  // ---- 4. Intl.NumberFormat locale 一致性 ----
  try {{
    var _origNF = Intl.NumberFormat;
    Intl.NumberFormat = function(locale, options) {{
      var opts = options || {{}};
      var loc = (arguments.length === 0 || !arguments[0]) ? '{lr_escaped}' : locale;
      return new _origNF(loc, opts);
    }};
    Intl.NumberFormat.prototype = _origNF.prototype;
    Intl.NumberFormat.supportedLocalesOf = _origNF.supportedLocalesOf;
  }} catch (e) {{}}

}})();
"""


async def inject_language_guard(
    context: BrowserContext, language: str, region: str = "",
) -> None:
    """注入语言一致性脚本,拦截语言相关 API。

    Args:
        context: Playwright BrowserContext(async)
        language: 目标语言代码(如 "zh")
        region: 目标地区代码(如 "CN"),可选
    """
    script = _build_language_consistency_script(language, region)
    await context.add_init_script(script)
    lang_region = f"{language}-{region}" if region else language
    logger.debug(
        "[language_guard] 语言一致性已注入: %s", lang_region,
    )


async def validate_language_consistency(
    language: str, timezone: str, proxy_ip: str,
) -> bool:
    """校验语言/时区/IP 地理位置三者一致性。

    Args:
        language: 浏览器语言(如 "zh-CN")
        timezone: 浏览器时区(如 "Asia/Shanghai")
        proxy_ip: 代理出口 IP

    Returns:
        True 表示三者一致,False 表示不一致(应调整语言/时区或更换代理)
    """
    validator = get_timezone_geo_validator()
    # 复用 timezone_geo_consistency 的 IP 查询
    report = await validator.validate(
        account_id="_language_check",
        timezone=timezone,
        proxy_ip=proxy_ip,
        language=language,
    )

    if not report.consistent:
        logger.warning(
            "[language_guard] 语言/时区/IP 不一致: %s", report.suggestion,
        )
        return False

    # 额外校验:语言前缀与国家代码的映射一致性
    geo = report.geo_info
    if geo:
        expected_country = _LANGUAGE_COUNTRY_MAP.get(language, "")
        if expected_country and geo.country_code and expected_country != geo.country_code:
            # 特殊处理:zh-CN/zh-TW/zh-HK 都属于中文,但国家不同
            lang_prefix = language.split("-")[0] if "-" in language else language
            if lang_prefix == "zh" and geo.country_code in ("CN", "TW", "HK"):
                pass  # 中文系,允许跨地区
            else:
                logger.warning(
                    "[language_guard] 语言 %s 与 IP 国家 %s 不匹配",
                    language, geo.country_code,
                )
                return False

    return True


__all__ = [
    "inject_language_guard",
    "validate_language_consistency",
    "_build_language_consistency_script",
]
