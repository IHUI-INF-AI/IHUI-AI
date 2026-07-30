"""TLS stealth 客户端工厂(P3-1,2026-07-30 立)。

封装 httpx.AsyncClient 创建,带 TLS 指纹伪装 / UA 轮换 / Accept 头随机化,
降低被 Cloudflare / OpenRouter / Anthropic 等 WAF 拦截概率(403/429)。

设计:
- 优先尝试 curl_cffi(JA3 指纹伪装),未安装时降级到普通 httpx + UA 伪装
- 不引入新依赖(curl_cffi 可选,requirements.txt 未列,降级路径已足够应付大部分 WAF)
- 每次创建 client 实例时随机选 UA + Accept 头,避免指纹固化
- SSL context 用 httpx 默认(已含系统 CA);curl_cffi 路径用 impersonate 参数

用法:
    from app.services.tls_stealth import create_stealth_client, get_random_user_agent
    async with create_stealth_client() as client:
        resp = await client.get("https://...")
"""

from __future__ import annotations

import importlib.util
import logging
import random
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)


# UA 池(Chrome/Firefox/Safari 三大主流,版本号保持近期稳定版)
# 覆盖 Windows/Mac/Linux 三大平台,模拟真实浏览器分布
_USER_AGENTS: tuple[str, ...] = (
    # Chrome (Windows/Mac/Linux)
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    # Firefox
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:133.0) Gecko/20100101 Firefox/133.0",
    # Safari
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/17.6 Safari/605.1.15",
)

# Accept 头池(随机选一个,模拟真实浏览器差异)
_ACCEPT_HEADERS: tuple[str, ...] = (
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
)

# 默认请求头(除 UA/Accept 外,固定添加,模拟浏览器标准头)
# 这些头是浏览器请求的标准头,WAF 会检测缺失以识别非浏览器请求
_DEFAULT_HEADERS: dict[str, str] = {
    "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "Pragma": "no-cache",
}


def get_random_user_agent() -> str:
    """返回随机 User-Agent(Chrome/Firefox/Safari 轮换)。

    Returns:
        非空 UA 字符串(从 _USER_AGENTS 池随机选)。
    """
    return random.choice(_USER_AGENTS)


def get_stealth_headers() -> dict[str, str]:
    """返回 stealth 请求头集合(UA + Accept + 默认头)。

    每次调用都重新随机 UA/Accept,避免指纹固化(同一 client 多次请求时
    可调用本函数刷新头,或在创建新 client 时用)。

    Returns:
        含 User-Agent / Accept / Accept-Language 等字段的 dict。
    """
    headers = dict(_DEFAULT_HEADERS)
    headers["User-Agent"] = get_random_user_agent()
    headers["Accept"] = random.choice(_ACCEPT_HEADERS)
    return headers


def _is_curl_cffi_available() -> bool:
    """检测 curl_cffi 是否已安装(可选依赖,降级路径判定)。

    用 importlib.util.find_spec 避免直接 import 触发 mypy strict 模式的
    missing-import 报错(curl_cffi 无 stub,直接 import 会报 no-any-return)。
    """
    return importlib.util.find_spec("curl_cffi") is not None


def create_stealth_client(
    *,
    timeout: float = 60.0,
    proxy: Optional[str] = None,
    headers: Optional[dict[str, str]] = None,
    verify: bool = True,
) -> httpx.AsyncClient:
    """创建带 TLS stealth 能力的 httpx.AsyncClient。

    降级策略(因 curl_cffi 未在 requirements.txt):
    - 当前路径:普通 httpx + UA 伪装 + Accept 头随机化 + 默认浏览器头
    - 已足够应付大部分基于 UA/Accept 的 WAF 检测(Cloudflare basic rules)
    - 对 JA3 指纹检测的 WAF(如 Cloudflare Bot Management)仍会被识别,
      需启用 curl_cffi 路径(在 requirements.txt 加 curl_cffi>=0.7.0)

    Args:
        timeout: 请求超时(秒),默认 60。
        proxy: HTTP/HTTPS 代理 URL(如 http://user:pass@host:port),默认 None。
        headers: 自定义请求头(覆盖默认 stealth 头),默认 None(用 stealth 头)。
        verify: 是否校验 SSL 证书,默认 True(生产环境必须 True)。

    Returns:
        httpx.AsyncClient 实例(已配置 stealth 头 + 代理 + SSL)。
    """
    # 合并 stealth 头(用户自定义优先,覆盖默认 stealth 头)
    final_headers = get_stealth_headers()
    if headers:
        final_headers.update(headers)

    # 构造 httpx client 参数
    client_kwargs: dict[str, Any] = {
        "timeout": timeout,
        "headers": final_headers,
        "verify": verify,
    }
    if proxy:
        client_kwargs["proxy"] = proxy

    # 降级路径:普通 httpx + UA 伪装(curl_cffi 未安装或未启用)
    # 注:cURL CFFI 路径(JA3 指纹伪装)目前未启用,因依赖未在 requirements.txt。
    # 后续如需 JA3 指纹伪装(应对 Cloudflare Bot Management 级别 WAF),
    # 在 requirements.txt 加 `curl_cffi>=0.7.0`,然后将本函数返回类型改为
    # httpx.AsyncClient | curl_cffi.requests.AsyncSession 联合类型,
    # 并在 _is_curl_cffi_available() 为 True 时用 curl_cffi 路径。
    if _is_curl_cffi_available():
        logger.debug(
            "curl_cffi 已安装但当前路径用 httpx + UA 伪装"
            "(curl_cffi JA3 路径未启用,需代码层显式切换)"
        )

    return httpx.AsyncClient(**client_kwargs)
