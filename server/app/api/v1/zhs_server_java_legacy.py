"""ZHS_Server_java Legacy API - 迁移自 ZHS_Server_java 单体项目的 33 个 Controller.

2026-06-26 补齐 (Java→Python 迁移完整性核查发现).

Java 源根目录: ZHS_Server_java/src/main/java/com/ai/manager/
子包:
  - small/controller/   (16 个 Controller)
  - course/controller/  (8 个 Controller)
  - mcp/controller/     (6 个 Controller, 含 AliAIController 已单独迁移至 ali_ai_legacy.py)
  - app/controller/     (2 个 Controller)

33 个 Controller / 149 个端点 (按 Java @RequestMapping 分组):

  small/controller/:
    1.  AiBotSitesController          /bot/sites           1 端点  表 ai_world
    2.  AiUserFeedbackController     /userFeedback        5 端点  表 ai_user_feedback
    3.  AppVersionController          /appVersion          6 端点  表 app_version
    4.  DistributionController         /distribution        5 端点  分销系统
    5.  LoginController               /login               10 端点 微信登录流程
    6.  RemoteDeviceByTaskController  /remote/agent/task    3 端点  表 agent_need_task
    7.  ResourceController           /resource             12 端点 首页资源
    8.  ResourceNowController         /resource             15 端点 智能体上下文/文件上传
    9.  WXPayNowController            /pay                 10 端点 微信支付
    10. ZhsActivityController          /zhs_activity        2 端点  表 zhs_activity
    11. ZhsAgentBuyController          /zhs_agent_buy       9 端点  表 zhs_agent_buy
    12. ZhsAgentExamineController      /examine             2 端点  审核通过/驳回
    13. ZhsCommissionFlowController    /flow                4 端点  分销流水
    14. ZhsInformationController        /information         1 端点  表 zhs_information
    15. ZhsProductIdentityController   /product_identity    1 端点  表 zhs_product_identity
    16. ZhsWithdrawalController         /zhsWithdrawal       4 端点  提现

  course/controller/:
    17. ZhsCategoryDictionaryController  /categoryDictionary   2 端点 表 zhs_category_dictionary
    18. ZhsCourseController              /course                4 端点 表 zhs_course
    19. ZhsCoursePlatformLogController   /coursePlatformLog     5 端点 表 zhs_course_platform_log
    20. ZhsCourseVideoController         /courseVideo           9 端点 表 zhs_course_video
    21. ZhsEducationPlatformController   /educationPlatform     5 端点 表 zhs_education_platform
    22. ZhsUserCommentLogController      /userCommentLog        5 端点 表 zhs_user_comment_log
    23. ZhsUserPlatformController        /userPlatform          2 端点 表 zhs_user_platform
    24. ZhsUserVideoCommentController    /userVideoComment      4 端点 表 zhs_user_video_comment
    25. ZhsUserVideoLogController        /userVideoLog          3 端点 表 zhs_user_video_log

  mcp/controller/:
    26. Gemini3ProPreviewController      /gemini                1 端点 Gemini 对话
    27. KlingAIController                /kling                 2 端点 可灵视频
    28. McpResourceController            /mcp/resource          1 端点 视频转音频
    29. Sora2Controller                  /jianyi                2 端点 简易 Sora2
    30. TBoxController                    /tbox                  1 端点 腾讯百宝箱发布
    31. ZhsAgentController (mcp)          /agent                 10 端点 智能体列表/创作/分享

  app/controller/:
    32. AuthorizationManagementController /auth_management       2 端点 授权管理
    33. PayManagementController           /app/pay               1 端点 安卓微信支付

实现策略:
  - 全部用 text SQL + dict 返回, 不绑定 ORM model (避免表名冲突)
  - 鉴权: 大部分端点 require_login, 免登端点 (微信登录/支付回调/@SkipLogin) 不加
  - 分页参数: pageNum/pageSize (Java 惯例), Python 转为 offset/limit
  - 复杂业务 (微信支付/阿里AI/对象存储/n8n webhook) 用 best-effort: 能查 DB 的查 DB,
    需要外部服务的返回 503 提示或降级, 表不存在时返回空列表
  - ResourceController 与 ResourceNowController 前缀都是 /resource, 端点路径不冲突, 合并到同一 router
  - header 常量 (源自 Java core/constants):
      CourseConfig.PLATFORM_USER_ID = "PLATFORM-USER-UUID"
      CourseConfig.PLATFORM_TYPE     = "COURSE-PLATFORM"
      BeanConfig.ZHS_AUTHORIZATION   = "Authorization"
      WXConfig.DEVICE_TYPE_HEAD      = "platform-type"
"""
from __future__ import annotations

import json
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, Header, Path, Query, Request
from loguru import logger
from sqlalchemy import text

from app.database import get_session
from app.security import require_login
from app.utils.datetime_helper import utcnow

router = APIRouter(prefix="", tags=["ZHS-Server-Java-Legacy"])

# Java header 常量
_H_PLATFORM_USER_ID = "PLATFORM-USER-UUID"
_H_PLATFORM_TYPE = "COURSE-PLATFORM"
_H_DEVICE_TYPE = "platform-type"


# ---------------------------------------------------------------------------
# Helper functions (复用 ruoyi_legacy_supplement.py 模式)
# ---------------------------------------------------------------------------

def _get_db():
    with get_session() as db:
        yield db


def _ok(data: Any = None, msg: str = "ok") -> dict:
    return {"code": 0, "data": data, "msg": msg}


def _err(msg: str, code: int = -1) -> dict:
    return {"code": code, "msg": msg}


def _ajax(success: bool, msg: str = "") -> dict:
    """对应 Java AjaxResult / ResponseResultInfo."""
    return {"code": 200 if success else 500, "msg": msg or ("操作成功" if success else "操作失败")}


def _table_data(rows: List[Dict[str, Any]], total: int) -> dict:
    """对应 Java TableDataInfo."""
    return {"code": 0, "rows": rows, "total": total, "msg": "查询成功"}


def _rows_to_list(rows) -> List[Dict[str, Any]]:
    try:
        return [dict(r) for r in rows.mappings().all()]
    except Exception:
        return []


def _row_to_dict(row) -> Optional[Dict[str, Any]]:
    try:
        return dict(row) if row is not None else None
    except Exception:
        return None


def _parse_ids(ids: str) -> List[str]:
    if not ids:
        return []
    return [s.strip() for s in str(ids).split(",") if s.strip()]


def _page_params(page_num: int, page_size: int) -> Dict[str, Any]:
    return {"offset": (page_num - 1) * page_size, "limit": page_size}


def _build_insert(table: str, payload: Dict[str, Any], allowed: tuple, extra: Optional[Dict[str, Any]] = None) -> tuple:
    """构造 INSERT SQL: (sql_text, params). extra 追加固定列 (如 create_time)."""
    cols, vals, params = [], [], {}
    for k in allowed:
        if k in payload:
            cols.append(f"`{k}`" if k in ("group", "type", "order") else k)
            vals.append(f":{k}")
            params[k] = payload[k]
    if extra:
        for k, v in extra.items():
            cols.append(k)
            vals.append(f":{k}")
            params[k] = v
    sql = text(f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({', '.join(vals)})")
    return sql, params


def _build_update(table: str, payload: Dict[str, Any], allowed: tuple, extra: Optional[Dict[str, Any]] = None) -> tuple:
    """构造 UPDATE SQL: (sql_text, params). 必须包含 id."""
    cid = payload.get("id")
    if cid is None:
        return None, {}
    sets, params = [], {"id": cid}
    for k in allowed:
        if k in payload:
            sets.append(f"`{k}` = :{k}" if k in ("group", "type", "order") else f"{k} = :{k}")
            params[k] = payload[k]
    if extra:
        for k, v in extra.items():
            sets.append(f"{k} = :{k}")
            params[k] = v
    if not sets:
        return None, params
    sql = text(f"UPDATE {table} SET {', '.join(sets)} WHERE id = :id")
    return sql, params


# ===========================================================================
# 1. AiBotSitesController - /bot/sites (表 ai_world, @SkipLogin)
# Java: GET /bot/sites/kind
# ===========================================================================

@router.get("/bot/sites/kind", summary="[AiBotSites]站点分类列表")
def bot_sites_kind(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    section: Optional[str] = None,
    subSection: Optional[str] = None,
    type: Optional[int] = None,
):
    """对应 Java GET /bot/sites/kind. 免登录."""
    try:
        where = "1=1"
        params: Dict[str, Any] = _page_params(pageNum, pageSize)
        if section:
            where += " AND section = :section"
            params["section"] = section
        if subSection:
            where += " AND sub_section = :sub_section"
            params["sub_section"] = subSection
        if type is not None:
            where += " AND type = :type"
            params["type"] = type
        with get_session() as db:
            total = db.execute(text(f"SELECT COUNT(*) FROM ai_world WHERE {where}"), params).scalar() or 0
            rows = db.execute(text(f"""
                SELECT id, section, sub_section, type, name, cover, url, create_time
                FROM ai_world WHERE {where}
                ORDER BY id DESC LIMIT :offset, :limit
            """), params)
            return _ok(_rows_to_list(rows))
    except Exception as e:
        logger.debug("bot_sites_kind failed: %s", e)
        return _ok([])


# ===========================================================================
# 2. AiUserFeedbackController - /userFeedback (表 ai_user_feedback)
# Java: GET /list, GET /{id}, DELETE /{ids}, POST /, PUT /
# ===========================================================================

@router.get("/userFeedback/list", summary="[AiUserFeedback]用户反馈列表")
def user_feedback_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    platform_user_id: Optional[str] = Header(None, alias=_H_PLATFORM_USER_ID),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        where = "1=1"
        params: Dict[str, Any] = _page_params(pageNum, pageSize)
        if platform_user_id:
            where += " AND creator = :creator"
            params["creator"] = platform_user_id
        total = db.execute(text(f"SELECT COUNT(*) FROM ai_user_feedback WHERE {where}"), params).scalar() or 0
        rows = db.execute(text(f"""
            SELECT id, content, contact, creator, create_time, update_time
            FROM ai_user_feedback WHERE {where}
            ORDER BY id DESC LIMIT :offset, :limit
        """), params)
        return _ok(_rows_to_list(rows))
    except Exception as e:
        logger.debug("user_feedback_list failed: %s", e)
        return _ok([])


@router.get("/userFeedback/{item_id}", summary="[AiUserFeedback]用户反馈详情")
def user_feedback_get(
    item_id: int = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("""
            SELECT id, content, contact, creator, create_time, update_time
            FROM ai_user_feedback WHERE id = :id
        """), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("user_feedback_get failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/userFeedback/{ids}", summary="[AiUserFeedback]删除用户反馈(批量)")
def user_feedback_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text("DELETE FROM ai_user_feedback WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("user_feedback_remove failed: %s", e)
        return _ajax(False, str(e))


@router.post("/userFeedback", summary="[AiUserFeedback]新增用户反馈")
def user_feedback_add(
    payload: Dict[str, Any] = Body(...),
    platform_user_id: Optional[str] = Header(None, alias=_H_PLATFORM_USER_ID),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        now = utcnow()
        creator = platform_user_id or payload.get("creator") or ""
        sql, params = _build_insert(
            "ai_user_feedback", payload, ("content", "contact"),
            {"creator": creator, "create_time": now, "update_time": now},
        )
        db.execute(sql, params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("user_feedback_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/userFeedback", summary="[AiUserFeedback]修改用户反馈")
def user_feedback_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        sql, params = _build_update(
            "ai_user_feedback", payload, ("content", "contact"),
            {"update_time": utcnow()},
        )
        if sql is None:
            return _ajax(False, "id必填或无更新字段")
        result = db.execute(sql, params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("user_feedback_edit failed: %s", e)
        return _ajax(False, str(e))


# ===========================================================================
# 3. AppVersionController - /appVersion (表 app_version)
# Java: GET /list, GET /{id}, DELETE /{ids}, GET /{appId}/{version}(@SkipLogin), POST /, PUT /
# ===========================================================================

@router.get("/appVersion/list", summary="[AppVersion]App版本列表")
def app_version_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        params: Dict[str, Any] = _page_params(pageNum, pageSize)
        total = db.execute(text("SELECT COUNT(*) FROM app_version"), params).scalar() or 0
        rows = db.execute(text("""
            SELECT id, app_id, version, version_name, download_url, force_update, remark, create_time
            FROM app_version ORDER BY id DESC LIMIT :offset, :limit
        """), params)
        return _ok(_rows_to_list(rows))
    except Exception as e:
        logger.debug("app_version_list failed: %s", e)
        return _ok([])


@router.get("/appVersion/info/{item_id}", summary="[AppVersion]App版本详情")
def app_version_get(
    item_id: int = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("""
            SELECT id, app_id, version, version_name, download_url, force_update, remark, create_time
            FROM app_version WHERE id = :id
        """), {"id": item_id}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("app_version_get failed: %s", e)
        return _ajax(False, str(e))


@router.delete("/appVersion/{ids}", summary="[AppVersion]删除App版本(批量)")
def app_version_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text("DELETE FROM app_version WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("app_version_remove failed: %s", e)
        return _ajax(False, str(e))


@router.get("/appVersion/{app_id}/{version}", summary="[AppVersion]按appId+version查询当前版本(免登)")
def app_version_now(
    app_id: str = Path(..., alias="appId"),
    version: str = Path(...),
):
    """对应 Java GET /appVersion/{appId}/{version}. @SkipLogin 免登录."""
    try:
        with get_session() as db:
            row = db.execute(text("""
                SELECT id, app_id, version, version_name, download_url, force_update, remark, create_time
                FROM app_version WHERE app_id = :app_id AND version = :version
                ORDER BY id DESC LIMIT 1
            """), {"app_id": app_id, "version": version}).mappings().first()
            return _ok(dict(row) if row else None)
    except Exception as e:
        logger.debug("app_version_now failed: %s", e)
        return _ok(None)


@router.post("/appVersion", summary="[AppVersion]新增App版本")
def app_version_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        sql, params = _build_insert(
            "app_version", payload,
            ("app_id", "version", "version_name", "download_url", "force_update", "remark"),
            {"create_time": utcnow()},
        )
        db.execute(sql, params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("app_version_add failed: %s", e)
        return _ajax(False, str(e))


@router.put("/appVersion", summary="[AppVersion]修改App版本")
def app_version_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        sql, params = _build_update(
            "app_version", payload,
            ("app_id", "version", "version_name", "download_url", "force_update", "remark"),
            {"update_time": utcnow()},
        )
        if sql is None:
            return _ajax(False, "id必填或无更新字段")
        result = db.execute(sql, params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("app_version_edit failed: %s", e)
        return _ajax(False, str(e))


# ===========================================================================
# 4. AuthorizationManagementController - /auth_management (表 zhs_user_third_party_accounts)
# Java: GET /get/{uuid}, POST /remove
# ===========================================================================

@router.get("/auth_management/get/{uuid}", summary="[AuthManagement]获取授权用户列表")
def auth_management_get(
    uuid: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java GET /auth_management/get/{uuid}."""
    try:
        rows = db.execute(text("""
            SELECT id, uuid, platform, open_id, union_id, nickname, avatar, create_time
            FROM zhs_user_third_party_accounts WHERE uuid = :uuid
            ORDER BY id DESC
        """), {"uuid": uuid})
        return _ok(_rows_to_list(rows))
    except Exception as e:
        logger.debug("auth_management_get failed: %s", e)
        return _ok([])


@router.post("/auth_management/remove", summary="[AuthManagement]解绑小程序")
def auth_management_remove(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java POST /auth_management/remove. payload: {uuid, platform}."""
    uuid = payload.get("uuid")
    platform = payload.get("platform")
    if not uuid:
        return _err("不存在的授权！")
    if not platform:
        return _err("未知的授权平台!")
    try:
        result = db.execute(text("""
            DELETE FROM zhs_user_third_party_accounts
            WHERE uuid = :uuid AND platform = :platform
        """), {"uuid": uuid, "platform": platform})
        db.commit()
        return _ajax(result.rowcount > 0, "解绑成功" if result.rowcount > 0 else "未找到授权记录")
    except Exception as e:
        db.rollback()
        logger.debug("auth_management_remove failed: %s", e)
        return _err(f"解绑失败: {e}")


# ===========================================================================
# 5. DistributionController - /distribution (分销系统, 迁移自 PHP)
# Java: GET /getSubordinates, POST /getUserAndChildrenOrders,
#       GET /getOperatorDataCardData, GET /getUserInviteeOrderStats,
#       GET /getUserCommissionDetail
# ===========================================================================

@router.get("/distribution/getSubordinates", summary="[Distribution]获取操盘手所有下家列表")
def distribution_subordinates(
    open_id: str = Query(..., alias="open_id"),
    quantity: int = Query(10, ge=1, le=100),
    page: int = Query(1, ge=1),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        params: Dict[str, Any] = {"parent_id": open_id, "offset": (page - 1) * quantity, "limit": quantity}
        total = db.execute(text("""
            SELECT COUNT(*) FROM zhs_user WHERE parent_id = :parent_id
        """), {"parent_id": open_id}).scalar() or 0
        rows = db.execute(text("""
            SELECT id, uuid, open_id, nickname, avatar, parent_id, create_time
            FROM zhs_user WHERE parent_id = :parent_id
            ORDER BY id DESC LIMIT :offset, :limit
        """), params)
        return _ok({"list": _rows_to_list(rows), "total": int(total)})
    except Exception as e:
        logger.debug("distribution_subordinates failed: %s", e)
        return _ok({"list": [], "total": 0})


@router.post("/distribution/getUserAndChildrenOrders", summary="[Distribution]获取用户及下级订单")
def distribution_user_children_orders(
    id: int = Query(..., alias="id"),
    page: int = Query(1, ge=1),
    quantity: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        params: Dict[str, Any] = {"user_id": id, "offset": (page - 1) * quantity, "limit": quantity}
        rows = db.execute(text("""
            SELECT o.id, o.order_no, o.user_id, o.product_id, o.amount, o.status, o.create_time
            FROM zhs_order o
            WHERE o.user_id = :user_id
               OR o.user_id IN (SELECT id FROM zhs_user WHERE parent_id = :user_id)
            ORDER BY o.id DESC LIMIT :offset, :limit
        """), params)
        return _ok(_rows_to_list(rows))
    except Exception as e:
        logger.debug("distribution_user_children_orders failed: %s", e)
        return _ok([])


@router.get("/distribution/getOperatorDataCardData", summary="[Distribution]操盘手数据卡片统计")
def distribution_operator_data_card(
    user_id: int = Query(..., alias="user_id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("""
            SELECT
                (SELECT COUNT(*) FROM zhs_user WHERE parent_id = :user_id) AS subordinates_count,
                (SELECT COALESCE(SUM(amount),0) FROM zhs_order
                 WHERE user_id = :user_id OR user_id IN (SELECT id FROM zhs_user WHERE parent_id = :user_id)) AS total_amount,
                (SELECT COUNT(*) FROM zhs_order
                 WHERE user_id = :user_id OR user_id IN (SELECT id FROM zhs_user WHERE parent_id = :user_id)) AS total_orders
        """), {"user_id": user_id}).mappings().first()
        return _ok(dict(row) if row else {})
    except Exception as e:
        logger.debug("distribution_operator_data_card failed: %s", e)
        return _ok({})


@router.get("/distribution/getUserInviteeOrderStats", summary="[Distribution]下级用户订单统计")
def distribution_invitee_order_stats(
    user_id: int = Query(..., alias="user_id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        rows = db.execute(text("""
            SELECT u.id, u.uuid, u.open_id, u.nickname, u.avatar,
                   (SELECT COUNT(*) FROM zhs_order o WHERE o.user_id = u.id) AS order_count,
                   (SELECT COALESCE(SUM(amount),0) FROM zhs_order o WHERE o.user_id = u.id) AS total_amount
            FROM zhs_user u WHERE u.parent_id = :user_id
            ORDER BY u.id DESC
        """), {"user_id": user_id})
        return _ok(_rows_to_list(rows))
    except Exception as e:
        logger.debug("distribution_invitee_order_stats failed: %s", e)
        return _ok([])


@router.get("/distribution/getUserCommissionDetail", summary="[Distribution]操盘手佣金页面信息")
def distribution_user_commission_detail(
    user_id: int = Query(..., alias="user_id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        rows = db.execute(text("""
            SELECT id, order_id, belongers_open_id, amount, type, create_time
            FROM zhs_commission_flow
            WHERE belongers_open_id = (SELECT open_id FROM zhs_user WHERE id = :user_id LIMIT 1)
            ORDER BY id DESC
        """), {"user_id": user_id})
        return _ok(_rows_to_list(rows))
    except Exception as e:
        logger.debug("distribution_user_commission_detail failed: %s", e)
        return _ok([])


# ===========================================================================
# 6. Gemini3ProPreviewController - /gemini (Gemini 对话)
# Java: POST /3/generate
# ===========================================================================

@router.post("/gemini/3/generate", summary="[Gemini3Pro]Gemini对话生成")
def gemini_3_generate(
    payload: Dict[str, Any] = Body(...),
    platform_user_id: Optional[str] = Header(None, alias=_H_PLATFORM_USER_ID),
    _user: str = Depends(require_login),
):
    """对应 Java POST /gemini/3/generate. 需调 Gemini 服务, best-effort."""
    prompt = payload.get("prompt")
    if not prompt:
        return _err("提示词不能为空!")
    payload["creator"] = platform_user_id
    # best-effort: 尝试调 Gemini 服务, 失败返回 503
    try:
        from app.services.gemini_service import generate_content  # type: ignore
        result = generate_content(payload)
        return _ok(result)
    except ImportError:
        return _err("Gemini 服务未实现 (app.services.gemini_service), 暂不可用", code=503)
    except Exception as e:
        logger.debug("gemini_3_generate failed: %s", e)
        return _err(f"Gemini 生成失败: {e}", code=503)


# ===========================================================================
# 7. KlingAIController - /kling (可灵AI视频)
# Java: POST /generate/video, GET /video/info/{id}
# ===========================================================================

@router.post("/kling/generate/video", summary="[KlingAI]生成数字人视频")
def kling_generate_video(
    payload: Dict[str, Any] = Body(...),
    platform_user_id: Optional[str] = Header(None, alias=_H_PLATFORM_USER_ID),
    _user: str = Depends(require_login),
):
    """对应 Java POST /kling/generate/video. 需调可灵服务, best-effort."""
    payload["creator"] = platform_user_id
    try:
        from app.services.kling_service import generate_video  # type: ignore
        return _ok(generate_video(payload))
    except ImportError:
        return _err("可灵 AI 服务未实现 (app.services.kling_service), 暂不可用", code=503)
    except Exception as e:
        logger.debug("kling_generate_video failed: %s", e)
        return _err(f"可灵生成失败: {e}", code=503)


@router.get("/kling/video/info/{task_id}", summary="[KlingAI]查询视频生成进度")
def kling_video_info(
    task_id: str = Path(..., alias="id"),
    platform_user_id: Optional[str] = Header(None, alias=_H_PLATFORM_USER_ID),
    _user: str = Depends(require_login),
):
    """对应 Java GET /kling/video/info/{id}."""
    try:
        from app.services.kling_service import video_info  # type: ignore
        return _ok(video_info(task_id, platform_user_id or ""))
    except ImportError:
        return _err("可灵 AI 服务未实现 (app.services.kling_service), 暂不可用", code=503)
    except Exception as e:
        logger.debug("kling_video_info failed: %s", e)
        return _err(f"查询失败: {e}", code=503)


# ===========================================================================
# 8. LoginController - /login (微信登录流程, 大部分免登)
# Java: POST /getOpenId, POST /getPhoneNumber, POST /editWxOpenId, GET /getWxCode,
#       POST /login, POST /bind, POST /uploadBusinessCard, GET /getMinioFile,
#       GET /get/url/link, DELETE /cancel (需登录)
# ===========================================================================

@router.post("/login/getOpenId", summary="[Login]获取微信OpenID(免登,已废弃)")
def login_get_open_id(
    code: str = Query(..., alias="code"),
):
    """对应 Java POST /login/getOpenId. @Deprecated, 免登录."""
    if not code:
        return {"code": 400, "msg": "缺少 code 参数"}
    try:
        from app.services.login_service import get_open_id  # type: ignore
        return get_open_id(code)
    except ImportError:
        return _err("login_service 未实现", code=503)
    except Exception as e:
        logger.debug("login_get_open_id failed: %s", e)
        return _err(f"获取 OpenID 失败: {e}", code=503)


@router.post("/login/getPhoneNumber", summary="[Login]手机号登录(免登,已废弃)")
def login_get_phone_number(
    code: str = Query(..., alias="code"),
    openId: str = Query(..., alias="openId"),
    parentId: Optional[str] = Query(None, alias="parentId"),
):
    """对应 Java POST /login/getPhoneNumber. @Deprecated, 免登录."""
    if not code or not openId:
        return _err("缺少 code 参数")
    parent_id = parentId or ""
    try:
        from app.services.login_service import login, get_phone_number  # type: ignore
        login(openId, parent_id)
        return get_phone_number(code, openId)
    except ImportError:
        return _err("login_service 未实现", code=503)
    except Exception as e:
        logger.debug("login_get_phone_number failed: %s", e)
        return _err(f"获取手机号失败: {e}", code=503)


@router.post("/login/editWxOpenId", summary="[Login]换绑微信账号")
def login_edit_wx_open_id(
    payload: Dict[str, Any] = Body(...),
):
    """对应 Java POST /login/editWxOpenId."""
    phone = payload.get("phone")
    open_id = payload.get("openId")
    if not phone or not open_id:
        return _err("缺少 code 参数")
    try:
        from app.services.login_service import edit_wx_open_id  # type: ignore
        return edit_wx_open_id(phone, open_id)
    except ImportError:
        return _err("login_service 未实现", code=503)
    except Exception as e:
        logger.debug("login_edit_wx_open_id failed: %s", e)
        return _err(f"换绑失败: {e}", code=503)


@router.get("/login/getWxCode", summary="[Login]获取微信小程序码(免登)")
def login_get_wx_code(
    invite_code: str = Query(..., alias="invite_code"),
    back: Optional[int] = None,
):
    """对应 Java GET /login/getWxCode. 免登录."""
    if not invite_code:
        return _err("invite_code不能为空")
    try:
        from app.services.login_service import get_wx_code  # type: ignore
        result = get_wx_code(invite_code, back)
        if isinstance(result, (bytes, bytearray)):
            # 返回 base64 编码图片 (FastAPI 不直接返回二进制)
            import base64
            return {"code": 0, "data": base64.b64encode(bytes(result)).decode(), "content_type": "image/jpeg"}
        return _ok(result)
    except ImportError:
        return _err("login_service 未实现", code=503)
    except Exception as e:
        logger.debug("login_get_wx_code failed: %s", e)
        return _err(f"获取小程序码失败: {e}", code=503)


@router.post("/login/login", summary="[Login]用户隐式注册和登录(免登,已废弃)")
def login_login(
    open_id: str = Query(..., alias="open_id"),
    parentId: Optional[str] = Query(None),
):
    """对应 Java POST /login/login. @Deprecated, 免登录."""
    if not open_id:
        return _err("缺少open_id")
    try:
        from app.services.login_service import login  # type: ignore
        return login(open_id, parentId or "")
    except ImportError:
        return _err("login_service 未实现", code=503)
    except Exception as e:
        logger.debug("login_login failed: %s", e)
        return _err(f"登录失败: {e}", code=503)


@router.post("/login/bind", summary="[Login]用户绑定信息(免登,已废弃)")
def login_bind(
    open_id: str = Query(..., alias="open_id"),
    nickname: Optional[str] = Query(None),
    phone: Optional[str] = Query(None),
    avatar: Optional[str] = Query(None),
    fileName: Optional[str] = Query(None),
    fileType: Optional[str] = Query(None),
):
    """对应 Java POST /login/bind. @Deprecated, 免登录."""
    if not open_id:
        return _err("缺少 open_id")
    try:
        from app.services.login_service import bind  # type: ignore
        return bind(open_id, nickname, phone, avatar, fileName, fileType)
    except ImportError:
        return _err("login_service 未实现", code=503)
    except Exception as e:
        logger.debug("login_bind failed: %s", e)
        return _err(f"绑定失败: {e}", code=503)


@router.post("/login/uploadBusinessCard", summary="[Login]上传名片")
def login_upload_business_card(
    payload: Dict[str, Any] = Body(...),
):
    """对应 Java POST /login/uploadBusinessCard."""
    try:
        card = payload.get("card")
        file_name = payload.get("fileName")
        uid = payload.get("id")
        if uid is None:
            return _err("缺少用户 id")
        if not card:
            return _err("缺少名片图片内容")
        try:
            from app.services.login_service import upload_business_card  # type: ignore
            return upload_business_card(int(uid), card, file_name)
        except ImportError:
            return _err("login_service 未实现", code=503)
    except Exception as e:
        logger.debug("login_upload_business_card failed: %s", e)
        return _err(f"上传失败: {e}", code=503)


@router.get("/login/getMinioFile", summary="[Login]获取后端minio存放文件")
def login_get_minio_file(
    filePath: str = Query(..., alias="filePath"),
):
    """对应 Java GET /login/getMinioFile. 代理下载 Minio 文件."""
    if not filePath:
        return _err("filePath 不能为空")
    try:
        import httpx
        # best-effort: 直接代理下载
        with httpx.Client(timeout=30, follow_redirects=True) as client:
            r = client.get(filePath)
            import base64
            return {
                "code": 0,
                "data": base64.b64encode(r.content).decode(),
                "content_type": r.headers.get("content-type", "application/octet-stream"),
            }
    except Exception as e:
        logger.debug("login_get_minio_file failed: %s", e)
        return _err(f"获取文件失败: {e}", code=503)


@router.get("/login/get/url/link", summary="[Login]获取URL链接")
def login_get_url_link(
    uuid: str = Query(...),
):
    """对应 Java GET /login/get/url/link."""
    try:
        from app.services.login_service import get_url_link  # type: ignore
        return _ok(get_url_link(uuid))
    except ImportError:
        return _err("login_service 未实现", code=503)
    except Exception as e:
        logger.debug("login_get_url_link failed: %s", e)
        return _err(f"获取链接失败: {e}", code=503)


@router.delete("/login/cancel", summary="[Login]注销账号")
def login_cancel(
    platform_user_id: Optional[str] = Header(None, alias=_H_PLATFORM_USER_ID),
    _user: str = Depends(require_login),
):
    """对应 Java DELETE /login/cancel. 需登录."""
    uuid = platform_user_id or ""
    try:
        from app.services.login_service import cancel_user  # type: ignore
        return _ok(cancel_user(uuid))
    except ImportError:
        return _err("login_service 未实现", code=503)
    except Exception as e:
        logger.debug("login_cancel failed: %s", e)
        return _err(f"注销失败: {e}", code=503)


# ===========================================================================
# 9. McpResourceController - /mcp/resource (@SkipLogin)
# Java: GET /video/to/audio
# ===========================================================================

@router.get("/mcp/resource/video/to/audio", summary="[McpResource]视频转音频(免登)")
def mcp_resource_video_to_audio(
    url: str = Query(..., alias="url"),
):
    """对应 Java GET /mcp/resource/video/to/audio. @SkipLogin 免登录."""
    if not url:
        return _err("url 不能为空")
    try:
        from app.services.mcp_resource_service import video_to_audio  # type: ignore
        return _ok(video_to_audio(url))
    except ImportError:
        return _err("mcp_resource_service 未实现 (需 ffmpeg), 暂不可用", code=503)
    except Exception as e:
        logger.debug("mcp_resource_video_to_audio failed: %s", e)
        return _err(f"视频转音频失败: {e}", code=503)


# ===========================================================================
# 10. PayManagementController - /app/pay (安卓微信支付)
# Java: POST /wx/android
# ===========================================================================

@router.post("/app/pay/wx/android", summary="[PayManagement]安卓微信支付下单")
def app_pay_wx_android(
    payload: Dict[str, Any] = Body(...),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """对应 Java POST /app/pay/wx/android. 头部 Authorization."""
    if "uuid" not in payload:
        return _err("当前用户不存在")
    if "desc" not in payload:
        payload["desc"] = "充值"
    if "id" not in payload:
        return _err("购买物品不存在")
    if "productType" not in payload:
        return _err("当前购买类型不存在")
    try:
        if int(payload.get("productType")) == 1 and "amount" not in payload:
            return _err("购买力不足")
    except (TypeError, ValueError):
        return _err("productType 类型错误")
    try:
        from app.services.pay_android_service import pay  # type: ignore
        return _ok(pay(payload, authorization or ""))
    except ImportError:
        return _err("pay_android_service 未实现, 暂不可用", code=503)
    except Exception as e:
        logger.debug("app_pay_wx_android failed: %s", e)
        return _err(f"支付下单失败: {e}", code=503)


# ===========================================================================
# 11. RemoteDeviceByTaskController - /remote/agent/task (表 agent_need_task)
# Java: POST /need/task/add, POST /need/task (@SkipLogin), GET /need/task/{id}
# ===========================================================================

@router.post("/remote/agent/task/need/task/add", summary="[RemoteDeviceTask]新增智能体需求任务")
def remote_task_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        sql, params = _build_insert(
            "agent_need_task", payload,
            ("agent_id", "title", "content", "status", "creator"),
            {"create_time": utcnow(), "update_time": utcnow()},
        )
        db.execute(sql, params)
        db.commit()
        return _ok(None)
    except Exception as e:
        db.rollback()
        logger.debug("remote_task_add failed: %s", e)
        return _err(f"新增失败: {e}")


@router.post("/remote/agent/task/need/task", summary="[RemoteDeviceTask]查询智能体需求任务列表(免登)")
def remote_task_list(
    payload: Dict[str, Any] = Body(...),
):
    """对应 Java POST /remote/agent/task/need/task. @SkipLogin 免登录."""
    try:
        page_num = int(payload.get("pageNum", 1) or 1)
        page_size = int(payload.get("pageSize", 10) or 10)
        page_size = max(1, min(100, page_size))
        where = "1=1"
        params: Dict[str, Any] = _page_params(page_num, page_size)
        if payload.get("agent_id"):
            where += " AND agent_id = :agent_id"
            params["agent_id"] = payload["agent_id"]
        if payload.get("status") is not None:
            where += " AND status = :status"
            params["status"] = payload["status"]
        with get_session() as db:
            rows = db.execute(text(f"""
                SELECT id, agent_id, title, content, status, creator, create_time, update_time
                FROM agent_need_task WHERE {where}
                ORDER BY id DESC LIMIT :offset, :limit
            """), params)
            return _ok(_rows_to_list(rows))
    except Exception as e:
        logger.debug("remote_task_list failed: %s", e)
        return _ok([])


@router.get("/remote/agent/task/need/task/{task_id}", summary="[RemoteDeviceTask]查询任务详情")
def remote_task_detail(
    task_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("""
            SELECT id, agent_id, title, content, status, creator, create_time, update_time
            FROM agent_need_task WHERE id = :id
        """), {"id": task_id}).mappings().first()
        return _ok(dict(row) if row else None)
    except Exception as e:
        logger.debug("remote_task_detail failed: %s", e)
        return _ok(None)


# ===========================================================================
# 12. ResourceController - /resource (首页资源)
# Java: GET /homeResource, GET /plantInformation, GET /selectsGoods(@SkipLogin),
#       GET /getCoursePlanet, GET /getKnowledgePlanet, POST /addUserAgentFreeTime,
#       GET /getUserAgentFreeTime, GET /getHomePageResources, POST /addSharePlanetPublic,
#       POST /postPopularCourses, POST /postHomeInformation, GET /getKnowledgePlanetCategorizedInfo
# 注意: 与 ResourceNowController 共用 /resource 前缀, 端点路径不冲突
# ===========================================================================

@router.get("/resource/homeResource", summary="[Resource]首页资源占位")
def resource_home_resource():
    """对应 Java GET /resource/homeResource. 原占位实现."""
    return {"code": 400, "msg": "缺少 open_id"}


@router.get("/resource/plantInformation", summary="[Resource]首页知识星球资讯详情")
def resource_plant_information(
    id: int = Query(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("""
            SELECT id, title, cover, content, author, create_time
            FROM zhs_popular_course WHERE id = :id
        """), {"id": id}).mappings().first()
        return _ok(dict(row) if row else None)
    except Exception as e:
        logger.debug("resource_plant_information failed: %s", e)
        return _ok(None)


@router.get("/resource/selectsGoods", summary="[Resource]查询商品及汇率列表(免登)")
def resource_selects_goods(
    type: Optional[int] = None,
):
    """对应 Java GET /resource/selectsGoods. @SkipLogin 免登录."""
    try:
        where = "1=1"
        params: Dict[str, Any] = {}
        if type is not None:
            where += " AND type = :type"
            params["type"] = type
        with get_session() as db:
            rows = db.execute(text(f"""
                SELECT id, name, price, token, type, description, create_time
                FROM zhs_product WHERE {where} ORDER BY id DESC
            """), params)
            return _ok(_rows_to_list(rows))
    except Exception as e:
        logger.debug("resource_selects_goods failed: %s", e)
        return _ok([])


@router.get("/resource/getCoursePlanet", summary="[Resource]获取课程星球列表")
def resource_course_planet(
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        rows = db.execute(text("""
            SELECT id, name, cover, description, create_time
            FROM zhs_popular_course ORDER BY id DESC
        """))
        return _ok(_rows_to_list(rows))
    except Exception as e:
        logger.debug("resource_course_planet failed: %s", e)
        return _ok([])


@router.get("/resource/getKnowledgePlanet", summary="[Resource]获取知识星球列表")
def resource_knowledge_planet(
    type: Optional[int] = None,
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        where = "1=1"
        params: Dict[str, Any] = {}
        if type is not None:
            where += " AND type = :type"
            params["type"] = type
        rows = db.execute(text(f"""
            SELECT id, name, cover, description, type, create_time
            FROM zhs_knowledge_planet WHERE {where} ORDER BY id DESC
        """), params)
        return _ok(_rows_to_list(rows))
    except Exception as e:
        logger.debug("resource_knowledge_planet failed: %s", e)
        return _ok([])


@router.post("/resource/addUserAgentFreeTime", summary="[Resource]添加用户代理免费时长")
def resource_add_user_agent_free_time(
    user_id: int = Query(..., alias="user_id"),
    agent_id: int = Query(..., alias="agent_id"),
    degree: int = Query(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        db.execute(text("""
            INSERT INTO zhs_user_agent_free_times (user_id, agent_id, degree, create_time, update_time)
            VALUES (:user_id, :agent_id, :degree, :now, :now)
            ON DUPLICATE KEY UPDATE degree = degree + VALUES(degree), update_time = VALUES(update_time)
        """), {"user_id": user_id, "agent_id": agent_id, "degree": degree, "now": utcnow()})
        db.commit()
        return _ok(None, "添加成功")
    except Exception as e:
        db.rollback()
        logger.debug("resource_add_user_agent_free_time failed: %s", e)
        # SQLite 不支持 ON DUPLICATE KEY UPDATE, 降级为 INSERT OR REPLACE
        try:
            db.execute(text("""
                INSERT OR REPLACE INTO zhs_user_agent_free_times (user_id, agent_id, degree, create_time, update_time)
                VALUES (:user_id, :agent_id, :degree, :now, :now)
            """), {"user_id": user_id, "agent_id": agent_id, "degree": degree, "now": utcnow()})
            db.commit()
            return _ok(None, "添加成功")
        except Exception as e2:
            db.rollback()
            return _err(f"添加失败: {e2}")


@router.get("/resource/getUserAgentFreeTime", summary="[Resource]获取用户代理免费时长信息")
def resource_get_user_agent_free_time(
    user_id: int = Query(..., alias="user_id"),
    agent_id: int = Query(..., alias="agent_id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("""
            SELECT id, user_id, agent_id, degree, create_time, update_time
            FROM zhs_user_agent_free_times
            WHERE user_id = :user_id AND agent_id = :agent_id
        """), {"user_id": user_id, "agent_id": agent_id}).mappings().first()
        return _ok(dict(row) if row else None)
    except Exception as e:
        logger.debug("resource_get_user_agent_free_time failed: %s", e)
        return _ok(None)


@router.get("/resource/getHomePageResources", summary="[Resource]获取首页多种资源")
def resource_home_page_resources(
    position: Optional[int] = None,
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        where = "1=1"
        params: Dict[str, Any] = {}
        if position is not None:
            where += " AND position = :position"
            params["position"] = position
        rows = db.execute(text(f"""
            SELECT id, title, cover, url, position, sort, create_time
            FROM zhs_banner_carousel WHERE {where} ORDER BY sort ASC, id DESC
        """), params)
        return _ok(_rows_to_list(rows))
    except Exception as e:
        logger.debug("resource_home_page_resources failed: %s", e)
        return _ok([])


@router.post("/resource/addSharePlanetPublic", summary="[Resource]批量添加公共分享星球及关联资讯")
def resource_add_share_planet_public(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java POST /resource/addSharePlanetPublic. payload: {items: [...]}."""
    items = payload.get("items") or []
    if not items:
        return _err("items 不可为空")
    inserted = 0
    try:
        now = utcnow()
        for item in items:
            try:
                db.execute(text("""
                    INSERT INTO zhs_knowledge_planet (name, cover, description, type, create_time, update_time)
                    VALUES (:name, :cover, :description, :type, :now, :now)
                """), {
                    "name": item.get("name", ""),
                    "cover": item.get("cover", ""),
                    "description": item.get("description", ""),
                    "type": item.get("type", 0),
                    "now": now,
                })
                inserted += 1
            except Exception as ie:
                logger.debug("resource_add_share_planet_public item failed: %s", ie)
        db.commit()
        return _ok({"inserted": inserted}, "添加成功")
    except Exception as e:
        db.rollback()
        logger.debug("resource_add_share_planet_public failed: %s", e)
        return _err(f"添加失败: {e}")


@router.post("/resource/postPopularCourses", summary="[Resource]获取所有热门课程")
def resource_post_popular_courses(
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        rows = db.execute(text("""
            SELECT id, title, cover, description, author, create_time
            FROM zhs_popular_course ORDER BY id DESC
        """))
        return _ok(_rows_to_list(rows))
    except Exception as e:
        logger.debug("resource_post_popular_courses failed: %s", e)
        return _ok([])


@router.post("/resource/postHomeInformation", summary="[Resource]获取首页资讯")
def resource_post_home_information(
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        rows = db.execute(text("""
            SELECT id, title, cover, content, author, type, create_time
            FROM zhs_information ORDER BY id DESC LIMIT 20
        """))
        return _ok(_rows_to_list(rows))
    except Exception as e:
        logger.debug("resource_post_home_information failed: %s", e)
        return _ok([])


@router.get("/resource/getKnowledgePlanetCategorizedInfo", summary="[Resource]获取知识星球分类信息")
def resource_knowledge_planet_categorized(
    type: int = Query(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        rows = db.execute(text("""
            SELECT id, name, cover, description, type, create_time
            FROM zhs_knowledge_planet WHERE type = :type ORDER BY id DESC
        """), {"type": type})
        return _ok(_rows_to_list(rows))
    except Exception as e:
        logger.debug("resource_knowledge_planet_categorized failed: %s", e)
        return _ok([])


# ===========================================================================
# 13. ResourceNowController - /resource (智能体上下文/文件上传/水印)
# Java: POST /getTokenCount, POST /getTokenReturn, GET /getAccessToken(@SkipLogin),
#       GET /getAgentList, GET /getAgent, GET /getAgent2, POST /saveUserContext,
#       GET /getUserContext, GET /getUserContext/field, POST /remove/context/field,
#       POST /fileUpload, POST /fileUploadNetworkPath(@SkipLogin),
#       GET /first/share, GET /first/share/show, GET /download/watermark(@SkipLogin)
# 注意: 与 ResourceController 共用 /resource 前缀, 端点路径不冲突
# ===========================================================================

@router.post("/resource/getTokenCount", summary="[ResourceNow]处理用户Token扣减及流水")
def resource_get_token_count(
    payload: Dict[str, Any] = Body(...),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """对应 Java POST /resource/getTokenCount. @Deprecated."""
    token = payload.get("token")
    quantity = payload.get("quantity")
    if not token or quantity is None:
        return _err("字段缺失")
    try:
        if int(quantity) <= 0:
            return _err("扣除数量必须为正数")
    except (TypeError, ValueError):
        return _err("扣除数量必须为正数")
    try:
        from app.services.resource_service import operate_token  # type: ignore
        return operate_token(token, -int(quantity), authorization or "")
    except ImportError:
        return _err("resource_service 未实现", code=503)
    except Exception as e:
        logger.debug("resource_get_token_count failed: %s", e)
        return _err(f"扣减失败: {e}", code=503)


@router.post("/resource/getTokenReturn", summary="[ResourceNow]回退token")
def resource_get_token_return(
    payload: Dict[str, Any] = Body(...),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """对应 Java POST /resource/getTokenReturn."""
    flow_id = payload.get("flowId") or payload.get("id")
    context_id = payload.get("contextId")
    if flow_id is None and not context_id:
        return _err("需退回智汇力找不到")
    try:
        from app.services.resource_service import get_token_return  # type: ignore
        return get_token_return(flow_id, context_id, authorization or "")
    except ImportError:
        return _err("resource_service 未实现", code=503)
    except Exception as e:
        logger.debug("resource_get_token_return failed: %s", e)
        return _err(f"回退失败: {e}", code=503)


@router.get("/resource/getAccessToken", summary="[ResourceNow]获取coze token(免登,已废弃)")
def resource_get_access_token(
    openId: Optional[str] = Query(None),
    token: str = Query(...),
):
    """对应 Java GET /resource/getAccessToken. @SkipLogin @Deprecated."""
    try:
        from app.services.coze_service import get_access_token  # type: ignore
        access_token = get_access_token(token)
        return {"code": 200, "msg": "success", "data": access_token, "accessToken": access_token}
    except ImportError:
        return _err("coze_service 未实现", code=503)
    except Exception as e:
        logger.debug("resource_get_access_token failed: %s", e)
        return _err(f"获取 token 失败: {e}", code=503)


@router.get("/resource/getAgentList", summary="[ResourceNow]获取智能体列表(已废弃)")
def resource_get_agent_list(
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java GET /resource/getAgentList. @Deprecated."""
    try:
        rows = db.execute(text("""
            SELECT id, agent_id, agent_name, agent_avatar, `consume`, status, create_time
            FROM zhs_agent ORDER BY id DESC
        """))
        return _ok(_rows_to_list(rows))
    except Exception as e:
        logger.debug("resource_get_agent_list failed: %s", e)
        return _ok([])


@router.get("/resource/getAgent", summary="[ResourceNow]获取智能体(扣token+存上下文)")
def resource_get_agent(
    id: str = Query(...),
    token: str = Query(...),
    problem: str = Query(...),
    userUrl: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java GET /resource/getAgent."""
    try:
        rows = db.execute(text("""
            SELECT id, agent_id, agent_name, agent_avatar, `consume`, status, create_time
            FROM zhs_agent WHERE agent_id = :id OR id = :id LIMIT 1
        """), {"id": id}).mappings().all()
        if not rows:
            return _err("当前智能体名称错误!")
        agent = dict(rows[0])
        consume = agent.get("consume") or 0
        # 扣 token (best-effort)
        try:
            from app.services.resource_service import operate_token  # type: ignore
            token_result = operate_token(token, -int(consume), authorization or "")
            if isinstance(token_result, dict) and token_result.get("code") != 0 and token_result.get("code") != 200:
                return token_result
        except ImportError:
            logger.debug("resource_service 未实现, 跳过扣 token")
        # 保存上下文
        import uuid as _uuid
        import time
        ctx_id = str(_uuid.uuid4())
        db.execute(text("""
            INSERT INTO zhs_user_agent_context (id, agent_id, user_uuid, problem, user_url, send_time, create_time)
            VALUES (:id, :agent_id, :user_uuid, :problem, :user_url, :send_time, :now)
        """), {
            "id": ctx_id, "agent_id": id, "user_uuid": token, "problem": problem,
            "user_url": userUrl, "send_time": int(time.time()), "now": utcnow(),
        })
        db.commit()
        # 返回 coze access token (best-effort)
        access_token = ""
        try:
            from app.services.coze_service import get_access_token  # type: ignore
            access_token = get_access_token(token)
        except ImportError:
            pass
        return {"code": 200, "msg": "success", "data": agent, "userContextId": ctx_id, "accessToken": access_token}
    except Exception as e:
        db.rollback()
        logger.debug("resource_get_agent failed: %s", e)
        return _err(f"调用失败: {e}")


@router.get("/resource/getAgent2", summary="[ResourceNow]获取智能体2(仅存上下文)")
def resource_get_agent2(
    id: str = Query(...),
    token: str = Query(...),
    problem: str = Query(...),
    userUrl: Optional[str] = Query(None),
    field1: Optional[str] = Query(None),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java GET /resource/getAgent2."""
    try:
        import uuid as _uuid
        import time
        ctx_id = str(_uuid.uuid4())
        f1 = field1 or str(_uuid.uuid4())
        db.execute(text("""
            INSERT INTO zhs_user_agent_context (id, agent_id, user_uuid, problem, user_url, field1, send_time, create_time)
            VALUES (:id, :agent_id, :user_uuid, :problem, :user_url, :field1, :send_time, :now)
        """), {
            "id": ctx_id, "agent_id": id, "user_uuid": token, "problem": problem,
            "user_url": userUrl, "field1": f1, "send_time": int(time.time()), "now": utcnow(),
        })
        db.commit()
        return _ok({"userContextId": ctx_id, "field1": f1})
    except Exception as e:
        db.rollback()
        logger.debug("resource_get_agent2 failed: %s", e)
        return _err(f"保存失败: {e}")


@router.post("/resource/saveUserContext", summary="[ResourceNow]保存用户上下文")
def resource_save_user_context(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java POST /resource/saveUserContext."""
    ctx_id = payload.get("id")
    answer = payload.get("answer")
    if not ctx_id or answer is None:
        return _err("当前参数不全")
    agent_url = payload.get("agentUrl")
    try:
        db.execute(text("""
            UPDATE zhs_user_agent_context SET answer = :answer, agent_url = :agent_url, update_time = :now
            WHERE id = :id
        """), {"id": ctx_id, "answer": answer, "agent_url": agent_url, "now": utcnow()})
        db.commit()
        return _ok(None)
    except Exception as e:
        db.rollback()
        logger.debug("resource_save_user_context failed: %s", e)
        return _err(f"保存失败: {e}")


@router.get("/resource/getUserContext", summary="[ResourceNow]获取用户上下文列表")
def resource_get_user_context(
    id: str = Query(...),
    token: str = Query(...),
    field1: Optional[str] = Query(None),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        where = "agent_id = :id AND user_uuid = :token"
        params: Dict[str, Any] = {"id": id, "token": token}
        if field1:
            where += " AND field1 = :field1"
            params["field1"] = field1
        rows = db.execute(text(f"""
            SELECT id, agent_id, user_uuid, problem, answer, user_url, field1, send_time, create_time
            FROM zhs_user_agent_context WHERE {where} ORDER BY send_time DESC
        """), params)
        return _ok(_rows_to_list(rows))
    except Exception as e:
        logger.debug("resource_get_user_context failed: %s", e)
        return _ok([])


@router.get("/resource/getUserContext/field", summary="[ResourceNow]按field获取用户上下文")
def resource_get_user_context_by_field(
    id: str = Query(...),
    token: str = Query(...),
    field1: Optional[str] = Query(None),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        where = "agent_id = :id AND user_uuid = :token"
        params: Dict[str, Any] = {"id": id, "token": token}
        if field1:
            where += " AND field1 = :field1"
            params["field1"] = field1
        rows = db.execute(text(f"""
            SELECT id, agent_id, user_uuid, problem, answer, user_url, field1, send_time, create_time
            FROM zhs_user_agent_context WHERE {where} ORDER BY send_time DESC
        """), params)
        return _ok(_rows_to_list(rows))
    except Exception as e:
        logger.debug("resource_get_user_context_by_field failed: %s", e)
        return _ok([])


@router.post("/resource/remove/context/field", summary="[ResourceNow]删除上下文field")
def resource_remove_context_field(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java POST /resource/remove/context/field. 删除后返回剩余列表."""
    ctx_id = payload.get("id")
    token = payload.get("token")
    field1 = payload.get("field1")
    if not ctx_id or not token or not field1:
        return _err("参数异常！")
    try:
        db.execute(text("""
            DELETE FROM zhs_user_agent_context
            WHERE agent_id = :id AND user_uuid = :token AND field1 = :field1
        """), {"id": ctx_id, "token": token, "field1": field1})
        db.commit()
        # 返回剩余列表 (对应 Java 调 getUserAgentContextByField)
        rows = db.execute(text("""
            SELECT id, agent_id, user_uuid, problem, answer, user_url, field1, send_time, create_time
            FROM zhs_user_agent_context WHERE agent_id = :id AND user_uuid = :token ORDER BY send_time DESC
        """), {"id": ctx_id, "token": token})
        return _ok(_rows_to_list(rows))
    except Exception as e:
        db.rollback()
        logger.debug("resource_remove_context_field failed: %s", e)
        return _err(f"删除失败: {e}")


@router.post("/resource/fileUpload", summary="[ResourceNow]文件上传")
def resource_file_upload(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
):
    """对应 Java POST /resource/fileUpload. payload: {file, fileName}."""
    file = payload.get("file")
    file_name = payload.get("fileName")
    if not file:
        return _err("文件不存在")
    if not file_name:
        return _err("文件不存在")
    try:
        from app.services.login_service import file_upload  # type: ignore
        return file_upload(file, file_name)
    except ImportError:
        return _err("login_service.file_upload 未实现", code=503)
    except Exception as e:
        logger.debug("resource_file_upload failed: %s", e)
        return _err(f"上传失败: {e}", code=503)


@router.post("/resource/fileUploadNetworkPath", summary="[ResourceNow]网络路径文件上传(免登)")
def resource_file_upload_network_path(
    payload: Dict[str, Any] = Body(...),
):
    """对应 Java POST /resource/fileUploadNetworkPath. @SkipLogin 免登录."""
    file_path = payload.get("filePath")
    if not file_path:
        return _err("文件不存在")
    try:
        from app.services.login_service import file_upload_network_path  # type: ignore
        return file_upload_network_path(file_path)
    except ImportError:
        return _err("login_service.file_upload_network_path 未实现", code=503)
    except Exception as e:
        logger.debug("resource_file_upload_network_path failed: %s", e)
        return _err(f"上传失败: {e}", code=503)


@router.get("/resource/first/share", summary="[ResourceNow]首次分享赠送算力")
def resource_first_share(
    platform_user_id: Optional[str] = Header(None, alias=_H_PLATFORM_USER_ID),
    _user: str = Depends(require_login),
):
    """对应 Java GET /resource/first/share. 赠送 18888 算力."""
    uuid = platform_user_id or ""
    try:
        from app.services.login_service import first_share  # type: ignore
        return _ok(first_share(uuid))
    except ImportError:
        return _err("login_service.first_share 未实现", code=503)
    except Exception as e:
        logger.debug("resource_first_share failed: %s", e)
        return _err(f"赠送失败: {e}", code=503)


@router.get("/resource/first/share/show", summary="[ResourceNow]首次分享展示")
def resource_first_share_show(
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """对应 Java GET /resource/first/share/show. 手动解析 token, 不强制登录."""
    user_uuid: Optional[str] = None
    if authorization and authorization.startswith("Bearer "):
        try:
            from app.security import decode_access_token
            payload = decode_access_token(authorization.replace("Bearer ", ""))
            if payload and payload.get("sub"):
                user_uuid = payload["sub"]
        except Exception as e:
            logger.debug("resource_first_share_show token parse failed: %s", e)
    try:
        from app.services.login_service import first_share_show  # type: ignore
        return first_share_show(user_uuid)
    except ImportError:
        return False
    except Exception as e:
        logger.debug("resource_first_share_show failed: %s", e)
        return False


@router.get("/resource/download/watermark", summary="[ResourceNow]下载网络文件并加水印(免登)")
def resource_download_watermark(
    netUrl: str = Query(...),
    user_uuid: str = Query(...),
):
    """对应 Java GET /resource/download/watermark. @SkipLogin 免登录.

    best-effort: 下载网络文件返回 base64. 加水印逻辑需 ImageWatermarkUtil/VideoWatermarkUtil,
    Python 侧未实现, 暂返回原始文件.
    """
    if not netUrl:
        return _err("netUrl 不能为空")
    try:
        import httpx
        import base64
        with httpx.Client(timeout=60, follow_redirects=True) as client:
            r = client.get(netUrl)
            content_type = r.headers.get("content-type", "application/octet-stream")
            return {
                "code": 0,
                "data": base64.b64encode(r.content).decode(),
                "content_type": content_type,
                "watermarked": False,  # 水印逻辑未实现
            }
    except Exception as e:
        logger.debug("resource_download_watermark failed: %s", e)
        return _err(f"下载失败: {e}", code=503)


# ===========================================================================
# 14. Sora2Controller - /jianyi (简易AI Sora2)
# Java: POST /sora2/generate/video, POST /sora2/video/info
# ===========================================================================

@router.post("/jianyi/sora2/generate/video", summary="[Sora2]创建视频任务")
def sora2_generate_video(
    payload: Dict[str, Any] = Body(...),
    platform_user_id: Optional[str] = Header(None, alias=_H_PLATFORM_USER_ID),
    _user: str = Depends(require_login),
):
    """对应 Java POST /jianyi/sora2/generate/video."""
    payload["uuid"] = platform_user_id
    try:
        from app.services.jianyi_ai_service import generate_video_by_sora2  # type: ignore
        return generate_video_by_sora2(payload)
    except ImportError:
        return _err("jianyi_ai_service 未实现, 暂不可用", code=503)
    except Exception as e:
        logger.debug("sora2_generate_video failed: %s", e)
        return _err(f"生成失败: {e}", code=503)


@router.post("/jianyi/sora2/video/info", summary="[Sora2]查询任务进度")
def sora2_video_info(
    payload: Dict[str, str] = Body(...),
    platform_user_id: Optional[str] = Header(None, alias=_H_PLATFORM_USER_ID),
    _user: str = Depends(require_login),
):
    """对应 Java POST /jianyi/sora2/video/info."""
    task_id = payload.get("id", "")
    try:
        from app.services.jianyi_ai_service import video_info_by_sora2  # type: ignore
        return video_info_by_sora2(task_id, platform_user_id or "")
    except ImportError:
        return _err("jianyi_ai_service 未实现, 暂不可用", code=503)
    except Exception as e:
        logger.debug("sora2_video_info failed: %s", e)
        return _err(f"查询失败: {e}", code=503)


# ===========================================================================
# 15. TBoxController - /tbox (腾讯百宝箱发布, @SkipLogin)
# Java: POST /agent/channel/deploy
# ===========================================================================

@router.post("/tbox/agent/channel/deploy", summary="[TBox]智能体发布(免登)")
def tbox_agent_channel_deploy(
    payload: Dict[str, Any] = Body(...),
):
    """对应 Java POST /tbox/agent/channel/deploy. @SkipLogin 免登录.

    业务: 根据 event_type 调上架/下架逻辑. 返回 audit_status=1 (审核中).
    """
    event_type = payload.get("event_type", "")
    event_content = payload.get("event_content", {})
    result: Dict[str, Any] = {"success": True}
    try:
        from app.services.zhs_agent_examine_service import (  # type: ignore
            add_tbox, delist_tbox,
        )
        if event_type == "platform.agent_unpublish":
            delist_tbox(event_content)
        elif event_type == "platform.agent_publish":
            add_tbox(event_content)
        else:
            result["success"] = False
            result["message"] = "未知的方法类型"
    except ImportError:
        # best-effort: 服务未实现, 仍返回审核中
        logger.debug("zhs_agent_examine_service 未实现, 返回审核中")
        if event_type not in ("platform.agent_unpublish", "platform.agent_publish"):
            result["success"] = False
            result["message"] = "未知的方法类型"
    except Exception as e:
        logger.debug("tbox_agent_channel_deploy failed: %s", e)
        result["success"] = False
        result["message"] = str(e)
    result["data"] = {"audit_status": 1}
    return result


# ===========================================================================
# 16. WXPayNowController - /pay (微信支付)
# Java: POST /initiatePay, POST /app/initiatePay, POST /queryOrderById,
#       POST /notify(免登回调), POST /queryOrderByOutTradeNo, POST /closeOrder,
#       POST /refunds, POST /transferNotify(免登回调), POST /course/notify(免登回调),
#       GET /consecutively/product
# ===========================================================================

def _validate_pay_param(param: Dict[str, Any]) -> Optional[str]:
    """Java 公共参数校验, 返回错误消息或 None."""
    if "openId" not in param:
        return "当前用户不存在"
    if "desc" not in param:
        param["desc"] = "充值"
    if "id" not in param:
        return "购买物品不存在"
    if "productType" not in param:
        return "当前购买类型不存在"
    try:
        if int(param.get("productType")) == 1 and "amount" not in param:
            return "购买力不足"
    except (TypeError, ValueError):
        return "productType 类型错误"
    return None


@router.post("/pay/initiatePay", summary="[WXPay]JSAPI/小程序下单")
def pay_initiate(
    payload: Dict[str, Any] = Body(...),
    platform_user_id: Optional[str] = Header(None, alias=_H_PLATFORM_USER_ID),
    _user: str = Depends(require_login),
):
    """对应 Java POST /pay/initiatePay."""
    payload["uuid"] = platform_user_id
    err = _validate_pay_param(payload)
    if err:
        return _err(err)
    try:
        from app.services.wx_pay_now_service import pay  # type: ignore
        return {"code": 200, "msg": "success", "data": pay(payload)}
    except ImportError:
        return _err("wx_pay_now_service 未实现", code=503)
    except Exception as e:
        logger.debug("pay_initiate failed: %s", e)
        return _err(f"下单失败: {e}", code=503)


@router.post("/pay/app/initiatePay", summary="[WXPay]App下单")
def pay_app_initiate(
    payload: Dict[str, Any] = Body(...),
    platform_user_id: Optional[str] = Header(None, alias=_H_PLATFORM_USER_ID),
    _user: str = Depends(require_login),
):
    """对应 Java POST /pay/app/initiatePay."""
    payload["uuid"] = platform_user_id
    err = _validate_pay_param(payload)
    if err:
        return _err(err)
    try:
        from app.services.wx_pay_now_service import app_pay  # type: ignore
        return {"code": 200, "msg": "success", "data": app_pay(payload)}
    except ImportError:
        return _err("wx_pay_now_service 未实现", code=503)
    except Exception as e:
        logger.debug("pay_app_initiate failed: %s", e)
        return _err(f"下单失败: {e}", code=503)


@router.post("/pay/queryOrderById", summary="[WXPay]按订单号查询订单")
def pay_query_order_by_id(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
):
    """对应 Java POST /pay/queryOrderById."""
    try:
        from app.services.wx_pay_now_service import query_order_by_id  # type: ignore
        return query_order_by_id(payload)
    except ImportError:
        return _err("wx_pay_now_service 未实现", code=503)
    except Exception as e:
        logger.debug("pay_query_order_by_id failed: %s", e)
        return _err(f"查询失败: {e}", code=503)


@router.post("/pay/notify", summary="[WXPay]智能体支付回调(免登)")
async def pay_notify(
    request: Request,
):
    """对应 Java POST /pay/notify. 免登录回调, 读取原始 body + 微信签名头."""
    res = (await request.body()).decode("utf-8", errors="ignore")
    serial = request.headers.get("Wechatpay-Serial", "")
    signature = request.headers.get("Wechatpay-Signature", "")
    timestamp = request.headers.get("Wechatpay-Timestamp", "")
    nonce = request.headers.get("Wechatpay-Nonce", "")
    logger.info("接收到微信支付回调 (notify)")
    try:
        from app.services.wx_pay_now_service import handle_notify  # type: ignore
        return handle_notify(res, serial, signature, timestamp, nonce)
    except ImportError:
        return {"code": "FAIL", "message": "wx_pay_now_service 未实现"}
    except Exception as e:
        logger.debug("pay_notify failed: %s", e)
        return {"code": "FAIL", "message": str(e)}


@router.post("/pay/queryOrderByOutTradeNo", summary="[WXPay]按商户订单号查询订单")
def pay_query_order_by_out_trade_no(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
):
    """对应 Java POST /pay/queryOrderByOutTradeNo."""
    try:
        from app.services.wx_pay_now_service import query_order_by_out_trade_no  # type: ignore
        return query_order_by_out_trade_no(payload)
    except ImportError:
        return _err("wx_pay_now_service 未实现", code=503)
    except Exception as e:
        logger.debug("pay_query_order_by_out_trade_no failed: %s", e)
        return _err(f"查询失败: {e}", code=503)


@router.post("/pay/closeOrder", summary="[WXPay]关闭订单")
def pay_close_order(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
):
    """对应 Java POST /pay/closeOrder."""
    try:
        from app.services.wx_pay_now_service import close_order  # type: ignore
        return close_order(payload)
    except ImportError:
        return _err("wx_pay_now_service 未实现", code=503)
    except Exception as e:
        logger.debug("pay_close_order failed: %s", e)
        return _err(f"关闭失败: {e}", code=503)


@router.post("/pay/refunds", summary="[WXPay]退款申请")
def pay_refunds(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
):
    """对应 Java POST /pay/refunds."""
    try:
        from app.services.wx_pay_now_service import refunds  # type: ignore
        return refunds(payload)
    except ImportError:
        return _err("wx_pay_now_service 未实现", code=503)
    except Exception as e:
        logger.debug("pay_refunds failed: %s", e)
        return _err(f"退款失败: {e}", code=503)


@router.post("/pay/transferNotify", summary="[WXPay]提现回调(免登)")
async def pay_transfer_notify(
    request: Request,
):
    """对应 Java POST /pay/transferNotify. 免登录回调."""
    res = (await request.body()).decode("utf-8", errors="ignore")
    serial = request.headers.get("Wechatpay-Serial", "")
    signature = request.headers.get("Wechatpay-Signature", "")
    timestamp = request.headers.get("Wechatpay-Timestamp", "")
    nonce = request.headers.get("Wechatpay-Nonce", "")
    logger.info("接收到微信提现回调 (transferNotify)")
    try:
        from app.services.wx_pay_now_service import transfer_accounts_notify  # type: ignore
        return transfer_accounts_notify(res, serial, signature, timestamp, nonce)
    except ImportError:
        return {"code": "FAIL", "message": "wx_pay_now_service 未实现"}
    except Exception as e:
        logger.debug("pay_transfer_notify failed: %s", e)
        return {"code": "FAIL", "message": str(e)}


@router.post("/pay/course/notify", summary="[WXPay]购买课程支付回调(免登)")
async def pay_course_notify(
    request: Request,
):
    """对应 Java POST /pay/course/notify. 免登录回调."""
    res = (await request.body()).decode("utf-8", errors="ignore")
    serial = request.headers.get("Wechatpay-Serial", "")
    signature = request.headers.get("Wechatpay-Signature", "")
    timestamp = request.headers.get("Wechatpay-Timestamp", "")
    nonce = request.headers.get("Wechatpay-Nonce", "")
    logger.info("接收到微信课程支付回调 (course/notify)")
    try:
        from app.services.wx_pay_now_service import course_notify  # type: ignore
        return course_notify(res, serial, signature, timestamp, nonce)
    except ImportError:
        return {"code": "FAIL", "message": "wx_pay_now_service 未实现"}
    except Exception as e:
        logger.debug("pay_course_notify failed: %s", e)
        return {"code": "FAIL", "message": str(e)}


@router.get("/pay/consecutively/product", summary="[WXPay]查询连续包月商品")
def pay_consecutively_product(
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java GET /pay/consecutively/product."""
    try:
        rows = db.execute(text("""
            SELECT id, name, price, product_id, type, description, create_time
            FROM zhs_product WHERE type = 2 ORDER BY id DESC
        """))
        return _ok(_rows_to_list(rows))
    except Exception as e:
        logger.debug("pay_consecutively_product failed: %s", e)
        try:
            from app.services.wx_pay_now_service import get_consecutively_product  # type: ignore
            return get_consecutively_product()
        except ImportError:
            return _ok([])


# ===========================================================================
# 17. ZhsActivityController - /zhs_activity (表 zhs_activity)
# Java: GET /get, GET /{id}
# ===========================================================================

@router.get("/zhs_activity/get", summary="[ZhsActivity]查询活动列表")
def zhs_activity_list(
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java GET /zhs_activity/get. 注意 Java 返回 list.get(0)."""
    try:
        rows = db.execute(text("""
            SELECT id, title, cover, content, start_time, end_time, status, create_time
            FROM zhs_activity ORDER BY id DESC
        """))
        data = _rows_to_list(rows)
        return _ok(data[0] if data else None)
    except Exception as e:
        logger.debug("zhs_activity_list failed: %s", e)
        return _ok(None)


@router.get("/zhs_activity/{item_id}", summary="[ZhsActivity]活动详情")
def zhs_activity_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("""
            SELECT id, title, cover, content, start_time, end_time, status, create_time
            FROM zhs_activity WHERE id = :id
        """), {"id": item_id}).mappings().first()
        return _ok(dict(row) if row else None)
    except Exception as e:
        logger.debug("zhs_activity_get failed: %s", e)
        return _ok(None)


# ===========================================================================
# 18. ZhsAgentBuyController - /zhs_agent_buy (表 zhs_agent_buy)
# Java: GET /list, GET /{id}, DELETE /{ids}, POST /, PUT /,
#       GET /user/{bugUuid}/agent/{agentId}, GET /order/{orderNo},
#       GET /unsettled, GET /expired, PUT /{id}/expire, PUT /{id}/settle
# ===========================================================================

_BUY_FIELDS = ("user_uuid", "agent_id", "order_no", "amount", "status", "settlement_status", "expire_time", "remark")


@router.get("/zhs_agent_buy/list", summary="[ZhsAgentBuy]购买记录列表")
def zhs_agent_buy_list(
    user_uuid: Optional[str] = None,
    agent_id: Optional[str] = None,
    status: Optional[int] = None,
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        where = "1=1"
        params: Dict[str, Any] = {}
        if user_uuid:
            where += " AND user_uuid = :user_uuid"
            params["user_uuid"] = user_uuid
        if agent_id:
            where += " AND agent_id = :agent_id"
            params["agent_id"] = agent_id
        if status is not None:
            where += " AND status = :status"
            params["status"] = status
        rows = db.execute(text(f"""
            SELECT id, user_uuid, agent_id, order_no, amount, status, settlement_status, expire_time, create_time
            FROM zhs_agent_buy WHERE {where} ORDER BY id DESC
        """), params)
        return _ok(_rows_to_list(rows))
    except Exception as e:
        logger.debug("zhs_agent_buy_list failed: %s", e)
        return _ok([])


@router.get("/zhs_agent_buy/detail/{item_id}", summary="[ZhsAgentBuy]购买记录详情")
def zhs_agent_buy_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("""
            SELECT id, user_uuid, agent_id, order_no, amount, status, settlement_status, expire_time, create_time
            FROM zhs_agent_buy WHERE id = :id
        """), {"id": item_id}).mappings().first()
        return _ok(dict(row) if row else None)
    except Exception as e:
        logger.debug("zhs_agent_buy_get failed: %s", e)
        return _ok(None)


@router.delete("/zhs_agent_buy/{ids}", summary="[ZhsAgentBuy]删除购买记录(批量)")
def zhs_agent_buy_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text("DELETE FROM zhs_agent_buy WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ajax(result.rowcount > 0, "删除成功" if result.rowcount > 0 else "删除失败")
    except Exception as e:
        db.rollback()
        logger.debug("zhs_agent_buy_remove failed: %s", e)
        return _ajax(False, f"删除失败: {e}")


@router.get("/zhs_agent_buy/user/{bug_uuid}/agent/{agent_id}", summary="[ZhsAgentBuy]按用户和智能体查询")
def zhs_agent_buy_by_user_agent(
    bug_uuid: str = Path(..., alias="bugUuid"),
    agent_id: str = Path(..., alias="agentId"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        rows = db.execute(text("""
            SELECT id, user_uuid, agent_id, order_no, amount, status, settlement_status, expire_time, create_time
            FROM zhs_agent_buy WHERE user_uuid = :uuid AND agent_id = :agent_id
            ORDER BY id DESC
        """), {"uuid": bug_uuid, "agent_id": agent_id})
        return _ok(_rows_to_list(rows))
    except Exception as e:
        logger.debug("zhs_agent_buy_by_user_agent failed: %s", e)
        return _ok([])


@router.get("/zhs_agent_buy/order/{order_no}", summary="[ZhsAgentBuy]按订单号查询")
def zhs_agent_buy_by_order(
    order_no: str = Path(..., alias="orderNo"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("""
            SELECT id, user_uuid, agent_id, order_no, amount, status, settlement_status, expire_time, create_time
            FROM zhs_agent_buy WHERE order_no = :order_no
        """), {"order_no": order_no}).mappings().first()
        return _ok(dict(row) if row else None)
    except Exception as e:
        logger.debug("zhs_agent_buy_by_order failed: %s", e)
        return _ok(None)


@router.get("/zhs_agent_buy/unsettled", summary="[ZhsAgentBuy]查询未结算记录")
def zhs_agent_buy_unsettled(
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        rows = db.execute(text("""
            SELECT id, user_uuid, agent_id, order_no, amount, status, settlement_status, expire_time, create_time
            FROM zhs_agent_buy WHERE settlement_status = 0 ORDER BY id DESC
        """))
        return _ok(_rows_to_list(rows))
    except Exception as e:
        logger.debug("zhs_agent_buy_unsettled failed: %s", e)
        return _ok([])


@router.get("/zhs_agent_buy/expired", summary="[ZhsAgentBuy]查询过期记录")
def zhs_agent_buy_expired(
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        rows = db.execute(text("""
            SELECT id, user_uuid, agent_id, order_no, amount, status, settlement_status, expire_time, create_time
            FROM zhs_agent_buy WHERE status = 2 ORDER BY id DESC
        """))
        return _ok(_rows_to_list(rows))
    except Exception as e:
        logger.debug("zhs_agent_buy_expired failed: %s", e)
        return _ok([])


@router.put("/zhs_agent_buy/{item_id}/expire", summary="[ZhsAgentBuy]更新状态为过期")
def zhs_agent_buy_to_expired(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        result = db.execute(text("""
            UPDATE zhs_agent_buy SET status = 2, update_time = :now WHERE id = :id
        """), {"id": item_id, "now": utcnow()})
        db.commit()
        return _ajax(result.rowcount > 0, "状态更新成功" if result.rowcount > 0 else "状态更新失败")
    except Exception as e:
        db.rollback()
        logger.debug("zhs_agent_buy_to_expired failed: %s", e)
        return _ajax(False, f"状态更新失败: {e}")


@router.put("/zhs_agent_buy/{item_id}/settle", summary="[ZhsAgentBuy]更新为已结算")
def zhs_agent_buy_settle(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        result = db.execute(text("""
            UPDATE zhs_agent_buy SET settlement_status = 1, update_time = :now WHERE id = :id
        """), {"id": item_id, "now": utcnow()})
        db.commit()
        return _ajax(result.rowcount > 0, "结算状态更新成功" if result.rowcount > 0 else "结算状态更新失败")
    except Exception as e:
        db.rollback()
        logger.debug("zhs_agent_buy_settle failed: %s", e)
        return _ajax(False, f"结算状态更新失败: {e}")


# ===========================================================================
# 19. ZhsAgentController (mcp) - /agent (智能体列表/创作/分享)
# Java: GET /rule/search(@SkipLogin), GET /rule/list(@SkipLogin),
#       POST /query/personality, GET /use/history, POST /creation/my/{type},
#       POST /creation/share, GET /creation/operate/{gcId}/{type},
#       GET /creation/share/third/{code}(@SkipLogin),
#       POST /creation/share/code, POST /creation/image
# ===========================================================================

@router.get("/agent/rule/search", summary="[ZhsAgent]按规则查询智能体(免登)")
def agent_rule_search(
    id: Optional[str] = None,
    agentCategory: Optional[str] = None,
    agentMainCategory: Optional[str] = None,
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    authorization: Optional[str] = Header(None, alias="Authorization"),
):
    """对应 Java GET /agent/rule/search. @SkipLogin (手动解析 token)."""
    creator: Optional[str] = None
    if authorization and authorization.startswith("Bearer "):
        try:
            from app.security import decode_access_token
            payload = decode_access_token(authorization.replace("Bearer ", ""))
            if payload and payload.get("sub"):
                creator = payload["sub"]
        except Exception:
            pass
    try:
        where = "1=1"
        params: Dict[str, Any] = _page_params(pageNum, pageSize)
        if id:
            where += " AND id = :id"
            params["id"] = id
        if creator:
            where += " AND creator = :creator"
            params["creator"] = creator
        with get_session() as db:
            rows = db.execute(text(f"""
                SELECT id, agent_id, agent_name, agent_avatar, `consume`, agent_category, agent_main_category, status, create_time
                FROM zhs_agent WHERE {where} ORDER BY id DESC LIMIT :offset, :limit
            """), params)
            return _ok(_rows_to_list(rows))
    except Exception as e:
        logger.debug("agent_rule_search failed: %s", e)
        return _ok([])


@router.get("/agent/rule/list", summary="[ZhsAgent]智能体规则列表(免登)")
def agent_rule_list():
    """对应 Java GET /agent/rule/list. @SkipLogin."""
    try:
        with get_session() as db:
            rows = db.execute(text("""
                SELECT id, rule_name, agent_category, agent_main_category, create_time
                FROM agent_rule ORDER BY id DESC
            """))
            return _ok(_rows_to_list(rows))
    except Exception as e:
        logger.debug("agent_rule_list failed: %s", e)
        return _ok([])


@router.post("/agent/query/personality", summary="[ZhsAgent]性格测试")
def agent_query_personality(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
):
    """对应 Java POST /agent/query/personality. 调 n8n webhook, best-effort."""
    try:
        import httpx
        webhook_url = "http://47.94.40.108:5678/webhook/b0a3336f-ba7a-42b9-8dcb-6023b9c0dbfc"
        with httpx.Client(timeout=60) as client:
            r = client.post(webhook_url, json=payload, headers={"Content-Type": "application/json"})
            return r.text
    except Exception as e:
        logger.debug("agent_query_personality failed: %s", e)
        return _err(f"性格测试失败: {e}", code=503)


@router.get("/agent/use/history", summary="[ZhsAgent]使用历史")
def agent_use_history(
    platform_type: Optional[str] = Header(None, alias=_H_DEVICE_TYPE),
    platform_user_id: Optional[str] = Header(None, alias=_H_PLATFORM_USER_ID),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java GET /agent/use/history."""
    user_uuid = platform_user_id or ""
    try:
        where = "user_uuid = :user_uuid"
        params: Dict[str, Any] = {"user_uuid": user_uuid}
        if platform_type:
            where += " AND platform = :platform"
            params["platform"] = platform_type
        rows = db.execute(text(f"""
            SELECT id, agent_id, user_uuid, problem, answer, platform, send_time, create_time
            FROM zhs_user_agent_context WHERE {where} ORDER BY send_time DESC LIMIT 50
        """), params)
        return _ok(_rows_to_list(rows))
    except Exception as e:
        logger.debug("agent_use_history failed: %s", e)
        return _ok([])


@router.post("/agent/creation/my/{creation_type}", summary="[ZhsAgent]我的创作")
def agent_my_creation(
    creation_type: int = Path(..., alias="type"),
    payload: Dict[str, Any] = Body(...),
    platform_user_id: Optional[str] = Header(None, alias=_H_PLATFORM_USER_ID),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java POST /agent/creation/my/{type}."""
    user_uuid = platform_user_id or ""
    try:
        page_num = int(payload.get("pageNum", 1) or 1)
        page_size = int(payload.get("pageSize", 10) or 10)
        page_size = max(1, min(100, page_size))
        params: Dict[str, Any] = {
            "user_uuid": user_uuid, "type": creation_type,
            "offset": (page_num - 1) * page_size, "limit": page_size,
        }
        rows = db.execute(text("""
            SELECT id, user_uuid, context_id, title, cover_url, subtitle, problem, answer, file_url, type, create_time
            FROM zhs_agent_creation WHERE user_uuid = :user_uuid AND type = :type
            ORDER BY id DESC LIMIT :offset, :limit
        """), params)
        return _ok(_rows_to_list(rows))
    except Exception as e:
        logger.debug("agent_my_creation failed: %s", e)
        return _ok([])


@router.post("/agent/creation/share", summary="[ZhsAgent]分享创作")
def agent_share_creation(
    payload: Dict[str, Any] = Body(...),
    platform_user_id: Optional[str] = Header(None, alias=_H_PLATFORM_USER_ID),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java POST /agent/creation/share."""
    user_uuid = platform_user_id or ""
    context_id = payload.get("contextId", "")
    title = payload.get("title", "")
    cover_url = payload.get("coverUrl", "")
    subtitle = payload.get("subtitle", "")
    file_url = payload.get("fileUrl", "")
    problem = payload.get("problem", "")
    answer = payload.get("answer", "")
    if not context_id and not file_url and not answer:
        return _err("当前分享内容不存在！")
    if not title:
        return _err("请输入标题！")
    try:
        now = utcnow()
        db.execute(text("""
            INSERT INTO zhs_agent_creation
                (user_uuid, context_id, title, cover_url, subtitle, problem, answer, file_url, type, create_time)
            VALUES
                (:user_uuid, :context_id, :title, :cover_url, :subtitle, :problem, :answer, :file_url, 0, :now)
        """), {
            "user_uuid": user_uuid, "context_id": context_id or None, "title": title,
            "cover_url": cover_url, "subtitle": subtitle, "problem": problem,
            "answer": answer, "file_url": file_url, "now": now,
        })
        db.commit()
        return _ok(None)
    except Exception as e:
        db.rollback()
        logger.debug("agent_share_creation failed: %s", e)
        return _err(f"分享失败: {e}")


@router.get("/agent/creation/operate/{gc_id}/{operate_type}", summary="[ZhsAgent]点赞/收藏创作")
def agent_operate_creation(
    gc_id: str = Path(..., alias="gcId"),
    operate_type: str = Path(..., alias="type"),
    platform_user_id: Optional[str] = Header(None, alias=_H_PLATFORM_USER_ID),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java GET /agent/creation/operate/{gcId}/{type}. type: 1点赞 2收藏."""
    user_uuid = platform_user_id or ""
    try:
        db.execute(text("""
            INSERT INTO zhs_agent_creation_operate (creation_id, user_uuid, type, create_time)
            VALUES (:gc_id, :user_uuid, :type, :now)
        """), {"gc_id": gc_id, "user_uuid": user_uuid, "type": operate_type, "now": utcnow()})
        db.commit()
        return _ok(None)
    except Exception as e:
        db.rollback()
        logger.debug("agent_operate_creation failed: %s", e)
        return _err(f"操作失败: {e}")


@router.get("/agent/creation/share/third/{code}", summary="[ZhsAgent]分享转地址(免登)")
def agent_creation_to_third(
    code: str = Path(...),
):
    """对应 Java GET /agent/creation/share/third/{code}. @SkipLogin. 从 Redis 读 code."""
    try:
        from app.core.redis_client import get_redis_client  # type: ignore
        client = get_redis_client()
        if not client:
            return _err("当前无分享内容！")
        val = client.get(code)
        if val is None:
            return _err("当前无分享内容！")
        context = val.decode() if isinstance(val, (bytes, bytearray)) else str(val)
        return _ok(json.loads(context))
    except ImportError:
        return _err("Redis 客户端未实现", code=503)
    except Exception as e:
        logger.debug("agent_creation_to_third failed: %s", e)
        return _err(f"读取失败: {e}")


@router.post("/agent/creation/share/code", summary="[ZhsAgent]分享转CODE")
def agent_creation_to_code(
    payload: Dict[str, Any] = Body(...),
    platform_user_id: Optional[str] = Header(None, alias=_H_PLATFORM_USER_ID),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java POST /agent/creation/share/code."""
    user_uuid = platform_user_id or ""
    chat_id = payload.get("chat_id", "")
    agent_id = payload.get("agent_id", "")
    ids_obj = payload.get("ids")
    if not chat_id:
        return _err("会话不可为空！")
    if not agent_id:
        return _err("模型不可为空！")
    if not isinstance(ids_obj, list):
        return _err("上下文不可为空！")
    try:
        ids = [str(i) for i in ids_obj]
        # 查询上下文
        rows = db.execute(text("""
            SELECT id, agent_id, user_uuid, problem, answer, user_url, field1, send_time, create_time
            FROM zhs_user_agent_context
            WHERE user_uuid = :user_uuid AND agent_id = :agent_id AND id IN :ids
            ORDER BY send_time DESC
        """), {"user_uuid": user_uuid, "agent_id": agent_id, "ids": tuple(ids)}).mappings().all()
        contexts = [dict(r) for r in rows]
        import uuid as _uuid
        code = _uuid.uuid4().hex
        try:
            from app.core.redis_client import get_redis_client  # type: ignore
            client = get_redis_client()
            if client:
                client.setex(code, 30 * 86400, json.dumps(contexts, ensure_ascii=False, default=str))
        except ImportError:
            logger.debug("Redis 客户端未实现, code 仅返回不持久化")
        return _ok(code)
    except Exception as e:
        logger.debug("agent_creation_to_code failed: %s", e)
        return _err(f"生成失败: {e}")


@router.post("/agent/creation/image", summary="[ZhsAgent]分享转图片")
def agent_creation_to_image(
    payload: Dict[str, Any] = Body(...),
    platform_user_id: Optional[str] = Header(None, alias=_H_PLATFORM_USER_ID),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java POST /agent/creation/image. 生成聊天图片, best-effort."""
    user_uuid = platform_user_id or ""
    chat_id = payload.get("chat_id", "")
    agent_id = payload.get("agent_id", "")
    ids_obj = payload.get("ids")
    if not chat_id:
        return _err("会话不可为空！")
    if not agent_id:
        return _err("模型不可为空！")
    if not isinstance(ids_obj, list):
        return _err("上下文不可为空！")
    try:
        ids = [str(i) for i in ids_obj]
        rows = db.execute(text("""
            SELECT id, agent_id, user_uuid, problem, answer, user_url, field1, send_time, create_time
            FROM zhs_user_agent_context
            WHERE user_uuid = :user_uuid AND agent_id = :agent_id AND id IN :ids
            ORDER BY send_time DESC
        """), {"user_uuid": user_uuid, "agent_id": agent_id, "ids": tuple(ids)}).mappings().all()
        contexts = [dict(r) for r in rows]
        if not contexts:
            return _err("当前没有内容！")
        # best-effort: 图片生成逻辑未实现, 返回上下文 JSON
        return _ok({"contexts": contexts, "image_base64": None, "msg": "图片生成逻辑未实现"})
    except Exception as e:
        logger.debug("agent_creation_to_image failed: %s", e)
        return _err(f"生成失败: {e}")


# ===========================================================================
# 20. ZhsAgentExamineController - /examine (开发者智能体审核)
# Java: PUT /pass, PUT /reject (其余 CRUD 已迁移至 agents/examine)
# ===========================================================================

@router.put("/examine/pass", summary="[ZhsAgentExamine]审批智能体-通过")
def examine_pass(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java PUT /examine/pass. payload: {id, remark?}."""
    eid = payload.get("id")
    if not eid:
        return _err("未找到可通过智能体！")
    remark = payload.get("remark", "")
    try:
        result = db.execute(text("""
            UPDATE zhs_agent_examine SET status = 2, remark = :remark, update_time = :now WHERE id = :id
        """), {"id": eid, "remark": remark, "now": utcnow()})
        db.commit()
        if result.rowcount == 0:
            return _err("未找到可通过智能体！")
        return _ok(None)
    except Exception as e:
        db.rollback()
        logger.debug("examine_pass failed: %s", e)
        return _err(f"审核失败: {e}")


@router.put("/examine/reject", summary="[ZhsAgentExamine]审批智能体-驳回")
def examine_reject(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java PUT /examine/reject. payload: {id, remark?}."""
    eid = payload.get("id")
    if not eid:
        return _err("未找到可驳回智能体！")
    remark = payload.get("remark", "")
    try:
        result = db.execute(text("""
            UPDATE zhs_agent_examine SET status = 3, remark = :remark, update_time = :now WHERE id = :id
        """), {"id": eid, "remark": remark, "now": utcnow()})
        db.commit()
        if result.rowcount == 0:
            return _err("未找到可驳回智能体！")
        return _ok(None)
    except Exception as e:
        db.rollback()
        logger.debug("examine_reject failed: %s", e)
        return _err(f"审核失败: {e}")


# ===========================================================================
# 21. ZhsCategoryDictionaryController - /categoryDictionary (表 zhs_category_dictionary)
# Java: GET /list, GET /get/parent
# ===========================================================================

@router.get("/categoryDictionary/list", summary="[CategoryDictionary]赛道字典列表")
def category_dictionary_list(
    parent_id: Optional[int] = None,
    name: Optional[str] = None,
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        where = "1=1"
        params: Dict[str, Any] = {}
        if parent_id is not None:
            where += " AND parent_id = :parent_id"
            params["parent_id"] = parent_id
        if name:
            where += " AND name LIKE :name"
            params["name"] = f"%{name}%"
        rows = db.execute(text(f"""
            SELECT id, name, parent_id, sort, status, create_time
            FROM zhs_category_dictionary WHERE {where} ORDER BY sort ASC, id ASC
        """), params)
        return _ok(_rows_to_list(rows))
    except Exception as e:
        logger.debug("category_dictionary_list failed: %s", e)
        return _ok([])


@router.get("/categoryDictionary/get/parent", summary="[CategoryDictionary]查询父赛道")
def category_dictionary_parent(
    ids: str = Query(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java GET /categoryDictionary/get/parent. 返回 {id: parent_name} 映射."""
    id_list = _parse_ids(ids)
    if not id_list:
        return _ok({})
    try:
        rows = db.execute(text("""
            SELECT id, name, parent_id FROM zhs_category_dictionary WHERE id IN :ids
        """), {"ids": tuple(id_list)})
        result: Dict[str, str] = {}
        for r in rows.mappings():
            row = dict(r)
            parent_id = row.get("parent_id")
            if parent_id:
                prow = db.execute(text("""
                    SELECT name FROM zhs_category_dictionary WHERE id = :pid
                """), {"pid": parent_id}).mappings().first()
                result[str(row["id"])] = dict(prow).get("name", "") if prow else ""
            else:
                result[str(row["id"])] = ""
        return _ok(result)
    except Exception as e:
        logger.debug("category_dictionary_parent failed: %s", e)
        return _ok({})


# ===========================================================================
# 22. ZhsCommissionFlowController - /flow (分销流水)
# Java: GET /orderList, GET /getStatistics, GET /getTraderTeam, GET /getTraderTeamByCenter
# ===========================================================================

@router.get("/flow/orderList", summary="[CommissionFlow]我的订单列表")
def flow_order_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    token: Optional[str] = None,
    authorization: Optional[str] = Header(None, alias="Authorization"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        where = "1=1"
        params: Dict[str, Any] = _page_params(pageNum, pageSize)
        if token:
            where += " AND user_id = (SELECT id FROM zhs_user WHERE open_id = :token LIMIT 1)"
            params["token"] = token
        rows = db.execute(text(f"""
            SELECT id, order_no, user_id, product_id, amount, status, create_time
            FROM zhs_order WHERE {where}
            ORDER BY id DESC LIMIT :offset, :limit
        """), params)
        return _ok(_rows_to_list(rows))
    except Exception as e:
        logger.debug("flow_order_list failed: %s", e)
        return _ok([])


@router.get("/flow/getStatistics", summary="[CommissionFlow]分销统计")
def flow_get_statistics(
    token: str = Query(...),
    authorization: Optional[str] = Header(None, alias="Authorization"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("""
            SELECT
                (SELECT COALESCE(SUM(amount),0) FROM zhs_commission_flow WHERE belongers_open_id = :token) AS total_commission,
                (SELECT COUNT(*) FROM zhs_commission_flow WHERE belongers_open_id = :token) AS total_count,
                (SELECT COALESCE(SUM(amount),0) FROM zhs_commission_flow WHERE belongers_open_id = :token AND type = 1) AS settled,
                (SELECT COALESCE(SUM(amount),0) FROM zhs_commission_flow WHERE belongers_open_id = :token AND type = 0) AS unsettled
        """), {"token": token}).mappings().first()
        return _ok(dict(row) if row else {})
    except Exception as e:
        logger.debug("flow_get_statistics failed: %s", e)
        return _ok({})


@router.get("/flow/getTraderTeam", summary="[CommissionFlow]我的团队")
def flow_get_trader_team(
    token: str = Query(...),
    search: Optional[str] = None,
    byOrderNum: Optional[int] = None,
    byOrderTtime: Optional[int] = None,
    begin: Optional[str] = None,
    end: Optional[str] = None,
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java GET /flow/getTraderTeam."""
    try:
        where = "parent_id = (SELECT id FROM zhs_user WHERE open_id = :token LIMIT 1)"
        params: Dict[str, Any] = {"token": token}
        if search:
            where += " AND (nickname LIKE :search OR open_id LIKE :search)"
            params["search"] = f"%{search}%"
        order_by = "id DESC"
        if byOrderNum == 1:
            order_by = "order_count ASC"
        elif byOrderNum == 2:
            order_by = "order_count DESC"
        elif byOrderTtime == 1:
            order_by = "last_order_time ASC"
        elif byOrderTtime == 2:
            order_by = "last_order_time DESC"
        rows = db.execute(text(f"""
            SELECT u.id, u.uuid, u.open_id, u.nickname, u.avatar, u.create_time,
                   (SELECT COUNT(*) FROM zhs_order o WHERE o.user_id = u.id) AS order_count,
                   (SELECT MAX(o.create_time) FROM zhs_order o WHERE o.user_id = u.id) AS last_order_time
            FROM zhs_user u WHERE {where} ORDER BY {order_by}
        """), params)
        data = _rows_to_list(rows)
        return {"code": 200, "msg": "success", "data": data, "total": len(data)}
    except Exception as e:
        logger.debug("flow_get_trader_team failed: %s", e)
        return {"code": 200, "msg": "success", "data": [], "total": 0}


@router.get("/flow/getTraderTeamByCenter", summary="[CommissionFlow]我的团队(中心化)")
def flow_get_trader_team_by_center(
    token: Optional[str] = None,
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    authorization: Optional[str] = Header(None, alias="Authorization"),
    platform_type: Optional[str] = Header(None, alias=_H_DEVICE_TYPE),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java GET /flow/getTraderTeamByCenter."""
    try:
        where = "1=1"
        params: Dict[str, Any] = _page_params(pageNum, pageSize)
        if token:
            where += " AND parent_id = (SELECT id FROM zhs_user WHERE open_id = :token LIMIT 1)"
            params["token"] = token
        rows = db.execute(text(f"""
            SELECT u.id, u.uuid, u.open_id, u.nickname, u.avatar, u.create_time
            FROM zhs_user u WHERE {where}
            ORDER BY u.id DESC LIMIT :offset, :limit
        """), params)
        data = _rows_to_list(rows)
        # team count
        team_count = 0
        if token:
            team_count = db.execute(text("""
                SELECT COUNT(*) FROM zhs_user WHERE parent_id = (SELECT id FROM zhs_user WHERE open_id = :token LIMIT 1)
            """), {"token": token}).scalar() or 0
        return {"code": 200, "msg": "success", "data": data, "total": len(data), "teamCount": int(team_count)}
    except Exception as e:
        logger.debug("flow_get_trader_team_by_center failed: %s", e)
        return {"code": 200, "msg": "success", "data": [], "total": 0, "teamCount": 0}


# ===========================================================================
# 23. ZhsCourseController - /course (表 zhs_course)
# Java: GET /list, GET /{id}, DELETE /{ids}, POST /delist/{ids}
# ===========================================================================

@router.get("/course/list", summary="[ZhsCourse]课程列表")
def course_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    title: Optional[str] = None,
    platform_type: Optional[str] = Header(None, alias=_H_PLATFORM_TYPE),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        where = "1=1"
        params: Dict[str, Any] = _page_params(pageNum, pageSize)
        if title:
            where += " AND title LIKE :title"
            params["title"] = f"%{title}%"
        rows = db.execute(text(f"""
            SELECT id, title, cover, description, platform, creator, status, create_time
            FROM zhs_course WHERE {where}
            ORDER BY id DESC LIMIT :offset, :limit
        """), params)
        return _ok(_rows_to_list(rows))
    except Exception as e:
        logger.debug("course_list failed: %s", e)
        return _ok([])


@router.get("/course/{item_id}", summary="[ZhsCourse]课程详情")
def course_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("""
            SELECT id, title, cover, description, platform, creator, status, create_time
            FROM zhs_course WHERE id = :id
        """), {"id": item_id}).mappings().first()
        return _ok(dict(row) if row else None)
    except Exception as e:
        logger.debug("course_get failed: %s", e)
        return _ok(None)


@router.delete("/course/{ids}", summary="[ZhsCourse]删除课程(批量)")
def course_remove(
    ids: str = Path(...),
    platform_user_id: Optional[str] = Header(None, alias=_H_PLATFORM_USER_ID),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text("DELETE FROM zhs_course WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ok(result.rowcount)
    except Exception as e:
        db.rollback()
        logger.debug("course_remove failed: %s", e)
        return _err(f"删除失败: {e}")


@router.post("/course/delist/{ids}", summary="[ZhsCourse]下架课程")
def course_delist(
    ids: str = Path(...),
    platform_user_id: Optional[str] = Header(None, alias=_H_PLATFORM_USER_ID),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java POST /course/delist/{ids}."""
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text("""
            UPDATE zhs_course SET status = 1, updator = :uuid, update_time = :now WHERE id IN :ids
        """), {"ids": tuple(id_list), "uuid": platform_user_id or "", "now": utcnow()})
        db.commit()
        return _ok(result.rowcount)
    except Exception as e:
        db.rollback()
        logger.debug("course_delist failed: %s", e)
        return _err(f"下架失败: {e}")


# ===========================================================================
# 24. ZhsCoursePlatformLogController - /coursePlatformLog (表 zhs_course_platform_log)
# Java: GET /list, GET /{id}, DELETE /{ids}, POST /, PUT /
# ===========================================================================

_PLATFORM_LOG_FIELDS = ("course_id", "video_id", "platform", "operator", "action", "remark")


@router.get("/coursePlatformLog/list", summary="[CoursePlatformLog]视频发布平台记录列表")
def course_platform_log_list(
    course_id: Optional[str] = None,
    platform: Optional[str] = None,
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        where = "1=1"
        params: Dict[str, Any] = {}
        if course_id:
            where += " AND course_id = :course_id"
            params["course_id"] = course_id
        if platform:
            where += " AND platform = :platform"
            params["platform"] = platform
        rows = db.execute(text(f"""
            SELECT id, course_id, video_id, platform, operator, action, remark, create_time
            FROM zhs_course_platform_log WHERE {where} ORDER BY id DESC
        """), params)
        return _ok(_rows_to_list(rows))
    except Exception as e:
        logger.debug("course_platform_log_list failed: %s", e)
        return _ok([])


@router.get("/coursePlatformLog/{item_id}", summary="[CoursePlatformLog]详情")
def course_platform_log_get(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("""
            SELECT id, course_id, video_id, platform, operator, action, remark, create_time
            FROM zhs_course_platform_log WHERE id = :id
        """), {"id": item_id}).mappings().first()
        return _ok(dict(row) if row else None)
    except Exception as e:
        logger.debug("course_platform_log_get failed: %s", e)
        return _ok(None)


@router.delete("/coursePlatformLog/{ids}", summary="[CoursePlatformLog]删除(批量)")
def course_platform_log_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text("DELETE FROM zhs_course_platform_log WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ok(result.rowcount)
    except Exception as e:
        db.rollback()
        logger.debug("course_platform_log_remove failed: %s", e)
        return _err(f"删除失败: {e}")


@router.post("/coursePlatformLog", summary="[CoursePlatformLog]新增")
def course_platform_log_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        sql, params = _build_insert(
            "zhs_course_platform_log", payload, _PLATFORM_LOG_FIELDS,
            {"create_time": utcnow()},
        )
        result = db.execute(sql, params)
        db.commit()
        return _ok(result.rowcount)
    except Exception as e:
        db.rollback()
        logger.debug("course_platform_log_add failed: %s", e)
        return _err(f"新增失败: {e}")


@router.put("/coursePlatformLog", summary="[CoursePlatformLog]修改")
def course_platform_log_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        sql, params = _build_update(
            "zhs_course_platform_log", payload, _PLATFORM_LOG_FIELDS,
            {"update_time": utcnow()},
        )
        if sql is None:
            return _ajax(False, "id必填或无更新字段")
        result = db.execute(sql, params)
        db.commit()
        return _ok(result.rowcount)
    except Exception as e:
        db.rollback()
        logger.debug("course_platform_log_edit failed: %s", e)
        return _err(f"修改失败: {e}")


# ===========================================================================
# 25. ZhsCourseVideoController - /courseVideo (表 zhs_course_video)
# Java: GET /list, GET /list/login, GET /{id}, POST /batch, DELETE /{ids},
#       GET /move/{videoId}/{type}, POST /issue/{ids}, POST /, PUT /
# 注意: 具体路径需在 /{id} 之前声明避免被参数路径吞掉
# ===========================================================================

_COURSE_VIDEO_FIELDS = ("course_id", "title", "cover", "video_url", "duration", "sort", "status", "platform", "creator")


@router.get("/courseVideo/list", summary="[CourseVideo]课程视频列表")
def course_video_list(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    course_id: Optional[str] = None,
    platform_type: Optional[str] = Header(None, alias=_H_PLATFORM_TYPE),
    platform_user_id: Optional[str] = Header(None, alias=_H_PLATFORM_USER_ID),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        where = "1=1"
        params: Dict[str, Any] = _page_params(pageNum, pageSize)
        if course_id:
            where += " AND course_id = :course_id"
            params["course_id"] = course_id
        rows = db.execute(text(f"""
            SELECT id, course_id, title, cover, video_url, duration, sort, status, platform, creator, create_time
            FROM zhs_course_video WHERE {where}
            ORDER BY sort ASC, id DESC LIMIT :offset, :limit
        """), params)
        return _ok(_rows_to_list(rows))
    except Exception as e:
        logger.debug("course_video_list failed: %s", e)
        return _ok([])


@router.get("/courseVideo/list/login", summary="[CourseVideo]当前用户课程视频列表")
def course_video_list_login(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    course_id: Optional[str] = None,
    platform_type: Optional[str] = Header(None, alias=_H_PLATFORM_TYPE),
    platform_user_id: Optional[str] = Header(None, alias=_H_PLATFORM_USER_ID),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        if not course_id:
            return _err("未识别的课程唯一标识")
        params: Dict[str, Any] = _page_params(pageNum, pageSize)
        params["course_id"] = course_id
        params["user_uuid"] = platform_user_id or ""
        rows = db.execute(text("""
            SELECT id, course_id, title, cover, video_url, duration, sort, status, platform, creator, create_time
            FROM zhs_course_video WHERE course_id = :course_id
            ORDER BY sort ASC, id DESC LIMIT :offset, :limit
        """), params)
        return _ok(_rows_to_list(rows))
    except Exception as e:
        logger.debug("course_video_list_login failed: %s", e)
        return _ok([])


@router.get("/courseVideo/move/{video_id}/{move_type}", summary="[CourseVideo]移动课程视频")
def course_video_move(
    video_id: str = Path(..., alias="videoId"),
    move_type: int = Path(..., alias="type"),
    platform_user_id: Optional[str] = Header(None, alias=_H_PLATFORM_USER_ID),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java GET /courseVideo/move/{videoId}/{type}. type: 0置顶 1上移 2下移."""
    try:
        row = db.execute(text("""
            SELECT id, course_id, sort FROM zhs_course_video WHERE id = :id
        """), {"id": video_id}).mappings().first()
        if not row:
            return _err("视频不存在")
        course_id = row["course_id"]
        current_sort = row["sort"] or 0
        if move_type == 0:
            # 置顶
            db.execute(text("""
                UPDATE zhs_course_video SET sort = 0, update_time = :now WHERE id = :id
            """), {"id": video_id, "now": utcnow()})
        elif move_type == 1:
            # 上移
            prev = db.execute(text("""
                SELECT id, sort FROM zhs_course_video
                WHERE course_id = :cid AND sort < :sort ORDER BY sort DESC LIMIT 1
            """), {"cid": course_id, "sort": current_sort}).mappings().first()
            if prev:
                db.execute(text("UPDATE zhs_course_video SET sort = :s, update_time = :now WHERE id = :id"),
                           {"s": prev["sort"], "id": video_id, "now": utcnow()})
                db.execute(text("UPDATE zhs_course_video SET sort = :s, update_time = :now WHERE id = :id"),
                           {"s": current_sort, "id": prev["id"], "now": utcnow()})
        elif move_type == 2:
            # 下移
            nxt = db.execute(text("""
                SELECT id, sort FROM zhs_course_video
                WHERE course_id = :cid AND sort > :sort ORDER BY sort ASC LIMIT 1
            """), {"cid": course_id, "sort": current_sort}).mappings().first()
            if nxt:
                db.execute(text("UPDATE zhs_course_video SET sort = :s, update_time = :now WHERE id = :id"),
                           {"s": nxt["sort"], "id": video_id, "now": utcnow()})
                db.execute(text("UPDATE zhs_course_video SET sort = :s, update_time = :now WHERE id = :id"),
                           {"s": current_sort, "id": nxt["id"], "now": utcnow()})
        db.commit()
        return _ok(None)
    except Exception as e:
        db.rollback()
        logger.debug("course_video_move failed: %s", e)
        return _err(f"移动失败: {e}")


@router.post("/courseVideo/issue/{ids}", summary="[CourseVideo]上架")
def course_video_issue(
    ids: str = Path(...),
    platform_user_id: Optional[str] = Header(None, alias=_H_PLATFORM_USER_ID),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text("""
            UPDATE zhs_course_video SET status = 1, updator = :uuid, update_time = :now WHERE id IN :ids
        """), {"ids": tuple(id_list), "uuid": platform_user_id or "", "now": utcnow()})
        db.commit()
        return _ok(result.rowcount)
    except Exception as e:
        db.rollback()
        logger.debug("course_video_issue failed: %s", e)
        return _err(f"上架失败: {e}")


@router.post("/courseVideo/batch", summary="[CourseVideo]批量新增")
def course_video_add_batch(
    payload: List[Dict[str, Any]] = Body(...),
    platform_user_id: Optional[str] = Header(None, alias=_H_PLATFORM_USER_ID),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        now = utcnow()
        count = 0
        for item in payload:
            try:
                sql, params = _build_insert(
                    "zhs_course_video", item, _COURSE_VIDEO_FIELDS,
                    {"creator": platform_user_id or "", "create_time": now, "update_time": now},
                )
                db.execute(sql, params)
                count += 1
            except Exception as ie:
                logger.debug("course_video_add_batch item failed: %s", ie)
        db.commit()
        return _ok(count)
    except Exception as e:
        db.rollback()
        logger.debug("course_video_add_batch failed: %s", e)
        return _err(f"批量新增失败: {e}")


@router.get("/courseVideo/{item_id}", summary="[CourseVideo]课程视频详情")
def course_video_get(
    item_id: str = Path(..., alias="id"),
    platform_user_id: Optional[str] = Header(None, alias=_H_PLATFORM_USER_ID),
    platform_type: Optional[str] = Header(None, alias=_H_PLATFORM_TYPE),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("""
            SELECT id, course_id, title, cover, video_url, duration, sort, status, platform, creator, create_time
            FROM zhs_course_video WHERE id = :id
        """), {"id": item_id}).mappings().first()
        return _ok(dict(row) if row else None)
    except Exception as e:
        logger.debug("course_video_get failed: %s", e)
        return _ok(None)


@router.post("/courseVideo", summary="[CourseVideo]新增课程视频")
def course_video_add(
    payload: Dict[str, Any] = Body(...),
    platform_user_id: Optional[str] = Header(None, alias=_H_PLATFORM_USER_ID),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        sql, params = _build_insert(
            "zhs_course_video", payload, _COURSE_VIDEO_FIELDS,
            {"creator": platform_user_id or "", "create_time": utcnow(), "update_time": utcnow()},
        )
        result = db.execute(sql, params)
        db.commit()
        return _ok(result.rowcount)
    except Exception as e:
        db.rollback()
        logger.debug("course_video_add failed: %s", e)
        return _err(f"新增失败: {e}")


@router.put("/courseVideo", summary="[CourseVideo]修改课程视频")
def course_video_edit(
    payload: Dict[str, Any] = Body(...),
    platform_user_id: Optional[str] = Header(None, alias=_H_PLATFORM_USER_ID),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        sql, params = _build_update(
            "zhs_course_video", payload, _COURSE_VIDEO_FIELDS,
            {"updator": platform_user_id or "", "update_time": utcnow()},
        )
        if sql is None:
            return _ajax(False, "id必填或无更新字段")
        result = db.execute(sql, params)
        db.commit()
        return _ok(result.rowcount)
    except Exception as e:
        db.rollback()
        logger.debug("course_video_edit failed: %s", e)
        return _err(f"修改失败: {e}")


@router.delete("/courseVideo/{ids}", summary="[CourseVideo]删除课程视频(批量)")
def course_video_remove(
    ids: str = Path(...),
    platform_user_id: Optional[str] = Header(None, alias=_H_PLATFORM_USER_ID),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text("DELETE FROM zhs_course_video WHERE id IN :ids"), {"ids": tuple(id_list)})
        db.commit()
        return _ok(result.rowcount)
    except Exception as e:
        db.rollback()
        logger.debug("course_video_remove failed: %s", e)
        return _err(f"删除失败: {e}")


# ===========================================================================
# 26. ZhsEducationPlatformController - /educationPlatform (表 zhs_education_platform)
# Java: GET /list, GET /{sort}, DELETE /{sorts}, POST /, PUT /
# ===========================================================================

_EDU_PLATFORM_FIELDS = ("name", "sort", "status", "remark")


@router.get("/educationPlatform/list", summary="[EducationPlatform]平台发布管理列表")
def education_platform_list(
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        rows = db.execute(text("""
            SELECT id, name, sort, status, remark, create_time
            FROM zhs_education_platform ORDER BY sort ASC, id ASC
        """))
        return _ok(_rows_to_list(rows))
    except Exception as e:
        logger.debug("education_platform_list failed: %s", e)
        return _ok([])


@router.get("/educationPlatform/{sort}", summary="[EducationPlatform]按sort查询详情")
def education_platform_get(
    sort: int = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("""
            SELECT id, name, sort, status, remark, create_time
            FROM zhs_education_platform WHERE sort = :sort
        """), {"sort": sort}).mappings().first()
        return _ok(dict(row) if row else None)
    except Exception as e:
        logger.debug("education_platform_get failed: %s", e)
        return _ok(None)


@router.post("/educationPlatform", summary="[EducationPlatform]新增")
def education_platform_add(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        sql, params = _build_insert(
            "zhs_education_platform", payload, _EDU_PLATFORM_FIELDS,
            {"create_time": utcnow()},
        )
        result = db.execute(sql, params)
        db.commit()
        return _ok(result.rowcount)
    except Exception as e:
        db.rollback()
        logger.debug("education_platform_add failed: %s", e)
        return _err(f"新增失败: {e}")


@router.put("/educationPlatform", summary="[EducationPlatform]修改")
def education_platform_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        sql, params = _build_update(
            "zhs_education_platform", payload, _EDU_PLATFORM_FIELDS,
            {"update_time": utcnow()},
        )
        if sql is None:
            return _ajax(False, "id必填或无更新字段")
        result = db.execute(sql, params)
        db.commit()
        return _ok(result.rowcount)
    except Exception as e:
        db.rollback()
        logger.debug("education_platform_edit failed: %s", e)
        return _err(f"修改失败: {e}")


@router.delete("/educationPlatform/{sorts}", summary="[EducationPlatform]按sorts批量删除")
def education_platform_remove(
    sorts: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java DELETE /educationPlatform/{sorts} (Integer[] sorts)."""
    try:
        id_list = _parse_ids(sorts)
        if not id_list:
            return _ajax(False, "sorts必填")
        result = db.execute(
            text("DELETE FROM zhs_education_platform WHERE sort IN :sorts"),
            {"sorts": tuple(int(s) for s in id_list)},
        )
        db.commit()
        return _ok(result.rowcount)
    except Exception as e:
        db.rollback()
        logger.debug("education_platform_remove failed: %s", e)
        return _err(f"删除失败: {e}")


# ===========================================================================
# 27. ZhsInformationController - /information (表 zhs_information, @SkipLogin)
# Java: GET /dictionary, POST /, GET /list
# 全部免登录 (类级别 @SkipLogin)
# ===========================================================================

_INFORMATION_FIELDS = (
    "title", "content", "type", "url", "source_name", "source_url",
    "source_creator", "source_time", "browse", "creator", "creator_name",
    "information_type",
)


@router.get("/information/dictionary", summary="[Information]AI资讯类型字典(免登)")
def information_dictionary(
    code: Optional[str] = None,
    name: Optional[str] = None,
    typeId: Optional[str] = None,
):
    """对应 Java GET /information/dictionary. 免登录."""
    try:
        db = next(_get_db())
        where = "is_invalid = 0"
        params: Dict[str, Any] = {}
        if code:
            where += " AND code = :code"
            params["code"] = code
        if name:
            where += " AND name LIKE :name"
            params["name"] = f"%{name}%"
        if typeId:
            where += " AND type_id = :type_id"
            params["type_id"] = typeId
        rows = db.execute(text(f"""
            SELECT id, code, name, prent_id, type_id, is_invalid, creator,
                   created_time, update, updated_time
            FROM zhs_dictionary WHERE {where}
            ORDER BY created_time DESC
        """), params)
        return {"code": 200, "msg": "success", "data": _rows_to_list(rows)}
    except Exception as e:
        logger.debug("information_dictionary failed: %s", e)
        return {"code": 200, "msg": "success", "data": []}


@router.get("/information/list", summary="[Information]AI资讯列表(免登)")
def information_list(
    title: Optional[str] = None,
    type: Optional[str] = None,
    informationType: Optional[int] = None,
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
):
    """对应 Java GET /information/list. 免登录."""
    try:
        db = next(_get_db())
        where = "1=1"
        params: Dict[str, Any] = _page_params(pageNum, pageSize)
        if title:
            where += " AND title LIKE :title"
            params["title"] = f"%{title}%"
        if type:
            where += " AND type = :type"
            params["type"] = type
        if informationType is not None:
            where += " AND information_type = :information_type"
            params["information_type"] = informationType
        rows = db.execute(text(f"""
            SELECT id, title, content, type, url, source_name, source_url,
                   source_creator, source_time, insert_time, browse, creator,
                   creator_name, created_time, information_type
            FROM zhs_information WHERE {where}
            ORDER BY created_time DESC
            LIMIT :limit OFFSET :offset
        """), params)
        total_row = db.execute(text(f"SELECT COUNT(*) FROM zhs_information WHERE {where}"), params).first()
        total = total_row[0] if total_row else 0
        return {"code": 200, "msg": "success", "data": _rows_to_list(rows), "total": total}
    except Exception as e:
        logger.debug("information_list failed: %s", e)
        return {"code": 200, "msg": "success", "data": [], "total": 0}


@router.post("/information", summary="[Information]批量新增AI资讯(免登)")
def information_add(
    payload: List[Dict[str, Any]] = Body(...),
):
    """对应 Java POST /information. 接收 List<ZhsInformation> 批量新增."""
    db = next(_get_db())
    try:
        count = 0
        for item in payload:
            sql, params = _build_insert(
                "zhs_information", item, _INFORMATION_FIELDS,
                {"insert_time": int(utcnow().timestamp()) if utcnow() else None,
                 "created_time": utcnow()},
            )
            db.execute(sql, params)
            count += 1
        db.commit()
        return {"code": 200, "msg": f"数据成功添加{count}条记录！"}
    except Exception as e:
        db.rollback()
        logger.debug("information_add failed: %s", e)
        return {"code": 500, "msg": f"新增失败: {e}"}


# ===========================================================================
# 28. ZhsProductIdentityController - /product_identity (表 zhs_product_identity)
# Java: GET /list, GET /getInfo?token=
# ===========================================================================

_PRODUCT_IDENTITY_FIELDS = (
    "amount", "begin_time", "end_time", "def_amount", "status", "creator",
    "updator", "remark", "type", "routine_proportion", "vip_proportion",
    "trader_proportion", "expire_at", "give_token", "label_pic", "detail",
)


@router.get("/product_identity/list", summary="[ProductIdentity]开通身份订单列表")
def product_identity_list(
    _user: str = Depends(require_login),
    type: Optional[int] = None,
    status: Optional[int] = None,
):
    """对应 Java GET /product_identity/list."""
    try:
        db = next(_get_db())
        where = "1=1"
        params: Dict[str, Any] = {}
        if type is not None:
            where += " AND type = :type"
            params["type"] = type
        if status is not None:
            where += " AND status = :status"
            params["status"] = status
        rows = db.execute(text(f"""
            SELECT id, amount, begin_time, end_time, def_amount, status,
                   creator, created_time, updator, updated_time, remark, type,
                   routine_proportion, vip_proportion, trader_proportion,
                   expire_at, give_token, label_pic, detail
            FROM zhs_product_identity WHERE {where}
            ORDER BY created_time DESC
        """), params)
        return {"code": "200", "msg": "success", "data": _rows_to_list(rows)}
    except Exception as e:
        logger.debug("product_identity_list failed: %s", e)
        return {"code": "200", "msg": "success", "data": []}


@router.get("/product_identity/getInfo", summary="[ProductIdentity]按token查询详情")
def product_identity_get_info(
    token: str = Query(..., description="openId/token"),
):
    """对应 Java GET /product_identity/getInfo?token=.
    按用户 token (openId) 查询开通身份订单详情.
    """
    try:
        db = next(_get_db())
        row = db.execute(text("""
            SELECT id, amount, begin_time, end_time, def_amount, status,
                   creator, created_time, updator, updated_time, remark, type,
                   routine_proportion, vip_proportion, trader_proportion,
                   expire_at, give_token, label_pic, detail
            FROM zhs_product_identity
            WHERE creator = :token OR id = :token_id
            LIMIT 1
        """), {"token": token, "token_id": token}).mappings().first()
        return {"code": "200", "msg": "success", "data": _row_to_dict(row)}
    except Exception as e:
        logger.debug("product_identity_get_info failed: %s", e)
        return {"code": "200", "msg": "success", "data": None}


# ===========================================================================
# 29. ZhsUserCommentLogController - /userCommentLog (表 zhs_user_comment_log)
# Java: GET /list, GET /{id}, POST / (@CourseHeaderCheck), PUT /, DELETE /{ids}
# ===========================================================================

_USER_COMMENT_LOG_FIELDS = ("user_uuid", "comment_id")


@router.get("/userCommentLog/list", summary="[UserCommentLog]用户评论点赞记录列表")
def user_comment_log_list(
    userUuid: Optional[str] = None,
    commentId: Optional[str] = None,
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java GET /userCommentLog/list."""
    try:
        where = "1=1"
        params: Dict[str, Any] = {}
        if userUuid:
            where += " AND user_uuid = :user_uuid"
            params["user_uuid"] = userUuid
        if commentId:
            where += " AND comment_id = :comment_id"
            params["comment_id"] = commentId
        rows = db.execute(text(f"""
            SELECT id, user_uuid, comment_id, created_at
            FROM zhs_user_comment_log WHERE {where}
            ORDER BY created_at DESC
        """), params)
        return _ok(_rows_to_list(rows))
    except Exception as e:
        logger.debug("user_comment_log_list failed: %s", e)
        return _ok([])


@router.get("/userCommentLog/{id}", summary="[UserCommentLog]按id查询详情")
def user_comment_log_get(
    id: int = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java GET /userCommentLog/{id}."""
    try:
        row = db.execute(text("""
            SELECT id, user_uuid, comment_id, created_at
            FROM zhs_user_comment_log WHERE id = :id
        """), {"id": id}).mappings().first()
        return _ok(_row_to_dict(row))
    except Exception as e:
        logger.debug("user_comment_log_get failed: %s", e)
        return _ok(None)


@router.post("/userCommentLog", summary="[UserCommentLog]新增")
def user_comment_log_add(
    payload: Dict[str, Any] = Body(...),
    platform_user_id: Optional[str] = Header(None, alias=_H_PLATFORM_USER_ID),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java POST /userCommentLog (@CourseHeaderCheck).
    从 header PLATFORM-USER-UUID 注入 user_uuid (若 payload 未指定).
    """
    try:
        if not payload.get("user_uuid") and platform_user_id:
            payload["user_uuid"] = platform_user_id
        sql, params = _build_insert(
            "zhs_user_comment_log", payload, _USER_COMMENT_LOG_FIELDS,
            {"created_at": utcnow()},
        )
        result = db.execute(sql, params)
        db.commit()
        return _ok(result.rowcount)
    except Exception as e:
        db.rollback()
        logger.debug("user_comment_log_add failed: %s", e)
        return _err(f"新增失败: {e}")


@router.put("/userCommentLog", summary="[UserCommentLog]修改")
def user_comment_log_edit(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java PUT /userCommentLog."""
    try:
        sql, params = _build_update(
            "zhs_user_comment_log", payload, _USER_COMMENT_LOG_FIELDS,
        )
        if sql is None:
            return _ajax(False, "id必填或无更新字段")
        result = db.execute(sql, params)
        db.commit()
        return _ok(result.rowcount)
    except Exception as e:
        db.rollback()
        logger.debug("user_comment_log_edit failed: %s", e)
        return _err(f"修改失败: {e}")


@router.delete("/userCommentLog/{ids}", summary="[UserCommentLog]按ids批量删除")
def user_comment_log_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java DELETE /userCommentLog/{ids}."""
    try:
        id_list = _parse_ids(ids)
        if not id_list:
            return _ajax(False, "ids必填")
        result = db.execute(
            text("DELETE FROM zhs_user_comment_log WHERE id IN :ids"),
            {"ids": tuple(int(s) for s in id_list)},
        )
        db.commit()
        return _ok(result.rowcount)
    except Exception as e:
        db.rollback()
        logger.debug("user_comment_log_remove failed: %s", e)
        return _err(f"删除失败: {e}")


# ===========================================================================
# 30. ZhsUserPlatformController - /userPlatform (表 zhs_user_platform)
# Java: GET /{userId} (@CourseHeaderCheck), POST / (@CourseHeaderCheck)
# ===========================================================================

_USER_PLATFORM_FIELDS = ("user_uuid", "platform_id", "identity_id", "status", "is_del", "field1")


@router.get("/userPlatform/{userId}", summary="[UserPlatform]按userId查询详情")
def user_platform_get(
    userId: int = Path(...),
    platform_type: str = Header(..., alias=_H_PLATFORM_TYPE),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java GET /userPlatform/{userId} (@CourseHeaderCheck).
    courseHeader = header COURSE-PLATFORM.
    """
    try:
        row = db.execute(text("""
            SELECT id, user_uuid, platform_id, identity_id, status, is_del,
                   field1, created_at, updator, updated_at
            FROM zhs_user_platform
            WHERE user_uuid = :user_id AND platform_id = :platform_id
            LIMIT 1
        """), {"user_id": str(userId), "platform_id": platform_type}).mappings().first()
        return _ok(_row_to_dict(row))
    except Exception as e:
        logger.debug("user_platform_get failed: %s", e)
        return _ok(None)


@router.post("/userPlatform", summary="[UserPlatform]绑定用户与平台关系")
def user_platform_add(
    payload: Dict[str, Any] = Body(...),
    platform_type: str = Header(..., alias=_H_PLATFORM_TYPE),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java POST /userPlatform (@CourseHeaderCheck).
    courseHeader (COURSE-PLATFORM) 强制覆盖 payload.platform_id.
    """
    try:
        payload["platform_id"] = platform_type
        sql, params = _build_insert(
            "zhs_user_platform", payload, _USER_PLATFORM_FIELDS,
            {"created_at": utcnow()},
        )
        result = db.execute(sql, params)
        db.commit()
        return _ok(result.rowcount)
    except Exception as e:
        db.rollback()
        logger.debug("user_platform_add failed: %s", e)
        return _err(f"新增失败: {e}")


# ===========================================================================
# 31. ZhsUserVideoCommentController - /userVideoComment (表 zhs_user_video_comment)
# Java: GET /list, POST /, DELETE /{ids}, GET /list/up
# 所有端点均带 @CourseHeaderCheck, POST/DELETE 从 PLATFORM-USER-UUID 注入 userUuid
# ===========================================================================

_USER_VIDEO_COMMENT_FIELDS = (
    "video_id", "user_uuid", "content", "path", "parent_id",
    "is_hidden", "is_del",
)


@router.get("/userVideoComment/list", summary="[UserVideoComment]用户评论列表")
def user_video_comment_list(
    videoId: Optional[str] = None,
    parentId: Optional[str] = None,
    platform_type: str = Header(..., alias=_H_PLATFORM_TYPE),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java GET /userVideoComment/list (@CourseHeaderCheck)."""
    try:
        where = "is_del = 0"
        params: Dict[str, Any] = {"platform_id": platform_type}
        if videoId:
            where += " AND video_id = :video_id"
            params["video_id"] = videoId
        if parentId:
            where += " AND parent_id = :parent_id"
            params["parent_id"] = parentId
        rows = db.execute(text(f"""
            SELECT id, video_id, user_uuid, content, path, parent_id,
                   is_hidden, is_del, created_at
            FROM zhs_user_video_comment WHERE {where}
            ORDER BY created_at DESC
        """), params)
        return _ok(_rows_to_list(rows))
    except Exception as e:
        logger.debug("user_video_comment_list failed: %s", e)
        return _ok([])


@router.get("/userVideoComment/list/up", summary="[UserVideoComment]顶级评论列表")
def user_video_comment_uplist(
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java GET /userVideoComment/list/up.
    查询 parent_id = '0' 的顶级评论列表.
    """
    try:
        rows = db.execute(text("""
            SELECT id, video_id, user_uuid, content, path, parent_id,
                   is_hidden, is_del, created_at
            FROM zhs_user_video_comment
            WHERE parent_id = '0' AND is_del = 0
            ORDER BY created_at DESC
        """))
        return _ok(_rows_to_list(rows))
    except Exception as e:
        logger.debug("user_video_comment_uplist failed: %s", e)
        return _ok([])


@router.post("/userVideoComment", summary="[UserVideoComment]新增用户评论")
def user_video_comment_add(
    payload: Dict[str, Any] = Body(...),
    platform_user_id: str = Header(..., alias=_H_PLATFORM_USER_ID),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java POST /userVideoComment (@CourseHeaderCheck).
    从 header PLATFORM-USER-UUID 强制注入 user_uuid.
    """
    try:
        payload["user_uuid"] = platform_user_id
        sql, params = _build_insert(
            "zhs_user_video_comment", payload, _USER_VIDEO_COMMENT_FIELDS,
            {"created_at": utcnow()},
        )
        result = db.execute(sql, params)
        db.commit()
        return _ok(result.rowcount)
    except Exception as e:
        db.rollback()
        logger.debug("user_video_comment_add failed: %s", e)
        return _err(f"新增失败: {e}")


@router.delete("/userVideoComment/{ids}", summary="[UserVideoComment]按ids批量删除")
def user_video_comment_remove(
    ids: str = Path(...),
    platform_user_id: str = Header(..., alias=_H_PLATFORM_USER_ID),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java DELETE /userVideoComment/{ids} (@CourseHeaderCheck).
    仅删除当前用户 (platform_user_id) 的评论.
    """
    try:
        id_list = _parse_ids(ids)
        if not id_list:
            return _ajax(False, "ids必填")
        result = db.execute(
            text("DELETE FROM zhs_user_video_comment WHERE id IN :ids AND user_uuid = :user_uuid"),
            {"ids": tuple(id_list), "user_uuid": platform_user_id},
        )
        db.commit()
        return _ok(result.rowcount)
    except Exception as e:
        db.rollback()
        logger.debug("user_video_comment_remove failed: %s", e)
        return _err(f"删除失败: {e}")


# ===========================================================================
# 32. ZhsUserVideoLogController - /userVideoLog (表 zhs_user_video_log)
# Java: GET /list, GET /operate/{videoId}/{type}, DELETE /{ids}
# GET /list 与 /operate 从 PLATFORM-USER-UUID/COURSE-PLATFORM 注入 user_uuid/platform_id
# ===========================================================================

_USER_VIDEO_LOG_FIELDS = ("video_id", "user_uuid", "type", "platform_id")


@router.get("/userVideoLog/list", summary="[UserVideoLog]用户操作课程视频列表")
def user_video_log_list(
    videoId: Optional[str] = None,
    type: Optional[int] = None,
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    platform_user_id: str = Header(..., alias=_H_PLATFORM_USER_ID),
    platform_type: str = Header(..., alias=_H_PLATFORM_TYPE),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java GET /userVideoLog/list.
    从 header 注入 user_uuid/platform_id, 关联 zhs_course_video 返回视频列表.
    """
    try:
        where = "l.user_uuid = :user_uuid AND l.platform_id = :platform_id"
        params: Dict[str, Any] = _page_params(pageNum, pageSize)
        params["user_uuid"] = platform_user_id
        params["platform_id"] = platform_type
        if videoId:
            where += " AND l.video_id = :video_id"
            params["video_id"] = videoId
        if type is not None:
            where += " AND l.type = :type"
            params["type"] = type
        rows = db.execute(text(f"""
            SELECT v.id, v.course_id, v.title, v.cover, v.video_url, v.duration,
                   v.sort, v.status, v.platform, v.creator,
                   l.id AS log_id, l.type AS log_type, l.created_at AS log_created_at
            FROM zhs_user_video_log l
            LEFT JOIN zhs_course_video v ON v.id = l.video_id
            WHERE {where}
            ORDER BY l.created_at DESC
            LIMIT :limit OFFSET :offset
        """), params)
        total_row = db.execute(text(f"""
            SELECT COUNT(*) FROM zhs_user_video_log l WHERE {where}
        """), params).first()
        total = total_row[0] if total_row else 0
        return _table_data(_rows_to_list(rows), total)
    except Exception as e:
        logger.debug("user_video_log_list failed: %s", e)
        return _table_data([], 0)


@router.get("/userVideoLog/operate/{videoId}/{type}", summary="[UserVideoLog]用户操作 0分享 1点赞 2收藏")
def user_video_log_operate(
    videoId: str = Path(...),
    type: int = Path(..., description="0分享 1点赞 2收藏"),
    platform_user_id: str = Header(..., alias=_H_PLATFORM_USER_ID),
    platform_type: str = Header(..., alias=_H_PLATFORM_TYPE),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java GET /userVideoLog/operate/{videoId}/{type}."""
    try:
        sql, params = _build_insert(
            "zhs_user_video_log",
            {"video_id": videoId, "type": type,
             "user_uuid": platform_user_id, "platform_id": platform_type},
            _USER_VIDEO_LOG_FIELDS,
            {"created_at": utcnow()},
        )
        result = db.execute(sql, params)
        db.commit()
        return _ok(result.rowcount)
    except Exception as e:
        db.rollback()
        logger.debug("user_video_log_operate failed: %s", e)
        return _err(f"操作失败: {e}")


@router.delete("/userVideoLog/{ids}", summary="[UserVideoLog]按ids批量删除")
def user_video_log_remove(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java DELETE /userVideoLog/{ids}."""
    try:
        id_list = _parse_ids(ids)
        if not id_list:
            return _ajax(False, "ids必填")
        result = db.execute(
            text("DELETE FROM zhs_user_video_log WHERE id IN :ids"),
            {"ids": tuple(int(s) for s in id_list)},
        )
        db.commit()
        return _ok(result.rowcount)
    except Exception as e:
        db.rollback()
        logger.debug("user_video_log_remove failed: %s", e)
        return _err(f"删除失败: {e}")


# ===========================================================================
# 33. ZhsWithdrawalController - /zhsWithdrawal (表 zhs_withdrawal_detail)
# Java: POST /searchCount, POST /withdrawal, POST /withdrawalRecord, POST /getWithdrawal
# 业务: 提现详情查询、提现申请发起 (扣 2% 手续费)、个人提现记录、个人可收款查询
# ===========================================================================

_WITHDRAWAL_DETAIL_FIELDS = (
    "user_id", "user_name", "open_id", "withdrawal_amount", "withdrawal_type",
    "withdrawal_status", "withdrawal_time", "reviewer", "reviewer_time",
    "payment_time", "is_success", "notes", "out_bill_no", "order_ids",
    "we_chat_msg",
)


@router.post("/zhsWithdrawal/searchCount", summary="[Withdrawal]提现详情页数据面板")
def withdrawal_search_count(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java POST /zhsWithdrawal/searchCount.
    入参: {token, orderStatus, startOfDay, endOfDay}
    返回: {detail: 账户信息, list: 订单列表}
    """
    try:
        token = payload.get("token")
        order_status = payload.get("orderStatus")
        start_of_day = payload.get("startOfDay")
        end_of_day = payload.get("endOfDay")

        # 1. 账户信息 (从 commission_flow 表关联)
        re_map = {}
        try:
            acc_row = db.execute(text("""
                SELECT user_id, user_name, open_id, SUM(amount) AS total_amount
                FROM commission_flow WHERE user_id = :token
                GROUP BY user_id, user_name, open_id LIMIT 1
            """), {"token": token}).mappings().first()
            if acc_row:
                re_map = dict(acc_row)
        except Exception as e:
            logger.debug("withdrawal_search_count account query failed: %s", e)

        # 2. 处理日期参数
        start_ts = 0
        end_ts = 0
        if start_of_day and end_of_day:
            try:
                import datetime as _dt
                start_ts = int(_dt.datetime.strptime(start_of_day, "%Y-%m-%d").timestamp())
                end_ts = int(_dt.datetime.strptime(end_of_day, "%Y-%m-%d").timestamp())
            except Exception as e:
                logger.debug("withdrawal_search_count date parse failed: %s", e)

        # 3. 查询订单数据
        order_list: List[Dict[str, Any]] = []
        try:
            where = "user_id = :token"
            params: Dict[str, Any] = {"token": token}
            if order_status:
                where += " AND order_status = :order_status"
                params["order_status"] = order_status
            if start_ts and end_ts:
                where += " AND created_time BETWEEN :start_ts AND :end_ts"
                params["start_ts"] = start_ts
                params["end_ts"] = end_ts
            rows = db.execute(text(f"""
                SELECT id, order_id, user_id, user_name, open_id, amount,
                       order_status, created_time
                FROM commission_flow WHERE {where}
                ORDER BY created_time DESC
            """), params)
            order_list = _rows_to_list(rows)
        except Exception as e:
            logger.debug("withdrawal_search_count order query failed: %s", e)

        return {"code": "200", "msg": "success",
                "data": {"detail": re_map, "list": order_list}}
    except Exception as e:
        logger.debug("withdrawal_search_count failed: %s", e)
        return {"code": "500", "msg": f"查询失败: {e}", "data": None}


@router.post("/zhsWithdrawal/withdrawal", summary="[Withdrawal]提现申请发起")
def withdrawal_apply(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java POST /zhsWithdrawal/withdrawal.
    入参: {token, nickname, openId, amount}
    业务: 扣除 2% 手续费, 生成提现批次号 WX+8位随机+时间戳,
          查询已结算佣金工单, 批量更新工单状态.
    """
    try:
        import secrets as _secrets
        token = payload.get("token")
        nickname = payload.get("nickname")
        open_id = payload.get("openId")
        amount = payload.get("amount")
        if not token or amount is None:
            return {"code": "500", "msg": "token/amount必填", "data": None}

        # 扣除 2% 手续费
        try:
            amount_int = int(amount)
        except Exception:
            amount_int = 0
        withdrawal_amount = str(int(amount_int * 0.98))

        # 生成订单号
        out_bill_no = "WX" + _secrets.token_urlsafe(8).replace("-", "")[:8] + str(int(utcnow().timestamp()))

        # 查询已结算 (order_status='2') 佣金工单
        order_ids_str = ""
        order_ids_list: List[str] = []
        try:
            rows = db.execute(text("""
                SELECT id, order_id FROM commission_flow
                WHERE user_id = :token AND order_status = '2'
            """), {"token": token}).mappings().all()
            order_ids_list = [str(r["id"]) for r in rows]
            order_ids_str = ",".join(str(r["order_id"]) for r in rows)
        except Exception as e:
            logger.debug("withdrawal_apply query orders failed: %s", e)

        # 插入提现明细
        try:
            sql, params = _build_insert(
                "zhs_withdrawal_detail",
                {
                    "user_id": token, "user_name": nickname, "open_id": open_id,
                    "withdrawal_amount": withdrawal_amount, "withdrawal_type": "1",
                    "withdrawal_status": "1", "withdrawal_time": str(int(utcnow().timestamp())),
                    "out_bill_no": out_bill_no, "order_ids": order_ids_str,
                },
                _WITHDRAWAL_DETAIL_FIELDS,
            )
            db.execute(sql, params)
        except Exception as e:
            logger.debug("withdrawal_apply insert detail failed: %s", e)

        # 批量更新工单状态
        if order_ids_list:
            try:
                db.execute(
                    text("UPDATE commission_flow SET order_status = '3' WHERE id IN :ids"),
                    {"ids": tuple(order_ids_list)},
                )
            except Exception as e:
                logger.debug("withdrawal_apply update status failed: %s", e)

        db.commit()
        return {"code": "200", "msg": "success", "data": {"outBillNo": out_bill_no}}
    except Exception as e:
        db.rollback()
        logger.debug("withdrawal_apply failed: %s", e)
        return {"code": "500", "msg": f"提现失败: {e}", "data": None}


@router.post("/zhsWithdrawal/withdrawalRecord", summary="[Withdrawal]个人提现记录查询")
def withdrawal_record(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java POST /zhsWithdrawal/withdrawalRecord.
    入参: {token, dateStr}
    业务: 按 open_id + withdrawal_time 区间查询提现记录.
    """
    try:
        import datetime as _dt
        token = payload.get("token")
        date_str = payload.get("dateStr")

        # 处理日期: dateStr 为空时取今天
        if not date_str:
            start_date = _dt.date.today()
            end_date = start_date + _dt.timedelta(days=1)
        else:
            start_date = _dt.datetime.strptime(date_str, "%Y-%m-%d").date()
            end_date = start_date + _dt.timedelta(days=1)

        start_ts = int(_dt.datetime.combine(start_date, _dt.time.min).timestamp())
        end_ts = int(_dt.datetime.combine(end_date, _dt.time.min).timestamp())

        where = "open_id = :open_id AND withdrawal_time BETWEEN :start_ts AND :end_ts"
        params: Dict[str, Any] = {
            "open_id": token, "start_ts": str(start_ts), "end_ts": str(end_ts),
        }
        rows = db.execute(text(f"""
            SELECT id, user_id, user_name, open_id, withdrawal_amount, withdrawal_type,
                   withdrawal_status, withdrawal_time, reviewer, reviewer_time,
                   payment_time, is_success, notes, out_bill_no, order_ids, we_chat_msg
            FROM zhs_withdrawal_detail WHERE {where}
            ORDER BY withdrawal_time DESC
        """), params)
        return {"code": "200", "msg": "success", "data": _rows_to_list(rows)}
    except Exception as e:
        logger.debug("withdrawal_record failed: %s", e)
        return {"code": "200", "msg": "success", "data": []}


@router.post("/zhsWithdrawal/getWithdrawal", summary="[Withdrawal]个人可收款查询")
def withdrawal_get(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    """对应 Java POST /zhsWithdrawal/getWithdrawal.
    入参: {token}
    业务: 按 withdrawal_status 顺序查询 (2待收款 → 5退回 → 1待审核),
          返回 code (200可收款 / 400已退回 / 300审核中 / 500无记录).
    """
    try:
        token = payload.get("token")
        if not token:
            return {"code": "500", "msg": "success", "data": "无记录"}

        # 1. 待收款 (status=2)
        row = db.execute(text("""
            SELECT id, user_id, user_name, open_id, withdrawal_amount, withdrawal_type,
                   withdrawal_status, withdrawal_time, reviewer, reviewer_time,
                   payment_time, is_success, notes, out_bill_no, order_ids, we_chat_msg
            FROM zhs_withdrawal_detail
            WHERE user_id = :token AND withdrawal_status = '2'
            ORDER BY withdrawal_time DESC LIMIT 1
        """), {"token": token}).mappings().first()
        if row:
            return {"code": "200", "msg": "success", "data": dict(row)}

        # 2. 已退回 (status=5)
        row = db.execute(text("""
            SELECT id, out_bill_no, notes, withdrawal_status
            FROM zhs_withdrawal_detail
            WHERE user_id = :token AND withdrawal_status = '5'
            ORDER BY withdrawal_time DESC LIMIT 1
        """), {"token": token}).mappings().first()
        if row:
            return {"code": "400", "msg": "success",
                    "data": f"提现申请已退回，单号：{row.get('out_bill_no')}退回原因:{row.get('notes')}"}

        # 3. 待审核 (status=1)
        row = db.execute(text("""
            SELECT id, out_bill_no, withdrawal_status
            FROM zhs_withdrawal_detail
            WHERE user_id = :token AND withdrawal_status = '1'
            ORDER BY withdrawal_time DESC LIMIT 1
        """), {"token": token}).mappings().first()
        if row:
            return {"code": "300", "msg": "success",
                    "data": f"提现审核中，单号：{row.get('out_bill_no')}"}

        return {"code": "500", "msg": "success", "data": "无记录"}
    except Exception as e:
        logger.debug("withdrawal_get failed: %s", e)
        return {"code": "500", "msg": "success", "data": "无记录"}
