# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""人事部 AI 工具:员工自助(本人) + 薪资计算(管理侧)。

2026-11-21 实装(此前 hr_tools 只有描述常量与一个 helper,工具从未注册 ⇒ 对话里
「我这个月工资多少」没有任何后端可达路径)。

五枚工具:
- hr_my_payroll / hr_my_payroll_periods / hr_my_attendance / hr_my_leaves —— 员工自助,
  只走**本人**作用域端点(`/api/hr-payroll/mine*`、`/api/hr-attendance/my-*`),
  身份票主体 = 登录 uid,不接受任何"查他人"的入参 ⇒ 无提权面;
- hr_payroll_calc —— 管理侧算薪(POST /api/hr-payroll/calculate),权限
  `hr:payroll:manage` 由 apps/api 的 RBAC 逐请求现问;**纯计算 + 落工资单,
  不改审批状态、不发放**。

票 scope 修正:原文件写 "mcp-hr",而 `INTERNAL_TICKET_SCOPES` 是封闭集且不含该值
⇒ mint 期抛错、工具永远 INTERNAL_AUTH_UNAVAILABLE。现与 `ai_payroll_handoff`
同走已验通的 "api-tools" 腿(api 侧不限定 scope,主体由 X-User-Id 注入,RBAC 兜底)。

金额纪律:后端按 Decimal 落库并返回字符串,工具层原样透传,不做浮点运算。
"""

from __future__ import annotations

import logging
import os
import re
from typing import Any

from ..core.internal_ticket import internal_service_headers

logger = logging.getLogger(__name__)

_MONTH_RE = re.compile(r"^\d{4}-\d{2}$")
_UID_RE = re.compile(r"^[a-zA-Z0-9-]{1,128}$")

# ---------------------------------------------------------------------------
# 描述常量(文案单源;mcp_server 的 MCPTool.description import 这一份)
# ---------------------------------------------------------------------------

HR_MY_PAYROLL_DESCRIPTION = (
    "人事自助-查本人工资单:员工查询自己某个月的工资明细(基本工资/加班费/补贴/考勤扣款/"
    "应发/社保个人/公积金个人/个税/实发 + breakdown 可复算明细)。**只能查本人**,不接受任何"
    "「查指定员工/他人」的入参。periodMonth 格式 YYYY-MM(必填,如 2026-10)。"
    "返回 ok=False 且 NOT_FOUND 表示该月尚未算薪或您无对应员工档案,如实转述、不要编造数字。"
    "金额均为字符串(后端按 Decimal 计算),原样展示,不要在对话层重算或改写。"
)

HR_MY_PAYROLL_PERIODS_DESCRIPTION = (
    "人事自助-列本人工资月:员工查询自己有工资单记录的月份列表(供先选月、再查 hr_my_payroll)。"
    "**只能查本人**,无参数。返回 periodMonth/status/netPay 列表;空列表表示您暂无工资记录。"
)

HR_MY_ATTENDANCE_DESCRIPTION = (
    "人事自助-查本人考勤:员工查询自己的考勤。传 periodMonth(YYYY-MM)返回该月**月结汇总**"
    "(应出勤/实出勤/迟到/早退/缺勤/请假/加班 + 加班分类明细);不传则返回最近考勤明细记录"
    "(默认 31 条,可传 startDate/endDate 限定区间 YYYY-MM-DD)。**只能查本人**,不接受"
    "「查指定员工/他人」的入参。未绑定员工档案时员工身份为 null、列表为空 —— 如实转述,"
    "并提示可在人事自助页提交账号↔档案关联申请。"
)

HR_MY_LEAVES_DESCRIPTION = (
    "人事自助-查本人请假单:员工查询自己提交过的请假单(类型/起止/天数/状态/原因/提交时间)。"
    "**只能查本人**,可选 status 过滤(pending/approved/rejected 等)。未绑定档案时列表为空。"
)

HR_PAYROLL_CALC_DESCRIPTION = (
    "人事部-月度算薪:按某月**已月结考勤** + 员工薪资配置计算全员工资单,薪资周期推进到 "
    "calculated。periodMonth 格式 YYYY-MM(必填)。可选 regionName(参保地区名,决定社保费率配置)、"
    "overwriteApproved(默认 false —— 已审批通过的周期不允许覆盖)。"
    "返回 employees/inserted/updated/skippedNoConfig(缺薪资配置被跳过的员工数)/totalGross/totalNet。"
    "**缺配置的员工只会报数、绝不猜数**;算完不自动审批、不发放,审批与入账由财务人工执行。"
    "需要 hr:payroll:manage 权限(HR/财务管理,管理员账号豁免);无权限返回 403。"
)


HR_INSURANCE_READINESS_DESCRIPTION = (
    "人事财务-社保配置体检:算薪前检查「某年 + 某参保地」的社保公积金费率配置能不能直接用来算薪。"
    "返回 ready(是否就绪)、issues(缺失/非法项清单)、config(命中的配置快照,含个人费率与缴费基数"
    "上下限)、roster(库里已有的全部配置)。**算薪引擎在配置缺失或不完整时会直接拒绝出单**"
    "(宁可不出单,不出错单),所以算薪前先跑这枚工具最稳。"
    "可选 effectiveYear(4 位年份,默认当年)、regionName(参保地名;同一年有多个参保地时必须指定)。"
    "ready=False 时如实转述 issues,不要臆测费率;补齐入口是薪资配置页(或 "
    "POST /api/hr-salary-config/insurance)。本工具**只读**,不改任何配置。"
    "社保费率与缴费基数上下限没有外部实时数据源,全靠这张配置表按年维护 —— 若 issues 提示某年无配置,"
    "说明当年还没录,不是系统故障。"
)


# ---------------------------------------------------------------------------
# HTTP 出口(与 ai_payroll_handoff 同一条内部票腿)
# ---------------------------------------------------------------------------


def hr_internal_headers(user_id: Any) -> dict[str, str]:
    """HR 工具调后端时的鉴权头:走 internal_service_headers 唯一出口。

    scope 必须落在两侧同笔的 `INTERNAL_TICKET_SCOPES` 封闭集内 —— 用 "api-tools"
    (通用工具面,已由 ai_payroll_handoff 端到端验通)。票面主体 = uid;
    取不到合法 uid 或签不出凭据 ⇒ 返回 {},调用方不发请求(fail-closed)。
    """
    uid = str(user_id or "").strip()
    if not uid or not _UID_RE.fullmatch(uid):
        return {}
    secret = os.environ.get("AI_CALLBACK_SECRET", "").strip()
    return internal_service_headers(uid, "api-tools", legacy_token=secret)


def _api_base_url() -> str:
    return os.environ.get("API_SERVICE_URL", "http://localhost:8802").rstrip("/")


def _fail(tool: str, code: str, message: str) -> dict[str, Any]:
    return {"tool": tool, "ok": False, "errorCode": code, "message": message}


async def _hr_request(
    method: str,
    path: str,
    *,
    tool: str,
    user_id: Any,
    params: dict[str, Any] | None = None,
    body: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """统一 HTTP 出口:发请求并剥 `{code,message,data}` 壳。

    成功 → `{ok: True, **data}`(data 非 dict 时放 data 键);
    失败 → `{ok: False, errorCode, message}`(错误码优先取后端的 errorCode)。
    鉴权头缺失(无身份/签不出票)⇒ 不发请求。
    """
    import httpx

    headers = hr_internal_headers(user_id)
    if not headers:
        return _fail(
            tool,
            "INTERNAL_AUTH_UNAVAILABLE",
            "内部服务凭证不可用或用户身份缺失,无法访问人事数据",
        )
    url = f"{_api_base_url()}{path}"
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.request(method, url, headers=headers, params=params, json=body)
    except Exception as e:  # noqa: BLE001
        logger.warning("[%s] 人事接口请求失败:%s", tool, e)
        return _fail(tool, "NETWORK_ERROR", f"人事接口请求失败: {e}")
    try:
        payload = resp.json()
    except Exception:  # noqa: BLE001
        payload = {}
    if resp.status_code < 400:
        data = payload.get("data") if isinstance(payload, dict) else None
        if isinstance(data, dict):
            return {"ok": True, **data}
        return {"ok": True, "data": data}
    message = payload.get("message") if isinstance(payload, dict) else None
    errorCode = payload.get("errorCode") if isinstance(payload, dict) else None
    return _fail(
        tool,
        str(errorCode) if errorCode else f"HTTP_{resp.status_code}",
        str(message) if message else f"人事接口返回 HTTP {resp.status_code}",
    )


def _uid_or_fail(tool: str, arguments: dict[str, Any]) -> tuple[str, dict[str, Any] | None]:
    """取宿主注入的 __user_id;缺失或形状非法返回 (空串, 失败体)。"""
    uid = str(arguments.get("__user_id") or "").strip()
    if not uid or not _UID_RE.fullmatch(uid):
        return "", _fail(tool, "MISSING_USER", "缺少用户身份(__user_id 未注入或非法),无法查询人事数据")
    return uid, None


# ---------------------------------------------------------------------------
# 五枚工具
# ---------------------------------------------------------------------------


async def hr_my_payroll_periods(arguments: dict[str, Any]) -> dict[str, Any]:
    """列本人有工资单的月份(供先选月)。"""
    tool = "hr_my_payroll_periods"
    uid, err = _uid_or_fail(tool, arguments)
    if err:
        return err
    result = await _hr_request("GET", "/api/hr-payroll/mine/periods", tool=tool, user_id=uid)
    if not result.get("ok"):
        return result
    periods = result.get("periods", [])
    return {
        "tool": tool,
        "ok": True,
        "periods": periods,
        "count": len(periods),
        "message": (
            f"共 {len(periods)} 个工资月。" if periods else "暂无工资单记录(或未绑定员工档案)。"
        ),
    }


async def hr_my_payroll(arguments: dict[str, Any]) -> dict[str, Any]:
    """查本人某月工资单。"""
    tool = "hr_my_payroll"
    uid, err = _uid_or_fail(tool, arguments)
    if err:
        return err
    period_month = arguments.get("periodMonth")
    if not isinstance(period_month, str) or not _MONTH_RE.match(period_month.strip()):
        return _fail(tool, "INVALID_PERIOD", "periodMonth 必须是 YYYY-MM 格式(如 2026-10)")
    period_month = period_month.strip()
    result = await _hr_request(
        "GET",
        "/api/hr-payroll/mine",
        tool=tool,
        user_id=uid,
        params={"periodMonth": period_month},
    )
    if not result.get("ok"):
        return result
    return {
        "tool": tool,
        "ok": True,
        "payroll": result,
        "message": (
            f"{period_month} 工资单:应发 {result.get('grossPay', '?')},"
            f"实发 {result.get('netPay', '?')}(金额原样,未在对话层重算)。"
        ),
    }


async def hr_my_attendance(arguments: dict[str, Any]) -> dict[str, Any]:
    """查本人考勤:优先月结汇总,否则最近明细。"""
    tool = "hr_my_attendance"
    uid, err = _uid_or_fail(tool, arguments)
    if err:
        return err
    period_month = arguments.get("periodMonth")
    if period_month is not None:
        if not isinstance(period_month, str) or not _MONTH_RE.match(period_month.strip()):
            return _fail(tool, "INVALID_PERIOD", "periodMonth 必须是 YYYY-MM 格式(如 2026-10)")
        result = await _hr_request(
            "GET",
            "/api/hr-attendance/my-monthly",
            tool=tool,
            user_id=uid,
            params={"periodMonth": period_month.strip()},
        )
        if not result.get("ok"):
            return result
        rows = result.get("list", [])
        return {
            "tool": tool,
            "ok": True,
            "periodMonth": period_month.strip(),
            "monthly": rows,
            "employee": result.get("employee"),
            "message": (
                f"{period_month.strip()} 月度考勤汇总 {len(rows)} 条。"
                if rows
                else f"{period_month.strip()} 暂无月结考勤(或未绑定员工档案)。"
            ),
        }

    params: dict[str, Any] = {"limit": 31}
    for key in ("startDate", "endDate"):
        value = arguments.get(key)
        if isinstance(value, str) and re.match(r"^\d{4}-\d{2}-\d{2}$", value.strip()):
            params[key] = value.strip()
    result = await _hr_request(
        "GET", "/api/hr-attendance/my-records", tool=tool, user_id=uid, params=params
    )
    if not result.get("ok"):
        return result
    rows = result.get("list", [])
    return {
        "tool": tool,
        "ok": True,
        "records": rows,
        "total": result.get("total", len(rows)),
        "employee": result.get("employee"),
        "message": (
            f"最近考勤明细 {len(rows)} 条(总计 {result.get('total', len(rows))} 条)。"
            if rows
            else "暂无考勤记录(或未绑定员工档案)。"
        ),
    }


async def hr_my_leaves(arguments: dict[str, Any]) -> dict[str, Any]:
    """查本人请假单。"""
    tool = "hr_my_leaves"
    uid, err = _uid_or_fail(tool, arguments)
    if err:
        return err
    params: dict[str, Any] = {}
    status = arguments.get("status")
    if isinstance(status, str) and status.strip():
        params["status"] = status.strip()
    result = await _hr_request(
        "GET", "/api/hr-attendance/my-leaves", tool=tool, user_id=uid, params=params or None
    )
    if not result.get("ok"):
        return result
    rows = result.get("list", [])
    return {
        "tool": tool,
        "ok": True,
        "leaves": rows,
        "count": len(rows),
        "employee": result.get("employee"),
        "message": f"本人请假单 {len(rows)} 条。" if rows else "暂无请假单(或未绑定员工档案)。",
    }


async def hr_payroll_calc(arguments: dict[str, Any]) -> dict[str, Any]:
    """管理侧月度算薪(POST /api/hr-payroll/calculate)。"""
    tool = "hr_payroll_calc"
    uid, err = _uid_or_fail(tool, arguments)
    if err:
        return err
    period_month = arguments.get("periodMonth")
    if not isinstance(period_month, str) or not _MONTH_RE.match(period_month.strip()):
        return _fail(tool, "INVALID_PERIOD", "periodMonth 必须是 YYYY-MM 格式(如 2026-10)")
    body: dict[str, Any] = {"periodMonth": period_month.strip()}
    region = arguments.get("regionName")
    if isinstance(region, str) and region.strip():
        body["regionName"] = region.strip()
    overwrite = arguments.get("overwriteApproved")
    if isinstance(overwrite, bool) and overwrite:
        body["overwriteApproved"] = True
    result = await _hr_request(
        "POST", "/api/hr-payroll/calculate", tool=tool, user_id=uid, body=body
    )
    if not result.get("ok"):
        return result
    return {
        "tool": tool,
        "ok": True,
        "payroll": result,
        "message": (
            f"{period_month.strip()} 算薪完成:{result.get('employees', 0)} 人,"
            f"新增 {result.get('inserted', 0)} / 更新 {result.get('updated', 0)},"
            f"缺薪资配置跳过 {result.get('skippedNoConfig', 0)} 人,"
            f"应发合计 {result.get('totalGross', '?')},实发合计 {result.get('totalNet', '?')}。"
            "周期状态已推进到 calculated;审批与发放需财务人工执行。"
        ),
    }


async def hr_insurance_readiness(arguments: dict[str, Any]) -> dict[str, Any]:
    """社保配置体检(GET /api/hr-salary-config/insurance/ready),只读。"""
    tool = "hr_insurance_readiness"
    uid, err = _uid_or_fail(tool, arguments)
    if err:
        return err

    params: dict[str, Any] = {}
    year = arguments.get("effectiveYear")
    if year is not None:
        try:
            y = int(year)
        except (TypeError, ValueError):
            return _fail(tool, "INVALID_YEAR", "effectiveYear 必须是 4 位年份整数,如 2026")
        if y < 2000 or y > 2100:
            return _fail(tool, "INVALID_YEAR", "effectiveYear 超出合理范围(2000~2100)")
        params["effectiveYear"] = str(y)
    region = arguments.get("regionName")
    if isinstance(region, str) and region.strip():
        params["regionName"] = region.strip()

    result = await _hr_request(
        "GET",
        "/api/hr-salary-config/insurance/ready",
        tool=tool,
        user_id=uid,
        params=params or None,
    )
    if not result.get("ok"):
        return result

    issues = [str(i) for i in (result.get("issues") or [])]
    ready = bool(result.get("ready"))
    where = f"{result.get('effectiveYear')} 年"
    if result.get("regionName"):
        where += f"「{result['regionName']}」"
    return {
        "tool": tool,
        "ok": True,
        "ready": ready,
        "effectiveYear": result.get("effectiveYear"),
        "regionName": result.get("regionName"),
        "issues": issues,
        "config": result.get("config"),
        "roster": result.get("roster") or [],
        "message": (
            f"{where}社保公积金配置已就绪,可以直接算薪。"
            if ready
            else f"{where}社保配置不可用,算薪会被拒绝:\n- " + "\n- ".join(issues)
        ),
    }


__all__ = [
    "HR_MY_PAYROLL_DESCRIPTION",
    "HR_MY_PAYROLL_PERIODS_DESCRIPTION",
    "HR_MY_ATTENDANCE_DESCRIPTION",
    "HR_MY_LEAVES_DESCRIPTION",
    "HR_PAYROLL_CALC_DESCRIPTION",
    "HR_INSURANCE_READINESS_DESCRIPTION",
    "hr_internal_headers",
    "hr_my_payroll",
    "hr_my_payroll_periods",
    "hr_my_attendance",
    "hr_my_leaves",
    "hr_payroll_calc",
    "hr_insurance_readiness",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
