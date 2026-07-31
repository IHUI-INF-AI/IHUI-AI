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

import asyncio
import base64
import json
import logging
from typing import Any

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import Response
from pydantic import BaseModel, Field

from ..services.browser_hub import hub

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/browser", tags=["browser-hub"])


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
    wait_until: str = Field("domcontentloaded", description="等待事件")


class SessionInfo(BaseModel):
    session_id: str
    url: str
    title: str
    cookie_count: int


# =============================================================================
# 会话管理
# =============================================================================
@router.post("/sessions")
async def create_session(body: CreateSessionRequest) -> dict[str, Any]:
    """创建新的浏览器会话。"""
    session = await hub.create_session(
        url=body.url,
        viewport={"width": body.viewport_width, "height": body.viewport_height},
        user_agent=body.user_agent,
    )
    url = await session.get_current_url()
    title = await session.get_title()
    cookies = await session.get_cookies()
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
async def list_sessions() -> dict[str, Any]:
    """列出所有会话。"""
    return {
        "code": 0,
        "data": {
            "session_ids": hub.list_sessions(),
            "count": hub.session_count,
        },
    }


@router.get("/sessions/{session_id}")
async def get_session_info(session_id: str) -> dict[str, Any]:
    """获取会话信息。"""
    session = hub.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"会话不存在: {session_id}")
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
async def close_session(session_id: str) -> dict[str, Any]:
    """关闭会话。"""
    ok = await hub.close_session(session_id)
    if not ok:
        raise HTTPException(status_code=404, detail=f"会话不存在: {session_id}")
    return {"code": 0, "message": "会话已关闭", "data": {"session_id": session_id}}


# =============================================================================
# 浏览器操作
# =============================================================================
@router.post("/sessions/{session_id}/navigate")
async def navigate(session_id: str, body: NavigateRequest) -> dict[str, Any]:
    """导航到指定 URL。"""
    session = hub.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"会话不存在: {session_id}")
    result = await session.navigate(body.url, wait_until=body.wait_until)
    return {"code": 0, "data": result}


@router.get("/sessions/{session_id}/cookies")
async def get_cookies(session_id: str, urls: str | None = None) -> dict[str, Any]:
    """获取 cookies。

    可选 query 参数 ?urls=https://a.com,https://b.com 过滤特定域名的 cookies。
    """
    session = hub.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"会话不存在: {session_id}")
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
async def screenshot(session_id: str, full_page: bool = False) -> Response:
    """一次性截图(返回 PNG)。"""
    session = hub.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"会话不存在: {session_id}")
    png_bytes = await session.screenshot(full_page=full_page)
    return Response(
        content=png_bytes,
        media_type="image/png",
        headers={"Cache-Control": "no-store, no-cache, must-revalidate"},
    )


@router.post("/sessions/{session_id}/back")
async def go_back(session_id: str) -> dict[str, Any]:
    session = hub.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"会话不存在: {session_id}")
    ok = await session.go_back()
    return {"code": 0, "data": {"success": ok, "url": await session.get_current_url()}}


@router.post("/sessions/{session_id}/forward")
async def go_forward(session_id: str) -> dict[str, Any]:
    session = hub.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"会话不存在: {session_id}")
    ok = await session.go_forward()
    return {"code": 0, "data": {"success": ok, "url": await session.get_current_url()}}


@router.post("/sessions/{session_id}/reload")
async def reload(session_id: str) -> dict[str, Any]:
    session = hub.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"会话不存在: {session_id}")
    await session.reload()
    return {"code": 0, "data": {"url": await session.get_current_url()}}


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
    """
    session = hub.get_session(session_id)
    if not session:
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
    async def on_frame(data_b64: str, metadata: dict) -> None:
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



