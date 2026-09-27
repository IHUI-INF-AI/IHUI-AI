# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""CSDN 适配器(基于 Playwright 浏览器自动化框架)。

反风控接入: 通过 anti_risk.browser_factory 创建 BrowserContext,自动注入指纹/代理/stealth/持久化。
所有点击/输入走 behavior_humanizer 人类化操作(贝塞尔曲线鼠标 + 逐字符输入),
同账号跨会话指纹/代理固定,杜绝"新设备登录"告警。

凭证:{ UserName, UserToken, UserSecret cookies }

实现:
- verify_credentials: 打开 https://mp.csdn.net 检查登录态
- publish: 打开 https://mp.csdn.net/mdeditor → 填标题/内容(Markdown 模式)→ 点发布

发布失败归因(2026-09-27 立,见 classify_publish_timeout):点「发布」后被踢回登录页
这一型必须与"我们代码坏了"分家,且判据住在不依赖 Playwright 的纯函数里才可测。
"""
from __future__ import annotations

import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Any
from urllib.parse import ParseResult, urlparse

from app.core.logging import get_logger

from ..anti_risk import (
    close_stealth_context,
    create_stealth_browser_context,
    human_click,
    human_pause,
    human_type,
    simulate_reading,
)
from ..base_adapter import BasePlatformAdapter, PublishContent, PublishResult
from ..published_url import content_id_after_segment, public_view_url

logger = get_logger(__name__)


def _tmp_md_path() -> Path:
    """导入用临时 md 的落点:项目内 `.uploads/publish/` 子目录(已 gitignore)。

    刻意不走 `tempfile.gettempdir()`:本端以服务身份运行时那份 TEMP 可能指向系统盘
    (AGENTS §26「junction 只管路径,管不了身份」),临时物必须落项目内并可预期清理。
    """
    root = Path.cwd() / ".uploads" / "publish" / ".csdn-import"
    root.mkdir(parents=True, exist_ok=True)
    return root / f"article-{uuid.uuid4().hex[:12]}.md"

try:
    from playwright.async_api import async_playwright
    _HAS_PLAYWRIGHT = True
except ImportError:
    _HAS_PLAYWRIGHT = False

if TYPE_CHECKING:
    from playwright._impl._api_structures import SetCookieParam
    from playwright.async_api import Page


# ---------------------------------------------------------------------------
# 发布失败现场定性 —— 纯函数面(不起浏览器、不 import Playwright 运行时)
#
# 为什么必须抽出来:判据写在内联流程里就永远测不到(本仓反复吃过这一型)。publish()
# 只负责"采现场 + 把标量喂进来",分类与文案全部由本区决定,所以回归不需要真浏览器。
# ---------------------------------------------------------------------------

#: 超时分支的两种结论。分类只是内部分流依据,不改 PublishResult 的字段语义。
TIMEOUT_CATEGORY = "publish-timeout"
LOGIN_WALL_CATEGORY = "login-wall"

#: 原有文案 —— 现场判不出登录墙时必须逐字退回这一句。把"编辑器改版/选择器失效"
#: 一并吞成登录墙 = 掩盖真故障,所以默认档只能是它。
DEFAULT_TIMEOUT_MESSAGE = "publish timeout (no redirect)"

#: 登录域(一手实测:点「发布」后被 302 到 passport.csdn.net/account/login,
#: 并在同一浏览器会话里轮询 createQrCode / checkScan,而网络面板一条提交请求都没有)。
LOGIN_WALL_HOSTS: tuple[str, ...] = ("passport.csdn.net",)
LOGIN_WALL_PATH_MARKERS: tuple[str, ...] = ("/account/login", "/login")

#: 扫码登录框的稳定文字标识。取的是 app/services/scan_login.py 既有扫码 tab 候选表
#: 里的**文字**项 —— 本仓唯一登记过的"扫码框长什么样"就是那份,此处刻意不另造
#: CSS 类名(未经实测的类名不配当判据,造出来的判据只会替自己发合格证)。
QR_LOGIN_TEXT_MARKERS: tuple[str, ...] = ("扫码登录", "二维码登录", "手机扫码登录", "微信扫码")

#: 给用户看的行动建议。只描述字段与状态,不落任何 Cookie / token 值。
LOGIN_WALL_MESSAGE = (
    "发布被平台挡回登录页:需要重新扫码登录 —— 当前 Cookie 只够读、不够写"
    "(平台认得你的账号、也放行编辑页,但提交那一步被判为未登录)。"
    "请到「扫码登录」重新扫一次码后再发,这不是发文章功能坏了。"
)


@dataclass(frozen=True)
class PublishTimeoutVerdict:
    """一次"点发布后没跳转"的现场定性结论。"""

    category: str
    error_message: str


def _parse_url(url: str) -> ParseResult | None:
    """尽力解析,解不了就返回 None(调用方按"判不出"处理,不猜)。"""
    raw = (url or "").strip()
    if not raw:
        return None
    try:
        return urlparse(raw)
    except ValueError:
        return None


def is_login_wall_url(url: str) -> bool:
    """当前 URL 是否落在 CSDN 登录域。

    刻意只看 host 与 path、不看 query:真实现场的回跳参数(`from=https%3A%2F%2F…`)
    本来就挂在登录页上,而"人还在编辑器页、query 里带着一个登录地址"是完全不同的
    两回事 —— 拿整串做子串匹配会把后者也判成登录墙,那等于把改版故障洗成凭据问题。
    """
    parsed = _parse_url(url)
    if parsed is None:
        return False
    host = (parsed.hostname or "").lower()
    if not host:
        return False
    if any(host == h or host.endswith(f".{h}") for h in LOGIN_WALL_HOSTS):
        return True
    path = parsed.path or ""
    return any(marker in path for marker in LOGIN_WALL_PATH_MARKERS)


def _sanitized_location(url: str) -> str:
    """可追溯用的现场位置:host + path,丢掉 query(也不带 userinfo)。"""
    parsed = _parse_url(url)
    if parsed is None:
        return "未知"
    host = (parsed.hostname or "").lower()
    location = f"{host}{parsed.path or ''}".strip("/")
    return location[:120] if location else "未知"


def classify_publish_timeout(
    url: str = "",
    qr_login_markers: Sequence[str] = (),
) -> PublishTimeoutVerdict:
    """把超时现场的标量(URL + 命中的扫码框标识)归成一条结论。

    Args:
        url: 超时那一刻的 ``page.url``。
        qr_login_markers: 页面上探测到的扫码登录框标识文本(空元组表示没探到)。

    Returns:
        命中登录墙 ⇒ LOGIN_WALL_CATEGORY + 可行动文案(含原始信息可追溯);
        否则 ⇒ TIMEOUT_CATEGORY + 逐字不变的 DEFAULT_TIMEOUT_MESSAGE。
    """
    evidence: list[str] = []
    if is_login_wall_url(url):
        evidence.append("url-in-login-domain")
    if any(str(m).strip() for m in qr_login_markers):
        evidence.append("qr-login-box-present")
    if not evidence:
        return PublishTimeoutVerdict(category=TIMEOUT_CATEGORY, error_message=DEFAULT_TIMEOUT_MESSAGE)
    detail = " + ".join(evidence)
    return PublishTimeoutVerdict(
        category=LOGIN_WALL_CATEGORY,
        error_message=(
            f"{LOGIN_WALL_MESSAGE} "
            f"[诊断: {detail}; 现场: {_sanitized_location(url)}; 原始现象: {DEFAULT_TIMEOUT_MESSAGE}]"
        ),
    )


async def _collect_login_wall_scene(page: Page) -> tuple[str, tuple[str, ...]]:
    """采一次现场:当前 URL + 页面上是否已出现扫码登录框。

    两条硬约束:① **不引入新的等待时长** —— ``page.url`` 是同步属性、
    ``locator.count()`` 只查一次不轮询;② **采集失败不得让链路更脆** —— 每一步各自
    吞异常并降级为"判不出",由 classify_publish_timeout 退回原文案。
    """
    url_snapshot = ""
    try:
        url_snapshot = str(page.url)
    except Exception as e:
        logger.debug("[csdn] 采 page.url 失败,按判不出处理: %s", e)
        return "", ()
    # URL 已经定性就不再摸 DOM:省两次往返,且页面可能正在二次跳转。
    if is_login_wall_url(url_snapshot):
        return url_snapshot, ()
    markers: list[str] = []
    for text in QR_LOGIN_TEXT_MARKERS:
        try:
            if await page.locator(f"text={text}").count() > 0:
                markers.append(text)
                break
        except Exception as e:
            logger.debug("[csdn] 扫码框探针 %s 失败,停止采集: %s", text, e)
            break
    return url_snapshot, tuple(markers)


class CsdnAdapter(BasePlatformAdapter):
    platform_id = "csdn"
    platform_name = "CSDN"
    supported_formats = ["md", "html"]
    requires_credentials = ["UserName", "UserToken", "UserSecret"]
    needs_browser = True

    def _cookies(self, credentials: dict[str, Any]) -> list[SetCookieParam]:
        return [
            {
                "name": "UserName",
                "value": credentials.get("UserName", ""),
                "domain": ".csdn.net",
                "path": "/",
            },
            {
                "name": "UserToken",
                "value": credentials.get("UserToken", ""),
                "domain": ".csdn.net",
                "path": "/",
                "httpOnly": True,
            },
            {
                "name": "UserSecret",
                "value": credentials.get("UserSecret", ""),
                "domain": ".csdn.net",
                "path": "/",
                "httpOnly": True,
            },
        ]

    async def verify_credentials(self, credentials: dict[str, Any]) -> tuple[bool, str]:
        if not _HAS_PLAYWRIGHT:
            return False, "Playwright not installed. Run: pip install playwright && playwright install chromium"
        username = credentials.get("UserName", "").strip()
        if not username:
            return False, "missing UserName cookie"

        account_id = self.account_identity(credentials)
        try:
            async with async_playwright() as p:
                browser, context = await create_stealth_browser_context(
                    account_id=account_id,
                    platform=self.platform_id,
                    playwright_instance=p,
                    headless=True,
                )
                try:
                    await context.add_cookies(self._cookies(credentials))
                    page = await context.new_page()
                    logger.info("[%s] 反风控 context 已创建 account=%s", self.platform_id, account_id)
                    await page.goto("https://mp.csdn.net/", wait_until="networkidle", timeout=30000)
                    await simulate_reading(page, min_s=2.0, max_s=5.0)
                    url = page.url
                    if "login" in url.lower() or "/login" in url:
                        return False, "cookie expired (redirected to login)"
                    return True, f"connected as {username}"
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
        username = credentials.get("UserName", "").strip()
        if not username:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="missing UserName cookie",
            )

        # CSDN 编辑器支持 Markdown 模式,优先用 text(md)
        md_text = content.text or ""
        if not md_text and content.html:
            # 简单 HTML → md 反向转换(实际生产应用 markdown 库)
            md_text = content.html.replace("<p>", "").replace("</p>", "\n\n").replace("<br>", "\n")
        if not md_text:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="missing content text (md preferred)",
            )

        title = (content.title or "Untitled")[:100]
        tags = platform_config.get("tags", [])[:5]
        category = platform_config.get("category", "")
        content.cover_path or platform_config.get("cover", "")

        account_id = self.account_identity(credentials)
        try:
            async with async_playwright() as p:
                browser, context = await create_stealth_browser_context(
                    account_id=account_id,
                    platform=self.platform_id,
                    playwright_instance=p,
                    headless=True,
                )
                try:
                    await context.add_cookies(self._cookies(credentials))
                    page = await context.new_page()
                    logger.info("[%s] 反风控 context 已创建 account=%s", self.platform_id, account_id)
                    await human_pause(1.0, 2.5)  # 模拟用户思考停顿

                    # CSDN 的 Markdown 编辑器现址是 https://editor.csdn.net/md/。
                    # 旧入口 /mdeditor 会被重定向到创作中心首页 —— 实测落地页可见 input 0 个、
                    # CodeMirror 0 个,所以原实现稳定报 "title input not found"。
                    # 那是入口失效,不是凭据问题(同一份 cookie 在编辑器页验登录态是通过的)。
                    await page.goto("https://editor.csdn.net/md/", wait_until="networkidle", timeout=60000)
                    if "login" in page.url.lower():
                        return PublishResult(
                            success=False, platform=self.platform_id,
                            error_message="cookie expired, please refresh cookies",
                        )
                    await human_pause(0.5, 1.5)

                    # 正文走平台自带的「导入 Markdown」入口(#import-markdown-file-input)。
                    # 该编辑器内核是 .editor__inner[contenteditable] 的语法高亮层,逐字符键入既慢
                    # 又会被高亮层重写;导入文件是一等公民路径 —— 实测导入后 editorText 与源 md 逐字一致。
                    import_selector = "#import-markdown-file-input"
                    if await page.locator(import_selector).count() == 0:
                        return PublishResult(
                            success=False, platform=self.platform_id,
                            error_message="markdown import entry not found (editor layout changed)",
                        )
                    md_tmp = _tmp_md_path()
                    md_tmp.write_text(md_text, encoding="utf-8")
                    try:
                        await page.set_input_files(import_selector, str(md_tmp))
                        # 导入是异步解析:等编辑器内容真的换上我们的文本,而不是等固定时长
                        await page.wait_for_function(
                            """(needle) => {
                                const ed = document.querySelector('.editor__inner');
                                return !!ed && (ed.innerText || '').includes(needle);
                            }""",
                            arg=md_text[:24],
                            timeout=20000,
                        )
                    finally:
                        md_tmp.unlink(missing_ok=True)

                    # 标题必须在导入之后写:导入会把 md 文件名当成文章标题占掉。
                    # 标题框是 display:none 的 Vue 受控 input —— Playwright 的 click/fill 都点不动
                    # (元素 rect 0x0),只有原生 value setter + input 事件能让组件收到;
                    # 实测写入后顶部标题区与字数计数随之更新。
                    title_ok = await page.evaluate(
                        """(t) => {
                            const el = document.querySelector('input.article-bar__title');
                            if (!el) return false;
                            const setter = Object.getOwnPropertyDescriptor(
                                window.HTMLInputElement.prototype, 'value').set;
                            setter.call(el, t);
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                            return el.value === t;
                        }""",
                        title,
                    )
                    if not title_ok:
                        return PublishResult(
                            success=False, platform=self.platform_id,
                            error_message="title input not found or value not applied",
                        )
                    await human_pause(0.5, 1.5)

                    # 填标签
                    if tags:
                        try:
                            tag_selector = 'input[placeholder*="标签"], #tag-input'
                            tag_input = page.locator(tag_selector).first
                            for tag in tags:
                                if await tag_input.count() > 0:
                                    logger.debug("[%s] 人类化操作中...", self.platform_id)
                                    await human_type(page, str(tag), selector=tag_selector)
                                    await page.keyboard.press("Enter")
                                    await page.wait_for_timeout(300)
                        except Exception as e:
                            logger.warning("[csdn] tag input failed: %s", e)

                    # 点发布(人类化点击)
                    publish_selector = 'button:has-text("发布"), button.publish-btn, .btn-publish'
                    publish_btn = page.locator(publish_selector).first
                    if await publish_btn.count() == 0:
                        return PublishResult(
                            success=False, platform=self.platform_id,
                            error_message="publish button not found",
                        )
                    logger.debug("[%s] 人类化操作中...", self.platform_id)
                    await human_click(page, selector=publish_selector)
                    await human_pause(0.5, 1.5)

                    # 等待跳转
                    try:
                        await page.wait_for_url("**/article/details/**", timeout=30000)
                    except Exception as e:
                        logger.warning("csdn.publish wait_for_url 失败: %s", e, exc_info=True)
                        # 检查是否有错误对话框
                        err_dialog = page.locator('.error-msg, .el-message--error').first
                        if await err_dialog.count() > 0:
                            err_text = await err_dialog.text_content() or "unknown error"
                            return PublishResult(
                                success=False, platform=self.platform_id,
                                error_message=f"publish error: {err_text}",
                            )
                        # 现场定性:同样是"没跳转",被踢回登录页与编辑器改版是两种病,
                        # 处置动作相反(前者要用户重新扫码,后者要我们改选择器)。
                        # 采集零新增等待、异常一律降级,判不出就逐字退回原文案。
                        scene_url, scene_markers = await _collect_login_wall_scene(page)
                        verdict = classify_publish_timeout(scene_url, scene_markers)
                        if verdict.category == LOGIN_WALL_CATEGORY:
                            logger.warning(
                                "[csdn] 超时现场判定为登录墙(点发布后被踢回登录页)scene=%s",
                                _sanitized_location(scene_url),
                            )
                        return PublishResult(
                            success=False, platform=self.platform_id,
                            error_message=verdict.error_message,
                        )

                    raw_url = page.url
                    # 与知乎同形:按末段取 id 在 `?spm=…`/`#comment` 出现时会把尾巴带进 id。
                    article_id = content_id_after_segment(raw_url, "details")
                    published_url = public_view_url(raw_url, segment="details", content_id=article_id)

                    return PublishResult(
                        success=True, platform=self.platform_id,
                        published_url=published_url,
                        platform_content_id=article_id,
                        payload={"title": title, "tags": tags, "category": category},
                    )
                finally:
                    await close_stealth_context(browser, context)
        except Exception as e:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message=f"publish failed: {type(e).__name__}: {e}",
            )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
