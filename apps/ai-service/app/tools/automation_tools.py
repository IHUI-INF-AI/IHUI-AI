# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

# WATERMARK-PLACEHOLDER(本行由 scripts/watermark.mjs inject 替换为横幅)

"""G2 对话式自动化:create_automation 工具(2026-10-30 立)。

让 agent 在对话里替用户创建 user_automations 定时任务。实现方式是**调 apps/api 的
POST /api/automations 端点**(与 edu_* 工具调 /api/edu-ai-management/* 同一路线:
internal_service_headers 双头鉴权 + httpx + 剥 success() 壳),而不是自己拼 SQL ——
排期计算(nextRunAt)、carrier 互斥、会话归属校验等判据只住 api 路由一处,工具层
重复一份必然漂移。

工具层比 api 更严的地方只有 rrule:api 的 parseRruleParts 对未知段**静默忽略**
(`FREQ=DAILY;BYMONTH=1` 会按纯 DAILY 排下去 = 对用户"虚假承诺"排程),这里直接拒。
MVP 子集与 api 逐字同判据:FREQ=HOURLY|DAILY|WEEKLY + BYHOUR/BYMINUTE/BYDAY,
WEEKLY 必带 BYDAY。

Goal 自评迭代(可选):{target, max_runs},落库形态与 api 侧
services/automations/goal-loop.ts 的 readGoalState 解析器严格对齐(嵌 last_result
jsonb 的 goal 键,schema 冻结零迁移)。max_runs 默认 3、硬上限 10,越界拒收。

身份链路:路由身份(__user_id/__session_id)由 call_tool 宿主注入覆盖,LLM 不可控
(create_artifact/request_business_form 同款纪律)。__user_id 缺失 ⇒ 直接拒,不发请求。
"""

from __future__ import annotations

import logging
import os
import re
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from ..core.internal_ticket import internal_service_headers

logger = logging.getLogger(__name__)

_TOOL_NAME = "create_automation"

# 与 api 侧 createSchema 同档的边界(改一边必须同批改另一边)
_NAME_LIMIT = 200
_PROMPT_LIMIT = 8000
_RRULE_LIMIT = 500
GOAL_TARGET_LIMIT = 2000
GOAL_MAX_RUNS_CAP = 10
GOAL_DEFAULT_MAX_RUNS = 3

# rrule MVP 白名单(见模块 docstring:工具层比 api 严,未知段直接拒而非静默忽略)
_RRULE_ALLOWED_KEYS: frozenset[str] = frozenset({"FREQ", "BYHOUR", "BYMINUTE", "BYDAY"})
_RRULE_FREQS: frozenset[str] = frozenset({"HOURLY", "DAILY", "WEEKLY"})
_RRULE_WEEKDAYS: frozenset[str] = frozenset({"MO", "TU", "WE", "TH", "FR", "SA", "SU"})

_UUID_RE = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)

# api 基址:与 edu 工具同一 env(API_SERVICE_URL),默认 8802。
# 做成函数而非模块常量:测试 monkeypatch env 后即时生效(模块常量会冻住)。
def _api_base_url() -> str:
    return os.environ.get("API_SERVICE_URL", "http://localhost:8802").rstrip("/")


def _fail(code: str, message: str) -> dict[str, Any]:
    return {"tool": _TOOL_NAME, "ok": False, "errorCode": code, "message": message}


# =============================================================================
# 参数校验(纯函数,返回错误信息或 None;全部在发请求之前跑完)
# =============================================================================

def validate_rrule(rrule: Any) -> str | None:
    """rrule MVP 白名单校验(防注入 + 防"虚假承诺"排程);合法返回 None。"""
    if not isinstance(rrule, str) or not rrule.strip():
        return "rrule 必须是非空字符串"
    if len(rrule) > _RRULE_LIMIT:
        return f"rrule 长度不得超过 {_RRULE_LIMIT}"
    parts: dict[str, str] = {}
    for seg in rrule.split(";"):
        if not seg.strip():
            return "rrule 含空段(相邻分号或首尾分号)"
        idx = seg.find("=")
        if idx <= 0:
            return f"rrule 段 {seg!r} 不是 KEY=VALUE 形态"
        key = seg[:idx].strip().upper()
        value = seg[idx + 1 :].strip()
        if key not in _RRULE_ALLOWED_KEYS:
            return f"rrule 含不支持的段 {key!r}(MVP 仅允许 FREQ/BYHOUR/BYMINUTE/BYDAY)"
        if key in parts:
            return f"rrule 段 {key!r} 重复出现"
        if not value:
            return f"rrule 段 {key!r} 的值为空"
        parts[key] = value

    freq = parts.get("FREQ", "").upper()
    if freq not in _RRULE_FREQS:
        return "rrule 必须含 FREQ=HOURLY|DAILY|WEEKLY"
    if "BYHOUR" in parts:
        if not re.fullmatch(r"\d+", parts["BYHOUR"]) or not 0 <= int(parts["BYHOUR"]) <= 23:
            return "rrule 的 BYHOUR 必须是 0-23 的整数"
    if "BYMINUTE" in parts:
        if not re.fullmatch(r"\d+", parts["BYMINUTE"]) or not 0 <= int(parts["BYMINUTE"]) <= 59:
            return "rrule 的 BYMINUTE 必须是 0-59 的整数"
    if "BYDAY" in parts:
        tokens = [t.strip().upper() for t in parts["BYDAY"].split(",")]
        if any(t not in _RRULE_WEEKDAYS for t in tokens):
            return "rrule 的 BYDAY 取值必须是 MO/TU/WE/TH/FR/SA/SU(逗号分隔)"
        if len(set(tokens)) != len(tokens):
            return "rrule 的 BYDAY 含重复星期代号"
    # 段与 FREQ 的语义匹配(api parseNextRun:HOURLY 走绝对 +1h、忽略全部 BY* 墙钟段;
    # DAILY 忽略 BYDAY)。api 对不匹配的段静默忽略 = "虚假承诺"排程(用户要"每周一
    # 9 点每小时",实际每天每小时跑),工具层直接拒,让模型拿到可读错误去改参。
    if freq == "HOURLY" and (_RRULE_ALLOWED_KEYS - {"FREQ"}) & set(parts.keys()):
        return "FREQ=HOURLY 不支持 BYHOUR/BYMINUTE/BYDAY(每小时执行按绝对时刻步进)"
    if freq == "DAILY" and "BYDAY" in parts:
        return "FREQ=DAILY 不支持 BYDAY(每天执行与星期无关;想按星期请用 WEEKLY)"
    if freq == "WEEKLY" and "BYDAY" not in parts:
        return "FREQ=WEEKLY 必须显式给出 BYDAY(如 BYDAY=MO,WE,FR)"
    return None


def _validate_scheduled_at(value: Any) -> str | None:
    """once 的执行时刻:ISO 8601 且必须带时区偏移(api 侧 z.iso.datetime({offset:true}) 同判据)。"""
    if not isinstance(value, str) or not value.strip():
        return "scheduled_at 必须是 ISO 8601 日期时间字符串(如 2026-11-01T09:00:00+08:00)"
    raw = value.strip()
    try:
        # fromisoformat 在 3.11+ 已支持 Z,但为兼容 3.10 语义先归一(与 api zod 的 offset 档同判)
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00").replace("z", "+00:00"))
    except ValueError:
        return f"scheduled_at 无法解析为 ISO 8601:{raw!r}"
    if parsed.tzinfo is None:
        return "scheduled_at 必须带时区偏移(如 +08:00 或 Z),裸本地时间会被按服务器时区误读"
    return None


def _validate_timezone(value: Any) -> str | None:
    """IANA 时区名校验(与 api 的 resolveScheduleZone 同档;api 会兜底,这里拒收更诚实)。"""
    if not isinstance(value, str) or not value.strip():
        return "timezone 必须是非空 IANA 时区名(如 Asia/Shanghai)"
    try:
        ZoneInfo(value.strip())
    except Exception:  # noqa: BLE001  # ZoneInfoNotFoundError 等一律按非法处理
        return f"timezone 不是合法 IANA 时区名:{value!r}"
    return None


def _validate_goal(goal: Any) -> tuple[dict[str, Any] | None, str | None]:
    """goal 归一为 api 侧落库形态 {target, maxRuns};返回 (归一值, 错误信息)。"""
    if not isinstance(goal, dict):
        return None, "goal 必须是对象 {target, max_runs?}"
    target = goal.get("target")
    if not isinstance(target, str) or not target.strip():
        return None, "goal.target 必须是非空字符串(自评的对照基准)"
    if len(target.strip()) > GOAL_TARGET_LIMIT:
        return None, f"goal.target 长度不得超过 {GOAL_TARGET_LIMIT}"
    # 兼容两种键名(工具 schema 用 snake_case,api 落库形态用 camelCase)
    max_raw = goal.get("max_runs", goal.get("maxRuns"))
    if max_raw is None:
        max_runs = GOAL_DEFAULT_MAX_RUNS
    elif isinstance(max_raw, bool) or not isinstance(max_raw, (int, float)):
        return None, "goal.max_runs 必须是整数"
    elif max_raw != int(max_raw) or int(max_raw) < 1 or int(max_raw) > GOAL_MAX_RUNS_CAP:
        return None, f"goal.max_runs 必须是 1-{GOAL_MAX_RUNS_CAP} 的整数"
    else:
        max_runs = int(max_raw)
    return {"target": target.strip(), "maxRuns": max_runs}, None


# =============================================================================
# 鉴权头与 HTTP 出口(与 edu 工具同路线;_api_request 单独抽出便于测试 monkeypatch)
# =============================================================================

def _internal_headers(user_id: str) -> dict[str, str]:
    """内部凭证头:走 internal_service_headers 唯一出口(dual 档两把头一起带)。

    scope 用既有 "api-tools"(INTERNAL_TICKET_SCOPES 是封闭集、两侧同笔,新增
    "mcp-automation" 不在本车道授权面);api 侧 checkInternalServiceToken 不传
    opts.scope ⇒ 合法票 + 合法密钥即可,userId 由 X-User-Id 注入 request.userId。
    凭证或身份缺失返回 {},调用方不发请求(fail-closed)。
    """
    uid = str(user_id or "").strip()
    secret = os.environ.get("AI_CALLBACK_SECRET", "").strip()
    if not secret or not uid or not re.fullmatch(r"[a-zA-Z0-9-]{1,128}", uid):
        return {}
    return internal_service_headers(uid, "api-tools", legacy_token=secret)


async def _api_request(
    url: str, headers: dict[str, str], body: dict[str, Any]
) -> tuple[int, Any]:
    """POST 到 apps/api 并解析 JSON;返回 (状态码, 解析后的 payload 或 None)。

    单独成函数就是为了测试面可以整体替换它(不碰 httpx),网络异常收敛成 (0, None)。
    """
    import httpx

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, headers=headers, json=body)
    except Exception as exc:  # noqa: BLE001
        logger.warning("[create_automation] 调用 apps/api 失败:%s", exc)
        return 0, None
    try:
        return resp.status_code, resp.json()
    except Exception:  # noqa: BLE001
        return resp.status_code, None


# =============================================================================
# 工具入口
# =============================================================================

async def create_automation(arguments: dict[str, Any]) -> dict[str, Any]:
    """create_automation:经 apps/api POST /api/automations 创建定时自动化。

    必填 name/prompt/schedule_type;once⇒scheduled_at、recurring⇒rrule(互斥,
    与 api createSchema 的四条 refine 同判据,矛盾组合在工具层先拒)。
    goal 可选;__session_id 为 UUID 形态时随请求绑为 conversationId(D12 线程接力)。
    """
    uid = str(arguments.get("__user_id") or "").strip()
    if not uid:
        return _fail("MISSING_USER", "缺少用户身份(__user_id 未注入),无法创建自动化")

    name = arguments.get("name")
    if not isinstance(name, str) or not name.strip():
        return _fail("INVALID_NAME", "name 必须是非空字符串")
    if len(name.strip()) > _NAME_LIMIT:
        return _fail("INVALID_NAME", f"name 长度不得超过 {_NAME_LIMIT}")

    prompt = arguments.get("prompt")
    if not isinstance(prompt, str) or not prompt.strip():
        return _fail("INVALID_PROMPT", "prompt 必须是非空字符串")
    if len(prompt.strip()) > _PROMPT_LIMIT:
        return _fail("INVALID_PROMPT", f"prompt 长度不得超过 {_PROMPT_LIMIT}")

    schedule_type = arguments.get("schedule_type")
    if schedule_type not in ("once", "recurring"):
        return _fail("INVALID_SCHEDULE_TYPE", "schedule_type 必须是 once 或 recurring")

    has_rrule = arguments.get("rrule") not in (None, "")
    has_scheduled_at = arguments.get("scheduled_at") not in (None, "")
    if schedule_type == "once":
        if not has_scheduled_at:
            return _fail("MISSING_SCHEDULED_AT", "一次性计划必须提供 scheduled_at")
        if has_rrule:
            return _fail("CARRIER_CONFLICT", "周期与一次性互斥:一次性计划不得携带 rrule")
        err = _validate_scheduled_at(arguments["scheduled_at"])
        if err:
            return _fail("INVALID_SCHEDULED_AT", err)
    else:
        if not has_rrule:
            return _fail("MISSING_RRULE", "重复计划必须提供 rrule")
        if has_scheduled_at:
            return _fail("CARRIER_CONFLICT", "周期与一次性互斥:重复计划不得携带 scheduled_at")
        err = validate_rrule(arguments["rrule"])
        if err:
            return _fail("INVALID_RRULE", err)

    timezone = arguments.get("timezone")
    if timezone is not None:
        err = _validate_timezone(timezone)
        if err:
            return _fail("INVALID_TIMEZONE", err)

    goal = arguments.get("goal")
    normalized_goal: dict[str, Any] | None = None
    if goal is not None:
        normalized_goal, err = _validate_goal(goal)
        if err:
            return _fail("INVALID_GOAL", err)

    body: dict[str, Any] = {
        "name": name.strip(),
        "prompt": prompt.strip(),
        "scheduleType": schedule_type,
        "timezone": (timezone.strip() if timezone else "Asia/Shanghai"),
    }
    if schedule_type == "once":
        body["scheduledAt"] = str(arguments["scheduled_at"]).strip()
    else:
        body["rrule"] = str(arguments["rrule"]).strip()
    if normalized_goal is not None:
        body["goal"] = normalized_goal
    # D12 线程接力:只有 UUID 形态的 __session_id 才可能是会话 id(auto_<id> 等传了会被
    # api 的 uuid 校验打回 400,不如在工具层就只带能带的)
    session_id = str(arguments.get("__session_id") or "").strip()
    if _UUID_RE.match(session_id):
        body["conversationId"] = session_id

    headers = _internal_headers(uid)
    if not headers:
        return _fail(
            "INTERNAL_AUTH_UNAVAILABLE",
            "内部服务凭证未配置(AI_CALLBACK_SECRET)或用户身份非法,无法调用自动化接口",
        )

    status, payload = await _api_request(f"{_api_base_url()}/api/automations", headers, body)
    if status == 0:
        return _fail("NETWORK_ERROR", "自动化接口请求失败(网络异常),请稍后重试")
    data = payload.get("data") if isinstance(payload, dict) else None
    if 200 <= status < 400:
        if not isinstance(data, dict):
            return _fail("BAD_UPSTREAM_SHAPE", f"自动化接口返回结构异常(HTTP {status})")
        return {
            "tool": _TOOL_NAME,
            "ok": True,
            "automation": data,
            "message": f"自动化「{data.get('name', name.strip())}」已创建"
            + ("(含 Goal 自评迭代)" if normalized_goal else ""),
        }
    message = payload.get("message") if isinstance(payload, dict) else None
    return _fail(f"HTTP_{status}", str(message) if message else f"自动化接口返回 HTTP {status}")
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
