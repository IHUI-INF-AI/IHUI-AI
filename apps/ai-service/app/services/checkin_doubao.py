# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
"""豆包(Doubao PC 客户端)签到 + 任务赚积分引擎 — 第五平台(2026-11-11 立)。

契约来源(实证链,详见 scripts/lib/doubao-checkin-api.mjs 与
.workbuddy/memory/2026-11-11.md):
- 客户端主进程日志 saman_frontend_*.log 完整真实 URL(鉴权四要素实锤);
- local_webcontents/extensions/ai-views/static/js/async/37673.js 反编译
  (DailyCheckIn({scene}) 契约);
- CreditDaddy issue#32 已验证实现(纯 cookie 可打,无 a_bogus/msToken 签名);
- 2026-11-11 组合矩阵实测:DoubaoDesktop UA + aid=497858 web 指纹
  + device_id 空 → v3/detail/ code:0 全通。

端点(www.doubao.com,均为 POST JSON):
  /alice/ug/campaign/v3/detail/            body {campaign_group_code} → 查状态(只读)
  /alice/ug/campaign/landing/checkin       body {scene}              → 签到领取(写)
  /alice/ug/campaign/item/reward/claim/    body {task_id|campaign_group_code+campaign_item_code}
                                            → 任务/里程碑领奖(写,2026-11-16 实证)
  /alice/ug/event/report                   body {scene,campaign_item_code,params}
                                            → 行为任务完成上报(写,select_work_fields 实证)
  /chat/completion                         SSE → 生成类任务真跑推荐 prompt(写,可选)
活动组/scene = pc_incentive_task_mvp_v3,任务码 daily_signin(200 额度/天)。

鉴权:token = 豆包 cookie 头(opaque,须取客户端活跃 profile 的完整会话;
本机 Default profile 是旧号残留,捕获时必须对准客户端活跃 profile)。
device_map 可带 user_id/uid(展示用)。

任务族(2026-11-16):detail 双指纹并集 —— 客户端指纹(aid=582478+device_id+
client_platform=pc_client)才会下发领奖必需的 task_id;web 指纹补 daily_signin/
每日工作任务与签到态。领奖参数三条分支严格复刻线上 claimIncentiveReward。
服务端对任务奖励有资格判定(实测健康账号仍可能回「当前暂不符合领取条件」
biz_error)⇒ 归 BusinessError 冷却 21600s,每日巡检自然节拍重试,不熔断。

已知限制(2026-11-11):checkin 写接口在账号风控/频控期稳定 710010702
「系统错误」,与参数无关 ⇒ 归类 BusinessError 冷却 3600s 等解封,不熔断
不永久摘除(读接口同参全通,会话本身健康)。
结构化 dict 契约与 checkin_engine / minimax / qoder 完全一致。
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import re
import time
import uuid
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

# ===== 任务族(2026-11-16 实证,来源:desktop_online_web 线上 bundle) =====
# 契约来源(全部逐字节取自 www.doubao.com 线上 JS,非猜测):
#   static/js/2198.4e43149d.js  → UgCampaignApiService 全部端点定义
#   static/js/async/709.b4632b25.js → useIncentiveTask / claimIncentiveReward 参数决策
#   static/js/async/pc/agent-explore_page.b285c6b3.js → EventReport(client_action) 完成表单任务
# 端点(均 POST JSON,query 面同 detail):
#   /alice/ug/campaign/v3/detail/            读任务/里程碑/进度
#   /alice/ug/campaign/landing/checkin        每日签到 claim
#   /alice/ug/campaign/item/reward/claim/     任务/里程碑领奖
#   /alice/ug/event/report                    行为类任务完成上报(select_work_fields)
PATH_REWARD_CLAIM: Final = "/alice/ug/campaign/item/reward/claim/"
PATH_EVENT_REPORT: Final = "/alice/ug/event/report"

# 任务状态真值表(线上 bundle CampaignTaskStatus 枚举,字符串型):
#   0/unknown → 未判定;1/created → 未开始;2/completed → 已完成可领;
#   3/rewarded → 已领取;4/inprogress → 进行中
TASK_STATUS_UNKNOWN: Final = 0
TASK_STATUS_CREATED: Final = 1
TASK_STATUS_COMPLETED: Final = 2
TASK_STATUS_REWARDED: Final = 3
TASK_STATUS_IN_PROGRESS: Final = 4

TASK_KIND_DAILY_SIGNIN: Final = "daily_signin"
TASK_KIND_MILESTONE: Final = "points_milestone"
# 每日工作任务:领取必须带服务端下发的实例 task_id(线上 bundle isDailyWorkTask)
TASK_CODE_DAILY_WORK: Final = "pc_task_complete_work_task_daily"
# 工作领域选择任务:完成走 EventReport(client_action) 而非生成行为
TASK_CODE_WORK_FIELDS: Final = "select_work_fields"

# 客户端指纹(2026-11-16 实测):detail 只有客户端指纹才下发 task_id;
# web 指纹返回的已完成任务没有 task_id ⇒ 领奖会缺参。写侧一律用客户端指纹。
CLIENT_AID: Final = "582478"
CLIENT_UA: Final = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) SamanthaDoubao/2.33.5 Chrome/147.0.7727.149 Safari/537.36"
)
_CHAT_PATH: Final = "/chat/completion"
_CHAT_BOT_ID: Final = "7338286299411103781"

# 生成类任务 → 客户端默认技能名(线上 bundle 21584 逐字:
# r={gen_ppt:"Lark-sLides-pro",GenPPT:"Lark-sLides-pro",GenWord:"lark-doc",
#    GenExcel:"lark-sheets",ScheduleSkill:"schedule"})
TASK_SKILL_MAP: Final[dict[str, str]] = {
    "GenWord": "lark-doc",
    "GenExcel": "lark-sheets",
    "GenPPT": "Lark-sLides-pro",
    "gen_ppt": "Lark-Slides-pro",
    "ScheduleSkill": "schedule",
}

# 依赖用户先上传素材的推荐 prompt 标记:自动跑时优先选「自带主题、可独立完成」的那条
_UPLOAD_DEP_MARKERS: Final = (
    "上传",
    "我提供",
    "这份",
    "这篇文章",
    "我的",
    "设备清单",
    "员工名单",
    "用户反馈",
    "客户资料",
    "论文",
    "文献",
)



def doubao_device_map_uid(device_map: dict[str, Any] | None) -> str | None:
    dm = device_map or {}
    for key in ("uid", "user_id", "userId"):
        val = dm.get(key)
        if isinstance(val, (str, int)) and str(val).strip():
            return str(val).strip()
    return None


def doubao_client_device_id(device_map: dict[str, Any] | None) -> str:
    """稳定客户端 device_id:优先 device_map 已登记值,否则按 uid 派生 16 位数字。

    线上实测:客户端指纹(aid=582478 + device_id + client_platform=pc_client)
    的 v3/detail 才下发 task_id;device_id 服务端不严格校验但账号间须互异。
    """
    dm = device_map or {}
    for key in ("doubao_device_id", "device_id", "deviceId"):
        val = dm.get(key)
        if isinstance(val, (str, int)) and str(val).strip().isdigit():
            return str(val).strip()
    seed = hashlib.sha256(f"doubao-client:{doubao_device_map_uid(dm) or 'anonymous'}".encode()).digest()
    return "19" + "".join(str(b % 10) for b in seed[:14])


def _client_query(device_map: dict[str, Any] | None) -> dict[str, str]:
    """客户端指纹 query(写侧唯一形态;读侧 detail 用它拿 task_id)。"""
    params = dict(_COMMON_QUERY)
    params.update(
        {
            "aid": CLIENT_AID,
            "real_aid": CLIENT_AID,
            "device_id": doubao_client_device_id(device_map),
            "client_platform": "pc_client",
            "region": "CN",
            "sys_region": "CN",
            "tz_name": "Asia/Shanghai",
        }
    )
    return params



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


def normalize_cookie_header(token: str) -> str:
    """号池 token(裸 sessionid)→ 可用 cookie 头。幂等,单一真源。

    号池 doubao 的 tokenEnc 实测就是 32 字符 sessionid 裸值(与 cookies 里
    sessionid 完全相等,2026-11-16 实证),而签到引擎的契约是 cookie 头 ⇒ 必须
    在唯一入口折叠成 `sessionid_ss=…; sessionid=…`(与 apps/api 侧
    doubao-adapter 的推断映射同口径,已实测 v3/detail code:0)。
    ttwid 形态(1%7C/1| 开头)按 ttwid 落,不套 sessionid;已含 "=" 的头原样保留。
    """
    tok = (token or "").strip()
    if not tok:
        return ""
    if "=" in tok.split(";")[0] and "sessionid=" in tok:
        return tok
    if tok.startswith("ttwid="):
        return tok
    if tok.startswith("1%7C") or tok.startswith("1|"):
        return f"ttwid={tok}"
    return f"sessionid_ss={tok}; sessionid={tok}"


def _validate_token(token: str) -> str | None:
    """cookie 头校验:裸 sessionid 自动折叠;空值才拒。返回错误消息或 None。"""
    tok = normalize_cookie_header(token)
    if not tok:
        return "未配置 token(豆包 cookie 头),请从客户端活跃 profile 重新捕获"
    if "sessionid=" not in tok and "ttwid=" not in tok:
        return "cookie 头缺 sessionid/ttwid,非完整豆包会话,请重新捕获"
    return None


async def _db_request(
    path: str,
    token: str,
    body: dict[str, Any],
    *,
    timeout: float = DEFAULT_TIMEOUT,
    client: httpx.AsyncClient | None = None,
    query: dict[str, str] | None = None,
    ua: str | None = None,
    use_client_fingerprint: bool = False,
    device_map: dict[str, Any] | None = None,
) -> tuple[int, Any]:
    """统一豆包 POST:web/客户端指纹 query + cookie 鉴权。返回 (http_status, json|None)。"""
    params = httpx.QueryParams(query if query is not None else _COMMON_QUERY)
    http = client if client is not None else get_http_client()
    url = f"{DOUBAO_HOST}{path}?{params}"
    headers = {
        "cookie": normalize_cookie_header(token),
        "content-type": "application/json",
        "accept": "application/json, text/plain, */*",
        "referer": f"{DOUBAO_HOST}/pc/agent-explore",
        "origin": DOUBAO_HOST,
        "user-agent": ua or (CLIENT_UA if use_client_fingerprint else _UA),
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

    # 1) 只读预检(detail 客户端指纹才 code:0;web 指纹会 code:2 campaign not found)。
    # 2026-11-17 实证:web 指纹 detail 全部 code=2,客户端指纹(_fetch_campaign 同款)
    # code=0 且 checked_in 可信;预检用错指纹会让签到永远停在"查状态失败"。
    s_status, s_body = await _db_request(
        PATH_DETAIL,
        token,
        {"campaign_group_code": SCENE},
        timeout=timeout,
        client=client,
        query=_client_query(device_map),
        use_client_fingerprint=True,
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
    2026-11-17:改用客户端指纹(web 指纹 detail 恒 code=2,探针会全误报失败)。
    """
    err = _validate_token(token)
    if err:
        return False, None, None, err
    s_status, s_body = await _db_request(
        PATH_DETAIL,
        token,
        {"campaign_group_code": SCENE},
        timeout=timeout,
        client=client,
        query=_client_query(device_map),
        use_client_fingerprint=True,
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
        PATH_DETAIL,
        token,
        {"campaign_group_code": SCENE},
        timeout=timeout,
        client=client,
        query=_client_query(device_map),
        use_client_fingerprint=True,
    )
    parsed = parse_detail(s_body if isinstance(s_body, dict) else None)
    if s_status in (0, -1):
        return {"error": "网络异常", "remaining": None}
    if parsed["code"] != 0:
        return {"error": f"detail code={parsed['code']} {parsed['message']}".strip(), "remaining": None}
    return {"error": None, "remaining": parsed["credits"]}


# =============================================================================
# 任务族:读清单 / 完成行为任务 / 领奖(2026-11-16 立)
# =============================================================================

# 任务状态 → 人读文案(单一真源;路由/调度/前端展示共用)
TASK_STATUS_TEXT: Final[dict[int, str]] = {
    TASK_STATUS_UNKNOWN: "unknown",
    TASK_STATUS_CREATED: "created",
    TASK_STATUS_COMPLETED: "completed",
    TASK_STATUS_REWARDED: "rewarded",
    TASK_STATUS_IN_PROGRESS: "in_progress",
}

# 领奖成功码(线上 assertSuccess:code ∈ {0,200})
_CLAIM_OK_CODES: Final = (0, 200)


def normalize_task_status(value: Any) -> int:
    """任务状态归一(整数/字符串两种线上形态都收,未知归 0 不猜绿)。"""
    if isinstance(value, bool):
        return TASK_STATUS_UNKNOWN
    if isinstance(value, int):
        return value if value in TASK_STATUS_TEXT else TASK_STATUS_UNKNOWN
    if isinstance(value, str):
        key = value.strip().lower()
        mapping = {
            "0": 0,
            "unknown": 0,
            "1": 1,
            "created": 1,
            "2": 2,
            "completed": 2,
            "3": 3,
            "rewarded": 3,
            "4": 4,
            "inprogress": 4,
            "in_progress": 4,
        }
        return mapping.get(key, TASK_STATUS_UNKNOWN)
    return TASK_STATUS_UNKNOWN


def _sum_reward(item: dict[str, Any]) -> int | None:
    """reward_summaries / daily_checkin.reward → 奖励额度合计(None=平台未给)。"""
    raw = item.get("reward_summaries")
    total = 0
    found = False
    if isinstance(raw, list):
        for r in raw:
            if isinstance(r, dict) and isinstance(r.get("reward_amount"), int):
                total += int(r["reward_amount"])
                found = True
    if found:
        return total
    dc = item.get("daily_checkin")
    if isinstance(dc, dict):
        reward = dc.get("reward")
        if isinstance(reward, dict) and isinstance(reward.get("reward_amount"), int):
            return int(reward["reward_amount"])
    return None


def normalize_task(raw: dict[str, Any]) -> dict[str, Any]:
    """线上 task/milestone 对象 → 统一任务行(字段名对齐线上 normalizeTask)。"""
    status = normalize_task_status(raw.get("task_status"))
    task_id = raw.get("task_id")
    return {
        "code": str(raw.get("campaign_code") or "").strip(),
        "kind": str(raw.get("task_kind") or "").strip(),
        "campaign_type": str(raw.get("campaign_type") or "").strip() or None,
        "status": status,
        "status_text": TASK_STATUS_TEXT.get(status, "unknown"),
        "reward": _sum_reward(raw),
        # reward_mode=2 → 直接领取(无需完成);1 → 完成后领取
        "reward_mode": raw.get("reward_mode") if isinstance(raw.get("reward_mode"), int) else None,
        "task_id": str(task_id).strip() if isinstance(task_id, (str, int)) and str(task_id).strip() else None,
        "recommend_prompts": [
            p for p in (raw.get("recommend_prompts") or []) if isinstance(p, str) and p.strip()
        ]
        if isinstance(raw.get("recommend_prompts"), list)
        else [],
    }


def parse_campaign(body: dict[str, Any] | None) -> dict[str, Any]:
    """v3/detail 响应 → {code,message,credits,checked_in,reward,tasks,milestones}。"""
    if not isinstance(body, dict):
        return {
            "code": None,
            "message": "响应非 JSON",
            "credits": None,
            "checked_in": False,
            "reward": None,
            "continuous_days": None,
            "tasks": [],
            "milestones": [],
        }
    code = body.get("code") if isinstance(body.get("code"), int) else None
    _data = body.get("data")
    data: dict[str, Any] = _data if isinstance(_data, dict) else {}
    _raw_tasks = data.get("tasks")
    raw_tasks: list[Any] = _raw_tasks if isinstance(_raw_tasks, list) else []
    tasks = [normalize_task(t) for t in raw_tasks if isinstance(t, dict)]
    tasks = [t for t in tasks if t["code"] != ""]
    _raw_ms = data.get("milestones")
    milestones = [
        {
            **normalize_task(m),
            "threshold": int(m["milestone_threshold"])
            if isinstance(m.get("milestone_threshold"), int)
            else None,
        }
        for m in (_raw_ms if isinstance(_raw_ms, list) else [])
        if isinstance(m, dict)
    ]
    milestones = [m for m in milestones if m["code"] != ""]
    _progress = data.get("progress")
    progress: dict[str, Any] = _progress if isinstance(_progress, dict) else {}
    signin = next((t for t in tasks if t["code"] == TASK_KIND_DAILY_SIGNIN), None)
    checked_in = False
    reward = None
    continuous_days = None
    for raw in raw_tasks:
        if isinstance(raw, dict) and raw.get("campaign_code") == TASK_KIND_DAILY_SIGNIN:
            dc = raw.get("daily_checkin")
            if isinstance(dc, dict):
                checked_in = dc.get("checked_in_today") is True
                continuous_days = dc.get("continuous_days")
                rw = dc.get("reward")
                if isinstance(rw, dict) and isinstance(rw.get("reward_amount"), int):
                    reward = int(rw["reward_amount"])
            break
    if signin is not None and signin["status"] == TASK_STATUS_REWARDED:
        checked_in = True
    return {
        "code": code,
        "message": str(body.get("msg") or body.get("message") or ""),
        "credits": int(progress["total_amount"])
        if isinstance(progress.get("total_amount"), int)
        else None,
        "checked_in": checked_in,
        "reward": reward,
        "continuous_days": continuous_days,
        "tasks": tasks,
        "milestones": milestones,
    }


async def _fetch_campaign(
    token: str,
    device_map: dict[str, Any] | None,
    *,
    timeout: float = DEFAULT_TIMEOUT,
    client: httpx.AsyncClient | None = None,
    client_fingerprint: bool = True,
) -> tuple[int, dict[str, Any]]:
    """读 detail。客户端指纹是唯一会下发 task_id 的形态;web 指纹补签到态。"""
    s_status, s_body = await _db_request(
        PATH_DETAIL,
        token,
        {"campaign_group_code": SCENE},
        timeout=timeout,
        client=client,
        query=_client_query(device_map) if client_fingerprint else None,
        use_client_fingerprint=client_fingerprint,
    )
    parsed = parse_campaign(s_body if isinstance(s_body, dict) else None)
    return s_status, parsed


def merge_campaign(primary: dict[str, Any], secondary: dict[str, Any]) -> dict[str, Any]:
    """合并两份 detail:primary(客户端指纹,带 task_id)为主,secondary(web)补缺。

    线上实测两份 tasks 集合不同:web 有 daily_signin/daily work 且带签到态,
    客户端才有已完成任务的 task_id ⇒ 必须并集,否则每日工作任务永远不可见。
    同 code 以 primary 为准(它的 task_id 是领奖必需),但签到态/奖励文案取有值的一方。
    """
    if primary.get("code") != 0:
        return secondary
    if secondary.get("code") != 0:
        return primary
    merged = dict(primary)
    by_code = {t["code"]: t for t in primary.get("tasks") or []}
    for t in secondary.get("tasks") or []:
        old = by_code.get(t["code"])
        if old is None:
            by_code[t["code"]] = t
            continue
        # 补 task_id / 更高的进度态(completed > created),其余保持 primary
        if not old.get("task_id") and t.get("task_id"):
            old["task_id"] = t["task_id"]
        if old.get("status") in (TASK_STATUS_UNKNOWN, TASK_STATUS_CREATED) and t.get(
            "status"
        ) in (TASK_STATUS_COMPLETED, TASK_STATUS_REWARDED):
            old["status"] = t["status"]
            old["status_text"] = TASK_STATUS_TEXT.get(t["status"], "unknown")
        if old.get("reward") is None and t.get("reward") is not None:
            old["reward"] = t["reward"]
        if not old.get("recommend_prompts") and t.get("recommend_prompts"):
            old["recommend_prompts"] = t["recommend_prompts"]
    merged["tasks"] = list(by_code.values())
    ms_by_code = {m["code"]: m for m in primary.get("milestones") or []}
    for m in secondary.get("milestones") or []:
        old_m = ms_by_code.get(m["code"])
        if old_m is None:
            ms_by_code[m["code"]] = m
        elif old_m.get("status") in (TASK_STATUS_UNKNOWN, TASK_STATUS_CREATED) and m.get(
            "status"
        ) in (TASK_STATUS_COMPLETED, TASK_STATUS_REWARDED):
            old_m["status"] = m["status"]
            old_m["status_text"] = TASK_STATUS_TEXT.get(m["status"], "unknown")
    merged["milestones"] = list(ms_by_code.values())
    if secondary.get("checked_in"):
        merged["checked_in"] = True
    if merged.get("reward") is None:
        merged["reward"] = secondary.get("reward")
    if merged.get("continuous_days") is None:
        merged["continuous_days"] = secondary.get("continuous_days")
    if merged.get("credits") is None:
        merged["credits"] = secondary.get("credits")
    return merged


async def _fetch_campaign_merged(
    token: str,
    device_map: dict[str, Any] | None,
    *,
    timeout: float = DEFAULT_TIMEOUT,
    client: httpx.AsyncClient | None = None,
) -> tuple[int, dict[str, Any]]:
    """客户端 + web 双读并集(唯一入口,任务清单与巡检共用)。"""
    s_status, primary = await _fetch_campaign(
        token, device_map, timeout=timeout, client=client, client_fingerprint=True
    )
    if primary.get("code") != 0:
        return s_status, primary
    _, secondary = await _fetch_campaign(
        token, device_map, timeout=timeout, client=client, client_fingerprint=False
    )
    return s_status, merge_campaign(primary, secondary)


def _base_task_result(name: str, user_id: str | None) -> dict[str, Any]:
    return {
        "name": name,
        "ok": False,
        "status": "fail",
        "action": "task_sweep",
        "user_id": user_id,
        "code": None,
        "message": "",
        "http_status": None,
        "credits": None,
        "credits_delta": None,
        "classified_error": None,
        "steps": [],
        "claimed": [],
        "skipped": [],
        "claimed_count": 0,
    }


def claim_body_for(task: dict[str, Any], campaign_group: str = SCENE) -> dict[str, Any]:
    """按线上 claimIncentiveReward 决策函数生成领奖 body(单一真源,可单测)。

    三条分支(逐字节对齐 709.b4632b25.js 的 C(e,n)):
      - 每日工作任务:task_id + campaign_group_code + campaign_item_code;
      - 里程碑:campaign_group_code + campaign_item_code(code),无 task_id;
      - 已完成普通任务:仅 task_id(服务端实例 id);
      - 直接领取任务(reward_mode=2):campaign_group_code + campaign_item_code。
    """
    code = str(task.get("code") or "").strip()
    task_id = str(task.get("task_id") or "").strip()
    if code == TASK_CODE_DAILY_WORK and task_id:
        return {
            "task_id": task_id,
            "campaign_group_code": campaign_group,
            "campaign_item_code": code,
        }
    if task.get("kind") == TASK_KIND_MILESTONE:
        return {"campaign_group_code": campaign_group, "campaign_item_code": code}
    if task.get("reward_mode") == 2:
        return {"campaign_group_code": campaign_group, "campaign_item_code": code}
    if task_id:
        return {"task_id": task_id}
    return {}


def claim_params_missing(task: dict[str, Any]) -> str | None:
    """领奖参数不完整时的人读原因(None=参数齐)。"""
    body = claim_body_for(task)
    if body:
        return None
    if task.get("kind") == TASK_KIND_MILESTONE:
        return "里程碑任务缺 campaign_code"
    return "已完成任务缺服务端 task_id(需客户端指纹读 detail)"


async def doubao_claim_reward(
    name: str,
    token: str,
    device_map: dict[str, Any],
    task: dict[str, Any],
    *,
    campaign_group: str = SCENE,
    timeout: float = DEFAULT_TIMEOUT,
    client: httpx.AsyncClient | None = None,
) -> dict[str, Any]:
    """领一个任务/里程碑奖励。返回结构化结果(ok/message/code/http_status)。"""
    result = _base_result(name, doubao_device_map_uid(device_map))
    result["action"] = "task_claim"
    err = _validate_token(token)
    if err:
        result["message"] = err
        return result
    body = claim_body_for(task, campaign_group)
    if not body:
        result["message"] = claim_params_missing(task) or "领奖参数不完整"
        return result
    s_status, s_body = await _db_request(
        PATH_REWARD_CLAIM,
        token,
        body,
        timeout=timeout,
        client=client,
        query=_client_query(device_map),
        use_client_fingerprint=True,
    )
    result["http_status"] = s_status if s_status > 0 else None
    if s_status in (0, -1):
        result["message"] = "网络异常"
        return result
    if not isinstance(s_body, dict):
        result["message"] = f"领奖响应非 JSON(HTTP {s_status})"
        result["classified_error"] = {"type": "Challenge", "cooldown_seconds": 3600}
        return result
    code = s_body.get("code") if isinstance(s_body.get("code"), int) else None
    result["code"] = code
    raw_data = s_body.get("data")
    data: dict[str, Any] = dict(raw_data) if isinstance(raw_data, dict) else {}
    raw_biz = data.get("biz_error")
    biz: dict[str, Any] = dict(raw_biz) if isinstance(raw_biz, dict) else {}
    if code in _CLAIM_OK_CODES and not biz:
        result.update(ok=True, status="ok", message="领取成功")
        return result
    msg = ""
    if biz:
        msg = str(biz.get("message") or "").strip() or "领取被拒"
    if not msg:
        msg = f"领奖失败: code={code} {s_body.get('msg') or ''}".strip()
    result["message"] = msg
    cls = _classify_code(code, s_status)
    if cls:
        result["classified_error"] = cls
    elif biz:
        # 业务拒绝(如「当前暂不符合领取条件」):会话健康,冷却 6h 后重试,
        # 不熔断;同一任务反复被拒由调度侧每日一次的自然节拍兜底。
        result["classified_error"] = {"type": "BusinessError", "cooldown_seconds": 21600}
    return result


async def doubao_report_event(
    token: str,
    device_map: dict[str, Any],
    *,
    campaign_item_code: str,
    params: dict[str, Any] | None = None,
    scene: str = "client_action",
    code: str | None = None,
    message_id: str | None = None,
    timeout: float = DEFAULT_TIMEOUT,
    client: httpx.AsyncClient | None = None,
) -> dict[str, Any]:
    """任务完成上报(线上 bundle 逐字契约)。

    POST /alice/ug/event/report {code?, scene, campaign_item_code, message_id?, params?}
      - 行为类(select_work_fields): scene=client_action + params
      - 生成类(GenWord/GenExcel/GenPPT/ScheduleSkill): scene=campaign_type +
        message_id=SSE_ACK 里的 question_id(用户提问消息 id);2026-11-17 实证可计完成
    → data.task_status / data.task_id(实例 id,后续领奖用)。
    """
    body: dict[str, Any] = {
        "scene": scene,
        "campaign_item_code": campaign_item_code,
    }
    if params is not None:
        body["params"] = params
    if message_id:
        body["message_id"] = message_id
    if code:
        body["code"] = code
    s_status, s_body = await _db_request(
        PATH_EVENT_REPORT,
        token,
        body,
        timeout=timeout,
        client=client,
        query=_client_query(device_map),
        use_client_fingerprint=True,
    )
    if s_status in (0, -1):
        return {"ok": False, "message": "网络异常", "task_status": None, "task_id": None}
    if not isinstance(s_body, dict):
        return {"ok": False, "message": f"上报响应非 JSON(HTTP {s_status})", "task_status": None, "task_id": None}
    code_val = s_body.get("code") if isinstance(s_body.get("code"), int) else None
    raw_data = s_body.get("data")
    data: dict[str, Any] = dict(raw_data) if isinstance(raw_data, dict) else {}
    ok = code_val in _CLAIM_OK_CODES
    return {
        "ok": ok,
        "message": "" if ok else f"上报失败: code={code_val} {s_body.get('msg') or ''}".strip(),
        "task_status": normalize_task_status(data.get("task_status")) if "task_status" in data else None,
        "task_id": str(data["task_id"]).strip()
        if isinstance(data.get("task_id"), (str, int)) and str(data.get("task_id")).strip()
        else None,
    }


def _task_reward_text(task: dict[str, Any]) -> str:
    reward = task.get("reward")
    return f"+{reward}" if isinstance(reward, int) else ""


def _extract_generation_ids(text: str) -> tuple[str | None, str | None]:
    """从 /chat/completion 的 SSE 文本里取 (用户提问消息 id, 会话 id)。

    SSE_ACK 的 query_list[0].question_id 就是客户端 EventReport 用的 message_id
    (2026-11-17 实证:拿它上报生成类任务可计完成)。
    """
    m_msg = re.search(r'"question_id"\s*:\s*"(\d{6,})"', text)
    m_conv = re.search(
        r'"ack_client_meta"\s*:\s*\{[^{}]*?"conversation_id"\s*:\s*"(\d{6,})"', text
    )
    return (
        m_msg.group(1) if m_msg else None,
        m_conv.group(1) if m_conv else None,
    )


async def _run_generation_prompt(
    token: str,
    device_map: dict[str, Any],
    prompt: str,
    *,
    timeout: float = DEFAULT_TIMEOUT,
    client: httpx.AsyncClient | None = None,
) -> dict[str, Any]:
    """把任务推荐 prompt 真跑一轮豆包对话(客户端指纹,与线上 schema 启动同形)。

    返回 {ok,message,message_id,conversation_id}。SSE_ACK 里的 question_id 即
    **用户提问消息 id**;2026-11-17 实证:拿它调 /alice/ug/event/report
    (scene=campaign_type, campaign_item_code=任务 code) 即可把生成类任务计完成,
    再用 task_id 领奖。旧结论「服务端 chat 不计完成」是因为漏了这一步上报。
    """
    query = _client_query(device_map)
    query["web_platform"] = "browser"
    now = int(time.time() * 1000)
    body = {
        "client_meta": {
            "local_conversation_id": str(uuid.uuid4()),
            "conversation_id": "",
            "bot_id": _CHAT_BOT_ID,
            "last_section_id": "",
            "last_message_index": None,
            "local_permissions": [],
        },
        "messages": [
            {
                "local_message_id": str(uuid.uuid4()),
                "content_block": [
                    {
                        "block_type": 10000,
                        "block_id": str(uuid.uuid4()),
                        "content": {
                            "text_block": {
                                "text": prompt,
                                "icon_url": "",
                                "icon_url_dark": "",
                                "summary": "",
                            },
                            "pc_event_block": "",
                        },
                        "parent_id": "",
                        "meta_info": [],
                        "extra_info": {},
                        "append_fields": [],
                    }
                ],
                "message_status": 0,
            }
        ],
        "option": {
            "create_time_ms": now,
            "answer_with_suggest": False,
            "agent_mode": 2,
            "tts_switch": False,
            "need_deep_think": 0,
            "is_audio": False,
            "need_create_conversation": True,
            "conversation_init_option": {"need_ack_conversation": True},
            "conversation_init_ext": {"model_item_key": "0", "reasoning_effort": "5", "mode_id": "1"},
            "model_config": {"model_item_key": "0", "model_extra_params": {}, "reasoning_effort": 5},
            "aggregate_params": {
                "conversation_mode": "1",
                "mode_id": "1",
                "model_item_key": "0",
                "agent_mode": "2",
                "reasoning_effort": "5",
                "provider_id": "",
                "mention_skill_list": "[]",
                "mention_plugin_list": "[]",
                "mention_ext": "[{}]",
            },
            "conversation_mode": 1,
            "sse_recv_event_options": {"support_chunk_delta": True},
            "support_lazy_fetch_stream": True,
            "message_from": 0,
            "is_old_user": True,
            "scene_type": 0,
            "unique_key": str(uuid.uuid4()),
            "start_seq": 0,
        },
        "user_context": [],
        "ext": {
            "agent_mode": "2",
            "use_deep_think": "0",
            "is_finish": "1",
            "commerce_credit_config_enable": "0",
        },
    }
    http = client if client is not None else get_http_client()
    url = f"{DOUBAO_HOST}{_CHAT_PATH}?{httpx.QueryParams(query)}"
    await checkin_outbound_gate.before_request("doubao")
    try:
        resp = await http.post(
            url,
            headers={
                "accept": "*/*",
                "content-type": "application/json",
                "cookie": normalize_cookie_header(token),
                "agw-js-conv": "str, str",
                "user-agent": CLIENT_UA,
                "referer": f"{DOUBAO_HOST}/chat/",
            },
            json=body,
            timeout=timeout,
        )
    except Exception as e:  # 网络异常不抛穿巡检轮
        return {"ok": False, "message": f"生成请求异常: {e}"}
    checkin_outbound_gate.note_status(resp.status_code, "doubao")
    text = resp.text or ""
    msg_id, conv_id = _extract_generation_ids(text)
    if resp.status_code >= 500:
        return {
            "ok": False,
            "message": f"生成请求 HTTP {resp.status_code}",
            "message_id": None,
            "conversation_id": None,
        }
    if "SSE_ACK" in text or "STREAM_CHUNK" in text or "CHUNK_DELTA" in text:
        return {
            "ok": True,
            "message": "生成任务已提交豆包",
            "message_id": msg_id,
            "conversation_id": conv_id,
        }
    if resp.status_code == 200 and "SSE_REPLY_END" in text:
        return {
            "ok": True,
            "message": "生成任务已完成",
            "message_id": msg_id,
            "conversation_id": conv_id,
        }
    return {
        "ok": False,
        "message": f"生成请求未被受理(HTTP {resp.status_code})",
        "message_id": None,
        "conversation_id": None,
    }


def _extract_prompt(task: dict[str, Any]) -> str | None:
    """recommend_prompts[0] (JSON 字符串) → 真实 prompt。"""
    raw = (task.get("recommend_prompts") or [None])[0]
    if not isinstance(raw, str):
        return None
    try:
        parsed = json.loads(raw)
    except Exception:
        return raw.strip() or None
    if isinstance(parsed, dict):
        text = str(parsed.get("prompt") or "").strip()
        if text:
            return text
    return raw.strip() or None


def pick_generation_prompt(task: dict[str, Any]) -> str | None:
    """生成类任务选一条可直接执行的 prompt:优先不依赖用户上传素材的那条。"""
    raws = [r for r in (task.get("recommend_prompts") or []) if isinstance(r, str) and r.strip()]
    parsed: list[str] = []
    for raw in raws:
        text = None
        try:
            obj = json.loads(raw)
        except Exception:
            obj = None
        if isinstance(obj, dict):
            text = str(obj.get("prompt") or "").strip() or None
        if text:
            parsed.append(text)
        elif raw.strip():
            parsed.append(raw.strip())
    for text in parsed:
        if text and not any(marker in text for marker in _UPLOAD_DEP_MARKERS):
            return text
    return parsed[0] if parsed else None


def skill_for_task(task: dict[str, Any]) -> str | None:
    """任务 campaign_type → 客户端默认技能名(无映射 ⇒ None,不硬凑)。"""
    ctype = str(task.get("campaign_type") or "").strip()
    return TASK_SKILL_MAP.get(ctype) or None


async def doubao_list_tasks(
    token: str,
    device_map: dict[str, Any],
    *,
    timeout: float = DEFAULT_TIMEOUT,
    client: httpx.AsyncClient | None = None,
) -> dict[str, Any]:
    """任务清单(只读):返回 {"ok","kind":"list","tasks","milestones","credits","reason","unjudged"}。

    读不懂上游 shape ⇒ unjudged=true(§0.3 不猜零不冒绿)。
    """
    err = _validate_token(token)
    if err:
        return {
            "ok": False,
            "kind": "list",
            "tasks": [],
            "milestones": [],
            "credits": None,
            "reason": err,
            "unjudged": False,
        }
    s_status, parsed = await _fetch_campaign_merged(token, device_map, timeout=timeout, client=client)
    if s_status in (0, -1):
        return {
            "ok": False,
            "kind": "list",
            "tasks": [],
            "milestones": [],
            "credits": None,
            "reason": "网络异常",
            "unjudged": False,
        }
    if parsed["code"] != 0:
        cls = _classify_code(parsed["code"], s_status)
        reason = f"detail 查任务失败: code={parsed['code']} {parsed['message']}".strip()
        if cls:
            reason += f" [{cls['type']}]"
        return {
            "ok": False,
            "kind": "list",
            "tasks": [],
            "milestones": [],
            "credits": None,
            "reason": reason,
            "unjudged": False,
        }
    unjudged = not parsed["tasks"] and not parsed["milestones"]
    return {
        "ok": True,
        "kind": "list",
        "tasks": parsed["tasks"],
        "milestones": parsed["milestones"],
        "credits": parsed["credits"],
        "checked_in": parsed["checked_in"],
        "campaign_group_code": SCENE,
        "reason": "上游未下发任务(活动未开放或账号类型不支持)" if unjudged else "",
        "unjudged": unjudged,
    }


async def doubao_task_sweep_account(
    name: str,
    token: str,
    device_map: dict[str, Any],
    *,
    apply: bool = True,
    work_fields: list[str] | None = None,
    auto_generate: bool = False,
    generation_timeout: float = 90.0,
    timeout: float = DEFAULT_TIMEOUT,
    client: httpx.AsyncClient | None = None,
) -> dict[str, Any]:
    """豆包单账号任务巡检:读清单 → 补行为任务 → 领已完成任务/里程碑 → 回读对账。

    apply=false ⇒ 只读预检(零写侧),steps 里逐条给「将会做什么」。
    幂等:已领(rewarded)任务跳过;重复执行等价一次只读扫描。

    能力边界(如实登记,不冒充):
      - select_work_fields:EventReport(client_action) 实证可完成;
      - points_milestone / 已完成普通任务 / 直接领取任务:claim 端点实证;
      - 任务实例开启:EventReport(scene=campaign_task_click + params.campaign_group_code)
        对 ScheduleSkill 实证返回 task_id、task_status=4;但同一账号对 GenWord 同参会被拒
        625002003(有次数/资格门槛),且开了实例也不会让完成上报生效 ⇒ 不纳入流程;
      - 生成类任务(GenWord/GenExcel/GenPPT):跑推荐 prompt,再拿 SSE_ACK 里的
        question_id(用户提问消息 id)调 EventReport(scene=campaign_type,
        campaign_item_code=任务 code, message_id=该 id)即可计完成,随后正常领奖
        (2026-11-17 实弹实证:task_status=2);
      - ScheduleSkill/WorkTaskMode:job_cron 协议已全打通(2026-11-17 二次实证):
        纯 HTTP 可建 cron——/alice/job_cron/create 必填 schedule.repeat_type=3(Daily,
        传 1/4/5 报 710010202「系统错误」=参数非法,非风控非签名;repeat_type=2 报
        623030001「数量达上限」=枚举合法),建议带 sandbox_auth_type=2 +
        deep_think_switch=4(与 job_cron/get 线上真实 job 一致);create 后 /run 触发
        code 0、last_run_status=1、产出真实 cron 会话(可 /conversation/latest_messagelist
        取到 chat_id)。但**用该 cron 会话 chat_id 上报 EventReport 仍恒拒 625002003,
        task_status 不翻转**(status=4 实例两账号反复验证)。
        完成 root:客户端走 WorkTask 模式,由本地安装的 schedule 技能
        (doubao-cron-scheduler,external_skill_id=348923904514)建 cron 才被 campaign
        计完成。三次实证确认纯 HTTP 无法激活该技能:① WorkTask chat 的云端 general-agent
        亲口回「没有定时任务调用工具」不建 cron;② /alice/office/skills/add 返回 code 0
        但幂等空响应,list_my 仍空、agent 仍报无此技能 ⇒ 技能经
        neotix.taskModeRuntime.installSkill 落本地技能运行时,云端 add 不注入工具集;
        ③ 上报换 scene=chat + message-sent/skill-added kind + skill_id 仍 625002003;
        ④ 技能激活已穷尽(2026-11-17 三轮,从号池解 Fernet 取真实 sessionid 实弹):
        get_detail/detail、install_type=0/2/3/4、set_enabled/enable/update_status 全部
        code 0 空响应且 list_my 恒空;控制实验定谳——传假 skill_id(999999999999)与真
        技能 ID 走 add 回报完全一致(同 code 0 空响应),证明该端点不校验 ID、不持久化、
        是 no-op,code 0 是空洞成功而非真安装。
        ⑤ 第四轮定谳(2026-11-17 14:xx,推翻"625002003=技能没激活"的旧归因):
        决定性实验证明 625002003 msg 逐字为「暂无活动资格」,与 message_id 形态无关——
        普通 chat question_id / WorkTask(mode_id=4) question_id / conversation_id /
        带 task_id(params 与顶层)/ 带 code=0 / status=1 与 status=4 号 / 三个不同账号
        一律 625002003。反证:同一 HTTP 链路、同为外部 question_id 上报,生成类任务
        (GenWord 等)恒 task_status=2 成功 ⇒ 上报通道本身通,625002003 不是"通道/签名
        整体不通",而是**这个 campaign_item 的完成判定绑定客户端技能运行时在完成时
        发出的本地签名事件**:号池账号 skills/list_my 恒 data=null(无已安装技能),
        服务端据此判无资格。纯外部 HTTP 无论怎么构造请求参数都无法伪造该事件 ⇒
        号池号(仅 sessionid、技能运行时在真人客户端侧)不可能靠外部注入完成此项。
        ⇒ 不代跑,避免无效额度与风控。此项只能当前端真人客户端用本地定时任务技能
        真实创建一次时由客户端自己上报完成。
        ⑥ 客户端 bundle 逆向定谳(2026-11-17 15:xx,第五轮,从源码层坐实 625002003):
        反编译 E:/Software/Doubao/app/local_webcontents/extensions/ai-views/static/js/
        async/{73978,15504,10434,10102}.js + task-mode-resource/runtime-bundle/
        manifest.json 得到确定性事实:
        - 上报端点 EventReport 包装 TM({scene,campaignItemCode,messageId,params}) 参数形状
          与我方一致(非参数名错误);
        - campaignType 枚举 fF(模块968435)仅 6 个:skill_store_add_use/skill_store_add/
          skill_use/work_buddy_add_chat/enable_notification/set_default_open,**不含
          ScheduleSkill**。完成判定函数 P()(模块801315)只对这 6 个事件型任务生成 report
          (skill-added→scene=chat+skill_id;message-sent→scene=chat+message_id;
          notification-enabled/default-image-viewer-confirmed→scene=client_action),
          ScheduleSkill 落 P() 返回 undefined ⇒ 客户端自己也不靠 event/report 完成它;
        - ScheduleSkill 在 415151 模块仅映射为「WorkTask(mode=4)选中 generalAgentSkill
          =schedule 技能」的引导动作(N 函数),真正 skill_id=348923904514 来自
          runtime-bundle/manifest.json(doubao-cron-scheduler,skill_type=2);
        - 按上述契约精确复刻:发 mode=4 + mention_skill_list=[348923904514] +
          mention_ext/input_skill 的消息拿真实 question_id,再以 scene=chat/skill_use/
          ScheduleSkill × params.skill_id 四种组合上报 → **仍全部 625002003**,status 4 不变;
        - 直接对 status=4 任务调 claim(按 task_id 与 group+item 两种)均回 code=0 但
          detail status 恒 4、里程碑不变 ⇒ 空洞成功,与 skills/add 同类,非真领奖;
        - 活动入口 lS/Lw/FQ 等(模块290918)是 (0,o.L) 前端 telemetry 埋点,非服务端资格
          打点,打开活动面板不建立资格。
        结论:625002003 是服务端在 report 入口的无参数资格拒绝(连 body 都不解析),
        ScheduleSkill 的完成判定在服务端绑定客户端技能运行时签名事件,号池号无本地
        技能运行时 ⇒ 外部 HTTP 穷尽所有参数形态/bundle 契约/claim 旁路均不可完成。
        判据:勿再把 625002003 当 message_id/scene/技能ID 参数问题重试。
        ⑦ 真人客户端 GUI 实弹定谳(2026-11-17 16:xx,图形会话首次恢复可用,第六轮):
        在客户端真实登录号(19944895160)用 GUI 走 WorkTask『工作任务·本地电脑』
        模式,输入活动引导 prompt("帮我创建一个定时任务…先立刻执行一次")发送,
        实测:AI 会话标题变『创建定时任务』、输出"正在读取 doubao cron scheduler
        技能中的 SKILL.md"⇒ 本地 schedule 技能运行时被真实激活(号池号无此运行时);
        但随后 AI 回"当前套餐只允许创建 1 个定时任务,已有『科技新闻早报』占用名额,
        新任务建不了"⇒ **套餐级 cron 数量上限=1** 是额外结构性障碍;即便如此 AI 仍
        "按这一次的建议执行"了天气查询,detail 回读第五项 task_status 恒 4 不翻转。
        实弹结论:①号池号即便能登录客户端,也因无本地技能运行时无法触发完成;②真人
        号有运行时,但套餐仅 1 个 cron 名额且被占用,无法按活动引导新建→同样不完成;
        ③"执行一次"式执行也不计入完成。第五项在此客户端版本为产品级不可达,非接口
        参数/签名/额度问题。勿再投入 GUI 或 HTTP 重试。

号池签到探底(2026-11-17 第三轮,5 启用号全量实弹,本函数 + 调度冷却链已核实):
        - 号池 doubao 启用号实为 5 个(27 是全平台总数,非 doubao);
        - 15754320340 code=0「今日已签到」⇒ 号池 cookie 普遍有效,非整体过期;
        - 18643389808/19944895160/19390097993 三号 710010702:detail 可通(会话健康)
          但 claim 被拦 ⇒ 批量连打触发账号级频控/风控期,非 token 失效。此路径引擎
          已内建正确处置:_classify_code 把 710010702 归 BusinessError + cooldown
          3600s,调度层 record_result 消费 classified_error 落 cooldown_until 定时重试
          (不熔断)⇒ 无需新增退避,现有冷却即最优;
        - 「李总」code=2 campaign not found:detail 即回 2,该号不在
          pc_incentive_task_mvp_v3 签到活动分组内(账号侧资格差异,非可修 bug;
          device_map 全部为空已排除设备指纹差异);
        - 多 profile 并行规模化假设证伪:`Doubao.exe --profile-directory` 单实例锁定,
          参数不生效仍复用原窗口(仅 1 个 MainWindow),号池无法靠多实例并行,只能
          进程内串行 + 节流闸门错峰。
    """
    result = _base_task_result(name, doubao_device_map_uid(device_map))
    err = _validate_token(token)
    if err:
        result["message"] = err
        return result

    s_status, before = await _fetch_campaign_merged(token, device_map, timeout=timeout, client=client)
    result["http_status"] = s_status if s_status > 0 else None
    result["code"] = before["code"]
    if s_status in (0, -1):
        result["message"] = "网络异常"
        return result
    if before["code"] != 0:
        result["message"] = f"detail 查任务失败: code={before['code']} {before['message']}".strip()
        cls = _classify_code(before["code"], s_status)
        if cls:
            result["classified_error"] = cls
        return result
    result["credits"] = before["credits"]

    tasks = before["tasks"]
    steps: list[dict[str, Any]] = result["steps"]

    # 1) 行为类任务:工作领域选择(完成上报)
    if apply:
        wf = tasks and next((t for t in tasks if t["code"] == TASK_CODE_WORK_FIELDS), None)
        if wf and wf["status"] in (TASK_STATUS_UNKNOWN, TASK_STATUS_CREATED, TASK_STATUS_IN_PROGRESS):
            ids = [x for x in (work_fields or ["office"]) if isinstance(x, str) and x.strip()]
            rep = await doubao_report_event(
                token,
                device_map,
                campaign_item_code=wf["code"],
                params={"work_field_ids": json.dumps(ids, ensure_ascii=False)},
                timeout=timeout,
                client=client,
            )
            steps.append(
                {
                    "task": wf["code"],
                    "action": "report_work_fields",
                    "ok": rep["ok"],
                    "message": rep["message"] or f"已上报工作领域 {','.join(ids)}",
                    "task_status": rep.get("task_status"),
                }
            )
            if rep.get("task_id"):
                wf["task_id"] = rep["task_id"]
            if rep.get("task_status") is not None:
                wf["status"] = rep["task_status"]
                wf["status_text"] = TASK_STATUS_TEXT.get(rep["task_status"], "unknown")
        else:
            steps.append(
                {
                    "task": TASK_CODE_WORK_FIELDS,
                    "action": "report_work_fields",
                    "ok": True,
                    "message": "无需上报(已完成/已领取)",
                }
            )
    else:
        steps.append({"task": TASK_CODE_WORK_FIELDS, "action": "report_work_fields", "ok": True, "message": "dry-run 跳过"})

    # 2) 生成类任务(auto_generate):按推荐 prompt 真跑一轮对话
    generative = [
        t
        for t in tasks
        if t["kind"] not in (TASK_KIND_DAILY_SIGNIN, TASK_KIND_MILESTONE)
        and t["code"] not in (TASK_CODE_WORK_FIELDS, TASK_CODE_DAILY_WORK)
        and t["status"] in (TASK_STATUS_CREATED, TASK_STATUS_IN_PROGRESS)
        and t["recommend_prompts"]
    ]
    for t in generative:
        if not apply or not auto_generate:
            result["skipped"].append(
                {
                    "task": t["code"],
                    "reason": "自动代跑未开启(DOUBAO_TASKS_AUTO_GENERATE=false),仅保留已完成态领奖",
                }
            )
            continue
        # ScheduleSkill/WorkTaskMode 走客户端 WorkTask 模式(插件 generalAgentSkillName),
        # 已实测可合规发出 mode_id=4 + mention_skill_list=["schedule"] 的对话,云端
        # general-agent 会真跑(联网搜索可见),但 schedule 技能需桌面端本地安装才激活,
        # 不产出 job_cron ⇒ EventReport 恒拒 625002003;故不代跑,避免无效生成与风控。
        if str(t.get("campaign_type") or "") in ("ScheduleSkill", "WorkTaskMode"):
            result["skipped"].append(
                {
                    "task": t["code"],
                    "reason": "需客户端 WorkTask 模式创建日程/工作任务,服务端普通对话无法计完成",
                }
            )
            continue
        prompt = pick_generation_prompt(t)
        if not prompt:
            result["skipped"].append({"task": t["code"], "reason": "推荐 prompt 解析失败"})
            continue
        skill = skill_for_task(t)
        if skill:
            prompt = f"请使用「{skill}」技能完成以下需求:\n{prompt}"
        run = await _run_generation_prompt(
            token, device_map, prompt, timeout=generation_timeout, client=client
        )
        steps.append(
            {"task": t["code"], "action": "run_prompt", "ok": run["ok"], "message": run["message"]}
        )
        if not run["ok"]:
            continue
        # 关键一步(2026-11-17 实证):拿 SSE_ACK 的用户提问消息 id 上报完成,
        # 否则服务端 detail 永远停在 created(客户端正常做完也会走这步上报)。
        ctype = str(t.get("campaign_type") or "").strip()
        if run.get("message_id") and ctype:
            rep = await doubao_report_event(
                token,
                device_map,
                campaign_item_code=t["code"],
                scene=ctype,
                message_id=str(run["message_id"]),
                timeout=timeout,
                client=client,
            )
            steps.append(
                {
                    "task": t["code"],
                    "action": "report_generation",
                    "ok": rep["ok"],
                    "message": rep["message"] or "生成任务已计完成",
                    "task_status": rep.get("task_status"),
                }
            )
            if rep["ok"] and rep.get("task_status") == TASK_STATUS_COMPLETED:
                t["status"] = TASK_STATUS_COMPLETED
                if rep.get("task_id"):
                    t["task_id"] = rep["task_id"]
                continue
        # 上报失败才退回等待 detail 回读(仍不计完成则不领,避免伪报)
        deadline = time.monotonic() + min(float(generation_timeout), 120.0)
        while time.monotonic() < deadline:
            await asyncio.sleep(10.0)
            _, snap = await _fetch_campaign(
                token, device_map, timeout=timeout, client=client
            )
            cur = next(
                (x for x in (snap.get("tasks") or []) if x["code"] == t["code"]), None
            )
            if cur is not None and cur["status"] == TASK_STATUS_COMPLETED:
                steps.append(
                    {
                        "task": t["code"],
                        "action": "await_complete",
                        "ok": True,
                        "message": "服务端已计完成",
                    }
                )
                break

    # 3) 回读一次:领取所有已完成(2)任务与已达成里程碑
    daily_work = next(
        (
            t
            for t in tasks
            if t["code"] == TASK_CODE_DAILY_WORK
            and t["status"] in (TASK_STATUS_CREATED, TASK_STATUS_IN_PROGRESS)
        ),
        None,
    )
    if daily_work is not None:
        result["skipped"].append(
            {
                "task": TASK_CODE_DAILY_WORK,
                "reason": "每日工作任务需先在客户端完成一次工作任务,完成态自动领奖",
            }
        )
    mid: dict[str, Any] | None = None
    if apply:
        _, mid = await _fetch_campaign_merged(token, device_map, timeout=timeout, client=client)
        if mid["code"] == 0:
            tasks = mid["tasks"]
    claim_targets = [
        t
        for t in tasks
        if t["status"] == TASK_STATUS_COMPLETED and t["code"] != TASK_KIND_DAILY_SIGNIN
    ]
    milestone_targets = [
        m
        for m in ((mid or before)["milestones"])
        if m["status"] == TASK_STATUS_COMPLETED
    ]
    for t in claim_targets + milestone_targets:
        if not apply:
            result["skipped"].append({"task": t["code"], "reason": "dry-run 未领"})
            continue
        claimed = await doubao_claim_reward(name, token, device_map, t, timeout=timeout, client=client)
        steps.append(
            {
                "task": t["code"],
                "action": "claim",
                "ok": claimed["ok"],
                "message": claimed["message"],
                "reward": t.get("reward"),
            }
        )
        if claimed["ok"]:
            result["claimed"].append(
                {"task": t["code"], "reward": t.get("reward"), "kind": t["kind"]}
            )
        else:
            result["skipped"].append({"task": t["code"], "reason": claimed["message"]})
            if claimed.get("classified_error") and not result["classified_error"]:
                result["classified_error"] = claimed["classified_error"]
        await asyncio.sleep(2.0)

    # 4) 回读对账:刷新额度与任务态
    _, after = await _fetch_campaign_merged(token, device_map, timeout=timeout, client=client)
    if after["code"] == 0:
        result["credits"] = after["credits"]
        if isinstance(before["credits"], int) and isinstance(after["credits"], int):
            result["credits_delta"] = after["credits"] - before["credits"]
        result["tasks"] = after["tasks"]
        result["milestones"] = after["milestones"]
    result["claimed_count"] = len(result["claimed"])
    result["ok"] = True
    if result["claimed_count"] > 0:
        result["status"] = "ok"
        result["message"] = f"领取 {result['claimed_count']} 项任务奖励"
    elif result["skipped"]:
        result["status"] = "already"
        result["message"] = f"无可领任务({len(result['skipped'])} 项跳过)"
    else:
        result["status"] = "noop"
        result["message"] = "无待做/待领任务"
    return result

