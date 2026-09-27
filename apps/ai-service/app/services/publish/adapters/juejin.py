# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""掘金 适配器(基于 Playwright 浏览器自动化框架)。

凭证:{ sessionid, signatureId }

实现:
- verify_credentials: 打开 https://juejin.cn 检查登录态
- publish: 打开 https://juejin.cn/editor/drafts/new → 填标题/内容 → 点发布

反风控:接入 anti_risk 五层防线,所有输入/点击走 human_*。
"""
from __future__ import annotations

import time
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


# ---------------------------------------------------------------------------
# 发布弹层选择器/文案的单一事实层(2026-09-27 重写;每条带证据等级)
#
# 本次只读探针因画像登录态已在服务端失效(anti-cookie-health 判 13|juejin
# invalid,editor 路由被重定向到 /login),**没能现场打开弹层**;以下事实的出处:
# 1. 「弹层最终提交按钮文案 = 确定并发布」—— 历史 publish timeout 事故排查的
#    线上实测结论(公开 chunk 检索不到该文案,它藏在登录后的懒加载分片里)。
# 2. 「提交接口 = content_api/v1/article/publish;草稿保存 = article_draft/create,
#    不是提交动作」—— 掘金自家生产 bundle 的 URL 字符串逐字核到
#    (取证存档 .ihui-agent/tmp/juejin-probe/endpoints.json)。
# 3. 「成功后 URL 经 /published 再重定向回首页;审核中文章地址是 /spost/<id>,
#    /post/<id> 审核通过后才存在」—— 线上实测结论 + 主站 bundle 路径指纹佐证。
#    ⇒ 旧判据等 URL 跳到 /post/ 那一招在审核期结构上等不到,属成功判据本身错。
# 4. 「分类下拉 = 小浮层+滚动列表(byte 系 dropdown),hover 触发、需 force click、
#    分类必选;旧代码假想的「名为 select 且 class 带 category-select 一族」DOM
#    在掘金根本不存在」—— 线上实测结论 + editor chunk 中 dropdown-content 命中 69 处。
# (旧代码面上那三条被证伪的字面串由 tests/test_juejin_publish_selectors.py 的
#  「源码反向锁」看守;本注释描述它们时不得逐字复现判据本体。)
# ---------------------------------------------------------------------------

#: 发布弹层「最终提交」按钮的候选文案(有序;首个在页面命中的即用)。
#: 「确定并发布」= 线上实测现行文案;「确认发布」保留为回退候选 ——
#: 多候选是为了文案变回去仍能命中,单字面量正是本次缺陷的成因。
PUBLISH_CONFIRM_TEXTS: tuple[str, ...] = ("确定并发布", "确认发布")

#: 编辑器顶栏「打开发布弹层」入口按钮候选(与弹层内最终确认按钮不同)。
PUBLISH_OPEN_TEXTS: tuple[str, ...] = ("完成并发布", "发布文章", "发布")

#: 提交接口 URL 特征(唯一允许当作成功证据的网络响应;草稿保存接口不在列)。
#: v1 逐字核自掘金线上 bundle;v2 是防御性候选(未见实测,命中才算)。
SUBMIT_API_PATTERNS: tuple[str, ...] = (
    "content_api/v1/article/publish",
    "content_api/v2/article/publish",
)

#: 提交成功后的过渡页路径特征(会被重定向回首页,必须先于超时捕获)。
PUBLISHED_URL_MARKERS: tuple[str, ...] = ("/published",)

#: 审核中文章地址前缀(拿到 article_id 后回填 published_url 用)。
SPOST_URL_PREFIX = "https://juejin.cn/spost/"

#: 发布弹层容器候选(byte 系浮层;保留泛化回退,不赌单一类名)。
PUBLISH_MODAL_SELECTORS: tuple[str, ...] = (
    '[class*="byte-modal"]',
    '[class*="modal"]',
    '[class*="popover"]',
)

#: 分类/标签下拉浮层的选项容器候选(小浮层+滚动列表)。
DROPDOWN_OPTION_SELECTORS: tuple[str, ...] = (
    '[class*="dropdown"] li',
    '[class*="popover"] li',
    '[class*="drop"] [class*="item"]',
    'ul[class*="list"] li',
)


def pick_first_text(texts: list[str], candidates: tuple[str, ...]) -> str | None:
    """在页面可见文案列表里按候选顺序挑第一个精确命中的项;判不出返回 None。

    纯函数,供 publish 流程与测试共用(测试用真实抓取的文案列表做夹具)。
    """
    normalized = [t.strip() for t in texts]
    for cand in candidates:
        if cand in normalized:
            return cand
    return None


def match_submit_api_url(url: str) -> bool:
    """该响应 URL 是否是真正的「提交文章」接口(草稿保存不算)。"""
    return any(pat in url for pat in SUBMIT_API_PATTERNS)


def extract_article_id_from_submit(payload: object) -> str | None:
    """从提交接口响应 JSON 提取 article_id;不成立返回 None(调用方判错)。

    实测形态:``{"err_no": 0, "data": {"article_id": "7xxxxxxxxxxxxxxxxx"}}``。
    err_no 非 0 或缺 article_id 一律视为未成功,不得猜。
    """
    if not isinstance(payload, dict):
        return None
    if payload.get("err_no") not in (0, None):
        return None
    data = payload.get("data")
    if isinstance(data, dict):
        raw = data.get("article_id") or data.get("articleId") or data.get("id")
    else:
        raw = data
    if isinstance(raw, (str, int)) and str(raw).strip():
        return str(raw).strip()
    return None


def is_published_redirect(url: str) -> bool:
    """URL 是否落在「发布成功」过渡页(/published),重定向回首页前的观测点。"""
    return any(marker in url for marker in PUBLISHED_URL_MARKERS)


def find_option_in_list(labels: list[str], wanted: str) -> str | None:
    """在下拉浮层抓到的选项文案里挑与 wanted 匹配的**真实文案**。

    精确等值优先,其次互为包含(如「后端」⇄「后端开发」);都不命中返回
    None —— 调用方按「分类未能选中」报定位错误,绝不猜一个相近选项。
    """
    stripped = [t.strip() for t in labels]
    if wanted in stripped:
        return wanted
    for t in stripped:
        if t and (wanted in t or t in wanted):
            return t
    return None


def visible_text_collector_js() -> str:
    """注入用 JS:收集当前页面所有可见元素文本(按钮/浮层项)。

    与 tests 里「真实 DOM 片段 → 文案列表」的解析共用同一份判据描述。
    """
    return """
    (selector) => {
      const vis = (el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
      };
      const out = [];
      document.querySelectorAll(selector).forEach((el) => {
        const t = (el.innerText || '').trim().replace(/\\s+/g, ' ');
        if (t && vis(el)) out.push(t);
      });
      return out;
    }
    """


def describe_stuck_stage(
    *,
    modal_opened: bool,
    category_selected: bool,
    submit_called: bool,
    submit_status: int | None,
    got_article_id: bool,
    published_landing: bool,
) -> str:
    """失败时点名「卡在哪一步」——替代旧的单句 publish timeout。

    判定顺序即诊断优先级;每档都带上可复核的事实,不写推测。
    """
    if not modal_opened:
        return "stuck=publish-modal-not-opened (点开发布弹层失败,未见 .byte-modal)"
    if not category_selected:
        return "stuck=category-not-selected (分类为必选项,弹层内未能选中)"
    if not got_article_id:
        if submit_called and submit_status is not None and submit_status >= 400:
            return f"stuck=submit-api-http-error (提交接口返回 HTTP {submit_status})"
        if submit_called:
            return "stuck=submit-api-no-article-id (提交接口 2xx 但响应里取不到 article_id)"
        return "stuck=submit-not-called (确认按钮未点击或点击后无提交请求)"
    if not published_landing:
        return "stuck=no-published-landing (拿到 article_id 但未观测到 /published 跳转)"
    return "stuck=unknown"



class JuejinAdapter(BasePlatformAdapter):
    platform_id = "juejin"
    platform_name = "掘金"
    supported_formats = ["md", "html"]
    requires_credentials = ["sessionid", "signatureId"]
    needs_browser = True

    def _cookies(self, credentials: dict[str, Any]) -> list[SetCookieParam]:
        return [
            {
                "name": "sessionid",
                "value": credentials.get("sessionid", ""),
                "domain": ".juejin.cn",
                "path": "/",
                "httpOnly": True,
            },
            {
                "name": "sessionid_ss",
                "value": credentials.get("sessionid", ""),
                "domain": ".juejin.cn",
                "path": "/",
                "httpOnly": True,
            },
            {
                "name": "sid_guard",
                "value": credentials.get("signatureId", ""),
                "domain": ".juejin.cn",
                "path": "/",
                "httpOnly": True,
            },
        ]

    def _account_id(self, credentials: dict[str, Any]) -> str:
        """账号唯一 ID(反风控 profile/指纹的稳定锚点)—— 委托唯一出口,禁止在此另算。"""
        return self.account_identity(credentials)

    async def _select_category_in_modal(
        self, page: Any, category: str
    ) -> tuple[bool, str]:
        """在发布弹层里选中分类(必选项)。

        掘金实测形态:分类是**小浮层下拉 + 滚动列表** —— 需要 hover 触发渲染、
        选项可能藏在滚动区里、点击需 force(浮层遮罩会拦截 pointer 事件)。
        返回 (是否选中, 失败定位详情);详情会并入最终 error_message。
        """
        trigger_selectors: tuple[str, ...] = (
            '[class*="category"] [class*="select"]',
            '[class*="category"] .byte-select',
            '[class*="category"]',
        )
        clicked_trigger = ""
        for sel in trigger_selectors:
            try:
                loc = page.locator(sel)
                if await loc.count() == 0:
                    continue
                await loc.first.hover()
                await human_pause(0.3, 0.7)
                await loc.first.click(force=True)
                clicked_trigger = sel
                break
            except Exception as e:
                logger.warning("juejin 分类触发器 %s 失败: %s", sel, e)
        if not clicked_trigger:
            return False, f"分类触发器未找到(候选={list(trigger_selectors)})"

        # 滚动列表:逐屏抓可见选项文案,最多滚 6 次
        seen_labels: list[str] = []
        for _ in range(6):
            for opt_sel in DROPDOWN_OPTION_SELECTORS:
                try:
                    texts: list[str] = await page.evaluate(
                        visible_text_collector_js(), opt_sel
                    )
                except Exception as e:
                    logger.warning("juejin 选项抓取 %s 失败: %s", opt_sel, e)
                    continue
                for t in texts:
                    if t not in seen_labels:
                        seen_labels.append(t)
                matched = find_option_in_list(texts, category)
                if matched:
                    try:
                        safe = matched.replace("\\", "").replace('"', "")
                        await page.locator(f'{opt_sel}:has-text("{safe}")').first.click(
                            force=True
                        )
                    except Exception as e:
                        logger.warning("juejin 分类选项点击失败: %s", e)
                        continue
                    # 复核:选中后分类文案应出现在弹层可见文本里
                    try:
                        page_text: str = await page.evaluate("() => document.body.innerText")
                    except Exception:
                        page_text = ""
                    if matched in page_text or category in page_text:
                        return True, ""
                    return False, f"点击了分类「{matched}」但弹层未显示选中态"
            try:
                await page.mouse.wheel(0, 320)
            except Exception as e:
                logger.warning("juejin 分类列表滚动失败: %s", e)
                break
        return False, (
            f"分类「{category}」在下拉浮层中未找到;已见选项文案(前 30)={seen_labels[:30]}"
        )

    async def verify_credentials(self, credentials: dict[str, Any]) -> tuple[bool, str]:
        if not _HAS_PLAYWRIGHT:
            return False, "Playwright not installed. Run: pip install playwright && playwright install chromium"
        sessionid = credentials.get("sessionid", "").strip()
        if not sessionid:
            return False, "missing sessionid cookie"

        try:
            async with async_playwright() as p:
                browser, context = await create_stealth_browser_context(
                    account_id=self._account_id(credentials),
                    platform=self.platform_id,
                    playwright_instance=p,
                    headless=True,
                )
                try:
                    await context.add_cookies(self._cookies(credentials))
                    page = await context.new_page()
                    await human_pause(1.0, 2.0)
                    await page.goto("https://juejin.cn/", wait_until="networkidle", timeout=30000)
                    content = await page.content()
                    if '登录' in content and 'class="login"' in content:
                        if "avatar" not in content.lower():
                            return False, "cookie expired (login visible, no avatar)"
                    return True, "connected (sessionid valid)"
                finally:
                    await close_stealth_context(browser, context)
        except Exception as e:
            return False, f"verify failed: {type(e).__name__}: {e}"

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
        sessionid = credentials.get("sessionid", "").strip()
        if not sessionid:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="missing sessionid cookie",
            )

        # 掘金编辑器支持 Markdown,优先用 text
        md_text = content.text or ""
        if not md_text and content.html:
            md_text = content.html.replace("<p>", "").replace("</p>", "\n\n").replace("<br>", "\n")
        if not md_text:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="missing content text",
            )

        title = (content.title or "Untitled")[:100]
        category = platform_config.get("category", "后端")  # 默认后端分类
        tags = platform_config.get("tags", [])[:3]
        cover = content.cover_path or platform_config.get("cover", "")

        try:
            async with async_playwright() as p:
                browser, context = await create_stealth_browser_context(
                    account_id=self._account_id(credentials),
                    platform=self.platform_id,
                    playwright_instance=p,
                    headless=True,
                )
                try:
                    await context.add_cookies(self._cookies(credentials))
                    page = await context.new_page()

                    # 打开新草稿
                    await human_pause(1.5, 3.0)
                    await page.goto("https://juejin.cn/editor/drafts/new?v=2", wait_until="networkidle", timeout=60000)
                    if "login" in page.url.lower() or "/login" in page.url:
                        return PublishResult(
                            success=False, platform=self.platform_id,
                            error_message="cookie expired, please refresh sessionid",
                        )

                    await simulate_reading(page, min_s=3.0, max_s=8.0)

                    # 填标题(人类化逐字符)
                    title_selector = 'input.title-input, .title-input input, input[placeholder*="输入文章标题"]'
                    await human_type(page, title, title_selector)
                    await human_pause(0.5, 1.0)

                    # 切换到 Markdown 编辑器(掘金默认 Markdown)
                    md_tab_selector = 'div:has-text("Markdown"), button:has-text("Markdown")'
                    try:
                        if await page.locator(md_tab_selector).count() > 0:
                            await human_click(page, md_tab_selector)
                            await page.wait_for_timeout(500)
                    except Exception as e:
                        logger.warning("juejin.publish Markdown tab click 失败: %s", e, exc_info=True)

                    # 填正文:掘金编辑器是 CodeMirror,其 .CodeMirror-line 覆盖层会拦截
                    # textarea 的 pointer 事件(实测 Locator.click 30s 超时后整单失败),
                    # 所以优先取页面上的 CodeMirror 实例直接 setValue,不走点击+键入。
                    editor_selector = 'textarea.editor, .CodeMirror textarea, [mode="markdown"] textarea'
                    set_via_instance = await page.evaluate(
                        """(text) => {
                            const node = document.querySelector('.CodeMirror');
                            const cm = node && node.CodeMirror;
                            if (!cm || typeof cm.setValue !== 'function') return false;
                            cm.setValue(text);
                            if (typeof cm.save === 'function') cm.save();
                            return cm.getValue().length === text.length;
                        }""",
                        md_text,
                    )
                    if set_via_instance:
                        await human_pause(0.5, 1.0)
                    elif await page.locator(editor_selector).count() > 0:
                        await page.locator(editor_selector).first.click()
                        paragraphs = md_text.split("\n\n")
                        for i, para in enumerate(paragraphs):
                            if i > 0:
                                await page.keyboard.press("Enter")
                                await page.keyboard.press("Enter")
                                await human_pause(0.3, 0.8)
                            await human_type(page, para, None)
                    else:
                        # 富文本回退
                        editor_div_selector = '.content-input, [contenteditable="true"]'
                        await page.locator(editor_div_selector).first.click()
                        await page.evaluate(
                            """(text) => {
                                const ed = document.querySelector('.content-input, [contenteditable="true"]');
                                if (ed) { ed.focus(); document.execCommand('insertText', false, text); }
                            }""",
                            md_text,
                        )

                    # 封面(编辑器主屏;分类/标签在发布弹层内,见下)
                    if cover:
                        try:
                            cover_selector = 'input[placeholder*="封面"], .cover-input'
                            if await page.locator(cover_selector).count() > 0:
                                await human_type(page, cover, cover_selector)
                        except Exception as e:
                            logger.warning("juejin.publish cover input 失败: %s", e, exc_info=True)

                    # 模拟阅读检查(人类发布前预览)
                    await simulate_reading(page, min_s=2.0, max_s=5.0)
                    await human_pause(1.0, 2.0)

                    # ① 打开发布弹层(顶栏「完成并发布/发布」,不是弹层里的最终提交按钮)
                    modal_opened = False
                    for open_text in PUBLISH_OPEN_TEXTS:
                        try:
                            opener = page.locator(f'button:has-text("{open_text}")')
                            if await opener.count() > 0:
                                await human_click(page, f'button:has-text("{open_text}")')
                                modal_opened = True
                                break
                        except Exception as e:
                            logger.warning("juejin.publish 弹层入口 %s 点击失败: %s", open_text, e)
                    if modal_opened:
                        try:
                            await page.wait_for_selector(
                                ", ".join(PUBLISH_MODAL_SELECTORS), timeout=8000
                            )
                        except Exception as e:
                            logger.warning("juejin.publish 弹层容器未出现: %s", e)
                            modal_opened = False

                    # ② 弹层内:分类(必选,小浮层+滚动列表,hover 触发 + force click)
                    category_selected = False
                    category_error_detail = ""
                    if modal_opened and category:
                        category_selected, category_error_detail = await self._select_category_in_modal(
                            page, category
                        )

                    # ③ 弹层内:标签(尽力而为,可空)
                    if modal_opened and tags:
                        try:
                            tag_input = 'input[placeholder*="标签"], .tag-input input'
                            if await page.locator(tag_input).count() > 0:
                                for tag in tags:
                                    await human_type(page, str(tag), tag_input)
                                    await page.keyboard.press("Enter")
                                    await human_pause(0.4, 0.8)
                            else:
                                logger.warning("[juejin] 弹层内未找到标签输入框,跳过标签")
                        except Exception as e:
                            logger.warning("[juejin] tag input failed: %s", e)

                    # ④ 监听真正的提交接口响应(成功判据之一;草稿保存不算)
                    submit_state: dict[str, Any] = {
                        "called": False,
                        "status": None,
                        "article_id": None,
                    }

                    async def _on_submit_response(resp: Any) -> None:
                        try:
                            url = str(resp.url)
                            if not match_submit_api_url(url):
                                return
                            submit_state["called"] = True
                            submit_state["status"] = resp.status
                            if 200 <= int(resp.status) < 300:
                                try:
                                    body: object = await resp.json()
                                except Exception as e:
                                    logger.warning("juejin 提交响应解析失败: %s", e)
                                    body = None
                                aid = extract_article_id_from_submit(body)
                                if aid:
                                    submit_state["article_id"] = aid
                        except Exception as e:
                            logger.warning("juejin._on_submit_response 异常: %s", e)

                    page.on("response", _on_submit_response)

                    # ⑤ 点弹层内「最终提交」按钮:按可见文案在候选集里挑(实测=确定并发布)。
                    #    单字面量「确认发布」是本次缺陷根因;挑不到就带着页面实测文案报出来。
                    visible_buttons: list[str] = await page.evaluate(
                        visible_text_collector_js(), "button, [role='button'], a"
                    )
                    confirm_text = pick_first_text(visible_buttons, PUBLISH_CONFIRM_TEXTS)
                    if confirm_text is None:
                        stuck = describe_stuck_stage(
                            modal_opened=modal_opened,
                            category_selected=category_selected,
                            submit_called=False,
                            submit_status=None,
                            got_article_id=False,
                            published_landing=False,
                        )
                        return PublishResult(
                            success=False, platform=self.platform_id,
                            error_message=(
                                stuck
                                + f";confirm_texts={list(PUBLISH_CONFIRM_TEXTS)} 均未命中,"
                                + f"弹层可见按钮={visible_buttons[:20]}"
                            ),
                        )
                    await human_click(page, f'button:has-text("{confirm_text}")')

                    # ⑥ 成功判据:提交接口响应 article_id 或 /published 过渡页,二者任一;
                    #    绝不再等 /post/<id>(审核期不存在该地址)。
                    published_landing = False
                    deadline = time.monotonic() + 30.0
                    while time.monotonic() < deadline:
                        if is_published_redirect(str(page.url)):
                            published_landing = True
                        if submit_state["article_id"] or published_landing:
                            break
                        await page.wait_for_timeout(500)

                    article_id_raw = submit_state["article_id"]
                    article_id = str(article_id_raw) if article_id_raw is not None else ""
                    if not article_id and not published_landing:
                        stuck = describe_stuck_stage(
                            modal_opened=modal_opened,
                            category_selected=category_selected,
                            submit_called=bool(submit_state["called"]),
                            submit_status=(
                                int(submit_state["status"])
                                if submit_state["status"] is not None
                                else None
                            ),
                            got_article_id=False,
                            published_landing=False,
                        )
                        detail = category_error_detail or f"点击了「{confirm_text}」"
                        return PublishResult(
                            success=False, platform=self.platform_id,
                            error_message=f"{stuck};最后动作={detail};当前URL={page.url}",
                        )

                    final_url = (
                        f"{SPOST_URL_PREFIX}{article_id}"
                        if article_id
                        else str(page.url)
                    )
                    return PublishResult(
                        success=True, platform=self.platform_id,
                        published_url=final_url,
                        platform_content_id=article_id,
                        payload={
                            "title": title,
                            "tags": tags,
                            "category": category,
                            "review_status": "checking",  # 审核中:站内搜索此期间 0 命中
                            "published_landing_seen": published_landing,
                        },
                    )
                finally:
                    await close_stealth_context(browser, context)
        except Exception as e:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"publish failed: {type(e).__name__}: {e}",
            )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
