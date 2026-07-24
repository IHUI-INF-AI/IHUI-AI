"""Artifacts 持久化存储抽象层(Redis hash + 进程内降级)。

会话 artifacts 通过 Redis hash 持久化(`mcp:artifacts:<conversation_id>` TTL 7d),
进程重启不丢。Redis 不可用时降级到进程内 dict(logger.warning),保证可用性。

对标 Trae Work subagent orchestration 的 artifacts 聚合能力(summarize_artifacts 用)。

设计要点:
- save_artifacts: 写 Redis(HSET 单 field "payload" + EXPIRE 7d),同时镜像到进程内
  fallback dict(write-through 缓存),保证 load 在 Redis miss 时也能命中。
- load_artifacts: Redis 命中 → 返回 Redis 数据;Redis 空/不可用 → 返回 fallback。
- delete_artifacts: 删 Redis + 清 fallback。
- _fallback_cache 同时作为 mcp_server._ARTIFACTS_CACHE 的别名引用,向后兼容现有测试
  (test_mcp_server.py 直接读写 _ARTIFACTS_CACHE)。
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime
from typing import Any

from ..core.config import settings

logger = logging.getLogger(__name__)

# redis.asyncio(异步客户端,ArtifactsStore 用;redis 包未安装时降级为内存)
try:
    import redis.asyncio as aioredis
except ImportError:  # pragma: no cover - 依赖存在时不触发
    aioredis = None  # type: ignore[assignment]

# Redis key 前缀 + TTL(7 天)
_ARTIFACTS_KEY_PREFIX = "mcp:artifacts:"
_ARTIFACTS_TTL_SECONDS = 7 * 24 * 60 * 60

# 进程内降级 dict(Redis 不可用时使用;mcp_server._ARTIFACTS_CACHE 别名引用本对象)
_fallback_cache: dict[str, dict] = {}

# 惰性 Redis 客户端(同步;小块数据 HSET/HGETALL 同步开销可忽略,且便于测试 mock)
_redis_client: Any = None
_redis_checked: bool = False


def _get_redis() -> Any:
    """惰性获取同步 Redis 客户端,降级返回 None。

    首次调用尝试连接;失败/无 URL/无 redis 包 → 永久降级(_redis_checked=True)。
    """
    global _redis_client, _redis_checked
    if _redis_checked:
        return _redis_client
    _redis_checked = True
    try:
        from ..core.config import settings
        url = getattr(settings, "redis_url", "") or ""
        if not url:
            return None
        try:
            import redis  # type: ignore[import-not-found]
        except ImportError:
            logger.warning("artifacts_store: redis 包未安装,降级进程内 dict")
            return None
        client = redis.from_url(url, decode_responses=True)
        client.ping()
        _redis_client = client
        return _redis_client
    except Exception as e:
        logger.warning("artifacts_store Redis 不可用,降级进程内 dict: %s", e)
        _redis_client = None
        return None


def _key(conv_id: str) -> str:
    return f"{_ARTIFACTS_KEY_PREFIX}{conv_id}"


def save_artifacts(conv_id: str, artifacts: dict[str, Any]) -> bool:
    """保存 artifacts 到 Redis hash(HSET + EXPIRE 7d)。

    同时镜像到进程内 fallback dict(write-through),保证 load 在 Redis miss 时命中。
    Returns: True=Redis 持久化成功, False=降级到进程内(或参数非法)。
    """
    if not conv_id or not isinstance(artifacts, dict):
        return False

    # 始终镜像到进程内 fallback(测试兼容 + Redis miss 兜底)
    _fallback_cache[conv_id] = artifacts

    client = _get_redis()
    if client is None:
        return False
    try:
        payload = json.dumps(artifacts, ensure_ascii=False, default=str)
        pipe = client.pipeline()
        pipe.hset(_key(conv_id), "payload", payload)
        pipe.expire(_key(conv_id), _ARTIFACTS_TTL_SECONDS)
        pipe.execute()
        return True
    except Exception as e:
        logger.warning("save_artifacts Redis 写入失败,降级进程内: %s", e)
        return False


def load_artifacts(conv_id: str) -> dict[str, Any]:
    """从 Redis hash 读取 artifacts(HGETALL)。

    Redis 命中(非空)→ 返回 Redis 数据;Redis 空/不可用 → 返回进程内 fallback。
    """
    if not conv_id:
        return {}

    client = _get_redis()
    if client is not None:
        try:
            data = client.hgetall(_key(conv_id))
            if data and "payload" in data:
                return json.loads(data["payload"])
        except Exception as e:
            logger.warning("load_artifacts Redis 读取失败,降级进程内: %s", e)

    # 降级:进程内 dict(Redis 不可用 / key 未命中 / 测试直写 fallback)
    return _fallback_cache.get(conv_id, {})


def delete_artifacts(conv_id: str) -> bool:
    """删除 artifacts(DEL)。Redis 不可用时仅清进程内 dict。"""
    if not conv_id:
        return False
    _fallback_cache.pop(conv_id, None)
    client = _get_redis()
    if client is None:
        return False
    try:
        client.delete(_key(conv_id))
        return True
    except Exception as e:
        logger.warning("delete_artifacts Redis 删除失败: %s", e)
        return False


def reset_for_testing() -> None:
    """测试专用:重置模块状态(清空 fallback + Redis 客户端缓存,强制重新探测)。"""
    global _redis_client, _redis_checked
    _fallback_cache.clear()
    _redis_client = None
    _redis_checked = False


# =============================================================================
# ArtifactsStore:面向 summarize_artifacts 工具的 per-artifact CRUD 存储(异步)
#
# 与上方 save_artifacts/load_artifacts(整 blob,同步)共存:
# - 共用 hash key `mcp:artifacts:<conversation_id>`
# - 整 blob 版用单 field "payload";本类用 field=artifact_id(多 field)
# - 字段名不冲突("payload" ≠ uuid),list() 仅保留有 id+合法 type 的条目,
#   自动跳过 "payload" 整 blob 字段,实现安全共存
# - 索引 key `mcp:artifacts_index:<conversation_id>`(set,本类专用)
# =============================================================================

# 本类专用 TTL(与 _ARTIFACTS_TTL_SECONDS 同值 7 天,独立常量避免与上方重名)
_TTL_SECONDS = 7 * 24 * 60 * 60

# 合法 artifact 类型
_VALID_TYPES = {"plan", "source", "tool_call_result", "screenshot", "file"}

# summarize 时归入 "artifacts" 桶的类型(其余 plan/source 各成一桶)
_ARTIFACT_BUCKET_TYPES = {"tool_call_result", "screenshot", "file"}


class ArtifactsStore:
    """会话 artifacts 存储:Redis 优先(async),降级为内存 dict。

    为 summarize_artifacts 工具提供跨进程持久的 per-artifact CRUD,替代 mcp_server
    中进程内 _ARTIFACTS_CACHE(重启即丢)。降级策略与 memory_store 一致:
    - settings.redis_url 未配置 / redis 包未安装 → 内存 dict
    - Redis ping 失败 → logger.warning + 切内存(不抛异常)
    """

    def __init__(self) -> None:
        # 内存模式:conversation_id -> {artifact_id -> artifact}
        self._store: dict[str, dict[str, dict[str, Any]]] = {}
        self._redis: Any = None
        self._use_redis = bool(settings.redis_url) and aioredis is not None

    # -------------------------------------------------------------------------
    # Redis 客户端(带降级)
    # -----------------------------------------------------------------

    async def _get_redis(self) -> Any:
        """获取 async Redis 客户端;ping 失败时切内存模式(返回 None)。"""
        if self._redis is None and self._use_redis:
            try:
                self._redis = aioredis.from_url(settings.redis_url, decode_responses=True)
                await self._redis.ping()
            except Exception as e:
                logger.warning("ArtifactsStore Redis 不可用,降级为内存模式: %s", e)
                self._use_redis = False
                self._redis = None
        return self._redis

    @staticmethod
    def _hash_key(conversation_id: str) -> str:
        return f"{_ARTIFACTS_KEY_PREFIX}{conversation_id}"

    @staticmethod
    def _index_key(conversation_id: str) -> str:
        return f"mcp:artifacts_index:{conversation_id}"

    async def _refresh_ttl(self, conversation_id: str) -> None:
        """刷新 hash + index 两个 key 的 TTL(7 天)。"""
        redis = await self._get_redis()
        if not redis:
            return
        try:
            await redis.expire(self._hash_key(conversation_id), _TTL_SECONDS)
            await redis.expire(self._index_key(conversation_id), _TTL_SECONDS)
        except Exception as e:  # TTL 失败不影响主流程
            logger.warning("ArtifactsStore expire 失败: %s", e)

    # -------------------------------------------------------------------------
    # 核心方法
    # -----------------------------------------------------------------

    async def add(self, conversation_id: str, artifact: dict[str, Any]) -> dict[str, Any]:
        """添加 artifact,自动生成 id(uuid4)与 created_at。返回 {ok, artifact_id}。"""
        if not conversation_id:
            return {"ok": False, "errorCode": "MISSING_PARAMS", "message": "conversation_id 必填"}
        if not isinstance(artifact, dict):
            return {"ok": False, "errorCode": "INVALID_PARAMS", "message": "artifact 必须为 dict"}

        artifact_id = str(uuid.uuid4())
        art_type = artifact.get("type") or "file"
        if art_type not in _VALID_TYPES:
            art_type = "file"
        record: dict[str, Any] = {
            "id": artifact_id,
            "type": art_type,
            "title": artifact.get("title", ""),
            "content": artifact.get("content", ""),
            "metadata": artifact.get("metadata") or {},
            "created_at": datetime.utcnow().isoformat(),
            "tool_name": artifact.get("tool_name"),
        }

        redis = await self._get_redis()
        if redis:
            try:
                payload = json.dumps(record, ensure_ascii=False)
                await redis.hset(self._hash_key(conversation_id), artifact_id, payload)
                await redis.sadd(self._index_key(conversation_id), artifact_id)
                await self._refresh_ttl(conversation_id)
            except Exception as e:
                logger.warning("ArtifactsStore.add Redis 写入失败,降级内存: %s", e)
                self._store.setdefault(conversation_id, {})[artifact_id] = record
        else:
            self._store.setdefault(conversation_id, {})[artifact_id] = record

        return {"ok": True, "artifact_id": artifact_id}

    async def get(self, conversation_id: str, artifact_id: str) -> dict[str, Any]:
        """获取单个 artifact。未找到返回 {ok:False, errorCode:NOT_FOUND}。"""
        redis = await self._get_redis()
        if redis:
            try:
                raw = await redis.hget(self._hash_key(conversation_id), artifact_id)
                if raw:
                    return {"ok": True, "artifact": json.loads(raw)}
            except Exception as e:
                logger.warning("ArtifactsStore.get Redis 读取失败,降级内存: %s", e)
        # 内存兜底(Redis 不可用或 hget 异常)
        art = self._store.get(conversation_id, {}).get(artifact_id)
        if art is None:
            return {"ok": False, "errorCode": "NOT_FOUND", "message": f"artifact 不存在: {artifact_id}"}
        return {"ok": True, "artifact": art}

    async def list(
        self,
        conversation_id: str,
        artifact_type: str | None = None,
    ) -> dict[str, Any]:
        """列出 conversation 所有 artifact,可选按 type 过滤。返回 {ok, artifacts}。

        防御:仅保留结构完整的 artifact(有 id + 合法 type),跳过同 hash 内其他写入者
        (如 legacy "payload" 整 blob 字段),与 save_artifacts 共存。
        """
        items: list[dict[str, Any]] = []
        redis = await self._get_redis()
        if redis:
            try:
                raw_map = await redis.hgetall(self._hash_key(conversation_id))
                for raw in (raw_map or {}).values():
                    try:
                        a = json.loads(raw)
                    except (json.JSONDecodeError, TypeError):
                        continue
                    if isinstance(a, dict) and a.get("id") and a.get("type") in _VALID_TYPES:
                        items.append(a)
            except Exception as e:
                logger.warning("ArtifactsStore.list Redis 读取失败,降级内存: %s", e)
        # 内存兜底(Redis 不可用或无数据)
        if not items:
            conv = self._store.get(conversation_id, {})
            items = [a for a in conv.values() if isinstance(a, dict) and a.get("id")]

        if artifact_type:
            items = [a for a in items if a.get("type") == artifact_type]
        items.sort(key=lambda a: a.get("created_at", ""))
        return {"ok": True, "artifacts": items}

    async def update(
        self,
        conversation_id: str,
        artifact_id: str,
        updates: dict[str, Any],
    ) -> dict[str, Any]:
        """部分更新(merge)。id/created_at 不可改。返回 {ok, artifact}。"""
        if not isinstance(updates, dict):
            return {"ok": False, "errorCode": "INVALID_PARAMS", "message": "updates 必须为 dict"}

        got = await self.get(conversation_id, artifact_id)
        if not got.get("ok"):
            return got  # {ok:False, errorCode:NOT_FOUND}
        art: dict[str, Any] = got["artifact"]

        for k, v in updates.items():
            if k in ("id", "created_at"):
                continue
            if k == "metadata" and isinstance(v, dict) and isinstance(art.get("metadata"), dict):
                merged = dict(art["metadata"])
                merged.update(v)
                art["metadata"] = merged
            else:
                art[k] = v
        if art.get("type") not in _VALID_TYPES:
            art["type"] = "file"

        redis = await self._get_redis()
        if redis:
            try:
                await redis.hset(
                    self._hash_key(conversation_id),
                    artifact_id,
                    json.dumps(art, ensure_ascii=False),
                )
                await self._refresh_ttl(conversation_id)
            except Exception as e:
                logger.warning("ArtifactsStore.update Redis 写入失败,降级内存: %s", e)
                self._store.setdefault(conversation_id, {})[artifact_id] = art
        else:
            self._store.setdefault(conversation_id, {})[artifact_id] = art

        return {"ok": True, "artifact": art}

    async def remove(self, conversation_id: str, artifact_id: str) -> dict[str, Any]:
        """删除单个 artifact。返回 {ok, artifact_id}。未找到返回 NOT_FOUND。"""
        got = await self.get(conversation_id, artifact_id)
        if not got.get("ok"):
            return got

        redis = await self._get_redis()
        if redis:
            try:
                await redis.hdel(self._hash_key(conversation_id), artifact_id)
                await redis.srem(self._index_key(conversation_id), artifact_id)
            except Exception as e:
                logger.warning("ArtifactsStore.remove Redis 失败,降级内存: %s", e)
                self._store.get(conversation_id, {}).pop(artifact_id, None)
        else:
            self._store.get(conversation_id, {}).pop(artifact_id, None)

        return {"ok": True, "artifact_id": artifact_id}

    async def clear(self, conversation_id: str) -> dict[str, Any]:
        """清空 conversation 所有 artifact(含 legacy "payload" 整 blob)。

        语义为"清空该会话全部 artifacts",故整 hash 删除;返回 {ok, cleared}(cleared
        为删除前本类可见的 artifact 数,不含 legacy blob)。
        """
        lst = await self.list(conversation_id)
        count = len(lst.get("artifacts", []))

        redis = await self._get_redis()
        if redis:
            try:
                await redis.delete(self._hash_key(conversation_id), self._index_key(conversation_id))
            except Exception as e:
                logger.warning("ArtifactsStore.clear Redis 失败,降级内存: %s", e)
                self._store.pop(conversation_id, None)
        else:
            self._store.pop(conversation_id, None)

        return {"ok": True, "cleared": count}

    async def summarize(self, conversation_id: str) -> dict[str, Any]:
        """聚合视图:plans / sources / artifacts / tool_calls_summary。

        返回 {ok, summary: {plans: [], sources: [], artifacts: [],
                            tool_calls_summary: {total, by_tool}}}
        """
        lst = await self.list(conversation_id)
        items = lst.get("artifacts", [])

        plans = [a for a in items if a.get("type") == "plan"]
        sources = [a for a in items if a.get("type") == "source"]
        artifacts = [a for a in items if a.get("type") in _ARTIFACT_BUCKET_TYPES]

        by_tool: dict[str, int] = {}
        total = 0
        for a in items:
            if a.get("type") == "tool_call_result":
                total += 1
                tn = a.get("tool_name") or "unknown"
                by_tool[tn] = by_tool.get(tn, 0) + 1

        return {
            "ok": True,
            "summary": {
                "plans": plans,
                "sources": sources,
                "artifacts": artifacts,
                "tool_calls_summary": {"total": total, "by_tool": by_tool},
            },
        }


# 模块级单例(与 memory_store / agent_orchestrator 模式一致)
artifacts_store = ArtifactsStore()
