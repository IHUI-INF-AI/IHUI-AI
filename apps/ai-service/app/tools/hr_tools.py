# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""人事部「员工自助查薪 / 查考勤」插件工具(D09-HR,2026-11-13 立)。

设计(方案C:混合——薪资走专门工具、考勤请假走 skill):
- **专门工具形态**:员工在对话里说"我这个月工资多少""我的考勤"时,命中意图路由
  (`_HR_INTENT_PATTERNS`)无条件并入工具白名单,模型调用 hr_my_payroll / hr_my_attendance。
- **仅本人通道**:两个工具都走后端 `/mine` 端点——浏览器侧用登录 JWT,对话侧用
  ``internal_service_headers(uid, "mcp-hr")`` 短期票(票面主体=本人)。端点不接受
  "查指定他人"的任何入参 ⇒ 无提权面,员工只能看到自己的数据。
- **不写生产库**:纯读(仅 GET /mine*),与 generate_report 同档,不入 _ADMIN_ONLY_TOOLS。
- **金额纪律**:后端返回字符串金额(Decimal 落库),工具原样透传,不在对话层做浮点运算。
"""

from __future__ import annotations

import logging
import os
import re
from typing import Any

from ..core.internal_ticket import internal_service_headers

logger = logging.getLogger(__name__)

# 项目内 months 形状校验(YYYY-MM)
_MONTH_RE = re.compile(r"^\d{4}-\d{2}$")

# 后端 base(与 edu 通道同源:API_SERVICE_URL,回环 8802)
_HR_API_BASE_URL = os.environ.get("API_SERVICE_URL", "http://localhost:8802").rstrip("/")

# 内部票 scope:与 apps/api plugins/internal-service-ticket.ts 的 INTERNAL_TICKET_SCOPES 同笔
_HR_SCOPE = "mcp-hr"


# ---------------------------------------------------------------------------
# 描述常量(描述文案单源;mcp_server 的 MCPTool.description import 这一份)
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
    "**只能查本人**。无参数。返回 periodMonth/status/netPay 列表;空列表表示您暂无工资记录。"
)

HR_MY_ATTENDANCE_DESCRIPTION = (
    "人事自助-查本人考勤月结:员工查询自己某个月的考勤汇总(应出勤/实出勤/迟到/早退/缺勤/"
    "请假天数/加班时长 + 加班明细)。**只能查本人**,不接受「查指定员工/他人」的入参。"
    "periodMonth 格式 YYYY-MM(必填)。返回 ok=False 且 NOT_FOUND 表示该月尚未月结或您无员工档案。"
)


def hr_internal_headers(user_id: Any) -> dict[str, str]:
    """HR 自助工具调后端 /mine 的鉴权头:走 internal_service_headers 唯一出口(scope=mcp-hr)。

    票面主体 = uid(本人)。后端 /mine 端点用 requireSelf(浏览器 JWT 或 mcp-hr 内部票,
    主体恒为本人),内部票验票后把 uid 注入 request.userId。取不到合法 uid 或签不出凭据
    ⇒ 返回 {},调用方不发请求。
    """
    uid = str(user_id or "").strip()
    if not uid or not re.fullmatch(r"[a-zA-Z0-9-]{1,128}", uid):
        return {}
    secret = os.environ.get("AI_CALLBACK_SECRET", "").strip()
    return internal_service_headers(uid, _HR_SCOPE, legacy_token=secret)


def _fail(tool: str, code: str, message: str) -> dict[str, Any]:
    return {"tool": tool, "ok": False, "errorCode": code, "message": message}


async def _hr_get(path: str, *, user_id: Any, params: dict[str, Any] | None = None, tool: str = "hr") -> dict[str, Any]:
    """HR 自助工具统一 HTTP 出口:GET 后端并剥 success() 壳({code,message,data})。

    2xx → {ok: True, **data};非 2xx → {ok: False, errorCode, message}。
    鉴权头缺失(无身份/签不出票)⇒ 不发请求,返回可读错误。
    """
    import httpx

    headers = hr_internal_headers(user_id)
    if not headers:
        return _fail(
            tool,
            "INTERNAL_AUTH_UNAVAILABLE",
            "内部服务凭证不可用或用户身份缺失,无法查询您的人事数据",
        )
    url = f"{_HR_API_BASE_URL}{path}"
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(url, headers=headers, params=params)
    except Exception as e:  # noqa: BLE001
        logger.warning("HR 自助接口请求失败: %s", e)
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
