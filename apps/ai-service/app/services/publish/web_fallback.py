# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).

"""网页版发布兜底(2026-11-26)。

背景:抖音/快手/Medium/开源中国/头条号/WordPress/YouTube 这批账号的网页
cookie 是有效的,但原生适配器是 API-only,缺 access_token/app_id 就完全发不了。
这里把"网页后台真实登录态"接成发布器:复用 `platform_dom_selectors` 的选择器,
用 Playwright 打开真实编辑器、填标题正文、点发布。

边界:
- 只对**文章类**平台生效(头条号/Medium/开源中国/WordPress);视频平台另走视频链路。
- 只有在原生适配器缺发布凭据、且账号里确有网页 cookie 时才启用。
- 选择器可能随平台改版失效;失败要如实返回错误,不能伪造成功。
"""
from __future__ import annotations

import re
from dataclasses import replace
from typing import Any

from app.core.logging import get_logger

from .adapters.playwright_base import PlaywrightBaseAdapter
from .base_adapter import PublishContent, PublishResult
from .cookie_session import build_cookie_list, verify_cookie_session
from .platform_dom_selectors import get_selectors

logger = get_logger(__name__)

# 只有这些平台的网页编辑器结构与选择器已登记。
WEB_ARTICLE_PLATFORMS = ("toutiao", "medium", "oschina", "wordpress", "baijiahao")
# 视频平台网页发布器(抖音创作者后台)。
VIDEO_WEB_PLATFORMS = ("douyin",)


# 这些是 API 字段名,不是浏览器 cookie;`build_cookie_list` 会把任何字符串都当 cookie,
# 所以网页兜底必须先把它们剔掉,避免"只填了 app_id"也误判成有网页登录态。
_API_FIELD_NAMES = {
    "app_id", "app_secret", "access_token", "refresh_token", "client_id",
    "client_secret", "open_id", "integration_token", "site_url", "username",
    "application_password", "app_password", "signatureId", "UserToken",
    "UserSecret", "UserName", "uid",
}


def _has_cookie_material(platform: str, credentials: dict[str, Any]) -> bool:
    jar = credentials.get("__cookie_jar__")
    if isinstance(jar, list) and any(isinstance(c, dict) and c.get("name") for c in jar):
        return True
    names = {
        str(c.get("name") or "")
        for c in build_cookie_list(platform, credentials)
        if c.get("name")
    }
    return bool(names - _API_FIELD_NAMES)


def _plain_text(content: PublishContent) -> str:
    """把 formatter 产出的 HTML 转成编辑器可插入的纯文本(保留段落)。"""
    html = content.html or ""
    if not html:
        return content.text or ""
    try:
        from bs4 import BeautifulSoup

        text = BeautifulSoup(html, "html.parser").get_text("\n")
    except Exception:  # noqa: BLE001
        text = re.sub(r"<[^>]+>", "\n", html)
    lines = [line.strip() for line in text.splitlines()]
    return "\n\n".join(line for line in lines if line)


class WebArticleAdapter(PlaywrightBaseAdapter):
    """用网页后台发布文章;verify 走 verify_cookie_session,不认 API token。"""

    needs_browser = True
    requires_credentials: list[str] = []
    max_tags = 0
    verify_url_only = True
    tag_selector = ""
    category_selector = ""
    simulate_read_min = 5.0
    simulate_read_max = 12.0
    success_selector = (
        ".success-tip, .msg-success, .el-message--success, "
        ".ant-message-success, .publish-success, [class*='success']"
    )
    success_url_exclude = (
        "login", "signin", "passport", "publish", "create",
        "new-story", "write", "edit",
    )

    def _check_primary(self, credentials: dict[str, Any]) -> str | None:
        # API 适配器认 token;网页发布器只认"有没有可投递的 cookie"。
        return "web-session" if _has_cookie_material(self.platform_id, credentials) else None

    def _cookies(self, credentials: dict[str, Any]) -> list[Any]:
        return build_cookie_list(self.platform_id, credentials)  # type: ignore[return-value]

    async def verify_credentials(self, credentials: dict[str, Any]) -> tuple[bool, str]:
        return await verify_cookie_session(
            account_id=self.db_account_id,
            platform=self.platform_id,
            credentials=credentials,
        )

    async def publish(
        self,
        content: PublishContent,
        credentials: dict[str, Any],
        platform_config: dict[str, Any],
    ) -> PublishResult:
        # 不把 HTML 标签当正文插进富文本编辑器。
        body = _plain_text(content)
        plain = replace(content, html=body, text=body)
        return await super().publish(plain, credentials, platform_config)


def get_web_fallback(
    platform: str,
    native_adapter: Any,
    credentials: dict[str, Any] | None,
) -> WebArticleAdapter | Any | None:
    """原生适配器缺 API 凭据、且网页 cookie 可投递时,返回网页兜底实例。"""
    if credentials is None:
        return None

    if platform in VIDEO_WEB_PLATFORMS:
        if not _has_cookie_material(platform, credentials):
            return None
        if platform == "douyin":
            required = list(getattr(native_adapter, "requires_credentials", []) or [])
            if native_adapter is not None and required and all(
                credentials.get(name) for name in required
            ):
                return None
            from .douyin_web import DouyinWebAdapter

            logger.info("[web-fallback] douyin 启用创作者后台视频发布器")
            return DouyinWebAdapter()
        return None

    if platform not in WEB_ARTICLE_PLATFORMS:
        return None

    if platform == "baijiahao":
        # 百家号原生适配器仍是旧选择器（input.article-title / .ql-editor），
        # 与 2026-11 的 Lexical + UEditor 编辑器不一致；只要 cookie 可投递，
        # 就用本次实测通过的专用发布器覆盖掉旧实现。
        if _has_cookie_material(platform, credentials):
            from .baijiahao_web import BaijiahaoWebAdapter

            logger.info("[web-fallback] baijiahao 启用 Lexical/UEditor 专用发布器")
            return BaijiahaoWebAdapter()
        return None

    if native_adapter is not None:
        if getattr(native_adapter, "needs_browser", False):
            return None
        required = list(getattr(native_adapter, "requires_credentials", []) or [])
        if required and all(credentials.get(name) for name in required):
            # 原生 API 凭据齐全,优先走官方接口;网页兜底只在缺凭据时启用。
            return None
    if not _has_cookie_material(platform, credentials):
        return None

    if platform == "wordpress":
        # WordPress.com 的 Gutenberg 编辑器在 iframe 里，且发布是两段式；
        # 基类选择器流程无法覆盖，交给专用实现。
        from .wordpress_web import WordPressWebAdapter

        logger.info("[web-fallback] wordpress 启用 Gutenberg 专用发布器")
        return WordPressWebAdapter()

    if platform == "oschina":
        # 开源中国旧版 /blog/write 已 404，真实入口是个人空间的“智写平台”
        # /blog/ai-write，且发布是“发布文章 -> 确定并发布”两段式。
        from .oschina_web import OSChinaWebAdapter

        logger.info("[web-fallback] oschina 启用智写平台专用发布器")
        return OSChinaWebAdapter()

    sel = get_selectors(platform)
    if sel is None or not (sel.publish_url and sel.title_input and sel.content_editor and sel.submit_button):
        return None

    native_name = getattr(native_adapter, "platform_name", platform)

    class _Fallback(WebArticleAdapter):
        platform_id = platform
        platform_name = native_name
        home_url = sel.publish_url
        create_url = sel.publish_url
        title_selector = sel.title_input
        editor_selector = sel.content_editor
        publish_selector = sel.submit_button
        success_url_include = ""
        max_title_len = 60

    logger.info("[web-fallback] %s 原生适配器缺发布凭据,启用网页版发布器", platform)
    return _Fallback()
