# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""网页登录态校验(2026-11-26)。

部分平台当前适配器是开放平台 API 版(只认 access_token/app_id),但账号里
实际存着从网页扫码得到的 cookie。对这些平台,单看 API 字段会误判成 degraded。
本模块只在“API 凭据缺失 + cookie 存在”时补一次真实后台登录态校验:
打开创作者后台,能进后台才算通过;不靠 cookie 名字猜。
"""

from __future__ import annotations

from typing import Any

from app.core.logging import get_logger

logger = get_logger(__name__)

try:
    from playwright.async_api import async_playwright
    _HAS_PLAYWRIGHT = True
except ImportError:
    _HAS_PLAYWRIGHT = False


# 只登记已经实测过的平台;不把“cookie 名存在”当成登录成功。
COOKIE_HOME_URLS: dict[str, str] = {
    "kuaishou": "https://cp.kuaishou.com/profile",
    "medium": "https://medium.com/me/stories",
    "oschina": "https://my.oschina.net/",
    "wordpress": "https://wordpress.com/me",
    "youtube": "https://studio.youtube.com",
    "douyin": "https://creator.douyin.com/creator-micro/home",
    "toutiao": "https://mp.toutiao.com/profile_v4/index",
    "weibo": "https://card.weibo.com/article/v3/editor",
    "netease": "https://mp.163.com/",
    "qq": "https://om.qq.com/main",
}

COOKIE_DEFAULT_DOMAINS: dict[str, str] = {
    "kuaishou": ".kuaishou.com",
    "medium": ".medium.com",
    "oschina": ".oschina.net",
    "wordpress": ".wordpress.com",
    "youtube": ".google.com",
    "douyin": ".douyin.com",
    "toutiao": ".toutiao.com",
    "weibo": ".weibo.com",
    "netease": ".163.com",
    "qq": ".om.qq.com",
    # 掘金没有 __cookie_jar__ 的老账号只有扁平 cookie;补齐默认域后
    # sessionid/signatureId 才能被投递并参与保活(2026-11-26 修复假阴性)。
    "juejin": ".juejin.cn",
}

# 同一平台里不同 cookie 的归属域不同;不按名字区分会把 Google 登录 cookie
# 全塞到 youtube.com,或把 YouTube 会话 cookie 塞到 google.com。
PLATFORM_COOKIE_OVERRIDE_MAP: dict[str, dict[str, str]] = {
    "youtube": {
        "YSC": ".youtube.com",
        "PREF": ".youtube.com",
        "VISITOR_INFO1_LIVE": ".youtube.com",
        "__Secure-YNID": ".youtube.com",
        "__Secure-YEC": ".youtube.com",
    },
    "qq": {
        "RK": ".qq.com",
        "ptcz": ".qq.com",
        "pgv_pvid": ".qq.com",
        "pgv_info": ".qq.com",
        "qlogin_uid": ".qq.com",
        "_qpsvr_localtk": ".qq.com",
        "p_skey": ".graph.qq.com",
        "p_uin": ".graph.qq.com",
        "pt4_token": ".graph.qq.com",
        "pt_oauth_token": ".graph.qq.com",
        "ui": ".graph.qq.com",
        "pt_login_type": ".graph.qq.com",
        "supertoken": ".ptlogin2.qq.com",
        "superkey": ".ptlogin2.qq.com",
        "superuin": ".ptlogin2.qq.com",
        "uikey": ".ptlogin2.qq.com",
        "qrsig": ".ptlogin2.qq.com",
        "pt2gguin": ".ptlogin2.qq.com",
        "pt_login_sig": ".ptlogin2.qq.com",
        "pt_local_token": ".ptlogin2.qq.com",
        "pt_clientip": ".ptlogin2.qq.com",
        "pt_serverip": ".ptlogin2.qq.com",
        "pt_recent_uins": ".ptlogin2.qq.com",
        "pt_guid_sig": ".ptlogin2.qq.com",
        "ETK": ".ptlogin2.qq.com",
        "ts_last": ".om.qq.com",
        "ts_uid": ".om.qq.com",
        "userid": ".om.qq.com",
        "omaccesstoken": ".om.qq.com",
        "omtoken": ".om.qq.com",
        "logintype": ".om.qq.com",
        "srcopenid": ".om.qq.com",
        "srcaccessToken": ".om.qq.com",
        "TSID": "om.qq.com",
        "csrfToken": "om.qq.com",
        "__aegis_uid": ".xui.ptlogin2.qq.com",
    },
}

# 同一平台内需要按前缀归属的 cookie(QQ 登录名等带动态后缀)。
PLATFORM_COOKIE_PREFIX_RULES: dict[str, tuple[tuple[str, str], ...]] = {
    "qq": (
        ("ptnick_", ".ptlogin2.qq.com"),
        ("pt_", ".ptlogin2.qq.com"),
    ),
}

# __Host- 前缀的 cookie 规范禁止带 Domain,必须用 url 投递。
COOKIE_HOST_URLS: dict[str, str] = {
    "wordpress": "https://wordpress.com/",
    "youtube": "https://accounts.google.com/",
}

LOGIN_URL_MARKERS: dict[str, tuple[str, ...]] = {
    "kuaishou": ("passport.kuaishou.com", "/login", "signin"),
    "medium": ("/m/signin", "/signin", "/login"),
    "oschina": ("/action/user/hash_login", "/login", "signin"),
    "wordpress": ("/log-in", "/login", "signin"),
    "youtube": ("accounts.google.com", "consent.youtube.com", "/signin", "/login"),
    "douyin": ("passport.douyin.com", "/login", "signin"),
    "toutiao": ("auth/page/login", "/login", "signin"),
    "weibo": ("passport.weibo.com", "login.sina.com.cn", "/login", "signin"),
    "netease": ("login.html", "/login", "passport.163.com"),
    "qq": ("userAuth", "/login", "passport.qq.com"),
}

# 2026-11-26:抖音创作者后台未登录也会停在 /creator-micro/home,URL 不跳登录页,
# 只靠 URL 会假阳性。用页面正文的登录层特征兜底。
LOGIN_BODY_MARKERS: dict[str, tuple[str, ...]] = {
    "douyin": ("扫码登录", "验证码登录", "请登录"),
    "kuaishou": ("扫码登录", "登录"),
    "toutiao": ("扫码登录", "登录"),
    "weibo": ("扫码登录", "登录"),
    "netease": ("扫码登录", "手机号登录", "邮箱登录"),
    "qq": ("QQ登录", "微信登录", "请登录"),
}


def cookie_platform(platform: str) -> bool:
    """该平台是否有可用的网页登录态校验入口。"""
    return platform in COOKIE_HOME_URLS



def _cookie_item(
    platform: str,
    name: str,
    value: str,
    *,
    domain: str = "",
    path: str = "/",
) -> dict[str, Any] | None:
    """单枚 cookie → Playwright 形状;返回 None 表示这枚不可投递。"""
    if not name or not value:
        return None
    if name.startswith("__Host-"):
        host_url = COOKIE_HOST_URLS.get(platform)
        if not host_url:
            return None
        return {
            "name": name,
            "value": value,
            "url": host_url,
            "secure": True,
        }
    item: dict[str, Any] = {
        "name": name,
        "value": value,
        "domain": domain or COOKIE_DEFAULT_DOMAINS.get(platform, ""),
        "path": path or "/",
    }
    if not domain:
        for prefix, mapped in PLATFORM_COOKIE_PREFIX_RULES.get(platform, ()):
            if name.startswith(prefix):
                item["domain"] = mapped
                break
    if not item["domain"]:
        return None
    if name.startswith("__Secure-"):
        item["secure"] = True
    return item


def build_cookie_list(platform: str, credentials: dict[str, Any]) -> list[dict[str, Any]]:
    """把账号凭据里的 cookie 统一成 Playwright add_cookies 的形状。

    优先用 `__cookie_jar__` 的完整字段(domain/path/expires/httpOnly/secure/sameSite);
    没有 jar 时用平台默认域名补 domain,保留 cookie 名和值。
    """
    jar = credentials.get("__cookie_jar__")
    if isinstance(jar, list) and jar:
        out: list[dict[str, Any]] = []
        for c in jar:
            if not isinstance(c, dict):
                continue
            name = str(c.get("name") or "")
            value = c.get("value")
            if not name or value is None:
                continue
            item = _cookie_item(
                platform, name, str(value),
                domain=str(c.get("domain") or ""),
                path=str(c.get("path") or "/"),
            )
            if item is None:
                continue
            expires = c.get("expires")
            if isinstance(expires, (int, float)) and expires and expires > 0:
                item["expires"] = int(expires)
            same_site = str(c.get("sameSite") or "").lower()
            if same_site in ("lax", "strict", "none"):
                item["sameSite"] = "None" if same_site == "none" else same_site.capitalize()
            if c.get("httpOnly"):
                item["httpOnly"] = True
            if c.get("secure"):
                item["secure"] = True
            out.append(item)
        return out

    out = []
    overrides = PLATFORM_COOKIE_OVERRIDE_MAP.get(platform, {})
    for name, value in credentials.items():
        if name == "__cookie_jar__" or not isinstance(value, str) or not value:
            continue
        name = str(name)
        item = _cookie_item(
            platform, name, value,
            domain=overrides.get(name, ""),
        )
        if item is not None:
            out.append(item)
    return out



def _login_redirect(platform: str, url: str) -> bool:
    lowered = (url or "").lower()
    markers = LOGIN_URL_MARKERS.get(platform, ("login", "signin", "passport"))
    return any(marker in lowered for marker in markers)


async def verify_cookie_session(
    *,
    account_id: int,
    platform: str,
    credentials: dict[str, Any],
) -> tuple[bool, str]:
    """用账号里的 cookie 打开创作者后台,验证网页登录态是否仍有效。"""
    home = COOKIE_HOME_URLS.get(platform)
    cookies = build_cookie_list(platform, credentials)
    if not home:
        return False, "该平台暂无网页登录态校验入口"
    if not cookies:
        return False, "缺少 cookie"
    if not _HAS_PLAYWRIGHT:
        return False, "Playwright 未安装"

    from app.services.publish.anti_risk import create_stealth_browser_context
    from app.services.publish.anti_risk.browser_factory import close_stealth_context

    try:
        async with async_playwright() as p:
            browser, context = await create_stealth_browser_context(
                account_id=str(account_id),
                platform=platform,
                playwright_instance=p,
                headless=True,
            )
            try:
                await context.add_cookies(cookies)  # type: ignore[arg-type]
                page = await context.new_page()
                await page.goto(home, wait_until="domcontentloaded", timeout=25000)
                await page.wait_for_timeout(4000)
                final_url = page.url
                if _login_redirect(platform, final_url):
                    return False, f"cookie expired (redirected to login: {final_url[:120]})"
                body_markers = LOGIN_BODY_MARKERS.get(platform, ())
                if body_markers:
                    body = await page.inner_text("body")
                    hit = next((m for m in body_markers if m in body), "")
                    if hit:
                        return False, f"cookie expired (login layer visible: {hit})"
                return True, f"web cookie valid ({final_url[:120]})"
            finally:
                await close_stealth_context(browser, context)
    except Exception as e:
        return False, f"cookie verify failed: {type(e).__name__}: {str(e)[:180]}"
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
