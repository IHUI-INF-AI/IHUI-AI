# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Computer Use 浏览器可视化驾驶舱路由(对标 Claude Computer Use)。

提供一批最小可用的"浏览器驾驶"端点,让用户通过 web 面板可视化地操作真实的
headless Chromium(打开页面/交互元素快照/点击/输入/截图/提取文本/关闭)。

驱动层:playwright.async_api + 进程级单例 Browser/Context/Page。
- main.py 已在 Windows 强制 ProactorEventLoop(否则 Playwright 启动 Chromium 会
  报 NotImplementedError),async Playwright 可正常驱动 subprocess。
- 单例跨请求复用:首次 open 时懒加载启动 Chromium,后续 snapshot/click/type/
  screenshot 复用同一 Page,保持浏览会话状态;失败不清状态(下次请求自愈重连)。
- 关闭:POST /api/computer-use/close 显式关闭本文将进程释放,亦可复用
  main.py shutdown 时统一收口(见 lifespan)。

认证/审计:复用项目 pass-the-request 的 `get_current_user_id` 依赖注入
(与 routers/research.py / agents.py 一致)。

端点(router prefix="/computer-use",由 main.py include_router(prefix="/api")):
  POST /api/computer-use/open        → 打开 URL
  GET  /api/computer-use/snapshot    → 当前页可交互元素快照(ref/tag/role/name/坐标/状态)
  POST /api/computer-use/click       → 按 ref / selector / x,y 点击
  POST /api/computer-use/type        → 按 ref / selector / x,y 输入文本
  GET  /api/computer-use/screenshot  → 返回 base64 PNG(视口/整页)
  POST /api/computer-use/extract-text→ 提取当前页可见文本
  POST /api/computer-use/close       → 关闭浏览器并释放进程
"""

from __future__ import annotations

import asyncio
import base64
import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..core.jwt_auth import get_current_user_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/computer-use", tags=["computer-use"])

# ============ 单例浏览器状态(进程级跨请求复用)============

_playwright: Any = None
_browser: Any = None
_context: Any = None
_page: Any = None
_lock: asyncio.Lock | None = None

# 最近一次快照的元素(供 ref → 坐标换算,click/type 复用)
_last_snapshot: list[dict[str, Any]] = []

# 只收集这些可交互标签/角色
_SNAPSHOT_SELECTOR = (
    "button, a, input, textarea, select, "
    '[role="button"], [role="link"], [role="textbox"], [role="checkbox"], '
    '[role="radio"], [contenteditable="true"]'
)

_LAUNCH_ARGS = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-extensions",
    "--disable-plugins",
    "--disable-default-apps",
]


def _lock_ref() -> asyncio.Lock:
    """懒创建全局 asyncio.Lock(避免 import 时跨事件循环绑定)。"""
    global _lock
    if _lock is None:
        _lock = asyncio.Lock()
    return _lock


async def _ensure_page() -> Any:
    """获取单例 Page;未启动时懒加载 Chromium。失败不清状态(下次调用自愈)。"""
    global _playwright, _browser, _context, _page
    async with _lock_ref():
        if _page is not None and not _page.is_closed():
            return _page

        try:
            from playwright.async_api import async_playwright
        except ImportError as e:
            raise RuntimeError(
                "Playwright 未安装。请在 ai-service 目录执行: "
                "uv add playwright && uv run playwright install chromium"
            ) from e

        _playwright = await async_playwright().start()
        _browser = await _playwright.chromium.launch(headless=True, args=_LAUNCH_ARGS)
        _context = await _browser.new_context(
            viewport={"width": 1280, "height": 800},
            locale="zh-CN",
            timezone_id="Asia/Shanghai",
        )
        _page = await _context.new_page()
        logger.info("[computer_use] Chromium 已启动(单例)")
        return _page


def _require_page() -> Any:
    """同步检查是否已有单例 Page(未 open 过则报错)。"""
    if _page is None or _page.is_closed():
        raise HTTPException(
            status_code=409, detail="浏览器未打开,请先调用 POST /api/computer-use/open"
        )
    return _page


async def _close_page() -> None:
    """关闭单例浏览器(幂等)。"""
    global _playwright, _browser, _context, _page, _last_snapshot
    async with _lock_ref():
        for _obj in (_page, _context, _browser, _playwright):
            if _obj is not None:
                try:
                    await _obj.close()
                except Exception as e:  # pragma: no cover - 防御性清理
                    logger.warning("[computer_use] 关闭浏览器组件失败(忽略): %s", e)
        _page = _context = _browser = _playwright = None
        _last_snapshot = []


async def _take_snapshot_inner() -> list[dict[str, Any]]:
    """从当前页面提取可交互元素列表(带 ref 索引与中心坐标)。"""
    global _last_snapshot
    page = _require_page()
    try:
        raw = await page.eval_on_selector_all(
            _SNAPSHOT_SELECTOR,
            """els => els.map(el => {
                const r = el.getBoundingClientRect();
                if (!r.width && !r.height) return null;
                const name = (el.getAttribute('aria-label')
                  || el.innerText?.trim()
                  || el.value
                  || el.placeholder
                  || el.textContent?.trim()
                  || el.getAttribute('name')
                  || '') .slice(0, 120);
                return {
                  tag: (el.tagName || '').toLowerCase(),
                  role: el.getAttribute('role') || '',
                  name,
                  x: Math.round(r.x + r.width / 2),
                  y: Math.round(r.y + r.height / 2),
                  width: Math.round(r.width),
                  height: Math.round(r.height),
                  disabled: !!el.disabled,
                  checked: el.checked === true,
                };
              }).filter(Boolean)""",
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"提取快照失败: {e}") from e

    items: list[dict[str, Any]] = []
    for i, it in enumerate(raw or []):
        items.append(
            {
                "ref": i,
                "tag": it.get("tag"),
                "role": it.get("role"),
                "name": it.get("name") or "",
                "x": it.get("x"),
                "y": it.get("y"),
                "width": it.get("width"),
                "height": it.get("height"),
                "disabled": bool(it.get("disabled")),
                "checked": bool(it.get("checked")),
            }
        )
    _last_snapshot = items
    return items


def _resolve_target(
    *,
    ref: int | None,
    selector: str | None,
    x: int | None,
    y: int | None,
) -> dict[str, Any]:
    """把 (ref | selector | x,y) 归一化为可操作的坐标字典。

    - ref:命中最近一次快照的元素,取其中点坐标
    - selector:返回 selector 标志,由调用方用 locator 处理
    - x,y:直接命中坐标
    """
    if selector:
        return {"selector": selector}
    if ref is not None:
        if not _last_snapshot:
            raise HTTPException(status_code=409, detail="尚无快照,请先调用 snapshot")
        for it in reversed(_last_snapshot):
            if it.get("ref") == ref:
                return {"x": it.get("x"), "y": it.get("y"), "ref": ref}
        raise HTTPException(status_code=404, detail=f"ref={ref} 不在最近快照中,请重新 snapshot")
    if x is not None and y is not None:
        return {"x": x, "y": y}
    raise HTTPException(status_code=422, detail="必须提供 selector / ref / x,y 三者之一")


# ============ 数据模型 ============


class OpenRequest(BaseModel):
    url: str = Field(..., min_length=1, description="要打开的 URL")
    timeout_ms: int = Field(15000, ge=1000, le=60000, description="页面加载超时 ms")


class ClickRequest(BaseModel):
    selector: str | None = Field(None, description="CSS 选择器(优先)")
    ref: int | None = Field(None, description="最近一次快照中的元素 ref")
    x: int | None = Field(None, description="点击中心 x")
    y: int | None = Field(None, description="点击中心 y")


class TypeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000, description="要输入的文本")
    selector: str | None = Field(None, description="CSS 选择器(优先)")
    ref: int | None = Field(None, description="最近一次快照中的元素 ref")
    x: int | None = Field(None, description="点击中心 x")
    y: int | None = Field(None, description="点击中心 y")
    clear: bool = Field(False, description="输入前是否清空原有内容")


# ============ 端点 ============


@router.post("/open")
async def computer_use_open(
    body: OpenRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """打开指定 URL,返回最终 url + title。"""
    page = await _ensure_page()
    try:
        await page.goto(body.url, timeout=body.timeout_ms, wait_until="domcontentloaded")
        title = (await page.title()) or ""
        return {"url": page.url, "title": title, "status": "opened"}
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"打开页面失败: {type(e).__name__}: {str(e)[:300]}",
        ) from e


@router.get("/snapshot")
async def computer_use_snapshot(
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """返回当前页可交互元素快照(ref/tag/role/name/坐标/状态)。"""
    # 触发鉴权(未 open 时内部 _require_page 报 409)
    items = await _take_snapshot_inner()
    current_url = _page.url if (_page and not _page.is_closed()) else ""
    return {"url": current_url, "count": len(items), "elements": items}


@router.post("/click")
async def computer_use_click(
    body: ClickRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """点击请求目标(ref / selector / x,y)。"""
    page = _require_page()
    t = _resolve_target(ref=body.ref, selector=body.selector, x=body.x, y=body.y)
    try:
        if "selector" in t:
            await page.click(t["selector"])
        else:
            await page.mouse.click(int(t["x"]), int(t["y"]))
        return {"ok": True, "target": t}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"点击失败: {type(e).__name__}: {str(e)[:300]}"
        ) from e


@router.post("/type")
async def computer_use_type(
    body: TypeRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """向请求目标输入文本(ref / selector / x,y,可选清空)。"""
    page = _require_page()
    t = _resolve_target(ref=body.ref, selector=body.selector, x=body.x, y=body.y)
    try:
        if "selector" in t:
            loc = page.locator(t["selector"]).first
            await loc.click()
            if body.clear:
                await loc.fill("")
            await loc.type(body.text, delay=10)
        else:
            await page.mouse.click(int(t["x"]), int(t["y"]))
            if body.clear:
                await page.keyboard.press("Control+A")
            await page.keyboard.type(body.text, delay=10)
        return {"ok": True, "target": t, "length": len(body.text)}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"输入失败: {type(e).__name__}: {str(e)[:300]}"
        ) from e


@router.get("/screenshot")
async def computer_use_screenshot(
    full_page: bool = False,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """返回当前页截图 base64 PNG(默认视口,full_page=true 整页)。"""
    page = _require_page()
    try:
        data = await page.screenshot(full_page=full_page, type="png")
        viewport = await page.viewport_size()
        return {
            "screenshot": base64.b64encode(data).decode("ascii"),
            "full_page": full_page,
            "width": (viewport or {}).get("width"),
            "height": (viewport or {}).get("height"),
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"截图失败: {type(e).__name__}: {str(e)[:300]}"
        ) from e


@router.post("/extract-text")
async def computer_use_extract_text(
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """提取当前页可见文本(HTML 换行归一化)。"""
    page = _require_page()
    try:
        text = await page.evaluate(
            "() => document.body ? document.body.innerText : ''"
        )
        text = "\n".join(line.strip() for line in (text or "").splitlines() if line.strip())
        return {"url": page.url, "length": len(text), "text": text[:50000]}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"提取文本失败: {type(e).__name__}: {str(e)[:300]}"
        ) from e


@router.post("/close")
async def computer_use_close(
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """关闭浏览器并释放 Chromium 进程(幂等)。"""
    await _close_page()
    return {"ok": True, "status": "closed"}


__all__ = ["router"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
