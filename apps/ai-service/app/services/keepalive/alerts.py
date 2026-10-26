# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""账号保活中心 —— 告警出口(统一通知通道)。

为什么不能只发 webhook
----------------------
上一版只有 ``KEEPALIVE_ALERT_WEBHOOK``(可选、默认关)。默认关意味着:绝大多数
部署里**告警根本没有出口** —— 中心算出了"5 个账号已失效",然后只写进自己的流水表
和日志,而用户界面上什么都不出现。这与"账号保活"这个功能的目的正好相反。

本模块把告警接进**全站通知中心**(``notifications`` 表,由 apps/api 的
``/api/notifications`` 读取、前端未读红点消费),使"账号要重扫了"能真的到达用户。

两条硬约束(都来自那张表的定义,不是可选的礼貌):
1. ``notifications.user_id`` 是 **uuid 且有外键到 users.id**。而账号属主里有
   ``probe-user`` / ``system:relay-pool`` 这类非 uuid 值 ⇒ 必须先校验,否则一条
   脏 owner 就能让整批 INSERT 失败(FK/类型错),而失败发生在保活循环里,表现是
   "告警时有时无"。
2. **一轮一属主只发一条**。19 个账号同时过期就发 19 条通知,用户会把通知关掉,
   之后就再也看不见真的告警 —— 这是告警设计里最常见的自毁方式。故按属主聚合。
"""

from __future__ import annotations

import json
import uuid
from collections import defaultdict
from collections.abc import Iterable
from datetime import UTC, datetime
from typing import Any

from app.core.logging import get_logger

logger = get_logger(__name__)

# 通知类型:必须落在 notif 表既有白名单(system/order/project/comment/mention)内,
# 否则前端按类型过滤时会被静默丢掉。
_NOTIFICATION_TYPE = "system"

# 单条通知里最多列多少个账号(超出只报数量,避免 content 过长被截断丢失信息)
_MAX_LINES = 8


def is_uuid(value: str | None) -> bool:
    if not value:
        return False
    try:
        uuid.UUID(str(value))
    except (ValueError, AttributeError, TypeError):
        return False
    return True


def group_by_owner(alerts: Iterable[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    """按属主聚合。非 uuid 属主在这里就被挡掉(不是等到 INSERT 才炸)。"""
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    dropped = 0
    for item in alerts:
        owner = str(item.get("owner") or "")
        if not is_uuid(owner):
            dropped += 1
            continue
        grouped[owner].append(item)
    if dropped:
        logger.debug("[keepalive] %s 条告警属主非 uuid,不进通知中心", dropped)
    return dict(grouped)


def build_notification(items: list[dict[str, Any]]) -> tuple[str, str, dict[str, Any]]:
    """把一组告警拼成一条通知(title, content, data)。纯函数,可测。"""
    count = len(items)
    title = f"账号保活告警:{count} 个账号需要处理"
    lines: list[str] = []
    for item in items[:_MAX_LINES]:
        label = item.get("display") or item.get("platform") or item.get("ref") or "?"
        platform = item.get("platform") or ""
        kind = item.get("kind") or ""
        message = str(item.get("message") or "")[:120]
        prefix = f"{platform} · {label}" if platform and label != platform else label
        lines.append(f"[{kind}] {prefix}: {message}")
    if count > _MAX_LINES:
        lines.append(f"……另有 {count - _MAX_LINES} 个账号")
    content = "\n".join(lines)
    data = {
        "source": "keepalive",
        "refs": [str(i.get("ref")) for i in items],
        "count": count,
        "generated_at": datetime.now(UTC).isoformat(),
        "link": "/publish/accounts",
    }
    return title, content, data


async def publish_inapp_alerts(alerts: list[dict[str, Any]]) -> dict[str, int]:
    """把告警写进 notifications 表。返回统计。

    fail-open:任何异常只记 warning,绝不让"通知发不出去"反过来中断保活本身。
    """
    stats = {"owners": 0, "inserted": 0, "skipped_no_table": 0, "skipped_unknown_user": 0}
    grouped = group_by_owner(alerts)
    if not grouped:
        return stats

    from app.core.db_pool import get_shared_pool

    try:
        pool = await get_shared_pool()
        async with pool.acquire() as conn:
            # 表不存在(开发库常见)⇒ 明确跳过,而不是抛异常让上层以为保活失败
            if not await conn.fetchval("SELECT to_regclass('public.notifications') IS NOT NULL"):
                logger.warning(
                    "[keepalive] notifications 表不存在,告警仅落流水(注意:这不是已送达)"
                )
                stats["skipped_no_table"] = len(grouped)
                return stats

            owners = list(grouped)
            known = {
                str(r["id"])
                for r in await conn.fetch(
                    "SELECT id FROM users WHERE id = ANY($1::uuid[])", owners
                )
            }
            stats["owners"] = len(owners)

            for owner, items in grouped.items():
                if owner not in known:
                    # 属主在库里有账号但没有 users 行(开发库/同步残缺)⇒ 外键必拒,提前跳过
                    stats["skipped_unknown_user"] += 1
                    continue
                title, content, data = build_notification(items)
                await conn.execute(
                    "INSERT INTO notifications (user_id, type, title, content, data)"
                    " VALUES ($1::uuid, $2, $3, $4, $5::jsonb)",
                    owner,
                    _NOTIFICATION_TYPE,
                    title[:255],
                    content,
                    json.dumps(data, ensure_ascii=False),
                )
                stats["inserted"] += 1
    except Exception as e:  # noqa: BLE001 —— 通知面故障不得影响保活结论
        logger.warning("[keepalive] 站内信告警写入失败(不影响保活): %s", e)
        return stats

    if stats["inserted"]:
        logger.warning(
            "[keepalive] 已向 %s 个属主推送站内信告警(共 %s 个账号)",
            stats["inserted"],
            len(alerts),
        )
    return stats
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
