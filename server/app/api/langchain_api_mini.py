#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LLM Mini 简化版接口
- 迁移自 H:\ljd-交接文件\coze_zhs_py\api\langchain_api_mini.py（核心功能）
- 独立实现，不依赖 langchain 库
- 支持：url 模式（Ark / DashScope / OpenAI 兼容）、curl 模式
- 统一返回/推送：思考过程（thinking）+ 答案（content）
- 提供：HTTP /chat、WebSocket /ws
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import re
import shlex
import time
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from loguru import logger
from pydantic import BaseModel, Field
from sqlalchemy import text

from app.config import settings
from app.database import get_session
from app.services.token_utils_service import check_user_token_sufficient
from app.utils.file_transfer import upload_file_to_server

router = APIRouter(prefix="/ihui-ai-api/llm", tags=["LLM-Mini"])

TEMPERATURE = 0.7
MAX_TOKENS = 2000
LLM_TIMEOUT = 60
STREAM_DELAY = 0.02

SQL_GET_LLM_CONFIG = """
SELECT id, code, type, name, model_code, img, url, access_key,
       task_generation, task_query, quest_type, variables, manufacturer
FROM zhs_ai_model_info_unify
WHERE code = :model_id AND (is_del = 0 OR is_del IS NULL)
  AND (
    (url IS NOT NULL AND url != '')
    OR (task_generation IS NOT NULL AND task_generation != '')
  )
LIMIT 1
"""


# ----------------- Request/Response 模型 -----------------
class ClientRequest(BaseModel):
    prompt: str = Field(..., description="用户提示词")
    model_id: str = Field(..., description="模型 code")
    user_uuid: str = Field("", description="用户 UUID")
    chat_id: str = Field("", description="聊天 ID")
    files: Optional[List[Dict[str, Any]]] = None
    zidingyican: Optional[List[Dict[str, Any]]] = None


# ----------------- 辅助函数 -----------------
def _get_config(model_id: str) -> Optional[Dict[str, Any]]:
    if not model_id or not str(model_id).strip():
        return None
    model_id = str(model_id).strip()
    with get_session() as db:
        row = db.execute(text(SQL_GET_LLM_CONFIG), {"model_id": model_id}).fetchone()
        if not row:
            return None
        (id_, code, type_, name, model_code, img, url, access_key,
         task_generation, task_query, quest_type, variables_str, manufacturer) = row
        cfg: Dict[str, Any] = {
            "id": id_, "code": code, "name": name,
            "model_code": model_code or code,
            "url": (url or "").strip() if url else "",
            "access_key": (access_key or "").strip(),
            "quest_type": (quest_type or "").strip().lower(),
            "manufacturer": (manufacturer or "").strip().lower() if manufacturer else "",
        }
        try:
            cfg["variables"] = json.loads(variables_str) if variables_str else []
        except json.JSONDecodeError:
            cfg["variables"] = []
        cfg["task_generation_curl"] = task_generation.strip() if task_generation else None
        cfg["task_query_curl"] = task_query.strip() if task_query else None
        return cfg


def _merge_variables(schema: List[Dict], zidingyican: Optional[List[Dict]]) -> Dict[str, Any]:
    merged = {}
    for v in (schema or []):
        if isinstance(v, dict) and v.get("name") is not None:
            merged[v["name"]] = v.get("value")
    for z in (zidingyican or []):
        if isinstance(z, dict) and z.get("name") is not None:
            merged[z["name"]] = z.get("value")
    return merged


def _build_extra_body(schema: List[Dict], merged: Dict[str, Any]) -> Dict[str, Any]:
    extra: Dict[str, Any] = {}
    for it in (schema or []):
        if not isinstance(it, dict):
            continue
        if it.get("name") == "thinking.type":
            v = merged.get("thinking.type") or "enabled"
            if isinstance(v, (list, dict)):
                v = "enabled"
            v = str(v).strip().lower()
            if v not in ("enabled", "disabled"):
                v = "enabled"
            extra["thinking"] = {"type": v}
            break
    for it in (schema or []):
        if not isinstance(it, dict):
            continue
        if it.get("name") == "enable_thinking":
            v = merged.get("enable_thinking")
            if v is None or v == "":
                v = True
            if isinstance(v, str):
                extra["enable_thinking"] = v.strip().lower() in ("enabled", "true", "1")
            else:
                extra["enable_thinking"] = bool(v)
            break
    return extra


def _parse_zidingyican(zidingyican: Optional[List[Dict]]) -> Dict[str, Any]:
    out = {"temperature": None, "max_tokens": None}
    if not zidingyican:
        return out
    d = {x["name"]: x.get("value") for x in zidingyican if isinstance(x, dict) and x.get("name")}
    try:
        if d.get("temperature") is not None:
            out["temperature"] = float(d["temperature"])
    except (ValueError, TypeError):
        pass
    try:
        if d.get("max_tokens") is not None:
            out["max_tokens"] = int(d["max_tokens"])
    except (ValueError, TypeError):
        pass
    return out


def get_effective_config(model_id: str, zidingyican: Optional[List[Dict]] = None) -> Optional[Dict[str, Any]]:
    cfg = _get_config(model_id)
    if not cfg or (not cfg.get("url") and not (cfg.get("task_generation_curl") or cfg.get("task_query_curl"))):
        return None
    merged = _merge_variables(cfg.get("variables", []), zidingyican)
    cfg["merged_variables"] = merged
    cfg["extra_body"] = _build_extra_body(cfg.get("variables", []), merged)
    cfg["api_key"] = cfg.get("access_key", "")
    if cfg.get("url"):
        cfg["api_base"] = (cfg.get("url") or "").strip().rstrip("/")
    cfg["model_name"] = cfg.get("model_code", model_id)
    cfg["model_kwargs"] = {"extra_body": cfg["extra_body"]} if cfg.get("extra_body") else {}
    params = _parse_zidingyican(zidingyican)
    if params["temperature"] is not None:
        cfg["temperature"] = params["temperature"]
    if params["max_tokens"] is not None:
        cfg["max_tokens"] = params["max_tokens"]
    cfg.setdefault("temperature", TEMPERATURE)
    cfg.setdefault("max_tokens", MAX_TOKENS)
    cfg["timeout"] = LLM_TIMEOUT
    return cfg


def build_messages_for_model(cfg: Dict[str, Any], prompt: str, files: Optional[List[Dict]] = None) -> List[Dict[str, Any]]:
    """根据模型类型构造 messages（支持 qwen-vl 多模态）"""
    model_name = (cfg.get("model_name") or cfg.get("model_code") or "").lower()
    is_qwen_vl = "qwen3-vl" in model_name or "qwen-vl" in model_name
    if files and is_qwen_vl:
        contents: List[Dict[str, Any]] = []
        for f in files:
            if f.get("imgUrl") or f.get("image_url"):
                contents.append({"type": "image_url", "image_url": {"url": f.get("imgUrl") or f.get("image_url")}})
            if f.get("video_url"):
                contents.append({"type": "video_url", "video_url": {"url": f.get("video_url")}})
        contents.append({"type": "text", "text": prompt})
        return [{"role": "user", "content": contents}]
    content = prompt
    if files:
        parts = []
        for f in files:
            if f.get("video_url"):
                parts.append(f"[视频: {f.get('video_url', '')}]")
            elif f.get("imgUrl"):
                parts.append(f"[图片: {f.get('imgUrl', '')}]")
        if parts:
            content = " ".join(parts) + "\n" + prompt
    return [{"role": "user", "content": content}]


def split_think_and_answer(full: str) -> tuple[str, str]:
    """按 <think>...</think> 拆分（thinking, answer）"""
    if not full:
        return "", full or ""
    thinking_parts, answer_parts = [], []
    i = 0
    while i < len(full):
        start = full.find("<think>", i)
        if start == -1:
            answer_parts.append(full[i:])
            break
        answer_parts.append(full[i:start])
        i = start + 8
        end = full.find("</think>", i)
        if end == -1:
            thinking_parts.append(full[i:].strip())
            break
        thinking_parts.append(full[i:end].strip())
        i = end + 9
    return ("\n\n".join(p for p in thinking_parts if p), "".join(answer_parts).strip())


def split_think_streaming(text: str, in_think: bool) -> tuple[List[tuple[str, str]], bool]:
    pieces = []
    s = text or ""
    while s:
        if in_think:
            end = s.find("</think>")
            if end == -1:
                pieces.append(("thinking", s))
                s = ""
            else:
                if end > 0:
                    pieces.append(("thinking", s[:end]))
                s = s[end + 9:]
                in_think = False
        else:
            start = s.find("<think>")
            if start == -1:
                pieces.append(("answer", s))
                s = ""
            else:
                if start > 0:
                    pieces.append(("answer", s[:start]))
                s = s[start + 8:]
                in_think = True
    return pieces, in_think


# ----------------- Ark / DashScope / OpenAI 适配 -----------------
def _is_ark(cfg: Dict[str, Any]) -> bool:
    base = (cfg.get("api_base") or cfg.get("url") or "").strip()
    return "volces.com" in base and "api/v3" in base


def _is_dashscope(cfg: Dict[str, Any]) -> bool:
    base = (cfg.get("api_base") or cfg.get("url") or "").strip()
    return "api/v2" in base or "protocols/compatible-mode" in base


def _dashscope_url(cfg: Dict[str, Any]) -> str:
    base = (cfg.get("api_base") or cfg.get("url") or "").strip().rstrip("/")
    if "/responses" in base or "/chat/completions" in base:
        return base
    return f"{base}/responses" if _is_dashscope(cfg) else f"{base}/chat/completions"


async def _ark_request(cfg: Dict[str, Any], messages: List[Dict], stream: bool):
    base = (cfg.get("api_base") or "").strip().rstrip("/")
    url = base if "/responses" in base else f"{base}/responses"
    body = {
        "model": cfg.get("model_name", "gpt-3.5-turbo"),
        "input": messages,
        "stream": stream,
        **((cfg.get("model_kwargs") or {}).get("extra_body") or {}),
    }
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {cfg.get('api_key', '')}"}
    if stream:
        headers["X-DashScope-SSE"] = "enable"
    async with httpx.AsyncClient(timeout=cfg.get("timeout", LLM_TIMEOUT)) as client:
        if stream:
            async with client.stream("POST", url, headers=headers, json=body) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    line = line.strip()
                    if not line or not line.startswith("data:"):
                        continue
                    raw = line[5:].strip()
                    if not raw or raw == "[DONE]":
                        continue
                    try:
                        obj = json.loads(raw)
                        t = obj.get("type") or ""
                        d = obj.get("delta")
                        if t == "response.reasoning_summary_text.delta" and d:
                            yield {"kind": "thinking", "content": d}
                        elif t == "response.output_text.delta" and d:
                            yield {"kind": "answer", "content": d}
                    except (json.JSONDecodeError, KeyError, TypeError):
                        pass
        else:
            r = await client.post(url, headers=headers, json=body)
            r.raise_for_status()
            data = r.json()
            out = data.get("output")
            text_val = ""
            if isinstance(out, list):
                for item in out:
                    if item.get("type") == "message":
                        for c in item.get("content") or []:
                            if c.get("type") == "output_text" and c.get("text"):
                                text_val = c.get("text", "") or ""
                                break
            yield text_val


async def _dashscope_request(cfg: Dict[str, Any], messages: List[Dict], stream: bool):
    url = _dashscope_url(cfg)
    body = {"model": cfg.get("model_name"), "input": messages, "stream": stream}
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {cfg.get('api_key', '')}"}
    if stream:
        headers["X-DashScope-SSE"] = "enable"
    async with httpx.AsyncClient(timeout=cfg.get("timeout", LLM_TIMEOUT)) as client:
        if stream:
            async with client.stream("POST", url, headers=headers, json=body) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    line = line.strip()
                    if not line:
                        continue
                    raw = line[5:].strip() if line.startswith("data:") else line
                    if not raw or raw == "[DONE]":
                        continue
                    try:
                        obj = json.loads(raw)
                        t = obj.get("type") or ""
                        if "reasoning" in t:
                            d = obj.get("delta")
                            if d is None and isinstance(obj.get("summary"), list) and obj.get("summary"):
                                d = obj["summary"][0].get("text")
                            if d is None:
                                d = obj.get("text", "")
                            if d:
                                yield {"kind": "thinking", "content": d if isinstance(d, str) else str(d)}
                        elif t == "response.output_text.delta":
                            d = obj.get("delta")
                            if d:
                                yield {"kind": "answer", "content": d}
                    except (json.JSONDecodeError, KeyError, TypeError):
                        pass
        else:
            r = await client.post(url, headers=headers, json=body)
            r.raise_for_status()
            data = r.json()
            output = data.get("output")
            thinking_parts, answer_text = [], ""
            if isinstance(output, list):
                for item in output:
                    if item.get("type") == "reasoning":
                        for s in item.get("summary") or []:
                            if isinstance(s, dict) and s.get("text"):
                                thinking_parts.append(s.get("text", "") or "")
                    elif item.get("type") == "message":
                        for c in item.get("content") or []:
                            if c.get("type") == "output_text" and c.get("text"):
                                answer_text = c.get("text", "") or ""
                                break
                yield ("\n\n".join(thinking_parts), answer_text)
                return
            choices = data.get("choices") or []
            if choices:
                msg = (choices[0] or {}).get("message") or {}
                if msg.get("content"):
                    yield ("", msg["content"] or "")
                    return
            yield ("", "")


async def _openai_request(cfg: Dict[str, Any], messages: List[Dict], stream: bool):
    base = (cfg.get("api_base") or "").strip().rstrip("/")
    url = base if "/chat/completions" in base else f"{base}/chat/completions"
    body = {
        "model": cfg.get("model_name"),
        "messages": messages,
        "stream": stream,
        "temperature": cfg.get("temperature", TEMPERATURE),
        "max_tokens": cfg.get("max_tokens", MAX_TOKENS),
    }
    extra = (cfg.get("model_kwargs") or {}).get("extra_body") or {}
    if extra:
        body.update(extra)
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {cfg.get('api_key', '')}"}
    if stream and "dashscope.aliyuncs.com" in base:
        headers["X-DashScope-SSE"] = "enable"
    async with httpx.AsyncClient(timeout=cfg.get("timeout", LLM_TIMEOUT)) as client:
        if stream:
            async with client.stream("POST", url, headers=headers, json=body) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    raw_line = (line or "").strip()
                    if not raw_line:
                        continue
                    raw = raw_line[5:].strip() if raw_line.startswith("data:") else raw_line
                    if raw == "[DONE]":
                        break
                    try:
                        obj = json.loads(raw)
                        for c in obj.get("choices", []):
                            delta = (c or {}).get("delta") or {}
                            r = delta.get("reasoning_content")
                            cnt = delta.get("content")
                            if r:
                                yield {"kind": "thinking", "content": r}
                            if cnt:
                                yield {"kind": "answer", "content": cnt}
                    except json.JSONDecodeError:
                        pass
        else:
            r = await client.post(url, headers=headers, json=body)
            r.raise_for_status()
            data = r.json()
            choices = data.get("choices") or []
            if choices:
                msg = (choices[0] or {}).get("message") or {}
                yield msg.get("content", "") or ""
            else:
                yield ""


async def invoke_llm(cfg: Dict[str, Any], messages: List[Dict[str, str]], stream: bool = True, prompt: Optional[str] = None, files: Optional[List[Dict]] = None):
    """根据 cfg 选择 Ark / DashScope / OpenAI 兼容"""
    if _is_ark(cfg):
        async for x in _ark_request(cfg, messages, stream):
            yield x
        return
    if _is_dashscope(cfg):
        async for x in _dashscope_request(cfg, messages, stream):
            yield x
        return
    async for x in _openai_request(cfg, messages, stream):
        yield x


async def _upload_base64_images_to_urls(content: str) -> str:
    """将 content 中的 base64 图片上传到附件服务器并替换为 URL"""
    if not content or "data:image" not in content:
        return content or ""
    pattern = re.compile(r"!\[[^\]]*\]\((data:image/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)\)")
    matches = list(pattern.finditer(content))
    if not matches:
        return content
    upload_tasks = []
    for m in matches:
        mime, b64_data = m.groups()
        try:
            blob = base64.b64decode(b64_data)
            ext = (mime.split("/")[-1] or "png").lower()
            if ext not in ("jpeg", "jpg", "png", "gif", "webp"):
                ext = "png"
            filename = f"llm_image_{uuid.uuid4().hex}.{ext}"
            upload_tasks.append(upload_file_to_server(blob, filename))
        except Exception as e:
            logger.warning("[Mini] base64 图片解码失败: %s", e)
            upload_tasks.append(asyncio.sleep(0))
    urls = await asyncio.gather(*upload_tasks, return_exceptions=True)
    new_content = content
    for i, m in enumerate(matches):
        if urls[i] and not isinstance(urls[i], Exception):
            new_content = new_content.replace(m.group(0), urls[i])
    return new_content


def check_quest_type(cfg: Dict[str, Any], is_http: bool) -> None:
    qt = (cfg.get("quest_type") or "").strip().lower()
    if not qt:
        return
    if qt in ("socket", "ws", "websocket") and is_http:
        raise HTTPException(status_code=400, detail="此模型仅支持 WebSocket 接口")
    if qt == "http" and not is_http:
        raise HTTPException(status_code=400, detail="此模型仅支持 HTTP 接口")


# ----------------- HTTP 入口 -----------------
@router.post("/chat", summary="LLM HTTP 非流式（仅 url 模式）")
async def http_chat(request: ClientRequest):
    if request.user_uuid:
        token_check = await check_user_token_sufficient(request.user_uuid, min_token=1000)
        if not token_check.get("sufficient"):
            raise HTTPException(status_code=402, detail=token_check.get("reason", "Token 余额不足"))
    cfg = get_effective_config(request.model_id, request.zidingyican)
    if not cfg:
        raise HTTPException(status_code=404, detail="当前不存在")
    check_quest_type(cfg, is_http=True)
    messages = build_messages_for_model(cfg, request.prompt, request.files)

    full, thinking, content = "", "", ""
    async for chunk in invoke_llm(cfg, messages, stream=True, prompt=request.prompt, files=request.files):
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
    content = await _upload_base64_images_to_urls(content or "")
    return {
        "code": 0,
        "data": {"content": content or full, "thinking": thinking or "", "model": cfg.get("model_name")},
    }


# ----------------- WebSocket 流式 -----------------
async def ws_send(ws: WebSocket, *, code: int = 200, msg: str = "success", event: str, bot_id: str = "", role: str = "assistant", msg_type: str = "answer", content: str = "", chat_id: str = "", conversation_id: str = "", detail: Any = None) -> None:
    payload = {
        "code": code, "msg": msg,
        "data": {
            "id": f"msg_{uuid.uuid4().hex[:8]}",
            "conversation_id": conversation_id or chat_id,
            "bot_id": bot_id, "role": role, "type": msg_type,
            "content": content, "content_type": "text",
            "chat_id": chat_id, "section_id": "",
            "created_at": datetime.now().isoformat(),
        },
        "detail": detail, "event": event,
    }
    await ws.send_text(json.dumps(payload, ensure_ascii=False))


@router.websocket("/ws")
async def ws_chat(websocket: WebSocket):
    await websocket.accept()
    err_ev = getattr(settings, "COMMON_STREAM_EVENT_ERROR", "system.error")
    ev_think = getattr(settings, "DOUBAO_STREAM_EVENT_THINKING", "conversation.message.delta")
    ev_done = getattr(settings, "DOUBAO_STREAM_EVENT_COMPLETED", "conversation.chat.completed")
    try:
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=300)
            except asyncio.TimeoutError:
                break
            except WebSocketDisconnect:
                break
            try:
                message = json.loads(data)
            except json.JSONDecodeError:
                await ws_send(websocket, code=400, event=err_ev, msg_type="error", content="JSON 格式错误")
                continue

            prompt = message.get("prompt") or message.get("content", "")
            model_id = message.get("model_id") or message.get("model", "")
            user_uuid = message.get("user_uuid", "")
            chat_id = message.get("chat_id", "")
            files = message.get("files", [])
            zidingyican = message.get("zidingyican", [])

            if not prompt or not model_id:
                await ws_send(websocket, code=400, event=err_ev, msg_type="error", content="缺少 prompt 或 model_id", chat_id=chat_id)
                continue
            if user_uuid:
                tc = await check_user_token_sufficient(user_uuid, min_token=1000)
                if not tc.get("sufficient"):
                    await ws_send(websocket, code=400, event=err_ev, msg_type="error", content=tc.get("reason", "Token 余额不足"), chat_id=chat_id)
                    continue

            cfg = get_effective_config(model_id, zidingyican if zidingyican else None)
            if not cfg:
                await ws_send(websocket, code=404, event=err_ev, msg_type="error", content="当前不存在", chat_id=chat_id)
                continue
            try:
                check_quest_type(cfg, is_http=False)
            except HTTPException as e:
                await ws_send(websocket, code=400, event=err_ev, msg_type="error", content=str(e.detail), chat_id=chat_id)
                continue

            messages = build_messages_for_model(cfg, prompt, files if files else None)
            await ws_send(websocket, event="conversation.chat.created", bot_id=model_id, role="system", msg_type="conversation_created", content="会话创建成功", chat_id=chat_id)

            thinking_buf, answer_buf = "", ""
            in_think = False
            try:
                async for chunk in invoke_llm(cfg, messages, stream=True, prompt=prompt, files=files if files else None):
                    if chunk is None:
                        continue
                    if isinstance(chunk, dict):
                        kind = chunk.get("kind", "answer")
                        piece = (chunk.get("content") or "").strip()
                        if not piece:
                            continue
                        if kind == "thinking":
                            thinking_buf += piece
                            await ws_send(websocket, event=ev_think, bot_id=model_id, msg_type="thinking", content=piece, chat_id=chat_id)
                        else:
                            answer_buf += piece
                            await ws_send(websocket, event=ev_done, bot_id=model_id, msg_type="answer", content=piece, chat_id=chat_id)
                        await asyncio.sleep(STREAM_DELAY)
                        continue
                    pieces, in_think = split_think_streaming(str(chunk), in_think)
                    for k, piece in pieces:
                        if not piece:
                            continue
                        if k == "thinking":
                            thinking_buf += piece
                            await ws_send(websocket, event=ev_think, bot_id=model_id, msg_type="thinking", content=piece, chat_id=chat_id)
                        else:
                            answer_buf += piece
                            await ws_send(websocket, event=ev_done, bot_id=model_id, msg_type="answer", content=piece, chat_id=chat_id)
                        await asyncio.sleep(STREAM_DELAY)
                if thinking_buf.strip():
                    await ws_send(websocket, event=ev_think, bot_id=model_id, msg_type="thinking_summary", content=thinking_buf.strip(), chat_id=chat_id)
                await ws_send(websocket, event=ev_done, bot_id=model_id, msg_type="answer", content=answer_buf, chat_id=chat_id, detail={"user_uuid": user_uuid})
            except Exception as e:
                logger.error("LLM-Mini WS 错误: %s", e)
                await ws_send(websocket, code=500, event=err_ev, msg_type="error", content=str(e), chat_id=chat_id)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error("LLM-Mini WS 会话错误: %s", e)
    finally:
        try:
            await websocket.close()
        except Exception as e:
            logger.debug("关闭 WebSocket 失败: %s", e)


# ----------------- 统一模型信息查询 -----------------
@router.get("/models-unify", summary="查询统一大模型信息列表")
def list_unify_models():
    with get_session() as db:
        rows = db.execute(text("""
            SELECT id, code, type, name, model_code, img,
                   quest_type, variables, manufacturer,
                   open_desc, model_desc, grass_roots, is_gratis, is_new, is_top,
                   sort
            FROM zhs_ai_model_info_unify
            WHERE (is_del = 0 OR is_del IS NULL)
            ORDER BY sort ASC
        """)).mappings().all()
        return {"code": 0, "data": [dict(r) for r in rows]}
