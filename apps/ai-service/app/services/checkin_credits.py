# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""签到积分余额查询服务(WP-B 后端半,2026-10-09 立)。

查询 Trae `ide_user_ent_usage` 端点(参考项目 Trae-workbuddyAssistant 实证),
解析每个权益包的额度/已用/过期时间,汇总出账号当前剩余积分:

    remaining = Σ(credits_limit − credits_amount)   # 仅未过期包

消费方:
- POST /api/checkin/accounts/{id}/query_credits(手动查询并落当日快照)
- checkin_scheduler 每日 08:10 快照 job
- GET /api/checkin/credits/daily 的 total 序列数据源(经 checkin_credits_daily 表)

防御性解析:响应结构存在未知细节,.get 链 + isinstance 容错 + 空列表兜底;
任何失败都返回 {"remaining": None, "packs": [], "error": "..."},
绝不向调用方抛栈。
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any, Final

from app.core.logging import get_logger
from app.services.checkin_engine import get_http_client

logger = get_logger(__name__)

ENT_USAGE_URL: Final = "https://api.trae.cn/trae/api/v2/pay/ide_user_ent_usage"
_REQUEST_BODY: Final = {"require_usage": True, "req_source": 2}


def _error_result(message: str) -> dict[str, Any]:
    return {"remaining": None, "packs": [], "error": message}


def _to_int(value: Any) -> int | None:
    """宽容的整型解析(bool 显式排除,浮点须整值,数字串可解析)。"""
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, str):
        s = value.strip()
        if s.lstrip("-").isdigit():
            try:
                return int(s)
            except ValueError:
                return None
    return None


def _is_expired(expire_time: Any, now: datetime) -> bool:
    """expire_time → 是否已过期;支持 epoch 秒/毫秒(数值或数字串)与 ISO8601 串。

    解析不了(类型未知/格式异常)一律视为未过期 —— 宁可多算也不误删权益包。
    """
    if expire_time is None:
        return False
    try:
        if isinstance(expire_time, bool):
            return False
        if isinstance(expire_time, (int, float)):
            ts = float(expire_time)
        elif isinstance(expire_time, str):
            s = expire_time.strip()
            if not s:
                return False
            if s.lstrip("-").isdigit():
                ts = float(s)
            else:
                dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=UTC)
                return dt <= now
        else:
            return False
        if abs(ts) >= 1e12:  # 毫秒时间戳
            ts /= 1000.0
        return datetime.fromtimestamp(ts, tz=UTC) <= now
    except Exception:
        return False


def _expire_time_to_str(expire_time: Any) -> str | None:
    """expire_time 原样转 str(数值时间戳串化),未知类型给 None。"""
    if isinstance(expire_time, str):
        return expire_time or None
    if isinstance(expire_time, bool):
        return None
    if isinstance(expire_time, (int, float)):
        return str(expire_time)
    return None


async def query_remaining_credits(jwt: str) -> dict[str, Any]:
    """查询账号当前积分余额(Trae ide_user_ent_usage)。

    返回:
        成功: {"remaining": int, "packs": [{"limit", "used", "expire_time",
               "charge_amount"}...], "error": None}
        失败: {"remaining": None, "packs": [], "error": "明确错误描述"}
    """
    token = (jwt or "").strip()
    if not token:
        return _error_result("jwt 为空")
    headers = {
        "accept": "*/*",
        "authorization": (
            token if token.startswith("Cloud-IDE-JWT ") else f"Cloud-IDE-JWT {token}"
        ),
        "content-type": "application/json",
    }
    try:
        client = get_http_client()
        resp = await client.post(ENT_USAGE_URL, json=_REQUEST_BODY, headers=headers)
    except Exception as e:
        return _error_result(f"积分余额接口请求失败: {type(e).__name__}: {e}")
    if resp.status_code != 200:
        return _error_result(f"积分余额接口 HTTP {resp.status_code}: {resp.text[:200]}")
    try:
        data = json.loads(resp.text)
    except Exception:
        return _error_result("积分余额接口返回非 JSON 响应")
    if not isinstance(data, dict):
        return _error_result("积分余额接口响应结构异常(顶层非对象)")

    raw_packs = data.get("user_entitlement_pack_list")
    if not isinstance(raw_packs, list):
        raw_packs = []

    now = datetime.now(UTC)
    remaining = 0
    packs: list[dict[str, Any]] = []
    for raw in raw_packs:
        if not isinstance(raw, dict):
            continue
        base = raw.get("entitlement_base_info")
        if not isinstance(base, dict):
            base = {}
        quota = base.get("quota")
        if not isinstance(quota, dict):
            quota = {}
        usage = raw.get("usage")
        if not isinstance(usage, dict):
            usage = {}
        limit = _to_int(quota.get("credits_limit"))
        if limit is None:
            continue  # 额度解析不出的包不参与汇总
        used = _to_int(usage.get("credits_amount"))
        if used is None:
            used = 0
        expire_raw = base.get("expire_time")
        if _is_expired(expire_raw, now):
            continue  # 仅未过期包计入剩余
        charge_amount = _to_int(base.get("charge_amount"))
        packs.append(
            {
                "limit": limit,
                "used": used,
                "expire_time": _expire_time_to_str(expire_raw),
                "charge_amount": charge_amount if charge_amount is not None else 0,
            }
        )
        remaining += limit - used
    return {"remaining": remaining, "packs": packs, "error": None}
# ⁠[IHUI-AI-PROVENANCE-TAIL]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
