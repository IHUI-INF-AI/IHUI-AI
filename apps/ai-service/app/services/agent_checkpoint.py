# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

from app.core.tunables import DEFAULT_CHECKPOINT_TTL

logger = logging.getLogger(__name__)

# 默认 checkpoint TTL(唯一真源见 app/core/tunables.py)
# 默认内存上限 1000 个 checkpoint
DEFAULT_MAX_IN_MEMORY = 1000

# redis 包未安装时降级为纯内存模式
try:
    import redis.asyncio as aioredis
except ImportError:
    aioredis = None  # type: ignore[assignment]


class CheckpointNotFoundError(Exception):
    """目标 checkpoint 不存在或已过期/被清理。"""


class CheckpointSessionMismatchError(Exception):
    """checkpoint 归属会话与请求会话不一致(防跨会话回滚)。"""


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


@dataclass
class CheckpointMeta:
    """checkpoint 的轻量元数据视图(供 Checkpoint/Rewind 列表展示)。

    不含完整 messages(避免大响应),只保留定位字段与 message_count。
    列表/HTTP 层用 to_dict() 序列化,天然不泄漏消息内容。
    """

    checkpoint_id: str
    session_id: str
    iteration: int
    status: str
    created_at: float
    expires_at: float
    message_count: int

    def to_dict(self) -> dict[str, Any]:
        return {
            "checkpoint_id": self.checkpoint_id,
            "session_id": self.session_id,
            "iteration": self.iteration,
            "status": self.status,
            "created_at": self.created_at,
            "expires_at": self.expires_at,
            "message_count": self.message_count,
        }


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
                # protocol=2 强制 RESP2:redis-py 8.x 默认 RESP3(HELLO 3 协商),
                # 老 Redis/Memurai 4.x 不支持会 unknown command HELLO(同 im_bridge)
                self._redis = aioredis.from_url(self._redis_url or "", decode_responses=True, protocol=2)
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
        file_snapshots: Optional[list[dict[str, Any]]] = None,
    ) -> str:
        """保存 checkpoint,返回 checkpoint_id。

        Args:
            session_id: agent loop 会话 id
            iteration: 当前完成的 iteration 数(从 1 开始)
            messages: 完整消息历史(深拷贝存储,避免外部修改)
            tool_state: 工具状态(任意可 JSON 化 dict)
            status: running / paused / completed / failed / cancelled
            metadata: 额外元数据(model/prompt/等)
            file_snapshots: 可选的已捕获文件快照引用列表,每项形如
                {"path": <绝对路径>, "version_id": <file_editor.snapshot_file 返回的版本 id>}。
                会以 file_versions 键落入 metadata,供 restore 返回后做文件回滚。

        Returns:
            checkpoint_id (uuid4 hex)
        """
        now = time.time()
        checkpoint_id = uuid.uuid4().hex
        meta = json.loads(json.dumps(metadata or {}, ensure_ascii=False))
        if file_snapshots:
            # 已捕获的文件快照引用:restore 时以 file_versions 对外暴露,驱动文件回滚。
            # 自动补齐 session_id 与 checkpoint_id,便于反查与跨会话隔离。
            meta["file_versions"] = [
                {
                    **json.loads(json.dumps(snap, ensure_ascii=False)),
                    "session_id": session_id,
                    "checkpoint_id": checkpoint_id,
                }
                for snap in file_snapshots
            ]
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
            metadata=meta,
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

    async def list_for_session(
        self, session_id: str
    ) -> list[CheckpointMeta]:
        """列出指定会话的 checkpoint 轻量元数据(供 Checkpoint/Rewind 面板展示)。

        仅返回定位字段 + message_count,不含完整 messages(避免大响应),
        按 created_at 升序。列表/HTTP 层以 to_dict() 序列化即不泄漏消息内容。
        """
        all_cps = await self.list_checkpoints(session_id=session_id)
        return [
            CheckpointMeta(
                checkpoint_id=cp.checkpoint_id,
                session_id=cp.session_id,
                iteration=cp.iteration,
                status=cp.status,
                created_at=cp.created_at,
                expires_at=cp.expires_at,
                message_count=len(cp.messages),
            )
            for cp in all_cps
        ]

    async def restore(
        self, session_id: str, checkpoint_id: str
    ) -> dict[str, Any]:
        """把会话恢复到指定 checkpoint。

        返回包含 messages 的完整会话快照,供调用方写回会话运行时存储。
        Raises:
            CheckpointNotFoundError: checkpoint 不存在/过期
            CheckpointSessionMismatchError: checkpoint 归属其他会话
        """
        cp = await self.load_checkpoint(checkpoint_id)
        if cp is None:
            raise CheckpointNotFoundError(
                f"checkpoint {checkpoint_id} 不存在或已过期,请联系用户重新生成"
            )
        if cp.session_id != session_id:
            raise CheckpointSessionMismatchError(
                f"checkpoint {checkpoint_id} 属于会话 {cp.session_id},不能恢复到会话 {session_id}"
            )

        return {
            "checkpoint_id": cp.checkpoint_id,
            "session_id": cp.session_id,
            "iteration": cp.iteration,
            "status": cp.status,
            "restored_message_count": len(cp.messages),
            # 深拷贝消息历史:调用方修改返回的列表/消息不得污染 checkpoint 快照
            # (Rewind 面板展示 + 会话写回都建立在"原快照不可变"之上)
            "messages": json.loads(json.dumps(cp.messages, ensure_ascii=False)),
            "tool_state": cp.tool_state,
            "metadata": cp.metadata,
            "file_versions": cp.metadata.get("file_versions", []),
        }

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
            except Exception as e:
                logger.warning("agent_checkpoint.close redis aclose 失败: %s", e, exc_info=True)
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
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
