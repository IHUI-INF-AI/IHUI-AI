#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LLM 完整接口（LangChain 风格）
- 迁移自 H:\ljd-交接文件\coze_zhs_py\api\langchain_api.py（核心功能）
- 兼容 langchain_api_mini 的所有能力
- 增强：连接管理（WebSocket）、Coze 风格事件推送、多 session

可选依赖：langchain / langchain-community / langchain-openai（未安装时自动降级到 httpx）
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from collections import deque
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from loguru import logger
from pydantic import BaseModel, Field
from sqlalchemy import text

from app.config import settings
from app.database import get_session
from app.services.token_utils_service import check_user_token_sufficient

# Mini 版暴露的工具方法
from app.api.langchain_api_mini import (
    get_effective_config,
    build_messages_for_model,
    split_think_and_answer,
    split_think_streaming,
    check_quest_type,
    invoke_llm,
    TEMPERATURE,
    MAX_TOKENS,
    LLM_TIMEOUT,
    STREAM_DELAY,
)

# 可选：尝试引入 langchain（未安装时降级）
try:
    from langchain_openai import ChatOpenAI  # type: ignore
    LANGCHAIN_AVAILABLE = True
except Exception:
    LANGCHAIN_AVAILABLE = False
    logger.info("[langchain_api] langchain_openai 未安装，将使用 httpx 降级实现")

router = APIRouter(prefix="/ihui-ai-api/llm-full", tags=["LLM-Full"])
logger = logging.getLogger("langchain-api")


# ----------------- 连接管理（WebSocket 多 session） -----------------
class ConnectionManager:
    def __init__(self) -> None:
        self.active: Dict[str, WebSocket] = {}
        self.info: Dict[str, Dict[str, Any]] = {}
        self.queue: deque = deque()
        self.max_active = 1000
        self.max_queue = 500
        self.total = 0
        self.peak = 0

    async def add(self, client_id: str, ws: WebSocket) -> bool:
        if len(self.active) >= self.max_active:
            self.queue.append((client_id, ws))
            await ws.send_text(json.dumps({
                "code": 200, "event": "queued",
                "data": {"position": len(self.queue), "message": "已加入排队"},
            }, ensure_ascii=False))
            return True
        self.active[client_id] = ws
        self.info[client_id] = {
            "connected_at": time.time(),
            "last_activity": time.time(),
            "message_count": 0,
        }
        self.total += 1
        self.peak = max(self.peak, len(self.active))
        return True

    async def remove(self, client_id: str) -> None:
        self.active.pop(client_id, None)
        self.info.pop(client_id, None)
        # 排队晋升
        if self.queue and len(self.active) < self.max_active:
            next_id, next_ws = self.queue.popleft()
            await self.add(next_id, next_ws)

    def touch(self, client_id: str) -> None:
        if client_id in self.info:
            self.info[client_id]["last_activity"] = time.time()
            self.info[client_id]["message_count"] = self.info[client_id].get("message_count", 0) + 1


manager = ConnectionManager()


# ----------------- Request 模型 -----------------
class ChatRequest(BaseModel):
    prompt: str = Field(..., description="用户提示词")
    model_id: str = Field(..., description="模型 code")
    user_uuid: str = Field("", description="用户 UUID")
    chat_id: str = Field("", description="聊天 ID")
    session_id: str = Field("", description="会话 ID")
    files: Optional[List[Dict[str, Any]]] = None
    zidingyican: Optional[List[Dict[str, Any]]] = None
    system_prompt: Optional[str] = Field("", description="自定义 system prompt")


# ----------------- Coze 风格事件推送 -----------------
async def push_event(ws: Optional[WebSocket], *, event: str, msg_type: str = "", content: str = "", bot_id: str = "", chat_id: str = "", conversation_id: str = "", detail: Any = None, code: int = 200, msg: str = "success") -> None:
    if not ws:
        return
    payload = {
        "code": code, "msg": msg,
        "data": {
            "id": f"msg_{uuid.uuid4().hex[:8]}",
            "conversation_id": conversation_id or chat_id,
            "bot_id": bot_id, "role": "assistant",
            "type": msg_type or event, "content": content,
            "content_type": "text", "chat_id": chat_id, "section_id": "",
            "created_at": datetime.now().isoformat(),
        },
        "detail": detail, "event": event,
    }
    try:
        await ws.send_text(json.dumps(payload, ensure_ascii=False))
    except Exception as e:
        logger.warning("[push_event] 推送失败: %s", e)


# ----------------- LangChain 风格调用（langchain 可用时优先） -----------------
async def invoke_via_langchain(cfg: Dict[str, Any], messages: List[Dict[str, str]], stream: bool = False):
    """如果安装了 langchain_openai，则用 ChatOpenAI 调用；否则降级到 invoke_llm"""
    if not LANGCHAIN_AVAILABLE:
        async for x in invoke_llm(cfg, messages, stream):
            yield x
        return
    try:
        llm = ChatOpenAI(
            model=cfg.get("model_name"),
            base_url=cfg.get("api_base"),
            api_key=cfg.get("api_key"),
            temperature=cfg.get("temperature", TEMPERATURE),
            max_tokens=cfg.get("max_tokens", MAX_TOKENS),
            streaming=stream,
            timeout=cfg.get("timeout", LLM_TIMEOUT),
        )
        from langchain_core.messages import HumanMessage, SystemMessage  # type: ignore
        lc_messages = []
        for m in messages:
            role = m.get("role", "user")
            content = m.get("content", "")
            if role == "system":
                lc_messages.append(SystemMessage(content=content))
            else:
                lc_messages.append(HumanMessage(content=content))
        if stream:
            async for chunk in llm.astream(lc_messages):
                content_piece = getattr(chunk, "content", "") or ""
                if content_piece:
                    yield {"kind": "answer", "content": content_piece}
        else:
            res = await llm.ainvoke(lc_messages)
            yield getattr(res, "content", "") or ""
    except Exception as e:
        logger.warning("[langchain_api] LangChain 调用失败，降级到 httpx: %s", e)
        async for x in invoke_llm(cfg, messages, stream):
            yield x


# ----------------- HTTP 接口 -----------------
@router.post("/chat", summary="LLM HTTP 非流式（完整版）")
async def http_chat(request: ChatRequest):
    if request.user_uuid:
        tc = await check_user_token_sufficient(request.user_uuid, min_token=1000)
        if not tc.get("sufficient"):
            raise HTTPException(status_code=402, detail=tc.get("reason", "Token 余额不足"))
    cfg = get_effective_config(request.model_id, request.zidingyican)
    if not cfg:
        raise HTTPException(status_code=404, detail="当前不存在")
    check_quest_type(cfg, is_http=True)
    messages = build_messages_for_model(cfg, request.prompt, request.files)
    if request.system_prompt:
        messages = [{"role": "system", "content": request.system_prompt}] + messages

    full, thinking, content = "", "", ""
    async for chunk in invoke_via_langchain(cfg, messages, stream=True):
        if isinstance(chunk, tuple) and len(chunk) >= 2:
            thinking, content = chunk[0] or "", chunk[1] or ""
            break
        if isinstance(chunk, dict):
            k = chunk.get("kind", "answer")
            piece = (chunk.get("content") or "").strip()
            if k == "thinking":
                thinking += piece
            else:
                content += piece
            continue
        full += (chunk or "") if isinstance(chunk, str) else str(chunk or "")
    if not content and full:
        thinking, content = split_think_and_answer(full)
    return {
        "code": 0,
        "data": {
            "content": content or full, "thinking": thinking or "",
            "model": cfg.get("model_name"),
            "session_id": request.session_id,
        },
    }


@router.post("/chat/stream", summary="LLM HTTP SSE 流式（完整版）")
async def http_chat_stream(request: ChatRequest):
    """SSE 流式接口（通过 EventSourceResponse 或 StreamingResponse）"""
    from fastapi.responses import StreamingResponse
    if request.user_uuid:
        tc = await check_user_token_sufficient(request.user_uuid, min_token=1000)
        if not tc.get("sufficient"):
            raise HTTPException(status_code=402, detail=tc.get("reason", "Token 余额不足"))
    cfg = get_effective_config(request.model_id, request.zidingyican)
    if not cfg:
        raise HTTPException(status_code=404, detail="当前不存在")
    messages = build_messages_for_model(cfg, request.prompt, request.files)
    if request.system_prompt:
        messages = [{"role": "system", "content": request.system_prompt}] + messages

    async def event_stream():
        async for chunk in invoke_via_langchain(cfg, messages, stream=True):
            if isinstance(chunk, dict):
                kind = chunk.get("kind", "answer")
                content = chunk.get("content", "")
                yield f"event: {kind}\ndata: {json.dumps({'content': content}, ensure_ascii=False)}\n\n"
            else:
                yield f"event: answer\ndata: {json.dumps({'content': str(chunk)}, ensure_ascii=False)}\n\n"
        yield "event: done\ndata: {}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ----------------- WebSocket 流式 -----------------
@router.websocket("/ws/{client_id}")
async def ws_chat_full(websocket: WebSocket, client_id: str):
    await websocket.accept()
    if not await manager.add(client_id, websocket):
        await websocket.close(code=1013)
        return
    err_ev = getattr(settings, "COMMON_STREAM_EVENT_ERROR", "system.error")
    ev_think = getattr(settings, "DOUBAO_STREAM_EVENT_THINKING", "conversation.message.delta")
    ev_done = getattr(settings, "DOUBAO_STREAM_EVENT_COMPLETED", "conversation.chat.completed")
    try:
        while True:
            try:
                raw = await asyncio.wait_for(websocket.receive_text(), timeout=300)
            except asyncio.TimeoutError:
                break
            except WebSocketDisconnect:
                break
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await push_event(websocket, event=err_ev, msg_type="error", content="JSON 格式错误")
                continue
            manager.touch(client_id)

            prompt = msg.get("prompt") or msg.get("content", "")
            model_id = msg.get("model_id") or msg.get("model", "")
            user_uuid = msg.get("user_uuid", "")
            chat_id = msg.get("chat_id", "")
            files = msg.get("files", [])
            zidingyican = msg.get("zidingyican", [])
            system_prompt = msg.get("system_prompt", "")

            if not prompt or not model_id:
                await push_event(websocket, event=err_ev, msg_type="error", content="缺少 prompt 或 model_id", chat_id=chat_id)
                continue
            if user_uuid:
                tc = await check_user_token_sufficient(user_uuid, min_token=1000)
                if not tc.get("sufficient"):
                    await push_event(websocket, event=err_ev, msg_type="error", content=tc.get("reason", "Token 余额不足"), chat_id=chat_id)
                    continue

            cfg = get_effective_config(model_id, zidingyican if zidingyican else None)
            if not cfg:
                await push_event(websocket, event=err_ev, msg_type="error", content="当前不存在", chat_id=chat_id)
                continue
            try:
                check_quest_type(cfg, is_http=False)
            except HTTPException as e:
                await push_event(websocket, event=err_ev, msg_type="error", content=str(e.detail), chat_id=chat_id)
                continue

            messages = build_messages_for_model(cfg, prompt, files if files else None)
            if system_prompt:
                messages = [{"role": "system", "content": system_prompt}] + messages

            await push_event(websocket, event="conversation.chat.created", bot_id=model_id, role="system", msg_type="conversation_created", content="会话创建成功", chat_id=chat_id)
            thinking_buf, answer_buf = "", ""
            try:
                async for chunk in invoke_via_langchain(cfg, messages, stream=True):
                    if chunk is None:
                        continue
                    if isinstance(chunk, dict):
                        kind = chunk.get("kind", "answer")
                        piece = (chunk.get("content") or "").strip()
                        if not piece:
                            continue
                        if kind == "thinking":
                            thinking_buf += piece
                            await push_event(websocket, event=ev_think, bot_id=model_id, msg_type="thinking", content=piece, chat_id=chat_id)
                        else:
                            answer_buf += piece
                            await push_event(websocket, event=ev_done, bot_id=model_id, msg_type="answer", content=piece, chat_id=chat_id)
                        await asyncio.sleep(STREAM_DELAY)
                        continue
                    pieces, _ = split_think_streaming(str(chunk), False)
                    for k, piece in pieces:
                        if not piece:
                            continue
                        if k == "thinking":
                            thinking_buf += piece
                            await push_event(websocket, event=ev_think, bot_id=model_id, msg_type="thinking", content=piece, chat_id=chat_id)
                        else:
                            answer_buf += piece
                            await push_event(websocket, event=ev_done, bot_id=model_id, msg_type="answer", content=piece, chat_id=chat_id)
                        await asyncio.sleep(STREAM_DELAY)
                if thinking_buf.strip():
                    await push_event(websocket, event=ev_think, bot_id=model_id, msg_type="thinking_summary", content=thinking_buf.strip(), chat_id=chat_id)
                await push_event(websocket, event=ev_done, bot_id=model_id, msg_type="answer", content=answer_buf, chat_id=chat_id, detail={"user_uuid": user_uuid, "session_id": client_id})
            except Exception as e:
                logger.error("[WS full] 流式错误: %s", e)
                await push_event(websocket, event=err_ev, msg_type="error", content=str(e), chat_id=chat_id)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error("[WS full] 会话错误: %s", e)
    finally:
        await manager.remove(client_id)
        try:
            await websocket.close()
        except Exception:
            pass


# ----------------- 管理端点 -----------------
@router.get("/connections")
async def list_connections():
    return {
        "code": 0, "data": {
            "active": len(manager.active),
            "queue": len(manager.queue),
            "peak": manager.peak,
            "total": manager.total,
            "max_active": manager.max_active,
            "items": [
                {"client_id": cid, **info}
                for cid, info in manager.info.items()
            ],
        },
    }


@router.get("/health")
async def health():
    return {
        "code": 0, "data": {
            "service": "LLM-Full (LangChain-style)",
            "langchain_available": LANGCHAIN_AVAILABLE,
            "timestamp": datetime.now().isoformat(),
            **{
                "active_connections": len(manager.active),
                "queue": len(manager.queue),
                "peak": manager.peak,
            },
        },
    }
