"""实时音色生成 WebSocket.

迁移自 ZHS_Server_java/mcp/websocket/TimbreWebSocket.java.
支持 JWT 认证 + 异步参数等待 + 调用阿里云 CosyVoice generateTimbre.
"""

import asyncio
import json
import time
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from loguru import logger

from app.security import decode_access_token
from app.services.ali_ai_service import get_ali_ai_service

router = APIRouter()

ACTIVE_TIMBRE_TASKS: dict[str, dict[str, Any]] = {}


async def _send(websocket: WebSocket, payload: dict[str, Any]) -> None:
    try:
        await websocket.send_text(json.dumps(payload, ensure_ascii=False))
    except Exception as e:
        # 2026-06-25 P2 加固: 记录异常便于排查, 不再静默吞噬
        logger.debug(f"_send to {websocket.client} failed: {e}")


@router.websocket("/ws/timbre/generate")
async def timbre_generate_ws(websocket: WebSocket):
    """实时音色生成 WebSocket 端点.

    流程:客户端先发送 {"action":"auth","token":"..."} 完成认证
         然后发送 {"action":"generate","voice_prefix":"...","url":"...","sex":"female","age":25}
         服务端异步调用阿里云 CosyVoice generateTimbre, 完成后推送结果.
    """
    await websocket.accept()
    user_uuid: str | None = None
    task_id: str | None = None
    try:
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=300)
            except TimeoutError:
                break
            except WebSocketDisconnect:
                break
            try:
                message = json.loads(data)
            except json.JSONDecodeError:
                await _send(websocket, {"code": 400, "event": "error", "message": "JSON 格式错误"})
                continue
            action = message.get("action")
            if action == "auth":
                token = message.get("token", "")
                if not token:
                    await _send(websocket, {"code": 401, "event": "auth.fail", "message": "缺少 token"})
                    continue
                try:
                    payload = decode_access_token(token)
                    user_uuid = payload.get("sub") or payload.get("user_uuid")
                    if not user_uuid:
                        await _send(websocket, {"code": 401, "event": "auth.fail", "message": "token 无效"})
                        continue
                    await _send(websocket, {"code": 0, "event": "auth.ok", "user_uuid": user_uuid})
                except Exception as e:
                    await _send(websocket, {"code": 401, "event": "auth.fail", "message": f"token 校验失败: {e}"})
                    continue
            elif action == "generate":
                if not user_uuid:
                    await _send(websocket, {"code": 401, "event": "error", "message": "请先完成 auth"})
                    continue
                voice_prefix = message.get("voice_prefix", f"vp_{user_uuid[:8]}_{int(time.time())}")
                url = message.get("url", "")
                sex = message.get("sex", "female")
                age = int(message.get("age", 25))
                task_id = f"timbre_{int(time.time())}_{user_uuid[:8]}"
                ACTIVE_TIMBRE_TASKS[task_id] = {"status": "running", "user_uuid": user_uuid}
                await _send(websocket, {"code": 0, "event": "task.start", "task_id": task_id})
                try:
                    svc = get_ali_ai_service()
                    result = await svc.generate_timbre(voice_prefix, url, sex, age)
                    ACTIVE_TIMBRE_TASKS[task_id]["status"] = "ok" if result.get("status") in ("OK", 200) else "fail"
                    ACTIVE_TIMBRE_TASKS[task_id]["result"] = result
                    await _send(websocket, {"code": 0, "event": "task.done", "task_id": task_id, "data": result})
                except Exception as e:
                    ACTIVE_TIMBRE_TASKS[task_id]["status"] = "fail"
                    ACTIVE_TIMBRE_TASKS[task_id]["error"] = str(e)
                    await _send(websocket, {"code": 500, "event": "task.error", "task_id": task_id, "message": str(e)})
            elif action == "ping":
                await _send(websocket, {"code": 0, "event": "pong", "timestamp": int(time.time() * 1000)})
            else:
                await _send(websocket, {"code": 400, "event": "error", "message": f"未知 action: {action}"})
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"音色 WebSocket 异常: {e}")
    finally:
        if task_id and task_id in ACTIVE_TIMBRE_TASKS:
            ACTIVE_TIMBRE_TASKS[task_id]["closed"] = True
        try:
            await websocket.close()
        except Exception as e:
            # 2026-06-25 P2 加固: 记录异常便于排查
            logger.debug(f"websocket close failed (timbre): {e}")
