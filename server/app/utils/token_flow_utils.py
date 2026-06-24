"""Token 流水工具函数.

提供 token 充值/消耗流水的异步与同步创建接口,
适配新项目 FastAPI + SQLAlchemy + PostgreSQL 架构.

设计说明:
  - 项目数据库会话为同步 (SQLAlchemy sessionmaker), async 接口通过
    asyncio.to_thread 在独立线程执行, 避免阻塞事件循环.
  - 表路由通过 app.database.get_session_for_table 自动选择正确引擎:
      * zhs_operate_token_flow -> engine1 (AI 库)
      * users                  -> engine2 (中心库)
  - 时间戳统一使用 int(time.time()) 适配 PostgreSQL Integer 字段.
"""

import asyncio
import time
from typing import Dict, Optional

from loguru import logger

from app.database import get_session, get_session_for_table
from app.models.token_models import ZhsOperateTokenFlow

# 操作类型常量
TOKEN_TYPE_RECHARGE = 0  # 充值
TOKEN_TYPE_CONSUME = 1  # 消耗

# token 流水表名 (路由到 engine1)
_TOKEN_FLOW_TABLE = "zhs_operate_token_flow"
# 用户表名 (路由到 engine2)
_USER_TABLE = "users"


async def get_user_id_from_uuid(user_uuid: str) -> Optional[int]:
    """根据 user_uuid 查询用户 ID.

    新项目 users 表以 uuid 作为主键, 无自增 int id;
    若用户存在则尝试返回其 id 字段, 否则返回 None.

    Args:
        user_uuid: 用户 UUID

    Returns:
        用户 ID (int) 或 None
    """

    def _query() -> Optional[int]:
        try:
            factory = get_session_for_table(_USER_TABLE)
            with get_session(factory) as db:
                from app.models.user_models import User

                user = db.query(User).filter(User.uuid == user_uuid).first()
                if user is None:
                    return None
                # 新架构 User 主键为 uuid, 可能无 int id 字段, 安全获取
                return getattr(user, "id", None)
        except Exception as e:
            logger.error(f"[token_flow] get_user_id_from_uuid 查询失败 user_uuid={user_uuid} error={e}")
            return None

    return await asyncio.to_thread(_query)


def _create_record_sync(
    user_uuid: str,
    token_quantity: int,
    user_id: Optional[int],
    op_type: int,
    operate_desc: Optional[str],
    token_free: int,
) -> Dict:
    """同步创建 token 流水记录的内部实现.

    Args:
        user_uuid: 用户 UUID
        token_quantity: token 数量
        user_id: 用户 ID (可空)
        op_type: 操作类型 (TOKEN_TYPE_RECHARGE / TOKEN_TYPE_CONSUME)
        operate_desc: 操作描述 (可空)
        token_free: 是否免费 token

    Returns:
        Dict: 成功 {"success": True, "data": {...}}; 失败 {"success": False, "reason": "..."}
    """
    try:
        factory = get_session_for_table(_TOKEN_FLOW_TABLE)
        with get_session(factory) as db:
            flow = ZhsOperateTokenFlow.create_flow_record(
                db,
                user_uuid=user_uuid,
                token_quantity=token_quantity,
                type=op_type,
                user_id=user_id,
                operate_desc=operate_desc,
                token_free=token_free,
            )
            result = flow.to_dict()
            logger.info(
                f"[token_flow] 创建流水成功 type={op_type} user_uuid={user_uuid} "
                f"quantity={token_quantity} flow_id={result.get('id')}"
            )
            return {"success": True, "data": result}
    except Exception as e:
        logger.error(
            f"[token_flow] 创建流水失败 type={op_type} user_uuid={user_uuid} "
            f"quantity={token_quantity} error={e}"
        )
        return {"success": False, "reason": str(e)}


async def create_token_consume_record(
    user_uuid: str,
    token_quantity: int,
    user_id: Optional[int],
    operate_desc: Optional[str] = None,
    token_free: int = 0,
) -> Dict:
    """异步创建 token 消耗流水记录.

    Args:
        user_uuid: 用户 UUID
        token_quantity: 消耗的 token 数量
        user_id: 用户 ID (可空)
        operate_desc: 操作描述 (可空)
        token_free: 是否免费 token, 默认 0

    Returns:
        Dict: {"success": True/False, "data"/"reason": ...}
    """
    return await asyncio.to_thread(
        _create_record_sync,
        user_uuid,
        token_quantity,
        user_id,
        TOKEN_TYPE_CONSUME,
        operate_desc,
        token_free,
    )


async def create_token_recharge_record(
    user_uuid: str,
    token_quantity: int,
    user_id: Optional[int],
    operate_desc: Optional[str] = None,
    token_free: int = 0,
) -> Dict:
    """异步创建 token 充值流水记录.

    Args:
        user_uuid: 用户 UUID
        token_quantity: 充值的 token 数量
        user_id: 用户 ID (可空)
        operate_desc: 操作描述 (可空)
        token_free: 是否免费 token, 默认 0

    Returns:
        Dict: {"success": True/False, "data"/"reason": ...}
    """
    return await asyncio.to_thread(
        _create_record_sync,
        user_uuid,
        token_quantity,
        user_id,
        TOKEN_TYPE_RECHARGE,
        operate_desc,
        token_free,
    )


def create_token_consume_record_sync(
    user_uuid: str,
    token_quantity: int,
    user_id: Optional[int],
    operate_desc: Optional[str] = None,
    token_free: int = 0,
) -> Dict:
    """同步创建 token 消耗流水记录 (供非异步上下文调用).

    Args:
        user_uuid: 用户 UUID
        token_quantity: 消耗的 token 数量
        user_id: 用户 ID (可空)
        operate_desc: 操作描述 (可空)
        token_free: 是否免费 token, 默认 0

    Returns:
        Dict: {"success": True/False, "data"/"reason": ...}
    """
    return _create_record_sync(
        user_uuid,
        token_quantity,
        user_id,
        TOKEN_TYPE_CONSUME,
        operate_desc,
        token_free,
    )
