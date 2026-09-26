# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""知乎 适配器(基于 Playwright 浏览器自动化 + 文章 API 发布流)。

凭证:{ z_c0, d_c0, _xsrf, ... 全部 Cookie }

实现:
- verify_credentials: 打开 https://www.zhihu.com 检查是否登录态
- publish:
  主路径(API 流,2026-09-15 立):在登录态页面上下文用 fetch 调知乎文章 API
    1) POST https://zhuanlan.zhihu.com/api/articles       创建草稿(返回 id)
    2) PUT  https://zhuanlan.zhihu.com/api/articles/<id>  修正(可选)
    3) PUT  https://zhuanlan.zhihu.com/api/articles/<id>/publish  发布
  成功判定:创建返回 id 且发布接口成功 → published_url = https://zhuanlan.zhihu.com/p/<id>
  fallback(DOM 流):execCommand('insertHTML') 注入已实测不可靠,仅作最后兜底,
                     失败时如实返回错误,禁止假成功。

反风控:接入 anti_risk 五层防线,所有输入/点击走 human_* (仅 DOM fallback 路径使用)。

注意:
- 需要 Playwright + chromium,缺依赖时 verify 返回明确错误
- 凭证仅 cookie,不需要 AppID
- 知乎编辑器为 Draft.js,insertHTML 注入对正文无效(已实测),故主路径改为 API。
"""
from __future__ import annotations

import re
from typing import TYPE_CHECKING, Any, cast

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
    from playwright.async_api import Browser, BrowserContext, Page, async_playwright
    _HAS_PLAYWRIGHT = True
except ImportError:
    _HAS_PLAYWRIGHT = False
    # playwright 未安装时 None 赋值给类型变量仅用于 is None 判定,
    # 真正使用前会先检查 _HAS_PLAYWRIGHT 标志,运行时不会访问这些占位符。
    Browser = BrowserContext = Page = None  # type: ignore[assignment,misc]

if TYPE_CHECKING:
    from playwright._impl._api_structures import SetCookieParam


class ZhihuAdapter(BasePlatformAdapter):
    platform_id = "zhihu"
    platform_name = "知乎"
    supported_formats = ["md", "html"]
    requires_credentials = ["z_c0", "_xsrf"]
    needs_browser = True

    # 知乎文章 API 基座
    _API_BASE = "https://zhuanlan.zhihu.com/api"
    _COLUMN_HOST = "https://zhuanlan.zhihu.com"

    def _all_cookies(self, credentials: dict[str, Any]) -> list[SetCookieParam]:
        """把凭证里所有字符串值转为 .zhihu.com 域 cookie(登录态建立)。

        知乎 z_c0/d_c0/_xsrf 等全部 Cookie 都挂在 .zhihu.com 下,
        注入后 zhuanlan/www 各子域均可携带,API fetch 同源自动带 cookie。
        """
        out: list[SetCookieParam] = []
        for name, value in credentials.items():
            if not isinstance(value, str) or not value:
                continue
            out.append({
                "name": name,
                "value": value,
                "domain": ".zhihu.com",
                "path": "/",
                "httpOnly": name in ("z_c0", "d_c0", "KLBRSID", "q_c1"),
                "secure": True,
                "sameSite": "Lax",
            })
        return out

    def _account_id(self, credentials: dict[str, Any]) -> str:
        """账号唯一 ID(反风控 profile/指纹的稳定锚点)—— 委托唯一出口,禁止在此另算。"""
        return self.account_identity(credentials)

    async def verify_credentials(self, credentials: dict[str, Any]) -> tuple[bool, str]:
        if not _HAS_PLAYWRIGHT:
            return False, "Playwright not installed. Run: pip install playwright && playwright install chromium"
        z_c0 = credentials.get("z_c0", "").strip()
        if not z_c0:
            return False, "missing z_c0 cookie"

        try:
            async with async_playwright() as p:
                browser, context = await create_stealth_browser_context(
                    account_id=self._account_id(credentials),
                    platform=self.platform_id,
                    playwright_instance=p,
                    headless=True,
                )
                try:
                    await context.add_cookies(self._all_cookies(credentials))
                    page = await context.new_page()
                    await human_pause(1.0, 2.0)
                    await page.goto("https://www.zhihu.com/", wait_until="networkidle", timeout=30000)
                    content = await page.content()
                    if "登录" in content and "写文章" not in content:
                        return False, "cookie expired or invalid (login button visible)"
                    return True, "connected (cookie valid)"
                finally:
                    await close_stealth_context(browser, context)
        except Exception as e:
            return False, f"verify failed: {type(e).__name__}: {e}"

    # ------------------------------------------------------------------
    # 主发布入口:优先 API 流,失败回退 DOM 流
    # ------------------------------------------------------------------

    async def verify_alive(
        self,
        *,
        content_id: str,
        credentials: dict[str, Any],
    ) -> bool:
        """API 实核:GET 文章是否存在(2026-09-15 新增,供发布后存活看护)。"""
        xsrf = credentials.get("_xsrf", "").strip()
        if not xsrf:
            return False
        try:
            async with async_playwright() as p:
                browser, context = await create_stealth_browser_context(
                    account_id=self._account_id(credentials),
                    platform=self.platform_id,
                    playwright_instance=p,
                    headless=True,
                )
                try:
                    await context.add_cookies(self._all_cookies(credentials))
                    page = await context.new_page()
                    await page.goto(
                        f"{self._COLUMN_HOST}/write",
                        wait_until="domcontentloaded", timeout=60000,
                    )
                    result = await page.evaluate(
                        """async ({cid, xsrf}) => {
                            const r = await fetch(
                                `https://zhuanlan.zhihu.com/api/articles/${cid}`,
                                {credentials:'include', headers:{'x-xsrftoken': xsrf}},
                            );
                            return r.status;
                        }""",
                        {"cid": str(content_id), "xsrf": xsrf},
                    )
                    return 200 <= int(result) < 300
                finally:
                    await close_stealth_context(browser, context)
        except Exception as e:
            logger.warning("[zhihu] verify_alive failed: %s", e)
            return False

    async def publish(
        self,
        content: PublishContent,
        credentials: dict[str, Any],
        platform_config: dict[str, Any],
    ) -> PublishResult:
        if not _HAS_PLAYWRIGHT:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="Playwright not installed. Run: pip install playwright && playwright install chromium",
            )
        z_c0 = credentials.get("z_c0", "").strip()
        if not z_c0:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="missing z_c0 cookie",
            )

        html = content.html or ""
        if not html and content.text:
            html = self._md_to_html(content.text)
        if not html:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="empty content (no html and no text)",
            )

        title = (content.title or "Untitled")[:100]
        topic_ids = platform_config.get("topic_ids", [])  # 知乎话题 ID

        # 打开浏览器,建立登录态会话(一次,API 流与 DOM 流复用)
        try:
            async with async_playwright() as p:
                browser, context = await create_stealth_browser_context(
                    account_id=self._account_id(credentials),
                    platform=self.platform_id,
                    playwright_instance=p,
                    headless=True,
                )
                try:
                    await context.add_cookies(self._all_cookies(credentials))
                    page = await context.new_page()
                    await human_pause(1.0, 2.0)

                    # ===== 主路径:API 流 =====
                    api_result = await self._publish_via_api(
                        page, credentials, title, html, topic_ids,
                    )
                    if api_result.success:
                        return api_result

                    logger.warning(
                        "[zhihu] API 流失败,回退 DOM 流: %s", api_result.error_message,
                    )
                    # ===== 兜底:DOM 流 =====
                    dom_result = await self._publish_via_dom(
                        page, credentials, title, html, topic_ids,
                    )
                    if dom_result.success:
                        return dom_result
                    # 两条路径都失败:返回 API 流的错误(更可信),附 DOM 错误信息
                    return PublishResult(
                        success=False, platform=self.platform_id,
                        published_url=api_result.published_url,
                        platform_content_id=api_result.platform_content_id,
                        error_message=(
                            f"API流: {api_result.error_message or '未知'}"
                            f" | DOM流: {dom_result.error_message or '未知'}"
                        ),
                        payload={"title": title, "topic_ids": topic_ids},
                    )
                finally:
                    await close_stealth_context(browser, context)
        except Exception as e:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"publish failed: {type(e).__name__}: {e}",
            )

    # ------------------------------------------------------------------
    # API 流
    # ------------------------------------------------------------------
    async def _publish_via_api(
        self,
        page: Page,
        credentials: dict[str, Any],
        title: str,
        html: str,
        topic_ids: list[Any],
    ) -> PublishResult:
        xsrf = credentials.get("_xsrf", "").strip()
        if not xsrf:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="missing _xsrf cookie (API 流必需)",
            )

        # 建立同源登录态:打开写文章页(会让 API 请求带上有效 cookie)
        try:
            await page.goto(
                f"{self._COLUMN_HOST}/write", wait_until="networkidle", timeout=60000,
            )
        except Exception as e:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"打开写文章页失败: {type(e).__name__}: {e}",
            )

        if "/signin" in page.url or "login" in page.url.lower():
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="cookie expired, please refresh z_c0",
            )

        # 2026-09-15 重构:创建→发布→GET 实核,两轮内容变体(原版/去外链版)。
        # 旧版只看 PUT /publish 状态码,假阳性(文章被反垃圾静默移除仍报成功)。
        import re as _re

        async def _attempt(html_variant: str) -> PublishResult:
            create_resp = await self._api_fetch(
                page, "POST", f"{self._API_BASE}/articles",
                {"title": title, "content": html_variant}, xsrf,
            )
            logger.info(
                "[zhihu][API] 创建草稿 status=%s body=%s",
                create_resp["status"], create_resp["text"][:500],
            )
            if create_resp["status"] < 200 or create_resp["status"] >= 300:
                return PublishResult(
                    success=False, platform=self.platform_id,
                    error_message=f"创建草稿失败 HTTP {create_resp['status']}: {create_resp['text'][:300]}",
                )
            try:
                create_json = create_resp["json"]
            except Exception:
                return PublishResult(
                    success=False, platform=self.platform_id,
                    error_message=f"创建草稿响应非 JSON: {create_resp['text'][:300]}",
                )
            article_id = create_json.get("id")
            if not article_id:
                return PublishResult(
                    success=False, platform=self.platform_id,
                    error_message=f"创建草稿未返回 id: {create_resp['text'][:300]}",
                )
            article_id = str(article_id)
            logger.info("[zhihu][API] 草稿已创建 id=%s", article_id)

            publish_body: dict[str, Any] | None = {
                "column": None,
                "commentPermission": "anyone",
            }
            publish_resp = await self._api_fetch(
                page, "PUT", f"{self._API_BASE}/articles/{article_id}/publish",
                publish_body, xsrf,
            )
            if publish_resp["status"] == 400:
                logger.info("[zhihu][API] 发布带body返回400,退化为空body重试")
                publish_resp = await self._api_fetch(
                    page, "PUT", f"{self._API_BASE}/articles/{article_id}/publish",
                    None, xsrf,
                )
            if publish_resp["status"] < 200 or publish_resp["status"] >= 300:
                return PublishResult(
                    success=False, platform=self.platform_id,
                    platform_content_id=article_id,
                    error_message=f"发布失败 HTTP {publish_resp['status']}: {publish_resp['text'][:300]}",
                )

            # GET 实核:文章必须真实存在(防假阳性核心)
            verify_resp = await self._api_fetch(
                page, "GET", f"{self._API_BASE}/articles/{article_id}", None, xsrf,
            )
            if verify_resp["status"] == 404:
                return PublishResult(
                    success=False, platform=self.platform_id,
                    platform_content_id=article_id,
                    error_message="文章发布后 GET 404(疑似被反垃圾移除或未持久化)",
                )
            published_url = f"{self._COLUMN_HOST}/p/{article_id}"
            return PublishResult(
                success=True, platform=self.platform_id,
                published_url=published_url,
                platform_content_id=article_id,
                payload={"title": title, "topic_ids": topic_ids, "flow": "api"},
            )

        # 变体1:原版 HTML;变体2:去外链(反垃圾对策,仅第一轮 GET 404 时启用)
        api_result = await _attempt(html)
        if api_result.success:
            return api_result
        logger.warning(
            "[zhihu][API] 变体1失败(%s),尝试去外链变体", api_result.error_message,
        )
        html_nolink = _re.sub(r"<a\s[^>]*href=[^>]*>(.*?)</a>", r"\1", html, flags=_re.S)
        if html_nolink != html:
            api_result = await _attempt(html_nolink)
            if api_result.success:
                return api_result
        return api_result

    async def _api_fetch(
        self,
        page: Page,
        method: str,
        url: str,
        body: dict[str, Any] | None,
        xsrf: str,
    ) -> dict[str, Any]:
        """在页面同源上下文里发起 fetch,返回 {status, text, json?}。"""
        # 2026-09-15 修复:page.evaluate 返回 Any,直接 return 触发 no-any-return;
        # 旧 type: ignore[return-value] 码位不对(被 warn_unused_ignores 判未使用)。
        # 改用 cast 显式收窄(page.evaluate 的 JS 侧恒返回 {status,text,json} 对象)。
        result = cast(
            "dict[str, Any]",
            await page.evaluate(
                """async ({method, url, body, xsrf}) => {
                const headers = {'Content-Type': 'application/json', 'x-xsrftoken': xsrf};
                const init = {method, headers, credentials: 'same-origin'};
                if (body !== null) init.body = JSON.stringify(body);
                try {
                    const resp = await fetch(url, init);
                    const text = await resp.text();
                    let json = null;
                    try { json = JSON.parse(text); } catch (e) {}
                    return {status: resp.status, text, json};
                } catch (e) {
                    return {status: 0, text: String(e), json: null};
                }
            }""",
                {"method": method, "url": url, "body": body, "xsrf": xsrf},
            ),
        )
        return result

    # ------------------------------------------------------------------
    # DOM 流(兜底,已实测 insertHTML 不可靠)
    # ------------------------------------------------------------------
    async def _publish_via_dom(
        self,
        page: Page,
        credentials: dict[str, Any],
        title: str,
        html: str,
        topic_ids: list[Any],
    ) -> PublishResult:
        try:
            # 若当前不在写文章页(可能 API 流已导航),重新打开
            if "/write" not in page.url:
                await page.goto(
                    f"{self._COLUMN_HOST}/write", wait_until="networkidle", timeout=60000,
                )
            if "/signin" in page.url or "login" in page.url.lower():
                return PublishResult(
                    success=False, platform=self.platform_id,
                    error_message="cookie expired, please refresh z_c0",
                )

            await simulate_reading(page, min_s=3.0, max_s=8.0)

            # 填标题(人类化逐字符)
            title_selector = 'textarea[placeholder*="标题"], input[placeholder*="标题"]'
            await human_type(page, title, title_selector)
            await human_pause(0.5, 1.0)

            # 填正文(知乎用 contenteditable div,直接 setInnerHtml 或 paste)
            editor_selector = '.public-DraftEditor-content, [contenteditable="true"]'
            await page.locator(editor_selector).first.click()
            await human_pause(0.3, 0.6)
            await page.evaluate(
                """(html) => {
                    const editor = document.querySelector('.public-DraftEditor-content, [contenteditable="true"]');
                    if (!editor) return;
                    editor.focus();
                    document.execCommand('insertHTML', false, html);
                }""",
                html,
            )

            if topic_ids:
                try:
                    topic_btn_selector = 'button:has-text("话题"), input[placeholder*="话题"]'
                    if await page.locator(topic_btn_selector).count() > 0:
                        await human_click(page, topic_btn_selector)
                        for tid in topic_ids[:5]:
                            topic_input_selector = 'input[placeholder*="搜索话题"]'
                            await human_type(page, str(tid), topic_input_selector)
                            await page.wait_for_timeout(500)
                            candidate_selector = '.topic-suggest li, .topic-item'
                            if await page.locator(candidate_selector).count() > 0:
                                await human_click(page, candidate_selector)
                except Exception as e:
                    logger.warning("[zhihu][DOM] topic select failed: %s", e)

            await simulate_reading(page, min_s=2.0, max_s=5.0)
            await human_pause(1.0, 2.0)

            publish_selector = 'button:has-text("发布"), button.PublishButton'
            if await page.locator(publish_selector).count() == 0:
                return PublishResult(
                    success=False, platform=self.platform_id,
                    error_message="publish button not found",
                )
            await human_click(page, publish_selector)

            try:
                await page.wait_for_url("**/p/**", timeout=30000)
            except Exception:
                return PublishResult(
                    success=False, platform=self.platform_id,
                    error_message="publish timeout (no redirect to /p/<id>)",
                )

            published_url = page.url
            parts = published_url.rstrip("/").split("/")
            article_id = parts[-1] if parts else ""

            return PublishResult(
                success=True, platform=self.platform_id,
                published_url=published_url,
                platform_content_id=article_id,
                payload={"title": title, "topic_ids": topic_ids, "flow": "dom"},
            )
        except Exception as e:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"DOM flow failed: {type(e).__name__}: {e}",
            )

    # ------------------------------------------------------------------
    # 兜底 md → HTML(当 content.html 为空时)
    # ------------------------------------------------------------------
    @staticmethod
    def _md_to_html(text: str) -> str:
        """极简 markdown → HTML 兜底(标题/列表/链接/加粗/段落/换行)。

        仅用于 content.html 缺失的兜底,正常发布走 content_parser 的 parse_md。
        """
        lines = text.split("\n")
        out: list[str] = []
        in_list = False

        def close_list() -> None:
            nonlocal in_list
            if in_list:
                out.append("</ul>")
                in_list = False

        for raw in lines:
            line = raw.rstrip()
            if not line.strip():
                close_list()
                continue
            # 标题
            m = re.match(r"^(#{1,6})\s+(.*)$", line)
            if m:
                close_list()
                level = len(m.group(1))
                out.append(f"<h{level}>{m.group(2).strip()}</h{level}>")
                continue
            # 无序列表
            m = re.match(r"^[-*+]\s+(.*)$", line)
            if m:
                if not in_list:
                    out.append("<ul>")
                    in_list = True
                out.append(f"<li>{m.group(1).strip()}</li>")
                continue
            # 普通段落(行内加粗/链接)
            close_list()
            out.append(f"<p>{ZhihuAdapter._inline(line)}</p>")
        close_list()
        return "".join(out)

    @staticmethod
    def _inline(line: str) -> str:
        line = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2">\1</a>', line)
        line = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", line)
        return line
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
