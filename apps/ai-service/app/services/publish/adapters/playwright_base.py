"""Playwright + 反风控五层防线 平台适配器基类(2026-08-12 抽取)。

背景:25 个 Playwright 适配器(36kr/acfun/六大号/知乎系等)此前各自复制了
约 180 行完全相同的骨架(stealth context 创建、cookie 注入、人类化填标题/正文、
标签/封面上传、发布按钮点击、成功信号判定),仅平台常量与个别判定不同。

本基类把骨架收敛为声明式配置 + 默认实现:
- 子类只声明:平台元数据、URL/选择器常量、cookie 规格、成功 URL 判定。
- verify_credentials / publish 默认实现覆盖全部标准流程。
- 特殊平台(视频类、CSDN Markdown 编辑器等)可覆写钩子方法。

差异点参数化说明:
- cookie_specs: [CookieSpec(name, domain, http_only, secure, same_site), ...]
- verify_logout_required:
    False → 登录页检测模式(出现"登录"按钮且无"退出"→ 判过期),36kr/acfun 型
    True  → 退出按钮必现模式(无"退出"/"logout" → 判过期),百度系/豆瓣/六大号型
- success_url_include / success_url_exclude: 发布成功 URL 判定(默认 /create,/login 排除)
"""
from __future__ import annotations

import hashlib
from typing import TYPE_CHECKING, Any

from app.core.logging import get_logger
from ..anti_risk import (
    create_stealth_browser_context,
    human_click,
    human_pause,
    human_type,
    simulate_reading,
)
from ..anti_risk.browser_factory import close_stealth_context
from ..base_adapter import BasePlatformAdapter, PublishContent, PublishResult

logger = get_logger(__name__)

try:
    from playwright.async_api import async_playwright

    _HAS_PLAYWRIGHT = True
except ImportError:
    _HAS_PLAYWRIGHT = False

if TYPE_CHECKING:
    from playwright._impl._api_structures import SetCookieParam


class CookieSpec:
    """cookie 规格(声明式,供 _cookies 生成 SetCookieParam)。"""

    __slots__ = ("name", "domain", "http_only", "secure", "same_site")

    def __init__(
        self,
        name: str,
        domain: str,
        http_only: bool = False,
        secure: bool = False,
        same_site: str | None = None,
    ) -> None:
        self.name = name
        self.domain = domain
        self.http_only = http_only
        self.secure = secure
        self.same_site = same_site


class PlaywrightBaseAdapter(BasePlatformAdapter):
    """Playwright + 反风控五层防线通用基类。"""

    needs_browser = True

    # === 子类覆写 ===
    home_url = ""            # verify_credentials 用首页
    create_url = ""          # publish 用编辑器页
    title_selector = ""
    editor_selector = ""
    tag_selector = 'input[placeholder*="标签"], input[placeholder*="tag"]'
    publish_selector = ""
    success_selector = (
        ".success-tip, .msg-success, .el-message--success, "
        ".ant-message-success, .msg-success"
    )
    cookie_specs: list[CookieSpec] = []
    # 主 cookie 名(verify/publish 缺省检查 + 错误消息)
    primary_cookie = ""
    # verify 判定模式(见类 docstring)
    verify_logout_required = False
    # 发布参数
    max_title_len = 50
    max_tags = 3
    simulate_read_min = 10.0
    simulate_read_max = 30.0
    # 成功 URL 判定(包含/排除)
    success_url_include = ""
    success_url_exclude: tuple[str, ...] = ("create", "login")
    # 登录跳转 URL 标记(个别平台用 /signin)
    login_redirect_markers: tuple[str, ...] = ("login", "/login")
    # 可选分类选择器(六大号中的网易/腾讯/新浪需要,空则跳过分类步骤)
    category_selector = ""

    # === 可选钩子(默认行为 = 标准流程,子类按需覆写) ===

    def build_create_url(self, platform_config: dict[str, Any]) -> str:
        """构造发布页 URL(默认静态 create_url;动态平台如百度贴吧/虎扑覆写)。"""
        return self.create_url

    def validate_publish_config(self, platform_config: dict[str, Any]) -> str | None:
        """发布前配置校验(如贴吧名/版块 ID)。返回错误消息表示校验失败,None 表示通过。"""
        return None

    def extra_payload(self, platform_config: dict[str, Any]) -> dict[str, Any]:
        """成功 payload 附加字段(默认空;动态平台携带论坛名/版块 ID 等)。"""
        return {}

    # === 通用实现 ===

    def _cookies(self, credentials: dict[str, Any]) -> list[SetCookieParam]:
        result: list[SetCookieParam] = []
        for spec in self.cookie_specs:
            cookie: dict[str, Any] = {
                "name": spec.name,
                "value": credentials.get(spec.name, ""),
                "domain": spec.domain,
                "path": "/",
            }
            if spec.http_only:
                cookie["httpOnly"] = True
            if spec.secure:
                cookie["secure"] = True
            if spec.same_site:
                cookie["sameSite"] = spec.same_site
            result.append(cookie)  # type: ignore[arg-type]
        return result

    def _account_id(self, credentials: dict[str, Any], primary: str) -> str:
        """生成反风控账号标识(同账号跨会话稳定,绑定固定指纹/代理)。"""
        acct = credentials.get("account_id")
        if acct:
            return f"{self.platform_id}_{acct}"
        return f"{self.platform_id}_{hashlib.md5(primary.encode()).hexdigest()[:8]}"

    def _check_primary(self, credentials: dict[str, Any]) -> str | None:
        """返回主 cookie 值;缺失返回 None。"""
        return (credentials.get(self.primary_cookie) or "").strip() or None

    def _is_login_redirect(self, url: str) -> bool:
        return any(m in url.lower() for m in self.login_redirect_markers)

    def _is_success_url(self, url: str) -> bool:
        """发布成功 URL 判定(与各平台原实现一致)。

        - success_url_include 非空:URL 需包含且不含 exclude 项。
        - success_url_include 为空:URL 不含任何 exclude 项即判成功。
        """
        if self.success_url_include:
            return (
                self.success_url_include in url
                and not any(ex in url for ex in self.success_url_exclude)
            )
        return not any(ex in url for ex in self.success_url_exclude)

    def _verify_logged_in(self, content_text: str) -> tuple[bool, str]:
        """登录态判定。返回 (是否已登录, 失败原因)。"""
        if self.verify_logout_required:
            if "退出" not in content_text and "logout" not in content_text.lower():
                return False, "cookie may be expired (no logout button)"
            return True, ""
        if "登录" in content_text and "退出" not in content_text:
            return False, "cookie may be expired (login button visible)"
        return True, ""

    # === verify ===

    async def verify_credentials(self, credentials: dict[str, Any]) -> tuple[bool, str]:
        if not _HAS_PLAYWRIGHT:
            return (
                False,
                "Playwright not installed. Run: pip install playwright && playwright install chromium",
            )
        primary = self._check_primary(credentials)
        if not primary:
            return False, f"missing {self.primary_cookie} cookie"

        try:
            async with async_playwright() as p:
                browser, context = await create_stealth_browser_context(
                    account_id=self._account_id(credentials, primary),
                    platform=self.platform_id,
                    playwright_instance=p,
                    headless=True,
                )
                try:
                    await context.add_cookies(self._cookies(credentials))
                    page = await context.new_page()
                    await human_pause(1.0, 2.0)
                    await page.goto(self.home_url, wait_until="networkidle", timeout=30000)
                    url = page.url
                    if self._is_login_redirect(url):
                        return False, "cookie expired (redirected to login)"
                    content_text = await page.content()
                    ok, reason = self._verify_logged_in(content_text)
                    if not ok:
                        return False, reason
                    return True, f"connected ({self.primary_cookie} valid)"
                finally:
                    await close_stealth_context(browser, context)
        except Exception as e:
            return False, f"verify failed: {type(e).__name__}: {e}"

    # === publish ===

    async def publish(
        self,
        content: PublishContent,
        credentials: dict[str, Any],
        platform_config: dict[str, Any],
    ) -> PublishResult:
        if not _HAS_PLAYWRIGHT:
            return PublishResult(
                success=False,
                platform=self.platform_id,
                error_message="Playwright not installed. Run: pip install playwright && playwright install chromium",
            )
        primary = self._check_primary(credentials)
        if not primary:
            return PublishResult(
                success=False,
                platform=self.platform_id,
                error_message=f"missing {self.primary_cookie} cookie",
            )

        config_err = self.validate_publish_config(platform_config)
        if config_err:
            return PublishResult(
                success=False,
                platform=self.platform_id,
                error_message=config_err,
            )

        title = (content.title or "Untitled")[: self.max_title_len]
        body_text = content.html or content.text or ""
        tags = [str(t) for t in platform_config.get("tags", [])][: self.max_tags]
        category = platform_config.get("category", "") if self.category_selector else ""
        create_url = self.build_create_url(platform_config)

        try:
            async with async_playwright() as p:
                browser, context = await create_stealth_browser_context(
                    account_id=self._account_id(credentials, primary),
                    platform=self.platform_id,
                    playwright_instance=p,
                    headless=True,
                )
                try:
                    await context.add_cookies(self._cookies(credentials))
                    page = await context.new_page()

                    await human_pause(1.5, 3.0)
                    await page.goto(create_url, wait_until="networkidle", timeout=60000)
                    await simulate_reading(page, min_s=self.simulate_read_min, max_s=self.simulate_read_max)

                    if self._is_login_redirect(page.url):
                        return PublishResult(
                            success=False,
                            platform=self.platform_id,
                            error_message=f"cookie expired, please refresh {self.primary_cookie}",
                        )

                    await human_type(page, title, self.title_selector)
                    await human_pause(0.5, 1.0)

                    await human_click(page, self.editor_selector)
                    await human_pause(0.3, 0.6)
                    for paragraph in body_text.split("\n\n"):
                        text = paragraph.strip()
                        if not text:
                            continue
                        await page.evaluate(
                            """(text) => {
                                const ed = document.querySelector('%s');
                                if (ed) { ed.focus(); document.execCommand('insertText', false, text); }
                            }""" % self.editor_selector,
                            text,
                        )
                        await page.keyboard.press("Enter")
                        await human_pause(0.5, 1.2)

                    if category and self.category_selector:
                        try:
                            cat_select = page.locator(self.category_selector).first
                            if await cat_select.count() > 0:
                                await cat_select.select_option(label=str(category))
                                await human_pause(0.3, 0.6)
                        except Exception as e:
                            logger.warning(
                                "[%s] category select failed: %s", self.platform_id, e
                            )

                    if tags:
                        for tag in tags:
                            await human_type(page, tag, self.tag_selector)
                            await page.keyboard.press("Enter")
                            await human_pause(0.4, 0.8)

                    if content.cover_path:
                        try:
                            cover_input = page.locator(
                                'input[type="file"][accept*="image"]'
                            ).first
                            if await cover_input.count() > 0:
                                await cover_input.set_input_files(content.cover_path)
                                await page.wait_for_timeout(2000)
                        except Exception as e:
                            logger.warning(
                                "[%s] cover upload failed: %s", self.platform_id, e
                            )

                    await human_pause(1.0, 2.0)

                    publish_btn = page.locator(self.publish_selector).first
                    if await publish_btn.count() == 0:
                        return PublishResult(
                            success=False,
                            platform=self.platform_id,
                            error_message="publish button not found",
                        )
                    await human_click(page, self.publish_selector)

                    try:
                        await page.wait_for_load_state("networkidle", timeout=30000)
                    except Exception as e:
                        logger.debug(
                            "[%s] post-publish networkidle wait: %s",
                            self.platform_id,
                            e,
                        )
                    published = self._is_success_url(page.url)
                    if not published and await page.locator(self.success_selector).first.count() > 0:
                        published = True
                    if not published:
                        return PublishResult(
                            success=False,
                            platform=self.platform_id,
                            error_message="publish timeout (no success signal)",
                        )

                    payload: dict[str, Any] = {"title": title, "tags": tags}
                    if category:
                        payload["category"] = category
                    payload.update(self.extra_payload(platform_config))
                    return PublishResult(
                        success=True,
                        platform=self.platform_id,
                        published_url=page.url,
                        payload=payload,
                    )
                finally:
                    await close_stealth_context(browser, context)
        except Exception as e:
            return PublishResult(
                success=False,
                platform=self.platform_id,
                error_message=f"publish failed: {type(e).__name__}: {e}",
            )
