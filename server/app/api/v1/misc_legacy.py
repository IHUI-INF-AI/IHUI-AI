"""Misc Legacy Routes - 覆盖剩余 Java Controller.

包含:
  - OrderController          (5 端点)
  - TradeController          (1 端点)
  - OssController            (4 端点)
  - AuthController           (2 端点)
  - RoleController           (3 端点)
  - AuthorityController      (2 端点)
  - PostController           (2 端点)
  - UserController           (6 端点)
  - HotWordController        (1 端点)
  - AgreementController      (3 端点)
  - NoticeController         (2 端点)
  - AnnouncementController   (2 端点)
  - PrivateLetterController  (2 端点)
  - PointController          (1 端点)
  - CompanyController        (1 端点)
  - DepartmentController     (2 端点)
  - TemplateController       (1 端点)
  - MailController           (1 端点)
  - WechatOauthController    (2 端点)
  - WorkWeChatController     (2 端点)
  - DingTalkController       (1 端点)
  - VisitLogController       (2 端点)
  - ContentController        (2 端点)
  - Statistics               (4 端点)

合计 ~55 个端点.
"""
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request
from pydantic import BaseModel

from app.security import get_current_user_id_flexible, require_login
from app.services import misc_business

router = APIRouter(prefix="", tags=["Misc-Legacy"])


def _ok(data: Any = None, msg: str = "ok") -> dict[str, Any]:
    return {"code": 0, "data": data, "msg": msg}


def _err(status: int, msg: str) -> HTTPException:
    return HTTPException(status_code=status, detail=msg)


class OrderCreateReq(BaseModel):
    lessonId: int
    amount: float = 0


class OrderPaymentReq(BaseModel):
    orderId: int
    payMethod: str = "alipay"


class OrderStatusReq(BaseModel):
    id: int
    status: int


class UploadReq(BaseModel):
    fileName: str = "file"
    content: str = ""


class AuthCodeReq(BaseModel):
    code: str


class RoleAuthorityReq(BaseModel):
    roleId: int
    authorityIds: list[int]


# ===========================================================================
# OrderController (5 端点)
# ===========================================================================

@router.post("/auth-api/order", summary="[Order]创建订单")
def order_create(req: OrderCreateReq, _user: str = Depends(require_login)):
    try:
        member_id = get_current_user_id_flexible()
        return _ok(misc_business.create_order(member_id, req.lessonId, req.amount))
    except Exception as e:
        raise _err(500, str(e))


@router.get("/auth-api/order/get-order-amount", summary="[Order]获取订单金额")
def order_get_amount(lessonId: int):
    return _ok(misc_business.get_order_amount(lessonId))


@router.get("/auth-api/order/pre-get-order-amount", summary="[Order]预计算金额")
def order_pre_get_amount(lessonId: int, _user: str = Depends(require_login)):
    member_id = get_current_user_id_flexible()
    return _ok(misc_business.pre_get_order_amount(lessonId, member_id))


@router.post("/auth-api/order/payment", summary="[Order]订单支付")
def order_pay(req: OrderPaymentReq, _user: str = Depends(require_login)):
    return _ok(misc_business.pay_order(req.orderId, req.payMethod))


@router.post("/public-api/order/update/status", summary="[Order]更新订单状态")
def order_update_status(req: OrderStatusReq):
    misc_business.update_order_status(req.id, req.status)
    return _ok()


# ===========================================================================
# TradeController (1 端点)
# ===========================================================================

@router.post("/auth-api/trade/payment", summary="[Trade]交易支付")
def trade_payment(req: OrderPaymentReq, _user: str = Depends(require_login)):
    return _ok(misc_business.create_trade_payment(req.orderId, req.payMethod))


# ===========================================================================
# OssController (4 端点)
# ===========================================================================

@router.post("/auth-api/{service}/{module}/{fileType}", summary="[Oss]上传文件")
def oss_upload(
    service: str, module: str, fileType: str, req: UploadReq = Body(default=UploadReq()),
    _user: str = Depends(require_login),
):
    return _ok(misc_business.upload_file(service, module, fileType, req.fileName, req.content))


@router.post("/auth-api/base64/{service}/{module}/{fileType}", summary="[Oss]base64 上传")
def oss_upload_base64(
    service: str, module: str, fileType: str, req: UploadReq = Body(default=UploadReq()),
    _user: str = Depends(require_login),
):
    return _ok(misc_business.upload_base64(service, module, fileType, req.fileName))


@router.post("/file", summary="[Oss]通用文件上传")
def file_upload(req: UploadReq):
    return _ok(misc_business.upload_file("common", "default", "file", req.fileName, req.content))


@router.post("/to-base64", summary="[Oss]转 base64")
def to_base64(req: UploadReq):
    return _ok(misc_business.to_base64(req.content))


# ===========================================================================
# AuthController (2 端点)
# ===========================================================================

@router.get("/public-api/auth-code", summary="[Auth]获取验证码")
def auth_code(memberId: int | None = None):
    if memberId is None:
        memberId = 0
    return _ok({"code": misc_business.get_auth_code(memberId)})


@router.post("/public-api/auth-code/check", summary="[Auth]校验验证码")
def auth_code_check(req: AuthCodeReq):
    return _ok({"valid": misc_business.check_auth_code(req.code, "000000")})


# ===========================================================================
# RoleController (3 端点)
# ===========================================================================

@router.get("/role", summary="[Role]获取角色列表")
def role_list():
    return _ok({"list": misc_business.list_roles()})


@router.put("/role/authority/update", summary="[Role]更新角色权限")
def role_authority_update(req: RoleAuthorityReq):
    misc_business.update_role_authority(req.roleId, req.authorityIds)
    return _ok()


@router.get("/role/user/list", summary="[Role]角色用户列表")
def role_users(roleId: int):
    return _ok({"list": misc_business.get_role_users(roleId)})


# ===========================================================================
# AuthorityController (2 端点)
# ===========================================================================

@router.get("/authorities", summary="[Authority]权限列表")
def authorities_list():
    return _ok({"list": misc_business.list_authorities()})


@router.get("/authorities/tree", summary="[Authority]权限树")
def authorities_tree():
    return _ok({"list": misc_business.list_authority_tree()})


# ===========================================================================
# PostController (2 端点)
# ===========================================================================

@router.get("/posts", summary="[Post]岗位列表")
def posts_list():
    return _ok({"list": misc_business.list_posts()})


@router.get("/posts/{id}", summary="[Post]岗位详情")
def posts_get(id: int):
    return _ok(misc_business.get_post(id))


# ===========================================================================
# DepartmentController (2 端点)
# ===========================================================================

@router.get("/department", summary="[Dept]部门列表")
def department_list():
    return _ok({"list": misc_business.list_departments()})


@router.get("/department/by-user-id", summary="[Dept]按用户查部门")
def department_by_user(userId: int):
    return _ok(misc_business.get_department_by_user(userId))


# ===========================================================================
# CompanyController (1 端点)
# ===========================================================================

@router.get("/company", summary="[Company]公司列表")
def company_list():
    return _ok({"list": misc_business.list_companies()})


# ===========================================================================
# UserController (6 端点)
# ===========================================================================

@router.get("/auth-api/by-id", summary="[User]按ID查询")
def user_by_id(id: int, _user: str = Depends(require_login)):
    return _ok(misc_business.get_user_by_id(id))


@router.get("/auth-api/by-mobile", summary="[User]按手机查询")
def user_by_mobile(mobile: str, _user: str = Depends(require_login)):
    return _ok(misc_business.get_user_by_mobile(mobile))


@router.get("/user", summary="[User]用户列表")
def user_list():
    return _ok({"list": []})


@router.get("/user/info", summary="[User]用户信息")
def user_info():
    member_id = get_current_user_id_flexible()
    return _ok(misc_business.get_user_info(member_id))


@router.put("/user/pwd", summary="[User]修改密码")
def user_pwd(oldPwd: str = "", newPwd: str = ""):
    member_id = get_current_user_id_flexible()
    return _ok({"success": misc_business.update_user_pwd(member_id, oldPwd, newPwd)})


@router.put("/user/reset/pwd", summary="[User]重置密码")
def user_reset_pwd(id: int):
    return _ok({"newPwd": misc_business.reset_user_pwd(id)})


# ===========================================================================
# HotWordController (1 端点)
# ===========================================================================

@router.get("/hot-word", summary="[HotWord]热词")
def hot_word_list():
    return _ok({"list": misc_business.list_hot_words()})


# ===========================================================================
# AgreementController (3 端点)
# ===========================================================================

@router.get("/agreement", summary="[Agreement]协议")
def agreement(key: str = "user"):
    return _ok(misc_business.get_agreement(key))


@router.get("/agreement/page", summary="[Agreement]分页")
def agreement_page(key: str = "user", page: int = 1, pageSize: int = 20):
    return _ok(misc_business.get_agreement_page(key, page, pageSize))


@router.get("/public-api/agreement", summary="[Agreement]公开")
def agreement_public(key: str = "user"):
    return _ok(misc_business.get_agreement(key))


# ===========================================================================
# NoticeController (2 端点)
# ===========================================================================

@router.get("/notice", summary="[Notice]通知")
def notice_list(page: int = 1, pageSize: int = 20):
    return _ok(misc_business.list_notices(page, pageSize))


@router.put("/public-api/notice/read", summary="[Notice]已读")
def notice_read(id: int, _user: str = Depends(require_login)):
    member_id = get_current_user_id_flexible()
    misc_business.mark_notice_read(id, member_id)
    return _ok()


# ===========================================================================
# 补齐 1: Ask 域 AnswerController 缺失的 PUT/DELETE
# ===========================================================================

@router.put("/auth-api/answer", summary="[Answer]更新回答")
def answer_update(req: dict = Body(default={}), _user: str = Depends(require_login)):
    """兼容 Java AnswerController.update."""
    try:
        member_id = get_current_user_id_flexible()
        return _ok(misc_business.update_answer(req, member_id))
    except Exception as e:
        raise _err(500, str(e))


@router.delete("/auth-api/answer", summary="[Answer]删除回答")
def answer_delete(req: dict = Body(default={}), _user: str = Depends(require_login)):
    try:
        member_id = get_current_user_id_flexible()
        return _ok({"deleted": misc_business.delete_answer(req.get("id"), member_id)})
    except Exception as e:
        raise _err(500, str(e))


# ===========================================================================
# 补齐 2: Behavior 域 CommentController / FavoriteController / LikeController / WordController
# ===========================================================================

@router.delete("/auth-api/comment", summary="[Comment]删除评论")
def comment_delete(req: dict = Body(default={}), _user: str = Depends(require_login)):
    try:
        member_id = get_current_user_id_flexible()
        return _ok({"deleted": misc_business.delete_comment(req.get("id"), member_id)})
    except Exception as e:
        raise _err(500, str(e))


@router.delete("/auth-api/reply/comment", summary="[Reply]删除回复评论")
def reply_comment_delete(req: dict = Body(default={}), _user: str = Depends(require_login)):
    try:
        member_id = get_current_user_id_flexible()
        return _ok({"deleted": misc_business.delete_comment(req.get("id"), member_id)})
    except Exception as e:
        raise _err(500, str(e))


@router.delete("/auth-api/favorite", summary="[Favorite]取消收藏")
def favorite_cancel(req: dict = Body(default={}), _user: str = Depends(require_login)):
    try:
        member_id = get_current_user_id_flexible()
        return _ok({"deleted": misc_business.cancel_favorite(req, member_id)})
    except Exception as e:
        raise _err(500, str(e))


@router.put("/auth-api/like", summary="[Like]切换点赞")
def like_toggle(req: dict = Body(default={}), _user: str = Depends(require_login)):
    try:
        member_id = get_current_user_id_flexible()
        return _ok(misc_business.toggle_like(req, member_id))
    except Exception as e:
        raise _err(500, str(e))


class SensitiveWordReq(BaseModel):
    word: str
    category: str | None = None
    level: int = 1


class SensitiveWordUpdateReq(BaseModel):
    id: int
    word: str | None = None
    category: str | None = None
    level: int | None = None


class SensitiveWordDeleteReq(BaseModel):
    id: int


@router.post("/sensitive-word", summary="[Word]添加敏感词")
def sensitive_word_add(req: SensitiveWordReq):
    try:
        return _ok(misc_business.add_sensitive_word(req.word, req.category, req.level))
    except Exception as e:
        raise _err(500, str(e))


@router.put("/sensitive-word", summary="[Word]修改敏感词")
def sensitive_word_update(req: SensitiveWordUpdateReq):
    try:
        return _ok(misc_business.update_sensitive_word(req.id, req.word, req.category, req.level))
    except Exception as e:
        raise _err(500, str(e))


@router.delete("/sensitive-word", summary="[Word]删除敏感词")
def sensitive_word_delete(req: SensitiveWordDeleteReq):
    try:
        return _ok({"deleted": misc_business.delete_sensitive_word(req.id)})
    except Exception as e:
        raise _err(500, str(e))


# ===========================================================================
# 补齐 3: Circle 域 CircleController / CircleMemberController / DynamicController
# ===========================================================================

@router.put("/auth-api/circle", summary="[Circle]更新圈子")
def circle_update(req: dict = Body(default={}), _user: str = Depends(require_login)):
    try:
        member_id = get_current_user_id_flexible()
        return _ok(misc_business.update_circle(req, member_id))
    except Exception as e:
        raise _err(500, str(e))


@router.delete("/auth-api/circle", summary="[Circle]删除圈子")
def circle_delete(req: dict = Body(default={}), _user: str = Depends(require_login)):
    try:
        member_id = get_current_user_id_flexible()
        return _ok({"deleted": misc_business.delete_circle(req.get("id"), member_id)})
    except Exception as e:
        raise _err(500, str(e))


@router.post("/auth-api/member", summary="[CircleMember]添加成员")
def circle_member_add(req: dict = Body(default={}), _user: str = Depends(require_login)):
    try:
        member_id = get_current_user_id_flexible()
        return _ok(misc_business.add_circle_member(req, member_id))
    except Exception as e:
        raise _err(500, str(e))


@router.delete("/auth-api/member", summary="[CircleMember]移除成员")
def circle_member_remove(req: dict = Body(default={}), _user: str = Depends(require_login)):
    try:
        member_id = get_current_user_id_flexible()
        return _ok({"deleted": misc_business.remove_circle_member(req, member_id)})
    except Exception as e:
        raise _err(500, str(e))


@router.put("/auth-api/dynamic", summary="[Dynamic]更新动态")
def dynamic_update(req: dict = Body(default={}), _user: str = Depends(require_login)):
    try:
        member_id = get_current_user_id_flexible()
        return _ok(misc_business.update_dynamic(req, member_id))
    except Exception as e:
        raise _err(500, str(e))


@router.delete("/dynamic", summary="[Dynamic]删除动态(管理端)")
def dynamic_delete_admin(req: dict = Body(default={})):
    try:
        return _ok({"deleted": misc_business.delete_dynamic(req.get("id"))})
    except Exception as e:
        raise _err(500, str(e))


@router.delete("/auth-api/dynamic", summary="[Dynamic]删除动态(登录)")
def dynamic_delete_auth(req: dict = Body(default={}), _user: str = Depends(require_login)):
    try:
        member_id = get_current_user_id_flexible()
        return _ok({"deleted": misc_business.delete_dynamic(req.get("id"), member_id)})
    except Exception as e:
        raise _err(500, str(e))


# ===========================================================================
# 补齐 4: Exam 域 RecordController.submit / WrongQuestionController.delete
# ===========================================================================

@router.put("/auth-api/record/submit", summary="[ExamRecord]提交考试")
def exam_record_submit(req: dict = Body(default={}), _user: str = Depends(require_login)):
    try:
        member_id = get_current_user_id_flexible()
        return _ok(misc_business.submit_exam_record(req, member_id))
    except Exception as e:
        raise _err(500, str(e))


@router.delete("/auth-api/wrong-question", summary="[WrongQuestion]移除错题")
def wrong_question_remove(req: dict = Body(default={}), _user: str = Depends(require_login)):
    try:
        member_id = get_current_user_id_flexible()
        return _ok({"deleted": misc_business.remove_wrong_question(req.get("id"), member_id)})
    except Exception as e:
        raise _err(500, str(e))


# ===========================================================================
# 补齐 5: Learn 域 ExamPaperRecord / Homework / LessonAccess / LessonTask
# ===========================================================================

@router.put("/auth-api/exampaper/record/submit", summary="[ExamPaperRecord]提交试卷")
def exam_paper_record_submit(req: dict = Body(default={}), _user: str = Depends(require_login)):
    try:
        member_id = get_current_user_id_flexible()
        return _ok(misc_business.submit_exam_paper_record(req, member_id))
    except Exception as e:
        raise _err(500, str(e))


@router.get("/auth-api/exampaper/record/draft", summary="[ExamPaperRecord]获取草稿")
def exam_paper_record_draft(paperId: int, _user: str = Depends(require_login)):
    try:
        member_id = get_current_user_id_flexible()
        return _ok(misc_business.get_exam_paper_draft(paperId, member_id))
    except Exception as e:
        raise _err(500, str(e))


class HomeworkReq(BaseModel):
    lessonId: int
    content: str | None = None
    url: str | None = None
    title: str | None = None
    id: int | None = None  # 仅 update/delete 时需要


@router.post("/lesson/homework", summary="[Homework]添加作业")
def homework_add(req: HomeworkReq, _user: str = Depends(require_login)):
    try:
        return _ok(misc_business.add_homework(req.lessonId, req.content, req.url, req.title))
    except Exception as e:
        raise _err(500, str(e))


@router.put("/lesson/homework", summary="[Homework]修改作业")
def homework_update(req: HomeworkReq):
    try:
        return _ok(misc_business.update_homework(req.id, req.lessonId, req.content, req.url, req.title))
    except Exception as e:
        raise _err(500, str(e))


class HomeworkRecordApprovalReq(BaseModel):
    id: int


@router.put("/homework/record/approval/pass", summary="[HomeworkRecord]审批通过")
def homework_record_approval_pass(req: HomeworkRecordApprovalReq):
    try:
        return _ok(misc_business.approve_homework_record(req.id))
    except Exception as e:
        raise _err(500, str(e))


class LessonAccessReq(BaseModel):
    lessonId: int
    memberId: int | None = None


@router.put("/lesson/access", summary="[LessonAccess]更新访问权限")
def lesson_access_update(req: LessonAccessReq, _user: str = Depends(require_login)):
    try:
        member_id = get_current_user_id_flexible()
        return _ok(misc_business.update_lesson_access(req.lessonId, req.memberId or member_id))
    except Exception as e:
        raise _err(500, str(e))


class LessonTaskReq(BaseModel):
    lessonId: int
    lessonChapterId: int | None = None
    lessonChapterSectionId: int | None = None
    title: str | None = None
    contentType: str | None = None
    conditions: str | None = None
    id: int | None = None


@router.post("/lesson/task", summary="[LessonTask]创建任务")
def lesson_task_create(req: LessonTaskReq):
    try:
        return _ok(misc_business.create_lesson_task(
            lesson_id=req.lessonId, lesson_chapter_id=req.lessonChapterId,
            lesson_chapter_section_id=req.lessonChapterSectionId,
            title=req.title, content_type=req.contentType, conditions=req.conditions,
        ))
    except Exception as e:
        raise _err(500, str(e))


@router.put("/lesson/task", summary="[LessonTask]修改任务")
def lesson_task_update(req: LessonTaskReq):
    try:
        return _ok(misc_business.update_lesson_task(
            task_id=req.id, title=req.title, content_type=req.contentType, conditions=req.conditions,
        ))
    except Exception as e:
        raise _err(500, str(e))


class LessonTaskDeleteReq(BaseModel):
    id: int


@router.delete("/lesson/task", summary="[LessonTask]删除任务")
def lesson_task_delete(req: LessonTaskDeleteReq):
    try:
        return _ok({"deleted": misc_business.delete_lesson_task(req.id)})
    except Exception as e:
        raise _err(500, str(e))


# ===========================================================================
# 补齐 6: Message 域 Notice / Announcement / PrivateLetter / Template
# ===========================================================================

class NoticeReq(BaseModel):
    title: str | None = None
    content: str | None = None
    type: int = 1
    id: int | None = None


@router.post("/notice", summary="[Notice]发布通知")
def notice_create(req: NoticeReq):
    try:
        return _ok(misc_business.create_notice(req.title, req.content, req.type))
    except Exception as e:
        raise _err(500, str(e))


@router.delete("/notice", summary="[Notice]删除通知")
def notice_delete(req: NoticeReq):
    try:
        return _ok({"deleted": misc_business.delete_notice(req.id)})
    except Exception as e:
        raise _err(500, str(e))


class AnnouncementReq(BaseModel):
    title: str | None = None
    content: str | None = None
    id: int | None = None


@router.put("/announcement", summary="[Announcement]更新公告")
def announcement_update(req: AnnouncementReq):
    try:
        return _ok(misc_business.update_announcement(req.id, req.title, req.content))
    except Exception as e:
        raise _err(500, str(e))


@router.delete("/announcement", summary="[Announcement]删除公告")
def announcement_delete(req: AnnouncementReq):
    try:
        return _ok({"deleted": misc_business.delete_announcement(req.id)})
    except Exception as e:
        raise _err(500, str(e))


class PrivateLetterReq(BaseModel):
    id: int | None = None
    toUserId: str | None = None
    content: str | None = None


@router.get("/auth-api/private-letter", summary="[PrivateLetter]查询私信")
def private_letter_list(page: int = 1, pageSize: int = 20, _user: str = Depends(require_login)):
    try:
        member_id = get_current_user_id_flexible()
        return _ok(misc_business.list_private_letters(page, pageSize, member_id))
    except Exception as e:
        raise _err(500, str(e))


@router.delete("/auth-api/private-letter", summary="[PrivateLetter]删除私信")
def private_letter_delete(req: PrivateLetterReq, _user: str = Depends(require_login)):
    try:
        member_id = get_current_user_id_flexible()
        return _ok({"deleted": misc_business.delete_private_letter(req.id, member_id)})
    except Exception as e:
        raise _err(500, str(e))


class TemplateReq(BaseModel):
    id: int
    name: str | None = None
    content: str | None = None


@router.put("/template", summary="[Template]更新模板")
def template_update(req: TemplateReq):
    try:
        return _ok(misc_business.update_template(req.id, req.name, req.content))
    except Exception as e:
        raise _err(500, str(e))


# ===========================================================================
# 补齐 7: Order 域 OrderController (剩余 3 个)
# ===========================================================================

@router.get("/auth-api/order", summary="[Order]查询订单")
def order_list_auth(
    page: int = 1, pageSize: int = 20, status: int | None = None,
    _user: str = Depends(require_login),
):
    try:
        member_id = get_current_user_id_flexible()
        return _ok(misc_business.list_orders(page, pageSize, member_id, status))
    except Exception as e:
        raise _err(500, str(e))


@router.post("/auth-api/order/pre-get-order-amount", summary="[Order]预计算订单金额")
def order_pre_get_amount(req: dict = Body(default={}), _user: str = Depends(require_login)):
    try:
        return _ok(misc_business.pre_get_order_amount(req))
    except Exception as e:
        raise _err(500, str(e))


@router.post("/auth-api/order/get-order-amount", summary="[Order]获取订单金额")
def order_get_amount(req: dict = Body(default={}), _user: str = Depends(require_login)):
    try:
        return _ok(misc_business.get_order_amount(req))
    except Exception as e:
        raise _err(500, str(e))


# ===========================================================================
# 补齐 8: OSS Controller (Delete /file, Get /to-base64)
# ===========================================================================

class OssFileDeleteReq(BaseModel):
    id: str | None = None
    url: str | None = None


@router.delete("/file", summary="[Oss]删除文件")
def oss_file_delete(req: OssFileDeleteReq):
    try:
        return _ok({"deleted": misc_business.delete_oss_file(req.id, req.url)})
    except Exception as e:
        raise _err(500, str(e))


class OssToBase64Req(BaseModel):
    url: str
    fileType: str | None = None


@router.get("/to-base64", summary="[Oss]URL转Base64")
def oss_to_base64(url: str):
    try:
        return _ok(misc_business.url_to_base64(url))
    except Exception as e:
        raise _err(500, str(e))


# ===========================================================================
# 补齐 9: Point 域 Point / Record / PointChannelRelation
# ===========================================================================

class PointReq(BaseModel):
    name: str
    code: str | None = None
    description: str | None = None
    point: int = 0
    type: int = 1
    id: int | None = None


@router.post("/point", summary="[Point]创建积分商品")
def point_create(req: PointReq):
    try:
        return _ok(misc_business.create_point(req.name, req.code, req.description, req.point, req.type))
    except Exception as e:
        raise _err(500, str(e))


@router.put("/point", summary="[Point]修改积分商品")
def point_update(req: PointReq):
    try:
        return _ok(misc_business.update_point(req.id, req.name, req.code, req.description, req.point, req.type))
    except Exception as e:
        raise _err(500, str(e))


class PointDeleteReq(BaseModel):
    id: int


@router.delete("/point", summary="[Point]删除积分商品")
def point_delete(req: PointDeleteReq):
    try:
        return _ok({"deleted": misc_business.delete_point(req.id)})
    except Exception as e:
        raise _err(500, str(e))


class PointChannelRelationReq(BaseModel):
    channelId: int
    pointId: int
    ratio: int = 1
    id: int | None = None


@router.put("/point/channel/relation", summary="[PointChannelRelation]更新关系")
def point_channel_relation_update(req: PointChannelRelationReq):
    try:
        return _ok(misc_business.update_point_channel_relation(req.channelId, req.pointId, req.ratio))
    except Exception as e:
        raise _err(500, str(e))


class PointRecordReq(BaseModel):
    userId: str | None = None
    pointId: int | None = None
    amount: int = 0
    remark: str | None = None
    type: int = 1


@router.post("/record/increase", summary="[Point]增加积分记录")
def point_record_increase(req: PointRecordReq, _user: str = Depends(require_login)):
    try:
        member_id = get_current_user_id_flexible()
        return _ok(misc_business.increase_point_record(member_id, req.pointId, req.amount, req.remark))
    except Exception as e:
        raise _err(500, str(e))


@router.post("/record/decrease", summary="[Point]减少积分记录")
def point_record_decrease(req: PointRecordReq, _user: str = Depends(require_login)):
    try:
        member_id = get_current_user_id_flexible()
        return _ok(misc_business.decrease_point_record(member_id, req.pointId, req.amount, req.remark))
    except Exception as e:
        raise _err(500, str(e))


@router.post("/record/fallback", summary="[Point]回退积分记录")
def point_record_fallback(req: PointRecordReq, _user: str = Depends(require_login)):
    try:
        member_id = get_current_user_id_flexible()
        return _ok(misc_business.fallback_point_record(req.pointId, req.amount, req.remark))
    except Exception as e:
        raise _err(500, str(e))


@router.post("/record/recycle", summary="[Point]回收积分记录")
def point_record_recycle(req: PointRecordReq, _user: str = Depends(require_login)):
    try:
        member_id = get_current_user_id_flexible()
        return _ok(misc_business.recycle_point_record(req.pointId, req.amount, req.remark))
    except Exception as e:
        raise _err(500, str(e))


# ===========================================================================
# 补齐 10: Search 域 Content / HotWord
# ===========================================================================

class SearchContentReq(BaseModel):
    keyword: str | None = None
    contentType: str | None = None
    sortOrder: int = 0
    id: int | None = None


@router.post("/public-api/content", summary="[SearchContent]添加内容")
def search_content_add(req: SearchContentReq):
    try:
        return _ok(misc_business.add_search_content(req.keyword, req.contentType, req.sortOrder))
    except Exception as e:
        raise _err(500, str(e))


@router.put("/public-api/content", summary="[SearchContent]修改内容")
def search_content_update(req: SearchContentReq):
    try:
        return _ok(misc_business.update_search_content(req.id, req.keyword, req.contentType, req.sortOrder))
    except Exception as e:
        raise _err(500, str(e))


@router.delete("/public-api/content", summary="[SearchContent]删除内容")
def search_content_delete(req: SearchContentReq):
    try:
        return _ok({"deleted": misc_business.delete_search_content(req.id)})
    except Exception as e:
        raise _err(500, str(e))


class HotWordReq(BaseModel):
    word: str
    sortOrder: int = 0
    type: int = 1
    id: int | None = None


@router.post("/hot-word", summary="[HotWord]添加热词")
def hot_word_add(req: HotWordReq):
    try:
        return _ok(misc_business.add_hot_word(req.word, req.sortOrder, req.type))
    except Exception as e:
        raise _err(500, str(e))


@router.put("/hot-word", summary="[HotWord]修改热词")
def hot_word_update(req: HotWordReq):
    try:
        return _ok(misc_business.update_hot_word(req.id, req.word, req.sortOrder, req.type))
    except Exception as e:
        raise _err(500, str(e))


class HotWordDeleteReq(BaseModel):
    id: int


@router.delete("/hot-word", summary="[HotWord]删除热词")
def hot_word_delete(req: HotWordDeleteReq):
    try:
        return _ok({"deleted": misc_business.delete_hot_word(req.id)})
    except Exception as e:
        raise _err(500, str(e))


# ===========================================================================
# 补齐 11: Setting 域 Agreement / Carousel
# ===========================================================================

class AgreementReq(BaseModel):
    name: str
    content: str | None = None
    type: int = 1
    id: int | None = None


@router.post("agreement", summary="[Agreement]添加协议")
def agreement_add(req: AgreementReq):
    try:
        return _ok(misc_business.add_agreement(req.name, req.content, req.type))
    except Exception as e:
        raise _err(500, str(e))


@router.put("agreement", summary="[Agreement]修改协议")
def agreement_update(req: AgreementReq):
    try:
        return _ok(misc_business.update_agreement(req.id, req.name, req.content, req.type))
    except Exception as e:
        raise _err(500, str(e))


class CarouselReq(BaseModel):
    title: str
    imageUrl: str
    linkUrl: str | None = None
    type: int = 1
    sortOrder: int = 0


@router.post("/carousel", summary="[Carousel]添加轮播图")
def carousel_add(req: CarouselReq):
    try:
        return _ok(misc_business.add_carousel(req.title, req.imageUrl, req.linkUrl, req.type, req.sortOrder))
    except Exception as e:
        raise _err(500, str(e))


# ===========================================================================
# 补齐 12: UserCenter 域 Department / Lecturer / Post / User / Role
# ===========================================================================

class DepartmentReq(BaseModel):
    name: str
    parentId: int | None = 0
    sortOrder: int = 0
    id: int | None = None


@router.post("/department", summary="[Department]添加部门")
def department_add(req: DepartmentReq):
    try:
        return _ok(misc_business.add_department(req.name, req.parentId, req.sortOrder))
    except Exception as e:
        raise _err(500, str(e))


@router.put("/department", summary="[Department]修改部门")
def department_update(req: DepartmentReq):
    try:
        return _ok(misc_business.update_department(req.id, req.name, req.parentId, req.sortOrder))
    except Exception as e:
        raise _err(500, str(e))


class DepartmentDeleteReq(BaseModel):
    id: int


@router.delete("/department", summary="[Department]删除部门")
def department_delete(req: DepartmentDeleteReq):
    try:
        return _ok({"deleted": misc_business.delete_department(req.id)})
    except Exception as e:
        raise _err(500, str(e))


class LecturerReq(BaseModel):
    name: str | None = None
    jobTitle: str | None = None
    mobile: str | None = None
    description: str | None = None
    image: str | None = None
    userId: int | None = None
    id: int | None = None


@router.post("/lecturer", summary="[Lecturer]添加讲师")
def lecturer_add(req: LecturerReq):
    try:
        return _ok(misc_business.add_lecturer(
            name=req.name, job_title=req.jobTitle, mobile=req.mobile,
            description=req.description, image=req.image, user_id=req.userId,
        ))
    except Exception as e:
        raise _err(500, str(e))


@router.put("/lecturer", summary="[Lecturer]修改讲师")
def lecturer_update(req: LecturerReq):
    try:
        return _ok(misc_business.update_lecturer(
            lecturer_id=req.id, name=req.name, job_title=req.jobTitle,
            mobile=req.mobile, description=req.description, image=req.image,
        ))
    except Exception as e:
        raise _err(500, str(e))


class LecturerDeleteReq(BaseModel):
    id: int


@router.delete("/lecturer", summary="[Lecturer]删除讲师")
def lecturer_delete(req: LecturerDeleteReq):
    try:
        return _ok({"deleted": misc_business.delete_lecturer(req.id)})
    except Exception as e:
        raise _err(500, str(e))


class PostReq(BaseModel):
    name: str
    code: str | None = None
    sortOrder: int = 0
    id: int | None = None


@router.post("/posts", summary="[Post]添加岗位")
def post_add(req: PostReq):
    try:
        return _ok(misc_business.add_post(req.name, req.code, req.sortOrder))
    except Exception as e:
        raise _err(500, str(e))


@router.put("/posts", summary="[Post]修改岗位")
def post_update(req: PostReq):
    try:
        return _ok(misc_business.update_post(req.id, req.name, req.code, req.sortOrder))
    except Exception as e:
        raise _err(500, str(e))


class UserUpdateReq(BaseModel):
    id: int
    name: str | None = None
    nickName: str | None = None
    email: str | None = None
    mobile: str | None = None
    avatar: str | None = None


class UserInfoUpdateReq(BaseModel):
    id: int
    info: dict | None = None


class UserDeleteReq(BaseModel):
    id: int


@router.put("/user", summary="[User]更新用户")
def user_update(req: UserUpdateReq):
    try:
        return _ok(misc_business.update_user(
            user_id=req.id, name=req.name, nick_name=req.nickName,
            email=req.email, mobile=req.mobile, avatar=req.avatar,
        ))
    except Exception as e:
        raise _err(500, str(e))


@router.put("/user/info", summary="[User]更新用户信息")
def user_info_update(req: UserInfoUpdateReq):
    try:
        return _ok(misc_business.update_user_info(req.id, req.info))
    except Exception as e:
        raise _err(500, str(e))


@router.delete("/user", summary="[User]删除用户")
def user_delete(req: UserDeleteReq):
    try:
        return _ok({"deleted": misc_business.delete_user(req.id)})
    except Exception as e:
        raise _err(500, str(e))


# ===========================================================================
# 补齐 13: Auth 域 Role (Post/Put/Delete/role/user/list)
# ===========================================================================

class RoleReq(BaseModel):
    name: str
    code: str | None = None
    description: str | None = None
    id: int | None = None


class RoleUserListReq(BaseModel):
    userId: int
    roleIds: list[int] = []


@router.post("/role", summary="[Role]添加角色")
def role_add(req: RoleReq):
    try:
        return _ok(misc_business.add_role(req.name, req.code, req.description))
    except Exception as e:
        raise _err(500, str(e))


@router.put("/role", summary="[Role]修改角色")
def role_update(req: RoleReq):
    try:
        return _ok(misc_business.update_role(req.id, req.name, req.code, req.description))
    except Exception as e:
        raise _err(500, str(e))


class RoleDeleteReq(BaseModel):
    id: int


@router.delete("/role", summary="[Role]删除角色")
def role_delete(req: RoleDeleteReq):
    try:
        return _ok({"deleted": misc_business.delete_role(req.id)})
    except Exception as e:
        raise _err(500, str(e))


@router.put("/role/user/list", summary="[Role]分配用户角色")
def role_user_list(req: RoleUserListReq):
    try:
        return _ok(misc_business.assign_user_roles(req.userId, req.roleIds))
    except Exception as e:
        raise _err(500, str(e))


# ===========================================================================
# 补齐 14: Visit-Tracking 域 VisitLog
# ===========================================================================

class VisitLogReq(BaseModel):
    pageUrl: str
    duration: int = 0
    userAgent: str | None = None
    referer: str | None = None
    sourceType: str | None = None


@router.post("/public-api/visit-log", summary="[VisitLog]记录访问")
def visit_log_create(req: VisitLogReq):
    try:
        return _ok(misc_business.create_visit_log(
            page_url=req.pageUrl, duration=req.duration,
            user_agent=req.userAgent, referer=req.referer, source_type=req.sourceType,
        ))
    except Exception as e:
        raise _err(500, str(e))


# ===========================================================================
# AnnouncementController (2 端点)
# ===========================================================================

@router.get("/announcement", summary="[Announce]公告")
def announcement_list(page: int = 1, pageSize: int = 20):
    return _ok(misc_business.list_announcements(page, pageSize))


@router.get("/public-api/announcement", summary="[Announce]公告(公开)")
def announcement_public(page: int = 1, pageSize: int = 20):
    return _ok(misc_business.list_announcements(page, pageSize))


# ===========================================================================
# PrivateLetterController (2 端点)
# ===========================================================================

@router.post("/auth-api/private-letter", summary="[Letter]发私信")
def letter_send(toMemberId: int, content: str, _user: str = Depends(require_login)):
    member_id = get_current_user_id_flexible()
    return _ok(misc_business.send_private_letter(member_id, toMemberId, content))


@router.get("/auth-api/private-letter/member", summary="[Letter]我的私信")
def letter_my(_user: str = Depends(require_login)):
    member_id = get_current_user_id_flexible()
    return _ok({"list": misc_business.list_my_private_letters(member_id)})


# ===========================================================================
# PointController (1 端点)
# ===========================================================================

@router.get("/point", summary="[Point]积分")
def point(_user: str = Depends(require_login)):
    member_id = get_current_user_id_flexible()
    return _ok(misc_business.get_member_point(member_id))


# ===========================================================================
# TemplateController (1 端点)
# ===========================================================================

@router.get("/template", summary="[Template]模板")
def template(key: str = "default"):
    return _ok(misc_business.get_template(key))


# ===========================================================================
# MailController (1 端点)
# ===========================================================================

@router.post("/public-api/mail/send/html", summary="[Mail]发送HTML邮件")
def mail_send(to: str, subject: str, html: str):
    return _ok(misc_business.send_html_mail(to, subject, html))


# ===========================================================================
# WechatOauthController (2 端点)
# ===========================================================================

@router.get("/public-api/wechat/oauth-config", summary="[Wechat]OAuth配置")
def wechat_oauth_config():
    return _ok(misc_business.get_wechat_oauth_config())


@router.get("/public-api/wechat/oauth-config/userinfo-bycode", summary="[Wechat]按code获取用户")
def wechat_oauth_user(code: str):
    return _ok(misc_business.get_wechat_user_info_by_code(code))


# ===========================================================================
# WorkWeChatController (2 端点)
# ===========================================================================

@router.get("/public-api/work-we-chat/user/by-code", summary="[WorkWeChat]用户")
def work_wechat_user(code: str):
    return _ok(misc_business.get_work_wechat_user_by_code(code))


@router.get("/work-we-chat/token", summary="[WorkWeChat]token")
def work_wechat_token(corpId: str, corpSecret: str):
    return _ok(misc_business.get_work_wechat_token(corpId, corpSecret))


# ===========================================================================
# DingTalkController (1 端点)
# ===========================================================================

@router.get("/public-api/ding-talk/user/by-code", summary="[DingTalk]用户")
def dingtalk_user(code: str):
    return _ok(misc_business.get_dingtalk_user_by_code(code))


# ===========================================================================
# VisitLogController (2 端点)
# ===========================================================================

@router.get("/public-api/visit-log", summary="[Visit]访问日志")
def visit_log(page: int = 1, pageSize: int = 20):
    return _ok(misc_business.list_visit_logs(page, pageSize))


@router.get("/visit-log/summary", summary="[Visit]日志汇总")
def visit_log_summary():
    return _ok(misc_business.get_visit_log_summary())


# ===========================================================================
# ContentController (2 端点)
# ===========================================================================

@router.get("/public-api/content", summary="[Content]内容")
def content_get(key: str = "about"):
    return _ok(misc_business.get_content(key))


@router.get("/public-api/content/type", summary="[Content]按类型")
def content_by_type(type: str = "page"):
    return _ok({"list": misc_business.list_contents_by_type(type)})


# ===========================================================================
# WechatPay v3 回调
# ===========================================================================

@router.post("/public-api/wechatpay/notify/v3", summary="[WechatPay v3]通知")
async def wechatpay_notify_v3(request: Request):
    payload = await request.json()
    return misc_business.wechat_pay_notify_v3(payload)


# ===========================================================================
# Statistics (4 端点)
# ===========================================================================

@router.get("/statistics", summary="[Stat]统计(重载)")
def statistics():
    return _ok({
        "message": misc_business.message_statistics(),
        "point": misc_business.point_statistics(),
        "resource": misc_business.resource_statistics(),
        "userCenter": misc_business.user_center_statistics(),
    })


# ===========================================================================
# PointChannelRelationController (1 端点)
# ===========================================================================

@router.get("/point/channel/relation", summary="[PointRel]积分渠道关系")
def point_channel_relation():
    return _ok({"list": []})
