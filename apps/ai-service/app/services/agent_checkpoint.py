"""Agent loop 状态 checkpoint + 断点续跑。

设计:
- 每轮 iteration 结束后 checkpoint(消息历史 + iteration 数 + tool state + 时间戳)
- checkpoint 存储到内存(可选 redis 持久化,若 REDIS_URL 配置)
- 中断后(进程崩溃 / 用户取消 / 超时)可从最后 checkpoint 恢复
- 恢复时重建 AgentLoopV2 状态,继续下一轮 iteration
- TTL 24 小时(超时自动清理)

与 apps/cli/src/checkpoints/ 的区别:
- cli checkpoints: 文件级快照(磁盘文件改动)
- agent_checkpoint: agent loop 状态(消息历史 + iteration 进度)
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Optional

logger = logging.getLogger(__name__)

# 默认 TTL 24 小时
DEFAULT_CHECKPOINT_TTL = 24 * 60 * 60
# 默认内存上限 1000 个 checkpoint
DEFAULT_MAX_IN_MEMORY = 1000

# redis 包未安装时降级为纯内存模式
try:
    import redis.asyncio as aioredis  # type: ignore[import-not-found]
except ImportError:
    aioredis = None  # type: ignore[assignment]


@dataclass
class AgentLoopCheckpoint:
    """单次 agent loop checkpoint。"""

    checkpoint_id: str  # uuid4
    session_id: str  # agent loop session id
    iteration: int  # 当前 iteration 数
    messages: list[dict[str, Any]]  # 完整消息历史
    tool_state: dict[str, Any]  # 工具状态
    status: str  # 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
    created_at: float  # unix timestamp
    expires_at: float  # TTL 过期时间
    metadata: dict[str, Any] = field(default_factory=dict)  # 额外元数据(model/prompt/等)

    def to_dict(self) -> dict[str, Any]:
        """序列化为可 JSON 化的 dict。"""
        return {
            "checkpoint_id": self.checkpoint_id,
            "session_id": self.session_id,
            "iteration": self.iteration,
            "messages": self.messages,
            "tool_state": self.tool_state,
            "status": self.status,
            "created_at": self.created_at,
            "expires_at": self.expires_at,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> AgentLoopCheckpoint:
        """从 dict 反序列化。"""
        return cls(
            checkpoint_id=data["checkpoint_id"],
            session_id=data["session_id"],
            iteration=data["iteration"],
            messages=data["messages"],
            tool_state=data["tool_state"],
            status=data["status"],
            created_at=data["created_at"],
            expires_at=data["expires_at"],
            metadata=data.get("metadata", {}),
        )

    def is_expired(self, now: Optional[float] = None) -> bool:
        """检查是否已过期。"""
        current = now if now is not None else time.time()
        return self.expires_at <= current


class AgentCheckpointManager:
    """Agent loop checkpoint 管理器(内存 + 可选 redis)。

    存储策略:
    - 内存为主存储(dict[checkpoint_id -> AgentLoopCheckpoint])
    - session_id -> latest checkpoint_id 反查索引
    - LRU 淘汰:超过 max_in_memory 时删除 created_at 最老的
    - 可选 redis 持久化:若 redis_url 配置,save_checkpoint 时异步写入 redis(带 TTL),
      load_checkpoint 在内存 miss 时回查 redis。
    - redis 不可达/包缺失时静默降级为纯内存模式。
    """

    def __init__(
        self,
        max_in_memory: int = DEFAULT_MAX_IN_MEMORY,
        ttl_seconds: int = DEFAULT_CHECKPOINT_TTL,
        redis_url: Optional[str] = None,
    ):
        self._checkpoints: dict[str, AgentLoopCheckpoint] = {}  # checkpoint_id -> checkpoint
        self._session_index: dict[str, str] = {}  # session_id -> latest checkpoint_id
        self._max = max_in_memory
        self._ttl = ttl_seconds
        self._redis_url = redis_url
        self._redis: Any = None
        self._use_redis = bool(redis_url) and aioredis is not None
        self._lock = asyncio.Lock()

    async def _get_redis(self) -> Any:
        """获取 redis 客户端,连接失败时降级为内存模式。"""
        if self._redis is None and self._use_redis:
            try:
                self._redis = aioredis.from_url(self._redis_url, decode_responses=True)
                await self._redis.ping()
            except Exception as e:
                logger.warning("AgentCheckpointManager redis 不可达,降级为纯内存: %s", e)
                self._use_redis = False
                self._redis = None
        return self._redis

    async def save_checkpoint(
        self,
        session_id: str,
        iteration: int,
        messages: list[dict[str, Any]],
        tool_state: dict[str, Any],
        status: str = "running",
        metadata: Optional[dict[str, Any]] = None,
    ) -> str:
        """保存 checkpoint,返回 checkpoint_id。

        Args:
            session_id: agent loop 会话 id
            iteration: 当前完成的 iteration 数(从 1 开始)
            messages: 完整消息历史(深拷贝存储,避免外部修改)
            tool_state: 工具状态(任意可 JSON 化 dict)
            status: running / paused / completed / failed / cancelled
            metadata: 额外元数据(model/prompt/等)

        Returns:
            checkpoint_id (uuid4 hex)
        """
        now = time.time()
        checkpoint_id = uuid.uuid4().hex
        checkpoint = AgentLoopCheckpoint(
            checkpoint_id=checkpoint_id,
            session_id=session_id,
            iteration=iteration,
            # 深拷贝消息历史,避免外部 list 原地修改污染 checkpoint
            messages=json.loads(json.dumps(messages, ensure_ascii=False)),
            tool_state=json.loads(json.dumps(tool_state, ensure_ascii=False)),
            status=status,
            created_at=now,
            expires_at=now + self._ttl,
            metadata=json.loads(json.dumps(metadata or {}, ensure_ascii=False)),
        )

        async with self._lock:
            self._checkpoints[checkpoint_id] = checkpoint
            self._session_index[session_id] = checkpoint_id
            # LRU 淘汰:超过上限时删除 created_at 最老的
            if len(self._checkpoints) > self._max:
                self._evict_oldest_locked()

        # redis 异步写入(失败只 warning,不阻塞)
        redis = await self._get_redis()
        if redis is not None:
            try:
                key = f"agent_ckpt:{checkpoint_id}"
                await redis.set(
                    key,
                    json.dumps(checkpoint.to_dict(), ensure_ascii=False),
                    ex=self._ttl,
                )
                # 维护 session -> checkpoint 索引(覆盖式)
                await redis.set(
                    f"agent_ckpt:session:{session_id}",
                    checkpoint_id,
                    ex=self._ttl,
                )
            except Exception as e:
                logger.warning("AgentCheckpointManager redis 写入失败: %s", e)

        logger.debug(
            "AgentCheckpointManager save_checkpoint session=%s iter=%d status=%s id=%s",
            session_id,
            iteration,
            status,
            checkpoint_id,
        )
        return checkpoint_id

    def _evict_oldest_locked(self) -> None:
        """(必须持锁)删除 created_at 最老的 checkpoint。"""
        if not self._checkpoints:
            return
        oldest_id = min(self._checkpoints, key=lambda cid: self._checkpoints[cid].created_at)
        oldest = self._checkpoints.pop(oldest_id, None)
        if oldest is not None:
            # 若该 session 的 latest 索引指向被淘汰的 checkpoint,清理索引
            if self._session_index.get(oldest.session_id) == oldest_id:
                del self._session_index[oldest.session_id]

    async def load_checkpoint(self, checkpoint_id: str) -> Optional[AgentLoopCheckpoint]:
        """加载 checkpoint。优先内存,miss 时查 redis。过期返回 None。"""
        now = time.time()
        # 1. 内存查
        async with self._lock:
            cp = self._checkpoints.get(checkpoint_id)
            if cp is not None:
                if cp.is_expired(now):
                    # 过期,清理
                    self._delete_locked(checkpoint_id)
                    return None
                return cp

        # 2. miss 时 redis 查
        redis = await self._get_redis()
        if redis is not None:
            try:
                raw = await redis.get(f"agent_ckpt:{checkpoint_id}")
                if raw:
                    cp = AgentLoopCheckpoint.from_dict(json.loads(raw))
                    if cp.is_expired(now):
                        # redis 过期但未自动清理,删除
                        await redis.delete(f"agent_ckpt:{checkpoint_id}")
                        return None
                    # 回填内存缓存
                    async with self._lock:
                        self._checkpoints[checkpoint_id] = cp
                        self._session_index[cp.session_id] = checkpoint_id
                    return cp
            except Exception as e:
                logger.warning("AgentCheckpointManager redis 读取失败: %s", e)

        return None

    async def load_latest_by_session(self, session_id: str) -> Optional[AgentLoopCheckpoint]:
        """根据 session_id 加载最新 checkpoint。"""
        # 1. 内存索引查
        async with self._lock:
            checkpoint_id = self._session_index.get(session_id)

        if checkpoint_id is not None:
            return await self.load_checkpoint(checkpoint_id)

        # 2. 内存无,redis 查 session 索引
        redis = await self._get_redis()
        if redis is not None:
            try:
                checkpoint_id = await redis.get(f"agent_ckpt:session:{session_id}")
                if checkpoint_id:
                    return await self.load_checkpoint(checkpoint_id)
            except Exception as e:
                logger.warning("AgentCheckpointManager redis session 查询失败: %s", e)

        return None

    async def list_checkpoints(
        self, session_id: Optional[str] = None
    ) -> list[AgentLoopCheckpoint]:
        """列出 checkpoint(可选按 session 过滤)。已过期的不会列出。"""
        now = time.time()
        async with self._lock:
            cps = [
                cp
                for cp in self._checkpoints.values()
                if not cp.is_expired(now)
                and (session_id is None or cp.session_id == session_id)
            ]
        # 按 created_at 升序
        cps.sort(key=lambda c: c.created_at)
        return cps

    def _delete_locked(self, checkpoint_id: str) -> bool:
        """(必须持锁)从内存删除 checkpoint。返回是否删除成功。"""
        cp = self._checkpoints.pop(checkpoint_id, None)
        if cp is None:
            return False
        if self._session_index.get(cp.session_id) == checkpoint_id:
            del self._session_index[cp.session_id]
        return True

    async def delete_checkpoint(self, checkpoint_id: str) -> bool:
        """删除 checkpoint。返回是否删除成功。"""
        async with self._lock:
            deleted = self._delete_locked(checkpoint_id)

        redis = await self._get_redis()
        if redis is not None:
            try:
                await redis.delete(f"agent_ckpt:{checkpoint_id}")
            except Exception as e:
                logger.warning("AgentCheckpointManager redis 删除失败: %s", e)

        return deleted

    async def cleanup_expired(self) -> int:
        """清理过期 checkpoint,返回清理数量。"""
        now = time.time()
        expired_ids: list[str] = []
        async with self._lock:
            for cid, cp in self._checkpoints.items():
                if cp.is_expired(now):
                    expired_ids.append(cid)
            for cid in expired_ids:
                self._delete_locked(cid)

        # 同步清理 redis(尽力,失败不阻塞)
        if expired_ids:
            redis = await self._get_redis()
            if redis is not None:
                try:
                    for cid in expired_ids:
                        await redis.delete(f"agent_ckpt:{cid}")
                except Exception as e:
                    logger.warning("AgentCheckpointManager redis 清理失败: %s", e)

        if expired_ids:
            logger.info("AgentCheckpointManager cleanup_expired 清理 %d 个", len(expired_ids))
        return len(expired_ids)

    async def close(self) -> None:
        """关闭 redis 连接(可选调用)。"""
        if self._redis is not None:
            try:
                await self._redis.aclose()
            except Exception:
                pass
            self._redis = None


# 全局单例
_agent_checkpoint_manager: Optional[AgentCheckpointManager] = None


def get_agent_checkpoint_manager() -> AgentCheckpointManager:
    """获取全局 AgentCheckpointManager 单例。

    读取 REDIS_URL 环境变量决定是否启用 redis 持久化。
    """
    global _agent_checkpoint_manager
    if _agent_checkpoint_manager is None:
        redis_url = os.environ.get("REDIS_URL")
        _agent_checkpoint_manager = AgentCheckpointManager(redis_url=redis_url)
    return _agent_checkpoint_manager


def _reset_global_manager_for_test() -> None:
    """(测试用)重置全局单例。"""
    global _agent_checkpoint_manager
    if _agent_checkpoint_manager is not None:
        try:
            asyncio.get_running_loop().create_task(
                _agent_checkpoint_manager.close()
            )
        except RuntimeError:
            pass
    _agent_checkpoint_manager = None
