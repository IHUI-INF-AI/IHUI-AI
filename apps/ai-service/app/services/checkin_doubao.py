# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""豆包(Doubao PC 客户端)每日签到引擎 — 第五平台(2026-11-11 立)。

契约来源(实证链,详见 scripts/lib/doubao-checkin-api.mjs 与
.workbuddy/memory/2026-11-11.md):
- 客户端主进程日志 saman_frontend_*.log 完整真实 URL(鉴权四要素实锤);
- local_webcontents/extensions/ai-views/static/js/async/37673.js 反编译
  (DailyCheckIn({scene}) 契约);
- CreditDaddy issue#32 已验证实现(纯 cookie 可打,无 a_bogus/msToken 签名);
- 2026-11-11 组合矩阵实测:DoubaoDesktop UA + aid=497858 web 指纹
  + device_id 空 → v3/detail/ code:0 全通。

端点(www.doubao.com,均为 POST JSON):
  /alice/ug/campaign/v3/detail/      body {campaign_group_code} → 查状态(只读)
  /alice/ug/campaign/landing/checkin body {scene}              → 领取(写)
活动组/scene = pc_incentive_task_mvp_v3,任务码 daily_signin(200 额度/天)。

鉴权:token = 豆包 cookie 头(opaque,须取客户端活跃 profile 的完整会话;
本机 Default profile 是旧号残留,捕获时必须对准客户端活跃 profile)。
device_map 可带 user_id/uid(展示用)。

已知限制(2026-11-11):checkin 写接口在账号风控/频控期稳定 710010702
「系统错误」,与参数无关 ⇒ 归类 BusinessError 冷却 3600s 等解封,不熔断
不永久摘除(读接口同参全通,会话本身健康)。
结构化 dict 契约与 checkin_engine / minimax / qoder 完全一致。
"""

from __future__ import annotations

from typing import Any, Final

import httpx

from app.core.logging import get_logger
from app.services.checkin_engine import DEFAULT_TIMEOUT, get_http_client
from app.services.checkin_outbound import checkin_outbound_gate

logger = get_logger(__name__)

DOUBAO_HOST: Final = "https://www.doubao.com"
PATH_DETAIL: Final = "/alice/ug/campaign/v3/detail/"
PATH_CHECKIN: Final = "/alice/ug/campaign/landing/checkin"
SCENE: Final = "pc_incentive_task_mvp_v3"
TASK_KIND: Final = "daily_signin"

# web 指纹(2026-11-11 组合矩阵定稿):DoubaoDesktop UA + aid=497858 +
# device_id 空。客户端指纹(aid=582478/pc_client)打 detail 亦通,但
# CreditDaddy 已验证面在 web 指纹,取其稳。
_UA: Final = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) DoubaoDesktop/2.32.6 Chrome/147.0.7727.149 Safari/537.36"
)
_COMMON_QUERY: Final[dict[str, str]] = {
    "version_code": "20800",
    "language": "zh",
    "device_platform": "web",
    "doubao_device_platform": "web",
    "aid": "497858",
    "real_aid": "497858",
    "pkg_type": "release_version",
    "pc_version": "2.33.5",
    "doubao_pc_version": "5.72.66",
    "samantha_web": "1",
    "web_platform": "desktop",
    "use-olympus-account": "1",
    "web_tab_id": "0",
    "device_id": "",
    "region": "",
    "sys_region": "",
}

# 业务码 → classified_error(-1=永久冷却, >0=冷却秒数;契约见 checkin_engine)
_CODE_SESSION_DEAD: Final = 710012001  # login-invalid:会话失效,永久冷却
_CODE_CHECKIN_BLOCKED: Final = 710010702  # 系统错误:频控/风控期写接口被拦
_CODE_RATE_LIMIT: Final = 710022002  # 访问频繁


def doubao_device_map_uid(device_map: dict[str, Any] | None) -> str | None:
    dm = device_map or {}
    for key in ("uid", "user_id", "userId"):
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
    """cookie 头校验:必须含 sessionid(豆包会话核心票)。返回错误消息或 None。"""
    tok = (token or "").strip()
    if not tok:
        return "未配置 token(豆包 cookie 头),请从客户端活跃 profile 重新捕获"
    if "sessionid=" not in tok:
        return "cookie 头缺 sessionid,非完整豆包会话,请重新捕获"
    return None


async def _db_request(
    path: str,
    token: str,
    body: dict[str, Any],
    *,
    timeout: float = DEFAULT_TIMEOUT,
    client: httpx.AsyncClient | None = None,
) -> tuple[int, Any]:
    """统一豆包 POST:web 指纹 query + cookie 鉴权。返回 (http_status, json|None)。"""
    params = httpx.QueryParams(_COMMON_QUERY)
    http = client if client is not None else get_http_client()
    url = f"{DOUBAO_HOST}{path}?{params}"
    headers = {
        "cookie": token,
        "content-type": "application/json",
        "accept": "application/json, text/plain, */*",
        "referer": f"{DOUBAO_HOST}/pc/agent-explore",
        "origin": DOUBAO_HOST,
        "user-agent": _UA,
    }
    await checkin_outbound_gate.before_request("doubao")
    resp = await http.post(url, headers=headers, json=body, timeout=timeout)
    checkin_outbound_gate.note_status(resp.status_code, "doubao")
    try:
        return resp.status_code, resp.json()
    except Exception:
        return resp.status_code, None


def parse_detail(body: dict[str, Any] | None) -> dict[str, Any]:
    """detail 响应 → {code, checked_in, reward, credits, message}。"""
    if not isinstance(body, dict):
        return {"code": None, "checked_in": False, "reward": None, "credits": None, "message": "响应非 JSON"}
    code = body.get("code")
    _raw_data = body.get("data")
    data: dict[str, Any] = _raw_data if isinstance(_raw_data, dict) else {}
    _raw_tasks = data.get("tasks")
    tasks: list[Any] = _raw_tasks if isinstance(_raw_tasks, list) else []
    task = next(
        (t for t in tasks if isinstance(t, dict) and t.get("task_kind") == TASK_KIND),
        None,
    )
    _raw_dc = task.get("daily_checkin") if isinstance(task, dict) else None
    dc: dict[str, Any] = _raw_dc if isinstance(_raw_dc, dict) else {}
    _raw_progress = data.get("progress")
    progress: dict[str, Any] = _raw_progress if isinstance(_raw_progress, dict) else {}
    _raw_reward = dc.get("reward")
    reward: dict[str, Any] = _raw_reward if isinstance(_raw_reward, dict) else {}
    return {
        "code": code if isinstance(code, int) else None,
        "checked_in": dc.get("checked_in_today") is True,
        "continuous_days": dc.get("continuous_days"),
        "reward": reward.get("reward_amount") if isinstance(reward.get("reward_amount"), int) else None,
        "credits": progress.get("total_amount") if isinstance(progress.get("total_amount"), int) else None,
        "message": str(body.get("msg") or body.get("message") or ""),
    }


def _classify_code(biz_code: int | None, http_status: int | None) -> dict[str, Any] | None:
    """业务码/HTTP 态 → classified_error(契约同其它平台)。"""
    if biz_code == _CODE_SESSION_DEAD or (http_status in (401, 403)):
        return {"type": "SessionDead", "cooldown_seconds": -1}
    if biz_code in (_CODE_CHECKIN_BLOCKED, _CODE_RATE_LIMIT):
        # 写接口被拦但会话健康(detail 同参可通):定时重试,不熔断
        return {"type": "BusinessError", "cooldown_seconds": 3600}
    if http_status is not None and http_status >= 500:
        return {"type": "SoftRate", "cooldown_seconds": 300}
    return None


async def doubao_checkin_account(
    name: str,
    token: str,
    device_map: dict[str, Any],
    *,
    timeout: float = DEFAULT_TIMEOUT,
    client: httpx.AsyncClient | None = None,
) -> dict[str, Any]:
    """豆包单账号签到:先 detail 查状态(幂等预检),未签再 claim。"""
    result = _base_result(name, doubao_device_map_uid(device_map))
    err = _validate_token(token)
    if err:
        result["message"] = err
        return result

    # 1) 只读预检(detail 实测 code:0 全通,是豆包侧唯一稳定读面)
    s_status, s_body = await _db_request(
        PATH_DETAIL, token, {"campaign_group_code": SCENE}, timeout=timeout, client=client
    )
    result["http_status"] = s_status if s_status > 0 else None
    parsed = parse_detail(s_body if isinstance(s_body, dict) else None)
    result["code"] = parsed["code"]
    if s_status in (0, -1):
        result["message"] = "网络异常"
        return result
    if parsed["code"] == _CODE_SESSION_DEAD:
        result["classified_error"] = {"type": "SessionDead", "cooldown_seconds": -1}
        result["message"] = "豆包会话失效(710012001),请重新捕获客户端活跃 profile cookie"
        return result
    if parsed["code"] != 0:
        result["message"] = f"detail 查状态失败: code={parsed['code']} {parsed['message']}".strip()
        cls = _classify_code(parsed["code"], s_status)
        if cls:
            result["classified_error"] = cls
        return result
    result["credits"] = parsed["credits"]
    if parsed["checked_in"]:
        result.update(ok=True, status="already", action="skip_already", message="今日已签到,无需重复领取")
        return result

    # 2) 未签 → claim
    c_status, c_body = await _db_request(
        PATH_CHECKIN, token, {"scene": SCENE}, timeout=timeout, client=client
    )
    cj = c_body if isinstance(c_body, dict) else None
    c_code = cj.get("code") if cj and isinstance(cj.get("code"), int) else None
    result["code"] = c_code
    result["http_status"] = c_status if c_status > 0 else None
    if c_status in (0, -1):
        result["message"] = "网络异常"
        return result
    if cj is None:
        result["message"] = f"签到失败: 响应非 JSON(HTTP {c_status})"
        result["classified_error"] = {"type": "Challenge", "cooldown_seconds": 3600}
        return result
    if c_code == 0:
        result.update(
            ok=True,
            status="ok",
            action="claim_ok",
            message="签到成功",
            credits_delta=parsed["reward"],
        )
        return result
    # claim 失败:code 归因(710010702=写接口被拦,疑频控/风控期,定时重试)
    cls = _classify_code(c_code, c_status)
    if cls:
        result["classified_error"] = cls
    if c_code == _CODE_CHECKIN_BLOCKED:
        result["message"] = "签到被拦(710010702 系统错误):会话健康(detail 可通),疑账号频控/风控期,冷却后自动重试"
    elif c_code == _CODE_RATE_LIMIT:
        result["message"] = "签到被拦(710022002 访问频繁),冷却后自动重试"
    else:
        result["message"] = f"签到失败: code={c_code} {cj.get('msg') or cj.get('message') or ''}".strip()
    return result


async def doubao_probe_status(
    name: str,
    token: str,
    device_map: dict[str, Any],
    *,
    timeout: float = DEFAULT_TIMEOUT,
    client: httpx.AsyncClient | None = None,
) -> tuple[bool, bool | None, int | None, str]:
    """只读探针:走 v3/detail/(豆包侧唯一稳定读面,不触发写侧)。

    返回 (ok, checked_in|None, credits|None, message)。签名与
    TRAE/WorkBuddy/Qoder/MiniMax 的状态探针统一,供 06:00 探针分发。
    """
    err = _validate_token(token)
    if err:
        return False, None, None, err
    s_status, s_body = await _db_request(
        PATH_DETAIL, token, {"campaign_group_code": SCENE}, timeout=timeout, client=client
    )
    parsed = parse_detail(s_body if isinstance(s_body, dict) else None)
    if s_status in (0, -1):
        return False, None, None, "网络异常"
    if parsed["code"] != 0:
        cls = _classify_code(parsed["code"], s_status)
        msg = f"detail 查状态失败: code={parsed['code']} {parsed['message']}".strip()
        if cls:
            msg += f" [{cls['type']}]"
        return False, None, None, msg
    msg = f"今日{'已签' if parsed['checked_in'] else '未签'}"
    if parsed["reward"]:
        msg += f",奖励 {parsed['reward']} 额度"
    if parsed["credits"] is not None:
        msg += f",累计 {parsed['credits']}"
    return True, parsed["checked_in"], parsed["credits"], msg


async def doubao_query_credits(
    token: str,
    device_map: dict[str, Any],
    *,
    timeout: float = DEFAULT_TIMEOUT,
    client: httpx.AsyncClient | None = None,
) -> dict[str, Any]:
    """余额查询:detail 的 progress.total_amount 即累计额度(只读,快照用)。

    返回 {"error": str|None, "remaining": int|None};契约对齐
    minimax_query_credits 供快照循环统一消费。
    """
    err = _validate_token(token)
    if err:
        return {"error": err, "remaining": None}
    s_status, s_body = await _db_request(
        PATH_DETAIL, token, {"campaign_group_code": SCENE}, timeout=timeout, client=client
    )
    parsed = parse_detail(s_body if isinstance(s_body, dict) else None)
    if s_status in (0, -1):
        return {"error": "网络异常", "remaining": None}
    if parsed["code"] != 0:
        return {"error": f"detail code={parsed['code']} {parsed['message']}".strip(), "remaining": None}
    return {"error": None, "remaining": parsed["credits"]}
