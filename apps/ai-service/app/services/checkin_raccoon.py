# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""商汤小浣熊(Raccoon Work)签到引擎 — 第六平台(2026-11-11 立,同日二次取证改真领取)。

**2026-11-11 15:27 更正**:当天首版曾判「本平台没有领取接口」,该结论已被推翻。
桌面端 bundle(`app.asar`,344MB)静态取证 + 真弹复核,发放面共两条:

  POST /api/web/desktop/v1/login/points/grant   → 每日 300(daily_grant)+ 桌面端登录奖励(一次性 3000)
  POST /api/web/mobile/v1/login/points/grant    → 移动端登录奖励(一次性 3000)

两条都是 **POST + 空 JSON 体 + 三个头**(`X-Client-Platform` / `X-Client-Version` /
`X-Org-Code` 可选),返回 `{code, data:{granted, popup}}`;`granted=true` 时 popup 带
`{source, display_name, points, expire_at}`。**幂等**:当天已发过 ⇒ `granted=false` /
`popup=null`(本机 15:27:40 领到 3000,15:29 复调即 false)。

因此本引擎恢复与其它五平台同形的「真领取」语义:
  - `granted=true`  ⇒ ok / status="checked" / action="checkin",credits_delta=popup.points
  - `granted=false` ⇒ ok / status="already" / action="skip_already"(**今日已领,不是错误**)
  - 401/403 ⇒ SessionDead;业务码非 0 ⇒ BusinessError;5xx/429 ⇒ SoftRate(同其它平台)

新手任务(mobile_login / desktop_login / register_pack)由**同两个发放接口**驱动,不需要
额外 claim 端点:桌面端首启调 desktop grant 即同时落 desktop_login,移动端登录事件调
mobile grant 即落 mobile_login(实测流水 `biz_type=reward_grant` / `event_name=移动端登录奖励`)。
是否顺带领一次性新手奖励由 `claim_new_user` 控制(默认读环境变量
`IHUI_RACCOON_CLAIM_NEW_USER`,缺省关):它是对**账号级一次性权益**的写动作,
不适合在每次轮询里无条件触发。

端点(基址 https://xiaohuanxiong.com):
  GET  /api/web/points/v1/balance       → available/daily/monthly/reward/topup 分项
  GET  /api/web/points/v1/tasks         → 新手任务态 + 邀请码
  POST /api/web/desktop/v1/login/points/grant  → 每日额度 / 桌面登录奖励
  POST /api/web/mobile/v1/login/points/grant   → 移动端登录奖励
鉴权:`Authorization: Bearer <JWT>`(cookie 形态实证 401,见 docs §2);令牌 30 天,
无 refresh_token ⇒ 到期只能重新登录后重采。

结构化 dict 契约与 checkin_engine / minimax / qoder / doubao 完全一致。
"""

from __future__ import annotations

import os
from typing import Any, Final

import httpx

from app.core.logging import get_logger
from app.services.checkin_engine import DEFAULT_TIMEOUT, get_http_client
from app.services.checkin_outbound import checkin_outbound_gate

logger = get_logger(__name__)

RACCOON_HOST: Final = "https://xiaohuanxiong.com"
PATH_BALANCE: Final = "/api/web/points/v1/balance"
PATH_TASKS: Final = "/api/web/points/v1/tasks"
PATH_GRANT_DESKTOP: Final = "/api/web/desktop/v1/login/points/grant"
PATH_GRANT_MOBILE: Final = "/api/web/mobile/v1/login/points/grant"

# 发放通道 → 端点 + 平台标识(bundle 内 ClientPlatform 枚举:'desktop-windows' / 'mobile-android')
GRANT_CHANNELS: Final[dict[str, tuple[str, str]]] = {
    "desktop": (PATH_GRANT_DESKTOP, "desktop-windows"),
    "mobile": (PATH_GRANT_MOBILE, "mobile-android"),
}

# 客户端版本头(与客户端同族;上游不做强校验,带上更贴近真实面)
_UA: Final = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) RaccoonWork/1.2.0 Chrome/138.0.7204.251 Safari/537.36"
)
_CLIENT_VERSION: Final = "v1.2.0"

# 新手任务键(服务端按登录事件判定;本引擎读态 + 按需领奖,不伪造登录事件)
NEW_USER_TASKS: Final = ("register_pack", "desktop_login", "mobile_login")


def raccoon_device_map_uid(device_map: dict[str, Any] | None) -> str | None:
    """号池 device_map → 展示用 uid(JWT sub,`pu-<uuid>` 形态)。"""
    dm = device_map or {}
    for key in ("uid", "user_id", "userId", "platform_user_id"):
        val = dm.get(key)
        if isinstance(val, (str, int)) and str(val).strip():
            return str(val).strip()
    return None


def _base_result(name: str, user_id: str | None) -> dict[str, Any]:
    return {
        "name": name,
        "ok": False,
        "status": "fail",
        "action": "checkin",
        "user_id": user_id,
        "code": None,
        "message": "",
        "http_status": None,
        "credits": None,
        "credits_delta": None,
        "classified_error": None,
        "warning": None,
    }


def _validate_token(token: str) -> str | None:
    """JWT 形状校验(三段 base64url)。返回错误消息或 None。"""
    tok = (token or "").strip()
    if not tok:
        return "未配置 token(小浣熊 auth.json 的 access_token),请在本机登录后重新提取"
    if tok.count(".") != 2 or len(tok) < 32:
        return "token 不是 JWT 三段式,非小浣熊访问令牌,请重新提取"
    return None


def _headers(token: str, platform: str) -> dict[str, str]:
    return {
        "authorization": f"Bearer {token}",
        "accept": "application/json, text/plain, */*",
        "user-agent": _UA,
        "X-Client-Platform": platform,
        "X-Client-Version": _CLIENT_VERSION,
    }


async def _api_get(
    path: str,
    token: str,
    *,
    timeout: float = DEFAULT_TIMEOUT,
    client: httpx.AsyncClient | None = None,
) -> tuple[int, Any]:
    """统一小浣熊 GET:Bearer 鉴权。返回 (http_status, json|None)。"""
    http = client if client is not None else get_http_client()
    url = f"{RACCOON_HOST}{path}"
    await checkin_outbound_gate.before_request("raccoon")
    try:
        resp = await http.get(url, headers=_headers(token, "desktop-windows"), timeout=timeout)
    except Exception as exc:  # 网络层:按 0 交回,由调用方判"网络异常"
        logger.warning("[checkin_raccoon] %s 请求异常: %s", path, exc)
        return 0, None
    checkin_outbound_gate.note_status(resp.status_code, "raccoon")
    try:
        return resp.status_code, resp.json()
    except Exception:
        return resp.status_code, None


async def _api_post(
    path: str,
    token: str,
    platform: str,
    *,
    timeout: float = DEFAULT_TIMEOUT,
    client: httpx.AsyncClient | None = None,
) -> tuple[int, Any]:
    """统一小浣熊 POST:空 JSON 体(发放接口只认头与鉴权)。返回 (http_status, json|None)。"""
    http = client if client is not None else get_http_client()
    url = f"{RACCOON_HOST}{path}"
    await checkin_outbound_gate.before_request("raccoon")
    try:
        resp = await http.post(url, headers=_headers(token, platform), json={}, timeout=timeout)
    except Exception as exc:
        logger.warning("[checkin_raccoon] POST %s 请求异常: %s", path, exc)
        return 0, None
    checkin_outbound_gate.note_status(resp.status_code, "raccoon")
    try:
        return resp.status_code, resp.json()
    except Exception:
        return resp.status_code, None


def parse_balance(body: dict[str, Any] | None) -> dict[str, Any]:
    """balance 响应 → {code, available, daily, reward, monthly, owner_id, message}。

    字段名按真弹响应逐字取(见 docs §3.2);任一关键字段类型不符 ⇒ 记 None
    并保留 keys 供排查,绝不猜字段。
    """
    if not isinstance(body, dict):
        return {
            "code": None,
            "available": None,
            "daily": None,
            "reward": None,
            "monthly": None,
            "owner_id": None,
            "message": "响应非 JSON",
            "keys": [],
        }
    code = body.get("code")
    data = body.get("data") if isinstance(body.get("data"), dict) else {}

    def _int(v: Any) -> int | None:
        return v if isinstance(v, int) and not isinstance(v, bool) else None

    return {
        "code": code if isinstance(code, int) and not isinstance(code, bool) else None,
        "available": _int(data.get("available_points")),
        "daily": _int(data.get("daily_points")),
        "reward": _int(data.get("reward_points")),
        "monthly": _int(data.get("monthly_points")),
        "owner_id": _int(data.get("owner_id")),
        "message": str(body.get("message") or body.get("msg") or ""),
        "keys": sorted(data.keys()) if isinstance(data, dict) else [],
    }


def parse_grant(body: dict[str, Any] | None) -> dict[str, Any]:
    """发放响应 → {code, granted, source, points, display_name, expire_at, message}。

    真弹形状:`{code:0, data:{granted:bool, popup:null|{source,display_name,points,expire_at}}}`。
    `granted` 非 bool ⇒ 记 None(未判定),不按 falsy 猜成"已领"。
    """
    if not isinstance(body, dict):
        return {
            "code": None,
            "granted": None,
            "source": None,
            "points": None,
            "display_name": None,
            "expire_at": None,
            "message": "响应非 JSON",
        }
    code = body.get("code")
    data = body.get("data") if isinstance(body.get("data"), dict) else {}
    granted = data.get("granted")
    popup = data.get("popup") if isinstance(data.get("popup"), dict) else None

    def _int(v: Any) -> int | None:
        return v if isinstance(v, int) and not isinstance(v, bool) else None

    return {
        "code": code if isinstance(code, int) and not isinstance(code, bool) else None,
        "granted": granted if isinstance(granted, bool) else None,
        "source": str(popup["source"]) if popup and isinstance(popup.get("source"), str) else None,
        "points": _int(popup.get("points")) if popup else None,
        "display_name": str(popup["display_name"]) if popup and isinstance(popup.get("display_name"), str) else None,
        "expire_at": str(popup["expire_at"]) if popup and isinstance(popup.get("expire_at"), str) else None,
        "message": str(body.get("message") or body.get("msg") or ""),
    }


def parse_tasks(body: dict[str, Any] | None) -> dict[str, Any]:
    """tasks 响应 → {code, states, invite_code, message}。

    `states` = {任务键: 状态字符串},只收 NEW_USER_TASKS 里登记过的键
    (上游新增键不静默当已知任务,原样留在 raw_keys 里供排查)。
    """
    if not isinstance(body, dict):
        return {"code": None, "states": {}, "invite_code": None, "message": "响应非 JSON", "raw_keys": []}
    code = body.get("code")
    data = body.get("data") if isinstance(body.get("data"), dict) else {}
    raw_states = data.get("new_user_task_states")
    states: dict[str, str] = {}
    raw_keys: list[str] = []
    if isinstance(raw_states, list):
        for item in raw_states:
            if not isinstance(item, dict):
                continue
            key = item.get("key")
            status = item.get("status")
            if not isinstance(key, str):
                continue
            raw_keys.append(key)
            if key in NEW_USER_TASKS and isinstance(status, str):
                states[key] = status
    invite = data.get("invite") if isinstance(data.get("invite"), dict) else {}
    invite_code = invite.get("invite_code")
    return {
        "code": code if isinstance(code, int) and not isinstance(code, bool) else None,
        "states": states,
        "invite_code": invite_code if isinstance(invite_code, str) else None,
        "message": str(body.get("message") or body.get("msg") or ""),
        "raw_keys": raw_keys,
    }


def _classify(http_status: int | None, code: int | None) -> dict[str, Any] | None:
    """HTTP/业务码 → classified_error(契约同其它平台)。"""
    if http_status in (401, 403):
        return {"type": "SessionDead", "cooldown_seconds": -1}
    if http_status == 429:
        return {"type": "SoftRate", "cooldown_seconds": 600}
    if http_status is not None and http_status >= 500:
        return {"type": "SoftRate", "cooldown_seconds": 300}
    if code is not None and code != 0:
        return {"type": "BusinessError", "cooldown_seconds": 1800}
    return None


def _new_user_summary(states: dict[str, str]) -> str:
    """新手任务态一句话(只报登记过的键,未取到就不出现)。"""
    if not states:
        return ""
    done = [k for k in NEW_USER_TASKS if states.get(k) == "completed"]
    todo = [k for k in NEW_USER_TASKS if states.get(k) not in (None, "completed")]
    parts: list[str] = []
    if done:
        parts.append(f"已完成 {'/'.join(done)}")
    if todo:
        parts.append(f"待完成 {'/'.join(todo)}")
    return ";".join(parts)


def claim_new_user_default() -> bool:
    """是否顺带领一次性新手奖励(账号级权益,默认关;`IHUI_RACCOON_CLAIM_NEW_USER=1` 开)。"""
    return os.environ.get("IHUI_RACCOON_CLAIM_NEW_USER", "").strip().lower() in ("1", "true", "yes", "on")


async def raccoon_grant_login_reward(
    token: str,
    channel: str = "desktop",
    *,
    timeout: float = DEFAULT_TIMEOUT,
    client: httpx.AsyncClient | None = None,
) -> dict[str, Any]:
    """调用一条发放接口,返回 parse_grant 结果 + http_status。

    `channel` ∈ GRANT_CHANNELS(desktop=每日额度/桌面登录奖励;mobile=移动端登录奖励)。
    """
    entry = GRANT_CHANNELS.get(channel)
    if entry is None:
        return {**parse_grant(None), "http_status": None, "message": f"未知发放通道 {channel}"}
    path, platform = entry
    status, body = await _api_post(path, token, platform, timeout=timeout, client=client)
    parsed = parse_grant(body if isinstance(body, dict) else None)
    parsed["http_status"] = status if status > 0 else None
    return parsed


async def raccoon_checkin_account(
    name: str,
    token: str,
    device_map: dict[str, Any],
    *,
    claim_new_user: bool | None = None,
    timeout: float = DEFAULT_TIMEOUT,
    client: httpx.AsyncClient | None = None,
) -> dict[str, Any]:
    """小浣熊单账号签到 = 真领取每日额度(desktop grant)。

    流程:读 balance 基线 → POST desktop grant → 按 granted 判定。
    返回值形状与 checkin_engine 五平台一致:
      - granted=true  ⇒ ok / status="checked" / action="checkin",credits_delta=本轮得分
      - granted=false ⇒ ok / status="already" / action="skip_already"(今日已发,幂等)
    `claim_new_user` 为真时额外调 mobile grant 领一次性移动端奖励(结果在
    `new_user_grant` 键;失败不影响主判定,只写 warning)。
    """
    result = _base_result(name, raccoon_device_map_uid(device_map))
    err = _validate_token(token)
    if err:
        result["message"] = err
        result["classified_error"] = {"type": "SessionDead", "cooldown_seconds": -1}
        return result

    # 1) 基线余额(失败即中止:拿不到基线就无法判 delta)
    status, body = await _api_get(PATH_BALANCE, token, timeout=timeout, client=client)
    result["http_status"] = status if status > 0 else None
    if status in (0, -1):
        result["message"] = "网络异常"
        return result
    baseline = parse_balance(body if isinstance(body, dict) else None)
    result["code"] = baseline["code"]
    if status in (401, 403):
        result["classified_error"] = {"type": "SessionDead", "cooldown_seconds": -1}
        result["message"] = f"小浣熊会话失效(HTTP {status}),请在本机登录后重新提取 auth.json"
        return result
    if baseline["code"] != 0:
        cls = _classify(status, baseline["code"])
        if cls:
            result["classified_error"] = cls
        result["message"] = f"balance 查询失败: code={baseline['code']} {baseline['message']}".strip()
        return result
    if baseline["available"] is None:
        result["message"] = f"balance 200 但 available_points 非整数(键=[{','.join(baseline['keys'])}]) ⇒ 未判定"
        return result

    result["credits"] = baseline["available"]

    # 2) 领取每日额度(desktop grant:每日 300 + 桌面端登录一次性奖励)
    grant = await raccoon_grant_login_reward(token, "desktop", timeout=timeout, client=client)
    g_status = grant["http_status"]
    if g_status in (401, 403):
        result["classified_error"] = {"type": "SessionDead", "cooldown_seconds": -1}
        result["message"] = f"发放接口会话失效(HTTP {g_status}),请重新登录客户端后重采 auth.json"
        return result
    if g_status in (0, None):
        result["message"] = "发放接口网络异常 ⇒ 未判定,本轮不记失败原因"
        return result
    result["code"] = grant["code"] if grant["code"] is not None else result["code"]
    if grant["code"] != 0:
        cls = _classify(g_status, grant["code"])
        if cls:
            result["classified_error"] = cls
        result["message"] = f"发放失败: code={grant['code']} {grant['message']}".strip()
        return result
    if grant["granted"] is None:
        result["message"] = "发放接口 200 但 granted 非布尔 ⇒ 未判定(不猜已领)"
        return result

    if grant["granted"]:
        points = grant["points"] or 0
        result.update(
            ok=True,
            status="checked",
            action="checkin",
            credits_delta=points,
            credits=baseline["available"] + points,
            message=(
                f"领取成功 +{points}({grant['display_name'] or grant['source'] or '登录奖励'});"
                f"可用 {baseline['available']} → {baseline['available'] + points}"
            ),
        )
    else:
        result.update(
            ok=True,
            status="already",
            action="skip_already",
            credits_delta=0,
            message=f"今日额度已发放(幂等 granted=false),当前可用 {baseline['available']}",
        )

    # 3) 一次性新手奖励(默认关;显式开启才动账号级权益)
    want_new_user = claim_new_user_default() if claim_new_user is None else claim_new_user
    if want_new_user:
        mobile = await raccoon_grant_login_reward(token, "mobile", timeout=timeout, client=client)
        result["new_user_grant"] = {
            "granted": mobile["granted"],
            "source": mobile["source"],
            "points": mobile["points"],
            "http_status": mobile["http_status"],
        }
        if mobile["granted"]:
            extra = mobile["points"] or 0
            result["credits_delta"] = (result["credits_delta"] or 0) + extra
            result["credits"] = (result["credits"] or 0) + extra
            result["message"] += f";移动端登录奖励 +{extra}"
        elif mobile["granted"] is None:
            result["warning"] = "移动端奖励发放未判定(granted 非布尔)"

    # 4) 新手任务态顺带核对(只读;失败不阻塞主判定)
    t_status, t_body = await _api_get(PATH_TASKS, token, timeout=timeout, client=client)
    tasks = parse_tasks(t_body if isinstance(t_body, dict) else None)
    if t_status == 200 and tasks["code"] == 0:
        summary = _new_user_summary(tasks["states"])
        if summary:
            result["warning"] = ";".join(x for x in (result["warning"], f"新手任务:{summary}") if x)
    elif t_status in (401, 403):
        result["warning"] = ";".join(x for x in (result["warning"], f"任务态未取到(HTTP {t_status}),余额面正常") if x)

    return result


async def raccoon_probe_status(
    name: str,
    token: str,
    device_map: dict[str, Any],
    *,
    timeout: float = DEFAULT_TIMEOUT,
    client: httpx.AsyncClient | None = None,
) -> tuple[bool, bool | None, int | None, str]:
    """只读探针:balance 一把梭(不触发任何写侧)。

    返回 (ok, checked_in|None, credits|None, message);`checked_in` 三态:
    True=今日额度在手(daily>0)/ False=daily=0 且今日未发 / None=未判定。
    """
    err = _validate_token(token)
    if err:
        return False, None, None, err
    status, body = await _api_get(PATH_BALANCE, token, timeout=timeout, client=client)
    if status in (0, -1):
        return False, None, None, "网络异常"
    parsed = parse_balance(body if isinstance(body, dict) else None)
    if status in (401, 403):
        return False, None, None, f"会话失效(HTTP {status})"
    if parsed["code"] != 0:
        return False, None, None, f"balance code={parsed['code']} {parsed['message']}".strip()
    if parsed["available"] is None:
        return False, None, None, "balance 形状不符(available_points 非整数)⇒ 未判定"
    daily = parsed["daily"]
    if daily is None:
        return True, None, parsed["available"], "daily_points 缺失 ⇒ 今日到账未判定"
    if daily > 0:
        return True, True, parsed["available"], f"每日额度在账(daily={daily},可用={parsed['available']})"
    return True, False, parsed["available"], f"今日每日额度未领(daily=0,可用={parsed['available']})"


async def raccoon_query_credits(
    token: str,
    device_map: dict[str, Any],
    *,
    timeout: float = DEFAULT_TIMEOUT,
    client: httpx.AsyncClient | None = None,
) -> dict[str, Any]:
    """余额查询:balance.available_points(只读,快照用)。

    返回 {"error": str|None, "remaining": int|None};契约对齐
    doubao_query_credits 供快照循环统一消费。
    """
    err = _validate_token(token)
    if err:
        return {"error": err, "remaining": None}
    status, body = await _api_get(PATH_BALANCE, token, timeout=timeout, client=client)
    if status in (0, -1):
        return {"error": "网络异常", "remaining": None}
    parsed = parse_balance(body if isinstance(body, dict) else None)
    if status in (401, 403):
        return {"error": f"会话失效(HTTP {status})", "remaining": None}
    if parsed["code"] != 0:
        return {"error": f"balance code={parsed['code']} {parsed['message']}".strip(), "remaining": None}
    if parsed["available"] is None:
        return {"error": "balance 形状不符(available_points 非整数)", "remaining": None}
    return {"error": None, "remaining": parsed["available"]}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
