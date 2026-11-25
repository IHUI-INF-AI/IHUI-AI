# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​‌​​​‌‍‍​‌​​‌‌‌​‌​‍‍‌‌‌​​​‌‌‌​‍‍​‌​‌​​‌‌‌​‍‍‌​​​​​‌‍‍​‌​​‌‌‌​‌​‍‍​‌​​​‌‌‌​‍‍​​‌‌‌‌​‌​‍‍‌‌‌​‌​​​‍‍‌​‌‌​‌‌‌‍‍‌‌​​​​​​⁠

"""凭证兼容层(2026-11-25 立)。

背景:扫码登录落库的是**扁平 cookie 名值对**(`.CNBlogsCookie`、`remember_user_token`、
`sessionid` ...),而部分适配器的契约是**一个 `cookie` 字符串**(如简书)。
旧实现只做 `credentials.get("cookie")`,于是"扫码明明成功了、库里也有一整套 cookie",
体检却报 `missing cookie` —— 这不是账号失效,是凭证形状没对齐。

本模块只做**形状补齐**,不改任何值:
- 仅对契约明确要求 `cookie` 的平台(``COOKIE_HEADER_PLATFORMS``)合成 header;
- 已有 `cookie` 字段时原样返回,不覆盖用户手工填的串;
- 空 key/空 value 丢弃,避免 `=;` 脏头。

为什么不放在 adapter 里:体检(session_keeper)和真实发布(scheduler)是两条取凭证路径,
各写一遍必然漂移;放这里两条路径共用同一份判据。
"""
from __future__ import annotations

from typing import Any

# 适配器契约要求 `cookie` 字符串、且扫码落库为扁平 cookie 对的平台。
# 新增平台时先确认 adapter.requires_credentials 里确实是 `cookie`。
COOKIE_HEADER_PLATFORMS = frozenset({"jianshu"})


def normalize_credentials(platform: str, credentials: dict[str, Any]) -> dict[str, Any]:
    """按平台契约补齐凭证形状;返回新 dict,不修改入参。"""
    if platform not in COOKIE_HEADER_PLATFORMS:
        return credentials
    if str(credentials.get("cookie") or "").strip():
        return credentials

    parts: list[str] = []
    for name, value in credentials.items():
        key = str(name or "").strip()
        if not key or key == "cookie":
            continue
        if not isinstance(value, str):
            continue
        val = value.strip()
        if val:
            parts.append(f"{key}={val}")
    if not parts:
        return credentials
    return {**credentials, "cookie": "; ".join(parts)}
