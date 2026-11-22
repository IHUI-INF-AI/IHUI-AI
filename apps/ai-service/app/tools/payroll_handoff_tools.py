# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""人事部→财务部 AI 交割:ai_payroll_handoff 工具(2026-11-13 立)。

打通「算薪(人事)→记账(财务)」的 AI 联动。agent 在对话里替 HR/财务生成某月
薪资的**财务交割凭证**:调 apps/api 的 POST /api/hr-payroll/handoff 端点(与
create_automation 调 /api/automations 同一路线:internal_service_headers 双头鉴权
+ httpx + 剥 success() 壳),凭证判据(借贷平衡、approved 交割点、计提/发放分录)
只住 api 路由一处,工具层重复一份必然漂移。

身份链路(与 automation_tools 同款纪律):__user_id 由 call_tool 宿主注入覆盖,
LLM 不可控;缺失 ⇒ 直接拒,不发请求。后端 requirePermission('hr:payroll:manage')
按 X-User-Id 查 users.roleId(管理员 roleId>=1 经 AI 对话链同样豁免权限点)。

**纯产出、不落库**:端点只返回凭证 JSON,是否入账由财务侧决定(符合财务审账纪律)。
**不修改任何账**:工具体没有任何"写生产库"的路径,与 generate_report 同档,
不入 _ADMIN_ONLY_TOOLS。
"""

from __future__ import annotations

import logging
import os
import re
from typing import Any

from ..core.internal_ticket import (
    INTERNAL_TICKET_HEADER,
    INTERNAL_TOKEN_HEADER,
    internal_service_headers,
)

logger = logging.getLogger(__name__)

_TOOL_NAME = "ai_payroll_handoff"

# 月格式(YYYY-MM),与 api 侧 periodMonth 同判据
_MONTH_RE = re.compile(r"^\d{4}-\d{2}$")

# 金额一律字符串防精度漂移(Decimal 落库口径)
PAYROLL_HANDOFF_DESCRIPTION = (
    "人事部→财务部交割:生成某月薪资的财务交割凭证(算薪→记账联动)。须该月薪资周期"
    "已财务审批通过(approved)。按标准会计口径汇总产出两组分录:计提(借 管理费用/"
    "贷 应付职工薪酬)+ 发放(借 应付职工薪酬/贷 银行存款+代扣社保+代扣公积金+代扣个税),"
    "逐组校验借贷平衡。periodMonth 格式 YYYY-MM(必填,如 2026-10)。"
    "**纯产出凭证,不入账、不改账**;非 approved 周期返回 ok=False 且 PAYROLL_NOT_APPROVED,"
    "如实转述、不要编造分录。金额均为字符串(后端按 Decimal 汇总),原样展示,不要在对话层重算。"
    "需要 hr:payroll:manage 权限(财务/HR 管理);无权限返回 403。"
)


def _fail(code: str, message: str) -> dict[str, Any]:
    return {"tool": _TOOL_NAME, "ok": False, "errorCode": code, "message": message}


def _api_base_url() -> str:
    return os.environ.get("API_SERVICE_URL", "http://localhost:8802").rstrip("/")


def _internal_headers(user_id: str) -> dict[str, str]:
    """内部凭证头:走 internal_service_headers 唯一出口。

    scope 用既有 "api-tools"(INTERNAL_TICKET_SCOPES 是封闭集、两侧同笔;新增
    "mcp-hr" 不在本车道授权面,且 hr_tools.py 已踩过它不在集合里的坑)。api 侧
    checkInternalServiceToken 不传 opts.scope ⇒ 合法票 + 合法密钥即可,userId 由
    X-User-Id 注入 request.userId,再由 RBAC 对 hr:payroll:manage 逐请求现问。
    凭证或身份缺失返回 {},调用方不发请求(fail-closed)。
    """
    uid = str(user_id or "").strip()
    if not uid or not re.fullmatch(r"[a-zA-Z0-9-]{1,128}", uid):
        return {}
    secret = os.environ.get("AI_CALLBACK_SECRET", "").strip()
    headers = internal_service_headers(uid, "api-tools", legacy_token=secret)
    if INTERNAL_TICKET_HEADER not in headers and INTERNAL_TOKEN_HEADER not in headers:
        return {}
    return headers


async def _api_request(
    url: str, headers: dict[str, str], body: dict[str, Any]
) -> tuple[int, Any]:
    """POST 到 apps/api 并解析 JSON;返回 (状态码, 解析后的 payload 或 None)。

    单独成函数就是为了测试面可以整体替换它(不碰 httpx),网络异常收敛成 (0, None)。
    """
    import httpx

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, headers=headers, json=body)
    except Exception as exc:  # noqa: BLE001
        logger.warning("[ai_payroll_handoff] 调用 apps/api 失败:%s", exc)
        return 0, None
    try:
        return resp.status_code, resp.json()
    except Exception:  # noqa: BLE001
        return resp.status_code, None


async def ai_payroll_handoff(arguments: dict[str, Any]) -> dict[str, Any]:
    """ai_payroll_handoff:经 apps/api POST /api/hr-payroll/handoff 生成财务交割凭证。

    必填 periodMonth(YYYY-MM)。后端只读该月 approved 周期的工资单汇总产出分录,
    纯产出、不落库。缺 __user_id 或内部凭证 ⇒ 直接拒,不发请求。
    """
    uid = str(arguments.get("__user_id") or "").strip()
    if not uid:
        return _fail("MISSING_USER", "缺少用户身份(__user_id 未注入),无法生成交割凭证")

    period_month = arguments.get("periodMonth")
    if not isinstance(period_month, str) or not _MONTH_RE.match(period_month.strip()):
        return _fail("INVALID_PERIOD", "periodMonth 必须是 YYYY-MM 格式(如 2026-10)")
    period_month = period_month.strip()

    headers = _internal_headers(uid)
    if not headers:
        return _fail(
            "INTERNAL_AUTH_UNAVAILABLE",
            "内部服务凭证未配置(AI_CALLBACK_SECRET)或用户身份非法,无法生成交割凭证",
        )

    status, payload = await _api_request(
        f"{_api_base_url()}/api/hr-payroll/handoff", headers, {"periodMonth": period_month}
    )
    if status == 0:
        return _fail("NETWORK_ERROR", "交割接口请求失败(网络异常),请稍后重试")
    data = payload.get("data") if isinstance(payload, dict) else None
    if 200 <= status < 400:
        if not isinstance(data, dict):
            return _fail("BAD_UPSTREAM_SHAPE", f"交割接口返回结构异常(HTTP {status})")
        if not data.get("balanced", False):
            return _fail(
                "VOUCHER_UNBALANCED",
                f"{period_month} 交割凭证借贷不平衡,已拒绝产出(请核对工资单或社保配置)",
            )
        totals = data.get("totals", {})
        return {
            "tool": _TOOL_NAME,
            "ok": True,
            "voucher": data,
            "message": (
                f"{period_month} 工资交割凭证已生成({data.get('headcount', 0)} 人,"
                f"应发 {totals.get('grossPay', '?')},实发 {totals.get('netPay', '?')},"
                f"借贷平衡)。纯产出凭证,是否入账由财务确认。"
            ),
        }
    message = payload.get("message") if isinstance(payload, dict) else None
    return _fail(f"HTTP_{status}", str(message) if message else f"交割接口返回 HTTP {status}")


__all__ = [
    "PAYROLL_HANDOFF_DESCRIPTION",
    "ai_payroll_handoff",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
