# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""发布后实测核验(post-publish verification)。

对已完成发布的内容做"真实落地"检查,避免假成功(知乎 DOM 流曾出现
URL 跳转但正文为空/文章不存在的假阳性)。

目前实现知乎:在登录态页面打开文章页,检查
  (a) 未跳转回首页 / signin
  (b) 正文渲染长度 > 500
  (c) 期望标题关键词(取前 8 字)出现在页面
  (d) 图片元素总数 / 已加载数

返回统一结构:
  {
    "checked_at": iso,
    "passed": bool,
    "issues": [str...],
    "content_length": int,
    "images_total": int,
    "images_loaded": int,
  }
"""
from __future__ import annotations

import html as html_lib
import re
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

import httpx

from app.core.logging import get_logger

logger = get_logger(__name__)

try:
    from playwright.async_api import async_playwright
    _HAS_PLAYWRIGHT = True
except ImportError:
    _HAS_PLAYWRIGHT = False

if TYPE_CHECKING:
    from playwright._impl._api_structures import SetCookieParam


def _all_cookies(
    credentials: dict[str, Any], default_domain: str = ".zhihu.com"
) -> list[SetCookieParam]:
    """从凭证还原 cookie。

    优先用 `__cookie_jar__`(账号池落库时保留了每个 cookie 的 domain/path/过期时间),
    否则退回旧的扁平键值形态。2026-11-28 修复:旧实现把**所有平台**的 cookie 都塞到
    `.zhihu.com`,导致非知乎平台(微博/百家号/抖音/小红书)带着错域 cookie 访问,
    永远处于未登录态。
    """
    jar = credentials.get("__cookie_jar__")
    if isinstance(jar, list) and jar:
        out: list[SetCookieParam] = []
        for item in jar:
            if not isinstance(item, dict):
                continue
            name = item.get("name")
            value = item.get("value")
            if not isinstance(name, str) or not name or not isinstance(value, str) or not value:
                continue
            cookie: dict[str, Any] = {
                "name": name,
                "value": value,
                "domain": item.get("domain") or default_domain,
                "path": item.get("path") or "/",
            }
            expires = item.get("expires")
            if isinstance(expires, (int, float)) and expires > 0:
                cookie["expires"] = float(expires)
            if isinstance(item.get("secure"), bool):
                cookie["secure"] = item["secure"]
            if isinstance(item.get("httpOnly"), bool):
                cookie["httpOnly"] = item["httpOnly"]
            same_site = item.get("sameSite")
            if same_site in ("Lax", "Strict", "None"):
                cookie["sameSite"] = same_site
            out.append(cookie)  # type: ignore[arg-type]
        if out:
            return out

    out = []
    for name, value in credentials.items():
        if not isinstance(value, str) or not value:
            continue
        out.append({
            "name": name,
            "value": value,
            "domain": default_domain,
            "path": "/",
            "httpOnly": name in ("z_c0", "d_c0", "KLBRSID", "q_c1"),
            "secure": True,
            "sameSite": "Lax",
        })
    return out


def _account_id(
    credentials: dict[str, Any],
    db_account_id: int | str | None = None,
    platform: str = "zhihu",
) -> str:
    """核验会话用的身份键 —— 委托唯一出口(旧实现取「首个凭证值」哈希,刷新即换脸)。"""
    from app.services.publish.anti_risk.account_identity import resolve_account_id

    return resolve_account_id(platform, credentials, db_account_id)


async def verify_published(
    platform: str,
    credentials: dict[str, Any],
    content_id: str,
    expect_title: str,
    db_account_id: int | str | None = None,
) -> dict[str, Any]:
    """核验已发布内容是否真实落地。

    Args:
        platform: 平台 id(如 'zhihu')
        credentials: 已解密凭证 dict
        content_id: 平台内容 id(如知乎文章 id)
        expect_title: 期望标题(用于关键词比对)

    Returns:
        统一核验结构(dict)。失败时 passed=False,issues 解释原因。
    """
    if platform == "zhihu":
        return await _verify_zhihu(credentials, content_id, expect_title, db_account_id)
    if platform == "csdn":
        return await _verify_csdn(credentials, content_id, expect_title, db_account_id)
    return {
        "checked_at": datetime.now(UTC).isoformat(),
        "passed": False,
        "issues": [f"unsupported platform: {platform}"],
        "content_length": 0,
        "images_total": 0,
        "images_loaded": 0,
    }


async def _verify_csdn(
    credentials: dict[str, Any],
    content_id: str,
    expect_title: str,
    db_account_id: int | str | None = None,
) -> dict[str, Any]:
    """CSDN 公开文章页核验：200 + 标题关键词 + 正文长度。

    先用 httpx 直取；CSDN 对服务器 IP 常返回安全验证页，此时用账号池 cookie
    启动 Playwright 复核。只有公开页真实渲染出标题/正文才算通过。
    """
    checked_at = datetime.now(UTC).isoformat()
    issues: list[str] = []
    content_length = 0
    images_total = 0
    images_loaded = 0
    security_blocked = False
    username = str(credentials.get("UserName") or credentials.get("username") or "").strip()
    if not username:
        return {
            "checked_at": checked_at,
            "passed": False,
            "issues": ["missing UserName, cannot build CSDN public url"],
            "content_length": 0,
            "images_total": 0,
            "images_loaded": 0,
        }
    url = f"https://blog.csdn.net/{username}/article/details/{content_id}"
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            resp = await client.get(
                url,
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 Chrome/141.0.0.0 Safari/537.36"
                    )
                },
            )
        if resp.status_code != 200:
            issues.append(f"公开页 HTTP {resp.status_code}(文章可能不存在或未公开)")
        html_text = resp.text or ""
        if "安全验证" in html_text or "captcha" in html_text.lower():
            security_blocked = True
        title_match = re.search(r"<title[^>]*>(.*?)</title>", html_text, re.S | re.I)
        page_title = html_lib.unescape(title_match.group(1)).strip() if title_match else ""
        kw = (expect_title or "").strip()[:8]
        if not security_blocked and kw and kw not in page_title and kw not in html_text[:30000]:
            issues.append(f"标题不匹配(期望='{kw}',页面标题='{page_title}')")
        body_match = re.search(
            r'<div[^>]+id="content_views"[^>]*>(.*?)(?:</div>\s*</div>|<div[^>]+class="hide-article-box")',
            html_text,
            re.S | re.I,
        )
        body_html = body_match.group(1) if body_match else html_text
        body_html = re.sub(
            r"<(script|style)[^>]*>.*?</\1>", " ", body_html, flags=re.S | re.I
        )
        body_text = html_lib.unescape(re.sub(r"<[^>]+>", " ", body_html))
        content_length = len(re.sub(r"\s+", "", body_text))
        images_total = len(re.findall(r"<img\b", body_html, re.I))
        if not security_blocked and content_length < 200:
            issues.append(f"正文渲染不足(content_length={content_length}<200)")
    except Exception as e:
        logger.exception("[verifier] csdn http verify failed content_id=%s", content_id)
        issues.append(f"HTTP verify exception: {type(e).__name__}: {e}")

    if (security_blocked or content_length < 200) and _HAS_PLAYWRIGHT:
        issues = []
        content_length = 0
        images_total = 0
        images_loaded = 0
        try:
            from app.services.publish.anti_risk import create_stealth_browser_context
            from app.services.publish.anti_risk.browser_factory import close_stealth_context

            async with async_playwright() as p:
                browser, context = await create_stealth_browser_context(
                    account_id=_account_id(credentials, db_account_id, "csdn"),
                    platform="csdn",
                    playwright_instance=p,
                    headless=True,
                )
                try:
                    await context.add_cookies(_all_cookies(credentials, ".csdn.net"))
                    page = await context.new_page()
                    await page.goto(url, wait_until="domcontentloaded", timeout=60000)
                    await page.wait_for_timeout(6000)
                    measure = await page.evaluate(
                        """() => {
                            const art = document.querySelector('#content_views, .article_content, article');
                            const text = art ? art.innerText || '' : (document.body ? document.body.innerText || '' : '');
                            const imgs = Array.from(document.images || []);
                            const loaded = imgs.filter((im) => (im.naturalWidth || 0) > 0 && (im.naturalHeight || 0) > 0).length;
                            const bodyText = document.body ? document.body.innerText || '' : '';
                            return {
                                content_length: text.length,
                                images_total: imgs.length,
                                images_loaded: loaded,
                                page_title: (document.title || '').trim(),
                                security: bodyText.includes('安全验证') || bodyText.toLowerCase().includes('captcha'),
                            };
                        }"""
                    )
                    content_length = int(measure.get("content_length", 0))
                    images_total = int(measure.get("images_total", 0))
                    images_loaded = int(measure.get("images_loaded", 0))
                    page_title = (measure.get("page_title") or "").strip()
                    if measure.get("security"):
                        issues.append("CSDN 浏览器复核仍返回安全验证页")
                    if content_length < 200:
                        issues.append(f"正文渲染不足(content_length={content_length}<200)")
                    kw = (expect_title or "").strip()[:8]
                    if kw and kw not in page_title and kw not in (await page.content())[:20000]:
                        issues.append(f"标题不匹配(期望='{kw}',页面标题='{page_title}')")
                finally:
                    await close_stealth_context(browser, context)
        except Exception as e:
            logger.exception("[verifier] csdn browser verify failed content_id=%s", content_id)
            issues.append(f"browser verify exception: {type(e).__name__}: {e}")
    elif security_blocked:
        issues.append("CSDN 返回安全验证页，且浏览器复核不可用")

    return {
        "checked_at": checked_at,
        "passed": len(issues) == 0,
        "issues": issues,
        "content_length": content_length,
        "images_total": images_total,
        "images_loaded": images_loaded,
    }


async def _verify_zhihu(
    credentials: dict[str, Any],
    content_id: str,
    expect_title: str,
    db_account_id: int | str | None = None,
) -> dict[str, Any]:
    checked_at = datetime.now(UTC).isoformat()
    issues: list[str] = []
    content_length = 0
    images_total = 0
    images_loaded = 0

    if not _HAS_PLAYWRIGHT:
        return {
            "checked_at": checked_at, "passed": False,
            "issues": ["Playwright not installed"],
            "content_length": 0, "images_total": 0, "images_loaded": 0,
        }

    from app.services.publish.anti_risk import create_stealth_browser_context
    from app.services.publish.anti_risk.browser_factory import close_stealth_context

    url = f"https://zhuanlan.zhihu.com/p/{content_id}"
    try:
        async with async_playwright() as p:
            browser, context = await create_stealth_browser_context(
                account_id=_account_id(credentials, db_account_id),
                platform="zhihu",
                playwright_instance=p,
                headless=True,
            )
            try:
                await context.add_cookies(_all_cookies(credentials))
                page = await context.new_page()
                await page.goto(url, wait_until="networkidle", timeout=60000)

                # (a) 跳转检查
                final_url = page.url
                if "/signin" in final_url or "login" in final_url.lower():
                    issues.append("跳转登录页(文章不可访问/不存在)")
                elif final_url.rstrip("/").split("/")[-1] == "zhuanlan.zhihu.com":
                    issues.append("跳转回首页(文章不存在)")

                # (b)(c)(d) 内容与图片检查
                measure = await page.evaluate(
                    """() => {
                        const art = document.querySelector('.Post-RichTextContainer, .RichText, article, .ContentItem-content');
                        const text = art ? art.innerText || '' : (document.body ? document.body.innerText || '' : '');
                        const imgs = Array.from(document.images || []);
                        const loaded = imgs.filter((im) => {
                            const w = im.naturalWidth || 0;
                            const h = im.naturalHeight || 0;
                            return w > 0 && h > 0;
                        }).length;
                        const titleEl = document.querySelector('h1, .Post-Title, title');
                        const pageTitle = titleEl ? (titleEl.innerText || titleEl.textContent || '') : '';
                        return {
                            content_length: text.length,
                            images_total: imgs.length,
                            images_loaded: loaded,
                            page_title: pageTitle.trim(),
                        };
                    }"""
                )
                content_length = int(measure.get("content_length", 0))
                images_total = int(measure.get("images_total", 0))
                images_loaded = int(measure.get("images_loaded", 0))
                page_title = (measure.get("page_title") or "").strip()

                if content_length < 500:
                    issues.append(f"正文渲染不足(content_length={content_length}<500)")

                # (c) 标题关键词(取前 8 字)
                kw = (expect_title or "").strip()[:8]
                if kw and kw not in page_title and kw not in (await page.content())[:20000]:
                    issues.append(f"标题不匹配(期望含'{kw}',页面标题='{page_title}')")
            finally:
                await close_stealth_context(browser, context)
    except Exception as e:
        logger.exception("[verifier] zhihu verify failed content_id=%s", content_id)
        issues.append(f"verify exception: {type(e).__name__}: {e}")

    passed = len(issues) == 0
    return {
        "checked_at": checked_at,
        "passed": passed,
        "issues": issues,
        "content_length": content_length,
        "images_total": images_total,
        "images_loaded": images_loaded,
    }
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍​‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
