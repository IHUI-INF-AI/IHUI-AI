# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""Trae Work 多账号签到引擎 — 服务端服务化平移。

平移自 Trae-workbuddyAssistant (MIT) apps/assistant/src-python/auto_checkin.py
（桌面端内置签到脚本，MIT 授权，原始版权与来源声明在此保留）。

与上游的差异（平移改造点）:
1. urllib 同步 → httpx.AsyncClient 异步化；共享 client 以 ``trust_env=False``
   构造，语义对齐上游「NO_PROXY=* 强制直连、不走任何代理」的修复
   （上游背景: Windows 系统代理指向本地 MITM 死端口会导致 WinError 10061）。
2. print/emit → structlog（经 app.core.logging.get_logger）。
3. 文件读写全部剥离（save_json / save_credits_history / account_cooldowns.json /
   checkin_accounts.json 等不在此处出现）—— 持久化由调用方（Phase1b 数据层）
   负责；device_map 由调用方传入并在其上原位补齐缺失设备标识（调用方负责落盘）。
4. ``checkin_account`` 编排函数返回与上游 NDJSON ``emit`` 事件语义对齐的
   结构化 dict（含 http_status / message / code / classified_error / credits 等），
   供服务端数据层与 API 层消费。

上游语义保留:
- 设备标识确定性派生（同一 user_id 恒等输出，device_map 缺失也可复现）；
- 请求头逐字段与上游 _build_headers 一致（设备指纹头是风控面，不可漂移）；
- 错误分类 classify_error 的 (error_type, cooldown_seconds) 契约不变
  （cooldown_seconds: -1=永久, 0=不冷却, >0=冷却秒数）——落冷却仍由调用方执行；
- signin_with_retry 仅对网络层异常（code 为 None）重试，业务失败不重试。
"""

from __future__ import annotations

import base64
import datetime
import hashlib
import json
import random
import uuid
from typing import Any, Final

import httpx

from app.core.logging import get_logger

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# 常量（平移自上游原文）
# ---------------------------------------------------------------------------

SIGNIN_URL: Final = "https://api.trae.cn/trae/api/v2/ug/checkin_credits/claim"
STATUS_URL: Final = "https://api.trae.cn/trae/api/v2/ug/checkin_credits/status"
EXPIRY_WARN_HOURS: Final = 24  # JWT 剩余有效期低于该值时发出告警
DEFAULT_TIMEOUT: Final = 30  # 秒，对齐上游默认 timeout=30

# 设备标识生成算法版本；旧记录(gen 缺失=1)会自动重建
DEVICE_GEN: Final = 2

# 风控指纹头的固定取值（上游原文，随 TRAE 客户端版本演进，不可随意改动）
_USER_AGENT: Final = "VSCode 1.107.1 (TRAE SOLO CN)"
_MARKET_CLIENT_ID: Final = "VSCode 1.107.1"
_APP_VERSION: Final = "0.1.45"
_LSCBD_AID: Final = "787976"

# ---------------------------------------------------------------------------
# 确定性伪随机派生（上游原文平移）
# ---------------------------------------------------------------------------


def _normalize_seed(seed: int | str | None) -> int | str | None:
    """将任意 seed 归一为稳定 int（字符串走 sha256，跨进程一致；纯数字串按数值）。"""
    if isinstance(seed, int):
        return seed & 0x7FFFFFFFFFFFFFFF
    if isinstance(seed, str):
        if seed.isdigit():
            return int(seed) & 0x7FFFFFFFFFFFFFFF
        return int(hashlib.sha256(seed.encode("utf-8")).hexdigest(), 16) & 0x7FFFFFFFFFFFFFFF
    return seed


def _stable_rng(seed: int | str | None) -> random.Random:
    """遗留兼容：基于 seed 的稳定随机数生成器（旧算法，已被 SHA-256 派生取代）。"""
    return random.Random(_normalize_seed(seed))


def _seeded_stream(seed: int | str, salt: str, nbytes: int) -> bytes:
    """确定性派生均匀字节流（SHA-256），避免 random.Random(seed) 病态序列。

    调用方（rand_digits/rand_hex/gen_market_uuid）均已在调用前守卫 seed is None，
    故签名收窄为非可选（类型债 39 条清偿，2026-10-10）。
    """
    data = f"{salt}:{seed}".encode()
    out = b""
    i = 0
    while len(out) < nbytes:
        out += hashlib.sha256(data + i.to_bytes(4, "big")).digest()
        i += 1
    return out[:nbytes]


def rand_digits(n: int, seed: int | str | None = None) -> str:
    if seed is None:
        return "".join(random.choice("0123456789") for _ in range(n))
    bs = _seeded_stream(seed, "devid", n + 1)
    return "".join(str(b % 10) for b in bs[:n])


def rand_hex(n: int, seed: int | str | None = None) -> str:
    if seed is None:
        return "".join(random.choice("0123456789abcdef") for _ in range(n))
    need = (n + 1) // 2
    bs = _seeded_stream(seed, "sess", need)
    return "".join(f"{b:02x}" for b in bs)[:n]


def gen_market_uuid(seed: int | str | None) -> str:
    """标准 UUID v4（确定性派生），符合 market_user_id 字段格式。"""
    if seed is None:
        return str(uuid.uuid4())
    bs = bytearray(_seeded_stream(seed, "market", 16))
    bs[6] = (bs[6] & 0x0F) | 0x40
    bs[8] = (bs[8] & 0x3F) | 0x80
    return str(uuid.UUID(bytes=bytes(bs)))


# ---------------------------------------------------------------------------
# JWT 解析（上游原文平移）
# ---------------------------------------------------------------------------


def extract_user_id(jwt: str) -> str | None:
    """从 JWT payload 里取 data.id，不校验签名。"""
    token = jwt
    if token.startswith("Cloud-IDE-JWT "):
        token = token.split(None, 1)[1]
    parts = token.split(".")
    if len(parts) < 2:
        return None
    try:
        pad = parts[1] + "=" * (-len(parts[1]) % 4)
        payload = json.loads(base64.urlsafe_b64decode(pad))
        data = payload.get("data", {})
        if isinstance(data, dict) and data.get("id"):
            return str(data.get("id"))
        if payload.get("auth_id"):
            return str(payload.get("auth_id"))
        if payload.get("sub"):
            return str(payload.get("sub"))
        return None
    except Exception:
        return None


def get_jwt_exp(jwt: str) -> tuple[datetime.datetime | None, float | None]:
    """从 JWT payload 取 exp 字段，返回 (exp_datetime, remaining_hours) 或 (None, None)。"""
    token = jwt
    if token.startswith("Cloud-IDE-JWT "):
        token = token.split(None, 1)[1]
    parts = token.split(".")
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
# 设备标识与请求头（上游原文平移；持久化剥离）
# ---------------------------------------------------------------------------


def get_device_for(user_id: str, device_map: dict[str, dict[str, Any]]) -> dict[str, Any]:
    """复用/生成 device_map 中该 user_id 的设备标识（原位写入传入的 dict）。

    与上游差异: 不再落盘 device_map.json —— 持久化由调用方负责（调用方在
    调用后自行把可能被原位补齐的 device_map 写回存储）。同一 user_id 在
    device_map 缺失时生成确定性 ID，跨进程可复现。
    """
    rec = device_map.get(user_id)
    if rec is None or rec.get("gen", 1) < DEVICE_GEN:
        device_map[user_id] = {
            "device_id": rand_digits(15, seed=user_id),
            "market_user_id": gen_market_uuid(user_id),
            "session_id": rand_hex(64, seed=user_id),
            "created": datetime.datetime.now().isoformat(timespec="seconds"),
            "gen": DEVICE_GEN,
        }
    return device_map[user_id]


def _build_headers(jwt: str, dev: dict[str, Any]) -> dict[str, str]:
    """签到/状态接口共用的请求头（按账号独立设备 id 与 session）。"""
    return {
        "accept": "*/*",
        "accept-encoding": "gzip, deflate",
        "accept-language": "zh-CN",
        "authorization": jwt if jwt.startswith("Cloud-IDE-JWT ") else f"Cloud-IDE-JWT {jwt}",
        "content-type": "application/json",
        "user-agent": _USER_AGENT,
        "x-market-client-id": _MARKET_CLIENT_ID,
        "x-market-user-id": dev["market_user_id"],
        "x-user-region": "CN",
        "x-device-id": dev["device_id"],
        "x-lgw-req-sdk-type": "3",
        "package-type": "stable_cn",
        "x-request-id": str(uuid.uuid4()),
        "x-lscbd-aid": _LSCBD_AID,
        "x-lscbd-platform": "windows",
        "app-version": _APP_VERSION,
        "x-tt-trace-id": f"00-{uuid.uuid4().hex[:16]}-01",
        "vscode-sessionid": dev["session_id"],
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "no-cors",
        "sec-fetch-site": "none",
    }


# ---------------------------------------------------------------------------
# HTTP 层（urllib → httpx.AsyncClient）
# ---------------------------------------------------------------------------

_shared_client: httpx.AsyncClient | None = None


def get_http_client() -> httpx.AsyncClient:
    """模块级共享 AsyncClient（惰性创建）。

    trust_env=False 对齐上游 NO_PROXY=*=「强制直连 api.trae.cn、忽略一切
    代理环境变量/系统代理」的语义，避免服务端代理配置把签到流量路由进
    不可用的代理通道。
    """
    global _shared_client
    if _shared_client is None or _shared_client.is_closed:
        _shared_client = httpx.AsyncClient(trust_env=False, timeout=DEFAULT_TIMEOUT)
    return _shared_client


async def aclose_http_client() -> None:
    """关闭共享 client（应用停机时调用）。"""
    global _shared_client
    if _shared_client is not None and not _shared_client.is_closed:
        await _shared_client.aclose()
    _shared_client = None


async def _http_post(
    url: str,
    jwt: str,
    dev: dict[str, Any],
    body: bytes = b"{}",
    timeout: float = DEFAULT_TIMEOUT,
    client: httpx.AsyncClient | None = None,
) -> tuple[int, str]:
    """统一 POST 入口，返回 (status_code:int, body_text:str)。

    语义对齐上游: 网络超时 → (0, "")；其他网络异常 → (-1, "异常描述")。
    非 2xx 响应不算异常，原样返回状态码与响应体（401/429 等由上层分类）。
    """
    headers = _build_headers(jwt, dev)
    http = client if client is not None else get_http_client()
    try:
        resp = await http.post(url, content=body, headers=headers, timeout=timeout)
        return resp.status_code, resp.text
    except httpx.TimeoutException:
        return 0, ""
    except Exception as e:
        return -1, f"{type(e).__name__}: {e}"


# ---------------------------------------------------------------------------
# 签到接口（上游原文平移，异步化）
# ---------------------------------------------------------------------------


async def status_check(
    name: str,
    jwt: str,
    device_map: dict[str, dict[str, Any]],
    timeout: float = DEFAULT_TIMEOUT,
    client: httpx.AsyncClient | None = None,
) -> tuple[bool, bool | None, int | None, int | None, str]:
    """预检：返回 (ok: bool, checked_in: bool|None, credits: int|None, code: int|None, message: str)。"""
    user_id = extract_user_id(jwt)
    if not user_id:
        return False, None, None, None, "无法从 JWT 解析 user id"
    dev = get_device_for(user_id, device_map)
    status, body = await _http_post(STATUS_URL, jwt, dev, body=b"{}", timeout=timeout, client=client)
    if status < 0:
        return False, None, None, None, body or "网络异常"
    try:
        data = json.loads(body)
    except Exception:
        return False, None, None, status, f"非 JSON 响应: {body[:200]}"
    code = data.get("code")
    checked_in = data.get("checked_in")
    credits = data.get("credits")
    msg = data.get("message", "")
    if code != 0:
        return False, checked_in, credits, code, msg or f"HTTP {status}"
    return True, bool(checked_in), credits, code, msg


async def signin(
    name: str,
    jwt: str,
    device_map: dict[str, dict[str, Any]],
    timeout: float = DEFAULT_TIMEOUT,
    client: httpx.AsyncClient | None = None,
) -> tuple[bool, str, int | None, int | None]:
    """对单个账号执行签到，返回 (success, message, code, http_status)。"""
    user_id = extract_user_id(jwt)
    if not user_id:
        return False, "无法从 JWT 解析 user id", None, 0

    dev = get_device_for(user_id, device_map)
    status, body = await _http_post(SIGNIN_URL, jwt, dev, body=b"{}", timeout=timeout, client=client)

    if status < 0:
        return False, body or "网络异常", None, status
    try:
        data = json.loads(body)
        return data.get("code") == 0, data.get("message", f"HTTP {status}"), data.get("code"), status
    except Exception:
        return False, f"HTTP {status}: 非 JSON 响应: {body[:200]}", status if status else None, status


def classify_error(
    http_status: int | None, message: str | None, code: int | None
) -> tuple[str, int]:
    """根据 HTTP 状态码和业务码分类签到错误，返回 (error_type, cooldown_seconds)。
    cooldown_seconds: -1=永久, 0=不冷却(仅记录错误计数), >0=冷却秒数
    http_status 为 None 表示网络层异常（未拿到响应），落入 Unknown。"""
    if http_status is None:
        return "Unknown", 0
    if http_status == 200 and code == 1005:
        return "PlanLimit", 43200
    if http_status == 429:
        return "SoftRate", 60
    if http_status == 401:
        return "SessionDead", -1
    if http_status == 404:
        return "NotFound", 60
    if 500 <= http_status < 600:
        return "Server", 600
    if 400 <= http_status < 500:
        return "Client", 600
    if code is not None and code != 0:
        return "BusinessError", 300
    return "Unknown", 0


async def signin_with_retry(
    name: str,
    jwt: str,
    device_map: dict[str, dict[str, Any]],
    timeout: float = DEFAULT_TIMEOUT,
    retry: int = 0,
    retry_delay: float = 1.0,
    client: httpx.AsyncClient | None = None,
) -> tuple[bool, str, int | None, int | None]:
    """对单个账号执行签到；仅网络层异常（code 为 None）按 retry 次数重试，业务失败不重试。

    与上游差异: print → structlog；retry_delay 可注入（测试用 0 避免 sleep）。
    """
    import asyncio

    last: tuple[bool, str, int | None, int | None] = (False, "无重试", None, None)
    for attempt in range(retry + 1):
        ok, msg, code, status = await signin(name, jwt, device_map, timeout, client=client)
        if ok or code is not None:
            return ok, msg, code, status
        last = (ok, msg, code, status)
        if attempt < retry:
            logger.warning("签到网络异常重试", name=name, attempt=attempt + 1, retry_delay=retry_delay)
            await asyncio.sleep(retry_delay)
    return last


# ---------------------------------------------------------------------------
# 编排（对齐上游 main() 的单账号流程，剥离一切持久化）
# ---------------------------------------------------------------------------


async def checkin_account(
    name: str,
    jwt: str,
    device_map: dict[str, dict[str, Any]],
    *,
    timeout: float = DEFAULT_TIMEOUT,
    retry: int = 0,
    retry_delay: float = 1.0,
    client: httpx.AsyncClient | None = None,
) -> dict[str, Any]:
    """对单个账号执行完整签到流程，返回与上游 NDJSON emit 语义对齐的结构化 dict。

    流程（对齐上游 main()）: JWT 过期预检告警 → status 预检（已签则跳过）→
    claim（网络异常按 retry 重试）→ 失败时错误分类。

    冷却/积分历史的**落盘不在本函数**：失败结果的 classified_error 字段
    （{"type", "cooldown_seconds"}）由调用方据此写入冷却存储。

    返回字段: ok / status("success"|"fail"|"already") / action
    ("skip_already"|"claim_ok"|"claim") / user_id / name / code / message /
    http_status / credits / credits_delta / classified_error / warning。
    credits 与 credits_delta 仅在可确定时给出（None 表示 status 未返回额度）。
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
        result["message"] = "未配置 jwt"
        return result

    user_id = extract_user_id(jwt)
    result["user_id"] = user_id
    if not user_id:
        result["message"] = "无法从 JWT 解析 user id"
        return result

    # JWT 过期预检告警（不阻断，仅附 warning 字段）
    exp_dt, remaining = get_jwt_exp(jwt)
    if remaining is not None:
        if remaining < 0:
            result["warning"] = f"JWT 已过期({exp_dt:%Y-%m-%d %H:%M})，请重新抓取"
        elif remaining < EXPIRY_WARN_HOURS:
            result["warning"] = f"JWT 将于 {remaining:.1f}h 后过期({exp_dt:%Y-%m-%d %H:%M})，请重新抓取"
        if result["warning"]:
            logger.warning("JWT 有效期告警", name=name, warning=result["warning"])

    dev = get_device_for(user_id, device_map)
    logger.info("签到开始", name=name, user_id=user_id, device_id=dev["device_id"])

    ok_s, checked_in, credits_before, code_s, msg_s = await status_check(
        name, jwt, device_map, timeout, client=client
    )
    if ok_s and checked_in:
        logger.info("已签到跳过", name=name, user_id=user_id, credits=credits_before)
        result.update(
            ok=True,
            status="already",
            action="skip_already",
            code=0,
            message=msg_s or "已签到",
            credits=credits_before,
        )
        return result
    if not ok_s:
        logger.warning("status 预检失败仍尝试 claim", name=name, code=code_s, message=msg_s)

    ok, msg, code, http_status = await signin_with_retry(
        name, jwt, device_map, timeout, retry=retry, retry_delay=retry_delay, client=client
    )
    result.update(code=code, message=msg, http_status=http_status)

    if ok:
        # credits_before 来自 status 接口，表示签到可获得的积分额度；
        # 签到成功后 delta 就是该额度（无需再次请求 status 计算差值）
        if isinstance(credits_before, int):
            result.update(
                ok=True,
                status="success",
                action="claim_ok",
                credits=credits_before,
                credits_delta=credits_before,
            )
        else:
            result.update(ok=True, status="success", action="claim_ok")
        logger.info("签到成功", name=name, user_id=user_id, credits=result["credits"])
        return result

    # 签到失败 → 分类错误（冷却落盘由调用方执行）
    error_type, cooldown_secs = classify_error(http_status, msg, code)
    if error_type and error_type != "Unknown":
        result["classified_error"] = {"type": error_type, "cooldown_seconds": cooldown_secs}
        logger.warning(
            "签到失败已分类",
            name=name,
            user_id=user_id,
            error_type=error_type,
            cooldown_seconds=cooldown_secs,
            code=code,
            http_status=http_status,
        )
    result["message"] = msg
    logger.info("签到失败", name=name, user_id=user_id, code=code, message=msg)
    return result
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
