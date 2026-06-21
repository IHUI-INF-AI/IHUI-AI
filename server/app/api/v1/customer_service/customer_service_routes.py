"""
客服系统 API:在线聊天消息、已读、常见问题
与前端 CUSTOMER_SERVICE_PATHS 及 customer-service.ts 对齐
"""
import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, Body, File, Form, HTTPException, UploadFile

from app.core.customer_service_db import (
    init_db as _cs_init_db,
)
from app.core.customer_service_db import (
    load_conversations,
)

logger = logging.getLogger(__name__)

router = APIRouter()

# 由 run_customer_service 注入:发消息后通过 WebSocket 推送客服回复
_push_to_ws_callback = None


def set_push_to_ws_callback(callback):
    global _push_to_ws_callback
    _push_to_ws_callback = callback


_persist_callback = None


def set_persist_callback(callback):
    """注入持久化回调:callback(_conversations) 在每次写后调用"""
    global _persist_callback
    _persist_callback = callback


# ---------- 内存存储(可由 run_customer_service 从 SQLite 加载) ----------
_conversations: dict[str, list[dict]] = {}  # conversationId -> messages
_faqs: list[dict] = [
    {"id": "faq-1", "category": "general", "question": "如何联系商务合作?", "answer": "请在本页使用「联系商务」或提交工单,我们会尽快与您联系.", "order": 1},
    {"id": "faq-2", "category": "general", "question": "API 调用限制与计费?", "answer": "详见开放平台文档的「定价与用量」说明,可按需选择套餐.", "order": 2},
    {"id": "faq-3", "category": "general", "question": "遇到问题如何提交工单?", "answer": "在客服中心切换到「工单」标签,填写问题类型与描述并提交即可.", "order": 3},
]


def _ok(data, msg: str = "success"):
    return {"code": 200, "msg": msg, "data": data, "success": True}


# ---------- 消息 ----------
@router.get("/messages")
async def get_messages(
    conversationId: str | None = None,  # noqa: 5
    page: int = 1,
    pageSize: int = 50,  # noqa: 5
):
    """获取客服消息历史,与前端 getCustomerServiceMessages 对齐"""
    page = max(1, page)
    pageSize = min(max(1, pageSize), 100)
    conv_id = conversationId or "default"
    if conv_id not in _conversations:
        return _ok({"list": [], "total": 0, "conversationId": conv_id})
    messages = _conversations[conv_id]
    total = len(messages)
    start = (page - 1) * pageSize
    list_data = messages[start : start + pageSize]
    return _ok({"list": list_data, "total": total, "conversationId": conv_id})


@router.post("/messages")
async def post_message(
    content: str = Form(...),
    type: str = Form("text"),
    conversationId: str | None = Form(None),  # noqa: 5
    files: list[UploadFile] | None = File(None),
):
    """发送客服消息,与前端 sendCustomerServiceMessage 对齐(FormData)"""
    content = (content or "").strip()
    if not content and not (files and len(files)):
        raise HTTPException(status_code=400, detail="消息内容不能为空")
    conv_id = conversationId or str(uuid.uuid4())
    if conv_id not in _conversations:
        _conversations[conv_id] = []
    msg_id = f"{conv_id}_{uuid.uuid4().hex[:12]}"
    now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.000Z")
    # 简化:不实际上传文件,仅记录文本;如需文件可存到 storage 并返回 url
    file_list = []
    if files:
        for i, f in enumerate(files):
            ct = (f.content_type or "").split("/")[0] if f.content_type else "application"
            file_list.append({
                "id": f"{msg_id}_f{i}",
                "name": f.filename or "file",
                "url": "",
                "type": ct,
                "size": 0,
            })
    msg = {
        "id": msg_id,
        "type": type if type in ("text", "image", "file", "system") else "text",
        "content": content,
        "senderId": "user",
        "senderName": "用户",
        "status": "sent",
        "createTime": now,
        "files": file_list if file_list else None,
    }
    _conversations[conv_id].append(msg)
    if _persist_callback:
        try:
            _persist_callback(_conversations)
        except Exception as e:
            logger.warning("持久化 conversations 失败: %s", e)
    if _push_to_ws_callback:
        staff_msg = _make_staff_reply(conv_id)
        if staff_msg:
            try:
                import asyncio
                cb = _push_to_ws_callback
                if asyncio.iscoroutinefunction(cb):
                    await cb(conv_id, staff_msg)
                else:
                    cb(conv_id, staff_msg)
            except Exception as e:
                logger.warning("推送客服回复到 WS 失败: %s", e)
    return _ok(msg)


def _make_staff_reply(conv_id: str) -> dict | None:
    import random
    now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.000Z")
    replies = [
        "您好,您的留言我们已收到,客服将尽快回复.如需紧急帮助请前往「工单」提交问题.",
        "感谢您的反馈,我们会尽快处理.您也可以先查看「常见问题」获取自助解答.",
        "已记录您的问题,工作时间内我们会优先回复.",
    ]
    return {
        "id": f"{conv_id}_staff_{uuid.uuid4().hex[:8]}",
        "type": "text",
        "content": random.choice(replies),
        "senderId": "customer-service-staff",
        "senderName": "智汇客服",
        "status": "sent",
        "createTime": now,
    }


@router.post("/messages/read")
async def mark_read(body: dict = Body(default_factory=dict)):
    """标记消息已读,与前端 markMessagesAsRead 对齐"""
    # messageIds 可选处理,仅返回成功
    return _ok(None)


# ---------- 常见问题 ----------
@router.get("/faqs")
async def get_faqs(category: str | None = None):
    """获取常见问题列表,与前端 getFAQs 对齐"""
    list_data = _faqs
    if category:
        list_data = [f for f in _faqs if f.get("category") == category]
    categories = list({f.get("category", "general") for f in _faqs})
    return _ok({"list": list_data, "categories": categories})


# Initialize the SQLite persistence (idempotent).
try:
    _cs_init_db()
    _conversations = load_conversations()
except Exception:
    pass

# ---------- 工单(与前端 /api/customer-service/tickets 对齐)----------
# 前端 ticket.ts 使用 CUSTOMER_SERVICE_PATHS.tickets = "/api/customer-service/tickets"
# 这些路由挂载在 /api/customer-service/tickets/*
try:
    from app.api.v1.customer_service.ticket_routes import (
        router as _ticket_router,
    )
except ImportError:
    _ticket_router = None

if _ticket_router is not None:
    # 将 ticket 子路由挂载到当前 router 下 /tickets 前缀
    router.include_router(_ticket_router, prefix="/tickets", tags=["Customer Service - Tickets"])
else:
    logger.warning("ticket_routes 导入失败,跳过 /tickets 路由注册")


# 初始化工单数据(如果尚未从 ticket_routes 加载)
try:
    if "_cs_tickets" in dir() and "_cs_replies" in dir():
        pass  # 数据已通过 router 加载
except Exception:
    pass
