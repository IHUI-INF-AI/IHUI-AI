"""Redis utility -- connection pool and common operations.

自动降级: 当 Redis 不可用时, 自动切换到 fakeredis (内存模拟),
无需手动启动 Redis 服务, 项目即可正常运行.
"""

import json
import logging

from app.config import settings

logger = logging.getLogger(__name__)

_pool = None
_fake_redis = None
_use_fake = False


def _try_connect_redis():
    """尝试连接真实 Redis, 失败则根据 ENV 决定是否降级到 fakeredis.

    优先级:
      1. REDIS_URL 完整连接串 (生产推荐)
      2. REDIS_HOST/PORT/PASSWORD/DB 分项配置

    启动时调用一次, 缓存结果. 失败时不阻塞启动.
    """
    global _pool, _fake_redis, _use_fake
    if _pool is not None or _use_fake:
        return  # 已初始化过, 跳过
    try:
        import redis

        # 优先使用 REDIS_URL 完整连接串
        if settings.REDIS_URL:
            _pool = redis.ConnectionPool.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                max_connections=50,
                socket_connect_timeout=2,
                socket_timeout=2,
            )
        else:
            _pool = redis.ConnectionPool(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                password=settings.REDIS_PASSWORD,
                db=settings.REDIS_DB,
                decode_responses=True,
                max_connections=50,
                socket_connect_timeout=2,
                socket_timeout=2,
            )
        # 测试连接
        r = redis.Redis(connection_pool=_pool)
        r.ping()
        logger.info("Redis connected via %s", settings.REDIS_URL or f"{settings.REDIS_HOST}:{settings.REDIS_PORT}")
        _use_fake = False
    except Exception as e:
        # 失败后清空 _pool, 避免 get_redis() 重复使用坏连接
        _pool = None
        # 生产环境: Redis 不可用则直接报错, 不允许降级
        if settings.ENV.lower() in ("production", "prod"):
            logger.error("Redis is required in production but unavailable: %s", e)
            raise RuntimeError(f"Redis connection failed: {e}") from e
        logger.warning("Redis unavailable (%s), falling back to fakeredis", e)
        try:
            import fakeredis

            _fake_redis = fakeredis.FakeRedis(decode_responses=True)
            _use_fake = True
            logger.info("fakeredis initialized (in-memory)")
        except ImportError:
            # fakeredis 不可用也不阻塞启动, 把 _use_fake 设为 True (但 _fake_redis 为 None)
            # 这样后续 get_redis() 调用会快速返回 None 而不是重新尝试连接 Redis
            logger.warning("fakeredis not installed! Redis health will be reported as unavailable")
            _use_fake = True
            _fake_redis = None


def get_redis_pool():
    global _pool
    if _pool is None and not _use_fake:
        _try_connect_redis()
    return _pool


def get_redis():
    # _try_connect_redis 可能在本次调用中把 _use_fake 置为 True (ping 失败降级),
    # 因此必须先触发 pool 初始化, 再判断 _use_fake, 顺序不能反.
    if not _use_fake:
        get_redis_pool()
    if _use_fake:
        return _fake_redis
    import redis

    return redis.Redis(connection_pool=_pool)


def set_key(key: str, value: str, ex: int | None = None):
    try:
        r = get_redis()
        if ex:
            r.setex(key, ex, value)
        else:
            r.set(key, value)
    except Exception as e:
        logger.debug(f"redis set_key fail-open: {e}")


def get_key(key: str) -> str | None:
    try:
        return get_redis().get(key)
    except Exception as e:
        logger.debug(f"redis get_key fail-open: {e}")
        return None


def delete_key(key: str):
    try:
        get_redis().delete(key)
    except Exception as e:
        logger.debug(f"redis delete_key fail-open: {e}")


def set_json(key: str, data: dict, ex: int | None = None):
    try:
        set_key(key, json.dumps(data, ensure_ascii=False), ex)
    except Exception as e:
        logger.debug(f"redis set_json fail-open: {e}")


def get_json(key: str) -> dict | None:
    v = get_key(key)
    if v:
        return json.loads(v)
    return None


def publish(channel: str, message: str):
    try:
        get_redis().publish(channel, message)
    except Exception as e:
        logger.debug(f"redis publish fail-open: {e}")


def check_health() -> bool:
    try:
        return get_redis().ping()
    except Exception:
        return False


def incr_key(key: str) -> int:
    try:
        return get_redis().incr(key)
    except Exception as e:
        logger.debug(f"redis incr_key fail-open: {e}")
        return 0


def incr_key_with_expire(key: str, seconds: int) -> int:
    try:
        r = get_redis()
        val = r.incr(key)
        if r.ttl(key) == -1:
            r.expire(key, seconds)
        return val
    except Exception as e:
        logger.debug(f"redis incr_key_with_expire fail-open: {e}")
        return 0


def set_key_expire(key: str, seconds: int):
    try:
        get_redis().expire(key, seconds)
    except Exception as e:
        logger.debug(f"redis set_key_expire fail-open: {e}")
