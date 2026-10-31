# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""WorkBuddy「做任务赚积分」自动化族客户端(号池对标批 O68;结清枚
20276cb1d9f91acd5d53d35c2f6e03c6d92edd9c,该行已按「完成即删」摘除 —— 台账上此刻同号的
deploy-feedback 条目与本模块无关,不要据此推断本族的状态)。

**证据级别声明(2026-10-28 读侧实弹后改写;先读)**:本模块初版的路径与字段名取证自
竞品未 strip 的 Go 二进制(wb2api.exe)内嵌字符串。当天用号池在册的 workbuddy 账号
(ai_relay_account_pool 两枚 healthy,token 未过期)对上游发**只读**请求,取证结论是:

- **读侧已真机验证,且方法必须是 GET**:`/activity/growth/{tasks,streak,heatmap,
  lottery/summary,buddy/info,buddy/travel/status}` 在 `https://copilot.tencent.com` 与
  `https://www.workbuddy.cn` 两域 GET ⇒ HTTP 200 + `code:0`;**同路径 POST ⇒ 404**。
  对照 `/activity/growth/nope-control-9d3` GET ⇒ 404「404 page not found」⇒ 这儿的 404
  是"路由不存在"的可靠标记,不是网关兜底。初版按二进制惯例把读侧全写成 POST ⇒ 整族
  永远 404 ⇒ 面板永远"未判定",这是本模块最大的一处纠错。
- **字段表以真机形态为准,不是二进制**:真形态任务行是
  `{task_id,code,title,description,icon_url,level_name,status,url}` —— 二进制给的那族
  `task_code/task_desc/progress/limit_num/accept_status/reward_credit/reward_energy/
  valid_to` 在真响应里**不存在**。旧解析器把"字段缺失"当"读懂失败"(reward 缺省还按 0 记),
  现按真形态取 code/title/status,读不到的字段一律 None(§0.3 不拿 0 冒充没量到)。
  streak 真形态是嵌套对象(`streak{days,next_tier,…}` + `makeup_cards{balance,max}` +
  `redemption_status{tiers[]}`),旧实现按顶层平铺取 ⇒ 恒 None,已修。
  travel/status 真形态 `{state,daily_limit_reached,duration_hours,reward_credit,…}`,
  旧判据要求的 `status/remain/energy/credit` 四件套不存在 ⇒ 恒未判定,已修。
- **写侧:路由在、body 字段名未判定**:`tasks/accept`、`redeem`、`lottery/draw`、
  `buddy/travel/depart` 对空体与 `{"code":…}`/`{"task_code":…}`/`{"codes":[…]}` 一律
  400「invalid request」(= 已进入参数校验,但没有一种形态被认出字段);
  `makeup-cards/use` 的 400 直接点名 `invalid target_date format`;
  `buddy/travel/claim` 空体 ⇒ 403「no unclaimed travel」(= 可达、鉴权过、业务态无可领);
  `buddy/firstuid` 在两 CN 域 404(二进制取证的那条路径在本域不成立)。
  ⇒ accept 走 **WORKBUDDY_TASKS_ACCEPT_FIELD** 显式配置,留空即拒绝执行并点名四种试过的
  形态都 400 —— 宁可不做,不猜字段名。

claim(领任务奖励)**路径**与 activity **路径↔主机绑定**已于 2026-10-31 据 workbuddy2api
README(逆向+真机验证)补证并填入默认值:`WORKBUDDY_TASKS_CLAIM_PATH=/activity/growth/tasks/{code}/claim`
(**仅在 Web 域 www.workbuddy.cn + `x-client-platform: web` 成功**,见 `_claim_one_web`)、
`WORKBUDDY_TASKS_ACTIVITY_PATH=/v2/report`(事件码↔主机指纹见 config 表)。二者仍保留
`WORKBUDDY_TASKS_LIVE_RUN=false` 双门控,写侧须显式开启;若运维把配置清空则回到"拒绝执行"。
`www.workbuddy.ai` 对本 token 全域 401(连对照路径也 401)⇒ 国际域需另一套凭据,未验证。

族五/六 redeem(连签兑换)/ lottery(抽奖)于 2026-10-31 接入:读侧已真机验证
(`/activity/growth/lottery/summary` GET 200、`redemption_status.tiers` 嵌在 streak 响应),
写侧端点(`/activity/growth/redeem`、`/activity/growth/lottery/draw`)路由存在但
**body 字段名未取证**(2026-10-28 真机对 `{}` / `{"code"}` / `{"task_code"}` / `{"codes"}`
四形态一律 400)⇒ `WORKBUDDY_TASKS_REDEEM_FIELD` / `WORKBUDDY_TASKS_LOTTERY_DRAW_FIELD`
留空即拒绝写(§0.3);兑换档位(`.._REDEEM_TIERS`)与抽奖次数(`.._LOTTERY_DRAW_COUNT`)
须显式配置,绝不猜"哪个档可兑/抽几次"。

blackcat 族无专属端点(取证结论):它是本地节律规则 —— 23:00–08:00(Asia/Shanghai,
跨零点)窗口内对指定模型跑 N 次聊天补全以满足任务,窗口外跳过并报原因。补全面由
调用方注入(`chat_completion` 回调),本服务默认未接线 ⇒ 窗口内无回调 = 未判定。

鉴权/基址/错误分类全部复用 checkin_workbuddy 的既证实表面(WB_BASE token 模式 /
WB_WEB_BASE web Cookie 模式 /v2 前缀 / 401-403 回退 / workbuddy_classify_error /
checkin_outbound_gate 出站闸门),不开第二份实现(§0.6 单一真相源)。

输出契约(与兄弟席位对齐,固定不可漂移):
- 列表面:{"ok":bool,"kind":"list","tasks":[{task_code,title,progress,target,
  status,accept_status,reward_credit,reward_energy,valid_to}],"reason","unjudged"}
- 执行面:{"ok":bool,"kind":str,"accepted":[str],"claimed":[str],
  "credit_delta":int|None,"energy_delta":int|None,"reason","unjudged"}
dry_run=true ⇒ 除只读(list/status/checkin-status)外零写侧调用。
"""

from __future__ import annotations

import asyncio
import json
import random
import re
from collections.abc import Awaitable, Callable
from datetime import datetime
from typing import Any, Final
from zoneinfo import ZoneInfo

import httpx

from app.core.config import settings
from app.core.logging import get_logger
from app.services.checkin_engine import DEFAULT_TIMEOUT, client_for
from app.services.checkin_outbound import checkin_outbound_gate
from app.services.checkin_workbuddy import (
    PATH_CHECKIN_STATUS,
    PATH_WEB_CHECKIN_STATUS,
    WB_BASE,
    WB_WEB_BASE,
    workbuddy_classify_error,
    workbuddy_extract_uid,
    workbuddy_is_web_mode,
    workbuddy_query_credits,
    workbuddy_web_cookie,
    workbuddy_web_ua,
)

logger = get_logger(__name__)

_CN_TZ = ZoneInfo("Asia/Shanghai")

# ---------------------------------------------------------------------------
# 取证路径(逐字来自竞品二进制;web 模式按本家族既证 /v2 前缀形态派生)
# ---------------------------------------------------------------------------

PATH_GROWTH_TASKS: Final = "/activity/growth/tasks"
PATH_GROWTH_TASKS_ACCEPT: Final = "/activity/growth/tasks/accept"
PATH_GROWTH_STREAK: Final = "/activity/growth/streak"

PATH_TRAVEL_STATUS: Final = "/activity/growth/buddy/travel/status"
PATH_TRAVEL_DEPART: Final = "/activity/growth/buddy/travel/depart"
PATH_TRAVEL_CLAIM: Final = "/activity/growth/buddy/travel/claim"

# 族五/六 redeem / lottery 读侧路径(2026-10-31 接;真机 GET 均 200):
# lottery/summary 为抽奖概览只读端点;redeem 的兑换档位读自 streak 的 redemption_status。
PATH_GROWTH_LOTTERY_SUMMARY: Final = "/activity/growth/lottery/summary"

# 活动遥测事件码(二进制逐字;上报路径与主机绑定为推断 ⇒ 全走配置)
WB_ACTIVITY_EVENT_CODES: Final = (
    "buddyapp_show",
    "buddyapp_enter_click",
    "buddyapp_discover_click",
    "template_used",
    "agent_task_created_with_template",
    "playbook_prompt_send",
    "chat_request_send",
    "chat_message_send",
    "expert_actual_use",
    "chat_3_times",
    "school_open_day_2026",
)

# 上游信封业务码:0=成功(与 checkin_workbuddy._CODE_OK 同族语义)
_CODE_OK: Final = 0

# 聊天补全回调形态:入参 = 模型名,抛异常视为该次失败
ChatCompletion = Callable[[str], Awaitable[None]]

# 活动计分回调:入参 = 任务 code,执行使该任务达标所需的计分动作(具体事件码↔任务映射
# 由注入方持有,本模块不猜字段/映射,见 §0.3)。无异常视作已尝试计分;注入 None ⇒
# growth 跳过计分,仅按上游已 completed 态 claim(常规调度未接线时即此路径)。
ActivityReporter = Callable[[str], Awaitable[None]]

# ---------------------------------------------------------------------------
# 基础解析助手(全部宁缺勿假:取不到 ⇒ None,调用方落 unjudged)
# ---------------------------------------------------------------------------


def _as_int(val: Any) -> int | None:
    """int 严格取值:bool 不算 int(JSON true ≠ 1),float 只在整值时接受。"""
    if isinstance(val, bool):
        return None
    if isinstance(val, int):
        return val
    if isinstance(val, float) and val.is_integer():
        return int(val)
    return None


def _as_str(val: Any) -> str | None:
    if isinstance(val, str):
        return val
    if isinstance(val, (int, float)) and not isinstance(val, bool):
        return str(val)
    return None


def _webify(path: str) -> str:
    """web Cookie 模式的 /v2 前缀形态(与 PATH_WEB_DAILY_CHECKIN 同派生规则)。"""
    return "/v2" + path


def _envelope(payload: Any) -> tuple[int | None, Any]:
    """WorkBuddy 信封 {code,msg,data} 拆解。非 dict 或 code 非 int ⇒ (None, None) 未判定。"""
    if not isinstance(payload, dict):
        return None, None
    code = _as_int(payload.get("code"))
    if code is None:
        return None, None
    return code, payload.get("data")


# ---------------------------------------------------------------------------
# HTTP 核心(token/web 双模式 + 401 回退,表面复用 checkin_workbuddy 既证机制)
# ---------------------------------------------------------------------------


async def _post_once(
    url: str,
    headers: dict[str, str],
    body: dict[str, Any],
    *,
    timeout: float,
    http: httpx.AsyncClient,
    method: str = "POST",
    extra_headers: dict[str, str] | None = None,
) -> tuple[int, Any]:
    """单发。返回 (status, parsed|None);0=超时 -1=网络异常(payload=描述)。

    读侧必须是 GET —— 2026-10-28 真机实测:`/activity/growth/{tasks,streak,heatmap,
    lottery/summary,buddy/info,buddy/travel/status}` 在 WB_BASE 与 WB_WEB_BASE 两域
    GET ⇒ HTTP 200 + `code:0`,而同路径 POST ⇒ 404(对照乱路径 GET ⇒ 404
    "404 page not found",⇒ 404 是"路由不存在"的可靠标记,不是网关兜底)。
    GET 不带请求体。
    """
    if extra_headers:
        headers = {**headers, **extra_headers}
    await checkin_outbound_gate.before_request("workbuddy")
    try:
        if method == "GET":
            resp = await http.get(url, headers=headers, timeout=timeout)
        else:
            resp = await http.post(url, json=body, headers=headers, timeout=timeout)
    except httpx.TimeoutException:
        return 0, None
    except Exception as e:  # noqa: BLE001 — 与 _wb_post 同口径:异常文本上抛不炸栈
        return -1, f"{type(e).__name__}: {e}"
    checkin_outbound_gate.note_status(resp.status_code, "workbuddy")
    try:
        parsed: Any = json.loads(resp.text)
    except Exception:
        parsed = None
    return resp.status_code, parsed


async def _wb_request(
    path: str,
    jwt: str,
    device_map: dict[str, Any],
    body: dict[str, Any],
    *,
    timeout: float = DEFAULT_TIMEOUT,
    client: httpx.AsyncClient | None = None,
    absolute_url: str | None = None,
    method: str = "POST",
    extra_headers: dict[str, str] | None = None,
) -> tuple[int, Any, str]:
    """打一个任务族端点,返回 (http_status, payload, mode),mode ∈ {"token","web","url"}。

    分流规则与 checkin_workbuddy._post_with_fallback 逐字一致:
    - login_type=web 或无 Bearer ⇒ Cookie 直打 WB_WEB_BASE(/v2 前缀);
    - Bearer 优先,401/403 且存有网页 Cookie 时换 Cookie 重试一次;
    - 网络异常(0/-1)不重试(重试只放大故障);
    - absolute_url(活动遥测主机推断面)命中时跳过双模式分流,直打该 URL,
      鉴权头仍按模式给。
    """
    http = client if client is not None else client_for(device_map)[0]
    token = (jwt or "").strip()
    web_cookie = workbuddy_web_cookie(jwt, device_map)

    def _token_headers() -> dict[str, str]:
        return {
            "accept": "application/json",
            "content-type": "application/json",
            "user-agent": "WorkBuddy/checkin",
            "authorization": f"Bearer {token}",
        }

    def _web_headers() -> dict[str, str]:
        return {
            "accept": "application/json",
            "content-type": "application/json",
            "user-agent": workbuddy_web_ua(device_map),
            "cookie": web_cookie or token,
        }

    if absolute_url is not None:
        headers = _web_headers() if (web_cookie and workbuddy_is_web_mode(device_map)) else _token_headers()
        status, payload = await _post_once(
            absolute_url, headers, body, timeout=timeout, http=http, method=method,
            extra_headers=extra_headers,
        )
        return status, payload, "url"

    if workbuddy_is_web_mode(device_map) or not token:
        status, payload = await _post_once(
            WB_WEB_BASE.rstrip("/") + _webify(path),
            _web_headers(),
            body,
            timeout=timeout,
            http=http,
            method=method,
            extra_headers=extra_headers,
        )
        return status, payload, "web"

    status, payload = await _post_once(
        WB_BASE.rstrip("/") + path,
        _token_headers(),
        body,
        timeout=timeout,
        http=http,
        method=method,
        extra_headers=extra_headers,
    )
    if status in (401, 403) and web_cookie:
        status2, payload2 = await _post_once(
            WB_WEB_BASE.rstrip("/") + _webify(path),
            _web_headers(),
            body,
            timeout=timeout,
            http=http,
            method=method,
            extra_headers=extra_headers,
        )
        if status2 not in (0, -1):
            return status2, payload2, "web"
    return status, payload, "token"


def _failure_reason(status: int, payload: Any, mode: str) -> str | None:
    """把 (status,payload) 翻译成可读失败原因;None = 不是失败(继续按信封判)。"""
    if status == 0:
        return "网络异常(超时)"
    if status == -1:
        return f"网络异常: {payload}"
    if status in (401, 403):
        etype, _ = workbuddy_classify_error(status)
        suffix = "会话/令牌已失效,请重新登录态采集" if etype == "SessionDead" else f"HTTP {status}"
        return suffix
    if status >= 400:
        return f"HTTP {status}"
    return None


# ---------------------------------------------------------------------------
# 任务行解析(合同行形状 = task_code/title/progress/target/status/accept_status/
# reward_credit/reward_energy/valid_to;任一必解析字段读不懂 ⇒ 该行整行弃 + unjudged)
# ---------------------------------------------------------------------------


def parse_task_row(raw: Any) -> tuple[dict[str, Any] | None, bool]:
    """单行解析。返回 (合同行|None, 是否读懂)。

    判据按 2026-10-28 真机 GET 实测形态(非竞品二进制字段表):
    `{"tasks":[{"task_id":1,"code":"first_chat","title":"完成一次对话",
      "description":"…","icon_url":"","level_name":"养虾尝试","status":"available","url":""}]}`
    —— 读懂 = `code`(兼容旧取证名 task_code)与 title(兼容 task_desc/description)
    与 status 三者齐。真形态**根本没有** progress/target/accept_status/reward_*/valid_to
    这五族字段 ⇒ 一律 None,不拿 0 冒充"没量到"(§0.3);旧实现"缺字段按 0"会把
    "上游没给奖励字段"说成"奖励为 0",是假账。
    """
    if not isinstance(raw, dict):
        return None, False
    code = _as_str(raw.get("code")) or _as_str(raw.get("task_code"))
    title = _as_str(raw.get("title")) or _as_str(raw.get("task_desc")) or _as_str(
        raw.get("description")
    )
    status = _as_str(raw.get("status"))
    if code is None or title is None or status is None:
        return None, False
    progress = _as_int(raw.get("progress"))
    target = _as_int(raw.get("limit_num")) or _as_int(raw.get("target"))
    return (
        {
            "task_code": code,
            "title": title,
            "progress": progress,
            "target": target,
            "status": status,
            "accept_status": _as_str(raw.get("accept_status")),
            "reward_credit": _as_int(raw.get("reward_credit")),
            "reward_energy": _as_int(raw.get("reward_energy")),
            "valid_to": (
                raw.get("valid_to") if isinstance(raw.get("valid_to"), str) else None
            ),
        },
        True,
    )


def _extract_rows(data: Any) -> list[dict[str, Any]] | None:
    """从信封 data 里取任务数组:直接 list,或 dict 的 tasks/list/items 键。全不符 ⇒ None。"""
    if isinstance(data, list):
        return [r for r in data if isinstance(r, dict)] if all(isinstance(r, dict) for r in data) else None
    if isinstance(data, dict):
        for key in ("tasks", "list", "items"):
            val = data.get(key)
            if isinstance(val, list) and all(isinstance(r, dict) for r in val):
                return val
    return None


# ---------------------------------------------------------------------------
# 结果构造器(固定合同形)
# ---------------------------------------------------------------------------


def _list_result(
    tasks: list[dict[str, Any]], reason: str | None, unjudged: bool, ok: bool
) -> dict[str, Any]:
    return {"ok": ok, "kind": "list", "tasks": tasks, "reason": reason, "unjudged": unjudged}


def _run_result(
    kind: str,
    *,
    ok: bool,
    accepted: list[str] | None = None,
    claimed: list[str] | None = None,
    credit_delta: int | None = None,
    energy_delta: int | None = None,
    reason: str | None = None,
    unjudged: bool = False,
) -> dict[str, Any]:
    return {
        "ok": ok,
        "kind": kind,
        "accepted": accepted or [],
        "claimed": claimed or [],
        "credit_delta": credit_delta,
        "energy_delta": energy_delta,
        "reason": reason,
        "unjudged": unjudged,
    }


# ---------------------------------------------------------------------------
# 列表(只读)
# ---------------------------------------------------------------------------


async def list_growth_tasks(
    jwt: str,
    device_map: dict[str, Any],
    *,
    client: httpx.AsyncClient | None = None,
    timeout: float = DEFAULT_TIMEOUT,
) -> dict[str, Any]:
    """拉取 growth 任务列表(GET 只读)⇒ 列表面合同。"""
    status, payload, _mode = await _wb_request(
        PATH_GROWTH_TASKS, jwt, device_map, {}, client=client, timeout=timeout, method="GET"
    )
    fail = _failure_reason(status, payload, _mode)
    if fail is not None:
        return _list_result([], fail, True, False)
    code, data = _envelope(payload)
    if code is None:
        return _list_result([], f"信封不可解析(HTTP {status},响应缺 code 或非 JSON)", True, False)
    if code != _CODE_OK:
        return _list_result([], f"上游 code={code} 非成功码", False, False)
    rows = _extract_rows(data)
    if rows is None:
        return _list_result([], "任务数组形态未识别(data 既非数组也无 tasks/list/items)", True, False)
    tasks: list[dict[str, Any]] = []
    dropped = 0
    for raw in rows:
        row, understood = parse_task_row(raw)
        if row is not None and understood:
            tasks.append(row)
        else:
            dropped += 1
    unjudged = dropped > 0
    reason = f"{dropped} 行任务字段形态读不懂,已丢弃未猜值" if dropped else None
    return _list_result(tasks, reason, unjudged, True)


async def fetch_growth_streak(
    jwt: str,
    device_map: dict[str, Any],
    *,
    client: httpx.AsyncClient | None = None,
    timeout: float = DEFAULT_TIMEOUT,
) -> dict[str, Any] | None:
    """连签状态只读探针(GET)。任一必读不到 ⇒ None,不编造。

    2026-10-28 真机实测形态(旧实现按顶层 streak/days/tier 平铺取,而真形态是嵌套对象,
    于是永远返回 None —— 这条就是那个 bug 的修正):
    `{"streak":{"days":2,"month_total_days":2,"next_tier":"7d","next_tier_remaining":5,
      "makeup_dates":[]},"makeup_cards":{"balance":0,"max":4},
      "redemption_status":{"tiers":[{"tier":"7d","days":7,"credit":0,"energy":2,
      "cards":1,"chances":1},…],"tier_7d_status":"locked",…},
      "timezone":"Asia/Shanghai","launch_date":"2026-06-17"}`
    """
    status, payload, _mode = await _wb_request(
        PATH_GROWTH_STREAK, jwt, device_map, {}, client=client, timeout=timeout, method="GET"
    )
    if _failure_reason(status, payload, _mode) is not None:
        return None
    code, data = _envelope(payload)
    if code != _CODE_OK or not isinstance(data, dict):
        return None
    streak = data.get("streak")
    if not isinstance(streak, dict):
        return None
    out: dict[str, Any] = {}
    for key in ("days", "month_total_days", "next_tier_remaining"):
        out[key] = _as_int(streak.get(key))
    out["next_tier"] = _as_str(streak.get("next_tier"))
    cards = data.get("makeup_cards")
    if isinstance(cards, dict):
        out["makeup_card_balance"] = _as_int(cards.get("balance"))
        out["makeup_card_max"] = _as_int(cards.get("max"))
    tiers = data.get("redemption_status")
    if isinstance(tiers, dict) and isinstance(tiers.get("tiers"), list):
        out["tiers"] = len(tiers["tiers"])
    return out or None


async def _measure_balance(
    jwt: str,
    device_map: dict[str, Any],
    client: httpx.AsyncClient | None,
    timeout: float,
) -> int | None:
    """余额探针(checkin-status 只读)。取不到返回 None(不冒充 0)。"""
    try:
        probe = await workbuddy_query_credits(jwt, device_map, timeout=timeout, client=client)
    except Exception as e:  # noqa: BLE001 — 探针异常同样算取不到
        logger.warning("[workbuddy_tasks] 余额探针异常: %s", e)
        return None
    rem = probe.get("remaining")
    return rem if isinstance(rem, int) and not isinstance(rem, bool) else None


# ---------------------------------------------------------------------------
# 族一:growth(列 → 分类 → accept / claim)
# ---------------------------------------------------------------------------


def _status_set(spec: str) -> frozenset[str]:
    return frozenset(s.strip() for s in spec.split(",") if s.strip())


def classify_growth_tasks(tasks: list[dict[str, Any]]) -> tuple[list[str], list[str]]:
    """纯函数分类。返回 (待 accept 的 code, 可 claim 的 code)。

    判据按 2026-10-28 真机形态重定:列表行只有 `status`(实测值 `available`),
    旧判据(`accept_status == "0"` / `progress >= target`)在真数据上**恒不成立** ⇒
    整族永远 0 项,看起来像"没任务可做",实际是尺子读不到字段。

    2026-10-31 补强:真实任务完成态不暴露 progress/target(审计字段恒 None),
    故新增 `WORKBUDDY_TASKS_CLAIMABLE_STATUSES`(默认 `completed`)作为 claim 判定面 ——
    上报计分后任务 status 流转到 claimable 集即触发领取,与 workbuddy2api 的
    "达标即自动领奖"同语义。progress>=target 仍作兜底(上游若补字段自动生效)。
    - claim:status ∈ claimable 集,或 progress>=target;
    - accept:status ∈ actionable 集(默认 `available`)且未达 claimable。
    """
    action_set = _status_set(settings.workbuddy_tasks_actionable_statuses)
    claimable_set = _status_set(settings.workbuddy_tasks_claimable_statuses)
    to_accept: list[str] = []
    to_claim: list[str] = []
    for t in tasks:
        code = str(t.get("task_code") or "")
        if not code:
            continue
        status = str(t.get("status") or "")
        progress, target = t.get("progress"), t.get("target")
        if status in claimable_set:
            to_claim.append(code)
            continue
        if (
            isinstance(progress, int)
            and isinstance(target, int)
            and not isinstance(progress, bool)
            and target > 0
            and progress >= target
        ):
            to_claim.append(code)
        elif status in action_set:
            to_accept.append(code)
    return to_accept, to_claim


def order_accounts_by_credit_urgency(
    items: list[tuple[str, int | None]], mode: str
) -> list[str]:
    """纯函数:按积分紧迫度排任务中心巡检账号顺序(与兄弟席位同口径,固定不可漂移)。

    items = [(account_id, balance_or_None), ...];mode ∈ {lowest_balance, highest_balance}。
    - lowest_balance(默认紧迫语义):余额越低越先跑 —— 优先给"积分快枯竭"的号补分;
    - highest_balance:余额越高越先跑 —— 优先消耗高产号的额度。
    取不到余额(None)排最后(§0.3 不冒充 0,也不阻塞整轮);同值保持稳定序。
    mode 非二者 ⇒ 原序返回(调用方只在显式开启时传合法值)。
    """
    if mode not in ("lowest_balance", "highest_balance"):
        return [a for a, _ in items]
    if mode == "highest_balance":
        return [a for a, _ in sorted(items, key=lambda x: (x[1] is None, -(x[1] or 0)))]
    return [a for a, _ in sorted(items, key=lambda x: (x[1] is None, x[1] or 0))]


async def _claim_one_web(
    jwt: str,
    device_map: dict[str, Any],
    code_item: str,
    client: httpx.AsyncClient,
    timeout: float,
) -> tuple[bool, str, bool]:
    """单任务领奖:强制走 Web 域(www.workbuddy.cn)+ /v2 前缀 + `x-client-platform: web`。

    2026-10-31 据 workbuddy2api README 补证:claim **只在 Web 域 + 该头成功**
    (原文「非 CLI 域——这是领奖能成功的关键」)。故不复用 `_wb_request` 的 token/web
    自动分流(令牌域会 404/401),直接打 `WB_WEB_BASE + _webify(模板)`。
    返回 (ok, 原因, 是否网络失败):网络失败 ⇒ 调用方置 unjudged;会话/业务失败 ⇒ 不误判。
    """
    claim_path_tmpl = (settings.workbuddy_tasks_claim_path or "").strip()
    if not claim_path_tmpl:
        return False, "claim 路径未配置(§0.3 拒绝猜 URL)", False
    if "{code}" not in claim_path_tmpl:
        return False, "claim 路径模板缺 {code} 占位符", False
    rel = claim_path_tmpl.format(code=code_item)
    url = WB_WEB_BASE.rstrip("/") + _webify(rel)
    web_cookie = workbuddy_web_cookie(jwt, device_map)
    if not web_cookie:
        return (
            False,
            "claim 仅 Web 域 + x-client-platform:web 可用,本账号无 web_cookie(需网页登录态)⇒ 跳过",
            False,
        )
    headers = {
        "accept": "application/json",
        "content-type": "application/json",
        "user-agent": workbuddy_web_ua(device_map),
        "cookie": web_cookie,
        "x-client-platform": "web",
    }
    status, payload = await _post_once(
        url, headers, {}, timeout=timeout, http=client, method="POST"
    )
    if status in (0, -1):
        return False, "网络异常" if status == 0 else f"网络异常:{payload}", True
    if status in (401, 403):
        return False, f"HTTP {status}(Web 域会话失效,请重抽网页 Cookie)", False
    if status >= 400:
        return False, f"HTTP {status}", False
    code, _data = _envelope(payload)
    if code is None:
        return False, "信封不可解析", False
    if code == _CODE_OK:
        return True, "", False
    return False, f"上游 code={code}", False


async def run_growth(
    jwt: str,
    device_map: dict[str, Any],
    *,
    dry_run: bool = False,
    client: httpx.AsyncClient | None = None,
    timeout: float = DEFAULT_TIMEOUT,
    activity_reporter: ActivityReporter | None = None,
) -> dict[str, Any]:
    """growth 族执行:列表(读)→ [上报计分]→ accept(写)→ claim(写,仅路径已配置时)→ 余额差量。

    activity_reporter: 可选注入(调度器接 run_activity),用于为本轮待做任务补计分事件,
    再重新拉列表判定有无因上报而达标可领的任务(与 workbuddy2api "上报→达标→领奖"同语义)。
    """
    eff_client, owned = (client, False) if client is not None else client_for(device_map)
    try:
        return await _run_growth_inner(
            jwt, device_map, dry_run, eff_client, timeout, activity_reporter=activity_reporter
        )
    finally:
        if owned:
            await eff_client.aclose()


async def _run_growth_inner(
    jwt: str,
    device_map: dict[str, Any],
    dry_run: bool,
    client: httpx.AsyncClient,
    timeout: float,
    activity_reporter: ActivityReporter | None = None,
) -> dict[str, Any]:
    # dry-run ⇒ 只打 list(读);余额探针虽也是读面,但合同把 dry-run 的读面收窄到
    # list/status,探针仅实跑档发。
    before = None if dry_run else await _measure_balance(jwt, device_map, client, timeout)
    lst = await list_growth_tasks(jwt, device_map, client=client, timeout=timeout)
    if not lst["ok"]:
        return _run_result(
            "growth",
            ok=False,
            credit_delta=None,
            reason=lst["reason"],
            unjudged=bool(lst["unjudged"]),
        )
    to_accept, to_claim = classify_growth_tasks(lst["tasks"])
    if dry_run:
        return _run_result(
            "growth",
            ok=True,
            reason=f"dry-run:待 accept {len(to_accept)} 项、可 claim {len(to_claim)} 项,零写侧调用",
            unjudged=False,
        )
    accepted: list[str] = []
    claimed: list[str] = []
    reasons: list[str] = []
    unjudged = False

    # 上报→重判→claim 闭环(与 workbuddy2api "上报→达标→领奖"同语义):若注入了活动计分
    # 回调,先为本轮 to_accept 任务补计分事件,再重新拉列表判定有无因上报而达标、进入
    # claimable 集的任务。回调为 None ⇒ 跳过(§0.3 不假造 task_code↔event_code 映射,
    # 也不空转刷次数);常规调度未接线时 growth 仅按上游已 completed 态 claim。
    if activity_reporter is not None and to_accept:
        scored = 0
        for code_item in to_accept:
            try:
                await activity_reporter(code_item)
                scored += 1
            except Exception as e:  # noqa: BLE001 — 单任务计分失败不中断整轮
                logger.warning("[workbuddy_tasks] growth 计分回调异常 task=%s: %s", code_item, e)
                unjudged = True
        if scored:
            await asyncio.sleep(random.uniform(0.5, 2.0))
            lst2 = await list_growth_tasks(jwt, device_map, client=client, timeout=timeout)
            if lst2["ok"]:
                to_accept, to_claim2 = classify_growth_tasks(lst2["tasks"])
                to_claim = list(dict.fromkeys(to_claim + to_claim2))
                reasons.append(
                    f"计分 {scored} 项后重判:待 accept {len(to_accept)} / 可 claim {len(to_claim)}"
                )
            else:
                reasons.append(f"计分后重列失败:{lst2['reason']}")
                unjudged = True

    accept_field = (settings.workbuddy_tasks_accept_field or "").strip()
    if to_accept:
        if not accept_field:
            reasons.append(
                f"accept {len(to_accept)} 项未执行:请求体字段名未判定 —— 2026-10-28 真机对 "
                '`{}` / `{"code":…}` / `{"task_code":…}` / `{"codes":[…]}` 四种形态一律 '
                '400 "invalid request"(路由在、鉴权过,只是 body 不对);'
                "配 WORKBUDDY_TASKS_ACCEPT_FIELD 后才发(§0.3 拒绝猜字段)"
            )
            unjudged = True
        else:
            status, payload, mode = await _wb_request(
                PATH_GROWTH_TASKS_ACCEPT,
                jwt,
                device_map,
                {accept_field: to_accept},
                client=client,
                timeout=timeout,
            )
            fail = _failure_reason(status, payload, mode)
            if fail is not None:
                reasons.append(f"accept {fail}")
                unjudged = status in (0, -1) or not isinstance(payload, dict)
            else:
                code, _data = _envelope(payload)
                if code is None:
                    reasons.append("accept 信封不可解析")
                    unjudged = True
                elif code == _CODE_OK:
                    accepted = list(to_accept)
                else:
                    reasons.append(f"accept 上游 code={code}")
    claim_path_tmpl = (settings.workbuddy_tasks_claim_path or "").strip()
    if to_claim:
        if not claim_path_tmpl:
            reasons.append(
                f"claim {len(to_claim)} 项未执行:claim 路径未配置"
                "(WORKBUDDY_TASKS_CLAIM_PATH 留空 ⇒ 按 §0.3 拒绝猜 URL)"
            )
        else:
            for code_item in to_claim:
                ok_claim, why, is_net = await _claim_one_web(
                    jwt, device_map, code_item, client, timeout
                )
                if ok_claim:
                    claimed.append(code_item)
                else:
                    reasons.append(f"claim {code_item} 失败({why})")
                    unjudged = unjudged or is_net
    streak = await fetch_growth_streak(jwt, device_map, client=client, timeout=timeout)
    if isinstance(streak, dict) and streak.get("days") is not None:
        reasons.append(f"streak_days={streak['days']}")
    after = await _measure_balance(jwt, device_map, client, timeout)
    credit_delta = after - before if before is not None and after is not None else None
    if credit_delta is None and not reasons:
        reasons.append("余额差量不可测(前后至少一次探针失败),不冒充 0")
    ok = bool(accepted or claimed) or (not to_accept and not to_claim)
    return _run_result(
        "growth",
        ok=ok,
        accepted=accepted,
        claimed=claimed,
        credit_delta=credit_delta,
        reason=";".join(reasons) if reasons else None,
        unjudged=unjudged,
    )


# ---------------------------------------------------------------------------
# 族二:travel(depart / status / claim)
# ---------------------------------------------------------------------------


def parse_travel_state(data: Any) -> dict[str, Any] | None:
    """TravelState 解析;读不懂 ⇒ None。

    2026-10-28 真机 GET `/activity/growth/buddy/travel/status` 实测形态(旧判据要求的
    `status/remain/energy/credit` 四件套真形态里并不存在 ⇒ 永远 None、永远未判定):
    `{"state":"idle","buddy_id":0,"record_id":0,"location":null,"depart_at":0,
      "arrive_at":0,"server_now":1793201004,"letter":null,"use_deeplink":"",
      "daily_limit_reached":true,"duration_hours":0,"reward_credit":0}`
    必读只有 `state`(字符串);其余按需取,**缺的能量字段留 None 不冒充 0**。
    """
    if not isinstance(data, dict):
        return None
    state = _as_str(data.get("state"))
    if state is None:
        return None
    out: dict[str, Any] = {"state": state}
    for key in ("buddy_id", "record_id", "depart_at", "arrive_at", "duration_hours", "reward_credit"):
        out[key] = _as_int(data.get(key))
    limit = data.get("daily_limit_reached")
    out["daily_limit_reached"] = limit if isinstance(limit, bool) else None
    return out


async def run_travel(
    jwt: str,
    device_map: dict[str, Any],
    *,
    dry_run: bool = False,
    client: httpx.AsyncClient | None = None,
    timeout: float = DEFAULT_TIMEOUT,
) -> dict[str, Any]:
    """travel 族:status(读)→ 有待发奖励则 claim;出发态由配置集决定(默认不出发)。"""
    eff_client, owned = (client, False) if client is not None else client_for(device_map)
    try:
        return await _run_travel_inner(jwt, device_map, dry_run, eff_client, timeout)
    finally:
        if owned:
            await eff_client.aclose()


async def _run_travel_inner(
    jwt: str,
    device_map: dict[str, Any],
    dry_run: bool,
    client: httpx.AsyncClient,
    timeout: float,
) -> dict[str, Any]:
    status, payload, mode = await _wb_request(
        PATH_TRAVEL_STATUS, jwt, device_map, {}, client=client, timeout=timeout, method="GET"
    )
    fail = _failure_reason(status, payload, mode)
    if fail is not None:
        return _run_result("travel", ok=False, reason=fail, unjudged=True)
    code, data = _envelope(payload)
    if code is None:
        return _run_result("travel", ok=False, reason=f"travel/status 信封不可解析(HTTP {status})", unjudged=True)
    if code != _CODE_OK:
        return _run_result("travel", ok=False, reason=f"travel/status 上游 code={code}", unjudged=False)
    state = parse_travel_state(data)
    if state is None:
        return _run_result(
            "travel", ok=False, reason="TravelState 形态读不懂(真形态必读字段 state 取不到)", unjudged=True
        )
    pending_credit = state["reward_credit"]
    # 真形态里没有 energy 字段(2026-10-28 实测)⇒ 一律 None,不拿 0 冒充"没有体力奖励"。
    pending_energy: int | None = None
    if dry_run:
        return _run_result(
            "travel",
            ok=True,
            reason=(
                f"dry-run:state={state['state']} 待发 credit={pending_credit} "
                f"energy=未取证 daily_limit_reached={state['daily_limit_reached']},零写侧调用"
            ),
            unjudged=pending_credit is None,
        )
    reasons: list[str] = []
    claimed: list[str] = []
    accepted: list[str] = []
    unjudged = False
    credit_delta: int | None = None
    energy_delta: int | None = None
    if pending_credit is None:
        reasons.append(
            "travel/claim 未执行:真形态 reward_credit 读不到 ⇒ 判不出有无待发奖励(§0.3 不猜)"
        )
        unjudged = True
    elif pending_credit > 0:
        c_status, c_payload, c_mode = await _wb_request(
            PATH_TRAVEL_CLAIM, jwt, device_map, {}, client=client, timeout=timeout
        )
        c_fail = _failure_reason(c_status, c_payload, c_mode)
        if c_fail is not None:
            reasons.append(f"travel/claim {c_fail}")
            unjudged = True
        else:
            c_code, _c_data = _envelope(c_payload)
            if c_code is None:
                reasons.append("travel/claim 信封不可解析")
                unjudged = True
            elif c_code == _CODE_OK:
                claimed.append("travel")
                credit_delta = pending_credit
                energy_delta = pending_energy
            else:
                reasons.append(f"travel/claim 上游 code={c_code}")
    else:
        depart_states = _status_set(settings.workbuddy_tasks_travel_depart_states)
        if not depart_states:
            reasons.append("出发触发态未取证且未配置 ⇒ 本轮不出发(拒绝猜 state 值域)")
        elif state["state"] in depart_states:
            d_status, d_payload, d_mode = await _wb_request(
                PATH_TRAVEL_DEPART, jwt, device_map, {}, client=client, timeout=timeout
            )
            if _failure_reason(d_status, d_payload, d_mode) is not None:
                reasons.append("travel/depart 网络/HTTP 失败")
                unjudged = True
            else:
                d_code, _d_data = _envelope(d_payload)
                if d_code == _CODE_OK:
                    accepted.append("travel-depart")
                else:
                    reasons.append(f"travel/depart 上游 code={d_code}")
    ok = bool(claimed or accepted)
    return _run_result(
        "travel",
        ok=ok or (not unjudged and bool(reasons)),
        accepted=accepted,
        claimed=claimed,
        credit_delta=credit_delta,
        energy_delta=energy_delta,
        reason=";".join(reasons) if reasons else None,
        unjudged=unjudged,
    )


# ---------------------------------------------------------------------------
# 族三:activity(遥测事件上报;真聊天腿不在本服务)
# ---------------------------------------------------------------------------


def _activity_hosts_map() -> tuple[dict[str, str] | None, str | None]:
    raw = (settings.workbuddy_tasks_activity_hosts or "").strip()
    if not raw:
        return {}, None
    try:
        loaded = json.loads(raw)
    except ValueError:
        return None, "WORKBUDDY_TASKS_ACTIVITY_HOSTS 不是合法 JSON"
    if not isinstance(loaded, dict) or not all(
        isinstance(k, str) and isinstance(v, str) for k, v in loaded.items()
    ):
        return None, "WORKBUDDY_TASKS_ACTIVITY_HOSTS 须为 {str: str} JSON"
    return {k: v.rstrip("/") for k, v in loaded.items()}, None


async def run_activity(
    jwt: str,
    device_map: dict[str, Any],
    *,
    dry_run: bool = False,
    events: tuple[str, ...] = WB_ACTIVITY_EVENT_CODES,
    client: httpx.AsyncClient | None = None,
    timeout: float = DEFAULT_TIMEOUT,
) -> dict[str, Any]:
    """activity 族:逐事件码 POST 上报。

    上报路径未取证 ⇒ WORKBUDDY_TASKS_ACTIVITY_PATH 留空时**拒绝执行**(未判定),
    与 §0.3 同口径;"真聊天"腿属客户端面,本服务只覆盖遥测面 —— 写进 reason。
    """
    eff_client, owned = (client, False) if client is not None else client_for(device_map)
    try:
        path = (settings.workbuddy_tasks_activity_path or "").strip()
        hosts, hosts_err = _activity_hosts_map()
        if dry_run:
            return _run_result(
                "activity",
                ok=True,
                reason=(
                    f"dry-run:事件码 {len(events)} 枚在册,上报路径="
                    f"{path or '(未配置)'};真聊天腿不在本服务,零写侧调用"
                ),
                unjudged=False,
            )
        if hosts_err is not None:
            return _run_result("activity", ok=False, reason=hosts_err, unjudged=True)
        if not path or hosts is None:
            return _run_result(
                "activity",
                ok=False,
                reason=(
                    "活动遥测的 路径↔主机 绑定是二进制推断、未真机取证;"
                    "WORKBUDDY_TASKS_ACTIVITY_PATH 未配置 ⇒ 拒绝猜端点(§0.3)"
                ),
                unjudged=True,
            )
        assert hosts is not None
        sent: list[str] = []
        reasons: list[str] = []
        unjudged = False
        web_ctx = workbuddy_is_web_mode(device_map)
        uid = workbuddy_extract_uid(jwt)
        for event_code in events:
            base = hosts.get(event_code) or hosts.get("default") or WB_BASE
            if web_ctx and base == WB_BASE:
                base = WB_WEB_BASE
            # activity_path 配置已是完整端点(/v2/report),不再叠 /v2(原 _webify 会双前缀,已修);
            # Web 域事件带 x-client-platform: web 指纹头(README 实证 web 域需要,与 claim 同源)。
            url_path = path
            extra: dict[str, str] | None = {"x-client-platform": "web"} if base == WB_WEB_BASE else None
            body = {"event_code": event_code}
            if uid:
                body["user_id"] = uid
            status, payload, mode = await _wb_request(
                path,
                jwt,
                device_map,
                body,
                client=eff_client,
                timeout=timeout,
                absolute_url=base + url_path,
                extra_headers=extra,
            )
            if _failure_reason(status, payload, mode) is not None:
                reasons.append(f"{event_code}:{status}")
                unjudged = True
                continue
            code, _data = _envelope(payload)
            if code is None:
                reasons.append(f"{event_code}:信封不可解析")
                unjudged = True
            elif code == _CODE_OK:
                sent.append(event_code)
            else:
                reasons.append(f"{event_code}:code={code}")
            if len(events) > 1:
                await asyncio.sleep(random.uniform(0.5, 2.0))
        return _run_result(
            "activity",
            ok=bool(sent),
            reason=";".join(reasons) if reasons else None,
            unjudged=unjudged,
        )
    finally:
        if owned:
            await eff_client.aclose()


# ---------------------------------------------------------------------------
# 族四:blackcat(本地节律规则,无专属端点)
# ---------------------------------------------------------------------------

_WINDOW_RE: Final = re.compile(r"^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$")


def parse_blackcat_window(spec: str) -> tuple[int, int, int, int] | None:
    """解析 "HH:MM-HH:MM";非法 ⇒ None(未判定,不回落默认窗口)。"""
    m = _WINDOW_RE.match((spec or "").strip())
    if not m:
        return None
    h1, m1, h2, m2 = (int(g) for g in m.groups())
    if h1 > 23 or h2 > 23 or m1 > 59 or m2 > 59:
        return None
    if (h1, m1) == (h2, m2):
        return None
    return h1, m1, h2, m2


def blackcat_window_active(spec: str, now: datetime | None = None) -> bool | None:
    """23:00–08:00 跨零点窗口判据(Asia/Shanghai)。

    返回 True/False;配置非法 ⇒ None(未判定)。跨零点形态(start>end)= 取反区间。
    """
    parsed = parse_blackcat_window(spec)
    if parsed is None:
        return None
    h1, m1, h2, m2 = parsed
    local = (now or datetime.now(_CN_TZ)).astimezone(_CN_TZ)
    minutes = local.hour * 60 + local.minute
    start = h1 * 60 + m1
    end = h2 * 60 + m2
    if start < end:
        return start <= minutes < end
    return minutes >= start or minutes < end


async def run_blackcat(
    jwt: str,
    device_map: dict[str, Any],
    *,
    dry_run: bool = False,
    chat_completion: ChatCompletion | None = None,
    now: datetime | None = None,
    client: httpx.AsyncClient | None = None,
    timeout: float = DEFAULT_TIMEOUT,
) -> dict[str, Any]:
    """blackcat 族:窗口内对指定模型跑 N 次聊天补全;窗口外跳过并报原因(取证结论:
    该族无专属上游端点,是纯节律规则)。补全面由调用方注入;未注入 ⇒ 未判定。"""
    spec = settings.workbuddy_tasks_blackcat_window
    active = blackcat_window_active(spec, now)
    if active is None:
        return _run_result(
            "blackcat", ok=False, reason=f"blackcat 窗口配置非法:{spec!r}", unjudged=True
        )
    if not active:
        local = (now or datetime.now(_CN_TZ)).astimezone(_CN_TZ)
        return _run_result(
            "blackcat",
            ok=True,
            reason=(
                f"跳过:当前 {local:%H:%M} 不在 blackcat 窗口 {spec}(Asia/Shanghai)内,零调用"
            ),
            unjudged=False,
        )
    model = (settings.workbuddy_tasks_blackcat_model or "").strip()
    if not model:
        return _run_result(
            "blackcat", ok=False, reason="窗口内但 WORKBUDDY_TASKS_BLACKCAT_MODEL 未配置 ⇒ 未判定", unjudged=True
        )
    count = max(0, int(settings.workbuddy_tasks_blackcat_count))
    if dry_run:
        return _run_result(
            "blackcat",
            ok=True,
            reason=f"dry-run:窗口内,应跑 {count} 次补全(模型 {model}),零调用",
            unjudged=False,
        )
    if chat_completion is None:
        return _run_result(
            "blackcat",
            ok=False,
            reason=(
                f"窗口内、模型={model}、N={count},但聊天补全面未接线 ⇒ 未判定"
                "(黑猫族需真实会话上游,拒绝空转刷次数)"
            ),
            unjudged=True,
        )
    done = 0
    failed = 0
    for _ in range(count):
        try:
            await chat_completion(model)
            done += 1
        except Exception as e:  # noqa: BLE001 — 单次补全失败记录后继续
            logger.warning("[workbuddy_tasks] blackcat 补全失败: %s", e)
            failed += 1
        if count > 1:
            await asyncio.sleep(random.uniform(1.0, 4.0))
    reasons = [f"blackcat 补全 {done}/{count}"]
    if failed:
        reasons.append(f"失败 {failed} 次")
    return _run_result(
        "blackcat", ok=done > 0, reason=";".join(reasons), unjudged=False
    )


# ---------------------------------------------------------------------------
# 族五:redeem(连签兑换;读 redemption_status,写侧 body 字段未取证 ⇒ 默认拒绝写)
# ---------------------------------------------------------------------------


async def fetch_redeem_tiers(
    jwt: str,
    device_map: dict[str, Any],
    *,
    client: httpx.AsyncClient | None = None,
    timeout: float = DEFAULT_TIMEOUT,
) -> dict[str, Any] | None:
    """只读:GET streak 取 redemption_status(真机形态见 fetch_growth_streak)。

    返回 {"tiers": [...], "status": {...}};读不到 redemption_status ⇒ None(不编造)。
    tiers[] 真形态项形如 {tier, days, credit, energy, cards, chances}。
    """
    status, payload, _mode = await _wb_request(
        PATH_GROWTH_STREAK, jwt, device_map, {}, client=client, timeout=timeout, method="GET"
    )
    if _failure_reason(status, payload, _mode) is not None:
        return None
    code, data = _envelope(payload)
    if code != _CODE_OK or not isinstance(data, dict):
        return None
    rs = data.get("redemption_status")
    if not isinstance(rs, dict):
        return None
    tiers = rs.get("tiers")
    return {"tiers": tiers if isinstance(tiers, list) else [], "status": rs}


async def run_redeem(
    jwt: str,
    device_map: dict[str, Any],
    *,
    dry_run: bool = False,
    client: httpx.AsyncClient | None = None,
    timeout: float = DEFAULT_TIMEOUT,
) -> dict[str, Any]:
    """redeem 族:连签兑换。读 redemption_status 列档(只读);写侧端点路由存在但 body
    字段名未取证(2026-10-28 真机 {} / {"code"} / {"task_code"} / {"codes"} 四形态全 400)⇒
    WORKBUDDY_TASKS_REDEEM_FIELD 留空即拒绝执行(§0.3 不猜字段);兑换档位由
    WORKBUDDY_TASKS_REDEEM_TIERS 显式指定(空 = 只读不写,绝不猜哪个档可兑)。"""
    eff_client, owned = (client, False) if client is not None else client_for(device_map)
    try:
        info = await fetch_redeem_tiers(jwt, device_map, client=eff_client, timeout=timeout)
        if info is None:
            return _run_result(
                "redeem", ok=False, reason="redemption_status 读不到(未判定)", unjudged=True
            )
        tiers = info["tiers"]
        names = [
            str(t.get("tier"))
            for t in tiers
            if isinstance(t, dict) and t.get("tier") is not None
        ]
        if dry_run:
            return _run_result(
                "redeem",
                ok=True,
                reason=(
                    f"dry-run:redemption 档位 {len(tiers)} 个"
                    f"({','.join(names) or '无'}),零写侧调用"
                ),
                unjudged=False,
            )
        targets = [
            t.strip()
            for t in (settings.workbuddy_tasks_redeem_tiers or "").split(",")
            if t.strip()
        ]
        if not targets:
            return _run_result(
                "redeem",
                ok=True,
                reason=(
                    f"redemption 档位 {len(tiers)} 个;未配 WORKBUDDY_TASKS_REDEEM_TIERS "
                    "⇒ 只读不写(不猜哪个档可兑)"
                ),
                unjudged=False,
            )
        field = (settings.workbuddy_tasks_redeem_field or "").strip()
        path = (settings.workbuddy_tasks_redeem_path or "").strip()
        if not field:
            return _run_result(
                "redeem",
                ok=False,
                reason=(
                    f"redeem {len(targets)} 档未执行:body 字段名未取证(2026-10-28 四形态全 400)"
                    "⇒ WORKBUDDY_TASKS_REDEEM_FIELD 留空按 §0.3 拒绝猜字段"
                ),
                unjudged=True,
            )
        if not path:
            return _run_result(
                "redeem", ok=False, reason="redeem 路径未配置(§0.3 拒绝猜 URL)", unjudged=True
            )
        accepted: list[str] = []
        reasons: list[str] = []
        unjudged = False
        for tier in targets:
            status, payload, mode = await _wb_request(
                path, jwt, device_map, {field: tier}, client=eff_client, timeout=timeout
            )
            fail = _failure_reason(status, payload, mode)
            if fail is not None:
                reasons.append(f"redeem {tier} {fail}")
                unjudged = unjudged or status in (0, -1)
                continue
            code, _data = _envelope(payload)
            if code is None:
                reasons.append(f"redeem {tier} 信封不可解析")
                unjudged = True
            elif code == _CODE_OK:
                accepted.append(tier)
            else:
                reasons.append(f"redeem {tier} code={code}")
        return _run_result(
            "redeem",
            ok=bool(accepted),
            accepted=accepted,
            reason=";".join(reasons) if reasons else None,
            unjudged=unjudged,
        )
    finally:
        if owned:
            await eff_client.aclose()


# ---------------------------------------------------------------------------
# 族六:lottery(抽奖;读 lottery/summary,写侧 body 字段未取证 ⇒ 默认拒绝写)
# ---------------------------------------------------------------------------


async def fetch_lottery_summary(
    jwt: str,
    device_map: dict[str, Any],
    *,
    client: httpx.AsyncClient | None = None,
    timeout: float = DEFAULT_TIMEOUT,
) -> dict[str, Any] | None:
    """只读:GET /activity/growth/lottery/summary(真机 200)。形态未全取证 ⇒ 原样返回
    data dict,不做猜测性字段改写(§0.3);读不懂 ⇒ None。"""
    status, payload, _mode = await _wb_request(
        PATH_GROWTH_LOTTERY_SUMMARY,
        jwt,
        device_map,
        {},
        client=client,
        timeout=timeout,
        method="GET",
    )
    if _failure_reason(status, payload, _mode) is not None:
        return None
    code, data = _envelope(payload)
    if code != _CODE_OK or not isinstance(data, dict):
        return None
    return data


async def run_lottery(
    jwt: str,
    device_map: dict[str, Any],
    *,
    dry_run: bool = False,
    client: httpx.AsyncClient | None = None,
    timeout: float = DEFAULT_TIMEOUT,
) -> dict[str, Any]:
    """lottery 族:抽奖。读 lottery/summary(只读,真机 200);写侧 lottery/draw 路由存在但
    body 字段名未取证(2026-10-28 四形态全 400)⇒ WORKBUDDY_TASKS_LOTTERY_DRAW_FIELD 留空
    即拒绝写(§0.3);抽奖次数 = WORKBUDDY_TASKS_LOTTERY_DRAW_COUNT(默认 1,0 = 不抽)。"""
    eff_client, owned = (client, False) if client is not None else client_for(device_map)
    try:
        summary = await fetch_lottery_summary(jwt, device_map, client=eff_client, timeout=timeout)
        if dry_run:
            return _run_result(
                "lottery",
                ok=True,
                reason=(
                    "dry-run:lottery summary "
                    f"{'已读' if summary is not None else '读不到(未判定)'},零写侧调用"
                ),
                unjudged=summary is None,
            )
        count = max(0, int(settings.workbuddy_tasks_lottery_draw_count))
        if count == 0:
            return _run_result(
                "lottery", ok=True, reason="lottery 次数配置为 0 ⇒ 不抽", unjudged=False
            )
        field = (settings.workbuddy_tasks_lottery_draw_field or "").strip()
        path = (settings.workbuddy_tasks_lottery_draw_path or "").strip()
        if not field:
            return _run_result(
                "lottery",
                ok=False,
                reason=(
                    f"lottery draw {count} 次未执行:body 字段名未取证(2026-10-28 四形态全 400)"
                    "⇒ WORKBUDDY_TASKS_LOTTERY_DRAW_FIELD 留空按 §0.3 拒绝猜字段"
                ),
                unjudged=True,
            )
        if not path:
            return _run_result(
                "lottery",
                ok=False,
                reason="lottery/draw 路径未配置(§0.3 拒绝猜 URL)",
                unjudged=True,
            )
        drawn: list[str] = []
        reasons: list[str] = []
        unjudged = False
        for i in range(count):
            status, payload, mode = await _wb_request(
                path, jwt, device_map, {field: 1}, client=eff_client, timeout=timeout
            )
            fail = _failure_reason(status, payload, mode)
            if fail is not None:
                reasons.append(f"draw#{i + 1} {fail}")
                unjudged = unjudged or status in (0, -1)
                break
            code, _data = _envelope(payload)
            if code is None:
                reasons.append(f"draw#{i + 1} 信封不可解析")
                unjudged = True
                break
            if code == _CODE_OK:
                drawn.append(f"draw#{i + 1}")
            else:
                reasons.append(f"draw#{i + 1} code={code}")
                break
            if count > 1:
                await asyncio.sleep(random.uniform(0.5, 2.0))
        return _run_result(
            "lottery",
            ok=bool(drawn),
            claimed=drawn,
            reason=";".join(reasons) if reasons else None,
            unjudged=unjudged,
        )
    finally:
        if owned:
            await eff_client.aclose()


# ---------------------------------------------------------------------------
# 统一派发(路由与调度器共用同一入口,判据零复算)
# ---------------------------------------------------------------------------

_FAMILY_RUNNERS: Final[dict[str, Callable[..., Awaitable[dict[str, Any]]]]] = {
    "growth": run_growth,
    "travel": run_travel,
    "activity": run_activity,
    "blackcat": run_blackcat,
    "redeem": run_redeem,
    "lottery": run_lottery,
}

VALID_FAMILY_KINDS: Final = tuple(_FAMILY_RUNNERS)


async def run_family(
    kind: str,
    jwt: str,
    device_map: dict[str, Any],
    *,
    dry_run: bool = False,
    chat_completion: ChatCompletion | None = None,
) -> dict[str, Any]:
    """按族派发到唯一实现;blackcat 的 chat_completion 注入点在此透传。"""
    runner = _FAMILY_RUNNERS.get(kind)
    if runner is None:
        return _run_result(kind, ok=False, reason=f"未知任务族:{kind}", unjudged=True)
    if kind == "blackcat":
        return await runner(jwt, device_map, dry_run=dry_run, chat_completion=chat_completion)
    return await runner(jwt, device_map, dry_run=dry_run)


# 说明:travel/status 与 growth 列表均为 POST 读;checkin-status 双路径
# (PATH_CHECKIN_STATUS / PATH_WEB_CHECKIN_STATUS)由 workbuddy_query_credits 内部使用,
# 此处仅 re-export 常量供测试断言"只打了读面"。
READ_ONLY_PATHS: Final = (
    PATH_GROWTH_TASKS,
    PATH_GROWTH_STREAK,
    PATH_TRAVEL_STATUS,
    PATH_GROWTH_LOTTERY_SUMMARY,
    PATH_CHECKIN_STATUS,
    PATH_WEB_CHECKIN_STATUS,
    _webify(PATH_GROWTH_TASKS),
    _webify(PATH_GROWTH_STREAK),
    _webify(PATH_TRAVEL_STATUS),
    _webify(PATH_GROWTH_LOTTERY_SUMMARY),
)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
