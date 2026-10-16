# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""MiniMax Code(MiniMax Agent CN)每日签到引擎 — 第四平台(2026-10-15 立)。

契约来源(三重实证):
- 桌面端 3.1.1 本机 api 日志(agent.minimax.cn 真请求:host/signin 端点/
  设备参数真值/Authorization Bearer 头形态);
- 社区公开逆向(welldo/QinglongMy minimax_checkin.py:yy/x-signature 签名
  算法与设备参数顺序);
- 本机真 token 实测:renewal 直取 OAuth accessToken(mmoat_) →
  status 200 / claim 200(claim_result=2 已领幂等)。

端点(CN):
  POST {host}/minimax-cloud/api/v1/signin/claim   body {} → data.claim_result
  GET  {host}/minimax-cloud/api/v1/signin/status          → data.days[7 天进度]
鉴权:Authorization: Bearer <accessToken> + X-User-Id 头(服务端 query 必填
user_id,缺失 401)。
签名(与桌面端拦截器一致):
  x-signature = md5("{now_sec}I*7Cf%WZ#S&%1RlZJ&C2{body_str}")
  yy          = md5(encodeURIComponent(path?query) + "_" + "{}" + md5(now_ms) + "ooui")
设备参数 22+1 项顺序严格对齐桌面端 mC();实测服务端不严格校验其值
(伪造 uuid/device_id 仍 200),但顺序影响 yy,必须钉死。
结构化 dict 契约与 checkin_engine / qoder / workbuddy 完全一致。
"""

from __future__ import annotations

import hashlib
import json
import time
import urllib.parse
from typing import Any, Final

import httpx

from app.core.logging import get_logger
from app.services.checkin_engine import DEFAULT_TIMEOUT, get_http_client
from app.services.checkin_outbound import CHALLENGE_COOLDOWN_SECONDS, checkin_outbound_gate

logger = get_logger(__name__)

MINIMAX_HOST_CN: Final = "https://agent.minimax.cn"
MINIMAX_HOST_IO: Final = "https://agent.minimax.io"
PATH_SIGNIN_STATUS: Final = "/minimax-cloud/api/v1/signin/status"
PATH_SIGNIN_CLAIM: Final = "/minimax-cloud/api/v1/signin/claim"
_SIGN_SALT: Final = "I*7Cf%WZ#S&%1RlZJ&C2"
_UA: Final = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) MiniMaxAgent/desktop Chrome/124.0 Safari/537.36"
)

# 设备参数顺序(严格对齐桌面端 mC();顺序进 yy 签名,值服务端不严格校验)
DEVICE_PARAM_ORDER: Final = [
    "device_platform", "biz_id", "app_id", "version_code", "unix",
    "timezone_offset", "is_desktop", "desktop_version", "sys_language",
    "lang", "uuid", "device_id", "os_name", "browser_name", "device_memory",
    "cpu_core_num", "browser_language", "browser_platform", "user_id",
    "op_ticket", "screen_width", "screen_height", "client",
]

_CLAIM_RESULT_OK: Final = 0  # data.claim_result: 0=新领取成功
_CLAIM_RESULT_ALREADY: Final = 2  # 2=今日已领(幂等成功)


# ---------------------------------------------------------------------------
# 纯函数(单测直跑):签名与设备参数
# ---------------------------------------------------------------------------

def _md5_hex(s: str) -> str:
    return hashlib.md5(s.encode("utf-8")).hexdigest()


def encode_uri_component(s: str) -> str:
    """忠实复刻 JavaScript encodeURIComponent(UTF-8 字节 + 大写 %XX)。

    仅放行 A-Za-z0-9-_.!~*'();urllib.parse.quote 的 always-safe 集恰为此集,
    且按 UTF-8 字节编码(社区旧实现的 ord() 码点十六进制对非 ASCII 会漂移,
    设备参数实际全 ASCII 时等价,但钉死 JS 语义防参数带中文时签名错)。
    """
    return urllib.parse.quote(s, safe="-_.!~*'()")


def build_device_params(user_id: str, device_id: str = "", uuid_str: str = "") -> dict[str, str]:
    """设备参数字典(值含合理默认;顺序由 DEVICE_PARAM_ORDER 钉死)。

    服务端实测不严格校验 uuid/device_id(伪造仍 200),但 user_id 必须真。
    """
    now_ms = int(round(time.time() * 1000))
    values = {
        "device_platform": "web",
        "biz_id": "3",
        "app_id": "3001",
        "version_code": "22201",
        "unix": str(now_ms),
        "timezone_offset": "28800",
        "is_desktop": "1",
        "desktop_version": "3.1.1",
        "sys_language": "zh",
        "lang": "zh",
        "uuid": uuid_str or "00000000-0000-4000-8000-000000000000",
        "device_id": device_id or "0",
        "os_name": "Windows",
        "browser_name": "Chrome",
        "device_memory": "32",
        "cpu_core_num": "20",
        "browser_language": "zh-CN",
        "browser_platform": "Win32",
        "user_id": str(user_id),
        "op_ticket": "undefined",
        "screen_width": "2294",
        "screen_height": "960",
        "client": "desktop",
    }
    return {k: values[k] for k in DEVICE_PARAM_ORDER}


def sign_headers(path: str, params: dict[str, str], method: str, body: dict[str, Any] | None) -> tuple[str, dict[str, str]]:
    """计算 (url_query, headers)。now_ms 取自 params['unix'](调用方保证一致)。"""
    now_ms = int(params["unix"])
    now_sec = now_ms // 1000
    query = urllib.parse.urlencode(params)
    has_search_params_path = f"{path}?{query}"
    body_str = "" if method.upper() == "GET" else json.dumps(body or {}, ensure_ascii=False)
    x_signature = _md5_hex(f"{now_sec}{_SIGN_SALT}{body_str}")
    inner = _md5_hex(str(now_ms))
    yy = _md5_hex(encode_uri_component(has_search_params_path) + "_" + "{}" + inner + "ooui")
    headers = {
        "Authorization": "",  # 由调用方填 Bearer token(不参与签名)
        "yy": yy,
        "x-timestamp": str(now_sec),
        "x-signature": x_signature,
        "origin": MINIMAX_HOST_CN,
        "referer": MINIMAX_HOST_CN + "/",
        "user-agent": _UA,
        "content-type": "application/json",
    }
    return query, headers


def parse_claim_result(body: dict[str, Any]) -> tuple[bool, str, int | None]:
    """claim 响应 → (是否成功态, action, credits_delta)。

    claim_result: 0=新领取成功;2=今日已领(幂等成功);其它=失败。
    """
    data = body.get("data")
    if not isinstance(data, dict):
        return False, "checkin", None
    result = data.get("claim_result")
    points = data.get("points")
    credits = points if isinstance(points, int) else None
    if result == _CLAIM_RESULT_OK:
        return True, "claim_ok", credits
    if result == _CLAIM_RESULT_ALREADY:
        return True, "skip_already", None
    return False, "checkin", None


def parse_status_days(body: dict[str, Any]) -> int:
    """status 响应 → 已签天数(days[].status==3 计数;仅供展示/预检)。"""
    data = body.get("data")
    if not isinstance(data, dict):
        return 0
    days = data.get("days")
    if not isinstance(days, list):
        return 0
    return sum(1 for d in days if isinstance(d, dict) and d.get("status") == 3)


# ---------------------------------------------------------------------------
# HTTP 层
# ---------------------------------------------------------------------------

def minimax_host(device_map: dict[str, Any] | None) -> str:
    dm = device_map or {}
    host = str(dm.get("host") or "").strip().rstrip("/")
    return host or MINIMAX_HOST_CN


def minimax_device_map_uid(device_map: dict[str, Any]) -> str | None:
    for key in ("uid", "user_id", "userId"):
        val = device_map.get(key)
        if isinstance(val, (str, int)) and str(val).strip():
            return str(val).strip()
    return None


async def _mm_request(
    path: str,
    token: str,
    user_id: str,
    method: str = "GET",
    body: dict[str, Any] | None = None,
    host: str = MINIMAX_HOST_CN,
    timeout: float = DEFAULT_TIMEOUT,
    client: httpx.AsyncClient | None = None,
    device_id: str = "",
    uuid_str: str = "",
) -> tuple[int, Any]:
    params = build_device_params(user_id, device_id=device_id, uuid_str=uuid_str)
    query, headers = sign_headers(path, params, method, body)
    headers["Authorization"] = f"Bearer {token}"
    http = client if client is not None else get_http_client()
    url = f"{host}{path}?{query}"
    await checkin_outbound_gate.before_request("minimax")
    if method.upper() == "GET":
        resp = await http.get(url, headers=headers, timeout=timeout)
    else:
        resp = await http.post(url, headers=headers, json=body or {}, timeout=timeout)
    checkin_outbound_gate.note_status(resp.status_code, "minimax")
    try:
        return resp.status_code, resp.json()
    except Exception:
        return resp.status_code, None


# ---------------------------------------------------------------------------
# 编排:单账号签到(契约与其它平台一致)
# ---------------------------------------------------------------------------

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


def minimax_classify_error(http_status: int | None) -> tuple[str, int]:
    if http_status is None:
        return "Unknown", 0
    if http_status in (401, 403):
        return "SessionDead", -1
    if http_status == 429:
        return "SoftRate", 60
    if 500 <= http_status < 600:
        return "Server", 600
    if 400 <= http_status < 500:
        return "Client", 600
    return "Unknown", 0


async def minimax_checkin_account(
    name: str,
    token: str,
    device_map: dict[str, Any],
    *,
    timeout: float = DEFAULT_TIMEOUT,
    client: httpx.AsyncClient | None = None,
) -> dict[str, Any]:
    """MiniMax 单账号签到:先 claim(幂等,已领返回成功态),失败再查 status 归因。"""
    result = _base_result(name, minimax_device_map_uid(device_map))
    user_id = result["user_id"]
    if not user_id:
        result["message"] = "device_map 缺 uid(user_id 必填,缺失网关 401),请重新本机捕获"
        return result
    tok = (token or "").strip()
    if not tok:
        result["message"] = "未配置 token(accessToken),请重新本机捕获"
        return result

    host = minimax_host(device_map)
    device_id = str(device_map.get("device_id") or "")
    uuid_str = str(device_map.get("uuid") or "")

    status, data = await _mm_request(
        PATH_SIGNIN_CLAIM, tok, user_id, method="POST", body={},
        host=host, timeout=timeout, client=client,
        device_id=device_id, uuid_str=uuid_str,
    )
    result["http_status"] = status if status > 0 else None
    if status in (0, -1):
        result["message"] = "网络异常"
        return result
    if status in (401, 403):
        etype, secs = minimax_classify_error(status)
        result["classified_error"] = {"type": etype, "cooldown_seconds": secs}
        result["message"] = "token 无效或过期(HTTP 401/403),请打开 MiniMax Code 刷新后重新捕获"
        return result
    if status >= 400:
        etype, secs = minimax_classify_error(status)
        result["classified_error"] = {"type": etype, "cooldown_seconds": secs}
        result["message"] = f"签到失败: HTTP {status}"
        return result
    if not isinstance(data, dict):
        result["message"] = f"签到失败: 响应非 JSON(HTTP {status})"
        # 第五件套(2026-10-16):2xx 非 JSON = WAF/挑战页插页,即时熔断
        # (403 保持本平台既有 SessionDead 永久冷却语义,比 Challenge 更保守)
        result["classified_error"] = {
            "type": "Challenge",
            "cooldown_seconds": CHALLENGE_COOLDOWN_SECONDS,
        }
        checkin_outbound_gate.note_challenge("minimax")
        return result

    ok, action, credits = parse_claim_result(data)
    result["code"] = data.get("code") if isinstance(data.get("code"), int) else None
    if ok:
        result.update(
            ok=True,
            status="already" if action == "skip_already" else "ok",
            action=action,
            message="今日已签到,无需重复领取" if action == "skip_already" else "签到成功",
            credits_delta=credits,
        )
        return result
    # claim 未成功:查 status 给出可读归因(已签/未开放/服务端消息)
    s_status, s_data = await _mm_request(
        PATH_SIGNIN_STATUS, tok, user_id, method="GET",
        host=host, timeout=timeout, client=client,
        device_id=device_id, uuid_str=uuid_str,
    )
    msg = ""
    if isinstance(s_data, dict):
        msg = str(s_data.get("message") or s_data.get("msg") or "")
    detail = data.get("message") or data.get("msg") or ""
    result["message"] = "签到未成功" + (f": {detail}" if detail else "") + (
        f"(status HTTP {s_status} {msg})" if s_status else ""
    )
    return result


async def minimax_query_credits(
    token: str,
    device_map: dict[str, Any],
    *,
    timeout: float = DEFAULT_TIMEOUT,
    client: httpx.AsyncClient | None = None,
) -> dict[str, Any]:
    """签到状态查询:返回 {"remaining": int|None, "error": str|None}。

    MiniMax 无公开余额端点(社区仅逆向出签到面)⇒ remaining 恒 None 并如实
    报 error(宁缺勿假,调度器快照按 error 跳过)。
    """
    user_id = minimax_device_map_uid(device_map)
    tok = (token or "").strip()
    if not user_id or not tok:
        return {"remaining": None, "error": "未配置 token/uid,请重新本机捕获"}
    host = minimax_host(device_map)
    status, data = await _mm_request(
        PATH_SIGNIN_STATUS, tok, user_id, method="GET",
        host=host, timeout=timeout, client=client,
        device_id=str(device_map.get("device_id") or ""),
        uuid_str=str(device_map.get("uuid") or ""),
    )
    if status in (401, 403):
        return {"remaining": None, "error": "token 无效或过期(401/403),请重新捕获"}
    if status != 200 or not isinstance(data, dict):
        return {"remaining": None, "error": f"状态查询失败(HTTP {status})"}
    days = parse_status_days(data)
    return {"remaining": None, "error": None, "checked_days": days}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
