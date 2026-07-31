"""浏览器指纹隔离 — 每账号独立固定指纹,跨会话稳定。

反风控核心:平台通过浏览器指纹(Canvas/WebGL/UA/屏幕/时区)识别"是否同一设备"。
如果所有账号用相同指纹 → 平台判定"同一设备操作多账号"→ 关联封号(交叉检测)。
本模块为每个账号生成确定性指纹(同账号永远同指纹,不同账号不同指纹),
让平台看到的是"不同设备的不同人"。

指纹要素(8 维):
1. user_agent      — Chrome UA(Windows 10/11 + Mac 轮换,版本对齐真实 Chrome)
2. viewport        — 屏幕分辨率(1920×1080 / 1366×768 / 1440×900 / 2560×1440)
3. locale          — zh-CN(中文用户统一,与 IP 地理位置匹配)
4. timezone_id     — Asia/Shanghai(与代理 IP 地理位置匹配)
5. geolocation     — 经纬度(北京/上海/广州/深圳/杭州/成都 等国内城市轮换)
6. color_scheme    — light/dark
7. extra_http_headers — Accept-Language / Sec-CH-UA 等与 UA 匹配
8. fingerprint_seed — Canvas/AudioContext 噪声种子(供 stealth.py 使用)

设计:
- generate_fingerprint(account_id) 基于 hash 确定性生成(同账号同指纹)
- 指纹池来自真实统计分布(避免异常值被识别)
- UA 与 Sec-CH-UA 严格匹配(品牌+版本一致,否则被检测)
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any

from app.core.logging import get_logger
from .stealth import generate_seed

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# 真实指纹池(来自统计分布,避免异常值)
# ---------------------------------------------------------------------------

# Chrome UA 池(仅主流版本,版本号与 Sec-CH-UA 严格对齐)
_USER_AGENTS: list[dict[str, str]] = [
    {
        "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "sec_ch_ua": '"Chromium";v="131", "Not_A Brand";v="24", "Google Chrome";v="131"',
        "sec_ch_ua_mobile": "?0",
        "sec_ch_ua_platform": '"Windows"',
        "platform": "Win32",
    },
    {
        "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        "sec_ch_ua": '"Chromium";v="130", "Not_A Brand";v="24", "Google Chrome";v="130"',
        "sec_ch_ua_mobile": "?0",
        "sec_ch_ua_platform": '"Windows"',
        "platform": "Win32",
    },
    {
        "ua": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "sec_ch_ua": '"Chromium";v="131", "Not_A Brand";v="24", "Google Chrome";v="131"',
        "sec_ch_ua_mobile": "?0",
        "sec_ch_ua_platform": '"macOS"',
        "platform": "MacIntel",
    },
    {
        "ua": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        "sec_ch_ua": '"Chromium";v="130", "Not_A Brand";v="24", "Google Chrome";v="130"',
        "sec_ch_ua_mobile": "?0",
        "sec_ch_ua_platform": '"macOS"',
        "platform": "MacIntel",
    },
]

# 屏幕分辨率池(主流尺寸,避免异常比例)
_VIEWPORTS: list[dict[str, int]] = [
    {"width": 1920, "height": 1080},
    {"width": 1366, "height": 768},
    {"width": 1440, "height": 900},
    {"width": 1536, "height": 864},
    {"width": 2560, "height": 1440},
    {"width": 1280, "height": 720},
]

# 国内城市经纬度(与 timezone Asia/Shanghai 匹配,与代理 IP 地理位置对应)
_GEOLOCATIONS: list[dict[str, float]] = [
    {"latitude": 39.9042, "longitude": 116.4074, "accuracy": 100},  # 北京
    {"latitude": 31.2304, "longitude": 121.4737, "accuracy": 100},  # 上海
    {"latitude": 23.1291, "longitude": 113.2644, "accuracy": 100},  # 广州
    {"latitude": 22.5431, "longitude": 114.0579, "accuracy": 100},  # 深圳
    {"latitude": 30.2741, "longitude": 120.1551, "accuracy": 100},  # 杭州
    {"latitude": 30.5728, "longitude": 104.0668, "accuracy": 100},  # 成都
    {"latitude": 34.3416, "longitude": 108.9398, "accuracy": 100},  # 西安
    {"latitude": 29.5630, "longitude": 106.5516, "accuracy": 100},  # 重庆
]


@dataclass
class BrowserFingerprint:
    """浏览器指纹(每账号固定,跨会话稳定)。

    所有字段基于账号 ID 确定性生成,同账号永远同指纹。
    """

    user_agent: str
    viewport: dict[str, int]
    locale: str
    timezone_id: str
    geolocation: dict[str, float]
    color_scheme: str  # 'light' | 'dark'
    platform: str  # navigator.platform
    sec_ch_ua: str
    sec_ch_ua_mobile: str
    sec_ch_ua_platform: str
    fingerprint_seed: int  # 供 stealth.py Canvas/AudioContext 噪声
    extra_http_headers: dict[str, str] = field(default_factory=dict)

    def to_context_options(self) -> dict[str, Any]:
        """转换为 Playwright new_context() 的参数。"""
        opts: dict[str, Any] = {
            "user_agent": self.user_agent,
            "viewport": self.viewport,
            "locale": self.locale,
            "timezone_id": self.timezone_id,
            "geolocation": self.geolocation,
            "color_scheme": self.color_scheme,
            "extra_http_headers": {
                "Accept-Language": f"{self.locale},{self.locale.split('-')[0]};q=0.9,en;q=0.8",
                "Sec-CH-UA": self.sec_ch_ua,
                "Sec-CH-UA-Mobile": self.sec_ch_ua_mobile,
                "Sec-CH-UA-Platform": self.sec_ch_ua_platform,
                **self.extra_http_headers,
            },
            "permissions": ["geolocation"],
        }
        return opts


def _hash_index(account_id: str, salt: str, modulus: int) -> int:
    """基于账号 ID + salt 确定性生成 [0, modulus) 区间索引。"""
    h = 0
    for ch in account_id + salt:
        h = (h * 31 + ord(ch)) & 0xFFFFFFFF
    return h % modulus if modulus > 0 else 0


def generate_fingerprint(account_id: str) -> BrowserFingerprint:
    """基于账号 ID 生成稳定的浏览器指纹。

    同账号永远生成相同指纹(跨会话稳定),不同账号生成不同指纹(反交叉检测)。

    Args:
        account_id: 账号唯一标识(如平台+用户名组合)

    Returns:
        BrowserFingerprint 实例
    """
    ua_idx = _hash_index(account_id, "ua_salt", len(_USER_AGENTS))
    vp_idx = _hash_index(account_id, "viewport_salt", len(_VIEWPORTS))
    geo_idx = _hash_index(account_id, "geo_salt", len(_GEOLOCATIONS))
    color_idx = _hash_index(account_id, "color_salt", 2)  # light/dark

    ua_pack = _USER_AGENTS[ua_idx]
    viewport = _VIEWPORTS[vp_idx]
    geolocation = _GEOLOCATIONS[geo_idx]
    color_scheme = "light" if color_idx == 0 else "dark"
    seed = generate_seed(account_id)

    fp = BrowserFingerprint(
        user_agent=ua_pack["ua"],
        viewport=viewport,
        locale="zh-CN",
        timezone_id="Asia/Shanghai",
        geolocation=geolocation,
        color_scheme=color_scheme,
        platform=ua_pack["platform"],
        sec_ch_ua=ua_pack["sec_ch_ua"],
        sec_ch_ua_mobile=ua_pack["sec_ch_ua_mobile"],
        sec_ch_ua_platform=ua_pack["sec_ch_ua_platform"],
        fingerprint_seed=seed,
    )
    logger.debug(
        "[fingerprint] 账号 %s 指纹生成:UA=%s viewport=%s geo=%s color=%s seed=%d",
        account_id, ua_pack["platform"], viewport, geolocation, color_scheme, seed,
    )
    return fp


__all__ = ["BrowserFingerprint", "generate_fingerprint"]
