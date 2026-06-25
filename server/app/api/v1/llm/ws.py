"""LLM 统一流式接口.

迁移自 coze_zhs_py/api/langchain_api_mini.py.
核心 WebSocket 流式 LLM 接口,支持 Ark Responses API、DashScope Responses API、OpenAI 兼容接口.
"""

import asyncio
import json
import time
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.concurrency import run_in_threadpool
from loguru import logger
from pydantic import BaseModel
from sqlalchemy import text

from app.config import settings
from app.database import get_session
from app.security import decode_access_token, require_login
from app.services.token_service import check_user_token as check_user_token_sufficient

router = APIRouter(prefix="", tags=["LLM-Mini"])

TEMPERATURE = 0.7
MAX_TOKENS = 2000
LLM_TIMEOUT = 60
# 人为流式延迟 (秒). 默认 0 不延迟, 可通过 settings.LLM_STREAM_DELAY 覆盖.
STREAM_DELAY = float(getattr(settings, "LLM_STREAM_DELAY", 0) or 0)

SQL_GET_LLM_CONFIG = """
SELECT id, code, type, name, model_code, img, url, access_key,
       task_generation, task_query, quest_type, variables, manufacturer,
       is_gratis
FROM zhs_ai_model_info_unify
WHERE code = :model_id AND (is_del = 0 OR is_del IS NULL)
  AND (
    (url IS NOT NULL AND url != '')
    OR (task_generation IS NOT NULL AND task_generation != '')
    OR (LOWER(manufacturer) = 'coze')
  )
LIMIT 1
"""


def _list_unify_models_sync() -> dict:
    """同步查询 zhs_ai_model_info_unify 表."""
    with get_session() as db:
        try:
            rows = db.execute(text("""
                SELECT id, code, type, name, model_code, img,
                       quest_type, variables, manufacturer,
                       open_desc, model_desc, grass_roots, is_gratis, is_new, is_top, is_hot,
                       sort
                FROM zhs_ai_model_info_unify
                WHERE (is_del = 0 OR is_del IS NULL)
                ORDER BY sort ASC
            """)).mappings().all()
            return {"code": 0, "data": [dict(row) for row in rows]}
        except Exception as e:
            logger.error(f"查询统一大模型列表失败: {e}")
            return {"code": 1, "data": [], "message": str(e)}


@router.get("/models-unify", summary="查询统一大模型信息列表")
async def list_unify_models(user_uuid: str = Depends(require_login)):
    """完整查询 zhs_ai_model_info_unify 表(兼容 /ihui-ai-api/llm/models-unify)."""
    return await run_in_threadpool(_list_unify_models_sync)


class ClientRequest(BaseModel):
    """客户端 LLM 请求体."""

    prompt: str
    model_id: str
    user_uuid: str = ""
    chat_id: str = ""
    files: list[dict[str, Any]] | None = None
    zidingyican: list[dict[str, Any]] | None = None


def _get_config(model_id: str) -> dict[str, Any] | None:
    """根据 model_id 查表获取 LLM 配置."""
    if not model_id or not str(model_id).strip():
        return None
    model_id = str(model_id).strip()
    with get_session() as db:
        try:
            row = db.execute(text(SQL_GET_LLM_CONFIG), {"model_id": model_id}).fetchone()
            if not row:
                return None
            (id_, code, type_, name, model_code, img, url, access_key,
             task_generation, task_query, quest_type, variables_str,
             manufacturer, is_gratis) = row
            cfg: dict[str, Any] = {
                "id": id_,
                "code": code,
                "name": name,
                "model_code": model_code or code,
                "url": (url or "").strip() if url else "",
                "access_key": (access_key or "").strip(),
                "quest_type": (quest_type or "").strip().lower(),
                "manufacturer": (manufacturer or "").strip().lower() if manufacturer else "",
                "is_gratis": int(is_gratis) if is_gratis is not None else 1,
            }
            try:
                cfg["variables"] = json.loads(variables_str) if variables_str else []
            except json.JSONDecodeError:
                cfg["variables"] = []
            if not isinstance(cfg["variables"], list):
                cfg["variables"] = []
            cfg["task_generation_curl"] = task_generation.strip() if task_generation else None
            cfg["task_query_curl"] = task_query.strip() if task_query else None
            return cfg
        except Exception as e:
            logger.error(f"查询 LLM 配置失败: {e}")
            return None


def _merge_variables(schema: list[dict], zidingyican: list[dict] | None) -> dict[str, Any]:
    """合并 schema 与 zidingyican 参数."""
    merged = {}
    for v in schema or []:
        if isinstance(v, dict) and v.get("name") is not None:
            merged[v["name"]] = v.get("value")
    for z in zidingyican or []:
        if isinstance(z, dict) and z.get("name") is not None:
            merged[z["name"]] = z.get("value")
    return merged


def _build_extra_body(schema: list[dict], merged: dict[str, Any]) -> dict[str, Any]:
    """构建 extra_body(如 thinking.type、enable_thinking)."""
    extra: dict[str, Any] = {}
    for it in schema or []:
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
    for it in schema or []:
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


def get_effective_config(model_id: str, zidingyican: list[dict] | None = None) -> dict[str, Any] | None:
    """查库并合并 zidingyican,得到最终 LLM 配置."""
    cfg = _get_config(model_id)
    if not cfg:
        return None
    if (
        not cfg.get("url")
        and not (cfg.get("task_generation_curl") or cfg.get("task_query_curl"))
        and (cfg.get("manufacturer") or "").strip().lower() != "coze"
    ):
        return None
    merged = _merge_variables(cfg.get("variables", []), zidingyican)
    cfg["merged_variables"] = merged
    cfg["extra_body"] = _build_extra_body(cfg.get("variables", []), merged)
    cfg["api_key"] = cfg.get("access_key", "")
    if cfg.get("url"):
        cfg["api_base"] = (cfg.get("url") or "").strip().rstrip("/")
    cfg["model_name"] = cfg.get("model_code", model_id)
    cfg["model_kwargs"] = {"extra_body": cfg["extra_body"]} if cfg.get("extra_body") else {}
    cfg["temperature"] = TEMPERATURE
    cfg["max_tokens"] = MAX_TOKENS
    cfg["timeout"] = LLM_TIMEOUT
    return cfg


def build_messages(prompt: str, files: list[dict] | None = None) -> list[dict[str, str]]:
    """构建消息列表."""
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


def _is_ark(cfg: dict[str, Any]) -> bool:
    base = (cfg.get("api_base") or cfg.get("url") or "").strip()
    return "volces.com" in base and "api/v3" in base


def _is_dashscope(cfg: dict[str, Any]) -> bool:
    base = (cfg.get("api_base") or cfg.get("url") or "").strip()
    return "api/v2" in base or "protocols/compatible-mode" in base


def _is_coze_model(cfg: dict[str, Any]) -> bool:
    return (cfg.get("manufacturer") or "").strip().lower() == "coze"


async def _ark_stream(cfg: dict[str, Any], messages: list[dict]):
    """Ark Responses API 流式调用."""
    base = (cfg.get("api_base") or "").strip().rstrip("/")
    url = base if "/responses" in base else f"{base}/responses"
    body = {
        "model": cfg.get("model_name", "gpt-3.5-turbo"),
        "input": messages,
        "stream": True,
        **((cfg.get("model_kwargs") or {}).get("extra_body") or {}),
    }
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {cfg.get('api_key', '')}",
        "X-DashScope-SSE": "enable",
    }
    async with httpx.AsyncClient(timeout=cfg.get("timeout", LLM_TIMEOUT)) as client:
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


async def _dashscope_stream(cfg: dict[str, Any], messages: list[dict]):
    """DashScope Responses API 流式调用."""
    base = (cfg.get("api_base") or "").strip().rstrip("/")
    url = base if "/responses" in base else f"{base}/responses"
    body = {
        "model": cfg.get("model_name", "gpt-3.5-turbo"),
        "input": messages,
        "stream": True,
        **((cfg.get("model_kwargs") or {}).get("extra_body") or {}),
    }
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {cfg.get('api_key', '')}",
        "X-DashScope-SSE": "enable",
    }
    async with httpx.AsyncClient(timeout=cfg.get("timeout", LLM_TIMEOUT)) as client:
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
                    if "reasoning" in t or "reasoning_summary" in t:
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


async def _openai_compatible_stream(cfg: dict[str, Any], messages: list[dict]):
    """OpenAI 兼容 /chat/completions 流式调用."""
    base = (cfg.get("api_base") or "").strip().rstrip("/")
    url = base if "/chat/completions" in base else f"{base}/chat/completions"
    body = {
        "model": cfg.get("model_name", "gpt-3.5-turbo"),
        "messages": messages,
        "stream": True,
        "temperature": cfg.get("temperature", TEMPERATURE),
        "max_tokens": cfg.get("max_tokens", MAX_TOKENS),
    }
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {cfg.get('api_key', '')}",
    }
    async with httpx.AsyncClient(timeout=cfg.get("timeout", LLM_TIMEOUT)) as client:
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
                    choice = (obj.get("choices") or [{}])[0]
                    delta = choice.get("delta") or {}
                    content = delta.get("content")
                    if content:
                        yield {"kind": "answer", "content": content}
                except (json.JSONDecodeError, KeyError, TypeError):
                    pass


async def stream_llm(cfg: dict[str, Any], messages: list[dict]):
    """根据配置选择对应的 LLM 流式接口."""
    if _is_ark(cfg):
        async for chunk in _ark_stream(cfg, messages):
            yield chunk
    elif _is_dashscope(cfg):
        async for chunk in _dashscope_stream(cfg, messages):
            yield chunk
    else:
        async for chunk in _openai_compatible_stream(cfg, messages):
            yield chunk


async def _ws_send(websocket: WebSocket, **kwargs):
    """向 WebSocket 客户端发送消息."""
    payload = {
        "code": kwargs.get("code", 0),
        "msg": kwargs.get("msg", "ok"),
        "event": kwargs.get("event", ""),
        "data": {
            "content": kwargs.get("content", ""),
            "role": kwargs.get("role", "assistant"),
            "msg_type": kwargs.get("msg_type", "answer"),
            "bot_id": kwargs.get("bot_id", ""),
            "chat_id": kwargs.get("chat_id", ""),
            "conversation_id": kwargs.get("conversation_id", ""),
        },
        "timestamp": int(time.time() * 1000),
    }
    try:
        await websocket.send_text(json.dumps(payload, ensure_ascii=False))
    except Exception as e:
        logger.warning(f"WS 发送失败: {e}")


@router.websocket("/ws")
async def ws_chat(websocket: WebSocket, token: str = Query("")):
    """WebSocket 流式 LLM 端点(/ihui-ai-api/llm/ws).

    安全: 通过 query 参数 token 验证 JWT, 验证失败以 4401 关闭, 不接受连接.
    user_uuid 从 JWT sub claim 取, 不再信任客户端消息体.
    """
    # 验证 JWT (accept 前关闭连接, 客户端拿不到握手响应)
    if not token:
        await websocket.close(code=4401)
        return
    payload = decode_access_token(token)
    if not payload:
        await websocket.close(code=4401)
        return
    user_uuid = payload.get("sub")
    if not user_uuid:
        await websocket.close(code=4401)
        return
    await websocket.accept()
    logger.info("LLM-Mini WebSocket 连接已建立")
    err_ev = "system.error"
    ev_think = "conversation.message.delta"
    ev_done = "conversation.chat.completed"
    try:
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=600)
            except TimeoutError:
                break
            except WebSocketDisconnect:
                break
            try:
                message = json.loads(data)
            except json.JSONDecodeError:
                await _ws_send(websocket, code=400, event=err_ev, role="system", msg_type="error", content="JSON 格式错误")
                continue

            prompt = message.get("prompt") or message.get("content", "")
            model_id = message.get("model_id") or message.get("model", "")
            chat_id = message.get("chat_id", "")
            zidingyican = message.get("zidingyican", [])
            files = message.get("files", [])

            if not prompt:
                await _ws_send(websocket, code=400, event=err_ev, role="system", msg_type="error", content="缺少 prompt", chat_id=chat_id, conversation_id=chat_id)
                continue
            if not model_id:
                await _ws_send(websocket, code=400, event=err_ev, role="system", msg_type="error", content="缺少 model 或 model_id")
                continue
            # user_uuid 来自 JWT, 不再从消息体取; 校验 token 余额
            try:
                token_check = check_user_token_sufficient(user_uuid, min_tokens=1000)
                if not token_check.get("sufficient"):
                    await _ws_send(websocket, code=400, event=err_ev, bot_id=model_id, role="system", msg_type="error", content=token_check.get("reason", "Token 余额不足"), chat_id=chat_id, conversation_id=chat_id)
                    continue
            except Exception as e:
                logger.warning(f"Token 校验异常(不阻断): {e}")

            cfg = await run_in_threadpool(get_effective_config, model_id, zidingyican if zidingyican else None)
            if not cfg:
                await _ws_send(websocket, code=404, event=err_ev, bot_id=model_id, role="system", msg_type="error", content="模型配置不存在", chat_id=chat_id, conversation_id=chat_id)
                continue

            messages = build_messages(prompt, files)
            try:
                full_content = ""
                full_thinking = ""
                async for chunk in stream_llm(cfg, messages):
                    if chunk.get("kind") == "thinking":
                        full_thinking += chunk["content"]
                        await _ws_send(websocket, event=ev_think, bot_id=model_id, role="assistant", msg_type="thinking", content=chunk["content"], chat_id=chat_id, conversation_id=chat_id)
                    else:
                        full_content += chunk["content"]
                        await _ws_send(websocket, event=ev_done, bot_id=model_id, role="assistant", msg_type="answer", content=chunk["content"], chat_id=chat_id, conversation_id=chat_id)
                    await asyncio.sleep(STREAM_DELAY)
                await _ws_send(websocket, event="conversation.chat.completed", bot_id=model_id, role="assistant", msg_type="done", content="", chat_id=chat_id, conversation_id=chat_id)
            except httpx.HTTPError as e:
                logger.error(f"LLM HTTP 错误: {e}")
                await _ws_send(websocket, code=502, event=err_ev, bot_id=model_id, role="system", msg_type="error", content=f"LLM 调用失败: {e}", chat_id=chat_id, conversation_id=chat_id)
            except Exception as e:
                logger.error(f"LLM 流式异常: {e}")
                await _ws_send(websocket, code=500, event=err_ev, bot_id=model_id, role="system", msg_type="error", content=str(e), chat_id=chat_id, conversation_id=chat_id)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WebSocket 异常: {e}")
    finally:
        try:
            await websocket.close()
        except Exception as e:
            logger.debug("关闭 WebSocket 失败: %s", e)
        logger.info("LLM-Mini WebSocket 连接已关闭")


@router.post("/chat", summary="HTTP 非流式 LLM 端点")
async def http_chat(req: ClientRequest, user_uuid: str = Depends(require_login)):
    """HTTP 非流式 LLM 端点(/ihui-ai-api/llm/chat)."""
    cfg = await run_in_threadpool(get_effective_config, req.model_id, req.zidingyican)
    if not cfg:
        raise HTTPException(status_code=404, detail="模型配置不存在")
    messages = build_messages(req.prompt, req.files)
    full = ""
    try:
        async for chunk in stream_llm(cfg, messages):
            if chunk.get("kind") == "answer":
                full += chunk["content"]
    except httpx.HTTPError as e:
        logger.error("LLM 调用失败: %s", e)
        raise HTTPException(status_code=502, detail="LLM 调用失败,请稍后重试") from e
    return {"code": 0, "data": {"content": full, "model": cfg.get("model_name", req.model_id)}}
