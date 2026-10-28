# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""WorkBuddy「做任务赚积分」自动化族客户端(台账票 O68,2026-10-29 立)。

**证据级别声明(先读)**:本模块的路径、字段名、请求体形态取证自竞品未strip的 Go
二进制(wb2api.exe)内嵌字符串(struct tag 逐字),并**未**拿到上游真机 200 验证。
任何人不得把本文件读成"接口已核实可用"。以下三处是取证面与执行面之间的已知缺口,
全部按 AGENTS §0.3 的口径处理(取不到 ⇒ 未判定 unjudged=true,不冒绿、不猜零):

1. 枚举值域未取证 —— `status` / `accept_status` / travel `state` 的取值集合二进制
   只给了字段名,没给值域。待领取任务判定走**可配置集**(settings.
   workbuddy_tasks_accept_statuses,默认 "0" 系 0/1 标志位推断);travel 出发触发态
   默认空集 ⇒ 默认不出发,只报状态。
2. claim(领任务奖励)路径未取证 —— 二进制给了两型 body(accept ⇒
   {"task_codes":[...]} 已取证;claim ⇒ {"task_code":"<code>"} 已取证),但 claim 的
   **路径**没有登记。settings.workbuddy_tasks_claim_path 留空 ⇒ 拒绝执行并写明原因
   (宁可不做,不猜 URL)。
3. activity 族不是单一端点 —— 取证面只有事件码清单与三个候选主机(copilot.tencent.com
   / www.workbuddy.cn / www.workbuddy.ai),**路径↔主机绑定是推断**,必须经
   WORKBUDDY_TASKS_ACTIVITY_HOSTS(JSON)人工覆盖;上报路径本身未取证,
   WORKBUDDY_TASKS_ACTIVITY_PATH 留空 ⇒ run_activity 返回未判定。

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
) -> tuple[int, Any]:
    """单发 POST。返回 (status, parsed|None);0=超时 -1=网络异常(payload=描述)。"""
    await checkin_outbound_gate.before_request("workbuddy")
    try:
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
) -> tuple[int, Any, str]:
    """POST 一个任务族端点,返回 (http_status, payload, mode),mode ∈ {"token","web","url"}。

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
        status, payload = await _post_once(absolute_url, headers, body, timeout=timeout, http=http)
        return status, payload, "url"

    if workbuddy_is_web_mode(device_map) or not token:
        status, payload = await _post_once(
            WB_WEB_BASE.rstrip("/") + _webify(path),
            _web_headers(),
            body,
            timeout=timeout,
            http=http,
        )
        return status, payload, "web"

    status, payload = await _post_once(
        WB_BASE.rstrip("/") + path, _token_headers(), body, timeout=timeout, http=http
    )
    if status in (401, 403) and web_cookie:
        status2, payload2 = await _post_once(
            WB_WEB_BASE.rstrip("/") + _webify(path),
            _web_headers(),
            body,
            timeout=timeout,
            http=http,
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

    读懂判据:task_code/task_desc/progress/limit_num/status/accept_status 全部可取。
    reward_credit/reward_energy **缺字段按 0**(任务无奖励是合法形态,非"读不懂");
    字段在但形态坏(非整数)⇒ 读不懂。valid_to 允许 str 或 null。
    """
    if not isinstance(raw, dict):
        return None, False
    code = _as_str(raw.get("task_code"))
    title = _as_str(raw.get("task_desc"))
    progress = _as_int(raw.get("progress"))
    target = _as_int(raw.get("limit_num"))
    status = _as_str(raw.get("status"))
    accept_status = _as_str(raw.get("accept_status"))
    if None in (code, title, progress, target, status, accept_status):
        return None, False
    reward_credit = _as_int(raw.get("reward_credit")) if "reward_credit" in raw else 0
    reward_energy = _as_int(raw.get("reward_energy")) if "reward_energy" in raw else 0
    if reward_credit is None or reward_energy is None:
        return None, False
    valid_to_raw = raw.get("valid_to")
    valid_to = valid_to_raw if isinstance(valid_to_raw, str) else None
    return (
        {
            "task_code": code,
            "title": title,
            "progress": progress,
            "target": target,
            "status": status,
            "accept_status": accept_status,
            "reward_credit": reward_credit,
            "reward_energy": reward_energy,
            "valid_to": valid_to,
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
    """GET 语义(实际按上游家族惯例 POST 空体)拉取 growth 任务列表 ⇒ 列表面合同。"""
    status, payload, _mode = await _wb_request(
        PATH_GROWTH_TASKS, jwt, device_map, {}, client=client, timeout=timeout
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
    """连签状态只读探针(streak/days/tier/next_tier/makeup_cells/reward_buddy/cells/
    banners/tiers 取证字段;任一读不到 ⇒ 返回 None,不编造)。"""
    status, payload, _mode = await _wb_request(
        PATH_GROWTH_STREAK, jwt, device_map, {}, client=client, timeout=timeout
    )
    if _failure_reason(status, payload, _mode) is not None:
        return None
    code, data = _envelope(payload)
    if code != _CODE_OK or not isinstance(data, dict):
        return None
    out: dict[str, Any] = {}
    for key in ("streak", "days", "tier"):
        val = data.get(key)
        if isinstance(val, (int, str)) and not isinstance(val, bool):
            out[key] = val
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
    """纯函数分类。返回 (待 accept 的 task_code, 可 claim 的 task_code)。

    - accept:accept_status ∈ WORKBUDDY_TASKS_ACCEPT_STATUSES(默认 "0",0/1 标志位**推断**);
    - claim:progress ≥ target 且 target > 0(数值判据,不依赖未取证的状态枚举)。
    """
    accept_set = _status_set(settings.workbuddy_tasks_accept_statuses)
    to_accept: list[str] = []
    to_claim: list[str] = []
    for t in tasks:
        if str(t["accept_status"]) in accept_set:
            to_accept.append(str(t["task_code"]))
        elif t["target"] > 0 and t["progress"] >= t["target"]:
            to_claim.append(str(t["task_code"]))
    return to_accept, to_claim


async def run_growth(
    jwt: str,
    device_map: dict[str, Any],
    *,
    dry_run: bool = False,
    client: httpx.AsyncClient | None = None,
    timeout: float = DEFAULT_TIMEOUT,
) -> dict[str, Any]:
    """growth 族执行:列表(读)→ accept(写)→ claim(写,仅路径已配置时)→ 余额差量。"""
    eff_client, owned = (client, False) if client is not None else client_for(device_map)
    try:
        return await _run_growth_inner(jwt, device_map, dry_run, eff_client, timeout)
    finally:
        if owned:
            await eff_client.aclose()


async def _run_growth_inner(
    jwt: str,
    device_map: dict[str, Any],
    dry_run: bool,
    client: httpx.AsyncClient,
    timeout: float,
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
    if to_accept:
        status, payload, mode = await _wb_request(
            PATH_GROWTH_TASKS_ACCEPT,
            jwt,
            device_map,
            {"task_codes": to_accept},
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
    claim_path = (settings.workbuddy_tasks_claim_path or "").strip()
    if to_claim:
        if not claim_path:
            reasons.append(
                f"claim {len(to_claim)} 项未执行:claim 路径未取证且未配置"
                "(WORKBUDDY_TASKS_CLAIM_PATH 留空 ⇒ 按 §0.3 拒绝猜 URL)"
            )
        else:
            for code_item in to_claim:
                status, payload, mode = await _wb_request(
                    claim_path,
                    jwt,
                    device_map,
                    {"task_code": code_item},
                    client=client,
                    timeout=timeout,
                )
                if _failure_reason(status, payload, mode) is not None:
                    reasons.append(f"claim {code_item} 失败({status})")
                    unjudged = unjudged or status in (0, -1)
                    continue
                code, _data = _envelope(payload)
                if code is None:
                    reasons.append(f"claim {code_item} 信封不可解析")
                    unjudged = True
                elif code == _CODE_OK:
                    claimed.append(code_item)
                else:
                    reasons.append(f"claim {code_item} 上游 code={code}")
    streak = await fetch_growth_streak(jwt, device_map, client=client, timeout=timeout)
    if isinstance(streak, dict) and "streak" in streak:
        reasons.append(f"streak={streak['streak']}")
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
    """TravelState(state/status/remain/energy/credit)解析;整读不懂 ⇒ None。"""
    if not isinstance(data, dict):
        return None
    out: dict[str, Any] = {}
    for key in ("state", "status"):
        val = _as_str(data.get(key))
        if val is None:
            return None
        out[key] = val
    for key in ("remain", "energy", "credit"):
        ival = _as_int(data.get(key))
        if ival is None:
            return None
        out[key] = ival
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
        PATH_TRAVEL_STATUS, jwt, device_map, {}, client=client, timeout=timeout
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
            "travel", ok=False, reason="TravelState 形态读不懂(state/status/remain/energy/credit 缺项)", unjudged=True
        )
    pending_credit = state["credit"]
    pending_energy = state["energy"]
    if dry_run:
        return _run_result(
            "travel",
            ok=True,
            reason=(
                f"dry-run:state={state['state']} status={state['status']} "
                f"待发 credit={pending_credit} energy={pending_energy},零写侧调用"
            ),
            unjudged=False,
        )
    reasons: list[str] = []
    claimed: list[str] = []
    accepted: list[str] = []
    unjudged = False
    credit_delta: int | None = None
    energy_delta: int | None = None
    if pending_credit > 0 or pending_energy > 0:
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
        for event_code in events:
            base = hosts.get(event_code) or hosts.get("default") or WB_BASE
            url_path = _webify(path) if base == WB_WEB_BASE or (web_ctx and base == WB_BASE) else path
            if web_ctx and base == WB_BASE:
                base = WB_WEB_BASE
            status, payload, mode = await _wb_request(
                path,
                jwt,
                device_map,
                {"event_code": event_code},
                client=eff_client,
                timeout=timeout,
                absolute_url=base + url_path,
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
# 统一派发(路由与调度器共用同一入口,判据零复算)
# ---------------------------------------------------------------------------

_FAMILY_RUNNERS: Final[dict[str, Callable[..., Awaitable[dict[str, Any]]]]] = {
    "growth": run_growth,
    "travel": run_travel,
    "activity": run_activity,
    "blackcat": run_blackcat,
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
    PATH_CHECKIN_STATUS,
    PATH_WEB_CHECKIN_STATUS,
    _webify(PATH_GROWTH_TASKS),
    _webify(PATH_GROWTH_STREAK),
    _webify(PATH_TRAVEL_STATUS),
)
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
