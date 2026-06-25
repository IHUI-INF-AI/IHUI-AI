"""
工单 API:与前端 tickets.ts(zhs_api_ticket)对齐
"""
import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, Body, HTTPException

from app.core.customer_service_db import (
    init_db as _cs_init_db,
)
from app.core.customer_service_db import (
    load_tickets,
)

logger = logging.getLogger(__name__)

router = APIRouter()

_persist_callback = None


def set_persist_callback(callback):
    """注入持久化回调:callback(_tickets, _replies) 在每次写后调用"""
    global _persist_callback
    _persist_callback = callback


# ---------- 内存存储(可由 run_customer_service 从 SQLite 加载) ----------
_tickets: dict[str, dict] = {}  # id -> ticket
_replies: dict[str, list[dict]] = {}  # ticket_id -> list of reply


def _ok(data, msg: str = "success"):
    return {"code": 200, "msg": msg, "data": data, "success": True}


def _ticket_to_response(t: dict) -> dict:
    """补全前端 Ticket 所需字段"""
    tid = t["id"]
    replies_list = _replies.get(tid, [])
    return {
        "id": t["id"],
        "title": t["title"],
        "description": t["description"],
        "category": t["category"],
        "status": t["status"],
        "priority": t.get("priority", "medium"),
        "createdAt": t["createdAt"],
        "updatedAt": t["updatedAt"],
        "resolvedAt": t.get("resolvedAt"),
        "closedAt": t.get("closedAt"),
        "userId": t.get("userId", ""),
        "replies": replies_list,
        "attachments": t.get("attachments", []),
    }


def _list_tickets_impl(
    page: int = 1,
    pageSize: int = 10,  # noqa: 5
    status: str | None = None,
    category: str | None = None,
):
    """工单列表逻辑(供 /list 与 GET "" 复用)"""
    page = max(1, page)
    pageSize = min(max(1, pageSize), 100)
    items = list(_tickets.values())
    items.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    if status:
        items = [x for x in items if x.get("status") == status]
    if category:
        items = [x for x in items if x.get("category") == category]
    total = len(items)
    start = (page - 1) * pageSize
    page_items = items[start : start + pageSize]
    list_data = [_ticket_to_response(t) for t in page_items]
    return _ok({"list": list_data, "total": total})


@router.get("/list")
async def list_tickets(
    page: int = 1,
    pageSize: int = 10,  # noqa: 5
    status: str | None = None,
    category: str | None = None,
):
    """工单列表(/api/zhs_api_ticket/list),与前端 getTickets 对齐"""
    return _list_tickets_impl(page=page, pageSize=pageSize, status=status, category=category)


@router.get("")
async def list_tickets_at_root(
    page: int = 1,
    pageSize: int = 10,  # noqa: 5
    status: str | None = None,
    category: str | None = None,
):
    """工单列表(GET /api/customer-service/tickets),与 CUSTOMER_SERVICE_PATHS.tickets 对齐"""
    return _list_tickets_impl(page=page, pageSize=pageSize, status=status, category=category)


@router.get("/{id}")
async def get_ticket(id: str):
    """工单详情,与前端 getTicket 对齐"""
    if id not in _tickets:
        raise HTTPException(status_code=404, detail="工单不存在")
    return _ok(_ticket_to_response(_tickets[id]))


@router.post("")
async def create_ticket(body: dict = Body(default_factory=dict)):
    """创建工单,与前端 createTicket 对齐(JSON)"""
    title = (body.get("title") or "").strip()
    description = (body.get("description") or "").strip()
    category = body.get("category", "other")
    priority = body.get("priority", "medium")
    if not title:
        raise HTTPException(status_code=400, detail="标题不能为空")
    if len(title) < 2:
        raise HTTPException(status_code=400, detail="标题至少 2 个字符")
    if not description:
        raise HTTPException(status_code=400, detail="描述不能为空")
    if len(description) < 10:
        raise HTTPException(status_code=400, detail="描述至少 10 个字符")
    tid = str(uuid.uuid4())
    now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.000Z")
    t = {
        "id": tid,
        "title": title,
        "description": description,
        "category": category,
        "status": "pending",
        "priority": priority,
        "createdAt": now,
        "updatedAt": now,
        "userId": body.get("userId", ""),
        "attachments": body.get("attachments", []),
    }
    _tickets[tid] = t
    _replies[tid] = []
    return _ok(_ticket_to_response(t))


@router.post("/{id}/replies")
async def reply_ticket(id: str, body: dict = Body(default_factory=dict)):
    """回复工单,与前端 replyTicket 对齐(JSON: content, attachments?)"""
    if id not in _tickets:
        raise HTTPException(status_code=404, detail="工单不存在")
    content = (body.get("content") or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="回复内容不能为空")
    now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.000Z")
    reply = {
        "id": str(uuid.uuid4()),
        "ticketId": id,
        "content": content,
        "userId": _tickets[id].get("userId", ""),
        "isAdmin": False,
        "createdAt": now,
        "attachments": body.get("attachments", []),
    }
    _replies.setdefault(id, []).append(reply)
    _tickets[id]["updatedAt"] = now
    if _persist_callback:
        try:
            _persist_callback(_tickets, _replies)
        except Exception as e:
            logger.warning("持久化工单失败: %s", e)
    return _ok(reply)


@router.post("/{id}/close")
async def close_ticket(id: str):
    """关闭工单"""
    if id not in _tickets:
        raise HTTPException(status_code=404, detail="工单不存在")
    now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.000Z")
    _tickets[id]["status"] = "closed"
    _tickets[id]["updatedAt"] = now
    _tickets[id]["closedAt"] = now
    if _persist_callback:
        try:
            _persist_callback(_tickets, _replies)
        except Exception as e:
            logger.warning("持久化工单失败: %s", e)
    return _ok(None)


@router.post("/{id}/reopen")
async def reopen_ticket(id: str):
    """重新打开工单"""
    if id not in _tickets:
        raise HTTPException(status_code=404, detail="工单不存在")
    now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.000Z")
    _tickets[id]["status"] = "pending"
    _tickets[id]["updatedAt"] = now
    _tickets[id]["closedAt"] = None
    if _persist_callback:
        try:
            _persist_callback(_tickets, _replies)
        except Exception as e:
            logger.warning("持久化工单失败: %s", e)
    return _ok(None)


@router.post("/{id}/audit")
async def audit_ticket(id: str, body: dict = Body(default_factory=dict)):
    """审核工单(管理员)"""
    if id not in _tickets:
        raise HTTPException(status_code=404, detail="工单不存在")
    action = body.get("action")
    if action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="action 必须是 approve 或 reject")
    now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.000Z")
    _tickets[id]["status"] = "approved" if action == "approve" else "rejected"
    _tickets[id]["updatedAt"] = now
    if _persist_callback:
        try:
            _persist_callback(_tickets, _replies)
        except Exception as e:
            logger.warning("持久化工单失败: %s", e)
    return _ok(_ticket_to_response(_tickets[id]))


@router.post("/{id}/assign")
async def assign_ticket(id: str, body: dict = Body(default_factory=dict)):
    """分配工单(管理员)"""
    if id not in _tickets:
        raise HTTPException(status_code=404, detail="工单不存在")
    assign_to = (body.get("assignTo") or "").strip()
    if not assign_to:
        raise HTTPException(status_code=400, detail="assignTo 不能为空")
    now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.000Z")
    _tickets[id]["assignee"] = assign_to
    _tickets[id]["updatedAt"] = now
    if _persist_callback:
        try:
            _persist_callback(_tickets, _replies)
        except Exception as e:
            logger.warning("持久化工单失败: %s", e)
    return _ok(_ticket_to_response(_tickets[id]))


# Initialize the SQLite persistence (idempotent).
try:
    _cs_init_db()
    _tickets, _replies = load_tickets()
except Exception as e:
    logger.debug("初始化工单 SQLite 持久化失败: %s", e)
