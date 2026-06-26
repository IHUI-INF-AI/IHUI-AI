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
            # T5: 提取客户端 trace_id (用于端到端追踪)
            _trace_id = connection_manager.extract_trace_from_payload(msg)
            action = msg.get("action")
            if action == "subscribe":
                t = msg.get("topic", "")
                if t:
                    topic_set.add(t)
                    resp = {"type": "subscribed", "topic": t}
                    if _trace_id:
                        resp["_trace_id"] = _trace_id
                    await websocket.send_text(json.dumps(resp))
            elif action == "unsubscribe":
                t = msg.get("topic", "")
                if t:
                    topic_set.discard(t)
                    resp = {"type": "unsubscribed", "topic": t}
                    if _trace_id:
                        resp["_trace_id"] = _trace_id
                    await websocket.send_text(json.dumps(resp))
            elif action == "ping":
                connection_manager.heartbeat(conn_id)
                resp = {"type": "pong", "ts": int(time.time())}
                if _trace_id:
                    resp["_trace_id"] = _trace_id
                await websocket.send_text(json.dumps(resp))
            elif action == "list":
                resp = {"type": "topics", "topics": list(topic_set)}
                if _trace_id:
                    resp["_trace_id"] = _trace_id
                await websocket.send_text(json.dumps(resp))
            # T3: 客户端 ACK (确认收到 _ack_id 消息)
            elif action == "ack":
                ack_id = msg.get("message_id") or msg.get("ack_id")
                if ack_id:
                    ok = await connection_manager.handle_ack(conn_id, ack_id)
                    # 不回显成功, 减少流量; 失败时回 error 便于客户端诊断
                    if not ok:
                        with contextlib.suppress(Exception):
                            err_payload = {
                                "type": "ack_error",
                                "message_id": ack_id,
                                "reason": "unknown_or_expired",
                            }
                            if _trace_id:
                                err_payload["_trace_id"] = _trace_id
                            await websocket.send_text(json.dumps(err_payload))
            # T3: 客户端 NACK (拒收, 服务端可选择停止重传)
            elif action == "nack":
                nack_id = msg.get("message_id") or msg.get("ack_id")
                if nack_id:
                    # 复用 handle_ack 移除待 ACK 记录
                    await connection_manager.handle_ack(conn_id, nack_id)
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.debug(f"notice socket error: {e}")
    finally:
        await connection_manager.disconnect(conn_id)


# ---------------------------------------------------------------------------
# T6: 断线重连同步端点 (供客户端补偿拉取)
# ---------------------------------------------------------------------------


@router.get("/ws/notice/sync", summary="断线重连后同步增量消息")
async def sync_notice(since: float = 0.0, userId: str | None = None, topic: str | None = None, limit: int = 200):
    """断线重连后, 客户端调用此接口拉取 since 时间戳之后的消息.

    Args:
        since: 起始时间戳 (Unix 秒), 0 表示全部
        userId: 仅返回该 user 的消息 (含广播)
        topic: 仅返回匹配 topic 的消息
        limit: 最大返回条数 (默认 200, 上限 500)

    Returns:
        {since, now, count, items: [...]}
    """
    import time as _t

    _t0 = _t.perf_counter()
    # 限制 limit 上限, 避免单次拉取过大
    limit = max(1, min(int(limit or 200), 500))
    msgs = await connection_manager.sync_since(
        since_ts=float(since or 0.0),
        user_uuid=userId,
        topic=topic,
        limit=limit,
    )
    elapsed = _t.perf_counter() - _t0
    connection_manager.record_sla_e2e("notice_sync", elapsed)
    # 返回精简版本 (去掉 conn_id, 节省带宽)
    items: list[dict] = []
    for m in msgs:
        items.append(
            {
                "id": m.get("id"),
                "ts": m.get("ts"),
                "type": m.get("type"),
                "topic": m.get("topic"),
                "payload": m.get("payload", {}),
                "trace_id": m.get("payload", {}).get("_trace_id", ""),
            }
        )
    return success(
        {
            "since": float(since or 0.0),
            "now": _t.time(),
            "count": len(items),
            "items": items,
        }
    )


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
