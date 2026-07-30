"""中转站 Key 池选择器(P0-5c,2026-07-30 立)。

查 ai_relay_key_pool 表,多 key 加权随机 + 健康过滤 + 故障标记/熔断。

与 llm_gateway._resolve_from_db(BYOK 用户私有配置)的区别:
- _resolve_from_db:查 ai_model_config WHERE owner_uuid=? (用户私有 BYOK)
- KeyPoolSelector:查 ai_relay_key_pool WHERE provider_code=? (中转站公共 key 池)

设计:
- select_key:priority ASC 分组,同 priority 内按 weight 加权随机,health_status='down' 过滤
- mark_key_failed:healthy/unknown → degraded,degraded → down(连续失败递进熔断)
- mark_key_healthy:任意状态 → healthy(成功调用后恢复)

解密复用 llm_gateway._decrypt_api_key(AES-256-GCM,与 apps/api/utils/crypto.ts 对应),
前缀映射复用 llm_gateway._model_to_provider_code(30+ provider 前缀,零逻辑漂移)。
"""

from __future__ import annotations

import logging
import random
from typing import Optional, TypedDict

from ..core.db_pool import get_shared_pool

logger = logging.getLogger(__name__)


class SelectedKey(TypedDict):
    """select_key 返回的选中 key 信息。"""

    api_key: str       # 解密后的明文 API Key
    key_pool_id: str   # ai_relay_key_pool.id(uuid str,供 mark_key_failed/healthy 用)
    key_name: str      # admin 识别用名(日志/监控可读)


class KeyPoolSelector:
    """中转站 Key 池选择器:查 ai_relay_key_pool 表,加权随机选 key。"""

    @staticmethod
    def model_to_provider_code(model: str) -> str:
        """model 前缀 → provider_code 映射。

        复用 llm_gateway._model_to_provider_code(30+ provider 前缀映射),
        避免逻辑漂移。未匹配默认 'openai'。
        """
        # 懒导入避免循环依赖(key_pool_selector ← llm_gateway ← key_pool_selector)
        from ..core.llm_gateway import _model_to_provider_code

        return _model_to_provider_code(model)

    @staticmethod
    async def select_key(provider_code: str) -> Optional[SelectedKey]:
        """从 ai_relay_key_pool 选一个可用 key。

        查询:WHERE provider_code = $1 AND is_enabled = true AND health_status != 'down'
        排序:priority ASC,然后同 priority 内按 weight 加权随机
        返回:SelectedKey 或 None(无可用 key / 查询失败 / 解密失败)
        """
        try:
            pool = await get_shared_pool()
            async with pool.acquire() as conn:
                rows = await conn.fetch(
                    """SELECT id, name, api_key_enc, priority, weight
                       FROM ai_relay_key_pool
                       WHERE provider_code = $1
                         AND is_enabled = true
                         AND health_status != 'down'
                       ORDER BY priority ASC, id ASC""",
                    provider_code,
                )
        except Exception as e:
            logger.warning(
                "[key_pool] 查询 ai_relay_key_pool 失败(provider=%s): %s",
                provider_code,
                e,
            )
            return None

        if not rows:
            return None

        # 同 priority 分组:取最小 priority 组(priority 已 ASC 排序,首行即最小)
        first_priority = rows[0]["priority"]
        same_priority = [r for r in rows if r["priority"] == first_priority]

        if len(same_priority) == 1:
            chosen = same_priority[0]
        else:
            # 同 priority 内按 weight 加权随机(weight <=0 视为 1 防御异常配置)
            weights = [max(int(r["weight"]), 1) for r in same_priority]
            chosen = random.choices(same_priority, weights=weights, k=1)[0]

        # 解密 api_key_enc(懒导入避免循环依赖)
        from ..core.llm_gateway import _decrypt_api_key

        api_key = _decrypt_api_key(chosen["api_key_enc"])
        if not api_key:
            logger.warning(
                "[key_pool] api_key_enc 解密失败(key_pool_id=%s, name=%s)",
                chosen["id"],
                chosen["name"],
            )
            return None

        return SelectedKey(
            api_key=api_key,
            key_pool_id=str(chosen["id"]),
            key_name=chosen["name"],
        )

    @staticmethod
    async def mark_key_failed(key_pool_id: str, error_message: str) -> None:
        """标记 key 失败:healthy/unknown → degraded,degraded → down(递进熔断)。

        Args:
            key_pool_id: ai_relay_key_pool.id (uuid str)
            error_message: 失败原因(写入 last_error_message,截断 500 字符防超长)
        """
        try:
            pool = await get_shared_pool()
            async with pool.acquire() as conn:
                # 单次 SQL 完成:degraded → down,其他 → degraded
                await conn.execute(
                    """UPDATE ai_relay_key_pool
                       SET health_status = CASE
                             WHEN health_status = 'degraded' THEN 'down'
                             ELSE 'degraded'
                           END,
                           last_error_message = $2,
                           health_checked_at = NOW(),
                           updated_at = NOW()
                       WHERE id = $1""",
                    key_pool_id,
                    error_message[:500],
                )
        except Exception as e:
            logger.warning(
                "[key_pool] mark_key_failed 失败(key_pool_id=%s): %s",
                key_pool_id,
                e,
            )

    @staticmethod
    async def mark_key_healthy(key_pool_id: str) -> None:
        """标记 key 健康:health_status='healthy',清空 last_error_message。"""
        try:
            pool = await get_shared_pool()
            async with pool.acquire() as conn:
                await conn.execute(
                    """UPDATE ai_relay_key_pool
                       SET health_status = 'healthy',
                           last_error_message = NULL,
                           health_checked_at = NOW(),
                           updated_at = NOW()
                       WHERE id = $1""",
                    key_pool_id,
                )
        except Exception as e:
            logger.warning(
                "[key_pool] mark_key_healthy 失败(key_pool_id=%s): %s",
                key_pool_id,
                e,
            )
