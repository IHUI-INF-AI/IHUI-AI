# Stock analyse API endpoints (WebSocket + POST).
import asyncio
import json
import traceback
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from loguru import logger
from pydantic import BaseModel, Field

from app.schemas.common import success
from app.services.stock_analyse_service import check_token_balance, stock_analyse_client
from app.services.token_utils_service import calculate_and_deduct_tokens_by_cost, save_conversation_to_db
from app.ws.manager import connection_manager
from app.ws.stock_manager import STOCK_MODEL_ID, stock_ws_manager

# --- Pydantic models ---


class StockAnalyseRequest(BaseModel):
    prompt: str = Field(..., description="stock analyse question")
    user_uuid: str = Field(..., description="user UUID")
    chat_id: str | None = Field(None, description="chat ID")
    model: str | None = Field(None, description="model name")
    zidingyican: str | None = Field(None, description="custom param")
    pageNum: int | None = Field(1, description="page number")  # noqa: 5
    pageSize: int | None = Field(10, description="page size")  # noqa: 5


class StockAnalyseResponse(BaseModel):
    success: bool = Field(..., description="is success")
    message: str = Field(..., description="response message")
    chat_id: str | None = Field(None, description="chat ID")
    data: dict[str, Any] | None = Field(None, description="response data")


router = APIRouter(prefix="/cozeZhsApi/stock", tags=["Stock Analyse"])

# --- Helper ---


async def _broadcast(user_uuid, model_id, message, event, chat_id, status):
    # Broadcast to all WS connections for this user+model
    if not user_uuid:
        return
    try:
        await connection_manager.broadcast_room(user_uuid, [{"type": "text", "text": message, "role": "assistant"}])
    except Exception as e:
        logger.error("Stock broadcast error: " + str(e))


# --- WebSocket endpoint ---


@router.websocket("/ws/analyse")
async def ws_stock_analyse(
    websocket: WebSocket, client_id: str | None = Query(None), user_uuid: str | None = Query(None)
):
    # Stock analyse WebSocket streaming endpoint
    if not client_id:
        client_id = "stock_" + uuid.uuid4().hex[:8]
    logger.info("Stock WS connect: " + client_id)
    try:
        await stock_ws_manager.connect(client_id, websocket)
        await stock_ws_manager.send_message(
            client_id,
            {
                **success(
                    {
                        "type": "connected",
                        "content": "WebSocket connected",
                        "chat_id": "",
                        "created_at": datetime.now().isoformat(),
                    }
                ),
                "event": "system.connected",
                "urlType": None,
            },
        )
        timeout_sec = 300
        while True:
            try:
                raw = await asyncio.wait_for(websocket.receive_text(), timeout=timeout_sec)
            except TimeoutError:
                await stock_ws_manager.send_message(
                    client_id,
                    {
                        "code": 408,
                        "msg": "timeout",
                        "data": {
                            "type": "timeout",
                            "content": "Connection timeout: " + str(timeout_sec) + "s",
                            "created_at": datetime.now().isoformat(),
                        },
                        "event": "connection.timeout",
                    },
                )
                break
            except WebSocketDisconnect:
                logger.info("Stock WS disconnect: " + client_id)
                break
            # Parse incoming message
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError as e:
                await stock_ws_manager.send_message(
                    client_id,
                    {
                        "code": "400000",
                        "msg": "error",
                        "data": {
                            "type": "error",
                            "content": "JSON parse error: " + str(e),
                            "created_at": datetime.now().isoformat(),
                        },
                        "event": "system.error",
                    },
                )
                continue
            msg_type = msg.get("type", "")
            # --- heartbeat ---
            if msg_type == "ping":
                await stock_ws_manager.send_message(
                    client_id,
                    {
                        **success(
                            {"type": "pong", "content": "pong", "created_at": datetime.now().isoformat()},
                            msg="heartbeat",
                        ),
                        "event": "connection.heartbeat",
                    },
                )
                continue
            # --- chat request ---
            if msg_type != "chat":
                await stock_ws_manager.send_message(
                    client_id,
                    {
                        "code": "400000",
                        "msg": "error",
                        "data": {
                            "type": "error",
                            "content": "Unknown type: " + msg_type,
                            "created_at": datetime.now().isoformat(),
                        },
                        "event": "system.error",
                    },
                )
                continue
            # --- handle chat message ---
            chat_data = msg.get("data", {})
            if "chat_id" not in chat_data:
                top_cid = msg.get("chat_id")
                if top_cid:
                    chat_data["chat_id"] = top_cid
            prompt = chat_data.get("prompt")
            if not prompt:
                await stock_ws_manager.send_message(
                    client_id,
                    {
                        "code": "400000",
                        "msg": "error",
                        "data": {
                            "type": "error",
                            "content": "Missing prompt",
                            "created_at": datetime.now().isoformat(),
                        },
                        "event": "system.error",
                    },
                )
                continue
            eff_uuid = user_uuid or chat_data.get("user_uuid")
            # Token balance check
            if eff_uuid:
                tchk = await check_token_balance(eff_uuid)
                if not tchk["sufficient"]:
                    await stock_ws_manager.send_message(
                        client_id,
                        {
                        "code": "400000",
                        "msg": "error",
                        "data": {
                            "type": "error",
                            "content": tchk["reason"],
                            "chat_id": chat_data.get("chat_id", ""),
                            "created_at": datetime.now().isoformat(),
                        },
                        "detail": {
                            "current_balance": tchk.get("current_balance"),
                            "min_token": tchk.get("min_token"),
                        },
                        "event": "conversation.chat.failed",
                        },
                    )
                    continue
            final_chat_id = chat_data.get("chat_id")
            # Notify stream start
            await stock_ws_manager.send_message(
                client_id,
                {
                    "type": "stream_start",
                    **success(
                        {
                            "type": "conversation_created",
                            "content": "Chat created",
                            "chat_id": final_chat_id or "",
                            "created_at": datetime.now().isoformat(),
                        }
                    ),
                    "event": "conversation.chat.created",
                },
            )
            try:
                result = await stock_analyse_client.stream_chat(
                    prompt=prompt, ws_client_id=client_id, user_uuid=eff_uuid, chat_id=final_chat_id
                )
                # Billing + save conversation
                if eff_uuid and result.get("success"):
                    usage = result.get("usage") or {}
                    total_tk = usage.get("total_tokens", 0)
                    if not total_tk:
                        total_tk = len(prompt) + len(result.get("content", ""))
                    tresult = await calculate_and_deduct_tokens_by_cost(
                        user_uuid=eff_uuid, yuan_cost=0.1, service_name="StockAnalyse", success=True
                    )
                    deducted = tresult.get("tokens_deducted", 0) if tresult.get("success") else 0
                    try:
                        await save_conversation_to_db(
                            user_uuid=eff_uuid,
                            model_name=STOCK_MODEL_ID,
                            agent_id=STOCK_MODEL_ID,
                            problem=prompt,
                            answer=result.get("content", "done"),
                            chat_id=final_chat_id,
                            agent_url="",
                            field1=str(deducted),
                        )
                    except Exception as se:
                        logger.error("Save conversation error: " + str(se))
            except Exception as e:
                logger.error("Stock chat error: " + str(e))
                logger.error(traceback.format_exc())
    except Exception as e:
        logger.error("Stock WS exception: " + str(e))
        logger.error(traceback.format_exc())
    finally:
        stock_ws_manager.disconnect(client_id)
        logger.info("Stock WS cleanup done: " + client_id)


# --- POST endpoint (compat) ---


@router.post("/analyse")
async def stock_analyse_post(request: StockAnalyseRequest):
    # Stock analyse POST endpoint (compat, results via WS)
    params = {"prompt": request.prompt, "user_uuid": request.user_uuid, "chat_id": request.chat_id}
    logger.info("Stock POST request: " + json.dumps(params, ensure_ascii=False))
    # Token check
    tchk = await check_token_balance(request.user_uuid)
    if not tchk["sufficient"]:
        return StockAnalyseResponse(success=False, message=tchk["reason"])  # type: ignore[call-arg]
    if not request.prompt:
        return StockAnalyseResponse(success=False, message="prompt is required")  # type: ignore[call-arg]
    final_chat_id = request.chat_id or str(uuid.uuid4())
    # Call streaming API
    result = await stock_analyse_client.stream_chat(
        prompt=request.prompt, user_uuid=request.user_uuid, chat_id=final_chat_id
    )
    if not result.get("success"):
        return StockAnalyseResponse(success=False, message=result.get("error", "Unknown error"), chat_id=final_chat_id)  # type: ignore[call-arg]
    # Billing
    usage = result.get("usage") or {}
    _total_tk = usage.get("total_tokens", 0) or (len(request.prompt) + len(result.get("content", "")))
    tresult = await calculate_and_deduct_tokens_by_cost(
        user_uuid=request.user_uuid, yuan_cost=0.1, service_name="StockAnalyse", success=True
    )
    deducted = tresult.get("tokens_deducted", 0) if tresult.get("success") else 0
    # Save conversation
    try:
        await save_conversation_to_db(
            user_uuid=request.user_uuid,
            model_name=STOCK_MODEL_ID,
            agent_id=STOCK_MODEL_ID,
            problem=request.prompt,
            answer=result.get("content", "done"),
            chat_id=final_chat_id,
            agent_url="",
            field1=str(deducted),
        )
    except Exception as e:
        logger.error("Save conversation error: " + str(e))
    return {
        "success": True,
        "msg": "done",
        "chat_id": final_chat_id,
        "user_uuid": request.user_uuid,
        "model_id": STOCK_MODEL_ID,
    }
