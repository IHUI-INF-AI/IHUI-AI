# Stock Analyse service layer -- API client + billing helpers.
import json
import traceback
import uuid
from datetime import datetime
from typing import Any

import httpx
from loguru import logger

from app.config import settings
from app.services.token_service import check_user_token
from app.ws.stock_manager import stock_ws_manager


async def check_token_balance(user_uuid: str, min_tokens: int = 20000) -> dict[str, Any]:
    # Check if user has sufficient token balance
    if not user_uuid:
        return {"sufficient": False, "reason": "user UUID is empty", "current_balance": 0, "min_token": min_tokens}
    result = check_user_token(user_uuid, min_tokens)
    if not result.get("sufficient"):
        return {
            "sufficient": False,
            "reason": result.get("reason", "Insufficient"),
            "current_balance": result.get("current_balance", 0),
            "min_token": min_tokens,
        }
    return {"sufficient": True, "current_balance": result.get("current_balance", 0), "min_token": min_tokens}


class StockAnalyseClient:
    # Coze-hosted stock analyse API client with streaming support
    def __init__(self):
        self.api_url = settings.STOCK_ANALYSE_API_URL
        self.api_token = settings.STOCK_ANALYSE_API_TOKEN
        self.project_id = settings.STOCK_ANALYSE_PROJECT_ID
        logger.info("StockAnalyseClient loaded, project_id=" + str(self.project_id))

    def _build_request(self, prompt: str, session_id: str) -> dict:
        return {
            "content": {"query": {"prompt": [{"type": "text", "content": {"text": prompt}}]}},
            "type": "query",
            "session_id": session_id,
            "project_id": self.project_id,
        }

    def _headers(self) -> dict:
        return {"Authorization": "Bearer " + self.api_token, "Content-Type": "application/json"}

    async def stream_chat(
        self, prompt: str, ws_client_id: str | None = None, user_uuid: str | None = None, chat_id: str | None = None
    ) -> dict[str, Any]:
        # Stream chat via Coze stock analyse API, push to WS + public socket
        final_chat_id = chat_id or str(uuid.uuid4())
        session_id = str(uuid.uuid4())
        answer_content = ""
        reasoning_content = ""
        usage_info = None
        req_data = self._build_request(prompt, session_id)
        headers = self._headers()
        try:
            async with httpx.AsyncClient(timeout=None) as client:
                async with client.stream("POST", self.api_url, headers=headers, json=req_data) as resp:
                    resp.raise_for_status()
                    line_count = 0
                    async for line in resp.aiter_lines():
                        line_count += 1
                        if not line:
                            continue
                        # Push raw line to dedicated WS
                        if ws_client_id:
                            await stock_ws_manager.send_message(
                                ws_client_id,
                                {
                                    "code": 200,
                                    "msg": "success",
                                    "data": {
                                        "type": "stream.data",
                                        "content": line,
                                        "chat_id": final_chat_id,
                                        "created_at": datetime.now().isoformat(),
                                    },
                                    "event": "stream.data",
                                    "urlType": None,
                                },
                            )
                        # Parse SSE
                        data = None
                        try:
                            if line.startswith("data: "):
                                data = json.loads(line[6:])
                            elif line.startswith("event: "):
                                pass
                        except json.JSONDecodeError:
                            pass
                        if data is None:
                            continue
                        msg_type = data.get("type")
                        content = data.get("content", {})
                        if msg_type == "answer":
                            if content.get("answer"):
                                answer_content += content["answer"]
                                if ws_client_id:
                                    await stock_ws_manager.send_message(
                                        ws_client_id,
                                        {
                                            "code": 200,
                                            "msg": "success",
                                            "data": {
                                                "type": "answer",
                                                "content": content["answer"],
                                                "chat_id": final_chat_id,
                                                "created_at": datetime.now().isoformat(),
                                            },
                                            "event": "conversation.message.delta",
                                            "urlType": None,
                                        },
                                    )
                            if content.get("thinking"):
                                reasoning_content += content["thinking"]
                                if ws_client_id:
                                    await stock_ws_manager.send_message(
                                        ws_client_id,
                                        {
                                            "code": 200,
                                            "msg": "success",
                                            "data": {
                                                "type": "thinking",
                                                "content": content["thinking"],
                                                "chat_id": final_chat_id,
                                                "created_at": datetime.now().isoformat(),
                                            },
                                            "event": "conversation.message.delta",
                                            "urlType": None,
                                        },
                                    )
                        elif msg_type == "message_end":
                            me = content.get("message_end", {})
                            tc = me.get("token_cost", {})
                            if tc:
                                usage_info = {
                                    "input_tokens": tc.get("input_tokens", 0),
                                    "output_tokens": tc.get("output_tokens", 0),
                                    "total_tokens": tc.get("total_tokens", 0),
                                }
                            if ws_client_id:
                                total_tk = usage_info.get("total_tokens", 0) if usage_info else 0
                                await stock_ws_manager.send_message(
                                    ws_client_id,
                                    {
                                        "code": 200,
                                        "msg": "success",
                                        "data": {
                                            "type": "completed",
                                            "content": "done",
                                            "chat_id": final_chat_id,
                                            "created_at": datetime.now().isoformat(),
                                        },
                                        "total_tokens": total_tk,
                                        "event": "conversation.chat.completed",
                                        "urlType": None,
                                    },
                                )
                    logger.info("Stock stream done, lines=" + str(line_count))
            return {
                "success": True,
                "content": answer_content,
                "reasoning": reasoning_content,
                "usage": usage_info,
                "chat_id": final_chat_id,
            }
        except Exception as e:
            logger.error("Stock stream_chat error: " + str(e))
            logger.error(traceback.format_exc())
            if ws_client_id:
                await stock_ws_manager.send_message(
                    ws_client_id,
                    {
                        "code": 500,
                        "msg": "error",
                        "data": {
                            "type": "error",
                            "content": str(e),
                            "chat_id": final_chat_id,
                            "created_at": datetime.now().isoformat(),
                        },
                        "event": "system.error",
                        "urlType": None,
                    },
                )
            return {"success": False, "error": str(e), "chat_id": final_chat_id}


# Module-level singleton
stock_analyse_client = StockAnalyseClient()
