# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""ZCode(zcode.z.ai 桌面客户端)每日波谷额度领取引擎 — 第七平台(2026-11-12 立)。

契约来源(逆向-复现-超越四步,取证见 ZCode 3.17.2 客户端包内证据):
- 领取端点与信封 = 客户端计划服务里 claimManualPlan / getManualClaimPlanPreviews
  两函数读出的真实网络面(只观察行为与契约,不复制对方代码):
    GET  https://zcode.z.ai/api/v1/zcode-plan/billing/preview?app_version=&platform=
         → {code, msg, data:{server_time, plans:[{plan_id, name, entitlements[…]}]}}
           data.plans = **今日可手动领取的计划清单**(空 ⇒ 无可领)
    POST https://zcode.z.ai/api/v1/zcode-plan/billing/claim
         body {plan_id} → {code, msg, data:{plan:{…, ends_at}, server_time}}
- 票 = zcodejwttoken(plan 通道实弹实证 balance 端点只认它;oauth access_token ⇒ 401,
  见 apps/api zcode-adapter 头注与 2026-10-27 实弹闭环),以 Authorization Bearer 携带;
- 请求头族(实弹:缺 X-Device-Mid / X-ZCode-App-Version ⇒ 400 parameter error):
  X-Device-Mid 账号级稳定(池内 deviceId 优先,缺失时按账号 uid 确定性派生 UUID 形,
  与 api 侧 zcodeDeviceMid 同一算法族)、X-ZCode-App-Version、X-Platform=windows-x64、
  X-Client-Language / X-Client-Timezone / X-Os-Category、User-Agent=ZCode/<版本>。
- 活动口径(官方公告,2026-10-27 起常态化):每人每天 3 亿 GLM-5.3-Flash tokens,
  北京时间 19:00(UTC 11:00)开放领取,23:00–次日 09:00 可用,当日清零不累计;
  免费账号(无 Coding Plan)同样可领 ⇒ 19:05 主窗口 + 20:30/22:00 补跑的节奏。

结构化 dict 契约与 checkin_engine / doubao / minimax / qoder 完全一致;
credits 语义 = 本次领取计划的 grant_units 合计(额度计数,**不是**积分数,
快照面按 credits_note 如实标注)。
"""

from __future__ import annotations

import hashlib
from typing import Any, Final

import httpx

from app.core.logging import get_logger
from app.services.checkin_engine import DEFAULT_TIMEOUT, get_http_client
from app.services.checkin_outbound import checkin_outbound_gate

logger = get_logger(__name__)

ZCODE_PLAN_BASE: Final = "https://zcode.z.ai"
PATH_PREVIEW: Final = "/api/v1/zcode-plan/billing/preview"
PATH_CLAIM: Final = "/api/v1/zcode-plan/billing/claim"
# 与 api 侧 zcode-adapter 同源档位(客户端当前发行版实证可打)
PLAN_APP_VERSION: Final = "3.16.3"

# 业务码(公开文档口径:1000=身份验证失败,1001=缺 Authorization)
_CODE_AUTH_FAIL: Final = 1000
_CODE_NO_AUTH: Final = 1001


def _uuid_from_seed(seed: str) -> str:
    """账号级稳定设备 mid 派生(与 api 侧 zcodeDeviceMid 同族算法:
    sha256 域分隔摘要 → UUID 8-4-4-4-12 形,版本位 4、variant 位 8..b)。"""
    h = hashlib.sha256(f"zcode-mid:v1:{seed}".encode()).hexdigest()[:32]
    variant = format(((int(h[16], 16) & 0x3) | 0x8), "x")
    return f"{h[:8]}-{h[8:12]}-4{h[13:16]}-{variant}{h[17:20]}-{h[20:32]}"


def device_mid_for(device_map: dict[str, Any] | None, uid: str) -> str:
    """X-Device-Mid:池内真实 deviceId 优先原样透传,缺失按账号 uid 确定性派生。"""
    dm = device_map or {}
    stored = dm.get("pool_device_id") or dm.get("device_id")
    if isinstance(stored, str) and stored.strip():
        return stored.strip()
    seed = str(uid or "").strip()
    if not seed:
        raise ValueError("ZCode X-Device-Mid 未判定:无 deviceId 且无 uid 可派生")
    return _uuid_from_seed(seed)


def plan_token_of(token: str, device_map: dict[str, Any] | None) -> str:
    """plan 通道票 = zcodejwttoken(实弹:oauth access_token 打 plan 端点 ⇒ 401)。
    引擎收到的 token 通常是 oauth access(号池导入槽首位);device_map 若带
    plan 票则优先,否则原样透交(由调用面/回灌保证带对位)。"""
    dm = device_map or {}
    for key in ("zcode_plan_jwt", "zcodejwttoken"):
        v = dm.get(key)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return (token or "").strip()


def _headers(jwt: str, mid: str) -> dict[str, str]:
    return {
        "accept": "application/json",
        "authorization": f"Bearer {jwt}",
        "user-agent": f"ZCode/{PLAN_APP_VERSION}",
        "X-Device-Mid": mid,
        "X-ZCode-App-Version": PLAN_APP_VERSION,
        "X-Platform": "windows-x64",
        "X-Client-Language": "zh-CN",
        "X-Client-Timezone": "Asia/Shanghai",
        "X-Os-Category": "windows",
    }


def _base_result(name: str, user_id: str | None) -> dict[str, Any]:
    return {
        "name": name,
        "ok": False,
        "status": "fail",
        "action": "claim",
        "user_id": user_id,
        "code": None,
        "message": "",
        "http_status": None,
        "credits": None,
        "credits_delta": None,
        "classified_error": None,
        "warning": None,
    }


async def _plan_request(
    method: str,
    path: str,
    jwt: str,
    mid: str,
    *,
    params: dict[str, str] | None = None,
    body: dict[str, Any] | None = None,
    timeout: float = DEFAULT_TIMEOUT,
    client: httpx.AsyncClient | None = None,
) -> tuple[int, Any]:
    http = client if client is not None else get_http_client()
    url = f"{ZCODE_PLAN_BASE}{path}"
    await checkin_outbound_gate.before_request("zcode")
    resp = await http.request(
        method,
        url,
        headers={**_headers(jwt, mid), **({"content-type": "application/json"} if body is not None else {})},
        params=params,
        json=body,
        timeout=timeout,
    )
    checkin_outbound_gate.note_status(resp.status_code, "zcode")
    try:
        return resp.status_code, resp.json()
    except Exception:
        return resp.status_code, None


def parse_preview(body: dict[str, Any] | None) -> dict[str, Any]:
    """preview 信封 → {code, plans:[{plan_id,name,grant_units}], message}。

    grant_units = 该计划各 entitlement 可领单位合计(展示用,非积分数)。
    """
    if not isinstance(body, dict):
        return {"code": None, "plans": [], "message": "响应非 JSON"}
    code = body.get("code") if isinstance(body.get("code"), int) else None
    data_raw = body.get("data")
    data: dict[str, Any] = data_raw if isinstance(data_raw, dict) else {}
    plans: list[dict[str, Any]] = []
    plans_raw = data.get("plans")
    for p in plans_raw if isinstance(plans_raw, list) else []:
        if not isinstance(p, dict):
            continue
        plan_id = str(p.get("plan_id") or "").strip()
        if not plan_id:
            continue
        grants = 0
        ent_raw = p.get("entitlements")
        for ent in ent_raw if isinstance(ent_raw, list) else []:
            if isinstance(ent, dict) and isinstance(ent.get("grant_units"), (int, float)):
                grants += int(ent["grant_units"])
        plans.append({"plan_id": plan_id, "name": str(p.get("name") or plan_id), "grant_units": grants})
    return {
        "code": code,
        "plans": plans,
        "message": str(body.get("msg") or body.get("message") or ""),
    }


def _classify(http_status: int | None, biz_code: int | None) -> dict[str, Any] | None:
    """鉴权层失败 → SessionDead 永久冷却;**刻意不给 4xx"活动未下发"形设冷却**
    —— 上游可能在 19:00 后延迟下发(qoder 10:00 同型实测),补跑轮只挑今日无
    确定结果的号重试,冷却反而会把当天真窗口挡掉。"""
    if http_status in (401, 403) or biz_code in (_CODE_AUTH_FAIL, _CODE_NO_AUTH):
        return {"type": "SessionDead", "cooldown_seconds": -1}
    if http_status is not None and http_status >= 500:
        return {"type": "SoftRate", "cooldown_seconds": 300}
    return None


async def zcode_claim_account(
    name: str,
    token: str,
    device_map: dict[str, Any],
    *,
    timeout: float = DEFAULT_TIMEOUT,
    client: httpx.AsyncClient | None = None,
) -> dict[str, Any]:
    """单号一次节拍:preview(只读预检)→ 逐计划 claim。幂等性由上游保证
    (已领计划不再出现在 preview ⇒ 空清单即「今日已领/无可领」)。"""
    dm = device_map or {}
    uid = str(dm.get("pool_uid") or dm.get("uid") or name or "")
    result = _base_result(name, uid)
    jwt = plan_token_of(token, dm)
    if not jwt:
        result["message"] = "未配置 zcodejwttoken(plan 票),请从 ZCode 客户端重新捕获登录态"
        return result
    try:
        mid = device_mid_for(dm, uid)
    except ValueError as e:
        result["message"] = str(e)
        return result

    # 1) 只读预检
    p_status, p_body = await _plan_request(
        "GET", PATH_PREVIEW, jwt, mid,
        params={"app_version": PLAN_APP_VERSION, "platform": "windows-x64"},
        timeout=timeout, client=client,
    )
    result["http_status"] = p_status if p_status > 0 else None
    parsed = parse_preview(p_body if isinstance(p_body, dict) else None)
    result["code"] = parsed["code"]
    if p_status in (0, -1):
        result["message"] = "网络异常"
        return result
    cls = _classify(p_status, parsed["code"])
    if cls:
        result["classified_error"] = cls
        result["message"] = f"preview 鉴权失败: code={parsed['code']} {parsed['message']}".strip()
        return result
    if parsed["code"] not in (0, None):
        # 窗口未开/活动未下发形:判失败但**不冷却**,补跑覆盖
        result["message"] = f"preview 非成功码: code={parsed['code']} {parsed['message']}".strip()
        return result
    if not parsed["plans"]:
        result.update(ok=True, status="ok", action="skip_already", message="无可领计划(今日已领或活动未下发)")
        return result

    # 2) 逐计划领取(清单即「可手动领取」集合;单计划失败不拖垮其余)
    claimed_ids: list[str] = []
    total_units = 0
    last_code: int | None = None
    last_msg = ""
    failed_cls: dict[str, Any] | None = None
    for plan in parsed["plans"]:
        c_status, c_body = await _plan_request(
            "POST", PATH_CLAIM, jwt, mid,
            body={"plan_id": plan["plan_id"]},
            timeout=timeout, client=client,
        )
        cj = c_body if isinstance(c_body, dict) else None
        c_code = cj.get("code") if cj and isinstance(cj.get("code"), int) else None
        last_code = c_code
        if c_status in (0, -1):
            last_msg = "领取网络异常"
            continue
        cls = _classify(c_status, c_code)
        if cls and cls["type"] == "SessionDead":
            result["classified_error"] = cls
            result["message"] = f"领取鉴权失效(code={c_code})"
            return result
        if c_code == 0:
            claimed_ids.append(plan["plan_id"])
            total_units += int(plan.get("grant_units") or 0)
            continue
        failed_cls = cls
        last_msg = f"claim 失败 plan={plan['plan_id']} code={c_code} {(cj or {}).get('msg') if isinstance(cj, dict) else ''}".strip()
    result["http_status"] = 200 if claimed_ids else result["http_status"]
    result["code"] = last_code
    if claimed_ids:
        result.update(
            ok=True,
            status="ok",
            action="claim_ok",
            message=f"领取成功 {len(claimed_ids)} 项(波谷额度 grant_units 合计 {total_units},非积分)",
            credits=total_units,
            credits_delta=total_units,
        )
        return result
    if failed_cls:
        result["classified_error"] = failed_cls
    result["message"] = last_msg or "领取失败:上游未返回可领结果"
    return result


async def zcode_probe_status(
    name: str,
    token: str,
    device_map: dict[str, Any],
    *,
    timeout: float = DEFAULT_TIMEOUT,
    client: httpx.AsyncClient | None = None,
) -> tuple[bool, bool | None, int | None, str]:
    """只读探针:GET preview(plans 非空 ⇒ 当前有可领项=「未领」)。不触发写侧。"""
    dm = device_map or {}
    uid = str(dm.get("pool_uid") or dm.get("uid") or name or "")
    jwt = plan_token_of(token, dm)
    if not jwt:
        return False, None, None, "未配置 zcodejwttoken(plan 票)"
    try:
        mid = device_mid_for(dm, uid)
    except ValueError as e:
        return False, None, None, str(e)
    p_status, p_body = await _plan_request(
        "GET", PATH_PREVIEW, jwt, mid,
        params={"app_version": PLAN_APP_VERSION, "platform": "windows-x64"},
        timeout=timeout, client=client,
    )
    parsed = parse_preview(p_body if isinstance(p_body, dict) else None)
    if p_status in (0, -1):
        return False, None, None, "网络异常"
    if parsed["code"] not in (0, None):
        return False, None, None, f"preview code={parsed['code']} {parsed['message']}".strip()
    units = sum(int(p.get("grant_units") or 0) for p in parsed["plans"])
    if parsed["plans"]:
        return True, False, units or None, f"当前有 {len(parsed['plans'])} 项可领额度"
    return True, True, None, "无可领计划(今日已领或活动未下发)"


async def zcode_query_credits(
    token: str,
    device_map: dict[str, Any],
    *,
    timeout: float = DEFAULT_TIMEOUT,
    client: httpx.AsyncClient | None = None,
) -> dict[str, Any]:
    """额度查询:GET billing/balance(实弹闭环端点,camelCase jwt 槽同样只认
    zcodejwttoken)。返回 {error, remaining}:remaining=当前计划 grant_units 合计。"""
    dm = device_map or {}
    uid = str(dm.get("pool_uid") or dm.get("uid") or "")
    jwt = plan_token_of(token, dm)
    if not jwt:
        return {"error": "未配置 zcodejwttoken(plan 票)", "remaining": None}
    try:
        mid = device_mid_for(dm, uid)
    except ValueError as e:
        return {"error": str(e), "remaining": None}
    b_status, b_body = await _plan_request(
        "GET", "/api/v1/zcode-plan/billing/balance", jwt, mid,
        params={"app_version": PLAN_APP_VERSION},
        timeout=timeout, client=client,
    )
    if b_status in (0, -1):
        return {"error": "网络异常", "remaining": None}
    if not isinstance(b_body, dict):
        return {"error": f"balance 响应非 JSON(HTTP {b_status})", "remaining": None}
    code = b_body.get("code") if isinstance(b_body.get("code"), int) else None
    if code != 0:
        return {"error": f"balance code={code} {b_body.get('msg') or ''}".strip(), "remaining": None}
    b_data_raw = b_body.get("data")
    data: dict[str, Any] = b_data_raw if isinstance(b_data_raw, dict) else {}
    total = 0
    bp_raw = data.get("plans")
    for bp in bp_raw if isinstance(bp_raw, list) else []:
        if not isinstance(bp, dict):
            continue
        be_raw = bp.get("entitlements")
        for be in be_raw if isinstance(be_raw, list) else []:
            if isinstance(be, dict) and isinstance(be.get("grant_units"), (int, float)):
                total += int(be["grant_units"])
    return {"error": None, "remaining": total}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
