"""edu P1/P2 补迁移 - 桩+日志模式.

2026-06-26 补迁移 (Java ZHS/RuoYi legacy/CRUD batch -> Python).

本文件覆盖 edu P1/P2 共 417 个端点, 按主题分组:
  - AuthuserMargin: 6 端点
  - Withdrawaldetail: 5 端点
  - advertise: 2 端点
  - agent: 10 端点
  - agentBuy: 6 端点
  - agentCategory: 5 端点
  - agentRule: 6 端点
  - agentRuleParam: 6 端点
  - agentSettlement: 6 端点
  - agentTask: 6 端点
  - agentUseDetail: 6 端点
  - agentWithdrawalDetail: 6 端点
  - agents: 6 端点
  - ai_gc: 2 端点
  - appVersion: 6 端点
  - auth: 6 端点
  - auth_accounts: 6 端点
  - auth_find_info: 6 端点
  - auth_info: 6 端点
  - auth_sms_temp: 6 端点
  - auth_tokens: 6 端点
  - auth_user_vip: 6 端点
  - auth_veri_codes: 6 端点
  - auth_vip_level: 6 端点
  - bot: 1 端点
  - carousel: 2 端点
  - category: 6 端点
  - categoryDictionary: 2 端点
  - category_link: 6 端点
  - channel: 6 端点
  - contact: 2 端点
  - courseAudit: 6 端点
  - coursePay: 6 端点
  - coursePayLog: 6 端点
  - courseTemp: 6 端点
  - courseVideoTemp: 6 端点
  - courses: 6 端点
  - coze: 4 端点
  - developer: 2 端点
  - developerFundLogs: 6 端点
  - developerLink: 2 端点
  - dictionary: 6 端点
  - educationPlatform: 5 端点
  - examine: 2 端点
  - flow: 3 端点
  - fund: 8 端点
  - gemini: 1 端点
  - google: 2 端点
  - identity_proportion: 1 端点
  - information: 3 端点
  - jianyi: 2 端点
  - job: 8 端点
  - kling: 2 端点
  - login: 36 端点
  - login_logs: 6 端点
  - mcp: 1 端点
  - news: 2 端点
  - official: 2 端点
  - order: 6 端点
  - organization: 2 端点
  - powerPurchaseRule: 2 端点
  - product_identity: 2 端点
  - ranking: 2 端点
  - record: 1 端点
  - remote: 5 端点
  - resource: 17 端点
  - taskDeveloper: 1 端点
  - tbox: 1 端点
  - token_flow: 5 端点
  - us: 2 端点
  - userAgentAudio: 5 端点
  - userAgentContext: 6 端点
  - userAgentImage: 6 端点
  - userSysLink: 6 端点
  - user_vip: 6 端点
  - users: 6 端点
  - vip_level: 2 端点
  - watch: 1 端点
  - withdrawal_flow: 6 端点
  - zhsAgent: 5 端点
  - zhsIdentity: 2 端点
  - zhs_activity: 2 端点
  - zhs_agent_buy: 7 端点
  - zhs_product: 2 端点
  - zhs_user: 6 端点

实现策略 (桩+日志模式):
  - 端点全部可达, 返回标准化 {code:0, msg:"ok", data: {...}} 响应
  - 业务逻辑全部桩化 (返回 mock 数据 + 唯一 ID 标识)
  - 所有访问记录到 logger.info (业务调用审计)
  - 后续替换: 业务实现在 service 层替换桩函数

项目硬约束:
  - 6 位错误码
  - Body 参数提交
  - 外部 HTTP timeout=30.0
  - 敏感信息脱敏
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

router = APIRouter(prefix="", tags=["Edu-Supplement-P1P2"])


def _ok(data: Any = None, msg: str = "ok") -> dict:
    return {"code": 0, "data": data, "msg": msg}


def _gen_id() -> str:
    return secrets.token_hex(8)


def _stub_response(endpoint: str, params: Optional[Dict] = None, body: Optional[Dict] = None) -> Dict[str, Any]:
    logger.info(f"[P1P2-STUB] {endpoint} called")
    return {
        "id": _gen_id(),
        "stub": True,
        "endpoint": endpoint,
        "ts": int(time.time()),
    }


def _stub_list(endpoint: str, page: int = 1, size: int = 20, **filters) -> Dict[str, Any]:
    logger.info(f"[P1P2-STUB] {endpoint} list | page={page} size={size}")
    return {
        "rows": [],
        "total": 0,
        "page": page,
        "size": size,
        "stub": True,
    }



# ======================================================================
# AuthuserMargin (6 端点)
# ======================================================================

@router.get("/AuthuserMargin/list", summary="P1/P2 桩 (原: /AuthuserMargin/list)")
def stub_get_AuthuserMargin_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/AuthuserMargin/list."""
    return _ok(_stub_response("GET /api/v1/edu/AuthuserMargin/list"))

@router.get("/AuthuserMargin/export", summary="P1/P2 桩 (原: /AuthuserMargin/export)")
def stub_get_AuthuserMargin_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/AuthuserMargin/export."""
    return _ok(_stub_response("GET /api/v1/edu/AuthuserMargin/export"))

@router.get("/AuthuserMargin/{item_id}", summary="P1/P2 桩 (原: /AuthuserMargin/{item_id})")
def stub_get_AuthuserMargin_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/AuthuserMargin/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/AuthuserMargin/{item_id}"))

@router.post("/AuthuserMargin", summary="P1/P2 桩 (原: /AuthuserMargin)")
def stub_post_AuthuserMargin(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/AuthuserMargin."""
    return _ok(_stub_response("POST /api/v1/edu/AuthuserMargin"))

@router.put("/AuthuserMargin", summary="P1/P2 桩 (原: /AuthuserMargin)")
def stub_put_AuthuserMargin(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/AuthuserMargin."""
    return _ok(_stub_response("PUT /api/v1/edu/AuthuserMargin"))

@router.delete("/AuthuserMargin/{ids}", summary="P1/P2 桩 (原: /AuthuserMargin/{ids})")
def stub_delete_AuthuserMargin_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/AuthuserMargin/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/AuthuserMargin/{ids}"))


# ======================================================================
# Withdrawaldetail (5 端点)
# ======================================================================

@router.get("/Withdrawaldetail/list", summary="P1/P2 桩 (原: /Withdrawaldetail/list)")
def stub_get_Withdrawaldetail_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/Withdrawaldetail/list."""
    return _ok(_stub_response("GET /api/v1/edu/Withdrawaldetail/list"))

@router.get("/Withdrawaldetail/{item_id}", summary="P1/P2 桩 (原: /Withdrawaldetail/{item_id})")
def stub_get_Withdrawaldetail_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/Withdrawaldetail/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/Withdrawaldetail/{item_id}"))

@router.post("/Withdrawaldetail", summary="P1/P2 桩 (原: /Withdrawaldetail)")
def stub_post_Withdrawaldetail(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/Withdrawaldetail."""
    return _ok(_stub_response("POST /api/v1/edu/Withdrawaldetail"))

@router.put("/Withdrawaldetail", summary="P1/P2 桩 (原: /Withdrawaldetail)")
def stub_put_Withdrawaldetail(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/Withdrawaldetail."""
    return _ok(_stub_response("PUT /api/v1/edu/Withdrawaldetail"))

@router.delete("/Withdrawaldetail/{ids}", summary="P1/P2 桩 (原: /Withdrawaldetail/{ids})")
def stub_delete_Withdrawaldetail_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/Withdrawaldetail/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/Withdrawaldetail/{ids}"))


# ======================================================================
# advertise (2 端点)
# ======================================================================

@router.get("/advertise/list", summary="P1/P2 桩 (原: /advertise/list)")
def stub_get_advertise_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/advertise/list."""
    return _ok(_stub_response("GET /api/v1/edu/advertise/list"))

@router.get("/advertise/export", summary="P1/P2 桩 (原: /advertise/export)")
def stub_get_advertise_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/advertise/export."""
    return _ok(_stub_response("GET /api/v1/edu/advertise/export"))


# ======================================================================
# agent (10 端点)
# ======================================================================

@router.get("/agent/rule/search", summary="P1/P2 桩 (原: /agent/rule/search)")
def stub_get_agent_rule_search():
    """P1/P2 桩端点 GET /api/v1/edu/agent/rule/search."""
    return _ok(_stub_response("GET /api/v1/edu/agent/rule/search"))

@router.get("/agent/rule/list", summary="P1/P2 桩 (原: /agent/rule/list)")
def stub_get_agent_rule_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/agent/rule/list."""
    return _ok(_stub_response("GET /api/v1/edu/agent/rule/list"))

@router.post("/agent/query/personality", summary="P1/P2 桩 (原: /agent/query/personality)")
def stub_post_agent_query_personality(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/agent/query/personality."""
    return _ok(_stub_response("POST /api/v1/edu/agent/query/personality"))

@router.get("/agent/use/history", summary="P1/P2 桩 (原: /agent/use/history)")
def stub_get_agent_use_history():
    """P1/P2 桩端点 GET /api/v1/edu/agent/use/history."""
    return _ok(_stub_response("GET /api/v1/edu/agent/use/history"))

@router.post("/agent/creation/my/{creation_type}", summary="P1/P2 桩 (原: /agent/creation/my/{creation_type})")
def stub_post_agent_creation_my_creation_type(creation_type: int = 0, payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/agent/creation/my/{creation_type}."""
    return _ok(_stub_response("POST /api/v1/edu/agent/creation/my/{creation_type}"))

@router.post("/agent/creation/share", summary="P1/P2 桩 (原: /agent/creation/share)")
def stub_post_agent_creation_share(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/agent/creation/share."""
    return _ok(_stub_response("POST /api/v1/edu/agent/creation/share"))

@router.get("/agent/creation/operate/{gc_id}/{operate_type}", summary="P1/P2 桩 (原: /agent/creation/operate/{gc_id}/{operate_type})")
def stub_get_agent_creation_operate_gc_id_operate_type(gc_id: int = 0, operate_type: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/agent/creation/operate/{gc_id}/{operate_type}."""
    return _ok(_stub_response("GET /api/v1/edu/agent/creation/operate/{gc_id}/{operate_type}"))

@router.get("/agent/creation/share/third/{code}", summary="P1/P2 桩 (原: /agent/creation/share/third/{code})")
def stub_get_agent_creation_share_third_code(code: str = ""):
    """P1/P2 桩端点 GET /api/v1/edu/agent/creation/share/third/{code}."""
    return _ok(_stub_response("GET /api/v1/edu/agent/creation/share/third/{code}"))

@router.post("/agent/creation/share/code", summary="P1/P2 桩 (原: /agent/creation/share/code)")
def stub_post_agent_creation_share_code(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/agent/creation/share/code."""
    return _ok(_stub_response("POST /api/v1/edu/agent/creation/share/code"))

@router.post("/agent/creation/image", summary="P1/P2 桩 (原: /agent/creation/image)")
def stub_post_agent_creation_image(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/agent/creation/image."""
    return _ok(_stub_response("POST /api/v1/edu/agent/creation/image"))


# ======================================================================
# agentBuy (6 端点)
# ======================================================================

@router.get("/agentBuy/list", summary="P1/P2 桩 (原: /agentBuy/list)")
def stub_get_agentBuy_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/agentBuy/list."""
    return _ok(_stub_response("GET /api/v1/edu/agentBuy/list"))

@router.get("/agentBuy/export", summary="P1/P2 桩 (原: /agentBuy/export)")
def stub_get_agentBuy_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/agentBuy/export."""
    return _ok(_stub_response("GET /api/v1/edu/agentBuy/export"))

@router.get("/agentBuy/{item_id}", summary="P1/P2 桩 (原: /agentBuy/{item_id})")
def stub_get_agentBuy_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/agentBuy/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/agentBuy/{item_id}"))

@router.post("/agentBuy", summary="P1/P2 桩 (原: /agentBuy)")
def stub_post_agentBuy(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/agentBuy."""
    return _ok(_stub_response("POST /api/v1/edu/agentBuy"))

@router.put("/agentBuy", summary="P1/P2 桩 (原: /agentBuy)")
def stub_put_agentBuy(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/agentBuy."""
    return _ok(_stub_response("PUT /api/v1/edu/agentBuy"))

@router.delete("/agentBuy/{ids}", summary="P1/P2 桩 (原: /agentBuy/{ids})")
def stub_delete_agentBuy_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/agentBuy/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/agentBuy/{ids}"))


# ======================================================================
# agentCategory (5 端点)
# ======================================================================

@router.get("/agentCategory/list", summary="P1/P2 桩 (原: /agentCategory/list)")
def stub_get_agentCategory_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/agentCategory/list."""
    return _ok(_stub_response("GET /api/v1/edu/agentCategory/list"))

@router.get("/agentCategory/{item_id}", summary="P1/P2 桩 (原: /agentCategory/{item_id})")
def stub_get_agentCategory_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/agentCategory/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/agentCategory/{item_id}"))

@router.post("/agentCategory", summary="P1/P2 桩 (原: /agentCategory)")
def stub_post_agentCategory(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/agentCategory."""
    return _ok(_stub_response("POST /api/v1/edu/agentCategory"))

@router.put("/agentCategory", summary="P1/P2 桩 (原: /agentCategory)")
def stub_put_agentCategory(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/agentCategory."""
    return _ok(_stub_response("PUT /api/v1/edu/agentCategory"))

@router.delete("/agentCategory/{ids}", summary="P1/P2 桩 (原: /agentCategory/{ids})")
def stub_delete_agentCategory_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/agentCategory/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/agentCategory/{ids}"))


# ======================================================================
# agentRule (6 端点)
# ======================================================================

@router.get("/agentRule/list", summary="P1/P2 桩 (原: /agentRule/list)")
def stub_get_agentRule_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/agentRule/list."""
    return _ok(_stub_response("GET /api/v1/edu/agentRule/list"))

@router.get("/agentRule/export", summary="P1/P2 桩 (原: /agentRule/export)")
def stub_get_agentRule_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/agentRule/export."""
    return _ok(_stub_response("GET /api/v1/edu/agentRule/export"))

@router.get("/agentRule/{item_id}", summary="P1/P2 桩 (原: /agentRule/{item_id})")
def stub_get_agentRule_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/agentRule/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/agentRule/{item_id}"))

@router.post("/agentRule", summary="P1/P2 桩 (原: /agentRule)")
def stub_post_agentRule(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/agentRule."""
    return _ok(_stub_response("POST /api/v1/edu/agentRule"))

@router.put("/agentRule", summary="P1/P2 桩 (原: /agentRule)")
def stub_put_agentRule(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/agentRule."""
    return _ok(_stub_response("PUT /api/v1/edu/agentRule"))

@router.delete("/agentRule/{ids}", summary="P1/P2 桩 (原: /agentRule/{ids})")
def stub_delete_agentRule_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/agentRule/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/agentRule/{ids}"))


# ======================================================================
# agentRuleParam (6 端点)
# ======================================================================

@router.get("/agentRuleParam/list", summary="P1/P2 桩 (原: /agentRuleParam/list)")
def stub_get_agentRuleParam_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/agentRuleParam/list."""
    return _ok(_stub_response("GET /api/v1/edu/agentRuleParam/list"))

@router.get("/agentRuleParam/export", summary="P1/P2 桩 (原: /agentRuleParam/export)")
def stub_get_agentRuleParam_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/agentRuleParam/export."""
    return _ok(_stub_response("GET /api/v1/edu/agentRuleParam/export"))

@router.get("/agentRuleParam/{item_id}", summary="P1/P2 桩 (原: /agentRuleParam/{item_id})")
def stub_get_agentRuleParam_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/agentRuleParam/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/agentRuleParam/{item_id}"))

@router.post("/agentRuleParam", summary="P1/P2 桩 (原: /agentRuleParam)")
def stub_post_agentRuleParam(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/agentRuleParam."""
    return _ok(_stub_response("POST /api/v1/edu/agentRuleParam"))

@router.put("/agentRuleParam", summary="P1/P2 桩 (原: /agentRuleParam)")
def stub_put_agentRuleParam(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/agentRuleParam."""
    return _ok(_stub_response("PUT /api/v1/edu/agentRuleParam"))

@router.delete("/agentRuleParam/{ids}", summary="P1/P2 桩 (原: /agentRuleParam/{ids})")
def stub_delete_agentRuleParam_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/agentRuleParam/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/agentRuleParam/{ids}"))


# ======================================================================
# agentSettlement (6 端点)
# ======================================================================

@router.get("/agentSettlement/list", summary="P1/P2 桩 (原: /agentSettlement/list)")
def stub_get_agentSettlement_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/agentSettlement/list."""
    return _ok(_stub_response("GET /api/v1/edu/agentSettlement/list"))

@router.get("/agentSettlement/export", summary="P1/P2 桩 (原: /agentSettlement/export)")
def stub_get_agentSettlement_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/agentSettlement/export."""
    return _ok(_stub_response("GET /api/v1/edu/agentSettlement/export"))

@router.get("/agentSettlement/{item_id}", summary="P1/P2 桩 (原: /agentSettlement/{item_id})")
def stub_get_agentSettlement_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/agentSettlement/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/agentSettlement/{item_id}"))

@router.post("/agentSettlement", summary="P1/P2 桩 (原: /agentSettlement)")
def stub_post_agentSettlement(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/agentSettlement."""
    return _ok(_stub_response("POST /api/v1/edu/agentSettlement"))

@router.put("/agentSettlement", summary="P1/P2 桩 (原: /agentSettlement)")
def stub_put_agentSettlement(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/agentSettlement."""
    return _ok(_stub_response("PUT /api/v1/edu/agentSettlement"))

@router.delete("/agentSettlement/{ids}", summary="P1/P2 桩 (原: /agentSettlement/{ids})")
def stub_delete_agentSettlement_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/agentSettlement/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/agentSettlement/{ids}"))


# ======================================================================
# agentTask (6 端点)
# ======================================================================

@router.get("/agentTask/list", summary="P1/P2 桩 (原: /agentTask/list)")
def stub_get_agentTask_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/agentTask/list."""
    return _ok(_stub_response("GET /api/v1/edu/agentTask/list"))

@router.get("/agentTask/export", summary="P1/P2 桩 (原: /agentTask/export)")
def stub_get_agentTask_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/agentTask/export."""
    return _ok(_stub_response("GET /api/v1/edu/agentTask/export"))

@router.get("/agentTask/{item_id}", summary="P1/P2 桩 (原: /agentTask/{item_id})")
def stub_get_agentTask_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/agentTask/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/agentTask/{item_id}"))

@router.post("/agentTask", summary="P1/P2 桩 (原: /agentTask)")
def stub_post_agentTask(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/agentTask."""
    return _ok(_stub_response("POST /api/v1/edu/agentTask"))

@router.put("/agentTask", summary="P1/P2 桩 (原: /agentTask)")
def stub_put_agentTask(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/agentTask."""
    return _ok(_stub_response("PUT /api/v1/edu/agentTask"))

@router.delete("/agentTask/{ids}", summary="P1/P2 桩 (原: /agentTask/{ids})")
def stub_delete_agentTask_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/agentTask/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/agentTask/{ids}"))


# ======================================================================
# agentUseDetail (6 端点)
# ======================================================================

@router.get("/agentUseDetail/list", summary="P1/P2 桩 (原: /agentUseDetail/list)")
def stub_get_agentUseDetail_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/agentUseDetail/list."""
    return _ok(_stub_response("GET /api/v1/edu/agentUseDetail/list"))

@router.get("/agentUseDetail/export", summary="P1/P2 桩 (原: /agentUseDetail/export)")
def stub_get_agentUseDetail_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/agentUseDetail/export."""
    return _ok(_stub_response("GET /api/v1/edu/agentUseDetail/export"))

@router.get("/agentUseDetail/{item_id}", summary="P1/P2 桩 (原: /agentUseDetail/{item_id})")
def stub_get_agentUseDetail_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/agentUseDetail/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/agentUseDetail/{item_id}"))

@router.post("/agentUseDetail", summary="P1/P2 桩 (原: /agentUseDetail)")
def stub_post_agentUseDetail(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/agentUseDetail."""
    return _ok(_stub_response("POST /api/v1/edu/agentUseDetail"))

@router.put("/agentUseDetail", summary="P1/P2 桩 (原: /agentUseDetail)")
def stub_put_agentUseDetail(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/agentUseDetail."""
    return _ok(_stub_response("PUT /api/v1/edu/agentUseDetail"))

@router.delete("/agentUseDetail/{ids}", summary="P1/P2 桩 (原: /agentUseDetail/{ids})")
def stub_delete_agentUseDetail_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/agentUseDetail/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/agentUseDetail/{ids}"))


# ======================================================================
# agentWithdrawalDetail (6 端点)
# ======================================================================

@router.get("/agentWithdrawalDetail/list", summary="P1/P2 桩 (原: /agentWithdrawalDetail/list)")
def stub_get_agentWithdrawalDetail_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/agentWithdrawalDetail/list."""
    return _ok(_stub_response("GET /api/v1/edu/agentWithdrawalDetail/list"))

@router.get("/agentWithdrawalDetail/export", summary="P1/P2 桩 (原: /agentWithdrawalDetail/export)")
def stub_get_agentWithdrawalDetail_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/agentWithdrawalDetail/export."""
    return _ok(_stub_response("GET /api/v1/edu/agentWithdrawalDetail/export"))

@router.get("/agentWithdrawalDetail/{item_id}", summary="P1/P2 桩 (原: /agentWithdrawalDetail/{item_id})")
def stub_get_agentWithdrawalDetail_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/agentWithdrawalDetail/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/agentWithdrawalDetail/{item_id}"))

@router.post("/agentWithdrawalDetail", summary="P1/P2 桩 (原: /agentWithdrawalDetail)")
def stub_post_agentWithdrawalDetail(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/agentWithdrawalDetail."""
    return _ok(_stub_response("POST /api/v1/edu/agentWithdrawalDetail"))

@router.put("/agentWithdrawalDetail", summary="P1/P2 桩 (原: /agentWithdrawalDetail)")
def stub_put_agentWithdrawalDetail(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/agentWithdrawalDetail."""
    return _ok(_stub_response("PUT /api/v1/edu/agentWithdrawalDetail"))

@router.delete("/agentWithdrawalDetail/{ids}", summary="P1/P2 桩 (原: /agentWithdrawalDetail/{ids})")
def stub_delete_agentWithdrawalDetail_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/agentWithdrawalDetail/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/agentWithdrawalDetail/{ids}"))


# ======================================================================
# agents (6 端点)
# ======================================================================

@router.get("/agents/list", summary="P1/P2 桩 (原: /agents/list)")
def stub_get_agents_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/agents/list."""
    return _ok(_stub_response("GET /api/v1/edu/agents/list"))

@router.get("/agents/export", summary="P1/P2 桩 (原: /agents/export)")
def stub_get_agents_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/agents/export."""
    return _ok(_stub_response("GET /api/v1/edu/agents/export"))

@router.get("/agents/{item_id}", summary="P1/P2 桩 (原: /agents/{item_id})")
def stub_get_agents_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/agents/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/agents/{item_id}"))

@router.post("/agents", summary="P1/P2 桩 (原: /agents)")
def stub_post_agents(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/agents."""
    return _ok(_stub_response("POST /api/v1/edu/agents"))

@router.put("/agents", summary="P1/P2 桩 (原: /agents)")
def stub_put_agents(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/agents."""
    return _ok(_stub_response("PUT /api/v1/edu/agents"))

@router.delete("/agents/{ids}", summary="P1/P2 桩 (原: /agents/{ids})")
def stub_delete_agents_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/agents/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/agents/{ids}"))


# ======================================================================
# ai_gc (2 端点)
# ======================================================================

@router.get("/ai_gc/list", summary="P1/P2 桩 (原: /ai_gc/list)")
def stub_get_ai_gc_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/ai_gc/list."""
    return _ok(_stub_response("GET /api/v1/edu/ai_gc/list"))

@router.get("/ai_gc/export", summary="P1/P2 桩 (原: /ai_gc/export)")
def stub_get_ai_gc_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/ai_gc/export."""
    return _ok(_stub_response("GET /api/v1/edu/ai_gc/export"))


# ======================================================================
# appVersion (6 端点)
# ======================================================================

@router.get("/appVersion/list", summary="P1/P2 桩 (原: /appVersion/list)")
def stub_get_appVersion_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/appVersion/list."""
    return _ok(_stub_response("GET /api/v1/edu/appVersion/list"))

@router.get("/appVersion/info/{item_id}", summary="P1/P2 桩 (原: /appVersion/info/{item_id})")
def stub_get_appVersion_info_item_id(item_id: int = 0, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/appVersion/info/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/appVersion/info/{item_id}"))

@router.delete("/appVersion/{ids}", summary="P1/P2 桩 (原: /appVersion/{ids})")
def stub_delete_appVersion_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/appVersion/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/appVersion/{ids}"))

@router.get("/appVersion/{app_id}/{version}", summary="P1/P2 桩 (原: /appVersion/{app_id}/{version})")
def stub_get_appVersion_app_id_version(app_id: int = 0, version: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/appVersion/{app_id}/{version}."""
    return _ok(_stub_response("GET /api/v1/edu/appVersion/{app_id}/{version}"))

@router.post("/appVersion", summary="P1/P2 桩 (原: /appVersion)")
def stub_post_appVersion(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/appVersion."""
    return _ok(_stub_response("POST /api/v1/edu/appVersion"))

@router.put("/appVersion", summary="P1/P2 桩 (原: /appVersion)")
def stub_put_appVersion(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/appVersion."""
    return _ok(_stub_response("PUT /api/v1/edu/appVersion"))


# ======================================================================
# auth (6 端点)
# ======================================================================

@router.get("/auth/list", summary="P1/P2 桩 (原: /auth/list)")
def stub_get_auth_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/auth/list."""
    return _ok(_stub_response("GET /api/v1/edu/auth/list"))

@router.get("/auth/export", summary="P1/P2 桩 (原: /auth/export)")
def stub_get_auth_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/auth/export."""
    return _ok(_stub_response("GET /api/v1/edu/auth/export"))

@router.get("/auth/{item_id}", summary="P1/P2 桩 (原: /auth/{item_id})")
def stub_get_auth_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/auth/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/auth/{item_id}"))

@router.post("/auth", summary="P1/P2 桩 (原: /auth)")
def stub_post_auth(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/auth."""
    return _ok(_stub_response("POST /api/v1/edu/auth"))

@router.put("/auth", summary="P1/P2 桩 (原: /auth)")
def stub_put_auth(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/auth."""
    return _ok(_stub_response("PUT /api/v1/edu/auth"))

@router.delete("/auth/{ids}", summary="P1/P2 桩 (原: /auth/{ids})")
def stub_delete_auth_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/auth/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/auth/{ids}"))


# ======================================================================
# auth_accounts (6 端点)
# ======================================================================

@router.get("/auth_accounts/list", summary="P1/P2 桩 (原: /auth_accounts/list)")
def stub_get_auth_accounts_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/auth_accounts/list."""
    return _ok(_stub_response("GET /api/v1/edu/auth_accounts/list"))

@router.get("/auth_accounts/export", summary="P1/P2 桩 (原: /auth_accounts/export)")
def stub_get_auth_accounts_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/auth_accounts/export."""
    return _ok(_stub_response("GET /api/v1/edu/auth_accounts/export"))

@router.get("/auth_accounts/{item_id}", summary="P1/P2 桩 (原: /auth_accounts/{item_id})")
def stub_get_auth_accounts_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/auth_accounts/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/auth_accounts/{item_id}"))

@router.post("/auth_accounts", summary="P1/P2 桩 (原: /auth_accounts)")
def stub_post_auth_accounts(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/auth_accounts."""
    return _ok(_stub_response("POST /api/v1/edu/auth_accounts"))

@router.put("/auth_accounts", summary="P1/P2 桩 (原: /auth_accounts)")
def stub_put_auth_accounts(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/auth_accounts."""
    return _ok(_stub_response("PUT /api/v1/edu/auth_accounts"))

@router.delete("/auth_accounts/{ids}", summary="P1/P2 桩 (原: /auth_accounts/{ids})")
def stub_delete_auth_accounts_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/auth_accounts/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/auth_accounts/{ids}"))


# ======================================================================
# auth_find_info (6 端点)
# ======================================================================

@router.get("/auth_find_info/list", summary="P1/P2 桩 (原: /auth_find_info/list)")
def stub_get_auth_find_info_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/auth_find_info/list."""
    return _ok(_stub_response("GET /api/v1/edu/auth_find_info/list"))

@router.get("/auth_find_info/export", summary="P1/P2 桩 (原: /auth_find_info/export)")
def stub_get_auth_find_info_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/auth_find_info/export."""
    return _ok(_stub_response("GET /api/v1/edu/auth_find_info/export"))

@router.get("/auth_find_info/{item_id}", summary="P1/P2 桩 (原: /auth_find_info/{item_id})")
def stub_get_auth_find_info_item_id(item_id: int = 0, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/auth_find_info/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/auth_find_info/{item_id}"))

@router.post("/auth_find_info", summary="P1/P2 桩 (原: /auth_find_info)")
def stub_post_auth_find_info(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/auth_find_info."""
    return _ok(_stub_response("POST /api/v1/edu/auth_find_info"))

@router.put("/auth_find_info", summary="P1/P2 桩 (原: /auth_find_info)")
def stub_put_auth_find_info(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/auth_find_info."""
    return _ok(_stub_response("PUT /api/v1/edu/auth_find_info"))

@router.delete("/auth_find_info/{ids}", summary="P1/P2 桩 (原: /auth_find_info/{ids})")
def stub_delete_auth_find_info_ids(ids: int = 0, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 DELETE /api/v1/edu/auth_find_info/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/auth_find_info/{ids}"))


# ======================================================================
# auth_info (6 端点)
# ======================================================================

@router.get("/auth_info/list", summary="P1/P2 桩 (原: /auth_info/list)")
def stub_get_auth_info_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/auth_info/list."""
    return _ok(_stub_response("GET /api/v1/edu/auth_info/list"))

@router.get("/auth_info/export", summary="P1/P2 桩 (原: /auth_info/export)")
def stub_get_auth_info_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/auth_info/export."""
    return _ok(_stub_response("GET /api/v1/edu/auth_info/export"))

@router.get("/auth_info/{item_id}", summary="P1/P2 桩 (原: /auth_info/{item_id})")
def stub_get_auth_info_item_id(item_id: int = 0, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/auth_info/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/auth_info/{item_id}"))

@router.post("/auth_info", summary="P1/P2 桩 (原: /auth_info)")
def stub_post_auth_info(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/auth_info."""
    return _ok(_stub_response("POST /api/v1/edu/auth_info"))

@router.put("/auth_info", summary="P1/P2 桩 (原: /auth_info)")
def stub_put_auth_info(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/auth_info."""
    return _ok(_stub_response("PUT /api/v1/edu/auth_info"))

@router.delete("/auth_info/{ids}", summary="P1/P2 桩 (原: /auth_info/{ids})")
def stub_delete_auth_info_ids(ids: int = 0, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 DELETE /api/v1/edu/auth_info/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/auth_info/{ids}"))


# ======================================================================
# auth_sms_temp (6 端点)
# ======================================================================

@router.get("/auth_sms_temp/list", summary="P1/P2 桩 (原: /auth_sms_temp/list)")
def stub_get_auth_sms_temp_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/auth_sms_temp/list."""
    return _ok(_stub_response("GET /api/v1/edu/auth_sms_temp/list"))

@router.get("/auth_sms_temp/export", summary="P1/P2 桩 (原: /auth_sms_temp/export)")
def stub_get_auth_sms_temp_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/auth_sms_temp/export."""
    return _ok(_stub_response("GET /api/v1/edu/auth_sms_temp/export"))

@router.get("/auth_sms_temp/{item_id}", summary="P1/P2 桩 (原: /auth_sms_temp/{item_id})")
def stub_get_auth_sms_temp_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/auth_sms_temp/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/auth_sms_temp/{item_id}"))

@router.post("/auth_sms_temp", summary="P1/P2 桩 (原: /auth_sms_temp)")
def stub_post_auth_sms_temp(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/auth_sms_temp."""
    return _ok(_stub_response("POST /api/v1/edu/auth_sms_temp"))

@router.put("/auth_sms_temp", summary="P1/P2 桩 (原: /auth_sms_temp)")
def stub_put_auth_sms_temp(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/auth_sms_temp."""
    return _ok(_stub_response("PUT /api/v1/edu/auth_sms_temp"))

@router.delete("/auth_sms_temp/{ids}", summary="P1/P2 桩 (原: /auth_sms_temp/{ids})")
def stub_delete_auth_sms_temp_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/auth_sms_temp/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/auth_sms_temp/{ids}"))


# ======================================================================
# auth_tokens (6 端点)
# ======================================================================

@router.get("/auth_tokens/list", summary="P1/P2 桩 (原: /auth_tokens/list)")
def stub_get_auth_tokens_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/auth_tokens/list."""
    return _ok(_stub_response("GET /api/v1/edu/auth_tokens/list"))

@router.get("/auth_tokens/export", summary="P1/P2 桩 (原: /auth_tokens/export)")
def stub_get_auth_tokens_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/auth_tokens/export."""
    return _ok(_stub_response("GET /api/v1/edu/auth_tokens/export"))

@router.get("/auth_tokens/{item_id}", summary="P1/P2 桩 (原: /auth_tokens/{item_id})")
def stub_get_auth_tokens_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/auth_tokens/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/auth_tokens/{item_id}"))

@router.post("/auth_tokens", summary="P1/P2 桩 (原: /auth_tokens)")
def stub_post_auth_tokens(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/auth_tokens."""
    return _ok(_stub_response("POST /api/v1/edu/auth_tokens"))

@router.put("/auth_tokens", summary="P1/P2 桩 (原: /auth_tokens)")
def stub_put_auth_tokens(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/auth_tokens."""
    return _ok(_stub_response("PUT /api/v1/edu/auth_tokens"))

@router.delete("/auth_tokens/{ids}", summary="P1/P2 桩 (原: /auth_tokens/{ids})")
def stub_delete_auth_tokens_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/auth_tokens/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/auth_tokens/{ids}"))


# ======================================================================
# auth_user_vip (6 端点)
# ======================================================================

@router.get("/auth_user_vip/list", summary="P1/P2 桩 (原: /auth_user_vip/list)")
def stub_get_auth_user_vip_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/auth_user_vip/list."""
    return _ok(_stub_response("GET /api/v1/edu/auth_user_vip/list"))

@router.get("/auth_user_vip/export", summary="P1/P2 桩 (原: /auth_user_vip/export)")
def stub_get_auth_user_vip_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/auth_user_vip/export."""
    return _ok(_stub_response("GET /api/v1/edu/auth_user_vip/export"))

@router.get("/auth_user_vip/{item_id}", summary="P1/P2 桩 (原: /auth_user_vip/{item_id})")
def stub_get_auth_user_vip_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/auth_user_vip/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/auth_user_vip/{item_id}"))

@router.post("/auth_user_vip", summary="P1/P2 桩 (原: /auth_user_vip)")
def stub_post_auth_user_vip(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/auth_user_vip."""
    return _ok(_stub_response("POST /api/v1/edu/auth_user_vip"))

@router.put("/auth_user_vip", summary="P1/P2 桩 (原: /auth_user_vip)")
def stub_put_auth_user_vip(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/auth_user_vip."""
    return _ok(_stub_response("PUT /api/v1/edu/auth_user_vip"))

@router.delete("/auth_user_vip/{ids}", summary="P1/P2 桩 (原: /auth_user_vip/{ids})")
def stub_delete_auth_user_vip_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/auth_user_vip/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/auth_user_vip/{ids}"))


# ======================================================================
# auth_veri_codes (6 端点)
# ======================================================================

@router.get("/auth_veri_codes/list", summary="P1/P2 桩 (原: /auth_veri_codes/list)")
def stub_get_auth_veri_codes_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/auth_veri_codes/list."""
    return _ok(_stub_response("GET /api/v1/edu/auth_veri_codes/list"))

@router.get("/auth_veri_codes/export", summary="P1/P2 桩 (原: /auth_veri_codes/export)")
def stub_get_auth_veri_codes_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/auth_veri_codes/export."""
    return _ok(_stub_response("GET /api/v1/edu/auth_veri_codes/export"))

@router.get("/auth_veri_codes/{item_id}", summary="P1/P2 桩 (原: /auth_veri_codes/{item_id})")
def stub_get_auth_veri_codes_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/auth_veri_codes/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/auth_veri_codes/{item_id}"))

@router.post("/auth_veri_codes", summary="P1/P2 桩 (原: /auth_veri_codes)")
def stub_post_auth_veri_codes(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/auth_veri_codes."""
    return _ok(_stub_response("POST /api/v1/edu/auth_veri_codes"))

@router.put("/auth_veri_codes", summary="P1/P2 桩 (原: /auth_veri_codes)")
def stub_put_auth_veri_codes(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/auth_veri_codes."""
    return _ok(_stub_response("PUT /api/v1/edu/auth_veri_codes"))

@router.delete("/auth_veri_codes/{ids}", summary="P1/P2 桩 (原: /auth_veri_codes/{ids})")
def stub_delete_auth_veri_codes_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/auth_veri_codes/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/auth_veri_codes/{ids}"))


# ======================================================================
# auth_vip_level (6 端点)
# ======================================================================

@router.get("/auth_vip_level/list", summary="P1/P2 桩 (原: /auth_vip_level/list)")
def stub_get_auth_vip_level_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/auth_vip_level/list."""
    return _ok(_stub_response("GET /api/v1/edu/auth_vip_level/list"))

@router.get("/auth_vip_level/export", summary="P1/P2 桩 (原: /auth_vip_level/export)")
def stub_get_auth_vip_level_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/auth_vip_level/export."""
    return _ok(_stub_response("GET /api/v1/edu/auth_vip_level/export"))

@router.get("/auth_vip_level/{item_id}", summary="P1/P2 桩 (原: /auth_vip_level/{item_id})")
def stub_get_auth_vip_level_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/auth_vip_level/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/auth_vip_level/{item_id}"))

@router.post("/auth_vip_level", summary="P1/P2 桩 (原: /auth_vip_level)")
def stub_post_auth_vip_level(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/auth_vip_level."""
    return _ok(_stub_response("POST /api/v1/edu/auth_vip_level"))

@router.put("/auth_vip_level", summary="P1/P2 桩 (原: /auth_vip_level)")
def stub_put_auth_vip_level(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/auth_vip_level."""
    return _ok(_stub_response("PUT /api/v1/edu/auth_vip_level"))

@router.delete("/auth_vip_level/{ids}", summary="P1/P2 桩 (原: /auth_vip_level/{ids})")
def stub_delete_auth_vip_level_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/auth_vip_level/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/auth_vip_level/{ids}"))


# ======================================================================
# bot (1 端点)
# ======================================================================

@router.get("/bot/sites/kind", summary="P1/P2 桩 (原: /bot/sites/kind)")
def stub_get_bot_sites_kind(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/bot/sites/kind."""
    return _ok(_stub_response("GET /api/v1/edu/bot/sites/kind"))


# ======================================================================
# carousel (2 端点)
# ======================================================================

@router.get("/carousel/list", summary="P1/P2 桩 (原: /carousel/list)")
def stub_get_carousel_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/carousel/list."""
    return _ok(_stub_response("GET /api/v1/edu/carousel/list"))

@router.get("/carousel/export", summary="P1/P2 桩 (原: /carousel/export)")
def stub_get_carousel_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/carousel/export."""
    return _ok(_stub_response("GET /api/v1/edu/carousel/export"))


# ======================================================================
# category (6 端点)
# ======================================================================

@router.get("/category/list", summary="P1/P2 桩 (原: /category/list)")
def stub_get_category_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/category/list."""
    return _ok(_stub_response("GET /api/v1/edu/category/list"))

@router.get("/category/export", summary="P1/P2 桩 (原: /category/export)")
def stub_get_category_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/category/export."""
    return _ok(_stub_response("GET /api/v1/edu/category/export"))

@router.get("/category/{item_id}", summary="P1/P2 桩 (原: /category/{item_id})")
def stub_get_category_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/category/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/category/{item_id}"))

@router.post("/category", summary="P1/P2 桩 (原: /category)")
def stub_post_category(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/category."""
    return _ok(_stub_response("POST /api/v1/edu/category"))

@router.put("/category", summary="P1/P2 桩 (原: /category)")
def stub_put_category(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/category."""
    return _ok(_stub_response("PUT /api/v1/edu/category"))

@router.delete("/category/{ids}", summary="P1/P2 桩 (原: /category/{ids})")
def stub_delete_category_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/category/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/category/{ids}"))


# ======================================================================
# categoryDictionary (2 端点)
# ======================================================================

@router.get("/categoryDictionary/list", summary="P1/P2 桩 (原: /categoryDictionary/list)")
def stub_get_categoryDictionary_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/categoryDictionary/list."""
    return _ok(_stub_response("GET /api/v1/edu/categoryDictionary/list"))

@router.get("/categoryDictionary/get/parent", summary="P1/P2 桩 (原: /categoryDictionary/get/parent)")
def stub_get_categoryDictionary_get_parent():
    """P1/P2 桩端点 GET /api/v1/edu/categoryDictionary/get/parent."""
    return _ok(_stub_response("GET /api/v1/edu/categoryDictionary/get/parent"))


# ======================================================================
# category_link (6 端点)
# ======================================================================

@router.get("/category_link/list", summary="P1/P2 桩 (原: /category_link/list)")
def stub_get_category_link_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/category_link/list."""
    return _ok(_stub_response("GET /api/v1/edu/category_link/list"))

@router.get("/category_link/export", summary="P1/P2 桩 (原: /category_link/export)")
def stub_get_category_link_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/category_link/export."""
    return _ok(_stub_response("GET /api/v1/edu/category_link/export"))

@router.get("/category_link/{item_id}", summary="P1/P2 桩 (原: /category_link/{item_id})")
def stub_get_category_link_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/category_link/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/category_link/{item_id}"))

@router.post("/category_link", summary="P1/P2 桩 (原: /category_link)")
def stub_post_category_link(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/category_link."""
    return _ok(_stub_response("POST /api/v1/edu/category_link"))

@router.put("/category_link", summary="P1/P2 桩 (原: /category_link)")
def stub_put_category_link(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/category_link."""
    return _ok(_stub_response("PUT /api/v1/edu/category_link"))

@router.delete("/category_link/{ids}", summary="P1/P2 桩 (原: /category_link/{ids})")
def stub_delete_category_link_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/category_link/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/category_link/{ids}"))


# ======================================================================
# channel (6 端点)
# ======================================================================

@router.get("/channel/list", summary="P1/P2 桩 (原: /login/pwd)")
def stub_get_channel_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/channel/list."""
    return _ok(_stub_response("GET /api/v1/edu/channel/list"))

@router.get("/channel/all", summary="P1/P2 桩 (原: /login/pwd)")
def stub_get_channel_all():
    """P1/P2 桩端点 GET /api/v1/edu/channel/all."""
    return _ok(_stub_response("GET /api/v1/edu/channel/all"))

@router.get("/channel", summary="P1/P2 桩 (原: /login/pwd)")
def stub_get_channel():
    """P1/P2 桩端点 GET /api/v1/edu/channel."""
    return _ok(_stub_response("GET /api/v1/edu/channel"))

@router.post("/channel", summary="P1/P2 桩 (原: /login/pwd)")
def stub_post_channel(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/channel."""
    return _ok(_stub_response("POST /api/v1/edu/channel"))

@router.put("/channel", summary="P1/P2 桩 (原: /login/pwd)")
def stub_put_channel(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/channel."""
    return _ok(_stub_response("PUT /api/v1/edu/channel"))

@router.delete("/channel", summary="P1/P2 桩 (原: /login/pwd)")
def stub_delete_channel():
    """P1/P2 桩端点 DELETE /api/v1/edu/channel."""
    return _ok(_stub_response("DELETE /api/v1/edu/channel"))


# ======================================================================
# contact (2 端点)
# ======================================================================

@router.get("/contact/list", summary="P1/P2 桩 (原: /contact/list)")
def stub_get_contact_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/contact/list."""
    return _ok(_stub_response("GET /api/v1/edu/contact/list"))

@router.get("/contact/export", summary="P1/P2 桩 (原: /contact/export)")
def stub_get_contact_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/contact/export."""
    return _ok(_stub_response("GET /api/v1/edu/contact/export"))


# ======================================================================
# courseAudit (6 端点)
# ======================================================================

@router.get("/courseAudit/list", summary="P1/P2 桩 (原: /courseAudit/list)")
def stub_get_courseAudit_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/courseAudit/list."""
    return _ok(_stub_response("GET /api/v1/edu/courseAudit/list"))

@router.get("/courseAudit/export", summary="P1/P2 桩 (原: /courseAudit/export)")
def stub_get_courseAudit_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/courseAudit/export."""
    return _ok(_stub_response("GET /api/v1/edu/courseAudit/export"))

@router.get("/courseAudit/{item_id}", summary="P1/P2 桩 (原: /courseAudit/{item_id})")
def stub_get_courseAudit_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/courseAudit/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/courseAudit/{item_id}"))

@router.post("/courseAudit", summary="P1/P2 桩 (原: /courseAudit)")
def stub_post_courseAudit(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/courseAudit."""
    return _ok(_stub_response("POST /api/v1/edu/courseAudit"))

@router.put("/courseAudit", summary="P1/P2 桩 (原: /courseAudit)")
def stub_put_courseAudit(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/courseAudit."""
    return _ok(_stub_response("PUT /api/v1/edu/courseAudit"))

@router.delete("/courseAudit/{ids}", summary="P1/P2 桩 (原: /courseAudit/{ids})")
def stub_delete_courseAudit_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/courseAudit/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/courseAudit/{ids}"))


# ======================================================================
# coursePay (6 端点)
# ======================================================================

@router.get("/coursePay/list", summary="P1/P2 桩 (原: /coursePay/list)")
def stub_get_coursePay_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/coursePay/list."""
    return _ok(_stub_response("GET /api/v1/edu/coursePay/list"))

@router.get("/coursePay/export", summary="P1/P2 桩 (原: /coursePay/export)")
def stub_get_coursePay_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/coursePay/export."""
    return _ok(_stub_response("GET /api/v1/edu/coursePay/export"))

@router.get("/coursePay/{item_id}", summary="P1/P2 桩 (原: /coursePay/{item_id})")
def stub_get_coursePay_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/coursePay/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/coursePay/{item_id}"))

@router.post("/coursePay", summary="P1/P2 桩 (原: /coursePay)")
def stub_post_coursePay(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/coursePay."""
    return _ok(_stub_response("POST /api/v1/edu/coursePay"))

@router.put("/coursePay", summary="P1/P2 桩 (原: /coursePay)")
def stub_put_coursePay(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/coursePay."""
    return _ok(_stub_response("PUT /api/v1/edu/coursePay"))

@router.delete("/coursePay/{ids}", summary="P1/P2 桩 (原: /coursePay/{ids})")
def stub_delete_coursePay_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/coursePay/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/coursePay/{ids}"))


# ======================================================================
# coursePayLog (6 端点)
# ======================================================================

@router.get("/coursePayLog/list", summary="P1/P2 桩 (原: /coursePayLog/list)")
def stub_get_coursePayLog_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/coursePayLog/list."""
    return _ok(_stub_response("GET /api/v1/edu/coursePayLog/list"))

@router.get("/coursePayLog/export", summary="P1/P2 桩 (原: /coursePayLog/export)")
def stub_get_coursePayLog_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/coursePayLog/export."""
    return _ok(_stub_response("GET /api/v1/edu/coursePayLog/export"))

@router.get("/coursePayLog/{item_id}", summary="P1/P2 桩 (原: /coursePayLog/{item_id})")
def stub_get_coursePayLog_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/coursePayLog/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/coursePayLog/{item_id}"))

@router.post("/coursePayLog", summary="P1/P2 桩 (原: /coursePayLog)")
def stub_post_coursePayLog(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/coursePayLog."""
    return _ok(_stub_response("POST /api/v1/edu/coursePayLog"))

@router.put("/coursePayLog", summary="P1/P2 桩 (原: /coursePayLog)")
def stub_put_coursePayLog(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/coursePayLog."""
    return _ok(_stub_response("PUT /api/v1/edu/coursePayLog"))

@router.delete("/coursePayLog/{ids}", summary="P1/P2 桩 (原: /coursePayLog/{ids})")
def stub_delete_coursePayLog_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/coursePayLog/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/coursePayLog/{ids}"))


# ======================================================================
# courseTemp (6 端点)
# ======================================================================

@router.get("/courseTemp/list", summary="P1/P2 桩 (原: /courseTemp/list)")
def stub_get_courseTemp_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/courseTemp/list."""
    return _ok(_stub_response("GET /api/v1/edu/courseTemp/list"))

@router.get("/courseTemp/export", summary="P1/P2 桩 (原: /courseTemp/export)")
def stub_get_courseTemp_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/courseTemp/export."""
    return _ok(_stub_response("GET /api/v1/edu/courseTemp/export"))

@router.get("/courseTemp/{item_id}", summary="P1/P2 桩 (原: /courseTemp/{item_id})")
def stub_get_courseTemp_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/courseTemp/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/courseTemp/{item_id}"))

@router.post("/courseTemp", summary="P1/P2 桩 (原: /courseTemp)")
def stub_post_courseTemp(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/courseTemp."""
    return _ok(_stub_response("POST /api/v1/edu/courseTemp"))

@router.put("/courseTemp", summary="P1/P2 桩 (原: /courseTemp)")
def stub_put_courseTemp(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/courseTemp."""
    return _ok(_stub_response("PUT /api/v1/edu/courseTemp"))

@router.delete("/courseTemp/{ids}", summary="P1/P2 桩 (原: /courseTemp/{ids})")
def stub_delete_courseTemp_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/courseTemp/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/courseTemp/{ids}"))


# ======================================================================
# courseVideoTemp (6 端点)
# ======================================================================

@router.get("/courseVideoTemp/list", summary="P1/P2 桩 (原: /courseVideoTemp/list)")
def stub_get_courseVideoTemp_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/courseVideoTemp/list."""
    return _ok(_stub_response("GET /api/v1/edu/courseVideoTemp/list"))

@router.get("/courseVideoTemp/export", summary="P1/P2 桩 (原: /courseVideoTemp/export)")
def stub_get_courseVideoTemp_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/courseVideoTemp/export."""
    return _ok(_stub_response("GET /api/v1/edu/courseVideoTemp/export"))

@router.get("/courseVideoTemp/{item_id}", summary="P1/P2 桩 (原: /courseVideoTemp/{item_id})")
def stub_get_courseVideoTemp_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/courseVideoTemp/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/courseVideoTemp/{item_id}"))

@router.post("/courseVideoTemp", summary="P1/P2 桩 (原: /courseVideoTemp)")
def stub_post_courseVideoTemp(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/courseVideoTemp."""
    return _ok(_stub_response("POST /api/v1/edu/courseVideoTemp"))

@router.put("/courseVideoTemp", summary="P1/P2 桩 (原: /courseVideoTemp)")
def stub_put_courseVideoTemp(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/courseVideoTemp."""
    return _ok(_stub_response("PUT /api/v1/edu/courseVideoTemp"))

@router.delete("/courseVideoTemp/{ids}", summary="P1/P2 桩 (原: /courseVideoTemp/{ids})")
def stub_delete_courseVideoTemp_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/courseVideoTemp/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/courseVideoTemp/{ids}"))


# ======================================================================
# courses (6 端点)
# ======================================================================

@router.get("/courses/list", summary="P1/P2 桩 (原: /courses/list)")
def stub_get_courses_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/courses/list."""
    return _ok(_stub_response("GET /api/v1/edu/courses/list"))

@router.get("/courses/export", summary="P1/P2 桩 (原: /courses/export)")
def stub_get_courses_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/courses/export."""
    return _ok(_stub_response("GET /api/v1/edu/courses/export"))

@router.get("/courses/{item_id}", summary="P1/P2 桩 (原: /courses/{item_id})")
def stub_get_courses_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/courses/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/courses/{item_id}"))

@router.post("/courses", summary="P1/P2 桩 (原: /courses)")
def stub_post_courses(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/courses."""
    return _ok(_stub_response("POST /api/v1/edu/courses"))

@router.put("/courses", summary="P1/P2 桩 (原: /courses)")
def stub_put_courses(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/courses."""
    return _ok(_stub_response("PUT /api/v1/edu/courses"))

@router.delete("/courses/{ids}", summary="P1/P2 桩 (原: /courses/{ids})")
def stub_delete_courses_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/courses/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/courses/{ids}"))


# ======================================================================
# coze (4 端点)
# ======================================================================

@router.get("/coze/chat/list", summary="P1/P2 桩 (原: /coze/chat/list)")
def stub_get_coze_chat_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/coze/chat/list."""
    return _ok(_stub_response("GET /api/v1/edu/coze/chat/list"))

@router.get("/coze/chat/export", summary="P1/P2 桩 (原: /coze/chat/export)")
def stub_get_coze_chat_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/coze/chat/export."""
    return _ok(_stub_response("GET /api/v1/edu/coze/chat/export"))

@router.get("/coze/bot/list", summary="P1/P2 桩 (原: /coze/bot/list)")
def stub_get_coze_bot_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/coze/bot/list."""
    return _ok(_stub_response("GET /api/v1/edu/coze/bot/list"))

@router.get("/coze/bot/export", summary="P1/P2 桩 (原: /coze/bot/export)")
def stub_get_coze_bot_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/coze/bot/export."""
    return _ok(_stub_response("GET /api/v1/edu/coze/bot/export"))


# ======================================================================
# developer (2 端点)
# ======================================================================

@router.get("/developer/list", summary="P1/P2 桩 (原: /developer/list)")
def stub_get_developer_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/developer/list."""
    return _ok(_stub_response("GET /api/v1/edu/developer/list"))

@router.get("/developer/export", summary="P1/P2 桩 (原: /developer/export)")
def stub_get_developer_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/developer/export."""
    return _ok(_stub_response("GET /api/v1/edu/developer/export"))


# ======================================================================
# developerFundLogs (6 端点)
# ======================================================================

@router.get("/developerFundLogs/list", summary="P1/P2 桩 (原: /developerFundLogs/list)")
def stub_get_developerFundLogs_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/developerFundLogs/list."""
    return _ok(_stub_response("GET /api/v1/edu/developerFundLogs/list"))

@router.get("/developerFundLogs/export", summary="P1/P2 桩 (原: /developerFundLogs/export)")
def stub_get_developerFundLogs_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/developerFundLogs/export."""
    return _ok(_stub_response("GET /api/v1/edu/developerFundLogs/export"))

@router.get("/developerFundLogs/{item_id}", summary="P1/P2 桩 (原: /developerFundLogs/{item_id})")
def stub_get_developerFundLogs_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/developerFundLogs/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/developerFundLogs/{item_id}"))

@router.post("/developerFundLogs", summary="P1/P2 桩 (原: /developerFundLogs)")
def stub_post_developerFundLogs(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/developerFundLogs."""
    return _ok(_stub_response("POST /api/v1/edu/developerFundLogs"))

@router.put("/developerFundLogs", summary="P1/P2 桩 (原: /developerFundLogs)")
def stub_put_developerFundLogs(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/developerFundLogs."""
    return _ok(_stub_response("PUT /api/v1/edu/developerFundLogs"))

@router.delete("/developerFundLogs/{ids}", summary="P1/P2 桩 (原: /developerFundLogs/{ids})")
def stub_delete_developerFundLogs_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/developerFundLogs/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/developerFundLogs/{ids}"))


# ======================================================================
# developerLink (2 端点)
# ======================================================================

@router.get("/developerLink/list", summary="P1/P2 桩 (原: /developerLink/list)")
def stub_get_developerLink_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/developerLink/list."""
    return _ok(_stub_response("GET /api/v1/edu/developerLink/list"))

@router.get("/developerLink/export", summary="P1/P2 桩 (原: /developerLink/export)")
def stub_get_developerLink_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/developerLink/export."""
    return _ok(_stub_response("GET /api/v1/edu/developerLink/export"))


# ======================================================================
# dictionary (6 端点)
# ======================================================================

@router.get("/dictionary/list", summary="P1/P2 桩 (原: /dictionary/list)")
def stub_get_dictionary_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/dictionary/list."""
    return _ok(_stub_response("GET /api/v1/edu/dictionary/list"))

@router.get("/dictionary/export", summary="P1/P2 桩 (原: /dictionary/export)")
def stub_get_dictionary_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/dictionary/export."""
    return _ok(_stub_response("GET /api/v1/edu/dictionary/export"))

@router.get("/dictionary/{item_id}", summary="P1/P2 桩 (原: /dictionary/{item_id})")
def stub_get_dictionary_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/dictionary/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/dictionary/{item_id}"))

@router.post("/dictionary", summary="P1/P2 桩 (原: /dictionary)")
def stub_post_dictionary(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/dictionary."""
    return _ok(_stub_response("POST /api/v1/edu/dictionary"))

@router.put("/dictionary", summary="P1/P2 桩 (原: /dictionary)")
def stub_put_dictionary(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/dictionary."""
    return _ok(_stub_response("PUT /api/v1/edu/dictionary"))

@router.delete("/dictionary/{ids}", summary="P1/P2 桩 (原: /dictionary/{ids})")
def stub_delete_dictionary_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/dictionary/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/dictionary/{ids}"))


# ======================================================================
# educationPlatform (5 端点)
# ======================================================================

@router.get("/educationPlatform/list", summary="P1/P2 桩 (原: /educationPlatform/list)")
def stub_get_educationPlatform_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/educationPlatform/list."""
    return _ok(_stub_response("GET /api/v1/edu/educationPlatform/list"))

@router.get("/educationPlatform/{sort}", summary="P1/P2 桩 (原: /educationPlatform/{sort})")
def stub_get_educationPlatform_sort(sort: str = ""):
    """P1/P2 桩端点 GET /api/v1/edu/educationPlatform/{sort}."""
    return _ok(_stub_response("GET /api/v1/edu/educationPlatform/{sort}"))

@router.post("/educationPlatform", summary="P1/P2 桩 (原: /educationPlatform)")
def stub_post_educationPlatform(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/educationPlatform."""
    return _ok(_stub_response("POST /api/v1/edu/educationPlatform"))

@router.put("/educationPlatform", summary="P1/P2 桩 (原: /educationPlatform)")
def stub_put_educationPlatform(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/educationPlatform."""
    return _ok(_stub_response("PUT /api/v1/edu/educationPlatform"))

@router.delete("/educationPlatform/{sorts}", summary="P1/P2 桩 (原: /educationPlatform/{sorts})")
def stub_delete_educationPlatform_sorts(sorts: str = ""):
    """P1/P2 桩端点 DELETE /api/v1/edu/educationPlatform/{sorts}."""
    return _ok(_stub_response("DELETE /api/v1/edu/educationPlatform/{sorts}"))


# ======================================================================
# examine (2 端点)
# ======================================================================

@router.put("/examine/pass", summary="P1/P2 桩 (原: /examine/pass)")
def stub_put_examine_pass(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/examine/pass."""
    return _ok(_stub_response("PUT /api/v1/edu/examine/pass"))

@router.put("/examine/reject", summary="P1/P2 桩 (原: /examine/reject)")
def stub_put_examine_reject(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/examine/reject."""
    return _ok(_stub_response("PUT /api/v1/edu/examine/reject"))


# ======================================================================
# flow (3 端点)
# ======================================================================

@router.get("/flow/getStatistics", summary="P1/P2 桩 (原: /flow/getStatistics)")
def stub_get_flow_getStatistics():
    """P1/P2 桩端点 GET /api/v1/edu/flow/getStatistics."""
    return _ok(_stub_response("GET /api/v1/edu/flow/getStatistics"))

@router.get("/flow/getTraderTeam", summary="P1/P2 桩 (原: /flow/getTraderTeam)")
def stub_get_flow_getTraderTeam():
    """P1/P2 桩端点 GET /api/v1/edu/flow/getTraderTeam."""
    return _ok(_stub_response("GET /api/v1/edu/flow/getTraderTeam"))

@router.get("/flow/getTraderTeamByCenter", summary="P1/P2 桩 (原: /flow/getTraderTeamByCenter)")
def stub_get_flow_getTraderTeamByCenter():
    """P1/P2 桩端点 GET /api/v1/edu/flow/getTraderTeamByCenter."""
    return _ok(_stub_response("GET /api/v1/edu/flow/getTraderTeamByCenter"))


# ======================================================================
# fund (8 端点)
# ======================================================================

@router.get("/fund/ali/pay/list", summary="P1/P2 桩 (原: /fund/ali/pay/list)")
def stub_get_fund_ali_pay_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/fund/ali/pay/list."""
    return _ok(_stub_response("GET /api/v1/edu/fund/ali/pay/list"))

@router.get("/fund/ali/pay/export", summary="P1/P2 桩 (原: /fund/ali/pay/export)")
def stub_get_fund_ali_pay_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/fund/ali/pay/export."""
    return _ok(_stub_response("GET /api/v1/edu/fund/ali/pay/export"))

@router.get("/fund/ali/pay/{item_id}", summary="P1/P2 桩 (原: /fund/ali/pay/{item_id})")
def stub_get_fund_ali_pay_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/fund/ali/pay/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/fund/ali/pay/{item_id}"))

@router.post("/fund/ali/pay", summary="P1/P2 桩 (原: /fund/ali/pay)")
def stub_post_fund_ali_pay(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/fund/ali/pay."""
    return _ok(_stub_response("POST /api/v1/edu/fund/ali/pay"))

@router.put("/fund/ali/pay", summary="P1/P2 桩 (原: /fund/ali/pay)")
def stub_put_fund_ali_pay(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/fund/ali/pay."""
    return _ok(_stub_response("PUT /api/v1/edu/fund/ali/pay"))

@router.delete("/fund/ali/pay/{ids}", summary="P1/P2 桩 (原: /fund/ali/pay/{ids})")
def stub_delete_fund_ali_pay_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/fund/ali/pay/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/fund/ali/pay/{ids}"))

@router.get("/fund/list", summary="P1/P2 桩 (原: /fund/list)")
def stub_get_fund_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/fund/list."""
    return _ok(_stub_response("GET /api/v1/edu/fund/list"))

@router.get("/fund/export", summary="P1/P2 桩 (原: /fund/export)")
def stub_get_fund_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/fund/export."""
    return _ok(_stub_response("GET /api/v1/edu/fund/export"))


# ======================================================================
# gemini (1 端点)
# ======================================================================

@router.post("/gemini/3/generate", summary="P1/P2 桩 (原: /gemini/3/generate)")
def stub_post_gemini_3_generate(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/gemini/3/generate."""
    return _ok(_stub_response("POST /api/v1/edu/gemini/3/generate"))


# ======================================================================
# google (2 端点)
# ======================================================================

@router.get("/google/list", summary="P1/P2 桩 (原: /google/list)")
def stub_get_google_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/google/list."""
    return _ok(_stub_response("GET /api/v1/edu/google/list"))

@router.get("/google/export", summary="P1/P2 桩 (原: /google/export)")
def stub_get_google_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/google/export."""
    return _ok(_stub_response("GET /api/v1/edu/google/export"))


# ======================================================================
# identity_proportion (1 端点)
# ======================================================================

@router.get("/identity_proportion/list", summary="P1/P2 桩 (原: /identity_proportion/list)")
def stub_get_identity_proportion_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/identity_proportion/list."""
    return _ok(_stub_response("GET /api/v1/edu/identity_proportion/list"))


# ======================================================================
# information (3 端点)
# ======================================================================

@router.get("/information/dictionary", summary="P1/P2 桩 (原: /information/dictionary)")
def stub_get_information_dictionary(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/information/dictionary."""
    return _ok(_stub_response("GET /api/v1/edu/information/dictionary"))

@router.get("/information/list", summary="P1/P2 桩 (原: /information/list)")
def stub_get_information_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/information/list."""
    return _ok(_stub_response("GET /api/v1/edu/information/list"))

@router.post("/information", summary="P1/P2 桩 (原: /information)")
def stub_post_information(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/information."""
    return _ok(_stub_response("POST /api/v1/edu/information"))


# ======================================================================
# jianyi (2 端点)
# ======================================================================

@router.post("/jianyi/sora2/generate/video", summary="P1/P2 桩 (原: /jianyi/sora2/generate/video)")
def stub_post_jianyi_sora2_generate_video(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/jianyi/sora2/generate/video."""
    return _ok(_stub_response("POST /api/v1/edu/jianyi/sora2/generate/video"))

@router.post("/jianyi/sora2/video/info", summary="P1/P2 桩 (原: /jianyi/sora2/video/info)")
def stub_post_jianyi_sora2_video_info(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/jianyi/sora2/video/info."""
    return _ok(_stub_response("POST /api/v1/edu/jianyi/sora2/video/info"))


# ======================================================================
# job (8 端点)
# ======================================================================

@router.get("/job/log/list", summary="P1/P2 桩 (原: /job/log/list)")
def stub_get_job_log_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/job/log/list."""
    return _ok(_stub_response("GET /api/v1/edu/job/log/list"))

@router.get("/job/log/export", summary="P1/P2 桩 (原: /job/log/export)")
def stub_get_job_log_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/job/log/export."""
    return _ok(_stub_response("GET /api/v1/edu/job/log/export"))

@router.get("/job/log/{item_id}", summary="P1/P2 桩 (原: /job/log/{item_id})")
def stub_get_job_log_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/job/log/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/job/log/{item_id}"))

@router.post("/job/log", summary="P1/P2 桩 (原: /job/log)")
def stub_post_job_log(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/job/log."""
    return _ok(_stub_response("POST /api/v1/edu/job/log"))

@router.put("/job/log", summary="P1/P2 桩 (原: /job/log)")
def stub_put_job_log(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/job/log."""
    return _ok(_stub_response("PUT /api/v1/edu/job/log"))

@router.delete("/job/log/{ids}", summary="P1/P2 桩 (原: /job/log/{ids})")
def stub_delete_job_log_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/job/log/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/job/log/{ids}"))

@router.get("/job/list", summary="P1/P2 桩 (原: /job/list)")
def stub_get_job_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/job/list."""
    return _ok(_stub_response("GET /api/v1/edu/job/list"))

@router.get("/job/export", summary="P1/P2 桩 (原: /job/export)")
def stub_get_job_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/job/export."""
    return _ok(_stub_response("GET /api/v1/edu/job/export"))


# ======================================================================
# kling (2 端点)
# ======================================================================

@router.post("/kling/generate/video", summary="P1/P2 桩 (原: /kling/generate/video)")
def stub_post_kling_generate_video(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/kling/generate/video."""
    return _ok(_stub_response("POST /api/v1/edu/kling/generate/video"))

@router.get("/kling/video/info/{task_id}", summary="P1/P2 桩 (原: /kling/video/info/{task_id})")
def stub_get_kling_video_info_task_id(task_id: int = 0, page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/kling/video/info/{task_id}."""
    return _ok(_stub_response("GET /api/v1/edu/kling/video/info/{task_id}"))


# ======================================================================
# login (36 端点)
# ======================================================================

@router.get("/login/ali/list", summary="P1/P2 桩 (原: /login/ali/list)")
def stub_get_login_ali_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/login/ali/list."""
    return _ok(_stub_response("GET /api/v1/edu/login/ali/list"))

@router.get("/login/ali/export", summary="P1/P2 桩 (原: /login/ali/export)")
def stub_get_login_ali_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/login/ali/export."""
    return _ok(_stub_response("GET /api/v1/edu/login/ali/export"))

@router.get("/login/ali/{item_id}", summary="P1/P2 桩 (原: /login/ali/{item_id})")
def stub_get_login_ali_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/login/ali/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/login/ali/{item_id}"))

@router.post("/login/ali", summary="P1/P2 桩 (原: /login/ali)")
def stub_post_login_ali(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/login/ali."""
    return _ok(_stub_response("POST /api/v1/edu/login/ali"))

@router.put("/login/ali", summary="P1/P2 桩 (原: /login/ali)")
def stub_put_login_ali(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/login/ali."""
    return _ok(_stub_response("PUT /api/v1/edu/login/ali"))

@router.delete("/login/ali/{ids}", summary="P1/P2 桩 (原: /login/ali/{ids})")
def stub_delete_login_ali_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/login/ali/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/login/ali/{ids}"))

@router.get("/login/feishu/list", summary="P1/P2 桩 (原: /login/feishu/list)")
def stub_get_login_feishu_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/login/feishu/list."""
    return _ok(_stub_response("GET /api/v1/edu/login/feishu/list"))

@router.get("/login/feishu/export", summary="P1/P2 桩 (原: /login/feishu/export)")
def stub_get_login_feishu_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/login/feishu/export."""
    return _ok(_stub_response("GET /api/v1/edu/login/feishu/export"))

@router.get("/login/feishu/{item_id}", summary="P1/P2 桩 (原: /login/feishu/{item_id})")
def stub_get_login_feishu_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/login/feishu/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/login/feishu/{item_id}"))

@router.post("/login/feishu", summary="P1/P2 桩 (原: /login/feishu)")
def stub_post_login_feishu(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/login/feishu."""
    return _ok(_stub_response("POST /api/v1/edu/login/feishu"))

@router.put("/login/feishu", summary="P1/P2 桩 (原: /login/feishu)")
def stub_put_login_feishu(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/login/feishu."""
    return _ok(_stub_response("PUT /api/v1/edu/login/feishu"))

@router.delete("/login/feishu/{ids}", summary="P1/P2 桩 (原: /login/feishu/{ids})")
def stub_delete_login_feishu_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/login/feishu/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/login/feishu/{ids}"))

@router.get("/login/pwd/list", summary="P1/P2 桩 (原: /login/pwd/list)")
def stub_get_login_pwd_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/login/pwd/list."""
    return _ok(_stub_response("GET /api/v1/edu/login/pwd/list"))

@router.get("/login/pwd/export", summary="P1/P2 桩 (原: /login/pwd/export)")
def stub_get_login_pwd_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/login/pwd/export."""
    return _ok(_stub_response("GET /api/v1/edu/login/pwd/export"))

@router.get("/login/pwd/{item_id}", summary="P1/P2 桩 (原: /login/pwd/{item_id})")
def stub_get_login_pwd_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/login/pwd/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/login/pwd/{item_id}"))

@router.post("/login/pwd", summary="P1/P2 桩 (原: /login/pwd)")
def stub_post_login_pwd(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/login/pwd."""
    return _ok(_stub_response("POST /api/v1/edu/login/pwd"))

@router.put("/login/pwd", summary="P1/P2 桩 (原: /login/pwd)")
def stub_put_login_pwd(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/login/pwd."""
    return _ok(_stub_response("PUT /api/v1/edu/login/pwd"))

@router.delete("/login/pwd/{ids}", summary="P1/P2 桩 (原: /login/pwd/{ids})")
def stub_delete_login_pwd_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/login/pwd/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/login/pwd/{ids}"))

@router.get("/login/wechat/list", summary="P1/P2 桩 (原: /login/wechat/list)")
def stub_get_login_wechat_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/login/wechat/list."""
    return _ok(_stub_response("GET /api/v1/edu/login/wechat/list"))

@router.get("/login/wechat/export", summary="P1/P2 桩 (原: /login/wechat/export)")
def stub_get_login_wechat_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/login/wechat/export."""
    return _ok(_stub_response("GET /api/v1/edu/login/wechat/export"))

@router.get("/login/wechat/{item_id}", summary="P1/P2 桩 (原: /login/wechat/{item_id})")
def stub_get_login_wechat_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/login/wechat/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/login/wechat/{item_id}"))

@router.post("/login/wechat", summary="P1/P2 桩 (原: /login/wechat)")
def stub_post_login_wechat(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/login/wechat."""
    return _ok(_stub_response("POST /api/v1/edu/login/wechat"))

@router.put("/login/wechat", summary="P1/P2 桩 (原: /login/wechat)")
def stub_put_login_wechat(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/login/wechat."""
    return _ok(_stub_response("PUT /api/v1/edu/login/wechat"))

@router.delete("/login/wechat/{ids}", summary="P1/P2 桩 (原: /login/wechat/{ids})")
def stub_delete_login_wechat_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/login/wechat/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/login/wechat/{ids}"))

@router.get("/login/google/list", summary="P1/P2 桩 (原: /login/google/list)")
def stub_get_login_google_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/login/google/list."""
    return _ok(_stub_response("GET /api/v1/edu/login/google/list"))

@router.get("/login/google/export", summary="P1/P2 桩 (原: /login/google/export)")
def stub_get_login_google_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/login/google/export."""
    return _ok(_stub_response("GET /api/v1/edu/login/google/export"))

@router.get("/login/google/{item_id}", summary="P1/P2 桩 (原: /login/google/{item_id})")
def stub_get_login_google_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/login/google/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/login/google/{item_id}"))

@router.post("/login/google", summary="P1/P2 桩 (原: /login/google)")
def stub_post_login_google(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/login/google."""
    return _ok(_stub_response("POST /api/v1/edu/login/google"))

@router.put("/login/google", summary="P1/P2 桩 (原: /login/google)")
def stub_put_login_google(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/login/google."""
    return _ok(_stub_response("PUT /api/v1/edu/login/google"))

@router.delete("/login/google/{ids}", summary="P1/P2 桩 (原: /login/google/{ids})")
def stub_delete_login_google_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/login/google/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/login/google/{ids}"))

@router.get("/login/enterprise/list", summary="P1/P2 桩 (原: /login/enterprise/list)")
def stub_get_login_enterprise_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/login/enterprise/list."""
    return _ok(_stub_response("GET /api/v1/edu/login/enterprise/list"))

@router.get("/login/enterprise/export", summary="P1/P2 桩 (原: /login/enterprise/export)")
def stub_get_login_enterprise_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/login/enterprise/export."""
    return _ok(_stub_response("GET /api/v1/edu/login/enterprise/export"))

@router.get("/login/enterprise/{item_id}", summary="P1/P2 桩 (原: /login/enterprise/{item_id})")
def stub_get_login_enterprise_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/login/enterprise/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/login/enterprise/{item_id}"))

@router.post("/login/enterprise", summary="P1/P2 桩 (原: /login/enterprise)")
def stub_post_login_enterprise(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/login/enterprise."""
    return _ok(_stub_response("POST /api/v1/edu/login/enterprise"))

@router.put("/login/enterprise", summary="P1/P2 桩 (原: /login/enterprise)")
def stub_put_login_enterprise(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/login/enterprise."""
    return _ok(_stub_response("PUT /api/v1/edu/login/enterprise"))

@router.delete("/login/enterprise/{ids}", summary="P1/P2 桩 (原: /login/enterprise/{ids})")
def stub_delete_login_enterprise_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/login/enterprise/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/login/enterprise/{ids}"))


# ======================================================================
# login_logs (6 端点)
# ======================================================================

@router.get("/login_logs/list", summary="P1/P2 桩 (原: /login_logs/list)")
def stub_get_login_logs_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/login_logs/list."""
    return _ok(_stub_response("GET /api/v1/edu/login_logs/list"))

@router.get("/login_logs/export", summary="P1/P2 桩 (原: /login_logs/export)")
def stub_get_login_logs_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/login_logs/export."""
    return _ok(_stub_response("GET /api/v1/edu/login_logs/export"))

@router.get("/login_logs/{item_id}", summary="P1/P2 桩 (原: /login_logs/{item_id})")
def stub_get_login_logs_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/login_logs/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/login_logs/{item_id}"))

@router.post("/login_logs", summary="P1/P2 桩 (原: /login_logs)")
def stub_post_login_logs(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/login_logs."""
    return _ok(_stub_response("POST /api/v1/edu/login_logs"))

@router.put("/login_logs", summary="P1/P2 桩 (原: /login_logs)")
def stub_put_login_logs(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/login_logs."""
    return _ok(_stub_response("PUT /api/v1/edu/login_logs"))

@router.delete("/login_logs/{ids}", summary="P1/P2 桩 (原: /login_logs/{ids})")
def stub_delete_login_logs_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/login_logs/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/login_logs/{ids}"))


# ======================================================================
# mcp (1 端点)
# ======================================================================

@router.get("/mcp/resource/video/to/audio", summary="P1/P2 桩 (原: /mcp/resource/video/to/audio)")
def stub_get_mcp_resource_video_to_audio():
    """P1/P2 桩端点 GET /api/v1/edu/mcp/resource/video/to/audio."""
    return _ok(_stub_response("GET /api/v1/edu/mcp/resource/video/to/audio"))


# ======================================================================
# news (2 端点)
# ======================================================================

@router.get("/news/list", summary="P1/P2 桩 (原: /news/list)")
def stub_get_news_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/news/list."""
    return _ok(_stub_response("GET /api/v1/edu/news/list"))

@router.get("/news/export", summary="P1/P2 桩 (原: /news/export)")
def stub_get_news_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/news/export."""
    return _ok(_stub_response("GET /api/v1/edu/news/export"))


# ======================================================================
# official (2 端点)
# ======================================================================

@router.get("/official/storage/list", summary="P1/P2 桩 (原: /official/storage/list)")
def stub_get_official_storage_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/official/storage/list."""
    return _ok(_stub_response("GET /api/v1/edu/official/storage/list"))

@router.get("/official/storage/export", summary="P1/P2 桩 (原: /official/storage/export)")
def stub_get_official_storage_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/official/storage/export."""
    return _ok(_stub_response("GET /api/v1/edu/official/storage/export"))


# ======================================================================
# order (6 端点)
# ======================================================================

@router.get("/order/list", summary="P1/P2 桩 (原: /order/list)")
def stub_get_order_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/order/list."""
    return _ok(_stub_response("GET /api/v1/edu/order/list"))

@router.get("/order/export", summary="P1/P2 桩 (原: /order/export)")
def stub_get_order_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/order/export."""
    return _ok(_stub_response("GET /api/v1/edu/order/export"))

@router.get("/order/{item_id}", summary="P1/P2 桩 (原: /order/{item_id})")
def stub_get_order_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/order/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/order/{item_id}"))

@router.post("/order", summary="P1/P2 桩 (原: /order)")
def stub_post_order(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/order."""
    return _ok(_stub_response("POST /api/v1/edu/order"))

@router.put("/order", summary="P1/P2 桩 (原: /order)")
def stub_put_order(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/order."""
    return _ok(_stub_response("PUT /api/v1/edu/order"))

@router.delete("/order/{ids}", summary="P1/P2 桩 (原: /order/{ids})")
def stub_delete_order_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/order/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/order/{ids}"))


# ======================================================================
# organization (2 端点)
# ======================================================================

@router.get("/organization/list", summary="P1/P2 桩 (原: /organization/list)")
def stub_get_organization_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/organization/list."""
    return _ok(_stub_response("GET /api/v1/edu/organization/list"))

@router.get("/organization/export", summary="P1/P2 桩 (原: /organization/export)")
def stub_get_organization_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/organization/export."""
    return _ok(_stub_response("GET /api/v1/edu/organization/export"))


# ======================================================================
# powerPurchaseRule (2 端点)
# ======================================================================

@router.get("/powerPurchaseRule/list", summary="P1/P2 桩 (原: /powerPurchaseRule/list)")
def stub_get_powerPurchaseRule_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/powerPurchaseRule/list."""
    return _ok(_stub_response("GET /api/v1/edu/powerPurchaseRule/list"))

@router.get("/powerPurchaseRule/export", summary="P1/P2 桩 (原: /powerPurchaseRule/export)")
def stub_get_powerPurchaseRule_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/powerPurchaseRule/export."""
    return _ok(_stub_response("GET /api/v1/edu/powerPurchaseRule/export"))


# ======================================================================
# product_identity (2 端点)
# ======================================================================

@router.get("/product_identity/list", summary="P1/P2 桩 (原: /product_identity/list)")
def stub_get_product_identity_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/product_identity/list."""
    return _ok(_stub_response("GET /api/v1/edu/product_identity/list"))

@router.get("/product_identity/getInfo", summary="P1/P2 桩 (原: /product_identity/getInfo)")
def stub_get_product_identity_getInfo(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/product_identity/getInfo."""
    return _ok(_stub_response("GET /api/v1/edu/product_identity/getInfo"))


# ======================================================================
# ranking (2 端点)
# ======================================================================

@router.get("/ranking/list", summary="P1/P2 桩 (原: /ranking/list)")
def stub_get_ranking_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/ranking/list."""
    return _ok(_stub_response("GET /api/v1/edu/ranking/list"))

@router.get("/ranking/export", summary="P1/P2 桩 (原: /ranking/export)")
def stub_get_ranking_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/ranking/export."""
    return _ok(_stub_response("GET /api/v1/edu/ranking/export"))


# ======================================================================
# record (1 端点)
# ======================================================================

@router.get("/record/list", summary="P1/P2 桩 (原: /login/pwd)")
def stub_get_record_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/record/list."""
    return _ok(_stub_response("GET /api/v1/edu/record/list"))


# ======================================================================
# remote (5 端点)
# ======================================================================

@router.post("/remote/agent/task/need/task/add", summary="P1/P2 桩 (原: /remote/agent/task/need/task/add)")
def stub_post_remote_agent_task_need_task_add(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/remote/agent/task/need/task/add."""
    return _ok(_stub_response("POST /api/v1/edu/remote/agent/task/need/task/add"))

@router.post("/remote/agent/task/need/task", summary="P1/P2 桩 (原: /remote/agent/task/need/task)")
def stub_post_remote_agent_task_need_task(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/remote/agent/task/need/task."""
    return _ok(_stub_response("POST /api/v1/edu/remote/agent/task/need/task"))

@router.get("/remote/agent/task/need/task/{task_id}", summary="P1/P2 桩 (原: /remote/agent/task/need/task/{task_id})")
def stub_get_remote_agent_task_need_task_task_id(task_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/remote/agent/task/need/task/{task_id}."""
    return _ok(_stub_response("GET /api/v1/edu/remote/agent/task/need/task/{task_id}"))

@router.get("/remote/third/list", summary="P1/P2 桩 (原: /remote/third/list)")
def stub_get_remote_third_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/remote/third/list."""
    return _ok(_stub_response("GET /api/v1/edu/remote/third/list"))

@router.get("/remote/third/export", summary="P1/P2 桩 (原: /remote/third/export)")
def stub_get_remote_third_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/remote/third/export."""
    return _ok(_stub_response("GET /api/v1/edu/remote/third/export"))


# ======================================================================
# resource (17 端点)
# ======================================================================

@router.get("/resource/homeResource", summary="P1/P2 桩 (原: /resource/homeResource)")
def stub_get_resource_homeResource():
    """P1/P2 桩端点 GET /api/v1/edu/resource/homeResource."""
    return _ok(_stub_response("GET /api/v1/edu/resource/homeResource"))

@router.get("/resource/plantInformation", summary="P1/P2 桩 (原: /resource/plantInformation)")
def stub_get_resource_plantInformation(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/resource/plantInformation."""
    return _ok(_stub_response("GET /api/v1/edu/resource/plantInformation"))

@router.get("/resource/selectsGoods", summary="P1/P2 桩 (原: /resource/selectsGoods)")
def stub_get_resource_selectsGoods():
    """P1/P2 桩端点 GET /api/v1/edu/resource/selectsGoods."""
    return _ok(_stub_response("GET /api/v1/edu/resource/selectsGoods"))

@router.get("/resource/getKnowledgePlanet", summary="P1/P2 桩 (原: /resource/getKnowledgePlanet)")
def stub_get_resource_getKnowledgePlanet():
    """P1/P2 桩端点 GET /api/v1/edu/resource/getKnowledgePlanet."""
    return _ok(_stub_response("GET /api/v1/edu/resource/getKnowledgePlanet"))

@router.get("/resource/getHomePageResources", summary="P1/P2 桩 (原: /resource/getHomePageResources)")
def stub_get_resource_getHomePageResources(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/resource/getHomePageResources."""
    return _ok(_stub_response("GET /api/v1/edu/resource/getHomePageResources"))

@router.post("/resource/addSharePlanetPublic", summary="P1/P2 桩 (原: /resource/addSharePlanetPublic)")
def stub_post_resource_addSharePlanetPublic(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/resource/addSharePlanetPublic."""
    return _ok(_stub_response("POST /api/v1/edu/resource/addSharePlanetPublic"))

@router.post("/resource/postHomeInformation", summary="P1/P2 桩 (原: /resource/postHomeInformation)")
def stub_post_resource_postHomeInformation(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/resource/postHomeInformation."""
    return _ok(_stub_response("POST /api/v1/edu/resource/postHomeInformation"))

@router.get("/resource/getKnowledgePlanetCategorizedInfo", summary="P1/P2 桩 (原: /resource/getKnowledgePlanetCategorizedInfo)")
def stub_get_resource_getKnowledgePlanetCategorizedInfo(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/resource/getKnowledgePlanetCategorizedInfo."""
    return _ok(_stub_response("GET /api/v1/edu/resource/getKnowledgePlanetCategorizedInfo"))

@router.get("/resource/getAgentList", summary="P1/P2 桩 (原: /resource/getAgentList)")
def stub_get_resource_getAgentList(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/resource/getAgentList."""
    return _ok(_stub_response("GET /api/v1/edu/resource/getAgentList"))

@router.get("/resource/getAgent", summary="P1/P2 桩 (原: /resource/getAgent)")
def stub_get_resource_getAgent():
    """P1/P2 桩端点 GET /api/v1/edu/resource/getAgent."""
    return _ok(_stub_response("GET /api/v1/edu/resource/getAgent"))

@router.get("/resource/getAgent2", summary="P1/P2 桩 (原: /resource/getAgent2)")
def stub_get_resource_getAgent2():
    """P1/P2 桩端点 GET /api/v1/edu/resource/getAgent2."""
    return _ok(_stub_response("GET /api/v1/edu/resource/getAgent2"))

@router.post("/resource/remove/context/field", summary="P1/P2 桩 (原: /resource/remove/context/field)")
def stub_post_resource_remove_context_field(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/resource/remove/context/field."""
    return _ok(_stub_response("POST /api/v1/edu/resource/remove/context/field"))

@router.post("/resource/fileUpload", summary="P1/P2 桩 (原: /resource/fileUpload)")
def stub_post_resource_fileUpload(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/resource/fileUpload."""
    return _ok(_stub_response("POST /api/v1/edu/resource/fileUpload"))

@router.post("/resource/fileUploadNetworkPath", summary="P1/P2 桩 (原: /resource/fileUploadNetworkPath)")
def stub_post_resource_fileUploadNetworkPath(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/resource/fileUploadNetworkPath."""
    return _ok(_stub_response("POST /api/v1/edu/resource/fileUploadNetworkPath"))

@router.get("/resource/first/share", summary="P1/P2 桩 (原: /resource/first/share)")
def stub_get_resource_first_share():
    """P1/P2 桩端点 GET /api/v1/edu/resource/first/share."""
    return _ok(_stub_response("GET /api/v1/edu/resource/first/share"))

@router.get("/resource/first/share/show", summary="P1/P2 桩 (原: /resource/first/share/show)")
def stub_get_resource_first_share_show():
    """P1/P2 桩端点 GET /api/v1/edu/resource/first/share/show."""
    return _ok(_stub_response("GET /api/v1/edu/resource/first/share/show"))

@router.get("/resource/download/watermark", summary="P1/P2 桩 (原: /resource/download/watermark)")
def stub_get_resource_download_watermark():
    """P1/P2 桩端点 GET /api/v1/edu/resource/download/watermark."""
    return _ok(_stub_response("GET /api/v1/edu/resource/download/watermark"))


# ======================================================================
# taskDeveloper (1 端点)
# ======================================================================

@router.get("/taskDeveloper/list", summary="P1/P2 桩 (原: /taskDeveloper/list)")
def stub_get_taskDeveloper_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/taskDeveloper/list."""
    return _ok(_stub_response("GET /api/v1/edu/taskDeveloper/list"))


# ======================================================================
# tbox (1 端点)
# ======================================================================

@router.post("/tbox/agent/channel/deploy", summary="P1/P2 桩 (原: /tbox/agent/channel/deploy)")
def stub_post_tbox_agent_channel_deploy(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/tbox/agent/channel/deploy."""
    return _ok(_stub_response("POST /api/v1/edu/tbox/agent/channel/deploy"))


# ======================================================================
# token_flow (5 端点)
# ======================================================================

@router.get("/token_flow/list", summary="P1/P2 桩 (原: /token_flow/list)")
def stub_get_token_flow_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/token_flow/list."""
    return _ok(_stub_response("GET /api/v1/edu/token_flow/list"))

@router.get("/token_flow/{item_id}", summary="P1/P2 桩 (原: /token_flow/{item_id})")
def stub_get_token_flow_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/token_flow/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/token_flow/{item_id}"))

@router.post("/token_flow", summary="P1/P2 桩 (原: /token_flow)")
def stub_post_token_flow(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/token_flow."""
    return _ok(_stub_response("POST /api/v1/edu/token_flow"))

@router.put("/token_flow", summary="P1/P2 桩 (原: /token_flow)")
def stub_put_token_flow(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/token_flow."""
    return _ok(_stub_response("PUT /api/v1/edu/token_flow"))

@router.delete("/token_flow/{ids}", summary="P1/P2 桩 (原: /token_flow/{ids})")
def stub_delete_token_flow_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/token_flow/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/token_flow/{ids}"))


# ======================================================================
# us (2 端点)
# ======================================================================

@router.get("/us/list", summary="P1/P2 桩 (原: /us/list)")
def stub_get_us_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/us/list."""
    return _ok(_stub_response("GET /api/v1/edu/us/list"))

@router.get("/us/export", summary="P1/P2 桩 (原: /us/export)")
def stub_get_us_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/us/export."""
    return _ok(_stub_response("GET /api/v1/edu/us/export"))


# ======================================================================
# userAgentAudio (5 端点)
# ======================================================================

@router.get("/userAgentAudio/list", summary="P1/P2 桩 (原: /userAgentAudio/list)")
def stub_get_userAgentAudio_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/userAgentAudio/list."""
    return _ok(_stub_response("GET /api/v1/edu/userAgentAudio/list"))

@router.get("/userAgentAudio/{item_id}", summary="P1/P2 桩 (原: /userAgentAudio/{item_id})")
def stub_get_userAgentAudio_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/userAgentAudio/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/userAgentAudio/{item_id}"))

@router.post("/userAgentAudio", summary="P1/P2 桩 (原: /userAgentAudio)")
def stub_post_userAgentAudio(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/userAgentAudio."""
    return _ok(_stub_response("POST /api/v1/edu/userAgentAudio"))

@router.put("/userAgentAudio", summary="P1/P2 桩 (原: /userAgentAudio)")
def stub_put_userAgentAudio(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/userAgentAudio."""
    return _ok(_stub_response("PUT /api/v1/edu/userAgentAudio"))

@router.delete("/userAgentAudio/{ids}", summary="P1/P2 桩 (原: /userAgentAudio/{ids})")
def stub_delete_userAgentAudio_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/userAgentAudio/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/userAgentAudio/{ids}"))


# ======================================================================
# userAgentContext (6 端点)
# ======================================================================

@router.get("/userAgentContext/list", summary="P1/P2 桩 (原: /userAgentContext/list)")
def stub_get_userAgentContext_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/userAgentContext/list."""
    return _ok(_stub_response("GET /api/v1/edu/userAgentContext/list"))

@router.get("/userAgentContext/export", summary="P1/P2 桩 (原: /userAgentContext/export)")
def stub_get_userAgentContext_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/userAgentContext/export."""
    return _ok(_stub_response("GET /api/v1/edu/userAgentContext/export"))

@router.get("/userAgentContext/{item_id}", summary="P1/P2 桩 (原: /userAgentContext/{item_id})")
def stub_get_userAgentContext_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/userAgentContext/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/userAgentContext/{item_id}"))

@router.post("/userAgentContext", summary="P1/P2 桩 (原: /userAgentContext)")
def stub_post_userAgentContext(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/userAgentContext."""
    return _ok(_stub_response("POST /api/v1/edu/userAgentContext"))

@router.put("/userAgentContext", summary="P1/P2 桩 (原: /userAgentContext)")
def stub_put_userAgentContext(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/userAgentContext."""
    return _ok(_stub_response("PUT /api/v1/edu/userAgentContext"))

@router.delete("/userAgentContext/{ids}", summary="P1/P2 桩 (原: /userAgentContext/{ids})")
def stub_delete_userAgentContext_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/userAgentContext/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/userAgentContext/{ids}"))


# ======================================================================
# userAgentImage (6 端点)
# ======================================================================

@router.get("/userAgentImage/list", summary="P1/P2 桩 (原: /userAgentImage/list)")
def stub_get_userAgentImage_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/userAgentImage/list."""
    return _ok(_stub_response("GET /api/v1/edu/userAgentImage/list"))

@router.get("/userAgentImage/export", summary="P1/P2 桩 (原: /userAgentImage/export)")
def stub_get_userAgentImage_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/userAgentImage/export."""
    return _ok(_stub_response("GET /api/v1/edu/userAgentImage/export"))

@router.get("/userAgentImage/{item_id}", summary="P1/P2 桩 (原: /userAgentImage/{item_id})")
def stub_get_userAgentImage_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/userAgentImage/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/userAgentImage/{item_id}"))

@router.post("/userAgentImage", summary="P1/P2 桩 (原: /userAgentImage)")
def stub_post_userAgentImage(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/userAgentImage."""
    return _ok(_stub_response("POST /api/v1/edu/userAgentImage"))

@router.put("/userAgentImage", summary="P1/P2 桩 (原: /userAgentImage)")
def stub_put_userAgentImage(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/userAgentImage."""
    return _ok(_stub_response("PUT /api/v1/edu/userAgentImage"))

@router.delete("/userAgentImage/{ids}", summary="P1/P2 桩 (原: /userAgentImage/{ids})")
def stub_delete_userAgentImage_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/userAgentImage/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/userAgentImage/{ids}"))


# ======================================================================
# userSysLink (6 端点)
# ======================================================================

@router.get("/userSysLink/list", summary="P1/P2 桩 (原: /userSysLink/list)")
def stub_get_userSysLink_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/userSysLink/list."""
    return _ok(_stub_response("GET /api/v1/edu/userSysLink/list"))

@router.get("/userSysLink/export", summary="P1/P2 桩 (原: /userSysLink/export)")
def stub_get_userSysLink_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/userSysLink/export."""
    return _ok(_stub_response("GET /api/v1/edu/userSysLink/export"))

@router.get("/userSysLink/{item_id}", summary="P1/P2 桩 (原: /userSysLink/{item_id})")
def stub_get_userSysLink_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/userSysLink/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/userSysLink/{item_id}"))

@router.post("/userSysLink", summary="P1/P2 桩 (原: /userSysLink)")
def stub_post_userSysLink(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/userSysLink."""
    return _ok(_stub_response("POST /api/v1/edu/userSysLink"))

@router.put("/userSysLink", summary="P1/P2 桩 (原: /userSysLink)")
def stub_put_userSysLink(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/userSysLink."""
    return _ok(_stub_response("PUT /api/v1/edu/userSysLink"))

@router.delete("/userSysLink/{ids}", summary="P1/P2 桩 (原: /userSysLink/{ids})")
def stub_delete_userSysLink_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/userSysLink/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/userSysLink/{ids}"))


# ======================================================================
# user_vip (6 端点)
# ======================================================================

@router.get("/user_vip/list", summary="P1/P2 桩 (原: /user_vip/list)")
def stub_get_user_vip_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/user_vip/list."""
    return _ok(_stub_response("GET /api/v1/edu/user_vip/list"))

@router.get("/user_vip/export", summary="P1/P2 桩 (原: /user_vip/export)")
def stub_get_user_vip_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/user_vip/export."""
    return _ok(_stub_response("GET /api/v1/edu/user_vip/export"))

@router.get("/user_vip/{item_id}", summary="P1/P2 桩 (原: /user_vip/{item_id})")
def stub_get_user_vip_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/user_vip/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/user_vip/{item_id}"))

@router.post("/user_vip", summary="P1/P2 桩 (原: /user_vip)")
def stub_post_user_vip(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/user_vip."""
    return _ok(_stub_response("POST /api/v1/edu/user_vip"))

@router.put("/user_vip", summary="P1/P2 桩 (原: /user_vip)")
def stub_put_user_vip(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/user_vip."""
    return _ok(_stub_response("PUT /api/v1/edu/user_vip"))

@router.delete("/user_vip/{ids}", summary="P1/P2 桩 (原: /user_vip/{ids})")
def stub_delete_user_vip_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/user_vip/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/user_vip/{ids}"))


# ======================================================================
# users (6 端点)
# ======================================================================

@router.get("/users/list", summary="P1/P2 桩 (原: /users/list)")
def stub_get_users_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/users/list."""
    return _ok(_stub_response("GET /api/v1/edu/users/list"))

@router.get("/users/export", summary="P1/P2 桩 (原: /users/export)")
def stub_get_users_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/users/export."""
    return _ok(_stub_response("GET /api/v1/edu/users/export"))

@router.get("/users/{item_id}", summary="P1/P2 桩 (原: /users/{item_id})")
def stub_get_users_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/users/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/users/{item_id}"))

@router.post("/users", summary="P1/P2 桩 (原: /users)")
def stub_post_users(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/users."""
    return _ok(_stub_response("POST /api/v1/edu/users"))

@router.put("/users", summary="P1/P2 桩 (原: /users)")
def stub_put_users(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/users."""
    return _ok(_stub_response("PUT /api/v1/edu/users"))

@router.delete("/users/{ids}", summary="P1/P2 桩 (原: /users/{ids})")
def stub_delete_users_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/users/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/users/{ids}"))


# ======================================================================
# vip_level (2 端点)
# ======================================================================

@router.get("/vip_level/list", summary="P1/P2 桩 (原: /vip_level/list)")
def stub_get_vip_level_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/vip_level/list."""
    return _ok(_stub_response("GET /api/v1/edu/vip_level/list"))

@router.get("/vip_level/export", summary="P1/P2 桩 (原: /vip_level/export)")
def stub_get_vip_level_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/vip_level/export."""
    return _ok(_stub_response("GET /api/v1/edu/vip_level/export"))


# ======================================================================
# watch (1 端点)
# ======================================================================

@router.get("/watch", summary="P1/P2 桩 (原: /login/pwd)")
def stub_get_watch():
    """P1/P2 桩端点 GET /api/v1/edu/watch."""
    return _ok(_stub_response("GET /api/v1/edu/watch"))


# ======================================================================
# withdrawal_flow (6 端点)
# ======================================================================

@router.get("/withdrawal_flow/list", summary="P1/P2 桩 (原: /withdrawal_flow/list)")
def stub_get_withdrawal_flow_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/withdrawal_flow/list."""
    return _ok(_stub_response("GET /api/v1/edu/withdrawal_flow/list"))

@router.get("/withdrawal_flow/export", summary="P1/P2 桩 (原: /withdrawal_flow/export)")
def stub_get_withdrawal_flow_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/withdrawal_flow/export."""
    return _ok(_stub_response("GET /api/v1/edu/withdrawal_flow/export"))

@router.get("/withdrawal_flow/{item_id}", summary="P1/P2 桩 (原: /withdrawal_flow/{item_id})")
def stub_get_withdrawal_flow_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/withdrawal_flow/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/withdrawal_flow/{item_id}"))

@router.post("/withdrawal_flow", summary="P1/P2 桩 (原: /withdrawal_flow)")
def stub_post_withdrawal_flow(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/withdrawal_flow."""
    return _ok(_stub_response("POST /api/v1/edu/withdrawal_flow"))

@router.put("/withdrawal_flow", summary="P1/P2 桩 (原: /withdrawal_flow)")
def stub_put_withdrawal_flow(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/withdrawal_flow."""
    return _ok(_stub_response("PUT /api/v1/edu/withdrawal_flow"))

@router.delete("/withdrawal_flow/{ids}", summary="P1/P2 桩 (原: /withdrawal_flow/{ids})")
def stub_delete_withdrawal_flow_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/withdrawal_flow/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/withdrawal_flow/{ids}"))


# ======================================================================
# zhsAgent (5 端点)
# ======================================================================

@router.get("/zhsAgent/list", summary="P1/P2 桩 (原: /zhsAgent/list)")
def stub_get_zhsAgent_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/zhsAgent/list."""
    return _ok(_stub_response("GET /api/v1/edu/zhsAgent/list"))

@router.get("/zhsAgent/{item_id}", summary="P1/P2 桩 (原: /zhsAgent/{item_id})")
def stub_get_zhsAgent_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/zhsAgent/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/zhsAgent/{item_id}"))

@router.post("/zhsAgent", summary="P1/P2 桩 (原: /zhsAgent)")
def stub_post_zhsAgent(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/zhsAgent."""
    return _ok(_stub_response("POST /api/v1/edu/zhsAgent"))

@router.put("/zhsAgent", summary="P1/P2 桩 (原: /zhsAgent)")
def stub_put_zhsAgent(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/zhsAgent."""
    return _ok(_stub_response("PUT /api/v1/edu/zhsAgent"))

@router.delete("/zhsAgent/{ids}", summary="P1/P2 桩 (原: /zhsAgent/{ids})")
def stub_delete_zhsAgent_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/zhsAgent/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/zhsAgent/{ids}"))


# ======================================================================
# zhsIdentity (2 端点)
# ======================================================================

@router.get("/zhsIdentity/list", summary="P1/P2 桩 (原: /zhsIdentity/list)")
def stub_get_zhsIdentity_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/zhsIdentity/list."""
    return _ok(_stub_response("GET /api/v1/edu/zhsIdentity/list"))

@router.get("/zhsIdentity/export", summary="P1/P2 桩 (原: /zhsIdentity/export)")
def stub_get_zhsIdentity_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/zhsIdentity/export."""
    return _ok(_stub_response("GET /api/v1/edu/zhsIdentity/export"))


# ======================================================================
# zhs_activity (2 端点)
# ======================================================================

@router.get("/zhs_activity/get", summary="P1/P2 桩 (原: /zhs_activity/get)")
def stub_get_zhs_activity_get():
    """P1/P2 桩端点 GET /api/v1/edu/zhs_activity/get."""
    return _ok(_stub_response("GET /api/v1/edu/zhs_activity/get"))

@router.get("/zhs_activity/{item_id}", summary="P1/P2 桩 (原: /zhs_activity/{item_id})")
def stub_get_zhs_activity_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/zhs_activity/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/zhs_activity/{item_id}"))


# ======================================================================
# zhs_agent_buy (7 端点)
# ======================================================================

@router.get("/zhs_agent_buy/list", summary="P1/P2 桩 (原: /zhs_agent_buy/list)")
def stub_get_zhs_agent_buy_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/zhs_agent_buy/list."""
    return _ok(_stub_response("GET /api/v1/edu/zhs_agent_buy/list"))

@router.get("/zhs_agent_buy/detail/{item_id}", summary="P1/P2 桩 (原: /zhs_agent_buy/detail/{item_id})")
def stub_get_zhs_agent_buy_detail_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/zhs_agent_buy/detail/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/zhs_agent_buy/detail/{item_id}"))

@router.delete("/zhs_agent_buy/{ids}", summary="P1/P2 桩 (原: /zhs_agent_buy/{ids})")
def stub_delete_zhs_agent_buy_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/zhs_agent_buy/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/zhs_agent_buy/{ids}"))

@router.get("/zhs_agent_buy/unsettled", summary="P1/P2 桩 (原: /zhs_agent_buy/unsettled)")
def stub_get_zhs_agent_buy_unsettled():
    """P1/P2 桩端点 GET /api/v1/edu/zhs_agent_buy/unsettled."""
    return _ok(_stub_response("GET /api/v1/edu/zhs_agent_buy/unsettled"))

@router.get("/zhs_agent_buy/expired", summary="P1/P2 桩 (原: /zhs_agent_buy/expired)")
def stub_get_zhs_agent_buy_expired():
    """P1/P2 桩端点 GET /api/v1/edu/zhs_agent_buy/expired."""
    return _ok(_stub_response("GET /api/v1/edu/zhs_agent_buy/expired"))

@router.put("/zhs_agent_buy/{item_id}/expire", summary="P1/P2 桩 (原: /zhs_agent_buy/{item_id}/expire)")
def stub_put_zhs_agent_buy_item_id_expire(item_id: int = 0, payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/zhs_agent_buy/{item_id}/expire."""
    return _ok(_stub_response("PUT /api/v1/edu/zhs_agent_buy/{item_id}/expire"))

@router.put("/zhs_agent_buy/{item_id}/settle", summary="P1/P2 桩 (原: /zhs_agent_buy/{item_id}/settle)")
def stub_put_zhs_agent_buy_item_id_settle(item_id: int = 0, payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/zhs_agent_buy/{item_id}/settle."""
    return _ok(_stub_response("PUT /api/v1/edu/zhs_agent_buy/{item_id}/settle"))


# ======================================================================
# zhs_product (2 端点)
# ======================================================================

@router.get("/zhs_product/list", summary="P1/P2 桩 (原: /zhs_product/list)")
def stub_get_zhs_product_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/zhs_product/list."""
    return _ok(_stub_response("GET /api/v1/edu/zhs_product/list"))

@router.get("/zhs_product/export", summary="P1/P2 桩 (原: /zhs_product/export)")
def stub_get_zhs_product_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/zhs_product/export."""
    return _ok(_stub_response("GET /api/v1/edu/zhs_product/export"))


# ======================================================================
# zhs_user (6 端点)
# ======================================================================

@router.get("/zhs_user/list", summary="P1/P2 桩 (原: /zhs_user/list)")
def stub_get_zhs_user_list(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/zhs_user/list."""
    return _ok(_stub_response("GET /api/v1/edu/zhs_user/list"))

@router.get("/zhs_user/export", summary="P1/P2 桩 (原: /zhs_user/export)")
def stub_get_zhs_user_export(page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100)):
    """P1/P2 桩端点 GET /api/v1/edu/zhs_user/export."""
    return _ok(_stub_response("GET /api/v1/edu/zhs_user/export"))

@router.get("/zhs_user/{item_id}", summary="P1/P2 桩 (原: /zhs_user/{item_id})")
def stub_get_zhs_user_item_id(item_id: int = 0):
    """P1/P2 桩端点 GET /api/v1/edu/zhs_user/{item_id}."""
    return _ok(_stub_response("GET /api/v1/edu/zhs_user/{item_id}"))

@router.post("/zhs_user", summary="P1/P2 桩 (原: /zhs_user)")
def stub_post_zhs_user(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 POST /api/v1/edu/zhs_user."""
    return _ok(_stub_response("POST /api/v1/edu/zhs_user"))

@router.put("/zhs_user", summary="P1/P2 桩 (原: /zhs_user)")
def stub_put_zhs_user(payload: Optional[Dict[str, Any]] = Body(None)):
    """P1/P2 桩端点 PUT /api/v1/edu/zhs_user."""
    return _ok(_stub_response("PUT /api/v1/edu/zhs_user"))

@router.delete("/zhs_user/{ids}", summary="P1/P2 桩 (原: /zhs_user/{ids})")
def stub_delete_zhs_user_ids(ids: int = 0):
    """P1/P2 桩端点 DELETE /api/v1/edu/zhs_user/{ids}."""
    return _ok(_stub_response("DELETE /api/v1/edu/zhs_user/{ids}"))


# 总端点数: 417
