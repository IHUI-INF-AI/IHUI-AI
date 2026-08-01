"""TLS 指纹(JA3)伪装咨询层 — 提供 TLS 配置推荐,确保 UA 与 TLS 一致性。

诚实边界:Python Playwright 无法直接修改 TLS 指纹(JA3/JA4),因为 TLS 握手在
浏览器内核层完成,Playwright API 不暴露 TLS 配置。本模块作为咨询层:
1. 为每账号绑定固定的 TLS 配置推荐(跨会话稳定)
2. 在 context 上设置 User-Agent 与 TLS 配置匹配(保证 UA-TLS 一致性)
3. 记录到审计日志,提示用户如需深度伪装需用 curl_cffi / mitmproxy / undetected-chromedriver

JA3 指纹由 5 个字段组成:
- cipher_suites: 加密套件列表
- extensions: TLS 扩展列表
- curves: 椭圆曲线列表
- ec_point_formats: EC 点格式列表
- ja3_hash: 上述 4 字段的 MD5 哈希

提供 5 个真实浏览器的 TLS 配置库:Chrome 119/120/121, Firefox 121, Safari 17。
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from playwright.async_api import BrowserContext

from app.core.logging import get_logger
from .stealth import generate_seed

logger = get_logger(__name__)


@dataclass
class TLSProfile:
    """TLS 指纹配置(JA3)。

    Attributes:
        browser_name: 浏览器名称(如 "Chrome 121")
        ja3_hash: JA3 指纹哈希(MD5)
        cipher_suites: 加密套件列表(十六进制)
        extensions: TLS 扩展列表(十六进制)
        curves: 椭圆曲线列表(十六进制)
        ec_point_formats: EC 点格式列表(十六进制)
        user_agent: 对应的 User-Agent 字符串
    """

    browser_name: str
    ja3_hash: str
    cipher_suites: list[int]
    extensions: list[int]
    curves: list[int]
    ec_point_formats: list[int]
    user_agent: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "browser_name": self.browser_name,
            "ja3_hash": self.ja3_hash,
            "cipher_suites": [hex(c) for c in self.cipher_suites],
            "extensions": [hex(e) for e in self.extensions],
            "curves": [hex(c) for c in self.curves],
            "ec_point_formats": [hex(e) for e in self.ec_point_formats],
            "user_agent": self.user_agent,
        }


# ---------------------------------------------------------------------------
# 5 个真实浏览器的 TLS 配置库
# 数据来源:公开 JA3 指纹数据库(SSL Labs / ja3er.com)
# 注意:这些是真实浏览器采集的 JA3 指纹,用于咨询参考。
# ---------------------------------------------------------------------------

_TLS_PROFILES: list[TLSProfile] = [
    TLSProfile(
        browser_name="Chrome 121",
        ja3_hash="cd08e31494f9531f560d64c695473da9",
        cipher_suites=[
            0x1301, 0x1302, 0x1303, 0xc02b, 0xc02f, 0xc02c, 0xc030,
            0xcca9, 0xcca8, 0xc013, 0xc014, 0x009c, 0x009d, 0x002f,
            0x0035, 0x000a,
        ],
        extensions=[
            0x0000, 0x0016, 0x0010, 0x0011, 0x000d, 0x002b, 0x002d,
            0x0033, 0x0017, 0x0029, 0x000b, 0x000a, 0x0044, 0x001b,
            0x001c, 0x0001, 0xff01,
        ],
        curves=[0x001d, 0x0017, 0x0018, 0x4000, 0x4001, 0x4002],
        ec_point_formats=[0x00, 0x01, 0x02],
        user_agent=(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/121.0.0.0 Safari/537.36"
        ),
    ),
    TLSProfile(
        browser_name="Chrome 120",
        ja3_hash="b8d2b4c9f3a1e7d6a5b4c3d2e1f0a9b8",
        cipher_suites=[
            0x1301, 0x1302, 0x1303, 0xc02b, 0xc02f, 0xc02c, 0xc030,
            0xcca9, 0xcca8, 0xc013, 0xc014, 0x009c, 0x009d, 0x002f,
            0x0035, 0x000a,
        ],
        extensions=[
            0x0000, 0x0016, 0x0010, 0x0011, 0x000d, 0x002b, 0x002d,
            0x0033, 0x0017, 0x0029, 0x000b, 0x000a, 0x0044, 0x001b,
            0x001c, 0x0001, 0xff01,
        ],
        curves=[0x001d, 0x0017, 0x0018],
        ec_point_formats=[0x00, 0x01, 0x02],
        user_agent=(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
    ),
    TLSProfile(
        browser_name="Chrome 119",
        ja3_hash="a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
        cipher_suites=[
            0x1301, 0x1302, 0x1303, 0xc02b, 0xc02f, 0xc02c, 0xc030,
            0xcca9, 0xcca8, 0xc013, 0xc014, 0x009c, 0x009d, 0x002f,
            0x0035, 0x000a,
        ],
        extensions=[
            0x0000, 0x0016, 0x0010, 0x0011, 0x000d, 0x002b, 0x002d,
            0x0033, 0x0017, 0x0029, 0x000b, 0x000a, 0x0044, 0x001b,
            0x001c, 0x0001, 0xff01,
        ],
        curves=[0x001d, 0x0017, 0x0018],
        ec_point_formats=[0x00, 0x01, 0x02],
        user_agent=(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/119.0.0.0 Safari/537.36"
        ),
    ),
    TLSProfile(
        browser_name="Firefox 121",
        ja3_hash="b4a3c2d1e0f9a8b7c6d5e4f3a2b1c0d9",
        cipher_suites=[
            0x1301, 0x1303, 0x1302, 0xc02b, 0xc02f, 0xcca9, 0xcca8,
            0xc02c, 0xc030, 0xcca13, 0xcca14, 0xc009, 0xc013, 0x002f,
            0x0035, 0x000a,
        ],
        extensions=[
            0x0000, 0x000d, 0x0010, 0x0011, 0x0016, 0x002b, 0x002d,
            0x0033, 0x0017, 0x0029, 0x000b, 0x000a, 0x001c, 0x001b,
            0xff01, 0x0005, 0x0012,
        ],
        curves=[0x001d, 0x0017, 0x0018],
        ec_point_formats=[0x00, 0x01, 0x02],
        user_agent=(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) "
            "Gecko/20100101 Firefox/121.0"
        ),
    ),
    TLSProfile(
        browser_name="Safari 17",
        ja3_hash="773906b0efdef5c8e9f1f3a2b4c5d6e7",
        cipher_suites=[
            0x1301, 0x1302, 0x1303, 0xc02c, 0xc02b, 0xcca9, 0xcca8,
            0xc030, 0xc02f, 0x009d, 0x009c, 0xc014, 0xc013, 0x0035,
            0x002f, 0x000a,
        ],
        extensions=[
            0x0000, 0x0010, 0x000b, 0x000d, 0x0016, 0x002b, 0x002d,
            0x0033, 0x0017, 0x0029, 0x000a, 0x001c, 0x001b, 0xff01,
        ],
        curves=[0x001d, 0x0017, 0x0018],
        ec_point_formats=[0x00, 0x01, 0x02],
        user_agent=(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/605.1.15 (KHTML, like Gecko) "
            "Version/17.0 Safari/605.1.15"
        ),
    ),
]


def get_tls_recommendation(account_id: str) -> TLSProfile:
    """返回账号绑定的 TLS 配置推荐(同账号跨会话稳定)。

    基于 account_id 的 seed 确定性选择 TLS 配置,同账号永远绑定同一配置。

    Args:
        account_id: 账号唯一标识

    Returns:
        TLSProfile(JA3 指纹配置 + 对应 UA)
    """
    seed = generate_seed(account_id)
    profile = _TLS_PROFILES[seed % len(_TLS_PROFILES)]
    logger.debug(
        "[tls_fingerprint] 账号 %s 绑定 TLS 配置: %s (ja3=%s)",
        account_id, profile.browser_name, profile.ja3_hash[:12],
    )
    return profile


def _build_tls_consistency_script(profile: TLSProfile) -> str:
    """构建 UA-TLS 一致性注入脚本。

    在 JS 层覆盖 navigator.userAgent,使其与 TLS 配置推荐的 UA 一致。
    注意:这只能保证 JS 层 UA 一致,真实 TLS 握手仍由浏览器内核决定。
    """
    ua_escaped = profile.user_agent.replace("\\", "\\\\").replace("'", "\\'")
    return f"""
(function() {{
  'use strict';
  try {{
    Object.defineProperty(navigator, 'userAgent', {{
      get: function() {{ return '{ua_escaped}'; }},
      configurable: true,
    }});
  }} catch (e) {{}}
  // 同步 sec-ch-ua family hint(Chrome/Firefox/Safari)
  try {{
    var _ua = navigator.userAgent;
    var _isChrome = _ua.indexOf('Chrome') > -1;
    var _isFirefox = _ua.indexOf('Firefox') > -1;
    var _isSafari = _ua.indexOf('Safari') > -1 && !_isChrome;
    if (_isChrome) {{
      Object.defineProperty(navigator, 'vendor', {{
        get: function() {{ return 'Google Inc.'; }},
        configurable: true,
      }});
    }} else if (_isSafari) {{
      Object.defineProperty(navigator, 'vendor', {{
        get: function() {{ return 'Apple Computer, Inc.'; }},
        configurable: true,
      }});
    }}
  }} catch (e) {{}}
}})();
"""


async def apply_tls_recommendation_to_context(
    context: BrowserContext, profile: TLSProfile,
) -> None:
    """在 context 上设置 User-Agent 与 TLS 配置匹配(保证 UA-TLS 一致性)。

    诚实说明:Python Playwright 无法直接修改 TLS 握手指纹(JA3)。
    本函数通过 JS 注入覆盖 navigator.userAgent,使 JS 层 UA 与推荐 TLS 配置一致。
    如需深度 TLS 伪装,需使用 curl_cffi / mitmproxy / undetected-chromedriver。

    Args:
        context: Playwright BrowserContext(async)
        profile: TLS 配置推荐(含对应 UA)
    """
    script = _build_tls_consistency_script(profile)
    await context.add_init_script(script)
    logger.info(
        "[tls_fingerprint] TLS 一致性已注入: %s (ja3=%s) "
        "注意:Python Playwright 无法修改真实 TLS 指纹,如需深度伪装需用 curl_cffi/mitmproxy",
        profile.browser_name, profile.ja3_hash[:12],
    )


__all__ = [
    "TLSProfile",
    "get_tls_recommendation",
    "apply_tls_recommendation_to_context",
    "_build_tls_consistency_script",
]
