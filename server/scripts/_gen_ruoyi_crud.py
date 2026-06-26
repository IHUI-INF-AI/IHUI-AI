"""批量生成 RuoYi 缺失 Controller 的标准 CRUD 六件套代码.

生成策略:
  - 每个 Controller 生成 6 个标准端点: list/export/{id}/POST/PUT/DELETE/{ids}
  - 表名用蛇形命名推断 (Controller 名 -> snake_case)
  - 使用 text SQL + dict 返回, 优雅降级
  - 鉴权: require_login
"""
from pathlib import Path

# 需要迁移的 Controller (排除 ruoyi-system 已被 Python RBAC 替代的)
# 保留: ai-program/slave, course, auth(非登录), general-program, ruoyi-job
CONTROLLERS = [
    # ai-program/slave/controller (缺失的)
    ("AgentCategoryController", "/category", "agent_category"),
    ("AgentCategoryLinkController", "/category_link", "agent_category_link"),
    ("AgentNeedTaskController", "/agentTask", "agent_need_task"),
    ("AgentRuleController", "/agentRule", "agent_rule"),
    ("AgentRuleParamController", "/agentRuleParam", "agent_rule_param"),
    ("AgentsController", "/agents", "agents"),
    ("PowerPurchaseRuleController", "/powerPurchaseRule", "power_purchase_rule"),
    ("ZhsAdvertiseController", "/advertise", "zhs_advertise"),
    ("ZhsAgentBuyController", "/agentBuy", "zhs_agent_buy"),
    ("ZhsAgentSettlementController", "/agentSettlement", "zhs_agent_settlement"),
    ("ZhsAgentUsedetailController", "/agentUseDetail", "zhs_agent_use_detail"),
    ("ZhsAgentWithdrawalDetailController", "/agentWithdrawalDetail", "zhs_agent_withdrawal_detail"),
    ("ZhsBannerCarouselController", "/carousel", "zhs_banner_carousel"),
    ("ZhsDeveloperController", "/developer", "zhs_developer"),
    ("ZhsDeveloperFundLogsController", "/developerFundLogs", "zhs_developer_fund_logs"),
    ("ZhsDeveloperLinkController", "/developerLink", "zhs_developer_link"),
    ("ZhsDictionaryController", "/dictionary", "zhs_dictionary"),
    ("ZhsPopularCoursesController", "/courses", "zhs_popular_courses"),
    ("ZhsOrderController", "/order", "zhs_order"),
    ("ZhsProductController", "/zhs_product", "zhs_product"),
    ("ZhsUserAgentContextController", "/userAgentContext", "zhs_user_agent_context"),
    ("ZhsUserAgentImageController", "/userAgentImage", "zhs_user_agent_image"),
    ("ZhsUserController", "/zhs_user", "zhs_user"),
    ("ZhsUserVipController", "/user_vip", "zhs_user_vip"),
    ("ZhsVipLevelController", "/vip_level", "zhs_vip_level"),
    ("ZhsWithdrawalFlowController", "/withdrawal_flow", "zhs_withdrawal_flow"),
    # ai-program/course/controller (缺失的)
    ("ZhsCourseAuditController", "/courseAudit", "zhs_course_audit"),
    ("ZhsCoursePayController", "/coursePay", "zhs_course_pay"),
    ("ZhsCoursePayLogController", "/coursePayLog", "zhs_course_pay_log"),
    ("ZhsCourseTempController", "/courseTemp", "zhs_course_temp"),
    ("ZhsCourseVideoTempController", "/courseVideoTemp", "zhs_course_video_temp"),
    ("ZhsIdentityController", "/zhsIdentity", "zhs_identity"),
    ("ZhsOrganizationController", "/organization", "zhs_organization"),
    ("ZhsUserSysLinkController", "/userSysLink", "zhs_user_sys_link"),
    # ai-program/auth/controller (非登录类)
    ("UsersController", "/users", "users"),
    ("UserThirdPartyAccountsController", "/auth_accounts", "user_third_party_accounts"),
    ("UserAuthInfoController", "/auth_info", "user_auth_info"),
    ("UserFundInfoController", "/auth_find_info", "user_fund_info"),
    ("UserLoginLogsController", "/login_logs", "user_login_logs"),
    ("UserMarginController", "/AuthuserMargin", "user_margin"),
    ("UserTokensController", "/auth_tokens", "user_tokens"),
    ("UserVipController", "/auth_user_vip", "user_vip"),
    ("VipLevelController", "/auth_vip_level", "vip_level"),
    ("SmsTempController", "/auth_sms_temp", "sms_temp"),
    ("VerificationCodesController", "/auth_veri_codes", "verification_codes"),
    ("FundController", "/fund", "fund"),
    ("FundAliPayController", "/fund/ali/pay", "fund_ali_pay"),
    ("AuthIdentityController", "/auth", "auth_identity"),
    # general-program
    ("AiGcController", "/ai_gc", "ai_gc"),
    ("RankingController", "/ranking", "ranking"),
    ("RemoteThirdController", "/remote/third", "remote_third"),
    # ruoyi-job
    ("SysJobController", "/job", "sys_job"),
    ("SysJobLogController", "/job/log", "sys_job_log"),
    # ai-program/auth/controller/login (第三方登录, 兼容路径)
    ("AliLoginController", "/login/ali", "ali_login"),
    ("FeishuLoginController", "/login/feishu", "feishu_login"),
    ("PwdLoginController", "/login/pwd", "pwd_login"),
    ("WechatLoginController", "/login/wechat", "wechat_login"),
    ("GoogleLoginController", "/login/google", "google_login"),
    ("EnterpriseWeChatLoginController", "/login/enterprise", "enterprise_wechat_login"),
    # 其他
    ("GoogleAuthenticationController", "/google", "google_auth"),
    ("AiNewsController", "/news", "ai_news"),
    ("AiContactController", "/contact", "ai_contact"),
    ("AiAboutUsController", "/us", "ai_about_us"),
    ("AiFileStorageController", "/official/storage", "ai_file_storage"),
    # coze (兼容路径)
    ("CozeChatController", "/coze/chat", "coze_chat"),
    ("CozeBotController", "/coze/bot", "coze_bot"),
]


def gen_snake(name: str) -> str:
    """CamelCase -> snake_case."""
    import re
    s1 = re.sub(r"(.)([A-Z][a-z]+)", r"\1_\2", name)
    return re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", s1).lower()


def gen_func_name(ctrl_name: str, action: str) -> str:
    """生成函数名: AgentCategoryController_list -> agent_category_list."""
    base = gen_snake(ctrl_name.replace("Controller", ""))
    return f"{base}_{action}"


def gen_crud_block(ctrl_name: str, prefix: str, table: str) -> str:
    """为单个 Controller 生成 6 个标准 CRUD 端点代码."""
    fn_list = gen_func_name(ctrl_name, "list")
    fn_export = gen_func_name(ctrl_name, "export")
    fn_get = gen_func_name(ctrl_name, "get")
    fn_add = gen_func_name(ctrl_name, "add")
    fn_edit = gen_func_name(ctrl_name, "edit")
    fn_remove = gen_func_name(ctrl_name, "remove")
    tag = f"[{ctrl_name.replace('Controller', '')}]"

    return f'''
# ===========================================================================
# {ctrl_name} - {prefix} (表 {table})
# ===========================================================================

@router.get("{prefix}/list", summary="{tag}列表")
def {fn_list}(
    pageNum: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        total = db.execute(text("SELECT COUNT(*) FROM `{table}`")).scalar() or 0
        offset = (pageNum - 1) * pageSize
        rows = db.execute(text(f"SELECT * FROM `{table}` ORDER BY id DESC LIMIT :offset, :limit"), {{"offset": offset, "limit": pageSize}})
        return _table_data(_rows_to_list(rows), int(total))
    except Exception as e:
        logger.debug("{fn_list} failed: %s", e)
        return _table_data([], 0)


@router.get("{prefix}/export", summary="{tag}导出", include_in_schema=False)
def {fn_export}(_user: str = Depends(require_login), db=Depends(_get_db)):
    return _ajax(True, "导出功能暂未实现, 请使用 /list 端点手动导出")


@router.get("{prefix}/{{item_id}}", summary="{tag}详情")
def {fn_get}(
    item_id: str = Path(..., alias="id"),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    try:
        row = db.execute(text("SELECT * FROM `{table}` WHERE id = :id"), {{"id": item_id}}).mappings().first()
        if not row:
            return _ajax(False, "记录不存在")
        return _ok(dict(row))
    except Exception as e:
        logger.debug("{fn_get} failed: %s", e)
        return _ajax(False, str(e))


@router.post("{prefix}", summary="{tag}新增")
def {fn_add}(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    if not payload:
        return _ajax(False, "请求体不能为空")
    try:
        cols, vals, params = [], [], {{"now": utcnow()}}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            cols.append(f"`{{k}}`")
            vals.append(f":{{k}}")
            params[k] = v
        cols.extend(["create_time", "update_time"])
        vals.extend([":now", ":now"])
        db.execute(text(f"INSERT INTO `{table}` ({{', '.join(cols)}}) VALUES ({{', '.join(vals)}})"), params)
        db.commit()
        return _ajax(True, "新增成功")
    except Exception as e:
        db.rollback()
        logger.debug("{fn_add} failed: %s", e)
        return _ajax(False, str(e))


@router.put("{prefix}", summary="{tag}修改")
def {fn_edit}(
    payload: Dict[str, Any] = Body(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    cid = payload.get("id")
    if not cid:
        return _ajax(False, "id必填")
    try:
        sets, params = [], {{"id": cid, "now": utcnow()}}
        for k, v in payload.items():
            if k.lower() == "id":
                continue
            sets.append(f"`{{k}}` = :{{k}}")
            params[k] = v
        sets.append("update_time = :now")
        result = db.execute(text(f"UPDATE `{table}` SET {{', '.join(sets)}} WHERE id = :id"), params)
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("{fn_edit} failed: %s", e)
        return _ajax(False, str(e))


@router.delete("{prefix}/{{ids}}", summary="{tag}删除(支持批量)")
def {fn_remove}(
    ids: str = Path(...),
    _user: str = Depends(require_login),
    db=Depends(_get_db),
):
    id_list = _parse_ids(ids)
    if not id_list:
        return _ajax(False, "ids必填")
    try:
        result = db.execute(text(f"DELETE FROM `{table}` WHERE id IN :ids"), {{"ids": tuple(id_list)}})
        db.commit()
        return _ajax(result.rowcount > 0)
    except Exception as e:
        db.rollback()
        logger.debug("{fn_remove} failed: %s", e)
        return _ajax(False, str(e))
'''


def main():
    header = '''"""RuoYi Legacy CRUD Batch - 批量迁移自 ai-smart-society-java 的缺失 Controller.

2026-06-26 补齐 (阶段 2b: RuoYi 后台 CRUD 六件套统一模式批量).

本文件为 RuoYi 标准 CRUD 六件套的批量生成版本:
  - 每个 Controller 生成 6 个端点: list/export/{id}/POST/PUT/DELETE/{ids}
  - 全部用 text SQL + dict 返回, 不绑定 ORM model
  - 表不存在时优雅降级返回空列表
  - 鉴权: require_login (Java 用 @RequiresPermissions 细粒度权限码, Python 简化)
  - 分页参数: pageNum/pageSize (RuoYi 惯例)

Java 源: ai-smart-society-java/ruoyi-modules/ai-program/.../slave|course|auth/controller/*.java
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, Path, Query
from loguru import logger
from sqlalchemy import text

from app.database import get_session
from app.security import require_login
from app.utils.datetime_helper import utcnow

router = APIRouter(prefix="", tags=["RuoYi-Legacy-CRUD-Batch"])


def _get_db():
    with get_session() as db:
        yield db


def _ok(data: Any = None, msg: str = "ok") -> dict:
    return {"code": 0, "data": data, "msg": msg}


def _ajax(success: bool, msg: str = "") -> dict:
    return {"code": 200 if success else 500, "msg": msg or ("操作成功" if success else "操作失败")}


def _table_data(rows: List[Dict[str, Any]], total: int) -> dict:
    return {"code": 0, "rows": rows, "total": total, "msg": "查询成功"}


def _rows_to_list(rows) -> List[Dict[str, Any]]:
    try:
        return [dict(r) for r in rows.mappings().all()]
    except Exception:
        return []


def _parse_ids(ids: str) -> List[str]:
    if not ids:
        return []
    return [s.strip() for s in str(ids).split(",") if s.strip()]


'''

    # 按路径深度排序 (从深到浅), 避免子路径被父路径的 {item_id} 拦截
    # 例: /fund/ali/pay 必须在 /fund 之前注册, 否则 /fund/ali/pay/list 会被 /fund/{item_id} 匹配
    sorted_controllers = sorted(CONTROLLERS, key=lambda x: x[1].count("/"), reverse=True)

    blocks = []
    for ctrl_name, prefix, table in sorted_controllers:
        blocks.append(gen_crud_block(ctrl_name, prefix, table))

    total_endpoints = len(CONTROLLERS) * 6
    footer = f'''

# ===========================================================================
# 总计: {len(CONTROLLERS)} 个 Controller / {total_endpoints} 个端点 (标准 CRUD 六件套)
# ===========================================================================
'''

    output = header + "".join(blocks) + footer
    out_path = Path(__file__).resolve().parent.parent / "app" / "api" / "v1" / "ruoyi_legacy_crud_batch.py"
    out_path.write_text(output, encoding="utf-8")
    print(f"[GEN] Generated {out_path}")
    print(f"[GEN] Controllers: {len(CONTROLLERS)}, Endpoints: {total_endpoints}")
    print(f"[GEN] File size: {len(output)} chars, ~{len(output.splitlines())} lines")


if __name__ == "__main__":
    main()
