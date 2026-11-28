# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""简书(jianshu)适配器(基于 Cookie 模拟,真实可调通)。

凭证:{ cookie }
- cookie: 用户登录简书后从浏览器复制的 cookie 字符串
  获取路径:浏览器登录简书 → F12 → Network → 任意请求 → Request Headers → Cookie

注意:简书无公开开放 API,本适配器通过 writer 模块的内部 API 模拟发布。
      非官方实现,简书前端结构调整时可能失效,需更新。

API 端点(均为 writer 内部 API):
- 验证:GET https://www.jianshu.com/writer#/notes
        Header: Cookie: {cookie}
        检查:HTTP 200 + 未重定向到登录页(/sign_in)
- 发布:POST https://www.jianshu.com/writer/notes
        Body: { title, content(HTML), notebook_id, at_bottom }
        返回: { id, slug }

公开 URL 拼装:https://www.jianshu.com/p/{slug}

实现要点:
- httpx.AsyncClient 异步,超时 30s,follow_redirects=False(用于检测登录态)
- 失败最多重试 2 次,间隔 1s
- 网络异常/4xx/5xx/重定向到登录页 都返回 PublishResult(success=False),不抛异常
"""
from __future__ import annotations

import asyncio
from typing import Any, TypedDict

import httpx

from app.core.logging import get_logger

from ..base_adapter import BasePlatformAdapter, PublishContent, PublishResult
from ..anti_risk import create_stealth_browser_context, human_pause
from ..anti_risk.browser_factory import close_stealth_context

logger = get_logger(__name__)

try:
    from playwright.async_api import async_playwright
    _HAS_PLAYWRIGHT = True
except ImportError:
    _HAS_PLAYWRIGHT = False

_BASE = "https://www.jianshu.com"
_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)
_MAX_RETRIES = 2
_RETRY_INTERVAL = 1.0
_TIMEOUT = 30.0

# 登录态失效信号:重定向目标含 /sign_in
_LOGIN_REDIRECT_HINTS = ("/sign_in", "/login")


class _JianshuNoteBody(TypedDict, total=False):
    """简书发布请求 body 结构(用于文档化,实际发送时按 dict 构造)。"""

    title: str
    content: str
    notebook_id: int
    at_bottom: bool


class JianshuAdapter(BasePlatformAdapter):
    """简书适配器。发布走 Cookie 模拟 writer 内部 API;登录验证走浏览器保护页。"""

    platform_id = "jianshu"
    platform_name = "简书"
    supported_formats = ["md", "html"]
    requires_credentials = ["cookie"]
    needs_browser = True

    def _cookies(self, credentials: dict[str, Any]) -> list[dict[str, Any]]:
        """把 cookie 字符串或完整 jar 还原为 Playwright cookie list。"""
        jar = credentials.get("__cookie_jar__") or []
        if isinstance(jar, list) and jar:
            out: list[dict[str, Any]] = []
            for c in jar:
                if not isinstance(c, dict) or not c.get("name"):
                    continue
                out.append({
                    "name": str(c.get("name")),
                    "value": str(c.get("value") or ""),
                    "domain": str(c.get("domain") or ".jianshu.com"),
                    "path": str(c.get("path") or "/"),
                    "expires": float(c["expires"]) if c.get("expires") not in (None, "", -1) else -1,
                    "httpOnly": bool(c.get("httpOnly", False)),
                    "secure": bool(c.get("secure", False)),
                    "sameSite": str(c.get("sameSite") or "Lax"),
                })
            if out:
                return out
        out = []
        for pair in str(credentials.get("cookie") or "").split(";"):
            if "=" not in pair:
                continue
            k, v = pair.strip().split("=", 1)
            if not k:
                continue
            out.append({
                "name": k, "value": v,
                "domain": ".jianshu.com", "path": "/",
                "expires": -1,
            })
        return out

    def _account_id(self, credentials: dict[str, Any]) -> str:
        return self.account_identity(credentials)

    def _headers(self, cookie: str) -> dict[str, str]:
        # 简书需要 Referer + X-Requested-With 才能调通 writer API
        return {
            "Cookie": cookie,
            "Accept": "application/json",
            "Content-Type": "application/json",
            "User-Agent": _USER_AGENT,
            "Referer": f"{_BASE}/writer/",
            "X-Requested-With": "XMLHttpRequest",
        }

    def _is_login_redirect(self, resp: httpx.Response) -> bool:
        """检测响应是否表明登录态失效(重定向到登录页 或 401/403)。"""
        if resp.status_code == 401:
            return True
        location = resp.headers.get("location", "")
        if location and any(hint in location for hint in _LOGIN_REDIRECT_HINTS):
            return True
        if resp.status_code == 403:
            # 403 不必然是登录失效：简书账号被冻结也是 403(code 9902)。
            # 只有正文/跳转明确指向登录时才归为 cookie 失效，否则交给 _api_error。
            text = (resp.text or "")[:1000]
            return any(hint in text for hint in ("/sign_in", "请先登录", "登录后", "login"))
        return False

    async def _request_with_retry(
        self,
        method: str,
        url: str,
        headers: dict[str, str],
        json_body: dict[str, Any] | None = None,
    ) -> httpx.Response:
        """带重试的 HTTP 请求。最多重试 _MAX_RETRIES 次,间隔 _RETRY_INTERVAL 秒。

        仅对网络异常/5xx 重试;4xx 与重定向不重试(客户端错误,重试无意义)。
        follow_redirects=False 用于检测登录态失效。
        """
        last_exc: Exception | None = None
        resp: httpx.Response | None = None
        for attempt in range(_MAX_RETRIES + 1):
            try:
                async with httpx.AsyncClient(
                    timeout=_TIMEOUT, follow_redirects=False,
                ) as client:
                    if method.upper() == "GET":
                        resp = await client.get(url, headers=headers)
                    else:
                        resp = await client.request(method.upper(), url, headers=headers, json=json_body)
                if resp.status_code < 500:
                    return resp
                logger.warning(
                    "[jianshu] HTTP %s on attempt %d, will retry",
                    resp.status_code, attempt + 1,
                )
            except httpx.HTTPError as e:
                last_exc = e
                logger.warning(
                    "[jianshu] http error on attempt %d: %s: %s",
                    attempt + 1, type(e).__name__, e,
                )
            if attempt < _MAX_RETRIES:
                await asyncio.sleep(_RETRY_INTERVAL)
        if last_exc is not None:
            raise last_exc
        assert resp is not None
        return resp

    async def verify_credentials(self, credentials: dict[str, Any]) -> tuple[bool, str]:
        # 2026-11-26:简书 /writer 对未登录也返回 200 的公开 SPA 编辑器页,不能当保护页;
        # /notifications 未登录会 302 到 /sign_in,登录后才 200,作为严格登录探针。
        if not _HAS_PLAYWRIGHT:
            return False, "Playwright not installed. Run: pip install playwright && playwright install chromium"
        cookies = self._cookies(credentials)
        if not cookies:
            return False, "missing cookie"
        try:
            async with async_playwright() as p:
                browser, context = await create_stealth_browser_context(
                    account_id=self._account_id(credentials),
                    platform=self.platform_id,
                    playwright_instance=p,
                    headless=True,
                    use_persistent=False,
                )
                try:
                    await context.add_cookies(cookies)
                    page = await context.new_page()
                    await human_pause(1.0, 2.0)
                    await page.goto(
                        "https://www.jianshu.com/notifications",
                        wait_until="domcontentloaded",
                        timeout=30000,
                    )
                    await page.wait_for_timeout(2500)
                    url = (page.url or "").lower()
                    if "/sign_in" in url or "/login" in url:
                        return False, "cookie expired (redirected to sign in)"
                    if "jianshu.com/notifications" not in url:
                        return False, f"cookie expired (unexpected notifications url: {page.url})"
                    return True, "connected (notifications accessible)"
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
        # 优先完整 jar：账号 16 的顶层 cookie 字段是旧值，会触发登录重定向；
        # __cookie_jar__ 才是当前有效登录态（2026-11-26 实测）。
        cookie = "; ".join(
            f"{c.get('name')}={c.get('value')}" for c in self._cookies(credentials) if c.get("name")
        )
        if not cookie:
            cookie = (credentials.get("cookie") or "").strip()
        if not cookie:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="missing cookie",
            )

        # 简书 content 字段接受 HTML
        html = content.html or ""
        if not html and content.text:
            html = "".join(
                f"<p>{line}</p>" if line.strip() else "<br>"
                for line in content.text.split("\n\n")
            )
        if not html:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="content is empty (no html/text)",
            )

        notebook_id = int(platform_config.get("notebook_id", 0) or 0)
        if not notebook_id:
            # 简书新版接口必须先有笔记本；账号 16 实测 /author/notebooks 返回
            # [{"id":56303947,"name":"日记本"}, ...]，旧代码写死 0 会 404。
            try:
                nb_resp = await self._request_with_retry(
                    "GET", f"{_BASE}/author/notebooks", headers=self._headers(cookie)
                )
                nb_data = nb_resp.json() if nb_resp.status_code == 200 else []
                if isinstance(nb_data, dict):
                    nb_data = nb_data.get("notebooks") or nb_data.get("data") or []
                if isinstance(nb_data, list) and nb_data:
                    notebook_id = int(nb_data[0].get("id") or 0)
            except Exception as e:
                logger.warning("[jianshu] fetch notebooks failed: %s", e)
        if not notebook_id:
            return PublishResult(
                success=False, platform=self.platform_id,
                error_message="no notebook_id (config empty and /author/notebooks returned none)",
            )

        logger.info(
            "[jianshu] publish start: title=%r notebook_id=%s",
            content.title, notebook_id,
        )

        def _api_error(resp: httpx.Response) -> str:
            try:
                data = resp.json()
            except Exception:
                return f"API {resp.status_code}: {resp.text[:300]}"
            errs = data.get("error") if isinstance(data, dict) else None
            if isinstance(errs, list) and errs:
                return f"API {resp.status_code}: {errs[0].get('message') or errs[0]}"
            if isinstance(data, dict) and data.get("message"):
                return f"API {resp.status_code}: {data.get('message')}"
            return f"API {resp.status_code}: {str(data)[:300]}"

        # 1) 新建笔记（只建壳，正文随后 PUT 写入）
        create_body = {
            "notebook_id": str(notebook_id),
            "title": content.title[:200],
            "at_bottom": bool(platform_config.get("at_bottom", False)),
        }
        try:
            resp = await self._request_with_retry(
                "POST", f"{_BASE}/author/notes",
                headers=self._headers(cookie), json_body=create_body,
            )
        except Exception as e:
            logger.error("[jianshu] create note failed: %s: %s", type(e).__name__, e, exc_info=True)
            return PublishResult(success=False, platform=self.platform_id,
                                 error_message=f"create note failed: {type(e).__name__}: {e}")
        if self._is_login_redirect(resp):
            return PublishResult(success=False, platform=self.platform_id,
                                 error_message="cookie expired or invalid (redirected to login)")
        if resp.status_code not in (200, 201):
            return PublishResult(success=False, platform=self.platform_id,
                                 error_message=_api_error(resp))
        try:
            data = resp.json()
        except Exception:
            data = {}
        if not isinstance(data, dict):
            data = {}
        note = data.get("note") or {}
        note_id = (
            (note or {}).get("id")
            or (data.get("id") if isinstance(data, dict) else None)
            or ((data.get("data") or {}).get("id") if isinstance(data.get("data"), dict) else None)
        )
        if not note_id:
            return PublishResult(success=False, platform=self.platform_id,
                                 error_message=f"create response missing note id: {str(data)[:400]}")

        # 2) 写入正文；autosave_control 用新建返回的值，简书靠它做冲突控制
        autosave_control = (data.get("autosave_control") if isinstance(data, dict) else 0) or 0
        update_body = {
            "id": note_id,
            "autosave_control": autosave_control,
            "title": content.title[:200],
            "content": html,
        }
        try:
            update_resp = await self._request_with_retry(
                "PUT", f"{_BASE}/author/notes/{note_id}",
                headers=self._headers(cookie), json_body=update_body,
            )
        except Exception as e:
            logger.error("[jianshu] update note failed: %s: %s", type(e).__name__, e, exc_info=True)
            return PublishResult(success=False, platform=self.platform_id,
                                 error_message=f"update note failed: {type(e).__name__}: {e}")
        if update_resp.status_code not in (200, 201):
            return PublishResult(success=False, platform=self.platform_id,
                                 error_message=f"update note failed: {_api_error(update_resp)}")

        # 3) 发布（publicize），不是旧代码的 /writer/notes 一步建文
        try:
            pub_resp = await self._request_with_retry(
                "POST", f"{_BASE}/author/notes/{note_id}/publicize",
                headers=self._headers(cookie), json_body={},
            )
        except Exception as e:
            logger.error("[jianshu] publicize failed: %s: %s", type(e).__name__, e, exc_info=True)
            return PublishResult(success=False, platform=self.platform_id,
                                 error_message=f"publicize failed: {type(e).__name__}: {e}")
        if pub_resp.status_code not in (200, 201):
            return PublishResult(success=False, platform=self.platform_id,
                                 error_message=f"publicize failed: {_api_error(pub_resp)}")

        # slug 优先从发布响应取；取不到就回查内容接口。
        pub_data = {}
        try:
            pub_data = pub_resp.json()
        except Exception:
            pass
        slug = str(data.get("slug") or "") if isinstance(data, dict) else ""
        if isinstance(pub_data, dict):
            slug = slug or str(pub_data.get("slug") or (pub_data.get("note") or {}).get("slug") or "")
        if not slug:
            try:
                content_resp = await self._request_with_retry(
                    "GET", f"{_BASE}/author/notes/{note_id}/content", headers=self._headers(cookie)
                )
                if content_resp.status_code == 200:
                    cdata = content_resp.json()
                    if isinstance(cdata, dict):
                        slug = str(cdata.get("slug") or (cdata.get("note") or {}).get("slug") or "")
            except Exception:
                pass
        published_url = f"{_BASE}/p/{slug}" if slug else f"{_BASE}/writer"
        logger.info("[jianshu] publish success: id=%s slug=%s", note_id, slug)
        return PublishResult(
            success=True, platform=self.platform_id,
            published_url=published_url, platform_content_id=str(note_id),
            payload={"post_id": note_id, "slug": slug, "url": published_url},
        )
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
