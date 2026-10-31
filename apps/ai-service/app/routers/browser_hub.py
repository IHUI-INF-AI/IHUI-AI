# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Browser Hub API 路由(2026-07-31 新增)。

端点:
- POST   /browser/sessions                  创建会话
- GET    /browser/sessions                  列出会话
- GET    /browser/sessions/{session_id}     获取会话信息
- DELETE /browser/sessions/{session_id}     关闭会话
- POST   /browser/sessions/{session_id}/navigate   导航
- GET    /browser/sessions/{session_id}/cookies     获取 cookies
- POST   /browser/sessions/{session_id}/screenshot  一次性截图
- POST   /browser/sessions/{session_id}/back        后退
- POST   /browser/sessions/{session_id}/forward     前进
- POST   /browser/sessions/{session_id}/reload      刷新
- WS     /browser/ws/{session_id}           WebSocket 画面流 + 事件回传

作用域(gap#3,2026-10-31):`{session_id}` 在本路由里就是 **tab 指针**。每一条动作
都必须经 `hub.require_tab(BrowserTabScope(...))` —— 三个值只来自承载层:路径参数给出
tab_id,`Depends(get_current_user_id)`/WS 的 `verify_access_token` 给出已验证主体,
请求体**不参与**作用域判定(体里的字段是客户端可整写面,§5)。缺 tab_id ⇒ `missing_tab_scope`
(400 具名),跨属主/未登记 ⇒ 与"不存在"同形的 404(不当预言机),且**没有**"退到用户级
取最近一枚 tab"的任何出口。

未接的一格(如实登记):请求侧一次性消费(jti 防重放)。判据单源在 apps/api 的 TS 侧
(`src/plugins/internal-service-ticket.ts` 的 `ReplayStore.consume`),ai-service 只有发票
出口(`app/core/internal_ticket.py`)、没有验票/消费口,而这条腿的请求形状里也没有 jti
(走用户 access JWT)。按 §0.6 不在 Python 侧另抄第二份防重放判据 ⇒ 跨语言复用受阻,交主席裁。

WebSocket 协议:
- 服务端推送: {"type": "frame", "data": "<base64 jpeg>", "metadata": {...}}
- 服务端推送: {"type": "navigation", "url": "...", "title": "..."}
- 客户端发送: {"type": "mouse", "x": 100, "y": 200, "button": "left", "event_type": "mousePressed"}
- 客户端发送: {"type": "key", "key": "Enter", "event_type": "keyDown"}
- 客户端发送: {"type": "wheel", "x": 100, "y": 200, "delta_x": 0, "delta_y": -100}
- 客户端发送: {"type": "navigate", "url": "https://..."}
- 客户端发送: {"type": "type", "text": "hello"}
- 客户端发送: {"type": "back"} / {"type": "forward"} / {"type": "reload"}
- 客户端发送: {"type": "ping"} → 服务端响应 {"type": "pong"}
"""
from __future__ import annotations

import json
import logging
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import Response
from pydantic import BaseModel, Field

from ..core.jwt_auth import get_current_user_id, principal_from_payload, verify_access_token
from ..services.browser_hub import (
    TAB_SCOPE_MISSING,
    BrowserTabScope,
    BrowserTabScopeError,
    hub,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/browser", tags=["browser-hub"])


# =============================================================================
# tab 级作用域(gap#3)
# =============================================================================
def _tab_scope(
    tab_id: str | None,
    user_id: str | None,
    *,
    chat_session_id: str | None = None,
) -> BrowserTabScope:
    """动作端点唯一的作用域构造器。

    三个入参的来源都是承载层:`tab_id` 来自路由路径参数(由本服务自己在创建时 mint 的
    uuid4,不是模型/客户端可自报的字段名),`user_id` 来自已验证的 JWT 主体,
    `chat_session_id` 只有承载层注入的会话态才能填(HTTP 主链路今天没有这一路输入 ⇒ None,
    该维不设限;它**不是**"退到 user 级",tab 登记与严格属主两维照旧全判)。

    `user_id` 允许 None 是**必需的**:None 表示"承载层没能给出主体",判据那边
    (strict_browser_owner)据此拒 ⇒ `unverified_caller`。把它挡在构造器之外(比如自造
    一个匿名主体填进去)才是问题 —— 那等于把"没有身份"伪装成"有身份"。
    """
    return BrowserTabScope(
        tab_id=tab_id,
        owner_user_id=user_id,
        chat_session_id=chat_session_id,
        strict_browser_owner=True,
    )


def _tab_scope_denial(exc: BrowserTabScopeError) -> HTTPException:
    """具名拒因 → HTTP 形状。

    跨属主 / 未登记 / 会话态不匹配 / 主体缺位 **一律同一个 404 形状**,与旧的
    `会话不存在: {id}` 逐字同形 —— 别人的 tab 必须与"不存在"无法区分,否则这一组端点
    合起来就是"探测他人 tab 是否存在"的预言机。只有 `missing_tab_scope` 给 400:那是
    调用方自己的请求契约写错了(没点名 tab),不含任何关于他人资源的信息。
    """
    if exc.code == TAB_SCOPE_MISSING:
        return HTTPException(
            status_code=400,
            detail=f"{TAB_SCOPE_MISSING}: 浏览器动作必须点名 tab(缺少 tab_id),不提供用户级兜底",
        )
    return HTTPException(status_code=404, detail=f"会话不存在: {exc.tab_id or ''}")


# =============================================================================
# Schema
# =============================================================================
class CreateSessionRequest(BaseModel):
    url: str | None = Field(None, description="初始 URL(可选,不传则打开 about:blank)")
    viewport_width: int = Field(1280, description="视口宽度")
    viewport_height: int = Field(720, description="视口高度")
    user_agent: str | None = Field(None, description="自定义 User-Agent")


class NavigateRequest(BaseModel):
    url: str = Field(..., description="目标 URL")
    wait_until: Literal["commit", "domcontentloaded", "load", "networkidle"] = Field(
        "domcontentloaded", description="等待事件"
    )


class SessionInfo(BaseModel):
    session_id: str
    url: str
    title: str
    cookie_count: int


# =============================================================================
# 会话管理
# =============================================================================
@router.post("/sessions")
async def create_session(
    body: CreateSessionRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """创建新的浏览器会话。"""
    session = await hub.create_session(
        url=body.url,
        viewport={"width": body.viewport_width, "height": body.viewport_height},
        user_agent=body.user_agent,
        owner_user_id=user_id,
    )
    try:
        url = await session.get_current_url()
        title = await session.get_title()
        cookies = await session.get_cookies()
    except Exception as e:  # noqa: BLE001 — 页面在 goto 之后被关闭是常态,不是服务器故障
        # 实测(2026-09-29 本机 xiaohongshu):会话建成、页面随即被平台侧关掉,
        # 于是 `Page.title` 抛 TargetClosedError → 未捕获 → 整个请求 500「服务内部错误」,
        # 而那个已经死掉的会话仍留在 hub 里(占着一个 context 直到超时)。
        # 现在:先关会话再如实报 502,并把"改走外部浏览器/手动导入"这条出路写进文案。
        await session.close()
        raise HTTPException(
            status_code=502,
            detail=f"登录页打开后被关闭({type(e).__name__}),请改用外部浏览器或手动导入 Cookie",
        ) from e
    return {
        "code": 0,
        "message": "会话已创建",
        "data": {
            "session_id": session.session_id,
            "url": url,
            "title": title,
            "cookie_count": len(cookies),
        },
    }


@router.get("/sessions")
async def list_sessions(user_id: str = Depends(get_current_user_id)) -> dict[str, Any]:
    """列出所有会话。"""
    # 列表与计数**同一个谓词**(旧写法 list 全量而 count 也是全量,任何人能看到别人的
        # session_id 并拿去逐个探测)
    return {
        "code": 0,
        "data": {
            "session_ids": hub.list_sessions(user_id),
            "count": hub.session_count_for(user_id),
        },
    }


@router.get("/sessions/{session_id}")
async def get_session_info(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """获取会话信息。"""
    try:
        session = hub.require_tab(_tab_scope(session_id, user_id))
    except BrowserTabScopeError as exc:
        raise _tab_scope_denial(exc) from exc
    url = await session.get_current_url()
    title = await session.get_title()
    cookies = await session.get_cookies()
    return {
        "code": 0,
        "data": {
            "session_id": session_id,
            "url": url,
            "title": title,
            "cookie_count": len(cookies),
        },
    }


@router.delete("/sessions/{session_id}")
async def close_session(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """关闭会话。"""
    try:
        ok = await hub.close_tab(_tab_scope(session_id, user_id))
    except BrowserTabScopeError as exc:
        raise _tab_scope_denial(exc) from exc
    if not ok:
        raise HTTPException(status_code=404, detail=f"会话不存在: {session_id}")
    return {"code": 0, "message": "会话已关闭", "data": {"session_id": session_id}}


# =============================================================================
# 浏览器操作
# =============================================================================
@router.post("/sessions/{session_id}/navigate")
async def navigate(
    session_id: str,
    body: NavigateRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """导航到指定 URL。"""
    try:
        session = hub.require_tab(_tab_scope(session_id, user_id))
    except BrowserTabScopeError as exc:
        raise _tab_scope_denial(exc) from exc
    result = await session.navigate(body.url, wait_until=body.wait_until)
    return {"code": 0, "data": result}


@router.get("/sessions/{session_id}/cookies")
async def get_cookies(
    session_id: str,
    urls: str | None = None,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """获取 cookies。

    可选 query 参数 ?urls=https://a.com,https://b.com 过滤特定域名的 cookies。
    """
    try:
        session = hub.require_tab(_tab_scope(session_id, user_id))
    except BrowserTabScopeError as exc:
        raise _tab_scope_denial(exc) from exc
    url_list = urls.split(",") if urls else None
    cookies = await session.get_cookies(url_list)
    return {
        "code": 0,
        "data": {
            "cookies": cookies,
            "count": len(cookies),
        },
    }


@router.get("/sessions/{session_id}/screenshot")
async def screenshot(
    session_id: str,
    full_page: bool = False,
    user_id: str = Depends(get_current_user_id),
) -> Response:
    """一次性截图(返回 PNG)。"""
    try:
        session = hub.require_tab(_tab_scope(session_id, user_id))
    except BrowserTabScopeError as exc:
        raise _tab_scope_denial(exc) from exc
    png_bytes = await session.screenshot(full_page=full_page)
    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={"Cache-Control": "no-store, no-cache, must-revalidate"},
    )


@router.post("/sessions/{session_id}/back")
async def go_back(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    try:
        session = hub.require_tab(_tab_scope(session_id, user_id))
    except BrowserTabScopeError as exc:
        raise _tab_scope_denial(exc) from exc
    ok = await session.go_back()
    return {"code": 0, "data": {"success": ok, "url": await session.get_current_url()}}


@router.post("/sessions/{session_id}/forward")
async def go_forward(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    try:
        session = hub.require_tab(_tab_scope(session_id, user_id))
    except BrowserTabScopeError as exc:
        raise _tab_scope_denial(exc) from exc
    ok = await session.go_forward()
    return {"code": 0, "data": {"success": ok, "url": await session.get_current_url()}}


@router.post("/sessions/{session_id}/reload")
async def reload(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
) -> dict[str, Any]:
    """刷新页面;命中反爬/风控墙时自动重建会话(返回新 session_id)。

    2026-08-02 fix:抖音/微信等站点在 CDP 会话被风控后,reload 仍停在验证墙,
    此时重建全新 context(新指纹)通常可恢复正常页面。
    """
    try:
        session = hub.require_tab(_tab_scope(session_id, user_id))
    except BrowserTabScopeError as exc:
        raise _tab_scope_denial(exc) from exc
    recreated = False
    if await session.reload_with_recovery():
        new_session = await hub.recreate_session(session_id, user_id)
        if new_session:
            session = new_session
            recreated = True
    return {
        "code": 0,
        "data": {
            "url": await session.get_current_url(),
            "session_id": session.session_id,
            "recreated": recreated,
        },
    }


# =============================================================================
# WebSocket:画面流 + 事件回传
# =============================================================================
@router.websocket("/ws/{session_id}")
async def websocket_endpoint(ws: WebSocket, session_id: str) -> None:
    """WebSocket 端点:推送画面帧 + 接收鼠标键盘事件。

    流程:
    1. 客户端连接 → 服务端接受 → 开始推流
    2. 服务端持续推送 {"type": "frame", "data": "<base64 jpeg>"}
    3. 客户端发送鼠标/键盘/导航事件 → 服务端转发到 Chromium
    4. 页面导航完成 → 服务端推送 {"type": "navigation", "url": "...", "title": "..."}
    5. 客户端断开 → 停止推流

    P0-4 鉴权(2026-08-05):WS 握手不走 HTTP 中间件,手动校验
    query 参数 token(access JWT),失败 close 4401;客户端拼 ?token=<access_token>。
    """
    # P0-4:WS 手动鉴权(fail-closed,无 token / 无效 token 一律拒绝)
    token = ws.query_params.get("token", "")
    payload = verify_access_token(token) if token else None
    if payload is None:
        await ws.accept()
        await ws.close(code=4401, reason="Not authenticated")
        return
    # P0(B 组 / G-258):旧实现在这里**只判 payload 非空就把主体丢掉**,于是任意一张
    # 有效 access token 都能 attach 任何人的会话 —— 拿到画面流只是难看,真正的洞是
    # 这条通道能 dispatch_mouse / dispatch_key / execute_js,等于远程操作别人的浏览器
    # 并在别人已登录的页面里执行任意脚本。
    ws_user_id = principal_from_payload(payload)

    # tab 级作用域(gap#3):WS 与 HTTP 动作端点走同一个判据出口,不在这里另抄一份。
    # 顺带关掉旧的一格:`principal_from_payload` 取不到主体(返回 None)时,原写法交给
    # 用户级读取口的 `caller=None` 命中的正是 `_same_owner` 里"None = 系统级不设过滤",
    # 等于一张没有主体的 token 就能 attach 任何人的 tab。严格档下这判成 unverified_caller。
    try:
        session = hub.require_tab(_tab_scope(session_id, ws_user_id))
    except BrowserTabScopeError as exc:
        # 具名拒因只落服务端日志:对外仍与"不存在"逐字同形(不给探测留缝)
        logger.info(f"[browser_hub] WebSocket 拒绝: session={session_id} 拒因={exc.code}")
        await ws.accept()
        await ws.close(code=4004, reason=f"会话不存在: {session_id}")
        return
    await ws.accept()
    logger.info(f"[browser_hub] WebSocket 连接: session={session_id}")

    # 导航监听:页面加载完成后推送导航事件
    # (set_navigation_handler 在 executor 线程注册 sync page.on,
    #  回调通过 run_coroutine_threadsafe 传递到 main loop 执行)
    async def on_navigation(url: str, title: str | None) -> None:
        try:
            # title 在 sync 线程取可能为空,这里补取
            if not title:
                title = await session.get_title()
            await ws.send_json({"type": "navigation", "url": url, "title": title})
        except Exception:
            pass

    await session.set_navigation_handler(on_navigation)

    # 画面帧回调
    async def on_frame(data_b64: str, metadata: dict[str, Any]) -> None:
        try:
            await ws.send_json({
                "type": "frame",
                "data": data_b64,
                "metadata": {
                    "timestamp": metadata.get("timestamp", 0),
                    "device_width": metadata.get("deviceWidth", 1280),
                    "device_height": metadata.get("deviceHeight", 720),
                },
            })
        except Exception as e:
            logger.debug(f"[browser_hub] 发送 frame 异常: {e}")

    # 启动推流
    await session.start_screencast(on_frame)

    # 接收客户端事件
    try:
        while True:
            try:
                msg = await ws.receive_json()
            except (json.JSONDecodeError, WebSocketDisconnect):
                break

            msg_type = msg.get("type")
            # 逐条消息复核作用域(gap#3):握手时判过一次不够 —— tab 可能在连接存续期间
            # 被关闭、被风控墙重建(换了 id)或被摘账。复核不过 ⇒ 一条浏览器指令都不发出
            # (副作用为零),只回一帧带具名拒因的 error;`session` 保持原绑定,finally
            # 的停流仍能收到那个已建成的会话上。
            try:
                session = hub.require_tab(_tab_scope(session_id, ws_user_id))
            except BrowserTabScopeError as exc:
                await ws.send_json({"type": "error", "code": exc.code, "event": msg_type})
                continue
            try:
                if msg_type == "mouse":
                    await session.dispatch_mouse(
                        x=float(msg.get("x", 0)),
                        y=float(msg.get("y", 0)),
                        button=msg.get("button", "left"),
                        event_type=msg.get("event_type", "mousePressed"),
                        click_count=int(msg.get("click_count", 1)),
                        modifiers=int(msg.get("modifiers", 0)),
                    )
                elif msg_type == "wheel":
                    await session.dispatch_mouse_wheel(
                        x=float(msg.get("x", 0)),
                        y=float(msg.get("y", 0)),
                        delta_x=float(msg.get("delta_x", 0)),
                        delta_y=float(msg.get("delta_y", 0)),
                    )
                elif msg_type == "key":
                    await session.dispatch_key(
                        key=msg.get("key", ""),
                        event_type=msg.get("event_type", "keyDown"),
                        modifiers=int(msg.get("modifiers", 0)),
                        text=msg.get("text"),
                    )
                elif msg_type == "type":
                    await session.type_text(msg.get("text", ""))
                elif msg_type == "navigate":
                    result = await session.navigate(msg.get("url", ""))
                    await ws.send_json({"type": "navigated", "data": result})
                elif msg_type == "back":
                    ok = await session.go_back()
                    await ws.send_json({"type": "back_result", "success": ok})
                elif msg_type == "forward":
                    ok = await session.go_forward()
                    await ws.send_json({"type": "forward_result", "success": ok})
                elif msg_type == "reload":
                    await session.reload()
                    await ws.send_json({"type": "reload_result", "success": True})
                elif msg_type == "execute":
                    # 2026-08-17:执行 JS 并返回结果(用于获取元素坐标/验证状态)
                    script = msg.get("script", "")
                    result = await session.execute_js(script)
                    await ws.send_json({"type": "execute_result", "data": result})
                elif msg_type == "set_viewport":
                    # 2026-08-17:动态调整视口 = 前端容器尺寸(1:1 无缩放,消除 letterbox)
                    result = await session.set_viewport_size(
                        int(msg.get("width", 1024)),
                        int(msg.get("height", 720)),
                    )
                    await ws.send_json({"type": "viewport_result", "data": result})
                elif msg_type == "ping":
                    await ws.send_json({"type": "pong"})
            except Exception as e:
                logger.warning(f"[browser_hub] 处理事件异常: {msg_type} - {e}")
                await ws.send_json({"type": "error", "message": str(e)[:200], "event": msg_type})

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.exception(f"[browser_hub] WebSocket 异常: {e}")
    finally:
        await session.remove_frame_handler(on_frame)
        logger.info(f"[browser_hub] WebSocket 断开: session={session_id}")



# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
