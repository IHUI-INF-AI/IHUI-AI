"""实时通知 WebSocket + 推送端点.

场景:
- 浏览器前端订阅 /ws/notice?userId=xxx&topics=announcement,job,system
- 后端业务 (公告发布 / 定时任务 / 监控告警) 通过 HTTP 调 /api/v1/notice/push
- 推送给所有匹配的订阅者, 支持按 userId 私有推送和按 topic 广播
- 跨实例: 复用现有 ConnectionManager 的 Redis pub/sub

WS 协议:
  客户端发送: {"action": "subscribe", "topic": "announcement"}
             | {"action": "unsubscribe", "topic": "..."}
             | {"action": "ping"}
  服务端推送: {"type": "notice", "topic": "...", "data": {...}, "ts": ...}
             | {"type": "pong", "ts": ...}
"""

import contextlib
import json
import logging
import time

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from app.metrics_business import (
    BIZ_LATENCY,
    BIZ_REQUEST_TOTAL,
    NOTICE_DELIVERED_TOTAL,
    NOTICE_PUSHED_TOTAL,
)
from app.telemetry import trace_business
from app.utils.response import success
from app.ws.auth_decorator import ws_require_auth
from app.ws.manager import connection_manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["WS: Notice"])


# ---------------------------------------------------------------------------
# 数据模型
# ---------------------------------------------------------------------------


class NoticePushReq(BaseModel):
    topic: str = "announcement"  # announcement / job / system / alert
    title: str = ""
    content: str = ""
    userId: str | None = None  # 指定则只推给该用户, 否则按 topic 广播  # noqa: 5
    level: str = "info"  # info / success / warning / error
    extra: dict | None = None  # 业务自定义数据 (跳转链接/任务ID等)


# ---------------------------------------------------------------------------
# WebSocket 端点
# ---------------------------------------------------------------------------


@router.websocket("/ws/notice")
@ws_require_auth
async def notice_socket(websocket: WebSocket, user_uuid: str = "", topics: str = "announcement,job,system"):
    """实时通知 WS 端点.

    客户端:
      ws://host/ws/notice?token=<access_token>&topics=announcement,job,system
    """
    userId = user_uuid
    conn_id = f"notice-{userId or 'anon'}-{id(websocket)}-{int(time.time()*1000)}"
    topic_set: set[str] = {t for t in topics.split(",") if t.strip()}

    await connection_manager.connect(conn_id, websocket, user_uuid=userId)
    # 默认加入一个"notice"房间, 按 topic 二次过滤
    connection_manager.subscribe(conn_id, "notice")

    # 发送欢迎
    with contextlib.suppress(Exception):
        await websocket.send_text(
            json.dumps(
                {
                    "type": "welcome",
                    "conn_id": conn_id,
                    "userId": userId,
                    "topics": list(topic_set),
                    "ts": int(time.time()),
                },
                ensure_ascii=False,
            )
        )

    try:
        while True:
            text = await websocket.receive_text()
            try:
                msg = json.loads(text)
            except Exception:
                continue
            action = msg.get("action")
            if action == "subscribe":
                t = msg.get("topic", "")
                if t:
                    topic_set.add(t)
                    await websocket.send_text(json.dumps({"type": "subscribed", "topic": t}))
            elif action == "unsubscribe":
                t = msg.get("topic", "")
                if t:
                    topic_set.discard(t)
                    await websocket.send_text(json.dumps({"type": "unsubscribed", "topic": t}))
            elif action == "ping":
                connection_manager.heartbeat(conn_id)
                await websocket.send_text(json.dumps({"type": "pong", "ts": int(time.time())}))
            elif action == "list":
                await websocket.send_text(json.dumps({"type": "topics", "topics": list(topic_set)}))
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.debug(f"notice socket error: {e}")
    finally:
        await connection_manager.disconnect(conn_id)


# ---------------------------------------------------------------------------
# HTTP 推送端点 (业务调用此接口把消息推到所有订阅者)
# ---------------------------------------------------------------------------


@router.post("/ws/notice/push", summary="推送实时通知到订阅者")
@trace_business("notice.push", {"biz.type": "notice", "biz.action": "push"})
async def push_notice(req: NoticePushReq):
    """对应 Java: NoticeController.push

    逻辑:
    - userId 指定: 只推送给该 userId 的 WS 连接
    - 否则按 topic 广播: 复用 notice 房间, 由前端按 topic 二次过滤
    """
    import time as _t

    _t0 = _t.perf_counter()
    payload = {
        "type": "notice",
        "topic": req.topic,
        "title": req.title,
        "content": req.content,
        "level": req.level,
        "extra": req.extra or {},
        "ts": int(time.time()),
    }
    if req.userId:
        count = await connection_manager.send_to_user(req.userId, payload)
        NOTICE_PUSHED_TOTAL.labels(topic=req.topic, scope="user").inc()
        NOTICE_DELIVERED_TOTAL.labels(topic=req.topic).inc(count)
        BIZ_REQUEST_TOTAL.labels(endpoint="notice_push", status="200", tenant_id="anonymous").inc()
        BIZ_LATENCY.labels(endpoint="notice_push").observe(_t.perf_counter() - _t0)
        return success(
            {
                "delivered": count,
                "scope": "user",
                "userId": req.userId,
                "topic": req.topic,
            }
        )
    # 广播到 notice 房间, 跨实例
    count = await connection_manager.broadcast_room("notice", payload)
    NOTICE_PUSHED_TOTAL.labels(topic=req.topic, scope="topic").inc()
    NOTICE_DELIVERED_TOTAL.labels(topic=req.topic).inc(count)
    BIZ_REQUEST_TOTAL.labels(endpoint="notice_push", status="200", tenant_id="anonymous").inc()
    BIZ_LATENCY.labels(endpoint="notice_push").observe(_t.perf_counter() - _t0)
    return success(
        {
            "delivered": count,
            "scope": "topic",
            "topic": req.topic,
        }
    )


# ---------------------------------------------------------------------------
# 辅助: 业务侧直接调用 (无需 HTTP)
# ---------------------------------------------------------------------------


@trace_business("notice.push_async", {"biz.type": "notice", "biz.action": "push_async"})
async def push_notice_async(
    topic: str,
    title: str,
    content: str,
    user_id: str | None = None,
    level: str = "info",
    extra: dict | None = None,
) -> int:
    """在 FastAPI 视图内直接 await 推送, 避开 HTTP 序列化.

    返回送达的连接数.
    """
    payload = {
        "type": "notice",
        "topic": topic,
        "title": title,
        "content": content,
        "level": level,
        "extra": extra or {},
        "ts": int(time.time()),
    }
    if user_id:
        return await connection_manager.send_to_user(user_id, payload)
    return await connection_manager.broadcast_room("notice", payload)
