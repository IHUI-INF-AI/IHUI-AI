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

**补签卡(makeup cards)只读、不自动使用(口径与 docs/WORKBUDDY_TASKS.md §5 逐字一致,2026-10-31 立)**:
  `streak` 读侧会带回 `makeup_cards{balance,max}`,但那个写侧端点**刻意不接进任何自动流程**
  (巡检轮 / 手动 task-run / 六族 / kind='all' 都不发)——补签卡是稀缺资源,自动消耗它替你补
  一天连续登录不是每个用户都愿意;而且它的 `target_date` 形态**至今未取证**(上游 400 只点名
  格式错)。要接必须先真机取证再落写侧。这条边界不是散文:行为级锁在
  `tests/test_workbuddy_tasks.py`(全族 × dry-run/实跑 + 正向对照),静态形状锁见本文件末尾的
  `find_makeup_card_write_hookups`(§0.9:判据必须在真跑它的那一刻才成立)。

claim(领任务奖励)与 activity **已于 2026-10-31 报文级真机实证**(不再只是读 README):
`WORKBUDDY_TASKS_CLAIM_PATH=/activity/growth/tasks/{code}/claim` —— 任务码在 **URL 路径**,
body 无关(空体/`{code}`/`{task_code}` 对未完成任务一律回同一句 400 `task not completed`);
**Web 域 与 令牌域都通**(README 说"仅 Web 域"已被真机否证),故实现为「有 web_cookie 走
Web 域 + `x-client-platform: web`,无则走令牌域」,见 `_claim_one_web`。
`WORKBUDDY_TASKS_ACTIVITY_PATH=/v2/report` 的 body 为 **`{eventCode(驼峰), timestamp(毫秒),
userId}`** —— 发蛇形 `event_code` 或漏 `timestamp` 会被上游 400 `10001` 打回(其余事件码↔
主机指纹见 config 表)。二者仍保留 `WORKBUDDY_TASKS_LIVE_RUN=false` 双门控,写侧须显式开启;
若运维把配置清空则回到"拒绝执行"。
`www.workbuddy.ai` 对本 token 全域 401(连对照路径也 401)⇒ 国际域需另一套凭据,未验证。

**上报 200 ≠ 计分(真机实测,2026-10-31)**:11 枚事件码全部 POST 200 后,任务列表仍
`status=available`(progress 字段上游不返回)。原因见竞品 README:网关按任务类别校验
「客户端指纹 + 判据事件链」(CLI / 桌面 `WorkBuddy/5.5.6` / Web 三套),单纯遥测上报不足以
达标。故本模块的定位是「**把能自动化的腿全部自动化**(领任务 / 达标领奖 / 兑换 / 抽奖 /
猫猫旅行 / 夜猫子),真行为类任务(如 `first_chat` 需真实发起对话)由其自身行为触发,
不在服务端伪造 —— 伪造判据链属平台风控对抗,明确不做。

族五/六 redeem(连签兑换)/ lottery(抽奖)**读写双侧均已真机实证(2026-10-31 报文级)**:

- 读侧:`/activity/growth/streak` GET 200,`redemption_status` 真实形态为
  `{tier_7d_count,tier_14d_count,tier_28d_count,tier_{7d,14d,28d}_status,remaining_days,
  tiers:[{tier,days,credit,energy,cards,chances}]}` —— **档位解锁态在 `tier_<tier>_status`
  平铺键上,不在 tiers[] 里**(locked/claimed/…;实测账号全 `locked`);
  `/activity/growth/lottery/summary` GET 200 ⇒ `{"chances":N,"module":{"enabled":true}}`。
- 写侧字段(逐字节实测,判据 = 400「invalid …request」为字段错、其它为字段对):
  `POST /activity/growth/redeem` ⇒ body **`{"tier":"7d","client_token":"<任意非空串>"}`**;
  给定未解锁档位回 **403 `连续登录天数不足…`**(= 字段被接受、业务拒绝);
  换成 `clientToken` 驼峰或省掉 `client_token` 均回 **400 `invalid redemption request`**。
  `POST /activity/growth/lottery/draw` ⇒ body **`{"client_token":"<任意非空串>"}`**;
  次数为 0 时回 **400 `insufficient lottery chance balance`**(= 已过字段校验、走进次数校验);
  空体回 **400 `invalid request`**。两处 `client_token` 取值实测 uuid 带连字符与 hex32 均可
  ⇒ 本模块按幂等键语义每次请求现生成 uuid4(`_new_client_token`),同一档位重试复用同一值。
- ⇒ 默认值已从"留空拒绝写"改为实证形态(`.._REDEEM_FIELD=tier`、
  `.._LOTTERY_DRAW_FIELD=client_token`),**开箱即用**;仍保留 env 覆盖以应对上游改版。
- 语义对齐竞品「连登管家」(幂等、未解锁静默跳过):不必配档位,自动兑**所有
  `tier_*_status ∉ {locked,claimed}`** 的档;抽奖按 `chances` 自动抽完(受
  `.._LOTTERY_DRAW_COUNT` 单轮上限约束)。业务拒绝(403 未解锁 / 400 次数不足)
  记 `skipped` 而非失败,`unjudged=False`。

**403 语义纠偏(真机实证的既存缺陷)**:上游把"业务性 403"(如 `连续登录天数不足`)与
"鉴权 403"同用 HTTP 403。旧 `_failure_reason` 一律按 `workbuddy_classify_error` 判
SessionDead ⇒ 会把"档位未解锁"误报成"令牌失效"。现改为:403 且信封 `msg` 非鉴权语义
⇒ 交由信封 `code` 判定(业务拒绝,不判会话失效);仅 msg 缺失或含鉴权词时才判 SessionDead。

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

import ast
import asyncio
import json
import random
import re
import time
import uuid
from collections.abc import Awaitable, Callable
from datetime import datetime
from typing import Any, Final
from zoneinfo import ZoneInfo

import httpx

from app.core.config import settings
from app.core.logging import get_logger
from app.services.checkin_engine import DEFAULT_TIMEOUT, client_for
from app.services.checkin_outbound import OutboundPaused, checkin_outbound_gate
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

# 族五/六 redeem / lottery(2026-10-31 真机读写双侧实证):
# - lottery/summary GET 200 ⇒ {"chances":N,"module":{"enabled":true}}
# - redeem 的档位与解锁态读自 streak 的 redemption_status(tier_<tier>_status 平铺键)
# - 写侧 body 形态见下方 _CLIENT_TOKEN_FIELD 与各 run_*;client_token 为幂等键(任意非空串)
PATH_GROWTH_LOTTERY_SUMMARY: Final = "/activity/growth/lottery/summary"
PATH_GROWTH_LOTTERY_DRAW: Final = "/activity/growth/lottery/draw"
PATH_GROWTH_REDEEM: Final = "/activity/growth/redeem"

# 幂等键字段名(真机实证:驼峰 clientToken 与省缺均 400,仅下划线 client_token 被接受)
_CLIENT_TOKEN_FIELD: Final = "client_token"

# 档位"不可兑"状态集(README「已解锁 = 非 locked/非 claimed」;真机观测到 locked,
# 其余按同义扩展,宁可多跳不误兑)
_TIER_NOT_REDEEMABLE: Final = frozenset({"locked", "claimed", "redeemed", "used"})

# 鉴权语义关键词:403/400 信封 msg 命中即按会话失效判;不命中 ⇒ 业务拒绝(交信封 code 判)
# 注意 `登录` 不能单独作关键词 —— 真机业务拒绝原话是「连续**登录**天数不足」,会被误伤;
# 只认"重新登录/登录态/未登录"这类确指凭证失效的词。
_AUTH_MSG_RE: Final = re.compile(
    r"unauthor|authenticat|token|session|expired|forbidden|please\s+login|login\s+(again|required)|"
    r"重新登录|登录态|登录已过期|登录失效|未登录|鉴权|认证失败|凭证|会话|过期|失效",
    re.IGNORECASE,
)

# 参数/格式错关键词:命中即"请求本身不对"(真失败),不得当成业务拒绝而静默跳过
_FIELD_ERR_RE: Final = re.compile(
    r"invalid|malformed|required|missing|bad\s*request|unsupported|格式|参数|不支持",
    re.IGNORECASE,
)

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


def _payload_msg(payload: Any) -> str | None:
    """取信封 msg(真机业务拒绝形态 `{"code":403,"msg":"连续登录天数不足…","requestId":…}`)。

    非空字符串才算;缺失/空串 ⇒ None。仅用于把上游原话带进 reason,不做语义改写。
    """
    if not isinstance(payload, dict):
        return None
    msg = _as_str(payload.get("msg")) or _as_str(payload.get("message"))
    if msg is None:
        return None
    msg = msg.strip()
    return msg or None


def _new_client_token() -> str:
    """生成一次性幂等键(真机实证:上游只要求非空串,uuid/hex32 均接受)。

    同一逻辑动作的重试必须复用同一个值,否则幂等键失效、可能重复扣次数/重复兑换;
    故生成点在调用方(每档/每次抽奖各一枚),重试沿用。
    """
    return str(uuid.uuid4())


def _msg_suffix(payload: Any) -> str:
    """reason 用:上游有 msg 就附上,便于定位(纯展示,不参与任何判定)。"""
    msg = _payload_msg(payload)
    return f": {msg}" if msg else ""


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


def _is_business_reject(status: int, payload: Any) -> bool:
    """4xx + 原生信封(code 为 int) + msg 不含鉴权/参数错关键词 ⇒ 业务拒绝。

    真机样本:`403 连续登录天数不足…`(redeem 档位未解锁)、`400 insufficient lottery
    chance balance`(抽奖次数不足) —— 二者字段与鉴权都对,只是业务态不满足,必须交给
    信封 code 判并记 skipped:既不能当传输层失败,更不能用 403⇒SessionDead 误杀账号。
    反例(不算业务拒绝,仍按真失败报):`400 invalid redemption request`、`400 invalid request`。
    """
    if not (400 <= status < 500):
        return False
    code, _data = _envelope(payload)
    if code is None:
        return False
    msg = _payload_msg(payload)
    if msg is None:
        return False
    return not (_AUTH_MSG_RE.search(msg) or _FIELD_ERR_RE.search(msg))


def _failure_reason(status: int, payload: Any, mode: str) -> str | None:
    """把 (status,payload) 翻译成可读失败原因;None = 不是失败(继续按信封判)。

    **403/400 必须分两类**(2026-10-31 真机实证的既存缺陷):上游对"业务性 4xx"
    (如 redeem 未解锁 `连续登录天数不足`、抽奖 `insufficient lottery chance balance`)
    与"鉴权/参数错"共用同一 HTTP 状态码。若一律按 `workbuddy_classify_error` 判
    SessionDead / HTTP 失败,会把"档位没解锁"误报成"令牌失效"(进而让上层把好账号标死),
    也会把"次数不足"记成真错误。故先过 `_is_business_reject`:是业务拒绝 ⇒ 返回 None,
    交由调用方按信封 `code` 判;否则才落 SessionDead / HTTP 失败(带上游 msg 便于定位)。
    """
    if status == 0:
        return "网络异常(超时)"
    if status == -1:
        return f"网络异常: {payload}"
    if status in (401, 403):
        if _is_business_reject(status, payload):
            return None  # 业务拒绝:交给信封 code 判,不让它冒充会话失效
        etype, _ = workbuddy_classify_error(status)
        suffix = (
            "会话/令牌已失效,请重新登录态采集" if etype == "SessionDead" else f"HTTP {status}"
        )
        return suffix
    if status >= 400:
        if _is_business_reject(status, payload):
            return None
        msg = _payload_msg(payload)
        return f"HTTP {status}: {msg}" if msg else f"HTTP {status}"
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
        return _list_result([], f"上游 code={code} 非成功码{_msg_suffix(payload)}", False, False)
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
    """单任务领奖。任务码在 **URL 路径**里,body 无关(2026-10-31 真机:空体 / `{code}` /
    `{task_code}` 三种 body 对未完成任务一律回同一句 400 `task not completed` ⇒ 证明
    路径与鉴权都已通过,差异只在 body 之外)。

    双域策略(真机纠偏 README 的"仅 Web 域"说法):用**令牌域** `copilot.tencent.com`
    打同一路径同样回业务错误 `task not completed`(而非 404/401)⇒ 令牌域也通。
    旧实现"强制 Web 域 + 无 web_cookie 即跳过"会让**所有令牌模式账号(默认采集形态)
    永远领不到奖**,是生产级缺陷。
    现改为:有 web_cookie ⇒ Web 域 + `x-client-platform: web`(README 形态);无 web_cookie
    ⇒ 走 `_wb_request` 原生域(令牌域);Web 域非业务失败时再兜底令牌域。
    返回 (ok, 原因, 是否网络失败):网络失败 ⇒ 调用方置 unjudged;会话/业务失败 ⇒ 不误判。
    """
    claim_path_tmpl = (settings.workbuddy_tasks_claim_path or "").strip()
    if not claim_path_tmpl:
        return False, "claim 路径未配置(§0.3 拒绝猜 URL)", False
    if "{code}" not in claim_path_tmpl:
        return False, "claim 路径模板缺 {code} 占位符", False
    rel = claim_path_tmpl.format(code=code_item)
    web_cookie = workbuddy_web_cookie(jwt, device_map)

    if web_cookie:
        url = WB_WEB_BASE.rstrip("/") + _webify(rel)
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
        if status < 400:
            code, _data = _envelope(payload)
            if code is None:
                return False, "信封不可解析", False
            if code == _CODE_OK:
                return True, "", False
            return False, f"上游 code={code}{_msg_suffix(payload)}", False
        # Web 域非业务失败(404 等)⇒ 落令牌域再试一次(双域兜底,不丢这一档)

    status, payload, mode = await _wb_request(
        rel, jwt, device_map, {}, client=client, timeout=timeout
    )
    fail = _failure_reason(status, payload, mode)
    if fail is not None:
        return False, fail, status in (0, -1)
    code, _data = _envelope(payload)
    if code is None:
        return False, "信封不可解析", True
    if code == _CODE_OK:
        return True, "", False
    return False, f"上游 code={code}{_msg_suffix(payload)}", False


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
                    reasons.append(f"accept 上游 code={code}{_msg_suffix(payload)}")
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
        return _run_result(
            "travel",
            ok=False,
            reason=f"travel/status 上游 code={code}{_msg_suffix(payload)}",
            unjudged=False,
        )
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
        if state.get("daily_limit_reached") is True:
            # 真机(2026-10-31):status 的 daily_limit_reached=true 表示当日出发次数已用尽,
            # 此时再打 depart 必失败。旧实现无条件出发 ⇒ 每轮巡检记一条假失败并标 unjudged,
            # 把整族 ok 拖成 False。已用尽属正常态,跳过而不是报错。
            reasons.append("今日出发次数已用尽(daily_limit_reached=true)⇒ 不出发")
        elif not depart_states:
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
            # body 形态 2026-10-31 真机取证(此前发 event_code 在线上 100% 失败,故曾全族报错):
            #   缺 eventCode  ⇒ 400 10001「eventCode is empty or not string」
            #   缺 timestamp ⇒ 400 10001「event missing both reportDelay and timestamp fields」
            #   秒级时间戳   ⇒ 400 10001「timestamp is too far from now」⇒ 必须毫秒
            #   {eventCode, timestamp:<ms>} ⇒ 200 {"code":0,"msg":"OK"}
            # 故字段名是驼峰 eventCode,且必须带毫秒级 timestamp(或 reportDelay)。
            body: dict[str, Any] = {
                "eventCode": event_code,
                "timestamp": int(time.time() * 1000),
            }
            if uid:
                body["userId"] = uid
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
                reasons.append(f"{event_code}:code={code}{_msg_suffix(payload)}")
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
# 族五:redeem(连签档位兑换;读写双侧 2026-10-31 真机实证,见模块 docstring)
# ---------------------------------------------------------------------------


async def fetch_redeem_tiers(
    jwt: str,
    device_map: dict[str, Any],
    *,
    client: httpx.AsyncClient | None = None,
    timeout: float = DEFAULT_TIMEOUT,
) -> dict[str, Any] | None:
    """只读:GET streak 取 redemption_status(真机形态见模块 docstring)。

    返回 {"tiers": [...], "status": <raw>, "remaining_days": int|None};
    读不到 redemption_status ⇒ None(不编造)。

    tiers[] 每项在真机原始字段(tier/days/credit/energy/cards/chances)之外补两个**派生**
    字段:`status`(取自 `tier_<tier>_status` 平铺键,真机形态)与 `redeemable`
    (status 存在且 ∉ `_TIER_NOT_REDEEMABLE`)。status 键缺失 ⇒ status=None、
    redeemable=False —— 不拿"没写状态"当"可兑"(§0.3 宁缺勿假)。
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
    raw_tiers = rs.get("tiers")
    tiers: list[dict[str, Any]] = []
    for row in raw_tiers if isinstance(raw_tiers, list) else []:
        if not isinstance(row, dict):
            continue
        name = _as_str(row.get("tier"))
        if name is None:
            continue
        st = _as_str(rs.get(f"tier_{name}_status"))
        st_norm = st.strip().lower() if st else None
        tiers.append(
            {
                "tier": name,
                "days": _as_int(row.get("days")),
                "credit": _as_int(row.get("credit")),
                "energy": _as_int(row.get("energy")),
                "cards": _as_int(row.get("cards")),
                "chances": _as_int(row.get("chances")),
                "status": st_norm,
                "redeemable": st_norm is not None and st_norm not in _TIER_NOT_REDEEMABLE,
            }
        )
    return {
        "tiers": tiers,
        "status": rs,
        "remaining_days": _as_int(rs.get("remaining_days")),
    }


async def run_redeem(
    jwt: str,
    device_map: dict[str, Any],
    *,
    dry_run: bool = False,
    client: httpx.AsyncClient | None = None,
    timeout: float = DEFAULT_TIMEOUT,
) -> dict[str, Any]:
    """redeem 族:连签档位兑换(真机实证 body = `{tier, client_token}`,见模块 docstring)。

    判据链(幂等,对齐竞品「连登管家」——未解锁静默跳过):
    1. GET streak 取 redemption_status;读不到 ⇒ 未判定,一个写请求都不发;
    2. 目标档位:配了 `WORKBUDDY_TASKS_REDEEM_TIERS` ⇒ 只兑清单内**且档位表里真实存在**
       的档(清单里不存在的名字记入 reason 后忽略,不猜);未配 ⇒ **自动模式**,兑所有
       `tier_<tier>_status ∉ {locked,claimed,redeemed,used}` 的档;
    3. 逐档 POST,业务拒绝(如 403「连续登录天数不足」)⇒ 记 skipped,**不算失败也不算未判定**
       (这是"已判定为当前不可兑"的正常态,重复跑幂等);
    4. `client_token` 每档一枚 uuid4 幂等键(同一档重试复用同一值,不重复兑换)。
    """
    eff_client, owned = (client, False) if client is not None else client_for(device_map)
    try:
        info = await fetch_redeem_tiers(jwt, device_map, client=eff_client, timeout=timeout)
        if info is None:
            return _run_result(
                "redeem", ok=False, reason="redemption_status 读不到(未判定)", unjudged=True
            )
        tiers: list[dict[str, Any]] = info["tiers"]
        by_name = {str(t["tier"]): t for t in tiers}
        explicit = [
            x.strip()
            for x in (settings.workbuddy_tasks_redeem_tiers or "").split(",")
            if x.strip()
        ]
        unknown: list[str] = []
        if explicit:
            targets = [x for x in explicit if x in by_name]
            unknown = [x for x in explicit if x not in by_name]
        else:
            targets = [str(t["tier"]) for t in tiers if t.get("redeemable")]
        if dry_run:
            return _run_result(
                "redeem",
                ok=True,
                reason=(
                    f"dry-run:档位 {len(tiers)} 个,待兑 {len(targets)} 个"
                    f"({','.join(targets) or '无'}),零写侧调用"
                ),
                unjudged=False,
            )
        if not targets:
            desc = ",".join(f"{t['tier']}={t.get('status') or '?'}" for t in tiers) or "无档位"
            tail = f";清单内未知档位 {','.join(unknown)} 已忽略" if unknown else ""
            return _run_result(
                "redeem", ok=True, reason=f"无已解锁待兑档位({desc}){tail}", unjudged=False
            )
        field = (settings.workbuddy_tasks_redeem_field or "").strip() or "tier"
        path = (settings.workbuddy_tasks_redeem_path or "").strip() or PATH_GROWTH_REDEEM
        accepted: list[str] = []
        skipped: list[str] = []
        reasons: list[str] = []
        unjudged = False
        for idx, tier in enumerate(targets):
            body = {field: tier, _CLIENT_TOKEN_FIELD: _new_client_token()}
            status, payload, mode = await _wb_request(
                path, jwt, device_map, body, client=eff_client, timeout=timeout
            )
            fail = _failure_reason(status, payload, mode)
            if fail is not None:
                reasons.append(f"redeem {tier} {fail}")
                unjudged = unjudged or status in (0, -1)
            else:
                code, _data = _envelope(payload)
                msg = _payload_msg(payload)
                if code is None:
                    reasons.append(f"redeem {tier} 信封不可解析")
                    unjudged = True
                elif code == _CODE_OK:
                    accepted.append(tier)
                else:
                    skipped.append(f"{tier}({msg or f'code={code}'})")
            if idx + 1 < len(targets):
                await asyncio.sleep(random.uniform(0.4, 1.2))
        notes = list(reasons)
        if skipped:
            notes.append(f"跳过 {len(skipped)} 档:{';'.join(skipped)}")
        if unknown:
            notes.append(f"清单内未知档位已忽略:{','.join(unknown)}")
        return _run_result(
            "redeem",
            ok=not reasons,
            accepted=accepted,
            reason=";".join(notes) if notes else None,
            unjudged=unjudged,
        )
    finally:
        if owned:
            await eff_client.aclose()


# ---------------------------------------------------------------------------
# 族六:lottery(抽奖;读写双侧 2026-10-31 真机实证,见模块 docstring)
# ---------------------------------------------------------------------------


async def fetch_lottery_summary(
    jwt: str,
    device_map: dict[str, Any],
    *,
    client: httpx.AsyncClient | None = None,
    timeout: float = DEFAULT_TIMEOUT,
) -> dict[str, Any] | None:
    """只读:GET /activity/growth/lottery/summary(真机 200)。

    真机形态 `{"chances":N,"module":{"enabled":true}}` —— 原样返回 data dict,不改写字段
    (§0.3);读不懂 ⇒ None。次数语义见 `lottery_chances`。
    """
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


def lottery_chances(summary: dict[str, Any] | None) -> int | None:
    """从 summary 取剩余抽奖次数(真机键名 `chances`)。取不到 ⇒ None(不拿 0 冒充)。"""
    if not isinstance(summary, dict):
        return None
    return _as_int(summary.get("chances"))


async def run_lottery(
    jwt: str,
    device_map: dict[str, Any],
    *,
    dry_run: bool = False,
    client: httpx.AsyncClient | None = None,
    timeout: float = DEFAULT_TIMEOUT,
) -> dict[str, Any]:
    """lottery 族:抽奖(真机实证 body = `{client_token}`,每次消耗 1 次机会)。

    判据链(对齐竞品「连登管家」:有次数自动抽完,幂等):
    1. GET lottery/summary 取 `chances`;读不到 ⇒ 未判定,一个写请求都不发;
    2. 本轮计划 = min(chances, `WORKBUDDY_TASKS_LOTTERY_DRAW_COUNT` 单轮上限);
       chances=0 ⇒ 正常返回"无抽奖次数"(幂等态,不是失败、不是未判定);
    3. 逐次 POST `{<field>: <uuid4>}`,**每次一枚新幂等键**(抽奖是多次独立动作);
       业务拒绝(`insufficient lottery chance balance` 等)⇒ 记 skipped 收尾,不算失败;
    4. 传输层/信封不可解析 ⇒ 记 reasons 且 ok=False(该轮真异常)。
    """
    eff_client, owned = (client, False) if client is not None else client_for(device_map)
    try:
        summary = await fetch_lottery_summary(jwt, device_map, client=eff_client, timeout=timeout)
        chances = lottery_chances(summary)
        if chances is None:
            return _run_result(
                "lottery",
                ok=False,
                reason=(
                    "lottery/summary 读不到(未判定)"
                    if summary is None
                    else "lottery/summary 无 chances 字段(未判定)"
                ),
                unjudged=True,
            )
        limit = max(0, int(settings.workbuddy_tasks_lottery_draw_count))
        plan = min(chances, limit)
        if dry_run:
            return _run_result(
                "lottery",
                ok=True,
                reason=(
                    f"dry-run:剩余 {chances} 次,本轮计划 {plan} 次(单轮上限 {limit}),零写侧调用"
                ),
                unjudged=False,
            )
        if plan <= 0:
            return _run_result(
                "lottery",
                ok=True,
                reason=(
                    "无抽奖次数"
                    if chances == 0
                    else f"单轮上限 WORKBUDDY_TASKS_LOTTERY_DRAW_COUNT={limit} ⇒ 本轮不抽"
                ),
                unjudged=False,
            )
        field = (settings.workbuddy_tasks_lottery_draw_field or "").strip() or _CLIENT_TOKEN_FIELD
        path = (
            settings.workbuddy_tasks_lottery_draw_path or ""
        ).strip() or PATH_GROWTH_LOTTERY_DRAW
        drawn: list[str] = []
        skipped: list[str] = []
        reasons: list[str] = []
        unjudged = False
        for i in range(plan):
            body = {field: _new_client_token()}
            status, payload, mode = await _wb_request(
                path, jwt, device_map, body, client=eff_client, timeout=timeout
            )
            fail = _failure_reason(status, payload, mode)
            if fail is not None:
                reasons.append(f"draw#{i + 1} {fail}")
                unjudged = unjudged or status in (0, -1)
                break
            code, data = _envelope(payload)
            msg = _payload_msg(payload)
            if code is None:
                reasons.append(f"draw#{i + 1} 信封不可解析")
                unjudged = True
                break
            if code == _CODE_OK:
                prize = _as_str(data.get("draw_uuid")) if isinstance(data, dict) else None
                drawn.append(f"draw#{i + 1}:{prize}" if prize else f"draw#{i + 1}")
            else:
                skipped.append(f"draw#{i + 1}({msg or f'code={code}'})")
                break
            if i + 1 < plan:
                await asyncio.sleep(random.uniform(0.5, 1.5))
        notes = list(reasons)
        if skipped:
            notes.append(f"停止:{';'.join(skipped)}")
        return _run_result(
            "lottery",
            ok=not reasons,
            claimed=drawn,
            reason=";".join(notes) if notes else None,
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


# 生产巡检顺序(单一真源:调度器与"一键全族"共用,杜绝两处顺序漂移)。
# activity 必须排在 growth 之前 —— 上报计分先落地,growth 拉列表时才能看到
# 「刚因计分达标」的任务并在同一轮 claim;反序则要等下一轮(默认 180 分钟)。
SWEEP_ORDER: Final = ("activity", "growth", "travel", "blackcat", "redeem", "lottery")


async def run_family(
    kind: str,
    jwt: str,
    device_map: dict[str, Any],
    *,
    dry_run: bool = False,
    chat_completion: ChatCompletion | None = None,
    activity_reporter: ActivityReporter | None = None,
    events: tuple[str, ...] | None = None,
    client: httpx.AsyncClient | None = None,
    timeout: float = DEFAULT_TIMEOUT,
) -> dict[str, Any]:
    """按族派发到唯一实现。

    注入点在此统一透传,否则生产侧(路由/调度)永远拿不到 —— 曾经
    `activity_reporter` 只存在于测试调用里、growth 的「上报→重判→claim」闭环
    在线上是死代码,即此漏:
    - blackcat: `chat_completion`(补全回调)
    - growth: `activity_reporter`(任务计分回调,用于达标后同轮 claim)
    - activity: `events`(指定事件码子集,默认全部在册事件)
    - `client`/`timeout`:复用同一 HTTP 连接与超时(一键全族时避免每族重开连接)
    `kind="all"` ⇒ 按 SWEEP_ORDER 顺序跑完全部族。
    """
    if kind == "all":
        return await run_all_families(jwt, device_map, dry_run=dry_run, client=client, timeout=timeout)
    runner = _FAMILY_RUNNERS.get(kind)
    if runner is None:
        return _run_result(kind, ok=False, reason=f"未知任务族:{kind}", unjudged=True)
    if kind == "blackcat":
        return await runner(
            jwt,
            device_map,
            dry_run=dry_run,
            chat_completion=chat_completion,
            client=client,
            timeout=timeout,
        )
    if kind == "growth":
        return await runner(
            jwt,
            device_map,
            dry_run=dry_run,
            activity_reporter=activity_reporter,
            client=client,
            timeout=timeout,
        )
    if kind == "activity" and events is not None:
        return await runner(
            jwt, device_map, dry_run=dry_run, events=events, client=client, timeout=timeout
        )
    return await runner(jwt, device_map, dry_run=dry_run, client=client, timeout=timeout)


async def run_all_families(
    jwt: str,
    device_map: dict[str, Any],
    *,
    dry_run: bool = False,
    client: httpx.AsyncClient | None = None,
    timeout: float = DEFAULT_TIMEOUT,
) -> dict[str, Any]:
    """按 SWEEP_ORDER 顺序跑完全部族,返回聚合结果(键集与单族一致 + families 明细)。

    - 单族异常不中断整轮(记进该族 reason,unjudged=True),与调度器同口径;
    - 复用同一 client ⇒ 六个族只建一次连接池(调度器逐族调用时为六次);
    - 任一族撞 `OutboundPaused` 直接上抛,由调用方按限流语义处理(不吞)。
    """
    eff_client, owned = (client, False) if client is not None else client_for(device_map)
    families: dict[str, Any] = {}
    accepted: list[str] = []
    claimed: list[str] = []
    reasons: list[str] = []
    unjudged = False
    try:
        for kind in SWEEP_ORDER:
            try:
                res = await run_family(
                    kind, jwt, device_map, dry_run=dry_run, client=eff_client, timeout=timeout
                )
            except OutboundPaused:
                raise
            except Exception as e:  # noqa: BLE001 — 单族异常不中断整轮
                logger.warning("[workbuddy_tasks] 全族执行 %s 异常: %s", kind, e)
                families[kind] = _run_result(
                    kind, ok=False, reason=f"执行异常:{e}", unjudged=True
                )
                unjudged = True
                reasons.append(f"{kind}:异常")
                continue
            families[kind] = res
            accepted.extend(res.get("accepted") or [])
            claimed.extend(res.get("claimed") or [])
            if res.get("unjudged"):
                unjudged = True
            if res.get("reason"):
                reasons.append(f"{kind}:{res['reason']}")
        return {
            "ok": all(bool(r.get("ok")) for r in families.values()) if families else False,
            "kind": "all",
            "accepted": accepted,
            "claimed": claimed,
            "credit_delta": families.get("growth", {}).get("credit_delta"),
            "energy_delta": None,
            "reason": "; ".join(reasons) if reasons else None,
            "unjudged": unjudged,
            "families": families,
        }
    finally:
        if owned:
            await eff_client.aclose()


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


# ---------------------------------------------------------------------------
# 补签卡写侧的"防回潮"判据(2026-10-31 立;口径见模块 docstring 与 §5 文档)
#
# 下面两个纯函数是这条边界的**唯一实现**:行为级用例与静态形状锁都问这里,不在测试里
# 另抄一份判据常量(§22c 单一真相源)。它们不参与线上判定 —— 存在的意义就是"接回来即红"。
# ---------------------------------------------------------------------------

# 写侧端点的形态指纹:makeup + card(s) + use 三段,分隔符允许 `-`/`_`/`/`/空格/无(覆盖
# kebab / snake / 驼峰三种书写)。`use` 后必须落在词边界上,以免误伤 `makeup_cards_used`
# 这类**读侧**字段名;单独出现的 `makeup_cards`(streak 读侧 JSON 键)同样不算命中。
_MAKEUP_WRITE_TOKEN_RE: Final = re.compile(r"makeup[-_ ]?cards?[-_ /]*use\b", re.IGNORECASE)

# 出网调用原语:本模块所有请求都从这几处发出(新增原语必须同批登记,否则静态锁失明)。
_REQUEST_CALL_FUNS: Final = frozenset({"_wb_request", "_post_once"})
_REQUEST_CALL_ATTRS: Final = frozenset({"post", "request", "Request"})


def makeup_card_write_hit(text: str) -> bool:
    """URL / 请求体 / 标识符是否指向补签卡**写侧**端点(读侧键名一律不算命中)。"""
    return _MAKEUP_WRITE_TOKEN_RE.search(text) is not None


def _is_request_call(node: ast.Call) -> bool:
    """该 Call 是不是"直接构造并发出请求"的调用点(取字典值那种普通调用不算)。"""
    fn = node.func
    if isinstance(fn, ast.Name):
        return fn.id in _REQUEST_CALL_FUNS
    if isinstance(fn, ast.Attribute):
        return fn.attr in _REQUEST_CALL_ATTRS
    return False


def _docstring_constant_ids(tree: ast.AST) -> set[int]:
    """收集"文档串"字面量节点 id —— 说明性散文不在射程,只锁代码里的端点形态(§12f)。"""
    out: set[int] = set()
    for node in ast.walk(tree):
        if not isinstance(
            node, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)
        ):
            continue
        first = node.body[0] if node.body else None
        if (
            isinstance(first, ast.Expr)
            and isinstance(first.value, ast.Constant)
            and isinstance(first.value.value, str)
        ):
            out.add(id(first.value))
    return out


def find_makeup_card_write_hookups(source: str) -> list[str]:
    """静态形状锁:在 `source`(本模块源码文本)里找出"把补签卡写侧接进出网调用"的点。

    判据刻意只窄到两面(§12f:整文件禁词会把注释/docstring 里的说明也判红,逼人改措辞绕尺子):

    1. **非 docstring 的字符串字面量**命中 `makeup_card_write_hit` —— 端点路径真要发出去,
       必然以字符串形态落在某个请求构造面上;
    2. **出网原语**(`_wb_request` / `_post_once` / `.post()` / `.request()`)调用子树里出现的
       **标识符名**命中同一指纹 —— 兜住"路径常量住在别的模块、这里只 import 名字再传进去"的旁路。

    命中 ⇒ 返回逐条 `L<行号>: <说明>`(空列表 = 未接线)。源码解析不了 ⇒ 抛 ValueError:
    取不到输入一律显式「未判定」,不冒绿(§0.3)。
    """
    try:
        tree = ast.parse(source)
    except SyntaxError as e:  # 连语法都读不动 ⇒ 无判定,不假装干净
        raise ValueError(f"补签卡静态锁无法解析源码(未判定):{e}") from e
    prose = _docstring_constant_ids(tree)
    hits: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Constant) and isinstance(node.value, str):
            if id(node) not in prose and makeup_card_write_hit(node.value):
                hits.append(f"L{node.lineno}: 字符串字面量指向补签卡写侧端点")
        elif isinstance(node, ast.Call) and _is_request_call(node):
            for sub in ast.walk(node):
                ident: str | None = None
                if isinstance(sub, ast.Name):
                    ident = sub.id
                elif isinstance(sub, ast.Attribute):
                    ident = sub.attr
                if ident is not None and makeup_card_write_hit(ident):
                    hits.append(f"L{node.lineno}: 出网调用里出现补签卡写侧标识符 {ident}")
    return hits

# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
