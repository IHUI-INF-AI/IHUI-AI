"""Qoder(阿里 AI IDE)每日领取 Credits 引擎 — 独立平台引擎(2026-10-10 立)。

与 checkin_engine(TRAE)平级的第二平台引擎,API 契约平移自社区公开逆向成果
(MIT 授权,原始版权与来源声明在此保留):
- sunp-1/qoder-checkin(qoder_claim.py,MIT,Copyright (c) 2026 qoder-claim contributors)
- wallechfox/qoder-checkin(qoder_core.py / 01_extract.py,MIT,Copyright (c) 2026 wallechfox)

Qoder 与 TRAE 的三点本质差异(均为社区实测,本引擎按实测语义平移):
1. 鉴权是 Bearer token(非 TRAE 的 Cloud-IDE-JWT 前缀);token 存客户端本地
   auth.v1.dat(提取在桌面端 checkin_capture.rs,见其 Qoder 段)。
2. 领取是 Campaign 体系:先 GET /sash/api/v1/me/campaigns 列出活动,
   可领判据 = actionType == "CLAIM_BENEFIT" 且 claimStatus == "CLAIMABLE"
   (顶层 claimable 字段不可靠,不用);再 POST /claim 逐个领取(幂等,
   replayed=true 表示已领过)。每天 10:00(UTC+8)刷新,每天是新的 campaignId。
3. 风控面是 Cosy-* 请求头族(缺 Cosy-ClientType 时服务端静默返回 campaigns:[]),
   设备标识由桌面端提取,随 device_map 落库复用 —— 不像 TRAE 那样可以纯派生。

token 到期自刷新:POST /api/v1/deviceToken/refresh(带 refreshToken),
新 token / 新 refreshToken / expiresAt 写回 device_map 由调用方持久化
(调度器 checkin_one 的 save_device_map 通路复用)。

结构化 dict 契约与 checkin_engine.checkin_account 完全一致
(ok/status/action/user_id/code/message/http_status/credits/credits_delta/
classified_error/warning),供同一套 records/冷却/积分流水消费。
"""

from __future__ import annotations

import base64
import datetime
import json
import platform as _platform
import time
from typing import Any, Final

import httpx

from app.core.logging import get_logger
from app.services.checkin_engine import DEFAULT_TIMEOUT, get_http_client

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# 常量(平移自参考实现,端点双备份:CN 优先、国际版兜底,逐个回退)
# ---------------------------------------------------------------------------

QODER_BASES: Final = ("https://openapi.qoder.com.cn", "https://openapi.qoder.sh")
PATH_CAMPAIGNS: Final = "/sash/api/v1/me/campaigns"
PATH_CLAIM: Final = "/sash/api/v1/me/campaigns/{cid}/claim"
PATH_REFRESH: Final = "/api/v1/deviceToken/refresh"
PATH_QUOTA: Final = "/api/v2/quota/usage"

_USER_AGENT: Final = "Qoder/claim"

# Cosy-* 请求头族(风控面):device_map["cosy"] 的键 → 请求头名。
# clientType=10 是桌面端固定值(缺失时服务端 campaigns 静默为空)。
COSY_HEADER_KEYS: Final = (
    ("client_type", "Cosy-ClientType"),
    ("machine_os", "Cosy-MachineOS"),
    ("machine_hostname", "Cosy-MachineHostname"),
    ("machine_id", "Cosy-MachineId"),
    ("machine_token", "Cosy-MachineToken"),
    ("machine_code", "Cosy-MachineCode"),
    ("machine_type", "Cosy-MachineType"),
    ("version", "Cosy-Version"),
)
CLIENT_TYPE_DEFAULT: Final = "10"

REFRESH_MARGIN_HOURS: Final = 72  # token 剩余有效期低于该值时尝试自刷新
EXPIRY_WARN_HOURS: Final = 24  # token 剩余有效期低于该值时发出告警(与 TRAE 引擎一致)

# ---------------------------------------------------------------------------
# JWT 解析(Qoder token 是标准 JWT,uid 在 sub/uid/user_id/userId/id)
# ---------------------------------------------------------------------------


def qoder_extract_uid(jwt: str) -> str | None:
    """从 Qoder JWT payload 里取 uid,不校验签名。"""
    parts = (jwt or "").strip().split(".")
    if len(parts) < 2:
        return None
    try:
        pad = parts[1] + "=" * (-len(parts[1]) % 4)
        payload = json.loads(base64.urlsafe_b64decode(pad))
    except Exception:
        return None
    if not isinstance(payload, dict):
        return None
    for key in ("sub", "uid", "user_id", "userId", "id"):
        val = payload.get(key)
        if isinstance(val, (str, int)) and str(val):
            return str(val)
    return None


def qoder_jwt_exp(jwt: str) -> tuple[datetime.datetime | None, float | None]:
    """从 Qoder JWT payload 取 exp,返回 (exp_datetime, remaining_hours) 或 (None, None)。"""
    parts = (jwt or "").strip().split(".")
    if len(parts) < 2:
        return None, None
    try:
        pad = parts[1] + "=" * (-len(parts[1]) % 4)
        payload = json.loads(base64.urlsafe_b64decode(pad))
        exp = payload.get("exp")
        if not isinstance(exp, (int, float)):
            return None, None
        exp_dt = datetime.datetime.fromtimestamp(exp)
        remaining = (exp_dt - datetime.datetime.now()).total_seconds() / 3600.0
        return exp_dt, remaining
    except Exception:
        return None, None


# ---------------------------------------------------------------------------
# Cosy-* 设备头(风控面):device_map["cosy"] → 请求头
# ---------------------------------------------------------------------------


def default_machine_os() -> str:
    """本机架构 → Cosy-MachineOS 形态(平移参考实现 arch()+'_windows')。"""
    machine = _platform.machine().lower()
    arch = {"amd64": "x86_64", "x86_64": "x86_64", "aarch64": "aarch64", "arm64": "aarch64"}.get(
        machine, "x86_64"
    )
    if _platform.system() == "Darwin":
        return f"{arch}_macos"
    if _platform.system() == "Linux":
        return f"{arch}_linux"
    return f"{arch}_windows"


def build_cosy_headers(device_map: dict[str, Any]) -> dict[str, str]:
    """device_map["cosy"] → Cosy-* 请求头;缺 clientType 时补桌面端固定值 10。

    纯函数(不读环境):服务端场景设备标识全部来自落库的 device_map
    (桌面端提取后随账号录入),与 TRAE 的「确定性派生」不同 —— Qoder 的
    machineToken 等来自客户端 runtime-info.exe,派生不可行。
    """
    cosy = device_map.get("cosy")
    if not isinstance(cosy, dict):
        cosy = {}
    headers: dict[str, str] = {}
    for map_key, header in COSY_HEADER_KEYS:
        val = cosy.get(map_key)
        if isinstance(val, (str, int)) and str(val).strip():
            headers[header] = str(val).strip()
    headers.setdefault("Cosy-ClientType", CLIENT_TYPE_DEFAULT)
    if "Cosy-MachineOS" not in headers:
        headers["Cosy-MachineOS"] = default_machine_os()
    return headers


# ---------------------------------------------------------------------------
# HTTP 层(端点双备份回退:网络错/404 换下一个,其余视为该端点结论)
# ---------------------------------------------------------------------------


async def _api_call(
    path: str,
    method: str = "GET",
    token: str = "",
    body: dict[str, Any] | None = None,
    device_map: dict[str, Any] | None = None,
    timeout: float = DEFAULT_TIMEOUT,
    client: httpx.AsyncClient | None = None,
) -> tuple[int, Any]:
    """逐端点尝试,返回 (http_status:int, parsed_json:Any)。

    网络异常(含超时)→ (0, None);非 JSON 响应 → (status, None)。
    404/网络错视为「端点不对」换下一个;其余(含 401)视为结论直接返回。
    """
    headers: dict[str, str] = {
        "accept": "application/json",
        "user-agent": _USER_AGENT,
        **build_cosy_headers(device_map or {}),
    }
    if token:
        headers["authorization"] = f"Bearer {token}"
    http = client if client is not None else get_http_client()
    last: tuple[int, Any] = (0, None)
    for base in QODER_BASES:
        url = base.rstrip("/") + path
        try:
            if method == "POST":
                resp = await http.post(url, json=body or {}, headers=headers, timeout=timeout)
            else:
                resp = await http.get(url, headers=headers, timeout=timeout)
        except httpx.TimeoutException:
            last = (0, None)
            continue
        except Exception as e:
            last = (-1, f"{type(e).__name__}: {e}")
            continue
        if resp.status_code in (0, 404):
            last = (resp.status_code, None)
            continue
        try:
            return resp.status_code, json.loads(resp.text)
        except Exception:
            return resp.status_code, None
    return last


# ---------------------------------------------------------------------------
# token 自刷新(POST /api/v1/deviceToken/refresh)
# ---------------------------------------------------------------------------


async def qoder_refresh_token(
    refresh_token: str,
    device_map: dict[str, Any],
    timeout: float = DEFAULT_TIMEOUT,
    client: httpx.AsyncClient | None = None,
) -> dict[str, Any] | None:
    """用 refreshToken 换新 token;成功返回 {"access_token","refresh_token","expires_at"},失败 None。"""
    if not refresh_token:
        return None
    status, data = await _api_call(
        PATH_REFRESH, "POST", body={"refresh_token": refresh_token},
        device_map=device_map, timeout=timeout, client=client,
    )
    if status != 200 or not isinstance(data, dict):
        return None
    tok = data.get("token") or data.get("accessToken") or data.get("access_token")
    if not isinstance(tok, str) or not tok:
        return None
    new_refresh = data.get("refreshToken") or data.get("refresh_token") or refresh_token
    exp = qoder_jwt_exp(tok)[0]
    return {
        "access_token": tok,
        "refresh_token": str(new_refresh),
        "expires_at": exp.timestamp() if exp is not None else None,
    }


# ---------------------------------------------------------------------------
# 错误分类(冷却契约与 TRAE 引擎一致:-1=永久,0=不冷却,>0=冷却秒数)
# ---------------------------------------------------------------------------


def qoder_classify_error(
    http_status: int | None, message: str | None
) -> tuple[str, int]:
    """Qoder 版错误分类。业务语义(活动未下发/已领完)由调用方直接给 message,
    不落冷却(http_status 传 None)。"""
    if http_status is None:
        return "Unknown", 0
    if http_status == 401:
        return "SessionDead", -1
    if http_status == 429:
        return "SoftRate", 60
    if 500 <= http_status < 600:
        return "Server", 600
    if 400 <= http_status < 500:
        return "Client", 600
    return "Unknown", 0


# ---------------------------------------------------------------------------
# 编排:单账号领取流程(契约与 checkin_engine.checkin_account 一致)
# ---------------------------------------------------------------------------


def _claimable_campaigns(campaigns: list[Any], now: float) -> tuple[list[dict[str, Any]], bool]:
    """从 campaigns 列表提取 (可领列表, 是否存在本窗口已领记录)。

    可领 = actionType=="CLAIM_BENEFIT" 且 claimStatus=="CLAIMABLE";
    已领 = claimStatus=="CLAIMED" 且 startAt<=now<endAt(本领取窗口内)。
    """
    claimable: list[dict[str, Any]] = []
    already = False
    for c in campaigns:
        if not isinstance(c, dict) or c.get("actionType") != "CLAIM_BENEFIT":
            continue
        if c.get("claimStatus") == "CLAIMABLE":
            claimable.append(c)
        elif c.get("claimStatus") == "CLAIMED":
            start = c.get("startAt")
            end = c.get("endAt")
            if isinstance(start, (int, float)) and isinstance(end, (int, float)):
                if start <= now < end:
                    already = True
    return claimable, already


async def qoder_checkin_account(
    name: str,
    jwt: str,
    device_map: dict[str, Any],
    *,
    timeout: float = DEFAULT_TIMEOUT,
    client: httpx.AsyncClient | None = None,
) -> dict[str, Any]:
    """对单个 Qoder 账号执行领取流程,返回与 checkin_account 同契约的结构化 dict。

    流程:过期预检告警 → (即将过期且有 refreshToken 时自刷新) → GET campaigns →
    逐个 POST claim → 汇总 credits。新 token 写回 device_map(调用方持久化)。
    """
    result: dict[str, Any] = {
        "name": name,
        "ok": False,
        "status": "fail",
        "action": "claim",
        "user_id": None,
        "code": None,
        "message": "",
        "http_status": None,
        "credits": None,
        "credits_delta": None,
        "classified_error": None,
        "warning": None,
    }

    if not jwt:
        result["message"] = "未配置 token"
        return result

    user_id = qoder_extract_uid(jwt)
    result["user_id"] = user_id
    if not user_id:
        result["message"] = "无法从 token 解析 uid"
        return result

    # 过期预检 + 自刷新(写回 device_map 由调用方 save_device_map 落库)
    exp_dt, remaining = qoder_jwt_exp(jwt)
    if remaining is not None:
        if remaining < 0:
            result["warning"] = f"token 已过期({exp_dt:%Y-%m-%d %H:%M}),请重新提取"
        elif remaining < EXPIRY_WARN_HOURS:
            result["warning"] = f"token 将于 {remaining:.1f}h 后过期({exp_dt:%Y-%m-%d %H:%M})"
        if result["warning"]:
            refreshed = await qoder_refresh_token(
                str(device_map.get("refresh_token") or ""), device_map, timeout, client
            )
            if refreshed is not None:
                jwt = refreshed["access_token"]
                device_map["refresh_token"] = refreshed["refresh_token"]
                device_map["expires_at"] = refreshed["expires_at"]
                result["warning"] = None
                logger.info("Qoder token 已自刷新", name=name, user_id=user_id)
            else:
                logger.warning("Qoder token 告警且刷新失败", name=name, warning=result["warning"])

    async def _campaigns() -> tuple[int, Any]:
        return await _api_call(
            PATH_CAMPAIGNS, "GET", token=jwt, device_map=device_map, timeout=timeout, client=client
        )

    status, data = await _campaigns()
    if status == 401:
        # 401 → 强制刷新一次后重试;再 401 = SessionDead
        refreshed = await qoder_refresh_token(
            str(device_map.get("refresh_token") or ""), device_map, timeout, client
        )
        if refreshed is not None:
            jwt = refreshed["access_token"]
            device_map["refresh_token"] = refreshed["refresh_token"]
            device_map["expires_at"] = refreshed["expires_at"]
            status, data = await _campaigns()
    if status in (0, -1):
        result["message"] = "网络异常" if status == 0 else (f"网络异常: {data}" if data else "网络异常")
        result["http_status"] = None
        return result
    if status != 200 or not isinstance(data, dict):
        error_type, cooldown_secs = qoder_classify_error(status if status >= 400 else None, None)
        result["message"] = f"活动查询失败 HTTP {status}"
        if error_type not in ("Unknown",):
            result["classified_error"] = {"type": error_type, "cooldown_seconds": cooldown_secs}
        return result

    campaigns = data.get("campaigns")
    if not isinstance(campaigns, list):
        campaigns = []
    now = time.time()
    claimable, already_claimed = _claimable_campaigns(campaigns, now)

    if already_claimed and not claimable:
        result.update(ok=True, status="already", action="skip_already", code=0, message="今日已领取")
        return result

    granted = 0
    claimed_ok = False
    last_status: int | None = None
    for camp in claimable:
        cid = str(camp.get("campaignId") or "")
        if not cid:
            continue
        c_status, c_data = await _api_call(
            PATH_CLAIM.replace("{cid}", cid), "POST", token=jwt,
            body={}, device_map=device_map, timeout=timeout, client=client,
        )
        last_status = c_status
        data_field = c_data.get("data") if isinstance(c_data, dict) else None
        payload = data_field if isinstance(data_field, dict) else (c_data if isinstance(c_data, dict) else {})
        if c_status == 200 and payload.get("status") == "CLAIMED":
            claimed_ok = True
            raw_benefit = payload.get("benefit")
            benefit = raw_benefit if isinstance(raw_benefit, dict) else {}
            amount = benefit.get("amount")
            if amount is None:
                camp_benefit = camp.get("benefit")
                camp_benefit = camp_benefit if isinstance(camp_benefit, dict) else {}
                amount = camp_benefit.get("amount")
            if isinstance(amount, (int, float)):
                granted += int(amount)
        elif c_status in (0, -1):
            result["message"] = "网络异常"
            result["http_status"] = None
            return result

    if claimed_ok:
        result.update(
            ok=True,
            status="success",
            action="claim_ok",
            code=0,
            message=f"领取成功 +{granted} Credits",
            http_status=200,
            credits=granted,
            credits_delta=granted,
        )
        logger.info("Qoder 领取成功", name=name, user_id=user_id, credits=granted)
        return result

    if claimable:
        # 有可领活动但领取失败 → 按状态分类(401 已在上方处理过,此处多为 4xx/5xx)
        error_type, cooldown_secs = qoder_classify_error(last_status, None)
        result["message"] = f"领取失败 HTTP {last_status}"
        result["http_status"] = last_status
        if error_type not in ("Unknown",):
            result["classified_error"] = {"type": error_type, "cooldown_seconds": cooldown_secs}
        return result

    # 无可领且本窗口无已领记录 → 活动未下发/已结束(业务语义,不落冷却)
    result["message"] = "活动未下发或已结束(等下一轮)"
    return result


# ---------------------------------------------------------------------------
# 余额查询(POST 消费方:query_credits 路由 + 每日快照 job)
# ---------------------------------------------------------------------------


async def qoder_query_credits(
    jwt: str,
    device_map: dict[str, Any],
    timeout: float = DEFAULT_TIMEOUT,
    client: httpx.AsyncClient | None = None,
) -> dict[str, Any]:
    """查询账号 Add-on Credits 余额(GET /api/v2/quota/usage → addOnQuota.remaining)。

    响应结构存在未知细节,防御性解析(与 checkin_credits.query_remaining_credits
    同一契约):任何失败返回 {"remaining": None, "packs": [], "error": "..."},
    绝不向调用方抛栈。401 → refresh 换新后重试一次(与 checkin 主链路同款;
    新 token/refresh_token/expires_at 写回 device_map,由调用方落库)。
    """
    token = (jwt or "").strip()
    if not token:
        return {"remaining": None, "packs": [], "error": "token 为空"}
    status, data = await _api_call(
        PATH_QUOTA, "GET", token=token, device_map=device_map, timeout=timeout, client=client
    )
    if status == 401:
        refreshed = await qoder_refresh_token(
            str(device_map.get("refresh_token") or ""), device_map, timeout, client
        )
        if refreshed is not None:
            token = str(refreshed["access_token"])
            device_map["refresh_token"] = refreshed["refresh_token"]
            device_map["expires_at"] = refreshed["expires_at"]
            status, data = await _api_call(
                PATH_QUOTA, "GET", token=token, device_map=device_map, timeout=timeout,
                client=client,
            )
    if status in (0, -1):
        return {"remaining": None, "packs": [], "error": "网络异常"}
    if status != 200 or not isinstance(data, dict):
        return {"remaining": None, "packs": [], "error": f"余额接口 HTTP {status}"}
    data_field = data.get("data") if isinstance(data.get("data"), dict) else None
    inner = data_field if isinstance(data_field, dict) else data
    addon_raw = inner.get("addOnQuota")
    addon = addon_raw if isinstance(addon_raw, dict) else {}
    if not addon:
        addon_alt = inner.get("add_on_quota")
        addon = addon_alt if isinstance(addon_alt, dict) else {}
    remaining = addon.get("remaining")
    if isinstance(remaining, bool) or not isinstance(remaining, (int, float)):
        return {"remaining": None, "packs": [], "error": "addOnQuota.remaining 解析结果异常"}
    return {"remaining": int(remaining), "packs": [], "error": None}
# ⁠[IHUI-AI-PROVENANCE-TAIL]
