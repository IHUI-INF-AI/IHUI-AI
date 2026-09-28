# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

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
# 发布弹层选择器/文案的单一事实层(2026-09-27 二次校准)
#
# 本段所有"实测"= 2026-09-27 三轮 headless 只读探针的**一手 DOM 观察**,凭据注入
# 与 publish 完全同路径(id=13 解密 → create_stealth_browser_context → add_cookies);
# 观察产物存档 .ihui-agent/tmp/juejin-calib/observation{,2,3}.json。
# **全程未点击最终提交按钮,无任何文章被发布。**(上一轮探针因误用未注入凭据的遗留
# 画像副本被判"登录态失效"—— 本轮以适配器自身路径现读,会话有效,弹层已现场打开。)
# 1. 弹层容器 = `.publish-popup`(实测 class="publish-popup publish-popup
#    with-padding active"),**不是 modal**:byte-modal 一族 9 个元素全隐藏、popover
#    0 个 ⇒ 按旧候选表 wait_for_selector 必超时(当次实测 8s Timeout)。弹层锚在顶栏
#    exact 文案「发布」按钮(button.xitu-btn)上;「发布文章」只是弹层内标题 div 文本。
# 2. 最终提交按钮 = 「确定并发布」(实测 class="ui-btn btn primary medium default");
#    弹层内可见钮全集 = [发布, 上传封面, 取消, 确定并发布];页面不存在「确认发布」。
# 3. 分类 = 弹层内**平铺可点列表**(实测 .form-item-content.category-list > .item ×8:
#    后端/前端/Android/iOS/人工智能/开发工具/代码人生/阅读),**无 hover 触发、无滚动
#    下拉** —— 推翻上一版"小浮层下拉(hover+force click)"推导;点中后 item class 变
#    "item active"。分类 label 带 required 类(必选属实,旧注释这一点成立)。
# 4. 标签 = .tag-input 内 input.byte-select__input;placeholder 文案挂在独立的
#    .byte-select__placeholder div 上,**不是 input 属性** ⇒ 旧
#    `input[placeholder*="标签"]` 一支实测永不命中。普通 click 实测被 pointer events
#    拦截、force click 可用;聚焦键入即过滤,选项渲染在 body 级 portal
#    `.byte-select-dropdown > li.byte-select-option`,点击可选中(实测点选成功)。
# 5. 提交接口 content_api/v1/article/publish、草稿 article_draft/create|update、
#    过渡页 /published —— URL 字符串逐字核自当次抓到的编辑器线上 bundle
#    app.12c77646.js;article_draft/create 并在当次网络面板现行观测到。
#    旧判据等 /post/<id> 跳转不再回来(上一版结论,本次未复验亦不复用其推导细节)。
# 6. 「编辑摘要」label 带 required,但弹层初开已自动从正文填充(实测 "37/100")⇒
#    无需专门填写;若改版后不再自动填,需补摘要输入步骤。
# (旧代码假想的「名为 select 且 class 带 category-select 一族」DOM 经当次弹层
#  outerHTML 全量核对确认不存在,反向锁由 tests/test_juejin_publish_selectors.py 看守。
#  上一版把 `.category-list .item` 一并列入"被证伪的假想 DOM"—— 当次实测证明它恰恰
#  是现网一手主选择器,反向锁已按实测更正;被证伪的从来是"分类=下拉形态"这一型。)
# ---------------------------------------------------------------------------

#: 发布弹层「最终提交」按钮的候选文案(有序;首个在页面命中的即用)。
#: 「确定并发布」= 2026-09-27 一手实测弹层现行文案;「确认发布」为防御性回退候选
#: (当次实测页面**未观测**),保留只为文案变回去仍能命中 —— 单字面量正是历史缺陷成因。
PUBLISH_CONFIRM_TEXTS: tuple[str, ...] = ("确定并发布", "确认发布")

#: 编辑器顶栏「打开发布弹层」入口按钮候选(与弹层内最终确认按钮不同)。
#: 「发布」= 2026-09-27 实测顶栏 exact 文案(排首位);后两枚为历史/防御候选。
PUBLISH_OPEN_TEXTS: tuple[str, ...] = ("发布", "完成并发布", "发布文章")

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

#: 发布弹层容器候选。`publish-popup` = 2026-09-27 实测唯一可见容器;其余为改版回退
#: (旧版只列后三族,实测面全部 0 可见 ⇒ 弹层检测恒超时、分类/标签步被静默跳过)。
PUBLISH_MODAL_SELECTORS: tuple[str, ...] = (
    '[class*="publish-popup"]',
    '[class*="byte-modal"]',
    '[class*="modal"]',
    '[class*="popover"]',
)

#: 分类候选项选择器(2026-09-27 实测形态:弹层内平铺 `.category-list > .item`,
#: 无需 hover/展开触发;第二枚是类名漂移的泛化回退)。
CATEGORY_ITEM_SELECTORS: tuple[str, ...] = (
    ".category-list .item",
    '[class*="category-list"] [class*="item"]',
)

#: 标签输入框候选(实测 = .tag-input 内 input.byte-select__input;placeholder 不是
#: input 属性,后一支保留作改版回退)。
TAG_INPUT_SELECTOR: str = '.tag-input input, input[placeholder*="标签"]'

#: 下拉浮层选项候选。首选 = 2026-09-27 实测的标签搜索 portal
#: (body 级 .byte-select-dropdown 下的 li,pointer 被遮 ⇒ 需 force click);
#: 其余为改版回退。
DROPDOWN_OPTION_SELECTORS: tuple[str, ...] = (
    '[class*="byte-select-dropdown"] li',
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
        return "stuck=publish-modal-not-opened (点开发布弹层失败,publish-popup/byte-modal 均未现可见容器)"
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

        2026-09-27 一手实测形态:分类是弹层内**平铺可点列表**
        (`.category-list > .item` 8 项全部可见),无 hover 触发、无滚动下拉,
        普通点击即选中,选中态 = 该 item 的 class 追加 "active"。
        (上一版按"小浮层下拉 + hover + 滚动"实现的分支已被实测推翻,已移除;
        真正需要 force click 的是标签搜索下拉,见 publish() 第③步。)
        返回 (是否选中, 失败定位详情);详情会并入最终 error_message。
        """
        for sel in CATEGORY_ITEM_SELECTORS:
            try:
                loc = page.locator(sel)
                n = int(await loc.count())
            except Exception as e:
                logger.warning("juejin 分类列表抓取 %s 失败: %s", sel, e)
                continue
            if n == 0:
                continue
            labels: list[str] = []
            for i in range(n):
                try:
                    labels.append(((await loc.nth(i).inner_text()) or "").strip())
                except Exception:
                    labels.append("")
            matched = find_option_in_list(labels, category)
            if not matched:
                continue
            target = loc.nth(labels.index(matched))
            try:
                # 实测普通 click 可用;force 仅兜底(改版加遮罩时不至于整步崩)
                await target.click(timeout=5000)
            except Exception as e:
                logger.warning("juejin 分类 %r 常规点击失败,force 兜底: %s", matched, e)
                try:
                    await target.click(force=True)
                except Exception as e2:
                    logger.warning("juejin 分类选项 force 点击也失败: %s", e2)
                    continue
            # 复核优先级:实测选中态 class(最可靠)→ 弹层可见文本(兜底)
            try:
                cls_attr = (await target.get_attribute("class")) or ""
            except Exception:
                cls_attr = ""
            if "active" in cls_attr:
                return True, ""
            try:
                page_text: str = await page.evaluate("() => document.body.innerText")
            except Exception:
                page_text = ""
            if matched in page_text or category in page_text:
                return True, ""
            return False, f"点击了分类「{matched}」但选中态(class active/文案)未确认"
        return False, (
            f"分类「{category}」未能选中(候选平铺列表选择器={list(CATEGORY_ITEM_SELECTORS)}"
            " 均未命中或无匹配项)—— 若再现,说明掘金又把分类控件改版回了其它形态,"
            "需重开弹层实测 DOM 校准"
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

                    # ① 打开发布弹层(顶栏 exact 文案「发布」= 2026-09-27 实测;
                    #    has-text 为子串匹配,DOM 序上 opener 在弹层提交钮之前,first 即入口)
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

                    # ③ 弹层内:标签(实测 label 带 required,但历史提交在少标签时是否被拒未取证,
                    #    此处仍尽力而为、失败不阻断 —— 不在未实测的提交校验上冒险改语义)
                    if modal_opened and tags:
                        try:
                            tag_box = page.locator(TAG_INPUT_SELECTOR).first
                            if await tag_box.count() == 0:
                                logger.warning("[juejin] 弹层内未找到标签输入框,跳过标签")
                            else:
                                for tag in tags:
                                    tag_s = str(tag)
                                    try:
                                        # 实测:普通 click 被弹层遮罩拦截(pointer events)⇒ force
                                        try:
                                            await tag_box.click(timeout=2000)
                                        except Exception:
                                            await tag_box.click(force=True)
                                        # focus() 直接置焦(不依赖 pointer),再键入即触发搜索
                                        await tag_box.focus()
                                        await page.keyboard.type(tag_s, delay=60)
                                        await page.wait_for_timeout(1500)  # 搜索请求 + 下拉渲染
                                        safe = tag_s.replace("\\", "").replace('"', "")
                                        # 选项候选的唯一事实层(实测首选 = byte-select-dropdown li)
                                        opt_sel = DROPDOWN_OPTION_SELECTORS[0]
                                        opts = page.locator(
                                            f'{opt_sel}:has-text("{safe}")'
                                        )
                                        if await opts.count() > 0:
                                            # 实测:选项 li 同样需 force click
                                            await opts.first.click(force=True)
                                        else:
                                            # 下拉无精确项时回车(未实测,仅兜底)并如实记日志
                                            await page.keyboard.press("Enter")
                                            logger.warning(
                                                "[juejin] 标签 %r 下拉未命中选项,已回车兜底", tag_s
                                            )
                                        await human_pause(0.3, 0.6)
                                    except Exception as e:
                                        logger.warning("[juejin] tag %r 添加失败: %s", tag_s, e)
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
                        # 没传 tags 时第⑤步整段被 `if modal_opened and tags` 跳过，症状是
                        # "点了提交却没有任何请求"—— 那既不是平台改版也不是选择器失效，
                        # 是调用方没给必填项。不写进结论，下一个人只会去怀疑选择器。
                        if not tags:
                            detail += ";tags 为空(targets[].config.tags 未提供,标签步骤被整步跳过)"
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
