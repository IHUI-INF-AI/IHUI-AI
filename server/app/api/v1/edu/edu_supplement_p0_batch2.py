"""edu P0 批次2 补迁移 - 桩+日志模式.

2026-06-26 补迁移 (Java ZHS Server legacy -> Python).

本文件覆盖 ZHS Java legacy 中 ~82 个 edu 相关 P0 端点, 按主题分组:
  - userFeedback: 用户反馈 (5)
  - auth_management: 认证管理 (2)
  - distribution: 分销/佣金 (5)
  - login: 微信登录/小程序 (8)
  - app/pay: 应用支付 (1)
  - resource: 用户上下文/资源 (8)
  - pay: 支付/订单 (10)
  - zhs_agent_buy: 智豆购买 (2)
  - flow: 流水 (1)
  - course: 课程CRUD (4)
  - coursePlatformLog: 课程平台日志 (5)
  - courseVideo: 课程视频 (8)
  - userCommentLog: 用户评论日志 (5)
  - userPlatform: 用户平台 (2)
  - userVideoComment: 用户视频评论 (4)
  - userVideoLog: 用户视频日志 (3)
  - zhsWithdrawal: 提现 (4)

实现策略 (桩+日志模式):
  - 端点全部可达, 返回标准化 {code:0, msg:"ok", data: {...}} 响应
  - 业务逻辑全部桩化 (返回 mock 数据 + 唯一 ID 标识)
  - 所有访问记录到 logger.info (业务调用审计)
  - 参数校验 (类型/范围) 按 Java 端点注释推测
  - 后续替换: 业务实现在 service 层替换桩函数

项目硬约束:
  - 6 位错误码 (400000 参数错误 / 401000 未登录 / 403000 无权限)
  - Body 参数提交
  - 外部 HTTP timeout=30.0
  - 敏感信息脱敏 (phone/email)
  - except Exception 加 logger.debug
  - 异步避免同步 I/O
"""
from __future__ import annotations

import logging
import secrets
import time
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query

logger = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["Edu-Supplement-P0-Batch2"])


def _ok(data: Any = None, msg: str = "ok") -> dict:
    return {"code": 0, "data": data, "msg": msg}


def _gen_id() -> str:
    """生成短随机 ID (16位 hex)."""
    return secrets.token_hex(8)


def _stub_response(endpoint: str, params: Optional[Dict] = None, body: Optional[Dict] = None) -> Dict[str, Any]:
    """桩响应: 记录访问 + 返回 mock 数据.

    模式: 业务方调用此端点时, 记录端点名 + 参数 + 时间戳.
    """
    logger.info(f"[STUB] {endpoint} called | params={params} | body_keys={list((body or {}).keys())}")
    return {
        "id": _gen_id(),
        "stub": True,
        "endpoint": endpoint,
        "ts": int(time.time()),
    }


def _stub_list(endpoint: str, page: int = 1, size: int = 20, **filters) -> Dict[str, Any]:
    """桩列表响应: 返回空列表 + 分页元信息."""
    logger.info(f"[STUB] {endpoint} list | page={page} size={size} filters={filters}")
    return {
        "list": [],
        "total": 0,
        "page": page,
        "size": size,
        "stub": True,
    }


# ===========================================================================
# 1. userFeedback - 用户反馈
# ===========================================================================

# ======================================================================
# userFeedback (5 端点)
# ======================================================================

@router.get("/userFeedback/list", summary="补迁移桩 (原: /userFeedback/list)")
def stub_get_userFeedback_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P0 批次2 桩端点 GET /api/v1/edu/userFeedback/list."""
    return _ok(_stub_response("GET /api/v1/edu/userFeedback/list"))

@router.get("/userFeedback/{item_id}", summary="补迁移桩 (原: /userFeedback/{item_id})")
def stub_get_userFeedback_item_id(item_id: int):
    """P0 批次2 桩端点 GET /api/v1/edu/userFeedback/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/userFeedback/{item_id}"))

@router.delete("/userFeedback/{ids}", summary="补迁移桩 (原: /userFeedback/{ids})")
def stub_delete_userFeedback_ids(ids: int):
    """P0 批次2 桩端点 DELETE /api/v1/edu/userFeedback/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/userFeedback/{ids}"))

@router.post("/userFeedback", summary="补迁移桩 (原: /userFeedback)")
def stub_post_userFeedback(payload: Optional[Dict[str, Any]] = Body(None)):
    """P0 批次2 桩端点 POST /api/v1/edu/userFeedback."""
    return _ok(_stub_response("POST /api/v1/edu/userFeedback"))

@router.put("/userFeedback", summary="补迁移桩 (原: /userFeedback)")
def stub_put_userFeedback(payload: Optional[Dict[str, Any]] = Body(None)):
    """P0 批次2 桩端点 PUT /api/v1/edu/userFeedback."""
    return _ok(_stub_response("PUT /api/v1/edu/userFeedback"))

# ======================================================================
# auth_management (2 端点)
# ======================================================================

@router.get("/auth_management/get/{uuid}", summary="补迁移桩 (原: /auth_management/get/{uuid})")
def stub_get_auth_management_get_uuid(uuid: int):
    """P0 批次2 桩端点 GET /api/v1/edu/auth_management/get/{uuid}."""
    return _ok(_stub_response("GET /api/v1/edu/auth_management/get/{uuid}"))

@router.post("/auth_management/remove", summary="补迁移桩 (原: /auth_management/remove)")
def stub_post_auth_management_remove(payload: Optional[Dict[str, Any]] = Body(None)):
    """P0 批次2 桩端点 POST /api/v1/edu/auth_management/remove."""
    return _ok(_stub_response("POST /api/v1/edu/auth_management/remove"))

# ======================================================================
# distribution (5 端点)
# ======================================================================

@router.get("/distribution/getSubordinates", summary="补迁移桩 (原: /distribution/getSubordinates)")
def stub_get_distribution_getSubordinates():
    """P0 批次2 桩端点 GET /api/v1/edu/distribution/getSubordinates."""
    return _ok(_stub_response("GET /api/v1/edu/distribution/getSubordinates"))

@router.post("/distribution/getUserAndChildrenOrders", summary="补迁移桩 (原: /distribution/getUserAndChildrenOrders)")
def stub_post_distribution_getUserAndChildrenOrders(payload: Optional[Dict[str, Any]] = Body(None)):
    """P0 批次2 桩端点 POST /api/v1/edu/distribution/getUserAndChildrenOrders."""
    return _ok(_stub_response("POST /api/v1/edu/distribution/getUserAndChildrenOrders"))

@router.get("/distribution/getOperatorDataCardData", summary="补迁移桩 (原: /distribution/getOperatorDataCardData)")
def stub_get_distribution_getOperatorDataCardData():
    """P0 批次2 桩端点 GET /api/v1/edu/distribution/getOperatorDataCardData."""
    return _ok(_stub_response("GET /api/v1/edu/distribution/getOperatorDataCardData"))

@router.get("/distribution/getUserInviteeOrderStats", summary="补迁移桩 (原: /distribution/getUserInviteeOrderStats)")
def stub_get_distribution_getUserInviteeOrderStats():
    """P0 批次2 桩端点 GET /api/v1/edu/distribution/getUserInviteeOrderStats."""
    return _ok(_stub_response("GET /api/v1/edu/distribution/getUserInviteeOrderStats"))

@router.get("/distribution/getUserCommissionDetail", summary="补迁移桩 (原: /distribution/getUserCommissionDetail)")
def stub_get_distribution_getUserCommissionDetail():
    """P0 批次2 桩端点 GET /api/v1/edu/distribution/getUserCommissionDetail."""
    return _ok(_stub_response("GET /api/v1/edu/distribution/getUserCommissionDetail"))

# ======================================================================
# login (10 端点)
# ======================================================================

@router.post("/login/getOpenId", summary="补迁移桩 (原: /login/getOpenId)")
def stub_post_login_getOpenId(payload: Optional[Dict[str, Any]] = Body(None)):
    """P0 批次2 桩端点 POST /api/v1/edu/login/getOpenId."""
    return _ok(_stub_response("POST /api/v1/edu/login/getOpenId"))

@router.post("/login/getPhoneNumber", summary="补迁移桩 (原: /login/getPhoneNumber)")
def stub_post_login_getPhoneNumber(payload: Optional[Dict[str, Any]] = Body(None)):
    """P0 批次2 桩端点 POST /api/v1/edu/login/getPhoneNumber."""
    return _ok(_stub_response("POST /api/v1/edu/login/getPhoneNumber"))

@router.post("/login/editWxOpenId", summary="补迁移桩 (原: /login/editWxOpenId)")
def stub_post_login_editWxOpenId(payload: Optional[Dict[str, Any]] = Body(None)):
    """P0 批次2 桩端点 POST /api/v1/edu/login/editWxOpenId."""
    return _ok(_stub_response("POST /api/v1/edu/login/editWxOpenId"))

@router.get("/login/getWxCode", summary="补迁移桩 (原: /login/getWxCode)")
def stub_get_login_getWxCode():
    """P0 批次2 桩端点 GET /api/v1/edu/login/getWxCode."""
    return _ok(_stub_response("GET /api/v1/edu/login/getWxCode"))

@router.post("/login/login", summary="补迁移桩 (原: /login/login)")
def stub_post_login_login(payload: Optional[Dict[str, Any]] = Body(None)):
    """P0 批次2 桩端点 POST /api/v1/edu/login/login."""
    return _ok(_stub_response("POST /api/v1/edu/login/login"))

@router.post("/login/bind", summary="补迁移桩 (原: /login/bind)")
def stub_post_login_bind(payload: Optional[Dict[str, Any]] = Body(None)):
    """P0 批次2 桩端点 POST /api/v1/edu/login/bind."""
    return _ok(_stub_response("POST /api/v1/edu/login/bind"))

@router.post("/login/uploadBusinessCard", summary="补迁移桩 (原: /login/uploadBusinessCard)")
def stub_post_login_uploadBusinessCard(payload: Optional[Dict[str, Any]] = Body(None)):
    """P0 批次2 桩端点 POST /api/v1/edu/login/uploadBusinessCard."""
    return _ok(_stub_response("POST /api/v1/edu/login/uploadBusinessCard"))

@router.get("/login/getMinioFile", summary="补迁移桩 (原: /login/getMinioFile)")
def stub_get_login_getMinioFile():
    """P0 批次2 桩端点 GET /api/v1/edu/login/getMinioFile."""
    return _ok(_stub_response("GET /api/v1/edu/login/getMinioFile"))

@router.get("/login/get/url/link", summary="补迁移桩 (原: /login/get/url/link)")
def stub_get_login_get_url_link():
    """P0 批次2 桩端点 GET /api/v1/edu/login/get/url/link."""
    return _ok(_stub_response("GET /api/v1/edu/login/get/url/link"))

@router.delete("/login/cancel", summary="补迁移桩 (原: /login/cancel)")
def stub_delete_login_cancel():
    """P0 批次2 桩端点 DELETE /api/v1/edu/login/cancel."""
    return _ok(_stub_response("DELETE /api/v1/edu/login/cancel"))

# ======================================================================
# app_pay (1 端点)
# ======================================================================

@router.post("/app/pay/wx/android", summary="补迁移桩 (原: /app/pay/wx/android)")
def stub_post_app_pay_wx_android(payload: Optional[Dict[str, Any]] = Body(None)):
    """P0 批次2 桩端点 POST /api/v1/edu/app/pay/wx/android."""
    return _ok(_stub_response("POST /api/v1/edu/app/pay/wx/android"))

# ======================================================================
# resource (10 端点)
# ======================================================================

@router.get("/resource/getCoursePlanet", summary="补迁移桩 (原: /resource/getCoursePlanet)")
def stub_get_resource_getCoursePlanet():
    """P0 批次2 桩端点 GET /api/v1/edu/resource/getCoursePlanet."""
    return _ok(_stub_response("GET /api/v1/edu/resource/getCoursePlanet"))

@router.post("/resource/addUserAgentFreeTime", summary="补迁移桩 (原: /resource/addUserAgentFreeTime)")
def stub_post_resource_addUserAgentFreeTime(payload: Optional[Dict[str, Any]] = Body(None)):
    """P0 批次2 桩端点 POST /api/v1/edu/resource/addUserAgentFreeTime."""
    return _ok(_stub_response("POST /api/v1/edu/resource/addUserAgentFreeTime"))

@router.get("/resource/getUserAgentFreeTime", summary="补迁移桩 (原: /resource/getUserAgentFreeTime)")
def stub_get_resource_getUserAgentFreeTime():
    """P0 批次2 桩端点 GET /api/v1/edu/resource/getUserAgentFreeTime."""
    return _ok(_stub_response("GET /api/v1/edu/resource/getUserAgentFreeTime"))

@router.post("/resource/postPopularCourses", summary="补迁移桩 (原: /resource/postPopularCourses)")
def stub_post_resource_postPopularCourses(payload: Optional[Dict[str, Any]] = Body(None)):
    """P0 批次2 桩端点 POST /api/v1/edu/resource/postPopularCourses."""
    return _ok(_stub_response("POST /api/v1/edu/resource/postPopularCourses"))

@router.post("/resource/getTokenCount", summary="补迁移桩 (原: /resource/getTokenCount)")
def stub_post_resource_getTokenCount(payload: Optional[Dict[str, Any]] = Body(None)):
    """P0 批次2 桩端点 POST /api/v1/edu/resource/getTokenCount."""
    return _ok(_stub_response("POST /api/v1/edu/resource/getTokenCount"))

@router.post("/resource/getTokenReturn", summary="补迁移桩 (原: /resource/getTokenReturn)")
def stub_post_resource_getTokenReturn(payload: Optional[Dict[str, Any]] = Body(None)):
    """P0 批次2 桩端点 POST /api/v1/edu/resource/getTokenReturn."""
    return _ok(_stub_response("POST /api/v1/edu/resource/getTokenReturn"))

@router.get("/resource/getAccessToken", summary="补迁移桩 (原: /resource/getAccessToken)")
def stub_get_resource_getAccessToken():
    """P0 批次2 桩端点 GET /api/v1/edu/resource/getAccessToken."""
    return _ok(_stub_response("GET /api/v1/edu/resource/getAccessToken"))

@router.post("/resource/saveUserContext", summary="补迁移桩 (原: /resource/saveUserContext)")
def stub_post_resource_saveUserContext(payload: Optional[Dict[str, Any]] = Body(None)):
    """P0 批次2 桩端点 POST /api/v1/edu/resource/saveUserContext."""
    return _ok(_stub_response("POST /api/v1/edu/resource/saveUserContext"))

@router.get("/resource/getUserContext", summary="补迁移桩 (原: /resource/getUserContext)")
def stub_get_resource_getUserContext():
    """P0 批次2 桩端点 GET /api/v1/edu/resource/getUserContext."""
    return _ok(_stub_response("GET /api/v1/edu/resource/getUserContext"))

@router.get("/resource/getUserContext/field", summary="补迁移桩 (原: /resource/getUserContext/field)")
def stub_get_resource_getUserContext_field():
    """P0 批次2 桩端点 GET /api/v1/edu/resource/getUserContext/field."""
    return _ok(_stub_response("GET /api/v1/edu/resource/getUserContext/field"))

# ======================================================================
# pay (10 端点)
# ======================================================================

@router.post("/pay/initiatePay", summary="补迁移桩 (原: /pay/initiatePay)")
def stub_post_pay_initiatePay(payload: Optional[Dict[str, Any]] = Body(None)):
    """P0 批次2 桩端点 POST /api/v1/edu/pay/initiatePay."""
    return _ok(_stub_response("POST /api/v1/edu/pay/initiatePay"))

@router.post("/pay/app/initiatePay", summary="补迁移桩 (原: /pay/app/initiatePay)")
def stub_post_pay_app_initiatePay(payload: Optional[Dict[str, Any]] = Body(None)):
    """P0 批次2 桩端点 POST /api/v1/edu/pay/app/initiatePay."""
    return _ok(_stub_response("POST /api/v1/edu/pay/app/initiatePay"))

@router.post("/pay/queryOrderById", summary="补迁移桩 (原: /pay/queryOrderById)")
def stub_post_pay_queryOrderById(payload: Optional[Dict[str, Any]] = Body(None)):
    """P0 批次2 桩端点 POST /api/v1/edu/pay/queryOrderById."""
    return _ok(_stub_response("POST /api/v1/edu/pay/queryOrderById"))

@router.post("/pay/notify", summary="补迁移桩 (原: /pay/notify)")
def stub_post_pay_notify(payload: Optional[Dict[str, Any]] = Body(None)):
    """P0 批次2 桩端点 POST /api/v1/edu/pay/notify."""
    return _ok(_stub_response("POST /api/v1/edu/pay/notify"))

@router.post("/pay/queryOrderByOutTradeNo", summary="补迁移桩 (原: /pay/queryOrderByOutTradeNo)")
def stub_post_pay_queryOrderByOutTradeNo(payload: Optional[Dict[str, Any]] = Body(None)):
    """P0 批次2 桩端点 POST /api/v1/edu/pay/queryOrderByOutTradeNo."""
    return _ok(_stub_response("POST /api/v1/edu/pay/queryOrderByOutTradeNo"))

@router.post("/pay/closeOrder", summary="补迁移桩 (原: /pay/closeOrder)")
def stub_post_pay_closeOrder(payload: Optional[Dict[str, Any]] = Body(None)):
    """P0 批次2 桩端点 POST /api/v1/edu/pay/closeOrder."""
    return _ok(_stub_response("POST /api/v1/edu/pay/closeOrder"))

@router.post("/pay/refunds", summary="补迁移桩 (原: /pay/refunds)")
def stub_post_pay_refunds(payload: Optional[Dict[str, Any]] = Body(None)):
    """P0 批次2 桩端点 POST /api/v1/edu/pay/refunds."""
    return _ok(_stub_response("POST /api/v1/edu/pay/refunds"))

@router.post("/pay/transferNotify", summary="补迁移桩 (原: /pay/transferNotify)")
def stub_post_pay_transferNotify(payload: Optional[Dict[str, Any]] = Body(None)):
    """P0 批次2 桩端点 POST /api/v1/edu/pay/transferNotify."""
    return _ok(_stub_response("POST /api/v1/edu/pay/transferNotify"))

@router.post("/pay/course/notify", summary="补迁移桩 (原: /pay/course/notify)")
def stub_post_pay_course_notify(payload: Optional[Dict[str, Any]] = Body(None)):
    """P0 批次2 桩端点 POST /api/v1/edu/pay/course/notify."""
    return _ok(_stub_response("POST /api/v1/edu/pay/course/notify"))

@router.get("/pay/consecutively/product", summary="补迁移桩 (原: /pay/consecutively/product)")
def stub_get_pay_consecutively_product():
    """P0 批次2 桩端点 GET /api/v1/edu/pay/consecutively/product."""
    return _ok(_stub_response("GET /api/v1/edu/pay/consecutively/product"))

# ======================================================================
# zhs_agent_buy (2 端点)
# ======================================================================

@router.get("/zhs_agent_buy/user/{bug_uuid}/agent/{agent_id}", summary="补迁移桩 (原: /zhs_agent_buy/user/{bug_uuid}/agent/{agent_id})")
def stub_get_zhs_agent_buy_user_bug_uuid_agent_agent_id(bug_uuid: int, agent_id: int):
    """P0 批次2 桩端点 GET /api/v1/edu/zhs_agent_buy/user/{bug_uuid}/agent/{agent_id}."""
    return _ok(_stub_response("GET /api/v1/edu/zhs_agent_buy/user/{bug_uuid}/agent/{agent_id}"))

@router.get("/zhs_agent_buy/order/{order_no}", summary="补迁移桩 (原: /zhs_agent_buy/order/{order_no})")
def stub_get_zhs_agent_buy_order_order_no(order_no: int):
    """P0 批次2 桩端点 GET /api/v1/edu/zhs_agent_buy/order/{order_no}."""
    return _ok(_stub_response("GET /api/v1/edu/zhs_agent_buy/order/{order_no}"))

# ======================================================================
# flow (1 端点)
# ======================================================================

@router.get("/flow/orderList", summary="补迁移桩 (原: /flow/orderList)")
def stub_get_flow_orderList():
    """P0 批次2 桩端点 GET /api/v1/edu/flow/orderList."""
    return _ok(_stub_response("GET /api/v1/edu/flow/orderList"))

# ======================================================================
# course (4 端点)
# ======================================================================

@router.get("/course/list", summary="补迁移桩 (原: /course/list)")
def stub_get_course_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P0 批次2 桩端点 GET /api/v1/edu/course/list."""
    return _ok(_stub_response("GET /api/v1/edu/course/list"))

@router.get("/course/{item_id}", summary="补迁移桩 (原: /course/{item_id})")
def stub_get_course_item_id(item_id: int):
    """P0 批次2 桩端点 GET /api/v1/edu/course/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/course/{item_id}"))

@router.delete("/course/{ids}", summary="补迁移桩 (原: /course/{ids})")
def stub_delete_course_ids(ids: int):
    """P0 批次2 桩端点 DELETE /api/v1/edu/course/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/course/{ids}"))

@router.post("/course/delist/{ids}", summary="补迁移桩 (原: /course/delist/{ids})")
def stub_post_course_delist_ids(ids: int, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), payload: Optional[Dict[str, Any]] = Body(None)):
    """P0 批次2 桩端点 POST /api/v1/edu/course/delist/{ids}."""
    return _ok(_stub_response("POST /api/v1/edu/course/delist/{ids}"))

# ======================================================================
# coursePlatformLog (5 端点)
# ======================================================================

@router.get("/coursePlatformLog/list", summary="补迁移桩 (原: /coursePlatformLog/list)")
def stub_get_coursePlatformLog_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P0 批次2 桩端点 GET /api/v1/edu/coursePlatformLog/list."""
    return _ok(_stub_response("GET /api/v1/edu/coursePlatformLog/list"))

@router.get("/coursePlatformLog/{item_id}", summary="补迁移桩 (原: /coursePlatformLog/{item_id})")
def stub_get_coursePlatformLog_item_id(item_id: int):
    """P0 批次2 桩端点 GET /api/v1/edu/coursePlatformLog/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/coursePlatformLog/{item_id}"))

@router.delete("/coursePlatformLog/{ids}", summary="补迁移桩 (原: /coursePlatformLog/{ids})")
def stub_delete_coursePlatformLog_ids(ids: int):
    """P0 批次2 桩端点 DELETE /api/v1/edu/coursePlatformLog/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/coursePlatformLog/{ids}"))

@router.post("/coursePlatformLog", summary="补迁移桩 (原: /coursePlatformLog)")
def stub_post_coursePlatformLog(payload: Optional[Dict[str, Any]] = Body(None)):
    """P0 批次2 桩端点 POST /api/v1/edu/coursePlatformLog."""
    return _ok(_stub_response("POST /api/v1/edu/coursePlatformLog"))

@router.put("/coursePlatformLog", summary="补迁移桩 (原: /coursePlatformLog)")
def stub_put_coursePlatformLog(payload: Optional[Dict[str, Any]] = Body(None)):
    """P0 批次2 桩端点 PUT /api/v1/edu/coursePlatformLog."""
    return _ok(_stub_response("PUT /api/v1/edu/coursePlatformLog"))

# ======================================================================
# courseVideo (9 端点)
# ======================================================================

@router.get("/courseVideo/list", summary="补迁移桩 (原: /courseVideo/list)")
def stub_get_courseVideo_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P0 批次2 桩端点 GET /api/v1/edu/courseVideo/list."""
    return _ok(_stub_response("GET /api/v1/edu/courseVideo/list"))

@router.get("/courseVideo/list/login", summary="补迁移桩 (原: /courseVideo/list/login)")
def stub_get_courseVideo_list_login(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P0 批次2 桩端点 GET /api/v1/edu/courseVideo/list/login."""
    return _ok(_stub_response("GET /api/v1/edu/courseVideo/list/login"))

@router.get("/courseVideo/move/{video_id}/{move_type}", summary="补迁移桩 (原: /courseVideo/move/{video_id}/{move_type})")
def stub_get_courseVideo_move_video_id_move_type(video_id: int, move_type: int):
    """P0 批次2 桩端点 GET /api/v1/edu/courseVideo/move/{video_id}/{move_type}."""
    return _ok(_stub_response("GET /api/v1/edu/courseVideo/move/{video_id}/{move_type}"))

@router.post("/courseVideo/issue/{ids}", summary="补迁移桩 (原: /courseVideo/issue/{ids})")
def stub_post_courseVideo_issue_ids(ids: int, payload: Optional[Dict[str, Any]] = Body(None)):
    """P0 批次2 桩端点 POST /api/v1/edu/courseVideo/issue/{ids}."""
    return _ok(_stub_response("POST /api/v1/edu/courseVideo/issue/{ids}"))

@router.post("/courseVideo/batch", summary="补迁移桩 (原: /courseVideo/batch)")
def stub_post_courseVideo_batch(payload: Optional[Dict[str, Any]] = Body(None)):
    """P0 批次2 桩端点 POST /api/v1/edu/courseVideo/batch."""
    return _ok(_stub_response("POST /api/v1/edu/courseVideo/batch"))

@router.get("/courseVideo/{item_id}", summary="补迁移桩 (原: /courseVideo/{item_id})")
def stub_get_courseVideo_item_id(item_id: int):
    """P0 批次2 桩端点 GET /api/v1/edu/courseVideo/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/courseVideo/{item_id}"))

@router.post("/courseVideo", summary="补迁移桩 (原: /courseVideo)")
def stub_post_courseVideo(payload: Optional[Dict[str, Any]] = Body(None)):
    """P0 批次2 桩端点 POST /api/v1/edu/courseVideo."""
    return _ok(_stub_response("POST /api/v1/edu/courseVideo"))

@router.put("/courseVideo", summary="补迁移桩 (原: /courseVideo)")
def stub_put_courseVideo(payload: Optional[Dict[str, Any]] = Body(None)):
    """P0 批次2 桩端点 PUT /api/v1/edu/courseVideo."""
    return _ok(_stub_response("PUT /api/v1/edu/courseVideo"))

@router.delete("/courseVideo/{ids}", summary="补迁移桩 (原: /courseVideo/{ids})")
def stub_delete_courseVideo_ids(ids: int):
    """P0 批次2 桩端点 DELETE /api/v1/edu/courseVideo/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/courseVideo/{ids}"))

# ======================================================================
# userCommentLog (5 端点)
# ======================================================================

@router.get("/userCommentLog/list", summary="补迁移桩 (原: /userCommentLog/list)")
def stub_get_userCommentLog_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P0 批次2 桩端点 GET /api/v1/edu/userCommentLog/list."""
    return _ok(_stub_response("GET /api/v1/edu/userCommentLog/list"))

@router.get("/userCommentLog/{id}", summary="补迁移桩 (原: /userCommentLog/{id})")
def stub_get_userCommentLog_id(id: int):
    """P0 批次2 桩端点 GET /api/v1/edu/userCommentLog/{id}."""
    return _ok(_stub_response("GET /api/v1/edu/userCommentLog/{id}"))

@router.post("/userCommentLog", summary="补迁移桩 (原: /userCommentLog)")
def stub_post_userCommentLog(payload: Optional[Dict[str, Any]] = Body(None)):
    """P0 批次2 桩端点 POST /api/v1/edu/userCommentLog."""
    return _ok(_stub_response("POST /api/v1/edu/userCommentLog"))

@router.put("/userCommentLog", summary="补迁移桩 (原: /userCommentLog)")
def stub_put_userCommentLog(payload: Optional[Dict[str, Any]] = Body(None)):
    """P0 批次2 桩端点 PUT /api/v1/edu/userCommentLog."""
    return _ok(_stub_response("PUT /api/v1/edu/userCommentLog"))

@router.delete("/userCommentLog/{ids}", summary="补迁移桩 (原: /userCommentLog/{ids})")
def stub_delete_userCommentLog_ids(ids: int):
    """P0 批次2 桩端点 DELETE /api/v1/edu/userCommentLog/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/userCommentLog/{ids}"))

# ======================================================================
# userPlatform (2 端点)
# ======================================================================

@router.get("/userPlatform/{userId}", summary="补迁移桩 (原: /userPlatform/{userId})")
def stub_get_userPlatform_userId(userId: int):
    """P0 批次2 桩端点 GET /api/v1/edu/userPlatform/{userId}."""
    return _ok(_stub_response("GET /api/v1/edu/userPlatform/{userId}"))

@router.post("/userPlatform", summary="补迁移桩 (原: /userPlatform)")
def stub_post_userPlatform(payload: Optional[Dict[str, Any]] = Body(None)):
    """P0 批次2 桩端点 POST /api/v1/edu/userPlatform."""
    return _ok(_stub_response("POST /api/v1/edu/userPlatform"))

# ======================================================================
# userVideoComment (4 端点)
# ======================================================================

@router.get("/userVideoComment/list", summary="补迁移桩 (原: /userVideoComment/list)")
def stub_get_userVideoComment_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P0 批次2 桩端点 GET /api/v1/edu/userVideoComment/list."""
    return _ok(_stub_response("GET /api/v1/edu/userVideoComment/list"))

@router.get("/userVideoComment/list/up", summary="补迁移桩 (原: /userVideoComment/list/up)")
def stub_get_userVideoComment_list_up(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P0 批次2 桩端点 GET /api/v1/edu/userVideoComment/list/up."""
    return _ok(_stub_response("GET /api/v1/edu/userVideoComment/list/up"))

@router.post("/userVideoComment", summary="补迁移桩 (原: /userVideoComment)")
def stub_post_userVideoComment(payload: Optional[Dict[str, Any]] = Body(None)):
    """P0 批次2 桩端点 POST /api/v1/edu/userVideoComment."""
    return _ok(_stub_response("POST /api/v1/edu/userVideoComment"))

@router.delete("/userVideoComment/{ids}", summary="补迁移桩 (原: /userVideoComment/{ids})")
def stub_delete_userVideoComment_ids(ids: int):
    """P0 批次2 桩端点 DELETE /api/v1/edu/userVideoComment/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/userVideoComment/{ids}"))

# ======================================================================
# userVideoLog (3 端点)
# ======================================================================

@router.get("/userVideoLog/list", summary="补迁移桩 (原: /userVideoLog/list)")
def stub_get_userVideoLog_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P0 批次2 桩端点 GET /api/v1/edu/userVideoLog/list."""
    return _ok(_stub_response("GET /api/v1/edu/userVideoLog/list"))

@router.get("/userVideoLog/operate/{videoId}/{type}", summary="补迁移桩 (原: /userVideoLog/operate/{videoId}/{type})")
def stub_get_userVideoLog_operate_videoId_type(videoId: int, type: int):
    """P0 批次2 桩端点 GET /api/v1/edu/userVideoLog/operate/{videoId}/{type}."""
    return _ok(_stub_response("GET /api/v1/edu/userVideoLog/operate/{videoId}/{type}"))

@router.delete("/userVideoLog/{ids}", summary="补迁移桩 (原: /userVideoLog/{ids})")
def stub_delete_userVideoLog_ids(ids: int):
    """P0 批次2 桩端点 DELETE /api/v1/edu/userVideoLog/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/userVideoLog/{ids}"))

# ======================================================================
# zhsWithdrawal (4 端点)
# ======================================================================

@router.post("/zhsWithdrawal/searchCount", summary="补迁移桩 (原: /zhsWithdrawal/searchCount)")
def stub_post_zhsWithdrawal_searchCount(payload: Optional[Dict[str, Any]] = Body(None)):
    """P0 批次2 桩端点 POST /api/v1/edu/zhsWithdrawal/searchCount."""
    return _ok(_stub_response("POST /api/v1/edu/zhsWithdrawal/searchCount"))

@router.post("/zhsWithdrawal/withdrawal", summary="补迁移桩 (原: /zhsWithdrawal/withdrawal)")
def stub_post_zhsWithdrawal_withdrawal(payload: Optional[Dict[str, Any]] = Body(None)):
    """P0 批次2 桩端点 POST /api/v1/edu/zhsWithdrawal/withdrawal."""
    return _ok(_stub_response("POST /api/v1/edu/zhsWithdrawal/withdrawal"))

@router.post("/zhsWithdrawal/withdrawalRecord", summary="补迁移桩 (原: /zhsWithdrawal/withdrawalRecord)")
def stub_post_zhsWithdrawal_withdrawalRecord(payload: Optional[Dict[str, Any]] = Body(None)):
    """P0 批次2 桩端点 POST /api/v1/edu/zhsWithdrawal/withdrawalRecord."""
    return _ok(_stub_response("POST /api/v1/edu/zhsWithdrawal/withdrawalRecord"))

@router.post("/zhsWithdrawal/getWithdrawal", summary="补迁移桩 (原: /zhsWithdrawal/getWithdrawal)")
def stub_post_zhsWithdrawal_getWithdrawal(payload: Optional[Dict[str, Any]] = Body(None)):
    """P0 批次2 桩端点 POST /api/v1/edu/zhsWithdrawal/getWithdrawal."""
    return _ok(_stub_response("POST /api/v1/edu/zhsWithdrawal/getWithdrawal"))


# 总端点数: 82
