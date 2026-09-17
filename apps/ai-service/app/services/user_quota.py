# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (智汇AI) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""新用户免费试用额度(P3 3-4-A,2026-09-17 拍板落地:1 万 token/天)。

设计:
- 计量维度 = per-user 每日 token(自然日,Redis 计数 + 48h TTL 兜底清理)。
- 配置 = env 驱动(部署 NSSM AppEnvironmentExtra 可调,默认 0 = 关闭,不影响存量用户):
    USER_TRIAL_DAILY_TOKENS  每日 token 上限(0 = 功能关闭)
- 存储 = Redis(复用 llm_budget_governor 同款连接模式:REDIS_URL + protocol=2,
  失败降级内存 dict);**降级时放行**(免费额度是增强体验,不因 Redis 故障阻断主链路)。
- 执行点 = llm.py complete_stream / llm_complete 入口 check(超限 429)+
  done 事件 usage 到达时 consume(fire-and-forget)。
"""

from __future__ import annotations

import logging
import os
import time
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)


def _today_key() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%d")


class UserTrialQuota:
    """per-user 每日试用额度(Redis 优先,内存降级)。"""

    def __init__(self) -> None:
        self._redis: Any = None
        self._redis_inited = False
        self._mem: dict[str, int] = {}
        self._mem_date = _today_key()

    @property
    def daily_limit(self) -> int:
        """每日 token 上限;0 = 关闭。运行时可改 env 后重启生效。"""
        try:
            return max(0, int(os.environ.get("USER_TRIAL_DAILY_TOKENS", "0") or 0))
        except ValueError:
            return 0

    async def _ensure_redis(self) -> Any:
        if self._redis_inited:
            return self._redis
        self._redis_inited = True
        url = os.environ.get("REDIS_URL")
        if not url:
            return None
        try:
            import redis.asyncio as aioredis

            self._redis = aioredis.from_url(
                url, decode_responses=True, protocol=2, socket_connect_timeout=2
            )
        except Exception as e:  # noqa: BLE001
            logger.debug("user_quota Redis 初始化失败,降级内存: %s", e)
            self._redis = None
        return self._redis

    def _mem_get(self, key: str) -> int:
        # 内存降级的日期清理
        today = _today_key()
        if self._mem_date != today:
            self._mem.clear()
            self._mem_date = today
        return self._mem.get(key, 0)

    async def check(self, user_id: str) -> dict[str, Any]:
        """查询剩余额度。返回 {allowed, used, limit, remaining}。"""
        limit = self.daily_limit
        if not user_id or limit <= 0:
            return {"allowed": True, "used": 0, "limit": limit, "remaining": None}
        key = f"user:trial:{_today_key()}:{user_id}"
        used = 0
        try:
            redis = await self._ensure_redis()
            if redis is not None:
                used = int(await redis.get(key) or 0)
            else:
                used = self._mem_get(key)
        except Exception as e:  # noqa: BLE001 — 查询失败放行(增强体验不阻断主链路)
            logger.warning("user_quota check 失败,放行: %s", e)
            return {"allowed": True, "used": 0, "limit": limit, "remaining": None}
        return {
            "allowed": used < limit,
            "used": used,
            "limit": limit,
            "remaining": max(0, limit - used),
        }

    async def consume(self, user_id: str, total_tokens: int) -> None:
        """累加用量(fire-and-forget 调用;Redis 故障静默)。"""
        if not user_id or total_tokens <= 0:
            return
        key = f"user:trial:{_today_key()}:{user_id}"
        try:
            redis = await self._ensure_redis()
            if redis is not None:
                await redis.incrby(key, int(total_tokens))
                # TTL 48h:自然日切换后旧 key 自动清理
                await redis.expire(key, 172_800)
            else:
                self._mem[key] = self._mem_get(key) + int(total_tokens)
        except Exception as e:  # noqa: BLE001
            logger.debug("user_quota consume 失败(静默): %s", e)


user_trial_quota = UserTrialQuota()
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
