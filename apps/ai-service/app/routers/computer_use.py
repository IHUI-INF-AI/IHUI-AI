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

trace 录制/回放(2-4,H9 失败可回放):
  POST /api/computer-use/trace/start     → 开启录制(后续操作自动记录为结构化 trace)
  POST /api/computer-use/trace/stop      → 结束录制,返回 trace 摘要
  GET  /api/computer-use/trace           → 列出全部 trace 摘要
  GET  /api/computer-use/trace/{id}      → 取单个 trace 详情(含全部步骤)
  DELETE /api/computer-use/trace/{id}    → 删除 trace
  POST /api/computer-use/replay          → 按序回放 trace,返回成功率与失败差异报告
"""

from __future__ import annotations

import asyncio
import base64
import logging
import time
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..core.jwt_auth import get_current_user_id
from ..services.browser_replay import PageDriver, classify_error, replay_trace
from ..services.browser_trace import browser_trace_store, new_trace_id

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

# trace 录制状态:当前活跃 trace_id(None=未录制)。
# /trace/start 开启后,open/click/type/screenshot/extract-text 每次调用都会
# 自动追加结构化步骤到 browser_trace_store,供 /replay 按序回放。
_recording_trace_id: str | None = None

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


# ============ trace 录制钩子 ============


def _record_step(
    action: str,
    *,
    target: dict[str, Any] | None = None,
    params: dict[str, Any] | None = None,
    expect: dict[str, Any] | None = None,
    status: str = "ok",
    result_summary: str = "",
    error: dict[str, str] | None = None,
    duration_ms: float = 0.0,
) -> dict[str, Any] | None:
    """录制活跃时把一步操作追加到 browser_trace_store;未录制返回 None。

    记录失败只打日志不影响主操作(录制是旁路可观测,不引入新失败面)。
    """
    if _recording_trace_id is None:
        return None
    try:
        return browser_trace_store.append_step(
            _recording_trace_id,
            {
                "action": action,
                "target": target,
                "params": params,
                "expect": expect,
                "status": status,
                "result_summary": result_summary,
                "error": error,
                "duration_ms": round(duration_ms, 2),
            },
        )
    except Exception as e:
        logger.warning("[computer_use] trace 步骤记录失败(忽略): %s", e)
        return None


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
    started = time.monotonic()
    try:
        await page.goto(body.url, timeout=body.timeout_ms, wait_until="domcontentloaded")
        title = (await page.title()) or ""
        _record_step(
            "navigate",
            params={"url": body.url, "timeout_ms": body.timeout_ms},
            result_summary=f"url={page.url} title={title}",
            duration_ms=(time.monotonic() - started) * 1000,
        )
        return {"url": page.url, "title": title, "status": "opened"}
    except Exception as e:
        _record_step(
            "navigate",
            params={"url": body.url, "timeout_ms": body.timeout_ms},
            status="error",
            error={"kind": "navigation_error", "message": f"{type(e).__name__}: {str(e)[:300]}"},
            duration_ms=(time.monotonic() - started) * 1000,
        )
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
    started = time.monotonic()
    try:
        if "selector" in t:
            await page.click(t["selector"])
        else:
            await page.mouse.click(int(t["x"]), int(t["y"]))
        _record_step(
            "click",
            target=t,
            result_summary=f"clicked {t}",
            duration_ms=(time.monotonic() - started) * 1000,
        )
        return {"ok": True, "target": t}
    except Exception as e:
        _record_step(
            "click",
            target=t,
            status="error",
            error=classify_error(e, "click"),
            duration_ms=(time.monotonic() - started) * 1000,
        )
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
    started = time.monotonic()
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
        _record_step(
            "type",
            target=t,
            params={"text": body.text, "clear": body.clear},
            result_summary=f"typed {len(body.text)} chars into {t}",
            duration_ms=(time.monotonic() - started) * 1000,
        )
        return {"ok": True, "target": t, "length": len(body.text)}
    except Exception as e:
        _record_step(
            "type",
            target=t,
            params={"text": body.text, "clear": body.clear},
            status="error",
            error=classify_error(e, "type"),
            duration_ms=(time.monotonic() - started) * 1000,
        )
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
    started = time.monotonic()
    try:
        data = await page.screenshot(full_page=full_page, type="png")
        viewport = await page.viewport_size()
        step = _record_step(
            "screenshot",
            params={"full_page": full_page},
            result_summary=f"png {len(data)}B",
            duration_ms=(time.monotonic() - started) * 1000,
        )
        if step is not None and _recording_trace_id is not None:
            browser_trace_store.attach_screenshot(_recording_trace_id, step["step_index"], data)
        return {
            "screenshot": base64.b64encode(data).decode("ascii"),
            "full_page": full_page,
            "width": (viewport or {}).get("width"),
            "height": (viewport or {}).get("height"),
        }
    except Exception as e:
        _record_step(
            "screenshot",
            params={"full_page": full_page},
            status="error",
            error={"kind": "exception", "message": f"{type(e).__name__}: {str(e)[:300]}"},
            duration_ms=(time.monotonic() - started) * 1000,
        )
        raise HTTPException(
            status_code=500, detail=f"截图失败: {type(e).__name__}: {str(e)[:300]}"
        ) from e


@router.post("/extract-text")
async def computer_use_extract_text(
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """提取当前页可见文本(HTML 换行归一化)。"""
    page = _require_page()
    started = time.monotonic()
    try:
        text = await page.evaluate(
            "() => document.body ? document.body.innerText : ''"
        )
        text = "\n".join(line.strip() for line in (text or "").splitlines() if line.strip())
        _record_step(
            "extract_text",
            result_summary=text[:200],
            duration_ms=(time.monotonic() - started) * 1000,
        )
        return {"url": page.url, "length": len(text), "text": text[:50000]}
    except Exception as e:
        _record_step(
            "extract_text",
            status="error",
            error={"kind": "exception", "message": f"{type(e).__name__}: {str(e)[:300]}"},
            duration_ms=(time.monotonic() - started) * 1000,
        )
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


# ============ trace 录制 / 回放端点(2-4,H9 失败可回放)============


class TraceStartRequest(BaseModel):
    trace_id: str | None = Field(
        None, description="指定 trace_id(缺省自动生成);已有同名 trace 则续录"
    )


class ReplayRequest(BaseModel):
    trace_id: str = Field(..., min_length=1, description="要回放的 trace_id")
    stop_on_error: bool = Field(True, description="失败步骤是否立即中止回放")
    save_failure_screenshot: bool = Field(
        True, description="失败步骤是否落盘截图(供失败取证)"
    )


@router.post("/trace/start")
async def computer_use_trace_start(
    body: TraceStartRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """开启 trace 录制:此后 open/click/type/screenshot/extract-text 自动记步。"""
    global _recording_trace_id
    trace_id = body.trace_id or new_trace_id()
    existing = browser_trace_store.get_trace(trace_id)
    _recording_trace_id = trace_id
    return {
        "trace_id": trace_id,
        "status": "recording",
        "resumed": existing is not None,
        "step_count": len(existing["steps"]) if existing else 0,
    }


@router.post("/trace/stop")
async def computer_use_trace_stop(
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """结束录制,返回该 trace 摘要。未在录制时返回 idle。"""
    global _recording_trace_id
    if _recording_trace_id is None:
        return {"trace_id": None, "status": "idle", "step_count": 0}
    trace_id = _recording_trace_id
    _recording_trace_id = None
    trace = browser_trace_store.get_trace(trace_id)
    steps = trace["steps"] if trace else []
    ok = sum(1 for s in steps if s.get("status") == "ok")
    return {
        "trace_id": trace_id,
        "status": "stopped",
        "step_count": len(steps),
        "ok_count": ok,
        "error_count": len(steps) - ok,
    }


@router.get("/trace")
async def computer_use_trace_list(
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """列出全部 trace 摘要(新的在前)。"""
    items = browser_trace_store.list_traces()
    return {"count": len(items), "traces": items}


@router.get("/trace/{trace_id}")
async def computer_use_trace_detail(
    trace_id: str,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """取单个 trace 详情(含全部步骤与断言)。"""
    trace = browser_trace_store.get_trace(trace_id)
    if trace is None:
        raise HTTPException(status_code=404, detail=f"trace 不存在: {trace_id}")
    return trace


@router.delete("/trace/{trace_id}")
async def computer_use_trace_delete(
    trace_id: str,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """删除 trace(幂等)。"""
    ok = browser_trace_store.delete_trace(trace_id)
    return {"ok": ok, "trace_id": trace_id}


@router.post("/replay")
async def computer_use_replay(
    body: ReplayRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """按序回放 trace:navigate/click/type 真实驱动,失败步骤记录差异+截图。"""
    trace = browser_trace_store.get_trace(body.trace_id)
    if trace is None:
        raise HTTPException(status_code=404, detail=f"trace 不存在: {body.trace_id}")
    if not trace["steps"]:
        raise HTTPException(status_code=409, detail="trace 无步骤,无法回放")

    page = await _ensure_page()
    driver = PageDriver(page)

    async def _failure_screenshot(step_index: int) -> str | None:
        if not body.save_failure_screenshot:
            return None
        data = await driver.screenshot_bytes()
        if data is None:
            return None
        return browser_trace_store.save_trace_file(
            body.trace_id, f"replay_step_{step_index:03d}_fail.png", data
        )

    report = await replay_trace(
        trace["steps"],
        driver,
        stop_on_error=body.stop_on_error,
        on_step_failure=_failure_screenshot,
    )
    report["trace_id"] = body.trace_id
    return report


__all__ = ["router"]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
