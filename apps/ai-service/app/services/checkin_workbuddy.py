# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""WorkBuddy(腾讯 AI 办公台)Buddy 加油站每日签到引擎 — 第三平台引擎(2026-10-12 立)。

与 checkin_engine(TRAE)/ checkin_qoder 平级,API 契约平移自社区公开逆向成果
(MIT 授权,原始版权与来源声明在此保留):
- cat-xierluo/legal-skills 的 workbuddy-checkin skill(原始 v1.0.3)
- Coco-katarina/workbuddy-checkin(Windows 适配修复版,checkin.sh 为准)

接口契约(逆向自客户端,以 checkin.sh 实测为准):
1. 鉴权是 Bearer token(WorkBuddy 桌面端登录态,本机
   %LOCALAPPDATA%\\CodeBuddyExtension\\Data\\Public\\auth\\workbuddy-desktop.info);
2. 查状态 POST https://copilot.tencent.com/billing/meter/checkin-status,空体 {},
   响应 data.today_checked_in(实测 v5.3.8 不可靠,仅作短路,幂等兜底在下);
3. 领取 POST https://copilot.tencent.com/billing/meter/daily-checkin,空体 {},
   响应 {code, msg, data}:code==0 成功(data.credit / data.streak_days),
   code==10001 今日已签(幂等,视为成功);每日 00:00(UTC+8)后随时可领。
4. 鉴权失败一律按 HTTP 状态码判定(401/403),不扫响应体(响应体含随机
   requestId,子串匹配会随机误判 —— 上游 issue 实证)。

本机登录态加密(2026-10-12 真机实证):WorkBuddy 桌面端 5.8+ 把
auth.accessToken/refreshToken 包进 {$wbEncrypted:1, envelope:<base64>} 信封
(suite 1 = AES-256-GCM,密钥经 WORKBUDDY_AT_REST_ENCRYPTION 注入,只存在于
客户端进程内,磁盘/环境块/堆扫描均不可得)⇒ 桌面端抓取对加密形态返回明确
指引(见 checkin_capture.rs workbuddy 段),token 亦可由用户手动粘贴。
token 本体是标准 JWT(Keycloak 风格,sub=uid、exp 过期)。

结构化 dict 契约与 checkin_engine.checkin_account / checkin_qoder 完全一致
(ok/status/action/user_id/code/message/http_status/credits/credits_delta/
classified_error/warning),供同一套 records/冷却/积分流水消费。
"""

from __future__ import annotations

import base64
import datetime
import json
from typing import Any, Final

import httpx

from app.core.logging import get_logger
from app.services.checkin_engine import DEFAULT_TIMEOUT, get_http_client
from app.services.checkin_outbound import CHALLENGE_COOLDOWN_SECONDS, checkin_outbound_gate

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# 常量(平移自参考实现 checkin.sh)
# ---------------------------------------------------------------------------

WB_BASE: Final = "https://copilot.tencent.com"
PATH_CHECKIN_STATUS: Final = "/billing/meter/checkin-status"
PATH_DAILY_CHECKIN: Final = "/billing/meter/daily-checkin"
_USER_AGENT: Final = "WorkBuddy/checkin"

# Web Cookie 模式(2026-10-12 立「网页登录自动添加」):签到接口本域双网关同服务
# (asar 实证 /v2/billing/meter/daily-checkin 与 copilot.tencent.com 并存),
# 网页版全 Cookie 认证(asar 原话「Web 端已由浏览器 Cookie 保持登录态」)。
# 桌面端 WebView 登录后 cookie jar 全量(含 HttpOnly)落库到 jwt 字段(加密),
# device_map.login_type="web" 标记模式。
WB_WEB_BASE: Final = "https://www.workbuddy.cn"
PATH_WEB_CHECKIN_STATUS: Final = "/v2/billing/meter/checkin-status"
PATH_WEB_DAILY_CHECKIN: Final = "/v2/billing/meter/daily-checkin"

# 业务码:0=成功;10001=今日已签(幂等成功)。其余非零按失败分类。
_CODE_OK: Final = 0
_CODE_ALREADY: Final = 10001
EXPIRY_WARN_HOURS: Final = 24  # token 剩余有效期低于该值时发出告警(与 TRAE/Qoder 一致)


# ---------------------------------------------------------------------------
# token 解析(WorkBuddy token 是标准 JWT,uid 在 sub;非 JWT 串不作硬拒绝)
# ---------------------------------------------------------------------------


def workbuddy_extract_uid(jwt: str) -> str | None:
    """从 WorkBuddy JWT payload 里取 uid(sub/uid/user_id/userId/id),不校验签名。"""
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


def workbuddy_device_map_uid(device_map: dict[str, Any]) -> str | None:
    """从 device_map 取账号 uid(桌面端捕获落库的 uid/user_id/userId)。"""
    for key in ("uid", "user_id", "userId"):
        val = device_map.get(key)
        if isinstance(val, (str, int)) and str(val).strip():
            return str(val).strip()
    return None


def workbuddy_is_web_mode(device_map: dict[str, Any]) -> bool:
    """device_map.login_type == "web" ⇒ 网页登录 Cookie 模式(jwt 字段存 Cookie 串)。"""
    return str((device_map or {}).get("login_type") or "").strip().lower() == "web"


def _parse_expiry_value(raw: Any) -> datetime.datetime | None:
    """过期值 → naive 本地 datetime。

    接受三种落库形态:ISO 8601 字符串、epoch 秒、epoch 毫秒(workbuddy-desktop.info
    的 auth.expiresAt 是毫秒,如 1794225169853)。>1e12 视为毫秒。
    坏格式返回 None,绝不抛栈。
    """
    if isinstance(raw, bool):
        return None
    if isinstance(raw, str):
        text = raw.strip()
        if not text:
            return None
        if text.isdigit():
            return _parse_expiry_value(int(text))
        try:
            exp_dt = datetime.datetime.fromisoformat(text)
        except ValueError:
            return None
        if exp_dt.tzinfo is not None:
            exp_dt = exp_dt.astimezone().replace(tzinfo=None)
        return exp_dt
    if isinstance(raw, (int, float)):
        if raw <= 0:
            return None
        try:
            if raw > 1e12:  # epoch 毫秒
                return datetime.datetime.fromtimestamp(raw / 1000.0)
            return datetime.datetime.fromtimestamp(raw)
        except (OverflowError, OSError, ValueError):
            return None
    return None


def workbuddy_session_expiry(
    device_map: dict[str, Any]
) -> tuple[datetime.datetime | None, float | None]:
    """从 device_map 读会话过期时间,返回 (exp_datetime, remaining_hours) 或 (None, None)。

    键候选:expires_at / expiresAt / expiry_ms(workbuddy-desktop.info 原文键
    auth.expiresAt 经桌面端落库的投影)。
    """
    for key in ("expires_at", "expiresAt", "expiry_ms"):
        exp_dt = _parse_expiry_value(device_map.get(key))
        if exp_dt is not None:
            remaining = (exp_dt - datetime.datetime.now()).total_seconds() / 3600.0
            return exp_dt, remaining
    return None, None


def workbuddy_jwt_exp(jwt: str) -> tuple[datetime.datetime | None, float | None]:
    """从 WorkBuddy JWT payload 取 exp,返回 (exp_datetime, remaining_hours) 或 (None, None)。"""
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
# HTTP(单 base,无端点回退;错误分类契约与 TRAE/Qoder 一致)
# ---------------------------------------------------------------------------


def workbuddy_classify_error(http_status: int | None) -> tuple[str, int]:
    """WorkBuddy 版错误分类(cooldown_seconds: -1=永久, 0=不冷却, >0=冷却秒数)。

    401/403 = token 过期(SessionDead,永久);429 限流;5xx 服务端;4xx 客户端。
    """
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


async def _wb_post(
    path: str,
    token: str,
    timeout: float = DEFAULT_TIMEOUT,
    client: httpx.AsyncClient | None = None,
) -> tuple[int, Any]:
    """POST copilot.tencent.com,Bearer 鉴权 + 空 JSON 体。返回 (http_status, parsed_json)。

    网络异常(含超时)→ (0, None);非 JSON 响应 → (status, None)。
    鉴权失败按 HTTP 状态码判定,不扫响应体(上游 issue:响应体含随机 requestId)。
    """
    headers: dict[str, str] = {
        "accept": "application/json",
        "content-type": "application/json",
        "user-agent": _USER_AGENT,
        "authorization": f"Bearer {token}",
    }
    http = client if client is not None else get_http_client()
    await checkin_outbound_gate.before_request("workbuddy")
    try:
        resp = await http.post(WB_BASE.rstrip("/") + path, json={}, headers=headers, timeout=timeout)
    except httpx.TimeoutException:
        return 0, None
    except Exception as e:
        return -1, f"{type(e).__name__}: {e}"
    checkin_outbound_gate.note_status(resp.status_code, "workbuddy")
    try:
        return resp.status_code, json.loads(resp.text)
    except Exception:
        return resp.status_code, None


async def _wb_post_web(
    path: str,
    cookie_header: str,
    timeout: float = DEFAULT_TIMEOUT,
    client: httpx.AsyncClient | None = None,
) -> tuple[int, Any]:
    """POST www.workbuddy.cn 本域 /v2 网关,Cookie 鉴权 + 空 JSON 体(与网页版同机制)。

    返回契约与 _wb_post 完全一致:(0/-1, None)=网络异常;(status, None)=非 JSON。
    """
    headers: dict[str, str] = {
        "accept": "application/json",
        "content-type": "application/json",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) IHUI-Desktop-Checkin",
        "cookie": cookie_header,
    }
    http = client if client is not None else get_http_client()
    await checkin_outbound_gate.before_request("workbuddy")
    try:
        resp = await http.post(
            WB_WEB_BASE.rstrip("/") + path, json={}, headers=headers, timeout=timeout
        )
    except httpx.TimeoutException:
        return 0, None
    except Exception as e:
        return -1, f"{type(e).__name__}: {e}"
    checkin_outbound_gate.note_status(resp.status_code, "workbuddy")
    try:
        return resp.status_code, json.loads(resp.text)
    except Exception:
        return resp.status_code, None


# ---------------------------------------------------------------------------
# 编排:单账号签到流程(契约与 checkin_engine.checkin_account 一致)
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


def _expired_warning(jwt: str, device_map: dict[str, Any]) -> str | None:
    """过期预检告警:JWT exp 与 device_map 会话 expiresAt 取**较早者**;只告警不阻断
    (服务端幂等 code=10001 兜底,预检只是省一次无效请求 + 给人可读原因)。"""
    candidates: list[tuple[datetime.datetime | None, float | None]] = [
        workbuddy_jwt_exp(jwt),
        workbuddy_session_expiry(device_map),
    ]
    exp_dt, remaining = None, None
    for c_dt, c_rem in candidates:
        if c_rem is None:
            continue
        if remaining is None or c_rem < remaining:
            exp_dt, remaining = c_dt, c_rem
    if remaining is None:
        return None
    if remaining < 0:
        return f"token 已过期({exp_dt:%Y-%m-%d %H:%M}),请重新提取"
    if remaining < EXPIRY_WARN_HOURS:
        return f"token 将于 {remaining:.1f}h 后过期({exp_dt:%Y-%m-%d %H:%M})"
    return None


async def workbuddy_checkin_account(
    name: str,
    jwt: str,
    device_map: dict[str, Any],
    *,
    timeout: float = DEFAULT_TIMEOUT,
    client: httpx.AsyncClient | None = None,
) -> dict[str, Any]:
    """对单个 WorkBuddy 账号执行每日签到,返回结构化 dict(契约见模块 docstring)。

    双凭据模式(按 device_map.login_type 分流):
    - token(默认):jwt 字段 = Bearer token → copilot.tencent.com;
    - web:jwt 字段 = 网页登录 Cookie 串 → www.workbuddy.cn /v2 网关
      (桌面端 WebView 登录自动获取,普通用户零 token)。
    流程:过期预检告警(web 模式无 exp 声明,跳过)→ POST daily-checkin →
    code 0=成功(credit/streak_days)/ 10001=今日已签(幂等成功)/
    401/403=SessionDead。无自刷新(refreshToken 不可得;过期即提示重抓/重登)。
    """
    result = _base_result(name, None)
    web_mode = workbuddy_is_web_mode(device_map)

    if not (jwt or "").strip():
        result["message"] = "未配置 token" if not web_mode else "未配置网页登录 Cookie,请重新网页登录"
        return result

    user_id = workbuddy_device_map_uid(device_map) or (None if web_mode else workbuddy_extract_uid(jwt))
    result["user_id"] = user_id
    if not user_id:
        if web_mode:
            result["message"] = "无法解析账号 uid(device_map.uid 缺失),请重新网页登录获取"
        else:
            result["message"] = "无法解析账号 uid(device_map.uid 缺失且 token 非 JWT),请重新抓取"
        return result

    if not web_mode:
        result["warning"] = _expired_warning(jwt, device_map)

    if web_mode:
        status, data = await _wb_post_web(PATH_WEB_DAILY_CHECKIN, jwt.strip(), timeout, client)
    else:
        status, data = await _wb_post(PATH_DAILY_CHECKIN, jwt.strip(), timeout, client)
    result["http_status"] = status if status > 0 else None
    if status in (0, -1):
        result["message"] = "网络异常" if status == 0 else (f"网络异常: {data}" if data else "网络异常")
        return result
    if status in (401, 403):
        error_type, cooldown_secs = workbuddy_classify_error(status)
        if web_mode:
            result["message"] = (
                f"网页登录已过期(HTTP {status}),请重新点「网页登录 WorkBuddy」获取"
            )
        else:
            result["message"] = (
                f"token 已过期或无权限(HTTP {status}),请打开 WorkBuddy 桌面端刷新登录态后重新抓取"
            )
        result["classified_error"] = {"type": error_type, "cooldown_seconds": cooldown_secs}
        return result
    if status >= 400:
        # 其余 4xx/5xx:HTTP 层即失败,不进业务码解析(响应体可能非我们的契约)
        error_type, cooldown_secs = workbuddy_classify_error(status)
        result["message"] = f"签到失败: HTTP {status}"
        if error_type not in ("Unknown",):
            result["classified_error"] = {"type": error_type, "cooldown_seconds": cooldown_secs}
        return result
    if not isinstance(data, dict):
        result["message"] = f"签到失败: 响应非 JSON(HTTP {status})"
        # 第五件套(2026-10-16):2xx 非 JSON = WAF/挑战页插页,即时熔断
        # (403 保持本平台既有 SessionDead 永久冷却语义,比 Challenge 更保守)
        result["classified_error"] = {
            "type": "Challenge",
            "cooldown_seconds": CHALLENGE_COOLDOWN_SECONDS,
        }
        checkin_outbound_gate.note_challenge("workbuddy")
        return result

    code = data.get("code")
    result["code"] = code if isinstance(code, int) else None
    if code == _CODE_ALREADY:
        result.update(ok=True, status="already", action="skip_already", message="今日已签到,无需重复领取")
        return result
    if code != _CODE_OK:
        msg = data.get("msg") or data.get("message") or ""
        result["message"] = f"签到未成功: code={code}" + (f" {msg}" if msg else "")
        # 业务失败:HTTP 层正常,不落 HTTP 冷却;SessionDead 级语义由 401/403 分支承载
        return result

    payload = data.get("data")
    payload = payload if isinstance(payload, dict) else {}
    credit = payload.get("credit")
    streak = payload.get("streak_days")
    result["credits"] = credit if isinstance(credit, int) else None
    result["credits_delta"] = credit if isinstance(credit, int) else None
    detail = ""
    if isinstance(credit, int):
        detail = f"credit={credit}"
        if isinstance(streak, int):
            detail += f" streak_days={streak}"
    result.update(ok=True, status="ok", message="签到成功" + (f"({detail})" if detail else ""))
    return result


async def workbuddy_probe_status(
    token: str,
    device_map: dict[str, Any],
    *,
    timeout: float = DEFAULT_TIMEOUT,
    client: httpx.AsyncClient | None = None,
) -> tuple[bool, bool | None, int | None, str]:
    """只读探针:查 checkin-status 的 data.today_checked_in ⇒ 今日是否已签。

    返回 (ok, checked_in|None, credits|None, message)。**不调 daily-checkin,
    零领取副作用** —— 供 06:00 状态探针在主窗口前同步「今日已签到」。

    契约:HTTP 非 200 / 非 JSON / 字段缺失 ⇒ ok=False 且 checked_in=None
    (宁缺勿假,探针据此跳过,不打平台也不误报)。
    """
    tok = (token or "").strip()
    web_mode = workbuddy_is_web_mode(device_map)
    if not tok:
        return False, None, None, "未配置网页登录 Cookie" if web_mode else "未配置 token"
    if not web_mode:
        exp_dt, remaining = workbuddy_session_expiry(device_map)
        if remaining is not None and remaining < 0:
            return False, None, None, f"会话已过期({exp_dt:%Y-%m-%d %H:%M})"
    if web_mode:
        status, data = await _wb_post_web(PATH_WEB_CHECKIN_STATUS, tok, timeout, client)
    else:
        status, data = await _wb_post(PATH_CHECKIN_STATUS, tok, timeout, client)
    if status in (0, -1):
        return False, None, None, "网络异常"
    if status != 200 or not isinstance(data, dict):
        return False, None, None, f"状态查询失败(HTTP {status})"
    payload = data.get("data")
    payload = payload if isinstance(payload, dict) else {}
    # today_checked_in 顶层/内层都找(实测两型都出现过)
    for bucket in (data, payload):
        raw = bucket.get("today_checked_in")
        if isinstance(raw, bool):
            credits: int | None = None
            for key in ("remaining", "credit", "balance", "total_credit", "totalCredit", "credits"):
                val = payload.get(key)
                if isinstance(val, int):
                    credits = val
                    break
            return True, raw, credits, "今日已签到" if raw else ""
    return False, None, None, "状态响应不含 today_checked_in"


async def workbuddy_query_credits(
    jwt: str,
    device_map: dict[str, Any],
    *,
    timeout: float = DEFAULT_TIMEOUT,
    client: httpx.AsyncClient | None = None,
) -> dict[str, Any]:
    """查询签到状态(POST checkin-status),返回 {"remaining": int|None, "error": str|None}。

    契约对齐 checkin_credits.query_remaining_credits / qoder_query_credits:
    调度器积分快照按 result["remaining"] 是否为 int 判成败。
    status 响应实测可能不含余额字段(仅 today_checked_in)⇒ 缺字段如实报
    error,不编造数值(2026-10-12 立此契约:宁缺勿假)。
    """
    token = (jwt or "").strip()
    web_mode = workbuddy_is_web_mode(device_map)
    if not token:
        return {
            "remaining": None,
            "error": "未配置网页登录 Cookie,请重新网页登录" if web_mode else "未配置 token",
        }
    if not web_mode:
        exp_dt, remaining = workbuddy_session_expiry(device_map)
        if remaining is not None and remaining < 0:
            return {"remaining": None, "error": f"会话已过期({exp_dt:%Y-%m-%d %H:%M})"}
    if web_mode:
        status, data = await _wb_post_web(PATH_WEB_CHECKIN_STATUS, token, timeout, client)
    else:
        status, data = await _wb_post(PATH_CHECKIN_STATUS, token, timeout, client)
    if status in (0, -1):
        return {"remaining": None, "error": "网络异常"}
    if status in (401, 403):
        return {
            "remaining": None,
            "error": (
                f"网页登录已过期(HTTP {status}),请重新网页登录"
                if web_mode
                else f"token 已过期或无权限(HTTP {status})"
            ),
            # 第五件套(2026-10-16):与签到主路同语义(401/403=SessionDead),
            # 供消费方观测;本平台 403 不比 Challenge 软——永久冷却更保守
            "classified_error": {"type": "SessionDead", "cooldown_seconds": -1},
        }
    if status == 200 and not isinstance(data, dict):
        # 第五件套:2xx 非 JSON = WAF 挑战页插页(与签到主路同款熔断)
        checkin_outbound_gate.note_challenge("workbuddy")
        return {
            "remaining": None,
            "error": "状态查询返回非 JSON(挑战页,已熔断)",
            "classified_error": {"type": "Challenge", "cooldown_seconds": CHALLENGE_COOLDOWN_SECONDS},
        }
    if status != 200 or not isinstance(data, dict):
        return {"remaining": None, "error": f"状态查询失败(HTTP {status})"}
    payload = data.get("data")
    payload = payload if isinstance(payload, dict) else {}
    for key in ("remaining", "credit", "balance", "total_credit", "totalCredit", "credits"):
        val = payload.get(key)
        if isinstance(val, int):
            return {"remaining": val, "error": None}
    return {"remaining": None, "error": "状态响应不含积分余额字段"}
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
