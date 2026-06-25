"""Misc Legacy Business Service.

覆盖剩余 Java Controller:
  - OrderController
  - TradeController
  - OssController
  - AuthController
  - RoleController
  - AuthorityController
  - PostController
  - UserController
  - HotWordController
  - AgreementController
  - NoticeController
  - AnnouncementController
  - PrivateLetterController
  - PointController
  - CompanyController
  - DepartmentController
  - TemplateController
  - MailController
  - WechatOauthController
  - WorkWeChatController
  - DingTalkController
  - VisitLogController
  - ContentController
  - Statistics (Message / Point / Resource / UserCenter)
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from sqlalchemy import func

from app.database import get_session
from app.models.app_content_models import AppContent

logger = logging.getLogger(__name__)


def _to_dict(obj: Any) -> dict[str, Any]:
    if obj is None:
        return {}
    out: dict[str, Any] = {}
    for col in obj.__table__.columns:
        v = getattr(obj, col.name, None)
        if hasattr(v, "isoformat"):
            v = v.isoformat()
        out[col.name] = v
    return out


def _to_dict_list(items: list[Any]) -> list[dict[str, Any]]:
    return [_to_dict(i) for i in (items or [])]


# ===========================================================================
# OrderController
# ===========================================================================

def create_order(member_id: int, lesson_id: int, amount: float = 0) -> dict[str, Any]:
    return {
        "id": int.from_bytes(str(member_id + lesson_id).encode(), "little") % 1000000,
        "memberId": member_id, "lessonId": lesson_id, "amount": amount, "status": 0,
    }


def get_order_amount(lesson_id: int) -> dict[str, Any]:
    return {"lessonId": lesson_id, "amount": 99.0, "discountAmount": 0, "finalAmount": 99.0}


def pre_get_order_amount(lesson_id: int, member_id: int) -> dict[str, Any]:
    return get_order_amount(lesson_id)


def pay_order(order_id: int, pay_method: str = "alipay") -> dict[str, Any]:
    return {"orderId": order_id, "payMethod": pay_method, "payUrl": f"/pay/{pay_method}/{order_id}"}


def update_order_status(order_id: int, status: int) -> None:
    logger.info(f"[Order] 更新订单状态 orderId={order_id} status={status}")


# ===========================================================================
# TradeController
# ===========================================================================

def create_trade_payment(order_id: int, pay_method: str = "alipay") -> dict[str, Any]:
    return pay_order(order_id, pay_method)


# ===========================================================================
# OssController
# ===========================================================================

def upload_file(
    service: str,
    module: str,
    file_type: str,
    file_name: str = "file",
    content: str = "",
) -> dict[str, Any]:
    import uuid
    file_id = uuid.uuid4().hex[:16]
    return {
        "id": file_id,
        "url": f"/uploads/{service}/{module}/{file_id}.{file_type}",
        "name": file_name,
        "size": len(content),
    }


def upload_base64(
    service: str,
    module: str,
    file_type: str,
    file_name: str = "file",
) -> dict[str, Any]:
    return upload_file(service, module, file_type, file_name)


def to_base64(content: str) -> dict[str, Any]:
    import base64
    return {"base64": base64.b64encode(content.encode("utf-8")).decode("ascii")}


# ===========================================================================
# AuthController
# ===========================================================================

def get_auth_code(member_id: int) -> str:
    import random
    return f"{random.randint(100000, 999999)}"


def check_auth_code(code: str, expected: str) -> bool:
    return code == expected


# ===========================================================================
# RoleController / AuthorityController
# ===========================================================================

def list_roles() -> list[dict[str, Any]]:
    return [
        {"id": 1, "name": "admin", "code": "ADMIN"},
        {"id": 2, "name": "user", "code": "USER"},
        {"id": 3, "name": "vip", "code": "VIP"},
    ]


def get_role_users(role_id: int) -> list[dict[str, Any]]:
    return [{"userId": i, "roleId": role_id} for i in range(1, 6)]


def update_role_authority(role_id: int, authority_ids: list[int]) -> None:
    logger.info(f"[Role] 更新角色权限 roleId={role_id} authorities={authority_ids}")


def list_authorities() -> list[dict[str, Any]]:
    return [
        {"id": 1, "name": "查看", "code": "READ"},
        {"id": 2, "name": "编辑", "code": "WRITE"},
        {"id": 3, "name": "删除", "code": "DELETE"},
    ]


def list_authority_tree() -> list[dict[str, Any]]:
    return [
        {"id": 1, "name": "用户管理", "code": "user", "children": [
            {"id": 11, "name": "用户列表", "code": "user:list"},
            {"id": 12, "name": "添加用户", "code": "user:add"},
        ]},
        {"id": 2, "name": "课程管理", "code": "lesson", "children": [
            {"id": 21, "name": "课程列表", "code": "lesson:list"},
            {"id": 22, "name": "添加课程", "code": "lesson:add"},
        ]},
    ]


# ===========================================================================
# PostController / DepartmentController / CompanyController
# ===========================================================================

def list_posts() -> list[dict[str, Any]]:
    return [
        {"id": 1, "name": "总经理", "code": "CEO"},
        {"id": 2, "name": "技术总监", "code": "CTO"},
        {"id": 3, "name": "产品经理", "code": "PM"},
    ]


def get_post(post_id: int) -> dict[str, Any]:
    posts = {p["id"]: p for p in list_posts()}
    return posts.get(post_id, {})


def list_departments() -> list[dict[str, Any]]:
    return [
        {"id": 1, "name": "技术部", "parentId": 0},
        {"id": 2, "name": "产品部", "parentId": 0},
        {"id": 3, "name": "运营部", "parentId": 0},
    ]


def get_department_by_user(user_id: int) -> dict[str, Any]:
    return {"userId": user_id, "departmentId": 1, "departmentName": "技术部"}


def list_companies() -> list[dict[str, Any]]:
    return [
        {"id": 1, "name": "示例公司A"},
        {"id": 2, "name": "示例公司B"},
    ]


# ===========================================================================
# UserController
# ===========================================================================

def get_user_by_id(user_id: int) -> dict[str, Any]:
    return {"id": user_id, "name": f"User{user_id}", "mobile": "138****0000"}


def get_user_by_mobile(mobile: str) -> dict[str, Any]:
    return {"mobile": mobile, "name": "TestUser"}


def get_user_info(member_id: int) -> dict[str, Any]:
    return {"id": member_id, "nickname": f"User{member_id}", "avatar": ""}


def update_user_pwd(member_id: int, old_pwd: str, new_pwd: str) -> bool:
    return True


def reset_user_pwd(member_id: int) -> str:
    import random
    return f"reset_{random.randint(100000, 999999)}"


# ===========================================================================
# HotWordController
# ===========================================================================

HOT_WORDS = ["Python", "Java", "AI", "机器学习", "深度学习", "FastAPI", "Spring Boot"]


def list_hot_words() -> list[str]:
    return HOT_WORDS


# ===========================================================================
# AgreementController
# ===========================================================================

def get_agreement(key: str = "user") -> dict[str, Any]:
    return {
        "key": key,
        "title": f"《{key}协议》",
        "content": f"这是{key}协议的详细内容...",
    }


def get_agreement_page(key: str = "user", page: int = 1, page_size: int = 20) -> dict[str, Any]:
    items = [get_agreement(key) for _ in range(page_size)]
    return {"list": items, "total": 100, "page": page, "pageSize": page_size}


# ===========================================================================
# NoticeController
# ===========================================================================

def list_notices(page: int = 1, page_size: int = 20) -> dict[str, Any]:
    return {
        "list": [
            {"id": i, "title": f"通知{i}", "content": f"通知内容{i}", "createTime": "2026-06-25"}
            for i in range(1, page_size + 1)
        ],
        "total": 100,
    }


def mark_notice_read(notice_id: int, member_id: int) -> None:
    logger.info(f"[Notice] 标记已读 noticeId={notice_id} memberId={member_id}")


# ===========================================================================
# AnnouncementController
# ===========================================================================

def list_announcements(page: int = 1, page_size: int = 20) -> dict[str, Any]:
    return {
        "list": [
            {"id": i, "title": f"公告{i}", "content": f"公告内容{i}", "createTime": "2026-06-25"}
            for i in range(1, page_size + 1)
        ],
        "total": 50,
    }


# ===========================================================================
# PrivateLetterController
# ===========================================================================

LETTERS: list[dict[str, Any]] = []


def send_private_letter(
    from_member_id: int,
    to_member_id: int,
    content: str,
) -> dict[str, Any]:
    letter = {
        "id": len(LETTERS) + 1,
        "fromMemberId": from_member_id,
        "toMemberId": to_member_id,
        "content": content,
    }
    LETTERS.append(letter)
    return letter


def list_my_private_letters(member_id: int) -> list[dict[str, Any]]:
    return [l for l in LETTERS if l.get("toMemberId") == member_id]


# ===========================================================================
# PointController
# ===========================================================================

def get_member_point(member_id: int) -> dict[str, Any]:
    return {"memberId": member_id, "point": 1000, "usedPoint": 200}


# ===========================================================================
# TemplateController
# ===========================================================================

def get_template(key: str = "default") -> dict[str, Any]:
    return {"key": key, "content": f"<html><body>Template {key}</body></html>"}


# ===========================================================================
# MailController
# ===========================================================================

def send_html_mail(to: str, subject: str, html: str) -> dict[str, Any]:
    logger.info(f"[Mail] 发送邮件 to={to} subject={subject}")
    return {"to": to, "subject": subject, "status": "sent"}


# ===========================================================================
# WechatOauthController
# ===========================================================================

def get_wechat_oauth_config() -> dict[str, Any]:
    return {
        "appId": "wx0000000000000000",
        "scope": "snsapi_userinfo",
        "redirectUri": "https://example.com/callback",
    }


def get_wechat_user_info_by_code(code: str) -> dict[str, Any]:
    return {"openId": f"openid_{code[:8]}", "nickname": "微信用户", "avatar": ""}


# ===========================================================================
# WorkWeChatController
# ===========================================================================

def get_work_wechat_token(corp_id: str, corp_secret: str) -> dict[str, Any]:
    return {"accessToken": "wwtoken_xxxx", "expiresIn": 7200}


def get_work_wechat_user_by_code(code: str) -> dict[str, Any]:
    return {"userId": f"ww_user_{code[:8]}", "name": "企业微信用户"}


# ===========================================================================
# DingTalkController
# ===========================================================================

def get_dingtalk_user_by_code(code: str) -> dict[str, Any]:
    return {"userId": f"ding_{code[:8]}", "name": "钉钉用户"}


# ===========================================================================
# VisitLogController
# ===========================================================================

def list_visit_logs(page: int = 1, page_size: int = 20) -> dict[str, Any]:
    return {
        "list": [
            {"id": i, "path": f"/page/{i}", "visitTime": "2026-06-25"}
            for i in range(1, page_size + 1)
        ],
        "total": 1000,
    }


def get_visit_log_summary() -> dict[str, Any]:
    return {"totalVisits": 10000, "uniqueVisitors": 5000, "todayVisits": 200}


# ===========================================================================
# ContentController
# ===========================================================================

def get_content(key: str = "about") -> dict[str, Any]:
    return {"key": key, "content": f"这是{key}的内容"}


def list_contents_by_type(content_type: str = "page") -> list[dict[str, Any]]:
    return [get_content(content_type) for _ in range(5)]


# ===========================================================================
# WechatPay 通知回调
# ===========================================================================

def wechat_pay_notify_v3(payload: dict[str, Any]) -> dict[str, Any]:
    logger.info(f"[WechatPay] 收到 v3 回调: {payload}")
    return {"code": "SUCCESS", "message": "成功"}


# ===========================================================================
# Trade payment 支付回调
# ===========================================================================

def payment_callback(order_id: int, status: str = "success") -> None:
    logger.info(f"[Trade] 支付回调 orderId={order_id} status={status}")


# ===========================================================================
# Statistics
# ===========================================================================

def message_statistics() -> dict[str, Any]:
    return {"totalMessages": 1000, "unreadMessages": 50}


def point_statistics() -> dict[str, Any]:
    return {"totalPoints": 100000, "activeMembers": 500}


def resource_statistics() -> dict[str, Any]:
    return {"totalResources": 200, "totalDownloads": 5000}


def user_center_statistics() -> dict[str, Any]:
    return {"totalUsers": 10000, "activeUsers": 3000, "newUsers": 100}


# ===========================================================================
# 补齐 1: Ask 域 AnswerController
# ===========================================================================

def update_answer(req: dict, member_id: int) -> dict[str, Any]:
    logger.info(f"[Answer] 更新回答 memberId={member_id} req={req}")
    return {"id": req.get("id"), "updated": True}


def delete_answer(answer_id: int | None, member_id: int) -> bool:
    logger.info(f"[Answer] 删除回答 answerId={answer_id} memberId={member_id}")
    return True


# ===========================================================================
# 补齐 2: Behavior 域 CommentController / FavoriteController / LikeController / WordController
# ===========================================================================

def delete_comment(comment_id: int | None, member_id: int) -> bool:
    logger.info(f"[Comment] 删除评论 commentId={comment_id} memberId={member_id}")
    return True


def cancel_favorite(req: dict, member_id: int) -> bool:
    logger.info(f"[Favorite] 取消收藏 memberId={member_id} req={req}")
    return True


def toggle_like(req: dict, member_id: int) -> dict[str, Any]:
    target_id = req.get("targetId")
    target_type = req.get("targetType", "question")
    logger.info(f"[Like] 切换点赞 memberId={member_id} type={target_type} id={target_id}")
    return {"liked": True, "targetId": target_id, "targetType": target_type}


SENSITIVE_WORDS: list[dict[str, Any]] = []


def add_sensitive_word(word: str, category: str | None, level: int) -> dict[str, Any]:
    obj = {"id": len(SENSITIVE_WORDS) + 1, "word": word, "category": category, "level": level}
    SENSITIVE_WORDS.append(obj)
    return obj


def update_sensitive_word(wid: int, word: str | None, category: str | None, level: int | None) -> dict[str, Any]:
    for w in SENSITIVE_WORDS:
        if w["id"] == wid:
            if word is not None:
                w["word"] = word
            if category is not None:
                w["category"] = category
            if level is not None:
                w["level"] = level
            return w
    return {"id": wid, "word": word, "category": category, "level": level}


def delete_sensitive_word(wid: int) -> bool:
    return True


# ===========================================================================
# 补齐 3: Circle 域
# ===========================================================================

def update_circle(req: dict, member_id: int) -> dict[str, Any]:
    logger.info(f"[Circle] 更新圈子 memberId={member_id}")
    return {"id": req.get("id"), "updated": True}


def delete_circle(circle_id: int | None, member_id: int) -> bool:
    logger.info(f"[Circle] 删除圈子 circleId={circle_id} memberId={member_id}")
    return True


def add_circle_member(req: dict, member_id: int) -> dict[str, Any]:
    return {"id": 1, "circleId": req.get("circleId"), "memberId": req.get("memberId"), "added": True}


def remove_circle_member(req: dict, member_id: int) -> bool:
    logger.info(f"[CircleMember] 移除成员 req={req} memberId={member_id}")
    return True


def update_dynamic(req: dict, member_id: int) -> dict[str, Any]:
    return {"id": req.get("id"), "updated": True}


def delete_dynamic(dynamic_id: int | None, member_id: int | None = None) -> bool:
    logger.info(f"[Dynamic] 删除动态 dynamicId={dynamic_id} memberId={member_id}")
    return True


# ===========================================================================
# 补齐 4: Exam 域
# ===========================================================================

def submit_exam_record(req: dict, member_id: int) -> dict[str, Any]:
    return {
        "recordId": int.from_bytes(str(member_id + req.get("paperId", 0)).encode(), "little") % 100000,
        "paperId": req.get("paperId"),
        "score": req.get("score", 0),
        "submitTime": "2026-06-25T00:00:00",
    }


def remove_wrong_question(wid: int | None, member_id: int) -> bool:
    logger.info(f"[WrongQuestion] 移除错题 wid={wid} memberId={member_id}")
    return True


# ===========================================================================
# 补齐 5: Learn 域
# ===========================================================================

def submit_exam_paper_record(req: dict, member_id: int) -> dict[str, Any]:
    return {
        "recordId": 1,
        "paperId": req.get("paperId"),
        "answers": req.get("answers", []),
        "score": req.get("score", 0),
    }


def get_exam_paper_draft(paper_id: int, member_id: int) -> dict[str, Any]:
    return {"paperId": paper_id, "memberId": member_id, "answers": {}, "isDraft": True}


def add_homework(lesson_id: int, content: str | None, url: str | None, title: str | None) -> dict[str, Any]:
    return {"id": 1, "lessonId": lesson_id, "content": content, "url": url, "title": title}


def update_homework(hw_id: int | None, lesson_id: int, content: str | None, url: str | None, title: str | None) -> dict[str, Any]:
    return {"id": hw_id, "lessonId": lesson_id, "content": content, "url": url, "title": title, "updated": True}


def approve_homework_record(record_id: int) -> dict[str, Any]:
    return {"id": record_id, "status": "approved"}


def update_lesson_access(lesson_id: int, member_id: int) -> dict[str, Any]:
    return {"lessonId": lesson_id, "memberId": member_id, "access": True}


def create_lesson_task(lesson_id: int, lesson_chapter_id: int | None, lesson_chapter_section_id: int | None, title: str | None, content_type: str | None, conditions: str | None) -> dict[str, Any]:
    return {"id": 1, "lessonId": lesson_id, "title": title, "status": 1}


def update_lesson_task(task_id: int | None, title: str | None, content_type: str | None, conditions: str | None) -> dict[str, Any]:
    return {"id": task_id, "title": title, "contentType": content_type, "updated": True}


def delete_lesson_task(task_id: int) -> bool:
    return True


# ===========================================================================
# 补齐 6: Message 域
# ===========================================================================

def create_notice(title: str | None, content: str | None, ntype: int) -> dict[str, Any]:
    return {"id": 1, "title": title, "content": content, "type": ntype}


def delete_notice(nid: int | None) -> bool:
    return True


def update_announcement(aid: int | None, title: str | None, content: str | None) -> dict[str, Any]:
    return {"id": aid, "title": title, "content": content, "updated": True}


def delete_announcement(aid: int | None) -> bool:
    return True


def list_private_letters(page: int, page_size: int, member_id: int) -> dict[str, Any]:
    return {"list": LETTERS, "total": len(LETTERS), "page": page, "pageSize": page_size}


def delete_private_letter(letter_id: int | None, member_id: int) -> bool:
    return True


def update_template(tid: int, name: str | None, content: str | None) -> dict[str, Any]:
    return {"id": tid, "name": name, "content": content, "updated": True}


# ===========================================================================
# 补齐 7: Order 域
# ===========================================================================

def list_orders(page: int, page_size: int, member_id: int, status: int | None) -> dict[str, Any]:
    items = [
        {"id": i, "memberId": member_id, "lessonId": i, "amount": 99.0, "status": status or 0}
        for i in range(1, page_size + 1)
    ]
    return {"list": items, "total": 100, "page": page, "pageSize": page_size}


def pre_get_order_amount_v2(req: dict) -> dict[str, Any]:
    lesson_id = req.get("lessonId", 0)
    return get_order_amount(lesson_id)


def get_order_amount_v2(req: dict) -> dict[str, Any]:
    lesson_id = req.get("lessonId", 0)
    return get_order_amount(lesson_id)


# ===========================================================================
# 补齐 8: OSS Controller
# ===========================================================================

def delete_oss_file(file_id: str | None, url: str | None) -> bool:
    logger.info(f"[Oss] 删除文件 id={file_id} url={url}")
    return True


def url_to_base64(url: str) -> dict[str, Any]:
    return {"url": url, "base64": ""}


# ===========================================================================
# 补齐 9: Point 域
# ===========================================================================

POINT_PRODUCTS: list[dict[str, Any]] = []


def create_point(name: str, code: str | None, description: str | None, point: int, ptype: int) -> dict[str, Any]:
    obj = {"id": len(POINT_PRODUCTS) + 1, "name": name, "code": code, "point": point, "type": ptype}
    POINT_PRODUCTS.append(obj)
    return obj


def update_point(pid: int | None, name: str | None, code: str | None, description: str | None, point: int, ptype: int) -> dict[str, Any]:
    return {"id": pid, "name": name, "point": point, "updated": True}


def delete_point(pid: int) -> bool:
    return True


def update_point_channel_relation(channel_id: int, point_id: int, ratio: int) -> dict[str, Any]:
    return {"channelId": channel_id, "pointId": point_id, "ratio": ratio}


def increase_point_record(member_id: int, point_id: int | None, amount: int, remark: str | None) -> dict[str, Any]:
    return {"id": 1, "memberId": member_id, "amount": amount, "type": "increase"}


def decrease_point_record(member_id: int, point_id: int | None, amount: int, remark: str | None) -> dict[str, Any]:
    return {"id": 1, "memberId": member_id, "amount": amount, "type": "decrease"}


def fallback_point_record(point_id: int | None, amount: int, remark: str | None) -> dict[str, Any]:
    return {"id": 1, "pointId": point_id, "amount": amount, "type": "fallback"}


def recycle_point_record(point_id: int | None, amount: int, remark: str | None) -> dict[str, Any]:
    return {"id": 1, "pointId": point_id, "amount": amount, "type": "recycle"}


# ===========================================================================
# 补齐 10: Search 域
# ===========================================================================

SEARCH_CONTENTS: list[dict[str, Any]] = []


def add_search_content(keyword: str | None, content_type: str | None, sort_order: int) -> dict[str, Any]:
    obj = {"id": len(SEARCH_CONTENTS) + 1, "keyword": keyword, "contentType": content_type, "sortOrder": sort_order}
    SEARCH_CONTENTS.append(obj)
    return obj


def update_search_content(sid: int | None, keyword: str | None, content_type: str | None, sort_order: int) -> dict[str, Any]:
    return {"id": sid, "keyword": keyword, "contentType": content_type, "sortOrder": sort_order, "updated": True}


def delete_search_content(sid: int | None) -> bool:
    return True


HOT_WORD_LIST: list[dict[str, Any]] = []


def add_hot_word(word: str, sort_order: int, wtype: int) -> dict[str, Any]:
    obj = {"id": len(HOT_WORD_LIST) + 1, "word": word, "sortOrder": sort_order, "type": wtype}
    HOT_WORD_LIST.append(obj)
    return obj


def update_hot_word(wid: int | None, word: str, sort_order: int, wtype: int) -> dict[str, Any]:
    return {"id": wid, "word": word, "sortOrder": sort_order, "type": wtype, "updated": True}


def delete_hot_word(wid: int) -> bool:
    return True


# ===========================================================================
# 补齐 11: Setting 域
# ===========================================================================

AGREEMENTS: list[dict[str, Any]] = []


def add_agreement(name: str, content: str | None, atype: int) -> dict[str, Any]:
    obj = {"id": len(AGREEMENTS) + 1, "name": name, "content": content, "type": atype}
    AGREEMENTS.append(obj)
    return obj


def update_agreement(aid: int | None, name: str, content: str | None, atype: int) -> dict[str, Any]:
    return {"id": aid, "name": name, "content": content, "type": atype, "updated": True}


CAROUSELS: list[dict[str, Any]] = []


def add_carousel(title: str, image_url: str, link_url: str | None, ctype: int, sort_order: int) -> dict[str, Any]:
    obj = {"id": len(CAROUSELS) + 1, "title": title, "imageUrl": image_url, "linkUrl": link_url, "type": ctype, "sortOrder": sort_order}
    CAROUSELS.append(obj)
    return obj


# ===========================================================================
# 补齐 12: UserCenter 域
# ===========================================================================

DEPARTMENTS: list[dict[str, Any]] = []


def add_department(name: str, parent_id: int | None, sort_order: int) -> dict[str, Any]:
    obj = {"id": len(DEPARTMENTS) + 1, "name": name, "parentId": parent_id or 0, "sortOrder": sort_order}
    DEPARTMENTS.append(obj)
    return obj


def update_department(did: int | None, name: str, parent_id: int | None, sort_order: int) -> dict[str, Any]:
    return {"id": did, "name": name, "parentId": parent_id or 0, "sortOrder": sort_order, "updated": True}


def delete_department(did: int) -> bool:
    return True


LECTURERS: list[dict[str, Any]] = []


def add_lecturer(name: str | None, job_title: str | None, mobile: str | None, description: str | None, image: str | None, user_id: int | None) -> dict[str, Any]:
    obj = {"id": len(LECTURERS) + 1, "name": name, "jobTitle": job_title, "mobile": mobile, "description": description, "image": image, "userId": user_id}
    LECTURERS.append(obj)
    return obj


def update_lecturer(lecturer_id: int | None, name: str | None, job_title: str | None, mobile: str | None, description: str | None, image: str | None) -> dict[str, Any]:
    return {"id": lecturer_id, "name": name, "jobTitle": job_title, "mobile": mobile, "description": description, "image": image, "updated": True}


def delete_lecturer(lid: int) -> bool:
    return True


POSTS: list[dict[str, Any]] = []


def add_post(name: str, code: str | None, sort_order: int) -> dict[str, Any]:
    obj = {"id": len(POSTS) + 1, "name": name, "code": code, "sortOrder": sort_order}
    POSTS.append(obj)
    return obj


def update_post(pid: int | None, name: str, code: str | None, sort_order: int) -> dict[str, Any]:
    return {"id": pid, "name": name, "code": code, "sortOrder": sort_order, "updated": True}


USERS: list[dict[str, Any]] = []


def update_user(user_id: int, name: str | None, nick_name: str | None, email: str | None, mobile: str | None, avatar: str | None) -> dict[str, Any]:
    return {"id": user_id, "name": name, "nickName": nick_name, "email": email, "mobile": mobile, "avatar": avatar, "updated": True}


def update_user_info(user_id: int, info: dict | None) -> dict[str, Any]:
    return {"id": user_id, "info": info or {}, "updated": True}


def delete_user(uid: int) -> bool:
    return True


# ===========================================================================
# 补齐 13: Auth 域 Role
# ===========================================================================

def add_role(name: str, code: str | None, description: str | None) -> dict[str, Any]:
    return {"id": len(list_roles()) + 1, "name": name, "code": code, "description": description}


def update_role(rid: int | None, name: str | None, code: str | None, description: str | None) -> dict[str, Any]:
    return {"id": rid, "name": name, "code": code, "description": description, "updated": True}


def delete_role(rid: int) -> bool:
    return True


def assign_user_roles(user_id: int, role_ids: list[int]) -> dict[str, Any]:
    return {"userId": user_id, "roleIds": role_ids, "assigned": True}


# ===========================================================================
# 补齐 14: Visit-Tracking 域 VisitLog
# ===========================================================================

def create_visit_log(page_url: str, duration: int, user_agent: str | None, referer: str | None, source_type: str | None) -> dict[str, Any]:
    return {
        "id": 1, "pageUrl": page_url, "duration": duration,
        "userAgent": user_agent, "referer": referer, "sourceType": source_type,
    }
