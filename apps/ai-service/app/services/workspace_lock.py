# © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
# Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
# [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

"""多 Agent 工作区锁(2-2)。

同一 workspace(目录路径)在同一时刻只允许一个持有者(agent / task / session)写操作,
防止多 Agent 并发写同一目录造成互相覆盖:

- Redis 模式:SET NX EX + 唯一 token(Lua 比较后删/续期),跨进程互斥,
  key 协议与 apps/api(ioredis)共享:`ihui:workspace_lock:{workspace}`,
  value 为 JSON {holder, token, acquiredAt, heartbeatAt}
- 降级模式:redis 包缺失 / REDIS_URL 未配置 / 连接失败 → 进程内内存锁
  (单实例部署下语义一致;对齐 file_editor / agent_checkpoint 降级范式)
- TTL 自动过期:持有者崩溃(无心跳)后锁自动释放,无需人工干预
- 可重入:同一 holder 重复 acquire 视为续期(刷新 TTL),返回原 token
- 释放安全:release 仅在 token 匹配时删除(Lua 原子),防止误删他人锁

使用方式:
    from app.services.workspace_lock import workspace_lock

    info = await workspace_lock.acquire("/repo/my-app", holder="agent-42")
    if info is None:
        current = await workspace_lock.get_lock("/repo/my-app")
        raise RuntimeError(f"工作区被占用: {current.holder}")
    try:
        ...  # 写操作
    finally:
        await workspace_lock.release("/repo/my-app", info.token)

    # 或上下文管理器(获取失败抛 WorkspaceLockHeld,含当前持有者)
    async with workspace_lock.locked("/repo/my-app", holder="task-7") as info:
        ...
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import asdict, dataclass
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 常量(env 可覆盖;不进 tunables —— 非跨端杀手锏参数,无需 TS 镜像 parity)
# ---------------------------------------------------------------------------

# Redis key 前缀(与 apps/api workspace-lock.ts 共享协议,改动须双侧同步)
_LOCK_KEY_PREFIX = "ihui:workspace_lock:"

# 锁 TTL(秒):持有者须在此时间内续期,否则锁自动过期释放
WORKSPACE_LOCK_TTL = int(os.environ.get("WORKSPACE_LOCK_TTL", "120"))

# 心跳续期间隔(秒):任务板/agent 运行时按此频率调 renew
WORKSPACE_LOCK_HEARTBEAT_INTERVAL = max(1, WORKSPACE_LOCK_TTL // 3)


@dataclass
class LockInfo:
    """工作区锁持有信息(内存与 Redis value 的统一结构)。"""

    workspace: str
    holder: str  # 持有者标识:agentId / taskId / sessionId
    token: str  # 本次获取的唯一 token(release 凭证,防误删他人锁)
    acquired_at: float  # epoch 秒
    heartbeat_at: float  # 最近一次续期时间(epoch 秒)


class WorkspaceLockHeld(RuntimeError):
    """工作区被其他持有者占用(async 上下文管理器模式抛出)。

    message 含当前持有者;`current` 属性携带 LockInfo 供调用方展示/决策。
    """

    def __init__(self, current: LockInfo):
        self.current = current
        super().__init__(
            f"工作区 {current.workspace} 已被 {current.holder} 占用"
            f"(获取于 {time.strftime('%H:%M:%S', time.localtime(current.acquired_at))})"
        )


# ---------------------------------------------------------------------------
# Redis 可用性(降级范式对齐 file_editor:包缺失/未配置/连接失败 → 纯内存)
# ---------------------------------------------------------------------------

_redis_mod: Any
try:
    import redis as _redis_import
except ImportError:
    _redis_mod = None
else:
    _redis_mod = _redis_import

_redis_client_instance: Any = None
_redis_available: bool | None = None

# 释放/续期用 Lua(原子比较 token,防误删/误续他人锁)。
# value 为 JSON(含 holder 等信息供跨端读取),故须 cjson 解码后比较 token 字段。
_RELEASE_LUA = """
local v = redis.call("get", KEYS[1])
if not v then return 0 end
local ok, d = pcall(cjson.decode, v)
if not ok or type(d) ~= "table" or d["token"] ~= ARGV[1] then return 0 end
return redis.call("del", KEYS[1])
"""
_RENEW_LUA = """
local v = redis.call("get", KEYS[1])
if not v then return 0 end
local ok, d = pcall(cjson.decode, v)
if not ok or type(d) ~= "table" or d["token"] ~= ARGV[1] then return 0 end
redis.call("expire", KEYS[1], ARGV[2])
return 1
"""


def _get_redis_url() -> str:
    """获取 REDIS_URL(优先项目 config,回退环境变量)。空串 = 未配置。"""
    try:
        from app.core.config import settings

        if settings.redis_url:
            return settings.redis_url
    except Exception as e:  # noqa: BLE001 - config 异常不影响降级判断
        logger.debug("workspace_lock 读取 settings.redis_url 失败: %s", e)
    return os.environ.get("REDIS_URL", "")


def _redis_enabled() -> bool:
    """Redis 模式可用性(包存在 + 配置了 URL)。失败一次后缓存 False。"""
    global _redis_available
    if _redis_available is None:
        _redis_available = bool(_redis_mod is not None) and bool(_get_redis_url())
    return _redis_available


def _redis_client() -> Any:
    """惰性创建 redis 同步客户端(短操作,不阻塞事件循环;同 file_editor)。"""
    global _redis_client_instance
    if not _redis_enabled():
        return None
    if _redis_client_instance is not None:
        return _redis_client_instance
    try:
        client = _redis_mod.from_url(
            _get_redis_url(),
            decode_responses=True,
            protocol=2,
            socket_connect_timeout=2,
        )
        client.ping()
        _redis_client_instance = client
        return client
    except Exception as e:  # noqa: BLE001 - 降级为内存锁,不阻塞主流程
        logger.warning("workspace_lock redis 不可达,降级为进程内锁: %s", e)
        _redis_available = False
        return None


def _lock_key(workspace: str) -> str:
    return f"{_LOCK_KEY_PREFIX}{workspace}"


def _parse_lock(raw: Any, workspace: str) -> LockInfo | None:
    """Redis value(JSON str)→ LockInfo;损坏/缺字段返回 None(视为无锁)。"""
    try:
        d = json.loads(raw)
        return LockInfo(
            workspace=d["workspace"],
            holder=d["holder"],
            token=d["token"],
            acquired_at=float(d["acquired_at"]),
            heartbeat_at=float(d["heartbeat_at"]),
        )
    except Exception:  # noqa: BLE001 - 损坏数据按无锁处理,可重新获取
        logger.warning("workspace_lock key %s value 损坏,按无锁处理", workspace)
        return None


# ---------------------------------------------------------------------------
# 锁实现(Redis 主 / 内存降级,语义一致)
# ---------------------------------------------------------------------------


class WorkspaceLock:
    """多 Agent 工作区锁门面(模块级单例 workspace_lock)。"""

    def __init__(self) -> None:
        # 内存降级模式:{workspace: LockInfo};asyncio.Lock 保证协程级原子性
        self._memory_locks: dict[str, LockInfo] = {}
        # 重入计数:{workspace: 未退出层数};归零才真正删除锁
        # (同 holder 嵌套 locked() 时,内层退出不得释放外层锁)
        self._reentrancy: dict[str, int] = {}
        self._guard = asyncio.Lock()

    # ---------------- 查询 ----------------

    async def get_lock(self, workspace: str) -> LockInfo | None:
        """查询当前持有者;无锁/已过期返回 None(不获取)。"""
        r = _redis_client()
        if r is not None:
            try:
                raw = r.get(_lock_key(workspace))
                return _parse_lock(raw, workspace) if raw else None
            except Exception as e:  # noqa: BLE001 - 查询失败按无锁降级
                logger.warning("workspace_lock get 失败(降级视为无锁): %s", e)
                return None
        async with self._guard:
            return self._memory_locks.get(workspace)

    # ---------------- 获取 ----------------

    async def acquire(
        self,
        workspace: str,
        *,
        holder: str,
        ttl: int | None = None,
    ) -> LockInfo | None:
        """获取工作区锁。

        Returns:
            LockInfo:获取成功(或同 holder 重入续期,返回原 token)。
            None:被其他持有者占用。

        TTL 到期后锁自动释放(持有者崩溃自愈);ttl 缺省用 WORKSPACE_LOCK_TTL。
        """
        if not workspace or not holder:
            raise ValueError("workspace 与 holder 均不能为空")
        ttl = ttl if (ttl is not None and ttl > 0) else WORKSPACE_LOCK_TTL
        now = time.time()

        r = _redis_client()
        if r is not None:
            try:
                # 同 holder 重入:先读现锁,匹配则原 token 续期(Lua 原子)
                raw = r.get(_lock_key(workspace))
                if raw:
                    existing = _parse_lock(raw, workspace)
                    if existing is None:
                        # 损坏 value:清除坏 key 后走 SET NX 重新竞争(自愈)
                        r.delete(_lock_key(workspace))
                    elif existing.holder != holder:
                        return None
                    else:
                        renewed = r.eval(
                            _RENEW_LUA, 1, _lock_key(workspace), existing.token, int(ttl)
                        )
                        if renewed:
                            existing.heartbeat_at = now
                            return existing
                        # 续期失败(极小概率竞态:恰在此刻过期被他人抢走)→ 走全新获取
                info = LockInfo(
                    workspace=workspace,
                    holder=holder,
                    token=uuid.uuid4().hex,
                    acquired_at=now,
                    heartbeat_at=now,
                )
                ok = r.set(
                    _lock_key(workspace),
                    json.dumps(asdict(info), ensure_ascii=False),
                    nx=True,
                    ex=int(ttl),
                )
                return info if ok else None
            except Exception as e:  # noqa: BLE001 - IO 失败降级内存锁重试一次
                logger.warning(
                    "workspace_lock acquire redis 失败,降级内存锁: %s", e
                )

        # 内存模式(或 Redis IO 异常降级)
        async with self._guard:
            existing = self._memory_locks.get(workspace)
            if existing is not None:
                if existing.holder != holder:
                    return None
                existing.heartbeat_at = now
                self._reentrancy[workspace] = self._reentrancy.get(workspace, 1) + 1
                return existing
            info = LockInfo(
                workspace=workspace,
                holder=holder,
                token=uuid.uuid4().hex,
                acquired_at=now,
                heartbeat_at=now,
            )
            self._memory_locks[workspace] = info
            return info

    # ---------------- 释放 / 续期 ----------------

    async def release(self, workspace: str, token: str) -> bool:
        """释放锁(仅 token 匹配时生效)。Returns: 是否真正释放。"""
        r = _redis_client()
        if r is not None:
            try:
                return bool(r.eval(_RELEASE_LUA, 1, _lock_key(workspace), token))
            except Exception as e:  # noqa: BLE001 - IO 失败降级内存重试
                logger.warning(
                    "workspace_lock release redis 失败,降级内存锁: %s", e
                )
        async with self._guard:
            existing = self._memory_locks.get(workspace)
            if existing is not None and existing.token == token:
                depth = self._reentrancy.get(workspace, 1)
                if depth <= 1:
                    # 最外层退出 → 真正释放
                    del self._memory_locks[workspace]
                    self._reentrancy.pop(workspace, None)
                else:
                    # 嵌套内层退出 → 仅减计数,锁仍被外层持有
                    self._reentrancy[workspace] = depth - 1
                return True
            return False

    async def renew(
        self, workspace: str, token: str, *, ttl: int | None = None
    ) -> bool:
        """心跳续期(仅 token 匹配时生效)。持有者应每 HEARTBEAT_INTERVAL 调一次。"""
        ttl = ttl if (ttl is not None and ttl > 0) else WORKSPACE_LOCK_TTL
        now = time.time()
        r = _redis_client()
        if r is not None:
            try:
                ok = bool(
                    r.eval(
                        _RENEW_LUA, 1, _lock_key(workspace), token, int(ttl)
                    )
                )
                return ok
            except Exception as e:  # noqa: BLE001 - IO 失败降级内存重试
                logger.warning("workspace_lock renew redis 失败,降级内存锁: %s", e)
        async with self._guard:
            existing = self._memory_locks.get(workspace)
            if existing is not None and existing.token == token:
                existing.heartbeat_at = now
                return True
            return False

    # ---------------- 强制释放(admin / 调试) ----------------

    async def force_release(self, workspace: str) -> bool:
        """强制释放(无视 token)。仅 admin 运维场景使用。"""
        r = _redis_client()
        if r is not None:
            try:
                return bool(r.delete(_lock_key(workspace)))
            except Exception as e:  # noqa: BLE001 - IO 失败降级内存重试
                logger.warning(
                    "workspace_lock force_release redis 失败,降级内存锁: %s", e
                )
        async with self._guard:
            released = self._memory_locks.pop(workspace, None) is not None
            self._reentrancy.pop(workspace, None)
            return released

    # ---------------- 上下文管理器 ----------------

    @asynccontextmanager
    async def locked(
        self, workspace: str, *, holder: str, ttl: int | None = None
    ) -> AsyncIterator[LockInfo]:
        """上下文管理器:获取失败抛 WorkspaceLockHeld(含当前持有者)。"""
        info = await self.acquire(workspace, holder=holder, ttl=ttl)
        if info is None:
            current = await self.get_lock(workspace)
            raise WorkspaceLockHeld(
                current or LockInfo(workspace, "?", "?", time.time(), time.time())
            )
        try:
            yield info
        finally:
            await self.release(workspace, info.token)

    # ---------------- 测试隔离 ----------------

    def _reset(self) -> None:
        """清空内存锁(仅测试用;Redis 锁靠 TTL 自愈,不清)。"""
        self._memory_locks.clear()
        self._reentrancy.clear()


# 模块级单例(先例:knowledge_card_extractor / session_summarizer)
workspace_lock = WorkspaceLock()

__all__ = [
    "LockInfo",
    "WorkspaceLock",
    "WorkspaceLockHeld",
    "WORKSPACE_LOCK_TTL",
    "WORKSPACE_LOCK_HEARTBEAT_INTERVAL",
    "workspace_lock",
]
# ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
